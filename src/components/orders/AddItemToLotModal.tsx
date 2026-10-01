'use client';

import React, { useState, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { Product, Inventory } from '@/lib/db';
import { X, Search, Plus, TrendingUp, Package, AlertCircle, Sparkles, Check } from 'lucide-react';

interface AddItemToLotModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  retailerName: string;
  onItemAdded?: () => void;
}

export default function AddItemToLotModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  retailerName,
  onItemAdded
}: AddItemToLotModalProps) {
  const { products, inventory, addOrderItemToOrder, currentUser } = useDb();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedMrp, setSelectedMrp] = useState<number>(0);
  const [cartonQty, setCartonQty] = useState<number>(1);
  const [looseQty, setLooseQty] = useState<number>(0);
  const [unitRate, setUnitRate] = useState<number>(0);
  const [itemNotes, setItemNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products.slice(0, 10);
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.hsn && p.hsn.toLowerCase().includes(term))
    ).slice(0, 15);
  }, [products, searchTerm]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const selectedInventory = useMemo(() => {
    return inventory.find(i => i.product_id === selectedProductId);
  }, [inventory, selectedProductId]);

  // Handle selecting a product
  const handleSelectProduct = (prod: Product) => {
    setSelectedProductId(prod.id);
    setSelectedMrp(prod.mrp || 0);
    setUnitRate(prod.selling_price || 0);
    setCartonQty(1);
    setLooseQty(0);
    setErrorMsg(null);
  };

  // Live calculations
  const unitsPerPack = selectedProduct?.units_per_box_carton || 1;
  const purchaseCost = selectedProduct?.purchase_price || (selectedProduct?.selling_price ? selectedProduct.selling_price * 0.9 : 0);
  const marginPct = unitRate > 0 && purchaseCost > 0
    ? Math.round(((unitRate - purchaseCost) / unitRate) * 10000) / 100
    : null;

  const totalPcs = (cartonQty * unitsPerPack) + (looseQty || 0);
  const availBase = selectedInventory?.available_qty || 0;
  const availCartons = Math.floor(availBase / unitsPerPack);

  const gstPercent = selectedProduct?.gst_percent || 18;
  const lineTaxable = unitRate * (cartonQty + (looseQty / unitsPerPack));
  const lineGst = lineTaxable * (gstPercent / 100);
  const lineTotal = lineTaxable + lineGst;

  const formatINR = (val?: number) => {
    if (val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedProduct) {
      setErrorMsg('Please select a product variant.');
      return;
    }
    if (cartonQty <= 0 && looseQty <= 0) {
      setErrorMsg('Please enter a valid carton or loose quantity.');
      return;
    }
    if (unitRate <= 0) {
      setErrorMsg('Unit billing rate must be greater than ₹0.');
      return;
    }

    setIsSubmitting(true);
    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;

    const res = addOrderItemToOrder(orderId, {
      productId: selectedProductId,
      selectedMrp: selectedMrp || selectedProduct.mrp,
      cartonQty,
      looseQty,
      unitRate,
      notes: itemNotes || 'Added from Floor Terminal'
    }, adminUser);

    setIsSubmitting(false);
    if (res) {
      onItemAdded?.();
      onClose();
    } else {
      setErrorMsg('Failed to add item to order. Order may be closed or invalid.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Add Last-Minute Item to Packing Lot
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {retailerName} &bull; <span className="font-mono text-amber-300">{orderNumber}</span>
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

        {/* Modal Body */}
        <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Search Omnibar */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Search Product Catalogue</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by SKU, Brand, Product name or HSN..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Product Selection List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto bg-slate-50 divide-y divide-slate-200">
            {filteredProducts.map(prod => {
              const isSelected = prod.id === selectedProductId;
              const inv = inventory.find(i => i.product_id === prod.id);
              const avail = inv?.available_qty || 0;
              const uP = prod.units_per_box_carton || 1;
              const availCtns = Math.floor(avail / uP);

              return (
                <button
                  type="button"
                  key={prod.id}
                  onClick={() => handleSelectProduct(prod)}
                  className={`w-full p-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-50/80 border-l-4 border-l-indigo-600' : 'hover:bg-slate-100/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900">{prod.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        MRP ₹{prod.mrp}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                      <span>SKU: <strong className="font-mono text-slate-700">{prod.sku}</strong></span>
                      <span>&bull;</span>
                      <span>Pack: {prod.units_per_box_carton || 1} Pcs/Ctn</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-xs text-slate-900 font-mono block">
                      ₹{prod.selling_price?.toFixed(2)}/ctn
                    </span>
                    <span className={`text-[10px] font-bold ${availCtns > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {availCtns > 0 ? `🟢 ${availCtns} Ctns Stock` : '🔴 Out of Stock'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProduct && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wide">
                  Configuration &amp; Pricing
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Total: <strong className="text-slate-900 font-mono">{totalPcs} Pcs</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Carton Qty */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Carton Qty ({selectedProduct.trading_unit || 'Carton'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cartonQty}
                    onChange={(e) => setCartonQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Unit Billed Rate */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Unit Billed Rate (₹/Ctn)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={unitRate}
                      onChange={(e) => setUnitRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-indigo-700 outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Printed MRP */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Printed MRP (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={selectedMrp}
                    onChange={(e) => setSelectedMrp(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Margin & Financial Strip */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Dist Cost: <strong className="font-mono text-slate-700">₹{purchaseCost.toFixed(2)}</strong></span>
                  {marginPct !== null && (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-black ${
                      marginPct >= 10 ? 'bg-emerald-100 text-emerald-800' : marginPct > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    }`}>
                      <TrendingUp className="w-3 h-3" />
                      <span>{marginPct >= 0 ? `+${marginPct.toFixed(2)}%` : `${marginPct.toFixed(2)}%`} Margin</span>
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Line Total (Incl. {gstPercent}% GST):</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {formatINR(lineTotal)}
                  </span>
                </div>
              </div>

              {/* Reason / Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">Reason / Floor Notes (Optional)</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="e.g. Added via phone call, Counter spot request..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedProductId || (cartonQty <= 0 && looseQty <= 0)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-102 active:scale-98"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Adding Item...' : 'Add to Packing Lot'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
