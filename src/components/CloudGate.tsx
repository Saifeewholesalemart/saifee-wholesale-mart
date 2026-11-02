'use client';

import React, { useEffect, useState } from 'react';
import { useDb } from '@/context/DbContext';
import { CloudOff, RefreshCw, AlertTriangle, Database, LogOut } from 'lucide-react';

/**
 * App online-only hai: jab tak cloud connected aur data loaded na ho, ya jab internet
 * chala jaaye, ye screen app ko rok deti hai taaki koi bill/order bina cloud save ke na bane.
 */
export default function CloudGate() {
  const { isAuthenticated, cloudStatus, retryCloudConnection, syncWithCloud, logout } = useDb();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const blockingState =
    isAuthenticated &&
    (cloudStatus.state === 'connecting' ||
      cloudStatus.state === 'offline' ||
      cloudStatus.state === 'error' ||
      cloudStatus.state === 'setup_required');

  // Chhote network blips par screen na chamke: 1.5 sec tak problem rahe tabhi dikhao
  useEffect(() => {
    if (!blockingState) {
      setVisible(false);
      return;
    }
    const delay = cloudStatus.state === 'connecting' ? 300 : 1500;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [blockingState, cloudStatus.state]);

  if (!visible || !blockingState) return null;

  const retry = async () => {
    setBusy(true);
    try {
      if (cloudStatus.state === 'connecting' || cloudStatus.state === 'setup_required' || !cloudStatus.lastLoadedAt) {
        retryCloudConnection();
      } else {
        await syncWithCloud();
      }
    } catch {
      // status screen khud error dikhayegi
    } finally {
      setBusy(false);
    }
  };

  const isConnecting = cloudStatus.state === 'connecting';
  const isSetup = cloudStatus.state === 'setup_required';
  const isOffline = cloudStatus.state === 'offline';
  const loginExpired = /session has expired/i.test(cloudStatus.message);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          {isConnecting ? (
            <RefreshCw className="h-7 w-7 text-indigo-600 animate-spin" />
          ) : isSetup ? (
            <Database className="h-7 w-7 text-amber-600" />
          ) : isOffline ? (
            <CloudOff className="h-7 w-7 text-rose-600" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          )}
        </div>

        <h2 className="text-lg font-bold text-slate-900">
          {isConnecting
            ? 'Loading data from the cloud...'
            : isSetup
            ? 'Cloud setup incomplete'
            : isOffline
            ? 'No internet connection'
            : 'Unable to save to the cloud'}
        </h2>

        <p className="mt-2 text-sm text-slate-600">{cloudStatus.message}</p>

        {!isConnecting && cloudStatus.pending > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800">
            {cloudStatus.pending} change(s) are waiting to be saved to the cloud. They are kept safely on this
            device and will be saved automatically once the connection is back.
          </p>
        )}

        {!isConnecting && (
          <p className="mt-3 text-xs text-slate-500">
            Billing and new entries are paused until the cloud is connected, so that no data is lost.
          </p>
        )}

        {!isConnecting && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {loginExpired ? (
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <LogOut className="h-4 w-4" /> Log in again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void retry()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
