/**
 * CLOUD-ONLY STORAGE ENGINE (browser side)
 * File: src/lib/cloudWriteThrough.ts
 *
 * Kaam:
 * 1. App khulte hi cloud se poora data laata hai (cloud = asli data).
 * 2. App me jo bhi change ho (bill, order, purchase, payment, stock...), wo
 *    usi waqt (~0.3 sec me) cloud me save hota hai. "Baad me sync" nahi.
 * 3. Har 20 second me doosre devices (packer/biller/salesperson) ke changes laata hai.
 * 4. Internet chala jaaye to status turant batata hai, aur jo changes abhi
 *    cloud tak nahi pahunche unhe sambhal kar rakhta hai jab tak internet wapas na aaye.
 *
 * Local browser storage ab sirf "cache" hai taaki app jaldi khule. Faisla hamesha cloud ka.
 */

import { db } from './db';
import { getIdbItem, setIdbItem } from './indexedDbStorage';
import {
  APPEND_ONLY_STORES,
  MERGE_ONLY_STORES,
  NORMALIZED_MASTER_STORES,
  isCloudSyncedStore,
  resolveRecordId,
  resolveRecordTenant,
  stripSecrets
} from './cloudRecordStores';
import { syncIncrementalWithServer } from './incrementalSyncEngine';

// ----------------------------------------------------------------------------
// Status
// ----------------------------------------------------------------------------

export type CloudState =
  | 'idle'            // not logged in / not started
  | 'connecting'      // loading data from cloud
  | 'ready'           // everything saved
  | 'saving'          // changes being saved right now
  | 'offline'         // no internet: changes waiting
  | 'error'           // cloud rejected / server problem
  | 'setup_required'; // app_records table missing (run SQL)

export interface CloudStatus {
  state: CloudState;
  pending: number;
  lastSavedAt: string | null;
  lastLoadedAt: string | null;
  message: string;
  error?: string;
  businessId: string | null;
}

type Listener = (s: CloudStatus) => void;

let status: CloudStatus = {
  state: 'idle',
  pending: 0,
  lastSavedAt: null,
  lastLoadedAt: null,
  message: 'Not connected',
  businessId: null
};
const listeners = new Set<Listener>();

function setStatus(update: Partial<CloudStatus>) {
  status = { ...status, ...update, pending: outbox.size };
  listeners.forEach(l => {
    try { l(status); } catch {}
  });
}

export function getCloudStatus(): CloudStatus {
  return status;
}

export function subscribeCloudStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

// ----------------------------------------------------------------------------
// Internal state
// ----------------------------------------------------------------------------

interface KnownRecord { h: string; biz: string }
interface OutboxEntry {
  store: string;
  id: string;
  business_id: string;
  data: any | null;
  deleted: boolean;
  seq: number;
}

const OUTBOX_KEY = 'fmcg_cloud_outbox_v1';
const CHECKPOINT_PREFIX = 'fmcg_cloud_records_cp_';
const POLL_INTERVAL_MS = 20000;
const POLL_OVERLAP_MS = 2 * 60 * 1000; // re-read last 2 min so late commits are never missed
const WRITE_CHUNK = 300;

/** store -> id -> last known content hash (what cloud and device agree on / last seen) */
const known = new Map<string, Map<string, KnownRecord>>();
/** pending changes not yet confirmed by cloud, keyed `${store}\u0001${id}` */
const outbox = new Map<string, OutboxEntry>();

let seqCounter = 0;
let ready = false;
let applyingRemote = 0;
let activeBusinessId: string | null = null;
let sessionBusinessId: string | null = null;
let onDataChanged: (() => void) | null = null;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 2000;
let flushing = false;
let flushRequested = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pulling = false;
let startToken = 0;
let windowListenersAttached = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let bulkDeleteAllowedUntil = 0;

