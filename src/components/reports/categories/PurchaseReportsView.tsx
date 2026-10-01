'use client';

import React, { useState } from 'react';
import { 
  PackageCheck, Truck, History, DollarSign, Calendar, 
  Layers, Package, ShieldCheck
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getPurchaseSummary, getPurchaseRateHistory 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { HorizontalBarChart } from '../ReportVisualizations';

interface PurchaseReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function PurchaseReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: PurchaseReportsViewProps) {
  const [subTab, setSubTab] = useState<'summary' | 'product' | 'rates' | 'supplier'>('summary');

  if (userContext.role === 'retailer') {
    return (
      <div className="erp-card bg-white p-12 text-center space-y-3 border-amber-200">
        <h3 className="text-sm font-bold text-slate-800">Access Restricted</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Distributor supplier procurement data is restricted to distributor management.
        </p>
      </div>
    );
  }

  const purchaseSummary = getPurchaseSummary(filters, dbState, userContext);
  const rateHistory = getPurchaseRateHistory(filters, dbState, userContext);

  // Supplier-wise aggregation
  const suppMap = new Map<string, {
    invoiceCount: number;
    quantity: number;
    purchaseValue: number;
    gst: number;
    totalAmount: number;
  }>();

  purchaseSummary.forEach(p => {
    const curr = suppMap.get(p.supplierName) || {
      invoiceCount: 0,
      quantity: 0,
      purchaseValue: 0,
      gst: 0,
      totalAmount: 0
    };
    curr.invoiceCount += 1;
    curr.quantity += p.totalQuantity;
    curr.purchaseValue += p.purchaseValue;
    curr.gst += p.gst;
    curr.totalAmount += p.totalPurchaseAmount;
    suppMap.set(p.supplierName, curr);
  });

  const supplierRows = Array.from(suppMap.entries()).map(([suppName, agg]) => ({
    supplierName: suppName,
    ...agg
  }));

