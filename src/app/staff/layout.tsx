'use client';

import React from 'react';
import { useDb } from '@/context/DbContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Boxes, LogOut, Shield, ArrowLeft, User } from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, activeCompany } = useDb();
  const router = useRouter();

  const handleExit = () => {
    setCurrentUser('p-admin-1');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Staff Top Navigation Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide text-white">
                  SAIFEE WAREHOUSE OPS
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase">
                  {currentUser?.custom_role || currentUser?.role?.toUpperCase() || 'STAFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {activeCompany?.name || 'Saifee FMCG Distribution'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <div className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="text-left text-xs">
                <p className="font-bold text-slate-200 leading-tight">{currentUser?.name || 'Staff Worker'}</p>
                <p className="text-[10px] text-slate-400">{currentUser?.contact_no || currentUser?.mobile || 'Warehouse Floor'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Role Switcher floating bubble */}
      <RoleSwitcher />
    </div>
  );
}
