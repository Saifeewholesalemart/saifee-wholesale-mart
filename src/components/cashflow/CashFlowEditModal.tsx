'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Edit3, DollarSign, Calendar, Tag, AlertTriangle, 
  CheckCircle2, AlertCircle, Info 
} from 'lucide-react';
import { 
  CashFlowTransaction, CashFlowPaymentMode,
  DEFAULT_CASH_IN_CATEGORIES, DEFAULT_CASH_OUT_CATEGORIES 
} from '@/lib/db';
import { useDb } from '@/context/DbContext';

interface CashFlowEditModalProps {
  transaction: CashFlowTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedTx: CashFlowTransaction) => void;
}

export default function CashFlowEditModal({
  transaction,
  isOpen,
  onClose,
  onSuccess
}: CashFlowEditModalProps) {
  const { updateCashFlowTransaction, currentUser } = useDb();

  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<CashFlowPaymentMode>('UPI');
  const [partyName, setPartyName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setPaymentMode(transaction.payment_mode);
      setPartyName(transaction.party_name);
      setCategory(transaction.category);
      setDate(transaction.date);
      setReferenceNumber(transaction.reference_number || '');
      setRemarks(transaction.remarks || '');
      setReason('');
      setErrorMsg('');
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    if (!partyName.trim()) {
      setErrorMsg('Party name cannot be empty.');
      return;
    }

    if (!category.trim()) {
      setErrorMsg('Category cannot be empty.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('A mandatory explanation reason is required for financial audit tracking.');
      return;
    }

    const updated = updateCashFlowTransaction(
      transaction.id,
      {
        amount: parsedAmount,
        payment_mode: paymentMode,
        party_name: partyName.trim(),
        category: category.trim(),
        date,
        reference_number: referenceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined
      },
      reason.trim(),
      currentUser ? { id: currentUser.id, name: currentUser.name } : undefined
    );

    if (updated && onSuccess) {
      onSuccess(updated);
    }
    onClose();
  };

  const categories = transaction.type === 'CASH_IN' ? DEFAULT_CASH_IN_CATEGORIES : DEFAULT_CASH_OUT_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-200">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Edit Financial Entry: {transaction.transaction_number}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Modifications will be permanently recorded in the audit history.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Amount (₹ INR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 pl-7 text-slate-900 font-black text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as CashFlowPaymentMode)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Party Name */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Party Name (From / To) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Reference Number / UTR</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none font-mono"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Mandatory Reason for Edit */}
          <div className="p-3.5 bg-amber-50/70 border-2 border-amber-300/80 rounded-xl space-y-1.5">
            <label className="block text-amber-950 font-black text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Mandatory Reason for Edit / Audit Trail *</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Corrected transport amount, updated to bank transfer..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-amber-300 rounded-lg p-2 text-slate-900 font-medium focus:border-amber-500 outline-none"
            />
            <p className="text-[10px] text-amber-800">
              Original values will be archived in the permanent edit history log.
            </p>
          </div>

          {/* Modal Actions */}
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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Changes &amp; Log Audit</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
