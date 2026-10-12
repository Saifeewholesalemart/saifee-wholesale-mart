'use client';

import React, { useState, useMemo } from 'react';
import { 
  Package, Search, Filter, Download, Printer, ArrowUpDown, 
  ArrowUp, ArrowDown, TrendingUp, DollarSign, Store,
  Building2, Warehouse, Calendar, CheckCircle2, FileSpreadsheet,
  FileText, RotateCcw, X, ChevronRight, Eye, Layers, ShieldCheck,
  ChevronLeft, ArrowRight, ExternalLink, HelpCircle, Info, Truck,
  AlertTriangle, Check, ChevronDown, ShoppingCart, Tag, Percent,
  Boxes, RefreshCw
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, DatePreset,
  getItemReportByParty, ItemReportByPartyRow, ItemReportByPartySummary,
  PartyReportSalesTransaction, PartyReportPurchaseTransaction,
  formatQuantity, formatCurrency
} from '@/lib/reportsEngine';
import { exportToCSV, exportToExcel, printReport, ExportColumn } from '@/lib/exportUtils';

interface ItemReportByPartyViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts?: boolean;
}

type SortField = 'productName' | 'sku' | 'saleQty' | 'saleAmount' | 'purchaseQty' | 'purchaseAmount' | 'closingStock' | 'category';
type SortDirection = 'asc' | 'desc';

