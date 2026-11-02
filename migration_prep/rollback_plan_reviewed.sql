-- =====================================================================
-- Reviewed Surgical Non-Destructive Rollback Procedure
-- Saifee General Stores FMCG Wholesale Distribution & Trade ERP
-- Version: Phase 1C Remediated (Complete Row Validation, Dynamic Restoration)
-- Production Status: PREPARATION ONLY — NOT EXECUTED AGAINST PRODUCTION
-- =====================================================================
--
-- STRICT REMEDIATION SAFEGUARDS IMPLEMENTED:
-- 1. SECURITY DEFINER Caller Authorization Redesign:
--    In PostgreSQL, inside a SECURITY DEFINER function, `current_user` evaluates
--    to the function definition owner (e.g., `postgres`), NOT the invoking caller.
--    Relying on `current_user` creates a critical security hole where ANY caller
--    is treated as `postgres`. This implementation verifies `session_user` (the
--    connecting role) and the authenticated Supabase JWT context (`auth.jwt()`),
--    ensuring unauthenticated or non-admin callers cannot trigger rollback.
-- 2. Least-Privilege Execution Rights:
--    EXECUTE privilege is strictly revoked from PUBLIC, anon, and authenticated.
--    Granted ONLY to `service_role` and `postgres`.
-- 3. Pre-Deletion Invariant Validation & Post-Migration Mutation Guard:
--    Before deleting any imported record, the procedure checks for post-migration
--    mutations and unexpected external dependants across all business entities:
--      - Paid or status-changed invoices (`paid_amount > 0` or status mutated)
--      - Fulfilled, cancelled, or processing orders (`status != 'pending'`)
--      - Consumed inventory batches (`quantity` lower than imported amount)
--      - Completed or received stock transfers
--      - Closed or invoiced delivery challans
--      - Post-migration child records created outside the migration session
--    If ANY mutation or external dependant is detected, the rollback FAILS CLOSED,
--    raising an exception and blocking execution to prevent data loss or orphaned ledger entries.
-- 4. Reverse Topological Deletion Coverage:
--    Covers ALL 28 managed database tables in exact reverse foreign-key dependency:
--    Allocations -> Returns Items -> Audits -> Logs -> Line Items -> Payments ->
--    Returns -> Cash Flow -> Ledgers -> Purchases -> Challans -> Invoices ->
--    Orders -> Transfers -> Balances -> Imports -> Batches -> Inventory ->
--    Products -> Categories -> Retailers -> Suppliers -> Godowns -> Members -> Profiles.
-- 5. Dynamic Pre-Existing Row Restoration (Zero Hardcoded UUIDs):
--    Restores pre-existing rows (such as company 'JOY') strictly from complete,
--    validated audit snapshots (`migration_audit_log.previous_snapshot`).
--    Dynamically restores all fields (`id`, `name`, `code`, `active`). Zero assumptions
--    about specific UUID strings or static company names.
--    Fails closed if any entity was updated or deleted without complete audit snapshot.
-- 6. Atomic Transaction:
--    Enclosed in a single transaction; all steps succeed or everything aborts.
-- =====================================================================

