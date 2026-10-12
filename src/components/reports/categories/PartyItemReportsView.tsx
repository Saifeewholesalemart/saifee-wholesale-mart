'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, Search, Filter, Download, Printer, ArrowUpDown, 
  ArrowUp, ArrowDown, TrendingUp, DollarSign, Store,
  Package, Building2, Warehouse, Calendar, CheckCircle2, FileSpreadsheet,
  FileText, RotateCcw, X, ChevronRight, Eye, Layers, ShieldCheck,
  ChevronLeft, ArrowRight, ExternalLink, HelpCircle, Info, Truck,
  AlertTriangle, Check, ChevronDown, ShoppingCart, Tag, Percent
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, DatePreset,
  getPartyItemReport, PartyReportPartyRow, PartyItemReportSummary,
  PartyReportSalesTransaction, PartyReportPurchaseTransaction,
  formatQuantity, formatCurrency
} from '@/lib/reportsEngine';
import { exportToCSV, exportToExcel, printReport, ExportColumn } from '@/lib/exportUtils';

interface PartyItemReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts?: boolean;
}

type SortField = 'partyName' | 'saleQty' | 'saleAmount' | 'purchaseQty' | 'purchaseAmount' | 'city';
type SortDirection = 'asc' | 'desc';

export default function PartyItemReportsView({
  filters: parentFilters,
  dbState,
  userContext
}: PartyItemReportsViewProps) {
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

  // Party selector dropdown / search modal state
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partySearchText, setPartySearchText] = useState('');

  // Item selector dropdown / search state
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [itemSearchText, setItemSearchText] = useState('');

  // Sorting state (Default: Retailer / Party Name A-Z)
  const [sortField, setSortField] = useState<SortField>('partyName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Drill-down Modal state (Retailer Detail)
  const [drilldownParty, setDrilldownParty] = useState<PartyReportPartyRow | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<'overview' | 'sales' | 'purchases' | 'products'>('overview');

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
    return getPartyItemReport(mergedFilters, dbState, userContext);
  }, [mergedFilters, dbState, userContext]);

  // Handle Sort
  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'partyName':
          comparison = a.partyName.localeCompare(b.partyName);
          break;
        case 'city':
          comparison = (a.city || '').localeCompare(b.city || '');
          break;
        case 'saleQty':
          comparison = a.saleQty - b.saleQty;
          break;
        case 'saleAmount':
          comparison = a.saleAmount - b.saleAmount;
          break;
        case 'purchaseQty':
          comparison = a.purchaseQty - b.purchaseQty;
          break;
        case 'purchaseAmount':
          comparison = a.purchaseAmount - b.purchaseAmount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list.map((item, idx) => ({ ...item, srNo: idx + 1 }));
  }, [rows, sortField, sortDirection]);

  // Paginated Rows
  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return sortedRows;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Reset page when filters or total records change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [mergedFilters, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedDatePreset('this_month');
    setStartDate('2026-09-01');
    setEndDate('2026-09-30');
    setSelectedCompany('all');
    setSelectedGodown('all');
    setSelectedCategory('all');
    setSelectedItem('all');
    setSelectedParty('all');
    setSelectedSalesperson('all');
    setSelectedChannel('all');
    setSearchQuery('');
    setSortField('partyName');
    setSortDirection('asc');
    setPartySearchText('');
    setItemSearchText('');
  };

  // Available categories list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    (dbState.categories || []).forEach(c => cats.add(c.name));
    dbState.products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [dbState.categories, dbState.products]);

  // Available products list (filtered by selected category/company if any)
  const availableProducts = useMemo(() => {
    return dbState.products.filter(p => {
      if (selectedCompany !== 'all' && p.company_id && p.company_id !== selectedCompany) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      return true;
    });
  }, [dbState.products, selectedCompany, selectedCategory]);

  // Filtered products for item dropdown search
  const filteredProductOptions = useMemo(() => {
    if (!itemSearchText.trim()) return availableProducts;
    const q = itemSearchText.toLowerCase();
    return availableProducts.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.pack_size && p.pack_size.toLowerCase().includes(q))
    );
  }, [availableProducts, itemSearchText]);

  // Available godowns list
  const availableGodowns = useMemo(() => {
    const gList = dbState.godowns || [];
    return gList.length > 0 ? gList : [
      { id: 'gdn-saifee-main', name: 'Main Godown', code: 'GD01' },
      { id: 'gdn-saifee-secondary', name: 'Secondary Godown', code: 'GD02' }
    ];
  }, [dbState.godowns]);

  // Available Parties list (RETAILERS + SUPPLIERS)
  const availableParties = useMemo(() => {
    const list: {
      id: string;
      name: string;
      owner?: string;
      code?: string;
      city?: string;
      type: 'Retailer' | 'Supplier';
    }[] = [];

    (dbState.retailers || []).forEach(r => {
      list.push({
        id: r.id,
        name: r.shop_name,
        owner: r.owner_name,
        code: r.retailer_code,
        city: r.city,
        type: 'Retailer'
      });
    });

    (dbState.suppliers || []).forEach(s => {
      if (!list.some(item => item.id === s.id)) {
        list.push({
          id: s.id,
          name: s.name,
          owner: '',
          code: 'SUPPLIER',
          city: '',
          type: 'Supplier'
        });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [dbState.retailers, dbState.suppliers]);

  // Filtered parties for party dropdown search
  const filteredPartyOptions = useMemo(() => {
    if (!partySearchText.trim()) return availableParties;
    const q = partySearchText.toLowerCase();
    return availableParties.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.owner && p.owner.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q))
    );
  }, [availableParties, partySearchText]);

  // Available Salespersons list
  const availableSalespersons = useMemo(() => {
    return dbState.profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co');
  }, [dbState.profiles]);

  // Order Channels (Strictly 4 Allowed Channels)
  const orderChannels = [
    'Retailer Direct',
    'Distributor Salesperson',
    'Company Salesperson',
    'On Counter Sale'
  ];

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedDatePreset !== 'this_month') count++;
    if (selectedCompany !== 'all') count++;
    if (selectedGodown !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedItem !== 'all') count++;
    if (selectedParty !== 'all') count++;
    if (selectedSalesperson !== 'all') count++;
    if (selectedChannel !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    selectedDatePreset, selectedCompany, selectedGodown, selectedCategory,
    selectedItem, selectedParty, selectedSalesperson, selectedChannel, searchQuery
  ]);

  // Selected item object for highlight banner
  const selectedProductObj = useMemo(() => {
    if (selectedItem === 'all') return null;
    return dbState.products.find(p => p.id === selectedItem) || null;
  }, [selectedItem, dbState.products]);

  // Selected party object for header badge
  const selectedPartyObj = useMemo(() => {
    if (selectedParty === 'all') return null;
    return availableParties.find(p => p.id === selectedParty) || null;
  }, [selectedParty, availableParties]);

  // Export handlers
  const handleExportCSV = () => {
    const isItemFiltered = selectedItem !== 'all';
    const columns: ExportColumn<PartyReportPartyRow>[] = isItemFiltered ? [
      { header: '#', key: 'srNo' },
      { header: 'Retailer / Party', key: 'partyName' },
      { header: 'City', key: 'city' },
      { header: 'Quantity Sold', key: 'saleQty', format: 'number' },
      { header: 'Avg Billing Rate', key: 'avgBillingRate', format: 'currency' },
      { header: 'Sales Amount', key: 'saleAmount', format: 'currency' },
      { header: 'Quantity Purchased', key: 'purchaseQty', format: 'number' },
      { header: 'Avg Purchase Rate', key: 'avgPurchaseRate', format: 'currency' },
      { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' }
    ] : [
      { header: '#', key: 'srNo' },
      { header: 'Retailer / Party', key: 'partyName' },
      { header: 'Retailer Code', key: 'retailerCode' },
      { header: 'City', key: 'city' },
      { header: 'Sale Quantity', key: 'saleQty', format: 'number' },
      { header: 'Sale Amount', key: 'saleAmount', format: 'currency' },
      { header: 'Purchase Quantity', key: 'purchaseQty', format: 'number' },
      { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' }
    ];

    const filterSummaryParts: string[] = [];
    filterSummaryParts.push(`Period: ${selectedDatePreset.replace('_', ' ').toUpperCase()}`);
    if (selectedCompany !== 'all') {
      const c = dbState.companies.find(comp => comp.id === selectedCompany);
      filterSummaryParts.push(`Company: ${c?.name || selectedCompany}`);
    }
    if (selectedGodown !== 'all') filterSummaryParts.push(`Godown: ${selectedGodown}`);
    if (selectedCategory !== 'all') filterSummaryParts.push(`Category: ${selectedCategory}`);
    if (selectedItem !== 'all') {
      const p = dbState.products.find(prod => prod.id === selectedItem);
      filterSummaryParts.push(`Product: ${p?.name || selectedItem}`);
    }
    if (selectedParty !== 'all') {
      const party = availableParties.find(pa => pa.id === selectedParty);
      filterSummaryParts.push(`Party: ${party?.name || selectedParty}`);
    }
    if (selectedSalesperson !== 'all') {
      const sp = dbState.profiles.find(prof => prof.id === selectedSalesperson);
      filterSummaryParts.push(`Salesperson: ${sp?.name || selectedSalesperson}`);
    }
    if (selectedChannel !== 'all') filterSummaryParts.push(`Channel: ${selectedChannel}`);
    if (searchQuery) filterSummaryParts.push(`Search: "${searchQuery}"`);

    exportToCSV({
      reportTitle: 'PARTY REPORT BY ITEM (Retailer-wise Sales & Purchase Summary)',
      companyName: 'SAIFEE GENERAL STORES',
      filterSummary: filterSummaryParts,
      columns,
      data: sortedRows,
      totalsRow: {
        srNo: 'TOTAL',
        partyName: `${summary.recordCount} Parties`,
        saleQty: summary.totalSaleQty,
        saleAmount: summary.totalSaleAmount,
        purchaseQty: summary.totalPurchaseQty,
        purchaseAmount: summary.totalPurchaseAmount
      }
    });
  };

  const handleExportExcel = () => {
    const isItemFiltered = selectedItem !== 'all';
    const columns: ExportColumn<PartyReportPartyRow>[] = isItemFiltered ? [
      { header: '#', key: 'srNo' },
      { header: 'Retailer / Party', key: 'partyName' },
      { header: 'City', key: 'city' },
      { header: 'Quantity Sold', key: 'saleQty', format: 'number' },
      { header: 'Avg Billing Rate', key: 'avgBillingRate', format: 'currency' },
      { header: 'Sales Amount', key: 'saleAmount', format: 'currency' },
      { header: 'Quantity Purchased', key: 'purchaseQty', format: 'number' },
      { header: 'Avg Purchase Rate', key: 'avgPurchaseRate', format: 'currency' },
      { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' }
    ] : [
      { header: '#', key: 'srNo' },
      { header: 'Retailer / Party', key: 'partyName' },
      { header: 'Retailer Code', key: 'retailerCode' },
      { header: 'City', key: 'city' },
      { header: 'Sale Quantity', key: 'saleQty', format: 'number' },
      { header: 'Sale Amount', key: 'saleAmount', format: 'currency' },
      { header: 'Purchase Quantity', key: 'purchaseQty', format: 'number' },
      { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' }
    ];

    const filterSummaryParts: string[] = [];
    filterSummaryParts.push(`Period: ${selectedDatePreset.replace('_', ' ').toUpperCase()}`);
    if (selectedCompany !== 'all') {
      const c = dbState.companies.find(comp => comp.id === selectedCompany);
      filterSummaryParts.push(`Company: ${c?.name || selectedCompany}`);
    }
    if (selectedItem !== 'all') {
      const p = dbState.products.find(prod => prod.id === selectedItem);
      filterSummaryParts.push(`Product: ${p?.name || selectedItem}`);
    }
    if (selectedParty !== 'all') {
      const party = availableParties.find(pa => pa.id === selectedParty);
      filterSummaryParts.push(`Party: ${party?.name || selectedParty}`);
    }

    exportToExcel({
      reportTitle: 'Party Report by Item',
      companyName: 'SAIFEE GENERAL STORES',
      filterSummary: filterSummaryParts,
      columns,
      data: sortedRows,
      totalsRow: {
        srNo: 'TOTAL',
        partyName: `${summary.recordCount} Parties`,
        saleQty: summary.totalSaleQty,
        saleAmount: summary.totalSaleAmount,
        purchaseQty: summary.totalPurchaseQty,
        purchaseAmount: summary.totalPurchaseAmount
      }
    });
  };

  const handlePrint = () => {
    printReport();
  };

  return (
    <div className="space-y-6">
      {/* 1. REPORT HEADER & TOP CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded uppercase tracking-wider">
                Reports
              </span>
              <span className="text-xs text-slate-400 font-bold">•</span>
              <span className="text-xs text-slate-500 font-bold">Commercial Sales &amp; Purchase Stream</span>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-[11px] font-black rounded-full">
                  {activeFilterCount} Active Filter{activeFilterCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
              Party Report by Item
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Retailer-wise Sales &amp; Purchase Summary — answers for a selected period how much was sold to each retailer and purchased from each party.
            </p>
          </div>

          {/* Action Tools: Export, Print, Reset */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Export filtered dataset to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Export filtered dataset to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Print formal report"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-300" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Reset all filters to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 2. UNIVERSAL ERP FILTER CONTROLS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 pt-3 border-t border-slate-100">
          {/* 1. Date Range Preset */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
              Date Range
            </label>
            <select
              value={selectedDatePreset}
              onChange={(e) => setSelectedDatePreset(e.target.value as DatePreset)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month (Default)</option>
              <option value="prev_month">Previous Month</option>
              <option value="current_quarter">This Quarter</option>
              <option value="current_fy">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* 2. Company */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3 text-indigo-500" />
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">[All Companies]</option>
              {dbState.companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Godown / Warehouse */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Warehouse className="w-3 h-3 text-indigo-500" />
              Godown / Warehouse
            </label>
            <select
              value={selectedGodown}
              onChange={(e) => setSelectedGodown(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">[All Godowns]</option>
              {availableGodowns.map(g => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* 4. Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Tag className="w-3 h-3 text-indigo-500" />
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">[All Categories]</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 5. Item / Product */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3 text-indigo-500" />
              Item / Product
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setItemDropdownOpen(!itemDropdownOpen)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none flex items-center justify-between text-left truncate"
              >
                <span className="truncate">
                  {selectedItem === 'all' ? '[All Items]' : (selectedProductObj?.name || selectedItem)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {itemDropdownOpen && (
                <div className="absolute z-40 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    <input
                      type="text"
                      placeholder="Search product / SKU..."
                      value={itemSearchText}
                      onChange={(e) => setItemSearchText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs outline-none"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem('all');
                        setItemDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-bold transition-all ${
                        selectedItem === 'all' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      [All Items]
                    </button>
                    {filteredProductOptions.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedItem(p.id);
                          setItemDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all ${
                          selectedItem === p.id ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="font-bold truncate">{p.name}</div>
                        <div className={`text-[10px] ${selectedItem === p.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {p.brand} • {p.pack_size || p.packing_display || 'Standard'} • ₹{p.selling_price}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. Retailer / Party */}
          <div className="space-y-1 relative">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Store className="w-3 h-3 text-indigo-500" />
              Retailer / Party
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPartyDropdownOpen(!partyDropdownOpen)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none flex items-center justify-between text-left truncate"
              >
                <span className="truncate">
                  {selectedParty === 'all' ? '[All Retailers]' : (selectedPartyObj?.name || selectedParty)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {partyDropdownOpen && (
                <div className="absolute z-40 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    <input
                      type="text"
                      placeholder="Search retailer, owner, city..."
                      value={partySearchText}
                      onChange={(e) => setPartySearchText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs outline-none"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParty('all');
                        setPartyDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-bold transition-all ${
                        selectedParty === 'all' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      [All Retailers]
                    </button>
                    {filteredPartyOptions.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedParty(p.id);
                          setPartyDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-all ${
                          selectedParty === p.id ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="font-bold truncate">{p.name}</div>
                        <div className={`text-[10px] ${selectedParty === p.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {p.owner || p.city || p.code} ({p.type})
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7. Salesperson */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-500" />
              Salesperson
            </label>
            <select
              value={selectedSalesperson}
              onChange={(e) => setSelectedSalesperson(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">[All Salespersons]</option>
              {availableSalespersons.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.role === 'sales_co' ? 'Company Rep' : 'Distributor Rep'})
                </option>
              ))}
            </select>
          </div>

          {/* 8. Order Channel (Strictly 4 Values) */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <ShoppingCart className="w-3 h-3 text-indigo-500" />
              Order Channel
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="all">[All Channels]</option>
              {orderChannels.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Pickers & Search Query Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
          {/* Custom Date Inputs (when Preset = Custom) */}
          {selectedDatePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-extrabold text-indigo-900">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none"
              />
              <span className="text-xs font-extrabold text-indigo-900">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          )}

          {/* Multi-field search box */}
          <div className="relative flex-1 max-w-md ml-auto w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search retailer, owner, mobile, product, SKU, invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. SUMMARY KPI CARDS (Section 28 & 29) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Gross Sales */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Gross Sales</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatCurrency(summary.totalGrossSales)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            {summary.totalInvoicesCount} Finalized Invoices
          </div>
        </div>

        {/* Card 2: Sales Return */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Sales Return</span>
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-lg font-black text-rose-600">
            {formatCurrency(summary.totalSalesReturn)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            Credit notes adjustment
          </div>
        </div>

        {/* Card 3: Net Sales */}
        <div className="bg-white rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[10px] font-black uppercase tracking-wider">Net Sales</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-indigo-900">
            {formatCurrency(summary.totalNetSales)}
          </div>
          <div className="text-[10px] text-indigo-600 font-bold">
            Total Qty: {summary.totalSaleQty.toLocaleString('en-IN')} units
          </div>
        </div>

        {/* Card 4: Total GST */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total GST</span>
            <Percent className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatCurrency(summary.totalSaleGst)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            Tax billed on sales
          </div>
        </div>

        {/* Card 5: Total Discount */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total Discount</span>
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700">
            {formatCurrency(summary.totalSaleDiscount)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            Scheme &amp; invoice discounts
          </div>
        </div>

        {/* Card 6: Purchase Value */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Purchase Value</span>
            <Package className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {formatCurrency(summary.totalPurchaseAmount)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold">
            {summary.totalPurchaseBillsCount} Bills • {summary.totalPurchaseQty.toLocaleString('en-IN')} units
          </div>
        </div>
      </div>

      {/* 4. SELECTED ITEM HIGHLIGHT BANNER (Section 14 & 16) */}
      {selectedProductObj && (
        <div className="bg-indigo-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-700 border border-indigo-500 flex items-center justify-center text-white shrink-0 font-black">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  Item-Level Focused Filter
                </span>
                <span className="text-xs text-indigo-400">•</span>
                <span className="text-xs text-indigo-200 font-bold">{selectedProductObj.brand}</span>
              </div>
              <h2 className="text-lg font-black text-white">
                {selectedProductObj.name}
              </h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                Pack Size: <span className="font-bold text-white">{selectedProductObj.pack_size || selectedProductObj.packing_display || 'Standard'}</span> • 
                Trading Unit: <span className="font-bold text-white">{selectedProductObj.trading_unit || 'Box'}</span> • 
                MRP: <span className="font-bold text-white">₹{selectedProductObj.mrp}</span> • 
                Selling Price: <span className="font-bold text-white">₹{selectedProductObj.selling_price}</span> • 
                HSN: <span className="font-bold text-white">{selectedProductObj.hsn || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-indigo-950/60 border border-indigo-700/50 px-4 py-2.5 rounded-xl">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">Total Sold</span>
              <span className="text-sm font-black text-emerald-400">
                {summary.totalSaleQty.toLocaleString('en-IN')} units ({formatCurrency(summary.totalSaleAmount)})
              </span>
            </div>
            <div className="h-6 w-px bg-indigo-700" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">Total Purchased</span>
              <span className="text-sm font-black text-sky-300">
                {summary.totalPurchaseQty.toLocaleString('en-IN')} units ({formatCurrency(summary.totalPurchaseAmount)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. MAIN TABLE (DESKTOP) & MOBILE CARDS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Top Status Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900">
              Retailer / Party Summary ({sortedRows.length} Parties)
            </h3>
            {searchQuery && (
              <span className="text-xs text-slate-500 font-bold">
                matching "{searchQuery}"
              </span>
            )}
          </div>

          {/* Page size picker */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={-1}>All Parties</option>
            </select>
          </div>
        </div>

        {/* Empty State Check */}
        {sortedRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto text-xl font-bold">
              🔍
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              No transactions found for the selected filters.
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting the date range, company, category, item, or salesperson filters to view historical commercial sales and purchase data.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th 
                      onClick={() => toggleSort('partyName')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>RETAILER / PARTY</span>
                        {sortField === 'partyName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-500" />}
                      </div>
                    </th>
                    <th 
                      onClick={() => toggleSort('saleQty')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>SALE QUANTITY</span>
                        {sortField === 'saleQty' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-500" />}
                      </div>
                    </th>
                    {selectedProductObj && (
                      <th className="py-3 px-4 text-right">
                        AVG BILLING RATE
                      </th>
                    )}
                    <th 
                      onClick={() => toggleSort('saleAmount')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>SALE AMOUNT</span>
                        {sortField === 'saleAmount' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-500" />}
                      </div>
                    </th>
                    <th 
                      onClick={() => toggleSort('purchaseQty')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>PURCHASE QUANTITY</span>
                        {sortField === 'purchaseQty' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-500" />}
                      </div>
                    </th>
                    {selectedProductObj && (
                      <th className="py-3 px-4 text-right">
                        AVG PURCHASE RATE
                      </th>
                    )}
                    <th 
                      onClick={() => toggleSort('purchaseAmount')}
                      className="py-3 px-4 text-right cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>PURCHASE AMOUNT</span>
                        {sortField === 'purchaseAmount' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                        ) : <ArrowUpDown className="w-3 h-3 text-slate-500" />}
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setDrilldownParty(row)}
                      className="hover:bg-indigo-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-400 group-hover:text-indigo-600">
                        {row.srNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 group-hover:text-indigo-900 transition-colors flex items-center gap-1.5">
                          <span>{row.partyName}</span>
                          {row.partyType === 'Supplier' && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-black uppercase">
                              Supplier
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {row.ownerName && <span>Owner: {row.ownerName}</span>}
                          {row.city && <span>• {row.city}</span>}
                          {row.retailerCode && <span className="font-mono text-slate-400">({row.retailerCode})</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-800">
                        {row.saleQty.toLocaleString('en-IN')}
                      </td>
                      {selectedProductObj && (
                        <td className="py-3 px-4 text-right font-bold text-slate-600">
                          {row.saleQty > 0 ? formatCurrency(row.avgBillingRate) : '—'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-black text-indigo-700">
                        {formatCurrency(row.saleAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-600">
                        {row.purchaseQty.toLocaleString('en-IN')}
                      </td>
                      {selectedProductObj && (
                        <td className="py-3 px-4 text-right font-bold text-slate-600">
                          {row.purchaseQty > 0 ? formatCurrency(row.avgPurchaseRate) : '—'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-bold text-slate-700">
                        {formatCurrency(row.purchaseAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrilldownParty(row);
                          }}
                          className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          title="View Retailer Drill-down"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* 6. TOTAL ROW (Section 6 & 17) */}
                <tfoot>
                  <tr className="bg-slate-100/90 font-black text-slate-900 text-xs border-t-2 border-slate-300">
                    <td className="py-3.5 px-4 text-center">TOTAL</td>
                    <td className="py-3.5 px-4">
                      <span>{summary.recordCount} Parties</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {summary.totalSaleQty.toLocaleString('en-IN')}
                    </td>
                    {selectedProductObj && (
                      <td className="py-3.5 px-4 text-right font-black text-slate-700">
                        {summary.totalSaleQty > 0 ? formatCurrency(Math.round((summary.totalSaleAmount / summary.totalSaleQty) * 100) / 100) : '—'}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right font-black text-indigo-900 text-sm">
                      {formatCurrency(summary.totalSaleAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {summary.totalPurchaseQty.toLocaleString('en-IN')}
                    </td>
                    {selectedProductObj && (
                      <td className="py-3.5 px-4 text-right font-black text-slate-700">
                        {summary.totalPurchaseQty > 0 ? formatCurrency(Math.round((summary.totalPurchaseAmount / summary.totalPurchaseQty) * 100) / 100) : '—'}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(summary.totalPurchaseAmount)}
                    </td>
                    <td className="py-3.5 px-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Cards (Responsive Design, Section 37) */}
            <div className="md:hidden divide-y divide-slate-200">
              {paginatedRows.map((row) => (
                <div 
                  key={row.id} 
                  className="p-4 space-y-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setDrilldownParty(row)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-indigo-600">#{row.srNo}</span>
                        <h4 className="text-sm font-black text-slate-900">{row.partyName}</h4>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {row.ownerName && <span>{row.ownerName}</span>}
                        {row.city && <span> • {row.city}</span>}
                        {row.retailerCode && <span className="font-mono text-slate-400"> ({row.retailerCode})</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrilldownParty(row);
                      }}
                      className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>

                  {/* 4 Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Sale Qty</span>
                      <span className="font-black text-slate-800">{row.saleQty.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Sale Amount</span>
                      <span className="font-black text-indigo-700">{formatCurrency(row.saleAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Qty</span>
                      <span className="font-bold text-slate-700">{row.purchaseQty.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Amount</span>
                      <span className="font-bold text-slate-700">{formatCurrency(row.purchaseAmount)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile Totals Footer */}
              <div className="p-4 bg-slate-100 border-t border-slate-300 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-900">
                  <span>TOTAL ({summary.recordCount} Parties)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Sale Qty</span>
                    <span className="font-black text-slate-900">{summary.totalSaleQty.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Sale Amount</span>
                    <span className="font-black text-indigo-900">{formatCurrency(summary.totalSaleAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Purchase Qty</span>
                    <span className="font-black text-slate-900">{summary.totalPurchaseQty.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Purchase Amount</span>
                    <span className="font-black text-slate-900">{formatCurrency(summary.totalPurchaseAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pagination Bottom Bar (Section 34) */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <div className="text-xs text-slate-500 font-bold">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} Parties
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      currentPage === 1 
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed' 
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Previous
                  </button>
                  <span className="text-xs font-extrabold text-slate-800 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      currentPage === totalPages 
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed' 
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 6. RETAILER DRILL-DOWN MODAL / DRAWER (Section 13 & 50) */}
      {drilldownParty && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded uppercase tracking-wider">
                    Retailer Details &amp; Drill-down
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-indigo-300 font-bold">
                    Period: {selectedDatePreset.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white mt-1">
                  {drilldownParty.partyName}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {drilldownParty.ownerName && <span>Owner: {drilldownParty.ownerName} • </span>}
                  {drilldownParty.mobile && <span>Mob: {drilldownParty.mobile} • </span>}
                  {drilldownParty.city && <span>City: {drilldownParty.city} • </span>}
                  {drilldownParty.gstin && <span>GSTIN: {drilldownParty.gstin}</span>}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrilldownParty(null)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDrilldownTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  drilldownTab === 'overview' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => setDrilldownTab('sales')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  drilldownTab === 'sales' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Sales Invoices</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  drilldownTab === 'sales' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {drilldownParty.salesTransactions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDrilldownTab('purchases')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  drilldownTab === 'purchases' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Purchase Bills</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  drilldownTab === 'purchases' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {drilldownParty.purchaseTransactions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDrilldownTab('products')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  drilldownTab === 'products' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Product-wise Breakdown</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  drilldownTab === 'products' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {drilldownParty.productBreakdown.length}
                </span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Tab 1: Overview Summary */}
              {drilldownTab === 'overview' && (
                <div className="space-y-6">
                  {/* Sales Summary Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        SALES SUMMARY
                      </h4>
                      <span className="text-xs font-bold text-slate-500">
                        {drilldownParty.invoicesCount} Total Invoices
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Sale Qty</span>
                        <span className="text-sm font-black text-slate-900">{drilldownParty.saleQty.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Gross Sales</span>
                        <span className="text-sm font-black text-slate-900">{formatCurrency(drilldownParty.grossSaleAmount)}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Discount</span>
                        <span className="text-sm font-black text-emerald-700">{formatCurrency(drilldownParty.saleDiscount)}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Total GST</span>
                        <span className="text-sm font-black text-slate-900">{formatCurrency(drilldownParty.saleGst)}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-rose-500 block uppercase">Sales Return</span>
                        <span className="text-sm font-black text-rose-600">{formatCurrency(drilldownParty.saleReturnAmount)}</span>
                      </div>
                      <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
                        <span className="text-[10px] font-black text-indigo-800 block uppercase">Net Sales</span>
                        <span className="text-sm font-black text-indigo-900">{formatCurrency(drilldownParty.saleAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Summary Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-sky-600" />
                        PURCHASE SUMMARY
                      </h4>
                      <span className="text-xs font-bold text-slate-500">
                        {drilldownParty.billsCount} Total Purchase Bills
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Qty</span>
                        <span className="text-sm font-black text-slate-900">{drilldownParty.purchaseQty.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Purchase Amount</span>
                        <span className="text-sm font-black text-slate-900">{formatCurrency(drilldownParty.purchaseAmount)}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Avg Purchase Rate</span>
                        <span className="text-sm font-black text-slate-900">
                          {drilldownParty.purchaseQty > 0 ? formatCurrency(drilldownParty.avgPurchaseRate) : '₹0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Sales Transactions Table (Section 13) */}
              {drilldownTab === 'sales' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      SALES TRANSACTIONS ({drilldownParty.salesTransactions.length} Items)
                    </h4>
                  </div>

                  {drilldownParty.salesTransactions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      No sales invoice transactions found for this party in the selected date range.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase">
                            <th className="py-2.5 px-3">Invoice #</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3">Variant</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3 text-right">Rate</th>
                            <th className="py-2.5 px-3 text-right">Discount</th>
                            <th className="py-2.5 px-3 text-right">GST</th>
                            <th className="py-2.5 px-3 text-right">Final Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {drilldownParty.salesTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold font-mono text-indigo-600">
                                {tx.invoiceNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {tx.date.slice(0, 10)}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {tx.productName}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {tx.packSize || tx.variant}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-800">
                                {tx.quantity}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700">
                                {formatCurrency(tx.rate)}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-600">
                                {tx.discount > 0 ? formatCurrency(tx.discount) : '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600">
                                {formatCurrency(tx.gstAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-indigo-900">
                                {formatCurrency(tx.finalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Purchase Transactions Table (Section 13) */}
              {drilldownTab === 'purchases' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      PURCHASE TRANSACTIONS ({drilldownParty.purchaseTransactions.length} Items)
                    </h4>
                  </div>

                  {drilldownParty.purchaseTransactions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      No purchase transactions recorded against this party for the selected period.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase">
                            <th className="py-2.5 px-3">Purchase Bill #</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3">Variant</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3 text-right">Purchase Rate</th>
                            <th className="py-2.5 px-3 text-right">GST</th>
                            <th className="py-2.5 px-3 text-right">Purchase Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {drilldownParty.purchaseTransactions.map((ptx) => (
                            <tr key={ptx.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold font-mono text-sky-700">
                                {ptx.purchaseNumber}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {ptx.date.slice(0, 10)}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {ptx.productName}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {ptx.packSize || ptx.variant}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-800">
                                {ptx.quantity}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700">
                                {formatCurrency(ptx.purchaseRate)}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600">
                                {formatCurrency(ptx.gstAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-900">
                                {formatCurrency(ptx.purchaseAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Product-wise Breakdown Table */}
              {drilldownTab === 'products' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase">
                      PRODUCT-WISE SALES &amp; PURCHASES ({drilldownParty.productBreakdown.length} Products)
                    </h4>
                  </div>

                  {drilldownParty.productBreakdown.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      No products recorded for this party.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase">
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3">Variant / Pack</th>
                            <th className="py-2.5 px-3 text-right">Sale Qty</th>
                            <th className="py-2.5 px-3 text-right">Sale Amount</th>
                            <th className="py-2.5 px-3 text-right">Avg Rate</th>
                            <th className="py-2.5 px-3 text-right">Purchase Qty</th>
                            <th className="py-2.5 px-3 text-right">Purchase Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {drilldownParty.productBreakdown.map((pb) => (
                            <tr key={pb.productId} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {pb.productName}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {pb.packSize || pb.variant}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-slate-800">
                                {pb.saleQty}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-indigo-700">
                                {formatCurrency(pb.saleAmount)}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600">
                                {pb.saleQty > 0 ? formatCurrency(pb.avgRate) : '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 font-bold">
                                {pb.purchaseQty}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-700 font-bold">
                                {formatCurrency(pb.purchaseAmount)}
                              </td>
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
              <span className="text-xs text-slate-500 font-bold">
                Party ID: {drilldownParty.partyId}
              </span>
              <button
                type="button"
                onClick={() => setDrilldownParty(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
