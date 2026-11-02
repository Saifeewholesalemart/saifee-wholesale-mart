# Server Database Role, PostgreSQL Privileges & Row Level Security (RLS) Architecture
**Saifee FMCG Wholesale Distribution & Trade Management System**
**Date:** 2026-10-28  
**Scope:** Task 3 — Server-Side PostgreSQL Access & Tenant Security

---

## 1. Executive Summary & Critical RLS Reality

In PostgreSQL and Supabase, **Row Level Security (RLS) is not an automatic silver bullet for server-side code**.

### The Critical Pitfall
When a Node.js / Next.js backend connects to Supabase or PostgreSQL using standard administrative credentials (`postgres`, `service_role`, or database superuser roles), PostgreSQL grants the **`BYPASSRLS`** attribute to that connection.
> **Warning:** Queries executed via `service_role` or superuser connections **completely bypass all RLS policies**. A query like `SELECT * FROM products;` executed via a service role connection returns records across **ALL tenants**, ignoring every `CREATE POLICY` directive.

### The Defense-in-Depth Solution
To achieve zero-trust multi-tenant isolation, the application implements a strict **four-layer security model**:
1. **Application-Layer HMAC Session Validation:** Every request validates a cryptographic HMAC-SHA256 session token (`saifee_session`). `business_id` is extracted strictly from the token payload and never trusted from client-supplied body, query, or header parameters.
2. **Mandatory Query Parameterization ($1):** All server queries in [`src/lib/serverDb.ts`](file:///d:/saifee-general-stores-pwa/src/lib/serverDb.ts) automatically prepend `WHERE business_id = $1` with the session's verified tenant ID.
3. **Transaction Session Setting (`app.current_business_id`):** Every tenant transaction executes:
   ```sql
   SELECT set_config('app.current_business_id', $1, true);
   ```
   This ensures that any PostgreSQL stored procedures, audit triggers, and database-level functions (like `get_current_business_id()`) operate in the correct tenant context.
4. **Dedicated Restricted Database Role (Recommended for Production Poolers):** Connecting via a dedicated `fmcg_app_user` role that does NOT have `BYPASSRLS` enabled, forcing PostgreSQL to actively enforce RLS policies even if an application query omits a WHERE clause.

---

## 2. PostgreSQL Role Privilege Matrix

| Database Role | Privileges | `BYPASSRLS`? | Usage in FMCG System | Security Controls |
| :--- | :--- | :--- | :--- | :--- |
| **`postgres` / `superuser`** | All DDL, DML, Superuser | Yes | Initial Schema Migration & DDL execution only. | Never used in normal application runtime. Never exposed to web environment. |
| **`service_role` (Supabase)** | Full table access | Yes | Emergency maintenance, automated nightly backups. | Must use `executeTenantScopedQuery` with explicit `$1` tenant parameter. Never exposed to browser. |
| **`fmcg_app_user` (Target App Role)** | `SELECT`, `INSERT`, `UPDATE`, `DELETE` on public tables | **NO** | Production connection pooler (`serverDb.ts`). | RLS policies are **strictly enforced by the database kernel**. Must call `set_config('app.current_business_id', ...)` to view rows. |
| **`anon` / public client** | Minimal / None | No | Supabase public gateway. | Anon key has **zero access** to wholesale tenant data. All business endpoints require server authentication. |

---

## 3. RLS Strategy in `clean_rebuild_schema.sql`

In `supabase/clean_rebuild_schema.sql`, Section 18 establishes:

### 3.1 Session Getter Function
```sql
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_business_id', true),
        auth.jwt() ->> 'business_id',
        ''
    );
END;
$$ LANGUAGE plpgsql STABLE;
```
- When called from a web server transaction, `current_setting('app.current_business_id', true)` reads the local setting set by `executeTenantTransaction`.
- If called via Supabase PostgREST JWT, it falls back to the JWT claim `auth.jwt() ->> 'business_id'`.
- If neither is present, it returns `''`, causing tenant isolation policies to match zero rows (secure default deny).

### 3.2 Tenant Isolation Policies
```sql
CREATE POLICY "tenant_isolation_policy_products" ON products
    FOR ALL USING (business_id = get_current_business_id());

CREATE POLICY "tenant_isolation_policy_orders" ON orders
    FOR ALL USING (business_id = get_current_business_id());

CREATE POLICY "tenant_isolation_policy_invoices" ON invoices
    FOR ALL USING (business_id = get_current_business_id());

CREATE POLICY "tenant_isolation_policy_inventory" ON inventory
    FOR ALL USING (business_id = get_current_business_id());

CREATE POLICY "tenant_isolation_policy_stock_ledger" ON stock_ledger
    FOR ALL USING (business_id = get_current_business_id());
```

---

## 4. Server-Side Authorization Model

The application enforces a 5-tier role hierarchy server-side in [`src/lib/serverDb.ts`](file:///d:/saifee-general-stores-pwa/src/lib/serverDb.ts):

```
                   +------------------------+
                   | Platform Administrator | (Multi-tenant governance, system health)
                   +------------------------+
                               |
                               v
                   +------------------------+
                   |  Tenant Administrator  | (Business owner/admin; full access to tenant data)
                   +------------------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|  Salesperson (Dist.)  |             |  Salesperson (Co.)    |
| (All tenant brands)   |             | (Assigned brand only) |
+-----------------------+             +-----------------------+
            |                                     |
            +------------------+------------------+
                               |
                               v
                   +------------------------+
                   |     Staff / Packer     | (Packing, lot fulfillment, warehouse operations)
                   +------------------------+
                               |
                               v
                   +------------------------+
                   |   Retailer Customer    | (Self-service ordering, own invoices only)
                   +------------------------+
```

### Authorization Rules Enforced in `serverDb.ts`:
1. **Retailer Self-Scope:**
   - When `context.isRetailer` is true, `getTenantOrders()` automatically injects `AND o.retailer_id = $userId`. Retailers can **never** query or receive orders belonging to other retailers.
2. **Salesperson Scope:**
   - Distributor salespersons (`sales_dist`) have access to all catalogue brands within the tenant.
   - Company salespersons (`sales_co`) have restricted brand scope (`trade_scope = 'RESTRICTED'`) and can only view products matching their assigned `company_id`.
3. **Tenant Admin Scope:**
   - Full read/write within their `businessId`.
   - Cannot query or mutate data of other business companies (`validateTenantAccess` throws `TenantMismatchError`).
4. **Platform Admin Scope:**
   - Authorized cross-tenant queries for multi-business consolidation reports only.

---

## 5. Security Checklist & Verification

- [x] **No hardcoded credentials:** Passwords and keys are never hardcoded or committed to git.
- [x] **Server-only runtime guard:** `typeof window !== 'undefined'` check halts client-side execution.
- [x] **Zero `NEXT_PUBLIC_` leakage:** Server database URL is read strictly from `DATABASE_URL` / `POSTGRES_URL`.
- [x] **Parameterized queries only:** Dynamic SQL string interpolation with user input is strictly prohibited.
- [x] **Cryptographic HMAC session:** Tamper-proof cookie signing prevents role and business ID escalation.
- [x] **Error sanitization:** Stack traces and connection URLs are stripped before returning to clients.
