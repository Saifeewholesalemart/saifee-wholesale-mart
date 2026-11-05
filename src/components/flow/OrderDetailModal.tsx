'use client';

/**
 * Order detail for admin: items (ordered / billed / pending), its bills, history.
 * Admin can edit the unbilled part of the order, revise a bill that is already made,
 * cancel the order or close a backorder short.
 */

import React, { useMemo, useState } from 'react';
import { useDb } from '@/context/DbContext';
import type { Invoice, Product } from '@/lib/db';
import {
  computeFreeStockByProduct, flowOrderStage, flowRemainingQty, flowOrderedQty, flowItemRate, flowChannelLabel, FlowStage, isWalkInRetailerId
} from '@/lib/db';
import { productLabel, customerName, formatINR, formatWhen, purchaseRateOf, marginPercent } from './flowUi';
import RateHistoryPanel from './RateHistoryPanel';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import { X } from 'lucide-react';

const STAGE_LABEL: Record<FlowStage, string> = {
  to_pack: 'To Pack', ready_to_bill: 'Ready to Bill', billed: 'Billed', backorder: 'Backorder', cancelled: 'Cancelled'
};
const STAGE_STYLE: Record<FlowStage, string> = {
  to_pack: 'bg-indigo-100 text-indigo-900',
  ready_to_bill: 'bg-sky-100 text-sky-900',
  billed: 'bg-green-100 text-green-900',
  backorder: 'bg-amber-100 text-amber-900',
  cancelled: 'bg-slate-200 text-slate-800'
};

