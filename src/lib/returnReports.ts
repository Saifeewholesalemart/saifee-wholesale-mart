/**
 * Return reports:
 *  - Sales return items (credit notes)
 *  - Purchase return items (debit notes)
 *  - Damaged stock (what is lying as damaged now, and what came in / went out in the period)
 * General credit / debit notes have no items, so they are not in these item reports.
 */

import { dayOf } from './partyItemReports';

export interface ReturnSource {
  products?: any[];
  retailers?: any[];
  suppliers?: any[];
  invoices?: any[];
  purchases?: any[];
  salesReturns?: any[];
  purchaseReturns?: any[];
  inventory?: any[];
}

export interface ReturnLine {
  id: string;
  date: string;          // yyyy-mm-dd
  number: string;        // CN-… / DN-…
  partyId: string;
  partyName: string;
  productId: string;
  itemName: string;
  category: string;
  batch: string;
  mfg: string;
  expiry: string;
  condition: 'Good' | 'Damaged';
  qty: number;           // pieces
  taxable: number;
  gst: number;
  amount: number;
  reason: string;
}

export interface ReturnItemRow {
  id: string;
  itemName: string;
  category: string;
  qty: number;
  goodQty: number;
  damagedQty: number;
  taxable: number;
  amount: number;
  notes: number;          // how many notes
}

export interface DamagedRow {
  id: string;
  itemName: string;
  category: string;
  damagedNow: number;     // pieces lying as damaged now
  purchaseRate: number;   // per piece
  value: number;          // damagedNow × purchase rate
  cameIn: number;         // damaged pieces returned by shops in the period
  wentOut: number;        // damaged pieces sent back to parties in the period
  lastIn: string;         // last date damaged goods came in
}

const n = (v: unknown) => { const x = Number(v); return isFinite(x) ? x : 0; };
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const cancelled = (s: unknown) => String(s || '').toLowerCase() === 'cancelled';
const qtyOf = (line: any) => (line.base_qty !== undefined && line.base_qty !== null ? n(line.base_qty) : n(line.quantity));

function lineMoney(line: any): { taxable: number; gst: number; amount: number } {
  const gstOf = () => (line.gst_amount !== undefined ? n(line.gst_amount) : n(line.cgst) + n(line.sgst) + n(line.igst));
  if (line.total_amount !== undefined && line.total_amount !== null) {
    const gst = gstOf();
    const taxable = line.taxable_value !== undefined ? n(line.taxable_value) : n(line.total_amount) - gst;
    return { taxable: r2(taxable), gst: r2(gst), amount: r2(n(line.total_amount)) };
  }
  if (line.taxable_value !== undefined) {
    const gst = gstOf();
    return { taxable: r2(n(line.taxable_value)), gst: r2(gst), amount: r2(n(line.taxable_value) + gst) };
  }
  const taxable = r2(qtyOf(line) * n(line.rate));
  return { taxable, gst: 0, amount: taxable };
}

function lookups(src: ReturnSource) {
  const products = new Map((src.products || []).map(p => [p.id, p]));
  const retailers = new Map((src.retailers || []).map(r => [r.id, r]));
  const partyBySupplier = new Map<string, any>();
  (src.retailers || []).forEach(r => { if (r?.linked_supplier_id) partyBySupplier.set(r.linked_supplier_id, r); });
  const suppliers = new Map((src.suppliers || []).map(s => [s.id, s]));
  const invoices = new Map((src.invoices || []).map(i => [i.id, i]));
  const purchases = new Map((src.purchases || []).map(p => [p.id, p]));
  return { products, retailers, partyBySupplier, suppliers, invoices, purchases };
}

const inRange = (d: string, from: string, to: string) => (!from || d >= from) && (!to || d <= to);