/** Admin ne jaan-boojh kar "sab clear" kiya: agle kuch second tak bulk delete cloud me bhi jaane do. */
export function allowBulkDeleteFor(ms = 5000) {
  bulkDeleteAllowedUntil = Date.now() + ms;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function keyOf(store: string, id: string) {
  return `${store}\u0001${id}`;
}

/** FNV-1a 32-bit hash of a string (fast, enough to detect changes). */
function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ':' + str.length.toString(36);
}

function hashRecord(item: any): string {
  try {
    return hashString(JSON.stringify(item));
  } catch {
    return 'unhashable:' + Math.random();
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

class HttpError extends Error {
  status: number;
  setupRequired: boolean;
  constructor(message: string, status: number, setupRequired = false) {
    super(message);
    this.status = status;
    this.setupRequired = setupRequired;
  }
}

async function postJson<T>(url: string, body: any, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store'
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || json?.success === false) {
      throw new HttpError(json?.error || `HTTP ${res.status}`, res.status, Boolean(json?.setupRequired));
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

function describeError(err: any): { state: CloudState; message: string } {
  if (err instanceof HttpError) {
    if (err.setupRequired) {
      return { state: 'setup_required', message: 'Cloud setup is incomplete. Run supabase/010_cloud_records.sql in Supabase.' };
    }
    if (err.status === 401) {
      return { state: 'error', message: 'Your session has expired. Please log out and log in again.' };
    }
    return { state: 'error', message: `The cloud rejected the save: ${err.message}` };
  }
  if (!isOnline() || err?.name === 'AbortError' || err instanceof TypeError) {
    return { state: 'offline', message: 'No internet connection. Changes are not being saved to the cloud.' };
  }
  return { state: 'error', message: err?.message || 'Cloud error' };
}

// ----------------------------------------------------------------------------
// Known-state bookkeeping
// ----------------------------------------------------------------------------

function rebuildKnownForStore(store: string, items: any[]) {
  const fallbackBiz = activeBusinessId || db.getActiveBusinessCompanyId();
  const map = new Map<string, KnownRecord>();
  for (const item of items) {
    const id = resolveRecordId(store, item);
    if (!id) continue;
    map.set(id, { h: hashRecord(item), biz: resolveRecordTenant(store, item, fallbackBiz) });
  }
  known.set(store, map);
}

function rebuildAllKnown() {
  known.clear();
  for (const store of db.listLoadedStoreKeys()) {
    if (!isCloudSyncedStore(store)) continue;
    rebuildKnownForStore(store, db.getRawStore(store));
  }
}

// ----------------------------------------------------------------------------
// Outbox persistence (survives page reload / app close)
// ----------------------------------------------------------------------------

function persistOutboxSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void setIdbItem(OUTBOX_KEY, Array.from(outbox.values())).catch(() => {});
  }, 150);
}

async function restoreOutbox() {
  try {
    const saved = await getIdbItem<OutboxEntry[]>(OUTBOX_KEY);
    if (Array.isArray(saved)) {
      saved.forEach(e => {
        if (e && e.store && e.id && e.business_id) {
          const k = keyOf(e.store, e.id);
          if (!outbox.has(k)) outbox.set(k, { ...e, seq: ++seqCounter });
        }
      });
    }
  } catch {}
}

// ----------------------------------------------------------------------------
// 1. LOCAL CHANGE -> OUTBOX  (called by db.saveStore for every save)
// ----------------------------------------------------------------------------

