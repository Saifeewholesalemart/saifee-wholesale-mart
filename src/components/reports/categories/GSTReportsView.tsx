'use client';

import React, { useState } from 'react';
import { 
  FileSpreadsheet, FileText, Layers, Percent, 
  ShieldCheck, Calculator, Hash
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR,
  getSalesSummary, getInvoiceWiseSales, getHSNWiseSales,
  getDateRangeFromPreset, isDateInRange
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';

interface GSTReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
  onSelectInvoice?: (invoiceId: string) => void;
}

export default function GSTReportsView({
  filters,
  dbState,
  userContext,
  showCharts,
  onSelectInvoice
}: GSTReportsViewProps) {
  const [subTab, setSubTab] = useState<'summary' | 'invoices' | 'hsn'>('summary');
  const dateRange = getDateRangeFromPreset(filters.datePreset, filters.customStartDate, filters.customEndDate);

  const salesSummary = getSalesSummary(filters, dbState, userContext);
  const hsnRows = getHSNWiseSales(filters, dbState, userContext);

  // Exact dynamic return credit note GST calculation
  let returnGstTotal = 0;
  dbState.salesReturns?.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    sr.items?.forEach(item => {
      const prod = dbState.products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const cRate = item.rate;
      const lRate = item.loose_rate ?? (cRate / unitsPerPack);
      const returnSub = (cQty * cRate) + (lQty * lRate);
      const gstRate = (prod?.gst_percent || 18) / 100;
      returnGstTotal += returnSub * gstRate;
    });
  });

  // Invoice-level GST Details
  const invoiceGstRows = dbState.invoices
    .filter(inv => isDateInRange(inv.date, dateRange))
    .map(inv => {
      const ret = dbState.retailers.find(r => r.id === inv.retailer_id);
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.date.slice(0, 10),
        retailerName: ret?.shop_name || 'Retailer',
        retailerGstin: ret?.gstin || 'URP (Unregistered)',
        taxableValue: Math.round(inv.taxable_value),
        cgst: Math.round(inv.cgst),
        sgst: Math.round(inv.sgst),
        igst: Math.round(inv.igst),
        totalGst: Math.round(inv.cgst + inv.sgst + inv.igst),
        grandTotal: Math.round(inv.grand_total)
      };
    })
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

  const subTabs = [
    { id: 'summary', label: 'GSTR-1 Sales Tax Summary', icon: Layers },
    { id: 'invoices', label: 'Invoice-wise GST Ledger', icon: FileText },
    { id: 'hsn', label: 'HSN-wise Statutory Breakdown', icon: Hash }
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Taxable Sales</span>
          <p className="text-base sm:text-lg font-black text-slate-900">{formatINR(salesSummary.taxableSales)}</p>
          <span className="text-xs text-slate-500 font-medium">Base value for GST</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Central GST (CGST)</span>
          <p className="text-base sm:text-lg font-black text-slate-700">{formatINR(salesSummary.cgst)}</p>
          <span className="text-xs text-slate-500 font-medium">Intra-state (MH 27)</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">State GST (SGST)</span>
          <p className="text-base sm:text-lg font-black text-slate-700">{formatINR(salesSummary.sgst)}</p>
          <span className="text-xs text-slate-500 font-medium">Intra-state (MH 27)</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-emerald-50/40 border-emerald-200">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Total Tax Output</span>
          <p className="text-base sm:text-lg font-black text-emerald-600">{formatINR(salesSummary.gst)}</p>
          <span className="text-xs text-emerald-700 font-bold">CGST + SGST + IGST</span>
        </div>
      </div>

      {/* SUB-VIEW 1: SALES GST SUMMARY */}
      {subTab === 'summary' && (
        <div className="erp-card bg-white p-6 space-y-5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">GSTR-1 Monthly Return Compliance Snapshot</h3>
          
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-3 flex justify-between">
              <span className="text-slate-600 font-medium">1. Aggregate Taxable Turnover</span>
              <span className="font-extrabold text-slate-900">{formatINR(salesSummary.taxableSales)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-slate-600 font-medium">2. Central GST Output (CGST 9% / 2.5% / 6%)</span>
              <span className="font-semibold text-slate-800">{formatINR(salesSummary.cgst)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-slate-600 font-medium">3. State GST Output (SGST 9% / 2.5% / 6%)</span>
              <span className="font-semibold text-slate-800">{formatINR(salesSummary.sgst)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-slate-600 font-medium">4. Integrated GST Output (IGST 18% / 5% / 12%)</span>
              <span className="font-semibold text-slate-800">{formatINR(salesSummary.igst)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-slate-600 font-medium">5. Less: Sales Returns Credit Note GST Adjustment</span>
              <span className="font-bold text-amber-600">
                {returnGstTotal > 0 ? `-${formatINR(Math.round(returnGstTotal))}` : '₹0'}
              </span>
            </div>
            <div className="py-3.5 flex justify-between bg-emerald-50 px-3 rounded-lg font-black text-sm text-emerald-950">
              <span>Net Tax Payable / Output Liability</span>
              <span className="text-emerald-700">{formatINR(salesSummary.gst)}</span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: INVOICE-WISE GST */}
      {subTab === 'invoices' && (
        <ReportTable
          columns={[
            { header: 'Invoice #', key: 'invoiceNumber', render: (r) => (
              <span className="font-bold text-indigo-600 hover:underline">{r.invoiceNumber}</span>
            )},
            { header: 'Date', key: 'invoiceDate' },
            { header: 'Retailer', key: 'retailerName' },
            { header: 'GSTIN', key: 'retailerGstin', render: (r) => (
              <span className="font-mono text-xs font-semibold text-slate-700">{r.retailerGstin}</span>
            )},
            { header: 'Taxable Value', key: 'taxableValue', format: 'currency', align: 'right' },
            { header: 'CGST', key: 'cgst', format: 'currency', align: 'right' },
            { header: 'SGST', key: 'sgst', format: 'currency', align: 'right' },
            { header: 'IGST', key: 'igst', format: 'currency', align: 'right' },
            { header: 'Total GST', key: 'totalGst', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.totalGst)}</span>
            )},
            { header: 'Invoice Total', key: 'grandTotal', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-slate-900">{formatINR(r.grandTotal)}</span>
            )}
          ]}
          data={invoiceGstRows}
          totals={{
            invoiceNumber: 'TOTAL',
            taxableValue: invoiceGstRows.reduce((s, i) => s + i.taxableValue, 0),
            cgst: invoiceGstRows.reduce((s, i) => s + i.cgst, 0),
            sgst: invoiceGstRows.reduce((s, i) => s + i.sgst, 0),
            igst: invoiceGstRows.reduce((s, i) => s + i.igst, 0),
            totalGst: invoiceGstRows.reduce((s, i) => s + i.totalGst, 0),
            grandTotal: invoiceGstRows.reduce((s, i) => s + i.grandTotal, 0)
          }}
          onRowClick={(r) => onSelectInvoice && onSelectInvoice(r.invoiceId)}
          searchPlaceholder="Search GST invoices, GSTIN, store..."
        />
      )}

      {/* SUB-VIEW 3: HSN-WISE SALES */}
      {subTab === 'hsn' && (
        <ReportTable
          columns={[
            { header: 'HSN Code', key: 'hsn', render: (r) => (
              <span className="font-mono text-xs font-bold text-indigo-700">{r.hsn}</span>
            )},
            { header: 'Product & Category', render: (r) => (
              <div>
                <span className="font-semibold text-slate-800 block">{r.productNames}</span>
                <span className="text-xs text-indigo-600 font-medium">Category: {r.category}</span>
              </div>
            )},
            { header: 'Taxable Units', key: 'taxableQuantity', format: 'number', align: 'right' },
            { header: 'Taxable Value', key: 'taxableValue', format: 'currency', align: 'right' },
            { header: 'CGST', key: 'cgst', format: 'currency', align: 'right' },
            { header: 'SGST', key: 'sgst', format: 'currency', align: 'right' },
            { header: 'IGST', key: 'igst', format: 'currency', align: 'right' },
            { header: 'Total GST', key: 'totalGst', format: 'currency', align: 'right', render: (r) => (
              <span className="font-bold text-emerald-600">{formatINR(r.totalGst)}</span>
            )},
            { header: 'Total Value', key: 'totalInvoiceAmount', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-slate-900">{formatINR(r.totalInvoiceAmount)}</span>
            )}
          ]}
          data={hsnRows}
          totals={{
            hsn: 'TOTALS',
            taxableQuantity: hsnRows.reduce((s, h) => s + h.taxableQuantity, 0),
            taxableValue: hsnRows.reduce((s, h) => s + h.taxableValue, 0),
            cgst: hsnRows.reduce((s, h) => s + h.cgst, 0),
            sgst: hsnRows.reduce((s, h) => s + h.sgst, 0),
            igst: hsnRows.reduce((s, h) => s + h.igst, 0),
            totalGst: hsnRows.reduce((s, h) => s + h.totalGst, 0),
            totalInvoiceAmount: hsnRows.reduce((s, h) => s + h.totalInvoiceAmount, 0)
          }}
          searchPlaceholder="Search HSN codes..."
        />
      )}
    </div>
  );
}
