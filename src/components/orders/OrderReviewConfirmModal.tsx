'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, Retailer, Product, OrderItem,
  formatQuantityDisplay, splitBaseQuantity, calculateBaseQuantity, 
  calculateItemQuantities, calculateOrderQuantities, deriveOrderChannel
} from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import { 
  X, Check, AlertTriangle, Package, Truck, 
  Receipt, ArrowRight, ArrowLeft, Printer, 
  Store, ShieldCheck, Clock, Tag, History, 
  Sparkles, CheckCircle2, TrendingUp, AlertCircle, FileText
} from 'lucide-react';

interface OrderReviewConfirmModalProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OrderReviewConfirmModal({
  orderId,
  isOpen,
  onClose,
  onSuccess
}: OrderReviewConfirmModalProps) {
  const { 
    orders, retailers, products, inventory, batches, invoices,
    updateOrderItemRate, updateOrderItemQuantity, confirmOrder,
    dispatchOrder, currentUser
  } = useDb();

  const order = orders.find(o => o.id === orderId);
  const retailer = order ? retailers.find(r => r.id === order.retailer_id) : undefined;
  const channelObj = order ? deriveOrderChannel(order) : undefined;

  // Local state for line item confirmations & rate overrides
  const [itemConfirms, setItemConfirms] = useState<{ [itemId: string]: number }>({});
  const [itemRates, setItemRates] = useState<{ [itemId: string]: number }>({});
  const [itemReasons, setItemReasons] = useState<{ [itemId: string]: string }>({});
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string; itemId: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Initialize state on open
  useEffect(() => {
    if (!order) return;
    const initialConfirms: { [itemId: string]: number } = {};
    const initialRates: { [itemId: string]: number } = {};
    const initialReasons: { [itemId: string]: string } = {};

    order.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const inv = inventory.find(i => i.product_id === item.product_id);
      const avail = inv?.available_qty || 0;
      const orderedBase = item.ordered_qty ?? item.base_qty ?? item.quantity;
      const fulfilledBase = item.fulfilled_qty ?? item.dispatched_qty ?? 0;
      const remainingBase = item.remaining_qty ?? Math.max(0, orderedBase - fulfilledBase);

      // Confirmed quantity: pre-populate ONLY with remaining quantities
      if (item.confirmed_qty !== undefined && item.confirmed_qty > 0) {
        initialConfirms[item.id] = Math.min(item.confirmed_qty, remainingBase);
      } else {
        initialConfirms[item.id] = Math.min(remainingBase, Math.max(0, avail));
      }

      // Billing rate
      const currentRate = item.carton_rate ?? item.manual_billing_rate ?? item.final_applied_rate ?? (item.base_price - (item.discount || 0));
      initialRates[item.id] = currentRate;
      initialReasons[item.id] = item.pending_reason || 'Stock Unavailable';
    });

    setItemConfirms(initialConfirms);
    setItemRates(initialRates);
    setItemReasons(initialReasons);
  }, [order, inventory, products]);

  if (!isOpen || !order || !retailer) return null;

  const isOrderCompleted = order.status === 'Completed' || order.status === 'Delivered' || (
    (order.items || []).length > 0 && (order.items || []).every(it => {
      const ord = it.ordered_qty ?? it.base_qty ?? it.quantity;
      const ful = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
      const can = it.cancelled_qty ?? 0;
      return (ord - ful - can) <= 0;
    })
  );

  const formatINR = (val?: number) => {
    if (val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Live calculation of subtotal, GST, and totals based on current inputs
  const calculationSummary = useMemo(() => {
    let taxableSubtotal = 0;
    let totalGst = 0;
    let totalConfirmedBase = 0;
    let totalOrderedBase = 0;
    let hasBackorder = false;

    order.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_box_carton || prod?.units_per_box_carton || 1;
      const totalOrdered = item.base_qty ?? item.quantity;
      const confirmedVal = itemConfirms[item.id] !== undefined ? itemConfirms[item.id] : totalOrdered;
      const rate = itemRates[item.id] !== undefined ? itemRates[item.id] : (item.final_applied_rate || item.base_price);
      const gstPercent = item.gst_percent || prod?.gst_percent || 18;

      totalOrderedBase += totalOrdered;
      totalConfirmedBase += confirmedVal;
      if (confirmedVal < totalOrdered) {
        hasBackorder = true;
      }

      const lineTaxable = (rate * (confirmedVal / unitsPerPack));
      const lineGst = lineTaxable * (gstPercent / 100);

      taxableSubtotal += lineTaxable;
      totalGst += lineGst;
    });

    const grandTotal = Math.round(taxableSubtotal + totalGst);
    const roundOff = grandTotal - (taxableSubtotal + totalGst);
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    const currentOutstanding = retailer.outstanding || 0;
    const creditLimit = retailer.credit_limit || 50000;
    const postBillBalance = currentOutstanding + grandTotal;
    const isOverCredit = postBillBalance > creditLimit;

    return {
      taxableSubtotal,
      totalGst,
      cgst,
      sgst,
      roundOff,
      grandTotal,
      totalConfirmedBase,
      totalOrderedBase,
      hasBackorder,
      currentOutstanding,
      creditLimit,
      postBillBalance,
      isOverCredit
    };
  }, [order, products, itemConfirms, itemRates, retailer]);

  // Handle Save Backorder (Allocates confirmed qty and marks backorder for rest)
  const handleSaveBackorder = () => {
    setIsProcessing(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    // First update any rate overrides
    order.items?.forEach(item => {
      const newRate = itemRates[item.id];
      if (newRate !== undefined && newRate !== item.final_applied_rate) {
        updateOrderItemRate(order.id, item.id, newRate, 0, 'Single-Order Review Rate Adjustment', adminUser);
      }
    });

    // Save confirmations with reasons
    const confirmsArray = Object.entries(itemConfirms).map(([itemId, confirmedQty]) => {
      const item = order.items?.find(i => i.id === itemId);
      const totalOrdered = item?.base_qty || item?.quantity || 0;
      return {
        itemId,
        confirmedQty,
        pendingReason: confirmedQty < totalOrdered ? (itemReasons[itemId] || 'Stock Unavailable') : undefined
      };
    });

    confirmOrder(order.id, confirmsArray, adminUser);
    setIsProcessing(false);
    setSuccessToast(`Order ${order.order_number} confirmed! Backorder allocated.`);
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 800);
  };

  // Handle Confirm & Bill (Confirms order, reserves stock, and creates standard Tax Invoice)
  const handleConfirmAndBill = () => {
    setIsProcessing(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    // 1. Update rates
    order.items?.forEach(item => {
      const newRate = itemRates[item.id];
      if (newRate !== undefined && newRate !== item.final_applied_rate) {
        updateOrderItemRate(order.id, item.id, newRate, 0, 'Order Billing Approved Rate', adminUser);
      }
    });

    // 2. Confirm quantities
    const confirmsArray = Object.entries(itemConfirms).map(([itemId, confirmedQty]) => {
      const item = order.items?.find(i => i.id === itemId);
      const totalOrdered = item?.base_qty || item?.quantity || 0;
      return {
        itemId,
        confirmedQty,
        pendingReason: confirmedQty < totalOrdered ? (itemReasons[itemId] || 'Stock Unavailable') : undefined
      };
    });

    const confirmedOrder = confirmOrder(order.id, confirmsArray, adminUser);

    // 3. Generate Tax Invoice if confirmed
    if (confirmedOrder) {
      dispatchOrder(confirmedOrder.id, {
        notes: 'Generated via Single-Order 1-Bill Engine',
        generateChallan: false
      }, adminUser);
    }

    setIsProcessing(false);
    setSuccessToast(`Order ${order.order_number} confirmed & Tax Invoice generated successfully!`);
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Toast Notification */}
        {successToast && (
          <div className="absolute top-4 right-4 z-60 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Single-Order Review &amp; Confirm
              </span>
              <span className="font-mono text-xs text-amber-300 font-bold">
                {order.order_number}
              </span>
              {channelObj && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${channelObj.badgeClass}`}>
                  {channelObj.label}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-white mt-1">
              {retailer.shop_name} &bull; <span className="text-slate-300 text-xs font-normal">{retailer.city} ({retailer.retailer_code})</span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors self-end sm:self-auto cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Retailer Financial & Credit Status Audit Strip */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 font-medium">Credit Limit:</span>
              <span className="font-extrabold text-slate-800">{formatINR(calculationSummary.creditLimit)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Current Outstanding:</span>
              <span className="font-extrabold text-slate-900">{formatINR(calculationSummary.currentOutstanding)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Post-Bill Balance:</span>
              <span className={`font-black ${calculationSummary.isOverCredit ? 'text-red-700' : 'text-indigo-700'}`}>
                {formatINR(calculationSummary.postBillBalance)}
              </span>
            </div>
          </div>

          {calculationSummary.isOverCredit && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-red-100 border border-red-200 text-red-800 rounded-lg text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Credit limit will be exceeded by {formatINR(calculationSummary.postBillBalance - calculationSummary.creditLimit)}</span>
            </div>
          )}
        </div>

        {/* Product Breakdown Table (6 Columns: SKU & MRP, Dist. Cost & Margin, Ordered Qty, Confirm Qty, Billed Rate, Tax & Total) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">PRODUCT &amp; MRP</th>
                  <th className="p-3 text-center">PURCHASE COST &amp; MARGIN</th>
                  <th className="p-3 text-center">ORDERED QTY</th>
                  <th className="p-3 text-center">CONFIRM QTY</th>
                  <th className="p-3 text-right">BILLED RATE</th>
                  <th className="p-3 text-right">LINE TOTAL (INCL. GST)</th>
                  <th className="p-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items?.map(item => {
                  const prod = products.find(p => p.id === item.product_id);
                  const inv = inventory.find(i => i.product_id === item.product_id);
                  const avail = inv?.available_qty || 0;
                  const unitsPerPack = item.units_per_box_carton || prod?.units_per_box_carton || 1;
                  const orderedBase = item.ordered_qty ?? item.base_qty ?? item.quantity;
                  const fulfilledBase = item.fulfilled_qty ?? item.dispatched_qty ?? 0;
                  const remainingBase = item.remaining_qty ?? Math.max(0, orderedBase - fulfilledBase);

                  const orderedCartons = orderedBase / unitsPerPack;
                  const fulfilledCartons = fulfilledBase / unitsPerPack;
                  const remainingCartons = remainingBase / unitsPerPack;
                  const confirmedVal = itemConfirms[item.id] !== undefined ? itemConfirms[item.id] : Math.min(remainingBase, avail);
                  const billedRate = itemRates[item.id] !== undefined ? itemRates[item.id] : (item.carton_rate ?? item.manual_billing_rate ?? item.final_applied_rate ?? item.base_price);
                  const purchaseCost = item.purchase_rate || prod?.purchase_price || (prod?.selling_price ? prod.selling_price * 0.9 : 0);
                  const marginPct = billedRate > 0 && purchaseCost > 0
                    ? Math.round(((billedRate - purchaseCost) / billedRate) * 10000) / 100
                    : null;
                  const gstPercent = item.gst_percent || prod?.gst_percent || 18;
                  const lineTaxable = (billedRate * (confirmedVal / unitsPerPack));
                  const lineTotal = lineTaxable * (1 + gstPercent / 100);
                  const mrp = item.selected_mrp || prod?.mrp || 0;

                  const isLineFullyDispatched = (remainingBase === 0 && fulfilledBase > 0) || item.status === 'COMPLETED';
                  const isLinePartialBackorder = remainingBase > 0 && fulfilledBase > 0;
                  const daysPending = Math.max(0, Math.floor((new Date().getTime() - new Date(order.created_at || order.order_date).getTime()) / (1000 * 60 * 60 * 24)));

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${
                        isLineFullyDispatched 
                          ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500 hover:bg-emerald-50/70' 
                          : isLinePartialBackorder 
                          ? 'bg-amber-50/50 border-l-4 border-l-amber-500 hover:bg-amber-50/70' 
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Col 1: Product SKU & MRP */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">{prod?.name || 'Product Variant'}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                            MRP ₹{mrp}
                          </span>
                          {isLineFullyDispatched ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Dispatched
                            </span>
                          ) : isLinePartialBackorder ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Backorder ({daysPending}d pending)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                          <span>SKU: <strong className="font-mono text-slate-700">{prod?.sku || item.product_id}</strong></span>
                          <span>&bull;</span>
                          <span>Pack: {unitsPerPack} {item.base_unit || prod?.base_unit || 'Pcs'}/{item.trading_unit || 'Carton'}</span>
                          {prod?.hsn && (
                            <>
                              <span>&bull;</span>
                              <span>HSN: <strong className="font-mono text-slate-700">{prod.hsn}</strong></span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Col 2: Dist Cost Rate & Margin */}
                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-700 font-mono block">
                            ₹{purchaseCost.toFixed(2)}/ctn
                          </span>
                          {marginPct !== null && (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-black ${
                              marginPct >= 10 ? 'bg-emerald-100 text-emerald-800' : marginPct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                            }`}>
                              <TrendingUp className="w-3 h-3" />
                              <span>{marginPct >= 0 ? `+${marginPct.toFixed(2)}% Margin` : `${marginPct}% Margin`}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 3: Ordered Qty & Fulfillment Breakdown */}
                      <td className="p-3 text-center">
                        {fulfilledBase > 0 || order.status === 'Partially Confirmed' ? (
                          <div className="space-y-1 inline-block text-left sm:text-center">
                            <div className="font-black text-slate-900 text-xs">
                              Ordered: <span className="font-mono">{orderedCartons}</span> {item.trading_unit || 'Ctn'}
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold flex-wrap">
                              <span className="text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200">
                                Fulfilled: <strong>{fulfilledCartons}</strong>
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border font-bold ${
                                remainingCartons > 0 ? 'text-amber-900 bg-amber-100 border-amber-300' : 'text-slate-600 bg-slate-100 border-slate-200'
                              }`}>
                                Remaining: <strong>{remainingCartons}</strong>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              Days Pending: <strong className="text-slate-700">{daysPending}d</strong>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="font-black text-slate-900 text-sm block">
                              {formatQuantityDisplay(orderedBase, unitsPerPack, item.trading_unit, item.base_unit || prod?.base_unit)}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Avail: {avail} {item.base_unit || prod?.base_unit || 'Pcs'}
                            </span>
                          </>
                        )}
                      </td>

                      {/* Col 4: Confirm Qty (Direct inputs & quick presets) */}
                      <td className="p-3 text-center">
                        {isLineFullyDispatched ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-300">
                              0 (Dispatched)
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setItemConfirms({
                                  ...itemConfirms,
                                  [item.id]: Math.max(0, confirmedVal - (unitsPerPack > 1 ? unitsPerPack : 1))
                                })}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                                title={unitsPerPack > 1 ? `-1 Carton (${unitsPerPack} Pcs)` : '-1 Piece'}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={remainingBase > 0 ? remainingBase : orderedBase}
                                value={confirmedVal}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setItemConfirms({
                                    ...itemConfirms,
                                    [item.id]: isNaN(val) ? 0 : Math.min(remainingBase > 0 ? remainingBase : orderedBase, Math.max(0, val))
                                  });
                                }}
                                className="w-14 text-center text-xs font-black text-slate-900 outline-none py-1"
                              />
                              <button
                                type="button"
                                onClick={() => setItemConfirms({
                                  ...itemConfirms,
                                  [item.id]: Math.min(remainingBase > 0 ? remainingBase : orderedBase, confirmedVal + (unitsPerPack > 1 ? unitsPerPack : 1))
                                })}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                                title={unitsPerPack > 1 ? `+1 Carton (${unitsPerPack} Pcs)` : '+1 Piece'}
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setItemConfirms({ ...itemConfirms, [item.id]: remainingBase > 0 ? remainingBase : orderedBase })}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-bold cursor-pointer"
                              >
                                {remainingBase > 0 && remainingBase !== orderedBase ? 'Rem' : 'Full'}
                              </button>
                              {avail > 0 && avail !== remainingBase && (
                                <button
                                  type="button"
                                  onClick={() => setItemConfirms({ ...itemConfirms, [item.id]: Math.min(remainingBase > 0 ? remainingBase : orderedBase, avail) })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold cursor-pointer"
                                >
                                  Stock
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setItemConfirms({ ...itemConfirms, [item.id]: 0 })}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 font-bold cursor-pointer"
                              >
                                0
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Col 5: Billed Rate (Direct inline edit or locked if completed) */}
                      <td className="p-3 text-right">
                        {isOrderCompleted ? (
                          <div>
                            <span className="text-xs font-black text-slate-800 font-mono">₹{billedRate.toFixed(2)}</span>
                            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                              /{item.trading_unit || 'Carton'} (Locked)
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="inline-flex items-center gap-1">
                              <span className="text-xs font-bold text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={billedRate}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setItemRates({
                                    ...itemRates,
                                    [item.id]: isNaN(val) ? 0 : Math.max(0, val)
                                  });
                                }}
                                className="w-20 text-right text-xs font-black text-indigo-700 border border-slate-300 rounded-md p-1 outline-none focus:border-indigo-600 bg-white"
                              />
                            </div>
                            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                              /{item.trading_unit || 'Carton'}
                            </span>
                          </>
                        )}
                      </td>

                      {/* Col 6: Tax & Total */}
                      <td className="p-3 text-right">
                        <span className="font-black text-slate-900 text-sm block font-mono">
                          {formatINR(lineTotal)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Incl. {gstPercent}% GST
                        </span>
                      </td>

                      {/* Col 7: Actions (Last 5 Rates) */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRateHistoryTarget({
                              retailerId: retailer.id,
                              productId: item.product_id,
                              tradingUnit: item.trading_unit || prod?.trading_unit || 'Carton',
                              itemId: item.id
                            });
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="View last 5 billed rates for this retailer"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Last 5 Rates</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Real-time Financial Breakdown Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wide">FMCG Tax &amp; Fulfilment Breakdown</h4>
              <div className="flex justify-between text-slate-600">
                <span>Total Ordered Base Volume:</span>
                <span className="font-bold text-slate-900">{calculationSummary.totalOrderedBase} Pcs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Confirmed Base Volume:</span>
                <span className="font-bold text-indigo-700">{calculationSummary.totalConfirmedBase} Pcs</span>
              </div>
              {calculationSummary.hasBackorder && (
                <div className="flex justify-between text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <span>Pending Backorder Volume:</span>
                  <span>{calculationSummary.totalOrderedBase - calculationSummary.totalConfirmedBase} Pcs</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-bold text-slate-900">{formatINR(calculationSummary.taxableSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (9%) + SGST (9%):</span>
                <span className="font-bold text-slate-900">{formatINR(calculationSummary.totalGst)}</span>
              </div>
              {calculationSummary.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Round Off:</span>
                  <span>{calculationSummary.roundOff > 0 ? `+${calculationSummary.roundOff.toFixed(2)}` : calculationSummary.roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-indigo-700 pt-2 border-t border-slate-200">
                <span>Net Grand Total:</span>
                <span>{formatINR(calculationSummary.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
          >
            Close
          </button>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isOrderCompleted ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3.5 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black border border-emerald-300 inline-flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Order Fully Invoiced (Read Only)</span>
                </span>
                {order.invoice_id && (
                  <a
                    href={`/admin/invoices?search=${encodeURIComponent(order.order_number)}`}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>View Tax Invoice</span>
                  </a>
                )}
              </div>
            ) : (
              <>
                {calculationSummary.hasBackorder && (
                  <button
                    type="button"
                    onClick={handleSaveBackorder}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                    title="Allocate confirmed stock and create backorder for remaining quantity"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Save Backorder</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmAndBill}
                  disabled={isProcessing || calculationSummary.totalConfirmedBase <= 0}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Confirm &amp; Bill</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Last 5 Billed Rates Modal with 1-click Apply */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryTarget}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
          onApplyRate={(appliedRate) => {
            setItemRates(prev => ({
              ...prev,
              [rateHistoryTarget.itemId]: appliedRate
            }));
            setSuccessToast(`Applied past rate ₹${appliedRate.toFixed(2)} to line item!`);
            setTimeout(() => setSuccessToast(null), 3000);
          }}
        />
      )}
    </div>
  );
}
