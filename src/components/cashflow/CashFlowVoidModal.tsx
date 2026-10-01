'use client';

import React, { useState } from 'react';
import { X, Ban, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CashFlowTransaction } from '@/lib/db';
import { useDb } from '@/context/DbContext';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNeg ? '-₹' : '₹') + formatted;
}

interface CashFlowVoidModalProps {
  transaction: CashFlowTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (voidedTx: CashFlowTransaction) => void;
}

export default function CashFlowVoidModal({
  transaction,
  isOpen,
  onClose,
  onSuccess
}: CashFlowVoidModalProps) {
  const { voidCashFlowTransaction, currentUser } = useDb();
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !transaction) return null;

  const handleVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Please specify a mandatory reason for voiding this transaction.');
      return;
    }

    const res = voidCashFlowTransaction(
      transaction.id,
      reason.trim(),
      currentUser ? { id: currentUser.id, name: currentUser.name } : undefined
    );

    if (res && onSuccess) {
      onSuccess(res);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-rose-100 bg-rose-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-200">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-rose-950 tracking-tight">
                Void / Reverse Transaction
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                {transaction.transaction_number} &bull; {transaction.type === 'CASH_IN' ? 'Cash In' : 'Cash Out'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleVoid} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Transaction Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Party:</span>
              <span className="font-bold text-slate-800">{transaction.party_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Amount:</span>
              <span className={`font-black text-sm ${transaction.type === 'CASH_IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatINR(transaction.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Payment Mode &amp; Category:</span>
              <span className="font-semibold text-slate-700">{transaction.payment_mode} &bull; {transaction.category}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Date:</span>
              <span className="font-mono text-slate-600">{transaction.date}</span>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Financial Audit Integrity Notice</span>
            </div>
            <p>
              Voiding this transaction will zero out its contribution to opening/closing cash balances, while preserving the entire historical record in the audit log for complete transparency.
            </p>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 font-bold text-xs">
              Reason for Voiding / Reversal <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Duplicate entry made by mistake, cheque bounced, wrong party selected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-medium focus:border-rose-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Ban className="w-4 h-4" />
              <span>Confirm Void &amp; Reverse</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
