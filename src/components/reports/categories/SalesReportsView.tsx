'use client';

import React, { useState } from 'react';
import { 
  DollarSign, ShoppingCart, TrendingUp, Calendar, FileText, 
  Package, Store, Users, ArrowUpRight, Percent, Layers
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR,
  getSalesSummary, getProductWiseSales, getDailySales, 
  getMonthlySales, getQuarterlySales, getInvoiceWiseSales 
} from '@/lib/reportsEngine';
import ReportTable, { ColumnDef } from '../ReportTable';
import { SalesTrendChart, HorizontalBarChart } from '../ReportVisualizations';
import { ExportColumn } from '@/lib/exportUtils';

interface SalesReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
  onSelectInvoice?: (invoiceId: string) => void;
}

export default function SalesReportsView({
  filters,
  dbState,
  userContext,
  showCharts,
  onSelectInvoice
}: SalesReportsViewProps) {
  const [subTab, setSubTab] = useState<'summary' | 'product' | 'daily' | 'monthly' | 'quarterly' | 'invoice'>('summary');

  // Compute Data for all sub-reports
  const summary = getSalesSummary(filters, dbState, userContext);
  const productSales = getProductWiseSales(filters, dbState, userContext);
  const dailySales = getDailySales(filters, dbState, userContext);
  const monthlySales = getMonthlySales(filters, dbState, userContext);
  const quarterlySales = getQuarterlySales(filters, dbState, userContext);
  const invoiceSales = getInvoiceWiseSales(filters, dbState, userContext);

  // Subtab navigation buttons
  const subTabs = [
    { id: 'summary', label: 'Sales Summary', icon: Layers },
    { id: 'product', label: 'Product-wise Sales', icon: Package },
    { id: 'daily', label: 'Daily Sales', icon: Calendar },
    { id: 'monthly', label: 'Monthly Sales', icon: TrendingUp },
    { id: 'quarterly', label: 'Quarterly Sales', icon: ArrowUpRight },
    { id: 'invoice', label: 'Invoice-wise Sales', icon: FileText }
  ];

  return (
    <div className="space-y-6">
      {/* Subtab Navigation Pills */}
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

      {/* SUMMARY KPI CARDS (Always visible on Summary tab or quick glance) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="erp-card bg-white p-3.5 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Gross Sales</span>
          <p className="text-sm sm:text-base font-extrabold text-slate-900">{formatINR(summary.grossSales)}</p>
          <span className="text-xs text-slate-500 font-medium">{summary.invoiceCount} Invoices</span>
        </div>

        <div className="erp-card bg-white p-3.5 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Sales Return</span>
          <p className="text-sm sm:text-base font-extrabold text-amber-600">
            {summary.salesReturn > 0 ? `-${formatINR(summary.salesReturn)}` : '₹0'}
          </p>
          <span className="text-xs text-slate-500 font-medium">Return adjustment</span>
        </div>

        <div className="erp-card bg-white p-3.5 space-y-1 border-indigo-200 bg-indigo-50/20">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Net Sales</span>
          <p className="text-sm sm:text-base font-extrabold text-indigo-700">{formatINR(summary.netSales)}</p>
          <span className="text-xs text-indigo-600 font-semibold">{summary.totalQuantitySold.toLocaleString('en-IN')} Units Sold</span>
        </div>

        <div className="erp-card bg-white p-3.5 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Discount Given</span>
          <p className="text-sm sm:text-base font-extrabold text-slate-700">{formatINR(summary.discount)}</p>
          <span className="text-xs text-slate-500 font-medium">Flat Rupee/Unit</span>
        </div>

        <div className="erp-card bg-white p-3.5 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total GST</span>
          <p className="text-sm sm:text-base font-extrabold text-emerald-600">{formatINR(summary.gst)}</p>
          <span className="text-xs text-slate-500 font-medium">CGST+SGST+IGST</span>
        </div>

        <div className="erp-card bg-white p-3.5 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Collection</span>
          <p className="text-sm sm:text-base font-extrabold text-emerald-700">{formatINR(summary.totalCollection)}</p>
          <span className="text-xs text-red-600 font-semibold">O/S: {formatINR(summary.totalOutstanding)}</span>
        </div>
      </div>

      {/* VISUAL CHARTS (When toggled on) */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          <SalesTrendChart
            title="Sales Volume Trend"
            subtitle="Gross sales recorded across periods"
            points={
              dailySales.length > 0
                ? dailySales.slice(0, 14).reverse().map(d => ({ label: d.date.slice(5), value: d.netSales }))
                : monthlySales.map(m => ({ label: m.month.split(' ')[0], value: m.netSales }))
            }
          />

          <HorizontalBarChart
            title="Top Selling FMCG Products"
            subtitle="Ranked by total net revenue"
            items={productSales.slice(0, 7).map(p => ({
              label: p.productName,
              subLabel: p.variantPacking,
              value: p.netSales
            }))}
          />
        </div>
      )}

      {/* SUB-VIEW 1: SALES SUMMARY */}
      {subTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="erp-card bg-white p-6 lg:col-span-2 space-y-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Executive Sales Ledger Statement</h3>
            
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 font-medium">Gross Total Invoiced (before tax/discount)</span>
                <span className="font-bold text-slate-900">{formatINR(summary.grossSales)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 font-medium">Less: Trade &amp; Bill Discounts Given</span>
                <span className="font-bold text-amber-600">-{formatINR(summary.discount)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 font-medium">Less: Confirmed Sales Returns</span>
                <span className="font-bold text-red-600">-{formatINR(summary.salesReturn)}</span>
              </div>
              <div className="py-2.5 flex justify-between bg-slate-50 px-2 rounded font-bold text-slate-800">
                <span>Net Sales Value (Taxable)</span>
                <span>{formatINR(summary.netSales)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 font-medium">Add: Central GST (CGST)</span>
                <span className="font-semibold text-slate-800">{formatINR(summary.cgst)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 font-medium">Add: State GST (SGST)</span>
                <span className="font-semibold text-slate-800">{formatINR(summary.sgst)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-600 font-medium">Add: Integrated GST (IGST)</span>
                <span className="font-semibold text-slate-800">{formatINR(summary.igst)}</span>
              </div>
              {Math.abs(summary.netInvoiceValue - (summary.netSales + summary.gst)) > 0 && (
                <div className="py-2.5 flex justify-between text-slate-500">
                  <span>Round-off / Shipping Adjustments</span>
                  <span className="font-semibold">
                    {formatINR(summary.netInvoiceValue - (summary.netSales + summary.gst))}
                  </span>
                </div>
              )}
              <div className="py-3 flex justify-between bg-indigo-50/50 px-2 rounded-lg font-black text-sm text-indigo-950">
                <span>Net Invoice Value (Grand Total)</span>
                <span className="text-indigo-700">{formatINR(summary.netInvoiceValue)}</span>
              </div>
            </div>
          </div>

          <div className="erp-card bg-white p-6 space-y-4 h-fit">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Performance Indicators</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Active Retailers Billed</span>
                <span className="font-extrabold text-slate-800">{summary.retailerCount} stores</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Average Bill Value</span>
                <span className="font-extrabold text-slate-800">{formatINR(summary.averageInvoiceValue)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment Realization Rate</span>
                <span className="font-extrabold text-emerald-600">
                  {summary.netInvoiceValue > 0 ? `${((summary.totalCollection / summary.netInvoiceValue) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: PRODUCT-WISE SALES */}
      {subTab === 'product' && (
        <ReportTable
          columns={[
            { header: 'Product Name', key: 'productName', render: (r) => {
              const prod = dbState.products.find(p => p.id === (r as any).productId);
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
            { header: 'Qty Sold', key: 'quantitySold', format: 'number' as const, align: 'right' as const, render: (r) => (
              <div>
                <span className="font-bold text-slate-800">{r.quantitySold.toLocaleString('en-IN')}</span>
                {r.returnQuantity > 0 && (
                  <span className="text-[10px] text-amber-600 block font-semibold leading-tight">({r.grossQuantitySold} - {r.returnQuantity} ret)</span>
                )}
              </div>
            )},
            { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const, align: 'right' as const },
            { header: 'Discount', key: 'discount', format: 'currency' as const, align: 'right' as const },
            { header: 'Returns', key: 'salesReturn', format: 'currency' as const, align: 'right' as const, render: (r) => (
              r.salesReturn > 0 ? (
                <span className="font-semibold text-amber-600">-{formatINR(r.salesReturn)}</span>
              ) : (
                <span className="text-slate-400">₹0</span>
              )
            )},
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            { header: 'GST', key: 'gst', format: 'currency' as const, align: 'right' as const },
            { header: 'Avg Rate', key: 'averageSellingRate', format: 'currency' as const, align: 'right' as const },
            ...(userContext.role === 'admin' ? [
              { header: 'COGS', key: 'purchaseCost', format: 'currency' as const, align: 'right' as const },
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
              )},
              { header: 'Margin %', key: 'grossMarginPercent', format: 'percent' as const, align: 'right' as const }
            ] : [])
          ]}
          data={productSales}
          totals={{
            productName: 'TOTALS',
            quantitySold: summary.totalQuantitySold,
            grossSales: summary.grossSales,
            discount: summary.discount,
            salesReturn: summary.salesReturn,
            netSales: summary.netSales,
            gst: summary.gst,
            purchaseCost: productSales.reduce((s, p) => s + p.purchaseCost, 0),
            grossProfit: summary.netSales - productSales.reduce((s, p) => s + p.purchaseCost, 0)
          }}
          searchPlaceholder="Search product name, company, brand, SKU..."
        />
      )}

      {/* SUB-VIEW 3: DAILY SALES */}
      {subTab === 'daily' && (
        <ReportTable
          columns={[
            { header: 'Date', key: 'date', render: (r) => <span className="font-bold text-slate-800">{r.date}</span> },
            { header: 'Invoices', key: 'invoiceCount', format: 'number' as const, align: 'center' as const },
            { header: 'Retailers', key: 'retailerCount', format: 'number' as const, align: 'center' as const },
            { header: 'Units Sold', key: 'quantitySold', format: 'number' as const, align: 'right' as const },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const, align: 'right' as const },
            { header: 'Discount', key: 'discount', format: 'currency' as const, align: 'right' as const },
            { header: 'Returns', key: 'salesReturn', format: 'currency' as const, align: 'right' as const, render: (r) => (
              r.salesReturn > 0 ? (
                <span className="font-semibold text-amber-600">-{formatINR(r.salesReturn)}</span>
              ) : (
                <span className="text-slate-400">₹0</span>
              )
            )},
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            { header: 'GST', key: 'gst', format: 'currency' as const, align: 'right' as const },
            { header: 'Collection', key: 'collection', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.collection)}</span>
            )},
            { header: 'Outstanding', key: 'outstanding', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-red-600">{formatINR(r.outstanding)}</span>
            )}
          ]}
          data={dailySales}
          totals={{
            date: 'TOTAL',
            invoiceCount: summary.invoiceCount,
            retailerCount: summary.retailerCount,
            quantitySold: summary.totalQuantitySold,
            grossSales: summary.grossSales,
            discount: summary.discount,
            salesReturn: summary.salesReturn,
            netSales: summary.netSales,
            gst: summary.gst,
            collection: summary.totalCollection,
            outstanding: summary.totalOutstanding
          }}
          searchPlaceholder="Search dates..."
        />
      )}

      {/* SUB-VIEW 4: MONTHLY SALES */}
      {subTab === 'monthly' && (
        <ReportTable
          columns={[
            { header: 'Month', key: 'month', render: (r) => <span className="font-bold text-slate-800">{r.month}</span> },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const, align: 'right' as const },
            { header: 'Returns', key: 'salesReturn', format: 'currency' as const, align: 'right' as const, render: (r) => (
              r.salesReturn > 0 ? (
                <span className="font-semibold text-amber-600">-{formatINR(r.salesReturn)}</span>
              ) : (
                <span className="text-slate-400">₹0</span>
              )
            )},
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            { header: 'Discount', key: 'discount', format: 'currency' as const, align: 'right' as const },
            { header: 'GST', key: 'gst', format: 'currency' as const, align: 'right' as const },
            { header: 'Collection', key: 'collection', format: 'currency' as const, align: 'right' as const },
            { header: 'Outstanding', key: 'outstanding', format: 'currency' as const, align: 'right' as const },
            ...(userContext.role === 'admin' ? [
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
              )}
            ] : []),
            { header: 'MoM Growth', key: 'growthPercent', render: (r) => {
              if (r.growthPercent === undefined) return <span className="text-slate-400">—</span>;
              const isPos = r.growthPercent >= 0;
              return (
                <span className={`font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPos ? `+${r.growthPercent}%` : `${r.growthPercent}%`}
                </span>
              );
            }, align: 'right' as const }
          ]}
          data={monthlySales}
          totals={{
            month: 'TOTAL',
            grossSales: summary.grossSales,
            salesReturn: summary.salesReturn,
            netSales: summary.netSales,
            discount: summary.discount,
            gst: summary.gst,
            collection: summary.totalCollection,
            outstanding: summary.totalOutstanding,
            grossProfit: monthlySales.reduce((s, m) => s + m.grossProfit, 0)
          }}
          searchPlaceholder="Search months..."
        />
      )}

      {/* SUB-VIEW 5: QUARTERLY SALES */}
      {subTab === 'quarterly' && (
        <ReportTable
          columns={[
            { header: 'Quarter', key: 'quarter', render: (r) => <span className="font-bold text-slate-800">{r.quarter}</span> },
            { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const, align: 'right' as const },
            { header: 'Returns', key: 'salesReturn', format: 'currency' as const, align: 'right' as const, render: (r) => (
              r.salesReturn > 0 ? (
                <span className="font-semibold text-amber-600">-{formatINR(r.salesReturn)}</span>
              ) : (
                <span className="text-slate-400">₹0</span>
              )
            )},
            { header: 'Net Sales', key: 'netSales', format: 'currency' as const, align: 'right' as const, render: (r) => (
              <span className="font-bold text-indigo-700">{formatINR(r.netSales)}</span>
            )},
            { header: 'GST', key: 'gst', format: 'currency' as const, align: 'right' as const },
            { header: 'Collection', key: 'collection', format: 'currency' as const, align: 'right' as const },
            { header: 'Outstanding', key: 'outstanding', format: 'currency' as const, align: 'right' as const },
            ...(userContext.role === 'admin' ? [
              { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const, align: 'right' as const, render: (r: any) => (
                <span className="font-bold text-emerald-600">{formatINR(r.grossProfit)}</span>
              )}
            ] : []),
            { header: 'QoQ Growth', key: 'growthPercent', render: (r) => {
              if (r.growthPercent === undefined) return <span className="text-slate-400">—</span>;
              const isPos = r.growthPercent >= 0;
              return (
                <span className={`font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPos ? `+${r.growthPercent}%` : `${r.growthPercent}%`}
                </span>
              );
            }, align: 'right' as const }
          ]}
          data={quarterlySales}
          totals={{
            quarter: 'TOTAL',
            grossSales: summary.grossSales,
            salesReturn: summary.salesReturn,
            netSales: summary.netSales,
            gst: summary.gst,
            collection: summary.totalCollection,
            outstanding: summary.totalOutstanding,
            grossProfit: quarterlySales.reduce((s, q) => s + q.grossProfit, 0)
          }}
          searchPlaceholder="Search quarters..."
        />
      )}

      {/* SUB-VIEW 6: INVOICE-WISE SALES */}
      {subTab === 'invoice' && (
        <ReportTable
          columns={[
            { header: 'Invoice #', key: 'invoiceNumber', render: (r) => (
              <span className="font-bold text-indigo-600 hover:underline">{r.invoiceNumber}</span>
            )},
            { header: 'Date', key: 'invoiceDate' },
            { header: 'Retailer', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.retailerName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.retailerCode}</span>
              </div>
            )},
            { header: 'Salesperson', key: 'salespersonName' },
            { header: 'Items', key: 'itemCount', format: 'number', align: 'center' },
            { header: 'Units', key: 'totalQuantity', format: 'number', align: 'right' },
            { header: 'Subtotal', key: 'grossAmount', format: 'currency', align: 'right' },
            { header: 'Discount', key: 'discount', format: 'currency', align: 'right' },
            { header: 'GST', key: 'gst', format: 'currency', align: 'right' },
            { header: 'Final Total', key: 'finalInvoiceAmount', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-slate-900">{formatINR(r.finalInvoiceAmount)}</span>
            )},
            { header: 'Paid', key: 'paidAmount', format: 'currency', align: 'right', render: (r) => (
              <span className="font-semibold text-emerald-600">{formatINR(r.paidAmount)}</span>
            )},
            { header: 'Outstanding', key: 'outstandingAmount', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-red-600">{formatINR(r.outstandingAmount)}</span>
            )},
            { header: 'Payment', key: 'paymentStatus', render: (r) => {
              const color = 
                r.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                r.paymentStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200';
              return (
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
                  {r.paymentStatus}
                </span>
              );
            }, align: 'center' }
          ]}
          data={invoiceSales}
          totals={{
            invoiceNumber: 'TOTAL',
            totalQuantity: summary.totalQuantitySold,
            grossAmount: summary.grossSales,
            discount: summary.discount,
            gst: summary.gst,
            finalInvoiceAmount: summary.netInvoiceValue,
            paidAmount: summary.totalCollection,
            outstandingAmount: summary.totalOutstanding
          }}
          onRowClick={(r) => onSelectInvoice && onSelectInvoice(r.invoiceId)}
          searchPlaceholder="Search invoice #, retailer name, salesperson..."
        />
      )}
    </div>
  );
}
