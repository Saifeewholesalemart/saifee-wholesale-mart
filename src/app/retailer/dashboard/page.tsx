'use client';

import React, { useState, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Plus, Minus, FileText, History, DollarSign, ArrowRight, RotateCcw, Package, AlertTriangle } from 'lucide-react';
import { Product, Order, Invoice, Payment, formatQuantityDisplay, splitBaseQuantity, calculateItemAmounts, PendingOrderItemWarning, getProductTradeMode } from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import SmartSearchBar from '@/components/SmartSearchBar';
import PendingItemWarningCard, { CartPendingSummaryBanner } from '@/components/orders/PendingItemWarningCard';

export default function RetailerDashboard() {
  const { 
    currentUser, setCurrentUser, profiles, products, batches, retailers, orders, invoices, payments, 
    placeOrder, retailerCart: cart, setRetailerCart: setCart,
    categories, getCategoriesForProduct, getAssignedCategoriesForRetailer, isProductVisibleToRetailer,
    getPendingItemsForRetailer, logPendingOrderProceedActivity
  } = useDb();
  const router = useRouter();

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeView, setActiveView] = useState<'catalog' | 'history' | 'finance'>('history');
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [rateHistoryProduct, setRateHistoryProduct] = useState<Product | null>(null);
  const [selectedProductMrp, setSelectedProductMrp] = useState<{ [productId: string]: number }>({});

  // 1. Get associated retailer profile object
  const retailerObj = retailers.find(r => r.id === currentUser?.retailer_id);

  if (!currentUser || currentUser.role !== 'retailer' || !retailerObj) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Retailer Authentication Required</h2>
          <p className="text-xs text-slate-500 mt-1">Please sign in with your registered Retailer Shop credentials.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/retailer')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
        >
          Go to Retailer Login
        </button>
      </div>
    );
  }

  // 2. Assigned Categories for this retailer
  const assignedRetailerCategories = getAssignedCategoriesForRetailer(retailerObj.id);
  const retailerCategoriesList = assignedRetailerCategories.length > 0
    ? ['All', ...assignedRetailerCategories.map(c => c.name)]
    : ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // 3. Filter products matching retailer assigned categories & search term
  const catalogProducts = products.filter(p => {
    if (!isProductVisibleToRetailer(p.id, retailerObj.id)) return false;

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

    return searchTerm.trim() === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_code.toLowerCase().includes(searchTerm.toLowerCase());
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

  const getCartItem = (cartKey: string): { cartonQty: number; looseQty: number } => {
    const raw = cart[cartKey];
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

    const updated = { ...cart };
    if (newCarton === 0 && newLoose === 0) {
      delete updated[cartKey];
    } else {
      updated[cartKey] = { cartonQty: newCarton, looseQty: newLoose };
    }
    setCart(updated);
  };

  // Dynamic Pending Order Warnings check
  const activeCartKeys = Object.keys(cart).filter(k => {
    const it = getCartItem(k);
    return it.cartonQty > 0 || it.looseQty > 0;
  });

  const currentCartToCheck = activeCartKeys.map(cartKey => {
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

  const cartPendingWarnings = retailerObj
    ? getPendingItemsForRetailer(retailerObj.id, currentCartToCheck)
    : [];

  const handlePlaceOrder = () => {
    if (activeCartKeys.length === 0) return;

    const items = activeCartKeys.map(cartKey => {
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

    const totalVal = items.reduce((sum, item) => sum + item.total_amount, 0);

    const ord = placeOrder({
      retailer_id: retailerObj.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      created_by: currentUser.id,
      total_amount: Math.round(totalVal),
      items
    });

    // Audit log if placed with pending item warnings
    if (cartPendingWarnings.length > 0) {
      logPendingOrderProceedActivity(retailerObj.id, cartPendingWarnings, ord.order_number);
    }

    setOrderSuccess(`Order ${ord.order_number} submitted directly to distributor!`);
    setCart({});
    setTimeout(() => setOrderSuccess(null), 5000);
  };

  const handleRepeatOrder = (pastOrder: Order) => {
    const repeatedCart: typeof cart = {};
    pastOrder.items?.forEach(item => {
      const k = item.selected_mrp ? `${item.product_id}__mrp_${item.selected_mrp}` : item.product_id;
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_box_carton || prod?.units_per_box_carton || 1;

      let cQty = item.carton_qty != null ? item.carton_qty : 0;
      let lQty = item.loose_qty != null ? item.loose_qty : 0;
      if (cQty === 0 && lQty === 0 && (item.base_qty || item.quantity)) {
        const split = splitBaseQuantity(item.base_qty || item.quantity, unitsPerPack);
        cQty = split.cartonQty;
        lQty = split.looseQty;
      }
      repeatedCart[k] = { cartonQty: cQty, looseQty: lQty };
    });
    setCart(repeatedCart);
    setActiveView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter records belonging to this Retailer
  const myOrders = orders
    .filter(o => o.retailer_id === retailerObj.id)
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

  const myInvoices = invoices
    .filter(i => i.retailer_id === retailerObj.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const myPayments = payments
    .filter(p => p.retailer_id === retailerObj.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const cartItemCount = activeCartKeys.length;

  const cartTotal = activeCartKeys.reduce((sum, cartKey) => {
    const [prodId, mrpPart] = cartKey.includes('__mrp_') ? cartKey.split('__mrp_') : [cartKey, ''];
    const prod = products.find(p => p.id === prodId);
    if (!prod) return sum;
    const targetMrp = mrpPart ? parseFloat(mrpPart) : prod.mrp;
    const lots = getProductMrpLots(prodId);
    const lot = lots.find(l => l.mrp === targetMrp) || { mrp: targetMrp, selling_price: prod.selling_price };
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
    return sum + amounts.netTotal;
  }, 0);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-900 text-white shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <ShoppingBag className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black leading-tight text-white">{retailerObj.shop_name}</h1>
            <span className="text-xs text-slate-400 font-medium block mt-0.5">{retailerObj.retailer_code} &bull; Retailer Direct</span>
          </div>
        </div>
        <button 
          onClick={() => router.push('/')} 
          className="text-xs text-slate-300 font-bold border border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
        >
          EXIT
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full pb-36">
        {orderSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
            {orderSuccess}
          </div>
        )}

        {/* Financial Header Widget */}
        <div className="erp-card bg-gradient-to-br from-slate-900 to-slate-850 text-white p-4 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Retailer Account Balance</span>
          <div className="flex justify-between items-end">
            <div>
              <span className="text-xs text-slate-400 font-medium">Total Outstanding</span>
              <span className="text-2xl font-black block text-red-400 mt-0.5">₹{retailerObj.outstanding.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium">Available Credit</span>
              <span className="text-base font-bold block text-emerald-400 mt-0.5">₹{(retailerObj.credit_limit - retailerObj.outstanding).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white text-xs font-semibold shadow-xs">
          <button
            onClick={() => setActiveView('catalog')}
            className={`flex-1 py-2.5 text-center border-r border-slate-200 transition-colors cursor-pointer ${
              activeView === 'catalog' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            Order Goods
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`flex-1 py-2.5 text-center border-r border-slate-200 transition-colors cursor-pointer ${
              activeView === 'history' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            My Orders
          </button>
          <button
            onClick={() => setActiveView('finance')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeView === 'finance' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            Invoices &amp; Pay
          </button>
        </div>

        {/* --------------------------------------------------
            VIEW 1: ORDER GOODS CATALOG
           -------------------------------------------------- */}
        {activeView === 'catalog' && (
          <div className="space-y-4">
            <SmartSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search products in catalog..."
              entityFilter={['product', 'category']}
              size="md"
            />

            {retailerCategoriesList.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {retailerCategoriesList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {catalogProducts.map(p => {
                const lots = getProductMrpLots(p.id);
                const activeMrp = selectedProductMrp[p.id] || lots[0]?.mrp || p.mrp;
                const activeLot = lots.find(l => l.mrp === activeMrp) || lots[0] || {
                  mrp: p.mrp,
                  selling_price: p.selling_price,
                  purchase_rate: p.purchase_price,
                  available_qty: 0
                };
                const cartKey = `${p.id}__mrp_${activeMrp}`;
                const { cartonQty, looseQty } = getCartItem(cartKey);

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

                return (
                  <div key={p.id} className="erp-card bg-white p-4 flex flex-col gap-3 rounded-xl border border-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm block leading-tight">{p.name}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                            MRP: ₹{activeMrp || p.mrp}
                          </span>
                          {isCartonOnly && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-xs font-bold shrink-0">
                              {p.trading_unit || 'Carton'} Only
                            </span>
                          )}
                          {isPieceOnly && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-bold shrink-0">
                              {p.base_unit || 'Pieces'} Only
                            </span>
                          )}
                          {isBoth && (
                            <span className="px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-300 rounded text-xs font-bold shrink-0">
                              Carton &amp; Pieces
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-600 font-medium block mt-1">
                          Brand: {p.brand} | Packing: <strong className="text-slate-700 font-bold">{isPieceOnly ? `1 ${p.base_unit || 'Piece'}` : (p.pack_size || `${unitsPerPack} ${p.base_unit || 'Pcs'}/${p.trading_unit}`)}</strong>
                        </span>
                        
                        {lots.length > 1 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-600 mr-0.5">Stock Lots:</span>
                            {lots.map(l => (
                              <button
                                key={l.mrp}
                                type="button"
                                onClick={() => setSelectedProductMrp(prev => ({ ...prev, [p.id]: l.mrp }))}
                                className={`px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer border ${
                                  activeMrp === l.mrp
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                MRP ₹{l.mrp} ({formatQuantityDisplay(l.available_qty, unitsPerPack, p.trading_unit, p.base_unit)})
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">Printed MRP: <strong className="text-slate-900">₹{activeLot.mrp}</strong></span>
                            {activeLot.available_qty > 0 && (
                              <span className="text-xs text-emerald-700 font-bold">
                                ({formatQuantityDisplay(activeLot.available_qty, unitsPerPack, p.trading_unit, p.base_unit)} in stock)
                              </span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setRateHistoryProduct(p)}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-500" />
                          <span>View Last 5 Billing Rates</span>
                        </button>
                      </div>
                    </div>

                    {/* Pricing and Steppers */}
                    <div className="border-t border-slate-100 pt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        {allowCarton && (
                          <div>
                            <span className="text-xs text-slate-500 block uppercase font-bold">Wholesale {p.trading_unit}</span>
                            <span className="text-sm font-black text-indigo-700">₹{cartonRate.toFixed(2)}/{p.trading_unit}</span>
                            {p.carton_discount ? (
                              <span className="text-[11px] font-bold text-emerald-600 block">
                                ₹{(cartonRate - p.carton_discount).toFixed(2)} net (-₹{p.carton_discount} disc)
                              </span>
                            ) : null}
                          </div>
                        )}
                        {allowPieces && (
                          <div className={allowCarton ? "text-right" : ""}>
                            <span className="text-xs text-slate-500 block uppercase font-bold">{isPieceOnly ? (p.base_unit || 'Piece') : 'Loose Piece'}</span>
                            <span className="text-sm font-black text-emerald-700">₹{looseRate.toFixed(2)}/{p.base_unit || 'Piece'}</span>
                            {isPieceOnly && p.loose_discount ? (
                              <span className="text-[11px] font-bold text-emerald-600 block">
                                ₹{(looseRate - p.loose_discount).toFixed(2)} net (-₹{p.loose_discount} disc)
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Dual Stepper buttons */}
                      <div className={`grid ${allowCarton && allowPieces ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1`}>
                        {allowCarton && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-xs font-bold text-slate-700 uppercase">{p.trading_unit}s:</span>
                            <div className="flex items-center gap-1.5">
                              {cartonQty > 0 && (
                                <button
                                  onClick={() => handleUpdateQty(cartKey, 'carton', -1)}
                                  className="w-7 h-7 bg-white hover:bg-slate-200 border border-slate-200 rounded-md flex items-center justify-center text-slate-700 font-bold cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className={`text-xs font-black w-6 text-center ${cartonQty > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                                {cartonQty}
                              </span>
                              <button
                                onClick={() => handleUpdateQty(cartKey, 'carton', 1)}
                                className="w-7 h-7 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md flex items-center justify-center font-bold cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {allowPieces && (
                          <div className="flex items-center justify-between bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-900 uppercase">{isPieceOnly ? (p.base_unit || 'Pieces') : `Loose (${p.base_unit || 'Pc'}):`}</span>
                            <div className="flex items-center gap-1.5">
                              {looseQty > 0 && (
                                <button
                                  onClick={() => handleUpdateQty(cartKey, 'loose', -1)}
                                  className="w-7 h-7 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center justify-center text-emerald-800 font-bold cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className={`text-xs font-black w-6 text-center ${looseQty > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {looseQty}
                              </span>
                              <button
                                onClick={() => handleUpdateQty(cartKey, 'loose', 1)}
                                className="w-7 h-7 bg-emerald-600 text-white hover:bg-emerald-700 rounded-md flex items-center justify-center font-bold cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Inline Pending Warning on Product Card */}
                      {(() => {
                        const itemWarning = cartPendingWarnings.find(w => w.productId === p.id);
                        if (!itemWarning) return null;
                        return (
                          <PendingItemWarningCard
                            warning={itemWarning}
                            mode="inline"
                          />
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------------
            VIEW 2: DIRECT ORDERS LIST
           -------------------------------------------------- */}
        {activeView === 'history' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide px-1 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Direct Booked Orders ({myOrders.length})</span>
            </h3>

            {myOrders.length === 0 ? (
              <div className="text-center py-12 bg-white border border-slate-150 rounded-xl text-xs text-slate-400 font-medium">
                No active or past orders found.
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(ord => (
                  <div key={ord.id} className="erp-card bg-white p-4 space-y-2.5 text-xs rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-slate-900 text-sm">{ord.order_number}</span>
                      <span className={`badge ${
                        ord.status === 'Submitted' ? 'badge-submitted' :
                        ord.status === 'Confirmed' ? 'badge-confirmed' :
                        ord.status === 'Partially Confirmed' ? 'badge-partially-confirmed' :
                        'badge-draft'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>Source: Direct Web App</span>
                      <span>Total Amount: <strong className="text-slate-900 font-extrabold text-sm">₹{ord.total_amount.toLocaleString('en-IN')}</strong></span>
                    </div>

                    {/* Order line items with dual formatted quantities */}
                    {ord.items && ord.items.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                        {ord.items.map((it, idx) => {
                          const p = products.find(prod => prod.id === it.product_id);
                          const unitsPerPack = it.units_per_box_carton || p?.units_per_box_carton || 1;
                          const totalBase = it.base_qty || it.quantity || 0;
                          return (
                            <div key={idx} className="flex justify-between items-center text-xs text-slate-700">
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900">{p?.name || 'Product'}</span>
                                <span className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  MRP: ₹{it.selected_mrp ?? p?.mrp ?? 0}
                                </span>
                                &bull; <strong className="text-indigo-700">{formatQuantityDisplay(totalBase, unitsPerPack, it.trading_unit || p?.trading_unit, it.base_unit || p?.base_unit)}</strong>
                              </span>
                              <span className="font-bold text-slate-900">₹{it.total_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-xs">
                      <span className="text-slate-500 font-medium">{new Date(ord.order_date).toLocaleDateString('en-IN')}</span>
                      <button
                        onClick={() => handleRepeatOrder(ord)}
                        className="flex items-center gap-1 text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Repeat Order</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------
            VIEW 3: INVOICES & PAYMENTS STATEMENT
           -------------------------------------------------- */}
        {activeView === 'finance' && (
          <div className="space-y-4">
            {/* Invoices List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide px-1 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>My Invoices ({myInvoices.length})</span>
              </h4>
              {myInvoices.length === 0 ? (
                <div className="text-center py-6 bg-white border border-slate-150 rounded-xl text-xs text-slate-400 font-medium">No invoices generated yet.</div>
              ) : (
                <div className="space-y-3">
                  {myInvoices.map(inv => (
                    <div key={inv.id} className="erp-card bg-white p-4 space-y-2 text-xs rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{inv.invoice_number}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${inv.outstanding_amount > 0 ? 'text-red-700 bg-red-50 border border-red-200' : 'text-emerald-800 bg-emerald-50 border border-emerald-200'}`}>
                          {inv.outstanding_amount > 0 ? `Unpaid: ₹${inv.outstanding_amount.toLocaleString('en-IN')}` : 'Fully Paid'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-xs">
                        <span>Grand Total: <strong className="text-slate-900">₹{inv.grand_total.toLocaleString('en-IN')}</strong></span>
                        <span>Date: {new Date(inv.date).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payments List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide px-1 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>My Payments history ({myPayments.length})</span>
              </h4>
              {myPayments.length === 0 ? (
                <div className="text-center py-6 bg-white border border-slate-150 rounded-xl text-xs text-slate-400 font-medium">No payment logs recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {myPayments.map(pay => (
                    <div key={pay.id} className="erp-card bg-white p-4 space-y-1.5 text-xs rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-900 text-sm">{pay.payment_number}</span>
                        <span className="text-emerald-700 font-black text-sm">-₹{pay.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-xs">
                        <span>Method: {pay.method}</span>
                        <span>Date: {new Date(pay.date).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Checkout bar for Retailer catalog */}
      {activeView === 'catalog' && cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-white p-4 border-t border-slate-800 rounded-t-2xl shadow-2xl flex flex-col gap-3 max-w-md mx-auto">
          {/* Pending warning preview inside checkout bar */}
          {cartPendingWarnings.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>⚠️ {cartPendingWarnings.length} item(s) already pending</span>
              </span>
              <span className="text-[11px] text-amber-300 font-medium">Non-blocking warning</span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="font-medium text-slate-400 block">Fulfillment: {cartItemCount} items</span>
              <span className="text-sm font-black text-white mt-0.5 block">₹{cartTotal.toLocaleString('en-IN')}</span>
            </div>
            <button
              onClick={handlePlaceOrder}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <span>Submit Direct</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Last 5 Billing Rates History Modal */}
      {rateHistoryProduct && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryProduct}
          onClose={() => setRateHistoryProduct(null)}
          retailerId={retailerObj.id}
          productId={rateHistoryProduct.id}
          tradingUnit={rateHistoryProduct.trading_unit}
        />
      )}
    </div>
  );
}
