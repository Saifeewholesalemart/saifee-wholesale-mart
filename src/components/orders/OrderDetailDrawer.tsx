'use client';

import React, { useState, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, Retailer, Product, Invoice, DeliveryChallan, Payment, OrderItem,
  deriveOrderChannel, formatAutoBoxQuantity, formatProductStockDisplay
} from '@/lib/db';
import { 
  X, Check, AlertTriangle, Package, Truck, Receipt, 
  CreditCard, FileText, ArrowRight, Printer, Calendar, 
  MapPin, Phone, User, Store, ShieldCheck, Clock,
  DollarSign, CheckCircle2, Ban, Copy, ExternalLink,
  ChevronRight, Building2, Warehouse, RefreshCw, Trash2
} from 'lucide-react';
import InvoicePreviewModal from './InvoicePreviewModal';
import OrderProcessingWorkflowModal from './OrderProcessingWorkflowModal';
import ShortCloseBackorderModal from './ShortCloseBackorderModal';
import { BackorderQueueItem, getCompositeKey } from '@/lib/orderTerminalTypes';

interface OrderDetailDrawerProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPacking?: (orderId: string, stage?: 'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan') => void;
}

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderDetailDrawer({
  orderId,
  isOpen,
  onClose,
  onOpenPacking
}: OrderDetailDrawerProps) {
  const { 
    orders, retailers, products, inventory, invoices, deliveryChallans, 
    payments, profiles, companies, godowns, confirmOrder, currentUser,
    deleteOrder
  } = useDb();

  const [copiedOrderNo, setCopiedOrderNo] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedChallan, setSelectedChallan] = useState<DeliveryChallan | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [shortCloseItem, setShortCloseItem] = useState<BackorderQueueItem | null>(null);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [processingStage, setProcessingStage] = useState<'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan'>('review');

  const order = useMemo(() => {
    if (!orderId) return null;
    return orders.find(o => o.id === orderId) || null;
  }, [orderId, orders]);

  const retailer = useMemo(() => {
    if (!order) return null;
    return retailers.find(r => r.id === order.retailer_id) || null;
  }, [order, retailers]);

  const salesperson = useMemo(() => {
    if (!order?.created_by) return null;
    return profiles.find(p => p.id === order.created_by || p.email === order.created_by || p.name === order.created_by) || null;
  }, [order, profiles]);

  const company = useMemo(() => {
    if (!order?.business_id) return companies[0] || null;
    return companies.find(c => c.id === order.business_id || (c as any).business_id === order.business_id) || companies[0] || null;
  }, [order, companies]);

  const godown = useMemo(() => {
    if (!godowns || godowns.length === 0) return null;
    if (order?.dispatch_godown) {
      return godowns.find(g => g.id === order.dispatch_godown || g.name === order.dispatch_godown) || godowns[0];
    }
    return godowns.find(g => g.is_default) || godowns[0];
  }, [order, godowns]);

  // Associated Invoice
  const invoice = useMemo(() => {
    if (!order) return null;
    return invoices.find(inv => 
      inv.order_ref_id === order.id || 
      inv.source_order_ids?.includes(order.id) ||
      inv.order_numbers?.includes(order.order_number) ||
      inv.source_order_numbers?.includes(order.order_number) ||
      (order.invoice_id && inv.id === order.invoice_id)
    ) || null;
  }, [order, invoices]);

  // Associated Delivery Challan
  const deliveryChallan = useMemo(() => {
    if (!order) return null;
    return (deliveryChallans || []).find((dc: DeliveryChallan) => 
      dc.order_id === order.id || 
      dc.order_number === order.order_number || 
      (invoice && dc.invoice_id === invoice.id) ||
      (order.challan_id && dc.id === order.challan_id)
    ) || null;
  }, [order, invoice, deliveryChallans]);

  // Associated Payments
  const orderPayments = useMemo(() => {
    if (!order) return [];
    return payments.filter((p: Payment) => 
      p.retailer_id === order.retailer_id && (
        p.notes?.includes(order.order_number) || 
        p.reference_number === order.order_number || 
        (invoice && (p.notes?.includes(invoice.invoice_number) || p.reference_number === invoice.invoice_number))
      )
    );
  }, [order, invoice, payments]);

  const totalPaid = useMemo(() => {
    return invoice?.paid_amount ?? orderPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [invoice, orderPayments]);

  const totalOrderValue = invoice?.grand_total ?? order?.total_amount ?? 0;
  const outstandingAmount = invoice?.outstanding_amount ?? Math.max(0, totalOrderValue - totalPaid);

  const paymentStatusInfo = useMemo(() => {
    if (totalOrderValue <= 0) {
      return { status: 'PAID', label: 'Paid', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    }
    if (totalPaid >= totalOrderValue) {
      return { status: 'PAID', label: 'Fully Paid', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    }
    if (totalPaid > 0) {
      return { status: 'PARTIAL', label: 'Partial Payment', badgeClass: 'bg-amber-50 text-amber-800 border-amber-300' };
    }
    return { status: 'UNPAID', label: 'Unpaid', badgeClass: 'bg-rose-50 text-rose-800 border-rose-300' };
  }, [totalPaid, totalOrderValue]);

  const channelInfo = useMemo(() => {
    if (!order) return { code: 'counter_sale', label: 'On Counter Sale' as const, badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    return deriveOrderChannel(order);
  }, [order]);

  // Quantities & Fulfillment metrics
  const quantityMetrics = useMemo(() => {
    if (!order || !order.items) return { totalOrdered: 0, totalConfirmed: 0, totalPacked: 0, totalDispatched: 0, totalPending: 0, hasShortage: false };
    
    let totalOrdered = 0;
    let totalConfirmed = 0;
    let totalPacked = 0;
    let totalDispatched = 0;
    let totalPending = 0;

    order.items.forEach(it => {
      const ordQty = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
      const confQty = it.confirmed_qty ?? ordQty;
      const fulQty = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? (order.status === 'Completed' || order.status === 'Dispatched' ? ordQty : 0);
      const canQty = it.cancelled_qty ?? it.cancelled_pieces ?? 0;
      const pckQty = it.packed_qty ?? it.packed_pieces ?? (order.status === 'Packed' || order.status === 'Dispatched' || order.status === 'Completed' ? ordQty : fulQty);
      const remQty = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, ordQty - fulQty - canQty);

      totalOrdered += ordQty;
      totalConfirmed += confQty;
      totalPacked += pckQty;
      totalDispatched += fulQty;
      totalPending += remQty;
    });

    return {
      totalOrdered,
      totalConfirmed,
      totalPacked,
      totalDispatched,
      totalPending,
      hasShortage: totalPending > 0
    };
  }, [order]);

  // Financial summary computation
  const financials = useMemo(() => {
    if (!order || !order.items) {
      return { subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0 };
    }

    let subtotal = 0;
    let totalDiscount = 0;
    let taxable = 0;
    let totalGst = 0;

    order.items.forEach(it => {
      const qty = it.quantity || it.ordered_qty || it.base_qty || 0;
      const rate = it.rate || it.unit_rate || it.carton_rate || it.base_price || 0;
      const disc = it.discount || it.carton_discount || 0;
      const lineTaxable = Math.max(0, (qty * rate) - disc);
      const gstPct = (it.gst_percent !== undefined && it.gst_percent !== null) ? Number(it.gst_percent) : 0;
      const lineGst = lineTaxable * (gstPct / 100);

      subtotal += qty * rate;
      totalDiscount += disc;
      taxable += lineTaxable;
      totalGst += lineGst;
    });

    const isInterstate = false;
    const cgst = isInterstate ? 0 : totalGst / 2;
    const sgst = isInterstate ? 0 : totalGst / 2;
    const igst = isInterstate ? totalGst : 0;
    const grandTotal = Math.round((taxable + totalGst) * 100) / 100;

    return {
      subtotal,
      discount: totalDiscount,
      taxable,
      cgst,
      sgst,
      igst,
      grandTotal: order.total_amount || grandTotal
    };
  }, [order]);

  const copyOrderNumber = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.order_number);
    setCopiedOrderNo(true);
    setTimeout(() => setCopiedOrderNo(false), 2000);
  };

  const handleOpenWorkflow = (stage: 'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan') => {
    if (onOpenPacking && order) {
      onOpenPacking(order.id, stage);
    } else {
      setProcessingStage(stage);
      setIsProcessingModalOpen(true);
    }
  };

  const handleConfirmDirectly = () => {
    if (!order) return;
    const itemConfirms = (order.items || []).map(item => ({
      itemId: item.id,
      confirmedQty: item.ordered_qty ?? item.quantity,
      confirmedCartons: item.carton_qty ?? 0
    }));
    confirmOrder(order.id, itemConfirms, {
      id: currentUser?.id || 'admin',
      name: currentUser?.name || 'Admin'
    });
  };

  if (!isOpen || !order) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer (Mobile Fullscreen, Desktop 750px Wide) */}
      <div className="fixed inset-y-0 right-0 max-w-3xl w-full bg-white z-50 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* =================================================================== */}
        {/* DRAWER HEADER */}
        {/* =================================================================== */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-base sm:text-lg font-black tracking-tight text-indigo-300">
                {order.order_number}
              </span>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Copy Order Number"
              >
                {copiedOrderNo ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border ${channelInfo.badgeClass}`}>
                {channelInfo.label}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                {order.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Booked on {new Date(order.order_date || order.created_at || Date.now()).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })} at {new Date(order.order_date || order.created_at || Date.now()).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* DRAWER BODY (SCROLLABLE) */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
          
          {/* 1. ORDER LIFECYCLE PROGRESS STEPPER */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Order Lifecycle Stage
            </h4>

            {quantityMetrics.hasShortage ? (
              // Partial Lifecycle Bar
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-1">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <div className="text-[10px] uppercase text-emerald-600">Step 1</div>
                  <span>1. Placed</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <div className="text-[10px] uppercase text-emerald-600">Step 2</div>
                  <span>2. Confirmed</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-black">
                  <div className="text-[10px] uppercase text-amber-700">Partial</div>
                  <span>3. Partial Pack</span>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900">
                  <div className="text-[10px] uppercase text-indigo-700">Balance</div>
                  <span>4. {quantityMetrics.totalPending} Pcs Pending</span>
                </div>
              </div>
            ) : (
              // Standard Lifecycle Bar
              <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-bold pt-1">
                {[
                  { label: 'Placed', active: true, done: true },
                  { label: 'Confirmed', active: order.status !== 'Draft' && order.status !== 'Submitted', done: order.status !== 'Draft' && order.status !== 'Submitted' && order.status !== 'Under Review' },
                  { label: 'Packed', active: order.status === 'Packed' || order.status === 'PACKED_AND_SEALED' || order.status === 'Dispatched' || order.status === 'Completed', done: order.status === 'Dispatched' || order.status === 'Completed' },
                  { label: 'Dispatched', active: order.status === 'Dispatched' || order.status === 'Delivered' || order.status === 'Completed', done: order.status === 'Completed' },
                  { label: 'Completed', active: order.status === 'Completed', done: order.status === 'Completed' }
                ].map((st, idx) => (
                  <div 
                    key={st.label}
                    className={`p-2 rounded-xl border transition-all ${
                      st.done 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : st.active 
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-black ring-1 ring-indigo-400/50' 
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="text-[9px] uppercase tracking-wider">{idx + 1}. {st.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. ORDER CONTEXT & RETAILER INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Retailer Info Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                <Store className="w-4 h-4 text-indigo-600" />
                <span>Retailer Customer</span>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">{retailer?.shop_name || 'Retailer Customer'}</h3>
                <p className="text-xs text-slate-600 font-medium">Owner: {retailer?.owner_name || 'N/A'}</p>
              </div>

              <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100 font-medium">
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${retailer?.phone || retailer?.mobile}`} className="text-indigo-600 hover:underline font-mono font-bold">
                    {retailer?.phone || retailer?.mobile || 'No phone'}
                  </a>
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{retailer?.city || 'Nagpur'} &bull; Route: {retailer?.beat_name || retailer?.route || 'Main Market'}</span>
                </p>
                {retailer?.address && (
                  <p className="text-[11px] text-slate-500 pl-5">{retailer.address}</p>
                )}
              </div>
            </div>

            {/* Commercial Context & Ingestion Context */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Commercial &amp; Fulfilment Context</span>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Booked By / Channel:</span>
                  <span className="font-bold text-slate-900">{salesperson?.name ? `${salesperson.name} (${channelInfo.label})` : channelInfo.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Fulfilment Godown:</span>
                  <span className="font-bold text-slate-900">{godown?.name || 'Main Warehouse'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Company / Brand:</span>
                  <span className="font-bold text-slate-900">{company?.name || 'Saifee General Stores'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Distinct Line Items:</span>
                  <span className="font-black font-mono text-indigo-900">{(order.items || []).length} Line Items</span>
                </div>
              </div>

              {order.order_notes && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <strong>Notes:</strong> {order.order_notes}
                </div>
              )}
            </div>

          </div>

          {/* 3. ORDER ITEMS DETAILED TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
            <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  Ordered Line Items ({(order.items || []).length})
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Total Ordered: <strong className="font-mono text-slate-900">{quantityMetrics.totalOrdered} Pcs</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Product &amp; SKU</th>
                    <th className="p-3 text-center">MRP</th>
                    <th className="p-3 text-center">Ordered</th>
                    <th className="p-3 text-center">Packed / Disp</th>
                    <th className="p-3 text-center">Pending</th>
                    <th className="p-3 text-right">Locked Rate</th>
                    <th className="p-3 text-right">Line Total</th>
                    <th className="p-3 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(order.items || []).map((it, idx) => {
                    const prod = products.find(p => p.id === it.product_id);
                    const invItem = inventory.find(i => i.product_id === it.product_id);
                    const availStock = invItem?.available_qty || 0;

                    const ordQty = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
                    const fulQty = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? (order.status === 'Completed' || order.status === 'Dispatched' ? ordQty : 0);
                    const canQty = it.cancelled_qty ?? it.cancelled_pieces ?? 0;
                    const remQty = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, ordQty - fulQty - canQty);
                    const unitRate = it.rate || it.unit_rate || it.carton_rate || it.base_price || prod?.selling_price || 0;
                    const lineTotal = it.total_amount || (ordQty * unitRate);

                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono font-bold text-[11px]">{idx + 1}</td>
                        <td className="p-3 space-y-0.5">
                          <span className="font-extrabold text-slate-900 block">{it.product_name || prod?.name || it.product_id}</span>
                          <span className="text-[10px] font-mono text-slate-500">SKU: {prod?.sku || 'SKU'}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                            ₹{it.mrp || prod?.mrp || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold font-mono text-slate-700">
                          {formatAutoBoxQuantity(ordQty, prod).displayOrdered}
                        </td>
                        <td className="p-3 text-center font-bold font-mono text-indigo-700">
                          {formatAutoBoxQuantity(fulQty, prod).displayOrdered}
                        </td>
                        <td className="p-3 text-center">
                          {remQty > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                              {formatAutoBoxQuantity(remQty, prod).displayOrdered}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">
                          ₹{unitRate.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">
                          {formatINR(lineTotal)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            availStock >= remQty 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {availStock > 0 ? `🟢 ${formatProductStockDisplay(availStock, prod, true)}` : '🔴 0 Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financials Breakdown Footer */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="text-xs text-slate-500 space-y-1">
                <p>Taxation Mode: <strong>GST Registered B2B Invoice</strong></p>
                <p>State: <strong>Maharashtra (27) &bull; Intra-State (CGST + SGST)</strong></p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Taxable Amount:</span>
                  <span className="font-mono font-bold">{formatINR(financials.taxable)}</span>
                </div>
                {financials.cgst > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>CGST (9%):</span>
                    <span className="font-mono">{formatINR(financials.cgst)}</span>
                  </div>
                )}
                {financials.sgst > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>SGST (9%):</span>
                    <span className="font-mono">{formatINR(financials.sgst)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-950 text-base">{formatINR(totalOrderValue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. DOCUMENTS & PAYMENT SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Documents Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>Documents &amp; Invoices</span>
              </div>

              {/* Tax Invoice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">GST Tax Invoice</span>
                    {invoice ? (
                      <span className="font-mono text-xs font-black text-indigo-900">{invoice.invoice_number}</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700">Not Generated</span>
                    )}
                  </div>
                  {invoice && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setSelectedChallan(deliveryChallan);
                        setIsInvoiceModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Invoice</span>
                    </button>
                  )}
                </div>
                {invoice && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    Dated: {new Date(invoice.date).toLocaleDateString('en-IN')} &bull; Amount: {formatINR(invoice.grand_total)}
                  </p>
                )}
              </div>

              {/* Delivery Challan */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Delivery Challan</span>
                    {deliveryChallan ? (
                      <span className="font-mono text-xs font-black text-indigo-900">{deliveryChallan.challan_number}</span>
                    ) : (
                      <span className="text-xs font-bold text-slate-500">Not Generated</span>
                    )}
                  </div>
                  {deliveryChallan && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setSelectedChallan(deliveryChallan);
                        setIsInvoiceModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>View Challan</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Ledger Context */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Payment &amp; Ledger</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${paymentStatusInfo.badgeClass}`}>
                  {paymentStatusInfo.label}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order/Invoice Total:</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(totalOrderValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid Amount:</span>
                  <span className="font-mono font-bold text-emerald-700">{formatINR(totalPaid)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">Outstanding Balance:</span>
                  <span className="font-mono font-black text-rose-600">{formatINR(outstandingAmount)}</span>
                </div>
              </div>

              {orderPayments.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recorded Receipts:</span>
                  {orderPayments.map((p, pIdx) => (
                    <div key={p.id || pIdx} className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-emerald-900">{p.method || 'Cash'}</span>
                        <span className="text-[10px] text-slate-500 block">{p.date || 'Today'}</span>
                      </div>
                      <span className="font-mono font-black text-emerald-800">{formatINR(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* 5. ORDER ACTIVITY TIMELINE */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Order Activity &amp; Audit Trail</span>
            </div>

            <div className="space-y-3 border-l-2 border-slate-200 ml-3 pl-4 text-xs">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -left-[21px] top-1"></div>
                <p className="font-bold text-slate-900">Order Placed &bull; {channelInfo.label}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {new Date(order.order_date || order.created_at || Date.now()).toLocaleString('en-IN')}
                </p>
              </div>

              {order.confirmed_at && (
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 absolute -left-[21px] top-1"></div>
                  <p className="font-bold text-slate-900">Order Quantities Confirmed</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(order.confirmed_at).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              {order.packed_at && (
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 absolute -left-[21px] top-1"></div>
                  <p className="font-bold text-slate-900">Packed by Warehouse Floor</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(order.packed_at).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              {order.dispatched_at && (
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-1"></div>
                  <p className="font-bold text-slate-900">Dispatched &amp; Delivery Challan Generated</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(order.dispatched_at).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              {invoice && (
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 absolute -left-[21px] top-1"></div>
                  <p className="font-bold text-slate-900">Tax Invoice {invoice.invoice_number} Generated</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {new Date(invoice.date).toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* =================================================================== */}
        {/* DRAWER FOOTER / ACTION CONTROLS */}
        {/* =================================================================== */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Action based on status */}
            {(order.status === 'Draft' || order.status === 'Submitted' || order.status === 'Under Review') && (
              <button
                type="button"
                onClick={handleConfirmDirectly}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Order</span>
              </button>
            )}

            {(order.status === 'Confirmed' || order.status === 'Partially Confirmed') && (
              <button
                type="button"
                onClick={() => handleOpenWorkflow('pack')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Package className="w-4 h-4" />
                <span>Pack Order</span>
              </button>
            )}

            {(order.status === 'Packing' || order.status === 'PACKING_IN_PROGRESS') && (
              <button
                type="button"
                onClick={() => handleOpenWorkflow('pack')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Continue Packing</span>
              </button>
            )}

            {(order.status === 'Packed' || order.status === 'PACKED_AND_SEALED' || order.status === 'Ready for Dispatch') && (
              <button
                type="button"
                onClick={() => handleOpenWorkflow('dispatch')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Dispatch &amp; Generate Challan</span>
              </button>
            )}

            {quantityMetrics.hasShortage && order.status !== 'Completed' && (
              <button
                type="button"
                onClick={() => handleOpenWorkflow('pack')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs hover:scale-102 active:scale-98 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Package className="w-4 h-4" />
                <span>Fulfil Pending ({quantityMetrics.totalPending} Pcs)</span>
              </button>
            )}

            {invoice && (
              <button
                type="button"
                onClick={() => {
                  setSelectedInvoice(invoice);
                  setSelectedChallan(deliveryChallan);
                  setIsInvoiceModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Invoice Document</span>
              </button>
            )}

            {order && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete order ${order.order_number}? This cannot be undone.`)) {
                    deleteOrder(order.id);
                    onClose();
                  }
                }}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ml-auto"
                title="Delete Order"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Order</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Invoice & Challan Preview Modal */}
      {isInvoiceModalOpen && selectedInvoice && (
        <InvoicePreviewModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoice(null);
            setSelectedChallan(null);
          }}
          invoice={selectedInvoice}
          challan={selectedChallan}
          retailer={retailer}
          company={company}
        />
      )}

      {/* Processing Workflow Modal */}
      {isProcessingModalOpen && order && (
        <OrderProcessingWorkflowModal
          orderId={order.id}
          isOpen={isProcessingModalOpen}
          initialStage={processingStage}
          onClose={() => setIsProcessingModalOpen(false)}
        />
      )}

      {/* Short-Close Backorder Modal */}
      {shortCloseItem && (
        <ShortCloseBackorderModal
          isOpen={!!shortCloseItem}
          onClose={() => setShortCloseItem(null)}
          item={shortCloseItem}
        />
      )}
    </>
  );
}
