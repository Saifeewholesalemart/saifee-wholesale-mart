'use client';

import React, { useState } from 'react';
import { 
  DollarSign, Clock, Users, FileText, CheckCircle2, 
  AlertTriangle, ShieldCheck, CreditCard
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, formatINR,
  getRetailerOutstandingAging, getInvoiceWiseSales, getPaymentCollection 
} from '@/lib/reportsEngine';
import ReportTable from '../ReportTable';
import { AgingBucketsChart } from '../ReportVisualizations';

interface OutstandingReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts: boolean;
  onSelectInvoice?: (invoiceId: string) => void;
}

export default function OutstandingReportsView({
  filters,
  dbState,
  userContext,
  showCharts,
  onSelectInvoice
}: OutstandingReportsViewProps) {
  const [subTab, setSubTab] = useState<'overall' | 'invoice' | 'collection' | 'aging'>('overall');

  const retailerAging = getRetailerOutstandingAging(filters, dbState, userContext);
  const invoiceRows = getInvoiceWiseSales(filters, dbState, userContext).filter(i => i.outstandingAmount > 0);
  const paymentRows = getPaymentCollection(filters, dbState, userContext);

  const totalOutstanding = retailerAging.reduce((s, r) => s + r.outstanding, 0);
  const totalInvoiced = retailerAging.reduce((s, r) => s + r.totalInvoiced, 0);
  const totalPaid = retailerAging.reduce((s, r) => s + r.totalPaid, 0);
  const retailersWithOutstanding = retailerAging.filter(r => r.outstanding > 0).length;

  const agingTotals = {
    current: retailerAging.reduce((s, r) => s + r.currentBucket, 0),
    days1to30: retailerAging.reduce((s, r) => s + r.days1to30, 0),
    days31to60: retailerAging.reduce((s, r) => s + r.days31to60, 0),
    days61to90: retailerAging.reduce((s, r) => s + r.days61to90, 0),
    daysAbove90: retailerAging.reduce((s, r) => s + r.daysAbove90, 0)
  };

  const subTabs = [
    { id: 'overall', label: 'Overall Outstanding & Aging', icon: DollarSign },
    { id: 'invoice', label: 'Invoice-wise Unpaid Ledger', icon: FileText },
    { id: 'collection', label: 'Payment Collection Register', icon: CreditCard }
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
        <div className="erp-card bg-white p-4 space-y-1 bg-red-50/30 border-red-200">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">Total Outstanding Balance</span>
          <p className="text-base sm:text-lg font-black text-red-600">{formatINR(totalOutstanding)}</p>
          <span className="text-xs text-red-600 font-semibold">{retailersWithOutstanding} Retailers pending</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Invoiced Amount</span>
          <p className="text-base sm:text-lg font-black text-slate-900">{formatINR(totalInvoiced)}</p>
          <span className="text-xs text-slate-500 font-medium">Gross receivables</span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1 bg-emerald-50/30 border-emerald-200">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Total Payments Received</span>
          <p className="text-base sm:text-lg font-black text-emerald-700">{formatINR(totalPaid)}</p>
          <span className="text-xs text-emerald-700 font-semibold">
            {totalInvoiced > 0 ? `${((totalPaid / totalInvoiced) * 100).toFixed(1)}% realization` : '0%'}
          </span>
        </div>

        <div className="erp-card bg-white p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Overdue Above 90 Days</span>
          <p className="text-base sm:text-lg font-black text-slate-800">{formatINR(agingTotals.daysAbove90)}</p>
          <span className="text-xs text-slate-500 font-medium">High risk bucket</span>
        </div>
      </div>

      {/* Aging Chart */}
      {showCharts && (
        <AgingBucketsChart
          title="Accounts Receivable Aging Breakdown"
          buckets={[
            { label: 'Current (0d)', amount: agingTotals.current, color: '#10b981' },
            { label: '1–30 Days', amount: agingTotals.days1to30, color: '#3b82f6' },
            { label: '31–60 Days', amount: agingTotals.days31to60, color: '#f59e0b' },
            { label: '61–90 Days', amount: agingTotals.days61to90, color: '#f97316' },
            { label: '90+ Days', amount: agingTotals.daysAbove90, color: '#ef4444' }
          ]}
        />
      )}

      {/* SUB-VIEW 1: OVERALL OUTSTANDING & AGING BY RETAILER */}
      {subTab === 'overall' && (
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
            { header: 'Active Outstanding', key: 'outstanding', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-red-600">{formatINR(r.outstanding)}</span>
            )},
            { header: 'Current', key: 'currentBucket', format: 'currency', align: 'right' },
            { header: '1–30 Days', key: 'days1to30', format: 'currency', align: 'right' },
            { header: '31–60 Days', key: 'days31to60', format: 'currency', align: 'right' },
            { header: '61–90 Days', key: 'days61to90', format: 'currency', align: 'right' },
            { header: '90+ Days', key: 'daysAbove90', format: 'currency', align: 'right', render: (r) => (
              <span className={r.daysAbove90 > 0 ? 'font-bold text-red-600' : 'text-slate-400 font-medium'}>
                {formatINR(r.daysAbove90)}
              </span>
            )},
            { header: 'Pending Bills', key: 'pendingInvoicesCount', format: 'number', align: 'center' }
          ]}
          data={retailerAging}
          totals={{
            retailerName: 'TOTALS',
            totalInvoiced,
            totalPaid,
            outstanding: totalOutstanding,
            currentBucket: agingTotals.current,
            days1to30: agingTotals.days1to30,
            days31to60: agingTotals.days31to60,
            days61to90: agingTotals.days61to90,
            daysAbove90: agingTotals.daysAbove90
          }}
          searchPlaceholder="Search retailer outstanding..."
        />
      )}

      {/* SUB-VIEW 2: INVOICE-WISE OUTSTANDING */}
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
            { 
              header: 'Invoice Total', 
              key: 'finalInvoiceAmount', 
              format: 'currency',
              align: 'right',
              render: (r) => (
                <span className="font-semibold text-slate-800 font-mono">
                  ₹{Number(r.finalInvoiceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )
            },
            { 
              header: 'Paid Amount', 
              key: 'paidAmount', 
              format: 'currency',
              align: 'right',
              render: (r) => (
                <span className="font-semibold text-emerald-600 font-mono">
                  ₹{Number(r.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )
            },
            { 
              header: 'Balance Due', 
              key: 'outstandingAmount', 
              format: 'currency',
              align: 'right', 
              render: (r) => (
                <span className="font-extrabold text-red-600 font-mono">
                  ₹{Number(r.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )
            },
            { 
              header: 'AGING (DAYS)', 
              key: 'daysUnpaid', 
              align: 'center', 
              sortable: true, 
              render: (r) => {
                const days = r.daysUnpaid !== undefined 
                  ? r.daysUnpaid 
                  : Math.max(0, Math.floor((Date.now() - new Date(r.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <span className="font-bold text-slate-700 font-mono">
                    {days} {days === 1 ? 'Day' : 'Days'}
                  </span>
                );
              }
            },
            { header: 'Status', key: 'paymentStatus', render: (r) => (
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                r.paymentStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {r.paymentStatus}
              </span>
            ), align: 'center' }
          ]}
          data={invoiceRows}
          totals={{
            invoiceNumber: 'TOTAL',
            finalInvoiceAmount: invoiceRows.reduce((s, i) => s + i.finalInvoiceAmount, 0),
            paidAmount: invoiceRows.reduce((s, i) => s + i.paidAmount, 0),
            outstandingAmount: invoiceRows.reduce((s, i) => s + i.outstandingAmount, 0)
          }}
          onRowClick={(r) => onSelectInvoice && onSelectInvoice(r.invoiceId)}
          emptyMessage="No unpaid invoices pending for selected filters."
          searchPlaceholder="Search unpaid invoices..."
        />
      )}

      {/* SUB-VIEW 3: PAYMENT COLLECTION REGISTER */}
      {subTab === 'collection' && (
        <ReportTable
          columns={[
            { header: 'Receipt Date', key: 'paymentDate' },
            { header: 'Receipt #', key: 'paymentNumber', render: (r) => (
              <span className="font-mono text-xs font-bold text-slate-800">{r.paymentNumber}</span>
            )},
            { header: 'Retailer', render: (r) => (
              <div>
                <span className="font-bold text-slate-800 block">{r.retailerName}</span>
                <span className="text-xs text-slate-500 font-medium">{r.retailerCode}</span>
              </div>
            )},
            { header: 'Payment Mode', key: 'method', render: (r) => (
              <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-700">
                {r.method}
              </span>
            ), align: 'center' },
            { header: 'Amount Received', key: 'amountReceived', format: 'currency', align: 'right', render: (r) => (
              <span className="font-extrabold text-emerald-600">{formatINR(r.amountReceived)}</span>
            )},
            { header: 'Reference #', key: 'referenceNumber' },
            { header: 'Notes', key: 'notes' }
          ]}
          data={paymentRows}
          totals={{
            paymentDate: 'TOTALS',
            amountReceived: paymentRows.reduce((s, p) => s + p.amountReceived, 0)
          }}
          searchPlaceholder="Search payments, receipts, reference numbers..."
        />
      )}
    </div>
  );
}
