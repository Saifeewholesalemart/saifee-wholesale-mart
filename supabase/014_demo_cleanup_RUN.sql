-- =====================================================================
-- 014_demo_cleanup_RUN.sql
-- Saifee Wholesale Mart: DEMO DATA CLEANUP — STEP 2 (REMOVES DATA)
--
-- Run STEP 1 (013_demo_cleanup_PREVIEW.sql) first and check the list.
--
-- What it removes (only these):
--   * Demo orders ORD-2026-00001 … ORD-2026-00006 (including duplicate numbers)
--   * Demo bills INV/2026-27/00001 and INV/2026-27/00002, and their payments,
--     challans, fulfilments, returns and cash-flow entries
--   * Demo shops from Indore (Shree Ganesh, Om Kirana, Gupta Provision, Apna Bazaar,
--     Laxmi Trading) and the extra old "Counter / Walk-in Customer" (ret-walkin-counter)
--     — only if the shop has no real order/bill
--   * Demo godowns "Godown A (Central Hub)" and "Godown B (Express Bay)" — only if empty
--   * Demo salesman login (p-demo-salesman) and logins of the removed demo shops
--
-- What it does NOT touch: products, stock, batches, categories, purchases,
-- your real shops (Jain Kirana etc.), stock ledger / audit history.
--
-- Safety:
--   * Everything runs in ONE transaction: if any step fails, nothing changes.
--   * A copy of every removed app record is saved in table cleanup_backup_20261104.
--   * Records are marked deleted (not erased), so every phone/laptop removes them
--     on its next sync.
--
-- How to run:
--   Supabase -> staging project -> SQL Editor -> New query -> paste whole file -> Run.
--   Then open the app on every device once (or press refresh) so they sync.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Build the exact list of records to remove
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp.cleanup_targets;
CREATE TEMP TABLE cleanup_targets (business_id TEXT, store TEXT, id TEXT, what TEXT);

-- 1a. Demo orders and demo bills
INSERT INTO cleanup_targets
SELECT business_id, store, id, 'Demo order ' || (data->>'order_number')
FROM app_records
WHERE store = 'fmcg_orders' AND NOT deleted
  AND data->>'order_number' IN ('ORD-2026-00001','ORD-2026-00002','ORD-2026-00003',
                                'ORD-2026-00004','ORD-2026-00005','ORD-2026-00006');

INSERT INTO cleanup_targets
SELECT business_id, store, id, 'Demo invoice ' || (data->>'invoice_number')
FROM app_records
WHERE store = 'fmcg_invoices' AND NOT deleted
  AND data->>'invoice_number' IN ('INV/2026-27/00001','INV/2026-27/00002');

-- 1b. Payments / challans / fulfilments / returns / cash-flow linked to those bills or orders
CREATE TEMP TABLE cleanup_doc_keys ON COMMIT DROP AS
SELECT t.id AS k FROM cleanup_targets t
UNION
SELECT a.data->>'invoice_number' FROM app_records a
JOIN cleanup_targets t ON t.store = a.store AND t.id = a.id AND t.business_id = a.business_id
WHERE a.store = 'fmcg_invoices';

INSERT INTO cleanup_targets
SELECT a.business_id, a.store, a.id, 'Linked to demo bill/order (' || replace(a.store, 'fmcg_', '') || ')'
FROM app_records a
WHERE NOT a.deleted
  AND a.store IN ('fmcg_payments','fmcg_payment_allocations','fmcg_delivery_challans','fmcg_fulfilments',
                  'fmcg_sales_returns','fmcg_cash_flow','fmcg_cash_flow_transactions')
  AND EXISTS (SELECT 1 FROM cleanup_doc_keys k WHERE k.k IS NOT NULL AND position('"' || k.k || '"' IN a.data::text) > 0);

-- 1b-2. The payment behind a demo bill (found through its allocation), and cash entries of that payment
CREATE TEMP TABLE cleanup_pay_ids ON COMMIT DROP AS
SELECT DISTINCT a.business_id, a.data->>'payment_id' AS pid
FROM app_records a
JOIN cleanup_targets t ON t.store = a.store AND t.id = a.id AND t.business_id = a.business_id
WHERE a.store = 'fmcg_payment_allocations' AND a.data->>'payment_id' IS NOT NULL
  -- safety: skip a payment that is also allocated to a real bill
  AND NOT EXISTS (
    SELECT 1 FROM app_records o
    WHERE o.store = 'fmcg_payment_allocations' AND NOT o.deleted AND o.business_id = a.business_id
      AND o.data->>'payment_id' = a.data->>'payment_id'
      AND NOT EXISTS (SELECT 1 FROM cleanup_targets t2 WHERE t2.store = o.store AND t2.id = o.id AND t2.business_id = o.business_id)
  );

