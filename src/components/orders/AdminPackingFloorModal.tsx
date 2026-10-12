'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Order, Retailer, Product, Inventory, InventoryBatch,
  formatQuantityDisplay, splitBaseQuantity, deriveOrderChannel
} from '@/lib/db';
import { 
  X, Package, AlertTriangle, CheckCircle2, Warehouse, Sparkles,
  ArrowRight, ShieldCheck, Clock, Store, Layers, AlertCircle, RefreshCw,
  Tag, Info
} from 'lucide-react';

export interface ConsolidatedSkuPackingItem {
  productId: string;
  productName: string;
  sku: string;
  mrp: number;
  hsn: string;
  unitsPerPack: number;
  tradingUnit: string;
  baseUnit: string;
  bookedPieces: number;
  backorderPieces: number;
  totalRequiredPieces: number;
  packedPieces: number;
  orderSources: string[];
  hasBackorder: boolean;
  backorderReasons: string[];
  physicalStock: number;
  availableStock: number;
  costPerPiece: number;
}

interface AdminPackingFloorModalProps {
  order?: Order | null;
  retailer?: Retailer | null;
  orders?: Order[];
  backorders?: Order[];
  isOpen: boolean;
  onClose: () => void;
  onPackingComplete?: (packedOrders: Order[], backorder: Order | null) => void;
}

