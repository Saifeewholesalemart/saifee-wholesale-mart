import type { Invoice, Order, Product, Retailer } from '@/lib/db';
import { isWalkInRetailerId } from '@/lib/db';

/** "Parle-G 100g (MRP ₹10)" — MRP is part of how the team identifies a product. */
export function productLabel(product?: Partial<Product> | null, fallback = 'Item'): string {
  const name = (product?.name || fallback).trim();
  const mrp = Number(product?.mrp) || 0;
  if (!mrp || /mrp|₹/i.test(name)) return name;
  return `${name} (MRP ₹${mrp % 1 === 0 ? mrp : mrp.toFixed(2)})`;
}

export function customerName(order: Order, retailers: Retailer[]): string {
  const r = retailers.find(x => x.id === order.retailer_id);
  if (r) return r.shop_name || r.owner_name || 'Customer';
  if (isWalkInRetailerId(order.retailer_id)) {
    const m = String(order.admin_notes || '').match(/Walk-in:\s*([^(|]+?)\s*\(/);
    return m?.[1]?.trim() ? `${m[1].trim()} (Walk-in)` : 'Counter / Walk-in';
  }
  return 'Customer';
}

export function formatINR(n: number): string {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Search and filters shared by every tab of the Orders page
// ---------------------------------------------------------------------------

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface OrderFilter {
  search: string;
  date: DatePreset;
  from: string;
  to: string;
  retailerId: string;
  channel: string;
  createdBy: string;
  city: string;
  min: string;
  max: string;
}

export const EMPTY_FILTER: OrderFilter = {
  search: '', date: 'all', from: '', to: '', retailerId: '', channel: '', createdBy: '', city: '', min: '', max: ''
};

export function countActiveFilters(f: OrderFilter): number {
  return [f.retailerId, f.channel, f.createdBy, f.city, f.min, f.max].filter(Boolean).length;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export function dateInRange(iso: string | undefined, f: OrderFilter): boolean {
  if (f.date === 'all') return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  const now = new Date();
  const today = startOfDay(now).getTime();
  if (f.date === 'today') return t >= today;
  if (f.date === 'week') {
    const day = (now.getDay() + 6) % 7; // Monday = 0
    return t >= today - day * 86400000;
  }
  if (f.date === 'month') return t >= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : -Infinity;
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity;
  return t >= from && t <= to;
}

export function orderMatchesFilter(
  o: Order,
  f: OrderFilter,
  ctx: { retailers: Retailer[]; products: Product[]; invoiceNumbers?: string[] }
): boolean {
  if (!dateInRange(o.order_date || o.created_at, f)) return false;
  if (f.retailerId && o.retailer_id !== f.retailerId) return false;
  if (f.channel && o.source !== f.channel) return false;
  if (f.createdBy && (o.created_by || '') !== f.createdBy) return false;
  const r = ctx.retailers.find(x => x.id === o.retailer_id);
  if (f.city && (r?.city || '').toLowerCase() !== f.city.toLowerCase()) return false;
  const amt = Number(o.total_amount) || 0;
  if (f.min !== '' && !isNaN(Number(f.min)) && amt < Number(f.min)) return false;
  if (f.max !== '' && !isNaN(Number(f.max)) && amt > Number(f.max)) return false;
  const q = f.search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    o.order_number,
    customerName(o, ctx.retailers),
    r?.owner_name, r?.mobile, (r as any)?.phone, r?.gstin, r?.city,
    o.created_by,
    ...(ctx.invoiceNumbers || []),
    ...(o.items || []).map(it => ctx.products.find(p => p.id === it.product_id)?.name)
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

// ---------------------------------------------------------------------------
// Sorting used on every tab of the Orders page
// ---------------------------------------------------------------------------

export type OrderSort = 'oldest' | 'newest' | 'lines_desc' | 'lines_asc' | 'amount_desc' | 'amount_asc';

export const ORDER_SORT_OPTIONS: { value: OrderSort; label: string }[] = [
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'lines_desc', label: 'Most item lines first' },
  { value: 'lines_asc', label: 'Fewest item lines first' },
  { value: 'amount_desc', label: 'Amount: high to low' },
  { value: 'amount_asc', label: 'Amount: low to high' }
];

/** Sorts any list by the chosen order. lines/amount/time say how to read each entry. */
export function sortByOrderSort<T>(
  list: T[],
  sort: OrderSort,
  get: { time: (x: T) => number; lines: (x: T) => number; amount: (x: T) => number }
): T[] {
  const out = [...list];
  const tie = (a: T, b: T) => get.time(a) - get.time(b);
  switch (sort) {
    case 'newest': return out.sort((a, b) => get.time(b) - get.time(a));
    case 'lines_desc': return out.sort((a, b) => (get.lines(b) - get.lines(a)) || tie(a, b));
    case 'lines_asc': return out.sort((a, b) => (get.lines(a) - get.lines(b)) || tie(a, b));
    case 'amount_desc': return out.sort((a, b) => (get.amount(b) - get.amount(a)) || tie(a, b));
    case 'amount_asc': return out.sort((a, b) => (get.amount(a) - get.amount(b)) || tie(a, b));
    default: return out.sort(tie);
  }
}

// ---------------------------------------------------------------------------
// Last billing rates of an item (from the bills already made)
// ---------------------------------------------------------------------------

export interface PastRate {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  retailerId: string;
  shopName: string;
  qty: number;
  rate: number;
  unitsPerPack: number;
}

/** Newest first. retailerId set = only that shop. */
export function recentBillingRates(
  invoices: Invoice[],
  retailers: Retailer[],
  productId: string,
  options: { retailerId?: string; limit?: number } = {}
): PastRate[] {
  const limit = options.limit ?? 5;
  const out: PastRate[] = [];
  const sorted = invoices
    .filter(inv => (inv as any).status !== 'Cancelled' && (!options.retailerId || inv.retailer_id === options.retailerId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const inv of sorted) {
    for (const it of inv.items || []) {
      if (it.product_id !== productId) continue;
      const r = retailers.find(x => x.id === inv.retailer_id);
      out.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        date: inv.date,
        retailerId: inv.retailer_id,
        shopName: r?.shop_name || (isWalkInRetailerId(inv.retailer_id) ? 'Counter / Walk-in' : 'Customer'),
        qty: Number(it.base_qty ?? it.quantity) || 0,
        rate: Number(it.carton_rate ?? it.rate) || 0,
        unitsPerPack: Number(it.units_per_trading_unit) || 1
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Purchase rate per trading unit (same unit as the bill rate).
 * Uses the batch that goes out first (FIFO: earliest expiry with stock), else the product's purchase price.
 */
export function purchaseRateOf(
  product: { id: string; purchase_price?: number } | null | undefined,
  batches: { product_id: string; quantity: number; expiry_date?: string; purchase_rate?: number }[]
): number {
  if (!product) return 0;
  const live = batches
    .filter(b => b.product_id === product.id && (b.quantity || 0) > 0 && (Number(b.purchase_rate) || 0) > 0)
    .sort((a, b) => new Date(a.expiry_date || '9999-12-31').getTime() - new Date(b.expiry_date || '9999-12-31').getTime());
  if (live.length) return Number(live[0].purchase_rate) || 0;
  return Number(product.purchase_price) || 0;
}

export function marginPercent(rate: number, purchase: number): number | null {
  return purchase > 0 && rate > 0 ? ((rate - purchase) / rate) * 100 : null;
}
