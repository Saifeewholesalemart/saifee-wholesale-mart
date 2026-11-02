import { supabase, isSupabaseConfigured } from './supabaseClient';
import { db, DatabaseBackupSnapshot } from './db';
import { compressData, decompressData } from './compressionUtils';
import { syncIncrementalWithServer } from './incrementalSyncEngine';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudSyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  message: string;
  error?: string;
}

const CLOUD_SYNC_KEY = 'fmcg_cloud_database_v1';
const LAST_SYNCED_TIMESTAMP_KEY = 'fmcg_last_cloud_synced_timestamp';

// In-memory status listeners
type StatusListener = (status: CloudSyncStatus) => void;
const listeners = new Set<StatusListener>();

let currentStatus: CloudSyncStatus = {
  state: isSupabaseConfigured ? 'idle' : 'offline',
  lastSyncedAt: null,
  message: isSupabaseConfigured ? 'Cloud ready' : 'Supabase credentials not configured'
};

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn({ ...currentStatus });
    } catch (e) {
      console.warn('[CloudSync] Listener error:', e);
    }
  });
}

export function subscribeToSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): CloudSyncStatus {
  return { ...currentStatus };
}

function updateStatus(updates: Partial<CloudSyncStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  notifyListeners();
}

/**
 * Timeout wrapper for network operations to prevent infinite hanging
 */
async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = 45000,
  errorMsg = 'Cloud network request timed out. Please check your internet connection.'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Checks if Supabase connection is enabled and configured
 */
export function isCloudSyncAvailable(): boolean {
  return isSupabaseConfigured && Boolean(supabase);
}

import { getIdbItem, setIdbItem } from './indexedDbStorage';

interface SnapshotCacheEntry {
  data: { snapshot: DatabaseBackupSnapshot; updatedAt: string };
  timestamp: number;
}

// 2-Hour Cache Duration (rarely-changing cloud database snapshot)
const SNAPSHOT_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const IDB_SNAPSHOT_CACHE_KEY = 'fmcg_cloud_snapshot_cache';
const CACHE_TIMESTAMP_KEY = 'fmcg_cloud_snapshot_cached_at';

let inMemorySnapshotCache: SnapshotCacheEntry | null = null;
let inFlightSnapshotFetch: Promise<{ snapshot: DatabaseBackupSnapshot; updatedAt: string } | null> | null = null;

export function invalidateCloudSnapshotCache(): void {
  inMemorySnapshotCache = null;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }
  } catch {}
}

export function updateCloudSnapshotCache(data: { snapshot: DatabaseBackupSnapshot; updatedAt: string }): void {
  const entry: SnapshotCacheEntry = {
    data,
    timestamp: Date.now()
  };
  inMemorySnapshotCache = entry;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_TIMESTAMP_KEY, entry.timestamp.toString());
    }
  } catch {}
  setIdbItem(IDB_SNAPSHOT_CACHE_KEY, entry).catch(() => {});
}

/**
 * Fetches the latest database backup snapshot from Supabase system_settings with 2-hour caching
 */
