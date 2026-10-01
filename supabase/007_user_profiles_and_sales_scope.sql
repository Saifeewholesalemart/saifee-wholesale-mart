-- =====================================================================
-- Migration 007: User Profile Management & Salesperson Scopes
-- Saifee General Stores FMCG Wholesale Distribution & Trade ERP
-- =====================================================================

-- 1. Enhance `profiles` Table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS assigned_company_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS assigned_category_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS category_access_mode TEXT DEFAULT 'all' CHECK (category_access_mode IN ('all', 'custom')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Enhance `retailers` Table for Authentication & Scope
ALTER TABLE retailers 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS category_access_mode TEXT DEFAULT 'all' CHECK (category_access_mode IN ('all', 'custom')),
ADD COLUMN IF NOT EXISTS assigned_category_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Create Index on Mobile & Roles for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON profiles(mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_retailers_mobile ON retailers(mobile);

-- 4. Create View for Salesperson Scopes
CREATE OR REPLACE VIEW v_salesperson_profiles AS
SELECT 
    p.id,
    p.email,
    p.name,
    p.mobile,
    p.role,
    CASE 
        WHEN p.role = 'sales_dist' THEN 'Distributor Salesperson'
        WHEN p.role = 'sales_co' THEN 'Company Salesperson'
        ELSE p.role
    END AS role_display,
    CASE 
        WHEN p.role = 'sales_dist' THEN 'CH_DIST_SALES'
        WHEN p.role = 'sales_co' THEN 'CH_CO_SALES'
        ELSE 'OTHER'
    END AS channel_code,
    p.company_id,
    p.assigned_company_ids,
    p.assigned_category_ids,
    p.category_access_mode,
    p.active,
    p.created_at,
    p.updated_at
FROM profiles p
WHERE p.role IN ('sales_dist', 'sales_co');

-- 5. Create View for Retailer User Profiles
CREATE OR REPLACE VIEW v_retailer_profiles AS
SELECT 
    p.id AS profile_id,
    r.id AS retailer_id,
    r.retailer_code,
    r.shop_name,
    r.owner_name,
    r.mobile,
    r.address,
    r.city,
    r.state_code,
    r.gstin,
    r.credit_limit,
    r.outstanding,
    r.active AS retailer_active,
    p.active AS profile_active,
    p.email,
    r.created_at
FROM retailers r
LEFT JOIN profiles p ON p.retailer_id = r.id;

-- 6. Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_retailers_updated_at ON retailers;
CREATE TRIGGER trg_retailers_updated_at
BEFORE UPDATE ON retailers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();
