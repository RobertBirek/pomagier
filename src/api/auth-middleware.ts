import type { Request, Response, NextFunction } from "express";
import { getDb, schema } from "@/db/index";
import { eq } from "drizzle-orm";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; subiektUzId: number };
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return next(); // Allow unauthenticated for public endpoints

  try {
    const db = getDb();
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, token));
    if (!session || new Date(session.expiresAt) < new Date()) return next();

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId!));
    if (user) req.user = { id: user.id, role: user.role, subiektUzId: user.subiektUzId };
  } catch {
    /* no session to destroy */
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Zaloguj się" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Zaloguj się" });
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Brak uprawnień administratora" });
  next();
}
