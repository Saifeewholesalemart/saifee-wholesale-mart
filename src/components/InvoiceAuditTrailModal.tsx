'use client';

import React, { useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  X, History, ShieldCheck, UserCheck, Calendar, DollarSign, 
  Package, ArrowRight, CheckCircle, Store, AlertCircle, FileText, PlusCircle, MinusCircle, RefreshCw
} from 'lucide-react';
import { Invoice } from '@/lib/db';

interface InvoiceAuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export default function InvoiceAuditTrailModal({
  isOpen,
  onClose,
  invoice
}: InvoiceAuditTrailModalProps) {
  const { invoiceAuditLogs, retailers, products } = useDb();

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const retailer = retailers.find(r => r.id === invoice.retailer_id);

  // Filter audit logs for this specific invoice
  const logs = invoiceAuditLogs.filter(l => l.invoice_id === invoice.id);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate().toString().padStart(2, '0');
    const mon = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}-${mon}-${year} at ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Sticky Header: ALWAYS displays Invoice No & Retailer Name */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-black uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Invoice Revision Trail</span>
              </span>
              <span className="text-slate-400 text-xs">&bull;</span>
              <span className="text-xs text-indigo-300 font-bold">
                {logs.length} {logs.length === 1 ? 'Revision Recorded' : 'Revisions Recorded'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-black text-white tracking-tight">
                INVOICE: <span className="text-indigo-300 font-mono">{invoice.invoice_number}</span>
              </h2>
              <span className="text-slate-500 font-bold hidden sm:inline">&bull;</span>
              <div className="flex items-center gap-1.5 text-xs text-amber-200 font-bold">
                <Store className="w-4 h-4 text-amber-300" />
                <span>RETAILER: {retailer?.shop_name || invoice.retailer_id}</span>
                {retailer?.city && <span className="text-slate-300 font-medium text-xs">({retailer.city})</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {logs.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">No Revisions Logged</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                This invoice is in its original generated state. Any future admin edits to quantities, rates, or items will be permanently tracked here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {logs.map((log, index) => {
                const revNumber = logs.length - index;
                return (
                  <div 
                    key={log.id} 
                    className="p-5 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-4 relative overflow-hidden"
                  >
                    {/* Top Revision Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          #{revNumber}
                        </span>
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm block">
                            Revision #{revNumber}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDateTime(log.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Author: {log.admin_name || 'Admin'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Reason Callout */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs flex items-start gap-2">
                      <span className="font-extrabold text-amber-900 shrink-0">Reason for Edit:</span>
                      <span className="text-amber-900 font-medium">{log.reason}</span>
                    </div>

                    {/* Financial Deltas Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block text-xs uppercase font-bold">Previous Total</span>
                        <span className="font-bold text-slate-800">₹{log.old_grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs uppercase font-bold">Revised Total</span>
                        <span className="font-extrabold text-indigo-700">₹{log.new_grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs uppercase font-bold">Invoice Delta</span>
                        <span className={`font-black ${log.new_grand_total > log.old_grand_total ? 'text-red-600' : log.new_grand_total < log.old_grand_total ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {log.new_grand_total > log.old_grand_total ? `+₹${(log.new_grand_total - log.old_grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : log.new_grand_total < log.old_grand_total ? `-₹${(log.old_grand_total - log.new_grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs uppercase font-bold">Retailer Balance Impact</span>
                        <span className={`font-black ${log.retailer_outstanding_delta > 0 ? 'text-red-600' : log.retailer_outstanding_delta < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {log.retailer_outstanding_delta > 0 ? `+₹${log.retailer_outstanding_delta.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : log.retailer_outstanding_delta < 0 ? `-₹${Math.abs(log.retailer_outstanding_delta).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'No change'}
                        </span>
                      </div>
                    </div>

                    {/* Itemized Diffs Table */}
                    {log.item_changes && log.item_changes.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Line Item Adjustments ({log.item_changes.length})
                        </h5>
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                          {log.item_changes.map((diff, dIdx) => (
                            <div key={dIdx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
                              <div className="flex items-center gap-2 flex-wrap">
                                {diff.action === 'added' ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black uppercase flex items-center gap-1">
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    Added
                                  </span>
                                ) : diff.action === 'removed' ? (
                                  <span className="px-2 py-0.5 rounded bg-red-100 border border-red-300 text-red-800 text-xs font-black uppercase flex items-center gap-1">
                                    <MinusCircle className="w-3.5 h-3.5" />
                                    Removed
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-blue-100 border border-blue-300 text-blue-800 text-xs font-black uppercase flex items-center gap-1">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Modified
                                  </span>
                                )}
                                <span className="font-extrabold text-slate-900 text-sm">{diff.product_name}</span>
                              </div>

                              <div className="text-slate-700 text-xs font-medium sm:text-right">
                                {diff.details || (
                                  <span>
                                    Qty: {diff.old_qty} ➔ {diff.new_qty} &bull; Total: ₹{diff.old_total?.toFixed(2)} ➔ ₹{diff.new_total?.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata Field Changes */}
                    {log.field_changes && log.field_changes.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
                        {log.field_changes.map((fc, fIdx) => (
                          <span key={fIdx} className="px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-medium">
                            <strong className="text-slate-900">{fc.label}:</strong> {String(fc.old_value)} ➔ {String(fc.new_value)}
                          </span>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Close Audit Trail
          </button>
        </div>

      </div>
    </div>
  );
}
