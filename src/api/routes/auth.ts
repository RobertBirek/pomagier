import type { Application, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb, schema } from "../../db/index.js";
import { eq, and } from "drizzle-orm";
import { logger, getCorrelationId } from "../../lib/logger.js";
import { logEvent } from "../../lib/app-logger.js";
import { ApiError } from "../error-handler.js";
import { validate } from "../validation.js";
import { requireAdmin, requireAuth } from "../auth-middleware.js";

// --- Schemas ---
const LoginSchema = z.object({
  subiektUzId: z.number().int().positive(),
  pin: z.string().min(4).max(8).regex(/^\d+$/, "PIN must be digits only"),
});

const PinSchema = z.object({
  pin: z.string().min(4).max(8).regex(/^\d+$/, "PIN must be 4-8 digits"),
});

const RoleSchema = z.object({
  role: z.enum(["admin", "operator"]),
});

// --- Helpers ---
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin: string, hash: string): boolean {
  return bcrypt.compareSync(pin, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// --- Lockout ---
const PIN_LOCKOUT_MAX = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000;

async function checkPinLockout(subiektUzId: number): Promise<string | null> {
  const db = getDb();
  const [entry] = await db
    .select()
    .from(schema.loginAttempts)
    .where(eq(schema.loginAttempts.subiektUzId, subiektUzId));
  if (!entry?.lockedUntil) return null;
  if (new Date(entry.lockedUntil).getTime() > Date.now()) {
    const remaining = Math.ceil((new Date(entry.lockedUntil).getTime() - Date.now()) / 60_000);
    return `Konto zablokowane. Spróbuj ponownie za ${remaining} min.`;
  }
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.subiektUzId, subiektUzId));
  return null;
}

async function recordPinFailure(subiektUzId: number): Promise<void> {
  const db = getDb();
  const [entry] = await db
    .select()
    .from(schema.loginAttempts)
    .where(eq(schema.loginAttempts.subiektUzId, subiektUzId));
  const failures = (entry?.failures ?? 0) + 1;
  const lockedUntil = failures >= PIN_LOCKOUT_MAX ? new Date(Date.now() + PIN_LOCKOUT_MS) : null;
  await db
    .insert(schema.loginAttempts)
    .values({ subiektUzId, failures, lockedUntil })
    .onConflictDoUpdate({
      target: schema.loginAttempts.subiektUzId,
      set: { failures, lockedUntil, updatedAt: new Date() },
    });
  if (lockedUntil) {
    logger.warn({ subiektUzId, attempts: failures }, "PIN lockout activated");
    await logEvent({
      category: "auth",
      action: "lockout_activated",
      method: "web",
      actorSubiektUzId: subiektUzId,
      success: false,
      details: { attempts: failures },
    });
  }
}

async function clearPinAttempts(subiektUzId: number): Promise<void> {
  await getDb()
    .delete(schema.loginAttempts)
    .where(eq(schema.loginAttempts.subiektUzId, subiektUzId));
}

