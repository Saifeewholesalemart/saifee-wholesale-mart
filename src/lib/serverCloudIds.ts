/**
 * List of record IDs that really exist in the cloud, per local store.
 * Devices use it (about once a day) to silently remove leftovers they still keep
 * but the cloud no longer has. SERVER-ONLY.
 */

import { executeRawQuery } from './serverDb';

/** Normalized (old) master tables that devices also load, mapped to the local store name. */
const NORMALIZED_ID_SOURCES: { store: string; sql: string }[] = [
  { store: 'fmcg_products', sql: `SELECT id FROM products WHERE business_id = $1` },
  { store: 'fmcg_categories', sql: `SELECT id FROM categories WHERE business_id = $1` },
  { store: 'fmcg_retailers', sql: `SELECT id FROM retailers WHERE business_id = $1 AND active IS NOT FALSE` },
  { store: 'fmcg_godowns', sql: `SELECT id FROM godowns WHERE business_id = $1` },
  { store: 'fmcg_suppliers', sql: `SELECT id FROM suppliers WHERE business_id = $1` },
  { store: 'fmcg_batches', sql: `SELECT id FROM inventory_batches WHERE business_id = $1` },
  {
    store: 'fmcg_product_categories',
    sql: `SELECT coalesce(pc.id::text, 'pc-' || pc.product_id || '-' || pc.category_id) AS id
            FROM product_categories pc JOIN products p ON p.id = pc.product_id
           WHERE p.business_id = $1`
  },
  { store: 'fmcg_profiles', sql: `SELECT id FROM profiles WHERE business_id = $1` }
];

/** Stores that are checked. Append-only history and stock rows keyed differently are left alone. */
export const RECONCILED_STORES = new Set<string>([
  'fmcg_products', 'fmcg_categories', 'fmcg_retailers', 'fmcg_godowns', 'fmcg_suppliers',
  'fmcg_batches', 'fmcg_product_categories', 'fmcg_profiles',
  'fmcg_orders', 'fmcg_invoices', 'fmcg_payments', 'fmcg_payment_allocations', 'fmcg_delivery_challans',
  'fmcg_fulfilments', 'fmcg_sales_returns', 'fmcg_purchases', 'fmcg_purchase_returns',
  'fmcg_cash_flow', 'fmcg_cash_flow_transactions', 'fmcg_stock_transfers', 'fmcg_product_aliases'
]);

export async function getCloudIdLists(businessId: string): Promise<Record<string, string[]>> {
  const sets = new Map<string, Set<string>>();
  RECONCILED_STORES.forEach(st => sets.set(st, new Set()));
  const add = (store: string, id: unknown) => {
    if (id === null || id === undefined) return;
    const s = String(id).trim();
    if (!s) return;
    (sets.get(store) || sets.set(store, new Set()).get(store)!).add(s);
  };

  // 1. Live records saved by the app
  const stores = Array.from(RECONCILED_STORES);
  const ar = await executeRawQuery<{ store: string; id: string }>(
    `SELECT store, id FROM app_records WHERE business_id = $1 AND NOT deleted AND store = ANY($2::text[])`,
    [businessId, stores]
  );
  ar.rows.forEach((r: { store: string; id: string }) => add(r.store, r.id));

  // 2. Master tables (a missing table is simply skipped)
  for (const src of NORMALIZED_ID_SOURCES) {
    try {
      const res = await executeRawQuery<{ id: string }>(src.sql, [businessId]);
      res.rows.forEach((r: { id: string }) => add(src.store, r.id));
    } catch { /* table not present */ }
  }

  const out: Record<string, string[]> = {};
  sets.forEach((v, k) => { out[k] = Array.from(v); });
  return out;
}
