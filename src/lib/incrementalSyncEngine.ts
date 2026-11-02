/**
 * Client-Side Incremental Synchronization Engine
 * Saifee FMCG Wholesale Distribution & Trade Management System
 * File: src/lib/incrementalSyncEngine.ts
 *
 * SAFETY & ARCHITECTURE PRINCIPLES:
 * 1. PERSISTENT OFFLINE WORKING STORE: All working data lives in IndexedDB / local memory.
 * 2. HIGH-WATERMARK CHECKPOINTS: Remembers last successful sync timestamp per tenant.
 * 3. DELTA-ONLY DOWNLOADS: Only requests records modified after the checkpoint.
 * 4. SAFE MERGING: Protects local unpushed drafts and preserves immutable audit entries.
 * 5. RECONNECT & RETRY SAFETY: Automatic retry with exponential backoff on network restore.
 */

import { db } from './db';
import { getIdbItem, setIdbItem } from './indexedDbStorage';
import { SyncTombstone, SyncConflict } from './serverSyncEngine';

export interface IncrementalSyncResult {
  action: 'synced' | 'merged' | 'offline' | 'error' | 'unconfigured' | 'idle';
  pulledCount: number;
  pushedCount: number;
  conflicts: SyncConflict[];
  message: string;
}

const CHECKPOINT_PREFIX = 'fmcg_sync_checkpoint_';

export async function getSyncCheckpoint(businessId: string): Promise<string | null> {
  const key = `${CHECKPOINT_PREFIX}${businessId}`;
  return getIdbItem<string>(key);
}

export async function setSyncCheckpoint(businessId: string, timestamp: string): Promise<void> {
  const key = `${CHECKPOINT_PREFIX}${businessId}`;
  await setIdbItem(key, timestamp);
}

/**
 * Gathers unpushed local changes across local collections for incremental upload.
 */
export function gatherLocalChanges(businessId: string, sinceCheckpoint: string | null): {
  changes: Record<string, any[]>;
  tombstones: SyncTombstone[];
} {
  const changes: Record<string, any[]> = {};
  const tombstones: SyncTombstone[] = [];
  const sinceTime = sinceCheckpoint ? new Date(sinceCheckpoint).getTime() : 0;

  // Filter helper
  function getRecent<T extends { updated_at?: string; created_at?: string; active?: boolean; id?: string }>(
    items: T[],
    table: string
  ): T[] {
    return items.filter(it => {
      const t = it.updated_at || it.created_at;
      if (!t) return false;
      const itemTime = new Date(t).getTime();
      if (itemTime > sinceTime) {
        if (it.active === false && it.id) {
          tombstones.push({
            table,
            id: it.id,
            deleted_at: t
          });
        }
        return true;
      }
      return false;
    });
  }

  // Master and transaction tables
  const localProducts = db.getProducts(businessId);
  const recentProducts = getRecent(localProducts, 'products');
  if (recentProducts.length > 0) changes.products = recentProducts;

  const localCategories = db.getCategories(businessId);
  const recentCategories = getRecent(localCategories, 'categories');
  if (recentCategories.length > 0) changes.categories = recentCategories;

  const localRetailers = db.getRetailers(businessId);
  const recentRetailers = getRecent(localRetailers, 'retailers');
  if (recentRetailers.length > 0) changes.retailers = recentRetailers;

  // Godowns & suppliers: sirf tab push karo jab pehle sync ho chuka ho (checkpoint maujood).
  // Fresh browser ke pehle sync me cloud ko source maana jaata hai, taaki code ke default
  // (seed) godowns cloud ka data overwrite na kar dein.
  if (sinceCheckpoint) {
    const recentGodowns = getRecent(db.getGodowns(businessId), 'godowns');
    if (recentGodowns.length > 0) changes.godowns = recentGodowns;

    const recentSuppliers = getRecent(db.getSuppliers(businessId), 'suppliers');
    if (recentSuppliers.length > 0) changes.suppliers = recentSuppliers;
  }

  const localOrders = db.getOrders(businessId);
  const recentOrders = getRecent(localOrders, 'orders');
  if (recentOrders.length > 0) changes.orders = recentOrders;

  const localInvoices = db.getInvoices(businessId);
  const recentInvoices = getRecent(localInvoices, 'invoices');
  if (recentInvoices.length > 0) changes.invoices = recentInvoices;

  const localPayments = db.getPayments(businessId);
  const recentPayments = getRecent(localPayments, 'payments');
  if (recentPayments.length > 0) changes.payments = recentPayments;

  const localLedger = db.getLedger(businessId);
  const recentLedger = getRecent(localLedger, 'stock_ledger');
  if (recentLedger.length > 0) changes.stock_ledger = recentLedger;

  return { changes, tombstones };
}

