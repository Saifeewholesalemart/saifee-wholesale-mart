import { supabase, isSupabaseConfigured } from './supabaseClient';
import { db, DatabaseBackupSnapshot } from './db';
import { compressData, decompressData } from './compressionUtils';

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

/**
 * Fetches the latest database backup snapshot from Supabase system_settings
 */
export async function fetchCloudSnapshot(): Promise<{ snapshot: DatabaseBackupSnapshot; updatedAt: string } | null> {
  if (!isCloudSyncAvailable() || !supabase) return null;

  const res = await withTimeout(
    supabase
      .from('system_settings')
      .select('key, value, updated_at')
      .eq('key', CLOUD_SYNC_KEY)
      .maybeSingle(),
    30000,
    'Fetching cloud database snapshot timed out'
  );

  const { data, error } = res;

  if (error) {
    console.warn('[CloudSync] Error fetching snapshot:', error.message);
    throw error;
  }

  if (!data || !data.value) {
    return null;
  }

  let snapshot: DatabaseBackupSnapshot;
  if (data.value && typeof data.value === 'object' && data.value._compressed && data.value.data) {
    snapshot = await decompressData<DatabaseBackupSnapshot>(data.value.data);
  } else {
    snapshot = data.value as DatabaseBackupSnapshot;
  }

  return {
    snapshot,
    updatedAt: data.updated_at
  };
}

/**
 * Pushes a complete database snapshot to Supabase system_settings with high-efficiency gzip compression
 */
export async function pushCloudSnapshot(snapshot: DatabaseBackupSnapshot): Promise<string> {
  if (!isCloudSyncAvailable() || !supabase) {
    throw new Error('Supabase is not configured');
  }

  const now = new Date().toISOString();
  let payloadValue: any;

  try {
    const compressedBase64 = await compressData(snapshot);
    payloadValue = {
      _compressed: true,
      _encoding: 'gzip-base64',
      data: compressedBase64,
      metadata: snapshot.metadata,
      version: snapshot.version,
      timestamp: snapshot.timestamp
    };
  } catch (compErr) {
    console.warn('[CloudSync] Compression fallback:', compErr);
    payloadValue = snapshot;
  }

  const payload = {
    key: CLOUD_SYNC_KEY,
    value: payloadValue,
    updated_at: now
  };

  const res = await withTimeout(
    supabase
      .from('system_settings')
      .upsert(payload),
    45000,
    'Cloud database upload timed out after 45 seconds. Please check your internet connection.'
  );

  const { error } = res;

  if (error) {
    console.error('[CloudSync] Failed to push snapshot:', error.message);
    throw error;
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, now);
    } catch {}
  }

  return now;
}

/**
 * Smart Bidirectional Sync
 * 1. If Cloud is empty and Local has records: Pushes Local to Cloud.
 * 2. If Local is empty (e.g. Incognito or fresh Phone) and Cloud has records: Pulls Cloud to Local.
 * 3. If both have records: Compares timestamps and merges missing items cleanly.
 */
