'use client';

/**
 * The note written by the shop or the salesperson when the order was placed.
 * Shown to the packer, the biller and the admin wherever the order appears.
 */

import React from 'react';
import type { Order } from '@/lib/db';

export function orderNoteOf(order: Partial<Order> | null | undefined): string {
  return String((order as any)?.order_notes || '').trim();
}

export default function OrderNotes({ orders, compact = false, className = '' }: {
  orders: (Partial<Order> | null | undefined)[];
  compact?: boolean;
  className?: string;
}) {
  const list = orders
    .filter(Boolean)
    .map(o => ({ number: (o as Order).order_number, note: orderNoteOf(o) }))
    .filter(x => x.note);
  if (list.length === 0) return null;
  const many = list.length > 1;

  if (compact) {
    return (
      <div className={`text-[13px] text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 ${className}`}>
        {list.map(x => (
          <div key={x.number} className="break-words">
            <span className="font-bold">Note{many ? ` (${x.number})` : ''}:</span> {x.note}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div role="note" className={`bg-amber-50 border border-amber-300 rounded-lg px-3.5 py-2.5 text-amber-950 ${className}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-amber-800 mb-0.5">Note from the order</div>
      {list.map(x => (
        <p key={x.number} className="text-sm whitespace-pre-wrap break-words">
          {many && <span className="font-mono font-bold">{x.number}: </span>}{x.note}
        </p>
      ))}
    </div>
  );
}
