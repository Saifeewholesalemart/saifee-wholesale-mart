-- =====================================================================
-- Migration 008: Cloud-First Architecture, Missing Tables & Text ID Compatibility
-- Saifee General Stores FMCG Wholesale Distribution & Trade ERP
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS & ID HELPER
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. DEPENDENCY-AWARE CONVERSION OF EXISTING EMPTY TABLES: UUID -> TEXT
-- ---------------------------------------------------------------------
-- The production database contains 0 rows in transactional & catalog tables,
-- but the original schema defined `id UUID` whereas the PWA, IndexedDB snapshot,
-- and Vyapar imports use deterministic String IDs (e.g. 'c-joy', 'p-1709210001', 'ret-001').
-- In PostgreSQL, type conversion requires dropping referencing foreign keys,
-- altering the columns to TEXT with `gen_random_uuid()::text` default,
-- and recreating foreign key constraints with ON UPDATE CASCADE.

DO $$ 
BEGIN
    -- 2.1 Drop existing foreign key constraints on existing tables if present
    ALTER TABLE IF EXISTS profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;
    ALTER TABLE IF EXISTS profiles DROP CONSTRAINT IF EXISTS profiles_retailer_id_fkey;
    ALTER TABLE IF EXISTS company_members DROP CONSTRAINT IF EXISTS company_members_company_id_fkey;
    ALTER TABLE IF EXISTS company_members DROP CONSTRAINT IF EXISTS company_members_user_id_fkey;
    ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_company_id_fkey;
    ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_business_company_id_fkey;
    ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_parent_product_id_fkey;
    ALTER TABLE IF EXISTS product_categories DROP CONSTRAINT IF EXISTS product_categories_product_id_fkey;
    ALTER TABLE IF EXISTS product_categories DROP CONSTRAINT IF EXISTS product_categories_category_id_fkey;
    ALTER TABLE IF EXISTS inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
    ALTER TABLE IF EXISTS inventory_batches DROP CONSTRAINT IF EXISTS inventory_batches_product_id_fkey;
    ALTER TABLE IF EXISTS stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_product_id_fkey;
    ALTER TABLE IF EXISTS stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_user_id_fkey;
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_retailer_id_fkey;
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_created_by_fkey;
    ALTER TABLE IF EXISTS order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
    ALTER TABLE IF EXISTS order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
    ALTER TABLE IF EXISTS fulfilments DROP CONSTRAINT IF EXISTS fulfilments_retailer_id_fkey;
    ALTER TABLE IF EXISTS fulfilment_items DROP CONSTRAINT IF EXISTS fulfilment_items_fulfilment_id_fkey;
    ALTER TABLE IF EXISTS fulfilment_items DROP CONSTRAINT IF EXISTS fulfilment_items_order_item_id_fkey;
    ALTER TABLE IF EXISTS fulfilment_items DROP CONSTRAINT IF EXISTS fulfilment_items_product_id_fkey;
    ALTER TABLE IF EXISTS invoices DROP CONSTRAINT IF EXISTS invoices_retailer_id_fkey;
    ALTER TABLE IF EXISTS invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
    ALTER TABLE IF EXISTS invoice_items DROP CONSTRAINT IF EXISTS invoice_items_product_id_fkey;
    ALTER TABLE IF EXISTS purchases DROP CONSTRAINT IF EXISTS purchases_supplier_id_fkey;
    ALTER TABLE IF EXISTS purchase_items DROP CONSTRAINT IF EXISTS purchase_items_purchase_id_fkey;
    ALTER TABLE IF EXISTS purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey;
    ALTER TABLE IF EXISTS payments DROP CONSTRAINT IF EXISTS payments_retailer_id_fkey;
    ALTER TABLE IF EXISTS payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_payment_id_fkey;
    ALTER TABLE IF EXISTS payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_invoice_id_fkey;
    ALTER TABLE IF EXISTS sales_returns DROP CONSTRAINT IF EXISTS sales_returns_invoice_id_fkey;
    ALTER TABLE IF EXISTS sales_return_items DROP CONSTRAINT IF EXISTS sales_return_items_sales_return_id_fkey;
    ALTER TABLE IF EXISTS sales_return_items DROP CONSTRAINT IF EXISTS sales_return_items_product_id_fkey;
    ALTER TABLE IF EXISTS customer_ledger DROP CONSTRAINT IF EXISTS customer_ledger_retailer_id_fkey;
    ALTER TABLE IF EXISTS customer_ledger DROP CONSTRAINT IF EXISTS customer_ledger_created_by_fkey;

    -- 2.2 Convert Primary Key & Referenced Columns to TEXT (Default: gen_random_uuid()::text)
    -- Companies & Tenants
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE companies ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE companies ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_companies' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE business_companies ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE business_companies ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;

    -- Suppliers & Retailers
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE suppliers ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE suppliers ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retailers' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE retailers ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE retailers ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;

    -- Profiles
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE profiles ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE profiles ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
        ALTER TABLE profiles ALTER COLUMN retailer_id TYPE TEXT USING retailer_id::TEXT;
    END IF;

    -- Categories
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE categories ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;

    -- Products & Product Categories
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE products ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE products ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE products ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
        ALTER TABLE products ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
        ALTER TABLE products ALTER COLUMN parent_product_id TYPE TEXT USING parent_product_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') THEN
        ALTER TABLE product_categories ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE product_categories ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
        ALTER TABLE product_categories ALTER COLUMN category_id TYPE TEXT USING category_id::TEXT;
    END IF;

    -- Inventory & Batches
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE inventory ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE inventory ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE inventory ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
        ALTER TABLE inventory ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
        ALTER TABLE inventory ALTER COLUMN godown_id TYPE TEXT USING godown_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_batches' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE inventory_batches ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE inventory_batches ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE inventory_batches ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
        ALTER TABLE inventory_batches ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
        ALTER TABLE inventory_batches ALTER COLUMN godown_id TYPE TEXT USING godown_id::TEXT;
    END IF;

    -- Orders & Order Items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE orders ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE orders ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE orders ALTER COLUMN retailer_id TYPE TEXT USING retailer_id::TEXT;
        ALTER TABLE orders ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
        ALTER TABLE orders ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE order_items ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE order_items ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE order_items ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT;
        ALTER TABLE order_items ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
    END IF;

    -- Invoices & Invoice Items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE invoices ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE invoices ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE invoices ALTER COLUMN retailer_id TYPE TEXT USING retailer_id::TEXT;
        ALTER TABLE invoices ALTER COLUMN order_ref_id TYPE TEXT USING order_ref_id::TEXT;
        ALTER TABLE invoices ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE invoice_items ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE invoice_items ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE invoice_items ALTER COLUMN invoice_id TYPE TEXT USING invoice_id::TEXT;
        ALTER TABLE invoice_items ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
    END IF;

    -- Purchases & Purchase Items
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE purchases ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE purchases ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE purchases ALTER COLUMN supplier_id TYPE TEXT USING supplier_id::TEXT;
        ALTER TABLE purchases ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE purchase_items ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE purchase_items ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE purchase_items ALTER COLUMN purchase_id TYPE TEXT USING purchase_id::TEXT;
        ALTER TABLE purchase_items ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
    END IF;

    -- Payments & Customer Ledger
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE payments ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE payments ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE payments ALTER COLUMN retailer_id TYPE TEXT USING retailer_id::TEXT;
        ALTER TABLE payments ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_ledger') THEN
        ALTER TABLE customer_ledger ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE customer_ledger ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE customer_ledger ALTER COLUMN business_company_id TYPE TEXT USING business_company_id::TEXT;
        ALTER TABLE customer_ledger ALTER COLUMN retailer_id TYPE TEXT USING retailer_id::TEXT;
        ALTER TABLE customer_ledger ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;
        ALTER TABLE customer_ledger ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
    END IF;

    -- Reconcile Pre-Existing Company Record 'JOY' with Canonical String ID 'c-joy'
    UPDATE companies 
    SET id = 'c-joy' 
    WHERE code = 'JOY' AND id != 'c-joy';

    -- 2.3 Recreate Foreign Key Constraints with String/Text Type Compatibility
    ALTER TABLE profiles 
        ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL,
        ADD CONSTRAINT profiles_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON UPDATE CASCADE ON DELETE SET NULL;

    ALTER TABLE products 
        ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE;

    ALTER TABLE inventory 
        ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

    ALTER TABLE inventory_batches 
        ADD CONSTRAINT inventory_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

    ALTER TABLE orders 
        ADD CONSTRAINT orders_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON UPDATE CASCADE;

    ALTER TABLE order_items 
        ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
        ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE;

    ALTER TABLE invoices 
        ADD CONSTRAINT invoices_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON UPDATE CASCADE;

    ALTER TABLE invoice_items 
        ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE CASCADE,
        ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE;

    ALTER TABLE purchases 
        ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE CASCADE;

    ALTER TABLE purchase_items 
        ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE CASCADE,
        ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE;

