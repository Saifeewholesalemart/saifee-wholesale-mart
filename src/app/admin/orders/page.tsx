'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Order, Retailer, Product, OrderItem, Invoice, DeliveryChallan,
  formatAutoBoxQuantity, formatProductStockDisplay
} from '@/lib/db';
import { 
  UserRole, can, getCompositeKey, PackingLotItem, 
  RetailerPackingLot, BackorderQueueItem, DeletedItemRecord, OriginBadgeInfo 
} from '@/lib/orderTerminalTypes';
import RecycleBinDrawer from '@/components/orders/RecycleBinDrawer';
import AddItemToLotModal from '@/components/orders/AddItemToLotModal';
import ShortCloseBackorderModal from '@/components/orders/ShortCloseBackorderModal';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import RateIntelligenceModal from '@/components/orders/RateIntelligenceModal';
import SpotOrderModal from '@/components/orders/SpotOrderModal';
import LastBillingRatesModal from '@/components/LastBillingRatesModal';
import { 
  Search, Check, Clock, Package, Truck, Receipt, 
  ChevronRight, ChevronDown, ChevronUp, ArrowRight,
  CheckCircle2, RotateCcw, Sparkles, Combine, MapPin, 
  AlertCircle, TrendingUp, Store, Edit3, X, Trash2,
  FileText, History as HistoryIcon, ShieldCheck, Minus, Plus,
  Printer, UserCheck, ShieldAlert, AlertTriangle, Filter,
  Phone, HelpCircle, Ban, RefreshCw, Layers, Calendar,
  ArrowUpDown, SlidersHorizontal, ChevronLeft, ChevronsLeft,
  ChevronsRight, DollarSign, IndianRupee, Save, BookmarkCheck,
  CheckCheck
} from 'lucide-react';

