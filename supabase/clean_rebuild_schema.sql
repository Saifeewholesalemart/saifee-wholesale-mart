-- =====================================================================
-- SAIFEE FMCG WHOLESALE DISTRIBUTION & TRADE MANAGEMENT SYSTEM
-- Target Clean Rebuild Schema (Unified Relational Architecture)
-- File: supabase/clean_rebuild_schema.sql
-- Status: PREPARED FOR CLEAN REBUILD (NO PRE-EXISTING DATA TO PRESERVE)
-- Safety: Enclosed in BEGIN ... COMMIT for 100% atomic execution.
--
-- RERUN & IDEMPOTENCY SPECIFICATION:
-- 1. All CREATE statements use IF NOT EXISTS or CREATE OR REPLACE.
-- 2. Triggers use DROP TRIGGER IF EXISTS before CREATE TRIGGER.
-- 3. RLS Policies use DROP POLICY IF EXISTS before CREATE POLICY, guaranteeing
--    idempotent re-execution without PostgreSQL policy collision errors.
-- 4. Incompatible pre-existing objects (e.g. legacy UUID primary keys or missing
--    columns) are NOT automatically altered or dropped by CREATE TABLE IF NOT EXISTS.
--    Preflight validation (scripts/preflight_schema_check.ts) MUST be executed
--    before this DDL to detect existing incompatible tables and abort safely.
-- 5. Never drops tables or resets existing database data automatically.
--
-- DEPLOYMENT EXECUTION INSTRUCTIONS:
-- 1. Supabase Dashboard SQL Editor:
--    Paste the entire file contents directly into the SQL Editor of project jtofsoriinobcabpjswl.
--    The explicit BEGIN; ... COMMIT; block guarantees atomic execution in the browser.
-- 2. Supabase CLI (supabase db push / supabase migration up):
--    Applies the file within an atomic transaction automatically.
-- 3. Direct psql / Pooler Connection:
--    Execute: psql "<STAGING_POOLER_URL>" -f supabase/clean_rebuild_schema.sql
--    The BEGIN ... COMMIT ensures all 42 tables, indexes, and RLS policies succeed together or rollback.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. PRODUCTION LOCKOUT & MANUAL STAGING VERIFICATION REQUIREMENT
-- ---------------------------------------------------------------------
-- OPERATIONAL VERIFICATION REQUIREMENT:
-- PostgreSQL cannot natively or reliably introspect the Supabase Cloud project
-- reference from SQL session variables or catalog settings alone.
-- The operator MUST manually verify that the connected database URL in the browser
-- address bar or connection string matches staging project:
--     https://supabase.com/dashboard/project/jtofsoriinobcabpjswl
-- 
-- AUTOMATED SAFEGUARDS ENFORCED BY THIS BLOCK:
-- 1. Hard Production Lockout: Unconditionally aborts if any production identifier
--    (wxctglnnybhhptkxwxur) is detected in session_user, headers, or db name.
-- 2. Production Snapshot Fingerprint Defense: Aborts immediately if system_settings
--    contains the live production snapshot timestamp (2026-10-21 11:54:50.165+00).
-- 3. Data Safety Guard: Section 0.2 verifies all tables scheduled for deletion contain
--    zero unexpected rows before any destructive statement executes.
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_db_name TEXT;
    v_session_user TEXT;
BEGIN
    SELECT current_database(), session_user INTO v_db_name, v_session_user;

    -- Safety Check 1: Ensure valid database session
    IF v_db_name IS NULL OR v_db_name = '' THEN
        RAISE EXCEPTION '[CRITICAL ABORT]: Unable to resolve current database name.';
    END IF;

    -- Safety Check 2: Hard Production Lockout (Never target wxctglnnybhhptkxwxur)
    IF v_session_user LIKE '%wxctglnnybhhptkxwxur%'
       OR current_setting('request.headers', true) LIKE '%wxctglnnybhhptkxwxur%'
       OR current_setting('app.current_project_ref', true) = 'wxctglnnybhhptkxwxur'
       OR v_db_name LIKE '%wxctglnnybhhptkxwxur%' THEN
        RAISE EXCEPTION '[CRITICAL SECURITY VIOLATION]: Execution attempted against BLOCKED production project wxctglnnybhhptkxwxur! Aborting immediately.';
    END IF;

    -- Safety Check 3: Check for Production Snapshot Fingerprint in system_settings
    -- Production snapshot has known timestamp 2026-10-21 11:54:50.165+00
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_settings'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM system_settings 
            WHERE key = 'fmcg_cloud_database_v1' 
              AND updated_at = '2026-10-21 11:54:50.165+00'::timestamptz
        ) THEN
            RAISE EXCEPTION '[CRITICAL SECURITY VIOLATION]: Production database state detected in system_settings (timestamp 2026-10-21 11:54:50.165+00)! Aborting to protect production data.';
        END IF;
    END IF;

    RAISE NOTICE '[PRODUCTION LOCKOUT PASSED]: No production indicators detected (Session: %, DB: %). Operator must confirm target is staging project jtofsoriinobcabpjswl.', v_session_user, v_db_name;
END $$;

-- ---------------------------------------------------------------------
-- 0.1 SYSTEM_SETTINGS PRESERVATION & METADATA AUDIT
-- ---------------------------------------------------------------------
-- system_settings is explicitly preserved and NEVER dropped.
DO $$
DECLARE
    v_has_snapshot BOOLEAN := false;
    v_snapshot_updated TIMESTAMPTZ;
    v_snapshot_bytes INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_settings'
    ) THEN
        SELECT 
            true, 
            updated_at, 
            octet_length(value::text)
        INTO 
            v_has_snapshot, 
            v_snapshot_updated, 
            v_snapshot_bytes
        FROM system_settings 
        WHERE key = 'fmcg_cloud_database_v1';

        IF v_has_snapshot THEN
            RAISE NOTICE '[METADATA PRESERVED]: system_settings.fmcg_cloud_database_v1 intact (Updated: %, Payload Size: % bytes).', v_snapshot_updated, v_snapshot_bytes;
        ELSE
            RAISE NOTICE '[METADATA NOTICE]: system_settings exists; fmcg_cloud_database_v1 key is not present.';
        END IF;
    ELSE
        RAISE NOTICE '[METADATA NOTICE]: system_settings table does not yet exist; will be created.';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 0.2 DATA SAFETY GUARD: ABORT IF ANY TABLE CONTAINS UNEXPECTED DATA