function handleStoreSaved(store: string, items: any[]) {
  if (!isCloudSyncedStore(store)) return;

  // Cloud se aaya data lag raha hai, ya cloud abhi load nahi hua: sirf yaad rakho, upload mat karo
  if (applyingRemote > 0 || !ready) {
    if (ready) rebuildKnownForStore(store, items);
    return;
  }

  const fallbackBiz = activeBusinessId || db.getActiveBusinessCompanyId();
  const prev = known.get(store) || new Map<string, KnownRecord>();
  const next = new Map<string, KnownRecord>();
  let added = 0;

  for (const item of items) {
    const id = resolveRecordId(store, item);
    if (!id) continue;
    const h = hashRecord(item);
    const biz = resolveRecordTenant(store, item, fallbackBiz);
    next.set(id, { h, biz });
    const before = prev.get(id);
    if (!before || before.h !== h) {
      outbox.set(keyOf(store, id), {
        store,
        id,
        business_id: biz,
        data: stripSecrets(item),
        deleted: false,
        seq: ++seqCounter
      });
      added++;
    }
  }

  // Deletions (records that disappeared from the store)
  if (!APPEND_ONLY_STORES.has(store)) {
    const removed: [string, KnownRecord][] = [];
    prev.forEach((rec, id) => {
      if (!next.has(id)) removed.push([id, rec]);
    });
    // Safety: agar ek hi save me aadhe se zyada records gayab ho jaayein to ye galti ho sakti hai;
    // cloud se delete NAHI karenge.
    const suspicious = removed.length > 20 && removed.length > prev.size * 0.5 && Date.now() > bulkDeleteAllowedUntil;
    if (suspicious) {
      console.warn(`[CloudSave] Skipped deleting ${removed.length} records from "${store}" (looks accidental).`);
    } else {
      removed.forEach(([id, rec]) => {
        outbox.set(keyOf(store, id), {
          store,
          id,
          business_id: rec.biz,
          data: null,
          deleted: true,
          seq: ++seqCounter
        });
        added++;
      });
    }
  }

  known.set(store, next);

  if (added > 0) {
    persistOutboxSoon();
    setStatus({ state: isOnline() ? 'saving' : 'offline', message: isOnline() ? 'Saving to the cloud...' : 'No internet connection. Changes are not being saved to the cloud.' });
    scheduleFlush(250);
  }
}

// ----------------------------------------------------------------------------
// 2. OUTBOX -> CLOUD
// ----------------------------------------------------------------------------

function scheduleFlush(delayMs: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushOutbox();
  }, delayMs);
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = retryDelayMs;
  retryDelayMs = Math.min(retryDelayMs * 2, 30000);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushOutbox();
  }, delay);
}

/** Best-effort: master records ko purane normalized tables me bhi likh do (server reports/import ke liye). */
async function mirrorMastersToNormalizedTables(entries: OutboxEntry[]) {
  if (!sessionBusinessId) return;
  const changes: Record<string, any[]> = {};
  for (const e of entries) {
    const table = NORMALIZED_MASTER_STORES[e.store];
    if (!table || e.deleted || !e.data || e.business_id !== sessionBusinessId) continue;
    (changes[table] = changes[table] || []).push(e.data);
  }
  if (Object.keys(changes).length === 0) return;
  try {
    await postJson('/api/sync/push', {
      clientSyncTimestamp: new Date().toISOString(),
      business_id: sessionBusinessId,
      changes
    }, 60000);
  } catch (err: any) {
    // app_records me already safe hai; ye sirf extra copy hai
    console.warn('[CloudSave] Normalized mirror notice:', err?.message);
  }
}

