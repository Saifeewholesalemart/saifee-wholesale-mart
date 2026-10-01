-- =====================================================================
-- Migration 005: Multi-Company / Multi-Business Tenant Architecture
-- Saifee General Stores FMCG Distribution Management System
-- =====================================================================

-- 1. Create Business Companies (Tenants) Table
CREATE TABLE IF NOT EXISTS business_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE, -- e.g. 'SGS', 'STA'
    name TEXT NOT NULL, -- e.g. 'Saifee General Stores'
    business_type TEXT NOT NULL DEFAULT 'FMCG Distribution',
    logo_url TEXT,
    gstin TEXT,
    address TEXT,
    city TEXT,
    state TEXT DEFAULT 'Maharashtra',
    pincode TEXT,
    phone TEXT,
    email TEXT,
    invoice_prefix TEXT DEFAULT 'INV',
    order_prefix TEXT DEFAULT 'ORD',
    customer_term TEXT DEFAULT 'Retailer', -- 'Retailer', 'Customer', 'Dealer', 'Client'
    settings JSONB DEFAULT '{}'::jsonb,
    modules JSONB DEFAULT '["products", "categories", "customers", "salespersons", "orders", "inventory", "batches", "billing", "delivery_challans", "ledger", "reports", "returns", "vyapar_import"]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Company Memberships Table
CREATE TABLE IF NOT EXISTS company_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES business_companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'salesperson', 'manager', 'accountant', 'retailer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);

-- 3. Seed Primary FMCG Business: Saifee General Stores
INSERT INTO business_companies (id, code, name, business_type, gstin, address, city, state, pincode, phone, email, invoice_prefix, order_prefix, customer_term, status)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'SGS',
    'Saifee General Stores',
    'FMCG Distribution',
    '27AABCS1429B1ZB',
    'Shop 12-14, Wholesale Market, Crawford Market',
    'Mumbai',
    'Maharashtra',
    '400001',
    '9820011223',
    'admin@saifee.com',
    'INV-SGS',
    'SGS',
    'Retailer',
    'active'
) ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    business_type = EXCLUDED.business_type,
    updated_at = CURRENT_TIMESTAMP;

-- Seed Sample Second Business
INSERT INTO business_companies (id, code, name, business_type, gstin, address, city, state, pincode, phone, email, invoice_prefix, order_prefix, customer_term, status)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'STA',
    'Saifee Trading & Agro Corp',
    'Wholesale & Trading',
    '27XYZAB9876C1Z0',
    'Plot 45, APMC Market Yard, Vashi',
    'Navi Mumbai',
    'Maharashtra',
    '400703',
    '9819954321',
    'agro@saifee.com',
    'INV-STA',
    'STA',
    'Customer',
    'active'
) ON CONFLICT (code) DO NOTHING;

-- 4. Add company_id Column to Company-Owned Tables with Safe Backfill to Saifee General Stores

-- Products Table
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE products SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_business_company ON products(business_company_id);

-- Retailers / Customers Table
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE retailers SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_retailers_business_company ON retailers(business_company_id);

-- Categories Table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE categories SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_business_company ON categories(business_company_id);

-- Inventory Table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE inventory SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_business_company ON inventory(business_company_id);

-- Inventory Batches Table
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE inventory_batches SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_batches_business_company ON inventory_batches(business_company_id);

-- Stock Ledger Table
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE stock_ledger SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_ledger_business_company ON stock_ledger(business_company_id);

-- Orders Table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE orders SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_business_company ON orders(business_company_id);

-- Fulfilments Table
ALTER TABLE fulfilments ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE fulfilments SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fulfilments_business_company ON fulfilments(business_company_id);

-- Invoices Table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE invoices SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_business_company ON invoices(business_company_id);

-- Purchases Table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE purchases SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_business_company ON purchases(business_company_id);

-- Payments Table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE payments SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_business_company ON payments(business_company_id);

-- Sales Returns Table
ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS business_company_id UUID REFERENCES business_companies(id);
UPDATE sales_returns SET business_company_id = 'c0000000-0000-0000-0000-000000000001' WHERE business_company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_returns_business_company ON sales_returns(business_company_id);

-- 5. Helper Function for Row Level Security (RLS)
CREATE OR REPLACE FUNCTION is_member_of_company(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members cm
        JOIN profiles p ON p.id = cm.user_id
        WHERE cm.company_id = p_company_id
          AND cm.status = 'active'
          AND (p.id = auth.uid() OR p.email = current_user)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable Row Level Security (RLS) on Company-Owned Tables
ALTER TABLE business_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies

-- Company Members Policy
CREATE POLICY "Users can view their company memberships" ON company_members
    FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Products Policy
CREATE POLICY "Users can access products of their active company" ON products
    FOR ALL USING (is_member_of_company(business_company_id));

-- Retailers Policy
CREATE POLICY "Users can access retailers of their active company" ON retailers
    FOR ALL USING (is_member_of_company(business_company_id));

-- Orders Policy
CREATE POLICY "Users can access orders of their active company" ON orders
    FOR ALL USING (is_member_of_company(business_company_id));

-- Invoices Policy
CREATE POLICY "Users can access invoices of their active company" ON invoices
    FOR ALL USING (is_member_of_company(business_company_id));

-- Inventory Policy
CREATE POLICY "Users can access inventory of their active company" ON inventory
    FOR ALL USING (is_member_of_company(business_company_id));

-- Payments Policy
CREATE POLICY "Users can access payments of their active company" ON payments
    FOR ALL USING (is_member_of_company(business_company_id));
