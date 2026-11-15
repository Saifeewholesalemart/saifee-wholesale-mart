'use client';

/**
 * Report grid used by every report section.
 *
 * Looks like a spreadsheet: every cell has a border, rows are compact, the header and the
 * totals row stay in place while scrolling, and the first column is the row number.
 * Like Vyapar's report screens, every column header can be clicked to sort, and the funnel
 * icon on a header opens a small filter for that column (text: contains / exact match,
 * numbers: equal to / greater than / less than / between).
 */

import { hasWords, matchWords } from '@/lib/searchWords';
import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import {
  ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ShieldAlert, Inbox, Filter, X
} from 'lucide-react';
import { formatINR } from '@/lib/reportsEngine';
import SmartSearchBar from '@/components/SmartSearchBar';

/**
 * The search box at the top of the Reports page. Every report grid on the page filters its
 * rows with it, so the search works the same way in every report section.
 */
export const ReportSearchContext = createContext<string>('');

/** All text in a row, including names inside its lines (items, transactions), for word search. */
function rowWords(row: any): string[] {
  const out: string[] = [];
  const walk = (v: any, depth: number) => {
    if (v === null || v === undefined || out.length > 400) return;
    if (typeof v === 'string') { if (v) out.push(v); return; }
    if (typeof v === 'number') { out.push(String(v)); return; }
    if (depth >= 3 || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.slice(0, 200).forEach(x => walk(x, depth + 1)); return; }
    Object.values(v).forEach(x => walk(x, depth + 1));
  };
  walk(row, 0);
  return out;
}

export interface ColumnDef<T> {
  header: string;
  key?: keyof T | string;
  accessor?: (row: T) => any;
  format?: 'currency' | 'number' | 'date' | 'percent' | 'badge' | 'custom';
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** turn off the column filter (funnel) for this column */
  filterable?: boolean;
  /** value used for sorting and number filters, when it differs from the shown value */
  sortValue?: (row: T) => any;
  /** text used by the column filter, when it differs from the shown value */
  filterText?: (row: T) => string;
  /** minimum column width, e.g. 220 or '14rem' */
  minWidth?: number | string;
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
  /** hide the search box (when the page already has its own search) */
  hideSearch?: boolean;
  /** heading shown on the left of the toolbar */
  title?: React.ReactNode;
  /** stable key for each row */
  rowKey?: (row: T, index: number) => string | number;
  /** starting sort */
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  /** maximum height of the scrolling grid */
  maxHeight?: string;
}

type TextOp = 'contains' | 'exact';
type NumOp = 'eq' | 'gt' | 'lt' | 'between';
interface ColFilter { kind: 'text' | 'number'; op: TextOp | NumOp; value: string; value2?: string }

const DATE_RE = /^(\d{4}-\d{2}-\d{2})|^(\d{1,2}[\s\-/][A-Za-z]{3,9}[\s\-/,]+\d{2,4})|^(\d{1,2}\/\d{1,2}\/\d{2,4})/;
const NUMBER_RE = /^\s*[-−]?\s*₹?\s*-?[\d,]+(\.\d+)?\s*%?\s*$/;
const collator = new Intl.Collator('en-IN', { numeric: true, sensitivity: 'base' });

function parseNumber(v: string): number {
  const neg = /[-−]/.test(v);
  const n = Number(v.replace(/[^\d.]/g, ''));
  return neg ? -n : n;
}

function parseDate(v: string): number | null {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(y, Number(m[2]) - 1, Number(m[1])).getTime();
  }
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}

/** Turn a cell value into something that sorts correctly: numbers, dates, then text. */
function sortable(v: any): { t: 0 | 1 | 2; n: number; s: string } {
  if (v === null || v === undefined || v === '' || v === '—') return { t: 2, n: 0, s: '' };
  if (typeof v === 'number') return { t: 0, n: isFinite(v) ? v : 0, s: '' };
  if (typeof v === 'boolean') return { t: 0, n: v ? 1 : 0, s: '' };
  if (v instanceof Date) return { t: 0, n: v.getTime(), s: '' };
  const s = String(v).trim();
  if (NUMBER_RE.test(s)) return { t: 0, n: parseNumber(s), s: '' };
  if (DATE_RE.test(s)) {
    const d = parseDate(s);
    if (d !== null) return { t: 0, n: d, s: '' };
  }
  return { t: 1, n: 0, s };
}

