'use client';

import React, { useState, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { Calendar, Filter, FileText, CheckCircle, AlertCircle, X, ShieldAlert, History } from 'lucide-react';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import SmartSearchBar from '@/components/SmartSearchBar';

function PendingFulfilmentsContent() {
  const { 
    orders, retailers, products, profiles, companies, inventory, 
    fulfilPendingItem, cancelPendingItem 
  } = useDb();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('all');
  const [filterRetailer, setFilterRetailer] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterSalesperson, setFilterSalesperson] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDaysRange, setFilterDaysRange] = useState('all'); // 'all', 'today', '1-2', '3-7', '7+'
  const [filterOrderDate, setFilterOrderDate] = useState('');

  // Dialog States
  const [activeFulfillRow, setActiveFulfillRow] = useState<{ orderId: string; itemId: string } | null>(null);
  const [activeCancelRow, setActiveCancelRow] = useState<{ orderId: string; itemId: string } | null>(null);
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string } | null>(null);
  
  // Fulfill Modal Form
  const [fulfillQty, setFulfillQty] = useState<number>(0);
  
  // Cancel Modal Form
  const [cancelQty, setCancelQty] = useState<number>(0);
  const [cancelReason, setCancelReason] = useState('Stock permanently out of stock');
  const [cancelNotes, setCancelNotes] = useState('');

  // 1. Construct the flat list of pending items
  const pendingItemsList: {
    orderId: string;
    orderNumber: string;
    orderDate: string;
    retailerId: string;
    retailerName: string;
    city: string;
    itemId: string;
    productId: string;
    productName: string;
    brand: string;
    tradingUnit: string;
    packSize: string;
    mrp: number;
    orderedQty: number;
    deliveredQty: number;
    pendingQty: number;
    salespersonId?: string;
    salespersonName: string;
    companyId: string;
    daysPending: number;
  }[] = [];

  orders.forEach(ord => {
    ord.items?.forEach(item => {
      const delivered = item.delivered_qty || 0;
      const cancelled = item.cancelled_qty || 0;
      const pending = item.quantity - delivered - cancelled;

      if (pending > 0) {
        const ret = retailers.find(r => r.id === ord.retailer_id);
        const prod = products.find(p => p.id === item.product_id);
        const spProfile = profiles.find(p => p.id === ord.created_by);
        
        let spName = 'Direct Booking';
        if (ord.source === 'distributor_salesperson') spName = spProfile ? `${spProfile.name} (Dist)` : 'Dist Salesperson';
        if (ord.source === 'company_salesperson') spName = spProfile ? `${spProfile.name} (Co)` : 'Co Salesperson';
        if (ord.source === 'counter_sale') spName = 'POS Counter Sale';

        const orderTime = new Date(ord.order_date).getTime();
        const days = Math.floor((Date.now() - orderTime) / (1000 * 60 * 60 * 24));

        pendingItemsList.push({
          orderId: ord.id,
          orderNumber: ord.order_number,
          orderDate: ord.order_date,
          retailerId: ord.retailer_id,
          retailerName: ret ? ret.shop_name : 'Unknown Retailer',
          city: ret ? ret.city : 'Unknown',
          itemId: item.id,
          productId: item.product_id,
          productName: prod ? prod.name : 'Unknown Product',
          brand: prod ? prod.brand : '',
          tradingUnit: prod ? prod.trading_unit : 'Carton',
          packSize: prod ? prod.pack_size : '',
          mrp: item.selected_mrp ?? prod?.mrp ?? 0,
          orderedQty: item.quantity,
          deliveredQty: delivered,
          pendingQty: pending,
          salespersonId: ord.created_by,
          salespersonName: spName,
          companyId: prod ? prod.company_id : '',
          daysPending: Math.max(0, days)
        });
      }
    });
  });

  // Unique collections for filters with city normalization
  const cityMap = new Map<string, string>();
  pendingItemsList.forEach(item => {
    if (!item.city) return;
    const trimmed = item.city.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (!cityMap.has(lower)) {
      const formatted = trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      cityMap.set(lower, formatted);
    }
  });
  const uniqueCities = Array.from(cityMap.entries()).map(([key, val]) => ({
    key,
    display: val
  })).sort((a, b) => a.display.localeCompare(b.display));

  const uniqueRetailers = Array.from(new Set(pendingItemsList.map(item => JSON.stringify({ id: item.retailerId, name: item.retailerName })))).map(s => JSON.parse(s));
  const uniqueProducts = Array.from(new Set(pendingItemsList.map(item => JSON.stringify({ id: item.productId, name: item.productName })))).map(s => JSON.parse(s));
  const uniqueSalespersons = Array.from(new Set(pendingItemsList.map(item => JSON.stringify({ id: item.salespersonId, name: item.salespersonName })))).map(s => JSON.parse(s));

  // Filter implementation
  const filteredPendingItems = pendingItemsList.filter(item => {
    const matchCity = filterCity === 'all' || (item.city && item.city.trim().toLowerCase() === filterCity);
    const matchRetailer = filterRetailer === 'all' || item.retailerId === filterRetailer;
    const matchProduct = filterProduct === 'all' || item.productId === filterProduct;
    const matchSalesperson = filterSalesperson === 'all' || item.salespersonId === filterSalesperson;
    const matchCompany = filterCompany === 'all' || item.companyId === filterCompany;
    const matchDate = !filterOrderDate || item.orderDate.startsWith(filterOrderDate);
    
    let matchSearch = true;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      matchSearch = item.orderNumber.toLowerCase().includes(q) ||
        item.retailerName.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.salespersonName.toLowerCase().includes(q);
    }

    let matchDays = true;
    if (filterDaysRange === 'today') {
      matchDays = item.daysPending === 0;
    } else if (filterDaysRange === '1-2') {
      matchDays = item.daysPending >= 1 && item.daysPending <= 2;
    } else if (filterDaysRange === '3-7') {
      matchDays = item.daysPending >= 3 && item.daysPending <= 7;
    } else if (filterDaysRange === '7+') {
      matchDays = item.daysPending > 7;
    }

    return matchCity && matchRetailer && matchProduct && matchSalesperson && matchCompany && matchDate && matchDays && matchSearch;
  });

  // Modal helpers
  const selectedFulfillRow = pendingItemsList.find(i => i.orderId === activeFulfillRow?.orderId && i.itemId === activeFulfillRow?.itemId);
  const selectedCancelRow = pendingItemsList.find(i => i.orderId === activeCancelRow?.orderId && i.itemId === activeCancelRow?.itemId);
  
  const selectedFulfillStock = selectedFulfillRow 
    ? (inventory.find(i => i.product_id === selectedFulfillRow.productId)?.available_qty || 0)
    : 0;

  const openFulfillDialog = (orderId: string, itemId: string) => {
    const item = pendingItemsList.find(i => i.orderId === orderId && i.itemId === itemId);
    if (!item) return;

    const stock = inventory.find(i => i.product_id === item.productId)?.available_qty || 0;
    setFulfillQty(Math.min(item.pendingQty, stock));
    setActiveFulfillRow({ orderId, itemId });
  };

  const openCancelDialog = (orderId: string, itemId: string) => {
    const item = pendingItemsList.find(i => i.orderId === orderId && i.itemId === itemId);
    if (!item) return;

    setCancelQty(item.pendingQty);
    setActiveCancelRow({ orderId, itemId });
  };

  const handleExecuteFulfill = () => {
    if (!selectedFulfillRow) return;

    if (fulfillQty <= 0) {
      alert('Please enter a quantity greater than zero.');
      return;
    }

    if (fulfillQty > selectedFulfillRow.pendingQty) {
      alert(`Cannot fulfill more than the pending quantity (${selectedFulfillRow.pendingQty}).`);
      return;
    }

    if (fulfillQty > selectedFulfillStock) {
      alert(`Insufficient available stock (${selectedFulfillStock} cartons).`);
      return;
    }

    const ful = fulfilPendingItem(selectedFulfillRow.orderId, selectedFulfillRow.itemId, fulfillQty);
    if (ful) {
      alert(` Fulfill Draft FUL-${ful.fulfilment_number} confirmed! Go to Consolidated Orders to dispatch.`);
      setActiveFulfillRow(null);
    } else {
      alert('Fulfillment creation failed.');
    }
  };

  const handleExecuteCancel = () => {
    if (!selectedCancelRow) return;

    if (cancelQty <= 0) {
      alert('Please enter a quantity to cancel.');
      return;
    }

    if (cancelQty > selectedCancelRow.pendingQty) {
      alert('Cannot cancel more than the pending quantity.');
      return;
    }

    const reasonStr = `${cancelReason} (${cancelNotes || 'No notes'})`;
    const success = cancelPendingItem(selectedCancelRow.orderId, selectedCancelRow.itemId, cancelQty, reasonStr);
    
    if (success) {
      alert(`Cancelled ${cancelQty} pending cartons for order item successfully.`);
      setActiveCancelRow(null);
      setCancelNotes('');
    } else {
      alert('Cancellation failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">Pending Fulfillments Registry</h2>
        <p className="text-xs text-slate-500 mt-1">Review and process individual unfulfilled quantities for retailer orders when new stock becomes available.</p>
      </div>

      {/* Quick filters */}
      <div className="flex border border-slate-200 rounded-lg overflow-x-auto bg-white text-xs font-semibold scrollbar-none">
        {[
          { key: 'all', label: 'All Pending' },
          { key: 'today', label: 'Added Today' },
          { key: '1-2', label: '1–2 Days Pending' },
          { key: '3-7', label: '3–7 Days Pending' },
          { key: '7+', label: '7+ Days Pending' }
        ].map(filter => {
          let count = 0;
          if (filter.key === 'all') {
            count = pendingItemsList.length;
          } else if (filter.key === 'today') {
            count = pendingItemsList.filter(item => item.daysPending === 0).length;
          } else if (filter.key === '1-2') {
            count = pendingItemsList.filter(item => item.daysPending >= 1 && item.daysPending <= 2).length;
          } else if (filter.key === '3-7') {
            count = pendingItemsList.filter(item => item.daysPending >= 3 && item.daysPending <= 7).length;
          } else if (filter.key === '7+') {
            count = pendingItemsList.filter(item => item.daysPending > 7).length;
          }

          return (
            <button
              key={filter.key}
              onClick={() => setFilterDaysRange(filter.key)}
              className={`flex-1 py-3 px-4 text-center border-r border-slate-200 whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
                filterDaysRange === filter.key ? 'bg-cyan-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span>{filter.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                filterDaysRange === filter.key ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Advanced Filters Panel */}
      <div className="erp-card bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="w-full sm:max-w-md">
            <SmartSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search order #, retailer, product, brand, city, salesperson..."
              size="sm"
            />
          </div>
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
            Showing {filteredPendingItems.length} of {pendingItemsList.length} items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
          {/* City */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Cities</option>
              {uniqueCities.map(city => (
                <option key={city.key} value={city.key}>{city.display}</option>
              ))}
            </select>
          </div>

          {/* Retailer */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterRetailer}
              onChange={(e) => setFilterRetailer(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Retailers</option>
              {uniqueRetailers.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Product */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Products</option>
              {uniqueProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Salesperson */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterSalesperson}
              onChange={(e) => setFilterSalesperson(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Salespersons</option>
              {uniqueSalespersons.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          {/* Company */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Order Date */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={filterOrderDate}
              onChange={(e) => setFilterOrderDate(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            />
          </div>
        </div>

        {/* Action Row */}
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            onClick={() => {
              setFilterCity('all');
              setFilterRetailer('all');
              setFilterProduct('all');
              setFilterSalesperson('all');
              setFilterCompany('all');
              setFilterDaysRange('all');
              setFilterOrderDate('');
            }}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Pending Items Table */}
      <div className="erp-card bg-white overflow-x-auto shadow-xs">
        {filteredPendingItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-semibold">
            No pending items match your selected filters.
          </div>
        ) : (
          <table className="erp-table w-full min-w-[780px]">
            <thead>
              <tr>
                <th>Order Ref #</th>
                <th>Retailer Shop</th>
                <th>City</th>
                <th>Product Description</th>
                <th>Ordered</th>
                <th>Delivered</th>
                <th>Pending</th>
                <th>Days Pending</th>
                <th>Operational Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPendingItems.map(row => (
                <tr key={`${row.orderId}-${row.itemId}`} className="border-b border-slate-100 text-xs">
                  <td className="font-bold text-slate-800">{row.orderNumber}</td>
                  <td>
                    <span className="font-semibold block text-slate-800 leading-normal">{row.retailerName}</span>
                    <span className="text-xs text-slate-500 font-medium block">Agent: {row.salespersonName}</span>
                  </td>
                  <td className="font-medium text-slate-600">{row.city}</td>
                  <td>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm block leading-tight">{row.productName}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                        MRP: ₹{row.mrp}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium mt-0.5 block">Packing: {row.packSize}</span>
                    <button
                      type="button"
                      onClick={() => setRateHistoryTarget({ retailerId: row.retailerId, productId: row.productId, tradingUnit: row.tradingUnit })}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer mt-1"
                    >
                      <History className="w-3.5 h-3.5 text-indigo-500" />
                      <span>View Last 5 Billing Rates</span>
                    </button>
                  </td>
                  <td className="text-center text-slate-700 font-bold">{row.orderedQty} {row.tradingUnit}s</td>
                  <td className="text-center text-emerald-700 font-bold">{row.deliveredQty} {row.tradingUnit}s</td>
                  <td className="text-center text-amber-700 font-black">{row.pendingQty} {row.tradingUnit}s</td>
                  <td className="text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.daysPending >= 7 ? 'bg-red-50 text-red-700 border border-red-200' :
                      row.daysPending >= 3 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {row.daysPending} {row.daysPending === 1 ? 'day' : 'days'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openFulfillDialog(row.orderId, row.itemId)}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Fulfil Pending
                      </button>
                      <button
                        onClick={() => openCancelDialog(row.orderId, row.itemId)}
                        className="px-2.5 py-1 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel Pending
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 1. FULFILL MODAL DIALOG */}
      {selectedFulfillRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-4 sm:p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wide">Fulfill Pending Quantity</h3>
              <button 
                onClick={() => setActiveFulfillRow(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Order:</span>
                  <span className="font-bold text-slate-800">{selectedFulfillRow.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Retailer Shop:</span>
                  <span className="font-bold text-slate-800">{selectedFulfillRow.retailerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Product:</span>
                  <span className="font-bold text-slate-800">{selectedFulfillRow.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Packing Display:</span>
                  <span className="font-semibold text-slate-700">{selectedFulfillRow.packSize}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/20">
                  <span className="text-xs text-slate-500 block uppercase font-bold">Ordered</span>
                  <span className="text-sm font-black text-slate-800">{selectedFulfillRow.orderedQty}</span>
                </div>
                <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/20">
                  <span className="text-xs text-slate-500 block uppercase font-bold">Delivered</span>
                  <span className="text-sm font-black text-emerald-600">{selectedFulfillRow.deliveredQty}</span>
                </div>
                <div className="p-2 border border-slate-100 rounded-lg bg-slate-50/20">
                  <span className="text-xs text-slate-500 block uppercase font-bold">Pending</span>
                  <span className="text-sm font-black text-amber-600">{selectedFulfillRow.pendingQty}</span>
                </div>
              </div>

              {/* Inventory warning */}
              <div className="p-3 border rounded-lg flex items-center justify-between gap-4 bg-cyan-50/30 border-cyan-100">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-bold">Available stock</span>
                  <span className="text-xs font-black text-cyan-750">{selectedFulfillStock} {selectedFulfillRow.tradingUnit}s available</span>
                </div>
                {selectedFulfillStock <= 0 && (
                  <span className="text-xs bg-red-50 border border-red-200 text-red-700 font-bold px-2 py-0.5 rounded uppercase">Out of stock</span>
                )}
              </div>

              {/* Fulfill qty input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quantity to Confirmed now ({selectedFulfillRow.tradingUnit}s)</label>
                <input
                  type="number"
                  min="1"
                  max={Math.min(selectedFulfillRow.pendingQty, selectedFulfillStock)}
                  value={fulfillQty || ''}
                  onChange={(e) => setFulfillQty(Math.max(1, parseInt(e.target.value) || 0))}
                  disabled={selectedFulfillStock <= 0}
                  className="w-full border border-slate-200 rounded-lg p-2 font-black text-slate-800"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setActiveFulfillRow(null)}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-center cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleExecuteFulfill}
                disabled={selectedFulfillStock <= 0}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white rounded-lg font-bold shadow-sm transition-all text-center cursor-pointer"
              >
                Confirm Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CANCEL MODAL DIALOG */}
      {selectedCancelRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-4 sm:p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-850 text-sm uppercase tracking-wide">Cancel Pending Quantity</h3>
              <button 
                onClick={() => setActiveCancelRow(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-slate-600 leading-normal font-medium">
                This action will cancel the pending quantity of <strong className="text-slate-900 font-extrabold">{selectedCancelRow.pendingQty} {selectedCancelRow.tradingUnit}s</strong> of Parle/Britannia products. This will release the backlog.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quantity to Cancel</label>
                <input
                  type="number"
                  min="1"
                  max={selectedCancelRow.pendingQty}
                  value={cancelQty || ''}
                  onChange={(e) => setCancelQty(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cancellation Reason</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg p-2 text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="Stock permanently out of stock">Stock permanently out of stock</option>
                  <option value="Retailer cancelled requirement">Retailer cancelled requirement</option>
                  <option value="Pricing mismatch / terms conflict">Pricing mismatch / terms conflict</option>
                  <option value="Wrong item ordered by sales agent">Wrong item ordered by sales agent</option>
                  <option value="Other">Other (Enter below)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Additional Notes / Comments</label>
                <textarea
                  placeholder="Explain why this pending order quantity is being cancelled..."
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setActiveCancelRow(null)}
                className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-center"
              >
                Back
              </button>
              <button
                onClick={handleExecuteCancel}
                className="flex-1 py-2 bg-red-600 hover:bg-red-750 text-white rounded-lg font-bold shadow-sm transition-all text-center"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Last 5 Billing Rates Modal */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryTarget}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
        />
      )}
    </div>
  );
}

export default function PendingFulfilments() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400 py-12 text-center font-semibold">Loading pending fulfillments database...</div>}>
      <PendingFulfilmentsContent />
    </Suspense>
  );
}
