'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { Cloud, CloudCheck, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';

export function CloudSyncStatusButton({ className = '' }: { className?: string }) {
  const { cloudSyncStatus, syncWithCloud, isCloudSyncConfigured } = useDb();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const isSyncing = isManualSyncing || cloudSyncStatus.state === 'syncing';

  const handleSyncClick = async () => {
    if (isSyncing || !isCloudSyncConfigured) return;
    setIsManualSyncing(true);
    try {
      await syncWithCloud();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3000);
    } catch (e) {
      console.warn('Manual sync failed:', e);
    } finally {
      setIsManualSyncing(false);
    }
  };

  if (!isCloudSyncConfigured) {
    return (
      <div 
        title="Supabase not configured. Operating in local storage mode."
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold select-none ${className}`}
      >
        <CloudOff className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden sm:inline">Offline Mode</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSyncClick}
      disabled={isSyncing}
      title={
        cloudSyncStatus.lastSyncedAt
          ? `Last synced to Cloud: ${new Date(cloudSyncStatus.lastSyncedAt).toLocaleTimeString('en-IN')}. Click to re-sync now.`
          : 'Connected to Supabase. Click to synchronize now.'
      }
      className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
        isSyncing
          ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-xs'
          : cloudSyncStatus.state === 'error'
          ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
          : justSynced || cloudSyncStatus.state === 'synced'
          ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 shadow-xs'
          : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
      } ${className}`}
    >
      {isSyncing ? (
        <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
      ) : cloudSyncStatus.state === 'error' ? (
        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
      ) : justSynced ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Cloud className="w-3.5 h-3.5 text-emerald-600" />
      )}

      <span className="hidden xs:inline truncate max-w-[120px]">
        {isSyncing
          ? 'Syncing...'
          : cloudSyncStatus.state === 'error'
          ? 'Sync Pending'
          : justSynced
          ? 'Synced!'
          : 'Cloud Synced'}
      </span>

      {/* Pulse indicator when live synced */}
      <span className="relative flex h-2 w-2 ml-0.5">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isSyncing
              ? 'bg-indigo-400'
              : cloudSyncStatus.state === 'error'
              ? 'bg-amber-400'
              : 'bg-emerald-400'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isSyncing
              ? 'bg-indigo-600'
              : cloudSyncStatus.state === 'error'
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
        />
      </span>
    </button>
  );
}
