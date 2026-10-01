'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart, Plus, Minus, CheckCircle, Store, Tag, MapPin, ArrowRight, UserCheck, X, LogIn, History, Package } from 'lucide-react';
import { Product, Order, Retailer, formatQuantityDisplay, calculateItemAmounts, splitBaseQuantity, PendingOrderItemWarning } from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import SmartSearchBar from '@/components/SmartSearchBar';
import PendingItemWarningCard, { CartPendingSummaryBanner } from '@/components/orders/PendingItemWarningCard';

export default function RetailerEcommerce() {
  const { 
    currentUser, setCurrentUser, products, retailers, profiles,
    placeOrder, retailerCart, setRetailerCart,
    categories, getCategoriesForProduct, batches,
    getPendingItemsForRetailer, logPendingOrderProceedActivity
  } = useDb();
  
  const router = useRouter();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedProductMrp, setSelectedProductMrp] = useState<{ [productId: string]: number }>({});

  // Checkout states
  const [activeView, setActiveView] = useState<'catalog' | 'cart' | 'checkout' | 'success'>('catalog');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [latestOrderId, setLatestOrderId] = useState('');
  const [latestOrderNumber, setLatestOrderNumber] = useState('');
  const [rateHistoryProduct, setRateHistoryProduct] = useState<Product | null>(null);

  // Helper to extract carton & loose quantities from cart
  const getCartItem = (cartKey: string): { cartonQty: number; looseQty: number } => {
    const raw = retailerCart[cartKey];
    if (!raw) return { cartonQty: 0, looseQty: 0 };
    if (typeof raw === 'number') {
      return { cartonQty: raw, looseQty: 0 };
    }
    return { cartonQty: Number(raw.cartonQty || 0), looseQty: Number(raw.looseQty || 0) };
  };

  const handleUpdateQty = (cartKey: string, type: 'carton' | 'loose', delta: number) => {
    const current = getCartItem(cartKey);
    const newCarton = type === 'carton' ? Math.max(0, current.cartonQty + delta) : current.cartonQty;
    const newLoose = type === 'loose' ? Math.max(0, current.looseQty + delta) : current.looseQty;

    const updated = { ...retailerCart };
    if (newCarton === 0 && newLoose === 0) {
      delete updated[cartKey];
    } else {
      updated[cartKey] = { cartonQty: newCarton, looseQty: newLoose };
    }
    setRetailerCart(updated);
  };

  // 1. Determine if user is logged in as Retailer
  const isRetailerLoggedIn = currentUser && currentUser.role === 'retailer';
  const retailerProfile = isRetailerLoggedIn
    ? retailers.find(r => r.id === currentUser.retailer_id)
    : null;

  // 2. Filter products based on active categories/brand/search
  const activeCategories = categories.filter(c => c.active);
  const categoriesList = activeCategories.length > 0
    ? ['All', ...activeCategories.map(c => c.name)]
    : ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const brandsList = ['All', ...Array.from(new Set(products.map(p => p.brand)))];

  const filteredProducts = products.filter(p => {
    let matchCat = selectedCategory === 'All';
    if (!matchCat) {
      const prodCats = getCategoriesForProduct(p.id);
      if (prodCats.length > 0) {
        matchCat = prodCats.some(c => c.active && c.name === selectedCategory);
      } else {
        matchCat = p.category === selectedCategory;
      }
    }

    const matchBrand = selectedBrand === 'All' || p.brand === selectedBrand;
    const matchSearch = searchTerm.trim() === '' || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchBrand && matchSearch;
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

  const cartItemKeys = Object.keys(retailerCart).filter(k => {
    const item = getCartItem(k);
    return item.cartonQty > 0 || item.looseQty > 0;
  });
  
  const cartTotalItemCount = cartItemKeys.length;
  
  const getCartTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    let gst = 0;
    
    cartItemKeys.forEach(cartKey => {
      const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
      const prod = products.find(p => p.id === prodId);
      if (!prod) return;
      const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
      const lots = getProductMrpLots(prodId);
      const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price, purchase_rate: prod.purchase_price };
      const { cartonQty, looseQty } = getCartItem(cartKey);
      
      const unitsPerPack = prod.units_per_box_carton || 1;
      const cartonRate = lot.selling_price || prod.selling_price;
      const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
        ? prod.loose_selling_price
        : (cartonRate / unitsPerPack);

      const cartonDiscount = prod.carton_discount || 0;
      const looseDiscount = prod.loose_discount || 0;

      const amounts = calculateItemAmounts(
        cartonQty,
        looseQty,
        cartonRate,
        looseRate,
        cartonDiscount,
        looseDiscount,
        prod.gst_percent
      );

      subtotal += amounts.grossAmount;
      discountTotal += amounts.discountAmount;
      gst += amounts.gstAmount;
    });

    const grand = Math.round(subtotal - discountTotal + gst);
    return { subtotal, discountTotal, gst, grand };
  };

  const { subtotal, discountTotal, gst, grand } = getCartTotals();

  // Dynamic Pending Order Warnings check for items in current cart
  const currentCartToCheck = cartItemKeys.map(cartKey => {
    const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
    const prod = products.find(p => p.id === prodId);
    const targetMrp = mrpPart ? parseFloat(mrpPart) : prod?.mrp;
    const { cartonQty, looseQty } = getCartItem(cartKey);
    return {
      productId: prodId,
      cartonQty,
      looseQty,
      packSize: prod?.pack_size,
      selectedMrp: targetMrp
    };
  });

  const cartPendingWarnings = retailerProfile 
    ? getPendingItemsForRetailer(retailerProfile.id, currentCartToCheck)
    : [];

  // Login handler
  const handleLoginAsRetailer = (profileId: string) => {
    setCurrentUser(profileId);
    setShowLoginModal(false);
    setActiveView('checkout');
  };

  const handlePlaceOrderClick = () => {
    if (cartItemKeys.length === 0) return;
    if (!isRetailerLoggedIn) {
      setShowLoginModal(true);
    } else {
      setActiveView('checkout');
    }
  };

  const handleConfirmAndPlaceOrder = () => {
    if (!retailerProfile) return;

    const items = cartItemKeys.map(cartKey => {
      const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
      const prod = products.find(p => p.id === prodId)!;
      const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
      const lots = getProductMrpLots(prodId);
      const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price, purchase_rate: prod.purchase_price };
      const { cartonQty, looseQty } = getCartItem(cartKey);

      const unitsPerPack = prod.units_per_box_carton || 1;
      const cartonRate = lot.selling_price || prod.selling_price;
      const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
        ? prod.loose_selling_price
        : (cartonRate / unitsPerPack);

      const cartonDiscount = prod.carton_discount || 0;
      const looseDiscount = prod.loose_discount || 0;
      const baseQty = (cartonQty * unitsPerPack) + looseQty;
      const amounts = calculateItemAmounts(
        cartonQty,
        looseQty,
        cartonRate,
        looseRate,
        cartonDiscount,
        looseDiscount,
        prod.gst_percent
      );

      return {
        id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        order_id: '',
        product_id: prodId,
        selected_mrp: targetMrp,
        purchase_rate: lot.purchase_rate,
        quantity: baseQty,
        carton_qty: cartonQty,
        loose_qty: looseQty,
        base_qty: baseQty,
        trading_unit: prod.trading_unit,
        base_unit: prod.base_unit || 'Piece',
        units_per_box_carton: unitsPerPack,
        carton_rate: cartonRate,
        loose_rate: looseRate,
        carton_discount: cartonDiscount,
        loose_discount: looseDiscount,
        base_price: cartonRate,
        discount: cartonDiscount,
        discount_amount: amounts.discountAmount,
        final_price: amounts.finalRate,
        gst_percent: prod.gst_percent,
        gst_amount: amounts.gstAmount,
        total_amount: amounts.netTotal
      };
    });

    const ord = placeOrder({
      retailer_id: retailerProfile.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      created_by: currentUser.id,
      total_amount: grand,
      items
    });

    // Record decision audit trail if user proceeded with pending item warnings
    if (cartPendingWarnings.length > 0) {
      logPendingOrderProceedActivity(retailerProfile.id, cartPendingWarnings, ord.order_number);
    }

    setLatestOrderId(ord.id);
    setLatestOrderNumber(ord.order_number);
    setRetailerCart({});
    setActiveView('success');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 relative pb-24">
      {/* Navbar Banner */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white shadow-md">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-emerald-500" />
          <div>
            <h1 className="text-sm font-black leading-tight">
              {isRetailerLoggedIn ? retailerProfile?.shop_name : 'Guest Retailer Storefront'}
            </h1>
            <span className="text-xs text-slate-300 block mt-0.5 uppercase font-bold tracking-wider">
              {isRetailerLoggedIn ? `Shop Code: ${retailerProfile?.retailer_code}` : 'Self-Order Catalog Desk'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRetailerLoggedIn ? (
            <button
              onClick={() => {
                // logout to main portal
                router.push('/');
              }}
              className="text-xs text-slate-200 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-800 font-bold cursor-pointer"
            >
              LOGOUT
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login Shop</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full p-4 space-y-6">
        
        {/* VIEW 1: PRODUCT CATALOG */}
        {activeView === 'catalog' && (
          <div className="space-y-4">
            
            {/* Shopping Welcome banner if logged in */}
            {isRetailerLoggedIn && retailerProfile && (
              <div className="p-4 bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">Logged In Shop Portal</span>
                  <h3 className="text-base font-black">{retailerProfile.shop_name}</h3>
                  <p className="text-xs text-slate-200 font-medium">Outstanding Account: <strong className="text-red-400 font-bold">₹{retailerProfile.outstanding.toLocaleString('en-IN')}</strong> &bull; Credit Available: <strong className="text-emerald-300 font-bold">₹{(retailerProfile.credit_limit - retailerProfile.outstanding).toLocaleString('en-IN')}</strong></p>
                </div>
                <button
                  onClick={() => router.push('/retailer/dashboard')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-bold border border-slate-700 cursor-pointer"
                >
                  Dashboard &amp; Ledger
                </button>
              </div>
            )}

            {/* Sticky Search bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <SmartSearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search 5,500+ FMCG products, brands or codes..."
                  entityFilter={['product', 'category']}
                  size="md"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="flex-1 border border-slate-200 bg-white rounded-xl px-2 py-2 text-xs font-semibold text-slate-600 outline-none"
                >
                  <option value="All">All Categories</option>
                  {categoriesList.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="flex-1 border border-slate-200 bg-white rounded-xl px-2 py-2 text-xs font-semibold text-slate-600 outline-none"
                >
                  <option value="All">All Brands</option>
                  {brandsList.filter(b => b !== 'All').map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Products grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-16 text-xs text-slate-400 font-semibold bg-white border border-slate-100 rounded-xl">
                  No products match your search or filter.
                </div>
              ) : (
                filteredProducts.map(p => {
                  const lots = getProductMrpLots(p.id);
                  const activeMrp = selectedProductMrp[p.id] || (lots.length > 0 ? lots[0].mrp : p.mrp);
                  const activeLot = lots.find(l => l.mrp === activeMrp) || lots[0] || { mrp: p.mrp, selling_price: p.selling_price, purchase_rate: p.purchase_price, available_qty: 0 };
                  const cartKey = `${p.id}__mrp_${activeLot.mrp}`;
                  const { cartonQty, looseQty } = getCartItem(cartKey);

                  const unitsPerPack = p.units_per_box_carton || 1;
                  const cartonRate = activeLot.selling_price || p.selling_price;
                  const looseRate = p.loose_price_mode === 'manual' && p.loose_selling_price != null
                    ? p.loose_selling_price
                    : (cartonRate / unitsPerPack);
                  const allowLoose = p.allow_loose_sale !== false;

                  return (
                    <div key={p.id} className="erp-card bg-white p-4 flex flex-col justify-between border-slate-150 relative shadow-xs hover:border-slate-300 hover:shadow-sm transition-all min-h-[250px]">
                      <div>
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">{p.brand}</span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <h3 className="font-extrabold text-slate-900 text-sm block leading-snug">{p.name}</h3>
                              <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                MRP ₹{activeMrp || p.mrp}
                              </span>
                            </div>
                          </div>
                          {allowLoose && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold shrink-0">
                              Loose Available
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Packing: <strong className="text-slate-700 font-bold">{p.pack_size} ({unitsPerPack} {p.base_unit || 'Pcs'}/{p.trading_unit})</strong></p>
                        
                        {/* Multi-MRP Lot Selector */}
                        {lots.length > 1 ? (
                          <div className="mt-2 space-y-1">
                            <span className="text-xs font-extrabold text-purple-700 uppercase tracking-wider block">Select Stock Lot (by MRP):</span>
                            <div className="flex flex-wrap gap-1.5">
                              {lots.map(l => {
                                const isSel = l.mrp === activeMrp;
                                const lKey = `${p.id}__mrp_${l.mrp}`;
                                const lItem = getCartItem(lKey);
                                const hasCart = lItem.cartonQty > 0 || lItem.looseQty > 0;
                                return (
                                  <button
                                    key={l.mrp}
                                    type="button"
                                    onClick={() => setSelectedProductMrp(prev => ({ ...prev, [p.id]: l.mrp }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                      isSel 
                                        ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-xs' 
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>MRP ₹{l.mrp}</span>
                                    <span className="text-xs text-slate-500 font-medium">({formatQuantityDisplay(l.available_qty, unitsPerPack, p.trading_unit, p.base_unit)})</span>
                                    {hasCart && (
                                      <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-xs font-black">
                                        {lItem.cartonQty}c+{lItem.looseQty}p
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">Printed MRP: <strong className="text-slate-800">₹{activeLot.mrp}</strong></span>
                            {activeLot.available_qty > 0 && (
                              <span className="text-xs text-emerald-700 font-bold">
                                ({formatQuantityDisplay(activeLot.available_qty, unitsPerPack, p.trading_unit, p.base_unit)} in stock)
                              </span>
                            )}
                          </div>
                        )}

                        {isRetailerLoggedIn && (
                          <button
                            type="button"
                            onClick={() => setRateHistoryProduct(p)}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-indigo-500" />
                            <span>View Last 5 Billing Rates</span>
                          </button>
                        )}
                      </div>

                      {/* Pricing and Dual Steppers */}
                      <div className="border-t border-slate-100 pt-2.5 mt-2 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-xs text-slate-500 block uppercase font-bold">Wholesale {p.trading_unit}</span>
                            <span className="text-sm font-black text-indigo-700 block">₹{cartonRate.toFixed(2)}/{p.trading_unit}</span>
                            {p.carton_discount ? (
                              <span className="text-[11px] font-bold text-emerald-600 block">
                                ₹{(cartonRate - p.carton_discount).toFixed(2)} net (-₹{p.carton_discount} disc)
                              </span>
                            ) : null}
                          </div>
                          {allowLoose && (
                            <div className="text-right">
                              <span className="text-xs text-slate-500 block uppercase font-bold">Loose Piece</span>
                              <span className="text-sm font-black text-emerald-700 block">₹{looseRate.toFixed(2)}/{p.base_unit || 'Piece'}</span>
                            </div>
                          )}
                        </div>

                        {/* Dual Stepper Controls */}
                        <div className="space-y-1.5 pt-1">
                          {/* Full Carton Stepper */}
                          <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-xs">
                            <span className="font-bold text-slate-700 text-xs uppercase">
                              {p.trading_unit}s:
                            </span>
                            <div className="flex items-center gap-1.5">
                              {cartonQty > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(cartKey, 'carton', -1)}
                                  className="w-6 h-6 bg-white hover:bg-slate-200 border border-slate-200 rounded-md flex items-center justify-center text-slate-700 font-bold shadow-2xs cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className={`text-sm font-black w-7 text-center ${cartonQty > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                                {cartonQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(cartKey, 'carton', 1)}
                                className="w-6 h-6 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Loose Pieces Stepper */}
                          {allowLoose && (
                            <div className="flex items-center justify-between bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100 text-xs">
                              <span className="font-bold text-emerald-800 text-xs uppercase">
                                Loose ({p.base_unit || 'Pcs'}):
                              </span>
                              <div className="flex items-center gap-1.5">
                                {looseQty > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(cartKey, 'loose', -1)}
                                    className="w-6 h-6 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center justify-center text-emerald-800 font-bold shadow-2xs cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className={`text-sm font-black w-7 text-center ${looseQty > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {looseQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(cartKey, 'loose', 1)}
                                  className="w-6 h-6 bg-emerald-600 text-white hover:bg-emerald-700 rounded-md flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: CART DRAWER VIEW */}
        {activeView === 'cart' && (
          <div className="erp-card bg-white p-6 space-y-6 max-w-2xl mx-auto border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <span>My Shopping Basket ({cartTotalItemCount} items)</span>
              </h3>
              <button 
                onClick={() => setActiveView('catalog')}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>

            {cartItemKeys.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-400 font-semibold">
                Your basket is empty. Browse goods to add.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/20 px-3">
                  {cartItemKeys.map(cartKey => {
                    const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
                    const prod = products.find(p => p.id === prodId)!;
                    const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
                    const lots = getProductMrpLots(prodId);
                    const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price };
                    const { cartonQty, looseQty } = getCartItem(cartKey);

                    const unitsPerPack = prod.units_per_box_carton || 1;
                    const cartonRate = lot.selling_price || prod.selling_price;
                    const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
                      ? prod.loose_selling_price
                      : (cartonRate / unitsPerPack);
                    const allowLoose = prod.allow_loose_sale !== false;

                    const baseQty = (cartonQty * unitsPerPack) + looseQty;
                    const cartonDiscount = prod.carton_discount || 0;
                    const looseDiscount = prod.loose_discount || 0;
                    const amounts = calculateItemAmounts(
                      cartonQty,
                      looseQty,
                      cartonRate,
                      looseRate,
                      cartonDiscount,
                      looseDiscount,
                      prod.gst_percent
                    );

                    return (
                      <div key={cartKey} className="py-3.5 space-y-3">
                        <div className="flex justify-between items-start gap-3 text-xs">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm block leading-tight">{prod.name}</span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-black">
                                MRP ₹{targetMrp}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block mt-0.5">
                              Packing: {prod.pack_size} ({unitsPerPack} {prod.base_unit || 'Pcs'}/{prod.trading_unit})
                            </span>
                            <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-100">
                              Selected: {formatQuantityDisplay(baseQty, unitsPerPack, prod.trading_unit, prod.base_unit)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900 text-base block">₹{amounts.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            {amounts.discountAmount > 0 && (
                              <span className="text-xs text-emerald-600 font-bold block">
                                -₹{amounts.discountAmount.toFixed(2)} disc
                              </span>
                            )}
                            <span className="text-xs text-slate-500 block mt-0.5">
                              ₹{cartonRate.toFixed(2)}/{prod.trading_unit} {allowLoose ? `| ₹${looseRate.toFixed(2)}/${prod.base_unit || 'Pc'}` : ''}
                            </span>
                          </div>
                        </div>

                        {/* In-cart Dual Steppers */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                          {/* Carton control */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 uppercase">{prod.trading_unit}s:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleUpdateQty(cartKey, 'carton', -1)}
                                className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-700 font-bold cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-sm font-black text-indigo-700 w-6 text-center">{cartonQty}</span>
                              <button
                                onClick={() => handleUpdateQty(cartKey, 'carton', 1)}
                                className="w-6 h-6 bg-indigo-600 text-white hover:bg-indigo-700 rounded flex items-center justify-center font-bold cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Loose control */}
                          {allowLoose && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-800 uppercase">Loose ({prod.base_unit || 'Pcs'}):</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateQty(cartKey, 'loose', -1)}
                                  className="w-6 h-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded flex items-center justify-center font-bold cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-sm font-black text-emerald-700 w-6 text-center">{looseQty}</span>
                                <button
                                  onClick={() => handleUpdateQty(cartKey, 'loose', 1)}
                                  className="w-6 h-6 bg-emerald-600 text-white hover:bg-emerald-700 rounded flex items-center justify-center font-bold cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Inline Pending Order Warning Card */}
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

                {/* Subtotals card */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5 text-xs text-slate-600 font-semibold">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Product Trade Discount</span>
                      <span>-₹{discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Calculated GST Total</span>
                    <span>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm text-slate-800 font-black">
                    <span>Invoice Grand Total</span>
                    <span>₹{grand.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrderClick}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 active:scale-95 transition-all text-center cursor-pointer"
                >
                  {isRetailerLoggedIn ? 'Proceed to Checkout' : 'Login Shop to Place Order'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: CHECKOUT SCREEN */}
        {activeView === 'checkout' && isRetailerLoggedIn && retailerProfile && (
          <div className="erp-card bg-white p-6 space-y-6 max-w-2xl mx-auto border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Checkout Confirmation</h3>
            
            {/* Pre-submit Multi-item Pending Order Warning Banner */}
            {cartPendingWarnings.length > 0 && (
              <CartPendingSummaryBanner
                warnings={cartPendingWarnings}
                onReviewItems={() => setActiveView('cart')}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Billing &amp; Delivery Shop</span>
                <p className="font-extrabold text-slate-900 text-sm">{retailerProfile.shop_name}</p>
                <p className="flex items-center gap-1.5 text-xs mt-2 font-medium text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{retailerProfile.address}, {retailerProfile.city}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Mobile: {retailerProfile.mobile}</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Order Value summary</span>
                <div className="flex justify-between text-xs">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-bold">
                    <span>Discount Applied</span>
                    <span>-₹{discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span>GST Taxes</span>
                  <span>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm text-slate-900 font-extrabold">
                  <span>Grand Total</span>
                  <span>₹{grand.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Items Summary list */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Fulfillment summary</span>
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 px-3">
                {cartItemKeys.map(cartKey => {
                  const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
                  const prod = products.find(p => p.id === prodId)!;
                  const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
                  const lots = getProductMrpLots(prodId);
                  const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price };
                  const { cartonQty, looseQty } = getCartItem(cartKey);

                  const unitsPerPack = prod.units_per_box_carton || 1;
                  const cartonRate = lot.selling_price || prod.selling_price;
                  const looseRate = prod.loose_price_mode === 'manual' && prod.loose_selling_price != null
                    ? prod.loose_selling_price
                    : (cartonRate / unitsPerPack);

                  const baseQty = (cartonQty * unitsPerPack) + looseQty;
                  const amounts = calculateItemAmounts(
                    cartonQty,
                    looseQty,
                    cartonRate,
                    looseRate,
                    0,
                    0,
                    prod.gst_percent
                  );

                  return (
                    <div key={cartKey} className="py-2.5 flex justify-between items-center text-xs font-semibold text-slate-700">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs">{prod.name}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-black">MRP ₹{targetMrp}</span>
                        </div>
                        <span className="text-xs text-indigo-700 font-bold block mt-0.5">
                          {formatQuantityDisplay(baseQty, unitsPerPack, prod.trading_unit, prod.base_unit)}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">₹{amounts.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setActiveView('cart')}
                className="flex-1 py-3 border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
              >
                Back to Basket
              </button>
              
              <button
                onClick={handleConfirmAndPlaceOrder}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/10 active:scale-95 transition-all text-center cursor-pointer"
              >
                CONFIRM &amp; PLACE ORDER
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: ORDER PLACED SUCCESS */}
        {activeView === 'success' && (
          <div className="erp-card bg-white p-8 text-center max-w-md mx-auto space-y-6 border-slate-100 shadow-lg mt-8">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <CheckCircle className="w-12 h-12" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">ORDER PLACED SUCCESSFULLY</h3>
              <p className="text-xs text-slate-500">Your direct e-commerce booking has been received by the distributor admin.</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs">
              <span className="text-slate-400 block text-xs uppercase font-bold">Booking Reference Number</span>
              <strong className="text-slate-800 text-sm mt-1 block">{latestOrderNumber}</strong>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  router.push('/retailer/dashboard');
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                View Order History
              </button>
              <button
                onClick={() => {
                  setActiveView('catalog');
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Floating cart bar at bottom */}
      {activeView === 'catalog' && cartTotalItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-white p-4 border-t border-slate-800 rounded-t-2xl shadow-2xl flex flex-col gap-3 max-w-md mx-auto no-print">
          <div className="flex justify-between items-center text-xs font-semibold">
            <div>
              <span className="font-medium text-slate-300 block text-xs">Basket: {cartTotalItemCount} item types</span>
              <span className="text-base font-black text-white mt-0.5 block">₹{grand.toLocaleString('en-IN')} (incl. GST)</span>
            </div>
            <button
              onClick={() => setActiveView('cart')}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span>View Cart / Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Checkout Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Login to Place Order</h3>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase block">Select Retailer Shop Profile</label>
              <p className="text-xs text-slate-500 leading-normal">Choose one of the demo retailer accounts in Indore, Bhopal, Dewas, Ujjain, or Mumbai to authenticate.</p>
            </div>

            {/* List of profiles belonging to role retailer */}
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
              {profiles.filter(p => p.role === 'retailer').map(p => {
                const retObj = retailers.find(r => r.id === p.retailer_id);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleLoginAsRetailer(p.id)}
                    className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/20 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {retObj?.city.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-900 block leading-tight">{retObj?.shop_name}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">{retObj?.city} &bull; Code: {retObj?.retailer_code}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Last 5 Billing Rates History Modal */}
      {rateHistoryProduct && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryProduct}
          onClose={() => setRateHistoryProduct(null)}
          retailerId={retailerProfile?.id || retailers[0]?.id || ''}
          productId={rateHistoryProduct.id}
          tradingUnit={rateHistoryProduct.trading_unit}
        />
      )}
    </div>
  );
}
