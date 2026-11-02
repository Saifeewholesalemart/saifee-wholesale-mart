'use client';

/**
 * Packer screen (simple flow).
 * Orders "To Pack" are grouped by shop: orders of one retailer from any channel
 * (retailer app, salesman, company salesman) are packed together in one go.
 * Walk-in / counter orders stay separate. The packer types the quantity actually packed;
 * anything short stays on the order as a backorder.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useDb } from '@/context/DbContext';
import type { Order } from '@/lib/db';
import { flowOrderStage, flowRemainingQty, flowOrderedQty, flowShopKey, flowChannelLabel, splitBaseQuantity } from '@/lib/db';
import { productLabel, customerName, formatWhen, sortByOrderSort, OrderSort } from './flowUi';
import { CheckCircle2, ChevronLeft, PackageOpen } from 'lucide-react';
import { useUrlStep } from '@/lib/useUrlStep';

type Step = 'list' | 'pack' | 'confirm' | 'done';

/** Batch stock minus pieces packed (not yet billed) on orders outside this group. */
function freeStockExcluding(batches: { product_id: string; quantity: number }[], orders: Order[], exclude: Set<string>) {
  const free: Record<string, number> = {};
  batches.forEach(b => { if ((b.quantity || 0) > 0) free[b.product_id] = (free[b.product_id] || 0) + b.quantity; });
  orders.forEach(o => {
    if (exclude.has(o.id) || !o.flow_ready_to_bill) return;
    (o.items || []).forEach(it => {
      const q = Number(it.flow_packed_qty) || 0;
      if (q > 0) free[it.product_id] = (free[it.product_id] || 0) - q;
    });
  });
  Object.keys(free).forEach(k => { if (free[k] < 0) free[k] = 0; });
  return free;
}

