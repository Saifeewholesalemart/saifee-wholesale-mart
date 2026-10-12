'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, OrderItem, Retailer, Product, InventoryBatch,
  formatQuantityDisplay, splitBaseQuantity, calculateItemAmounts, deriveOrderChannel
} from '@/lib/db';
import { 
  X, Receipt, Percent, IndianRupee, TrendingUp, AlertTriangle, 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles, Edit3, DollarSign,
  TrendingDown, Check, Info
} from 'lucide-react';

interface AdminBillingOverrideModalProps {
  order?: Order | null;
  orders?: Order[];
  retailer?: Retailer | null;
  isOpen: boolean;
  onClose: () => void;
  onProceedToInvoice?: (updatedOrder: Order) => void;
  onProceedToConsolidatedInvoice?: (orders: Order[], retailer: Retailer | null) => void;
}

export default function AdminBillingOverrideModal({
  order,
  orders,
  retailer: propRetailer,
  isOpen,
  onClose,
  onProceedToInvoice,
  onProceedToConsolidatedInvoice
}: AdminBillingOverrideModalProps) {
  // 1. Context Hooks (Always executed at the top)
  const { 
    products = [], batches = [], retailers = [], updateOrderFinancialOverrides, currentUser 
  } = useDb();

  // 2. Memoize effective orders array
  const effectiveOrders = useMemo(() => {
    if (orders && Array.isArray(orders) && orders.length > 0) return orders;
    if (order) return [order];
    return [];
  }, [orders, order]);

  // 3. Flatten and enrich all items across effective orders
  const allItems = useMemo(() => {
    const list: (OrderItem & { originOrderNumber: string; originOrderId: string })[] = [];
    effectiveOrders.forEach(ord => {
      (ord.items || []).forEach(it => {
        list.push({
          ...it,
          originOrderNumber: ord.order_number,
          originOrderId: ord.id
        });
      });
    });
    return list;
  }, [effectiveOrders]);

  // 4. State Hooks (Always executed at the top)
  const [itemOverrides, setItemOverrides] = useState<{
    [itemId: string]: {
      billedQty: number; // in base units
      rate: number; // carton rate (or single unit rate)
      discount: number; // discount amount in ₹
      reason: string;
      orderId: string;
    };
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 5. Effect Hooks (Always executed at the top)
  useEffect(() => {
    if (allItems.length === 0) {
      setItemOverrides({});
      return;
    }
    const initial: { [itemId: string]: { billedQty: number; rate: number; discount: number; reason: string; orderId: string } } = {};
    allItems.forEach(it => {
      const prod = products?.find(p => p.id === it.product_id);
      const unitsPerPack = it.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const currentQty = it.packed_qty ?? it.confirmed_qty ?? it.base_qty ?? it.quantity ?? 0;
      const currentRate = it.manual_billing_rate || it.carton_rate || it.order_time_rate || it.base_price || prod?.selling_price || 0;
      const currentDiscount = it.carton_discount || it.discount || 0;

      initial[it.id] = {
        billedQty: currentQty,
        rate: currentRate,
        discount: currentDiscount,
        reason: it.manual_rate_reason || 'Admin pricing adjustment',
        orderId: it.originOrderId
      };
    });
    setItemOverrides(initial);
  }, [allItems, products]);

  // 6. Memo Hooks (Always executed unconditionally at top)
  const retailer = useMemo(() => {
    if (propRetailer) return propRetailer;
    const retId = effectiveOrders[0]?.retailer_id;
    if (!retId) return null;
    return retailers?.find(r => r.id === retId) || null;
  }, [propRetailer, effectiveOrders, retailers]);

  const channel = useMemo(() => {
    if (effectiveOrders.length === 0) return { label: 'Retailer Direct', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    return deriveOrderChannel(effectiveOrders[0]);
  }, [effectiveOrders]);

  const isLocalGst = (retailer?.state_code || '27') === '27';

  // Real-time calculations across all overridden items
  const computedLines = useMemo(() => {
    if (allItems.length === 0) return [];
    return allItems.map(item => {
      const prod = products?.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
      const baseUnit = item.base_unit || prod?.base_unit || 'Piece';
      const prodName = prod?.name || (item as any).name || 'Product Item';
      const prodHsn = (item as any).hsn || prod?.hsn || '1905';
      const prodGst = item.gst_percent !== undefined ? item.gst_percent : (prod?.gst_percent || 0);
      const itemMrp = item.selected_mrp || prod?.mrp || 0;

      // Find cost/purchase rate
      const batchObj = batches?.find(b => b.product_id === item.product_id);
      const purchasePricePerUnit = item.purchase_rate || batchObj?.purchase_rate || prod?.purchase_price || 0;

      const ov = itemOverrides[item.id] || {
        billedQty: item.packed_qty ?? item.base_qty ?? item.quantity ?? 0,
        rate: item.manual_billing_rate || item.carton_rate || prod?.selling_price || 0,
        discount: item.discount || 0,
        reason: 'Admin financial override',
        orderId: item.originOrderId
      };

      const billedQty = Math.max(0, ov.billedQty);
      const cartonRate = Math.max(0, ov.rate);
      const looseRate = Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100;
      const discount = Math.max(0, ov.discount);

      const split = splitBaseQuantity(billedQty, unitsPerPack);
      const amounts = calculateItemAmounts(
        split.cartonQty,
        split.looseQty,
        cartonRate,
        looseRate,
        discount,
        0,
        prodGst
      );

      // Profit Margin Analysis per piece
      const sellingRatePerPiece = looseRate;
      const costPerPiece = Math.round((purchasePricePerUnit / Math.max(1, unitsPerPack)) * 100) / 100;
      let marginPct = 0;
      if (sellingRatePerPiece > 0) {
        marginPct = Math.round(((sellingRatePerPiece - costPerPiece) / sellingRatePerPiece) * 1000) / 10;
      }

      return {
        item,
        originOrderId: item.originOrderId,
        originOrderNumber: item.originOrderNumber,
        prod,
        prodName,
        prodHsn,
        prodGst,
        itemMrp,
        unitsPerPack,
        tradingUnit,
        baseUnit,
        billedQty,
        split,
        cartonRate,
        looseRate,
        discount,
        reason: ov.reason,
        costPerPiece,
        sellingRatePerPiece,
        marginPct,
        amounts
      };
    });
  }, [allItems, products, batches, itemOverrides]);

  // Overall Financial Totals
  const totals = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let taxable = 0;
    let gst = 0;
    let grand = 0;

    computedLines.forEach(l => {
      gross += l.amounts.grossAmount;
      discount += l.amounts.discountAmount;
      taxable += l.amounts.taxableAmount;
      gst += l.amounts.gstAmount;
      grand += l.amounts.totalAmount;
    });

    const cgst = isLocalGst ? gst / 2 : 0;
    const sgst = isLocalGst ? gst / 2 : 0;
    const igst = !isLocalGst ? gst : 0;
    const roundedGrand = Math.round(grand);
    const roundOff = Math.round((roundedGrand - grand) * 100) / 100;

    return {
      gross,
      discount,
      taxable,
      gst,
      cgst,
      sgst,
      igst,
      roundOff,
      grand: roundedGrand
    };
  }, [computedLines, isLocalGst]);

  // 7. Callbacks
  const handleFieldChange = useCallback((itemId: string, field: 'billedQty' | 'rate' | 'discount' | 'reason', val: any) => {
    setItemOverrides(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: val
      }
    }));
  }, []);

  const handleSaveOverrides = useCallback((thenProceedToInvoice = false) => {
    if (effectiveOrders.length === 0) return;
    setIsSubmitting(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    // Apply updates order-by-order
    const updatedOrders: Order[] = [];
    effectiveOrders.forEach(ord => {
      const orderLines = computedLines.filter(l => l.originOrderId === ord.id);
      if (orderLines.length > 0) {
        const payload = orderLines.map(l => ({
          itemId: l.item.id,
          billedQty: l.billedQty,
          rate: l.cartonRate,
          discount: l.discount,
          reason: l.reason
        }));
        const updated = updateOrderFinancialOverrides(ord.id, payload, adminUser);
        if (updated) updatedOrders.push(updated);
      }
    });

    setIsSubmitting(false);

    if (thenProceedToInvoice) {
      if (effectiveOrders.length > 1 && onProceedToConsolidatedInvoice) {
        onProceedToConsolidatedInvoice(updatedOrders.length > 0 ? updatedOrders : effectiveOrders, retailer);
      } else if (onProceedToInvoice && updatedOrders.length > 0) {
        onProceedToInvoice(updatedOrders[0]);
      } else if (onProceedToConsolidatedInvoice) {
        onProceedToConsolidatedInvoice(updatedOrders.length > 0 ? updatedOrders : effectiveOrders, retailer);
      }
    }
    onClose();
  }, [effectiveOrders, currentUser, computedLines, updateOrderFinancialOverrides, onProceedToInvoice, onProceedToConsolidatedInvoice, retailer, onClose]);

  // 8. Conditional Unmount Check (At the very bottom before returning JSX)
  if (!isOpen || effectiveOrders.length === 0) {
    return null;
  }

  const isMultiOrder = effectiveOrders.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Edit3 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-base font-black text-amber-300">
                  {isMultiOrder ? `Consolidated (${effectiveOrders.map(o => o.order_number).join(', ')})` : effectiveOrders[0].order_number}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  {isMultiOrder ? `Consolidated Financial Overrides (${effectiveOrders.length} Orders)` : 'Administrative Financial Overrides'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${channel.badgeClass}`}>
                  {channel.label}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Retailer: <strong className="text-white">{retailer?.shop_name || 'Retailer Store'}</strong> ({retailer?.city || 'Local Beat'}) &bull; {computedLines.length} Total Packed Line Items
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

        {/* Live Override Instructions Banner */}
        <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-950 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Fine-tune <strong>Billed Quantities</strong>, <strong>Selling Rates (₹)</strong>, and <strong>Discounts</strong> before generating the final GST Tax Invoice. Live profit margins are calculated in real time.
            </span>
          </div>
          <span className="font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
            {computedLines.length} Billed Items
          </span>
        </div>

        {/* Table of Line Overrides */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3">Product Description</th>
                  <th className="p-3 text-center w-32">Billed Qty</th>
                  <th className="p-3 text-center w-36">Rate / Carton (₹)</th>
                  <th className="p-3 text-center w-28">Margin Status</th>
                  <th className="p-3 text-center w-28">Discount (₹)</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">Line Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {computedLines.map((line, idx) => {
                  const isLoss = line.marginPct < 0;
                  const isLowMargin = line.marginPct >= 0 && line.marginPct < 5;

                  return (
                    <tr key={line.item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* # */}
                      <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                      {/* Product */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isMultiOrder && line.originOrderNumber && (
                            <span className="font-mono text-[10px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                              {line.originOrderNumber}
                            </span>
                          )}
                          <span className="font-extrabold text-slate-900 text-sm block">
                            {line.prodName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                            MRP ₹{line.itemMrp}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          HSN: <span className="font-mono text-slate-700">{line.prodHsn}</span> &bull; {line.unitsPerPack} {line.baseUnit}/Ctn &bull; Cost: ₹{line.costPerPiece}/Pc
                        </p>
                      </td>

                      {/* Billed Qty */}
                      <td className="p-3">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            value={line.billedQty === 0 ? '0' : line.billedQty || ''}
                            onChange={(e) => handleFieldChange(line.item.id, 'billedQty', parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1.5 text-center font-black text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                          <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            Pcs
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 text-center mt-0.5">
                          = {line.split.cartonQty} Ctn {line.split.looseQty > 0 ? `+ ${line.split.looseQty} Pcs` : ''}
                        </div>
                      </td>

                      {/* Rate / Carton */}
                      <td className="p-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.cartonRate === 0 ? '0' : line.cartonRate || ''}
                            onChange={(e) => handleFieldChange(line.item.id, 'rate', parseFloat(e.target.value) || 0)}
                            className={`w-full pl-5 pr-2 py-1.5 text-right font-black text-sm rounded-lg border focus:ring-2 focus:outline-hidden transition-all ${
                              isLoss 
                                ? 'border-red-400 bg-red-50 text-red-950 focus:ring-red-400' 
                                : isLowMargin 
                                ? 'border-amber-400 bg-amber-50 text-amber-950 focus:ring-amber-400' 
                                : 'border-slate-300 bg-white text-slate-900 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 text-right mt-0.5">
                          = ₹{line.looseRate.toFixed(2)}/Pc
                        </div>
                      </td>

                      {/* Margin Status */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black border ${
                          isLoss 
                            ? 'bg-red-100 text-red-800 border-red-300 animate-pulse' 
                            : isLowMargin 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}>
                          {isLoss ? <TrendingDown className="w-3 h-3 text-red-600" /> : <TrendingUp className="w-3 h-3 text-emerald-600" />}
                          {line.marginPct}%
                        </span>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {isLoss ? 'Loss-Making' : isLowMargin ? 'Low Margin' : 'Standard Margin'}
                        </div>
                      </td>

                      {/* Discount */}
                      <td className="p-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={line.discount === 0 ? '0' : line.discount || ''}
                            onChange={(e) => handleFieldChange(line.item.id, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full pl-5 pr-2 py-1.5 text-right font-bold text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </td>

                      {/* Taxable */}
                      <td className="p-3 text-right font-medium text-slate-700">
                        ₹{line.amounts.taxableAmount.toFixed(2)}
                      </td>

                      {/* Line Total */}
                      <td className="p-3 text-right font-black text-slate-900 text-sm">
                        ₹{line.amounts.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Summary Calculation Panel */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 text-xs text-slate-600">
              <p className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>GST Tax Breakdown Summary</span>
              </p>
              <p>
                Gross Subtotal: <strong>₹{totals.gross.toFixed(2)}</strong> &bull; Total Discounts: <strong>₹{totals.discount.toFixed(2)}</strong>
              </p>
              <p>
                Taxable Value: <strong>₹{totals.taxable.toFixed(2)}</strong> &bull; {isLocalGst ? `CGST: ₹${totals.cgst.toFixed(2)} + SGST: ₹${totals.sgst.toFixed(2)}` : `IGST: ₹${totals.igst.toFixed(2)}`}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Final Net Payable</span>
              <span className="text-2xl font-black text-indigo-700 block">
                ₹{totals.grand.toLocaleString('en-IN')}
              </span>
              {totals.roundOff !== 0 && (
                <span className="text-[11px] text-slate-400">Round-off: ₹{totals.roundOff.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Cancel Overrides
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting || totals.grand <= 0}
              onClick={() => handleSaveOverrides(false)}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Save Overrides
            </button>
            <button
              type="button"
              disabled={isSubmitting || totals.grand <= 0}
              onClick={() => handleSaveOverrides(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-102 active:scale-98 disabled:opacity-50"
            >
              <Receipt className="w-4 h-4 text-white" />
              <span>{isMultiOrder ? 'Proceed to Generate Consolidated Tax Invoice' : 'Proceed to Generate Invoice'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
