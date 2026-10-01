'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, ExternalLink, Check, ChevronDown, 
  ChevronUp, Package, Clock, ShieldAlert, ArrowRight, Eye, Info
} from 'lucide-react';
import { PendingOrderItemWarning, PendingOrderRef } from '@/lib/db';
import ViewPreviousOrderModal from './ViewPreviousOrderModal';

interface PendingItemWarningCardProps {
  warning: PendingOrderItemWarning;
  mode?: 'inline' | 'cart-summary' | 'counter-pos';
  onContinueAnyway?: () => void;
  onViewPreviousOrder?: (orderId: string) => void;
  className?: string;
}

export default function PendingItemWarningCard({
  warning,
  mode = 'inline',
  onContinueAnyway,
  onViewPreviousOrder,
  className = ''
}: PendingItemWarningCardProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleOpenOrder = (orderId: string) => {
    if (onViewPreviousOrder) {
      onViewPreviousOrder(orderId);
    } else {
      setSelectedOrderId(orderId);
    }
  };

  const handleContinue = () => {
    setIsDismissed(true);
    if (onContinueAnyway) {
      onContinueAnyway();
    }
  };

  if (isDismissed) {
    return (
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-800 ${className}`}>
        <span className="flex items-center gap-1.5 font-medium">
          <Info className="w-3.5 h-3.5 text-amber-600" />
          <span>Pending warning acknowledged ({warning.totalPendingDisplay} existing)</span>
        </span>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-[11px]"
        >
          Show Details
        </button>
      </div>
    );
  }

  // 1. COMPACT COUNTER POS MODE
  if (mode === 'counter-pos') {
    const firstOrder = warning.pendingOrders[0];
    return (
      <>
        <div className={`p-2.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs animate-in fade-in-50 duration-150 ${className}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Pending Warning:</span>
              <span className="font-extrabold text-amber-950">{warning.totalPendingDisplay}</span>
              <span className="font-normal text-amber-800">already pending from {warning.pendingOrders.length} order(s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {firstOrder && (
                <button
                  onClick={() => handleOpenOrder(firstOrder.orderId)}
                  className="px-2 py-0.5 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{firstOrder.orderNumber}</span>
                  <ExternalLink className="w-3 h-3 text-amber-600" />
                </button>
              )}
              <button
                onClick={handleContinue}
                className="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
              >
                Continue
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

  // 2. INLINE ITEM-LEVEL WARNING CARD (Default)
  return (
    <>
      <div className={`rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-slate-800 shadow-2xs space-y-2.5 animate-in fade-in-50 duration-150 ${className}`}>
        
        {/* Header Alert Title */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-amber-950 uppercase tracking-wide text-[11px]">
                  Pending Order Warning
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 font-bold text-[10px]">
                  {warning.packSize}
                </span>
              </div>
              <p className="text-amber-900 font-medium text-xs mt-0.5">
                <strong className="font-black text-amber-950">{warning.productName}</strong> already has <strong className="font-black text-amber-950 underline decoration-amber-400">{warning.totalPendingDisplay}</strong> unfulfilled/pending in earlier orders for this retailer.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-amber-700 hover:text-amber-900 p-1 rounded hover:bg-amber-200/50 transition-colors cursor-pointer"
            title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Quantities Comparison Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-white/90 border border-amber-200 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Existing Pending</span>
            <span className="font-extrabold text-amber-800 text-sm">{warning.totalPendingDisplay}</span>
            <span className="text-[10px] text-slate-500 block font-medium">({warning.pendingOrders.length} previous order{warning.pendingOrders.length > 1 ? 's' : ''})</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">New Order Quantity</span>
            <span className="font-extrabold text-slate-900 text-sm">{warning.newOrderDisplay}</span>
            <span className="text-[10px] text-slate-500 block font-medium">Current cart input</span>
          </div>
          <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-amber-100 pt-1 sm:pt-0 sm:pl-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Primary Order Ref</span>
            <span className="font-mono font-bold text-indigo-700 block truncate">{warning.pendingOrders[0]?.orderNumber || '—'}</span>
            <span className="text-[10px] text-slate-500 block">{warning.pendingOrders[0]?.orderDate ? new Date(warning.pendingOrders[0].orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}</span>
          </div>
        </div>

        {/* Detailed Breakdown of Previous Orders (Expandable or Default for Multi-order) */}
        {(isExpanded || warning.pendingOrders.length > 1) && (
          <div className="space-y-1.5 pt-1 border-t border-amber-200/70">
            <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider block">
              Previous Open Orders Breakdown:
            </span>
            <div className="space-y-1.5">
              {warning.pendingOrders.map((ord) => (
                <div key={ord.orderId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-amber-100/50 border border-amber-200/80 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-indigo-800">{ord.orderNumber}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${ord.channelBadgeClass}`}>
                        {ord.channel}
                      </span>
                      <span className="text-slate-400 text-[10px]">&bull;</span>
                      <span className="text-slate-600 text-[11px]">
                        {ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                      <span>Ordered: <strong>{ord.displayOrdered}</strong></span>
                      <span>&bull;</span>
                      <span>Dispatched: <strong className="text-emerald-700">{ord.displayDispatched}</strong></span>
                      <span>&bull;</span>
                      <span className="text-amber-900 font-bold">Pending: <strong>{ord.displayPending}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenOrder(ord.orderId)}
                    className="self-start sm:self-center px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-indigo-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>View Order</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons: Non-blocking workflow */}
        <div className="flex items-center justify-between pt-1 gap-2 border-t border-amber-200/60">
          <div className="flex items-center gap-2">
            {warning.pendingOrders[0] && (
              <button
                type="button"
                onClick={() => handleOpenOrder(warning.pendingOrders[0].orderId)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-amber-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>View Previous Order</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
          >
            <span>Continue Anyway</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
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

// ----------------------------------------------------
// MULTI-ITEM CART REVIEW WARNING BANNER
// ----------------------------------------------------

interface CartPendingSummaryBannerProps {
  warnings: PendingOrderItemWarning[];
  onReviewItems?: () => void;
  onContinueOrder?: () => void;
  onViewOrder?: (orderId: string) => void;
  className?: string;
}

export function CartPendingSummaryBanner({
  warnings,
  onReviewItems,
  onContinueOrder,
  onViewOrder,
  className = ''
}: CartPendingSummaryBannerProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (!warnings || warnings.length === 0) return null;

  const handleInspect = (orderId: string) => {
    if (onViewOrder) {
      onViewOrder(orderId);
    } else {
      setSelectedOrderId(orderId);
    }
  };

  return (
    <>
      <div className={`p-4 rounded-2xl bg-amber-50/95 border-2 border-amber-400 text-slate-800 shadow-md space-y-3 animate-in slide-in-from-top-2 duration-200 ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-950 tracking-tight">
                ⚠️ {warnings.length} item{warnings.length > 1 ? 's' : ''} already have pending quantities
              </h4>
              <p className="text-xs text-amber-900 mt-0.5">
                The selected retailer already has unfulfilled orders for the following items. Please review to avoid unintended duplicate ordering:
              </p>
            </div>
          </div>
        </div>

        {/* Affected Items List */}
        <div className="space-y-1.5 divide-y divide-amber-200/60 bg-white/90 rounded-xl p-2.5 border border-amber-200">
          {warnings.map((w, idx) => (
            <div key={w.productId + idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{w.productName}</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                    {w.packSize}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Existing Pending: <strong className="text-amber-800">{w.totalPendingDisplay}</strong></span>
                  <span>&bull;</span>
                  <span>New Order: <strong className="text-slate-800">{w.newOrderDisplay}</strong></span>
                </div>
              </div>

              {w.pendingOrders[0] && (
                <button
                  type="button"
                  onClick={() => handleInspect(w.pendingOrders[0].orderId)}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-indigo-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  <Eye className="w-3 h-3 text-indigo-600" />
                  <span>{w.pendingOrders[0].orderNumber}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Banner Action Bar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-amber-800 font-medium italic">
            This is a warning only. You can proceed with new order.
          </span>
          <div className="flex items-center gap-2">
            {onReviewItems && (
              <button
                type="button"
                onClick={onReviewItems}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-amber-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Review Items
              </button>
            )}
            {onContinueOrder && (
              <button
                type="button"
                onClick={onContinueOrder}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span>Continue With Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
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
