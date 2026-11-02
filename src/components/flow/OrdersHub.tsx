'use client';

/**
 * Orders (admin): one page for everything.
 * To Pack → Ready to Bill → Billed, plus Backorder and All.
 * Orders of one retailer from any channel are packed together and billed as ONE invoice.
 */

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useDb } from '@/context/DbContext';
import type { Invoice, Order } from '@/lib/db';
import { computeFreeStockByProduct, flowOrderStage, flowRemainingQty, flowShopKey, flowChannelLabel, isWalkInRetailerId, FlowStage } from '@/lib/db';
import PackerPanel from './PackerPanel';
import BillerPanel from './BillerPanel';
import OrderDetailModal, { StageBadge } from './OrderDetailModal';
import {
  productLabel, customerName, formatINR, formatWhen, EMPTY_FILTER, OrderFilter, DatePreset,
  orderMatchesFilter, dateInRange, countActiveFilters, OrderSort, ORDER_SORT_OPTIONS, sortByOrderSort
} from './flowUi';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import SpotOrderModal from '@/components/orders/SpotOrderModal';
import { useUrlStep } from '@/lib/useUrlStep';

type Tab = 'to_pack' | 'ready_to_bill' | 'billed' | 'backorder' | 'all';
const PAGE_SIZE = 25;

const DATE_CHIPS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All dates' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' }
];

