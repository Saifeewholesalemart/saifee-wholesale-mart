'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { BackorderQueueItem } from '@/lib/orderTerminalTypes';
import { X, AlertTriangle, CheckCircle2, ShieldAlert, FileText, Ban } from 'lucide-react';

interface ShortCloseBackorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BackorderQueueItem | null;
  onSuccess?: () => void;
}

const SHORT_CLOSE_REASONS = [
  'Retailer procured locally / Urgent requirement met elsewhere',
  'Batch discontinued / Stock unavailable from manufacturer',
  'Customer requested line item cancellation',
  'Substituted with alternative product/variant on next order',
  'Price fluctuation / Commercial disagreement',
  'Expired / Damaged lot at supplier end',
  'Other (Specify in notes below)'
];

export default function ShortCloseBackorderModal({
  isOpen,
  onClose,
  item,
  onSuccess
}: ShortCloseBackorderModalProps) {
  const { shortCloseBackorderItem, currentUser } = useDb();

  const [selectedReason, setSelectedReason] = useState<string>(SHORT_CLOSE_REASONS[0]);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setErrorMsg('Please select a mandatory reason for short-closing this backorder.');
      return;
    }

    setIsSubmitting(true);
    const finalReason = selectedReason === 'Other (Specify in notes below)' && customNotes.trim()
      ? customNotes.trim()
      : customNotes.trim() ? `${selectedReason} - ${customNotes.trim()}` : selectedReason;

    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    const res = shortCloseBackorderItem(item.orderId, item.itemId, finalReason, adminUser);
    setIsSubmitting(false);

    if (res) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMsg('Failed to short-close backorder. Item may already be completed or closed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <Ban className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Short-Close Backorder Line Item
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Audit Trail &bull; Mandatory reason required
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Context Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-slate-900 text-sm">{item.productName}</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                MRP ₹{item.mrp}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
              <div>
                <span>Retailer:</span> <strong className="text-slate-900">{item.retailerName}</strong>
              </div>
              <div>
                <span>Parent Order:</span> <strong className="font-mono text-indigo-700">{item.orderNumber}</strong>
              </div>
              <div>
                <span>Fulfilled:</span> <strong className="text-slate-900">{item.fulfilledCartons} / {item.orderedCartons} Ctns</strong>
              </div>
              <div>
                <span>Pending to Cancel:</span> <strong className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-black">{item.pendingCartons} Ctns</strong>
              </div>
            </div>
          </div>

          {/* Audit Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Commercial Audit Warning</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Short-closing cancels the <strong>{item.pendingCartons} Cartons</strong> balance permanently from this order with ₹0 ledger debit to the customer. If no other pending items remain on <strong>{item.orderNumber}</strong>, the parent order will immediately transition to <strong>COMPLETED</strong>.
            </p>
          </div>

          {/* Mandatory Reason Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              Reason for Short-Closing <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
            >
              {SHORT_CLOSE_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Detailed Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              Additional Notes / Supervisor Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Provide any additional context or reference numbers..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-102 active:scale-98"
            >
              <Ban className="w-4 h-4" />
              <span>{isSubmitting ? 'Short-Closing...' : 'Short-Close & Cancel Balance'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