export function StageBadge({ stage }: { stage: FlowStage }) {
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${STAGE_STYLE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

type EditLine = { key: string; refId?: string; productId: string; name: string; qty: string; rate: string; note?: string };

/** Qty + rate table with remove and "add item" search. Used for order edit and bill edit. */
function LineEditor({
  lines, setLines, products, qtyLabel, batches, retailerId
}: {
  lines: EditLine[];
  setLines: (fn: (prev: EditLine[]) => EditLine[]) => void;
  products: Product[];
  qtyLabel: string;
  batches: { product_id: string; quantity: number; expiry_date?: string; purchase_rate?: number }[];
  retailerId: string | null;
}) {
  const [search, setSearch] = useState('');
  const [rateKey, setRateKey] = useState<string | null>(null);
  const purchaseOf = (productId: string) => purchaseRateOf(products.find(p => p.id === productId), batches);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(p => p.active !== false && `${p.name} ${p.mrp ?? ''} ${p.sku ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products]);

  const update = (key: string, field: 'qty' | 'rate', value: string) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, [field]: value } : l)));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full min-w-[560px] text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">Product</th>
              <th className="px-3 py-2 font-semibold text-right">{qtyLabel}</th>
              <th className="px-3 py-2 font-semibold text-right">Rate (₹)</th>
              <th className="px-3 py-2 font-semibold text-right"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-600">No items. Add one below.</td></tr>
            )}
            {lines.map(l => (
              <tr key={l.key} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{l.name}</div>
                  {l.note && <div className="text-xs text-slate-600">{l.note}</div>}
                  {(() => {
                    const pr = purchaseOf(l.productId);
                    const m = marginPercent(Number(l.rate) || 0, pr);
                    return (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-slate-700">
                          Purchase: <strong className="text-slate-900">{pr > 0 ? formatINR(pr) : 'Not known'}</strong>
                          {m !== null && <span className={`ml-1.5 font-semibold ${m < 0 ? 'text-red-700' : 'text-green-800'}`}>{m < 0 ? 'Loss ' : 'Margin '}{Math.abs(m).toFixed(1)}%</span>}
                        </span>
                        <button type="button" onClick={() => setRateKey(l.key)}
                          className="min-h-8 px-2.5 rounded-md border border-slate-300 bg-white font-bold text-indigo-800 hover:bg-indigo-50">
                          Last rates
                        </button>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-right">
                  <label className="sr-only" htmlFor={`q-${l.key}`}>Quantity for {l.name}</label>
                  <input id={`q-${l.key}`} type="number" min={0} inputMode="numeric" value={l.qty}
                    onChange={e => update(l.key, 'qty', e.target.value)}
                    className="w-20 min-h-10 text-right border border-slate-300 rounded-lg px-2 focus:border-indigo-600 outline-none" />
                </td>
                <td className="px-3 py-2 text-right">
                  <label className="sr-only" htmlFor={`r-${l.key}`}>Rate for {l.name}</label>
                  <input id={`r-${l.key}`} type="number" min={0} step="0.01" value={l.rate}
                    onChange={e => update(l.key, 'rate', e.target.value)}
                    className="w-24 min-h-10 text-right border border-slate-300 rounded-lg px-2 focus:border-indigo-600 outline-none" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setLines(prev => prev.filter(x => x.key !== l.key))}
                    className="min-h-10 px-3 rounded-lg border border-red-200 text-red-800 text-sm font-semibold hover:bg-red-50">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rateKey && (() => {
        const l = lines.find(x => x.key === rateKey);
        if (!l) return null;
        return (
          <RateHistoryPanel
            productId={l.productId}
            retailerId={retailerId}
            purchaseRate={purchaseOf(l.productId)}
            currentRate={Number(l.rate) || 0}
            onUseRate={r => { setLines(prev => prev.map(x => (x.key === l.key ? { ...x, rate: String(r) } : x))); setRateKey(null); }}
            onClose={() => setRateKey(null)}
          />
        );
      })()}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="add-item-search" className="text-xs font-semibold text-slate-600">Add item</label>
        <input id="add-item-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Type product name or MRP"
          className="min-h-11 border border-slate-300 rounded-lg px-3 text-sm focus:border-indigo-600 outline-none" />
        {matches.length > 0 && (
          <div className="flex flex-col border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
            {matches.map(p => (
              <button key={p.id} type="button"
                onClick={() => {
                  setLines(prev => [...prev, {
                    key: `new-${p.id}-${Date.now()}`, productId: p.id, name: productLabel(p), qty: '1',
                    rate: String(Number(p.selling_price) || 0), note: 'New item'
                  }]);
                  setSearch('');
                }}
                className="text-left px-3 min-h-11 text-sm hover:bg-slate-50 flex justify-between gap-2 items-center">
                <span className="text-slate-900">{productLabel(p)}</span>
                <span className="text-slate-600 whitespace-nowrap">{formatINR(Number(p.selling_price) || 0)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const {
    orders, products, batches, retailers, invoices, itemActivityLogs, activeCompany,
    flowEditOrder, flowReviseInvoice, flowCancelRemaining
  } = useDb();
  const order = orders.find(o => o.id === orderId) || null;
  const [mode, setMode] = useState<'view' | 'edit-order' | 'edit-bill' | 'confirm-cancel'>('view');
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [lines, setLinesState] = useState<EditLine[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Invoice | null>(null);
  const setLines = (fn: (prev: EditLine[]) => EditLine[]) => setLinesState(prev => fn(prev));

  const free = useMemo(() => computeFreeStockByProduct(batches, orders), [batches, orders]);
  const bills = useMemo(() => order
    ? invoices.filter(i => i.source_order_ids?.includes(order.id) || i.order_ref_id === order.id || order.invoice_id === i.id)
    : [], [invoices, order]);
  const history = useMemo(() => {
    if (!order) return [];
    const refs = new Set([order.id, ...bills.map(b => b.id)]);
    return itemActivityLogs
      .filter(l => l.reference_id && refs.has(l.reference_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);
  }, [itemActivityLogs, order, bills]);

  if (!order) return null;
  const stage = flowOrderStage(order, free);
  const pendingTotal = (order.items || []).reduce((s, it) => s + flowRemainingQty(it), 0);
  const billedAny = (order.items || []).some(it => (Number(it.fulfilled_qty ?? it.dispatched_qty ?? 0) || 0) > 0);
  const retailer = retailers.find(r => r.id === order.retailer_id) || null;

  const startEditOrder = () => {
    setLinesState((order.items || []).filter(it => flowRemainingQty(it) > 0).map(it => {
      const p = products.find(x => x.id === it.product_id);
      return { key: it.id, refId: it.id, productId: it.product_id, name: productLabel(p, it.product_name || 'Item'), qty: String(flowRemainingQty(it)), rate: String(flowItemRate(it, p)) };
    }));
    setError(''); setNotice(''); setMode('edit-order');
  };
  const startEditBill = (inv: Invoice) => {
    setEditInvoiceId(inv.id);
    setLinesState((inv.items || []).map(it => {
      const p = products.find(x => x.id === it.product_id);
      return { key: it.id, refId: it.id, productId: it.product_id, name: productLabel(p, it.product_name || 'Item'), qty: String(it.base_qty ?? it.quantity), rate: String(it.carton_rate ?? it.rate) };
    }));
    setReason(''); setError(''); setNotice(''); setMode('edit-bill');
  };
  const parsed = () => lines.map(l => ({ id: l.refId, productId: l.productId, qty: Number(l.qty), rate: Number(l.rate), name: l.name }));
  const invalid = lines.some(l => l.qty === '' || l.rate === '' || isNaN(Number(l.qty)) || isNaN(Number(l.rate)) || Number(l.qty) < 0 || Number(l.rate) < 0 || !Number.isInteger(Number(l.qty)));

  const saveOrder = () => {
    try {
      const res = flowEditOrder(order.id, parsed().map(l => ({ itemId: l.id, productId: l.productId, qty: l.qty, rate: l.rate })));
      setNotice(res.changes.length ? `Saved: ${res.changes.join('; ')}` : 'Nothing changed.');
      setMode('view');
    } catch (e: any) { setError(e?.message || 'Could not save.'); }
  };
  const saveBill = () => {
    if (!editInvoiceId) return;
    try {
      const res = flowReviseInvoice(editInvoiceId, parsed().map(l => ({ lineId: l.id, productId: l.productId, qty: l.qty, rate: l.rate })), reason.trim());
      setNotice(res.changes.length ? `Bill revised: ${res.changes.join('; ')}` : 'Nothing changed.');
      setMode('view');
    } catch (e: any) { setError(e?.message || 'Could not save.'); }
  };
  const doCancel = () => {
    try {
      flowCancelRemaining(order.id, reason.trim() || (billedAny ? 'Backorder closed by admin' : 'Order cancelled by admin'));
      setNotice(billedAny ? 'Pending items closed.' : 'Order cancelled.');
      setMode('view');
    } catch (e: any) { setError(e?.message || 'Could not cancel.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl h-full bg-slate-50 overflow-y-auto shadow-2xl flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex justify-between gap-3 items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="order-detail-title" className="text-lg font-bold text-slate-900">{customerName(order, retailers)}</h2>
              <StageBadge stage={stage} />
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-mono font-semibold text-slate-800">{order.order_number}</span> · {flowChannelLabel(order)}
              {order.created_by ? ` · by ${order.created_by}` : ''} · {formatWhen(order.order_date || order.created_at)}
              {retailer?.city ? ` · ${retailer.city}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 rounded-lg border border-slate-300 bg-white flex items-center justify-center">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="p-5 flex flex-col gap-4">
          {notice && <div role="status" className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</div>}
          {error && <div role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {mode === 'edit-order' && (
            <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-bold text-slate-900">Edit order (items not billed yet)</h3>
              {order.flow_ready_to_bill && (
                <p className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2">This order is packed. Saving a change sends it back to To Pack.</p>
              )}
              <LineEditor lines={lines} setLines={setLines} products={products} qtyLabel="Qty to supply (pcs)" batches={batches} retailerId={isWalkInRetailerId(order.retailer_id) ? null : order.retailer_id} />
              <div className="flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => setMode('view')} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white font-semibold">Discard</button>
                <button type="button" disabled={invalid} onClick={saveOrder} className="min-h-11 px-5 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-400 text-white font-bold">Save order</button>
              </div>
              {invalid && <span className="text-xs text-red-700">Enter a whole number for qty and a valid rate on every line.</span>}
            </section>
          )}

          {mode === 'edit-bill' && (
            <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-bold text-slate-900">Edit bill {bills.find(b => b.id === editInvoiceId)?.invoice_number}</h3>
              <p className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
                The invoice keeps its number and is marked “Revised”. Stock and the customer’s balance change by the difference. The old version is kept in the history.
                If this bill is already in a filed GST return, check with your CA (a credit or debit note may be needed).
              </p>
              <LineEditor lines={lines} setLines={setLines} products={products} qtyLabel="Billed qty (pcs)" batches={batches} retailerId={isWalkInRetailerId(order.retailer_id) ? null : order.retailer_id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold text-slate-600">Reason (shown in history)</span>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. 2 pcs returned, rate corrected"
                  className="min-h-11 border border-slate-300 rounded-lg px-3 focus:border-indigo-600 outline-none" />
              </label>
              <div className="flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => setMode('view')} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white font-semibold">Discard</button>
                <button type="button" disabled={invalid || lines.length === 0} onClick={saveBill} className="min-h-11 px-5 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-400 text-white font-bold">Save revised bill</button>
              </div>
            </section>
          )}

          {mode === 'confirm-cancel' && (
            <section className="bg-white border border-red-200 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-bold text-red-900">{billedAny ? 'Close pending items?' : 'Cancel this order?'}</h3>
              <p className="text-sm text-slate-700">
                {billedAny
                  ? `${pendingTotal} pcs not billed yet will be cancelled. Bills already made stay as they are.`
                  : 'The whole order will be cancelled. Nothing has been billed on it.'}
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold text-slate-600">Reason</span>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer does not need it"
                  className="min-h-11 border border-slate-300 rounded-lg px-3 focus:border-indigo-600 outline-none" />
              </label>
              <div className="flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => setMode('view')} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white font-semibold">Keep order</button>
                <button type="button" onClick={doCancel} className="min-h-11 px-5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold">
                  {billedAny ? 'Close pending items' : 'Cancel order'}
                </button>
              </div>
            </section>
          )}

          {mode === 'view' && stage !== 'cancelled' && (
            <div className="flex flex-wrap gap-2">
              {pendingTotal > 0 && (
                <button type="button" onClick={startEditOrder} className="min-h-11 px-4 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm">Edit order</button>
              )}
              {pendingTotal > 0 && (
                <button type="button" onClick={() => { setReason(''); setError(''); setMode('confirm-cancel'); }}
                  className="min-h-11 px-4 rounded-lg border border-red-300 bg-white text-red-800 font-bold text-sm">
                  {billedAny ? 'Close short (cancel pending)' : 'Cancel order'}
                </button>
              )}
            </div>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <h3 className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="px-4 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold text-right">Ordered</th>
                    <th className="px-3 py-2 font-semibold text-right">Billed</th>
                    <th className="px-3 py-2 font-semibold text-right">Cancelled</th>
                    <th className="px-3 py-2 font-semibold text-right">Pending</th>
                    <th className="px-4 py-2 font-semibold text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map(it => {
                    const p = products.find(x => x.id === it.product_id);
                    const pending = flowRemainingQty(it);
                    return (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{productLabel(p, (it as any).product_name || 'Item')}</td>
                        <td className="px-3 py-2.5 text-right">{flowOrderedQty(it)}</td>
                        <td className="px-3 py-2.5 text-right">{Number(it.fulfilled_qty ?? it.dispatched_qty ?? 0) || 0}</td>
                        <td className="px-3 py-2.5 text-right">{Number(it.cancelled_qty) || 0}</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${pending > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{pending}</td>
                        <td className="px-4 py-2.5 text-right">{formatINR(flowItemRate(it, p))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <h3 className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">Bills</h3>
            {bills.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-600">No bill made yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bills.map(b => (
                  <li key={b.id} className="px-4 py-3 flex flex-wrap justify-between gap-3 items-center">
                    <div className="text-sm">
                      <div className="font-bold text-slate-900">
                        {b.invoice_number}
                        {b.revised && <span className="ml-2 text-xs font-bold text-amber-900 bg-amber-100 rounded px-1.5 py-0.5">Revised</span>}
                      </div>
                      <div className="text-slate-600">
                        {formatWhen(b.date)} · {b.payment_mode || 'Credit'} · Due {formatINR(b.outstanding_amount ?? 0)}
                        {(b.source_order_ids?.length || 0) > 1 ? ` · also has ${b.source_order_numbers?.filter(n => n !== order.order_number).join(', ')}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-base mr-1">{formatINR(b.grand_total)}</strong>
                      <button type="button" onClick={() => setPreview(b)} className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold">View</button>
                      {mode === 'view' && (
                        <button type="button" onClick={() => startEditBill(b)} className="min-h-10 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold">Edit bill</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <h3 className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">History</h3>
            <ol className="px-4 py-3 flex flex-col gap-2 text-sm text-slate-800">
              {history.map(h => (
                <li key={h.id}>
                  <span className="text-slate-600">{formatWhen(h.created_at)}</span> — <strong>{h.action}</strong>{h.user_name ? ` (${h.user_name})` : ''}: {h.details}
                </li>
              ))}
              {order.flow_pack_attempted_at && (
                <li><span className="text-slate-600">{formatWhen(order.flow_pack_attempted_at)}</span> — <strong>Packed</strong>{order.flow_packed_by ? ` by ${order.flow_packed_by}` : ''}</li>
              )}
              <li><span className="text-slate-600">{formatWhen(order.order_date || order.created_at)}</span> — <strong>Order placed</strong> ({flowChannelLabel(order)}{order.created_by ? `, ${order.created_by}` : ''})</li>
            </ol>
          </section>
        </div>
      </div>

      {preview && (
        <InvoicePreviewModal
          isOpen={!!preview}
          onClose={() => setPreview(null)}
          invoice={invoices.find(i => i.id === preview.id) || preview}
          retailer={retailers.find(r => r.id === preview.retailer_id) || null}
          company={activeCompany}
        />
      )}
    </div>
  );
}
