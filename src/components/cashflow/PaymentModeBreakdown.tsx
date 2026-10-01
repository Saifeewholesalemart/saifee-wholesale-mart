'use client';

import React from 'react';
import { CashFlowPaymentMode } from '@/lib/db';
import { Banknote, Smartphone, Building2, FileCheck2, MoreHorizontal, Layers } from 'lucide-react';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (isNeg ? '-₹' : '₹') + formatted;
}

export interface ModeBreakdownData {
  mode: CashFlowPaymentMode;
  inAmount: number;
  outAmount: number;
  netAmount: number;
  count: number;
}

interface PaymentModeBreakdownProps {
  breakdown: ModeBreakdownData[];
  selectedMode: string; // 'all' or specific mode
  onSelectMode: (mode: string) => void;
}

const MODE_ICONS: Record<CashFlowPaymentMode, React.ElementType> = {
  'Cash': Banknote,
  'UPI': Smartphone,
  'Bank Transfer': Building2,
  'Cheque': FileCheck2,
  'Other': MoreHorizontal
};

const MODE_COLORS: Record<CashFlowPaymentMode, { bg: string; text: string; border: string; activeBorder: string; activeBg: string }> = {
  'Cash': {
    bg: 'bg-emerald-50/50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/60',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-400/30',
    activeBg: 'bg-emerald-50'
  },
  'UPI': {
    bg: 'bg-indigo-50/50',
    text: 'text-indigo-700',
    border: 'border-indigo-200/60',
    activeBorder: 'border-indigo-500 ring-2 ring-indigo-400/30',
    activeBg: 'bg-indigo-50'
  },
  'Bank Transfer': {
    bg: 'bg-blue-50/50',
    text: 'text-blue-700',
    border: 'border-blue-200/60',
    activeBorder: 'border-blue-500 ring-2 ring-blue-400/30',
    activeBg: 'bg-blue-50'
  },
  'Cheque': {
    bg: 'bg-amber-50/50',
    text: 'text-amber-800',
    border: 'border-amber-200/60',
    activeBorder: 'border-amber-500 ring-2 ring-amber-400/30',
    activeBg: 'bg-amber-50'
  },
  'Other': {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    activeBorder: 'border-slate-500 ring-2 ring-slate-400/30',
    activeBg: 'bg-slate-100'
  }
};

export default function PaymentModeBreakdown({
  breakdown,
  selectedMode,
  onSelectMode
}: PaymentModeBreakdownProps) {
  const totalIn = breakdown.reduce((s, b) => s + b.inAmount, 0);
  const totalOut = breakdown.reduce((s, b) => s + b.outAmount, 0);
  const totalNet = totalIn - totalOut;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Payment Mode Movement Breakdown</span>
        </h4>
        <span className="text-[11px] text-slate-400 font-medium">
          Click a mode to filter transactions
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        
        {/* All Modes Button */}
        <button
          type="button"
          onClick={() => onSelectMode('all')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            selectedMode === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-400/30'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase">All Modes</span>
            <Layers className={`w-3.5 h-3.5 ${selectedMode === 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-sm font-black tracking-tight ${selectedMode === 'all' ? 'text-white' : 'text-slate-900'}`}>
              Net: {formatINR(totalNet)}
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1 opacity-80">
              <span className={selectedMode === 'all' ? 'text-emerald-300' : 'text-emerald-700'}>In: {formatINR(totalIn)}</span>
              <span className={selectedMode === 'all' ? 'text-rose-300' : 'text-rose-700'}>Out: {formatINR(totalOut)}</span>
            </div>
          </div>
        </button>

        {/* 5 Payment Modes */}
        {breakdown.map(item => {
          const Icon = MODE_ICONS[item.mode] || MoreHorizontal;
          const color = MODE_COLORS[item.mode] || MODE_COLORS.Other;
          const isSelected = selectedMode === item.mode;

          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => onSelectMode(isSelected ? 'all' : item.mode)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `${color.activeBg} ${color.activeBorder} shadow-md`
                  : `bg-white hover:${color.bg} ${color.border} shadow-2xs`
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-extrabold truncate ${color.text}`}>
                  {item.mode}
                </span>
                <Icon className={`w-3.5 h-3.5 ${color.text}`} />
              </div>

              <div className="mt-2">
                <div className="text-sm font-black text-slate-900 tracking-tight">
                  Net: {formatINR(item.netAmount)}
                </div>
                <div className="flex items-center justify-between text-[10px] mt-1 text-slate-500">
                  <span className="text-emerald-700 font-semibold">+{formatINR(item.inAmount)}</span>
                  <span className="text-rose-600 font-semibold">-{formatINR(item.outAmount)}</span>
                </div>
              </div>
            </button>
          );
        })}

      </div>
    </div>
  );
}
