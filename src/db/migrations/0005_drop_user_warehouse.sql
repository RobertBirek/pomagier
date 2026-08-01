-- Sprint 4: Drop per-user warehouse_id column
-- Warehouse selection is now global (config.supported_warehouses),
-- all operators can use any supported warehouse.
DROP INDEX IF EXISTS "idx_users_warehouse_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "warehouse_id";
