'use client';

import React, { useState, useMemo } from 'react';
import { 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, ShieldAlert, Inbox, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatINR } from '@/lib/reportsEngine';
import SmartSearchBar from '@/components/SmartSearchBar';

export interface ColumnDef<T> {
  header: string;
  key?: keyof T | string;
  accessor?: (row: T) => any;
  format?: 'currency' | 'number' | 'date' | 'percent' | 'badge' | 'custom';
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  hideOnMobile?: boolean;
  priorityMobile?: boolean; // Show first on mobile card
}

interface ReportTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  totals?: Record<string, any>;
  searchPlaceholder?: string;
  externalSearchTerm?: string;
  onSearchChange?: (term: string) => void;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  isPermissionDenied?: boolean;
  permissionMessage?: string;
  emptyMessage?: string;
  initialPageSize?: number;
  mobileCardTitle?: (row: T) => React.ReactNode;
  mobileCardSubtitle?: (row: T) => React.ReactNode;
}

export default function ReportTable<T extends Record<string, any>>({
  columns,
  data,
  totals,
  searchPlaceholder = 'Search records...',
  externalSearchTerm,
  onSearchChange,
  onRowClick,
  isLoading = false,
  isPermissionDenied = false,
  permissionMessage = 'You do not have permission to view this report.',
  emptyMessage = 'No data found for the selected filters.',
  initialPageSize = 25,
  mobileCardTitle,
  mobileCardSubtitle
}: ReportTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState(externalSearchTerm || '');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Sync external search term if changed from parent
  React.useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  // Handle Sort
  const handleSort = (col: ColumnDef<T>) => {
    if (col.sortable === false) return;
    const key = (col.key as string) || col.header;
    if (sortKey === key) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortKey(null); // Reset
      }
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Filter and Sort Data
  const processedData = useMemo(() => {
    let result = [...data];

    // Live search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(row => {
        return Object.values(row).some(val => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Sorting
    if (sortKey) {
      const col = columns.find(c => (c.key as string) === sortKey || c.header === sortKey);
      result.sort((a, b) => {
        let valA = col?.accessor ? col.accessor(a) : (a as any)[sortKey];
        let valB = col?.accessor ? col.accessor(b) : (b as any)[sortKey];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [data, searchTerm, sortKey, sortDirection, columns]);

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(processedData.length / pageSize);
  const paginatedData = useMemo(() => {
    if (pageSize === 0) return processedData;
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const toggleRowExpand = (idx: number) => {
    const next = new Set(expandedRows);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedRows(next);
  };

  // Format Helper
  const formatCell = (val: any, format?: string) => {
    if (val === null || val === undefined) return '—';
    if (format === 'currency') return formatINR(val);
    if (format === 'percent') return `${Number(val).toFixed(1)}%`;
    if (format === 'number') return typeof val === 'number' ? val.toLocaleString('en-IN') : val;
    return String(val);
  };

  if (isPermissionDenied) {
    return (
      <div className="erp-card bg-white p-12 text-center space-y-3 border-amber-200">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Access Restricted</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{permissionMessage}</p>
      </div>
    );
  }

  return (
    <div className="erp-card bg-white overflow-hidden border border-slate-200 shadow-sm flex flex-col">
      {/* Table Toolbar (Search & Page Size) */}
      <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <SmartSearchBar
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
              onSearchChange?.(val);
            }}
            placeholder={searchPlaceholder}
            size="sm"
            inputClassName="bg-white"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
          <span className="hidden sm:inline">
            Showing {processedData.length} records
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-bold uppercase">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none font-bold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet Table Layout */}
      <div className="relative overflow-x-auto max-h-[650px] overflow-y-auto">
        <table className="erp-table w-full border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 shadow-2xs">
            <tr>
              {columns.map((col, idx) => {
                const isSorted = sortKey === ((col.key as string) || col.header);
                const alignClass = 
                  col.align === 'right' ? 'text-right' : 
                  col.align === 'center' ? 'text-center' : 'text-left';

                return (
                  <th
                    key={idx}
                    onClick={() => handleSort(col)}
                    className={`py-3 px-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider select-none ${alignClass} ${
                      col.sortable !== false ? 'cursor-pointer hover:bg-slate-200/80 transition-colors' : ''
                    }`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-xs text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    <span>Loading report records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const isClickable = Boolean(onRowClick);

                return (
                  <tr
                    key={rowIdx}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors text-xs ${
                      isClickable ? 'cursor-pointer hover:bg-indigo-50/50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {columns.map((col, colIdx) => {
                      let rawVal: any;
                      if (col.accessor) rawVal = col.accessor(row);
                      else if (col.key) rawVal = row[col.key as string];

                      const alignClass = 
                        col.align === 'right' ? 'text-right font-medium' : 
                        col.align === 'center' ? 'text-center' : 'text-left';

                      return (
                        <td key={colIdx} className={`py-2.5 px-3.5 text-slate-800 ${alignClass}`}>
                          {col.render ? col.render(row) : formatCell(rawVal, col.format)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Totals Summary Footer Row */}
          {totals && paginatedData.length > 0 && (
            <tfoot className="sticky bottom-0 bg-slate-100/95 backdrop-blur-xs border-t-2 border-slate-300 font-black text-xs text-slate-900 shadow-lg">
              <tr>
                {columns.map((col, idx) => {
                  const alignClass = 
                    col.align === 'right' ? 'text-right' : 
                    col.align === 'center' ? 'text-center' : 'text-left';

                  if (idx === 0) {
                    return (
                      <td key={idx} className={`py-3 px-3.5 font-extrabold uppercase text-indigo-950 ${alignClass}`}>
                        TOTAL
                      </td>
                    );
                  }

                  const val = (col.key && totals[col.key as string]) !== undefined 
                    ? totals[col.key as string] 
                    : totals[col.header];

                  return (
                    <td key={idx} className={`py-3 px-3.5 font-bold text-slate-900 ${alignClass}`}>
                      {val !== undefined ? formatCell(val, col.format) : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Footer */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600 no-print">
          <div className="text-xs text-slate-600 font-semibold">
            Page <span className="font-bold text-slate-800">{currentPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 font-bold text-slate-700 text-xs">{currentPage}</span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
