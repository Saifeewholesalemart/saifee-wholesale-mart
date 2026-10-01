'use client';

import React, { useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { X, History, Tag, AlertCircle, Check, ArrowRight, TrendingUp } from 'lucide-react';
import { BillingRateRecord, formatQuantityDisplay } from '@/lib/db';

interface LastBillingRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailerId: string;
  productId: string;
  tradingUnit?: 'Box' | 'Carton' | string;
  onApplyRate?: (rate: number, record?: BillingRateRecord) => void;
}

export default function LastBillingRatesModal({
  isOpen,
  onClose,
  retailerId,
  productId,
  tradingUnit,
  onApplyRate
}: LastBillingRatesModalProps) {
  const { getLastBillingRates, products, retailers } = useDb();

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

  const product = products.find(p => p.id === productId);
  const retailer = retailers.find(r => r.id === retailerId);
  const records: BillingRateRecord[] = getLastBillingRates(retailerId, productId, tradingUnit, 5);
  const purchaseCost = product?.purchase_price || (product?.selling_price ? product.selling_price * 0.9 : 0);

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
    return `${day} ${mon} ${year} • ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getUnitAbbr = (unit: string) => {
    if (!unit) return '';
    const u = unit.toLowerCase();
    if (u.includes('carton')) return 'CTN';
    if (u.includes('box')) return 'BOX';
    if (u.includes('bag')) return 'BAG';
    return unit.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-60 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white">
          <div className="space-y-1.5 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <History className="w-4 h-4" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-300">
                Last 5 Billed Rates
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded text-xs font-bold">
                Retailer Specific History
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate leading-tight">
                {product ? product.name : 'Product Variant Details'}
              </h3>
              {product?.mrp !== undefined && (
                <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 rounded text-xs font-black">
                  MRP ₹{product.mrp}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
              <span>
                Brand: <strong className="text-white font-semibold">{product?.brand || '-'}</strong>
              </span>
              <span>&bull;</span>
              <span>
                Packing: <strong className="text-white font-semibold">{product?.pack_size || '-'}</strong>
              </span>
              {purchaseCost > 0 && (
                <>
                  <span>&bull;</span>
                  <span>
                    Dist. Cost: <strong className="text-amber-300 font-mono font-bold">₹{purchaseCost.toFixed(2)}</strong>
                  </span>
                </>
              )}
            </div>

            {retailer && (
              <div className="pt-1 text-xs text-slate-300 flex items-center gap-1.5">
                <span className="text-slate-400">Retailer:</span>
                <span className="font-bold text-amber-300">{retailer.shop_name}</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                  {retailer.retailer_code}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Current Master Rate Card */}
          {product && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 font-bold">Current Master Catalogue Rate:</span>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-indigo-700 text-base">
                  ₹{product.selling_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-500 font-bold ml-1">/{getUnitAbbr(product.trading_unit)}</span>
              </div>
            </div>
          )}

          {/* Historical Records List / Table */}
          {records.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                No previous billing rate found for this retailer and product variant.
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No finalized tax invoices exist for this customer yet. Default catalogue rates apply.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <th className="p-3">Date &amp; Historical Invoice</th>
                      <th className="p-3 text-center">Billed Qty</th>
                      <th className="p-3 text-right">Billed Rate</th>
                      <th className="p-3 text-center">Dist. Margin</th>
                      {onApplyRate && <th className="p-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((rec, index) => {
                      const unitStr = getUnitAbbr(rec.trading_unit);
                      const unitsPerPack = rec.units_per_box_carton || product?.units_per_box_carton || 1;
                      const baseUnit = rec.base_unit || product?.base_unit || 'Piece';
                      const marginPct = rec.final_applied_rate > 0 && purchaseCost > 0
                        ? Math.round(((rec.final_applied_rate - purchaseCost) / rec.final_applied_rate) * 10000) / 100
                        : null;

                      return (
                        <tr key={rec.id || index} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-indigo-700 block text-xs">
                                {rec.invoice_number || rec.order_number}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium block mt-0.5">
                              {formatDateTime(rec.date)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800 text-xs">
                            {formatQuantityDisplay(rec.quantity, unitsPerPack, rec.trading_unit, baseUnit)}
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-black text-slate-900 text-sm block">
                              ₹{rec.final_applied_rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">/{unitStr}</span>
                          </td>
                          <td className="p-3 text-center">
                            {marginPct !== null ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black ${
                                marginPct >= 10 ? 'bg-emerald-100 text-emerald-800' : marginPct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                              }`}>
                                <TrendingUp className="w-3 h-3" />
                                <span>{marginPct >= 0 ? `+${marginPct.toFixed(2)}%` : `${marginPct.toFixed(2)}%`}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>
                          {onApplyRate && (
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  onApplyRate(rec.final_applied_rate, rec);
                                  onClose();
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 hover:scale-105 active:scale-95"
                              >
                                <Check className="w-3 h-3" />
                                <span>Apply</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reference Feature Disclaimer */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>FMCG Pricing Principle:</strong> Applying a previous rate sets this line item's billing price for the current order and logs the rate adjustment.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-150 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
