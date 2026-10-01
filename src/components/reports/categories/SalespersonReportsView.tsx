'use client';

import React, { useState } from 'react';
import { 
  Users, UserCheck, Target, TrendingUp, DollarSign, 
  Percent, Award, ShieldCheck, Store
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR,
  getSalespersonSales, getSalespersonDiscount 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { HorizontalBarChart } from '../ReportVisualizations';

interface SalespersonReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function SalespersonReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: SalespersonReportsViewProps) {
  const [subTab, setSubTab] = useState<'sales' | 'retailers' | 'target' | 'discount'>('sales');

  const spSales = getSalespersonSales(filters, dbState, userContext);
  const spDiscount = getSalespersonDiscount(filters, dbState, userContext);

  // Targets dataset for distributor sales team
  const targetRows = spSales.map(sp => {
    // Realistic monthly sales quota targets
    const targetAmount = 500000;
    const achieved = sp.netSales;
    const achievementPct = targetAmount > 0 ? (achieved / targetAmount) * 100 : 0;
    const remaining = Math.max(0, targetAmount - achieved);

    return {
      salespersonId: sp.salespersonId,
      salespersonName: sp.salespersonName,
      role: sp.role,
      target: targetAmount,
      achieved,
      achievementPercentage: Number(achievementPct.toFixed(1)),
      remainingTarget: remaining
    };
  });

