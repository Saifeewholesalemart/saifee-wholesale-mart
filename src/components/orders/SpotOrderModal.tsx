'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Retailer, Product, Order, Invoice, DeliveryChallan,
  formatAutoBoxQuantity, formatProductStockDisplay
} from '@/lib/db';
import { 
  X, Plus, Trash2, Store, Search, CheckCircle2, Zap, 
  Package, DollarSign, Receipt, AlertCircle, ShoppingCart, 
  UserCheck, Barcode, ChevronDown, Check, ArrowDown, ArrowUp,
  Sparkles, Building2, MapPin, Phone, RefreshCw, CreditCard,
  ShieldCheck, Tag, Box, Hash, TrendingUp
} from 'lucide-react';

interface SpotOrderItemRow {
  id: string;
  productId: string;
  cartonQty: number;
  looseQty: number;
  packedPieces?: number;
  unitRate: number;
  discount: number;
  notes?: string;
}

interface SpotOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: Order, invoice?: Invoice, challan?: DeliveryChallan) => void;
}

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SpotOrderModal({
  isOpen,
  onClose,
  onOrderCreated
}: SpotOrderModalProps) {
  const { 
    retailers, 
    products, 
    inventory, 
    placeOrder, 
    dispatchRetailerPackingLot, 
    currentUser 
  } = useDb();

  // Retailer state
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  const [retailerSearchText, setRetailerSearchText] = useState<string>('');
  const [isRetailerDropdownOpen, setIsRetailerDropdownOpen] = useState<boolean>(false);
  const [highlightedRetailerIndex, setHighlightedRetailerIndex] = useState<number>(0);
  const retailerComboboxRef = useRef<HTMLDivElement>(null);
  const retailerInputRef = useRef<HTMLInputElement>(null);

  // Walk-in mode
  const [isWalkIn, setIsWalkIn] = useState<boolean>(false);
  const [walkInName, setWalkInName] = useState<string>('Counter Spot Customer');
  const [walkInPhone, setWalkInPhone] = useState<string>('');

  // Payment & Dispatch
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit' | 'Bank Transfer'>('Cash');
  const [orderNotes, setOrderNotes] = useState<string>('Counter Spot Sale');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Top Barcode / Quick Add Scanner Omnibar state
  const [topBarcodeQuery, setTopBarcodeQuery] = useState<string>('');
  const [isTopBarcodeDropdownOpen, setIsTopBarcodeDropdownOpen] = useState<boolean>(false);
  const [topBarcodeHighlightIndex, setTopBarcodeHighlightIndex] = useState<number>(0);
  const topBarcodeRef = useRef<HTMLDivElement>(null);

  // Line items state
  const [items, setItems] = useState<SpotOrderItemRow[]>([
    {
      id: `item-${Date.now()}-1`,
      productId: products[0]?.id || '',
      cartonQty: 10,
      looseQty: 0,
      packedPieces: 10,
      unitRate: products[0]?.selling_price || products[0]?.mrp || 0,
      discount: products[0]?.carton_discount || 0
    }
  ]);

  // Product Autocomplete state per row
  const [openProductDropdownRowId, setOpenProductDropdownRowId] = useState<string | null>(null);
  const [productSearchQueries, setProductSearchQueries] = useState<{ [rowId: string]: string }>({});
  const [highlightedProdIndex, setHighlightedProdIndex] = useState<number>(0);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (retailerComboboxRef.current && !retailerComboboxRef.current.contains(e.target as Node)) {
        setIsRetailerDropdownOpen(false);
      }
      if (topBarcodeRef.current && !topBarcodeRef.current.contains(e.target as Node)) {
        setIsTopBarcodeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtered retailers for autocomplete search
  const filteredRetailers = useMemo(() => {
    const query = retailerSearchText.trim().toLowerCase();
    if (!query) return retailers.slice(0, 50);

    return retailers.filter(r => {
      const matchShop = r.shop_name?.toLowerCase().includes(query);
      const matchOwner = r.owner_name?.toLowerCase().includes(query);
      const matchCity = r.city?.toLowerCase().includes(query);
      const matchBeat = (r.beat_name || r.route)?.toLowerCase().includes(query);
      const matchPhone = (r.mobile || r.phone || '').includes(query);
      const matchGstin = (r.gstin || '').toLowerCase().includes(query);

      return matchShop || matchOwner || matchCity || matchBeat || matchPhone || matchGstin;
    }).slice(0, 50);
  }, [retailers, retailerSearchText]);

  // Currently selected retailer object
  const selectedRetailer = useMemo(() => {
    if (!selectedRetailerId) return null;
    return retailers.find(r => r.id === selectedRetailerId) || null;
  }, [retailers, selectedRetailerId]);

  // Handle Retailer Selection
  const handleSelectRetailer = (ret: Retailer) => {
    setSelectedRetailerId(ret.id);
    setRetailerSearchText(ret.shop_name);
    setIsRetailerDropdownOpen(false);
  };

  // Clear Retailer Selection
  const handleClearRetailer = () => {
    setSelectedRetailerId('');
    setRetailerSearchText('');
    setIsRetailerDropdownOpen(true);
    retailerInputRef.current?.focus();
  };

  // Keyboard navigation for retailer search
  const handleRetailerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRetailerDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsRetailerDropdownOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedRetailerIndex(prev => Math.min(filteredRetailers.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedRetailerIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredRetailers[highlightedRetailerIndex]) {
        handleSelectRetailer(filteredRetailers[highlightedRetailerIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsRetailerDropdownOpen(false);
    }
  };

  // Helper: Filter products for a specific row search
  const getFilteredProductsForRow = (rowId: string) => {
    const rawQuery = (productSearchQueries[rowId] ?? '').trim().toLowerCase();
    if (!rawQuery) return products.slice(0, 40);

    return products.filter(p => {
      const matchName = p.name.toLowerCase().includes(rawQuery);
      const matchBrand = (p.brand || '').toLowerCase().includes(rawQuery);
      const matchSku = p.sku.toLowerCase().includes(rawQuery);
      const matchBarcode = (p.barcode || '').toLowerCase().includes(rawQuery);
      const matchMrp = String(p.mrp).includes(rawQuery);
      const matchCategory = (p.category || '').toLowerCase().includes(rawQuery);

      return matchName || matchBrand || matchSku || matchBarcode || matchMrp || matchCategory;
    }).slice(0, 40);
  };

  // Top Barcode Search Filter
  const topBarcodeFilteredProducts = useMemo(() => {
    const query = topBarcodeQuery.trim().toLowerCase();
    if (!query) return [];

    return products.filter(p => {
      const matchBarcode = (p.barcode || '').toLowerCase().includes(query);
      const matchSku = p.sku.toLowerCase().includes(query);
      const matchName = p.name.toLowerCase().includes(query);
      const matchBrand = (p.brand || '').toLowerCase().includes(query);
      return matchBarcode || matchSku || matchName || matchBrand;
    }).slice(0, 20);
  }, [products, topBarcodeQuery]);

  // Helper: add item row
  const handleAddItemRow = (productIdToSelect?: string) => {
    const prod = productIdToSelect 
      ? products.find(p => p.id === productIdToSelect) 
      : products[0];

    const newRowId = `item-${Date.now()}-${items.length + 1}`;
    const defaultQty = 10;

    setItems(prev => [
      ...prev,
      {
        id: newRowId,
        productId: prod?.id || '',
        packedPieces: defaultQty,
        cartonQty: defaultQty,
        looseQty: 0,
        unitRate: prod?.selling_price || prod?.mrp || 0,
        discount: prod?.carton_discount || 0
      }
    ]);

    if (prod) {
      setProductSearchQueries(prev => ({
        ...prev,
        [newRowId]: prod.name
      }));
    }

    setTimeout(() => {
      document.getElementById(`qty-input-${newRowId}`)?.focus();
    }, 50);
  };

  // Helper: remove item row
  const handleRemoveItemRow = (rowId: string) => {
    if (items.length <= 1) {
      alert('Spot order must contain at least 1 line item.');
      return;
    }
    setItems(prev => prev.filter(r => r.id !== rowId));
    setProductSearchQueries(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  // Helper: select product in a specific row and focus quantity input
  const handleSelectProductInRow = (rowId: string, prod: Product) => {
    const defaultRate = prod.selling_price || prod.mrp || 0;
    const unitsPerPack = prod.units_per_box_carton || prod.units_per_trading_unit || 1;

    setItems(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          productId: prod.id,
          unitRate: defaultRate,
          discount: prod.carton_discount || 0
        };
      }
      return r;
    }));

    setProductSearchQueries(prev => ({
      ...prev,
      [rowId]: prod.name
    }));

    setOpenProductDropdownRowId(null);

    // Auto-focus quantity input for rapid billing entry
    setTimeout(() => {
      const qtyInput = document.getElementById(`qty-input-${rowId}`);
      if (qtyInput) {
        qtyInput.focus();
        (qtyInput as HTMLInputElement).select();
      }
    }, 50);
  };

  // Handle Quick Add from Top Scanner Bar
  const handleSelectFromTopScanner = (prod: Product) => {
    const existingIndex = items.findIndex(it => it.productId === prod.id);
    if (existingIndex >= 0) {
      // Increment existing row
      const existing = items[existingIndex];
      const currentQty = existing.packedPieces ?? existing.cartonQty ?? 0;
      const packSize = prod.units_per_box_carton || 1;
      const newQty = currentQty + (packSize > 1 ? packSize : 1);

      setItems(prev => prev.map((r, i) => i === existingIndex ? { ...r, packedPieces: newQty, cartonQty: newQty } : r));
      setTimeout(() => {
        document.getElementById(`qty-input-${existing.id}`)?.focus();
      }, 50);
    } else {
      // Add new row
      handleAddItemRow(prod.id);
    }

    setTopBarcodeQuery('');
    setIsTopBarcodeDropdownOpen(false);
  };

  // Financial calculations strictly in Pieces & Auto-Box analysis
  const orderCalculations = useMemo(() => {
    return items.map(row => {
      const prod = products.find(p => p.id === row.productId);
      const unitsPerPack = prod?.units_per_box_carton || prod?.units_per_trading_unit || 1;
      const packedPieces = row.packedPieces !== undefined ? row.packedPieces : (row.cartonQty || 0);
      const baseQty = packedPieces;
      const purchaseCost = Number(prod?.purchase_price || (row.unitRate * 0.88));
      const unitRate = Number(row.unitRate || prod?.selling_price || 0);
      const discountPerUnit = Number(row.discount || 0);
      
      const grossAmount = packedPieces * unitRate;
      const discountAmount = packedPieces * discountPerUnit;
      const taxable = Math.max(0, grossAmount - discountAmount);
      const gstPercent = prod?.gst_percent || 18;
      const gstAmount = Math.round(taxable * (gstPercent / 100) * 100) / 100;
      const totalAmount = Math.round((taxable + gstAmount) * 100) / 100;

      // Profit margin
      const marginPct = unitRate > 0 && purchaseCost > 0
        ? Math.round(((unitRate - purchaseCost) / unitRate) * 10000) / 100
        : null;

      const inv = inventory.find(i => i.product_id === row.productId);
      const availStockPieces = inv?.available_qty || 0;

      // Auto-Box computation
      const autoBox = formatAutoBoxQuantity(packedPieces, prod);

      return {
        ...row,
        prod,
        unitsPerPack,
        packedPieces,
        baseQty,
        purchaseCost,
        unitRate,
        marginPct,
        availStockPieces,
        autoBox,
        amounts: {
          grossAmount,
          taxableAmount: taxable,
          gstAmount,
          totalAmount,
          discountAmount
        }
      };
    });
  }, [items, products, inventory]);

  const totalTaxable = orderCalculations.reduce((sum, c) => sum + c.amounts.taxableAmount, 0);
  const totalGst = orderCalculations.reduce((sum, c) => sum + c.amounts.gstAmount, 0);
  const totalDiscount = orderCalculations.reduce((sum, c) => sum + c.amounts.discountAmount, 0);
  const grandTotal = Math.round(totalTaxable + totalGst);
  const totalPieces = items.reduce((sum, r) => sum + (r.packedPieces !== undefined ? r.packedPieces : r.cartonQty), 0);

  // Submit Handler
  const handleSubmit = async (mode: 'book_only' | 'instant_bill') => {
    if (!isWalkIn && !selectedRetailer) {
      alert('Please search and select a retailer customer, or check Walk-in / Cash customer.');
      retailerInputRef.current?.focus();
      return;
    }

    if (items.some(it => {
      const qty = it.packedPieces !== undefined ? it.packedPieces : it.cartonQty;
      return qty <= 0;
    })) {
      alert('All item rows must have at least 1 piece quantity specified.');
      return;
    }

    setIsSubmitting(true);

    try {
      const targetRetailerId = isWalkIn ? 'ret-walkin-counter' : selectedRetailer!.id;

      // 1. Prepare Order Items
      const orderItems = orderCalculations.map(c => ({
        product_id: c.productId,
        quantity: c.baseQty,
        carton_qty: c.cartonQty,
        loose_qty: c.looseQty,
        base_qty: c.baseQty,
        ordered_qty: c.baseQty,
        ordered_pieces: c.baseQty,
        packed_qty: c.baseQty,
        packed_pieces: c.baseQty,
        packed_cartons: c.cartonQty,
        trading_unit: c.prod?.trading_unit || 'Piece',
        base_unit: c.prod?.base_unit || 'Piece',
        units_per_trading_unit: c.unitsPerPack,
        units_per_box_carton: c.unitsPerPack,
        carton_rate: c.unitRate,
        rate: c.unitRate,
        unit_rate: c.unitRate,
        loose_rate: Math.round((c.unitRate / c.unitsPerPack) * 100) / 100,
        base_price: c.unitRate,
        order_time_rate: c.unitRate,
        catalogue_rate_at_order: c.prod?.selling_price || c.unitRate,
        discount: c.discount,
        carton_discount: c.discount,
        loose_discount: 0,
        final_price: c.amounts.taxableAmount,
        gst_percent: c.prod?.gst_percent || 18,
        gst_amount: c.amounts.gstAmount,
        total_amount: c.amounts.totalAmount,
        final_applied_rate: Math.max(0, c.unitRate - c.discount),
        selected_mrp: c.prod?.mrp,
        mrp: c.prod?.mrp,
        purchase_rate: c.prod?.purchase_price
      }));

      // 2. Create Counter Order
      const newOrder = placeOrder({
        retailer_id: targetRetailerId,
        source: 'counter_sale',
        channel: 'On Counter Sale',
        created_by: currentUser?.name || 'Admin POS Counter',
        total_amount: grandTotal,
        admin_notes: isWalkIn 
          ? `${orderNotes} | Walk-in: ${walkInName} (${walkInPhone || 'No Phone'}) | Payment: ${paymentMethod}` 
          : `${orderNotes} (Payment: ${paymentMethod})`,
        items: orderItems as any
      });

      if (mode === 'instant_bill') {
        // 3. Immediately Dispatch and Generate 1 GST Tax Invoice
        const dispatchRes = dispatchRetailerPackingLot({
          retailerId: targetRetailerId,
          sourceOrderIds: [newOrder.id],
          items: orderCalculations.map(c => ({
            originOrderId: newOrder.id,
            originItemId: newOrder.items?.find((i: any) => i.product_id === c.productId)?.id || `item-${c.productId}`,
            productId: c.productId,
            productName: c.prod?.name || 'FMCG Item',
            sku: c.prod?.sku || 'SKU',
            mrp: c.prod?.mrp || 0,
            unitsPerPack: c.unitsPerPack,
            tradingUnit: 'Piece',
            baseUnit: 'Piece',
            orderedPieces: c.packedPieces,
            packedPieces: c.packedPieces,
            orderedCartons: c.cartonQty,
            orderedLoose: c.looseQty,
            packedCartons: c.cartonQty,
            packedLoose: c.looseQty,
            unitRate: c.unitRate,
            purchaseCost: c.purchaseCost || 0,
            hsn: c.prod?.hsn || '1902'
          }))
        }, {
          transportMode: 'Counter Handover / Spot Pickup',
          notes: `Instant Counter Spot Billing. Order: ${newOrder.order_number}`,
          generateChallan: true
        });

        setIsSubmitting(false);
        onClose();
        if (onOrderCreated && dispatchRes) {
          onOrderCreated(newOrder, dispatchRes.invoice, dispatchRes.challan);
        }
      } else {
        setIsSubmitting(false);
        onClose();
        if (onOrderCreated) {
          onOrderCreated(newOrder);
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      alert(`Failed to create spot order: ${err?.message || 'Unknown error'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* ========================================================================= */}
        {/* 1. MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Zap className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                  Create Counter Spot Order &amp; Quick Sale
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  POS TERMINAL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Wholesale spot booking with high-speed retailer autocomplete &amp; product combobox search
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. MODAL SCROLLABLE BODY */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800">
          
          {/* SECTION 1: UNIFIED RETAILER AUTOCOMPLETE SEARCH */}
          <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-600" />
                <span>1. Select Retailer Customer</span>
              </span>

              <label className="text-xs font-bold text-slate-600 flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all self-start sm:self-auto">
                <input
                  type="checkbox"
                  checked={isWalkIn}
                  onChange={(e) => {
                    setIsWalkIn(e.target.checked);
                    if (e.target.checked) {
                      setSelectedRetailerId('');
                      setRetailerSearchText('');
                      setIsRetailerDropdownOpen(false);
                    }
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Walk-in / Direct Cash Buyer</span>
              </label>
            </div>

            {!isWalkIn ? (
              <div className="space-y-3">
                
                {/* Unified Autocomplete Search Bar */}
                <div className="relative" ref={retailerComboboxRef}>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
                    Search Store / Retailer Master ({retailers.length} Registered Accounts)
                  </label>

                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    
                    <input
                      ref={retailerInputRef}
                      type="text"
                      value={retailerSearchText}
                      onChange={(e) => {
                        setRetailerSearchText(e.target.value);
                        setIsRetailerDropdownOpen(true);
                        setHighlightedRetailerIndex(0);
                        if (selectedRetailerId && e.target.value !== selectedRetailer?.shop_name) {
                          setSelectedRetailerId('');
                        }
                      }}
                      onFocus={() => setIsRetailerDropdownOpen(true)}
                      onKeyDown={handleRetailerKeyDown}
                      placeholder="Type shop name, owner, city, beat, phone, GSTIN..."
                      className="w-full pl-10 pr-20 py-2.5 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                    />

                    <div className="absolute right-2.5 flex items-center gap-1">
                      {retailerSearchText && (
                        <button
                          type="button"
                          onClick={handleClearRetailer}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsRetailerDropdownOpen(prev => !prev)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
                        title="Toggle list"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isRetailerDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Autocomplete Dropdown Menu */}
                  {isRetailerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                      {filteredRetailers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 font-medium">
                          No matching stores found for &quot;<strong className="text-slate-800">{retailerSearchText}</strong>&quot;.
                        </div>
                      ) : (
                        filteredRetailers.map((ret, idx) => {
                          const isSelected = ret.id === selectedRetailerId;
                          const isHighlighted = idx === highlightedRetailerIndex;
                          const outstanding = ret.outstanding || ret.outstanding_balance || 0;

                          return (
                            <button
                              key={ret.id}
                              type="button"
                              onClick={() => handleSelectRetailer(ret)}
                              onMouseEnter={() => setHighlightedRetailerIndex(idx)}
                              className={`w-full p-3 text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-50 text-indigo-950 font-bold' 
                                  : isHighlighted 
                                    ? 'bg-slate-50 text-slate-900' 
                                    : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-xs text-slate-900 truncate">
                                      {ret.shop_name}
                                    </span>
                                    {isSelected && (
                                      <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[9px] font-black uppercase">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                    <span>Owner: <strong className="text-slate-700">{ret.owner_name || 'N/A'}</strong></span>
                                    <span>&bull;</span>
                                    <span>Ph: <strong className="text-slate-700 font-mono">{ret.mobile || ret.phone || 'N/A'}</strong></span>
                                    <span>&bull;</span>
                                    <span>City: <strong className="text-slate-700">{ret.beat_name || ret.city || 'Nagpur'}</strong></span>
                                    {ret.gstin && (
                                      <>
                                        <span>&bull;</span>
                                        <span className="font-mono text-[10px] text-slate-500">GST: {ret.gstin}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ledger Outstanding</span>
                                <span className={`font-mono text-xs font-black ${
                                  outstanding > 0 ? 'text-rose-600' : 'text-slate-700'
                                }`}>
                                  {formatINR(outstanding)}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Retailer Information Card */}
                {selectedRetailer && (
                  <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-indigo-950">{selectedRetailer.shop_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active Account
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600 text-[11px] flex-wrap">
                        <span>Owner: <strong className="text-slate-900 font-semibold">{selectedRetailer.owner_name || 'N/A'}</strong></span>
                        <span>&bull;</span>
                        <span>Mob: <strong className="text-slate-900 font-mono font-semibold">{selectedRetailer.mobile || selectedRetailer.phone || 'N/A'}</strong></span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 text-slate-700">
                          <MapPin className="w-3 h-3 text-indigo-600" />
                          <span>Beat: {selectedRetailer.beat_name || selectedRetailer.route || selectedRetailer.city || 'Nagpur'}</span>
                        </span>
                        {selectedRetailer.gstin && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono text-slate-700">GSTIN: {selectedRetailer.gstin}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-white px-4 py-2 rounded-xl border border-indigo-100 shadow-2xs text-right self-end sm:self-auto shrink-0">
                      <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                        Ledger Outstanding
                      </span>
                      <span className="text-base font-black text-rose-600 font-mono">
                        {formatINR(selectedRetailer.outstanding || selectedRetailer.outstanding_balance || 0)}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* Walk-in Buyer Inputs */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Customer / Buyer Name
                  </label>
                  <input
                    type="text"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="e.g. Ramesh Bhai Spot Sale"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="e.g. 98200 12345"
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}

          </div>

          {/* SECTION 2: PRODUCTS & LINE ITEMS TABLE */}
          <div className="space-y-3">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>2. Products &amp; Quantities ({items.length} {items.length === 1 ? 'Line Item' : 'Line Items'})</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Search by product name, SKU, or scan barcode to automatically add items
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAddItemRow()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Item Row</span>
              </button>
            </div>

            {/* Quick Barcode Scanner / Omnibar */}
            <div className="relative bg-slate-50 p-3 rounded-2xl border border-slate-200" ref={topBarcodeRef}>
              <div className="relative flex items-center">
                <Barcode className="w-4 h-4 text-indigo-600 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={topBarcodeQuery}
                  onChange={(e) => {
                    setTopBarcodeQuery(e.target.value);
                    setIsTopBarcodeDropdownOpen(true);
                    setTopBarcodeHighlightIndex(0);
                  }}
                  onFocus={() => {
                    if (topBarcodeQuery.trim()) setIsTopBarcodeDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (topBarcodeFilteredProducts.length > 0) {
                        handleSelectFromTopScanner(topBarcodeFilteredProducts[topBarcodeHighlightIndex]);
                      }
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setTopBarcodeHighlightIndex(prev => Math.min(topBarcodeFilteredProducts.length - 1, prev + 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setTopBarcodeHighlightIndex(prev => Math.max(0, prev - 1));
                    } else if (e.key === 'Escape') {
                      setIsTopBarcodeDropdownOpen(false);
                    }
                  }}
                  placeholder="⚡ Quick Scan Barcode (EAN-13) or Fast Search product name to instantly add..."
                  className="w-full pl-10 pr-24 py-2 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 shadow-2xs focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all"
                />
                <span className="absolute right-3 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-500 pointer-events-none">
                  [ENTER]
                </span>
              </div>

              {/* Top Scanner Dropdown Menu */}
              {isTopBarcodeDropdownOpen && topBarcodeFilteredProducts.length > 0 && (
                <div className="absolute left-3 right-3 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                  {topBarcodeFilteredProducts.map((p, idx) => {
                    const inv = inventory.find(i => i.product_id === p.id);
                    const stock = inv?.available_qty || 0;
                    const isHigh = idx === topBarcodeHighlightIndex;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectFromTopScanner(p)}
                        onMouseEnter={() => setTopBarcodeHighlightIndex(idx)}
                        className={`w-full p-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isHigh ? 'bg-indigo-50 text-indigo-950 font-bold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black text-xs text-slate-900 truncate">{p.name}</span>
                          {p.brand && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {p.brand}
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                            MRP ₹{p.mrp}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            stock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}>
                            {stock > 0 ? `🟢 ${stock} Pcs` : '🔴 0 Pcs'}
                          </span>
                          <span className="font-mono font-black text-indigo-700">
                            {formatINR(p.selling_price || p.mrp)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3 w-8 text-center">#</th>
                      <th className="p-3 min-w-[280px]">Product / Autocomplete Search</th>
                      <th className="p-3 text-center w-28">Stock Avail</th>
                      <th className="p-3 text-center w-32">Packed Qty (Pcs)</th>
                      <th className="p-3 text-right w-24">Purchase (₹)</th>
                      <th className="p-3 text-right w-32">Rate / Pc (₹)</th>
                      <th className="p-3 text-right w-28">Line Total</th>
                      <th className="p-3 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderCalculations.map((calc, idx) => {
                      const rowFilteredProducts = getFilteredProductsForRow(calc.id);
                      const isDropdownOpen = openProductDropdownRowId === calc.id;
                      const searchQuery = productSearchQueries[calc.id] ?? calc.prod?.name ?? '';

                      return (
                        <tr key={calc.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                          
                          {/* Searchable Product Autocomplete Combobox */}
                          <td className="p-3">
                            <div className="relative">
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProductSearchQueries(prev => ({ ...prev, [calc.id]: val }));
                                    setOpenProductDropdownRowId(calc.id);
                                    setHighlightedProdIndex(0);
                                  }}
                                  onFocus={() => {
                                    setOpenProductDropdownRowId(calc.id);
                                    setHighlightedProdIndex(0);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      if (!isDropdownOpen) setOpenProductDropdownRowId(calc.id);
                                      setHighlightedProdIndex(prev => Math.min(rowFilteredProducts.length - 1, prev + 1));
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setHighlightedProdIndex(prev => Math.max(0, prev - 1));
                                    } else if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (rowFilteredProducts[highlightedProdIndex]) {
                                        handleSelectProductInRow(calc.id, rowFilteredProducts[highlightedProdIndex]);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setOpenProductDropdownRowId(null);
                                    }
                                  }}
                                  placeholder="Search product name, brand, MRP, SKU..."
                                  className="w-full px-3 py-1.5 pr-8 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-600 rounded-xl text-xs font-black text-slate-900 placeholder:text-slate-400 shadow-2xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                                />

                                <button
                                  type="button"
                                  onClick={() => setOpenProductDropdownRowId(prev => prev === calc.id ? null : calc.id)}
                                  className="absolute right-2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Autocomplete Dropdown List */}
                              {isDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100 min-w-[320px]">
                                  {rowFilteredProducts.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-slate-500 font-medium">
                                      No products match &quot;{searchQuery}&quot;
                                    </div>
                                  ) : (
                                    rowFilteredProducts.map((p, pIdx) => {
                                      const pInv = inventory.find(i => i.product_id === p.id);
                                      const pStock = pInv?.available_qty || 0;
                                      const isHigh = pIdx === highlightedProdIndex;
                                      const isCurrent = p.id === calc.productId;

                                      return (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => handleSelectProductInRow(calc.id, p)}
                                          onMouseEnter={() => setHighlightedProdIndex(pIdx)}
                                          className={`w-full p-2.5 text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                                            isCurrent 
                                              ? 'bg-indigo-50 text-indigo-950 font-bold' 
                                              : isHigh 
                                                ? 'bg-slate-50 text-slate-900 font-semibold' 
                                                : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-black text-xs text-slate-900">{p.name}</span>
                                              {p.brand && (
                                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                  {p.brand}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                              <span className="font-mono text-emerald-700 font-bold">MRP ₹{p.mrp}</span>
                                              <span>&bull;</span>
                                              <span>SKU: {p.sku}</span>
                                              {(p.units_per_box_carton || 1) > 1 && (
                                                <>
                                                  <span>&bull;</span>
                                                  <span className="font-bold text-indigo-600">Pack: {p.units_per_box_carton} Pcs/Box</span>
                                                </>
                                              )}
                                            </div>
                                          </div>

                                          <div className="text-right shrink-0">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full block mb-0.5 ${
                                              pStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                                            }`}>
                                              {pStock > 0 ? `${pStock} Pcs` : 'Out of Stock'}
                                            </span>
                                            <span className="font-mono text-xs font-black text-indigo-700">
                                              {formatINR(p.selling_price || p.mrp)}
                                            </span>
                                          </div>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              )}

                              {/* Selected MRP & Pack metadata pill */}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono">
                                  MRP ₹{calc.prod?.mrp || 0}
                                </span>
                                {calc.unitsPerPack > 1 && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    Pack: {calc.unitsPerPack} Pcs/Box
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Stock Avail */}
                          <td className="p-3 text-center">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full inline-block ${
                              calc.availStockPieces > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}>
                              {calc.availStockPieces > 0 ? `🟢 ${calc.availStockPieces} Pcs` : '🔴 0 Pcs'}
                            </span>
                          </td>

                          {/* Packed Quantity (Pieces) with Auto-Box Conversion */}
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="inline-flex items-center justify-center gap-1">
                                <input
                                  id={`qty-input-${calc.id}`}
                                  type="number"
                                  min="1"
                                  value={calc.packedPieces}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    setItems(prev => prev.map(r => r.id === calc.id ? { ...r, packedPieces: val, cartonQty: val } : r));
                                  }}
                                  className="w-20 p-1.5 bg-white border border-indigo-300 focus:border-indigo-600 rounded-xl text-center font-mono font-black text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Pcs</span>
                              </div>
                              {!calc.autoBox.isPieceOnly && calc.autoBox.packSize > 1 && (
                                <span className="text-[9px] text-slate-500 font-medium leading-none">
                                  {calc.autoBox.displayOrdered}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Purchase Cost */}
                          <td className="p-3 text-right">
                            <span className="font-mono font-bold text-slate-600 text-xs">
                              ₹{Number(calc.purchaseCost || 0).toFixed(2)}
                            </span>
                          </td>

                          {/* Selling Rate with Profit Margin Indicator */}
                          <td className="p-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="relative inline-flex items-center justify-end gap-1">
                                <span className="text-slate-400 text-[10px] font-bold">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={calc.unitRate}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setItems(prev => prev.map(r => r.id === calc.id ? { ...r, unitRate: val } : r));
                                  }}
                                  className="w-24 p-1.5 bg-white border border-slate-300 rounded-xl text-right font-mono font-black text-xs text-indigo-700 focus:border-indigo-500 focus:outline-none shadow-2xs"
                                />
                              </div>
                              {calc.marginPct !== null && (
                                <span className={`text-[9px] font-black inline-flex items-center gap-0.5 ${
                                  calc.marginPct >= 10 ? 'text-emerald-700' : calc.marginPct > 0 ? 'text-blue-700' : 'text-rose-700'
                                }`}>
                                  <TrendingUp className="w-2.5 h-2.5" />
                                  <span>{calc.marginPct >= 0 ? `+${calc.marginPct.toFixed(1)}%` : `${calc.marginPct.toFixed(1)}%`}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="p-3 text-right font-mono font-black text-slate-900 text-xs">
                            {formatINR(calc.amounts.totalAmount)}
                          </td>

                          {/* Remove Action */}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(calc.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* SECTION 3: COMMERCIAL TERMS & LIVE FINANCIAL CARD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Payment Method & Logistics */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs shadow-2xs">
              <span className="font-black text-slate-900 uppercase tracking-wider block">
                3. Payment &amp; Counter Notes
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Cash">💵 Cash Collection</option>
                    <option value="UPI">📱 UPI / QR Code</option>
                    <option value="Credit">🏛️ Credit Account (Ledger)</option>
                    <option value="Bank Transfer">🏦 Bank NEFT/RTGS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1">
                    Order Reference Note
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* Live Financial Summary Card */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 via-white to-emerald-50/40 border border-indigo-200 rounded-2xl text-xs space-y-2.5 shadow-2xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Total Items / Pieces:</span>
                <span className="font-extrabold text-slate-900 font-mono">
                  {totalPieces} Pieces ({items.length} Lines)
                </span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Taxable Amount:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {formatINR(totalTaxable)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>GST Tax (CGST + SGST):</span>
                <span className="font-bold text-slate-900 font-mono">
                  +{formatINR(totalGst)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-950 font-black text-sm sm:text-base border-t border-indigo-200 pt-2.5 mt-1">
                <span>Estimated Net Total:</span>
                <span className="text-indigo-900 font-mono text-xl font-black">
                  {formatINR(grandTotal)}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. MODAL ACTION FOOTER */}
        {/* ========================================================================= */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            {/* Mode 1: Send to Packing Lot */}
            <button
              type="button"
              onClick={() => handleSubmit('book_only')}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-black shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Book Spot Order (To Packing Lot)</span>
            </button>

            {/* Mode 2: Instant 1-Click Bill & Print Invoice */}
            <button
              type="button"
              onClick={() => handleSubmit('instant_bill')}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center gap-2 cursor-pointer hover:scale-102 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Spot Bill...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white stroke-[2]" />
                  <span>⚡ 1-Click Spot Bill &amp; Print</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