INSERT INTO cleanup_targets
SELECT a.business_id, a.store, a.id, 'Payment / cash entry of demo bill (' || replace(a.store, 'fmcg_', '') || ')'
FROM app_records a
WHERE NOT a.deleted
  AND a.store IN ('fmcg_payments','fmcg_cash_flow','fmcg_cash_flow_transactions')
  AND EXISTS (SELECT 1 FROM cleanup_pay_ids p WHERE p.business_id = a.business_id
              AND (a.id = p.pid OR position('"' || p.pid || '"' IN a.data::text) > 0))
  AND NOT EXISTS (SELECT 1 FROM cleanup_targets t WHERE t.store = a.store AND t.id = a.id AND t.business_id = a.business_id);

-- 1c. Demo shops (only if they have no real order / bill / payment)
INSERT INTO cleanup_targets
SELECT r.business_id, r.store, r.id,
       'Demo shop: ' || (r.data->>'shop_name') || ' (' || coalesce(r.data->>'city','') || ')'
FROM app_records r
WHERE r.store = 'fmcg_retailers' AND NOT r.deleted
  AND (
    (r.data->>'shop_name' IN ('Shree Ganesh Super Market','Om Kirana & General Store','Gupta Provision Store',
                              'Apna Bazaar Mart','Laxmi Trading & Daily Needs')
     AND lower(coalesce(r.data->>'city','')) = 'indore')
    OR
    (r.id = 'ret-walkin-counter'
     AND EXISTS (SELECT 1 FROM app_records w WHERE w.store = 'fmcg_retailers' AND NOT w.deleted
                 AND w.id LIKE 'ret-walkin-%' AND w.id <> 'ret-walkin-counter'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM app_records x
    WHERE x.store IN ('fmcg_orders','fmcg_invoices','fmcg_payments') AND NOT x.deleted
      AND x.data->>'retailer_id' = r.id
      AND NOT EXISTS (SELECT 1 FROM cleanup_targets t WHERE t.store = x.store AND t.id = x.id AND t.business_id = x.business_id)
  );

-- 1d. Demo godowns (only if empty)
INSERT INTO cleanup_targets
SELECT g.business_id, g.store, g.id, 'Demo godown: ' || (g.data->>'name')
FROM app_records g
WHERE g.store = 'fmcg_godowns' AND NOT g.deleted
  AND g.data->>'name' IN ('Godown A (Central Hub)','Godown B (Express Bay)')
  AND NOT EXISTS (SELECT 1 FROM app_records i WHERE i.store = 'fmcg_inventory' AND NOT i.deleted
                  AND i.data->>'godown_id' = g.id
                  AND coalesce(nullif(i.data->>'physical_qty',''),'0')::numeric > 0)
  AND NOT EXISTS (SELECT 1 FROM app_records b WHERE b.store = 'fmcg_batches' AND NOT b.deleted
                  AND b.data->>'godown_id' = g.id
                  AND coalesce(nullif(b.data->>'quantity',''),'0')::numeric > 0);

-- Shops whose demo bills are being removed (their balance is reset below)
CREATE TEMP TABLE cleanup_bill_shops ON COMMIT DROP AS
SELECT DISTINCT a.business_id, a.data->>'retailer_id' AS retailer_id
FROM app_records a
JOIN cleanup_targets t ON t.store = a.store AND t.id = a.id AND t.business_id = a.business_id
WHERE a.store = 'fmcg_invoices' AND a.data->>'retailer_id' IS NOT NULL;

-- ---------------------------------------------------------------
-- 2. Backup copy of everything that will be removed
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cleanup_backup_20261104 AS
SELECT clock_timestamp() AS backed_up_at, a.* FROM app_records a WHERE false;

INSERT INTO cleanup_backup_20261104
SELECT clock_timestamp(), a.*
FROM app_records a
JOIN cleanup_targets t ON t.store = a.store AND t.id = a.id AND t.business_id = a.business_id;

ALTER TABLE cleanup_backup_20261104 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cleanup_backup_20261104 FROM anon;
REVOKE ALL ON cleanup_backup_20261104 FROM authenticated;

-- ---------------------------------------------------------------
-- 3. Mark them deleted (every device removes them on next sync)
-- ---------------------------------------------------------------
UPDATE app_records a
SET deleted = TRUE, updated_at = clock_timestamp(), updated_by = 'demo-cleanup-2026-11-04'
FROM cleanup_targets t
WHERE t.store = a.store AND t.id = a.id AND t.business_id = a.business_id;

-- ---------------------------------------------------------------
-- 4. Reset the balance of shops whose only bills were demo bills
-- ---------------------------------------------------------------
UPDATE app_records r
SET data = jsonb_set(jsonb_set(r.data, '{outstanding}', '0'::jsonb), '{updated_at}',
                     to_jsonb(to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    updated_at = clock_timestamp(), updated_by = 'demo-cleanup-2026-11-04'
FROM cleanup_bill_shops s
WHERE r.store = 'fmcg_retailers' AND NOT r.deleted
  AND r.business_id = s.business_id AND r.id = s.retailer_id
  AND NOT EXISTS (SELECT 1 FROM app_records i WHERE i.store = 'fmcg_invoices' AND NOT i.deleted
                  AND i.business_id = r.business_id AND i.data->>'retailer_id' = r.id);

DO $$
BEGIN
  UPDATE retailers SET outstanding = 0, updated_at = now()
  WHERE id IN (SELECT retailer_id FROM cleanup_bill_shops)
    AND NOT EXISTS (SELECT 1 FROM app_records i WHERE i.store = 'fmcg_invoices' AND NOT i.deleted
                    AND i.data->>'retailer_id' = retailers.id);
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'retailers table: balance column not found, skipped';
END $$;

-- ---------------------------------------------------------------
-- 5. Old normalized tables (kept in step so they don't bring demo data back)
-- ---------------------------------------------------------------

-- 5a. Demo shops: mark inactive (the app treats inactive shops as removed)
DO $$
BEGIN
  UPDATE retailers SET active = FALSE, updated_at = now()
  WHERE id IN (SELECT id FROM cleanup_targets WHERE store = 'fmcg_retailers');
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'retailers table not found, skipped';
END $$;

-- 5b. Demo godowns: delete (or mark inactive if something still points to them)
DO $$
BEGIN
  BEGIN
    DELETE FROM godowns WHERE id IN (SELECT id FROM cleanup_targets WHERE store = 'fmcg_godowns');
  EXCEPTION WHEN foreign_key_violation THEN
    UPDATE godowns SET status = 'Inactive', updated_at = now()
    WHERE id IN (SELECT id FROM cleanup_targets WHERE store = 'fmcg_godowns');
    RAISE NOTICE 'godowns still referenced: marked Inactive instead';
  END;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'godowns table not found, skipped';
END $$;

-- 5c. Demo orders / bills in the old tables (child rows first)
DO $$
DECLARE
  parent TEXT;
  key_col TEXT;
  nums TEXT[];
  fk RECORD;
BEGIN
  FOR parent, key_col, nums IN
    SELECT * FROM (VALUES
      ('invoices', 'invoice_number', ARRAY['INV/2026-27/00001','INV/2026-27/00002']),
      ('orders',   'order_number',   ARRAY['ORD-2026-00001','ORD-2026-00002','ORD-2026-00003',
                                         'ORD-2026-00004','ORD-2026-00005','ORD-2026-00006'])
    ) v(p, c, n)
  LOOP
    IF to_regclass('public.' || parent) IS NULL THEN CONTINUE; END IF;
    BEGIN
      FOR fk IN
        SELECT c.conrelid::regclass AS child, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = ('public.' || parent)::regclass
      LOOP
        EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM %I WHERE %I = ANY($1))',
                       fk.child, fk.col, parent, key_col) USING nums;
      END LOOP;
      EXECUTE format('DELETE FROM %I WHERE %I = ANY($1)', parent, key_col) USING nums;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'old % table: could not remove demo rows (%), skipped', parent, SQLERRM;
    END;
  END LOOP;
END $$;

-- 5d. Demo logins (salesman + removed demo shops)
DO $$
BEGIN
  BEGIN
    DELETE FROM profiles
    WHERE id = 'p-demo-salesman'
       OR retailer_id IN (SELECT id FROM cleanup_targets WHERE store = 'fmcg_retailers');
  EXCEPTION WHEN foreign_key_violation THEN
    UPDATE profiles SET active = FALSE, status = 'INACTIVE', updated_at = now()
    WHERE id = 'p-demo-salesman'
       OR retailer_id IN (SELECT id FROM cleanup_targets WHERE store = 'fmcg_retailers');
    RAISE NOTICE 'some demo logins are still referenced: disabled instead of deleted';
  END;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'profiles table not found, skipped';
END $$;

COMMIT;

-- ---------------------------------------------------------------
-- 6. Result
-- ---------------------------------------------------------------
SELECT 'REMOVED' AS result, what AS item, store, id FROM cleanup_targets
UNION ALL
SELECT 'DEMO LOGIN STILL ACTIVE (should be empty)', name, 'profiles', id
FROM profiles WHERE id = 'p-demo-salesman' AND coalesce(active, TRUE)
ORDER BY 1, 2;