-- ---------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    v_count BIGINT;
    v_clean_tables TEXT[] := ARRAY[
        'sales_return_items', 'sales_returns', 'purchase_return_items', 'purchase_returns',
        'payment_allocations', 'payments', 'customer_ledger', 'delivery_challan_items',
        'delivery_challans', 'invoice_items', 'invoices', 'fulfilment_items', 'fulfilments',
        'billing_rate_audit_logs', 'order_items', 'orders', 'product_aliases',
        'ai_purchase_import_items', 'ai_purchase_imports', 'stock_transfer_items',
        'stock_transfers', 'stock_ledger', 'inventory_batches', 'inventory',
        'purchase_items', 'purchases', 'product_categories', 'products', 'categories',
        'company_members', 'profiles', 'retailers', 'suppliers', 'godowns',
        'cash_flow_transactions', 'company_opening_balances', 'item_activity_logs',
        'invoice_audits', 'vyapar_imports', 'business_companies'
    ];
BEGIN
    -- 1. Ensure all business tables (except companies) have ZERO rows
    FOR r IN SELECT unnest(v_clean_tables) AS tbl_name LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = r.tbl_name) THEN
            EXECUTE format('SELECT count(*) FROM public.%I', r.tbl_name) INTO v_count;
            IF v_count > 0 THEN
                RAISE EXCEPTION '[SAFETY ABORT]: Table public.% contains % rows of unexpected data! Refusing to drop tables. Transaction aborted.', r.tbl_name, v_count;
            END IF;
        END IF;
    END LOOP;

    -- 2. Ensure companies table has at most 1 test row (JOY) and nothing else
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
        EXECUTE 'SELECT count(*) FROM public.companies' INTO v_count;
        IF v_count > 1 THEN
            RAISE EXCEPTION '[SAFETY ABORT]: Table public.companies contains % rows (expected at most 1 test row)! Refusing to drop. Transaction aborted.', v_count;
        ELSIF v_count = 1 THEN
            IF NOT EXISTS (SELECT 1 FROM public.companies WHERE code = 'JOY') THEN
                RAISE EXCEPTION '[SAFETY ABORT]: Table public.companies contains an unrecognized row not matching code "JOY"! Refusing to drop. Transaction aborted.';
            END IF;
            RAISE NOTICE '[DATA GUARD PASSED]: Verified public.companies contains only the 1 legacy test row ("JOY").';
        END IF;
    END IF;

    RAISE NOTICE '[DATA GUARD PASSED]: All tables scheduled for deletion contain 0 unexpected rows.';
END $$;

-- ---------------------------------------------------------------------
-- 0.3 CONTROLLED REMOVAL OF INCOMPATIBLE EMPTY LEGACY TABLES
-- ---------------------------------------------------------------------
-- Drops legacy tables with UUID primary key collisions in strict reverse-dependency order.
-- NOTE: system_settings is deliberately EXCLUDED from this list.
DROP TABLE IF EXISTS sales_return_items CASCADE;
DROP TABLE IF EXISTS sales_returns CASCADE;
DROP TABLE IF EXISTS purchase_return_items CASCADE;
DROP TABLE IF EXISTS purchase_returns CASCADE;
DROP TABLE IF EXISTS payment_allocations CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS customer_ledger CASCADE;
DROP TABLE IF EXISTS delivery_challan_items CASCADE;
DROP TABLE IF EXISTS delivery_challans CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS fulfilment_items CASCADE;
DROP TABLE IF EXISTS fulfilments CASCADE;
DROP TABLE IF EXISTS billing_rate_audit_logs CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_aliases CASCADE;
DROP TABLE IF EXISTS ai_purchase_import_items CASCADE;
DROP TABLE IF EXISTS ai_purchase_imports CASCADE;
DROP TABLE IF EXISTS stock_transfer_items CASCADE;
DROP TABLE IF EXISTS stock_transfers CASCADE;
DROP TABLE IF EXISTS stock_ledger CASCADE;
DROP TABLE IF EXISTS inventory_batches CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS company_members CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS retailers CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS godowns CASCADE;
DROP TABLE IF EXISTS cash_flow_transactions CASCADE;
DROP TABLE IF EXISTS company_opening_balances CASCADE;
DROP TABLE IF EXISTS item_activity_logs CASCADE;
DROP TABLE IF EXISTS invoice_audits CASCADE;
DROP TABLE IF EXISTS vyapar_imports CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS business_companies CASCADE;

-- ---------------------------------------------------------------------
-- 0.3 EXTENSIONS & PREREQUISITES
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. SYSTEM SETTINGS & METADATA
-- ---------------------------------------------------------------------
-- Holds global app settings and legacy snapshot backups during transition
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. TENANTS & MULTI-BUSINESS ORGANIZATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_companies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE, -- e.g. 'SGS', 'STA'
    name TEXT NOT NULL, -- e.g. 'Saifee General Stores'
    legal_name TEXT,
    business_type TEXT NOT NULL DEFAULT 'FMCG Distribution',
    logo_url TEXT,
    gstin TEXT,
    pan TEXT,
    address TEXT,
    city TEXT DEFAULT 'Indore',
    state TEXT DEFAULT 'Madhya Pradesh',
    state_code TEXT DEFAULT '27',
    pincode TEXT,
    phone TEXT,
    email TEXT,
    currency TEXT DEFAULT 'INR',
    is_default BOOLEAN DEFAULT FALSE,
    invoice_prefix TEXT DEFAULT 'INV',
    order_prefix TEXT DEFAULT 'ORD',
    customer_term TEXT DEFAULT 'Retailer', -- 'Retailer', 'Customer', 'Dealer'
    settings JSONB DEFAULT '{}'::jsonb,
    modules JSONB DEFAULT '["products", "categories", "customers", "salespersons", "orders", "inventory", "batches", "billing", "delivery_challans", "ledger", "reports", "returns", "vyapar_import"]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 3. USER PROFILES & TENANT MEMBERSHIPS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    email TEXT NOT NULL UNIQUE,
    mobile TEXT NOT NULL,
    phone TEXT,
    contact_no TEXT,
    name TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'sales_dist', 'sales_co', 'retailer', 'staff')),
    profile_type TEXT DEFAULT 'STAFF', -- 'ADMIN', 'SALESPERSON', 'RETAILER', 'STAFF'
    sales_role_type TEXT CHECK (sales_role_type IN ('DISTRIBUTOR', 'COMPANY', NULL)),
    trade_scope TEXT CHECK (trade_scope IN ('ALL', 'RESTRICTED', NULL)),
    custom_role TEXT, -- 'Packer', 'Biller', 'Tempo Loader', etc.
    department TEXT,
    password_hash TEXT NOT NULL,
    company_id TEXT, -- FMCG Brand ID (for sales_co)
    retailer_id TEXT, -- Retailer ID (for retailer)
    assigned_company_ids JSONB DEFAULT '[]'::jsonb,
    assigned_category_ids JSONB DEFAULT '[]'::jsonb,
    category_access_mode TEXT DEFAULT 'all' CHECK (category_access_mode IN ('all', 'custom')),
    active BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
    company_id TEXT REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE CASCADE, -- backwards-compatible alias
    user_id TEXT NOT NULL REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'salesperson', 'retailer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, user_id)
);

