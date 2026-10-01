'use client';

import React, { useState, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Search, Filter, History, Package, ClipboardList, Info, Tags, 
  Warehouse, ArrowLeftRight, Plus, CheckCircle2, AlertCircle, 
  ArrowRight, Truck, CheckCheck, Clock, X, ShieldAlert, Layers
} from 'lucide-react';
import { formatQuantityDisplay, calculateBaseQuantity, splitBaseQuantity, formatUnitName } from '@/lib/db';
import SmartSearchBar from '@/components/SmartSearchBar';
import Link from 'next/link';

export default function AdminInventory() {
  const { 
    products, 
    inventory, 
    batches, 
    ledger, 
    companies, 
    categories, 
    productCategories,
    godowns,
    selectedGodownId,
    setSelectedGodownId,
    stockTransfers,
    getConsolidatedInventory,
    createStockTransfer,
    dispatchStockTransfer,
    receiveStockTransfer,
    cancelStockTransfer,
    adjustStock,
    activeCompany
  } = useDb();
  
  const getCategoryIdsForProduct = (productId: string) => {
    return (productCategories || []).filter(pc => pc.product_id === productId).map(pc => pc.category_id);
  };

  const getCategoriesForProduct = (productId: string) => {
    const ids = getCategoryIdsForProduct(productId);
    return (categories || []).filter(c => ids.includes(c.id));
  };

  const [activeTab, setActiveTab] = useState<'status' | 'batches' | 'transfers' | 'ledger'>('status');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Check URL query param for tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      if (tab === 'transfers' || tab === 'batches' || tab === 'ledger') {
        setActiveTab(tab);
      }
    }
  }, []);

  // Transfer Modals State
  const [isNewTransferOpen, setIsNewTransferOpen] = useState(false);
  const [transferFromGodown, setTransferFromGodown] = useState('');
  const [transferToGodown, setTransferToGodown] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<{
    productId: string;
    batchNumber?: string;
    cartonQty: number;
    looseQty: number;
  }[]>([{ productId: '', cartonQty: 0, looseQty: 0 }]);
  const [transferModalError, setTransferModalError] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(true);

  // Receive Transfer Modal State
  const [receivingTransfer, setReceivingTransfer] = useState<typeof stockTransfers[0] | null>(null);
  const [receiptInputs, setReceiptInputs] = useState<{ [itemId: string]: { cartonQty: number; looseQty: number } }>({});
  const [receiveModalError, setReceiveModalError] = useState('');

  // Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustGodownId, setAdjustGodownId] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjustCartonQty, setAdjustCartonQty] = useState(0);
  const [adjustLooseQty, setAdjustLooseQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('Stock Count Correction / Audit');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustBatchNumber, setAdjustBatchNumber] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // Consolidated Inventory Map
  const consolidatedInv = getConsolidatedInventory();

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchComp = filterCompany === 'all' || p.company_id === filterCompany;
    const catIds = getCategoryIdsForProduct(p.id);
    const matchCat = filterCategory === 'all' 
      ? true 
      : filterCategory === 'uncategorized' 
      ? catIds.length === 0 
      : catIds.includes(filterCategory);

    const matchSearch = searchTerm.trim() === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hsn.includes(searchTerm) ||
      (p.barcode && p.barcode.includes(searchTerm));

    return matchComp && matchCat && matchSearch;
  });

  // Open New Transfer Modal
  const openNewTransferModal = () => {
    setTransferModalError('');
    const defaultFrom = godowns.find(g => g.is_default)?.id || godowns[0]?.id || '';
    const defaultTo = godowns.find(g => g.id !== defaultFrom)?.id || '';
    setTransferFromGodown(defaultFrom);
    setTransferToGodown(defaultTo);
    setTransferNotes('');
    setTransferItems([{ productId: products[0]?.id || '', cartonQty: 1, looseQty: 0 }]);
    setAutoDispatch(true);
    setIsNewTransferOpen(true);
  };

  const handleAddTransferItem = () => {
    setTransferItems([...transferItems, { productId: products[0]?.id || '', cartonQty: 1, looseQty: 0 }]);
  };

  const handleRemoveTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleTransferItemChange = (index: number, field: string, value: any) => {
    const updated = [...transferItems];
    updated[index] = { ...updated[index], [field]: value };
    setTransferItems(updated);
  };

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferModalError('');

    if (!transferFromGodown || !transferToGodown) {
      setTransferModalError('Please select both source and destination godowns.');
      return;
    }
    if (transferFromGodown === transferToGodown) {
      setTransferModalError('Source and destination godowns cannot be identical.');
      return;
    }
    if (transferItems.length === 0) {
      setTransferModalError('Please add at least one item to transfer.');
      return;
    }

    try {
      createStockTransfer({
        fromGodownId: transferFromGodown,
        toGodownId: transferToGodown,
        notes: transferNotes.trim(),
        items: transferItems.map(it => ({
          productId: it.productId,
          batchNumber: it.batchNumber,
          cartonQty: Number(it.cartonQty) || 0,
          looseQty: Number(it.looseQty) || 0
        })),
        autoDispatch
      });
      setIsNewTransferOpen(false);
    } catch (err: any) {
      setTransferModalError(err?.message || 'Failed to create stock transfer.');
    }
  };

  // Open Receive Modal
  const openReceiveModal = (tr: typeof stockTransfers[0]) => {
    setReceiveModalError('');
    setReceivingTransfer(tr);
    const inputs: { [itemId: string]: { cartonQty: number; looseQty: number } } = {};
    tr.items.forEach(it => {
      const prod = products.find(p => p.id === it.product_id);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      const unreceivedBase = Math.max(0, it.quantity - (it.received_qty || 0));
      const split = splitBaseQuantity(unreceivedBase, unitsPerPack);
      inputs[it.id] = { cartonQty: split.cartonQty, looseQty: split.looseQty };
    });
    setReceiptInputs(inputs);
  };

  const handleConfirmReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingTransfer) return;
    setReceiveModalError('');

    try {
      const receipts = receivingTransfer.items.map(it => {
        const prod = products.find(p => p.id === it.product_id);
        const unitsPerPack = prod?.units_per_box_carton || 1;
        const input = receiptInputs[it.id] || { cartonQty: 0, looseQty: 0 };
        const receivedBase = calculateBaseQuantity(input.cartonQty, input.looseQty, unitsPerPack);
        return {
          itemId: it.id,
          receivedQty: receivedBase,
          receivedCartonQty: input.cartonQty,
          receivedLooseQty: input.looseQty
        };
      });

      receiveStockTransfer(receivingTransfer.id, receipts);
      setReceivingTransfer(null);
    } catch (err: any) {
      setReceiveModalError(err?.message || 'Failed to record stock receipt.');
    }
  };

  // Open Adjustment Modal
  const openAdjustmentModal = (prodId?: string, gId?: string) => {
    setAdjustError('');
    setAdjustProductId(prodId || products[0]?.id || '');
    setAdjustGodownId(gId || (selectedGodownId !== 'all' ? selectedGodownId : (godowns.find(g => g.is_default)?.id || godowns[0]?.id || '')));
    setAdjustDirection('IN');
    setAdjustCartonQty(1);
    setAdjustLooseQty(0);
    setAdjustReason('Physical Inventory Audit Correction');
    setAdjustNotes('');
    setAdjustBatchNumber('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');

    if (!adjustProductId) {
      setAdjustError('Please select a product.');
      return;
    }
    if (!adjustGodownId) {
      setAdjustError('Please select a godown facility.');
      return;
    }

    try {
      adjustStock(
        adjustProductId,
        0, // calculated from cartons/loose
        adjustDirection,
        adjustReason,
        adjustNotes,
        adjustBatchNumber || undefined,
        undefined,
        Number(adjustCartonQty) || 0,
        Number(adjustLooseQty) || 0,
        adjustGodownId
      );
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      setAdjustError(err?.message || 'Failed to execute stock adjustment.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Godown Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Inventory Control Hub</h1>
                <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                  {activeCompany?.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated multi-warehouse stock audit, batch tracking, inter-godown logistics, and immutable ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Top Godown Location Switcher & Fast Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Godown Location Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
            <Warehouse className="w-4 h-4 text-indigo-600" />
            <select
              value={selectedGodownId}
              onChange={(e) => setSelectedGodownId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">🏢 All Godowns (Consolidated View)</option>
              {godowns.map(g => (
                <option key={g.id} value={g.id}>
                  📍 {g.name} [{g.code}]{g.is_default ? ' ★ (Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => openAdjustmentModal()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Stock Adjustment</span>
          </button>

          <button
            onClick={openNewTransferModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100 transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Transfer Stock</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 no-print overflow-x-auto">
        <button
          onClick={() => setActiveTab('status')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'status' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>
              {selectedGodownId === 'all' ? 'Consolidated Stock Status' : `${godowns.find(g => g.id === selectedGodownId)?.name || 'Godown'} Stock`}
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'batches' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            <span>Batch &amp; Expiry by Location</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer relative ${
            activeTab === 'transfers' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            <span>Inter-Godown Transfers</span>
            {stockTransfers.filter(t => t.status === 'Dispatched' || t.status === 'Received').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'ledger' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            <span>Stock Ledger Log</span>
          </div>
        </button>
      </div>

      {/* Filter and Search Panel (Status & Batches) */}
      {(activeTab === 'status' || activeTab === 'batches') && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between no-print">
          <div className="w-full md:max-w-xs">
            <SmartSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search products, brands, SKU..."
              entityFilter={['product', 'category']}
              size="sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Brand Filter */}
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="bg-transparent text-xs outline-none text-slate-700 font-semibold cursor-pointer"
              >
                <option value="all">All Brands/Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
                <Tags className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-transparent text-xs outline-none text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="uncategorized">Uncategorized Products</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.active ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(filterCompany !== 'all' || filterCategory !== 'all' || searchTerm) && (
              <button
                onClick={() => { setFilterCompany('all'); setFilterCategory('all'); setSearchTerm(''); }}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: STOCK STATUS */}
      {activeTab === 'status' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-4">Product Description</th>
                  <th className="py-3.5 px-4">Company / Brand</th>

                  {/* If Consolidated (All Godowns), show column per godown */}
                  {selectedGodownId === 'all' ? (
                    <>
                      {godowns.map(g => (
                        <th key={g.id} className="py-3.5 px-3 text-center bg-indigo-50/50 text-indigo-900 border-l border-slate-200">
                          {g.name}
                          <span className="block text-[9px] font-bold text-indigo-500 uppercase">{g.code}</span>
                        </th>
                      ))}
                      <th className="py-3.5 px-4 text-center bg-slate-100 font-black text-slate-900 border-l border-slate-200">
                        Consolidated Total
                      </th>
                      <th className="py-3.5 px-4 text-center">Reserved</th>
                      <th className="py-3.5 px-4 text-center">Available Stock</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3.5 px-4 text-center">Physical Stock</th>
                      <th className="py-3.5 px-4 text-center">Reserved</th>
                      <th className="py-3.5 px-4 text-center">Available Stock</th>
                      <th className="py-3.5 px-4 text-center">Damaged / Exp</th>
                    </>
                  )}
                  <th className="py-3.5 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.map((p) => {
                  const assignedCats = getCategoriesForProduct(p.id);
                  const consItem = consolidatedInv.find(c => c.product_id === p.id);
                  const unitsPerPack = p.units_per_box_carton || 1;

                  if (selectedGodownId === 'all') {
                    // Consolidated View
                    const totalPhysical = consItem?.physical_qty || 0;
                    const totalReserved = consItem?.reserved_qty || 0;
                    const totalAvailable = consItem?.available_qty || 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                            {p.mrp !== undefined && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                MRP ₹{p.mrp}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] text-slate-500 font-medium">HSN: {p.hsn} &bull; SKU: {p.sku}</span>
                            {assignedCats.map(c => (
                              <span key={c.id} className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-200">
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">{p.brand}</td>

                        {/* Individual Godown Stock Columns */}
                        {godowns.map(g => {
                          const gData = consItem?.godownBreakdown?.[g.id] || { physical: 0, available: 0, reserved: 0, damaged: 0, expired: 0 };
                          return (
                            <td key={g.id} className="py-3.5 px-3 text-center border-l border-slate-200/60 bg-slate-50/30">
                              <span className="font-bold text-slate-800 text-xs block">
                                {formatQuantityDisplay(gData.physical, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                              </span>
                              {gData.reserved > 0 && (
                                <span className="text-[10px] text-indigo-600 font-semibold block">
                                  ({gData.reserved} res.)
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Consolidated Total Column */}
                        <td className="py-3.5 px-4 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/50">
                          {formatQuantityDisplay(totalPhysical, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-500 font-medium">
                          {totalReserved > 0 ? (
                            <span className="text-indigo-700 font-black">
                              {formatQuantityDisplay(totalReserved, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                            </span>
                          ) : (
                            `0 ${p.trading_unit}s`
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                            totalAvailable <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                            totalAvailable < unitsPerPack ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {formatQuantityDisplay(totalAvailable, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openAdjustmentModal(p.id)}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  } else {
                    // Specific Godown View
                    const godownRow = inventory.find(i => i.product_id === p.id && i.godown_id === selectedGodownId);
                    const physical = godownRow ? godownRow.physical_qty : 0;
                    const reserved = godownRow ? godownRow.reserved_qty : 0;
                    const available = godownRow ? godownRow.available_qty : 0;
                    const badStock = godownRow ? (godownRow.damaged_qty + godownRow.expired_qty) : 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                            {p.mrp !== undefined && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                MRP ₹{p.mrp}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] text-slate-500 font-medium">HSN: {p.hsn} &bull; SKU: {p.sku}</span>
                            {assignedCats.map(c => (
                              <span key={c.id} className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-200">
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">{p.brand}</td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-800">
                          {formatQuantityDisplay(physical, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-500 font-medium">
                          {reserved > 0 ? (
                            <span className="text-indigo-700 font-black">
                              {formatQuantityDisplay(reserved, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                            </span>
                          ) : (
                            `0 ${p.trading_unit}s`
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                            available <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                            available < unitsPerPack ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {formatQuantityDisplay(available, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {badStock > 0 ? (
                            <span className="text-red-600 font-bold">
                              {formatQuantityDisplay(badStock, unitsPerPack, p.trading_unit, p.base_unit || 'Piece')}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openAdjustmentModal(p.id, selectedGodownId)}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BATCH & EXPIRY BY LOCATION */}
      {activeTab === 'batches' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-4">Product Description</th>
                  <th className="py-3.5 px-4">Godown Location</th>
                  <th className="py-3.5 px-4">Batch Number</th>
                  <th className="py-3.5 px-4">Mfg Date</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4 text-right">Purchase Rate</th>
                  <th className="py-3.5 px-4 text-right">MRP</th>
                  <th className="py-3.5 px-4 text-center">Batch Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.map((p) => {
                  let prodBatches = batches.filter(b => b.product_id === p.id && b.quantity > 0);
                  if (selectedGodownId !== 'all') {
                    prodBatches = prodBatches.filter(b => b.godown_id === selectedGodownId || b.godown === godowns.find(g => g.id === selectedGodownId)?.name);
                  }
                  if (prodBatches.length === 0) return null;
                  
                  return prodBatches.map((b, idx) => {
                    const gName = b.godown_id 
                      ? (godowns.find(g => g.id === b.godown_id)?.name || b.godown || 'Main Godown') 
                      : (b.godown || 'Main Godown');

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          {idx === 0 ? (
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  MRP ₹{p.mrp}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">Packing: {p.pack_size}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-medium">Same product...</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                            <Warehouse className="w-3 h-3 text-slate-400" />
                            <span>{gName}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{b.batch_number}</td>
                        <td className="py-3.5 px-4 text-slate-600">{b.mfg_date ? new Date(b.mfg_date).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="py-3.5 px-4">
                          <span className={`font-bold ${
                            new Date(b.expiry_date).getTime() < Date.now() ? 'text-red-600 font-black' : 'text-slate-700'
                          }`}>
                            {new Date(b.expiry_date).toLocaleDateString('en-IN')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-700 font-medium">₹{b.purchase_rate.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">₹{b.mrp.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {formatQuantityDisplay(b.quantity, p.units_per_box_carton || 1, p.trading_unit, p.base_unit || 'Piece')}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INTER-GODOWN TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inter-Godown Stock Transfers</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit and execute stock movements between warehouse facilities with in-transit tracking and partial receipts.
              </p>
            </div>
            <button
              onClick={openNewTransferModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Stock Transfer</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {stockTransfers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                <ArrowLeftRight className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p>No inter-godown transfers recorded yet.</p>
                <button
                  onClick={openNewTransferModal}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                >
                  Create Transfer
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3.5 px-4">Transfer Number</th>
                      <th className="py-3.5 px-4">Source Godown</th>
                      <th className="py-3.5 px-4">Destination Godown</th>
                      <th className="py-3.5 px-4">Items Transferred</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {[...stockTransfers]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((tr) => {
                        const fromG = godowns.find(g => g.id === tr.from_godown_id);
                        const toG = godowns.find(g => g.id === tr.to_godown_id);
                        const isPendingReceipt = tr.status === 'Dispatched' || tr.status === 'Received';

                        return (
                          <tr key={tr.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {tr.transfer_number}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-800">{fromG?.name || 'Main Godown'}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">[{fromG?.code || 'GD01'}]</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-800">{toG?.name || 'Secondary Godown'}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">[{toG?.code || 'GD02'}]</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                {tr.items.map(it => {
                                  const prod = products.find(p => p.id === it.product_id);
                                  const unitsPerPack = prod?.units_per_box_carton || 1;
                                  const totalDisplay = formatQuantityDisplay(it.quantity, unitsPerPack, prod?.trading_unit || 'Carton', prod?.base_unit || 'Piece');
                                  const recDisplay = formatQuantityDisplay(it.received_qty || 0, unitsPerPack, prod?.trading_unit || 'Carton', prod?.base_unit || 'Piece');

                                  return (
                                    <div key={it.id} className="text-xs">
                                      <span className="font-bold text-slate-800">{prod?.name}: </span>
                                      <span className="text-slate-600 font-semibold">{totalDisplay}</span>
                                      {it.received_qty !== undefined && it.received_qty > 0 && it.received_qty < it.quantity && (
                                        <span className="text-[10px] text-amber-700 font-bold ml-1">
                                          (Rec: {recDisplay})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                              {new Date(tr.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                tr.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                tr.status === 'Dispatched' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                tr.status === 'Received' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                tr.status === 'Draft' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {tr.status === 'Completed' && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                                {tr.status === 'Dispatched' && <Truck className="w-3.5 h-3.5 text-amber-600" />}
                                {tr.status === 'Received' && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                                <span>{tr.status}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {tr.status === 'Draft' && (
                                  <button
                                    onClick={() => dispatchStockTransfer(tr.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Dispatch
                                  </button>
                                )}

                                {isPendingReceipt && (
                                  <button
                                    onClick={() => openReceiveModal(tr)}
                                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Receive Stock
                                  </button>
                                )}

                                {tr.status !== 'Completed' && tr.status !== 'Cancelled' && (
                                  <button
                                    onClick={() => cancelStockTransfer(tr.id)}
                                    className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STOCK LEDGER LOG */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl text-xs flex gap-2.5 items-start">
            <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">Immutable Multi-Godown Audit Ledger</span>
              <p className="mt-1 opacity-90 leading-relaxed text-xs">
                Every purchase stock inward, sales invoice dispatch, inter-godown transfer movement, and manual adjustment logs an immutable transaction record tagged with the exact godown location.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {ledger.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                No ledger transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3.5 px-4">Date &amp; Time</th>
                      <th className="py-3.5 px-4">Godown Facility</th>
                      <th className="py-3.5 px-4">Product Description</th>
                      <th className="py-3.5 px-4 text-center">Direction</th>
                      <th className="py-3.5 px-4 text-center">Quantity Change</th>
                      <th className="py-3.5 px-4">Transaction / Reason</th>
                      <th className="py-3.5 px-4">Reference ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...ledger]
                      .filter(entry => selectedGodownId === 'all' || entry.godown_id === selectedGodownId)
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((entry) => {
                        const prod = products.find(p => p.id === entry.product_id);
                        const gName = entry.godown_id 
                          ? (godowns.find(g => g.id === entry.godown_id)?.name || 'Main Godown') 
                          : 'Main Godown';

                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                              {new Date(entry.created_at).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                                <Warehouse className="w-3 h-3 text-slate-400" />
                                <span>{gName}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 leading-tight">{prod?.name}</span>
                                {prod?.mrp && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                    MRP ₹{prod.mrp}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 block mt-0.5">Brand: {prod?.brand} &bull; Pack: {prod?.pack_size}</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                entry.direction === 'IN' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                              }`}>
                                {entry.direction}
                              </span>
                            </td>
                            <td className={`py-3.5 px-4 text-center font-black ${
                              entry.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                              {entry.direction === 'IN' ? '+' : '-'}
                              {formatQuantityDisplay(Math.abs(entry.change_qty), prod?.units_per_box_carton || 1, prod?.trading_unit || 'Carton', prod?.base_unit || 'Piece')}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-700">{entry.reason}</td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[120px]">{entry.reference_id || '-'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: NEW STOCK TRANSFER */}
      {isNewTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold tracking-wide">Initiate Inter-Godown Stock Transfer</h3>
              </div>
              <button 
                onClick={() => setIsNewTransferOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {transferModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{transferModalError}</span>
                </div>
              )}

              {/* Source & Destination Godowns */}
              <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Source Godown (From) *</label>
                  <select
                    value={transferFromGodown}
                    onChange={(e) => setTransferFromGodown(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {godowns.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} [{g.code}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Destination Godown (To) *</label>
                  <select
                    value={transferToGodown}
                    onChange={(e) => setTransferToGodown(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {godowns.map(g => (
                      <option key={g.id} value={g.id} disabled={g.id === transferFromGodown}>
                        {g.name} [{g.code}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transfer Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Products &amp; Quantities to Transfer</h4>
                  <button
                    type="button"
                    onClick={handleAddTransferItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {transferItems.map((item, idx) => {
                  const selProd = products.find(p => p.id === item.productId);
                  const unitsPerPack = selProd?.units_per_box_carton || 1;
                  const availableInSource = inventory.find(i => i.product_id === item.productId && i.godown_id === transferFromGodown)?.available_qty || 0;
                  const sourceBatches = batches.filter(b => b.product_id === item.productId && (b.godown_id === transferFromGodown || b.godown === godowns.find(g => g.id === transferFromGodown)?.name) && b.quantity > 0);

                  return (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={item.productId}
                          onChange={(e) => handleTransferItemChange(idx, 'productId', e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.pack_size})
                            </option>
                          ))}
                        </select>
                        {transferItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTransferItem(idx)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Batch (Optional)</label>
                          <select
                            value={item.batchNumber || ''}
                            onChange={(e) => handleTransferItemChange(idx, 'batchNumber', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold"
                          >
                            <option value="">Any / Auto FIFO</option>
                            {sourceBatches.map(b => (
                              <option key={b.id} value={b.batch_number}>
                                {b.batch_number} ({b.quantity} units avail.)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">{selProd?.trading_unit || 'Carton'}s</label>
                          <input
                            type="number"
                            min="0"
                            value={item.cartonQty}
                            onChange={(e) => handleTransferItemChange(idx, 'cartonQty', Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Loose {selProd?.base_unit || 'Piece'}s</label>
                          <input
                            type="number"
                            min="0"
                            value={item.looseQty}
                            onChange={(e) => handleTransferItemChange(idx, 'looseQty', Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                        <span>Available in Source: <strong className="text-slate-800">{formatQuantityDisplay(availableInSource, unitsPerPack, selProd?.trading_unit || 'Carton', selProd?.base_unit || 'Piece')}</strong></span>
                        <span>Transferring: <strong className="text-indigo-600">{calculateBaseQuantity(item.cartonQty, item.looseQty, unitsPerPack)} Total Base Units</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Transfer Notes / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Stock replenishment for high demand retail route"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDispatch}
                    onChange={(e) => setAutoDispatch(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span className="text-xs font-bold text-slate-800">Dispatch stock immediately (deduct from source warehouse right now)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewTransferOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all cursor-pointer"
                >
                  {autoDispatch ? 'Create & Dispatch Transfer' : 'Save as Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVE STOCK TRANSFER */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold tracking-wide">Receive Transfer: {receivingTransfer.transfer_number}</h3>
              </div>
              <button 
                onClick={() => setReceivingTransfer(null)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReceipt} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {receiveModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{receiveModalError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600">
                Confirm inward quantities received at <strong>{godowns.find(g => g.id === receivingTransfer.to_godown_id)?.name}</strong>.
              </p>

              <div className="space-y-3">
                {receivingTransfer.items.map(it => {
                  const prod = products.find(p => p.id === it.product_id);
                  const unitsPerPack = prod?.units_per_box_carton || 1;
                  const input = receiptInputs[it.id] || { cartonQty: 0, looseQty: 0 };
                  const unreceivedBase = Math.max(0, it.quantity - (it.received_qty || 0));

                  return (
                    <div key={it.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{prod?.name}</span>
                        <span className="text-[11px] font-bold text-slate-500">
                          Total Dispatched: {formatQuantityDisplay(it.quantity, unitsPerPack, prod?.trading_unit || 'Carton', prod?.base_unit || 'Piece')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block">Received {prod?.trading_unit || 'Carton'}s</label>
                          <input
                            type="number"
                            min="0"
                            value={input.cartonQty}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setReceiptInputs({
                                ...receiptInputs,
                                [it.id]: { ...input, cartonQty: val }
                              });
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block">Received Loose {prod?.base_unit || 'Piece'}s</label>
                          <input
                            type="number"
                            min="0"
                            value={input.looseQty}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setReceiptInputs({
                                ...receiptInputs,
                                [it.id]: { ...input, looseQty: val }
                              });
                            }}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReceivingTransfer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all cursor-pointer"
                >
                  Confirm Inward Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STOCK ADJUSTMENT */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold tracking-wide">Manual Stock Adjustment</h3>
              </div>
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {adjustError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Godown Facility *</label>
                <select
                  value={adjustGodownId}
                  onChange={(e) => setAdjustGodownId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  {godowns.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} [{g.code}]{g.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Product *</label>
                <select
                  value={adjustProductId}
                  onChange={(e) => setAdjustProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.pack_size})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Direction</label>
                  <select
                    value={adjustDirection}
                    onChange={(e) => setAdjustDirection(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="IN">➕ Add Stock (IN)</option>
                    <option value="OUT">➖ Deduct Stock (OUT)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Batch (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto or Batch No"
                    value={adjustBatchNumber}
                    onChange={(e) => setAdjustBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Cartons / Boxes</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustCartonQty}
                    onChange={(e) => setAdjustCartonQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Loose Units</label>
                  <input
                    type="number"
                    min="0"
                    value={adjustLooseQty}
                    onChange={(e) => setAdjustLooseQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Justification Reason *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="Physical Inventory Audit Correction">Physical Inventory Audit Correction</option>
                  <option value="Damaged Stock Written Off">Damaged Stock Written Off</option>
                  <option value="Expiry Stock Written Off">Expiry Stock Written Off</option>
                  <option value="Sample Giveaway / Promotional">Sample Giveaway / Promotional</option>
                  <option value="Found Unrecorded Stock">Found Unrecorded Stock</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Notes</label>
                <input
                  type="text"
                  placeholder="Audit reference or details"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all cursor-pointer"
                >
                  Confirm Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
