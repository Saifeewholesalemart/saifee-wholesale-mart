'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { useSearchParams } from 'next/navigation';
import { 
  FileText, Printer, ChevronRight, ArrowLeft, History, ShieldCheck, 
  Tag, Search, Filter, Calendar, Store, Edit3, DollarSign, CheckCircle2, 
  AlertCircle, X, SlidersHorizontal, ArrowUpDown, Clock, PackageOpen
} from 'lucide-react';
import { Invoice, formatQuantityDisplay } from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import AuditTrailModal from '@/components/AuditTrailModal';
import InvoiceEditModal from '@/components/InvoiceEditModal';
import InvoiceAuditTrailModal from '@/components/InvoiceAuditTrailModal';
import SmartSearchBar from '@/components/SmartSearchBar';
import { printInvoiceDocument } from '@/lib/printInvoice';

// Helper: Convert number to Indian Rupees in words
function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Rupees Zero Only';

  const parts = num.toFixed(2).split('.');
  const whole = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1], 10) : 0;

  function inWords(n: number): string {
    let str = '';
    if (n >= 10000000) {
      str += `${inWords(Math.floor(n / 10000000))} Crore `;
      n %= 10000000;
    }
    if (n >= 100000) {
      str += `${inWords(Math.floor(n / 100000))} Lakh `;
      n %= 100000;
    }
    if (n >= 1000) {
      str += `${inWords(Math.floor(n / 1000))} Thousand `;
      n %= 1000;
    }
    if (n >= 100) {
      str += `${inWords(Math.floor(n / 100))} Hundred `;
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)];
        if (n % 10 > 0) str += ` ${a[n % 10]}`;
      }
    }
    return str.trim();
  }

  let words = inWords(whole);
  words = words ? `Rupees ${words}` : 'Rupees Zero';

  if (paise > 0) {
    words += ` and ${inWords(paise)} Paise`;
  }
  return `${words} Only`;
}

// Helper: Shorten trading unit
function formatTradingUnit(unit: string): string {
  if (!unit) return '';
  const u = unit.toLowerCase();
  if (u.includes('carton')) return 'CTN';
  if (u.includes('box')) return 'BOX';
  if (u.includes('bag')) return 'BAG';
  return unit.toUpperCase();
}