export async function flushOutbox(): Promise<boolean> {
  if (flushing) {
    flushRequested = true;
    return false;
  }
  if (!ready) return outbox.size === 0;
  if (outbox.size === 0) {
    if (status.state === 'saving' || status.state === 'offline' || status.state === 'error') {
      setStatus({ state: 'ready', message: 'All changes saved to the cloud', error: undefined });
    }
    return true;
  }
  if (!isOnline()) {
    setStatus({ state: 'offline', message: 'No internet connection. Changes are not being saved to the cloud.' });
    return false;
  }

  flushing = true;
  flushRequested = false;
  setStatus({ state: 'saving', message: 'Saving to the cloud...' });

  try {
    const entries = Array.from(outbox.values()).sort((a, b) => a.seq - b.seq);
    const skippedReasons: string[] = [];

    for (let i = 0; i < entries.length; i += WRITE_CHUNK) {
      const chunk = entries.slice(i, i + WRITE_CHUNK);
      const res = await postJson<{ success: boolean; skipped?: { store: string; id: string; reason: string }[] }>(
        '/api/cloud/write',
        {
          records: chunk.map(e => ({
            store: e.store,
            id: e.id,
            business_id: e.business_id,
            data: e.deleted ? null : e.data,
            deleted: e.deleted
          }))
        },
        60000
      );

      // Confirmed: remove from outbox (only if not changed again meanwhile)
      for (const e of chunk) {
        const k = keyOf(e.store, e.id);
        const cur = outbox.get(k);
        if (cur && cur.seq === e.seq) outbox.delete(k);
      }
      (res.skipped || []).forEach(s => skippedReasons.push(`${s.store}/${s.id}: ${s.reason}`));
      persistOutboxSoon();

      void mirrorMastersToNormalizedTables(chunk);
    }

    retryDelayMs = 2000;
    const now = new Date().toISOString();
    if (skippedReasons.length > 0) {
      console.warn('[CloudSave] Some records were not accepted by cloud:', skippedReasons.slice(0, 20));
    }
    setStatus({
      state: outbox.size > 0 ? 'saving' : 'ready',
      lastSavedAt: now,
      message: skippedReasons.length > 0
        ? `Saved. ${skippedReasons.length} record(s) skipped (no access).`
        : 'All changes saved to the cloud',
      error: undefined
    });
    return outbox.size === 0;
  } catch (err: any) {
    const d = describeError(err);
    setStatus({ state: d.state, message: d.message, error: err?.message });
    if (d.state !== 'setup_required') scheduleRetry();
    return false;
  } finally {
    flushing = false;
    if (flushRequested || (outbox.size > 0 && status.state === 'saving')) {
      scheduleFlush(50);
    }
  }
}

/** Waits until every pending change is confirmed by cloud (or timeout). */
export async function waitForCloudSave(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (Date.now() - start < timeoutMs) {
    if (outbox.size === 0 && !flushing) return true;
    const ok = await flushOutbox();
    if (ok && outbox.size === 0) return true;
    if (status.state === 'offline' || status.state === 'setup_required') return false;
    await new Promise(r => setTimeout(r, 300));
  }
  return outbox.size === 0;
}

export function getPendingCount(): number {
  return outbox.size;
}

// ----------------------------------------------------------------------------
// 3. CLOUD -> DEVICE
// ----------------------------------------------------------------------------

interface LoadedRecord {
  store: string;
  id: string;
  business_id: string;
  data: any;
  deleted: boolean;
  updated_at: string;
}

interface LoadCursor { updated_at: string; store: string; id: string }

async function fetchCloudRecords(businessId: string, since: string | null): Promise<{ records: LoadedRecord[]; maxUpdatedAt: string | null }> {
  const all: LoadedRecord[] = [];
  let after: LoadCursor | null = null;
  let maxUpdatedAt: string | null = null;
  for (let page = 0; page < 500; page++) {
    const res: { records: LoadedRecord[]; hasMore: boolean; next: LoadCursor | null } = await postJson(
      '/api/cloud/load',
      { business_id: businessId, since, after, limit: 2000 },
      60000
    );
    all.push(...res.records);
    const nextCursor: LoadCursor | null = res.next;
    if (nextCursor) {
      after = nextCursor;
      maxUpdatedAt = nextCursor.updated_at;
    }
    if (!res.hasMore) break;
  }
  return { records: all, maxUpdatedAt };
}

function updatedAtOf(item: any): string {
  return String(item?.updated_at || item?.created_at || '');
}

/**
 * Cloud records ko device par lagata hai.
 * - Jo record abhi device se upload hone ke liye pending hai, use cloud overwrite nahi karta.
 * - Master tables (products...) me sirf naya (updated_at) record jeetta hai.
 */
