'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  X, Edit3, Plus, Trash2, AlertTriangle, CheckCircle, Store, 
  FileText, ArrowRight, DollarSign, Package, ShieldCheck, RefreshCw, Calendar, MapPin
} from 'lucide-react';
import { Invoice, InvoiceItem, Product, formatQuantityDisplay, splitBaseQuantity, calculateItemAmounts } from '@/lib/db';

interface InvoiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess?: (updatedInvoice: Invoice) => void;
}

interface EditableLineItem {
  tempId: string;
  id?: string;
  product_id: string;
  hsn: string;
  packing: string;
  trading_unit: string;
  base_unit: string;
  units_per_trading_unit: number;
  units_per_box_carton: number;
  carton_qty: number;
  loose_qty: number;
  carton_rate: number;
  loose_rate: number;
  carton_discount: number;
  loose_discount: number;
  gst_percent: number;
  batch_number?: string;
  batch_id?: string;
  mrp?: number;
  purchase_rate?: number;
  manual_rate_applied?: boolean;
  manual_rate_reason?: string;
}

export default function InvoiceEditModal({
  isOpen,
  onClose,
  invoice,
  onSuccess
}: InvoiceEditModalProps) {
  const { products, retailers, updateInvoice, currentUser } = useDb();

  const [date, setDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([]);
  const [reason, setReason] = useState('');
  const [selectedAddProductId, setSelectedAddProductId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Find retailer
  const retailer = useMemo(() => {
    if (!invoice) return null;
    return retailers.find(r => r.id === invoice.retailer_id) || null;
  }, [invoice, retailers]);

  // Initialize form state when modal opens
  useEffect(() => {
    if (invoice && isOpen) {
      setDate(invoice.date ? invoice.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setPlaceOfSupply(invoice.place_of_supply || (retailer?.state_code === '27' ? 'Maharashtra (27)' : 'Out of State'));
      setPaidAmount(invoice.paid_amount || 0);
      setReason('');
      setErrorMsg('');

      // Map invoice items to editable state
      const initialItems: EditableLineItem[] = (invoice.items || []).map((item, idx) => {
        const prod = products.find(p => p.id === item.product_id);
        const unitsPerPack = item.units_per_trading_unit || item.units_per_box_carton || prod?.units_per_box_carton || 1;
        const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor((item.base_qty ?? item.quantity) / unitsPerPack);
        const lQty = item.loose_qty !== undefined ? item.loose_qty : ((item.base_qty ?? item.quantity) % unitsPerPack);
        const cRate = item.carton_rate ?? item.rate ?? prod?.selling_price ?? 0;
        const lRate = item.loose_rate ?? prod?.loose_selling_price ?? (Math.round((cRate / Math.max(1, unitsPerPack)) * 100) / 100);

        return {
          tempId: `item-${idx}-${Date.now()}`,
          id: item.id,
          product_id: item.product_id,
          hsn: item.hsn || prod?.hsn || '0000',
          packing: item.packing || prod?.pack_size || `${unitsPerPack} units/${item.trading_unit || 'Carton'}`,
          trading_unit: item.trading_unit || prod?.trading_unit || 'Carton',
          base_unit: item.base_unit || prod?.base_unit || 'Piece',
          units_per_trading_unit: unitsPerPack,
          units_per_box_carton: unitsPerPack,
          carton_qty: cQty,
          loose_qty: lQty,
          carton_rate: cRate,
          loose_rate: lRate,
          carton_discount: item.carton_discount ?? 0,
          loose_discount: item.loose_discount ?? 0,
          gst_percent: prod?.gst_percent ?? 18,
          batch_number: item.batch_number,
          batch_id: item.batch_id,
          mrp: item.mrp ?? prod?.mrp,
          purchase_rate: item.purchase_rate ?? prod?.purchase_price,
          manual_rate_applied: item.manual_rate_applied || item.rate_override_applied,
          manual_rate_reason: item.manual_rate_reason || item.override_reason
        };
      });

      setLineItems(initialItems);
    }
  }, [invoice, isOpen, products, retailer]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Calculations for all current items
  const computedSummary = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const isLocal = (retailer?.state_code || '27') === '27';

    const calculatedItems = lineItems.map(item => {
      const amounts = calculateItemAmounts(
        item.carton_qty,
        item.loose_qty,
        item.carton_rate,
        item.loose_rate,
        item.carton_discount,
        item.loose_discount,
        item.gst_percent
      );

      let itemCGST = 0;
      let itemSGST = 0;
      let itemIGST = 0;

      if (isLocal) {
        itemCGST = amounts.gstAmount / 2;
        itemSGST = amounts.gstAmount / 2;
      } else {
        itemIGST = amounts.gstAmount;
      }

      subtotal += amounts.grossAmount;
      discountTotal += amounts.discountAmount;
      taxableTotal += amounts.taxableAmount;
      cgstTotal += itemCGST;
      sgstTotal += itemSGST;
      igstTotal += itemIGST;

      const totalBaseUnits = (item.carton_qty * item.units_per_trading_unit) + item.loose_qty;

      return {
        ...item,
        totalBaseUnits,
        taxable_value: amounts.taxableAmount,
        cgst: itemCGST,
        sgst: itemSGST,
        igst: itemIGST,
        total_amount: amounts.totalAmount,
        gross_amount: amounts.grossAmount,
        discount_amount: amounts.discountAmount
      };
    });

    const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = Math.round((grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal)) * 100) / 100;
    const newOutstanding = Math.max(0, grandTotal - paidAmount);

    // Delta calculations
    const oldGrandTotal = invoice?.grand_total || 0;
    const oldUnpaid = (invoice?.grand_total || 0) - (invoice?.paid_amount || 0);
    const newUnpaid = grandTotal - paidAmount;
    const grandTotalDelta = grandTotal - oldGrandTotal;
    const retailerOutstandingDelta = newUnpaid - oldUnpaid;

    const currentRetailerOutstanding = retailer?.outstanding || 0;
    const projectedRetailerOutstanding = Math.max(0, Math.round((currentRetailerOutstanding + retailerOutstandingDelta) * 100) / 100);

    return {
      calculatedItems,
      subtotal,
      discountTotal,
      taxableTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      roundOff,
      grandTotal,
      newOutstanding,
      grandTotalDelta,
      retailerOutstandingDelta,
      currentRetailerOutstanding,
      projectedRetailerOutstanding
    };
  }, [lineItems, retailer, paidAmount, invoice]);

  if (!isOpen || !invoice || !retailer) return null;

  // Add new product line item
  const handleAddProduct = () => {
    if (!selectedAddProductId) return;
    const prod = products.find(p => p.id === selectedAddProductId);
    if (!prod) return;

    // Check if already in list
    const existingIndex = lineItems.findIndex(i => i.product_id === prod.id);
    if (existingIndex !== -1) {
      // Increase carton qty of existing
      const updated = [...lineItems];
      updated[existingIndex].carton_qty += 1;
      setLineItems(updated);
      setSelectedAddProductId('');
      return;
    }

    const unitsPerPack = prod.units_per_box_carton || 1;
    const cRate = prod.selling_price || 0;
    const lRate = prod.loose_selling_price || (Math.round((cRate / Math.max(1, unitsPerPack)) * 100) / 100);

    const newItem: EditableLineItem = {
      tempId: `item-new-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      product_id: prod.id,
      hsn: prod.hsn || '0000',
      packing: prod.pack_size || `${unitsPerPack} units/${prod.trading_unit || 'Carton'}`,
      trading_unit: prod.trading_unit || 'Carton',
      base_unit: prod.base_unit || 'Piece',
      units_per_trading_unit: unitsPerPack,
      units_per_box_carton: unitsPerPack,
      carton_qty: 1,
      loose_qty: 0,
      carton_rate: cRate,
      loose_rate: lRate,
      carton_discount: prod.carton_discount || 0,
      loose_discount: prod.loose_discount || 0,
      gst_percent: prod.gst_percent || 18,
      mrp: prod.mrp,
      purchase_rate: prod.purchase_price
    };

    setLineItems([...lineItems, newItem]);
    setSelectedAddProductId('');
  };

  const handleRemoveItem = (tempId: string) => {
    if (lineItems.length <= 1) {
      alert('An invoice must contain at least one line item.');
      return;
    }
    setLineItems(lineItems.filter(i => i.tempId !== tempId));
  };

  const handleUpdateItemField = (tempId: string, field: keyof EditableLineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const updated = { ...item, [field]: value };
      
      // Auto adjust loose rate if carton rate changed
      if (field === 'carton_rate' && (!item.loose_rate || item.loose_rate === item.carton_rate / item.units_per_trading_unit)) {
        updated.loose_rate = Math.round((Number(value) / Math.max(1, item.units_per_trading_unit)) * 100) / 100;
      }
      return updated;
    }));
  };

  const handleSave = () => {
    setErrorMsg('');

    if (lineItems.length === 0) {
      setErrorMsg('Invoice must contain at least one line item.');
      return;
    }

    const hasInvalidQty = lineItems.some(i => (i.carton_qty <= 0 && i.loose_qty <= 0));
    if (hasInvalidQty) {
      setErrorMsg('Each item must have a valid quantity greater than 0.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please specify a reason for editing this generated invoice (Required for audit trail).');
      return;
    }

    setIsSubmitting(true);

    try {
      // Map to InvoiceItem format
      const formattedItems: InvoiceItem[] = computedSummary.calculatedItems.map(item => ({
        id: item.id || `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        invoice_id: invoice.id,
        product_id: item.product_id,
        hsn: item.hsn,
        packing: item.packing,
        quantity: item.totalBaseUnits,
        carton_qty: item.carton_qty,
        loose_qty: item.loose_qty,
        base_qty: item.totalBaseUnits,
        trading_unit: item.trading_unit,
        base_unit: item.base_unit,
        units_per_trading_unit: item.units_per_trading_unit,
        units_per_box_carton: item.units_per_box_carton,
        rate: item.carton_rate,
        carton_rate: item.carton_rate,
        loose_rate: item.loose_rate,
        discount: item.discount_amount,
        carton_discount: item.carton_discount,
        loose_discount: item.loose_discount,
        taxable_value: item.taxable_value,
        cgst: item.cgst,
        sgst: item.sgst,
        igst: item.igst,
        total_amount: item.total_amount,
        batch_number: item.batch_number,
        batch_id: item.batch_id,
        mrp: item.mrp,
        purchase_rate: item.purchase_rate,
        manual_billing_rate: item.carton_rate,
        rate_override_applied: item.manual_rate_applied,
        manual_rate_applied: item.manual_rate_applied,
        manual_rate_reason: item.manual_rate_reason
      }));

      const res = updateInvoice(
        invoice.id,
        {
          date: new Date(date).toISOString(),
          place_of_supply: placeOfSupply,
          items: formattedItems,
          paid_amount: paidAmount
        },
        reason.trim(),
        {
          id: currentUser.id,
          name: currentUser.name
        }
      );

      if (res && res.invoice) {
        if (onSuccess) onSuccess(res.invoice);
        onClose();
      } else {
        setErrorMsg('Failed to update invoice. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving invoice changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Sticky Top Header: ALWAYS displays Invoice No & Retailer Name */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-black uppercase tracking-wider">
                Admin Invoice Editor
              </span>
              <span className="text-slate-400 text-xs">&bull;</span>
              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin-slow text-emerald-400" />
                Bidirectional Order & Stock Auto-Sync Active
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-black text-white tracking-tight">
                INVOICE: <span className="text-indigo-300 font-mono">{invoice.invoice_number}</span>
              </h2>
              <span className="text-slate-500 font-bold hidden sm:inline">&bull;</span>
              <div className="flex items-center gap-1.5 text-xs text-amber-200 font-bold">
                <Store className="w-4 h-4 text-amber-300" />
                <span>RETAILER: {retailer.shop_name}</span>
                <span className="text-slate-300 font-normal text-xs">({retailer.owner_name}, {retailer.city || 'MH'})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 uppercase font-bold block tracking-wider">Current Invoice Total</span>
              <span className="text-sm font-black text-white">₹{invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Metadata Bar (Date, Place of Supply, Paid Amount) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Invoice Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                Place of Supply
              </label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="e.g. Maharashtra (27)"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                Paid Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-xs"
              />
            </div>
          </div>

          {/* Line Items Editor Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>Invoice Line Items ({lineItems.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Edit quantities, rates, or discounts. Taxes and totals auto-calculate in real time.</p>
              </div>

              {/* Add Product Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedAddProductId}
                  onChange={(e) => setSelectedAddProductId(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 max-w-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">-- Add Product to Invoice --</option>
                  {products.filter(p => p.active !== false).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ₹{p.selling_price}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!selectedAddProductId}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Table of Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Product Name</th>
                      <th className="py-3 px-2 text-center">Cartons</th>
                      <th className="py-3 px-2 text-center">Loose Units</th>
                      <th className="py-3 px-2 text-center">Total Base Units</th>
                      <th className="py-3 px-2 text-right">Carton Rate (₹)</th>
                      <th className="py-3 px-2 text-right">Carton Disc (₹)</th>
                      <th className="py-3 px-2 text-center">GST %</th>
                      <th className="py-3 px-3 text-right">Line Total (₹)</th>
                      <th className="py-3 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {computedSummary.calculatedItems.map((item) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <tr key={item.tempId} className="hover:bg-indigo-50/20 transition-colors">
                          {/* Product Info */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 leading-tight text-sm">
                                {prod?.name || item.packing || 'Item'}
                              </span>
                              {(item.mrp || prod?.mrp) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  MRP ₹{item.mrp || prod?.mrp}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                              <span>HSN: {item.hsn}</span>
                            </div>
                          </td>

                          {/* Carton Qty Input */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.carton_qty}
                              onChange={(e) => handleUpdateItemField(item.tempId, 'carton_qty', Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 text-center bg-slate-50 hover:bg-white focus:bg-white border border-slate-250 focus:border-indigo-500 rounded px-1.5 py-1 font-bold text-slate-800 text-xs"
                            />
                            <span className="text-xs text-slate-500 font-bold block mt-0.5">{item.trading_unit}</span>
                          </td>

                          {/* Loose Qty Input */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.units_per_trading_unit - 1}
                              step="1"
                              value={item.loose_qty}
                              onChange={(e) => handleUpdateItemField(item.tempId, 'loose_qty', Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 text-center bg-slate-50 hover:bg-white focus:bg-white border border-slate-250 focus:border-indigo-500 rounded px-1.5 py-1 font-bold text-slate-800 text-xs"
                            />
                            <span className="text-xs text-slate-500 font-bold block mt-0.5">{item.base_unit}</span>
                          </td>

                          {/* Total Base Units Display */}
                          <td className="py-2.5 px-2 text-center font-extrabold text-slate-700 text-xs">
                            <span>{item.totalBaseUnits}</span>
                            <span className="text-xs text-slate-500 block font-normal">{item.base_unit}s</span>
                          </td>

                          {/* Carton Rate Input */}
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.carton_rate}
                              onChange={(e) => handleUpdateItemField(item.tempId, 'carton_rate', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-20 text-right bg-slate-50 hover:bg-white focus:bg-white border border-slate-250 focus:border-indigo-500 rounded px-1.5 py-1 font-bold text-slate-800 text-xs"
                            />
                            {item.loose_qty > 0 && (
                              <span className="text-xs text-indigo-700 block mt-0.5 font-bold">
                                Loose: ₹{item.loose_rate.toFixed(2)}
                              </span>
                            )}
                          </td>

                          {/* Discount Input */}
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.carton_discount}
                              onChange={(e) => handleUpdateItemField(item.tempId, 'carton_discount', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-16 text-right bg-slate-50 hover:bg-white focus:bg-white border border-slate-250 focus:border-indigo-500 rounded px-1.5 py-1 font-bold text-red-600 text-xs"
                            />
                            <span className="text-xs text-slate-500 font-medium block mt-0.5">₹/ctn</span>
                          </td>

                          {/* GST % */}
                          <td className="py-2.5 px-2 text-center font-semibold text-slate-700 text-xs">
                            {item.gst_percent}%
                          </td>

                          {/* Line Total */}
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            ₹{item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Remove Button */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.tempId)}
                              title="Remove item"
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Financial Totals & Impact Analysis Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
            {/* Left: Cascading Impact Card */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Automatic Cascading Impact</span>
              </h4>

              {/* Retailer Outstanding Impact Box */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Retailer Current Outstanding:</span>
                  <span className="font-bold text-slate-800">₹{computedSummary.currentRetailerOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Invoice Adjustment Delta:</span>
                  <span className={`font-black ${computedSummary.retailerOutstandingDelta > 0 ? 'text-red-600' : computedSummary.retailerOutstandingDelta < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {computedSummary.retailerOutstandingDelta > 0 ? `+₹${computedSummary.retailerOutstandingDelta.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : computedSummary.retailerOutstandingDelta < 0 ? `-₹${Math.abs(computedSummary.retailerOutstandingDelta).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 font-black">
                  <span className="text-indigo-900">Projected New Retailer Outstanding:</span>
                  <span className="text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    ₹{computedSummary.projectedRetailerOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Mandatory Reason Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Invoice Edit <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this invoice is being adjusted (e.g. Corrected quantity upon delivery, special approved discount, rate revision)..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            {/* Right: Revised Totals Card */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs font-semibold text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal (Gross Value):</span>
                <span className="text-slate-800 font-bold">₹{computedSummary.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {computedSummary.discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Total Discount:</span>
                  <span>-₹{computedSummary.discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Taxable Value:</span>
                <span className="text-slate-800 font-bold">₹{computedSummary.taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {computedSummary.cgstTotal > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST:</span>
                    <span>₹{computedSummary.cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST:</span>
                    <span>₹{computedSummary.sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
              {computedSummary.igstTotal > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>IGST (Interstate):</span>
                  <span>₹{computedSummary.igstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 font-medium">
                <span>Round Off:</span>
                <span>₹{computedSummary.roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-slate-900 text-sm">
                <span>REVISED GRAND TOTAL:</span>
                <span className="text-indigo-650 text-base">₹{computedSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">Revised Outstanding (Unpaid):</span>
                <span className={`font-black ${computedSummary.newOutstanding > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {computedSummary.newOutstanding > 0 ? `₹${computedSummary.newOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Fully Paid'}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Invoice Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
