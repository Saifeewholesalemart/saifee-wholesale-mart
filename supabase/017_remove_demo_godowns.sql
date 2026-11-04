-- =====================================================================
-- 017_remove_demo_godowns.sql
-- Removes the two old demo godowns that were copied in with sample data:
--   * GD01 "Main Godown"      — 124, M.G. Road ... 452001, Murtaza Saifee (Indore pincode)
--   * GD02 "Secondary Godown" — Plot 45, Sanwer Road ... 452015, Huzefa Saifee (Indore pincode)
-- Both are empty (0 products, 0 units).
--
-- Your real godowns are NOT touched:
--   * MAIN      "Main Godown" — Sagarmal Marg, Khachrod 456224 (all your stock)
--   * SECONDARY "GD02"        — Maulana Azad Marg, Khachrod 456224
--
-- Safety: a godown is removed only if it holds no stock and no batch.
-- One transaction; a copy is saved in cleanup_backup_20261104 first.
-- Supabase -> staging project -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cleanup_backup_20261104 AS
SELECT clock_timestamp() AS backed_up_at, a.* FROM app_records a WHERE false;

DROP TABLE IF EXISTS pg_temp.godown_fix;
CREATE TEMP TABLE godown_fix AS
SELECT g.business_id, g.store, g.id,
       coalesce(g.data->>'code','') || ' ' || coalesce(g.data->>'name','') || ' (' || coalesce(g.data->>'address','') || ')' AS what
FROM app_records g
WHERE g.store = 'fmcg_godowns' AND NOT g.deleted
  AND g.id IN ('gdn-saifee-main', 'gdn-saifee-secondary')
  AND NOT EXISTS (SELECT 1 FROM app_records i WHERE i.store = 'fmcg_inventory' AND NOT i.deleted
                  AND i.data->>'godown_id' = g.id
                  AND coalesce(nullif(i.data->>'physical_qty',''),'0')::numeric > 0)
  AND NOT EXISTS (SELECT 1 FROM app_records b WHERE b.store = 'fmcg_batches' AND NOT b.deleted
                  AND b.data->>'godown_id' = g.id
                  AND coalesce(nullif(b.data->>'quantity',''),'0')::numeric > 0);

INSERT INTO cleanup_backup_20261104
SELECT clock_timestamp(), a.*
FROM app_records a JOIN godown_fix f
  ON a.store = f.store AND a.business_id = f.business_id AND a.id = f.id;

UPDATE app_records a
SET deleted = TRUE, updated_at = clock_timestamp(), updated_by = 'demo-cleanup-2026-11-04'
FROM godown_fix f
WHERE a.store = f.store AND a.business_id = f.business_id AND a.id = f.id;

-- Old normalized godowns table (so the demo godowns don't come back)
DO $$
BEGIN
  BEGIN
    DELETE FROM godowns WHERE id IN (SELECT id FROM godown_fix);
  EXCEPTION WHEN foreign_key_violation THEN
    UPDATE godowns SET status = 'Inactive', is_default = FALSE, updated_at = now()
    WHERE id IN (SELECT id FROM godown_fix);
    RAISE NOTICE 'demo godowns still referenced: marked Inactive instead';
  END;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'old godowns table: skipped';
END $$;

COMMIT;

SELECT 'REMOVED' AS result, what AS godown, id FROM godown_fix ORDER BY id;
