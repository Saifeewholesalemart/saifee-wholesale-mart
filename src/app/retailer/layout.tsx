'use client';

import React from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Store, Lock, Building2, User } from 'lucide-react';

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  const { currentUser } = useDb();
  const router = useRouter();

  // Check role-based access restrictions
  const isAdminOrStaff = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'sales_dist' ||
    currentUser.role === 'sales_co' ||
    (currentUser as any).role === 'superuser'
  );

  if (isAdminOrStaff) {
    const isSales = currentUser.role === 'sales_dist' || currentUser.role === 'sales_co';
    const fallbackPath = isSales ? '/sales/dashboard' : '/admin/dashboard';
    const fallbackLabel = isSales ? 'Return to Sales Cockpit' : 'Return to Admin ERP Dashboard';

    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50 min-h-screen">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Lock / Warning Icon */}
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 inline-block">
              403 Forbidden &bull; Access Denied
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Retailer Portal Restricted
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              The Retailer PWA storefront is strictly restricted to registered retail shop customer accounts.
            </p>
          </div>

          {/* Active Session Info Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Current Authenticated Session
            </span>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
                {isSales ? <Building2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                <p className="text-[11px] font-mono text-slate-500 font-semibold uppercase">
                  Role: {currentUser.role.toUpperCase()}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
              Administrative accounts cannot browse or place orders through the retail customer channel.
            </p>
          </div>

          {/* Return Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => router.push(fallbackPath)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{fallbackLabel}</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {children}
    </div>
  );
}