export type SortOption = 
  | 'DEFAULT'
  | 'ITEMS_DESC' 
  | 'ITEMS_ASC' 
  | 'PIECES_DESC' 
  | 'PIECES_ASC' 
  | 'VALUE_DESC' 
  | 'VALUE_ASC' 
  | 'DATE_ASC' 
  | 'DATE_DESC';

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AdminOrdersContent() {
  const { 
    orders, retailers, products, inventory, companies, invoices, activeCompany,
    dispatchOrder, dispatchRetailerPackingLot, clearAllOrders, currentUser, deleteOrder, 
    addOrderItemToOrder, removeOrderItem, updateOrderItemQuantity,
    confirmOrderQuantities, allocateAndPackOrder, profiles,
    saveLotPackingProgress
  } = useDb();

  const searchParams = useSearchParams();
  const router = useRouter();

  // Mount state for SSR hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Role Permissions Architecture (Default to ROLE_ADMIN so all controls are active)
  const [userRole, setUserRole] = useState<UserRole>('ROLE_ADMIN');

  // 3-Tab Architecture
  const [activeTab, setActiveTab] = useState<'ready_to_pack' | 'partial_pending' | 'completed_history'>('ready_to_pack');

  // Omnibar Search & Comprehensive Multi-Criteria Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [dateFilterPreset, setDateFilterPreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedPackingStatus, setSelectedPackingStatus] = useState<'ALL' | 'READY_TO_PACK' | 'PARTIAL_PACKED' | 'COMPLETED'>('ALL');
  const [selectedValueSlab, setSelectedValueSlab] = useState<'ALL' | 'PETTY' | 'STANDARD' | 'BULK'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DEFAULT');

  // Interactive Table Pagination (Reset on filter/sort change)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Accordion Expand State for Retailer Lots (All expanded by default for warehouse speed)
  const [expandedLots, setExpandedLots] = useState<{ [retailerId: string]: boolean }>({});

  // Inline Edits per Item Key: { [compositeKey_orderId]: { packedPieces?: number; packedCartons?: number; packedLoose?: number; unitRate?: number } }
  const [inlineEdits, setInlineEdits] = useState<{
    [key: string]: { packedPieces?: number; packedCartons?: number; packedLoose?: number; unitRate?: number };
  }>({});

  // Two-Tier Soft Delete Safety Net
  const [deletedRecords, setDeletedRecords] = useState<DeletedItemRecord[]>([]);
  const [undoToast, setUndoToast] = useState<{
    record: DeletedItemRecord;
    countdown: number;
    timerId?: any;
  } | null>(null);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  // Modals State
  const [addItemModal, setAddItemModal] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
    retailerName: string;
  } | null>(null);

  const [shortCloseModal, setShortCloseModal] = useState<{
    isOpen: boolean;
    item: BackorderQueueItem | null;
  } | null>(null);

  const [invoicePreviewModal, setInvoicePreviewModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
    challan?: DeliveryChallan | null;
    retailer?: Retailer | null;
  } | null>(null);

  const [isSpotOrderModalOpen, setIsSpotOrderModalOpen] = useState(false);

  // Sync ?action=counter or ?new_counter=true from URL params
  useEffect(() => {
    if (searchParams.get('action') === 'counter' || searchParams.get('new_counter') === 'true') {
      setIsSpotOrderModalOpen(true);
    }
  }, [searchParams]);

  const [rateIntelligenceModal, setRateIntelligenceModal] = useState<{
    isOpen: boolean;
    retailerId: string;
    retailerName: string;
    retailerCity?: string;
    productId: string;
    productName: string;
    sku: string;
    mrp: number;
    tradingUnit: string;
    baseUnit?: string;
    unitsPerPack: number;
    purchaseCost: number;
    currentUnitRate: number;
    itemEditKey: string;
  } | null>(null);

  // Processing & draft saving state per lot
  const [isPackingLot, setIsPackingLot] = useState<{ [retailerId: string]: boolean }>({});
  const [isSavingLot, setIsSavingLot] = useState<{ [retailerId: string]: boolean }>({});

  // Toast notification for successful draft / progress save
  const [saveSuccessToast, setSaveSuccessToast] = useState<{
    message: string;
    retailerName?: string;
    timestamp?: string;
  } | null>(null);

  // Auto-dismiss saveSuccessToast after 4 seconds
  useEffect(() => {
    if (saveSuccessToast) {
      const timer = setTimeout(() => {
        setSaveSuccessToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessToast]);

  // Unsaved changes confirmation dialog guard
  const [unsavedChangesModal, setUnsavedChangesModal] = useState<{
    isOpen: boolean;
    targetTab?: 'ready_to_pack' | 'partial_pending' | 'completed_history';
    targetAction?: () => void;
  } | null>(null);

  // Helper to check if a specific lot has uncommitted modifications in inlineEdits
  const isLotDirty = (lot: RetailerPackingLot) => {
    return lot.items.some(item => {
      const itemEditKey = `${item.compositeKey}__${item.originOrderId}__${item.originItemId}`;
      return inlineEdits[itemEditKey] !== undefined;
    });
  };

  const hasUnsavedEdits = Object.keys(inlineEdits).length > 0;

  // Browser-level beforeunload guard for unsaved modifications
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedEdits) {
        e.preventDefault();
        e.returnValue = 'You have unsaved packing changes. Would you like to Save Progress before leaving?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEdits]);

  // Tab switcher with dirty changes guard
  const handleTabClick = (targetTab: 'ready_to_pack' | 'partial_pending' | 'completed_history') => {
    if (activeTab === targetTab) return;
    if (activeTab === 'ready_to_pack' && hasUnsavedEdits) {
      setUnsavedChangesModal({
        isOpen: true,
        targetTab
      });
      return;
    }
    setActiveTab(targetTab);
  };

  // Extract distinct retailer cities / areas / beats dynamically from master records
  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    retailers.forEach(r => {
      if (r.beat_name && r.beat_name.trim()) locs.add(r.beat_name.trim());
      if (r.route && r.route.trim()) locs.add(r.route.trim());
      if (r.city && r.city.trim()) locs.add(r.city.trim());
    });
    return Array.from(locs).sort();
  }, [retailers]);

  // Calendar date boundary matching helper
  const isDateMatching = (dateStr?: string) => {
    if (dateFilterPreset === 'ALL') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const iso = d.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    
    if (dateFilterPreset === 'TODAY') {
      return iso === todayIso;
    }
    if (dateFilterPreset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return iso === y.toISOString().slice(0, 10);
    }
    if (dateFilterPreset === 'CUSTOM') {
      if (customFromDate && iso < customFromDate) return false;
      if (customToDate && iso > customToDate) return false;
      return true;
    }
    return true;
  };

  // Check if any non-default filter is currently active
  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== '' ||
      selectedLocation !== 'ALL' ||
      dateFilterPreset !== 'ALL' ||
      customFromDate !== '' ||
      customToDate !== '' ||
      selectedChannel !== 'ALL' ||
      selectedPackingStatus !== 'ALL' ||
      selectedValueSlab !== 'ALL' ||
      sortBy !== 'DEFAULT'
    );
  }, [searchTerm, selectedLocation, dateFilterPreset, customFromDate, customToDate, selectedChannel, selectedPackingStatus, selectedValueSlab, sortBy]);

  // 1-Click Master Reset
  const handleResetAllFilters = () => {
    setSearchTerm('');
    setSelectedLocation('ALL');
    setDateFilterPreset('ALL');
    setCustomFromDate('');
    setCustomToDate('');
    setSelectedChannel('ALL');
    setSelectedPackingStatus('ALL');
    setSelectedValueSlab('ALL');
    setSortBy('DEFAULT');
    setCurrentPage(1);
  };

  // Clickable column header sort toggle
  const toggleSort = (target: 'ITEMS' | 'PIECES' | 'VALUE' | 'DATE') => {
    setSortBy(current => {
      if (target === 'ITEMS') {
        return current === 'ITEMS_DESC' ? 'ITEMS_ASC' : 'ITEMS_DESC';
      }
      if (target === 'PIECES') {
        return current === 'PIECES_DESC' ? 'PIECES_ASC' : 'PIECES_DESC';
      }
      if (target === 'VALUE') {
        return current === 'VALUE_DESC' ? 'VALUE_ASC' : 'VALUE_DESC';
      }
      if (target === 'DATE') {
        return current === 'DATE_DESC' ? 'DATE_ASC' : 'DATE_DESC';
      }
      return 'DEFAULT';
    });
  };

  // Rule 3: Any filter or sort parameter change resets pagination back to Page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm, 
    selectedLocation, 
    dateFilterPreset, 
    customFromDate, 
    customToDate, 
    selectedChannel, 
    selectedPackingStatus, 
    selectedValueSlab, 
    sortBy, 
    activeTab
  ]);

  // Helper to resolve salesperson or creator human-friendly name
  const resolveSalespersonName = (idOrName?: string) => {
    if (!idOrName) return '';
    const sp = profiles?.find(p => p.id === idOrName || p.name === idOrName || p.email === idOrName);
    if (sp) {
      // Strip out role tags like "(Parle Salesperson)" or "(Distributor Sales)" for a clean name
      const cleanName = sp.name
        .replace(/\s*\((Distributor Sales|Parle Salesperson|Britannia Salesperson|HUL Salesperson|Retailer Direct|Dist|Co|Salesperson)\)/gi, '')
        .replace(/\s*\([^)]*sales[^)]*\)/gi, '')
        .trim();
      return cleanName || sp.name;
    }
    return idOrName;
  };

  // Channel helper
  const getChannelBadge = (source?: string, channel?: string, orderNum?: string, createdBy?: string): OriginBadgeInfo => {
    let channelCode = 'CH_COUNTER';
    let channelLabel = 'Counter Spot';
    let badgeClass = 'bg-cyan-50 text-cyan-800 border-cyan-200';

    const spName = resolveSalespersonName(createdBy);

    if (source === 'distributor_salesperson' || channel === 'Distributor Salesperson') {
      channelCode = 'CH_DIST_SALES';
      channelLabel = `Dist Sales${spName ? `: ${spName}` : ''}`;
      badgeClass = 'bg-amber-50 text-amber-900 border-amber-200';
    } else if (source === 'company_salesperson' || channel === 'Company Salesperson') {
      channelCode = 'CH_CO_SALES';
      channelLabel = `Company Rep${spName ? `: ${spName}` : ''}`;
      badgeClass = 'bg-purple-50 text-purple-900 border-purple-200';
    } else if (source === 'retailer_direct' || channel === 'Retailer Direct') {
      channelCode = 'CH_RETAILER_PWA';
      channelLabel = 'Retailer Direct App';
      badgeClass = 'bg-emerald-50 text-emerald-900 border-emerald-200';
    }

    return {
      orderId: '',
      orderNumber: orderNum || '',
      source: source || 'counter_sale',
      channelCode,
      channelLabel,
      badgeClass,
      orderDate: '',
      totalAmount: 0,
      salespersonName: spName
    };
  };

  // ==========================================
  // TAB 1: RETAILER PACKING LOTS CONSOLIDATION
  // ==========================================
  const retailerPackingLots = useMemo<RetailerPackingLot[]>(() => {
    // 1. Group active open orders by Retailer
    const activeOrders = orders.filter(o => {
      const isClosed = o.status === 'Completed' || o.status === 'Delivered' || o.status === 'Cancelled';
      return !isClosed;
    });

    const lotsByRetailer = new Map<string, {
      retailer: Retailer;
      orders: Order[];
    }>();

    activeOrders.forEach(ord => {
      const ret = retailers.find(r => r.id === ord.retailer_id) || ({
        id: ord.retailer_id || 'UNKNOWN',
        retailer_code: 'RET-WALKIN',
        shop_name: 'Walk-in Retailer',
        owner_name: 'Counter Customer',
        address: 'Direct Counter',
        phone: 'N/A',
        mobile: 'N/A',
        city: 'Nagpur',
        state_code: '27',
        outstanding: 0,
        outstanding_balance: 0,
        current_balance: 0,
        credit_limit: 50000,
        active: true
      } as Retailer);

      if (!lotsByRetailer.has(ret.id)) {
        lotsByRetailer.set(ret.id, {
          retailer: ret,
          orders: []
        });
      }
      lotsByRetailer.get(ret.id)!.orders.push(ord);
    });

    const lots: RetailerPackingLot[] = [];

    lotsByRetailer.forEach(({ retailer, orders: sourceOrders }) => {
      // Origin badges for each order in the lot
      const originBadges: OriginBadgeInfo[] = sourceOrders.map(ord => {
        const badge = getChannelBadge(ord.source, ord.channel, ord.order_number, ord.created_by);
        return {
          ...badge,
          orderId: ord.id,
          orderNumber: ord.order_number,
          orderDate: ord.order_date,
          totalAmount: ord.total_amount
        };
      });

      // Composite Key grouping ("MRP IS HERO")
      const lotItemsMap = new Map<string, PackingLotItem>();

      sourceOrders.forEach(ord => {
        (ord.items || []).forEach(it => {
          const prod = products.find(p => p.id === it.product_id);
          const totalOrdered = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
          const fulfilled = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? 0;
          const cancelled = it.cancelled_qty ?? it.cancelled_pieces ?? 0;
          const pendingBase = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, totalOrdered - fulfilled - cancelled);

          // If the item has already been 100% fulfilled in a prior lot, skip it from active packing lot
          if (pendingBase <= 0 && (fulfilled > 0 || ord.status === 'Completed')) {
            return;
          }

          const mrp = it.mrp || it.selected_mrp || prod?.mrp || 0;
          const sku = prod?.sku || 'SKU';
          const compositeKey = getCompositeKey(sku, mrp);
          const itemEditKey = `${compositeKey}__${ord.id}__${it.id}`;

          // Ordered quantity is strictly in pieces
          const orderedPieces = pendingBase;

          // Check if there are staged / saved packed quantities from prior "Save Packing Progress"
          const savedPacked = it.packed_qty !== undefined 
            ? it.packed_qty 
            : (it.packed_pieces !== undefined 
                ? it.packed_pieces 
                : (it.packed_cartons !== undefined ? it.packed_cartons : undefined));
          const defaultPacked = savedPacked !== undefined ? savedPacked : orderedPieces;

          // Check user inline edits
          const userEdit = inlineEdits[itemEditKey];
          const packedPieces = userEdit?.packedPieces !== undefined 
            ? userEdit.packedPieces 
            : (userEdit?.packedCartons !== undefined ? userEdit.packedCartons : defaultPacked);

          const defaultRate = it.rate || it.unit_rate || it.carton_rate || it.base_price || prod?.selling_price || 0;
          const unitRate = userEdit?.unitRate !== undefined ? userEdit.unitRate : defaultRate;

          // Dist cost and live margin (Strictly Rate per piece)
          const purchaseCost = prod?.purchase_price || (defaultRate * 0.88);
          const marginPct = unitRate > 0 && purchaseCost > 0
            ? Math.round(((unitRate - purchaseCost) / unitRate) * 10000) / 100
            : null;

          // Financials: taxable = packed_qty_in_pieces * unit_rate_per_piece
          const gstPercent = prod?.gst_percent || 18;
          const lineTaxable = Math.round(packedPieces * unitRate * 100) / 100;
          const lineGst = Math.round(lineTaxable * (gstPercent / 100) * 100) / 100;
          const lineTotal = lineTaxable + lineGst;

          // Available inventory stock in pieces
          const invItem = inventory.find(i => i.product_id === it.product_id);
          const availStockPieces = invItem?.available_qty || 0;

          // Calculate pendency days
          const orderDate = new Date(ord.order_date || ord.created_at || Date.now()).getTime();
          const daysPending = Math.max(0, Math.floor((Date.now() - orderDate) / (1000 * 60 * 60 * 24)));

          const isBackorder = (it.fulfilled_qty || 0) > 0 && (it.remaining_qty || 0) > 0;

          if (!lotItemsMap.has(itemEditKey)) {
            lotItemsMap.set(itemEditKey, {
              compositeKey,
              productId: it.product_id,
              productName: prod?.name || it.product_id,
              brand: prod?.brand,
              sku,
              hsn: prod?.hsn,
              mrp,
              tradingUnit: 'Piece',
              baseUnit: 'Piece',
              unitsPerPack: 1,
              orderedPieces,
              packedPieces,
              orderedCartons: orderedPieces,
              orderedLoose: 0,
              orderedBaseQty: orderedPieces,
              packedCartons: packedPieces,
              packedLoose: 0,
              packedBaseQty: packedPieces,
              effectivePackedCartons: packedPieces,
              unitRate,
              purchaseCost,
              marginPct,
              gstPercent,
              lineTaxable,
              lineGst,
              lineTotal,
              availStockPieces,
              availStockCartons: availStockPieces,
              isBackorder,
              originOrderNumber: ord.order_number,
              originOrderId: ord.id,
              originItemId: it.id,
              originTag: (it as any).packing_notes || (isBackorder 
                ? `⏳ Pending from ${ord.order_number} (${new Date(ord.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
                : `${ord.order_number}`),
              daysPending
            });
          }
        });
      });

      const items = Array.from(lotItemsMap.values());
      const totalOrderedPieces = items.reduce((sum, i) => sum + (i.orderedPieces ?? i.orderedCartons), 0);
      const totalPackedPieces = items.reduce((sum, i) => sum + (i.packedPieces ?? i.packedCartons), 0);
      const taxableSubtotal = items.reduce((sum, i) => sum + i.lineTaxable, 0);
      const gstTotal = items.reduce((sum, i) => sum + i.lineGst, 0);
      const netGrandTotal = Math.round((taxableSubtotal + gstTotal) * 100) / 100;

      // Calculate weighted average margin
      const validMarginItems = items.filter(i => i.marginPct !== null && i.lineTaxable > 0);
      const totalWeightedMargin = validMarginItems.reduce((sum, i) => sum + (i.marginPct! * i.lineTaxable), 0);
      const averageMarginPct = taxableSubtotal > 0 && validMarginItems.length > 0
        ? Math.round((totalWeightedMargin / taxableSubtotal) * 100) / 100
        : null;

      // Credit health
      const currentOutstanding = retailer.outstanding ?? retailer.outstanding_balance ?? retailer.current_balance ?? 0;
      const creditLimit = retailer.credit_limit || 50000;
      const postBillOutstanding = currentOutstanding + netGrandTotal;
      const creditLimitExceeded = postBillOutstanding > creditLimit;
      const exceededAmount = creditLimitExceeded ? postBillOutstanding - creditLimit : 0;
      const hasBackordersInjected = items.some(i => i.isBackorder);

      lots.push({
        retailer,
        sourceOrders,
        originBadges,
        items,
        totalPieces: totalOrderedPieces,
        totalPackedPieces,
        totalCartons: totalOrderedPieces,
        totalPackedCartons: totalPackedPieces,
        taxableSubtotal,
        gstTotal,
        netGrandTotal,
        averageMarginPct,
        currentOutstanding,
        creditLimit,
        postBillOutstanding,
        creditLimitExceeded,
        exceededAmount,
        hasBackordersInjected
      });
    });

    return lots;
  }, [orders, retailers, products, inventory, inlineEdits]);

  // =========================================================================
  // TAB 1: FILTERED & MULTI-CRITERIA SORTED RETAILER PACKING LOTS
  // =========================================================================
  const filteredAndSortedPackingLots = useMemo(() => {
    let result = retailerPackingLots.filter(lot => {
      // 1. Retailer Location / Beat / Area Filter
      if (selectedLocation !== 'ALL') {
        const retLoc = `${lot.retailer.beat_name || ''} ${lot.retailer.route || ''} ${lot.retailer.city || ''} ${lot.retailer.address || ''}`.toLowerCase();
        if (!retLoc.includes(selectedLocation.toLowerCase())) return false;
      }

      // 2. Date Filter (matches if any source order falls within calendar boundary)
      if (dateFilterPreset !== 'ALL') {
        const matchesDate = lot.sourceOrders.some(o => isDateMatching(o.order_date || o.created_at));
        if (!matchesDate) return false;
      }

      // 3. Ingestion Channel Filter (All 4 channels: Dist Sales, Retailer PWA, Counter Spot, Company Rep)
      if (selectedChannel !== 'ALL') {
        const matchesChannel = lot.sourceOrders.some(o => {
          if (selectedChannel === 'distributor_salesperson' || selectedChannel === 'CH_DIST_SALES') {
            return o.source === 'distributor_salesperson' || (o.channel as any) === 'Distributor Salesperson';
          }
          if (selectedChannel === 'retailer_direct' || selectedChannel === 'CH_RETAILER_PWA') {
            return o.source === 'retailer_direct' || (o.channel as any) === 'Retailer Direct';
          }
          if (selectedChannel === 'counter_sale' || selectedChannel === 'CH_COUNTER') {
            return o.source === 'counter_sale' || (o.channel as any) === 'On Counter Sale' || (o.channel as any) === 'Counter Spot';
          }
          if (selectedChannel === 'company_salesperson' || selectedChannel === 'CH_CO_SALES') {
            return o.source === 'company_salesperson' || (o.channel as any) === 'Company Salesperson';
          }
          return false;
        });
        if (!matchesChannel) return false;
      }

      // 4. Packing Status Filter
      if (selectedPackingStatus === 'READY_TO_PACK') {
        if (lot.hasBackordersInjected) return false;
      } else if (selectedPackingStatus === 'PARTIAL_PACKED') {
        if (!lot.hasBackordersInjected) return false;
      } else if (selectedPackingStatus === 'COMPLETED') {
        return false;
      }

      // 5. Order Value Slab Filter
      if (selectedValueSlab !== 'ALL') {
        const val = lot.netGrandTotal;
        if (selectedValueSlab === 'PETTY' && val >= 2000) return false;
        if (selectedValueSlab === 'STANDARD' && (val < 2000 || val > 10000)) return false;
        if (selectedValueSlab === 'BULK' && val <= 10000) return false;
      }

      // 6. Omnibar Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesRetailer = lot.retailer.shop_name.toLowerCase().includes(term) ||
          (lot.retailer.owner_name && lot.retailer.owner_name.toLowerCase().includes(term)) ||
          (lot.retailer.mobile && lot.retailer.mobile.includes(term)) ||
          (lot.retailer.phone && lot.retailer.phone.includes(term)) ||
          (lot.retailer.beat_name && lot.retailer.beat_name.toLowerCase().includes(term)) ||
          (lot.retailer.city && lot.retailer.city.toLowerCase().includes(term));

        const matchesOrder = lot.sourceOrders.some(o => o.order_number.toLowerCase().includes(term));
        const matchesSalesperson = lot.originBadges.some(b => b.channelLabel.toLowerCase().includes(term) || (b.salespersonName && b.salespersonName.toLowerCase().includes(term)));
        const matchesProduct = lot.items.some(i => 
          i.productName.toLowerCase().includes(term) || 
          i.sku.toLowerCase().includes(term)
        );

        return matchesRetailer || matchesOrder || matchesSalesperson || matchesProduct;
      }

      return true;
    });

    // Multi-Criteria Sorting Engine
    switch (sortBy) {
      case 'ITEMS_DESC':
        return [...result].sort((a, b) => b.items.length - a.items.length);
      case 'ITEMS_ASC':
        return [...result].sort((a, b) => a.items.length - b.items.length);
      case 'PIECES_DESC':
        return [...result].sort((a, b) => (b.totalPieces ?? b.totalCartons ?? 0) - (a.totalPieces ?? a.totalCartons ?? 0));
      case 'PIECES_ASC':
        return [...result].sort((a, b) => (a.totalPieces ?? a.totalCartons ?? 0) - (b.totalPieces ?? b.totalCartons ?? 0));
      case 'VALUE_DESC':
        return [...result].sort((a, b) => b.netGrandTotal - a.netGrandTotal);
      case 'VALUE_ASC':
        return [...result].sort((a, b) => a.netGrandTotal - b.netGrandTotal);
      case 'DATE_ASC': // Oldest First (FIFO Priority Dispatch)
        return [...result].sort((a, b) => {
          const dateA = Math.min(...a.sourceOrders.map(o => new Date(o.order_date || o.created_at || 0).getTime()));
          const dateB = Math.min(...b.sourceOrders.map(o => new Date(o.order_date || o.created_at || 0).getTime()));
          return dateA - dateB;
        });
      case 'DATE_DESC': // Newest First
        return [...result].sort((a, b) => {
          const dateA = Math.max(...a.sourceOrders.map(o => new Date(o.order_date || o.created_at || 0).getTime()));
          const dateB = Math.max(...b.sourceOrders.map(o => new Date(o.order_date || o.created_at || 0).getTime()));
          return dateB - dateA;
        });
      default:
        return result;
    }
  }, [retailerPackingLots, selectedLocation, dateFilterPreset, customFromDate, customToDate, selectedChannel, selectedPackingStatus, selectedValueSlab, searchTerm, sortBy]);

  // Order count metrics across filtered lots
  const totalFilteredOrdersCount = useMemo(() => {
    return filteredAndSortedPackingLots.reduce((acc, lot) => acc + lot.sourceOrders.length, 0);
  }, [filteredAndSortedPackingLots]);
  
  const masterTotalOrdersCount = useMemo(() => {
    return retailerPackingLots.reduce((acc, lot) => acc + lot.sourceOrders.length, 0);
  }, [retailerPackingLots]);

  // Paginated lots for Tab 1
  const totalPackingLotsCount = filteredAndSortedPackingLots.length;
  const totalPackingPages = Math.max(1, Math.ceil(totalPackingLotsCount / (pageSize === -1 ? 999999 : pageSize)));
  const validPackingPage = Math.min(currentPage, totalPackingPages);
  
  const pagedPackingLots = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedPackingLots;
    const start = (validPackingPage - 1) * pageSize;
    return filteredAndSortedPackingLots.slice(start, start + pageSize);
  }, [filteredAndSortedPackingLots, validPackingPage, pageSize]);

  // ==========================================
  // TAB 2: PARTIAL PENDING QUEUE (BACKORDER HUB)
  // ==========================================
  const backorderQueueItems = useMemo<BackorderQueueItem[]>(() => {
    const queue: BackorderQueueItem[] = [];

    orders.forEach(ord => {
      if (ord.status === 'Cancelled') return;

      const ret = retailers.find(r => r.id === ord.retailer_id);
      const retName = ret?.shop_name || 'Retailer';
      const retCity = ret?.city || 'Nagpur';
      const retBeat = ret?.beat_name || ret?.route;
      const retPhone = ret?.phone || ret?.mobile;

      (ord.items || []).forEach(it => {
        const prod = products.find(p => p.id === it.product_id);
        const totalOrdered = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
        const fulfilled = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? 0;
        const cancelled = it.cancelled_qty ?? it.cancelled_pieces ?? 0;
        const pendingBase = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, totalOrdered - fulfilled - cancelled);

        const isShortageOrPartial = pendingBase > 0 && (
          fulfilled > 0 || 
          ord.status === 'Partially Confirmed' || 
          ord.status === 'Partially Fulfilled' || 
          ord.status === 'Partially Dispatched' ||
          it.status === 'PARTIALLY_FULFILLED' ||
          it.status === 'WAITING_STOCK'
        );

        if (isShortageOrPartial) {
          const mrp = it.mrp || it.selected_mrp || prod?.mrp || 0;
          const lockedUnitRate = it.rate || it.unit_rate || it.order_time_rate || it.manual_billing_rate || it.base_price || prod?.selling_price || 0;

          const invItem = inventory.find(i => i.product_id === it.product_id);
          const availStockPieces = invItem?.available_qty || 0;

          const orderDateTs = new Date(ord.order_date || ord.created_at || Date.now()).getTime();
          const daysPending = Math.max(0, Math.floor((Date.now() - orderDateTs) / (1000 * 60 * 60 * 24)));

          queue.push({
            orderId: ord.id,
            orderNumber: ord.order_number,
            orderDate: ord.order_date,
            retailerId: ord.retailer_id,
            retailerName: retName,
            retailerCity: retCity,
            retailerBeat: retBeat,
            retailerPhone: retPhone,
            itemId: it.id,
            productId: it.product_id,
            productName: prod?.name || it.product_name || it.product_id,
            sku: prod?.sku || 'SKU',
            mrp,
            unitsPerPack: 1,
            tradingUnit: 'Piece',
            baseUnit: 'Piece',
            orderedPieces: totalOrdered,
            fulfilledPieces: fulfilled,
            pendingPieces: pendingBase,
            orderedCartons: totalOrdered,
            orderedLoose: 0,
            fulfilledCartons: fulfilled,
            fulfilledLoose: 0,
            pendingCartons: pendingBase,
            pendingLoose: 0,
            lockedUnitRate,
            daysPending,
            availStockPieces,
            availStockCartons: availStockPieces,
            lastInvoiceNumber: ord.invoice_id,
            compositeKey: getCompositeKey(prod?.sku || 'SKU', mrp)
          });
        }
      });
    });

    return queue;
  }, [orders, retailers, products, inventory]);

  const filteredAndSortedBackorders = useMemo(() => {
    let result = backorderQueueItems.filter(bo => {
      // 1. Retailer Location
      if (selectedLocation !== 'ALL') {
        const ret = retailers.find(r => r.id === bo.retailerId);
        const loc = `${bo.retailerBeat || ''} ${bo.retailerCity || ''} ${ret?.address || ''}`.toLowerCase();
        if (!loc.includes(selectedLocation.toLowerCase())) return false;
      }

      // 2. Date
      if (dateFilterPreset !== 'ALL') {
        if (!isDateMatching(bo.orderDate)) return false;
      }

      // 3. Channel
      if (selectedChannel !== 'ALL') {
        const matchOrd = orders.find(o => o.id === bo.orderId);
        if (matchOrd) {
          if (selectedChannel === 'distributor_salesperson' || selectedChannel === 'CH_DIST_SALES') {
            if (matchOrd.source !== 'distributor_salesperson' && (matchOrd.channel as any) !== 'Distributor Salesperson') return false;
          } else if (selectedChannel === 'retailer_direct' || selectedChannel === 'CH_RETAILER_PWA') {
            if (matchOrd.source !== 'retailer_direct' && (matchOrd.channel as any) !== 'Retailer Direct') return false;
          } else if (selectedChannel === 'counter_sale' || selectedChannel === 'CH_COUNTER') {
            if (matchOrd.source !== 'counter_sale' && (matchOrd.channel as any) !== 'On Counter Sale' && (matchOrd.channel as any) !== 'Counter Spot') return false;
          } else if (selectedChannel === 'company_salesperson' || selectedChannel === 'CH_CO_SALES') {
            if (matchOrd.source !== 'company_salesperson' && (matchOrd.channel as any) !== 'Company Salesperson') return false;
          }
        }
      }

      // 4. Status filter
      if (selectedPackingStatus === 'COMPLETED') return false;

      // 5. Value Slab
      if (selectedValueSlab !== 'ALL') {
        const val = bo.pendingPieces * bo.lockedUnitRate;
        if (selectedValueSlab === 'PETTY' && val >= 2000) return false;
        if (selectedValueSlab === 'STANDARD' && (val < 2000 || val > 10000)) return false;
        if (selectedValueSlab === 'BULK' && val <= 10000) return false;
      }

      // 6. Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          bo.retailerName.toLowerCase().includes(term) ||
          bo.orderNumber.toLowerCase().includes(term) ||
          bo.productName.toLowerCase().includes(term) ||
          bo.sku.toLowerCase().includes(term) ||
          bo.retailerCity.toLowerCase().includes(term) ||
          (bo.retailerBeat && bo.retailerBeat.toLowerCase().includes(term))
        );
      }

      return true;
    });

    // Sorting
    switch (sortBy) {
      case 'PIECES_DESC':
        return [...result].sort((a, b) => b.pendingPieces - a.pendingPieces);
      case 'PIECES_ASC':
        return [...result].sort((a, b) => a.pendingPieces - b.pendingPieces);
      case 'VALUE_DESC':
        return [...result].sort((a, b) => (b.pendingPieces * b.lockedUnitRate) - (a.pendingPieces * a.lockedUnitRate));
      case 'VALUE_ASC':
        return [...result].sort((a, b) => (a.pendingPieces * a.lockedUnitRate) - (b.pendingPieces * b.lockedUnitRate));
      case 'DATE_ASC':
        return [...result].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
      case 'DATE_DESC':
        return [...result].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      default:
        return result;
    }
  }, [backorderQueueItems, selectedLocation, dateFilterPreset, customFromDate, customToDate, selectedChannel, selectedPackingStatus, selectedValueSlab, searchTerm, sortBy, orders, retailers]);

  const totalBackordersCount = filteredAndSortedBackorders.length;
  const totalBackorderPages = Math.max(1, Math.ceil(totalBackordersCount / (pageSize === -1 ? 999999 : pageSize)));
  const validBackorderPage = Math.min(currentPage, totalBackorderPages);

  const pagedBackorders = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedBackorders;
    const start = (validBackorderPage - 1) * pageSize;
    return filteredAndSortedBackorders.slice(start, start + pageSize);
  }, [filteredAndSortedBackorders, validBackorderPage, pageSize]);

  // ==========================================
  // TAB 3: COMPLETED & DISPATCHED HISTORY
  // ==========================================
  const completedInvoicesList = useMemo(() => {
    const list = invoices.map(inv => {
      const ret = retailers.find(r => r.id === inv.retailer_id);
      return {
        ...inv,
        retailerName: ret?.shop_name || 'Retailer Customer',
        retailerBeat: ret?.beat_name || ret?.route || ret?.city || 'Nagpur',
        retailerPhone: ret?.phone || ret?.mobile
      };
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, retailers]);

  const filteredAndSortedInvoices = useMemo(() => {
    let result = completedInvoicesList.filter(inv => {
      // 1. Location
      if (selectedLocation !== 'ALL') {
        const loc = `${inv.retailerBeat || ''} ${inv.retailerName || ''}`.toLowerCase();
        if (!loc.includes(selectedLocation.toLowerCase())) return false;
      }

      // 2. Date
      if (dateFilterPreset !== 'ALL') {
        if (!isDateMatching(inv.date || (inv as any).created_at)) return false;
      }

      // 3. Status filter
      if (selectedPackingStatus === 'READY_TO_PACK' || selectedPackingStatus === 'PARTIAL_PACKED') {
        return false;
      }

      // 4. Value Slab
      if (selectedValueSlab !== 'ALL') {
        const val = inv.grand_total || 0;
        if (selectedValueSlab === 'PETTY' && val >= 2000) return false;
        if (selectedValueSlab === 'STANDARD' && (val < 2000 || val > 10000)) return false;
        if (selectedValueSlab === 'BULK' && val <= 10000) return false;
      }

      // 5. Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          inv.invoice_number.toLowerCase().includes(term) ||
          inv.retailerName.toLowerCase().includes(term) ||
          (inv.source_order_numbers && inv.source_order_numbers.some(o => o.toLowerCase().includes(term)))
        );
      }

      return true;
    });

    // Sorting
    switch (sortBy) {
      case 'ITEMS_DESC':
        return [...result].sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0));
      case 'ITEMS_ASC':
        return [...result].sort((a, b) => (a.items?.length || 0) - (b.items?.length || 0));
      case 'VALUE_DESC':
        return [...result].sort((a, b) => (b.grand_total || 0) - (a.grand_total || 0));
      case 'VALUE_ASC':
        return [...result].sort((a, b) => (a.grand_total || 0) - (b.grand_total || 0));
      case 'DATE_ASC':
        return [...result].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'DATE_DESC':
        return [...result].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      default:
        return result;
    }
  }, [completedInvoicesList, selectedLocation, dateFilterPreset, customFromDate, customToDate, selectedPackingStatus, selectedValueSlab, searchTerm, sortBy]);

  const totalInvoicesCount = filteredAndSortedInvoices.length;
  const totalInvoicePages = Math.max(1, Math.ceil(totalInvoicesCount / (pageSize === -1 ? 999999 : pageSize)));
  const validInvoicePage = Math.min(currentPage, totalInvoicePages);

  const pagedInvoices = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedInvoices;
    const start = (validInvoicePage - 1) * pageSize;
    return filteredAndSortedInvoices.slice(start, start + pageSize);
  }, [filteredAndSortedInvoices, validInvoicePage, pageSize]);

  // ==========================================
  // INLINE OPERATIONAL FREEDOM HANDLERS (PIECES & PIECE RATES)
  // ==========================================

  const handlePackedPiecesChange = (itemEditKey: string, val: number) => {
    if (!can(userRole, 'EDIT_PACKED_QTY')) return;
    setInlineEdits(prev => ({
      ...prev,
      [itemEditKey]: {
        ...prev[itemEditKey],
        packedPieces: Math.max(0, val),
        packedCartons: Math.max(0, val)
      }
    }));
  };

  const handlePackedCartonsChange = handlePackedPiecesChange;
  const handlePackedLooseChange = (_itemEditKey: string, _val: number) => {};
  const handlePackedQtyChange = handlePackedPiecesChange;

  const handleUnitRateChange = (itemEditKey: string, val: number) => {
    if (!can(userRole, 'EDIT_RATES')) return;
    setInlineEdits(prev => ({
      ...prev,
      [itemEditKey]: {
        ...prev[itemEditKey],
        unitRate: Math.max(0, val)
      }
    }));
  };

  // Soft-delete line item with two-tier recovery
  const handleRemoveLineItem = (lot: RetailerPackingLot, item: PackingLotItem) => {
    if (!can(userRole, 'REMOVE_ITEM')) return;

    const record: DeletedItemRecord = {
      id: `del-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'ITEM',
      deletedAt: new Date().toISOString(),
      deletedBy: userRole.replace('ROLE_', ''),
      retailerId: lot.retailer.id,
      retailerName: lot.retailer.shop_name,
      orderId: item.originOrderId,
      orderNumber: item.originOrderNumber,
      itemId: item.originItemId,
      productName: item.productName,
      sku: item.sku,
      mrp: item.mrp,
      pieceQty: item.packedPieces ?? item.packedCartons,
      cartonQty: item.packedPieces ?? item.packedCartons,
      unitRate: item.unitRate
    };

    // 1. Remove from database
    removeOrderItem(item.originOrderId, item.originItemId);

    // 2. Add to Tier 2 Recycle Bin
    setDeletedRecords(prev => [record, ...prev]);

    // 3. Trigger Tier 1 Floating 8-Second Undo Toast
    if (undoToast?.timerId) clearTimeout(undoToast.timerId);

    const timerId = setTimeout(() => {
      setUndoToast(null);
    }, 8000);

    setUndoToast({
      record,
      countdown: 8,
      timerId
    });
  };

  // Soft-delete entire lot / order
  const handleDeleteEntireLot = (lot: RetailerPackingLot) => {
    if (!can(userRole, 'DELETE_LOT')) return;
    if (!window.confirm(`Are you sure you want to cancel and remove all ${lot.sourceOrders.length} orders for ${lot.retailer.shop_name}?`)) {
      return;
    }

    lot.sourceOrders.forEach(ord => {
      const record: DeletedItemRecord = {
        id: `del-lot-${Date.now()}-${ord.id}`,
        type: 'LOT_ORDER',
        deletedAt: new Date().toISOString(),
        deletedBy: userRole.replace('ROLE_', ''),
        retailerId: lot.retailer.id,
        retailerName: lot.retailer.shop_name,
        orderId: ord.id,
        orderNumber: ord.order_number,
        productName: `Full Lot Order (${ord.items?.length || 0} items)`,
        pieceQty: lot.totalPackedPieces ?? lot.totalPackedCartons,
        cartonQty: lot.totalPackedPieces ?? lot.totalPackedCartons,
        unitRate: lot.taxableSubtotal
      };

      setDeletedRecords(prev => [record, ...prev]);
      deleteOrder(ord.id);
    });

    const summaryRecord: DeletedItemRecord = {
      id: `del-lot-summary-${Date.now()}`,
      type: 'LOT_ORDER',
      deletedAt: new Date().toISOString(),
      deletedBy: userRole.replace('ROLE_', ''),
      retailerId: lot.retailer.id,
      retailerName: lot.retailer.shop_name,
      orderId: lot.sourceOrders[0]?.id || '',
      orderNumber: lot.sourceOrders.map(o => o.order_number).join(', '),
      productName: `Retailer Lot (${lot.items.length} items)`,
      pieceQty: lot.totalPackedPieces ?? lot.totalPackedCartons,
      cartonQty: lot.totalPackedPieces ?? lot.totalPackedCartons,
      unitRate: lot.netGrandTotal
    };

    if (undoToast?.timerId) clearTimeout(undoToast.timerId);

    const timerId = setTimeout(() => {
      setUndoToast(null);
    }, 8000);

    setUndoToast({
      record: summaryRecord,
      countdown: 8,
      timerId
    });
  };

  // Restore action from Tier 1 Toast or Tier 2 Drawer
  const handleRestoreDeleted = (record: DeletedItemRecord) => {
    if (record.type === 'ITEM' && record.orderId && record.rawItemData) {
      addOrderItemToOrder(record.orderId, {
        productId: record.rawItemData.product_id,
        selectedMrp: record.mrp,
        pieceQty: record.pieceQty ?? record.cartonQty ?? 0,
        cartonQty: record.pieceQty ?? record.cartonQty ?? 0,
        unitRate: record.unitRate,
        notes: 'Restored from Recycle Bin'
      });
    }

    // Remove from deleted records
    setDeletedRecords(prev => prev.filter(r => r.id !== record.id));
    if (undoToast?.record.id === record.id) {
      if (undoToast.timerId) clearTimeout(undoToast.timerId);
      setUndoToast(null);
    }
  };

  // ==========================================
  // SAVE PACKING PROGRESS (DRAFT PERSISTENCE)
  // ==========================================
  const handleSavePackingProgress = async (lot: RetailerPackingLot) => {
    setIsSavingLot(prev => ({ ...prev, [lot.retailer.id]: true }));

    try {
      const res = saveLotPackingProgress({
        retailerId: lot.retailer.id,
        sourceOrderIds: lot.sourceOrders.map(o => o.id),
        items: lot.items.map(item => ({
          originOrderId: item.originOrderId,
          originItemId: item.originItemId,
          productId: item.productId,
          packedPieces: item.packedPieces ?? item.packedCartons ?? 0,
          packedCartons: item.packedPieces ?? item.packedCartons ?? 0,
          packedLoose: 0,
          unitRate: item.unitRate,
          notes: item.originTag
        }))
      }, currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);

      // Clear inline edits for this lot since values are now safely stored in the database
      setInlineEdits(prev => {
        const next = { ...prev };
        lot.items.forEach(it => {
          const itemEditKey = `${it.compositeKey}__${it.originOrderId}__${it.originItemId}`;
          delete next[itemEditKey];
        });
        return next;
      });

      setIsSavingLot(prev => ({ ...prev, [lot.retailer.id]: false }));

      // Clean success toast
      setSaveSuccessToast({
        message: 'Packing progress saved successfully. Bill remains open for editing.',
        retailerName: lot.retailer.shop_name,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } catch (err: any) {
      setIsSavingLot(prev => ({ ...prev, [lot.retailer.id]: false }));
      alert(`Failed to save packing progress: ${err?.message || 'Unexpected error'}`);
    }
  };

  const handleSaveAllDirtyLots = () => {
    const dirtyLots = retailerPackingLots.filter(isLotDirty);
    dirtyLots.forEach(lot => {
      handleSavePackingProgress(lot);
    });
  };

  // ==========================================
  // 1-CLICK DISPATCH & GST INVOICE GENERATOR
  // ==========================================
  const handleMarkPackedAndGenerateInvoice = async (lot: RetailerPackingLot) => {
    if (!can(userRole, 'GENERATE_INVOICE')) {
      alert('Your current role does not have permission to generate invoices.');
      return;
    }

    if (lot.items.length === 0) {
      alert('Cannot generate invoice for an empty lot.');
      return;
    }

    const totalPackedUnits = lot.items.reduce((sum, it) => sum + (it.packedPieces ?? it.packedCartons ?? 0), 0);
    if (totalPackedUnits <= 0) {
      alert('Please enter at least 1 packed piece quantity to generate a bill.');
      return;
    }

    setIsPackingLot(prev => ({ ...prev, [lot.retailer.id]: true }));

    try {
      // 1. Dispatch all orders in the lot into EXACTLY ONE consolidated GST Tax Invoice
      // Atomic dispatch calculates fulfilled quantities and leftover backorders strictly in pieces
      const res = dispatchRetailerPackingLot({
        retailerId: lot.retailer.id,
        sourceOrderIds: lot.sourceOrders.map(o => o.id),
        items: lot.items.map(item => ({
          originOrderId: item.originOrderId,
          originItemId: item.originItemId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          mrp: item.mrp,
          unitsPerPack: 1,
          tradingUnit: 'Piece',
          baseUnit: 'Piece',
          orderedPieces: item.orderedPieces ?? item.orderedCartons,
          packedPieces: item.packedPieces ?? item.packedCartons,
          orderedCartons: item.orderedPieces ?? item.orderedCartons,
          orderedLoose: 0,
          packedCartons: item.packedPieces ?? item.packedCartons,
          packedLoose: 0,
          unitRate: item.unitRate,
          purchaseCost: item.purchaseCost,
          hsn: item.hsn
        }))
      }, {
        transportMode: 'Direct Delivery Van',
        notes: `Packed & Billed from Terminal Lot. Merged Orders: ${lot.sourceOrders.map(o => o.order_number).join(', ')}`,
        generateChallan: true
      });

      // Clear inlineEdits for this lot so fresh state is loaded
      setInlineEdits(prev => {
        const next = { ...prev };
        lot.items.forEach(it => {
          const itemEditKey = `${it.compositeKey}__${it.originOrderId}__${it.originItemId}`;
          delete next[itemEditKey];
        });
        return next;
      });

      setIsPackingLot(prev => ({ ...prev, [lot.retailer.id]: false }));

      if (res?.invoice) {
        // Open Invoice Preview & Print Modal
        setInvoicePreviewModal({
          isOpen: true,
          invoice: res.invoice,
          challan: res.challan || null,
          retailer: lot.retailer
        });
      }
    } catch (err: any) {
      setIsPackingLot(prev => ({ ...prev, [lot.retailer.id]: false }));
      alert(`Failed to pack & generate invoice: ${err?.message || 'Unexpected error'}`);
    }
  };

  // Fulfill remaining backorder directly from Tab 2
  const handleFulfillBackorderNow = (item: BackorderQueueItem) => {
    const res = dispatchOrder(item.orderId, {
      generateChallan: true,
      notes: `Backorder fulfillment for ${item.productName}`
    });

    if (res?.invoice) {
      const ret = retailers.find(r => r.id === item.retailerId);
      setInvoicePreviewModal({
        isOpen: true,
        invoice: res.invoice,
        challan: res.challan,
        retailer: ret
      });
    }
  };

  if (!mounted) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 font-mono tracking-wider">LOADING PACKING TERMINAL...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      
      {/* ========================================================================= */}
      {/* 1. TOP TERMINAL CONTROL HEADER (CLEAN LIGHT THEME & NATURAL SCROLL) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Terminal Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Package className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  FMCG Warehouse Floor Terminal
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated Retailer Packing Lots &bull; Hero MRP Multi-Variant Engine
              </p>
            </div>
          </div>

          {/* Role Switcher & Header Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            
            {/* Role Permission Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Role:</span>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className="bg-transparent font-extrabold text-indigo-900 focus:outline-none cursor-pointer"
              >
                <option value="ROLE_ADMIN">Admin (Full Overrides)</option>
                <option value="ROLE_PACKER">Packer (Floor Count Only)</option>
                <option value="ROLE_BILLER">Biller (Rates &amp; Invoices)</option>
                <option value="ROLE_DISPATCHER">Dispatcher (Challans)</option>
              </select>
            </div>

            {/* Recycle Bin Drawer Trigger (Tier 2 Safety Net) */}
            <button
              type="button"
              onClick={() => setIsRecycleBinOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                deletedRecords.length > 0
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="View recently deleted lines and lots"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Recently Deleted</span>
              {deletedRecords.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-900">
                  {deletedRecords.length}
                </span>
              )}
            </button>

            {/* Quick Counter Sale Shortcut */}
            <button
              type="button"
              onClick={() => setIsSpotOrderModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>+ Spot Sale</span>
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* COMPREHENSIVE ORDER REGISTER FILTER & SORT ENGINE (STICKY CONTROL BAR) */}
        {/* ========================================================================= */}
        <div className="space-y-3 pt-1">
          
          {/* Filter Row 1: Search, Location / Beat, Channel, Value Slab, Sort By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            
            {/* A. Universal Omnibar Search */}
            <div className="sm:col-span-2 lg:col-span-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Retailer, Order #, SKU, Phone..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* B. Retailer City / Area / Beat Filter */}
            <div className="sm:col-span-1 lg:col-span-2 relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full pl-8 pr-6 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer appearance-none truncate"
                title="Filter by Retailer City / Area / Beat"
              >
                <option value="ALL">📍 All Locations (Default)</option>
                {availableLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
            </div>

            {/* C. Order Ingestion Channel Filter */}
            <div className="sm:col-span-1 lg:col-span-2 relative">
              <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full pl-8 pr-6 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer appearance-none truncate"
                title="Filter by Order Ingestion Channel"
              >
                <option value="ALL">🌐 All Channels (Default)</option>
                <option value="CH_DIST_SALES">Distributor Salesman App</option>
                <option value="CH_RETAILER_PWA">Retailer Self-Ordering PWA</option>
                <option value="CH_COUNTER">Counter Direct / Spot Orders</option>
                <option value="CH_CO_SALES">Company / Direct Sales</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
            </div>

            {/* D. Order Value Slab Filter */}
            <div className="sm:col-span-1 lg:col-span-2 relative">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedValueSlab}
                onChange={(e) => setSelectedValueSlab(e.target.value as 'ALL' | 'PETTY' | 'STANDARD' | 'BULK')}
                className="w-full pl-8 pr-6 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer appearance-none truncate"
                title="Filter by Total Order Value Slab"
              >
                <option value="ALL">💰 All Values (Default)</option>
                <option value="PETTY">Petty Orders (&lt; ₹2,000)</option>
                <option value="STANDARD">Standard Orders (₹2k - ₹10k)</option>
                <option value="BULK">Bulk / Wholesale (&gt; ₹10,000)</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
            </div>

            {/* E. Sort Criteria Dropdown */}
            <div className="sm:col-span-1 lg:col-span-3 relative">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full pl-8 pr-6 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs font-extrabold text-indigo-950 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer appearance-none truncate"
                title="Sort Orders & Lots"
              >
                <option value="DATE_ASC">⏱️ Oldest First (FIFO Priority)</option>
                <option value="DATE_DESC">⏱️ Newest First</option>
                <option value="ITEMS_DESC">📦 Line Items: High to Low</option>
                <option value="ITEMS_ASC">📦 Line Items: Low to High</option>
                <option value="PIECES_DESC">🔢 Total Pieces: High to Low</option>
                <option value="PIECES_ASC">🔢 Total Pieces: Low to High</option>
                <option value="VALUE_DESC">💵 Value: High to Low (₹)</option>
                <option value="VALUE_ASC">💵 Value: Low to High (₹)</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 text-[10px]">▼</div>
            </div>

          </div>

          {/* Filter Row 2: Date Filter Presets + Inline Custom Date Range & Packing Status Lifecycle Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            
            {/* Date Window Presets & Inline Custom Picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date:</span>
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                {(['ALL', 'TODAY', 'YESTERDAY', 'CUSTOM'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDateFilterPreset(preset);
                      if (preset !== 'CUSTOM') {
                        setCustomFromDate('');
                        setCustomToDate('');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateFilterPreset === preset
                        ? 'bg-white text-indigo-900 shadow-xs ring-1 ring-slate-200/80 font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset === 'ALL' && 'All Dates'}
                    {preset === 'TODAY' && 'Today'}
                    {preset === 'YESTERDAY' && 'Yesterday'}
                    {preset === 'CUSTOM' && 'Custom Range'}
                  </button>
                ))}
              </div>

              {/* Inline Custom Date Inputs when Custom Range is active */}
              {dateFilterPreset === 'CUSTOM' && (
                <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                    placeholder="From Date"
                    title="From Date"
                  />
                  <span className="text-slate-400 text-xs font-bold">to</span>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                    placeholder="To Date"
                    title="To Date"
                  />
                </div>
              )}
            </div>

            {/* Packing Status Lifecycle Segmented Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Lifecycle:</span>
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                {[
                  { id: 'ALL', label: 'All Statuses' },
                  { id: 'READY_TO_PACK', label: 'Ready to Pack' },
                  { id: 'PARTIAL_PACKED', label: 'Partially Packed' },
                  { id: 'COMPLETED', label: 'Dispatched / Invoiced' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedPackingStatus(st.id as 'ALL' | 'READY_TO_PACK' | 'PARTIAL_PACKED' | 'COMPLETED');
                      if (st.id === 'READY_TO_PACK') handleTabClick('ready_to_pack');
                      else if (st.id === 'PARTIAL_PACKED') handleTabClick('partial_pending');
                      else if (st.id === 'COMPLETED') handleTabClick('completed_history');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedPackingStatus === st.id
                        ? 'bg-white text-indigo-900 shadow-xs ring-1 ring-slate-200/80 font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Filter Row 3: Live Active Counter Badge + Active Filter Chips + Reset All Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
            
            {/* Dynamic Counter Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 font-extrabold text-indigo-950 font-mono">
                {activeTab === 'ready_to_pack' && `Showing ${filteredAndSortedPackingLots.length} of ${retailerPackingLots.length} Lots (${totalFilteredOrdersCount} of ${masterTotalOrdersCount} Orders)`}
                {activeTab === 'partial_pending' && `Showing ${filteredAndSortedBackorders.length} of ${backorderQueueItems.length} Backorders`}
                {activeTab === 'completed_history' && `Showing ${filteredAndSortedInvoices.length} of ${completedInvoicesList.length} Dispatched Invoices`}
              </span>

              {/* Active Filter Chips */}
              {selectedLocation !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200">
                  <span>Loc: {selectedLocation}</span>
                  <button type="button" onClick={() => setSelectedLocation('ALL')} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}

              {selectedChannel !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200">
                  <span>Channel: {selectedChannel.replace('CH_', '')}</span>
                  <button type="button" onClick={() => setSelectedChannel('ALL')} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}

              {selectedValueSlab !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200">
                  <span>Slab: {selectedValueSlab}</span>
                  <button type="button" onClick={() => setSelectedValueSlab('ALL')} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}

              {dateFilterPreset !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200">
                  <span>Date: {dateFilterPreset}{dateFilterPreset === 'CUSTOM' && customFromDate ? ` (${customFromDate})` : ''}</span>
                  <button type="button" onClick={() => { setDateFilterPreset('ALL'); setCustomFromDate(''); setCustomToDate(''); }} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}

              {selectedPackingStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200">
                  <span>Status: {selectedPackingStatus}</span>
                  <button type="button" onClick={() => setSelectedPackingStatus('ALL')} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              )}
            </div>

            {/* Prominent Reset All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-xl text-xs font-extrabold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto shrink-0"
                title="Clear all active filters and search terms"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>✕ Reset All Filters</span>
              </button>
            )}

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. 3-TAB NAVIGATION BAR (LIGHT THEME) */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between overflow-x-auto gap-2 py-1">
        
        <div className="flex items-center gap-2">
          {/* Tab 1: Ready to Pack */}
          <button
            onClick={() => handleTabClick('ready_to_pack')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ready_to_pack'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>📦 Ready to Pack (Active Lots)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'ready_to_pack' ? 'bg-white text-indigo-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {filteredAndSortedPackingLots.length}
            </span>
          </button>

          {/* Tab 2: Partial Pending Queue */}
          <button
            onClick={() => handleTabClick('partial_pending')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'partial_pending'
                ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-500'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>⏳ Partial Pending Hub</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'partial_pending' ? 'bg-white text-amber-950' : 'bg-amber-100 text-amber-900'
            }`}>
              {filteredAndSortedBackorders.length}
            </span>
          </button>

          {/* Tab 3: Completed & Dispatched History */}
          <button
            onClick={() => handleTabClick('completed_history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'completed_history'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>✅ Completed &amp; Dispatched Log</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'completed_history' ? 'bg-white text-emerald-950' : 'bg-slate-100 text-slate-700'
            }`}>
              {filteredAndSortedInvoices.length}
            </span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
          <span>Operating Mode: <strong className="text-slate-900 font-bold">{userRole}</strong></span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN TERMINAL WORKSPACE */}
      {/* ========================================================================= */}
      <div>
        
        {/* ======================================================================= */}
        {/* TAB 1: 📦 READY TO PACK (ACTIVE RETAILER PACKING LOTS) */}
        {/* ======================================================================= */}
        {activeTab === 'ready_to_pack' && (
          <div className="space-y-6">
            
            {filteredAndSortedPackingLots.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                  hasActiveFilters 
                    ? 'bg-amber-50 border border-amber-100 text-amber-600' 
                    : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                }`}>
                  {hasActiveFilters ? <Filter className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {hasActiveFilters ? 'No Packing Lots Match Active Filters' : 'All Retailer Packing Lots Are Clear!'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {hasActiveFilters 
                    ? 'Try adjusting your location, ingestion channel, value slab, date range, or search keywords to view matching packing queues.' 
                    : 'There are no pending unfulfilled orders in the packing queue. New orders booked by field reps, company salesmen, counter, or retailer PWA will appear here automatically.'}
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={handleResetAllFilters}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset All Filters</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSpotOrderModalOpen(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Counter Spot Order</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              pagedPackingLots.map(lot => {
                const isExpanded = expandedLots[lot.retailer.id] !== false;
                const isProcessing = isPackingLot[lot.retailer.id];

                return (
                  <div 
                    key={lot.retailer.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-slate-300"
                  >
                    
                    {/* Retailer Lot Header & Commercial Health Summary */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/30 border-b border-slate-200">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        
                        {/* Retailer Info & Route */}
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedLots(prev => ({ ...prev, [lot.retailer.id]: !isExpanded }))}
                            className="mt-1 p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-base sm:text-lg font-black text-slate-900">
                                {lot.retailer.shop_name}
                              </h2>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {lot.items.length} {lot.items.length === 1 ? 'Line Item' : 'Line Items'}
                              </span>
                              {lot.sourceOrders.some(o => o.status === 'PACKING_IN_PROGRESS' || o.status === 'Packing') && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <BookmarkCheck className="w-3 h-3 text-blue-600" />
                                  <span>Draft / Packing In Progress</span>
                                </span>
                              )}
                              {isLotDirty(lot) && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  <span>Unsaved Edits</span>
                                </span>
                              )}
                              {lot.hasBackordersInjected && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Backorder Injected</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                              <span>Owner: <strong className="text-slate-800">{lot.retailer.owner_name || 'N/A'}</strong></span>
                              <span>&bull;</span>
                              <span>Ph: <strong className="text-slate-800 font-mono">{lot.retailer.mobile || lot.retailer.phone || 'N/A'}</strong></span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1 text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Route: {lot.retailer.beat_name || lot.retailer.route || lot.retailer.city || 'Nagpur'}</span>
                              </span>
                            </div>

                            {/* Origin Badges of Ingested Orders */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Merged Orders:</span>
                              {lot.originBadges.map(b => (
                                <span
                                  key={b.orderNumber}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${b.badgeClass}`}
                                >
                                  {b.channelLabel} &bull; <strong className="font-mono">{b.orderNumber}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Commercial Context Strip: Ledger Balance & Credit Health */}
                        <div className="flex items-center gap-3 flex-wrap lg:justify-end">
                          
                          {/* Outstanding Ledger Card */}
                          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-right">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                              Ledger Outstanding
                            </span>
                            <span className="text-sm font-black text-rose-600 font-mono">
                              {formatINR(lot.currentOutstanding)}
                            </span>
                          </div>

                          {/* Credit Limit & Post-Bill Health */}
                          <div className={`px-3.5 py-2 rounded-xl border text-right ${
                            lot.creditLimitExceeded 
                              ? 'bg-rose-50 border-rose-200' 
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                              Credit Limit (₹{lot.creditLimit.toLocaleString('en-IN')})
                            </span>
                            <span className={`text-xs font-black font-mono ${
                              lot.creditLimitExceeded ? 'text-rose-700' : 'text-emerald-700'
                            }`}>
                              {lot.creditLimitExceeded 
                                ? `⚠️ Exceeded by ${formatINR(lot.exceededAmount)}` 
                                : `🟢 Post-Bill: ${formatINR(lot.postBillOutstanding)}`}
                            </span>
                          </div>

                          {/* Quick Add Item Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              setAddItemModal({
                                isOpen: true,
                                orderId: lot.sourceOrders[0]?.id || '',
                                orderNumber: lot.sourceOrders[0]?.order_number || '',
                                retailerName: lot.retailer.shop_name
                              });
                            }}
                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Add phone booking or spot item to this lot"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>+ Add Item</span>
                          </button>

                          {/* Delete Entire Lot */}
                          <button
                            type="button"
                            onClick={() => handleDeleteEntireLot(lot)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            title="Cancel and remove entire lot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>

                      </div>
                    </div>

                    {/* Packing Lot Table - Full Inline Operational Freedom */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[900px]">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="p-3 w-10 text-center">#</th>
                              <th className="p-3">Product Name &amp; SKU</th>
                              <th className="p-3 text-center">Printed MRP</th>
                              <th className="p-3 text-center">Stock (Pcs)</th>
                              <th className="p-3 text-center">ORDERED (PCS)</th>
                              <th className="p-3 text-center min-w-[140px]">PACKED QTY (PCS)</th>
                              <th className="p-3 text-right w-28">Purchase Rate (₹/Pc)</th>
                              <th className="p-3 text-right w-32">RATE / PIECE (₹)</th>
                              <th className="p-3 text-center w-28">Dist Margin %</th>
                              <th className="p-3 text-right">Taxable (₹)</th>
                              <th className="p-3 text-right">Line Total (₹)</th>
                              <th className="p-3 text-center w-12">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lot.items.map((item, idx) => {
                              const prod = products.find(p => p.id === item.productId);
                              const itemEditKey = `${item.compositeKey}__${item.originOrderId}__${item.originItemId}`;
                              const isBackorderRow = item.isBackorder;
                              const availStock = item.availStockPieces ?? item.availStockCartons ?? 0;
                              const packedVal = item.packedPieces ?? item.packedCartons ?? 0;
                              const orderedVal = item.orderedPieces ?? item.orderedCartons ?? 0;
                              const autoBox = formatAutoBoxQuantity(orderedVal, prod);

                              return (
                                <tr 
                                  key={itemEditKey}
                                  className={`transition-colors ${
                                    isBackorderRow 
                                      ? 'bg-amber-50/60 hover:bg-amber-50/90' 
                                      : 'hover:bg-slate-50/80'
                                  }`}
                                >
                                  {/* Row Index */}
                                  <td className="p-3 text-center text-slate-400 font-mono">
                                    {idx + 1}
                                  </td>

                                  {/* Product Name & Brand */}
                                  <td className="p-3 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-slate-900 text-xs">
                                        {item.productName}
                                      </span>
                                      {item.brand && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                          {item.brand}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                      <span>SKU: <strong className="font-mono text-slate-700">{item.sku}</strong></span>
                                      <span>&bull;</span>
                                      <span className="text-indigo-600 font-mono">{item.originTag}</span>
                                    </div>
                                  </td>

                                  {/* Master Commodity Principle: "MRP IS HERO" */}
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono inline-block">
                                      MRP ₹{item.mrp.toFixed(2)}
                                    </span>
                                  </td>

                                  {/* Godown Stock Status */}
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      availStock >= packedVal 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : availStock > 0 
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {availStock > 0 ? `🟢 ${formatProductStockDisplay(availStock, prod, true)}` : '🔴 0 Pcs'}
                                    </span>
                                  </td>

                                  {/* Ordered Qty (Pieces / Auto-Box) */}
                                  <td className="p-3 text-center font-bold text-slate-700 font-mono">
                                    <div className="flex flex-col items-center">
                                      <span className="font-extrabold text-slate-900">{autoBox.displayOrdered}</span>
                                      {!autoBox.isPieceOnly && autoBox.packSize > 1 && (
                                        <span className="text-[9px] text-slate-400 font-normal font-sans">
                                          ({autoBox.packSize} Pcs/Box)
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Single Numeric Packed Qty Input (Pieces) */}
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        disabled={!can(userRole, 'EDIT_PACKED_QTY')}
                                        value={item.packedPieces ?? item.packedCartons}
                                        onChange={(e) => handlePackedPiecesChange(itemEditKey, parseInt(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-black text-center text-slate-900 focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:opacity-50 disabled:bg-slate-50"
                                        title="Packed Quantity in Pieces"
                                      />
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">Pcs</span>
                                    </div>
                                  </td>

                                  {/* Purchase Rate (₹/Piece) */}
                                  <td className="p-3 text-right">
                                    <span className="font-mono font-bold text-slate-600 text-xs">
                                      ₹{Number(item.purchaseCost || 0).toFixed(2)}
                                    </span>
                                  </td>

                                  {/* RATE / PIECE (₹) with Rate Intelligence Trigger */}
                                  <td className="p-3 text-right">
                                    <div className="relative inline-flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRateIntelligenceModal({
                                            isOpen: true,
                                            retailerId: lot.retailer.id,
                                            retailerName: lot.retailer.shop_name,
                                            retailerCity: lot.retailer.city,
                                            productId: item.productId,
                                            productName: item.productName,
                                            sku: item.sku,
                                            mrp: item.mrp,
                                            tradingUnit: 'Piece',
                                            baseUnit: 'Piece',
                                            unitsPerPack: 1,
                                            purchaseCost: item.purchaseCost,
                                            currentUnitRate: item.unitRate,
                                            itemEditKey
                                          });
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                        title="Rate Intelligence: View last 5 billed rates for this retailer"
                                      >
                                        <Clock className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="text-slate-400 text-[11px] font-bold">₹</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        disabled={!can(userRole, 'EDIT_RATES')}
                                        value={item.unitRate}
                                        onChange={(e) => handleUnitRateChange(itemEditKey, parseFloat(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-right text-indigo-700 focus:border-indigo-500 focus:outline-none disabled:opacity-60 disabled:bg-slate-50"
                                      />
                                    </div>
                                  </td>

                                  {/* Live Margin Indicator: ((unitRate - purchaseCost) / unitRate) * 100 */}
                                  <td className="p-3 text-center">
                                    {item.marginPct !== null ? (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5 ${
                                        item.marginPct >= 10 
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                          : item.marginPct > 0 
                                            ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                                      }`}>
                                        <TrendingUp className="w-2.5 h-2.5" />
                                        <span>{item.marginPct >= 0 ? `+${item.marginPct.toFixed(1)}%` : `${item.marginPct.toFixed(1)}%`}</span>
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">N/A</span>
                                    )}
                                  </td>

                                  {/* Line Taxable Amount: packed_qty_in_pieces * unit_rate_per_piece */}
                                  <td className="p-3 text-right font-mono font-bold text-slate-700">
                                    {formatINR(item.lineTaxable)}
                                  </td>

                                  {/* Line Total (with GST) */}
                                  <td className="p-3 text-right font-mono font-black text-slate-900">
                                    {formatINR(item.lineTotal)}
                                  </td>

                                  {/* Remove Line Action */}
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      disabled={!can(userRole, 'REMOVE_ITEM')}
                                      onClick={() => handleRemoveLineItem(lot, item)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Remove line item from packing lot"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>

                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Lot Financial Summary Strip & 1-Click Invoice CTA */}
                    <div className="p-4 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      
                      {/* Left Side: Summary Metrics */}
                      <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Packed Volume:</span>
                          <span className="font-extrabold text-slate-900 font-mono">
                            {lot.totalPackedPieces ?? lot.totalPackedCartons} Pcs
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Taxable Subtotal:</span>
                          <span className="font-bold text-slate-700 font-mono">
                            {formatINR(lot.taxableSubtotal)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Total GST:</span>
                          <span className="font-bold text-slate-700 font-mono">
                            +{formatINR(lot.gstTotal)}
                          </span>
                        </div>

                        {lot.averageMarginPct !== null && (
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Avg Margin:</span>
                            <span className="font-extrabold text-emerald-700 font-mono">
                              +{lot.averageMarginPct.toFixed(2)}%
                            </span>
                          </div>
                        )}

                        <div className="pl-2 border-l border-slate-300">
                          <span className="text-[10px] text-slate-500 font-bold uppercase block">Net Lot Total:</span>
                          <span className="text-base font-black text-indigo-900 font-mono">
                            {formatINR(lot.netGrandTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Right Side: DUAL ACTION BUTTON BAR */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto justify-end">
                        {/* Button 1: [ 💾 Save Packing Progress ] (Secondary / Outline Button) */}
                        <button
                          type="button"
                          disabled={isSavingLot[lot.retailer.id] || isProcessing}
                          onClick={() => handleSavePackingProgress(lot)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                            isLotDirty(lot)
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200/60'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                          title="Save modified quantities and notes as a draft without generating tax bill"
                        >
                          {isSavingLot[lot.retailer.id] ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                              <span>Saving Progress...</span>
                            </>
                          ) : (
                            <>
                              <Save className={`w-3.5 h-3.5 ${isLotDirty(lot) ? 'text-amber-600' : 'text-slate-600'}`} />
                              <span>💾 Save Packing Progress</span>
                              {isLotDirty(lot) && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved edits in this lot" />
                              )}
                            </>
                          )}
                        </button>

                        {/* Button 2: [ 🧾 Complete & Generate Invoice ] (Primary Action Button) */}
                        <button
                          type="button"
                          disabled={isProcessing || isSavingLot[lot.retailer.id] || (lot.totalPackedPieces ?? lot.totalPackedCartons ?? 0) <= 0 || !can(userRole, 'GENERATE_INVOICE')}
                          onClick={() => handleMarkPackedAndGenerateInvoice(lot)}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white rounded-xl text-xs font-black shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Finalize packing, create GST invoice, deduct stock, and update ledger"
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Finalizing 1 GST Invoice...</span>
                            </>
                          ) : (
                            <>
                              <Receipt className="w-4 h-4 stroke-[2.5]" />
                              <span>🧾 Complete &amp; Generate Invoice</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })
            )}
            {totalPackingPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <span>
                    Showing <strong className="text-slate-900 font-bold font-mono">{(validPackingPage - 1) * (pageSize === -1 ? totalPackingLotsCount : pageSize) + 1}</strong> to <strong className="text-slate-900 font-bold font-mono">{Math.min(validPackingPage * (pageSize === -1 ? totalPackingLotsCount : pageSize), totalPackingLotsCount)}</strong> of <strong className="text-slate-900 font-bold font-mono">{totalPackingLotsCount}</strong> Lots
                  </span>
                  <span className="hidden sm:inline">&bull;</span>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span>Lots per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(parseInt(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={-1}>All</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={validPackingPage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 font-black text-indigo-900 font-mono">
                    Page {validPackingPage} of {totalPackingPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPackingPages, p + 1))}
                    disabled={validPackingPage >= totalPackingPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 2: ⏳ PARTIAL PENDING QUEUE (BACKORDER HUB) */}
        {/* ======================================================================= */}
        {activeTab === 'partial_pending' && (
          <div className="space-y-4">
            
            {/* Zero Phantom Ledger Guarantee Banner */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3 text-xs">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-extrabold text-amber-900">
                  Zero Phantom Ledger Balance &bull; Strict Dispatched-Only Billing
                </h4>
                <p className="text-amber-800 leading-relaxed">
                  Retailers are <strong>ONLY billed for physically packed and dispatched crates</strong>. All unresolved balance quantities below carry <strong>₹0.00 ledger debit</strong> until confirmed stock arrives and an invoice is generated.
                </p>
              </div>
            </div>

            {filteredAndSortedBackorders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                  hasActiveFilters 
                    ? 'bg-amber-50 border border-amber-100 text-amber-600' 
                    : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                }`}>
                  {hasActiveFilters ? <Filter className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {hasActiveFilters ? 'No Backorders Match Active Filters' : 'Zero Pending Backorders!'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Try clearing active location, channel, value, or search filters to find backorders.'
                    : 'All customer orders have either been 100% fulfilled or short-closed with an audit trail.'}
                </p>
                {hasActiveFilters && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetAllFilters}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[950px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3.5">Product &amp; SKU</th>
                          <th className="p-3.5 text-center">Printed MRP</th>
                          <th className="p-3.5">Retailer Customer</th>
                          <th className="p-3.5 text-center">ORDERED (PCS)</th>
                          <th className="p-3.5 text-center">FULFILLED (PCS)</th>
                          <th 
                            onClick={() => toggleSort('PIECES')}
                            className="p-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            title="Click to sort by Pending Pieces"
                          >
                            <div className="inline-flex items-center gap-1">
                              <span>PENDING (PCS)</span>
                              <ArrowUpDown className={`w-3 h-3 ${sortBy === 'PIECES_DESC' || sortBy === 'PIECES_ASC' ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                          </th>
                          <th 
                            onClick={() => toggleSort('VALUE')}
                            className="p-3.5 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            title="Click to sort by Locked Unit Rate"
                          >
                            <div className="inline-flex items-center justify-end gap-1">
                              <span>LOCKED RATE (₹/Pc)</span>
                              <ArrowUpDown className={`w-3 h-3 ${sortBy === 'VALUE_DESC' || sortBy === 'VALUE_ASC' ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                          </th>
                          <th 
                            onClick={() => toggleSort('DATE')}
                            className="p-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            title="Click to sort by FIFO Pendency / Age"
                          >
                            <div className="inline-flex items-center gap-1">
                              <span>Pendency</span>
                              <ArrowUpDown className={`w-3 h-3 ${sortBy === 'DATE_ASC' || sortBy === 'DATE_DESC' ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                          </th>
                          <th className="p-3.5 text-center">Godown Stock</th>
                          <th className="p-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedBackorders.map(bo => {
                          const boProd = products.find(p => p.id === bo.productId);
                          const boOrdered = bo.orderedPieces ?? bo.orderedCartons ?? 0;
                          const boFulfilled = bo.fulfilledPieces ?? bo.fulfilledCartons ?? 0;
                          const boPending = bo.pendingPieces ?? bo.pendingCartons ?? 0;
                          const boAvail = bo.availStockPieces ?? bo.availStockCartons ?? 0;

                          return (
                          <tr key={`${bo.orderId}-${bo.itemId}`} className="hover:bg-slate-50/80 transition-colors">
                            
                            {/* Product & SKU */}
                            <td className="p-3.5 space-y-0.5">
                              <span className="font-extrabold text-slate-900 text-xs block">{bo.productName}</span>
                              <div className="text-[10px] text-slate-500">
                                <span>SKU: <strong className="font-mono text-slate-700">{bo.sku}</strong></span>
                              </div>
                            </td>

                            {/* MRP */}
                            <td className="p-3.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono">
                                MRP ₹{bo.mrp}
                              </span>
                            </td>

                            {/* Retailer */}
                            <td className="p-3.5 space-y-0.5">
                              <span className="font-bold text-slate-800 block">{bo.retailerName}</span>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <span>{bo.retailerBeat || bo.retailerCity}</span>
                                <span>&bull;</span>
                                <span className="font-mono text-indigo-700">{bo.orderNumber}</span>
                              </div>
                            </td>

                            {/* Ordered Qty (Pieces / Auto-Box) */}
                            <td className="p-3.5 text-center font-bold text-slate-600 font-mono">
                              {formatAutoBoxQuantity(boOrdered, boProd).displayOrdered}
                            </td>

                            {/* Fulfilled So Far (Pieces / Auto-Box) */}
                            <td className="p-3.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                                {formatAutoBoxQuantity(boFulfilled, boProd).displayOrdered}
                              </span>
                            </td>

                            {/* Still Pending Qty (Pieces / Auto-Box) */}
                            <td className="p-3.5 text-center">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                                {formatAutoBoxQuantity(boPending, boProd).displayOrdered}
                              </span>
                            </td>

                            {/* Locked Rate (₹/Pc) */}
                            <td className="p-3.5 text-right font-mono font-bold text-indigo-700">
                              ₹{bo.lockedUnitRate.toFixed(2)}/Pc
                            </td>

                            {/* Pendency Days */}
                            <td className="p-3.5 text-center font-mono text-[11px]">
                              <span className={`px-2 py-0.5 rounded font-black ${
                                bo.daysPending > 3 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {bo.daysPending} {bo.daysPending === 1 ? 'day' : 'days'}
                              </span>
                            </td>

                            {/* Godown Stock Status */}
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                boAvail >= boPending 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}>
                                {boAvail > 0 ? `🟢 ${formatProductStockDisplay(boAvail, boProd, true)} Stock` : '🔴 0 Pcs Stock'}
                              </span>
                            </td>

                            {/* Action Buttons */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Fulfill Remaining Now */}
                                <button
                                  type="button"
                                  disabled={!can(userRole, 'GENERATE_INVOICE')}
                                  onClick={() => handleFulfillBackorderNow(bo)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Fulfill remaining quantity now & generate standalone tax invoice"
                                >
                                  <Package className="w-3 h-3" />
                                  <span>Fulfill &amp; Bill</span>
                                </button>

                                {/* Short-Close */}
                                <button
                                  type="button"
                                  disabled={!can(userRole, 'SHORT_CLOSE_BACKORDER')}
                                  onClick={() => setShortCloseModal({ isOpen: true, item: bo })}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Cancel remaining balance with audit reason"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>Short-Close</span>
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls for Tab 2 */}
                {totalBackorderPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <span>
                        Showing <strong className="text-slate-900 font-bold font-mono">{(validBackorderPage - 1) * (pageSize === -1 ? totalBackordersCount : pageSize) + 1}</strong> to <strong className="text-slate-900 font-bold font-mono">{Math.min(validBackorderPage * (pageSize === -1 ? totalBackordersCount : pageSize), totalBackordersCount)}</strong> of <strong className="text-slate-900 font-bold font-mono">{totalBackordersCount}</strong> Backorders
                      </span>
                      <span className="hidden sm:inline">&bull;</span>
                      <div className="hidden sm:flex items-center gap-1.5">
                        <span>Rows per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(parseInt(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={-1}>All</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={validBackorderPage <= 1}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <span className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 font-black text-indigo-900 font-mono">
                        Page {validBackorderPage} of {totalBackorderPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.min(totalBackorderPages, p + 1))}
                        disabled={validBackorderPage >= totalBackorderPages}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 3: ✅ COMPLETED & DISPATCHED HISTORY LOG */}
        {/* ======================================================================= */}
        {activeTab === 'completed_history' && (
          <div className="space-y-4">
            
            {filteredAndSortedInvoices.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                  hasActiveFilters 
                    ? 'bg-amber-50 border border-amber-100 text-amber-600' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {hasActiveFilters ? <Filter className="w-8 h-8" /> : <Receipt className="w-8 h-8" />}
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {hasActiveFilters ? 'No Completed Invoices Match Active Filters' : 'No Completed Invoices Found'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Try clearing active location, channel, value, or date filters to view invoices.'
                    : 'Once packing lots are packed and dispatched, tax invoices will be permanently recorded here for reprint.'}
                </p>
                {hasActiveFilters && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetAllFilters}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[900px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3.5">Invoice #</th>
                          <th 
                            onClick={() => toggleSort('DATE')}
                            className="p-3.5 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            title="Click to sort by Date"
                          >
                            <div className="inline-flex items-center gap-1">
                              <span>Date</span>
                              <ArrowUpDown className={`w-3 h-3 ${sortBy === 'DATE_DESC' || sortBy === 'DATE_ASC' ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                          </th>
                          <th className="p-3.5">Retailer Customer</th>
                          <th className="p-3.5">Merged Orders</th>
                          <th 
                            onClick={() => toggleSort('ITEMS')}
                            className="p-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            title="Click to sort by Item Count"
                          >
                            <div className="inline-flex items-center gap-1">
                              <span>Items</span>
                              <ArrowUpDown className={`w-3 h-3 ${sortBy === 'ITEMS_DESC' || sortBy === 'ITEMS_ASC' ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                          </th>
                          <th className="p-3.5 text-right">Taxable</th>
                          <th className="p-3.5 text-right">GST</th>
                          <th 
                            onClick={() => toggleSort('VALUE')}
                            className="p-3.5 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                            title="Click to sort by Invoice Total"
                          >
                            <div className="inline-flex items-center justify-end gap-1">
                              <span>Invoice Total</span>
                              <ArrowUpDown className={`w-3 h-3 ${sortBy === 'VALUE_DESC' || sortBy === 'VALUE_ASC' ? 'text-indigo-600 font-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                            </div>
                          </th>
                          <th className="p-3.5 text-center">Payment</th>
                          <th className="p-3.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedInvoices.map(inv => {
                          const ret = retailers.find(r => r.id === inv.retailer_id);
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                              
                              {/* Invoice # */}
                              <td className="p-3.5">
                                <span className="font-mono font-black text-indigo-900 text-xs block">
                                  {inv.invoice_number}
                                </span>
                                <span className="text-[10px] text-slate-400">GST Tax Invoice</span>
                              </td>

                              {/* Date */}
                              <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                                {new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>

                              {/* Retailer */}
                              <td className="p-3.5 space-y-0.5">
                                <span className="font-extrabold text-slate-900 text-xs block">{inv.retailerName}</span>
                                <span className="text-[10px] text-slate-500">{inv.retailerBeat}</span>
                              </td>

                              {/* Merged Source Orders */}
                              <td className="p-3.5 font-mono text-[11px] text-indigo-600">
                                {inv.source_order_numbers?.join(', ') || inv.order_ref_id || 'Direct'}
                              </td>

                              {/* Items count */}
                              <td className="p-3.5 text-center font-bold text-slate-700 font-mono">
                                {inv.items?.length || 0}
                              </td>

                              {/* Taxable */}
                              <td className="p-3.5 text-right font-mono text-slate-700">
                                {formatINR(inv.taxable_value)}
                              </td>

                              {/* GST */}
                              <td className="p-3.5 text-right font-mono text-slate-500">
                                +{formatINR((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0))}
                              </td>

                              {/* Grand Total */}
                              <td className="p-3.5 text-right font-mono font-black text-slate-900 text-sm">
                                {formatINR(inv.grand_total)}
                              </td>

                              {/* Payment Status */}
                              <td className="p-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  inv.payment_status === 'Paid' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : inv.payment_status === 'Partial' 
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {inv.payment_status || 'Unpaid'}
                                </span>
                              </td>

                              {/* Print / View Modal Trigger */}
                              <td className="p-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInvoicePreviewModal({
                                     isOpen: true,
                                     invoice: inv,
                                     retailer: ret
                                    });
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Print / View</span>
                                </button>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls for Tab 3 */}
                {totalInvoicePages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                      <span>
                        Showing <strong className="text-slate-900 font-bold font-mono">{(validInvoicePage - 1) * (pageSize === -1 ? totalInvoicesCount : pageSize) + 1}</strong> to <strong className="text-slate-900 font-bold font-mono">{Math.min(validInvoicePage * (pageSize === -1 ? totalInvoicesCount : pageSize), totalInvoicesCount)}</strong> of <strong className="text-slate-900 font-bold font-mono">{totalInvoicesCount}</strong> Invoices
                      </span>
                      <span className="hidden sm:inline">&bull;</span>
                      <div className="hidden sm:flex items-center gap-1.5">
                        <span>Rows per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(parseInt(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={-1}>All</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={validInvoicePage <= 1}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <span className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 font-black text-indigo-900 font-mono">
                        Page {validInvoicePage} of {totalInvoicePages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.min(totalInvoicePages, p + 1))}
                        disabled={validInvoicePage >= totalInvoicePages}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 4. TIER 1 MISTAKE RECOVERY FLOATING UNDO TOAST (8-SECOND WINDOW) */}
      {/* ========================================================================= */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md border border-slate-700">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>

            <div className="text-xs space-y-0.5">
              <div className="font-extrabold text-amber-300">
                Removed: {undoToast.record.productName}
              </div>
              <div className="text-[11px] text-slate-300">
                {undoToast.record.cartonQty} Cartons &bull; {undoToast.record.retailerName}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRestoreDeleted(undoToast.record)}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all inline-flex items-center gap-1 cursor-pointer shrink-0 hover:scale-105 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[3]" />
              <span>UNDO</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TIER 2 RECYCLE BIN DRAWER */}
      {/* ========================================================================= */}
      <RecycleBinDrawer
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        deletedItems={deletedRecords}
        onRestore={handleRestoreDeleted}
        onClearAll={() => setDeletedRecords([])}
      />

      {/* ========================================================================= */}
      {/* 6. ADD LAST-MINUTE ITEM MODAL */}
      {/* ========================================================================= */}
      {addItemModal && (
        <AddItemToLotModal
          isOpen={addItemModal.isOpen}
          onClose={() => setAddItemModal(null)}
          orderId={addItemModal.orderId}
          orderNumber={addItemModal.orderNumber}
          retailerName={addItemModal.retailerName}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. SHORT-CLOSE BACKORDER MODAL WITH MANDATORY REASON */}
      {/* ========================================================================= */}
      {shortCloseModal && (
        <ShortCloseBackorderModal
          isOpen={shortCloseModal.isOpen}
          onClose={() => setShortCloseModal(null)}
          item={shortCloseModal.item}
        />
      )}

      {/* ========================================================================= */}
      {/* 8. TAX INVOICE & DELIVERY CHALLAN PRINT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {invoicePreviewModal && (
        <InvoicePreviewModal
          isOpen={invoicePreviewModal.isOpen}
          onClose={() => setInvoicePreviewModal(null)}
          invoice={invoicePreviewModal.invoice}
          challan={invoicePreviewModal.challan}
          retailer={invoicePreviewModal.retailer}
          company={activeCompany}
        />
      )}

      {/* ========================================================================= */}
      {/* 9. DUAL-SCOPE RATE AUDIT & PRICING INTELLIGENCE POPOVER MODAL */}
      {/* ========================================================================= */}
      {rateIntelligenceModal && (
        <RateIntelligenceModal
          isOpen={rateIntelligenceModal.isOpen}
          onClose={() => setRateIntelligenceModal(null)}
          retailerId={rateIntelligenceModal.retailerId}
          retailerName={rateIntelligenceModal.retailerName}
          retailerCity={rateIntelligenceModal.retailerCity}
          productId={rateIntelligenceModal.productId}
          productName={rateIntelligenceModal.productName}
          sku={rateIntelligenceModal.sku}
          mrp={rateIntelligenceModal.mrp}
          tradingUnit={rateIntelligenceModal.tradingUnit}
          baseUnit={rateIntelligenceModal.baseUnit}
          unitsPerPack={rateIntelligenceModal.unitsPerPack}
          purchaseCost={rateIntelligenceModal.purchaseCost}
          currentUnitRate={rateIntelligenceModal.currentUnitRate}
          onApplyRate={(newRate) => {
            if (rateIntelligenceModal) {
              handleUnitRateChange(rateIntelligenceModal.itemEditKey, newRate);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 10. COUNTER SPOT SALE & QUICK ORDER MODAL */}
      {/* ========================================================================= */}
      {isSpotOrderModalOpen && (
        <SpotOrderModal
          isOpen={isSpotOrderModalOpen}
          onClose={() => {
            setIsSpotOrderModalOpen(false);
            if (searchParams.get('action') === 'counter' || searchParams.get('new_counter') === 'true') {
              router.replace('/admin/orders');
            }
          }}
          onOrderCreated={(order, invoice, challan) => {
            setIsSpotOrderModalOpen(false);
            if (searchParams.get('action') === 'counter' || searchParams.get('new_counter') === 'true') {
              router.replace('/admin/orders');
            }
            if (invoice) {
              const ret = retailers.find(r => r.id === order.retailer_id);
              setInvoicePreviewModal({
                isOpen: true,
                invoice,
                challan: challan || null,
                retailer: ret
              });
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 11. DRAFT PACKING PROGRESS SAVE SUCCESS TOAST */}
      {/* ========================================================================= */}
      {saveSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-start gap-3 max-w-md">
            <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-xs text-white">Draft Saved</span>
                {saveSuccessToast.timestamp && (
                  <span className="text-[10px] text-slate-400 font-mono">{saveSuccessToast.timestamp}</span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug font-medium">
                {saveSuccessToast.message}
              </p>
              {saveSuccessToast.retailerName && (
                <p className="text-[10px] text-indigo-300 font-bold mt-1">
                  Retailer: {saveSuccessToast.retailerName}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccessToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer shrink-0"
              title="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. UNSAVED PACKING CHANGES GUARD CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {unsavedChangesModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 p-6 space-y-5">
            
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Unsaved Packing Changes
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  You have unsaved packing changes. Would you like to Save Progress before leaving?
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900 font-medium">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Save className="w-3.5 h-3.5 text-amber-700" />
                <span>Saving Progress preserves:</span>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-snug">
                All modified packed pieces, box counts, rates, and line notes directly to the database without generating invoices or locking the order.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUnsavedChangesModal(null)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-center"
              >
                Stay &amp; Keep Editing
              </button>

              <button
                type="button"
                onClick={() => {
                  setInlineEdits({});
                  const targetTab = unsavedChangesModal.targetTab;
                  const targetAction = unsavedChangesModal.targetAction;
                  setUnsavedChangesModal(null);
                  if (targetTab) setActiveTab(targetTab);
                  if (targetAction) targetAction();
                }}
                className="px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer text-center"
              >
                Discard &amp; Leave
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSaveAllDirtyLots();
                  const targetTab = unsavedChangesModal.targetTab;
                  const targetAction = unsavedChangesModal.targetAction;
                  setUnsavedChangesModal(null);
                  if (targetTab) setActiveTab(targetTab);
                  if (targetAction) targetAction();
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Progress &amp; Leave</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="py-24 flex items-center justify-center text-slate-400 font-mono text-xs">
        LOADING FMCG FLOOR TERMINAL...
      </div>
    }>
      <AdminOrdersContent />
    </Suspense>
  );
}