export default function AdminPackingFloorModal({
  order,
  retailer: propRetailer,
  orders: propOrders,
  backorders: propBackorders,
  isOpen,
  onClose,
  onPackingComplete
}: AdminPackingFloorModalProps) {
  // 1. Context Hooks (Always executed at the top)
  const { 
    products = [], inventory = [], batches = [], retailers = [], 
    splitOrderAndCreateBackorder, saveConsolidatedRetailerPacking, currentUser 
  } = useDb();

  // 2. Active Orders & Backorders Resolution
  const activeOrders = useMemo<Order[]>(() => {
    if (propOrders && propOrders.length > 0) return propOrders;
    if (order) return [order];
    return [];
  }, [propOrders, order]);

  const activeBackorders = useMemo<Order[]>(() => {
    if (propBackorders && propBackorders.length > 0) return propBackorders;
    return [];
  }, [propBackorders]);

  const effectiveRetailer = useMemo(() => {
    if (propRetailer) return propRetailer;
    const retId = activeOrders[0]?.retailer_id || activeBackorders[0]?.retailer_id;
    if (!retId) return null;
    return retailers?.find(r => r.id === retId) || null;
  }, [propRetailer, activeOrders, activeBackorders, retailers]);

  // 3. State Hooks: SKU packed quantities & shortage reasons
  const [skuPackingData, setSkuPackingData] = useState<{
    [productId: string]: {
      packedQty: number; // in base units
      reason: string;
    };
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 4. Initial Aggregation Effect
  useEffect(() => {
    if (activeOrders.length === 0 && activeBackorders.length === 0) {
      setSkuPackingData({});
      return;
    }

    const initial: { [productId: string]: { packedQty: number; reason: string } } = {};

    // Collect all unique products
    const productSet = new Set<string>();
    activeBackorders.forEach(bo => {
      bo.items?.forEach(it => { if (it.product_id) productSet.add(it.product_id); });
    });
    activeOrders.forEach(ord => {
      ord.items?.forEach(it => { if (it.product_id) productSet.add(it.product_id); });
    });

    productSet.forEach(prodId => {
      let requiredSum = 0;
      let existingPackedSum = 0;
      let hasExplicitPacked = false;
      let primaryReason = 'Out of Stock';

      // Backorder items
      activeBackorders.forEach(bo => {
        bo.items?.forEach(it => {
          if (it.product_id === prodId) {
            const rem = it.remaining_qty !== undefined && it.remaining_qty > 0 
              ? it.remaining_qty 
              : ((it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0) - (it.fulfilled_qty || 0));
            requiredSum += Math.max(0, rem);
            if ((it as any).reason) primaryReason = (it as any).reason;
          }
        });
      });

      // Active pending orders
      activeOrders.forEach(ord => {
        ord.items?.forEach(it => {
          if (it.product_id === prodId) {
            const ordBase = it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0;
            requiredSum += ordBase;
            if (it.packed_qty !== undefined && it.packed_qty > 0) {
              existingPackedSum += it.packed_qty;
              hasExplicitPacked = true;
            }
          }
        });
      });

      initial[prodId] = {
        packedQty: hasExplicitPacked ? existingPackedSum : requiredSum,
        reason: primaryReason
      };
    });

    setSkuPackingData(initial);
  }, [activeOrders, activeBackorders]);

  // 5. Aggregate SKU Items for Packing Floor Table
  const aggregatedSkuLines = useMemo<ConsolidatedSkuPackingItem[]>(() => {
    const map = new Map<string, {
      bookedPieces: number;
      backorderPieces: number;
      orderSources: Set<string>;
      backorderReasons: Set<string>;
      hasBackorder: boolean;
    }>();

    // 1. Ingest Backorders
    activeBackorders.forEach(bo => {
      bo.items?.forEach(it => {
        if (!it.product_id) return;
        const rem = it.remaining_qty !== undefined && it.remaining_qty > 0 
          ? it.remaining_qty 
          : ((it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0) - (it.fulfilled_qty || 0));
        if (rem <= 0) return;

        const itReason = (it as any).reason;
        if (!map.has(it.product_id)) {
          map.set(it.product_id, {
            bookedPieces: 0,
            backorderPieces: rem,
            orderSources: new Set([bo.order_number]),
            backorderReasons: new Set(itReason ? [itReason] : ['Out of Stock']),
            hasBackorder: true
          });
        } else {
          const entry = map.get(it.product_id)!;
          entry.backorderPieces += rem;
          entry.orderSources.add(bo.order_number);
          entry.hasBackorder = true;
          if (itReason) entry.backorderReasons.add(itReason);
        }
      });
    });

    // 2. Ingest Active Orders
    activeOrders.forEach(ord => {
      ord.items?.forEach(it => {
        if (!it.product_id) return;
        const ordBase = it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0;

        if (!map.has(it.product_id)) {
          map.set(it.product_id, {
            bookedPieces: ordBase,
            backorderPieces: 0,
            orderSources: new Set([ord.order_number]),
            backorderReasons: new Set(),
            hasBackorder: false
          });
        } else {
          const entry = map.get(it.product_id)!;
          entry.bookedPieces += ordBase;
          entry.orderSources.add(ord.order_number);
        }
      });
    });

    // 3. Format into rich lines
    return Array.from(map.entries()).map(([prodId, data]) => {
      const prod = products?.find(p => p.id === prodId);
      const inv = inventory?.find(i => i.product_id === prodId);
      const batchObj = batches?.find(b => b.product_id === prodId);

      const unitsPerPack = prod?.units_per_box_carton || prod?.pieces_per_carton || 1;
      const tradingUnit = prod?.trading_unit || 'Carton';
      const baseUnit = prod?.base_unit || 'Piece';
      const prodName = prod?.name || 'Product Item';
      const sku = prod?.sku || prodId;
      const mrp = prod?.mrp || 0;
      const hsn = prod?.hsn || '1905';
      const physicalStock = inv ? inv.physical_qty : 0;
      const availableStock = inv ? inv.available_qty : 0;
      const costPerPiece = Math.round(((batchObj?.purchase_rate || prod?.purchase_price || 0) / Math.max(1, unitsPerPack)) * 100) / 100;

      const totalRequiredPieces = data.bookedPieces + data.backorderPieces;
      const pData = skuPackingData[prodId] || { packedQty: totalRequiredPieces, reason: 'Out of Stock' };
      const packedPieces = pData.packedQty !== undefined ? pData.packedQty : totalRequiredPieces;

      return {
        productId: prodId,
        productName: prodName,
        sku,
        mrp,
        hsn,
        unitsPerPack,
        tradingUnit,
        baseUnit,
        bookedPieces: data.bookedPieces,
        backorderPieces: data.backorderPieces,
        totalRequiredPieces,
        packedPieces,
        orderSources: Array.from(data.orderSources),
        hasBackorder: data.hasBackorder,
        backorderReasons: Array.from(data.backorderReasons),
        physicalStock,
        availableStock,
        costPerPiece
      };
    });
  }, [activeOrders, activeBackorders, products, inventory, batches, skuPackingData]);

  // 6. Overall Packing Summary Calculations
  const { totalRequiredPieces, totalPackedPieces, totalShortagePieces, shortageCount, totalBackorderPieces } = useMemo(() => {
    let req = 0;
    let pck = 0;
    let sho = 0;
    let sCount = 0;
    let bo = 0;

    aggregatedSkuLines.forEach(l => {
      req += l.totalRequiredPieces;
      pck += l.packedPieces;
      bo += l.backorderPieces;
      const diff = Math.max(0, l.totalRequiredPieces - l.packedPieces);
      sho += diff;
      if (diff > 0) sCount++;
    });

    return {
      totalRequiredPieces: req,
      totalPackedPieces: pck,
      totalShortagePieces: sho,
      shortageCount: sCount,
      totalBackorderPieces: bo
    };
  }, [aggregatedSkuLines]);

  // 7. Callbacks for User Actions
  const handlePackedQtyChange = useCallback((productId: string, val: number, maxQty: number) => {
    const cleanVal = Math.max(0, Math.min(maxQty, isNaN(val) ? 0 : val));
    setSkuPackingData(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        packedQty: cleanVal
      }
    }));
  }, []);

  const handleReasonChange = useCallback((productId: string, reason: string) => {
    setSkuPackingData(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        reason
      }
    }));
  }, []);

  const handleAutoFill100 = useCallback(() => {
    const updated: { [prodId: string]: { packedQty: number; reason: string } } = {};
    aggregatedSkuLines.forEach(l => {
      updated[l.productId] = {
        packedQty: l.totalRequiredPieces,
        reason: skuPackingData[l.productId]?.reason || 'Out of Stock'
      };
    });
    setSkuPackingData(updated);
  }, [aggregatedSkuLines, skuPackingData]);

  const handleAutoFillAvailable = useCallback(() => {
    const updated: { [prodId: string]: { packedQty: number; reason: string } } = {};
    aggregatedSkuLines.forEach(l => {
      const avail = Math.max(0, l.physicalStock);
      updated[l.productId] = {
        packedQty: Math.min(l.totalRequiredPieces, avail),
        reason: skuPackingData[l.productId]?.reason || 'Out of Stock'
      };
    });
    setSkuPackingData(updated);
  }, [aggregatedSkuLines, skuPackingData]);

  const handleSaveAndMoveToPacked = useCallback(() => {
    if (!effectiveRetailer) {
      alert('Error: Retailer account information is missing.');
      return;
    }

    if (totalPackedPieces <= 0) {
      alert('Cannot pack 0 units across all items. Please pack at least 1 unit or cancel.');
      return;
    }

    if (totalShortagePieces > 0) {
      const confirmMsg = `Consolidated Backorder Split Warning:\n\n• ${totalPackedPieces} Pcs will be marked as PACKED across ${activeOrders.length} order(s).\n• ${totalShortagePieces} Pcs shortage across ${shortageCount} SKUs will roll over into a new or updated Backorder record in Partial Pending Orders.\n\nProceed with floor packing?`;
      if (!confirm(confirmMsg)) return;
    }

    setIsSubmitting(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    const allocations = aggregatedSkuLines.map(l => ({
      productId: l.productId,
      totalPackedQty: l.packedPieces,
      reason: skuPackingData[l.productId]?.reason || 'Short-packed during consolidated packing'
    }));

    const res = saveConsolidatedRetailerPacking(
      effectiveRetailer.id,
      activeOrders.map(o => o.id),
      activeBackorders.map(o => o.id),
      allocations,
      adminUser
    );

    setIsSubmitting(false);

    if (res) {
      if (onPackingComplete) {
        onPackingComplete(res.packedOrders, res.rolledBackorder);
      }
      onClose();
    }
  }, [effectiveRetailer, totalPackedPieces, totalShortagePieces, shortageCount, activeOrders, activeBackorders, aggregatedSkuLines, currentUser, skuPackingData, saveConsolidatedRetailerPacking, onPackingComplete, onClose]);

  // 8. Conditional Unmount Check (At the very bottom before returning JSX)
  if (!isOpen || (activeOrders.length === 0 && activeBackorders.length === 0)) {
    return null;
  }

  const orderNumbersList = activeOrders.map(o => o.order_number);
  const backorderNumbersList = activeBackorders.map(o => o.order_number);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Package className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base text-amber-300">
                  Consolidated Packing: {effectiveRetailer?.shop_name || 'Retailer Store'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {activeOrders.length} Orders + {activeBackorders.length} Backorders
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium flex items-center gap-2 flex-wrap">
                <span>Orders: <strong className="text-amber-200 font-mono">{orderNumbersList.join(' + ') || 'None'}</strong></span>
                {backorderNumbersList.length > 0 && (
                  <span className="text-purple-300">&bull; Active Backorders: <strong className="font-mono text-purple-200">{backorderNumbersList.join(' + ')}</strong></span>
                )}
                <span>&bull; {effectiveRetailer?.city} &bull; Owner: {effectiveRetailer?.owner_name || 'N/A'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Packing Floor Stats & Quick Auto-Fill Actions */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">Total Demand:</span>
              <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {totalRequiredPieces} Pcs ({aggregatedSkuLines.length} SKUs)
              </span>
            </div>

            {totalBackorderPieces > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-purple-700 font-semibold">Prior Backorder:</span>
                <span className="font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-300">
                  ⏳ {totalBackorderPieces} Pcs
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-semibold">Ready to Pack:</span>
              <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {totalPackedPieces} Pcs
              </span>
            </div>

            {totalShortagePieces > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-amber-700 font-semibold">Shortage Split:</span>
                <span className="font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 animate-pulse">
                  ⚡ {totalShortagePieces} Pcs ({shortageCount} SKUs)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Full Supply</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFill100}
              type="button"
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Auto-Fill 100% Full</span>
            </button>
            <button
              onClick={handleAutoFillAvailable}
              type="button"
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cap by Live Stock</span>
            </button>
          </div>
        </div>

        {/* Unified SKU Packing Floor Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">Product Description & SKU</th>
                  <th className="p-3 text-center">Live Stock</th>
                  <th className="p-3 text-center">Total Demand</th>
                  <th className="p-3 text-center w-48">Packed Qty Input</th>
                  <th className="p-3 text-left">Fulfillment & Backorder Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {aggregatedSkuLines.map((line, idx) => {
                  const shortageQty = Math.max(0, line.totalRequiredPieces - line.packedPieces);
                  const isPartial = shortageQty > 0;
                  const { cartonQty: pCartons, looseQty: pLoose } = splitBaseQuantity(line.packedPieces, line.unitsPerPack);
                  const { cartonQty: reqCartons, looseQty: reqLoose } = splitBaseQuantity(line.totalRequiredPieces, line.unitsPerPack);
                  const pData = skuPackingData[line.productId] || { packedQty: line.totalRequiredPieces, reason: 'Out of Stock' };

                  return (
                    <tr 
                      key={line.productId || idx} 
                      className={`transition-colors ${isPartial ? 'bg-amber-50/40 hover:bg-amber-50/70' : line.hasBackorder ? 'bg-purple-50/20 hover:bg-purple-50/50' : 'hover:bg-slate-50/80'}`}
                    >
                      {/* # */}
                      <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                      {/* Product SKU */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm block">
                            {line.productName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                            MRP ₹{line.mrp}
                          </span>
                          {line.hasBackorder && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-purple-600" />
                              <span>Back Order</span>
                            </span>
                          )}
                        </div>

                        {/* Order Breakdown Notes */}
                        <div className="text-[11px] text-slate-500 mt-1 space-y-0.5 font-medium">
                          <p>
                            SKU: <span className="font-mono text-slate-700">{line.sku}</span> &bull; {line.unitsPerPack} {line.baseUnit}/Ctn &bull; Cost: ₹{line.costPerPiece}/Pc
                          </p>
                          {line.hasBackorder && (
                            <p className="text-purple-800 font-bold flex items-center gap-1">
                              <span>Includes <strong>{line.backorderPieces} Pcs</strong> from previous Backorder</span>
                              {line.backorderReasons.length > 0 && (
                                <span className="text-slate-500 font-normal">({line.backorderReasons.join(', ')})</span>
                              )}
                            </p>
                          )}
                          {line.orderSources.length > 1 && (
                            <p className="text-indigo-700 font-semibold text-[10px]">
                              Combined across: {line.orderSources.join(' + ')}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Live Stock */}
                      <td className="p-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-black border ${
                            line.physicalStock >= line.totalRequiredPieces
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : line.physicalStock > 0
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}>
                            {line.physicalStock} Pcs
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Avail: {line.availableStock} Pcs
                          </span>
                        </div>
                      </td>

                      {/* Total Booked / Required Qty */}
                      <td className="p-3 text-center">
                        <span className="font-black text-slate-900 text-sm block">
                          {line.totalRequiredPieces} Pcs
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({reqCartons} {line.tradingUnit.slice(0, 3)} {reqLoose > 0 ? `+ ${reqLoose} Pcs` : ''})
                        </span>
                        {line.backorderPieces > 0 && (
                          <div className="text-[9px] text-purple-700 font-bold mt-0.5">
                            ({line.bookedPieces} New + {line.backorderPieces} BO)
                          </div>
                        )}
                      </td>

                      {/* Packed Qty Input */}
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-28">
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={line.totalRequiredPieces}
                                value={line.packedPieces === 0 ? '0' : line.packedPieces || ''}
                                onChange={(e) => handlePackedQtyChange(line.productId, parseInt(e.target.value, 10), line.totalRequiredPieces)}
                                className={`w-full px-2.5 py-1.5 text-center font-black text-sm rounded-lg border focus:ring-2 focus:outline-hidden transition-all ${
                                  isPartial 
                                    ? 'border-amber-400 bg-amber-50 text-amber-950 focus:ring-amber-400' 
                                    : 'border-slate-300 bg-white text-slate-900 focus:ring-indigo-500'
                                }`}
                              />
                              <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                Pcs
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 text-center mt-1">
                              = {pCartons} Ctn {pLoose > 0 ? `+ ${pLoose} Pcs` : ''}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePackedQtyChange(line.productId, line.totalRequiredPieces, line.totalRequiredPieces)}
                            title="Set 100% full quantity"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Full
                          </button>
                        </div>
                      </td>

                      {/* Shortage & Backorder Action */}
                      <td className="p-3">
                        {isPartial ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-amber-800 font-black">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Shortage: {shortageQty} Pcs ({((shortageQty / line.totalRequiredPieces) * 100).toFixed(0)}%)</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-500">Reason:</span>
                              <select
                                value={pData.reason}
                                onChange={(e) => handleReasonChange(line.productId, e.target.value)}
                                className="px-2 py-0.5 bg-white border border-amber-300 text-amber-900 rounded text-[11px] font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                              >
                                <option value="Out of Stock">Out of Stock</option>
                                <option value="Short Packed">Short Packed</option>
                                <option value="Damaged Box">Damaged Box</option>
                                <option value="Batch Expired">Batch Expired</option>
                                <option value="Custom Retailer Request">Custom Retailer Request</option>
                              </select>
                            </div>
                            <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                              ⚡ Will roll into Backorder queue
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>100% Packed & Verified</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Automatic Backorder Rule Explanation Alert */}
          {totalShortagePieces > 0 && (
            <div className="p-3.5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-950">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-black text-amber-900 text-sm block">
                  Consolidated Backorder Rollover Active
                </strong>
                <p className="mt-0.5 text-amber-800">
                  Saving will mark <strong className="text-slate-900">{totalPackedPieces} Pcs</strong> as verified and packed across {activeOrders.length} pending orders. The remaining shortage of <strong className="text-amber-950 font-black">{totalShortagePieces} Pcs</strong> across {shortageCount} SKUs will roll over into a consolidated Backorder record under <strong className="text-slate-900">{effectiveRetailer?.shop_name}</strong> in the <strong className="text-amber-900">Partial Pending Orders</strong> tab.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Cancel Floor Packing
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting || totalPackedPieces <= 0}
              onClick={handleSaveAndMoveToPacked}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-102 active:scale-98 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
              <span>
                {isSubmitting 
                  ? 'Saving Consolidated Packing...' 
                  : totalShortagePieces > 0 
                  ? `Save & Roll Shortages (${totalPackedPieces} Pcs Packed)` 
                  : `Save Consolidated Packing (${totalPackedPieces} Pcs)`
                }
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
