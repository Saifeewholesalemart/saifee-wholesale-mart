'use client';

import React from 'react';
import { useDb } from '@/context/DbContext';
import { Building2, Loader2 } from 'lucide-react';

export function CompanySwitchingOverlay() {
  const { isSwitchingCompany, activeCompany } = useDb();

  if (!isSwitchingCompany) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-150">
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-slate-900 rounded-full shadow-md">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Switching Workspace
          </h3>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
            {activeCompany?.name || 'Loading Business...'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Loading catalog, inventory & accounts...
          </p>
        </div>
      </div>
    </div>
  );
}
