-- =====================================================================
-- Migration 006: FMCG Multi-UOM, Base Unit Inventory, Ledger & ACID RPCs
-- Saifee General Stores FMCG Distribution Management System
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTEND PRODUCTS TABLE WITH MULTI-UOM & LOOSE UNIT PACKAGING
-- ---------------------------------------------------------------------

-- Drop restrictive check on trading_unit to allow full FMCG range
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_trading_unit_check;
ALTER TABLE products ADD CONSTRAINT products_trading_unit_check 
    CHECK (trading_unit IN ('Box', 'Carton', 'Case', 'Bag', 'Bundle', 'Dozen', 'Tin', 'Other'));

-- Multi-UOM columns for dual packaging (Trading Unit vs. Base Unit)
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_unit TEXT NOT NULL DEFAULT 'Piece';
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_trading_unit INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_loose_sale BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_mrp NUMERIC(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_selling_price NUMERIC(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_purchase_price NUMERIC(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS carton_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS loose_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_tracking_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_tracking_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_attribute TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_value TEXT;

-- Backfill units_per_trading_unit from units_per_box_carton
UPDATE products 
SET units_per_trading_unit = COALESCE(units_per_box_carton, 1)
WHERE units_per_trading_unit IS NULL OR units_per_trading_unit = 1;

-- Backfill loose pricing if null
UPDATE products 
SET loose_mrp = ROUND(mrp / GREATEST(1, units_per_trading_unit), 2),
    loose_selling_price = ROUND(selling_price / GREATEST(1, units_per_trading_unit), 2),
    loose_purchase_price = ROUND(purchase_price / GREATEST(1, units_per_trading_unit), 2)
WHERE loose_selling_price IS NULL;

-- ---------------------------------------------------------------------
-- 2. STANDARDIZE INVENTORY & BATCHES TO BASE UNITS (ATOMIC INTEGERS)
-- ---------------------------------------------------------------------

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS godown_id UUID;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS damaged_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expired_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pending_qty INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN inventory.physical_qty IS 'Total physical stock count strictly in lowest atomic Base Units (pieces/packets/bottles)';
COMMENT ON COLUMN inventory.reserved_qty IS 'Allocated/reserved stock count strictly in Base Units';
COMMENT ON COLUMN inventory.available_qty IS 'Available stock for sale (physical_qty - reserved_qty) in Base Units';

-- Inventory Batches Extended Columns
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS godown_id UUID;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS godown_name TEXT;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10, 2);
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS loose_selling_price NUMERIC(10, 2);
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS entry_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS cost_layer TEXT;

COMMENT ON COLUMN inventory_batches.quantity IS 'Batch stock balance strictly in lowest atomic Base Units';

-- Stock Ledger Extended Columns
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS godown_id UUID;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS previous_qty INTEGER;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS new_qty INTEGER;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN stock_ledger.change_qty IS 'Stock delta count strictly in lowest atomic Base Units';

-- ---------------------------------------------------------------------
-- 3. EXTEND ORDER & INVOICE ITEMS WITH DUAL PACKAGING UOM COLUMNS
-- ---------------------------------------------------------------------

-- Order Items
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_trading_unit_check;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'Piece';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS units_per_trading_unit INTEGER DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS units_per_box_carton INTEGER DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS carton_qty INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS loose_qty INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS base_qty INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS carton_rate NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS loose_rate NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS carton_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS loose_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_mrp NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS confirmed_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packed_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dispatched_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivered_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pending_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_qty INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pending_reason TEXT;

-- Invoice Items
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_trading_unit_check;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'Piece';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS units_per_trading_unit INTEGER DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS units_per_box_carton INTEGER DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS carton_qty INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS loose_qty INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS base_qty INTEGER DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS carton_rate NUMERIC(10, 2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS loose_rate NUMERIC(10, 2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS carton_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS loose_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(10, 2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(10, 2);

-- Invoices Header Extensions
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_order_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_order_numbers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fulfilment_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Credit';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_edited_by TEXT;

-- ---------------------------------------------------------------------
-- 4. CREATE FINANCIAL CUSTOMER LEDGER TABLE (DOUBLE-ENTRY AUDIT)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_company_id UUID NOT NULL REFERENCES business_companies(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    category TEXT NOT NULL CHECK (category IN (
        'SALES_INVOICE', 
        'PAYMENT_RECEIVED', 
        'SALES_RETURN', 
        'OPENING_BALANCE', 
        'MANUAL_JOURNAL', 
        'DISCOUNT_CREDIT', 
        'BAD_DEBT_WRITEOFF'
    )),
    reference_number TEXT NOT NULL, -- e.g. INV/2026-27/00125, PAY-2026-00042
    reference_id UUID, -- invoice_id, payment_id, sales_return_id
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    running_balance NUMERIC(12, 2) NOT NULL, -- retailer outstanding debt balance after this entry
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_retailer ON customer_ledger(retailer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_company ON customer_ledger(business_company_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_date ON customer_ledger(date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_ref ON customer_ledger(reference_number);

-- Enable RLS on customer_ledger
ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access customer ledger of their active company" ON customer_ledger
    FOR ALL USING (is_member_of_company(business_company_id));

-- ---------------------------------------------------------------------
-- 5. FUNCTION: GET CUSTOMER CREDIT PROFILE & OVERDUE AGEING
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_customer_credit_profile(
    p_retailer_id UUID,
    p_company_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_retailer RECORD;
    v_unpaid_invoices RECORD;
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
    -- 1. Fetch Retailer Details
    SELECT * INTO v_retailer 
    FROM retailers 
    WHERE id = p_retailer_id 
      AND (business_company_id = p_company_id OR business_company_id IS NULL);

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'found', FALSE,
            'error', 'Customer not found'
        );
    END IF;

    v_credit_limit := COALESCE(v_retailer.credit_limit, 50000.00);
    v_total_outstanding := COALESCE(v_retailer.outstanding, 0.00);

    -- 2. Scan and calculate age buckets for all unpaid/partially paid invoices
    FOR v_unpaid_invoices IN 
        SELECT 
            id,
            invoice_number,
            date,
            grand_total,
            outstanding_amount,
            EXTRACT(DAY FROM (CURRENT_TIMESTAMP - date))::INTEGER AS age_days
        FROM invoices
        WHERE retailer_id = p_retailer_id
          AND business_company_id = p_company_id
          AND outstanding_amount > 0.01
        ORDER BY date ASC
    LOOP
        v_unpaid_count := v_unpaid_count + 1;

        IF v_unpaid_invoices.age_days > v_oldest_unpaid_days THEN
            v_oldest_unpaid_days := v_unpaid_invoices.age_days;
        END IF;

        IF v_unpaid_invoices.age_days <= 30 THEN
            v_bucket_0_30 := v_bucket_0_30 + v_unpaid_invoices.outstanding_amount;
        ELSIF v_unpaid_invoices.age_days <= 60 THEN
            v_bucket_31_60 := v_bucket_31_60 + v_unpaid_invoices.outstanding_amount;
        ELSIF v_unpaid_invoices.age_days <= 90 THEN
            v_bucket_61_90 := v_bucket_61_90 + v_unpaid_invoices.outstanding_amount;
        ELSE
            v_bucket_90_plus := v_bucket_90_plus + v_unpaid_invoices.outstanding_amount;
        END IF;
    END LOOP;

    -- 3. Calculate Available Credit
    IF v_total_outstanding < v_credit_limit THEN
        v_available_credit := v_credit_limit - v_total_outstanding;
    ELSE
        v_available_credit := 0.00;
        v_is_limit_exceeded := TRUE;
    END IF;

    -- 4. Check Overdue Invoices
    IF v_oldest_unpaid_days > v_overdue_threshold_days THEN
        v_has_overdue_invoices := TRUE;
    END IF;

    -- 5. Determine Blocking Status
    IF v_is_limit_exceeded AND v_has_overdue_invoices THEN
        v_is_blocked := TRUE;
        v_block_reason := format('Credit limit exceeded by ₹%s AND oldest bill is %s days overdue', 
            (v_total_outstanding - v_credit_limit)::TEXT, v_oldest_unpaid_days::TEXT);
    ELSIF v_is_limit_exceeded THEN
        v_is_blocked := TRUE;
        v_block_reason := format('Outstanding balance ₹%s exceeds approved credit limit of ₹%s', 
            v_total_outstanding::TEXT, v_credit_limit::TEXT);
    ELSIF v_has_overdue_invoices THEN
        v_is_blocked := TRUE;
        v_block_reason := format('Has overdue unpaid invoices (>%s days). Oldest bill is %s days overdue', 
            v_overdue_threshold_days::TEXT, v_oldest_unpaid_days::TEXT);
    ELSE
        v_is_blocked := FALSE;
        v_block_reason := NULL;
    END IF;

    RETURN jsonb_build_object(
        'found', TRUE,
        'retailer_id', v_retailer.id,
        'retailer_code', v_retailer.retailer_code,
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
            'current_0_30', v_bucket_0_30,
            'days_31_60', v_bucket_31_60,
            'days_61_90', v_bucket_61_90,
            'days_90_plus', v_bucket_90_plus
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- 6. ATOMIC POSTGRESQL RPC: POST SALES INVOICE (ACID TRANSACTION)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION post_sales_invoice_atomic(
    p_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
    -- Payload Variables
    v_company_id UUID;
    v_retailer_id UUID;
    v_order_id UUID;
    v_fulfilment_id UUID;
    v_user_id UUID;
    v_place_of_supply TEXT;
    v_payment_mode TEXT;
    v_payment_ref TEXT;
    v_paid_amount NUMERIC(12, 2);
    v_notes TEXT;
    v_items JSONB;
    v_item JSONB;

    -- Working Variables
    v_invoice_id UUID := uuid_generate_v4();
    v_invoice_number TEXT;
    v_prefix TEXT := 'INV';
    v_retailer RECORD;
    v_company RECORD;
    v_prod RECORD;
    v_inv RECORD;
    v_batch RECORD;
    
    -- Line item variables
    v_prod_id UUID;
    v_batch_id UUID;
    v_batch_no TEXT;
    v_carton_qty INTEGER;
    v_loose_qty INTEGER;
    v_base_qty INTEGER;
    v_units_per_trading_unit INTEGER;
    v_carton_rate NUMERIC(10, 2);
    v_loose_rate NUMERIC(10, 2);
    v_carton_disc NUMERIC(10, 2);
    v_loose_disc NUMERIC(10, 2);
    v_mrp NUMERIC(10, 2);
    v_purchase_rate NUMERIC(10, 2);
    v_gst_percent NUMERIC(5, 2);
    v_hsn TEXT;
    v_packing TEXT;
    v_trading_unit TEXT;
    v_base_unit TEXT;
    
    -- Calculated amounts
    v_line_taxable NUMERIC(12, 2);
    v_line_gst NUMERIC(12, 2);
    v_line_cgst NUMERIC(12, 2);
    v_line_sgst NUMERIC(12, 2);
    v_line_igst NUMERIC(12, 2);
    v_line_total NUMERIC(12, 2);
    v_line_discount NUMERIC(12, 2);

    -- Invoice totals
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_discount_total NUMERIC(12, 2) := 0.00;
    v_taxable_total NUMERIC(12, 2) := 0.00;
    v_cgst_total NUMERIC(12, 2) := 0.00;
    v_sgst_total NUMERIC(12, 2) := 0.00;
    v_igst_total NUMERIC(12, 2) := 0.00;
    v_grand_total NUMERIC(12, 2) := 0.00;
    v_round_off NUMERIC(5, 2) := 0.00;
    v_outstanding_amount NUMERIC(12, 2) := 0.00;
    v_new_retailer_outstanding NUMERIC(12, 2) := 0.00;

    -- Tracking variables
    v_inv_count INTEGER := 0;
    v_payment_id UUID;
    v_rem_base INTEGER;
    v_deduct_qty INTEGER;
BEGIN
    -- 1. Extract and Validate Input Payload
    v_company_id := (p_payload->>'business_company_id')::UUID;
    v_retailer_id := (p_payload->>'retailer_id')::UUID;
    v_order_id := NULLIF(p_payload->>'order_id', '')::UUID;
    v_fulfilment_id := NULLIF(p_payload->>'fulfilment_id', '')::UUID;
    v_user_id := NULLIF(p_payload->>'user_id', '')::UUID;
    v_place_of_supply := COALESCE(p_payload->>'place_of_supply', '27');
    v_payment_mode := COALESCE(p_payload->>'payment_mode', 'Credit');
    v_payment_ref := p_payload->>'payment_reference';
    v_paid_amount := GREATEST(0.00, COALESCE((p_payload->>'paid_amount')::NUMERIC, 0.00));
    v_notes := p_payload->>'notes';
    v_items := p_payload->'items';

    IF v_company_id IS NULL OR v_retailer_id IS NULL THEN
        RAISE EXCEPTION 'ERR_INVALID_PAYLOAD: business_company_id and retailer_id are required';
    END IF;

    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RAISE EXCEPTION 'ERR_EMPTY_INVOICE: At least one line item is required to generate an invoice';
    END IF;

    -- 2. Fetch and Lock Company
    SELECT * INTO v_company FROM business_companies WHERE id = v_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_COMPANY_NOT_FOUND: Company with ID % does not exist', v_company_id;
    END IF;
    v_prefix := COALESCE(v_company.invoice_prefix, 'INV');

    -- 3. Fetch and Lock Retailer (FOR UPDATE to guarantee ACID concurrency)
    SELECT * INTO v_retailer 
    FROM retailers 
    WHERE id = v_retailer_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_RETAILER_NOT_FOUND: Retailer with ID % does not exist', v_retailer_id;
    END IF;

    -- 4. Generate Unique Sequential Invoice Number
    SELECT COUNT(*) INTO v_inv_count FROM invoices WHERE business_company_id = v_company_id;
    v_invoice_number := COALESCE(p_payload->>'invoice_number', 
        format('%s/%s-%s/%s', 
            v_prefix,
            TO_CHAR(CURRENT_DATE, 'YY'),
            TO_CHAR(CURRENT_DATE + INTERVAL '1 year', 'YY'),
            LPAD((v_inv_count + 1)::TEXT, 5, '0')
        )
    );

    -- 5. Process Line Items: Lock Stock, Validate Availability, and Calculate Amounts
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        IF v_prod_id IS NULL THEN
            RAISE EXCEPTION 'ERR_INVALID_ITEM: product_id is required for every line item';
        END IF;

        -- Lock Product Record
        SELECT * INTO v_prod FROM products WHERE id = v_prod_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'ERR_PRODUCT_NOT_FOUND: Product with ID % does not exist', v_prod_id;
        END IF;

        v_trading_unit := COALESCE(v_item->>'trading_unit', v_prod.trading_unit, 'Carton');
        v_base_unit := COALESCE(v_item->>'base_unit', v_prod.base_unit, 'Piece');
        v_units_per_trading_unit := GREATEST(1, COALESCE((v_item->>'units_per_trading_unit')::INTEGER, v_prod.units_per_trading_unit, 1));
        
        v_carton_qty := GREATEST(0, COALESCE((v_item->>'carton_qty')::INTEGER, 0));
        v_loose_qty := GREATEST(0, COALESCE((v_item->>'loose_qty')::INTEGER, 0));
        
        -- Compute Total Integer Base Quantity
        v_base_qty := COALESCE(
            (v_item->>'base_qty')::INTEGER, 
            (v_carton_qty * v_units_per_trading_unit) + v_loose_qty
        );

        IF v_base_qty <= 0 THEN
            RAISE EXCEPTION 'ERR_INVALID_QUANTITY: Line item for % has 0 quantity', v_prod.name;
        END IF;

        -- Lock Inventory Row (FOR UPDATE)
        SELECT * INTO v_inv 
        FROM inventory 
        WHERE product_id = v_prod_id 
          AND (business_company_id = v_company_id OR business_company_id IS NULL)
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ERR_STOCK_RECORD_MISSING: No inventory record found for product %', v_prod.name;
        END IF;

        -- Stock Availability Verification
        IF v_inv.physical_qty < v_base_qty THEN
            RAISE EXCEPTION 'ERR_INSUFFICIENT_STOCK: Product "%" (Code: %) has only % %s available, requested %',
                v_prod.name, v_prod.product_code, v_inv.physical_qty, v_base_unit, v_base_qty;
        END IF;

        -- Pricing & Discount Resolution
        v_carton_rate := COALESCE((v_item->>'carton_rate')::NUMERIC, (v_item->>'rate')::NUMERIC, v_prod.selling_price);
        v_loose_rate := COALESCE((v_item->>'loose_rate')::NUMERIC, v_prod.loose_selling_price, ROUND(v_carton_rate / v_units_per_trading_unit, 2));
        v_carton_disc := COALESCE((v_item->>'carton_discount')::NUMERIC, 0.00);
        v_loose_disc := COALESCE((v_item->>'loose_discount')::NUMERIC, 0.00);
        v_mrp := COALESCE((v_item->>'mrp')::NUMERIC, v_prod.mrp);
        v_purchase_rate := COALESCE((v_item->>'purchase_rate')::NUMERIC, v_prod.purchase_price);
        v_gst_percent := COALESCE((v_item->>'gst_percent')::NUMERIC, v_prod.gst_percent, 18.00);
        v_hsn := COALESCE(v_item->>'hsn', v_prod.hsn, 'N/A');
        v_packing := COALESCE(v_item->>'packing', v_prod.pack_size, format('%s units/%s', v_units_per_trading_unit, v_trading_unit));

        -- Line Calculations
        -- Gross = (Carton Qty * Carton Rate) + (Loose Qty * Loose Rate)
        v_line_taxable := (v_carton_qty * GREATEST(0.00, v_carton_rate - v_carton_disc)) + 
                          (v_loose_qty * GREATEST(0.00, v_loose_rate - v_loose_disc));
        v_line_discount := (v_carton_qty * v_carton_disc) + (v_loose_qty * v_loose_disc);
        v_line_gst := ROUND(v_line_taxable * (v_gst_percent / 100.0), 2);

        IF v_place_of_supply = '27' THEN -- Intra-state (Maharashtra): CGST + SGST (Half each)
            v_line_cgst := ROUND(v_line_gst / 2.0, 2);
            v_line_sgst := v_line_gst - v_line_cgst;
            v_line_igst := 0.00;
        ELSE -- Inter-state: IGST Full
            v_line_cgst := 0.00;
            v_line_sgst := 0.00;
            v_line_igst := v_line_gst;
        END IF;

        v_line_total := v_line_taxable + v_line_gst;

        -- Accumulate Totals
        v_subtotal := v_subtotal + (v_carton_qty * v_carton_rate) + (v_loose_qty * v_loose_rate);
        v_discount_total := v_discount_total + v_line_discount;
        v_taxable_total := v_taxable_total + v_line_taxable;
        v_cgst_total := v_cgst_total + v_line_cgst;
        v_sgst_total := v_sgst_total + v_line_sgst;
        v_igst_total := v_igst_total + v_line_igst;

        -- 6. Batch Deduction & FIFO Fallback
        v_batch_id := NULLIF(v_item->>'batch_id', '')::UUID;
        v_batch_no := v_item->>'batch_number';

        IF v_batch_id IS NOT NULL THEN
            SELECT * INTO v_batch FROM inventory_batches WHERE id = v_batch_id FOR UPDATE;
            IF FOUND THEN
                UPDATE inventory_batches 
                SET quantity = GREATEST(0, quantity - v_base_qty)
                WHERE id = v_batch_id;
                v_batch_no := v_batch.batch_number;
            END IF;
        ELSE
            -- FIFO Batch deduction
            v_rem_base := v_base_qty;
            FOR v_batch IN 
                SELECT * FROM inventory_batches 
                WHERE product_id = v_prod_id 
                  AND (business_company_id = v_company_id OR business_company_id IS NULL)
                  AND quantity > 0
                ORDER BY expiry_date ASC, created_at ASC
                FOR UPDATE
            LOOP
                IF v_rem_base <= 0 THEN EXIT; END IF;
                v_deduct_qty := LEAST(v_batch.quantity, v_rem_base);
                UPDATE inventory_batches 
                SET quantity = quantity - v_deduct_qty 
                WHERE id = v_batch.id;
                v_rem_base := v_rem_base - v_deduct_qty;
                IF v_batch_no IS NULL THEN v_batch_no := v_batch.batch_number; END IF;
            END LOOP;
        END IF;

        -- 7. Deduct Inventory Master
        UPDATE inventory 
        SET physical_qty = physical_qty - v_base_qty,
            available_qty = (physical_qty - v_base_qty) - COALESCE(reserved_qty, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_inv.id;

        -- 8. Write Stock Movement Audit to Stock Ledger (in Base Units)
        INSERT INTO stock_ledger (
            id,
            business_company_id,
            product_id,
            change_qty,
            previous_qty,
            new_qty,
            direction,
            reason,
            reference_id,
            batch_id,
            batch_number,
            user_id,
            notes,
            created_at
        ) VALUES (
            uuid_generate_v4(),
            v_company_id,
            v_prod_id,
            -v_base_qty,
            v_inv.physical_qty,
            v_inv.physical_qty - v_base_qty,
            'OUT',
            'Sales Invoice Generation',
            v_invoice_id,
            v_batch_id,
            v_batch_no,
            v_user_id,
            format('Billed in Invoice %s (%s Cartons, %s %ss)', v_invoice_number, v_carton_qty, v_loose_qty, v_base_unit),
            CURRENT_TIMESTAMP
        );
    END LOOP;

    -- 9. Finalize Grand Total and Round-off
    v_grand_total := ROUND(v_taxable_total + v_cgst_total + v_sgst_total + v_igst_total, 2);
    v_round_off := ROUND(ROUND(v_grand_total) - v_grand_total, 2);
    v_grand_total := ROUND(v_grand_total + v_round_off, 2);
    v_outstanding_amount := GREATEST(0.00, v_grand_total - v_paid_amount);

    -- 10. Insert Invoice Header
    INSERT INTO invoices (
        id,
        business_company_id,
        invoice_number,
        retailer_id,
        order_ref_id,
        date,
        place_of_supply,
        subtotal,
        discount_amount,
        taxable_value,
        cgst,
        sgst,
        igst,
        round_off,
        grand_total,
        paid_amount,
        outstanding_amount,
        payment_mode,
        notes,
        created_at
    ) VALUES (
        v_invoice_id,
        v_company_id,
        v_invoice_number,
        v_retailer_id,
        COALESCE(v_order_id, v_fulfilment_id),
        CURRENT_TIMESTAMP,
        v_place_of_supply,
        v_subtotal,
        v_discount_total,
        v_taxable_total,
        v_cgst_total,
        v_sgst_total,
        v_igst_total,
        v_round_off,
        v_grand_total,
        v_paid_amount,
        v_outstanding_amount,
        v_payment_mode,
        v_notes,
        CURRENT_TIMESTAMP
    );

    -- 11. Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        SELECT * INTO v_prod FROM products WHERE id = v_prod_id;

        v_trading_unit := COALESCE(v_item->>'trading_unit', v_prod.trading_unit, 'Carton');
        v_base_unit := COALESCE(v_item->>'base_unit', v_prod.base_unit, 'Piece');
        v_units_per_trading_unit := GREATEST(1, COALESCE((v_item->>'units_per_trading_unit')::INTEGER, v_prod.units_per_trading_unit, 1));
        v_carton_qty := GREATEST(0, COALESCE((v_item->>'carton_qty')::INTEGER, 0));
        v_loose_qty := GREATEST(0, COALESCE((v_item->>'loose_qty')::INTEGER, 0));
        v_base_qty := COALESCE((v_item->>'base_qty')::INTEGER, (v_carton_qty * v_units_per_trading_unit) + v_loose_qty);
        v_carton_rate := COALESCE((v_item->>'carton_rate')::NUMERIC, (v_item->>'rate')::NUMERIC, v_prod.selling_price);
        v_loose_rate := COALESCE((v_item->>'loose_rate')::NUMERIC, v_prod.loose_selling_price, ROUND(v_carton_rate / v_units_per_trading_unit, 2));
        v_carton_disc := COALESCE((v_item->>'carton_discount')::NUMERIC, 0.00);
        v_loose_disc := COALESCE((v_item->>'loose_discount')::NUMERIC, 0.00);
        v_mrp := COALESCE((v_item->>'mrp')::NUMERIC, v_prod.mrp);
        v_purchase_rate := COALESCE((v_item->>'purchase_rate')::NUMERIC, v_prod.purchase_price);
        v_gst_percent := COALESCE((v_item->>'gst_percent')::NUMERIC, v_prod.gst_percent, 18.00);
        v_hsn := COALESCE(v_item->>'hsn', v_prod.hsn, 'N/A');
        v_packing := COALESCE(v_item->>'packing', v_prod.pack_size);

        v_line_taxable := (v_carton_qty * GREATEST(0.00, v_carton_rate - v_carton_disc)) + 
                          (v_loose_qty * GREATEST(0.00, v_loose_rate - v_loose_disc));
        v_line_discount := (v_carton_qty * v_carton_disc) + (v_loose_qty * v_loose_disc);
        v_line_gst := ROUND(v_line_taxable * (v_gst_percent / 100.0), 2);

        IF v_place_of_supply = '27' THEN
            v_line_cgst := ROUND(v_line_gst / 2.0, 2);
            v_line_sgst := v_line_gst - v_line_cgst;
            v_line_igst := 0.00;
        ELSE
            v_line_cgst := 0.00;
            v_line_sgst := 0.00;
            v_line_igst := v_line_gst;
        END IF;

        v_line_total := v_line_taxable + v_line_gst;

        INSERT INTO invoice_items (
            id,
            invoice_id,
            product_id,
            hsn,
            packing,
            quantity,
            trading_unit,
            base_unit,
            units_per_trading_unit,
            units_per_box_carton,
            carton_qty,
            loose_qty,
            base_qty,
            rate,
            carton_rate,
            loose_rate,
            discount,
            carton_discount,
            loose_discount,
            taxable_value,
            cgst,
            sgst,
            igst,
            total_amount,
            mrp,
            purchase_rate,
            batch_id,
            batch_number
        ) VALUES (
            uuid_generate_v4(),
            v_invoice_id,
            v_prod_id,
            v_hsn,
            v_packing,
            v_base_qty,
            v_trading_unit,
            v_base_unit,
            v_units_per_trading_unit,
            v_units_per_trading_unit,
            v_carton_qty,
            v_loose_qty,
            v_base_qty,
            v_carton_rate,
            v_carton_rate,
            v_loose_rate,
            v_line_discount,
            v_carton_disc,
            v_loose_disc,
            v_line_taxable,
            v_line_cgst,
            v_line_sgst,
            v_line_igst,
            v_line_total,
            v_mrp,
            v_purchase_rate,
            NULLIF(v_item->>'batch_id', '')::UUID,
            v_item->>'batch_number'
        );
    END LOOP;

    -- 12. Post to Customer Financial Ledger & Update Retailer Balance
    -- A) Post DEBIT entry for full invoice value
    v_new_retailer_outstanding := COALESCE(v_retailer.outstanding, 0.00) + v_grand_total;
    
    INSERT INTO customer_ledger (
        id,
        business_company_id,
        retailer_id,
        entry_type,
        category,
        reference_number,
        reference_id,
        date,
        amount,
        running_balance,
        notes,
        created_by
    ) VALUES (
        uuid_generate_v4(),
        v_company_id,
        v_retailer_id,
        'DEBIT',
        'SALES_INVOICE',
        v_invoice_number,
        v_invoice_id,
        CURRENT_TIMESTAMP,
        v_grand_total,
        v_new_retailer_outstanding,
        format('Sales Invoice Billed (Grand Total: ₹%s)', v_grand_total::TEXT),
        v_user_id
    );

    -- B) If immediate payment is made (Cash/UPI/Bank), record payment & post CREDIT entry
    IF v_paid_amount > 0 THEN
        v_payment_id := uuid_generate_v4();
        
        INSERT INTO payments (
            id,
            business_company_id,
            retailer_id,
            payment_number,
            amount,
            method,
            reference_number,
            notes,
            date
        ) VALUES (
            v_payment_id,
            v_company_id,
            v_retailer_id,
            format('PAY-%s', TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS')),
            v_paid_amount,
            CASE 
                WHEN v_payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque') THEN v_payment_mode 
                ELSE 'Other' 
            END,
            COALESCE(v_payment_ref, format('POS-PAID-%s', v_invoice_number)),
            format('Instant counter payment for Invoice %s', v_invoice_number),
            CURRENT_TIMESTAMP
        );

        INSERT INTO payment_allocations (
            id,
            payment_id,
            invoice_id,
            amount_allocated
        ) VALUES (
            uuid_generate_v4(),
            v_payment_id,
            v_invoice_id,
            v_paid_amount
        );

        v_new_retailer_outstanding := v_new_retailer_outstanding - v_paid_amount;

        INSERT INTO customer_ledger (
            id,
            business_company_id,
            retailer_id,
            entry_type,
            category,
            reference_number,
            reference_id,
            date,
            amount,
            running_balance,
            notes,
            created_by
        ) VALUES (
            uuid_generate_v4(),
            v_company_id,
            v_retailer_id,
            'CREDIT',
            'PAYMENT_RECEIVED',
            format('PAY-%s', TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS')),
            v_payment_id,
            CURRENT_TIMESTAMP,
            v_paid_amount,
            v_new_retailer_outstanding,
            format('Immediate payment received via %s for Invoice %s', v_payment_mode, v_invoice_number),
            v_user_id
        );
    END IF;

    -- Update Retailer Balance
    UPDATE retailers 
    SET outstanding = v_new_retailer_outstanding
    WHERE id = v_retailer_id;

    -- 13. Update Parent Order / Fulfilment Status if linked
    IF v_order_id IS NOT NULL THEN
        UPDATE orders 
        SET status = 'Delivered', 
            delivered_at = CURRENT_TIMESTAMP
        WHERE id = v_order_id;
    END IF;

    IF v_fulfilment_id IS NOT NULL THEN
        UPDATE fulfilments 
        SET status = 'Delivered', 
            delivered_at = CURRENT_TIMESTAMP
        WHERE id = v_fulfilment_id;
    END IF;

    -- 14. Return Structured JSON Result
    RETURN jsonb_build_object(
        'success', TRUE,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'grand_total', v_grand_total,
        'taxable_value', v_taxable_total,
        'cgst', v_cgst_total,
        'sgst', v_sgst_total,
        'igst', v_igst_total,
        'paid_amount', v_paid_amount,
        'outstanding_amount', v_outstanding_amount,
        'retailer_new_outstanding', v_new_retailer_outstanding,
        'created_at', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
