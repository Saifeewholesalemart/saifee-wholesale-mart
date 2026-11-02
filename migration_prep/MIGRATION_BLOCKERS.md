# Comprehensive Migration Blockers & Gate Verification
**Saifee General Stores FMCG Wholesale Distribution & Trade ERP**  
**Phase 1C Remediation & Safety Gate Audit**

---

## 1. Blocker Status Dashboard

| Item / Check | Category | Scope / Impact | Status | Verification Evidence / Gate Condition |
|---|---|---|:---:|---|
| **Invoice 1524 GST Reconciliation** | Financial | Reconcile ₹806 difference on 160 pcs @ ₹28 | **PASS** | Proven: ₹4,480 + 18% GST (₹806.40) - ₹0.40 roundoff = ₹5,286.00 |
| **Supplier Count & Identity Reconciliation**| Relational | 2 source $\rightarrow$ 3 target suppliers (+1) | **PASS** | Proven: Only `supp-vyapar-opening` missing; `s-prashant-medico` in source |
| **Inventory Conservation & Stock Invariants** | Stock Cons. | Available = Phys - (Res + Dam + Exp) & Phys = Batch | **PASS** | 469,962 Phys = 469,962 Batch across 6,281 products. Variance = 0 |
| **Per-Product Stock Conservation** | Stock Cons. | Compare Physical vs Batch per individual product | **PASS** | Verified: 0 mismatches across all 6,281 products |
| **Unbypassable Negative Batch Check** | Integrity | Reject negative batch quantities unconditionally | **PASS** | Implemented per-item hard rejection in importer & test harness |
| **Deterministic Importer IDs** | Code Logic | Eliminating `Math.random()` | **PASS** | Repaired: Stable deterministic indexing verified across runs |
| **Pure PostgreSQL Rollback Procedure** | Data Safety | Eliminating `\set` and broad deletes | **PASS** | Repaired: Pure PL/pgSQL function with mutation checks & dry-run preview |
| **Rollback Caller Authorization** | Security | Verify caller identity in SECURITY DEFINER | **PASS** | Repaired: Checks `session_user` and `auth.jwt()`; revoked from PUBLIC/anon/authenticated |
| **Rollback Mutation Guard** | Data Safety | Fail closed if imported row was mutated post-migration | **PASS** | Safeguard 4 checks post-migration invoice payments, order updates, stock depletions |
| **Pre-Existing Record Restoration** | Data Safety | Dynamic restoration of pre-existing records | **PASS** | Repaired: Reads before-image from audit log; no hardcoded UUIDs or fields |
| **Dynamic Source Reconciliation Counts** | Importer Logic | Eliminating hardcoded counts | **PASS** | Repaired: All counts derived dynamically from source snapshot collections |
| **Raw Snapshot Checksum Before Normalization** | Importer Logic | Unaltered SHA-256 computation before decompression | **PASS** | Repaired: Raw checksum computed on payload before decompression/parsing |
| **Importer Configuration & Credential Safety** | Security | No hardcoded URLs or fallback JWTs | **PASS** | Repaired: Strict environment variable checks; rejects service_role keys in client |
| **Fail-Closed Schema Preflight** | Schema DDL | Explicit prerequisite checks for tables/columns | **PASS** | Repaired: Section 0 audit block checks `companies`, `profiles`, `business_companies`, `company_members` |
| **Missing Columns Defense (`ADD COLUMN IF NOT EXISTS`)** | Schema DDL | Defend against `CREATE TABLE IF NOT EXISTS` omission | **PASS** | Repaired: Explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on all schema entities |
| **Granular RLS Permission Matrix** | Security | Separate SELECT, INSERT, UPDATE, DELETE by role | **PASS** | Repaired: Full matrix for admin, salesperson, member, anon, service_role implemented |
| **Salesperson Financial & Stock Isolation** | Security | Prevent salespersons from altering invoices/stock | **PASS** | Repaired: Salesperson restricted to draft orders, receipt logging, and return booking |
| **Real PostgreSQL Staging Test Execution** | Testing | Test on isolated PostgreSQL/Supabase DB | **NOT TESTED** | **CRITICAL BLOCKER:** Isolated staging PostgreSQL DB not yet provisioned |
| **Opening-Stock Voucher Accounting Approval** | Accounting | Flagging ₹54.8M voucher as opening stock | **AWAITING APPROVAL** | **BLOCKER:** Pending formal business accounting confirmation |
| **UUID vs. TEXT Primary Key Conversion** | Schema DDL | Converting empty tables to TEXT PK/FKs | **AWAITING APPROVAL** | **BLOCKER:** Requires user authorization per Phase B/C rules |
| **Company JOY Pre-Existing ID Reconciliation**| Master Data | Reconciling `'3a5d6db1...'` to `'c-joy'` | **AWAITING APPROVAL** | **BLOCKER:** Requires user authorization per Phase B/C rules |

