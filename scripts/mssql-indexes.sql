/*
  PomagierGT / Subiekt GT performance indexes.
  Run only during a maintenance window after a Subiekt database backup.
  Idempotent and data-preserving, but changes the ERP database schema.
*/

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_pomagier_tw_Towar_KodKresk'
    AND object_id = OBJECT_ID(N'dbo.tw__Towar')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_pomagier_tw_Towar_KodKresk
    ON dbo.tw__Towar (tw_PodstKodKresk)
    INCLUDE (tw_Symbol, tw_Nazwa);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_pomagier_tw_Towar_Symbol'
    AND object_id = OBJECT_ID(N'dbo.tw__Towar')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_pomagier_tw_Towar_Symbol
    ON dbo.tw__Towar (tw_Symbol)
    INCLUDE (tw_Nazwa, tw_PodstKodKresk);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_pomagier_uf_SynchroKodyKresk_Kod'
    AND object_id = OBJECT_ID(N'dbo.uf_SynchroKodyKresk')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_pomagier_uf_SynchroKodyKresk_Kod
    ON dbo.uf_SynchroKodyKresk (usk_Kod)
    INCLUDE (usk_IdSynchronizacja);
END;
