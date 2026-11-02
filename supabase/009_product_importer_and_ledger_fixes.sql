-- =====================================================================
-- Migration 009: FMCG Product Importer & Stock Ledger Schema Reconciliation
-- Saifee General Stores FMCG Wholesale Distribution & Trade ERP
-- Version: Phase 1C Schema Alignment
-- Production Status: PROPOSED MIGRATION — DO NOT RUN WITHOUT EXPLICIT APPROVAL
-- =====================================================================
--
-- PURPOSE:
-- 1. Reconcile `products.description` missing in PostgreSQL schema despite being
--    used by the FMCG catalog engine and Excel product importer.
-- 2. Add `business_id TEXT` to `stock_ledger` to unify multi-tenant tenant isolation
--    matching products, categories, inventory, and inventory_batches.
-- 3. Alter `stock_ledger.reference_id` from UUID to TEXT to allow linking import
--    batches ('IMP-VYAPAR-...'), order IDs, and purchase invoices.
-- 4. Ensure non-restrictive ID typing on `stock_ledger` (id, product_id, user_id, batch_id)
--    compatible with offline-first client-generated and sync engine IDs.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. RECONCILE PRODUCTS TABLE
-- ---------------------------------------------------------------------

-- Add missing description column used by Excel/CSV importer and product catalog
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- ---------------------------------------------------------------------
-- 2. RECONCILE STOCK_LEDGER TABLE
-- ---------------------------------------------------------------------

-- 2.1 Add business_id TEXT column for multi-tenant isolation
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS business_id TEXT;

-- Backfill business_id from existing business_company_id if present
UPDATE stock_ledger 
SET business_id = business_company_id::TEXT 
WHERE business_id IS NULL AND business_company_id IS NOT NULL;

-- Default any remaining unassigned stock_ledger rows to primary business
UPDATE stock_ledger 
SET business_id = 'biz-saifee' 
WHERE business_id IS NULL;

-- Create index on stock_ledger(business_id) for tenant query performance
CREATE INDEX IF NOT EXISTS idx_stock_ledger_biz ON stock_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_prod_biz ON stock_ledger(product_id, business_id);

-- 2.2 Relax reference_id data type from UUID to TEXT
-- Allows referencing import batch IDs ('IMP-VYAPAR-...'), order IDs, and external bills
ALTER TABLE stock_ledger ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;

-- 2.3 Ensure string compatibility for ID columns
ALTER TABLE stock_ledger ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE stock_ledger ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_ledger' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE stock_ledger ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_ledger' AND column_name = 'batch_id'
    ) THEN
        ALTER TABLE stock_ledger ALTER COLUMN batch_id TYPE TEXT USING batch_id::TEXT;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'stock_ledger' AND column_name = 'godown_id'
    ) THEN
        ALTER TABLE stock_ledger ALTER COLUMN godown_id TYPE TEXT USING godown_id::TEXT;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) FOR STOCK LEDGER
-- ---------------------------------------------------------------------

ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

-- Drop obsolete or restrictive policies if present
DROP POLICY IF EXISTS "stock_ledger_tenant_isolation_select" ON stock_ledger;
DROP POLICY IF EXISTS "stock_ledger_tenant_isolation_insert" ON stock_ledger;

-- SELECT policy: Authenticated members of the business can audit stock movements
CREATE POLICY "stock_ledger_tenant_isolation_select" ON stock_ledger
    FOR SELECT
    TO authenticated
    USING (
        business_id IN (SELECT business_id FROM get_auth_business_ids())
        OR business_company_id IN (
            SELECT COALESCE(company_id, business_id)::UUID 
            FROM company_members 
            WHERE user_id::TEXT = auth.uid()::TEXT AND status = 'active'
        )
    );

-- INSERT policy: Stock movements can be recorded by authorized business users/admins
CREATE POLICY "stock_ledger_tenant_isolation_insert" ON stock_ledger
    FOR INSERT
    TO authenticated
    WITH CHECK (
        business_id IN (SELECT business_id FROM get_auth_business_ids())
        OR business_company_id IN (
            SELECT COALESCE(company_id, business_id)::UUID 
            FROM company_members 
            WHERE user_id::TEXT = auth.uid()::TEXT AND status = 'active'
        )
    );

COMMIT;
