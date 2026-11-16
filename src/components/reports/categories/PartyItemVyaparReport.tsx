'use client';

/**
 * Vyapar-style "Party Report By Item" (mode 'party_by_item') and
 * "Item Report By Party" (mode 'item_by_party').
 *
 * Filters: period (Today ... Custom, with From/To), Category, Item or Party, Sort by.
 * Columns: Name, Sale Qty, Sale Amount, Purchase Qty, Purchase Amount, and a Total line.
 * Excel and Print give the same table with the report heading and the chosen filters.
 */

import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer, X } from 'lucide-react';
import { useDb } from '@/context/DbContext';
import { db as localDb } from '@/lib/db';
import { matchWords } from '@/lib/searchWords';
import { exportToExcel } from '@/lib/exportUtils';
import ReportTable from '@/components/reports/ReportTable';
import {
  PERIOD_OPTIONS, ReportPeriod, SortBy, PartyItemRow,
  periodRange, partyReportByItem, itemReportByParty, categoryOptions
} from '@/lib/partyItemReports';

type Mode = 'party_by_item' | 'item_by_party';

interface Props {
  mode: Mode;
  dbState: {
    invoices?: any[]; salesReturns?: any[]; purchases?: any[];
    products?: any[]; retailers?: any[]; suppliers?: any[];
  };
}

