-- =====================================================================
-- 013_demo_cleanup_PREVIEW.sql
-- Saifee Wholesale Mart: DEMO DATA CLEANUP — STEP 1 (PREVIEW ONLY)
--
-- This file ONLY READS. It does not change or delete anything.
-- It lists exactly what STEP 2 (014_demo_cleanup_RUN.sql) will remove.
--
-- How to run:
--   Supabase -> staging project (jtofsoriinobcabpjswl) -> SQL Editor
--   -> New query -> paste this whole file -> Run.
--   Send a screenshot of the result to Claude before running STEP 2.
-- =====================================================================

WITH
demo_orders AS (
  SELECT business_id, store, id, 'Demo order ' || (data->>'order_number') AS what
  FROM app_records
  WHERE store = 'fmcg_orders' AND NOT deleted
    AND data->>'order_number' IN ('ORD-2026-00001','ORD-2026-00002','ORD-2026-00003',
                                  'ORD-2026-00004','ORD-2026-00005','ORD-2026-00006')
),
demo_invoices AS (
  SELECT business_id, store, id, 'Demo invoice ' || (data->>'invoice_number') AS what
  FROM app_records
  WHERE store = 'fmcg_invoices' AND NOT deleted
    AND data->>'invoice_number' IN ('INV/2026-27/00001','INV/2026-27/00002')
),
doc_keys AS (
  SELECT id AS k FROM demo_orders
  UNION SELECT id FROM demo_invoices
  UNION SELECT a.data->>'invoice_number' FROM app_records a JOIN demo_invoices d ON d.store = a.store AND d.id = a.id AND d.business_id = a.business_id
),
linked_docs AS (
  SELECT a.business_id, a.store, a.id,
         'Linked to demo bill/order (' || replace(a.store, 'fmcg_', '') || ')' AS what
  FROM app_records a
  WHERE NOT a.deleted
    AND a.store IN ('fmcg_payments','fmcg_payment_allocations','fmcg_delivery_challans','fmcg_fulfilments',
                    'fmcg_sales_returns','fmcg_cash_flow','fmcg_cash_flow_transactions')
    AND EXISTS (SELECT 1 FROM doc_keys k WHERE k.k IS NOT NULL AND position('"' || k.k || '"' IN a.data::text) > 0)
),
pay_ids AS (
  SELECT DISTINCT a.business_id, a.data->>'payment_id' AS pid
  FROM app_records a
  JOIN linked_docs l ON l.store = a.store AND l.id = a.id AND l.business_id = a.business_id
  WHERE a.store = 'fmcg_payment_allocations' AND a.data->>'payment_id' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM app_records o
      WHERE o.store = 'fmcg_payment_allocations' AND NOT o.deleted AND o.business_id = a.business_id
        AND o.data->>'payment_id' = a.data->>'payment_id'
        AND NOT EXISTS (SELECT 1 FROM linked_docs l2 WHERE l2.store = o.store AND l2.id = o.id AND l2.business_id = o.business_id)
    )
),
pay_docs AS (
  SELECT a.business_id, a.store, a.id,
         'Payment / cash entry of demo bill (' || replace(a.store, 'fmcg_', '') || ')' AS what
  FROM app_records a
  WHERE NOT a.deleted
    AND a.store IN ('fmcg_payments','fmcg_cash_flow','fmcg_cash_flow_transactions')
    AND EXISTS (SELECT 1 FROM pay_ids p WHERE p.business_id = a.business_id
                AND (a.id = p.pid OR position('"' || p.pid || '"' IN a.data::text) > 0))
    AND NOT EXISTS (SELECT 1 FROM linked_docs l WHERE l.store = a.store AND l.id = a.id AND l.business_id = a.business_id)
),
doc_targets AS (
  SELECT * FROM demo_orders UNION ALL SELECT * FROM demo_invoices UNION ALL SELECT * FROM linked_docs
  UNION ALL SELECT * FROM pay_docs
),
demo_retailers AS (
  SELECT r.business_id, r.store, r.id,
         'Demo shop: ' || (r.data->>'shop_name') || ' (' || coalesce(r.data->>'city','') || ')' AS what
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
    -- safety: never remove a shop that has any real (non-demo) order or bill
    AND NOT EXISTS (
      SELECT 1 FROM app_records x
      WHERE x.store IN ('fmcg_orders','fmcg_invoices','fmcg_payments') AND NOT x.deleted
        AND x.data->>'retailer_id' = r.id
        AND NOT EXISTS (SELECT 1 FROM doc_targets t WHERE t.store = x.store AND t.id = x.id AND t.business_id = x.business_id)
    )
),
demo_godowns AS (
  SELECT g.business_id, g.store, g.id, 'Demo godown: ' || (g.data->>'name') AS what
  FROM app_records g
  WHERE g.store = 'fmcg_godowns' AND NOT g.deleted
    AND g.data->>'name' IN ('Godown A (Central Hub)','Godown B (Express Bay)')
    -- safety: only if it holds no stock
    AND NOT EXISTS (SELECT 1 FROM app_records i WHERE i.store = 'fmcg_inventory' AND NOT i.deleted
                    AND i.data->>'godown_id' = g.id
                    AND coalesce(nullif(i.data->>'physical_qty',''),'0')::numeric > 0)
    AND NOT EXISTS (SELECT 1 FROM app_records b WHERE b.store = 'fmcg_batches' AND NOT b.deleted
                    AND b.data->>'godown_id' = g.id
                    AND coalesce(nullif(b.data->>'quantity',''),'0')::numeric > 0)
)
SELECT '1. WILL BE REMOVED' AS section, what AS item, store, id
FROM (SELECT * FROM doc_targets UNION ALL SELECT * FROM demo_retailers UNION ALL SELECT * FROM demo_godowns) all_t

UNION ALL
SELECT '2. LOGIN WILL BE REMOVED', 'User: ' || name || ' (' || role || ', ' || mobile || ')', 'profiles', id
FROM profiles
WHERE id = 'p-demo-salesman'
   OR retailer_id IN (SELECT id FROM demo_retailers)

UNION ALL
SELECT '3. ADD THIS STOCK BACK AFTER CLEANUP (Inventory -> Adjust)',
       coalesce(it->>'product_name', it->>'product_id') || ' : ' ||
       coalesce(it->>'base_qty', it->>'quantity', '?') || ' pcs  (sold on ' || (a.data->>'invoice_number') || ')',
       'fmcg_invoices', a.id
FROM app_records a
JOIN demo_invoices d ON d.store = a.store AND d.id = a.id AND d.business_id = a.business_id
CROSS JOIN LATERAL jsonb_array_elements(coalesce(a.data->'items','[]'::jsonb)) it

UNION ALL
SELECT '4. GODOWNS (for your information — only the two demo ones above are removed)',
       coalesce(data->>'code','') || ' | ' || coalesce(data->>'name','') || ' | ' || coalesce(data->>'city','') ||
       CASE WHEN (data->>'is_default') = 'true' THEN ' | DEFAULT' ELSE '' END,
       store, id
FROM app_records
WHERE store = 'fmcg_godowns' AND NOT deleted

ORDER BY 1, 2;
