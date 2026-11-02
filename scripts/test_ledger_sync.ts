/**
 * FMCG ERP: Ledger Synchronization & Reconciliation Test Suite
 * Validates append-only stock and customer ledgers against equal-count divergence,
 * distinct events with identical fields, missing IDs, duplicate explicit IDs,
 * repeated synchronization, and immutability guarantees.
 */

import { reconcileSnapshots, sanitizeSnapshotForCloudUpload } from '../src/lib/supabaseSyncEngine';
import { DatabaseBackupSnapshot, StockLedgerEntry } from '../src/lib/db';

function createMockSnapshot(ledgerEntries: Partial<StockLedgerEntry>[]): DatabaseBackupSnapshot {
  return {
    version: '5.0',
    system: 'Saifee General Stores FMCG Distribution ERP',
    timestamp: '2026-10-26T00:00:00.000Z',
    exportDate: '26/10/2026, 05:30:00',
    metadata: {
      totalRecords: ledgerEntries.length,
      businessCompaniesCount: 0,
      productsCount: 0,
      batchesCount: 0,
      inventoryCount: 0,
      invoicesCount: 0,
      ordersCount: 0,
      retailersCount: 0,
      suppliersCount: 0,
      profilesCount: 0,
      paymentsCount: 0,
      purchasesCount: 0,
      salesReturnsCount: 0,
      godownsCount: 0,
      categoriesCount: 0,
      cashFlowCount: 0
    },
    tables: {
      business_companies: [],
      company_members: [],
      godowns: [],
      stock_transfers: [],
      companies: [],
      suppliers: [],
      retailers: [],
      profiles: [],
      categories: [],
      products: [],
      product_categories: [],
      inventory: [],
      batches: [],
      stock_ledger: ledgerEntries as StockLedgerEntry[],
      orders: [],
      fulfilments: [],
      invoices: [],
      delivery_challans: [],
      purchases: [],
      payments: [],
      sales_returns: [],
      company_opening_balances: [],
      cash_flow: [],
      billing_rate_audits: [],
      item_activity_logs: [],
      invoice_audits: []
    }
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

console.log('================================================================================');
console.log('FMCG ERP: Append-Only Ledger Reconciliation Test Suite');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Equal-Count Divergence
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Equal-Count Divergence ---');
const localLedger1 = [
  { id: 'led-1', product_id: 'prod-A', change_qty: 10, reason: 'Purchase', created_at: '2026-10-26T00:00:00Z', direction: 'IN' },
  { id: 'led-2', product_id: 'prod-B', change_qty: -5, reason: 'Sale', created_at: '2026-10-26T00:05:00Z', direction: 'OUT' },
  { id: 'led-local-only', product_id: 'prod-C', change_qty: 15, reason: 'Purchase', created_at: '2026-10-26T00:10:00Z', direction: 'IN' }
];

const cloudLedger1 = [
  { id: 'led-1', product_id: 'prod-A', change_qty: 10, reason: 'Purchase', created_at: '2026-10-26T00:00:00Z', direction: 'IN' },
  { id: 'led-2', product_id: 'prod-B', change_qty: -5, reason: 'Sale', created_at: '2026-10-26T00:05:00Z', direction: 'OUT' },
  { id: 'led-cloud-only', product_id: 'prod-D', change_qty: 20, reason: 'Purchase', created_at: '2026-10-26T00:12:00Z', direction: 'IN' }
];

const res1 = reconcileSnapshots(createMockSnapshot(localLedger1 as any), createMockSnapshot(cloudLedger1 as any));

assert(res1.hasLocalChangesToPush === true, 'hasLocalChangesToPush is TRUE when local has unique entry with equal array length (3 == 3)');
assert(res1.hasCloudChangesToApply === true, 'hasCloudChangesToApply is TRUE when cloud has unique entry with equal array length (3 == 3)');
assert(res1.mergedSnapshot.tables.stock_ledger.length === 4, 'Merged ledger contains all 4 entries (union of local and cloud)');
const mergedIds1 = new Set(res1.mergedSnapshot.tables.stock_ledger.map(l => l.id));
assert(mergedIds1.has('led-1') && mergedIds1.has('led-2') && mergedIds1.has('led-local-only') && mergedIds1.has('led-cloud-only'), 'All unique ledger IDs preserved without omission');

// -----------------------------------------------------------------------------
// TEST 2: Existing Ledger Entries Are Never Overwritten
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Ledger Immutability (Never Overwrite Existing Entries) ---');
const localLedger2 = [
  { id: 'led-fixed', product_id: 'prod-A', change_qty: 10, reason: 'Original Local Reason', created_at: '2026-10-26T00:00:00Z' }
];

const cloudLedger2 = [
  { id: 'led-fixed', product_id: 'prod-A', change_qty: 9999, reason: 'Cloud Mutated Reason (Tampered)', created_at: '2026-10-26T01:00:00Z' }
];

const res2 = reconcileSnapshots(createMockSnapshot(localLedger2 as any), createMockSnapshot(cloudLedger2 as any));
const preservedEntry = res2.mergedSnapshot.tables.stock_ledger.find(l => l.id === 'led-fixed');

assert(preservedEntry?.change_qty === 10, 'Existing local ledger change_qty is strictly preserved (10, not cloud 9999)');
assert(preservedEntry?.reason === 'Original Local Reason', 'Existing local ledger reason is strictly preserved');
assert(res2.mergedSnapshot.tables.stock_ledger.length === 1, 'No duplicate created for matching ledger ID');

// -----------------------------------------------------------------------------
// TEST 3: Duplicate Explicit IDs in Local Array
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Safe Handling of Duplicate Explicit IDs ---');
const localLedger3 = [
  { id: 'led-dup', product_id: 'prod-A', change_qty: 10, reason: 'First Copy', created_at: '2026-10-26T00:00:00Z' },
  { id: 'led-dup', product_id: 'prod-A', change_qty: 10, reason: 'Duplicate Copy (Should Suppress)', created_at: '2026-10-26T00:00:00Z' },
  { id: 'led-unique', product_id: 'prod-B', change_qty: 5, reason: 'Unique', created_at: '2026-10-26T00:01:00Z' }
];

const cloudLedger3 = [
  { id: 'led-dup', product_id: 'prod-A', change_qty: 10, reason: 'Cloud Copy', created_at: '2026-10-26T00:00:00Z' }
];

const res3 = reconcileSnapshots(createMockSnapshot(localLedger3 as any), createMockSnapshot(cloudLedger3 as any));

assert(res3.mergedSnapshot.tables.stock_ledger.length === 2, 'Merged ledger deduplicated internal duplicates to exactly 2 entries');
assert(res3.conflicts.some(c => c.id === 'led-dup' && c.reason.includes('Duplicate explicit ledger ID')), 'Duplicate ID reported in conflict log');

// -----------------------------------------------------------------------------
// TEST 4: Two Distinct Events with Identical Fields (Missing IDs)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Two Distinct Events with Identical Fields (No Content-Hash Collapsing) ---');
const localLedger4 = [
  // Two distinct physical sales occurring at the same timestamp for the same product and quantity
  { product_id: 'prod-SAME', change_qty: -2, reason: 'Sale', created_at: '2026-10-26T00:30:00.000Z', direction: 'OUT' } as any,
  { product_id: 'prod-SAME', change_qty: -2, reason: 'Sale', created_at: '2026-10-26T00:30:00.000Z', direction: 'OUT' } as any
];

const cloudLedger4 = [
  { id: 'led-cloud-base', product_id: 'prod-Z', change_qty: 100, reason: 'Opening', created_at: '2026-10-26T00:00:00.000Z', direction: 'IN' }
];

const res4 = reconcileSnapshots(createMockSnapshot(localLedger4), createMockSnapshot(cloudLedger4 as any));

// Both distinct events MUST be preserved in the merged ledger
assert(res4.mergedSnapshot.tables.stock_ledger.length === 3, 'Both identical missing-ID events preserved (total 3 including cloud base, neither event collapsed)');
const matchingSameEvents = res4.mergedSnapshot.tables.stock_ledger.filter(l => l.product_id === 'prod-SAME');
assert(matchingSameEvents.length === 2, 'Exactly 2 distinct events retained for prod-SAME (-2 and -2; total inventory impact -4 preserved)');
assert(res4.conflicts.some(c => c.id.startsWith('MISSING_ID_LOCAL_0')), 'First missing-ID event quarantined in conflicts log');
assert(res4.conflicts.some(c => c.id.startsWith('MISSING_ID_LOCAL_1')), 'Second missing-ID event quarantined in conflicts log');

// -----------------------------------------------------------------------------
// TEST 5: Repeated Upload Attempts & Repeated Reconciliation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Repeated Synchronization & Upload Isolation for Quarantined Records ---');

// 5A: Missing-ID records do NOT trigger automatic upload when explicit IDs match
const localQuarantineOnly = [
  { id: 'led-base-1', product_id: 'prod-A', change_qty: 10, reason: 'Purchase', created_at: '2026-10-26T00:00:00Z' },
  { product_id: 'prod-UNINDEXED', change_qty: -1, reason: 'Damaged', created_at: '2026-10-26T00:05:00Z' } as any
];

const cloudMatchingExplicit = [
  { id: 'led-base-1', product_id: 'prod-A', change_qty: 10, reason: 'Purchase', created_at: '2026-10-26T00:00:00Z' }
];

const res5a = reconcileSnapshots(createMockSnapshot(localQuarantineOnly), createMockSnapshot(cloudMatchingExplicit));

assert(res5a.hasLocalChangesToPush === false, 'Quarantined missing-ID record does NOT trigger automatic cloud upload');
assert(res5a.mergedSnapshot.tables.stock_ledger.length === 2, 'Quarantined missing-ID record is safely preserved locally');

// 5B: Repeated reconciliation passes do NOT duplicate records or invent IDs
const res5b = reconcileSnapshots(res5a.mergedSnapshot, createMockSnapshot(cloudMatchingExplicit));
const res5c = reconcileSnapshots(res5b.mergedSnapshot, createMockSnapshot(cloudMatchingExplicit));

assert(res5b.mergedSnapshot.tables.stock_ledger.length === 2, 'Second sync pass retains exactly 2 records (no duplication)');
assert(res5c.mergedSnapshot.tables.stock_ledger.length === 2, 'Third sync pass retains exactly 2 records (no duplication)');
assert(res5c.hasLocalChangesToPush === false, 'Repeated sync passes do not trigger spurious upload attempts');

// 5C: Sanitization for Cloud Upload strips quarantined records lacking IDs
const cloudUploadClean = sanitizeSnapshotForCloudUpload(res5a.mergedSnapshot);
assert(cloudUploadClean.tables.stock_ledger.length === 1, 'Cloud upload payload strips out unindexed/quarantined records');
assert(cloudUploadClean.tables.stock_ledger[0].id === 'led-base-1', 'Only valid records with persistent explicit IDs are included in cloud upload');

console.log('\n================================================================================');
console.log(`TEST RESULTS: Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
}