END $$;

-- ---------------------------------------------------------------------
-- 3. ENSURE COMPANY_MEMBERS TABLE HAS BOTH company_id AND business_id
-- ---------------------------------------------------------------------
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_members') THEN
        ALTER TABLE company_members ALTER COLUMN id TYPE TEXT USING id::TEXT;
        ALTER TABLE company_members ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        ALTER TABLE company_members ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
        ALTER TABLE company_members ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
        
        -- Add business_id column if not present, and backfill from company_id
        ALTER TABLE company_members ADD COLUMN IF NOT EXISTS business_id TEXT;
        UPDATE company_members SET business_id = company_id WHERE business_id IS NULL AND company_id IS NOT NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. CREATE MISSING CORE TABLES
-- ---------------------------------------------------------------------

-- 4.1 Godowns (Multi-Warehouse Master)
CREATE TABLE IF NOT EXISTS godowns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    company_id TEXT, -- compatibility alias for business_id
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT DEFAULT 'Maharashtra',
    pincode TEXT,
    manager_name TEXT,
    phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_godowns_business_id ON godowns(business_id);
CREATE INDEX IF NOT EXISTS idx_godowns_code ON godowns(code);

-- 4.2 Stock Transfers Header & Line Items
CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    company_id TEXT,
    transfer_number TEXT NOT NULL UNIQUE,
    from_godown_id TEXT NOT NULL REFERENCES godowns(id),
    to_godown_id TEXT NOT NULL REFERENCES godowns(id),
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Requested', 'Approved', 'Dispatched', 'Received', 'Completed', 'Cancelled')),
    requested_by TEXT,
    approved_by TEXT,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_biz ON stock_transfers(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    batch_id TEXT,
    batch_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    carton_qty INTEGER DEFAULT 0,
    loose_qty INTEGER DEFAULT 0,
    received_qty INTEGER DEFAULT 0,
    received_carton_qty INTEGER DEFAULT 0,
    received_loose_qty INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_st_items_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_st_items_product ON stock_transfer_items(product_id);

-- 4.3 Delivery Challans Header & Items
CREATE TABLE IF NOT EXISTS delivery_challans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    challan_number TEXT NOT NULL UNIQUE,
    order_id TEXT,
    order_number TEXT,
    fulfilment_id TEXT,
    retailer_id TEXT NOT NULL REFERENCES retailers(id),
    invoice_id TEXT,
    invoice_number TEXT,
    dispatch_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transport_mode TEXT,
    vehicle_number TEXT,
    delivery_person TEXT,
    notes TEXT,
    total_quantity INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_challans_biz ON delivery_challans(business_id);
CREATE INDEX IF NOT EXISTS idx_challans_retailer ON delivery_challans(retailer_id);
CREATE INDEX IF NOT EXISTS idx_challans_order ON delivery_challans(order_id);

CREATE TABLE IF NOT EXISTS delivery_challan_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    challan_id TEXT NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
    order_item_id TEXT,
    product_id TEXT NOT NULL REFERENCES products(id),
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

CREATE INDEX IF NOT EXISTS idx_dc_items_challan ON delivery_challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_dc_items_product ON delivery_challan_items(product_id);

-- 4.4 Cash Flow Transactions & Company Opening Balances
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

CREATE INDEX IF NOT EXISTS idx_cf_biz ON cash_flow_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_cf_date ON cash_flow_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_type ON cash_flow_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cf_party ON cash_flow_transactions(party_id);

CREATE TABLE IF NOT EXISTS company_opening_balances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL UNIQUE,
    company_id TEXT,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode_balances JSONB DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opening_bal_biz ON company_opening_balances(business_id);

-- 4.5 Item Activity Logs & Invoice Audits
CREATE TABLE IF NOT EXISTS item_activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reference_id TEXT,
    user_id TEXT,
    user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_act_biz ON item_activity_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_item_act_prod ON item_activity_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_item_act_created ON item_activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_audits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    business_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    retailer_id TEXT NOT NULL REFERENCES retailers(id),
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

CREATE INDEX IF NOT EXISTS idx_inv_audits_biz ON invoice_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_inv_audits_inv ON invoice_audits(invoice_id);

-- 4.6 Vyapar Excel/CSV Import History & Audit Table
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

CREATE INDEX IF NOT EXISTS idx_vyapar_biz ON vyapar_imports(business_id);
CREATE INDEX IF NOT EXISTS idx_vyapar_imported_at ON vyapar_imports(imported_at DESC);

-- ---------------------------------------------------------------------
-- 5. ALIGN EXISTING TABLES WITH FMCG COLUMNS & INDEXES
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

UPDATE products SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_biz ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Retailers Table
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS beat_name TEXT;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12, 2) DEFAULT 0.00;

