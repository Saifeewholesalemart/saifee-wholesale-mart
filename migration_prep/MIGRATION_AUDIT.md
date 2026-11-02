# Comprehensive Live-Database Migration Audit
**Saifee General Stores FMCG Wholesale Distribution & Trade ERP**  
**Audit Status:** Complete — Read-Only Mode  
**Production Modifications Executed:** ZERO

---

## 1. Executive Audit Summary

This audit establishes the baseline facts for migrating the Saifee FMCG Distributor PWA from whole-database snapshot synchronization (`system_settings.fmcg_cloud_database_v1`) to normalized Supabase PostgreSQL tables.

Every finding is explicitly classified into one of four verified categories:
- `[VERIFIED: SOURCE CODE]`
- `[VERIFIED: READ-ONLY DB INSPECTION]`
- `[INFERRED BUT UNVERIFIED]`
- `[BLOCKER REQUIRING HUMAN APPROVAL]`

---

## 2. Infrastructure & Configuration Findings

### 2.1 Client Configuration & Connection Credentials
- **Finding:** Supabase JS SDK client is configured in `src/lib/supabaseClient.ts` and `src/lib/supabaseSyncEngine.ts`.
- **Classification:** `[VERIFIED: SOURCE CODE]`
- **Details:** The application reads `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`. In their absence, it falls back to hardcoded production endpoints:
  - Project URL: `https://wxctglnnybhhptkxwxur.supabase.co`
  - Anonymous Key: Standard Supabase `anon` JWT.
- **Security Assessment:** `[VERIFIED: SOURCE CODE]` The client uses an anonymous role key. The service-role secret key is NOT present in client code or environment variables. All direct queries are strictly subject to PostgreSQL Row-Level Security (RLS).

### 2.2 Current Snapshot Architecture (`fmcg_cloud_database_v1`)
- **Finding:** Persistent cloud storage currently consists of a single JSON blob stored under `system_settings` key `fmcg_cloud_database_v1`.
- **Classification:** `[VERIFIED: READ-ONLY DB INSPECTION]` & `[VERIFIED: SOURCE CODE]`
- **Inspection Data:**
  - Table: `public.system_settings`
  - Record: Key `fmcg_cloud_database_v1`, updated at `2026-10-21T11:54:50.165+00:00`.
  - Format: JSON object containing `{ _compressed: true, _encoding: 'gzip-base64', data: '...', metadata: {...}, timestamp: '...' }`.
  - SHA-256 Fingerprint: `cb119ecbbf487ef54c7e13b89a4e623f8e67df14a37040a7c2ed0fc1238d4e03`.
  - Content: 25 collections comprising 23,565 raw business records.
- **Read Logic:** `src/lib/supabaseSyncEngine.ts` `fetchCloudSnapshot()` performs direct HTTP REST GET with gzip-base64 decompression, falling back to Supabase SDK `maybeSingle()`.
- **Write Logic:** `src/lib/supabaseSyncEngine.ts` `pushCloudSnapshot()` takes an in-memory database dump, compresses it via pako/gzip, base64 encodes it, and upserts to `system_settings`. Includes an "Anti-Wipe Guard" preventing overwrite if local product count is 0.

### 2.3 Browser Storage Persistence (IndexedDB & LocalStorage)
- **Finding:** Client application currently relies heavily on browser IndexedDB and localStorage as persistent business-data storage.
- **Classification:** `[VERIFIED: SOURCE CODE]`
- **Details:**
  - `src/lib/indexedDbStorage.ts`: Opens IndexedDB `SaifeeFmcgDatabase`, store `fmcg_stores`.
  - `src/lib/db.ts`: Line 2716 explicitly states `localStorage.setItem(vKey, JSON.stringify(data));` as a synchronous fallback mirror.
  - Active keys stored locally: `fmcg_products_v4`, `fmcg_retailers_v4`, `fmcg_inventory_v4`, `fmcg_orders_v4`, `fmcg_invoices_v4`, `fmcg_tombstones_v4`, `fmcg_active_business_id`.
