'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { BillingRateRecord } from '@/lib/db';
import { 
  History, X, Store, Globe, Calendar, Tag, 
  DollarSign, Check, Info, ShieldCheck, ArrowRight,
  TrendingUp, Layers, User, Phone, MapPin, Receipt,
  ChevronRight, Filter, Search, RotateCcw, Eye, ChevronDown, ChevronUp
} from 'lucide-react';

interface BillingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  retailerId?: string;
  productName?: string;
  mrp?: number;
  tradingUnit?: string;
  currentRate?: number;
  currentDiscount?: number;
  onApplyRate?: (rate: number, discount?: number) => void;
}

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timePart = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  if (isToday) return `Today, ${timePart}`;
  if (isYesterday) return `Yesterday, ${timePart}`;

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }) + ` • ${timePart}`;
}

function formatShortDate(dateStr?: string) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata'
  });
}

export default function BillingHistoryModal({
  isOpen,
  onClose,
  productId,
  retailerId,
  productName,
  mrp,
  tradingUnit = 'Carton',
  currentRate,
  currentDiscount,
  onApplyRate
}: BillingHistoryModalProps) {
  const { 
    getLastBillingRates, 
    getAllRetailersLastBillingRates, 
    products, 
    retailers, 
    activeCompany 
  } = useDb();

  // Active History View: 'both' | 'same_retailer' | 'all_retailers'
  const [activeTab, setActiveTab] = useState<'both' | 'same_retailer' | 'all_retailers'>('both');

  // Full History View Toggle (Default: Last 5 Quick View)
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  // Selected single record for full details inspection
  const [inspectRecord, setInspectRecord] = useState<BillingRateRecord | null>(null);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectRecord) {
          setInspectRecord(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, inspectRecord]);

  const targetProduct = useMemo(() => {
    return products.find(p => p.id === productId);
  }, [products, productId]);

  const targetRetailer = useMemo(() => {
    if (!retailerId) return undefined;
    return retailers.find(r => r.id === retailerId);
  }, [retailers, retailerId]);

  // 1. Same Retailer History (Last 5 or Full)
  const sameRetailerRecords = useMemo<BillingRateRecord[]>(() => {
    if (!retailerId) return [];
    const limit = showFullHistory ? 100 : 5;
    return getLastBillingRates(retailerId, productId, tradingUnit, limit, activeCompany?.id);
  }, [retailerId, productId, tradingUnit, showFullHistory, activeCompany, getLastBillingRates]);

  // 2. All Retailers History (Last 5 or Full across same company)
  const allRetailersRecords = useMemo<BillingRateRecord[]>(() => {
    const limit = showFullHistory ? 100 : 5;
    return getAllRetailersLastBillingRates(productId, tradingUnit, limit, activeCompany?.id);
  }, [productId, tradingUnit, showFullHistory, activeCompany, getAllRetailersLastBillingRates]);

  if (!isOpen) return null;

  const displayProductName = productName || targetProduct?.name || 'FMCG Product';
  const displayMrp = mrp || targetProduct?.mrp || 0;
  const displayBrand = targetProduct?.brand || 'Saifee';
  const displaySku = targetProduct?.sku || targetProduct?.barcode || 'SKU';
  const displayPacking = targetProduct?.packing_display || targetProduct?.pack_size || `${targetProduct?.units_per_box_carton || 1} pcs/box`;

  const filterRecords = (records: BillingRateRecord[]) => {
    if (!filterSearch.trim()) return records;
    const q = filterSearch.toLowerCase();
    return records.filter(r => 
      (r.invoice_number || '').toLowerCase().includes(q) ||
      (r.order_number || '').toLowerCase().includes(q) ||
      (r.retailer_name || '').toLowerCase().includes(q) ||
      (r.salesperson || '').toLowerCase().includes(q)
    );
  };

  const filteredSameRetailer = filterRecords(sameRetailerRecords);
  const filteredAllRetailers = filterRecords(allRetailersRecords);

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* ========================================================
            MODAL HEADER: TITLE & SUBTITLE
            ======================================================== */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5 shadow-inner">
              <History className="w-6 h-6 stroke-[2.3]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-400/30">
                  Last 5 Billing Details
                </span>
                {activeCompany && (
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {activeCompany.name}
                  </span>
                )}
              </div>
              
              <h3 className="text-base sm:text-xl font-black text-white leading-tight">
                Last 5 Billing Details
              </h3>

              {/* Subtitle: Product & Retailer */}
              <div className="flex items-center gap-2.5 text-xs text-slate-300 flex-wrap font-medium">
                <span>Product: <strong className="text-amber-300 font-bold">{displayProductName}</strong></span>
                <span>&bull;</span>
                <span>Retailer: <strong className="text-emerald-300 font-bold">{targetRetailer?.shop_name || 'All Retailers'}</strong></span>
                <span>&bull;</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-mono font-black">
                  MRP ₹{Number(displayMrp).toFixed(2)}
                </span>
                <span>&bull;</span>
                <span>Packing: {displayPacking}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm transition-colors shrink-0"
            title="Close Dialogue"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Decision-Support Banner */}
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Decision Support:</strong> Purchase Rates and Billing Rates are derived strictly from historical finalized GST invoices.
            </span>
          </div>
          {currentRate !== undefined && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-amber-300 shrink-0">
              <span className="text-slate-500 font-sans font-bold">Current Entered:</span>
              <strong className="text-indigo-900 font-black">₹{Number(currentRate).toFixed(2)}</strong>
              {currentDiscount ? <span className="text-rose-600 font-bold">(-₹{currentDiscount})</span> : null}
            </div>
          )}
        </div>

        {/* SECTION NAV / FILTER BAR */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => { setActiveTab('both'); setFilterSearch(''); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'both'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Sections</span>
            </button>

            {retailerId && (
              <button
                type="button"
                onClick={() => { setActiveTab('same_retailer'); setFilterSearch(''); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                  activeTab === 'same_retailer'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>This Retailer ({targetRetailer?.shop_name || 'Selected'})</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  activeTab === 'same_retailer' ? 'bg-white text-indigo-900' : 'bg-slate-100 text-slate-700'
                }`}>
                  {sameRetailerRecords.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => { setActiveTab('all_retailers'); setFilterSearch(''); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'all_retailers'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Retailers (Market-Wide)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeTab === 'all_retailers' ? 'bg-white text-indigo-900' : 'bg-slate-100 text-slate-700'
              }`}>
                {allRetailersRecords.length}
              </span>
            </button>
          </div>

          {/* Quick Toggle: Last 5 vs Full History */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullHistory(!showFullHistory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                showFullHistory 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black' 
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {showFullHistory ? 'Showing Full History' : 'Showing Last 5 (Quick View)'}
            </button>
          </div>
        </div>

        {/* Filter search if Full History enabled */}
        {showFullHistory && (
          <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by invoice #, retailer, salesperson..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {filterSearch && (
              <button
                type="button"
                onClick={() => setFilterSearch('')}
                className="text-xs text-slate-400 hover:text-slate-700 p-1"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* ========================================================
            MAIN DIALOGUE CONTENT: 2 HISTORICAL SECTIONS
            ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">

          {/* SECTION 1: SAME RETAILER HISTORY */}
          {(activeTab === 'both' || activeTab === 'same_retailer') && retailerId && (
            <div className="space-y-3 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase">
                      Last 5 Billing Details &mdash; This Retailer
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Previous actual billings to <strong>{targetRetailer?.shop_name}</strong> for {displayProductName}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-mono font-bold border border-indigo-200">
                  {filteredSameRetailer.length} Records
                </span>
              </div>

              {filteredSameRetailer.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                  No historical billings recorded for {targetRetailer?.shop_name} for this product variant.
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase bg-slate-50/80">
                          <th className="p-2.5">Invoice</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5 text-right text-slate-700">Purchase Rate</th>
                          <th className="p-2.5 text-right text-indigo-800">Billing Rate</th>
                          <th className="p-2.5 text-right text-rose-700">Discount</th>
                          <th className="p-2.5 text-right text-emerald-800">Final Rate</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredSameRetailer.map((rec, idx) => {
                          const isCancelled = rec.invoice_status === 'Cancelled';
                          const purchaseRate = rec.purchase_rate !== undefined ? rec.purchase_rate : (targetProduct?.purchase_price || 0);

                          return (
                            <tr key={rec.id || idx} className={`hover:bg-slate-50 transition-colors ${idx === 0 ? 'bg-indigo-50/20' : ''}`}>
                              <td className="p-2.5 font-mono font-bold text-indigo-700">
                                {rec.invoice_number}
                                {idx === 0 && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">Latest</span>
                                )}
                                {isCancelled && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">Cancelled</span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600 whitespace-nowrap">{formatShortDate(rec.date)}</td>
                              <td className="p-2.5 text-center font-bold text-slate-900">{rec.quantity}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-700">₹{purchaseRate.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-indigo-700">₹{Number(rec.applied_rate || rec.carton_rate || 0).toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono text-rose-600 font-bold">
                                {Number(rec.discount || 0) > 0 ? `₹${Number(rec.discount).toFixed(2)}` : '₹0'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-black text-emerald-700">₹{Number(rec.final_applied_rate || 0).toFixed(2)}</td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setInspectRecord(rec)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-2.5">
                    {filteredSameRetailer.map((rec, idx) => {
                      const isCancelled = rec.invoice_status === 'Cancelled';
                      const purchaseRate = rec.purchase_rate !== undefined ? rec.purchase_rate : (targetProduct?.purchase_price || 0);

                      return (
                        <div key={rec.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-indigo-700">{rec.invoice_number}</span>
                              {idx === 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">Latest</span>}
                              {isCancelled && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">Cancelled</span>}
                            </div>
                            <span className="text-slate-500 font-medium">{formatShortDate(rec.date)}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 font-mono">
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Billed Qty</span>
                              <strong className="text-slate-900 font-bold">{rec.quantity} units</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Purchase Rate</span>
                              <strong className="text-slate-700 font-bold">₹{purchaseRate.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Billing Rate</span>
                              <strong className="text-indigo-700 font-bold">₹{Number(rec.applied_rate || rec.carton_rate || 0).toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Discount</span>
                              <strong className="text-rose-600 font-bold">{Number(rec.discount || 0) > 0 ? `₹${Number(rec.discount).toFixed(2)}` : '₹0'}</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Final Rate:</span>
                              <span className="font-mono font-black text-emerald-700 text-sm">₹{Number(rec.final_applied_rate || 0).toFixed(2)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectRecord(rec)}
                              className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECTION 2: ALL RETAILERS HISTORY */}
          {(activeTab === 'both' || activeTab === 'all_retailers') && (
            <div className="space-y-3 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase">
                      Last 5 Billing Details &mdash; All Retailers
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Market-wide recent billings of {displayProductName} across all customers in {activeCompany?.name || 'Company'}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-mono font-bold border border-amber-200">
                  {filteredAllRetailers.length} Records
                </span>
              </div>

              {filteredAllRetailers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                  No historical billings recorded for this product variant across any retailers.
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase bg-slate-50/80">
                          <th className="p-2.5">Invoice</th>
                          <th className="p-2.5">Retailer</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5 text-right text-slate-700">Purchase Rate</th>
                          <th className="p-2.5 text-right text-indigo-800">Billing Rate</th>
                          <th className="p-2.5 text-right text-rose-700">Discount</th>
                          <th className="p-2.5 text-right text-emerald-800">Final Rate</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredAllRetailers.map((rec, idx) => {
                          const isCancelled = rec.invoice_status === 'Cancelled';
                          const purchaseRate = rec.purchase_rate !== undefined ? rec.purchase_rate : (targetProduct?.purchase_price || 0);

                          return (
                            <tr key={rec.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-mono font-bold text-indigo-700">
                                {rec.invoice_number}
                                {isCancelled && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">Cancelled</span>
                                )}
                              </td>
                              <td className="p-2.5 font-bold text-slate-800">
                                {rec.retailer_name}
                                {rec.retailer_city && <span className="text-[10px] text-slate-400 font-normal ml-1">({rec.retailer_city})</span>}
                              </td>
                              <td className="p-2.5 text-slate-600 whitespace-nowrap">{formatShortDate(rec.date)}</td>
                              <td className="p-2.5 text-center font-bold text-slate-900">{rec.quantity}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-700">₹{purchaseRate.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-indigo-700">₹{Number(rec.applied_rate || rec.carton_rate || 0).toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono text-rose-600 font-bold">
                                {Number(rec.discount || 0) > 0 ? `₹${Number(rec.discount).toFixed(2)}` : '₹0'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-black text-emerald-700">₹{Number(rec.final_applied_rate || 0).toFixed(2)}</td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setInspectRecord(rec)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-2.5">
                    {filteredAllRetailers.map((rec, idx) => {
                      const isCancelled = rec.invoice_status === 'Cancelled';
                      const purchaseRate = rec.purchase_rate !== undefined ? rec.purchase_rate : (targetProduct?.purchase_price || 0);

                      return (
                        <div key={rec.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-indigo-700">{rec.invoice_number}</span>
                            <span className="text-slate-500 font-medium">{formatShortDate(rec.date)}</span>
                          </div>

                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{rec.retailer_name}</span>
                            {rec.retailer_city && <span className="text-slate-400 font-normal">({rec.retailer_city})</span>}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 font-mono">
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Billed Qty</span>
                              <strong className="text-slate-900 font-bold">{rec.quantity} units</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Purchase Rate</span>
                              <strong className="text-slate-700 font-bold">₹{purchaseRate.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Billing Rate</span>
                              <strong className="text-indigo-700 font-bold">₹{Number(rec.applied_rate || rec.carton_rate || 0).toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-sans block text-[10px]">Discount</span>
                              <strong className="text-rose-600 font-bold">{Number(rec.discount || 0) > 0 ? `₹${Number(rec.discount).toFixed(2)}` : '₹0'}</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Final Rate:</span>
                              <span className="font-mono font-black text-emerald-700 text-sm">₹{Number(rec.final_applied_rate || 0).toFixed(2)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectRecord(rec)}
                              className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* ========================================================
            MODAL FOOTER
            ======================================================== */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Company-isolated &bull; Exact product variant match
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>

        {/* ========================================================
            NESTED INSPECT RECORD MODAL
            ======================================================== */}
        {inspectRecord && (
          <div className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Historical Invoice Details</h4>
                  <p className="font-mono text-xs text-indigo-700 font-bold">{inspectRecord.invoice_number}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectRecord(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Retailer</span>
                  <span className="font-bold text-slate-900">{inspectRecord.retailer_name}</span>
                  {inspectRecord.retailer_city && <span className="text-[11px] text-slate-500 block">{inspectRecord.retailer_city}</span>}
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Invoice Date &amp; Time</span>
                  <span className="font-mono font-bold text-slate-800">{formatDateTime(inspectRecord.date)}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Order Number</span>
                  <span className="font-mono font-bold text-slate-800">{inspectRecord.order_number}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Quantity Billed</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {inspectRecord.carton_qty !== undefined ? `${inspectRecord.carton_qty} Box` : ''} 
                    {inspectRecord.loose_qty ? ` + ${inspectRecord.loose_qty} Loose` : ''} ({inspectRecord.quantity} Pcs)
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Rate (Cost)</span>
                  <span className="font-mono font-black text-slate-800">₹{Number(inspectRecord.purchase_rate || targetProduct?.purchase_price || 0).toFixed(2)}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Billed Rate</span>
                  <span className="font-mono font-black text-indigo-700">₹{Number(inspectRecord.applied_rate || inspectRecord.carton_rate || 0).toFixed(2)}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Flat Discount</span>
                  <span className="font-mono font-bold text-rose-600">₹{Number(inspectRecord.discount || 0).toFixed(2)}</span>
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Final Billed Rate</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">₹{Number(inspectRecord.final_applied_rate || 0).toFixed(2)}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">GST Applied</span>
                  <span className="font-mono font-bold text-slate-800">{(inspectRecord.gst_percent !== undefined && inspectRecord.gst_percent !== null) ? inspectRecord.gst_percent : 0}% (₹{Number(inspectRecord.gst_amount || 0).toFixed(2)})</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Invoice Grand Total</span>
                  <span className="font-mono font-black text-slate-900">₹{Number(inspectRecord.invoice_total || 0).toFixed(2)}</span>
                </div>
              </div>

              {(inspectRecord.salesperson || inspectRecord.channel) && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span>Salesperson: <strong>{inspectRecord.salesperson || 'Direct'}</strong></span>
                  <span>Channel: <strong>{inspectRecord.channel || 'Sales Order'}</strong></span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setInspectRecord(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