function applyRemoteRecords(records: LoadedRecord[]): number {
  if (records.length === 0) return 0;
  const byStore = new Map<string, LoadedRecord[]>();
  records.forEach(r => {
    if (!isCloudSyncedStore(r.store)) return;
    if (outbox.has(keyOf(r.store, r.id))) return; // local pending change wins
    (byStore.get(r.store) || byStore.set(r.store, []).get(r.store)!).push(r);
  });

  let changed = 0;
  applyingRemote++;
  try {
    byStore.forEach((rows, store) => {
      const current = db.getRawStore(store);
      const localById = new Map<string, any>();
      current.forEach(it => {
        const id = resolveRecordId(store, it);
        if (id) localById.set(id, it);
      });
      const knownMap = known.get(store);
      const upserts: any[] = [];
      const deletes: string[] = [];
      const newerWins = Boolean(NORMALIZED_MASTER_STORES[store]);

      rows.forEach(r => {
        const local = localById.get(r.id);
        if (r.deleted) {
          if (local && !APPEND_ONLY_STORES.has(store)) deletes.push(r.id);
          return;
        }
        if (!r.data || typeof r.data !== 'object') return;
        // Same content already on device: skip (no work)
        if (local && knownMap?.get(r.id)?.h === hashRecord(r.data) && hashRecord(local) === hashRecord(r.data)) return;
        if (newerWins && local) {
          // Master record: normalized table copy (server import) sirf tab jeetti hai jab
          // wo app wale copy se 10 min se zyada nayi ho. Warna app ka poora record lagao,
          // aur jo extra fields sirf local/normalized copy me hain wo bani rahein.
          const localTime = Date.parse(updatedAtOf(local)) || 0;
          const cloudTime = Date.parse(updatedAtOf(r.data)) || 0;
          if (localTime > cloudTime + 10 * 60 * 1000) return;
          upserts.push({ ...local, ...r.data });
          return;
        }
        upserts.push(r.data);
      });

      if (upserts.length > 0 || deletes.length > 0) {
        db.applyCloudRecords(store, upserts, deletes);
        changed += upserts.length + deletes.length;
      }
    });
  } finally {
    applyingRemote--;
  }
  return changed;
}

/**
 * Pehli baar cloud load (is device + is company ke liye): device par jo records cloud me
 * nahi hain, unhe EK BAAR cloud me upload kar dete hain taaki kuch bhi kho na jaaye
 * (jaise product-category links, stock ledger, batches). Master tables (products,
 * retailers, godowns, suppliers, inventory) pehle se cloud tables me hain, unhe skip.
 */
function queueFirstLoadMigration(businessId: string, cloudIds: Map<string, Set<string>>): number {
  let queued = 0;
  for (const store of db.listLoadedStoreKeys()) {
    if (!isCloudSyncedStore(store) || NORMALIZED_MASTER_STORES[store]) continue;
    const ids = cloudIds.get(store) || new Set<string>();
    for (const it of db.getRawStore(store)) {
      const id = resolveRecordId(store, it);
      if (!id || ids.has(id)) continue;
      const biz = resolveRecordTenant(store, it, businessId);
      if (biz !== businessId) continue;
      const k = keyOf(store, id);
      if (outbox.has(k)) continue;
      outbox.set(k, { store, id, business_id: biz, data: stripSecrets(it), deleted: false, seq: ++seqCounter });
      queued++;
    }
  }
  if (queued > 0) {
    persistOutboxSoon();
    console.info(`[CloudLoad] First cloud load: ${queued} existing device records queued for one-time upload.`);
  }
  return queued;
}

