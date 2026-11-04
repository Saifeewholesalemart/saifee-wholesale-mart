-- =====================================================================
-- 016_fix_duplicate_retailer_codes.sql
-- Two shops have the same retailer code (Jain Kirana and Anmol Saree Center
-- both show RET-00125). This gives every duplicate a new, unused code.
--
-- The shop that was created FIRST keeps its code; the later one(s) get the
-- next free number (for example RET-00126). Nothing else about the shop changes
-- (name, mobile, balance, orders, login all stay the same).
--
-- Runs in one transaction and saves a copy in cleanup_backup_20261104 first.
-- Supabase -> staging project -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cleanup_backup_20261104 AS
SELECT clock_timestamp() AS backed_up_at, a.* FROM app_records a WHERE false;

DROP TABLE IF EXISTS pg_temp.code_fix;
CREATE TEMP TABLE code_fix AS
WITH shops AS (
  SELECT business_id, id,
         data->>'shop_name' AS shop_name,
         upper(trim(data->>'retailer_code')) AS code,
         created_at AS made_at
  FROM app_records
  WHERE store = 'fmcg_retailers' AND NOT deleted
    AND coalesce(trim(data->>'retailer_code'), '') <> ''
),
ranked AS (
  SELECT s.*, row_number() OVER (PARTITION BY business_id, code ORDER BY made_at, id) AS rn
  FROM shops s
),
max_num AS (
  SELECT business_id,
         greatest(124, max(coalesce(nullif(substring(code FROM 'RET-0*([0-9]+)'), '')::int, 0))) AS mx
  FROM shops GROUP BY business_id
),
dups AS (
  SELECT r.*, row_number() OVER (PARTITION BY r.business_id ORDER BY r.made_at, r.id) AS k
  FROM ranked r WHERE r.rn > 1
)
SELECT d.business_id, d.id, d.shop_name, d.code AS old_code,
       'RET-' || lpad((m.mx + d.k)::text, 5, '0') AS new_code
FROM dups d JOIN max_num m USING (business_id);

INSERT INTO cleanup_backup_20261104
SELECT clock_timestamp(), a.*
FROM app_records a JOIN code_fix f
  ON a.store = 'fmcg_retailers' AND a.business_id = f.business_id AND a.id = f.id;

UPDATE app_records a
SET data = jsonb_set(jsonb_set(a.data, '{retailer_code}', to_jsonb(f.new_code)), '{updated_at}',
                     to_jsonb(to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    updated_at = clock_timestamp(), updated_by = 'fix-duplicate-retailer-code'
FROM code_fix f
WHERE a.store = 'fmcg_retailers' AND a.business_id = f.business_id AND a.id = f.id;

-- Old normalized retailers table (keep it in step)
DO $$
BEGIN
  UPDATE retailers r SET retailer_code = f.new_code, updated_at = now()
  FROM code_fix f WHERE r.id = f.id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'old retailers table: skipped (%)', SQLERRM;
END $$;

COMMIT;

SELECT shop_name, old_code, new_code FROM code_fix ORDER BY new_code;
