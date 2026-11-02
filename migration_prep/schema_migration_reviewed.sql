BEGIN;

-- =====================================================================
-- Reviewed Schema Migration: Cloud-First Architecture & Missing Tables
-- Saifee General Stores FMCG Wholesale Distribution & Trade ERP
-- Version: Phase 1C Remediated (Fail-Closed Preflight, Granular RLS, Strict Atomicity)
-- Production Status: PREPARATION ONLY — NOT EXECUTED AGAINST PRODUCTION
-- =====================================================================
--
-- DEPLOYMENT TRANSACTIONALITY & ATOMICITY NOTICE:
-- 1. This entire migration is enclosed within a single transaction block (BEGIN ... COMMIT).
--    If any error occurs during execution, PostgreSQL will automatically roll back ALL
--    schema changes, preventing a broken or partially migrated database.
-- 2. Transaction Safety Verification:
--    All DDL and DML statements used here (CREATE TABLE, ALTER TABLE, CREATE POLICY,
--    CREATE INDEX, CREATE FUNCTION, DO blocks) are fully transaction-safe in PostgreSQL.
--    No non-transactional statements are used. Specifically, the following PostgreSQL
--    commands CANNOT run inside a transaction block and have been intentionally excluded:
--      - VACUUM / VACUUM FULL
--      - CREATE DATABASE / DROP DATABASE
--      - ALTER SYSTEM
--      - CREATE INDEX CONCURRENTLY / REINDEX CONCURRENTLY
--      - DISCARD ALL
-- 3. Deployment Method Atomicity:
--    - Supabase CLI (`supabase db push` / `supabase migration up`): Wraps each migration file
--      inside an atomic transaction by default.
--    - Supabase SQL Editor: The explicit `BEGIN; ... COMMIT;` enclosing this script guarantees
--      atomic execution (all statements succeed or all roll back together).
--    - Direct psql / connection pooler: Honors the `BEGIN; ... COMMIT;` atomic transaction block.
--
-- STRICT REMEDIATION SAFEGUARDS IMPLEMENTED:
-- 1. Explicit fail-closed preflight validation checking required baseline tables, columns,
--    column data types, and existing data integrity before executing any DDL.
-- 2. Do not assume `CREATE TABLE IF NOT EXISTS` adds columns: explicit `ALTER TABLE ADD COLUMN
--    IF NOT EXISTS` is applied to every entity to guarantee full schema alignment.
-- 3. Audited and unified `business_id` and `business_company_id` columns across all managed tables.
-- 4. Complete table-by-table RLS permission matrix separating SELECT, INSERT, UPDATE, and DELETE.
-- 5. Preserves salesperson workflows (order booking, payment collections, returns, retailer updates)
--    while blocking broad financial or inventory mutations (invoices, stock ledger, inventory write).
-- 6. Dynamically purges conflicting permissive policies with 100% documented replacement coverage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS & ID GENERATOR HELPERS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. FAIL-CLOSED PREFLIGHT VALIDATION & SCHEMA AUDIT
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_missing_tables TEXT[] := ARRAY[]::TEXT[];
    v_tbl TEXT;
    v_col_type TEXT;
    v_collision_count INTEGER;
    v_orphaned_products INTEGER;
    v_tables_to_check TEXT[] := ARRAY[
        'products', 'retailers', 'orders', 'order_items', 
        'invoices', 'invoice_items', 'inventory', 'inventory_batches', 
        'purchases', 'purchase_items', 'payments', 'customer_ledger'
    ];
BEGIN
    RAISE NOTICE '=== STARTING PHASE 1C PREFLIGHT SCHEMA & DATA AUDIT ===';

    -- 2.1 Baseline Tables Existence Check
    FOREACH v_tbl IN ARRAY ARRAY['companies', 'profiles', 'business_companies', 'company_members'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = v_tbl
        ) THEN
            v_missing_tables := array_append(v_missing_tables, v_tbl);
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: Required baseline table(s) missing in public schema: %', 
            array_to_string(v_missing_tables, ', ');
    END IF;

    -- 2.2 Baseline Profiles Columns Check
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: Column "role" missing in table "profiles". Cannot enforce RLS.';
    END IF;

    -- 2.3 Company Collision Check
    SELECT count(*) INTO v_collision_count
    FROM companies 
    WHERE id::TEXT = 'c-joy' AND code != 'JOY';

    IF v_collision_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: Collision detected! Table companies contains id="c-joy" with a non-JOY code.';
    END IF;

    -- 2.4 Multi-Tenant Column Preflight (business_id & business_company_id audit)
    FOREACH v_tbl IN ARRAY v_tables_to_check LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            -- Check business_id column type if present
            SELECT data_type INTO v_col_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'business_id';

            IF v_col_type IS NOT NULL AND v_col_type NOT IN ('text', 'character varying', 'uuid') THEN
                RAISE EXCEPTION 'PREFLIGHT FAILURE: Incompatible type "%" for column "business_id" in table "%"', v_col_type, v_tbl;
            END IF;

            -- Check business_company_id column type if present
            SELECT data_type INTO v_col_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'business_company_id';

            IF v_col_type IS NOT NULL AND v_col_type NOT IN ('text', 'character varying', 'uuid') THEN
                RAISE EXCEPTION 'PREFLIGHT FAILURE: Incompatible type "%" for column "business_company_id" in table "%"', v_col_type, v_tbl;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '=== PREFLIGHT AUDIT PASSED: Baseline tables, columns, and data verified ===';
