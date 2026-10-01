'use client';

import React, { useState } from 'react';
import { 
  Calendar, AlertTriangle, Package, CheckCircle2, 
  Layers, Clock, DollarSign, XCircle
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getBatchExpiryReport 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';

interface BatchExpiryReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function BatchExpiryReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: BatchExpiryReportsViewProps) {
  const [subTab, setSubTab] = useState<'all' | 'expiring' | 'expired'>('all');

  const batchRows = getBatchExpiryReport(filters, dbState, userContext);
  const expiringRows = batchRows.filter(b => b.daysRemaining > 0 && b.daysRemaining <= 90);
  const expiredRows = batchRows.filter(b => b.daysRemaining <= 0);

  const totalOpeningCartons = Number(batchRows.reduce((s, b) => s + b.openingQuantity, 0).toFixed(2));
  const totalInwardCartons = Number(batchRows.reduce((s, b) => s + b.inwardQuantity, 0).toFixed(2));
  const totalOutwardCartons = Number(batchRows.reduce((s, b) => s + b.outwardQuantity, 0).toFixed(2));
  const totalClosingCartons = Number(batchRows.reduce((s, b) => s + b.availableQuantity, 0).toFixed(2));
  const totalBatchValue = batchRows.reduce((s, b) => s + b.stockValue, 0);

