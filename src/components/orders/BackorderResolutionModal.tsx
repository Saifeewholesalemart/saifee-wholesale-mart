'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, Retailer, Product,
  formatQuantityDisplay, splitBaseQuantity
} from '@/lib/db';
import { 
  X, Clock, AlertTriangle, CheckCircle2, Store, Phone, MapPin,
  RefreshCw, Ban, ArrowRight, ShieldCheck, Tag, Info, CheckSquare, Square
} from 'lucide-react';

interface BackorderResolutionModalProps {
  retailer: Retailer | null;
  backorders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onResolutionComplete?: () => void;
}

export default function BackorderResolutionModal({
  retailer,
  backorders,
  isOpen,
  onClose,
  onResolutionComplete
}: BackorderResolutionModalProps) {
  // 1. Context Hooks (Always at the top)
  const { 
    products = [], mergeBackorderIntoNewOrder, cancelBackorder, shortCloseBackorderItem, currentUser 
  } = useDb();

  // 2. State Hooks (Always at the top)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState('Out of Stock - Indent Closed by Admin');
  const [isProcessing, setIsProcessing] = useState(false);

  // 3. Effect Hooks (Always at the top)
  useEffect(() => {
    if (backorders && Array.isArray(backorders) && backorders.length > 0) {
      setSelectedOrderIds(backorders.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  }, [backorders]);

  // 4. Memo Hooks (Always at the top)
  const { totalShortagePieces, totalShortageValue, backorderItemsList } = useMemo(() => {
    let pieces = 0;
    let value = 0;
    const itemsList: {
      order: Order;
      item: any;
      prod: Product | undefined;
      remQty: number;
      unitRate: number;
      itemValue: number;
    }[] = [];

    if (backorders && Array.isArray(backorders)) {
      backorders.forEach(ord => {
        ord.items?.forEach(it => {
          const prod = products?.find(p => p.id === it.product_id);
          const remQty = it.remaining_qty !== undefined ? it.remaining_qty : ((it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0) - (it.fulfilled_qty || 0) - (it.cancelled_qty || 0));
          if (remQty > 0) {
            const unitRate = it.rate || it.carton_rate || it.base_price || prod?.selling_price || 0;
            const itemValue = (remQty * unitRate);
            pieces += remQty;
            value += itemValue;
            itemsList.push({
              order: ord,
              item: it,
              prod,
              remQty,
              unitRate,
              itemValue
            });
          }
        });
      });
    }

    return {
      totalShortagePieces: pieces,
      totalShortageValue: value,
      backorderItemsList: itemsList
    };
  }, [backorders, products]);

  // 5. Callbacks
  const toggleOrderSelect = useCallback((orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedOrderIds.length === (backorders?.length || 0)) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds((backorders || []).map(o => o.id));
    }
  }, [selectedOrderIds.length, backorders]);

  const handleMergeIntoNewOrder = useCallback(() => {
    if (!retailer) return;
    if (selectedOrderIds.length === 0) {
      alert('Please select at least one backorder to merge.');
      return;
    }

    if (!confirm(`Merge ${selectedOrderIds.length} backorder(s) into a fresh confirmed Order for ${retailer.shop_name}?`)) {
      return;
    }

    setIsProcessing(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const newOrder = mergeBackorderIntoNewOrder(retailer.id, selectedOrderIds, adminUser);
    setIsProcessing(false);

    if (newOrder) {
      alert(`Success! Backorders merged into fresh Order ${newOrder.order_number}. This order is now ready in "Orders to be Packed".`);
      if (onResolutionComplete) onResolutionComplete();
      onClose();
    }
  }, [retailer, selectedOrderIds, currentUser, mergeBackorderIntoNewOrder, onResolutionComplete, onClose]);

  const handleCancelBackorders = useCallback(() => {
    if (selectedOrderIds.length === 0) {
      alert('Please select at least one backorder to cancel.');
      return;
    }

    if (!confirm(`Cancel and void ${selectedOrderIds.length} backorder(s) without generating an invoice? Reason: "${cancelReason}"`)) {
      return;
    }

    setIsProcessing(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    selectedOrderIds.forEach(orderId => {
      cancelBackorder(orderId, cancelReason, adminUser);
    });
    setIsProcessing(false);

    alert(`${selectedOrderIds.length} backorder(s) successfully cancelled and closed.`);
    if (onResolutionComplete) onResolutionComplete();
    onClose();
  }, [selectedOrderIds, cancelReason, currentUser, cancelBackorder, onResolutionComplete, onClose]);

  // 6. Conditional Unmount Check (At the very bottom before returning JSX)
  if (!isOpen || !retailer || !backorders || backorders.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-amber-300">
                  {retailer.shop_name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  Partial Backorders Hub
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                {retailer.address}, {retailer.city} &bull; Owner: {retailer.owner_name} &bull; Phone: {retailer.mobile || retailer.phone || 'N/A'}
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

        {/* Shortage Metrics Banner */}
        <div className="px-5 py-3 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-800 font-semibold">Active Backorders:</span>
              <span className="font-black text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                {backorders.length} Orders
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-800 font-semibold">Total Shortage Pieces:</span>
              <span className="font-black text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                {totalShortagePieces} Pcs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-800 font-semibold">Estimated Shortage Value:</span>
              <span className="font-black text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                ₹{Math.round(totalShortageValue).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSelectAll}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            {selectedOrderIds.length === backorders.length ? (
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{selectedOrderIds.length === backorders.length ? 'Deselect All' : 'Select All'}</span>
          </button>
        </div>

        {/* Table of Backordered SKUs */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-10 text-center">Select</th>
                  <th className="p-3">Source Order & Date</th>
                  <th className="p-3">Backordered SKU</th>
                  <th className="p-3 text-center">Shortage Qty</th>
                  <th className="p-3 text-center">Reason Tag</th>
                  <th className="p-3 text-right">Estimated Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {backorderItemsList.map((entry, idx) => {
                  const isSelected = selectedOrderIds.includes(entry.order.id);
                  const unitsPerPack = entry.item.units_per_trading_unit || entry.prod?.units_per_box_carton || 1;
                  const split = splitBaseQuantity(entry.remQty, unitsPerPack);

                  return (
                    <tr 
                      key={`${entry.order.id}-${entry.item.id || idx}`}
                      className={`transition-colors ${isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOrderSelect(entry.order.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                      </td>

                      {/* Order Number & Date */}
                      <td className="p-3">
                        <span className="font-mono font-black text-slate-900 block">
                          {entry.order.order_number}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {entry.order.order_date ? new Date(entry.order.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block text-sm">
                          {entry.prod?.name || entry.item.product_name || 'Product'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          MRP ₹{entry.item.selected_mrp || entry.prod?.mrp || 0} &bull; SKU: {entry.prod?.sku || entry.item.product_id}
                        </span>
                      </td>

                      {/* Shortage Qty */}
                      <td className="p-3 text-center">
                        <span className="font-black text-amber-900 text-sm block">
                          {entry.remQty} Pcs
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({split.cartonQty} Ctn {split.looseQty > 0 ? `+ ${split.looseQty} Pcs` : ''})
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {entry.item.reason || 'Out of Stock'}
                        </span>
                      </td>

                      {/* Value */}
                      <td className="p-3 text-right font-black text-slate-800 text-sm">
                        ₹{Math.round(entry.itemValue).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cancellation Reason Selector */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <label className="font-bold text-slate-700 block">
              If Cancelling/Closing Backorders, select Cancellation Audit Reason:
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full sm:w-80 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="Out of Stock - Indent Closed by Admin">Out of Stock - Indent Closed by Admin</option>
              <option value="Customer Cancelled Backordered Demand">Customer Cancelled Backordered Demand</option>
              <option value="Discontinued SKU by Manufacturer">Discontinued SKU by Manufacturer</option>
              <option value="Rate Discrepancy - Voided">Rate Discrepancy - Voided</option>
              <option value="Batch Damaged on Floor">Batch Damaged on Floor</option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Close Modal
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isProcessing || selectedOrderIds.length === 0}
              onClick={handleCancelBackorders}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Ban className="w-4 h-4 text-red-600" />
              <span>Cancel / Close ({selectedOrderIds.length})</span>
            </button>

            <button
              type="button"
              disabled={isProcessing || selectedOrderIds.length === 0}
              onClick={handleMergeIntoNewOrder}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-102 active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-white ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Merge ({selectedOrderIds.length}) into Next Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