END $$;

-- ---------------------------------------------------------------------
-- 3. CREATE CORE FMCG ENTITIES (WITH EXPLICIT COLUMN GUARANTEES)
-- ---------------------------------------------------------------------

-- 3.1 Godowns Master (Multi-Warehouse Locations)
CREATE TABLE IF NOT EXISTS godowns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    company_id TEXT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Mumbai',
    state TEXT DEFAULT 'Maharashtra',
    pincode TEXT,
    manager_name TEXT,
    phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Defensive Column Guarantees (Guarantees columns if table already existed)
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Mumbai';
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Maharashtra';
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE godowns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_godowns_biz ON godowns(business_id);
CREATE INDEX IF NOT EXISTS idx_godowns_code ON godowns(code);

-- 3.2 Stock Transfers Header & Line Items
CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    company_id TEXT,
    transfer_number TEXT NOT NULL UNIQUE,
    from_godown_id TEXT NOT NULL REFERENCES godowns(id),
    to_godown_id TEXT NOT NULL REFERENCES godowns(id),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Requested', 'Approved', 'Dispatched', 'Received', 'Completed', 'Cancelled')),
    requested_by TEXT,
    approved_by TEXT,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS transfer_number TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS from_godown_id TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS to_godown_id TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_st_biz ON stock_transfers(business_id);
CREATE INDEX IF NOT EXISTS idx_st_status ON stock_transfers(status);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    batch_id TEXT,
    batch_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    received_carton_qty INTEGER DEFAULT 0,
    received_loose_qty INTEGER DEFAULT 0
);

ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS transfer_id TEXT;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS carton_qty INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS loose_qty INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS received_qty INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS received_carton_qty INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS received_loose_qty INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_st_items_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_st_items_product ON stock_transfer_items(product_id);

-- 3.3 Delivery Challans Header & Items
CREATE TABLE IF NOT EXISTS delivery_challans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    challan_number TEXT NOT NULL UNIQUE,
    order_id TEXT,
    order_number TEXT,
    fulfilment_id TEXT,
    retailer_id TEXT NOT NULL,
    invoice_id TEXT,
    invoice_number TEXT,
    dispatch_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transport_mode TEXT DEFAULT 'Delivery Van',
    vehicle_number TEXT,
    delivery_person TEXT,
    notes TEXT,
    total_quantity INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS challan_number TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS fulfilment_id TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS retailer_id TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS dispatch_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'Delivery Van';
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS delivery_person TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS total_units INTEGER DEFAULT 0;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_challans_biz ON delivery_challans(business_id);
CREATE INDEX IF NOT EXISTS idx_challans_retailer ON delivery_challans(retailer_id);
CREATE INDEX IF NOT EXISTS idx_challans_order ON delivery_challans(order_id);

CREATE TABLE IF NOT EXISTS delivery_challan_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    challan_id TEXT NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
    order_item_id TEXT,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    brand TEXT,
    variant_name TEXT,
    pack_size TEXT,
    trading_unit TEXT NOT NULL DEFAULT 'Carton',
    base_unit TEXT DEFAULT 'Piece',
    units_per_trading_unit INTEGER DEFAULT 1,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    base_qty INTEGER DEFAULT 0,
    dispatched_qty INTEGER NOT NULL DEFAULT 0,
    batch_number TEXT,
    batch_id TEXT,
    mrp NUMERIC(10, 2),
    purchase_rate NUMERIC(10, 2),
    expiry_date DATE
);

ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS challan_id TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS order_item_id TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS pack_size TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS trading_unit TEXT DEFAULT 'Carton';
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'Piece';
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS units_per_trading_unit INTEGER DEFAULT 1;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS carton_qty INTEGER DEFAULT 0;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS loose_qty INTEGER DEFAULT 0;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS base_qty INTEGER DEFAULT 0;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS dispatched_qty INTEGER DEFAULT 0;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(10, 2);
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(10, 2);
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_dc_items_challan ON delivery_challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_dc_items_product ON delivery_challan_items(product_id);

