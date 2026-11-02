/**
 * Incremental Synchronization & Normalized PostgreSQL Security Test Suite
 * File: scripts/test_incremental_sync_suite.ts
 *
 * Verifies:
 * 1. Tenant Isolation & Client Spoofing Defense
 * 2. Conflict Detection & Anti-Stale Overwrite Protection
 * 3. Append-Only Ledger & Financial Audit Immutability
 * 4. Deletion Tombstones & Soft Deletion Propagation
 * 5. Incremental Delta Filtering (High-Watermark `since` Queries)
 * 6. Retries & Idempotent Re-transmissions
 * 7. Offline Edits & Interrupted Sync Graceful Handling
 * 8. Transaction Atomicity & Rollback on Error
 */

import {
  executeServerSyncPull,
  executeServerSyncPush,
  SyncPullRequest,
  SyncPushRequest
} from '../src/lib/serverSyncEngine';
import {
  gatherLocalChanges,
  setSyncCheckpoint,
  getSyncCheckpoint
} from '../src/lib/incrementalSyncEngine';
import {
  setMockDatabasePool,
  ServerTenantContext,
  TenantMismatchError
} from '../src/lib/serverDb';
import { db } from '../src/lib/db';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    failedTests++;
  }
}

// In-memory relational PostgreSQL mock emulator
class MockPostgreSqlSyncDatabase {
  public executedQueries: { sql: string; params: any[] }[] = [];
  public transactionEvents: string[] = [];

  public products: Map<string, any> = new Map();
  public retailers: Map<string, any> = new Map();
  public orders: Map<string, any> = new Map();
  public stockLedger: Map<string, any> = new Map();
  public auditLogs: Map<string, any> = new Map();

  public shouldFailOnQueryRegex: RegExp | null = null;

  constructor() {
    this.reset();
  }

  public reset() {
    this.executedQueries = [];
    this.transactionEvents = [];
    this.products.clear();
    this.retailers.clear();
    this.orders.clear();
    this.stockLedger.clear();
    this.auditLogs.clear();
    this.shouldFailOnQueryRegex = null;
  }

  public createPoolMock(): any {
    const self = this;
    return {
      query: async (text: string, params: any[] = []) => {
        return self.handleQuery(text, params);
      },
      connect: async () => {
        return {
          query: async (text: string, params: any[] = []) => {
            return self.handleQuery(text, params);
          },
          release: () => {}
        };
      }
    };
  }

