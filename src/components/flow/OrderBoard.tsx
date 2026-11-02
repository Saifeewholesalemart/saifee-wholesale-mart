'use client';

/**
 * Admin Order Board (simple flow): To Pack -> Ready to Bill -> Billed, plus Backorder.
 * Admin can pack and bill from here too.
 */

import React, { useMemo, useState } from 'react';
import { useDb } from '@/context/DbContext';
import type { Invoice } from '@/lib/db';
import { computeFreeStockByProduct, flowOrderStage, flowRemainingQty, FlowStage } from '@/lib/db';
import PackerPanel from './PackerPanel';
import BillerPanel from './BillerPanel';
import { productLabel, customerName, formatINR, formatWhen } from './flowUi';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';

type Tab = 'to_pack' | 'ready_to_bill' | 'billed' | 'backorder';

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'to_pack', label: 'To Pack', hint: 'Waiting for packer' },
  { key: 'ready_to_bill', label: 'Ready to Bill', hint: 'Packed, waiting for biller' },
  { key: 'billed', label: 'Billed', hint: 'Invoice generated' },
  { key: 'backorder', label: 'Backorder', hint: 'Short items waiting for stock' }
];

export default function OrderBoard() {
  const { orders, batches, retailers, products, invoices, activeCompany } = useDb();
  const [tab, setTab] = useState<Tab>('to_pack');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const free = useMemo(() => computeFreeStockByProduct(batches, orders), [batches, orders]);
  const byStage = useMemo(() => {
    const map: Record<FlowStage, typeof orders> = { to_pack: [], ready_to_bill: [], billed: [], backorder: [], cancelled: [] };
    orders.forEach(o => map[flowOrderStage(o, free)].push(o));
    return map;
  }, [orders, free]);

  const invoicesFor = (orderId: string, orderNumber: string) =>
    invoices.filter(inv =>
      inv.order_ref_id === orderId ||
      inv.source_order_ids?.includes(orderId) ||
      inv.source_order_numbers?.includes(orderNumber)
    );

  // Any order with an invoice shows under Billed (even if some items are still on backorder)
  const billed = useMemo(
    () => orders.filter(o => byStage.billed.includes(o) || (byStage.backorder.includes(o) && invoicesFor(o.id, o.order_number).length > 0)).sort((a, b) => new Date(b.dispatched_at || b.updated_at || 0).getTime() - new Date(a.dispatched_at || a.updated_at || 0).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byStage, orders, invoices]
  );
  const tabCount = (k: Tab) => (k === 'billed' ? billed.length : byStage[k].length);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Order stages" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={`text-left p-4 rounded-xl flex flex-col gap-1 ${active ? 'border-2 border-indigo-700 bg-indigo-50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <span className={`text-sm font-semibold ${active ? 'text-indigo-800' : 'text-slate-600'}`}>{t.label}</span>
              <span className="text-3xl font-extrabold text-slate-900">{tabCount(t.key)}</span>
              <span className="text-xs text-slate-600">{t.hint}</span>
            </button>
          );
        })}
      </nav>

      {tab === 'to_pack' && <PackerPanel />}
      {tab === 'ready_to_bill' && <BillerPanel />}

      {tab === 'billed' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Billed</h2>
            <span className="text-sm text-slate-600">An order is complete once its invoice is made. Payments are recorded in Payments &amp; Ledger.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-5 py-2.5 font-semibold">Order</th>
                  <th className="px-5 py-2.5 font-semibold">Customer</th>
                  <th className="px-5 py-2.5 font-semibold">Invoice</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {billed.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-600">No billed orders yet.</td></tr>
                )}
                {billed.slice(0, 100).map(o => {
                  const invs = invoicesFor(o.id, o.order_number);
                  const amount = invs.reduce((s, i) => s + (i.grand_total || 0), 0);
                  return (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-mono text-xs font-bold">{o.order_number}</td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{customerName(o, retailers)}</div>
                        <div className="text-xs text-slate-600">{formatWhen(o.dispatched_at || o.updated_at)}</div>
                        {byStage.backorder.includes(o) && <div className="text-xs font-semibold text-amber-700">Some items on backorder</div>}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{invs.map(i => i.invoice_number).join(', ') || '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatINR(amount)}</td>
                      <td className="px-5 py-3 text-right">
                        {invs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(invs[invs.length - 1])}
                            className="min-h-9 px-3.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            View invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'backorder' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Backorder</h2>
            <span className="text-sm text-slate-600">When stock arrives through a purchase, these orders move back to To Pack automatically.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-5 py-2.5 font-semibold">Order</th>
                  <th className="px-5 py-2.5 font-semibold">Customer</th>
                  <th className="px-5 py-2.5 font-semibold">Waiting for stock</th>
                </tr>
              </thead>
              <tbody>
                {byStage.backorder.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-600">No backorders.</td></tr>
                )}
                {byStage.backorder.map(o => (
                  <tr key={o.id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-3 font-mono text-xs font-bold">{o.order_number}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{customerName(o, retailers)}</div>
                      <div className="text-xs text-slate-600">Since {formatWhen(o.flow_pack_attempted_at || o.dispatched_at || o.order_date)}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {(o.items || []).filter(it => flowRemainingQty(it) > 0).map(it => (
                        <div key={it.id}>
                          {productLabel(products.find(p => p.id === it.product_id))}: <strong>{flowRemainingQty(it)} pcs</strong>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {previewInvoice && (
        <InvoicePreviewModal
          isOpen={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          invoice={previewInvoice}
          retailer={retailers.find(r => r.id === previewInvoice.retailer_id) || null}
          company={activeCompany}
        />
      )}
    </div>
  );
}