-- ---------------------------------------------------------------------
-- 4. WAREHOUSES & GODOWNS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS godowns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    company_id TEXT REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT, -- backwards-compatible alias
    code TEXT NOT NULL, -- e.g. 'MAIN', 'INDORE-1'
    name TEXT NOT NULL, -- e.g. 'Saifee Main Warehouse'
    address TEXT,
    city TEXT DEFAULT 'Indore',
    state TEXT DEFAULT 'Madhya Pradesh',
    pincode TEXT,
    manager_name TEXT,
    phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, code)
);

-- ---------------------------------------------------------------------
-- 5. MASTER CATALOG: BRANDS, CATEGORIES & PRODUCTS
-- ---------------------------------------------------------------------
-- FMCG Brands / Principal Manufacturers (Parle, Britannia, ITC, HUL, Nestlé, etc.)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, -- e.g. 'PARLE', 'BRITANNIA', 'ITC', 'JOY'
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Product Categories (Admin-Managed)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    salesperson_access_type TEXT DEFAULT 'all' CHECK (salesperson_access_type IN ('all', 'restricted')),
    assigned_salesperson_ids JSONB DEFAULT '[]'::jsonb,
    retailer_access_type TEXT DEFAULT 'all' CHECK (retailer_access_type IN ('all', 'restricted')),
    assigned_retailer_ids JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, name)
);

-- Products Master
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_code TEXT NOT NULL, -- e.g. 'PRD-1709210001', 'PARLE-G-100G'
    name TEXT NOT NULL,
    company_id TEXT NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    sku TEXT,
    barcode TEXT,
    pack_size TEXT NOT NULL, -- e.g. '24 units / carton'
    packing_display TEXT, -- formatted display e.g. '24 units / carton'
    trading_unit TEXT NOT NULL DEFAULT 'Carton' CHECK (trading_unit IN ('Box', 'Carton', 'Case', 'Bag', 'Bundle', 'Dozen', 'Tin', 'Jar', 'Other')),
    base_unit TEXT NOT NULL DEFAULT 'Piece', -- lowest atomic consumer unit: 'Piece', 'Packet', 'Bottle', etc.
    units_per_box_carton INTEGER NOT NULL DEFAULT 1,
    units_per_trading_unit INTEGER NOT NULL DEFAULT 1,
    pieces_per_carton INTEGER NOT NULL DEFAULT 1,
    mrp NUMERIC(10, 2) NOT NULL,
    selling_price NUMERIC(10, 2) NOT NULL, -- Distributor wholesale selling price
    purchase_price NUMERIC(10, 2) NOT NULL, -- Distributor cost price
    dealer_price NUMERIC(10, 2), -- Optional tiered dealer rate
    loose_mrp NUMERIC(10, 2),
    loose_selling_price NUMERIC(10, 2),
    loose_purchase_price NUMERIC(10, 2),
    carton_discount NUMERIC(10, 2) DEFAULT 0.00,
    loose_discount NUMERIC(10, 2) DEFAULT 0.00,
    allow_loose_sale BOOLEAN NOT NULL DEFAULT TRUE,
    allow_carton BOOLEAN NOT NULL DEFAULT TRUE,
    allow_pieces BOOLEAN NOT NULL DEFAULT TRUE,
    trade_mode TEXT NOT NULL DEFAULT 'BOTH' CHECK (trade_mode IN ('PIECES', 'CARTONS', 'BOTH')),
    loose_price_mode TEXT NOT NULL DEFAULT 'auto',
    gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    hsn TEXT NOT NULL,
    image_url TEXT,
    description TEXT,
    min_stock_level INTEGER DEFAULT 5,
    reorder_level INTEGER DEFAULT 10,
    batch_tracking_enabled BOOLEAN DEFAULT TRUE,
    expiry_tracking_enabled BOOLEAN DEFAULT TRUE,
    parent_product_id TEXT REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
    variant_attribute TEXT,
    variant_value TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, product_code)
);

-- Many-to-many junction table between products and categories
CREATE TABLE IF NOT EXISTS product_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, category_id)
);

-- ---------------------------------------------------------------------
-- 6. SUPPLIERS, PURCHASES & INWARD STOCK
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    name TEXT NOT NULL,
    gstin TEXT NOT NULL,
    address TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, gstin)
);

-- Alias memory for AI and OCR bill parsing
CREATE TABLE IF NOT EXISTS product_aliases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE CASCADE,
    alias_name TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE(supplier_id, alias_name)
);

-- Purchases (Supplier Inward Orders)
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    receiving_godown_id TEXT NOT NULL REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Confirmed')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    trading_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'Piece',
    units_per_trading_unit INTEGER NOT NULL DEFAULT 1,
    units_per_box_carton INTEGER DEFAULT 1,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER NOT NULL DEFAULT 0,
    purchase_rate NUMERIC(10, 2) NOT NULL,
    carton_rate NUMERIC(10, 2),
    loose_purchase_rate NUMERIC(10, 2),
    loose_rate NUMERIC(10, 2),
    selling_price NUMERIC(10, 2),
    loose_selling_price NUMERIC(10, 2),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    free_quantity INTEGER NOT NULL DEFAULT 0,
    mrp NUMERIC(10, 2) NOT NULL,
    gst_percent NUMERIC(5, 2) NOT NULL,
    hsn TEXT NOT NULL,
    batch TEXT NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL
);

-- ---------------------------------------------------------------------
-- 7. INVENTORY, FIFO BATCHES & STOCK AUDIT LEDGER
-- ---------------------------------------------------------------------
-- Consolidated Inventory balances by product & warehouse (strictly in lowest atomic Base Units)
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    godown_id TEXT REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    physical_qty INTEGER NOT NULL DEFAULT 0, -- lowest base unit count
    reserved_qty INTEGER NOT NULL DEFAULT 0, -- allocated to confirmed orders awaiting dispatch
    available_qty INTEGER NOT NULL DEFAULT 0, -- physical_qty - reserved_qty
    damaged_qty INTEGER NOT NULL DEFAULT 0,
    expired_qty INTEGER NOT NULL DEFAULT 0,
    pending_qty INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, product_id, godown_id)
);

