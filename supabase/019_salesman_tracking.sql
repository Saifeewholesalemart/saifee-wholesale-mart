-- =====================================================================
-- 019_salesman_tracking.sql
-- Salesman location tracking (duty time only).
-- Creates one table: salesman_locations. Nothing else is changed.
-- Safe to run again (IF NOT EXISTS).
-- Supabase -> staging project -> SQL Editor -> New query -> paste -> Run
-- (if asked, choose "Run and enable RLS").
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS salesman_locations (
    id           BIGSERIAL PRIMARY KEY,
    business_id  TEXT        NOT NULL,
    user_id      TEXT        NOT NULL,          -- salesman profile id
    kind         TEXT        NOT NULL,          -- ping | duty_start | duty_end | order | consent
    lat          DOUBLE PRECISION,
    lng          DOUBLE PRECISION,
    accuracy_m   REAL,
    battery_pct  SMALLINT,
    ref_id       TEXT,                          -- order id for kind = 'order'
    ref_label    TEXT,                          -- e.g. order number + shop name
    recorded_at  TIMESTAMPTZ NOT NULL,          -- time on the phone
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salesman_locations_user_time
    ON salesman_locations (business_id, user_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_salesman_locations_biz_time
    ON salesman_locations (business_id, recorded_at);

-- Only the app server (database password) can read/write. Browser keys cannot.
ALTER TABLE salesman_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON salesman_locations FROM anon;
REVOKE ALL ON salesman_locations FROM authenticated;

COMMIT;

SELECT to_regclass('public.salesman_locations') IS NOT NULL AS tracking_table_ready;