const CHANNELS: { value: string; label: string }[] = [
  { value: 'retailer_direct', label: 'Retailer app' },
  { value: 'distributor_salesperson', label: 'Salesman' },
  { value: 'company_salesperson', label: 'Company salesman' },
  { value: 'counter_sale', label: 'Counter' }
];

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function OrdersHub() {
  const { orders, products, batches, retailers, invoices, activeCompany } = useDb();
  // Tab and open order are kept in the URL so the Back button works step by step
  const [tab, setTabUrl] = useUrlStep<Tab>('tab', 'to_pack', ['to_pack', 'ready_to_bill', 'billed', 'backorder', 'all']);
  const setTab = (t: Tab) => setTabUrl(t);
  const [filter, setFilter] = useState<OrderFilter>(EMPTY_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [detailParam, setDetailParam] = useUrlStep<string>('order', '', null);
  const detailId = detailParam || null;
  const detailPushed = React.useRef(false);
  const setDetailId = (id: string | null) => {
    if (id) { detailPushed.current = true; setDetailParam(id); return; }
    // Closing the order: same as pressing Back
    if (detailPushed.current && typeof window !== 'undefined') { detailPushed.current = false; window.history.back(); }
    else setDetailParam('', { replace: true });
  };
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const [sort, setSortState] = useState<OrderSort>('oldest');
  const setSort = (v: OrderSort) => { setSortState(v); setPage(1); };
  const [page, setPage] = useState(1);

  const set = (patch: Partial<OrderFilter>) => { setFilter(f => ({ ...f, ...patch })); setPage(1); };

  const free = useMemo(() => computeFreeStockByProduct(batches, orders), [batches, orders]);
  const stageOf = useMemo(() => {
    const m = new Map<string, FlowStage>();
    orders.forEach(o => m.set(o.id, flowOrderStage(o, free)));
    return m;
  }, [orders, free]);

  const invoiceNumbersByOrder = useMemo(() => {
    const m = new Map<string, string[]>();
    invoices.forEach(inv => {
      const ids = new Set([...(inv.source_order_ids || []), inv.order_ref_id].filter(Boolean) as string[]);
      ids.forEach(id => m.set(id, [...(m.get(id) || []), inv.invoice_number]));
    });
    return m;
  }, [invoices]);

  const matches = useCallback(
    (o: Order) => orderMatchesFilter(o, filter, { retailers, products, invoiceNumbers: invoiceNumbersByOrder.get(o.id) }),
    [filter, retailers, products, invoiceNumbersByOrder]
  );

  const filtered = useMemo(() => orders.filter(matches), [orders, matches]);
  const byStage = (s: FlowStage) => filtered.filter(o => stageOf.get(o.id) === s);
  const shopsIn = (list: Order[]) => new Set(list.map(o => flowShopKey(o))).size;

  const orderTime = (o: Order) => new Date(o.order_date || o.created_at || 0).getTime();
  const toPack = byStage('to_pack');
  const ready = byStage('ready_to_bill');
  const backorder = sortByOrderSort(byStage('backorder'), sort, {
    time: orderTime,
    lines: o => (o.items || []).filter(it => flowRemainingQty(it) > 0).length,
    amount: o => Number(o.total_amount) || 0
  });

  // Billed tab lists invoices (one invoice can hold several orders of one shop)
  const billedInvoices = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    const list = invoices
      .filter(inv => (inv as any).status !== 'Cancelled')
      .filter(inv => dateInRange(inv.date, filter))
      .filter(inv => !filter.retailerId || inv.retailer_id === filter.retailerId)
      .filter(inv => {
        const linked = orders.filter(o => inv.source_order_ids?.includes(o.id) || o.id === inv.order_ref_id);
        if (filter.channel && !linked.some(o => o.source === filter.channel)) return false;
        if (filter.createdBy && !linked.some(o => o.created_by === filter.createdBy)) return false;
        const r = retailers.find(x => x.id === inv.retailer_id);
        if (filter.city && (r?.city || '').toLowerCase() !== filter.city.toLowerCase()) return false;
        if (filter.min !== '' && inv.grand_total < Number(filter.min)) return false;
        if (filter.max !== '' && inv.grand_total > Number(filter.max)) return false;
        if (!q) return true;
        const hay = [inv.invoice_number, r?.shop_name, r?.owner_name, r?.mobile, ...(inv.source_order_numbers || []),
          ...(inv.items || []).map(i => i.product_name || products.find(p => p.id === i.product_id)?.name)]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    return sortByOrderSort(list, sort, {
      time: inv => new Date(inv.date).getTime(),
      lines: inv => (inv.items || []).length,
      amount: inv => Number(inv.grand_total) || 0
    });
  }, [invoices, orders, retailers, products, filter, sort]);

  const allSorted = useMemo(() => sortByOrderSort(filtered, sort, {
    time: orderTime,
    lines: o => (o.items || []).length,
    amount: o => Number(o.total_amount) || 0
  }), [filtered, sort]);

  const cities = useMemo(() => Array.from(new Set(retailers.map(r => r.city).filter(Boolean) as string[])).sort(), [retailers]);
  const creators = useMemo(() => Array.from(new Set(orders.map(o => o.created_by).filter(Boolean) as string[])).sort(), [orders]);
  const customers = useMemo(() => retailers.filter(r => !isWalkInRetailerId(r.id)).sort((a, b) => (a.shop_name || '').localeCompare(b.shop_name || '')), [retailers]);

  const tabs: { key: Tab; label: string; count: number; hint: string }[] = [
    { key: 'to_pack', label: 'To Pack', count: toPack.length, hint: `${shopsIn(toPack)} shop${shopsIn(toPack) === 1 ? '' : 's'}` },
    { key: 'ready_to_bill', label: 'Ready to Bill', count: ready.length, hint: `${shopsIn(ready)} bill${shopsIn(ready) === 1 ? '' : 's'} to make` },
    { key: 'billed', label: 'Billed', count: billedInvoices.length, hint: 'Invoices' },
    { key: 'backorder', label: 'Backorder', count: backorder.length, hint: 'Waiting for stock' },
    { key: 'all', label: 'All orders', count: filtered.length, hint: 'Full register' }
  ];

  const exportCsv = () => {
    const rows = [['Order', 'Date', 'Customer', 'City', 'From', 'Created by', 'Stage', 'Items', 'Pending pcs', 'Amount', 'Invoices']];
    allSorted.forEach(o => {
      const r = retailers.find(x => x.id === o.retailer_id);
      rows.push([
        o.order_number, (o.order_date || o.created_at || '').slice(0, 10), customerName(o, retailers), r?.city || '',
        flowChannelLabel(o), o.created_by || '', stageOf.get(o.id) || '', String((o.items || []).length),
        String((o.items || []).reduce((s, it) => s + flowRemainingQty(it), 0)), String(o.total_amount || 0),
        (invoiceNumbersByOrder.get(o.id) || []).join(' ')
      ]);
    });
    const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMore(false);
  };

  const activeFilterCount = countActiveFilters(filter);
  const selectCls = 'min-h-11 border border-slate-300 rounded-lg px-2 text-sm bg-white focus:border-indigo-600 outline-none';
  const pageCount = Math.max(1, Math.ceil(allSorted.length / PAGE_SIZE));
  const pageRows = allSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-600">To Pack → Ready to Bill → Billed. Orders of one shop from any channel are packed and billed together.</p>
        </div>
        <div className="flex flex-wrap gap-2 relative">
          <button type="button" onClick={() => setSpotOpen(true)} className="min-h-11 px-4 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm">
            + Counter Sale
          </button>
          <button type="button" aria-expanded={showMore} onClick={() => setShowMore(v => !v)} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white font-bold text-sm text-slate-800">
            More
          </button>
          {showMore && (
            <div className="absolute right-0 top-12 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 flex flex-col">
              <button type="button" onClick={exportCsv} className="text-left min-h-11 px-3 rounded-lg text-sm hover:bg-slate-50">
                Export orders (CSV for Excel)
              </button>
              <Link href="/admin/orders/legacy" className="min-h-11 px-3 rounded-lg text-sm hover:bg-slate-50 flex items-center text-slate-800">
                Old order register (backup)
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Order stages" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" aria-pressed={active} onClick={() => { setTab(t.key); setPage(1); }}
              className={`text-left p-3.5 rounded-xl flex flex-col gap-0.5 ${active ? 'border-2 border-indigo-700 bg-indigo-50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}>
              <span className={`text-sm font-semibold ${active ? 'text-indigo-800' : 'text-slate-600'}`}>{t.label}</span>
              <span className="text-2xl font-extrabold text-slate-900">{t.count}</span>
              <span className="text-xs text-slate-600">{t.hint}</span>
            </button>
          );
        })}
      </nav>

      <section className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2.5 items-end">
          <label className="flex-[1_1_260px] flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <input type="search" value={filter.search} onChange={e => set({ search: e.target.value })}
              placeholder="Shop, order #, invoice #, phone or product"
              className="min-h-11 border border-slate-300 rounded-lg px-3 text-sm focus:border-indigo-600 outline-none" />
          </label>
          <div role="group" aria-label="Date" className="flex flex-wrap gap-1.5">
            {DATE_CHIPS.map(c => (
              <button key={c.key} type="button" aria-pressed={filter.date === c.key} onClick={() => set({ date: c.key })}
                className={`min-h-11 px-3 rounded-lg text-sm font-semibold ${filter.date === c.key ? 'border-2 border-indigo-700 bg-indigo-50 text-indigo-900' : 'border border-slate-300 bg-white text-slate-800'}`}>
                {c.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">Sort
            <select value={sort} onChange={e => setSort(e.target.value as OrderSort)} className={selectCls} aria-label="Sort orders">
              {ORDER_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}
            className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-800">
            {showFilters ? 'Hide filters' : `Filters${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
          </button>
          {(activeFilterCount > 0 || filter.search || filter.date !== 'all') && (
            <button type="button" onClick={() => { setFilter(EMPTY_FILTER); setPage(1); }} className="min-h-11 px-3 text-sm font-semibold text-indigo-800 underline">
              Clear all
            </button>
          )}
        </div>
        {filter.date === 'custom' && (
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">From
              <input type="date" value={filter.from} onChange={e => set({ from: e.target.value })} className={selectCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">To
              <input type="date" value={filter.to} onChange={e => set({ to: e.target.value })} className={selectCls} />
            </label>
          </div>
        )}
        {showFilters && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 pt-3 border-t border-slate-100">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Customer
              <select value={filter.retailerId} onChange={e => set({ retailerId: e.target.value })} className={selectCls}>
                <option value="">All customers</option>
                {customers.map(r => <option key={r.id} value={r.id}>{r.shop_name}{r.city ? ` (${r.city})` : ''}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Order from
              <select value={filter.channel} onChange={e => set({ channel: e.target.value })} className={selectCls}>
                <option value="">All channels</option>
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Created by
              <select value={filter.createdBy} onChange={e => set({ createdBy: e.target.value })} className={selectCls}>
                <option value="">Anyone</option>
                {creators.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">City
              <select value={filter.city} onChange={e => set({ city: e.target.value })} className={selectCls}>
                <option value="">All cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              <span>Amount (₹)</span>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="f-min">Minimum amount</label>
                <input id="f-min" type="number" placeholder="Min" value={filter.min} onChange={e => set({ min: e.target.value })} className={`${selectCls} w-full min-w-0`} />
                <label className="sr-only" htmlFor="f-max">Maximum amount</label>
                <input id="f-max" type="number" placeholder="Max" value={filter.max} onChange={e => set({ max: e.target.value })} className={`${selectCls} w-full min-w-0`} />
              </div>
            </div>
          </div>
        )}
      </section>

      {tab === 'to_pack' && <PackerPanel filter={matches} sort={sort} />}
      {tab === 'ready_to_bill' && <BillerPanel filter={matches} sort={sort} />}

      {tab === 'billed' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Billed</h2>
            <span className="text-sm text-slate-600">Open an order to edit its bill. Payments are recorded in Payments &amp; Ledger.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-5 py-2.5 font-semibold">Invoice</th>
                  <th className="px-5 py-2.5 font-semibold">Customer</th>
                  <th className="px-5 py-2.5 font-semibold">Orders</th>
                  <th className="px-5 py-2.5 font-semibold">Payment</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {billedInvoices.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-600">No bills match.</td></tr>}
                {billedInvoices.slice(0, 200).map(inv => {
                  const r = retailers.find(x => x.id === inv.retailer_id);
                  const firstOrderId = inv.source_order_ids?.find(id => orders.some(o => o.id === id)) || (orders.some(o => o.id === inv.order_ref_id) ? inv.order_ref_id : undefined);
                  return (
                    <tr key={inv.id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs font-bold">{inv.invoice_number}</div>
                        <div className="text-xs text-slate-600">{formatWhen(inv.date)}</div>
                        {inv.revised && <span className="text-xs font-bold text-amber-900 bg-amber-100 rounded px-1.5 py-0.5">Revised</span>}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{r?.shop_name || 'Counter / Walk-in'}</td>
                      <td className="px-5 py-3 text-slate-700">{(inv.source_order_numbers || []).join(', ') || '—'}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {inv.payment_mode || 'Credit'}{(inv.outstanding_amount ?? 0) > 0 ? ` · Due ${formatINR(inv.outstanding_amount ?? 0)}` : ' · Paid'}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">{formatINR(inv.grand_total)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button type="button" onClick={() => setPreviewInvoice(inv)} className="min-h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold mr-1.5">View</button>
                        {firstOrderId && (
                          <button type="button" onClick={() => setDetailId(firstOrderId)} className="min-h-9 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold">Open</button>
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
                  <th className="px-5 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {backorder.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-600">No backorders.</td></tr>}
                {backorder.map(o => (
                  <tr key={o.id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-3">
                      <div className="font-mono text-xs font-bold">{o.order_number}</div>
                      <div className="text-xs text-slate-600">{flowChannelLabel(o)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{customerName(o, retailers)}</div>
                      <div className="text-xs text-slate-600">Since {formatWhen(o.flow_pack_attempted_at || o.dispatched_at || o.order_date)}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {(o.items || []).filter(it => flowRemainingQty(it) > 0).map(it => (
                        <div key={it.id}>{productLabel(products.find(p => p.id === it.product_id))}: <strong>{flowRemainingQty(it)} pcs</strong></div>
                      ))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => setDetailId(o.id)} className="min-h-9 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold">
                        Open / Close short
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'all' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">All orders</h2>

          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-5 py-2.5 font-semibold">Order</th>
                  <th className="px-5 py-2.5 font-semibold">Customer</th>
                  <th className="px-5 py-2.5 font-semibold">From</th>
                  <th className="px-5 py-2.5 font-semibold">Stage</th>
                  <th className="px-5 py-2.5 font-semibold">Invoice</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-600">No orders match.</td></tr>}
                {pageRows.map(o => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <div className="font-mono text-xs font-bold">{o.order_number}</div>
                      <div className="text-xs text-slate-600">{formatWhen(o.order_date || o.created_at)}</div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{customerName(o, retailers)}</td>
                    <td className="px-5 py-3 text-slate-700">{flowChannelLabel(o)}{o.created_by ? <div className="text-xs text-slate-600">{o.created_by}</div> : null}</td>
                    <td className="px-5 py-3"><StageBadge stage={stageOf.get(o.id) || 'to_pack'} /></td>
                    <td className="px-5 py-3 text-slate-700 text-xs">{(invoiceNumbersByOrder.get(o.id) || []).join(', ') || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatINR(o.total_amount || 0)}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => setDetailId(o.id)} className="min-h-9 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold">Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-sm text-slate-600">
            <span>Showing {pageRows.length} of {allSorted.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white font-semibold disabled:opacity-50">Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} className="min-h-10 px-3 rounded-lg border border-slate-300 bg-white font-semibold disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>
      )}

      {detailId && <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />}
      {previewInvoice && (
        <InvoicePreviewModal
          isOpen={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          invoice={invoices.find(i => i.id === previewInvoice.id) || previewInvoice}
          retailer={retailers.find(r => r.id === previewInvoice.retailer_id) || null}
          company={activeCompany}
        />
      )}
      <SpotOrderModal isOpen={spotOpen} onClose={() => setSpotOpen(false)} />
    </div>
  );
}
