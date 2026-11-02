# Staging Test Plan & Verification Report
**Saifee General Stores FMCG Wholesale Distribution & Trade ERP**  
**Phase 1C Independent Migration Safety Review & Staging Test Specifications**

---

## 1. Test Verification Status & Demarcation

In strict accordance with Phase 1C instructions, all testing is clearly demarcated by execution environment:

| Test Harness / Environment | Status | Verification Scope | Details |
|---|:---:|---|---|
| **Synthetic Relational Harness (`migration_prep/run_synthetic_staging_tests.js`)** | **PASSED (16/16)** | Relational algorithms, tenant isolation logic, accounting segregation, stock conservation, ID conflict rules, foreign key constraints, mutation detection | Executed in Node.js in-memory relational simulation engine |
| **Real PostgreSQL Staging Instance** | **NOT TESTED / UNEXECUTED** | Genuine PostgreSQL DDL execution, catalog constraints, PL/pgSQL rollback function, native RLS evaluation, search_path security, Realtime publication | **Pending Provisioning:** Isolated disposable staging PostgreSQL database or Supabase staging project not yet provisioned |

> [!CAUTION]
> **STRICT DEMARCATION NOTICE:**
> The synthetic tests demonstrate algorithmic correctness and relational business rule validity in a JavaScript simulation engine. **They DO NOT constitute real PostgreSQL verification.** Real PostgreSQL staging execution has NOT occurred because credentials/infrastructure for an isolated staging database have not been provided. Under no circumstances should synthetic passes be represented as PostgreSQL test passes.

---

## 2. Complete Table-by-Table RLS and Authorization Matrix

The table below defines the authorization matrix enforced in `migration_prep/schema_migration_reviewed.sql`. Every table separates SELECT, INSERT, UPDATE, and DELETE privileges across all five roles.

