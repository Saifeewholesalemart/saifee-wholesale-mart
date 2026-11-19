'use client';

/**
 * Debit notes to suppliers.
 * - Item-wise: goods go back to the supplier (from good or damaged stock), with optional
 *   batch / mfg / expiry and a discount at the end. Items can be copied from a credit note
 *   (goods a shop returned to us that now go back to the supplier).
 * - General: only an amount (rate difference, short supply, scheme...), no items.
 */

import React, { useMemo, useState } from 'react';
import { Plus, X, Printer, FileMinus, Trash2 } from 'lucide-react';
import { useDb } from '@/context/DbContext';
import type { Product, Retailer, Purchase, PurchaseReturn, SalesReturn } from '@/lib/db';
import { isWalkInRetailerId, getSellerDetails } from '@/lib/db';
import { matchWords } from '@/lib/searchWords';
import { printInvoiceDocument } from '@/lib/printInvoice';
import ReportTable from '@/components/reports/ReportTable';

const REASONS = ['Expired / near expiry', 'Damaged goods', 'Returned by shop', 'Rate difference', 'Short supply', 'Scheme / discount'];
const inr = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const r2 = (x: number) => Math.round(x * 100) / 100;
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface Row {
  key: string;
  productId: string;
  qty: string;
  rate: string;
  gst: string;
  condition: 'Sellable' | 'Damaged';
  batch: string;
  mfg: string;
  exp: string;
  mrp: string;
}
const newRow = (): Row => ({ key: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId: '', qty: '', rate: '', gst: '0', condition: 'Sellable', batch: '', mfg: '', exp: '', mrp: '' });

