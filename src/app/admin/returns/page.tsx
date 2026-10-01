'use client';

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
import { SalesReturn, Retailer, Product, formatQuantityDisplay, calculateBaseQuantity } from '@/lib/db';
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

  const chosenRetailer = useMemo(() => {
    return retailers.find(r => r.id === selectedRetailerId);
  }, [retailers, selectedRetailerId]);

  // Filtered retailers for searchable dropdown
  const filteredRetailers = useMemo(() => {
    if (!retailerSearch.trim()) return retailers;
    const q = retailerSearch.toLowerCase();
    return retailers.filter(r =>
      r.shop_name.toLowerCase().includes(q) ||
      (r.retailer_code || '').toLowerCase().includes(q) ||
      (r.owner_name || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q)
    );
  }, [retailers, retailerSearch]);

  const handleOpenNewReturn = () => {
    setSelectedRetailerId('');
    setReceivingGodownId('');
    setRetailerSearch('');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnReason('');
    // Initialize with 1 empty row
    const firstProd = products[0];
    setReturnItems([
      {
        id: `row-${Date.now()}-1`,
        productId: firstProd?.id || '',
        cartonQty: 0,
        looseQty: 0,
        cartonRate: firstProd?.selling_price || 0,
        looseRate: firstProd?.loose_selling_price || (firstProd ? Math.round((firstProd.selling_price / Math.max(1, firstProd.units_per_box_carton || 1)) * 100) / 100 : 0),
        condition: 'Sellable'
      }
    ]);
    setReturnOpen(true);
  };

  const handleAddRow = () => {
    const firstProd = products[0];
    setReturnItems(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: firstProd?.id || '',
        cartonQty: 0,
        looseQty: 0,
        cartonRate: firstProd?.selling_price || 0,
        looseRate: firstProd?.loose_selling_price || (firstProd ? Math.round((firstProd.selling_price / Math.max(1, firstProd.units_per_box_carton || 1)) * 100) / 100 : 0),
        condition: 'Sellable'
      }
    ]);
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
    const defaultCartonRate = prod?.selling_price || 0;
    const defaultLooseRate = prod?.loose_selling_price || Math.round((defaultCartonRate / Math.max(1, unitsPerPack)) * 100) / 100;

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
      const gstPct = prod?.gst_percent || 18;
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

    const netCredit = Math.round(totalTaxable + totalGst);
    const roundOff = netCredit - (totalTaxable + totalGst);

    return {
      rowDetails,
      totalTaxable: Math.round(totalTaxable * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      cgst: Math.round((totalGst / 2) * 100) / 100,
      sgst: Math.round((totalGst / 2) * 100) / 100,
      netCredit,
      roundOff: Math.round(roundOff * 100) / 100,
      totalBaseUnits,
      activeItemCount
    };
  }, [returnItems, products]);

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRetailerId) {
      alert('Please select a Retailer.');
      return;
    }

    const validRows = returnItems.filter(r => (r.cartonQty > 0 || r.looseQty > 0));
    if (validRows.length === 0) {
      alert('Please enter a return quantity (Cartons or Loose units) for at least one item.');
      return;
    }

    if (!returnReason.trim()) {
      alert('Please enter or select a reason for this sales return.');
      return;
    }

    try {
      const createdReturn = createDirectSalesReturn({
        retailerId: selectedRetailerId,
        returnDate: new Date(returnDate).toISOString(),
        reason: returnReason.trim(),
        receiving_godown_id: receivingGodownId || undefined,
        items: validRows.map(r => ({
          productId: r.productId,
          cartonQty: r.cartonQty,
          looseQty: r.looseQty,
          rate: r.cartonRate,
          looseRate: r.looseRate,
          condition: r.condition
        }))
      });

      const cnNo = createdReturn.credit_note_number || `CN-${createdReturn.id.slice(-5).toUpperCase()}`;
      setSuccessMsg(`Credit Note ${cnNo} generated and ₹${(createdReturn.total_amount || formCalculations.netCredit).toLocaleString('en-IN')} credited to ${chosenRetailer?.shop_name}!`);
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

      const matchCN = cnNo.includes(q);
      const matchRet = ret?.shop_name.toLowerCase().includes(q) || (ret?.retailer_code || '').toLowerCase().includes(q);
      const matchInv = inv?.invoice_number.toLowerCase().includes(q) || false;
      const matchReason = (sr.reason || '').toLowerCase().includes(q);
      const matchItem = sr.items?.some(it => {
        const p = products.find(prod => prod.id === it.product_id);
        return p?.name.toLowerCase().includes(q) || p?.brand.toLowerCase().includes(q);
      }) || false;

      return matchCN || matchRet || matchInv || matchReason || matchItem;
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
          const gst = lineVal * ((prod?.gst_percent || 18) / 100);
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
                const gst = lineVal * ((prod?.gst_percent || 18) / 100);
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
                  <div className="text-xs text-slate-700 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Reason:</span>
                    <span className="font-semibold">{sr.reason || 'Goods Return'}</span>
                  </div>

                  {/* Item List */}
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
                          {r.shop_name} ({r.retailer_code || 'CODE'}) &bull; {r.city || 'Indore'} &bull; Dues: ₹{(r.outstanding || 0).toLocaleString('en-IN')}
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

                  <div className="space-y-1">
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

                {/* 3. Dynamic Product Items Table */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Returned Items &amp; Manual Rates ({returnItems.length})</span>
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

                  <div className="space-y-3">
                    {returnItems.map((row, idx) => {
                      const prod = products.find(p => p.id === row.productId);
                      const unitsPerPack = prod?.units_per_box_carton || 1;
                      const tradingUnit = prod?.trading_unit || 'Carton';
                      const baseUnit = prod?.base_unit || 'Piece';
                      const lineTaxable = (row.cartonQty * row.cartonRate) + (row.looseQty * row.looseRate);
                      const gstPct = prod?.gst_percent || 18;
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
                                Item #{idx + 1} &bull; Product Selection
                              </span>
                              <select
                                value={row.productId}
                                onChange={(e) => handleProductChange(row.id, e.target.value)}
                                className="w-full border border-slate-200 rounded-lg p-2 bg-white text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                              >
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.brand}) &mdash; {p.units_per_box_carton || 1} {p.base_unit || 'Pcs'}/{p.trading_unit || 'Ctn'} &bull; MRP ₹{p.mrp}
                                  </option>
                                ))}
                              </select>
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
                </div>

                {/* 4. Financial & Outstanding Summary Box */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">Credit Note Summary</span>
                    <span className="text-slate-300 font-semibold">{formCalculations.activeItemCount} Active Items &bull; {formCalculations.totalBaseUnits} Units</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>Taxable Value Subtotal:</span>
                      <span className="font-bold text-white">₹{formCalculations.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CGST (9%) + SGST (9%):</span>
                      <span className="font-bold text-white">₹{formCalculations.totalGst.toFixed(2)}</span>
                    </div>
                    {formCalculations.roundOff !== 0 && (
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Round off:</span>
                        <span>₹{formCalculations.roundOff.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
                    <span className="text-sm font-black text-emerald-400">Total Credit Value:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      ₹{formCalculations.netCredit.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {chosenRetailer && (
                    <div className="pt-2 border-t border-slate-800/80 text-xs flex items-center justify-between text-slate-400">
                      <span>Projected Dues:</span>
                      <span className="font-bold text-white">
                        ₹{(chosenRetailer.outstanding || 0).toLocaleString('en-IN')} &rarr;{' '}
                        <strong className="text-emerald-400 font-black">
                          ₹{Math.max(0, (chosenRetailer.outstanding || 0) - formCalculations.netCredit).toLocaleString('en-IN')}
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
                  disabled={!selectedRetailerId || formCalculations.activeItemCount === 0}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>Generate Credit Note &amp; Restock</span>
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
          retailer={retailers.find(r => r.id === (selectedCreditNote.retailer_id || invoices.find(i => i.id === selectedCreditNote.invoice_id)?.retailer_id))}
          products={products}
          onClose={() => setSelectedCreditNote(null)}
        />
      )}
    </div>
  );
}
