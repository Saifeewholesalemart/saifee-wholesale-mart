'use client';

import React, { useState, useEffect } from 'react';
import { useDb, SalespersonCartItem } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, Plus, Minus, User, History, ArrowRight, RotateCcw, Package, Check, X, ShieldAlert, CheckCircle, Percent, Store, Sparkles } from 'lucide-react';
import { Product, Retailer, Order, formatQuantityDisplay, splitBaseQuantity, calculateItemAmounts, PendingOrderItemWarning, getProductTradeMode } from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import SmartSearchBar from '@/components/SmartSearchBar';
import AddRetailerModal from '@/components/AddRetailerModal';
import PendingItemWarningCard, { CartPendingSummaryBanner } from '@/components/orders/PendingItemWarningCard';

export default function SalesDashboard() {
  const { 
    currentUser, setCurrentUser, products, batches, retailers, orders, placeOrder, inventory, profiles,
    salespersonCart: cart, setSalespersonCart: setCart,
    categories, getCategoriesForProduct,
    getAssignedCategoriesForSalesperson, getAssignedCategoriesForRetailer,
    isProductVisibleToSalesperson, isProductVisibleToRetailer,
    getPendingItemsForRetailer, logPendingOrderProceedActivity
  } = useDb();
  
  const router = useRouter();

  // Auto-switch to salesperson persona if not already set
  useEffect(() => {
    if (currentUser && currentUser.role !== 'sales_dist' && currentUser.role !== 'sales_co') {
      const salesProfile = profiles.find(p => p.role === 'sales_dist' || p.role === 'sales_co');
      if (salesProfile) {
        setCurrentUser(salesProfile.id);
      }
    }
  }, [currentUser, profiles, setCurrentUser]);

  // View States
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [orderStep, setOrderStep] = useState<'retailer' | 'catalog' | 'cart' | 'confirm' | 'success'>('retailer');
  
  // Selection States
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [retailerSearch, setRetailerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProductMrp, setSelectedProductMrp] = useState<{ [productId: string]: number }>({});

  // Success Message
  const [latestOrderNum, setLatestOrderNum] = useState('');
  const [rateHistoryProduct, setRateHistoryProduct] = useState<Product | null>(null);

  // New Retailer Registration Modal State
  const [addRetailerModalOpen, setAddRetailerModalOpen] = useState(false);
  const [salesToast, setSalesToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // 1. Target Retailer object
  const selectedRetailer = retailers.find(r => r.id === selectedRetailerId);

  // 2. Filter Retailers based on search
  const filteredRetailers = retailers.filter(r => 
    retailerSearch.trim() === '' ||
    (r.shop_name || '').toLowerCase().includes(retailerSearch.toLowerCase()) ||
    (r.owner_name || '').toLowerCase().includes(retailerSearch.toLowerCase()) ||
    (r.retailer_code || '').toLowerCase().includes(retailerSearch.toLowerCase()) ||
    (r.city || '').toLowerCase().includes(retailerSearch.toLowerCase())
  );

  // 3. Filter products & categories based on salesperson category assignment
  const isCompanySalesperson = currentUser?.role === 'sales_co';
  const companyIdFilter = currentUser?.company_id;

  const assignedCategories = currentUser 
    ? getAssignedCategoriesForSalesperson(currentUser.id)
    : categories.filter(c => c.active);

  const categoriesList = assignedCategories.length > 0
    ? ['All', ...assignedCategories.map(c => c.name)]
    : ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    // Salesperson category assignment check
    if (currentUser && !isProductVisibleToSalesperson(p.id, currentUser.id)) {
      return false;
    }

    // Retailer category assignment check if retailer is selected
    if (selectedRetailer && !isProductVisibleToRetailer(p.id, selectedRetailer.id)) {
      return false;
    }

    const matchCompany = !isCompanySalesperson || p.company_id === companyIdFilter;
    if (!matchCompany) return false;

    let matchCat = selectedCategory === 'All';
    if (!matchCat) {
      const prodCats = getCategoriesForProduct(p.id);
      if (prodCats.length > 0) {
        matchCat = prodCats.some(c => c.active && c.name === selectedCategory);
      } else {
        matchCat = p.category === selectedCategory;
      }
    }
    if (!matchCat) return false;

    const matchSearch = productSearch.trim() === '' ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.product_code.toLowerCase().includes(productSearch.toLowerCase());
    return matchSearch;
  });

  const getProductMrpLots = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    const prodBatches = batches.filter(b => b.product_id === productId && b.quantity > 0);
    if (prodBatches.length === 0) {
      return [{
        mrp: prod?.mrp || 0,
        selling_price: prod?.selling_price || 0,
        purchase_rate: prod?.purchase_price || 0,
        available_qty: 0
      }];
    }

    const mrpMap: { [mrp: number]: { mrp: number; selling_price: number; purchase_rate: number; available_qty: number } } = {};
    prodBatches.forEach(b => {
      if (!mrpMap[b.mrp]) {
        mrpMap[b.mrp] = {
          mrp: b.mrp,
          selling_price: b.selling_price || prod?.selling_price || 0,
          purchase_rate: b.purchase_rate,
          available_qty: 0
        };
      }
      mrpMap[b.mrp].available_qty += b.quantity;
    });

    return Object.values(mrpMap).sort((a, b) => a.mrp - b.mrp);
  };

  const getCartItem = (cartKey: string): SalespersonCartItem => {
    const [prodId] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
    const prod = products.find(p => p.id === prodId);
    const defaultCartonDisc = prod?.carton_discount ?? 0;
    const defaultLooseDisc = prod?.loose_discount ?? 0;

    const raw = cart[cartKey];
    if (!raw) return { cartonQty: 0, looseQty: 0, cartonDiscount: defaultCartonDisc, looseDiscount: defaultLooseDisc };
    return {
      cartonQty: Number(raw.cartonQty ?? raw.quantity ?? 0),
      looseQty: Number(raw.looseQty ?? 0),
      cartonDiscount: raw.cartonDiscount !== undefined ? Number(raw.cartonDiscount) : (raw.discount !== undefined ? Number(raw.discount) : defaultCartonDisc),
      looseDiscount: raw.looseDiscount !== undefined ? Number(raw.looseDiscount) : defaultLooseDisc
    };
  };

  const handleUpdateQty = (cartKey: string, type: 'carton' | 'loose', delta: number) => {
    const current = getCartItem(cartKey);
    const newCarton = type === 'carton' ? Math.max(0, current.cartonQty + delta) : current.cartonQty;
    const newLoose = type === 'loose' ? Math.max(0, current.looseQty + delta) : current.looseQty;

    const updated = { ...cart };
    if (newCarton === 0 && newLoose === 0) {
      delete updated[cartKey];
    } else {
      updated[cartKey] = {
        ...current,
        cartonQty: newCarton,
        looseQty: newLoose
      };
    }
    setCart(updated);
  };

  const handleSetQty = (cartKey: string, type: 'carton' | 'loose', val: number) => {
    const current = getCartItem(cartKey);
    const validVal = Math.max(0, Math.floor(val || 0));
    const newCarton = type === 'carton' ? validVal : current.cartonQty;
    const newLoose = type === 'loose' ? validVal : current.looseQty;

    const updated = { ...cart };
    if (newCarton === 0 && newLoose === 0) {
      delete updated[cartKey];
    } else {
      updated[cartKey] = {
        ...current,
        cartonQty: newCarton,
        looseQty: newLoose
      };
    }
    setCart(updated);
  };

  const handleUpdateDiscount = (cartKey: string, type: 'carton' | 'loose', disc: number) => {
    const current = getCartItem(cartKey);
    const updated = { ...cart };
    updated[cartKey] = {
      ...current,
      [type === 'carton' ? 'cartonDiscount' : 'looseDiscount']: Math.max(0, disc)
    };
    setCart(updated);
  };

  // Cart aggregate metrics
  const cartItemKeys = Object.keys(cart).filter(k => {
    const it = getCartItem(k);
    return it.cartonQty > 0 || it.looseQty > 0;
  });
  const cartTotalItemCount = cartItemKeys.length;
  
  const getCartTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    let gstTotal = 0;

    cartItemKeys.forEach(cartKey => {
      const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
      const prod = products.find(p => p.id === prodId);
      if (!prod) return;

      const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
      const lots = getProductMrpLots(prodId);
      const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price, purchase_rate: prod.purchase_price };
      const cartonRate = lot.selling_price || prod.selling_price;
      const unitsPerPack = prod.units_per_box_carton || 1;
      const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
        ? prod.loose_selling_price
        : (cartonRate / unitsPerPack);

      const cItem = getCartItem(cartKey);
      const amounts = calculateItemAmounts(
        cItem.cartonQty,
        cItem.looseQty,
        cartonRate,
        looseRate,
        cItem.cartonDiscount,
        cItem.looseDiscount,
        prod.gst_percent
      );

      subtotal += amounts.grossAmount;
      discountTotal += amounts.discountAmount;
      gstTotal += amounts.gstAmount;
    });

    const grand = Math.round(subtotal - discountTotal + gstTotal);
    return { subtotal, discountTotal, gstTotal, grand };
  };

  const { subtotal, discountTotal, gstTotal, grand } = getCartTotals();

  // Dynamic Pending Order Warnings check
  const currentCartToCheck = cartItemKeys.map(cartKey => {
    const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
    const prod = products.find(p => p.id === prodId);
    const targetMrp = mrpPart ? parseFloat(mrpPart) : prod?.mrp;
    const cItem = getCartItem(cartKey);
    return {
      productId: prodId,
      cartonQty: cItem.cartonQty,
      looseQty: cItem.looseQty,
      packSize: prod?.pack_size,
      selectedMrp: targetMrp
    };
  });

  const cartPendingWarnings = selectedRetailer
    ? getPendingItemsForRetailer(selectedRetailer.id, currentCartToCheck)
    : [];

  const handlePlaceOrder = () => {
    if (!selectedRetailer) return;

    const items = cartItemKeys.map(cartKey => {
      const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
      const prod = products.find(p => p.id === prodId)!;
      const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
      const lots = getProductMrpLots(prodId);
      const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price, purchase_rate: prod.purchase_price };
      const cItem = getCartItem(cartKey);

      const unitsPerPack = prod.units_per_box_carton || 1;
      const cartonRate = lot.selling_price || prod.selling_price;
      const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
        ? prod.loose_selling_price
        : (cartonRate / unitsPerPack);

      const baseQty = (cItem.cartonQty * unitsPerPack) + cItem.looseQty;
      const amounts = calculateItemAmounts(
        cItem.cartonQty,
        cItem.looseQty,
        cartonRate,
        looseRate,
        cItem.cartonDiscount,
        cItem.looseDiscount,
        prod.gst_percent
      );

      return {
        id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        order_id: '',
        product_id: prodId,
        selected_mrp: targetMrp,
        purchase_rate: lot.purchase_rate,
        quantity: baseQty,
        carton_qty: cItem.cartonQty,
        loose_qty: cItem.looseQty,
        base_qty: baseQty,
        trading_unit: prod.trading_unit,
        base_unit: prod.base_unit || 'Piece',
        units_per_box_carton: unitsPerPack,
        carton_rate: cartonRate,
        loose_rate: looseRate,
        carton_discount: cItem.cartonDiscount,
        loose_discount: cItem.looseDiscount,
        base_price: cartonRate,
        discount: cItem.cartonDiscount,
        discount_amount: amounts.discountAmount,
        final_price: amounts.finalRate,
        gst_percent: prod.gst_percent,
        gst_amount: amounts.gstAmount,
        total_amount: amounts.netTotal
      };
    });

    const ord = placeOrder({
      retailer_id: selectedRetailer.id,
      source: currentUser.role === 'sales_dist' ? 'distributor_salesperson' : 'company_salesperson',
      channel: currentUser.role === 'sales_co' ? 'Company Salesperson' : 'Distributor Salesperson',
      created_by: currentUser.id,
      total_amount: grand,
      items
    });

    // Record activity log if placed with pending item warnings
    if (cartPendingWarnings.length > 0) {
      logPendingOrderProceedActivity(selectedRetailer.id, cartPendingWarnings, ord.order_number);
    }

    setLatestOrderNum(ord.order_number);
    setCart({});
    setOrderStep('success');
  };

  const handleRepeatOrder = (pastOrder: Order) => {
    const repeatedCart: typeof cart = {};
    pastOrder.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (prod && (!isCompanySalesperson || prod.company_id === companyIdFilter)) {
        const k = item.selected_mrp ? `${item.product_id}__mrp_${item.selected_mrp}` : item.product_id;
        const unitsPerPack = item.units_per_box_carton || prod.units_per_box_carton || 1;

        let cQty = item.carton_qty != null ? item.carton_qty : 0;
        let lQty = item.loose_qty != null ? item.loose_qty : 0;
        if (cQty === 0 && lQty === 0 && (item.base_qty || item.quantity)) {
          const split = splitBaseQuantity(item.base_qty || item.quantity, unitsPerPack);
          cQty = split.cartonQty;
          lQty = split.looseQty;
        }

        repeatedCart[k] = {
          cartonQty: cQty,
          looseQty: lQty,
          cartonDiscount: item.carton_discount ?? item.discount ?? 0,
          looseDiscount: item.loose_discount ?? 0
        };
      }
    });
    setCart(repeatedCart);
    setSelectedRetailerId(pastOrder.retailer_id);
    setOrderStep('cart');
    setActiveTab('order');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter orders placed by this salesperson
  const salesHistory = orders
    .filter(o => o.created_by === currentUser?.id)
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 relative pb-20">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-900 text-white shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black leading-none">{currentUser?.name.split(' ')[0]} (Sales)</h1>
            <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider block mt-0.5">
              {currentUser?.role === 'sales_dist' ? 'Distributor Agent' : 'Company Agent'}
            </span>
          </div>
        </div>
        <button 
          onClick={() => {
            setCurrentUser('p-admin-1'); // Switch back to admin/default
            router.push('/');
          }} 
          className="text-xs text-slate-300 font-bold border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-800 cursor-pointer"
        >
          LOGOUT
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
        
        {/* Toggle between Take Order and Order History */}
        {orderStep !== 'success' && (
          <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white text-xs font-semibold shadow-xs flex-shrink-0">
            <button
              onClick={() => setActiveTab('order')}
              className={`flex-1 py-2.5 text-center border-r border-slate-200 transition-colors cursor-pointer ${
                activeTab === 'order' ? 'bg-cyan-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              Take Order
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
                activeTab === 'history' ? 'bg-cyan-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              Order Book ({salesHistory.length})
            </button>
          </div>
        )}

        {/* ========================================================
            TAB 1: TAKE ORDER (STEPS)
            ======================================================== */}
        {activeTab === 'order' && (
          <div className="space-y-4">
            
            {/* STEP 1: SELECT RETAILER */}
            {orderStep === 'retailer' && (
              <div className="space-y-4">
                <div className="erp-card bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-4 h-4 text-cyan-600" />
                      <span>Select Retailer Shop</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAddRetailerModalOpen(true)}
                      className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Register New Shop</span>
                    </button>
                  </div>
                  
                  <SmartSearchBar
                    value={retailerSearch}
                    onChange={setRetailerSearch}
                    placeholder="Search shop name, code, owner, city..."
                    entityFilter={['retailer']}
                    size="sm"
                  />
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredRetailers.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">No matching shop found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Is this a new store on your field route?</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddRetailerModalOpen(true)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register This Shop Now</span>
                      </button>
                    </div>
                  ) : (
                    filteredRetailers.map(r => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRetailerId(r.id);
                          setOrderStep('catalog');
                        }}
                        className="w-full text-left p-3.5 bg-white border border-slate-150 hover:border-cyan-300 hover:bg-cyan-50/15 rounded-xl shadow-xs transition-all flex flex-col gap-1.5 cursor-pointer group"
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-extrabold text-slate-900 text-sm group-hover:text-cyan-800 transition-colors">{r.shop_name}</span>
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">{r.retailer_code}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 font-medium w-full">
                          <span>Owner: {r.owner_name} &bull; <strong className="text-slate-700">{r.city}</strong></span>
                          <span>Outstanding: <strong className={r.outstanding > 0 ? 'text-red-500 font-bold' : 'text-slate-600'}>₹{r.outstanding.toLocaleString()}</strong></span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: CATALOGUE ORDER TAKING */}
            {orderStep === 'catalog' && selectedRetailer && (
              <div className="space-y-4">
                
                {/* Active Retailer Bar */}
                <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">Target Customer</span>
                    <span className="text-sm font-black leading-normal block">{selectedRetailer.shop_name}</span>
                    <span className="text-xs text-slate-300 font-medium">{selectedRetailer.city} &bull; Outstanding: ₹{selectedRetailer.outstanding.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => setOrderStep('retailer')}
                    className="px-2.5 py-1 border border-slate-700 rounded text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    Change Shop
                  </button>
                </div>

                {/* Filters Row */}
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <SmartSearchBar
                      value={productSearch}
                      onChange={setProductSearch}
                      placeholder="Search catalog products..."
                      entityFilter={['product', 'category']}
                      size="sm"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-slate-200 bg-white rounded-lg p-2 text-xs font-semibold text-slate-600 outline-none"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Catalogue Grid */}
                <div className="space-y-3">
                  {filteredProducts.map(p => {
                    const lots = getProductMrpLots(p.id);
                    const activeMrp = selectedProductMrp[p.id] || lots[0]?.mrp || p.mrp;
                    const activeLot = lots.find(l => l.mrp === activeMrp) || lots[0] || {
                      mrp: p.mrp,
                      selling_price: p.selling_price,
                      purchase_rate: p.purchase_price,
                      available_qty: 0
                    };
                    const cartKey = `${p.id}__mrp_${activeMrp}`;
                    const cItem = getCartItem(cartKey);
                    const unitsPerPack = p.units_per_box_carton || 1;
                    const cartonRate = activeLot.selling_price || p.selling_price;
                    const looseRate = p.loose_price_mode === 'manual' && p.loose_selling_price != null
                      ? p.loose_selling_price
                      : (cartonRate / unitsPerPack);
                    
                    const tradeModeInfo = getProductTradeMode(p);
                    const allowCarton = tradeModeInfo.allowCarton;
                    const allowPieces = tradeModeInfo.allowPieces;
                    const isCartonOnly = allowCarton && !allowPieces;
                    const isPieceOnly = !allowCarton && allowPieces;
                    const isBoth = allowCarton && allowPieces;
                    
                    const stock = activeLot.available_qty;
                    const hasCart = cItem.cartonQty > 0 || cItem.looseQty > 0;
                    
                    return (
                      <div key={p.id} className="erp-card bg-white p-4 space-y-3 shadow-xs border-slate-150 relative">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">{p.brand}</span>
                              {isCartonOnly && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-xs font-bold">
                                  {p.trading_unit || 'Carton'} Only
                                </span>
                              )}
                              {isPieceOnly && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-bold">
                                  {p.base_unit || 'Pieces'} Only
                                </span>
                              )}
                              {isBoth && (
                                <span className="px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-300 rounded text-xs font-bold">
                                  Carton &amp; Pieces
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <h4 className="font-extrabold text-slate-900 text-sm block leading-tight truncate">{p.name}</h4>
                              <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                MRP ₹{activeMrp || p.mrp}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block mt-0.5 font-medium">
                              Packing: <strong className="text-slate-700 font-bold">{isPieceOnly ? `1 ${p.base_unit || 'Piece'}` : (p.pack_size || `${unitsPerPack} ${p.base_unit || 'Pcs'}/${p.trading_unit || 'Box'}`)}</strong>
                            </span>
                            
                            {lots.length > 1 ? (
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-600 mr-1">Stock Lots:</span>
                                {lots.map(l => (
                                  <button
                                    key={l.mrp}
                                    type="button"
                                    onClick={() => setSelectedProductMrp(prev => ({ ...prev, [p.id]: l.mrp }))}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer border ${
                                      activeMrp === l.mrp
                                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    MRP ₹{l.mrp} ({formatQuantityDisplay(l.available_qty, unitsPerPack, p.trading_unit, p.base_unit)})
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-600">Printed MRP: <strong className="text-slate-800">₹{activeLot.mrp}</strong></span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setRateHistoryProduct(p)}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-900 font-bold hover:underline cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5 text-cyan-600" />
                              <span>View Last 5 Billing Rates</span>
                            </button>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            {allowCarton && (
                              <div>
                                <span className="text-sm font-black text-slate-900 block">₹{cartonRate.toFixed(2)}/{p.trading_unit}</span>
                                {p.carton_discount ? (
                                  <span className="text-[11px] font-bold text-emerald-600 block">
                                    ₹{(cartonRate - p.carton_discount).toFixed(2)} net (-₹{p.carton_discount} disc)
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {allowPieces && (
                              <div>
                                <span className={`text-xs font-bold text-emerald-700 block ${allowCarton ? 'mt-0.5' : 'text-sm font-black text-slate-900'}`}>
                                  ₹{looseRate.toFixed(2)}/{p.base_unit || 'Pc'}
                                </span>
                                {isPieceOnly && p.loose_discount ? (
                                  <span className="text-[11px] font-bold text-emerald-600 block">
                                    ₹{(looseRate - p.loose_discount).toFixed(2)} net (-₹{p.loose_discount} disc)
                                  </span>
                                ) : null}
                              </div>
                            )}
                            <span className={`text-xs font-bold block mt-1 ${stock > 0 ? 'text-slate-600' : 'text-red-500'}`}>
                              {stock > 0 ? formatQuantityDisplay(stock, unitsPerPack, p.trading_unit, p.base_unit) : 'Out of Stock'}
                            </span>
                          </div>
                        </div>

                        {/* Dual Steppers & Discount Inputs with Direct Numeric Entry */}
                        <div className="border-t border-slate-100 pt-2.5 space-y-2">
                          {/* Cartons row - Only display if allowCarton */}
                          {allowCarton && (
                            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-150">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 uppercase">{p.trading_unit}s:</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(cartKey, 'carton', -1)}
                                    className="w-6 h-6 bg-white hover:bg-slate-200 border border-slate-200 rounded flex items-center justify-center text-slate-700 font-bold cursor-pointer"
                                    title="Decrease 1 carton"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={cItem.cartonQty || ''}
                                    onChange={(e) => handleSetQty(cartKey, 'carton', parseInt(e.target.value) || 0)}
                                    className="w-12 border border-slate-300 bg-white rounded text-center py-0.5 font-black text-xs text-cyan-700 focus:border-cyan-500 focus:outline-none"
                                    title="Type carton quantity directly"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(cartKey, 'carton', 1)}
                                    className="w-6 h-6 bg-cyan-600 text-white hover:bg-cyan-700 rounded flex items-center justify-center font-bold cursor-pointer"
                                    title="Increase 1 carton"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {cItem.cartonQty > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-slate-600">Disc (₹/{p.trading_unit}):</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={cItem.cartonDiscount || ''}
                                    onChange={(e) => handleUpdateDiscount(cartKey, 'carton', parseFloat(e.target.value) || 0)}
                                    className="w-14 border border-slate-250 bg-white rounded text-center py-0.5 font-bold text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Loose Pieces row - Only display if allowPieces */}
                          {allowPieces && (
                            <div className="flex items-center justify-between gap-2 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-800 uppercase">{isPieceOnly ? (p.base_unit || 'Pieces') : `Loose (${p.base_unit || 'Pc'}):`}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(cartKey, 'loose', -1)}
                                    className="w-6 h-6 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded flex items-center justify-center font-bold cursor-pointer"
                                    title="Decrease 1 loose unit"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={cItem.looseQty || ''}
                                    onChange={(e) => handleSetQty(cartKey, 'loose', parseInt(e.target.value) || 0)}
                                    className="w-12 border border-emerald-300 bg-white rounded text-center py-0.5 font-black text-xs text-emerald-700 focus:border-emerald-500 focus:outline-none"
                                    title="Type loose quantity directly"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(cartKey, 'loose', 1)}
                                    className="w-6 h-6 bg-emerald-600 text-white hover:bg-emerald-700 rounded flex items-center justify-center font-bold cursor-pointer"
                                    title="Increase 1 loose unit"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {cItem.looseQty > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-emerald-800">Disc (₹/{p.base_unit || 'Pc'}):</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={cItem.looseDiscount || ''}
                                    onChange={(e) => handleUpdateDiscount(cartKey, 'loose', parseFloat(e.target.value) || 0)}
                                    className="w-14 border border-emerald-200 bg-white rounded text-center py-0.5 font-bold text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW CART */}
            {orderStep === 'cart' && selectedRetailer && (
              <div className="erp-card bg-white p-5 space-y-5 border-slate-100 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-cyan-600" />
                    <span>Selected Items Basket ({cartTotalItemCount})</span>
                  </h3>
                  <button
                    onClick={() => setOrderStep('catalog')}
                    className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    Add More Items
                  </button>
                </div>

                {cartItemKeys.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 font-semibold">Your basket is empty.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/20 px-3">
                      {cartItemKeys.map(cartKey => {
                        const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
                        const prod = products.find(p => p.id === prodId)!;
                        const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
                        const lots = getProductMrpLots(prodId);
                        const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price, purchase_rate: prod.purchase_price };
                        const cartonRate = lot.selling_price || prod.selling_price;
                        const unitsPerPack = prod.units_per_box_carton || 1;
                        const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
                          ? prod.loose_selling_price
                          : (cartonRate / unitsPerPack);
                        const tradeModeInfo = getProductTradeMode(prod);
                        const allowCarton = tradeModeInfo.allowCarton;
                        const allowPieces = tradeModeInfo.allowPieces;
                        const isPieceOnly = !allowCarton && allowPieces;

                        const cItem = getCartItem(cartKey);
                        const baseQty = (cItem.cartonQty * unitsPerPack) + cItem.looseQty;
                        const amounts = calculateItemAmounts(
                          cItem.cartonQty,
                          cItem.looseQty,
                          cartonRate,
                          looseRate,
                          cItem.cartonDiscount,
                          cItem.looseDiscount,
                          prod.gst_percent
                        );

                        return (
                          <div key={cartKey} className="py-3.5 space-y-2.5 text-xs">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-sm block leading-tight">{prod.name}</span>
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-black">MRP ₹{targetMrp}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-500 font-medium">Packing: {isPieceOnly ? `1 ${prod.base_unit || 'Piece'}` : prod.pack_size}</span>
                                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                                    Total: {formatQuantityDisplay(baseQty, unitsPerPack, prod.trading_unit, prod.base_unit)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setRateHistoryProduct(prod)}
                                  className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-900 font-bold hover:underline cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5 text-cyan-600" />
                                  <span>View Last 5 Billing Rates</span>
                                </button>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-slate-900 text-base block">₹{amounts.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                {amounts.discountAmount > 0 && (
                                  <span className="text-xs text-red-500 font-bold block mt-0.5">
                                    -₹{amounts.discountAmount.toFixed(2)} disc
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Dual in-cart steppers & direct numeric entry */}
                            <div className={`grid ${allowCarton && allowPieces ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2 bg-white p-2 rounded-lg border border-slate-150`}>
                              {allowCarton && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-600 uppercase">{prod.trading_unit}s:</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(cartKey, 'carton', -1)}
                                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-700 font-bold cursor-pointer"
                                      title="Decrease 1 carton"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={cItem.cartonQty || ''}
                                      onChange={(e) => handleSetQty(cartKey, 'carton', parseInt(e.target.value) || 0)}
                                      className="w-12 border border-slate-300 bg-white rounded text-center py-0.5 font-black text-xs text-cyan-700 focus:border-cyan-500 focus:outline-none"
                                      title="Type carton quantity directly"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(cartKey, 'carton', 1)}
                                      className="w-6 h-6 bg-cyan-600 text-white hover:bg-cyan-700 rounded flex items-center justify-center font-bold cursor-pointer"
                                      title="Increase 1 carton"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {allowPieces && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-emerald-800 uppercase">{isPieceOnly ? (prod.base_unit || 'Pieces') : `Loose (${prod.base_unit || 'Pc'}):`}</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(cartKey, 'loose', -1)}
                                      className="w-6 h-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded flex items-center justify-center font-bold cursor-pointer"
                                      title="Decrease 1 loose unit"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={cItem.looseQty || ''}
                                      onChange={(e) => handleSetQty(cartKey, 'loose', parseInt(e.target.value) || 0)}
                                      className="w-12 border border-emerald-300 bg-white rounded text-center py-0.5 font-black text-xs text-emerald-700 focus:border-emerald-500 focus:outline-none"
                                      title="Type loose quantity directly"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQty(cartKey, 'loose', 1)}
                                      className="w-6 h-6 bg-emerald-600 text-white hover:bg-emerald-700 rounded flex items-center justify-center font-bold cursor-pointer"
                                      title="Increase 1 loose unit"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Inline Pending Warning Card in Sales Cart */}
                            {(() => {
                              const itemWarning = cartPendingWarnings.find(w => w.productId === prodId);
                              if (!itemWarning) return null;
                              return (
                                <PendingItemWarningCard
                                  warning={itemWarning}
                                  mode="inline"
                                />
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>

                    {/* Calculations Summary */}
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between">
                        <span>Items Base Total</span>
                        <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {discountTotal > 0 && (
                        <div className="flex justify-between text-red-500 font-bold">
                          <span>Total Discount Deducted</span>
                          <span>-₹{discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>GST Tax Amount</span>
                        <span>₹{gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-slate-900 text-base">
                        <span>Grand Bill Total</span>
                        <span>₹{grand.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setOrderStep('confirm')}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-900/10 transition-all text-center cursor-pointer"
                    >
                      Go to Order Confirmation
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {orderStep === 'confirm' && selectedRetailer && (
              <div className="erp-card bg-white p-5 space-y-5 border-slate-100 shadow-sm text-xs font-semibold text-slate-600">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Final Order Review</h3>
                
                {/* Pre-submit Multi-item Pending Order Warning Banner */}
                {cartPendingWarnings.length > 0 && (
                  <CartPendingSummaryBanner
                    warnings={cartPendingWarnings}
                    onReviewItems={() => setOrderStep('cart')}
                  />
                )}

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Selected Customer Details</span>
                  <p className="font-extrabold text-slate-900 text-sm">{selectedRetailer.shop_name}</p>
                  <p className="text-xs text-slate-500 mt-1">Delivery Address: {selectedRetailer.address}, {selectedRetailer.city}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Mobile Phone: {selectedRetailer.mobile}</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Order Value metrics</span>
                  <div className="flex justify-between text-xs mt-1">
                    <span>Base Value</span>
                    <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {discountTotal > 0 && (
                    <div className="flex justify-between text-xs text-red-500 font-bold">
                      <span>Invoice Discount</span>
                      <span>-₹{discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span>GST Taxes</span>
                    <span>₹{gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                    <span>Grand Total</span>
                    <span>₹{grand.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Fulfillment items list</span>
                  <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 px-3">
                    {cartItemKeys.map(cartKey => {
                      const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
                      const prod = products.find(p => p.id === prodId)!;
                      const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
                      const lots = getProductMrpLots(prodId);
                      const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price, purchase_rate: prod.purchase_price };
                      const cartonRate = lot.selling_price || prod.selling_price;
                      const unitsPerPack = prod.units_per_box_carton || 1;
                      const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
                        ? prod.loose_selling_price
                        : (cartonRate / unitsPerPack);

                      const cItem = getCartItem(cartKey);
                      const baseQty = (cItem.cartonQty * unitsPerPack) + cItem.looseQty;
                      const amounts = calculateItemAmounts(
                        cItem.cartonQty,
                        cItem.looseQty,
                        cartonRate,
                        looseRate,
                        cItem.cartonDiscount,
                        cItem.looseDiscount,
                        prod.gst_percent
                      );

                      return (
                        <div key={cartKey} className="py-2.5 flex justify-between items-center text-slate-700">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs">{prod.name}</span>
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-black">MRP ₹{targetMrp}</span>
                            </div>
                            <span className="text-xs text-cyan-800 font-bold block mt-0.5">
                              {formatQuantityDisplay(baseQty, unitsPerPack, prod.trading_unit, prod.base_unit)}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 text-sm">₹{amounts.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setOrderStep('cart')}
                    className="flex-1 py-2.5 border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-center cursor-pointer text-xs"
                  >
                    Edit Cart
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold shadow-md shadow-cyan-900/10 active:scale-95 transition-all text-center cursor-pointer text-xs"
                  >
                    CONFIRM &amp; PLACE ORDER
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================
            TAB 2: SALES BOOK / ORDERS HISTORY
            ======================================================== */}
        {activeTab === 'history' && orderStep !== 'success' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1 flex items-center gap-1.5">
              <History className="w-4 h-4 text-cyan-600" />
              <span>Booked Sales Orders ({salesHistory.length})</span>
            </h3>

            {salesHistory.length === 0 ? (
              <div className="text-center py-12 bg-white border border-slate-150 rounded-xl text-xs text-slate-400">
                No orders booked by you yet in this session.
              </div>
            ) : (
              <div className="space-y-3">
                {salesHistory.map(ord => {
                  const retObj = retailers.find(r => r.id === ord.retailer_id);
                  return (
                    <div key={ord.id} className="erp-card bg-white p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-800">{ord.order_number}</span>
                        <span className={`px-2.5 py-0.5 rounded-[4px] text-xs font-black ${
                          ord.status === 'Submitted' ? 'badge-submitted' :
                          ord.status === 'Under Review' ? 'badge-under-review' :
                          ord.status === 'Confirmed' ? 'badge-confirmed' :
                          ord.status === 'Partially Confirmed' ? 'badge-partially-confirmed' :
                          ord.status === 'Packed' ? 'bg-amber-100 text-amber-800' :
                          ord.status === 'Dispatched' ? 'badge-dispatched' :
                          ord.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                          'badge-cancelled'
                        }`}>
                          {ord.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>Shop: {retObj?.shop_name}</span>
                        <span>Total: <strong className="text-slate-900 font-bold">₹{ord.total_amount.toLocaleString('en-IN')}</strong></span>
                      </div>

                      {/* Line items with dual quantity format */}
                      {ord.items && ord.items.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                          {ord.items.map((it, idx) => {
                            const p = products.find(prod => prod.id === it.product_id);
                            const unitsPerPack = it.units_per_box_carton || p?.units_per_box_carton || 1;
                            const totalBase = it.base_qty || it.quantity || 0;
                            return (
                              <div key={idx} className="flex justify-between text-xs text-slate-600">
                                <span>
                                  {p?.name || 'Product'} &bull; <strong className="text-cyan-700 font-bold">{formatQuantityDisplay(totalBase, unitsPerPack, it.trading_unit || p?.trading_unit, it.base_unit || p?.base_unit)}</strong>
                                </span>
                                <span className="font-bold text-slate-900">₹{it.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-slate-50 pt-2 text-xs">
                        <span className="text-slate-400">{new Date(ord.order_date).toLocaleDateString('en-IN')}</span>
                        <button
                          onClick={() => handleRepeatOrder(ord)}
                          className="flex items-center gap-1 text-cyan-600 font-bold hover:underline cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Repeat Order</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 5: SUCCESS STATE VIEW */}
        {orderStep === 'success' && (
          <div className="erp-card bg-white p-8 text-center max-w-md mx-auto space-y-6 border-slate-100 shadow-lg mt-6">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <CheckCircle className="w-12 h-12" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">ORDER PLACED SUCCESSFULLY</h3>
              <p className="text-xs text-slate-500">The customer order has been uploaded to the distributor's administrative dashboard.</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs">
              <span className="text-slate-400 block text-xs uppercase font-bold">Sales Order Reference ID</span>
              <strong className="text-slate-800 text-sm mt-1 block">{latestOrderNum}</strong>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setOrderStep('retailer');
                  setActiveTab('history');
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                View Booked Orders
              </button>
              <button
                onClick={() => {
                  setOrderStep('retailer');
                  setActiveTab('order');
                }}
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Start New Order
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Floating cart bar for Catalogue ordering step */}
      {activeTab === 'order' && orderStep === 'catalog' && cartTotalItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-white p-4 border-t border-slate-800 rounded-t-2xl shadow-2xl flex flex-col gap-3 max-w-md mx-auto no-print">
          <div className="flex justify-between items-center text-xs font-semibold">
            <div>
              <span className="font-medium text-slate-400 block text-xs">Basket: {cartTotalItemCount} item types</span>
              <span className="text-base font-black text-white mt-0.5 block">₹{grand.toLocaleString('en-IN')} (incl. GST)</span>
            </div>
            <button
              onClick={() => setOrderStep('cart')}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span>Review Order Cart</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Last 5 Billing Rates Modal */}
      {rateHistoryProduct && selectedRetailer && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryProduct}
          onClose={() => setRateHistoryProduct(null)}
          retailerId={selectedRetailer.id}
          productId={rateHistoryProduct.id}
          tradingUnit={rateHistoryProduct.trading_unit}
        />
      )}

      {/* Register New Shop Modal for Salesperson */}
      <AddRetailerModal
        isOpen={addRetailerModalOpen}
        onClose={() => setAddRetailerModalOpen(false)}
        isQuickAdd={true}
        title="Register New Shop (Field Booking)"
        defaultCity={selectedRetailer?.city || 'Indore'}
        onSuccess={(newRetailer) => {
          setSelectedRetailerId(newRetailer.id);
          setOrderStep('catalog');
          setSalesToast({
            message: `Shop "${newRetailer.shop_name}" registered! Starting order booking.`,
            type: 'success'
          });
        }}
      />

      {/* Toast Notification */}
      {salesToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white border border-slate-700 shadow-2xl text-xs font-bold animate-in slide-in-from-bottom-3 duration-200 max-w-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="flex-1">{salesToast.message}</span>
          <button onClick={() => setSalesToast(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
