ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "warehouse_id" integer;
CREATE INDEX IF NOT EXISTS "idx_users_warehouse_id" ON "users" ("warehouse_id");
