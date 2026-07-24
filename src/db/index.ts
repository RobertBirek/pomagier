import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL ?? "postgresql://pomagier:pomagier_dev@localhost:5432/pomagier";
    const client = postgres(url, {
      connect_timeout: 5,
      idle_timeout: 10,
    });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export { schema };