/**
 * Executes a full incremental sync pass:
 * 1. Push local changes since last checkpoint
 * 2. Pull remote server deltas since checkpoint
 * 3. Merges deltas into IndexedDB / local memory store
 * 4. Advances tenant sync checkpoint
 */
export async function syncIncrementalWithServer(options?: {
  businessId?: string;
  forcePullAll?: boolean;
  /** Cloud-only mode: sirf cloud se lao, local se kuch push mat karo (push ab cloudWriteThrough karta hai). */
  pullOnly?: boolean;
}): Promise<IncrementalSyncResult> {
  const activeBiz = options?.businessId || db.getActiveBusinessCompanyId();
  const checkpoint = options?.forcePullAll ? null : await getSyncCheckpoint(activeBiz);

  // Check network connectivity
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      action: 'offline',
      pulledCount: 0,
      pushedCount: 0,
      conflicts: [],
      message: 'Device is offline. Changes safely preserved in local IndexedDB storage.'
    };
  }

  try {
    // ------------------------------------------------------------------------
    // PHASE 1: PUSH LOCAL CHANGES
    // ------------------------------------------------------------------------
    const { changes, tombstones } = options?.pullOnly
      ? { changes: {} as Record<string, any[]>, tombstones: [] as SyncTombstone[] }
      : gatherLocalChanges(activeBiz, checkpoint);
    let pushedCount = 0;
    let pushConflicts: SyncConflict[] = [];

    const hasLocalChanges = Object.keys(changes).length > 0 || tombstones.length > 0;

    if (hasLocalChanges) {
      const pushRes = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientSyncTimestamp: new Date().toISOString(),
          business_id: activeBiz,
          changes,
          tombstones
        })
      });

      if (pushRes.status === 503) {
        // Server database not configured, return notice
        return {
          action: 'unconfigured',
          pulledCount: 0,
          pushedCount: 0,
          conflicts: [],
          message: 'PostgreSQL database not configured on server. Operating in offline/local storage mode.'
        };
      }

      if (!pushRes.ok) {
        throw new Error(`Push failed with HTTP ${pushRes.status}`);
      }

      const pushJson = await pushRes.json();
      pushedCount = pushJson.appliedCount || 0;
      pushConflicts = pushJson.conflicts || [];
    }

    // ------------------------------------------------------------------------
    // PHASE 2: PULL REMOTE DELTAS
    // ------------------------------------------------------------------------
    // Pull ALL pages (2000 rows per table per page) so large catalogs load completely
    const PULL_PAGE_SIZE = 5000; // fewer round trips (server max 5000)
    const MAX_PULL_PAGES = 50;
    let pulledCount = 0;
    let pageOffset = 0;
    let firstServerTimestamp: string | null = null;

    for (let pageNo = 0; pageNo < MAX_PULL_PAGES; pageNo++) {
    const pullRes = await fetch('/api/sync/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        since: checkpoint,
        limit: PULL_PAGE_SIZE,
        offset: pageOffset
      })
    });

    if (pullRes.status === 503) {
      return {
        action: 'unconfigured',
        pulledCount: 0,
        pushedCount: 0,
        conflicts: [],
        message: 'PostgreSQL database not configured on server. Operating in offline/local storage mode.'
      };
    }

    if (!pullRes.ok) {
      throw new Error(`Pull failed with HTTP ${pullRes.status}`);
    }

    const pullJson = await pullRes.json();
    if (pageNo === 0) firstServerTimestamp = pullJson.serverTimestamp || null;

    if (pullJson.success && pullJson.changes) {
      const serverChanges = pullJson.changes;

      // Merge categories
      if (Array.isArray(serverChanges.categories) && serverChanges.categories.length > 0) {
        const localCats = db.getCategories(activeBiz);
        const map = new Map(localCats.map(c => [c.id, c]));
        serverChanges.categories.forEach((sc: any) => {
          map.set(sc.id, { ...map.get(sc.id), ...sc });
          pulledCount++;
        });
        db.saveCategories(Array.from(map.values()), activeBiz);
      }

      // Merge products
      if (Array.isArray(serverChanges.products) && serverChanges.products.length > 0) {
        const localProds = db.getProducts(activeBiz);
        const map = new Map(localProds.map(p => [p.id, p]));
        serverChanges.products.forEach((sp: any) => {
          const parsed = {
            ...sp,
            selling_price: sp.selling_price !== undefined && sp.selling_price !== null ? Number(sp.selling_price) : 0,
            purchase_price: sp.purchase_price !== undefined && sp.purchase_price !== null ? Number(sp.purchase_price) : 0,
            mrp: sp.mrp !== undefined && sp.mrp !== null ? Number(sp.mrp) : 0,
            loose_selling_price: sp.loose_selling_price !== undefined && sp.loose_selling_price !== null && sp.loose_selling_price !== '' ? Number(sp.loose_selling_price) : undefined,
            loose_purchase_price: sp.loose_purchase_price !== undefined && sp.loose_purchase_price !== null && sp.loose_purchase_price !== '' ? Number(sp.loose_purchase_price) : undefined,
            loose_mrp: sp.loose_mrp !== undefined && sp.loose_mrp !== null && sp.loose_mrp !== '' ? Number(sp.loose_mrp) : undefined,
            dealer_price: sp.dealer_price !== undefined && sp.dealer_price !== null && sp.dealer_price !== '' ? Number(sp.dealer_price) : undefined,
            pieces_per_carton: sp.pieces_per_carton !== undefined && sp.pieces_per_carton !== null ? Number(sp.pieces_per_carton) : undefined,
            units_per_box_carton: sp.units_per_box_carton !== undefined && sp.units_per_box_carton !== null ? Number(sp.units_per_box_carton) : undefined,
          };
          map.set(sp.id, { ...map.get(sp.id), ...parsed });
          pulledCount++;
        });
        db.saveProducts(Array.from(map.values()), activeBiz);
      }

      // Merge retailers
      if (Array.isArray(serverChanges.retailers) && serverChanges.retailers.length > 0) {
        const localRets = db.getRetailers(activeBiz);
        const map = new Map(localRets.map(r => [r.id, r]));
        serverChanges.retailers.forEach((sr: any) => {
          map.set(sr.id, { ...map.get(sr.id), ...sr });
          pulledCount++;
        });
        db.saveRetailers(Array.from(map.values()), activeBiz);
      }

      // Merge orders
      if (Array.isArray(serverChanges.orders) && serverChanges.orders.length > 0) {
        const localOrds = db.getOrders(activeBiz);
        const map = new Map(localOrds.map(o => [o.id, o]));
        serverChanges.orders.forEach((so: any) => {
          map.set(so.id, { ...map.get(so.id), ...so });
          pulledCount++;
        });
        db.saveOrders(Array.from(map.values()), activeBiz);
      }

      // Merge invoices
      if (Array.isArray(serverChanges.invoices) && serverChanges.invoices.length > 0) {
        const localInvs = db.getInvoices(activeBiz);
        const map = new Map(localInvs.map(inv => [inv.id, inv]));
        serverChanges.invoices.forEach((si: any) => {
          map.set(si.id, { ...map.get(si.id), ...si });
          pulledCount++;
        });
        db.saveInvoices(Array.from(map.values()), activeBiz);
      }

      // Merge payments
      if (Array.isArray(serverChanges.payments) && serverChanges.payments.length > 0) {
        const localPays = db.getPayments(activeBiz);
        const map = new Map(localPays.map(p => [p.id, p]));
        serverChanges.payments.forEach((sp: any) => {
          map.set(sp.id, { ...map.get(sp.id), ...sp });
          pulledCount++;
        });
        db.savePayments(Array.from(map.values()), activeBiz);
      }

      // Merge inventory (product + godown = ek row; local ID rakho, warna stock double dikhta hai)
      if (Array.isArray(serverChanges.inventory) && serverChanges.inventory.length > 0) {
        const localInv = db.getInventory(activeBiz);
        const keyOfInv = (i: any) => `${i.product_id}|${i.godown_id || ''}`;
        const map = new Map(localInv.map(i => [keyOfInv(i), i]));
        serverChanges.inventory.forEach((si: any) => {
          const key = keyOfInv(si);
          const local: any = map.get(key);
          const parsed = {
            ...si,
            physical_qty: Number(si.physical_qty) || 0,
            reserved_qty: Number(si.reserved_qty) || 0,
            available_qty: Number(si.available_qty) || 0,
            damaged_qty: Number(si.damaged_qty) || 0,
            expired_qty: Number(si.expired_qty) || 0,
            pending_qty: Number(si.pending_qty) || 0,
            updated_at: si.updated_at ? new Date(si.updated_at).toISOString() : new Date().toISOString()
          };
          if (!local) {
            map.set(key, parsed);
          } else if ((Date.parse(parsed.updated_at) || 0) > (Date.parse(local.updated_at) || 0)) {
            map.set(key, { ...local, ...parsed, id: local.id });
          }
          pulledCount++;
        });
        db.saveInventory(Array.from(map.values()), activeBiz);
      }

      // Stock batches (opening stock import se aate hain). Sirf naye batch jodo:
      // device/app_records wali copy me quantity already updated hoti hai.
      if (Array.isArray(serverChanges.inventory_batches) && serverChanges.inventory_batches.length > 0) {
        const localBatches = db.getBatches(activeBiz);
        const existing = new Set(localBatches.map(b => b.id));
        const dateOnly = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : undefined);
        serverChanges.inventory_batches.forEach((sb: any) => {
          if (!sb.id || existing.has(sb.id)) return;
          existing.add(sb.id);
          localBatches.push({
            id: sb.id,
            business_id: sb.business_id || activeBiz,
            product_id: sb.product_id,
            godown_id: sb.godown_id || undefined,
            godown: sb.godown || sb.godown_name || undefined,
            batch_number: sb.batch_number,
            mfg_date: dateOnly(sb.mfg_date),
            expiry_date: dateOnly(sb.expiry_date) || '',
            purchase_rate: Number(sb.purchase_rate) || 0,
            selling_price: sb.selling_price !== null && sb.selling_price !== undefined ? Number(sb.selling_price) : undefined,
            loose_selling_price: sb.loose_selling_price !== null && sb.loose_selling_price !== undefined ? Number(sb.loose_selling_price) : undefined,
            mrp: Number(sb.mrp) || 0,
            quantity: Number(sb.quantity) || 0,
            entry_date: dateOnly(sb.entry_date),
            cost_layer: sb.cost_layer || undefined
          } as any);
          pulledCount++;
        });
        db.saveBatches(localBatches, activeBiz);
      }

      // Product <-> category links
      if (Array.isArray(serverChanges.product_categories) && serverChanges.product_categories.length > 0) {
        const localPcs = db.getProductCategories(activeBiz);
        const existing = new Set(localPcs.map(pc => `${pc.product_id}|${pc.category_id}`));
        serverChanges.product_categories.forEach((spc: any) => {
          const k = `${spc.product_id}|${spc.category_id}`;
          if (!spc.product_id || !spc.category_id || existing.has(k)) return;
          existing.add(k);
          localPcs.push({
            id: spc.id || `pc-${spc.product_id}-${spc.category_id}`,
            product_id: spc.product_id,
            category_id: spc.category_id,
            business_id: activeBiz,
            created_at: spc.created_at ? new Date(spc.created_at).toISOString() : new Date().toISOString()
          });
          pulledCount++;
        });
        db.saveProductCategories(localPcs, activeBiz);
      }

      // Merge godowns
      if (Array.isArray(serverChanges.godowns) && serverChanges.godowns.length > 0) {
        const localGodowns = db.getGodowns(activeBiz);
        const map = new Map(localGodowns.map(g => [g.id, g]));
        serverChanges.godowns.forEach((sg: any) => {
          map.set(sg.id, { ...map.get(sg.id), ...sg });
          pulledCount++;
        });
        db.saveGodowns(Array.from(map.values()), activeBiz);
      }

      // Merge profiles (password hash kabhi cloud se nahi aata)
      if (Array.isArray(serverChanges.profiles) && serverChanges.profiles.length > 0) {
        const localProfiles = db.getProfiles();
        const map = new Map(localProfiles.map(pf => [pf.id, pf]));
        serverChanges.profiles.forEach((sp: any) => {
          map.set(sp.id, { ...map.get(sp.id), ...sp });
          pulledCount++;
        });
        db.saveProfiles(Array.from(map.values()));
      }

      // Merge suppliers
      if (Array.isArray(serverChanges.suppliers) && serverChanges.suppliers.length > 0) {
        const localSupp = db.getSuppliers(activeBiz);
        const map = new Map(localSupp.map(sp => [sp.id, sp]));
        serverChanges.suppliers.forEach((ss: any) => {
          map.set(ss.id, { ...map.get(ss.id), ...ss, gstin: ss.gstin ?? '', address: ss.address ?? '' });
          pulledCount++;
        });
        db.saveSuppliers(Array.from(map.values()), activeBiz);
      }

      // Merge companies
      if (Array.isArray(serverChanges.companies) && serverChanges.companies.length > 0) {
        const localComps = db.getCompanies();
        const map = new Map(localComps.map(c => [c.id, c]));
        serverChanges.companies.forEach((sc: any) => {
          map.set(sc.id, { ...map.get(sc.id), ...sc });
          pulledCount++;
        });
        db.saveCompanies(Array.from(map.values()));
      }

      // Merge stock_ledger (Strictly append-only: union unique IDs)
      if (Array.isArray(serverChanges.stock_ledger) && serverChanges.stock_ledger.length > 0) {
        const localLed = db.getLedger(activeBiz);
        const existingIds = new Set(localLed.map(l => l.id));
        serverChanges.stock_ledger.forEach((sl: any) => {
          if (!existingIds.has(sl.id)) {
            localLed.push(sl);
            existingIds.add(sl.id);
            pulledCount++;
          }
        });
        db.saveLedger(localLed, activeBiz);
      }

      // Process tombstones
      if (Array.isArray(pullJson.tombstones) && pullJson.tombstones.length > 0) {
        pullJson.tombstones.forEach((tomb: SyncTombstone) => {
          if (tomb.table === 'products') {
            const prods = db.getProducts(activeBiz);
            const found = prods.find(p => p.id === tomb.id);
            if (found) found.active = false;
            db.saveProducts(prods, activeBiz);
          } else if (tomb.table === 'retailers') {
            const rets = db.getRetailers(activeBiz);
            const found = rets.find(r => r.id === tomb.id);
            if (found) found.active = false;
            db.saveRetailers(rets, activeBiz);
          } else if (tomb.table === 'categories') {
            const cats = db.getCategories(activeBiz);
            const found = cats.find(c => c.id === tomb.id);
            if (found) found.active = false;
            db.saveCategories(cats, activeBiz);
          }
        });
      }

      // Advance checkpoint ONLY if pull succeeded and there are no remaining pages
      // Use the FIRST page's timestamp so rows changed during paging are re-pulled next time
      if (firstServerTimestamp && !pullJson.hasMore) {
        await setSyncCheckpoint(activeBiz, firstServerTimestamp);
      }

      // Suppress legacy snapshot push writes while incremental sync is active
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('fmcg_suppress_legacy_snapshot_push', 'true');
        } catch {}
      }
    }

    if (!pullJson.success || !pullJson.hasMore) break;
    pageOffset += PULL_PAGE_SIZE;
    }

    const hasTransferred = (pulledCount > 0 || pushedCount > 0);
    const action: IncrementalSyncResult['action'] = hasTransferred ? 'synced' : 'idle';
    const message = hasTransferred
      ? `Incremental sync complete: ${pushedCount} pushed, ${pulledCount} pulled.`
      : 'Incremental sync: Up to date (0 pending).';

    return {
      action,
      pulledCount,
      pushedCount,
      conflicts: pushConflicts,
      message
    };
  } catch (err: any) {
    console.warn('[INCREMENTAL_SYNC_ERROR]:', err?.message);
    return {
      action: 'error',
      pulledCount: 0,
      pushedCount: 0,
      conflicts: [],
      message: `Sync interrupted: ${err?.message || 'Network exception'}. Local changes preserved.`
    };
  }
}
