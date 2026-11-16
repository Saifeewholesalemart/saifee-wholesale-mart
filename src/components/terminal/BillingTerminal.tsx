'use client';

/**
 * Billing terminal (replaces the old Fast Trade Terminal).
 * One screen for new bills and for bills that were already made:
 *  - bill tabs (several bills open at once)
 *  - one search box for name / code / barcode
 *  - spreadsheet-like grid: every value is a cell, keyboard driven
 *  - last 5 rates (this shop / any shop) under the active rate cell
 *  - add a new item to the item list from here and put it on the bill
 * Stock may go negative (goods can be on the shelf before the purchase is entered).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDb } from '@/context/DbContext';
import type { Invoice, InvoiceItem, Product, Retailer, Order } from '@/lib/db';
import { isWalkInRetailerId, flowItemRate, flowRemainingQty } from '@/lib/db';
import { hasWords } from '@/lib/searchWords';
import { recentBillingRates, formatINR } from '@/components/flow/flowUi';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import InvoiceAuditTrailModal from '@/components/InvoiceAuditTrailModal';
import BillsRegister from './BillsRegister';
import {
  TerminalLine, num, r2, lineAmount, syncDiscount, billTotals,
  splitBillDiscount, discountPerPiece, newLineKey
} from './billingTerminalMath';

type PayMode = 'Cash' | 'UPI' | 'Credit';
type Col = 'qty' | 'rate' | 'discPct' | 'discAmt' | 'gst';
const COLS: Col[] = ['qty', 'rate', 'discPct', 'discAmt', 'gst'];

interface BillTab {
  key: string;
  /** new = counter bill, saved = a bill already made, order = bill for packed orders */
  kind: 'new' | 'saved' | 'order';
  invoiceId?: string;
  /** packed orders this bill is made for (kind 'order') */
  orderIds?: string[];
  customerId: string;
  lines: TerminalLine[];
  billDisc: string;
  payMode: PayMode;
  received: string;
  note: string;
  dirty: boolean;
}

const STORAGE_KEY = 'fmcg_billing_terminal_tabs_v1';
const tabKey = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const blankTab = (): BillTab => ({ key: tabKey(), kind: 'new', customerId: '', lines: [], billDisc: '', payMode: 'Cash', received: '', note: '', dirty: false });

const cellBase = 'w-full h-11 px-1.5 text-right tabular-nums bg-white outline-none border-0 focus:ring-2 focus:ring-inset focus:ring-blue-700 focus:font-bold';

/** True on a phone-sized screen (the terminal then shows each item as a card). */
function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return phone;
}

function lineFromProduct(p: Product, qty = 1): TerminalLine {
  const units = Math.max(1, Number(p.units_per_box_carton) || 1);
  const rate = Number(p.selling_price) || 0;
  return {
    key: newLineKey(),
    productId: p.id,
    name: p.name,
    mrp: Number(p.mrp) || 0,
    unit: units > 1 ? 'Pcs' : (p.base_unit === 'Packet' || !p.base_unit ? 'Pcs' : String(p.base_unit)),
    unitsPerPack: units,
    qty: String(qty),
    rate: rate.toFixed(2),
    discPct: '0',
    discAmt: '0.00',
    discMode: 'pct',
    gst: String(Number(p.gst_percent) || 0),
    purchaseRate: Number(p.purchase_price) || 0,
    hsn: p.hsn,
    packing: p.pack_size
  };
}

function linesFromInvoice(inv: Invoice, productById: Map<string, Product>): TerminalLine[] {
  return (inv.items || []).map(it => {
    const p = productById.get(it.product_id);
    const units = Math.max(1, Number(it.units_per_trading_unit || it.units_per_box_carton || p?.units_per_box_carton) || 1);
    const qty = Number(it.base_qty ?? it.quantity) || 0;
    const rate = units > 1 ? Number(it.loose_rate ?? (Number(it.carton_rate ?? it.rate) / units)) : Number(it.carton_rate ?? it.rate);
    const taxable = Number(it.taxable_value) || 0;
    const tax = (Number(it.cgst) || 0) + (Number(it.sgst) || 0) + (Number(it.igst) || 0);
    const gst = (it as any).gst_percent ?? (taxable > 0 ? Math.round(tax / taxable * 100) : (p?.gst_percent ?? 0));
    const discAmt = Number(it.discount) || 0;
    const base: TerminalLine = {
      key: newLineKey(),
      lineId: it.id,
      productId: it.product_id,
      name: p?.name || (it as any).product_name || 'Item',
      mrp: Number(it.mrp ?? p?.mrp) || 0,
      unit: 'Pcs',
      unitsPerPack: units,
      qty: String(qty),
      rate: (Number(rate) || 0).toFixed(2),
      discPct: '0',
      discAmt: discAmt.toFixed(2),
      discMode: 'amt',
      gst: String(Number(gst) || 0),
      purchaseRate: Number(it.purchase_rate ?? p?.purchase_price) || 0,
      batchId: it.batch_id,
      batchNumber: it.batch_number,
      hsn: it.hsn,
      packing: it.packing
    };
    return syncDiscount(base);
  });
}

/** Bill lines from what the packer packed on these orders (rate per piece). */
function linesFromOrders(list: Order[], productById: Map<string, Product>): TerminalLine[] {
  return list.flatMap(o => (o.items || [])
    .filter(it => (Number(it.flow_packed_qty) || 0) > 0)
    .map(it => {
      const p = productById.get(it.product_id);
      const units = Math.max(1, Number(it.units_per_trading_unit || p?.units_per_box_carton) || 1);
      const rate = flowItemRate(it, p) / units;
      const gst = (p?.gst_percent !== undefined && p?.gst_percent !== null) ? Number(p.gst_percent) : (Number(it.gst_percent) || 0);
      return {
        key: newLineKey(),
        orderItemId: it.id,
        productId: it.product_id,
        name: p?.name || (it as any).product_name || 'Item',
        mrp: Number((it as any).selected_mrp ?? (it as any).mrp ?? p?.mrp) || 0,
        unit: 'Pcs',
        unitsPerPack: units,
        qty: String(Math.floor(Number(it.flow_packed_qty) || 0)),
        rate: (Math.round(rate * 100) / 100).toFixed(2),
        discPct: '0',
        discAmt: '0.00',
        discMode: 'pct' as const,
        gst: String(gst),
        purchaseRate: Number((it as any).purchase_rate ?? p?.purchase_price) || 0,
        hsn: p?.hsn,
        packing: p?.pack_size
      };
    }));
}

