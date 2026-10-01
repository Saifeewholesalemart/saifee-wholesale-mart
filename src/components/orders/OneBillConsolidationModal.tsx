'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, Retailer, Product, OrderItem, Invoice, InvoiceItem,
  formatQuantityDisplay, splitBaseQuantity, calculateBaseQuantity, 
  deriveOrderChannel
} from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import { 
  X, Check, AlertTriangle, Package, Truck, 
  Receipt, ArrowRight, ArrowLeft, Printer, 
  Store, ShieldCheck, Clock, Tag, History, 
  Sparkles, CheckCircle2, TrendingUp, AlertCircle, 
  FileText, Combine, CheckSquare, Square, Download, Search
} from 'lucide-react';
import { printInvoiceDocument } from '@/lib/printInvoice';

interface OneBillConsolidationModalProps {
  retailerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialOrderIds?: string[];
}

export interface ConsolidatedSKURow {
  compositeKey: string; // e.g. "SKU123__MRP_600"
  productId: string;
  sku: string;
  name: string;
  brand: string;
  packSize: string;
  hsn: string;
  mrp: number;
  purchaseCost: number;
  tradingUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  totalOrderedBase: number;
  totalOrderedPieces: number;
  totalOrderedCartons: number;
  billedBaseQty: number;
  billedPieces: number;
  billedCartonQty: number;
  billedLooseQty: number;
  billedRate: number; // Rate per piece (₹)
  gstPercent: number;
  sourceOrderIds: string[];
  orderItemIds: string[];
  isBackorder?: boolean;
  originTag?: string;
  daysPending?: number;
}