/** Doosre devices ke naye changes laata hai. */
export async function pullCloudChanges(): Promise<number> {
  if (!ready || pulling || !activeBusinessId || !isOnline()) return 0;
  pulling = true;
  const biz = activeBusinessId;
  const token = startToken;
  try {
    const cp = await getIdbItem<string>(CHECKPOINT_PREFIX + biz);
    const since = cp ? new Date(new Date(cp).getTime() - POLL_OVERLAP_MS).toISOString() : null;
    const { records, maxUpdatedAt } = await fetchCloudRecords(biz, since);
    if (token !== startToken) return 0; // company switched meanwhile
    const changed = applyRemoteRecords(records);
    if (maxUpdatedAt && (!cp || maxUpdatedAt > cp)) await setIdbItem(CHECKPOINT_PREFIX + biz, maxUpdatedAt);
    setStatus({ lastLoadedAt: new Date().toISOString() });
    if (changed > 0 && onDataChanged) onDataChanged();
    if (status.state === 'offline' && outbox.size === 0) {
      setStatus({ state: 'ready', message: 'All changes saved to the cloud', error: undefined });
    }
    return changed;
  } catch (err: any) {
    const d = describeError(err);
    if (d.state === 'offline' || d.state === 'setup_required') {
      setStatus({ state: d.state, message: d.message, error: err?.message });
    } else {
      console.warn('[CloudLoad] Refresh notice:', err?.message);
    }
    return 0;
  } finally {
    pulling = false;
  }
}

// ----------------------------------------------------------------------------
// 4. START / STOP
// ----------------------------------------------------------------------------

