'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Printer, DollarSign, Plus, CheckCircle, CreditCard, ChevronRight,
  FileText, ExternalLink, X, Store, Eye, ShieldCheck, Download,
  Calendar, Search, Filter, ArrowUpRight, ArrowDownLeft, Receipt,
  Wallet, RefreshCw, AlertCircle, Sparkles, Building2, User, Phone,
  Layers, ChevronDown, Check, ArrowRight
} from 'lucide-react';
import { Retailer, Payment, Invoice, formatQuantityDisplay } from '@/lib/db';
import DateRangeFilterBar, { 
  DateRange, DatePreset, computeDateRange, formatDateToDisplay 
} from '@/components/payments/DateRangeFilterBar';
import { printInvoiceDocument } from '@/lib/printInvoice';

// Helper: Convert number to Indian Rupees in words
function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Rupees Zero Only';

  const parts = Math.abs(num).toFixed(2).split('.');
  const whole = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1], 10) : 0;

  function convert(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  let result = 'Rupees ' + convert(whole);
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  result += ' Only';
  return result.replace(/\s+/g, ' ').trim();
}

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface LedgerRow {
  id: string;
  date: string;
  type: 'Invoice' | 'Payment' | 'Credit Note';
  docNo: string;
  description: string;
  debit: number;  // increases outstanding (+)
  credit: number; // decreases outstanding (-)
  runningBal: number;
  invoiceId?: string;
  paymentId?: string;
  method?: string;
  refNo?: string;
}

