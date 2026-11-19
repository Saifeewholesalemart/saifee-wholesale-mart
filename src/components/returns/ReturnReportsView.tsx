'use client';

/**
 * Return reports: sales return items, purchase return items, damaged stock.
 * Used in Returns → Reports and in ERP Reports → Return Reports.
 */

import React, { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useDb } from '@/context/DbContext';
import { exportToExcel } from '@/lib/exportUtils';
import { matchWords } from '@/lib/searchWords';
import ReportTable from '@/components/reports/ReportTable';
import { PERIOD_OPTIONS, ReportPeriod, periodRange, categoryOptions } from '@/lib/partyItemReports';
import {
  salesReturnLines, purchaseReturnLines, returnItemSummary, damagedStock,
  ReturnLine, ReturnItemRow, DamagedRow
} from '@/lib/returnReports';

type Kind = 'sales' | 'purchase' | 'damaged';
type View = 'items' | 'lines';

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'sales', label: 'Sales Return Items', hint: 'Goods returned by parties (credit notes)' },
  { id: 'purchase', label: 'Purchase Return Items', hint: 'Goods sent back to parties (debit notes)' },
  { id: 'damaged', label: 'Damaged Stock', hint: 'Damaged goods lying with us' }
];

const qty = (x: number) => (Number(x) || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const day = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function ReturnReportsView({ initialKind = 'sales' }: { initialKind?: Kind }) {
  const { products, retailers, suppliers, invoices, purchases, salesReturns, purchaseReturns, inventory } = useDb() as any;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [view, setView] = useState<View>('items');
  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const first = periodRange('this_month');
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [category, setCategory] = useState('all');
  const [partyId, setPartyId] = useState('all');
  const [condition, setCondition] = useState<'all' | 'Good' | 'Damaged'>('all');
  const [search, setSearch] = useState('');

  const src = { products, retailers, suppliers, invoices, purchases, salesReturns, purchaseReturns, inventory };
  const categories = useMemo(() => categoryOptions(products || []), [products]);

  const changePeriod = (p: ReportPeriod) => {
    setPeriod(p);
    if (p !== 'custom') { const r = periodRange(p); setFrom(r.from); setTo(r.to); }
  };

  const allLines: ReturnLine[] = useMemo(() => (kind === 'damaged' ? [] : kind === 'sales'
    ? salesReturnLines(src, from, to) : purchaseReturnLines(src, from, to)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [kind, from, to, products, retailers, suppliers, invoices, purchases, salesReturns, purchaseReturns]);

  const partyOptions = useMemo(() => {
    const m = new Map<string, string>();
    allLines.forEach(l => m.set(l.partyId, l.partyName));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allLines]);

  const lines = useMemo(() => allLines.filter(l =>
    (category === 'all' || l.category === category) &&
    (partyId === 'all' || l.partyId === partyId) &&
    (condition === 'all' || l.condition === condition) &&
    (!search.trim() || matchWords(search, l.itemName, l.partyName, l.number, l.batch, l.reason))
  ), [allLines, category, partyId, condition, search]);

  const items: ReturnItemRow[] = useMemo(() => returnItemSummary(lines), [lines]);

  const damaged: DamagedRow[] = useMemo(() => (kind !== 'damaged' ? [] : damagedStock(src, from, to)
    .filter(r => (category === 'all' || r.category === category) && (!search.trim() || matchWords(search, r.itemName, r.category)))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [kind, from, to, category, search, products, inventory, salesReturns, purchaseReturns, retailers, suppliers]);

  const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const kindInfo = KINDS.find(k => k.id === kind)!;
  const partyWord = kind === 'sales' ? 'Party (returned by)' : 'Party (sent to)';

  const exportExcel = () => {
    const filterSummary = [`Period: ${day(from)} to ${day(to)}`, `Category: ${category === 'all' ? 'All' : category}`];
    if (kind === 'damaged') {
      exportToExcel<DamagedRow>({
        reportTitle: 'Damaged Stock Report', filterSummary,
        columns: [
          { header: 'Item', key: 'itemName' }, { header: 'Category', key: 'category' },
          { header: 'Damaged Now (pcs)', key: 'damagedNow', format: 'number' },
          { header: 'Purchase Rate', key: 'purchaseRate', format: 'currency' },
          { header: 'Value', key: 'value', format: 'currency' },
          { header: 'Came In (returns)', key: 'cameIn', format: 'number' },
          { header: 'Sent Back', key: 'wentOut', format: 'number' },
          { header: 'Last Came In', key: 'lastIn' }
        ] as any,
        data: damaged,
        totalsRow: { itemName: 'Total', damagedNow: sum(damaged, 'damagedNow'), value: sum(damaged, 'value'), cameIn: sum(damaged, 'cameIn'), wentOut: sum(damaged, 'wentOut') }
      });
      return;
    }
    if (partyId !== 'all') filterSummary.push(`Party: ${partyOptions.find(p => p[0] === partyId)?.[1] || ''}`);
    if (view === 'items') {
      exportToExcel<ReturnItemRow>({
        reportTitle: `${kindInfo.label} - By Item`, filterSummary,
        columns: [
          { header: 'Item', key: 'itemName' }, { header: 'Category', key: 'category' },
          { header: 'Qty (pcs)', key: 'qty', format: 'number' }, { header: 'Good', key: 'goodQty', format: 'number' },
          { header: 'Damaged', key: 'damagedQty', format: 'number' }, { header: 'Taxable', key: 'taxable', format: 'currency' },
          { header: 'Amount', key: 'amount', format: 'currency' }, { header: 'Notes', key: 'notes', format: 'number' }
        ] as any,
        data: items,
        totalsRow: { itemName: 'Total', qty: sum(items, 'qty'), goodQty: sum(items, 'goodQty'), damagedQty: sum(items, 'damagedQty'), taxable: sum(items, 'taxable'), amount: sum(items, 'amount') }
      });
    } else {
      exportToExcel<ReturnLine>({
        reportTitle: `${kindInfo.label} - All Lines`, filterSummary,
        columns: [
          { header: 'Date', key: 'date' }, { header: kind === 'sales' ? 'Credit Note' : 'Debit Note', key: 'number' },
          { header: 'Party', key: 'partyName' }, { header: 'Item', key: 'itemName' },
          { header: 'Batch No.', key: 'batch' }, { header: 'Mfg Date', key: 'mfg' }, { header: 'Expiry Date', key: 'expiry' },
          { header: 'Condition', key: 'condition' }, { header: 'Qty (pcs)', key: 'qty', format: 'number' },
          { header: 'Taxable', key: 'taxable', format: 'currency' }, { header: 'GST', key: 'gst', format: 'currency' },
          { header: 'Amount', key: 'amount', format: 'currency' }, { header: 'Reason', key: 'reason' }
        ] as any,
        data: lines,
        totalsRow: { date: 'Total', qty: sum(lines, 'qty'), taxable: sum(lines, 'taxable'), gst: sum(lines, 'gst'), amount: sum(lines, 'amount') }
      });
    }
  };

  const sel = 'w-full text-xs font-semibold bg-white border border-slate-300 rounded-md px-2.5 py-2 text-slate-800';
  const lbl = 'block text-[11px] font-bold text-slate-600 mb-1';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1" role="group" aria-label="Report">
          {KINDS.map(k => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setPartyId('all'); }}
              className={`px-3 py-1.5 rounded-md text-sm font-bold ${kind === k.id ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              {k.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportExcel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100">
          <FileSpreadsheet className="w-4 h-4" /> Excel Report
        </button>
      </div>
      <p className="text-xs text-slate-500">{kindInfo.hint}.{kind !== 'damaged' ? ' General notes (amount only, no items) are not in this report.' : ' "Damaged now" is today’s damaged stock; "came in" and "sent back" are for the period.'}</p>

      <div className="bg-white border border-slate-300 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className={lbl}>Period</label>
          <select className={sel} value={period} onChange={e => changePeriod(e.target.value as ReportPeriod)}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>From – To</label>
          <div className="flex items-center gap-1.5">
            <input type="date" aria-label="From" value={from} onChange={e => { setFrom(e.target.value); setPeriod('custom'); }} className="w-full min-w-0 text-xs font-semibold bg-white border border-slate-300 rounded-md px-1.5 py-1.5" />
            <span className="text-xs text-slate-500">to</span>
            <input type="date" aria-label="To" value={to} onChange={e => { setTo(e.target.value); setPeriod('custom'); }} className="w-full min-w-0 text-xs font-semibold bg-white border border-slate-300 rounded-md px-1.5 py-1.5" />
          </div>
        </div>
        <div>
          <label className={lbl}>Category</label>
          <select className={sel} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {kind !== 'damaged' ? (
          <>
            <div>
              <label className={lbl}>{partyWord}</label>
              <select className={sel} value={partyId} onChange={e => setPartyId(e.target.value)} aria-label="Party">
                <option value="all">All Parties</option>
                {partyOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Condition / Show</label>
              <div className="flex gap-1.5">
                <select className={sel} value={condition} onChange={e => setCondition(e.target.value as any)} aria-label="Condition">
                  <option value="all">Good + Damaged</option>
                  <option value="Good">Good only</option>
                  <option value="Damaged">Damaged only</option>
                </select>
                <select className={sel} value={view} onChange={e => setView(e.target.value as View)} aria-label="Show">
                  <option value="items">By item</option>
                  <option value="lines">Every line</option>
                </select>
              </div>
            </div>
          </>
        ) : <div className="lg:col-span-2" />}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, party, note number or batch"
        className="w-full sm:max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500" />

      {kind === 'damaged' ? (
        <React.Fragment key="damaged">
        <ReportTable<DamagedRow>
          hideSearch
          data={damaged}
          rowKey={r => r.id}
          emptyMessage="No damaged stock."
          columns={[
            { header: 'Item', key: 'itemName', minWidth: 240, render: r => <span className="font-semibold">{r.itemName}</span> },
            { header: 'Category', key: 'category' },
            { header: 'Damaged Now (pcs)', key: 'damagedNow', format: 'number', render: r => <span className={`font-bold ${r.damagedNow > 0 ? 'text-red-700' : 'text-slate-500'}`}>{qty(r.damagedNow)}</span> },
            { header: 'Purchase Rate', key: 'purchaseRate', format: 'currency' },
            { header: 'Value', key: 'value', format: 'currency' },
            { header: 'Came In (returns)', key: 'cameIn', format: 'number', render: r => qty(r.cameIn) },
            { header: 'Sent Back', key: 'wentOut', format: 'number', render: r => qty(r.wentOut) },
            { header: 'Last Came In', key: 'lastIn', sortValue: r => r.lastIn, render: r => day(r.lastIn) }
          ]}
          totals={{ itemName: `${damaged.length} ${damaged.length === 1 ? 'item' : 'items'}`, damagedNow: sum(damaged, 'damagedNow'), value: sum(damaged, 'value'), cameIn: sum(damaged, 'cameIn'), wentOut: sum(damaged, 'wentOut') }}
        />
        </React.Fragment>
      ) : view === 'items' ? (
        <React.Fragment key={`items-${kind}`}>
        <ReportTable<ReturnItemRow>
          hideSearch
          data={items}
          rowKey={r => r.id}
          emptyMessage="No returned items in this period."
          columns={[
            { header: 'Item', key: 'itemName', minWidth: 240, render: r => <span className="font-semibold">{r.itemName}</span> },
            { header: 'Category', key: 'category' },
            { header: 'Qty (pcs)', key: 'qty', format: 'number', render: r => qty(r.qty) },
            { header: 'Good', key: 'goodQty', format: 'number', render: r => qty(r.goodQty) },
            { header: 'Damaged', key: 'damagedQty', format: 'number', render: r => <span className={r.damagedQty > 0 ? 'font-bold text-red-700' : ''}>{qty(r.damagedQty)}</span> },
            { header: 'Taxable', key: 'taxable', format: 'currency' },
            { header: 'Amount', key: 'amount', format: 'currency' },
            { header: 'Notes', key: 'notes', format: 'number' }
          ]}
          totals={{ itemName: `${items.length} ${items.length === 1 ? 'item' : 'items'}`, qty: sum(items, 'qty'), goodQty: sum(items, 'goodQty'), damagedQty: sum(items, 'damagedQty'), taxable: sum(items, 'taxable'), amount: sum(items, 'amount') }}
        />
        </React.Fragment>
      ) : (
        <React.Fragment key={`lines-${kind}`}>
        <ReportTable<ReturnLine>
          hideSearch
          data={lines}
          rowKey={r => r.id}
          emptyMessage="No returned items in this period."
          columns={[
            { header: 'Date', key: 'date', sortValue: r => r.date, render: r => day(r.date) },
            { header: kind === 'sales' ? 'Credit Note' : 'Debit Note', key: 'number', render: r => <span className="font-mono text-xs font-bold">{r.number}</span> },
            { header: 'Party', key: 'partyName', minWidth: 180 },
            { header: 'Item', key: 'itemName', minWidth: 200 },
            { header: 'Batch No.', key: 'batch', render: r => r.batch || '—' },
            { header: 'Mfg Date', key: 'mfg', sortValue: r => r.mfg, render: r => day(r.mfg) },
            { header: 'Expiry Date', key: 'expiry', sortValue: r => r.expiry, render: r => day(r.expiry) },
            { header: 'Condition', key: 'condition', render: r => <span className={r.condition === 'Damaged' ? 'font-bold text-red-700' : 'text-emerald-700'}>{r.condition}</span> },
            { header: 'Qty (pcs)', key: 'qty', format: 'number', render: r => qty(r.qty) },
            { header: 'Taxable', key: 'taxable', format: 'currency' },
            { header: 'GST', key: 'gst', format: 'currency' },
            { header: 'Amount', key: 'amount', format: 'currency' },
            { header: 'Reason', key: 'reason' }
          ]}
          totals={{ date: `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`, qty: sum(lines, 'qty'), taxable: sum(lines, 'taxable'), gst: sum(lines, 'gst'), amount: sum(lines, 'amount') }}
        />
        </React.Fragment>
      )}
    </div>
  );
}
