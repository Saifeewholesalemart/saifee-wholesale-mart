'use client';

import React from 'react';
import { 
  X, AlertTriangle, Calendar, Store, User, Phone, MapPin, 
  Package, Truck, Receipt, CheckCircle2, Clock, History as HistoryIcon,
  Layers, ShieldAlert, ArrowRight, FileText
} from 'lucide-react';
import { 
  Order, Retailer, Product, calculateItemQuantities, calculateOrderQuantities, 
  deriveOrderChannel, formatQuantityDisplay 
} from '@/lib/db';
import { useDb } from '@/context/DbContext';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ViewPreviousOrderModalProps {
  orderId: string | null;
  onClose: () => void;
}

export default function ViewPreviousOrderModal({
  orderId,
  onClose
}: ViewPreviousOrderModalProps) {
  const { orders, retailers, products, invoices, deliveryChallans, itemActivityLogs } = useDb();

  if (!orderId) return null;

  const order = orders.find(o => o.id === orderId);
  if (!order) return null;

  const retailer = retailers.find(r => r.id === order.retailer_id);
  const orderQuantities = calculateOrderQuantities(order, products);
  const channelInfo = deriveOrderChannel(order);

  // Associated documents
  const orderInvoices = invoices.filter(inv => 
    inv.order_ref_id === order.id || 
    (inv.source_order_ids && inv.source_order_ids.includes(order.id))
  );
  const orderChallans = deliveryChallans.filter(dc => dc.order_id === order.id);

  // Filter activity logs related to this order or its items
  const relatedLogs = itemActivityLogs.filter(log => 
    (log.details && (log.details.includes(order.order_number) || log.details.includes(order.id))) ||
    (order.items?.some(i => i.product_id === log.product_id))
  ).slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-200 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Previous Order Details: {order.order_number}
                </h3>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${orderQuantities.statusBadge.bgClass} ${orderQuantities.statusBadge.colorClass} ${orderQuantities.statusBadge.borderClass}`}>
                  {orderQuantities.statusBadge.label}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${channelInfo.badgeClass}`}>
                  {channelInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Read-only inspection of previous unfulfilled order to prevent duplicate booking.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Order & Retailer Snapshot Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Retailer Information
              </span>
              <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <Store className="w-4 h-4 text-indigo-600" />
                <span>{retailer?.shop_name || 'Retailer Name'}</span>
              </div>
              <p className="text-slate-500 font-medium mt-0.5">
                Code: {retailer?.retailer_code || 'RET'} &bull; Owner: {retailer?.owner_name || 'Owner'}
              </p>
              <div className="flex items-center gap-2 mt-1 text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{retailer?.city || 'City'}{retailer?.address ? ` &bull; ${retailer.address}` : ''}</span>
                {retailer?.mobile && (
                  <>
                    <span>&bull;</span>
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{retailer.mobile}</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Order Timeline &amp; Totals
              </span>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Placed Date:</span>
                  <span className="font-bold text-slate-800">
                    {order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Ordered Volume:</span>
                  <span className="font-bold text-slate-800">{orderQuantities.displayOrdered}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Dispatched / Fulfilled:</span>
                  <span className="font-bold text-emerald-700">{orderQuantities.displayDispatched}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="font-bold text-amber-800">Remaining Pending:</span>
                  <span className="font-extrabold text-amber-700">{orderQuantities.displayPending}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Item-wise Fulfilment Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-500" />
                <span>Ordered Items &amp; Pending Status</span>
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                {order.items?.length || 0} Line Items
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-black uppercase text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3">Product Description</th>
                      <th className="py-2.5 px-2 text-center">Ordered</th>
                      <th className="py-2.5 px-2 text-center">Confirmed</th>
                      <th className="py-2.5 px-2 text-center">Dispatched</th>
                      <th className="py-2.5 px-2 text-center">Cancelled</th>
                      <th className="py-2.5 px-3 text-right bg-amber-50 text-amber-900 border-l border-amber-200">
                        Remaining Pending
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(order.items || []).map((item, idx) => {
                      const prod = products.find(p => p.id === item.product_id);
                      const q = calculateItemQuantities(item, prod);
                      const isPending = q.totalUnfulfilledBase > 0;

                      return (
                        <tr key={item.id || idx} className={isPending ? "bg-amber-50/40 hover:bg-amber-50/70 transition-colors" : "hover:bg-slate-50 transition-colors"}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{prod?.name || 'Product'}</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {prod?.brand} &bull; {prod?.pack_size || prod?.packing_display} &bull; SKU: {prod?.sku || prod?.product_code}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                            {q.displayOrdered}
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-600 font-medium">
                            {q.confirmedBase > 0 ? q.displayConfirmed : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                            {q.dispatchedBase > 0 ? q.displayDispatched : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-center text-rose-600 font-medium">
                            {q.cancelledBase > 0 ? q.displayCancelled : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold border-l border-amber-200/80 bg-amber-50/60">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>{q.displayPending}</span>
                              </span>
                            ) : (
                              <span className="text-emerald-700 text-[11px] font-bold flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Fulfilled</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Linked Invoices & Challans if generated */}
          {(orderInvoices.length > 0 || orderChallans.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {orderInvoices.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>Invoices Generated</span>
                  </span>
                  <div className="space-y-1">
                    {orderInvoices.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-mono font-bold text-indigo-700">{inv.invoice_number}</span>
                        <span className="font-extrabold text-slate-900">{formatINR(inv.grand_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orderChallans.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Delivery Challans</span>
                  </span>
                  <div className="space-y-1">
                    {orderChallans.map(dc => (
                      <div key={dc.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-mono font-bold text-emerald-700">{dc.challan_number}</span>
                        <span className="text-slate-500 font-medium">{dc.dispatch_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Log Snippet */}
          {relatedLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <HistoryIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Recent Audit Activity</span>
              </h4>
              <div className="space-y-1.5">
                {relatedLogs.map(log => (
                  <div key={log.id} className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-800 block">{log.action}</span>
                      <p className="text-[11px] text-slate-500">{log.details}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(log.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium italic text-center sm:text-left">
            🔒 Read-only view. Previous orders cannot be modified from this warning dialog.
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm text-center"
          >
            Close Order Details
          </button>
        </div>

      </div>
    </div>
  );
}
