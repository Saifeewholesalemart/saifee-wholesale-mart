'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, Search, Filter, Download, Printer, ArrowUpDown, 
  ArrowUp, ArrowDown, TrendingUp, ShoppingBag, DollarSign, Store,
  Package, Building2, Warehouse, Calendar, CheckCircle2, FileSpreadsheet
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext,
  getPartyItemReport, PartyReportItemRow, PartyReportItem,
  formatQuantity, formatCurrency, formatDualQuantity
} from '@/lib/reportsEngine';
import { exportToCSV, exportToExcel, printReport, ExportColumn } from '@/lib/exportUtils';

interface PartyItemReportsViewProps {
  filters: ReportFilterState;
  dbState: DbState;
  userContext: UserContext;
  showCharts?: boolean;
}

type SortField = 'srNo' | 'partyName' | 'saleQty' | 'saleAmount' | 'purchaseQty' | 'purchaseAmount';
type SortDirection = 'asc' | 'desc';

export default function PartyItemReportsView({
  filters: parentFilters,
  dbState,
  userContext
}: PartyItemReportsViewProps) {
  // Local filter overrides for granular control
  const [localSearch, setLocalSearch] = useState('');
  const [selectedFirm, setSelectedFirm] = useState(parentFilters.companyId || 'all');
  const [selectedGodown, setSelectedGodown] = useState(parentFilters.godown || 'all');
  const [selectedCategory, setSelectedCategory] = useState(parentFilters.category || 'all');
  const [selectedItem, setSelectedItem] = useState(parentFilters.productId || 'all');
  const [selectedDatePreset, setSelectedDatePreset] = useState(parentFilters.datePreset || 'this_month');
  const [startDate, setStartDate] = useState(parentFilters.customStartDate || '2026-09-01');
  const [endDate, setEndDate] = useState(parentFilters.customEndDate || '2026-09-30');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('srNo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Merged Filter Object
  const mergedFilters: ReportFilterState = useMemo(() => ({
    ...parentFilters,
    datePreset: selectedDatePreset,
    customStartDate: startDate,
    customEndDate: endDate,
    companyId: selectedFirm !== 'all' ? selectedFirm : undefined,
    godown: selectedGodown !== 'all' ? selectedGodown : undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    productId: selectedItem !== 'all' ? selectedItem : undefined,
    searchQuery: localSearch
  }), [parentFilters, selectedDatePreset, startDate, endDate, selectedFirm, selectedGodown, selectedCategory, selectedItem, localSearch]);

  // Query Data from Engine
  const { rows, summary } = useMemo(() => {
    return getPartyItemReport(mergedFilters, dbState, userContext);
  }, [mergedFilters, dbState, userContext]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'srNo':
          comparison = a.srNo - b.srNo;
          break;
        case 'partyName':
          comparison = a.partyName.localeCompare(b.partyName);
          break;
        case 'saleQty':
          comparison = (a.saleQtyBase * 24 + a.saleQtyLoose) - (b.saleQtyBase * 24 + b.saleQtyLoose);
          break;
        case 'saleAmount':
          comparison = a.saleAmount - b.saleAmount;
          break;
        case 'purchaseQty':
          comparison = (a.purchaseQtyBase * 24 + a.purchaseQtyLoose) - (b.purchaseQtyBase * 24 + b.purchaseQtyLoose);
          break;
        case 'purchaseAmount':
          comparison = a.purchaseAmount - b.purchaseAmount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Re-index serial after sorting
    return list.map((item, idx) => ({ ...item, srNo: idx + 1 }));
  }, [rows, sortField, sortDirection]);

  // Toggle sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    const columns: ExportColumn<PartyReportItemRow>[] = [
      { header: '#', key: 'srNo' },
      { header: 'Party Name', key: 'partyName' },
      { header: 'Sale Quantity', key: 'saleQtyDisplay' },
      { header: 'Sale Amount', key: 'saleAmount', format: 'currency' },
      { header: 'Purchase Quantity', key: 'purchaseQtyDisplay' },
      { header: 'Purchase Amount', key: 'purchaseAmount', format: 'currency' }
    ];
    exportToExcel({
      reportTitle: 'Party Report By Item',
      columns,
      data: sortedRows,
      filterSummary: [`Period: ${startDate || 'All Time'} to ${endDate || 'All Time'}`, `Parties: ${summary.recordCount}`],
      totalsRow: {
        srNo: 'TOTAL',
        partyName: `${summary.recordCount} Parties`,
        saleQtyDisplay: formatQuantity(summary.totalSaleQtyBase, summary.totalSaleQtyLoose),
        saleAmount: summary.totalSaleAmount,
        purchaseQtyDisplay: formatQuantity(summary.totalPurchaseQtyBase, summary.totalPurchaseQtyLoose),
        purchaseAmount: summary.totalPurchaseAmount
      }
    });
  };

  const handlePrintPDF = () => {
    printReport();
  };

  return (
    <div className="space-y-4">
      {/* 1. Top Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Date presets & action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mr-1">Period:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'this_month', label: 'This Month' },
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'current_quarter', label: 'This Quarter' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedDatePreset(p.id as any);
                  if (p.id === 'all') {
                    setStartDate('');
                    setEndDate('');
                  } else if (p.id === 'this_month') {
                    setStartDate('2026-09-01');
                    setEndDate('2026-09-30');
                  } else if (p.id === 'today') {
                    setStartDate('2026-09-29');
                    setEndDate('2026-09-29');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedDatePreset === p.id 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="Export Report to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrintPDF}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Dropdowns Row: Firm, Godown, Category, Item, Date Pickers, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Search Party Name */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by Party Name..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none font-semibold text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Firm Dropdown */}
          <div>
            <select
              value={selectedFirm}
              onChange={(e) => setSelectedFirm(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none cursor-pointer focus:bg-white"
            >
              <option value="all">Firm: All Firms</option>
              {dbState.companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Godown Dropdown */}
          <div>
            <select
              value={selectedGodown}
              onChange={(e) => setSelectedGodown(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none cursor-pointer focus:bg-white"
            >
              <option value="all">Godown: All Godowns</option>
              <option value="Central Godown (Indore Hub)">Central Godown (Indore)</option>
              <option value="Ujjain Road Godown">Ujjain Road Godown</option>
              <option value="Depot Yard 2">Depot Yard 2</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none cursor-pointer focus:bg-white"
            >
              <option value="all">Category: All Categories</option>
              {(dbState.categories || []).map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Item Dropdown */}
          <div>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none cursor-pointer focus:bg-white"
            >
              <option value="all">Item: All Items</option>
              {dbState.products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Inputs if Custom Selected */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Date Range:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setSelectedDatePreset('custom');
            }}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
          />
          <span className="text-slate-400 font-bold text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setSelectedDatePreset('custom');
            }}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 2. KPI Stat Summary Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Active Parties</span>
          <span className="text-lg font-black text-slate-900 block mt-0.5">{summary.recordCount} Parties</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Total Sales Quantity</span>
          <span className="text-lg font-black text-emerald-700 block mt-0.5">
            {formatQuantity(summary.totalSaleQtyBase, summary.totalSaleQtyLoose)} Units
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Total Sales Revenue</span>
          <span className="text-lg font-black text-emerald-700 block mt-0.5">{formatCurrency(summary.totalSaleAmount)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Total Purchase Cost</span>
          <span className="text-lg font-black text-blue-700 block mt-0.5">{formatCurrency(summary.totalPurchaseAmount)}</span>
        </div>
      </div>

      {/* 3. Main Data Grid with Sticky Table Header & Sticky Summary Footer */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
          <table className="w-full text-left text-xs border-collapse min-w-[780px]">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold shadow-2xs">
              <tr>
                {/* 1. Serial # */}
                <th 
                  onClick={() => handleSort('srNo')}
                  className="p-3 w-12 text-center cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>#</span>
                    {sortField === 'srNo' && (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )}
                  </div>
                </th>

                {/* 2. Party Name */}
                <th 
                  onClick={() => handleSort('partyName')}
                  className="p-3 cursor-pointer select-none hover:bg-slate-200/70 transition-colors min-w-[220px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>PARTY NAME</span>
                    {sortField === 'partyName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 3. Sale Quantity */}
                <th 
                  onClick={() => handleSort('saleQty')}
                  className="p-3 text-right cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>SALE QUANTITY</span>
                    {sortField === 'saleQty' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 4. Sale Amount */}
                <th 
                  onClick={() => handleSort('saleAmount')}
                  className="p-3 text-right cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>SALE AMOUNT</span>
                    {sortField === 'saleAmount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 5. Purchase Quantity */}
                <th 
                  onClick={() => handleSort('purchaseQty')}
                  className="p-3 text-right cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>PURCHASE QUANTITY</span>
                    {sortField === 'purchaseQty' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>

                {/* 6. Purchase Amount */}
                <th 
                  onClick={() => handleSort('purchaseAmount')}
                  className="p-3 text-right cursor-pointer select-none hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>PURCHASE AMOUNT</span>
                    {sortField === 'purchaseAmount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body Rows */}
            <tbody className="divide-y divide-slate-100">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                    No party records found matching the current filters.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr 
                      key={row.id} 
                      className={`transition-colors hover:bg-indigo-50/50 ${isEven ? 'bg-white' : 'bg-slate-50/60'}`}
                    >
                      {/* 1. Serial # */}
                      <td className="p-3 text-center font-bold text-slate-400">
                        {row.srNo}
                      </td>

                      {/* 2. Party Name */}
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{row.partyName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                            row.partyType === 'Customer' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : row.partyType === 'Supplier'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {row.partyType}
                          </span>
                        </div>
                      </td>

                      {/* 3. Sale Quantity (dual format: e.g. "1628 + 16") */}
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {row.saleQtyDisplay}
                      </td>

                      {/* 4. Sale Amount */}
                      <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                        {row.saleAmount > 0 ? formatCurrency(row.saleAmount) : '₹ 0.00'}
                      </td>

                      {/* 5. Purchase Quantity (dual format: e.g. "10554 + 272") */}
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {row.purchaseQtyDisplay}
                      </td>

                      {/* 6. Purchase Amount */}
                      <td className="p-3 text-right font-bold text-blue-700 font-mono">
                        {row.purchaseAmount > 0 ? formatCurrency(row.purchaseAmount) : '₹ 0.00'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* 4. Sticky Summary Footer */}
            <tfoot className="sticky bottom-0 z-20 bg-slate-900 text-white font-black border-t-2 border-slate-700 shadow-xl">
              <tr>
                {/* 1. Sigma Icon */}
                <td className="p-3.5 text-center text-indigo-300 font-black">
                  Σ
                </td>

                {/* 2. Total Label */}
                <td className="p-3.5 tracking-wide text-white">
                  TOTAL ({summary.recordCount} Parties)
                </td>

                {/* 3. Total Sale Quantity */}
                <td className="p-3.5 text-right font-mono text-amber-300 text-xs">
                  {formatQuantity(summary.totalSaleQtyBase, summary.totalSaleQtyLoose)}
                </td>

                {/* 4. Total Sale Amount */}
                <td className="p-3.5 text-right font-mono text-emerald-300 text-xs">
                  {formatCurrency(summary.totalSaleAmount)}
                </td>

                {/* 5. Total Purchase Quantity */}
                <td className="p-3.5 text-right font-mono text-amber-300 text-xs">
                  {formatQuantity(summary.totalPurchaseQtyBase, summary.totalPurchaseQtyLoose)}
                </td>

                {/* 6. Total Purchase Amount */}
                <td className="p-3.5 text-right font-mono text-blue-300 text-xs">
                  {formatCurrency(summary.totalPurchaseAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
