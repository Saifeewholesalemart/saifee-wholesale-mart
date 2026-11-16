'use client';

import { hasWords, matchWords } from '@/lib/searchWords';
import React, { useState, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import {
  RotateCcw,
  Plus,
  X,
  CheckCircle,
  FileText,
  Printer,
  Store,
  Trash2,
  AlertCircle,
  IndianRupee,
  Package,
  Calendar,
  ArrowDownRight,
  Search,
  BadgeAlert,
  Warehouse
} from 'lucide-react';
import { SalesReturn, Retailer, Product, Invoice, formatQuantityDisplay, calculateBaseQuantity } from '@/lib/db';
import SmartSearchBar from '@/components/SmartSearchBar';
import CreditNoteModal from '@/components/CreditNoteModal';

interface ManualReturnRow {
  id: string;
  productId: string;
  cartonQty: number;
  looseQty: number;
  cartonRate: number;
  looseRate: number;
  condition: 'Sellable' | 'Damaged';
  /** optional details (some companies ask for them) */
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
}

const emptyRow = (): ManualReturnRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productId: '', cartonQty: 0, looseQty: 0, cartonRate: 0, looseRate: 0, condition: 'Sellable',
  batchNumber: '', mfgDate: '', expiryDate: ''
});

/** Search box for the item of one return row (word search, arrow keys work). */
function ItemPicker({ products, value, onPick, billProductIds }: {
  products: Product[];
  value: string;
  onPick: (id: string) => void;
  billProductIds: Set<string>;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const chosen = products.find(p => p.id === value);
  const list = useMemo(() => {
    const q = text.trim();
    const pool = q ? products.filter(p => matchWords(q, p.name, p.brand, p.sku, p.barcode, p.product_code)) : products.filter(p => billProductIds.has(p.id));
    // items on the chosen bill first
    return [...pool].sort((a, b) => Number(billProductIds.has(b.id)) - Number(billProductIds.has(a.id))).slice(0, 40);
  }, [products, text, billProductIds]);
  return (
    <div className="relative">
      <input
        type="text"
        value={open ? text : (chosen ? chosen.name : '')}
        onFocus={() => { setOpen(true); setText(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        placeholder="Type item name, code or barcode"
        className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-slate-300 rounded-lg shadow-xl max-h-64 overflow-y-auto text-xs">
          {list.length === 0 && (
            <div className="px-3 py-2 text-slate-500">{text.trim() ? 'No item matches.' : 'Type to search the item list.'}</div>
          )}
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(p.id); setText(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-indigo-50 flex justify-between gap-2">
              <span className="font-semibold text-slate-800">{p.name}</span>
              <span className="text-slate-500 shrink-0">{billProductIds.has(p.id) ? 'On bill · ' : ''}MRP ₹{p.mrp}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const COMMON_REASONS = [
  'Damaged / Broken in transit',
  'Expired / Near Expiry Stock',
  'Packaging Leakage / Defective',
  'Slow Moving / Excess Retailer Stock',
  'Rate Difference Adjustment',
  'Customer Return / Brand Recall'
];

export default function AdminReturns() {
  const {
    salesReturns,
    invoices,
    retailers,
    products,
    godowns,
    createDirectSalesReturn
  } = useDb();

  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [receivingGodownId, setReceivingGodownId] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<ManualReturnRow[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedCreditNote, setSelectedCreditNote] = useState<SalesReturn | null>(null);
  const [retailerSearch, setRetailerSearch] = useState('');
  // 'items' = goods come back item by item; 'general' = only an amount is credited
  const [creditType, setCreditType] = useState<'items' | 'general'>('items');
  const [againstInvoiceId, setAgainstInvoiceId] = useState('');
  const [discountMode, setDiscountMode] = useState<'pct' | 'amt'>('pct');
  const [discountValue, setDiscountValue] = useState('');
  const [generalAmount, setGeneralAmount] = useState('');
  const [generalGst, setGeneralGst] = useState('0');
  const [description, setDescription] = useState('');
  const [showBatchFields, setShowBatchFields] = useState(false);

  const shopInvoices = useMemo(() => (invoices as Invoice[])
    .filter(i => i.retailer_id === selectedRetailerId && (i as any).status !== 'Cancelled')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [invoices, selectedRetailerId]);
  const againstInvoice = shopInvoices.find(i => i.id === againstInvoiceId);
  const billProductIds = useMemo(() => new Set((againstInvoice?.items || []).map(it => it.product_id)), [againstInvoice]);

  const chosenRetailer = useMemo(() => {
    return retailers.find(r => r.id === selectedRetailerId);
  }, [retailers, selectedRetailerId]);

  // Filtered retailers for searchable dropdown
  const filteredRetailers = useMemo(() => {
    if (!retailerSearch.trim()) return retailers;
    const q = retailerSearch.toLowerCase();
    return retailers.filter(r =>
      matchWords(q, r.shop_name, (r.retailer_code || ''), (r.owner_name || ''), (r.city || ''))
    );
  }, [retailers, retailerSearch]);

  const handleOpenNewReturn = () => {
    setSelectedRetailerId('');
    setReceivingGodownId('');
    setRetailerSearch('');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnReason('');
    setCreditType('items');
    setAgainstInvoiceId('');
    setDiscountMode('pct');
    setDiscountValue('');
    setGeneralAmount('');
    setGeneralGst('0');
    setDescription('');
    setReturnItems([emptyRow()]);
    setReturnOpen(true);
  };

  const handleAddRow = () => {
    setReturnItems(prev => [...prev, emptyRow()]);
  };

  const setRowField = (rowId: string, patch: Partial<ManualReturnRow>) => {
    setReturnItems(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
  };

  const handleRemoveRow = (rowId: string) => {
    if (returnItems.length <= 1) {
      alert('At least one item row is required.');
      return;
    }
    setReturnItems(prev => prev.filter(r => r.id !== rowId));
  };

  const handleProductChange = (rowId: string, newProdId: string) => {
    const prod = products.find(p => p.id === newProdId);
    const unitsPerPack = prod?.units_per_box_carton || 1;
    // the rate on the chosen bill (after its discount), otherwise the item's sale rate
    const billLine = againstInvoice?.items?.find(it => it.product_id === newProdId);
    const billRate = billLine ? Math.max(0, Number(billLine.carton_rate ?? billLine.rate) - Number(billLine.carton_discount || 0)) : undefined;
    const defaultCartonRate = billRate ?? (prod?.selling_price || 0);
    const defaultLooseRate = billLine
      ? Math.max(0, Number(billLine.loose_rate ?? defaultCartonRate / Math.max(1, unitsPerPack)) - Number(billLine.loose_discount || 0))
      : (prod?.loose_selling_price || Math.round((defaultCartonRate / Math.max(1, unitsPerPack)) * 100) / 100);

    setReturnItems(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        productId: newProdId,
        cartonRate: defaultCartonRate,
        looseRate: defaultLooseRate
      };
    }));
  };

  const handleCartonQtyChange = (rowId: string, val: number) => {
    setReturnItems(prev => prev.map(r => r.id === rowId ? { ...r, cartonQty: Math.max(0, val) } : r));
  };

  const handleLooseQtyChange = (rowId: string, val: number) => {
    setReturnItems(prev => prev.map(r => r.id === rowId ? { ...r, looseQty: Math.max(0, val) } : r));
  };

  const handleCartonRateChange = (rowId: string, val: number) => {
    setReturnItems(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const prod = products.find(p => p.id === r.productId);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      const updatedCartonRate = Math.max(0, val);
      // Automatically update loose rate proportionally if loose rate was default
      const autoLooseRate = Math.round((updatedCartonRate / Math.max(1, unitsPerPack)) * 100) / 100;
      return {
        ...r,
        cartonRate: updatedCartonRate,
        looseRate: autoLooseRate
      };
    }));
  };

  const handleLooseRateChange = (rowId: string, val: number) => {
    setReturnItems(prev => prev.map(r => r.id === rowId ? { ...r, looseRate: Math.max(0, val) } : r));
  };

  const handleConditionChange = (rowId: string, cond: 'Sellable' | 'Damaged') => {
    setReturnItems(prev => prev.map(r => r.id === rowId ? { ...r, condition: cond } : r));
  };

  // Live Calculations for the Return Form
  const formCalculations = useMemo(() => {
    let totalTaxable = 0;
    let totalGst = 0;
    let totalBaseUnits = 0;
    let activeItemCount = 0;

    const rowDetails = returnItems.map(row => {
      const prod = products.find(p => p.id === row.productId);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      const baseUnits = calculateBaseQuantity(row.cartonQty || 0, row.looseQty || 0, unitsPerPack);
      const taxable = (row.cartonQty * row.cartonRate) + (row.looseQty * row.looseRate);
      const gstPct = (prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0;
      const gstAmt = (taxable * gstPct) / 100;
      const lineTotal = taxable + gstAmt;

      if (baseUnits > 0) {
        totalTaxable += taxable;
        totalGst += gstAmt;
        totalBaseUnits += baseUnits;
        activeItemCount += 1;
      }

      return {
        ...row,
        baseUnits,
        taxable,
        gstPct,
        gstAmt,
        lineTotal,
        unitsPerPack,
        tradingUnit: prod?.trading_unit || 'Carton',
        baseUnit: prod?.base_unit || 'Piece'
      };
    });

    // Discount on the whole credit note, shared over the lines by value; GST on the value after it
    const gross = totalTaxable;
    const dv = Math.max(0, Number(discountValue) || 0);
    const discount = Math.round(Math.min(gross, discountMode === 'pct' ? gross * Math.min(100, dv) / 100 : dv) * 100) / 100;
    if (discount > 0 && gross > 0) {
      totalTaxable = 0;
      totalGst = 0;
      rowDetails.forEach(rd => {
        if (rd.baseUnits <= 0) return;
        const t = rd.taxable - discount * rd.taxable / gross;
        totalTaxable += t;
        totalGst += t * rd.gstPct / 100;
      });
    }

    const netCredit = Math.round(totalTaxable + totalGst);
    const roundOff = netCredit - (totalTaxable + totalGst);

    return {
      rowDetails,
      gross: Math.round(gross * 100) / 100,
      discount,
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      cgst: Math.round((totalGst / 2) * 100) / 100,
      sgst: Math.round((totalGst / 2) * 100) / 100,
      netCredit,
      roundOff: Math.round(roundOff * 100) / 100,
      totalBaseUnits,
      activeItemCount
    };
  }, [returnItems, products, discountMode, discountValue]);

  const generalCalc = useMemo(() => {
    const amt = Math.max(0, Number(generalAmount) || 0);
    const gst = Math.round(amt * Math.max(0, Number(generalGst) || 0)) / 100;
    return { amt, gst, total: Math.round(amt + gst) };
  }, [generalAmount, generalGst]);

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRetailerId) {
      alert('Please select a Retailer.');
      return;
    }

    if (!returnReason.trim()) {
      alert('Please enter or select a reason.');
      return;
    }

    const validRows = returnItems.filter(r => r.productId && (r.cartonQty > 0 || r.looseQty > 0));
    if (creditType === 'items') {
      if (validRows.length === 0) {
        alert('Choose an item and enter the returned quantity for at least one row.');
        return;
      }
      const bad = validRows.find(r => r.mfgDate && r.expiryDate && r.mfgDate > r.expiryDate);
      if (bad) {
        alert('The expiry date cannot be before the manufacturing date.');
        return;
      }
    } else if (!(generalCalc.amt > 0)) {
      alert('Enter the amount of the credit note.');
      return;
    }

    try {
      const createdReturn = creditType === 'general'
        ? createDirectSalesReturn({
            retailerId: selectedRetailerId,
            invoiceId: againstInvoiceId || undefined,
            returnDate: new Date(returnDate).toISOString(),
            reason: returnReason.trim(),
            creditType: 'general',
            generalAmount: generalCalc.amt,
            generalGstPercent: Number(generalGst) || 0,
            description: description.trim() || undefined,
            items: []
          })
        : createDirectSalesReturn({
            retailerId: selectedRetailerId,
            invoiceId: againstInvoiceId || undefined,
            returnDate: new Date(returnDate).toISOString(),
            reason: returnReason.trim(),
            receiving_godown_id: receivingGodownId || undefined,
            discount: formCalculations.discount > 0 ? { mode: discountMode, value: Number(discountValue) || 0 } : undefined,
            description: description.trim() || undefined,
            items: validRows.map(r => ({
              productId: r.productId,
              cartonQty: r.cartonQty,
              looseQty: r.looseQty,
              rate: r.cartonRate,
              looseRate: r.looseRate,
              condition: r.condition,
              batchNumber: r.batchNumber.trim() || undefined,
              mfgDate: r.mfgDate || undefined,
              expiryDate: r.expiryDate || undefined
            }))
          });

      const cnNo = createdReturn.credit_note_number || `CN-${createdReturn.id.slice(-5).toUpperCase()}`;
      setSuccessMsg(`Credit Note ${cnNo} saved and ₹${(createdReturn.total_amount ?? 0).toLocaleString('en-IN')} credited to ${chosenRetailer?.shop_name}.`);
      setReturnOpen(false);

      // Open voucher preview modal immediately for easy printing
      setSelectedCreditNote(createdReturn);

      setTimeout(() => setSuccessMsg(''), 7000);
    } catch (err: any) {
      alert(`Failed to save sales return: ${err?.message || 'Unknown error'}`);
    }
  };

  // Filtered Historical Returns for main table
  const filteredReturns = useMemo(() => {
    const sorted = [...salesReturns].sort((a, b) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime());
    if (!returnSearchTerm.trim()) return sorted;
    const q = returnSearchTerm.toLowerCase().trim();

    return sorted.filter(sr => {
      const retId = sr.retailer_id || invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
      const ret = retailers.find(r => r.id === retId);
      const inv = sr.invoice_id ? invoices.find(i => i.id === sr.invoice_id) : undefined;
      const cnNo = (sr.credit_note_number || `CN-${sr.id.slice(-5)}`).toLowerCase();

      const itemWords = (sr.items || []).flatMap(it => {
        const p = products.find(prod => prod.id === it.product_id);
        return [p?.name || '', p?.brand || ''];
      });
      return matchWords(q, cnNo, ret?.shop_name, ret?.retailer_code, inv?.invoice_number, sr.reason, itemWords);
    });
  }, [salesReturns, retailers, invoices, products, returnSearchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalCreditValue = 0;
    let totalItemsReturned = 0;
    salesReturns.forEach(sr => {
      if (sr.total_amount !== undefined) {
        totalCreditValue += sr.total_amount;
      } else {
        sr.items?.forEach(item => {
          const prod = products.find(p => p.id === item.product_id);
          const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
          const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
          const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
          const cRate = item.rate;
          const lRate = item.loose_rate ?? (cRate / unitsPerPack);
          const lineVal = (cQty * cRate) + (lQty * lRate);
          const prodGst = (item.gst_percent !== undefined && (item as any).gst_percent !== null)
            ? Number((item as any).gst_percent)
            : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0);
          const gst = lineVal * (prodGst / 100);
          totalCreditValue += lineVal + gst;
        });
      }
      sr.items?.forEach(it => {
        totalItemsReturned += it.quantity;
      });
    });

    return {
      totalReturnsCount: salesReturns.length,
      totalCreditValue: Math.round(totalCreditValue),
      totalItemsReturned
    };
  }, [salesReturns, products]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">Sales Returns &amp; Credit Notes</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
              Direct Retailer Mode
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manual item entry, custom return rates, direct retailer selection, and instant GST Credit Note voucher generation.
          </p>
        </div>

        <button
          onClick={handleOpenNewReturn}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all self-start cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Return / Credit Note</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-xs animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card bg-white p-4.5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Credit Notes Issued</span>
            <span className="text-xl font-black text-slate-900">{metrics.totalReturnsCount}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Historical Return Vouchers</span>
          </div>
        </div>

        <div className="erp-card bg-white p-4.5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Credit Credited</span>
            <span className="text-xl font-black text-emerald-600">₹{metrics.totalCreditValue.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Adjusted from Retailer Dues</span>
          </div>
        </div>

        <div className="erp-card bg-white p-4.5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Units Returned / Restocked</span>
            <span className="text-xl font-black text-slate-900">{metrics.totalItemsReturned.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Sellable &amp; Damaged Units</span>
          </div>
        </div>
      </div>

      {/* History Log Section */}
      <div className="erp-card bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Issued Credit Notes &amp; Sales Returns ({salesReturns.length})
            </h3>
          </div>

          <div className="w-full sm:max-w-sm">
            <SmartSearchBar
              value={returnSearchTerm}
              onChange={setReturnSearchTerm}
              placeholder="Search Credit Note #, Retailer, Product, Reason..."
              size="sm"
            />
          </div>
        </div>

        {filteredReturns.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-semibold bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            {salesReturns.length === 0
              ? 'No sales returns logged yet. Click "New Sales Return" above to issue a credit note.'
              : `No credit notes matching "${returnSearchTerm}".`}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReturns.map(sr => {
              const retId = sr.retailer_id || invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
              const ret = retailers.find(r => r.id === retId);
              const inv = sr.invoice_id ? invoices.find(i => i.id === sr.invoice_id) : undefined;
              const cnNumber = sr.credit_note_number || `CN-${sr.id.slice(-5).toUpperCase()}`;

              // Compute Total Credit Amount
              const totalAmount = sr.total_amount !== undefined ? sr.total_amount : (sr.items?.reduce((sum, item) => {
                const prod = products.find(p => p.id === item.product_id);
                const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
                const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
                const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
                const cRate = item.rate;
                const lRate = item.loose_rate ?? (cRate / unitsPerPack);
                const lineVal = (cQty * cRate) + (lQty * lRate);
                const prodGst = (item.gst_percent !== undefined && (item as any).gst_percent !== null)
                  ? Number((item as any).gst_percent)
                  : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0);
                const gst = lineVal * (prodGst / 100);
                return sum + lineVal + gst;
              }, 0) || 0);

              const returnDateFmt = sr.return_date
                ? new Date(sr.return_date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })
                : '—';

              const restockGodown = godowns.find(g => g.id === sr.receiving_godown_id);

              return (
                <div
                  key={sr.id}
                  className="border border-slate-200/80 rounded-xl p-4.5 space-y-3 bg-white hover:border-indigo-200 hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm font-mono tracking-tight bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                          {cnNumber}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {returnDateFmt}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {sr.status || 'Confirmed'}
                        </span>
                        {restockGodown && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Warehouse className="w-3 h-3 text-indigo-600" />
                            <span>{restockGodown.name}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-2 pt-0.5">
                        <Store className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Retailer:</span>
                        <strong className="text-slate-900 font-bold">{ret?.shop_name || 'Direct Retailer'}</strong>
                        {ret?.retailer_code && (
                          <span className="text-[11px] text-slate-400 font-mono">({ret.retailer_code})</span>
                        )}
                        {inv && (
                          <span className="text-[11px] text-slate-400 ml-2">
                            &bull; Inv Ref: <strong className="text-slate-700 font-mono">{inv.invoice_number}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-black tracking-wider">Credit Value</span>
                        <span className="font-black text-emerald-600 text-base">
                          -₹{Math.round(totalAmount).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedCreditNote(sr)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View / Print</span>
                      </button>
                    </div>
                  </div>

                  {/* Return Reason Box */}
                  <div className="text-xs text-slate-700 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 flex flex-wrap items-center gap-2">
                    {sr.credit_type === 'general' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900">General credit note</span>
                    )}
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Reason:</span>
                    <span className="font-semibold">{sr.reason || 'Goods Return'}</span>
                    {sr.description && <span className="text-slate-500">· {sr.description}</span>}
                    {Number(sr.discount_amount) > 0 && <span className="text-amber-800 font-semibold">· Discount ₹{Number(sr.discount_amount).toLocaleString('en-IN')}</span>}
                  </div>

                  {/* Item List */}
                  {(sr.items?.length || 0) > 0 && (
                  <div className="text-xs space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Returned Products:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sr.items?.map(item => {
                        const prod = products.find(p => p.id === item.product_id);
                        const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
                        const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
                        const baseUnit = item.base_unit || prod?.base_unit || 'Piece';
                        const cRate = item.rate;

                        return (
                          <div
                            key={item.id}
                            className="p-2.5 bg-white rounded-lg border border-slate-100 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 block text-xs">{prod?.name || 'Product'}</span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Qty: <strong className="text-slate-800">{formatQuantityDisplay(item.quantity, unitsPerPack, tradingUnit, baseUnit)}</strong>
                                {' '}&bull; Rate: ₹{cRate}/{tradingUnit}
                              </span>
                              {(item.batch_number || item.mfg_date || item.expiry_date) && (
                                <span className="text-[10px] text-slate-500 block">
                                  {[item.batch_number ? `Batch ${item.batch_number}` : '', item.mfg_date ? `Mfg ${item.mfg_date}` : '', item.expiry_date ? `Exp ${item.expiry_date}` : ''].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              item.condition === 'Sellable'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {item.condition}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-over Return Creation Modal */}
      {returnOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setReturnOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl border-l border-slate-200 z-50 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <RotateCcw className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">Issue Sales Return &amp; Credit Note</h3>
                  <p className="text-[11px] text-slate-400">Decoupled direct retailer entry with custom rates</p>
                </div>
              </div>
              <button
                onClick={() => setReturnOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <form onSubmit={handleSubmitReturn} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-5">
                
                {/* 1. Retailer Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Select Retailer (Required)</span>
                  </label>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search store name, code, city..."
                        value={retailerSearch}
                        onChange={(e) => setRetailerSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <select
                      value={selectedRetailerId}
                      onChange={(e) => setSelectedRetailerId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                      required
                    >
                      <option value="">-- Choose Retailer Account --</option>
                      {filteredRetailers.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.shop_name} ({r.retailer_code || 'CODE'}) &bull; {r.city || ''} &bull; Dues: ₹{(r.outstanding || 0).toLocaleString('en-IN')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {chosenRetailer && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs mt-2">
                      <div>
                        <span className="font-black text-indigo-950 block">{chosenRetailer.shop_name}</span>
                        <span className="text-[11px] text-indigo-700 font-medium">
                          GSTIN: {chosenRetailer.gstin || 'Unregistered'} &bull; Mobile: {chosenRetailer.mobile || '—'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-indigo-500 uppercase font-black block">Active Outstanding</span>
                        <span className="font-black text-slate-900 text-sm">₹{(chosenRetailer.outstanding || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Type of credit note and the bill it is against */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Type of credit note</span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type of credit note">
                    {([
                      { v: 'items', t: 'Item-wise return', d: 'Goods come back, item by item' },
                      { v: 'general', t: 'General credit note', d: 'Only an amount, no items (rate difference, scheme...)' }
                    ] as const).map(o => (
                      <button key={o.v} type="button" aria-pressed={creditType === o.v} onClick={() => setCreditType(o.v)}
                        className={`text-left rounded-xl p-3 border ${creditType === o.v ? 'border-2 border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <span className="block text-xs font-black text-slate-900">{o.t}</span>
                        <span className="block text-[11px] text-slate-500">{o.d}</span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="cn-bill" className="text-xs font-bold text-slate-700">Against bill <span className="font-normal text-slate-500">(optional)</span></label>
                    <select id="cn-bill" value={againstInvoiceId} onChange={(e) => setAgainstInvoiceId(e.target.value)} disabled={!selectedRetailerId}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white disabled:bg-slate-50">
                      <option value="">No bill (not linked to a bill)</option>
                      {shopInvoices.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.invoice_number} · {new Date(i.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ₹{Number(i.grand_total || 0).toLocaleString('en-IN')}{Number(i.outstanding_amount) > 0 ? ` · due ₹${Number(i.outstanding_amount).toLocaleString('en-IN')}` : ''}
                        </option>
                      ))}
                    </select>
                    {againstInvoiceId && creditType === 'items' && (
                      <span className="text-[11px] text-slate-500 block">Items on this bill come first in the item search, and their bill rate is filled in.</span>
                    )}
                  </div>
                </div>

                {/* 2. Return Date, Godown & Reason */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>Return Date</span>
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                      required
                    />
                  </div>

                  <div className={`space-y-1 ${creditType === 'general' ? 'hidden' : ''}`}>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Restock Godown</span>
                    </label>
                    <select
                      value={receivingGodownId}
                      onChange={(e) => setReceivingGodownId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="">-- Default Godown --</option>
                      {godowns.filter(g => g.status === 'Active').map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.code}){g.is_default ? ' [Default]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <BadgeAlert className="w-3.5 h-3.5 text-slate-500" />
                      <span>Return Reason</span>
                    </label>
                    <input
                      type="text"
                      list="reason-presets"
                      placeholder="e.g. Transit Damage, Expiry..."
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 bg-white"
                      required
                    />
                    <datalist id="reason-presets">
                      {COMMON_REASONS.map(rs => (
                        <option key={rs} value={rs} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Reason Quick Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick:</span>
                  {COMMON_REASONS.slice(0, 4).map(rs => (
                    <button
                      key={rs}
                      type="button"
                      onClick={() => setReturnReason(rs)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                        returnReason === rs
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {rs}
                    </button>
                  ))}
                </div>

                {/* General credit note: amount only */}
                {creditType === 'general' && (
                  <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1 block">
                        <span className="text-[10px] font-black text-slate-500 uppercase block">Amount before GST (₹)</span>
                        <input type="number" min="0" step="0.01" value={generalAmount} onChange={(e) => setGeneralAmount(e.target.value)} placeholder="0.00"
                          className="w-full border border-slate-200 rounded-lg p-2 text-right text-sm font-black text-slate-900 bg-white" />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[10px] font-black text-slate-500 uppercase block">GST %</span>
                        <select value={generalGst} onChange={(e) => setGeneralGst(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-800 bg-white">
                          {['0', '5', '12', '18', '28'].map(g => <option key={g} value={g}>{g}%</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="space-y-1 block">
                      <span className="text-[10px] font-black text-slate-500 uppercase block">What is this credit for? <span className="normal-case font-semibold">(optional)</span></span>
                      <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="For example: rate difference on last bill, scheme for October"
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 bg-white" />
                    </label>
                    <p className="text-[11px] text-slate-500">No stock changes. The amount is taken off the shop&apos;s balance{againstInvoiceId ? ' and off the due of the chosen bill' : ''}.</p>
                  </div>
                )}

                {/* 3. Dynamic Product Items Table */}
                {creditType === 'items' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Returned Items &amp; Manual Rates ({returnItems.length})</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={showBatchFields} onChange={(e) => setShowBatchFields(e.target.checked)} className="w-4 h-4" />
                        Batch / Mfg / Expiry
                      </label>
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Product Row</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {returnItems.map((row, idx) => {
                      const prod = products.find(p => p.id === row.productId);
                      const unitsPerPack = prod?.units_per_box_carton || 1;
                      const tradingUnit = prod?.trading_unit || 'Carton';
                      const baseUnit = prod?.base_unit || 'Piece';
                      const lineTaxable = (row.cartonQty * row.cartonRate) + (row.looseQty * row.looseRate);
                      const gstPct = (prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0;
                      const lineGst = (lineTaxable * gstPct) / 100;
                      const lineTotal = lineTaxable + lineGst;
                      const baseUnits = calculateBaseQuantity(row.cartonQty, row.looseQty, unitsPerPack);

                      return (
                        <div
                          key={row.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 relative group"
                        >
                          {/* Row Header: Product Select & Remove */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                Item #{idx + 1}
                              </span>
                              <ItemPicker products={products} value={row.productId} billProductIds={billProductIds}
                                onPick={(id) => handleProductChange(row.id, id)} />
                              {prod && (
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  {prod.brand ? `${prod.brand} · ` : ''}{prod.units_per_box_carton || 1} {prod.base_unit || 'Pcs'}/{prod.trading_unit || 'Ctn'} · MRP ₹{prod.mrp}
                                </span>
                              )}
                            </div>

                            {returnItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer self-end mb-0.5"
                                title="Remove row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Dual Quantities & Manual Rate Inputs */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            {/* Carton Qty */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase block">
                                {tradingUnit}s
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={row.cartonQty || ''}
                                onChange={(e) => handleCartonQtyChange(row.id, parseInt(e.target.value) || 0)}
                                className="w-full border border-slate-200 rounded-lg p-2 text-center text-xs font-black text-slate-900 bg-white"
                              />
                            </div>

                            {/* Loose Qty */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-indigo-600 uppercase block">
                                Loose {baseUnit}s
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={row.looseQty || ''}
                                onChange={(e) => handleLooseQtyChange(row.id, parseInt(e.target.value) || 0)}
                                className="w-full border border-indigo-200 bg-indigo-50/30 rounded-lg p-2 text-center text-xs font-black text-indigo-700"
                              />
                            </div>

                            {/* Manual Carton Rate */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase block">
                                Rate / {tradingUnit} (₹)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                value={row.cartonRate || ''}
                                onChange={(e) => handleCartonRateChange(row.id, parseFloat(e.target.value) || 0)}
                                className="w-full border border-slate-200 rounded-lg p-2 text-right text-xs font-bold text-slate-800 bg-white"
                              />
                            </div>

                            {/* Manual Loose Rate */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase block">
                                Rate / {baseUnit} (₹)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                value={row.looseRate || ''}
                                onChange={(e) => handleLooseRateChange(row.id, parseFloat(e.target.value) || 0)}
                                className="w-full border border-slate-200 rounded-lg p-2 text-right text-xs font-bold text-slate-800 bg-white"
                              />
                            </div>
                          </div>

                          {/* Optional batch details */}
                          {(showBatchFields || row.batchNumber || row.mfgDate || row.expiryDate) && (
                            <div className="grid grid-cols-3 gap-3">
                              <label className="space-y-1 block">
                                <span className="text-[10px] font-black text-slate-500 uppercase block">Batch No.</span>
                                <input type="text" value={row.batchNumber} onChange={(e) => setRowField(row.id, { batchNumber: e.target.value })} placeholder="Optional"
                                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white" />
                              </label>
                              <label className="space-y-1 block">
                                <span className="text-[10px] font-black text-slate-500 uppercase block">Mfg Date</span>
                                <input type="date" value={row.mfgDate} onChange={(e) => setRowField(row.id, { mfgDate: e.target.value })}
                                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white" />
                              </label>
                              <label className="space-y-1 block">
                                <span className="text-[10px] font-black text-slate-500 uppercase block">Expiry Date</span>
                                <input type="date" value={row.expiryDate} onChange={(e) => setRowField(row.id, { expiryDate: e.target.value })}
                                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white" />
                              </label>
                            </div>
                          )}

                          {/* Row Footer: Condition & Line Total */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Condition:</span>
                              <select
                                value={row.condition}
                                onChange={(e) => handleConditionChange(row.id, e.target.value as any)}
                                className="border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold bg-white text-slate-800"
                              >
                                <option value="Sellable">Sellable (Stock IN)</option>
                                <option value="Damaged">Damaged (Loss / Scrap)</option>
                              </select>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block font-semibold">
                                {baseUnits > 0 ? `${baseUnits} ${baseUnit}s total` : '0 qty'}
                              </span>
                              <span className="font-black text-slate-900 text-xs">
                                Line Credit: ₹{Math.round(lineTotal).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Discount on the credit note */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[150px]">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Discount</span>
                      <span className="text-[11px] text-slate-500">Optional. Taken off the value before GST, shared over the items.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value as 'pct' | 'amt')} aria-label="Discount in"
                        className="border border-slate-200 rounded-lg p-2 text-xs font-bold bg-white">
                        <option value="pct">%</option>
                        <option value="amt">₹</option>
                      </select>
                      <input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" aria-label="Discount"
                        className="w-24 border border-slate-200 rounded-lg p-2 text-right text-xs font-black text-slate-900 bg-white" />
                    </div>
                    {formCalculations.discount > 0 && (
                      <span className="text-xs font-bold text-amber-800">− ₹{formCalculations.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    )}
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Note on credit note <span className="normal-case font-semibold">(optional)</span></span>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 bg-white" />
                  </label>
                </div>
                )}

                {/* 4. Financial & Outstanding Summary Box */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Credit Note Summary</span>
                    <span className="text-slate-300 font-semibold">{creditType === 'general' ? 'Amount only' : `${formCalculations.activeItemCount} items · ${formCalculations.totalBaseUnits} units`}</span>
                  </div>

                  {creditType === 'general' ? (
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between"><span>Amount before GST:</span><span className="font-bold text-white">₹{generalCalc.amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span>GST ({generalGst}%):</span><span className="font-bold text-white">₹{generalCalc.gst.toFixed(2)}</span></div>
                  </div>
                  ) : (
                  <div className="space-y-1.5 text-xs text-slate-300">
                    {formCalculations.discount > 0 && (
                      <>
                        <div className="flex justify-between"><span>Value before discount:</span><span className="font-bold text-white">₹{formCalculations.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between"><span>Discount{discountMode === 'pct' ? ` (${Number(discountValue) || 0}%)` : ''}:</span><span className="font-bold text-amber-300">− ₹{formCalculations.discount.toFixed(2)}</span></div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span>Taxable value:</span>
                      <span className="font-bold text-white">₹{formCalculations.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST:</span>
                      <span className="font-bold text-white">₹{formCalculations.totalGst.toFixed(2)}</span>
                    </div>
                    {formCalculations.roundOff !== 0 && (
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Round off:</span>
                        <span>₹{formCalculations.roundOff.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  )}

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
                    <span className="text-sm font-black text-emerald-400">Total Credit Value:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      ₹{(creditType === 'general' ? generalCalc.total : formCalculations.netCredit).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {chosenRetailer && (
                    <div className="pt-2 border-t border-slate-800/80 text-xs flex items-center justify-between text-slate-400">
                      <span>Projected Dues:</span>
                      <span className="font-bold text-white">
                        ₹{(chosenRetailer.outstanding || 0).toLocaleString('en-IN')} &rarr;{' '}
                        <strong className="text-emerald-400 font-black">
                          ₹{Math.max(0, (chosenRetailer.outstanding || 0) - (creditType === 'general' ? generalCalc.total : formCalculations.netCredit)).toLocaleString('en-IN')}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={!selectedRetailerId || (creditType === 'items' ? formCalculations.activeItemCount === 0 : !(generalCalc.amt > 0))}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>{creditType === 'general' ? 'Save Credit Note' : 'Generate Credit Note & Restock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Note Voucher Print Modal */}
      {selectedCreditNote && (
        <CreditNoteModal
          creditNote={selectedCreditNote}
          invoiceNumber={invoices.find(i => i.id === selectedCreditNote.invoice_id)?.invoice_number}
          retailer={retailers.find(r => r.id === (selectedCreditNote.retailer_id || invoices.find(i => i.id === selectedCreditNote.invoice_id)?.retailer_id))}
          products={products}
          onClose={() => setSelectedCreditNote(null)}
        />
      )}
    </div>
  );
}
