'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Boxes, Package, CheckCircle2, Clock, Search, MapPin, 
  ChevronRight, ArrowRight, Printer, AlertCircle, RefreshCw, 
  Layers, Check, Sparkles, User, Calendar, ShieldCheck, Filter,
  Phone, ArrowUpDown, FileText, ClipboardList, Eye, Save, Lock,
  Combine, Store, Zap, ShoppingBag, AlertTriangle, Minus, Plus
} from 'lucide-react';
import { Order, OrderItem, Product, Retailer, Inventory } from '@/lib/db';

type SortOption = 'size_desc' | 'size_asc' | 'date_asc' | 'date_desc';

/**
 * Formats order date cleanly, removing raw ISO timestamps
 * Example output: "Today, 06:10 PM", "Yesterday, 04:30 PM", or "30 Sep, 06:10 PM"
 */
function formatOrderDateTime(dateStr?: string, createdAtStr?: string): string {
  const target = createdAtStr || dateStr;
  if (!target) return 'Today';

  const d = new Date(target);
  if (isNaN(d.getTime())) {
    return dateStr || 'Today';
  }

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timePart = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  if (isToday) {
    return `Today, ${timePart}`;
  }
  if (isYesterday) {
    return `Yesterday, ${timePart}`;
  }

  const datePart = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata'
  });

  return `${datePart}, ${timePart}`;
}

interface ConsolidatedPackingItem {
  key: string;
  productId: string;
  productName: string;
  brand: string;
  barcode: string;
  mrp: number;
  unitsPerBox: number;
  packingDisplay: string;
  totalCartons: number;
  totalLoose: number;
  totalBaseUnits: number;
  sourceBreakdown: {
    orderId: string;
    orderNumber: string;
    cartonQty: number;
    looseQty: number;
  }[];
}

interface RetailerConsolidatedLot {
  retailerId: string;
  retailer: Retailer | undefined;
  shopName: string;
  ownerName: string;
  mobile: string;
  route: string;
  orders: Order[];
  orderIds: string[];
  orderNumbers: string[];
  sources: string[];
  latestOrderDate: string;
  earliestOrderDate: string;
  status: 'pending' | 'in_progress' | 'packed';
  totalCartons: number;
  totalLoose: number;
  totalSizeScore: number;
  totalUniqueSkus: number;
  combinedItems: ConsolidatedPackingItem[];
}

