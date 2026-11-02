'use client';

/**
 * Item rate check for biller / admin: purchase rate, last 5 bills to THIS shop,
 * and last 5 bills to ANY shop. "Use" puts that rate into the bill line.
 */

import React, { useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { X } from 'lucide-react';
import { formatINR, formatWhen, productLabel, recentBillingRates, PastRate } from './flowUi';

export default function RateHistoryPanel({
  productId, retailerId, purchaseRate, currentRate, onUseRate, onClose
}: {
  productId: string;
  retailerId?: string | null;
  purchaseRate: number;
  currentRate: number;
  onUseRate?: (rate: number) => void;
  onClose: () => void;
}) {
  const { invoices, retailers, products } = useDb();
  const product = products.find(p => p.id === productId);
  const shop = retailerId ? retailers.find(r => r.id === retailerId) : null;
  const forShop = useMemo(
    () => (retailerId ? recentBillingRates(invoices, retailers, productId, { retailerId, limit: 5 }) : []),
    [invoices, retailers, productId, retailerId]
  );
  const forAll = useMemo(() => recentBillingRates(invoices, retailers, productId, { limit: 5 }), [invoices, retailers, productId]);

  const margin = (rate: number) => (purchaseRate > 0 && rate > 0 ? ((rate - purchaseRate) / rate) * 100 : null);

  const table = (rows: PastRate[], showShop: boolean, empty: string) => (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full min-w-[420px] text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            <th className="px-3 py-2 font-semibold">Bill</th>
            {showShop && <th className="px-3 py-2 font-semibold">Shop</th>}
            <th className="px-3 py-2 font-semibold text-right">Qty</th>
            <th className="px-3 py-2 font-semibold text-right">Rate</th>
            <th className="px-3 py-2 font-semibold text-right">Margin</th>
            {onUseRate && <th className="px-3 py-2"><span className="sr-only">Use</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-3 text-center text-slate-600">{empty}</td></tr>
          )}
          {rows.map((r, i) => {
            const m = margin(r.rate);
            return (
              <tr key={`${r.invoiceId}-${i}`} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs font-bold">{r.invoiceNumber}</div>
                  <div className="text-xs text-slate-600">{formatWhen(r.date)}</div>
                </td>
                {showShop && <td className="px-3 py-2 text-slate-800">{r.shopName}</td>}
                <td className="px-3 py-2 text-right">{r.qty}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatINR(r.rate)}</td>
                <td className={`px-3 py-2 text-right text-xs font-semibold ${m === null ? 'text-slate-500' : m < 0 ? 'text-red-700' : 'text-green-800'}`}>
                  {m === null ? '—' : m < 0 ? `Loss ${Math.abs(m).toFixed(1)}%` : `${m.toFixed(1)}%`}
                </td>
                {onUseRate && (
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => onUseRate(r.rate)}
                      className="min-h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold hover:bg-slate-50">
                      Use
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="rate-history-title">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-start">
          <div>
            <h2 id="rate-history-title" className="text-base font-bold text-slate-900">{productLabel(product)}</h2>
            <p className="text-sm text-slate-600">
              Purchase rate: <strong className="text-slate-900">{purchaseRate > 0 ? formatINR(purchaseRate) : 'Not known'}</strong>
              {' · '}Rate on this bill: <strong className="text-slate-900">{formatINR(currentRate)}</strong>
              {margin(currentRate) !== null && (
                <span className={margin(currentRate)! < 0 ? 'text-red-700 font-semibold' : 'text-green-800 font-semibold'}>
                  {' '}({Math.abs(margin(currentRate)!).toFixed(1)}% {margin(currentRate)! < 0 ? 'loss' : 'margin'})
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 rounded-lg border border-slate-300 flex items-center justify-center">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {retailerId && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-slate-900">Last 5 bills to {shop?.shop_name || 'this shop'}</h3>
            {table(forShop, false, 'Never billed to this shop before.')}
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-slate-900">Last 5 bills to any shop</h3>
          {table(forAll, true, 'This item has not been billed yet.')}
        </section>
      </div>
    </div>
  );
}