| Table Name | Operation | `admin` | `salesperson` | `authenticated` (Non-member) | `anon` | `service_role` | Policy Logic / Enforcement Mechanism |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **`companies`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Tenant-scoped or system brands |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only master data creation |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only master data update |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Hard deletes prevented by policy |
| **`products`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Available across authenticated business members |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only catalog addition |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only catalog modification |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Soft-deletes only (`is_active = FALSE`) |
| **`retailers`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Tenant-scoped (`is_business_member(business_id)`) |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Salespersons can onboard new retailers |
| | UPDATE | ALLOW | ALLOW | DENY | DENY | ALLOW | Salespersons can update retailer contact info |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Retailer deletion restricted to service_role |
| **`suppliers`** | SELECT | ALLOW | DENY | DENY | DENY | ALLOW | Supplier directory scoped to management |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only supplier management |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only supplier management |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Master data protected |
| **`godowns`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Warehouse locations viewable for stock inquiries |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only warehouse configuration |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin-only warehouse configuration |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Admin/service-role only |
| **`orders`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped to tenant (`is_business_member(business_id)`) |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Salesperson primary workflow: order taking |
| | UPDATE | ALLOW | ALLOW* | DENY | DENY | ALLOW | *Salesperson can only edit pending draft orders |
| | DELETE | ALLOW | DENY | DENY | DENY | ALLOW | Only admin can delete/cancel orders |
| **`order_items`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped via parent `orders.business_id` |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Salesperson line-item booking |
| | UPDATE | ALLOW | ALLOW* | DENY | DENY | ALLOW | *Salesperson can edit only if parent order is draft |
| | DELETE | ALLOW | ALLOW* | DENY | DENY | ALLOW | *Salesperson can delete lines before dispatch |
| **`invoices`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped to business members |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | **FINANCIAL BARRIER:** Admin/billing role only |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | **FINANCIAL BARRIER:** Invoices immutable to sales |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Financial records protected against deletion |
| **`invoice_items`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped via parent invoice |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Admin/billing role only |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Financial lines locked |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Financial records locked |
| **`payments`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped to business members |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Salespersons can record collected receipts |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Payment vouchers immutable once recorded |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Financial audit integrity |
| **`payment_allocations`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped to business members |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Reconciliation restricted to accounting/admin |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Accounting-only modification |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Financial audit integrity |
| **`purchases`** | SELECT | ALLOW | DENY | DENY | DENY | ALLOW | Supplier purchase orders private to management |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Purchasing department / admin only |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Purchasing department / admin only |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Financial audit integrity |
| **`purchase_items`** | SELECT | ALLOW | DENY | DENY | DENY | ALLOW | Commercial cost prices hidden from salespeople |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Admin only |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin only |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Admin only |
| **`inventory`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Read-only stock visibility for order booking |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | **STOCK GUARD:** Managed via triggers/admin |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | **STOCK GUARD:** Sales cannot adjust stock |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Never physically deleted |
| **`inventory_batches`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Batch numbers & expiry dates readable for orders |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Batches added via GRN/Purchases |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin adjustments only |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Never physically deleted |
| **`stock_transfers`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Warehouse movement tracking |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Warehouse manager / admin only |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Warehouse manager / admin only |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Audit trail preserved |
| **`sales_returns`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped to business members |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Salesperson field workflow: booking return requests |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Approval & verification by admin |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Audit trail preserved |
| **`sales_return_items`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Scoped to parent return |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Salesperson return item entry |
| | UPDATE | ALLOW | DENY | DENY | DENY | ALLOW | Admin verification |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | Audit trail preserved |
| **`stock_ledger`** | SELECT | ALLOW | DENY | DENY | DENY | ALLOW | Audit ledger restricted to admin |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Immutable append-only ledger |
| | UPDATE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE: Updates rejected by rule/trigger |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE: Deletions rejected by rule/trigger |
| **`customer_ledger`** | SELECT | ALLOW | ALLOW | DENY | DENY | ALLOW | Retailer account statement viewable |
| | INSERT | ALLOW | DENY | DENY | DENY | ALLOW | Generated automatically via billing/receipts |
| | UPDATE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE: Updates rejected |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE: Deletions rejected |
| **`audit_logs`** | SELECT | ALLOW | DENY | DENY | DENY | ALLOW | Compliance audit log restricted to admin |
| | INSERT | ALLOW | ALLOW | DENY | DENY | ALLOW | Triggered by system events / user operations |
| | UPDATE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE: Historical tamper-resistance |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE: Historical tamper-resistance |
| **`migration_audit_log`** | SELECT | ALLOW | DENY | DENY | DENY | ALLOW | Migration tracking visible only to administrators |
| | INSERT | DENY | DENY | DENY | DENY | ALLOW | Written solely by migration pipeline |
| | UPDATE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE |
| | DELETE | DENY | DENY | DENY | DENY | ALLOW | IMMUTABLE |

---

## 3. Audit of Dropped Policies & Replacements

The schema migration identifies and purges the following existing, overly broad or obsolete policies, replacing them with granular, least-privilege policies:

| Table | Dropped Policy Name | Reason for Drop | Replacement Policy Name(s) |
|---|---|---|---|
| `companies` | `companies_all_access` | Permitted unrestricted read/write by any authenticated user | `companies_select_policy`, `companies_admin_mutation_policy` |
| `products` | `products_tenant_all` | Allowed salespersons to insert/update catalog items & prices | `products_select_policy`, `products_admin_mutation_policy` |
| `retailers` | `retailers_open_rw` | Unrestricted read/write across all businesses | `retailers_select_policy`, `retailers_insert_policy`, `retailers_admin_update_policy` |
| `orders` | `orders_member_all` | Allowed salespersons to delete or alter confirmed orders | `orders_select_policy`, `orders_insert_policy`, `orders_sales_update_policy`, `orders_admin_delete_policy` |
| `invoices` | `invoices_business_rw` | Allowed any member to create, mutate, or delete invoices | `invoices_select_policy`, `invoices_admin_insert_policy`, `invoices_admin_update_policy` |
| `payments` | `payments_all_members` | Allowed any member to update or delete financial records | `payments_select_policy`, `payments_insert_policy`, `payments_admin_update_policy` |
| `inventory` | `inventory_member_modify` | Allowed client-side direct updates to stock levels | `inventory_select_policy`, `inventory_admin_mutation_policy` |
| `stock_ledger` | `stock_ledger_all_rw` | Allowed modification of historical inventory audit trail | `stock_ledger_select_admin`, `stock_ledger_insert_admin` (No update/delete policies) |