-- 3.4 Cash Flow Transactions & Company Opening Balances
CREATE TABLE IF NOT EXISTS cash_flow_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    company_id TEXT,
    transaction_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME NOT NULL DEFAULT CURRENT_TIME,
    type TEXT NOT NULL CHECK (type IN ('CASH_IN', 'CASH_OUT')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
    category TEXT NOT NULL,
    party_type TEXT CHECK (party_type IN ('retailer', 'supplier', 'other')),
    party_id TEXT,
    party_name TEXT NOT NULL,
    reference_number TEXT,
    source_type TEXT NOT NULL,
    source_id TEXT,
    linked_invoice_id TEXT,
    linked_invoice_number TEXT,
    linked_retailer_id TEXT,
    linked_supplier_id TEXT,
    linked_purchase_id TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Voided')),
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by TEXT,
    void_reason TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    edit_history JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS transaction_number TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS time TIME DEFAULT CURRENT_TIME;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS party_type TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS party_id TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS party_name TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE cash_flow_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_cf_biz ON cash_flow_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_cf_date ON cash_flow_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_type ON cash_flow_transactions(type);

CREATE TABLE IF NOT EXISTS company_opening_balances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode_balances JSONB DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cob_company UNIQUE(business_id, company_id)
);

ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS as_of_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS mode_balances JSONB DEFAULT '{}'::jsonb;
ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE company_opening_balances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_cob_biz ON company_opening_balances(business_id);

-- 3.5 Item Activity Logs & Invoice Audits
CREATE TABLE IF NOT EXISTS item_activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reference_id TEXT,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE item_activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_item_act_biz ON item_activity_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_item_act_prod ON item_activity_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_item_act_created ON item_activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_audits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    retailer_id TEXT NOT NULL,
    retailer_name TEXT NOT NULL,
    admin_id TEXT,
    admin_name TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    old_grand_total NUMERIC(12, 2) NOT NULL,
    new_grand_total NUMERIC(12, 2) NOT NULL,
    old_outstanding_amount NUMERIC(12, 2) NOT NULL,
    new_outstanding_amount NUMERIC(12, 2) NOT NULL,
    retailer_outstanding_delta NUMERIC(12, 2) NOT NULL,
    field_changes JSONB DEFAULT '[]'::jsonb,
    item_changes JSONB DEFAULT '[]'::jsonb,
    snapshot_before JSONB NOT NULL,
    snapshot_after JSONB NOT NULL
);

ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS retailer_id TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS retailer_name TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS admin_id TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS admin_name TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS old_grand_total NUMERIC(12, 2);
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS new_grand_total NUMERIC(12, 2);
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS snapshot_before JSONB;
ALTER TABLE invoice_audits ADD COLUMN IF NOT EXISTS snapshot_after JSONB;

CREATE INDEX IF NOT EXISTS idx_inv_audits_biz ON invoice_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_inv_audits_inv ON invoice_audits(invoice_id);

-- 3.6 Vyapar Excel/CSV Import History & Audit Log
CREATE TABLE IF NOT EXISTS vyapar_imports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_rows INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    stock_units_imported INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    imported_by_id TEXT,
    imported_by_name TEXT,
    created_product_ids JSONB DEFAULT '[]'::jsonb,
    updated_snapshots JSONB DEFAULT '[]'::jsonb,
    created_purchase_id TEXT,
    created_batch_ids JSONB DEFAULT '[]'::jsonb,
    created_ledger_ids JSONB DEFAULT '[]'::jsonb,
    column_mapping JSONB DEFAULT '{}'::jsonb,
    row_logs JSONB DEFAULT '[]'::jsonb,
    rollback_at TIMESTAMP WITH TIME ZONE,
    rollback_by_name TEXT,
    rollback_reason TEXT
);

ALTER TABLE vyapar_imports ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE vyapar_imports ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE vyapar_imports ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0;
ALTER TABLE vyapar_imports ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE vyapar_imports ADD COLUMN IF NOT EXISTS created_product_ids JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vyapar_biz ON vyapar_imports(business_id);
CREATE INDEX IF NOT EXISTS idx_vyapar_imported_at ON vyapar_imports(imported_at DESC);