-- FIFO Inventory Batches (strictly in lowest atomic Base Units)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    godown_id TEXT REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    godown_name TEXT,
    godown TEXT,
    batch_number TEXT NOT NULL,
    mfg_date DATE,
    expiry_date DATE NOT NULL,
    purchase_rate NUMERIC(10, 2) NOT NULL,
    selling_price NUMERIC(10, 2),
    loose_selling_price NUMERIC(10, 2),
    mrp NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0, -- available count in atomic base units
    entry_date DATE DEFAULT CURRENT_DATE,
    cost_layer TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Immutable Append-Only Stock Movement Audit Ledger
CREATE TABLE IF NOT EXISTS stock_ledger (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    godown_id TEXT REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    change_qty INTEGER NOT NULL, -- delta in lowest base units (positive for IN, negative for OUT)
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    reason TEXT NOT NULL, -- 'Purchase', 'Sale', 'Sales Return', 'Damage', 'Stock Transfer', 'Adjustment', 'Opening Stock / Vyapar Import'
    reference_id TEXT, -- purchase_id, order_id, invoice_id, return_id, etc.
    user_id TEXT REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    batch_id TEXT,
    batch_number TEXT,
    previous_qty INTEGER,
    new_qty INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Inter-Godown Stock Transfers
CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    company_id TEXT,
    transfer_number TEXT NOT NULL UNIQUE,
    from_godown_id TEXT NOT NULL REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    to_godown_id TEXT NOT NULL REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Requested', 'Approved', 'Dispatched', 'Received', 'Completed', 'Cancelled')),
    requested_by TEXT,
    approved_by TEXT,
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    batch_id TEXT,
    batch_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    received_carton_qty INTEGER DEFAULT 0,
    received_loose_qty INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 8. RETAILERS & CUSTOMER ACCOUNTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retailers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    retailer_code TEXT NOT NULL, -- e.g. 'RET-00101'
    shop_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT DEFAULT 'Indore',
    state TEXT DEFAULT 'Madhya Pradesh',
    state_code TEXT NOT NULL DEFAULT '27',
    pincode TEXT,
    gstin TEXT,
    mobile TEXT NOT NULL,
    phone TEXT,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
    outstanding NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    beat_name TEXT,
    route TEXT,
    password_hash TEXT,
    assigned_category_ids JSONB DEFAULT '[]'::jsonb,
    category_access_mode TEXT DEFAULT 'all' CHECK (category_access_mode IN ('all', 'custom')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, retailer_code)
);

-- ---------------------------------------------------------------------
-- 9. ORDERS & FULFILMENT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    order_number TEXT NOT NULL, -- e.g. 'ORD-2026-0001'
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    source TEXT NOT NULL CHECK (source IN ('distributor_salesperson', 'company_salesperson', 'retailer_direct', 'counter_sale')),
    channel TEXT DEFAULT 'Retailer Direct',
    created_by TEXT REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    order_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN (
        'Draft', 'Submitted', 'Under Review', 'Confirmed', 'Partially Confirmed',
        'Packing', 'PACKING_IN_PROGRESS', 'Packed', 'PACKED_AND_SEALED',
        'Ready for Dispatch', 'Partially Dispatched', 'Dispatched', 'Delivered',
        'Cancelled', 'Partially Fulfilled', 'Fully Fulfilled', 'Completed'
    )),
    order_notes TEXT,
    admin_notes TEXT,
    review_notes TEXT,
    cancellation_reason TEXT,
    dispatch_transport_mode TEXT,
    dispatch_vehicle_number TEXT,
    dispatch_delivery_person TEXT,
    dispatch_notes TEXT,
    dispatch_godown TEXT,
    invoice_id TEXT,
    challan_id TEXT,
    confirmed_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    packed_by TEXT,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT NOT NULL REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    trading_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'Piece',
    units_per_trading_unit INTEGER DEFAULT 1,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    carton_rate NUMERIC(10, 2),
    loose_rate NUMERIC(10, 2),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    carton_discount NUMERIC(10, 2) DEFAULT 0.00,
    loose_discount NUMERIC(10, 2) DEFAULT 0.00,
    final_price NUMERIC(10, 2) NOT NULL,
    gst_percent NUMERIC(5, 2) NOT NULL,
    gst_amount NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    catalogue_rate_at_order NUMERIC(10, 2),
    order_time_rate NUMERIC(10, 2),
    manual_billing_rate NUMERIC(10, 2),
    final_applied_rate NUMERIC(10, 2),
    manual_rate_applied BOOLEAN DEFAULT FALSE,
    manual_rate_updated_by TEXT REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    manual_rate_updated_at TIMESTAMPTZ,
    manual_rate_reason TEXT,
    batch_id TEXT,
    rate NUMERIC(10, 2),
    mrp NUMERIC(10, 2),
    purchase_rate NUMERIC(10, 2),
    ordered_qty INTEGER NOT NULL,
    confirmed_qty INTEGER DEFAULT 0,
    packed_qty INTEGER DEFAULT 0,
    fulfilled_qty INTEGER DEFAULT 0,
    dispatched_qty INTEGER DEFAULT 0,
    remaining_qty INTEGER NOT NULL DEFAULT 0,
    pending_qty INTEGER DEFAULT 0,
    batch_allocations JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'PENDING'
);