export default function PackerPanel({ compact = false, filter, sort = 'oldest' }: { compact?: boolean; filter?: (o: Order) => boolean; sort?: OrderSort }) {
  const { orders, products, batches, retailers, flowPackOrders } = useDb();
  // Packing screen is kept in the URL (?pack=...) so the phone Back button goes one screen back
  const [packParam, setPackParam] = useUrlStep<string>('pack', '', null);
  const step: Step = !packParam ? 'list' : packParam === 'done' ? 'done' : packParam.startsWith('confirm:') ? 'confirm' : 'pack';
  const openKey = step === 'pack' ? packParam : step === 'confirm' ? packParam.slice('confirm:'.length) : null;
  const cameFromList = useRef(false);
  const goBack = (steps: number, fallback: string) => {
    if (cameFromList.current && typeof window !== 'undefined') window.history.go(-steps);
    else setPackParam(fallback, { replace: true });
  };
  const setStep = (next: Step) => {
    if (next === 'confirm' && openKey) setPackParam(`confirm:${openKey}`);
    else if (next === 'pack' && openKey) { if (step === 'confirm') goBack(1, openKey); else setPackParam(openKey); }
    else if (next === 'done') setPackParam('done', { replace: true });
    else setPackParam('', { replace: true });
  };
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [doneInfo, setDoneInfo] = useState<{ packed: number; backorder: number } | null>(null);

  const freeAll = useMemo(() => freeStockExcluding(batches, orders, new Set()), [batches, orders]);

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders
      .filter(o => flowOrderStage(o, freeAll) === 'to_pack')
      .filter(o => (filter ? filter(o) : true))
      .sort((a, b) => new Date(a.order_date || a.created_at || 0).getTime() - new Date(b.order_date || b.created_at || 0).getTime())
      .forEach(o => {
        const k = flowShopKey(o);
        map.set(k, [...(map.get(k) || []), o]);
      });
    const list = Array.from(map.entries()).map(([key, list]) => ({ key, orders: list }));
    return sortByOrderSort(list, sort, {
      time: g => new Date(g.orders[0].order_date || g.orders[0].created_at || 0).getTime(),
      lines: g => g.orders.reduce((s, o) => s + (o.items || []).filter(it => flowRemainingQty(it) > 0).length, 0),
      amount: g => g.orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
    });
  }, [orders, freeAll, filter, sort]);

  const group = openKey ? groups.find(g => g.key === openKey) || null : null;
  const groupOrders = group?.orders || [];
  const groupIds = useMemo(() => new Set(groupOrders.map(o => o.id)), [groupOrders]);
  const freeForGroup = useMemo(() => freeStockExcluding(batches, orders, groupIds), [batches, orders, groupIds]);

  // One section per order, item lines inside. Stock is shared across the whole shop.
  const sections = useMemo(() => {
    const used: Record<string, number> = {};
    return groupOrders.map(o => ({
      order: o,
      lines: (o.items || [])
        .filter(it => flowRemainingQty(it) > 0)
        .map(it => {
          const product = products.find(p => p.id === it.product_id);
          const remaining = flowRemainingQty(it);
          const stock = Math.max(0, (freeForGroup[it.product_id] || 0) - (used[it.product_id] || 0));
          const raw = qty[it.id] ?? '';
          const n = raw === '' ? null : Number(raw);
          let error = '';
          if (stock > 0 && raw !== '') {
            if (!Number.isInteger(n) || (n as number) < 0) error = 'Enter a whole number';
            else if ((n as number) > stock) error = `Only ${stock} in stock`;
            else if ((n as number) > remaining) error = `Ordered only ${remaining}`;
          }
          const packed = stock === 0 || error || n === null ? 0 : (n as number);
          used[it.product_id] = (used[it.product_id] || 0) + packed;
          const unitsPerPack = it.units_per_trading_unit || product?.units_per_box_carton || 1;
          const split = unitsPerPack > 1 && packed > 0 ? splitBaseQuantity(packed, unitsPerPack) : null;
          return {
            id: it.id,
            name: productLabel(product, (it as any).product_name || 'Item'),
            ordered: remaining,
            wasOrdered: flowOrderedQty(it),
            stock,
            raw,
            error,
            packed,
            decided: stock === 0 || (raw !== '' && !error),
            splitText: split ? `${split.cartonQty} carton${split.cartonQty === 1 ? '' : 's'}${split.looseQty ? ` + ${split.looseQty} pcs` : ''}` : ''
          };
        })
    }));
  }, [groupOrders, products, freeForGroup, qty]);

  const lines = sections.flatMap(s => s.lines);
  const orderedTotal = lines.reduce((s, l) => s + l.ordered, 0);
  const packedTotal = lines.reduce((s, l) => s + l.packed, 0);
  const backorderTotal = orderedTotal - packedTotal;
  const anyError = lines.some(l => l.error);
  const anyEmpty = lines.some(l => l.stock > 0 && l.raw === '');
  const blockReason = anyError ? 'Fix the highlighted quantities.' : anyEmpty ? 'Enter the packed quantity for every item in stock (0 is allowed).' : '';

  const openGroup = (key: string) => {
    setQty({});
    setSaveError('');
    cameFromList.current = true;
    setPackParam(key);
  };

  // Same as the phone Back button: list ← pack ← confirm (done replaces confirm)
  const backToList = () => {
    setSaveError('');
    goBack(step === 'pack' ? 1 : 2, '');
    cameFromList.current = false;
  };

  const confirmPacking = () => {
    if (!group) return;
    try {
      const res = flowPackOrders(sections.map(s => ({
        orderId: s.order.id,
        packedQty: Object.fromEntries(s.lines.map(l => [l.id, l.packed]))
      })));
      setDoneInfo({ packed: res.packedPieces, backorder: res.backorderPieces });
      setStep('done');
    } catch (e: any) {
      setSaveError(e?.message || 'Could not save packing.');
      setStep('pack');
    }
  };

  const wrap = compact ? 'max-w-xl mx-auto w-full' : 'max-w-2xl mx-auto w-full';
  const shopName = groupOrders[0] ? customerName(groupOrders[0], retailers) : '';

  // ---------------------------------------------------------------- DONE
  if (step === 'done') {
    return (
      <div className={`${wrap} flex flex-col gap-4`}>
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center text-center gap-3">
          <CheckCircle2 className="w-14 h-14 text-green-700" aria-hidden="true" />
          {doneInfo && doneInfo.packed > 0 ? (
            <>
              <strong className="text-xl text-slate-900">Sent to billing</strong>
              <span className="text-slate-600">
                {doneInfo.packed} pcs sent to the biller.
                {doneInfo.backorder > 0 ? ` ${doneInfo.backorder} pcs saved as backorder.` : ''}
              </span>
            </>
          ) : (
            <>
              <strong className="text-xl text-slate-900">Saved as backorder</strong>
              <span className="text-slate-600">Nothing was packed. The orders will come back here when stock arrives.</span>
            </>
          )}
          <button type="button" onClick={backToList} className="min-h-12 px-6 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold">
            Next shop
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- LIST
  if (step === 'list' || !group) {
    return (
      <div className={`${wrap} flex flex-col gap-3`}>
        <p className="text-sm text-slate-600">
          Shops to pack ({groups.length}) · {groups.reduce((s, g) => s + g.orders.length, 0)} orders
        </p>
        {groups.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600">
            <PackageOpen className="w-10 h-10 mx-auto text-slate-400 mb-2" aria-hidden="true" />
            Nothing to pack right now.
          </div>
        )}
        {groups.map(g => {
          const items = g.orders.flatMap(o => (o.items || []).filter(it => flowRemainingQty(it) > 0));
          const pcs = items.reduce((s, it) => s + flowRemainingQty(it), 0);
          const backorderBack = g.orders.some(o => !!o.flow_pack_attempted_at || (o.items || []).some(it => (it.fulfilled_qty ?? 0) > 0));
          const channels = Array.from(new Set(g.orders.map(o => flowChannelLabel(o))));
          return (
            <div key={g.key} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between gap-2 items-start">
                <strong className="text-base text-slate-900">{customerName(g.orders[0], retailers)}</strong>
                <span className="text-xs text-slate-700 font-semibold bg-slate-100 rounded px-2 py-0.5 whitespace-nowrap">
                  {g.orders.length} order{g.orders.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-center text-sm text-slate-600">
                <span>{items.length} item{items.length === 1 ? '' : 's'} · {pcs} pcs</span>
                <span>· {channels.join(', ')}</span>
                <span>· since {formatWhen(g.orders[0].order_date || g.orders[0].created_at)}</span>
                {backorderBack && (
                  <span className="text-xs font-semibold text-amber-900 bg-amber-100 rounded px-2 py-0.5">Backorder — stock arrived</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => openGroup(g.key)}
                className="min-h-12 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-base"
              >
                {g.orders.length > 1 ? `Pack all ${g.orders.length} orders` : 'Start packing'}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------- HEADER
  const header = (
    <div className="flex items-center justify-between gap-2 bg-slate-900 text-white rounded-xl px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs text-slate-300">
          {groupOrders.length === 1 ? groupOrders[0].order_number : `${groupOrders.length} orders`}
        </div>
        <strong className="text-base truncate block">{shopName}</strong>
      </div>
      <button
        type="button"
        onClick={backToList}
        className="min-h-11 px-3 rounded-lg border border-slate-600 text-sm font-semibold flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
      </button>
    </div>
  );

  const orderHeading = (o: Order) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 mt-1">
      <span className="font-mono font-bold text-slate-800">{o.order_number}</span>
      <span className="font-semibold text-indigo-800 bg-indigo-50 rounded px-1.5 py-0.5">{flowChannelLabel(o)}</span>
      {o.created_by && <span>by {o.created_by}</span>}
      <span>· {formatWhen(o.order_date || o.created_at)}</span>
    </div>
  );

  // ---------------------------------------------------------------- CONFIRM
  if (step === 'confirm') {
    return (
      <div className={`${wrap} flex flex-col gap-3`}>
        {header}
        <strong className="text-lg text-slate-900">Check before sending to billing</strong>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
          {sections.map(s => (
            <div key={s.order.id} className="flex flex-col gap-2">
              {groupOrders.length > 1 && orderHeading(s.order)}
              {s.lines.map(l => (
                <div key={l.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-800">{l.name}</span>
                  <strong className={`whitespace-nowrap ${l.packed === l.ordered ? 'text-green-800' : 'text-amber-800'}`}>
                    {l.packed === l.ordered
                      ? `Packed ${l.packed}`
                      : l.packed === 0
                        ? `Backorder ${l.ordered}`
                        : `Packed ${l.packed}, backorder ${l.ordered - l.packed}`}
                  </strong>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          Packed items go to the biller{groupOrders.length > 1 ? ' as one bill for this shop' : ''}. Short quantity stays on the order as a backorder.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setStep('pack')} className="min-h-12 rounded-lg border border-slate-300 bg-white font-bold text-slate-800">
            Edit
          </button>
          <button type="button" onClick={confirmPacking} className="min-h-12 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold">
            Confirm
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- PACK
  return (
    <div className={`${wrap} flex flex-col gap-3`}>
      {header}
      <p className="text-sm text-slate-600">Type the quantity you actually packed. 0 is allowed.</p>
      {saveError && (
        <div role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>
      )}
      {sections.map(s => (
        <div key={s.order.id} className="flex flex-col gap-2">
          {orderHeading(s.order)}
          {s.lines.map(l => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <strong className="text-[15px] leading-snug text-slate-900">{l.name}</strong>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-600">{l.ordered !== l.wasOrdered ? 'Pending' : 'Ordered'}</span>
                  <strong className="text-lg text-slate-900">{l.ordered}</strong>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-600">In stock</span>
                  <strong className={`text-lg ${l.stock === 0 ? 'text-red-700' : 'text-slate-900'}`}>{l.stock}</strong>
                </div>
                {l.stock > 0 ? (
                  <div className="flex flex-col">
                    <label htmlFor={`pack-${l.id}`} className="text-xs text-slate-600">Packed</label>
                    <input
                      id={`pack-${l.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      value={l.raw}
                      onChange={e => setQty(prev => ({ ...prev, [l.id]: e.target.value }))}
                      className={`min-h-11 w-full rounded-lg border-2 px-2 text-lg font-bold text-slate-900 ${l.error ? 'border-red-600' : 'border-slate-300 focus:border-indigo-600'} outline-none`}
                    />
                  </div>
                ) : (
                  <span className="text-sm font-bold text-red-800 bg-red-50 rounded-lg py-2.5 text-center">Out of stock</span>
                )}
              </div>
              {l.error && <span className="text-sm font-semibold text-red-700">{l.error}</span>}
              {!l.error && l.splitText && <span className="text-xs text-slate-600">= {l.splitText}</span>}
              {l.decided && l.ordered - l.packed > 0 && (
                <span className="text-sm text-amber-800">{l.ordered - l.packed} pcs will go to backorder</span>
              )}
            </div>
          ))}
        </div>
      ))}
      <div className="sticky bottom-0 bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
        <div className="flex justify-between text-sm">
          <span>Packed <strong>{packedTotal} / {orderedTotal}</strong> pcs</span>
          <span className="font-semibold text-amber-800">{backorderTotal > 0 ? `${backorderTotal} pcs to backorder` : 'Nothing short'}</span>
        </div>
        {blockReason && <span className="text-xs text-red-700">{blockReason}</span>}
        <button
          type="button"
          disabled={!!blockReason}
          onClick={() => { if (!blockReason) setStep('confirm'); }}
          className="min-h-12 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-400 text-white font-bold text-base"
        >
          Packing Done
        </button>
      </div>
    </div>
  );
}
