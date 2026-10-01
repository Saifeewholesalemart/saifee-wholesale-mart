'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { 
  ArrowDownLeft, ArrowUpRight, Plus, Search, Filter, 
  Download, Printer, Wallet, Calendar, RotateCcw, 
  Eye, Edit3, Ban, ShieldCheck, CheckCircle2, ChevronRight,
  TrendingUp, TrendingDown, Layers, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { 
  CashFlowTransaction, CashFlowPaymentMode, CashFlowType, 
  CompanyOpeningBalance 
} from '@/lib/db';
import CashFlowSummaryCards from '@/components/cashflow/CashFlowSummaryCards';
import PaymentModeBreakdown, { ModeBreakdownData } from '@/components/cashflow/PaymentModeBreakdown';
import CashFlowEntryModal from '@/components/cashflow/CashFlowEntryModal';
import CashFlowDetailsModal from '@/components/cashflow/CashFlowDetailsModal';
import CashFlowEditModal from '@/components/cashflow/CashFlowEditModal';
import CashFlowVoidModal from '@/components/cashflow/CashFlowVoidModal';
import SetOpeningBalanceModal from '@/components/cashflow/SetOpeningBalanceModal';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNeg ? '-₹' : '₹') + formatted;
}

type DateFilterPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_fy' | 'custom';

// Helper: Calculate Indian Financial Year (1 April - 31 March)
function getIndianFinancialYearDates(): { start: string; end: string; label: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr

  let fyStartYear = currentYear;
  if (currentMonth < 3) {
    fyStartYear = currentYear - 1;
  }
  const fyEndYear = fyStartYear + 1;

  const start = `${fyStartYear}-04-01`;
  const end = `${fyEndYear}-03-31`;
  const label = `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`;
  return { start, end, label };
}

