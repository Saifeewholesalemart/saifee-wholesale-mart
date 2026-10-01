-- Saifee General Stores FMCG Distribution Management System Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: System Settings
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Companies (FMCG Brands)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    gstin TEXT NOT NULL UNIQUE,
    address TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Retailers
CREATE TABLE retailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_code TEXT NOT NULL UNIQUE, -- e.g. RET-00125
    shop_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    address TEXT NOT NULL,
    state_code TEXT NOT NULL DEFAULT '27', -- default to Maharashtra
    gstin TEXT,
    mobile TEXT NOT NULL,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
    outstanding NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Profiles (User roles: admin, sales_dist, sales_co, retailer)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'sales_dist', 'sales_co', 'retailer')),
    company_id UUID REFERENCES companies(id), -- For company salesperson
    retailer_id UUID REFERENCES retailers(id), -- For retailer directly
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Categories (Admin-Managed FMCG Product Categories)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id),
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    sku TEXT,
    barcode TEXT,
    pack_size TEXT NOT NULL, -- e.g., "24 units/carton"
    trading_unit TEXT NOT NULL CHECK (trading_unit IN ('Box', 'Carton')),
    packing_display TEXT NOT NULL, -- e.g., "24 units / carton"
    units_per_box_carton INTEGER NOT NULL DEFAULT 1, -- e.g., 24
    mrp NUMERIC(10, 2) NOT NULL,
    selling_price NUMERIC(10, 2) NOT NULL, -- Distributor Selling Price
    purchase_price NUMERIC(10, 2) NOT NULL, -- Reference cost
    gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    hsn TEXT NOT NULL,
    image_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Product Categories (Many-to-Many junction between products and categories)
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, category_id)
);

CREATE INDEX idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);

-- Table: Inventory
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL UNIQUE REFERENCES products(id),
    physical_qty INTEGER NOT NULL DEFAULT 0, -- physical box/carton count
    reserved_qty INTEGER NOT NULL DEFAULT 0, -- reserved box/carton count
    available_qty INTEGER NOT NULL DEFAULT 0, -- available box/carton count (physical - reserved)
    damaged_qty INTEGER NOT NULL DEFAULT 0,
    expired_qty INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Inventory Batches
CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    mfg_date DATE,
    expiry_date DATE NOT NULL,
    purchase_rate NUMERIC(10, 2) NOT NULL,
    mrp NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0, -- box/carton count in this batch
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Stock Ledger (Audit log of all stock movements)
CREATE TABLE stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    change_qty INTEGER NOT NULL, -- positive or negative box/carton count
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    reason TEXT NOT NULL, -- e.g., 'Purchase', 'Sale', 'Sales Return', 'Damage', 'Adjustment'
    reference_id UUID, -- UUID of purchase_id, order_id, return_id, etc.
    user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    retailer_id UUID NOT NULL REFERENCES retailers(id),
    source TEXT NOT NULL CHECK (source IN ('distributor_salesperson', 'company_salesperson', 'retailer_direct', 'counter_sale')),
    created_by UUID REFERENCES profiles(id),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Confirmed', 'Partially Confirmed', 'Packing', 'Ready for Dispatch', 'Dispatched', 'Delivered', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL, -- ordered count (in Box/Carton units)
    trading_unit TEXT NOT NULL CHECK (trading_unit IN ('Box', 'Carton')),
    base_price NUMERIC(10, 2) NOT NULL, -- rate per Box/Carton at order time
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- discount per Box/Carton
    final_price NUMERIC(10, 2) NOT NULL, -- final rate (base_price - discount)
    gst_percent NUMERIC(5, 2) NOT NULL,
    gst_amount NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    catalogue_rate_at_order NUMERIC(10, 2), -- Original catalogue price at order placement
    order_time_rate NUMERIC(10, 2), -- Rate saved at the time of order placement
    manual_billing_rate NUMERIC(10, 2), -- Optional admin manual billing rate override
    final_applied_rate NUMERIC(10, 2), -- Final rate applied after priority resolution
    manual_rate_applied BOOLEAN DEFAULT FALSE,
    manual_rate_updated_by UUID REFERENCES profiles(id),
    manual_rate_updated_at TIMESTAMP WITH TIME ZONE,
    manual_rate_reason TEXT
);

-- Table: Fulfilments (For order consolidations)
CREATE TABLE fulfilments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL REFERENCES retailers(id),
    fulfilment_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('Packing', 'Ready for Dispatch', 'Dispatched', 'Delivered', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Fulfilment Items (Traceable link to original order items)
CREATE TABLE fulfilment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fulfilment_id UUID NOT NULL REFERENCES fulfilments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    original_qty INTEGER NOT NULL,
    confirmed_qty INTEGER NOT NULL,
    pending_qty INTEGER NOT NULL,
    manual_billing_rate NUMERIC(10, 2),
    manual_rate_applied BOOLEAN DEFAULT FALSE,
    manual_rate_updated_by UUID REFERENCES profiles(id),
    manual_rate_updated_at TIMESTAMP WITH TIME ZONE,
    manual_rate_reason TEXT
);