export async function fetchCloudSnapshot(options?: { forceRefresh?: boolean }): Promise<{ snapshot: DatabaseBackupSnapshot; updatedAt: string } | null> {
  if (!isCloudSyncAvailable()) return null;

  const forceRefresh = options?.forceRefresh ?? false;

  // 1. Fast in-memory cache check (0ms latency, zero network transfer)
  if (!forceRefresh && inMemorySnapshotCache) {
    const age = Date.now() - inMemorySnapshotCache.timestamp;
    if (age < SNAPSHOT_CACHE_TTL_MS) {
      return inMemorySnapshotCache.data;
    }
  }

  // 2. Persistent IndexedDB cache check across page reloads (avoids slow network on cold reloads)
  if (!forceRefresh && !inMemorySnapshotCache) {
    try {
      const idbCached = await getIdbItem<SnapshotCacheEntry>(IDB_SNAPSHOT_CACHE_KEY);
      if (idbCached && idbCached.data && idbCached.timestamp) {
        const age = Date.now() - idbCached.timestamp;
        if (age < SNAPSHOT_CACHE_TTL_MS) {
          inMemorySnapshotCache = idbCached;
          return idbCached.data;
        }
      }
    } catch (idbErr) {
      console.warn('[CloudSync] IDB cache read error:', idbErr);
    }
  }

  // 3. Deduplicate concurrent fetch requests into a single in-flight promise
  if (inFlightSnapshotFetch) {
    return inFlightSnapshotFetch;
  }

  inFlightSnapshotFetch = (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

      if (!url || !key || url.includes('wxctglnnybhhptkxwxur')) {
        console.info('[CloudSync] Supabase environment is unconfigured or points to production. Snapshot fetch safely skipped.');
        return null;
      }

      let rawData: any = null;

      // Direct REST HTTP fetch (bypasses SDK connection locks, fast streaming)
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        const res = await fetch(`${url}/rest/v1/system_settings?key=eq.${CLOUD_SYNC_KEY}&select=key,value,updated_at`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            rawData = rows[0];
          }
        }
      } catch (directErr) {
        console.warn('[CloudSync] Direct REST fetch notice, attempting client fallback:', directErr);
      }

      // Fallback to Supabase JS SDK client if direct fetch didn't return
      if (!rawData && supabase) {
        try {
          const res = await withTimeout(
            supabase
              .from('system_settings')
              .select('key, value, updated_at')
              .eq('key', CLOUD_SYNC_KEY)
              .maybeSingle(),
            60000,
            'Fetching cloud database snapshot timed out'
          );
          if (res.data) {
            rawData = res.data;
          }
        } catch (sdkErr: any) {
          console.warn('[CloudSync] SDK client fetch error:', sdkErr?.message);
        }
      }

      // Fallback to secure authenticated server API route (/api/sync/snapshot)
      // Preserves legacy sync path seamlessly when direct anon access to system_settings is restricted by RLS
      if (!rawData && typeof window !== 'undefined') {
        try {
          const apiRes = await fetch('/api/sync/snapshot', {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json.success && json.data) {
              rawData = {
                key: CLOUD_SYNC_KEY,
                value: json.data,
                updated_at: json.updatedAt || new Date().toISOString()
              };
            }
          }
        } catch (apiErr) {
          console.warn('[CloudSync] Server API snapshot fetch fallback error:', apiErr);
        }
      }

      if (!rawData || !rawData.value) {
        return null;
      }

      let snapshot: DatabaseBackupSnapshot;
      if (rawData.value && typeof rawData.value === 'object' && rawData.value._compressed && rawData.value.data) {
        snapshot = await decompressData<DatabaseBackupSnapshot>(rawData.value.data);
      } else {
        snapshot = rawData.value as DatabaseBackupSnapshot;
      }

      const result = {
        snapshot,
        updatedAt: rawData.updated_at
      };

      // Populate both memory and IndexedDB caches with fresh data
      updateCloudSnapshotCache(result);

      return result;
    } finally {
      inFlightSnapshotFetch = null;
    }
  })();

  return inFlightSnapshotFetch;
}

/**
 * Sanitizes a database snapshot before uploading to Cloud, ensuring that
 * append-only ledger entries missing valid persistent IDs are not pushed to the
 * remote database where they could fail constraints or be reapplied on other devices.
 */
export function sanitizeSnapshotForCloudUpload(snapshot: DatabaseBackupSnapshot): DatabaseBackupSnapshot {
  if (!snapshot || !snapshot.tables) return snapshot;

  const filterLedger = <T extends { id?: string }>(items?: T[]): T[] => {
    if (!Array.isArray(items)) return [];
    return items.filter(it => it && typeof it.id === 'string' && it.id.trim().length > 0);
  };

  return {
    ...snapshot,
    tables: {
      ...snapshot.tables,
      stock_ledger: filterLedger(snapshot.tables.stock_ledger),
      billing_rate_audits: filterLedger(snapshot.tables.billing_rate_audits),
      item_activity_logs: filterLedger(snapshot.tables.item_activity_logs),
      invoice_audits: filterLedger(snapshot.tables.invoice_audits)
    }
  };
}

/**
 * Pushes a complete database snapshot to Supabase system_settings with high-efficiency gzip compression
 */
