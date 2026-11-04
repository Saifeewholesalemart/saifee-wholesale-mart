-- =====================================================================
-- 018_clear_stale_reserved_stock.sql
-- After the demo orders were removed, some stock is still shown as
-- "reserved" (for example sports bra 32 loose: 12 in stock, 5 reserved,
-- only 7 available). Nothing is really reserved any more, so this frees it.
--
-- Safety: runs ONLY if the business has no open order at all (every
-- remaining order is billed or cancelled). Physical stock is not changed —
-- only "reserved" goes to 0 and "available" becomes equal to physical.
-- One transaction; a copy is saved in cleanup_backup_20261104 first.
-- Supabase -> staging project -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cleanup_backup_20261104 AS
SELECT clock_timestamp() AS backed_up_at, a.* FROM app_records a WHERE false;

DROP TABLE IF EXISTS pg_temp.reserve_fix;
CREATE TEMP TABLE reserve_fix AS
SELECT i.business_id, i.id, i.data->>'product_id' AS product_id,
       coalesce(nullif(i.data->>'physical_qty',''),'0')::numeric AS physical,
       coalesce(nullif(i.data->>'reserved_qty',''),'0')::numeric AS reserved
FROM app_records i
WHERE i.store = 'fmcg_inventory' AND NOT i.deleted
  AND coalesce(nullif(i.data->>'reserved_qty',''),'0')::numeric > 0
  AND NOT EXISTS (
    SELECT 1 FROM app_records o
    WHERE o.store = 'fmcg_orders' AND NOT o.deleted AND o.business_id = i.business_id
      AND coalesce(o.data->>'status','') NOT IN ('Billed','Invoiced','Delivered','Dispatched','Cancelled','Closed')
  );

INSERT INTO cleanup_backup_20261104
SELECT clock_timestamp(), a.*
FROM app_records a JOIN reserve_fix f
  ON a.store = 'fmcg_inventory' AND a.business_id = f.business_id AND a.id = f.id;

UPDATE app_records a
SET data = jsonb_set(jsonb_set(jsonb_set(a.data,
             '{reserved_qty}', '0'::jsonb),
             '{available_qty}', to_jsonb(f.physical)),
             '{updated_at}', to_jsonb(to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    updated_at = clock_timestamp(), updated_by = 'clear-stale-reserved'
FROM reserve_fix f
WHERE a.store = 'fmcg_inventory' AND a.business_id = f.business_id AND a.id = f.id;

-- Old normalized inventory table (keep it in step)
DO $$
BEGIN
  UPDATE inventory v SET reserved_qty = 0, available_qty = v.physical_qty, updated_at = now()
  WHERE v.id IN (SELECT id FROM reserve_fix);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'old inventory table: skipped (%)', SQLERRM;
END $$;

COMMIT;

SELECT coalesce((SELECT p.data->>'name' FROM app_records p
                  WHERE p.store = 'fmcg_products' AND p.id = f.product_id AND p.business_id = f.business_id LIMIT 1),
                 f.product_id) AS product,
       f.physical AS in_stock, f.reserved AS was_reserved, f.physical AS now_available
FROM reserve_fix f ORDER BY 1;
