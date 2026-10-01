'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import {
  Invoice, DeliveryChallan, Retailer, Company, BusinessCompany,
  formatQuantityDisplay
} from '@/lib/db';
import {
  X, Printer, Receipt, FileText, Store, PackageOpen,
  CheckCircle2, Clock, Truck, Search
} from 'lucide-react';
import { printInvoiceDocument } from '@/lib/printInvoice';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  challan?: DeliveryChallan | null;
  retailer?: Retailer | null;
  company?: BusinessCompany | Company | null;
}

// Helper: Convert number to Indian Rupees in words (Indian numbering system)
function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0 || isNaN(num)) return 'Rupees Zero Only';

  const parts = Math.abs(num).toFixed(2).split('.');
  const whole = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1], 10) : 0;

  function inWords(n: number): string {
    let str = '';
    if (n >= 10000000) {
      str += `${inWords(Math.floor(n / 10000000))} Crore `;
      n %= 10000000;
    }
    if (n >= 100000) {
      str += `${inWords(Math.floor(n / 100000))} Lakh `;
      n %= 100000;
    }
    if (n >= 1000) {
      str += `${inWords(Math.floor(n / 1000))} Thousand `;
      n %= 1000;
    }
    if (n >= 100) {
      str += `${inWords(Math.floor(n / 100))} Hundred `;
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)];
        if (n % 10 > 0) str += ` ${a[n % 10]}`;
      }
    }
    return str.trim();
  }

  let words = inWords(whole);
  words = words ? `Rupees ${words}` : 'Rupees Zero';

  if (paise > 0) {
    words += ` and ${inWords(paise)} Paise`;
  }
  return `${words} Only`;
}

// Helper: Shorten trading unit abbreviation
function formatTradingUnit(unit?: string): string {
  if (!unit) return 'CTN';
  const u = unit.toLowerCase();
  if (u.includes('carton')) return 'CTN';
  if (u.includes('box')) return 'BOX';
  if (u.includes('bag')) return 'BAG';
  return unit.toUpperCase();
}