export async function pushCloudSnapshot(snapshot: DatabaseBackupSnapshot): Promise<string> {
  if (!isCloudSyncAvailable() || !supabase) {
    throw new Error('Supabase is not configured');
  }

  // Prevent conflicting writes between incremental sync and full snapshot sync
  if (typeof window !== 'undefined' && localStorage.getItem('fmcg_suppress_legacy_snapshot_push') === 'true') {
    throw new Error('Legacy snapshot push is disabled because authoritative incremental PostgreSQL sync is active.');
  }

  const localProductCount = snapshot.tables?.products?.length || 0;

  // ==========================================================
  // CRITICAL ANTI-WIPE GUARD:
  // Refuse to overwrite a cloud catalog that has products with 0 products!
  // ==========================================================
  if (localProductCount === 0) {
    try {
      const existingCloud = await fetchCloudSnapshot();
      const cloudProducts = existingCloud?.snapshot?.tables?.products?.length || 0;
      if (cloudProducts > 0) {
        console.warn(`[CloudSync] ANTI-WIPE GUARD ACTIVATED: Prevented wiping cloud catalog of ${cloudProducts} products with 0 local products.`);
        // Reconcile non-destructively to ensure any locally created transactions or ledgers are preserved
        const reconciled = reconcileSnapshots(snapshot, existingCloud!.snapshot);
        db.restoreFullDatabaseBackup(reconciled.mergedSnapshot);
        return existingCloud!.updatedAt;
      }
    } catch (guardErr) {
      console.warn('[CloudSync] Guard check error:', guardErr);
    }
  }

  const now = new Date().toISOString();
  let payloadValue: any;
  const uploadPayloadSnapshot = sanitizeSnapshotForCloudUpload(snapshot);

  try {
    const compressedBase64 = await compressData(uploadPayloadSnapshot);
    payloadValue = {
      _compressed: true,
      _encoding: 'gzip-base64',
      data: compressedBase64,
      metadata: uploadPayloadSnapshot.metadata,
      version: uploadPayloadSnapshot.version,
      timestamp: uploadPayloadSnapshot.timestamp
    };
  } catch (compErr) {
    console.warn('[CloudSync] Compression fallback:', compErr);
    payloadValue = uploadPayloadSnapshot;
  }

  const payload = {
    key: CLOUD_SYNC_KEY,
    value: payloadValue,
    updated_at: now
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key || url.includes('wxctglnnybhhptkxwxur')) {
    throw new Error('Supabase environment is unconfigured or points to production. Snapshot push safely aborted.');
  }

  let pushed = false;
  // Try direct HTTP UPSERT first for maximum speed and reliability
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(`${url}/rest/v1/system_settings`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      pushed = true;
    }
  } catch (httpErr) {
    console.warn('[CloudSync] Direct HTTP push error, falling back to SDK:', httpErr);
  }

  if (!pushed && supabase) {
    try {
      const res = await withTimeout(
        supabase
          .from('system_settings')
          .upsert(payload),
        60000,
        'Cloud database upload timed out after 60 seconds. Please check your internet connection.'
      );

      const { error } = res;
      if (!error) {
        pushed = true;
      } else {
        console.warn('[CloudSync] Direct Supabase push returned error, attempting server fallback:', error.message);
      }
    } catch (sdkErr: any) {
      console.warn('[CloudSync] SDK push exception, attempting server fallback:', sdkErr?.message);
    }
  }

  // Fallback to secure authenticated server API route (/api/sync/snapshot)
  // Preserves legacy sync push seamlessly when direct anon write to system_settings is restricted by RLS
  if (!pushed && typeof window !== 'undefined') {
    try {
      const apiRes = await fetch('/api/sync/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.success && json.savedToDb !== false) {
          pushed = true;
        }
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        console.warn('[CloudSync] Server snapshot API push rejected:', errJson?.error);
      }
    } catch (apiErr) {
      console.warn('[CloudSync] Server snapshot API push exception:', apiErr);
    }
  }

  if (!pushed) {
    throw new Error('Failed to push database snapshot to cloud: Client write restricted and server sync rejected.');
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, now);
    } catch {}
  }

  // Update cloud snapshot cache with latest pushed data
  updateCloudSnapshotCache({
    snapshot: uploadPayloadSnapshot,
    updatedAt: now
  });

  return now;
}

export interface ReconciliationConflict {
  table: string;
  id: string;
  reason: string;
}

export interface ReconciliationResult {
  mergedSnapshot: DatabaseBackupSnapshot;
  localAddedCount: number;
  cloudAddedCount: number;
  conflicts: ReconciliationConflict[];
  hasLocalChangesToPush: boolean;
  hasCloudChangesToApply: boolean;
}

