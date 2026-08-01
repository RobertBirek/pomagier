-- Sprint 7: comprehensive logging (spec 2026-08-01)
-- Extends audit_log and product_movements with metadata required by
-- structured app-logger (category, method, actor_subiekt_uz_id, target_*).

-- Nowe kolumny w audit_log (NULLable dla backward compat)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS category varchar(20);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS method varchar(20);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_subiekt_uz_id integer;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_type varchar(50);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_id varchar(100);

-- Backfill istniejących wpisów
UPDATE audit_log SET category = 'auth' WHERE category IS NULL;
UPDATE audit_log SET method = 'web' WHERE method IS NULL;

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_subiekt_uz_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log (correlation_id);

-- Rozszerzenie product_movements
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS method varchar(20);
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS actor_subiekt_uz_id integer;
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS correlation_id_idx varchar(36);

CREATE INDEX IF NOT EXISTS idx_pm_product_method ON product_movements (product_id, method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_actor ON product_movements (actor_subiekt_uz_id, created_at DESC);