/** Every item line of every credit note (sales return) in the period. */
export function salesReturnLines(src: ReturnSource, from: string, to: string): ReturnLine[] {
  const L = lookups(src);
  const out: ReturnLine[] = [];
  for (const sr of src.salesReturns || []) {
    if (cancelled(sr.status)) continue;
    const date = dayOf(sr.return_date || sr.created_at);
    if (!inRange(date, from, to)) continue;
    const partyId = sr.retailer_id || L.invoices.get(sr.invoice_id)?.retailer_id || '';
    const party = L.retailers.get(partyId);
    (sr.items || []).forEach((line: any, i: number) => {
      if (!line?.product_id) return;
      const prod = L.products.get(line.product_id);
      const m = lineMoney(line);
      out.push({
        id: `${sr.id}:${line.id || i}`,
        date,
        number: sr.credit_note_number || sr.id,
        partyId,
        partyName: party?.shop_name || party?.owner_name || 'Unknown party',
        productId: line.product_id,
        itemName: prod?.name || line.product_name || 'Unknown item',
        category: prod?.category || 'Uncategorized',
        batch: line.batch_number || '',
        mfg: line.mfg_date || '',
        expiry: line.expiry_date || '',
        condition: line.condition === 'Damaged' ? 'Damaged' : 'Good',
        qty: qtyOf(line),
        ...m,
        reason: sr.reason || ''
      });
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
}

/** Every item line of every debit note (purchase return) in the period. */
export function purchaseReturnLines(src: ReturnSource, from: string, to: string): ReturnLine[] {
  const L = lookups(src);
  const out: ReturnLine[] = [];
  for (const pr of src.purchaseReturns || []) {
    if (cancelled(pr.status)) continue;
    const date = dayOf(pr.return_date || pr.created_at);
    if (!inRange(date, from, to)) continue;
    const supplierId = pr.supplier_id || L.purchases.get(pr.purchase_id)?.supplier_id || '';
    const party = (pr.party_id && L.retailers.get(pr.party_id)) || L.partyBySupplier.get(supplierId);
    const partyId = party?.id || supplierId;
    const partyName = party?.shop_name || L.suppliers.get(supplierId)?.name || 'Unknown party';
    (pr.items || []).forEach((line: any, i: number) => {
      if (!line?.product_id) return;
      const prod = L.products.get(line.product_id);
      const m = lineMoney(line);
      out.push({
        id: `${pr.id}:${line.id || i}`,
        date,
        number: pr.debit_note_number || pr.id,
        partyId,
        partyName,
        productId: line.product_id,
        itemName: prod?.name || line.product_name || 'Unknown item',
        category: prod?.category || 'Uncategorized',
        batch: line.batch_number || '',
        mfg: line.mfg_date || '',
        expiry: line.expiry_date || '',
        condition: line.condition === 'Damaged' ? 'Damaged' : 'Good',
        qty: qtyOf(line),
        ...m,
        reason: pr.reason || ''
      });
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
}

/** One row per item. */
export function returnItemSummary(lines: ReturnLine[]): ReturnItemRow[] {
  const map = new Map<string, ReturnItemRow & { _notes: Set<string> }>();
  for (const l of lines) {
    let row = map.get(l.productId);
    if (!row) {
      row = { id: l.productId, itemName: l.itemName, category: l.category, qty: 0, goodQty: 0, damagedQty: 0, taxable: 0, amount: 0, notes: 0, _notes: new Set() };
      map.set(l.productId, row);
    }
    row.qty += l.qty;
    if (l.condition === 'Damaged') row.damagedQty += l.qty; else row.goodQty += l.qty;
    row.taxable += l.taxable;
    row.amount += l.amount;
    row._notes.add(l.number);
  }
  return Array.from(map.values())
    .map(({ _notes, ...r }) => ({ ...r, qty: r3(r.qty), goodQty: r3(r.goodQty), damagedQty: r3(r.damagedQty), taxable: r2(r.taxable), amount: r2(r.amount), notes: _notes.size }))
    .sort((a, b) => b.qty - a.qty || a.itemName.localeCompare(b.itemName));
}

/** Damaged stock now, with damaged goods in and out in the period. */
export function damagedStock(src: ReturnSource, from: string, to: string): DamagedRow[] {
  const L = lookups(src);
  const now = new Map<string, number>();
  for (const row of src.inventory || []) {
    if (!row?.product_id) continue;
    now.set(row.product_id, (now.get(row.product_id) || 0) + n(row.damaged_qty));
  }
  const cameIn = new Map<string, number>();
  const lastIn = new Map<string, string>();
  for (const l of salesReturnLines(src, '', '')) {
    if (l.condition !== 'Damaged') continue;
    if (!lastIn.has(l.productId) || l.date > lastIn.get(l.productId)!) lastIn.set(l.productId, l.date);
    if (inRange(l.date, from, to)) cameIn.set(l.productId, (cameIn.get(l.productId) || 0) + l.qty);
  }
  const wentOut = new Map<string, number>();
  for (const l of purchaseReturnLines(src, from, to)) {
    if (l.condition === 'Damaged') wentOut.set(l.productId, (wentOut.get(l.productId) || 0) + l.qty);
  }
  const ids = new Set([...now.keys(), ...cameIn.keys(), ...wentOut.keys()]);
  const rows: DamagedRow[] = [];
  ids.forEach(id => {
    const prod = L.products.get(id);
    const damagedNow = r3(now.get(id) || 0);
    const inQ = r3(cameIn.get(id) || 0);
    const outQ = r3(wentOut.get(id) || 0);
    if (damagedNow === 0 && inQ === 0 && outQ === 0) return;
    const rate = n(prod?.purchase_price);
    rows.push({
      id,
      itemName: prod?.name || 'Unknown item',
      category: prod?.category || 'Uncategorized',
      damagedNow,
      purchaseRate: r2(rate),
      value: r2(Math.max(0, damagedNow) * rate),
      cameIn: inQ,
      wentOut: outQ,
      lastIn: lastIn.get(id) || ''
    });
  });
  return rows.sort((a, b) => b.value - a.value || b.damagedNow - a.damagedNow || a.itemName.localeCompare(b.itemName));
}
