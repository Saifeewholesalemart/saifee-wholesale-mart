'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import {
  Order,
  OrderItem,
  Product,
  Retailer,
  calculateItemAmounts,
  splitBaseQuantity,
  calculateBaseQuantity,
  formatQuantityDisplay,
  deriveOrderChannel
} from '@/lib/db';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Package,
  Edit3,
  Trash2,
  Plus,
  Minus,
  Check,
  Clock,
  Store,
  FileText,
  Copy,
  Info,
  DollarSign,
  ShieldCheck,
  Tag,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface OrderReviewModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderConfirmed?: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
  onOrderCancelled?: (order: Order) => void;
  role?: 'retailer' | 'sales_dist' | 'sales_co' | 'admin' | string;
}

export default function OrderReviewModal({
  orderId,
  isOpen,
  onClose,
  onOrderConfirmed,
  onOrderUpdated,
  onOrderCancelled,
  role
}: OrderReviewModalProps) {
  const {
    orders,
    products,
    retailers,
    fullyConfirmOrder,
    confirmOrder,
    cancelOrder,
    updateOrder,
    updateOrderItemQuantity,
    removeOrderItem,
    currentUser
  } = useDb();

  const order = orders.find(o => o.id === orderId);
  const retailer = order ? retailers.find(r => r.id === order.retailer_id) : undefined;
  const channelObj = order ? deriveOrderChannel(order) : undefined;

  // Active user role context
  const activeRole = role || currentUser?.role || 'retailer';
  const isRetailer = activeRole === 'retailer';
  const isSalesperson = activeRole === 'sales_dist' || activeRole === 'sales_co';
  const isAdmin = activeRole === 'admin' || currentUser?.role === 'admin';

  // Mode: 'view' | 'edit'
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Editable local state for items and notes
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');

  // Sync state whenever modal opens or order changes
  useEffect(() => {
    if (order) {
      setEditableItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
      setOrderNotes(order.admin_notes || order.review_notes || '');
      setIsEditing(false);
      setShowCancelConfirm(false);
      setFeedback(null);
    }
  }, [order, isOpen]);

  // Derived financial calculation for the order
  const financialSummary = useMemo(() => {
    const itemsToCalc = isEditing ? editableItems : (order?.items || []);
    let taxableSubtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    let totalPieces = 0;
    let totalCartons = 0;
    let totalLoose = 0;

    itemsToCalc.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || item.units_per_box_carton || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty ?? 0;
      const lQty = item.loose_qty ?? 0;
      const bQty = item.base_qty ?? item.quantity ?? (cQty * unitsPerPack + lQty);

      totalPieces += bQty;
      totalCartons += cQty;
      totalLoose += lQty;

      const cartonRate = item.carton_rate ?? item.base_price ?? prod?.selling_price ?? 0;
      const looseRate = item.loose_rate ?? prod?.loose_selling_price ?? (cartonRate / unitsPerPack);
      const cartonDisc = item.carton_discount ?? item.discount ?? 0;
      const looseDisc = item.loose_discount ?? 0;
      const gstPercent = item.gst_percent ?? prod?.gst_percent ?? 0;

      const amounts = calculateItemAmounts(cQty, lQty, cartonRate, looseRate, cartonDisc, looseDisc, gstPercent);
      taxableSubtotal += amounts.taxableAmount;
      totalDiscount += amounts.discountAmount;
      totalGst += amounts.gstAmount;
    });

    const grandTotal = Math.round(taxableSubtotal + totalGst);
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    return {
      taxableSubtotal,
      totalDiscount,
      totalGst,
      cgst,
      sgst,
      grandTotal,
      totalPieces,
      totalCartons,
      totalLoose,
      totalItemsCount: itemsToCalc.length
    };
  }, [editableItems, order?.items, isEditing, products]);

  if (!isOpen || !order) return null;

  const isConfirmed = order.status === 'Confirmed' || order.status === 'Partially Confirmed' || order.status === 'Packed' || order.status === 'Dispatched' || order.status === 'Delivered' || order.status === 'Completed';
  const isCancelled = order.status === 'Cancelled';
  const isPendingConfirmation = order.status === 'Submitted' || order.status === 'Under Review' || order.status === 'Draft';

  // Copy order number to clipboard
  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Edit quantity of an item in edit mode
  const handleUpdateItemQuantity = (index: number, type: 'carton' | 'loose', delta: number) => {
    setEditableItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };
      const prod = products.find(p => p.id === target.product_id);
      const unitsPerPack = target.units_per_trading_unit || target.units_per_box_carton || prod?.units_per_box_carton || 1;

      let cQty = target.carton_qty ?? 0;
      let lQty = target.loose_qty ?? 0;

      if (type === 'carton') {
        cQty = Math.max(0, cQty + delta);
      } else {
        lQty = Math.max(0, lQty + delta);
      }

      const baseQty = (cQty * unitsPerPack) + lQty;
      const cartonRate = target.carton_rate ?? target.base_price ?? prod?.selling_price ?? 0;
      const looseRate = target.loose_rate ?? prod?.loose_selling_price ?? (cartonRate / unitsPerPack);
      const cartonDisc = target.carton_discount ?? target.discount ?? 0;
      const looseDisc = target.loose_discount ?? 0;
      const gstPercent = target.gst_percent ?? prod?.gst_percent ?? 0;

      const amounts = calculateItemAmounts(cQty, lQty, cartonRate, looseRate, cartonDisc, looseDisc, gstPercent);

      target.carton_qty = cQty;
      target.loose_qty = lQty;
      target.base_qty = baseQty;
      target.quantity = baseQty;
      target.discount = amounts.discountAmount;
      target.final_price = amounts.taxableAmount;
      target.gst_amount = amounts.gstAmount;
      target.total_amount = amounts.totalAmount;

      copy[index] = target;
      return copy;
    });
  };

  // Remove an item from the order during editing
  const handleRemoveItem = (index: number) => {
    if (editableItems.length <= 1) {
      setFeedback({ type: 'error', message: 'Order must contain at least 1 item. Use Cancel Order if you wish to cancel.' });
      return;
    }
    setEditableItems(prev => prev.filter((_, i) => i !== index));
  };

  // Save edits made to the order
  const handleSaveEdits = () => {
    if (editableItems.length === 0) {
      setFeedback({ type: 'error', message: 'Cannot save an empty order.' });
      return;
    }

    setIsProcessing(true);
    const userPayload = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const updated = updateOrder(order.id, {
      items: editableItems,
      notes: orderNotes
    }, userPayload);

    setIsProcessing(false);
    setIsEditing(false);
    if (updated) {
      setFeedback({ type: 'success', message: `Order ${order.order_number} details successfully updated!` });
      onOrderUpdated?.(updated);
    }
  };

  // Discard edits
  const handleCancelEdits = () => {
    setEditableItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
    setOrderNotes(order.admin_notes || order.review_notes || '');
    setIsEditing(false);
    setFeedback(null);
  };

  // 1. Confirm Order Action (Double-click protected)
  const handleConfirmOrder = () => {
    if (isProcessing || isConfirmed) return;

    setIsProcessing(true);
    const userPayload = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    // If order was edited prior to confirm, ensure edits are saved first
    if (isEditing) {
      updateOrder(order.id, {
        items: editableItems,
        notes: orderNotes
      }, userPayload);
    }

    const confirmed = fullyConfirmOrder(order.id, userPayload);
    setIsProcessing(false);

    if (confirmed) {
      setFeedback({ type: 'success', message: `🎉 Order ${order.order_number} is now officially CONFIRMED!` });
      onOrderConfirmed?.(confirmed);
    } else {
      setFeedback({ type: 'error', message: 'Unable to confirm order. Please verify order state.' });
    }
  };

  // 3. Cancel Order Action
  const handleExecuteCancel = () => {
    if (isProcessing) return;

    setIsProcessing(true);
    const userPayload = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const cancelled = cancelOrder(order.id, cancelReason || 'Cancelled by User during Review', userPayload);
    setIsProcessing(false);
    setShowCancelConfirm(false);

    if (cancelled) {
      setFeedback({ type: 'info', message: `Order ${order.order_number} has been cancelled.` });
      onOrderCancelled?.(cancelled);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const displayItems = isEditing ? editableItems : (order.items || []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-slate-950/75 backdrop-blur-xs md:p-4 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-review-heading"
    >
      <div className="relative w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-4xl bg-slate-50 md:bg-white md:rounded-2xl shadow-2xl md:border md:border-slate-200 overflow-hidden flex flex-col">

        {/* =========================================================
            HEADER (RESPONSIVE: COMPACT STICKY ON MOBILE, FULL ON DESKTOP)
            ========================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white shrink-0 border-b border-slate-800 pt-[env(safe-area-inset-top,0px)]">
          {/* Mobile Header (< 768px) */}
          <div className="md:hidden px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to previous screen"
                className="flex items-center gap-1.5 text-slate-200 hover:text-white font-extrabold text-sm -ml-1 px-2 py-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all cursor-pointer min-h-[36px]"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-300 shrink-0" />
                <span id="order-review-heading" className="tracking-tight text-white font-extrabold text-sm">Order Review</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order # and Status Badge */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-md font-mono text-xs text-amber-300 font-bold">
                <span>{order.order_number}</span>
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  title="Copy Order Number"
                  aria-label="Copy order number to clipboard"
                  className="hover:text-white transition-colors cursor-pointer ml-0.5 p-0.5"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                isPendingConfirmation
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                  : isConfirmed
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                  : 'bg-rose-500/25 text-rose-300 border border-rose-400/40'
              }`}>
                {isPendingConfirmation && <Clock className="w-3 h-3 text-amber-400 shrink-0" />}
                {isConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                {isCancelled && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />}
                <span className="truncate">
                  {isPendingConfirmation ? 'PENDING CONFIRMATION' : order.status}
                </span>
              </span>
            </div>

            {/* Retailer & Date Details */}
            <div className="text-[11px] text-slate-300 space-y-0.5 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-white truncate">
                <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate text-xs">{retailer?.shop_name || 'Retailer Customer'}</span>
                {retailer?.city && <span className="text-slate-400 font-normal text-[11px] truncate">• {retailer.city}</span>}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300 flex-wrap">
                <span>Channel: <strong className="text-indigo-300 font-semibold">{channelObj?.label || order.channel || 'Direct'}</strong></span>
                <span>•</span>
                <span className="text-slate-400">Date: {new Date(order.order_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>

          {/* Desktop Header (>= 768px) */}
          <div className="hidden md:flex p-5 items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/25 text-indigo-300 border border-indigo-400/30">
                  Order Review &amp; Confirmation
                </span>
                <div className="flex items-center gap-1 bg-white/10 px-2.5 py-0.5 rounded-md font-mono text-xs text-amber-300 font-bold">
                  <span>{order.order_number}</span>
                  <button
                    type="button"
                    onClick={handleCopyOrderNumber}
                    title="Copy Order Number"
                    aria-label="Copy order number"
                    className="hover:text-white transition-colors cursor-pointer ml-1"
                  >
                    {copySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </div>

                {/* Status Badge */}
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wide flex items-center gap-1 ${
                  isPendingConfirmation
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : isConfirmed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                }`}>
                  {isPendingConfirmation && <Clock className="w-3 h-3 text-amber-400" />}
                  {isConfirmed && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {isCancelled && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                  <span>
                    {isPendingConfirmation ? 'ORDER PLACED / PENDING CONFIRMATION' : order.status}
                  </span>
                </span>
              </div>

              {/* Shop & Booking Details */}
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 font-bold text-white">
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  {retailer?.shop_name || 'Retailer Customer'}
                </span>
                <span>&bull;</span>
                <span className="text-slate-300">{retailer?.city || 'Indore'}</span>
                <span>&bull;</span>
                <span>Channel: <strong className="text-indigo-300">{channelObj?.label || order.channel || 'Direct Booking'}</strong></span>
                <span>&bull;</span>
                <span className="text-slate-400">Date: {new Date(order.order_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback / Alert Banner */}
        {feedback && (
          <div className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between border-b shrink-0 ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            feedback.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* =========================================================
            MODAL SCROLLABLE BODY (SINGLE VERTICAL SCROLL CONTAINER)
            ========================================================= */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 bg-slate-50 space-y-3.5 sm:space-y-4">

          {/* =========================================================
              3. MANDATORY REVIEW WARNING
              ========================================================= */}
          {isPendingConfirmation && !isEditing && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-950 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-[11px] sm:text-xs leading-relaxed space-y-1.5">
                  <div className="font-black text-amber-950 uppercase tracking-wider text-[11px] sm:text-xs">
                    MANDATORY ORDER REVIEW
                  </div>
                  <div>
                    <span className="font-bold text-amber-900 block mb-1">Please verify:</span>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-0.5 text-[11px] text-amber-950 font-medium pl-0.5">
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Products</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Quantities</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Rates</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Discounts</span>
                      </li>
                      <li className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Final amount</span>
                      </li>
                    </ul>
                  </div>
                  <p className="pt-1.5 border-t border-amber-200/70 text-[10.5px] sm:text-[11px] text-amber-900 leading-normal">
                    <strong className="font-bold text-emerald-800">&quot;Confirm Order&quot;</strong> will reserve stock and allow the order to proceed to packing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* EDIT MODE BANNER */}
          {isEditing && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-bold text-[11px] sm:text-xs">Editing Order Items &amp; Quantities. Adjust line quantities or notes below.</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleCancelEdits}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Edits
                </button>
              </div>
            </div>
          )}

          {/* CANCEL CONFIRMATION DIALOG */}
          {showCancelConfirm && (
            <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Cancel Order {order.order_number}?</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to cancel this order? This action will set the order status to Cancelled.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cancellation Reason (Optional):</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Retailer requested cancellation / Wrong items entered"
                  className="w-full px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer min-h-[36px]"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCancel}
                  disabled={isProcessing}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors min-h-[36px]"
                >
                  {isProcessing ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              4 & 5. ORDER LINE ITEMS (MOBILE CARD DESIGN + DESKTOP TABLE)
              ========================================================= */}
          <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* 6. Section Header & Total Ordered Summary */}
            <div className="p-3 sm:px-4 sm:py-3 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  ORDER ITEMS ({displayItems.length})
                </h3>
              </div>
              <div className="text-[11px] font-bold text-slate-700 sm:text-slate-500 bg-slate-50 sm:bg-transparent px-2.5 sm:px-0 py-1 sm:py-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200/80 flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
                <span className="text-slate-500 uppercase text-[10px] font-bold sm:hidden">Total Ordered:</span>
                <span className="text-indigo-950 sm:text-slate-600 font-extrabold sm:font-bold">
                  {financialSummary.totalPieces} Pieces <span className="text-slate-500 font-normal">({financialSummary.totalCartons} Cartons{financialSummary.totalLoose > 0 ? ` + ${financialSummary.totalLoose} Loose` : ''})</span>
                </span>
              </div>
            </div>

            {/* =========================================================
                DESKTOP TABLE VIEW (>= 768px / md:block)
                ========================================================= */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Product Name &amp; Variant</th>
                    <th className="py-2.5 px-3 text-center">Trading Unit</th>
                    <th className="py-2.5 px-3 text-center">Ordered Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Discount</th>
                    <th className="py-2.5 px-3 text-right">Final Rate</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                    {isEditing && <th className="py-2.5 px-3 text-center w-12">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayItems.map((item, idx) => {
                    const prod = products.find(p => p.id === item.product_id);
                    const unitsPerPack = item.units_per_trading_unit || item.units_per_box_carton || prod?.units_per_box_carton || 1;
                    const cQty = item.carton_qty ?? 0;
                    const lQty = item.loose_qty ?? 0;
                    const baseQty = item.base_qty ?? item.quantity ?? (cQty * unitsPerPack + lQty);

                    const cartonRate = item.carton_rate ?? item.base_price ?? prod?.selling_price ?? 0;
                    const looseRate = item.loose_rate ?? prod?.loose_selling_price ?? (cartonRate / unitsPerPack);
                    const cartonDisc = item.carton_discount ?? item.discount ?? 0;
                    const looseDisc = item.loose_discount ?? 0;
                    const finalRate = Math.max(0, cartonRate - cartonDisc);
                    const gstPercent = item.gst_percent ?? prod?.gst_percent ?? 0;

                    const amounts = calculateItemAmounts(cQty, lQty, cartonRate, looseRate, cartonDisc, looseDisc, gstPercent);

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3.5 text-center text-slate-400 font-mono font-bold text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-900 text-xs">
                            {prod?.name || item.product_id}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px]">
                            {item.selected_mrp || prod?.mrp ? (
                              <span className="font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                MRP ₹{item.selected_mrp ?? prod?.mrp}
                              </span>
                            ) : null}
                            {prod?.brand && (
                              <span className="text-slate-500 font-medium">Brand: {prod.brand}</span>
                            )}
                            {prod?.pack_size && (
                              <span className="text-slate-500 font-medium">Pack: {prod.pack_size}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[11px]">
                            {item.trading_unit || prod?.trading_unit || 'Carton'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {!isEditing ? (
                            <div>
                              <span className="font-extrabold text-indigo-900 block text-xs">
                                {formatQuantityDisplay(baseQty, unitsPerPack, item.trading_unit || prod?.trading_unit, item.base_unit || prod?.base_unit)}
                              </span>
                              {cQty > 0 && lQty > 0 && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {cQty} Ctn + {lQty} Loose
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              {/* Carton Stepper */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase w-7 text-right">Ctn:</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(idx, 'carton', -1)}
                                  className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center font-bold text-xs">{cQty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(idx, 'carton', 1)}
                                  className="w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                              {/* Loose Stepper */}
                              {unitsPerPack > 1 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase w-7 text-right">Pcs:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(idx, 'loose', -1)}
                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="w-6 text-center font-bold text-xs">{lQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(idx, 'loose', 1)}
                                    className="w-5 h-5 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                          ₹{cartonRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-700 font-semibold">
                          {cartonDisc > 0 ? `-₹${cartonDisc.toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          ₹{finalRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm">
                          ₹{amounts.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        {isEditing && (
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* =========================================================
                MOBILE CARD LIST VIEW (< 768px / md:hidden)
                ========================================================= */}
            <div className="md:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
              {displayItems.map((item, idx) => {
                const prod = products.find(p => p.id === item.product_id);
                const unitsPerPack = item.units_per_trading_unit || item.units_per_box_carton || prod?.units_per_box_carton || 1;
                const cQty = item.carton_qty ?? 0;
                const lQty = item.loose_qty ?? 0;
                const baseQty = item.base_qty ?? item.quantity ?? (cQty * unitsPerPack + lQty);

                const cartonRate = item.carton_rate ?? item.base_price ?? prod?.selling_price ?? 0;
                const looseRate = item.loose_rate ?? prod?.loose_selling_price ?? (cartonRate / unitsPerPack);
                const cartonDisc = item.carton_discount ?? item.discount ?? 0;
                const looseDisc = item.loose_discount ?? 0;
                const finalRate = Math.max(0, cartonRate - cartonDisc);
                const gstPercent = item.gst_percent ?? prod?.gst_percent ?? 0;

                const amounts = calculateItemAmounts(cQty, lQty, cartonRate, looseRate, cartonDisc, looseDisc, gstPercent);

                return (
                  <div
                    key={item.id || idx}
                    className="bg-slate-50/75 border border-slate-200/90 rounded-xl p-3 space-y-2.5 transition-colors"
                  >
                    {/* Item Header & Product Name (Multi-line wrap, no truncation) */}
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug break-words">
                            {prod?.name || item.product_id}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                            {item.selected_mrp || prod?.mrp ? (
                              <span className="font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded">
                                MRP ₹{item.selected_mrp ?? prod?.mrp}
                              </span>
                            ) : null}
                            {prod?.pack_size && (
                              <span className="px-1.5 py-0.5 bg-white text-slate-600 border border-slate-200 rounded font-medium">
                                Pack: {prod.pack_size}
                              </span>
                            )}
                            {prod?.brand && (
                              <span className="px-1.5 py-0.5 bg-white text-slate-500 border border-slate-200 rounded font-medium">
                                {prod.brand}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded font-bold">
                              {item.trading_unit || prod?.trading_unit || 'Carton'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2-Column Label/Value Key Details */}
                    <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium text-[11px]">Qty</span>
                        <span className="font-bold text-indigo-900 text-xs text-right">
                          {formatQuantityDisplay(baseQty, unitsPerPack, item.trading_unit || prod?.trading_unit, item.base_unit || prod?.base_unit)}
                          {cQty > 0 && lQty > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal block">
                              ({cQty} Ctn + {lQty} Loose)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium text-[11px]">Rate</span>
                        <span className="font-mono font-semibold text-slate-700 text-xs">
                          ₹{cartonRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium text-[11px]">Discount</span>
                        <span className={`font-mono text-xs ${cartonDisc > 0 ? 'font-bold text-amber-700' : 'text-slate-500'}`}>
                          {cartonDisc > 0 ? `-₹${cartonDisc.toFixed(2)}` : '₹0.00'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium text-[11px]">Final Rate</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          ₹{finalRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wide">Line Total</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          ₹{amounts.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Editing Steppers & Controls on Mobile */}
                    {isEditing && (
                      <div className="pt-1.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Carton Stepper */}
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Ctn</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(idx, 'carton', -1)}
                              aria-label="Decrease carton quantity"
                              className="w-7 h-7 min-w-[28px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-bold text-sm flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-7 text-center font-bold text-xs">{cQty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(idx, 'carton', 1)}
                              aria-label="Increase carton quantity"
                              className="w-7 h-7 min-w-[28px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-sm flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Loose Stepper */}
                          {unitsPerPack > 1 && (
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Pcs</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, 'loose', -1)}
                                aria-label="Decrease loose quantity"
                                className="w-7 h-7 min-w-[28px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-bold text-sm flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-7 text-center font-bold text-xs">{lQty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, 'loose', 1)}
                                aria-label="Increase loose quantity"
                                className="w-7 h-7 min-w-[28px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-sm flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* =========================================================
              7 & 8. ORDER NOTES & FINANCIAL SUMMARY
              ========================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">

            {/* 7. Order Notes Card */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl md:rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ORDER NOTES</span>
                  </span>
                  {!isEditing && isPendingConfirmation && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer min-h-[32px] px-1.5 flex items-center"
                    >
                      Edit Notes
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Enter delivery instructions, dispatch priority, or customer remarks..."
                    rows={3}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[50px] break-words">
                    {orderNotes || order.admin_notes || order.review_notes || 'No special notes entered for this order.'}
                  </p>
                )}
              </div>

              {/* Order Meta Info */}
              <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span>Order Created By:</span>
                  <strong className="text-slate-800 truncate ml-2">{order.created_by || 'Direct / Salesperson'}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Source Channel:</span>
                  <strong className="text-slate-800 truncate ml-2">{channelObj?.label || order.channel || 'Direct'}</strong>
                </div>
              </div>
            </div>

            {/* 8. Financial Summary Card */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl md:rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>FINANCIAL SUMMARY</span>
              </h4>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between items-center">
                  <span>Order Subtotal:</span>
                  <strong className="text-slate-800 font-mono">
                    ₹{financialSummary.taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>

                {financialSummary.totalDiscount > 0 && (
                  <div className="flex justify-between items-center text-amber-700">
                    <span>Total Discount:</span>
                    <strong className="font-mono">
                      -₹{financialSummary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>CGST:</span>
                  <span className="font-mono">
                    ₹{financialSummary.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>SGST:</span>
                  <span className="font-mono">
                    ₹{financialSummary.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 text-slate-900">
                  <div>
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wide block">FINAL ORDER VALUE</span>
                    <span className="text-[10px] text-slate-400 font-medium">Inclusive of all taxes &amp; discounts</span>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
                    ₹{financialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* =========================================================
            9. BOTTOM ACTION BAR (STICKY, MOBILE-FIRST & ACCESSIBLE)
            ========================================================= */}
        <div className="shrink-0 bg-white md:bg-slate-100 border-t border-slate-200 shadow-lg md:shadow-none p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {/* Mobile Action Bar (< 768px) */}
          <div className="md:hidden space-y-2">
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdits}
                  className="w-full min-h-[44px] px-3 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                >
                  <span>Discard</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={isProcessing}
                  className="w-full min-h-[44px] px-3 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Edits</span>
                </button>
              </div>
            ) : isPendingConfirmation ? (
              <div className="space-y-2">
                {/* Row 1: Secondary Edit & Cancel buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    disabled={isProcessing}
                    className="w-full min-h-[44px] px-3 py-2 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Edit Order</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isProcessing}
                    className="w-full min-h-[44px] px-3 py-2 bg-white hover:bg-rose-50 active:scale-98 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cancel</span>
                  </button>
                </div>

                {/* Row 2: Full-width Primary CONFIRM ORDER Button */}
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={isProcessing}
                  className="w-full min-h-[48px] px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black rounded-xl text-sm shadow-md shadow-emerald-900/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Confirming Order...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>CONFIRM ORDER</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {isConfirmed && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Order Confirmed</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Close Review</span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop Action Bar (>= 768px) */}
          <div className="hidden md:flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Cancel Order Action */}
              {isPendingConfirmation && !isEditing && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancel Order</span>
                </button>
              )}

              {/* Edit Order Action */}
              {isPendingConfirmation && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-h-[40px]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Order</span>
                </button>
              )}

              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdits}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer min-h-[40px]"
                  >
                    Discard Edits
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer min-h-[40px]"
                  >
                    Save Edits
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px]"
              >
                {isConfirmed ? 'Done / Close' : 'Close & Review Later'}
              </button>

              {/* Confirm Order Action Button */}
              {isPendingConfirmation && !isEditing && (
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-900/10 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>CONFIRM ORDER</span>
                    </>
                  )}
                </button>
              )}

              {isConfirmed && (
                <div className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px]">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Order Confirmed</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
