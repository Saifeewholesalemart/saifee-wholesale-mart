'use client';

import React, { useState } from 'react';
import { 
  Package, AlertTriangle, Layers, TrendingUp, DollarSign, 
  ArrowDownRight, ArrowUpRight, ShieldCheck, Warehouse
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getCurrentStock, getStockMovement 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { HorizontalBarChart } from '../ReportVisualizations';

interface InventoryReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function InventoryReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: InventoryReportsViewProps) {
  const [subTab, setSubTab] = useState<'current' | 'valuation' | 'movement' | 'low_stock'>('current');

  const stockRows = getCurrentStock(filters, dbState, userContext);
  const movementRows = getStockMovement(filters, dbState, userContext);
  const lowStockRows = stockRows.filter(r => r.stockStatus === 'Low Stock' || r.stockStatus === 'Out of Stock');

  // Company valuation breakdown
  const compValuationMap = new Map<string, { totalQty: number; totalValue: number }>();
  stockRows.forEach(s => {
    const curr = compValuationMap.get(s.companyName) || { totalQty: 0, totalValue: 0 };
    curr.totalQty += s.closingStockCartons;
    curr.totalValue += s.stockValue;
    compValuationMap.set(s.companyName, curr);
  });

  const companyValuationRows = Array.from(compValuationMap.entries()).map(([compName, data]) => ({
    companyName: compName,
    ...data
  }));

  const totalStockValue = stockRows.reduce((s, r) => s + r.stockValue, 0);
  const totalOpeningCartons = Number(stockRows.reduce((s, r) => s + r.openingStockCartons, 0).toFixed(2));
  const totalInwardCartons = Number(stockRows.reduce((s, r) => s + r.inwardStockCartons, 0).toFixed(2));
  const totalOutwardCartons = Number(stockRows.reduce((s, r) => s + r.outwardStockCartons, 0).toFixed(2));
  const totalClosingCartons = Number(stockRows.reduce((s, r) => s + r.closingStockCartons, 0).toFixed(2));

