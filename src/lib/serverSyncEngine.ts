/**
 * Server-Side Incremental Synchronization Engine
 * Saifee FMCG Wholesale Distribution & Trade Management System
 * File: src/lib/serverSyncEngine.ts
 *
 * SAFETY & ARCHITECTURE PRINCIPLES:
 * 1. STRICT SERVER-ONLY: Never imported or executed in browser client bundles.
 * 2. TENANT ISOLATION: business_id derived strictly from validated HMAC session.
 * 3. INCREMENTAL DELTAS: Only downloads changed records (updated_at > since).
 * 4. STALE OVERWRITE DEFENSE: Compares timestamps; prevents stale offline changes from
 *    overwriting newer server records.
 * 5. APPEND-ONLY IMMUTABILITY: Protects stock_ledger and audit logs from updates or deletions.
 * 6. TRANSACTION CONTROL: Atomic execution of pushed change sets with rollback on failure.
 * 7. DELETION TOMBSTONES: Propagates deletions reliably to offline clients.
 */

import { PoolClient } from 'pg';
import {
  ServerTenantContext,
  validateTenantAccess,
  getDatabasePool,
  sanitizeDatabaseError,
  DatabaseError
} from './serverDb';

// ----------------------------------------------------------------------------
// 1. STRICT SERVER-ONLY ENFORCEMENT
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  throw new Error('[CRITICAL SECURITY VIOLATION]: serverSyncEngine must only be executed on the server!');
}

// ----------------------------------------------------------------------------
// 2. TYPE DEFINITIONS
// ----------------------------------------------------------------------------

export interface SyncTombstone {
  table: string;
  id: string;
  deleted_at: string;
}

export interface SyncConflict {
  table: string;
  id: string;
  reason: string;
  server_record?: any;
  client_record?: any;
}

export interface SyncPullRequest {
  since?: string | null;
  limit?: number;
  offset?: number;
  tables?: string[];
}

export interface SyncPullResponse {
  success: boolean;
  serverTimestamp: string;
  hasMore: boolean;
  changes: {
    products?: any[];
    categories?: any[];
    product_categories?: any[];
    companies?: any[];
    godowns?: any[];
    retailers?: any[];
    suppliers?: any[];
    profiles?: any[];
    orders?: any[];
    order_items?: any[];
    invoices?: any[];
    invoice_items?: any[];
    payments?: any[];
    inventory?: any[];
    inventory_batches?: any[];
    stock_ledger?: any[];
    customer_ledger?: any[];
    billing_rate_audit_logs?: any[];
    item_activity_logs?: any[];
    invoice_audits?: any[];
    cash_flow_transactions?: any[];
  };
  tombstones: SyncTombstone[];
}

export interface SyncPushRequest {
  clientSyncTimestamp: string;
  business_id?: string;
  changes: {
    products?: any[];
    categories?: any[];
    product_categories?: any[];
    companies?: any[];
    godowns?: any[];
    retailers?: any[];
    suppliers?: any[];
    profiles?: any[];
    orders?: any[];
    order_items?: any[];
    invoices?: any[];
    invoice_items?: any[];
    payments?: any[];
    inventory?: any[];
    inventory_batches?: any[];
    stock_ledger?: any[];
    customer_ledger?: any[];
    billing_rate_audit_logs?: any[];
    item_activity_logs?: any[];
    invoice_audits?: any[];
    cash_flow_transactions?: any[];
  };
  tombstones?: SyncTombstone[];
}

export interface SyncPushResponse {
  success: boolean;
  serverSyncTimestamp: string;
  appliedCount: number;
  conflicts: SyncConflict[];
  rejectedLedgersCount: number;
}

// Strictly append-only tables that must never be updated or deleted
const APPEND_ONLY_TABLES = new Set([
  'stock_ledger',
  'billing_rate_audit_logs',
  'item_activity_logs',
  'invoice_audits',
  'customer_ledger'
]);

// ----------------------------------------------------------------------------
// 3. SERVER INCREMENTAL PULL
// ----------------------------------------------------------------------------

