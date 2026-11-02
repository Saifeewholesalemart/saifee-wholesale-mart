'use client';

/**
 * Biller screen (simple flow).
 * Packed orders are grouped by shop: all packed orders of one retailer (any channel)
 * become ONE invoice. Walk-in / counter orders are billed one at a time.
 * Quantities come from the packer; the biller can adjust rates, pick the payment mode
 * and generate the invoice with one button.
 */

import React, { useMemo, useState } from 'react';
import { useDb } from '@/context/DbContext';
import type { Invoice, DeliveryChallan, Order } from '@/lib/db';
import {
  computeFreeStockByProduct, flowOrderStage, flowRemainingQty, flowItemRate, flowBillLineAmounts,
  flowShopKey, flowChannelLabel, isIntraStateSupply, isWalkInRetailerId
} from '@/lib/db';
import { productLabel, customerName, formatINR, formatWhen, purchaseRateOf, marginPercent, sortByOrderSort, OrderSort } from './flowUi';
import RateHistoryPanel from './RateHistoryPanel';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import { CheckCircle2, Receipt, History } from 'lucide-react';

type Mode = 'Cash' | 'UPI' | 'Credit';

export default function BillerPanel({ filter, sort = 'oldest' }: { filter?: (o: Order) => boolean; sort?: OrderSort }) {
  const { orders, products, batches, retailers, invoices, activeCompany, flowBillShop } = useDb();
  const [selKey, setSelKey] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>('Credit');
  const [challan, setChallan] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ invoice: Invoice; challan?: DeliveryChallan; shortfall: string; retailerId: string; mode: Mode } | null>(null);
  const [preview, setPreview] = useState(false);
  const [rateLine, setRateLine] = useState<string | null>(null);

  const freeAll = useMemo(() => computeFreeStockByProduct(batches, orders), [batches, orders]);
  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders
      .filter(o => flowOrderStage(o, freeAll) === 'ready_to_bill')
      .filter(o => (filter ? filter(o) : true))
      .sort((a, b) => new Date(a.packed_at || 0).getTime() - new Date(b.packed_at || 0).getTime())
      .forEach(o => {
        const k = flowShopKey(o);
        map.set(k, [...(map.get(k) || []), o]);
      });
    const list = Array.from(map.entries()).map(([key, list]) => ({ key, orders: list }));
    return sortByOrderSort(list, sort, {
      time: g => new Date(g.orders[0].packed_at || 0).getTime(),
      lines: g => g.orders.reduce((s, o) => s + (o.items || []).filter(it => (Number(it.flow_packed_qty) || 0) > 0).length, 0),
      amount: g => g.orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
    });
  }, [orders, freeAll, filter, sort]);

  const current = (selKey && groups.find(g => g.key === selKey)) || (!done ? groups[0] : null) || null;
  const first = current?.orders[0];
  const retailer = first ? retailers.find(r => r.id === first.retailer_id) || null : null;
  const intra = isIntraStateSupply(retailer?.state_code);

  const lines = useMemo(() => {
    if (!current) return [];
    return current.orders.flatMap(o => (o.items || [])
      .filter(it => (Number(it.flow_packed_qty) || 0) > 0)
      .map(it => {
        const product = products.find(p => p.id === it.product_id);
        const baseRate = flowItemRate(it, product);
        const raw = rates[it.id];
        const rate = raw === undefined || raw === '' || isNaN(Number(raw)) || Number(raw) < 0 ? baseRate : Number(raw);
        const qty = Number(it.flow_packed_qty) || 0;
        const units = it.units_per_trading_unit || product?.units_per_box_carton || 1;
        const gst = (product?.gst_percent !== undefined && product?.gst_percent !== null) ? Number(product.gst_percent) : (Number(it.gst_percent) || 0);
        const amt = flowBillLineAmounts(qty, units, rate, gst, intra);
        const purchase = purchaseRateOf(product, batches);
        return { id: it.id, productId: it.product_id, order: o, name: productLabel(product), qty, baseRate, rate, raw, amt, purchase, margin: marginPercent(rate, purchase) };
      }));
  }, [current, products, batches, rates, intra]);

  const shortLines = useMemo(() => {
    if (!current) return [];
    return current.orders.flatMap(o => (o.items || [])
      .map(it => ({ it, short: flowRemainingQty(it) - (Number(it.flow_packed_qty) || 0) }))
      .filter(x => x.short > 0)
      .map(x => `${productLabel(products.find(p => p.id === x.it.product_id))} – ${x.short} pcs`));
  }, [current, products]);

  const totals = lines.reduce(
    (t, l) => ({ taxable: t.taxable + l.amt.taxable, cgst: t.cgst + l.amt.cgst, sgst: t.sgst + l.amt.sgst, igst: t.igst + l.amt.igst }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
  );
  const grand = Math.round(totals.taxable + totals.cgst + totals.sgst + totals.igst);
  const badRate = lines.some(l => l.raw !== undefined && l.raw !== '' && (isNaN(Number(l.raw)) || Number(l.raw) < 0));

  const pick = (key: string) => {
    setSelKey(key);
    setRates({});
    setError('');
    setDone(null);
  };

  const generate = () => {
    if (!current || badRate) return;
    const changed: Record<string, number> = {};
    lines.forEach(l => { if (Math.abs(l.rate - l.baseRate) > 0.001) changed[l.id] = l.rate; });
    try {
      const res = flowBillShop(current.orders.map(o => o.id), { rates: changed, paymentMode: mode, generateChallan: challan });
      setDone({ ...res, retailerId: current.orders[0].retailer_id, mode });
      setError('');
      setRates({});
      setSelKey(null);
    } catch (e: any) {
      setError(e?.message || 'Invoice could not be generated.');
    }
  };

  const doneInvoice = done ? invoices.find(i => i.id === done.invoice.id) || done.invoice : null;
  const doneRetailer = done ? retailers.find(r => r.id === done.retailerId) || null : null;

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <aside className="flex-[1_1_260px] max-w-sm flex flex-col gap-2.5">
        <p className="text-sm text-slate-600">Packed — one bill per shop ({groups.length})</p>
        {groups.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-600 text-sm">Nothing waiting for billing.</div>
        )}
        {groups.map(g => {
          const packedItems = g.orders.reduce((s, o) => s + (o.items || []).filter(it => (Number(it.flow_packed_qty) || 0) > 0).length, 0);
          const short = g.orders.some(o => (o.items || []).some(it => flowRemainingQty(it) - (Number(it.flow_packed_qty) || 0) > 0));
          const active = current?.key === g.key && !done;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => pick(g.key)}
              className={`text-left rounded-xl p-3.5 flex flex-col gap-1 ${active ? 'border-2 border-indigo-700 bg-indigo-50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <span className="flex justify-between gap-2">
                <strong className="text-[15px] text-slate-900">{customerName(g.orders[0], retailers)}</strong>
                <span className="text-xs text-slate-700 font-semibold whitespace-nowrap">
                  {g.orders.length > 1 ? `${g.orders.length} orders` : g.orders[0].order_number}
                </span>
              </span>
              <span className="text-sm text-slate-600">
                {packedItems} item{packedItems === 1 ? '' : 's'} packed{short ? ' · some on backorder' : ''} · {formatWhen(g.orders[g.orders.length - 1].packed_at)}
              </span>
            </button>
          );
        })}
      </aside>

      <section className="flex-[999_1_560px] min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden">
        {done && doneInvoice ? (
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-700" aria-hidden="true" />
            <strong className="text-xl text-slate-900">Invoice {doneInvoice.invoice_number} created</strong>
            <span className="text-sm text-slate-600">
              {doneRetailer?.shop_name || 'Customer'} · {formatINR(doneInvoice.grand_total)} · {done.mode}
              {(doneInvoice.source_order_ids?.length || 0) > 1 ? ` · ${doneInvoice.source_order_ids!.length} orders in one bill` : ''}
              {done.challan ? ' · Delivery challan created' : ''}
            </span>
            {done.shortfall && <span className="text-sm text-amber-800 max-w-xl">{done.shortfall}</span>}
            <div className="flex flex-wrap gap-2.5 justify-center mt-1">
              <button type="button" onClick={() => setPreview(true)} className="min-h-12 px-6 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4" aria-hidden="true" /> View / Print Invoice
              </button>
              <button type="button" onClick={() => setDone(null)} className="min-h-12 px-6 rounded-lg border border-slate-300 bg-white font-bold text-slate-800">
                Next shop
              </button>
            </div>
          </div>
        ) : !current || !first ? (
          <div className="p-10 text-center text-slate-600">Select a packed shop to bill.</div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap justify-between gap-2">
              <div>
                <strong className="text-[17px] text-slate-900 block">{customerName(first, retailers)}</strong>
                <span className="text-sm text-slate-600">
                  {current.orders.map(o => `${o.order_number} (${flowChannelLabel(o)})`).join(' + ')}
                  {retailer?.city ? ` · ${retailer.city}` : ''}
                </span>
              </div>
              <span className="text-sm text-slate-600 self-center">
                {current.orders.length > 1 ? 'All these orders go into ONE invoice. ' : ''}Quantities come from the packer.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="px-5 py-2.5 font-semibold">Product</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Packed</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Rate (₹)</th>
                    <th className="px-3 py-2.5 font-semibold text-right">GST</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{l.name}</div>
                        {current.orders.length > 1 && (
                          <div className="text-xs text-slate-600">{l.order.order_number} · {flowChannelLabel(l.order)}</div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="text-slate-700">
                            Purchase: <strong className="text-slate-900">{l.purchase > 0 ? formatINR(l.purchase) : 'Not known'}</strong>
                            {l.margin !== null && (
                              <span className={`ml-1.5 font-semibold ${l.margin < 0 ? 'text-red-700' : 'text-green-800'}`}>
                                {l.margin < 0 ? 'Loss ' : 'Margin '}{Math.abs(l.margin).toFixed(1)}%
                              </span>
                            )}
                          </span>
                          <button type="button" onClick={() => setRateLine(l.id)}
                            className="min-h-8 px-2.5 rounded-md border border-slate-300 bg-white font-bold text-indigo-800 hover:bg-indigo-50 inline-flex items-center gap-1">
                            <History className="w-3.5 h-3.5" aria-hidden="true" /> Last rates
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold">{l.qty}</td>
                      <td className="px-3 py-3 text-right">
                        <label htmlFor={`rate-${l.id}`} className="sr-only">Rate for {l.name}</label>
                        <input
                          id={`rate-${l.id}`}
                          type="number"
                          step="0.01"
                          min={0}
                          value={l.raw ?? l.baseRate.toFixed(2)}
                          onChange={e => setRates(prev => ({ ...prev, [l.id]: e.target.value }))}
                          className="w-24 min-h-10 text-right border border-slate-300 rounded-lg px-2 focus:border-indigo-600 outline-none"
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">{l.amt.gstPercent}%</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatINR(l.amt.taxable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {shortLines.length > 0 && (
              <div className="mx-5 mt-1 px-3.5 py-2.5 rounded-lg bg-amber-50 text-amber-900 text-sm">
                Not billed (backorder): {shortLines.join('; ')}. These stay on the order until stock arrives.
              </div>
            )}

            <div className="px-5 py-4 flex flex-wrap gap-6 justify-between items-start">
              <div className="flex flex-col gap-3.5">
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-semibold text-slate-600 mb-2">Payment mode</legend>
                  <div className="flex gap-2 flex-wrap">
                    {(['Cash', 'UPI', 'Credit'] as Mode[]).map(m => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={mode === m}
                        onClick={() => setMode(m)}
                        className={`min-h-11 min-w-20 px-4 rounded-lg font-bold text-sm ${mode === m ? 'bg-indigo-700 text-white border-2 border-indigo-700' : 'bg-white text-slate-900 border border-slate-300'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={challan} onChange={() => setChallan(c => !c)} className="w-5 h-5" />
                  Also create delivery challan
                </label>
              </div>

              <div className="min-w-64 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Taxable value</span><span>{formatINR(totals.taxable)}</span></div>
                {intra ? (
                  <>
                    <div className="flex justify-between"><span className="text-slate-600">CGST</span><span>{formatINR(totals.cgst)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">SGST</span><span>{formatINR(totals.sgst)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-slate-600">IGST</span><span>{formatINR(totals.igst)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 mt-1 text-lg font-extrabold"><span>Total</span><span>{formatINR(grand)}</span></div>
                {error && <div role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">{error}</div>}
                {badRate && <span className="text-xs text-red-700">Enter a valid rate.</span>}
                <button
                  type="button"
                  onClick={generate}
                  disabled={badRate || lines.length === 0}
                  className="mt-2.5 min-h-12 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-400 text-white font-bold text-base"
                >
                  {current.orders.length > 1 ? `Generate 1 Invoice (${current.orders.length} orders)` : 'Generate Invoice'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {rateLine && (() => {
        const l = lines.find(x => x.id === rateLine);
        if (!l || !first) return null;
        return (
          <RateHistoryPanel
            productId={l.productId}
            retailerId={isWalkInRetailerId(first.retailer_id) ? null : first.retailer_id}
            purchaseRate={l.purchase}
            currentRate={l.rate}
            onUseRate={r => { setRates(prev => ({ ...prev, [l.id]: String(r) })); setRateLine(null); }}
            onClose={() => setRateLine(null)}
          />
        );
      })()}

      {preview && doneInvoice && (
        <InvoicePreviewModal
          isOpen={preview}
          onClose={() => setPreview(false)}
          invoice={doneInvoice}
          challan={done?.challan || null}
          retailer={doneRetailer}
          company={activeCompany}
        />
      )}
    </div>
  );
}