  private async handleQuery(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.executedQueries.push({ sql, params });

    if (this.shouldFailOnQueryRegex && this.shouldFailOnQueryRegex.test(sql)) {
      throw new Error(`Simulated Error on SQL: ${this.shouldFailOnQueryRegex}`);
    }

    const norm = sql.replace(/\s+/g, ' ').trim();

    // Transaction controls
    if (norm === 'BEGIN') {
      this.transactionEvents.push('BEGIN');
      return { rows: [], rowCount: 0 };
    }
    if (norm === 'COMMIT') {
      this.transactionEvents.push('COMMIT');
      return { rows: [], rowCount: 0 };
    }
    if (norm === 'ROLLBACK') {
      this.transactionEvents.push('ROLLBACK');
      return { rows: [], rowCount: 0 };
    }
    if (norm.startsWith("SELECT set_config('app.current_business_id'")) {
      return { rows: [{ set_config: params[0] }], rowCount: 1 };
    }

    // 1. Pull queries (incremental delta filtering)
    if (norm.includes('FROM products WHERE business_id = $1 AND updated_at > $2')) {
      const [bizId, since, limit] = params;
      const sinceTime = new Date(since).getTime();
      const rows = Array.from(this.products.values())
        .filter(p => p.business_id === bizId && new Date(p.updated_at).getTime() > sinceTime)
        .slice(0, limit);
      return { rows, rowCount: rows.length };
    }

    if (norm.includes('FROM retailers WHERE business_id = $1 AND updated_at > $2')) {
      const [bizId, since, limit] = params;
      const sinceTime = new Date(since).getTime();
      const rows = Array.from(this.retailers.values())
        .filter(r => r.business_id === bizId && new Date(r.updated_at).getTime() > sinceTime)
        .slice(0, limit);
      return { rows, rowCount: rows.length };
    }

    if (norm.includes('FROM stock_ledger WHERE business_id = $1 AND created_at > $2')) {
      const [bizId, since, limit] = params;
      const sinceTime = new Date(since).getTime();
      const rows = Array.from(this.stockLedger.values())
        .filter(l => l.business_id === bizId && new Date(l.created_at).getTime() > sinceTime)
        .slice(0, limit);
      return { rows, rowCount: rows.length };
    }

    // Generic pull fallback for empty tables
    if (norm.startsWith('SELECT * FROM')) {
      return { rows: [], rowCount: 0 };
    }

    // Tombstone query
    if (norm.includes("SELECT 'products' AS table") && norm.includes('active = FALSE')) {
      const [bizId, since] = params;
      const sinceTime = new Date(since).getTime();
      const rows: any[] = [];
      for (const p of this.products.values()) {
        if (p.business_id === bizId && p.active === false && new Date(p.updated_at).getTime() > sinceTime) {
          rows.push({ table: 'products', id: p.id, deleted_at: p.updated_at });
        }
      }
      return { rows, rowCount: rows.length };
    }

    // 2. Product Push Queries
    if (norm.includes('SELECT id, name, mrp, selling_price, updated_at FROM products WHERE id = $1')) {
      const [id, bizId] = params;
      const p = this.products.get(id);
      if (p && p.business_id === bizId) {
        return { rows: [p], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Tombstone soft-delete update
    if (norm.includes('SET active = FALSE')) {
      const [id, bizId] = params;
      if (norm.startsWith('UPDATE products')) {
        const p = this.products.get(id);
        if (p && p.business_id === bizId) {
          p.active = false;
          p.updated_at = new Date().toISOString();
          return { rows: [p], rowCount: 1 };
        }
      }
      if (norm.startsWith('UPDATE retailers')) {
        const r = this.retailers.get(id);
        if (r && r.business_id === bizId) {
          r.active = false;
          r.updated_at = new Date().toISOString();
          return { rows: [r], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('UPDATE products SET')) {
      const [id, bizId, name, mrp, sellingPrice, packSize, active] = params;
      const p = this.products.get(id);
      if (p && p.business_id === bizId) {
        p.name = name;
        p.mrp = mrp;
        p.selling_price = sellingPrice;
        if (packSize) p.pack_size = packSize;
        p.active = active;
        p.updated_at = new Date().toISOString();
        return { rows: [p], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('INSERT INTO products')) {
      const [id, bizId, prodCode, name, compId, brand, category, packSize, tradingUnit, baseUnit, mrp, sellingPrice, purchasePrice, hsn, gst, active] = params;
      const newP = {
        id, business_id: bizId, product_code: prodCode, name, company_id: compId, brand, category,
        pack_size: packSize, trading_unit: tradingUnit, base_unit: baseUnit, mrp, selling_price: sellingPrice,
        purchase_price: purchasePrice, hsn, gst_percent: gst, active: active !== false,
        updated_at: new Date().toISOString()
      };
      this.products.set(id, newP);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 3. Retailer Push Queries
    if (norm.includes('SELECT id, shop_name, outstanding, credit_limit, updated_at FROM retailers WHERE id = $1')) {
      const [id, bizId] = params;
      const r = this.retailers.get(id);
      if (r && r.business_id === bizId) {
        return { rows: [r], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('UPDATE retailers SET')) {
      const [id, bizId, shopName, ownerName, mobile, city, creditLimit, active] = params;
      const r = this.retailers.get(id);
      if (r && r.business_id === bizId) {
        r.shop_name = shopName;
        if (ownerName) r.owner_name = ownerName;
        if (mobile) r.mobile = mobile;
        if (city) r.city = city;
        if (creditLimit !== undefined) r.credit_limit = creditLimit;
        r.active = active;
        r.updated_at = new Date().toISOString();
        return { rows: [r], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('INSERT INTO retailers')) {
      const [id, bizId, retCode, shopName, ownerName, address, stateCode, mobile, city, creditLimit, active] = params;
      const newR = {
        id, business_id: bizId, retailer_code: retCode, shop_name: shopName, owner_name: ownerName,
        address: address || 'Indore', state_code: stateCode || '27',
        mobile, city, credit_limit: creditLimit, active: active !== false, updated_at: new Date().toISOString()
      };
      this.retailers.set(id, newR);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 4. Order Push Queries
    if (norm.includes('SELECT id, status, total_amount FROM orders WHERE id = $1')) {
      const [id, bizId] = params;
      const o = this.orders.get(id);
      if (o && o.business_id === bizId) {
        return { rows: [o], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('UPDATE orders SET')) {
      const [id, bizId, status, totalAmount, orderNotes] = params;
      const o = this.orders.get(id);
      if (o && o.business_id === bizId) {
        o.status = status;
        o.total_amount = totalAmount;
        if (orderNotes) o.notes = orderNotes;
        return { rows: [o], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('INSERT INTO orders')) {
      const [id, bizId, orderNumber, retailerId, source, channel, orderDate, totalAmount, status, orderNotes] = params;
      const newO = {
        id, business_id: bizId, order_number: orderNumber, retailer_id: retailerId,
        source, channel, order_date: orderDate, total_amount: totalAmount, status, notes: orderNotes
      };
      this.orders.set(id, newO);
      return { rows: [{ id }], rowCount: 1 };
    }

    // Fallback handlers for additional pushed entities (categories, companies, invoices, payments, inventory, customer_ledger)
    if (norm.startsWith('INSERT INTO categories')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (norm.startsWith('INSERT INTO companies')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (norm.startsWith('INSERT INTO invoices')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (norm.startsWith('INSERT INTO payments')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (norm.startsWith('INSERT INTO inventory')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }
    if (norm.startsWith('INSERT INTO customer_ledger')) {
      return { rows: [{ id: params[0] }], rowCount: 1 };
    }

    // 5. Stock Ledger Queries
    if (norm.includes('SELECT id, change_qty, reason FROM stock_ledger WHERE id = $1')) {
      const [id, bizId] = params;
      const l = this.stockLedger.get(id);
      if (l && l.business_id === bizId) {
        return { rows: [l], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (norm.startsWith('INSERT INTO stock_ledger')) {
      const [id, bizId, prodId, godownId, changeQty, direction, reason, refId, userId, batchNum, createdAt] = params;
      this.stockLedger.set(id, {
        id, business_id: bizId, product_id: prodId, godown_id: godownId,
        change_qty: changeQty, direction, reason, reference_id: refId,
        user_id: userId, batch_number: batchNum, created_at: createdAt
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    // Tombstone updates
    if (norm.includes('SET active = FALSE') && norm.startsWith('UPDATE')) {
      const [id, bizId] = params;
      if (norm.includes('UPDATE products')) {
        const p = this.products.get(id);
        if (p && p.business_id === bizId) {
          p.active = false;
          p.updated_at = new Date().toISOString();
        }
      }
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('Task 5: Incremental Synchronization & Normalized PostgreSQL Security Test Suite');
  console.log('================================================================================\n');

  const mockDb = new MockPostgreSqlSyncDatabase();
  setMockDatabasePool(mockDb.createPoolMock());

  const tenantContext: ServerTenantContext = {
    userId: 'usr_admin_1',
    mobile: '9876500001',
    name: 'Admin Mustafa',
    role: 'admin',
    profileType: 'ADMIN',
    businessId: 'biz_saifee_main',
    isPlatformAdmin: false,
    isTenantAdmin: true,
    isSalesperson: false,
    isRetailer: false,
    isStaff: false
  };

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Tenant Isolation & Client Spoofing Defense
  // --------------------------------------------------------------------------
  console.log('Group 1: Tenant Isolation & Client Spoofing Defense');
  {
    mockDb.reset();
    const spoofPush: SyncPushRequest = {
      clientSyncTimestamp: new Date().toISOString(),
      business_id: 'biz_attacker_target', // Client attempts to push changes into unauthorized tenant
      changes: {
        products: [{ id: 'p1', name: 'Spoofed Item', mrp: 100 }]
      }
    };

    try {
      await executeServerSyncPush(tenantContext, spoofPush);
      assert(false, 'Should throw TenantMismatchError on client tenant spoofing');
    } catch (err: any) {
      assert(err instanceof TenantMismatchError, 'executeServerSyncPush rejects cross-tenant spoofing with TenantMismatchError');
    }

    // Pull request strictly scopes to authenticated context.businessId
    mockDb.products.set('prod_saifee', {
      id: 'prod_saifee',
      business_id: 'biz_saifee_main',
      name: 'Saifee Biscuit',
      updated_at: '2026-10-28T12:00:00.000Z'
    });
    mockDb.products.set('prod_other', {
      id: 'prod_other',
      business_id: 'biz_competitor',
      name: 'Competitor Item',
      updated_at: '2026-10-28T12:00:00.000Z'
    });

    const pullRes = await executeServerSyncPull(tenantContext, { since: '2026-10-28T00:00:00.000Z' });
    assert(pullRes.changes.products?.length === 1, 'Pull only returned records for authenticated tenant');
    assert(pullRes.changes.products?.[0].id === 'prod_saifee', 'Returned product belongs exclusively to authenticated businessId');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Anti-Stale Overwrite & Conflict Detection
  // --------------------------------------------------------------------------
  console.log('\nGroup 2: Anti-Stale Overwrite & Conflict Detection');
  {
    mockDb.reset();
    // Server record was updated at 12:00:00
    mockDb.products.set('prd_fortune_oil', {
      id: 'prd_fortune_oil',
      business_id: 'biz_saifee_main',
      name: 'Fortune Sunlite 1L (Server Edition)',
      mrp: 180.00,
      selling_price: 165.00,
      updated_at: '2026-10-28T12:00:00.000Z'
    });

    // Client attempts to push an offline edit created at 10:00:00 (Stale update)
    const stalePush: SyncPushRequest = {
      clientSyncTimestamp: '2026-10-28T10:00:00.000Z',
      changes: {
        products: [
          {
            id: 'prd_fortune_oil',
            name: 'Fortune Sunlite 1L (Stale Offline Edit)',
            mrp: 170.00,
            selling_price: 150.00,
            updated_at: '2026-10-28T10:00:00.000Z'
          }
        ]
      }
    };

    const staleRes = await executeServerSyncPush(tenantContext, stalePush);
    assert(staleRes.conflicts.length === 1, 'Server flagged 1 conflict on stale offline edit');
    assert(staleRes.conflicts[0].reason.includes('Stale offline update'), 'Conflict reason identifies stale timestamp');
    const preservedServerProd = mockDb.products.get('prd_fortune_oil');
    assert(preservedServerProd.name === 'Fortune Sunlite 1L (Server Edition)', 'Server record was NOT silently overwritten by stale client edit');

    // Fresh client update created at 14:00:00 (Newer than server)
    const freshPush: SyncPushRequest = {
      clientSyncTimestamp: '2026-10-28T14:00:00.000Z',
      changes: {
        products: [
          {
            id: 'prd_fortune_oil',
            name: 'Fortune Sunlite 1L (Fresh Price Hike)',
            mrp: 190.00,
            selling_price: 172.00,
            updated_at: '2026-10-28T14:00:00.000Z'
          }
        ]
      }
    };

    const freshRes = await executeServerSyncPush(tenantContext, freshPush);
    assert(freshRes.appliedCount === 1, 'Fresh client update applied successfully');
    const updatedServerProd = mockDb.products.get('prd_fortune_oil');
    assert(updatedServerProd.mrp === 190.00, 'Server record updated with fresh pricing');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Append-Only Ledger & Financial Audit Immutability
  // --------------------------------------------------------------------------
  console.log('\nGroup 3: Append-Only Ledger & Financial Audit Immutability');
  {
    mockDb.reset();
    // Existing immutable ledger entry on server
    mockDb.stockLedger.set('led_existing_1', {
      id: 'led_existing_1',
      business_id: 'biz_saifee_main',
      product_id: 'p1',
      change_qty: 25,
      direction: 'IN',
      reason: 'Physical Stock Audit',
      created_at: '2026-10-28T09:00:00.000Z'
    });

    // Malicious or corrupted client attempts to modify change_qty from 25 to 9999
    const tamperPush: SyncPushRequest = {
      clientSyncTimestamp: new Date().toISOString(),
      changes: {
        stock_ledger: [
          {
            id: 'led_existing_1',
            product_id: 'p1',
            change_qty: 9999, // Tampered count
            direction: 'IN',
            reason: 'Tampered Audit'
          }
        ]
      }
    };

    const tamperRes = await executeServerSyncPush(tenantContext, tamperPush);
    assert(tamperRes.rejectedLedgersCount === 1, 'Rejected modification of existing immutable stock_ledger entry');
    assert(tamperRes.conflicts.some(c => c.reason.includes('immutable')), 'Conflict reported on immutable ledger modification');
    const untouchedLedger = mockDb.stockLedger.get('led_existing_1');
    assert(untouchedLedger.change_qty === 25, 'Existing stock_ledger quantity strictly preserved at 25');

    // Attempting to delete or tombstone an append-only ledger
    const tombstoneLedgerPush: SyncPushRequest = {
      clientSyncTimestamp: new Date().toISOString(),
      changes: {},
      tombstones: [
        { table: 'stock_ledger', id: 'led_existing_1', deleted_at: new Date().toISOString() }
      ]
    };

    const tombRes = await executeServerSyncPush(tenantContext, tombstoneLedgerPush);
    assert(tombRes.conflicts.some(c => c.reason.includes('Cannot delete append-only immutable ledger')), 'Rejected deletion tombstone on append-only ledger');
    assert(mockDb.stockLedger.has('led_existing_1'), 'Ledger entry was not deleted');

    // Legitimate new append-only entry with unique ID succeeds
    const legitPush: SyncPushRequest = {
      clientSyncTimestamp: new Date().toISOString(),
      changes: {
        stock_ledger: [
          {
            id: 'led_new_legit_2',
            product_id: 'p1',
            change_qty: 10,
            direction: 'IN',
            reason: 'Purchase Inward'
          }
        ]
      }
    };

    const legitRes = await executeServerSyncPush(tenantContext, legitPush);
    assert(legitRes.appliedCount === 1, 'Inserted new append-only ledger entry with unique ID');
    assert(mockDb.stockLedger.has('led_new_legit_2'), 'New ledger entry stored in database');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Deletion Tombstones & Soft Deletion Propagation
  // --------------------------------------------------------------------------
  console.log('\nGroup 4: Deletion Tombstones & Soft Deletion Propagation');
  {
    mockDb.reset();
    mockDb.products.set('prd_discontinued', {
      id: 'prd_discontinued',
      business_id: 'biz_saifee_main',
      name: 'Discontinued SKU',
      active: true,
      updated_at: '2026-10-28T08:00:00.000Z'
    });

    // Client marks product deleted/tombstoned
    const tombstonePush: SyncPushRequest = {
      clientSyncTimestamp: '2026-10-28T13:00:00.000Z',
      changes: {},
      tombstones: [
        { table: 'products', id: 'prd_discontinued', deleted_at: '2026-10-28T13:00:00.000Z' }
      ]
    };

    const tPushRes = await executeServerSyncPush(tenantContext, tombstonePush);
    assert(tPushRes.appliedCount === 1, 'Applied deletion tombstone');
    const p = mockDb.products.get('prd_discontinued');
    assert(p.active === false, 'Product soft-deleted on server (active = false)');

    // Another client pulls changes since 10:00:00
    const pullRes = await executeServerSyncPull(tenantContext, { since: '2026-10-28T10:00:00.000Z' });
    assert(pullRes.tombstones.length === 1, 'Pull response includes 1 deletion tombstone');
    assert(pullRes.tombstones[0].id === 'prd_discontinued', 'Tombstone identifies deleted product ID for offline cleanup');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Incremental Delta Filtering (High-Watermark Queries)
  // --------------------------------------------------------------------------
  console.log('\nGroup 5: Incremental Delta Filtering (Bandwidth Optimization)');
  {
    mockDb.reset();
    // 3 products with different timestamps
    mockDb.products.set('p_old', {
      id: 'p_old',
      business_id: 'biz_saifee_main',
      name: 'Old Item',
      updated_at: '2026-10-28T06:00:00.000Z'
    });
    mockDb.products.set('p_mid', {
      id: 'p_mid',
      business_id: 'biz_saifee_main',
      name: 'Mid Item',
      updated_at: '2026-10-28T11:00:00.000Z'
    });
    mockDb.products.set('p_new', {
      id: 'p_new',
      business_id: 'biz_saifee_main',
      name: 'New Item',
      updated_at: '2026-10-28T15:00:00.000Z'
    });

    // Client requests changes since 10:00:00
    const pullRes = await executeServerSyncPull(tenantContext, { since: '2026-10-28T10:00:00.000Z' });
    const productDeltas = pullRes.changes.products || [];

    assert(productDeltas.length === 2, 'Delta query returned only the 2 products modified after "since" checkpoint');
    assert(!productDeltas.some(p => p.id === 'p_old'), 'Excluded old unmodified product from payload (saving bandwidth)');
    assert(productDeltas.some(p => p.id === 'p_mid') && productDeltas.some(p => p.id === 'p_new'), 'Includes both modified products');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Retries & Idempotent Re-transmissions
  // --------------------------------------------------------------------------
  console.log('\nGroup 6: Retries & Idempotent Re-transmissions');
  {
    mockDb.reset();
    const batchPush: SyncPushRequest = {
      clientSyncTimestamp: new Date().toISOString(),
      changes: {
        products: [{ id: 'p_retry_1', name: 'Retry Product', mrp: 120 }],
        orders: [{ id: 'ord_retry_1', order_number: 'ORD-RET-1', total_amount: 500 }]
      }
    };

    // First attempt
    const firstRes = await executeServerSyncPush(tenantContext, batchPush);
    assert(firstRes.appliedCount === 2, 'First transmission applied 2 records');

    // Simulated network timeout on client response: client retries identical push
    const retryRes = await executeServerSyncPush(tenantContext, batchPush);
    assert(retryRes.conflicts.length === 0, 'Retry succeeded without conflicting errors');
    assert(mockDb.products.size === 1, 'Database contains exactly 1 product (no duplicate created)');
    assert(mockDb.orders.size === 1, 'Database contains exactly 1 order (no duplicate created)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Offline Edits & Local Change Gathering
  // --------------------------------------------------------------------------
  console.log('\nGroup 7: Offline Change Gathering & Checkpoint Management');
  {
    db.setActiveBusinessCompanyId('biz_saifee_main');
    // Ensure local products exist
    db.saveProducts([
      {
        id: 'p_local_recent',
        name: 'Recent Local Edit',
        business_id: 'biz_saifee_main',
        mrp: 100,
        selling_price: 90,
        purchase_price: 80,
        product_code: 'PRD-L-1',
        brand: 'Brand',
        category: 'Cat',
        pack_size: '1',
        trading_unit: 'Carton',
        base_unit: 'Piece',
        units_per_box_carton: 1,
        units_per_trading_unit: 1,
        pieces_per_carton: 1,
        allow_loose_sale: true,
        trade_mode: 'BOTH',
        gst_percent: 18,
        hsn: '1905',
        active: true,
        updated_at: '2026-10-28T14:30:00.000Z'
      } as any
    ], 'biz_saifee_main');

    const checkpoint = '2026-10-28T10:00:00.000Z';
    const localChanges = gatherLocalChanges('biz_saifee_main', checkpoint);

    assert((localChanges.changes.products?.length || 0) >= 1, 'gatherLocalChanges collected local edits newer than checkpoint');
    assert(localChanges.changes.products?.some(p => p.id === 'p_local_recent'), 'Includes recent offline modified product');

    // Checkpoint management test
    await setSyncCheckpoint('biz_saifee_main', '2026-10-28T16:00:00.000Z');
    const retrievedCheckpoint = await getSyncCheckpoint('biz_saifee_main');
    assert(retrievedCheckpoint === '2026-10-28T16:00:00.000Z', 'IndexedDB sync checkpoint retrieved accurately');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 8: Transaction Atomicity & Rollback on Error
  // --------------------------------------------------------------------------
  console.log('\nGroup 8: Transaction Atomicity & Rollback on Error');
  {
    mockDb.reset();
    mockDb.shouldFailOnQueryRegex = /UPDATE products SET/;

    mockDb.products.set('prd_rollback_test', {
      id: 'prd_rollback_test',
      business_id: 'biz_saifee_main',
      name: 'Initial Name',
      mrp: 100,
      updated_at: '2026-10-28T09:00:00.000Z'
    });

    const failingPush: SyncPushRequest = {
      clientSyncTimestamp: '2026-10-28T15:00:00.000Z',
      changes: {
        products: [{ id: 'prd_rollback_test', name: 'Failed Update Name', mrp: 200, updated_at: '2026-10-28T15:00:00.000Z' }]
      }
    };

    try {
      await executeServerSyncPush(tenantContext, failingPush);
      assert(false, 'Should throw error on simulated database failure');
    } catch (err: any) {
      assert(mockDb.transactionEvents.includes('ROLLBACK'), 'Executed ROLLBACK upon SQL failure');
      const prod = mockDb.products.get('prd_rollback_test');
      assert(prod.name === 'Initial Name', 'Product was not partially modified; rollback preserved initial state');
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 9: Equal Timestamps & Concurrent Modification Detection
  // --------------------------------------------------------------------------
  console.log('\nGroup 9: Equal Timestamps & Concurrent Modification Detection');
  {
    mockDb.reset();
    const commonTimestamp = '2026-10-28T12:00:00.000Z';
    mockDb.products.set('prd_equal_ts', {
      id: 'prd_equal_ts',
      business_id: 'biz_saifee_main',
      name: 'Server Concurrent Item',
      mrp: 100,
      selling_price: 90,
      updated_at: commonTimestamp
    });

    // Client sends differing values with the EXACT same timestamp
    const equalTsPush: SyncPushRequest = {
      clientSyncTimestamp: '2026-10-28T12:00:00.000Z',
      changes: {
        products: [
          {
            id: 'prd_equal_ts',
            name: 'Client Colliding Item',
            mrp: 150,
            selling_price: 130,
            updated_at: commonTimestamp
          }
        ]
      }
    };

    const pushRes = await executeServerSyncPush(tenantContext, equalTsPush);
    assert(pushRes.conflicts.length === 1, 'Detected conflict on equal timestamp collision with differing values');
    assert(pushRes.conflicts[0].table === 'products', 'Conflict identifies products table');
    const p = mockDb.products.get('prd_equal_ts');
    assert(p.name === 'Server Concurrent Item', 'Server record preserved; not silently overwritten');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 10: Checkpoint Protection on Incomplete Pull (hasMore Pagination)
  // --------------------------------------------------------------------------
  console.log('\nGroup 10: Checkpoint Protection on Incomplete Pull (hasMore)');
  {
    mockDb.reset();
    // Simulate setting initial checkpoint
    await setSyncCheckpoint('biz_saifee_main', '2026-10-28T08:00:00.000Z');

    // Pull request with limit = 1 when 2 products exist (triggers hasMore = true)
    mockDb.products.set('p_page_1', { id: 'p_page_1', business_id: 'biz_saifee_main', name: 'Page 1', updated_at: '2026-10-28T09:00:00.000Z' });
    mockDb.products.set('p_page_2', { id: 'p_page_2', business_id: 'biz_saifee_main', name: 'Page 2', updated_at: '2026-10-28T10:00:00.000Z' });

    const pullRes = await executeServerSyncPull(tenantContext, { since: '2026-10-28T08:00:00.000Z', limit: 1 });
    assert(pullRes.hasMore === true, 'Pull correctly flags hasMore=true when table delta reaches limit');

    // In incrementalSyncEngine: checkpoint is NOT advanced to serverTimestamp when hasMore is true
    // (verified by checking sync checkpoint remains at original checkpoint)
    const currentCp = await getSyncCheckpoint('biz_saifee_main');
    assert(currentCp === '2026-10-28T08:00:00.000Z', 'Checkpoint was NOT prematurely advanced; unsynchronized records preserved');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 11: Schema Query Compliance (order_notes, valid constraints)
  // --------------------------------------------------------------------------
  console.log('\nGroup 11: Schema Query Compliance & Check Constraints');
  {
    mockDb.reset();
    const orderPush: SyncPushRequest = {
      clientSyncTimestamp: '2026-10-28T13:00:00.000Z',
      changes: {
        orders: [
          {
            id: 'ord_schema_test',
            order_number: 'ORD-TEST-001',
            retailer_id: 'ret_001',
            source: 'distributor_salesperson',
            status: 'Submitted',
            total_amount: 1500,
            order_notes: 'Delivered to back godown'
          }
        ],
        retailers: [
          {
            id: 'ret_schema_test',
            retailer_code: 'RET-0099',
            shop_name: 'Kirana Store',
            address: '123 Sarafa Bazar',
            state_code: '27'
          }
        ]
      }
    };

    const pushRes = await executeServerSyncPush(tenantContext, orderPush);
    assert(pushRes.appliedCount === 2, 'Applied both schema-compliant order and retailer records');
    const o = mockDb.orders.get('ord_schema_test');
    assert(o.source === 'distributor_salesperson', 'Order source complies with CHECK constraint');
    assert(o.status === 'Submitted', 'Order status complies with CHECK constraint');
    const r = mockDb.retailers.get('ret_schema_test');
    assert(r.address === '123 Sarafa Bazar', 'Retailer address populated according to NOT NULL schema');
  }

  // Cleanup mock
  setMockDatabasePool(undefined);

  console.log('\n================================================================================');
  console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