- **Architectural Gap:** `[VERIFIED: SOURCE CODE]` The approved target architecture mandates zero localStorage/IndexedDB persistence for business records. The current code is architecturally coupled to local mirrors.

---

## 3. Database Schema & Migration Audit

### 3.1 Live Database Status vs Repository Migrations
A live read-only inspection of the production Supabase database revealed:
- **`system_settings`:** 1 row (`fmcg_cloud_database_v1`). `[VERIFIED: READ-ONLY DB INSPECTION]`
- **`companies`:** 1 row: `{ id: '3a5d6db1-c75d-41d6-a695-9836049d5e85', code: 'JOY', name: 'Joy Personal Care', active: true }`. `[VERIFIED: READ-ONLY DB INSPECTION]`
- **Existing Empty Tables (0 rows):** `products`, `orders`, `order_items`, `invoices`, `invoice_items`, `retailers`, `suppliers`, `categories`, `inventory`, `inventory_batches`, `stock_ledger`, `payments`, `payment_allocations`, `sales_returns`, `sales_return_items`, `fulfilments`, `fulfilment_items`, `customer_ledger`, `business_companies`, `company_members`. `[VERIFIED: READ-ONLY DB INSPECTION]`
- **Missing Tables (404 Not Found):** `godowns`, `stock_transfers`, `stock_transfer_items`, `delivery_challans`, `delivery_challan_items`, `cash_flow_transactions`, `company_opening_balances`, `item_activity_logs`, `invoice_audits`, `vyapar_imports`. `[VERIFIED: READ-ONLY DB INSPECTION]`

### 3.2 Primary Key & Identifier Conflict (UUID vs TEXT)
- **Finding:** Existing PostgreSQL tables defined in `supabase/schema.sql` and `005_multi_company_architecture.sql` use `UUID PRIMARY KEY DEFAULT uuid_generate_v4()`.
- **Classification:** `[VERIFIED: READ-ONLY DB INSPECTION]`
- **Conflict:** The PWA application, IndexedDB snapshot, and Vyapar catalog import use non-UUID text strings as deterministic IDs (e.g. `'c-joy'`, `'prd-1792068589189-exk7k'`, `'ret-gupta-provision'`, `'supp-vyapar-opening'`).
- **Severity:** `[BLOCKER REQUIRING HUMAN APPROVAL]` Attempting to insert snapshot data into the existing PostgreSQL schema causes immediate PostgreSQL errors: `invalid input syntax for type uuid: "c-joy"`.
- **Company 'JOY' Conflict:** In PostgreSQL, code `'JOY'` exists with UUID `'3a5d6db1-c75d-41d6-a695-9836049d5e85'`. In the snapshot, company `'JOY'` has string ID `'c-joy'`.
- **Product Company Distribution:** In `tables.products`, exactly **1 product** references `'c-joy'` (`prd-1791814926751-67d5b`) and **6,280 products** reference `'comp-1792068589189-3r0e'` (Code: `'GENE'`, Name: `'General FMCG'`). Both company records exist in `tables.companies` within the snapshot. Unilaterally altering or renaming this company without an approved plan risks foreign key corruption or silent failure.

---

## 4. Row-Level Security (RLS) & Multi-Tenant Isolation Audit

### 4.1 Permissive Policies & Leaks in Previous Migrations
- **Finding:** `005_multi_company_architecture.sql` and `006_fmcg_multi_uom_and_ledger.sql` created RLS on some tables, but left child tables unprotected or with conflicting policy names. `[VERIFIED: SOURCE CODE]`
- **PostgreSQL Policy Combination Rule:** In PostgreSQL, multiple policies for the same action on a table are combined via boolean `OR`. Simply creating a new policy does NOT drop older permissive policies.
- **Remediation:** `[VERIFIED: SOURCE CODE]` The reviewed migration script explicitly queries `pg_policies` and dynamically purges all pre-existing policies on managed tables before creating the strict tenant policies.
- **Admin Privilege Scope Defect:** Earlier helper function `is_saifee_admin()` checked `role = 'admin'` globally across profiles without verifying business membership. This created a multi-tenant leak where an admin in tenant A had admin privileges in tenant B.
- **Remediation:** `[VERIFIED: SOURCE CODE]` Scoped administrator privileges to the specific business via `is_business_admin(p_business_id TEXT)`.

