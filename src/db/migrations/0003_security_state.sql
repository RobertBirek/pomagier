CREATE TABLE IF NOT EXISTS "login_attempts" (
  "subiekt_uz_id" integer PRIMARY KEY NOT NULL,
  "failures" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "key" varchar(128) PRIMARY KEY NOT NULL,
  "response" text NOT NULL,
  "status_code" integer DEFAULT 200 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_idempotency_expires_at" ON "idempotency_keys" ("expires_at");
