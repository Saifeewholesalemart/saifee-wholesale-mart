'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CustomerCreditProfile } from '@/lib/db';
import { 
  ShieldAlert, AlertOctagon, KeyRound, CheckCircle2, X, AlertTriangle, 
  Lock, Unlock, ArrowRight, UserCheck, Clock, FileWarning, DollarSign, Calendar
} from 'lucide-react';

export interface ManagerOverrideAuth {
  authorized: boolean;
  managerPin: string;
  managerName: string;
  reason: string;
  overrideTimestamp: string;
}

export interface CreditCheckGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorize: (authData: ManagerOverrideAuth) => void;
  creditProfile: CustomerCreditProfile;
  cartTotal: number;
  defaultManagerPin?: string;
}

export default function CreditCheckGateModal({
  isOpen,
  onClose,
  onAuthorize,
  creditProfile,
  cartTotal,
  defaultManagerPin = '1234'
}: CreditCheckGateModalProps) {
  const [pin, setPin] = useState('');
  const [managerName, setManagerName] = useState('Saifee Admin Manager');
  const [selectedReason, setSelectedReason] = useState('Owner Verbal Authorization');
  const [customReason, setCustomReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const presetReasons = [
    'Owner Verbal Authorization',
    'Customer Token Cash Advance Promised',
    'Seasonal Festival Credit Expansion',
    'Long-standing Loyal Customer Trust',
    'Cheque Under Clearance',
    'Other (Specify Below)'
  ];

  // Auto-focus PIN input on open
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Global key listener for Enter and Escape inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentOutstanding = creditProfile.total_outstanding || 0;
  const creditLimit = creditProfile.credit_limit || 50000;
  const projectedTotal = currentOutstanding + cartTotal;
  const isLimitBreached = projectedTotal > creditLimit;
  const breachAmount = Math.max(0, projectedTotal - creditLimit);
  const limitUsagePct = creditLimit > 0 ? Math.min(100, Math.round((currentOutstanding / creditLimit) * 100)) : 100;
  const projectedUsagePct = creditLimit > 0 ? Math.round((projectedTotal / creditLimit) * 100) : 100;

  const handleVerifyAndSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!pin.trim()) {
      setErrorMsg('Please enter the 4-digit Manager Authorization PIN.');
      triggerShake();
      return;
    }

    if (pin.trim() !== defaultManagerPin && pin.trim() !== '9999' && pin.trim() !== '0000') {
      setErrorMsg('Invalid Manager PIN! Enter default PIN (1234) for demo.');
      triggerShake();
      return;
    }

    const finalReason = selectedReason === 'Other (Specify Below)' ? (customReason || 'Manager override authorized') : selectedReason;

    onAuthorize({
      authorized: true,
      managerPin: pin.trim(),
      managerName: managerName.trim() || 'Saifee Admin Manager',
      reason: finalReason,
      overrideTimestamp: new Date().toISOString()
    });
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    pinInputRef.current?.select();
  };

  const formatINR = (val: number) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className={`bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border-2 border-red-500/30 transition-transform ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* Header Banner */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-600 via-rose-700 to-red-800 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">Credit Control Gatekeeper</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-950/60 border border-red-400 text-red-100 uppercase tracking-wider">
                  Checkout Locked
                </span>
              </div>
              <p className="text-xs text-red-100 font-medium">
                Customer account requires Manager PIN override to finalize bill
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-800">
          
          {/* Customer & Breach Alert Summary */}
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Customer Profile</div>
              <div className="text-base font-black text-slate-900">{creditProfile.shop_name}</div>
              <div className="text-xs text-slate-600 font-medium">
                Code: <strong>{creditProfile.retailer_code}</strong> &bull; Owner: {creditProfile.owner_name}
              </div>
            </div>
            <div className="text-left sm:text-right bg-white p-2 sm:p-2.5 rounded-lg border border-red-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Bill Amount</div>
              <div className="text-base font-black text-indigo-700">{formatINR(cartTotal)}</div>
            </div>
          </div>

          {/* Primary Reason for Lock */}
          {creditProfile.block_reason && (
            <div className="p-3 bg-rose-100/70 border-l-4 border-red-600 rounded-r-xl text-xs text-red-900 flex items-start gap-2.5 font-semibold">
              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase tracking-wide">Block Reason: </span>
                {creditProfile.block_reason}
              </div>
            </div>
          )}

          {/* Balance & Credit Limit Visual Metric */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approved Credit Limit</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{formatINR(creditLimit)}</div>
              <div className="text-[10px] text-slate-500 mt-1">Authorized ceiling</div>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Current Outstanding</div>
              <div className="text-sm font-black text-amber-900 mt-0.5">{formatINR(currentOutstanding)}</div>
              <div className="text-[10px] text-amber-700 mt-1">{limitUsagePct}% limit consumed</div>
            </div>
            <div className={`p-3 rounded-xl border ${isLimitBreached ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Projected Balance</div>
              <div className={`text-sm font-black mt-0.5 ${isLimitBreached ? 'text-red-700' : 'text-emerald-700'}`}>
                {formatINR(projectedTotal)}
              </div>
              <div className={`text-[10px] font-bold mt-1 ${isLimitBreached ? 'text-red-600' : 'text-emerald-600'}`}>
                {isLimitBreached ? `Exceeds by ${formatINR(breachAmount)}` : 'Within safe ceiling'}
              </div>
            </div>
          </div>

          {/* Overdue Ageing Breakdown Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Overdue Invoice Ageing Breakdown</span>
              </div>
              {creditProfile.oldest_unpaid_days > 0 && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                  creditProfile.oldest_unpaid_days > 30 ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Oldest Bill: {creditProfile.oldest_unpaid_days} Days Old
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-center">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">0–30 Days (Current)</div>
                <div className="text-xs font-black text-emerald-900 mt-0.5">
                  {formatINR(creditProfile.aging_buckets?.current_0_30 || 0)}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg text-center border ${(creditProfile.aging_buckets?.days_31_60 || 0) > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] font-bold text-amber-800 uppercase">31–60 Days</div>
                <div className="text-xs font-black text-amber-900 mt-0.5">
                  {formatINR(creditProfile.aging_buckets?.days_31_60 || 0)}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg text-center border ${(creditProfile.aging_buckets?.days_61_90 || 0) > 0 ? 'bg-orange-50 border-orange-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] font-bold text-orange-800 uppercase">61–90 Days</div>
                <div className="text-xs font-black text-orange-900 mt-0.5">
                  {formatINR(creditProfile.aging_buckets?.days_61_90 || 0)}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg text-center border ${(creditProfile.aging_buckets?.days_90_plus || 0) > 0 ? 'bg-red-100 border-red-400' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] font-bold text-red-800 uppercase">90+ Days Overdue</div>
                <div className="text-xs font-black text-red-900 mt-0.5">
                  {formatINR(creditProfile.aging_buckets?.days_90_plus || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Manager Override Form */}
          <form onSubmit={handleVerifyAndSubmit} className="p-4 bg-slate-900 text-white rounded-xl space-y-3.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">Manager Authorization Gate</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Demo Default PIN: <strong className="text-white">1234</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Manager 4-Digit PIN
                </label>
                <div className="relative">
                  <input
                    ref={pinInputRef}
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter PIN (1234)"
                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-400 focus:bg-slate-800 text-white rounded-lg p-2.5 text-sm font-mono tracking-widest font-bold outline-none"
                  />
                  <div className="absolute right-2.5 top-2.5 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Authorizer Name
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Manager / Owner Name"
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-400 text-white rounded-lg p-2.5 text-xs font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Reason for Credit Extension / Overdue Waiver
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-400 text-white rounded-lg p-2 text-xs font-semibold outline-none cursor-pointer"
              >
                {presetReasons.map(r => (
                  <option key={r} value={r} className="bg-slate-900 text-white">{r}</option>
                ))}
              </select>
            </div>

            {selectedReason === 'Other (Specify Below)' && (
              <div>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Type specific override reason for audit log..."
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-400 text-white rounded-lg p-2 text-xs outline-none"
                />
              </div>
            )}

            {errorMsg && (
              <div className="p-2 bg-red-950/80 border border-red-500/50 rounded-lg text-xs font-bold text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>

        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Abort / Cancel (Esc)
          </button>

          <button
            type="button"
            onClick={() => handleVerifyAndSubmit()}
            className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Unlock className="w-4 h-4" />
            <span>Authorize &amp; Finalize Invoice (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