/**
 * Safely parses ISO timestamp into epoch milliseconds. Returns 0 if absent/invalid.
 */
function parseTimestamp(ts?: string | null): number {
  if (!ts) return 0;
  const time = new Date(ts).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Non-destructive record-level snapshot reconciliation:
 * 1. Transaction tables (orders, invoices, payments, purchases, fulfilments, challans, returns, cash flow):
 *    - Never overwrite local transactions. Local offline creations and edits are preserved 100%.
 *    - If cloud has transactions not present in local, append them.
 * 2. Financial & Stock Ledgers (stock_ledger, customer_ledger, audit logs):
 *    - Strictly append-only. Never update existing ledger entries.
 *    - Append missing cloud entries to local.
 * 3. Master & Reference Data (products, categories, companies, retailers, suppliers, profiles, godowns):
 *    - Reconcile by ID.
 *    - If record exists in both: compare updated_at.
 *    - If cloud is strictly newer, accept cloud.
 *    - If local is equal, newer, or timestamps are absent/unresolvable: preserve local and record conflict.
 *    - Missing records from either side are merged into the unified set.
 */
export function reconcileSnapshots(
  localSnapshot: DatabaseBackupSnapshot,
  cloudSnapshot: DatabaseBackupSnapshot
): ReconciliationResult {
  const conflicts: ReconciliationConflict[] = [];
  let localAddedCount = 0;
  let cloudAddedCount = 0;
  let hasLocalChangesToPush = false;
  let hasCloudChangesToApply = false;

  const localTables = localSnapshot.tables || ({} as any);
  const cloudTables = cloudSnapshot.tables || ({} as any);

  // Helper for strictly append-only tables (ledgers and audit logs)
  function mergeAppendOnly<T extends Record<string, any>>(
    tableName: string,
    localItems: T[] = [],
    cloudItems: T[] = []
  ): T[] {
    const localExplicitKeys = new Set<string>();
    const cloudExplicitKeys = new Set<string>();
    const result: T[] = [];
    const seenResultKeys = new Set<string>();

    // 1. Process local items: preserve missing-ID entries for recovery; deduplicate duplicate explicit IDs
    localItems.forEach((item, idx) => {
      if (!item || typeof item.id !== 'string' || item.id.trim().length === 0) {
        // Missing persistent primary key: DO NOT collapse or deduplicate by content hash.
        // Preserve for data recovery locally, but DO NOT mark for automatic cloud upload.
        result.push(item);
        conflicts.push({
          table: tableName,
          id: `MISSING_ID_LOCAL_${idx}`,
          reason: `Ledger entry at local index ${idx} is missing a valid 'id' primary key. Quarantined as unresolved anomaly and preserved for recovery.`
        });
      } else {
        const key = item.id.trim();
        localExplicitKeys.add(key);
        if (!seenResultKeys.has(key)) {
          seenResultKeys.add(key);
          result.push(item);
        } else {
          conflicts.push({
            table: tableName,
            id: key,
            reason: `Duplicate explicit ledger ID '${key}' detected in local array; redundant instance suppressed.`
          });
        }
      }
    });

    // 2. Index cloud explicit keys and identify cloud missing-ID records
    const dedupedCloudExplicitItems: T[] = [];
    cloudItems.forEach((cItem, idx) => {
      if (!cItem || typeof cItem.id !== 'string' || cItem.id.trim().length === 0) {
        conflicts.push({
          table: tableName,
          id: `MISSING_ID_CLOUD_${idx}`,
          reason: `Cloud ledger entry at index ${idx} is missing a valid 'id' primary key. Reported as unverified cloud anomaly.`
        });
      } else {
        const key = cItem.id.trim();
        if (!cloudExplicitKeys.has(key)) {
          cloudExplicitKeys.add(key);
          dedupedCloudExplicitItems.push(cItem);
        }
      }
    });

    // 3. Append missing cloud items with explicit IDs to local result (never overwrite existing)
    dedupedCloudExplicitItems.forEach((cItem) => {
      const key = cItem.id.trim();
      if (!localExplicitKeys.has(key) && !seenResultKeys.has(key)) {
        seenResultKeys.add(key);
        result.push(cItem);
        cloudAddedCount++;
        hasCloudChangesToApply = true;
      }
    });

    // 4. Exact Set Difference Check for explicit IDs:
    // Mark changes for upload if ANY local explicit ID is absent in cloud
    for (const lKey of localExplicitKeys) {
      if (!cloudExplicitKeys.has(lKey)) {
        localAddedCount++;
        hasLocalChangesToPush = true;
      }
    }

    return result;
  }

  // Helper for transaction tables (preserve local unconditionally, append missing from cloud)
  function mergeTransactions<T extends { id?: string; updated_at?: string; updatedAt?: string; total_amount?: number; status?: string }>(
    tableName: string,
    localItems: T[] = [],
    cloudItems: T[] = []
  ): T[] {
    const localMap = new Map<string, T>();
    const cloudMap = new Map<string, T>();
    const result: T[] = [];

    localItems.forEach((item, idx) => {
      const key = item.id || `local_tx_${idx}`;
      localMap.set(key, item);
      result.push(item);
    });

    cloudItems.forEach((cItem, idx) => {
      const key = cItem.id || `cloud_tx_${idx}`;
      cloudMap.set(key, cItem);
      if (!localMap.has(key)) {
        result.push(cItem);
        cloudAddedCount++;
        hasCloudChangesToApply = true;
      } else {
        const localItem = localMap.get(key)!;
        if (
          localItem.status !== cItem.status ||
          localItem.total_amount !== cItem.total_amount
        ) {
          conflicts.push({
            table: tableName,
            id: key,
            reason: `Transaction conflict: local status '${localItem.status}' / amt '${localItem.total_amount}' vs cloud '${cItem.status}' / amt '${cItem.total_amount}'. Local version preserved.`
          });
        }
      }
    });

    localMap.forEach((_, key) => {
      if (!cloudMap.has(key)) {
        localAddedCount++;
        hasLocalChangesToPush = true;
      }
    });

    return result;
  }

  // Helper for master catalog tables (products, categories, companies, retailers, suppliers, profiles)
  function mergeMasterEntities<T extends { id?: string; updated_at?: string; updatedAt?: string }>(
    tableName: string,
    localItems: T[] = [],
    cloudItems: T[] = []
  ): T[] {
    const localMap = new Map<string, T>();
    const cloudMap = new Map<string, T>();
    const result: T[] = [];

    localItems.forEach((item, idx) => {
      const key = item.id || `local_m_${idx}`;
      localMap.set(key, item);
    });

    cloudItems.forEach((cItem, idx) => {
      const key = cItem.id || `cloud_m_${idx}`;
      cloudMap.set(key, cItem);
    });

    localMap.forEach((localItem, key) => {
      if (!cloudMap.has(key)) {
        result.push(localItem);
        localAddedCount++;
        hasLocalChangesToPush = true;
      } else {
        const cloudItem = cloudMap.get(key)!;
        const localTime = parseTimestamp(localItem.updated_at || localItem.updatedAt);
        const cloudTime = parseTimestamp(cloudItem.updated_at || cloudItem.updatedAt);

        if (cloudTime > localTime && localTime > 0) {
          result.push(cloudItem);
          hasCloudChangesToApply = true;
        } else if (localTime > cloudTime && cloudTime > 0) {
          result.push(localItem);
          hasLocalChangesToPush = true;
        } else {
          result.push(localItem);
          if (JSON.stringify(localItem) !== JSON.stringify(cloudItem)) {
            conflicts.push({
              table: tableName,
              id: key,
              reason: 'Unresolvable master record discrepancy without clear timestamp delta. Local version preserved.'
            });
            hasLocalChangesToPush = true;
          }
        }
      }
    });

    cloudMap.forEach((cloudItem, key) => {
      if (!localMap.has(key)) {
        result.push(cloudItem);
        cloudAddedCount++;
        hasCloudChangesToApply = true;
      }
    });

    return result;
  }

  // Reconcile each table domain safely
  const mergedProducts = mergeMasterEntities('products', localTables.products, cloudTables.products);
  const mergedCategories = mergeMasterEntities('categories', localTables.categories, cloudTables.categories);
  const mergedProductCategories = mergeMasterEntities('product_categories', localTables.product_categories, cloudTables.product_categories);
  const mergedCompanies = mergeMasterEntities('companies', localTables.companies, cloudTables.companies);
  const mergedBusinessCompanies = mergeMasterEntities('business_companies', localTables.business_companies, cloudTables.business_companies);
  const mergedCompanyMembers = mergeMasterEntities('company_members', localTables.company_members, cloudTables.company_members);
  const mergedGodowns = mergeMasterEntities('godowns', localTables.godowns, cloudTables.godowns);
  const mergedRetailers = mergeMasterEntities('retailers', localTables.retailers, cloudTables.retailers);
  const mergedSuppliers = mergeMasterEntities('suppliers', localTables.suppliers, cloudTables.suppliers);
  const mergedProfiles = mergeMasterEntities('profiles', localTables.profiles, cloudTables.profiles);
  const mergedOpeningBalances = mergeMasterEntities('company_opening_balances', localTables.company_opening_balances, cloudTables.company_opening_balances);

  // Transactions (preserve local offline activity)
  const mergedOrders = mergeTransactions('orders', localTables.orders, cloudTables.orders);
  const mergedInvoices = mergeTransactions('invoices', localTables.invoices, cloudTables.invoices);
  const mergedPurchases = mergeTransactions('purchases', localTables.purchases, cloudTables.purchases);
  const mergedPayments = mergeTransactions('payments', localTables.payments, cloudTables.payments);
  const mergedFulfilments = mergeTransactions('fulfilments', localTables.fulfilments, cloudTables.fulfilments);
  const mergedChallans = mergeTransactions('delivery_challans', localTables.delivery_challans, cloudTables.delivery_challans);
  const mergedSalesReturns = mergeTransactions('sales_returns', localTables.sales_returns, cloudTables.sales_returns);
  const mergedStockTransfers = mergeTransactions('stock_transfers', localTables.stock_transfers, cloudTables.stock_transfers);
  const mergedCashFlow = mergeTransactions('cash_flow', localTables.cash_flow, cloudTables.cash_flow);

  // Strictly Append-Only Ledgers & Audits
  const mergedStockLedger = mergeAppendOnly('stock_ledger', localTables.stock_ledger, cloudTables.stock_ledger);
  const mergedBillingRateAudits = mergeAppendOnly('billing_rate_audits', localTables.billing_rate_audits, cloudTables.billing_rate_audits);
  const mergedItemActivityLogs = mergeAppendOnly('item_activity_logs', localTables.item_activity_logs, cloudTables.item_activity_logs);
  const mergedInvoiceAudits = mergeAppendOnly('invoice_audits', localTables.invoice_audits, cloudTables.invoice_audits);

  // Inventory & Batches
  const mergedBatches = mergeMasterEntities('batches', localTables.batches, cloudTables.batches);

  // Inventory: keyed by product_id
  const localInvMap = new Map((localTables.inventory || []).map((i: any) => [i.product_id || i.id, i]));
  const cloudInvMap = new Map((cloudTables.inventory || []).map((i: any) => [i.product_id || i.id, i]));
  const mergedInventory: any[] = [...(localTables.inventory || [])];

  cloudInvMap.forEach((cInv, key) => {
    if (!localInvMap.has(key)) {
      mergedInventory.push(cInv);
      cloudAddedCount++;
      hasCloudChangesToApply = true;
    }
  });

  const totalRecords =
    mergedProducts.length +
    mergedCategories.length +
    mergedProductCategories.length +
    mergedCompanies.length +
    mergedBusinessCompanies.length +
    mergedCompanyMembers.length +
    mergedGodowns.length +
    mergedRetailers.length +
    mergedSuppliers.length +
    mergedProfiles.length +
    mergedOpeningBalances.length +
    mergedOrders.length +
    mergedInvoices.length +
    mergedPurchases.length +
    mergedPayments.length +
    mergedFulfilments.length +
    mergedChallans.length +
    mergedSalesReturns.length +
    mergedStockTransfers.length +
    mergedCashFlow.length +
    mergedStockLedger.length +
    mergedBillingRateAudits.length +
    mergedItemActivityLogs.length +
    mergedInvoiceAudits.length +
    mergedBatches.length +
    mergedInventory.length;

  const mergedSnapshot: DatabaseBackupSnapshot = {
    version: '5.0',
    system: localSnapshot.system || cloudSnapshot.system || 'Saifee General Stores FMCG Distribution ERP',
    timestamp: new Date().toISOString(),
    exportDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    metadata: {
      totalRecords,
      businessCompaniesCount: mergedBusinessCompanies.length,
      productsCount: mergedProducts.length,
      batchesCount: mergedBatches.length,
      inventoryCount: mergedInventory.length,
      invoicesCount: mergedInvoices.length,
      ordersCount: mergedOrders.length,
      retailersCount: mergedRetailers.length,
      suppliersCount: mergedSuppliers.length,
      profilesCount: mergedProfiles.length,
      paymentsCount: mergedPayments.length,
      purchasesCount: mergedPurchases.length,
      salesReturnsCount: mergedSalesReturns.length,
      godownsCount: mergedGodowns.length,
      categoriesCount: mergedCategories.length,
      cashFlowCount: mergedCashFlow.length
    },
    tables: {
      business_companies: mergedBusinessCompanies,
      company_members: mergedCompanyMembers,
      godowns: mergedGodowns,
      stock_transfers: mergedStockTransfers,
      companies: mergedCompanies,
      suppliers: mergedSuppliers,
      retailers: mergedRetailers,
      profiles: mergedProfiles,
      categories: mergedCategories,
      products: mergedProducts,
      product_categories: mergedProductCategories,
      inventory: mergedInventory,
      batches: mergedBatches,
      stock_ledger: mergedStockLedger,
      orders: mergedOrders,
      fulfilments: mergedFulfilments,
      invoices: mergedInvoices,
      delivery_challans: mergedChallans,
      purchases: mergedPurchases,
      payments: mergedPayments,
      sales_returns: mergedSalesReturns,
      company_opening_balances: mergedOpeningBalances,
      cash_flow: mergedCashFlow,
      billing_rate_audits: mergedBillingRateAudits,
      item_activity_logs: mergedItemActivityLogs,
      invoice_audits: mergedInvoiceAudits
    }
  };

  return {
    mergedSnapshot,
    localAddedCount,
    cloudAddedCount,
    conflicts,
    hasLocalChangesToPush,
    hasCloudChangesToApply
  };
}

/**
 * Non-destructive bidirectional sync:
 * 1. If Cloud is empty: pushes local snapshot to Cloud.
 * 2. If Cloud has records: reconciles record-by-record without wiping local offline data.
 * 3. Never overwrites orders, invoices, payments, or ledger entries.
 * 4. Pushes reconciled state to Cloud only if local has new or updated records.
 */
export async function syncBidirectional(options?: { forceRefresh?: boolean }): Promise<{
  action: 'pulled' | 'pushed' | 'merged' | 'synced' | 'noop';
  message: string;
  counts?: Record<string, number>;
  conflicts?: ReconciliationConflict[];
}> {
  // First attempt incremental sync to normalized PostgreSQL tables
  try {
    const incResult = await syncIncrementalWithServer();
    if (incResult.action !== 'unconfigured') {
      if (incResult.action === 'synced' || incResult.action === 'merged') {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('fmcg_suppress_legacy_snapshot_push', 'true');
          } catch {}
        }
        const syncTimestamp = new Date().toISOString();
        updateStatus({
          state: 'synced',
          lastSyncedAt: syncTimestamp,
          message: incResult.message,
          error: undefined
        });
        return {
          action: incResult.action,
          message: incResult.message,
          conflicts: incResult.conflicts as any
        };
      }

      if (incResult.action === 'idle') {
        updateStatus({
          state: currentStatus.lastSyncedAt ? 'synced' : 'idle',
          message: incResult.message,
          error: undefined
        });
        return {
          action: 'noop',
          message: incResult.message,
          conflicts: []
        };
      }

      if (incResult.action === 'offline') {
        updateStatus({
          state: 'offline',
          message: incResult.message,
          error: undefined
        });
        return {
          action: 'noop',
          message: incResult.message
        };
      }

      // incResult.action === 'error'
      updateStatus({
        state: 'error',
        message: incResult.message,
        error: incResult.message
      });
      return {
        action: 'noop',
        message: incResult.message
      };
    }
  } catch (incErr) {
    console.warn('[SyncEngine] Incremental sync attempt notice, checking snapshot fallback:', incErr);
  }

  // Controlled compatibility fallback to legacy snapshot sync
  if (!isCloudSyncAvailable()) {
    updateStatus({ state: 'offline', message: 'Cloud sync not available' });
    return { action: 'noop', message: 'Cloud sync not configured' };
  }

  updateStatus({ state: 'syncing', message: 'Synchronizing with Cloud...' });

  try {
    const localSnapshot = db.exportFullDatabaseBackup();
    const localProductCount = localSnapshot.tables?.products?.length || 0;
    const localRecords = localSnapshot.metadata?.totalRecords || 0;

    const cloudData = await fetchCloudSnapshot(options);

    // CASE 1: Cloud is empty
    if (!cloudData || !cloudData.snapshot) {
      if (localProductCount > 0 || localRecords > 0) {
        const timestamp = await pushCloudSnapshot(localSnapshot);
        updateStatus({
          state: 'synced',
          lastSyncedAt: timestamp,
          message: `Uploaded ${localRecords} local records to Cloud`
        });
        return { action: 'pushed', message: `Uploaded ${localRecords} local records to Cloud` };
      }

      updateStatus({
        state: 'idle',
        message: 'Cloud empty; awaiting initial catalog import'
      });
      return { action: 'noop', message: 'Cloud empty; awaiting initial catalog import' };
    }

    const cloudSnapshot = cloudData.snapshot;

    // CASE 2: Non-destructive, record-level reconciliation
    const reconciliation = reconcileSnapshots(localSnapshot, cloudSnapshot);

    if (reconciliation.conflicts.length > 0) {
      console.warn(
        `[CloudSync] Reconciled with ${reconciliation.conflicts.length} conflict(s). Local records preserved:`,
        reconciliation.conflicts
      );
    }

    let action: 'pulled' | 'pushed' | 'merged' | 'synced' = 'synced';
    let message = 'Local and Cloud are synchronized';
    let syncTimestamp = cloudData.updatedAt;

    // Apply cloud changes to local if any were missing or newer
    if (reconciliation.hasCloudChangesToApply) {
      db.restoreFullDatabaseBackup(reconciliation.mergedSnapshot);
      action = 'pulled';
      message = `Incorporated ${reconciliation.cloudAddedCount} cloud records into local`;
    }

    // Push local changes to cloud if local had new or updated records
    if (reconciliation.hasLocalChangesToPush) {
      syncTimestamp = await pushCloudSnapshot(reconciliation.mergedSnapshot);
      action = reconciliation.hasCloudChangesToApply ? 'merged' : 'pushed';
      message = `Merged ${reconciliation.localAddedCount} local records and ${reconciliation.cloudAddedCount} cloud records`;
    }

    updateStatus({
      state: 'synced',
      lastSyncedAt: syncTimestamp,
      message
    });

    return {
      action,
      message,
      counts: reconciliation.mergedSnapshot.metadata as any,
      conflicts: reconciliation.conflicts.length > 0 ? reconciliation.conflicts : undefined
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Synchronization failed';
    updateStatus({
      state: 'error',
      message: 'Sync error',
      error: errorMsg
    });
    throw err;
  }
}