function compareValues(a: any, b: any): number {
  const A = sortable(a);
  const B = sortable(b);
  if (A.t !== B.t) return A.t - B.t;          // numbers first, blanks last
  if (A.t === 0) return A.n - B.n;
  return collator.compare(A.s, B.s);
}

function toNumber(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseNumber(s);
  return isFinite(n) && /\d/.test(s) ? n : null;
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
  initialPageSize = 50,
  hideSearch = false,
  title,
  rowKey,
  defaultSort,
  maxHeight = '650px'
}: ReportTableProps<T>) {
  // A '#' / serial column from the caller is replaced by the grid's own row numbers,
  // because a stored serial number would be wrong after sorting or filtering.
  const cols = useMemo(
    () => columns.filter(c => !(c.header.trim() === '#' || c.key === 'srNo')),
    [columns]
  );

  const pageSearch = useContext(ReportSearchContext).trim();
  const [searchTerm, setSearchTerm] = useState(externalSearchTerm || '');
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSort?.direction ?? 'asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<Record<string, ColFilter>>({});
  const [openFilter, setOpenFilter] = useState<{ key: string; top: number; left: number } | null>(null);
  const [draft, setDraft] = useState<ColFilter | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (externalSearchTerm !== undefined) setSearchTerm(externalSearchTerm);
  }, [externalSearchTerm]);

  // New data (other date range, other filters on the page) starts again from page 1
  useEffect(() => { setCurrentPage(1); }, [data]);

  const colId = (col: ColumnDef<T>) => (col.key as string) || col.header;

  /** the raw value of a cell (what the column holds, before formatting) */
  const rawValue = (col: ColumnDef<T>, row: T) => {
    if (col.accessor) return col.accessor(row);
    if (col.key) return (row as any)[col.key as string];
    return undefined;
  };
  const sortValueOf = (col: ColumnDef<T>, row: T) => (col.sortValue ? col.sortValue(row) : rawValue(col, row));

  const canSort = (col: ColumnDef<T>) =>
    col.sortable !== false && Boolean(col.sortValue || col.accessor || col.key);
  const canFilter = (col: ColumnDef<T>) =>
    col.filterable !== false && Boolean(col.filterText || col.sortValue || col.accessor || col.key);

  const isNumericCol = (col: ColumnDef<T>) => {
    if (col.format === 'currency' || col.format === 'number' || col.format === 'percent') return true;
    const sample = data.slice(0, 30).map(r => sortValueOf(col, r)).filter(v => v !== null && v !== undefined && v !== '');
    return sample.length > 0 && sample.every(v => typeof v === 'number');
  };

  const filterTextOf = (col: ColumnDef<T>, row: T): string => {
    if (col.filterText) return col.filterText(row);
    const v = rawValue(col, row);
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return '';
    return String(v);
  };

  // Clicking a header: first click sorts A→Z / small→big, second click reverses, third clears.
  const handleSort = (col: ColumnDef<T>, direction?: 'asc' | 'desc') => {
    if (!canSort(col)) return;
    const key = colId(col);
    if (direction) { setSortKey(key); setSortDirection(direction); return; }
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Search box at the top of the Reports page: keep the rows that have all the typed words.
  // When no row has them (for example a product name typed in a shop-wise report), the report
  // already shows only what belongs to the matching bills, so those rows are kept as they are.
  const pageSearchResult = useMemo(() => {
    if (!pageSearch) return { rows: data, narrowed: false, fallback: false };
    const rows = data.filter(row => matchWords(pageSearch, rowWords(row)));
    if (rows.length === 0 && data.length > 0) return { rows: data, narrowed: false, fallback: true };
    return { rows, narrowed: rows.length !== data.length, fallback: false };
  }, [data, pageSearch]);

  const processedData = useMemo(() => {
    let result = [...pageSearchResult.rows];

    if (searchTerm.trim() && !hideSearch) {
      result = result.filter(row => matchWords(searchTerm, rowWords(row)));
    }

    // Column filters
    for (const [key, f] of Object.entries(filters)) {
      const col = cols.find(c => colId(c) === key);
      if (!col) continue;
      if (f.kind === 'text') {
        const q = f.value.trim().toLowerCase();
        if (!q) continue;
        result = result.filter(row => {
          const text = filterTextOf(col, row).toLowerCase().trim();
          return f.op === 'exact' ? text === q : hasWords(text, q);
        });
      } else {
        const a = Number(f.value);
        const b = Number(f.value2);
        if (f.value.trim() === '' || !isFinite(a)) continue;
        result = result.filter(row => {
          const n = toNumber(sortValueOf(col, row));
          if (n === null) return false;
          if (f.op === 'eq') return Math.abs(n - a) < 0.005;
          if (f.op === 'gt') return n > a;
          if (f.op === 'lt') return n < a;
          if (f.op === 'between') return isFinite(b) && f.value2 !== '' ? n >= Math.min(a, b) && n <= Math.max(a, b) : n >= a;
          return true;
        });
      }
    }

    if (sortKey) {
      const col = cols.find(c => colId(c) === sortKey);
      if (col) {
        result = result
          .map((row, i) => ({ row, i, v: sortValueOf(col, row) }))
          .sort((x, y) => {
            const c = compareValues(x.v, y.v);
            // blanks always stay at the bottom
            const blankX = sortable(x.v).t === 2;
            const blankY = sortable(y.v).t === 2;
            if (blankX !== blankY) return blankX ? 1 : -1;
            return (sortDirection === 'asc' ? c : -c) || x.i - y.i;
          })
          .map(x => x.row);
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSearchResult, searchTerm, hideSearch, filters, sortKey, sortDirection, cols]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(processedData.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    if (pageSize === 0) return processedData;
    const start = (page - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, page, pageSize]);

  const activeFilterCount = Object.keys(filters).length;
  const isNarrowed = activeFilterCount > 0 || (!hideSearch && searchTerm.trim() !== '') || pageSearchResult.narrowed;

  // When rows are narrowed by the grid's own filters, money and quantity totals are worked
  // again from the rows that are left; other totals (averages, text) are left blank.
  const shownTotals = useMemo(() => {
    if (!totals) return undefined;
    if (!isNarrowed) return totals;
    const out: Record<string, any> = {};
    cols.forEach(col => {
      const id = (col.key as string) || col.header;
      const given = col.key && totals[col.key as string] !== undefined ? totals[col.key as string] : totals[col.header];
      if (typeof given === 'number' && (col.format === 'currency' || col.format === 'number')) {
        out[id] = processedData.reduce((s, row) => s + (toNumber(rawValue(col, row)) || 0), 0);
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals, isNarrowed, processedData, cols]);

  const formatCell = (val: any, format?: string) => {
    if (val === null || val === undefined || val === '') return '—';
    if (format === 'currency') return formatINR(val);
    if (format === 'percent') return `${Number(val).toFixed(1)}%`;
    if (format === 'number') return typeof val === 'number' ? val.toLocaleString('en-IN') : val;
    return String(val);
  };

  const alignOf = (col: ColumnDef<T>) =>
    col.align || (col.format === 'currency' || col.format === 'number' || col.format === 'percent' ? 'right' : 'left');
  const alignClass = (a: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  // ---- column filter popup ----
  const openFilterFor = (col: ColumnDef<T>, btn: HTMLElement) => {
    const key = colId(col);
    const r = btn.getBoundingClientRect();
    const width = 240;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
    setOpenFilter({ key, top: r.bottom + 4, left });
    const numeric = isNumericCol(col);
    setDraft(filters[key] || { kind: numeric ? 'number' : 'text', op: numeric ? 'eq' : 'contains', value: '', value2: '' });
  };

  useEffect(() => {
    if (!openFilter) return;
    const close = (e: MouseEvent) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return;
      setOpenFilter(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenFilter(null); };
    const onScroll = (e: Event) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return;
      setOpenFilter(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [openFilter]);

  const applyFilter = () => {
    if (!openFilter || !draft) return;
    setFilters(prev => {
      const next = { ...prev };
      if (draft.value.trim() === '') delete next[openFilter.key];
      else next[openFilter.key] = draft;
      return next;
    });
    setCurrentPage(1);
    setOpenFilter(null);
  };

  const clearFilter = (key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setCurrentPage(1);
  };

  const describeFilter = (f: ColFilter) => {
    if (f.kind === 'text') return f.op === 'exact' ? `= "${f.value}"` : `contains "${f.value}"`;
    if (f.op === 'eq') return `= ${f.value}`;
    if (f.op === 'gt') return `> ${f.value}`;
    if (f.op === 'lt') return `< ${f.value}`;
    return `${f.value} to ${f.value2 || '…'}`;
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

  const openCol = openFilter ? cols.find(c => colId(c) === openFilter.key) : undefined;
  const firstRowNo = pageSize === 0 ? 1 : (page - 1) * pageSize + 1;
  const colCount = cols.length + 1;

  return (
    <div className="report-grid bg-white overflow-hidden border border-slate-300 rounded-lg shadow-sm flex flex-col">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {title && <div className="text-xs font-black text-slate-800 uppercase tracking-wide">{title}</div>}
          {!hideSearch && (
            <div className="w-64 max-w-full">
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
          )}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(filters).map(([key, f]) => {
                const col = cols.find(c => colId(c) === key);
                return (
                  <span key={key} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded px-1.5 py-0.5">
                    {col?.header}: {describeFilter(f)}
                    <button type="button" onClick={() => clearFilter(key)} className="hover:text-rose-600" title="Remove this filter">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              <button type="button" onClick={() => { setFilters({}); setCurrentPage(1); }} className="text-[11px] font-bold text-rose-600 hover:underline">
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
          <span>
            {processedData.length === data.length
              ? `${data.length} rows`
              : `${processedData.length} of ${data.length} rows`}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-bold">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-700 outline-none font-bold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>
      </div>

      {pageSearchResult.fallback && (
        <div className="px-3 py-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border-b border-amber-200 no-print">
          No row here contains all the words "{pageSearch}". Showing the figures from the bills that match the search.
        </div>
      )}

      {/* Grid */}
      <div className="relative overflow-auto" style={{ maxHeight }}>
        <table className="report-grid-table w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="rg-th rg-rownum sticky top-0 left-0 z-30 text-center">#</th>
              {cols.map((col, idx) => {
                const id = colId(col);
                const isSorted = sortKey === id;
                const align = alignOf(col);
                const sortOk = canSort(col);
                const filterOk = canFilter(col);
                const hasFilter = Boolean(filters[id]);
                return (
                  <th
                    key={idx}
                    className={`rg-th sticky top-0 z-20 ${alignClass(align)} ${sortOk ? 'cursor-pointer hover:bg-slate-200' : ''} ${isSorted ? 'bg-indigo-50' : ''}`}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                    onClick={() => sortOk && handleSort(col)}
                    title={sortOk ? 'Click to sort' : undefined}
                  >
                    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between'}`}>
                      <span className="inline-flex items-center gap-1">
                        <span>{col.header}</span>
                        {isSorted && (sortDirection === 'asc'
                          ? <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" />
                          : <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />)}
                      </span>
                      {filterOk && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openFilterFor(col, e.currentTarget); }}
                          className={`no-print p-0.5 rounded shrink-0 ${hasFilter ? 'text-white bg-indigo-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-300'}`}
                          title="Filter this column"
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-xs text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    <span>Loading report records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-14 text-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">
                    {data.length > 0 && isNarrowed ? 'No rows match the column filters.' : emptyMessage}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={rowKey ? rowKey(row, rowIdx) : rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`rg-row ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  <td className="rg-td rg-rownum sticky left-0 z-10 text-center">{firstRowNo + rowIdx}</td>
                  {cols.map((col, colIdx) => (
                    <td key={colIdx} className={`rg-td ${alignClass(alignOf(col))} ${alignOf(col) === 'right' ? 'tabular-nums' : ''}`}>
                      {col.render ? col.render(row) : formatCell(rawValue(col, row), col.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {shownTotals && paginatedData.length > 0 && (
            <tfoot>
              <tr>
                <td className="rg-tf rg-rownum sticky bottom-0 left-0 z-30 text-center">Σ</td>
                {cols.map((col, idx) => {
                  const id = (col.key as string) || col.header;
                  let val: any;
                  if (isNarrowed) val = shownTotals[id];
                  else val = col.key && shownTotals[col.key as string] !== undefined ? shownTotals[col.key as string] : shownTotals[col.header];
                  const first = idx === 0;
                  return (
                    <td key={idx} className={`rg-tf sticky bottom-0 z-20 ${alignClass(alignOf(col))} tabular-nums`}>
                      {first && (val === undefined || val === 'TOTAL' || typeof val !== 'number')
                        ? (isNarrowed ? 'TOTAL (filtered rows)' : (val !== undefined && val !== 'TOTAL' ? `TOTAL · ${val}` : 'TOTAL'))
                        : val !== undefined ? formatCell(val, col.format) : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-300 flex items-center justify-between gap-3 text-xs text-slate-600 no-print">
          <div className="font-semibold">
            Rows {firstRowNo}–{Math.min(page * pageSize, processedData.length)} of {processedData.length}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30" title="First page">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30" title="Previous page">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-700">Page {page} of {totalPages}</span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30" title="Next page">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={page === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30" title="Last page">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Column filter popup */}
      {openFilter && openCol && draft && (
        <div
          ref={popRef}
          className="fixed z-[100] w-60 bg-white border border-slate-300 rounded-lg shadow-xl p-3 space-y-2 text-xs no-print"
          style={{ top: openFilter.top, left: openFilter.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-black text-slate-800 uppercase tracking-wide text-[11px]">{openCol.header}</div>
          {canSort(openCol) && (
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => { handleSort(openCol, 'asc'); setOpenFilter(null); }}
                className="flex items-center justify-center gap-1 border border-slate-300 rounded py-1 font-semibold hover:bg-slate-100">
                <ArrowUp className="w-3 h-3" /> {draft.kind === 'number' ? 'Low to high' : 'A to Z'}
              </button>
              <button type="button" onClick={() => { handleSort(openCol, 'desc'); setOpenFilter(null); }}
                className="flex items-center justify-center gap-1 border border-slate-300 rounded py-1 font-semibold hover:bg-slate-100">
                <ArrowDown className="w-3 h-3" /> {draft.kind === 'number' ? 'High to low' : 'Z to A'}
              </button>
            </div>
          )}
          <select
            value={draft.op}
            onChange={(e) => setDraft({ ...draft, op: e.target.value as any })}
            className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
          >
            {draft.kind === 'text' ? (
              <>
                <option value="contains">Contains</option>
                <option value="exact">Exact match</option>
              </>
            ) : (
              <>
                <option value="eq">Equal to</option>
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="between">Between</option>
              </>
            )}
          </select>
          <input
            autoFocus
            data-no-list-nav
            type={draft.kind === 'number' ? 'number' : 'text'}
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilter(); } }}
            placeholder={draft.kind === 'number' ? (draft.op === 'between' ? 'From' : 'Value') : 'Type to filter'}
            className="w-full border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500"
          />
          {draft.kind === 'number' && draft.op === 'between' && (
            <input
              data-no-list-nav
              type="number"
              value={draft.value2 || ''}
              onChange={(e) => setDraft({ ...draft, value2: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilter(); } }}
              placeholder="To"
              className="w-full border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-indigo-500"
            />
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => { clearFilter(openFilter.key); setOpenFilter(null); }}
              className="px-2.5 py-1 rounded border border-slate-300 font-bold text-slate-600 hover:bg-slate-100">
              Clear
            </button>
            <button type="button" onClick={applyFilter}
              className="px-3 py-1 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