---

## 2. In-Depth Technical Analysis: Company JOY Primary-Key Migration

### 2.1 Current Production State (Read-Only Verified)
In the live production Supabase database:
- Table `companies` contains exactly 1 row:
  ```json
  {
    "id": "3a5d6db1-c75d-41d6-a695-9836049d5e85",
    "name": "Joy Personal Care",
    "code": "JOY",
    "active": true,
    "created_at": "2026-10-13T18:00:31.357351+00:00"
  }
  ```
- Constraint: `companies_code_key UNIQUE(code)`
- Primary Key Type: `UUID`

### 2.2 Complete Foreign Key Dependency Map (Direct & Indirect)
Every direct and indirect foreign key dependency in the schema referencing `companies.id` was enumerated:

#### Direct Foreign Keys Referencing `companies.id`:
| Referencing Table | Foreign Key Column | Constraint Name | Current Type | Target Type | Current Production Rows |
|---|---|---|:---:|:---:|:---:|
| **`products`** | `company_id` | `products_company_id_fkey` | `UUID` | `TEXT` | 0 rows |
| **`profiles`** | `company_id` | `profiles_company_id_fkey` | `UUID` | `TEXT` | 0 rows |

*(Note: Table `company_members` references `business_companies(id)`, which is the tenant organization table, NOT the brand table `companies`).*

#### Indirect Foreign Key Dependencies (Cascading from `products.id`):
| Table | Column | References | Current Production Rows | Impact of Company Migration |
|---|---|---|:---:|---|
| **`inventory`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |
| **`inventory_batches`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |
| **`order_items`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |
| **`invoice_items`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |
| **`purchase_items`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |
| **`delivery_challan_items`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |
| **`stock_ledger`** | `product_id` | `products(id)` | 0 rows | Protected via cascade |

### 2.3 Snapshot Company Distribution Across Products
Forensic analysis of the 6,281 products in the source snapshot reveals:
- **`c-joy`**: Referenced by **1 product** (`prd-1791814926751-67d5b`, "Joy Skin Fruits Face Wash").
- **`comp-1792068589189-3r0e`**: Referenced by **6,280 products** (Company code: `'GENE'`, Name: `'General FMCG'`).
- Both company records exist in `tables.companies` within the snapshot.
- In the live database, only company `'JOY'` is present (`3a5d6db1-c75d-41d6-a695-9836049d5e85`).
- **Collision Risk:** Attempting to insert `{ id: 'c-joy', code: 'JOY', name: 'joy' }` without updating the pre-existing row causes an immediate unique key violation on `companies_code_key`.
- **Referential Risk:** If `companies.id` remains the original UUID, any product referencing `'c-joy'` fails foreign key validation.

### 2.4 Safe Forward Migration Plan (Guarded & Dependency-Ordered)
1. **Drop Referencing Foreign Keys:**
   ```sql
   ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;
   ALTER TABLE products DROP CONSTRAINT IF EXISTS products_company_id_fkey;
   ```
2. **Alter Column Types to TEXT with Default:**
   ```sql
   ALTER TABLE companies ALTER COLUMN id TYPE TEXT USING id::TEXT;
   ALTER TABLE companies ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
   ALTER TABLE profiles ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
   ALTER TABLE products ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;
   ```
3. **Execute In-Place Identity Reconciliation:**
   ```sql
   UPDATE companies 
   SET id = 'c-joy', name = 'Joy Personal Care' 
   WHERE code = 'JOY' AND id = '3a5d6db1-c75d-41d6-a695-9836049d5e85';
   ```
4. **Re-add Foreign Keys with Cascading Updates:**
   ```sql
   ALTER TABLE profiles 
       ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) 
       REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL;
       
   ALTER TABLE products 
       ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) 
       REFERENCES companies(id) ON UPDATE CASCADE;
   ```

### 2.5 Tested Restoration Plan (Dynamic Restoration from Before-Images)
If rollback is executed:
1. Step 6 of `execute_surgical_rollback` queries `migration_audit_log` for rows with `action = 'UPDATE'` and `table_name = 'companies'`.
2. Restores `id`, `name`, `code`, and `active` dynamically from `previous_snapshot` (no hardcoded UUID or column assumptions).
3. If structural type reversion is required, constraints are dropped, columns reverted to UUID, and constraints re-added.

---

## 3. Real PostgreSQL Staging Test Requirements (Status Matrix)

