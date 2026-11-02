-- =====================================================================
-- 011_company_location_khachrod.sql
-- Saifee Wholesale Mart ka asli pata: Khachrod, Dist. Ujjain (M.P.)
-- Cloud ki company aur godowns me city/state theek karta hai.
-- Supabase -> staging project -> SQL Editor -> paste -> Run
-- =====================================================================

UPDATE business_companies
   SET address = 'Khachrod, Dist. Ujjain',
       city = 'Khachrod',
       state = 'Madhya Pradesh',
       state_code = '23',
       updated_at = CURRENT_TIMESTAMP
 WHERE id = 'biz-saifee';

UPDATE godowns
   SET city = 'Khachrod',
       state = 'Madhya Pradesh',
       updated_at = CURRENT_TIMESTAMP
 WHERE business_id = 'biz-saifee'
   AND (city IS NULL OR city IN ('', 'Indore', 'Mumbai', 'Navi Mumbai'));

-- Check: neeche Khachrod / Madhya Pradesh / 23 dikhna chahiye
SELECT id, name, address, city, state, state_code FROM business_companies WHERE id = 'biz-saifee';
SELECT id, name, city, state FROM godowns WHERE business_id = 'biz-saifee';