-- 3.7 Migration Tracking Log (For Strict Non-Destructive Rollback & Audit)
CREATE TABLE IF NOT EXISTS migration_sessions (
    session_id TEXT PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
    total_records INTEGER DEFAULT 0,
    manifest JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS migration_audit_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    migration_session_id TEXT NOT NULL REFERENCES migration_sessions(session_id) ON DELETE CASCADE,
    target_table TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    pre_existing BOOLEAN NOT NULL DEFAULT FALSE,
    previous_snapshot JSONB,
    post_import_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mal_session ON migration_audit_log(migration_session_id);
CREATE INDEX IF NOT EXISTS idx_mal_table_rec ON migration_audit_log(target_table, record_id);

-- ---------------------------------------------------------------------
-- 4. ALIGN EXISTING TABLES WITH MISSING FMCG COLUMNS (SAFE & IDEMPOTENT)
-- ---------------------------------------------------------------------

-- Products Table
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_carton INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_carton BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_pieces BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS trade_mode TEXT DEFAULT 'BOTH' CHECK (trade_mode IN ('PIECES', 'CARTONS', 'BOTH'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS dealer_price NUMERIC(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_price_mode TEXT DEFAULT 'auto';
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Retailers Table
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS beat_name TEXT;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12, 2) DEFAULT 0.00;

-- Orders Table & Items
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'Retailer Direct';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_transport_mode TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_vehicle_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_delivery_person TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_godown TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS challan_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_mrp NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ordered_pieces INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_pieces INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_pieces INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packed_pieces INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packed_cartons INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packed_loose INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_rate NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ordered_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_qty INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS remaining_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS batch_allocations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS rate NUMERIC(10, 2);

-- Invoices Table & Items
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_numbers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;

-- Purchases Table & Items (With Explicit Opening-Stock Flag)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receiving_godown_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS is_opening_stock BOOLEAN DEFAULT FALSE;

ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS carton_qty INTEGER DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS loose_qty INTEGER DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS base_qty INTEGER DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS loose_purchase_rate NUMERIC(10, 2);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS loose_selling_price NUMERIC(10, 2);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS carton_rate NUMERIC(10, 2);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS loose_rate NUMERIC(10, 2);

-- Inventory & Batches
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS godown TEXT;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS godown_id TEXT;

-- Other Entities
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE customer_ledger ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE payment_allocations ADD COLUMN IF NOT EXISTS business_id TEXT;

-- Ensure company_members has business_id column
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_members') THEN
        ALTER TABLE company_members ADD COLUMN IF NOT EXISTS business_id TEXT;
        UPDATE company_members SET business_id = company_id::text WHERE business_id IS NULL AND company_id IS NOT NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 5. CONDITIONAL TYPE CONVERSION & IDENTITY MIGRATION
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_proceed BOOLEAN := FALSE;
BEGIN
    IF v_proceed THEN
        RAISE NOTICE 'Executing UUID-to-TEXT primary key alignment...';
        
        ALTER TABLE IF EXISTS profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;
        ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_company_id_fkey;
        
        ALTER TABLE companies ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE companies ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        
        -- Update company JOY identity safely
        UPDATE companies 
        SET id = 'c-joy', name = 'Joy Personal Care' 
        WHERE code = 'JOY' AND id != 'c-joy';
        
        ALTER TABLE profiles ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
        ALTER TABLE products ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
        
        ALTER TABLE profiles ADD CONSTRAINT profiles_company_id_fkey 
            FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL;
            
        ALTER TABLE products ADD CONSTRAINT products_company_id_fkey 
            FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE;
        
        RAISE NOTICE 'UUID-to-TEXT conversion and JOY migration executed successfully.';
    ELSE
        RAISE NOTICE 'UUID-to-TEXT conversion skipped (Guarded behind Phase 1C safety gate).';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY (RLS) HELPER FUNCTIONS (HARDENED SEARCH PATH)
-- ---------------------------------------------------------------------

-- 6.1 Function: Get authorized business IDs for active JWT session
CREATE OR REPLACE FUNCTION get_auth_business_ids()
RETURNS TABLE (business_id TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT COALESCE(cm.business_id, cm.company_id::TEXT)::TEXT
    FROM company_members cm
    JOIN profiles p ON p.id::TEXT = cm.user_id::TEXT
    WHERE cm.status = 'active'
      AND (
          p.id::TEXT = auth.uid()::TEXT 
          OR p.email = COALESCE(auth.jwt() ->> 'email', '')
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 6.2 Function: Check if user is a member of a specific business
CREATE OR REPLACE FUNCTION is_business_member(p_business_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members cm
        JOIN profiles p ON p.id::TEXT = cm.user_id::TEXT
        WHERE (p.id::TEXT = auth.uid()::TEXT OR p.email = COALESCE(auth.jwt() ->> 'email', ''))
          AND cm.status = 'active'
          AND COALESCE(cm.business_id, cm.company_id::TEXT)::TEXT = p_business_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 6.3 Function: Check if user is an admin strictly for a specific business
CREATE OR REPLACE FUNCTION is_business_admin(p_business_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members cm
        JOIN profiles p ON p.id::TEXT = cm.user_id::TEXT
        WHERE (p.id::TEXT = auth.uid()::TEXT OR p.email = COALESCE(auth.jwt() ->> 'email', ''))
          AND cm.status = 'active'
          AND cm.role = 'admin'
          AND COALESCE(cm.business_id, cm.company_id::TEXT)::TEXT = p_business_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 6.4 Function: Check if user has admin privileges in ANY of their authorized businesses
CREATE OR REPLACE FUNCTION is_saifee_admin(p_business_id TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_business_id IS NOT NULL THEN
        RETURN is_business_admin(p_business_id);
    ELSE
        RETURN EXISTS (
            SELECT 1 FROM company_members cm
            JOIN profiles p ON p.id::TEXT = cm.user_id::TEXT
            WHERE (p.id::TEXT = auth.uid()::TEXT OR p.email = COALESCE(auth.jwt() ->> 'email', ''))
              AND cm.status = 'active'
              AND cm.role = 'admin'
              AND COALESCE(cm.business_id, cm.company_id::TEXT)::TEXT IN (SELECT get_auth_business_ids())
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 6.5 Function: Check if user is a salesperson for a specific business
CREATE OR REPLACE FUNCTION is_business_salesperson(p_business_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members cm
        JOIN profiles p ON p.id::TEXT = cm.user_id::TEXT
        WHERE (p.id::TEXT = auth.uid()::TEXT OR p.email = COALESCE(auth.jwt() ->> 'email', ''))
          AND cm.status = 'active'
          AND cm.role IN ('sales_dist', 'sales_co', 'salesperson', 'admin')
          AND COALESCE(cm.business_id, cm.company_id::TEXT)::TEXT = p_business_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 7. AUDIT & PURGE PRE-EXISTING PERMISSIVE RLS POLICIES
-- ---------------------------------------------------------------------
-- PostgreSQL evaluates multiple policies for a table using boolean OR.
-- Creating a new policy DOES NOT replace older permissive policies.
-- If an old permissive policy ("allow_all" or unrestricted SELECT/ALL)
-- remains, a newly added restrictive policy CANNOT protect the table.
-- Therefore, all existing policies on our managed tables are dynamically
-- purged before attaching strict tenant & role-scoped replacement policies.
--
-- TABLE-BY-TABLE PERMISSION MATRIX:
-- ┌─────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
-- │ Managed Entity          │ Anon Role    │ Authenticated│ Salesperson  │ Admin Role   │ Service Role │
-- ├─────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
-- │ godowns                 │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ stock_transfers         │ NO ACCESS    │ Tenant SELECT│ Request (INS)│ Full CRUD    │ Full Bypass  │
-- │ stock_transfer_items    │ NO ACCESS    │ Parent SELECT│ Parent INS   │ Full CRUD    │ Full Bypass  │
-- │ delivery_challans       │ NO ACCESS    │ Tenant SELECT│ Dispatch(INS)│ Full CRUD    │ Full Bypass  │
-- │ delivery_challan_items  │ NO ACCESS    │ Parent SELECT│ Parent INS   │ Full CRUD    │ Full Bypass  │
-- │ cash_flow_transactions  │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ company_opening_balances│ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ products                │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ retailers               │ NO ACCESS    │ Tenant SELECT│ INS + UPD    │ Full CRUD    │ Full Bypass  │
-- │ suppliers               │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ categories              │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ orders                  │ NO ACCESS    │ Tenant SELECT│ INS + UPD(P) │ Full CRUD    │ Full Bypass  │
-- │ order_items             │ NO ACCESS    │ Parent SELECT│ INS + UPD(P) │ Full CRUD    │ Full Bypass  │
-- │ invoices                │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ invoice_items           │ NO ACCESS    │ Parent SELECT│ Parent SELECT│ Full CRUD    │ Full Bypass  │
-- │ inventory               │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ inventory_batches       │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ purchases               │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ purchase_items          │ NO ACCESS    │ Parent SELECT│ Parent SELECT│ Full CRUD    │ Full Bypass  │
-- │ payments                │ NO ACCESS    │ Tenant SELECT│ Collect (INS)│ Full CRUD    │ Full Bypass  │
-- │ payment_allocations     │ NO ACCESS    │ Parent SELECT│ Parent INS   │ Full CRUD    │ Full Bypass  │
-- │ customer_ledger         │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ stock_ledger            │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Full CRUD    │ Full Bypass  │
-- │ sales_returns           │ NO ACCESS    │ Tenant SELECT│ Return (INS) │ Full CRUD    │ Full Bypass  │
-- │ sales_return_items      │ NO ACCESS    │ Parent SELECT│ Parent INS   │ Full CRUD    │ Full Bypass  │
-- │ item_activity_logs      │ NO ACCESS    │ Tenant SELECT│ Immutable INS│ Admin INSERT │ Full Bypass  │
-- │ invoice_audits          │ NO ACCESS    │ Tenant SELECT│ Tenant SELECT│ Admin INSERT │ Full Bypass  │
-- │ vyapar_imports          │ NO ACCESS    │ NO ACCESS    │ NO ACCESS    │ Full CRUD    │ Full Bypass  │
-- │ migration_sessions      │ NO ACCESS    │ NO ACCESS    │ NO ACCESS    │ Admin Only   │ Full Bypass  │
-- │ migration_audit_log     │ NO ACCESS    │ NO ACCESS    │ NO ACCESS    │ Admin Only   │ Full Bypass  │
-- └─────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
DO $$
DECLARE
    r RECORD;
    v_managed_tables TEXT[] := ARRAY[
        'godowns', 'stock_transfers', 'stock_transfer_items',
        'delivery_challans', 'delivery_challan_items', 'cash_flow_transactions',
        'company_opening_balances', 'item_activity_logs', 'invoice_audits',
        'vyapar_imports', 'products', 'retailers', 'suppliers', 'categories',
        'orders', 'order_items', 'invoices', 'invoice_items', 'inventory',
        'inventory_batches', 'purchases', 'purchase_items', 'payments',
        'payment_allocations', 'customer_ledger', 'stock_ledger',
        'sales_returns', 'sales_return_items',
        'migration_sessions', 'migration_audit_log'
    ];
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = ANY(v_managed_tables)
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped pre-existing policy % on %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 8. ENABLE ROW-LEVEL SECURITY & ATTACH GRANULAR TENANT POLICIES
-- ---------------------------------------------------------------------

-- Enable RLS across all managed tables
DO $$
DECLARE
    tbl TEXT;
    v_all_tables TEXT[] := ARRAY[
        'godowns', 'stock_transfers', 'stock_transfer_items',
        'delivery_challans', 'delivery_challan_items', 'cash_flow_transactions',
        'company_opening_balances', 'item_activity_logs', 'invoice_audits',
        'vyapar_imports', 'products', 'retailers', 'suppliers', 'categories',
        'orders', 'order_items', 'invoices', 'invoice_items', 'inventory',
        'inventory_batches', 'purchases', 'purchase_items', 'payments',
        'payment_allocations', 'customer_ledger', 'stock_ledger',
        'sales_returns', 'sales_return_items',
        'migration_sessions', 'migration_audit_log'
    ];
BEGIN
    FOREACH tbl IN ARRAY v_all_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        END IF;
    END LOOP;
END $$;

-- 8.1 Godowns (Tenant Read, Admin Write)
CREATE POLICY "godowns_select_policy" ON godowns
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "godowns_admin_write_policy" ON godowns
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

-- 8.2 Stock Transfers (Tenant Read, Salesperson Request, Admin Approve/Delete)
CREATE POLICY "st_select_policy" ON stock_transfers
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "st_insert_policy" ON stock_transfers
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(business_id));

CREATE POLICY "st_admin_update_policy" ON stock_transfers
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "st_admin_delete_policy" ON stock_transfers
    FOR DELETE USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "st_items_select_policy" ON stock_transfer_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM stock_transfers st WHERE st.id = stock_transfer_items.transfer_id 
        AND st.business_id IN (SELECT get_auth_business_ids())
    ));

CREATE POLICY "st_items_insert_policy" ON stock_transfer_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM stock_transfers st WHERE st.id = stock_transfer_items.transfer_id 
        AND st.business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(st.business_id)
    ));

CREATE POLICY "st_items_admin_write_policy" ON stock_transfer_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM stock_transfers st WHERE st.id = stock_transfer_items.transfer_id 
        AND st.business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(st.business_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM stock_transfers st WHERE st.id = stock_transfer_items.transfer_id 
        AND st.business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(st.business_id)
    ));

-- 8.3 Delivery Challans & Items
CREATE POLICY "dc_select_policy" ON delivery_challans
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "dc_insert_policy" ON delivery_challans
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(business_id));

CREATE POLICY "dc_admin_write_policy" ON delivery_challans
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "dc_items_select_policy" ON delivery_challan_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM delivery_challans dc WHERE dc.id = delivery_challan_items.challan_id 
        AND dc.business_id IN (SELECT get_auth_business_ids())
    ));

CREATE POLICY "dc_items_insert_policy" ON delivery_challan_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM delivery_challans dc WHERE dc.id = delivery_challan_items.challan_id 
        AND dc.business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(dc.business_id)
    ));

