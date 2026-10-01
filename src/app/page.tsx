'use client';

import React, { useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Smartphone, Store, ArrowRight, Package, Zap, Boxes } from 'lucide-react';

export default function Home() {
  const { currentUser, setCurrentUser, profiles } = useDb();
  const router = useRouter();

  const selectRole = (profileId: string) => {
    setCurrentUser(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      if (profile.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (profile.role === 'sales_dist' || profile.role === 'sales_co') {
        router.push('/sales/dashboard');
      } else if (profile.role === 'retailer') {
        router.push('/retailer/dashboard');
      } else if (profile.role === 'staff' || profile.profile_type === 'STAFF') {
        router.push('/staff/dashboard');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-6xl space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl shadow-indigo-100 shadow-lg text-white mb-1">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Saifee General Stores
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto">
            FMCG Wholesale Distribution &amp; Trade Terminal &mdash; Prototype Demo
          </p>
        </div>

        {/* Featured Flagship: Fast Trade Terminal Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 rounded-2xl p-6 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-widest">
                FLAGSHIP COUNTER POS
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                KEYBOARD-FIRST &bull; ZERO MOUSE
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
              <span>Fast Trade Terminal (Wholesale Counter)</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Ultra-fast billing screen engineered for FMCG trade operators. Supports dual carton + loose piece entries, barcode scanning, auto-focus keyboard chains (F2 Customer, Enter chain, F10 Save &amp; Print), and credit control gatekeeper.
            </p>
          </div>
          <Link
            href="/admin/terminal"
            onClick={() => setCurrentUser('p-admin-1')}
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <span>LAUNCH TERMINAL ⚡</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
          {/* Admin Deck Card */}
          <div className="erp-card bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between h-84 shadow-xs hover:border-indigo-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Distributor Admin</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Central command panel for owners. Manage products, purchases, stock ledgers, order consolidation, and backups.
              </p>
            </div>
            <Link
              href="/admin/dashboard"
              onClick={() => setCurrentUser('p-admin-1')}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
            >
              <span>Enter Admin ERP</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Salesperson Deck Card */}
          <div className="erp-card bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between h-84 shadow-xs hover:border-cyan-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 mb-3">
                <Smartphone className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Salesperson Cockpit</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Mobile-first sales ordering. Access retailers list, place box/carton orders, and track order histories.
              </p>
            </div>
            <div className="space-y-1.5 mt-4">
              <Link
                href="/sales/dashboard"
                onClick={() => setCurrentUser('p-dist-sales-1')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                <span>Distributor Sales</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/sales/dashboard"
                onClick={() => setCurrentUser('p-co-sales-1')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
              >
                <span>Company Sales</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Warehouse Staff / Packer Card */}
          <div className="erp-card bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between h-84 shadow-xs hover:border-amber-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
                <Boxes className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Warehouse Staff &amp; Packer</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Floor worker &amp; packer terminal. View confirmed packing queues, verify item carton counts, and seal boxes for dispatch.
              </p>
            </div>
            <Link
              href="/staff/dashboard"
              onClick={() => {
                const staffProfile = profiles.find(p => p.role === 'staff' || p.profile_type === 'STAFF');
                if (staffProfile) setCurrentUser(staffProfile.id);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-slate-950 rounded-lg text-xs font-black hover:bg-amber-400 active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <span>Enter Packer Cockpit 📦</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Retailer Deck Card */}
          <div className="erp-card bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between h-84 shadow-xs hover:border-emerald-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                <Store className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Retailer Portal</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Self-ordering app for retail shops. Browse catalog prices, submit carton orders, and check outstanding statements.
              </p>
            </div>
            <Link
              href="/retailer/dashboard"
              onClick={() => {
                const retProfile = profiles.find(p => p.role === 'retailer');
                if (retProfile) setCurrentUser(retProfile.id);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              <span>Enter Shop Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="text-center pt-8 text-xs text-slate-500 font-medium">
          Tip: You can change user profiles at any time using the floating role switcher bubble in the bottom right corner.
        </div>
      </div>
    </div>
  );
}
