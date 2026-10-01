'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, Retailer, Product, Invoice, DeliveryChallan, InventoryBatch, Payment, BatchAllocation, FifoBatchSuggestion,
  formatQuantityDisplay, formatItemQuantityDisplay, splitBaseQuantity, calculateBaseQuantity, formatUnitName, OrderItem,
  calculateItemQuantities, calculateOrderQuantities, deriveOrderChannel, formatAutoBoxQuantity, formatProductStockDisplay,
  getProductTradeMode
} from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import { 
  X, Check, AlertTriangle, Eye, CheckSquare, Package, Truck, 
  Receipt, CreditCard, FileText, ArrowRight, ArrowLeft, Printer, 
  Calendar, MapPin, Phone, User, Store, ShieldCheck, Clock,
  DollarSign, RefreshCw, History, Info, ChevronRight, Layers,
  Copy, AlertCircle, Warehouse, Sparkles, CheckCircle2, Edit3, Tag, Combine
} from 'lucide-react';
import { printInvoiceDocument } from '@/lib/printInvoice';

interface OrderProcessingWorkflowModalProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  initialStage?: 'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan';
}

type StageType = 'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan';

export default function OrderProcessingWorkflowModal({
  orderId,
  isOpen,
  onClose,
  initialStage
}: OrderProcessingWorkflowModalProps) {
  const { 
    orders, retailers, products, inventory, batches, invoices, deliveryChallans, payments, profiles,
    updateOrderStatus, confirmOrderQuantities, allocateAndPackOrder, dispatchOrder, recordOrderPayment,
    getFifoBatchSuggestions, updateOrderItemRate, fullyConfirmOrder, confirmOrder, cancelOrderItemQuantity,
    completeOrder, currentUser, updateOrderItemQuantity, removeOrderItem
  } = useDb();

  const order = orders.find(o => o.id === orderId);
  const retailer = order ? retailers.find(r => r.id === order.retailer_id) : undefined;
  const salesperson = order?.created_by ? profiles.find(p => p.id === order.created_by) : undefined;

  const otherOrdersForRetailer = useMemo(() => {
    if (!order || !order.retailer_id) return [];
    return orders.filter(o => 
      o.retailer_id === order.retailer_id && 
      o.id !== order.id && 
      o.status !== 'Delivered' && 
      o.status !== 'Cancelled'
    );
  }, [order, orders]);

  // Derive initial active stage based on order status or initialStage prop
  const getInitialActiveStage = (): StageType => {
    if (initialStage) return initialStage;
    if (!order) return 'review';
    switch (order.status) {
      case 'Submitted':
        return 'review';
      case 'Under Review':
        return 'confirm';
      case 'Confirmed':
      case 'Partially Confirmed':
        return 'pack';
      case 'Packed':
      case 'Ready for Dispatch':
        return 'dispatch';
      case 'Partially Dispatched':
      case 'Dispatched':
        return 'invoice';
      case 'Delivered':
      case 'Completed':
        return 'invoice';
      default:
        return 'review';
    }
  };

  const [activeStage, setActiveStage] = useState<StageType>(getInitialActiveStage);
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string } | null>(null);

  // Rate Editing Modal within workflow
  const [rateEditTarget, setRateEditTarget] = useState<{
    item: OrderItem;
    product?: Product;
    currentRate: number;
    flatDiscount: number;
    newRate: number;
    reason: string;
  } | null>(null);

  // Quantity Editing Modal state within workflow
  const [quantityEditTarget, setQuantityEditTarget] = useState<{
    item: OrderItem;
    product?: Product;
    pieceQty: number | '';
    cartonQty?: number | '';
    looseQty?: number | '';
    tradingUnit: string;
    baseUnit: string;
    unitsPerPack: number;
  } | null>(null);

  // Stage 1: Review State
  const [adminNotes, setAdminNotes] = useState(order?.admin_notes || order?.review_notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Stage 2: Quantity Confirmation State (itemId -> { confirmedQty, pendingReason })
  const [itemConfirms, setItemConfirms] = useState<{ [itemId: string]: number }>({});
  const [itemPendingReasons, setItemPendingReasons] = useState<{ [itemId: string]: string }>({});

  // Stage 3: Batch Allocations State (itemId -> BatchAllocation[])
  const [batchAllocations, setBatchAllocations] = useState<{ [itemId: string]: BatchAllocation[] }>({});
  const [packingGodownFilter, setPackingGodownFilter] = useState<string>('all');

  // Stage 4: Dispatch Form State
  const [transportMode, setTransportMode] = useState(order?.dispatch_transport_mode || 'Distributor Delivery Van');
  const [vehicleNumber, setVehicleNumber] = useState(order?.dispatch_vehicle_number || 'MH-04-AZ-4592');
  const [deliveryPerson, setDeliveryPerson] = useState(order?.dispatch_delivery_person || 'Ramesh Sawant (Van Staff)');
  const [dispatchNotes, setDispatchNotes] = useState(order?.dispatch_notes || 'Packed in corrugated cartons. Handle with care.');
  const [dispatchDate, setDispatchDate] = useState(order?.dispatched_at ? order.dispatched_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [dispatchGodown, setDispatchGodown] = useState(order?.dispatch_godown || 'Main Godown - Bhiwandi Bay 1');

  // Stage 6: Payment Recording Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | 'Credit' | 'Bank Transfer' | 'Other'>('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Toast / feedback message
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Calculate order metrics according to strict distributor formulas
  const orderMetrics = useMemo(() => {
    if (!order) return null;
    return calculateOrderQuantities(order, products);
  }, [order, products]);

  // Initialize confirmations and batch suggestions when order loads or changes
  useEffect(() => {
    if (!order) return;

    // Initialize item confirms & pending reasons
    const initialConfirms: { [itemId: string]: number } = {};
    const initialReasons: { [itemId: string]: string } = {};

    order.items?.forEach(item => {
      const inv = inventory.find(i => i.product_id === item.product_id);
      const avail = inv?.available_qty || 0;
      const totalBase = item.base_qty || item.quantity;
      if (item.confirmed_qty !== undefined && item.confirmed_qty > 0) {
        initialConfirms[item.id] = item.confirmed_qty;
      } else {
        initialConfirms[item.id] = Math.min(totalBase, Math.max(0, avail));
      }
      initialReasons[item.id] = item.pending_reason || 'Stock Unavailable';
    });
    setItemConfirms(initialConfirms);
    setItemPendingReasons(initialReasons);

    // Initialize batch allocations with FIFO suggestions
    const initialAllocations: { [itemId: string]: BatchAllocation[] } = {};
    order.items?.forEach(item => {
      if (item.batch_allocations && item.batch_allocations.length > 0) {
        initialAllocations[item.id] = item.batch_allocations;
      } else {
        const targetQty = item.confirmed_qty || item.quantity;
        const suggestions = getFifoBatchSuggestions(item.product_id, targetQty, undefined, item.selected_mrp);
        initialAllocations[item.id] = suggestions.map(s => ({
          batch_id: s.batch.id,
          batch_number: s.batch.batch_number,
          allocated_qty: s.suggested_qty,
          godown: s.batch.godown,
          cost_layer: s.batch.cost_layer,
          purchase_rate: s.batch.purchase_rate,
          mrp: s.batch.mrp,
          selling_price: s.batch.selling_price,
          expiry_date: s.batch.expiry_date,
          entry_date: s.batch.entry_date
        }));
      }
    });
    setBatchAllocations(initialAllocations);

    // Find linked invoice to set default payment amount
    const linkedInvoice = invoices.find(i => i.order_ref_id === order.id || i.id === order.invoice_id);
    if (linkedInvoice) {
      setPaymentAmount(linkedInvoice.outstanding_amount);
    }
  }, [order, inventory, batches, invoices]);

  if (!isOpen || !order || !retailer) return null;

  const linkedInvoice = invoices.find(i => i.order_ref_id === order.id || i.id === order.invoice_id);
  const linkedChallan = deliveryChallans.find(c => c.order_id === order.id || c.id === order.challan_id);
  const channelObj = deriveOrderChannel(order);

  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const updateAllocation = (itemId: string, batch: InventoryBatch, val: number) => {
    setBatchAllocations(prev => {
      const currentAlloc = prev[itemId] || [];
      const filtered = currentAlloc.filter(a => a.batch_id !== batch.id);
      if (val > 0) {
        filtered.push({
          batch_id: batch.id,
          batch_number: batch.batch_number,
          allocated_qty: val,
          godown: batch.godown,
          cost_layer: batch.cost_layer,
          purchase_rate: batch.purchase_rate,
          mrp: batch.mrp,
          selling_price: batch.selling_price,
          expiry_date: batch.expiry_date,
          entry_date: batch.entry_date
        });
      }
      return {
        ...prev,
        [itemId]: filtered
      };
    });
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    updateOrderStatus(order.id, order.status, adminNotes);
    setTimeout(() => {
      setIsSavingNotes(false);
      setFeedbackMsg({ type: 'success', text: 'Internal admin notes updated successfully.' });
    }, 300);
  };

  // Option A: 1-Click Fully Confirm
  const handle1ClickFullyConfirm = () => {
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const updated = fullyConfirmOrder(order.id, adminUser);
    if (updated) {
      setFeedbackMsg({ 
        type: 'success', 
        text: `Order ${order.order_number} fully confirmed! All quantities reserved. Proceeding to FIFO packing.` 
      });
      setActiveStage('pack');
    }
  };

  // Option B: Edit Rate Save
  const handleSaveRateChange = () => {
    if (!rateEditTarget) return;
    const { item, newRate, flatDiscount, reason } = rateEditTarget;
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const updated = updateOrderItemRate(order.id, item.id, newRate, flatDiscount, reason, adminUser);
    if (updated) {
      setFeedbackMsg({ 
        type: 'success', 
        text: `Rate updated successfully for ${rateEditTarget.product?.name || 'item'}. Flat discount ₹${flatDiscount.toFixed(2)} applied.` 
      });
      setRateEditTarget(null);
    }
  };

  // Edit Ordered Quantity Save
  const handleSaveQuantityEdit = () => {
    if (!quantityEditTarget || !order) return;
    const { item, pieceQty, cartonQty, looseQty, product } = quantityEditTarget;
    const pQty = pieceQty !== undefined && pieceQty !== '' 
      ? Number(pieceQty) 
      : ((Number(cartonQty) || 0) + (Number(looseQty) || 0));
    
    if (pQty === 0) {
      if (!confirm(`Setting quantity to 0 will remove "${product?.name || 'this item'}" from Order ${order.order_number}. Continue?`)) {
        return;
      }
      removeOrderItem(order.id, item.id);
      setFeedbackMsg({
        type: 'info',
        text: `Removed item "${product?.name || 'item'}" from Order ${order.order_number}.`
      });
      setQuantityEditTarget(null);
      return;
    }

    const updated = updateOrderItemQuantity(order.id, item.id, pQty, 0);
    if (updated) {
      // Also update itemConfirms
      setItemConfirms(prev => ({
        ...prev,
        [item.id]: Math.min(pQty, prev[item.id] !== undefined ? prev[item.id] : pQty)
      }));
      setFeedbackMsg({
        type: 'success',
        text: `Updated quantity for ${product?.name || 'item'}: ${pQty} Pcs.`
      });
      setQuantityEditTarget(null);
    }
  };

  // Option C: Save Quantity Confirmation
  const handleSaveQuantityConfirmation = () => {
    const confirmsArray = Object.entries(itemConfirms).map(([itemId, confirmedQty]) => {
      const item = order.items?.find(i => i.id === itemId);
      const totalOrdered = item?.base_qty || item?.quantity || 0;
      const reason = confirmedQty < totalOrdered ? (itemPendingReasons[itemId] || 'Stock Unavailable') : undefined;
      return {
        itemId,
        confirmedQty,
        pendingReason: reason
      };
    });

    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const updated = confirmOrder(order.id, confirmsArray, adminUser);
    if (updated) {
      setFeedbackMsg({ 
        type: 'success', 
        text: `Quantities confirmed! Order status updated to ${updated.status}.` 
      });
      setActiveStage('pack');
    }
  };

  const handleConfirmPacking = () => {
    const allocationsArray = Object.entries(batchAllocations).map(([orderItemId, allocList]) => ({
      orderItemId,
      batchAllocations: allocList.filter(a => a.allocated_qty > 0)
    }));

    const updated = allocateAndPackOrder(order.id, allocationsArray);
    if (updated) {
      setFeedbackMsg({ type: 'success', text: 'Stock allocated via FIFO and order marked Ready for Dispatch!' });
      setActiveStage('dispatch');
    }
  };

  // Option A Dispatch: With Delivery Challan
  const handleDispatchWithChallan = () => {
    if (!confirm('Execute Dispatch with Delivery Challan? This will deduct batch stock and generate a Tax Invoice & Delivery Challan.')) {
      return;
    }

    const res = dispatchOrder(order.id, {
      transportMode,
      vehicleNumber,
      deliveryPerson,
      notes: dispatchNotes,
      dispatchDate: new Date(dispatchDate).toISOString(),
      dispatchGodown,
      generateChallan: true
    });

    if (res) {
      setFeedbackMsg({ 
        type: 'success', 
        text: res.challan 
          ? `Order dispatched with Delivery Challan ${res.challan.challan_number}! Tax Invoice ${res.invoice.invoice_number} generated.`
          : `Order dispatched! Tax Invoice ${res.invoice.invoice_number} generated.`
      });
      setActiveStage('invoice');
    }
  };

  // Option B Dispatch: Direct Invoice without Delivery Challan
  const handleDispatchWithoutChallan = () => {
    if (!confirm('Execute Dispatch WITHOUT Delivery Challan? This will deduct batch stock and generate a direct Tax Invoice.')) {
      return;
    }

    const res = dispatchOrder(order.id, {
      transportMode,
      vehicleNumber,
      deliveryPerson,
      notes: dispatchNotes,
      dispatchDate: new Date(dispatchDate).toISOString(),
      dispatchGodown,
      generateChallan: false
    });

    if (res) {
      setFeedbackMsg({ 
        type: 'success', 
        text: `Order dispatched directly! Tax Invoice ${res.invoice.invoice_number} generated without Delivery Challan.` 
      });
      setActiveStage('invoice');
    }
  };

  // Payment Recording & Account Settlement
  const handleRecordPayment = () => {
    if (!linkedInvoice) {
      alert('Invoice not found for this order. Please dispatch the order first.');
      return;
    }

    // For Credit / Pay Later, amount is automatically 100% of the invoice balance
    const effectiveAmount = paymentMethod === 'Credit' 
      ? linkedInvoice.outstanding_amount 
      : (paymentAmount > 0 ? paymentAmount : linkedInvoice.outstanding_amount);

    if (effectiveAmount <= 0 && paymentMethod !== 'Credit') {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    const defaultRef = paymentMethod === 'Credit' 
      ? (paymentRef.trim() || 'CREDIT-ON-ACCOUNT') 
      : paymentRef.trim();

    const defaultNotes = paymentMethod === 'Credit'
      ? (paymentNotes.trim() || `Credit / Pay Later terms confirmed for Invoice ${linkedInvoice.invoice_number}`)
      : (paymentNotes.trim() || `Payment collection for Invoice ${linkedInvoice.invoice_number}`);

    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    const res = recordOrderPayment(
      order.id,
      linkedInvoice.id,
      effectiveAmount,
      paymentMethod,
      defaultRef,
      defaultNotes,
      adminUser
    );

    if (res) {
      if (paymentMethod === 'Credit') {
        setFeedbackMsg({ 
          type: 'success', 
          text: `Credit terms of ${formatINR(effectiveAmount)} confirmed for ${retailer.shop_name}! Booked to retailer account (Pay Later).` 
        });
      } else {
        setFeedbackMsg({ 
          type: 'success', 
          text: `Payment of ${formatINR(effectiveAmount)} recorded successfully via ${paymentMethod}! Retailer outstanding reduced.` 
        });
      }
      setPaymentAmount(0);
      setPaymentRef('');
      setPaymentNotes('');
    }
  };

  // Complete Order
  const handleCompleteOrder = () => {
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const updated = completeOrder(order.id, adminUser);
    if (updated) {
      setFeedbackMsg({ type: 'success', text: `Order ${order.order_number} has been officially marked as COMPLETED!` });
    }
  };

  const totalOrderedQty = order.items?.reduce((s, i) => s + (i.base_qty || i.quantity), 0) || 0;
  const totalConfirmedQty = Object.values(itemConfirms).reduce((s, v) => s + v, 0);
  const totalPendingQty = Math.max(0, totalOrderedQty - totalConfirmedQty);

  const totalConfirmedAmount = order.items?.reduce((s, item) => {
    const conf = itemConfirms[item.id] !== undefined ? itemConfirms[item.id] : (item.confirmed_qty !== undefined ? item.confirmed_qty : item.quantity);
    const itemTotal = (item.total_amount && item.total_amount > 0)
      ? item.total_amount
      : (((item.final_applied_rate || item.base_price) - (item.discount || 0)) * item.quantity);
    const ratio = item.quantity > 0 ? (conf / item.quantity) : 1;
    return s + (itemTotal * ratio);
  }, 0) || 0;

  const totalPendingAmount = order.items?.reduce((s, item) => {
    const conf = itemConfirms[item.id] !== undefined ? itemConfirms[item.id] : (item.confirmed_qty !== undefined ? item.confirmed_qty : item.quantity);
    const totalBase = item.base_qty || item.quantity;
    const pend = Math.max(0, totalBase - conf);
    const itemTotal = (item.total_amount && item.total_amount > 0)
      ? item.total_amount
      : (((item.final_applied_rate || item.base_price) - (item.discount || 0)) * item.quantity);
    const ratio = totalBase > 0 ? (pend / totalBase) : 0;
    return s + (itemTotal * ratio);
  }, 0) || 0;

  const isOrderFullyFulfilled = orderMetrics ? orderMetrics.totalUnfulfilledBase === 0 : (totalPendingQty === 0 && ['Dispatched', 'Delivered', 'Completed'].includes(order.status));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-6xl xl:max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-800 text-base">{order.order_number}</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(order.order_number);
                    setFeedbackMsg({ type: 'info', text: 'Order number copied to clipboard.' });
                  }}
                  className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                  title="Copy Order Number"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider ${channelObj.badgeClass}`}>
                  {channelObj.label}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider ${
                  order.status === 'Submitted' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  order.status === 'Under Review' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                  order.status === 'Confirmed' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                  order.status === 'Partially Confirmed' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' :
                  order.status === 'Packed' || order.status === 'Ready for Dispatch' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                  order.status === 'Partially Dispatched' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                  order.status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                  order.status === 'Completed' || order.status === 'Delivered' ? 'bg-emerald-600 text-white font-bold' :
                  'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-bold text-slate-700">{retailer.shop_name}</span> ({retailer.retailer_code}) &bull; {retailer.city} &bull; Ordered: {new Date(order.order_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedbackMsg && (
          <div className={`px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-semibold ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100' :
            feedbackMsg.type === 'error' ? 'bg-red-50 text-red-800 border-b border-red-100' :
            'bg-blue-50 text-blue-800 border-b border-blue-100'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
              {feedbackMsg.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600" />}
              {feedbackMsg.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* WORKFLOW PROGRESS STAGES BAR (EXPANDED & SPACIOUS) */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-50/70 border-b border-slate-200 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max py-0.5">
            {[
              { key: 'review', label: '1. Review Order', icon: Eye, done: ['Under Review', 'Confirmed', 'Partially Confirmed', 'Packed', 'Ready for Dispatch', 'Partially Dispatched', 'Dispatched', 'Delivered', 'Completed'].includes(order.status) },
              { key: 'confirm', label: '2. Confirm Qty', icon: CheckSquare, done: ['Confirmed', 'Partially Confirmed', 'Packed', 'Ready for Dispatch', 'Partially Dispatched', 'Dispatched', 'Delivered', 'Completed'].includes(order.status) },
              { key: 'pack', label: '3. FIFO Packing', icon: Package, done: ['Packed', 'Ready for Dispatch', 'Partially Dispatched', 'Dispatched', 'Delivered', 'Completed'].includes(order.status) },
              { key: 'dispatch', label: '4. Dispatch', icon: Truck, done: ['Partially Dispatched', 'Dispatched', 'Delivered', 'Completed'].includes(order.status) },
              { key: 'invoice', label: '5. Tax Invoice', icon: Receipt, done: !!linkedInvoice },
              { key: 'payment', label: '6. Payment', icon: CreditCard, done: !!linkedInvoice && ((linkedInvoice.outstanding_amount === 0) || !!linkedInvoice.notes?.includes('Credit / Pay Later')) },
              { key: 'challan', label: '7. Delivery Challan', icon: FileText, done: !!linkedChallan }
            ].map((stg, index, arr) => {
              const Icon = stg.icon;
              const isActive = activeStage === stg.key;
              const isDone = stg.done;
              return (
                <React.Fragment key={stg.key}>
                  <button
                    type="button"
                    onClick={() => setActiveStage(stg.key as StageType)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all cursor-pointer select-none ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300' 
                        : isDone 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isActive ? 'bg-white text-indigo-700' : isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}>
                      {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : (index + 1)}
                    </div>
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : isDone ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className="tracking-tight whitespace-nowrap">{stg.label}</span>
                  </button>
                  {index < arr.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mx-0.5" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* STAGE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-slate-50/50 space-y-5">
          {/* Smart 1-Bill Consolidation Banner */}
          {otherOrdersForRetailer.length > 0 && order && (
            <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Combine className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <span>1 Single Consolidated Invoice Available</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                      {otherOrdersForRetailer.length + 1} Orders Merged
                    </span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {retailer?.shop_name || 'This retailer'} has <strong className="text-purple-700 font-bold">{otherOrdersForRetailer.length} other pending order(s)</strong> across different channels ({otherOrdersForRetailer.map(o => o.order_number).join(', ')}). Combine them into 1 GST Tax Invoice instead of generating multiple separate bills.
                  </p>
                </div>
              </div>
              <a
                href={`/admin/consolidation?retailer=${order.retailer_id}&orderIds=${[order.id, ...otherOrdersForRetailer.map(o => o.id)].join(',')}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Combine className="w-4 h-4" />
                <span>Merge &amp; Generate 1 Bill</span>
              </a>
            </div>
          )}

          {/* STAGE 1: REVIEW ORDER & PRIMARY PROCESSING OPTIONS */}
          {activeStage === 'review' && (
            <div className="space-y-6">
              {/* Top 3 Action Cards (A. Fully Confirm, B. Edit Rate, C. Edit Quantity) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Option A: 1-Click Fully Confirm */}
                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">A</span>
                      <span>Option A: 1-Click Fully Confirm</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Confirms 100% of ordered items, reserves inventory, and locks order for immediate packing.
                    </p>
                  </div>
                  <button
                    onClick={handle1ClickFullyConfirm}
                    className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Fully Confirm (1-Click)</span>
                  </button>
                </div>

                {/* Option B: Edit Rate */}
                <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-xs flex flex-col justify-between hover:border-indigo-400 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-indigo-800 font-extrabold text-sm">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">B</span>
                      <span>Option B: Edit Item Rates</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Apply flat ₹ discount per Box/Carton or override billing rates with full audit trail.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (order.items && order.items.length > 0) {
                        const firstItem = order.items[0];
                        const prod = products.find(p => p.id === firstItem.product_id);
                        const curRate = firstItem.final_applied_rate || (firstItem.order_time_rate ?? firstItem.base_price);
                        const disc = firstItem.carton_discount || firstItem.discount || 0;
                        setRateEditTarget({
                          item: firstItem,
                          product: prod,
                          currentRate: curRate,
                          flatDiscount: disc,
                          newRate: curRate - disc,
                          reason: firstItem.manual_rate_reason || 'Special Distributor Deal'
                        });
                      }
                    }}
                    className="mt-3 w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Adjust Rate / Discount</span>
                  </button>
                </div>

                {/* Option C: Edit Quantity */}
                <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs flex flex-col justify-between hover:border-purple-400 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-purple-800 font-extrabold text-sm">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">C</span>
                      <span>Option C: Partial Quantity Confirmation</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Confirm partial quantities. Difference is cleanly preserved as pending backorders.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveStage('confirm')}
                    className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Proceed to Confirm Qty</span>
                  </button>
                </div>
              </div>

              {/* Retailer Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Retailer Profile</span>
                  <p className="font-extrabold text-slate-800 text-sm leading-tight">{retailer.shop_name}</p>
                  <p className="text-xs text-slate-600 font-medium">Owner: {retailer.owner_name}</p>
                  <p className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {retailer.mobile}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Delivery Destination</span>
                  <p className="text-xs text-slate-700 font-medium flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>{retailer.address}, {retailer.city}</span>
                  </p>
                  <p className="text-xs text-slate-600">GSTIN: <span className="font-semibold text-slate-800">{retailer.gstin || 'Unregistered'}</span></p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Channel &amp; Outstanding</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Channel:</span>
                    <span className="font-bold text-indigo-700">{channelObj.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Outstanding:</span>
                    <span className={`font-bold ${retailer.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatINR(retailer.outstanding)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-600">Credit Limit:</span>
                    <span className="font-semibold text-slate-800">{formatINR(retailer.credit_limit)}</span>
                  </div>
                </div>
              </div>

              {/* Ordered Items Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                    Ordered Items &amp; Rate Snapshot ({order.items?.length || 0})
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">Trading Units (Box / Carton)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="p-3.5">Product Variant</th>
                        <th className="p-3.5 text-center">Unit</th>
                        <th className="p-3.5 text-center">Ordered Qty</th>
                        <th className="p-3.5 text-center">Stock Available</th>
                        <th className="p-3.5 text-right">Order Rate</th>
                        <th className="p-3.5 text-right">Flat Rupee Disc</th>
                        <th className="p-3.5 text-right">GST</th>
                        <th className="p-3.5 text-right">Line Total</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {order.items?.map(item => {
                        const prod = products.find(p => p.id === item.product_id);
                        const inv = inventory.find(i => i.product_id === item.product_id);
                        const avail = inv?.available_qty || 0;
                        const meta = getProductTradeMode(prod);
                        const unitsPerPack = meta.packSize;
                        const isPiecesOnly = meta.tradeMode === 'PIECES' || unitsPerPack <= 1;
                        const totalBase = item.base_qty || item.quantity;
                        const isStockShortage = avail < totalBase;
                        const unitRate = item.final_applied_rate || (item.order_time_rate ?? item.base_price);
                        const disc = item.carton_discount || item.discount || 0;
                        const effectiveRate = unitRate - disc;
                        const lineSubtotal = item.total_amount ? (item.total_amount / (1 + ((prod?.gst_percent || 18) / 100))) : (effectiveRate * totalBase);
                        const gstRate = (prod?.gst_percent || 18) / 100;
                        const lineGst = item.gst_amount || (lineSubtotal * gstRate);
                        const lineTotal = item.total_amount || (lineSubtotal + lineGst);
                        const autoOrdered = formatAutoBoxQuantity(totalBase, prod);

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 block text-sm">{prod?.name || 'Product'}</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                                  MRP ₹{item.selected_mrp ?? (totalBase > 0 && totalBase < unitsPerPack && prod?.loose_mrp ? prod.loose_mrp : prod?.mrp) ?? prod?.mrp ?? 0}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs">
                                <span className="text-slate-500 font-medium">
                                  Brand: <strong className="text-slate-700 font-bold">{prod?.brand}</strong> &bull; {isPiecesOnly ? 'Pieces Only' : `Pack: ${prod?.pack_size} (${unitsPerPack} Pieces/Ctn)`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRateHistoryTarget({ retailerId: order.retailer_id, productId: item.product_id, tradingUnit: item.trading_unit })}
                                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Last 5 Billed Rates</span>
                                </button>
                              </div>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-bold text-xs">
                                {isPiecesOnly ? 'Pieces' : (meta.tradeMode === 'CARTONS' ? 'Carton' : 'Carton/Pcs')}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setQuantityEditTarget({
                                    item,
                                    product: prod,
                                    pieceQty: totalBase,
                                    cartonQty: totalBase,
                                    looseQty: 0,
                                    tradingUnit: isPiecesOnly ? 'Piece' : 'Carton',
                                    baseUnit: 'Piece',
                                    unitsPerPack
                                  });
                                }}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-purple-50 text-slate-900 font-extrabold text-sm border border-transparent hover:border-purple-200 transition-all cursor-pointer"
                                title="Click to edit ordered pieces"
                              >
                                <span>{autoOrdered.displayOrdered}</span>
                                <Edit3 className="w-3 h-3 text-purple-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                                avail <= 0 ? 'bg-red-100 text-red-700 border border-red-200' :
                                isStockShortage ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {avail <= 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                                <span>{formatProductStockDisplay(avail, prod, true)}</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-bold text-slate-800 text-sm">
                              ₹{unitRate.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-amber-700 text-sm">
                              {disc > 0 ? `₹${disc}/Pc` : '₹0'}
                            </td>
                            <td className="p-3.5 text-right text-slate-600 text-xs">
                              {prod?.gst_percent || 18}% ({formatINR(lineGst)})
                            </td>
                            <td className="p-3.5 text-right font-black text-indigo-700 text-sm">
                              {formatINR(lineTotal)}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuantityEditTarget({
                                      item,
                                      product: prod,
                                      pieceQty: totalBase,
                                      cartonQty: totalBase,
                                      looseQty: 0,
                                      tradingUnit: isPiecesOnly ? 'Piece' : 'Carton',
                                      baseUnit: 'Piece',
                                      unitsPerPack
                                    });
                                  }}
                                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Edit Ordered Quantity (Pieces)"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  <span>Edit Qty</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRateEditTarget({
                                      item,
                                      product: prod,
                                      currentRate: unitRate,
                                      flatDiscount: disc,
                                      newRate: unitRate - disc,
                                      reason: item.manual_rate_reason || 'Special Distributor Deal'
                                    });
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Edit Rate / Flat Discount"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Rate</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Internal Notes & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    Distributor Internal Notes / Instructions
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter dispatch instructions, payment commitments, or stock verification notes..."
                    rows={3}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-medium text-slate-800"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Total Ordered Volume:</span>
                      <span className="font-bold text-slate-800">
                        {order.items?.map(item => {
                          const prod = products.find(p => p.id === item.product_id);
                          return formatAutoBoxQuantity(item.base_qty || item.quantity, prod).displayOrdered;
                        }).join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Gross Order Value:</span>
                      <span className="font-bold text-slate-800">{formatINR(order.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-indigo-700 pt-2 border-t border-slate-100">
                      <span>Grand Total:</span>
                      <span>{formatINR(order.total_amount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <button
                      onClick={() => setActiveStage('confirm')}
                      className="w-full sm:flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to Confirm Quantity</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: CONFIRM QUANTITY (WITH EXACT FORMULAS & REASONS) */}
          {activeStage === 'confirm' && (
            <div className="space-y-6">
              {/* Formula Metrics Header Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span>Formula 1: Pending Confirmation</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base font-black text-slate-800">
                      {orderMetrics?.pendingConfirmationBase || 0} Pieces
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Ordered - Confirmed - Cancelled</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    <span>Formula 2: Pending Dispatch</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base font-black text-indigo-700">
                      {orderMetrics?.pendingDispatchBase || 0} Pieces
                    </span>
                    <span className="text-xs text-indigo-600 font-medium">Confirmed - Dispatched</span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/20 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-700 uppercase tracking-wider">
                    <span>Formula 3: Total Remaining Backorder</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base font-black text-cyan-800">
                      {orderMetrics?.totalUnfulfilledBase || 0} Pieces
                    </span>
                    <span className="text-xs text-cyan-700 font-medium">Ordered - Dispatched - Cancelled</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-3.5">Product Variant</th>
                      <th className="p-3.5 text-center">Ordered</th>
                      <th className="p-3.5 text-center">Available Stock</th>
                      <th className="p-3.5 text-center">Confirmed Qty</th>
                      <th className="p-3.5 text-center">Pending Backorder</th>
                      <th className="p-3.5">Pending Reason</th>
                      <th className="p-3.5 text-right">Confirmed Value</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {order.items?.map(item => {
                      const prod = products.find(p => p.id === item.product_id);
                      const inv = inventory.find(i => i.product_id === item.product_id);
                      const avail = inv?.available_qty || 0;
                      const meta = getProductTradeMode(prod);
                      const unitsPerPack = meta.packSize;
                      const isPiecesOnly = meta.tradeMode === 'PIECES' || unitsPerPack <= 1;
                      const totalOrdered = item.base_qty || item.quantity;
                      const confirmedVal = itemConfirms[item.id] !== undefined ? itemConfirms[item.id] : totalOrdered;
                      const pendingVal = Math.max(0, totalOrdered - confirmedVal);
                      const unitRate = item.final_applied_rate || (item.base_price - item.discount);
                      const confAmt = (unitRate * confirmedVal) * (1 + (prod?.gst_percent || 18) / 100);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 block text-sm">{prod?.name}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                                MRP ₹{item.selected_mrp ?? (totalOrdered > 0 && totalOrdered < unitsPerPack && prod?.loose_mrp ? prod.loose_mrp : prod?.mrp) ?? prod?.mrp ?? 0}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium block mt-0.5">
                              {prod?.brand} &bull; {isPiecesOnly ? 'Pieces Only' : `Pack: ${prod?.pack_size} (${unitsPerPack} Pieces/Ctn)`}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-800 text-sm">
                            <button
                              type="button"
                              onClick={() => {
                                setQuantityEditTarget({
                                  item,
                                  product: prod,
                                  pieceQty: totalOrdered,
                                  cartonQty: totalOrdered,
                                  looseQty: 0,
                                  tradingUnit: isPiecesOnly ? 'Piece' : 'Carton',
                                  baseUnit: 'Piece',
                                  unitsPerPack
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer group"
                              title="Click to edit ordered pieces"
                            >
                              <span>{formatAutoBoxQuantity(totalOrdered, prod).displayOrdered}</span>
                              <Edit3 className="w-3 h-3 text-purple-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${
                              avail < totalOrdered ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {formatProductStockDisplay(avail, prod, true)}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => setItemConfirms({
                                    ...itemConfirms,
                                    [item.id]: Math.max(0, confirmedVal - (unitsPerPack > 1 ? unitsPerPack : 1))
                                  })}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                  title={unitsPerPack > 1 ? `-1 Box (${unitsPerPack} pieces)` : '-1 Piece'}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={confirmedVal}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setItemConfirms({
                                      ...itemConfirms,
                                      [item.id]: isNaN(val) ? 0 : Math.max(0, val)
                                    });
                                  }}
                                  className="w-16 text-center text-xs font-bold text-slate-800 outline-none py-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => setItemConfirms({
                                    ...itemConfirms,
                                    [item.id]: confirmedVal + (unitsPerPack > 1 ? unitsPerPack : 1)
                                  })}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                  title={unitsPerPack > 1 ? `+1 Box (${unitsPerPack} pieces)` : '+1 Piece'}
                                >
                                  +
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setItemConfirms({ ...itemConfirms, [item.id]: totalOrdered })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-semibold cursor-pointer"
                                  title="Confirm all ordered pieces"
                                >
                                  Full
                                </button>
                                {avail > 0 && avail !== totalOrdered && (
                                  <button
                                    type="button"
                                    onClick={() => setItemConfirms({ ...itemConfirms, [item.id]: Math.min(totalOrdered, avail) })}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-semibold cursor-pointer"
                                    title="Confirm available stock"
                                  >
                                    Stock
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setItemConfirms({ ...itemConfirms, [item.id]: 0 })}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-semibold cursor-pointer"
                                  title="Set confirmed qty to 0"
                                >
                                  0
                                </button>
                              </div>
                              <span className="block text-[11px] text-slate-500 font-medium">
                                {formatAutoBoxQuantity(confirmedVal, prod).displayOrdered}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-black ${
                              pendingVal > 0 ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'text-slate-400'
                            }`}>
                              {formatAutoBoxQuantity(pendingVal, prod).displayOrdered}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {pendingVal > 0 ? (
                              <select
                                value={itemPendingReasons[item.id] || 'Stock Unavailable'}
                                onChange={(e) => setItemPendingReasons({
                                  ...itemPendingReasons,
                                  [item.id]: e.target.value
                                })}
                                className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-1.5 bg-white text-slate-700 outline-none"
                              >
                                <option value="Stock Unavailable">Stock Unavailable</option>
                                <option value="Partial Stock Available">Partial Stock Available</option>
                                <option value="Awaiting Purchase">Awaiting Purchase</option>
                                <option value="Retailer Requested Later">Retailer Requested Later</option>
                                <option value="Delivery Issue">Delivery Issue</option>
                              </select>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Fully Supplied</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-emerald-600 text-sm">
                            {formatINR(confAmt)}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setQuantityEditTarget({
                                  item,
                                  product: prod,
                                  pieceQty: totalOrdered,
                                  cartonQty: totalOrdered,
                                  looseQty: 0,
                                  tradingUnit: isPiecesOnly ? 'Piece' : 'Carton',
                                  baseUnit: 'Piece',
                                  unitsPerPack
                                });
                              }}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Edit Ordered Quantity (Pieces)"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>Edit Ordered</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                <button
                  onClick={() => setActiveStage('review')}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Review</span>
                </button>
                <button
                  onClick={handleSaveQuantityConfirmation}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Save &amp; Confirm Quantities</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: ALLOCATE STOCK & FIFO PACK */}
          {activeStage === 'pack' && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-purple-900 text-sm">FIFO Stock Allocation &amp; Multi-Batch Packing</h4>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Allocate stock by godown and batch. Earliest eligible entry and cost layers are suggested automatically using FIFO principles.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Warehouse className="w-4 h-4 text-purple-600" />
                  <select
                    value={packingGodownFilter}
                    onChange={(e) => setPackingGodownFilter(e.target.value)}
                    className="border border-purple-200 bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold text-purple-900 outline-none w-full sm:w-auto"
                  >
                    <option value="all">All Warehouse Godowns</option>
                    <option value="Main Godown - Bhiwandi Bay 1">Main Godown - Bhiwandi Bay 1</option>
                    <option value="Central Godown - Indore Hub">Central Godown - Indore Hub</option>
                    <option value="City Godown - South Bay 2">City Godown - South Bay 2</option>
                  </select>
                </div>
              </div>

              {/* Item Batch Allocation Cards */}
              <div className="space-y-4">
                {order.items?.map(item => {
                  const prod = products.find(p => p.id === item.product_id);
                  const meta = getProductTradeMode(prod);
                  const unitsPerPack = meta.packSize;
                  const isPiecesOnly = meta.tradeMode === 'PIECES' || unitsPerPack <= 1;
                  const tradingUnit = isPiecesOnly ? 'Piece' : 'Carton';
                  const confirmed = itemConfirms[item.id] !== undefined ? itemConfirms[item.id] : item.quantity;
                  const currentAlloc = batchAllocations[item.id] || [];
                  const totalAllocated = currentAlloc.reduce((s, a) => s + a.allocated_qty, 0);
                  const isFullyAllocated = totalAllocated === confirmed;
                  const autoReq = formatAutoBoxQuantity(confirmed, prod);
                  const autoAlloc = formatAutoBoxQuantity(totalAllocated, prod);

                  const prodBatches = batches.filter(b => b.product_id === item.product_id && (packingGodownFilter === 'all' || b.godown === packingGodownFilter))
                    .sort((a, b) => new Date(a.entry_date || a.mfg_date || '2026-01-01').getTime() - new Date(b.entry_date || b.mfg_date || '2026-01-01').getTime());

                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-800 text-sm block">{prod?.name}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                              MRP ₹{item.selected_mrp ?? prod?.mrp ?? 0}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {isPiecesOnly ? 'Pieces Only' : `Pack: ${prod?.pack_size} (${unitsPerPack} Pieces/Ctn)`} &bull; Trading Unit: {isPiecesOnly ? 'Pieces' : (meta.tradeMode === 'CARTONS' ? 'Carton' : 'Carton & Pieces')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const suggestions = getFifoBatchSuggestions(item.product_id, confirmed, packingGodownFilter === 'all' ? undefined : packingGodownFilter, item.selected_mrp);
                              setBatchAllocations(prev => ({
                                ...prev,
                                [item.id]: suggestions.map(s => ({
                                  batch_id: s.batch.id,
                                  batch_number: s.batch.batch_number,
                                  allocated_qty: s.suggested_qty,
                                  godown: s.batch.godown,
                                  cost_layer: s.batch.cost_layer,
                                  purchase_rate: s.batch.purchase_rate,
                                  mrp: s.batch.mrp,
                                  selling_price: s.batch.selling_price,
                                  expiry_date: s.batch.expiry_date,
                                  entry_date: s.batch.entry_date
                                }))
                              }));
                            }}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span>⚡ Accept FIFO Suggestions</span>
                          </button>
                          <div className="text-right">
                            <span className="text-xs text-slate-500 block font-bold uppercase tracking-wider">Required</span>
                            <span className="font-extrabold text-slate-800 text-sm">
                              {autoReq.displayOrdered}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-500 block font-bold uppercase tracking-wider">Allocated</span>
                            <span className={`font-black text-sm ${isFullyAllocated ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {autoAlloc.displayOrdered} / {autoReq.displayOrdered}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Batches Table for this Item */}
                      <div className="border border-slate-150 rounded-xl overflow-x-auto shadow-xs">
                        <table className="w-full min-w-[650px] text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                              <th className="p-3">Batch Number</th>
                              <th className="p-3 text-center">Printed MRP</th>
                              <th className="p-3 text-center">Purchase Rate</th>
                              <th className="p-3 text-center">Wholesale Price</th>
                              <th className="p-3 text-center">Location &amp; Layer</th>
                              <th className="p-3 text-center">Available Stock</th>
                              <th className="p-3 text-right">Quantity to Pack</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {prodBatches.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-4 text-center text-slate-500 italic text-xs font-medium">
                                  No active batches found in inventory for this product.
                                </td>
                              </tr>
                            ) : (
                              prodBatches.map((b, bIndex) => {
                                const allocEntry = currentAlloc.find(a => a.batch_id === b.id);
                                const currentQty = allocEntry?.allocated_qty || 0;
                                const { cartonQty: curCtn, looseQty: curLoose } = splitBaseQuantity(currentQty, unitsPerPack);
                                const maxCartons = Math.floor(b.quantity / unitsPerPack);
                                const isEarliest = bIndex === 0;
                                const bSellingPrice = b.selling_price || prod?.selling_price || 0;
                                const bPurchaseRate = b.purchase_rate || 0;

                                return (
                                  <tr key={b.id} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-bold text-slate-800">
                                      {b.batch_number}
                                      {isEarliest && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-black">
                                          FIFO #1
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center font-extrabold text-slate-900">
                                      ₹{b.mrp.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-center font-medium text-slate-600">
                                      ₹{bPurchaseRate.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-center font-bold text-indigo-700">
                                      ₹{bSellingPrice.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-center text-slate-600 text-xs">
                                      <span className="block font-semibold text-slate-800">{b.godown || 'Main Godown'}</span>
                                      <span className="text-xs text-slate-500">{b.cost_layer || 'PO-2026-031'} &bull; {b.entry_date || '2026-03-01'}</span>
                                    </td>
                                    <td className="p-3 text-center font-bold text-slate-700">
                                      <span className="block">{formatProductStockDisplay(b.quantity, prod, true)}</span>
                                    </td>
                                    <td className="p-3 text-right">
                                      {!isPiecesOnly && meta.allowCarton ? (
                                        <div className="inline-flex flex-col items-end gap-1">
                                          <div className="flex items-center gap-1.5 justify-end">
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max={maxCartons}
                                                value={curCtn === 0 && curLoose === 0 && currentQty === 0 ? '' : curCtn}
                                                placeholder="0"
                                                onChange={(e) => {
                                                  const newCtn = Math.max(0, parseInt(e.target.value) || 0);
                                                  const newBase = calculateBaseQuantity(newCtn, curLoose, unitsPerPack);
                                                  const clamped = Math.min(b.quantity, Math.max(0, newBase));
                                                  updateAllocation(item.id, b, clamped);
                                                }}
                                                className="w-16 text-center border border-slate-200 bg-white rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                              />
                                              <span className="text-xs font-bold text-slate-600">Boxes</span>
                                            </div>

                                            {meta.allowPieces && (
                                              <div className="flex items-center gap-1">
                                                <span className="text-slate-300 font-bold">+</span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max={unitsPerPack - 1}
                                                  value={curLoose === 0 && curCtn === 0 && currentQty === 0 ? '' : curLoose}
                                                  placeholder="0"
                                                  onChange={(e) => {
                                                    const newLoose = Math.max(0, parseInt(e.target.value) || 0);
                                                    const newBase = calculateBaseQuantity(curCtn, newLoose, unitsPerPack);
                                                    const clamped = Math.min(b.quantity, Math.max(0, newBase));
                                                    updateAllocation(item.id, b, clamped);
                                                  }}
                                                  className="w-14 text-center border border-slate-200 bg-white rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-xs font-bold text-slate-600">Pieces</span>
                                              </div>
                                            )}
                                          </div>
                                          {currentQty > 0 && (
                                            <span className="text-xs text-indigo-700 font-extrabold block">
                                              = {currentQty} Pieces
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="inline-flex flex-col items-end gap-0.5">
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="0"
                                              max={b.quantity}
                                              value={currentQty === 0 ? '' : currentQty}
                                              placeholder="0"
                                              onChange={(e) => {
                                                const val = Math.min(b.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                                updateAllocation(item.id, b, val);
                                              }}
                                              className="w-16 text-center border border-slate-200 bg-white rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                            />
                                            <span className="text-xs font-bold text-slate-600">Pieces</span>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                <button
                  onClick={() => setActiveStage('confirm')}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Quantities</span>
                </button>
                <button
                  onClick={handleConfirmPacking}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  <span>Confirm Packing &amp; Ready for Dispatch</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: DISPATCH ORDER (TWO EXPLICIT DISPATCH CHOICES) */}
          {activeStage === 'dispatch' && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm">Dispatch Confirmation &amp; Logistics Options</h4>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Choose whether to dispatch with an official Delivery Challan or proceed directly with a Tax Invoice. Inventory is deducted automatically.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold self-start sm:self-auto">
                  Ready for Dispatch
                </span>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Transport &amp; Logistics Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dispatch Godown</label>
                    <select
                      value={dispatchGodown}
                      onChange={(e) => setDispatchGodown(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="Main Godown - Bhiwandi Bay 1">Main Godown - Bhiwandi Bay 1</option>
                      <option value="Central Godown - Indore Hub">Central Godown - Indore Hub</option>
                      <option value="City Godown - South Bay 2">City Godown - South Bay 2</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Transport Mode</label>
                    <select
                      value={transportMode}
                      onChange={(e) => setTransportMode(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="Distributor Delivery Van">Distributor Delivery Van</option>
                      <option value="Auto Rickshaw / Cargo">Auto Rickshaw / Cargo</option>
                      <option value="Tempo (Three Wheeler)">Tempo (Three Wheeler)</option>
                      <option value="Courier / Cargo Agent">Courier / Cargo Agent</option>
                      <option value="Customer Self-Pickup">Customer Self-Pickup</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Vehicle Number</label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="e.g. MH-04-AZ-4592"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Delivery Person / Driver</label>
                    <input
                      type="text"
                      value={deliveryPerson}
                      onChange={(e) => setDeliveryPerson(e.target.value)}
                      placeholder="e.g. Ramesh Sawant"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dispatch Date</label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Gate Pass &amp; Dispatch Notes</label>
                  <input
                    type="text"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="e.g. Packed securely. Handle with care. Payment on delivery."
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* TWO EXPLICIT DISPATCH CHOICES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A: Generate Delivery Challan & Dispatch */}
                <div className="bg-white p-5 rounded-xl border border-cyan-200 shadow-xs flex flex-col justify-between hover:border-cyan-400 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-cyan-800 font-extrabold text-sm">
                      <FileText className="w-4 h-4 text-cyan-600" />
                      <span>Option A: Generate Delivery Challan &amp; Dispatch</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Creates official Delivery Challan with store receiver copy &amp; driver gate pass, generates Tax Invoice, and records transport details.
                    </p>
                  </div>
                  <button
                    onClick={handleDispatchWithChallan}
                    className="mt-4 w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Generate Delivery Challan &amp; Dispatch</span>
                  </button>
                </div>

                {/* Option B: Proceed Without Delivery Challan */}
                <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>Option B: Proceed Without Delivery Challan</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Dispatches order directly with Tax Invoice. Bypasses Delivery Challan creation while maintaining complete audit activity log.
                    </p>
                  </div>
                  <button
                    onClick={handleDispatchWithoutChallan}
                    className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Proceed Without Delivery Challan</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setActiveStage('pack')}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Packing</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: TAX INVOICE VIEW */}
          {activeStage === 'invoice' && (
            <div className="space-y-6">
              {linkedInvoice ? (
                <div id="workflow-tax-invoice" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-black uppercase tracking-wider">
                        TAX INVOICE
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">{linkedInvoice.invoice_number}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Date: {new Date(linkedInvoice.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })} &bull; Place of Supply: {linkedInvoice.place_of_supply}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printInvoiceDocument('workflow-tax-invoice', `Tax Invoice - ${linkedInvoice.invoice_number}`)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer no-print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Invoice</span>
                      </button>
                      {linkedChallan && (
                        <button
                          onClick={() => setActiveStage('challan')}
                          className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Challan</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bill To Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Billed To / Retailer</span>
                      <p className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] tracking-tight uppercase mt-1">{retailer.shop_name}</p>
                      <p className="text-slate-600">{retailer.address}, {retailer.city}</p>
                      <p className="text-slate-500 mt-0.5">GSTIN: <span className="font-semibold text-slate-700">{retailer.gstin || 'Unregistered'}</span></p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Distributor (Supplier)</span>
                      <p className="font-extrabold text-slate-800 mt-1">Saifee General Stores</p>
                      <p className="text-slate-600">Main Market Road, Indore, Madhya Pradesh</p>
                      <p className="text-slate-500 mt-0.5">GSTIN: <span className="font-semibold text-slate-700">23AAAFS1234F1Z9</span></p>
                    </div>
                  </div>

                  {/* Invoice Line Items */}
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          <th className="p-3">#</th>
                          <th className="p-3">Item Description</th>
                          <th className="p-3 text-center">HSN</th>
                          <th className="p-3 text-center">Batch</th>
                          <th className="p-3 text-center">MRP (₹)</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Rate (₹)</th>
                          <th className="p-3 text-right">Disc (₹)</th>
                          <th className="p-3 text-right">Taxable Value</th>
                          <th className="p-3 text-right">GST</th>
                          <th className="p-3 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {linkedInvoice.items?.map((item, idx) => {
                          const prod = products.find(p => p.id === item.product_id);
                          const itemMrp = item.mrp || prod?.mrp || 0;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-400">{idx + 1}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800 block">{prod?.name || 'Item'}</span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    MRP ₹{itemMrp}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500">{item.packing}</span>
                              </td>
                              <td className="p-3 text-center text-slate-600 font-medium">{item.hsn}</td>
                              <td className="p-3 text-center">
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-700">
                                  {item.batch_number || 'BCH-2026-A1'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800">
                                ₹{itemMrp.toFixed(2)}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800">
                                {formatQuantityDisplay(item.base_qty || item.quantity, item.units_per_box_carton || prod?.units_per_box_carton, item.trading_unit, item.base_unit || prod?.base_unit)}
                              </td>
                              <td className="p-3 text-right font-medium text-slate-700">
                                ₹{item.rate.toFixed(2)}
                              </td>
                              <td className="p-3 text-right text-amber-600 font-bold">
                                {item.discount > 0 ? `₹${item.discount}` : '-'}
                              </td>
                              <td className="p-3 text-right font-semibold text-slate-800">
                                ₹{item.taxable_value.toFixed(2)}
                              </td>
                              <td className="p-3 text-right text-slate-600 font-medium">
                                ₹{(item.cgst + item.sgst + item.igst).toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-extrabold text-indigo-700">
                                ₹{item.total_amount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Totals */}
                  <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Taxable Value:</span>
                        <span className="font-bold text-slate-800">₹{linkedInvoice.taxable_value.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST:</span>
                        <span>₹{linkedInvoice.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST:</span>
                        <span>₹{linkedInvoice.sgst.toFixed(2)}</span>
                      </div>
                      {linkedInvoice.igst > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>IGST:</span>
                          <span>₹{linkedInvoice.igst.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                        <span>Grand Total:</span>
                        <span className="text-indigo-700">{formatINR(linkedInvoice.grand_total)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-emerald-600">
                        <span>Amount Paid:</span>
                        <span>{formatINR(linkedInvoice.paid_amount)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-red-600 border-t border-slate-100 pt-1">
                        <span>Remaining Balance:</span>
                        <span>{formatINR(linkedInvoice.outstanding_amount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setActiveStage('dispatch')}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Dispatch</span>
                    </button>
                    <button
                      onClick={() => setActiveStage('payment')}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Record Payment &amp; Settle</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-extrabold text-slate-700 text-sm">Invoice Not Yet Generated</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    The tax invoice will be generated automatically once the order is dispatched in Step 4.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STAGE 6: RECORD PAYMENT & SETTLE ACCOUNT (5 APPROVED METHODS) */}
          {activeStage === 'payment' && (
            <div className="space-y-6">
              {linkedInvoice ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Payment & Settlement Configuration */}
                  <div className="lg:col-span-7 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">Record Payment &amp; Account Settlement</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Settle invoice against cash/bank collections or book to retailer credit ledger</p>
                      </div>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold">
                        {linkedInvoice.invoice_number}
                      </span>
                    </div>

                    {/* Payment Method Selector Cards / Chips */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Select Settlement / Payment Method
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'Credit', label: 'Credit / Pay Later', desc: 'On Account Ledger', icon: CreditCard, color: 'border-purple-300 bg-purple-50/50 text-purple-900', activeColor: 'ring-2 ring-purple-600 bg-purple-100/70 border-purple-600' },
                          { key: 'UPI', label: 'UPI QR / App', desc: 'GPay / PhonePe / Paytm', icon: Sparkles, color: 'border-blue-300 bg-blue-50/50 text-blue-900', activeColor: 'ring-2 ring-blue-600 bg-blue-100/70 border-blue-600' },
                          { key: 'Cash', label: 'Cash Collection', desc: 'Counter / Delivery', icon: DollarSign, color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900', activeColor: 'ring-2 ring-emerald-600 bg-emerald-100/70 border-emerald-600' },
                          { key: 'Bank Transfer', label: 'Bank Transfer', desc: 'NEFT / RTGS / IMPS', icon: Warehouse, color: 'border-sky-300 bg-sky-50/50 text-sky-900', activeColor: 'ring-2 ring-sky-600 bg-sky-100/70 border-sky-600' },
                          { key: 'Other', label: 'Other / Cheque', desc: 'Draft / On Adjust', icon: FileText, color: 'border-slate-300 bg-slate-50/50 text-slate-900', activeColor: 'ring-2 ring-slate-600 bg-slate-100/70 border-slate-600' }
                        ].map(m => {
                          const Icon = m.icon;
                          const isSelected = paymentMethod === m.key;
                          return (
                            <button
                              key={m.key}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(m.key as any);
                                if (linkedInvoice) {
                                  setPaymentAmount(linkedInvoice.outstanding_amount);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected ? m.activeColor : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`} />
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                              </div>
                              <div className="mt-2">
                                <p className="font-bold text-xs text-slate-800 leading-tight">{m.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">{m.desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* METHOD A: CREDIT / PAY LATER (NO MANUAL AMOUNT REQUESTED) */}
                    {paymentMethod === 'Credit' ? (
                      <div className="space-y-4 pt-1">
                        {/* Auto-fetched GST Invoice Amount Card */}
                        <div className="bg-gradient-to-br from-purple-50 via-indigo-50/30 to-purple-50 p-4 rounded-xl border border-purple-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-300">
                              <Sparkles className="w-3.5 h-3.5" />
                              Auto-fetched from GST Invoice
                            </span>
                            <span className="text-xs font-bold text-slate-600">{linkedInvoice.invoice_number}</span>
                          </div>

                          <div className="flex items-baseline justify-between border-b border-purple-100 pb-2">
                            <div>
                              <span className="text-xs font-bold text-slate-700 block">Amount Booked to Credit:</span>
                              <p className="text-xs text-slate-500">Auto-calculated from GST Invoice outstanding balance</p>
                            </div>
                            <span className="text-2xl font-black text-purple-900 tracking-tight">
                              {formatINR(linkedInvoice.outstanding_amount)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs bg-white/80 p-3 rounded-lg border border-purple-100">
                            <div>
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Retailer Shop</span>
                              <p className="font-extrabold text-slate-800 truncate text-xs">{retailer.shop_name}</p>
                              <p className="text-xs text-slate-500">Code: {retailer.retailer_code}</p>
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Total Outstanding</span>
                              <p className="font-black text-red-600 text-xs">{formatINR(retailer.outstanding)}</p>
                              <p className="text-xs text-slate-500">Credit Limit: {formatINR(retailer.credit_limit || 0)}</p>
                            </div>
                          </div>

                          {retailer.credit_limit && retailer.outstanding > retailer.credit_limit && (
                            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 font-semibold">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                              <span>Retailer total outstanding exceeds approved credit limit of {formatINR(retailer.credit_limit)}.</span>
                            </div>
                          )}

                          <div className="text-xs text-purple-800 bg-purple-100/50 p-3 rounded-lg border border-purple-200/60 leading-relaxed font-medium">
                            <span className="font-bold">Accounting Note: </span>
                            Choosing <strong>Credit / Pay Later</strong> settles this invoice on account. The balance of <strong>{formatINR(linkedInvoice.outstanding_amount)}</strong> remains active on the retailer's ledger to be paid later. No immediate cash/bank inflow is collected.
                          </div>
                        </div>

                        {/* Optional Reference and Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Credit Voucher / Ref # (Optional)</label>
                            <input
                              type="text"
                              value={paymentRef}
                              onChange={(e) => setPaymentRef(e.target.value)}
                              placeholder="CREDIT-ON-ACCOUNT"
                              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Remarks / Credit Terms</label>
                            <input
                              type="text"
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="e.g. Due in 15 days / Weekly ledger payment"
                              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 bg-white"
                            />
                          </div>
                        </div>

                        {/* Primary Credit Settlement Button */}
                        <button
                          onClick={handleRecordPayment}
                          className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Confirm Credit / Pay Later Terms ({formatINR(linkedInvoice.outstanding_amount)} on Account)</span>
                        </button>
                      </div>
                    ) : (
                      /* METHOD B: IMMEDIATE MONEY COLLECTION (UPI, CASH, BANK TRANSFER, OTHER) */
                      <div className="space-y-4 pt-1">
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Amount to Collect (₹)
                            </label>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ⚡ Auto-fetched: {formatINR(linkedInvoice.outstanding_amount)}
                            </span>
                          </div>

                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                            <input
                              type="number"
                              min="1"
                              max={linkedInvoice.outstanding_amount}
                              value={paymentAmount || ''}
                              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                              placeholder={String(linkedInvoice.outstanding_amount)}
                              className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-base font-black text-slate-800 outline-none focus:border-indigo-500 bg-white"
                            />
                          </div>

                          {/* Quick Preset Amount Buttons */}
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quick Fill:</span>
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(linkedInvoice.outstanding_amount)}
                              className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Full: {formatINR(linkedInvoice.outstanding_amount)}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(Math.round(linkedInvoice.outstanding_amount * 0.5))}
                              className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              50%: {formatINR(Math.round(linkedInvoice.outstanding_amount * 0.5))}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentAmount(Math.round(linkedInvoice.outstanding_amount * 0.25))}
                              className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              25%: {formatINR(Math.round(linkedInvoice.outstanding_amount * 0.25))}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                              {paymentMethod === 'UPI' ? 'UPI UTR / Transaction ID' : paymentMethod === 'Bank Transfer' ? 'NEFT / RTGS Reference #' : paymentMethod === 'Cash' ? 'Cash Receipt / Bag #' : 'Cheque / Ref #'}
                            </label>
                            <input
                              type="text"
                              value={paymentRef}
                              onChange={(e) => setPaymentRef(e.target.value)}
                              placeholder={paymentMethod === 'UPI' ? 'e.g. 402918294012' : paymentMethod === 'Cash' ? 'e.g. CASH-COUNTER-01' : 'e.g. CHQ-991204'}
                              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Notes / Remarks</label>
                            <input
                              type="text"
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="e.g. Paid in full upon delivery"
                              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                            />
                          </div>
                        </div>

                        <div className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-200/60 leading-relaxed font-medium">
                          <span className="font-bold">Ledger Settlement: </span>
                          Recording <strong>{formatINR(paymentAmount || linkedInvoice.outstanding_amount)}</strong> via <strong>{paymentMethod}</strong> will reduce the invoice balance and directly credit <strong>{retailer.shop_name}</strong>'s outstanding debt.
                        </div>

                        <button
                          onClick={handleRecordPayment}
                          disabled={(paymentAmount <= 0 && linkedInvoice.outstanding_amount <= 0)}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            Confirm Payment Collection ({formatINR(paymentAmount > 0 ? paymentAmount : linkedInvoice.outstanding_amount)} via {paymentMethod})
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Invoice Status & Retailer Ledger Status */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Invoice &amp; Ledger Status</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-black ${
                          linkedInvoice.outstanding_amount === 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : linkedInvoice.paid_amount > 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}>
                          {linkedInvoice.outstanding_amount === 0 ? 'Fully Paid' : linkedInvoice.paid_amount > 0 ? 'Partially Paid' : 'Credit / Outstanding'}
                        </span>
                      </div>

                      {/* Financial Breakdown Table */}
                      <div className="p-4 bg-slate-50 rounded-xl space-y-2.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Invoice Number:</span>
                          <span className="font-black text-slate-800">{linkedInvoice.invoice_number}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Invoice Date:</span>
                          <span className="font-semibold text-slate-700">{new Date(linkedInvoice.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Taxable Value:</span>
                          <span>₹{linkedInvoice.taxable_value.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Total GST (CGST+SGST):</span>
                          <span>₹{(linkedInvoice.cgst + linkedInvoice.sgst + linkedInvoice.igst).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-2 text-sm">
                          <span>Invoice Grand Total:</span>
                          <span className="text-indigo-700">{formatINR(linkedInvoice.grand_total)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Amount Collected (Paid):</span>
                          <span>{formatINR(linkedInvoice.paid_amount)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 font-black border-t border-slate-200 pt-2 text-sm">
                          <span>Current Balance Due:</span>
                          <span>{formatINR(linkedInvoice.outstanding_amount)}</span>
                        </div>
                      </div>

                      {/* Retailer Account Summary */}
                      <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2 text-xs">
                        <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Retailer Ledger Overview</span>
                        <div className="flex justify-between text-slate-700">
                          <span>Retailer Name:</span>
                          <span className="font-bold text-slate-900">{retailer.shop_name}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Credit Limit:</span>
                          <span className="font-bold text-slate-900">{formatINR(retailer.credit_limit || 0)}</span>
                        </div>
                        <div className="flex justify-between font-black text-red-600 border-t border-indigo-100 pt-1.5">
                          <span>Total Ledger Debt:</span>
                          <span>{formatINR(retailer.outstanding)}</span>
                        </div>
                      </div>

                      {/* Navigation Actions */}
                      <div className="pt-2 flex items-center justify-between">
                        <button
                          onClick={() => setActiveStage('invoice')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Review Invoice (Step 5)</span>
                        </button>
                        {linkedChallan && (
                          <button
                            onClick={() => setActiveStage('challan')}
                            className="text-xs font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Delivery Challan</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Please dispatch the order first to generate an invoice for payment.</p>
                </div>
              )}
            </div>
          )}

          {/* STAGE 7: DELIVERY CHALLAN */}
          {activeStage === 'challan' && (
            <div className="space-y-6">
              {linkedChallan ? (
                <div id="workflow-challan" className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <span className="px-2.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded text-xs font-black uppercase tracking-wider">
                        DELIVERY CHALLAN
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">{linkedChallan.challan_number}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Order Ref: <span className="font-bold text-slate-700">{linkedChallan.order_number}</span> &bull; Dispatched: {new Date(linkedChallan.dispatch_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printInvoiceDocument('workflow-challan', `Delivery Challan - ${linkedChallan.challan_number}`)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer no-print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Challan</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Consignee Details</span>
                      <p className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] tracking-tight uppercase mt-1">{retailer.shop_name}</p>
                      <p className="text-slate-600">{retailer.address}, {retailer.city}</p>
                      <p className="text-slate-500 mt-0.5">Phone: {retailer.mobile}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Transport / Delivery Info</span>
                      <p className="text-slate-700 mt-1 font-semibold">Mode: {linkedChallan.transport_mode}</p>
                      <p className="text-slate-700 font-semibold">Vehicle #: {linkedChallan.vehicle_number || 'N/A'}</p>
                      <p className="text-slate-700 font-semibold">Delivery Person: {linkedChallan.delivery_person || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          <th className="p-3">#</th>
                          <th className="p-3">Product Name &amp; Variant</th>
                          <th className="p-3 text-center">Batch Number</th>
                          <th className="p-3 text-center">Printed MRP</th>
                          <th className="p-3 text-center">Expiry Date</th>
                          <th className="p-3 text-right">Dispatched Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {linkedChallan.items?.map((item, idx) => {
                          const pObj = products.find(p => p.name === item.product_name || p.id === item.product_id);
                          const unitsPerPack = item.units_per_box_carton || pObj?.units_per_box_carton || 1;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-400">{idx + 1}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800">{item.product_name}</span>
                                  {(item.mrp || pObj?.mrp) && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                      MRP ₹{item.mrp || pObj?.mrp}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-700">
                                  {item.batch_number}
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-slate-800">
                                {item.mrp ? `₹${item.mrp.toFixed(2)}` : '-'}
                              </td>
                              <td className="p-3 text-center text-slate-500 font-medium">
                                {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '2027-02-28'}
                              </td>
                              <td className="p-3 text-right font-extrabold text-slate-800">
                                {formatQuantityDisplay(item.dispatched_qty, unitsPerPack, item.trading_unit, item.base_unit || pObj?.base_unit)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-100 text-xs">
                    <div className="border-t border-slate-300 pt-2 text-center text-slate-500 font-semibold">
                      Receiver Store Stamp &amp; Signature
                    </div>
                    <div className="border-t border-slate-300 pt-2 text-center text-slate-500 font-semibold">
                      For Saifee General Stores (Authorized Signatory)
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Delivery Challan will be created upon order dispatch if Option A is selected.</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* FOOTER BAR (ORDER STATUS & COMPLETION RULE ENFORCEMENT) */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs text-slate-500 font-medium">
              Order Status: <span className="font-extrabold text-slate-800">{order.status}</span>
            </div>
            {orderMetrics && orderMetrics.totalUnfulfilledBase > 0 && order.status !== 'Cancelled' && (
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                Backorder: {orderMetrics.displayPending} remaining
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            {/* If fully fulfilled and not marked completed yet */}
            {isOrderFullyFulfilled && order.status !== 'Completed' && order.status !== 'Cancelled' && (
              <button
                onClick={handleCompleteOrder}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Order Completed</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close Workflow
            </button>
          </div>
        </div>

      </div>

      {/* Rate Editing Inner Modal */}
      {rateEditTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Edit Rate / Flat Rupee Discount</h4>
                <p className="text-xs text-slate-500">{rateEditTarget.product?.name || 'Product Variant'}</p>
              </div>
              <button onClick={() => setRateEditTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Catalogue Base Rate:</span>
                  <span className="font-bold text-slate-800">₹{(rateEditTarget.item.order_time_rate ?? rateEditTarget.item.base_price).toFixed(2)} / {rateEditTarget.item.trading_unit}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Trading Unit:</span>
                  <span className="font-bold text-slate-800">{rateEditTarget.item.trading_unit}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Flat Rupee Discount (₹ per {rateEditTarget.item.trading_unit})
                </label>
                <input
                  type="number"
                  min="0"
                  value={rateEditTarget.flatDiscount}
                  onChange={(e) => {
                    const disc = Math.max(0, parseFloat(e.target.value) || 0);
                    const baseRate = rateEditTarget.item.order_time_rate ?? rateEditTarget.item.base_price;
                    setRateEditTarget({
                      ...rateEditTarget,
                      flatDiscount: disc,
                      newRate: Math.max(0, baseRate - disc)
                    });
                  }}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm font-extrabold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Net Approved Billing Rate (₹ per {rateEditTarget.item.trading_unit})
                </label>
                <input
                  type="number"
                  min="0"
                  value={rateEditTarget.newRate}
                  onChange={(e) => {
                    const rate = Math.max(0, parseFloat(e.target.value) || 0);
                    const baseRate = rateEditTarget.item.order_time_rate ?? rateEditTarget.item.base_price;
                    setRateEditTarget({
                      ...rateEditTarget,
                      newRate: rate,
                      flatDiscount: Math.max(0, baseRate - rate)
                    });
                  }}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm font-extrabold text-indigo-700 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  value={rateEditTarget.reason}
                  onChange={(e) => setRateEditTarget({ ...rateEditTarget, reason: e.target.value })}
                  placeholder="e.g. Bulk deal discount, Retailer loyalty adjustment"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRateEditTarget(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRateChange}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Save Rate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Editing Modal (Dual Packaging) */}
      {quantityEditTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Edit Ordered Quantity</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {quantityEditTarget.product?.name || 'Product Variant'} &bull; {quantityEditTarget.product?.pack_size}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setQuantityEditTarget(null)} 
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Single Piece Packaging Info */}
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-purple-600 font-bold uppercase tracking-wider text-[10px] block">Trading Unit</span>
                <span className="font-extrabold text-purple-900">
                  Strictly 1 Piece (Pcs / Unit)
                </span>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-slate-500 font-medium text-[10px] block">Printed MRP</span>
                <span className="font-black text-slate-800">
                  ₹{quantityEditTarget.product?.mrp || quantityEditTarget.item.selected_mrp || 0}
                </span>
              </div>
            </div>

            {/* Single Numeric Piece Quantity Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Order Quantity (Pieces)</span>
                <span className="text-[10px] text-purple-600 font-bold lowercase">Direct Piece Unit</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantityEditTarget.pieceQty !== undefined && quantityEditTarget.pieceQty !== '' ? quantityEditTarget.pieceQty : quantityEditTarget.cartonQty}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                    setQuantityEditTarget({
                      ...quantityEditTarget,
                      pieceQty: val,
                      cartonQty: val,
                      looseQty: 0
                    });
                  }}
                  placeholder="0"
                  className="w-full border-2 border-slate-200 focus:border-purple-600 rounded-xl p-3 text-base font-black text-slate-900 outline-none transition-all"
                />
                <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-400 pointer-events-none">
                  Pieces
                </span>
              </div>
              {/* Quick Add Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 5, 10, 25, 50].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => {
                      const cur = Number(quantityEditTarget.pieceQty ?? quantityEditTarget.cartonQty ?? 0);
                      const next = cur + inc;
                      setQuantityEditTarget({
                        ...quantityEditTarget,
                        pieceQty: next,
                        cartonQty: next,
                        looseQty: 0
                      });
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 text-[11px] font-bold rounded-md transition-colors cursor-pointer"
                  >
                    +{inc}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuantityEditTarget({ ...quantityEditTarget, pieceQty: 0, cartonQty: 0, looseQty: 0 })}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-md transition-colors cursor-pointer ml-auto"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Live Calculation Preview */}
            {(() => {
              const totalBase = Number(quantityEditTarget.pieceQty ?? quantityEditTarget.cartonQty ?? 0);
              const unitRate = quantityEditTarget.item.final_applied_rate || (quantityEditTarget.item.base_price - (quantityEditTarget.item.discount || 0));
              const gstPercent = quantityEditTarget.product?.gst_percent || 18;
              const taxable = totalBase * unitRate;
              const estValue = taxable * (1 + gstPercent / 100);

              return (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Calculated Quantity:</span>
                    <span className="font-black text-slate-900 text-sm">
                      {totalBase} Pcs
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Rate / Piece:</span>
                    <span className="font-bold text-purple-700">
                      ₹{unitRate.toFixed(2)}/Pc
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 font-extrabold text-slate-800">
                    <span>Est. Line Total (incl. {gstPercent}% GST):</span>
                    <span className="text-indigo-700 text-sm">{formatINR(estValue)}</span>
                  </div>
                  {totalBase === 0 && (
                    <div className="flex items-center gap-1.5 p-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Setting quantity to 0 will remove this line item from the order upon saving.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuantityEditTarget(null)}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuantityEdit}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Quantity</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last 5 Billing Rates Modal */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryTarget}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
        />
      )}
    </div>
  );
}
