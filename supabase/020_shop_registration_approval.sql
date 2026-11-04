-- =====================================================================
-- 020_shop_registration_approval.sql
-- Shop self-registration + admin approval.
-- Adds 3 columns to profiles. Existing profiles stay exactly as they are
-- (they are marked 'approved'). Safe to run again.
-- Supabase -> staging project -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registered_by   TEXT;   -- 'self' or the salesman's profile id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_approval_pending
    ON profiles (business_id, approval_status) WHERE approval_status <> 'approved';

COMMIT;

SELECT count(*) FILTER (WHERE approval_status = 'approved') AS approved_profiles,
       count(*) FILTER (WHERE approval_status = 'pending')  AS pending_profiles
FROM profiles;