UPDATE retailers SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retailers_biz ON retailers(business_id);
CREATE INDEX IF NOT EXISTS idx_retailers_code ON retailers(retailer_code);

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

UPDATE orders SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_biz ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC);

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

UPDATE invoices SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_biz ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date DESC);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;

-- Purchases Table & Items
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receiving_godown_id TEXT;

UPDATE purchases SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_biz ON purchases(business_id);

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

UPDATE inventory SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
UPDATE inventory_batches SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_biz ON inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_batches_biz ON inventory_batches(business_id);

-- Other Entities (Suppliers, Categories, Payments, Ledger)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE customer_ledger ADD COLUMN IF NOT EXISTS business_id TEXT;

UPDATE suppliers SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
UPDATE categories SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
UPDATE payments SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;
UPDATE customer_ledger SET business_id = business_company_id::text WHERE business_id IS NULL AND business_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_biz ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_biz ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_biz ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_cust_ledger_biz ON customer_ledger(business_id);

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & EXPLICIT POLICIES
-- ---------------------------------------------------------------------

-- 6.1 Function: Get authorized business IDs for the currently executing JWT user
CREATE OR REPLACE FUNCTION get_auth_business_ids()
RETURNS TABLE (business_id TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT COALESCE(cm.business_id, cm.company_id)::TEXT
    FROM company_members cm
    JOIN profiles p ON p.id::TEXT = cm.user_id::TEXT
    WHERE cm.status = 'active'
      AND (
          p.id::TEXT = auth.uid()::TEXT 
          OR p.email = COALESCE(auth.jwt() ->> 'email', '')
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 6.2 Function: Check if active user is an admin
CREATE OR REPLACE FUNCTION is_saifee_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE (id::TEXT = auth.uid()::TEXT OR email = COALESCE(auth.jwt() ->> 'email', ''))
          AND role = 'admin'
          AND active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 6.3 Enable RLS on ALL tables across the application
ALTER TABLE business_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE godowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_opening_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE vyapar_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;

-- 6.4 Comprehensive Table Policies with Explicit SELECT, INSERT, UPDATE, DELETE

-- Godowns
DROP POLICY IF EXISTS "godowns_select_policy" ON godowns;
CREATE POLICY "godowns_select_policy" ON godowns
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "godowns_insert_policy" ON godowns;
CREATE POLICY "godowns_insert_policy" ON godowns
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

DROP POLICY IF EXISTS "godowns_update_policy" ON godowns;
CREATE POLICY "godowns_update_policy" ON godowns
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin())
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

DROP POLICY IF EXISTS "godowns_delete_policy" ON godowns;
CREATE POLICY "godowns_delete_policy" ON godowns
    FOR DELETE USING (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

-- Stock Transfers & Items
DROP POLICY IF EXISTS "st_select_policy" ON stock_transfers;
CREATE POLICY "st_select_policy" ON stock_transfers
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "st_insert_policy" ON stock_transfers;
CREATE POLICY "st_insert_policy" ON stock_transfers
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "st_update_policy" ON stock_transfers;
CREATE POLICY "st_update_policy" ON stock_transfers
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "st_delete_policy" ON stock_transfers;
CREATE POLICY "st_delete_policy" ON stock_transfers
    FOR DELETE USING (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

DROP POLICY IF EXISTS "st_items_select_policy" ON stock_transfer_items;
CREATE POLICY "st_items_select_policy" ON stock_transfer_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM stock_transfers st 
        WHERE st.id = stock_transfer_items.transfer_id 
          AND st.business_id IN (SELECT get_auth_business_ids())
    ));

DROP POLICY IF EXISTS "st_items_insert_policy" ON stock_transfer_items;
CREATE POLICY "st_items_insert_policy" ON stock_transfer_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM stock_transfers st 
        WHERE st.id = stock_transfer_items.transfer_id 
          AND st.business_id IN (SELECT get_auth_business_ids())
    ));

