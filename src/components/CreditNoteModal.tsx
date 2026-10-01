'use client';

import React from 'react';
import { X, Printer, CheckCircle, FileText, Building2, Store, Calendar, Tag } from 'lucide-react';
import { SalesReturn, Retailer, Product, BusinessCompany, formatQuantityDisplay } from '@/lib/db';
import { printInvoiceDocument } from '@/lib/printInvoice';

interface CreditNoteModalProps {
  creditNote: SalesReturn;
  retailer?: Retailer;
  products: Product[];
  businessCompany?: BusinessCompany;
  onClose: () => void;
}

export default function CreditNoteModal({
  creditNote,
  retailer,
  products,
  businessCompany,
  onClose
}: CreditNoteModalProps) {
  const cnNumber = creditNote.credit_note_number || `CN-${creditNote.id.slice(-5).toUpperCase()}`;

  const handlePrint = () => {
    printInvoiceDocument('printable-credit-note', `GST Credit Note - ${cnNumber}`);
  };
  const returnDateFormatted = creditNote.return_date
    ? new Date(creditNote.return_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—';

  // Compute fallback totals if not present on legacy records
  let subtotal = creditNote.taxable_amount ?? 0;
  let totalGst = creditNote.gst_amount ?? 0;
  let totalAmount = creditNote.total_amount ?? 0;

  if (subtotal === 0 && (creditNote.items?.length || 0) > 0) {
    let calcSub = 0;
    let calcGst = 0;
    creditNote.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const cRate = item.rate;
      const lRate = item.loose_rate ?? (cRate / unitsPerPack);
      const lineTaxable = (cQty * cRate) + (lQty * lRate);
      const gstPct = item.gst_percent ?? prod?.gst_percent ?? 18;
      const lineGst = (lineTaxable * gstPct) / 100;
      calcSub += lineTaxable;
      calcGst += lineGst;
    });
    subtotal = Math.round(calcSub * 100) / 100;
    totalGst = Math.round(calcGst * 100) / 100;
    totalAmount = Math.round(calcSub + calcGst);
  }

  const cgst = creditNote.cgst ?? (totalGst / 2);
  const sgst = creditNote.sgst ?? (totalGst / 2);
  const igst = creditNote.igst ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Header & Controls (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide uppercase">Credit Note Voucher</h2>
              <p className="text-[11px] text-slate-400 font-medium">Original Document &bull; {cnNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-credit-note" className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 bg-white print:overflow-visible print:p-0">
          
          {/* Header & Company Brand */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
            <div className="space-y-1.5 max-w-md">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider mb-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>Authorized FMCG Distributor</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {businessCompany?.name || 'Saifee General Stores'}
              </h1>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {businessCompany?.address || '124, M.G. Road, Wholesale Market, Indore - 452001 (M.P.)'}
              </p>
              <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 pt-1 font-semibold">
                <span>GSTIN: <strong className="text-slate-800">{businessCompany?.gstin || '23AABCS1429E1Z8'}</strong></span>
                <span>State: <strong className="text-slate-800">Madhya Pradesh (23)</strong></span>
                <span>Phone: <strong className="text-slate-800">+91 98260 12345</strong></span>
              </div>
            </div>

            {/* Credit Note Badge Box */}
            <div className="sm:text-right space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 sm:min-w-[240px]">
              <div className="text-xs font-black uppercase tracking-widest text-indigo-700 bg-indigo-100/70 inline-block px-2.5 py-0.5 rounded">
                GST CREDIT NOTE
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Credit Note Number</span>
                <span className="text-lg font-black text-slate-900 font-mono tracking-tight">{cnNumber}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-6 text-xs pt-1 border-t border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Date</span>
                  <span className="font-bold text-slate-700">{returnDateFormatted}</span>
                </div>
                {creditNote.invoice_id && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Inv Reference</span>
                    <span className="font-bold text-slate-700">{creditNote.invoice_id}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Retailer / Beneficiary Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                <Store className="w-3.5 h-3.5 text-indigo-600" />
                <span>Credited To Retailer</span>
              </div>
              <h3 className="retailer-name-print text-base font-black text-slate-950 print:text-[11pt] tracking-tight uppercase">
                {retailer?.shop_name || 'Direct Retailer Account'}
              </h3>
              <p className="text-xs text-slate-600 font-semibold">
                Proprietor: {retailer?.owner_name || 'Store Owner'}
              </p>
              <p className="text-xs text-slate-500 leading-tight">
                {retailer?.address ? `${retailer.address}, ${retailer.city || 'Indore'}` : 'Indore Wholesale Route'}
              </p>
            </div>

            <div className="space-y-1 sm:text-right flex flex-col sm:items-end justify-center">
              <div className="text-xs text-slate-600">
                Retailer Code: <strong className="font-bold text-slate-900">{retailer?.retailer_code || 'RET-STORE'}</strong>
              </div>
              <div className="text-xs text-slate-600">
                GSTIN: <strong className="font-bold text-slate-900">{retailer?.gstin || 'Unregistered / Consumer'}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Mobile: <strong className="font-bold text-slate-900">{retailer?.mobile || '—'}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Return Reason: <strong className="font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{creditNote.reason || 'Sales Return / Goods Recalled'}</strong>
              </div>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3 text-center">HSN</th>
                  <th className="py-3 px-3 text-center">Return Quantity</th>
                  <th className="py-3 px-3 text-center">Condition</th>
                  <th className="py-3 px-3 text-right">Return Rate</th>
                  <th className="py-3 px-3 text-right">Taxable (₹)</th>
                  <th className="py-3 px-3 text-right">GST</th>
                  <th className="py-3 px-3 text-right">Total Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {creditNote.items?.map((item, index) => {
                  const prod = products.find(p => p.id === item.product_id);
                  const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
                  const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
                  const baseUnit = item.base_unit || prod?.base_unit || 'Piece';
                  const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
                  const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
                  const cRate = item.rate;
                  const lRate = item.loose_rate ?? (cRate / unitsPerPack);
                  const lineTaxable = item.taxable_value ?? ((cQty * cRate) + (lQty * lRate));
                  const gstPct = item.gst_percent ?? prod?.gst_percent ?? 18;
                  const lineGst = item.gst_amount ?? ((lineTaxable * gstPct) / 100);
                  const lineTotal = item.total_amount ?? (lineTaxable + lineGst);

                  return (
                    <tr key={item.id || index} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">{index + 1}</td>
                      <td className="py-3 px-3">
                        <span className="font-black text-slate-900 block">{prod?.name || 'Product Item'}</span>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          Brand: {prod?.brand || '—'} &bull; Pack: {unitsPerPack} {baseUnit}s/{tradingUnit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-600">
                        {item.hsn || prod?.hsn || '19053100'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-extrabold text-slate-800 block">
                          {formatQuantityDisplay(item.quantity, unitsPerPack, tradingUnit, baseUnit)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({item.quantity} base {baseUnit}s)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          item.condition === 'Sellable'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {item.condition}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-slate-800 block">₹{cRate.toLocaleString('en-IN')}/{tradingUnit}</span>
                        {lQty > 0 && (
                          <span className="text-[10px] text-slate-500 block">Loose: ₹{Math.round(lRate * 100) / 100}/{baseUnit}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        ₹{lineTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        <span className="font-semibold block">{gstPct}%</span>
                        <span className="text-[10px] text-slate-500 block">₹{lineGst.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals and Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Left Box: Terms & Ledger Reduction Notice */}
            <div className="space-y-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-black uppercase tracking-wide">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Retailer Ledger Credited</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                The total credit value of <strong className="text-slate-900 font-black">₹{totalAmount.toLocaleString('en-IN')}</strong> has been credited to <strong className="text-slate-900 font-bold">{retailer?.shop_name || 'Retailer Account'}</strong>. This amount reduces the retailer&apos;s active outstanding dues.
              </p>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60">
                Stock Condition: Items marked <span className="font-bold text-emerald-700">Sellable</span> have been restored to inventory. Items marked <span className="font-bold text-red-700">Damaged</span> are written off.
              </div>
            </div>

            {/* Right Box: Tax Breakdown Subtotal */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {igst > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Integrated GST (IGST):</span>
                  <span className="font-bold text-slate-900">₹{igst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Central GST (CGST):</span>
                    <span className="font-bold text-slate-900">₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>State GST (SGST):</span>
                    <span className="font-bold text-slate-900">₹{sgst.toFixed(2)}</span>
                  </div>
                </>
              )}
              {creditNote.round_off !== undefined && creditNote.round_off !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Round Off:</span>
                  <span className="font-bold text-slate-900">₹{creditNote.round_off.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm sm:text-base font-black text-indigo-700 pt-2 border-t border-slate-200">
                <span>Total Credit Note Value:</span>
                <span>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="flex justify-between items-end pt-8 text-xs text-slate-500 border-t border-slate-200">
            <div>
              <p className="font-semibold">Receiver / Retailer Signature</p>
              <div className="h-12 border-b border-dashed border-slate-300 w-44 mt-1"></div>
            </div>
            <div className="text-right">
              <p className="font-semibold">For {businessCompany?.name || 'Saifee General Stores'}</p>
              <div className="h-12 border-b border-dashed border-slate-300 w-48 mt-1"></div>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Authorized Signatory</p>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls (Hidden in print) */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 bg-slate-100 border-t border-slate-200 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Credit Note</span>
          </button>
        </div>

      </div>
    </div>
  );
}
