'use client';

/**
 * Searchable party picker (replaces a long <select> when there are hundreds of parties).
 * Type any words of the name, code, city, mobile or owner. Arrow keys + Enter work.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { matchWords } from '@/lib/searchWords';

export interface PartyPickerItem {
  id: string;
  shop_name?: string;
  owner_name?: string;
  retailer_code?: string;
  city?: string;
  mobile?: string;
  outstanding?: number;
}

interface Props {
  parties: PartyPickerItem[];
  value: string;
  onChange: (id: string) => void;
  /** Shown when nothing is chosen, e.g. "Choose party" */
  placeholder?: string;
  /** Adds a first row such as "All Parties" that sets `allValue` */
  allLabel?: string;
  allValue?: string;
  /** Show the outstanding balance next to each party */
  showBalance?: boolean;
  className?: string;
  disabled?: boolean;
}

const MAX_SHOWN = 60;
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function PartyPicker({
  parties, value, onChange, placeholder = 'Choose party', allLabel, allValue = 'ALL',
  showBalance = false, className = '', disabled = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = parties.find(p => p.id === value);
  const label = selected
    ? `${selected.shop_name || 'Party'}${selected.retailer_code ? ` (${selected.retailer_code})` : ''}`
    : (allLabel && value === allValue ? allLabel : '');

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return parties;
    const found = parties.filter(p => matchWords(q, p.shop_name, p.owner_name, p.retailer_code, p.city, p.mobile));
    // Parties whose own name matches come first (typing "jain" should not list every shop in Ujjain first)
    const byName = found.filter(p => matchWords(q, p.shop_name));
    return byName.length === found.length ? found : [...byName, ...found.filter(p => !matchWords(q, p.shop_name))];
  }, [parties, query]);

  const shown = matches.slice(0, MAX_SHOWN);
  const rows: { id: string; title: string; meta: string; balance?: number }[] = [
    ...(allLabel && !query.trim() ? [{ id: allValue, title: allLabel, meta: '' }] : []),
    ...shown.map(p => ({
      id: p.id,
      title: p.shop_name || 'Party',
      meta: [p.retailer_code, p.city].filter(Boolean).join(' · '),
      balance: showBalance ? Number(p.outstanding || 0) : undefined
    }))
  ];

  useEffect(() => { setIdx(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx(i => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (open && rows[idx]) { e.preventDefault(); choose(rows[idx].id); } }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-500 focus-within:bg-white">
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          disabled={disabled}
          value={open ? query : label}
          placeholder={open && label ? label : placeholder}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent outline-none text-xs font-extrabold text-slate-900 placeholder:font-semibold placeholder:text-slate-400"
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
        />
        {value && value !== allValue && !disabled ? (
          <button type="button" aria-label="Clear party" onClick={() => { onChange(allLabel ? allValue : ''); setQuery(''); }}
            className="p-0.5 rounded hover:bg-slate-200 text-slate-400">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
      </div>

      {open && (
        <div ref={listRef} role="listbox"
          className="absolute z-50 mt-1 w-full min-w-[260px] max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
          {rows.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500 font-semibold">No party matches “{query}”.</div>
          ) : rows.map((r, i) => (
            <button key={r.id} type="button" data-i={i} role="option" aria-selected={r.id === value}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(r.id)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0 ${i === idx ? 'bg-indigo-50' : ''} ${r.id === value ? 'font-black' : ''}`}>
              <span className="min-w-0">
                <span className="block text-xs font-extrabold text-slate-900 truncate">{r.title}</span>
                {r.meta && <span className="block text-[10px] text-slate-500 font-mono truncate">{r.meta}</span>}
              </span>
              {r.balance !== undefined && (
                <span className={`text-[11px] font-bold flex-shrink-0 ${r.balance > 0 ? 'text-emerald-700' : r.balance < 0 ? 'text-red-700' : 'text-slate-400'}`}>
                  {inr(r.balance)}
                </span>
              )}
            </button>
          ))}
          {matches.length > MAX_SHOWN && (
            <div className="px-3 py-2 text-[10px] text-slate-500 font-semibold bg-slate-50 sticky bottom-0">
              Showing {MAX_SHOWN} of {matches.length}. Type more to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