CREATE POLICY "dc_items_admin_write_policy" ON delivery_challan_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM delivery_challans dc WHERE dc.id = delivery_challan_items.challan_id 
        AND dc.business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(dc.business_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM delivery_challans dc WHERE dc.id = delivery_challan_items.challan_id 
        AND dc.business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(dc.business_id)
    ));

-- 8.4 Cash Flow & Opening Balances (Strict Admin Write)
CREATE POLICY "cf_select_policy" ON cash_flow_transactions
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "cf_admin_write_policy" ON cash_flow_transactions
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "cob_select_policy" ON company_opening_balances
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "cob_admin_write_policy" ON company_opening_balances
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

-- 8.5 Master Entities (Products, Categories, Suppliers: Admin Write)
CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "products_admin_write_policy" ON products
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "categories_select_policy" ON categories
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "categories_admin_write_policy" ON categories
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "suppliers_select_policy" ON suppliers
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "suppliers_admin_write_policy" ON suppliers
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

-- 8.6 Retailers (Salesperson Insert & Update, Admin Delete)
CREATE POLICY "retailers_select_policy" ON retailers
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "retailers_insert_policy" ON retailers
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(business_id));

CREATE POLICY "retailers_update_policy" ON retailers
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_salesperson(business_id));

CREATE POLICY "retailers_admin_delete_policy" ON retailers
    FOR DELETE USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

