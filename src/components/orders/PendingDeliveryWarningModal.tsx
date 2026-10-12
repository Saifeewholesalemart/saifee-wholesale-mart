'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Package, 
  ArrowRight, 
  X, 
  Eye, 
  Store,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PendingOrderItemWarning } from '@/lib/db';
import ViewPreviousOrderModal from './ViewPreviousOrderModal';

export interface PendingDeliveryWarningModalProps {
  warnings: PendingOrderItemWarning[];
  retailerName?: string;
  retailerCode?: string;
  onReviewOrder: () => void;
  onProceedWithOrder: () => void;
  onViewOrderDetails?: (orderId: string) => void;
}

export default function PendingDeliveryWarningModal({
  warnings,
  retailerName,
  retailerCode,
  onReviewOrder,
  onProceedWithOrder,
  onViewOrderDetails
}: PendingDeliveryWarningModalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  if (!warnings || warnings.length === 0) return null;

  const isSingle = warnings.length === 1;
  const singleItem = warnings[0];

  const handleOpenOrder = (orderId: string) => {
    if (onViewOrderDetails) {
      onViewOrderDetails(orderId);
    } else {
      setSelectedOrderId(orderId);
    }
  };

  const toggleExpand = (productId: string) => {
    setExpandedItems(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-warning-title"
      >
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-300 w-full max-w-lg overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-4 sm:p-5 text-white flex items-start justify-between gap-3 shrink-0 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs shrink-0 mt-0.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h3 id="pending-warning-title" className="text-base sm:text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                  <span>Pending Delivery Warning</span>
                </h3>
                {retailerName && (
                  <p className="text-xs text-amber-100 font-medium mt-0.5 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 opacity-80" />
                    <span>Retailer: <strong className="text-white font-bold">{retailerName}</strong> {retailerCode ? `(${retailerCode})` : ''}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onReviewOrder}
              aria-label="Close dialog"
              className="p-1.5 rounded-xl bg-black/10 hover:bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Main Body */}
          <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto">
            
            {/* Context text based on single vs multiple items */}
            {isSingle ? (
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p>
                  The item <strong className="font-extrabold text-slate-900">{singleItem.productName}</strong> — <strong className="font-black text-amber-800 underline decoration-amber-400">{singleItem.totalPendingDisplay}</strong> is already pending for delivery from a previous order to this retailer.
                </p>
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p>
                  The following <strong className="font-bold text-amber-900">{warnings.length} items</strong> are already pending for delivery from previous orders to this retailer:
                </p>
              </div>
            )}

            {/* List of Affected Pending Items */}
            <div className="space-y-2.5">
              {warnings.map((w, idx) => {
                const isExpanded = !!expandedItems[w.productId];
                const hasMultipleOrders = w.pendingOrders && w.pendingOrders.length > 1;

                return (
                  <div 
                    key={w.productId + idx} 
                    className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {w.productName}
                          </span>
                          {w.packSize && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-200/90 text-amber-950 font-bold text-[10px]">
                              {w.packSize}
                            </span>
                          )}
                        </div>

                        {w.brand && (
                          <span className="text-[11px] text-slate-500 font-medium block">
                            Brand: {w.brand}
                          </span>
                        )}
                      </div>

                      {hasMultipleOrders && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(w.productId)}
                          className="text-amber-800 hover:text-amber-950 p-1 rounded hover:bg-amber-200/50 transition-colors cursor-pointer shrink-0"
                          title={isExpanded ? "Hide orders breakdown" : "Show orders breakdown"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {/* Pending Quantity Highlight */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/90 border border-amber-200">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Pending Delivery
                        </span>
                        <span className="font-extrabold text-amber-900 text-xs sm:text-sm">
                          {w.totalPendingDisplay}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          New Order Quantity
                        </span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {w.newOrderDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Primary Order Ref or Multi-Order Breakdown */}
                    {w.pendingOrders && w.pendingOrders.length > 0 && (
                      <div className="pt-1 text-[11px] space-y-1">
                        {!isExpanded && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="truncate">
                              From: <strong className="font-mono font-bold text-indigo-700">{w.pendingOrders[0].orderNumber}</strong>
                              {w.pendingOrders.length > 1 ? ` (+${w.pendingOrders.length - 1} more order${w.pendingOrders.length > 2 ? 's' : ''})` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenOrder(w.pendingOrders[0].orderId)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer shrink-0 ml-2"
                            >
                              View
                            </button>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="space-y-1.5 pt-1 border-t border-amber-200/80">
                            <span className="text-[10px] font-bold uppercase text-amber-900 block">
                              Previous Orders Breakdown:
                            </span>
                            {w.pendingOrders.map(ord => (
                              <div key={ord.orderId} className="flex items-center justify-between p-1.5 rounded bg-white border border-amber-100 text-[11px]">
                                <span className="font-mono font-bold text-indigo-700">{ord.orderNumber}</span>
                                <span className="text-slate-600">Pending: <strong className="text-amber-900 font-bold">{ord.displayPending}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenOrder(ord.orderId)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                                >
                                  View
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* Final Question */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-xs sm:text-sm font-black text-slate-900">
                Do you still want to place this new order?
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Placing this order will NOT modify or overwrite your existing pending orders.
              </p>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onReviewOrder}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer text-center order-2 sm:order-1 shadow-2xs"
            >
              Review Order
            </button>

            <button
              type="button"
              onClick={onProceedWithOrder}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-600/20 active:scale-98 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 order-1 sm:order-2"
            >
              <span>Yes, Place New Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {selectedOrderId && (
        <ViewPreviousOrderModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </>
  );
}
