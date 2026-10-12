'use client';

import React from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { Boxes, LogOut, ArrowLeft } from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser } = useDb();
  const router = useRouter();

  const handleExit = () => {
    setCurrentUser('p-admin-1');
    router.push('/');
  };

  const workerName = currentUser?.name?.split(' ')[0] || 'Ramesh';
  const workerRole = currentUser?.custom_role || (currentUser?.role === 'staff' ? 'Packer' : 'Staff');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* 1. ISOLATED MOBILE APP BAR (TOP STICKY HEADER - HEIGHT ~54px) */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shadow-md border-b border-slate-800">
        {/* Left: Store mini-avatar + "Saifee Ops" */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-xs">
            <Boxes className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">Saifee Ops</span>
        </div>

        {/* Center: Worker Chip: "Ramesh (Packer)" in a subtle pill */}
        <div className="flex items-center gap-1.5 bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded-full border border-slate-700/60 font-medium shrink-0">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="truncate max-w-[120px] sm:max-w-none">{workerName} ({workerRole})</span>
        </div>

        {/* Right: Shift/Status indicator (green dot + "Active") and Logout/Back button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xs:flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-md text-[11px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Active</span>
          </div>

          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Exit / Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {children}
      </main>

      {/* Role Switcher floating bubble */}
      <RoleSwitcher />
    </div>
  );
}