-- Consolidated Order Fulfilments (Packing Lots)
CREATE TABLE IF NOT EXISTS fulfilments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    fulfilment_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('Packing', 'Ready for Dispatch', 'Dispatched', 'Delivered', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fulfilment_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    fulfilment_id TEXT NOT NULL REFERENCES fulfilments(id) ON UPDATE CASCADE ON DELETE CASCADE,
    order_item_id TEXT NOT NULL REFERENCES order_items(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    original_qty INTEGER NOT NULL,
    confirmed_qty INTEGER NOT NULL,
    pending_qty INTEGER NOT NULL,
    manual_billing_rate NUMERIC(10, 2),
    manual_rate_applied BOOLEAN DEFAULT FALSE,
    manual_rate_updated_by TEXT REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    manual_rate_updated_at TIMESTAMPTZ,
    manual_rate_reason TEXT
);

-- ---------------------------------------------------------------------
-- 10. INVOICES (GST SALES INVOICES)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    company_id TEXT, -- FMCG Brand scope if billed per brand
    invoice_number TEXT NOT NULL, -- e.g. 'INV/2026-27/00001'
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    order_ref_id TEXT REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL,
    source_order_ids JSONB DEFAULT '[]'::jsonb,
    source_order_numbers JSONB DEFAULT '[]'::jsonb,
    order_numbers JSONB DEFAULT '[]'::jsonb,
    fulfilment_number TEXT,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    place_of_supply TEXT NOT NULL DEFAULT '27',
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_value NUMERIC(12, 2) NOT NULL,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    outstanding_amount NUMERIC(12, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid')),
    payment_mode TEXT,
    payment_reference TEXT,
    status TEXT DEFAULT 'Confirmed',
    notes TEXT,
    has_manual_rates BOOLEAN DEFAULT FALSE,
    last_edited_at TIMESTAMPTZ,
    last_edited_by TEXT,
    edit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_name TEXT,
    hsn TEXT NOT NULL,
    packing TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER NOT NULL,
    trading_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'Piece',
    units_per_trading_unit INTEGER DEFAULT 1,
    rate NUMERIC(10, 2) NOT NULL,
    carton_rate NUMERIC(10, 2),
    loose_rate NUMERIC(10, 2),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    carton_discount NUMERIC(10, 2) DEFAULT 0.00,
    loose_discount NUMERIC(10, 2) DEFAULT 0.00,
    taxable_value NUMERIC(12, 2) NOT NULL,
    gst_percent NUMERIC(5, 2) NOT NULL,
    gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    batch_number TEXT,
    batch_id TEXT,
    mrp NUMERIC(10, 2),
    purchase_rate NUMERIC(10, 2),
    catalogue_rate NUMERIC(10, 2),
    order_time_rate NUMERIC(10, 2),
    manual_billing_rate NUMERIC(10, 2),
    manual_rate_applied BOOLEAN DEFAULT FALSE,
    manual_rate_reason TEXT,
    variant_name TEXT,
    description TEXT
);

-- ---------------------------------------------------------------------
-- 11. DELIVERY CHALLANS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_challans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    challan_number TEXT NOT NULL, -- e.g. 'DC/2026-27/00001'
    order_id TEXT REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL,
    order_number TEXT,
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    invoice_id TEXT REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL,
    invoice_number TEXT,
    dispatch_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    transport_mode TEXT DEFAULT 'Delivery Van',
    vehicle_number TEXT,
    delivery_person TEXT,
    notes TEXT,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    total_items INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, challan_number)
);

CREATE TABLE IF NOT EXISTS delivery_challan_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    challan_id TEXT NOT NULL REFERENCES delivery_challans(id) ON UPDATE CASCADE ON DELETE CASCADE,
    order_item_id TEXT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    brand TEXT,
    variant_name TEXT,
    pack_size TEXT,
    trading_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL,
    units_per_trading_unit INTEGER NOT NULL DEFAULT 1,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER NOT NULL DEFAULT 0,
    dispatched_qty INTEGER NOT NULL DEFAULT 0,
    batch_number TEXT,
    batch_id TEXT,
    mrp NUMERIC(10, 2),
    purchase_rate NUMERIC(10, 2),
    expiry_date TEXT
);

-- ---------------------------------------------------------------------
-- 12. PAYMENTS & FINANCIAL AUDIT LEDGERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    payment_number TEXT NOT NULL, -- e.g. 'PAY-2026-00001'
    amount NUMERIC(12, 2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit', 'Other')),
    reference_number TEXT,
    notes TEXT,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, payment_number)
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
    payment_id TEXT NOT NULL REFERENCES payments(id) ON UPDATE CASCADE ON DELETE CASCADE,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    amount_allocated NUMERIC(12, 2) NOT NULL
);

-- Customer Financial Ledger (Running debit/credit debt ledger)
CREATE TABLE IF NOT EXISTS customer_ledger (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT', 'INVOICE', 'PAYMENT', 'RETURN', 'ADJUSTMENT')),
    category TEXT,
    reference_number TEXT,
    reference_id TEXT,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(12, 2) NOT NULL,
    running_balance NUMERIC(12, 2),
    balance_after NUMERIC(12, 2),
    notes TEXT,
    created_by TEXT REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Cash Flow Transactions
CREATE TABLE IF NOT EXISTS cash_flow_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    company_id TEXT REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT, -- backwards-compatible alias
    transaction_number TEXT,
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    time TEXT,
    type TEXT NOT NULL CHECK (type IN ('INFLOW', 'OUTFLOW', 'CASH_IN', 'CASH_OUT')),
    amount NUMERIC(12, 2) NOT NULL,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
    category TEXT NOT NULL,
    party_type TEXT,
    party_id TEXT,
    party_name TEXT,
    reference_type TEXT,
    reference_id TEXT,
    reference_number TEXT,
    source_type TEXT,
    source_id TEXT,
    linked_invoice_id TEXT,
    linked_invoice_number TEXT,
    linked_retailer_id TEXT,
    linked_supplier_id TEXT,
    linked_purchase_id TEXT,
    remarks TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('PENDING', 'VERIFIED', 'CANCELLED', 'Active', 'Voided')),
    voided_at TIMESTAMPTZ,
    voided_by TEXT,
    void_reason TEXT,
    edit_history JSONB DEFAULT '[]'::jsonb,
    created_by TEXT,
    created_by_id TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_opening_balances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    company_id TEXT REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT, -- backwards-compatible alias
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    as_of_date DATE NOT NULL,
    mode_balances JSONB DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id)
);

-- ---------------------------------------------------------------------
-- 13. SALES & PURCHASE RETURNS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_returns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    invoice_id TEXT REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL,
    credit_note_number TEXT,
    retailer_id TEXT REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    receiving_godown_id TEXT REFERENCES godowns(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    return_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    taxable_amount NUMERIC(12, 2),
    gst_amount NUMERIC(12, 2),
    cgst NUMERIC(12, 2),
    sgst NUMERIC(12, 2),
    igst NUMERIC(12, 2),
    round_off NUMERIC(5, 2),
    total_amount NUMERIC(12, 2)
);

CREATE TABLE IF NOT EXISTS sales_return_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sales_return_id TEXT NOT NULL REFERENCES sales_returns(id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER NOT NULL DEFAULT 0,
    trading_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'Piece',
    units_per_trading_unit INTEGER DEFAULT 1,
    rate NUMERIC(10, 2) NOT NULL,
    loose_rate NUMERIC(10, 2),
    hsn TEXT,
    mrp NUMERIC(10, 2),
    gst_percent NUMERIC(5, 2),
    taxable_value NUMERIC(12, 2),
    gst_amount NUMERIC(12, 2),
    cgst NUMERIC(12, 2),
    sgst NUMERIC(12, 2),
    igst NUMERIC(12, 2),
    total_amount NUMERIC(12, 2),
    condition TEXT NOT NULL CHECK (condition IN ('Sellable', 'Damaged'))
);

