'use client';

/**
 * Duty bar for the salesman app: Start Duty / End Duty and location status.
 * First time, the salesman must read and accept the location-sharing notice.
 */

import React, { useState } from 'react';
import { MapPin, Power, ShieldCheck } from 'lucide-react';
import { useSalesTracking, giveConsent, startDuty, endDuty } from '@/lib/salesTracking';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

function clock(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function DutyBar({ userId }: { userId: string | null | undefined }) {
  const t = useSalesTracking(userId);
  const [showNotice, setShowNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!userId) return null;

  const onStart = async () => {
    if (!t.consent) { setShowNotice(true); return; }
    setBusy(true);
    await startDuty();
    setBusy(false);
  };

  const onAgree = async () => {
    giveConsent();
    setShowNotice(false);
    setBusy(true);
    await startDuty();
    setBusy(false);
  };

  const onEnd = async () => {
    setBusy(true);
    await endDuty();
    setBusy(false);
    setConfirmEnd(false);
  };

  return (
    <>
      <section
        aria-label="Duty and location"
        className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${t.onDuty ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
      >
        <div className="min-w-0 flex items-start gap-2">
          <MapPin className={`w-5 h-5 mt-0.5 shrink-0 ${t.onDuty ? 'text-emerald-700' : 'text-slate-500'}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {t.onDuty ? `On duty since ${clock(t.dutyStartedAt)}` : 'Off duty'}
            </p>
            <p className="text-xs text-slate-600">
              {t.onDuty
                ? (t.lastSentAt ? `Location shared ${timeAgo(t.lastSentAt)}. Keep this app open.` : 'Getting location…')
                : 'Press Start Duty when you begin your round.'}
              {t.queued > 0 ? ` (${t.queued} waiting to send)` : ''}
            </p>
            {t.error && <p role="alert" className="text-xs font-semibold text-red-700 mt-0.5">{t.error}</p>}
          </div>
        </div>
        {t.onDuty ? (
          <button type="button" disabled={busy} onClick={() => setConfirmEnd(true)}
            className="shrink-0 min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-800 disabled:opacity-60">
            End Duty
          </button>
        ) : (
          <button type="button" disabled={busy || !t.supported} onClick={onStart}
            className="shrink-0 min-h-11 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
            <Power className="w-4 h-4" aria-hidden="true" /> {busy ? 'Starting…' : 'Start Duty'}
          </button>
        )}
      </section>

      {confirmEnd && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="end-duty-title">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setConfirmEnd(false)} aria-hidden="true" />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4">
            <h2 id="end-duty-title" className="text-base font-bold text-slate-900">End duty for today?</h2>
            <p className="text-sm text-slate-600">Location sharing will stop until you press Start Duty again.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmEnd(false)} className="min-h-11 px-4 rounded-lg border border-slate-300 font-semibold">Cancel</button>
              <button type="button" disabled={busy} onClick={onEnd} className="min-h-11 px-5 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-60">End Duty</button>
            </div>
          </div>
        </div>
      )}

      {showNotice && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="loc-notice-title">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setShowNotice(false)} aria-hidden="true" />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-700" aria-hidden="true" />
              <h2 id="loc-notice-title" className="text-base font-bold text-slate-900">Location sharing during duty</h2>
            </div>
            <ul className="text-sm text-slate-700 list-disc pl-5 flex flex-col gap-1.5">
              <li>While you are <strong>on duty</strong>, this app shares your phone&apos;s location with the company every few minutes.</li>
              <li>The location of every order you take is also saved.</li>
              <li>Sharing starts only when you press <strong>Start Duty</strong> and stops when you press <strong>End Duty</strong>. It also stops if the app is closed.</li>
              <li>Only the admin can see it. It is used to plan routes and check shop visits, and is deleted after 90 days.</li>
            </ul>
            <p className="text-xs text-slate-500">Your phone will ask for location permission. Please choose &quot;Allow&quot;.</p>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowNotice(false)} className="min-h-11 px-4 rounded-lg border border-slate-300 font-semibold">Not now</button>
              <button type="button" onClick={onAgree} className="min-h-11 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold">I agree, start duty</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
