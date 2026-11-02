'use client';

/**
 * Biller screen (simple flow).
 * Shows only orders the packer has packed ("Ready to Bill"). Quantities come from the
 * packer and cannot be changed here. The biller can adjust rates, choose the payment
 * mode and generate the invoice with one button.
 */

import React, { useMemo, useState } from 'react';
import { useDb } from '@/context/DbContext';
import type { Invoice, DeliveryChallan } from '@/lib/db';
import {
  computeFreeStockByProduct, flowOrderStage, flowRemainingQty, flowItemRate, flowLineAmounts, isIntraStateSupply
} from '@/lib/db';
import { productLabel, customerName, formatINR, formatWhen } from './flowUi';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import { CheckCircle2, Receipt } from 'lucide-react';

type Mode = 'Cash' | 'UPI' | 'Credit';

export default function BillerPanel() {
  const { orders, products, batches, retailers, activeCompany, flowBillOrder } = useDb();
  const [selId, setSelId] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>('Credit');
  const [challan, setChallan] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ invoice: Invoice; challan?: DeliveryChallan; shortfall: string; orderId: string } | null>(null);
  const [preview, setPreview] = useState(false);

  const freeAll = useMemo(() => computeFreeStockByProduct(batches, orders), [batches, orders]);
  const ready = useMemo(
    () => orders
      .filter(o => flowOrderStage(o, freeAll) === 'ready_to_bill')
      .sort((a, b) => new Date(a.packed_at || 0).getTime() - new Date(b.packed_at || 0).getTime()),
    [orders, freeAll]
  );

  const current = (selId && ready.find(o => o.id === selId)) || (!done ? ready[0] : null) || null;
  const retailer = current ? retailers.find(r => r.id === current.retailer_id) || null : null;
  const intra = isIntraStateSupply(retailer?.state_code);

  const lines = useMemo(() => {
    if (!current) return [];
    return (current.items || [])
      .filter(it => (Number(it.flow_packed_qty) || 0) > 0)
      .map(it => {
        const product = products.find(p => p.id === it.product_id);
        const baseRate = flowItemRate(it, product);
        const raw = rates[it.id];
        const rate = raw === undefined || raw === '' || isNaN(Number(raw)) || Number(raw) < 0 ? baseRate : Number(raw);
        const qty = Number(it.flow_packed_qty) || 0;
        const amt = flowLineAmounts(it, product, qty, rate, intra);
        return { id: it.id, name: productLabel(product), qty, baseRate, rate, raw, amt };
      });
  }, [current, products, rates, intra]);

  const shortLines = useMemo(() => {
    if (!current) return [];
    return (current.items || [])
      .map(it => ({ it, short: flowRemainingQty(it) - (Number(it.flow_packed_qty) || 0) }))
      .filter(x => x.short > 0)
      .map(x => `${productLabel(products.find(p => p.id === x.it.product_id))} – ${x.short} pcs`);
  }, [current, products]);

  const totals = lines.reduce(
    (t, l) => ({
      taxable: t.taxable + l.amt.taxable,
      cgst: t.cgst + l.amt.cgst,
      sgst: t.sgst + l.amt.sgst,
      igst: t.igst + l.amt.igst
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
  );
  const grand = Math.round(totals.taxable + totals.cgst + totals.sgst + totals.igst);
  const badRate = lines.some(l => l.raw !== undefined && l.raw !== '' && (isNaN(Number(l.raw)) || Number(l.raw) < 0));

  const pick = (id: string) => {
    setSelId(id);
    setRates({});
    setError('');
    setDone(null);
  };

  const generate = () => {
    if (!current || badRate) return;
    const changed: Record<string, number> = {};
    lines.forEach(l => { if (Math.abs(l.rate - l.baseRate) > 0.001) changed[l.id] = l.rate; });
    try {
      const res = flowBillOrder(current.id, { rates: changed, paymentMode: mode, generateChallan: challan });
      setDone({ ...res, orderId: current.id });
      setError('');
      setRates({});
      setSelId(null);
    } catch (e: any) {
      setError(e?.message || 'Invoice could not be generated.');
    }
  };

  const doneOrder = done ? orders.find(o => o.id === done.orderId) : null;
  const doneRetailer = doneOrder ? retailers.find(r => r.id === doneOrder.retailer_id) || null : null;

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <aside className="flex-[1_1_260px] max-w-sm flex flex-col gap-2.5">
        <p className="text-sm text-slate-600">Packed orders ({ready.length})</p>
        {ready.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-600 text-sm">Nothing waiting for billing.</div>
        )}
        {ready.map(o => {
          const packedItems = (o.items || []).filter(it => (Number(it.flow_packed_qty) || 0) > 0).length;
          const short = (o.items || []).some(it => flowRemainingQty(it) - (Number(it.flow_packed_qty) || 0) > 0);
          const active = current?.id === o.id && !done;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              className={`text-left rounded-xl p-3.5 flex flex-col gap-1 ${active ? 'border-2 border-indigo-700 bg-indigo-50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <span className="flex justify-between gap-2">
                <strong className="text-[15px] text-slate-900">{customerName(o, retailers)}</strong>
                <span className="text-xs text-slate-600 font-mono">{o.order_number}</span>
              </span>
              <span className="text-sm text-slate-600">
                {packedItems} item{packedItems === 1 ? '' : 's'} packed{short ? ' · some on backorder' : ''} · {formatWhen(o.packed_at)}
              </span>
            </button>
          );
        })}
      </aside>

      <section className="flex-[999_1_560px] min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden">
        {done ? (
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-700" aria-hidden="true" />
            <strong className="text-xl text-slate-900">Invoice {done.invoice.invoice_number} created</strong>
            <span className="text-sm text-slate-600">
              {doneOrder ? customerName(doneOrder, retailers) : ''} · {formatINR(done.invoice.grand_total)} · {mode}
              {done.challan ? ' · Delivery challan created' : ''}
            </span>
            {done.shortfall && <span className="text-sm text-amber-800 max-w-xl">{done.shortfall}</span>}
            <div className="flex flex-wrap gap-2.5 justify-center mt-1">
              <button type="button" onClick={() => setPreview(true)} className="min-h-12 px-6 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4" aria-hidden="true" /> View / Print Invoice
              </button>
              <button type="button" onClick={() => setDone(null)} className="min-h-12 px-6 rounded-lg border border-slate-300 bg-white font-bold text-slate-800">
                Next order
              </button>
            </div>
          </div>
        ) : !current ? (
          <div className="p-10 text-center text-slate-600">Select a packed order to bill.</div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap justify-between gap-2">
              <div>
                <strong className="text-[17px] text-slate-900 block">{customerName(current, retailers)}</strong>
                <span className="text-sm text-slate-600">
                  {current.order_number}{retailer?.city ? ` · ${retailer.city}` : ''}{current.flow_packed_by ? ` · Packed by ${current.flow_packed_by}` : ''}
                </span>
              </div>
              <span className="text-sm text-slate-600 self-center">Quantities come from the packer and cannot be changed here.</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm border-collapse">
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
                      <td className="px-5 py-3 font-semibold text-slate-900">{l.name}</td>
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
                  Generate Invoice
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {preview && done && (
        <InvoicePreviewModal
          isOpen={preview}
          onClose={() => setPreview(false)}
          invoice={done.invoice}
          challan={done.challan || null}
          retailer={doneRetailer}
          company={activeCompany}
        />
      )}
    </div>
  );
}
