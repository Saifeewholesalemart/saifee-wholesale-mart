'use client';

/**
 * Public shop registration.
 * The shop owner fills this form; the account stays pending until the admin approves it.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Store, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const inputCls = 'w-full min-h-12 px-3.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 outline-none text-[15px]';
const labelCls = 'text-xs font-bold uppercase tracking-wide text-slate-300';

export default function RegisterShopPage() {
  const [form, setForm] = useState({ shop_name: '', owner_name: '', mobile: '', city: '', address: '', gstin: '', password: '', confirm: '', website: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setError('');
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const mobile = form.mobile.replace(/[^0-9]/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) { setError('Please enter a valid 10-digit mobile number.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: form.shop_name, owner_name: form.owner_name, mobile, city: form.city,
          address: form.address, gstin: form.gstin, password: form.password, website: form.website
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Registration could not be completed. Please try again.');
      } else {
        setDone(true);
      }
    } catch {
      setError('No internet connection. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col">
      <div className="flex-1 flex justify-center px-4 py-8">
        <div className="w-full max-w-md flex flex-col gap-5">
          <div className="text-center flex flex-col items-center gap-2">
            <div className="p-3 bg-indigo-600 rounded-2xl"><Store className="w-7 h-7 text-white" aria-hidden="true" /></div>
            <h1 className="text-2xl font-black text-white">Register your shop</h1>
            <p className="text-sm text-slate-400">Saifee Wholesale Mart, Khachrod</p>
          </div>

          {done ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" aria-hidden="true" />
              <h2 className="text-lg font-bold text-white">Registration received</h2>
              <p className="text-sm text-slate-300">
                Saifee Wholesale Mart will check your details and activate your account. After that you can log in with
                your mobile number and the password you just set.
              </p>
              <Link href="/" className="mt-2 min-h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center">
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4" noValidate>
              {error && (
                <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-300 text-sm font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> <span>{error}</span>
                </div>
              )}
              <label className="flex flex-col gap-1.5"><span className={labelCls}>Shop name *</span>
                <input className={inputCls} value={form.shop_name} onChange={set('shop_name')} required autoComplete="organization" />
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>Owner name *</span>
                <input className={inputCls} value={form.owner_name} onChange={set('owner_name')} required autoComplete="name" />
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>Mobile number *</span>
                <input className={inputCls} value={form.mobile} onChange={set('mobile')} required inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile" />
                <span className="text-xs text-slate-400">You will log in with this number.</span>
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>City / village *</span>
                <input className={inputCls} value={form.city} onChange={set('city')} required autoComplete="address-level2" />
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>Shop address *</span>
                <textarea className={`${inputCls} py-3 min-h-20`} value={form.address} onChange={set('address')} required autoComplete="street-address" />
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>GSTIN (optional)</span>
                <input className={inputCls} value={form.gstin} onChange={set('gstin')} autoCapitalize="characters" placeholder="Leave empty if you don't have one" />
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>Password *</span>
                <span className="relative">
                  <input className={`${inputCls} pr-12`} type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required autoComplete="new-password" placeholder="At least 6 characters" />
                  <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-10 min-w-10 flex items-center justify-center text-slate-400">
                    {showPw ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1.5"><span className={labelCls}>Confirm password *</span>
                <input className={inputCls} type={showPw ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
              </label>
              {/* Hidden from people; bots fill it */}
              <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden="true" />
              <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-base">
                {busy ? 'Sending…' : 'Register shop'}
              </button>
              <p className="text-xs text-slate-400 text-center">Your account will be active after Saifee Wholesale Mart approves it.</p>
            </form>
          )}

          <Link href="/" className="self-center min-h-11 px-3 text-sm font-semibold text-indigo-300 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