DROP POLICY IF EXISTS "st_items_update_policy" ON stock_transfer_items;
CREATE POLICY "st_items_update_policy" ON stock_transfer_items
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM stock_transfers st 
        WHERE st.id = stock_transfer_items.transfer_id 
          AND st.business_id IN (SELECT get_auth_business_ids())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM stock_transfers st 
        WHERE st.id = stock_transfer_items.transfer_id 
          AND st.business_id IN (SELECT get_auth_business_ids())
    ));

-- Delivery Challans & Items
DROP POLICY IF EXISTS "dc_select_policy" ON delivery_challans;
CREATE POLICY "dc_select_policy" ON delivery_challans
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "dc_insert_policy" ON delivery_challans;
CREATE POLICY "dc_insert_policy" ON delivery_challans
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "dc_update_policy" ON delivery_challans;
CREATE POLICY "dc_update_policy" ON delivery_challans
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "dc_items_select_policy" ON delivery_challan_items;
CREATE POLICY "dc_items_select_policy" ON delivery_challan_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM delivery_challans dc 
        WHERE dc.id = delivery_challan_items.challan_id 
          AND dc.business_id IN (SELECT get_auth_business_ids())
    ));

DROP POLICY IF EXISTS "dc_items_insert_policy" ON delivery_challan_items;
CREATE POLICY "dc_items_insert_policy" ON delivery_challan_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM delivery_challans dc 
        WHERE dc.id = delivery_challan_items.challan_id 
          AND dc.business_id IN (SELECT get_auth_business_ids())
    ));

