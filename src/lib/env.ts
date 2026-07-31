import { z } from "zod";

const envSchema = z.object({
  MSSQL_HOST: z.string().min(1, "MSSQL_HOST is required"),
  MSSQL_PORT: z.coerce.number().default(1433),
  MSSQL_DATABASE: z.string().min(1, "MSSQL_DATABASE is required"),
  MSSQL_USER: z.string().min(1, "MSSQL_USER is required"),
  MSSQL_PASSWORD: z.string().min(1, "MSSQL_PASSWORD is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 chars"),
  CONFIG_ENCRYPTION_KEY: z.string().min(16).optional(),
  BACKUP_ENCRYPTION_KEY: z.string().min(16).optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(15),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
      throw new Error("Environment validation failed");
    }
    _env = result.data;
  }
  return _env;
}
