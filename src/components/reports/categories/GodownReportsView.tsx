'use client';

import React from 'react';
import { Warehouse, Package, DollarSign, Layers, ShieldCheck } from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getCurrentStock 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';

interface GodownReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function GodownReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: GodownReportsViewProps) {
  const stockRows = getCurrentStock(filters, dbState, userContext);

  const totalStockValue = stockRows.reduce((s, r) => s + r.stockValue, 0);
  const totalUnits = stockRows.reduce((s, r) => s + r.availableStock, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Central Godown Facility</span>
          <p className="text-base sm:text-lg font-black text-slate-900">Main Distribution Godown</p>
          <span className="text-xs text-slate-500 font-medium">Location: Mumbai / Thane Hub</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Stored Stock</span>
          <p className="text-base sm:text-lg font-black text-slate-800">{totalUnits.toLocaleString('en-IN')} Cartons / Boxes</p>
          <span className="text-xs text-slate-500 font-medium">Commercial cartons / boxes</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-indigo-50/40 border-indigo-200">
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Warehouse Inventory Valuation</span>
          <p className="text-base sm:text-lg font-black text-indigo-700">{formatINR(totalStockValue)}</p>
          <span className="text-xs text-indigo-700 font-bold">FIFO Cost Basis</span>
        </div>
      </div>

      {/* Godown Stock Table */}
      <ReportTable
        columns={[
          { header: 'Godown / Facility', render: () => <span className="font-bold text-slate-800">Main Godown</span> },
          { header: 'Product Item', render: (r) => (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-extrabold text-slate-900">{r.productName}</span>
                {r.mrp && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                    MRP: ₹{r.mrp}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 font-medium">{r.companyName} &bull; {r.brand}</div>
            </div>
          )},
          { header: 'Packing / Unit', render: (r) => <span className="font-semibold text-slate-600">{r.variantPacking} ({r.tradingUnit})</span> },
          { header: 'Batch #', key: 'batchNumber', render: (r) => (
            <span className="font-mono text-xs font-bold text-slate-800">{r.batchNumber}</span>
          )},
          { header: 'Expiry Date', key: 'expiryDate' },
          { header: 'Closing Stock (Cartons/Boxes)', key: 'availableStock', format: 'number', align: 'right', render: (r) => (
            <span className="font-bold text-slate-900">{r.availableStock} {r.tradingUnit}</span>
          )},
          { header: 'Unit Cost', key: 'purchaseRate', format: 'currency', align: 'right', render: (r) => (
            <span>₹{r.purchaseRate.toLocaleString('en-IN')}/{r.tradingUnit}</span>
          )},
          { header: 'Holding Value', key: 'stockValue', format: 'currency', align: 'right', render: (r) => (
            <span className="font-extrabold text-indigo-700">{formatINR(r.stockValue)}</span>
          )},
          { header: 'Stock Status', key: 'stockStatus', render: (r) => {
            const color = 
              r.stockStatus === 'In Stock' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
              r.stockStatus === 'Low Stock' ? 'bg-amber-50 text-amber-800 border-amber-300' :
              'bg-red-50 text-red-800 border-red-300';
            return (
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
                {r.stockStatus}
              </span>
            );
          }, align: 'center' }
        ]}
        data={stockRows}
        totals={{
          facility: 'TOTALS',
          availableStock: totalUnits,
          stockValue: totalStockValue
        }}
        searchPlaceholder="Search warehouse stock..."
      />
    </div>
  );
}