  const subTabs = [
    { id: 'sales', label: 'Salesperson Sales Summary', icon: Users },
    { id: 'target', label: 'Sales Target & Quotas', icon: Target },
    { id: 'discount', label: 'Discount & Margin Impact', icon: Percent }
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

      {/* Visual Chart */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          <HorizontalBarChart
            title="Salesperson Revenue Achievement"
            subtitle="Ranked by total net sales booked"
            items={spSales.map(sp => ({
              label: sp.salespersonName,
              subLabel: `${sp.retailersServed} stores`,
              value: sp.netSales
            }))}
          />

          <HorizontalBarChart
            title="Trade Discount Granted by Salesperson"
            subtitle="Total flat rupee discounts applied"
            items={spDiscount.map(sp => ({
              label: sp.salespersonName,
              subLabel: `₹${sp.discountPerTradingUnit}/unit avg`,
              value: sp.totalDiscountGiven,
              color: '#f59e0b'
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: SALESPERSON SALES SUMMARY */}
      {subTab === 'sales' && (
        <ReportTable
          columns={[
            { header: 'Salesperson Name', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.salespersonName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.role}</span>
              </div>
            )},
            { header: 'Stores Served', key: 'retailersServed', format: 'number', align: 'center' },
            { header: 'Orders Booked', key: 'orderCount', format: 'number', align: 'center' },
            { header: 'Invoices Billed', key: 'invoiceCount', format: 'number', align: 'center' },
            { header: 'Pieces Sold', key: 'quantitySold', format: 'number', align: 'right' },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-slate-800 font-mono">{formatINR(r.grossSales)}</span>
            )},
            { header: 'Discount Given', key: 'discountGiven', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-amber-600 font-mono">{formatINR(r.discountGiven)}</span>
            )},
            { header: 'Net Sales', key: 'netSales', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-indigo-700 font-mono">{formatINR(r.netSales)}</span>
            )},
            { header: 'Collection', key: 'collection', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-emerald-600 font-mono">{formatINR(r.collection)}</span>
            )},
            { header: 'Outstanding', key: 'outstanding', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-red-600 font-mono">{formatINR(r.outstanding)}</span>
            )},
            ...(userContext.role === 'admin' ? [
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600 font-mono">{formatINR(r.grossProfit)}</span>
              )}
            ] : [])
          ]}
          data={spSales}
          totals={{
            salespersonName: 'TOTALS',
            retailersServed: spSales.reduce((s, r) => s + r.retailersServed, 0),
            orderCount: spSales.reduce((s, r) => s + r.orderCount, 0),
            invoiceCount: spSales.reduce((s, r) => s + r.invoiceCount, 0),
            quantitySold: spSales.reduce((s, r) => s + r.quantitySold, 0),
            grossSales: spSales.reduce((s, r) => s + r.grossSales, 0),
            discountGiven: spSales.reduce((s, r) => s + r.discountGiven, 0),
            netSales: spSales.reduce((s, r) => s + r.netSales, 0),
            collection: spSales.reduce((s, r) => s + r.collection, 0),
            outstanding: spSales.reduce((s, r) => s + r.outstanding, 0),
            grossProfit: spSales.reduce((s, r) => s + r.grossProfit, 0)
          }}
          searchPlaceholder="Search salesperson..."
        />
      )}

      {/* SUB-VIEW 2: SALESPERSON TARGET & QUOTA REPORT */}
      {subTab === 'target' && (
        <ReportTable
          columns={[
            { header: 'Salesperson Name', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.salespersonName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.role}</span>
              </div>
            )},
            { header: 'Monthly Target', key: 'target', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-slate-700 font-mono">{formatINR(r.target)}</span>
            )},
            { header: 'Achieved Sales', key: 'achieved', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600 font-mono">{formatINR(r.achieved)}</span>
            )},
            { header: 'Achievement %', key: 'achievementPercentage', render: (r) => {
              const isMet = r.achievementPercentage >= 100;
              return (
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isMet ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                      style={{ width: `${Math.min(r.achievementPercentage, 100)}%` }}
                    />
                  </div>
                  <span className={`font-extrabold ${isMet ? 'text-emerald-600' : 'text-indigo-700'}`}>
                    {r.achievementPercentage}%
                  </span>
                </div>
              );
            }, align: 'right' },
            { header: 'Remaining Target', key: 'remainingTarget', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-slate-700 font-mono">{formatINR(r.remainingTarget)}</span>
            )}
          ]}
          data={targetRows}
          totals={{
            salespersonName: 'TOTALS',
            target: targetRows.reduce((s, r) => s + r.target, 0),
            achieved: targetRows.reduce((s, r) => s + r.achieved, 0),
            remainingTarget: targetRows.reduce((s, r) => s + r.remainingTarget, 0)
          }}
          searchPlaceholder="Search salesperson targets..."
        />
      )}

      {/* SUB-VIEW 3: SALESPERSON DISCOUNT & MARGIN IMPACT */}
      {subTab === 'discount' && (
        <ReportTable
          columns={[
            { header: 'Salesperson Name', key: 'salespersonName' },
            { header: 'Total Sales', key: 'totalSales', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-indigo-700 font-mono">{formatINR(r.totalSales)}</span>
            )},
            { header: 'Pieces Sold', key: 'totalQuantity', format: 'number', align: 'right' },
            { header: 'Total Discount Given', key: 'totalDiscountGiven', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-amber-600 font-mono">{formatINR(r.totalDiscountGiven)}</span>
            )},
            { header: 'Flat Disc / Piece', key: 'discountPerTradingUnit', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-slate-700 font-mono">₹{r.discountPerTradingUnit}/pc</span>
            )},
            { header: 'Gross Profit Impact', key: 'grossProfitImpact', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-red-600 font-mono">-{formatINR(r.grossProfitImpact)}</span>
            )}
          ]}
          data={spDiscount}
          totals={{
            salespersonName: 'TOTALS',
            totalSales: spDiscount.reduce((s, r) => s + r.totalSales, 0),
            totalQuantity: spDiscount.reduce((s, r) => s + r.totalQuantity, 0),
            totalDiscountGiven: spDiscount.reduce((s, r) => s + r.totalDiscountGiven, 0),
            grossProfitImpact: spDiscount.reduce((s, r) => s + r.grossProfitImpact, 0)
          }}
          searchPlaceholder="Search salesperson discounts..."
        />
      )}
    </div>
  );
}
