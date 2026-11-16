/**
 * "Party Report By Item" and "Item Report By Party", the same way Vyapar shows them.
 *
 * Party Report By Item: for the chosen item (or all items), how much each party bought from
 * us (sale) and how much we bought from each party (purchase).
 * Item Report By Party: for the chosen party (or all parties), how much of each item was
 * sold to / bought from them.
 *
 * Columns in both: Sale Qty, Sale Amount, Purchase Qty, Purchase Amount, with a Total line.
 * Rules:
 *  - quantity is in pieces; amount is the line amount on the bill (after discount, with GST);
 *  - cancelled bills and draft purchases are left out;
 *  - a sales return takes its quantity and amount off the sale side of that party and item,
 *    a purchase return takes them off the purchase side (so a line can go below zero, as in Vyapar);
 *  - only rows with some sale or purchase in the period are shown.
 */

export type ReportPeriod = 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_fy' | 'custom';

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_fy', label: 'This Financial Year' },
  { value: 'custom', label: 'Custom' }
];

export type SortBy = 'name' | 'sale_qty' | 'purchase_qty';

export interface PartyItemRow {
  id: string;
  name: string;
  /** 'Retailer' / 'Supplier' for parties, the category for items */
  kind: string;
  saleQty: number;
  saleAmount: number;
  purchaseQty: number;
  purchaseAmount: number;
}

export interface PartyItemTotals {
  saleQty: number;
  saleAmount: number;
  purchaseQty: number;
  purchaseAmount: number;
}

