'use client';

import React, { useState } from 'react';
import { 
  DollarSign, TrendingUp, Package, Store, Building2, 
  Layers, AlertTriangle, ShieldCheck, PieChart, ArrowUpRight,
  FileText, ExternalLink
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR,
  getProductWiseProfit, getRetailerWiseProfit, getCompanyWiseProfit,
  getTotalProfitSummary, getMonthlySales, getQuarterlySales,
  getInvoiceWiseProfit, InvoiceWiseProfitRow
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { HorizontalBarChart } from '../ReportVisualizations';

interface ProfitLossReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
  onSelectInvoice?: (invoiceId: string) => void;
}

export default function ProfitLossReportsView({
  filters,
  dbState,
  userContext,
  showCharts,
  onSelectInvoice
}: ProfitLossReportsViewProps) {
  const [subTab, setSubTab] = useState<'total' | 'invoice' | 'product' | 'retailer' | 'company' | 'monthly' | 'quarterly'>('total');

  if (userContext.role !== 'admin') {
    return (
      <div className="erp-card bg-white p-12 text-center space-y-3 border-amber-200">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Distributor Admin Confidential Access</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Gross Margin and Batch-level Cost of Goods Sold (COGS) reporting is confidential and accessible only to Distributor Admin users.
        </p>
      </div>
    );
  }

  const totalSummary = getTotalProfitSummary(filters, dbState, userContext);
  const invoiceProfit = getInvoiceWiseProfit(filters, dbState, userContext);
  const prodProfit = getProductWiseProfit(filters, dbState, userContext);
  const retProfit = getRetailerWiseProfit(filters, dbState, userContext);
  const compProfit = getCompanyWiseProfit(filters, dbState, userContext);
  const monthlyProfit = getMonthlySales(filters, dbState, userContext);
  const quarterlyProfit = getQuarterlySales(filters, dbState, userContext);

  const subTabs = [
    { id: 'total', label: 'Executive Profit Summary', icon: Layers },
    { id: 'invoice', label: 'Invoice-wise Profit & Loss', icon: FileText },
    { id: 'product', label: 'Product-wise Profit', icon: Package },
    { id: 'retailer', label: 'Retailer-wise Profit', icon: Store },
    { id: 'company', label: 'Company-wise Profit', icon: Building2 },
    { id: 'monthly', label: 'Monthly Profit Ledger', icon: TrendingUp },
    { id: 'quarterly', label: 'Quarterly Profit & Growth', icon: ArrowUpRight }
  ];

  return (
    <div className="space-y-6">
      {/* Subtab Pills */}
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Net Revenue (Excl. GST)</span>
          <p className="text-base sm:text-lg font-black text-slate-900">{formatINR(totalSummary.netSalesExclGst)}</p>
          <span className="text-xs text-slate-500 font-medium">Taxable basis</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Actual COGS (Batch FIFO)</span>
          <p className="text-base sm:text-lg font-black text-slate-700">{formatINR(totalSummary.actualCogs)}</p>
          <span className="text-xs text-slate-500 font-medium">Cost of Goods Sold</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-emerald-50/40 border-emerald-200">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Gross Profit</span>
          <p className="text-base sm:text-lg font-black text-emerald-600">{formatINR(totalSummary.grossProfit)}</p>
          <span className="text-xs text-emerald-700 font-bold">Revenue - COGS</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-indigo-50/40 border-indigo-200">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Gross Margin %</span>
          <p className="text-base sm:text-lg font-black text-indigo-700">{totalSummary.grossMarginPercent.toFixed(1)}%</p>
          <span className="text-xs text-indigo-700 font-bold">Overall blend</span>
        </div>
      </div>

      {/* Visual Chart */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          <HorizontalBarChart
            title="Gross Profit by FMCG Brand"
            subtitle="Calculated on exact batch cost layers"
            items={compProfit.map(c => ({
              label: c.name,
              value: c.grossProfit,
              color: '#10b981'
            }))}
          />

          <HorizontalBarChart
            title="High Margin Products"
            subtitle="Products generating highest gross profit"
            items={prodProfit.slice(0, 8).map(p => ({
              label: p.name,
              subLabel: `${p.grossMarginPercent}% margin`,
              value: p.grossProfit,
              color: '#4f46e5'
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: EXECUTIVE TOTAL PROFIT STATEMENT */}
      {subTab === 'total' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="erp-card bg-white p-6 lg:col-span-2 space-y-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Trading &amp; Profit Summary</h3>
            
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-3 flex justify-between">
                <span className="text-slate-700 font-semibold">Net Sales (Revenue excluding GST)</span>
                <span className="font-extrabold text-slate-900">{formatINR(totalSummary.netSalesExclGst)}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-700 font-semibold">Less: Actual Cost of Goods Sold (Batch-specific)</span>
                <span className="font-bold text-red-600">-{formatINR(totalSummary.actualCogs)}</span>
              </div>
              <div className="py-3.5 flex justify-between bg-emerald-50 px-3 rounded-lg font-black text-sm text-emerald-950">
                <span>Gross Profit</span>
                <span className="text-emerald-700">{formatINR(totalSummary.grossProfit)}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-500 font-medium">Add: Other Operating Income</span>
                <span className="font-semibold text-slate-400">₹0</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-500 font-medium">Less: Operating &amp; Warehousing Expenses</span>
                <span className="font-semibold text-slate-400">Not Configured</span>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-800 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{totalSummary.expenseStatusMessage}</span>
            </div>
          </div>

          <div className="erp-card bg-white p-6 space-y-4 h-fit">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Costing &amp; Accounting Rules</h3>
            <div className="space-y-3 text-xs leading-relaxed text-slate-500">
              <p>
                &bull; <strong>Layered Costing:</strong> Sales COGS is calculated directly from the batch cost recorded at fulfillment time, never using catalog price or overwriting previous stock lots.
              </p>
              <p>
                &bull; <strong>GST Neutrality:</strong> Input tax credits and Output GST are excluded from Cost &amp; Net Revenue to preserve statutory accuracy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW: INVOICE-WISE PROFIT & LOSS */}
      {subTab === 'invoice' && (
        <ReportTable
          columns={[
            { 
              header: 'Invoice & Date', 
              render: (r: InvoiceWiseProfitRow) => (
                <div>
                  {onSelectInvoice ? (
                    <button
                      type="button"
                      onClick={() => onSelectInvoice(r.invoiceId)}
                      className="font-black text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer text-left"
                      title="View full invoice details"
                    >
                      <span>{r.invoiceNumber}</span>
                      <ExternalLink className="w-3 h-3 text-indigo-400 opacity-80" />
                    </button>
                  ) : (
                    <span className="font-bold text-slate-800">{r.invoiceNumber}</span>
                  )}
                  <span className="text-xs text-slate-500 font-medium block mt-0.5">
                    {r.invoiceDate} &bull; <strong className="text-slate-600">{r.salespersonName}</strong>
                  </span>
                </div>
              )
            },
            { 
              header: 'Retailer Store', 
              render: (r: InvoiceWiseProfitRow) => (
                <div>
                  <span className="font-bold text-slate-800 block">{r.retailerName}</span>
                  <span className="text-xs text-slate-500 font-medium">{r.retailerCode} &bull; {r.city}</span>
                </div>
              )
            },
            { 
              header: 'Items / Qty', 
              align: 'center',
              render: (r: InvoiceWiseProfitRow) => (
                <div className="text-center">
                  <span className="font-bold text-slate-800 text-xs">{r.itemCount} items</span>
                  <span className="text-[11px] text-slate-500 block">{r.totalQuantity.toLocaleString()} units</span>
                </div>
              )
            },
            { 
              header: 'Net Sales (Excl GST)', 
              key: 'netSalesExclGst', 
              format: 'currency', 
              align: 'right' 
            },
            { 
              header: 'Actual COGS', 
              key: 'actualCogs', 
              format: 'currency', 
              align: 'right', 
              render: (r: InvoiceWiseProfitRow) => (
                <span className="text-slate-600 font-medium">{formatINR(r.actualCogs)}</span>
              )
            },
            { 
              header: 'Gross Profit', 
              key: 'grossProfit', 
              format: 'currency', 
              align: 'right', 
              render: (r: InvoiceWiseProfitRow) => {
                const isPos = r.grossProfit >= 0;
                return (
                  <span className={`font-extrabold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isPos ? `+${formatINR(r.grossProfit)}` : `-${formatINR(Math.abs(r.grossProfit))}`}
                  </span>
                );
              }
            },
            { 
              header: 'Margin %', 
              key: 'grossMarginPercent', 
              align: 'right', 
              render: (r: InvoiceWiseProfitRow) => {
                const margin = r.grossMarginPercent;
                let badgeStyle = 'bg-slate-100 text-slate-700';
                if (margin >= 15) badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                else if (margin >= 8) badgeStyle = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                else if (margin > 0) badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-200';
                else badgeStyle = 'bg-red-50 text-red-700 border border-red-200';

                return (
                  <span className={`px-2 py-0.5 rounded-md text-xs font-black inline-block ${badgeStyle}`}>
                    {margin.toFixed(1)}%
                  </span>
                );
              }
            },
            { 
              header: 'Invoice Total (GST)', 
              key: 'finalInvoiceAmount', 
              format: 'currency', 
              align: 'right',
              render: (r: InvoiceWiseProfitRow) => (
                <span className="font-bold text-slate-800">{formatINR(r.finalInvoiceAmount)}</span>
              )
            },
            { 
              header: 'Payment Status', 
              key: 'paymentStatus', 
              align: 'center',
              render: (r: InvoiceWiseProfitRow) => {
                let badgeCls = 'bg-red-50 text-red-700 border-red-200';
                if (r.paymentStatus === 'Paid') badgeCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                else if (r.paymentStatus === 'Partial') badgeCls = 'bg-amber-50 text-amber-700 border-amber-200';
                return (
                  <span className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${badgeCls}`}>
                    {r.paymentStatus}
                  </span>
                );
              }
            }
          ]}
          data={invoiceProfit}
          totals={{
            invoiceNumber: 'TOTALS',
            netSalesExclGst: invoiceProfit.reduce((s, i) => s + i.netSalesExclGst, 0),
            actualCogs: invoiceProfit.reduce((s, i) => s + i.actualCogs, 0),
            grossProfit: invoiceProfit.reduce((s, i) => s + i.grossProfit, 0),
            finalInvoiceAmount: invoiceProfit.reduce((s, i) => s + i.finalInvoiceAmount, 0)
          }}
          searchPlaceholder="Search invoice profit by invoice #, retailer, salesperson..."
        />
      )}

      {/* SUB-VIEW 2: PRODUCT-WISE PROFIT */}
      {subTab === 'product' && (
        <ReportTable
          columns={[
            { header: 'Product', render: (r) => {
              const prod = dbState.products.find(p => p.id === (r as any).productId || p.name === r.name);
              const mrpVal = prod?.mrp || (r as any).mrp;
              return (
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-800">{r.name}</span>
                    {mrpVal && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                        MRP: ₹{mrpVal}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{r.subName} &bull; {r.brand} &bull; <span className="text-indigo-600 font-semibold">{r.category}</span></span>
                </div>
              );
            }},
            { header: 'Packing', key: 'variantPacking' },
            { header: 'Qty Sold', key: 'quantitySold', format: 'number', align: 'right' },
            { header: 'Net Sales (Excl GST)', key: 'netSalesExclGst', format: 'currency', align: 'right' },
            { header: 'Actual COGS', key: 'actualCogs', format: 'currency', align: 'right', render: (r) => (
              <span className="text-slate-600 font-medium">{formatINR(r.actualCogs)}</span>
            )},
            { header: 'Gross Profit', key: 'grossProfit', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
            )},
            { header: 'Margin %', key: 'grossMarginPercent', format: 'percent', align: 'right', render: (r) => (
              <span className="font-extrabold text-indigo-700">{r.grossMarginPercent}%</span>
            )},
            { header: 'Avg Sell Rate', key: 'averageSellingRate', format: 'currency', align: 'right' },
            { header: 'Avg Cost Rate', key: 'averageCostRate', format: 'currency', align: 'right' }
          ]}
          data={prodProfit}
          totals={{
            name: 'TOTALS',
            quantitySold: prodProfit.reduce((s, p) => s + p.quantitySold, 0),
            netSalesExclGst: prodProfit.reduce((s, p) => s + p.netSalesExclGst, 0),
            actualCogs: prodProfit.reduce((s, p) => s + p.actualCogs, 0),
            grossProfit: prodProfit.reduce((s, p) => s + p.grossProfit, 0)
          }}
          searchPlaceholder="Search product profit..."
        />
      )}

      {/* SUB-VIEW 3: RETAILER-WISE PROFIT */}
      {subTab === 'retailer' && (
        <ReportTable
          columns={[
            { header: 'Retailer Store', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.name}</span>
                <span className="text-xs text-slate-500 font-medium">{r.subName}</span>
              </div>
            )},
            { header: 'Units Bought', key: 'quantitySold', format: 'number', align: 'right' },
            { header: 'Net Revenue', key: 'netSalesExclGst', format: 'currency', align: 'right' },
            { header: 'Discounts Given', key: 'totalDiscount', format: 'currency', align: 'right' },
            { header: 'Actual COGS', key: 'actualCogs', format: 'currency', align: 'right' },
            { header: 'Gross Profit', key: 'grossProfit', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
            )},
            { header: 'Margin %', key: 'grossMarginPercent', format: 'percent', align: 'right', render: (r) => (
              <span className="font-extrabold text-indigo-700">{r.grossMarginPercent}%</span>
            )},
            { header: 'Outstanding', key: 'outstanding', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-red-600">{formatINR(r.outstanding)}</span>
            )}
          ]}
          data={retProfit}
          totals={{
            name: 'TOTALS',
            quantitySold: retProfit.reduce((s, r) => s + r.quantitySold, 0),
            netSalesExclGst: retProfit.reduce((s, r) => s + r.netSalesExclGst, 0),
            totalDiscount: retProfit.reduce((s, r) => s + r.totalDiscount, 0),
            actualCogs: retProfit.reduce((s, r) => s + r.actualCogs, 0),
            grossProfit: retProfit.reduce((s, r) => s + r.grossProfit, 0),
            outstanding: retProfit.reduce((s, r) => s + (r.outstanding || 0), 0)
          }}
          searchPlaceholder="Search retailer name, city..."
        />
      )}

      {/* SUB-VIEW 4: COMPANY-WISE PROFIT */}
      {subTab === 'company' && (
        <ReportTable
          columns={[
            { header: 'FMCG Company', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.name}</span>
                <span className="text-xs text-slate-500 font-medium">{r.subName}</span>
              </div>
            )},
            { header: 'Units Sold', key: 'quantitySold', format: 'number', align: 'right' },
            { header: 'Net Sales (Excl GST)', key: 'netSalesExclGst', format: 'currency', align: 'right' },
            { header: 'Discount', key: 'totalDiscount', format: 'currency', align: 'right' },
            { header: 'Actual COGS', key: 'actualCogs', format: 'currency', align: 'right' },
            { header: 'Gross Profit', key: 'grossProfit', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
            )},
            { header: 'Gross Margin %', key: 'grossMarginPercent', format: 'percent', align: 'right', render: (r) => (
              <span className="font-extrabold text-indigo-700">{r.grossMarginPercent}%</span>
            )}
          ]}
          data={compProfit}
          totals={{
            name: 'TOTALS',
            quantitySold: compProfit.reduce((s, c) => s + c.quantitySold, 0),
            netSalesExclGst: compProfit.reduce((s, c) => s + c.netSalesExclGst, 0),
            totalDiscount: compProfit.reduce((s, c) => s + c.totalDiscount, 0),
            actualCogs: compProfit.reduce((s, c) => s + c.actualCogs, 0),
            grossProfit: compProfit.reduce((s, c) => s + c.grossProfit, 0)
          }}
          searchPlaceholder="Search company..."
        />
      )}

      {/* SUB-VIEW 5: MONTHLY PROFIT */}
      {subTab === 'monthly' && (
        <ReportTable
          columns={[
            { header: 'Month', key: 'month', render: (r) => <span className="font-bold text-slate-800">{r.month}</span> },
            { header: 'Net Sales', key: 'netSales', format: 'currency', align: 'right' },
            { header: 'Discounts', key: 'discount', format: 'currency', align: 'right' },
            { header: 'GST Collected', key: 'gst', format: 'currency', align: 'right' },
            { header: 'Payments Realized', key: 'collection', format: 'currency', align: 'right' },
            { header: 'Gross Profit', key: 'grossProfit', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
            )}
          ]}
          data={monthlyProfit}
          totals={{
            month: 'TOTAL',
            netSales: monthlyProfit.reduce((s, m) => s + m.netSales, 0),
            discount: monthlyProfit.reduce((s, m) => s + m.discount, 0),
            gst: monthlyProfit.reduce((s, m) => s + m.gst, 0),
            collection: monthlyProfit.reduce((s, m) => s + m.collection, 0),
            grossProfit: monthlyProfit.reduce((s, m) => s + m.grossProfit, 0)
          }}
          searchPlaceholder="Search months..."
        />
      )}

      {/* SUB-VIEW 6: QUARTERLY PROFIT */}
      {subTab === 'quarterly' && (
        <ReportTable
          columns={[
            { header: 'Quarter', key: 'quarter', render: (r) => <span className="font-bold text-slate-800">{r.quarter}</span> },
            { header: 'Net Sales', key: 'netSales', format: 'currency', align: 'right' },
            { header: 'GST Collected', key: 'gst', format: 'currency', align: 'right' },
            { header: 'Collection', key: 'collection', format: 'currency', align: 'right' },
            { header: 'Gross Profit', key: 'grossProfit', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
            )},
            { header: 'QoQ Growth', key: 'growthPercent', render: (r) => {
              if (r.growthPercent === undefined) return <span className="text-slate-400">—</span>;
              const isPos = r.growthPercent >= 0;
              return (
                <span className={`font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPos ? `+${r.growthPercent}%` : `${r.growthPercent}%`}
                </span>
              );
            }, align: 'right' }
          ]}
          data={quarterlyProfit}
          totals={{
            quarter: 'TOTAL',
            netSales: quarterlyProfit.reduce((s, q) => s + q.netSales, 0),
            gst: quarterlyProfit.reduce((s, q) => s + q.gst, 0),
            collection: quarterlyProfit.reduce((s, q) => s + q.collection, 0),
            grossProfit: quarterlyProfit.reduce((s, q) => s + q.grossProfit, 0)
          }}
          searchPlaceholder="Search quarters..."
        />
      )}
    </div>
  );
}
