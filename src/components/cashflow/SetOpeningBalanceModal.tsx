'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, Calendar, DollarSign, CheckCircle2, AlertCircle, Scale } from 'lucide-react';
import { CompanyOpeningBalance, CashFlowPaymentMode } from '@/lib/db';
import { useDb } from '@/context/DbContext';

interface SetOpeningBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SetOpeningBalanceModal({
  isOpen,
  onClose,
  onSuccess
}: SetOpeningBalanceModalProps) {
  const { companyOpeningBalance, updateCompanyOpeningBalance, activeCompany, currentUser } = useDb();

  const [totalBalance, setTotalBalance] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>('2026-04-01');
  const [cashBalance, setCashBalance] = useState<string>('');
  const [upiBalance, setUpiBalance] = useState<string>('');
  const [bankBalance, setBankBalance] = useState<string>('');
  const [chequeBalance, setChequeBalance] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (companyOpeningBalance) {
      setTotalBalance(String(companyOpeningBalance.opening_balance || 0));
      setAsOfDate(companyOpeningBalance.as_of_date || '2026-04-01');
      setCashBalance(String(companyOpeningBalance.mode_balances?.Cash || 0));
      setUpiBalance(String(companyOpeningBalance.mode_balances?.UPI || 0));
      setBankBalance(String(companyOpeningBalance.mode_balances?.['Bank Transfer'] || 0));
      setChequeBalance(String(companyOpeningBalance.mode_balances?.Cheque || 0));
      setErrorMsg('');
    }
  }, [companyOpeningBalance, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedTotal = parseFloat(totalBalance);
    if (isNaN(parsedTotal) || parsedTotal < 0) {
      setErrorMsg('Please enter a valid non-negative opening balance.');
      return;
    }

    const modeBalances: { [key in CashFlowPaymentMode]?: number } = {
      'Cash': parseFloat(cashBalance) || 0,
      'UPI': parseFloat(upiBalance) || 0,
      'Bank Transfer': parseFloat(bankBalance) || 0,
      'Cheque': parseFloat(chequeBalance) || 0,
      'Other': 0
    };

    updateCompanyOpeningBalance({
      company_id: activeCompany?.id || 'biz-saifee',
      opening_balance: parsedTotal,
      as_of_date: asOfDate,
      mode_balances: modeBalances,
      updated_by: currentUser?.name || 'Saifee Admin',
      updated_at: new Date().toISOString()
    });

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-200">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Set Company Opening Balance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Baseline for <strong className="text-slate-700">{activeCompany?.name}</strong>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Total Opening Balance */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Total Baseline Opening Balance (₹ INR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={totalBalance}
                onChange={(e) => setTotalBalance(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 pl-7 text-slate-900 font-black text-base focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* As of Date */}
          <div>
            <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>As of Baseline Date (e.g. FY Start)</span> <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Optional Mode Breakdown */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-slate-700 font-bold block">
              Optional: Payment Mode Initial Breakdown (₹)
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">Cash in Hand</label>
                <input
                  type="number"
                  min="0"
                  value={cashBalance}
                  onChange={(e) => setCashBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold text-xs"
                />
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">UPI Account</label>
                <input
                  type="number"
                  min="0"
                  value={upiBalance}
                  onChange={(e) => setUpiBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold text-xs"
                />
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">Bank Balance</label>
                <input
                  type="number"
                  min="0"
                  value={bankBalance}
                  onChange={(e) => setBankBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold text-xs"
                />
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">Cheques in Hand</label>
                <input
                  type="number"
                  min="0"
                  value={chequeBalance}
                  onChange={(e) => setChequeBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold text-xs"
                />
              </div>
            </div>
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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Opening Balance</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