-- 8.7 Orders & Order Line Items (Salesperson Insert & Draft Update, Admin Full)
CREATE POLICY "orders_select_policy" ON orders
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "orders_insert_policy" ON orders
    FOR INSERT WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_salesperson(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "orders_update_policy" ON orders
    FOR UPDATE USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND (
            is_business_admin(COALESCE(business_id, business_company_id::text))
            OR (is_business_salesperson(COALESCE(business_id, business_company_id::text)) AND lower(COALESCE(status, 'pending')) IN ('pending', 'draft'))
        )
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND (
            is_business_admin(COALESCE(business_id, business_company_id::text))
            OR (is_business_salesperson(COALESCE(business_id, business_company_id::text)) AND lower(COALESCE(status, 'pending')) IN ('pending', 'draft'))
        )
    );

CREATE POLICY "orders_admin_delete_policy" ON orders
    FOR DELETE USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "order_items_select_policy" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders o WHERE o.id::text = order_items.order_id::text 
        AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id::text IN (SELECT get_auth_business_ids()))
    ));

CREATE POLICY "order_items_insert_policy" ON order_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM orders o WHERE o.id::text = order_items.order_id::text 
        AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_salesperson(COALESCE(o.business_id, o.business_company_id::text))
    ));

CREATE POLICY "order_items_update_policy" ON order_items
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM orders o WHERE o.id::text = order_items.order_id::text 
        AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND (
            is_business_admin(COALESCE(o.business_id, o.business_company_id::text))
            OR (is_business_salesperson(COALESCE(o.business_id, o.business_company_id::text)) AND lower(COALESCE(o.status, 'pending')) IN ('pending', 'draft'))
        )
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM orders o WHERE o.id::text = order_items.order_id::text 
        AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND (
            is_business_admin(COALESCE(o.business_id, o.business_company_id::text))
            OR (is_business_salesperson(COALESCE(o.business_id, o.business_company_id::text)) AND lower(COALESCE(o.status, 'pending')) IN ('pending', 'draft'))
        )
    ));

