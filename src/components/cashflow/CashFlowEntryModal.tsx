'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, ArrowDownLeft, ArrowUpRight, DollarSign, Calendar, Clock, 
  Tag, Store, Truck, FileText, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { 
  CashFlowType, CashFlowPaymentMode, CashFlowTransaction,
  DEFAULT_CASH_IN_CATEGORIES, DEFAULT_CASH_OUT_CATEGORIES,
  Retailer, Supplier, Invoice, Purchase
} from '@/lib/db';
import { useDb } from '@/context/DbContext';

interface CashFlowEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: CashFlowType;
  onSuccess?: (tx: CashFlowTransaction) => void;
}

export default function CashFlowEntryModal({
  isOpen,
  onClose,
  defaultType = 'CASH_IN',
  onSuccess
}: CashFlowEntryModalProps) {
  const { retailers, suppliers, invoices, purchases, createCashFlowTransaction, currentUser, activeCompany } = useDb();

  const [type, setType] = useState<CashFlowType>(defaultType);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>(() => new Date().toTimeString().split(' ')[0]);
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<CashFlowPaymentMode>('UPI');
  const [category, setCategory] = useState<string>('Retailer Payment');
  
  // Party selection mode: 'select' (existing master) vs 'custom' (manual text)
  const [partySelectMode, setPartySelectMode] = useState<'select' | 'custom'>('select');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customPartyName, setCustomPartyName] = useState<string>('');
  
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string>('');
  const [linkedPurchaseId, setLinkedPurchaseId] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Reset category and defaults on type change
  useEffect(() => {
    setType(defaultType);
    if (defaultType === 'CASH_IN') {
      setCategory('Retailer Payment');
      setPaymentMode('UPI');
    } else {
      setCategory('Transport');
      setPaymentMode('Cash');
    }
  }, [defaultType, isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: CashFlowType) => {
    setType(newType);
    if (newType === 'CASH_IN') {
      setCategory('Retailer Payment');
      setSelectedPartyId('');
    } else {
      setCategory('Transport');
      setSelectedPartyId('');
    }
  };

  const handlePartySelect = (id: string) => {
    setSelectedPartyId(id);
    if (type === 'CASH_IN') {
      const ret = retailers.find(r => r.id === id);
      if (ret) setCustomPartyName(ret.shop_name);
    } else {
      const sup = suppliers.find(s => s.id === id);
      if (sup) setCustomPartyName(sup.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    let finalPartyName = customPartyName.trim();
    let finalPartyId: string | undefined = undefined;
    let finalPartyType: 'retailer' | 'supplier' | 'other' = 'other';

    if (partySelectMode === 'select' && selectedPartyId) {
      finalPartyId = selectedPartyId;
      if (type === 'CASH_IN') {
        const ret = retailers.find(r => r.id === selectedPartyId);
        finalPartyName = ret ? ret.shop_name : customPartyName;
        finalPartyType = 'retailer';
      } else {
        const sup = suppliers.find(s => s.id === selectedPartyId);
        finalPartyName = sup ? sup.name : customPartyName;
        finalPartyType = 'supplier';
      }
    }

    if (!finalPartyName) {
      setErrorMsg(type === 'CASH_IN' ? 'Please specify who the payment was received from.' : 'Please specify who the payment was paid to.');
      return;
    }

    if (!category.trim()) {
      setErrorMsg('Please select or specify a category.');
      return;
    }

    // Linked Invoice Number if selected
    const selectedInv = linkedInvoiceId ? invoices.find(i => i.id === linkedInvoiceId) : undefined;
    const selectedPurch = linkedPurchaseId ? purchases.find(p => p.id === linkedPurchaseId) : undefined;

    const newTx = createCashFlowTransaction({
      company_id: activeCompany?.id || 'biz-saifee',
      date,
      time,
      type,
      amount: parsedAmount,
      payment_mode: paymentMode,
      category,
      party_type: finalPartyType,
      party_id: finalPartyId,
      party_name: finalPartyName,
      reference_number: referenceNumber.trim() || undefined,
      source_type: 'Manual Entry',
      linked_invoice_id: linkedInvoiceId || undefined,
      linked_invoice_number: selectedInv ? selectedInv.invoice_number : undefined,
      linked_retailer_id: finalPartyType === 'retailer' ? finalPartyId : undefined,
      linked_supplier_id: finalPartyType === 'supplier' ? finalPartyId : undefined,
      linked_purchase_id: linkedPurchaseId || undefined,
      remarks: remarks.trim() || undefined,
      created_by: currentUser?.name || 'Saifee Admin'
    });

    if (onSuccess) onSuccess(newTx);
    onClose();
  };

  const categories = type === 'CASH_IN' ? DEFAULT_CASH_IN_CATEGORIES : DEFAULT_CASH_OUT_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${type === 'CASH_IN' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-rose-500/10 text-rose-600 border-rose-200'}`}>
              {type === 'CASH_IN' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {type === 'CASH_IN' ? 'Record Money In (Receipt)' : 'Record Money Out (Payment/Expense)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Company: <span className="font-bold text-slate-700">{activeCompany?.name || 'Saifee Distributor'}</span>
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

          {/* Type Switcher */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Transaction Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('CASH_IN')}
                className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'CASH_IN'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Cash In (Receipt)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('CASH_OUT')}
                className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'CASH_OUT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>- Cash Out (Payment)</span>
              </button>
            </div>
          </div>

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
                  placeholder="0.00"
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
                <option value="Cash">Cash (Physical Currency)</option>
                <option value="UPI">UPI (GPay / PhonePe / Paytm / QR)</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Transaction Date</span> <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Time</span>
              </label>
              <input
                type="text"
                placeholder="HH:mm:ss"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Category</span> <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
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
          </div>

          {/* Party (From / To) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-700 font-bold">
                {type === 'CASH_IN' ? 'Received From (Party / Customer)' : 'Paid To (Supplier / Payee)'} <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPartySelectMode('select')}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg cursor-pointer ${
                    partySelectMode === 'select' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Choose Registered
                </button>
                <button
                  type="button"
                  onClick={() => setPartySelectMode('custom')}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg cursor-pointer ${
                    partySelectMode === 'custom' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Manual Name
                </button>
              </div>
            </div>

            {partySelectMode === 'select' ? (
              <select
                value={selectedPartyId}
                onChange={(e) => handlePartySelect(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              >
                <option value="">
                  {type === 'CASH_IN' ? '-- Select Registered Retailer --' : '-- Select Registered Supplier --'}
                </option>
                {type === 'CASH_IN'
                  ? retailers.map(r => (
                      <option key={r.id} value={r.id}>{r.shop_name} ({r.city})</option>
                    ))
                  : suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.gstin ? `(${s.gstin})` : ''}</option>
                    ))
                }
              </select>
            ) : (
              <input
                type="text"
                placeholder={type === 'CASH_IN' ? 'e.g. Ramesh Kirana, Walk-in Customer...' : 'e.g. XYZ Logistics, Godown Landlord, MSEB...'}
                value={customPartyName}
                onChange={(e) => setCustomPartyName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              />
            )}
          </div>

          {/* Reference Number & Optional Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Reference / UTR / Chq #
              </label>
              <input
                type="text"
                placeholder="e.g. UPI-998124, CHQ-00129"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                {type === 'CASH_IN' ? 'Linked Invoice (Optional)' : 'Linked Purchase (Optional)'}
              </label>
              {type === 'CASH_IN' ? (
                <select
                  value={linkedInvoiceId}
                  onChange={(e) => setLinkedInvoiceId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
                >
                  <option value="">-- No Linked Invoice --</option>
                  {invoices.slice(0, 15).map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} (₹{inv.grand_total})</option>
                  ))}
                </select>
              ) : (
                <select
                  value={linkedPurchaseId}
                  onChange={(e) => setLinkedPurchaseId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-indigo-500 outline-none"
                >
                  <option value="">-- No Linked Purchase --</option>
                  {purchases.slice(0, 15).map(pur => (
                    <option key={pur.id} value={pur.id}>{pur.invoice_number || pur.id} (₹{pur.total_amount})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Remarks / Internal Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Advance paid against transport agreement..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Auto captured metadata preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-0.5">
            <div className="font-bold text-slate-700">Auto-captured Audit Context:</div>
            <div>Company: <strong className="text-slate-800">{activeCompany?.name}</strong> ({activeCompany?.id})</div>
            <div>Created By: <strong className="text-slate-800">{currentUser?.name || 'Saifee Admin'}</strong> &bull; Source: <strong className="text-slate-800">Manual Entry</strong></div>
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
              className={`px-5 py-2.5 text-white font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                type === 'CASH_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save {type === 'CASH_IN' ? 'Cash In Entry' : 'Cash Out Entry'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
