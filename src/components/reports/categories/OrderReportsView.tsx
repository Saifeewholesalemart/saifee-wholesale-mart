'use client';

import React, { useState } from 'react';
import { 
  ShoppingCart, Clock, AlertTriangle, CheckCircle2, 
  Layers, Package, Store, Eye, XCircle
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getOrderSummary 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';

interface OrderReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function OrderReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: OrderReportsViewProps) {
  const [subTab, setSubTab] = useState<'summary' | 'pending' | 'status'>('summary');

  const orderRows = getOrderSummary(filters, dbState, userContext);

  // Pending Items derived from orders with pending quantity > 0
  const pendingItems: any[] = [];
  const now = new Date();

  dbState.orders.forEach(o => {
    const ret = dbState.retailers.find(r => r.id === o.retailer_id);
    const orderDate = new Date(o.order_date);
    const ageDays = Math.max(0, Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24)));

    o.items?.forEach(i => {
      const pending = i.pending_qty || 0;
      if (pending > 0) {
        const prod = dbState.products.find(p => p.id === i.product_id);
        pendingItems.push({
          orderNumber: o.order_number,
          orderDate: o.order_date.slice(0, 10),
          retailerName: ret?.shop_name || 'Retailer',
          city: ret?.city || 'Indore',
          productName: prod?.name || 'Product',
          variantPacking: prod?.pack_size || '',
          tradingUnit: formatTradingUnit(prod?.trading_unit || 'Box'),
          orderedQty: i.quantity,
          confirmedQty: i.confirmed_qty || 0,
          pendingQty: pending,
          ageDays: `${ageDays}d`
        });
      }
    });
  });

  const subTabs = [
    { id: 'summary', label: 'Order Summary Register', icon: ShoppingCart },
    { id: 'pending', label: 'Pending Fulfilment Backorders', icon: AlertTriangle },
    { id: 'status', label: 'Order Lifecycle Tracking', icon: Layers }
  ];

  return (
    <div className="space-y-6">
      {/* Subtabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 no-print">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Orders Booked</span>
          <p className="text-base sm:text-lg font-black text-slate-900">{orderRows.length} Orders</p>
          <span className="text-xs text-slate-500 font-medium">Across retail network</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Ordered Units</span>
          <p className="text-base sm:text-lg font-black text-slate-800">
            {orderRows.reduce((s, o) => s + o.orderedQty, 0).toLocaleString('en-IN')} Units
          </p>
          <span className="text-xs text-slate-500 font-medium">Commercial cartons/boxes</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-indigo-50/40 border-indigo-200">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Gross Order Value</span>
          <p className="text-base sm:text-lg font-black text-indigo-700">
            {formatINR(orderRows.reduce((s, o) => s + o.orderValue, 0))}
          </p>
          <span className="text-xs text-indigo-700 font-semibold">Demand booked</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-amber-50/40 border-amber-200">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Pending Backorders</span>
          <p className="text-base sm:text-lg font-black text-amber-600">{pendingItems.length} Line Items</p>
          <span className="text-xs text-amber-700 font-semibold">Awaiting stock in-flow</span>
        </div>
      </div>

      {/* SUB-VIEW 1: ORDER SUMMARY */}
      {subTab === 'summary' && (
        <ReportTable
          columns={[
            { header: 'Order #', key: 'orderNumber', render: (r) => (
              <span className="font-bold text-indigo-600 hover:underline">{r.orderNumber}</span>
            )},
            { header: 'Order Date', key: 'orderDate' },
            { header: 'Retailer Store', render: (r) => <span className="font-bold text-slate-800">{r.retailerName}</span> },
            { header: 'Booked By', key: 'salespersonName' },
            { header: 'Items', key: 'itemCount', format: 'number', align: 'center' },
            { header: 'Ordered', key: 'orderedQty', format: 'number', align: 'right' },
            { header: 'Confirmed', key: 'confirmedQty', format: 'number', align: 'right', render: (r) => (
              <span className="font-semibold text-emerald-600">{r.confirmedQty}</span>
            )},
            { header: 'Pending', key: 'pendingQty', format: 'number', align: 'right', render: (r) => (
              <span className={r.pendingQty > 0 ? 'font-bold text-amber-600' : 'text-slate-400'}>
                {r.pendingQty}
              </span>
            )},
            { header: 'Order Value', key: 'orderValue', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-slate-900">{formatINR(r.orderValue)}</span>
            )},
            { header: 'Status', key: 'status', render: (r) => {
              const color = 
                r.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                r.status === 'Dispatched' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                r.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200';
              return (
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
                  {r.status}
                </span>
              );
            }, align: 'center' }
          ]}
          data={orderRows}
          totals={{
            orderNumber: 'TOTAL',
            orderedQty: orderRows.reduce((s, o) => s + o.orderedQty, 0),
            confirmedQty: orderRows.reduce((s, o) => s + o.confirmedQty, 0),
            pendingQty: orderRows.reduce((s, o) => s + o.pendingQty, 0),
            orderValue: orderRows.reduce((s, o) => s + o.orderValue, 0)
          }}
          searchPlaceholder="Search order number, retailer, salesperson..."
        />
      )}

      {/* SUB-VIEW 2: PENDING FULFILMENT */}
      {subTab === 'pending' && (
        <ReportTable
          columns={[
            { header: 'Order #', key: 'orderNumber', render: (r) => (
              <span className="font-bold text-indigo-600">{r.orderNumber}</span>
            )},
            { header: 'Order Date', key: 'orderDate' },
            { header: 'Retailer', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.retailerName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.city}</span>
              </div>
            )},
            { header: 'Product Item', render: (r) => {
              const prod = dbState.products.find(p => p.id === (r as any).productId || p.name === r.productName);
              const mrpVal = prod?.mrp || (r as any).mrp;
              return (
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-800">{r.productName}</span>
                    {mrpVal && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                        MRP: ₹{mrpVal}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{r.variantPacking}</span>
                </div>
              );
            }},
            { header: 'Ordered', key: 'orderedQty', format: 'number', align: 'right' },
            { header: 'Confirmed', key: 'confirmedQty', format: 'number', align: 'right' },
            { header: 'Pending Backorder', key: 'pendingQty', format: 'number', align: 'right', render: (r) => (
              <span className="font-extrabold text-amber-600">{r.pendingQty} {r.tradingUnit}</span>
            )},
            { header: 'Ageing', key: 'ageDays', align: 'center' }
          ]}
          data={pendingItems}
          totals={{
            orderNumber: 'TOTAL',
            pendingQty: pendingItems.reduce((s, i) => s + i.pendingQty, 0)
          }}
          emptyMessage="No pending backorder items. All booked quantities are fulfilled!"
          searchPlaceholder="Search backorders, products..."
        />
      )}

      {/* SUB-VIEW 3: ORDER LIFECYCLE STATUS */}
      {subTab === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['Submitted', 'Confirmed', 'Packing', 'Dispatched', 'Delivered', 'Cancelled'] as const).map(st => {
            const matches = orderRows.filter(o => o.status === st);
            const val = matches.reduce((s, o) => s + o.orderValue, 0);
            return (
              <div key={st} className="erp-card bg-white p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">{st} Orders</h4>
                  <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-slate-100 text-slate-700">
                    {matches.length}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-black text-slate-900">{formatINR(val)}</p>
                  <span className="text-xs text-slate-500 font-semibold">
                    {matches.reduce((s, o) => s + o.orderedQty, 0)} commercial units
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
