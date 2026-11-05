'use client';

/**
 * "Reload all data from cloud" — use when this device shows different numbers than
 * other devices. Pending changes are saved first; then the device's local copy is
 * replaced with a fresh copy from the cloud.
 */

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { requestFullCloudReload } from '@/lib/cloudWriteThrough';

export default function ReloadFromCloudCard() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    const r = await requestFullCloudReload();
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-slate-900">Reload all data from cloud</h2>
        <p className="text-sm text-slate-600">
          Use this if this device shows different numbers than another device. Nothing is deleted from the cloud.
        </p>
        {error && <p role="alert" className="text-sm font-semibold text-red-700 mt-1">{error}</p>}
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={busy}
            className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white font-semibold text-sm">Cancel</button>
          <button type="button" onClick={() => void run()} disabled={busy}
            className="min-h-11 px-4 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" /> {busy ? 'Reloading…' : 'Yes, reload now'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="min-h-11 px-4 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-800 font-bold text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Reload from cloud
        </button>
      )}
    </section>
  );
}