  const subTabs = [
    { id: 'current', label: 'Batch-wise Stock Report', icon: Package },
    { id: 'valuation', label: 'Stock Valuation Ledger', icon: DollarSign },
    { id: 'movement', label: 'Stock Movement Audit', icon: TrendingUp },
    { id: 'low_stock', label: 'Low Stock Shortages', icon: AlertTriangle }
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Active Batches</span>
          <p className="text-base sm:text-lg font-black text-slate-900">{stockRows.length} Batches</p>
          <span className="text-xs text-slate-500 font-medium">Godown inventory lines</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Closing Stock</span>
          <p className="text-base sm:text-lg font-black text-slate-800">{totalClosingCartons.toLocaleString('en-IN')} Cartons / Boxes</p>
          <span className="text-xs text-slate-500 font-medium">Opening: {totalOpeningCartons} &bull; In: {totalInwardCartons} &bull; Out: {totalOutwardCartons}</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-indigo-50/40 border-indigo-200">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Total Inventory Valuation</span>
          <p className="text-base sm:text-lg font-black text-indigo-700">{formatINR(totalStockValue)}</p>
          <span className="text-xs text-indigo-600 font-semibold">FIFO Cost Basis</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-amber-50/40 border-amber-200">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Low Stock Warnings</span>
          <p className="text-base sm:text-lg font-black text-amber-600">{lowStockRows.length} Batches</p>
          <span className="text-xs text-amber-700 font-semibold">Under reorder threshold</span>
        </div>
      </div>

      {/* Visual Chart */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          <HorizontalBarChart
            title="Inventory Value by FMCG Company"
            subtitle="Total holding stock valuation"
            items={companyValuationRows.map(c => ({
              label: c.companyName,
              subLabel: `${c.totalQty.toLocaleString('en-IN')} Cartons/Boxes`,
              value: c.totalValue
            }))}
          />

          <HorizontalBarChart
            title="Warehouse Stock Physical Volume"
            subtitle="Commercial carton/box holding share"
            isCurrency={false}
            items={companyValuationRows.map(c => ({
              label: c.companyName,
              value: c.totalQty,
              color: '#06b6d4'
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: BATCH-WISE STOCK REPORT */}
      {subTab === 'current' && (
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
                  <span className="text-xs text-slate-500 font-medium">{r.companyName} &bull; {r.brand} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></span>
                </div>
              );
            }},
            { header: 'Packing / Unit', render: (r) => (
              <span className="font-semibold text-slate-600">{r.variantPacking} ({r.tradingUnit})</span>
            )},
            { header: 'Batch #', key: 'batchNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{r.batchNumber}</span>
            )},
            { header: 'Expiry Date', key: 'expiryDate', render: (r) => (
              <span className="font-mono text-xs text-slate-700">{r.expiryDate || '—'}</span>
            )},
            { header: 'Opening Qty. (In Carton/Box)', key: 'openingStockCartons', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className="font-bold text-slate-800">{r.openingStockCartons.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {r.tradingUnit}</span>
              </div>
            )},
            { header: 'Inward Qty. (In Carton/Box)', key: 'inwardStockCartons', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className={r.inwardStockCartons > 0 ? "font-bold text-emerald-600" : "text-slate-400"}>
                  {r.inwardStockCartons > 0 ? `+${r.inwardStockCartons.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${r.tradingUnit}` : '—'}
                </span>
              </div>
            )},
            { header: 'Outward Qty. (In Carton/Box)', key: 'outwardStockCartons', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className={r.outwardStockCartons > 0 ? "font-bold text-rose-600" : "text-slate-400"}>
                  {r.outwardStockCartons > 0 ? `-${r.outwardStockCartons.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${r.tradingUnit}` : '—'}
                </span>
              </div>
            )},
            { header: 'Closing Qty. (In Carton/Box)', key: 'closingStockCartons', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {r.closingStockCartons.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {r.tradingUnit}
                </span>
              </div>
            )},
            { header: 'Purchase Rate', key: 'purchaseRate', format: 'currency', align: 'right', render: (r) => (
              <span className="font-medium text-slate-700">₹{r.purchaseRate.toLocaleString('en-IN')}/{r.tradingUnit}</span>
            )},
            { header: 'Stock Value', key: 'stockValue', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-indigo-700">{formatINR(r.stockValue)}</span>
            )},
            { header: 'Status', key: 'stockStatus', render: (r) => {
              const color = 
                r.stockStatus === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                r.stockStatus === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200';
              return (
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
                  {r.stockStatus}
                </span>
              );
            }, align: 'center' }
          ]}
          data={stockRows}
          totals={{
            productName: 'TOTALS',
            openingStockCartons: totalOpeningCartons,
            inwardStockCartons: totalInwardCartons,
            outwardStockCartons: totalOutwardCartons,
            closingStockCartons: totalClosingCartons,
            stockValue: totalStockValue
          }}
          searchPlaceholder="Search product, brand, batch number..."
        />
      )}

      {/* SUB-VIEW 2: STOCK VALUATION BY COMPANY */}
      {subTab === 'valuation' && (
        <ReportTable
          columns={[
            { header: 'FMCG Company', render: (r) => <span className="font-bold text-slate-800">{r.companyName}</span> },
            { header: 'Total Available (Cartons/Boxes)', key: 'totalQty', format: 'number', align: 'right' },
            { header: 'Total Holding Value', key: 'totalValue', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-indigo-700">{formatINR(r.totalValue)}</span>
            )},
            { header: 'Valuation Share %', render: (r) => (
              <span className="font-semibold text-slate-600">
                {totalStockValue > 0 ? `${((r.totalValue / totalStockValue) * 100).toFixed(1)}%` : '0%'}
              </span>
            ), align: 'right' }
          ]}
          data={companyValuationRows}
          totals={{
            companyName: 'TOTALS',
            totalQty: totalClosingCartons,
            totalValue: totalStockValue
          }}
          searchPlaceholder="Search company valuation..."
        />
      )}

      {/* SUB-VIEW 3: STOCK MOVEMENT AUDIT */}
      {subTab === 'movement' && (
        <ReportTable
          columns={[
            { header: 'Date', key: 'date' },
            { header: 'Movement Type', key: 'movementType', render: (r) => (
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                r.movementType.includes('Purchase') ? 'bg-emerald-50 text-emerald-700' :
                r.movementType.includes('Return') ? 'bg-amber-50 text-amber-700' :
                'bg-indigo-50 text-indigo-700'
              }`}>
                {r.movementType}
              </span>
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
                  <span className="text-xs text-slate-500 font-medium">{r.variantPacking} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></span>
                </div>
              );
            }},
            { header: 'Qty In (Cartons/Boxes)', key: 'quantityIn', format: 'number', align: 'right', render: (r) => (
              <span className={r.quantityIn > 0 ? 'font-bold text-emerald-600' : 'text-slate-300'}>
                {r.quantityIn > 0 ? `+${r.quantityIn} ${r.tradingUnit}` : '—'}
              </span>
            )},
            { header: 'Qty Out (Cartons/Boxes)', key: 'quantityOut', format: 'number', align: 'right', render: (r) => (
              <span className={r.quantityOut > 0 ? 'font-bold text-red-600' : 'text-slate-300'}>
                {r.quantityOut > 0 ? `-${r.quantityOut} ${r.tradingUnit}` : '—'}
              </span>
            )},
            { header: 'Unit Cost', key: 'unitCost', format: 'currency', align: 'right' },
            { header: 'Logged By', key: 'createdBy' }
          ]}
          data={movementRows}
          searchPlaceholder="Search stock movement transactions..."
        />
      )}

      {/* SUB-VIEW 4: LOW STOCK WARNINGS */}
      {subTab === 'low_stock' && (
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
                  <span className="text-xs text-slate-500 font-medium">{r.companyName} &bull; {r.brand} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></span>
                </div>
              );
            }},
            { header: 'Packing / Unit', render: (r) => (
              <span className="font-semibold text-slate-600">{r.variantPacking} ({r.tradingUnit})</span>
            )},
            { header: 'Batch #', key: 'batchNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-slate-800">{r.batchNumber}</span>
            )},
            { header: 'Available Qty (Cartons/Boxes)', key: 'closingStockCartons', format: 'number', align: 'right', render: (r) => (
              <span className="font-extrabold text-amber-600">{r.closingStockCartons} {r.tradingUnit} left</span>
            )},
            { header: 'Reorder Level', render: (r) => <span className="text-slate-500 font-semibold">5 {r.tradingUnit}</span>, align: 'center' },
            { header: 'Purchase Rate', key: 'purchaseRate', format: 'currency', align: 'right', render: (r) => (
              <span>₹{r.purchaseRate.toLocaleString('en-IN')}/{r.tradingUnit}</span>
            )},
            { header: 'Stock Status', key: 'stockStatus', render: (r) => (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {r.stockStatus}
              </span>
            ), align: 'center' }
          ]}
          data={lowStockRows}
          emptyMessage="All batches and products are well above minimum inventory reorder levels."
          searchPlaceholder="Search low stock shortages..."
        />
      )}
    </div>
  );
}
