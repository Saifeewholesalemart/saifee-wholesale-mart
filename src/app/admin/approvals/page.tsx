'use client';

/**
 * Admin: Shop Approvals
 * Shops registered by the shop owner (from the login page) or by a salesman wait here.
 * Approve = shop becomes active and its login works. Reject = shop stays inactive, login blocked.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Store, Phone, MapPin, UserRound } from 'lucide-react';

interface PendingShop {
  retailer_id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  mobile: string;
  city: string;
  address: string;
  gstin: string | null;
  credit_limit: number;
  registered_by: string;
  registered_by_name: string | null;
  registered_at: string;
  has_login: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ShopApprovalsPage() {
  const [shops, setShops] = useState<PendingShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credit, setCredit] = useState<Record<string, string>>({});
  const [confirmReject, setConfirmReject] = useState<PendingShop | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop-approvals', { credentials: 'same-origin', cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not load shops.');
      setShops(json.shops || []);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load shops.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (shop: PendingShop, action: 'approve' | 'reject') => {
    setBusyId(shop.retailer_id);
    setNotice('');
    try {
      const raw = credit[shop.retailer_id];
      const res = await fetch('/api/admin/shop-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          retailer_id: shop.retailer_id,
          action,
          credit_limit: action === 'approve' && raw !== undefined && raw !== '' ? Number(raw) : null
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save.');
      setNotice(action === 'approve'
        ? `${shop.shop_name} approved.${shop.has_login ? ' The shop can log in now.' : ''}`
        : `${shop.shop_name} rejected.`);
      setConfirmReject(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = shops.filter(s => s.approval_status === 'pending');
  const rejected = shops.filter(s => s.approval_status === 'rejected');

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Shop Approvals</h1>
          <p className="text-sm text-slate-600">
            New shops registered by the shop owner or by a salesman. Check the details, then approve or reject.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {notice && <div role="status" className="text-sm font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</div>}

      {loading && shops.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-2" aria-hidden="true" />
          No shops waiting for approval.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map(s => (
            <article key={s.retailer_id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Store className="w-4 h-4 text-indigo-700" aria-hidden="true" /> {s.shop_name}
                    <span className="font-mono text-xs text-slate-500">{s.retailer_code}</span>
                  </h2>
                  <p className="text-sm text-slate-700">{s.owner_name}</p>
                </div>
                <span className="text-xs font-semibold text-slate-600 self-start">
                  {s.registered_by === 'self' ? 'Registered by the shop' : `Registered by salesman ${s.registered_by_name || ''}`.trim()} · {when(s.registered_at)}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <div className="flex gap-2"><Phone className="w-4 h-4 text-slate-500 mt-0.5" aria-hidden="true" /><dd><a className="text-indigo-800 font-semibold underline" href={`tel:+91${s.mobile}`}>{s.mobile}</a></dd></div>
                <div className="flex gap-2"><MapPin className="w-4 h-4 text-slate-500 mt-0.5" aria-hidden="true" /><dd className="text-slate-800">{s.address}{s.city ? `, ${s.city}` : ''}</dd></div>
                <div className="flex gap-2"><dt className="text-slate-500">GSTIN:</dt><dd className="font-mono">{s.gstin || 'Not given'}</dd></div>
                <div className="flex gap-2"><UserRound className="w-4 h-4 text-slate-500 mt-0.5" aria-hidden="true" /><dd>{s.has_login ? 'Has app login (active after approval)' : 'No app login (salesman takes orders)'}</dd></div>
              </dl>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Credit limit (₹)
                  <input type="number" min={0} inputMode="numeric"
                    value={credit[s.retailer_id] ?? String(s.credit_limit || 50000)}
                    onChange={e => setCredit(c => ({ ...c, [s.retailer_id]: e.target.value }))}
                    className="w-40 min-h-11 border border-slate-300 rounded-lg px-3 text-sm" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={busyId === s.retailer_id} onClick={() => setConfirmReject(s)}
                    className="min-h-11 px-4 rounded-lg border border-red-200 text-red-800 font-bold text-sm hover:bg-red-50 disabled:opacity-60 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" aria-hidden="true" /> Reject
                  </button>
                  <button type="button" disabled={busyId === s.retailer_id} onClick={() => void decide(s, 'approve')}
                    className="min-h-11 px-5 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold text-sm disabled:opacity-60 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {busyId === s.retailer_id ? 'Saving…' : 'Approve'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-700">Rejected in the last 30 days</h2>
          {rejected.map(s => (
            <div key={s.retailer_id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap justify-between items-center gap-2 text-sm">
              <span><strong>{s.shop_name}</strong> · {s.owner_name} · {s.mobile}</span>
              <button type="button" disabled={busyId === s.retailer_id} onClick={() => void decide(s, 'approve')}
                className="min-h-10 px-3 rounded-lg border border-slate-300 font-semibold disabled:opacity-60">Approve now</button>
            </div>
          ))}
        </section>
      )}

      {confirmReject && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setConfirmReject(null)} aria-hidden="true" />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4">
            <h2 id="reject-title" className="text-base font-bold text-slate-900">Reject {confirmReject.shop_name}?</h2>
            <p className="text-sm text-slate-600">The shop will not be able to log in. You can still approve it later from this page.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmReject(null)} className="min-h-11 px-4 rounded-lg border border-slate-300 font-semibold">Cancel</button>
              <button type="button" disabled={busyId === confirmReject.retailer_id} onClick={() => void decide(confirmReject, 'reject')}
                className="min-h-11 px-5 rounded-lg bg-red-700 text-white font-bold disabled:opacity-60">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
