'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  X, History, Store, Globe, Check, TrendingUp, 
  AlertCircle, Tag, Clock, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import { Invoice, Product, Retailer } from '@/lib/db';
import { getCompositeKey } from '@/lib/orderTerminalTypes';

export interface RateIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailerId: string;
  retailerName: string;
  retailerCity?: string;
  productId: string;
  productName: string;
  sku: string;
  mrp: number;
  tradingUnit: string;
  baseUnit?: string;
  unitsPerPack: number;
  purchaseCost: number;
  currentUnitRate: number;
  onApplyRate: (rate: number) => void;
}

interface HistoricalRateEntry {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  retailerId: string;
  retailerName: string;
  retailerCity: string;
  retailerBeat?: string;
  cartonQty: number;
  baseQty: number;
  tradingUnit: string;
  baseUnit: string;
  billedUnitRate: number;
  distMarginPct: number | null;
  mrp: number;
  isThisRetailer: boolean;
}

export default function RateIntelligenceModal({
  isOpen,
  onClose,
  retailerId,
  retailerName,
  retailerCity,
  productId,
  productName,
  sku,
  mrp,
  tradingUnit,
  baseUnit = 'Pcs',
  unitsPerPack = 1,
  purchaseCost = 0,
  currentUnitRate = 0,
  onApplyRate
}: RateIntelligenceModalProps) {
  const { invoices, retailers, products } = useDb();

  // Dual-Scope Tab: 'THIS_RETAILER' | 'ALL_RETAILERS'
  const [scopeTab, setScopeTab] = useState<'THIS_RETAILER' | 'ALL_RETAILERS'>('THIS_RETAILER');

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

  const targetCompositeKey = getCompositeKey(sku, mrp);

  // Extract all historical finalized invoices containing this exact product + MRP revision
  const allHistoricalRates = useMemo<HistoricalRateEntry[]>(() => {
    if (!isOpen) return [];

    const entries: HistoricalRateEntry[] = [];
    const sortedInvoices = [...invoices].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedInvoices.forEach(inv => {
      const ret = retailers.find(r => r.id === inv.retailer_id);
      const retName = ret?.shop_name || 'Retailer';
      const retCity = ret?.city || 'Nagpur';
      const retBeat = ret?.beat_name || ret?.route;

      (inv.items || []).forEach(it => {
        // Strict matching of product ID and Hero printed MRP
        const itemMrp = it.mrp || 0;
        const isMatch = it.product_id === productId && (itemMrp === mrp || Math.abs(itemMrp - mrp) < 0.01 || mrp === 0);

        if (isMatch) {
          const uP = it.units_per_trading_unit || it.units_per_box_carton || unitsPerPack || 1;
          const cQty = it.carton_qty !== undefined ? it.carton_qty : Math.floor((it.quantity || 0) / uP);
          const bQty = it.quantity || (cQty * uP);
          const rate = it.carton_rate || it.rate || 0;

          const marginPct = rate > 0 && purchaseCost > 0
            ? Math.round(((rate - purchaseCost) / rate) * 10000) / 100
            : null;

          entries.push({
            id: `rate-${inv.id}-${it.id || Math.random()}`,
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            invoiceDate: inv.date,
            retailerId: inv.retailer_id,
            retailerName: retName,
            retailerCity: retCity,
            retailerBeat: retBeat,
            cartonQty: cQty,
            baseQty: bQty,
            tradingUnit: it.trading_unit || tradingUnit || 'Carton',
            baseUnit: it.base_unit || baseUnit || 'Pcs',
            billedUnitRate: rate,
            distMarginPct: marginPct,
            mrp: itemMrp || mrp,
            isThisRetailer: inv.retailer_id === retailerId
          });
        }
      });
    });

    return entries;
  }, [isOpen, invoices, retailers, productId, mrp, unitsPerPack, purchaseCost, tradingUnit, baseUnit, retailerId]);

  // Tab A: This Retailer (Limit to last 5)
  const thisRetailerRates = useMemo(() => {
    return allHistoricalRates.filter(e => e.isThisRetailer).slice(0, 5);
  }, [allHistoricalRates]);

  // Tab B: All Retailers (Market Rate, Limit to last 5)
  const marketRates = useMemo(() => {
    return allHistoricalRates.slice(0, 5);
  }, [allHistoricalRates]);

  const activeList = scopeTab === 'THIS_RETAILER' ? thisRetailerRates : marketRates;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="space-y-1.5 min-w-0 pr-3">
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Clock className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Rate Intelligence: {productName}
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                MRP ₹{mrp.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap font-medium">
              <span>SKU: <strong className="font-mono text-white">{sku}</strong></span>
              <span>&bull;</span>
              <span>Pack: <strong className="text-white">{unitsPerPack} {baseUnit}/{tradingUnit}</strong></span>
              {purchaseCost > 0 && (
                <>
                  <span>&bull;</span>
                  <span>Dist Cost: <strong className="text-amber-300 font-mono font-bold">₹{purchaseCost.toFixed(2)}</strong></span>
                </>
              )}
              {currentUnitRate > 0 && (
                <>
                  <span>&bull;</span>
                  <span>Active Lot Rate: <strong className="text-indigo-300 font-mono font-bold">₹{currentUnitRate.toFixed(2)}</strong></span>
                </>
              )}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              <span>Customer:</span>
              <strong className="text-slate-200">{retailerName}</strong>
              {retailerCity && <span>({retailerCity})</span>}
            </div>

          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual-Scope Tab Controls */}
        <div className="bg-slate-100/90 p-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            
            {/* TAB A: This Retailer */}
            <button
              type="button"
              onClick={() => setScopeTab('THIS_RETAILER')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                scopeTab === 'THIS_RETAILER'
                  ? 'bg-white text-indigo-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-indigo-600" />
              <span>This Retailer History</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                scopeTab === 'THIS_RETAILER' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {thisRetailerRates.length}
              </span>
            </button>

            {/* TAB B: All Retailers (Market Rate) */}
            <button
              type="button"
              onClick={() => setScopeTab('ALL_RETAILERS')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                scopeTab === 'ALL_RETAILERS'
                  ? 'bg-white text-indigo-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span>Market Rate (All Retailers)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                scopeTab === 'ALL_RETAILERS' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {marketRates.length}
              </span>
            </button>

          </div>

          <span className="hidden md:inline text-[11px] font-bold text-slate-400">
            Last 5 Finalized Tax Invoices
          </span>
        </div>

        {/* Modal Body / Historical Rates Table */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {activeList.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <AlertCircle className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm">
                {scopeTab === 'THIS_RETAILER'
                  ? `No previous invoice history found for ${retailerName}`
                  : 'No market rate history found across retailers'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {scopeTab === 'THIS_RETAILER'
                  ? `This customer has not yet been billed for ${productName} (MRP ₹${mrp}). Check the "Market Rate" tab for recent selling rates across other stores.`
                  : `No finalized tax invoices exist in the system for MRP ₹${mrp}. Default master catalogue rate will be used.`}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <tr>
                    {scopeTab === 'ALL_RETAILERS' && <th className="p-3">Customer Store</th>}
                    <th className="p-3">Invoice &amp; Date</th>
                    <th className="p-3 text-center">Billed Qty</th>
                    <th className="p-3 text-right">Billed Unit Rate</th>
                    <th className="p-3 text-center">Margin %</th>
                    <th className="p-3 text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeList.map(rec => (
                    <tr key={rec.id} className="hover:bg-indigo-50/30 transition-colors">
                      
                      {/* Customer Store (for Scope B) */}
                      {scopeTab === 'ALL_RETAILERS' && (
                        <td className="p-3 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-xs">
                              {rec.retailerName}
                            </span>
                            {rec.isThisRetailer && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-800">
                                Current Retailer
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {rec.retailerBeat || rec.retailerCity || 'Nagpur'}
                          </div>
                        </td>
                      )}

                      {/* Invoice No & Date */}
                      <td className="p-3 space-y-0.5">
                        <span className="font-mono font-black text-indigo-700 block text-xs">
                          {rec.invoiceNumber}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          {formatDate(rec.invoiceDate)}
                        </span>
                      </td>

                      {/* Billed Quantity */}
                      <td className="p-3 text-center font-bold text-slate-800 text-xs font-mono">
                        {rec.cartonQty} {rec.tradingUnit}
                        {rec.baseQty > 0 && rec.baseQty !== rec.cartonQty && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            ({rec.baseQty} {rec.baseUnit})
                          </span>
                        )}
                      </td>

                      {/* Billed Unit Rate (₹/CTN) */}
                      <td className="p-3 text-right font-mono">
                        <span className="font-black text-slate-900 text-sm block">
                          ₹{rec.billedUnitRate.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-sans">
                          /{rec.tradingUnit}
                        </span>
                      </td>

                      {/* Dist Margin % */}
                      <td className="p-3 text-center">
                        {rec.distMarginPct !== null ? (
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-black ${
                            rec.distMarginPct >= 10 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : rec.distMarginPct > 0 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            <TrendingUp className="w-2.5 h-2.5" />
                            <span>{rec.distMarginPct >= 0 ? `+${rec.distMarginPct.toFixed(1)}%` : `${rec.distMarginPct.toFixed(1)}%`}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Apply Rate Action */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyRate(rec.billedUnitRate);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                          title={`Apply rate of ₹${rec.billedUnitRate.toFixed(2)}/${rec.tradingUnit} to current lot row`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Apply</span>
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* FMCG Pricing Intelligence Note */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-2 text-xs text-indigo-950 font-medium">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Instant Rate Locking:</strong> Clicking <strong>[Apply]</strong> overrides the row's trading unit rate, instantly recalculates taxable totals, margin percentage, and lot GST in real time.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Hero MRP: <strong className="text-emerald-700 font-mono font-bold">₹{mrp.toFixed(2)}</strong> ({sku})
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

    </div>
  );
}