export async function executeServerSyncPull(
  context: ServerTenantContext,
  params: SyncPullRequest
): Promise<SyncPullResponse> {
  const activeBiz = context.businessId;
  const pool = getDatabasePool();
  const serverTimestamp = new Date().toISOString();
  const since = params.since ? new Date(params.since).toISOString() : '1970-01-01T00:00:00.000Z';
  const limitPerTable = Math.min(Math.max(1, params.limit || 1000), 5000);
  const pageOffset = Math.max(0, Math.floor(params.offset || 0));

  const changes: SyncPullResponse['changes'] = {};
  const tombstones: SyncTombstone[] = [];

  // Helper to query incremental deltas for tenant-scoped tables
  async function fetchTableDeltas(
    table: string,
    timeCol: 'updated_at' | 'created_at' | 'date',
    hasTenantCol = true
  ): Promise<any[]> {
    try {
      const sql = hasTenantCol
        ? `SELECT * FROM ${table} WHERE business_id = $1 AND ${timeCol} > $2 ORDER BY ${timeCol} ASC, id ASC LIMIT $3 OFFSET $4;`
        : `SELECT * FROM ${table} WHERE ${timeCol} > $1 ORDER BY ${timeCol} ASC, id ASC LIMIT $2 OFFSET $3;`;

      const queryParams = hasTenantCol ? [activeBiz, since, limitPerTable, pageOffset] : [since, limitPerTable, pageOffset];
      const res = await pool.query(sql, queryParams);
      return res.rows;
    } catch (err: any) {
      console.warn(`[SERVER_SYNC_PULL_WARN]: Delta query warning for table "${table}":`, err?.message);
      return [];
    }
  }

  let hasMore = false;

  // 1. Master entities
  changes.products = await fetchTableDeltas('products', 'updated_at');
  if (changes.products.length >= limitPerTable) hasMore = true;

  changes.categories = await fetchTableDeltas('categories', 'updated_at');
  if (changes.categories.length >= limitPerTable) hasMore = true;

  changes.companies = await fetchTableDeltas('companies', 'created_at', false);
  changes.godowns = await fetchTableDeltas('godowns', 'updated_at');
  changes.retailers = await fetchTableDeltas('retailers', 'updated_at');
  changes.suppliers = await fetchTableDeltas('suppliers', 'created_at');

  // Tenant-isolated profiles query (NEVER leak password_hash or other tenants' data)
  try {
    const profRes = await pool.query(
      `SELECT id, business_id, email, mobile, phone, contact_no, name, full_name, role, profile_type,
              sales_role_type, trade_scope, custom_role, department, company_id, retailer_id,
              assigned_company_ids, assigned_category_ids, category_access_mode,
              active, status, created_at, updated_at
       FROM profiles
       WHERE business_id = $1 AND updated_at > $2
       ORDER BY updated_at ASC, id ASC LIMIT $3 OFFSET $4;`,
      [activeBiz, since, limitPerTable, pageOffset]
    );
    changes.profiles = profRes.rows;
    if (changes.profiles.length >= limitPerTable) hasMore = true;
  } catch (profErr: any) {
    console.warn('[SERVER_SYNC_PULL_WARN]: Profiles delta query warning:', profErr?.message);
    changes.profiles = [];
  }

  // 2. Junction table: product_categories (strictly tenant-scoped by joining products)
  try {
    const pcRes = await pool.query(
      `SELECT pc.id, pc.product_id, pc.category_id, pc.created_at
       FROM product_categories pc
       JOIN products p ON pc.product_id = p.id
       WHERE p.business_id = $1 AND pc.created_at > $2
       ORDER BY pc.created_at ASC, pc.id ASC LIMIT $3 OFFSET $4;`,
      [activeBiz, since, limitPerTable, pageOffset]
    );
    changes.product_categories = pcRes.rows;
    if (changes.product_categories.length >= limitPerTable) hasMore = true;
  } catch (pcErr: any) {
    console.warn('[SERVER_SYNC_PULL_WARN]: product_categories delta query warning:', pcErr?.message);
    changes.product_categories = [];
  }

  // 3. Inventory & Batches
  changes.inventory = await fetchTableDeltas('inventory', 'updated_at');
  changes.inventory_batches = await fetchTableDeltas('inventory_batches', 'created_at');

  // 4. Transactions
  changes.orders = await fetchTableDeltas('orders', 'updated_at');
  if (changes.orders.length >= limitPerTable) hasMore = true;

  changes.invoices = await fetchTableDeltas('invoices', 'updated_at');
  if (changes.invoices.length >= limitPerTable) hasMore = true;

  changes.payments = await fetchTableDeltas('payments', 'date');

  // 5. Append-only Ledgers & Audits
  changes.stock_ledger = await fetchTableDeltas('stock_ledger', 'created_at');
  if (changes.stock_ledger.length >= limitPerTable) hasMore = true;

  changes.customer_ledger = await fetchTableDeltas('customer_ledger', 'created_at');
  changes.billing_rate_audit_logs = await fetchTableDeltas('billing_rate_audit_logs', 'created_at');
  changes.item_activity_logs = await fetchTableDeltas('item_activity_logs', 'created_at');
  changes.invoice_audits = await fetchTableDeltas('invoice_audits', 'created_at');
  changes.cash_flow_transactions = await fetchTableDeltas('cash_flow_transactions', 'created_at');

  // Any table that filled a full page may have more rows on the next page
  hasMore = Object.values(changes).some(rows => Array.isArray(rows) && rows.length >= limitPerTable);

  // 6. Query Tombstones (records soft-deleted or marked inactive since `since`)
  try {
    const tombstoneCheck = await pool.query(
      `SELECT 'products' AS table, id, updated_at AS deleted_at FROM products WHERE business_id = $1 AND active = FALSE AND updated_at > $2
       UNION ALL
       SELECT 'categories' AS table, id, updated_at AS deleted_at FROM categories WHERE business_id = $1 AND active = FALSE AND updated_at > $2
       UNION ALL
       SELECT 'retailers' AS table, id, updated_at AS deleted_at FROM retailers WHERE business_id = $1 AND active = FALSE AND updated_at > $2
       UNION ALL
       SELECT 'godowns' AS table, id, updated_at AS deleted_at FROM godowns WHERE business_id = $1 AND (status = 'inactive' OR status = 'disabled') AND updated_at > $2
       LIMIT 500;`,
      [activeBiz, since]
    );
    tombstoneCheck.rows.forEach(r => {
      tombstones.push({
        table: r.table,
        id: r.id,
        deleted_at: r.deleted_at
      });
    });
  } catch (tErr: any) {
    console.warn('[SERVER_SYNC_PULL_WARN]: Tombstone query notice:', tErr?.message);
  }

  return {
    success: true,
    serverTimestamp,
    hasMore,
    changes,
    tombstones
  };
}