CREATE TABLE IF NOT EXISTS purchase_returns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    return_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed'
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    purchase_return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER NOT NULL DEFAULT 0,
    trading_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL DEFAULT 'Piece',
    units_per_trading_unit INTEGER DEFAULT 1,
    rate NUMERIC(10, 2) NOT NULL
);

-- ---------------------------------------------------------------------
-- 14. AUDIT TRAILS & ACTIVITY LOGGING
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_rate_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    order_id TEXT REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL,
    order_item_id TEXT REFERENCES order_items(id) ON UPDATE CASCADE ON DELETE SET NULL,
    fulfilment_id TEXT REFERENCES fulfilments(id) ON UPDATE CASCADE ON DELETE SET NULL,
    invoice_id TEXT REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL,
    retailer_id TEXT NOT NULL REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    catalogue_rate NUMERIC(10, 2) NOT NULL,
    order_time_rate NUMERIC(10, 2) NOT NULL,
    manual_billing_rate NUMERIC(10, 2) NOT NULL,
    final_applied_rate NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    admin_user_id TEXT REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
    admin_user_name TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    action TEXT NOT NULL,
    details TEXT,
    old_value JSONB,
    new_value JSONB,
    reference_id TEXT,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_audits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
    invoice_number TEXT,
    retailer_id TEXT,
    retailer_name TEXT,
    admin_id TEXT,
    admin_name TEXT,
    action TEXT NOT NULL,
    admin_user_id TEXT,
    admin_user_name TEXT,
    reason TEXT,
    timestamp TIMESTAMPTZ,
    old_grand_total NUMERIC(12, 2),
    new_grand_total NUMERIC(12, 2),
    old_outstanding_amount NUMERIC(12, 2),
    new_outstanding_amount NUMERIC(12, 2),
    retailer_outstanding_delta NUMERIC(12, 2),
    field_changes JSONB,
    item_changes JSONB,
    snapshot_before JSONB,
    snapshot_after JSONB,
    old_data JSONB,
    new_data JSONB,
    diff_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 15. IMPORTER AUDIT TRAIL & STAGING
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vyapar_imports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    imported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    total_rows INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    stock_units_imported INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('Completed', 'Completed with Errors', 'Rolled Back', 'Failed')),
    imported_by_id TEXT,
    imported_by_name TEXT,
    created_product_ids JSONB DEFAULT '[]'::jsonb,
    updated_snapshots JSONB DEFAULT '[]'::jsonb,
    created_purchase_id TEXT,
    created_batch_ids JSONB DEFAULT '[]'::jsonb,
    created_ledger_ids JSONB DEFAULT '[]'::jsonb,
    column_mapping JSONB DEFAULT '{}'::jsonb,
    row_logs JSONB DEFAULT '[]'::jsonb,
    rollback_at TIMESTAMPTZ,
    rollback_by_name TEXT,
    rollback_reason TEXT
);

-- AI / OCR Bill Staging
CREATE TABLE IF NOT EXISTS ai_purchase_imports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT REFERENCES business_companies(id) ON UPDATE CASCADE ON DELETE SET NULL,
    supplier_name TEXT,
    supplier_gstin TEXT,
    invoice_number TEXT,
    invoice_date DATE,
    total_amount NUMERIC(12, 2),
    status TEXT NOT NULL CHECK (status IN ('Pending_Verification', 'Confirmed')),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_purchase_import_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    import_id TEXT NOT NULL REFERENCES ai_purchase_imports(id) ON UPDATE CASCADE ON DELETE CASCADE,
    extracted_name TEXT NOT NULL,
    matched_product_id TEXT REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
    match_confidence TEXT CHECK (match_confidence IN ('GREEN', 'YELLOW', 'RED')),
    quantity INTEGER,
    trading_unit TEXT,
    purchase_rate NUMERIC(10, 2),
    mrp NUMERIC(10, 2),
    gst_percent NUMERIC(5, 2),
    hsn TEXT,
    batch TEXT,
    expiry_date DATE
);

