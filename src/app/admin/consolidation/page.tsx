'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Combine, ShieldAlert, CheckCircle, Package, Truck, ArrowLeft, 
  Filter, Search, Calendar, ChevronRight, User, ShoppingBag, 
  MapPin, X, Info, HelpCircle, PackageOpen, AlertCircle, RotateCcw,
  History, ShieldCheck, DollarSign, Edit3, Tag, Warehouse, Sparkles,
  Layers, CheckSquare, ArrowRight, Eye, AlertTriangle, Check
} from 'lucide-react';
import { 
  Retailer, Order, Product, OrderItem, Fulfilment, FifoBatchSuggestion, BatchAllocation,
  formatQuantityDisplay, splitBaseQuantity, calculateBaseQuantity, formatUnitName, formatItemQuantityDisplay
} from '@/lib/db';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import AuditTrailModal from '@/components/AuditTrailModal';
import SmartSearchBar from '@/components/SmartSearchBar';

function ConsolidationWorkspaceContent() {
  const { 
    orders, retailers, products, inventory, profiles, companies, fulfilments, batches,
    getOrCreateActiveFulfilment, consolidateOrders, confirmConsolidation, packConsolidation, 
    dispatchConsolidation, deliverConsolidation, cancelConsolidation, updateFulfilmentItemManualRate,
    getFifoBatchSuggestions
  } = useDb();
  
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mount state for hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Search Parameters for Workspace
  const selectedRetailerId = searchParams.get('retailer') || '';
  const selectedOrderIdsParam = searchParams.get('orderIds') || '';

  // Filter States (Queue View)
  const [filterCity, setFilterCity] = useState('all');
  const [filterRetailer, setFilterRetailer] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterSalesperson, setFilterSalesperson] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDaysRange, setFilterDaysRange] = useState('all'); // 'all', 'today', '1-2', '3-7', '7+'
  const [filterOrderDate, setFilterOrderDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Queue Selection State: retailerId -> selected orderIds set
  const [selectedOrdersByRetailer, setSelectedOrdersByRetailer] = useState<{ [retId: string]: string[] }>({});

  // Workspace Local States
  const [activeFul, setActiveFul] = useState<Fulfilment | null>(null);
  const [confirms, setConfirms] = useState<{ [prodId: string]: number }>({});
  const [manualRates, setManualRates] = useState<{ [prodId: string]: { rate: string; reason: string } }>({});
  const [flatDiscounts, setFlatDiscounts] = useState<{ [prodId: string]: number }>({});
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [rateHistoryTarget, setRateHistoryTarget] = useState<{ retailerId: string; productId: string; tradingUnit: string } | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [editingRateProdId, setEditingRateProdId] = useState<string | null>(null);

  // FIFO Packing Modal States
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [packingFul, setPackingFul] = useState<Fulfilment | null>(null);
  const [packingAllocations, setPackingAllocations] = useState<{ [fItemId: string]: BatchAllocation[] }>({});
  const [packingGodownFilter, setPackingGodownFilter] = useState<string>('all');

  // Dispatch Logistics Modal States
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState({
    transportMode: 'Distributor Delivery Van',
    vehicleNumber: 'MH-04-AZ-4592',
    deliveryPerson: 'Ramesh Sawant (Van Staff)',
    notes: 'Consolidated commercial cartons. Handle with care.',
    dispatchDate: new Date().toISOString().split('T')[0],
    dispatchGodown: 'Main Godown - Bhiwandi Bay 1'
  });

  const initializedKeyRef = React.useRef<string>('');
  const lastActiveFulIdRef = React.useRef<string>('');

  // Fetch or initialize active fulfilment if retailer is selected
  useEffect(() => {
    if (!selectedRetailerId) {
      initializedKeyRef.current = '';
      setActiveFul(null);
      return;
    }

    const currentKey = `${selectedRetailerId}_${selectedOrderIdsParam}`;
    if (initializedKeyRef.current !== currentKey) {
      initializedKeyRef.current = currentKey;
      setActionSuccessMsg('');

      if (selectedOrderIdsParam) {
        const orderIds = selectedOrderIdsParam.split(',').filter(Boolean);
        if (orderIds.length > 0) {
          const ful = consolidateOrders(selectedRetailerId, orderIds);
          setActiveFul(ful);
          return;
        }
      }

      const currentActive = fulfilments.find(
        f => f.retailer_id === selectedRetailerId && f.status !== 'Delivered' && f.status !== 'Cancelled'
      );
      if (currentActive) {
        setActiveFul(currentActive);
      } else {
        const ful = getOrCreateActiveFulfilment(selectedRetailerId);
        setActiveFul(ful);
      }
    }
  }, [selectedRetailerId, selectedOrderIdsParam]);

  // Sync confirms and manual rates local state when activeFul changes or is initialized
  useEffect(() => {
    if (!activeFul) {
      lastActiveFulIdRef.current = '';
      setConfirms({});
      setManualRates({});
      setFlatDiscounts({});
      return;
    }

    if (lastActiveFulIdRef.current !== activeFul.id) {
      lastActiveFulIdRef.current = activeFul.id;
      const initialConfirms: { [prodId: string]: number } = {};
      const initialManualRates: { [prodId: string]: { rate: string; reason: string } } = {};
      const initialDiscounts: { [prodId: string]: number } = {};

      activeFul.items?.forEach(item => {
        if (initialConfirms[item.product_id] === undefined) {
          initialConfirms[item.product_id] = 0;
        }
        initialConfirms[item.product_id] += item.confirmed_qty;

        if (item.manual_billing_rate !== undefined) {
          initialManualRates[item.product_id] = {
            rate: item.manual_billing_rate.toString(),
            reason: item.override_reason || 'Special Deal'
          };
        }
        if (item.discount !== undefined) {
          initialDiscounts[item.product_id] = item.discount;
        }
      });
      setConfirms(initialConfirms);
      setManualRates(initialManualRates);
      setFlatDiscounts(initialDiscounts);
    }
  }, [activeFul]);

  const handleUpdateConfirm = (productId: string, val: number) => {
    setConfirms(prev => ({
      ...prev,
      [productId]: Math.max(0, val)
    }));
  };

  // Derive unique cities
  const uniqueCities = Array.from(new Set(retailers.map(r => r.city).filter(Boolean))).sort();
  const salespeopleList = profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co');

  // Filter & Group Queue calculations
  const eligibleOrdersList = orders.filter(o => 
    o.status !== 'Delivered' && 
    o.status !== 'Cancelled'
  );

  const eligibleOrders = eligibleOrdersList.filter(o => 
    o.items?.some(item => {
      const pending = item.pending_qty !== undefined ? item.pending_qty : (item.quantity - (item.delivered_qty || 0) - (item.cancelled_qty || 0));
      return pending > 0;
    })
  );

  const filteredOrders = eligibleOrders.filter(ord => {
    const ret = retailers.find(r => r.id === ord.retailer_id);
    const matchCity = filterCity === 'all' || (ret && ret.city.trim().toLowerCase() === filterCity.trim().toLowerCase());
    const matchRetailer = filterRetailer === 'all' || ord.retailer_id === filterRetailer;
    const matchSalesperson = filterSalesperson === 'all' || ord.created_by === filterSalesperson;
    const matchDate = !filterOrderDate || ord.order_date.startsWith(filterOrderDate);

    const orderTime = new Date(ord.order_date).getTime();
    const daysPending = Math.floor((Date.now() - orderTime) / (1000 * 60 * 60 * 24));
    let matchDays = true;
    if (filterDaysRange === 'today') {
      matchDays = daysPending === 0;
    } else if (filterDaysRange === '1-2') {
      matchDays = daysPending >= 1 && daysPending <= 2;
    } else if (filterDaysRange === '3-7') {
      matchDays = daysPending >= 3 && daysPending <= 7;
    } else if (filterDaysRange === '7+') {
      matchDays = daysPending > 7;
    }

    let matchProduct = filterProduct === 'all';
    let matchCompany = filterCompany === 'all';
    ord.items?.forEach(item => {
      if (item.product_id === filterProduct) {
        matchProduct = true;
      }
      const prod = products.find(p => p.id === item.product_id);
      if (prod && prod.company_id === filterCompany) {
        matchCompany = true;
      }
    });

    let matchStatus = true;
    if (filterStatus !== 'all') {
      const activeF = fulfilments.find(f => f.retailer_id === ord.retailer_id && f.status !== 'Delivered' && f.status !== 'Cancelled');
      const currentStatus = activeF ? activeF.status : 'READY TO PROCESS';
      matchStatus = currentStatus.trim().toLowerCase() === filterStatus.trim().toLowerCase();
    }

    const shopName = ret ? ret.shop_name.toLowerCase() : '';
    const num = ord.order_number.toLowerCase();
    const matchSearch = searchTerm.trim() === '' || 
      shopName.includes(searchTerm.toLowerCase()) || 
      num.includes(searchTerm.toLowerCase());

    return matchCity && matchRetailer && matchSalesperson && matchDate && matchDays && matchProduct && matchCompany && matchStatus && matchSearch;
  });

  // Group by Retailer
  const groupedQueueMap: { [retId: string]: {
    retailer: Retailer;
    orders: Order[];
    totalPendingCartons: number;
    totalPendingLoose: number;
    totalPendingBase: number;
    totalAmount: number;
    activeFulfilment: Fulfilment | null;
  }} = {};

  filteredOrders.forEach(ord => {
    const retId = ord.retailer_id;
    const ret = retailers.find(r => r.id === retId);
    if (!ret) return;

    if (!groupedQueueMap[retId]) {
      const activeF = fulfilments.find(f => f.retailer_id === retId && f.status !== 'Delivered' && f.status !== 'Cancelled');
      groupedQueueMap[retId] = {
        retailer: ret,
        orders: [],
        totalPendingCartons: 0,
        totalPendingLoose: 0,
        totalPendingBase: 0,
        totalAmount: 0,
        activeFulfilment: activeF || null
      };
    }

    groupedQueueMap[retId].orders.push(ord);
    groupedQueueMap[retId].totalAmount += ord.total_amount;
    
    ord.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const baseQty = item.base_qty ?? item.quantity;
      const delivered = item.delivered_qty || 0;
      const cancelled = item.cancelled_qty || 0;
      const pending = item.pending_qty !== undefined ? item.pending_qty : Math.max(0, baseQty - delivered - cancelled);
      if (pending > 0) {
        const split = splitBaseQuantity(pending, unitsPerPack);
        groupedQueueMap[retId].totalPendingCartons += split.cartonQty;
        groupedQueueMap[retId].totalPendingLoose += split.looseQty;
        groupedQueueMap[retId].totalPendingBase += pending;
      }
    });
  });

  const groupedQueue = Object.values(groupedQueueMap);

  // Helper for salesperson name mapping
  const getSalespersonName = (order: Order) => {
    if (order.source === 'retailer_direct') return 'Retailer Direct';
    if (order.source === 'counter_sale') return 'POS Counter Sale';
    const profile = profiles.find(p => p.id === order.created_by);
    return profile ? profile.name : 'Salesperson';
  };

  // Helper to get status label style
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'READY TO PROCESS': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Packing': return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'Confirmed': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Partially Confirmed': return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'Packed': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Dispatched': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'Delivered': return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      default: return 'bg-red-50 text-red-700 border border-red-200';
    }
  };

  // Execute Workspace Confirmation
  const handleExecuteWorkspaceConfirm = () => {
    if (!activeFul) return;

    const itemConfirms: { 
      itemId: string; 
      confirmedQty: number; 
      manualRate?: number | null; 
      rateReason?: string;
      discount?: number;
    }[] = [];

    // Distribute confirmed quantities back to original fulfilment items
    const allProdIds = Array.from(new Set(activeFul.items?.map(i => i.product_id) || []));
    allProdIds.forEach(productId => {
      const fItems = activeFul.items?.filter(item => item.product_id === productId) || [];
      const totalOrderedBase = fItems.reduce((s, i) => s + (i.base_qty ?? i.original_qty), 0);
      let remainingConfirmed = confirms[productId] !== undefined ? confirms[productId] : totalOrderedBase;
      const manualDraft = manualRates[productId];
      const parsedManualRate = manualDraft && manualDraft.rate ? parseFloat(manualDraft.rate) : undefined;
      const parsedDiscount = flatDiscounts[productId];
      
      // Sort smallest first to fulfil fully rather than spreading thin
      const sortedFItems = [...fItems].sort((a, b) => (a.base_qty ?? a.original_qty) - (b.base_qty ?? b.original_qty));

      sortedFItems.forEach(fItem => {
        const itemOriginalBase = fItem.base_qty ?? fItem.original_qty;
        const confirmQty = Math.min(itemOriginalBase, Math.max(0, remainingConfirmed));
        itemConfirms.push({
          itemId: fItem.id,
          confirmedQty: confirmQty,
          manualRate: parsedManualRate,
          rateReason: manualDraft?.reason,
          discount: parsedDiscount
        });
        remainingConfirmed -= confirmQty;
      });
    });

    const res = confirmConsolidation(activeFul.id, itemConfirms);
    if (res) {
      setActiveFul(res);
      setActionSuccessMsg('Confirmed quantities and commercial rates locked successfully. Reserved inventory updated.');
    } else {
      alert('Confirmation failed.');
    }
  };

  // FIFO Packing Modal Handler
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
    
    const res = packConsolidation(packingFul.id, itemsWithAllocations);
    if (res) {
      setActiveFul(res);
      setActionSuccessMsg('Batches allocated and fulfilment marked as PACKED. Ready for dispatch.');
    }
    setShowPackingModal(false);
    setPackingFul(null);
  };

  const handleOpenDispatchModal = () => {
    if (!activeFul) return;
    setShowDispatchModal(true);
  };

  const handleExecuteDispatch = () => {
    if (!activeFul) return;
    const res = dispatchConsolidation(activeFul.id, {
      transportMode: dispatchInfo.transportMode,
      vehicleNumber: dispatchInfo.vehicleNumber,
      deliveryPerson: dispatchInfo.deliveryPerson,
      notes: dispatchInfo.notes,
      dispatchDate: new Date(dispatchInfo.dispatchDate).toISOString(),
      dispatchGodown: dispatchInfo.dispatchGodown
    });

    if (res) {
      setShowDispatchModal(false);
      setActionSuccessMsg(`Fulfilment Dispatched! GST Tax Invoice ${res.invoice_number} and Delivery Challan generated successfully.`);
      const ful = getOrCreateActiveFulfilment(selectedRetailerId);
      setActiveFul(ful);
    }
  };

  const handleDeliver = () => {
    if (!activeFul) return;
    const res = deliverConsolidation(activeFul.id);
    if (res) {
      setActionSuccessMsg('Fulfilment marked as DELIVERED successfully.');
      const ful = getOrCreateActiveFulfilment(selectedRetailerId);
      setActiveFul(ful);
    }
  };

  const handleCancel = () => {
    if (!activeFul) return;
    if (confirm('Cancel this active fulfilment? Stock reservations will be released.')) {
      const res = cancelConsolidation(activeFul.id);
      if (res) {
        setActionSuccessMsg('Active fulfilment cancelled successfully.');
        router.push('/admin/consolidation');
      }
    }
  };

  if (!mounted) {
    return (
      <div className="space-y-6 pb-20 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="h-20 bg-slate-200 rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-slate-200 rounded-xl"></div>
          <div className="h-48 bg-slate-200 rounded-xl"></div>
          <div className="h-48 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Render Workspace View (When Retailer is Selected)
  if (selectedRetailerId) {
    const retailerInfo = retailers.find(r => r.id === selectedRetailerId);
    if (!retailerInfo) {
      return <div className="text-xs text-red-500 font-bold p-6">Retailer not found.</div>;
    }

    // Get contributing orders
    const contributingOrderIds = new Set(activeFul?.items?.map(item => item.order_id).filter(Boolean));
    const originalOrders = orders.filter(o => contributingOrderIds.has(o.id));

    // Group activeFul items by product for combined requirement matrix
    const groupedItemsMap: { [prodId: string]: {
      product: Product;
      tradingUnit: string;
      baseUnit: string;
      unitsPerPack: number;
      totalOrderedBase: number;
      totalOrderedSplit: { cartonQty: number; looseQty: number };
      availableStockBase: number;
      availableStockSplit: { cartonQty: number; looseQty: number };
      godownStock: { [godown: string]: { baseQty: number; display: string } };
      confirmedBase: number;
      pendingBase: number;
      catalogueRate: number;
      orderTimeRate: number;
      discount: number;
      manualBillingRate?: number;
      overrideReason?: string;
      finalAppliedRate: number;
      sources: {
        orderId: string;
        orderNumber: string;
        source: string;
        baseQty: number;
        displayQty: string;
        cartonQty: number;
        looseQty: number;
        confirmedBase: number;
      }[];
    }} = {};

    activeFul?.items?.forEach(fItem => {
      const prod = products.find(p => p.id === fItem.product_id);
      if (!prod) return;

      const unitsPerPack = fItem.units_per_trading_unit || prod.units_per_box_carton || 1;
      const tradingUnit = fItem.trading_unit || prod.trading_unit || 'Carton';
      const baseUnit = fItem.base_unit || prod.base_unit || 'Piece';

      const inv = inventory.find(i => i.product_id === fItem.product_id);
      const availStockBase = inv ? inv.available_qty : 0;

      // Godown stock breakdown
      const prodBatches = batches.filter(b => b.product_id === fItem.product_id && b.quantity > 0);
      const godownMap: { [godown: string]: { baseQty: number; display: string } } = {};
      prodBatches.forEach(b => {
        const gName = b.godown || 'Main Godown - Bhiwandi Bay 1';
        if (!godownMap[gName]) {
          godownMap[gName] = { baseQty: 0, display: '' };
        }
        godownMap[gName].baseQty += b.quantity;
      });
      Object.keys(godownMap).forEach(gName => {
        godownMap[gName].display = formatQuantityDisplay(godownMap[gName].baseQty, unitsPerPack, tradingUnit, baseUnit);
      });
      
      const orderMatch = orders.find(o => o.items?.some(oi => oi.id === fItem.order_item_id));
      const orderMatchItem = orderMatch?.items?.find(oi => oi.id === fItem.order_item_id);
      const orderNum = orderMatch ? orderMatch.order_number : 'Unknown';
      const orderSrc = orderMatch ? orderMatch.source : 'direct';

      const orderTimeRate = fItem.order_time_rate || orderMatchItem?.order_time_rate || orderMatchItem?.base_price || prod.selling_price;
      const discount = fItem.discount !== undefined ? fItem.discount : (orderMatchItem?.discount || 0);
      const effectiveBase = fItem.manual_billing_rate !== undefined ? fItem.manual_billing_rate : orderTimeRate;
      const finalApplied = Math.max(0, effectiveBase - discount);

      if (!groupedItemsMap[fItem.product_id]) {
        groupedItemsMap[fItem.product_id] = {
          product: prod,
          tradingUnit,
          baseUnit,
          unitsPerPack,
          totalOrderedBase: 0,
          totalOrderedSplit: { cartonQty: 0, looseQty: 0 },
          availableStockBase: availStockBase,
          availableStockSplit: splitBaseQuantity(availStockBase, unitsPerPack),
          godownStock: godownMap,
          confirmedBase: 0,
          pendingBase: 0,
          catalogueRate: prod.selling_price,
          orderTimeRate: orderTimeRate,
          discount: discount,
          manualBillingRate: fItem.manual_billing_rate,
          overrideReason: fItem.override_reason,
          finalAppliedRate: finalApplied,
          sources: []
        };
      }

      const itemBase = fItem.base_qty ?? fItem.original_qty;
      const itemConfBase = fItem.confirmed_qty || 0;
      const itemPendBase = fItem.pending_qty || 0;

      groupedItemsMap[fItem.product_id].totalOrderedBase += itemBase;
      groupedItemsMap[fItem.product_id].confirmedBase += itemConfBase;
      groupedItemsMap[fItem.product_id].pendingBase += itemPendBase;
      groupedItemsMap[fItem.product_id].totalOrderedSplit = splitBaseQuantity(
        groupedItemsMap[fItem.product_id].totalOrderedBase,
        unitsPerPack
      );

      if (fItem.manual_billing_rate !== undefined) {
        groupedItemsMap[fItem.product_id].manualBillingRate = fItem.manual_billing_rate;
        groupedItemsMap[fItem.product_id].overrideReason = fItem.override_reason;
        groupedItemsMap[fItem.product_id].finalAppliedRate = finalApplied;
      }

      const srcSplit = splitBaseQuantity(itemBase, unitsPerPack);
      groupedItemsMap[fItem.product_id].sources.push({
        orderId: fItem.order_id || '',
        orderNumber: orderNum,
        source: orderSrc,
        baseQty: itemBase,
        displayQty: formatQuantityDisplay(itemBase, unitsPerPack, tradingUnit, baseUnit),
        cartonQty: srcSplit.cartonQty,
        looseQty: srcSplit.looseQty,
        confirmedBase: itemConfBase
      });
    });

    const combinedProducts = Object.values(groupedItemsMap);

    const handleApplyManualRate = (productId: string) => {
      if (!activeFul) return;
      const draft = manualRates[productId];
      if (!draft || !draft.rate || draft.rate.trim() === '') {
        alert('Please enter a valid billing rate amount.');
        return;
      }
      const val = parseFloat(draft.rate);
      if (isNaN(val) || val <= 0) {
        alert('Billing rate must be a valid positive number greater than 0.');
        return;
      }
      const fItems = activeFul.items?.filter(item => item.product_id === productId) || [];
      fItems.forEach(fItem => {
        updateFulfilmentItemManualRate(
          activeFul.id,
          fItem.id,
          val,
          draft.reason || 'Admin manual rate override during billing'
        );
      });
      const updated = fulfilments.find(f => f.id === activeFul.id);
      if (updated) setActiveFul(updated);
      setEditingRateProdId(null);
      setActionSuccessMsg(`Admin manual rate ₹${val.toFixed(2)} applied for ${products.find(p => p.id === productId)?.name}`);
    };

    const handleResetManualRate = (productId: string) => {
      if (!activeFul) return;
      const fItems = activeFul.items?.filter(item => item.product_id === productId) || [];
      fItems.forEach(fItem => {
        updateFulfilmentItemManualRate(
          activeFul.id,
          fItem.id,
          undefined,
          'Reverted to order-time rate'
        );
      });
      const updated = fulfilments.find(f => f.id === activeFul.id);
      if (updated) setActiveFul(updated);
      setManualRates(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setEditingRateProdId(null);
      setActionSuccessMsg(`Manual rate cleared. Reverted to saved order-time rate.`);
    };

    const totalOrderedCartons = combinedProducts.reduce((sum, p) => sum + p.totalOrderedSplit.cartonQty, 0);
    const totalOrderedBaseUnits = combinedProducts.reduce((sum, p) => sum + p.totalOrderedBase, 0);

    const totalConfirmedCartons = combinedProducts.reduce((sum, p) => {
      const confBase = confirms[p.product.id] !== undefined ? confirms[p.product.id] : p.totalOrderedBase;
      return sum + splitBaseQuantity(confBase, p.unitsPerPack).cartonQty;
    }, 0);
    const totalConfirmedBaseUnits = combinedProducts.reduce((sum, p) => {
      const confBase = confirms[p.product.id] !== undefined ? confirms[p.product.id] : p.totalOrderedBase;
      return sum + confBase;
    }, 0);

    const totalBacklogCartons = Math.max(0, totalOrderedCartons - totalConfirmedCartons);
    const totalBacklogBaseUnits = Math.max(0, totalOrderedBaseUnits - totalConfirmedBaseUnits);

    return (
      <div className="space-y-6">
        {/* Breadcrumb Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <button
            onClick={() => router.push('/admin/consolidation')}
            className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Fulfilment Queue</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Rate Override Audit Trail</span>
            </button>
            <span className={`px-3 py-1.5 border text-xs font-black uppercase rounded-lg ${getStatusBadgeStyle(activeFul?.status || '')}`}>
              STAGE: {activeFul?.status?.toUpperCase() || 'DRAFT'}
            </span>
          </div>
        </div>

        {actionSuccessMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-semibold animate-in fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">{actionSuccessMsg}</div>
          </div>
        )}

        {/* Retailer Info Header Card */}
        <div className="erp-card bg-white p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm border border-slate-150 rounded-xl">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Retailer Profile</span>
            <h3 className="text-lg font-black text-slate-900 leading-tight">{retailerInfo.shop_name}</h3>
            <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span>{retailerInfo.address}, {retailerInfo.city}</span>
            </p>
            <p className="text-xs text-slate-600">GSTIN: <strong className="text-slate-900 font-bold">{retailerInfo.gstin || 'Unregistered'}</strong></p>
          </div>

          <div className="border-l border-slate-100 pl-0 md:pl-6 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Retailer ID:</span>
              <span className="font-mono font-bold text-slate-800">{retailerInfo.retailer_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Outstanding Bal:</span>
              <span className="font-extrabold text-red-600">₹{retailerInfo.outstanding.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Credit Limit:</span>
              <span className="font-bold text-slate-800">₹{retailerInfo.credit_limit.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="border-l border-slate-100 pl-0 md:pl-6 flex flex-col justify-center space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Active Fulfilment:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{activeFul?.fulfilment_number || 'DRAFT-001'}</span>
            </div>
            {retailerInfo.outstanding > retailerInfo.credit_limit && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold rounded-lg flex gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-amber-600 flex-shrink-0" />
                <span>Credit limit exceeded. Collect payment or verify before dispatch.</span>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Matrix & Operational Confirmation Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contributing Orders Panel */}
          <div className="erp-card bg-white p-5 space-y-4 shadow-sm border border-slate-150 rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Contributing Orders ({originalOrders.length})
              </h4>
              <PackageOpen className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {originalOrders.map(ord => (
                <div 
                  key={ord.id} 
                  className="p-3.5 border border-slate-100 hover:border-indigo-200 bg-slate-50/40 hover:bg-indigo-50/20 rounded-xl space-y-2 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-800">{ord.order_number}</span>
                      <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase">
                        {ord.source.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900">₹{ord.total_amount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>By: {getSalespersonName(ord)}</span>
                    <span>{new Date(ord.order_date).toLocaleDateString('en-IN')}</span>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => setViewingOrder(ord)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 font-bold hover:underline"
                    >
                      Inspect Source Items &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combined Operational Requirements & Breakdown Matrix */}
          <div className="lg:col-span-2 erp-card bg-white p-5 space-y-4 shadow-sm border border-slate-150 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Consolidated Product Matrix &amp; Commercial Pricing Decisions
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">Commercial packing units strictly enforced. Flat rupee discounts applied per unit.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allAvail: { [prodId: string]: number } = {};
                    combinedProducts.forEach(row => {
                      allAvail[row.product.id] = Math.min(row.totalOrderedBase, Math.max(0, row.availableStockBase));
                    });
                    setConfirms(allAvail);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Confirm All Available Stock
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50/50">
                    <th className="p-3">Product Variant</th>
                    <th className="p-3">Source Breakdown</th>
                    <th className="p-3 text-center">Available Stock</th>
                    <th className="p-3 text-left">Commercial Pricing</th>
                    <th className="p-3 text-center">Confirmed</th>
                    <th className="p-3 text-right">Backlog</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {combinedProducts.map(row => {
                    const currentConfBase = confirms[row.product.id] !== undefined ? confirms[row.product.id] : row.totalOrderedBase;
                    const currentConfSplit = splitBaseQuantity(currentConfBase, row.unitsPerPack);
                    const backlogBase = Math.max(0, row.totalOrderedBase - currentConfBase);
                    const isDraft = activeFul?.status === 'Packing';
                    const isEditingRate = editingRateProdId === row.product.id;
                    const draftRate = manualRates[row.product.id]?.rate ?? (row.manualBillingRate !== undefined ? row.manualBillingRate.toString() : row.orderTimeRate.toString());
                    const draftReason = manualRates[row.product.id]?.reason ?? (row.overrideReason || 'Special Deal');
                    const flatDisc = flatDiscounts[row.product.id] !== undefined ? flatDiscounts[row.product.id] : row.discount;

                    const effectiveRate = (row.manualBillingRate !== undefined ? row.manualBillingRate : row.orderTimeRate) - flatDisc;

                    return (
                      <tr key={row.product.id} className="hover:bg-slate-50/40">
                        {/* Product Variant */}
                        <td className="p-3 align-top min-w-[180px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm leading-tight">{row.product.name}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                              MRP: ₹{row.product.mrp}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 mt-0.5 block font-medium">
                            Brand: {row.product.brand} &bull; Pack: {row.product.pack_size}
                          </span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block mt-1">
                            {row.tradingUnit} ({row.unitsPerPack} {row.baseUnit}s/{row.tradingUnit})
                          </span>
                          
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={() => setRateHistoryTarget({ retailerId: selectedRetailerId, productId: row.product.id, tradingUnit: row.tradingUnit })}
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Last 5 Billed Rates</span>
                            </button>
                          </div>
                        </td>

                        {/* Source Orders Breakdown */}
                        <td className="p-3 align-top min-w-[180px]">
                          <div className="space-y-1">
                            <div className="font-extrabold text-slate-900 text-xs">
                              Total: {formatQuantityDisplay(row.totalOrderedBase, row.unitsPerPack, row.tradingUnit, row.baseUnit, true)}
                            </div>
                            <div className="space-y-1 border-l-2 border-indigo-200 pl-2">
                              {row.sources.map((src, idx) => (
                                <div key={idx} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                                  <span className="truncate">{src.orderNumber} ({src.source.replace('_', ' ')})</span>
                                  <span className="font-bold text-slate-900 whitespace-nowrap">{src.displayQty}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Available Stock & Godowns */}
                        <td className="p-3 align-top text-center">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold block ${
                            row.availableStockBase >= row.totalOrderedBase ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
                            row.availableStockBase > 0 ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                            'bg-red-50 text-red-800 border border-red-300'
                          }`}>
                            {formatQuantityDisplay(row.availableStockBase, row.unitsPerPack, row.tradingUnit, row.baseUnit, true)}
                          </span>

                          <div className="mt-1.5 space-y-0.5 text-left text-xs text-slate-600">
                            {Object.entries(row.godownStock).map(([gName, gData]) => (
                              <div key={gName} className="flex justify-between gap-1">
                                <span className="truncate max-w-[110px]" title={gName}>{gName.split(' - ')[0]}:</span>
                                <strong className="text-slate-800 whitespace-nowrap">{gData.display}</strong>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Commercial Pricing Decisions */}
                        <td className="p-3 align-top min-w-[210px]">
                          <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 text-xs">
                            <div className="flex justify-between text-xs text-slate-600 font-medium">
                              <span>Catalogue Rate:</span>
                              <span className="font-bold text-slate-800">₹{row.catalogueRate.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 font-medium">
                              <span>Order-Time Rate:</span>
                              <span className="font-bold text-slate-800">₹{row.orderTimeRate.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-amber-700 border-t border-slate-200 pt-1 font-semibold">
                              <span>Flat Rupee Disc:</span>
                              {isDraft ? (
                                <div className="flex items-center">
                                  <span className="text-xs mr-1 font-bold">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={flatDisc}
                                    onChange={(e) => setFlatDiscounts({
                                      ...flatDiscounts,
                                      [row.product.id]: Math.max(0, parseFloat(e.target.value) || 0)
                                    })}
                                    className="w-14 border border-slate-200 bg-white rounded p-0.5 text-right text-xs font-bold text-amber-700 outline-none"
                                  />
                                </div>
                              ) : (
                                <span className="font-bold">₹{flatDisc.toFixed(2)}/unit</span>
                              )}
                            </div>

                            {/* Manual rate applied indicator */}
                            {row.manualBillingRate !== undefined && (
                              <div className="pt-1 border-t border-slate-200">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold">
                                  <Tag className="w-3 h-3" />
                                  <span>Manual Rate: ₹{row.manualBillingRate.toFixed(2)}</span>
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between border-t border-slate-200 pt-1 text-xs">
                              <span className="font-bold text-slate-700">Final Applied:</span>
                              <span className="font-black text-indigo-700">₹{effectiveRate.toFixed(2)}/{row.tradingUnit}</span>
                            </div>

                            {/* Rate Override Toggle */}
                            {!isEditingRate ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRateProdId(row.product.id);
                                  setManualRates(prev => ({
                                    ...prev,
                                    [row.product.id]: {
                                      rate: draftRate,
                                      reason: draftReason
                                    }
                                  }));
                                }}
                                className="mt-1 w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{row.manualBillingRate !== undefined ? 'Modify Manual Override' : 'Override Selling Rate'}</span>
                              </button>
                            ) : (
                              <div className="mt-2 space-y-1.5 border-t border-indigo-100 pt-1.5">
                                <div>
                                  <label className="text-xs font-bold text-slate-700 uppercase block">Manual Rate (₹/{row.tradingUnit}):</label>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Rate > 0"
                                    value={manualRates[row.product.id]?.rate || ''}
                                    onChange={(e) => setManualRates({
                                      ...manualRates,
                                      [row.product.id]: {
                                        rate: e.target.value,
                                        reason: manualRates[row.product.id]?.reason || 'Special Deal'
                                      }
                                    })}
                                    className="w-full border border-indigo-200 bg-white rounded p-1 text-xs font-black text-indigo-700 outline-none mt-0.5"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-slate-700 uppercase block">Override Reason:</label>
                                  <select
                                    value={manualRates[row.product.id]?.reason || 'Special Deal'}
                                    onChange={(e) => setManualRates({
                                      ...manualRates,
                                      [row.product.id]: {
                                        rate: manualRates[row.product.id]?.rate || '',
                                        reason: e.target.value
                                      }
                                    })}
                                    className="w-full border border-slate-300 bg-white rounded p-1 text-xs font-medium outline-none mt-0.5"
                                  >
                                    <option value="Special Deal">Special Deal</option>
                                    <option value="Bulk Quantity Discount">Bulk Quantity Discount</option>
                                    <option value="Competitor Price Match">Competitor Price Match</option>
                                    <option value="Management Approval">Management Approval</option>
                                    <option value="Promotional Offer">Promotional Offer</option>
                                    <option value="Festival Discount">Festival Discount</option>
                                    <option value="Other">Other / Custom</option>
                                  </select>
                                </div>
                                <div className="flex gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleApplyManualRate(row.product.id)}
                                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                                  >
                                    Apply
                                  </button>
                                  {row.manualBillingRate !== undefined && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetManualRate(row.product.id)}
                                      className="py-1.5 px-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded text-xs font-bold cursor-pointer"
                                      title="Reset to order-time rate"
                                    >
                                      Reset
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingRateProdId(null)}
                                    className="py-1.5 px-2.5 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Quantity Confirmation */}
                        <td className="p-3 align-top text-center">
                          {isDraft ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={row.totalOrderedSplit.cartonQty}
                                  value={currentConfSplit.cartonQty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    const newBase = calculateBaseQuantity(val, currentConfSplit.looseQty, row.unitsPerPack);
                                    handleUpdateConfirm(row.product.id, Math.min(row.totalOrderedBase, newBase));
                                  }}
                                  className="w-16 border border-slate-300 rounded-lg p-1.5 text-center font-black text-slate-900 text-xs bg-white focus:border-indigo-500 outline-none shadow-xs"
                                />
                                <span className="text-xs text-slate-600 font-bold">{row.tradingUnit}</span>
                              </div>
                              {row.totalOrderedSplit.looseQty > 0 && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={row.totalOrderedSplit.looseQty}
                                    value={currentConfSplit.looseQty}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      const newBase = calculateBaseQuantity(currentConfSplit.cartonQty, val, row.unitsPerPack);
                                      handleUpdateConfirm(row.product.id, Math.min(row.totalOrderedBase, newBase));
                                    }}
                                    className="w-14 border border-slate-300 rounded p-1 text-center font-bold text-slate-800 text-xs bg-white focus:border-indigo-500 outline-none"
                                  />
                                  <span className="text-xs text-slate-500 font-medium">{row.baseUnit}</span>
                                </div>
                              )}
                              <span className="text-2xs text-slate-400 font-medium">
                                ({currentConfBase} {row.baseUnit}s)
                              </span>
                              {currentConfBase > row.availableStockBase && (
                                <span className="text-xs text-red-600 font-bold block">Exceeds Physical Stock</span>
                              )}
                            </div>
                          ) : (
                            <span className="font-black text-indigo-700 text-xs">
                              {formatQuantityDisplay(row.confirmedBase, row.unitsPerPack, row.tradingUnit, row.baseUnit, true)}
                            </span>
                          )}
                        </td>

                        {/* Backlog / Pending */}
                        <td className="p-3 align-top text-right font-semibold text-slate-600">
                          <span className={backlogBase > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                            {formatQuantityDisplay(backlogBase, row.unitsPerPack, row.tradingUnit, row.baseUnit)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Metrics & Action Bar */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 text-xs font-bold uppercase block">Total Ordered</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {totalOrderedCartons} CTN <span className="text-xs text-slate-500 font-medium">({totalOrderedBaseUnits} Pcs)</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs font-bold uppercase block">Confirmed Supply</span>
                  <span className="font-extrabold text-emerald-700 text-sm">
                    {totalConfirmedCartons} CTN <span className="text-xs text-emerald-600 font-medium">({totalConfirmedBaseUnits} Pcs)</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs font-bold uppercase block">Backlog Remaining</span>
                  <span className="font-extrabold text-amber-700 text-sm">
                    {totalBacklogCartons} CTN <span className="text-xs text-amber-600 font-medium">({totalBacklogBaseUnits} Pcs)</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeFul?.status !== 'Delivered' && activeFul?.status !== 'Cancelled' && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-650 hover:text-red-700 rounded-lg text-xs font-bold transition-all"
                  >
                    Cancel Fulfilment
                  </button>
                )}

                {activeFul?.status === 'Packing' && (
                  <button
                    onClick={handleExecuteWorkspaceConfirm}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-900/10 transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm &amp; Lock Quantities</span>
                  </button>
                )}

                {(activeFul?.status === 'Confirmed' || activeFul?.status === 'Partially Confirmed') && (
                  <button
                    onClick={() => handleOpenPackingModal(activeFul)}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-900/10 transition-all cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>Proceed to FIFO Packing</span>
                  </button>
                )}

                {activeFul?.status === 'Packed' && (
                  <>
                    <button
                      onClick={() => handleOpenPackingModal(activeFul)}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-indigo-200 hover:bg-indigo-50 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold transition-all cursor-pointer mr-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Edit Allocation</span>
                    </button>
                    <button
                      onClick={handleOpenDispatchModal}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Dispatch &amp; Generate Invoices</span>
                    </button>
                  </>
                )}

                {activeFul?.status === 'Dispatched' && (
                  <button
                    onClick={handleDeliver}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-900/10 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Mark as Delivered</span>
                  </button>
                )}

                {activeFul?.status === 'Delivered' && (
                  <span className="text-xs font-black text-emerald-600 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg">
                    <CheckCircle className="w-4.5 h-4.5" />
                    <span>FULFILLED &amp; DELIVERED</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Original Contributor Order Details Inspection */}
        {viewingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 border border-slate-100">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm uppercase">Inspect Contributor Order</h4>
                  <span className="text-xs text-slate-500 font-bold block mt-0.5">{viewingOrder.order_number}</span>
                </div>
                <button 
                  onClick={() => setViewingOrder(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <div>
                    <span className="text-slate-500 font-medium block">Source Channel</span>
                    <span className="font-bold text-slate-800 capitalize">{viewingOrder.source.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Booked By</span>
                    <span className="font-bold text-slate-800">{getSalespersonName(viewingOrder)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Order Timestamp</span>
                    <span className="font-semibold text-slate-800">{new Date(viewingOrder.order_date).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Total Value</span>
                    <span className="font-bold text-slate-900 text-sm">₹{viewingOrder.total_amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Ordered Lines</span>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-600 font-bold uppercase tracking-wider">
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-center">Ordered</th>
                          <th className="p-2.5 text-center">Confirmed</th>
                          <th className="p-2.5 text-center">Pending</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingOrder.items?.map(item => {
                          const prod = products.find(p => p.id === item.product_id);
                          const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
                          const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
                          const baseUnit = item.base_unit || prod?.base_unit || 'Piece';
                          const orderedBase = item.base_qty ?? item.quantity;
                          const confBase = item.confirmed_qty || 0;
                          const pendBase = item.pending_qty || 0;

                          return (
                            <tr key={item.id}>
                              <td className="p-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-xs block leading-tight">{prod?.name}</span>
                                  <span className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    MRP: ₹{item.selected_mrp ?? prod?.mrp ?? 0}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 block font-medium mt-0.5">{prod?.pack_size} ({tradingUnit})</span>
                              </td>
                              <td className="p-2.5 text-center text-slate-700 font-semibold">{formatQuantityDisplay(orderedBase, unitsPerPack, tradingUnit, baseUnit)}</td>
                              <td className="p-2.5 text-center text-slate-800 font-bold">{formatQuantityDisplay(confBase, unitsPerPack, tradingUnit, baseUnit)}</td>
                              <td className="p-2.5 text-center text-amber-700 font-black">{formatQuantityDisplay(pendBase, unitsPerPack, tradingUnit, baseUnit)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setViewingOrder(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-center text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: FIFO Stock Allocation & Multi-Batch Packing */}
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
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded text-xs font-extrabold uppercase">
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
                    <Warehouse className="w-4 h-4 text-slate-600" />
                    <span className="font-bold text-slate-800 text-xs">Filter Warehouse Godown:</span>
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
                  <span className="text-xs text-slate-500 font-medium">FIFO automatically prioritizes older stock entry &amp; cost layers</span>
                </div>

                {/* Items & Batches Allocation Body */}
                <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
                  {packingFul.items?.map(fItem => {
                    const prod = products.find(p => p.id === fItem.product_id);
                    const unitsPerPack = fItem.units_per_trading_unit || prod?.units_per_box_carton || 1;
                    const tradingUnit = fItem.trading_unit || prod?.trading_unit || 'Carton';
                    const baseUnit = fItem.base_unit || prod?.base_unit || 'Piece';
                    const currentAlloc = packingAllocations[fItem.id] || [];
                    const allocatedSum = currentAlloc.reduce((sum, a) => sum + a.allocated_qty, 0);
                    const remainingNeeded = fItem.confirmed_qty - allocatedSum;

                    const suggestions = getFifoBatchSuggestions(fItem.product_id, fItem.confirmed_qty, packingGodownFilter === 'all' ? undefined : packingGodownFilter);
                    const prodBatches = batches.filter(b => b.product_id === fItem.product_id && (packingGodownFilter === 'all' || b.godown === packingGodownFilter))
                      .sort((a, b) => new Date(a.entry_date || a.mfg_date || '2026-01-01').getTime() - new Date(b.entry_date || b.mfg_date || '2026-01-01').getTime());

                    return (
                      <div key={fItem.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-sm block leading-tight">{prod?.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                                MRP: ₹{fItem.selected_mrp ?? prod?.mrp ?? 0}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block font-semibold mt-0.5">
                              Brand: {prod?.brand} &bull; Pack: {prod?.pack_size} ({tradingUnit} of {unitsPerPack} {baseUnit}s)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleApplyFifoSuggestions(fItem.id, fItem.product_id, fItem.confirmed_qty)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>⚡ Accept FIFO Suggestions</span>
                            </button>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Confirmed Qty</span>
                              <span className="font-extrabold text-indigo-700 text-sm">
                                {formatQuantityDisplay(fItem.confirmed_qty, unitsPerPack, tradingUnit, baseUnit, true)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Batch Allocation Matrix Table */}
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Available Physical Batches</span>
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
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-extrabold text-slate-900 text-xs">{b.batch_number}</span>
                                        {isFifoPriority && (
                                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-black uppercase">
                                            FIFO Priority #{idx + 1}
                                          </span>
                                        )}
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                                          {b.godown || 'Main Godown'}
                                        </span>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-black rounded text-xs">
                                          MRP: ₹{b.mrp.toFixed(2)}
                                        </span>
                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded text-xs">
                                          Rate: ₹{(b.selling_price || prod?.selling_price || 0).toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                                        <span>Entry: <strong className="text-slate-800">{b.entry_date || '2026-03-01'}</strong></span>
                                        <span>Cost: <strong className="text-slate-800">₹{b.purchase_rate.toFixed(2)}</strong> ({b.cost_layer || 'PO-2026-031'})</span>
                                        <span>Exp: <strong className="text-slate-800">{new Date(b.expiry_date).toLocaleDateString('en-IN')}</strong></span>
                                        <span>Available: <strong className="text-slate-900 font-bold">{formatQuantityDisplay(b.quantity, unitsPerPack, tradingUnit, baseUnit)}</strong></span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col items-end gap-0.5">
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
                                            className="w-20 border border-slate-300 rounded-lg p-1.5 text-center text-xs font-bold focus:border-indigo-500 outline-none"
                                          />
                                          <span className="text-xs text-slate-500 font-bold ml-1.5 uppercase">{baseUnit}s</span>
                                        </div>
                                        {allocatedQty > 0 && (
                                          <span className="text-2xs text-indigo-700 font-semibold">
                                            ({formatQuantityDisplay(allocatedQty, unitsPerPack, tradingUnit, baseUnit)})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Summary Footer for Item */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-bold">
                          <div className="flex gap-4">
                            <span className="text-slate-600">
                              Allocated: <strong className="text-slate-900 font-black">{formatQuantityDisplay(allocatedSum, unitsPerPack, tradingUnit, baseUnit, true)}</strong>
                            </span>
                            {remainingNeeded > 0 ? (
                              <span className="text-red-600 font-black">
                                Remaining to Allocate: {formatQuantityDisplay(remainingNeeded, unitsPerPack, tradingUnit, baseUnit, true)}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-black">Fully Allocated 100% ✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Controls */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-b-2xl">
                  <div>
                    {!isFullyAllocated ? (
                      <span className="text-xs font-bold text-red-600 block">
                        ⚠️ Please allocate all required quantities across eligible batches.
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 block">
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
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 font-bold text-xs cursor-pointer"
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

        {/* Modal: Dispatch Logistics & Invoicing Execution */}
        {showDispatchModal && activeFul && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div>
                  <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider">Confirm Dispatch &amp; Generate Tax Invoice</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Execution deducts warehouse physical stock atomically and creates legal invoices.</p>
                </div>
                <button onClick={() => setShowDispatchModal(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Dispatch Godown</label>
                    <select
                      value={dispatchInfo.dispatchGodown}
                      onChange={(e) => setDispatchInfo({ ...dispatchInfo, dispatchGodown: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="Main Godown - Bhiwandi Bay 1">Main Godown - Bhiwandi Bay 1</option>
                      <option value="Central Godown - Indore Hub">Central Godown - Indore Hub</option>
                      <option value="City Godown - South Bay 2">City Godown - South Bay 2</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Transport Mode</label>
                    <select
                      value={dispatchInfo.transportMode}
                      onChange={(e) => setDispatchInfo({ ...dispatchInfo, transportMode: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="Distributor Delivery Van">Distributor Delivery Van</option>
                      <option value="Auto Cargo / Three Wheeler">Auto Cargo / Three Wheeler</option>
                      <option value="Tempo / Commercial Carrier">Tempo / Commercial Carrier</option>
                      <option value="Courier Express">Courier Express</option>
                      <option value="Counter Self-Pickup">Counter Self-Pickup</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Vehicle Number</label>
                    <input
                      type="text"
                      value={dispatchInfo.vehicleNumber}
                      onChange={(e) => setDispatchInfo({ ...dispatchInfo, vehicleNumber: e.target.value })}
                      placeholder="e.g. MH-04-AZ-4592"
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Delivery Person / Driver</label>
                    <input
                      type="text"
                      value={dispatchInfo.deliveryPerson}
                      onChange={(e) => setDispatchInfo({ ...dispatchInfo, deliveryPerson: e.target.value })}
                      placeholder="e.g. Ramesh Sawant"
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">Dispatch Date</label>
                  <input
                    type="date"
                    value={dispatchInfo.dispatchDate}
                    onChange={(e) => setDispatchInfo({ ...dispatchInfo, dispatchDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">Gate Pass &amp; Dispatch Instructions</label>
                  <textarea
                    rows={2}
                    value={dispatchInfo.notes}
                    onChange={(e) => setDispatchInfo({ ...dispatchInfo, notes: e.target.value })}
                    placeholder="e.g. Corrugated packaging. Fragile items handled."
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDispatch}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-900/10 flex items-center gap-1.5 cursor-pointer"
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

        {/* Audit Trail Modal */}
        {showAuditModal && (
          <AuditTrailModal
            isOpen={showAuditModal}
            onClose={() => setShowAuditModal(false)}
            retailerId={selectedRetailerId || undefined}
          />
        )}
      </div>
    );
  }

  // Render Fulfilment Queue View (Default)
  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Admin Fulfilment &amp; Consolidation Desk</h2>
          <p className="text-xs text-slate-500 mt-1">
            Combines multi-channel backlog orders by Retailer into a single commercial delivery run.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAuditModal(true)}
          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-850 text-xs font-bold rounded-lg flex items-center gap-1.5 self-start transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Rate Override Audit Log</span>
        </button>
      </div>

      {/* Quick Filters */}
      <div className="flex border border-slate-200 rounded-xl overflow-x-auto bg-white text-xs font-semibold scrollbar-none shadow-xs">
        {[
          { key: 'all', label: 'All Pending' },
          { key: 'today', label: 'Added Today' },
          { key: '1-2', label: '1–2 Days Pending' },
          { key: '3-7', label: '3–7 Days Pending' },
          { key: '7+', label: '7+ Days Pending' }
        ].map(filter => {
          let count = 0;
          eligibleOrders.forEach(ord => {
            const orderTime = new Date(ord.order_date).getTime();
            const daysPending = Math.floor((Date.now() - orderTime) / (1000 * 60 * 60 * 24));
            let match = false;
            if (filter.key === 'all') match = true;
            else if (filter.key === 'today') match = daysPending === 0;
            else if (filter.key === '1-2') match = daysPending >= 1 && daysPending <= 2;
            else if (filter.key === '3-7') match = daysPending >= 3 && daysPending <= 7;
            else if (filter.key === '7+') match = daysPending > 7;
            if (match) count++;
          });

          return (
            <button
              key={filter.key}
              onClick={() => setFilterDaysRange(filter.key)}
              className={`flex-1 py-3 px-4 text-center border-r border-slate-200 whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${
                filterDaysRange === filter.key ? 'bg-indigo-650 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span>{filter.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                filterDaysRange === filter.key ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Advanced Filters Panel */}
      <div className="erp-card bg-white p-5 space-y-4 shadow-sm border border-slate-150 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
          <SmartSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search shop, order #, retailer..."
            size="sm"
          />

          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Cities</option>
              {uniqueCities.map(city => (
                <option key={city} value={city.toLowerCase()}>{city}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterRetailer}
              onChange={(e) => setFilterRetailer(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Retailers</option>
              {retailers.map(r => (
                <option key={r.id} value={r.id}>{r.shop_name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterSalesperson}
              onChange={(e) => setFilterSalesperson(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Salespersons</option>
              {salespeopleList.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={filterOrderDate}
              onChange={(e) => setFilterOrderDate(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-700 font-medium"
            >
              <option value="all">All Workspace Statuses</option>
              <option value="READY TO PROCESS">Ready to Process</option>
              <option value="Packing">Draft (Packing)</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Partially Confirmed">Partially Confirmed</option>
              <option value="Packed">Packed</option>
              <option value="Dispatched">Dispatched</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            onClick={() => {
              setFilterCity('all');
              setFilterRetailer('all');
              setFilterProduct('all');
              setFilterSalesperson('all');
              setFilterCompany('all');
              setFilterDaysRange('all');
              setFilterOrderDate('');
              setFilterStatus('all');
              setSearchTerm('');
            }}
            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Queue Retailer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupedQueue.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-white border border-slate-150 rounded-xl text-slate-400 text-xs font-semibold">
            No retailers awaiting fulfilment match your filters.
          </div>
        ) : (
          groupedQueue.map(item => {
            const currentStatus = item.activeFulfilment ? item.activeFulfilment.status : 'READY TO PROCESS';
            const selectedOrderIds = selectedOrdersByRetailer[item.retailer.id] || item.orders.map(o => o.id);

            return (
              <div 
                key={item.retailer.id} 
                className="erp-card bg-white p-5 border border-slate-150 hover:border-indigo-300 hover:shadow-md rounded-xl transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-slate-900 text-base">{item.retailer.shop_name}</h4>
                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.retailer.city} &bull; Code: {item.retailer.retailer_code}</span>
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${getStatusBadgeStyle(currentStatus)}`}>
                      {currentStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-b border-slate-100 py-3 text-center text-xs">
                    <div>
                      <span className="text-xs text-slate-500 font-bold block uppercase">Orders</span>
                      <span className="font-black text-slate-900 text-sm">{item.orders.length}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-bold block uppercase">Pending</span>
                      <span className="font-black text-indigo-700 text-sm">
                        {item.totalPendingCartons > 0 && item.totalPendingLoose > 0
                          ? `${item.totalPendingCartons} CTN + ${item.totalPendingLoose} Pcs`
                          : item.totalPendingCartons > 0
                          ? `${item.totalPendingCartons} CTN`
                          : `${item.totalPendingLoose} Pcs`}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-bold block uppercase">Value</span>
                      <span className="font-black text-slate-900 text-sm">₹{item.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Orders Selector Checklist */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-bold uppercase">
                      <span>Select Contributing Orders:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = (selectedOrdersByRetailer[item.retailer.id] || []).length === item.orders.length;
                          setSelectedOrdersByRetailer({
                            ...selectedOrdersByRetailer,
                            [item.retailer.id]: allSelected ? [] : item.orders.map(o => o.id)
                          });
                        }}
                        className="text-indigo-600 hover:underline cursor-pointer"
                      >
                        {(selectedOrdersByRetailer[item.retailer.id] || item.orders.map(o => o.id)).length === item.orders.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                      {item.orders.map(ord => {
                        const isChecked = (selectedOrdersByRetailer[item.retailer.id] || item.orders.map(o => o.id)).includes(ord.id);
                        return (
                          <label 
                            key={ord.id}
                            className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = selectedOrdersByRetailer[item.retailer.id] || item.orders.map(o => o.id);
                                  const next = e.target.checked ? [...current, ord.id] : current.filter(id => id !== ord.id);
                                  setSelectedOrdersByRetailer({
                                    ...selectedOrdersByRetailer,
                                    [item.retailer.id]: next
                                  });
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                              />
                              <span className="font-bold text-slate-800">{ord.order_number}</span>
                            </div>
                            <span className="font-semibold text-slate-600">₹{ord.total_amount.toLocaleString('en-IN')}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      const sel = selectedOrdersByRetailer[item.retailer.id] || item.orders.map(o => o.id);
                      if (sel.length === 0) {
                        alert('Please select at least one order to consolidate.');
                        return;
                      }
                      router.push(`/admin/consolidation?retailer=${item.retailer.id}&orderIds=${sel.join(',')}`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                  >
                    <span>Consolidate &amp; Process ({selectedOrderIds.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <AuditTrailModal
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
        />
      )}
    </div>
  );
}

export default function FulfilmentQueue() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400 py-12 text-center font-semibold">Loading consolidation workspace...</div>}>
      <ConsolidationWorkspaceContent />
    </Suspense>
  );
}
