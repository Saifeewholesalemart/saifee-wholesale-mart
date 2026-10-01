'use client';

import React, { useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { X, ShieldCheck, UserCheck, Calendar, Tag, AlertCircle } from 'lucide-react';
import { BillingRateAuditLog } from '@/lib/db';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  retailerId?: string;
}

export default function AuditTrailModal({
  isOpen,
  onClose,
  orderId,
  retailerId
}: AuditTrailModalProps) {
  const { auditLogs, products, retailers } = useDb();

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter audit logs
  const filteredLogs = auditLogs.filter(log => {
    if (orderId && log.order_id !== orderId) return false;
    if (retailerId && log.retailer_id !== retailerId) return false;
    return true;
  });

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
    return `${day}-${mon}-${year}, ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-150 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-widest text-amber-300">
                Admin Audit Trail
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white">Manual Rate Override Log</h3>
            <p className="text-xs text-slate-300">
              Complete traceable record of admin price overrides, timestamped authorisations, and justified reasons.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
              No manual rate adjustments recorded for this selection.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map(log => {
                const prod = products.find(p => p.id === log.product_id);
                const ret = retailers.find(r => r.id === log.retailer_id);
                return (
                  <div key={log.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/40 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-800 text-sm block leading-snug">
                            {prod?.name || log.product_id}
                          </span>
                          {prod?.mrp !== undefined && (
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                              MRP ₹{prod.mrp}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-semibold block mt-0.5">
                          Retailer: <strong className="text-slate-700">{ret?.shop_name || log.retailer_id}</strong>
                          {log.order_id && ` &bull; Order: ${log.order_id}`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-0.5 rounded-md font-bold block sm:inline-block">
                          {log.admin_user_name || 'Admin User'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium block mt-0.5">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-white p-3 border border-slate-150 rounded-lg">
                      <div>
                        <span className="text-slate-500 block text-xs uppercase font-bold tracking-wider">Catalogue Rate</span>
                        <span className="font-bold text-slate-700">₹{log.catalogue_rate.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs uppercase font-bold tracking-wider">Order-Time Rate</span>
                        <span className="font-bold text-slate-700">₹{log.order_time_rate.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-amber-700 block text-xs uppercase font-bold tracking-wider">Manual Rate Applied</span>
                        <span className="font-black text-amber-800">₹{log.manual_billing_rate.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block text-xs uppercase font-bold tracking-wider">Final Applied (Net)</span>
                        <span className="font-black text-emerald-800">₹{log.final_applied_rate.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 bg-amber-50/50 border border-amber-150 p-2.5 rounded-lg flex items-start gap-1.5">
                      <span className="font-bold text-amber-800 flex-shrink-0">Reason:</span>
                      <span className="text-slate-800 font-medium">{log.reason}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-150 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Close Audit Trail
          </button>
        </div>

      </div>
    </div>
  );
}
