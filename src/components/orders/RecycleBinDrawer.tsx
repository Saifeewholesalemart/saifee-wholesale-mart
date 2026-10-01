'use client';

import React from 'react';
import { DeletedItemRecord } from '@/lib/orderTerminalTypes';
import { X, RotateCcw, Trash2, Clock, Store, AlertCircle, Sparkles } from 'lucide-react';

interface RecycleBinDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deletedItems: DeletedItemRecord[];
  onRestore: (record: DeletedItemRecord) => void;
  onClearAll: () => void;
}

export default function RecycleBinDrawer({
  isOpen,
  onClose,
  deletedItems,
  onRestore,
  onClearAll
}: RecycleBinDrawerProps) {
  if (!isOpen) return null;

  const formatINR = (val?: number) => {
    if (val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Recently Removed</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {deletedItems.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Tier 2 Safety Net &bull; Restore items removed during shift</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {deletedItems.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Trash2 className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm">Recycle Bin is Empty</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Any line items or lots removed from the active packing terminal will be safely retained here for quick restore.
              </p>
            </div>
          ) : (
            deletedItems.map(record => (
              <div
                key={record.id}
                className="bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs transition-all hover:border-indigo-300 hover:shadow-xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900">
                        {record.productName}
                      </span>
                      {record.mrp && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          MRP ₹{record.mrp}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-0.5">
                      <Store className="w-3 h-3 text-slate-400" />
                      <span>{record.retailerName}</span>
                      <span>&bull;</span>
                      <span className="font-mono text-slate-700">{record.orderNumber}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    record.type === 'LOT_ORDER' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {record.type === 'LOT_ORDER' ? 'Order Lot' : 'Line Item'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-800 font-mono">
                      {record.cartonQty} {record.cartonQty === 1 ? 'Carton' : 'Cartons'} @ ₹{record.unitRate.toFixed(2)}/ctn
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(record.deletedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} by {record.deletedBy}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onRestore(record);
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs group-hover:scale-102 active:scale-98"
                    title="Restore item back to active packing lot"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {deletedItems.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClearAll}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Recycle Bin</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