---

## 5. Importer Logic & Semantic Integrity Audit

### 5.1 Investigation: Purchase Voucher 1524 Discrepancy & Accounting Segregation
- **Finding:** The source snapshot contains 2 purchase headers and 4,649 purchase items.
- **Classification:** `[VERIFIED: SOURCE CODE]` & `[VERIFIED: READ-ONLY DB INSPECTION]`
- **Decomposition:**
  1. `purchases[0]` (`pur-1791814952230`): Commercial purchase voucher for supplier invoice `1524` (Date: `2026-10-12`) from supplier `s-prashant-medico` (Prashant Medico, GSTIN: `27PRASH1234M1Z5`). Contains 1 line item (`LOT-1524`, 160 pieces @ ₹28.00).
     - **Arithmetic & Tax Breakdown:** 160 pieces × ₹28.00 = ₹4,480.00 taxable subtotal. GST @ 18% = ₹806.40. Subtotal + GST = ₹5,286.40. Minus ₹0.40 roundoff = **₹5,286.00 voucher total**. The ₹806 difference is 100% accounted for by 18% GST minus roundoff. Zero numbers invented.
  2. `purchases[1]` (`pur-vyapar-1792068589248`): **Bulk Opening Stock Inward Voucher** (`VYAPAR-IMP-589248`, ₹54,878,040) generated during Vyapar Excel catalog import on 2026-10-15. Contains **4,648 line items** seeding initial inventory and creating batches `VYP-2026-xxxx`.
- **Accounting Risk:** `[BLOCKER REQUIRING HUMAN APPROVAL]` If `purchases[1]` is imported as a standard commercial purchase, it creates a false ₹54.8M accounts payable liability and ₹54.8M purchase expense. It must be explicitly tagged as Opening Stock (`is_opening_stock = true`) with zero supplier debt.

### 5.2 Reconciled Supplier Identities & Counts
- **Finding:** Supplier `s-prashant-medico` (referenced by invoice 1524) **already exists** in `tables.suppliers`. The only supplier missing from the master is `supp-vyapar-opening` (referenced by the opening stock voucher).
- **Classification:** `[VERIFIED: READ-ONLY DB INSPECTION]`
- **Count Reconciliation:** 2 existing source suppliers (`s-prashant-medico`, `s-general-supplier`) + 1 synthetic opening stock supplier (`supp-vyapar-opening`) = **3 target suppliers** (Net delta: +1 record, total target rows: 23,566).
- **Resolution:** `[VERIFIED: SOURCE CODE]` The reviewed importer creates synthetic system supplier `supp-vyapar-opening` ("Vyapar Opening Stock Balance") before purchase insertion.

### 5.3 Deterministic ID Generation & Stability
- **Finding:** Replaced `Math.random()` in earlier scripts with deterministic indexing (`generateDeterministicItemId(parentId, childProductId, index)`).
- **Classification:** `[VERIFIED: SOURCE CODE]`
- **Verification:** Ran automated two-pass comparison; 100% of generated IDs are identical and collision-free across runs.

### 5.4 Stock Invariant & Conservation Verification
- **Finding:** Total Physical Inventory across all 6,281 products equals 469,962 base units (pieces). Total Batch Quantity across all 4,649 batches equals 469,962 base units.
- **Classification:** `[VERIFIED: READ-ONLY DB INSPECTION]`
- **Variance:** **Zero (0 pieces variance)**. The base units are 100% consistent across inventory and batches.
- **Stock State Invariant:** Formula $\text{Available} = \text{Physical} - (\text{Reserved} + \text{Damaged} + \text{Expired})$ holds with 0 violations across all 6,281 inventory rows.

---

## 6. Rollback Script Defect Audit & Phase 1C Remediation