  const subTabs = [
    { id: 'all', label: 'Batch-wise Stock Register', icon: Layers },
    { id: 'expiring', label: 'Expiring Stock (< 90 Days)', icon: AlertTriangle },
    { id: 'expired', label: 'Expired Stock Register', icon: XCircle }
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
          <p className="text-base sm:text-lg font-black text-slate-900">{batchRows.length} Batches</p>
          <span className="text-xs text-slate-500 font-medium">In physical storage</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-amber-50/40 border-amber-200">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Expiring within 90d</span>
          <p className="text-base sm:text-lg font-black text-amber-700">{expiringRows.length} Batches</p>
          <span className="text-xs text-amber-800 font-bold">Priority dispatch</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-rose-50/40 border-rose-200">
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">Expired Stock Batches</span>
          <p className="text-base sm:text-lg font-black text-rose-700">{expiredRows.length} Batches</p>
          <span className="text-xs text-rose-800 font-bold">Requires write-off</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-indigo-50/40 border-indigo-200">
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Total Batch Value</span>
          <p className="text-base sm:text-lg font-black text-indigo-700">
            {formatINR(totalBatchValue)}
          </p>
          <span className="text-xs text-indigo-700 font-bold">{totalClosingCartons.toLocaleString('en-IN')} Cartons/Boxes</span>
        </div>
      </div>

      {/* SUB-VIEW 1: ALL BATCHES */}
      {subTab === 'all' && (
        <ReportTable
          columns={[
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
                <div className="text-xs text-slate-500 font-medium">{r.companyName} &bull; {r.variantPacking} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></div>
              </div>
            )},
            { header: 'Packing / Unit', render: (r) => (
              <span className="font-semibold text-slate-600">{r.variantPacking} ({r.tradingUnit})</span>
            )},
            { header: 'Batch #', key: 'batchNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{r.batchNumber}</span>
            )},
            { header: 'Expiry Date', key: 'expiryDate' },
            { header: 'Days Remaining', key: 'daysRemaining', render: (r) => {
              if (r.daysRemaining <= 0) return <span className="font-bold text-xs text-rose-700">Expired</span>;
              if (r.daysRemaining <= 30) return <span className="font-bold text-xs text-rose-600">{r.daysRemaining} days</span>;
              if (r.daysRemaining <= 90) return <span className="font-bold text-xs text-amber-700">{r.daysRemaining} days</span>;
              return <span className="font-bold text-xs text-emerald-700">{r.daysRemaining} days</span>;
            }, align: 'right' },
            { header: 'Opening Qty. (In Carton/Box)', key: 'openingQuantity', format: 'number', align: 'right', render: (r) => (
              <div className="text-right font-bold text-slate-800">
                {r.openingQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {r.tradingUnit}
              </div>
            )},
            { header: 'Inward Qty. (In Carton/Box)', key: 'inwardQuantity', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className={r.inwardQuantity > 0 ? "font-bold text-emerald-600" : "text-slate-400"}>
                  {r.inwardQuantity > 0 ? `+${r.inwardQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${r.tradingUnit}` : '—'}
                </span>
              </div>
            )},
            { header: 'Outward Qty. (In Carton/Box)', key: 'outwardQuantity', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className={r.outwardQuantity > 0 ? "font-bold text-rose-600" : "text-slate-400"}>
                  {r.outwardQuantity > 0 ? `-${r.outwardQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${r.tradingUnit}` : '—'}
                </span>
              </div>
            )},
            { header: 'Closing Qty. (In Carton/Box)', key: 'availableQuantity', format: 'number', align: 'right', render: (r) => (
              <div className="text-right">
                <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {r.availableQuantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {r.tradingUnit}
                </span>
              </div>
            )},
            { header: 'Purchase Rate', key: 'purchaseRate', format: 'currency', align: 'right', render: (r) => (
              <span className="font-medium text-slate-700">₹{r.purchaseRate.toLocaleString('en-IN')}/{r.tradingUnit}</span>
            )},
            { header: 'Stock Value', key: 'stockValue', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-indigo-700">{formatINR(r.stockValue)}</span>
            )},
            { header: 'Status', key: 'status', render: (r) => {
              const color = 
                r.status === 'Good' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                r.status === 'Expired' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                'bg-amber-50 text-amber-800 border-amber-300';
              return (
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
                  {r.status}
                </span>
              );
            }, align: 'center' }
          ]}
          data={batchRows}
          totals={{
            productName: 'TOTALS',
            openingQuantity: totalOpeningCartons,
            inwardQuantity: totalInwardCartons,
            outwardQuantity: totalOutwardCartons,
            availableQuantity: totalClosingCartons,
            stockValue: totalBatchValue
          }}
          searchPlaceholder="Search product, batch number..."
        />
      )}

      {/* SUB-VIEW 2: EXPIRING STOCK */}
      {subTab === 'expiring' && (
        <ReportTable
          columns={[
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
                <div className="text-xs text-slate-500 font-medium">{r.companyName} &bull; {r.variantPacking} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></div>
              </div>
            )},
            { header: 'Batch #', key: 'batchNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-amber-700">{r.batchNumber}</span>
            )},
            { header: 'Expiry Date', key: 'expiryDate' },
            { header: 'Days Remaining', key: 'daysRemaining', render: (r) => (
              <span className="font-extrabold text-xs text-amber-700">{r.daysRemaining} days left</span>
            ), align: 'right' },
            { header: 'Available Units', key: 'availableQuantity', format: 'number', align: 'right', render: (r) => (
              <span className="font-bold text-slate-900">{r.availableQuantity} {r.tradingUnit}</span>
            )},
            { header: 'Holding Value at Risk', key: 'stockValue', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-amber-700">{formatINR(r.stockValue)}</span>
            )}
          ]}
          data={expiringRows}
          totals={{
            productName: 'TOTALS',
            availableQuantity: expiringRows.reduce((s, b) => s + b.availableQuantity, 0),
            stockValue: expiringRows.reduce((s, b) => s + b.stockValue, 0)
          }}
          emptyMessage="No stock batches expiring within the next 90 days."
          searchPlaceholder="Search expiring batches..."
        />
      )}

      {/* SUB-VIEW 3: EXPIRED STOCK */}
      {subTab === 'expired' && (
        <ReportTable
          columns={[
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
                <div className="text-xs text-slate-500 font-medium">{r.companyName} &bull; {r.variantPacking} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></div>
              </div>
            )},
            { header: 'Batch #', key: 'batchNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-rose-700">{r.batchNumber}</span>
            )},
            { header: 'Expiry Date', key: 'expiryDate' },
            { header: 'Expired Quantity', key: 'availableQuantity', format: 'number', align: 'right', render: (r) => (
              <span className="font-bold text-rose-700">{r.availableQuantity} {r.tradingUnit}</span>
            )},
            { header: 'Write-off Cost Value', key: 'stockValue', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-rose-700">{formatINR(r.stockValue)}</span>
            )},
            { header: 'Disposal Status', render: () => (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
                Pending Inspection
              </span>
            ), align: 'center' }
          ]}
          data={expiredRows}
          totals={{
            productName: 'TOTALS',
            availableQuantity: expiredRows.reduce((s, b) => s + b.availableQuantity, 0),
            stockValue: expiredRows.reduce((s, b) => s + b.stockValue, 0)
          }}
          emptyMessage="No expired stock present in inventory."
          searchPlaceholder="Search expired batches..."
        />
      )}
    </div>
  );
}
