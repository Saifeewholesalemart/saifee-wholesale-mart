'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import Link from 'next/link';
import { 
  TrendingUp, ShoppingCart, Users, AlertTriangle, 
  ArrowUpRight, Plus, Cpu, Package, FileText, CheckCircle2,
  Clock, Truck, Receipt, CreditCard, ChevronRight, MapPin,
  ClipboardList, Sparkles, Layers, ShieldCheck, Warehouse, ArrowRightLeft
} from 'lucide-react';

export default function AdminDashboard() {
  const { orders, invoices, retailers, inventory, products, companies, batches, godowns, stockTransfers } = useDb();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayInvoices = invoices.filter(inv => inv.date.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.grand_total, 0);

  const todayOrders = orders.filter(ord => ord.order_date.startsWith(todayStr));

  // Multi-Godown Live Storage Stats
  const godownStats = useMemo(() => {
    return godowns.map(g => {
      const gInv = inventory.filter(inv => inv.godown_id === g.id);
      const totalPhysicalCartons = gInv.reduce((sum, inv) => {
        const p = products.find(prod => prod.id === inv.product_id);
        const upb = p?.units_per_box_carton || 1;
        return sum + Math.floor(inv.physical_qty / upb);
      }, 0);
      const totalAvailableCartons = gInv.reduce((sum, inv) => {
        const p = products.find(prod => prod.id === inv.product_id);
        const upb = p?.units_per_box_carton || 1;
        return sum + Math.floor(inv.available_qty / upb);
      }, 0);
      const totalValuation = gInv.reduce((sum, inv) => {
        const p = products.find(prod => prod.id === inv.product_id);
        return sum + (inv.physical_qty * (p?.purchase_price || 0) / (p?.units_per_box_carton || 1));
      }, 0);
      const activeTransfersOut = stockTransfers.filter(t => t.from_godown_id === g.id && (t.status === 'Dispatched' || t.status === 'Received')).length;
      const activeTransfersIn = stockTransfers.filter(t => t.to_godown_id === g.id && (t.status === 'Dispatched' || t.status === 'Received')).length;

      return {
        ...g,
        physicalCartons: totalPhysicalCartons,
        availableCartons: totalAvailableCartons,
        valuation: Math.round(totalValuation),
        activeTransfersOut,
        activeTransfersIn
      };
    });
  }, [godowns, inventory, products, stockTransfers]);

  // Operational Order Pipeline counts
  const newOrders = orders.filter(ord => ord.status === 'Submitted');
  const underReviewOrders = orders.filter(ord => ord.status === 'Under Review');
  const readyPackingOrders = orders.filter(ord => ord.status === 'Confirmed' || ord.status === 'Partially Confirmed');
  const readyDispatchOrders = orders.filter(ord => ord.status === 'Packed');
  const dispatchedOrders = orders.filter(ord => ord.status === 'Dispatched');
  const deliveredOrders = orders.filter(ord => ord.status === 'Delivered');

  // Pending Backorder Stats
  const eligiblePendingOrders = orders.filter(o => 
    o.status !== 'Delivered' && 
    o.status !== 'Cancelled' && 
    o.items?.some(item => (item.pending_qty || 0) > 0)
  );

  const pendingRetailersCount = new Set(eligiblePendingOrders.map(o => o.retailer_id)).size;
  const pendingOrdersCount = eligiblePendingOrders.length;
  
  let pendingCartonsCount = 0;
  eligiblePendingOrders.forEach(o => {
    o.items?.forEach(item => {
      const p = item.pending_qty || 0;
      if (p > 0) pendingCartonsCount += p;
    });
  });

  // City-wise pending backorder aggregation
  const cityPendingMap = useMemo(() => {
    const map: { [city: string]: { orderCount: number; cartonCount: number; retailerCount: Set<string> } } = {};
    eligiblePendingOrders.forEach(ord => {
      const ret = retailers.find(r => r.id === ord.retailer_id);
      const city = ret?.city || 'Indore';
      if (!map[city]) {
        map[city] = { orderCount: 0, cartonCount: 0, retailerCount: new Set<string>() };
      }
      map[city].orderCount += 1;
      map[city].retailerCount.add(ord.retailer_id);
      ord.items?.forEach(i => {
        map[city].cartonCount += (i.pending_qty || 0);
      });
    });
    return map;
  }, [eligiblePendingOrders, retailers]);

  const totalOutstanding = retailers.reduce((sum, ret) => sum + ret.outstanding, 0);

  // Low stock count (available_qty < 10) & Out of stock
  const lowStockCount = inventory.filter(inv => inv.available_qty > 0 && inv.available_qty < 10).length;
  const outOfStockCount = inventory.filter(inv => inv.available_qty <= 0).length;

  // Batches expiring within 90 days
  const nowTime = Date.now();
  const ninetyDaysTime = nowTime + 90 * 86400000;
  const expiringBatchesCount = batches.filter(b => {
    const expTime = new Date(b.expiry_date).getTime();
    return expTime > nowTime && expTime <= ninetyDaysTime && b.quantity > 0;
  }).length;

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
    .slice(0, 6);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Calculate Company Share of Seed Products for Chart
  const companyCounts = companies.map(c => {
    const count = products.filter(p => p.company_id === c.id).length;
    return { name: c.name.split(' ')[0], count };
  }).filter(c => c.count > 0).slice(0, 6);
  const maxProductCount = Math.max(...companyCounts.map(c => c.count), 1);

  if (!mounted) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold text-sm">
        Loading Operations Hub...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Saifee Stores &bull; Distributor Operations Hub</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time pipeline: Review &rarr; Confirmation &rarr; Batch Allocation &rarr; Dispatch &rarr; Invoicing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/orders"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Order Processing Portal</span>
          </Link>
          <Link
            href="/admin/orders?new_counter=true"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New POS Sale</span>
          </Link>
        </div>
      </div>

      {/* Primary Financial & Volume KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Today's Sales Revenue</span>
            <span className="text-2xl font-black text-slate-800">₹{todaySales.toLocaleString('en-IN')}</span>
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{todayInvoices.length} Invoices generated</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Outstanding */}
        <Link href="/admin/invoices">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-red-300 transition-all h-full">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Total Outstanding</span>
              <span className="text-2xl font-black text-red-600">₹{totalOutstanding.toLocaleString('en-IN')}</span>
              <span className="text-xs text-slate-500 font-medium">
                Across {retailers.filter(r => r.outstanding > 0).length} Retailers
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </Link>

        {/* Stock Shortage Alerts */}
        <Link href="/admin/inventory">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-amber-300 transition-all h-full">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Inventory Shortages</span>
              <span className="text-2xl font-black text-amber-600">{outOfStockCount} OOS / {lowStockCount} Low</span>
              <span className="text-xs text-amber-700 font-bold">
                Generate Inward Purchase Orders
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </Link>

        {/* Expiring Batches */}
        <Link href="/admin/reports?tab=batch_expiry">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-purple-300 transition-all h-full">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Batches Expiring Soon</span>
              <span className="text-2xl font-black text-purple-700">{expiringBatchesCount} Batches</span>
              <span className="text-xs text-purple-600 font-semibold">
                Within 90 Days (FEFO Priority)
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </Link>
      </div>

      {/* Operational Fulfilment Pipeline Stages (Clickable Deep Links) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Operational Fulfilment Pipeline</span>
          </h3>
          <Link href="/admin/orders" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
            <span>View All Orders</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {/* 1. New Orders */}
          <Link href="/admin/orders?status=Submitted">
            <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">1. New</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 group-hover:animate-ping" />
              </div>
              <span className="text-xl font-black text-amber-600 block mt-1">{newOrders.length}</span>
              <span className="text-xs font-medium text-slate-500 block mt-0.5">Submitted</span>
            </div>
          </Link>

          {/* 2. Under Review */}
          <Link href="/admin/orders?status=Under%20Review">
            <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">2. Review</span>
                <span className="w-2 h-2 rounded-full bg-blue-400" />
              </div>
              <span className="text-xl font-black text-blue-600 block mt-1">{underReviewOrders.length}</span>
              <span className="text-xs font-medium text-slate-500 block mt-0.5">Under Review</span>
            </div>
          </Link>

          {/* 3. Confirmed / Packing */}
          <Link href="/admin/orders?status=Confirmed">
            <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">3. Allocate</span>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              </div>
              <span className="text-xl font-black text-purple-700 block mt-1">{readyPackingOrders.length}</span>
              <span className="text-xs font-medium text-slate-500 block mt-0.5">Ready to Pack</span>
            </div>
          </Link>

          {/* 4. Packed / Ready for Dispatch */}
          <Link href="/admin/orders?status=Packed">
            <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">4. Dispatch</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-xl font-black text-emerald-700 block mt-1">{readyDispatchOrders.length}</span>
              <span className="text-xs font-medium text-slate-500 block mt-0.5">Ready for Van</span>
            </div>
          </Link>

          {/* 5. Dispatched */}
          <Link href="/admin/orders?status=Dispatched">
            <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">5. Invoiced</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <span className="text-xl font-black text-indigo-700 block mt-1">{dispatchedOrders.length}</span>
              <span className="text-xs font-medium text-slate-500 block mt-0.5">Dispatched</span>
            </div>
          </Link>

          {/* 6. Pending Backorders */}
          <Link href="/admin/orders?pending_only=true">
            <div className="bg-white p-4 rounded-xl border border-cyan-200 bg-cyan-50/20 hover:border-cyan-400 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-700 uppercase">Backorders</span>
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
              </div>
              <span className="text-xl font-black text-cyan-800 block mt-1">{pendingOrdersCount}</span>
              <span className="text-xs font-bold text-cyan-600 block mt-0.5">{pendingCartonsCount} Cartons</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Multi-Godown Warehouse Network & Live Stock Distribution */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Multi-Godown Storage Network</h3>
              <p className="text-xs text-slate-500">Live storage facility stock allocation, valuation, and inter-godown logistics</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/inventory"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-indigo-200"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Inter-Godown Transfers</span>
            </Link>
            <Link
              href="/admin/godowns"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200"
            >
              <span>Manage Facilities</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {godownStats.map((g) => (
            <div key={g.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    g.is_default ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {g.code}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">{g.name}</h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {g.city || 'Indore'} {g.manager_name ? `• ${g.manager_name}` : ''}
                    </span>
                  </div>
                </div>
                {g.is_default && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Default
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Physical</span>
                  <span className="font-black text-slate-900 text-sm">{g.physicalCartons} <span className="text-[10px] text-slate-500 font-normal">ctn</span></span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Available</span>
                  <span className="font-black text-emerald-600 text-sm">{g.availableCartons} <span className="text-[10px] text-emerald-700 font-normal">ctn</span></span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Valuation</span>
                  <span className="font-black text-slate-800 text-xs mt-0.5 block">₹{(g.valuation / 1000).toFixed(1)}k</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                {(g.activeTransfersOut > 0 || g.activeTransfersIn > 0) ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{g.activeTransfersOut + g.activeTransfersIn} Transfer(s)</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">No pending transfers</span>
                )}
                <Link
                  href="/admin/inventory"
                  className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-0.5 text-xs"
                >
                  <span>View Stock</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: City-Wise Pending Backorders & Product Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* City-Wise Pending Fulfilments Widget */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-600" />
              <span>City Backorders</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {Object.keys(cityPendingMap).length} Cities
            </span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(cityPendingMap).length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
                <p className="font-bold text-slate-600">All regional orders fully fulfilled!</p>
              </div>
            ) : (
              Object.entries(cityPendingMap).map(([cityName, stat]) => (
                <Link
                  key={cityName}
                  href={`/admin/orders?city=${encodeURIComponent(cityName)}&pending_only=true`}
                  className="p-3 bg-slate-50 hover:bg-cyan-50 border border-slate-100 hover:border-cyan-200 rounded-xl flex items-center justify-between transition-colors group block"
                >
                  <div>
                    <span className="font-extrabold text-slate-800 text-xs group-hover:text-cyan-900 block">{cityName}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {stat.retailerCount.size} Stores &bull; {stat.orderCount} Pending Orders
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded font-black text-xs">
                      {stat.cartonCount} CTN
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* FMCG Company Master Breakdown */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Product Master Breakdown</h3>
            <span className="text-xs font-bold text-slate-500">Total SKUs: {products.length}</span>
          </div>
          <div className="space-y-3.5 pt-1">
            {companyCounts.map((c) => {
              const pct = (c.count / maxProductCount) * 100;
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span className="font-bold text-slate-700">{c.name}</span>
                    <span>{c.count} items seeded</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Grid: Recent Orders & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Orders with Quick Processing Link */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Recent Orders</h3>
            <Link href="/admin/orders" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentOrders.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No recent orders recorded.</div>
            ) : (
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5">Order #</th>
                    <th className="py-2.5">Retailer</th>
                    <th className="py-2.5">Total</th>
                    <th className="py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentOrders.map((ord) => {
                    const ret = retailers.find(r => r.id === ord.retailer_id);
                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5">
                          <Link href="/admin/orders" className="font-extrabold text-indigo-600 hover:underline">
                            {ord.order_number}
                          </Link>
                        </td>
                        <td className="py-2.5 text-slate-800 truncate max-w-[140px] font-bold">{ret?.shop_name || 'Retailer'}</td>
                        <td className="py-2.5 font-black text-slate-900">₹{ord.total_amount.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right">
                          <span className={`px-2.5 py-0.5 rounded-[4px] text-xs font-bold uppercase ${
                            ord.status === 'Submitted' ? 'bg-amber-100 text-amber-800' :
                            ord.status === 'Under Review' ? 'bg-blue-100 text-blue-800' :
                            ord.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                            ord.status === 'Packed' ? 'bg-purple-100 text-purple-800' :
                            ord.status === 'Dispatched' ? 'bg-indigo-100 text-indigo-800' :
                            ord.status === 'Delivered' ? 'bg-emerald-600 text-white' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Recent Invoices</h3>
            <Link href="/admin/invoices" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentInvoices.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No invoices generated yet.</div>
            ) : (
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5">Invoice #</th>
                    <th className="py-2.5">Retailer</th>
                    <th className="py-2.5">Grand Total</th>
                    <th className="py-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentInvoices.map((inv) => {
                    const ret = retailers.find(r => r.id === inv.retailer_id);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-bold text-slate-800">{inv.invoice_number}</td>
                        <td className="py-2.5 text-slate-800 truncate max-w-[140px] font-bold">{ret?.shop_name}</td>
                        <td className="py-2.5 font-black text-slate-900">₹{inv.grand_total.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 text-right font-black text-red-600">₹{inv.outstanding_amount.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