// Helper: Format Date dd-mmm-yyyy
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  invoice,
  challan,
  retailer,
  company
}: InvoicePreviewModalProps) {
  const {
    activeCompany,
    products = [],
    batches = [],
    retailers = [],
    orders = [],
    fulfilments = []
  } = useDb();

  const [activeTab, setActiveTab] = useState<'invoice' | 'challan'>('invoice');
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  if (!isOpen || !invoice) return null;

  // Resolve Retailer Information
  const ret = retailer || retailers.find(r => r.id === invoice.retailer_id);

  // Helper: Retrieve all contributing original order numbers for any invoice
  const getInvoiceOrderInfo = (inv: Invoice): { orderNumber: string; source: string; orderId: string }[] => {
    // 1. Explicit source_order_numbers on invoice
    if (inv.source_order_numbers && inv.source_order_numbers.length > 0) {
      return inv.source_order_numbers.map((num, idx) => {
        const ordId = inv.source_order_ids?.[idx];
        const matchOrd = orders.find(o => o.order_number === num || o.id === ordId);
        return {
          orderNumber: num,
          source: matchOrd?.source || 'direct',
          orderId: matchOrd?.id || ordId || ''
        };
      });
    }

    // 1b. order_numbers array (e.g. from consolidated lot packing)
    if (inv.order_numbers && inv.order_numbers.length > 0) {
      return inv.order_numbers.map((num, idx) => {
        const ordId = inv.source_order_ids?.[idx];
        const matchOrd = orders.find(o => o.order_number === num || o.id === ordId);
        return {
          orderNumber: num,
          source: matchOrd?.source || 'direct',
          orderId: matchOrd?.id || ordId || ''
        };
      });
    }

    // 2. Linked to Fulfilment
    if (inv.order_ref_id?.startsWith('ful-')) {
      const matchFul = fulfilments.find(f => f.id === inv.order_ref_id);
      if (matchFul && matchFul.source_order_ids && matchFul.source_order_ids.length > 0) {
        const matchOrders = orders.filter(o => matchFul.source_order_ids?.includes(o.id));
        if (matchOrders.length > 0) {
          return matchOrders.map(o => ({
            orderNumber: o.order_number,
            source: o.source,
            orderId: o.id
          }));
        }
      }
    }

    // 3. Direct Order Ref
    if (inv.order_ref_id) {
      const directOrd = orders.find(o => o.id === inv.order_ref_id || o.order_number === inv.order_ref_id);
      if (directOrd) {
        return [{
          orderNumber: directOrd.order_number,
          source: directOrd.source,
          orderId: directOrd.id
        }];
      }
    }

    return [];
  };

  const orderInfos = getInvoiceOrderInfo(invoice);

  // Business Firm Information (SAIFEE GENERAL STORES)
  const firmName = activeCompany?.name?.toUpperCase() || 'SAIFEE GENERAL STORES';
  const firmFirstLetter = firmName.charAt(0) || 'S';
  const firmAddress = activeCompany?.address
    ? `${activeCompany.address}${activeCompany.city ? `, ${activeCompany.city}` : ''}`
    : 'FMCG Warehouse Distributors, Sector 15, Kalamboli Logistics Zone, Navi Mumbai, MH';
  const firmGstin = activeCompany?.gstin || '27SAIFE1234A1Z5';

  // Payment Status
  const isPaid = (invoice.outstanding_amount ?? (invoice.grand_total - (invoice.paid_amount || 0))) <= 0;
  const isPartiallyPaid = (invoice.paid_amount || 0) > 0 && (invoice.outstanding_amount ?? 0) > 0;

  // Filtered invoice items based on itemSearchQuery
  const rawInvoiceItems = invoice.items || [];
  const filteredInvoiceItems = React.useMemo(() => {
    if (!itemSearchQuery.trim()) return rawInvoiceItems;
    const q = itemSearchQuery.toLowerCase().trim();
    return rawInvoiceItems.filter(item => {
      const prod = products.find(p => p.id === item.product_id);
      const prodName = (prod?.name || item.description || item.variant_name || item.product_name || '').toLowerCase();
      const hsn = (item.hsn || prod?.hsn || '').toLowerCase();
      const batchNo = (item.batch_number || batches?.find(b => b.product_id === item.product_id)?.batch_number || '').toLowerCase();
      const packing = (item.packing || prod?.pack_size || '').toLowerCase();
      const mrp = String(item.mrp || prod?.mrp || '');
      return prodName.includes(q) || hsn.includes(q) || batchNo.includes(q) || packing.includes(q) || mrp.includes(q);
    });
  }, [rawInvoiceItems, itemSearchQuery, products, batches]);

  const handlePrint = () => {
    printInvoiceDocument('printable-tax-invoice', `Tax_Invoice_${invoice.invoice_number}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 print:static print:bg-transparent print:p-0 print:m-0 print:block print:w-full print:h-auto">

      {/* Strict Print CSS for Isolated A4 Tax Invoice Output */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          /* Strictly hide non-printable UI elements */
          .no-print,
          .no-print *,
          button,
          header,
          nav,
          aside,
          footer {
            display: none !important;
            visibility: hidden !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            font-size: 8pt !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-tax-invoice {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 6mm 8mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: 1px solid #334155 !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
          }
          #printable-tax-invoice * {
            visibility: visible !important;
          }
          table {
            width: 100% !important;
            page-break-inside: auto;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto;
          }
          thead {
            display: table-header-group !important;
          }
          .dense-print-th {
            padding: 2.5px 4px !important;
            font-size: 7.5pt !important;
            border-top: 1px solid #000000 !important;
            border-bottom: 1px solid #000000 !important;
            background-color: #f1f5f9 !important;
            color: #000000 !important;
          }
          .dense-print-td {
            padding: 2.5px 4px !important;
            font-size: 8pt !important;
            border-bottom: 0.5px solid #cbd5e1 !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:static print:max-w-full print:w-full print:bg-transparent print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible print:max-h-none">

        {/* Modal Top Control Bar (Screen Only) */}
        <div className="no-print p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Receipt className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm sm:text-base font-black text-amber-300">
                  {invoice.invoice_number}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  TAX INVOICE (GST)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                {ret?.shop_name || 'Retailer Customer'} &bull; {formatDate(invoice.date)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {challan && (
              <div className="flex bg-white/10 p-0.5 rounded-lg text-xs font-bold mr-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('invoice')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeTab === 'invoice'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                    }`}
                >
                  Tax Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('challan')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeTab === 'challan'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                    }`}
                >
                  Delivery Challan
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-102 active:scale-98"
            >
              <Printer className="w-3.5 h-3.5 text-slate-800" />
              <span>Print GST Receipt</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 text-slate-800 print:p-0 print:overflow-visible">

          {activeTab === 'invoice' ? (
            /* ========================================================================= */
            /* 1. HIGH-DENSITY SINGLE-LINE GST WHOLESALE INVOICE (TALLY/BUSY COMPACT)   */
            /* ========================================================================= */
            <div id="printable-tax-invoice" className="bg-white p-3 sm:p-5 space-y-3 print-area border border-slate-300 rounded-lg shadow-xs text-xs">

              {/* Top Compact Header: Firm & Invoice Metadata */}
              <div className="flex justify-between items-start gap-3 border-b border-slate-300 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-white font-black text-xs">
                      {firmFirstLetter}
                    </div>
                    <span className="text-sm sm:text-base font-black text-slate-950 tracking-tight uppercase">
                      {firmName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {firmAddress}
                  </p>
                  <p className="text-[11px] text-slate-900 font-bold">GSTIN: {firmGstin} <span className="text-slate-500 font-normal">| State: 27 (MH)</span></p>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider">
                      TAX INVOICE
                    </span>
                    {isPaid ? (
                      <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded">
                        PAID
                      </span>
                    ) : isPartiallyPaid ? (
                      <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                        PARTIAL
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded">
                        UNPAID
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-700 text-right space-y-0.5">
                    <p><span className="text-slate-500">Invoice No:</span> <strong className="text-slate-900 font-bold font-mono">{invoice.invoice_number}</strong></p>
                    <p><span className="text-slate-500">Date:</span> <strong className="text-slate-900 font-bold">{formatDate(invoice.date)}</strong></p>
                    <p><span className="text-slate-500">Place of Supply:</span> <strong className="text-slate-900 font-semibold">{invoice.place_of_supply || 'Maharashtra (27)'}</strong></p>
                    {orderInfos.length > 0 && (
                      <p><span className="text-slate-500">Orders:</span> <strong className="text-indigo-900 font-bold font-mono">{orderInfos.map(o => o.orderNumber).join(', ')}</strong></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Billed To (Buyer) & Despatch Details Grid */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-2 text-[11px]">
                <div className="space-y-0.5 pr-2 border-r border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">BUYER (BILL TO)</span>
                  <p className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] leading-snug tracking-tight uppercase">{ret?.shop_name || 'Retailer Store'}</p>
                  <p className="text-slate-700 leading-tight">{ret?.address || 'Local Market Area'}</p>
                  <p className="text-slate-800"><span className="text-slate-500">Prop:</span> {ret?.owner_name || 'N/A'} <span className="text-slate-500">| Ph:</span> {ret?.mobile || ret?.phone || 'N/A'}</p>
                  <p className="font-bold text-slate-900"><span className="text-slate-500 font-normal">GSTIN:</span> {ret?.gstin || 'Unregistered'}</p>
                </div>
                <div className="space-y-0.5 pl-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">DESPATCH &amp; TERMS</span>
                  <p className="text-slate-700 flex justify-between"><span className="text-slate-500">Dispatch Mode:</span> <span className="font-semibold text-slate-800">{challan?.transport_mode || 'Delivery Van'}</span></p>
                  <p className="text-slate-700 flex justify-between"><span className="text-slate-500">Payment Terms:</span> <span className="font-semibold text-slate-800">Credit Account</span></p>
                  {invoice.fulfilment_number && (
                    <p className="text-slate-700 flex justify-between"><span className="text-slate-500">Fulfilment Ref:</span> <span className="font-mono font-bold text-indigo-700">{invoice.fulfilment_number}</span></p>
                  )}
                  {orderInfos.length > 0 && (
                    <p className="text-slate-700 flex justify-between"><span className="text-slate-500">Order Source:</span> <span className="font-semibold text-slate-800">{orderInfos.map(o => o.source.replace('_', ' ')).join(', ')}</span></p>
                  )}
                </div>
              </div>

              {/* Item Quick Search Bar Just Above Items Table (Screen-only) */}
              <div className="no-print flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder="Search item by name, HSN, batch, MRP, pack..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium shadow-2xs"
                  />
                  {itemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setItemSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                      title="Clear item search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-medium text-[11px]">
                  {itemSearchQuery ? (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-md font-bold font-mono">
                      Showing {filteredInvoiceItems.length} of {rawInvoiceItems.length} items
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold font-mono">
                      {rawInvoiceItems.length} items
                    </span>
                  )}
                </div>
              </div>

              {/* Single-Line High-Density Item Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-900 text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                      <th className="py-1 px-1.5 text-center w-7 dense-print-th">#</th>
                      <th className="py-1 px-2 text-left dense-print-th">Description of Goods</th>
                      <th className="py-1 px-1.5 text-center w-16 dense-print-th">HSN</th>
                      <th className="py-1 px-1.5 text-right w-16 dense-print-th">MRP (₹)</th>
                      <th className="py-1 px-2 text-center w-28 dense-print-th">Billed Qty</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Rate/Pc (₹)</th>
                      <th className="py-1 px-1.5 text-right w-14 dense-print-th">Disc (₹)</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Taxable (₹)</th>
                      <th className="py-1 px-1 text-center w-12 dense-print-th">GST</th>
                      <th className="py-1 px-2 text-right w-24 dense-print-th">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredInvoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 text-xs">
                          <div className="space-y-1.5">
                            <p className="font-bold text-slate-700">No invoice items match &ldquo;{itemSearchQuery}&rdquo;</p>
                            <p className="text-[11px] text-slate-400">Try searching with a different product name, HSN or batch number.</p>
                            <button
                              type="button"
                              onClick={() => setItemSearchQuery('')}
                              className="inline-block mt-1 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-bold transition-colors cursor-pointer"
                            >
                              Clear Search Filter
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredInvoiceItems.map((item, idx) => {
                        const prod = products.find(p => p.id === item.product_id);
                        const unitAbbr = formatTradingUnit(item.trading_unit || prod?.trading_unit || 'Carton');
                        const batchNo = item.batch_number || batches?.find(b => b.product_id === item.product_id)?.batch_number;
                        const batchObj = batches?.find(b => b.product_id === item.product_id && b.batch_number === batchNo);
                        const expiryDate = batchObj?.expiry_date ? formatDate(batchObj.expiry_date) : '';
                        const gstRate = prod?.gst_percent ? `${prod.gst_percent}%` : '18%';

                        // Billed Qty Formatter strictly in Pieces
                        const totalPieces = item.base_qty ?? item.quantity ?? (item.loose_qty !== undefined ? item.loose_qty + ((item.carton_qty || 0) * (item.units_per_box_carton || 1)) : 0);
                        const qtyDisplay = `${totalPieces} Pcs`;

                        // Rate strictly per Piece
                        const unitRate = item.rate ?? item.loose_rate ?? item.carton_rate ?? 0;
                        const rateDisplay = `₹${unitRate.toFixed(2)}/Pc`;

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60 print:hover:bg-transparent">
                            {/* 1. Sr. No. */}
                            <td className="py-1 px-1.5 text-center text-slate-500 font-mono text-[10px] dense-print-td">{idx + 1}</td>

                            {/* 2. Description of Goods (Single line + micro meta) */}
                            <td className="py-1 px-2 dense-print-td">
                              <span className="font-bold text-slate-900 leading-tight block">
                                {prod?.name || item.description || item.variant_name || item.product_name || 'FMCG Product'}
                              </span>
                              <span className="text-[9px] text-slate-500 font-normal inline-block print:text-[7pt]">
                                {batchNo && batchNo !== 'N/A' ? `Batch: ${batchNo}` : ''}
                                {expiryDate ? `${batchNo && batchNo !== 'N/A' ? ' • ' : ''}Exp: ${expiryDate}` : ''}
                              </span>
                            </td>

                            {/* 3. HSN */}
                            <td className="py-1 px-1.5 text-center font-mono text-slate-700 text-[10px] dense-print-td">
                              {item.hsn || prod?.hsn || '1902'}
                            </td>

                            {/* 4. MRP */}
                            <td className="py-1 px-1.5 text-right font-mono font-semibold text-slate-800 text-[11px] dense-print-td">
                              {(item.mrp || prod?.mrp || 0).toFixed(2)}
                            </td>

                            {/* 5. Billed Qty */}
                            <td className="py-1 px-2 text-center font-bold text-slate-900 text-[11px] whitespace-nowrap dense-print-td">
                              {qtyDisplay}
                            </td>

                            {/* 6. Rate / Unit */}
                            <td className="py-1 px-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap dense-print-td">
                              {rateDisplay}
                            </td>

                            {/* 7. Disc */}
                            <td className="py-1 px-1.5 text-right font-mono text-slate-600 text-[10px] dense-print-td">
                              {item.discount && item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '—'}
                            </td>

                            {/* 8. Taxable Value */}
                            <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 text-[11px] dense-print-td">
                              {(item.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* 9. GST % */}
                            <td className="py-1 px-1 text-center font-mono text-slate-700 text-[10px] dense-print-td">
                              {gstRate}
                            </td>

                            {/* 10. Line Total */}
                            <td className="py-1 px-2 text-right font-mono font-black text-slate-950 text-[11px] dense-print-td">
                              {(item.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      }))}
                  </tbody>
                </table>
              </div>

              {/* Compact Invoice Totals & Words Declaration */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t border-slate-300 pt-2 text-xs">
                {/* Left Side: Declarations & Amount in Words */}
                <div className="flex-1 space-y-2 max-w-md w-full">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[10px] leading-tight">
                    <strong className="text-slate-800 block uppercase mb-0.5">GST Declaration:</strong>
                    We declare that this invoice shows the actual price of goods described and particulars are true. Taxes are charged under Maharashtra GST (CGST/SGST 9% each for local sales, IGST 18% for interstate).
                  </div>

                  <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">AMOUNT IN WORDS</span>
                    <span className="font-extrabold text-slate-900 text-xs leading-tight block">
                      {numberToWords(invoice.grand_total)}
                    </span>
                  </div>
                </div>

                {/* Right Side: Totals Summary Card */}
                <div className="w-full sm:w-72 space-y-1 text-slate-700 font-semibold bg-slate-50 p-2.5 border border-slate-300 rounded text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-bold text-slate-900 font-mono">₹{(invoice.taxable_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {(invoice.cgst || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST @ 9%:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{(invoice.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST @ 9%:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{(invoice.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  {(invoice.igst || 0) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST @ 18%:</span>
                      <span className="font-bold text-slate-900 font-mono">₹{(invoice.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {invoice.round_off !== undefined && invoice.round_off !== 0 && (
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{invoice.round_off > 0 ? `+₹${invoice.round_off.toFixed(2)}` : `-₹${Math.abs(invoice.round_off).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-950 font-black text-sm border-t border-slate-300 pt-1">
                    <span>GRAND TOTAL:</span>
                    <span className="text-indigo-900 font-mono text-base">₹{(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Compact Footer Signatures */}
              <div className="flex justify-between items-end border-t border-slate-300 pt-3 text-[10px] text-slate-600 font-medium">
                <div>
                  <p>Received Goods in Good Condition</p>
                  <div className="border-t border-dashed border-slate-300 w-32 mt-5 block"></div>
                  <p className="mt-0.5 font-bold text-slate-700">Receiver Signature</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-700 font-semibold">For {firmName}</p>
                  <div className="border-t border-dashed border-slate-300 w-32 mt-5 ml-auto block"></div>
                  <p className="mt-0.5 font-bold text-slate-900">Authorised Signatory</p>
                </div>
              </div>

            </div>
          ) : (
            /* ========================================================================= */
            /* 2. DELIVERY CHALLAN PREVIEW (OPTIONAL TAB SWITCH)                        */
            /* ========================================================================= */
            challan && (
              <div id="printable-tax-invoice" className="bg-white p-4 sm:p-8 space-y-6 sm:space-y-8 print-area border border-slate-200 rounded-xl shadow-xs">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white font-extrabold text-sm">
                        {firmFirstLetter}
                      </div>
                      <span className="text-base font-black text-slate-900 tracking-tight uppercase">
                        {firmName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-[280px]">
                      {firmAddress}
                    </p>
                    <p className="text-xs text-slate-900 font-bold mt-1">GSTIN: {firmGstin}</p>
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-800 border border-cyan-300 rounded text-xs font-black uppercase tracking-wider">
                      DELIVERY CHALLAN
                    </span>
                    <h3 className="text-base font-black text-slate-900 tracking-tight font-mono">{challan.challan_number}</h3>
                    <div className="text-xs space-y-1 text-slate-700 text-right">
                      <p><span className="text-slate-500 font-medium">DISPATCH DATE:</span> <strong className="text-slate-900 font-bold">{formatDate(challan.dispatch_date)}</strong></p>
                      <p><span className="text-slate-500 font-medium">INVOICE REF:</span> <strong className="text-slate-900 font-bold font-mono">{invoice.invoice_number}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 border-y border-slate-200 py-4 text-xs leading-relaxed">
                  <div className="space-y-1.5 pr-4 border-r border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">CONSIGNEE DETAILS</span>
                    <p className="retailer-name-print font-black text-slate-950 text-sm sm:text-base print:text-[11pt] tracking-tight uppercase">{ret?.shop_name || 'Retailer Customer'}</p>
                    <p className="text-slate-700">{ret?.address}</p>
                    <p className="text-slate-600">Phone: {ret?.mobile || ret?.phone || 'N/A'}</p>
                  </div>
                  <div className="pl-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">TRANSPORT / LOGISTICS</span>
                    <p className="text-slate-700 font-semibold">Mode: {challan.transport_mode || 'Delivery Van'}</p>
                    <p className="text-slate-700 font-semibold">Vehicle #: {challan.vehicle_number || 'N/A'}</p>
                    <p className="text-slate-700 font-semibold">Delivery Staff: {challan.delivery_person || 'N/A'}</p>
                  </div>
                </div>

                <div className="overflow-x-auto pt-2">
                  <table className="w-full min-w-[650px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-300 font-bold text-slate-600 uppercase pb-2">
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Product Description</th>
                        <th className="p-2.5 text-center">Batch Number</th>
                        <th className="p-2.5 text-center">MRP</th>
                        <th className="p-2.5 text-right">Dispatched Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {challan.items?.map((item, idx) => {
                        const totalDispatchedPieces = item.dispatched_qty ?? item.base_qty ?? (item.loose_qty !== undefined ? item.loose_qty + ((item.carton_qty || 0) * (item.units_per_box_carton || 1)) : 0);
                        const qtyText = `${totalDispatchedPieces} Pcs`;

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-900">{item.product_name}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-800">{item.batch_number || 'N/A'}</td>
                            <td className="p-2.5 text-center font-bold text-slate-800">₹{(item.mrp || 0).toFixed(2)}</td>
                            <td className="p-2.5 text-right font-extrabold text-slate-900">{qtyText}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-end border-t border-slate-100 pt-10 text-xs text-slate-600 font-medium">
                  <div>
                    <p>Received Goods in Good Condition</p>
                    <div className="border-t border-dashed border-slate-200 w-36 mt-12 block"></div>
                    <p className="mt-1 font-bold text-slate-700">Receiver Signature</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-700 font-semibold">For {firmName}</p>
                    <div className="mt-12 block"></div>
                    <p className="font-bold text-slate-900 text-xs">Authorised Signatory</p>
                  </div>
                </div>
              </div>
            )
          )}

        </div>

        {/* Modal Actions Footer (Screen Only) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center gap-2 cursor-pointer hover:scale-102 active:scale-98"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>Print Tax Invoice</span>
          </button>
        </div>

      </div>
    </div>
  );
}
