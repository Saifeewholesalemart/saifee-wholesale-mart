'use client';

/**
 * Returns: Sales Returns (credit notes), Purchase Returns (debit notes) and return reports.
 * Open a tab directly with ?tab=sales | purchase | reports.
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import SalesReturnsView from '@/components/returns/SalesReturnsView';
import PurchaseReturnsView from '@/components/returns/PurchaseReturnsView';
import ReturnReportsView from '@/components/returns/ReturnReportsView';

type Tab = 'sales' | 'purchase' | 'reports';
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'sales', label: 'Sales Returns', hint: 'Credit notes' },
  { id: 'purchase', label: 'Purchase Returns', hint: 'Debit notes' },
  { id: 'reports', label: 'Return Reports', hint: 'Items and damaged stock' }
];
const isTab = (v: string | null): v is Tab => v === 'sales' || v === 'purchase' || v === 'reports';

export default function ReturnsPage() {
  const [tab, setTab] = useState<Tab>('sales');

  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (isTab(t)) setTab(t);
    } catch { /* ignore */ }
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2"><RotateCcw className="w-5 h-5 text-indigo-600" /> Returns</h1>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-2xl" role="tablist" aria-label="Returns">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}
            className={`text-left rounded-xl px-3 py-2.5 border ${tab === t.id ? 'border-2 border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
            <span className={`block text-sm font-black ${tab === t.id ? 'text-indigo-900' : 'text-slate-800'}`}>{t.label}</span>
            <span className="block text-[11px] text-slate-500">{t.hint}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'sales' && <SalesReturnsView />}
        {tab === 'purchase' && <PurchaseReturnsView />}
        {tab === 'reports' && <ReturnReportsView />}
      </div>
    </div>
  );
}