export default function OneBillConsolidationModal({
  retailerId,
  isOpen,
  onClose,
  onSuccess,
  initialOrderIds
}: OneBillConsolidationModalProps) {
  const { 
    orders, retailers, products, inventory, companies,
    consolidateOrders, confirmConsolidation, dispatchConsolidation,
    currentUser, activeCompany, batches, profiles
  } = useDb();

  const retailer = retailers.find(r => r.id === retailerId);

  // Eligible open orders for this retailer (strictly excludes completed & fully invoiced orders)
  const retailerOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.retailer_id !== retailerId) return false;
      if (o.status === 'Completed' || o.status === 'Delivered' || o.status === 'Cancelled') return false;
      // Exclude orders where all items are already 100% fulfilled
      const hasRemaining = (o.items || []).some(it => {
        const ord = it.ordered_qty ?? it.base_qty ?? it.quantity;
        const ful = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
        const can = it.cancelled_qty ?? 0;
        return (ord - ful - can) > 0;
      });
      return hasRemaining;
    }).sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
  }, [orders, retailerId]);

  // Step state: 1 = Order Selection, 2 = SKU Review & Billing, 3 = Generated GST Tax Invoice View
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Selected order IDs for consolidation
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Consolidated SKU items state (keyed by compositeKey: `${sku}__MRP_${mrp}`)
  const [skuRows, setSkuRows] = useState<ConsolidatedSKURow[]>([]);

  // Generated Invoice state when reaching Step 3
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [step3ItemSearchQuery, setStep3ItemSearchQuery] = useState('');

  // Rate history popover
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string; compositeKey: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize selected orders on open
  useEffect(() => {
    if (!isOpen) return;
    if (initialOrderIds && initialOrderIds.length > 0) {
      setSelectedOrderIds(initialOrderIds.filter(id => retailerOrders.some(o => o.id === id)));
    } else {
      // Select all open orders by default
      setSelectedOrderIds(retailerOrders.map(o => o.id));
    }
    setCurrentStep(1);
    setGeneratedInvoice(null);
  }, [isOpen, initialOrderIds, retailerOrders]);

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // Toggle Select All
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === retailerOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(retailerOrders.map(o => o.id));
    }
  };

  // Open Backorders detection for Banner (Specification 3)
  const openBackorders = useMemo(() => {
    return retailerOrders.filter(o => {
      const isPart = o.status === 'Partially Confirmed' || o.status === 'Partially Dispatched';
      const hasBackorderItems = (o.items || []).some(it => {
        const ord = it.ordered_qty ?? it.base_qty ?? it.quantity;
        const ful = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
        return (ord - ful) > 0 && ful > 0;
      });
      return isPart || hasBackorderItems;
    });
  }, [retailerOrders]);

  // Build aggregated SKU rows with Dual MRP Handling and Origin Tagging (Specification 3)
  const handleProceedToStep2 = () => {
    if (selectedOrderIds.length === 0) return;

    const selectedOrdersList = retailerOrders.filter(o => selectedOrderIds.includes(o.id));
    const aggregationMap: { [compositeKey: string]: ConsolidatedSKURow } = {};

    // Determine the newest order among selected orders to distinguish prior backorders from today's/newest orders
    const sortedSelected = [...selectedOrdersList].sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
    const newestOrderId = sortedSelected[0]?.id;

    selectedOrdersList.forEach(order => {
      const isPriorOrder = order.id !== newestOrderId || 
        order.status === 'Partially Confirmed' || 
        order.status === 'Partially Dispatched' ||
        (order.items || []).some(it => (it.fulfilled_qty || 0) > 0);
      
      const orderPendencyDays = Math.max(0, Math.floor((new Date().getTime() - new Date(order.created_at || order.order_date).getTime()) / (1000 * 60 * 60 * 24)));

      order.items?.forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        const unitsPerPack = item.units_per_box_carton || prod?.units_per_box_carton || 1;
        const totalBase = item.base_qty ?? item.quantity;
        const mrp = item.selected_mrp || prod?.mrp || 0;
        const sku = prod?.sku || item.product_id;
        
        // Calculate remaining unbilled quantity for this item
        const previousFulfilled = item.fulfilled_qty ?? item.dispatched_qty ?? 0;
        const remainingBase = item.remaining_qty !== undefined 
          ? item.remaining_qty 
          : Math.max(0, totalBase - previousFulfilled - (item.cancelled_qty || 0));

        // Skip completely fulfilled items
        if (remainingBase <= 0 && previousFulfilled > 0) return;

        const effectiveBaseQty = remainingBase > 0 ? remainingBase : totalBase;
        
        // CRITICAL RULE: Composite key ensures distinct MRPs are never lumped together
        const compositeKey = `${sku}__MRP_${mrp}`;

        const purchaseCost = item.purchase_rate || prod?.purchase_price || (prod?.selling_price ? prod.selling_price * 0.9 : 0);
        // Preserve original locked billing rate (Specification 3)
        const currentRate = item.carton_rate ?? item.manual_billing_rate ?? item.final_applied_rate ?? (item.base_price !== undefined ? item.base_price - (item.discount || 0) : (prod?.selling_price || 0));
        const gstPercent = item.gst_percent || prod?.gst_percent || 18;

        const originTag = isPriorOrder 
          ? `⏳ Prior Order: ${order.order_number} (Pending Balance)`
          : `🆕 Today's Order: ${order.order_number}`;

        if (!aggregationMap[compositeKey]) {
          aggregationMap[compositeKey] = {
            compositeKey,
            productId: item.product_id,
            sku,
            name: prod?.name || 'Product Variant',
            brand: prod?.brand || 'Brand',
            packSize: '1 Pc',
            hsn: prod?.hsn || '1902',
            mrp,
            purchaseCost,
            tradingUnit: 'Piece',
            baseUnit: 'Piece',
            unitsPerPack: 1,
            totalOrderedBase: totalBase,
            totalOrderedPieces: totalBase,
            totalOrderedCartons: totalBase,
            billedBaseQty: effectiveBaseQty,
            billedPieces: effectiveBaseQty,
            billedCartonQty: effectiveBaseQty,
            billedLooseQty: 0,
            billedRate: currentRate,
            gstPercent,
            sourceOrderIds: [order.id],
            orderItemIds: [item.id],
            isBackorder: isPriorOrder,
            originTag,
            daysPending: orderPendencyDays
          };
        } else {
          aggregationMap[compositeKey].totalOrderedBase += totalBase;
          aggregationMap[compositeKey].totalOrderedPieces = aggregationMap[compositeKey].totalOrderedBase;
          aggregationMap[compositeKey].billedBaseQty += effectiveBaseQty;
          aggregationMap[compositeKey].billedPieces = aggregationMap[compositeKey].billedBaseQty;
          aggregationMap[compositeKey].billedCartonQty = aggregationMap[compositeKey].billedBaseQty;
          aggregationMap[compositeKey].billedLooseQty = 0;
          aggregationMap[compositeKey].totalOrderedCartons = aggregationMap[compositeKey].totalOrderedBase;
          if (!aggregationMap[compositeKey].sourceOrderIds.includes(order.id)) {
            aggregationMap[compositeKey].sourceOrderIds.push(order.id);
            aggregationMap[compositeKey].originTag = `🔀 Merged (${aggregationMap[compositeKey].sourceOrderIds.length} Orders)`;
          }
          aggregationMap[compositeKey].orderItemIds.push(item.id);
        }
      });
    });

    setSkuRows(Object.values(aggregationMap));
    setCurrentStep(2);
  };

  // Financial calculations for consolidated SKUs
  const financialSummary = useMemo(() => {
    let taxableSubtotal = 0;
    let totalGst = 0;

    skuRows.forEach(row => {
      const lineTaxable = row.billedRate * (row.billedPieces ?? row.billedBaseQty);
      const lineGst = lineTaxable * (row.gstPercent / 100);
      taxableSubtotal += lineTaxable;
      totalGst += lineGst;
    });

    const grandTotal = Math.round(taxableSubtotal + totalGst);
    const roundOff = grandTotal - (taxableSubtotal + totalGst);
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    const currentOutstanding = retailer?.outstanding || 0;
    const creditLimit = retailer?.credit_limit || 50000;
    const postBillBalance = currentOutstanding + grandTotal;
    const isOverCredit = postBillBalance > creditLimit;

    return {
      taxableSubtotal,
      totalGst,
      cgst,
      sgst,
      roundOff,
      grandTotal,
      currentOutstanding,
      creditLimit,
      postBillBalance,
      isOverCredit
    };
  }, [skuRows, retailer]);

  // Update Billed Qty in Pieces
  const updateRowBilledQty = (compositeKey: string, pieces: number) => {
    setSkuRows(prev => prev.map(row => {
      if (row.compositeKey !== compositeKey) return row;
      const pQty = Math.max(0, pieces || 0);
      return {
        ...row,
        billedPieces: pQty,
        billedCartonQty: pQty,
        billedLooseQty: 0,
        billedBaseQty: pQty
      };
    }));
  };

  // Update Billed Rate
  const updateRowRate = (compositeKey: string, rate: number) => {
    setSkuRows(prev => prev.map(row => {
      if (row.compositeKey !== compositeKey) return row;
      return {
        ...row,
        billedRate: Math.max(0, rate)
      };
    }));
  };

  // Generate 1 Tax Invoice (Step 3) using full DB consolidation engine
  const handleGenerate1TaxInvoice = () => {
    if (!retailer || selectedOrderIds.length === 0) return;

    // 1. Create consolidated fulfilment
    const ful = consolidateOrders(retailer.id, selectedOrderIds);

    // 2. Prepare confirms array with our adjusted rates and quantities
    const confirms = ful.items?.map(fItem => {
      const match = skuRows.find(r => r.productId === fItem.product_id);
      return {
        itemId: fItem.id,
        confirmedQty: match?.billedBaseQty || fItem.original_qty,
        cartonRate: match?.billedRate || fItem.carton_rate,
        manualRate: match?.billedRate,
        rateReason: '1-Bill Consolidation Approved Rate'
      };
    }) || [];

    confirmConsolidation(ful.id, confirms);

    // 3. Dispatch consolidation to atomically generate standard Tax Invoice
    const generated = dispatchConsolidation(ful.id, {
      notes: 'Generated via 1-Bill FMCG Engine'
    });

    if (generated) {
      setGeneratedInvoice(generated);
      setCurrentStep(3);
      setToastMessage(`1-Bill Tax Invoice ${generated.invoice_number} created! Merged ${selectedOrderIds.length} orders.`);
    }
  };

  // Handle Print
  const handlePrint = () => {
    if (generatedInvoice) {
      printInvoiceDocument('printable-tax-invoice', `1-Bill Tax Invoice - ${generatedInvoice.invoice_number}`);
    } else {
      printInvoiceDocument('printable-tax-invoice', '1-Bill Tax Invoice');
    }
  };

  const formatINR = (val?: number) => {
    if (val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isOpen || !retailer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in print:static print:bg-transparent print:p-0 print:m-0 print:block print:w-full print:h-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:static print:max-w-full print:w-full print:bg-transparent print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible print:max-h-none">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-60 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header & Step Indicator */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                1-Bill FMCG Engine
              </span>
              <span className="text-xs text-purple-200 font-bold">
                Step {currentStep} of 3: {currentStep === 1 ? 'Order Selection' : currentStep === 2 ? 'SKU Deduplication & Margin Audit' : 'GST Tax Invoice'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
              {retailer.shop_name} &bull; <span className="text-purple-200 text-xs font-normal">{retailer.city} ({retailerOrders.length} Open Orders)</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Step Pills */}
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl text-xs font-bold">
              <span className={`px-2.5 py-1 rounded-lg ${currentStep === 1 ? 'bg-white text-purple-900 shadow-xs' : 'text-purple-200'}`}>1. Select</span>
              <span className={`px-2.5 py-1 rounded-lg ${currentStep === 2 ? 'bg-white text-purple-900 shadow-xs' : 'text-purple-200'}`}>2. SKU &amp; Margin</span>
              <span className={`px-2.5 py-1 rounded-lg ${currentStep === 3 ? 'bg-white text-purple-900 shadow-xs' : 'text-purple-200'}`}>3. 1-Bill Invoice</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-purple-200 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STEP 1: ORDER MULTI-SELECTION */}
        {currentStep === 1 && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {/* Open Backorders Alert Banner (Specification 3) */}
            {openBackorders.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 shadow-2xs">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Pending Backorders Detected
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Pending items found from prior order(s) <strong className="font-mono font-bold text-amber-950">{openBackorders.map(o => o.order_number).join(', ')}</strong> placed {Math.max(...openBackorders.map(o => Math.max(0, Math.floor((new Date().getTime() - new Date(o.created_at || o.order_date).getTime()) / (1000 * 60 * 60 * 24)))))} days ago. Auto-merged into 1-Bill with locked historical rates.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Select Orders to Merge into 1 Bill</h3>
                <p className="text-xs text-slate-500">
                  Select 2 or more orders to automatically aggregate identical SKUs and generate a single GST Tax Invoice.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                {selectedOrderIds.length === retailerOrders.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select All ({retailerOrders.length})</span>
                  </>
                )}
              </button>
            </div>

            {retailerOrders.length === 0 ? (
              <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-700">No open orders found for this retailer.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {retailerOrders.map(order => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const channelObj = deriveOrderChannel(order);
                  const totalItems = order.items?.length || 0;
                  const totalPieces = order.items?.reduce((acc, it) => acc + (it.base_qty || it.quantity), 0) || 0;
                  const isBackorderOrd = order.status === 'Partially Confirmed' || order.status === 'Partially Dispatched';
                  const daysPend = Math.max(0, Math.floor((new Date().getTime() - new Date(order.created_at || order.order_date).getTime()) / (1000 * 60 * 60 * 24)));

                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleOrderSelection(order.id)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isSelected 
                          ? 'border-purple-600 bg-purple-50/50 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-white ${
                            isSelected ? 'bg-purple-600' : 'border border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="font-mono font-black text-slate-900 text-sm block">
                              {order.order_number}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {daysPend > 0 && <span className="ml-1 text-amber-700 font-bold">({daysPend}d ago)</span>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {isBackorderOrd && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              ⏳ Backorder
                            </span>
                          )}
                          {(() => {
                            const spProfile = profiles?.find(p => p.id === order.created_by || p.name === order.created_by || p.email === order.created_by);
                            const cleanName = spProfile?.name
                              ?.replace(/\s*\((Distributor Sales|Parle Salesperson|Britannia Salesperson|HUL Salesperson|Retailer Direct|Dist|Co|Salesperson)\)/gi, '')
                              ?.replace(/\s*\([^)]*sales[^)]*\)/gi, '')
                              ?.trim();
                            const spName = cleanName || (order.created_by && !order.created_by.startsWith('p-') ? order.created_by : '');
                            return (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${channelObj.badgeClass}`}>
                                {channelObj.label}{spName && (order.source === 'distributor_salesperson' || order.source === 'company_salesperson') ? `: ${spName}` : ''}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 text-slate-600">
                        <span>{totalItems} SKUs &bull; {totalPieces} Pcs</span>
                        <span className="font-black text-slate-900 text-sm font-mono">
                          {formatINR(order.total_amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: AUTOMATED SKU DEDUPLICATION & MARGIN AUDIT */}
        {currentStep === 2 && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            {/* Open Backorders Alert Banner (Specification 3) */}
            {openBackorders.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 shadow-2xs">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Cross-Order Merged with Backorders
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Merged pending backorder items from prior order(s) <strong className="font-mono font-bold text-amber-950">{openBackorders.map(o => o.order_number).join(', ')}</strong> with today&apos;s fresh lines. Original billing rates are locked and preserved.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">SKU Deduplication &amp; Commercial Rate Audit</h3>
                <p className="text-xs text-slate-500">
                  Aggregated {selectedOrderIds.length} orders into {skuRows.length} distinct FMCG billing lines. Products with different MRPs are strictly segregated.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dual-MRP segregation &amp; Locked Rates Active</span>
              </div>
            </div>

            {/* Aggregated SKU Table with Origin Tag (Specification 3) */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
              <table className="w-full text-left text-xs min-w-[860px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">PRODUCT &amp; MRP</th>
                    <th className="p-3 text-center">ORIGIN TAG</th>
                    <th className="p-3 text-center">PURCHASE COST &amp; MARGIN</th>
                    <th className="p-3 text-center">ORDERED (PCS)</th>
                    <th className="p-3 text-center min-w-[120px]">BILLED QTY (PCS)</th>
                    <th className="p-3 text-right">RATE / PIECE (₹)</th>
                    <th className="p-3 text-right">LINE TOTAL (INCL. GST)</th>
                    <th className="p-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skuRows.map(row => {
                    const lineTaxable = row.billedRate * (row.billedPieces ?? row.billedBaseQty);
                    const lineTotal = lineTaxable * (1 + row.gstPercent / 100);
                    const marginPct = row.billedRate > 0 && row.purchaseCost > 0
                      ? Math.round(((row.billedRate - row.purchaseCost) / row.billedRate) * 10000) / 100
                      : null;

                    return (
                      <tr key={row.compositeKey} className={`hover:bg-slate-50/70 transition-colors ${row.isBackorder ? 'bg-amber-50/20' : ''}`}>
                        {/* Col 1: Product SKU & MRP Badge */}
                        <td className="p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm">{row.name}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                              MRP ₹{row.mrp}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                            <span>SKU: <strong className="font-mono text-slate-700">{row.sku}</strong></span>
                            <span>&bull;</span>
                            <span>HSN: <strong className="font-mono text-slate-700">{row.hsn}</strong></span>
                          </div>
                        </td>

                        {/* Col 2: Origin Tag (Specification 3) */}
                        <td className="p-3 text-center">
                          {row.isBackorder ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                <span>{row.originTag || '⏳ Prior Order (Pending Balance)'}</span>
                              </span>
                              {row.daysPending !== undefined && row.daysPending > 0 && (
                                <span className="block text-[10px] text-amber-700 font-bold">
                                  Placed {row.daysPending}d ago
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                              <span>{row.originTag || "🆕 Today's Order"}</span>
                            </span>
                          )}
                        </td>

                        {/* Col 3: Dist. Cost & Live Margin */}
                        <td className="p-3 text-center">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-700 font-mono block">
                              ₹{row.purchaseCost.toFixed(2)}/pc
                            </span>
                            {marginPct !== null && (
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-black ${
                                marginPct >= 10 ? 'bg-emerald-100 text-emerald-800' : marginPct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                              }`}>
                                <TrendingUp className="w-3 h-3" />
                                <span>{marginPct >= 0 ? `+${marginPct.toFixed(2)}% Margin` : `${marginPct}% Margin`}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Col 4: Total Ordered Pieces */}
                        <td className="p-3 text-center font-black text-slate-900 text-sm font-mono">
                          {row.totalOrderedPieces ?? row.totalOrderedBase} Pcs
                        </td>

                        {/* Col 5: Single Billed Qty Input (Pieces) */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={row.billedPieces ?? row.billedBaseQty}
                              onChange={(e) => updateRowBilledQty(row.compositeKey, parseInt(e.target.value) || 0)}
                              className="w-18 text-center text-xs font-black text-slate-900 border border-slate-300 rounded-md p-1 outline-none focus:border-purple-600 bg-white"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">Pcs</span>
                          </div>
                        </td>

                        {/* Col 6: Billed Rate (Rate / Piece) */}
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={row.billedRate}
                              onChange={(e) => updateRowRate(row.compositeKey, parseFloat(e.target.value) || 0)}
                              className="w-20 text-right text-xs font-black text-purple-700 border border-slate-300 rounded-md p-1 outline-none focus:border-purple-600 bg-white"
                            />
                            <span className="text-[10px] text-slate-400 font-medium">/Pc</span>
                          </div>
                        </td>

                        {/* Col 7: Tax & Line Total */}
                        <td className="p-3 text-right">
                          <span className="font-black text-slate-900 text-sm block font-mono">
                            {formatINR(lineTotal)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block">
                            Incl. {row.gstPercent}% GST
                          </span>
                        </td>

                        {/* Col 8: Actions */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setRateHistoryTarget({
                                retailerId: retailer.id,
                                productId: row.productId,
                                tradingUnit: row.tradingUnit,
                                compositeKey: row.compositeKey
                              });
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Last 5 Rates"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100 space-y-1.5 text-xs">
                <span className="text-purple-900 font-bold uppercase tracking-wide block">Retailer Credit Limit Audit</span>
                <div className="flex justify-between text-slate-600">
                  <span>Current Outstanding:</span>
                  <span className="font-bold text-slate-900">{formatINR(financialSummary.currentOutstanding)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Credit Limit:</span>
                  <span className="font-bold text-slate-900">{formatINR(financialSummary.creditLimit)}</span>
                </div>
                <div className="flex justify-between font-black pt-1 border-t border-purple-200 text-purple-900">
                  <span>Post-Bill Balance:</span>
                  <span>{formatINR(financialSummary.postBillBalance)}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal:</span>
                  <span className="font-bold text-slate-900">{formatINR(financialSummary.taxableSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CGST (9%) + SGST (9%):</span>
                  <span className="font-bold text-slate-900">{formatINR(financialSummary.totalGst)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-purple-900 pt-2 border-t border-slate-200">
                  <span>Net Grand Total:</span>
                  <span>{formatINR(financialSummary.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: GENERATED GST TAX INVOICE VIEW */}
        {currentStep === 3 && generatedInvoice && (
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 print:p-0 print:overflow-visible">
            {/* Inject CSS print tweaks for clean high-density A4 printout */}
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm;
                }
                /* Hide everything on the active screen */
                body * {
                  visibility: hidden !important;
                }
                /* Show ONLY the printable invoice element */
                #printable-tax-invoice,
                #printable-tax-invoice * {
                  visibility: visible !important;
                }
                #printable-tax-invoice {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 8mm 10mm !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  box-shadow: none !important;
                  border: 1px solid #334155 !important;
                  border-radius: 0 !important;
                  box-sizing: border-box !important;
                }
                .no-print,
                .no-print *,
                button,
                header,
                nav,
                aside,
                footer {
                  display: none !important;
                  visibility: hidden !important;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background-color: #ffffff !important;
                  font-size: 8pt !important;
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                table {
                  width: 100% !important;
                  page-break-inside: auto;
                  border-collapse: collapse !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  page-break-after: auto;
                }
                thead {
                  display: table-header-group !important;
                }
                .dense-print-th {
                  padding: 3px 4px !important;
                  font-size: 7.5pt !important;
                  border-top: 1px solid #000000 !important;
                  border-bottom: 1px solid #000000 !important;
                  background-color: #f1f5f9 !important;
                  color: #000000 !important;
                }
                .dense-print-td {
                  padding: 3px 4px !important;
                  font-size: 8pt !important;
                  border-bottom: 0.5px solid #cbd5e1 !important;
                  line-height: 1.2 !important;
                }
              }
            `}</style>

            {/* Printable Tax Invoice Container */}
            <div id="printable-tax-invoice" className="bg-white border border-slate-300 rounded-xl p-3 sm:p-5 shadow-sm space-y-3 text-slate-900 print-area text-xs">
              {/* Header: Firm & Invoice Info */}
              {(() => {
                const firmName = activeCompany?.name?.toUpperCase() || companies?.[0]?.name?.toUpperCase() || 'SAIFEE GENERAL STORES';
                const firmFirstLetter = firmName.charAt(0) || 'S';
                const firmAddress = activeCompany?.address 
                  ? `${activeCompany.address}${activeCompany.city ? `, ${activeCompany.city}` : ''}` 
                  : 'FMCG Warehouse Distributors, Sector 15, Kalamboli Logistics Zone, Navi Mumbai, MH';
                const firmGstin = activeCompany?.gstin || '27SAIFE1234A1Z5';

                return (
                  <div className="flex justify-between items-start gap-3 border-b border-slate-300 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-white font-black text-xs">
                          {firmFirstLetter}
                        </div>
                        <span className="text-sm sm:text-base font-black text-slate-950 tracking-tight uppercase">
                          {firmName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug max-w-sm">
                        {firmAddress}
                      </p>
                      <p className="text-[11px] text-slate-900 font-bold">GSTIN: {firmGstin} <span className="text-slate-500 font-normal">| State: 27 (MH)</span></p>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider">
                        TAX INVOICE
                      </span>
                      <div className="text-[11px] text-slate-700 text-right space-y-0.5">
                        <p><span className="text-slate-500">Invoice No:</span> <strong className="text-slate-900 font-bold font-mono">{generatedInvoice.invoice_number}</strong></p>
                        <p><span className="text-slate-500">Date:</span> <strong className="text-slate-900 font-bold">{new Date(generatedInvoice.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></p>
                        <p><span className="text-slate-500">Consolidated Orders:</span> <strong className="text-indigo-900 font-bold font-mono">{selectedOrderIds.map(id => orders.find(ord => ord.id === id)?.order_number || id).join(', ')}</strong></p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Billed To / Retailer Info Grid */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-2 text-[11px]">
                <div className="space-y-0.5 pr-2 border-r border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">BUYER (BILL TO)</span>
                  <p className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] leading-snug tracking-tight uppercase">{retailer.shop_name}</p>
                  <p className="text-slate-700 leading-tight">{retailer.address || retailer.city}</p>
                  <p className="text-slate-800"><span className="text-slate-500">Prop:</span> {retailer.owner_name} <span className="text-slate-500">| Ph:</span> {retailer.mobile || 'N/A'}</p>
                  <p className="font-bold text-slate-900"><span className="text-slate-500 font-normal">GSTIN:</span> {retailer.gstin || 'Unregistered'}</p>
                </div>
                <div className="space-y-0.5 pl-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">DESPATCH &amp; TERMS</span>
                  <div className="space-y-0.5 text-slate-700 text-[11px]">
                    <p className="flex justify-between"><span className="text-slate-500">Dispatch Mode:</span> <span className="font-semibold text-slate-800">Delivery Van</span></p>
                    <p className="flex justify-between"><span className="text-slate-500">Payment Terms:</span> <span className="font-semibold text-slate-800">15 Days Credit</span></p>
                    {generatedInvoice.fulfilment_number && (
                      <p className="flex justify-between"><span className="text-slate-500">Fulfilment:</span> <span className="font-mono font-bold text-indigo-700">{generatedInvoice.fulfilment_number}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Item Quick Search Bar Just Above Items Table (Screen-only) */}
              <div className="no-print flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={step3ItemSearchQuery}
                    onChange={(e) => setStep3ItemSearchQuery(e.target.value)}
                    placeholder="Search item in consolidated invoice (name, HSN, batch, MRP, pack)..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium shadow-2xs"
                  />
                  {step3ItemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStep3ItemSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                      title="Clear item search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-medium text-[11px]">
                  {step3ItemSearchQuery ? (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-md font-bold font-mono">
                      Showing {(generatedInvoice.items || []).filter(item => {
                        const prod = products.find(p => p.id === item.product_id);
                        const q = step3ItemSearchQuery.toLowerCase().trim();
                        const prodName = (prod?.name || item.description || item.variant_name || item.product_name || '').toLowerCase();
                        const hsn = (item.hsn || prod?.hsn || '').toLowerCase();
                        const batchNo = (item.batch_number || '').toLowerCase();
                        const packing = (item.packing || prod?.pack_size || '').toLowerCase();
                        const mrp = String(item.mrp || prod?.mrp || '');
                        return prodName.includes(q) || hsn.includes(q) || batchNo.includes(q) || packing.includes(q) || mrp.includes(q);
                      }).length} of {generatedInvoice.items?.length || 0} items
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold font-mono">
                      {generatedInvoice.items?.length || 0} items
                    </span>
                  )}
                </div>
              </div>

              {/* 10-Column Single-Line High-Density Item Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-900 text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                      <th className="py-1 px-1.5 text-center w-7 dense-print-th">#</th>
                      <th className="py-1 px-2 text-left dense-print-th">Description of Goods</th>
                      <th className="py-1 px-1.5 text-center w-16 dense-print-th">HSN</th>
                      <th className="py-1 px-1.5 text-right w-16 dense-print-th">MRP (₹)</th>
                      <th className="py-1 px-2 text-center w-28 dense-print-th">Billed Qty</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Rate/Unit (₹)</th>
                      <th className="py-1 px-1.5 text-right w-14 dense-print-th">Disc (₹)</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Taxable (₹)</th>
                      <th className="py-1 px-1 text-center w-12 dense-print-th">GST</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {(() => {
                      const allItems = generatedInvoice.items || [];
                      const filteredItems = step3ItemSearchQuery.trim()
                        ? allItems.filter(item => {
                            const prod = products.find(p => p.id === item.product_id);
                            const q = step3ItemSearchQuery.toLowerCase().trim();
                            const prodName = (prod?.name || item.description || item.variant_name || item.product_name || '').toLowerCase();
                            const hsn = (item.hsn || prod?.hsn || '').toLowerCase();
                            const batchNo = (item.batch_number || '').toLowerCase();
                            const packing = (item.packing || prod?.pack_size || '').toLowerCase();
                            const mrp = String(item.mrp || prod?.mrp || '');
                            return prodName.includes(q) || hsn.includes(q) || batchNo.includes(q) || packing.includes(q) || mrp.includes(q);
                          })
                        : allItems;

                      if (filteredItems.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                              <div className="space-y-1.5">
                                <p className="font-bold text-slate-700">No invoice items match &ldquo;{step3ItemSearchQuery}&rdquo;</p>
                                <p className="text-[11px] text-slate-400">Try searching with a different product name, HSN or batch number.</p>
                                <button
                                  type="button"
                                  onClick={() => setStep3ItemSearchQuery('')}
                                  className="inline-block mt-1 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Clear Search Filter
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return filteredItems.map((item: InvoiceItem, idx: number) => {
                      const prod = products.find(p => p.id === item.product_id);
                      const unitAbbr = item.trading_unit ? (item.trading_unit.toLowerCase().includes('carton') ? 'CTN' : item.trading_unit.toUpperCase()) : 'CTN';
                      const gstRate = prod?.gst_percent ? `${prod.gst_percent}%` : '18%';

                      // Billed Qty Formatter
                      let qtyDisplay = '';
                      if (item.carton_qty !== undefined && item.loose_qty !== undefined) {
                        const cUnit = item.trading_unit || prod?.trading_unit || 'Ctn';
                        const lUnit = item.base_unit || prod?.base_unit || 'Pcs';
                        if (item.carton_qty > 0 && item.loose_qty > 0) {
                          qtyDisplay = `${item.carton_qty} ${cUnit} + ${item.loose_qty} ${lUnit}`;
                        } else if (item.carton_qty > 0) {
                          qtyDisplay = `${item.carton_qty} ${cUnit}`;
                        } else {
                          qtyDisplay = `${item.loose_qty} ${lUnit}`;
                        }
                      } else {
                        qtyDisplay = formatQuantityDisplay(
                          item.base_qty ?? item.quantity,
                          item.units_per_box_carton ?? prod?.units_per_box_carton ?? item.units_per_trading_unit ?? 1,
                          item.trading_unit || prod?.trading_unit || 'Carton',
                          item.base_unit || prod?.base_unit || 'Piece'
                        );
                      }

                      // Unit Rate Formatter
                      let rateDisplay = '';
                      if (item.loose_qty && item.loose_qty > 0 && item.loose_rate && (!item.carton_qty || item.carton_qty === 0)) {
                        rateDisplay = `₹${item.loose_rate.toFixed(2)}/${item.base_unit || prod?.base_unit || 'Pc'}`;
                      } else {
                        rateDisplay = `₹${(item.rate ?? item.carton_rate ?? 0).toFixed(2)}/${unitAbbr}`;
                      }

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                          {/* 1. Sr. No. */}
                          <td className="py-1 px-1.5 text-center text-slate-500 font-mono text-[10px] dense-print-td">{idx + 1}</td>
                          
                          {/* 2. Description of Goods */}
                          <td className="py-1 px-2 dense-print-td">
                            <span className="font-bold text-slate-900 leading-tight block">
                              {prod?.name || item.description || item.variant_name || item.product_name || 'FMCG Product'}
                            </span>
                            <span className="text-[9px] text-slate-500 font-normal inline-block print:text-[7pt]">
                              {item.batch_number ? `Batch: ${item.batch_number}` : ''}
                            </span>
                          </td>

                          {/* 3. HSN */}
                          <td className="py-1 px-1.5 text-center font-mono text-slate-700 text-[10px] dense-print-td">
                            {item.hsn || prod?.hsn || '1902'}
                          </td>

                          {/* 4. MRP */}
                          <td className="py-1 px-1.5 text-right font-mono font-semibold text-slate-800 text-[11px] dense-print-td">
                            {(item.mrp || prod?.mrp || 0).toFixed(2)}
                          </td>

                          {/* 5. Billed Qty */}
                          <td className="py-1 px-2 text-center font-bold text-slate-900 text-[11px] whitespace-nowrap dense-print-td">
                            {qtyDisplay}
                          </td>

                          {/* 6. Rate / Unit */}
                          <td className="py-1 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap dense-print-td">
                            {rateDisplay}
                          </td>

                          {/* 7. Disc */}
                          <td className="py-1 px-1.5 text-right font-mono text-slate-600 text-[10px] dense-print-td">
                            {item.discount && item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '—'}
                          </td>

                          {/* 8. Taxable Value */}
                          <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 text-[11px] dense-print-td">
                            {(item.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 9. GST % */}
                          <td className="py-1 px-1 text-center font-mono text-slate-700 text-[10px] dense-print-td">
                            {gstRate}
                          </td>

                          {/* 10. Line Total */}
                          <td className="py-1 px-2 text-right font-mono font-black text-slate-950 text-[11px] dense-print-td">
                            {(item.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                  </tbody>
                </table>
              </div>

              {/* Compact Invoice Totals & Words Declaration */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t border-slate-300 pt-2 text-xs">
                {/* Left Side: Declarations */}
                <div className="flex-1 space-y-2 max-w-md w-full">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[10px] leading-tight">
                    <strong className="text-slate-800 block uppercase mb-0.5">GST Declaration:</strong>
                    We declare that this invoice shows the actual price of goods described and particulars are true. Taxes are charged under Maharashtra GST (CGST/SGST 9% each for local sales, IGST 18% for interstate).
                  </div>
                </div>
                
                {/* Right Side: Totals Summary Card */}
                <div className="w-full sm:w-72 space-y-1 text-slate-700 font-semibold bg-slate-50 p-2.5 border border-slate-300 rounded text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-bold text-slate-900 font-mono">₹{(generatedInvoice.taxable_value || generatedInvoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {(generatedInvoice.cgst || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST @ 9%:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{(generatedInvoice.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST @ 9%:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{(generatedInvoice.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  {(generatedInvoice.igst || 0) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST @ 18%:</span>
                      <span className="font-bold text-slate-900 font-mono">₹{(generatedInvoice.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {generatedInvoice.round_off !== undefined && generatedInvoice.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{generatedInvoice.round_off > 0 ? `+₹${generatedInvoice.round_off.toFixed(2)}` : `-₹${Math.abs(generatedInvoice.round_off).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-950 font-black text-sm sm:text-base border-t border-slate-300 pt-1 mt-1">
                    <span>GRAND TOTAL:</span>
                    <span className="text-indigo-700 font-mono">₹{(generatedInvoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Compact Footer Signatures */}
              <div className="flex justify-between items-end border-t border-slate-300 pt-3 text-[10px] text-slate-600">
                <div>
                  <p className="text-slate-500">Goods received in good condition</p>
                  <div className="border-t border-dashed border-slate-400 w-32 mt-5"></div>
                  <p className="font-bold text-slate-800 mt-0.5">Receiver&apos;s Signature</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-700 font-semibold uppercase">For {activeCompany?.name || 'SAIFEE GENERAL STORES'}</p>
                  <div className="mt-5"></div>
                  <p className="font-bold text-slate-900 text-[10px]">Authorised Signatory</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {currentStep === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToStep2}
                disabled={selectedOrderIds.length === 0}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <span>Proceed to SKU Deduplication ({selectedOrderIds.length} Orders)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {currentStep === 2 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Order Selection</span>
              </button>
              <button
                type="button"
                onClick={handleGenerate1TaxInvoice}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Receipt className="w-4 h-4" />
                <span>Generate 1 GST Invoice &amp; Print</span>
              </button>
            </>
          )}

          {currentStep === 3 && (
            <>
              <button
                type="button"
                onClick={() => {
                  onSuccess?.();
                  onClose();
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Done &amp; Return to Register
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Invoice</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {/* Last 5 Billed Rates Modal */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryTarget}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
          onApplyRate={(appliedRate) => {
            updateRowRate(rateHistoryTarget.compositeKey, appliedRate);
            setToastMessage(`Applied past rate ₹${appliedRate.toFixed(2)} to consolidated line item!`);
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
}
