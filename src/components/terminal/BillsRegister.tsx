'use client';

/**
 * All bills (the old "Invoices (GST)" page, now inside the Billing Terminal).
 * Find any bill by number, shop, item, date or payment status, then open it in a tab
 * (fully editable) or print it.
 */

import React, { useMemo, useState } from 'react';
import { useDb } from '@/context/DbContext';
import type { Invoice, Retailer, Product } from '@/lib/db';
import { isWalkInRetailerId } from '@/lib/db';
import { hasWords } from '@/lib/searchWords';
import { formatINR } from '@/components/flow/flowUi';

type Status = 'all' | 'paid' | 'partial' | 'unpaid';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';
type Sort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'number_desc';

const statusOf = (inv: Invoice): Exclude<Status, 'all'> => {
  const due = Number(inv.outstanding_amount ?? (inv.grand_total - (inv.paid_amount || 0))) || 0;
  if (due <= 0) return 'paid';
  return (Number(inv.paid_amount) || 0) > 0 ? 'partial' : 'unpaid';
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localDay = (iso: string) => ymd(new Date(iso));

export default function BillsRegister({ initialSearch = '', onOpen, onPrint }: {
  initialSearch?: string;
  onOpen: (inv: Invoice) => void;
  onPrint: (inv: Invoice) => void;
}) {
  const { invoices, retailers, products } = useDb() as any;
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<Status>('all');
  const [shop, setShop] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<Sort>('date_desc');
  const [shown, setShown] = useState(50);

  const shopById = useMemo(() => new Map<string, Retailer>((retailers as Retailer[]).map(r => [r.id, r])), [retailers]);
  const productById = useMemo(() => new Map<string, Product>((products as Product[]).map(p => [p.id, p])), [products]);
  const shopName = (id: string) => isWalkInRetailerId(id) ? 'Counter / Walk-in' : (shopById.get(id)?.shop_name || 'Customer');
  const shopsWithBills = useMemo(() => {
    const ids = new Set((invoices as Invoice[]).map(i => i.retailer_id));
    return Array.from(ids).map(id => ({ id, name: shopName(id) })).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, shopById]);

  const list = useMemo(() => {
    const today = new Date();
    const todayKey = ymd(today);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
    const monthKey = todayKey.slice(0, 7);
    const q = search.trim();
    const out = (invoices as Invoice[]).filter(inv => {
      if ((inv as any).status === 'Cancelled') return false;
      if (status !== 'all' && statusOf(inv) !== status) return false;
      if (shop !== 'all' && inv.retailer_id !== shop) return false;
      const day = localDay(inv.date);
      if (dateFilter === 'today' && day !== todayKey) return false;
      if (dateFilter === 'week' && day < ymd(weekStart)) return false;
      if (dateFilter === 'month' && day.slice(0, 7) !== monthKey) return false;
      if (dateFilter === 'custom' && ((from && day < from) || (to && day > to))) return false;
      if (q) {
        const hay = [inv.invoice_number, shopName(inv.retailer_id), shopById.get(inv.retailer_id)?.mobile,
          ...(inv.source_order_numbers || []),
          ...(inv.items || []).map(it => (it as any).product_name || productById.get(it.product_id)?.name)].filter(Boolean).join(' ');
        if (!hasWords(hay, q)) return false;
      }
      return true;
    });
    const num = (s: string) => parseInt((s.match(/(\d+)\s*$/) || [])[1] || '0', 10);
    out.sort((a, b) => {
      if (sort === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sort === 'amount_desc') return b.grand_total - a.grand_total;
      if (sort === 'amount_asc') return a.grand_total - b.grand_total;
      if (sort === 'number_desc') return num(b.invoice_number) - num(a.invoice_number);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, search, status, shop, dateFilter, from, to, sort, shopById, productById]);

  const sums = useMemo(() => list.reduce((s, inv) => ({
    total: s.total + (Number(inv.grand_total) || 0),
    paid: s.paid + (Number(inv.paid_amount) || 0),
    due: s.due + Math.max(0, Number(inv.outstanding_amount ?? (inv.grand_total - (inv.paid_amount || 0))) || 0)
  }), { total: 0, paid: 0, due: 0 }), [list]);

  const badge = (inv: Invoice) => {
    const s = statusOf(inv);
    const cls = s === 'paid' ? 'bg-emerald-100 text-emerald-800' : s === 'partial' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800';
    return <span className={`text-[11px] font-bold rounded px-2 py-0.5 ${cls}`}>{s.toUpperCase()}</span>;
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          ['Bills', String(list.length)],
          ['Billed value', formatINR(sums.total)],
          ['Collected', formatINR(sums.paid)],
          ['Due', formatINR(sums.due)]
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-slate-300 rounded-lg px-3.5 py-3">
            <div className="text-xs text-slate-600 uppercase tracking-wide font-semibold">{label}</div>
            <div className={`text-xl font-bold ${label === 'Due' && sums.due > 0 ? 'text-red-800' : 'text-slate-900'}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-300 rounded-lg p-3 flex flex-wrap gap-2.5 items-end">
        <div className="flex flex-col gap-1 flex-[1_1_260px]">
          <label htmlFor="br-search" className="text-xs font-semibold text-slate-700">Search</label>
          <input id="br-search" value={search} onChange={e => { setSearch(e.target.value); setShown(50); }}
            placeholder="Bill number, shop, mobile, order number or item"
            className="h-10 border border-slate-400 rounded-sm px-2.5" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="br-shop" className="text-xs font-semibold text-slate-700">Shop</label>
          <select id="br-shop" value={shop} onChange={e => setShop(e.target.value)} className="h-10 border border-slate-400 rounded-sm px-2 max-w-[220px]">
            <option value="all">All shops</option>
            {shopsWithBills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="br-status" className="text-xs font-semibold text-slate-700">Payment</label>
          <select id="br-status" value={status} onChange={e => setStatus(e.target.value as Status)} className="h-10 border border-slate-400 rounded-sm px-2">
            <option value="all">All</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="br-date" className="text-xs font-semibold text-slate-700">Date</label>
          <select id="br-date" value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} className="h-10 border border-slate-400 rounded-sm px-2">
            <option value="all">All dates</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="custom">Custom</option>
          </select>
        </div>
        {dateFilter === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="br-from" className="text-xs font-semibold text-slate-700">From</label>
              <input id="br-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10 border border-slate-400 rounded-sm px-2" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="br-to" className="text-xs font-semibold text-slate-700">To</label>
              <input id="br-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10 border border-slate-400 rounded-sm px-2" />
            </div>
          </>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="br-sort" className="text-xs font-semibold text-slate-700">Sort</label>
          <select id="br-sort" value={sort} onChange={e => setSort(e.target.value as Sort)} className="h-10 border border-slate-400 rounded-sm px-2">
            <option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option>
            <option value="amount_desc">Amount: high to low</option><option value="amount_asc">Amount: low to high</option>
            <option value="number_desc">Bill number</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide text-left">
              <th className="px-3 py-2.5">Bill</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Shop</th>
              <th className="px-3 py-2.5 text-right">Items</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-3 py-2.5 text-right">Paid</th>
              <th className="px-3 py-2.5 text-right">Due</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-600">No bills match.</td></tr>}
            {list.slice(0, shown).map(inv => (
              <tr key={inv.id} className="border-t border-slate-100 hover:bg-indigo-50/40">
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(inv)} className="font-mono font-bold text-indigo-800 underline min-h-8">{inv.invoice_number}</button>
                  {((inv as any).revised || (inv as any).edit_count) ? <span className="ml-2 text-[11px] font-bold text-amber-900 bg-amber-100 rounded px-1.5 py-0.5">Revised</span> : null}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="px-3 py-2.5">{shopName(inv.retailer_id)}</td>
                <td className="px-3 py-2.5 text-right">{(inv.items || []).length}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{formatINR(inv.grand_total)}</td>
                <td className="px-3 py-2.5 text-right">{formatINR(inv.paid_amount || 0)}</td>
                <td className="px-3 py-2.5 text-right">{formatINR(Math.max(0, Number(inv.outstanding_amount) || 0))}</td>
                <td className="px-3 py-2.5">{badge(inv)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button type="button" onClick={() => onPrint(inv)} className="min-h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold mr-1.5">Print</button>
                  <button type="button" onClick={() => onOpen(inv)} className="min-h-9 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold">Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > shown && (
          <div className="p-3 text-center border-t border-slate-100">
            <button type="button" onClick={() => setShown(n => n + 50)} className="min-h-10 px-4 rounded-lg border border-slate-300 font-semibold">Show more ({list.length - shown} left)</button>
          </div>
        )}
      </div>
    </div>
  );
}
