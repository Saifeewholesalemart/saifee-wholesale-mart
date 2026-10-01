'use client';

import React, { useState } from 'react';
import { 
  Calendar, Filter, RotateCcw, Download, Printer, Copy, Check, 
  ChevronDown, X, Building2, Tag, ShoppingBag, UserCheck, Store, 
  Clock, DollarSign, Eye, EyeOff, FileSpreadsheet, FileText, Layers, Users, Search
} from 'lucide-react';
import { DatePreset, ReportFilterState, DbState, UserContext } from '@/lib/reportsEngine';
import { exportToCSV, exportToExcel, copyTableToClipboard, printReport, ExportColumn } from '@/lib/exportUtils';

interface ReportFilterBarProps {
  filters: ReportFilterState;
  onChange: (newFilters: ReportFilterState) => void;
  dbState: DbState;
  userContext: UserContext;
  reportTitle: string;
  exportColumns: ExportColumn<any>[];
  exportData: any[];
  exportTotals?: Record<string, any>;
  showCharts?: boolean;
  onToggleCharts?: () => void;
}

export default function ReportFilterBar({
  filters,
  onChange,
  dbState,
  userContext,
  reportTitle,
  exportColumns,
  exportData,
  exportTotals,
  showCharts,
  onToggleCharts
}: ReportFilterBarProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Available categories derived from products and dbState categories
  const availableCategories = Array.from(
    new Set([
      ...dbState.products
        .filter(p => (!filters.companyId ? true : p.company_id === filters.companyId))
        .map(p => p.category)
        .filter(Boolean),
      ...(dbState.categories || []).map(c => c.name).filter(Boolean)
    ])
  ).sort();

  // Available brands derived from selected company or all products
  const availableBrands = Array.from(
    new Set(
      dbState.products
        .filter(p => (!filters.companyId ? true : p.company_id === filters.companyId))
        .filter(p => (!filters.category ? true : p.category === filters.category))
        .map(p => p.brand)
    )
  ).sort();

  // Active filter count for badge
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.datePreset !== 'all' && filters.datePreset !== 'this_month') count++;
    if (filters.companyId) count++;
    if (filters.category) count++;
    if (filters.brand) count++;
    if (filters.productId) count++;
    if (filters.retailerId) count++;
    if (filters.salespersonId) count++;
    if (filters.paymentStatus && filters.paymentStatus !== 'All') count++;
    if (filters.orderStatus && filters.orderStatus !== 'All') count++;
    if (filters.expiryStatus && filters.expiryStatus !== 'All') count++;
    return count;
  };

  const handleReset = () => {
    onChange({
      datePreset: 'this_month',
      paymentStatus: 'All',
      orderStatus: 'All',
      expiryStatus: 'All',
      searchQuery: undefined,
      category: undefined,
      companyId: undefined,
      retailerId: undefined,
      salespersonId: undefined,
      brand: undefined,
      productId: undefined
    });
  };

  const handleCopy = async () => {
    const success = await copyTableToClipboard({
      reportTitle,
      columns: exportColumns,
      data: exportData,
      totalsRow: exportTotals
    });
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeChips: { label: string; onRemove: () => void }[] = [];

  if (filters.searchQuery) {
    activeChips.push({
      label: `Search: "${filters.searchQuery}"`,
      onRemove: () => onChange({ ...filters, searchQuery: undefined })
    });
  }

  if (filters.companyId) {
    const c = dbState.companies.find(comp => comp.id === filters.companyId);
    activeChips.push({
      label: `Company: ${c?.name || filters.companyId}`,
      onRemove: () => onChange({ ...filters, companyId: undefined, brand: undefined })
    });
  }

  if (filters.category) {
    activeChips.push({
      label: `Category: ${filters.category}`,
      onRemove: () => onChange({ ...filters, category: undefined })
    });
  }

  if (filters.brand) {
    activeChips.push({
      label: `Brand: ${filters.brand}`,
      onRemove: () => onChange({ ...filters, brand: undefined })
    });
  }

  if (filters.productId) {
    const p = dbState.products.find(prod => prod.id === filters.productId);
    activeChips.push({
      label: `Product: ${p?.name || filters.productId}`,
      onRemove: () => onChange({ ...filters, productId: undefined })
    });
  }

  if (filters.retailerId) {
    const r = dbState.retailers.find(ret => ret.id === filters.retailerId);
    activeChips.push({
      label: `Retailer: ${r?.shop_name || filters.retailerId}`,
      onRemove: () => onChange({ ...filters, retailerId: undefined })
    });
  }

  if (filters.salespersonId) {
    const sp = dbState.profiles.find(p => p.id === filters.salespersonId);
    activeChips.push({
      label: `Salesperson: ${sp?.name || filters.salespersonId}`,
      onRemove: () => onChange({ ...filters, salespersonId: undefined })
    });
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'All') {
    activeChips.push({
      label: `Payment: ${filters.paymentStatus}`,
      onRemove: () => onChange({ ...filters, paymentStatus: 'All' })
    });
  }

  if (filters.orderStatus && filters.orderStatus !== 'All') {
    activeChips.push({
      label: `Order Status: ${filters.orderStatus}`,
      onRemove: () => onChange({ ...filters, orderStatus: 'All' })
    });
  }

  if (filters.expiryStatus && filters.expiryStatus !== 'All') {
    activeChips.push({
      label: `Expiry: ${filters.expiryStatus}`,
      onRemove: () => onChange({ ...filters, expiryStatus: 'All' })
    });
  }

  const datePresetLabels: Record<DatePreset, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    this_month: 'This Month',
    prev_month: 'Previous Month',
    current_quarter: 'Current Quarter',
    prev_quarter: 'Previous Quarter',
    current_fy: 'Current Financial Year (FY26-27)',
    prev_fy: 'Previous Financial Year (FY25-26)',
    custom: 'Custom Date Range',
    all: 'All Time'
  };

  return (
    <div className="space-y-3 no-print">
      {/* Top Filter Bar Container */}
      <div className="erp-card bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Quick Filters (Desktop) */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Global Search Input on Desktop & Tablet */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 min-w-[210px] flex-1 max-w-xs focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search invoices, retailers, items..."
                value={filters.searchQuery || ''}
                onChange={(e) => onChange({ ...filters, searchQuery: e.target.value || undefined })}
                className="bg-transparent border-none outline-none text-xs text-slate-800 placeholder:text-slate-400 font-medium w-full"
              />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, searchQuery: undefined })}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Date Preset Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={filters.datePreset}
                onChange={(e) => onChange({ ...filters, datePreset: e.target.value as DatePreset })}
                className="bg-transparent border-none outline-none font-bold text-slate-800 cursor-pointer text-xs"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="prev_month">Previous Month</option>
                <option value="current_quarter">Current Quarter (Q2)</option>
                <option value="prev_quarter">Previous Quarter (Q1)</option>
                <option value="current_fy">Current FY (2026-27)</option>
                <option value="prev_fy">Previous FY (2025-26)</option>
                <option value="custom">Custom Range...</option>
                <option value="all">All Dates</option>
              </select>
            </div>

            {/* Custom Date Pickers (if custom selected) */}
            {filters.datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                <input
                  type="date"
                  value={filters.customStartDate || ''}
                  onChange={(e) => onChange({ ...filters, customStartDate: e.target.value })}
                  className="bg-transparent text-xs text-slate-700 outline-none"
                />
                <span className="text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={filters.customEndDate || ''}
                  onChange={(e) => onChange({ ...filters, customEndDate: e.target.value })}
                  className="bg-transparent text-xs text-slate-700 outline-none"
                />
              </div>
            )}

            {/* Payment Status Quick Toggle Pills (Desktop) */}
            <div className="hidden lg:flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
              {(['All', 'Unpaid', 'Paid'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onChange({ ...filters, paymentStatus: st })}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    (filters.paymentStatus || 'All') === st
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Company Selector (Desktop Quick Access) */}
            {userContext.role !== 'sales_co' && (
              <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filters.companyId || ''}
                  onChange={(e) => onChange({ ...filters, companyId: e.target.value || undefined, brand: undefined })}
                  className="bg-transparent border-none outline-none text-slate-800 cursor-pointer text-xs max-w-[150px] truncate"
                >
                  <option value="">All Companies</option>
                  {dbState.companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Selector (Desktop Quick Access) */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filters.category || ''}
                onChange={(e) => onChange({ ...filters, category: e.target.value || undefined, brand: undefined })}
                className="bg-transparent border-none outline-none text-slate-800 cursor-pointer text-xs max-w-[150px] truncate"
              >
                <option value="">All Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Retailer Selector (Desktop Quick Access) */}
            {userContext.role !== 'retailer' && (
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filters.retailerId || ''}
                  onChange={(e) => onChange({ ...filters, retailerId: e.target.value || undefined })}
                  className="bg-transparent border-none outline-none text-slate-800 cursor-pointer text-xs max-w-[150px] truncate"
                >
                  <option value="">All Retailers</option>
                  {dbState.retailers.map(r => (
                    <option key={r.id} value={r.id}>{r.shop_name} ({r.city || 'Indore'})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Salesperson Selector (Desktop Quick Access for Admin) */}
            {userContext.role === 'admin' && (
              <div className="hidden xl:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filters.salespersonId || ''}
                  onChange={(e) => onChange({ ...filters, salespersonId: e.target.value || undefined })}
                  className="bg-transparent border-none outline-none text-slate-800 cursor-pointer text-xs max-w-[150px] truncate font-medium"
                >
                  <option value="">All Sales Reps</option>
                  {dbState.profiles
                    .filter(p => p.role === 'sales_dist' || p.role === 'sales_co')
                    .map(sp => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name} ({sp.role === 'sales_dist' ? 'Dist' : 'Co'})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Mobile / All Filters Trigger Button */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>

            {/* Reset Filter Button */}
            {getActiveFilterCount() > 0 && (
              <button
                onClick={handleReset}
                title="Reset all filters"
                className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>

          {/* Right Action Tools (Toggle Charts, Export Menu) */}
          <div className="flex items-center gap-2">
            {onToggleCharts && (
              <button
                onClick={onToggleCharts}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition-all ${
                  showCharts 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {showCharts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{showCharts ? 'Hide Visuals' : 'Show Visuals'}</span>
              </button>
            )}

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {exportMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setExportMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in-50 zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        exportToCSV({
                          reportTitle,
                          filterSummary: activeChips.map(c => c.label),
                          columns: exportColumns,
                          data: exportData,
                          totalsRow: exportTotals
                        });
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Export CSV (.csv)</span>
                    </button>

                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        exportToExcel({
                          reportTitle,
                          filterSummary: activeChips.map(c => c.label),
                          columns: exportColumns,
                          data: exportData,
                          totalsRow: exportTotals
                        });
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>Export Excel (.xls)</span>
                    </button>

                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        handleCopy();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-indigo-500" />}
                      <span>{copied ? 'Copied to Clipboard!' : 'Copy Table Data'}</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={() => {
                        setExportMenuOpen(false);
                        printReport();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span>Print / PDF View</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Active Filters:</span>
          {activeChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold rounded-full shadow-2xs"
            >
              <span>{chip.label}</span>
              <button
                onClick={chip.onRemove}
                className="w-3.5 h-3.5 rounded-full hover:bg-indigo-200 flex items-center justify-center text-indigo-800 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button
            onClick={handleReset}
            className="text-xs text-red-600 font-bold hover:underline ml-1 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Mobile Drawer / Modal Filter Panel */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" 
            onClick={() => setMobileDrawerOpen(false)} 
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <Filter className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold tracking-wide">Filter Reports</h3>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body Scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Date Preset */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Date Range Period</label>
                <select
                  value={filters.datePreset}
                  onChange={(e) => onChange({ ...filters, datePreset: e.target.value as DatePreset })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 outline-none"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="prev_month">Previous Month</option>
                  <option value="current_quarter">Current Quarter (Q2)</option>
                  <option value="prev_quarter">Previous Quarter (Q1)</option>
                  <option value="current_fy">Current Financial Year (2026-27)</option>
                  <option value="prev_fy">Previous Financial Year (2025-26)</option>
                  <option value="custom">Custom Date Range</option>
                  <option value="all">All Dates</option>
                </select>
              </div>

              {/* Custom Date Pickers */}
              {filters.datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">From Date</label>
                    <input
                      type="date"
                      value={filters.customStartDate || ''}
                      onChange={(e) => onChange({ ...filters, customStartDate: e.target.value })}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs mt-1 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">To Date</label>
                    <input
                      type="date"
                      value={filters.customEndDate || ''}
                      onChange={(e) => onChange({ ...filters, customEndDate: e.target.value })}
                      className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs mt-1 text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Company Selector */}
              {userContext.role !== 'sales_co' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">FMCG Company</label>
                  <select
                    value={filters.companyId || ''}
                    onChange={(e) => onChange({ ...filters, companyId: e.target.value || undefined, brand: undefined })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                  >
                    <option value="">All Companies</option>
                    {dbState.companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Product Category</label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => onChange({ ...filters, category: e.target.value || undefined, brand: undefined })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Brand Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Brand</label>
                <select
                  value={filters.brand || ''}
                  onChange={(e) => onChange({ ...filters, brand: e.target.value || undefined })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                >
                  <option value="">All Brands</option>
                  {availableBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Retailer Selector */}
              {userContext.role !== 'retailer' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Retailer</label>
                  <select
                    value={filters.retailerId || ''}
                    onChange={(e) => onChange({ ...filters, retailerId: e.target.value || undefined })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                  >
                    <option value="">All Retailers</option>
                    {dbState.retailers.map(r => (
                      <option key={r.id} value={r.id}>{r.shop_name} ({r.city || 'Indore'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Salesperson Selector */}
              {userContext.role === 'admin' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Salesperson</label>
                  <select
                    value={filters.salespersonId || ''}
                    onChange={(e) => onChange({ ...filters, salespersonId: e.target.value || undefined })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                  >
                    <option value="">All Sales Reps</option>
                    {dbState.profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co').map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.name} ({sp.role === 'sales_dist' ? 'Dist' : 'Company'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Payment Status</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['All', 'Paid', 'Partial', 'Unpaid'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => onChange({ ...filters, paymentStatus: status })}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        (filters.paymentStatus || 'All') === status
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Order Status</label>
                <select
                  value={filters.orderStatus || 'All'}
                  onChange={(e) => onChange({ ...filters, orderStatus: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                >
                  <option value="All">All Order Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Packing">Packing</option>
                  <option value="Ready for Dispatch">Ready for Dispatch</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Expiry Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Stock Expiry Horizon</label>
                <select
                  value={filters.expiryStatus || 'All'}
                  onChange={(e) => onChange({ ...filters, expiryStatus: e.target.value as any })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 outline-none"
                >
                  <option value="All">All Inventory</option>
                  <option value="30d">Expiring within 30 Days</option>
                  <option value="60d">Expiring within 60 Days</option>
                  <option value="90d">Expiring within 90 Days</option>
                  <option value="expired">Expired Stock</option>
                </select>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
              <button
                onClick={() => {
                  handleReset();
                  setMobileDrawerOpen(false);
                }}
                className="flex-1 py-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Reset All
              </button>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