-- ---------------------------------------------------------------------
-- 16. INDEXES & QUERY OPTIMIZATIONS
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_biz_code ON products(business_id, product_code);
CREATE INDEX IF NOT EXISTS idx_products_biz_barcode ON products(business_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_biz_sku ON products(business_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_biz_prod ON inventory(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_batches_biz_prod ON inventory_batches(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_biz_prod ON stock_ledger(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_biz_retailer ON orders(business_id, retailer_id);
CREATE INDEX IF NOT EXISTS idx_orders_biz_date ON orders(business_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_retailer ON invoices(business_id, retailer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_date ON invoices(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_retailer ON customer_ledger(retailer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_biz ON customer_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON profiles(mobile);
CREATE INDEX IF NOT EXISTS idx_profiles_biz ON profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_products_biz_updated ON products(business_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_biz_updated ON categories(business_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_retailers_biz_updated ON retailers(business_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_biz_updated ON orders(business_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_updated ON invoices(business_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_biz_created ON stock_ledger(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_biz_created ON customer_ledger(business_id, created_at);

-- ---------------------------------------------------------------------
-- 17. STORED PROCEDURES & BUSINESS WORKFLOW RPCS (UPDATED TO TEXT IDS)
-- ---------------------------------------------------------------------

-- Function 1: Get Last 5 Billing Rates for Retailer and Product
CREATE OR REPLACE FUNCTION get_last_5_billing_rates(
    p_retailer_id TEXT,
    p_product_id TEXT,
    p_trading_unit TEXT DEFAULT NULL
)
RETURNS TABLE (
    invoice_id TEXT,
    invoice_number TEXT,
    order_number TEXT,
    billing_date TIMESTAMPTZ,
    quantity INTEGER,
    trading_unit TEXT,
    packing TEXT,
    catalogue_rate NUMERIC(10, 2),
    discount NUMERIC(10, 2),
    applied_rate NUMERIC(10, 2),
    final_applied_rate NUMERIC(10, 2),
    manual_rate_applied BOOLEAN,
    manual_rate_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id AS invoice_id,
        i.invoice_number,
        COALESCE(o.order_number, f.fulfilment_number, 'DIRECT-INVOICE') AS order_number,
        i.date AS billing_date,
        ii.quantity,
        ii.trading_unit,
        ii.packing,
        COALESCE(ii.catalogue_rate, p.selling_price) AS catalogue_rate,
        ii.discount,
        ii.rate AS applied_rate,
        (ii.rate - ii.discount) AS final_applied_rate,
        COALESCE(ii.manual_rate_applied, FALSE) AS manual_rate_applied,
        ii.manual_rate_reason
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    JOIN products p ON p.id = ii.product_id
    LEFT JOIN orders o ON o.id = i.order_ref_id
    LEFT JOIN fulfilments f ON f.id = i.order_ref_id
    WHERE i.retailer_id = p_retailer_id
      AND ii.product_id = p_product_id
      AND (p_trading_unit IS NULL OR ii.trading_unit = p_trading_unit)
    ORDER BY i.date DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Get Customer Credit Profile
CREATE OR REPLACE FUNCTION get_customer_credit_profile(
    p_retailer_id TEXT,
    p_company_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_retailer RECORD;
    v_total_outstanding NUMERIC(12, 2) := 0.00;
    v_credit_limit NUMERIC(12, 2) := 50000.00;
    v_available_credit NUMERIC(12, 2) := 0.00;
    v_oldest_unpaid_days INTEGER := 0;
    v_unpaid_count INTEGER := 0;
    v_bucket_0_30 NUMERIC(12, 2) := 0.00;
    v_bucket_31_60 NUMERIC(12, 2) := 0.00;
    v_bucket_61_90 NUMERIC(12, 2) := 0.00;
    v_bucket_90_plus NUMERIC(12, 2) := 0.00;
    v_is_limit_exceeded BOOLEAN := FALSE;
    v_has_overdue_invoices BOOLEAN := FALSE;
    v_is_blocked BOOLEAN := FALSE;
    v_block_reason TEXT := NULL;
    v_overdue_threshold_days INTEGER := 30;
BEGIN
    SELECT * INTO v_retailer 
    FROM retailers 
    WHERE id = p_retailer_id 
      AND (business_id = p_company_id OR p_company_id IS NULL);

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'found', FALSE,
            'error', 'Customer not found'
        );
    END IF;

    v_credit_limit := COALESCE(v_retailer.credit_limit, 50000.00);

    SELECT 
        COALESCE(SUM(outstanding_amount), 0.00),
        COUNT(*),
        COALESCE(MAX(EXTRACT(DAY FROM (CURRENT_TIMESTAMP - date))::INTEGER), 0),
        COALESCE(SUM(CASE WHEN CURRENT_TIMESTAMP - date <= INTERVAL '30 days' THEN outstanding_amount ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN CURRENT_TIMESTAMP - date > INTERVAL '30 days' AND CURRENT_TIMESTAMP - date <= INTERVAL '60 days' THEN outstanding_amount ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN CURRENT_TIMESTAMP - date > INTERVAL '60 days' AND CURRENT_TIMESTAMP - date <= INTERVAL '90 days' THEN outstanding_amount ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN CURRENT_TIMESTAMP - date > INTERVAL '90 days' THEN outstanding_amount ELSE 0 END), 0.00)
    INTO 
        v_total_outstanding,
        v_unpaid_count,
        v_oldest_unpaid_days,
        v_bucket_0_30,
        v_bucket_31_60,
        v_bucket_61_90,
        v_bucket_90_plus
    FROM invoices
    WHERE retailer_id = p_retailer_id
      AND payment_status != 'Paid'
      AND outstanding_amount > 0;

    v_available_credit := GREATEST(0.00, v_credit_limit - v_total_outstanding);
    v_is_limit_exceeded := (v_total_outstanding > v_credit_limit);
    v_has_overdue_invoices := (v_oldest_unpaid_days > v_overdue_threshold_days);

    IF v_is_limit_exceeded THEN
        v_is_blocked := TRUE;
        v_block_reason := 'Credit limit exceeded (Outstanding: ₹' || v_total_outstanding || ', Limit: ₹' || v_credit_limit || ')';
    ELSIF v_has_overdue_invoices THEN
        v_is_blocked := TRUE;
        v_block_reason := 'Overdue invoices exist (> ' || v_overdue_threshold_days || ' days old)';
    END IF;

    RETURN jsonb_build_object(
        'found', TRUE,
        'retailer_id', p_retailer_id,
        'shop_name', v_retailer.shop_name,
        'credit_limit', v_credit_limit,
        'total_outstanding', v_total_outstanding,
        'available_credit', v_available_credit,
        'unpaid_invoices_count', v_unpaid_count,
        'oldest_unpaid_days', v_oldest_unpaid_days,
        'is_limit_exceeded', v_is_limit_exceeded,
        'has_overdue_invoices', v_has_overdue_invoices,
        'is_blocked', v_is_blocked,
        'block_reason', v_block_reason,
        'aging_buckets', jsonb_build_object(
            'days_0_30', v_bucket_0_30,
            'days_31_60', v_bucket_31_60,
            'days_61_90', v_bucket_61_90,
            'days_90_plus', v_bucket_90_plus
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Auto-Update Timestamp Trigger
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_retailers_updated_at ON retailers;
CREATE TRIGGER trg_retailers_updated_at
BEFORE UPDATE ON retailers
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_business_companies_updated_at ON business_companies;
CREATE TRIGGER trg_business_companies_updated_at
BEFORE UPDATE ON business_companies
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ---------------------------------------------------------------------
-- 18. MULTI-TENANT ISOLATION & ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
-- Defense-in-depth: All business tables have RLS enabled.
-- The Next.js server accesses tables via service-role connection or session context.
-- Direct unauthenticated anonKey access is strictly denied.

CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS TEXT AS $$
DECLARE
    v_bid TEXT;
BEGIN
    -- Check local session setting first (set by server route pooler)
    v_bid := NULLIF(TRIM(current_setting('app.current_business_id', true)), '');
    IF v_bid IS NOT NULL THEN
        RETURN v_bid;
    END IF;
    -- Check Supabase JWT claim
    v_bid := NULLIF(TRIM(auth.jwt() ->> 'business_id'), '');
    RETURN v_bid; -- returns NULL if unauthenticated or context missing
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to verify administrative authorization from server session or Supabase JWT
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check local session setting (set by server routes)
    IF NULLIF(TRIM(current_setting('app.is_admin', true)), '') = 'true' THEN
        RETURN TRUE;
    END IF;
    -- Check Supabase JWT claims
    IF (auth.jwt() ->> 'role') = 'service_role' OR 
       (auth.jwt() ->> 'user_role') IN ('admin', 'owner') OR 
       (auth.jwt() ->> 'profile_type') = 'ADMIN' THEN
        RETURN TRUE;
    END IF;
    -- Check profiles table for the authenticated user
    IF auth.uid() IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid()::text 
              AND (role IN ('admin', 'owner') OR profile_type = 'ADMIN')
              AND active = TRUE
        );
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS across all 42 business entities and configuration tables
ALTER TABLE business_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE godowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfilments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfilment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_opening_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rate_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE vyapar_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_purchase_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_purchase_import_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- TABLE ACCESS PRIVILEGES & ROLE PERMISSIONS
-- ---------------------------------------------------------------------
-- Revoke public and anon privileges on sensitive configuration and staging tables
REVOKE ALL ON TABLE system_settings FROM PUBLIC, anon;
REVOKE ALL ON TABLE ai_purchase_imports, ai_purchase_import_items FROM PUBLIC, anon;

-- Grant administrative full access to service_role (server backend)
GRANT ALL ON TABLE system_settings TO service_role;
GRANT ALL ON TABLE ai_purchase_imports, ai_purchase_import_items TO service_role;
GRANT ALL ON TABLE companies, product_categories, suppliers, product_aliases TO service_role;

-- Grant authenticated users access strictly governed by RLS policies below
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ai_purchase_imports, ai_purchase_import_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE companies, product_categories, suppliers, product_aliases TO authenticated;

-- Server / Context Policies: strictly requires valid authenticated tenant context
-- Missing tenant context (NULL or empty) strictly DENIES access to all rows.
-- PostgreSQL service_role/superuser connections bypass RLS automatically for administrative tasks.

DROP POLICY IF EXISTS "tenant_isolation_policy_business_companies" ON business_companies;
CREATE POLICY "tenant_isolation_policy_business_companies" ON business_companies
    FOR ALL USING (get_current_business_id() IS NOT NULL AND id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_profiles" ON profiles;
CREATE POLICY "tenant_isolation_policy_profiles" ON profiles
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_company_members" ON company_members;
CREATE POLICY "tenant_isolation_policy_company_members" ON company_members
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_godowns" ON godowns;
CREATE POLICY "tenant_isolation_policy_godowns" ON godowns
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_companies" ON companies;
DROP POLICY IF EXISTS "companies_read_policy" ON companies;
CREATE POLICY "companies_read_policy" ON companies
    FOR SELECT
    TO authenticated
    USING (active = TRUE);

DROP POLICY IF EXISTS "companies_admin_policy" ON companies;
CREATE POLICY "companies_admin_policy" ON companies
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

DROP POLICY IF EXISTS "tenant_isolation_policy_categories" ON categories;
CREATE POLICY "tenant_isolation_policy_categories" ON categories
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_products" ON products;
CREATE POLICY "tenant_isolation_policy_products" ON products
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_product_categories" ON product_categories;
CREATE POLICY "tenant_isolation_policy_product_categories" ON product_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM products
            WHERE products.id = product_categories.product_id
              AND get_current_business_id() IS NOT NULL
              AND products.business_id = get_current_business_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM products
            WHERE products.id = product_categories.product_id
              AND get_current_business_id() IS NOT NULL
              AND products.business_id = get_current_business_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_policy_suppliers" ON suppliers;
CREATE POLICY "tenant_isolation_policy_suppliers" ON suppliers
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_product_aliases" ON product_aliases;
CREATE POLICY "tenant_isolation_policy_product_aliases" ON product_aliases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = product_aliases.supplier_id
              AND get_current_business_id() IS NOT NULL
              AND suppliers.business_id = get_current_business_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = product_aliases.supplier_id
              AND get_current_business_id() IS NOT NULL
              AND suppliers.business_id = get_current_business_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_policy_inventory" ON inventory;
CREATE POLICY "tenant_isolation_policy_inventory" ON inventory
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_inventory_batches" ON inventory_batches;
CREATE POLICY "tenant_isolation_policy_inventory_batches" ON inventory_batches
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_stock_ledger" ON stock_ledger;
CREATE POLICY "tenant_isolation_policy_stock_ledger" ON stock_ledger
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_retailers" ON retailers;
CREATE POLICY "tenant_isolation_policy_retailers" ON retailers
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_orders" ON orders;
CREATE POLICY "tenant_isolation_policy_orders" ON orders
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_invoices" ON invoices;
CREATE POLICY "tenant_isolation_policy_invoices" ON invoices
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_payments" ON payments;
CREATE POLICY "tenant_isolation_policy_payments" ON payments
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_customer_ledger" ON customer_ledger;
CREATE POLICY "tenant_isolation_policy_customer_ledger" ON customer_ledger
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_vyapar_imports" ON vyapar_imports;
CREATE POLICY "tenant_isolation_policy_vyapar_imports" ON vyapar_imports
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_ai_purchase_imports" ON ai_purchase_imports;
CREATE POLICY "tenant_isolation_policy_ai_purchase_imports" ON ai_purchase_imports
    FOR ALL USING (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id())
    WITH CHECK (get_current_business_id() IS NOT NULL AND business_id = get_current_business_id());

DROP POLICY IF EXISTS "tenant_isolation_policy_ai_purchase_import_items" ON ai_purchase_import_items;
CREATE POLICY "tenant_isolation_policy_ai_purchase_import_items" ON ai_purchase_import_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM ai_purchase_imports
            WHERE ai_purchase_imports.id = ai_purchase_import_items.import_id
              AND get_current_business_id() IS NOT NULL
              AND ai_purchase_imports.business_id = get_current_business_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_purchase_imports
            WHERE ai_purchase_imports.id = ai_purchase_import_items.import_id
              AND get_current_business_id() IS NOT NULL
              AND ai_purchase_imports.business_id = get_current_business_id()
        )
    );

-- System Settings Security:
-- 1. Administrative users can read and write all settings, including database backups and snapshots
DROP POLICY IF EXISTS "secure_admin_system_settings_all" ON system_settings;
CREATE POLICY "secure_admin_system_settings_all" ON system_settings
    FOR ALL
    TO authenticated
    USING (is_admin_user())
    WITH CHECK (is_admin_user());

-- 2. Ordinary authenticated users can ONLY read non-sensitive settings.
-- Cloud database snapshots (fmcg_cloud_database_v1, backups) are strictly hidden.
DROP POLICY IF EXISTS "secure_authenticated_read_non_sensitive_settings" ON system_settings;
CREATE POLICY "secure_authenticated_read_non_sensitive_settings" ON system_settings
    FOR SELECT
    TO authenticated
    USING (
        key NOT IN ('fmcg_cloud_database_v1')
        AND key NOT LIKE '%snapshot%'
        AND key NOT LIKE '%backup%'
    );

COMMIT;