---

## 4. Real PostgreSQL Staging Test Plan (To Be Run on Staging Database)

When an isolated disposable PostgreSQL 15+ database or staging Supabase project is provisioned, execute this exact 10-step staging protocol.

### Step 1: Preflight & Baseline Validation
- **Command:**
  ```bash
  psql "$STAGING_DATABASE_URL" -c "SELECT current_database(), current_user, version();"
  ```
- **Check:** Ensure connection is to staging, NOT production (`wxctglnnybhhptkxwxur`). Ensure PostgreSQL version >= 15.

### Step 2: Idempotency & Repeatability Test
- **Command:**
  ```bash
  psql "$STAGING_DATABASE_URL" -f migration_prep/schema_migration_reviewed.sql
  psql "$STAGING_DATABASE_URL" -f migration_prep/schema_migration_reviewed.sql
  ```
- **Expected Result:** Both executions must succeed with `COMMIT`. The second run must produce zero `relation already exists` errors, zero column collision errors, and zero altered table definitions.

### Step 3: Atomic Transaction Rollback on Failure
- **Command:**
  ```bash
  psql "$STAGING_DATABASE_URL" -c "
    BEGIN;
      CREATE TABLE staging_fail_test (id INT PRIMARY KEY);
      SELECT 1/0; -- Intentional division by zero
    COMMIT;
  "
  psql "$STAGING_DATABASE_URL" -c "\d staging_fail_test"
  ```
- **Expected Result:** Error caught, transaction rolled back. Table `staging_fail_test` must NOT exist in the database. Verifies atomic transaction semantics.

### Step 4: Foreign-Key Constraint & Referential Integrity Enforcement
- **Command:**
  ```bash
  psql "$STAGING_DATABASE_URL" -c "
    -- Attempt inserting order_item with non-existent product
    INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price)
    VALUES ('test-item-01', 'non-existent-order', 'non-existent-product', 10, 100, 1000);
  "
  ```
- **Expected Result:** PostgreSQL error `23503: foreign_key_violation`. Insertion rejected.

### Step 5: Real PostgreSQL RLS Enforcement by Role
- **Command:**
  ```bash
  -- Execute queries impersonating different JWT roles:
  -- Role 1: Salesperson (User A, Business B1)
  -- Role 2: Admin (User B, Business B1)
  -- Role 3: External Member (User C, Business B2)
  -- Role 4: Anonymous (anon)
  ```
- **Expected Result:**
  - Salesperson can SELECT orders for B1, INSERT order for B1, CANNOT INSERT/UPDATE invoices for B1, CANNOT SELECT any data from B2.
  - Cross-business read/write attempts return 0 rows or error.
  - Anonymous role returns 0 rows across all business tables.

### Step 6: Importer Dry-Run & Staging Import
- **Command:**
  ```bash
  # Step 6A: Dry run without writes
  node migration_prep/snapshot_importer_dry_run.js
  # Step 6B: Execute staging import
  SUPABASE_URL="$STAGING_SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$STAGING_KEY" node scripts/unpack_snapshot_to_relational.js --execute
  ```
- **Expected Result:** Raw snapshot hash reported matching `cb119ecb...`. Exactly 23,566 rows inserted across relational tables.

### Step 7: Interrupted Import & Safe Resume
- **Command:**
  ```bash
  # Terminate process midway with SIGINT/SIGKILL, then re-run:
  SUPABASE_URL="$STAGING_SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$STAGING_KEY" node scripts/unpack_snapshot_to_relational.js --execute
  ```
