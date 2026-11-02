/**
 * Cloud record store rules (shared by browser + server).
 * File: src/lib/cloudRecordStores.ts
 *
 * Har local "store" (jaise fmcg_orders) ka har record cloud ke `app_records`
 * table me ek row ban kar save hota hai. Ye file batati hai:
 *   - kaunse stores cloud me jaate hain
 *   - record ki ID aur company (business_id) kaise nikalni hai
 *   - kaunse stores sirf "add" hote hain (ledger/audit kabhi delete nahi hote)
 */

/** Profiles (login + password) apne alag secure API se save hote hain. */
export const EXCLUDED_STORES = new Set<string>(['fmcg_profiles']);

/**
 * Ye master tables pehle se normalized cloud tables me bhi hain
 * (products import inhi me hua tha). Inke liye cloud load "merge" hota hai:
 * jo record naya (updated_at) ho, wahi jeetta hai.
 */
export const NORMALIZED_MASTER_STORES: Record<string, string> = {
  fmcg_products: 'products',
  fmcg_categories: 'categories',
  fmcg_retailers: 'retailers',
  fmcg_godowns: 'godowns',
  fmcg_suppliers: 'suppliers',
  fmcg_inventory: 'inventory'
};

/** Company-level setup stores: merge on load, never wiped. */
export const MERGE_ONLY_STORES = new Set<string>([
  ...Object.keys(NORMALIZED_MASTER_STORES),
  'fmcg_business_companies',
  'fmcg_companies',
  'fmcg_company_members'
]);

/** Append-only history: never deleted from cloud. */
export const APPEND_ONLY_STORES = new Set<string>([
  'fmcg_ledger',
  'fmcg_stock_ledger',
  'fmcg_rate_audit_logs',
  'fmcg_billing_rate_audits',
  'fmcg_invoice_audit_logs',
  'fmcg_invoice_audits',
  'fmcg_item_activity_logs'
]);

/** Stores where `company_id` holds the business (tenant) id. */
const COMPANY_ID_IS_TENANT = new Set<string>([
  'fmcg_cash_flow',
  'fmcg_cash_flow_transactions',
  'fmcg_company_opening_balances',
  'fmcg_stock_transfers',
  'fmcg_godowns',
  'fmcg_company_members'
]);

const STORE_NAME_RE = /^fmcg_[a-z0-9_]{2,60}$/;

/** Fields that must never leave the device or be stored in app_records. */
export const SECRET_FIELDS = ['password', 'password_hash', 'plain_password'];

export function isValidStoreName(store: unknown): store is string {
  return typeof store === 'string' && STORE_NAME_RE.test(store);
}

export function isCloudSyncedStore(store: string): boolean {
  return isValidStoreName(store) && !EXCLUDED_STORES.has(store);
}

export function resolveRecordId(store: string, item: any): string | null {
  if (!item || typeof item !== 'object') return null;
  if (item.id !== undefined && item.id !== null && String(item.id).trim() !== '') {
    const id = String(item.id).trim();
    return id.length <= 200 ? id : null;
  }
  if (store === 'fmcg_company_opening_balances') {
    const biz = item.business_id || item.company_id;
    return biz ? `ob-${biz}` : null;
  }
  return null;
}

export function resolveRecordTenant(store: string, item: any, fallbackBusinessId: string): string {
  if (store === 'fmcg_business_companies') {
    return String(item?.id || fallbackBusinessId);
  }
  if (item && typeof item === 'object') {
    if (item.business_id) return String(item.business_id);
    if (COMPANY_ID_IS_TENANT.has(store) && item.company_id) return String(item.company_id);
  }
  return fallbackBusinessId;
}

/** Removes secret fields (top level) before upload. */
export function stripSecrets<T>(item: T): T {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let copy: any = null;
  for (const f of SECRET_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(item, f)) {
      if (!copy) copy = { ...(item as any) };
      delete copy[f];
    }
  }
  return (copy || item) as T;
}
