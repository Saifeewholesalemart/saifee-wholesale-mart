'use client';

/**
 * Parties (Vyapar style): one list and one form. There is no customer / supplier type:
 * any party can be used in sale bills, orders, purchases and debit notes.
 * Old suppliers are added here automatically.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Plus, X, Users, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useDb } from '@/context/DbContext';
import type { Retailer } from '@/lib/db';
import { isWalkInRetailerId, INDIAN_STATE_NAMES, getHomeStateCode } from '@/lib/db';
import { matchWords } from '@/lib/searchWords';
import ReportTable from '@/components/reports/ReportTable';

interface ImportResult {
  total: number;
  blank: number;
  duplicateInFile: number;
  alreadyExists: number;
  added: number;
  failed: { name: string; error: string }[];
}

const IMPORT_HEADER_ALIASES: Record<'name' | 'mobile' | 'gstin' | 'city' | 'address', string[]> = {
  name: ['party name', 'partyname', 'name', 'shop name', 'shopname', 'retailer name', 'customer name', 'supplier name', 'firm name', 'firm', 'party'],
  mobile: ['mobile', 'mobile no', 'mobile number', 'phone', 'phone no', 'contact', 'contact no', 'contact number'],
  gstin: ['gstin', 'gst no', 'gst number', 'gst'],
  city: ['city', 'town', 'place'],
  address: ['address', 'addr', 'location']
};

const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function pickImportKey(rowKeys: string[], field: keyof typeof IMPORT_HEADER_ALIASES): string | undefined {
  const aliases = IMPORT_HEADER_ALIASES[field];
  return rowKeys.find(k => aliases.includes(normKey(k)));
}

type Filter = 'all' | 'receive' | 'pay';

const inr = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface FormState {
  id?: string;
  name: string;
  contact_name: string;
  mobile: string;
  email: string;
  gstin: string;
  address: string;
  city: string;
  state_code: string;
  opening: string;
  openingSide: 'receive' | 'pay';
  credit_limit: string;
  active: boolean;
}

const blankForm = (): FormState => ({
  name: '', contact_name: '', mobile: '', email: '', gstin: '', address: '', city: '',
  state_code: getHomeStateCode(), opening: '', openingSide: 'receive', credit_limit: '', active: true
});

export default function PartiesPage() {
  const { retailers, saveParty } = useDb() as any;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const parties: Retailer[] = useMemo(
    () => (retailers as Retailer[]).filter(r => !isWalkInRetailerId(r.id) && (r as any).approval_status !== 'rejected'),
    [retailers]
  );

  const counts = useMemo(() => ({
    all: parties.length,
    receive: parties.filter(p => (Number(p.outstanding) || 0) > 0).length,
    pay: parties.filter(p => (Number(p.outstanding) || 0) < 0).length
  }), [parties]);

  const rows = useMemo(() => parties
    .filter(p => filter === 'all' || (filter === 'receive' ? (Number(p.outstanding) || 0) > 0 : (Number(p.outstanding) || 0) < 0))
    .filter(p => !search.trim() || matchWords(search, p.shop_name, p.owner_name, p.mobile, p.gstin, p.city, p.retailer_code))
    .map(p => {
      const bal = Number(p.outstanding) || 0;
      return {
        id: p.id,
        name: p.shop_name,
        code: p.retailer_code,
        mobile: p.mobile || '',
        city: p.city || '',
        gstin: p.gstin || '',
        balance: bal,
        active: p.active !== false,
        party: p
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)), [parties, filter, search]);

  const totals = useMemo(() => {
    let receive = 0; let pay = 0;
    rows.forEach(r => { if (r.balance > 0) receive += r.balance; else pay += -r.balance; });
    return { receive, pay };
  }, [rows]);

  const openNew = () => {
    setError('');
    setForm(blankForm());
  };
  const openEdit = (p: Retailer) => {
    setError('');
    const ob = Number(p.opening_balance) || 0;
    setForm({
      id: p.id,
      name: p.shop_name || '',
      contact_name: p.owner_name || '',
      mobile: p.mobile || '',
      email: p.email || '',
      gstin: p.gstin || '',
      address: p.address || '',
      city: p.city || '',
      state_code: p.state_code || getHomeStateCode(),
      opening: ob ? String(Math.abs(ob)) : '',
      openingSide: ob < 0 ? 'pay' : 'receive',
      credit_limit: p.credit_limit ? String(p.credit_limit) : '',
      active: p.active !== false
    });
  };

  const save = () => {
    if (!form) return;
    setError('');
    const amount = Math.abs(Number(form.opening) || 0);
    try {
      const saved: Retailer = saveParty({
        id: form.id,
        name: form.name,
        contact_name: form.contact_name,
        mobile: form.mobile,
        email: form.email,
        gstin: form.gstin,
        address: form.address,
        city: form.city,
        state_code: form.state_code,
        opening_balance: form.openingSide === 'pay' ? -amount : amount,
        credit_limit: Number(form.credit_limit) || 0,
        active: form.active
      });
      setForm(null);
      setMessage(`${saved.shop_name} saved.`);
      setTimeout(() => setMessage(''), 4000);
    } catch (e: any) {
      setError(e?.message || 'The party could not be saved.');
    }
  };

  const handleImportFile = async (file: File) => {
    setImportBusy(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const keys = rows.length ? Object.keys(rows[0]) : [];
      const nameKey = pickImportKey(keys, 'name') || keys[0];
      const mobileKey = pickImportKey(keys, 'mobile');
      const gstinKey = pickImportKey(keys, 'gstin');
      const cityKey = pickImportKey(keys, 'city');
      const addressKey = pickImportKey(keys, 'address');

      const existingNames = new Set(
        (retailers as Retailer[]).filter(r => !isWalkInRetailerId(r.id)).map(r => r.shop_name.trim().toLowerCase())
      );
      const seenInFile = new Set<string>();
      let blank = 0, duplicateInFile = 0, alreadyExists = 0, added = 0;
      const failed: { name: string; error: string }[] = [];

      for (const row of rows) {
        const rawName = nameKey ? String(row[nameKey] ?? '').trim() : '';
        if (!rawName) { blank++; continue; }
        const key = rawName.toLowerCase();
        if (seenInFile.has(key)) { duplicateInFile++; continue; }
        seenInFile.add(key);
        if (existingNames.has(key)) { alreadyExists++; continue; }
        const mobile = mobileKey ? String(row[mobileKey] ?? '').trim() : '';
        const gstin = gstinKey ? String(row[gstinKey] ?? '').trim() : '';
        const city = cityKey ? String(row[cityKey] ?? '').trim() : '';
        const address = addressKey ? String(row[addressKey] ?? '').trim() : '';
        try {
          saveParty({ name: rawName, mobile, gstin, city, address });
          existingNames.add(key);
          added++;
        } catch {
          // The row's mobile/GSTIN may not be valid — retry with just the name.
          try {
            saveParty({ name: rawName });
            existingNames.add(key);
            added++;
          } catch (e2: any) {
            failed.push({ name: rawName, error: e2?.message || 'Could not be saved.' });
          }
        }
      }
      setImportResult({ total: rows.length, blank, duplicateInFile, alreadyExists, added, failed });
    } catch (e: any) {
      setImportResult({ total: 0, blank: 0, duplicateInFile: 0, alreadyExists: 0, added: 0, failed: [{ name: '(file)', error: e?.message || 'Could not read the file.' }] });
    } finally {
      setImportBusy(false);
    }
  };

  const set = (patch: Partial<FormState>) => setForm(f => (f ? { ...f, ...patch } : f));
  const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white';
  const label = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Parties</h2>
          <p className="text-xs text-slate-500 mt-0.5">All parties in one list. Any party can be used for sales, purchases and returns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setImportResult(null); setImportOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold">
            <Upload className="w-4 h-4" /> Import parties
          </button>
          <button type="button" onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
            <Plus className="w-4 h-4" /> Add party
          </button>
        </div>
      </div>

      {message && <div role="status" className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold">{message}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Parties</div>
          <div className="text-xl font-black text-slate-900">{counts.all}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase">To receive</div>
          <div className="text-xl font-black text-emerald-700">{inr(totals.receive)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase">To pay</div>
          <div className="text-xl font-black text-red-700">{inr(totals.pay)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1" role="group" aria-label="Show">
          {([['all', 'All'], ['receive', 'To receive'], ['pay', 'To pay']] as [Filter, string][]).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-bold ${filter === v ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              {t} <span className={filter === v ? 'text-indigo-200' : 'text-slate-400'}>{counts[v]}</span>
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, mobile, GSTIN, city or code"
          className="flex-1 min-w-[220px] border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500" />
      </div>

      <ReportTable
        hideSearch
        data={rows}
        rowKey={(r: any) => r.id}
        onRowClick={(r: any) => openEdit(r.party)}
        emptyMessage={search ? 'No party matches the search.' : 'No parties yet. Add one with "Add party".'}
        columns={[
          { header: 'Party Name', key: 'name', minWidth: 240,
            render: (r: any) => (
              <div>
                <div className={`font-semibold ${r.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{r.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">{r.code}</div>
              </div>
            ) },
          { header: 'Mobile', key: 'mobile' },
          { header: 'City', key: 'city' },
          { header: 'GSTIN', key: 'gstin', render: (r: any) => <span className="font-mono text-xs">{r.gstin || '—'}</span> },
          { header: 'Balance', key: 'balance', format: 'currency',
            render: (r: any) => r.balance === 0
              ? <span className="text-slate-400">₹0.00</span>
              : <span className={`font-bold ${r.balance > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{inr(r.balance)} <span className="text-[11px] font-semibold">{r.balance > 0 ? 'to receive' : 'to pay'}</span></span> }
        ]}
      />

      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
          onMouseDown={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div role="dialog" aria-labelledby="party-form-title" className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h3 id="party-form-title" className="text-base font-black text-slate-900">{form.id ? 'Edit party' : 'Add party'}</h3>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="sm:col-span-2 block">
                  <span className={label}>Party name *</span>
                  <input className={input} value={form.name} onChange={e => set({ name: e.target.value })} autoFocus />
                </label>
                <label className="block">
                  <span className={label}>Contact person</span>
                  <input className={input} value={form.contact_name} onChange={e => set({ contact_name: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>Mobile</span>
                  <input className={input} value={form.mobile} onChange={e => set({ mobile: e.target.value })} inputMode="tel" />
                </label>
                <label className="block">
                  <span className={label}>GSTIN</span>
                  <input className={`${input} uppercase font-mono`} value={form.gstin} maxLength={15}
                    onChange={e => {
                      const g = e.target.value.toUpperCase();
                      const code = g.slice(0, 2);
                      set({ gstin: g, ...(INDIAN_STATE_NAMES[code] ? { state_code: code } : {}) });
                    }} />
                </label>
                <label className="block">
                  <span className={label}>Email</span>
                  <input className={input} value={form.email} onChange={e => set({ email: e.target.value })} type="email" />
                </label>
                <label className="sm:col-span-2 block">
                  <span className={label}>Address</span>
                  <input className={input} value={form.address} onChange={e => set({ address: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>City</span>
                  <input className={input} value={form.city} onChange={e => set({ city: e.target.value })} />
                </label>
                <label className="block">
                  <span className={label}>State</span>
                  <select className={input} value={form.state_code} onChange={e => set({ state_code: e.target.value })}>
                    {Object.entries(INDIAN_STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                      <option key={code} value={code}>{name} ({code})</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <span className={label}>Opening balance</span>
                  <div className="flex gap-2">
                    <input className={`${input} text-right`} value={form.opening} onChange={e => set({ opening: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label="Opening balance amount" />
                    <select className="border border-slate-300 rounded-lg px-2 text-sm font-bold bg-white" value={form.openingSide}
                      onChange={e => set({ openingSide: e.target.value as 'receive' | 'pay' })} aria-label="Opening balance is">
                      <option value="receive">To receive</option>
                      <option value="pay">To pay</option>
                    </select>
                  </div>
                  <span className="text-[11px] text-slate-500">Money the party owed us (to receive) or we owed them (to pay) before using this app.</span>
                </div>
                <label className="block">
                  <span className={label}>Credit limit</span>
                  <input className={`${input} text-right`} value={form.credit_limit} onChange={e => set({ credit_limit: e.target.value })} inputMode="decimal" placeholder="0 = no limit" />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.active} onChange={e => set({ active: e.target.checked })} className="w-4 h-4" />
                  Active
                </label>
              </div>

              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                Shop app login, beat and category access are set in <Link href="/admin/profiles" className="font-bold text-indigo-700 underline">Manage Profiles</Link>.
              </p>
              {error && <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{error}</div>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700">Cancel</button>
              <button type="button" onClick={save} className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Save party</button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
          onMouseDown={e => { if (e.target === e.currentTarget && !importBusy) setImportOpen(false); }}>
          <div role="dialog" aria-labelledby="import-parties-title" className="w-full max-w-lg bg-white rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h3 id="import-parties-title" className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> Import parties
              </h3>
              <button type="button" onClick={() => { if (!importBusy) setImportOpen(false); }} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!importResult && (
                <>
                  <p className="text-sm text-slate-600">
                    Upload an Excel (.xlsx, .xls) or CSV file with the party name in each row — for example a
                    column called &quot;Party Name&quot;. If the file also has Mobile, GSTIN, City or Address
                    columns, those are picked up too. Parties already in your list, and blank rows, are
                    skipped automatically.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    disabled={importBusy}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
                    className="block w-full text-sm text-slate-700 border border-slate-300 rounded-lg px-3 py-2 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-bold file:text-sm"
                  />
                  {importBusy && <p className="text-sm text-indigo-700 font-semibold">Importing…</p>}
                </>
              )}
              {importResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" /> {importResult.added} new {importResult.added === 1 ? 'party' : 'parties'} added.
                  </div>
                  <div className="text-sm text-slate-600 space-y-0.5">
                    <p>Rows in file: {importResult.total}</p>
                    <p>Already in your list (skipped): {importResult.alreadyExists}</p>
                    <p>Repeated in the file (skipped): {importResult.duplicateInFile}</p>
                    <p>Blank rows (skipped): {importResult.blank}</p>
                  </div>
                  {importResult.failed.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-900">
                      <div className="flex items-center gap-1.5 font-bold mb-1"><AlertTriangle className="w-4 h-4" /> Could not add {importResult.failed.length}:</div>
                      <ul className="list-disc pl-5 space-y-0.5 max-h-32 overflow-y-auto">
                        {importResult.failed.map((f, i) => <li key={i}>{f.name} — {f.error}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button type="button" disabled={importBusy} onClick={() => { setImportOpen(false); setImportResult(null); }}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 disabled:opacity-50">
                {importResult ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
