-- =====================================================================
-- 015_demo_payment_cleanup.sql
-- Removes the leftover demo payment PAY-2026-00001 (₹550, Counter / Walk-in,
-- "Cash received at billing") that belonged to demo bill INV/2026-27/00002,
-- and any cash-flow entry made for it.
--
-- Matches only that one payment (number + walk-in + ₹550). Runs in one
-- transaction and saves a copy in cleanup_backup_20261104 first.
--
-- Supabase -> staging project -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS pg_temp.pay_cleanup;
CREATE TEMP TABLE pay_cleanup (business_id TEXT, store TEXT, id TEXT, what TEXT);

INSERT INTO pay_cleanup
SELECT business_id, store, id,
       'Demo payment ' || (data->>'payment_number') || ' ₹' || (data->>'amount')
FROM app_records
WHERE store = 'fmcg_payments' AND NOT deleted
  AND data->>'payment_number' = 'PAY-2026-00001'
  AND data->>'retailer_id' LIKE 'ret-walkin-%'
  AND coalesce(nullif(data->>'amount',''),'0')::numeric = 550;

INSERT INTO pay_cleanup
SELECT a.business_id, a.store, a.id,
       'Cash entry of demo payment (' || replace(a.store, 'fmcg_', '') || ') ₹' || coalesce(a.data->>'amount','')
FROM app_records a
WHERE NOT a.deleted
  AND a.store IN ('fmcg_cash_flow','fmcg_cash_flow_transactions','fmcg_payment_allocations')
  AND EXISTS (SELECT 1 FROM pay_cleanup p
              WHERE p.store = 'fmcg_payments' AND p.business_id = a.business_id
                AND (position('"' || p.id || '"' IN a.data::text) > 0
                     OR position('"PAY-2026-00001"' IN a.data::text) > 0));

INSERT INTO cleanup_backup_20261104
SELECT clock_timestamp(), a.*
FROM app_records a
JOIN pay_cleanup t ON t.store = a.store AND t.id = a.id AND t.business_id = a.business_id;

UPDATE app_records a
SET deleted = TRUE, updated_at = clock_timestamp(), updated_by = 'demo-cleanup-2026-11-04'
FROM pay_cleanup t
WHERE t.store = a.store AND t.id = a.id AND t.business_id = a.business_id;

-- Old normalized payments table (if this payment was copied there)
DO $$
BEGIN
  DELETE FROM payments WHERE id IN (SELECT id FROM pay_cleanup WHERE store = 'fmcg_payments');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'old payments table: skipped (%)', SQLERRM;
END $$;

COMMIT;

SELECT 'REMOVED' AS result, what AS item, store, id FROM pay_cleanup ORDER BY store;
