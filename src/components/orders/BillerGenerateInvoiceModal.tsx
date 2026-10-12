'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { RetailerPackingLot, PackingLotItem } from '@/lib/orderTerminalTypes';
import { Invoice, DeliveryChallan } from '@/lib/db';
import { 
  Receipt, FileText, Printer, CheckCircle2, AlertTriangle, 
  X, ShieldCheck, Tag, DollarSign, Store, ArrowRight, Lock, History,
  Smartphone, Banknote, CreditCard, Landmark, Layers, AlertCircle, HelpCircle
} from 'lucide-react';
import BillingHistoryModal from '@/components/orders/BillingHistoryModal';
import { printInvoiceDocument } from '@/lib/printInvoice';

interface BillerGenerateInvoiceModalProps {
  lot: RetailerPackingLot;
  onClose: () => void;
  onInvoiceGenerated?: (invoice: Invoice, challan?: DeliveryChallan) => void;
}

type PaymentModeType = 'UPI' | 'Cash' | 'Credit' | 'Bank Transfer' | 'Other';

const PAYMENT_MODES: {
  id: PaymentModeType;
  label: string;
  icon: React.ElementType;
  description: string;
  badge: string;
}[] = [
  { id: 'UPI', label: 'UPI / QR', icon: Smartphone, description: 'Google Pay, PhonePe, Paytm, BHIM', badge: 'Instant Digital' },
  { id: 'Cash', label: 'Cash', icon: Banknote, description: 'Physical cash received at counter/delivery', badge: 'Cash Flow In' },
  { id: 'Credit', label: 'Credit (Pay Later)', icon: CreditCard, description: 'No immediate cash. Recorded on account', badge: 'Receivable' },
  { id: 'Bank Transfer', label: 'Bank Transfer', icon: Landmark, description: 'NEFT, RTGS, IMPS, Net Banking', badge: 'Bank Ledger' },
  { id: 'Other', label: 'Other Mode', icon: Layers, description: 'Cheque, DD, digital wallet or custom payment', badge: 'Custom' }
];