export interface PartyItemSource {
  invoices?: any[];
  salesReturns?: any[];
  purchases?: any[];
  purchaseReturns?: any[];
  products?: any[];
  retailers?: any[];
  suppliers?: any[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** First and last day (YYYY-MM-DD, both included) of a period, using the shop's local date. */
export function periodRange(period: ReportPeriod, customFrom?: string, customTo?: string, today: Date = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const t = ymd(today);
  switch (period) {
    case 'today':
      return { from: t, to: t };
    case 'this_week': {
      // week starts on Monday
      const day = (today.getDay() + 6) % 7;
      const start = new Date(y, m, today.getDate() - day);
      const end = new Date(y, m, today.getDate() - day + 6);
      return { from: ymd(start), to: ymd(end) };
    }
    case 'this_month':
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: ymd(new Date(y, q, 1)), to: ymd(new Date(y, q + 3, 0)) };
    }
    case 'this_fy': {
      const fyStart = m >= 3 ? y : y - 1; // Indian financial year: 1 April to 31 March
      return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
    }
    case 'custom':
    default: {
      const from = customFrom || t;
      const to = customTo || from;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** The bill's day as YYYY-MM-DD in local time ("2026-11-16" stays as it is; a full timestamp is converted). */
export function dayOf(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return ymd(d);
}

const n = (v: unknown) => {
  const x = Number(v);
  return isFinite(x) ? x : 0;
};
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function qtyOf(line: any): number {
  if (line.base_qty !== undefined && line.base_qty !== null) return n(line.base_qty);
  return n(line.quantity);
}

function saleLineAmount(line: any): number {
  if (line.total_amount !== undefined && line.total_amount !== null) return n(line.total_amount);
  const taxable = line.taxable_value !== undefined ? n(line.taxable_value) : qtyOf(line) * n(line.rate);
  const gst = line.gst_amount !== undefined ? n(line.gst_amount) : n(line.cgst) + n(line.sgst) + n(line.igst);
  return taxable + gst;
}

function purchaseLineAmount(line: any): number {
  if (line.total_amount !== undefined && line.total_amount !== null) return n(line.total_amount);
  if (line.taxable_value !== undefined) return n(line.taxable_value) + n(line.gst_amount);
  return qtyOf(line) * n(line.purchase_rate ?? line.carton_rate ?? line.rate);
}

const cancelled = (status: unknown) => String(status || '').toLowerCase() === 'cancelled';

/** One sale / purchase movement of one item with one party. */
interface Movement {
  partyId: string;
  partyKind: 'Retailer' | 'Supplier';
  productId: string;
  saleQty: number;
  saleAmount: number;
  purchaseQty: number;
  purchaseAmount: number;
}

function movements(src: PartyItemSource, from: string, to: string): Movement[] {
  const out: Movement[] = [];
  const inRange = (d: string) => d >= from && d <= to;
  const invoiceById = new Map((src.invoices || []).map(i => [i.id, i]));
  const purchaseById = new Map((src.purchases || []).map(p => [p.id, p]));

  for (const inv of src.invoices || []) {
    if (cancelled(inv.status) || cancelled(inv.invoice_status)) continue;
    if (!inRange(dayOf(inv.date || inv.invoice_date || inv.created_at))) continue;
    for (const line of inv.items || []) {
      if (!line.product_id) continue;
      out.push({
        partyId: inv.retailer_id || '', partyKind: 'Retailer', productId: line.product_id,
        saleQty: qtyOf(line), saleAmount: saleLineAmount(line), purchaseQty: 0, purchaseAmount: 0
      });
    }
  }

  for (const sr of src.salesReturns || []) {
    if (cancelled(sr.status)) continue;
    if (!inRange(dayOf(sr.return_date || sr.created_at))) continue;
    const partyId = sr.retailer_id || invoiceById.get(sr.invoice_id)?.retailer_id || '';
    for (const line of sr.items || []) {
      if (!line.product_id) continue;
      out.push({
        partyId, partyKind: 'Retailer', productId: line.product_id,
        saleQty: -qtyOf(line), saleAmount: -saleLineAmount(line), purchaseQty: 0, purchaseAmount: 0
      });
    }
  }

  for (const pur of src.purchases || []) {
    const st = String(pur.status || '').toLowerCase();
    if (st === 'draft' || st === 'cancelled') continue;
    if (!inRange(dayOf(pur.invoice_date || pur.date || pur.created_at))) continue;
    for (const line of pur.items || []) {
      if (!line.product_id) continue;
      out.push({
        partyId: pur.supplier_id || '', partyKind: 'Supplier', productId: line.product_id,
        saleQty: 0, saleAmount: 0, purchaseQty: qtyOf(line), purchaseAmount: purchaseLineAmount(line)
      });
    }
  }

  for (const pr of src.purchaseReturns || []) {
    if (cancelled(pr.status)) continue;
    if (!inRange(dayOf(pr.return_date || pr.created_at))) continue;
    const partyId = pr.supplier_id || purchaseById.get(pr.purchase_id)?.supplier_id || '';
    for (const line of pr.items || []) {
      if (!line.product_id) continue;
      out.push({
        partyId, partyKind: 'Supplier', productId: line.product_id,
        saleQty: 0, saleAmount: 0, purchaseQty: -qtyOf(line), purchaseAmount: -purchaseLineAmount(line)
      });
    }
  }
  return out;
}

export interface ReportOptions {
  period: ReportPeriod;
  customFrom?: string;
  customTo?: string;
  /** product category name, or 'all' */
  category: string;
  sortBy: SortBy;
  today?: Date;
}

function finish(map: Map<string, PartyItemRow>, sortBy: SortBy): { rows: PartyItemRow[]; totals: PartyItemTotals } {
  const rows = Array.from(map.values())
    .map(r => ({ ...r, saleQty: r3(r.saleQty), saleAmount: r2(r.saleAmount), purchaseQty: r3(r.purchaseQty), purchaseAmount: r2(r.purchaseAmount) }))
    .filter(r => r.saleQty !== 0 || r.saleAmount !== 0 || r.purchaseQty !== 0 || r.purchaseAmount !== 0);
  const byName = (a: PartyItemRow, b: PartyItemRow) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });
  if (sortBy === 'sale_qty') rows.sort((a, b) => b.saleQty - a.saleQty || byName(a, b));
  else if (sortBy === 'purchase_qty') rows.sort((a, b) => b.purchaseQty - a.purchaseQty || byName(a, b));
  else rows.sort(byName);
  const totals = rows.reduce<PartyItemTotals>((t, r) => ({
    saleQty: r3(t.saleQty + r.saleQty),
    saleAmount: r2(t.saleAmount + r.saleAmount),
    purchaseQty: r3(t.purchaseQty + r.purchaseQty),
    purchaseAmount: r2(t.purchaseAmount + r.purchaseAmount)
  }), { saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0 });
  return { rows, totals };
}

const categoryOk = (product: any, category: string) =>
  category === 'all' || (product?.category || 'Uncategorized') === category;

/** Party Report By Item: one row per party, for one item (or all items). */
export function partyReportByItem(src: PartyItemSource, opts: ReportOptions & { productId: string }) {
  const { from, to } = periodRange(opts.period, opts.customFrom, opts.customTo, opts.today);
  const products = new Map((src.products || []).map(p => [p.id, p]));
  const retailers = new Map((src.retailers || []).map(r => [r.id, r]));
  const suppliers = new Map((src.suppliers || []).map(s => [s.id, s]));
  const map = new Map<string, PartyItemRow>();
  for (const mv of movements(src, from, to)) {
    if (opts.productId !== 'all' && mv.productId !== opts.productId) continue;
    if (!categoryOk(products.get(mv.productId), opts.category)) continue;
    const key = `${mv.partyKind}:${mv.partyId}`;
    let row = map.get(key);
    if (!row) {
      const name = mv.partyKind === 'Retailer'
        ? (retailers.get(mv.partyId)?.shop_name || retailers.get(mv.partyId)?.owner_name || 'Unknown party')
        : (suppliers.get(mv.partyId)?.name || 'Unknown supplier');
      row = { id: key, name, kind: mv.partyKind, saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0 };
      map.set(key, row);
    }
    row.saleQty += mv.saleQty; row.saleAmount += mv.saleAmount;
    row.purchaseQty += mv.purchaseQty; row.purchaseAmount += mv.purchaseAmount;
  }
  return { ...finish(map, opts.sortBy), from, to };
}

/** Item Report By Party: one row per item, for one party (or all parties). partyId is 'Retailer:<id>' / 'Supplier:<id>' or 'all'. */
export function itemReportByParty(src: PartyItemSource, opts: ReportOptions & { partyId: string }) {
  const { from, to } = periodRange(opts.period, opts.customFrom, opts.customTo, opts.today);
  const products = new Map((src.products || []).map(p => [p.id, p]));
  const map = new Map<string, PartyItemRow>();
  for (const mv of movements(src, from, to)) {
    if (opts.partyId !== 'all' && `${mv.partyKind}:${mv.partyId}` !== opts.partyId) continue;
    const product = products.get(mv.productId);
    if (!categoryOk(product, opts.category)) continue;
    let row = map.get(mv.productId);
    if (!row) {
      row = {
        id: mv.productId, name: product?.name || 'Removed item', kind: product?.category || 'Uncategorized',
        saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0
      };
      map.set(mv.productId, row);
    }
    row.saleQty += mv.saleQty; row.saleAmount += mv.saleAmount;
    row.purchaseQty += mv.purchaseQty; row.purchaseAmount += mv.purchaseAmount;
  }
  return { ...finish(map, opts.sortBy), from, to };
}

/** Category names to choose from (products without one are "Uncategorized"). */
export function categoryOptions(products: any[] = []): string[] {
  const set = new Set<string>();
  products.forEach(p => set.add(p?.category || 'Uncategorized'));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
