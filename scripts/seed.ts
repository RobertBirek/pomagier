import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { users } from "../src/db/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://pomagier:pomagier_dev@localhost:5432/pomagier";

function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log("Seeding app users with PINs for Subiekt operators...");

  const data = [
    { subiektUzId: 1, pin: "0000", role: "admin" },    // Szef
    { subiektUzId: 3, pin: "1111", role: "operator" },  // Jan Kowalski
  ];

  for (const u of data) {
    await db
      .insert(users)
      .values({ subiektUzId: u.subiektUzId, pin: hashPin(u.pin), role: u.role })
      .onConflictDoUpdate({
        target: users.subiektUzId,
        set: { pin: hashPin(u.pin), role: u.role },
      });
    console.log(`  User subiekt_uz_id=${u.subiektUzId}: PIN set (role: ${u.role})`);
  }

  console.log("Done.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