const fmtQty = (q: number) => q.toLocaleString('en-IN', { maximumFractionDigits: 3 });
const fmtAmt = (a: number) => '₹' + a.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const showDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
};
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Search box with a dropdown list (works with the app-wide arrow keys). */
function Picker({ label, allLabel, value, options, onChange, placeholder }: {
  label: string;
  allLabel: string;
  value: string;
  options: { id: string; name: string; hint?: string }[];
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);
  const list = useMemo(() => {
    const q = text.trim();
    const found = q ? options.filter(o => matchWords(q, o.name, o.hint)) : options;
    return found.slice(0, 60);
  }, [options, text]);

  const pick = (id: string) => { onChange(id); setText(''); setOpen(false); };

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={open ? text : (value === 'all' ? allLabel : selected?.name || allLabel)}
          onFocus={() => { setOpen(true); setText(''); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          placeholder={placeholder}
          className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md px-2.5 py-2 pr-7 text-slate-800 outline-none focus:border-indigo-500"
        />
        {value !== 'all' && !open && (
          <button type="button" onClick={() => pick('all')} title="Show all" className="absolute right-1.5 top-2 text-slate-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        )}
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-300 rounded-md shadow-lg max-h-72 overflow-y-auto text-xs">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick('all')}
              className="w-full text-left px-2.5 py-2 hover:bg-indigo-50 font-bold text-slate-700 border-b border-slate-100">
              {allLabel}
            </button>
            {list.map(o => (
              <button key={o.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.id)}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-indigo-50 flex items-center justify-between gap-2 ${o.id === value ? 'bg-indigo-50 font-bold' : ''}`}>
                <span className="truncate">{o.name}</span>
                {o.hint && <span className="text-[10px] text-slate-400 shrink-0">{o.hint}</span>}
              </button>
            ))}
            {list.length === 0 && <div className="px-2.5 py-2 text-slate-400">No match</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartyItemVyaparReport({ mode, dbState }: Props) {
  const { activeCompany } = useDb() as any;
  const isPartyByItem = mode === 'party_by_item';
  const title = isPartyByItem ? 'Party Report By Item' : 'Item Report By Party';
  const nameHeader = isPartyByItem ? 'Party Name' : 'Item Name';

  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const initial = periodRange('this_month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [category, setCategory] = useState('all');
  const [productId, setProductId] = useState('all');
  const [partyId, setPartyId] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');

  const changePeriod = (p: ReportPeriod) => {
    setPeriod(p);
    if (p !== 'custom') {
      const r = periodRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const purchaseReturns = useMemo(() => {
    try { return localDb.getPurchaseReturns(); } catch { return []; }
    // purchases change when a purchase return is saved, so this list is read again then
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbState.purchases]);

  const source = useMemo(() => ({ ...dbState, purchaseReturns }), [dbState, purchaseReturns]);

  const categories = useMemo(() => categoryOptions(dbState.products || []), [dbState.products]);

  const itemOptions = useMemo(() => (dbState.products || [])
    .filter(p => category === 'all' || (p.category || 'Uncategorized') === category)
    .map(p => ({ id: p.id, name: p.name, hint: p.mrp ? `MRP ₹${p.mrp}` : undefined }))
    .sort((a, b) => a.name.localeCompare(b.name)), [dbState.products, category]);

  const partyOptions = useMemo(() => [
    ...(dbState.retailers || []).map(r => ({ id: `Retailer:${r.id}`, name: r.shop_name || r.owner_name || 'Party', hint: r.city || 'Customer' })),
    ...(dbState.suppliers || []).map(s => ({ id: `Supplier:${s.id}`, name: s.name || 'Supplier', hint: 'Supplier' }))
  ].sort((a, b) => a.name.localeCompare(b.name)), [dbState.retailers, dbState.suppliers]);

  const result = useMemo(() => {
    const opts = { period, customFrom: from, customTo: to, category, sortBy };
    return isPartyByItem
      ? partyReportByItem(source, { ...opts, productId })
      : itemReportByParty(source, { ...opts, partyId });
  }, [isPartyByItem, source, period, from, to, category, sortBy, productId, partyId]);

  const chosenName = isPartyByItem
    ? (productId === 'all' ? 'All Items' : itemOptions.find(o => o.id === productId)?.name || (dbState.products || []).find(p => p.id === productId)?.name || 'Item')
    : (partyId === 'all' ? 'All Parties' : partyOptions.find(o => o.id === partyId)?.name || 'Party');
  const filterLines = [
    `${isPartyByItem ? 'Item Name' : 'Party Name'}: ${chosenName}`,
    `Item Category: ${category === 'all' ? 'All Categories' : category}`,
    `Duration: From ${showDate(result.from)} to ${showDate(result.to)}`
  ];
  const businessName = activeCompany?.name || 'Saifee General Stores';

  const handleExcel = () => {
    exportToExcel<PartyItemRow>({
      reportTitle: title,
      companyName: businessName,
      filterSummary: filterLines,
      columns: [
        { header: nameHeader, key: 'name' },
        { header: 'Sale Quantity', key: 'saleQty', format: 'number' },
        { header: 'Sale Amount', key: 'saleAmount', format: 'currency' },
        { header: 'Purchase Quantity', key: 'purchaseQty', format: 'number' },
        { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' }
      ],
      data: result.rows,
      totalsRow: {
        name: 'Total',
        saleQty: result.totals.saleQty,
        saleAmount: result.totals.saleAmount,
        purchaseQty: result.totals.purchaseQty,
        purchaseAmount: result.totals.purchaseAmount
      }
    });
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = result.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${fmtQty(r.saleQty)}</td><td class="n">${fmtAmt(r.saleAmount)}</td><td class="n">${fmtQty(r.purchaseQty)}</td><td class="n">${fmtAmt(r.purchaseAmount)}</td></tr>`).join('');
    const t = result.totals;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0}
.biz{font-size:12px;color:#444;margin-top:2px}
h2{font-size:15px;text-align:center;text-decoration:underline;margin:18px 0 10px}
.f{font-size:12px;margin:2px 0}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th{background:#e5e7eb;text-align:left;padding:6px;border:1px solid #9ca3af}
td{padding:5px 6px;border:1px solid #d1d5db}
.n{text-align:right}
tfoot td{font-weight:bold;background:#f3f4f6}
</style></head><body>
<h1>${esc(businessName)}</h1>
<div class="biz">${esc([activeCompany?.address, activeCompany?.city, activeCompany?.phone ? 'Phone: ' + activeCompany.phone : '', activeCompany?.gstin ? 'GSTIN: ' + activeCompany.gstin : ''].filter(Boolean).join(' · '))}</div>
<h2>${esc(title)}</h2>
${filterLines.map(l => `<div class="f">${esc(l)}</div>`).join('')}
<table><thead><tr><th>${nameHeader}</th><th class="n">Sale Quantity</th><th class="n">Sale Amount</th><th class="n">Purchase Quantity</th><th class="n">Purchase Amount</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No sale or purchase in this period.</td></tr>'}</tbody>
<tfoot><tr><td>Total</td><td class="n">${fmtQty(t.saleQty)}</td><td class="n">${fmtAmt(t.saleAmount)}</td><td class="n">${fmtQty(t.purchaseQty)}</td><td class="n">${fmtAmt(t.purchaseAmount)}</td></tr></tfoot>
</table>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      {/* Heading and actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100">
            <FileSpreadsheet className="w-4 h-4" /> Excel Report
          </button>
          <button type="button" onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100">
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Period</label>
          <select value={period} onChange={(e) => changePeriod(e.target.value as ReportPeriod)}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md px-2.5 py-2 text-slate-800">
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">From – To</label>
          <div className="flex items-center gap-1.5">
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod('custom'); }}
              className="w-full min-w-0 text-xs font-semibold bg-white border border-slate-300 rounded-md px-1.5 py-1.5" />
            <span className="text-xs text-slate-500">to</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPeriod('custom'); }}
              className="w-full min-w-0 text-xs font-semibold bg-white border border-slate-300 rounded-md px-1.5 py-1.5" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Category</label>
          <select value={category} onChange={(e) => { setCategory(e.target.value); }}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md px-2.5 py-2 text-slate-800">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {isPartyByItem ? (
          <Picker label="Item Name" allLabel="All Items" value={productId} options={itemOptions}
            onChange={setProductId} placeholder="Type item name" />
        ) : (
          <Picker label="Party Name" allLabel="All Parties" value={partyId} options={partyOptions}
            onChange={setPartyId} placeholder="Type party name" />
        )}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md px-2.5 py-2 text-slate-800">
            <option value="name">{isPartyByItem ? 'Party name' : 'Item name'}</option>
            <option value="sale_qty">Sale quantity</option>
            <option value="purchase_qty">Purchase quantity</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {/* a new Sort by starts the grid again, so the chosen order is shown */}
      <React.Fragment key={sortBy}>
      <ReportTable<PartyItemRow>
        hideSearch
        data={result.rows}
        rowKey={(r) => r.id}
        emptyMessage={isPartyByItem ? 'No sale or purchase of this item in the selected period.' : 'No sale or purchase with this party in the selected period.'}
        columns={[
          { header: nameHeader, key: 'name', minWidth: 260,
            render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
          { header: 'Sale Qty', key: 'saleQty', format: 'number', render: (r) => fmtQty(r.saleQty) },
          { header: 'Sale Amount', key: 'saleAmount', format: 'currency', render: (r) => fmtAmt(r.saleAmount) },
          { header: 'Purchase Qty', key: 'purchaseQty', format: 'number', render: (r) => fmtQty(r.purchaseQty) },
          { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency', render: (r) => fmtAmt(r.purchaseAmount) }
        ]}
        totals={{
          name: `${result.rows.length} ${isPartyByItem ? (result.rows.length === 1 ? 'party' : 'parties') : (result.rows.length === 1 ? 'item' : 'items')}`,
          saleQty: result.totals.saleQty,
          saleAmount: result.totals.saleAmount,
          purchaseQty: result.totals.purchaseQty,
          purchaseAmount: result.totals.purchaseAmount
        }}
      />
      </React.Fragment>
    </div>
  );
}
