'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';

/**
 * Header me chhota cloud status:
 *  - "Saved"           sab cloud me save hai
 *  - "Saving (n)"      changes abhi cloud me ja rahe hain
 *  - "Offline (n)"     internet nahi, n changes baaki
 *  - "Cloud error"     cloud ne save mana kiya (click karke retry)
 * Click karne par: pending changes save + doosre devices ke naye changes load.
 */
export function CloudSyncStatusButton({ className = '' }: { className?: string }) {
  const { cloudStatus, syncWithCloud } = useDb();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const state = cloudStatus.state;
  const isBusy = isManualSyncing || state === 'saving' || state === 'connecting';

  const handleClick = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await syncWithCloud();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2500);
    } catch (e: any) {
      alert(`Cloud: ${e?.message || 'Could not save. Please check your internet connection.'}`);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const label = isManualSyncing
    ? 'Syncing...'
    : state === 'connecting'
    ? 'Connecting...'
    : state === 'saving'
    ? `Saving${cloudStatus.pending > 0 ? ` (${cloudStatus.pending})` : '...'}`
    : state === 'offline'
    ? `Offline${cloudStatus.pending > 0 ? ` (${cloudStatus.pending})` : ''}`
    : state === 'error' || state === 'setup_required'
    ? 'Cloud error'
    : justSynced
    ? 'Up to date'
    : state === 'ready'
    ? 'Saved'
    : 'Cloud';

  const tone = isBusy
    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
    : state === 'offline'
    ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
    : state === 'error' || state === 'setup_required'
    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
    : state === 'ready'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200';

  const title = [
    cloudStatus.message,
    cloudStatus.lastSavedAt ? `Last saved: ${new Date(cloudStatus.lastSavedAt).toLocaleTimeString('en-IN')}` : '',
    cloudStatus.lastLoadedAt ? `Last refreshed: ${new Date(cloudStatus.lastLoadedAt).toLocaleTimeString('en-IN')}` : '',
    'Click: save pending changes + load latest from cloud'
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isManualSyncing}
      title={title}
      className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${tone} ${className}`}
    >
      {isBusy ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : state === 'offline' ? (
        <CloudOff className="w-3.5 h-3.5" />
      ) : state === 'error' || state === 'setup_required' ? (
        <AlertCircle className="w-3.5 h-3.5" />
      ) : state === 'ready' ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Cloud className="w-3.5 h-3.5" />
      )}
      <span className="truncate max-w-[120px]">{label}</span>
    </button>
  );
}