// Debounced background push
let pushTimer: any = null;

export function queueCloudBackup(delayMs = 1500) {
  if (!isCloudSyncAvailable()) return;

  if (pushTimer) {
    clearTimeout(pushTimer);
  }

  pushTimer = setTimeout(async () => {
    try {
      const snap = db.exportFullDatabaseBackup();
      if ((snap.metadata?.totalRecords || 0) > 0) {
        updateStatus({ state: 'syncing', message: 'Saving changes to Cloud...' });
        const ts = await pushCloudSnapshot(snap);
        updateStatus({
          state: 'synced',
          lastSyncedAt: ts,
          message: 'Saved to Cloud'
        });
      }
    } catch (e: any) {
      console.warn('[CloudSync] Background save failed:', e?.message);
      updateStatus({ state: 'error', message: 'Cloud save pending', error: e?.message });
    }
  }, delayMs);
}

/**
 * Listens to remote changes via Supabase Realtime channel
 */
export function setupRealtimeSubscription(onRemoteChange: () => void): () => void {
  if (!isCloudSyncAvailable() || !supabase) return () => {};

  try {
    const channel = supabase
      .channel('saifee_erp_cloud_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: `key=eq.${CLOUD_SYNC_KEY}`
        },
        () => {
          invalidateCloudSnapshotCache();
          onRemoteChange();
        }
      )
      .subscribe();

    return () => {
      try {
        if (supabase) {
          supabase.removeChannel(channel);
        }
      } catch {}
    };
  } catch {
    return () => {};
  }
}
