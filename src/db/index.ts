import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const env = getEnv();
    const client = postgres(env.DATABASE_URL);
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export { schema };