DROP POLICY IF EXISTS "dc_items_update_policy" ON delivery_challan_items;
CREATE POLICY "dc_items_update_policy" ON delivery_challan_items
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM delivery_challans dc 
        WHERE dc.id = delivery_challan_items.challan_id 
          AND dc.business_id IN (SELECT get_auth_business_ids())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM delivery_challans dc 
        WHERE dc.id = delivery_challan_items.challan_id 
          AND dc.business_id IN (SELECT get_auth_business_ids())
    ));

-- Cash Flow Transactions
DROP POLICY IF EXISTS "cf_select_policy" ON cash_flow_transactions;
CREATE POLICY "cf_select_policy" ON cash_flow_transactions
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "cf_insert_policy" ON cash_flow_transactions;
CREATE POLICY "cf_insert_policy" ON cash_flow_transactions
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "cf_update_policy" ON cash_flow_transactions;
CREATE POLICY "cf_update_policy" ON cash_flow_transactions
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

-- Company Opening Balances
DROP POLICY IF EXISTS "cob_select_policy" ON company_opening_balances;
CREATE POLICY "cob_select_policy" ON company_opening_balances
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "cob_write_policy" ON company_opening_balances;
CREATE POLICY "cob_write_policy" ON company_opening_balances
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin())
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

-- Products
DROP POLICY IF EXISTS "products_select_policy" ON products;
CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "products_insert_policy" ON products;
CREATE POLICY "products_insert_policy" ON products
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

DROP POLICY IF EXISTS "products_update_policy" ON products;
CREATE POLICY "products_update_policy" ON products
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin())
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

-- Retailers
DROP POLICY IF EXISTS "retailers_select_policy" ON retailers;
CREATE POLICY "retailers_select_policy" ON retailers
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "retailers_write_policy" ON retailers;
CREATE POLICY "retailers_write_policy" ON retailers
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()));

-- Orders & Order Items
DROP POLICY IF EXISTS "orders_select_policy" ON orders;
CREATE POLICY "orders_select_policy" ON orders
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
CREATE POLICY "orders_insert_policy" ON orders
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "orders_update_policy" ON orders;
CREATE POLICY "orders_update_policy" ON orders
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "order_items_select_policy" ON order_items;
CREATE POLICY "order_items_select_policy" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.id = order_items.order_id 
          AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id IN (SELECT get_auth_business_ids()))
    ));

