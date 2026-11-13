/**
 * A shop's balance is always worked out from its documents:
 *   opening balance (entered for the shop, default 0)
 *   + bills  - payments  - credit notes (sales returns)
 * The stored "outstanding" number on the shop record is not trusted, because
 * different devices and the cloud can overwrite it with an old value.
 */
import type { Invoice, Payment, Product, Retailer, SalesReturn } from './db';

const isCancelled = (s: unknown) => /cancel|void|reject/i.test(String(s || ''));

export function invoiceCounts(inv: Invoice): boolean {
  return !isCancelled((inv as any).status) && !isCancelled((inv as any).invoice_status);
}

export function paymentCounts(p: Payment): boolean {
  return !isCancelled((p as any).status);
}

export function returnCounts(sr: SalesReturn): boolean {
  return !isCancelled((sr as any).status);
}

/** Opening balance entered for the shop (Dr positive). New shops start at 0. */
export function retailerOpeningBalance(r?: Partial<Retailer> | null): number {
  return Number((r as any)?.opening_balance) || 0;
}

/** Credit note value of a sales return (same maths as the ledger). */
export function salesReturnAmount(sr: SalesReturn, productById?: Map<string, Product>): number {
  if (sr.total_amount !== undefined && sr.total_amount !== null) return Math.round(Number(sr.total_amount) || 0);
  const total = (sr.items || []).reduce((sum, item: any) => {
    const prod = productById?.get(item.product_id);
    const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
    const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
    const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
    const cRate = Number(item.rate) || 0;
    const lRate = item.loose_rate ?? (cRate / unitsPerPack);
    const lineVal = (cQty * cRate) + (lQty * lRate);
    const gstPct = (item.gst_percent !== undefined && item.gst_percent !== null)
      ? Number(item.gst_percent)
      : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0);
    return sum + lineVal + lineVal * (gstPct / 100);
  }, 0);
  return Math.round(total);
}

/** Balance of every shop, keyed by retailer id. */
export function computeRetailerBalances(
  retailers: Retailer[],
  invoices: Invoice[],
  payments: Payment[],
  salesReturns: SalesReturn[],
  products?: Product[]
): Map<string, number> {
  const bal = new Map<string, number>();
  retailers.forEach(r => bal.set(r.id, retailerOpeningBalance(r)));
  const add = (id: string | undefined, amt: number) => {
    if (!id || !bal.has(id)) return;
    bal.set(id, (bal.get(id) || 0) + amt);
  };
  const invById = new Map(invoices.map(i => [i.id, i]));
  invoices.forEach(inv => { if (invoiceCounts(inv)) add(inv.retailer_id, Number(inv.grand_total) || 0); });
  payments.forEach(p => { if (paymentCounts(p)) add(p.retailer_id, -(Number(p.amount) || 0)); });
  const productById = products ? new Map(products.map(p => [p.id, p])) : undefined;
  salesReturns.forEach(sr => {
    if (!returnCounts(sr)) return;
    const rid = sr.retailer_id || (sr.invoice_id ? invById.get(sr.invoice_id)?.retailer_id : undefined);
    add(rid, -salesReturnAmount(sr, productById));
  });
  bal.forEach((v, k) => bal.set(k, Math.round(v * 100) / 100));
  return bal;
}
