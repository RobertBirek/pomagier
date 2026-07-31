import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { users } from "../src/db/schema.ts";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://pomagier:pomagier_dev@localhost:5432/pomagier";

function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

/**
 * Domyślny PIN dla setupu.
 *
 * Od v1.6.2 (Sprint 3) świadoma decyzja: stały PIN "0000" dla wszystkich
 * seedowanych userów, aby umożliwić szybki onboarding w środowisku LAN.
 * Lockout (5 prób / 5 min) ogranicza ryzyko brute-force. Admin powinien
 * zrotować PIN bezpośrednio po pierwszym logowaniu.
 *
 * Patrz: CHANGELOG.md, SECURITY.md (Phase 2 hardening plan)
 */
function generatePin(): string {
  return "0000";
}

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log("Seeding app users with random 6-digit PINs for Subiekt operators...");

  const data = [
    { subiektUzId: 1, role: "admin" }, // Szef
    { subiektUzId: 3, role: "operator" }, // Jan Kowalski
  ];

  for (const u of data) {
    const pin = generatePin();
    await db
      .insert(users)
      .values({ subiektUzId: u.subiektUzId, pin: hashPin(pin), role: u.role })
      .onConflictDoUpdate({
        target: users.subiektUzId,
        set: { pin: hashPin(pin), role: u.role },
      });
    console.log(
      `  User subiekt_uz_id=${u.subiektUzId}: PIN set (role: ${u.role}) → ${pin} [SAVE THIS — shown once]`,
    );
  }

  console.log("Done.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