export default function ItemReportByPartyView({
  filters: parentFilters,
  dbState,
  userContext
}: ItemReportByPartyViewProps) {
  // Local filter states for real-time ERP filtering
  const [selectedDatePreset, setSelectedDatePreset] = useState<DatePreset>(parentFilters.datePreset || 'this_month');
  const [startDate, setStartDate] = useState(parentFilters.customStartDate || '2026-09-01');
  const [endDate, setEndDate] = useState(parentFilters.customEndDate || '2026-09-30');
  
  const [selectedCompany, setSelectedCompany] = useState(parentFilters.companyId || 'all');
  const [selectedGodown, setSelectedGodown] = useState(parentFilters.godown || 'all');
  const [selectedCategory, setSelectedCategory] = useState(parentFilters.category || 'all');
  const [selectedItem, setSelectedItem] = useState(parentFilters.productId || 'all');
  const [selectedParty, setSelectedParty] = useState(parentFilters.retailerId || (parentFilters as any).partyId || 'all');
  const [selectedSalesperson, setSelectedSalesperson] = useState(parentFilters.salespersonId || 'all');
  const [selectedChannel, setSelectedChannel] = useState(parentFilters.channel || 'all');
  const [searchQuery, setSearchQuery] = useState(parentFilters.searchQuery || '');

  // Party selector dropdown / search state
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partySearchText, setPartySearchText] = useState('');

  // Item selector dropdown / search state
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [itemSearchText, setItemSearchText] = useState('');

  // Sorting state (Default: Product Name A-Z)
  const [sortField, setSortField] = useState<SortField>('productName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Drill-down Modal state (Product Detail)
  const [drilldownItem, setDrilldownItem] = useState<ItemReportByPartyRow | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<'overview' | 'parties' | 'purchases' | 'godowns' | 'movements'>('overview');

  // Merged Filter Object
  const mergedFilters: ReportFilterState = useMemo(() => ({
    ...parentFilters,
    datePreset: selectedDatePreset,
    customStartDate: selectedDatePreset === 'custom' ? startDate : undefined,
    customEndDate: selectedDatePreset === 'custom' ? endDate : undefined,
    companyId: selectedCompany !== 'all' ? selectedCompany : undefined,
    godown: selectedGodown !== 'all' ? selectedGodown : undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    productId: selectedItem !== 'all' ? selectedItem : undefined,
    retailerId: selectedParty !== 'all' ? selectedParty : undefined,
    salespersonId: selectedSalesperson !== 'all' ? selectedSalesperson : undefined,
    channel: selectedChannel !== 'all' ? selectedChannel : undefined,
    searchQuery: searchQuery
  }), [
    parentFilters, selectedDatePreset, startDate, endDate,
    selectedCompany, selectedGodown, selectedCategory, selectedItem,
    selectedParty, selectedSalesperson, selectedChannel, searchQuery
  ]);

  // Execute report calculation via engine
  const { rows, summary } = useMemo(() => {
    return getItemReportByParty(mergedFilters, dbState, userContext);
  }, [mergedFilters, dbState, userContext]);

  // Handle Sort
  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'productName':
          comparison = a.productName.localeCompare(b.productName);
          break;
        case 'sku':
          comparison = (a.sku || '').localeCompare(b.sku || '');
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'saleQty':
          comparison = a.totalSaleQtyPieces - b.totalSaleQtyPieces;
          break;
        case 'saleAmount':
          comparison = a.saleAmount - b.saleAmount;
          break;
        case 'purchaseQty':
          comparison = a.totalPurchaseQtyPieces - b.totalPurchaseQtyPieces;
          break;
        case 'purchaseAmount':
          comparison = a.purchaseAmount - b.purchaseAmount;
          break;
        case 'closingStock':
          comparison = a.totalClosingPhysicalPieces - b.totalClosingPhysicalPieces;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [rows, sortField, sortDirection]);

  // Total pages
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    if (pageSize >= 9999) return sortedRows;
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Handle column header sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'productName' || field === 'sku' || field === 'category' ? 'asc' : 'desc');
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedDatePreset('this_month');
    setSelectedCompany('all');
    setSelectedGodown('all');
    setSelectedCategory('all');
    setSelectedItem('all');
    setSelectedParty('all');
    setSelectedSalesperson('all');
    setSelectedChannel('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Check active filter count
  const activeFiltersCount = [
    selectedCompany !== 'all',
    selectedGodown !== 'all',
    selectedCategory !== 'all',
    selectedItem !== 'all',
    selectedParty !== 'all',
    selectedSalesperson !== 'all',
    selectedChannel !== 'all',
    Boolean(searchQuery.trim())
  ].filter(Boolean).length;

  // Filtered party list for Party Search Dropdown
  const filteredParties = useMemo(() => {
    const q = partySearchText.toLowerCase().trim();
    const all = [
      ...(dbState.retailers || []).map(r => ({ id: r.id, name: r.shop_name, code: r.retailer_code, city: r.city || '', type: 'Retailer' as const })),
      ...(dbState.suppliers || []).map(s => ({ id: s.id, name: s.name, code: '', city: '', type: 'Supplier' as const }))
    ];
    if (!q) return all.slice(0, 40);
    return all.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q))
    ).slice(0, 40);
  }, [dbState.retailers, dbState.suppliers, partySearchText]);

  // Filtered product list for Item Search Dropdown
  const filteredProducts = useMemo(() => {
    const q = itemSearchText.toLowerCase().trim();
    const all = dbState.products || [];
    if (!q) return all.slice(0, 40);
    return all.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.product_code && p.product_code.toLowerCase().includes(q))
    ).slice(0, 40);
  }, [dbState.products, itemSearchText]);

  // Export Columns definition
  const exportColumns: ExportColumn<ItemReportByPartyRow>[] = [
    { header: '#', key: 'srNo' },
    { header: 'Product Name', key: 'productName' },
    { header: 'Brand', key: 'brand' },
    { header: 'Category', key: 'category' },
    { header: 'SKU / Code', key: 'sku' },
    { header: 'Pack Size', key: 'packSize' },
    { header: 'Trading Unit', key: 'tradingUnit' },
    { header: 'MRP', key: 'mrp', format: 'currency' },
    { header: 'Sale Qty', key: 'saleQtyDisplay' },
    { header: 'Gross Sales', key: 'grossSaleAmount', format: 'currency' },
    { header: 'Sale Discount', key: 'saleDiscount', format: 'currency' },
    { header: 'Sale GST', key: 'saleGst', format: 'currency' },
    { header: 'Sales Return', key: 'saleReturnAmount', format: 'currency' },
    { header: 'Net Sale Amount', key: 'saleAmount', format: 'currency' },
    { header: 'Purchase Qty', key: 'purchaseQtyDisplay' },
    { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' },
    { header: 'Closing Stock', key: 'closingInventoryDisplay' }
  ];

  // Handle Export actions
  const handleExportCSV = () => {
    const filterSummaryParts: string[] = [];
    filterSummaryParts.push(`Period: ${selectedDatePreset.replace('_', ' ').toUpperCase()}`);
    if (selectedCompany !== 'all') filterSummaryParts.push(`Company: ${selectedCompany}`);
    if (selectedGodown !== 'all') filterSummaryParts.push(`Godown: ${selectedGodown}`);
    if (selectedCategory !== 'all') filterSummaryParts.push(`Category: ${selectedCategory}`);

    exportToCSV({
      reportTitle: 'ITEM REPORT BY PARTY (Product-wise Sales & Stock Summary)',
      companyName: 'SAIFEE GENERAL STORES',
      filterSummary: filterSummaryParts,
      columns: exportColumns,
      data: sortedRows,
      totalsRow: {
        srNo: 'TOTAL',
        productName: `${summary.recordCount} Products`,
        saleAmount: summary.totalSaleAmount,
        grossSaleAmount: summary.totalGrossSaleAmount,
        saleDiscount: summary.totalSaleDiscount,
        saleGst: summary.totalSaleGst,
        saleReturnAmount: summary.totalSaleReturnAmount,
        purchaseAmount: summary.totalPurchaseAmount,
        closingInventoryDisplay: summary.totalClosingDisplay
      }
    });
  };

  const handleExportExcel = () => {
    const filterSummaryParts: string[] = [];
    filterSummaryParts.push(`Period: ${selectedDatePreset.replace('_', ' ').toUpperCase()}`);
    if (selectedCompany !== 'all') filterSummaryParts.push(`Company: ${selectedCompany}`);

    exportToExcel({
      reportTitle: 'Item Report by Party',
      companyName: 'SAIFEE GENERAL STORES',
      filterSummary: filterSummaryParts,
      columns: exportColumns,
      data: sortedRows,
      totalsRow: {
        srNo: 'TOTAL',
        productName: `${summary.recordCount} Products`,
        saleAmount: summary.totalSaleAmount,
        grossSaleAmount: summary.totalGrossSaleAmount,
        saleDiscount: summary.totalSaleDiscount,
        saleGst: summary.totalSaleGst,
        saleReturnAmount: summary.totalSaleReturnAmount,
        purchaseAmount: summary.totalPurchaseAmount,
        closingInventoryDisplay: summary.totalClosingDisplay
      }
    });
  };

  const handlePrint = () => {
    printReport();
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & EXPORT TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Item Report by Party
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 tracking-wide">
                  Stock & Sales
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Product-wise Sales, Purchases & Closing Physical Godown Stock with Party Breakdown
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. ERP MULTI-FILTER PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 no-print">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              ERP Multi-Filter Controls
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                {activeFiltersCount} Active
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Showing {summary.recordCount} products
          </span>
        </div>

        {/* Row 1: Date & Primary Entity Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Date Preset */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Date Period
            </label>
            <select
              value={selectedDatePreset}
              onChange={(e) => setSelectedDatePreset(e.target.value as DatePreset)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month (Default)</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_financial_year">This Financial Year</option>
              <option value="all_time">All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Range if active */}
          {selectedDatePreset === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {/* 2. Company Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Company / Brand Owner
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Companies</option>
              {(dbState.companies || []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Godown Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Godown Location
            </label>
            <select
              value={selectedGodown}
              onChange={(e) => setSelectedGodown(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Godowns</option>
              <option value="Main Godown">Main Godown</option>
              <option value="Secondary Godown">Secondary Godown</option>
              <option value="Wholesale Yard">Wholesale Yard</option>
            </select>
          </div>

          {/* 4. Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {(dbState.categories || []).map((cat: any) => (
                <option key={cat.id || cat.name} value={cat.name || cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Product Filter, Party Filter, Salesperson, Channel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* 5. Product/Item Quick Filter */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filter by Product / Item
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setItemDropdownOpen(!itemDropdownOpen); setPartyDropdownOpen(false); }}
                className="w-full text-left text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 flex items-center justify-between hover:bg-slate-100/70"
              >
                <span className="truncate">
                  {selectedItem === 'all' 
                    ? 'All Products' 
                    : (dbState.products.find(p => p.id === selectedItem)?.name || selectedItem)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {itemDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl shadow-xl border border-slate-200 p-2 max-h-64 flex flex-col">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search product name or code..."
                      value={itemSearchText}
                      onChange={(e) => setItemSearchText(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                    <div
                      onClick={() => { setSelectedItem('all'); setItemDropdownOpen(false); }}
                      className={`p-2 hover:bg-indigo-50 cursor-pointer rounded-lg font-bold ${selectedItem === 'all' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
                    >
                      All Products
                    </div>
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedItem(p.id); setItemDropdownOpen(false); }}
                        className={`p-2 hover:bg-indigo-50 cursor-pointer rounded-lg flex items-center justify-between ${selectedItem === p.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.brand} &bull; {p.pack_size || p.packing_display}</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">₹{p.mrp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. Retailer / Party Filter */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filter by Party / Retailer
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setPartyDropdownOpen(!partyDropdownOpen); setItemDropdownOpen(false); }}
                className="w-full text-left text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 flex items-center justify-between hover:bg-slate-100/70"
              >
                <span className="truncate">
                  {selectedParty === 'all' 
                    ? 'All Parties' 
                    : (dbState.retailers.find(r => r.id === selectedParty)?.shop_name || 
                       dbState.suppliers?.find(s => s.id === selectedParty)?.name || selectedParty)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {partyDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white rounded-xl shadow-xl border border-slate-200 p-2 max-h-64 flex flex-col">
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search retailer or supplier..."
                      value={partySearchText}
                      onChange={(e) => setPartySearchText(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                    <div
                      onClick={() => { setSelectedParty('all'); setPartyDropdownOpen(false); }}
                      className={`p-2 hover:bg-indigo-50 cursor-pointer rounded-lg font-bold ${selectedParty === 'all' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
                    >
                      All Parties (Retailers & Suppliers)
                    </div>
                    {filteredParties.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedParty(p.id); setPartyDropdownOpen(false); }}
                        className={`p-2 hover:bg-indigo-50 cursor-pointer rounded-lg flex items-center justify-between ${selectedParty === p.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.type} &bull; {p.city || p.code || 'Local'}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600 font-bold shrink-0">{p.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7. Salesperson Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Salesperson
            </label>
            <select
              value={selectedSalesperson}
              onChange={(e) => setSelectedSalesperson(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Salespersons</option>
              {(dbState.profiles || [])
                .filter(p => p.role === 'sales_dist' || p.role === 'sales_co' || p.role === 'admin' || p.role === 'staff')
                .map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name || sp.email}</option>
                ))}
            </select>
          </div>

          {/* 8. Order Channel Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Channel
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Channels</option>
              <option value="Distributor Salesperson">Distributor Salesperson</option>
              <option value="Retailer Direct">Retailer Direct</option>
              <option value="Company Salesperson">Company Salesperson</option>
              <option value="On Counter Sale">On Counter Sale</option>
            </select>
          </div>
        </div>

        {/* Multi-field search box */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU, brand, category, invoice number, party name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Card 1: Items Count */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Items</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {summary.recordCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Unique SKUs</span>
        </div>

        {/* Card 2: Total Sale Quantity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sale Qty</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 font-mono">
            {formatQuantity(summary.totalSaleQtyBase, summary.totalSaleQtyLoose)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Cartons + Loose</span>
        </div>

        {/* Card 3: Total Net Sales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 font-mono">
            {formatCurrency(summary.totalSaleAmount)}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">Post Return & Disc</span>
        </div>

        {/* Card 4: Total Purchase Qty */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Purchase Qty</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-700 font-mono">
            {formatQuantity(summary.totalPurchaseQtyBase, summary.totalPurchaseQtyLoose)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Inward Stock Qty</span>
        </div>

        {/* Card 5: Total Purchase Amount */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Purchase Cost</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-700 font-mono">
            {formatCurrency(summary.totalPurchaseAmount)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Total Inward Cost</span>
        </div>

        {/* Card 6: Closing Physical Inventory */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Closing Stock</span>
            <Warehouse className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-base font-black text-purple-900 font-mono truncate" title={summary.totalClosingDisplay}>
            {summary.totalClosingDisplay}
          </div>
          <span className="text-[10px] text-purple-600 font-bold">Physical Godown Stock</span>
        </div>
      </div>

      {/* 4. MAIN PRODUCT DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Product-Wise Summary Table
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {sortedRows.length} Items
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-medium hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>All</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-100/80 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-200 select-none">
              <tr>
                <th className="p-3 text-center w-12">#</th>
                
                {/* Product Name */}
                <th 
                  onClick={() => handleSort('productName')}
                  className="p-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ITEM NAME / SKU</span>
                    {sortField === 'productName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Category & Brand */}
                <th 
                  onClick={() => handleSort('category')}
                  className="p-3 cursor-pointer hover:bg-slate-200/70 transition-colors hidden md:table-cell"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CATEGORY / BRAND</span>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Sale Quantity */}
                <th 
                  onClick={() => handleSort('saleQty')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>SALE QTY</span>
                    {sortField === 'saleQty' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Sale Amount */}
                <th 
                  onClick={() => handleSort('saleAmount')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>NET SALES</span>
                    {sortField === 'saleAmount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Purchase Quantity */}
                <th 
                  onClick={() => handleSort('purchaseQty')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors hidden sm:table-cell"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>PURCHASE QTY</span>
                    {sortField === 'purchaseQty' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Purchase Amount */}
                <th 
                  onClick={() => handleSort('purchaseAmount')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors hidden sm:table-cell"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>PURCHASE AMT</span>
                    {sortField === 'purchaseAmount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Closing Stock */}
                <th 
                  onClick={() => handleSort('closingStock')}
                  className="p-3 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>CLOSING STOCK</span>
                    {sortField === 'closingStock' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="p-3 text-center w-16 no-print">ACTION</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-bold">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                    No products found matching the current filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr 
                      key={row.id} 
                      className={`transition-colors hover:bg-indigo-50/50 cursor-pointer ${isEven ? 'bg-white' : 'bg-slate-50/40'}`}
                      onClick={() => { setDrilldownItem(row); setDrilldownTab('overview'); }}
                    >
                      {/* 1. Serial # */}
                      <td className="p-3 text-center font-bold text-slate-400">
                        {rowNumber}
                      </td>

                      {/* 2. Product Name & Specs */}
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 leading-snug">
                            {row.productName}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            {row.sku && <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">SKU: {row.sku}</span>}
                            <span>{row.packSize}</span>
                            {row.mrp > 0 && <span className="font-bold text-emerald-700">MRP: ₹{row.mrp}</span>}
                          </div>
                        </div>
                      </td>

                      {/* 3. Category & Brand */}
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{row.category || 'General'}</span>
                          <span className="text-[11px] text-slate-400">{row.brand || 'Unbranded'}</span>
                        </div>
                      </td>

                      {/* 4. Sale Quantity */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {row.saleQtyDisplay}
                      </td>

                      {/* 5. Net Sales Amount */}
                      <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                        {row.saleAmount > 0 ? formatCurrency(row.saleAmount) : '₹ 0.00'}
                      </td>

                      {/* 6. Purchase Quantity */}
                      <td className="p-3 text-right font-mono font-bold text-slate-700 hidden sm:table-cell">
                        {row.purchaseQtyDisplay}
                      </td>

                      {/* 7. Purchase Amount */}
                      <td className="p-3 text-right font-bold text-blue-700 font-mono hidden sm:table-cell">
                        {row.purchaseAmount > 0 ? formatCurrency(row.purchaseAmount) : '₹ 0.00'}
                      </td>

                      {/* 8. Closing Physical Godown Stock */}
                      <td className="p-3 text-right font-bold text-purple-900 font-mono">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
                          {row.closingInventoryDisplay}
                        </span>
                      </td>

                      {/* 9. Action Drilldown */}
                      <td className="p-3 text-center no-print" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setDrilldownItem(row); setDrilldownTab('overview'); }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 transition-colors"
                          title="View Product Breakdown & Movements"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Table Footer */}
            <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white font-black border-t-2 border-slate-700 shadow-xl text-[11px]">
              <tr>
                <td className="p-3 text-center text-indigo-300 font-black">Σ</td>
                <td className="p-3 tracking-wide text-white" colSpan={2}>
                  TOTAL ({summary.recordCount} Products)
                </td>
                <td className="p-3 text-right font-mono text-amber-300">
                  {formatQuantity(summary.totalSaleQtyBase, summary.totalSaleQtyLoose)}
                </td>
                <td className="p-3 text-right font-mono text-emerald-300">
                  {formatCurrency(summary.totalSaleAmount)}
                </td>
                <td className="p-3 text-right font-mono text-amber-300 hidden sm:table-cell">
                  {formatQuantity(summary.totalPurchaseQtyBase, summary.totalPurchaseQtyLoose)}
                </td>
                <td className="p-3 text-right font-mono text-blue-300 hidden sm:table-cell">
                  {formatCurrency(summary.totalPurchaseAmount)}
                </td>
                <td className="p-3 text-right font-mono text-purple-300 truncate">
                  {summary.totalClosingDisplay}
                </td>
                <td className="p-3 no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Controls */}
        {pageSize < 9999 && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs no-print">
            <span className="text-slate-500 font-medium">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} items
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. PRODUCT DRILL-DOWN MODAL */}
      {drilldownItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs no-print animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                    <span>{drilldownItem.productName}</span>
                    {drilldownItem.sku && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {drilldownItem.sku}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {drilldownItem.brand || 'Brand'} &bull; {drilldownItem.category || 'Category'} &bull; {drilldownItem.packSize}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDrilldownItem(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tab Nav */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-slate-50 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setDrilldownTab('overview')}
                className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  drilldownTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Overview & Stock</span>
              </button>

              <button
                onClick={() => setDrilldownTab('parties')}
                className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  drilldownTab === 'parties'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Retailer Sales ({drilldownItem.partySalesBreakdown.length})</span>
              </button>

              <button
                onClick={() => setDrilldownTab('purchases')}
                className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  drilldownTab === 'purchases'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Supplier Purchases ({drilldownItem.partyPurchaseBreakdown.length})</span>
              </button>

              <button
                onClick={() => setDrilldownTab('godowns')}
                className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  drilldownTab === 'godowns'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Godown Stock ({drilldownItem.godownStockBreakdown.length})</span>
              </button>

              <button
                onClick={() => setDrilldownTab('movements')}
                className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  drilldownTab === 'movements'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Stock Movements ({drilldownItem.stockMovements.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: OVERVIEW & STOCK LEVELS */}
              {drilldownTab === 'overview' && (
                <div className="space-y-6">
                  {/* Master Specs Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">MRP</span>
                      <span className="font-extrabold text-slate-900">₹{drilldownItem.mrp || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Selling Rate</span>
                      <span className="font-extrabold text-emerald-700">₹{drilldownItem.sellingPrice || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Purchase Cost</span>
                      <span className="font-extrabold text-blue-700">₹{drilldownItem.purchasePrice || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">GST Rate / HSN</span>
                      <span className="font-extrabold text-slate-900">{(drilldownItem.gstPercent !== undefined && drilldownItem.gstPercent !== null) ? drilldownItem.gstPercent : 0}% &bull; {drilldownItem.hsn || 'HSN-N/A'}</span>
                    </div>
                  </div>

                  {/* Stock Levels Breakdown */}
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
                      Physical Godown Stock Status
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-purple-700 uppercase block">Total Physical Stock</span>
                        <span className="text-lg font-black text-purple-950 font-mono">{drilldownItem.physicalStockDisplay}</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Available for Sale</span>
                        <span className="text-lg font-black text-emerald-950 font-mono">{drilldownItem.availableStockDisplay}</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">Reserved Orders</span>
                        <span className="text-lg font-black text-amber-950 font-mono">{drilldownItem.reservedStockDisplay}</span>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                        <span className="text-[10px] font-bold text-red-700 uppercase block">Damaged / Expired</span>
                        <span className="text-lg font-black text-red-950 font-mono">{drilldownItem.damagedStockPieces + drilldownItem.expiredStockPieces} Pieces</span>
                      </div>
                    </div>
                  </div>

                  {/* Period Activity Summary */}
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
                      Period Performance ({selectedDatePreset.replace('_', ' ').toUpperCase()})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Sales</span>
                        <span className="text-base font-black text-emerald-700 font-mono">{formatCurrency(drilldownItem.saleAmount)}</span>
                        <span className="text-[10px] text-slate-500 font-semibold block">{drilldownItem.saleQtyDisplay}</span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Purchases</span>
                        <span className="text-base font-black text-blue-700 font-mono">{formatCurrency(drilldownItem.purchaseAmount)}</span>
                        <span className="text-[10px] text-slate-500 font-semibold block">{drilldownItem.purchaseQtyDisplay}</span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sales Return Deducted</span>
                        <span className="text-base font-black text-red-600 font-mono">{formatCurrency(drilldownItem.saleReturnAmount)}</span>
                        <span className="text-[10px] text-slate-500 font-semibold block">Deducted from Gross</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PARTY SALES BREAKDOWN */}
              {drilldownTab === 'parties' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Retailers who bought this product
                    </h4>
                    <span className="text-xs font-bold text-slate-500">{drilldownItem.partySalesBreakdown.length} Retailers</span>
                  </div>

                  {drilldownItem.partySalesBreakdown.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold">
                      No retailer sales for this item in selected date range.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">Retailer / Party</th>
                            <th className="p-3 text-center">Invoices</th>
                            <th className="p-3 text-right">Quantity Sold</th>
                            <th className="p-3 text-right">Total Net Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {drilldownItem.partySalesBreakdown.map((party, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{party.partyName}</td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-600">{party.invoiceCount}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800">{party.saleQtyDisplay}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(party.saleAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SUPPLIER PURCHASES BREAKDOWN */}
              {drilldownTab === 'purchases' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Suppliers who supplied this product
                    </h4>
                    <span className="text-xs font-bold text-slate-500">{drilldownItem.partyPurchaseBreakdown.length} Suppliers</span>
                  </div>

                  {drilldownItem.partyPurchaseBreakdown.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold">
                      No supplier purchases recorded for this item in selected period.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">Supplier Name</th>
                            <th className="p-3 text-center">Bills</th>
                            <th className="p-3 text-right">Quantity Inward</th>
                            <th className="p-3 text-right">Total Inward Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {drilldownItem.partyPurchaseBreakdown.map((sup, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{sup.partyName}</td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-600">{sup.billCount}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800">{sup.purchaseQtyDisplay}</td>
                              <td className="p-3 text-right font-mono font-bold text-blue-700">{formatCurrency(sup.purchaseAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: GODOWN STOCK BREAKDOWN */}
              {drilldownTab === 'godowns' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Location-Wise Godown Inventory
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Godown Location</th>
                          <th className="p-3 text-right">Physical Stock</th>
                          <th className="p-3 text-right">Reserved</th>
                          <th className="p-3 text-right">Available</th>
                          <th className="p-3 text-right">Damaged</th>
                          <th className="p-3 text-right">Expired</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {drilldownItem.godownStockBreakdown.map((gdn, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{gdn.godownName}</td>
                            <td className="p-3 text-right font-mono font-bold text-purple-900">{gdn.physical}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-700">{gdn.reserved}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-700">{gdn.available}</td>
                            <td className="p-3 text-right font-mono font-bold text-red-600">{gdn.damaged}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-700">{gdn.expired}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: STOCK MOVEMENTS / LEDGER */}
              {drilldownTab === 'movements' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Stock Ledger Movements
                    </h4>
                    <span className="text-xs font-bold text-slate-500">{drilldownItem.stockMovements.length} Entries</span>
                  </div>

                  {drilldownItem.stockMovements.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold">
                      No stock movement ledger records found for this item.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Reference #</th>
                            <th className="p-3 text-right">Change Qty</th>
                            <th className="p-3 text-right">Direction</th>
                            <th className="p-3">Godown</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {drilldownItem.stockMovements.map((entry, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 font-mono text-slate-600">{entry.created_at?.slice(0, 10) || 'N/A'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  entry.reason === 'Purchase'
                                    ? 'bg-blue-100 text-blue-800'
                                    : entry.reason === 'Sale'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {entry.reason}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-800 font-semibold">{entry.reference_id || 'Ref-N/A'}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">
                                {entry.change_qty > 0 ? `+${entry.change_qty}` : `${entry.change_qty}`}
                              </td>
                              <td className="p-3 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  entry.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {entry.direction}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">{entry.godown_id || 'Main Godown'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Showing deep audit for <span className="font-bold text-slate-800">{drilldownItem.productName}</span>
              </span>
              <button
                onClick={() => setDrilldownItem(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
