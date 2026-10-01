'use client';

import React, { useState } from 'react';
import { 
  Building2, Tag, TrendingUp, Package, Percent, 
  ArrowUpRight, Award, AlertCircle, RotateCcw, Layers
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR, formatTradingUnit,
  getCompanyWiseSales, getBrandWiseSales, getCategoryWiseSales, getProductWiseSales 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { HorizontalBarChart } from '../ReportVisualizations';

interface CompanyBrandReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
}

export default function CompanyBrandReportsView({
  filters,
  dbState,
  userContext,
  showCharts
}: CompanyBrandReportsViewProps) {
  const [subTab, setSubTab] = useState<'company' | 'brand' | 'category' | 'performance'>('company');
  const [selectedPerformanceCompanyId, setSelectedPerformanceCompanyId] = useState<string>(
    userContext.role === 'sales_co' && userContext.companyId 
      ? userContext.companyId 
      : dbState.companies[0]?.id || ''
  );

  const compSales = getCompanyWiseSales(filters, dbState, userContext);
  const brandSales = getBrandWiseSales(filters, dbState, userContext);
  const categorySales = getCategoryWiseSales(filters, dbState, userContext);
  const productSales = getProductWiseSales(filters, dbState, userContext);

  // Performance classification for selected company
  const companyProducts = productSales.filter(p => {
    const prod = dbState.products.find(pr => pr.id === p.productId);
    return prod?.company_id === selectedPerformanceCompanyId;
  });

  const topSelling = [...companyProducts].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);
  const highestProfit = [...companyProducts].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5);
  const highestDiscount = [...companyProducts].sort((a, b) => b.discount - a.discount).slice(0, 5);
  const slowMoving = [...companyProducts].sort((a, b) => a.quantitySold - b.quantitySold).slice(0, 5);

  const subTabs = [
    { id: 'company', label: 'Company-wise Sales', icon: Building2 },
    { id: 'brand', label: 'Brand-wise Sales', icon: Tag },
    { id: 'category', label: 'Category-wise Sales', icon: Layers },
    { id: 'performance', label: 'Company Product Performance', icon: Award }
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
            title="Company Revenue Contribution"
            subtitle="Net sales recorded by FMCG manufacturer"
            items={compSales.map(c => ({
              label: c.companyName,
              subLabel: `${c.productCount} SKUs`,
              value: c.netSales
            }))}
          />

          <HorizontalBarChart
            title="Top FMCG Brands by Sales"
            subtitle="Ranked across all product categories"
            items={brandSales.slice(0, 8).map(b => ({
              label: b.brand,
              subLabel: b.companyName,
              value: b.netSales,
              color: '#06b6d4'
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: COMPANY-WISE SALES */}
      {subTab === 'company' && (
        <ReportTable
          columns={[
            { header: 'Company Name', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.companyName}</span>
                <span className="text-xs text-slate-500 font-medium">Code: {r.code}</span>
              </div>
            )},
            { header: 'SKUs', key: 'productCount', format: 'number' as const, align: 'center' as const },
            { header: 'Variants', key: 'variantCount', format: 'number' as const, align: 'center' as const },
            { header: 'Units Sold', key: 'quantitySold', format: 'number' as const, align: 'right' as const },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const, align: 'right' as const },
            { header: 'Discount', key: 'discount', format: 'currency' as const, align: 'right' as const },
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            ...(userContext.role === 'admin' ? [
              { header: 'Actual COGS', key: 'actualCost', format: 'currency' as const, align: 'right' as const },
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
              )},
              { header: 'Margin %', key: 'grossMarginPercent', format: 'percent' as const, align: 'right' as const }
            ] : [])
          ]}
          data={compSales}
          totals={{
            companyName: 'TOTALS',
            quantitySold: compSales.reduce((s, c) => s + c.quantitySold, 0),
            grossSales: compSales.reduce((s, c) => s + c.grossSales, 0),
            discount: compSales.reduce((s, c) => s + c.discount, 0),
            netSales: compSales.reduce((s, c) => s + c.netSales, 0),
            actualCost: compSales.reduce((s, c) => s + c.actualCost, 0),
            grossProfit: compSales.reduce((s, c) => s + c.grossProfit, 0)
          }}
          onRowClick={(r) => {
            setSelectedPerformanceCompanyId(r.companyId);
            setSubTab('performance');
          }}
          searchPlaceholder="Search company name, code..."
        />
      )}

      {/* SUB-VIEW 2: BRAND-WISE SALES */}
      {subTab === 'brand' && (
        <ReportTable
          columns={[
            { header: 'Brand Name', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.brand}</span>
                <span className="text-xs text-slate-500 font-medium">{r.companyName}</span>
              </div>
            )},
            { header: 'Company', key: 'companyName' },
            { header: 'Units Sold', key: 'quantitySold', format: 'number' as const, align: 'right' as const },
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            ...(userContext.role === 'admin' ? [
              { header: 'Actual Cost', key: 'actualCost', format: 'currency' as const, align: 'right' as const },
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
              )},
              { header: 'Margin %', key: 'grossMarginPercent', format: 'percent' as const, align: 'right' as const }
            ] : [])
          ]}
          data={brandSales}
          totals={{
            brand: 'TOTALS',
            quantitySold: brandSales.reduce((s, b) => s + b.quantitySold, 0),
            netSales: brandSales.reduce((s, b) => s + b.netSales, 0),
            actualCost: brandSales.reduce((s, b) => s + b.actualCost, 0),
            grossProfit: brandSales.reduce((s, b) => s + b.grossProfit, 0)
          }}
          searchPlaceholder="Search brand..."
        />
      )}

      {/* SUB-VIEW: CATEGORY-WISE SALES */}
      {subTab === 'category' && (
        <ReportTable
          columns={[
            { header: 'Product Category', render: (r) => (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                <span className="font-bold text-slate-800 text-sm">{r.category}</span>
              </div>
            )},
            { header: 'Active SKUs', key: 'productCount', format: 'number' as const, align: 'center' as const },
            { header: 'Units Sold', key: 'quantitySold', format: 'number' as const, align: 'right' as const },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const, align: 'right' as const },
            { header: 'Discount', key: 'discount', format: 'currency' as const, align: 'right' as const },
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            ...(userContext.role === 'admin' ? [
              { header: 'Actual COGS', key: 'actualCost', format: 'currency' as const, align: 'right' as const },
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
              )},
              { header: 'Margin %', key: 'grossMarginPercent', format: 'percent' as const, align: 'right' as const }
            ] : [])
          ]}
          data={categorySales}
          totals={{
            category: 'TOTALS',
            quantitySold: categorySales.reduce((s, c) => s + c.quantitySold, 0),
            grossSales: categorySales.reduce((s, c) => s + c.grossSales, 0),
            discount: categorySales.reduce((s, c) => s + c.discount, 0),
            netSales: categorySales.reduce((s, c) => s + c.netSales, 0),
            actualCost: categorySales.reduce((s, c) => s + c.actualCost, 0),
            grossProfit: categorySales.reduce((s, c) => s + c.grossProfit, 0)
          }}
          searchPlaceholder="Search category..."
        />
      )}

      {/* SUB-VIEW 3: COMPANY PRODUCT PERFORMANCE QUADRANTS */}
      {subTab === 'performance' && (
        <div className="space-y-6">
          {/* Company Selector Header */}
          {userContext.role !== 'sales_co' && (
            <div className="erp-card bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {dbState.companies.find(c => c.id === selectedPerformanceCompanyId)?.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Product Portfolio Performance Diagnostics &bull; {companyProducts.length} Active SKUs Analyzed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-semibold">Select Company:</span>
                <select
                  value={selectedPerformanceCompanyId}
                  onChange={(e) => setSelectedPerformanceCompanyId(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none"
                >
                  {dbState.companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Quadrant Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Selling Products */}
            <div className="erp-card bg-white p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 text-indigo-600">
                <TrendingUp className="w-4 h-4" />
                <span>Top-Selling Products (Volume)</span>
              </h4>
              <div className="divide-y divide-slate-100">
                {topSelling.map((p, i) => {
                  const prod = dbState.products.find(pr => pr.id === p.productId);
                  const mrpVal = prod?.mrp || (p as any).mrp;
                  return (
                    <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.productName}</span>
                          {mrpVal && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                              MRP: ₹{mrpVal}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{p.variantPacking}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-indigo-700 block">{p.quantitySold} {p.tradingUnit}s</span>
                        <span className="text-xs text-slate-500 font-medium">{formatINR(p.netSales)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Highest Profit Products */}
            <div className="erp-card bg-white p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 text-emerald-600">
                <Award className="w-4 h-4" />
                <span>Highest Gross Margin Drivers</span>
              </h4>
              <div className="divide-y divide-slate-100">
                {highestProfit.map((p, i) => {
                  const prod = dbState.products.find(pr => pr.id === p.productId);
                  const mrpVal = prod?.mrp || (p as any).mrp;
                  return (
                    <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.productName}</span>
                          {mrpVal && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                              MRP: ₹{mrpVal}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{p.variantPacking}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 block">
                          {userContext.role === 'admin' ? formatINR(p.grossProfit) : formatINR(p.netSales)}
                        </span>
                        <span className="text-xs text-emerald-700 font-bold">{p.grossMarginPercent}% margin</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Products with Highest Discount */}
            <div className="erp-card bg-white p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 text-amber-600">
                <Percent className="w-4 h-4" />
                <span>Products with Highest Trade Discount</span>
              </h4>
              <div className="divide-y divide-slate-100">
                {highestDiscount.map((p, i) => {
                  const prod = dbState.products.find(pr => pr.id === p.productId);
                  const mrpVal = prod?.mrp || (p as any).mrp;
                  return (
                    <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.productName}</span>
                          {mrpVal && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                              MRP: ₹{mrpVal}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{p.variantPacking}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-amber-600 block">{formatINR(p.discount)}</span>
                        <span className="text-xs text-slate-500 font-medium">Total disc given</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Slow Moving Products */}
            <div className="erp-card bg-white p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-4 h-4" />
                <span>Slow-Moving Products (Replenish Warning)</span>
              </h4>
              <div className="divide-y divide-slate-100">
                {slowMoving.map((p, i) => {
                  const prod = dbState.products.find(pr => pr.id === p.productId);
                  const mrpVal = prod?.mrp || (p as any).mrp;
                  return (
                    <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.productName}</span>
                          {mrpVal && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                              MRP: ₹{mrpVal}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{p.variantPacking}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-700 block">{p.quantitySold} {p.tradingUnit}s</span>
                        <span className="text-xs text-rose-600 font-semibold">Low movement</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