export default function BillerGenerateInvoiceModal({
  lot,
  onClose,
  onInvoiceGenerated
}: BillerGenerateInvoiceModalProps) {
  const { generateInvoiceForPackedLot, getLastBillingRates, currentUser } = useDb();

  // Selected item for dual-scope Billing History Modal
  const [historyModalItem, setHistoryModalItem] = useState<{
    productId: string;
    productName: string;
    mrp: number;
    tradingUnit: string;
    currentRate: number;
    currentDiscount: number;
    itemKey: string;
  } | null>(null);

  // State: editable rates and flat ₹ discounts per item
  // Key: item.compositeKey or item.productId
  const [ratesMap, setRatesMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    lot.items.forEach(it => {
      initial[it.compositeKey || it.productId] = it.unitRate || 0;
    });
    return initial;
  });

  const [discountsMap, setDiscountsMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    lot.items.forEach(it => {
      initial[it.compositeKey || it.productId] = it.flatDiscount || 0;
    });
    return initial;
  });

  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState<string>('Standard GST Tax Invoice');
  const [generateChallan, setGenerateChallan] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment Mode and Settlement State
  const [paymentMode, setPaymentMode] = useState<PaymentModeType>('UPI');
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState<boolean>(false);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');

  // Financial calculations
  const calculatedItems = useMemo(() => {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const items = lot.items.map(it => {
      const key = it.compositeKey || it.productId;
      const rate = Math.max(0, ratesMap[key] !== undefined ? ratesMap[key] : (it.unitRate || 0));
      const flatDiscount = Math.max(0, discountsMap[key] !== undefined ? discountsMap[key] : 0);
      const effectiveRate = Math.max(0, rate - flatDiscount);

      const unitsPerPack = it.unitsPerPack > 1 ? it.unitsPerPack : 1;
      const packedCartons = it.packedCartons !== undefined 
        ? it.packedCartons 
        : (unitsPerPack > 1 ? Math.floor(it.packedPieces / unitsPerPack) : (it.packedPieces > 0 ? it.packedPieces : 0));
      const packedLoose = it.packedLoose !== undefined 
        ? it.packedLoose 
        : (unitsPerPack > 1 ? (it.packedPieces % unitsPerPack) : 0);
      const effectiveCartons = unitsPerPack > 1 
        ? packedCartons + (packedLoose / unitsPerPack) 
        : (packedCartons > 0 ? packedCartons : it.packedPieces);

      const lineTaxable = Math.round(effectiveCartons * effectiveRate * 100) / 100;
      const gstPercent = (it.gstPercent !== undefined && it.gstPercent !== null) ? Number(it.gstPercent) : 0;
      const gstAmount = Math.round(lineTaxable * (gstPercent / 100) * 100) / 100;

      let cgst = 0, sgst = 0, igst = 0;
      if (lot.retailer.state_code === '27' || !lot.retailer.state_code) {
        cgst = Math.round((gstAmount / 2) * 100) / 100;
        sgst = Math.round((gstAmount / 2) * 100) / 100;
      } else {
        igst = gstAmount;
      }

      const lineTotal = lineTaxable + cgst + sgst + igst;

      subtotal += lineTaxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      return {
        ...it,
        currentRate: rate,
        currentDiscount: flatDiscount,
        effectiveRate,
        effectiveCartons,
        packedCartons,
        packedLoose,
        lineTaxable,
        cgst,
        sgst,
        igst,
        lineTotal
      };
    });

    const grandTotal = Math.round(subtotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = Math.round((grandTotal - (subtotal + cgstTotal + sgstTotal + igstTotal)) * 100) / 100;

    return {
      items,
      subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      roundOff,
      grandTotal
    };
  }, [lot, ratesMap, discountsMap]);

  // Compute effective amount received based on mode and user input
  const effectiveAmountReceived = useMemo(() => {
    if (paymentMode === 'Credit') {
      return 0;
    }
    if (isAmountManuallyEdited) {
      const parsed = parseFloat(amountReceivedInput);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    return calculatedItems.grandTotal;
  }, [paymentMode, isAmountManuallyEdited, amountReceivedInput, calculatedItems.grandTotal]);

  // Compute outstanding balance
  const calculatedOutstanding = useMemo(() => {
    if (paymentMode === 'Credit') {
      return calculatedItems.grandTotal;
    }
    return Math.max(0, calculatedItems.grandTotal - effectiveAmountReceived);
  }, [paymentMode, calculatedItems.grandTotal, effectiveAmountReceived]);

  // Validation: Overpayment detection
  const isOverpaid = paymentMode !== 'Credit' && effectiveAmountReceived > calculatedItems.grandTotal;

  // Payment Status calculation
  const paymentStatusInfo = useMemo(() => {
    if (paymentMode === 'Credit') {
      return {
        status: 'CREDIT',
        label: 'CREDIT / UNPAID',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
      };
    }
    if (effectiveAmountReceived >= calculatedItems.grandTotal) {
      return {
        status: 'PAID',
        label: 'PAID (FULL)',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
      };
    }
    if (effectiveAmountReceived > 0) {
      return {
        status: 'PARTIAL',
        label: 'PARTIAL PAYMENT',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300'
      };
    }
    return {
      status: 'UNPAID',
      label: 'UNPAID',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300'
    };
  }, [paymentMode, effectiveAmountReceived, calculatedItems.grandTotal]);

  const handleRateChange = (key: string, valStr: string) => {
    const val = Math.max(0, parseFloat(valStr) || 0);
    setRatesMap(prev => ({ ...prev, [key]: val }));
    setErrorMessage(null);
  };

  const handleDiscountChange = (key: string, valStr: string) => {
    const val = Math.max(0, parseFloat(valStr) || 0);
    setDiscountsMap(prev => ({ ...prev, [key]: val }));
    setErrorMessage(null);
  };

  const handleSelectPaymentMode = (mode: PaymentModeType) => {
    setPaymentMode(mode);
    setErrorMessage(null);
    if (mode === 'Credit') {
      setIsAmountManuallyEdited(false);
      setAmountReceivedInput('0');
    } else {
      if (!isAmountManuallyEdited || parseFloat(amountReceivedInput) === 0) {
        setAmountReceivedInput(calculatedItems.grandTotal.toString());
      }
    }
  };

  const handleAmountReceivedChange = (valStr: string) => {
    setIsAmountManuallyEdited(true);
    setAmountReceivedInput(valStr);
    setErrorMessage(null);
  };

  const handleSetFullAmount = () => {
    setIsAmountManuallyEdited(false);
    setAmountReceivedInput(calculatedItems.grandTotal.toString());
    setErrorMessage(null);
  };

  const handleGenerateInvoice = () => {
    // 1. Validation: packed quantities > 0
    const activeItems = calculatedItems.items.filter(it => it.packedPieces > 0 || it.packedCartons > 0 || it.packedLoose > 0);
    if (activeItems.length === 0) {
      setErrorMessage('No packed quantities found to invoice. Invoice quantity cannot exceed packed quantity.');
      return;
    }

    // 2. Validation: Amount received cannot exceed invoice total
    if (isOverpaid) {
      setErrorMessage('Amount received cannot exceed invoice total.');
      return;
    }

    const payload = {
      retailerId: lot.retailer.id,
      sourceOrderIds: lot.sourceOrders.map(o => o.id),
      items: activeItems.map(it => ({
        originOrderId: it.originOrderId,
        originItemId: it.originItemId,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        mrp: it.mrp,
        unitsPerPack: it.unitsPerPack,
        tradingUnit: it.tradingUnit,
        baseUnit: it.baseUnit,
        packedCartons: it.packedCartons,
        packedLoose: it.packedLoose,
        packedPieces: it.packedPieces,
        unitRate: it.currentRate,
        flatDiscount: it.currentDiscount,
        purchaseCost: it.purchaseCost,
        hsn: it.hsn
      }))
    };

    const res = generateInvoiceForPackedLot(payload, {
      date: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
      notes: invoiceNotes,
      paymentMode,
      amountReceived: paymentMode === 'Credit' ? 0 : effectiveAmountReceived,
      paymentReference: paymentReference.trim() || undefined,
      bankName: bankName.trim() || undefined,
      generateChallan
    }, currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);

    if (res && res.invoice) {
      if (onInvoiceGenerated) {
        onInvoiceGenerated(res.invoice, res.challan);
      }
      onClose();
    } else {
      setErrorMessage('Failed to generate invoice. Please check packed quantities.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase">Generate GST Tax Invoice: {lot.retailer.shop_name}</h3>
              <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span>Orders: <strong className="text-amber-300 font-mono">{lot.sourceOrders.map(o => o.order_number).join(' + ')}</strong></span>
                <span>&bull;</span>
                <span>GSTIN: <span className="font-mono text-slate-300">{lot.retailer.gstin || 'UNREGISTERED'}</span></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Biller Security Notice & Rules Banner */}
        <div className="px-5 py-3 bg-indigo-50/70 border-b border-indigo-200/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-indigo-950 font-bold">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Core Biller Rule: Invoice quantities are locked to physical packed quantities. Edit rate, flat ₹ discount, &amp; payment settlement below.</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Place of Supply: <strong>State {lot.retailer.state_code || '27'}</strong>
          </span>
        </div>

        {errorMessage && (
          <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Section 1: Billable Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>1. Packed Items &amp; Billing Rates ({calculatedItems.items.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">Verified packed quantities</span>
            </div>

            {calculatedItems.items.map((it, idx) => {
              const key = it.compositeKey || it.productId;

              return (
                <div 
                  key={key || idx}
                  className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 transition-all space-y-3.5"
                >
                  {/* 1. Item Header: Product Name, Variant/Pack, Brand, Packed Quantity */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 leading-tight">
                          {it.productName}
                        </h4>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold font-mono">
                          {it.tradingUnit || 'Carton'} Mode
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                        <span>Brand: <strong className="text-slate-700">{it.brand || 'Saifee'}</strong></span>
                        <span>&bull;</span>
                        <span>HSN: <span className="font-mono">{it.hsn || '1902'}</span></span>
                        <span>&bull;</span>
                        <span>MRP: <strong className="text-slate-700">₹{Number(it.mrp).toFixed(2)}</strong></span>
                        <span>&bull;</span>
                        <span>GST: <strong>{it.gstPercent}%</strong></span>
                      </div>
                    </div>

                    {/* Packed Quantity Badge */}
                    <div className="self-start sm:self-auto">
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-black font-mono flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Packed: {it.unitsPerPack > 1 
                            ? `${it.packedCartons} Box / Cartons${it.packedLoose > 0 ? ` + ${it.packedLoose} Loose` : ''} (${it.packedPieces} Pcs)`
                            : `${it.packedCartons > 0 ? `${it.packedCartons} Box / Cartons` : `${it.packedPieces} Pcs`}`
                          }
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* 2. Structured Rates Section */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/90">
                    
                    {/* Purchase Rate (READ ONLY) */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Purchase Rate
                      </span>
                      <span className="font-mono font-black text-slate-800 text-xs sm:text-sm block">
                        ₹{Number(it.purchaseCost || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        / {it.tradingUnit || 'Carton'} (Cost)
                      </span>
                    </div>

                    {/* Ordered Rate + Clickable Link directly under it */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Ordered Rate
                      </span>
                      <span className="font-mono font-black text-slate-700 text-xs sm:text-sm block">
                        ₹{Number(it.unitRate || 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">/ {it.tradingUnit || 'Carton'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryModalItem({
                            productId: it.productId,
                            productName: it.productName,
                            mrp: it.mrp,
                            tradingUnit: it.tradingUnit,
                            currentRate: it.currentRate,
                            currentDiscount: it.currentDiscount,
                            itemKey: key
                          });
                        }}
                        className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer inline-flex items-center gap-1 pt-0.5"
                      >
                        <span>View Last 5 Billing Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Billing Rate Input */}
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">
                        Billing Rate (₹)
                      </label>
                      <div className="relative mt-0.5">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={it.currentRate}
                          onChange={(e) => handleRateChange(key, e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-indigo-300 rounded-lg font-mono font-black text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Flat ₹ Discount Input */}
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-rose-900 block">
                        Discount / {it.tradingUnit || 'Carton'}
                      </label>
                      <div className="relative mt-0.5">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={it.currentDiscount}
                          onChange={(e) => handleDiscountChange(key, e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-rose-300 rounded-lg font-mono font-black text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-rose-500 shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Final Rate & Line Total */}
                    <div className="text-right space-y-0.5 col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Final Rate
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-sm sm:text-base block">
                        ₹{Number(it.effectiveRate).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Total: <strong>₹{it.lineTotal.toFixed(2)}</strong>
                      </span>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Section 2: Payment Mode & Settlement Integration */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>2. Payment Mode &amp; Immediate Settlement</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Select payment mode to automatically post to Payment Ledger, update Cash Flow, and compute outstanding balance.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-black uppercase tracking-wider self-start sm:self-auto ${paymentStatusInfo.badgeClass}`}>
                {paymentStatusInfo.label}
              </span>
            </div>

            {/* Payment Mode Selector Pills */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                Select Payment Mode <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PAYMENT_MODES.map(pm => {
                  const Icon = pm.icon;
                  const isSelected = paymentMode === pm.id;

                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => handleSelectPaymentMode(pm.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400' 
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {pm.badge}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-black block leading-tight">{pm.label}</span>
                        <span className={`text-[9.5px] line-clamp-1 mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {pm.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Input Fields Based on Payment Mode */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
              {paymentMode === 'Credit' ? (
                /* Credit / Pay Later info */
                <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <p className="font-bold">
                      Credit Sale Selected — No immediate money received
                    </p>
                    <p className="text-[11px] text-amber-900">
                      Amount received is fixed at <strong>₹0.00</strong>. The full invoice amount of <strong>₹{calculatedItems.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> will be recorded as a receivable in <strong>{lot.retailer.shop_name}</strong>&apos;s account ledger. No payment transaction or cash-in entry will be created.
                    </p>
                  </div>
                </div>
              ) : (
                /* Non-Credit Modes: Amount Received & References */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  {/* Amount Received Input */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                        Amount Received (₹) <span className="text-rose-500">*</span>
                      </label>
                      {isAmountManuallyEdited && (
                        <button
                          type="button"
                          onClick={handleSetFullAmount}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          Reset to Full Amount
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        max={calculatedItems.grandTotal}
                        step="1"
                        value={isAmountManuallyEdited ? amountReceivedInput : calculatedItems.grandTotal}
                        onChange={(e) => handleAmountReceivedChange(e.target.value)}
                        placeholder={calculatedItems.grandTotal.toString()}
                        className={`w-full pl-7 pr-3 py-2 bg-white border rounded-xl font-mono font-black text-sm text-slate-900 focus:ring-2 focus:outline-hidden shadow-xs ${
                          isOverpaid 
                            ? 'border-rose-500 focus:ring-rose-500 bg-rose-50/40 text-rose-900' 
                            : 'border-indigo-300 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Mode-specific references */}
                  {paymentMode === 'UPI' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                        Transaction / UTR Reference
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. UTR202604019284 or UPI Transaction ID"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
                      />
                    </div>
                  )}

                  {paymentMode === 'Cash' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                        Cash Receipt / Memo Ref <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. Cash Memo # / Counter Voucher Ref"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
                      />
                    </div>
                  )}

                  {paymentMode === 'Bank Transfer' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                          Transaction / UTR / Ref
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="e.g. NEFT / IMPS / RTGS Ref #"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                          Bank Name <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. HDFC Bank, SBI, ICICI Bank"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                        />
                      </div>
                    </>
                  )}

                  {paymentMode === 'Other' && (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                        Payment Reference / Remarks
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. Cheque #492819, Pay Order, or custom description"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Overpayment Validation Alert */}
              {isOverpaid && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Amount received cannot exceed invoice total (₹{calculatedItems.grandTotal.toLocaleString('en-IN')}).</span>
                </div>
              )}

              {/* Real-time Settlement Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Invoice Total</span>
                  <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">
                    ₹{calculatedItems.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount Received</span>
                  <span className="font-mono font-black text-emerald-700 text-sm block mt-0.5">
                    ₹{effectiveAmountReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Outstanding</span>
                  <span className={`font-mono font-black text-sm block mt-0.5 ${calculatedOutstanding > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    ₹{calculatedOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payment Status</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border inline-block mt-0.5 w-fit ${paymentStatusInfo.badgeClass}`}>
                    {paymentStatusInfo.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Invoice Summary & Action Bar */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-4 text-slate-300">
              <span>Taxable: <strong className="text-white font-mono">₹{calculatedItems.subtotal.toFixed(2)}</strong></span>
              {calculatedItems.cgstTotal > 0 && (
                <span>CGST: <strong className="text-white font-mono">₹{calculatedItems.cgstTotal.toFixed(2)}</strong></span>
              )}
              {calculatedItems.sgstTotal > 0 && (
                <span>SGST: <strong className="text-white font-mono">₹{calculatedItems.sgstTotal.toFixed(2)}</strong></span>
              )}
              {calculatedItems.igstTotal > 0 && (
                <span>IGST: <strong className="text-white font-mono">₹{calculatedItems.igstTotal.toFixed(2)}</strong></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Mode: <strong className="text-amber-300 font-bold">{paymentMode}</strong></span>
              <span>&bull;</span>
              <span>Received: <strong className="text-emerald-400 font-mono">₹{effectiveAmountReceived.toFixed(2)}</strong></span>
              <span>&bull;</span>
              <span>Outstanding: <strong className="text-amber-400 font-mono">₹{calculatedOutstanding.toFixed(2)}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">Grand Total</span>
              <span className="text-2xl font-black text-white font-mono tracking-tight">
                ₹{calculatedItems.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              type="button"
              disabled={isOverpaid}
              onClick={handleGenerateInvoice}
              className={`px-6 py-3 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer flex items-center gap-2 shrink-0 ${
                isOverpaid
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-95 text-slate-950 hover:shadow-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Generate GST Invoice 📄</span>
            </button>
          </div>
        </div>

        {/* Dual-Scope Rate History Modal */}
        {historyModalItem && (
          <BillingHistoryModal
            isOpen={!!historyModalItem}
            onClose={() => setHistoryModalItem(null)}
            productId={historyModalItem.productId}
            retailerId={lot.retailer.id}
            productName={historyModalItem.productName}
            mrp={historyModalItem.mrp}
            tradingUnit={historyModalItem.tradingUnit}
            currentRate={historyModalItem.currentRate}
            currentDiscount={historyModalItem.currentDiscount}
            onApplyRate={(rate, disc) => {
              handleRateChange(historyModalItem.itemKey, String(rate));
              if (disc !== undefined) {
                handleDiscountChange(historyModalItem.itemKey, String(disc));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
