/**
 * Billing terminal: one bill line and its maths (pure, no React).
 * Quantity is in pieces (base units) and the rate is per piece, without tax.
 */

export type DiscMode = 'pct' | 'amt';

export interface TerminalLine {
  key: string;
  productId: string;
  name: string;
  mrp: number;
  unit: string;
  unitsPerPack: number;
  qty: string;
  rate: string;
  discPct: string;
  discAmt: string;
  discMode: DiscMode;
  gst: string;
  purchaseRate: number;
  /** order line this bill line comes from (bill made from packed orders) */
  orderItemId?: string;
  /** existing invoice line id (saved bill) */
  lineId?: string;
  batchId?: string;
  batchNumber?: string;
  hsn?: string;
  packing?: string;
}

export const num = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return isFinite(n) ? n : 0;
};
export const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineGross(l: TerminalLine): number {
  return r2(num(l.qty) * num(l.rate));
}

/** Discount in rupees for the whole line, from whichever field was typed last. */
export function lineDiscount(l: TerminalLine): number {
  const gross = lineGross(l);
  const d = l.discMode === 'pct' ? gross * num(l.discPct) / 100 : num(l.discAmt);
  return r2(Math.min(gross, Math.max(0, d)));
}

export function lineTaxable(l: TerminalLine): number {
  return r2(Math.max(0, lineGross(l) - lineDiscount(l)));
}

export function lineGst(l: TerminalLine): number {
  return r2(lineTaxable(l) * Math.max(0, num(l.gst)) / 100);
}

export function lineAmount(l: TerminalLine): number {
  return r2(lineTaxable(l) + lineGst(l));
}

/** Keep the other discount field in step with the one that was typed. */
export function syncDiscount(l: TerminalLine): TerminalLine {
  const gross = lineGross(l);
  if (l.discMode === 'pct') {
    return { ...l, discAmt: lineDiscount(l).toFixed(2) };
  }
  const amt = lineDiscount(l);
  return { ...l, discPct: gross > 0 && amt > 0 ? String(r2(amt / gross * 100)) : '0' };
}

export interface BillTotals {
  items: number;
  qty: number;
  gross: number;
  itemDiscount: number;
  billDiscount: number;
  taxable: number;
  gst: number;
  exact: number;
  roundOff: number;
  total: number;
}

export function billTotals(lines: TerminalLine[], billDiscount: number): BillTotals {
  const used = lines.filter(l => l.productId && num(l.qty) > 0);
  const gross = r2(used.reduce((s, l) => s + lineGross(l), 0));
  const itemDiscount = r2(used.reduce((s, l) => s + lineDiscount(l), 0));
  const taxableBefore = r2(used.reduce((s, l) => s + lineTaxable(l), 0));
  const billDisc = r2(Math.min(taxableBefore, Math.max(0, billDiscount)));
  // Bill discount is shared across lines by value, so GST is worked on the discounted value
  const shares = splitBillDiscount(used, billDisc);
  let taxable = 0;
  let gst = 0;
  used.forEach(l => {
    const t = Math.max(0, lineTaxable(l) - (shares.get(l.key) || 0));
    taxable += t;
    gst += t * Math.max(0, num(l.gst)) / 100;
  });
  taxable = r2(taxable);
  gst = r2(gst);
  const exact = r2(taxable + gst);
  const total = Math.round(exact);
  return {
    items: used.length,
    qty: used.reduce((s, l) => s + num(l.qty), 0),
    gross, itemDiscount, billDiscount: billDisc, taxable, gst, exact,
    roundOff: r2(total - exact),
    total
  };
}

/** Bill discount in rupees shared over the lines in proportion to their value. */
export function splitBillDiscount(lines: TerminalLine[], billDiscount: number): Map<string, number> {
  const out = new Map<string, number>();
  const base = lines.reduce((s, l) => s + lineTaxable(l), 0);
  if (billDiscount <= 0 || base <= 0) return out;
  let given = 0;
  lines.forEach((l, i) => {
    const share = i === lines.length - 1 ? r2(billDiscount - given) : r2(billDiscount * lineTaxable(l) / base);
    given = r2(given + share);
    out.set(l.key, share);
  });
  return out;
}

/** Discount per piece (what the bill stores), including this line's share of the bill discount. */
export function discountPerPiece(l: TerminalLine, billShare: number): number {
  const q = num(l.qty);
  if (q <= 0) return 0;
  return (lineDiscount(l) + billShare) / q;
}

export function newLineKey(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