function AdminCashFlowContent() {
  const { 
    cashFlowTransactions, companyOpeningBalance, activeCompany, 
    currentUser, refreshCashFlow 
  } = useDb();
  const router = useRouter();

  // Mount state for hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Date Filter Preset
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Table Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | CashFlowType>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voided'>('all');

  // Modals state
  const [entryModalOpen, setEntryModalOpen] = useState<boolean>(false);
  const [entryDefaultType, setEntryDefaultType] = useState<CashFlowType>('CASH_IN');
  const [selectedDetailsTx, setSelectedDetailsTx] = useState<CashFlowTransaction | null>(null);
  const [selectedEditTx, setSelectedEditTx] = useState<CashFlowTransaction | null>(null);
  const [selectedVoidTx, setSelectedVoidTx] = useState<CashFlowTransaction | null>(null);
  const [openingBalanceModalOpen, setOpeningBalanceModalOpen] = useState<boolean>(false);

  // Toast Notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Determine Effective Date Range [startDate, endDate] & Label
  const { effectiveStartDate, effectiveEndDate, dateRangeLabel } = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (datePreset === 'today') {
      return { effectiveStartDate: todayStr, effectiveEndDate: todayStr, dateRangeLabel: 'Today' };
    }
    if (datePreset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { effectiveStartDate: yStr, effectiveEndDate: yStr, dateRangeLabel: 'Yesterday' };
    }
    if (datePreset === 'this_week') {
      const day = today.getDay(); // 0 is Sun, 1 is Mon
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(today.setDate(diff));
      const monStr = mon.toISOString().split('T')[0];
      return { effectiveStartDate: monStr, effectiveEndDate: todayStr, dateRangeLabel: 'This Week' };
    }
    if (datePreset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      return { effectiveStartDate: start, effectiveEndDate: end, dateRangeLabel: 'This Month' };
    }
    if (datePreset === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
      return { effectiveStartDate: start, effectiveEndDate: end, dateRangeLabel: 'Last Month' };
    }
    if (datePreset === 'this_fy') {
      const fy = getIndianFinancialYearDates();
      return { effectiveStartDate: fy.start, effectiveEndDate: fy.end, dateRangeLabel: fy.label };
    }
    // Custom
    return {
      effectiveStartDate: customStartDate || '2000-01-01',
      effectiveEndDate: customEndDate || '2099-12-31',
      dateRangeLabel: `${customStartDate || 'Start'} to ${customEndDate || 'End'}`
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Active Company Transactions (Multi-Company strict isolation)
  const currentCompanyTransactions = useMemo(() => {
    const targetCompId = activeCompany?.id || 'biz-saifee';
    return cashFlowTransactions.filter(t => (t.company_id || 'biz-saifee') === targetCompId);
  }, [cashFlowTransactions, activeCompany]);

  // 1. Calculate Opening Balance for Selected Period:
  // Baseline Company Opening Balance + Net Cash Flow of all active transactions before effectiveStartDate
  const periodOpeningBalance = useMemo(() => {
    const baseline = companyOpeningBalance?.opening_balance || 0;
    
    // Transactions before effectiveStartDate (ignoring voided)
    const priorTransactions = currentCompanyTransactions.filter(t => {
      if (t.status === 'Voided') return false;
      const tDate = t.date ? (t.date.includes('T') ? t.date.split('T')[0] : t.date) : '';
      return tDate < effectiveStartDate;
    });

    const priorIn = priorTransactions.filter(t => t.type === 'CASH_IN').reduce((s, t) => s + t.amount, 0);
    const priorOut = priorTransactions.filter(t => t.type === 'CASH_OUT').reduce((s, t) => s + t.amount, 0);

    return baseline + priorIn - priorOut;
  }, [companyOpeningBalance, currentCompanyTransactions, effectiveStartDate]);

  // 2. Transactions within the selected period
  const periodTransactions = useMemo(() => {
    return currentCompanyTransactions.filter(t => {
      const tDate = t.date ? (t.date.includes('T') ? t.date.split('T')[0] : t.date) : '';
      return tDate >= effectiveStartDate && tDate <= effectiveEndDate;
    });
  }, [currentCompanyTransactions, effectiveStartDate, effectiveEndDate]);

  // 3. Financial Metrics for period (excluding voided)
  const { totalCashIn, totalCashOut, netCashFlow, closingBalance } = useMemo(() => {
    const activePeriodTxs = periodTransactions.filter(t => t.status !== 'Voided');
    const cin = activePeriodTxs.filter(t => t.type === 'CASH_IN').reduce((s, t) => s + t.amount, 0);
    const cout = activePeriodTxs.filter(t => t.type === 'CASH_OUT').reduce((s, t) => s + t.amount, 0);
    const net = cin - cout;
    const closing = periodOpeningBalance + net;
    return {
      totalCashIn: cin,
      totalCashOut: cout,
      netCashFlow: net,
      closingBalance: closing
    };
  }, [periodTransactions, periodOpeningBalance]);

  // 4. Payment Mode Breakdown
  const paymentModeBreakdown: ModeBreakdownData[] = useMemo(() => {
    const modes: CashFlowPaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
    const activeTxs = periodTransactions.filter(t => t.status !== 'Voided');

    return modes.map(mode => {
      const modeTxs = activeTxs.filter(t => t.payment_mode === mode);
      const inAmt = modeTxs.filter(t => t.type === 'CASH_IN').reduce((s, t) => s + t.amount, 0);
      const outAmt = modeTxs.filter(t => t.type === 'CASH_OUT').reduce((s, t) => s + t.amount, 0);
      return {
        mode,
        inAmount: inAmt,
        outAmount: outAmt,
        netAmount: inAmt - outAmt,
        count: modeTxs.length
      };
    });
  }, [periodTransactions]);

  // 5. Filtered Transactions List for Register View
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter(t => {
      // Type Filter
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;

      // Mode Filter
      if (modeFilter !== 'all' && t.payment_mode !== modeFilter) return false;

      // Category Filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

      // Source Filter
      if (sourceFilter !== 'all' && t.source_type !== sourceFilter) return false;

      // Status Filter
      if (statusFilter === 'active' && t.status === 'Voided') return false;
      if (statusFilter === 'voided' && t.status !== 'Voided') return false;

      // Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchParty = t.party_name?.toLowerCase().includes(q);
        const matchTxNum = t.transaction_number?.toLowerCase().includes(q);
        const matchRef = t.reference_number?.toLowerCase().includes(q);
        const matchInv = t.linked_invoice_number?.toLowerCase().includes(q);
        const matchCat = t.category?.toLowerCase().includes(q);
        const matchAmt = String(t.amount).includes(q);
        const matchRemarks = t.remarks?.toLowerCase().includes(q);
        if (!matchParty && !matchTxNum && !matchRef && !matchInv && !matchCat && !matchAmt && !matchRemarks) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Newest date & time first
      const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
      return dateB - dateA;
    });
  }, [periodTransactions, typeFilter, modeFilter, categoryFilter, sourceFilter, statusFilter, searchTerm]);

  // Unique category & source options
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    currentCompanyTransactions.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats);
  }, [currentCompanyTransactions]);

  const uniqueSources = useMemo(() => {
    const srcs = new Set<string>();
    currentCompanyTransactions.forEach(t => { if (t.source_type) srcs.add(t.source_type); });
    return Array.from(srcs);
  }, [currentCompanyTransactions]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert('No transactions to export for the selected filters.');
      return;
    }

    const headers = [
      'Date', 'Time', 'Transaction ID', 'Type', 'Party Name', 
      'Category', 'Payment Mode', 'Reference #', 'Amount (INR)', 
      'Source', 'Status', 'Created By', 'Remarks'
    ];

    const rows = filteredTransactions.map(t => [
      `"${t.date}"`,
      `"${t.time || ''}"`,
      `"${t.transaction_number}"`,
      `"${t.type === 'CASH_IN' ? 'CASH IN' : 'CASH OUT'}"`,
      `"${(t.party_name || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${t.payment_mode}"`,
      `"${t.reference_number || ''}"`,
      t.amount,
      `"${t.source_type}"`,
      `"${t.status}"`,
      `"${t.created_by}"`,
      `"${(t.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const compName = (activeCompany?.name || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `CashFlow_${compName}_${effectiveStartDate}_to_${effectiveEndDate}.csv`;
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const openCashIn = () => {
    setEntryDefaultType('CASH_IN');
    setEntryModalOpen(true);
  };

  const openCashOut = () => {
    setEntryDefaultType('CASH_OUT');
    setEntryModalOpen(true);
  };

  if (!mounted) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold text-sm">
        Loading FMCG Cash Flow &amp; Treasury Engine...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-none pb-20 text-slate-800">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-2xl text-xs font-bold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Financial Management
              </span>
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                {activeCompany?.name || 'Saifee Distributor'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Cash Flow &amp; Money Movement
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict multi-company financial register tracking actual money in and money out across all payment channels.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setOpeningBalanceModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 text-slate-600" />
              <span>Opening Balance</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print</span>
            </button>

            <button
              onClick={openCashIn}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cash In</span>
            </button>

            <button
              onClick={openCashOut}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cash Out</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Period:</span>
            </span>
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_fy', label: 'This Financial Year (1 Apr - 31 Mar)' },
                { id: 'custom', label: 'Custom Range' }
              ] as const
            ).map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDatePreset(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  datePreset === preset.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-150">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:border-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <CashFlowSummaryCards
        openingBalance={periodOpeningBalance}
        totalCashIn={totalCashIn}
        totalCashOut={totalCashOut}
        netCashFlow={netCashFlow}
        closingBalance={closingBalance}
        dateRangeLabel={dateRangeLabel}
      />

      {/* Payment Mode Breakdown */}
      <PaymentModeBreakdown
        breakdown={paymentModeBreakdown}
        selectedMode={modeFilter}
        onSelectMode={(mode) => setModeFilter(mode)}
      />

      {/* Transaction Register Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Register Top Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Transaction Register
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {filteredTransactions.length} entries
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search party, ID, ref #, invoice #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          
          {/* Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="all">All (In &amp; Out)</option>
              <option value="CASH_IN">Cash In Only</option>
              <option value="CASH_OUT">Cash Out Only</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="all">All Sources</option>
              {uniqueSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold focus:bg-white focus:border-indigo-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="voided">Voided / Reversed</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setModeFilter('all');
                setCategoryFilter('all');
                setSourceFilter('all');
                setStatusFilter('all');
                setSearchTerm('');
              }}
              className="w-full p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>

        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-black uppercase text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3">Date &amp; Time</th>
                <th className="py-2.5 px-2">Tx ID</th>
                <th className="py-2.5 px-2">Type</th>
                <th className="py-2.5 px-3">Party (From / To)</th>
                <th className="py-2.5 px-2">Category</th>
                <th className="py-2.5 px-2">Mode</th>
                <th className="py-2.5 px-2">Reference</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-2 text-center">Source</th>
                <th className="py-2.5 px-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(tx => {
                const isIn = tx.type === 'CASH_IN';
                const isVoided = tx.status === 'Voided';

                return (
                  <tr 
                    key={tx.id} 
                    className={`transition-colors ${
                      isVoided 
                        ? 'bg-slate-50/70 opacity-60' 
                        : isIn 
                        ? 'hover:bg-emerald-50/20' 
                        : 'hover:bg-rose-50/20'
                    }`}
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{tx.date}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.time}</div>
                    </td>

                    <td className="py-2.5 px-2 font-mono font-bold text-slate-700 whitespace-nowrap">
                      {tx.transaction_number}
                    </td>

                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                        isVoided
                          ? 'bg-slate-100 text-slate-600 border-slate-300'
                          : isIn
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}>
                        {isIn ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                        <span>{isIn ? 'CASH IN' : 'CASH OUT'}</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{tx.party_name}</div>
                      {tx.linked_invoice_number && (
                        <span className="text-[10px] text-indigo-600 font-semibold block">
                          Inv: {tx.linked_invoice_number}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 font-semibold text-slate-700">
                      {tx.category}
                    </td>

                    <td className="py-2.5 px-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {tx.payment_mode}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500 truncate max-w-[120px]">
                      {tx.reference_number || '—'}
                    </td>

                    <td className="py-2.5 px-3 text-right font-black text-sm whitespace-nowrap">
                      <span className={isVoided ? 'line-through text-slate-400' : isIn ? 'text-emerald-600' : 'text-rose-600'}>
                        {formatINR(tx.amount)}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 text-center text-[10px] text-slate-500 whitespace-nowrap">
                      <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-medium">
                        {tx.source_type}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailsTx(tx)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="View Details & Audit History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {!isVoided && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedEditTx(tx)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedVoidTx(tx)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Void / Reverse Entry"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No cash flow transactions found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="block md:hidden space-y-3">
          {filteredTransactions.map(tx => {
            const isIn = tx.type === 'CASH_IN';
            const isVoided = tx.status === 'Voided';

            return (
              <div 
                key={tx.id} 
                className={`p-4 rounded-xl border space-y-2.5 ${
                  isVoided 
                    ? 'bg-slate-50 border-slate-200 opacity-60' 
                    : isIn 
                    ? 'bg-white border-emerald-200/80 shadow-2xs' 
                    : 'bg-white border-rose-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                      isVoided 
                        ? 'bg-slate-100 text-slate-600 border-slate-300' 
                        : isIn 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}>
                      {isIn ? 'CASH IN' : 'CASH OUT'}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {tx.transaction_number}
                    </span>
                  </div>

                  <div className={`text-base font-black ${isVoided ? 'line-through text-slate-400' : isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatINR(tx.amount)}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 text-sm">{tx.party_name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{tx.payment_mode}</span>
                    <span>&bull;</span>
                    <span>{tx.category}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>{tx.date} &bull; {tx.time}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDetailsTx(tx)}
                      className="text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      [View]
                    </button>
                    {!isVoided && (
                      <button
                        onClick={() => setSelectedEditTx(tx)}
                        className="text-slate-600 font-bold hover:underline cursor-pointer"
                      >
                        [Edit]
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
              No transactions found.
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      <CashFlowEntryModal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        defaultType={entryDefaultType}
        onSuccess={(tx) => showToast(`Transaction ${tx.transaction_number} recorded successfully!`)}
      />

      <CashFlowDetailsModal
        transaction={selectedDetailsTx}
        onClose={() => setSelectedDetailsTx(null)}
        onEdit={(tx) => setSelectedEditTx(tx)}
        onVoid={(tx) => setSelectedVoidTx(tx)}
      />

      <CashFlowEditModal
        transaction={selectedEditTx}
        isOpen={!!selectedEditTx}
        onClose={() => setSelectedEditTx(null)}
        onSuccess={(tx) => showToast(`Transaction ${tx.transaction_number} updated with audit trail.`)}
      />

      <CashFlowVoidModal
        transaction={selectedVoidTx}
        isOpen={!!selectedVoidTx}
        onClose={() => setSelectedVoidTx(null)}
        onSuccess={(tx) => showToast(`Transaction ${tx.transaction_number} voided / reversed.`)}
      />

      <SetOpeningBalanceModal
        isOpen={openingBalanceModalOpen}
        onClose={() => setOpeningBalanceModalOpen(false)}
        onSuccess={() => showToast('Company opening balance updated successfully.')}
      />

    </div>
  );
}

export default function AdminCashFlowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">Loading Cash Flow Module...</div>}>
      <AdminCashFlowContent />
    </Suspense>
  );
}