| Test ID | Test Scenario Description | Synthetic Engine | Real PostgreSQL / Supabase | Status | Notes / Blockers |
|---|---|:---:|:---:|:---:|---|
| **ST-01** | Clean schema creation | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-02** | Re-running migration (Idempotency) | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-03** | Atomic rollback on migration failure | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-04** | Foreign-key constraint enforcement | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-05** | Native PostgreSQL RLS across 5 roles | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-06** | Cross-business tenant isolation | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-07** | Interrupted import and safe resume | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-08** | Rollback with unrelated pre-existing records| PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-09** | Rollback abort on post-migration mutation | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-10** | Quantitative financial & stock totals | PASS | PASS (Dry-Run) | **PASS** | Exact zero-variance match verified on source snapshot |
| **ST-11** | Snapshot immutability & raw hash | PASS | PASS (Verified) | **PASS** | SHA-256 fingerprint verified before and after (`cb119ecb...`) |
| **ST-12** | Per-product stock conservation | PASS | PASS (Dry-Run) | **PASS** | 0 mismatches across all 6,281 products |
| **ST-13** | Negative batch quantity rejection | PASS | PASS (Dry-Run) | **PASS** | Hard unbypassable rejection verified |
| **ST-14** | Salesperson financial/inventory isolation | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-15** | Dry-run zero-write guarantee | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |
| **ST-16** | Dynamic pre-existing record restoration | PASS | NOT TESTED | **BLOCKED** | Isolated staging PostgreSQL DB not yet provisioned |

---

## 4. Final Go / No-Go Checklist

| Gate Condition | Required State | Current Verified State | Status |
|---|---|---|:---:|
| **1. Zero Production Writes** | No SQL executed against production database | Checked: `wxctglnnybhhptkxwxur` untouched | **GO** |
| **2. Immutable Snapshot Retention** | `system_settings.fmcg_cloud_database_v1` preserved | Verified hash `cb119ecb...` unchanged | **GO** |
| **3. Offline Fallback Preservation** | IndexedDB & localStorage intact in app | Preserved in `src/lib/db.ts` & `src/lib/indexedDbStorage.ts` | **GO** |
| **4. Fail-Closed Schema Preflight** | Audits prerequisite tables, types, and columns | Implemented in `schema_migration_reviewed.sql` Section 0 | **GO** |
| **5. Add Column Idempotency** | No reliance on `CREATE TABLE IF NOT EXISTS` for columns | Implemented explicit `ALTER TABLE ADD COLUMN IF NOT EXISTS` | **GO** |
| **6. Granular Table RLS Matrix** | Separate SELECT, INSERT, UPDATE, DELETE by role | Enforced across all 28 tables in SQL & documented | **GO** |
| **7. Salesperson Mutation Safeguards** | Salespeople cannot alter invoices, inventory, ledgers | Enforced by RLS policies; tested in harness | **GO** |
| **8. Rollback Caller Identity & Least Privilege** | Checks `session_user` / `auth.jwt()`; revoke from public | Implemented in `rollback_plan_reviewed.sql`; tested | **GO** |
| **9. Rollback Mutation Detection** | Aborts if imported row altered or has dependants | Safeguard 4 checks invoices, orders, stock depletions | **GO** |
| **10. Dynamic Before-Image Restoration** | Restores all fields from audit before-image | Implemented dynamically; no hardcoded UUIDs | **GO** |
| **11. Importer Credential Safety** | Fails before network if variables missing; no defaults | Verified: Throws error without hardcoded URL/key fallbacks | **GO** |
| **12. Raw Checksum Tracking** | Computes raw payload hash before decompression | Implemented: Computes SHA-256 on raw payload string | **GO** |
| **13. Real PostgreSQL Staging Execution** | 100% pass on isolated staging PostgreSQL database | **NOT TESTED:** Staging infrastructure not provided | **NO-GO** |
| **14. Commercial vs Opening-Stock Accounting Approval** | Formal sign-off on ₹54.8M opening voucher treatment | **BLOCKED:** Pending explicit business accounting approval | **NO-GO** |

---

## 5. Explicit Production-Readiness Verdict

**VERDICT: STRICTLY NOT PRODUCTION READY (NO-GO)**

### Summary of Decisions & Missing Prerequisites:
1. **Real PostgreSQL Staging DB Required:** Neither local Docker, `psql`, nor a staging Supabase instance is available in the current environment. Testing was verified up to the maximum possible depth in the synthetic relational simulation engine (16/16 PASS), but real PostgreSQL validation must occur on an isolated staging database before any production execution.
2. **Accounting Sign-off Required:** The ₹54,821,438.45 opening-stock balance must receive formal accounting classification to confirm it should not be booked as an accounts payable liability.
3. **Master Data Reconciliation Approval Required:** The reconciliation of brand `'JOY'` (`3a5d6db1-...` to `'c-joy'`) and conversion of empty primary/foreign key columns from UUID to TEXT requires explicit customer authorization.