// --- Registration ---
export function registerAuthRoutes(app: Application): void {
  // POST /api/login
  app.post("/api/login", validate(LoginSchema), async (req: Request, res: Response) => {
    const { subiektUzId, pin } = req.body;

    const lockoutMsg = await checkPinLockout(subiektUzId);
    if (lockoutMsg) {
      res.status(429).json({ error: lockoutMsg });
      return;
    }

    try {
      const db = getDb();
      const [user] = await db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.subiektUzId, subiektUzId), eq(schema.users.active, true)));

      if (!user) {
        await recordPinFailure(subiektUzId);
        await logEvent({
          category: "auth",
          action: "login_failed",
          method: "web",
          actorSubiektUzId: subiektUzId,
          success: false,
          details: { reason: "no_user" },
        });
        throw ApiError.unauthorized("Użytkownik nie skonfigurowany w PomagierGT");
      }

      if (!verifyPin(pin, user.pin)) {
        await recordPinFailure(subiektUzId);
        await logEvent({
          category: "auth",
          action: "login_failed",
          method: "web",
          actorSubiektUzId: user.subiektUzId,
          actorUserId: user.id,
          success: false,
          details: { reason: "wrong_pin" },
        });
        throw ApiError.unauthorized("Nieprawidłowy PIN");
      }

      await clearPinAttempts(subiektUzId);

      const token = generateToken();
      const timeoutMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES || "15");
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      await db.insert(schema.sessions).values({
        userId: user.id,
        token,
        expiresAt,
      });

      await logEvent({
        category: "auth",
        action: "login",
        method: "web",
        actorSubiektUzId: user.subiektUzId,
        actorUserId: user.id,
        correlationId: getCorrelationId(),
        success: true,
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: timeoutMinutes * 60 * 1000,
        path: "/",
      });

      // Token is intentionally only delivered via the httpOnly cookie.
      res.json({
        user: {
          id: user.id,
          subiektUzId: user.subiektUzId,
          role: user.role,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error({ err }, "Login failed");
      throw new ApiError(500, "Błąd logowania"); // Server error, not client error
    }
  });

  // POST /api/logout
  app.post("/api/logout", requireAuth, async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token || (req.headers.authorization || "").replace("Bearer ", "");
      if (token) {
        const db = getDb();
        await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
      }
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
      logger.info({ userId: req.user?.id }, "User logged out");
      await logEvent({
        category: "auth",
        action: "logout",
        method: "web",
        actorUserId: req.user?.id,
        actorSubiektUzId: req.user?.subiektUzId,
        success: true,
      });
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Logout failed");
      res.status(500).json({ error: "Błąd wylogowania" });
    }
  });

  // PUT /api/users/:subiektId/pin
  app.put(
    "/api/users/:subiektId/pin",
    validate(PinSchema),
    requireAdmin,
    async (req: Request, res: Response) => {
      const subiektUzId = parseInt(req.params.subiektId as string);
      const { pin } = req.body;

      if (!subiektUzId) {
        throw ApiError.badRequest("Brak ID użytkownika");
      }

      try {
        const db = getDb();
        await db
          .insert(schema.users)
          .values({ subiektUzId, pin: hashPin(pin), role: "operator" })
          .onConflictDoUpdate({ target: schema.users.subiektUzId, set: { pin: hashPin(pin) } });

        logger.info({ subiektUzId }, "PIN updated");
        await logEvent({
          category: "admin",
          action: "user.pin_updated",
          method: "web",
          actorUserId: req.user?.id,
          actorSubiektUzId: req.user?.subiektUzId,
          target: { type: "user", id: String(subiektUzId) },
          success: true,
        });
        res.json({ ok: true });
      } catch (err) {
        logger.error({ err }, "PIN update failed");
        throw ApiError.badRequest("Błąd zapisu");
      }
    },
  );

  // PUT /api/users/:subiektId/role
  app.put(
    "/api/users/:subiektId/role",
    validate(RoleSchema),
    requireAdmin,
    async (req: Request, res: Response) => {
      const subiektUzId = parseInt(req.params.subiektId as string);
      const { role } = req.body;

      if (!subiektUzId) {
        throw ApiError.badRequest("Brak ID użytkownika");
      }

      try {
        const db = getDb();

        if (role !== "admin") {
          const admins = await db
            .select()
            .from(schema.users)
            .where(and(eq(schema.users.role, "admin"), eq(schema.users.active, true)));

          const appUser = admins.find((a) => a.subiektUzId === subiektUzId);
          if (admins.length === 1 && appUser) {
            throw ApiError.badRequest("Nie można usunąć ostatniego administratora");
          }
        }

        await db
          .update(schema.users)
          .set({ role })
          .where(eq(schema.users.subiektUzId, subiektUzId));

        logger.info({ subiektUzId, role }, "User role updated");
        await logEvent({
          category: "admin",
          action: "user.role_updated",
          method: "web",
          actorUserId: req.user?.id,
          actorSubiektUzId: req.user?.subiektUzId,
          target: { type: "user", id: String(subiektUzId) },
          details: { newRole: role },
          success: true,
        });
        res.json({ ok: true, role });
      } catch (err) {
        if (err instanceof ApiError) throw err;
        logger.error({ err }, "Role update failed");
        throw ApiError.badRequest("Błąd");
      }
    },
  );
}
