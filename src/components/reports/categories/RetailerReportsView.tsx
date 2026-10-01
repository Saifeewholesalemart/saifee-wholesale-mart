'use client';

import React, { useState } from 'react';
import { 
  Store, ShoppingCart, DollarSign, Clock, TrendingUp, 
  FileText, History, Tag, ShieldCheck, ChevronRight, User
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getRetailerSalesSummary, getRetailerOutstandingAging 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { AgingBucketsChart, HorizontalBarChart } from '../ReportVisualizations';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';

interface RetailerReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
  onSelectRetailer?: (retailerId: string) => void;
}

export default function RetailerReportsView({
  filters,
  dbState,
  userContext,
  showCharts,
  onSelectRetailer
}: RetailerReportsViewProps) {
  const [subTab, setSubTab] = useState<'summary' | 'history' | 'outstanding' | 'growth'>('summary');
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>(
    userContext.role === 'retailer' && userContext.retailerId 
      ? userContext.retailerId 
      : dbState.retailers[0]?.id || ''
  );

  // Modal for Last 5 Billing Rates inspection
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{
    retailerId: string;
    productId: string;
    tradingUnit: string;
  } | null>(null);

  const summary = getRetailerSalesSummary(filters, dbState, userContext);
  const outstandingAging = getRetailerOutstandingAging(filters, dbState, userContext);

  // Selected Retailer Details for Purchase History
  const selectedRetailer = dbState.retailers.find(r => r.id === selectedRetailerId);
  const retailerInvoices = dbState.invoices
    .filter(i => i.retailer_id === selectedRetailerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  const retailerOrders = dbState.orders
    .filter(o => o.retailer_id === selectedRetailerId)
    .sort((a, b) => b.order_date.localeCompare(a.order_date));

  const retailerPayments = dbState.payments
    .filter(p => p.retailer_id === selectedRetailerId)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Product purchase history with distinct product variants
  const productHistoryMap = new Map<string, {
    productName: string;
    variantPacking: string;
    tradingUnit: string;
    totalQuantity: number;
    totalAmount: number;
    lastBilledRate: number;
    lastBilledDate: string;
    invoiceCount: number;
  }>();

  retailerInvoices.forEach(inv => {
    inv.items?.forEach(item => {
      const prod = dbState.products.find(p => p.id === item.product_id);
      if (!prod) return;

      const curr = productHistoryMap.get(prod.id) || {
        productName: prod.name,
        variantPacking: prod.pack_size,
        tradingUnit: formatTradingUnit(prod.trading_unit),
        totalQuantity: 0,
        totalAmount: 0,
        lastBilledRate: item.rate - item.discount,
        lastBilledDate: inv.date.slice(0, 10),
        invoiceCount: 0
      };

      curr.totalQuantity += item.quantity;
      curr.totalAmount += item.total_amount;
      curr.invoiceCount += 1;
      productHistoryMap.set(prod.id, curr);
    });
  });

  const productHistoryRows = Array.from(productHistoryMap.entries()).map(([prodId, data]) => ({
    productId: prodId,
    ...data
  }));

  const subTabs = [
    { id: 'summary', label: 'Retailer Sales Summary', icon: Store },
    { id: 'history', label: 'Purchase & Rate History', icon: History },
    { id: 'outstanding', label: 'Outstanding Aging & Credit', icon: DollarSign },
    { id: 'growth', label: 'Retailer Growth & Frequency', icon: TrendingUp }
  ];

  // Aging totals for chart
  const agingTotals = {
    current: outstandingAging.reduce((s, r) => s + r.currentBucket, 0),
    days1to30: outstandingAging.reduce((s, r) => s + r.days1to30, 0),
    days31to60: outstandingAging.reduce((s, r) => s + r.days31to60, 0),
    days61to90: outstandingAging.reduce((s, r) => s + r.days61to90, 0),
    daysAbove90: outstandingAging.reduce((s, r) => s + r.daysAbove90, 0)
  };

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

      {/* Charts */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          <AgingBucketsChart
            title="Total Retailer Outstanding by Aging"
            buckets={[
              { label: 'Current (Not Due)', amount: agingTotals.current, color: '#10b981' },
              { label: '1–30 Days', amount: agingTotals.days1to30, color: '#3b82f6' },
              { label: '31–60 Days', amount: agingTotals.days31to60, color: '#f59e0b' },
              { label: '61–90 Days', amount: agingTotals.days61to90, color: '#f97316' },
              { label: '90+ Days Overdue', amount: agingTotals.daysAbove90, color: '#ef4444' }
            ]}
          />

          <HorizontalBarChart
            title="Top Retailers by Gross Purchases"
            subtitle="Ranked by total order billing value"
            items={summary.slice(0, 7).map(r => ({
              label: r.retailerName,
              subLabel: r.city,
              value: r.netSales
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: RETAILER SALES SUMMARY */}
      {subTab === 'summary' && (
        <ReportTable
          columns={[
            { header: 'Retailer Name', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.retailerName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.retailerCode} &bull; {r.city}</span>
              </div>
            )},
            { header: 'City', key: 'city' },
            { header: 'Orders', key: 'orderCount', format: 'number', align: 'center' },
            { header: 'Invoices', key: 'invoiceCount', format: 'number', align: 'center' },
            { header: 'Units Bought', key: 'totalQuantity', format: 'number', align: 'right' },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency', align: 'right' },
            { header: 'Discount', key: 'discount', format: 'currency', align: 'right' },
            { header: 'Net Sales', key: 'netSales', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            { header: 'Collection', key: 'collection', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-emerald-600">{formatINR(r.collection)}</span>
            )},
            { header: 'Outstanding', key: 'outstanding', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-red-600">{formatINR(r.outstanding)}</span>
            )},
            { header: 'Last Order', key: 'lastOrderDate' },
            { header: 'Last Invoice', key: 'lastInvoiceDate' }
          ]}
          data={summary}
          totals={{
            retailerName: 'TOTALS',
            orderCount: summary.reduce((s, r) => s + r.orderCount, 0),
            invoiceCount: summary.reduce((s, r) => s + r.invoiceCount, 0),
            totalQuantity: summary.reduce((s, r) => s + r.totalQuantity, 0),
            grossSales: summary.reduce((s, r) => s + r.grossSales, 0),
            discount: summary.reduce((s, r) => s + r.discount, 0),
            netSales: summary.reduce((s, r) => s + r.netSales, 0),
            collection: summary.reduce((s, r) => s + r.collection, 0),
            outstanding: summary.reduce((s, r) => s + r.outstanding, 0)
          }}
          onRowClick={(r) => {
            setSelectedRetailerId(r.retailerId);
            setSubTab('history');
          }}
          searchPlaceholder="Search retailer name, city, code..."
        />
      )}

      {/* SUB-VIEW 2: RETAILER PURCHASE HISTORY & LAST 5 BILLED RATES */}
      {subTab === 'history' && (
        <div className="space-y-6">
          {/* Retailer Selector Banner */}
          {userContext.role !== 'retailer' && (
            <div className="erp-card bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{selectedRetailer?.shop_name}</h3>
                  <p className="text-xs text-slate-400">
                    Code: {selectedRetailer?.retailer_code} &bull; Owner: {selectedRetailer?.owner_name} &bull; City: {selectedRetailer?.city || 'Indore'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-semibold">Select Store:</span>
                <select
                  value={selectedRetailerId}
                  onChange={(e) => setSelectedRetailerId(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none"
                >
                  {dbState.retailers.map(r => (
                    <option key={r.id} value={r.id}>{r.shop_name} ({r.city || 'Indore'})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Product-wise Purchase History Table with Last 5 Rates trigger */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Product Purchase Ledger &amp; Exact Variant Rates ({productHistoryRows.length} SKUs Billed)
              </h4>
              <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Click any row to audit last 5 billed rates
              </span>
            </div>

            <ReportTable
              columns={[
                { header: 'Product Item', render: (r) => {
                  const prod = dbState.products.find(p => p.id === r.productId);
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
                { header: 'Trading Unit', key: 'tradingUnit', align: 'center' },
                { header: 'Total Quantity', key: 'totalQuantity', format: 'number', align: 'right' },
                { header: 'Total Value', key: 'totalAmount', format: 'currency', align: 'right' },
                { header: 'Last Billed Rate', key: 'lastBilledRate', format: 'currency', align: 'right', render: (r) => (
                  <span className="font-extrabold text-indigo-700">{formatINR(r.lastBilledRate)}</span>
                )},
                { header: 'Last Billed Date', key: 'lastBilledDate' },
                { header: 'Rate History', render: (r) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRateHistoryTarget({
                        retailerId: selectedRetailerId,
                        productId: r.productId,
                        tradingUnit: r.tradingUnit
                      });
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded flex items-center gap-1 transition-colors border border-indigo-100"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View Last 5 Rates</span>
                  </button>
                ), align: 'center' }
              ]}
              data={productHistoryRows}
              totals={{
                productName: 'TOTALS',
                totalQuantity: productHistoryRows.reduce((s, p) => s + p.totalQuantity, 0),
                totalAmount: productHistoryRows.reduce((s, p) => s + p.totalAmount, 0)
              }}
              searchPlaceholder="Search purchased products..."
            />
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: RETAILER OUTSTANDING & AGING */}
      {subTab === 'outstanding' && (
        <ReportTable
          columns={[
            { header: 'Retailer Store', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.retailerName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.retailerCode} &bull; {r.city}</span>
              </div>
            )},
            { header: 'Total Invoiced', key: 'totalInvoiced', format: 'currency', align: 'right' },
            { header: 'Total Paid', key: 'totalPaid', format: 'currency', align: 'right' },
            { header: 'Total Outstanding', key: 'outstanding', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-red-600">{formatINR(r.outstanding)}</span>
            )},
            { header: 'Current (0d)', key: 'currentBucket', format: 'currency', align: 'right' },
            { header: '1–30 Days', key: 'days1to30', format: 'currency', align: 'right' },
            { header: '31–60 Days', key: 'days31to60', format: 'currency', align: 'right' },
            { header: '61–90 Days', key: 'days61to90', format: 'currency', align: 'right' },
            { header: 'Above 90 Days', key: 'daysAbove90', format: 'currency', align: 'right', render: (r) => (
              <span className={r.daysAbove90 > 0 ? 'font-bold text-red-600' : 'text-slate-400 font-medium'}>
                {formatINR(r.daysAbove90)}
              </span>
            )},
            { header: 'Oldest Bill', key: 'oldestOutstandingDate' },
            { header: 'Status', key: 'paymentStatus', render: (r) => (
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                r.paymentStatus === 'Clear' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                r.paymentStatus === 'Overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {r.paymentStatus}
              </span>
            ), align: 'center' }
          ]}
          data={outstandingAging}
          totals={{
            retailerName: 'TOTALS',
            totalInvoiced: outstandingAging.reduce((s, r) => s + r.totalInvoiced, 0),
            totalPaid: outstandingAging.reduce((s, r) => s + r.totalPaid, 0),
            outstanding: outstandingAging.reduce((s, r) => s + r.outstanding, 0),
            currentBucket: outstandingAging.reduce((s, r) => s + r.currentBucket, 0),
            days1to30: outstandingAging.reduce((s, r) => s + r.days1to30, 0),
            days31to60: outstandingAging.reduce((s, r) => s + r.days31to60, 0),
            days61to90: outstandingAging.reduce((s, r) => s + r.days61to90, 0),
            daysAbove90: outstandingAging.reduce((s, r) => s + r.daysAbove90, 0)
          }}
          searchPlaceholder="Search retailer outstanding..."
        />
      )}

      {/* SUB-VIEW 4: RETAILER GROWTH */}
      {subTab === 'growth' && (
        <div className="erp-card bg-white p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Retailer Growth &amp; Order Frequency Benchmark</h3>
          <p className="text-xs text-slate-500">
            Compare monthly order frequencies, basket sizes, and repeat replenishment intervals across the distribution network.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {summary.slice(0, 6).map(r => (
              <div key={r.retailerId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{r.retailerName}</h4>
                    <span className="text-xs text-slate-500 font-medium">{r.city} &bull; {r.retailerCode}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded border border-emerald-100">
                    Active
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Net Billed Value:</span>
                    <span className="font-bold text-slate-900">{formatINR(r.netSales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Commercial Units:</span>
                    <span className="font-semibold text-slate-800">{r.totalQuantity} Units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Invoiced Frequency:</span>
                    <span className="font-semibold text-slate-800">{r.invoiceCount} Bills</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Last 5 Billing Rates */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={Boolean(rateHistoryTarget)}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
        />
      )}
    </div>
  );
}
