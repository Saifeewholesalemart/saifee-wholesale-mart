'use client';

import React, { useState } from 'react';
import { 
  RetailerPendingOrderCard, 
  RetailerPendingProductItem 
} from '@/lib/orderTerminalTypes';
import { 
  Clock, Store, MapPin, Phone, User, Package, 
  ChevronRight, ChevronDown, ChevronUp, AlertTriangle, 
  CheckCircle2, Boxes, ArrowRight, ShieldAlert, 
  FileText, Calendar, Eye, Sparkles, X, Info
} from 'lucide-react';

interface RetailerPendingCardProps {
  card: RetailerPendingOrderCard;
  mode?: 'packer' | 'biller' | 'admin';
  onContinuePacking?: (card: RetailerPendingOrderCard) => void;
  onViewOrderDetails?: (orderId: string) => void;
}

export default function RetailerPendingCard({
  card,
  mode = 'packer',
  onContinuePacking,
  onViewOrderDetails
}: RetailerPendingCardProps) {
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const isBiller = mode === 'biller';
  const isPacker = mode === 'packer';

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm transition-all overflow-hidden flex flex-col justify-between">
        {/* Card Header: Retailer Information & Meta Badges */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                <Store className="w-4 h-4" />
              </span>
              <h3 className="text-base font-black tracking-tight text-white uppercase">
                {card.shopName}
              </h3>
              {isBiller && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Awaiting Packing &bull; Not Billable
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap font-medium">
              {card.ownerName && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Owner: <strong className="text-slate-100">{card.ownerName}</strong></span>
                </span>
              )}
              {card.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>City: <strong className="text-slate-100">{card.city}</strong></span>
                </span>
              )}
              {card.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{card.phone}</span>
                </span>
              )}
              {card.route && (
                <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-amber-300 font-mono">
                  {card.route}
                </span>
              )}
            </div>
          </div>

          {/* Counts Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 text-xs font-black">
              {card.pendingOrdersCount} Pending Order{card.pendingOrdersCount !== 1 ? 's' : ''}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-blue-300 text-xs font-black">
              {card.pendingItemsCount} Pending SKU{card.pendingItemsCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Card Body: Product-wise Aggregated Shortages with Contributing Order Numbers */}
        <div className="p-4 sm:p-5 space-y-3 divide-y divide-slate-100 flex-1">
          {card.pendingProducts.map((prod, pIdx) => {
            const hasMultipleOrders = prod.ordersBreakdown.length > 1;

            return (
              <div key={prod.productId || pIdx} className={`pt-3 first:pt-0 space-y-2`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {prod.productName}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                      {prod.brand && <span>Brand: <strong className="text-slate-700">{prod.brand}</strong></span>}
                      {prod.sku && prod.sku !== '-' && (
                        <>
                          <span>&bull;</span>
                          <span className="font-mono text-[11px] text-slate-400">SKU: {prod.sku}</span>
                        </>
                      )}
                      {prod.mrp > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="font-bold text-slate-700">MRP: ₹{Number(prod.mrp).toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Aggregated Pending Quantity for this product */}
                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Total Pending
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 font-mono font-black text-xs inline-block">
                      {prod.totalPendingCartons > 0 ? `${prod.totalPendingCartons} Carton${prod.totalPendingCartons !== 1 ? 's' : ''}` : ''}
                      {prod.totalPendingLoose > 0 ? ` + ${prod.totalPendingLoose} Loose` : ''}
                      {prod.totalPendingCartons === 0 && prod.totalPendingLoose === 0 ? `${prod.totalPendingPieces} Pcs` : ` (${prod.totalPendingPieces} Pcs)`}
                    </span>
                  </div>
                </div>

                {/* Contributing Original Orders Breakdown */}
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <span>Source Order Breakdown:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {prod.ordersBreakdown.map((ob, obIdx) => (
                      <div 
                        key={obIdx}
                        className="flex items-center justify-between text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700"
                      >
                        <span className="font-mono font-bold text-indigo-700 flex items-center gap-1">
                          <span>{ob.orderNumber}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </span>
                        <span className="font-mono font-extrabold text-rose-700">
                          {ob.pendingCartons > 0 ? `${ob.pendingCartons} Carton${ob.pendingCartons !== 1 ? 's' : ''}` : ''}
                          {ob.pendingLoose > 0 ? ` + ${ob.pendingLoose} Loose` : ''}
                          {ob.pendingCartons === 0 && ob.pendingLoose === 0 ? `${ob.pendingPieces} Pcs` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Card Footer: Summary Total & Operational Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pending:</span>
            <span className="px-3 py-1 bg-rose-600 text-white font-mono font-black text-xs rounded-lg shadow-xs">
              {card.totalPendingCartons > 0 ? `${card.totalPendingCartons} Cartons` : ''}
              {card.totalPendingCartons > 0 && card.totalPendingPieces > 0 ? ` (${card.totalPendingPieces} Pcs)` : `${card.totalPendingPieces} Pieces`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDetailsModalOpen(true)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>View Pending Details</span>
            </button>

            {!isBiller && onContinuePacking && (
              <button
                type="button"
                onClick={() => onContinuePacking(card)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Boxes className="w-4 h-4" />
                <span>Continue Packing 📦</span>
              </button>
            )}

            {isBiller && (
              <span className="px-3 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1 cursor-not-allowed">
                <Info className="w-3.5 h-3.5" />
                <span>Non-Billable (Pending Pack)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FULL PENDING AUDIT DETAILS MODAL */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white max-w-md md:max-w-3xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="sticky top-0 z-20 p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold truncate">Pending Audit: {card.shopName}</h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {card.pendingOrdersCount} Orders &bull; <strong className="text-amber-300 font-mono">{card.totalPendingPieces} Pcs</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Subheader summary */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="font-bold text-slate-600">Orders:</span>
                <span className="font-mono text-indigo-700 font-bold truncate max-w-[200px]">{card.sourceOrderNumbers.join(', ')}</span>
              </div>
              <div className="text-slate-600 text-[11px]">
                Shortage: <strong className="text-rose-700 font-bold">{card.totalPendingPieces} Pcs</strong>
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 pb-28 sm:pb-4">
              {card.pendingProducts.map((prod, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">{prod.productName}</h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Brand: <strong className="text-slate-700">{prod.brand || 'Saifee'}</strong> &bull; SKU: <span className="font-mono">{prod.sku}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-mono font-bold text-[10px] inline-block">
                        {prod.totalPendingPieces} Pcs {prod.totalPendingCartons > 0 ? `(${prod.totalPendingCartons} Bx)` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[9px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Order #</th>
                          <th className="p-2">Ord</th>
                          <th className="p-2">Packed</th>
                          <th className="p-2 text-rose-700">Pending</th>
                          <th className="p-2">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {prod.ordersBreakdown.map((ob, obIdx) => (
                          <tr key={obIdx} className="hover:bg-slate-50/70">
                            <td className="p-2 font-mono font-bold text-indigo-700">{ob.orderNumber}</td>
                            <td className="p-2 font-mono text-slate-700">{ob.orderedPieces}</td>
                            <td className="p-2 font-mono text-emerald-700 font-bold">{ob.previouslyPackedPieces}</td>
                            <td className="p-2 font-mono text-rose-700 font-bold">{ob.pendingPieces}</td>
                            <td className="p-2 font-mono text-slate-800">₹{Number(ob.lockedUnitRate).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Sticky Mobile Footer */}
            <div className="sticky bottom-0 z-20 p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="h-12 flex-1 bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center"
              >
                Close View
              </button>

              {!isBiller && onContinuePacking && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    onContinuePacking(card);
                  }}
                  className="h-12 flex-[1.5] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Boxes className="w-4 h-4" />
                  <span>Pack Pending Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