// Helper: Format Date dd-mmm-yyyy
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function AdminInvoicesContent() {
  const { invoices, retailers, products, batches, invoiceAuditLogs, orders, fulfilments, activeCompany } = useDb();
  const searchParams = useSearchParams();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to get all contributing original order numbers for any invoice
  const getInvoiceOrderInfo = (inv: Invoice): { orderNumber: string; source: string; orderId: string }[] => {
    // 1. Explicit source_order_numbers on invoice
    if (inv.source_order_numbers && inv.source_order_numbers.length > 0) {
      return inv.source_order_numbers.map((num, idx) => {
        const ordId = inv.source_order_ids?.[idx];
        const matchOrd = orders.find(o => o.order_number === num || o.id === ordId);
        return {
          orderNumber: num,
          source: matchOrd?.source || 'direct',
          orderId: matchOrd?.id || ordId || ''
        };
      });
    }

    // 2. Linked to Fulfilment
    if (inv.order_ref_id?.startsWith('ful-')) {
      const matchFul = fulfilments.find(f => f.id === inv.order_ref_id);
      if (matchFul && matchFul.source_order_ids && matchFul.source_order_ids.length > 0) {
        const matchOrders = orders.filter(o => matchFul.source_order_ids?.includes(o.id));
        if (matchOrders.length > 0) {
          return matchOrders.map(o => ({
            orderNumber: o.order_number,
            source: o.source,
            orderId: o.id
          }));
        }
      }
    }

    // 3. Direct Order Ref
    if (inv.order_ref_id) {
      const directOrd = orders.find(o => o.id === inv.order_ref_id || o.order_number === inv.order_ref_id);
      if (directOrd) {
        return [{
          orderNumber: directOrd.order_number,
          source: directOrd.source,
          orderId: directOrd.id
        }];
      }
    }

    return [];
  };

  // Sync from URL search params (e.g. from Payments page)
  useEffect(() => {
    const invId = searchParams.get('id');
    const invNum = searchParams.get('invoice');
    if (invId) {
      setSelectedInvoiceId(invId);
    } else if (invNum) {
      const target = invoices.find(i => i.invoice_number.toLowerCase() === invNum.toLowerCase());
      if (target) {
        setSelectedInvoiceId(target.id);
      }
    }
  }, [searchParams, invoices]);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [retailerFilter, setRetailerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'invoice_desc'>('date_desc');

  // Invoice Items Search Query (for quick filtering 30-50 item bills)
  const [invoiceItemSearchQuery, setInvoiceItemSearchQuery] = useState('');

  // Modals
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string } | null>(null);
  const [showRateAuditModal, setShowRateAuditModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInvoiceAuditOpen, setIsInvoiceAuditOpen] = useState(false);

  // Selected Invoice (reactive to db changes)
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoices.find(i => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  // Filtered invoice items based on quick search
  const filteredInvoiceItems = useMemo(() => {
    if (!selectedInvoice?.items) return [];
    if (!invoiceItemSearchQuery.trim()) return selectedInvoice.items;
    const q = invoiceItemSearchQuery.toLowerCase().trim();
    return selectedInvoice.items.filter(item => {
      const prod = products.find(p => p.id === item.product_id);
      const prodName = (prod?.name || item.description || item.variant_name || item.product_name || '').toLowerCase();
      const hsn = (item.hsn || prod?.hsn || '').toLowerCase();
      const batchNo = (item.batch_number || batches?.find(b => b.product_id === item.product_id)?.batch_number || '').toLowerCase();
      const packing = (item.packing || prod?.pack_size || '').toLowerCase();
      const mrp = String(item.mrp || prod?.mrp || '');
      return prodName.includes(q) || hsn.includes(q) || batchNo.includes(q) || packing.includes(q) || mrp.includes(q);
    });
  }, [selectedInvoice, invoiceItemSearchQuery, products, batches]);

  // Handle print
  const handlePrint = () => {
    if (selectedInvoice) {
      printInvoiceDocument('printable-tax-invoice', `Tax Invoice - ${selectedInvoice.invoice_number}`);
    } else {
      printInvoiceDocument('printable-tax-invoice', 'Tax Invoice');
    }
  };

  // Filter & Search Engine
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return invoices.filter(inv => {
      const ret = retailers.find(r => r.id === inv.retailer_id);

      // 1. Search Query: Invoice Number, Retailer Name, Code, Owner, City, Mobile, Product in items, or Original Order Number
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = (inv.invoice_number || '').toLowerCase().includes(q);
        const matchShop = (ret?.shop_name || '').toLowerCase().includes(q);
        const matchOwner = (ret?.owner_name || '').toLowerCase().includes(q);
        const matchCode = (ret?.retailer_code || '').toLowerCase().includes(q);
        const matchCity = (ret?.city || '').toLowerCase().includes(q);
        const matchMobile = (ret?.mobile || '').toLowerCase().includes(q);
        const matchItem = inv.items?.some(i => {
          const prod = products.find(p => p.id === i.product_id);
          return (prod?.name || '').toLowerCase().includes(q);
        });
        const orderInfos = getInvoiceOrderInfo(inv);
        const matchOrder = orderInfos.some(o => o.orderNumber.toLowerCase().includes(q) || o.source.toLowerCase().includes(q));

        if (!matchNumber && !matchShop && !matchOwner && !matchCode && !matchCity && !matchMobile && !matchItem && !matchOrder) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'paid') {
        if (inv.outstanding_amount > 0) return false;
      } else if (statusFilter === 'unpaid') {
        if (inv.paid_amount > 0 || inv.outstanding_amount <= 0) return false;
      } else if (statusFilter === 'partial') {
        if (inv.paid_amount <= 0 || inv.outstanding_amount <= 0) return false;
      }

      // 3. Retailer Filter
      if (retailerFilter !== 'all' && inv.retailer_id !== retailerFilter) {
        return false;
      }

      // 4. Date Filter
      const invDateStr = inv.date ? inv.date.slice(0, 10) : '';
      if (dateFilter === 'today') {
        if (invDateStr !== todayStr) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (new Date(inv.date) < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (new Date(inv.date) < monthAgo) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate && invDateStr < customStartDate) return false;
        if (customEndDate && invDateStr > customEndDate) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortBy === 'date_asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'amount_desc') {
        return b.grand_total - a.grand_total;
      } else if (sortBy === 'amount_asc') {
        return a.grand_total - b.grand_total;
      } else if (sortBy === 'invoice_desc') {
        return b.invoice_number.localeCompare(a.invoice_number);
      }
      return 0;
    });
  }, [invoices, retailers, products, searchQuery, statusFilter, retailerFilter, dateFilter, customStartDate, customEndDate, sortBy]);

  // Metrics
  const metrics = useMemo(() => {
    let totalValue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    filteredInvoices.forEach(i => {
      totalValue += i.grand_total;
      totalPaid += i.paid_amount;
      totalOutstanding += i.outstanding_amount;
    });

    return {
      count: filteredInvoices.length,
      totalValue,
      totalPaid,
      totalOutstanding
    };
  }, [filteredInvoices]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (retailerFilter !== 'all') count++;
    if (dateFilter !== 'all') count++;
    return count;
  }, [searchQuery, statusFilter, retailerFilter, dateFilter]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setRetailerFilter('all');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortBy('date_desc');
  };

  // Get audit log count for selected invoice
  const selectedInvoiceEditCount = useMemo(() => {
    if (!selectedInvoice) return 0;
    const logs = invoiceAuditLogs.filter(l => l.invoice_id === selectedInvoice.id);
    return Math.max(logs.length, selectedInvoice.edit_count || 0);
  }, [selectedInvoice, invoiceAuditLogs]);

  if (!mounted) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold text-sm">
        Loading Invoices Hub...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">GST Invoice Register & Management</h2>
              <p className="text-xs text-slate-500">
                Admin control hub: search, edit generated invoices with automatic balance reconciliation, review audit logs, and print tax invoices.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards (No Print) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Total Invoices</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-800">{metrics.count}</span>
            <span className="text-xs text-slate-500 font-medium">of {invoices.length} total</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">Total Billed Value</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-indigo-700">₹{metrics.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Gross</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">Total Collected</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-700">₹{metrics.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Paid</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block">Total Outstanding Dues</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-rose-700">₹{metrics.totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            <span className="text-xs bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold">Unsettled</span>
          </div>
        </div>
      </div>

      {/* Search & Multi-Filter Suite (No Print) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 no-print">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Main Search Bar with Live Suggestions */}
          <div className="flex-1">
            <SmartSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by Invoice No, Retailer Name, Code, City, Phone, or Item..."
              entityFilter={['invoice', 'retailer', 'product']}
            />
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'unpaid' ? 'bg-white text-red-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unpaid
            </button>
            <button
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'partial' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Partial
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'paid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid
            </button>
          </div>
        </div>

        {/* Second Row of Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Retailer Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
              <Store className="w-3 h-3 text-indigo-500" />
              Filter by Retailer
            </label>
            <select
              value={retailerFilter}
              onChange={(e) => setRetailerFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Retailer Stores ({retailers.length})</option>
              {retailers.map(r => (
                <option key={r.id} value={r.id}>
                  {r.shop_name} ({r.city || 'MH'})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
              Date Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Inputs if 'custom' selected */}
          {dateFilter === 'custom' ? (
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs font-medium"
                />
              </div>
            </div>
          ) : (
            /* Sort By */
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                Sort Invoices
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="date_desc">Newest Date First</option>
                <option value="date_asc">Oldest Date First</option>
                <option value="amount_desc">Highest Amount First</option>
                <option value="amount_asc">Lowest Amount First</option>
                <option value="invoice_desc">Invoice Number (Z-A)</option>
              </select>
            </div>
          )}

          {/* Reset Filters / Clear */}
          <div className="flex items-end">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset ({activeFiltersCount}) Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Invoices Ledger (Left) and Detail View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Pane: Invoice Register List */}
        <div className={`erp-card bg-white p-5 space-y-4 no-print ${selectedInvoice ? 'hidden lg:block' : 'col-span-3'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Invoice Ledger ({filteredInvoices.length})
            </h3>
            {filteredInvoices.length !== invoices.length && (
              <span className="text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                Filtered from {invoices.length}
              </span>
            )}
          </div>
          
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">No matching invoices found.</p>
              <p className="text-xs text-slate-500 font-medium">Try adjusting your search query or reset filters.</p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[640px] pr-1 space-y-1">
              {filteredInvoices.map(inv => {
                const ret = retailers.find(r => r.id === inv.retailer_id);
                const isSelected = selectedInvoice?.id === inv.id;
                const isPaid = inv.outstanding_amount <= 0;
                const isPartial = inv.paid_amount > 0 && inv.outstanding_amount > 0;
                const editCount = invoiceAuditLogs.filter(l => l.invoice_id === inv.id).length || inv.edit_count || 0;

                return (
                  <button
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className={`w-full text-left p-3.5 flex items-center justify-between transition-all rounded-xl border cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-xs ring-1 ring-indigo-400' 
                        : 'hover:bg-slate-50 border-slate-150'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 pr-3">
                      {/* Top: Invoice No & Edit Badge */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {inv.invoice_number}
                        </span>
                        {editCount > 0 && (
                          <span className="text-xs font-extrabold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Edited ({editCount})</span>
                          </span>
                        )}
                      </div>

                      {/* Retailer Name (ALWAYS PROMINENTLY DISPLAYED) */}
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-xs font-extrabold text-slate-800 block truncate">
                          {ret?.shop_name || 'Retailer Store'}
                        </span>
                      </div>

                      {/* City, Date, Items summary */}
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                        <span>{ret?.city || 'MH'}</span>
                        <span>&bull;</span>
                        <span>{formatDate(inv.date)}</span>
                        <span>&bull;</span>
                        <span>{inv.items?.length || 0} item{(inv.items?.length || 0) === 1 ? '' : 's'}</span>
                      </div>

                      {/* Contributing Orders Indicator */}
                      {(() => {
                        const orderInfos = getInvoiceOrderInfo(inv);
                        if (orderInfos.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1 text-2xs text-indigo-700 font-bold font-mono truncate">
                            <PackageOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{orderInfos.length > 1 ? 'Orders' : 'Order'}: {orderInfos.map(o => o.orderNumber).join(', ')}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Side: Amount & Payment Status */}
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          ₹{inv.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-bold block mt-0.5 uppercase tracking-wide ${
                          isPaid ? 'text-emerald-700' : isPartial ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {isPaid ? 'Paid' : isPartial ? `Due: ₹${inv.outstanding_amount.toLocaleString('en-IN')}` : `Unpaid: ₹${inv.outstanding_amount.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane: Invoice Detail Sheet */}
        {selectedInvoice ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Back to register on mobile */}
            <button
              onClick={() => setSelectedInvoiceId(null)}
              className="lg:hidden no-print flex items-center gap-1.5 text-xs text-indigo-650 font-bold hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Invoice register</span>
            </button>

            {/* Persistent Sticky Invoice Header (No Print) */}
            <div className="no-print bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-xl text-white shadow-md flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-indigo-300 bg-indigo-900/60 border border-indigo-700/60 px-2 py-0.5 rounded">
                    {selectedInvoice.invoice_number}
                  </span>
                  {(() => {
                    const isPaid = selectedInvoice.outstanding_amount <= 0;
                    const isPartiallyPaid = selectedInvoice.paid_amount > 0 && selectedInvoice.outstanding_amount > 0;
                    if (isPaid) {
                      return <span className="text-xs font-black uppercase text-emerald-300 bg-emerald-950/80 border border-emerald-700 px-2.5 py-1 rounded">PAID</span>;
                    } else if (isPartiallyPaid) {
                      return <span className="text-xs font-black uppercase text-amber-300 bg-amber-950/80 border border-amber-700 px-2.5 py-1 rounded">PARTIAL</span>;
                    } else {
                      return <span className="text-xs font-black uppercase text-rose-300 bg-rose-950/80 border border-rose-700 px-2.5 py-1 rounded">UNPAID</span>;
                    }
                  })()}
                  {selectedInvoiceEditCount > 0 && (
                    <button
                      onClick={() => setIsInvoiceAuditOpen(true)}
                      className="text-xs font-bold uppercase text-amber-200 bg-amber-900/60 border border-amber-600/60 px-2.5 py-1 rounded flex items-center gap-1.5 hover:bg-amber-800 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Edited ({selectedInvoiceEditCount})</span>
                    </button>
                  )}
                </div>
                {/* Retailer info */}
                {(() => {
                  const ret = retailers.find(r => r.id === selectedInvoice.retailer_id);
                  return (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                      <Store className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>RETAILER: {ret?.shop_name}</span>
                      <span className="text-slate-300 font-medium text-xs">({ret?.owner_name}, {ret?.city || 'MH'} &bull; Mob: {ret?.mobile})</span>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Admin Edit Invoice Button */}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                  title="Edit invoice quantities, rates, or line items"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Invoice</span>
                </button>

                {/* Change History Button */}
                <button
                  onClick={() => setIsInvoiceAuditOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="View complete revision history"
                >
                  <History className="w-3.5 h-3.5 text-amber-300" />
                  <span>Change History {selectedInvoiceEditCount > 0 ? `(${selectedInvoiceEditCount})` : ''}</span>
                </button>

                {/* Print Invoice Button */}
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-800" />
                  <span>Print GST Receipt</span>
                </button>
              </div>
            </div>

            {/* Printable Tax Invoice Container */}
            <div id="printable-tax-invoice" className="erp-card bg-white p-3 sm:p-5 space-y-3 print-area shadow-lg border border-slate-200 rounded-xl relative overflow-hidden text-xs">
              {/* Inject CSS print tweaks for clean high-density A4 printout */}
              <style>{`
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 8mm;
                  }
                  #printable-tax-invoice {
                    display: block !important;
                    visibility: visible !important;
                    position: relative !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 6mm 8mm !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    box-shadow: none !important;
                    border: 1px solid #334155 !important;
                    border-radius: 0 !important;
                    box-sizing: border-box !important;
                  }
                  #printable-tax-invoice * {
                    visibility: visible !important;
                  }
                  .no-print,
                  .no-print *,
                  button,
                  header,
                  nav,
                  aside,
                  footer {
                    display: none !important;
                    visibility: hidden !important;
                  }
                  body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background-color: #ffffff !important;
                    font-size: 8pt !important;
                    color: #000000 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  table {
                    width: 100% !important;
                    page-break-inside: auto;
                    border-collapse: collapse !important;
                  }
                  tr {
                    page-break-inside: avoid !important;
                    page-break-after: auto;
                  }
                  thead {
                    display: table-header-group !important;
                  }
                  .dense-print-th {
                    padding: 2px 3px !important;
                    font-size: 7pt !important;
                    border-top: 1px solid #000000 !important;
                    border-bottom: 1px solid #000000 !important;
                    background-color: #f1f5f9 !important;
                    color: #000000 !important;
                  }
                  .dense-print-td {
                    padding: 2px 3px !important;
                    font-size: 7.5pt !important;
                    border-bottom: 0.5px solid #cbd5e1 !important;
                    line-height: 1.15 !important;
                  }
                }
              `}</style>

              {/* Sub control bar in detail view */}
              <div className="no-print flex justify-between items-center border-b border-slate-100 pb-2">
                <button
                  onClick={() => setShowRateAuditModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-850 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Price Override Audit Log</span>
                </button>

                {selectedInvoice.last_edited_at && (
                  <span className="text-xs text-slate-500 font-medium">
                    Last edited on {formatDate(selectedInvoice.last_edited_at)} by {selectedInvoice.last_edited_by || 'Admin'}
                  </span>
                )}
              </div>

              {/* Top Compact Header: Firm & Invoice Metadata */}
              {(() => {
                const firmName = activeCompany?.name?.toUpperCase() || 'SAIFEE GENERAL STORES';
                const firmFirstLetter = firmName.charAt(0) || 'S';
                const firmAddress = activeCompany?.address 
                  ? `${activeCompany.address}${activeCompany.city ? `, ${activeCompany.city}` : ''}` 
                  : 'FMCG Warehouse Distributors, Sector 15, Kalamboli Logistics Zone, Navi Mumbai, MH';
                const firmGstin = activeCompany?.gstin || '27SAIFE1234A1Z5';
                const isPaid = selectedInvoice.outstanding_amount <= 0;
                const isPartiallyPaid = selectedInvoice.paid_amount > 0 && selectedInvoice.outstanding_amount > 0;
                const orderInfos = getInvoiceOrderInfo(selectedInvoice);

                return (
                  <div className="flex justify-between items-start gap-3 border-b border-slate-300 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-white font-black text-xs">
                          {firmFirstLetter}
                        </div>
                        <span className="text-sm sm:text-base font-black text-slate-950 tracking-tight uppercase">
                          {firmName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug max-w-sm">
                        {firmAddress}
                      </p>
                      <p className="text-[11px] text-slate-900 font-bold">GSTIN: {firmGstin} <span className="text-slate-500 font-normal">| State: 27 (MH)</span></p>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider">
                          TAX INVOICE
                        </span>
                        {isPaid ? (
                          <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                            PAID
                          </span>
                        ) : isPartiallyPaid ? (
                          <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                            PARTIAL
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded">
                            UNPAID
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-700 text-right space-y-0.5">
                        <p><span className="text-slate-500">Invoice No:</span> <strong className="text-slate-900 font-bold font-mono">{selectedInvoice.invoice_number}</strong></p>
                        <p><span className="text-slate-500">Date:</span> <strong className="text-slate-900 font-bold">{formatDate(selectedInvoice.date)}</strong></p>
                        <p><span className="text-slate-500">Place of Supply:</span> <strong className="text-slate-900 font-semibold">{selectedInvoice.place_of_supply || 'Maharashtra (27)'}</strong></p>
                        {orderInfos.length > 0 && (
                          <p><span className="text-slate-500">{orderInfos.length > 1 ? 'Orders:' : 'Order Ref:'}</span> <strong className="text-indigo-900 font-bold font-mono">{orderInfos.map(o => o.orderNumber).join(', ')}</strong></p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Billed To (Buyer) & Despatch Details Grid */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-2 text-[11px]">
                <div className="space-y-0.5 pr-2 border-r border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">BUYER (BILL TO)</span>
                  {(() => {
                    const ret = retailers.find(r => r.id === selectedInvoice.retailer_id);
                    return (
                      <div className="space-y-0.5 text-slate-700 text-[11px]">
                        <p className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] leading-snug tracking-tight uppercase">{ret?.shop_name || 'Retailer Store'}</p>
                        <p className="text-slate-700 leading-tight">{ret?.address || 'Local Market Area'}</p>
                        <p className="text-slate-800"><span className="text-slate-500">Prop:</span> {ret?.owner_name || 'N/A'} <span className="text-slate-500">| Ph:</span> {ret?.mobile || ret?.phone || 'N/A'}</p>
                        <p className="font-bold text-slate-900"><span className="text-slate-500 font-normal">GSTIN:</span> {ret?.gstin || 'Unregistered'}</p>
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-0.5 pl-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">DESPATCH &amp; TERMS</span>
                  <div className="space-y-0.5 text-slate-700 text-[11px]">
                    <p className="flex justify-between"><span className="text-slate-500">Dispatch Mode:</span> <span className="font-semibold text-slate-800">Delivery Van</span></p>
                    <p className="flex justify-between"><span className="text-slate-500">Payment Terms:</span> <span className="font-semibold text-slate-800">Credit Account</span></p>
                    {selectedInvoice.fulfilment_number && (
                      <p className="flex justify-between"><span className="text-slate-500">Fulfilment:</span> <span className="font-mono font-bold text-indigo-700">{selectedInvoice.fulfilment_number}</span></p>
                    )}
                    {(() => {
                      const orderInfos = getInvoiceOrderInfo(selectedInvoice);
                      if (orderInfos.length === 0) return null;
                      return (
                        <p className="flex justify-between pt-0.5 border-t border-slate-100">
                          <span className="text-slate-500">Order Source:</span>
                          <span className="font-semibold text-slate-800">{orderInfos.map(o => o.source.replace('_', ' ')).join(', ')}</span>
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Item Quick Search Bar Just Above Items Table (Screen-only) */}
              <div className="no-print flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={invoiceItemSearchQuery}
                    onChange={(e) => setInvoiceItemSearchQuery(e.target.value)}
                    placeholder="Search item by name, HSN, batch, MRP, pack..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium shadow-2xs"
                  />
                  {invoiceItemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setInvoiceItemSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                      title="Clear item search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-medium text-[11px]">
                  {invoiceItemSearchQuery ? (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-md font-bold font-mono">
                      Showing {filteredInvoiceItems.length} of {selectedInvoice.items?.length || 0} items
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold font-mono">
                      {selectedInvoice.items?.length || 0} items
                    </span>
                  )}
                </div>
              </div>

              {/* Single-Line High-Density Item Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-900 text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                      <th className="py-1 px-1.5 text-center w-7 dense-print-th">#</th>
                      <th className="py-1 px-2 text-left dense-print-th">Description of Goods</th>
                      <th className="py-1 px-1.5 text-center w-16 dense-print-th">HSN</th>
                      <th className="py-1 px-1.5 text-right w-16 dense-print-th">MRP (₹)</th>
                      <th className="py-1 px-2 text-center w-28 dense-print-th">Billed Qty</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Rate/Pc (₹)</th>
                      <th className="py-1 px-1.5 text-right w-14 dense-print-th">Disc (₹)</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Taxable (₹)</th>
                      <th className="py-1 px-1 text-center w-12 dense-print-th">GST</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredInvoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                          <div className="space-y-1.5">
                            <p className="font-bold text-slate-700">No invoice items match &ldquo;{invoiceItemSearchQuery}&rdquo;</p>
                            <p className="text-[11px] text-slate-400">Try searching with a different product name, HSN or batch number.</p>
                            <button
                              type="button"
                              onClick={() => setInvoiceItemSearchQuery('')}
                              className="inline-block mt-1 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-bold transition-colors cursor-pointer"
                            >
                              Clear Search Filter
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredInvoiceItems.map((item, idx) => {
                      const prod = products.find(p => p.id === item.product_id);
                      const batchNo = item.batch_number || batches?.find(b => b.product_id === item.product_id)?.batch_number;
                      const batchObj = batches?.find(b => b.product_id === item.product_id && b.batch_number === batchNo);
                      const expiryDate = batchObj?.expiry_date ? formatDate(batchObj.expiry_date) : '';
                      const gstRate = prod?.gst_percent ? `${prod.gst_percent}%` : '18%';

                      // Billed Qty Formatter strictly in Pieces
                      const totalPieces = item.base_qty ?? item.quantity ?? (item.loose_qty !== undefined ? item.loose_qty + ((item.carton_qty || 0) * (item.units_per_box_carton || 1)) : 0);
                      const qtyDisplay = `${totalPieces} Pcs`;

                      // Unit Rate Formatter strictly per Piece
                      const unitRate = item.rate ?? item.loose_rate ?? item.carton_rate ?? 0;
                      const rateDisplay = `₹${unitRate.toFixed(2)}/Pc`;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                          {/* 1. Sr. No. */}
                          <td className="py-1 px-1.5 text-center text-slate-500 font-mono text-[10px] dense-print-td">{idx + 1}</td>
                          
                          {/* 2. Description of Goods (Single line + micro meta) */}
                          <td className="py-1 px-2 dense-print-td">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 leading-tight block">
                                {prod?.name || item.description || item.variant_name || item.product_name || 'FMCG Product'}
                              </span>
                              <div className="no-print">
                                <button
                                  type="button"
                                  onClick={() => setRateHistoryTarget({ retailerId: selectedInvoice.retailer_id, productId: item.product_id, tradingUnit: item.trading_unit })}
                                  className="inline-flex items-center gap-0.5 text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                                  title="View Last 5 Billing Rates"
                                >
                                  <History className="w-3 h-3 text-indigo-500" />
                                </button>
                              </div>
                            </div>
                            <span className="text-[9px] text-slate-500 font-normal inline-block print:text-[7pt]">
                              {batchNo && batchNo !== 'N/A' ? `Batch: ${batchNo}` : ''}
                              {expiryDate ? `${batchNo && batchNo !== 'N/A' ? ' • ' : ''}Exp: ${expiryDate}` : ''}
                            </span>
                          </td>

                          {/* 3. HSN */}
                          <td className="py-1 px-1.5 text-center font-mono text-slate-700 text-[10px] dense-print-td">
                            {item.hsn || prod?.hsn || '1902'}
                          </td>

                          {/* 4. MRP */}
                          <td className="py-1 px-1.5 text-right font-mono font-semibold text-slate-800 text-[11px] dense-print-td">
                            {(item.mrp || prod?.mrp || 0).toFixed(2)}
                          </td>

                          {/* 5. Billed Qty */}
                          <td className="py-1 px-2 text-center font-bold text-slate-900 text-[11px] whitespace-nowrap dense-print-td">
                            {qtyDisplay}
                          </td>

                          {/* 6. Rate / Unit */}
                          <td className="py-1 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap dense-print-td">
                            {rateDisplay}
                          </td>

                          {/* 7. Disc */}
                          <td className="py-1 px-1.5 text-right font-mono text-slate-600 text-[10px] dense-print-td">
                            {item.discount && item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '—'}
                          </td>

                          {/* 8. Taxable Value */}
                          <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 text-[11px] dense-print-td">
                            {(item.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 9. GST % */}
                          <td className="py-1 px-1 text-center font-mono text-slate-700 text-[10px] dense-print-td">
                            {gstRate}
                          </td>

                          {/* 10. Line Total */}
                          <td className="py-1 px-2 text-right font-mono font-black text-slate-950 text-[11px] dense-print-td">
                            {(item.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>

              {/* Compact Invoice Totals & Words Declaration */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t border-slate-300 pt-2 text-xs">
                {/* Left Side: Declarations & Amount in Words */}
                <div className="flex-1 space-y-2 max-w-md w-full">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[10px] leading-tight">
                    <strong className="text-slate-800 block uppercase mb-0.5">GST Declaration:</strong>
                    We declare that this invoice shows the actual price of goods described and particulars are true. Taxes are charged under Maharashtra GST (CGST/SGST 9% each for local sales, IGST 18% for interstate).
                  </div>

                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">AMOUNT IN WORDS</span>
                    <span className="font-extrabold text-slate-900 text-xs leading-tight block">
                      {numberToWords(selectedInvoice.grand_total)}
                    </span>
                  </div>
                </div>
                
                {/* Right Side: Totals Summary Card */}
                <div className="w-full sm:w-72 space-y-1 text-slate-700 font-semibold bg-slate-50 p-2.5 border border-slate-300 rounded text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-bold text-slate-900 font-mono">₹{(selectedInvoice.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {(selectedInvoice.cgst || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST @ 9%:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{(selectedInvoice.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST @ 9%:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{(selectedInvoice.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  {(selectedInvoice.igst || 0) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST @ 18%:</span>
                      <span className="font-bold text-slate-900 font-mono">₹{(selectedInvoice.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {selectedInvoice.round_off !== undefined && selectedInvoice.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{selectedInvoice.round_off > 0 ? `+₹${selectedInvoice.round_off.toFixed(2)}` : `-₹${Math.abs(selectedInvoice.round_off).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-950 font-black text-sm sm:text-base border-t border-slate-300 pt-1 mt-1">
                    <span>GRAND TOTAL:</span>
                    <span className="text-indigo-700 font-mono">₹{(selectedInvoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Compact Footer Signatures */}
              <div className="flex justify-between items-end border-t border-slate-300 pt-3 text-[10px] text-slate-600">
                <div>
                  <p className="text-slate-500">Goods received in good condition</p>
                  <div className="border-t border-dashed border-slate-400 w-32 mt-5"></div>
                  <p className="font-bold text-slate-800 mt-0.5">Receiver&apos;s Signature</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-700 font-semibold uppercase">For {activeCompany?.name || 'SAIFEE GENERAL STORES'}</p>
                  <div className="mt-5"></div>
                  <p className="font-bold text-slate-900 text-[10px]">Authorised Signatory</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex lg:col-span-2 items-center justify-center min-h-[400px] border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs no-print">
            <div className="space-y-2 max-w-sm">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">Select an Invoice to View Details</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click any invoice from the ledger on the left to review itemized GST breakdowns, edit invoice values, audit revision histories, or print physical receipts.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Admin Invoice Edit Modal */}
      {isEditModalOpen && selectedInvoice && (
        <InvoiceEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          invoice={selectedInvoice}
          onSuccess={(updated) => {
            setSelectedInvoiceId(updated.id);
          }}
        />
      )}

      {/* Invoice Revision Change History Modal */}
      {isInvoiceAuditOpen && selectedInvoice && (
        <InvoiceAuditTrailModal
          isOpen={isInvoiceAuditOpen}
          onClose={() => setIsInvoiceAuditOpen(false)}
          invoice={selectedInvoice}
        />
      )}

      {/* Last 5 Billing Rates Modal */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryTarget}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
        />
      )}

      {/* Price Override Audit Trail Modal */}
      {showRateAuditModal && (
        <AuditTrailModal
          isOpen={showRateAuditModal}
          onClose={() => setShowRateAuditModal(false)}
          retailerId={selectedInvoice?.retailer_id}
        />
      )}
    </div>
  );
}

export default function AdminInvoices() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">Loading Invoices...</div>}>
      <AdminInvoicesContent />
    </Suspense>
  );
}