export default function BillingTerminal() {
  const {
    products, retailers, invoices, batches, activeCompanyId, currentUser, orders,
    postSalesInvoiceAtomic, updateInvoice, payInvoice, createFullProduct, activeCompany,
    flowBillShopFromTerminal
  } = useDb() as any;
  const searchParams = useSearchParams();
  const isPhone = useIsPhone();
  /** phone: the "last rates" sheet is open for this row */
  const [rateSheetRow, setRateSheetRow] = useState<number | null>(null);

  // ------------------------------------------------------------------ tabs
  const [tabs, setTabs] = useState<BillTab[]>(() => [blankTab()]);
  const [activeKey, setActiveKey] = useState<string>(() => tabs[0].key);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as BillTab[];
        if (Array.isArray(saved) && saved.length > 0) {
          setTabs(saved);
          setActiveKey(saved[0].key);
        }
      }
    } catch { /* storage not available */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs.filter(t => t.kind === 'new' && (t.lines.length > 0 || t.customerId)))); } catch { /* ignore */ }
  }, [tabs]);

  // 'bills' = the list of all bills (old Invoices page); 'bill' = the open bill tab
  const [view, setView] = useState<'bill' | 'bills'>(() => (searchParams?.get('view') === 'bills' ? 'bills' : 'bill'));
  const [historyFor, setHistoryFor] = useState<Invoice | null>(null);
  const tab = tabs.find(t => t.key === activeKey) || tabs[0];
  const patchTab = useCallback((patch: Partial<BillTab> | ((t: BillTab) => Partial<BillTab>)) => {
    setTabs(prev => prev.map(t => t.key === activeKey ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch), dirty: true } : t));
  }, [activeKey]);

  // ------------------------------------------------------------------ lookups
  const productById = useMemo(() => new Map<string, Product>((products as Product[]).map(p => [p.id, p])), [products]);
  const stockById = useMemo(() => {
    const m = new Map<string, number>();
    (batches as any[]).forEach(b => m.set(b.product_id, (m.get(b.product_id) || 0) + (Number(b.quantity) || 0)));
    return m;
  }, [batches]);
  const walkInId = `ret-walkin-${activeCompanyId || 'biz-saifee'}`;
  const shops = useMemo(() => (retailers as Retailer[])
    .filter(r => !isWalkInRetailerId(r.id) && r.active !== false && (r as any).approval_status !== 'rejected')
    .sort((a, b) => (a.shop_name || '').localeCompare(b.shop_name || '')), [retailers]);
  const customer = (retailers as Retailer[]).find(r => r.id === tab.customerId);
  const customerName = isWalkInRetailerId(tab.customerId) ? 'Counter / Walk-in' : (customer?.shop_name || '');
  const savedInvoice: Invoice | undefined = tab.kind === 'saved' ? (invoices as Invoice[]).find(i => i.id === tab.invoiceId) : undefined;

  // ------------------------------------------------------------------ open a saved bill
  const openInvoice = useCallback((inv: Invoice) => {
    const existing = tabs.find(t => t.kind === 'saved' && t.invoiceId === inv.id);
    setView('bill');
    if (existing) { setActiveKey(existing.key); return; }
    const t: BillTab = {
      key: tabKey(), kind: 'saved', invoiceId: inv.id, customerId: inv.retailer_id,
      lines: linesFromInvoice(inv, productById), billDisc: '', payMode: 'Cash', received: '', note: inv.notes || '', dirty: false
    };
    setTabs(prev => [...prev, t]);
    setActiveKey(t.key);
  }, [tabs, productById]);

  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current) return;
    const id = searchParams?.get('invoice');
    if (!id) return;
    const inv = (invoices as Invoice[]).find(i => i.id === id) || (invoices as Invoice[]).find(i => i.invoice_number.toLowerCase() === id.toLowerCase());
    if (!inv) return;
    openedFromUrl.current = true;
    openInvoice(inv);
  }, [searchParams, invoices, openInvoice]);

  // ------------------------------------------------------------------ bill packed orders (?orders=id1,id2)
  const openedOrdersFromUrl = useRef(false);
  useEffect(() => {
    if (openedOrdersFromUrl.current) return;
    const raw = searchParams?.get('orders');
    if (!raw) return;
    const ids = raw.split(',').map(x => x.trim()).filter(Boolean);
    const list = ids.map(id => (orders as Order[]).find(o => o.id === id)).filter(Boolean) as Order[];
    if (list.length === 0) return;
    openedOrdersFromUrl.current = true;
    const existing = tabs.find(t => t.kind === 'order' && (t.orderIds || []).join(',') === list.map(o => o.id).join(','));
    setView('bill');
    if (existing) { setActiveKey(existing.key); return; }
    const t: BillTab = {
      key: tabKey(), kind: 'order', orderIds: list.map(o => o.id), customerId: list[0].retailer_id,
      lines: linesFromOrders(list, productById), billDisc: '',
      payMode: isWalkInRetailerId(list[0].retailer_id) ? 'Cash' : 'Credit', received: '', note: '', dirty: false
    };
    setTabs(prev => [...prev.filter(x => !(x.kind === 'new' && x.lines.length === 0 && !x.customerId)), t]);
    setActiveKey(t.key);
  }, [searchParams, orders, tabs, productById]);
  const tabOrders: Order[] = tab.kind === 'order'
    ? (tab.orderIds || []).map(id => (orders as Order[]).find(o => o.id === id)).filter(Boolean) as Order[]
    : [];
  const shortOnOrders = tabOrders.flatMap(o => (o.items || [])
    .map(it => ({ it, short: flowRemainingQty(it) - (Number(it.flow_packed_qty) || 0) }))
    .filter(x => x.short > 0)
    .map(x => `${productById.get(x.it.product_id)?.name || (x.it as any).product_name || 'Item'} – ${x.short} pcs`));

  // ------------------------------------------------------------------ messages
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const say = (kind: 'ok' | 'err', text: string) => { setMsg({ kind, text }); if (kind === 'ok') setTimeout(() => setMsg(m => (m?.text === text ? null : m)), 5000); };
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // ------------------------------------------------------------------ item search
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIdx, setSearchIdx] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as Product[];
    const lower = q.toLowerCase();
    const exact: Product[] = [];
    const rest: Product[] = [];
    for (const p of products as Product[]) {
      if (p.active === false) continue;
      if ([p.barcode, p.sku, p.product_code].some(c => c && String(c).toLowerCase() === lower)) { exact.push(p); continue; }
      if (hasWords(`${p.name || ''} ${p.product_code || ''} ${p.sku || ''} ${p.barcode || ''} ${p.brand || ''}`, q)) {
        rest.push(p);
        if (rest.length >= 30) break;
      }
    }
    return [...exact, ...rest].slice(0, 30);
  }, [query, products]);

  // ------------------------------------------------------------------ grid
  const [active, setActive] = useState<{ row: number; col: Col } | null>(null);
  const [histIdx, setHistIdx] = useState(-1);
  const focusCell = (row: number, col: Col) => {
    setTimeout(() => {
      const el = document.getElementById(`bt-cell-${row}-${col}`) as HTMLInputElement | null;
      if (el) { el.focus(); el.select(); }
    }, 0);
  };

  const setLine = (row: number, patch: Partial<TerminalLine>) => {
    patchTab(t => ({
      lines: t.lines.map((l, i) => {
        if (i !== row) return l;
        const next = { ...l, ...patch };
        return syncDiscount(next);
      })
    }));
  };

  const addProduct = (p: Product, qty = 1) => {
    const idx = tab.lines.findIndex(l => l.productId === p.id);
    if (idx >= 0) {
      setLine(idx, { qty: String(num(tab.lines[idx].qty) + qty) });
      focusCell(idx, 'qty');
    } else {
      const row = tab.lines.length;
      patchTab(t => ({ lines: [...t.lines, lineFromProduct(p, qty)] }));
      focusCell(row, 'qty');
    }
    setQuery('');
    setSearchOpen(false);
    setSearchIdx(0);
  };

  const removeRow = (row: number) => {
    patchTab(t => ({ lines: t.lines.filter((_, i) => i !== row) }));
    setActive(null);
  };

  const moveFrom = (row: number, col: Col, dir: 1 | -1) => {
    const ci = COLS.indexOf(col) + dir;
    if (ci >= 0 && ci < COLS.length) return focusCell(row, COLS[ci]);
    if (dir === 1) {
      if (row + 1 < tab.lines.length) return focusCell(row + 1, COLS[0]);
      return searchRef.current?.focus();
    }
    if (row > 0) focusCell(row - 1, COLS[COLS.length - 1]);
  };

  // last rates for the active rate cell
  const activeLine = active ? tab.lines[active.row] : undefined;
  const history = useMemo(() => {
    if (!active || active.col !== 'rate' || !activeLine) return null;
    const pastInvoices = (invoices as Invoice[]).filter(i => i.id !== tab.invoiceId);
    return {
      shop: tab.customerId ? recentBillingRates(pastInvoices, retailers, activeLine.productId, { retailerId: tab.customerId, limit: 5 }) : [],
      any: recentBillingRates(pastInvoices, retailers, activeLine.productId, { limit: 5 })
    };
  }, [active, activeLine, invoices, retailers, tab.customerId, tab.invoiceId]);
  const historyList = history ? [...history.shop, ...history.any] : [];

  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: Col) => {
    const input = e.currentTarget;
    if (col === 'rate' && historyList.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setHistIdx(i => Math.max(-1, Math.min(historyList.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
      return;
    }
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (col === 'rate' && histIdx >= 0 && historyList[histIdx]) setLine(row, { rate: historyList[histIdx].rate.toFixed(2) });
      setHistIdx(-1);
      moveFrom(row, col, 1);
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      moveFrom(row, col, -1);
    } else if (e.key === 'ArrowDown' && row + 1 < tab.lines.length) {
      e.preventDefault(); focusCell(row + 1, col);
    } else if (e.key === 'ArrowUp' && row > 0) {
      e.preventDefault(); focusCell(row - 1, col);
    } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
      e.preventDefault(); moveFrom(row, col, 1);
    } else if (e.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault(); moveFrom(row, col, -1);
    } else if (e.key === 'Escape') {
      setHistIdx(-1);
      input.blur();
    }
  };

  // ------------------------------------------------------------------ totals
  const totals = useMemo(() => billTotals(tab.lines, num(tab.billDisc)), [tab.lines, tab.billDisc]);
  const oldBalance = Number(customer?.outstanding) || 0;
  const creditLimit = Number(customer?.credit_limit) || 0;
  const received = tab.received.trim() === '' ? (tab.payMode === 'Credit' ? 0 : totals.total) : num(tab.received);
  const change = tab.payMode === 'Credit' ? 0 : r2(Math.max(0, received - totals.total));
  const paidNow = tab.payMode === 'Credit' ? 0 : Math.min(received, totals.total);
  const balanceAfter = r2(oldBalance + totals.total - paidNow);
  const overLimit = !isWalkInRetailerId(tab.customerId) && creditLimit > 0 && balanceAfter > creditLimit;

  // ------------------------------------------------------------------ customer picker
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const custRef = useRef<HTMLInputElement>(null);
  const custMatches = useMemo(() => {
    const q = custQuery.trim();
    const list = q ? shops.filter(r => hasWords(`${r.shop_name} ${r.owner_name || ''} ${r.mobile || ''} ${r.city || ''} ${r.retailer_code || ''}`, q)) : shops;
    return list.slice(0, 20);
  }, [custQuery, shops]);
  const pickCustomer = (id: string) => {
    patchTab({ customerId: id, payMode: isWalkInRetailerId(id) ? 'Cash' : tab.payMode });
    setCustQuery('');
    setCustOpen(false);
    searchRef.current?.focus();
  };

  // ------------------------------------------------------------------ open bill box
  const [billQuery, setBillQuery] = useState('');
  const billMatches = useMemo(() => {
    const q = billQuery.trim();
    if (!q) return [] as Invoice[];
    return (invoices as Invoice[])
      .filter(inv => hasWords(`${inv.invoice_number} ${(retailers as Retailer[]).find(r => r.id === inv.retailer_id)?.shop_name || ''}`, q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [billQuery, invoices, retailers]);
  const billRef = useRef<HTMLInputElement>(null);

  // ------------------------------------------------------------------ new item
  const [newItem, setNewItem] = useState<null | Record<string, string>>(null);
  const openNewItem = () => {
    setNewItem({ name: query.trim(), mrp: '', rate: '', purchase: '', gst: '0', hsn: '', code: /^\d{6,}$/.test(query.trim()) ? query.trim() : '', category: '', shelf: '', qty: '1' });
    setSearchOpen(false);
  };
  const defaultCompanyId = useMemo(() => {
    const count = new Map<string, number>();
    (products as Product[]).forEach(p => p.company_id && count.set(p.company_id, (count.get(p.company_id) || 0) + 1));
    let best = ''; let n = -1;
    count.forEach((v, k) => { if (v > n) { best = k; n = v; } });
    return best;
  }, [products]);
  const saveNewItem = (addToBill: boolean) => {
    if (!newItem) return;
    const name = newItem.name.trim();
    const mrp = num(newItem.mrp);
    const rate = num(newItem.rate);
    const qty = Math.floor(num(newItem.qty));
    if (!name) return say('err', 'Enter the item name.');
    if (mrp <= 0) return say('err', 'Enter the MRP.');
    if (rate <= 0) return say('err', 'Enter the sale rate.');
    if (addToBill && qty <= 0) return say('err', 'Enter the quantity for this bill.');
    const lower = name.toLowerCase();
    if ((products as Product[]).some(p => (p.name || '').trim().toLowerCase() === lower && Number(p.mrp) === mrp)) {
      return say('err', 'An item with this name and MRP already exists. Search for it instead.');
    }
    try {
      const shelf = Math.floor(num(newItem.shelf));
      const p: Product = createFullProduct({
        name,
        company_id: defaultCompanyId,
        category: newItem.category.trim() || undefined,
        pack_size: '1',
        trading_unit: 'Carton',
        base_unit: 'Packet',
        units_per_box_carton: 1,
        pieces_per_carton: 1,
        mrp,
        selling_price: rate,
        purchase_price: num(newItem.purchase),
        gst_percent: num(newItem.gst),
        hsn: newItem.hsn.trim(),
        barcode: newItem.code.trim() || undefined,
        sku: newItem.code.trim() || undefined,
        active: true,
        add_initial_stock: shelf > 0,
        initial_stock_qty: shelf > 0 ? shelf : undefined,
        initial_purchase_rate: num(newItem.purchase) || undefined
      });
      setNewItem(null);
      if (addToBill) addProduct(p, qty);
      say('ok', `${p.name} saved to the item list${addToBill ? ' and added to this bill' : ''}.`);
    } catch (e: any) {
      say('err', e?.message || 'Could not save the item.');
    }
  };

  // ------------------------------------------------------------------ save
  const buildLines = () => tab.lines.filter(l => l.productId && num(l.qty) > 0);
  const validate = (): string => {
    const used = buildLines();
    if (!tab.customerId) return 'Choose the customer (F11).';
    if (used.length === 0) return 'Add at least one item.';
    if (tab.lines.some(l => num(l.qty) < 0 || !Number.isInteger(num(l.qty)))) return 'Quantity must be a whole number.';
    if (used.some(l => num(l.rate) < 0)) return 'A rate cannot be negative.';
    if (tab.kind !== 'saved' && tab.payMode === 'Credit' && isWalkInRetailerId(tab.customerId)) return 'A walk-in customer cannot buy on credit. Choose the shop or take Cash/UPI.';
    return '';
  };

  const saveBill = (print: boolean) => {
    const err = validate();
    if (err) return say('err', err);
    const used = buildLines();
    const shares = splitBillDiscount(used, totals.billDiscount);
    const user = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    try {
      if (tab.kind === 'order') {
        const res = flowBillShopFromTerminal(tab.orderIds || [], {
          lines: used.map(l => ({
            orderItemId: l.orderItemId,
            productId: l.productId,
            name: l.name,
            qty: num(l.qty),
            rate: num(l.rate),
            discountPerPiece: discountPerPiece(l, shares.get(l.key) || 0),
            gst: num(l.gst),
            unitsPerPack: l.unitsPerPack,
            mrp: l.mrp,
            purchaseRate: l.purchaseRate,
            hsn: l.hsn,
            packing: l.packing
          })),
          paymentMode: tab.payMode,
          paidAmount: paidNow,
          notes: tab.note || undefined
        });
        const inv: Invoice = res.invoice;
        // the same tab now shows the bill that was made, so it can be printed or changed again
        setTabs(prev => prev.map(t => t.key === tab.key ? {
          ...t, kind: 'saved', invoiceId: inv.id, orderIds: undefined,
          lines: linesFromInvoice(inv, productById), billDisc: '', received: '', dirty: false
        } : t));
        setActive(null);
        say('ok', `Bill ${inv.invoice_number} saved · ${formatINR(inv.grand_total)}${change > 0 ? ` · return ₹${change}` : ''}${res.shortfall ? ` · ${res.shortfall}` : ''}`);
        if (print) setPreviewInvoice(inv);
      } else if (tab.kind === 'new') {
        const res = postSalesInvoiceAtomic({
          retailer_id: tab.customerId,
          payment_mode: tab.payMode,
          paid_amount: paidNow,
          notes: tab.note || undefined,
          admin_user: user,
          user_id: currentUser?.id,
          items: used.map(l => {
            const d = discountPerPiece(l, shares.get(l.key) || 0);
            return {
              product_id: l.productId,
              carton_qty: 0,
              loose_qty: num(l.qty),
              base_qty: num(l.qty),
              units_per_trading_unit: l.unitsPerPack,
              carton_rate: num(l.rate),
              loose_rate: num(l.rate),
              carton_discount: d,
              loose_discount: d,
              gst_percent: num(l.gst),
              mrp: l.mrp,
              purchase_rate: l.purchaseRate,
              hsn: l.hsn,
              packing: l.packing
            };
          })
        });
        const inv: Invoice = res.invoice;
        setTabs(prev => prev.map(t => t.key === tab.key ? { ...blankTab(), key: t.key } : t));
        setActive(null);
        say('ok', `Bill ${inv.invoice_number} saved · ${formatINR(inv.grand_total)}${change > 0 ? ` · return ₹${change}` : ''}`);
        if (print) setPreviewInvoice(inv);
        setTimeout(() => custRef.current?.focus(), 0);
      } else if (savedInvoice) {
        const items: InvoiceItem[] = used.map(l => {
          const d = discountPerPiece(l, shares.get(l.key) || 0);
          return {
            id: l.lineId || `inv-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            invoice_id: savedInvoice.id,
            product_id: l.productId,
            product_name: l.name,
            hsn: l.hsn || '',
            packing: l.packing || '',
            quantity: num(l.qty),
            carton_qty: 0,
            loose_qty: num(l.qty),
            base_qty: num(l.qty),
            trading_unit: 'Piece',
            base_unit: 'Piece',
            units_per_trading_unit: l.unitsPerPack,
            units_per_box_carton: l.unitsPerPack,
            rate: num(l.rate),
            carton_rate: num(l.rate),
            loose_rate: num(l.rate),
            discount: r2(d * num(l.qty)),
            carton_discount: d,
            loose_discount: d,
            gst_percent: num(l.gst),
            taxable_value: 0, cgst: 0, sgst: 0, igst: 0, total_amount: 0,
            batch_id: l.batchId,
            batch_number: l.batchNumber,
            mrp: l.mrp,
            purchase_rate: l.purchaseRate,
            manual_billing_rate: num(l.rate),
            manual_rate_applied: true
          } as any;
        });
        const res = updateInvoice(savedInvoice.id, {
          date: savedInvoice.date,
          place_of_supply: savedInvoice.place_of_supply,
          items,
          paid_amount: savedInvoice.paid_amount
        }, 'Edited in the billing terminal', user);
        const inv: Invoice | undefined = res?.invoice;
        if (!inv) throw new Error('The bill could not be saved.');
        setTabs(prev => prev.map(t => t.key === tab.key ? { ...t, lines: linesFromInvoice(inv, productById), billDisc: '', dirty: false } : t));
        say('ok', `Bill ${inv.invoice_number} saved · now ${formatINR(inv.grand_total)}`);
        if (print) setPreviewInvoice(inv);
      }
    } catch (e: any) {
      say('err', e?.message || 'The bill could not be saved.');
    }
  };

  const receiveOnSaved = () => {
    if (!savedInvoice) return;
    const amt = num(tab.received);
    if (amt <= 0) return say('err', 'Enter the amount received.');
    try {
      payInvoice(savedInvoice.retailer_id, amt, tab.payMode === 'UPI' ? 'UPI' : 'Cash', undefined, `Received in billing terminal for ${savedInvoice.invoice_number}`);
      patchTab({ received: '' });
      say('ok', `₹${amt} received from ${customerName}.`);
    } catch (e: any) {
      say('err', e?.message || 'Payment could not be saved.');
    }
  };

  // ------------------------------------------------------------------ tabs actions
  const newTab = () => {
    const t = blankTab();
    setTabs(prev => [...prev, t]);
    setActiveKey(t.key);
    setActive(null);
    setView('bill');
    setTimeout(() => custRef.current?.focus(), 0);
  };
  const closeTab = (key: string) => {
    const t = tabs.find(x => x.key === key);
    if (t && t.dirty && (t.lines.length > 0) && !window.confirm('Close this bill? Changes not saved will be lost.')) return;
    const rest = tabs.filter(x => x.key !== key);
    if (rest.length === 0) {
      const b = blankTab();
      setTabs([b]); setActiveKey(b.key);
    } else {
      setTabs(rest);
      if (key === activeKey) setActiveKey(rest[rest.length - 1].key);
    }
    setActive(null);
  };

  // ------------------------------------------------------------------ keyboard
  const billDiscRef = useRef<HTMLInputElement>(null);
  const receivedRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const [showKeys] = useState(true);
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (newItem) {
      if (e.key === 'Escape') { e.preventDefault(); setNewItem(null); }
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); setView(v => (v === 'bills' ? 'bill' : 'bills')); return; }
    if (view === 'bills' && !(ctrl && (e.key === 't' || e.key === 'T'))) return;
    const row = active?.row ?? (tab.lines.length - 1);
    const k = e.key;
    const handled = () => e.preventDefault();
    if (k === 'F1') { handled(); searchRef.current?.focus(); }
    else if (k === 'F2' && row >= 0) { handled(); focusCell(row, 'qty'); }
    else if (k === 'F3' && row >= 0) { handled(); focusCell(row, 'discPct'); }
    else if (k === 'F4' && active) { handled(); removeRow(active.row); }
    else if (k === 'F6' && row >= 0) { handled(); focusCell(row, 'rate'); }
    else if (k === 'F7') { handled(); openNewItem(); }
    else if (k === 'F8') { handled(); billDiscRef.current?.focus(); billDiscRef.current?.select(); }
    else if (k === 'F9') { handled(); newTab(); }
    else if (k === 'F10') { handled(); receivedRef.current?.focus(); receivedRef.current?.select(); }
    else if (k === 'F11') { handled(); custRef.current?.focus(); }
    else if (k === 'F12') { handled(); noteRef.current?.focus(); }
    else if (ctrl && (k === 'p' || k === 'P')) { handled(); saveBill(true); }
    else if (ctrl && (k === 's' || k === 'S')) { handled(); saveBill(false); }
    else if (ctrl && (k === 't' || k === 'T')) { handled(); newTab(); }
    else if (ctrl && (k === 'o' || k === 'O')) { handled(); billRef.current?.focus(); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ------------------------------------------------------------------ render helpers
  const stockText = (pid: string) => {
    const s = stockById.get(pid) || 0;
    return <span className={s > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>Stock {s}</span>;
  };
  const savedStatus = savedInvoice
    ? (Number(savedInvoice.outstanding_amount) <= 0 ? 'PAID' : Number(savedInvoice.paid_amount) > 0 ? 'PARTIAL' : 'UNPAID')
    : '';

  const keyButtons: { label: string; key: string; run: () => void }[] = [
    { label: 'Change quantity', key: 'F2', run: () => { if (tab.lines.length) focusCell(active?.row ?? tab.lines.length - 1, 'qty'); } },
    { label: 'Item discount', key: 'F3', run: () => { if (tab.lines.length) focusCell(active?.row ?? tab.lines.length - 1, 'discPct'); } },
    { label: 'Remove item', key: 'F4', run: () => { if (active) removeRow(active.row); } },
    { label: 'Add new item', key: 'F7', run: openNewItem },
    { label: 'Last rates', key: 'F6', run: () => { if (tab.lines.length) focusCell(active?.row ?? tab.lines.length - 1, 'rate'); } },
    { label: 'Bill discount', key: 'F8', run: () => billDiscRef.current?.focus() },
    { label: 'Hold bill', key: 'F9', run: newTab },
    { label: 'Note on bill', key: 'F12', run: () => noteRef.current?.focus() }
  ];

  // ------------------------------------------------------------------ customer box (right panel on a computer, top on a phone)
  const customerBox = (
          <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col gap-2.5 relative">
            <label htmlFor="bt-customer" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Customer {!isPhone && <span className="normal-case font-normal">F11</span>}</label>
            <input id="bt-customer" ref={custRef} autoComplete="off"
              value={custOpen ? custQuery : customerName}
              placeholder="Shop name, owner or mobile"
              disabled={tab.kind !== 'new'}
              onFocus={() => { setCustOpen(true); setCustQuery(''); }}
              onBlur={() => setTimeout(() => setCustOpen(false), 150)}
              onChange={e => setCustQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (custMatches[0]) pickCustomer(custMatches[0].id); } }}
              className="h-10 border border-slate-400 rounded-sm px-2.5 font-semibold disabled:bg-slate-50" />
            {custOpen && tab.kind === 'new' && (
              <div className="absolute left-3.5 right-3.5 top-[86px] z-30 bg-white border border-slate-300 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickCustomer(walkInId)} className="w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-indigo-50 font-semibold">Counter / Walk-in</button>
                {custMatches.map(r => (
                  <button key={r.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickCustomer(r.id)}
                    className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-indigo-50">
                    <div className="font-semibold">{r.shop_name}</div>
                    <div className="text-xs text-slate-600">{[r.city, r.mobile].filter(Boolean).join(' · ')}{Number(r.outstanding) ? ` · ₹${r2(Number(r.outstanding))} Dr` : ''}</div>
                  </button>
                ))}
              </div>
            )}
            {tab.customerId && !isWalkInRetailerId(tab.customerId) && (
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="bg-amber-50 rounded-md px-2.5 py-2"><div className="text-amber-900">{tab.kind === 'saved' ? 'Shop balance now' : 'Old balance'}</div><div className="font-bold text-amber-900">{formatINR(Math.abs(oldBalance))} {oldBalance >= 0 ? 'Dr' : 'Cr'}</div></div>
                <div className="bg-slate-100 rounded-md px-2.5 py-2"><div className="text-slate-600">Credit limit</div><div className="font-bold">{creditLimit ? formatINR(creditLimit) : '—'}</div></div>
              </div>
            )}
          </div>
  );

  // ------------------------------------------------------------------ UI
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#eef0f4] text-slate-900 text-sm flex flex-col">
      {/* Tabs */}
      <div className={`flex items-end gap-1 px-3 pt-2 bg-slate-800 ${isPhone ? 'flex-nowrap overflow-x-auto' : 'flex-wrap'}`}>
        <button type="button" onClick={() => { setView('bills'); setActive(null); }} aria-pressed={view === 'bills'}
          className={`min-h-10 px-3.5 rounded-t-lg font-semibold mr-2 ${view === 'bills' ? 'bg-[#eef0f4] text-slate-900' : 'bg-slate-600 text-white'}`}>
          <span className="whitespace-nowrap">All bills</span> {!isPhone && <span className={`font-normal ${view === 'bills' ? 'text-slate-500' : 'text-slate-300'}`}>Ctrl+B</span>}
        </button>
        {tabs.map((t, i) => {
          const inv = t.kind === 'saved' ? (invoices as Invoice[]).find(x => x.id === t.invoiceId) : undefined;
          const shop = isWalkInRetailerId(t.customerId) ? 'Walk-in' : ((retailers as Retailer[]).find(r => r.id === t.customerId)?.shop_name || 'New');
          const label = inv ? `${inv.invoice_number} · ${shop}` : t.kind === 'order' ? `Packed · ${shop}` : `Bill ${i + 1} · ${shop}`;
          const isActive = view === 'bill' && t.key === tab.key;
          return (
            <div key={t.key} className={`flex items-center rounded-t-lg shrink-0 whitespace-nowrap ${isActive ? 'bg-[#eef0f4] text-slate-900' : 'bg-slate-700 text-slate-100'}`}>
              <button type="button" onClick={() => { setActiveKey(t.key); setActive(null); setView('bill'); }} className="min-h-10 pl-3.5 pr-1 font-semibold">
                {label}{t.kind === 'saved' && <span className="ml-2 text-[11px] font-bold text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5">SAVED</span>}{t.dirty && t.lines.length > 0 && <span className="ml-1" aria-label="not saved">•</span>}
              </button>
              <button type="button" aria-label={`Close ${label}`} onClick={() => closeTab(t.key)} className="min-h-10 w-9 text-slate-500 hover:text-red-700">×</button>
            </div>
          );
        })}
        <button type="button" onClick={newTab} className="min-h-10 px-3.5 font-semibold text-indigo-200 shrink-0 whitespace-nowrap">+ New bill {!isPhone && <span className="font-normal text-slate-400">Ctrl+T</span>}</button>
        <div className="flex-1" />
        <div className={`relative pb-1.5 ${isPhone ? 'hidden' : ''}`}>
          <label htmlFor="bt-open-bill" className="sr-only">Open a saved bill</label>
          <input id="bt-open-bill" ref={billRef} value={billQuery} onChange={e => setBillQuery(e.target.value)}
            placeholder="Open bill: number or shop  Ctrl+O"
            onKeyDown={e => { if (e.key === 'Enter' && billMatches[0]) { openInvoice(billMatches[0]); setBillQuery(''); } if (e.key === 'Escape') setBillQuery(''); }}
            className="w-64 max-w-full h-9 rounded border border-slate-500 bg-slate-700 text-slate-100 placeholder:text-slate-400 px-2.5 text-[13px]" />
          {billMatches.length > 0 && (
            <div className="absolute right-0 top-11 z-40 w-96 max-w-[90vw] bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden">
              {billMatches.map(inv => (
                <button key={inv.id} type="button" onClick={() => { openInvoice(inv); setBillQuery(''); }}
                  className="w-full flex justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50 border-b border-slate-100 last:border-0">
                  <span><strong>{inv.invoice_number}</strong> · {(retailers as Retailer[]).find(r => r.id === inv.retailer_id)?.shop_name || 'Walk-in'}</span>
                  <span className="text-slate-600 whitespace-nowrap">{new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {formatINR(inv.grand_total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div role={msg.kind === 'err' ? 'alert' : 'status'} className={`mx-3 mt-3 px-3 py-2 rounded-lg text-sm font-semibold flex justify-between gap-3 ${msg.kind === 'err' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
          <span>{msg.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMsg(null)} className="px-2">×</button>
        </div>
      )}

      {view === 'bills' && (
        <BillsRegister initialSearch={searchParams?.get('search') || ''} onOpen={openInvoice} onPrint={inv => setPreviewInvoice(inv)} />
      )}

      {view === 'bill' && (
      <div className={`flex flex-wrap gap-3 p-3 flex-1 ${isPhone ? 'pb-28' : ''}`}>
        {/* LEFT */}
        <div className="flex-[999_1_640px] min-w-0 flex flex-col gap-2.5">
          {isPhone && customerBox}
          {tab.kind === 'order' && (
            <div className="flex flex-col gap-1 bg-sky-50 border border-sky-200 rounded-lg px-3.5 py-2 text-[13px] text-sky-950">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <strong className="text-base">Packed {tabOrders.length > 1 ? 'orders' : 'order'} {tabOrders.map(o => o.order_number).join(', ')}</strong>
                <span>Quantities come from the packer. Change anything you need, then save: the bill is made and the orders are closed for billing.</span>
              </div>
              {shortOnOrders.length > 0 && (
                <div className="text-amber-900">Not packed (stays on backorder): {shortOnOrders.join('; ')}.</div>
              )}
              {(tabOrders.length === 0 || tabOrders.some(o => !o.flow_ready_to_bill)) && (
                <div className="text-red-800 font-semibold">
                  {tabOrders.length === 0 ? 'These orders are no longer waiting for billing.' : 'This order is not packed yet (or was already billed).'} Close this tab.
                </div>
              )}
            </div>
          )}
          {savedInvoice && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2">
              <strong className="text-base">{savedInvoice.invoice_number}</strong>
              <span>{new Date(savedInvoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              {savedInvoice.source_order_numbers?.length ? <span>From order {savedInvoice.source_order_numbers.join(', ')}</span> : null}
              {(savedInvoice as any).revised || (savedInvoice as any).edit_count ? <span className="text-xs font-bold text-amber-900 bg-amber-100 rounded px-2 py-0.5">Revised</span> : null}
              <span className="text-slate-600 text-[13px] flex-1">Edit any cell; on save the bill keeps its number. Stock and the shop balance change by the difference.</span>
              <button type="button" onClick={() => setHistoryFor(savedInvoice)} className="min-h-9 px-3 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-[13px] font-semibold">Change history</button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <label htmlFor="bt-search" className="sr-only">Search item</label>
            <div className={`flex items-center gap-2.5 bg-white rounded-lg px-3.5 min-h-12 ${searchOpen && query ? 'border-2 border-indigo-600' : 'border border-slate-400'}`}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input id="bt-search" ref={searchRef} value={query} autoComplete="off"
                onChange={e => { setQuery(e.target.value); setSearchOpen(true); setSearchIdx(0); }}
                onFocus={() => { setSearchOpen(true); setActive(null); }}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx(i => Math.min(matches.length - 1, i + 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx(i => Math.max(0, i - 1)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (matches[searchIdx]) addProduct(matches[searchIdx]); else if (query.trim()) openNewItem(); }
                  else if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); }
                }}
                placeholder={isPhone ? 'Search item to add' : 'Search item name, code or barcode'}
                className="flex-1 border-0 outline-none bg-transparent text-base" />
              <span className="hidden sm:inline text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5">F1 · name, code or barcode</span>
            </div>
            {searchOpen && query.trim() !== '' && (
              <div className="absolute left-0 right-0 top-[54px] z-30 bg-white border border-slate-300 rounded-lg shadow-xl overflow-hidden">
                {isPhone ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_52px] gap-2 px-3 py-2 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide">
                    <span>Item</span><span className="text-right">Rate</span><span className="text-right">Stock</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-[minmax(0,1fr)_70px_70px_80px_70px] gap-2 px-3.5 py-2 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wide">
                    <span>Item</span><span className="text-right">MRP</span><span className="text-right">Rate</span><span className="text-right">Purchase</span><span className="text-right">Stock</span>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto">
                  {matches.map((p, i) => {
                    const s = stockById.get(p.id) || 0;
                    if (isPhone) return (
                      <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => addProduct(p)}
                        className={`w-full grid grid-cols-[minmax(0,1fr)_64px_52px] gap-2 px-3 py-3 text-left border-t border-slate-100 items-center ${i === searchIdx ? 'bg-indigo-50' : 'active:bg-slate-100'}`}>
                        <span className="leading-snug"><span className="font-semibold">{p.name}</span><span className="block text-xs text-slate-500">MRP ₹{Number(p.mrp) || 0}</span></span>
                        <span className="text-right font-semibold">₹{Number(p.selling_price) || 0}</span>
                        <span className={`text-right font-bold ${s > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{s}</span>
                      </button>
                    );
                    return (
                      <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => addProduct(p)}
                        className={`w-full grid grid-cols-[minmax(0,1fr)_70px_70px_80px_70px] gap-2 px-3.5 py-2.5 text-left border-t border-slate-100 ${i === searchIdx ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                        <span className="truncate">{p.name}</span>
                        <span className="text-right">₹{Number(p.mrp) || 0}</span>
                        <span className="text-right font-semibold">₹{Number(p.selling_price) || 0}</span>
                        <span className="text-right text-slate-600">₹{Number(p.purchase_price) || 0}</span>
                        <span className={`text-right font-bold ${s > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{s}</span>
                      </button>
                    );
                  })}
                  {matches.length === 0 && <div className="px-3.5 py-3 text-slate-700">No item matches <strong>“{query.trim()}”</strong> in the item list.</div>}
                </div>
                <div className="flex flex-wrap justify-between items-center gap-2 px-3.5 py-2 text-xs text-slate-600 border-t border-slate-200 bg-slate-50">
                  <span>{isPhone ? 'Tap an item to add it' : '↑ ↓ to move · Enter to add · Esc to close · Every typed word matches, in any order'}</span>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={openNewItem}
                    className={`min-h-9 px-3.5 rounded-lg text-[13px] font-bold ${matches.length === 0 ? 'bg-indigo-700 text-white' : 'border border-indigo-300 bg-white text-indigo-800'}`}>
                    + Add new item {!isPhone && <span className="font-medium">F7</span>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Phone: one card per item */}
          {isPhone && (
            <div className="flex flex-col gap-2">
              {tab.lines.length === 0 && (
                <div className="bg-white border border-dashed border-slate-300 rounded-lg p-5 text-center text-slate-600">
                  No items yet. Search above to add an item.
                </div>
              )}
              {tab.lines.map((l, row) => {
                const box = (col: Col, label: string, value: string, onChange: (v: string) => void, extra = '') => (
                  <label className={`flex flex-col gap-0.5 min-w-0 ${extra}`}>
                    <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                    <input id={`bt-cell-${row}-${col}`} data-no-list-nav value={value} inputMode="decimal" autoComplete="off"
                      onFocus={e => { setActive({ row, col }); e.currentTarget.select(); }}
                      onChange={e => onChange(e.target.value)}
                      className="h-11 w-full min-w-0 border border-slate-400 rounded-md px-2 text-right text-base tabular-nums focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none" />
                  </label>
                );
                const q = num(l.qty);
                return (
                  <div key={l.key} className="bg-white border border-slate-300 rounded-lg p-3 flex flex-col gap-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 font-semibold pt-0.5">{row + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold leading-snug break-words">{l.name}</div>
                        <div className="text-xs text-slate-600">MRP ₹{l.mrp} · {stockText(l.productId)}</div>
                      </div>
                      <button type="button" onClick={() => removeRow(row)} aria-label={`Remove ${l.name}`}
                        className="w-9 h-9 shrink-0 rounded-md border border-red-200 text-red-700 text-lg leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2 items-end">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-600">Qty (pcs)</span>
                        <div className="flex items-stretch gap-1">
                          <button type="button" aria-label="One less" onClick={() => setLine(row, { qty: String(Math.max(0, q - 1)) })}
                            className="w-11 h-11 shrink-0 rounded-md border border-slate-400 bg-slate-50 text-xl font-bold">−</button>
                          <input id={`bt-cell-${row}-qty`} data-no-list-nav value={l.qty} inputMode="numeric" autoComplete="off" aria-label={`Quantity for ${l.name}`}
                            onFocus={e => { setActive({ row, col: 'qty' }); e.currentTarget.select(); }}
                            onChange={e => setLine(row, { qty: e.target.value })}
                            className="h-11 w-full min-w-0 border border-slate-400 rounded-md px-1 text-center text-base font-bold tabular-nums focus:border-indigo-600 outline-none" />
                          <button type="button" aria-label="One more" onClick={() => setLine(row, { qty: String(q + 1) })}
                            className="w-11 h-11 shrink-0 rounded-md border border-slate-400 bg-slate-50 text-xl font-bold">+</button>
                        </div>
                      </div>
                      {box('rate', 'Rate (without tax)', l.rate, v => setLine(row, { rate: v }))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {box('discPct', 'Disc %', l.discPct, v => setLine(row, { discPct: v, discMode: 'pct' }))}
                      {box('discAmt', 'Disc amount', l.discAmt, v => setLine(row, { discAmt: v, discMode: 'amt' }))}
                      {box('gst', 'GST %', l.gst, v => setLine(row, { gst: v }))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => { setActive({ row, col: 'rate' }); setRateSheetRow(row); }}
                        className="min-h-10 px-3 rounded-md border border-indigo-300 text-indigo-800 font-semibold text-[13px]">Last rates</button>
                      <span className="text-right">
                        <span className="text-xs text-slate-600 block">Amount</span>
                        <span className="text-lg font-bold tabular-nums">₹{lineAmount(l).toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              {tab.lines.length > 0 && (
                <div className="flex justify-between px-1 text-[13px] font-semibold text-slate-700">
                  <span>{totals.items} items · {totals.qty} pcs</span>
                  <span>Item discount ₹{totals.itemDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={openNewItem} className="min-h-11 rounded-lg border border-indigo-300 bg-white text-indigo-800 font-semibold">+ Add new item</button>
                <button type="button" onClick={() => { billDiscRef.current?.focus(); billDiscRef.current?.select(); }} className="min-h-11 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold">Bill discount</button>
              </div>
            </div>
          )}

          {/* Grid */}
          {!isPhone && (
          <>
          <div className="bg-white border border-slate-300 rounded-lg flex-1">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide">
                  <th className="w-7 py-2 border border-slate-300 border-t-0 border-l-0">#</th>
                  <th className="py-2 px-2 text-left border border-slate-300 border-t-0">Item</th>
                  <th className="w-[52px] py-2 px-1.5 text-right border border-slate-300 border-t-0">Qty</th>
                  <th className="w-12 py-2 px-1.5 text-left border border-slate-300 border-t-0">Unit</th>
                  <th className="w-[76px] py-2 px-1.5 text-right border border-slate-300 border-t-0">Rate<div className="font-medium normal-case text-slate-500">without tax</div></th>
                  <th className="w-[54px] py-2 px-1.5 text-right border border-slate-300 border-t-0">Disc %</th>
                  <th className="w-[62px] py-2 px-1.5 text-right border border-slate-300 border-t-0">Disc ₹</th>
                  <th className="w-[50px] py-2 px-1.5 text-right border border-slate-300 border-t-0">GST %</th>
                  <th className="w-[88px] py-2 px-1.5 text-right border border-slate-300 border-t-0 border-r-0">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tab.lines.map((l, row) => {
                  const isRow = active?.row === row;
                  const cell = (col: Col, value: string, onChange: (v: string) => void) => (
                    <td className="p-0 border border-slate-200 relative">
                      <label htmlFor={`bt-cell-${row}-${col}`} className="sr-only">{col} for {l.name}</label>
                      <input id={`bt-cell-${row}-${col}`} data-no-list-nav value={value} inputMode="decimal" autoComplete="off"
                        onFocus={e => { setActive({ row, col }); setHistIdx(-1); e.currentTarget.select(); }}
                        onChange={e => onChange(e.target.value)}
                        onKeyDown={e => onCellKey(e, row, col)}
                        className={`${cellBase} ${isRow ? 'bg-indigo-50/40' : ''}`} />
                    </td>
                  );
                  return (
                    <tr key={l.key} className={isRow ? 'bg-indigo-50/60' : ''}>
                      <td className="text-center text-slate-500 bg-slate-50 border border-slate-200 border-l-0">{row + 1}</td>
                      <td className="px-2 py-1.5 border border-slate-200">
                        <div className="font-semibold leading-snug break-words">{l.name}</div>
                        <div className="text-xs text-slate-600">MRP ₹{l.mrp} · {stockText(l.productId)}</div>
                      </td>
                      {cell('qty', l.qty, v => setLine(row, { qty: v }))}
                      <td className="px-1.5 border border-slate-200 text-slate-700">{l.unit}</td>
                      <td className="p-0 border border-slate-200 relative">
                        <label htmlFor={`bt-cell-${row}-rate`} className="sr-only">Rate for {l.name}</label>
                        <input id={`bt-cell-${row}-rate`} data-no-list-nav value={l.rate} inputMode="decimal" autoComplete="off"
                          onFocus={e => { setActive({ row, col: 'rate' }); setHistIdx(-1); e.currentTarget.select(); }}
                          onChange={e => setLine(row, { rate: e.target.value })}
                          onKeyDown={e => onCellKey(e, row, 'rate')}
                          className={`${cellBase} ${isRow ? 'bg-indigo-50/40' : ''}`} />
                        {!isPhone && active?.row === row && active.col === 'rate' && history && (
                          <div role="dialog" aria-label="Last rates for this item"
                            className="absolute top-[calc(100%+6px)] -left-[300px] w-[520px] max-w-[92vw] z-30 bg-white border border-slate-400 rounded-lg shadow-2xl p-3 flex flex-col gap-2.5 text-left">
                            <div className="flex justify-between items-baseline gap-2">
                              <strong>{l.name}</strong>
                              <span className="text-xs text-slate-600">
                                Purchase ₹{l.purchaseRate}{num(l.rate) > 0 && l.purchaseRate > 0 ? ` · margin ${r2((num(l.rate) - l.purchaseRate) / num(l.rate) * 100)}%` : ''}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              {[{ title: `Last 5 to ${customerName || 'this shop'}`, list: history.shop, offset: 0, shopCol: false },
                                { title: 'Last 5 to any shop', list: history.any, offset: history.shop.length, shopCol: true }].map(box => (
                                <div key={box.title} className="border border-slate-200 rounded-md overflow-hidden">
                                  <div className={`px-2 py-1.5 text-xs font-bold ${box.shopCol ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-900'}`}>{box.title}</div>
                                  {box.list.length === 0 && <div className="px-2 py-2 text-xs text-slate-500">No past bills.</div>}
                                  {box.list.map((h, i) => (
                                    <button key={h.invoiceId + i} type="button" onMouseDown={e => e.preventDefault()}
                                      onClick={() => { setLine(row, { rate: h.rate.toFixed(2) }); setHistIdx(-1); }}
                                      className={`w-full grid grid-cols-[52px_minmax(0,1fr)_30px_58px] gap-1.5 items-center px-2 py-1.5 border-t border-slate-100 text-xs text-left ${histIdx === box.offset + i ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}>
                                      <span className="text-slate-600">{new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                      <span className="truncate text-slate-600">{box.shopCol ? h.shopName : h.invoiceNumber.replace('INV/2026-27/', 'INV/')}</span>
                                      <span className="text-right text-slate-600">{h.qty}</span>
                                      <span className="text-right font-bold">₹{h.rate.toFixed(2)}</span>
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-slate-600">↑ ↓ pick a past rate · Enter to use it · or type a new rate · Esc to close</div>
                          </div>
                        )}
                      </td>
                      {cell('discPct', l.discPct, v => setLine(row, { discPct: v, discMode: 'pct' }))}
                      {cell('discAmt', l.discAmt, v => setLine(row, { discAmt: v, discMode: 'amt' }))}
                      {cell('gst', l.gst, v => setLine(row, { gst: v }))}
                      <td className="px-1.5 text-right font-bold bg-slate-50 border border-slate-200 border-r-0 tabular-nums">{lineAmount(l).toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="h-11 text-center text-slate-400 bg-slate-50 border border-slate-200 border-l-0">{tab.lines.length + 1}</td>
                  <td colSpan={8} className="px-2 text-slate-500 border border-slate-200 border-r-0">
                    <button type="button" onClick={() => searchRef.current?.focus()} className="min-h-10 text-left w-full">Next item… <span className="text-xs">(F1)</span></button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-300 border-l-0 border-b-0" />
                  <td className="px-2 py-2.5 border border-slate-300 border-b-0">Total · {totals.items} items</td>
                  <td className="px-1.5 text-right border border-slate-300 border-b-0">{totals.qty}</td>
                  <td className="border border-slate-300 border-b-0" />
                  <td className="border border-slate-300 border-b-0" />
                  <td className="border border-slate-300 border-b-0" />
                  <td className="px-1.5 text-right border border-slate-300 border-b-0">{totals.itemDiscount.toFixed(2)}</td>
                  <td className="border border-slate-300 border-b-0" />
                  <td className="px-1.5 text-right border border-slate-300 border-b-0 border-r-0 tabular-nums">{r2(tab.lines.reduce((sum, l) => sum + (num(l.qty) > 0 ? lineAmount(l) : 0), 0)).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="text-xs text-slate-600">Tab / Enter: next cell · ← → ↑ ↓: move between cells · Type to replace a value · Esc: leave the cell</div>

          {showKeys && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {keyButtons.map(k => (
                <button key={k.key} type="button" onClick={k.run}
                  className="min-h-12 flex items-center justify-between gap-2 px-3 bg-white border border-indigo-200 rounded-lg text-indigo-950 font-semibold text-left hover:bg-indigo-50">
                  <span>{k.label}</span>
                  <span className="text-xs font-bold text-indigo-800 bg-indigo-50 rounded px-1.5 py-0.5">{k.key}</span>
                </button>
              ))}
            </div>
          )}
          </>
          )}
        </div>

        {/* RIGHT */}
        <div className={`flex-[1_1_280px] flex flex-col gap-2.5 ${isPhone ? 'w-full' : 'max-w-[320px]'}`}>
          {!isPhone && customerBox}

          <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col gap-2">
            <div className="flex justify-between"><span className="text-slate-600">Gross</span><span>{formatINR(totals.gross)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Item discount</span><span>− {formatINR(totals.itemDiscount)}</span></div>
            <div className="flex justify-between items-center">
              <label htmlFor="bt-bill-disc" className="text-slate-600">Bill discount ₹ {!isPhone && <span className="text-xs">F8</span>}</label>
              <input id="bt-bill-disc" ref={billDiscRef} value={tab.billDisc} placeholder="0.00" inputMode="decimal"
                onChange={e => patchTab({ billDisc: e.target.value })}
                className="w-24 h-8 border border-slate-400 rounded-sm px-2 text-right" />
            </div>
            <div className="flex justify-between"><span className="text-slate-600">Taxable</span><span>{formatINR(totals.taxable)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">GST</span><span>{formatINR(totals.gst)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Round off</span><span>{formatINR(totals.roundOff)}</span></div>
            <div className="flex justify-between items-baseline border-t border-slate-200 pt-2.5 mt-0.5">
              <span className="font-bold text-base">Bill total</span>
              <span className="font-bold text-3xl text-indigo-950">₹{totals.total.toLocaleString('en-IN')}</span>
            </div>
            {tab.kind === 'saved' && savedInvoice && totals.total !== Math.round(Number(savedInvoice.grand_total) || 0) && (
              <div className="text-xs text-amber-900 bg-amber-50 rounded px-2 py-1.5">Was {formatINR(savedInvoice.grand_total)} · change {totals.total - Math.round(Number(savedInvoice.grand_total) || 0) > 0 ? '+' : ''}{formatINR(totals.total - Math.round(Number(savedInvoice.grand_total) || 0))}</div>
            )}
          </div>

          {tab.kind !== 'saved' ? (
            <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Payment</span>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Payment mode">
                {(['Cash', 'UPI', 'Credit'] as PayMode[]).map(m => (
                  <button key={m} type="button" aria-pressed={tab.payMode === m} onClick={() => patchTab({ payMode: m })}
                    disabled={m === 'Credit' && isWalkInRetailerId(tab.customerId)}
                    className={`min-h-11 rounded-lg font-bold disabled:opacity-40 ${tab.payMode === m ? 'border-2 border-indigo-600 bg-indigo-50 text-indigo-950' : 'border border-slate-300 bg-white text-slate-700'}`}>{m}</button>
                ))}
              </div>
              {tab.payMode !== 'Credit' && (
                <>
                  <label htmlFor="bt-received" className="text-[13px] text-slate-600">Amount received {!isPhone && <span className="text-xs">F10</span>}</label>
                  <input id="bt-received" ref={receivedRef} value={tab.received} placeholder={String(totals.total)} inputMode="decimal"
                    onChange={e => patchTab({ received: e.target.value })}
                    className="h-10 border border-slate-400 rounded-sm px-2.5 text-lg font-bold text-right" />
                  <div className="flex justify-between items-baseline bg-emerald-50 rounded-md px-3 py-2.5">
                    <span className="font-semibold text-emerald-900">Change to return</span>
                    <span className="font-bold text-xl text-emerald-900">₹{change.toLocaleString('en-IN')}</span>
                  </div>
                  {received < totals.total && <div className="text-xs text-amber-900">₹{r2(totals.total - received)} stays due on the bill.</div>}
                </>
              )}
              {!isWalkInRetailerId(tab.customerId) && tab.customerId && (
                <div className="flex justify-between text-[13px] text-slate-600"><span>Shop balance after this bill</span><span className="font-semibold text-amber-900">{formatINR(Math.abs(balanceAfter))} {balanceAfter >= 0 ? 'Dr' : 'Cr'}</span></div>
              )}
              {overLimit && <div className="text-xs font-semibold text-red-800 bg-red-50 rounded px-2 py-1.5">Above the credit limit of {formatINR(creditLimit)}.</div>}
            </div>
          ) : savedInvoice ? (
            <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Payment</span>
                <span className={`text-xs font-bold rounded px-2 py-0.5 ${savedStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : savedStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`}>{savedStatus}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-600">Paid on this bill</span><span className="font-semibold">{formatINR(savedInvoice.paid_amount)}</span></div>
              <div className="flex justify-between items-baseline bg-red-50 rounded-md px-3 py-2.5">
                <span className="font-semibold text-red-800">Due on this bill</span>
                <span className="font-bold text-xl text-red-800">{formatINR(savedInvoice.outstanding_amount)}</span>
              </div>
              <label htmlFor="bt-received" className="text-[13px] text-slate-600">Receive now <span className="text-xs">F10</span></label>
              <div className="flex gap-1.5">
                <input id="bt-received" ref={receivedRef} value={tab.received} placeholder="0.00" inputMode="decimal"
                  onChange={e => setTabs(prev => prev.map(t => t.key === tab.key ? { ...t, received: e.target.value } : t))}
                  className="flex-1 min-w-0 h-10 border border-slate-400 rounded-sm px-2.5 text-lg font-bold text-right" />
                <button type="button" onClick={receiveOnSaved} className="min-h-10 px-3 rounded-lg bg-emerald-700 text-white font-bold">Receive</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['Cash', 'UPI'] as PayMode[]).map(m => (
                  <button key={m} type="button" aria-pressed={tab.payMode === m} onClick={() => setTabs(prev => prev.map(t => t.key === tab.key ? { ...t, payMode: m } : t))}
                    className={`min-h-10 rounded-lg font-bold ${tab.payMode === m ? 'border-2 border-indigo-600 bg-indigo-50 text-indigo-950' : 'border border-slate-300 bg-white text-slate-700'}`}>{m}</button>
                ))}
              </div>
              <div className="text-xs text-slate-600">The amount clears this shop's oldest unpaid bills first.</div>
            </div>
          ) : null}

          <div className="bg-white border border-slate-300 rounded-lg px-3.5 py-2.5">
            <label htmlFor="bt-note" className="text-xs font-semibold text-slate-600">Note on bill {!isPhone && <span className="font-normal">F12</span>}</label>
            <input id="bt-note" ref={noteRef} value={tab.note} onChange={e => patchTab({ note: e.target.value })} disabled={tab.kind === 'saved'}
              className="mt-1 w-full h-9 border border-slate-400 rounded-sm px-2.5 disabled:bg-slate-50" />
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button type="button" onClick={() => saveBill(true)} className="min-h-[52px] rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-base font-bold">
              {tab.kind === 'saved' ? 'Save changes & print' : 'Save & print bill'} <span className="font-medium text-indigo-200">Ctrl+P</span>
            </button>
            <button type="button" onClick={() => saveBill(false)} className="min-h-11 rounded-lg border border-indigo-200 bg-white text-indigo-800 font-semibold">
              {tab.kind === 'saved' ? 'Save changes' : 'Save without printing'} <span className="font-medium">Ctrl+S</span>
            </button>
            {tab.kind === 'saved' && savedInvoice && (
              <button type="button" onClick={() => setPreviewInvoice(savedInvoice)} className="min-h-10 rounded-lg text-slate-700 font-semibold text-[13px]">Print without changes</button>
            )}
          </div>
        </div>
      </div>

      )}

      {/* Phone: total and Save always at the bottom */}
      {isPhone && view === 'bill' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-300 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-600 truncate">{totals.items} items · {tab.kind === 'saved' ? 'Saved bill' : tab.payMode}</div>
            <div className="text-2xl font-bold text-indigo-950 tabular-nums">₹{totals.total.toLocaleString('en-IN')}</div>
          </div>
          <button type="button" onClick={() => saveBill(true)} aria-label="Save and print"
            className="min-h-12 px-3 rounded-lg border border-indigo-300 bg-white text-indigo-800 font-bold">Print</button>
          <button type="button" onClick={() => saveBill(false)}
            className="min-h-12 px-5 rounded-lg bg-indigo-700 text-white font-bold">{tab.kind === 'saved' ? 'Save changes' : 'Save bill'}</button>
        </div>
      )}

      {/* Phone: last rates sheet */}
      {isPhone && rateSheetRow !== null && tab.lines[rateSheetRow] && history && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end" onMouseDown={e => { if (e.target === e.currentTarget) { setRateSheetRow(null); setActive(null); } }}>
          <div role="dialog" aria-label="Last rates for this item" className="w-full max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="block leading-snug">{tab.lines[rateSheetRow].name}</strong>
                <span className="text-xs text-slate-600">
                  Rate now ₹{tab.lines[rateSheetRow].rate} · Purchase ₹{tab.lines[rateSheetRow].purchaseRate}
                </span>
              </div>
              <button type="button" aria-label="Close" onClick={() => { setRateSheetRow(null); setActive(null); }} className="w-10 h-10 rounded-md border border-slate-300 text-lg">×</button>
            </div>
            {[{ title: `Last 5 to ${customerName || 'this shop'}`, list: history.shop, shopCol: false },
              { title: 'Last 5 to any shop', list: history.any, shopCol: true }].map(box => (
              <div key={box.title} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className={`px-3 py-2 text-xs font-bold ${box.shopCol ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-900'}`}>{box.title}</div>
                {box.list.length === 0 && <div className="px-3 py-2.5 text-sm text-slate-500">No past bills.</div>}
                {box.list.map((h, i) => (
                  <button key={h.invoiceId + i} type="button"
                    onClick={() => { setLine(rateSheetRow, { rate: h.rate.toFixed(2) }); setRateSheetRow(null); setActive(null); }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 border-t border-slate-100 text-left active:bg-indigo-50">
                    <span className="min-w-0">
                      <span className="block text-sm">{new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} · {h.qty} pcs</span>
                      <span className="block text-xs text-slate-600 truncate">{box.shopCol ? h.shopName : h.invoiceNumber}</span>
                    </span>
                    <span className="font-bold text-base">₹{h.rate.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="text-xs text-slate-600">Tap a rate to use it on this bill.</div>
          </div>
        </div>
      )}

      {/* Add new item */}
      {newItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-start justify-center p-4 pt-16" onMouseDown={e => { if (e.target === e.currentTarget) setNewItem(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="bt-ni-title" className="w-[640px] max-w-full bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200">
              <div>
                <strong id="bt-ni-title" className="text-lg">Add new item</strong>
                <div className="text-[13px] text-slate-600">Saved to the item list and added to this bill</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setNewItem(null)} className="w-11 h-11 text-2xl text-slate-600">×</button>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['name', 'Item name *', 'col-span-2 sm:col-span-4', false],
                ['mrp', 'MRP *', '', true], ['rate', 'Sale rate *', '', true], ['purchase', 'Purchase rate', '', true], ['gst', 'GST %', '', true],
                ['hsn', 'HSN', '', false], ['code', 'Barcode / code', '', false], ['category', 'Category', 'col-span-2', false],
                ['shelf', 'Stock on the shelf now', 'col-span-2', true], ['qty', 'Quantity on this bill *', 'col-span-2', true]
              ] as [string, string, string, boolean][]).map(([k, label, span, numeric]) => (
                <div key={k} className={`flex flex-col gap-1 ${span}`}>
                  <label htmlFor={`bt-ni-${k}`} className="text-xs font-semibold text-slate-700">{label}</label>
                  <input id={`bt-ni-${k}`} value={newItem[k] || ''} autoFocus={k === 'name'} inputMode={numeric ? 'decimal' : undefined}
                    placeholder={k === 'shelf' ? 'Leave empty if not counted' : k === 'code' ? 'Scan or type' : ''}
                    onChange={e => setNewItem(prev => prev ? { ...prev, [k]: e.target.value } : prev)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewItem(true); } }}
                    className={`h-10 border border-slate-400 rounded-sm px-2.5 ${numeric ? 'text-right' : ''} ${k === 'name' ? 'font-semibold' : ''}`} />
                </div>
              ))}
              {num(newItem.shelf) <= 0 && num(newItem.qty) > 0 && (
                <div className="col-span-2 sm:col-span-4 text-[13px] text-amber-900 bg-amber-50 rounded-lg px-3 py-2.5">
                  No stock entered: after this bill the item shows <strong>−{Math.floor(num(newItem.qty))}</strong> in stock until the purchase is entered.
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button type="button" onClick={() => setNewItem(null)} className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white font-semibold">Cancel <span className="font-normal">Esc</span></button>
              <button type="button" onClick={() => saveNewItem(false)} className="min-h-11 px-4 rounded-lg border border-indigo-300 bg-white text-indigo-800 font-semibold">Save item only</button>
              <button type="button" onClick={() => saveNewItem(true)} className="min-h-11 px-4 rounded-lg bg-indigo-700 text-white font-bold">Save &amp; add to bill <span className="font-medium text-indigo-200">Enter</span></button>
            </div>
          </div>
        </div>
      )}

      {historyFor && (
        <InvoiceAuditTrailModal isOpen={!!historyFor} onClose={() => setHistoryFor(null)} invoice={(invoices as Invoice[]).find(i => i.id === historyFor.id) || historyFor} />
      )}

      {previewInvoice && (
        <InvoicePreviewModal
          isOpen={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          invoice={(invoices as Invoice[]).find(i => i.id === previewInvoice.id) || previewInvoice}
          retailer={(retailers as Retailer[]).find(r => r.id === previewInvoice.retailer_id) || null}
          company={activeCompany}
        />
      )}
    </div>
  );
}
