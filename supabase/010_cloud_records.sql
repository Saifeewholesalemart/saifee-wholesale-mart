-- =====================================================================
-- 010_cloud_records.sql
-- Saifee Wholesale Mart: CLOUD-ONLY STORAGE (har change seedha cloud me)
--
-- Kya karta hai:
--   Ek naya table "app_records" banata hai. App ka har record (order,
--   invoice, purchase, payment, stock, return, cash-flow, audit, etc.)
--   isme poora ka poora save hota hai, turant, har change ke saath.
--
-- Safe hai:
--   * Koi purana table ya data delete/badla NAHI jaata.
--   * Dobara chalane par bhi kuch nahi bigadta (IF NOT EXISTS).
--
-- Kaise chalana hai:
--   Supabase Dashboard -> staging project -> SQL Editor -> New query
--   -> ye poori file paste karein -> Run.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS app_records (
    business_id TEXT        NOT NULL,             -- kis company ka record hai (e.g. 'biz-saifee')
    store       TEXT        NOT NULL,             -- record ka type (e.g. 'fmcg_orders')
    id          TEXT        NOT NULL,             -- record ki ID
    data        JSONB,                            -- poora record (jaisa app me hai)
    deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_by  TEXT,                             -- kis user ne last change kiya
    created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (business_id, store, id)
);

-- Doosre devices ke naye changes jaldi dhundhne ke liye
CREATE INDEX IF NOT EXISTS idx_app_records_biz_updated
    ON app_records (business_id, updated_at, store, id);

CREATE INDEX IF NOT EXISTS idx_app_records_store
    ON app_records (store);

-- Security: browser ki public (anon) key se ye table bilkul nahi khulega.
-- Sirf app ka server (database password se) ise padh/likh sakta hai.
ALTER TABLE app_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_records FROM anon;
REVOKE ALL ON app_records FROM authenticated;

COMMIT;

-- Check: neeche wali query chalane par "app_records_ready = true" aana chahiye
SELECT to_regclass('public.app_records') IS NOT NULL AS app_records_ready;