// ----------------------------------------------------------------------------
// 4. SERVER INCREMENTAL PUSH (TRANSACTIONAL & PROTECTED)
// ----------------------------------------------------------------------------

export async function executeServerSyncPush(
  context: ServerTenantContext,
  payload: SyncPushRequest
): Promise<SyncPushResponse> {
  // 1. Strict Tenant Verification (Reject Client Spoofing)
  const activeBiz = validateTenantAccess(context, payload.business_id);
  const pool = getDatabasePool();
  const serverSyncTimestamp = new Date().toISOString();

  const conflicts: SyncConflict[] = [];
  let appliedCount = 0;
  let rejectedLedgersCount = 0;

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [activeBiz]);

    const changes = payload.changes || {};
    const serverEpoch = new Date(serverSyncTimestamp).getTime();

    // Ensure default fallback company exists for product foreign key integrity
    await client.query(
      `INSERT INTO companies (id, name, code, active)
       VALUES ('comp-general', 'General FMCG', 'GENERAL', true)
       ON CONFLICT (code) DO NOTHING;`
    );

    // ------------------------------------------------------------------------
    // A. CATEGORIES PUSH
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.categories) && changes.categories.length > 0) {
      for (const cat of changes.categories) {
        if (!cat.id || !cat.name) continue;
        await client.query(
          `INSERT INTO categories (id, business_id, name, description, active)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (business_id, name) DO UPDATE SET
             description = EXCLUDED.description,
             active = EXCLUDED.active,
             updated_at = CURRENT_TIMESTAMP;`,
          [cat.id, activeBiz, cat.name, cat.description || null, cat.active !== false]
        );
        appliedCount++;
      }
    }

    // ------------------------------------------------------------------------
    // A2. GODOWNS PUSH (last-write-wins, tenant-guarded, one bad row never blocks sync)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.godowns) && changes.godowns.length > 0) {
      for (const g of changes.godowns) {
        if (!g || !g.id || !g.name || !g.code) continue;
        await client.query('SAVEPOINT sp_master_row');
        try {
          if (g.is_default === true) {
            await client.query(
              `UPDATE godowns SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE business_id = $1 AND id <> $2 AND is_default = TRUE;`,
              [activeBiz, g.id]
            );
          }
          const gRes = await client.query(
            `INSERT INTO godowns (id, business_id, company_id, code, name, address, city, state, pincode, manager_name, phone, is_default, status)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               code = EXCLUDED.code,
               name = EXCLUDED.name,
               address = EXCLUDED.address,
               city = EXCLUDED.city,
               state = EXCLUDED.state,
               pincode = EXCLUDED.pincode,
               manager_name = EXCLUDED.manager_name,
               phone = EXCLUDED.phone,
               is_default = EXCLUDED.is_default,
               status = EXCLUDED.status,
               updated_at = CURRENT_TIMESTAMP
             WHERE godowns.business_id = EXCLUDED.business_id;`,
            [
              g.id, activeBiz, String(g.code).trim(), String(g.name).trim(),
              g.address || null, g.city || null, g.state || null, g.pincode || null,
              g.manager_name || null, g.phone || null,
              g.is_default === true, g.status === 'Inactive' ? 'Inactive' : 'Active'
            ]
          );
          await client.query('RELEASE SAVEPOINT sp_master_row');
          if (gRes.rowCount) appliedCount++;
        } catch (rowErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT sp_master_row');
          conflicts.push({
            table: 'godowns',
            id: g.id,
            reason: rowErr?.code === '23505'
              ? 'Godown code already exists for this business. Choose a different code.'
              : 'Godown could not be saved to the cloud database.',
            client_record: g
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // A3. SUPPLIERS PUSH (GSTIN optional; unique per business only when filled)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.suppliers) && changes.suppliers.length > 0) {
      for (const sup of changes.suppliers) {
        if (!sup || !sup.id || !sup.name) continue;
        await client.query('SAVEPOINT sp_master_row');
        try {
          const supRes = await client.query(
            `INSERT INTO suppliers (id, business_id, name, gstin, address, active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               gstin = EXCLUDED.gstin,
               address = EXCLUDED.address,
               active = EXCLUDED.active
             WHERE suppliers.business_id = EXCLUDED.business_id;`,
            [
              sup.id, activeBiz, String(sup.name).trim(),
              (sup.gstin && String(sup.gstin).trim()) || null,
              sup.address || null, sup.active !== false
            ]
          );
          await client.query('RELEASE SAVEPOINT sp_master_row');
          if (supRes.rowCount) appliedCount++;
        } catch (rowErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT sp_master_row');
          conflicts.push({
            table: 'suppliers',
            id: sup.id,
            reason: rowErr?.code === '23505'
              ? 'A supplier with this GSTIN already exists.'
              : 'Supplier could not be saved to the cloud database. (Run the suppliers migration SQL if this repeats.)',
            client_record: sup
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // B. PRODUCTS PUSH WITH ANTI-STALE & CONCURRENT CONFLICT DETECTION
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.products) && changes.products.length > 0) {
      for (const p of changes.products) {
        if (!p.id || !p.name) continue;

        const serverProdRes = await client.query(
          `SELECT id, name, mrp, selling_price, updated_at FROM products WHERE id = $1 AND business_id = $2;`,
          [p.id, activeBiz]
        );

        if (serverProdRes.rows.length > 0) {
          const sProd = serverProdRes.rows[0];
          const serverTime = new Date(sProd.updated_at || 0).getTime();
          let clientTime = new Date(p.updated_at || p.updatedAt || 0).getTime();

          // Defend against forward clock skew (skew > 60 seconds capped to server time)
          if (clientTime > serverEpoch + 60000) {
            clientTime = serverEpoch;
          }

          // STALE OVERWRITE DEFENSE
          if (serverTime > clientTime && clientTime > 0) {
            conflicts.push({
              table: 'products',
              id: p.id,
              reason: `Stale offline update: Server record updated at ${sProd.updated_at} is newer than client timestamp ${p.updated_at}. Server version preserved.`,
              server_record: sProd,
              client_record: p
            });
            continue;
          }

          // EQUAL TIMESTAMP CONFLICT DETECTION: If timestamps match but values differ, prevent silent overwrite
          if (serverTime === clientTime && clientTime > 0) {
            const isIdentical = sProd.name === p.name &&
              Number(sProd.mrp) === Number(p.mrp) &&
              Number(sProd.selling_price) === Number(p.selling_price);

            if (!isIdentical) {
              conflicts.push({
                table: 'products',
                id: p.id,
                reason: `Concurrent modification conflict: Record was concurrently modified with identical timestamp. Manual reconciliation required.`,
                server_record: sProd,
                client_record: p
              });
              continue;
            }
          }

          // Apply updated fields
          await client.query(
            `UPDATE products SET
              name = $3, mrp = $4, selling_price = $5,
              pack_size = COALESCE($6, pack_size),
              active = COALESCE($7, active),
              updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND business_id = $2;`,
            [p.id, activeBiz, p.name, p.mrp, p.selling_price, p.pack_size, p.active !== false]
          );
          appliedCount++;
        } else {
          // Insert new product
          await client.query(
            `INSERT INTO products (
              id, business_id, product_code, name, company_id, brand, category,
              pack_size, trading_unit, base_unit, mrp, selling_price, purchase_price,
              hsn, gst_percent, active
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13,
              $14, $15, $16
            ) ON CONFLICT (business_id, product_code) DO NOTHING;`,
            [
              p.id, activeBiz, p.product_code || `PRD-${Date.now().toString().slice(-6)}`,
              p.name, p.company_id || 'comp-general', p.brand || 'General', p.category || 'General',
              p.pack_size || '1 unit', p.trading_unit || 'Carton', p.base_unit || 'Piece',
              p.mrp || 100, p.selling_price || 90, p.purchase_price || 80,
              p.hsn || '19053100', p.gst_percent || 18, p.active !== false
            ]
          );
          appliedCount++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // C. RETAILERS PUSH WITH ANTI-STALE CONFLICT DETECTION
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.retailers) && changes.retailers.length > 0) {
      for (const r of changes.retailers) {
        if (!r.id || !r.shop_name) continue;

        const serverRetRes = await client.query(
          `SELECT id, shop_name, outstanding, credit_limit, updated_at FROM retailers WHERE id = $1 AND business_id = $2;`,
          [r.id, activeBiz]
        );

        if (serverRetRes.rows.length > 0) {
          const sRet = serverRetRes.rows[0];
          const serverTime = new Date(sRet.updated_at || 0).getTime();
          let clientTime = new Date(r.updated_at || r.updatedAt || 0).getTime();

          if (clientTime > serverEpoch + 60000) clientTime = serverEpoch;

          if (serverTime > clientTime && clientTime > 0) {
            conflicts.push({
              table: 'retailers',
              id: r.id,
              reason: `Stale offline update: Server retailer modified at ${sRet.updated_at} is newer than client timestamp ${r.updated_at}.`,
              server_record: sRet,
              client_record: r
            });
            continue;
          }

          await client.query(
            `UPDATE retailers SET
              shop_name = $3, owner_name = COALESCE($4, owner_name), mobile = COALESCE($5, mobile),
              city = COALESCE($6, city), credit_limit = COALESCE($7, credit_limit), active = COALESCE($8, active),
              updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND business_id = $2;`,
            [r.id, activeBiz, r.shop_name, r.owner_name, r.mobile, r.city, r.credit_limit, r.active !== false]
          );
          appliedCount++;
        } else {
          await client.query(
            `INSERT INTO retailers (
              id, business_id, retailer_code, shop_name, owner_name, address, state_code, mobile, city, credit_limit, active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING;`,
            [
              r.id, activeBiz, r.retailer_code || `RET-${Date.now().toString().slice(-4)}`,
              r.shop_name, r.owner_name || '', r.address || '', r.state_code || '23',
              r.mobile || '0000000000', r.city || 'Khachrod', r.credit_limit || 50000, r.active !== false
            ]
          );
          appliedCount++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // D. ORDERS PUSH (TRANSACTIONAL & SCHEMA-COMPLIANT)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.orders) && changes.orders.length > 0) {
      for (const ord of changes.orders) {
        if (!ord.id || !ord.order_number) continue;

        const serverOrdRes = await client.query(
          `SELECT id, status, total_amount FROM orders WHERE id = $1 AND business_id = $2;`,
          [ord.id, activeBiz]
        );

        if (serverOrdRes.rows.length > 0) {
          const sOrd = serverOrdRes.rows[0];
          // Protect Confirmed / Dispatched orders from being silently reverted by offline client
          if (sOrd.status === 'Completed' || sOrd.status === 'Dispatched') {
            conflicts.push({
              table: 'orders',
              id: ord.id,
              reason: `Order ${ord.order_number} has already been ${sOrd.status} on the server. Offline changes rejected.`,
              server_record: sOrd,
              client_record: ord
            });
            continue;
          }

          await client.query(
            `UPDATE orders SET
              status = $3, total_amount = $4, order_notes = COALESCE($5, order_notes),
              updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND business_id = $2;`,
            [ord.id, activeBiz, ord.status || 'Draft', ord.total_amount, ord.notes || ord.order_notes || null]
          );
          appliedCount++;
        } else {
          // Normalize source and status to satisfy schema CHECK constraints
          const validSources = ['distributor_salesperson', 'company_salesperson', 'retailer_direct', 'counter_sale'];
          const normalizedSource = validSources.includes(ord.source) ? ord.source : 'distributor_salesperson';

          const validStatuses = [
            'Draft', 'Submitted', 'Under Review', 'Confirmed', 'Partially Confirmed',
            'Packing', 'PACKING_IN_PROGRESS', 'Packed', 'PACKED_AND_SEALED',
            'Ready for Dispatch', 'Partially Dispatched', 'Dispatched', 'Delivered',
            'Cancelled', 'Partially Fulfilled', 'Fully Fulfilled', 'Completed'
          ];
          const normalizedStatus = validStatuses.includes(ord.status) ? ord.status : 'Submitted';

          await client.query(
            `INSERT INTO orders (
              id, business_id, order_number, retailer_id, source, channel,
              order_date, total_amount, status, order_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING;`,
            [
              ord.id, activeBiz, ord.order_number, ord.retailer_id,
              normalizedSource, ord.channel || 'Direct',
              ord.order_date || serverSyncTimestamp, ord.total_amount || 0,
              normalizedStatus, ord.notes || ord.order_notes || null
            ]
          );
          appliedCount++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // E. INVOICES PUSH (TRANSACTIONAL)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.invoices) && changes.invoices.length > 0) {
      for (const inv of changes.invoices) {
        if (!inv.id || !inv.invoice_number) continue;

        const serverInvRes = await client.query(
          `SELECT id, invoice_number, grand_total, status, updated_at FROM invoices WHERE id = $1 AND business_id = $2;`,
          [inv.id, activeBiz]
        );

        if (serverInvRes.rows.length > 0) {
          await client.query(
            `UPDATE invoices SET
              subtotal = $3, grand_total = $4, taxable_value = $5,
              status = COALESCE($6, status), payment_status = COALESCE($7, payment_status),
              updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND business_id = $2;`,
            [
              inv.id, activeBiz, inv.subtotal || 0, inv.grand_total || inv.total_amount || 0,
              inv.taxable_value || inv.subtotal || 0, inv.status || 'Confirmed', inv.payment_status || 'Unpaid'
            ]
          );
          appliedCount++;
        } else {
          await client.query(
            `INSERT INTO invoices (
              id, business_id, invoice_number, retailer_id, date,
              subtotal, grand_total, taxable_value, outstanding_amount, status, payment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING;`,
            [
              inv.id, activeBiz, inv.invoice_number, inv.retailer_id,
              inv.date || serverSyncTimestamp, inv.subtotal || 0,
              inv.grand_total || inv.total_amount || 0, inv.taxable_value || inv.subtotal || 0,
              inv.outstanding_amount || inv.grand_total || 0, inv.status || 'Confirmed',
              inv.payment_status || 'Unpaid'
            ]
          );
          appliedCount++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // F. PAYMENTS PUSH (TRANSACTIONAL)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.payments) && changes.payments.length > 0) {
      for (const pay of changes.payments) {
        if (!pay.id || !pay.retailer_id) continue;
        const validMethods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit', 'Other'];
        const method = validMethods.includes(pay.method) ? pay.method : 'Cash';
        const payNum = pay.payment_number || `PAY-${Date.now().toString().slice(-6)}`;

        await client.query(
          `INSERT INTO payments (
            id, business_id, retailer_id, payment_number, amount, method, reference_number, notes, date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING;`,
          [
            pay.id, activeBiz, pay.retailer_id, payNum,
            pay.amount || 0, method, pay.reference_number || null,
            pay.notes || null, pay.date || serverSyncTimestamp
          ]
        );
        appliedCount++;
      }
    }

    // ------------------------------------------------------------------------
    // G. INVENTORY PUSH (UPSERT BY COMPOSITE UNIQUE KEY)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.inventory) && changes.inventory.length > 0) {
      for (const invRow of changes.inventory) {
        if (!invRow.product_id) continue;
        await client.query(
          `INSERT INTO inventory (id, business_id, godown_id, product_id, physical_qty, reserved_qty, available_qty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (business_id, product_id, godown_id)
           DO UPDATE SET
             physical_qty = EXCLUDED.physical_qty,
             reserved_qty = EXCLUDED.reserved_qty,
             available_qty = EXCLUDED.available_qty,
             updated_at = CURRENT_TIMESTAMP;`,
          [
            invRow.id || `inv-${activeBiz}-${invRow.product_id}`,
            activeBiz, invRow.godown_id || null, invRow.product_id,
            invRow.physical_qty || 0, invRow.reserved_qty || 0,
            invRow.available_qty || Math.max(0, (invRow.physical_qty || 0) - (invRow.reserved_qty || 0))
          ]
        );
        appliedCount++;
      }
    }

    // ------------------------------------------------------------------------
    // D. STRICT APPEND-ONLY LEDGERS (PROTECT IMMUTABILITY)
    // ------------------------------------------------------------------------
    if (Array.isArray(changes.stock_ledger) && changes.stock_ledger.length > 0) {
      for (const led of changes.stock_ledger) {
        if (!led.id || !led.product_id || led.change_qty === undefined) continue;

        // Check if ledger ID already exists on server
        const existingLedger = await client.query(
          `SELECT id, change_qty, reason FROM stock_ledger WHERE id = $1 AND business_id = $2;`,
          [led.id, activeBiz]
        );

        if (existingLedger.rows.length > 0) {
          // IMMUTABILITY DEFENSE: Append-only ledgers can NEVER be altered!
          const existing = existingLedger.rows[0];
          if (existing.change_qty !== led.change_qty || existing.reason !== led.reason) {
            rejectedLedgersCount++;
            conflicts.push({
              table: 'stock_ledger',
              id: led.id,
              reason: `CRITICAL SECURITY: Attempted update on immutable stock_ledger record "${led.id}" was rejected. Existing change_qty ${existing.change_qty} preserved.`
            });
          }
          // Already recorded, skip insert (idempotent re-transmission)
          continue;
        }

        // Insert new immutable entry
        await client.query(
          `INSERT INTO stock_ledger (
            id, business_id, product_id, godown_id, change_qty, direction,
            reason, reference_id, user_id, batch_number, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING;`,
          [
            led.id, activeBiz, led.product_id, led.godown_id || null,
            led.change_qty, led.direction || 'IN', led.reason || 'Sync Inward',
            led.reference_id || null, led.user_id || context.userId,
            led.batch_number || null, led.created_at || serverSyncTimestamp
          ]
        );
        appliedCount++;
      }
    }

    // Customer Ledger (Strictly Append-Only Immutability)
    if (Array.isArray(changes.customer_ledger) && changes.customer_ledger.length > 0) {
      for (const cLed of changes.customer_ledger) {
        if (!cLed.id || !cLed.retailer_id) continue;

        const existingCustLed = await client.query(
          `SELECT id, amount, entry_type FROM customer_ledger WHERE id = $1 AND business_id = $2;`,
          [cLed.id, activeBiz]
        );

        if (existingCustLed.rows.length > 0) {
          const ex = existingCustLed.rows[0];
          if (Number(ex.amount) !== Number(cLed.amount) || ex.entry_type !== cLed.entry_type) {
            rejectedLedgersCount++;
            conflicts.push({
              table: 'customer_ledger',
              id: cLed.id,
              reason: `CRITICAL SECURITY: Attempted update on immutable customer_ledger record "${cLed.id}" was rejected. Amount ${ex.amount} preserved.`
            });
          }
          continue;
        }

        const validEntryTypes = ['DEBIT', 'CREDIT', 'INVOICE', 'PAYMENT', 'RETURN', 'ADJUSTMENT'];
        const entryType = validEntryTypes.includes(cLed.entry_type) ? cLed.entry_type : 'DEBIT';

        await client.query(
          `INSERT INTO customer_ledger (
            id, business_id, retailer_id, entry_type, category, reference_number,
            description, amount, running_balance, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING;`,
          [
            cLed.id, activeBiz, cLed.retailer_id, entryType,
            cLed.category || null, cLed.reference_number || null,
            cLed.description || null, cLed.amount || 0,
            cLed.running_balance || 0, cLed.created_at || serverSyncTimestamp
          ]
        );
        appliedCount++;
      }
    }

    // Protect Audit Logs from update/deletion
    if (Array.isArray(changes.billing_rate_audit_logs)) {
      for (const audit of changes.billing_rate_audit_logs) {
        if (!audit.id) continue;
        await client.query(
          `INSERT INTO billing_rate_audit_logs (
            id, business_id, order_id, retailer_id, product_id, catalogue_rate,
            order_time_rate, manual_billing_rate, final_applied_rate, admin_user_id,
            admin_user_name, reason, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING;`,
          [
            audit.id, activeBiz, audit.order_id || null, audit.retailer_id || null,
            audit.product_id || null, audit.catalogue_rate || 0, audit.order_time_rate || 0,
            audit.manual_billing_rate || 0, audit.final_applied_rate || 0,
            audit.admin_user_id || context.userId, audit.admin_user_name || context.name,
            audit.reason || 'Rate Override', audit.created_at || serverSyncTimestamp
          ]
        );
        appliedCount++;
      }
    }

    // ------------------------------------------------------------------------
    // E. TOMBSTONES PROCESSING (SOFT-DELETION PROPAGATION)
    // ------------------------------------------------------------------------
    if (Array.isArray(payload.tombstones) && payload.tombstones.length > 0) {
      for (const tomb of payload.tombstones) {
        if (!tomb.table || !tomb.id) continue;

        // IMMUTABILITY DEFENSE: Disallow tombstones on append-only ledgers
        if (APPEND_ONLY_TABLES.has(tomb.table)) {
          conflicts.push({
            table: tomb.table,
            id: tomb.id,
            reason: `CRITICAL SECURITY: Cannot delete append-only immutable ledger table "${tomb.table}".`
          });
          continue;
        }

        // For soft-deletable tables, mark active = false
        if (['products', 'categories', 'retailers', 'godowns'].includes(tomb.table)) {
          await client.query(
            `UPDATE ${tomb.table} SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND business_id = $2;`,
            [tomb.id, activeBiz]
          );
          appliedCount++;
        }
      }
    }

    await client.query('COMMIT');
  } catch (err: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rErr) {
        console.warn('[SERVER_SYNC_PUSH_ROLLBACK]: Failed to rollback transaction:', rErr);
      }
    }
    throw sanitizeDatabaseError(err, 'Incremental sync push transaction failed');
  } finally {
    if (client) {
      client.release();
    }
  }

  return {
    success: true,
    serverSyncTimestamp,
    appliedCount,
    conflicts,
    rejectedLedgersCount
  };
}