  const subTabs = [
    { id: 'summary', label: 'Inward Purchase Register', icon: PackageCheck },
    { id: 'rates', label: 'Variant Inward Rate History', icon: History },
    { id: 'supplier', label: 'Supplier Procurement Summary', icon: Truck }
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Inward Bills</span>
          <p className="text-base sm:text-lg font-black text-slate-900">{purchaseSummary.length} Invoices</p>
          <span className="text-xs text-slate-500 font-medium">Confirmed purchases</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Quantity Inwarded</span>
          <p className="text-base sm:text-lg font-black text-slate-800">
            {purchaseSummary.reduce((s, p) => s + p.totalQuantity, 0).toLocaleString('en-IN')} Units
          </p>
          <span className="text-xs text-slate-500 font-medium">CTN / BOX / BAG</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Purchase Taxable Value</span>
          <p className="text-base sm:text-lg font-black text-slate-700">
            {formatINR(purchaseSummary.reduce((s, p) => s + p.purchaseValue, 0))}
          </p>
          <span className="text-xs text-slate-500 font-medium">Pre-tax stock value</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-emerald-50/40 border-emerald-200">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Total Procurement Cost</span>
          <p className="text-base sm:text-lg font-black text-emerald-700">
            {formatINR(purchaseSummary.reduce((s, p) => s + p.totalPurchaseAmount, 0))}
          </p>
          <span className="text-xs text-emerald-700 font-bold">Inclusive of GST</span>
        </div>
      </div>

      {/* Visual Chart */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          <HorizontalBarChart
            title="Procurement by Wholesale Supplier"
            subtitle="Total purchase invoice amount"
            items={supplierRows.map(s => ({
              label: s.supplierName,
              subLabel: `${s.invoiceCount} bills`,
              value: s.totalAmount,
              color: '#3b82f6'
            }))}
          />

          <HorizontalBarChart
            title="Inward Units by Supplier"
            subtitle="Commercial carton/box counts"
            isCurrency={false}
            items={supplierRows.map(s => ({
              label: s.supplierName,
              value: s.quantity,
              color: '#10b981'
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: PURCHASE INWARD SUMMARY */}
      {subTab === 'summary' && (
        <ReportTable
          columns={[
            { header: 'Inward Date', key: 'purchaseDate' },
            { header: 'Supplier', render: (r) => <span className="font-bold text-slate-800">{r.supplierName}</span> },
            { header: 'Supplier Bill #', key: 'invoiceNumber', render: (r) => (
              <span className="font-semibold text-indigo-600">{r.invoiceNumber}</span>
            )},
            { header: 'Items', key: 'itemCount', format: 'number', align: 'center' },
            { header: 'Units', key: 'totalQuantity', format: 'number', align: 'right' },
            { header: 'Taxable Value', key: 'purchaseValue', format: 'currency', align: 'right' },
            { header: 'Discount', key: 'discount', format: 'currency', align: 'right' },
            { header: 'GST Paid', key: 'gst', format: 'currency', align: 'right' },
            { header: 'Total Invoiced', key: 'totalPurchaseAmount', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-slate-900">{formatINR(r.totalPurchaseAmount)}</span>
            )},
            { header: 'Godown', key: 'godown' },
            { header: 'Status', key: 'status', render: (r) => (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {r.status}
              </span>
            ), align: 'center' }
          ]}
          data={purchaseSummary}
          totals={{
            purchaseDate: 'TOTALS',
            totalQuantity: purchaseSummary.reduce((s, p) => s + p.totalQuantity, 0),
            purchaseValue: purchaseSummary.reduce((s, p) => s + p.purchaseValue, 0),
            discount: purchaseSummary.reduce((s, p) => s + p.discount, 0),
            gst: purchaseSummary.reduce((s, p) => s + p.gst, 0),
            totalPurchaseAmount: purchaseSummary.reduce((s, p) => s + p.totalPurchaseAmount, 0)
          }}
          searchPlaceholder="Search supplier, bill number..."
        />
      )}

      {/* SUB-VIEW 2: VARIANT INWARD RATE HISTORY */}
      {subTab === 'rates' && (
        <ReportTable
          columns={[
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
                  <span className="text-xs text-slate-500 font-medium">{r.variantPacking} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></span>
                </div>
              );
            }},
            { header: 'Inward Date', key: 'purchaseDate' },
            { header: 'Supplier', key: 'supplierName' },
            { header: 'Bill #', key: 'invoiceNumber' },
            { header: 'Batch #', key: 'batchNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-indigo-700">{r.batchNumber}</span>
            )},
            { header: 'Expiry Date', key: 'expiryDate' },
            { header: 'Inward Qty', key: 'quantity', format: 'number', align: 'right', render: (r) => (
              <span className="font-semibold text-slate-800">{r.quantity} {r.tradingUnit}</span>
            )},
            { header: 'Purchase Rate', key: 'purchaseRate', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-slate-900">{formatINR(r.purchaseRate)}</span>
            )},
            { header: 'Landed Cost (w/ GST)', key: 'landedCost', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-emerald-600">{formatINR(r.landedCost)}</span>
            )}
          ]}
          data={rateHistory}
          totals={{
            productName: 'TOTALS',
            quantity: rateHistory.reduce((s, r) => s + r.quantity, 0)
          }}
          searchPlaceholder="Search product, batch number, supplier..."
        />
      )}

      {/* SUB-VIEW 3: SUPPLIER SUMMARY */}
      {subTab === 'supplier' && (
        <ReportTable
          columns={[
            { header: 'Supplier Vendor', render: (r) => <span className="font-bold text-slate-800">{r.supplierName}</span> },
            { header: 'Inward Invoices', key: 'invoiceCount', format: 'number', align: 'center' },
            { header: 'Units Procured', key: 'quantity', format: 'number', align: 'right' },
            { header: 'Taxable Goods Value', key: 'purchaseValue', format: 'currency', align: 'right' },
            { header: 'GST Paid', key: 'gst', format: 'currency', align: 'right' },
            { header: 'Total Purchase Amount', key: 'totalAmount', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-slate-900">{formatINR(r.totalAmount)}</span>
            )}
          ]}
          data={supplierRows}
          totals={{
            supplierName: 'TOTALS',
            invoiceCount: supplierRows.reduce((s, r) => s + r.invoiceCount, 0),
            quantity: supplierRows.reduce((s, r) => s + r.quantity, 0),
            purchaseValue: supplierRows.reduce((s, r) => s + r.purchaseValue, 0),
            gst: supplierRows.reduce((s, r) => s + r.gst, 0),
            totalAmount: supplierRows.reduce((s, r) => s + r.totalAmount, 0)
          }}
          searchPlaceholder="Search supplier..."
        />
      )}
    </div>
  );
}
