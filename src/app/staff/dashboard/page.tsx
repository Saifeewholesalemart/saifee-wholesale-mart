'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Boxes, Package, CheckCircle2, Clock, Search, MapPin, 
  ChevronRight, ArrowRight, Printer, AlertCircle, RefreshCw, 
  Layers, Check, Sparkles, User, Calendar, ShieldCheck, Filter,
  Phone, ArrowUpDown, FileText, ClipboardList, Eye, Save, Lock,
  Combine, Store, Zap, ShoppingBag, AlertTriangle, Minus, Plus,
  Receipt, DollarSign, Tag, X, Info
} from 'lucide-react';
import { Order, OrderItem, Product, Retailer, Inventory, Invoice, DeliveryChallan, getProductTradeMode } from '@/lib/db';
import { 
  RetailerPendingOrderCard, 
  RetailerPendingProductItem,
  RetailerPackingLot,
  PackingLotItem
} from '@/lib/orderTerminalTypes';
import RetailerPendingCard from '@/components/orders/RetailerPendingCard';
import ContinuePendingPackingModal from '@/components/orders/ContinuePendingPackingModal';
import BillerGenerateInvoiceModal from '@/components/orders/BillerGenerateInvoiceModal';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import { printInvoiceDocument } from '@/lib/printInvoice';