function ItemPicker({ products, value, onPick, firstIds }: { products: Product[]; value: string; onPick: (id: string) => void; firstIds: Set<string> }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const chosen = products.find(p => p.id === value);
  const list = useMemo(() => {
    const q = text.trim();
    const pool = q ? products.filter(p => matchWords(q, p.name, p.brand, p.sku, p.barcode, p.product_code)) : products.filter(p => firstIds.has(p.id));
    return [...pool].sort((a, b) => Number(firstIds.has(b.id)) - Number(firstIds.has(a.id))).slice(0, 40);
  }, [products, text, firstIds]);
  return (
    <div className="relative">
      <input type="text" value={open ? text : (chosen?.name || '')} placeholder="Type item name, code or barcode"
        onFocus={() => { setOpen(true); setText(''); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm font-semibold bg-white outline-none focus:border-indigo-500" />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-300 rounded-lg shadow-xl max-h-64 overflow-y-auto text-sm">
          {list.length === 0 && <div className="px-3 py-2 text-slate-500">{text.trim() ? 'No item matches.' : 'Type to search the item list.'}</div>}
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(p.id); setText(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-indigo-50 flex justify-between gap-2">
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-slate-500 shrink-0">{firstIds.has(p.id) ? 'On bill · ' : ''}Purchase ₹{Number(p.purchase_price) || 0}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchaseReturnsView() {
  const { retailers, products, purchases, salesReturns, purchaseReturns, createDebitNote, activeCompany } = useDb() as any;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PurchaseReturn | null>(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // form
  const [partyId, setPartyId] = useState('');
  const [partyText, setPartyText] = useState('');
  const [partyOpen, setPartyOpen] = useState(false);
  const [noteType, setNoteType] = useState<'items' | 'general'>('items');
  const [purchaseId, setPurchaseId] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [discMode, setDiscMode] = useState<'pct' | 'amt'>('pct');
  const [discValue, setDiscValue] = useState('');
  const [amount, setAmount] = useState('');
  const [gstPct, setGstPct] = useState('0');
  const [description, setDescription] = useState('');

  const productById = useMemo(() => new Map<string, Product>((products as Product[]).map(p => [p.id, p])), [products]);
  const suppliers: Retailer[] = useMemo(() => (retailers as Retailer[]).filter(r => !isWalkInRetailerId(r.id) && (r as any).approval_status !== 'rejected').sort((a, b) => a.shop_name.localeCompare(b.shop_name)), [retailers]);
  const party = suppliers.find(s => s.id === partyId);
  const partyMatches = useMemo(() => {
    const q = partyText.trim();
    return (q ? suppliers.filter(s => matchWords(q, s.shop_name, s.mobile, s.gstin, s.city, s.retailer_code)) : suppliers).slice(0, 30);
  }, [suppliers, partyText]);
  const partyPurchases: Purchase[] = useMemo(() => (purchases as Purchase[])
    .filter(p => party?.linked_supplier_id && p.supplier_id === party.linked_supplier_id)
    .sort((a, b) => new Date(b.invoice_date || b.created_at).getTime() - new Date(a.invoice_date || a.created_at).getTime()), [purchases, party]);
  const purchase = partyPurchases.find(p => p.id === purchaseId);
  const billIds = useMemo(() => new Set((purchase?.items || []).map(i => i.product_id)), [purchase]);
  const creditNotes: SalesReturn[] = useMemo(() => (salesReturns as SalesReturn[])
    .filter(sr => (sr.items || []).length > 0)
    .sort((a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime()).slice(0, 60), [salesReturns]);

  const rateFor = (pid: string) => {
    const line = purchase?.items?.find(i => i.product_id === pid);
    const prod = productById.get(pid);
    if (line) {
      const units = Math.max(1, Number(line.units_per_trading_unit || line.units_per_box_carton || prod?.units_per_box_carton) || 1);
      return r2((Number(line.purchase_rate ?? line.carton_rate) || 0) / units);
    }
    return Number(prod?.purchase_price) || 0;
  };

  const setRow = (key: string, patch: Partial<Row>) => setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const pickItem = (key: string, pid: string) => {
    const prod = productById.get(pid);
    setRow(key, { productId: pid, rate: String(rateFor(pid)), gst: String(Number(prod?.gst_percent) || 0), mrp: Number(prod?.mrp) ? String(prod?.mrp) : '' });
  };

  const copyFromCreditNote = (srId: string) => {
    const sr = creditNotes.find(x => x.id === srId);
    if (!sr) return;
    const copied: Row[] = (sr.items || []).map(it => ({
      ...newRow(),
      productId: it.product_id,
      qty: String(Number(it.base_qty ?? it.quantity) || 0),
      rate: String(rateFor(it.product_id)),
      gst: String(Number(it.gst_percent ?? productById.get(it.product_id)?.gst_percent) || 0),
      condition: it.condition === 'Damaged' ? 'Damaged' : 'Sellable',
      batch: it.batch_number || '',
      mfg: it.mfg_date || '',
      exp: it.expiry_date || '',
      mrp: String(Number(it.mrp ?? productById.get(it.product_id)?.mrp) || '')
    }));
    setRows(prev => [...prev.filter(r => r.productId), ...copied]);
    if (!reason) setReason('Returned by shop');
  };

  const calc = useMemo(() => {
    if (noteType === 'general') {
      const a = Math.max(0, Number(amount) || 0);
      const g = r2(a * Math.max(0, Number(gstPct) || 0) / 100);
      return { gross: a, discount: 0, taxable: a, gst: g, total: Math.round(a + g), items: 0 };
    }
    const used = rows.filter(r => r.productId && Number(r.qty) > 0);
    const values = used.map(r => r2(Number(r.qty) * (Number(r.rate) || 0)));
    const gross = r2(values.reduce((a, b) => a + b, 0));
    const dv = Math.max(0, Number(discValue) || 0);
    const discount = r2(Math.min(gross, discMode === 'pct' ? gross * Math.min(100, dv) / 100 : dv));
    let taxable = 0; let gst = 0;
    used.forEach((r, i) => {
      const t = gross > 0 ? values[i] - discount * values[i] / gross : 0;
      taxable += t;
      gst += t * (Number(r.gst) || 0) / 100;
    });
    return { gross, discount, taxable: r2(taxable), gst: r2(gst), total: Math.round(taxable + gst), items: used.length };
  }, [noteType, amount, gstPct, rows, discMode, discValue]);

  const openForm = () => {
    setPartyId(''); setPartyText(''); setNoteType('items'); setPurchaseId(''); setReason(''); setRows([newRow()]);
    setDiscMode('pct'); setDiscValue(''); setAmount(''); setGstPct('0'); setDescription('');
    setDate(todayLocal()); setErr(''); setOpen(true);
  };

  const save = () => {
    setErr('');
    if (!partyId) return setErr('Choose the party.');
    try {
      const note: PurchaseReturn = createDebitNote({
        partyId,
        purchaseId: purchaseId || undefined,
        returnDate: new Date(`${date}T12:00:00`).toISOString(),
        reason,
        noteType,
        description,
        generalAmount: Number(amount) || 0,
        generalGstPercent: Number(gstPct) || 0,
        discount: calc.discount > 0 ? { mode: discMode, value: Number(discValue) || 0 } : undefined,
        items: rows.filter(r => r.productId && Number(r.qty) > 0).map(r => ({
          productId: r.productId,
          quantity: Number(r.qty),
          rate: Number(r.rate) || 0,
          gstPercent: Number(r.gst) || 0,
          condition: r.condition,
          batchNumber: r.batch || undefined,
          mfgDate: r.mfg || undefined,
          expiryDate: r.exp || undefined,
          mrp: Number(r.mrp) || undefined
        }))
      });
      setOpen(false);
      setView(note);
      setMsg(`Debit note ${note.debit_note_number} saved for ${party?.shop_name} · ${inr(note.total_amount || 0)}.`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e: any) {
      setErr(e?.message || 'The debit note could not be saved.');
    }
  };

  const partyName = (n: PurchaseReturn) => (retailers as Retailer[]).find(r => r.id === n.party_id || (n.supplier_id && r.linked_supplier_id === n.supplier_id))?.shop_name || 'Party';
  const list = useMemo(() => (purchaseReturns as PurchaseReturn[])
    .filter(n => n.debit_note_number)
    .map(n => ({
      id: n.id,
      number: n.debit_note_number,
      date: n.return_date,
      party: partyName(n),
      type: n.note_type === 'general' ? 'General' : 'Item-wise',
      reason: n.reason,
      bill: (purchases as Purchase[]).find(p => p.id === n.purchase_id)?.invoice_number || '',
      items: (n.items || []).length,
      total: Number(n.total_amount) || 0,
      note: n
    }))
    .filter(r => !search.trim() || matchWords(search, r.number, r.party, r.reason, r.bill, r.type))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [purchaseReturns, retailers, purchases, search]);

  const field = 'w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white outline-none focus:border-indigo-500';
  const lbl = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><FileMinus className="w-5 h-5 text-indigo-600" /> Purchase Returns &amp; Debit Notes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Goods sent back to a party (item-wise), or only an amount (general debit note).</p>
        </div>
        <button type="button" onClick={openForm} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
          <Plus className="w-4 h-4" /> New debit note
        </button>
      </div>
      {msg && <div role="status" className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold">{msg}</div>}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debit note, party, reason or bill"
        className="w-full sm:max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500" />

      <ReportTable
        hideSearch
        data={list}
        rowKey={(r: any) => r.id}
        onRowClick={(r: any) => setView(r.note)}
        emptyMessage="No debit notes yet."
        columns={[
          { header: 'Debit Note', key: 'number', render: (r: any) => <span className="font-mono font-bold">{r.number}</span> },
          { header: 'Date', key: 'date', render: (r: any) => day(r.date) },
          { header: 'Party', key: 'party', minWidth: 200 },
          { header: 'Type', key: 'type' },
          { header: 'Reason', key: 'reason' },
          { header: 'Purchase Bill', key: 'bill', render: (r: any) => r.bill || '—' },
          { header: 'Items', key: 'items', format: 'number' },
          { header: 'Amount', key: 'total', format: 'currency' }
        ]}
        totals={{ number: `${list.length} notes`, total: list.reduce((s, r) => s + r.total, 0) }}
      />

      {/* New debit note */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-labelledby="dn-title" className="w-full max-w-3xl h-full bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-900 text-white">
              <h3 id="dn-title" className="font-black">New debit note</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Party */}
              <div className="relative">
                <span className={lbl}>Party *</span>
                <input className={field} value={partyOpen ? partyText : (party?.shop_name || '')} placeholder="Type party name, mobile or GSTIN"
                  onFocus={() => { setPartyOpen(true); setPartyText(''); }} onBlur={() => setTimeout(() => setPartyOpen(false), 150)}
                  onChange={e => { setPartyText(e.target.value); setPartyOpen(true); }} />
                {partyOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-300 rounded-lg shadow-xl max-h-64 overflow-y-auto text-sm">
                    {partyMatches.length === 0 && <div className="px-3 py-2 text-slate-500">No party found. Add it on the Parties page.</div>}
                    {partyMatches.map(s => (
                      <button key={s.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setPartyId(s.id); setPurchaseId(''); setPartyOpen(false); }}
                        className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-indigo-50">
                        <span className="font-semibold">{s.shop_name}</span>
                        <span className="text-xs text-slate-500"> · {[s.city, s.gstin].filter(Boolean).join(' · ') || s.retailer_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Type */}
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type of debit note">
                {([['items', 'Item-wise', 'Goods go back, item by item'], ['general', 'General', 'Only an amount, no items']] as const).map(([v, t, d]) => (
                  <button key={v} type="button" aria-pressed={noteType === v} onClick={() => setNoteType(v)}
                    className={`text-left rounded-xl p-3 border ${noteType === v ? 'border-2 border-indigo-600 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                    <span className="block text-sm font-black">{t}</span>
                    <span className="block text-xs text-slate-500">{d}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className={lbl}>Against purchase bill <span className="font-normal text-slate-500">(optional)</span></span>
                  <select className={field} value={purchaseId} onChange={e => setPurchaseId(e.target.value)} disabled={!party}>
                    <option value="">No bill</option>
                    {partyPurchases.map(p => <option key={p.id} value={p.id}>{p.invoice_number} · {day(p.invoice_date || p.created_at)} · {inr(p.total_amount)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={lbl}>Date</span>
                  <input type="date" className={field} value={date} onChange={e => setDate(e.target.value)} />
                </label>
                <label className="block">
                  <span className={lbl}>Reason *</span>
                  <input className={field} list="dn-reasons" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Expired goods" />
                  <datalist id="dn-reasons">{REASONS.map(r => <option key={r} value={r} />)}</datalist>
                </label>
              </div>

              {noteType === 'general' ? (
                <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={lbl}>Amount before GST (₹)</span>
                      <input className={`${field} text-right`} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
                    </label>
                    <label className="block">
                      <span className={lbl}>GST %</span>
                      <select className={field} value={gstPct} onChange={e => setGstPct(e.target.value)}>
                        {['0', '5', '12', '18', '28'].map(g => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className={lbl}>What is this debit note for? <span className="font-normal text-slate-500">(optional)</span></span>
                    <input className={field} value={description} onChange={e => setDescription(e.target.value)} placeholder="For example: rate difference on bill HUL/77" />
                  </label>
                  <p className="text-xs text-slate-500">No items and no stock change.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-800">Items</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold bg-white max-w-[260px]" value="" onChange={e => copyFromCreditNote(e.target.value)} aria-label="Copy items from a credit note">
                        <option value="">Copy items from a credit note…</option>
                        {creditNotes.map(sr => (
                          <option key={sr.id} value={sr.id}>
                            {sr.credit_note_number} · {(retailers as Retailer[]).find(r => r.id === sr.retailer_id)?.shop_name || 'Shop'} · {day(sr.return_date)}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setRows(prev => [...prev, newRow()])}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-300 text-indigo-800 text-xs font-bold"><Plus className="w-3.5 h-3.5" /> Add item</button>
                    </div>
                  </div>
                  {rows.map((r, i) => {
                    const amt = r2((Number(r.qty) || 0) * (Number(r.rate) || 0));
                    return (
                      <div key={r.key} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-slate-500 pt-2.5">{i + 1}.</span>
                          <div className="flex-1"><ItemPicker products={products} value={r.productId} onPick={pid => pickItem(r.key, pid)} firstIds={billIds} /></div>
                          {rows.length > 1 && (
                            <button type="button" onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))} aria-label="Remove item" className="p-2 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <label className="block"><span className="text-[11px] font-bold text-slate-600">Qty (pcs)</span>
                            <input className={`${field} text-right`} value={r.qty} onChange={e => setRow(r.key, { qty: e.target.value })} inputMode="numeric" /></label>
                          <label className="block"><span className="text-[11px] font-bold text-slate-600">Rate (before GST)</span>
                            <input className={`${field} text-right`} value={r.rate} onChange={e => setRow(r.key, { rate: e.target.value })} inputMode="decimal" /></label>
                          <label className="block"><span className="text-[11px] font-bold text-slate-600">GST %</span>
                            <input className={`${field} text-right`} value={r.gst} onChange={e => setRow(r.key, { gst: e.target.value })} inputMode="decimal" /></label>
                          <label className="block"><span className="text-[11px] font-bold text-slate-600">From stock</span>
                            <select className={field} value={r.condition} onChange={e => setRow(r.key, { condition: e.target.value as Row['condition'] })}>
                              <option value="Sellable">Good stock</option>
                              <option value="Damaged">Damaged stock</option>
                            </select></label>
                        </div>
                        {(
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <label className="block"><span className="text-[11px] font-bold text-slate-600">Batch No.</span>
                              <input className={field} value={r.batch} onChange={e => setRow(r.key, { batch: e.target.value })} placeholder="Optional" /></label>
                            <label className="block"><span className="text-[11px] font-bold text-slate-600">Mfg Date</span>
                              <input type="date" className={field} value={r.mfg} onChange={e => setRow(r.key, { mfg: e.target.value })} /></label>
                            <label className="block"><span className="text-[11px] font-bold text-slate-600">Expiry Date</span>
                              <input type="date" className={field} value={r.exp} onChange={e => setRow(r.key, { exp: e.target.value })} /></label>
                            <label className="block"><span className="text-[11px] font-bold text-slate-600">MRP</span>
                              <input className={`${field} text-right`} value={r.mrp} onChange={e => setRow(r.key, { mrp: e.target.value })} inputMode="decimal" placeholder="Optional" /></label>
                          </div>
                        )}
                        <div className="text-right text-sm font-bold text-slate-800">Amount {inr(amt)}</div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-slate-200">
                    <div className="flex-1 min-w-[160px]">
                      <span className="text-sm font-black text-slate-800 block">Discount</span>
                      <span className="text-xs text-slate-500">Optional. Taken off the value before GST.</span>
                    </div>
                    <select className="border border-slate-300 rounded-lg px-2 py-2 text-sm font-bold bg-white" value={discMode} onChange={e => setDiscMode(e.target.value as 'pct' | 'amt')} aria-label="Discount in">
                      <option value="pct">%</option><option value="amt">₹</option>
                    </select>
                    <input className="w-24 border border-slate-300 rounded-lg px-2 py-2 text-sm text-right bg-white" value={discValue} onChange={e => setDiscValue(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Discount" />
                  </div>
                  <label className="block">
                    <span className={lbl}>Note on debit note <span className="font-normal text-slate-500">(optional)</span></span>
                    <input className={field} value={description} onChange={e => setDescription(e.target.value)} />
                  </label>
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-1.5 text-sm">
                {calc.discount > 0 && (
                  <>
                    <div className="flex justify-between text-slate-300"><span>Value before discount</span><span>{inr(calc.gross)}</span></div>
                    <div className="flex justify-between text-amber-300"><span>Discount</span><span>− {inr(calc.discount)}</span></div>
                  </>
                )}
                <div className="flex justify-between text-slate-300"><span>Taxable value</span><span>{inr(calc.taxable)}</span></div>
                <div className="flex justify-between text-slate-300"><span>GST</span><span>{inr(calc.gst)}</span></div>
                <div className="flex justify-between text-lg font-black pt-1.5 border-t border-slate-700"><span>Debit note total</span><span>₹{calc.total.toLocaleString('en-IN')}</span></div>
              </div>
              {err && <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{err}</div>}
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold">Cancel</button>
              <button type="button" onClick={save} className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Save debit note</button>
            </div>
          </div>
        </div>
      )}

      {/* View / print */}
      {view && (() => {
        const seller = getSellerDetails(activeCompany);
        const sup = (retailers as Retailer[]).find(r => r.id === view.party_id || (view.supplier_id && r.linked_supplier_id === view.supplier_id));
        const bill = (purchases as Purchase[]).find(p => p.id === view.purchase_id);
        const isGeneral = view.note_type === 'general' || (view.items || []).length === 0;
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onMouseDown={e => { if (e.target === e.currentTarget) setView(null); }}>
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl my-auto">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 print:hidden">
                <strong>Debit note {view.debit_note_number}</strong>
                <div className="flex gap-2">
                  <button type="button" onClick={() => printInvoiceDocument('printable-debit-note', `Debit Note - ${view.debit_note_number}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-bold"><Printer className="w-4 h-4" /> Print / PDF</button>
                  <button type="button" onClick={() => setView(null)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div id="printable-debit-note" className="p-6 space-y-5 text-slate-800 text-sm">
                <div className="flex flex-wrap justify-between gap-4 border-b-2 border-slate-900 pb-4">
                  <div>
                    <div className="text-xl font-black">{seller.name}</div>
                    {seller.address && <div className="text-xs text-slate-600">{seller.address}</div>}
                    <div className="text-xs text-slate-600">{seller.gstinLabel} · State: {seller.stateLabel}{seller.phone ? ` · Phone: ${seller.phone}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black tracking-widest text-indigo-700">DEBIT NOTE</div>
                    <div className="text-lg font-black font-mono">{view.debit_note_number}</div>
                    <div className="text-xs text-slate-600">Date: {day(view.return_date)}</div>
                    {bill && <div className="text-xs text-slate-600">Against purchase bill: {bill.invoice_number}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase">Party</div>
                    <div className="font-black text-base">{sup?.shop_name || 'Party'}</div>
                    <div className="text-xs text-slate-600">{[sup?.address, sup?.city].filter(Boolean).join(', ')}</div>
                  </div>
                  <div className="sm:text-right text-xs text-slate-600">
                    <div>GSTIN: <strong>{sup?.gstin || 'Unregistered'}</strong></div>
                    {sup?.mobile && <div>Mobile: <strong>{sup.mobile}</strong></div>}
                    <div>Reason: <strong>{view.reason}</strong></div>
                    {view.description && <div>Note: <strong>{view.description}</strong></div>}
                  </div>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-2 text-left">#</th><th className="p-2 text-left">Item</th><th className="p-2 text-left">HSN</th>
                      <th className="p-2 text-left">Batch No.</th><th className="p-2 text-left">Mfg Date</th><th className="p-2 text-left">Expiry Date</th>
                      <th className="p-2 text-right">MRP</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Taxable</th>
                      <th className="p-2 text-right">GST</th><th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isGeneral ? (
                      <tr className="border-b border-slate-200">
                        <td className="p-2">1</td>
                        <td className="p-2" colSpan={8}><strong>{view.description || view.reason}</strong><div className="text-[10px] text-slate-500">General debit note · no goods</div></td>
                        <td className="p-2 text-right">{inr(view.taxable_amount || 0)}</td>
                        <td className="p-2 text-right">{Number(view.gst_percent) || 0}%<div className="text-[10px]">{inr(view.gst_amount || 0)}</div></td>
                        <td className="p-2 text-right font-bold">{inr((view.taxable_amount || 0) + (view.gst_amount || 0))}</td>
                      </tr>
                    ) : (view.items || []).map((it, i) => (
                      <tr key={it.id || i} className="border-b border-slate-200 align-top">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">
                          <strong>{it.product_name || productById.get(it.product_id)?.name || 'Item'}</strong>
                          {it.condition === 'Damaged' && <div className="text-[10px] text-red-700">Damaged stock</div>}
                          {Number(it.discount_amount) > 0 && <div className="text-[10px] text-amber-700">Discount {inr(Number(it.discount_amount))}</div>}
                        </td>
                        <td className="p-2">{it.hsn || ''}</td>
                        <td className="p-2">{it.batch_number || '—'}</td>
                        <td className="p-2 whitespace-nowrap">{it.mfg_date ? day(it.mfg_date) : '—'}</td>
                        <td className="p-2 whitespace-nowrap">{it.expiry_date ? day(it.expiry_date) : '—'}</td>
                        <td className="p-2 text-right">{Number(it.mrp) ? inr(Number(it.mrp)) : '—'}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{inr(it.rate)}</td>
                        <td className="p-2 text-right">{inr(it.taxable_value || 0)}</td>
                        <td className="p-2 text-right">{Number(it.gst_percent) || 0}%<div className="text-[10px]">{inr(it.gst_amount || 0)}</div></td>
                        <td className="p-2 text-right font-bold">{inr(it.total_amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end">
                  <div className="w-full sm:w-72 space-y-1 text-sm">
                    {Number(view.discount_amount) > 0 && (
                      <>
                        <div className="flex justify-between"><span>Value before discount</span><span>{inr(view.gross_taxable || 0)}</span></div>
                        <div className="flex justify-between"><span>Discount{view.discount_percent ? ` (${view.discount_percent}%)` : ''}</span><span>− {inr(view.discount_amount || 0)}</span></div>
                      </>
                    )}
                    <div className="flex justify-between"><span>Taxable value</span><span>{inr(view.taxable_amount || 0)}</span></div>
                    {Number(view.igst) > 0
                      ? <div className="flex justify-between"><span>IGST</span><span>{inr(view.igst || 0)}</span></div>
                      : <>
                          <div className="flex justify-between"><span>CGST</span><span>{inr(view.cgst || 0)}</span></div>
                          <div className="flex justify-between"><span>SGST</span><span>{inr(view.sgst || 0)}</span></div>
                        </>}
                    {Number(view.round_off) !== 0 && <div className="flex justify-between"><span>Round off</span><span>{inr(view.round_off || 0)}</span></div>}
                    <div className="flex justify-between text-base font-black border-t border-slate-300 pt-1.5"><span>Debit note total</span><span>₹{(Number(view.total_amount) || 0).toLocaleString('en-IN')}</span></div>
                  </div>
                </div>
                <div className="flex justify-between pt-10 text-xs text-slate-500">
                  <div>Party&apos;s signature</div>
                  <div className="text-right">For {seller.name}<br />Authorised signatory</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
