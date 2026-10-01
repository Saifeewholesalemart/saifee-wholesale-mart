'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { 
  FileText, ClipboardList, CheckCircle, Package, Truck, Check, X, RotateCcw, 
  History, Tag, Warehouse, Sparkles, AlertTriangle, ChevronRight, ShieldCheck, Printer
} from 'lucide-react';
import { Fulfilment, Retailer, Order, BatchAllocation } from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';

function ConsolidatedOrdersContent() {
  const { 
    fulfilments, retailers, orders, products, profiles, invoices, batches, deliveryChallans,
    packConsolidation, dispatchConsolidation, deliverConsolidation, cancelConsolidation,
    getFifoBatchSuggestions 
  } = useDb();
  
  const router = useRouter();

  // Mount state for hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Tabs: 'Confirmed', 'Packed', 'Dispatched', 'Delivered', 'Packing'
  const [activeTab, setActiveTab] = useState<'Confirmed' | 'Packed' | 'Dispatched' | 'Delivered' | 'Packing'>('Confirmed');
  const [selectedFulId, setSelectedFulId] = useState<string | null>(null);

  // FIFO Packing & Batch Allocation Modal States
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [packingFul, setPackingFul] = useState<Fulfilment | null>(null);
  const [packingAllocations, setPackingAllocations] = useState<{ [fItemId: string]: BatchAllocation[] }>({});
  const [packingGodownFilter, setPackingGodownFilter] = useState<string>('all');
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string } | null>(null);

  // Dispatch Logistics Modal States
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchFul, setDispatchFul] = useState<Fulfilment | null>(null);
  const [dispatchInfo, setDispatchInfo] = useState({
    transportMode: 'Distributor Delivery Van',
    vehicleNumber: 'MH-04-AZ-4592',
    deliveryPerson: 'Ramesh Sawant (Van Staff)',
    notes: 'Consolidated commercial cartons. Handle with care.',
    dispatchDate: new Date().toISOString().split('T')[0],
    dispatchGodown: 'Main Godown - Bhiwandi Bay 1'
  });

  const selectedFul = fulfilments.find(f => f.id === selectedFulId);

  const handleOpenPackingModal = (ful: Fulfilment) => {
    setPackingFul(ful);
    
    const initialAllocations: { [fItemId: string]: BatchAllocation[] } = {};
    ful.items?.forEach(fItem => {
      if (ful.status === 'Packed' && fItem.batch_allocations && fItem.batch_allocations.length > 0) {
        // Load existing allocations
        initialAllocations[fItem.id] = fItem.batch_allocations;
      } else {
        // Run FIFO engine suggestions
        const suggestions = getFifoBatchSuggestions(fItem.product_id, fItem.confirmed_qty, packingGodownFilter === 'all' ? undefined : packingGodownFilter, fItem.selected_mrp);
        initialAllocations[fItem.id] = suggestions.map(s => ({
          batch_id: s.batch.id,
          batch_number: s.batch.batch_number,
          allocated_qty: s.suggested_qty,
          godown: s.batch.godown,
          cost_layer: s.batch.cost_layer,
          purchase_rate: s.batch.purchase_rate,
          mrp: s.batch.mrp,
          selling_price: s.batch.selling_price,
          expiry_date: s.batch.expiry_date,
          entry_date: s.batch.entry_date
        }));
      }
    });
    
    setPackingAllocations(initialAllocations);
    setShowPackingModal(true);
  };

  const handleApplyFifoSuggestions = (fItemId: string, productId: string, confirmedQty: number) => {
    const suggestions = getFifoBatchSuggestions(productId, confirmedQty, packingGodownFilter === 'all' ? undefined : packingGodownFilter);
    setPackingAllocations(prev => ({
      ...prev,
      [fItemId]: suggestions.map(s => ({
        batch_id: s.batch.id,
        batch_number: s.batch.batch_number,
        allocated_qty: s.suggested_qty,
        godown: s.batch.godown,
        cost_layer: s.batch.cost_layer,
        purchase_rate: s.batch.purchase_rate,
        mrp: s.batch.mrp,
        selling_price: s.batch.selling_price,
        expiry_date: s.batch.expiry_date,
        entry_date: s.batch.entry_date
      }))
    }));
  };

  const handleConfirmPacking = () => {
    if (!packingFul) return;
    
    const itemsWithAllocations = packingFul.items?.map(fItem => {
      const currentAlloc = packingAllocations[fItem.id] || [];
      return {
        fulfilmentItemId: fItem.id,
        batch_allocations: currentAlloc.filter(a => a.allocated_qty > 0)
      };
    }) || [];
    
    packConsolidation(packingFul.id, itemsWithAllocations);
    setShowPackingModal(false);
    setPackingFul(null);
  };

  const handleOpenDispatchModal = (ful: Fulfilment) => {
    setDispatchFul(ful);
    setShowDispatchModal(true);
  };

  const handleExecuteDispatch = () => {
    if (!dispatchFul) return;
    const inv = dispatchConsolidation(dispatchFul.id, {
      transportMode: dispatchInfo.transportMode,
      vehicleNumber: dispatchInfo.vehicleNumber,
      deliveryPerson: dispatchInfo.deliveryPerson,
      notes: dispatchInfo.notes,
      dispatchDate: new Date(dispatchInfo.dispatchDate).toISOString(),
      dispatchGodown: dispatchInfo.dispatchGodown
    });

    if (inv) {
      setShowDispatchModal(false);
      setDispatchFul(null);
    }
  };

  // Group fulfilments by status
  const filteredFulfilments = fulfilments.filter(f => {
    if (activeTab === 'Confirmed') {
      return f.status === 'Confirmed' || f.status === 'Partially Confirmed';
    }
    return f.status === activeTab;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Packing': return 'Draft / Pending Confirmation';
      case 'Confirmed': return 'Confirmed (Ready to Pack)';
      case 'Partially Confirmed': return 'Partially Confirmed';
      case 'Packed': return 'Packed (Ready for Dispatch)';
      case 'Dispatched': return 'Dispatched & Invoiced';
      case 'Delivered': return 'Delivered';
      case 'Cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Packing': return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'Confirmed': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Partially Confirmed': return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'Packed': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'Dispatched': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'Delivered': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default: return 'bg-red-50 text-red-700 border border-red-200';
    }
  };

  const getOriginalOrdersForFul = (ful: Fulfilment) => {
    const itemOrderIds = new Set<string>();
    ful.items?.forEach(fItem => {
      orders.forEach(o => {
        if (o.items?.some(oi => oi.id === fItem.order_item_id)) {
          itemOrderIds.add(o.id);
        }
      });
    });

    return orders.filter(o => itemOrderIds.has(o.id));
  };

  const getSalespersonName = (order: Order) => {
    if (order.source === 'retailer_direct') return 'Retailer Direct';
    if (order.source === 'counter_sale') return 'POS Counter Sale';
    const profile = profiles.find(p => p.id === order.created_by);
    return profile ? profile.name : 'Salesperson';
  };

  if (!mounted) {
    return (
      <div className="space-y-6 pb-20 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="h-16 bg-slate-200 rounded-xl"></div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Consolidated Orders Registry</h2>
          <p className="text-xs text-slate-500 mt-1">Multi-source consolidated orders pipeline from Confirmation to FIFO Packing and Dispatch.</p>
        </div>
        <button
          onClick={() => router.push('/admin/consolidation')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start"
        >
          + Open Consolidation Desk
        </button>
      </div>

      {/* Pipeline Tabs */}
      <div className="flex border border-slate-200 rounded-xl overflow-x-auto bg-white text-xs font-semibold scrollbar-none shadow-xs">
        {(['Confirmed', 'Packed', 'Dispatched', 'Delivered', 'Packing'] as const).map(tab => {
          let count = 0;
          if (tab === 'Confirmed') {
            count = fulfilments.filter(f => f.status === 'Confirmed' || f.status === 'Partially Confirmed').length;
          } else {
            count = fulfilments.filter(f => f.status === tab).length;
          }

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-center border-r border-slate-200 whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === tab ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span>{getStatusLabel(tab)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="erp-card bg-white overflow-x-auto shadow-sm border border-slate-150 rounded-xl">
        {filteredFulfilments.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-medium">
            No consolidated runs found in {getStatusLabel(activeTab)} stage.
          </div>
        ) : (
          <table className="w-full min-w-[700px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3">Run Details</th>
                <th className="p-3">Retailer Profile</th>
                <th className="p-3 text-center">Items / CTN</th>
                <th className="p-3 text-center">Stage Status</th>
                <th className="p-3 text-right">Value</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredFulfilments.map(ful => {
                const ret = retailers.find(r => r.id === ful.retailer_id);
                const totalItems = ful.items?.length || 0;
                const totalConfirmedQty = ful.items?.reduce((sum, item) => sum + item.confirmed_qty, 0) || 0;
                const totalVal = ful.items?.reduce((sum, item) => {
                  const rate = item.manual_billing_rate ?? item.order_time_rate ?? 0;
                  const discount = item.discount || 0;
                  return sum + (Math.max(0, rate - discount) * item.confirmed_qty);
                }, 0) || 0;

                return (
                  <tr key={ful.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-slate-900 block text-xs">{ful.fulfilment_number}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Created: {new Date(ful.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800 block text-xs">{ret?.shop_name || 'Retailer'}</span>
                      <span className="text-xs text-slate-500 block">{ret?.city} &bull; {ret?.owner_name}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-extrabold text-slate-800 text-xs block">{totalConfirmedQty} CTN</span>
                      <span className="text-xs text-slate-500 block">{totalItems} Products</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(ful.status)}`}>
                        {ful.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-900 text-xs md:text-sm">
                      ₹{totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedFulId(ful.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                        {(ful.status === 'Confirmed' || ful.status === 'Partially Confirmed') && (
                          <button
                            onClick={() => handleOpenPackingModal(ful)}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                          >
                            Pack (FIFO)
                          </button>
                        )}
                        {ful.status === 'Packed' && (
                          <button
                            onClick={() => handleOpenDispatchModal(ful)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                          >
                            Dispatch &amp; Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selectedFul && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden border border-slate-200">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50 flex-shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase">Consolidated Order Overview</h3>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block mt-0.5">
                  ID: {selectedFul.fulfilment_number} &bull; Retailer: {retailers.find(r => r.id === selectedFul.retailer_id)?.shop_name}
                </span>
              </div>
              <button 
                onClick={() => setSelectedFulId(null)} 
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Visual Journey Tracker */}
              <div className="erp-card bg-white p-4 border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visual Journey Tracker</h4>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold text-slate-900 mt-1.5 uppercase">1. Ordered</span>
                    <span className="text-xs text-slate-500 font-medium">{new Date(selectedFul.created_at).toLocaleDateString('en-IN')}</span>
                  </div>

                  <div className="hidden sm:block flex-1 h-[2px] bg-slate-200" />

                  <div className="flex flex-col items-center">
                    {['Confirmed', 'Partially Confirmed', 'Packed', 'Dispatched', 'Delivered'].includes(selectedFul.status) ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">2</div>
                    )}
                    <span className="text-xs font-extrabold text-slate-900 mt-1.5 uppercase">2. Confirmed</span>
                    {selectedFul.confirmed_at && (
                      <span className="text-xs text-slate-500 font-medium">{new Date(selectedFul.confirmed_at).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>

                  <div className="hidden sm:block flex-1 h-[2px] bg-slate-200" />

                  <div className="flex flex-col items-center">
                    {['Packed', 'Dispatched', 'Delivered'].includes(selectedFul.status) ? (
                      <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">3</div>
                    )}
                    <span className="text-xs font-extrabold text-slate-900 mt-1.5 uppercase">3. FIFO Packed</span>
                    {selectedFul.packed_at && (
                      <span className="text-xs text-slate-500 font-medium">{new Date(selectedFul.packed_at).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>

                  <div className="hidden sm:block flex-1 h-[2px] bg-slate-200" />

                  <div className="flex flex-col items-center">
                    {['Dispatched', 'Delivered'].includes(selectedFul.status) ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">4</div>
                    )}
                    <span className="text-xs font-extrabold text-slate-900 mt-1.5 uppercase">4. Dispatched</span>
                    {selectedFul.dispatched_at && (
                      <span className="text-xs text-slate-500 font-medium">{new Date(selectedFul.dispatched_at).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>

                  <div className="hidden sm:block flex-1 h-[2px] bg-slate-200" />

                  <div className="flex flex-col items-center">
                    {selectedFul.status === 'Delivered' ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">5</div>
                    )}
                    <span className="text-xs font-extrabold text-slate-900 mt-1.5 uppercase">5. Delivered</span>
                    {selectedFul.delivered_at && (
                      <span className="text-xs text-slate-500 font-medium">{new Date(selectedFul.delivered_at).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contributing Orders */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Contributing Original Orders</h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="p-3">Order Source / Salesperson</th>
                        <th className="p-3">Order Number</th>
                        <th className="p-3 text-right">Order Date</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getOriginalOrdersForFul(selectedFul).map(o => (
                        <tr key={o.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-700">{getSalespersonName(o)}</td>
                          <td className="p-3 font-mono font-bold text-slate-800">{o.order_number}</td>
                          <td className="p-3 text-right text-slate-500">{new Date(o.order_date).toLocaleDateString('en-IN')}</td>
                          <td className="p-3 text-right font-bold text-slate-800">₹{o.total_amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Consolidated Product Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Consolidated Product View &amp; Allocated Batches</h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="p-3">Product Description</th>
                        <th className="p-3 text-center">Requested</th>
                        <th className="p-3 text-center">Confirmed</th>
                        <th className="p-3 text-right">Final Rate</th>
                        <th className="p-3 text-right">Final Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedFul.items?.map(fItem => {
                        const prod = products.find(p => p.id === fItem.product_id);
                        const manualRate = fItem.manual_billing_rate;
                        const orderRate = fItem.order_time_rate || prod?.selling_price || 0;
                        const discount = fItem.discount || 0;
                        const baseRate = manualRate !== undefined ? manualRate : orderRate;
                        const finalRate = Math.max(0, baseRate - discount);
                        const lineAmount = finalRate * fItem.confirmed_qty;

                        return (
                          <tr key={fItem.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-sm block leading-tight">{prod?.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  MRP: ₹{fItem.selected_mrp ?? prod?.mrp ?? 0}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 font-medium mt-0.5 block">Brand: {prod?.brand}</span>
                              {manualRate !== undefined && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold">
                                    <Tag className="w-3 h-3" />
                                    <span>Manual Rate: ₹{manualRate.toFixed(2)}</span>
                                  </span>
                                </div>
                              )}
                              {fItem.batch_allocations && fItem.batch_allocations.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {fItem.batch_allocations.map(ba => (
                                    <span key={ba.batch_id} className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-xs font-bold text-purple-800">
                                      Batch: {ba.batch_number} ({ba.allocated_qty} {prod?.trading_unit}s &bull; {ba.godown?.split(' - ')[0] || 'Main Godown'})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 text-xs">{fItem.original_qty} {prod?.trading_unit}s</td>
                            <td className="p-3 text-center font-black text-emerald-700 text-sm">{fItem.confirmed_qty} {prod?.trading_unit}s</td>
                            <td className="p-3 text-right font-bold text-slate-800 text-xs">₹{finalRate.toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-slate-900 text-sm">₹{lineAmount.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-150 bg-slate-50 flex items-center justify-between flex-shrink-0">
              {selectedFul.status !== 'Delivered' && selectedFul.status !== 'Cancelled' && (
                <button
                  onClick={() => {
                    if (confirm('Cancel this consolidation order? Stock reservations will be released.')) {
                      cancelConsolidation(selectedFul.id);
                      setSelectedFulId(null);
                    }
                  }}
                  className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold"
                >
                  Cancel Consolidation
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                {(selectedFul.status === 'Confirmed' || selectedFul.status === 'Partially Confirmed') && (
                  <button
                    onClick={() => {
                      handleOpenPackingModal(selectedFul);
                      setSelectedFulId(null);
                    }}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Pack Order (FIFO)
                  </button>
                )}

                {selectedFul.status === 'Packed' && (
                  <button
                    onClick={() => {
                      handleOpenDispatchModal(selectedFul);
                      setSelectedFulId(null);
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Dispatch &amp; Generate Invoice
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FIFO Packing Modal */}
      {showPackingModal && packingFul && (() => {
        const retObj = retailers.find(r => r.id === packingFul.retailer_id);
        const isFullyAllocated = packingFul.items?.every(fItem => {
          const currentAlloc = packingAllocations[fItem.id] || [];
          const allocatedSum = currentAlloc.reduce((sum, a) => sum + a.allocated_qty, 0);
          return allocatedSum === fItem.confirmed_qty;
        }) || false;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider">FIFO Stock Allocation &amp; Multi-Batch Packing</h3>
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded text-xs font-extrabold uppercase">
                      FIFO Engine Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                    Retailer: {retObj ? retObj.shop_name : 'Unknown'} &bull; Fulfilment: {packingFul.fulfilment_number}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowPackingModal(false);
                    setPackingFul(null);
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Godown Filter Sub-header */}
              <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-700 text-xs">Filter Warehouse Godown:</span>
                  <select
                    value={packingGodownFilter}
                    onChange={(e) => setPackingGodownFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2 py-1 bg-white text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="all">All Warehouse Godowns</option>
                    <option value="Main Godown - Bhiwandi Bay 1">Main Godown - Bhiwandi Bay 1</option>
                    <option value="Central Godown - Indore Hub">Central Godown - Indore Hub</option>
                    <option value="City Godown - South Bay 2">City Godown - South Bay 2</option>
                  </select>
                </div>
                <span className="text-xs text-slate-500 font-medium">Prioritizes oldest entry date, cost layer, and godown availability</span>
              </div>

              {/* Allocation Items */}
              <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
                {packingFul.items?.map(fItem => {
                  const prod = products.find(p => p.id === fItem.product_id);
                  const currentAlloc = packingAllocations[fItem.id] || [];
                  const allocatedSum = currentAlloc.reduce((sum, a) => sum + a.allocated_qty, 0);
                  const remainingNeeded = fItem.confirmed_qty - allocatedSum;

                  const prodBatches = batches.filter(b => b.product_id === fItem.product_id && (packingGodownFilter === 'all' || b.godown === packingGodownFilter))
                    .sort((a, b) => new Date(a.entry_date || a.mfg_date || '2026-01-01').getTime() - new Date(b.entry_date || b.mfg_date || '2026-01-01').getTime());

                  return (
                    <div key={fItem.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-800 text-xs block leading-tight">{prod?.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                              MRP: ₹{fItem.selected_mrp ?? prod?.mrp ?? 0}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 block font-semibold mt-0.5">Brand: {prod?.brand} &bull; Pack: {prod?.pack_size}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleApplyFifoSuggestions(fItem.id, fItem.product_id, fItem.confirmed_qty)}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span>⚡ Accept FIFO Suggestions</span>
                          </button>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Confirmed Qty</span>
                            <span className="font-extrabold text-indigo-700 text-xs">{fItem.confirmed_qty} {prod?.trading_unit}s</span>
                          </div>
                        </div>
                      </div>

                      {/* Batches Table */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Available Physical Batches</span>
                        {prodBatches.length === 0 ? (
                          <p className="text-slate-400 text-xs font-medium py-2">No active batches available in selected godown.</p>
                        ) : (
                          <div className="divide-y divide-slate-100 bg-white border border-slate-150 rounded-xl overflow-hidden shadow-xs">
                            {prodBatches.map((b, idx) => {
                              const allocObj = currentAlloc.find(a => a.batch_id === b.id);
                              const allocatedQty = allocObj ? allocObj.allocated_qty : 0;
                              const isFifoPriority = idx === 0;

                              return (
                                <div key={b.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-slate-800 text-xs">{b.batch_number}</span>
                                      {isFifoPriority && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-black uppercase">
                                          FIFO Priority #{idx + 1}
                                        </span>
                                      )}
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                                        {b.godown || 'Main Godown'}
                                      </span>
                                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 font-extrabold rounded text-xs">
                                        MRP: ₹{b.mrp.toFixed(2)}
                                      </span>
                                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 font-bold rounded text-xs">
                                        Rate: ₹{(b.selling_price || prod?.selling_price || 0).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 font-medium">
                                      <span>Entry: <strong className="text-slate-700">{b.entry_date || '2026-03-01'}</strong></span>
                                      <span>Cost: <strong className="text-slate-700">₹{b.purchase_rate.toFixed(2)}</strong> ({b.cost_layer || 'PO-2026-031'})</span>
                                      <span>Exp: <strong className="text-slate-700">{new Date(b.expiry_date).toLocaleDateString('en-IN')}</strong></span>
                                      <span>Available: <strong className="text-slate-900 font-bold">{b.quantity} {prod?.trading_unit}s</strong></span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={b.quantity}
                                        value={allocatedQty === 0 ? '' : allocatedQty}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = Math.min(b.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                          const filtered = currentAlloc.filter(a => a.batch_id !== b.id);
                                          if (val > 0) {
                                            filtered.push({
                                              batch_id: b.id,
                                              batch_number: b.batch_number,
                                              allocated_qty: val,
                                              godown: b.godown,
                                              cost_layer: b.cost_layer,
                                              purchase_rate: b.purchase_rate,
                                              mrp: b.mrp,
                                              selling_price: b.selling_price,
                                              expiry_date: b.expiry_date,
                                              entry_date: b.entry_date
                                            });
                                          }
                                          setPackingAllocations({
                                            ...packingAllocations,
                                            [fItem.id]: filtered
                                          });
                                        }}
                                        className="w-16 border border-slate-200 rounded-lg p-1.5 text-center text-xs font-bold focus:border-indigo-500 outline-none"
                                      />
                                      <span className="text-xs text-slate-500 font-bold ml-1.5 uppercase">{prod?.trading_unit}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-bold">
                        <div className="flex gap-4">
                          <span className="text-slate-500">Allocated: <strong className="text-slate-800 font-black">{allocatedSum} {prod?.trading_unit}s</strong></span>
                          {remainingNeeded > 0 ? (
                            <span className="text-red-500 font-black">Remaining: {remainingNeeded} {prod?.trading_unit}s</span>
                          ) : (
                            <span className="text-emerald-600 font-black">Fully Allocated 100% ✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-b-2xl">
                <div>
                  {!isFullyAllocated ? (
                    <span className="text-xs font-bold text-red-500 block">
                      ⚠️ Please allocate all required quantities across eligible batches.
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 block">
                      ✓ All product variants are fully allocated.
                    </span>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPackingModal(false);
                      setPackingFul(null);
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!isFullyAllocated}
                    onClick={handleConfirmPacking}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase shadow-md transition-all ${
                      isFullyAllocated
                        ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Confirm Packing
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dispatch Logistics Modal */}
      {showDispatchModal && dispatchFul && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider">Confirm Dispatch &amp; Generate Tax Invoice</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Execution deducts warehouse physical stock atomically and creates legal invoices.</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispatch Godown</label>
                  <select
                    value={dispatchInfo.dispatchGodown}
                    onChange={(e) => setDispatchInfo({ ...dispatchInfo, dispatchGodown: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="Main Godown - Bhiwandi Bay 1">Main Godown - Bhiwandi Bay 1</option>
                    <option value="Central Godown - Indore Hub">Central Godown - Indore Hub</option>
                    <option value="City Godown - South Bay 2">City Godown - South Bay 2</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transport Mode</label>
                  <select
                    value={dispatchInfo.transportMode}
                    onChange={(e) => setDispatchInfo({ ...dispatchInfo, transportMode: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="Distributor Delivery Van">Distributor Delivery Van</option>
                    <option value="Auto Cargo / Three Wheeler">Auto Cargo / Three Wheeler</option>
                    <option value="Tempo / Commercial Carrier">Tempo / Commercial Carrier</option>
                    <option value="Courier Express">Courier Express</option>
                    <option value="Counter Self-Pickup">Counter Self-Pickup</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle Number</label>
                  <input
                    type="text"
                    value={dispatchInfo.vehicleNumber}
                    onChange={(e) => setDispatchInfo({ ...dispatchInfo, vehicleNumber: e.target.value })}
                    placeholder="e.g. MH-04-AZ-4592"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Person / Driver</label>
                  <input
                    type="text"
                    value={dispatchInfo.deliveryPerson}
                    onChange={(e) => setDispatchInfo({ ...dispatchInfo, deliveryPerson: e.target.value })}
                    placeholder="e.g. Ramesh Sawant"
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispatch Date</label>
                <input
                  type="date"
                  value={dispatchInfo.dispatchDate}
                  onChange={(e) => setDispatchInfo({ ...dispatchInfo, dispatchDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gate Pass &amp; Dispatch Instructions</label>
                <textarea
                  rows={2}
                  value={dispatchInfo.notes}
                  onChange={(e) => setDispatchInfo({ ...dispatchInfo, notes: e.target.value })}
                  placeholder="e.g. Corrugated packaging. Fragile items handled."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDispatch}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                <span>Execute Dispatch &amp; Create Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last 5 Billing Rates Modal */}
      {rateHistoryTarget && (
        <LastBillingRatesModal
          isOpen={!!rateHistoryTarget}
          onClose={() => setRateHistoryTarget(null)}
          retailerId={rateHistoryTarget.retailerId}
          productId={rateHistoryTarget.productId}
          tradingUnit={rateHistoryTarget.tradingUnit}
        />
      )}
    </div>
  );
}

export default function ConsolidatedOrdersRegistry() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400 py-12 text-center font-semibold">Loading registry...</div>}>
      <ConsolidatedOrdersContent />
    </Suspense>
  );
}
