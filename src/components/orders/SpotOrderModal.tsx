'use client';

import { hasWords, matchWords } from '@/lib/searchWords';
import { ensureWalkInRetailer, describeStockShortfall, isCustomerParty } from '@/lib/db';
import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
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
  ShieldCheck, Tag, Box, Hash, TrendingUp, ArrowLeft, Minus, ChevronRight, History
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

interface PastBillLine {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  retailerId: string;
  qty: number;
  rate: number; // per piece, before GST
}

interface SpotOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: Order, invoice?: Invoice, challan?: DeliveryChallan) => void;
}

/** On a phone, move a search box to the top of the screen so its list is not hidden behind the keyboard */
function scrollFieldToTop(el: HTMLElement | null) {
  if (!el || typeof window === 'undefined' || window.innerWidth >= 768) return;
  setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
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
    retailers: allParties, 
    products, 
    inventory, 
    placeOrder, 
    dispatchRetailerPackingLot, 
    currentUser,
    invoices
  } = useDb();
  // supplier-only parties do not place orders
  const retailers = useMemo(() => allParties.filter(isCustomerParty), [allParties]);

  // ---- Last billing rates (per piece, newest first), built once from the saved bills ----
  const [ratesForProductId, setRatesForProductId] = useState<string | null>(null);
  const billedLinesByProduct = useMemo(() => {
    const map = new Map<string, PastBillLine[]>();
    const list = [...((invoices || []) as any[])]
      .filter(inv => inv && inv.status !== 'Cancelled')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const inv of list) {
      for (const it of (inv.items || []) as any[]) {
        if (!it?.product_id) continue;
        const qty = Number(it.base_qty ?? it.quantity) || 0;
        const taxable = Number(it.taxable_value) || 0;
        const pack = Number(it.units_per_trading_unit || it.units_per_box_carton) || 1;
        // Rate per piece: from the line value when we have it, else the stored rate per pack
        const perPiece = qty > 0 && taxable > 0
          ? taxable / qty
          : (Number(it.unit_rate) || (Number(it.carton_rate ?? it.rate) || 0) / pack);
        const arr = map.get(it.product_id) || [];
        if (arr.length >= 40) continue;
        arr.push({ invoiceId: inv.id, invoiceNumber: inv.invoice_number, date: inv.date, retailerId: inv.retailer_id, qty, rate: Math.round(perPiece * 100) / 100 });
        map.set(it.product_id, arr);
      }
    }
    return map;
  }, [invoices]);
  const lastRates = (productId: string, retailerId?: string | null, limit = 5) =>
    (billedLinesByProduct.get(productId) || []).filter(r => !retailerId || r.retailerId === retailerId).slice(0, limit);

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

  // Phones get their own billing-terminal layout (separate party and item windows)
  const [isPhone, setIsPhone] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Line items state (the bill starts empty; items are added from the item search)
  const [items, setItems] = useState<SpotOrderItemRow[]>([]);

  // Phone windows
  const [partyWindowOpen, setPartyWindowOpen] = useState(false);
  const [itemWindowOpen, setItemWindowOpen] = useState(false);
  const [itemWindowQuery, setItemWindowQuery] = useState('');
  const [pickedProduct, setPickedProduct] = useState<Product | null>(null);
  const [pickedQty, setPickedQty] = useState('');
  const [pickedRate, setPickedRate] = useState('');
  const deferredItemQuery = useDeferredValue(itemWindowQuery);
  // Laptop item entry line
  const [deskListOpen, setDeskListOpen] = useState(false);
  const deskSearchRef = useRef<HTMLInputElement>(null);
  const deskQtyRef = useRef<HTMLInputElement>(null);
  const deskBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (deskBoxRef.current && !deskBoxRef.current.contains(e.target as Node)) setDeskListOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

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
      return matchWords(query, r.shop_name, r.owner_name, r.city, r.beat_name || r.route, r.mobile, r.phone, r.gstin);
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
      return matchWords(rawQuery, p.name, p.brand, p.sku, p.barcode, p.mrp, p.category);
    }).slice(0, 40);
  };

  // Top Barcode Search Filter
  const topBarcodeFilteredProducts = useMemo(() => {
    const query = topBarcodeQuery.trim().toLowerCase();
    if (!query) return [];

    return products.filter(p => {
      return matchWords(query, p.barcode, p.sku, p.name, p.brand);
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
      const gstPercent = (prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0;
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
      alert('Please search and select a party, or check Walk-in / Cash customer.');
      retailerInputRef.current?.focus();
      return;
    }

    if (items.length === 0) {
      alert('Please add at least one item.');
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
      // Walk-in ke liye company ka asli "Counter / Walk-in Customer" record (bill sahi naam par bane)
      const targetRetailerId = isWalkIn ? ensureWalkInRetailer().id : selectedRetailer!.id;

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
        gst_percent: (c.prod?.gst_percent !== undefined && c.prod?.gst_percent !== null) ? Number(c.prod.gst_percent) : 0,
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
        const shortMsg = describeStockShortfall();
        if (shortMsg) {
          alert(dispatchRes
            ? shortMsg
            : `Invoice not generated because the items are out of stock. Order ${newOrder.order_number} has been saved as a backorder. ${shortMsg}`);
        }
        onClose();
        if (onOrderCreated) {
          if (dispatchRes) onOrderCreated(newOrder, dispatchRes.invoice, dispatchRes.challan);
          else onOrderCreated(newOrder);
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

  // ===========================================================================
  // BILLING TERMINAL (phone and laptop share the same simple layout)
  // ===========================================================================
  const stockOf = (productId: string) => Number(inventory.find(i => i.product_id === productId)?.available_qty || 0);
  const inBillQty = (productId: string) => items
    .filter(r => r.productId === productId)
    .reduce((sum, r) => sum + (r.packedPieces ?? r.cartonQty ?? 0), 0);

  const itemMatches = (() => {
    const q = deferredItemQuery.trim();
    const list = q ? products.filter(p => matchWords(q, p.name, p.brand, p.barcode, p.mrp, p.category)) : products;
    return list.slice(0, 60);
  })();
  const partyMatches = filteredRetailers;

  const pickProduct = (p: Product) => {
    setPickedProduct(p);
    setPickedQty('');
    setPickedRate(String(p.selling_price || p.mrp || 0));
    setDeskListOpen(false);
    setTimeout(() => { deskQtyRef.current?.focus(); deskQtyRef.current?.select(); }, 30);
  };

  const addPickedItem = () => {
    if (!pickedProduct) return;
    const qty = parseInt(pickedQty, 10) || 0;
    if (qty <= 0) { alert('Please enter the quantity.'); return; }
    const rate = parseFloat(pickedRate) || 0;
    const p = pickedProduct;
    const existing = items.find(r => r.productId === p.id);
    if (existing) {
      const newQty = (existing.packedPieces ?? existing.cartonQty ?? 0) + qty;
      setItems(prev => prev.map(r => r.id === existing.id ? { ...r, packedPieces: newQty, cartonQty: newQty, unitRate: rate } : r));
    } else {
      setItems(prev => [...prev, {
        id: `item-${Date.now()}-${prev.length + 1}`,
        productId: p.id,
        packedPieces: qty,
        cartonQty: qty,
        looseQty: 0,
        unitRate: rate,
        discount: p.carton_discount || 0
      }]);
    }
    setPickedProduct(null);
    setPickedQty('');
    setPickedRate('');
    setItemWindowQuery('');
    setHighlightedProdIndex(0);
    // Laptop: straight back to the item search for the next item
    if (!isPhone) setTimeout(() => deskSearchRef.current?.focus(), 30);
  };

  const setRowQty = (rowId: string, qty: number) => {
    const q = Math.max(0, qty);
    setItems(prev => prev.map(r => r.id === rowId ? { ...r, packedPieces: q, cartonQty: q } : r));
  };
  const setRowRate = (rowId: string, rate: number) => setItems(prev => prev.map(r => r.id === rowId ? { ...r, unitRate: rate } : r));
  const removeRow = (rowId: string) => setItems(prev => prev.filter(r => r.id !== rowId));

  const outstandingOf = (r: any) => Number(r?.outstanding || r?.outstanding_balance || 0);
  const payOptions: { v: typeof paymentMethod; label: string }[] = [
    { v: 'Cash', label: 'Cash' }, { v: 'UPI', label: 'UPI' }, { v: 'Credit', label: 'Credit' }, { v: 'Bank Transfer', label: 'Bank' }
  ];

  const openPartyWindow = () => { setRetailerSearchText(''); setHighlightedRetailerIndex(0); setPartyWindowOpen(true); };

  const itemMeta = (p: Product | undefined, extra?: React.ReactNode) => {
    if (!p) return null;
    const stock = stockOf(p.id);
    const pack = p.units_per_box_carton || 1;
    return (
      <span className="text-xs text-slate-500">
        <span className="whitespace-nowrap">MRP ₹{p.mrp ?? 0}</span>
        <span className="mx-1.5">·</span>
        <span className={`whitespace-nowrap ${stock > 0 ? '' : 'text-rose-600'}`}>Stock {stock}</span>
        {pack > 1 && (<><span className="mx-1.5">·</span><span className="whitespace-nowrap">{pack} Pcs/Box</span></>)}
        {extra}
      </span>
    );
  };

  const partyIdForRates = !isWalkIn && selectedRetailerId ? selectedRetailerId : null;
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  };
  // One line under each bill item: the last rate given to this party
  const lastRateHint = (productId: string) => {
    if (!partyIdForRates) return null;
    const last = lastRates(productId, partyIdForRates, 1)[0];
    return (
      <span className="block mt-0.5 text-xs text-slate-500">
        {last ? <>Last rate to this party: <strong className="text-slate-700">{formatINR(last.rate)}</strong> on {fmtDate(last.date)}</> : 'Not billed to this party before'}
      </span>
    );
  };

  const applyRateToItem = (productId: string, rate: number) => {
    setItems(prev => prev.map(r => r.productId === productId ? { ...r, unitRate: rate } : r));
    setRatesForProductId(null);
  };

  const ratesList = (rows: PastBillLine[], showParty: boolean, empty: string, productId: string) => (
    rows.length === 0 ? (
      <p className="text-sm text-slate-500 py-2">{empty}</p>
    ) : (
      <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
        {rows.map((r, i) => {
          const party = showParty ? (retailers.find(x => x.id === r.retailerId)?.shop_name || 'Counter / Walk-in') : '';
          return (
            <li key={`${r.invoiceId}-${i}`} className="px-3 py-2 flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{formatINR(r.rate)} <span className="text-xs font-normal text-slate-500">/ Pc · {r.qty} Pcs</span></span>
                <span className="block text-xs text-slate-500 break-words">{fmtDate(r.date)} · {r.invoiceNumber}{party ? ` · ${party}` : ''}</span>
              </span>
              <button type="button" onClick={() => applyRateToItem(productId, r.rate)}
                className="h-9 px-3 rounded-lg border border-indigo-300 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 active:bg-indigo-50 cursor-pointer shrink-0">
                Use
              </button>
            </li>
          );
        })}
      </ul>
    )
  );

  const ratesProduct = ratesForProductId ? products.find(p => p.id === ratesForProductId) : undefined;
  const ratesRow = ratesForProductId ? orderCalculations.find(c => c.productId === ratesForProductId) : undefined;
  const ratesSheet = ratesForProductId && ratesProduct ? (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="rates-title">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => setRatesForProductId(null)} aria-hidden="true" />
      <div className="relative w-full md:max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl md:rounded-xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-start gap-3">
          <span className="min-w-0 flex-1">
            <span id="rates-title" className="block text-[15px] md:text-sm font-bold leading-snug break-words">{ratesProduct.name}</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              Rate on this bill: <strong className="text-slate-800">{formatINR(ratesRow?.unitRate || 0)}</strong> / Pc
              {Number(ratesProduct.purchase_price) > 0 && <> · Purchase: <strong className="text-slate-800">{formatINR(Number(ratesProduct.purchase_price))}</strong></>}
            </span>
          </span>
          <button type="button" onClick={() => setRatesForProductId(null)} aria-label="Close" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {partyIdForRates && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 mb-2">Last 5 bills to {selectedRetailer?.shop_name || 'this party'}</h4>
              {ratesList(lastRates(ratesForProductId, partyIdForRates), false, 'Not billed to this party before.', ratesForProductId)}
            </section>
          )}
          <section>
            <h4 className="text-xs font-semibold text-slate-500 mb-2">Last 5 bills to any party</h4>
            {ratesList(lastRates(ratesForProductId, null), true, 'This item has not been billed yet.', ratesForProductId)}
          </section>
          {!partyIdForRates && <p className="text-xs text-slate-500">Select the party to see the rates given to that party.</p>}
        </div>
      </div>
    </div>
  ) : null;

  // ---- shared blocks ----
  const partyBlock = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">Party</span>
        <button type="button"
          onClick={() => { setIsWalkIn(!isWalkIn); if (!isWalkIn) setSelectedRetailerId(''); }}
          className={`text-xs font-semibold px-3 py-1 rounded-full border cursor-pointer ${isWalkIn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
          Walk-in customer
        </button>
      </div>
      {isWalkIn ? (
        <div className="space-y-2">
          <input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Customer name"
            className="w-full h-11 md:h-10 px-3 bg-white border border-slate-300 rounded-lg text-base md:text-sm outline-none focus:border-indigo-600" />
          <input value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} placeholder="Mobile (optional)" inputMode="tel"
            className="w-full h-11 md:h-10 px-3 bg-white border border-slate-300 rounded-lg text-base md:text-sm outline-none focus:border-indigo-600" />
        </div>
      ) : (
        <button type="button" onClick={openPartyWindow}
          className="w-full min-h-11 px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg flex items-center justify-between gap-3 text-left cursor-pointer active:bg-slate-50">
          {selectedRetailer ? (
            <span className="min-w-0">
              <span className="block text-[15px] md:text-sm font-semibold leading-snug break-words">{selectedRetailer.shop_name}</span>
              <span className="block text-xs text-slate-500">{[selectedRetailer.city, selectedRetailer.mobile || selectedRetailer.phone].filter(Boolean).join(' · ')}</span>
            </span>
          ) : (
            <span className="text-[15px] md:text-sm text-slate-400">Select party</span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            {selectedRetailer && (
              <span className={`text-sm font-semibold ${outstandingOf(selectedRetailer) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {formatINR(outstandingOf(selectedRetailer))}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </button>
      )}
    </div>
  );

  const paymentBlock = (
    <div className="space-y-3">
      <div>
        <span className="text-xs font-semibold text-slate-500 block mb-2">Payment</span>
        <div className="grid grid-cols-4 gap-2">
          {payOptions.map(o => (
            <button key={o.v} type="button" onClick={() => setPaymentMethod(o.v)}
              className={`h-9 rounded-lg text-sm font-semibold border cursor-pointer ${paymentMethod === o.v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Note (optional)"
        className="w-full h-11 md:h-10 px-3 bg-white border border-slate-300 rounded-lg text-base md:text-sm outline-none focus:border-indigo-600" />
    </div>
  );

  const actionButtons = (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => handleSubmit('book_only')} disabled={isSubmitting}
        className="h-12 md:h-11 rounded-lg border border-indigo-600 text-indigo-700 bg-white text-sm font-semibold hover:bg-indigo-50 active:bg-indigo-50 disabled:opacity-50 cursor-pointer">
        Book Order
      </button>
      <button type="button" onClick={() => handleSubmit('instant_bill')} disabled={isSubmitting}
        className="h-12 md:h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
        {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
        {isSubmitting ? 'Saving...' : 'Bill & Print'}
      </button>
    </div>
  );

  const deskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setDeskListOpen(true); setHighlightedProdIndex(i => Math.min(itemMatches.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedProdIndex(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const p = itemMatches[highlightedProdIndex]; if (p && deskListOpen) pickProduct(p); }
    else if (e.key === 'Escape') { setDeskListOpen(false); }
  };

  const partyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedRetailerIndex(i => Math.min(partyMatches.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedRetailerIndex(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = partyMatches[highlightedRetailerIndex]; if (r) { handleSelectRetailer(r); setPartyWindowOpen(false); } }
    else if (e.key === 'Escape') { setPartyWindowOpen(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 md:bg-slate-900/50 md:p-6 flex md:items-center md:justify-center">
      <div className="w-full h-[100dvh] md:h-[90vh] md:max-w-6xl md:rounded-xl overflow-hidden bg-slate-100 md:bg-white md:shadow-2xl flex flex-col text-slate-900">

        {/* Top bar */}
        <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 px-2 md:px-4">
          <button type="button" onClick={onClose} aria-label="Close" className="md:hidden w-10 h-10 flex items-center justify-center rounded-full text-slate-700 active:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="flex-1 text-base font-bold">Counter Sale</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">

          {/* ================= LEFT: items ================= */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto md:overflow-hidden overscroll-contain md:flex md:flex-col">

            {/* Phone: party */}
            <div className="md:hidden bg-white px-4 py-3 border-b border-slate-200">{partyBlock}</div>

            {/* Laptop: item entry line */}
            <div className="hidden md:block shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="grid grid-cols-[1fr_110px_120px_auto] gap-2 items-end">
                <div className="relative" ref={deskBoxRef}>
                  <span className="block text-xs font-semibold text-slate-500 mb-1">Item</span>
                  {pickedProduct ? (
                    <button type="button" onClick={() => { setPickedProduct(null); setDeskListOpen(true); setTimeout(() => deskSearchRef.current?.focus(), 30); }}
                      className="w-full h-10 px-3 bg-white border border-indigo-400 rounded-lg text-left text-sm font-semibold truncate cursor-pointer" title={pickedProduct.name}>
                      {pickedProduct.name}
                    </button>
                  ) : (
                    <input ref={deskSearchRef} value={itemWindowQuery}
                      onChange={e => { setItemWindowQuery(e.target.value); setDeskListOpen(true); setHighlightedProdIndex(0); }}
                      onFocus={() => setDeskListOpen(true)}
                      onKeyDown={deskKeyDown}
                      placeholder="Search item name, brand, MRP or scan barcode"
                      autoComplete="off" autoFocus={!isPhone}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-600" />
                  )}
                  {deskListOpen && !pickedProduct && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[55vh] overflow-y-auto">
                      {itemMatches.length === 0 ? (
                        <p className="p-4 text-center text-sm text-slate-500">No item found.</p>
                      ) : itemMatches.map((p, i) => {
                        const added = inBillQty(p.id);
                        return (
                          <button key={p.id} type="button" data-i={i}
                            onMouseEnter={() => setHighlightedProdIndex(i)}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => pickProduct(p)}
                            className={`w-full px-3 py-2 text-left border-b border-slate-100 last:border-0 cursor-pointer ${i === highlightedProdIndex ? 'bg-indigo-50' : ''}`}>
                            <span className="flex items-start justify-between gap-3">
                              <span className="text-sm font-semibold leading-snug break-words min-w-0">{p.name}</span>
                              <span className="text-sm font-bold whitespace-nowrap">{formatINR(p.selling_price || p.mrp)}</span>
                            </span>
                            <span className="block mt-0.5">{itemMeta(p, added > 0 ? (<><span className="mx-1.5">·</span><span className="whitespace-nowrap font-semibold text-emerald-700">In bill {added}</span></>) : null)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-500 mb-1">Qty (Pcs)</span>
                  <input ref={deskQtyRef} type="number" inputMode="numeric" value={pickedQty} disabled={!pickedProduct}
                    onChange={e => setPickedQty(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPickedItem(); } else if (e.key === 'Escape') { setPickedProduct(null); setTimeout(() => deskSearchRef.current?.focus(), 30); } }}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-right outline-none focus:border-indigo-600 disabled:bg-slate-100" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-slate-500 mb-1">Rate (₹)</span>
                  <input type="number" inputMode="decimal" value={pickedRate} disabled={!pickedProduct}
                    onChange={e => setPickedRate(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPickedItem(); } }}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-right outline-none focus:border-indigo-600 disabled:bg-slate-100" />
                </label>
                <button type="button" onClick={addPickedItem} disabled={!pickedProduct}
                  className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 cursor-pointer">
                  Add
                </button>
              </div>
              {pickedProduct && <p className="mt-1.5">{itemMeta(pickedProduct)}</p>}
            </div>

            {/* Laptop: bill table */}
            <div className="hidden md:block flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pl-4 pr-2 text-left font-semibold w-10">#</th>
                    <th className="py-2 px-2 text-left font-semibold">Item</th>
                    <th className="py-2 px-2 text-center font-semibold w-36">Qty (Pcs)</th>
                    <th className="py-2 px-2 text-right font-semibold w-36">Rate / Pc (₹)</th>
                    <th className="py-2 px-2 text-right font-semibold w-16">GST</th>
                    <th className="py-2 px-2 text-right font-semibold w-32">Amount</th>
                    <th className="py-2 pr-4 pl-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-400">No items yet. Search an item above to add it.</td></tr>
                  ) : orderCalculations.map((c, idx) => {
                    const qty = c.packedPieces || 0;
                    return (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                        <td className="py-2.5 pl-4 pr-2 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-2">
                          <span className="block font-semibold leading-snug break-words">{c.prod?.name || 'Item'}</span>
                          <span className="block mt-0.5">{itemMeta(c.prod)}</span>
                          {lastRateHint(c.productId)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-center">
                            <button type="button" aria-label="Less" onClick={() => setRowQty(c.id, qty - 1)} className="w-8 h-8 flex items-center justify-center rounded-l-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                            <input id={`qty-input-${c.id}`} type="number" value={qty || ''} onChange={e => setRowQty(c.id, parseInt(e.target.value, 10) || 0)}
                              className="w-14 h-8 text-center font-semibold border-y border-slate-300 outline-none focus:bg-indigo-50" />
                            <button type="button" aria-label="More" onClick={() => setRowQty(c.id, qty + 1)} className="w-8 h-8 flex items-center justify-center rounded-r-lg border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <input type="number" value={c.unitRate} onChange={e => setRowRate(c.id, parseFloat(e.target.value) || 0)}
                              className="w-full min-w-0 h-8 px-2 text-right font-semibold border border-slate-300 rounded-lg outline-none focus:border-indigo-600" />
                            <button type="button" title="Last 5 billing rates" aria-label="Last 5 billing rates" onClick={() => setRatesForProductId(c.productId)}
                              className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-300 text-indigo-700 hover:bg-indigo-50 cursor-pointer">
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500">{Number(c.prod?.gst_percent || 0)}%</td>
                        <td className="py-2.5 px-2 text-right font-bold whitespace-nowrap">{formatINR(c.amounts.totalAmount)}</td>
                        <td className="py-2 pr-4 pl-2 text-right">
                          <button type="button" aria-label="Remove item" onClick={() => removeRow(c.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone: items */}
            <div className="md:hidden mt-2 bg-white border-y border-slate-200">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Items ({items.length})</span>
                <span className="text-xs text-slate-500">{totalPieces} Pcs</span>
              </div>
              {items.length === 0 && <p className="px-4 pb-3 text-sm text-slate-400">No items yet. Tap Add Items.</p>}
              <ul className="divide-y divide-slate-100">
                {orderCalculations.map(c => {
                  const qty = c.packedPieces || 0;
                  return (
                    <li key={c.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[15px] font-semibold leading-snug break-words min-w-0">{c.prod?.name || 'Item'}</span>
                        <span className="text-[15px] font-bold whitespace-nowrap">{formatINR(c.amounts.totalAmount)}</span>
                      </div>
                      <div className="mt-0.5">{itemMeta(c.prod, (c.prod?.gst_percent ?? 0) > 0 ? (<><span className="mx-1.5">·</span><span className="whitespace-nowrap">GST {c.prod?.gst_percent}%</span></>) : null)}</div>
                      {lastRateHint(c.productId)}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                          <button type="button" aria-label="Less" onClick={() => setRowQty(c.id, qty - 1)} className="w-9 h-9 flex items-center justify-center text-slate-600 active:bg-slate-100"><Minus className="w-4 h-4" /></button>
                          <input type="number" inputMode="numeric" value={qty || ''} onChange={e => setRowQty(c.id, parseInt(e.target.value, 10) || 0)}
                            className="w-14 h-9 text-center text-base font-semibold outline-none border-x border-slate-300" />
                          <button type="button" aria-label="More" onClick={() => setRowQty(c.id, qty + 1)} className="w-9 h-9 flex items-center justify-center text-slate-600 active:bg-slate-100"><Plus className="w-4 h-4" /></button>
                        </div>
                        <span className="text-xs text-slate-500">Pcs ×</span>
                        <div className="flex items-center h-9 border border-slate-300 rounded-lg px-2 w-24">
                          <span className="text-sm text-slate-400">₹</span>
                          <input type="number" inputMode="decimal" value={c.unitRate} onChange={e => setRowRate(c.id, parseFloat(e.target.value) || 0)}
                            className="w-full h-full text-right text-base font-semibold outline-none bg-transparent" />
                        </div>
                        <button type="button" aria-label="Last 5 billing rates" onClick={() => setRatesForProductId(c.productId)} className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 text-indigo-700 active:bg-indigo-50">
                          <History className="w-4 h-4" />
                        </button>
                        <button type="button" aria-label="Remove item" onClick={() => removeRow(c.id)} className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 active:bg-rose-50 active:text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="px-4 py-3">
                <button type="button" onClick={() => { setPickedProduct(null); setItemWindowQuery(''); setItemWindowOpen(true); }}
                  className="w-full h-11 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-700 text-sm font-semibold flex items-center justify-center gap-1.5 active:bg-indigo-50">
                  <Plus className="w-4 h-4" /> Add Items
                </button>
              </div>
            </div>

            {/* Phone: payment + summary */}
            <div className="md:hidden mt-2 bg-white border-y border-slate-200 px-4 py-3">{paymentBlock}</div>
            <div className="md:hidden mt-2 mb-3 bg-white border-y border-slate-200 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between text-slate-600"><span>Taxable amount</span><span>{formatINR(totalTaxable)}</span></div>
              <div className="flex justify-between text-slate-600"><span>GST</span><span>{formatINR(totalGst)}</span></div>
            </div>
          </div>

          {/* ================= RIGHT (laptop): party, payment, total ================= */}
          <aside className="hidden md:flex w-80 shrink-0 border-l border-slate-200 bg-slate-50 flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {partyBlock}
              {paymentBlock}
              <div className="text-sm space-y-1.5 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-slate-600"><span>Items</span><span>{items.length} ({totalPieces} Pcs)</span></div>
                <div className="flex justify-between text-slate-600"><span>Taxable amount</span><span>{formatINR(totalTaxable)}</span></div>
                <div className="flex justify-between text-slate-600"><span>GST</span><span>{formatINR(totalGst)}</span></div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-2xl font-bold">{formatINR(grandTotal)}</span>
              </div>
              {actionButtons}
            </div>
          </aside>
        </div>

        {/* Phone: bottom bar */}
        <div className="md:hidden shrink-0 bg-white border-t border-slate-200 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-xl font-bold">{formatINR(grandTotal)}</span>
          </div>
          {actionButtons}
        </div>
      </div>

      {/* ---------- Party window (full screen on phone, a box on laptop) ---------- */}
      {partyWindowOpen && (
        <div className="fixed inset-0 z-[60] bg-white md:bg-slate-900/40 flex md:items-start md:justify-center md:pt-20"
          onMouseDown={e => { if (e.target === e.currentTarget) setPartyWindowOpen(false); }}>
          <div className="w-full h-[100dvh] md:h-auto md:max-h-[70vh] md:max-w-xl md:rounded-xl md:shadow-2xl bg-white flex flex-col overflow-hidden">
            <div className="h-14 shrink-0 border-b border-slate-200 flex items-center gap-1 px-2">
              <button type="button" onClick={() => setPartyWindowOpen(false)} aria-label="Back" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-100 cursor-pointer">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <input autoFocus value={retailerSearchText} onChange={e => { setRetailerSearchText(e.target.value); setHighlightedRetailerIndex(0); }}
                onKeyDown={partyKeyDown}
                placeholder="Search party name, city or mobile" enterKeyHint="search" autoComplete="off"
                className="flex-1 h-10 px-3 bg-slate-100 rounded-lg text-base md:text-sm outline-none" />
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {partyMatches.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No party found.</p>
              ) : partyMatches.map((r, i) => (
                <button key={r.id} type="button"
                  onMouseEnter={() => setHighlightedRetailerIndex(i)}
                  onClick={() => { handleSelectRetailer(r); setPartyWindowOpen(false); }}
                  className={`w-full px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3 text-left cursor-pointer active:bg-slate-50 ${i === highlightedRetailerIndex ? 'md:bg-indigo-50' : ''} ${r.id === selectedRetailerId ? 'bg-indigo-50' : ''}`}>
                  <span className="min-w-0">
                    <span className="block text-[15px] md:text-sm font-semibold leading-snug break-words">{r.shop_name}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{[r.city, r.mobile || r.phone].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={`text-sm font-semibold whitespace-nowrap ${outstandingOf(r) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatINR(outstandingOf(r))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Item window (phone) ---------- */}
      {itemWindowOpen && isPhone && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col h-[100dvh]">
          <div className="h-14 shrink-0 border-b border-slate-200 flex items-center gap-1 px-2">
            <button type="button" onClick={() => { setItemWindowOpen(false); setPickedProduct(null); }} aria-label="Back" className="w-10 h-10 flex items-center justify-center rounded-full active:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <input autoFocus value={itemWindowQuery} onChange={e => { setItemWindowQuery(e.target.value); setPickedProduct(null); }}
              placeholder="Search item name, brand or MRP" enterKeyHint="search" autoComplete="off"
              className="flex-1 h-10 px-3 bg-slate-100 rounded-lg text-base outline-none" />
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {itemMatches.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No item found.</p>
            ) : itemMatches.map(p => {
              const added = inBillQty(p.id);
              return (
                <button key={p.id} type="button" onClick={() => pickProduct(p)}
                  className={`w-full px-4 py-3 border-b border-slate-100 text-left active:bg-slate-50 ${pickedProduct?.id === p.id ? 'bg-indigo-50' : ''}`}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold leading-snug break-words min-w-0">{p.name}</span>
                    <span className="text-[15px] font-bold whitespace-nowrap">{formatINR(p.selling_price || p.mrp)}</span>
                  </span>
                  <span className="block mt-0.5">{itemMeta(p, added > 0 ? (<><span className="mx-1.5">·</span><span className="whitespace-nowrap font-semibold text-emerald-700">In bill {added}</span></>) : null)}</span>
                </button>
              );
            })}
          </div>
          {pickedProduct ? (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-semibold leading-snug break-words">{pickedProduct.name}</p>
              <p className="mt-0.5">{itemMeta(pickedProduct)}</p>
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <label className="block">
                  <span className="block text-xs text-slate-500 mb-1">Quantity (Pcs)</span>
                  <input autoFocus type="number" inputMode="numeric" value={pickedQty} onChange={e => setPickedQty(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPickedItem(); }}
                    className="w-full h-11 px-3 border border-indigo-400 rounded-lg text-base font-semibold outline-none focus:border-indigo-600" />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-500 mb-1">Rate (₹)</span>
                  <input type="number" inputMode="decimal" value={pickedRate} onChange={e => setPickedRate(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPickedItem(); }}
                    className="w-full h-11 px-3 border border-slate-300 rounded-lg text-base font-semibold outline-none focus:border-indigo-600" />
                </label>
                <button type="button" onClick={addPickedItem} className="h-11 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-700">
                  Add
                </button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => setItemWindowOpen(false)} className="w-full h-12 rounded-lg bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-700">
                Done{items.length > 0 ? ` · ${items.length} item${items.length === 1 ? '' : 's'} · ${formatINR(grandTotal)}` : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {ratesSheet}
    </div>
  );
}