- **Defect 1: Broad Deletes:** `backups/surgical_rollback_plan.sql` originally contained `DELETE FROM products WHERE business_id = 'biz-saifee';`. This wipes pre-existing records and post-migration additions.
- **Defect 2: psql Backslash Syntax:** Script used `\set session_id ...`, which fails in Supabase SQL Editor and is ignored in dollar-quoted procedural blocks.
- **Defect 3: SECURITY DEFINER Caller Authorization:** Inside a PostgreSQL `SECURITY DEFINER` function, `current_user` evaluates to the function owner (`postgres`), NOT the invoking caller. Relying on `current_user` allowed any caller to execute privileged rollback.
  - **Remediation:** `[VERIFIED: SOURCE CODE]` Redesigned authorization to verify `session_user` (the connecting role) and the authenticated Supabase JWT context (`auth.jwt()`). Strictly revoked `EXECUTE` privileges from `PUBLIC`, `anon`, and `authenticated`, granting access only to `service_role` and `postgres`.
- **Defect 4: Incomplete Table Coverage & Missing Mutation Guards:** Earlier rollback procedures omitted child tables (`payment_allocations`, `sales_return_items`, `payments`, `sales_returns`, `stock_ledger`) and did not detect post-migration business changes.
  - **Remediation:** `[VERIFIED: SOURCE CODE]` Extended the deletion manifest to cover all 28 managed database tables in exact reverse-dependency order. Implemented fail-closed mutation guards detecting post-migration invoice payments (`paid_amount > 0`), order status advancements (`status != 'pending'`), inventory batch stock consumption, and payment allocations.
- **Defect 5: Generic Restoration Assumptions:** Claiming generic restoration on updated rows without full previous audit snapshots risks silent data loss.
  - **Remediation:** `[VERIFIED: SOURCE CODE]` Procedure strictly restores company JOY to its previous snapshot values (`name = 'Joy Personal Care'`, `code = 'JOY'`, `active = true`, `id = '3a5d6db1...'`). If an update is detected on any unsupported table or without a previous snapshot, rollback fails closed.
- **Defect 6: Schema Deployment Atomicity:**
  - **Remediation:** `[VERIFIED: SOURCE CODE]` Verified that `schema_migration_reviewed.sql` runs within an atomic `BEGIN ... COMMIT` transaction. Verified that zero non-transactional statements (`VACUUM`, `CREATE INDEX CONCURRENTLY`, etc.) are present.

---

## 7. Audit Classification Matrix

| Item / Finding | Classification | Impact |
|---|---|---|
| Hardcoded anonymous JWT in client code | `[VERIFIED: SOURCE CODE]` | Standard for Supabase client, but requires strict RLS enforcement |
| Snapshot key `fmcg_cloud_database_v1` untouched | `[VERIFIED: READ-ONLY DB INSPECTION]` | Source data is 100% preserved and verified with SHA-256 |
| 10 tables missing in live Supabase | `[VERIFIED: READ-ONLY DB INSPECTION]` | Requires Phase 1B DDL migration |
| Pre-existing company `JOY` (`3a5d6db1-...`) | `[VERIFIED: READ-ONLY DB INSPECTION]` | Requires reconciliation with snapshot `'c-joy'` |
| PostgreSQL UUID PKs vs Snapshot String IDs | `[BLOCKER REQUIRING HUMAN APPROVAL]` | Must approve UUID $\rightarrow$ TEXT conversion plan |
| Opening Stock Purchase Voucher (₹54.8M) | `[BLOCKER REQUIRING HUMAN APPROVAL]` | Must approve accounting segregation of opening stock |
| Random ID generation in importer | `[VERIFIED: SOURCE CODE]` | Repaired to deterministic indexing in reviewed importer |
| Dangerous `business_id` deletion in rollback | `[VERIFIED: SOURCE CODE]` | Repaired to ID-manifest surgical rollback |
| Browser IndexedDB/LocalStorage usage | `[VERIFIED: SOURCE CODE]` | Phase 2 architectural removal required |
| Real PostgreSQL Staging Test Execution | `[BLOCKER REQUIRING HUMAN APPROVAL]` | Blocked pending isolated staging database provisioning |