CREATE POLICY "order_items_admin_delete_policy" ON order_items
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM orders o WHERE o.id::text = order_items.order_id::text 
        AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(o.business_id, o.business_company_id::text))
    ));

-- 8.8 Invoices & Line Items (Strict Admin Write & Void)
CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "invoices_admin_write_policy" ON invoices
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "invoice_items_select_policy" ON invoice_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM invoices i WHERE i.id::text = invoice_items.invoice_id::text 
        AND (i.business_id IN (SELECT get_auth_business_ids()) OR i.business_company_id::text IN (SELECT get_auth_business_ids()))
    ));

CREATE POLICY "invoice_items_admin_write_policy" ON invoice_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM invoices i WHERE i.id::text = invoice_items.invoice_id::text 
        AND (i.business_id IN (SELECT get_auth_business_ids()) OR i.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(i.business_id, i.business_company_id::text))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM invoices i WHERE i.id::text = invoice_items.invoice_id::text 
        AND (i.business_id IN (SELECT get_auth_business_ids()) OR i.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(i.business_id, i.business_company_id::text))
    ));

-- 8.9 Inventory & Batches (Strict Admin Write)
CREATE POLICY "inventory_select_policy" ON inventory
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "inventory_admin_write_policy" ON inventory
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "inventory_batches_select_policy" ON inventory_batches
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "inventory_batches_admin_write_policy" ON inventory_batches
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

-- 8.10 Purchases & Line Items (Strict Admin Write)
CREATE POLICY "purchases_select_policy" ON purchases
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "purchases_admin_write_policy" ON purchases
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "purchase_items_select_policy" ON purchase_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM purchases p WHERE p.id::text = purchase_items.purchase_id::text 
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
    ));

CREATE POLICY "purchase_items_admin_write_policy" ON purchase_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM purchases p WHERE p.id::text = purchase_items.purchase_id::text 
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(p.business_id, p.business_company_id::text))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM purchases p WHERE p.id::text = purchase_items.purchase_id::text 
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(p.business_id, p.business_company_id::text))
    ));

-- 8.11 Payments & Allocations (Salesperson Collection Insert, Admin Modify/Delete)
CREATE POLICY "payments_select_policy" ON payments
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "payments_insert_policy" ON payments
    FOR INSERT WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_salesperson(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "payments_admin_write_policy" ON payments
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "payment_allocations_select_policy" ON payment_allocations
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM payments p WHERE p.id::text = payment_allocations.payment_id::text
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
    ));