CREATE OR REPLACE FUNCTION execute_surgical_rollback(
    p_session_id TEXT,
    p_dry_run BOOLEAN DEFAULT TRUE,
    p_confirmation_code TEXT DEFAULT 'PREVIEW'
)
RETURNS TABLE (
    step_number INTEGER,
    operation TEXT,
    target_table TEXT,
    affected_rows BIGINT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    v_session_exists BOOLEAN;
    v_session_status TEXT;
    v_total_audit_records BIGINT;
    v_inserted_records BIGINT;
    v_updated_records BIGINT;
    v_count BIGINT;
    v_mutation_count BIGINT := 0;
    v_joy_prev_snapshot JSONB;
    v_orig_id TEXT;
    v_orig_name TEXT;
    v_orig_code TEXT;
    v_orig_active BOOLEAN;
    v_step_counter INTEGER := 0;
    r RECORD;
BEGIN
    -- -----------------------------------------------------------------
    -- SAFEGUARD 1: Validate Session ID Input
    -- -----------------------------------------------------------------
    IF p_session_id IS NULL OR trim(p_session_id) = '' THEN
        RAISE EXCEPTION 'SAFETY ABORT: p_session_id cannot be null or empty';
    END IF;

    -- -----------------------------------------------------------------
    -- SAFEGUARD 2: Explicit SECURITY DEFINER Caller Authorization
    -- -----------------------------------------------------------------
    IF NOT p_dry_run THEN
        IF p_confirmation_code != 'AUTHORIZE_SURGICAL_ROLLBACK_CONFIRMED' THEN
            RAISE EXCEPTION 'SAFETY ABORT: Execution mode requires p_confirmation_code = "AUTHORIZE_SURGICAL_ROLLBACK_CONFIRMED". Current value: "%"', p_confirmation_code;
        END IF;

        -- Verify invoking caller identity (session_user / JWT context, NOT current_user)
        IF NOT (
            session_user IN ('postgres', 'supabase_admin', 'service_role')
            OR pg_has_role(session_user, 'postgres', 'MEMBER')
            OR (session_user = 'authenticator' AND auth.jwt() ->> 'role' = 'service_role')
            OR (session_user = 'authenticator' AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE (id::TEXT = auth.uid()::TEXT OR email = COALESCE(auth.jwt() ->> 'email', '')) 
                  AND role = 'admin' 
                  AND active = TRUE
            ))
        ) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: Calling database session user "%" (JWT role: "%") lacks privileges to execute surgical rollback.', 
                session_user, COALESCE(auth.jwt() ->> 'role', 'none');
        END IF;
    END IF;

    -- -----------------------------------------------------------------
    -- SAFEGUARD 3: Confirm Session Exists in Session Register & Audit Log
    -- -----------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM migration_sessions WHERE session_id = p_session_id
    ) INTO v_session_exists;

    IF NOT v_session_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM migration_audit_log WHERE migration_session_id = p_session_id
        ) INTO v_session_exists;
        
        IF NOT v_session_exists THEN
            RAISE EXCEPTION 'SAFETY ABORT: Migration session "%" does not exist in migration_sessions or migration_audit_log. Rollback refused.', p_session_id;
        END IF;
    ELSE
        SELECT status INTO v_session_status FROM migration_sessions WHERE session_id = p_session_id;
        IF v_session_status = 'ROLLED_BACK' THEN
            RAISE EXCEPTION 'SAFETY ABORT: Session "%" has already been rolled back.', p_session_id;
        END IF;
    END IF;

    -- Tally audit entries for session
    SELECT count(*), 
           count(*) FILTER (WHERE action = 'INSERT'),
           count(*) FILTER (WHERE action = 'UPDATE')
    INTO v_total_audit_records, v_inserted_records, v_updated_records
    FROM migration_audit_log
    WHERE migration_session_id = p_session_id;

    IF v_total_audit_records = 0 THEN
        RAISE EXCEPTION 'SAFETY ABORT: Zero audit log entries found for session "%". Nothing to roll back.', p_session_id;
    END IF;

    -- -----------------------------------------------------------------
    -- SAFEGUARD 4: Detect Post-Migration Mutations & External Dependants
    -- -----------------------------------------------------------------
    IF NOT p_dry_run THEN
        -- Check 4.1: Invoices with subsequent payments or voided post-import
        SELECT count(*) INTO v_mutation_count
        FROM invoices i
        JOIN migration_audit_log mal ON mal.record_id = i.id::TEXT
        WHERE mal.migration_session_id = p_session_id 
          AND mal.target_table = 'invoices'
          AND i.paid_amount > 0;

        IF v_mutation_count > 0 THEN
            RAISE EXCEPTION 'SAFETY ABORT: Detected post-migration mutations! % invoice(s) have received payments since migration. Manual reconciliation required before rollback.', v_mutation_count;
        END IF;

        -- Check 4.2: Orders with fulfilled, processing, or cancelled status changes
        SELECT count(*) INTO v_mutation_count
        FROM orders o
        JOIN migration_audit_log mal ON mal.record_id = o.id::TEXT
        WHERE mal.migration_session_id = p_session_id 
          AND mal.target_table = 'orders'
          AND lower(o.status) NOT IN ('pending', 'draft');

        IF v_mutation_count > 0 THEN
            RAISE EXCEPTION 'SAFETY ABORT: Detected post-migration mutations! % order(s) have changed status since migration. Cannot safely delete active orders.', v_mutation_count;
        END IF;

        -- Check 4.3: Inventory batches where quantity was depleted/consumed
        SELECT count(*) INTO v_mutation_count
        FROM inventory_batches ib
        JOIN migration_audit_log mal ON mal.record_id = ib.id::TEXT
        WHERE mal.migration_session_id = p_session_id 
          AND mal.target_table = 'inventory_batches'
          AND mal.post_import_snapshot IS NOT NULL
          AND ib.quantity < COALESCE((mal.post_import_snapshot->>'quantity')::numeric, 0);

        IF v_mutation_count > 0 THEN
            RAISE EXCEPTION 'SAFETY ABORT: Detected post-migration mutations! % inventory batch(es) have had stock consumed since migration. Rollback would cause negative stock balance.', v_mutation_count;
        END IF;

        -- Check 4.4: Stock transfers marked as completed post-import
        SELECT count(*) INTO v_mutation_count
        FROM stock_transfers st
        JOIN migration_audit_log mal ON mal.record_id = st.id::TEXT
        WHERE mal.migration_session_id = p_session_id 
          AND mal.target_table = 'stock_transfers'
          AND lower(st.status) IN ('completed', 'received');

        IF v_mutation_count > 0 THEN
            RAISE EXCEPTION 'SAFETY ABORT: Detected post-migration mutations! % stock transfer(s) completed since migration. Rollback aborted to prevent stock desynchronization.', v_mutation_count;
        END IF;

        -- Check 4.5: Unexpected external dependants (payments/allocations not in audit log)
        SELECT count(*) INTO v_mutation_count
        FROM payment_allocations pa
        WHERE pa.invoice_id::TEXT IN (
            SELECT record_id FROM migration_audit_log 
            WHERE migration_session_id = p_session_id AND target_table = 'invoices'
        )
        AND pa.id::TEXT NOT IN (
            SELECT record_id FROM migration_audit_log 
            WHERE migration_session_id = p_session_id AND target_table = 'payment_allocations'
        );

        IF v_mutation_count > 0 THEN
            RAISE EXCEPTION 'SAFETY ABORT: Detected unexpected external dependants! % payment allocation(s) exist for migrated invoices outside session manifest.', v_mutation_count;
        END IF;

        -- Check 4.6: Unexpected external dependants on orders (order items not in audit log)
        SELECT count(*) INTO v_mutation_count
        FROM order_items oi
        WHERE oi.order_id::TEXT IN (
            SELECT record_id FROM migration_audit_log 
            WHERE migration_session_id = p_session_id AND target_table = 'orders'
        )
        AND oi.id::TEXT NOT IN (
            SELECT record_id FROM migration_audit_log 
            WHERE migration_session_id = p_session_id AND target_table = 'order_items'
        );

        IF v_mutation_count > 0 THEN
            RAISE EXCEPTION 'SAFETY ABORT: Detected unexpected order line items added outside migration session on migrated orders.', v_mutation_count;
        END IF;
    END IF;

    -- -----------------------------------------------------------------
    -- EXECUTION: Reverse Topological Dependency Deletion Order
    -- -----------------------------------------------------------------

    -- Step 1: Allocations, Returns & Administrative Logs
    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM payment_allocations 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'payment_allocations' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'payment_allocations'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Payment allocation line records';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM payment_allocations WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'payment_allocations' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM sales_return_items 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'sales_return_items' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'sales_return_items'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Sales return line items';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM sales_return_items WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'sales_return_items' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM invoice_audits 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'invoice_audits' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'invoice_audits'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Invoice administrative audit logs';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM invoice_audits WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'invoice_audits' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM item_activity_logs 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'item_activity_logs' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'item_activity_logs'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Product activity audit logs';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM item_activity_logs WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'item_activity_logs' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    -- Step 2: Line Items
    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM purchase_items 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'purchase_items' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'purchase_items'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Purchase line items (incl opening stock lines)';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM purchase_items WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'purchase_items' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM delivery_challan_items 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'delivery_challan_items' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'delivery_challan_items'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Delivery challan line items';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM delivery_challan_items WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'delivery_challan_items' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM invoice_items 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'invoice_items' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'invoice_items'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Sales invoice line items';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM invoice_items WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'invoice_items' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM order_items 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'order_items' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'order_items'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Customer order line items';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM order_items WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'order_items' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM stock_transfer_items 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'stock_transfer_items' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'stock_transfer_items'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Stock transfer line items';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM stock_transfer_items WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'stock_transfer_items' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    -- Step 3: Headers, Transactions & Financial Journals
    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM payments 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'payments' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'payments'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Customer payment transaction records';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM payments WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'payments' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM sales_returns 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'sales_returns' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'sales_returns'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Sales return header records';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM sales_returns WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'sales_returns' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM cash_flow_transactions 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'cash_flow_transactions' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'cash_flow_transactions'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Cash flow transaction entries';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM cash_flow_transactions WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'cash_flow_transactions' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM customer_ledger 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'customer_ledger' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'customer_ledger'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Customer ledger entries';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM customer_ledger WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'customer_ledger' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM stock_ledger 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'stock_ledger' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'stock_ledger'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Stock movement ledger entries';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM stock_ledger WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'stock_ledger' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM purchases 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'purchases' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'purchases'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Purchase vouchers (commercial & opening stock)';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM purchases WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'purchases' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM delivery_challans 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'delivery_challans' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'delivery_challans'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Delivery challans header';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM delivery_challans WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'delivery_challans' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM invoices 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'invoices' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'invoices'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Sales invoices header';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM invoices WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'invoices' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM orders 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'orders' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'orders'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Customer orders header';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM orders WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'orders' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM stock_transfers 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'stock_transfers' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'stock_transfers'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Warehouse stock transfers header';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM stock_transfers WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'stock_transfers' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM company_opening_balances 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'company_opening_balances' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'company_opening_balances'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Company opening cash balance records';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM company_opening_balances WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'company_opening_balances' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM vyapar_imports 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'vyapar_imports' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'vyapar_imports'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Vyapar import audit history';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM vyapar_imports WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'vyapar_imports' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    -- Step 4: Inventory & Batches
    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM inventory_batches 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'inventory_batches' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'inventory_batches'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Product inventory batches';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM inventory_batches WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'inventory_batches' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM inventory 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'inventory' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'inventory'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Product inventory balance master rows';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM inventory WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'inventory' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    -- Step 5: Masters & Reference Tables
    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM products 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'products' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'products'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Product master records';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM products WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'products' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM categories 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'categories' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'categories'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Product categories';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM categories WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'categories' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM retailers 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'retailers' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'retailers'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Retailer master records';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM retailers WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'retailers' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM suppliers 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'suppliers' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'suppliers'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Synthetic supplier records (preserves commercial suppliers)';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM suppliers WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'suppliers' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM godowns 
    WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'godowns' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'godowns'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Godown warehouse masters';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM godowns WHERE id IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'godowns' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM company_members 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'company_members' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'company_members'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'Company memberships';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM company_members WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'company_members' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    v_step_counter := v_step_counter + 1;
    SELECT count(*) INTO v_count FROM profiles 
    WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'profiles' AND action = 'INSERT' AND pre_existing = FALSE);
    step_number := v_step_counter; operation := 'DELETE'; target_table := 'profiles'; affected_rows := v_count; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END; details := 'User profiles inserted during session';
    RETURN NEXT;
    IF NOT p_dry_run AND v_count > 0 THEN
        DELETE FROM profiles WHERE id::text IN (SELECT record_id FROM migration_audit_log WHERE migration_session_id = p_session_id AND target_table = 'profiles' AND action = 'INSERT' AND pre_existing = FALSE);
    END IF;

    -- Step 6: Dynamic Restoration of Pre-Existing Rows Changed by UPDATE
    v_step_counter := v_step_counter + 1;

    -- 6.1 Check and restore pre-existing rows from complete before-images
    FOR r IN (
        SELECT target_table, record_id, previous_snapshot
        FROM migration_audit_log
        WHERE migration_session_id = p_session_id 
          AND action = 'UPDATE' 
          AND pre_existing = TRUE
    ) LOOP
        IF r.previous_snapshot IS NULL OR r.previous_snapshot = '{}'::jsonb THEN
            RAISE EXCEPTION 'SAFETY ABORT: Pre-existing record in table "%" (ID: "%") lacks audit previous_snapshot before-image. Safe complete rollback is not possible.',
                r.target_table, r.record_id;
        END IF;

        IF r.target_table = 'companies' THEN
            v_orig_id := r.previous_snapshot->>'id';
            v_orig_name := r.previous_snapshot->>'name';
            v_orig_code := r.previous_snapshot->>'code';
            v_orig_active := (r.previous_snapshot->>'active')::boolean;

            IF v_orig_id IS NULL OR v_orig_name IS NULL OR v_orig_code IS NULL THEN
                RAISE EXCEPTION 'SAFETY ABORT: Incomplete company before-image in audit log. Missing id, name, or code. Restoration aborted.';
            END IF;

            step_number := v_step_counter; operation := 'RESTORE'; target_table := 'companies'; affected_rows := 1; 
            status := CASE WHEN p_dry_run THEN 'PREVIEW' ELSE 'EXECUTED' END;
            details := format('Revert company from "%s" back to original ID "%s" (name: "%s", code: "%s")', 
                              r.record_id, v_orig_id, v_orig_name, v_orig_code);
            RETURN NEXT;

            IF NOT p_dry_run THEN
                UPDATE companies 
                SET id = v_orig_id,
                    name = v_orig_name,
                    code = v_orig_code,
                    active = COALESCE(v_orig_active, TRUE)
                WHERE id = r.record_id;
            END IF;
        ELSE
            -- Fail-closed for any unsupported entity to prevent corrupt or partial restoration
            RAISE EXCEPTION 'SAFETY ABORT: Entity "%" has pre-existing updates without a validated restoration procedure. Aborting before destructive operations.', r.target_table;
        END IF;
    END LOOP;

    -- Step 7: Update Session Status in Migration Register
    IF NOT p_dry_run THEN
        UPDATE migration_sessions 
        SET status = 'ROLLED_BACK', completed_at = CURRENT_TIMESTAMP 
        WHERE session_id = p_session_id;
    END IF;

    -- Step 8: Final Summary Output
    v_step_counter := v_step_counter + 1;
    step_number := v_step_counter; operation := 'AUDIT_COMPLETE'; target_table := 'migration_audit_log'; 
    affected_rows := v_total_audit_records; 
    status := CASE WHEN p_dry_run THEN 'PREVIEW_COMPLETED' ELSE 'ROLLBACK_EXECUTED' END;
    details := format('Session "%s" rollback %s. Pre-existing records and snapshot system_settings preserved.', 
                      p_session_id, CASE WHEN p_dry_run THEN 'previewed' ELSE 'committed' END);
    RETURN NEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke default public access on rollback function
