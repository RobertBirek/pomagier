import type { Application, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb, schema } from "../../db/index.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { ApiError } from "../error-handler.js";
import { validate } from "../validation.js";
import { requireAdmin } from "../auth-middleware.js";

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
const pinAttempts = new Map<number, { count: number; lockedUntil: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pinAttempts) {
    if (now > entry.lockedUntil) pinAttempts.delete(id);
  }
}, 60_000);

function checkPinLockout(subiektUzId: number): string | null {
  const entry = pinAttempts.get(subiektUzId);
  if (!entry) return null;
  if (Date.now() < entry.lockedUntil) {
    const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
    return `Konto zablokowane. Spróbuj ponownie za ${remaining} min.`;
  }
  pinAttempts.delete(subiektUzId);
  return null;
}

function recordPinFailure(subiektUzId: number): void {
  const entry = pinAttempts.get(subiektUzId) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= PIN_LOCKOUT_MAX) {
    entry.lockedUntil = Date.now() + PIN_LOCKOUT_MS;
    logger.warn({ subiektUzId, attempts: entry.count }, "PIN lockout activated");
  }
  pinAttempts.set(subiektUzId, entry);
}

function clearPinAttempts(subiektUzId: number): void {
  pinAttempts.delete(subiektUzId);
}

// --- Registration ---
export function registerAuthRoutes(app: Application): void {
  // POST /api/login
  app.post("/api/login", validate(LoginSchema), async (req: Request, res: Response) => {
    const { subiektUzId, pin } = req.body;

    const lockoutMsg = checkPinLockout(subiektUzId);
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
        recordPinFailure(subiektUzId);
        try {
          await db.insert(schema.auditLog).values({
            correlationId: crypto.randomUUID(),
            action: "login_failed",
            details: JSON.stringify({ subiektUzId, reason: "no_user" }),
          });
        } catch (auditErr) {
          logger.warn({ auditErr }, "Failed to write audit log");
        }
        throw ApiError.unauthorized("Użytkownik nie skonfigurowany w PomagierGT");
      }

      if (!verifyPin(pin, user.pin)) {
        recordPinFailure(subiektUzId);
        try {
          await db.insert(schema.auditLog).values({
            correlationId: crypto.randomUUID(),
            userId: user.id,
            action: "login_failed",
            details: JSON.stringify({ subiektUzId, reason: "wrong_pin" }),
          });
        } catch (auditErr) {
          logger.warn({ auditErr }, "Failed to write audit log");
        }
        throw ApiError.unauthorized("Nieprawidłowy PIN");
      }

      clearPinAttempts(subiektUzId);

      const token = generateToken();
      const timeoutMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES || "15");
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      await db.insert(schema.sessions).values({
        userId: user.id,
        token,
        expiresAt,
      });

      await db.insert(schema.auditLog).values({
        correlationId: crypto.randomUUID(),
        userId: user.id,
        action: "login",
        details: JSON.stringify({ subiektUzId, timestamp: new Date().toISOString() }),
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: timeoutMinutes * 60 * 1000,
        path: "/",
      });

      res.json({ token, user: { id: user.id, subiektUzId: user.subiektUzId, role: user.role } });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error({ err }, "Login failed");
      throw ApiError.badRequest("Błąd logowania"); // 500 → errorHandler
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
        res.json({ ok: true, role });
      } catch (err) {
        if (err instanceof ApiError) throw err;
        logger.error({ err }, "Role update failed");
        throw ApiError.badRequest("Błąd");
      }
    },
  );
}