-- Table: Invoices (GST Invoices)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE, -- Configurable invoice code format
    retailer_id UUID NOT NULL REFERENCES retailers(id),
    order_ref_id UUID, -- References orders(id) or fulfilments(id)
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    place_of_supply TEXT NOT NULL,
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
    has_manual_rates BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Invoice Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    hsn TEXT NOT NULL,
    packing TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    trading_unit TEXT NOT NULL CHECK (trading_unit IN ('Box', 'Carton')),
    rate NUMERIC(10, 2) NOT NULL, -- Final applied rate before discount
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    taxable_value NUMERIC(12, 2) NOT NULL,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    catalogue_rate NUMERIC(10, 2),
    order_time_rate NUMERIC(10, 2),
    manual_billing_rate NUMERIC(10, 2),
    manual_rate_applied BOOLEAN DEFAULT FALSE,
    manual_rate_reason TEXT
);

-- Table: Purchases (Incoming Stock)
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Confirmed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Purchase Items
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    trading_unit TEXT NOT NULL CHECK (trading_unit IN ('Box', 'Carton')),
    purchase_rate NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    free_quantity INTEGER NOT NULL DEFAULT 0,
    mrp NUMERIC(10, 2) NOT NULL,
    gst_percent NUMERIC(5, 2) NOT NULL,
    hsn TEXT NOT NULL,
    batch TEXT NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE NOT NULL
);

-- Table: Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL REFERENCES retailers(id),
    payment_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
    reference_number TEXT,
    notes TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Payment Allocations
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount_allocated NUMERIC(12, 2) NOT NULL
);

-- Table: Sales Returns
CREATE TABLE sales_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    return_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed'
);

-- Table: Sales Return Items
CREATE TABLE sales_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    trading_unit TEXT NOT NULL CHECK (trading_unit IN ('Box', 'Carton')),
    rate NUMERIC(10, 2) NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('Sellable', 'Damaged'))
);

-- Table: Purchase Returns
CREATE TABLE purchase_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id),
    return_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed'
);

-- Table: Purchase Return Items
CREATE TABLE purchase_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    trading_unit TEXT NOT NULL CHECK (trading_unit IN ('Box', 'Carton')),
    rate NUMERIC(10, 2) NOT NULL
);

-- Table: Product Supplier Aliases (For AI Product matching memory)
CREATE TABLE product_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    alias_name TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    UNIQUE(supplier_id, alias_name)
);

-- Table: AI Purchase Imports (OCR Staging Area)
CREATE TABLE ai_purchase_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_name TEXT,
    supplier_gstin TEXT,
    invoice_number TEXT,
    invoice_date DATE,
    total_amount NUMERIC(12, 2),
    status TEXT NOT NULL CHECK (status IN ('Pending_Verification', 'Confirmed')),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: AI Purchase Import Items
CREATE TABLE ai_purchase_import_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES ai_purchase_imports(id) ON DELETE CASCADE,
    extracted_name TEXT NOT NULL,
    matched_product_id UUID REFERENCES products(id),
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

-- Table: Billing Rate Audit Logs (Audit trail for admin manual rate changes)
CREATE TABLE billing_rate_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    fulfilment_id UUID REFERENCES fulfilments(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    retailer_id UUID NOT NULL REFERENCES retailers(id),
    product_id UUID NOT NULL REFERENCES products(id),
    catalogue_rate NUMERIC(10, 2) NOT NULL,
    order_time_rate NUMERIC(10, 2) NOT NULL,
    manual_billing_rate NUMERIC(10, 2) NOT NULL,
    final_applied_rate NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    admin_user_id UUID REFERENCES profiles(id),
    admin_user_name TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rate_audit_retailer_product ON billing_rate_audit_logs(retailer_id, product_id);
CREATE INDEX idx_invoice_items_history ON invoice_items(product_id);

-- Function: Get Last 5 Billing Rates for a Retailer and Exact Product Variant
CREATE OR REPLACE FUNCTION get_last_5_billing_rates(
    p_retailer_id UUID,
    p_product_id UUID,
    p_trading_unit TEXT DEFAULT NULL
)
RETURNS TABLE (
    invoice_id UUID,
    invoice_number TEXT,
    order_number TEXT,
    billing_date TIMESTAMP WITH TIME ZONE,
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
        COALESCE(o.order_number, f.fulfilment_number, 'POS-SALE') AS order_number,
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