type SortOption = 'date_desc' | 'date_asc' | 'qty_desc' | 'qty_asc' | 'items_desc' | 'items_asc';

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
  confirmedBaseUnits: number;
  packedBaseUnits?: number;
  fulfilledBaseUnits?: number;
  billableBaseUnits?: number;
  savedPackedCartons?: number;
  savedPackedLoose?: number;
  savedPackedPieces?: number;
  sourceBreakdown: {
    orderId: string;
    orderNumber: string;
    orderItemId?: string;
    cartonQty: number;
    looseQty: number;
    confirmedQty?: number;
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
  const { 
    orders, retailers, products, godowns, inventory, invoices, deliveryChallans,
    currentUser, updateOrderStatus, saveLotPackingProgress, activeCompany 
  } = useDb();

  // Terminal Role Mode: Default to 'biller' if user is Biller, else 'packer'
  const isUserBiller = currentUser?.custom_role?.toLowerCase().includes('biller');
  const [terminalRole, setTerminalRole] = useState<'packer' | 'biller'>(() => {
    return isUserBiller ? 'biller' : 'packer';
  });

  // Sync role mode if user changes
  useEffect(() => {
    if (currentUser?.custom_role?.toLowerCase().includes('biller')) {
      setTerminalRole('biller');
    } else {
      setTerminalRole('packer');
    }
  }, [currentUser]);

  // Operational Queues:
  // For PACKER: 'orders_to_pack' | 'packed_items' | 'pending_orders'
  // For BILLER: 'packed_items' | 'pending_orders' | 'billing_history'
  const [packerTab, setPackerTab] = useState<'orders_to_pack' | 'packed_items' | 'pending_orders'>('orders_to_pack');
  const [billerTab, setBillerTab] = useState<'packed_items' | 'pending_orders' | 'billing_history'>('packed_items');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // Modals state
  const [selectedLot, setSelectedLot] = useState<RetailerConsolidatedLot | null>(null);
  const [packedItemsMap, setPackedItemsMap] = useState<Record<string, boolean>>({});
  const [packedBoxesMap, setPackedBoxesMap] = useState<Record<string, number>>({});
  const [packedLooseMap, setPackedLooseMap] = useState<Record<string, number>>({});

  const [isRoutePicklistOpen, setIsRoutePicklistOpen] = useState(false);
  const [picklistFilter, setPicklistFilter] = useState<'ALL' | 'BY_BRAND' | 'BY_RACK'>('ALL');
  const [picklistCheckedMap, setPicklistCheckedMap] = useState<Record<string, boolean>>({});
  const [continuePackingCard, setContinuePackingCard] = useState<RetailerPendingOrderCard | null>(null);

  // Screen 3: Packed & Sealed Completion State
  const [completionModalData, setCompletionModalData] = useState<{
    shopName: string;
    route: string;
    totalCartons: number;
    totalLoose: number;
    ordersCount: number;
    lot: RetailerConsolidatedLot;
  } | null>(null);

  // Biller Invoice Modals
  const [selectedBillerLot, setSelectedBillerLot] = useState<RetailerPackingLot | null>(null);
  const [previewInvoiceModal, setPreviewInvoiceModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
    challan?: DeliveryChallan | null;
    retailer?: Retailer | null;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'warn' | 'error' } | null>(null);

  // Mounted check to prevent SSR hydration mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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

    // Group active open orders by retailer_id
    const activeOrders = orders.filter(order => {
      if (order.status === 'Cancelled') return false;
      const isDeliveredOrDone = (order.status === 'Completed' || order.status === 'Delivered') && 
        !(order.items || []).some(i => (i.remaining_qty || 0) > 0);
      return !isDeliveredOrDone;
    });

    activeOrders.forEach(order => {
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
          const meta = getProductTradeMode(prod);

          // Determine pack size (units per box/carton)
          const rawUnits = it.units_per_box_carton || (meta.packSize > 1 ? meta.packSize : (prod?.units_per_box_carton || 1));
          const unitsPerBox = meta.tradeMode !== 'PIECES' && rawUnits > 1 ? rawUnits : 1;

          // Total base pieces ordered & confirmed
          const totalBase = Math.max(0, Number(it.base_qty ?? it.ordered_pieces ?? it.ordered_qty ?? it.quantity ?? 0));
          const confirmedBase = (it.confirmed_qty !== undefined && it.confirmed_qty > 0) ? it.confirmed_qty : totalBase;
          const fulfilledBase = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? 0;
          const cancelledBase = it.cancelled_qty || 0;
          const unfulfilledBase = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, totalBase - fulfilledBase - cancelledBase);

          // If this item has already been 100% fulfilled in a prior lot, skip it from active packing lot
          if (unfulfilledBase <= 0 && (fulfilledBase > 0 || order.status === 'Completed')) {
            return;
          }

          // Determine authoritative packed base for this item
          const isPackedOrder = order.status === 'Packed' || 
                                order.status === 'PACKED_AND_SEALED' || 
                                order.status === 'Completed' || 
                                order.status === 'Dispatched' || 
                                order.status === 'Partially Fulfilled';

          let packedBase = 0;
          if (typeof it.packed_qty === 'number') {
            packedBase = it.packed_qty;
          } else if (typeof it.packed_pieces === 'number') {
            packedBase = it.packed_pieces;
          } else if (typeof it.packed_cartons === 'number') {
            packedBase = (it.packed_cartons * unitsPerBox) + (it.packed_loose ?? it.loose_qty ?? 0);
          } else if (isPackedOrder) {
            packedBase = Math.max(0, confirmedBase - (it.cancelled_qty || 0));
          } else {
            packedBase = 0;
          }

          let cQty = 0;
          let lQty = 0;

          if (it.carton_qty !== undefined && it.carton_qty !== null && (Number(it.carton_qty) > 0 || (it.loose_qty !== undefined && Number(it.loose_qty) > 0))) {
            cQty = Math.max(0, Number(it.carton_qty) || 0);
            lQty = Math.max(0, Number(it.loose_qty) || 0);
          } else if (totalBase > 0) {
            if (unitsPerBox > 1) {
              cQty = Math.floor(totalBase / unitsPerBox);
              lQty = totalBase % unitsPerBox;
            } else {
              cQty = 0;
              lQty = totalBase;
            }
          }

          const bQty = totalBase > 0 ? totalBase : ((cQty * unitsPerBox) + lQty);

          totalCartons += cQty;
          totalLoose += lQty;

          // Compute item level packed cartons and loose
          let itPackedCartons = 0;
          let itPackedLoose = 0;
          if (unitsPerBox > 1) {
            if (typeof it.packed_cartons === 'number') {
              itPackedCartons = it.packed_cartons;
              itPackedLoose = it.packed_loose ?? it.loose_qty ?? 0;
            } else {
              itPackedCartons = Math.floor(packedBase / unitsPerBox);
              itPackedLoose = packedBase % unitsPerBox;
            }
          } else {
            itPackedCartons = 0;
            itPackedLoose = packedBase;
          }

          const key = it.product_id;
          const packingDisplay = unitsPerBox > 1 
            ? (prod?.packing_display || `${unitsPerBox} pcs/box`) 
            : (prod?.pack_size || prod?.packing_display || '1 pc (Piece Mode)');

          const prev = itemMap.get(key) || {
            key,
            productId: it.product_id,
            productName: it.product_name || prod?.name || 'FMCG Product',
            brand: prod?.brand || 'Saifee',
            barcode: prod?.barcode || prod?.sku || '-',
            mrp: it.mrp || prod?.mrp || 0,
            unitsPerBox,
            packingDisplay,
            totalCartons: 0,
            totalLoose: 0,
            totalBaseUnits: 0,
            confirmedBaseUnits: 0,
            packedBaseUnits: 0,
            fulfilledBaseUnits: 0,
            billableBaseUnits: 0,
            savedPackedCartons: 0,
            savedPackedLoose: 0,
            savedPackedPieces: 0,
            sourceBreakdown: []
          };

          prev.totalCartons += cQty;
          prev.totalLoose += lQty;
          prev.totalBaseUnits += bQty;
          prev.confirmedBaseUnits += confirmedBase;
          prev.packedBaseUnits = (prev.packedBaseUnits || 0) + packedBase;
          prev.fulfilledBaseUnits = (prev.fulfilledBaseUnits || 0) + fulfilledBase;
          prev.billableBaseUnits = (prev.billableBaseUnits || 0) + Math.max(0, packedBase - fulfilledBase);

          prev.savedPackedCartons = (prev.savedPackedCartons || 0) + itPackedCartons;
          prev.savedPackedLoose = (prev.savedPackedLoose || 0) + itPackedLoose;
          prev.savedPackedPieces = (prev.savedPackedPieces || 0) + packedBase;

          prev.sourceBreakdown.push({
            orderId: order.id,
            orderNumber: ordNum,
            orderItemId: it.id,
            cartonQty: cQty,
            looseQty: lQty,
            confirmedQty: confirmedBase
          });

          itemMap.set(key, prev);
        });
      });

      const combinedItems = Array.from(itemMap.values()).sort((a, b) => b.totalCartons - a.totalCartons);

      // Determine consolidated status for the lot
      let lotStatus: 'pending' | 'in_progress' | 'packed' = 'pending';
      const hasInProgress = retOrders.some(o => o.status === 'Packing' || o.status === 'PACKING_IN_PROGRESS');
      const allPacked = retOrders.every(o => 
        o.status === 'Packed' || 
        o.status === 'PACKED_AND_SEALED' || 
        o.status === 'Partially Fulfilled' || 
        o.status === 'Ready for Dispatch' || 
        o.status === 'Dispatched' || 
        o.status === 'Delivered' || 
        o.status === 'Completed'
      );

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

  // 2. RETAILER-WISE PENDING ORDERS ENGINE (GROUPED BY RETAILER INTO 1 CARD)
  const retailerPendingCards = useMemo<RetailerPendingOrderCard[]>(() => {
    const retMap = new Map<string, {
      retailer: Retailer;
      orders: Order[];
    }>();

    orders.forEach(ord => {
      if (ord.status === 'Cancelled') return;

      const hasPending = (ord.items || []).some(it => {
        const ordBase = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
        const fulBase = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? 0;
        const cancBase = it.cancelled_qty ?? it.cancelled_pieces ?? 0;
        const packed = it.packed_qty ?? 0;

        let rem = 0;
        if (it.remaining_qty !== undefined) {
          rem = it.remaining_qty;
        } else if (it.pending_qty !== undefined) {
          rem = it.pending_qty;
        } else if (packed > 0 && packed < ordBase) {
          rem = Math.max(0, ordBase - packed - cancBase);
        } else {
          rem = Math.max(0, ordBase - fulBase - cancBase);
        }
        return rem > 0;
      });

      if (hasPending) {
        const retId = ord.retailer_id || 'counter_retailer';
        const ret = retailerMap.get(retId) || {
          id: retId,
          shop_name: 'Counter Customer',
          owner_name: '',
          city: 'Nagpur',
          mobile: '',
          phone: '',
          route: 'General Beat'
        } as any;

        const prev = retMap.get(retId) || { retailer: ret, orders: [] as Order[] };
        if (!prev.orders.some(o => o.id === ord.id)) {
          prev.orders.push(ord);
        }
        retMap.set(retId, prev);
      }
    });

    const cards: RetailerPendingOrderCard[] = [];

    retMap.forEach(({ retailer, orders: retOrders }, retId) => {
      const prodMap = new Map<string, RetailerPendingProductItem>();
      const sourceOrderNumbers: string[] = [];
      const sourceOrderIds: string[] = [];
      let totalPendingCartons = 0;
      let totalPendingPieces = 0;

      retOrders.forEach(ord => {
        const ordNum = ord.order_number || ord.id;
        if (!sourceOrderNumbers.includes(ordNum)) sourceOrderNumbers.push(ordNum);
        if (!sourceOrderIds.includes(ord.id)) sourceOrderIds.push(ord.id);

        (ord.items || []).forEach(it => {
          const prod = productMap.get(it.product_id);
          const meta = getProductTradeMode(prod);
          const rawUnits = it.units_per_box_carton || (meta.packSize > 1 ? meta.packSize : (prod?.units_per_box_carton || 1));
          const unitsPerPack = meta.tradeMode !== 'PIECES' && rawUnits > 1 ? rawUnits : 1;

          const totalOrdered = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
          const confQty = it.confirmed_qty !== undefined ? it.confirmed_qty : totalOrdered;
          const prevPacked = it.packed_qty ?? it.packed_pieces ?? 0;
          const cancelled = it.cancelled_qty ?? it.cancelled_pieces ?? 0;

          let remPieces = 0;
          if (it.remaining_qty !== undefined) {
            remPieces = it.remaining_qty;
          } else if (it.pending_qty !== undefined) {
            remPieces = it.pending_qty;
          } else if (prevPacked > 0 && prevPacked < totalOrdered) {
            remPieces = Math.max(0, totalOrdered - prevPacked - cancelled);
          } else {
            remPieces = Math.max(0, totalOrdered - (it.fulfilled_qty || 0) - cancelled);
          }

          if (remPieces <= 0) return;

          const pCartons = unitsPerPack > 1 ? Math.floor(remPieces / unitsPerPack) : 0;
          const pLoose = unitsPerPack > 1 ? (remPieces % unitsPerPack) : remPieces;

          totalPendingCartons += pCartons;
          totalPendingPieces += remPieces;

          const key = it.product_id;
          const mrp = it.mrp || prod?.mrp || 0;
          const rate = it.unit_rate || it.rate || it.base_price || prod?.selling_price || 0;
          const flatDiscount = it.carton_discount || it.discount || 0;

          const invItem = inventory.find(i => i.product_id === it.product_id);
          const availStockPieces = invItem?.available_qty || 0;
          const availStockCartons = unitsPerPack > 1 ? Math.floor(availStockPieces / unitsPerPack) : availStockPieces;

          const existingProd = prodMap.get(key) || {
            productId: it.product_id,
            productName: it.product_name || prod?.name || 'FMCG Product',
            brand: prod?.brand || 'Saifee',
            sku: prod?.sku || prod?.barcode || 'SKU',
            mrp,
            tradingUnit: prod?.trading_unit || 'Carton',
            baseUnit: prod?.base_unit || 'Piece',
            unitsPerPack,
            totalPendingPieces: 0,
            totalPendingCartons: 0,
            totalPendingLoose: 0,
            availStockPieces,
            availStockCartons,
            ordersBreakdown: []
          };

          existingProd.totalPendingPieces += remPieces;
          existingProd.totalPendingCartons += pCartons;
          existingProd.totalPendingLoose += pLoose;

          existingProd.ordersBreakdown.push({
            orderId: ord.id,
            orderNumber: ordNum,
            orderDate: ord.order_date || ord.created_at || new Date().toISOString(),
            itemId: it.id,
            orderedPieces: totalOrdered,
            confirmedPieces: confQty,
            previouslyPackedPieces: prevPacked,
            pendingPieces: remPieces,
            pendingCartons: pCartons,
            pendingLoose: pLoose,
            lockedUnitRate: rate,
            flatDiscount,
            channel: ord.channel || ord.source || 'Salesperson',
            salesperson: ord.created_by
          });

          prodMap.set(key, existingProd);
        });
      });

      const pendingProducts = Array.from(prodMap.values()).sort((a, b) => b.totalPendingPieces - a.totalPendingPieces);

      if (pendingProducts.length > 0) {
        cards.push({
          retailerId: retId,
          retailer,
          shopName: retailer.shop_name || retailer.owner_name || 'Counter Customer',
          ownerName: retailer.owner_name || '',
          city: retailer.city || 'Nagpur',
          phone: retailer.mobile || retailer.phone || '',
          route: (retailer.route || retailer.beat_name || 'General Beat').trim(),
          pendingOrdersCount: retOrders.length,
          pendingItemsCount: pendingProducts.length,
          totalPendingCartons,
          totalPendingPieces,
          pendingProducts,
          sourceOrderIds,
          sourceOrderNumbers,
          earliestOrderDate: retOrders[0]?.order_date || new Date().toISOString(),
          latestOrderDate: retOrders[retOrders.length - 1]?.order_date || new Date().toISOString()
        });
      }
    });

    return cards;
  }, [orders, retailerMap, productMap, inventory]);

  // 3. FILTER CONSOLIDATED LOTS & PENDING CARDS
  const filteredOrdersToPackLots = useMemo(() => {
    return consolidatedLots.filter(lot => {
      if (lot.status !== 'pending' && lot.status !== 'in_progress') return false;
      if (selectedRoute !== 'ALL' && lot.route !== selectedRoute) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return lot.shopName.toLowerCase().includes(q) ||
               lot.ownerName.toLowerCase().includes(q) ||
               lot.mobile.includes(q) ||
               lot.orderNumbers.some(on => on.toLowerCase().includes(q));
      }
      return true;
    });
  }, [consolidatedLots, selectedRoute, searchQuery]);

  const filteredPackedLots = useMemo(() => {
    return consolidatedLots.filter(lot => {
      if (lot.status !== 'packed') return false;
      if (selectedRoute !== 'ALL' && lot.route !== selectedRoute) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return lot.shopName.toLowerCase().includes(q) ||
               lot.ownerName.toLowerCase().includes(q) ||
               lot.mobile.includes(q) ||
               lot.orderNumbers.some(on => on.toLowerCase().includes(q));
      }
      return true;
    });
  }, [consolidatedLots, selectedRoute, searchQuery]);

  const filteredPendingCards = useMemo(() => {
    return retailerPendingCards.filter(card => {
      if (selectedRoute !== 'ALL' && card.route !== selectedRoute) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return card.shopName.toLowerCase().includes(q) ||
               card.ownerName.toLowerCase().includes(q) ||
               card.phone.includes(q) ||
               card.sourceOrderNumbers.some(on => on.toLowerCase().includes(q));
      }
      return true;
    });
  }, [retailerPendingCards, selectedRoute, searchQuery]);

  // Helper: Open packing modal for a lot
  const handleOpenPackingModal = (lot: RetailerConsolidatedLot) => {
    setSelectedLot(lot);
    const initialPackedMap: Record<string, boolean> = {};
    const initialBoxesMap: Record<string, number> = {};
    const initialLooseMap: Record<string, number> = {};

    const isAlreadyPacked = lot.status === 'packed';

    let savedDraft: { boxes?: Record<string, number>; loose?: Record<string, number>; verified?: Record<string, boolean> } | null = null;
    try {
      const storageKey = `packer_draft_${lot.retailerId}`;
      const savedStr = localStorage.getItem(storageKey);
      if (savedStr) savedDraft = JSON.parse(savedStr);
    } catch {
      // ignore
    }

    lot.combinedItems.forEach(it => {
      const savedBox = savedDraft?.boxes?.[it.key];
      const savedLoose = savedDraft?.loose?.[it.key];
      const savedVer = savedDraft?.verified?.[it.key];

      const defaultBox = typeof savedBox === 'number' 
        ? savedBox 
        : (it.savedPackedCartons !== undefined ? it.savedPackedCartons : it.totalCartons);
      const defaultLoose = typeof savedLoose === 'number' 
        ? savedLoose 
        : (it.savedPackedLoose !== undefined ? it.savedPackedLoose : it.totalLoose);
      const defaultVer = isAlreadyPacked || !!savedVer || (it.savedPackedPieces !== undefined && it.savedPackedPieces > 0);

      initialBoxesMap[it.key] = defaultBox;
      initialLooseMap[it.key] = defaultLoose;
      initialPackedMap[it.key] = defaultVer;
    });

    setPackedBoxesMap(initialBoxesMap);
    setPackedLooseMap(initialLooseMap);
    setPackedItemsMap(initialPackedMap);
  };

  const handleToggleItemPacked = (itemKey: string) => {
    setPackedItemsMap(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  const handleCheckAllItems = () => {
    if (!selectedLot?.combinedItems) return;
    const allMap: Record<string, boolean> = {};
    selectedLot.combinedItems.forEach(it => { allMap[it.key] = true; });
    setPackedItemsMap(allMap);
  };

  // Box change with Hard Validation: packed cannot exceed confirmed/ordered
  const handlePackedBoxesChange = (item: ConsolidatedPackingItem, valStr: string) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    const unitsPerBox = item.unitsPerBox > 1 ? item.unitsPerBox : 1;
    const currentLoose = packedLooseMap[item.key] ?? 0;
    
    // Total boxes cannot exceed item.totalCartons
    const clampedBoxes = Math.min(val, item.totalCartons);
    
    // Ensure (clampedBoxes * unitsPerBox) + currentLoose <= item.totalBaseUnits
    const remainingPieces = Math.max(0, item.totalBaseUnits - (clampedBoxes * unitsPerBox));
    const maxLooseAllowed = (clampedBoxes < item.totalCartons) ? (unitsPerBox - 1) : item.totalLoose;
    const newLoose = Math.min(currentLoose, Math.min(maxLooseAllowed, remainingPieces));

    setPackedBoxesMap(prev => ({ ...prev, [item.key]: clampedBoxes }));
    if (newLoose !== currentLoose) {
      setPackedLooseMap(prev => ({ ...prev, [item.key]: newLoose }));
    }
    setPackedItemsMap(prev => ({ ...prev, [item.key]: true }));
  };

  // Stepper helper for packed boxes
  const handleStepBoxes = (item: ConsolidatedPackingItem, delta: number) => {
    const current = packedBoxesMap[item.key] !== undefined ? packedBoxesMap[item.key] : (item.savedPackedCartons ?? item.totalCartons);
    const next = Math.max(0, Math.min(item.totalCartons, current + delta));
    handlePackedBoxesChange(item, String(next));
  };

  // Loose change with Hard Validation: packed cannot exceed confirmed/ordered total pieces
  const handlePackedLooseChange = (item: ConsolidatedPackingItem, valStr: string) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    const unitsPerBox = item.unitsPerBox > 1 ? item.unitsPerBox : 1;
    const currentBoxes = packedBoxesMap[item.key] ?? 0;

    let maxLoose = item.totalBaseUnits;
    if (unitsPerBox > 1) {
      const remainingPieces = Math.max(0, item.totalBaseUnits - (currentBoxes * unitsPerBox));
      const maxLooseForBoxes = (currentBoxes < item.totalCartons) ? (unitsPerBox - 1) : item.totalLoose;
      maxLoose = Math.min(maxLooseForBoxes, remainingPieces);
    }

    const clamped = Math.min(val, maxLoose);
    setPackedLooseMap(prev => ({ ...prev, [item.key]: clamped }));
    setPackedItemsMap(prev => ({ ...prev, [item.key]: true }));
  };

  // Stepper helper for packed loose pieces
  const handleStepLoose = (item: ConsolidatedPackingItem, delta: number) => {
    const current = packedLooseMap[item.key] !== undefined ? packedLooseMap[item.key] : (item.savedPackedLoose ?? item.totalLoose);
    const unitsPerBox = item.unitsPerBox > 1 ? item.unitsPerBox : 1;
    const currentBoxes = packedBoxesMap[item.key] !== undefined ? packedBoxesMap[item.key] : (item.savedPackedCartons ?? item.totalCartons);
    let maxLoose = item.totalBaseUnits;
    if (unitsPerBox > 1) {
      const remainingPieces = Math.max(0, item.totalBaseUnits - (currentBoxes * unitsPerBox));
      const maxLooseForBoxes = (currentBoxes < item.totalCartons) ? (unitsPerBox - 1) : item.totalLoose;
      maxLoose = Math.min(maxLooseForBoxes, remainingPieces);
    }
    const next = Math.max(0, Math.min(maxLoose, current + delta));
    handlePackedLooseChange(item, String(next));
  };

  const handleSetFullOrdered = (it: ConsolidatedPackingItem) => {
    setPackedBoxesMap(prev => ({ ...prev, [it.key]: it.totalCartons }));
    setPackedLooseMap(prev => ({ ...prev, [it.key]: it.totalLoose }));
    setPackedItemsMap(prev => ({ ...prev, [it.key]: true }));
  };

  const handleSetMaxStock = (it: ConsolidatedPackingItem, availPcs: number) => {
    const units = it.unitsPerBox > 1 ? it.unitsPerBox : 1;
    const totalOrderPcs = it.totalBaseUnits > 0 ? it.totalBaseUnits : ((it.totalCartons * units) + it.totalLoose);
    const packablePcs = Math.min(totalOrderPcs, Math.max(0, availPcs));

    if (units > 1) {
      const maxBoxes = Math.min(it.totalCartons, Math.floor(packablePcs / units));
      const maxLoose = packablePcs - (maxBoxes * units);
      setPackedBoxesMap(prev => ({ ...prev, [it.key]: maxBoxes }));
      setPackedLooseMap(prev => ({ ...prev, [it.key]: maxLoose }));
    } else {
      setPackedBoxesMap(prev => ({ ...prev, [it.key]: 0 }));
      setPackedLooseMap(prev => ({ ...prev, [it.key]: packablePcs }));
    }
    setPackedItemsMap(prev => ({ ...prev, [it.key]: true }));
  };

  const handleSetZeroStock = (it: ConsolidatedPackingItem) => {
    setPackedBoxesMap(prev => ({ ...prev, [it.key]: 0 }));
    setPackedLooseMap(prev => ({ ...prev, [it.key]: 0 }));
    setPackedItemsMap(prev => ({ ...prev, [it.key]: true }));
  };

  // Save partial packing progress
  const handleSavePackingProgress = () => {
    if (!selectedLot) return;
    const packedCount = Object.values(packedItemsMap).filter(Boolean).length;
    const totalCount = selectedLot.combinedItems.length;

    // Track remaining packed pieces available to allocate per product
    const remainingPackedPiecesMap: Record<string, number> = {};
    selectedLot.combinedItems.forEach(comb => {
      const unitsPerBox = comb.unitsPerBox > 1 ? comb.unitsPerBox : 1;
      const userBox = packedBoxesMap[comb.key] !== undefined ? packedBoxesMap[comb.key] : (comb.savedPackedCartons ?? comb.totalCartons);
      const userLoose = packedLooseMap[comb.key] !== undefined ? packedLooseMap[comb.key] : (comb.savedPackedLoose ?? comb.totalLoose);
      const totalPackedPcs = unitsPerBox > 1 ? (userBox * unitsPerBox) + userLoose : (userBox + userLoose);
      remainingPackedPiecesMap[comb.productId] = totalPackedPcs;
    });

    const itemsPayload: {
      originOrderId: string;
      originItemId: string;
      productId: string;
      packedPieces: number;
      packedCartons?: number;
      packedLoose?: number;
      unitRate?: number;
    }[] = [];

    selectedLot.orders.forEach(ord => {
      ord.items?.forEach(it => {
        const prod = productMap.get(it.product_id);
        const meta = getProductTradeMode(prod);
        const rawUnits = it.units_per_box_carton || (meta.packSize > 1 ? meta.packSize : (prod?.units_per_box_carton || 1));
        const unitsPerBox = meta.tradeMode !== 'PIECES' && rawUnits > 1 ? rawUnits : 1;

        const ordBase = Math.max(0, Number(it.base_qty ?? it.ordered_pieces ?? it.ordered_qty ?? it.quantity ?? 0));
        const targetPcs = ordBase;

        const availPcs = remainingPackedPiecesMap[it.product_id] !== undefined ? remainingPackedPiecesMap[it.product_id] : targetPcs;
        const allocatedPcs = Math.min(targetPcs, Math.max(0, availPcs));
        remainingPackedPiecesMap[it.product_id] = Math.max(0, availPcs - allocatedPcs);

        const itBox = unitsPerBox > 1 ? Math.floor(allocatedPcs / unitsPerBox) : 0;
        const itLoose = unitsPerBox > 1 ? (allocatedPcs % unitsPerBox) : allocatedPcs;

        itemsPayload.push({
          originOrderId: ord.id,
          originItemId: it.id,
          productId: it.product_id,
          packedPieces: allocatedPcs,
          packedCartons: itBox,
          packedLoose: itLoose,
          unitRate: it.unit_rate || it.rate || it.base_price
        });
      });
    });

    saveLotPackingProgress({
      retailerId: selectedLot.retailerId,
      sourceOrderIds: selectedLot.orderIds,
      items: itemsPayload,
      markAsSealed: false
    }, currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);

    showToast(`💾 Progress saved! ${packedCount} of ${totalCount} SKUs verified for ${selectedLot.shopName}.`);
    setSelectedLot(null);
  };

  // Mark packed & sealed
  const handleMarkPackedAndSealed = () => {
    if (!selectedLot) return;

    let totalShortagePieces = 0;
    const remainingPackedPiecesMap: Record<string, number> = {};
    selectedLot.combinedItems.forEach(comb => {
      const unitsPerBox = comb.unitsPerBox > 1 ? comb.unitsPerBox : 1;
      const userBox = packedBoxesMap[comb.key] !== undefined ? packedBoxesMap[comb.key] : (comb.savedPackedCartons ?? comb.totalCartons);
      const userLoose = packedLooseMap[comb.key] !== undefined ? packedLooseMap[comb.key] : (comb.savedPackedLoose ?? comb.totalLoose);
      const totalPackedPcs = unitsPerBox > 1 ? (userBox * unitsPerBox) + userLoose : (userBox + userLoose);
      remainingPackedPiecesMap[comb.productId] = totalPackedPcs;
    });

    const itemsPayload: {
      originOrderId: string;
      originItemId: string;
      productId: string;
      packedPieces: number;
      packedCartons?: number;
      packedLoose?: number;
      unitRate?: number;
    }[] = [];

    selectedLot.orders.forEach(ord => {
      ord.items?.forEach(it => {
        const prod = productMap.get(it.product_id);
        const meta = getProductTradeMode(prod);
        const rawUnits = it.units_per_box_carton || (meta.packSize > 1 ? meta.packSize : (prod?.units_per_box_carton || 1));
        const unitsPerBox = meta.tradeMode !== 'PIECES' && rawUnits > 1 ? rawUnits : 1;

        const ordBase = Math.max(0, Number(it.base_qty ?? it.ordered_pieces ?? it.ordered_qty ?? it.quantity ?? 0));
        const confBase = (it.confirmed_qty !== undefined && it.confirmed_qty > 0) ? it.confirmed_qty : ordBase;

        const availPcs = remainingPackedPiecesMap[it.product_id] !== undefined ? remainingPackedPiecesMap[it.product_id] : confBase;
        const allocatedPcs = Math.min(confBase, Math.max(0, availPcs));
        remainingPackedPiecesMap[it.product_id] = Math.max(0, availPcs - allocatedPcs);

        if (allocatedPcs < confBase) {
          totalShortagePieces += (confBase - allocatedPcs);
        }

        const itBox = unitsPerBox > 1 ? Math.floor(allocatedPcs / unitsPerBox) : 0;
        const itLoose = unitsPerBox > 1 ? (allocatedPcs % unitsPerBox) : allocatedPcs;

        itemsPayload.push({
          originOrderId: ord.id,
          originItemId: it.id,
          productId: it.product_id,
          packedPieces: allocatedPcs,
          packedCartons: itBox,
          packedLoose: itLoose,
          unitRate: it.unit_rate || it.rate || it.base_price
        });
      });
    });

    saveLotPackingProgress({
      retailerId: selectedLot.retailerId,
      sourceOrderIds: selectedLot.orderIds,
      items: itemsPayload,
      markAsSealed: true
    }, currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);

    showToast(
      totalShortagePieces > 0
        ? `✅ Packed & Sealed! ${totalShortagePieces} unfulfilled pieces for ${selectedLot.shopName} automatically routed to Pending Orders.`
        : `✅ All ${selectedLot.orders.length} orders for ${selectedLot.shopName} 100% Packed & Sealed! Moved to Packed Items for Billing.`,
      totalShortagePieces > 0 ? 'warn' : 'success'
    );

    // Trigger Screen 3: Completion Confirmation Modal
    setCompletionModalData({
      shopName: selectedLot.shopName,
      route: selectedLot.route,
      totalCartons: selectedLot.totalCartons,
      totalLoose: selectedLot.totalLoose,
      ordersCount: selectedLot.orders.length,
      lot: selectedLot
    });

    setSelectedLot(null);
    setPackerTab('packed_items');
  };

  // Convert RetailerConsolidatedLot to RetailerPackingLot for Biller modal
  const handleOpenBillerInvoice = (lot: RetailerConsolidatedLot) => {
    const packingLotItems: PackingLotItem[] = lot.combinedItems.map(it => {
      const prod = productMap.get(it.productId);
      const unitsPerPack = it.unitsPerBox > 1 ? it.unitsPerBox : 1;
      
      const packedPieces = (typeof it.savedPackedPieces === 'number')
        ? it.savedPackedPieces
        : ((it.totalCartons * unitsPerPack) + it.totalLoose);

      const packedCartons = unitsPerPack > 1
        ? (typeof it.savedPackedCartons === 'number'
            ? it.savedPackedCartons 
            : (it.totalCartons > 0 ? it.totalCartons : Math.floor(packedPieces / unitsPerPack)))
        : 0;

      const packedLoose = unitsPerPack > 1
        ? (typeof it.savedPackedLoose === 'number'
            ? it.savedPackedLoose 
            : (it.totalLoose > 0 ? it.totalLoose : (packedPieces % unitsPerPack)))
        : packedPieces;

      const unitRate = prod?.selling_price || 100;
      const purchaseCost = prod?.purchase_price || (unitRate * 0.85);
      const gstPercent = (prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0;
      const effectiveCartons = unitsPerPack > 1 ? packedCartons + (packedLoose / unitsPerPack) : (packedCartons > 0 ? packedCartons : packedPieces);
      const lineTaxable = effectiveCartons * unitRate;
      const lineGst = lineTaxable * (gstPercent / 100);

      return {
        compositeKey: `${it.barcode || it.productId}__MRP_${Number(it.mrp || 0).toFixed(2)}`,
        productId: it.productId,
        productName: it.productName,
        brand: it.brand,
        sku: it.barcode,
        hsn: prod?.hsn || '1902',
        mrp: it.mrp,
        tradingUnit: prod?.trading_unit || 'Carton',
        baseUnit: prod?.base_unit || 'Piece',
        unitsPerPack,
        orderedPieces: it.totalBaseUnits,
        confirmedPieces: it.confirmedBaseUnits,
        packedPieces,
        packedCartons,
        packedLoose,
        unitRate,
        flatDiscount: prod?.carton_discount || 0,
        purchaseCost,
        marginPct: ((unitRate - purchaseCost) / unitRate) * 100,
        gstPercent,
        lineTaxable,
        lineGst,
        lineTotal: lineTaxable + lineGst,
        availStockPieces: (inventoryStockMap.get(it.productId)?.available) || 0,
        isBackorder: false,
        originOrderNumber: it.sourceBreakdown[0]?.orderNumber || lot.orderNumbers[0],
        originOrderId: it.sourceBreakdown[0]?.orderId || lot.orderIds[0],
        originItemId: it.sourceBreakdown[0]?.orderItemId || 'item-1',
        originTag: 'DIRECT',
        daysPending: 0
      };
    });

    const packingLot: RetailerPackingLot = {
      retailer: lot.retailer || {
        id: lot.retailerId,
        shop_name: lot.shopName,
        owner_name: lot.ownerName,
        city: 'Nagpur',
        phone: lot.mobile,
        state_code: '27',
        active: true
      } as any,
      sourceOrders: lot.orders,
      originBadges: lot.orders.map(o => ({
        orderId: o.id,
        orderNumber: o.order_number,
        source: o.source || 'salesman',
        channelCode: 'SALES',
        channelLabel: 'Salesperson',
        badgeClass: 'bg-amber-100 text-amber-800',
        orderDate: o.order_date,
        totalAmount: o.total_amount
      })),
      items: packingLotItems,
      totalPieces: lot.totalCartons,
      totalPackedPieces: lot.totalCartons,
      taxableSubtotal: 0,
      gstTotal: 0,
      netGrandTotal: 0,
      averageMarginPct: 15,
      currentOutstanding: lot.retailer?.outstanding || 0,
      creditLimit: lot.retailer?.credit_limit || 50000,
      postBillOutstanding: (lot.retailer?.outstanding || 0),
      creditLimitExceeded: false,
      exceededAmount: 0,
      hasBackordersInjected: false
    };

    setSelectedBillerLot(packingLot);
  };

  // Route picklist calculation
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

  // Sorted picklist items based on selected sort filter (By Brand, By Rack/Barcode, or Quantity)
  const sortedPicklistItems = useMemo(() => {
    const items = [...consolidatedPicklist.items];
    if (picklistFilter === 'BY_BRAND') {
      return items.sort((a, b) => a.brand.localeCompare(b.brand));
    }
    if (picklistFilter === 'BY_RACK') {
      return items.sort((a, b) => (a.barcode || '').localeCompare(b.barcode || ''));
    }
    return items; // Default sorted by totalCartons descending
  }, [consolidatedPicklist, picklistFilter]);

  if (!mounted) {
    return (
      <div className="flex-1 flex flex-col min-h-[50vh] items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3 shadow-xs animate-pulse">
          <Boxes className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Loading FMCG Warehouse Cockpit...</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing operational queues</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md md:max-w-4xl mx-auto p-3 md:p-6 space-y-2.5 md:space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`fixed top-16 right-4 left-4 sm:left-auto sm:right-5 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold animate-in slide-in-from-top-3 border ${
          toastMessage.type === 'warn' 
            ? 'bg-amber-900 text-white border-amber-700' 
            : toastMessage.type === 'error'
            ? 'bg-rose-900 text-white border-rose-700'
            : 'bg-slate-900 text-white border-emerald-500/50'
        }`}>
          <span>{toastMessage.text}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. SLIM VIEW & TAB SWITCHER */}
      {/* Terminal Mode Switcher: Compact segmented control */}
      <div className="h-9 p-1 bg-slate-200/80 rounded-lg flex items-center text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTerminalRole('packer')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-7 px-3 rounded-md transition-all cursor-pointer ${
            terminalRole === 'packer'
              ? 'bg-white text-slate-900 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-3.5 h-3.5 text-amber-500" />
          <span>📦 Packer Floor</span>
        </button>

        <button
          type="button"
          onClick={() => setTerminalRole('biller')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-7 px-3 rounded-md transition-all cursor-pointer ${
            terminalRole === 'biller'
              ? 'bg-white text-slate-900 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-indigo-600" />
          <span>🧾 Biller View</span>
        </button>
      </div>

      {/* Lot Status Tabs: Horizontal touch tabs with badge counters */}
      {terminalRole === 'packer' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPackerTab('orders_to_pack')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              packerTab === 'orders_to_pack'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>⏳ Orders to Pack</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              packerTab === 'orders_to_pack' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-700'
            }`}>
              {filteredOrdersToPackLots.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPackerTab('packed_items')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              packerTab === 'packed_items'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>✅ Packed Lots</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              packerTab === 'packed_items' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-100 text-slate-700'
            }`}>
              {filteredPackedLots.length}
            </span>
          </button>
        </div>
      ) : (
        /* Biller Tabs */
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setBillerTab('packed_items')}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
              billerTab === 'packed_items'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <span>Packed ({filteredPackedLots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBillerTab('pending_orders')}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
              billerTab === 'pending_orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <span>Pending ({filteredPendingCards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBillerTab('billing_history')}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
              billerTab === 'billing_history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <span>Invoices ({invoices.length})</span>
          </button>
        </div>
      )}

      {/* 3. COMPACT QUICK-ACTION & SEARCH BAR */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Search shop name or beat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
          />
        </div>

        {terminalRole === 'packer' && (
          <button
            type="button"
            onClick={() => setIsRoutePicklistOpen(true)}
            className="h-10 px-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0 transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            <span>📋 Picklist</span>
          </button>
        )}
      </div>

      {/* MAIN VIEW CONTENT */}

      {/* ========================================================================= */}
      {/* 1. PACKER: ORDERS TO PACK VIEW (MOBILE-FIRST CARDS) */}
      {/* ========================================================================= */}
      {terminalRole === 'packer' && packerTab === 'orders_to_pack' && (
        <div className="space-y-2.5">
          {filteredOrdersToPackLots.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">No Orders Waiting to Pack</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                All confirmed orders have been packed or moved to Pending Orders.
              </p>
            </div>
          ) : (
            filteredOrdersToPackLots.map(lot => (
              <div
                key={lot.retailerId}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs p-3.5 space-y-2.5 transition-all"
              >
                {/* Card Header: Bold Shop Name, Beat pill, and Merged Orders count */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {lot.shopName}
                      </h3>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium shrink-0">
                        {lot.route}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {lot.orders.length} {lot.orders.length === 1 ? 'Order' : 'Orders Merged'} ({lot.orderNumbers.join(', ')})
                    </p>
                  </div>
                </div>

                {/* Metrics Strip: 3-column micro-stats box */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total SKUs</span>
                    <strong className="text-slate-900 font-extrabold text-xs sm:text-sm">{lot.combinedItems.length}</strong>
                  </div>
                  <div className="border-x border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Boxes</span>
                    <strong className="text-slate-900 font-extrabold text-xs sm:text-sm">{lot.totalCartons}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Loose Pcs</span>
                    <strong className="text-slate-900 font-extrabold text-xs sm:text-sm">{lot.totalLoose}</strong>
                  </div>
                </div>

                {/* Primary CTA: Full-width button at card base */}
                <button
                  type="button"
                  onClick={() => handleOpenPackingModal(lot)}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>🚀 Start Packing This Lot</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PACKED ITEMS (BILLABLE QUEUE) VIEW */}
      {/* ========================================================================= */}
      {((terminalRole === 'packer' && packerTab === 'packed_items') || (terminalRole === 'biller' && billerTab === 'packed_items')) && (
        <div className="space-y-2.5">
          {filteredPackedLots.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">No Packed Lots Awaiting Billing</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Packed items ready for invoice generation will appear here once sealed by the Packer.
              </p>
            </div>
          ) : (
            filteredPackedLots.map(lot => (
              <div
                key={lot.retailerId}
                className="bg-white rounded-xl border border-emerald-200 hover:border-emerald-300 shadow-xs p-3.5 space-y-2.5 transition-all"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {lot.shopName}
                      </h3>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium shrink-0">
                        {lot.route}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold shrink-0 flex items-center gap-1 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-700 stroke-[3]" /> Sealed
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {lot.orders.length} {lot.orders.length === 1 ? 'Order' : 'Orders'} ({lot.orderNumbers.join(', ')})
                    </p>
                  </div>
                </div>

                {/* Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Packed SKUs</span>
                    <strong className="text-slate-900 font-extrabold text-xs sm:text-sm">{lot.combinedItems.length}</strong>
                  </div>
                  <div className="border-x border-emerald-200/60">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Boxes</span>
                    <strong className="text-emerald-800 font-extrabold text-xs sm:text-sm">{lot.totalCartons}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Loose Pcs</span>
                    <strong className="text-emerald-800 font-extrabold text-xs sm:text-sm">{lot.totalLoose}</strong>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPackingModal(lot)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Packed Lot</span>
                  </button>

                  {terminalRole === 'biller' && (
                    <button
                      type="button"
                      onClick={() => handleOpenBillerInvoice(lot)}
                      className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Generate GST Invoice</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PENDING ORDERS VIEW (RETAILER-WISE GROUPED CARDS) */}
      {/* ========================================================================= */}
      {((terminalRole === 'packer' && packerTab === 'pending_orders') || (terminalRole === 'biller' && billerTab === 'pending_orders')) && (
        <div className="space-y-5">
          {/* Informational Banner */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Retailer-Wise Pending Hub:</strong> All unfulfilled order quantities are grouped by Retailer into single cards with source order numbers preserved.
                {terminalRole === 'biller' && ' Pending quantities are strictly Non-Billable.'}
              </span>
            </div>
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-amber-300 font-bold rounded-lg shrink-0">
              {filteredPendingCards.length} Retailer Cards
            </span>
          </div>

          {filteredPendingCards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
              <h3 className="text-base font-bold text-slate-700">Zero Pending Shortages</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No orders are currently waiting for backordered stock. All order quantities have been fulfilled.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredPendingCards.map(card => (
                <RetailerPendingCard
                  key={card.retailerId}
                  card={card}
                  mode={terminalRole}
                  onContinuePacking={(c) => setContinuePackingCard(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BILLER: INVOICED / BILLING HISTORY VIEW */}
      {/* ========================================================================= */}
      {terminalRole === 'biller' && billerTab === 'billing_history' && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Receipt className="w-12 h-12 mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-700">No Invoices Generated Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Generated GST invoices will be recorded here with PDF reprint capabilities.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] font-black">
                    <tr>
                      <th className="p-3.5">Invoice #</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Retailer</th>
                      <th className="p-3.5">Orders</th>
                      <th className="p-3.5 text-right">Taxable</th>
                      <th className="p-3.5 text-right">GST</th>
                      <th className="p-3.5 text-right">Grand Total</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {invoices.map(inv => {
                      const ret = retailerMap.get(inv.retailer_id);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-mono font-black text-indigo-700">{inv.invoice_number}</td>
                          <td className="p-3.5 text-slate-500">{formatOrderDateTime(inv.date)}</td>
                          <td className="p-3.5 font-bold text-slate-900">{ret?.shop_name || 'Retailer'}</td>
                          <td className="p-3.5 font-mono text-slate-600">{(inv.source_order_numbers || [inv.order_ref_id]).join(', ')}</td>
                          <td className="p-3.5 font-mono text-right text-slate-700">₹{Number(inv.taxable_value || 0).toFixed(2)}</td>
                          <td className="p-3.5 font-mono text-right text-slate-700">₹{Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0)).toFixed(2)}</td>
                          <td className="p-3.5 font-mono font-black text-right text-slate-900">₹{Number(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewInvoiceModal({
                                  isOpen: true,
                                  invoice: inv,
                                  retailer: ret,
                                  challan: deliveryChallans.find(dc => dc.order_id === inv.order_ref_id)
                                });
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>View Slip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONSOLIDATED PACKING TERMINAL (FOR PACKERS - SCREEN 1) */}
      {/* ========================================================================= */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="max-w-md md:max-w-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl bg-slate-50 flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            {/* Sticky Mobile Header (Top ~54px) */}
            <div className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="text-sm font-bold text-white truncate">
                  {selectedLot.shopName}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  {selectedLot.orders.length} {selectedLot.orders.length === 1 ? 'Order' : 'Orders'} Merged &bull; {selectedLot.combinedItems.length} SKUs &bull; {selectedLot.route}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCheckAllItems}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                >
                  Verify All ✓
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLot(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sticky SKU Progress Strip */}
            {(() => {
              const verifiedCount = Object.values(packedItemsMap).filter(Boolean).length;
              const totalCount = selectedLot.combinedItems.length;
              const progressPct = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;

              return (
                <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0 space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Packing Progress:</span>
                    <span className="font-extrabold text-indigo-600 font-mono">
                      {verifiedCount} / {totalCount} SKUs ({Math.round(progressPct)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Scrollable Mobile SKU Cards (High-Density & Thumb-Friendly) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-28 sm:pb-6">
              {selectedLot.combinedItems.map((item, idx) => {
                const isItemPacked = !!packedItemsMap[item.key];
                
                const invData = inventoryStockMap.get(item.productId) || { physical: 0, reserved: 0, available: 0 };
                const unitsPerBox = item.unitsPerBox > 1 ? item.unitsPerBox : 1;
                const availPcs = invData.available;
                const availBoxes = Math.floor(availPcs / unitsPerBox);
                const availLoose = availPcs % unitsPerBox;

                const orderedTotalPcs = item.totalBaseUnits > 0 
                  ? item.totalBaseUnits 
                  : ((item.totalCartons * unitsPerBox) + item.totalLoose);
                const isLowStock = availPcs < orderedTotalPcs;

                const currentPackedBoxes = packedBoxesMap[item.key] !== undefined ? packedBoxesMap[item.key] : (item.savedPackedCartons ?? item.totalCartons);
                const currentPackedLoose = packedLooseMap[item.key] !== undefined ? packedLooseMap[item.key] : (item.savedPackedLoose ?? item.totalLoose);
                const currentPackedTotalPcs = unitsPerBox > 1 
                  ? (currentPackedBoxes * unitsPerBox) + currentPackedLoose 
                  : (currentPackedBoxes + currentPackedLoose);

                const diffPcs = currentPackedTotalPcs - orderedTotalPcs;
                const isShortage = diffPcs < 0;

                return (
                  <div
                    key={item.key || idx}
                    className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                      isItemPacked 
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                        : isLowStock 
                        ? 'bg-rose-50/20 border-rose-200' 
                        : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
                    }`}
                  >
                    {/* Top row: 32x32px Checkbox + Title + Stock chip */}
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleItemPacked(item.key)}
                        className={`w-8 h-8 min-w-[32px] rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                          isItemPacked 
                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                            : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                        }`}
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <p className={`text-xs sm:text-sm font-bold line-clamp-2 ${isItemPacked ? 'text-emerald-950' : 'text-slate-900'}`}>
                          {item.productName}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <span>Brand: <strong className="text-slate-700">{item.brand}</strong></span>
                          <span>&bull;</span>
                          <span className="font-semibold text-slate-700">MRP: ₹{Number(item.mrp).toFixed(2)}</span>
                          {item.barcode && item.barcode !== '-' && (
                            <>
                              <span>&bull;</span>
                              <span className="font-mono text-slate-400">SKU: {item.barcode}</span>
                            </>
                          )}
                        </div>

                        <div className="pt-0.5">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Stock Avail: {unitsPerBox > 1 ? `${availBoxes} Bx + ` : ''}{availLoose} Pcs ({availPcs} Pcs)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Stock Avail: {unitsPerBox > 1 ? `${availBoxes} Bx + ` : ''}{availLoose} Pcs ({availPcs} Pcs)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stepper Quantity Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      {unitsPerBox > 1 && (
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                            <span>Boxes ({unitsPerBox} pcs/bx)</span>
                            <span className="text-slate-700">Ord: {item.totalCartons}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStepBoxes(item, -1)}
                              className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max={item.totalCartons}
                              value={currentPackedBoxes}
                              onChange={(e) => handlePackedBoxesChange(item, e.target.value)}
                              className="h-9 w-full min-w-0 text-center font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleStepBoxes(item, 1)}
                              className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>{unitsPerBox > 1 ? 'Loose Pieces' : 'Quantity (Pieces)'}</span>
                          <span className="text-slate-700">Ord: {unitsPerBox > 1 ? item.totalLoose : orderedTotalPcs}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepLoose(item, -1)}
                            className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={currentPackedLoose}
                            onChange={(e) => handlePackedLooseChange(item, e.target.value)}
                            className="h-9 w-full min-w-0 text-center font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleStepLoose(item, 1)}
                            className="h-9 w-9 min-w-[36px] bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-800 text-base shadow-2xs cursor-pointer select-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline Feedback & Quick-Fill Row */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div>
                        {isShortage ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold">
                            ⚠️ Short: -{Math.abs(diffPcs)} Pcs
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Exact Match
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetFullOrdered(item)}
                          className="h-7 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Full
                        </button>
                        {isLowStock && (
                          <button
                            type="button"
                            onClick={() => handleSetMaxStock(item, availPcs)}
                            className="h-7 px-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Max Stock
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSetZeroStock(item)}
                          className="h-7 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          0 (OOS)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Mobile Bottom Action Bar */}
            <div className="sticky bottom-0 z-20 p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleSavePackingProgress}
                className="h-12 flex-1 bg-white border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-[0.99]"
              >
                <Save className="w-4 h-4 text-amber-500" />
                <span>Save Progress</span>
              </button>

              <button
                type="button"
                onClick={handleMarkPackedAndSealed}
                className="h-12 flex-[1.5] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Packed &amp; Sealed</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: PACKED & SEALED (COMPLETION CONFIRMATION & LOT LABELS) */}
      {/* ========================================================================= */}
      {completionModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            {/* Animated Success Checkmark */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">Lot Packed &amp; Sealed!</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Packed <strong>{completionModalData.totalCartons} Cartons</strong> + <strong>{completionModalData.totalLoose} Loose Pcs</strong> for <span className="font-bold text-slate-900">{completionModalData.shopName}</span> ({completionModalData.route}).
              </p>
            </div>

            {/* Lot Summary Box */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 font-medium text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Orders Merged:</span>
                <span className="font-mono font-bold text-indigo-700">{completionModalData.lot.orderNumbers.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Verified SKUs:</span>
                <span className="font-bold text-slate-800">{completionModalData.lot.combinedItems.length} SKUs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Status:</span>
                <span className="text-emerald-700 font-bold">Ready for Tax Invoice</span>
              </div>
            </div>

            {/* Action Buttons (Full-Width Touch Rows) */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>🏷️ Print Parcel / Delivery Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletionModalData(null)}
                className="w-full h-11 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Next Packing Lot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONTINUE PACKING PENDING ITEMS MODAL */}
      {/* ========================================================================= */}
      {continuePackingCard && (
        <ContinuePendingPackingModal
          card={continuePackingCard}
          onClose={() => setContinuePackingCard(null)}
          onSuccess={(msg) => {
            showToast(msg, 'success');
            setPackerTab('packed_items');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BILLER GENERATE INVOICE MODAL */}
      {/* ========================================================================= */}
      {selectedBillerLot && (
        <BillerGenerateInvoiceModal
          lot={selectedBillerLot}
          onClose={() => setSelectedBillerLot(null)}
          onInvoiceGenerated={(inv, dc) => {
            showToast(`✅ GST Invoice ${inv.invoice_number} generated for ${selectedBillerLot.retailer.shop_name}!`, 'success');
            setPreviewInvoiceModal({
              isOpen: true,
              invoice: inv,
              challan: dc,
              retailer: selectedBillerLot.retailer
            });
            setSelectedBillerLot(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INVOICE PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewInvoiceModal?.isOpen && previewInvoiceModal.invoice && (
        <InvoicePreviewModal
          isOpen={previewInvoiceModal.isOpen}
          onClose={() => setPreviewInvoiceModal(null)}
          invoice={previewInvoiceModal.invoice}
          challan={previewInvoiceModal.challan}
          retailer={previewInvoiceModal.retailer}
          company={activeCompany}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ROUTE PICKLIST MODAL (SCREEN 2 - MOBILE-FIRST AISLE GATHERING) */}
      {/* ========================================================================= */}
      {isRoutePicklistOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="max-w-md md:max-w-2xl w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl bg-slate-50 flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            {/* Top Sticky Header */}
            <div className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="text-sm font-bold text-white truncate">
                  Aisle Picklist &bull; {selectedRoute === 'ALL' ? 'All Active Beats' : selectedRoute}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {consolidatedPicklist.lotsCount} Retailer Lots &bull; {consolidatedPicklist.ordersCount} Orders &bull; {consolidatedPicklist.items.length} SKUs
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRoutePicklistOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Filter / Sort Strip */}
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sort Order:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setPicklistFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    picklistFilter === 'ALL' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Quantity
                </button>
                <button
                  type="button"
                  onClick={() => setPicklistFilter('BY_BRAND')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    picklistFilter === 'BY_BRAND' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Brand
                </button>
                <button
                  type="button"
                  onClick={() => setPicklistFilter('BY_RACK')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    picklistFilter === 'BY_RACK' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Rack / Bin
                </button>
              </div>
            </div>

            {/* Picklist Item Rows */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 pb-28 sm:pb-4">
              {sortedPicklistItems.map((item, idx) => {
                const itemKey = item.barcode || item.productName;
                const isChecked = !!picklistCheckedMap[itemKey];

                return (
                  <div
                    key={idx}
                    onClick={() => setPicklistCheckedMap(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                      isChecked
                        ? 'bg-slate-100/80 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200 hover:border-amber-400 shadow-2xs'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {item.brand}
                        </span>
                        <p className={`text-xs sm:text-sm font-bold text-slate-900 ${isChecked ? 'line-through text-slate-400' : ''}`}>
                          {item.productName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1 flex-wrap">
                        <span>For: <strong className="text-slate-700">{item.retailerNames.join(', ')}</strong></span>
                        {item.barcode && <span>&bull; SKU: {item.barcode}</span>}
                      </div>

                      {/* Pick Quantity Badge */}
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 font-extrabold text-xs">
                        <span>📦 Take:</span>
                        <span>{item.totalCartons} Boxes {item.totalLoose > 0 ? `+ ${item.totalLoose} Loose` : ''}</span>
                      </div>
                    </div>

                    {/* One-tap round checkbox */}
                    <div className={`w-8 h-8 min-w-[32px] rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      isChecked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-transparent'
                    }`}>
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Bottom Actions */}
            <div className="sticky bottom-0 z-20 p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsRoutePicklistOpen(false)}
                className="h-12 flex-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Back to Orders</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="h-12 flex-[1.5] bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>🖨️ Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
