'use client';

import React from 'react';
import { Calendar, RefreshCw, X, ChevronDown } from 'lucide-react';

export type DatePreset = 
  | 'today' 
  | 'yesterday' 
  | 'this_week' 
  | 'this_month' 
  | 'last_30_days' 
  | 'current_fy' 
  | 'custom'
  | 'all';

export interface DateRange {
  preset: DatePreset;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  label: string;
}

// Helper to format Date to YYYY-MM-DD in local time
export function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format YYYY-MM-DD to DD/MM/YYYY
export function formatDateToDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

// Get Dynamic Financial Year label (e.g. "FY 2026-27")
export function getFinancialYearLabel(date: Date = new Date()): string {
  const currentYear = date.getFullYear();
  const fyStartYear = date.getMonth() >= 3 ? currentYear : currentYear - 1;
  const fyEndYearShort = (fyStartYear + 1).toString().slice(-2);
  return `FY ${fyStartYear}-${fyEndYearShort}`;
}

// Compute Date Range from Preset
export function computeDateRange(preset: DatePreset, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const todayStr = formatDateToISO(now);

  switch (preset) {
    case 'today': {
      return {
        preset: 'today',
        startDate: todayStr,
        endDate: todayStr,
        label: 'Today'
      };
    }
    case 'yesterday': {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDateToISO(yest);
      return {
        preset: 'yesterday',
        startDate: yestStr,
        endDate: yestStr,
        label: 'Yesterday'
      };
    }
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.getFullYear(), now.getMonth(), diff);
      return {
        preset: 'this_week',
        startDate: formatDateToISO(monday),
        endDate: todayStr,
        label: 'This Week'
      };
    }
    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        preset: 'this_month',
        startDate: formatDateToISO(firstDay),
        endDate: todayStr,
        label: 'This Month'
      };
    }
    case 'last_30_days': {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 29);
      return {
        preset: 'last_30_days',
        startDate: formatDateToISO(past30),
        endDate: todayStr,
        label: 'Last 30 Days'
      };
    }
    case 'current_fy': {
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      const start = new Date(fyStartYear, 3, 1); // Apr 1
      const end = new Date(fyStartYear + 1, 2, 31); // Mar 31
      return {
        preset: 'current_fy',
        startDate: formatDateToISO(start),
        endDate: formatDateToISO(end),
        label: getFinancialYearLabel(now)
      };
    }
    case 'all': {
      return {
        preset: 'all',
        startDate: '2020-01-01',
        endDate: formatDateToISO(new Date(now.getFullYear() + 1, 11, 31)),
        label: 'All Time'
      };
    }
    case 'custom':
    default: {
      return {
        preset: 'custom',
        startDate: customStart || formatDateToISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: customEnd || todayStr,
        label: 'Custom Range'
      };
    }
  }
}

interface DateRangeFilterBarProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  defaultPreset?: DatePreset;
  className?: string;
  showCustomInputs?: boolean;
}

export default function DateRangeFilterBar({
  range,
  onChange,
  defaultPreset = 'this_month',
  className = '',
  showCustomInputs = true
}: DateRangeFilterBarProps) {
  const currentFY = getFinancialYearLabel();

  const presets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'current_fy', label: `Financial Year (${currentFY})` },
    { id: 'custom', label: 'Custom Range' },
    { id: 'all', label: 'All Time' }
  ];

  const handleSelectPreset = (preset: DatePreset) => {
    if (preset === 'custom') {
      onChange({
        preset: 'custom',
        startDate: range.startDate,
        endDate: range.endDate,
        label: 'Custom Range'
      });
    } else {
      const computed = computeDateRange(preset);
      onChange(computed);
    }
  };

  const handleCustomStartDateChange = (val: string) => {
    onChange({
      preset: 'custom',
      startDate: val,
      endDate: range.endDate,
      label: 'Custom Range'
    });
  };

  const handleCustomEndDateChange = (val: string) => {
    onChange({
      preset: 'custom',
      startDate: range.startDate,
      endDate: val,
      label: 'Custom Range'
    });
  };

  const handleReset = () => {
    const computed = computeDateRange(defaultPreset);
    onChange(computed);
  };

  // Calculate day difference
  const getDayCount = (): number => {
    if (!range.startDate || !range.endDate) return 0;
    const s = new Date(range.startDate);
    const e = new Date(range.endDate);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const dayCount = getDayCount();

  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3 ${className} no-print`}>
      {/* Top Header & Presets Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Label & Active Period Tag */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-wider border border-indigo-100">
            <Calendar className="w-3.5 h-3.5" />
            <span>Date Range Filter:</span>
          </div>
          <span className="text-xs font-bold text-slate-800">
            {formatDateToDisplay(range.startDate)} &rarr; {formatDateToDisplay(range.endDate)}
          </span>
          {range.preset !== 'all' && dayCount > 0 && (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              ({dayCount} {dayCount === 1 ? 'day' : 'days'})
            </span>
          )}
        </div>

        {/* Reset Button */}
        <div className="flex items-center gap-2">
          {range.preset !== defaultPreset && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
              title="Reset to default filter"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* 1-Click Preset Buttons Strip */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        {presets.map(p => {
          const isSelected = range.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs scale-102 ring-2 ring-indigo-300'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Input Fields (Visible always or when Custom Range is active) */}
      {showCustomInputs && (
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs bg-slate-50/70 p-2.5 rounded-xl">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-600 uppercase text-[11px] tracking-wider">From Date:</span>
              <input
                type="date"
                value={range.startDate}
                onChange={(e) => handleCustomStartDateChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-mono font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-300 focus:outline-none"
              />
            </div>

            <span className="text-slate-400 font-bold hidden sm:inline">&rarr;</span>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-600 uppercase text-[11px] tracking-wider">To Date:</span>
              <input
                type="date"
                value={range.endDate}
                onChange={(e) => handleCustomEndDateChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-mono font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-100 px-2.5 py-1 rounded-lg">
              Active: <strong>{range.label}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