function attachWindowListeners() {
  if (windowListenersAttached || typeof window === 'undefined') return;
  windowListenersAttached = true;
  window.addEventListener('online', () => {
    retryDelayMs = 2000;
    if (status.state === 'offline' || status.state === 'error') {
      setStatus({ state: outbox.size > 0 ? 'saving' : 'ready', message: 'Back online. Saving changes...' });
    }
    void flushOutbox();
    void pullCloudChanges();
  });
  window.addEventListener('offline', () => {
    setStatus({ state: 'offline', message: 'No internet connection. Changes are not being saved to the cloud.' });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void flushOutbox();
      void pullCloudChanges();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (outbox.size > 0) {
      // Browser khud "Leave site?" poochega
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/**
 * Login ke baad (aur company badalne par) chalayein.
 * Cloud se data laata hai, phir app ko "ready" karta hai.
 */
export async function startCloudSession(options: {
  businessId: string;
  sessionBusinessId: string | null;
  onDataChanged: () => void;
}): Promise<boolean> {
  const token = ++startToken;
  ready = false;
  activeBusinessId = options.businessId;
  sessionBusinessId = options.sessionBusinessId;
  onDataChanged = options.onDataChanged;
  db.setStoreSaveListener(handleStoreSaved);
  attachWindowListeners();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  setStatus({ state: 'connecting', message: 'Loading data from the cloud...', businessId: options.businessId, error: undefined });

  // Retry until cloud reachable (app is online-only)
  for (let attempt = 0; ; attempt++) {
    if (token !== startToken) return false;
    try {
      if (!isOnline()) throw new TypeError('offline');
      const healthRes = await fetch('/api/cloud/health', { cache: 'no-store' });
      const health = await healthRes.json().catch(() => ({} as any));
      if (!health?.dbConfigured) {
        setStatus({ state: 'error', message: 'The cloud database is not configured on the server. Please check the .env settings.' });
        return false;
      }
      if (health?.dbReachable === false) {
        // Temporary network problem between the server and the database: keep retrying
        throw new TypeError('db unreachable');
      }
      if (!health?.tableReady) {
        setStatus({ state: 'setup_required', message: 'Cloud setup is incomplete. Run supabase/010_cloud_records.sql in Supabase.' });
        return false;
      }
      break;
    } catch (err: any) {
      const d = describeError(err);
      setStatus({ state: d.state === 'error' ? 'offline' : d.state, message: 'Unable to connect to the cloud. Please check your internet connection. Retrying...' });
      await new Promise(r => setTimeout(r, Math.min(2000 + attempt * 1000, 10000)));
    }
  }

  try {
    await restoreOutbox();

    // A. Normalized master tables (products, retailers, godowns...) — sirf apni login company ke liye
    if (options.sessionBusinessId && options.sessionBusinessId === options.businessId) {
      applyingRemote++;
      try {
        // Ek baar poora master data dobara lao (pehle stock batches aur category links
        // device tak nahi aate the). Uske baad sirf naye changes.
        const backfillKey = `fmcg_normalized_backfill_v2_${options.businessId}`;
        const needsBackfill = !(await getIdbItem<string>(backfillKey));
        const res = await syncIncrementalWithServer({
          businessId: options.businessId,
          pullOnly: true,
          forcePullAll: needsBackfill
        });
        if (res.action === 'error') {
          console.warn('[CloudLoad] Master tables notice:', res.message);
        } else if (needsBackfill) {
          await setIdbItem(backfillKey, new Date().toISOString());
        }
      } finally {
        applyingRemote--;
      }
    }
    if (token !== startToken) return false;

    // B. app_records (sab transactions + full master copies)
    const cpKey = CHECKPOINT_PREFIX + options.businessId;
    const cp = await getIdbItem<string>(cpKey);
    const firstLoad = !cp;
    const since = cp ? new Date(new Date(cp).getTime() - POLL_OVERLAP_MS).toISOString() : null;
    const { records, maxUpdatedAt } = await fetchCloudRecords(options.businessId, since);
    if (token !== startToken) return false;

    applyRemoteRecords(records);

    // C. Ab se har change upload hoga
    rebuildAllKnown();
    // Pending (pichli baar ke) changes ko known me "different" rakho taaki wo upload hon
    outbox.forEach(e => {
      const m = known.get(e.store);
      if (m && !e.deleted) m.set(e.id, { h: 'pending', biz: e.business_id });
    });
    if (firstLoad) {
      const cloudIds = new Map<string, Set<string>>();
      records.forEach(r => {
        if (r.business_id !== options.businessId) return;
        (cloudIds.get(r.store) || cloudIds.set(r.store, new Set()).get(r.store)!).add(r.id);
      });
      if (queueFirstLoadMigration(options.businessId, cloudIds) > 0) {
        // Upload list pehle device par pakka save, phir checkpoint
        await setIdbItem(OUTBOX_KEY, Array.from(outbox.values())).catch(() => {});
      }
    }
    await setIdbItem(cpKey, maxUpdatedAt || cp || new Date(0).toISOString());
    ready = true;

    setStatus({
      state: outbox.size > 0 ? 'saving' : 'ready',
      message: outbox.size > 0 ? 'Saving earlier changes to the cloud...' : 'All changes saved to the cloud',
      lastLoadedAt: new Date().toISOString(),
      error: undefined
    });
    if (onDataChanged) onDataChanged();
    if (outbox.size > 0) void flushOutbox();

    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void pullCloudChanges();
    }, POLL_INTERVAL_MS);
    return true;
  } catch (err: any) {
    const d = describeError(err);
    setStatus({ state: d.state, message: d.message, error: err?.message });
    return false;
  }
}

/** Logout par: polling band, aage ke changes upload nahi honge. */
export function stopCloudSession() {
  startToken++;
  ready = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  setStatus({ state: 'idle', message: 'Not connected', businessId: null });
}

/** Products/retailers/godowns jaise master tables ko normalized cloud tables se dobara laata hai. */
export async function refreshMasterTables(): Promise<number> {
  if (!ready || !activeBusinessId || !sessionBusinessId || activeBusinessId !== sessionBusinessId) return 0;
  applyingRemote++;
  try {
    const res = await syncIncrementalWithServer({ businessId: activeBusinessId, pullOnly: true });
    return res.action === 'synced' ? res.pulledCount : 0;
  } catch {
    return 0;
  } finally {
    applyingRemote--;
  }
}

export function isCloudReady(): boolean {
  return ready;
}