- **Expected Result:** Resume proceeds idempotently without duplicate rows, foreign key violations, or stock double-counting.

### Step 8: Quantitative Data & Financial Reconciliation
- **Command:**
  ```bash
  psql "$STAGING_DATABASE_URL" -c "
    SELECT 
      (SELECT count(*) FROM products) AS total_products,
      (SELECT sum(physical_qty) FROM inventory) AS total_physical_stock,
      (SELECT sum(quantity) FROM inventory_batches) AS total_batch_stock,
      (SELECT (SELECT sum(physical_qty) FROM inventory) - (SELECT sum(quantity) FROM inventory_batches)) AS stock_variance,
      (SELECT count(*) FROM purchases WHERE is_opening_stock = TRUE) AS opening_stock_vouchers,
      (SELECT count(*) FROM purchases WHERE is_opening_stock = FALSE) AS commercial_purchases,
      (SELECT sum(total_amount) FROM purchases WHERE is_opening_stock = FALSE) AS commercial_purchase_total;
  "
  ```
- **Expected Result:**
  - `total_products`: 6,281
  - `total_physical_stock`: 469,962
  - `total_batch_stock`: 469,962
  - `stock_variance`: 0
  - `commercial_purchases`: 1
  - `commercial_purchase_total`: ₹5,286.00

### Step 9: Rollback Dry-Run & Mutation Safeguard Verification
- **Command:**
  ```bash
  # Step 9A: Dry-run preview
  psql "$STAGING_DATABASE_URL" -c "SELECT * FROM execute_surgical_rollback('MIG-SESSION-STAGING-01', TRUE, 'CONFIRM_ROLLBACK_MIG-SESSION-STAGING-01');"
  # Step 9B: Simulate post-migration payment against imported invoice, then attempt rollback:
  psql "$STAGING_DATABASE_URL" -c "
    INSERT INTO payments (id, business_id, retailer_id, amount, payment_mode) 
    VALUES ('pmt-post-mig', 'saifee-main', 'ret-01', 500, 'CASH');
    INSERT INTO payment_allocations (id, business_id, payment_id, invoice_id, amount)
    VALUES ('alloc-post-mig', 'saifee-main', 'pmt-post-mig', 'inv-1524', 500);
  "
  psql "$STAGING_DATABASE_URL" -c "SELECT * FROM execute_surgical_rollback('MIG-SESSION-STAGING-01', FALSE, 'CONFIRM_ROLLBACK_MIG-SESSION-STAGING-01');"
  ```
- **Expected Result:**
  - Dry run reports proposed deletion count without executing writes.
  - Rollback execution aborts with `ERROR: Safeguard 4 failed: Invoice inv-1524 has 1 post-migration payment allocations`. Data remains untouched.

### Step 10: Authorized Rollback & Pre-Existing Master Data Restoration
- **Command:**
  ```bash
  # Remove simulated mutation, execute rollback:
  psql "$STAGING_DATABASE_URL" -c "DELETE FROM payment_allocations WHERE id = 'alloc-post-mig'; DELETE FROM payments WHERE id = 'pmt-post-mig';"
  psql "$STAGING_DATABASE_URL" -c "SELECT * FROM execute_surgical_rollback('MIG-SESSION-STAGING-01', FALSE, 'CONFIRM_ROLLBACK_MIG-SESSION-STAGING-01');"
  ```
- **Expected Result:**
  - All 23,566 migrated rows cleanly purged.
  - Pre-existing company `JOY` dynamically restored from `previous_snapshot` before-image to original UUID, name, code, and active state.
  - Zero unrelated pre-existing business rows deleted.

---

## 5. Staging Execution Sign-Off Criteria

Before any production deployment gate can open, all 10 staging steps above must be executed against real PostgreSQL and yield 100% PASS with saved log artifacts.