export async function syncBidirectional(): Promise<{
  action: 'pulled' | 'pushed' | 'merged' | 'synced' | 'noop';
  message: string;
  counts?: Record<string, number>;
}> {
  if (!isCloudSyncAvailable()) {
    updateStatus({ state: 'offline', message: 'Cloud sync not available' });
    return { action: 'noop', message: 'Cloud sync not configured' };
  }

  updateStatus({ state: 'syncing', message: 'Synchronizing with Cloud...' });

  try {
    const localSnapshot = db.exportFullDatabaseBackup();
    const localRecords = localSnapshot.metadata?.totalRecords || 0;
    const localProductCount = localSnapshot.tables?.products?.length || 0;

    const cloudData = await fetchCloudSnapshot();

    // CASE 1: Cloud is empty
    if (!cloudData || !cloudData.snapshot) {
      if (localProductCount > 0 || localRecords > 0) {
        const timestamp = await pushCloudSnapshot(localSnapshot);
        updateStatus({
          state: 'synced',
          lastSyncedAt: timestamp,
          message: `Uploaded ${localProductCount} products to Cloud`
        });
        return { action: 'pushed', message: `Uploaded ${localProductCount} products to Cloud` };
      }

      updateStatus({
        state: 'synced',
        lastSyncedAt: new Date().toISOString(),
        message: 'Cloud & Local both ready'
      });
      return { action: 'synced', message: 'Cloud & Local both ready' };
    }

    const cloudSnapshot = cloudData.snapshot;
    const cloudRecords = cloudSnapshot.metadata?.totalRecords || 0;
    const cloudProductCount = cloudSnapshot.tables?.products?.length || 0;

    // CASE 2: Local is completely empty (e.g. Mobile phone or Incognito opening app)
    if (localProductCount === 0 && cloudProductCount > 0) {
      const restoreResult = db.restoreFullDatabaseBackup(cloudSnapshot);
      updateStatus({
        state: 'synced',
        lastSyncedAt: cloudData.updatedAt,
        message: `Restored ${cloudProductCount} products from Cloud`
      });
      return {
        action: 'pulled',
        message: `Restored ${cloudProductCount} products from Cloud`,
        counts: restoreResult.counts
      };
    }

    // CASE 3: Local has data and Cloud has data -> Smart merge & reconcile
    const localTime = new Date(localSnapshot.timestamp).getTime();
    const cloudTime = new Date(cloudData.updatedAt).getTime();

    // Check if local has products not yet in cloud
    const cloudProdIds = new Set((cloudSnapshot.tables?.products || []).map(p => p.id));
    const localProdIds = new Set((localSnapshot.tables?.products || []).map(p => p.id));
    const missingInCloud = (localSnapshot.tables?.products || []).filter(p => !cloudProdIds.has(p.id));
    const missingInLocal = (cloudSnapshot.tables?.products || []).filter(p => !localProdIds.has(p.id));

    if (missingInCloud.length > 0) {
      // Local has new product(s)! Combine and push to cloud.
      const mergedProducts = [...(cloudSnapshot.tables?.products || []), ...missingInCloud];
      
      // Also combine inventory, purchases, batches, ledger, companies
      const cloudPurchases = cloudSnapshot.tables?.purchases || [];
      const cloudPurIds = new Set(cloudPurchases.map(p => p.id));
      const missingPurchases = (localSnapshot.tables?.purchases || []).filter(p => !cloudPurIds.has(p.id));
      const mergedPurchases = [...cloudPurchases, ...missingPurchases];

      const cloudInv = cloudSnapshot.tables?.inventory || [];
      const cloudInvIds = new Set(cloudInv.map(i => i.product_id));
      const missingInv = (localSnapshot.tables?.inventory || []).filter(i => !cloudInvIds.has(i.product_id));
      const mergedInv = [...cloudInv, ...missingInv];

      const cloudBatches = cloudSnapshot.tables?.batches || [];
      const cloudBatchIds = new Set(cloudBatches.map(b => b.id));
      const missingBatches = (localSnapshot.tables?.batches || []).filter(b => !cloudBatchIds.has(b.id));
      const mergedBatches = [...cloudBatches, ...missingBatches];

      const cloudLedger = cloudSnapshot.tables?.stock_ledger || [];
      const cloudLedgerIds = new Set(cloudLedger.map(l => l.id));
      const missingLedger = (localSnapshot.tables?.stock_ledger || []).filter(l => !cloudLedgerIds.has(l.id));
      const mergedLedger = [...cloudLedger, ...missingLedger];

      const cloudCompanies = cloudSnapshot.tables?.companies || [];
      const cloudCompIds = new Set(cloudCompanies.map(c => c.id));
      const missingCompanies = (localSnapshot.tables?.companies || []).filter(c => !cloudCompIds.has(c.id));
      const mergedCompanies = [...cloudCompanies, ...missingCompanies];

      const mergedSnapshot: DatabaseBackupSnapshot = {
        ...localSnapshot,
        timestamp: new Date().toISOString(),
        tables: {
          ...localSnapshot.tables,
          products: mergedProducts,
          purchases: mergedPurchases,
          inventory: mergedInv,
          batches: mergedBatches,
          stock_ledger: mergedLedger,
          companies: mergedCompanies
        },
        metadata: {
          ...localSnapshot.metadata,
          productsCount: mergedProducts.length,
          purchasesCount: mergedPurchases.length,
          inventoryCount: mergedInv.length,
          batchesCount: mergedBatches.length
        }
      };

      db.restoreFullDatabaseBackup(mergedSnapshot);
      const timestamp = await pushCloudSnapshot(mergedSnapshot);
      updateStatus({
        state: 'synced',
        lastSyncedAt: timestamp,
        message: `Merged ${missingInCloud.length} local items into Cloud`
      });
      return { action: 'merged', message: `Merged ${missingInCloud.length} local items into Cloud` };
    }

    if (missingInLocal.length > 0 || cloudTime > localTime + 2000) {
      // Cloud has newer items or missing items in local
      const restoreResult = db.restoreFullDatabaseBackup(cloudSnapshot);
      updateStatus({
        state: 'synced',
        lastSyncedAt: cloudData.updatedAt,
        message: `Synced ${cloudProductCount} products from Cloud`
      });
      return {
        action: 'pulled',
        message: `Synced ${cloudProductCount} products from Cloud`,
        counts: restoreResult.counts
      };
    }

    // Otherwise, local is equal or slightly ahead; push up
    const timestamp = await pushCloudSnapshot(localSnapshot);
    updateStatus({
      state: 'synced',
      lastSyncedAt: timestamp,
      message: 'Cloud synchronized'
    });
    return { action: 'synced', message: 'Cloud synchronized' };
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