export default function StaffDashboardPage() {
  const { orders, retailers, products, godowns, inventory, currentUser, updateOrderStatus } = useDb();

  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'packed' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // Modal states
  const [selectedLot, setSelectedLot] = useState<RetailerConsolidatedLot | null>(null);
  const [packedItemsMap, setPackedItemsMap] = useState<Record<string, boolean>>({});
  const [packedBoxesMap, setPackedBoxesMap] = useState<Record<string, number>>({});
  const [packedLooseMap, setPackedLooseMap] = useState<Record<string, number>>({});

  const [isRoutePicklistOpen, setIsRoutePicklistOpen] = useState(false);
  const [picklistCheckedMap, setPicklistCheckedMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'warn' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Map retailers for fast O(1) lookups
  const retailerMap = useMemo(() => {
    return new Map(retailers.map(r => [r.id, r]));
  }, [retailers]);

  // Map products for fast O(1) lookups
  const productMap = useMemo(() => {
    return new Map(products.map(p => [p.id, p]));
  }, [products]);

  // Map inventory to aggregate available stock per product_id across godowns
  const inventoryStockMap = useMemo(() => {
    const map = new Map<string, { physical: number; reserved: number; available: number }>();
    inventory.forEach(inv => {
      const prev = map.get(inv.product_id) || { physical: 0, reserved: 0, available: 0 };
      const phys = inv.physical_qty || 0;
      const res = inv.reserved_qty || 0;
      const avail = inv.available_qty ?? Math.max(0, phys - res);

      map.set(inv.product_id, {
        physical: prev.physical + phys,
        reserved: prev.reserved + res,
        available: prev.available + avail
      });
    });
    return map;
  }, [inventory]);

  // Extract all unique routes / beats dynamically
  const availableRoutes = useMemo(() => {
    const routeSet = new Set<string>();
    retailers.forEach(r => {
      const b = r.route || r.beat_name;
      if (b && b.trim()) routeSet.add(b.trim());
    });
    return Array.from(routeSet).sort();
  }, [retailers]);

  // 1. RETAILER-WISE CONSOLIDATION ENGINE
  const consolidatedLots = useMemo(() => {
    const map = new Map<string, Order[]>();

    // Group orders by retailer_id
    orders.forEach(order => {
      const retId = order.retailer_id || 'counter_retailer';
      const existing = map.get(retId) || [];
      existing.push(order);
      map.set(retId, existing);
    });

    const lots: RetailerConsolidatedLot[] = [];

    map.forEach((retOrders, retId) => {
      const retailer = retailerMap.get(retId);
      const shopName = retailer?.shop_name || retailer?.owner_name || 'Counter Customer';
      const ownerName = retailer?.owner_name || '';
      const mobile = retailer?.mobile || retailer?.phone || '';
      const route = (retailer?.route || retailer?.beat_name || 'General Beat').trim();

      const orderIds = retOrders.map(o => o.id);
      const orderNumbers = retOrders.map(o => o.order_number || o.id);
      const sources = Array.from(new Set(retOrders.map(o => o.source || o.channel || 'Salesman')));

      // Calculate aggregated items across all orders in this retailer lot
      const itemMap = new Map<string, ConsolidatedPackingItem>();

      let totalCartons = 0;
      let totalLoose = 0;

      retOrders.forEach(order => {
        const ordNum = order.order_number || order.id;
        order.items?.forEach(it => {
          const prod = productMap.get(it.product_id);
          const cQty = it.carton_qty ?? 0;
          const lQty = it.loose_qty ?? 0;
          const bQty = it.quantity ?? ((cQty * (it.units_per_box_carton || prod?.units_per_box_carton || 1)) + lQty);

          totalCartons += cQty;
          totalLoose += lQty;

          const key = it.product_id;
          const prev = itemMap.get(key) || {
            key,
            productId: it.product_id,
            productName: it.product_name || prod?.name || 'FMCG Product',
            brand: prod?.brand || 'Saifee',
            barcode: prod?.barcode || prod?.sku || '-',
            mrp: it.mrp || prod?.mrp || 0,
            unitsPerBox: it.units_per_box_carton || prod?.units_per_box_carton || 1,
            packingDisplay: prod?.packing_display || `${it.units_per_box_carton || prod?.units_per_box_carton || 1} pcs/box`,
            totalCartons: 0,
            totalLoose: 0,
            totalBaseUnits: 0,
            sourceBreakdown: []
          };

          prev.totalCartons += cQty;
          prev.totalLoose += lQty;
          prev.totalBaseUnits += bQty;
          prev.sourceBreakdown.push({
            orderId: order.id,
            orderNumber: ordNum,
            cartonQty: cQty,
            looseQty: lQty
          });

          itemMap.set(key, prev);
        });
      });

      const combinedItems = Array.from(itemMap.values()).sort((a, b) => b.totalCartons - a.totalCartons);

      // Determine consolidated status for the lot
      let lotStatus: 'pending' | 'in_progress' | 'packed' = 'pending';
      const hasInProgress = retOrders.some(o => o.status === 'Packing' || o.status === 'PACKING_IN_PROGRESS');
      const allPacked = retOrders.every(o => o.status === 'Packed' || o.status === 'PACKED_AND_SEALED' || o.status === 'Ready for Dispatch' || o.status === 'Dispatched' || o.status === 'Delivered' || o.status === 'Completed');

      if (hasInProgress) {
        lotStatus = 'in_progress';
      } else if (allPacked) {
        lotStatus = 'packed';
      } else {
        lotStatus = 'pending';
      }

      // Dates
      const sortedDates = retOrders
        .map(o => new Date(o.created_at || o.order_date).getTime())
        .filter(t => !isNaN(t))
        .sort((a, b) => a - b);

      const earliestOrderDate = sortedDates.length > 0 ? new Date(sortedDates[0]).toISOString() : new Date().toISOString();
      const latestOrderDate = sortedDates.length > 0 ? new Date(sortedDates[sortedDates.length - 1]).toISOString() : new Date().toISOString();

      lots.push({
        retailerId: retId,
        retailer,
        shopName,
        ownerName,
        mobile,
        route,
        orders: retOrders,
        orderIds,
        orderNumbers,
        sources,
        latestOrderDate,
        earliestOrderDate,
        status: lotStatus,
        totalCartons,
        totalLoose,
        totalSizeScore: totalCartons * 1000 + totalLoose,
        totalUniqueSkus: combinedItems.length,
        combinedItems
      });
    });

    return lots;
  }, [orders, retailerMap, productMap]);

  // 2. FILTER & SORT CONSOLIDATED LOTS
  const filteredLots = useMemo(() => {
    const result = consolidatedLots.filter(lot => {
      // 1. Search Query filter
      const matchesSearch = 
        lot.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.mobile.includes(searchQuery) ||
        lot.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lot.orderNumbers.some(on => on.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Route / Beat filter
      if (selectedRoute !== 'ALL' && lot.route !== selectedRoute) {
        return false;
      }

      // 3. Status Tab filter
      if (activeTab === 'pending') {
        return lot.status === 'pending';
      }
      if (activeTab === 'in_progress') {
        return lot.status === 'in_progress';
      }
      if (activeTab === 'packed') {
        return lot.status === 'packed';
      }
      return true;
    });

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === 'size_desc') {
        return b.totalSizeScore - a.totalSizeScore;
      }
      if (sortBy === 'size_asc') {
        return a.totalSizeScore - b.totalSizeScore;
      }
      if (sortBy === 'date_asc') {
        return new Date(a.earliestOrderDate).getTime() - new Date(b.earliestOrderDate).getTime();
      }
      // default: date_desc (newest first)
      return new Date(b.latestOrderDate).getTime() - new Date(a.latestOrderDate).getTime();
    });

    return result;
  }, [consolidatedLots, activeTab, searchQuery, selectedRoute, sortBy]);

  // 3. TAB STATUS METRICS WITH BOTH LOT AND ORDER COUNTS
  const counts = useMemo(() => {
    let pendingLots = 0;
    let pendingOrders = 0;
    let inProgressLots = 0;
    let inProgressOrders = 0;
    let packedLots = 0;
    let packedOrders = 0;

    consolidatedLots.forEach(lot => {
      if (selectedRoute !== 'ALL' && lot.route !== selectedRoute) return;

      const orderCount = lot.orders.length;
      if (lot.status === 'pending') {
        pendingLots++;
        pendingOrders += orderCount;
      } else if (lot.status === 'in_progress') {
        inProgressLots++;
        inProgressOrders += orderCount;
      } else if (lot.status === 'packed') {
        packedLots++;
        packedOrders += orderCount;
      }
    });

    return {
      pendingLots,
      pendingOrders,
      inProgressLots,
      inProgressOrders,
      packedLots,
      packedOrders,
      totalLots: pendingLots + inProgressLots + packedLots,
      totalOrders: pendingOrders + inProgressOrders + packedOrders
    };
  }, [consolidatedLots, selectedRoute]);

  // Helper to render source badges
  const getLotSourceBadges = (sources: string[]) => {
    const hasCounter = sources.some(s => s.toLowerCase().includes('counter'));
    const hasRetailer = sources.some(s => s.toLowerCase().includes('retailer'));
    const hasSalesman = sources.some(s => s.toLowerCase().includes('sales'));

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {hasSalesman && (
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <span>🛵 Salesman</span>
          </span>
        )}
        {hasRetailer && (
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <span>🏪 Retailer App</span>
          </span>
        )}
        {hasCounter && (
          <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <span>⚡ Counter Spot</span>
          </span>
        )}
      </div>
    );
  };

  // Open Packing Modal for a consolidated lot and initialize editable counts
  const handleOpenPackingModal = (lot: RetailerConsolidatedLot) => {
    setSelectedLot(lot);
    const initialPackedMap: Record<string, boolean> = {};
    const initialBoxesMap: Record<string, number> = {};
    const initialLooseMap: Record<string, number> = {};

    const isAlreadyPacked = lot.status === 'packed';

    // Retrieve any saved draft progress from localStorage if available
    let savedDraft: { boxes?: Record<string, number>; loose?: Record<string, number>; verified?: Record<string, boolean> } | null = null;
    try {
      const storageKey = `packer_draft_${lot.retailerId}`;
      const savedStr = localStorage.getItem(storageKey);
      if (savedStr) {
        savedDraft = JSON.parse(savedStr);
      }
    } catch {
      // ignore
    }

    lot.combinedItems.forEach(it => {
      // Default to saved draft or ordered quantity
      const savedBox = savedDraft?.boxes?.[it.key];
      const savedLoose = savedDraft?.loose?.[it.key];
      const savedVer = savedDraft?.verified?.[it.key];

      initialBoxesMap[it.key] = typeof savedBox === 'number' ? savedBox : it.totalCartons;
      initialLooseMap[it.key] = typeof savedLoose === 'number' ? savedLoose : it.totalLoose;
      initialPackedMap[it.key] = isAlreadyPacked || !!savedVer;
    });

    setPackedBoxesMap(initialBoxesMap);
    setPackedLooseMap(initialLooseMap);
    setPackedItemsMap(initialPackedMap);
  };

  // Toggle checklist item
  const handleToggleItemPacked = (itemKey: string) => {
    setPackedItemsMap(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  // Check all items
  const handleCheckAllItems = () => {
    if (!selectedLot?.combinedItems) return;
    const allMap: Record<string, boolean> = {};
    selectedLot.combinedItems.forEach(it => {
      allMap[it.key] = true;
    });
    setPackedItemsMap(allMap);
  };

  // Handle Box Quantity change
  const handlePackedBoxesChange = (itemKey: string, valStr: string, maxAvailBoxes?: number) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    setPackedBoxesMap(prev => ({
      ...prev,
      [itemKey]: val
    }));
    // Auto-mark as verified when quantity adjusted
    setPackedItemsMap(prev => ({
      ...prev,
      [itemKey]: true
    }));
  };

  // Handle Loose Quantity change
  const handlePackedLooseChange = (itemKey: string, valStr: string) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    setPackedLooseMap(prev => ({
      ...prev,
      [itemKey]: val
    }));
    setPackedItemsMap(prev => ({
      ...prev,
      [itemKey]: true
    }));
  };

  // Quick helper: Set packed to ordered full quantity
  const handleSetFullOrdered = (it: ConsolidatedPackingItem) => {
    setPackedBoxesMap(prev => ({ ...prev, [it.key]: it.totalCartons }));
    setPackedLooseMap(prev => ({ ...prev, [it.key]: it.totalLoose }));
    setPackedItemsMap(prev => ({ ...prev, [it.key]: true }));
  };

  // Quick helper: Set packed to max available stock
  const handleSetMaxStock = (it: ConsolidatedPackingItem, availPcs: number) => {
    const units = it.unitsPerBox || 1;
    const maxBoxes = Math.floor(availPcs / units);
    const maxLoose = availPcs % units;

    setPackedBoxesMap(prev => ({ ...prev, [it.key]: maxBoxes }));
    setPackedLooseMap(prev => ({ ...prev, [it.key]: maxLoose }));
    setPackedItemsMap(prev => ({ ...prev, [it.key]: true }));
  };

  // Quick helper: Set packed to 0 (Out of stock)
  const handleSetZeroStock = (it: ConsolidatedPackingItem) => {
    setPackedBoxesMap(prev => ({ ...prev, [it.key]: 0 }));
    setPackedLooseMap(prev => ({ ...prev, [it.key]: 0 }));
    setPackedItemsMap(prev => ({ ...prev, [it.key]: true }));
  };

  // Start packing a lot
  const handleStartPackingLot = (lot: RetailerConsolidatedLot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const packerName = currentUser?.name || 'Staff';
    
    // Update all linked orders to PACKING_IN_PROGRESS
    lot.orders.forEach(ord => {
      updateOrderStatus(ord.id, 'PACKING_IN_PROGRESS', `Consolidated packing started by ${packerName}`);
    });

    showToast(`Started packing for ${lot.shopName} (${lot.orders.length} merged orders)!`);
    handleOpenPackingModal({
      ...lot,
      status: 'in_progress'
    });
  };

  // Save partial packing progress across all linked orders
  const handleSavePackingProgress = () => {
    if (!selectedLot) return;
    const packedCount = Object.values(packedItemsMap).filter(Boolean).length;
    const totalCount = selectedLot.combinedItems.length;
    const packerName = currentUser?.name || 'Packer';

    // Persist draft in localStorage
    try {
      const storageKey = `packer_draft_${selectedLot.retailerId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        boxes: packedBoxesMap,
        loose: packedLooseMap,
        verified: packedItemsMap,
        timestamp: new Date().toISOString()
      }));
    } catch {
      // ignore
    }

    selectedLot.orders.forEach(ord => {
      updateOrderStatus(
        ord.id, 
        'PACKING_IN_PROGRESS', 
        `Packing progress saved (${packedCount}/${totalCount} SKUs verified by ${packerName})`
      );
    });

    showToast(`💾 Progress saved! ${packedCount} of ${totalCount} SKUs verified for ${selectedLot.shopName}.`);
    setSelectedLot(null);
  };

  // Mark lot as packed & sealed (updates all linked order IDs simultaneously)
  const handleMarkPackedAndSealed = () => {
    if (!selectedLot) return;
    const itemsCount = selectedLot.combinedItems.length;
    const packedCount = Object.values(packedItemsMap).filter(Boolean).length;

    // Check for shortages
    let hasShortages = false;
    let shortageSummary = '';
    selectedLot.combinedItems.forEach(it => {
      const pBox = packedBoxesMap[it.key] ?? it.totalCartons;
      const pLoose = packedLooseMap[it.key] ?? it.totalLoose;
      const units = it.unitsPerBox || 1;
      const packedTotalPcs = (pBox * units) + pLoose;
      const orderedTotalPcs = (it.totalCartons * units) + it.totalLoose;

      if (packedTotalPcs < orderedTotalPcs) {
        hasShortages = true;
        const diff = orderedTotalPcs - packedTotalPcs;
        shortageSummary += ` ${it.productName}: -${diff}pcs;`;
      }
    });

    if (itemsCount > 0 && packedCount < itemsCount) {
      if (!confirm(`You have verified ${packedCount} of ${itemsCount} SKUs. Confirm marking all ${selectedLot.orders.length} orders as Packed & Sealed?`)) {
        return;
      }
    }

    const packerName = currentUser?.name || 'Packer';
    const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    const note = hasShortages 
      ? `Packed & sealed by ${packerName} on ${timestamp} (Shortages recorded:${shortageSummary})`
      : `Packed & sealed (Consolidated Lot) by ${packerName} on ${timestamp}`;

    // Update ALL linked orders simultaneously
    selectedLot.orders.forEach(ord => {
      updateOrderStatus(ord.id, 'Packed', note);
    });

    // Clear draft storage
    try {
      localStorage.removeItem(`packer_draft_${selectedLot.retailerId}`);
    } catch {
      // ignore
    }

    showToast(
      hasShortages 
        ? `✅ All ${selectedLot.orders.length} orders for ${selectedLot.shopName} marked as PACKED & SEALED with shortage adjustments!`
        : `✅ All ${selectedLot.orders.length} orders for ${selectedLot.shopName} marked as PACKED & SEALED! Ready for Invoicing.`,
      hasShortages ? 'warn' : 'success'
    );

    setSelectedLot(null);
    setActiveTab('packed');
  };

  // Calculate Consolidated Route Picklist across all pending lots
  const consolidatedPicklist = useMemo(() => {
    const pendingLots = consolidatedLots.filter(lot => {
      if (selectedRoute !== 'ALL' && lot.route !== selectedRoute) return false;
      return lot.status === 'pending' || lot.status === 'in_progress';
    });

    const itemMap = new Map<string, {
      productName: string;
      brand: string;
      barcode: string;
      totalCartons: number;
      totalLoose: number;
      retailerNames: string[];
      orderNumbers: string[];
    }>();

    let totalOrdersCount = 0;

    pendingLots.forEach(lot => {
      totalOrdersCount += lot.orders.length;
      lot.combinedItems.forEach(it => {
        const key = it.productId;
        const prev = itemMap.get(key) || {
          productName: it.productName,
          brand: it.brand,
          barcode: it.barcode,
          totalCartons: 0,
          totalLoose: 0,
          retailerNames: [],
          orderNumbers: []
        };

        if (!prev.retailerNames.includes(lot.shopName)) {
          prev.retailerNames.push(lot.shopName);
        }

        it.sourceBreakdown.forEach(sb => {
          if (!prev.orderNumbers.includes(sb.orderNumber)) {
            prev.orderNumbers.push(sb.orderNumber);
          }
        });

        prev.totalCartons += it.totalCartons;
        prev.totalLoose += it.totalLoose;

        itemMap.set(key, prev);
      });
    });

    return {
      lotsCount: pendingLots.length,
      ordersCount: totalOrdersCount,
      items: Array.from(itemMap.values()).sort((a, b) => b.totalCartons - a.totalCartons)
    };
  }, [consolidatedLots, selectedRoute]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`fixed top-20 right-5 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-sm font-bold animate-in slide-in-from-top-3 border ${
          toastMessage.type === 'warn' 
            ? 'bg-amber-900 text-white border-amber-700' 
            : toastMessage.type === 'error'
            ? 'bg-rose-900 text-white border-rose-700'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {toastMessage.type === 'warn' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Staff Cockpit Welcome Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <Boxes className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Packer Cockpit &amp; Consolidated Lot Terminal
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Worker: <strong className="text-slate-800">{currentUser?.name || 'Staff'}</strong> ({currentUser?.custom_role || 'Packer'}) &bull; Retailer-wise consolidated box packing.
            </p>
          </div>
        </div>

        {/* Action Bar: Route Picklist & Shift Active Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsRoutePicklistOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <span>📋 Route Picklist ({consolidatedPicklist.items.length} SKUs)</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-800">Shift Active</span>
          </div>
        </div>
      </div>

      {/* Metric Counters Ribbon - Aligning Lots & Orders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-bold'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'pending' ? 'text-slate-950' : 'text-slate-400'}`}>
            Ready to Pack
          </span>
          <span className="text-2xl font-black block mt-1">{counts.pendingLots} Lots</span>
          <span className={`text-[11px] font-semibold block mt-0.5 ${activeTab === 'pending' ? 'text-slate-900' : 'text-slate-500'}`}>
            ({counts.pendingOrders} Total Orders)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'in_progress'
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md font-bold'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'in_progress' ? 'text-indigo-200' : 'text-slate-400'}`}>
            Packing In Progress
          </span>
          <span className="text-2xl font-black block mt-1">{counts.inProgressLots} Lots</span>
          <span className={`text-[11px] font-semibold block mt-0.5 ${activeTab === 'in_progress' ? 'text-indigo-100' : 'text-slate-500'}`}>
            ({counts.inProgressOrders} Total Orders)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('packed')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'packed'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md font-bold'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'packed' ? 'text-emerald-200' : 'text-slate-400'}`}>
            Packed &amp; Sealed
          </span>
          <span className="text-2xl font-black block mt-1">{counts.packedLots} Lots</span>
          <span className={`text-[11px] font-semibold block mt-0.5 ${activeTab === 'packed' ? 'text-emerald-100' : 'text-slate-500'}`}>
            ({counts.packedOrders} Total Orders)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white border-slate-950 shadow-md font-bold'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
            All Retailer Lots
          </span>
          <span className="text-2xl font-black block mt-1">{counts.totalLots} Lots</span>
          <span className={`text-[11px] font-semibold block mt-0.5 ${activeTab === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
            ({counts.totalOrders} Total Orders)
          </span>
        </button>
      </div>

      {/* FILTER & SORT TOOLBAR: BEAT SELECTOR, SEARCH, SORT */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search retailer shop, owner name, order #, or route..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Middle: Beat / Route Dropdown Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-500">Beat:</span>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Beats &amp; Routes</option>
              {availableRoutes.map(route => (
                <option key={route} value={route}>{route}</option>
              ))}
            </select>
          </div>

          {/* Right: Order Size & Date Sort */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Newest Orders First</option>
              <option value="date_asc">Oldest Orders First</option>
              <option value="size_desc">Consolidated Size (Boxes: High to Low)</option>
              <option value="size_asc">Consolidated Size (Boxes: Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONSOLIDATED PACKING CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLots.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No packing lots in this queue</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no retailer orders matching your current route filter or search criteria.
            </p>
          </div>
        ) : (
          filteredLots.map(lot => {
            const isPacked = lot.status === 'packed';
            const isPackingInProgress = lot.status === 'in_progress';
            const isMultipleOrders = lot.orders.length > 1;

            return (
              <div 
                key={lot.retailerId}
                onClick={() => handleOpenPackingModal(lot)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Top: Ingestion Badges & Status Tag */}
                  <div className="flex items-start justify-between gap-2">
                    {getLotSourceBadges(lot.sources)}

                    {/* Status Tag */}
                    {isPacked ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Packed &amp; Sealed
                      </span>
                    ) : isPackingInProgress ? (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse shrink-0">
                        <RefreshCw className="w-3 h-3 animate-spin" /> In Progress
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> Ready to Pack
                      </span>
                    )}
                  </div>

                  {/* Party Identification (Shop Name, Owner, Mobile, Route) */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-slate-900 text-base truncate">{lot.shopName}</p>
                    </div>
                    
                    {(lot.ownerName || lot.mobile) && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        {lot.ownerName && <span className="truncate">👤 {lot.ownerName}</span>}
                        {lot.ownerName && lot.mobile && <span>&bull;</span>}
                        {lot.mobile && <span className="font-mono text-[11px] text-slate-500">📞 {lot.mobile}</span>}
                      </div>
                    )}

                    <p className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="truncate">{lot.route}</span>
                    </p>
                  </div>

                  {/* MERGED ORDERS BADGE */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono ${
                    isMultipleOrders 
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-bold' 
                      : 'bg-slate-50 border-slate-200 text-slate-700 font-semibold'
                  }`}>
                    <div className="flex items-center gap-1.5 truncate">
                      {isMultipleOrders ? (
                        <Combine className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {isMultipleOrders ? `MERGED (${lot.orders.length} Bills): ` : 'Order: '}
                        {lot.orderNumbers.join(' + ')}
                      </span>
                    </div>
                  </div>

                  {/* Consolidated Quantity Breakdown */}
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-100">
                      <span className="text-[10px] text-amber-800 font-bold uppercase block">Total Boxes</span>
                      <span className="text-base font-black text-amber-950">{lot.totalCartons} Box{lot.totalCartons !== 1 ? 'es' : ''}</span>
                    </div>
                    <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-800 font-bold uppercase block">Loose Pieces</span>
                      <span className="text-base font-black text-blue-950">{lot.totalLoose} Pcs</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    {lot.totalUniqueSkus} Unique SKUs
                  </span>

                  {!isPacked && !isPackingInProgress && (
                    <button
                      type="button"
                      onClick={(e) => handleStartPackingLot(lot, e)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>Start Packing</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isPackingInProgress && (
                    <button
                      type="button"
                      onClick={() => handleOpenPackingModal(lot)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>Packing Checklist</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isPacked && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Sealed &amp; Ready
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: CONSOLIDATED PACKING TERMINAL WITH LIVE STOCK & EDITABLE QUANTITIES */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Combine className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black">Consolidated Packing Terminal: {selectedLot.shopName}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-amber-300">{selectedLot.orderNumbers.join(' + ')}</span>
                    <span>&bull;</span>
                    <span>{selectedLot.route}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLot(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Checklist Progress & Security Notice */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">Consolidated Progress:</span>
                <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {Object.values(packedItemsMap).filter(Boolean).length} / {selectedLot.combinedItems.length} SKUs Verified
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 hidden sm:inline flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> Costs &amp; Margins Hidden
                </span>
                <button
                  type="button"
                  onClick={handleCheckAllItems}
                  className="text-indigo-600 hover:underline font-bold text-xs cursor-pointer"
                >
                  Verify All SKUs ✓
                </button>
              </div>
            </div>

            {/* Aggregated Line Items Table (Live Available Stock + Editable Packed Inputs) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              {selectedLot.combinedItems.map((item, idx) => {
                const isItemPacked = !!packedItemsMap[item.key];
                
                // 1. Live Available Warehouse Stock calculation
                const invData = inventoryStockMap.get(item.productId) || { physical: 0, reserved: 0, available: 0 };
                const unitsPerBox = item.unitsPerBox || 1;
                const availPcs = invData.available;
                const availBoxes = Math.floor(availPcs / unitsPerBox);
                const availLoose = availPcs % unitsPerBox;

                const orderedTotalPcs = (item.totalCartons * unitsPerBox) + item.totalLoose;
                const isLowStock = availPcs < orderedTotalPcs;

                // 2. Editable packed quantities
                const currentPackedBoxes = packedBoxesMap[item.key] ?? item.totalCartons;
                const currentPackedLoose = packedLooseMap[item.key] ?? item.totalLoose;
                const currentPackedTotalPcs = (currentPackedBoxes * unitsPerBox) + currentPackedLoose;

                // Shortage / Overpack difference
                const diffPcs = currentPackedTotalPcs - orderedTotalPcs;
                const isShortage = diffPcs < 0;
                const isOverpack = diffPcs > 0;
                const exceedsStock = currentPackedTotalPcs > availPcs;

                return (
                  <div
                    key={item.key || idx}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isItemPacked 
                        ? 'bg-emerald-50/50 border-emerald-300' 
                        : isLowStock 
                        ? 'bg-rose-50/20 border-rose-200' 
                        : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
                    }`}
                  >
                    {/* Left: Checkbox + Product Details + Live Stock Badge */}
                    <div className="flex items-start gap-3 flex-1">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleItemPacked(item.key)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                          isItemPacked 
                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                            : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      {/* Details */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-black ${isItemPacked ? 'text-emerald-950' : 'text-slate-900'}`}>
                            {item.productName}
                          </p>
                          
                          {/* Live Warehouse Stock Badge */}
                          {isLowStock ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-black flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Low Stock: Only {availBoxes > 0 ? `${availBoxes} Box ` : ''}{availLoose} Pcs ({availPcs} Pcs) avail</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Stock Avail: {availBoxes} Box{availBoxes !== 1 ? 'es' : ''}{availLoose > 0 ? ` + ${availLoose} Pcs` : ''} ({availPcs} Pcs)</span>
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                          <span>Brand: <strong className="text-slate-700">{item.brand}</strong></span>
                          <span>&bull;</span>
                          <span>Packing: {item.packingDisplay}</span>
                          <span>&bull;</span>
                          <span className="font-bold text-slate-700">MRP: ₹{Number(item.mrp).toFixed(2)}</span>
                          {item.barcode && item.barcode !== '-' && (
                            <>
                              <span>&bull;</span>
                              <span className="font-mono text-[11px] text-slate-400">SKU: {item.barcode}</span>
                            </>
                          )}
                        </div>

                        {/* Order breakdown pills */}
                        {item.sourceBreakdown.length > 1 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {item.sourceBreakdown.map((sb, sIdx) => (
                              <span key={sIdx} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600">
                                {sb.orderNumber}: {sb.cartonQty > 0 ? `${sb.cartonQty} Box` : ''} {sb.looseQty > 0 ? `${sb.looseQty} Loose` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Ordered Reference + Dual Editable Packed Inputs + Shortage Badge */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Original Ordered Reference */}
                      <div className="text-right text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Ordered Total</span>
                        <span className="font-mono font-bold text-slate-800 block">
                          {item.totalCartons} Box{item.totalCartons !== 1 ? 'es' : ''}{item.totalLoose > 0 ? `, ${item.totalLoose} Pcs` : ''}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">({orderedTotalPcs} Pcs)</span>
                      </div>

                      {/* Dual Packed Inputs */}
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        {/* Box Input */}
                        <div className="space-y-0.5 text-center">
                          <label className="text-[9px] font-black uppercase text-amber-800 block">Packed Boxes</label>
                          <input
                            type="number"
                            min="0"
                            value={currentPackedBoxes}
                            onChange={(e) => handlePackedBoxesChange(item.key, e.target.value, availBoxes)}
                            className="w-16 px-2 py-1 bg-white border border-amber-300 rounded-lg text-center font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                          />
                        </div>

                        <span className="text-slate-400 font-bold text-xs mt-3">+</span>

                        {/* Loose Input */}
                        <div className="space-y-0.5 text-center">
                          <label className="text-[9px] font-black uppercase text-blue-800 block">Loose Pcs</label>
                          <input
                            type="number"
                            min="0"
                            value={currentPackedLoose}
                            onChange={(e) => handlePackedLooseChange(item.key, e.target.value)}
                            className="w-16 px-2 py-1 bg-white border border-blue-300 rounded-lg text-center font-mono font-black text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                          />
                        </div>
                      </div>

                      {/* Quick Fill Action Buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetFullOrdered(item)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                          title="Fill full ordered quantity"
                        >
                          Full
                        </button>
                        {isLowStock && (
                          <button
                            type="button"
                            onClick={() => handleSetMaxStock(item, availPcs)}
                            className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-bold transition-colors cursor-pointer"
                            title="Fill max available stock"
                          >
                            Max Avail
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSetZeroStock(item)}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                          title="Set 0 (Out of stock)"
                        >
                          0 (OOS)
                        </button>
                      </div>

                      {/* Shortage / Stock Warning Badges */}
                      <div className="min-w-[90px] text-right">
                        {isShortage && (
                          <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black block">
                            Shortage: {diffPcs} Pcs
                          </span>
                        )}
                        {isOverpack && (
                          <span className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black block">
                            Overpack: +{diffPcs} Pcs
                          </span>
                        )}
                        {exceedsStock && (
                          <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black block mt-1">
                            ⚠️ Exceeds Avail Stock
                          </span>
                        )}
                        {!isShortage && !isOverpack && !exceedsStock && (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5" /> Exact Match
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer Actions: Save Progress, Print, Mark Packed & Sealed */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLot(null)}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Print Consolidated Slip</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePackingProgress}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  <span>💾 Save Progress</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkPackedAndSealed}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>📦 Mark Packed &amp; Sealed ({selectedLot.orders.length} Bills)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONSOLIDATED ROUTE PICKLIST (RAPID WAREHOUSE PICKING) */}
      {isRoutePicklistOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Picklist Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black">Consolidated Route Picklist</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <span>Route: <strong className="text-amber-300">{selectedRoute === 'ALL' ? 'All Active Routes' : selectedRoute}</strong></span>
                    <span>&bull;</span>
                    <span>{consolidatedPicklist.lotsCount} Retailer Lots ({consolidatedPicklist.ordersCount} Total Orders)</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRoutePicklistOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Picklist Subheader */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="font-bold text-slate-700">
                {consolidatedPicklist.items.length} Total SKUs to pull from warehouse racks
              </span>
              <button
                type="button"
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  consolidatedPicklist.items.forEach(it => {
                    all[it.productName] = true;
                  });
                  setPicklistCheckedMap(all);
                }}
                className="text-indigo-600 hover:underline font-bold text-xs cursor-pointer"
              >
                Check All Picked ✓
              </button>
            </div>

            {/* Picklist Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {consolidatedPicklist.items.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">No pending orders in the selected beat to generate picklist.</p>
                </div>
              ) : (
                consolidatedPicklist.items.map((item, idx) => {
                  const isChecked = !!picklistCheckedMap[item.productName];

                  return (
                    <div
                      key={idx}
                      onClick={() => setPicklistCheckedMap(prev => ({ ...prev, [item.productName]: !prev[item.productName] }))}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isChecked 
                          ? 'bg-emerald-50/70 border-emerald-300 opacity-80' 
                          : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isChecked 
                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                            : 'border-slate-300 bg-white text-transparent'
                        }`}>
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>

                        <div className="space-y-1">
                          <p className={`text-sm font-black ${isChecked ? 'line-through text-emerald-950' : 'text-slate-900'}`}>
                            {item.productName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <span>Brand: <strong className="text-slate-700">{item.brand}</strong></span>
                            {item.barcode && item.barcode !== '-' && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono text-[11px] text-slate-400">SKU: {item.barcode}</span>
                              </>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Retailers: <strong className="text-slate-800">{item.retailerNames.join(', ')}</strong> ({item.orderNumbers.length} orders)
                          </p>
                        </div>
                      </div>

                      {/* Quantities to Pick */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {item.totalCartons > 0 && (
                          <span className="px-3 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-xs shadow-xs">
                            {item.totalCartons} TOTAL BOX{item.totalCartons > 1 ? 'ES' : ''}
                          </span>
                        )}
                        {item.totalLoose > 0 && (
                          <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-950 font-bold text-xs">
                            {item.totalLoose} PCS Loose
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Picklist Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsRoutePicklistOpen(false)}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Print Route Picklist 🖨️</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
