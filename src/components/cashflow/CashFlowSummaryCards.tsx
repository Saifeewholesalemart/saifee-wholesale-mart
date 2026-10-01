'use client';

import React from 'react';
import { 
  ArrowDownLeft, ArrowUpRight, Wallet, Scale, 
  HelpCircle, TrendingUp, TrendingDown, ArrowRightLeft, ShieldCheck
} from 'lucide-react';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (isNeg ? '-₹' : '₹') + formatted;
}

interface CashFlowSummaryCardsProps {
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number;
  closingBalance: number;
  dateRangeLabel: string;
}

export default function CashFlowSummaryCards({
  openingBalance,
  totalCashIn,
  totalCashOut,
  netCashFlow,
  closingBalance,
  dateRangeLabel
}: CashFlowSummaryCardsProps) {
  const isNetPositive = netCashFlow >= 0;

  return (
    <div className="space-y-3">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* 1. Opening Balance */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Opening Balance
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 suppressHydrationWarning className="text-xl font-black text-slate-800 tracking-tight">
              {formatINR(openingBalance)}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
              As of period start
            </p>
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300" />
        </div>

        {/* 2. Cash In */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group bg-gradient-to-br from-white via-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Money In (Received)
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-110 transition-transform">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 suppressHydrationWarning className="text-xl font-black text-emerald-600 tracking-tight">
              {formatINR(totalCashIn)}
            </h3>
            <p className="text-[11px] text-emerald-700/70 font-medium mt-0.5 truncate">
              + Inflow in period
            </p>
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* 3. Cash Out */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group bg-gradient-to-br from-white via-white to-rose-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
              Money Out (Paid)
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 suppressHydrationWarning className="text-xl font-black text-rose-600 tracking-tight">
              {formatINR(totalCashOut)}
            </h3>
            <p className="text-[11px] text-rose-700/70 font-medium mt-0.5 truncate">
              - Outflow in period
            </p>
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
        </div>

        {/* 4. Net Cash Flow */}
        <div className={`bg-white rounded-2xl p-4 border shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group ${isNetPositive ? 'border-indigo-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30' : 'border-amber-200/80 bg-gradient-to-br from-white via-white to-amber-50/30'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-extrabold uppercase tracking-wider ${isNetPositive ? 'text-indigo-700' : 'text-amber-800'}`}>
              Net Cash Flow
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${isNetPositive ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'}`}>
              {isNetPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-2.5">
            <h3 suppressHydrationWarning className={`text-xl font-black tracking-tight ${isNetPositive ? 'text-indigo-700' : 'text-amber-700'}`}>
              {formatINR(netCashFlow)}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
              Cash In - Cash Out
            </p>
          </div>
          <div className={`absolute top-0 left-0 right-0 h-1 ${isNetPositive ? 'bg-indigo-600' : 'bg-amber-500'}`} />
        </div>

        {/* 5. Closing Balance */}
        <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group bg-gradient-to-br from-white via-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800">
              Closing Balance
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 group-hover:scale-110 transition-transform">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 suppressHydrationWarning className="text-xl font-black text-blue-700 tracking-tight">
              {formatINR(closingBalance)}
            </h3>
            <p className="text-[11px] text-blue-700/70 font-medium mt-0.5 truncate">
              Opening + Net Flow
            </p>
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
        </div>

      </div>

      {/* Formula helper bar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-[11px] text-slate-600">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700">Financial Formula:</span>
          <span>Opening ({formatINR(openingBalance)})</span>
          <span className="text-emerald-700 font-bold">+ In ({formatINR(totalCashIn)})</span>
          <span className="text-rose-700 font-bold">- Out ({formatINR(totalCashOut)})</span>
          <span>= <strong className="text-blue-800 font-black">Closing ({formatINR(closingBalance)})</strong></span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium italic">
          Active Period: {dateRangeLabel}
        </span>
      </div>
    </div>
  );
}
