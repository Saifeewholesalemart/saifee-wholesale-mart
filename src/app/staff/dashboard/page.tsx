'use client';

/**
 * Staff screen (simple flow).
 * Packer sees only "To Pack". Biller sees only "Ready to Bill".
 * Admins (or staff without a clear role) can switch between the two.
 * The previous staff screen is still available at /staff/legacy.
 */

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import PackerPanel from '@/components/flow/PackerPanel';
import BillerPanel from '@/components/flow/BillerPanel';

export default function StaffDashboardPage() {
  const { currentUser } = useDb();
  const role = String(currentUser?.custom_role || '').toLowerCase();
  const isAdmin = currentUser?.role === 'admin';
  const isBiller = role.includes('biller');
  const isPacker = role.includes('packer');
  const canSwitch = isAdmin || (!isBiller && !isPacker);
  const [view, setView] = useState<'packer' | 'biller'>(isBiller ? 'biller' : 'packer');
  const showBiller = canSwitch ? view === 'biller' : isBiller;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{showBiller ? 'Ready to Bill' : 'To Pack'}</h1>
        {canSwitch && (
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1" role="group" aria-label="Switch screen">
            <button
              type="button"
              aria-pressed={!showBiller}
              onClick={() => setView('packer')}
              className={`min-h-10 px-4 rounded-md text-sm font-bold ${!showBiller ? 'bg-indigo-700 text-white' : 'text-slate-700'}`}
            >
              Packer
            </button>
            <button
              type="button"
              aria-pressed={showBiller}
              onClick={() => setView('biller')}
              className={`min-h-10 px-4 rounded-md text-sm font-bold ${showBiller ? 'bg-indigo-700 text-white' : 'text-slate-700'}`}
            >
              Biller
            </button>
          </div>
        )}
      </div>
      {showBiller ? <BillerPanel /> : <PackerPanel compact />}
    </div>
  );
}