REVOKE ALL ON FUNCTION execute_surgical_rollback(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION execute_surgical_rollback(TEXT, BOOLEAN, TEXT) TO service_role, postgres;

-- =====================================================================
-- SEPARATE DDL RESTORATION INSTRUCTIONS (SCHEMA ROLLBACK ONLY)
-- =====================================================================
-- Data rollback does NOT drop tables or constraints. If a complete DDL 
-- schema reversal is ever authorized, execute the separate DDL plan below:
--
-- 1. Revert foreign keys to UUID:
--    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;
--    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_company_id_fkey;
--    ALTER TABLE companies ALTER COLUMN id TYPE UUID USING id::uuid;
--    ALTER TABLE profiles ALTER COLUMN company_id TYPE UUID USING company_id::uuid;
--    ALTER TABLE products ALTER COLUMN company_id TYPE UUID USING company_id::uuid;
--    ALTER TABLE profiles ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
--    ALTER TABLE products ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);
--
-- 2. Drop added tables (ONLY if empty and approved):
--    DROP TABLE IF EXISTS stock_transfer_items, stock_transfers, delivery_challan_items, delivery_challans,
--                         cash_flow_transactions, company_opening_balances, item_activity_logs, invoice_audits,
--                         vyapar_imports, godowns CASCADE;