DROP POLICY IF EXISTS "order_items_insert_policy" ON order_items;
CREATE POLICY "order_items_insert_policy" ON order_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.id = order_items.order_id 
          AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id IN (SELECT get_auth_business_ids()))
    ));

DROP POLICY IF EXISTS "order_items_update_policy" ON order_items;
CREATE POLICY "order_items_update_policy" ON order_items
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.id = order_items.order_id 
          AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id IN (SELECT get_auth_business_ids()))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.id = order_items.order_id 
          AND (o.business_id IN (SELECT get_auth_business_ids()) OR o.business_company_id IN (SELECT get_auth_business_ids()))
    ));

-- Invoices & Invoice Items
DROP POLICY IF EXISTS "invoices_select_policy" ON invoices;
CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "invoices_insert_policy" ON invoices;
CREATE POLICY "invoices_insert_policy" ON invoices
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;
CREATE POLICY "invoices_update_policy" ON invoices
    FOR UPDATE USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()))
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "invoice_items_select_policy" ON invoice_items;
CREATE POLICY "invoice_items_select_policy" ON invoice_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.id = invoice_items.invoice_id 
          AND (i.business_id IN (SELECT get_auth_business_ids()) OR i.business_company_id IN (SELECT get_auth_business_ids()))
    ));

DROP POLICY IF EXISTS "invoice_items_insert_policy" ON invoice_items;
CREATE POLICY "invoice_items_insert_policy" ON invoice_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.id = invoice_items.invoice_id 
          AND (i.business_id IN (SELECT get_auth_business_ids()) OR i.business_company_id IN (SELECT get_auth_business_ids()))
    ));

-- Inventory & Batches
DROP POLICY IF EXISTS "inventory_select_policy" ON inventory;
CREATE POLICY "inventory_select_policy" ON inventory
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "inventory_batches_select_policy" ON inventory_batches;
CREATE POLICY "inventory_batches_select_policy" ON inventory_batches
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

-- Purchases & Purchase Items
DROP POLICY IF EXISTS "purchases_select_policy" ON purchases;
CREATE POLICY "purchases_select_policy" ON purchases
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()) OR business_company_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "purchases_insert_policy" ON purchases;
CREATE POLICY "purchases_insert_policy" ON purchases
    FOR INSERT WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

DROP POLICY IF EXISTS "purchase_items_select_policy" ON purchase_items;
CREATE POLICY "purchase_items_select_policy" ON purchase_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM purchases p 
        WHERE p.id = purchase_items.purchase_id 
          AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id IN (SELECT get_auth_business_ids()))
    ));

DROP POLICY IF EXISTS "purchase_items_insert_policy" ON purchase_items;
CREATE POLICY "purchase_items_insert_policy" ON purchase_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM purchases p 
        WHERE p.id = purchase_items.purchase_id 
          AND (p.business_id IN (SELECT get_auth_business_ids()) OR p.business_company_id IN (SELECT get_auth_business_ids()))
    ));

-- Item Activity Logs, Invoice Audits & Vyapar Imports
DROP POLICY IF EXISTS "item_act_select_policy" ON item_activity_logs;
CREATE POLICY "item_act_select_policy" ON item_activity_logs
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "inv_audits_select_policy" ON invoice_audits;
CREATE POLICY "inv_audits_select_policy" ON invoice_audits
    FOR SELECT USING (business_id IN (SELECT get_auth_business_ids()));

DROP POLICY IF EXISTS "vyapar_admin_policy" ON vyapar_imports;
CREATE POLICY "vyapar_admin_policy" ON vyapar_imports
    FOR ALL USING (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin())
    WITH CHECK (business_id IN (SELECT get_auth_business_ids()) AND is_saifee_admin());

-- ---------------------------------------------------------------------
-- 7. REALTIME PUBLICATION SETUP
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
        ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
        ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
        ALTER PUBLICATION supabase_realtime ADD TABLE invoice_items;
        ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
        ALTER PUBLICATION supabase_realtime ADD TABLE delivery_challans;
        ALTER PUBLICATION supabase_realtime ADD TABLE cash_flow_transactions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore duplicate table addition to publication
    NULL;
END $$;