CREATE POLICY "payment_allocations_insert_policy" ON payment_allocations
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM payments p WHERE p.id::text = payment_allocations.payment_id::text
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_salesperson(COALESCE(p.business_id, p.business_company_id::text))
    ));

CREATE POLICY "payment_allocations_admin_write_policy" ON payment_allocations
    FOR ALL USING (EXISTS (
        SELECT 1 FROM payments p WHERE p.id::text = payment_allocations.payment_id::text
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(p.business_id, p.business_company_id::text))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM payments p WHERE p.id::text = payment_allocations.payment_id::text
        AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(p.business_id, p.business_company_id::text))
    ));

-- 8.12 Ledgers (Tenant Read, Admin Write Only)
CREATE POLICY "customer_ledger_select_policy" ON customer_ledger
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "customer_ledger_admin_write_policy" ON customer_ledger
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "stock_ledger_select_policy" ON stock_ledger
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "stock_ledger_admin_write_policy" ON stock_ledger
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

-- 8.13 Sales Returns & Line Items (Salesperson Log, Admin Modify/Delete)
CREATE POLICY "sales_returns_select_policy" ON sales_returns
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()));

CREATE POLICY "sales_returns_insert_policy" ON sales_returns
    FOR INSERT WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_salesperson(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "sales_returns_admin_write_policy" ON sales_returns
    FOR ALL USING (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    )
    WITH CHECK (
        (business_id IN (SELECT get_auth_business_ids()) OR business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(business_id, business_company_id::text))
    );

CREATE POLICY "sales_return_items_select_policy" ON sales_return_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM sales_returns sr WHERE sr.id::text = sales_return_items.return_id::text
        AND (sr.business_id IN (SELECT get_auth_business_ids()) OR sr.business_company_id::text IN (SELECT get_auth_business_ids()))
    ));

CREATE POLICY "sales_return_items_insert_policy" ON sales_return_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM sales_returns sr WHERE sr.id::text = sales_return_items.return_id::text
        AND (sr.business_id IN (SELECT get_auth_business_ids()) OR sr.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_salesperson(COALESCE(sr.business_id, sr.business_company_id::text))
    ));

CREATE POLICY "sales_return_items_admin_write_policy" ON sales_return_items
    FOR ALL USING (EXISTS (
        SELECT 1 FROM sales_returns sr WHERE sr.id::text = sales_return_items.return_id::text
        AND (sr.business_id IN (SELECT get_auth_business_ids()) OR sr.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(sr.business_id, sr.business_company_id::text))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM sales_returns sr WHERE sr.id::text = sales_return_items.return_id::text
        AND (sr.business_id IN (SELECT get_auth_business_ids()) OR sr.business_company_id::text IN (SELECT get_auth_business_ids()))
        AND is_business_admin(COALESCE(sr.business_id, sr.business_company_id::text))
    ));

-- 8.14 Immutable Audit Logs & Imports
CREATE POLICY "item_act_select_policy" ON item_activity_logs
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "item_act_insert_policy" ON item_activity_logs
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "inv_audits_select_policy" ON invoice_audits
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

CREATE POLICY "inv_audits_insert_policy" ON invoice_audits
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

CREATE POLICY "vyapar_admin_policy" ON vyapar_imports
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_business_admin(business_id));

-- 8.15 Migration Tracking Tables (Restricted to Admins & Service Role)
ALTER TABLE migration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON migration_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON migration_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON migration_sessions TO service_role, postgres;
GRANT ALL ON migration_audit_log TO service_role, postgres;

CREATE POLICY "migration_sessions_admin_policy" ON migration_sessions
    FOR ALL USING (is_saifee_admin())
    WITH CHECK (is_saifee_admin());

CREATE POLICY "migration_audit_log_admin_policy" ON migration_audit_log
    FOR ALL USING (is_saifee_admin())
    WITH CHECK (is_saifee_admin());

-- ---------------------------------------------------------------------
-- 9. SAFE & REPEATABLE REALTIME PUBLICATION SETUP
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_tbl TEXT;
    v_tables TEXT[] := ARRAY['orders', 'order_items', 'invoices', 'invoice_items', 'inventory', 'products', 'delivery_challans'];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH v_tbl IN ARRAY v_tables LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND tablename = v_tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', v_tbl);
                RAISE NOTICE 'Added table % to publication supabase_realtime.', v_tbl;
            ELSE
                RAISE NOTICE 'Table % already present in publication supabase_realtime. Skipped.', v_tbl;
            END IF;
        END LOOP;
        RAISE NOTICE 'Supabase Realtime publication configuration validated successfully.';
    ELSE
        RAISE WARNING 'Publication supabase_realtime does not exist; Realtime listeners must be manually enabled.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Realtime configuration warning: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

COMMIT;