function AdminPaymentsContent() {
  const { retailers, payments, invoices, salesReturns, products, payInvoice } = useDb();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Navigation tabs: 'ledger' (Retailer Ledger Statement) vs 'register' (All Payments Collections)
  const [activeTab, setActiveTab] = useState<'ledger' | 'register'>('ledger');

  // Selected Retailer for Ledger View
  const [selectedRetailerId, setSelectedRetailerId] = useState(() => searchParams.get('retailer') || searchParams.get('retailerId') || '');
  const [retailerSearchTerm, setRetailerSearchTerm] = useState('');

  // Universal Date Range Filter State (Default: This Month)
  const [dateRange, setDateRange] = useState<DateRange>(() => computeDateRange('this_month'));

  // Payment Register Filters
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [paymentsRetailerFilter, setPaymentsRetailerFilter] = useState<string>('ALL');
  const [paymentsSearchTerm, setPaymentsSearchTerm] = useState('');

  // Record Payment Modal / Drawer State
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordRetailerId, setRecordRetailerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other'>('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Single Payment Receipt Preview Modal
  const [viewPaymentVoucher, setViewPaymentVoucher] = useState<Payment | null>(null);

  // Invoice Details Modal State (Triggered by clicking any invoice number)
  const [activeInvoiceModal, setActiveInvoiceModal] = useState<Invoice | null>(null);

  // Sync with URL search params or set first retailer on load
  useEffect(() => {
    const paramRetailer = searchParams.get('retailer') || searchParams.get('retailerId');
    if (paramRetailer) {
      setSelectedRetailerId(paramRetailer);
      setRecordRetailerId(paramRetailer);
    } else if (retailers.length > 0 && !selectedRetailerId) {
      setSelectedRetailerId(retailers[0].id);
      setRecordRetailerId(retailers[0].id);
    }
  }, [retailers, selectedRetailerId, searchParams]);

  // Sync record modal retailer when selectedRetailer changes
  useEffect(() => {
    if (selectedRetailerId) {
      setRecordRetailerId(selectedRetailerId);
    }
  }, [selectedRetailerId]);

  const chosenRetailer = retailers.find(r => r.id === selectedRetailerId);

  // Handle Record Payment Submission
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRetailerId = recordRetailerId || selectedRetailerId;
    if (!targetRetailerId) {
      alert('Please select a retailer.');
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const pay = payInvoice(targetRetailerId, amt, payMethod, payRef, payNotes);
    const ret = retailers.find(r => r.id === targetRetailerId);
    setSuccessMsg(`Payment of ₹${amt.toLocaleString('en-IN')} recorded successfully for ${ret?.shop_name || 'Retailer'} (Voucher #${pay.payment_number}).`);
    setPayAmount('');
    setPayRef('');
    setPayNotes('');
    setIsRecordPaymentOpen(false);
    
    // Clear success message after 5s
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  // ----------------------------------------------------
  // DYNAMIC LEDGER STATEMENT CALCULATION ENGINE
  // ----------------------------------------------------
  const ledgerCalculation = useMemo(() => {
    if (!selectedRetailerId) {
      return {
        openingBalance: 0,
        filteredLedger: [] as LedgerRow[],
        periodDebits: 0,
        periodCredits: 0,
        netPeriodChange: 0,
        closingBalance: 0,
        allTimeDebits: 0,
        allTimeCredits: 0,
        allTimeClosingBalance: 0
      };
    }

    const ret = retailers.find(r => r.id === selectedRetailerId);
    const allRows: Omit<LedgerRow, 'runningBal'>[] = [];

    // 1. Invoices (Debit)
    const retInvoices = invoices.filter(i => i.retailer_id === selectedRetailerId);
    retInvoices.forEach(inv => {
      allRows.push({
        id: inv.id,
        date: inv.date,
        type: 'Invoice',
        docNo: inv.invoice_number,
        description: `Tax Invoice${inv.order_numbers?.length ? ` (Order ${inv.order_numbers.join(', ')})` : ''}`,
        debit: Number(inv.grand_total) || 0,
        credit: 0,
        invoiceId: inv.id
      });
    });

    // 2. Payments (Credit)
    const retPayments = payments.filter(p => p.retailer_id === selectedRetailerId);
    retPayments.forEach(pay => {
      allRows.push({
        id: pay.id,
        date: pay.date,
        type: 'Payment',
        docNo: pay.payment_number,
        description: `Payment Received via ${pay.method || 'UPI'}${pay.reference_number ? ` (Ref: ${pay.reference_number})` : ''}`,
        debit: 0,
        credit: Number(pay.amount) || 0,
        paymentId: pay.id,
        method: pay.method,
        refNo: pay.reference_number
      });
    });

    // 3. Sales Returns / Credit Notes (Credit)
    const retSalesReturns = salesReturns.filter(sr => {
      const rId = sr.retailer_id || invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
      return rId === selectedRetailerId;
    });
    retSalesReturns.forEach(sr => {
      const inv = sr.invoice_id ? invoices.find(i => i.id === sr.invoice_id) : undefined;
      const retAmt = sr.total_amount !== undefined ? sr.total_amount : (sr.items?.reduce((sum, item) => {
        const prod = products.find(p => p.id === item.product_id);
        const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
        const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
        const cRate = item.rate;
        const lRate = item.loose_rate ?? (cRate / unitsPerPack);
        const lineVal = (cQty * cRate) + (lQty * lRate);
        const gst = lineVal * ((prod?.gst_percent || 18) / 100);
        return sum + lineVal + gst;
      }, 0) || 0);

      const docNo = sr.credit_note_number || `CN-${sr.id.slice(-5).toUpperCase()}`;
      const desc = inv ? `Sales Return Credit Note (Inv: ${inv.invoice_number})` : `Sales Return Credit Note (${sr.reason || 'Goods Return'})`;

      allRows.push({
        id: sr.id,
        date: sr.return_date,
        type: 'Credit Note',
        docNo,
        description: desc,
        debit: 0,
        credit: Math.round(retAmt),
        invoiceId: inv?.id
      });
    });

    // Sort chronologically ascending
    const sortedAll = allRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute Historical Seed Opening Balance
    const allTimeDebits = sortedAll.reduce((s, r) => s + r.debit, 0);
    const allTimeCredits = sortedAll.reduce((s, r) => s + r.credit, 0);
    const allTimeNetTx = allTimeDebits - allTimeCredits;
    const currentOutstanding = ret ? (ret.outstanding ?? ret.outstanding_balance ?? ret.current_balance ?? 0) : 0;
    const initialSeedOpening = currentOutstanding - allTimeNetTx;
    const allTimeClosingBalance = currentOutstanding;

    // Filter boundary dates
    const startBound = new Date(dateRange.startDate + 'T00:00:00').getTime();
    const endBound = new Date(dateRange.endDate + 'T23:59:59.999').getTime();

    // Transactions strictly prior to startDate
    const priorRows = sortedAll.filter(r => {
      const rowDate = new Date(r.date.length === 10 ? r.date + 'T00:00:00' : r.date).getTime();
      return rowDate < startBound;
    });

    const priorDebits = priorRows.reduce((s, r) => s + r.debit, 0);
    const priorCredits = priorRows.reduce((s, r) => s + r.credit, 0);
    const openingBalance = initialSeedOpening + priorDebits - priorCredits;

    // Transactions within selected [startDate, endDate]
    const periodRows = sortedAll.filter(r => {
      const rowDate = new Date(r.date.length === 10 ? r.date + 'T00:00:00' : r.date).getTime();
      return rowDate >= startBound && rowDate <= endBound;
    });

    let curBal = openingBalance;
    const filteredLedger: LedgerRow[] = periodRows.map(row => {
      curBal = curBal + row.debit - row.credit;
      return {
        ...row,
        runningBal: curBal
      };
    });

    const periodDebits = periodRows.reduce((s, r) => s + r.debit, 0);
    const periodCredits = periodRows.reduce((s, r) => s + r.credit, 0);
    const netPeriodChange = periodDebits - periodCredits;
    const closingBalance = openingBalance + netPeriodChange;

    return {
      openingBalance,
      filteredLedger,
      periodDebits,
      periodCredits,
      netPeriodChange,
      closingBalance,
      allTimeDebits,
      allTimeCredits,
      allTimeClosingBalance
    };
  }, [selectedRetailerId, dateRange, retailers, invoices, payments, salesReturns, products]);

  // ----------------------------------------------------
  // PAYMENTS REGISTER FILTERING & METRICS ENGINE
  // ----------------------------------------------------
  const filteredPaymentsRegister = useMemo(() => {
    const startBound = new Date(dateRange.startDate + 'T00:00:00').getTime();
    const endBound = new Date(dateRange.endDate + 'T23:59:59.999').getTime();

    return payments.filter(p => {
      const pDate = new Date(p.date.length === 10 ? p.date + 'T00:00:00' : p.date).getTime();
      const dateMatch = pDate >= startBound && pDate <= endBound;
      if (!dateMatch) return false;

      if (paymentsRetailerFilter !== 'ALL' && p.retailer_id !== paymentsRetailerFilter) {
        return false;
      }

      if (paymentMethodFilter !== 'ALL' && p.method !== paymentMethodFilter) {
        return false;
      }

      if (paymentsSearchTerm.trim()) {
        const q = paymentsSearchTerm.toLowerCase();
        const ret = retailers.find(r => r.id === p.retailer_id);
        const match = 
          (p.payment_number || '').toLowerCase().includes(q) ||
          (p.reference_number || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q) ||
          (ret?.shop_name || '').toLowerCase().includes(q) ||
          (ret?.retailer_code || '').toLowerCase().includes(q) ||
          (ret?.city || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, dateRange, paymentsRetailerFilter, paymentMethodFilter, paymentsSearchTerm, retailers]);

  // Payment mode collection metrics
  const paymentMetrics = useMemo(() => {
    let totalCollected = 0;
    let cash = 0;
    let cashCount = 0;
    let upi = 0;
    let upiCount = 0;
    let bank = 0;
    let bankCount = 0;
    let cheque = 0;
    let chequeCount = 0;
    let other = 0;
    let otherCount = 0;

    filteredPaymentsRegister.forEach(p => {
      const amt = Number(p.amount) || 0;
      totalCollected += amt;
      if (p.method === 'Cash') {
        cash += amt;
        cashCount++;
      } else if (p.method === 'UPI') {
        upi += amt;
        upiCount++;
      } else if (p.method === 'Bank Transfer') {
        bank += amt;
        bankCount++;
      } else if (p.method === 'Cheque') {
        cheque += amt;
        chequeCount++;
      } else {
        other += amt;
        otherCount++;
      }
    });

    return {
      totalCollected,
      count: filteredPaymentsRegister.length,
      cash, cashCount,
      upi, upiCount,
      bank, bankCount,
      cheque, chequeCount,
      other, otherCount
    };
  }, [filteredPaymentsRegister]);

  // Filtered Retailers for Selector Omnibar
  const filteredRetailerOptions = useMemo(() => {
    if (!retailerSearchTerm.trim()) return retailers;
    const q = retailerSearchTerm.toLowerCase();
    return retailers.filter(r => 
      r.shop_name.toLowerCase().includes(q) ||
      (r.retailer_code || '').toLowerCase().includes(q) ||
      (r.owner_name || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      (r.mobile || '').includes(q)
    );
  }, [retailers, retailerSearchTerm]);

  // Print Statement Handler
  const handlePrint = () => {
    window.print();
  };

  // Export Ledger to CSV Handler
  const handleExportLedgerCSV = () => {
    if (!chosenRetailer) return;
    const headers = ['Date', 'Document Type', 'Document Number', 'Narration / Description', 'Debit (Rs)', 'Credit (Rs)', 'Running Balance (Rs)'];
    const rows = [
      [`SAIFEE GENERAL STORES - RETAILER ACCOUNT LEDGER STATEMENT`],
      [`Retailer: ${chosenRetailer.shop_name} (${chosenRetailer.retailer_code})`],
      [`Address: ${chosenRetailer.address}, ${chosenRetailer.city}`],
      [`GSTIN: ${chosenRetailer.gstin || 'Unregistered'} | Phone: ${chosenRetailer.mobile}`],
      [`Statement Period: ${formatDateToDisplay(dateRange.startDate)} to ${formatDateToDisplay(dateRange.endDate)} (${dateRange.label})`],
      [`Generated On: ${new Date().toLocaleString('en-IN')}`],
      [],
      headers,
      [
        formatDateToDisplay(dateRange.startDate),
        'OPENING',
        '-',
        `Opening Balance as on ${formatDateToDisplay(dateRange.startDate)}`,
        ledgerCalculation.openingBalance > 0 ? ledgerCalculation.openingBalance.toFixed(2) : '0.00',
        ledgerCalculation.openingBalance < 0 ? Math.abs(ledgerCalculation.openingBalance).toFixed(2) : '0.00',
        ledgerCalculation.openingBalance.toFixed(2)
      ],
      ...ledgerCalculation.filteredLedger.map(r => [
        formatDateToDisplay(r.date.slice(0, 10)),
        r.type,
        r.docNo,
        `"${r.description.replace(/"/g, '""')}"`,
        r.debit > 0 ? r.debit.toFixed(2) : '0.00',
        r.credit > 0 ? r.credit.toFixed(2) : '0.00',
        r.runningBal.toFixed(2)
      ]),
      [],
      ['PERIOD TOTALS', '', '', `Total Transactions in Period`, ledgerCalculation.periodDebits.toFixed(2), ledgerCalculation.periodCredits.toFixed(2), ''],
      ['NET PERIOD CHANGE', '', '', ledgerCalculation.netPeriodChange >= 0 ? `+${ledgerCalculation.netPeriodChange.toFixed(2)} (Dr)` : `${ledgerCalculation.netPeriodChange.toFixed(2)} (Cr)`, '', '', ''],
      ['CLOSING BALANCE', '', '', `Closing Balance as on ${formatDateToDisplay(dateRange.endDate)}`, '', '', `${ledgerCalculation.closingBalance.toFixed(2)} ${ledgerCalculation.closingBalance >= 0 ? 'Dr' : 'Cr'}`]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ledger_${chosenRetailer.retailer_code}_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Payments Register to CSV Handler
  const handleExportPaymentsCSV = () => {
    const headers = ['Date', 'Voucher Number', 'Retailer Code', 'Retailer Name', 'City', 'Payment Method', 'Reference Number', 'Amount (Rs)', 'Notes'];
    const rows = [
      ['SAIFEE GENERAL STORES - PAYMENTS RECEIVED REGISTER'],
      [`Filter Period: ${formatDateToDisplay(dateRange.startDate)} to ${formatDateToDisplay(dateRange.endDate)} (${dateRange.label})`],
      [`Payment Method: ${paymentMethodFilter}`],
      [`Generated On: ${new Date().toLocaleString('en-IN')}`],
      [],
      headers,
      ...filteredPaymentsRegister.map(p => {
        const ret = retailers.find(r => r.id === p.retailer_id);
        return [
          formatDateToDisplay(p.date.slice(0, 10)),
          p.payment_number,
          ret?.retailer_code || '',
          `"${(ret?.shop_name || '').replace(/"/g, '""')}"`,
          ret?.city || '',
          p.method,
          `"${(p.reference_number || '').replace(/"/g, '""')}"`,
          p.amount.toFixed(2),
          `"${(p.notes || '').replace(/"/g, '""')}"`
        ];
      }),
      [],
      ['TOTAL COLLECTED', '', '', '', '', '', '', paymentMetrics.totalCollected.toFixed(2), '']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payments_Register_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ======================================================================= */}
      {/* 1. TOP HEADER & MAIN VIEW SWITCHER */}
      {/* ======================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-900/10">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Payments &amp; Retailer Ledger Hub</h2>
              <p className="text-xs text-slate-500 font-medium">Real-time debtor accounts, date-filtered audit statements, and collection vouchers.</p>
            </div>
          </div>
        </div>

        {/* Action Controls: Quick Record Payment & View Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher Buttons */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-white text-indigo-700 shadow-xs scale-101 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Retailer Ledger Statement</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-emerald-700 shadow-xs scale-101 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Payments Received Register</span>
              {payments.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                  {payments.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Record Payment Trigger CTA */}
          <button
            type="button"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Record Payment</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 no-print shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessMsg('')} 
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. UNIVERSAL HIGH-EFFICIENCY DATE FILTER BAR */}
      {/* ======================================================================= */}
      <DateRangeFilterBar
        range={dateRange}
        onChange={setDateRange}
        defaultPreset="this_month"
      />

      {/* ======================================================================= */}
      {/* VIEW 1: 📜 RETAILER LEDGER STATEMENT */}
      {/* ======================================================================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          
          {/* Retailer Selector Omnibar & Account Summary Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
            {/* Retailer Selector Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Select Retailer Account</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 font-bold">
                  {retailers.length} Customers
                </span>
              </div>

              {/* Retailer Search Dropdown */}
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedRetailerId}
                    onChange={(e) => setSelectedRetailerId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Choose Retailer Customer --</option>
                    {retailers.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.shop_name} ({r.retailer_code || 'RET'}) &bull; {r.city || 'Local'} &bull; Bal: ₹{Number(r.outstanding || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                {chosenRetailer && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">{chosenRetailer.shop_name}</span>
                      <span className="px-1.5 py-0.2 rounded font-mono font-black text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {chosenRetailer.retailer_code}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] truncate">
                      {chosenRetailer.owner_name} &bull; {chosenRetailer.address}, {chosenRetailer.city}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/50">
                      <span>GSTIN: <strong>{chosenRetailer.gstin || 'Unregistered'}</strong></span>
                      <span>Mob: <strong className="font-mono text-slate-800">{chosenRetailer.mobile}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Financial Status Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2. Debtor Credit Health &amp; Overall Exposure</span>
                  </span>
                  {chosenRetailer && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      chosenRetailer.outstanding > chosenRetailer.credit_limit
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {chosenRetailer.outstanding > chosenRetailer.credit_limit ? '⚠️ Credit Limit Exceeded' : '🟢 Healthy Standing'}
                    </span>
                  )}
                </div>

                {chosenRetailer ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Outstanding:</span>
                      <span className="text-base sm:text-lg font-black text-red-600 font-mono block">
                        ₹{chosenRetailer.outstanding.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Lifetime Ledger Net</span>
                    </div>

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Credit Limit:</span>
                      <span className="text-base sm:text-lg font-black text-slate-800 font-mono block">
                        ₹{chosenRetailer.credit_limit.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Approved Cap</span>
                    </div>

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70 space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Available Buffer:</span>
                      <span className={`text-base sm:text-lg font-black font-mono block ${
                        chosenRetailer.credit_limit - chosenRetailer.outstanding < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        ₹{(chosenRetailer.credit_limit - chosenRetailer.outstanding).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Free Headroom</span>
                    </div>

                    <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 space-y-0.5">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Period Net Change:</span>
                      <span className={`text-base sm:text-lg font-black font-mono block ${
                        ledgerCalculation.netPeriodChange >= 0 ? 'text-indigo-900' : 'text-emerald-700'
                      }`}>
                        {ledgerCalculation.netPeriodChange >= 0 ? '+' : ''}₹{ledgerCalculation.netPeriodChange.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-indigo-600 font-semibold">{dateRange.label}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                    Please select a retailer above to view balance metrics.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* 3. DYNAMIC STATEMENT TABLE & PERIOD RECALCULATION BAR */}
          {/* ======================================================================= */}
          {chosenRetailer && (
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden print-area">
              
              {/* Statement Top Control Strip & Print/Export Bar */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-black uppercase font-mono tracking-wider">
                      STATEMENT OF ACCOUNT
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      Period: <strong className="text-slate-900">{formatDateToDisplay(dateRange.startDate)}</strong> &rarr; <strong className="text-slate-900">{formatDateToDisplay(dateRange.endDate)}</strong>
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-1 uppercase tracking-tight">
                    {chosenRetailer.shop_name} ({chosenRetailer.retailer_code})
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {chosenRetailer.address}, {chosenRetailer.city} &bull; Mobile: {chosenRetailer.mobile} &bull; GSTIN: {chosenRetailer.gstin || 'Unregistered'}
                  </p>
                </div>

                {/* Print & CSV Export Buttons */}
                <div className="flex items-center gap-2 no-print self-start md:self-auto">
                  <button
                    type="button"
                    onClick={handleExportLedgerCSV}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer border border-slate-200"
                    title="Export filtered ledger statement to CSV / Excel"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    title="Print official customer account statement"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Statement</span>
                  </button>
                </div>
              </div>

              {/* Printable Distributor Header (Visible strictly in print) */}
              <div className="hidden print:block p-6 border-b border-slate-300 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-black uppercase text-slate-900">SAIFEE GENERAL STORES</h2>
                    <p className="text-slate-600 font-semibold">Authorised FMCG Super Distributor &bull; Logistics Hub, Navi Mumbai, MH</p>
                    <p className="text-slate-500">GSTIN: 27SAIFE1234A1Z5 &bull; Contact: +91 98200 12345</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold bg-slate-100 border border-slate-300 px-3 py-1 rounded-md uppercase block">
                      STATEMENT OF ACCOUNT
                    </span>
                    <p className="text-slate-600 font-bold mt-1">Date: {new Date().toLocaleDateString('en-IN')}</p>
                    <p className="text-slate-500 font-mono">Period: {formatDateToDisplay(dateRange.startDate)} to {formatDateToDisplay(dateRange.endDate)}</p>
                  </div>
                </div>
              </div>

              {/* Dynamic Period Summary Banner Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-indigo-50/40 border-b border-slate-200 text-xs">
                <div className="p-3.5 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Opening Balance as on {formatDateToDisplay(dateRange.startDate)}:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-900 font-mono text-sm">
                      {formatINR(Math.abs(ledgerCalculation.openingBalance))}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                      ledgerCalculation.openingBalance >= 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {ledgerCalculation.openingBalance >= 0 ? 'Dr' : 'Cr'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Debits (Billed in Period):</span>
                  <span className="font-extrabold text-indigo-700 font-mono text-sm block">
                    +{formatINR(ledgerCalculation.periodDebits)}
                  </span>
                </div>

                <div className="p-3.5 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Credits (Received in Period):</span>
                  <span className="font-extrabold text-emerald-700 font-mono text-sm block">
                    -{formatINR(ledgerCalculation.periodCredits)}
                  </span>
                </div>

                <div className="p-3.5 space-y-0.5 bg-indigo-100/40">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">Closing Balance as on {formatDateToDisplay(dateRange.endDate)}:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-950 font-mono text-sm sm:text-base">
                      {formatINR(Math.abs(ledgerCalculation.closingBalance))}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                      ledgerCalculation.closingBalance >= 0 ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {ledgerCalculation.closingBalance >= 0 ? 'Dr (Due)' : 'Cr (Advance)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[750px] border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5 w-24">Date</th>
                      <th className="p-3.5 w-28">Doc Type</th>
                      <th className="p-3.5 w-36">Document #</th>
                      <th className="p-3.5">Narration / Description</th>
                      <th className="p-3.5 text-right w-28">Debit (+)</th>
                      <th className="p-3.5 text-right w-28">Credit (-)</th>
                      <th className="p-3.5 text-right w-32">Running Bal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Dynamic Opening Balance Row */}
                    <tr className="bg-amber-50/50 font-semibold border-b border-amber-200/60">
                      <td className="p-3.5 font-mono text-slate-600">
                        {formatDateToDisplay(dateRange.startDate)}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase font-mono">
                          OPENING
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">-</td>
                      <td className="p-3.5 text-slate-800">
                        <strong>Opening Balance as on {formatDateToDisplay(dateRange.startDate)}</strong> (Prior Transactions Carried Forward)
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                        {ledgerCalculation.openingBalance > 0 ? formatINR(ledgerCalculation.openingBalance) : '-'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        {ledgerCalculation.openingBalance < 0 ? formatINR(Math.abs(ledgerCalculation.openingBalance)) : '-'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-slate-900">
                        {formatINR(Math.abs(ledgerCalculation.openingBalance))} {ledgerCalculation.openingBalance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>

                    {/* Transaction Period Rows */}
                    {ledgerCalculation.filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400 font-semibold">
                          No debit or credit transactions recorded within the selected period ({formatDateToDisplay(dateRange.startDate)} to {formatDateToDisplay(dateRange.endDate)}).
                        </td>
                      </tr>
                    ) : (
                      ledgerCalculation.filteredLedger.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Date */}
                          <td className="p-3.5 font-mono text-slate-600 font-medium">
                            {formatDateToDisplay(row.date.slice(0, 10))}
                          </td>

                          {/* Type */}
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              row.type === 'Invoice' 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                : row.type === 'Payment' 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {row.type}
                            </span>
                          </td>

                          {/* Doc Number with Clickable Preview */}
                          <td className="p-3.5 font-mono">
                            {row.type === 'Invoice' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const inv = invoices.find(i => i.id === row.invoiceId || i.id === row.id || i.invoice_number.toLowerCase() === row.docNo.toLowerCase());
                                  if (inv) setActiveInvoiceModal(inv);
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 font-mono font-bold text-xs transition-all shadow-2xs group cursor-pointer"
                                title={`Click to view full Tax Invoice ${row.docNo}`}
                              >
                                <FileText className="w-3 h-3 text-indigo-600 group-hover:scale-110 transition-transform" />
                                <span className="underline decoration-indigo-300 underline-offset-2">{row.docNo}</span>
                                <ExternalLink className="w-2.5 h-2.5 text-indigo-400 group-hover:text-indigo-700 ml-0.5" />
                              </button>
                            ) : row.type === 'Payment' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const pay = payments.find(p => p.id === row.paymentId || p.payment_number === row.docNo);
                                  if (pay) setViewPaymentVoucher(pay);
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-950 border border-emerald-200 font-mono font-bold text-xs transition-all shadow-2xs group cursor-pointer"
                                title={`Click to view Payment Voucher ${row.docNo}`}
                              >
                                <Receipt className="w-3 h-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                                <span className="underline decoration-emerald-300 underline-offset-2">{row.docNo}</span>
                              </button>
                            ) : (
                              <span className="font-bold text-slate-800 font-mono">{row.docNo}</span>
                            )}
                          </td>

                          {/* Narration */}
                          <td className="p-3.5 text-slate-700 font-medium">
                            <span>{row.description}</span>
                          </td>

                          {/* Debit */}
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                            {row.debit > 0 ? formatINR(row.debit) : '-'}
                          </td>

                          {/* Credit */}
                          <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                            {row.credit > 0 ? formatINR(row.credit) : '-'}
                          </td>

                          {/* Running Balance */}
                          <td className="p-3.5 text-right font-mono font-black text-slate-900">
                            <span className={row.runningBal > 0 ? 'text-slate-950' : 'text-emerald-700'}>
                              {formatINR(Math.abs(row.runningBal))} {row.runningBal >= 0 ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Closing Balance Footer Row */}
                  <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td colSpan={4} className="p-3.5 uppercase tracking-wider text-slate-700">
                        Closing Balance as on {formatDateToDisplay(dateRange.endDate)}:
                      </td>
                      <td className="p-3.5 text-right font-mono text-indigo-900">
                        {formatINR(ledgerCalculation.periodDebits)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-emerald-800">
                        {formatINR(ledgerCalculation.periodCredits)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-base text-slate-950">
                        {formatINR(Math.abs(ledgerCalculation.closingBalance))} {ledgerCalculation.closingBalance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Statement Footnote & Authorization */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  * This statement reflects all ledger entries recorded up to {formatDateToDisplay(dateRange.endDate)}. Please report any discrepancies within 7 days.
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-600">
                  Total {ledgerCalculation.filteredLedger.length} Transactions
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* VIEW 2: 💵 PAYMENTS RECEIVED REGISTER (COLLECTIONS VIEW) */}
      {/* ======================================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          
          {/* Collection Metrics Strip by Payment Mode */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 no-print">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Collections:</span>
              <span className="text-xl sm:text-2xl font-black text-indigo-900 font-mono block">
                {formatINR(paymentMetrics.totalCollected)}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">{paymentMetrics.count} vouchers in selected range</span>
            </div>

            <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-xs space-y-1 bg-gradient-to-br from-emerald-50/50 to-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Cash:</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                  {paymentMetrics.cashCount} txns
                </span>
              </div>
              <span className="text-lg sm:text-xl font-black text-emerald-800 font-mono block">
                {formatINR(paymentMetrics.cash)}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">Instant Counter Cash</span>
            </div>

            <div className="bg-white border border-cyan-100 rounded-2xl p-4 shadow-xs space-y-1 bg-gradient-to-br from-cyan-50/50 to-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider block">UPI / QR:</span>
                <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-100 px-1.5 py-0.2 rounded">
                  {paymentMetrics.upiCount} txns
                </span>
              </div>
              <span className="text-lg sm:text-xl font-black text-cyan-900 font-mono block">
                {formatINR(paymentMetrics.upi)}
              </span>
              <span className="text-[10px] text-cyan-600 font-medium">GPay / PhonePe / Paytm</span>
            </div>

            <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-xs space-y-1 bg-gradient-to-br from-indigo-50/50 to-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Bank / Cheque:</span>
                <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                  {paymentMetrics.bankCount + paymentMetrics.chequeCount} txns
                </span>
              </div>
              <span className="text-lg sm:text-xl font-black text-indigo-900 font-mono block">
                {formatINR(paymentMetrics.bank + paymentMetrics.cheque)}
              </span>
              <span className="text-[10px] text-indigo-600 font-medium">NEFT / RTGS / Cheques</span>
            </div>
          </div>

          {/* Omnibar Filters Strip */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Omnibar Search */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search voucher, retailer, ref..."
                  value={paymentsSearchTerm}
                  onChange={(e) => setPaymentsSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Method Filter */}
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Payment Methods</option>
                <option value="Cash">Cash Only</option>
                <option value="UPI">UPI Only</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>

              {/* Retailer Filter */}
              <select
                value={paymentsRetailerFilter}
                onChange={(e) => setPaymentsRetailerFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer max-w-xs truncate"
              >
                <option value="ALL">All Retailers</option>
                {retailers.map(r => (
                  <option key={r.id} value={r.id}>{r.shop_name} ({r.retailer_code})</option>
                ))}
              </select>
            </div>

            {/* Export & Actions */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                type="button"
                onClick={handleExportPaymentsCSV}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer border border-slate-200"
                title="Export filtered payments register to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Payments Vouchers Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5 w-28">Date</th>
                    <th className="p-3.5 w-32">Voucher #</th>
                    <th className="p-3.5">Retailer Customer</th>
                    <th className="p-3.5 w-32">Method &amp; Ref</th>
                    <th className="p-3.5">Internal Notes</th>
                    <th className="p-3.5 text-right w-36">Amount Received</th>
                    <th className="p-3.5 text-center w-28 no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPaymentsRegister.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">
                        No payment vouchers found for the selected date range and filters.
                      </td>
                    </tr>
                  ) : (
                    filteredPaymentsRegister.map((p, idx) => {
                      const ret = retailers.find(r => r.id === p.retailer_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Row Index */}
                          <td className="p-3.5 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>

                          {/* Date */}
                          <td className="p-3.5 font-mono text-slate-600 font-medium">
                            {formatDateToDisplay(p.date.slice(0, 10))}
                          </td>

                          {/* Voucher # */}
                          <td className="p-3.5 font-mono">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono">
                              {p.payment_number}
                            </span>
                          </td>

                          {/* Retailer Customer */}
                          <td className="p-3.5 space-y-0.5">
                            <span className="font-extrabold text-slate-900 block">{ret?.shop_name || 'Retailer Shop'}</span>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
                              <span className="font-mono text-indigo-700">{ret?.retailer_code}</span>
                              <span>&bull;</span>
                              <span>{ret?.city}</span>
                            </div>
                          </td>

                          {/* Method & Ref */}
                          <td className="p-3.5 space-y-0.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block bg-slate-100 text-slate-800 border border-slate-200">
                              {p.method}
                            </span>
                            {p.reference_number && (
                              <span className="text-[10px] text-slate-500 block font-mono">
                                Ref: {p.reference_number}
                              </span>
                            )}
                          </td>

                          {/* Notes */}
                          <td className="p-3.5 text-slate-600">
                            {p.notes || <span className="text-slate-400 italic">No notes</span>}
                          </td>

                          {/* Amount Received */}
                          <td className="p-3.5 text-right font-mono font-black text-emerald-700 text-sm">
                            {formatINR(p.amount)}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3.5 text-center no-print">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewPaymentVoucher(p)}
                                className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-slate-600 transition-colors cursor-pointer"
                                title="View Payment Receipt Voucher"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRetailerId(p.retailer_id);
                                  setActiveTab('ledger');
                                }}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-0.5"
                                title="Open this retailer's account ledger"
                              >
                                <span>Ledger</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 4. RECORD PAYMENT MODAL / DRAWER */}
      {/* ======================================================================= */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100 no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <DollarSign className="w-5 h-5 stroke-[2.5]" />
                <h3 className="font-extrabold text-slate-900 text-base">Record Payment Receipt</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsRecordPaymentOpen(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              {/* Select Retailer */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Retailer Customer <span className="text-red-500">*</span></label>
                <select
                  value={recordRetailerId}
                  onChange={(e) => setRecordRetailerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  required
                >
                  <option value="">-- Choose Retailer --</option>
                  {retailers.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.shop_name} ({r.retailer_code}) &bull; Outstanding: ₹{r.outstanding.toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Amount Received (₹) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 15000"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 font-mono font-black text-slate-900 text-sm outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Method */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Payment Method <span className="text-red-500">*</span></label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm / QR)</option>
                  <option value="Cash">Cash (Physical Currency)</option>
                  <option value="Bank Transfer">NEFT / RTGS Bank Transfer</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="Other">Other / Adjustments</option>
                </select>
              </div>

              {/* Ref Number */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Bank Txn ID / Cheque #123456"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Internal Remarks / Narration</label>
                <textarea
                  placeholder="Optional description or invoice adjustment details..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-medium text-slate-700 outline-none focus:border-indigo-500 h-16"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md cursor-pointer transition-colors inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Submit Payment Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. SINGLE PAYMENT VOUCHER PREVIEW MODAL */}
      {/* ======================================================================= */}
      {viewPaymentVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <Receipt className="w-5 h-5 stroke-[2.5]" />
                <h3 className="font-extrabold text-slate-900 text-base">Payment Receipt Voucher</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setViewPaymentVoucher(null)} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const ret = retailers.find(r => r.id === viewPaymentVoucher.retailer_id);
              return (
                <div id="printable-payment-voucher" className="space-y-4 text-xs">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Voucher Number:</span>
                      <span className="font-mono font-black text-emerald-950">{viewPaymentVoucher.payment_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Receipt Date:</span>
                      <span className="font-mono font-bold text-emerald-950">{formatDateToDisplay(viewPaymentVoucher.date.slice(0, 10))}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Received From:</span>
                    <h4 className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] tracking-tight uppercase">{ret?.shop_name || 'Retailer Shop'}</h4>
                    <p className="text-slate-600 font-medium">{ret?.owner_name} &bull; {ret?.address}, {ret?.city}</p>
                    <p className="text-slate-500">Mobile: {ret?.mobile} &bull; Code: <strong className="font-mono text-slate-700">{ret?.retailer_code}</strong></p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-bold">Payment Method:</span>
                      <span className="font-black text-slate-900 uppercase">{viewPaymentVoucher.method}</span>
                    </div>
                    {viewPaymentVoucher.reference_number && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-bold">Ref / Txn ID:</span>
                        <span className="font-mono font-bold text-indigo-700">{viewPaymentVoucher.reference_number}</span>
                      </div>
                    )}
                    {viewPaymentVoucher.notes && (
                      <div className="pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Remarks:</span>
                        <p className="text-slate-700 font-medium">{viewPaymentVoucher.notes}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                      <span className="font-black text-slate-900 uppercase">Amount Received:</span>
                      <span className="text-lg font-black text-emerald-700 font-mono">
                        {formatINR(viewPaymentVoucher.amount)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic font-semibold pt-1">
                      {numberToWords(viewPaymentVoucher.amount)}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 no-print">
                    <button
                      type="button"
                      onClick={() => setViewPaymentVoucher(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => printInvoiceDocument('printable-payment-voucher', `Payment Receipt - ${viewPaymentVoucher.payment_number}`)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Receipt</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. FULL TAX INVOICE PREVIEW MODAL */}
      {/* ======================================================================= */}
      {activeInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 print:static print:bg-transparent print:p-0 print:m-0 print:block print:w-full print:h-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-800 overflow-hidden print:static print:max-w-full print:w-full print:bg-transparent print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible print:max-h-none">
            {/* Modal Header Bar */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 no-print">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-black uppercase font-mono tracking-wider">
                  {activeInvoiceModal.invoice_number}
                </span>
                {(() => {
                  const isPaid = activeInvoiceModal.outstanding_amount <= 0;
                  const isPartiallyPaid = activeInvoiceModal.paid_amount > 0 && activeInvoiceModal.outstanding_amount > 0;
                  if (isPaid) {
                    return <span className="text-xs font-extrabold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">PAID IN FULL</span>;
                  } else if (isPartiallyPaid) {
                    return <span className="text-xs font-extrabold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">PARTIALLY PAID (Due: ₹{activeInvoiceModal.outstanding_amount.toLocaleString('en-IN')})</span>;
                  } else {
                    return <span className="text-xs font-extrabold uppercase text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">UNPAID (Due: ₹{activeInvoiceModal.outstanding_amount.toLocaleString('en-IN')})</span>;
                  }
                })()}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInvoiceModal(null);
                    router.push(`/admin/invoices?id=${activeInvoiceModal.id}`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Open full edit & audit screen in Invoices Register"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Invoices Register &rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => printInvoiceDocument('printable-payment-invoice', `Tax Invoice - ${activeInvoiceModal.invoice_number}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInvoiceModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div id="printable-payment-invoice" className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs">
              {/* Top Business & Retailer Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Billed To (Retailer)</span>
                  {(() => {
                    const ret = retailers.find(r => r.id === activeInvoiceModal.retailer_id);
                    return (
                      <div>
                        <h4 className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] tracking-tight uppercase">{ret?.shop_name || 'Retailer Shop'}</h4>
                        <p className="text-slate-600 mt-0.5">{ret?.owner_name} &bull; {ret?.address}, {ret?.city}</p>
                        <p className="text-slate-500 mt-0.5">Mobile: <strong className="text-slate-700">{ret?.mobile}</strong> &bull; GSTIN: <strong className="text-slate-700">{ret?.gstin || 'Unregistered'}</strong></p>
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-1 md:text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Distributor (Supplier)</span>
                  <h4 className="font-extrabold text-slate-900 text-sm">SAIFEE GENERAL STORES</h4>
                  <p className="text-slate-600 mt-0.5">Logistics Zone, Navi Mumbai, MH &bull; GSTIN: <strong className="text-slate-700">27SAIFE1234A1Z5</strong></p>
                  <p className="text-slate-500 mt-0.5">Invoice Date: <strong className="text-slate-700">{new Date(activeInvoiceModal.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</strong> &bull; POS: <strong>{activeInvoiceModal.place_of_supply}</strong></p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Item / Product</th>
                      <th className="p-3 text-center">Unit / Pack</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Rate (₹)</th>
                      <th className="p-3 text-right">Disc. (₹)</th>
                      <th className="p-3 text-right">Taxable (₹)</th>
                      <th className="p-3 text-center">GST</th>
                      <th className="p-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeInvoiceModal.items?.map((item, idx) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 text-slate-400">{idx + 1}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{prod?.name || 'Item'}</span>
                            <span className="text-xs text-slate-500">{prod?.brand} {prod?.sku ? `• SKU: ${prod.sku}` : ''}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                              {item.packing || item.trading_unit || 'Carton'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">
                            {formatQuantityDisplay(item.base_qty || item.quantity, item.units_per_box_carton || prod?.units_per_box_carton, item.trading_unit, item.base_unit || prod?.base_unit)}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-700">
                            ₹{item.rate.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600">
                            {item.discount > 0 ? `-₹${item.discount.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-800">
                            ₹{item.taxable_value.toFixed(2)}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-600 text-xs">
                            {prod?.gst_percent || 18}%
                          </td>
                          <td className="p-3 text-right font-mono font-black text-indigo-700">
                            ₹{item.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals & Words */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Amount in Words</span>
                  <p className="text-xs font-bold text-slate-800 italic">{numberToWords(activeInvoiceModal.grand_total)}</p>
                  
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Total Paid:</span>
                      <strong className="text-emerald-700 font-mono text-xs">₹{activeInvoiceModal.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Current Due:</span>
                      <strong className="text-red-600 font-mono text-xs">₹{activeInvoiceModal.outstanding_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 font-mono">
                  <div className="flex justify-between text-slate-600 text-xs">
                    <span>Taxable Subtotal:</span>
                    <span className="font-bold text-slate-800">₹{activeInvoiceModal.taxable_value.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-xs">
                    <span>CGST (Central Tax):</span>
                    <span>₹{activeInvoiceModal.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-xs">
                    <span>SGST (State Tax):</span>
                    <span>₹{activeInvoiceModal.sgst.toFixed(2)}</span>
                  </div>
                  {activeInvoiceModal.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Round Off:</span>
                      <span>{activeInvoiceModal.round_off > 0 ? `+₹${activeInvoiceModal.round_off.toFixed(2)}` : `-₹${Math.abs(activeInvoiceModal.round_off).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-sm">
                    <span className="font-black text-slate-900 font-sans uppercase text-xs">Grand Total:</span>
                    <span className="text-base font-black text-indigo-700">
                      ₹{activeInvoiceModal.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Internal Ref ID: <span className="font-mono">{activeInvoiceModal.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveInvoiceModal(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPayments() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading Payments &amp; Ledger...</div>}>
      <AdminPaymentsContent />
    </Suspense>
  );
}
