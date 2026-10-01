'use client';

import React from 'react';
import { 
  X, ArrowDownLeft, ArrowUpRight, DollarSign, Calendar, Clock, 
  Tag, Store, Truck, FileText, History as HistoryIcon, ShieldAlert,
  Edit3, Ban, User, Building2, Layers
} from 'lucide-react';
import { CashFlowTransaction } from '@/lib/db';
import { useDb } from '@/context/DbContext';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNeg ? '-₹' : '₹') + formatted;
}

interface CashFlowDetailsModalProps {
  transaction: CashFlowTransaction | null;
  onClose: () => void;
  onEdit?: (tx: CashFlowTransaction) => void;
  onVoid?: (tx: CashFlowTransaction) => void;
}

export default function CashFlowDetailsModal({
  transaction,
  onClose,
  onEdit,
  onVoid
}: CashFlowDetailsModalProps) {
  const { activeCompany } = useDb();

  if (!transaction) return null;

  const isIn = transaction.type === 'CASH_IN';
  const isVoided = transaction.status === 'Voided';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isVoided 
                ? 'bg-slate-200 text-slate-500 border-slate-300' 
                : isIn 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' 
                : 'bg-rose-500/10 text-rose-600 border-rose-200'
            }`}>
              {isIn ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Transaction {transaction.transaction_number}
                </h3>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  isIn ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {isIn ? 'CASH IN' : 'CASH OUT'}
                </span>
                {isVoided && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    <span>VOIDED / REVERSED</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Company: <span className="font-bold text-slate-700">{activeCompany?.name || transaction.company_id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Void banner if voided */}
          {isVoided && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>This transaction has been voided / reversed</span>
              </div>
              <p className="text-xs text-rose-800">
                Reason: <strong>{transaction.void_reason || 'Reversal requested'}</strong> &bull; Voided By: {transaction.voided_by || 'Admin'} on {transaction.voided_at ? new Date(transaction.voided_at).toLocaleString('en-IN') : '—'}
              </p>
            </div>
          )}

          {/* Amount and Key Info Grid */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Transaction Amount
              </span>
              <div className={`text-2xl font-black ${isVoided ? 'line-through text-slate-400' : isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatINR(transaction.amount)}
              </div>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700">
                Mode: {transaction.payment_mode}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Date &amp; Time:</span>
                <span className="font-bold text-slate-800">{transaction.date} &bull; {transaction.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Category:</span>
                <span className="font-bold text-indigo-700">{transaction.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Source:</span>
                <span className="font-bold text-slate-800">{transaction.source_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Reference #:</span>
                <span className="font-mono font-bold text-slate-700">{transaction.reference_number || '—'}</span>
              </div>
            </div>
          </div>

          {/* Party and Linkages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {isIn ? 'Received From (Party)' : 'Paid To (Party)'}
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                {transaction.party_name}
              </div>
              {transaction.party_type && (
                <span className="text-[11px] text-slate-500 block">
                  Party Type: <span className="font-semibold capitalize">{transaction.party_type}</span>
                </span>
              )}
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Linked Documents
              </span>
              {transaction.linked_invoice_number && (
                <div className="text-xs text-indigo-700 font-bold">
                  Invoice: {transaction.linked_invoice_number}
                </div>
              )}
              {transaction.linked_purchase_id && (
                <div className="text-xs text-slate-700 font-bold">
                  Purchase Ref: {transaction.linked_purchase_id}
                </div>
              )}
              {!transaction.linked_invoice_number && !transaction.linked_purchase_id && (
                <div className="text-xs text-slate-400 italic">No direct linked invoice / purchase</div>
              )}
            </div>
          </div>

          {/* Remarks */}
          {transaction.remarks && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Remarks / Notes
              </span>
              <p className="text-xs text-slate-700 font-medium">{transaction.remarks}</p>
            </div>
          )}

          {/* Audit Trail & Edit History */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <HistoryIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Complete Audit Trail &amp; Edit History</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Created: {new Date(transaction.created_at).toLocaleString('en-IN')} by {transaction.created_by}
              </span>
            </div>

            {transaction.edit_history && transaction.edit_history.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                {transaction.edit_history.map(entry => (
                  <div key={entry.id} className="p-2.5 text-xs flex items-start justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="uppercase text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-700">{entry.field}</span>
                        <span>{String(entry.old_value)} &rarr; <strong className="text-indigo-700">{String(entry.new_value)}</strong></span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 italic">
                        Reason: "{entry.reason}"
                      </p>
                    </div>
                    <div className="text-right text-[10px] text-slate-400 shrink-0">
                      <div>{entry.changed_by}</div>
                      <div>{new Date(entry.changed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 text-slate-400 text-xs italic text-center">
                Original record intact. No subsequent manual modifications have occurred.
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isVoided && onEdit && (
              <button
                type="button"
                onClick={() => { onClose(); onEdit(transaction); }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Entry</span>
              </button>
            )}
            {!isVoided && onVoid && (
              <button
                type="button"
                onClick={() => { onClose(); onVoid(transaction); }}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Void / Reverse</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
