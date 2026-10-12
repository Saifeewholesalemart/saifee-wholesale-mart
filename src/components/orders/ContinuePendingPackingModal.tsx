'use client';

import React, { useState } from 'react';
import { 
  RetailerPendingOrderCard, 
  RetailerPendingProductItem 
} from '@/lib/orderTerminalTypes';
import { useDb } from '@/context/DbContext';
import { 
  Boxes, CheckCircle2, AlertTriangle, Check, 
  X, Save, Printer, Lock, Store, ArrowRight
} from 'lucide-react';

interface ContinuePendingPackingModalProps {
  card: RetailerPendingOrderCard;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export default function ContinuePendingPackingModal({
  card,
  onClose,
  onSuccess
}: ContinuePendingPackingModalProps) {
  const { inventory, continuePackingPendingItems, currentUser } = useDb();

  // Map inventory for live available stock per product
  const inventoryStockMap = React.useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach(inv => {
      const prev = map.get(inv.product_id) || 0;
      const avail = inv.available_qty ?? Math.max(0, (inv.physical_qty || 0) - (inv.reserved_qty || 0));
      map.set(inv.product_id, prev + avail);
    });
    return map;
  }, [inventory]);

  // State: packed boxes & loose per product key
  const [packedBoxesMap, setPackedBoxesMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    card.pendingProducts.forEach(prod => {
      const avail = inventoryStockMap.get(prod.productId) || 0;
      const units = prod.unitsPerPack > 1 ? prod.unitsPerPack : 1;
      const availBoxes = Math.floor(avail / units);
      // Default to minimum of pending cartons and available boxes
      initial[prod.productId] = Math.min(prod.totalPendingCartons, availBoxes);
    });
    return initial;
  });

  const [packedLooseMap, setPackedLooseMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    card.pendingProducts.forEach(prod => {
      const units = prod.unitsPerPack > 1 ? prod.unitsPerPack : 1;
      if (units === 1) {
        const avail = inventoryStockMap.get(prod.productId) || 0;
        initial[prod.productId] = Math.min(prod.totalPendingPieces, avail);
      } else {
        initial[prod.productId] = 0;
      }
    });
    return initial;
  });

  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});

  const handleBoxChange = (productId: string, valStr: string, maxPendingBoxes: number) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    // Hard Validation: cannot exceed pending boxes
    const clampedVal = Math.min(val, maxPendingBoxes);
    setPackedBoxesMap(prev => ({ ...prev, [productId]: clampedVal }));
    setVerifiedMap(prev => ({ ...prev, [productId]: true }));
  };

  const handleLooseChange = (productId: string, valStr: string, maxPendingLoose: number) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    // Hard Validation: cannot exceed pending loose
    const clampedVal = Math.min(val, maxPendingLoose);
    setPackedLooseMap(prev => ({ ...prev, [productId]: clampedVal }));
    setVerifiedMap(prev => ({ ...prev, [productId]: true }));
  };

  const handleStepBoxes = (prod: RetailerPendingProductItem, delta: number) => {
    const current = packedBoxesMap[prod.productId] || 0;
    const next = Math.max(0, Math.min(prod.totalPendingCartons, current + delta));
    handleBoxChange(prod.productId, String(next), prod.totalPendingCartons);
  };

  const handleStepLoose = (prod: RetailerPendingProductItem, delta: number) => {
    const units = prod.unitsPerPack > 1 ? prod.unitsPerPack : 1;
    const maxVal = units > 1 ? prod.totalPendingLoose : prod.totalPendingPieces;
    const current = packedLooseMap[prod.productId] || 0;
    const next = Math.max(0, Math.min(maxVal, current + delta));
    handleLooseChange(prod.productId, String(next), maxVal);
  };

  const handleSetFull = (prod: RetailerPendingProductItem) => {
    setPackedBoxesMap(prev => ({ ...prev, [prod.productId]: prod.totalPendingCartons }));
    setPackedLooseMap(prev => ({ ...prev, [prod.productId]: prod.totalPendingLoose }));
    setVerifiedMap(prev => ({ ...prev, [prod.productId]: true }));
  };

  const handleSetZero = (prod: RetailerPendingProductItem) => {
    setPackedBoxesMap(prev => ({ ...prev, [prod.productId]: 0 }));
    setPackedLooseMap(prev => ({ ...prev, [prod.productId]: 0 }));
    setVerifiedMap(prev => ({ ...prev, [prod.productId]: true }));
  };

  const handleConfirmPackPending = () => {
    const itemsPayload: {
      originOrderId: string;
      originItemId: string;
      productId: string;
      newlyPackedPieces: number;
      newlyPackedCartons?: number;
      newlyPackedLoose?: number;
      unitRate?: number;
    }[] = [];

    let totalPackedNow = 0;

    card.pendingProducts.forEach(prod => {
      const units = prod.unitsPerPack > 1 ? prod.unitsPerPack : 1;
      const userBox = packedBoxesMap[prod.productId] || 0;
      const userLoose = packedLooseMap[prod.productId] || 0;
      const totalPcsToPack = units > 1 ? (userBox * units) + userLoose : (userBox + userLoose);

      if (totalPcsToPack <= 0) return;

      // Distribute totalPcsToPack across the contributing orders proportionally / FIFO
      let remToDistribute = totalPcsToPack;
      for (const ob of prod.ordersBreakdown) {
        if (remToDistribute <= 0) break;
        const take = Math.min(ob.pendingPieces, remToDistribute);
        if (take > 0) {
          const itemBoxes = units > 1 ? Math.floor(take / units) : 0;
          const itemLoose = units > 1 ? take % units : take;

          itemsPayload.push({
            originOrderId: ob.orderId,
            originItemId: ob.itemId,
            productId: prod.productId,
            newlyPackedPieces: take,
            newlyPackedCartons: itemBoxes,
            newlyPackedLoose: itemLoose,
            unitRate: ob.lockedUnitRate
          });

          remToDistribute -= take;
          totalPackedNow += take;
        }
      }
    });

    if (itemsPayload.length === 0) {
      alert('Please enter at least 1 unit to pack.');
      return;
    }

    const res = continuePackingPendingItems({
      retailerId: card.retailerId,
      items: itemsPayload
    }, currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);

    if (res) {
      if (onSuccess) {
        onSuccess(`✅ Successfully packed ${totalPackedNow} pending units for ${card.shopName}! Moved automatically to Packed Items for Billing.`);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      <div className="max-w-md md:max-w-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl bg-slate-50 flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Sticky Mobile Header */}
        <div className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-sm font-bold text-white truncate">
              Fulfill Pending: {card.shopName}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              Orders: <span className="font-mono text-amber-300">{card.sourceOrderNumbers.join(', ')}</span> &bull; {card.totalPendingPieces} Pcs
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Line Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-28 sm:pb-4">
          {card.pendingProducts.map((prod, idx) => {
            const units = prod.unitsPerPack > 1 ? prod.unitsPerPack : 1;
            const availPcs = inventoryStockMap.get(prod.productId) || 0;
            const availBoxes = Math.floor(availPcs / units);
            const isLowStock = availPcs < prod.totalPendingPieces;

            const currentBox = packedBoxesMap[prod.productId] || 0;
            const currentLoose = packedLooseMap[prod.productId] || 0;

            const isItemVerified = !!verifiedMap[prod.productId];

            return (
              <div 
                key={prod.productId || idx}
                className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                  isItemVerified ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                {/* Left: Product Info + Live Stock */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">
                      {prod.productName}
                    </p>
                    <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-mono font-bold text-[10px] shrink-0">
                      Pending: {prod.totalPendingCartons > 0 ? `${prod.totalPendingCartons} Bx ` : ''}{prod.totalPendingLoose > 0 ? `${prod.totalPendingLoose} Pcs` : (prod.totalPendingCartons === 0 ? `${prod.totalPendingPieces} Pcs` : '')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium flex-wrap">
                    <span>Brand: <strong className="text-slate-700">{prod.brand || 'Saifee'}</strong></span>
                    <span>&bull;</span>
                    <span className="font-mono text-slate-400">SKU: {prod.sku}</span>
                  </div>

                  <div>
                    {isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 text-[10px] font-bold">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Avail Stock: {availPcs} Pcs ({availBoxes} Bx)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Avail Stock: {availPcs} Pcs</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Stepper Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {units > 1 && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                        <span>Boxes ({units} pcs/bx)</span>
                        <span className="text-slate-700">Max: {prod.totalPendingCartons}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStepBoxes(prod, -1)}
                          className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={prod.totalPendingCartons}
                          value={currentBox}
                          onChange={(e) => handleBoxChange(prod.productId, e.target.value, prod.totalPendingCartons)}
                          className="h-9 w-full min-w-0 text-center font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleStepBoxes(prod, 1)}
                          className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                      <span>{units > 1 ? 'Loose Pieces' : 'Pack Qty (Pieces)'}</span>
                      <span className="text-slate-700">Max: {units > 1 ? prod.totalPendingLoose : prod.totalPendingPieces}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStepLoose(prod, -1)}
                        className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={units > 1 ? prod.totalPendingLoose : prod.totalPendingPieces}
                        value={currentLoose}
                        onChange={(e) => handleLooseChange(prod.productId, e.target.value, units > 1 ? prod.totalPendingLoose : prod.totalPendingPieces)}
                        className="h-9 w-full min-w-0 text-center font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleStepLoose(prod, 1)}
                        className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetFull(prod)}
                    className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Full Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetZero(prod)}
                    className="h-7 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    0
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky Mobile Bottom Action Bar */}
        <div className="sticky bottom-0 z-20 p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmPackPending}
            className="h-12 flex-[1.5] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark Packed &amp; Move</span>
          </button>
        </div>
      </div>
    </div>
  );
}
