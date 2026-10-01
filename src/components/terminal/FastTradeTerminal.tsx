'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDb } from '@/context/DbContext';
import { Product, Retailer, Invoice, CustomerCreditProfile } from '@/lib/db';
import CreditCheckGateModal, { ManagerOverrideAuth } from '@/components/credit/CreditCheckGateModal';
import { 
  Zap, Search, User, Store, ShoppingCart, Plus, Trash2, Printer, 
  CheckCircle2, AlertTriangle, ShieldCheck, Tag, DollarSign, Package,
  Barcode, ArrowRight, CornerDownLeft, Sparkles, RefreshCw, X, ShieldAlert,
  ChevronDown, Phone, MapPin, Receipt, CreditCard, Banknote, QrCode
} from 'lucide-react';
import { printInvoiceDocument } from '@/lib/printInvoice';

interface TerminalCartItem {
  product: Product;
  cartonQty: number;
  looseQty: number;
  baseQty: number;
  cartonRate: number;
  looseRate: number;
  cartonDiscount: number;
  looseDiscount: number;
  mrp: number;
  gstPercent: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  hsn: string;
  packing: string;
}

export default function FastTradeTerminal() {
  const { 
    products, 
    retailers, 
    activeCompany, 
    currentUser, 
    getCustomerCreditProfile, 
    postSalesInvoiceAtomic 
  } = useDb();

  // Selected Retailer State
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerCreditProfile, setCustomerCreditProfile] = useState<CustomerCreditProfile | null>(null);

  // Active Line Item Entry Strip State
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);

  const [entryCartonQty, setEntryCartonQty] = useState<string>('1');
  const [entryLooseQty, setEntryLooseQty] = useState<string>('0');
  const [entryCartonRate, setEntryCartonRate] = useState<string>('');
  const [entryLooseRate, setEntryLooseRate] = useState<string>('');
  const [entryCartonDiscount, setEntryCartonDiscount] = useState<string>('0');
  const [entryLooseDiscount, setEntryLooseDiscount] = useState<string>('0');

  // Terminal Invoice Grid
  const [cartItems, setCartItems] = useState<TerminalCartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Credit' | 'Bank Transfer'>('Cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // Modals & UI States
  const [isCreditGateOpen, setIsCreditGateOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeSim, setShowBarcodeSim] = useState(false);

  // Autofocus DOM Element Refs
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const cartonQtyRef = useRef<HTMLInputElement>(null);
  const looseQtyRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Set default customer on initial mount
  useEffect(() => {
    if (retailers.length > 0 && !selectedRetailerId) {
      const defaultRet = retailers[0];
      setSelectedRetailerId(defaultRet.id);
      setCustomerSearchQuery(defaultRet.shop_name);
      setCustomerCreditProfile(getCustomerCreditProfile(defaultRet.id));
    }
  }, [retailers, selectedRetailerId, getCustomerCreditProfile]);

  // Update credit profile when retailer changes
  useEffect(() => {
    if (selectedRetailerId) {
      const profile = getCustomerCreditProfile(selectedRetailerId);
      setCustomerCreditProfile(profile);
    } else {
      setCustomerCreditProfile(null);
    }
  }, [selectedRetailerId, getCustomerCreditProfile]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Filter Matching Customers
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return retailers.slice(0, 8);
    return retailers.filter(r => 
      r.shop_name.toLowerCase().includes(q) || 
      r.owner_name.toLowerCase().includes(q) || 
      r.retailer_code.toLowerCase().includes(q) || 
      r.mobile.includes(q)
    ).slice(0, 8);
  }, [retailers, customerSearchQuery]);

  // Filter Matching Products
  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.product_code.toLowerCase().includes(q) || 
      p.brand.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.toLowerCase().includes(q)) || 
      (p.sku && p.sku.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [products, productSearchQuery]);

  // Format INR Helper
  const formatINR = (val?: number) => {
    if (val === undefined || isNaN(val)) return '₹0.00';
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ----------------------------------------------------
  // GLOBAL KEYBOARD EVENT DRIVER
  // ----------------------------------------------------
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2 or Alt+C -> Focus Customer Search
      if (e.key === 'F2' || (e.altKey && (e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        setShowCustomerDropdown(true);
        customerSearchRef.current?.focus();
        customerSearchRef.current?.select();
        return;
      }

      // F4 -> Toggle Payment Mode
      if (e.key === 'F4') {
        e.preventDefault();
        setPaymentMode(prev => {
          if (prev === 'Cash') return 'UPI';
          if (prev === 'UPI') return 'Credit';
          if (prev === 'Credit') return 'Bank Transfer';
          return 'Cash';
        });
        showToast(`Payment Mode switched!`, 'info');
        return;
      }

      // F9 -> Focus Barcode Scanner
      if (e.key === 'F9') {
        e.preventDefault();
        setShowBarcodeSim(true);
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
        return;
      }

      // F10 or Ctrl+Enter -> Finalize Bill
      if (e.key === 'F10' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        handleTriggerCheckout();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cartItems, customerCreditProfile, selectedRetailerId, paymentMode]);

  // Select Customer and Auto-Focus Product Search
  const handleSelectCustomer = (retailer: Retailer) => {
    setSelectedRetailerId(retailer.id);
    setCustomerSearchQuery(retailer.shop_name);
    setShowCustomerDropdown(false);
    const profile = getCustomerCreditProfile(retailer.id);
    setCustomerCreditProfile(profile);

    // Auto focus Product Search input next
    setTimeout(() => {
      productSearchRef.current?.focus();
      productSearchRef.current?.select();
    }, 50);
  };

  // Select Product and Auto-Fill Defaults
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setProductSearchQuery(prod.name);
    setShowProductDropdown(false);

    const unitsPerPack = prod.units_per_trading_unit || prod.units_per_box_carton || 24;
    const cRate = prod.selling_price;
    const lRate = prod.loose_selling_price || (Math.round((cRate / unitsPerPack) * 100) / 100);

    setEntryCartonQty('1');
    setEntryLooseQty('0');
    setEntryCartonRate(String(cRate));
    setEntryLooseRate(String(lRate));
    setEntryCartonDiscount(String(prod.carton_discount || 0));
    setEntryLooseDiscount(String(prod.loose_discount || 0));

    // Jump focus to Carton Qty
    setTimeout(() => {
      cartonQtyRef.current?.focus();
      cartonQtyRef.current?.select();
    }, 50);
  };

  // Barcode Scan Handler
  const handleBarcodeScanSubmit = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean) return;

    const match = products.find(p => p.barcode === clean || p.product_code.toLowerCase() === clean.toLowerCase() || p.sku.toLowerCase() === clean.toLowerCase());
    if (match) {
      // Auto increment or add item to cart directly
      addItemToCartDirect(match, 1, 0);
      showToast(`Scanned: ${match.name} (+1 ${match.trading_unit})`, 'success');
      setBarcodeInput('');
    } else {
      showToast(`No product found matching barcode: ${clean}`, 'error');
    }
  };

  // Add Item to Cart directly (for barcode scanner)
  const addItemToCartDirect = (prod: Product, cQty: number = 1, lQty: number = 0) => {
    const unitsPerPack = prod.units_per_trading_unit || prod.units_per_box_carton || 24;
    const baseQty = (cQty * unitsPerPack) + lQty;
    const cRate = prod.selling_price;
    const lRate = prod.loose_selling_price || (Math.round((cRate / unitsPerPack) * 100) / 100);
    const cDisc = prod.carton_discount || 0;
    const lDisc = prod.loose_discount || 0;
    const gstPct = prod.gst_percent || 18;

    const taxableVal = (cQty * Math.max(0, cRate - cDisc)) + (lQty * Math.max(0, lRate - lDisc));
    const gstVal = Math.round(taxableVal * (gstPct / 100) * 100) / 100;
    const isLocal = !activeCompany?.state || activeCompany.state.includes('Maharashtra') || activeCompany.state.includes('27');

    const cgst = isLocal ? Math.round((gstVal / 2) * 100) / 100 : 0;
    const sgst = isLocal ? (gstVal - cgst) : 0;
    const igst = isLocal ? 0 : gstVal;
    const totalAmount = taxableVal + gstVal;

    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === prod.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const newCQty = existing.cartonQty + cQty;
        const newLQty = existing.looseQty + lQty;
        const newBase = (newCQty * unitsPerPack) + newLQty;
        const newTaxable = (newCQty * Math.max(0, cRate - cDisc)) + (newLQty * Math.max(0, lRate - lDisc));
        const newGst = Math.round(newTaxable * (gstPct / 100) * 100) / 100;
        const newCgst = isLocal ? Math.round((newGst / 2) * 100) / 100 : 0;
        const newSgst = isLocal ? (newGst - newCgst) : 0;
        const newIgst = isLocal ? 0 : newGst;

        updated[existingIdx] = {
          ...existing,
          cartonQty: newCQty,
          looseQty: newLQty,
          baseQty: newBase,
          taxableValue: newTaxable,
          cgst: newCgst,
          sgst: newSgst,
          igst: newIgst,
          totalAmount: newTaxable + newGst
        };
        return updated;
      } else {
        return [{
          product: prod,
          cartonQty: cQty,
          looseQty: lQty,
          baseQty,
          cartonRate: cRate,
          looseRate: lRate,
          cartonDiscount: cDisc,
          looseDiscount: lDisc,
          mrp: prod.mrp,
          gstPercent: gstPct,
          taxableValue: taxableVal,
          cgst,
          sgst,
          igst,
          totalAmount,
          hsn: prod.hsn,
          packing: prod.pack_size
        }, ...prev];
      }
    });
  };

  // Add Item From Entry Strip to Invoice Grid
  const handleCommitEntryStripItem = () => {
    if (!selectedProduct) {
      showToast('Select a product first!', 'error');
      productSearchRef.current?.focus();
      return;
    }

    const cQty = Math.max(0, parseInt(entryCartonQty) || 0);
    const lQty = Math.max(0, parseInt(entryLooseQty) || 0);
    const unitsPerPack = selectedProduct.units_per_trading_unit || selectedProduct.units_per_box_carton || 24;
    const baseQty = (cQty * unitsPerPack) + lQty;

    if (baseQty <= 0) {
      showToast('Enter quantity > 0', 'error');
      cartonQtyRef.current?.focus();
      return;
    }

    const cRate = parseFloat(entryCartonRate) || selectedProduct.selling_price;
    const lRate = parseFloat(entryLooseRate) || selectedProduct.loose_selling_price || (Math.round((cRate / unitsPerPack) * 100) / 100);
    const cDisc = parseFloat(entryCartonDiscount) || 0;
    const lDisc = parseFloat(entryLooseDiscount) || 0;
    const gstPct = selectedProduct.gst_percent || 18;

    const taxableVal = (cQty * Math.max(0, cRate - cDisc)) + (lQty * Math.max(0, lRate - lDisc));
    const gstVal = Math.round(taxableVal * (gstPct / 100) * 100) / 100;
    const isLocal = true;
    const cgst = isLocal ? Math.round((gstVal / 2) * 100) / 100 : 0;
    const sgst = isLocal ? (gstVal - cgst) : 0;
    const igst = isLocal ? 0 : gstVal;
    const totalAmount = taxableVal + gstVal;

    const newItem: TerminalCartItem = {
      product: selectedProduct,
      cartonQty: cQty,
      looseQty: lQty,
      baseQty,
      cartonRate: cRate,
      looseRate: lRate,
      cartonDiscount: cDisc,
      looseDiscount: lDisc,
      mrp: selectedProduct.mrp,
      gstPercent: gstPct,
      taxableValue: taxableVal,
      cgst,
      sgst,
      igst,
      totalAmount,
      hsn: selectedProduct.hsn,
      packing: selectedProduct.pack_size
    };

    setCartItems(prev => [newItem, ...prev]);

    // Clear entry strip and return cursor back to Product Search
    setSelectedProduct(null);
    setProductSearchQuery('');
    setEntryCartonQty('1');
    setEntryLooseQty('0');
    setEntryCartonDiscount('0');
    setEntryLooseDiscount('0');

    showToast(`Added ${newItem.product.name} to invoice!`, 'success');

    setTimeout(() => {
      productSearchRef.current?.focus();
      productSearchRef.current?.select();
    }, 50);
  };

  // Remove Line Item
  const handleRemoveItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
    showToast('Item removed', 'info');
  };

  // Live Totals Calculations
  const invoiceCalculations = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    cartItems.forEach(item => {
      gross += (item.cartonQty * item.cartonRate) + (item.looseQty * item.looseRate);
      discount += (item.cartonQty * item.cartonDiscount) + (item.looseQty * item.looseDiscount);
      taxable += item.taxableValue;
      cgst += item.cgst;
      sgst += item.sgst;
      igst += item.igst;
    });

    const grandBeforeRound = taxable + cgst + sgst + igst;
    const grandTotal = Math.round(grandBeforeRound);
    const roundOff = Math.round((grandTotal - grandBeforeRound) * 100) / 100;

    return {
      gross,
      discount,
      taxable,
      cgst,
      sgst,
      igst,
      roundOff,
      grandTotal,
      totalItems: cartItems.length,
      totalBaseUnits: cartItems.reduce((s, i) => s + i.baseQty, 0)
    };
  }, [cartItems]);

  // Checkout Execution
  const handleTriggerCheckout = () => {
    if (cartItems.length === 0) {
      showToast('Invoice is empty! Add products first.', 'error');
      productSearchRef.current?.focus();
      return;
    }

    if (!selectedRetailerId) {
      showToast('Select a customer for this bill!', 'error');
      customerSearchRef.current?.focus();
      return;
    }

    const profile = getCustomerCreditProfile(selectedRetailerId);
    setCustomerCreditProfile(profile);

    // Check if Credit Gate Modal is triggered
    if (profile.is_blocked || (profile.total_outstanding + invoiceCalculations.grandTotal > profile.credit_limit)) {
      setIsCreditGateOpen(true);
      return;
    }

    // Direct save if clean credit
    executePostInvoice();
  };

  const handleManagerAuthorized = (auth: ManagerOverrideAuth) => {
    setIsCreditGateOpen(false);
    showToast(`Manager override authorized by ${auth.managerName}`, 'success');
    executePostInvoice(auth);
  };

  const executePostInvoice = (managerAuth?: ManagerOverrideAuth) => {
    try {
      const paid = paymentMode === 'Credit' 
        ? 0 
        : (parseFloat(paidAmountInput) || invoiceCalculations.grandTotal);

      const notes = managerAuth 
        ? `[Manager Override Authorized by ${managerAuth.managerName}: ${managerAuth.reason}] ${invoiceNotes}`
        : invoiceNotes;

      const payload = {
        retailer_id: selectedRetailerId,
        payment_mode: paymentMode,
        paid_amount: paid,
        notes,
        items: cartItems.map(item => ({
          product_id: item.product.id,
          carton_qty: item.cartonQty,
          loose_qty: item.looseQty,
          base_qty: item.baseQty,
          trading_unit: item.product.trading_unit,
          base_unit: item.product.base_unit,
          units_per_trading_unit: item.product.units_per_trading_unit || item.product.units_per_box_carton || 24,
          carton_rate: item.cartonRate,
          loose_rate: item.looseRate,
          carton_discount: item.cartonDiscount,
          loose_discount: item.looseDiscount,
          mrp: item.mrp,
          purchase_rate: item.product.purchase_price,
          gst_percent: item.gstPercent,
          hsn: item.hsn,
          packing: item.packing
        }))
      };

      const result = postSalesInvoiceAtomic(payload);

      if (result.success) {
        setCompletedInvoice(result.invoice);
        setShowPrintModal(true);
        setCartItems([]);
        setInvoiceNotes('');
        setPaidAmountInput('');
        showToast(`Invoice ${result.invoice.invoice_number} posted successfully!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error posting invoice', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-black animate-in fade-in duration-150 ${
          toastMsg.type === 'error' ? 'bg-red-600 text-white' : (toastMsg.type === 'info' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
        }`}>
          {toastMsg.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP HEADER: TERMINAL METRICS & HOTKEY CHEATSHEET */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md font-black">
            <Zap className="w-5 h-5 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white tracking-wide uppercase">Fast Trade Terminal</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE COUNTER
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {activeCompany?.name || 'Saifee General Stores'} &bull; Operator: <strong>{currentUser?.name || 'Admin'}</strong>
            </p>
          </div>
        </div>

        {/* Keyboard Cheatsheet Ribbon */}
        <div className="hidden xl:flex items-center gap-2 text-[11px] font-bold">
          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono">[F2] Customer</span>
          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono">[F4] Pay Mode</span>
          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-mono">[F9] Barcode</span>
          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-300 font-mono">[Enter] Advance Chain</span>
          <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-mono font-black shadow-sm">[F10 / Ctrl+Enter] Bill &amp; Print</span>
        </div>

        {/* Barcode Simulator Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBarcodeSim(!showBarcodeSim)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showBarcodeSim ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Barcode Simulator</span>
          </button>
        </div>
      </div>

      {/* BARCODE SCANNER DRAWER SIMULATOR */}
      {showBarcodeSim && (
        <div className="bg-indigo-950/80 border-b border-indigo-800/80 p-3 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Barcode className="w-5 h-5 text-indigo-400 shrink-0" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeScanSubmit(barcodeInput);
                }
              }}
              placeholder="Scan barcode or type & press Enter..."
              className="w-full bg-slate-900 border border-indigo-500 text-white font-mono text-xs rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Quick Barcode Test Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-bold shrink-0">Click test:</span>
            {[
              { label: 'Parle-G 100g', code: '8901719101017' },
              { label: 'Maggi 70g', code: '8901058821039' },
              { label: 'Lux Soap', code: '8901030753051' },
              { label: 'Aashirvaad 5kg', code: '8901725181225' },
              { label: 'Surf Excel', code: '8901030761124' }
            ].map(pill => (
              <button
                key={pill.code}
                type="button"
                onClick={() => handleBarcodeScanSubmit(pill.code)}
                className="px-2.5 py-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 rounded-md font-bold transition-all shrink-0 cursor-pointer"
              >
                + {pill.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MAIN SCREEN WORKSPACE: SPLIT GRID */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        
        {/* LEFT / CENTER: BILLING OPERATING CANVAS */}
        <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
          
          {/* SECTION 1: CUSTOMER SELECTION & REALTIME CREDIT STRIP */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="relative flex-1">
                  <input
                    ref={customerSearchRef}
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="[F2] Search Retailer / Customer (Name, Shop, Code)..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearchQuery('');
                        setShowCustomerDropdown(true);
                        customerSearchRef.current?.focus();
                      }}
                      className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Dropdown Results */}
              {showCustomerDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-800">
                  {filteredCustomers.map(r => (
                    <div
                      key={r.id}
                      onClick={() => handleSelectCustomer(r)}
                      className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div>
                        <div className="font-bold text-white">{r.shop_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {r.owner_name} &bull; Code: {r.retailer_code} &bull; {r.mobile}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-amber-400">Outstanding: {formatINR(r.outstanding)}</div>
                        <div className="text-[10px] text-slate-400">Limit: {formatINR(r.credit_limit)}</div>
                      </div>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-500">No matching customer found</div>
                  )}
                </div>
              )}
            </div>

            {/* Realtime Credit & Ageing Pills */}
            {customerCreditProfile && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <div className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 block uppercase">Credit Limit</span>
                  <span className="font-bold text-white font-mono">{formatINR(customerCreditProfile.credit_limit)}</span>
                </div>

                <div className={`px-2.5 py-1 rounded-lg border ${
                  customerCreditProfile.is_limit_exceeded ? 'bg-red-950/80 border-red-500 text-red-300' : 'bg-slate-950 border-slate-800 text-white'
                }`}>
                  <span className="text-[10px] text-slate-400 block uppercase">Current Outstanding</span>
                  <span className="font-black font-mono">{formatINR(customerCreditProfile.total_outstanding)}</span>
                </div>

                <div className={`px-2.5 py-1 rounded-lg border ${
                  customerCreditProfile.has_overdue_invoices ? 'bg-amber-950/80 border-amber-500 text-amber-300' : 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                }`}>
                  <span className="text-[10px] text-slate-400 block uppercase">Overdue Ageing</span>
                  <span className="font-bold font-mono">
                    {customerCreditProfile.oldest_unpaid_days > 0 ? `${customerCreditProfile.oldest_unpaid_days} Days Old` : '0 Days (Clean)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: FAST ITEM ENTRY STRIP (THE RAPID AUTOFOCUS CHAIN) */}
          <div className="p-3 bg-slate-900 border-b border-slate-800">
            <div className="grid grid-cols-12 gap-2 items-end">
              
              {/* Product Lookup Input */}
              <div className="col-span-12 md:col-span-5 relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  1. Product Search / SKU / Barcode [Enter]
                </label>
                <div className="relative">
                  <input
                    ref={productSearchRef}
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                      setHighlightedProductIndex(0);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onKeyDown={(e) => {
                      if (showProductDropdown && filteredProducts.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedProductIndex(prev => Math.min(filteredProducts.length - 1, prev + 1));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedProductIndex(prev => Math.max(0, prev - 1));
                          return;
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectProduct(filteredProducts[highlightedProductIndex]);
                          return;
                        }
                      }
                      if (e.key === 'Enter' && selectedProduct) {
                        e.preventDefault();
                        cartonQtyRef.current?.focus();
                        cartonQtyRef.current?.select();
                      }
                    }}
                    placeholder="Type name, brand, or scan barcode..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white rounded-lg px-3 py-2 text-xs font-bold outline-none"
                  />
                  {selectedProduct && (
                    <span className="absolute right-2 top-2 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {selectedProduct.pack_size}
                    </span>
                  )}
                </div>

                {/* Product Dropdown Results */}
                {showProductDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-800">
                    {filteredProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className={`p-2.5 cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors ${
                          idx === highlightedProductIndex ? 'bg-indigo-950/80 border-l-4 border-indigo-400' : 'hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {p.pack_size} &bull; MRP: ₹{p.mrp} &bull; {p.brand}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-400">₹{p.selling_price}/{p.trading_unit}</div>
                          <div className="text-[10px] text-slate-400">Loose: ₹{p.loose_selling_price || (p.selling_price / (p.units_per_trading_unit || 24)).toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-500">No product found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Carton / Case Qty Input */}
              <div className="col-span-6 md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  2. {selectedProduct?.trading_unit || 'Carton'}s [Enter]
                </label>
                <input
                  ref={cartonQtyRef}
                  type="number"
                  min="0"
                  value={entryCartonQty}
                  onChange={(e) => setEntryCartonQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      looseQtyRef.current?.focus();
                      looseQtyRef.current?.select();
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white rounded-lg p-2 text-xs font-black text-center outline-none font-mono"
                />
              </div>

              {/* Loose Qty Input */}
              <div className="col-span-6 md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  3. Loose ({selectedProduct?.base_unit || 'Pieces'}) [Enter]
                </label>
                <input
                  ref={looseQtyRef}
                  type="number"
                  min="0"
                  value={entryLooseQty}
                  onChange={(e) => setEntryLooseQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      discountRef.current?.focus();
                      discountRef.current?.select();
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white rounded-lg p-2 text-xs font-black text-center outline-none font-mono"
                />
              </div>

              {/* Flat Discount Input */}
              <div className="col-span-8 md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  4. Disc/Ctn (₹) [Enter]
                </label>
                <input
                  ref={discountRef}
                  type="number"
                  min="0"
                  value={entryCartonDiscount}
                  onChange={(e) => setEntryCartonDiscount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCommitEntryStripItem();
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white rounded-lg p-2 text-xs font-black text-center outline-none font-mono"
                />
              </div>

              {/* Append Item Button */}
              <div className="col-span-4 md:col-span-1">
                <button
                  type="button"
                  onClick={handleCommitEntryStripItem}
                  className="w-full h-[38px] bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
                  title="Add item to invoice grid (Enter)"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

            </div>

            {/* Calculated Packaging Summary Badge */}
            {selectedProduct && (
              <div className="mt-2 text-[11px] font-bold text-indigo-300 flex items-center gap-2">
                <span>Total Calculated Base Units:</span>
                <span className="px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700 text-indigo-100 font-mono">
                  {((parseInt(entryCartonQty) || 0) * (selectedProduct.units_per_trading_unit || selectedProduct.units_per_box_carton || 24)) + (parseInt(entryLooseQty) || 0)} {selectedProduct.base_unit || 'Pieces'} Total
                </span>
                <span className="text-slate-400 font-normal">
                  ({selectedProduct.units_per_trading_unit || 24} {selectedProduct.base_unit || 'Pieces'} / {selectedProduct.trading_unit})
                </span>
              </div>
            )}
          </div>

          {/* SECTION 3: INVOICE LINE ITEMS GRID (HIGH DENSITY TABLE) */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="p-2.5 w-8 text-center">#</th>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5 text-center">Cartons</th>
                  <th className="p-2.5 text-center">Loose</th>
                  <th className="p-2.5 text-center">Total Base Units</th>
                  <th className="p-2.5 text-right">Ctn Rate</th>
                  <th className="p-2.5 text-right">Loose Rate</th>
                  <th className="p-2.5 text-right">Disc.</th>
                  <th className="p-2.5 text-right">Taxable</th>
                  <th className="p-2.5 text-right">GST</th>
                  <th className="p-2.5 text-right font-black text-white">Line Total</th>
                  <th className="p-2.5 w-10 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {cartItems.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-900/70 transition-colors">
                    <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">{index + 1}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-white text-xs">{item.product.name}</div>
                      <div className="text-[10px] text-slate-400">
                        HSN: {item.hsn} &bull; MRP: ₹{item.mrp}
                      </div>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-amber-300">
                      {item.cartonQty} {item.product.trading_unit}s
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-cyan-300">
                      {item.looseQty} {item.product.base_unit}s
                    </td>
                    <td className="p-2.5 text-center font-mono font-black text-emerald-400 bg-slate-900/50">
                      {item.baseQty} {item.product.base_unit}s
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-300">₹{item.cartonRate.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-400">₹{item.looseRate.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-amber-400">
                      {item.cartonDiscount > 0 ? `-₹${item.cartonDiscount}` : '—'}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-300">₹{item.taxableValue.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-400">
                      ₹{(item.cgst + item.sgst + item.igst).toFixed(2)} ({item.gstPercent}%)
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-emerald-300 text-sm">
                      {formatINR(item.totalAmount)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/60 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {cartItems.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-slate-500 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">Counter Invoice Cart is Empty</p>
                      <p className="text-xs text-slate-600">Search products above or scan barcode to start adding line items.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* RIGHT PANEL: PAYMENT SUMMARY & INSTANT CHECKOUT */}
        <div className="w-full xl:w-96 bg-slate-900 flex flex-col justify-between border-t xl:border-t-0 border-slate-800 flex-shrink-0">
          
          {/* Summary Details */}
          <div className="p-4 space-y-4 overflow-y-auto">
            
            {/* Header Title */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Bill Summary
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                {invoiceCalculations.totalItems} Items ({invoiceCalculations.totalBaseUnits} Units)
              </span>
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 text-xs font-medium text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal (Gross)</span>
                <span className="font-mono text-white font-bold">{formatINR(invoiceCalculations.gross)}</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Total Discount</span>
                <span className="font-mono font-bold">- {formatINR(invoiceCalculations.discount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span>Taxable Value</span>
                <span className="font-mono text-white font-bold">{formatINR(invoiceCalculations.taxable)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>CGST (Central Tax)</span>
                <span className="font-mono">{formatINR(invoiceCalculations.cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>SGST (State Tax)</span>
                <span className="font-mono">{formatINR(invoiceCalculations.sgst)}</span>
              </div>
              {invoiceCalculations.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off</span>
                  <span className="font-mono">{invoiceCalculations.roundOff > 0 ? `+${invoiceCalculations.roundOff}` : invoiceCalculations.roundOff}</span>
                </div>
              )}
            </div>

            {/* Big Grand Total Card */}
            <div className="p-4 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border-2 border-emerald-500/50 rounded-2xl shadow-xl space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">Grand Total Payable</div>
              <div className="text-3xl font-black font-mono text-white tracking-tight">
                {formatINR(invoiceCalculations.grandTotal)}
              </div>
            </div>

            {/* Payment Mode Selector [F4] */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Payment Mode [F4]</span>
                <span className="text-cyan-400 font-mono">Selected: {paymentMode}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['Cash', 'UPI', 'Credit', 'Bank Transfer'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMode === mode 
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {mode === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                    {mode === 'UPI' && <QrCode className="w-3.5 h-3.5" />}
                    {mode === 'Credit' && <CreditCard className="w-3.5 h-3.5" />}
                    {mode === 'Bank Transfer' && <DollarSign className="w-3.5 h-3.5" />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Paid Amount Input for Cash/UPI */}
            {paymentMode !== 'Credit' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cash Collected / Received (₹)
                </label>
                <input
                  type="number"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  placeholder={`Full Total (${invoiceCalculations.grandTotal})`}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 text-white rounded-lg p-2 text-xs font-mono font-bold outline-none"
                />
              </div>
            )}

            {/* Optional Remarks */}
            <div>
              <input
                type="text"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Bill notes / Po Number / Vehicle #..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-600 text-white rounded-lg p-2 text-xs outline-none"
              />
            </div>

          </div>

          {/* Action Footer Button */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleTriggerCheckout}
              disabled={cartItems.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>POST &amp; PRINT BILL [F10]</span>
            </button>
          </div>

        </div>

      </div>

      {/* MODAL 1: CREDIT CONTROL & OVERDUE AGEING GATEKEEPER */}
      {customerCreditProfile && (
        <CreditCheckGateModal
          isOpen={isCreditGateOpen}
          onClose={() => setIsCreditGateOpen(false)}
          onAuthorize={handleManagerAuthorized}
          creditProfile={customerCreditProfile}
          cartTotal={invoiceCalculations.grandTotal}
        />
      )}

      {/* MODAL 2: PRINT & GST INVOICE PREVIEW MODAL */}
      {showPrintModal && completedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black">Invoice #{completedInvoice.invoice_number} Generated</h3>
                  <p className="text-[11px] text-slate-400">Grand Total: {formatINR(completedInvoice.grand_total)} &bull; {completedInvoice.payment_mode}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Preview Body */}
            <div id="printable-terminal-invoice" className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="border-b pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                    {activeCompany?.name || 'SAIFEE GENERAL STORES'}
                  </h2>
                  <p className="text-slate-600 font-medium">FMCG Wholesalers &amp; Distributors</p>
                  <p className="text-slate-500 text-[11px]">{activeCompany?.address || 'Shop 12-14, Wholesale Market'}, {activeCompany?.city || 'Mumbai'}</p>
                  <p className="text-slate-500 text-[11px]">GSTIN: <strong>{activeCompany?.gstin || '27AABCS1429B1ZB'}</strong></p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-indigo-700 uppercase">Tax Invoice (GST)</div>
                  <div className="text-sm font-mono font-black text-slate-900 mt-1">{completedInvoice.invoice_number}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">{new Date(completedInvoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              {/* Bill To */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billed To Customer</div>
                <div className="retailer-name-print text-sm sm:text-base font-black text-slate-950 print:text-[11pt] uppercase tracking-tight">
                  {retailers.find(r => r.id === completedInvoice.retailer_id)?.shop_name}
                </div>
                <div className="text-slate-600 text-xs">
                  {retailers.find(r => r.id === completedInvoice.retailer_id)?.address}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border border-slate-200 text-xs">
                <thead className="bg-slate-100 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Quantity (Pcs)</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Taxable</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {completedInvoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{products.find(p => p.id === item.product_id)?.name || item.packing || 'Product'}</td>
                      <td className="p-2 text-center font-mono">{item.base_qty || item.quantity || ((item.carton_qty || 0) * (item.units_per_trading_unit || 1) + (item.loose_qty || 0))} Pcs</td>
                      <td className="p-2 text-right font-mono">₹{item.rate}</td>
                      <td className="p-2 text-right font-mono">₹{item.taxable_value.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">₹{item.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Invoice Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1 text-xs font-medium">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-bold">{formatINR(completedInvoice.taxable_value)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST + SGST:</span>
                    <span className="font-mono font-bold">{formatINR(completedInvoice.cgst + completedInvoice.sgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1 text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-emerald-700">{formatINR(completedInvoice.grand_total)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center no-print">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close (Esc)
              </button>
              <button
                onClick={() => printInvoiceDocument('printable-terminal-invoice', `Tax Invoice - ${completedInvoice.invoice_number}`)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice / Thermal Slip</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
