'use client';

import React from 'react';
import { TrendingUp, BarChart3, PieChart as PieIcon, DollarSign, Users, Package, AlertCircle } from 'lucide-react';
import { formatINR } from '@/lib/reportsEngine';

interface TrendPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface BarItem {
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
}

interface AgingBucket {
  label: string;
  amount: number;
  color: string;
}

// ----------------------------------------------------
// 1. SALES TREND CHART (Area / Line with Hover Points)
// ----------------------------------------------------
export function SalesTrendChart({
  title = 'Sales Trend',
  subtitle,
  points
}: {
  title?: string;
  subtitle?: string;
  points: TrendPoint[];
}) {
  if (points.length === 0) {
    return (
      <div className="erp-card bg-white p-6 text-center text-slate-400 text-xs">
        No sales trend data available for selected date range.
      </div>
    );
  }

  const maxValue = Math.max(...points.map(p => p.value), 1);
  const height = 180;
  const width = 500;
  const paddingX = 40;
  const paddingY = 25;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const coords = points.map((p, i) => {
    const x = paddingX + (i / Math.max(points.length - 1, 1)) * chartWidth;
    const y = height - paddingY - (p.value / maxValue) * chartHeight;
    return { x, y, point: p };
  });

  const pathD = coords.reduce((acc, c, i) => {
    return i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
  }, '');

  const areaD = coords.length > 0 
    ? `${pathD} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`
    : '';

  return (
    <div className="erp-card bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>{title}</span>
          </h3>
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
          Peak: {formatINR(maxValue)}
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = height - paddingY - ratio * chartHeight;
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text x={paddingX - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">
                  {Math.round(maxValue * ratio / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#salesTrendGrad)" />

          {/* Line Stroke */}
          <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {coords.map((c, i) => (
            <g key={i} className="group cursor-pointer">
              <circle
                cx={c.x}
                cy={c.y}
                r="4"
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth="2.5"
                className="transition-all group-hover:r-6"
              />
              {/* Tooltip on hover */}
              <title>{`${c.point.label}: ${formatINR(c.point.value)}`}</title>
            </g>
          ))}
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between px-8 text-xs text-slate-600 font-semibold mt-1">
          {points.length <= 10 ? (
            points.map((p, i) => <span key={i}>{p.label}</span>)
          ) : (
            <>
              <span>{points[0]?.label}</span>
              <span>{points[Math.floor(points.length / 2)]?.label}</span>
              <span>{points[points.length - 1]?.label}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. HORIZONTAL BAR RANKING (Company / Brand / Product)
// ----------------------------------------------------
export function HorizontalBarChart({
  title,
  subtitle,
  items,
  isCurrency = true,
  maxBars = 8
}: {
  title: string;
  subtitle?: string;
  items: BarItem[];
  isCurrency?: boolean;
  maxBars?: number;
}) {
  const displayItems = items.slice(0, maxBars);
  const maxVal = Math.max(...displayItems.map(i => i.value), 1);
  const totalVal = displayItems.reduce((sum, i) => sum + i.value, 0);

  if (displayItems.length === 0) {
    return (
      <div className="erp-card bg-white p-6 text-center text-slate-400 text-xs">
        No ranking data found.
      </div>
    );
  }

  const defaultColors = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#3b82f6', '#14b8a6'
  ];

  return (
    <div className="erp-card bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>{title}</span>
          </h3>
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-xs font-bold text-slate-600">
          Total: {isCurrency ? formatINR(totalVal) : totalVal.toLocaleString('en-IN')}
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {displayItems.map((item, idx) => {
          const pct = Math.max((item.value / maxVal) * 100, 2);
          const sharePct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;
          const color = item.color || defaultColors[idx % defaultColors.length];

          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-800 truncate max-w-[220px]">
                  {item.label}
                  {item.subLabel && <span className="text-xs text-slate-500 font-normal ml-1">({item.subLabel})</span>}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-bold">
                    {isCurrency ? formatINR(item.value) : item.value.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 w-12 text-right">
                    {sharePct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. AGING BUCKETS VISUALIZER (Accounts Receivable Aging)
// ----------------------------------------------------
export function AgingBucketsChart({
  title = 'Outstanding Aging Distribution',
  buckets
}: {
  title?: string;
  buckets: AgingBucket[];
}) {
  const totalAmount = buckets.reduce((sum, b) => sum + b.amount, 0);

  if (totalAmount === 0) {
    return (
      <div className="erp-card bg-white p-6 text-center text-slate-400 text-xs">
        No active aged receivables found.
      </div>
    );
  }

  return (
    <div className="erp-card bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-red-600" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Categorized by overdue payment days</p>
        </div>
        <span className="text-xs font-extrabold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-md border border-red-100">
          Total: {formatINR(totalAmount)}
        </span>
      </div>

      {/* Stacked Percentage Bar */}
      <div className="w-full bg-slate-100 h-4 rounded-lg overflow-hidden flex shadow-2xs">
        {buckets.map((b, idx) => {
          const pct = (b.amount / totalAmount) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={idx}
              style={{ width: `${pct}%`, backgroundColor: b.color }}
              title={`${b.label}: ${formatINR(b.amount)} (${pct.toFixed(1)}%)`}
              className="h-full transition-all duration-300"
            />
          );
        })}
      </div>

      {/* Legend & Amounts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {buckets.map((b, idx) => {
          const share = (b.amount / totalAmount) * 100;
          return (
            <div key={idx} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="text-xs font-bold text-slate-700 truncate">{b.label}</span>
              </div>
              <p className="text-xs font-extrabold text-slate-900">{formatINR(b.amount)}</p>
              <p className="text-xs font-medium text-slate-500">{share.toFixed(1)}% share</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
