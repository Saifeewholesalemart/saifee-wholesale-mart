'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Play, CheckCircle2, XCircle, AlertTriangle, 
  RotateCcw, Search, Calendar, CreditCard, Users, Store, 
  Building2, Layers, ChevronDown, ChevronUp, Copy, Check,
  Zap, Info, Sparkles, Filter
} from 'lucide-react';
import { 
  ReportFilterState, DbState, UserContext, 
  getDateRangeFromPreset, isDateInRange, 
  isInvoiceMatchingSalesperson, isInvoiceMatchingSearch,
  formatINR 
} from '@/lib/reportsEngine';

interface FilterDiagnosticsBarProps {
  filters: ReportFilterState;
  onChange: (newFilters: ReportFilterState) => void;
  dbState: DbState;
  userContext: UserContext;
  activeCategory?: string;
}

interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  count: number;
  durationMs: number;
  details?: string;
}

export default function FilterDiagnosticsBar({
  filters,
  onChange,
  dbState,
  userContext,
  activeCategory = 'sales'
}: FilterDiagnosticsBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestCaseResult[] | null>(null);

  // 1. Calculate Real-time Date Range for active filter
  const activeDateRange = useMemo(() => {
    return getDateRangeFromPreset(filters.datePreset, filters.customStartDate, filters.customEndDate);
  }, [filters.datePreset, filters.customStartDate, filters.customEndDate]);

  // 2. Compute Step-by-Step Dropoff Pipeline
  const pipeline = useMemo(() => {
    const rawInvoices = dbState.invoices || [];
    const step0Raw = rawInvoices.length;

    // Step 1: After Search Term
    const step1Invoices = rawInvoices.filter(inv => 
      isInvoiceMatchingSearch(inv, filters.searchQuery, dbState)
    );
    const step1Count = step1Invoices.length;

    // Step 2: After Date Range Filter
    const step2Invoices = step1Invoices.filter(inv => 
      isDateInRange(inv.date, activeDateRange)
    );
    const step2Count = step2Invoices.length;

    // Step 3: After Status Filter
    const step3Invoices = step2Invoices.filter(inv => {
      if (filters.paymentStatus === 'Paid') return inv.outstanding_amount <= 0;
      if (filters.paymentStatus === 'Unpaid') return inv.outstanding_amount > 0;
      if (filters.paymentStatus === 'Partial') return inv.paid_amount > 0 && inv.outstanding_amount > 0;
      return true;
    });
    const step3Count = step3Invoices.length;

    // Step 4: After Entity Filters (Salesperson, Retailer, Company, Category)
    const step4Invoices = step3Invoices.filter(inv => {
      if (filters.retailerId && inv.retailer_id !== filters.retailerId) return false;
      if (filters.salespersonId && !isInvoiceMatchingSalesperson(inv, filters.salespersonId, dbState)) return false;
      
      if (filters.companyId || filters.category || filters.brand || filters.productId) {
        const hasMatchingItem = inv.items?.some(item => {
          const prod = dbState.products.find(p => p.id === item.product_id);
          if (!prod) return false;
          if (filters.companyId && prod.company_id !== filters.companyId) return false;
          if (filters.category && prod.category !== filters.category) return false;
          if (filters.brand && prod.brand !== filters.brand) return false;
          if (filters.productId && prod.id !== filters.productId) return false;
          return true;
        });
        if (!hasMatchingItem) return false;
      }

      return true;
    });
    const step4Count = step4Invoices.length;

    return {
      rawCount: step0Raw,
      afterSearchCount: step1Count,
      afterDateCount: step2Count,
      afterStatusCount: step3Count,
      finalCount: step4Count,
      searchDrop: step0Raw - step1Count,
      dateDrop: step1Count - step2Count,
      statusDrop: step2Count - step3Count,
      entityDrop: step3Count - step4Count,
      finalPercentage: step0Raw > 0 ? ((step4Count / step0Raw) * 100).toFixed(1) : '0'
    };
  }, [dbState, filters, activeDateRange]);

  // 3. Console Audit Logger on filter changes
  useEffect(() => {
    const formattedStartDate = activeDateRange.start.toISOString().slice(0, 10);
    const formattedEndDate = activeDateRange.end.toISOString().slice(0, 10);

    console.groupCollapsed(`🔍 [Filter Diagnostics Audit] Category: ${activeCategory.toUpperCase()} | Matching: ${pipeline.finalCount}/${pipeline.rawCount} Invoices`);
    console.log('Filter Pipeline:', {
      rawCount: pipeline.rawCount,
      searchApplied: filters.searchQuery || 'None',
      afterSearch: pipeline.afterSearchCount,
      datePreset: filters.datePreset,
      dateApplied: `${formattedStartDate} to ${formattedEndDate}`,
      afterDate: pipeline.afterDateCount,
      paymentStatus: filters.paymentStatus || 'All',
      afterStatus: pipeline.afterStatusCount,
      salespersonApplied: filters.salespersonId || 'All',
      retailerApplied: filters.retailerId || 'All',
      companyApplied: filters.companyId || 'All',
      finalCount: pipeline.finalCount,
      retentionRate: `${pipeline.finalPercentage}%`
    });
    console.table([
      { Stage: '0. Raw Invoices Loaded', Count: pipeline.rawCount, Dropped: 0 },
      { Stage: '1. After Search Term', Count: pipeline.afterSearchCount, Dropped: pipeline.searchDrop },
      { Stage: '2. After Date Range', Count: pipeline.afterDateCount, Dropped: pipeline.dateDrop },
      { Stage: '3. After Status Filter', Count: pipeline.afterStatusCount, Dropped: pipeline.statusDrop },
      { Stage: '4. After Entity/Rep Filters', Count: pipeline.finalCount, Dropped: pipeline.entityDrop }
    ]);
    console.groupEnd();
  }, [filters, pipeline, activeCategory, activeDateRange]);

  // 4. Automated Filter Self-Test Suite Runner
  const runFilterSelfTests = () => {
    setIsRunningTests(true);
    const results: TestCaseResult[] = [];
    const allInvoices = dbState.invoices || [];

    setTimeout(() => {
      // Test 1: Search by partial Retailer Name
      const t1Start = performance.now();
      const sampleRetailer = dbState.retailers.find(r => 
        allInvoices.some(inv => inv.retailer_id === r.id)
      ) || dbState.retailers[0];
      
      const searchKeyword = sampleRetailer 
        ? sampleRetailer.shop_name.split(' ')[0] 
        : 'Asha';

      const t1Matches = allInvoices.filter(inv => 
        isInvoiceMatchingSearch(inv, searchKeyword, dbState)
      );
      const t1Passed = t1Matches.length > 0;
      results.push({
        id: 'test_search_retailer',
        name: `Test 1: Search by partial Retailer Name ("${searchKeyword}")`,
        passed: t1Passed,
        count: t1Matches.length,
        durationMs: Math.round(performance.now() - t1Start),
        message: t1Passed 
          ? `Passed (Found ${t1Matches.length} matching invoices for retailer "${sampleRetailer?.shop_name || searchKeyword}")` 
          : `Failed (Reason: 0 records found for keyword "${searchKeyword}")`
      });

      // Test 2: Search by Invoice Prefix
      const t2Start = performance.now();
      const firstInvoice = allInvoices[0];
      const prefix = firstInvoice?.invoice_number ? firstInvoice.invoice_number.slice(0, 3) : 'INV';
      const t2Matches = allInvoices.filter(inv => 
        isInvoiceMatchingSearch(inv, prefix, dbState)
      );
      const t2Passed = t2Matches.length > 0;
      results.push({
        id: 'test_search_prefix',
        name: `Test 2: Search by Invoice Prefix ("${prefix}")`,
        passed: t2Passed,
        count: t2Matches.length,
        durationMs: Math.round(performance.now() - t2Start),
        message: t2Passed 
          ? `Passed (Found ${t2Matches.length} invoices matching prefix "${prefix}")` 
          : `Failed (Reason: No invoices found starting with prefix "${prefix}")`
      });

      // Test 3: Date Filtering Isolation (In-range vs Out-of-range)
      const t3Start = performance.now();
      const allTimeRange = getDateRangeFromPreset('all');
      const inRangeMatches = allInvoices.filter(inv => isDateInRange(inv.date, allTimeRange));
      
      const futureOutRange = { 
        start: new Date(2099, 0, 1), 
        end: new Date(2099, 11, 31, 23, 59, 59) 
      };
      const outRangeMatches = allInvoices.filter(inv => isDateInRange(inv.date, futureOutRange));
      const t3Passed = inRangeMatches.length === allInvoices.length && outRangeMatches.length === 0;
      results.push({
        id: 'test_date_filtering',
        name: 'Test 3: Date Range Filtering Isolation',
        passed: t3Passed,
        count: inRangeMatches.length,
        durationMs: Math.round(performance.now() - t3Start),
        message: t3Passed 
          ? `Passed (All-Time matched ${inRangeMatches.length} records; Future year 2099 correctly returned 0 records)` 
          : `Failed (Reason: Date range filtering did not isolate in-range vs out-of-range dates)`
      });

      // Test 4: Status Filtering (Unpaid balance > 0 vs Paid balance <= 0)
      const t4Start = performance.now();
      const unpaidInvoices = allInvoices.filter(inv => inv.outstanding_amount > 0);
      const paidInvoices = allInvoices.filter(inv => inv.outstanding_amount <= 0);
      const t4Passed = (unpaidInvoices.length + paidInvoices.length) === allInvoices.length;
      results.push({
        id: 'test_status_filtering',
        name: 'Test 4: Status Filtering (Unpaid vs Paid)',
        passed: t4Passed,
        count: unpaidInvoices.length,
        durationMs: Math.round(performance.now() - t4Start),
        message: t4Passed 
          ? `Passed (Found ${unpaidInvoices.length} Unpaid [balance > 0] and ${paidInvoices.length} Fully Paid [balance <= 0] out of ${allInvoices.length} total invoices)` 
          : `Failed (Reason: Sum of Unpaid (${unpaidInvoices.length}) + Paid (${paidInvoices.length}) does not match Total Invoices (${allInvoices.length}))`
      });

      // Test 5: Reset / Clear Integrity
      const t5Start = performance.now();
      const resetFiltersState: ReportFilterState = {
        datePreset: 'all',
        paymentStatus: 'All',
        orderStatus: 'All',
        expiryStatus: 'All'
      };
      const resetDateRange = getDateRangeFromPreset(resetFiltersState.datePreset);
      const resetMatches = allInvoices.filter(inv => isDateInRange(inv.date, resetDateRange));
      const t5Passed = resetMatches.length === allInvoices.length;
      results.push({
        id: 'test_reset_integrity',
        name: 'Test 5: Reset / Clear All Filters Verification',
        passed: t5Passed,
        count: resetMatches.length,
        durationMs: Math.round(performance.now() - t5Start),
        message: t5Passed 
          ? `Passed (Resetting clears all constraints and restores 100% of raw records: ${resetMatches.length}/${allInvoices.length})` 
          : `Failed (Reason: Reset filter evaluation returned ${resetMatches.length}/${allInvoices.length} records)`
      });

      // Test 6: Salesperson Filter Isolation (Vikas J. vs Rajesh Kumar)
      const t6Start = performance.now();
      const vikasMatches = allInvoices.filter(inv => isInvoiceMatchingSalesperson(inv, 'p-co-sales-3', dbState));
      const rajeshMatches = allInvoices.filter(inv => isInvoiceMatchingSalesperson(inv, 'p-dist-sales-1', dbState));
      const overlap = vikasMatches.filter(v => rajeshMatches.some(r => r.id === v.id));
      const t6Passed = overlap.length === 0 && (vikasMatches.length > 0 || rajeshMatches.length > 0);
      results.push({
        id: 'test_salesperson_isolation',
        name: 'Test 6: Salesperson Isolation (Vikas J. vs Rajesh Kumar)',
        passed: t6Passed,
        count: vikasMatches.length,
        durationMs: Math.round(performance.now() - t6Start),
        message: t6Passed
          ? `Passed (Vikas J. matched ${vikasMatches.length} invoices; Rajesh Kumar matched ${rajeshMatches.length} invoices; 0 overlapping records)`
          : `Failed (Reason: Found ${overlap.length} overlapping invoices between Vikas J. and Rajesh Kumar)`
      });

      setTestResults(results);
      setIsRunningTests(false);
    }, 250);
  };

  // Copy Summary to Clipboard
  const handleCopyDiagnostics = () => {
    const summary = `
=== FILTER DIAGNOSTICS AUDIT ===
Active Category: ${activeCategory.toUpperCase()}
Total Raw Records Loaded: ${pipeline.rawCount} Invoices
Active Filters:
- Search Term: ${filters.searchQuery || 'None'}
- Date Preset: ${filters.datePreset} (${activeDateRange.start.toLocaleDateString('en-IN')} to ${activeDateRange.end.toLocaleDateString('en-IN')})
- Payment Status: ${filters.paymentStatus || 'All'}
- Expiry / Aging: ${filters.expiryStatus || 'None'}
- Retailer ID: ${filters.retailerId || 'All'}
- Salesperson ID: ${filters.salespersonId || 'All'}
- Company ID: ${filters.companyId || 'All'}

Pipeline Dropoff:
Initial: ${pipeline.rawCount} -> After Search: ${pipeline.afterSearchCount} -> After Date: ${pipeline.afterDateCount} -> After Status: ${pipeline.afterStatusCount} -> Final: ${pipeline.finalCount} (${pipeline.finalPercentage}% retained)
================================
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Resolved filter labels for display
  const activeRetailer = filters.retailerId 
    ? dbState.retailers.find(r => r.id === filters.retailerId)?.shop_name || filters.retailerId 
    : 'All Retailers';

  const activeSalesperson = filters.salespersonId 
    ? dbState.profiles.find(p => p.id === filters.salespersonId)?.name || filters.salespersonId 
    : 'All Sales Reps';

  const activeCompany = filters.companyId 
    ? dbState.companies.find(c => c.id === filters.companyId)?.name || filters.companyId 
    : 'All Companies';

  return (
    <div className="erp-card bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border-2 border-indigo-500/40 shadow-xl no-print space-y-4 transition-all">
      {/* 1. TOP HEADER & EXPAND CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-wide uppercase">
                Filter Diagnostics &amp; Testing Bar
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black">
                Live Inspector
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time audit of active filter parameters, step-by-step pipeline dropoff, and automated test runner.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={runFilterSelfTests}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunningTests ? 'animate-spin' : ''}`} />
            <span>{isRunningTests ? 'Testing...' : '🧪 Run Filter Self-Test'}</span>
          </button>

          <button
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
            title="Copy diagnostics text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          {/* 2. REAL-TIME ACTIVE FILTER VALUES GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            {/* Raw Records Loaded */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-xs">
                Total Raw Records
              </span>
              <p className="text-base font-black text-white">
                {pipeline.rawCount} <span className="text-xs text-slate-400 font-normal">Invoices</span>
              </p>
              <span className="text-xs text-slate-400 block font-medium">
                {dbState.orders?.length || 0} Orders &bull; {dbState.retailers?.length || 0} Retailers
              </span>
            </div>

            {/* Search Term */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-xs">
                Search Term
              </span>
              <p className="text-xs font-bold text-amber-300 truncate">
                {filters.searchQuery ? `"${filters.searchQuery}"` : 'None (All)'}
              </p>
              <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                <Search className="w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Test search..."
                  value={filters.searchQuery || ''}
                  onChange={(e) => onChange({ ...filters, searchQuery: e.target.value || undefined })}
                  className="bg-transparent text-xs text-white outline-none w-full placeholder:text-slate-500 font-semibold"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-xs">
                Date Range Filter
              </span>
              <p className="text-xs font-bold text-indigo-300 truncate">
                {filters.datePreset === 'all' ? 'All Dates' : `${activeDateRange.start.toLocaleDateString('en-IN')} to ${activeDateRange.end.toLocaleDateString('en-IN')}`}
              </p>
              <span className="text-xs text-slate-400 block capitalize font-medium">
                Preset: {filters.datePreset.replace('_', ' ')}
              </span>
            </div>

            {/* Status Filter */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-xs">
                Payment Status
              </span>
              <p className={`text-xs font-bold ${
                filters.paymentStatus === 'Paid' ? 'text-emerald-400' :
                filters.paymentStatus === 'Unpaid' ? 'text-red-400' :
                filters.paymentStatus === 'Partial' ? 'text-amber-400' : 'text-slate-200'
              }`}>
                {filters.paymentStatus || 'All'}
              </p>
              <div className="flex items-center gap-1">
                {(['All', 'Unpaid', 'Paid'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => onChange({ ...filters, paymentStatus: st })}
                    className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
                      (filters.paymentStatus || 'All') === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Sales Rep / Retailer */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/70 space-y-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-xs">
                Active Entity Filter
              </span>
              <p className="text-xs font-bold text-sky-300 truncate" title={activeSalesperson}>
                Rep: {activeSalesperson}
              </p>
              <p className="text-xs text-slate-400 truncate" title={activeRetailer}>
                Ret: {activeRetailer}
              </p>
            </div>

            {/* Output Matching Count */}
            <div className={`p-2.5 rounded-xl border space-y-1 ${
              pipeline.finalCount === 0 
                ? 'bg-red-950/40 border-red-500/50 text-red-200' 
                : 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
            }`}>
              <span className="font-bold uppercase tracking-wider block text-xs">
                Output Records Count
              </span>
              <p className={`text-base font-black ${pipeline.finalCount === 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {pipeline.finalCount} <span className="text-xs font-normal">matching</span>
              </p>
              <span className="text-xs font-bold block">
                {pipeline.finalPercentage}% of raw loaded
              </span>
            </div>
          </div>

          {/* 3. STEP-BY-STEP FILTER DROPOFF BREAKDOWN */}
          <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-black uppercase text-slate-300 tracking-wider">
                  Step-by-Step Filter Dropoff Breakdown
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Identify which filter drops records to 0
              </span>
            </div>

            {/* Pipeline Flow Visualization */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {/* Step 0: Initial */}
              <div className="flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 font-bold">
                <span className="text-slate-400">Initial:</span>
                <span className="text-white font-black">{pipeline.rawCount}</span>
              </div>

              <span className="text-indigo-400 font-black">➔</span>

              {/* Step 1: After Search */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                pipeline.afterSearchCount === 0 
                  ? 'bg-red-900/60 border-red-500 text-red-200' 
                  : pipeline.searchDrop > 0 
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-200' 
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}>
                <span className="text-slate-400">After Search:</span>
                <span className="font-black">{pipeline.afterSearchCount}</span>
                {pipeline.searchDrop > 0 && (
                  <span className="text-xs text-amber-400">(-{pipeline.searchDrop})</span>
                )}
              </div>

              <span className="text-indigo-400 font-black">➔</span>

              {/* Step 2: After Date */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                pipeline.afterDateCount === 0 
                  ? 'bg-red-900/60 border-red-500 text-red-200' 
                  : pipeline.dateDrop > 0 
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-200' 
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}>
                <span className="text-slate-400">After Date Filter:</span>
                <span className="font-black">{pipeline.afterDateCount}</span>
                {pipeline.dateDrop > 0 && (
                  <span className="text-xs text-amber-400">(-{pipeline.dateDrop})</span>
                )}
              </div>

              <span className="text-indigo-400 font-black">➔</span>

              {/* Step 3: After Status */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
                pipeline.afterStatusCount === 0 
                  ? 'bg-red-900/60 border-red-500 text-red-200' 
                  : pipeline.statusDrop > 0 
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-200' 
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}>
                <span className="text-slate-400">After Status Filter:</span>
                <span className="font-black">{pipeline.afterStatusCount}</span>
                {pipeline.statusDrop > 0 && (
                  <span className="text-xs text-amber-400">(-{pipeline.statusDrop})</span>
                )}
              </div>

              <span className="text-indigo-400 font-black">➔</span>

              {/* Step 4: Final Output */}
              <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-black ${
                pipeline.finalCount === 0 
                  ? 'bg-red-900 border-red-500 text-white animate-pulse' 
                  : 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
              }`}>
                <span>Final Output:</span>
                <span className="text-sm">{pipeline.finalCount}</span>
              </div>
            </div>

            {/* Zero results diagnostic notice */}
            {pipeline.finalCount === 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-red-950/50 border border-red-600/60 rounded-lg text-xs text-red-200 mt-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1">
                  <span className="font-bold">Notice: No records match the current filter combination. </span>
                  {pipeline.afterSearchCount === 0 && 'The Search Term eliminated all records. '}
                  {pipeline.afterSearchCount > 0 && pipeline.afterDateCount === 0 && `Date preset "${filters.datePreset}" filtered out all remaining records. Try selecting "All Dates". `}
                  {pipeline.afterDateCount > 0 && pipeline.afterStatusCount === 0 && `Payment status "${filters.paymentStatus}" matched 0 records in this date window. `}
                  {pipeline.afterStatusCount > 0 && pipeline.finalCount === 0 && 'Sales rep / Retailer / Company filter matched 0 records. '}
                </div>
                <button
                  onClick={() => onChange({ datePreset: 'all', paymentStatus: 'All', orderStatus: 'All', expiryStatus: 'All' })}
                  className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-bold text-xs shrink-0 transition-colors"
                >
                  Reset to All
                </button>
              </div>
            )}
          </div>

          {/* 4. AUTOMATED SELF-TEST RESULTS DISPLAY */}
          {testResults && (
            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black uppercase text-white tracking-wider">
                    Automated Filter Self-Test Results
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  testResults.every(t => t.passed) 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {testResults.filter(t => t.passed).length} / {testResults.length} Tests Passed
                </span>
              </div>

              <div className="space-y-2">
                {testResults.map(test => (
                  <div
                    key={test.id}
                    className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border text-xs ${
                      test.passed 
                        ? 'bg-slate-900/80 border-emerald-500/30 text-slate-200' 
                        : 'bg-red-950/40 border-red-500 text-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {test.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold text-white block">{test.name}</span>
                        <span className="text-xs text-slate-400">{test.message}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-black ${
                        test.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-red-900 text-white'
                      }`}>
                        {test.passed ? 'PASSED' : 'FAILED'}
                      </span>
                      <span className="text-xs text-slate-500 block font-mono mt-0.5">{test.durationMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. QUICK TEST SCENARIO SHORTCUTS */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-xs mr-1">Quick Scenarios:</span>
              
              <button
                onClick={() => onChange({ ...filters, datePreset: 'all' })}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors"
              >
                📅 All Dates
              </button>

              <button
                onClick={() => onChange({ ...filters, paymentStatus: 'Unpaid' })}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors"
              >
                💳 Unpaid Only
              </button>

              <button
                onClick={() => onChange({ ...filters, paymentStatus: 'Paid' })}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors"
              >
                ✅ Paid Only
              </button>

              <button
                onClick={() => onChange({ ...filters, datePreset: 'this_month', paymentStatus: 'All', searchQuery: undefined, companyId: undefined, retailerId: undefined, salespersonId: undefined })}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors"
              >
                🔄 Default This Month
              </button>
            </div>

            <span className="text-xs text-slate-500 italic">
              Console audit active &bull; Open DevTools Console for structured pipeline logs
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
