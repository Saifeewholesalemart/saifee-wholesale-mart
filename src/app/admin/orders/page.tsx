'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Order, OrderItem, Retailer, Product, Invoice, DeliveryChallan, Payment, Profile, Godown, Company,
  deriveOrderChannel, OrderChannel, formatAutoBoxQuantity, formatProductStockDisplay, splitBaseQuantity,
  calculateItemAmounts
} from '@/lib/db';
import { UserRole, can } from '@/lib/orderTerminalTypes';
import OrderDetailDrawer from '@/components/orders/OrderDetailDrawer';
import InvoicePreviewModal from '@/components/orders/InvoicePreviewModal';
import OrderProcessingWorkflowModal from '@/components/orders/OrderProcessingWorkflowModal';
import SpotOrderModal from '@/components/orders/SpotOrderModal';
import ShortCloseBackorderModal from '@/components/orders/ShortCloseBackorderModal';
import AdminPackingFloorModal from '@/components/orders/AdminPackingFloorModal';
import AdminBillingOverrideModal from '@/components/orders/AdminBillingOverrideModal';
import BackorderResolutionModal from '@/components/orders/BackorderResolutionModal';
import { 
  X, Search, Check, Clock, Package, Truck, Receipt, Printer,
  ChevronRight, ChevronDown, ChevronUp, ArrowRight,
  CheckCircle2, RotateCcw, MapPin, Store, Plus,
  FileText, Calendar, ArrowUpDown, SlidersHorizontal, 
  ChevronLeft, IndianRupee, Layers, Phone, User,
  Building2, Warehouse, CreditCard, Copy, Filter,
  ShieldCheck, AlertCircle, Sparkles, Ban, Edit3,
  TrendingUp, TrendingDown, RefreshCw, Eye, CheckSquare, Trash2
} from 'lucide-react';

export type StageTab = 'ALL_ORDERS' | 'TO_PACK' | 'PACKED' | 'PARTIAL_PENDING' | 'INVOICED';
export type DateFilterPreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
export type MainSortOption = 'LATEST' | 'OLDEST' | 'VALUE_DESC' | 'VALUE_ASC' | 'PENDING_DESC' | 'PENDING_ASC';
export type LineItemsSortOption = 'NONE' | 'HIGH_TO_LOW' | 'LOW_TO_HIGH';

export interface UnifiedOrderRecord {
  order: Order;
  retailer: Retailer | null;
  salesperson: Profile | null;
  company: Company | null;
  godown: Godown | null;
  channel: {
    code: string;
    label: OrderChannel;
    badgeClass: string;
  };
  lineItemsCount: number;
  totalUnits: number;
  totalAmount: number;
  status: string;
  isPartial: boolean;
  totalOrdered: number;
  totalFulfilled: number;
  totalPending: number;
  pendingValue: number;
  invoice: Invoice | null;
  deliveryChallan: DeliveryChallan | null;
  payments: Payment[];
  totalPaid: number;
  outstandingAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid' | 'Credit';
  orderDateTs: number;
  formattedDate: string;
  formattedTime: string;
}

export interface UnifiedRetailerGroup {
  retailerId: string;
  retailer: Retailer | null;
  retailerName: string;
  ownerName: string;
  phone: string;
  city: string;
  route: string;
  address: string;
  currentOutstanding: number;
  creditLimit: number;
  orders: UnifiedOrderRecord[];
  pendingOrders: UnifiedOrderRecord[];
  packedOrders: UnifiedOrderRecord[];
  completedOrders: UnifiedOrderRecord[];
  totalPackedValueSum: number;
  totalPackedPiecesSum: number;
  totalCompletedValueSum: number;
  invoicesList: Invoice[];
  retailerBackorders: Order[];
  hasPendingBackorders: boolean;
  backorderPiecesTotal: number;
  totalOrdersCount: number;
  totalLineItemsCount: number;
  totalUnitsSum: number;
  totalOrderValueSum: number;
  totalPendingPiecesSum: number;
  totalPendingValueSum: number;
  latestOrder: UnifiedOrderRecord;
  earliestOrder: UnifiedOrderRecord;
  statusSummaryList: string[];
  channelSet: Set<string>;
}

function formatINR(val?: number) {
  if (val === undefined || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AdminOrdersContent() {
  const { 
    orders, retailers, products, inventory, companies, invoices, deliveryChallans,
    payments, activeCompany, confirmOrder, currentUser, profiles, godowns, generateInvoiceForPackedLot,
    clearAllOrders, clearDummyOrders
  } = useDb();

  const searchParams = useSearchParams();
  const router = useRouter();

  // Hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Active Lifecycle Stage Tab (5 Stages)
  const [activeStageTab, setActiveStageTab] = useState<StageTab>('ALL_ORDERS');

  // Search & Global Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [dateFilterPreset, setDateFilterPreset] = useState<DateFilterPreset>('ALL');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('ALL');
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('ALL');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [minValueInput, setMinValueInput] = useState<string>('');
  const [maxValueInput, setMaxValueInput] = useState<string>('');
  
  // Sorting States
  const [lineItemsSort, setLineItemsSort] = useState<LineItemsSortOption>('NONE');
  const [mainSort, setMainSort] = useState<MainSortOption>('LATEST');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Accordion Expand State for Retailer Groups
  const [expandedRetailers, setExpandedRetailers] = useState<{ [retailerId: string]: boolean }>({});

  // Modals
  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState<string | null>(null);
  const [isOrderDetailDrawerOpen, setIsOrderDetailDrawerOpen] = useState(false);
  
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<Invoice | null>(null);
  const [selectedChallanForPreview, setSelectedChallanForPreview] = useState<DeliveryChallan | null>(null);
  const [selectedRetailerForPreview, setSelectedRetailerForPreview] = useState<Retailer | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);

  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan'>('review');
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);

  const [isSpotOrderModalOpen, setIsSpotOrderModalOpen] = useState(false);

  // New Redesign Dedicated Modals
  const [packingFloorRetailer, setPackingFloorRetailer] = useState<Retailer | null>(null);
  const [packingFloorOrders, setPackingFloorOrders] = useState<Order[]>([]);
  const [packingFloorBackorders, setPackingFloorBackorders] = useState<Order[]>([]);
  const [isPackingFloorOpen, setIsPackingFloorOpen] = useState(false);

  const [billingOverrideOrder, setBillingOverrideOrder] = useState<Order | null>(null);
  const [billingOverrideOrders, setBillingOverrideOrders] = useState<Order[]>([]);
  const [billingOverrideRetailer, setBillingOverrideRetailer] = useState<Retailer | null>(null);
  const [isBillingOverrideOpen, setIsBillingOverrideOpen] = useState(false);

  const [backorderRetailer, setBackorderRetailer] = useState<Retailer | null>(null);
  const [backorderList, setBackorderList] = useState<Order[]>([]);
  const [isBackorderModalOpen, setIsBackorderModalOpen] = useState(false);

  // URL query params sync
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'to_pack' || tabParam === 'pack') setActiveStageTab('TO_PACK');
    else if (tabParam === 'packed') setActiveStageTab('PACKED');
    else if (tabParam === 'partial' || tabParam === 'pending') setActiveStageTab('PARTIAL_PENDING');
    else if (tabParam === 'invoice' || tabParam === 'invoiced' || tabParam === 'completed') setActiveStageTab('INVOICED');

    if (searchParams.get('action') === 'counter' || searchParams.get('new_counter') === 'true') {
      setIsSpotOrderModalOpen(true);
    }
  }, [searchParams]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeStageTab,
    searchTerm, 
    selectedCity,
    dateFilterPreset, 
    customFromDate, 
    customToDate, 
    selectedRetailerId,
    selectedSalespersonId, 
    selectedChannel, 
    minValueInput,
    maxValueInput,
    lineItemsSort, 
    mainSort
  ]);

  // Extract unique cities/beats from retailers
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    retailers.forEach(r => {
      if (r.city && r.city.trim()) set.add(r.city.trim());
      if (r.beat_name && r.beat_name.trim()) set.add(r.beat_name.trim());
    });
    return Array.from(set).sort();
  }, [retailers]);

  // Date boundary check helper
  const isDateMatching = (orderDateStr?: string) => {
    if (dateFilterPreset === 'ALL') return true;
    if (!orderDateStr) return false;

    const orderDate = new Date(orderDateStr);
    if (isNaN(orderDate.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    if (dateFilterPreset === 'TODAY') {
      return orderDate >= startOfToday && orderDate < startOfTomorrow;
    }
    if (dateFilterPreset === 'YESTERDAY') {
      return orderDate >= startOfYesterday && orderDate < startOfToday;
    }
    if (dateFilterPreset === 'THIS_WEEK') {
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      return orderDate >= startOfWeek && orderDate < startOfTomorrow;
    }
    if (dateFilterPreset === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return orderDate >= startOfMonth && orderDate < startOfTomorrow;
    }
    if (dateFilterPreset === 'CUSTOM') {
      if (customFromDate && customToDate) {
        const f = new Date(customFromDate);
        f.setHours(0, 0, 0, 0);
        const t = new Date(customToDate);
        t.setHours(23, 59, 59, 999);
        return orderDate >= f && orderDate <= t;
      }
      if (customFromDate) {
        const f = new Date(customFromDate);
        f.setHours(0, 0, 0, 0);
        return orderDate >= f;
      }
      if (customToDate) {
        const t = new Date(customToDate);
        t.setHours(23, 59, 59, 999);
        return orderDate <= t;
      }
      return true;
    }
    return true;
  };

  // =========================================================================
  // 1. TRANSFORM ORDERS INTO ENRICHED UNIFIED RECORDS
  // =========================================================================
  const enrichedOrders = useMemo<UnifiedOrderRecord[]>(() => {
    return orders.map(ord => {
      const ret = retailers.find(r => r.id === ord.retailer_id) || null;
      const sp = ord.created_by ? (profiles.find(p => p.id === ord.created_by || p.email === ord.created_by || p.name === ord.created_by) || null) : null;
      const comp = ord.business_id ? (companies.find(c => c.id === ord.business_id || (c as any).business_id === ord.business_id) || companies[0] || null) : companies[0] || null;
      const gdn = ord.dispatch_godown ? ((godowns || []).find(g => g.id === ord.dispatch_godown || g.name === ord.dispatch_godown) || (godowns || [])[0] || null) : (godowns || [])[0] || null;
      
      const channel = deriveOrderChannel(ord);
      const lineItemsCount = (ord.items || []).length;

      let totalOrdered = 0;
      let totalFulfilled = 0;
      let totalPending = 0;
      let pendingValue = 0;

      (ord.items || []).forEach(it => {
        const ordQty = it.ordered_qty ?? it.ordered_pieces ?? it.base_qty ?? it.quantity ?? 0;
        const fulQty = it.fulfilled_qty ?? it.fulfilled_pieces ?? it.dispatched_qty ?? (ord.status === 'Completed' || ord.status === 'Dispatched' ? ordQty : 0);
        const canQty = it.cancelled_qty ?? it.cancelled_pieces ?? 0;
        const remQty = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, ordQty - fulQty - canQty);
        const unitRate = it.rate || it.carton_rate || it.base_price || 0;

        totalOrdered += ordQty;
        totalFulfilled += fulQty;
        totalPending += remQty;
        pendingValue += (remQty * unitRate);
      });

      const isPartial = totalPending > 0 && (totalFulfilled > 0 || ord.status === 'Partially Confirmed' || ord.status === 'Partially Fulfilled' || ord.status === 'Partially Dispatched' || ord.order_number?.includes('-BO'));

      // Invoice matching
      const inv = invoices.find(i => 
        i.id === ord.invoice_id ||
        i.order_ref_id === ord.id || 
        i.source_order_ids?.includes(ord.id) ||
        (ord.order_number && (i.order_numbers?.includes(ord.order_number) || i.source_order_numbers?.includes(ord.order_number)))
      ) || null;

      // Delivery Challan matching
      const challan = (deliveryChallans || []).find((dc: DeliveryChallan) => 
        dc.order_id === ord.id || 
        dc.order_number === ord.order_number || 
        (inv && dc.invoice_id === inv.id) ||
        (ord.challan_id && dc.id === ord.challan_id)
      ) || null;

      // Payments matching
      const ordPayments = payments.filter((p: Payment) => 
        p.retailer_id === ord.retailer_id && (
          p.notes?.includes(ord.order_number) || 
          p.reference_number === ord.order_number || 
          (inv && (p.notes?.includes(inv.invoice_number) || p.reference_number === inv.invoice_number))
        )
      );
      const totalPaid = inv?.paid_amount ?? ordPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalOrderVal = inv?.grand_total ?? ord.total_amount ?? 0;
      const outstandingAmount = inv?.outstanding_amount ?? Math.max(0, totalOrderVal - totalPaid);

      let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' | 'Credit' = 'Unpaid';
      if (inv?.payment_status === 'Paid' || (totalOrderVal > 0 && totalPaid >= totalOrderVal)) {
        paymentStatus = 'Paid';
      } else if (inv?.payment_status === 'Partial' || totalPaid > 0) {
        paymentStatus = 'Partial';
      } else if ((ord as any).is_credit || (ord as any).payment_terms === 'credit' || inv?.payment_mode === 'Credit') {
        paymentStatus = 'Credit';
      } else {
        paymentStatus = 'Unpaid';
      }

      const orderDateTs = new Date(ord.order_date || ord.created_at || Date.now()).getTime();
      const dateObj = new Date(ord.order_date || ord.created_at || Date.now());

      return {
        order: ord,
        retailer: ret,
        salesperson: sp,
        company: comp,
        godown: gdn,
        channel,
        lineItemsCount,
        totalUnits: totalOrdered,
        totalAmount: ord.total_amount || 0,
        status: ord.status,
        isPartial,
        totalOrdered,
        totalFulfilled,
        totalPending,
        pendingValue: Math.round(pendingValue * 100) / 100,
        invoice: inv,
        deliveryChallan: challan,
        payments: ordPayments,
        totalPaid,
        outstandingAmount,
        paymentStatus,
        orderDateTs,
        formattedDate: dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        formattedTime: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
    });
  }, [orders, retailers, profiles, companies, godowns, invoices, deliveryChallans, payments]);

  // =========================================================================
  // 2. STAGE METRIC COUNTERS (For Top 5 Active Status Cards)
  // =========================================================================
  const stageCounters = useMemo(() => {
    let allCount = 0;
    let toPackCount = 0;
    let packedCount = 0;
    let partialPendingCount = 0;
    let invoicedCount = 0;

    enrichedOrders.forEach(rec => {
      const st = rec.status;
      allCount++;

      if (st === 'Draft' || st === 'Submitted' || st === 'Under Review' || st === 'Confirmed' || st === 'Partially Confirmed' || st === 'PENDING') {
        toPackCount++;
      } else if (st === 'Packed' || st === 'PACKED_AND_SEALED' || st === 'PACKING_IN_PROGRESS' || st === 'Ready for Dispatch') {
        packedCount++;
      }

      if (st === 'Partially Fulfilled' || st === 'Partially Dispatched' || st === 'PARTIAL_PENDING' || rec.isPartial || (rec.totalPending > 0 && rec.totalFulfilled > 0)) {
        partialPendingCount++;
      }

      if (st === 'Completed' || st === 'Dispatched' || st === 'Delivered' || st === 'Fully Fulfilled' || rec.invoice !== null) {
        invoicedCount++;
      }
    });

    return {
      all: allCount,
      toPack: toPackCount,
      packed: packedCount,
      partialPending: partialPendingCount,
      invoiced: invoicedCount
    };
  }, [enrichedOrders]);

  // =========================================================================
  // 3. MULTI-CRITERIA FILTERING & GROUPING BY RETAILER
  // =========================================================================
  const filteredAndGroupedRetailers = useMemo<UnifiedRetailerGroup[]>(() => {
    // A. Filter individual order records
    const filteredOrders = enrichedOrders.filter(rec => {
      // 1. Stage Tab Filtering
      const st = rec.status;
      if (activeStageTab === 'TO_PACK') {
        if (st !== 'Draft' && st !== 'Submitted' && st !== 'Under Review' && st !== 'Confirmed' && st !== 'Partially Confirmed' && st !== 'PENDING') {
          return false;
        }
      } else if (activeStageTab === 'PACKED') {
        if (st !== 'Packed' && st !== 'PACKED_AND_SEALED' && st !== 'PACKING_IN_PROGRESS' && st !== 'Ready for Dispatch') {
          return false;
        }
      } else if (activeStageTab === 'PARTIAL_PENDING') {
        if (st !== 'Partially Fulfilled' && st !== 'Partially Dispatched' && st !== 'PARTIAL_PENDING' && !rec.isPartial && rec.totalPending <= 0) {
          return false;
        }
      } else if (activeStageTab === 'INVOICED') {
        if (st !== 'Completed' && st !== 'Dispatched' && st !== 'Delivered' && st !== 'Fully Fulfilled' && rec.invoice === null) {
          return false;
        }
      }

      // 2. Company Isolation
      if (activeCompany && rec.order.business_id && rec.order.business_id !== activeCompany.id && rec.order.business_id !== (activeCompany as any).business_id) {
        return false;
      }

      // 3. Date Filter
      if (!isDateMatching(rec.order.order_date || rec.order.created_at)) return false;

      // 4. City / Beat Filter
      if (selectedCity !== 'ALL') {
        const retCity = (rec.retailer?.city || '').toLowerCase();
        const retBeat = (rec.retailer?.beat_name || (rec.retailer as any)?.route || '').toLowerCase();
        const targetCity = selectedCity.toLowerCase();
        if (!retCity.includes(targetCity) && !retBeat.includes(targetCity)) {
          return false;
        }
      }

      // 5. Retailer Filter
      if (selectedRetailerId !== 'ALL' && rec.order.retailer_id !== selectedRetailerId) return false;

      // 6. Salesperson Filter
      if (selectedSalespersonId !== 'ALL' && rec.order.created_by !== selectedSalespersonId) return false;

      // 7. Channel Filter
      if (selectedChannel !== 'ALL') {
        if (rec.channel.code !== selectedChannel && rec.channel.label !== selectedChannel) return false;
      }

      // 8. Order Value Range Filter
      const ordVal = rec.invoice?.grand_total ?? rec.order.total_amount ?? 0;
      if (minValueInput.trim()) {
        const min = parseFloat(minValueInput);
        if (!isNaN(min) && ordVal < min) return false;
      }
      if (maxValueInput.trim()) {
        const max = parseFloat(maxValueInput);
        if (!isNaN(max) && ordVal > max) return false;
      }

      // 9. Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const retName = (rec.retailer?.shop_name || '').toLowerCase();
        const retOwner = (rec.retailer?.owner_name || '').toLowerCase();
        const retPhone = (rec.retailer?.phone || rec.retailer?.mobile || '').toLowerCase();
        const ordNo = (rec.order.order_number || '').toLowerCase();
        const invNo = (rec.invoice?.invoice_number || '').toLowerCase();
        const spName = (rec.salesperson?.name || '').toLowerCase();
        const hasProdMatch = (rec.order.items || []).some(it => 
          (it.product_name || (it as any).name || '').toLowerCase().includes(term) || 
          (it.product_id || '').toLowerCase().includes(term)
        );
        if (!retName.includes(term) && !retOwner.includes(term) && !retPhone.includes(term) && !ordNo.includes(term) && !invNo.includes(term) && !spName.includes(term) && !hasProdMatch) {
          return false;
        }
      }

      return true;
    });

    // B. Group Orders by Retailer
    const groupsMap = new Map<string, {
      retailerId: string;
      retailer: Retailer | null;
      orders: UnifiedOrderRecord[];
    }>();

    filteredOrders.forEach(ordRec => {
      const retId = ordRec.order.retailer_id || 'UNKNOWN_RETAILER';
      let grp = groupsMap.get(retId);
      if (!grp) {
        grp = {
          retailerId: retId,
          retailer: ordRec.retailer,
          orders: []
        };
        groupsMap.set(retId, grp);
      }
      grp.orders.push(ordRec);
    });

    const groups: UnifiedRetailerGroup[] = [];

    groupsMap.forEach(({ retailerId, retailer, orders: grpOrders }) => {
      let sortedOrders = [...grpOrders];

      // Line Items Sort
      if (lineItemsSort === 'HIGH_TO_LOW') {
        sortedOrders.sort((a, b) => b.lineItemsCount - a.lineItemsCount);
      } else if (lineItemsSort === 'LOW_TO_HIGH') {
        sortedOrders.sort((a, b) => a.lineItemsCount - b.lineItemsCount);
      } else {
        // Main Sort
        switch (mainSort) {
          case 'LATEST':
            sortedOrders.sort((a, b) => b.orderDateTs - a.orderDateTs);
            break;
          case 'OLDEST':
            sortedOrders.sort((a, b) => a.orderDateTs - b.orderDateTs);
            break;
          case 'VALUE_DESC':
            sortedOrders.sort((a, b) => b.totalAmount - a.totalAmount);
            break;
          case 'VALUE_ASC':
            sortedOrders.sort((a, b) => a.totalAmount - b.totalAmount);
            break;
          case 'PENDING_DESC':
            sortedOrders.sort((a, b) => b.totalPending - a.totalPending);
            break;
          case 'PENDING_ASC':
            sortedOrders.sort((a, b) => a.totalPending - b.totalPending);
            break;
          default:
            sortedOrders.sort((a, b) => b.orderDateTs - a.orderDateTs);
            break;
        }
      }

      let totalLineItems = 0;
      let totalUnitsSum = 0;
      let totalOrderValueSum = 0;
      let totalPendingPiecesSum = 0;
      let totalPendingValueSum = 0;
      const channelSet = new Set<string>();
      const statusCountMap: { [st: string]: number } = {};

      sortedOrders.forEach(o => {
        totalLineItems += o.lineItemsCount;
        totalUnitsSum += o.totalUnits;
        totalOrderValueSum += o.totalAmount;
        totalPendingPiecesSum += o.totalPending;
        totalPendingValueSum += o.pendingValue;
        channelSet.add(o.channel.label);

        const st = o.status;
        statusCountMap[st] = (statusCountMap[st] || 0) + 1;
      });

      const statusSummaryList: string[] = [];
      Object.entries(statusCountMap).forEach(([st, cnt]) => {
        statusSummaryList.push(`${cnt} ${st}`);
      });

      const chronoSorted = [...grpOrders].sort((a, b) => b.orderDateTs - a.orderDateTs);
      const latestOrder = chronoSorted[0];
      const earliestOrder = chronoSorted[chronoSorted.length - 1];

      const currentOutstanding = retailer?.outstanding ?? retailer?.outstanding_balance ?? 0;
      const creditLimit = retailer?.credit_limit || 50000;

      const pendingOrders = sortedOrders.filter(o => 
        o.status === 'Draft' || 
        o.status === 'Submitted' || 
        o.status === 'Under Review' || 
        o.status === 'Confirmed' || 
        o.status === 'Partially Confirmed' || 
        (o.status as string) === 'PENDING'
      );

      const packedOrders = sortedOrders.filter(o => 
        o.status === 'Packed' || 
        o.status === 'PACKED_AND_SEALED' || 
        o.status === 'Ready for Dispatch' ||
        (o.status as string) === 'PACKING_IN_PROGRESS'
      );

      let totalPackedValueSum = 0;
      let totalPackedPiecesSum = 0;
      packedOrders.forEach(o => {
        totalPackedValueSum += (o.order.total_amount || 0);
        (o.order.items || []).forEach(it => {
          totalPackedPiecesSum += (it.packed_qty ?? it.confirmed_qty ?? it.base_qty ?? it.quantity ?? 0);
        });
      });

      const completedOrders = sortedOrders.filter(o => 
        o.status === 'Completed' || 
        o.status === 'Fully Fulfilled' || 
        o.status === 'Dispatched' || 
        o.status === 'Delivered' ||
        (o.invoice !== null && o.invoice !== undefined)
      );

      let totalCompletedValueSum = 0;
      completedOrders.forEach(o => {
        totalCompletedValueSum += (o.order.total_amount || o.totalAmount || 0);
      });

      const groupInvoicesMap = new Map<string, Invoice>();
      sortedOrders.forEach(o => {
        if (o.invoice) {
          groupInvoicesMap.set(o.invoice.id, o.invoice);
        }
      });
      const invoicesList = Array.from(groupInvoicesMap.values());

      // Find all active backorders for this retailer in system
      const retailerBackorders = orders.filter(o => 
        o.retailer_id === retailerId && (
          o.status === 'Partially Fulfilled' || 
          (o.status as string) === 'PARTIAL_PENDING' || 
          o.order_number?.includes('-BO') ||
          (o.items && o.items.some(i => (i.remaining_qty || 0) > 0 && (i.status === 'PARTIAL_PENDING' || (i as any).status === 'PARTIALLY_FULFILLED')))
        ) && o.status !== 'Completed' && o.status !== 'Cancelled'
      );

      let backorderPiecesTotal = 0;
      retailerBackorders.forEach(bo => {
        bo.items?.forEach(it => {
          const rem = it.remaining_qty !== undefined && it.remaining_qty > 0 
            ? it.remaining_qty 
            : ((it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0) - (it.fulfilled_qty || 0) - (it.cancelled_qty || 0));
          if (rem > 0) backorderPiecesTotal += rem;
        });
      });
      const hasPendingBackorders = backorderPiecesTotal > 0 || retailerBackorders.length > 0;

      groups.push({
        retailerId,
        retailer,
        retailerName: retailer?.shop_name || 'Retailer Customer',
        ownerName: retailer?.owner_name || 'N/A',
        phone: retailer?.phone || retailer?.mobile || 'N/A',
        city: retailer?.city || 'Indore',
        route: retailer?.beat_name || (retailer as any)?.route || 'Main Market',
        address: retailer?.address || (retailer as any)?.shop_address || '',
        currentOutstanding,
        creditLimit,
        orders: sortedOrders,
        pendingOrders,
        packedOrders,
        completedOrders,
        totalPackedValueSum: Math.round(totalPackedValueSum * 100) / 100,
        totalPackedPiecesSum,
        totalCompletedValueSum: Math.round(totalCompletedValueSum * 100) / 100,
        invoicesList,
        retailerBackorders,
        hasPendingBackorders,
        backorderPiecesTotal,
        totalOrdersCount: sortedOrders.length,
        totalLineItemsCount: totalLineItems,
        totalUnitsSum,
        totalOrderValueSum: Math.round(totalOrderValueSum * 100) / 100,
        totalPendingPiecesSum,
        totalPendingValueSum: Math.round(totalPendingValueSum * 100) / 100,
        latestOrder,
        earliestOrder,
        statusSummaryList,
        channelSet
      });
    });

    // Sort groups
    switch (mainSort) {
      case 'LATEST':
        return [...groups].sort((a, b) => b.latestOrder.orderDateTs - a.latestOrder.orderDateTs);
      case 'OLDEST':
        return [...groups].sort((a, b) => a.earliestOrder.orderDateTs - b.earliestOrder.orderDateTs);
      case 'VALUE_DESC':
        return [...groups].sort((a, b) => b.totalOrderValueSum - a.totalOrderValueSum);
      case 'VALUE_ASC':
        return [...groups].sort((a, b) => a.totalOrderValueSum - b.totalOrderValueSum);
      case 'PENDING_DESC':
        return [...groups].sort((a, b) => b.totalPendingPiecesSum - a.totalPendingPiecesSum);
      case 'PENDING_ASC':
        return [...groups].sort((a, b) => a.totalPendingPiecesSum - b.totalPendingPiecesSum);
      default:
        return [...groups].sort((a, b) => b.latestOrder.orderDateTs - a.latestOrder.orderDateTs);
    }
  }, [
    enrichedOrders, activeStageTab, activeCompany, dateFilterPreset, customFromDate, customToDate,
    selectedCity, selectedRetailerId, selectedSalespersonId, selectedChannel,
    minValueInput, maxValueInput, searchTerm, lineItemsSort, mainSort
  ]);

  // Grand totals across filtered groups
  const totalFilteredOrdersCount = useMemo(() => {
    return filteredAndGroupedRetailers.reduce((sum, g) => sum + g.totalOrdersCount, 0);
  }, [filteredAndGroupedRetailers]);

  const totalFilteredValueSum = useMemo(() => {
    return filteredAndGroupedRetailers.reduce((sum, g) => sum + g.totalOrderValueSum, 0);
  }, [filteredAndGroupedRetailers]);

  // Pagination for Retailer Groups
  const totalRetailerPages = Math.max(1, Math.ceil(filteredAndGroupedRetailers.length / (pageSize === -1 ? 999999 : pageSize)));
  const validCurrentPage = Math.min(currentPage, totalRetailerPages);

  const pagedRetailerGroups = useMemo(() => {
    if (pageSize === -1) return filteredAndGroupedRetailers;
    const start = (validCurrentPage - 1) * pageSize;
    return filteredAndGroupedRetailers.slice(start, start + pageSize);
  }, [filteredAndGroupedRetailers, validCurrentPage, pageSize]);

  // Accordion Expand/Collapse Helpers
  const toggleRetailerExpand = (retailerId: string) => {
    setExpandedRetailers(prev => ({
      ...prev,
      [retailerId]: prev[retailerId] === false ? true : false
    }));
  };

  const handleExpandAll = () => {
    const next: { [retId: string]: boolean } = {};
    filteredAndGroupedRetailers.forEach(g => { next[g.retailerId] = true; });
    setExpandedRetailers(next);
  };

  const handleCollapseAll = () => {
    const next: { [retId: string]: boolean } = {};
    filteredAndGroupedRetailers.forEach(g => { next[g.retailerId] = false; });
    setExpandedRetailers(next);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCity('ALL');
    setDateFilterPreset('ALL');
    setCustomFromDate('');
    setCustomToDate('');
    setSelectedRetailerId('ALL');
    setSelectedSalespersonId('ALL');
    setSelectedChannel('ALL');
    setMinValueInput('');
    setMaxValueInput('');
    setLineItemsSort('NONE');
    setMainSort('LATEST');
    setCurrentPage(1);
  };

  const hasActiveFilters = (
    searchTerm.trim() !== '' ||
    selectedCity !== 'ALL' ||
    dateFilterPreset !== 'ALL' ||
    selectedRetailerId !== 'ALL' ||
    selectedSalespersonId !== 'ALL' ||
    selectedChannel !== 'ALL' ||
    minValueInput.trim() !== '' ||
    maxValueInput.trim() !== '' ||
    lineItemsSort !== 'NONE' ||
    mainSort !== 'LATEST'
  );

  // Workflow Triggers
  const handleOpenPackingFloor = (retailer: Retailer | null, targetOrders: Order[], backorders: Order[] = []) => {
    setPackingFloorRetailer(retailer);
    setPackingFloorOrders(targetOrders);
    setPackingFloorBackorders(backorders);
    setIsPackingFloorOpen(true);
  };

  const handleOpenBillingOverride = (order: Order) => {
    setBillingOverrideOrder(order);
    setBillingOverrideOrders([order]);
    setBillingOverrideRetailer(retailers.find(r => r.id === order.retailer_id) || null);
    setIsBillingOverrideOpen(true);
  };

  const handleOpenBillingOverrideConsolidated = (retailer: Retailer | null, packedOrders: Order[]) => {
    setBillingOverrideOrder(packedOrders[0] || null);
    setBillingOverrideOrders(packedOrders);
    setBillingOverrideRetailer(retailer);
    setIsBillingOverrideOpen(true);
  };

  const handleGenerateConsolidatedTaxInvoice = (retailer: Retailer | null, packedOrders: Order[]) => {
    if (!retailer || packedOrders.length === 0) return;

    // Aggregate packed items across all packed orders for this retailer
    const allPackedLotItems: any[] = [];
    packedOrders.forEach(ord => {
      (ord.items || []).forEach(it => {
        const prod = products.find(p => p.id === it.product_id);
        const unitsPerPack = it.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const packedPieces = it.packed_qty ?? it.confirmed_qty ?? it.base_qty ?? it.quantity ?? 0;
        if (packedPieces > 0) {
          const { cartonQty, looseQty } = splitBaseQuantity(packedPieces, unitsPerPack);
          const unitRate = it.manual_billing_rate || it.carton_rate || it.order_time_rate || it.base_price || prod?.selling_price || 0;
          allPackedLotItems.push({
            originOrderId: ord.id,
            originItemId: it.id,
            productId: it.product_id,
            productName: prod?.name || (it as any).name || 'Product Item',
            sku: prod?.sku || 'SKU',
            mrp: it.selected_mrp || prod?.mrp || 0,
            unitsPerPack,
            tradingUnit: it.trading_unit || prod?.trading_unit || 'Carton',
            baseUnit: it.base_unit || prod?.base_unit || 'Piece',
            packedCartons: cartonQty,
            packedLoose: looseQty,
            packedPieces,
            unitRate,
            flatDiscount: it.carton_discount || it.discount || 0,
            purchaseCost: it.purchase_rate || prod?.purchase_price || 0,
            hsn: (it as any).hsn || prod?.hsn || '1902'
          });
        }
      });
    });

    if (allPackedLotItems.length === 0) {
      alert('No packed items found across the selected orders. Please pack the orders on the packing floor first.');
      return;
    }

    const adminUser = currentUser ? { id: currentUser.id, name: currentUser.name } : undefined;
    const res = generateInvoiceForPackedLot(
      {
        retailerId: retailer.id,
        sourceOrderIds: packedOrders.map(o => o.id),
        items: allPackedLotItems
      },
      {
        date: new Date().toISOString(),
        notes: `Consolidated GST Tax Invoice for ${packedOrders.length} packed order(s): ${packedOrders.map(o => o.order_number).join(', ')}`,
        generateChallan: true
      },
      adminUser
    );

    if (res && res.invoice) {
      setSelectedInvoiceForPreview(res.invoice);
      setSelectedChallanForPreview(res.challan || null);
      setSelectedRetailerForPreview(retailer);
      setIsInvoicePreviewOpen(true);
    }
  };

  const handlePrintConsolidatedTaxInvoice = (retailer: Retailer | null, targetOrders: Order[]) => {
    if (!retailer || targetOrders.length === 0) return;

    // 1. Find all associated invoices in the DB for these orders
    const matchingInvoices = invoices.filter(inv => {
      return inv.retailer_id === retailer.id && (
        targetOrders.some(to => to.invoice_id === inv.id || to.id === inv.order_ref_id) ||
        (inv.source_order_ids && targetOrders.some(to => inv.source_order_ids?.includes(to.id))) ||
        (inv.source_order_numbers && targetOrders.some(to => inv.source_order_numbers?.includes(to.order_number))) ||
        (inv.order_numbers && targetOrders.some(to => inv.order_numbers?.includes(to.order_number)))
      );
    });

    // 2. Resolve or aggregate matching Delivery Challan
    const matchingChallans = deliveryChallans.filter(dc => {
      return (
        targetOrders.some(to => to.challan_id === dc.id || to.id === dc.order_id || to.order_number === dc.order_number) ||
        matchingInvoices.some(inv => inv.id === dc.invoice_id)
      );
    });
    const primaryChallan = matchingChallans[0] || null;

    // 3. Build/Aggregate ALL line items across ALL target completed orders (merging duplicate SKUs, distinct products on own rows)
    const aggregatedItemsMap = new Map<string, any>();
    let calcSubtotal = 0;
    let calcTaxable = 0;
    let calcCgst = 0;
    let calcSgst = 0;
    let calcIgst = 0;
    const isLocal = (retailer.state_code || '27') === '27';

    const processOrderItem = (it: any, idx: number, fallbackInvId: string) => {
      const prod = products.find(p => p.id === it.product_id);
      const unitsPerPack = it.units_per_trading_unit || it.units_per_box_carton || prod?.units_per_box_carton || 1;
      const baseQty = it.fulfilled_qty || it.confirmed_qty || it.packed_qty || it.ordered_qty || it.base_qty || it.quantity || 0;
      if (baseQty <= 0) return;

      const cartonRate = it.manual_billing_rate || it.carton_rate || it.rate || it.order_time_rate || it.base_price || prod?.selling_price || 0;
      const looseRate = it.loose_rate || prod?.loose_selling_price || (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
      
      // Strict GST rate from product master or line item
      const prodGst = (prod?.gst_percent !== undefined && prod?.gst_percent !== null)
        ? Number(prod.gst_percent)
        : ((it.gst_percent !== undefined && it.gst_percent !== null) ? Number(it.gst_percent) : 0);

      const { cartonQty, looseQty } = it.carton_qty !== undefined && it.loose_qty !== undefined && (it.carton_qty > 0 || it.loose_qty > 0)
        ? { cartonQty: it.carton_qty, looseQty: it.loose_qty }
        : splitBaseQuantity(baseQty, unitsPerPack);

      const disc = it.discount || ((it.carton_discount || 0) * cartonQty + (it.loose_discount || 0) * looseQty) || 0;
      const taxable = Math.max(0, Math.round(((baseQty * (cartonRate / Math.max(1, unitsPerPack))) - disc) * 100) / 100) ||
                      (it.taxable_value !== undefined ? Number(it.taxable_value) : Math.round(cartonQty * cartonRate * 100) / 100);

      // Strict Mathematical Logic: If 0% GST -> tax is strictly 0
      const lineGst = prodGst > 0 ? Math.round(taxable * (prodGst / 100) * 100) / 100 : 0;
      const cgst = isLocal ? Math.round((lineGst / 2) * 100) / 100 : 0;
      const sgst = isLocal ? Math.round((lineGst / 2) * 100) / 100 : 0;
      const igst = !isLocal ? lineGst : 0;
      const lineTotal = Math.round((taxable + lineGst) * 100) / 100;

      const itemKey = `${it.product_id}_${cartonRate}`;
      const existing = aggregatedItemsMap.get(itemKey);
      if (existing) {
        existing.quantity += baseQty;
        existing.base_qty = (existing.base_qty || 0) + baseQty;
        existing.carton_qty = (existing.carton_qty || 0) + cartonQty;
        existing.loose_qty = (existing.loose_qty || 0) + looseQty;
        existing.discount = Math.round(((existing.discount || 0) + disc) * 100) / 100;
        existing.taxable_value = Math.round(((existing.taxable_value || 0) + taxable) * 100) / 100;
        existing.gst_percent = prodGst;
        const aggLineGst = prodGst > 0 ? Math.round(existing.taxable_value * (prodGst / 100) * 100) / 100 : 0;
        existing.cgst = isLocal ? Math.round((aggLineGst / 2) * 100) / 100 : 0;
        existing.sgst = isLocal ? Math.round((aggLineGst / 2) * 100) / 100 : 0;
        existing.igst = !isLocal ? aggLineGst : 0;
        existing.total_amount = Math.round((existing.taxable_value + aggLineGst) * 100) / 100;
      } else {
        aggregatedItemsMap.set(itemKey, {
          id: it.id || `inv-agg-item-${idx}`,
          invoice_id: fallbackInvId,
          product_id: it.product_id,
          product_name: prod?.name || (it as any).product_name || (it as any).name || (it as any).description || 'Product Item',
          variant_name: prod?.name || (it as any).variant_name || (it as any).name || 'Product Item',
          description: prod?.name || (it as any).description || (it as any).name || 'Product Item',
          hsn: (it as any).hsn || prod?.hsn || '1905',
          packing: (it as any).pack_size || (it as any).packing || prod?.pack_size || `${unitsPerPack} ${it.base_unit || 'Piece'}/Ctn`,
          quantity: baseQty,
          base_qty: baseQty,
          carton_qty: cartonQty,
          loose_qty: looseQty,
          trading_unit: it.trading_unit || prod?.trading_unit || 'Carton',
          base_unit: it.base_unit || prod?.base_unit || 'Piece',
          units_per_trading_unit: unitsPerPack,
          units_per_box_carton: unitsPerPack,
          rate: cartonRate,
          carton_rate: cartonRate,
          loose_rate: looseRate,
          discount: disc,
          taxable_value: taxable,
          gst_percent: prodGst,
          cgst,
          sgst,
          igst,
          total_amount: lineTotal,
          batch_number: it.batch_number || it.batch_allocations?.[0]?.batch_number || 'LOT-2026',
          mrp: it.selected_mrp || it.mrp || prod?.mrp || 0
        });
      }
    };

    const primaryInvoice = matchingInvoices[0];
    const defaultInvId = primaryInvoice?.id || `inv-unified-${retailer.id}`;

    // 1. Gather all line items across all target orders
    targetOrders.forEach(ord => {
      (ord.items || []).forEach((it, idx) => {
        processOrderItem(it, idx, defaultInvId);
      });
    });

    // 2. Also ensure any items in matchingInvoices are captured if not in orders
    matchingInvoices.forEach(inv => {
      (inv.items || []).forEach((it, idx) => {
        const itemKey = `${it.product_id}_${it.carton_rate ?? it.rate ?? 0}`;
        if (!aggregatedItemsMap.has(itemKey)) {
          processOrderItem(it, idx, defaultInvId);
        }
      });
    });

    const finalItems = Array.from(aggregatedItemsMap.values());
    finalItems.forEach(it => {
      calcTaxable += (it.taxable_value || 0);
      calcCgst += (it.cgst || 0);
      calcSgst += (it.sgst || 0);
      calcIgst += (it.igst || 0);
    });
    calcTaxable = Math.round(calcTaxable * 100) / 100;
    calcCgst = Math.round(calcCgst * 100) / 100;
    calcSgst = Math.round(calcSgst * 100) / 100;
    calcIgst = Math.round(calcIgst * 100) / 100;
    calcSubtotal = calcTaxable;

    const unroundedGrand = calcTaxable + calcCgst + calcSgst + calcIgst;
    const grandTotal = Math.round(unroundedGrand);
    const roundOff = Math.round((grandTotal - unroundedGrand) * 100) / 100;

    const totalPaid = matchingInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
    const outstanding = Math.max(0, grandTotal - totalPaid);

    const consolidatedInvoice: Invoice = {
      id: primaryInvoice?.id || `inv-unified-${retailer.id}-${Date.now()}`,
      invoice_number: primaryInvoice?.invoice_number || `INV/2026-27/${String(invoices.length + 1).padStart(5, '0')}`,
      retailer_id: retailer.id,
      order_ref_id: targetOrders[0]?.id || '',
      source_order_ids: targetOrders.map(o => o.id),
      source_order_numbers: targetOrders.map(o => o.order_number),
      order_numbers: targetOrders.map(o => o.order_number),
      date: primaryInvoice?.date || targetOrders[0]?.dispatched_at || targetOrders[0]?.order_date || new Date().toISOString(),
      place_of_supply: retailer.state_code === '27' || !retailer.state_code ? 'Maharashtra (27)' : `Out of State (${retailer.state_code})`,
      subtotal: calcSubtotal,
      discount_amount: 0,
      taxable_value: calcTaxable,
      cgst: calcCgst,
      sgst: calcSgst,
      igst: calcIgst,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: totalPaid,
      outstanding_amount: outstanding,
      payment_status: outstanding <= 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid'),
      payment_mode: primaryInvoice?.payment_mode || 'Credit',
      payment_reference: primaryInvoice?.payment_reference || '',
      notes: primaryInvoice?.notes || `Consolidated Tax Invoice for ${targetOrders.length} order(s): ${targetOrders.map(o => o.order_number).join(', ')}`,
      business_id: activeCompany?.id || '',
      company_id: activeCompany?.id || '',
      items: finalItems
    };

    setSelectedInvoiceForPreview(consolidatedInvoice);
    setSelectedChallanForPreview(primaryChallan);
    setSelectedRetailerForPreview(retailer);
    setIsInvoicePreviewOpen(true);
  };

  const handleOpenBackorderResolution = (retailer: Retailer, backorders: Order[]) => {
    setBackorderRetailer(retailer);
    setBackorderList(backorders);
    setIsBackorderModalOpen(true);
  };

  const handleViewInvoice = (invoice: Invoice, challan?: DeliveryChallan | null, retailer?: Retailer | null) => {
    setSelectedInvoiceForPreview(invoice);
    setSelectedChallanForPreview(challan || null);
    setSelectedRetailerForPreview(retailer || null);
    setIsInvoicePreviewOpen(true);
  };

  const handleOpenWorkflowModal = (orderId: string, stage: 'review' | 'confirm' | 'pack' | 'dispatch' | 'invoice' | 'payment' | 'challan') => {
    setProcessingOrderId(orderId);
    setProcessingStage(stage);
    setIsProcessingModalOpen(true);
  };

  if (!mounted) {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 font-mono tracking-wider">LOADING ADMIN ORDER REGISTER...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans pb-16 px-2 sm:px-4">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & INSTANT SPOT ORDER CTA */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center text-white shadow-sm shrink-0">
            <Layers className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                ADMIN ORDER PROCESSING COCKPIT
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                Internal Operations
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              5-Stage lifecycle control: Ingestion &bull; Packing Floor &bull; Pricing Review &bull; Backorder Split &bull; Tax Invoicing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {orders.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete all orders? This will delete all dummy and active orders. Your products and purchase stock will remain completely safe.')) {
                  clearAllOrders();
                }
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Delete All Orders"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete All Orders</span>
            </button>
          )}

          <button
            onClick={() => setIsSpotOrderModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4 text-white stroke-[3]" />
            <span>New Counter Spot Order</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP METRIC CARDS & 5-STAGE NAVIGATION SWITCHER */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* Card 1: All Orders */}
        <button
          type="button"
          onClick={() => setActiveStageTab('ALL_ORDERS')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
            activeStageTab === 'ALL_ORDERS'
              ? 'bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/50 scale-102'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${activeStageTab === 'ALL_ORDERS' ? 'text-indigo-300' : 'text-slate-500'}`}>
              Stage 1
            </span>
            <FileText className={`w-4 h-4 ${activeStageTab === 'ALL_ORDERS' ? 'text-indigo-300' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {stageCounters.all}
            </span>
            <span className={`text-xs font-bold block mt-0.5 ${activeStageTab === 'ALL_ORDERS' ? 'text-white' : 'text-slate-800'}`}>
              📑 All Orders
            </span>
          </div>
          <span className={`text-[10px] mt-2 block ${activeStageTab === 'ALL_ORDERS' ? 'text-slate-300' : 'text-slate-400'}`}>
            All ingestion channels
          </span>
        </button>

        {/* Card 2: Orders to be Packed */}
        <button
          type="button"
          onClick={() => setActiveStageTab('TO_PACK')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
            activeStageTab === 'TO_PACK'
              ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50 scale-102'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${activeStageTab === 'TO_PACK' ? 'text-amber-100' : 'text-amber-700'}`}>
              Stage 2
            </span>
            <Package className={`w-4 h-4 ${activeStageTab === 'TO_PACK' ? 'text-amber-100' : 'text-amber-600'}`} />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {stageCounters.toPack}
            </span>
            <span className={`text-xs font-bold block mt-0.5 ${activeStageTab === 'TO_PACK' ? 'text-white' : 'text-slate-800'}`}>
              📦 Orders to be Packed
            </span>
          </div>
          <span className={`text-[10px] mt-2 block ${activeStageTab === 'TO_PACK' ? 'text-amber-100' : 'text-slate-400'}`}>
            Awaiting floor packing
          </span>
        </button>

        {/* Card 3: Packed Orders */}
        <button
          type="button"
          onClick={() => setActiveStageTab('PACKED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
            activeStageTab === 'PACKED'
              ? 'bg-gradient-to-br from-teal-600 to-emerald-700 text-white border-teal-600 shadow-md ring-2 ring-emerald-400/50 scale-102'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${activeStageTab === 'PACKED' ? 'text-teal-100' : 'text-teal-700'}`}>
              Stage 3
            </span>
            <CheckCircle2 className={`w-4 h-4 ${activeStageTab === 'PACKED' ? 'text-teal-100' : 'text-teal-600'}`} />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {stageCounters.packed}
            </span>
            <span className={`text-xs font-bold block mt-0.5 ${activeStageTab === 'PACKED' ? 'text-white' : 'text-slate-800'}`}>
              ✅ Packed Orders
            </span>
          </div>
          <span className={`text-[10px] mt-2 block ${activeStageTab === 'PACKED' ? 'text-teal-100' : 'text-slate-400'}`}>
            Ready for billing review
          </span>
        </button>

        {/* Card 4: Partial Pending Orders */}
        <button
          type="button"
          onClick={() => setActiveStageTab('PARTIAL_PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
            activeStageTab === 'PARTIAL_PENDING'
              ? 'bg-gradient-to-br from-purple-700 to-indigo-900 text-white border-purple-700 shadow-md ring-2 ring-purple-400/50 scale-102'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${activeStageTab === 'PARTIAL_PENDING' ? 'text-purple-200' : 'text-purple-700'}`}>
              Stage 4
            </span>
            <Clock className={`w-4 h-4 ${activeStageTab === 'PARTIAL_PENDING' ? 'text-purple-200' : 'text-purple-600'}`} />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {stageCounters.partialPending}
            </span>
            <span className={`text-xs font-bold block mt-0.5 ${activeStageTab === 'PARTIAL_PENDING' ? 'text-white' : 'text-slate-800'}`}>
              ⏳ Partial Backorders
            </span>
          </div>
          <span className={`text-[10px] mt-2 block ${activeStageTab === 'PARTIAL_PENDING' ? 'text-purple-200' : 'text-slate-400'}`}>
            Shortage queue by retailer
          </span>
        </button>

        {/* Card 5: Generate Invoice / Completed */}
        <button
          type="button"
          onClick={() => setActiveStageTab('INVOICED')}
          className={`col-span-2 sm:col-span-1 p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
            activeStageTab === 'INVOICED'
              ? 'bg-gradient-to-br from-indigo-700 to-blue-900 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/50 scale-102'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-black uppercase tracking-wider ${activeStageTab === 'INVOICED' ? 'text-indigo-200' : 'text-indigo-700'}`}>
              Stage 5
            </span>
            <Receipt className={`w-4 h-4 ${activeStageTab === 'INVOICED' ? 'text-indigo-200' : 'text-indigo-600'}`} />
          </div>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black block tracking-tight">
              {stageCounters.invoiced}
            </span>
            <span className={`text-xs font-bold block mt-0.5 ${activeStageTab === 'INVOICED' ? 'text-white' : 'text-slate-800'}`}>
              🧾 Tax Invoiced
            </span>
          </div>
          <span className={`text-[10px] mt-2 block ${activeStageTab === 'INVOICED' ? 'text-indigo-200' : 'text-slate-400'}`}>
            Billed & GST Invoiced
          </span>
        </button>

      </div>

      {/* ========================================================================= */}
      {/* 3. ADVANCED GLOBAL FILTERS BAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3 max-w-full">
        
        {/* Row 1: Search, City/Beat Filter, Line Item Sort, Date Range Presets */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Global Search Bar */}
          <div className="flex-1 min-w-[220px] sm:min-w-[280px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Shop, Owner, Order #, Phone, SKU..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 4 Dropdowns with proper min-widths to prevent text truncation */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 sm:flex-initial">
            {/* City / Beat Filter */}
            <div className="min-w-[150px] flex-1 sm:flex-initial">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">📍 All Cities / Beats</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Line Item Count Sort */}
            <div className="min-w-[175px] flex-1 sm:flex-initial">
              <select
                value={lineItemsSort}
                onChange={(e) => setLineItemsSort(e.target.value as LineItemsSortOption)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="NONE">🔢 Line Items: Default</option>
                <option value="HIGH_TO_LOW">🔢 Line Items: High → Low</option>
                <option value="LOW_TO_HIGH">🔢 Line Items: Low → High</option>
              </select>
            </div>

            {/* Date Range Preset Selector */}
            <div className="min-w-[155px] flex-1 sm:flex-initial">
              <select
                value={dateFilterPreset}
                onChange={(e) => setDateFilterPreset(e.target.value as DateFilterPreset)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">📅 Date: All Time</option>
                <option value="TODAY">📅 Today</option>
                <option value="YESTERDAY">📅 Yesterday</option>
                <option value="THIS_WEEK">📅 This Week</option>
                <option value="THIS_MONTH">📅 This Month</option>
                <option value="CUSTOM">📅 Custom (From-To)</option>
              </select>
            </div>

            {/* Main Sort */}
            <div className="min-w-[165px] flex-1 sm:flex-initial">
              <select
                value={mainSort}
                onChange={(e) => setMainSort(e.target.value as MainSortOption)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="LATEST">⚡ Sort: Latest First</option>
                <option value="OLDEST">⚡ Sort: Oldest First</option>
                <option value="VALUE_DESC">💰 Value: High → Low (₹)</option>
                <option value="VALUE_ASC">💰 Value: Low → High (₹)</option>
              </select>
            </div>
          </div>

        </div>

        {/* Row 2: Ingestion Channel Pills, Order Value Range Inputs, Expand/Collapse & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          
          {/* Left: Channel Filter Pills with smooth horizontal scrolling */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar shrink-0">
            <span className="text-slate-400 font-bold text-[11px] mr-1 shrink-0">Source:</span>
            {[
              { code: 'ALL', label: 'All Channels' },
              { code: 'DISTRIBUTOR_SALESPERSON', label: 'Dist Sales' },
              { code: 'COMPANY_SALESPERSON', label: 'Co Sales' },
              { code: 'COUNTER_SPOT', label: 'Spot Counter' },
              { code: 'RETAILER_PORTAL', label: 'Retailer App' }
            ].map(ch => (
              <button
                key={ch.code}
                type="button"
                onClick={() => setSelectedChannel(ch.code)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  selectedChannel === ch.code
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Value Range + Expand/Collapse/Reset in responsive flex container */}
          <div className="flex items-center gap-2.5 flex-wrap ml-auto">
            {/* Middle: Order Value Range Threshold Inputs */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200 shrink-0">
              <span className="text-slate-500 font-bold text-[11px] shrink-0">Value:</span>
              <input
                type="number"
                placeholder="Min ₹"
                value={minValueInput}
                onChange={(e) => setMinValueInput(e.target.value)}
                className="w-18 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-center focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="text-slate-300">-</span>
              <input
                type="number"
                placeholder="Max ₹"
                value={maxValueInput}
                onChange={(e) => setMaxValueInput(e.target.value)}
                className="w-18 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-center focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Right: Expand/Collapse & Reset Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleExpandAll}
                type="button"
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={handleCollapseAll}
                type="button"
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                Collapse
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  type="button"
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Custom Date Pickers Drawer (if selected) */}
        {dateFilterPreset === 'CUSTOM' && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-xs">
            <span className="font-bold text-slate-600">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              />
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 4. ACTIVE SECTION WORKFLOW HEADER & SUMMARY */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Showing <strong className="text-slate-900 font-bold">{filteredAndGroupedRetailers.length}</strong> Retailer Accounts ({totalFilteredOrdersCount} orders) &bull; Total Filtered Value: <strong className="text-indigo-700 font-extrabold">{formatINR(totalFilteredValueSum)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span>Page {validCurrentPage} of {totalRetailerPages}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. RETAILER CONSOLIDATED CARDS & SECTION ACCORDIONS */}
      {/* ========================================================================= */}
      {pagedRetailerGroups.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-slate-200 text-center p-6 space-y-3">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-800">No Orders Matching Active Filters</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No orders found under {activeStageTab === 'ALL_ORDERS' ? 'All Orders' : activeStageTab === 'TO_PACK' ? 'Orders to be Packed' : activeStageTab === 'PACKED' ? 'Packed Orders' : activeStageTab === 'PARTIAL_PENDING' ? 'Partial Pending Orders' : 'Tax Invoiced'}. Try adjusting your city, date, or search filters.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {pagedRetailerGroups.map((group) => {
            const isExpanded = expandedRetailers[group.retailerId] !== false; // expanded by default
            const channelsList = Array.from(group.channelSet);

            return (
              <div 
                key={group.retailerId}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
              >
                
                {/* Retailer Card Master Header - Compact Single-Strip ERP Layout (Max height ~72-80px) */}
                <div 
                  onClick={() => toggleRetailerExpand(group.retailerId)}
                  className={`px-4 py-3 bg-white hover:bg-slate-50/80 ${isExpanded ? 'border-b border-slate-100' : ''} flex items-center justify-between gap-4 cursor-pointer select-none w-full transition-colors`}
                >
                  
                  {/* LEFT COLUMN: Identity & Inline Details (Horizontal) */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar Badge: Compact 36x36px */}
                    <div className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0 shadow-2xs">
                      {group.retailerName.charAt(0)}
                    </div>
                    
                    {/* Details Block (Horizontal 2-row layout) */}
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      {/* TOP ROW: Shop Name, Beat Badge, Ingestion Badges, Backorders */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm md:text-base font-bold text-slate-900 whitespace-nowrap">
                          {group.retailerName}
                        </h2>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium whitespace-nowrap shrink-0">
                          {group.city} &bull; {group.route}
                        </span>
                        {channelsList.map(ch => (
                          <span key={ch} className="text-[11px] font-semibold px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 whitespace-nowrap shrink-0">
                            {ch}
                          </span>
                        ))}
                        {group.hasPendingBackorders && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Backorders ({group.backorderPiecesTotal} pcs)</span>
                          </span>
                        )}
                      </div>

                      {/* BOTTOM ROW: Clean inline metadata line with bullet separators */}
                      <div className="text-xs text-slate-500 font-normal truncate flex items-center gap-1.5 flex-wrap">
                        <span>Prop: <span className="font-medium text-slate-700">{group.ownerName}</span></span>
                        <span>&bull;</span>
                        <span>Mob: <span className="font-medium text-slate-700">{group.phone}</span></span>
                        <span>&bull;</span>
                        <span>
                          Outstanding: <span className={`font-semibold ${group.currentOutstanding > 0 ? 'text-amber-700 font-medium' : 'text-slate-700'}`}>{formatINR(group.currentOutstanding)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MIDDLE COLUMN: Orders & Financial Summary */}
                  <div className="shrink-0 text-right pr-3 border-r border-slate-100 hidden sm:flex flex-col items-end justify-center">
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                      {group.totalOrdersCount} Orders &bull; {group.totalLineItemsCount} SKUs
                    </span>
                    <span className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
                      {formatINR(group.totalOrderValueSum)}
                    </span>
                  </div>

                  {/* RIGHT COLUMN: Action Buttons & Accordion Trigger */}
                  <div className="flex items-center gap-2 shrink-0">
                    
                    {/* Primary Consolidated Packing Floor CTA */}
                    {(group.pendingOrders.length > 0 || (activeStageTab === 'TO_PACK' && group.orders.length > 0) || (activeStageTab === 'ALL_ORDERS' && group.pendingOrders.length > 0)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetOrds = group.pendingOrders.length > 0 ? group.pendingOrders.map(o => o.order) : group.orders.map(o => o.order);
                          handleOpenPackingFloor(group.retailer, targetOrds, group.retailerBackorders);
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
                      >
                        <Package className="w-3.5 h-3.5 text-white" />
                        <span>Open Packing Floor</span>
                      </button>
                    )}

                    {/* Consolidated Actions for Packed Orders */}
                    {group.packedOrders.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBillingOverrideConsolidated(group.retailer, group.packedOrders.map(o => o.order));
                          }}
                          className="text-xs font-semibold px-2.5 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-teal-700" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateConsolidatedTaxInvoice(group.retailer, group.packedOrders.map(o => o.order));
                          }}
                          className="text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
                        >
                          <Receipt className="w-3.5 h-3.5 text-white" />
                          <span>Generate Invoice ({formatINR(group.totalPackedValueSum)})</span>
                        </button>
                      </div>
                    )}

                    {/* Primary Consolidated Action for Completed / Invoiced Orders */}
                    {(group.completedOrders.length > 0 || (activeStageTab === 'INVOICED' && group.orders.length > 0) || group.invoicesList.length > 0) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetOrds = group.completedOrders.length > 0 ? group.completedOrders.map(o => o.order) : group.orders.map(o => o.order);
                          handlePrintConsolidatedTaxInvoice(group.retailer, targetOrds);
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5 text-white" />
                        <span>Print Consolidated Tax Invoice</span>
                      </button>
                    )}

                    {/* Section Specific Batch Actions */}
                    {activeStageTab === 'PARTIAL_PENDING' && group.retailer && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBackorderResolution(group.retailer!, group.orders.map(o => o.order));
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Manage Backorders</span>
                      </button>
                    )}

                    {/* Accordion toggle arrow button */}
                    <div className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-colors ml-0.5 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                    </div>

                  </div>

                </div>

                {/* Expanded Individual Orders List */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {group.orders.map(ordRec => {
                      const ord = ordRec.order;
                      const inv = ordRec.invoice;
                      const isPacked = ord.status === 'Packed' || ord.status === 'PACKED_AND_SEALED';
                      const isPendingToPack = ord.status === 'Draft' || ord.status === 'Submitted' || ord.status === 'Under Review' || ord.status === 'Confirmed' || ord.status === 'Partially Confirmed' || (ord.status as string) === 'PENDING';
                      const isBackorder = ord.status === 'Partially Fulfilled' || (ord.status as string) === 'PARTIAL_PENDING' || ord.order_number?.includes('-BO') || ordRec.isPartial;

                      return (
                        <div 
                          key={ord.id}
                          className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          
                          {/* Order Identifier & Channel */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-black text-indigo-700">
                                {ord.order_number}
                              </span>

                              {/* Backorder Tag */}
                              {isBackorder && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-2xs flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-purple-200" />
                                  <span>BACKORDER</span>
                                </span>
                              )}

                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${ordRec.channel.badgeClass}`}>
                                {ordRec.channel.label}
                              </span>
                              
                              {/* Status Pill */}
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                ord.status === 'Completed' || ord.status === 'Fully Fulfilled'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : ord.status === 'Packed' || ord.status === 'PACKED_AND_SEALED'
                                  ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                  : ord.status === 'Partially Fulfilled' || (ord.status as string) === 'PARTIAL_PENDING' || ord.order_number?.includes('-BO')
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {ord.status}
                              </span>

                              {/* Payment Pill */}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ordRec.paymentStatus === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : ordRec.paymentStatus === 'Credit'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : ordRec.paymentStatus === 'Partial'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {ordRec.paymentStatus}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 font-medium">
                              Ordered: {ordRec.formattedDate} at {ordRec.formattedTime} &bull; Created By: {ordRec.salesperson?.name || 'Self-Booked'}
                            </p>
                          </div>

                          {/* Quantities & Items Breakdown */}
                          <div className="flex items-center gap-6 text-xs text-slate-600">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Booked Items</span>
                              <span className="font-extrabold text-slate-900 text-sm">
                                {ordRec.lineItemsCount} SKUs
                              </span>
                              <span className="text-slate-500 text-[11px] block">
                                ({ordRec.totalOrdered} Total Pcs)
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Order Value</span>
                              <span className="font-black text-slate-900 text-sm">
                                {formatINR(ord.total_amount)}
                              </span>
                              {inv && (
                                <span className="text-[10px] font-mono font-bold text-indigo-600 block">
                                  {inv.invoice_number}
                                </span>
                              )}
                            </div>

                            {ordRec.totalPending > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-amber-700 block uppercase">Shortage Pending</span>
                                <span className="font-black text-amber-800 text-sm">
                                  {ordRec.totalPending} Pcs
                                </span>
                                <span className="text-amber-700 text-[10px] font-bold block">
                                  ₹{Math.round(ordRec.pendingValue)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Stage-Specific Action CTAs: Child row only keeps Details */}
                          <div className="flex items-center gap-2 flex-wrap justify-end">

                            {/* Order Details Drawer Trigger */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderDetailId(ord.id);
                                setIsOrderDetailDrawerOpen(true);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Details</span>
                            </button>

                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS & DRAWERS */}
      {/* ========================================================================= */}
      
      {/* 1. Admin Packing Floor Modal (Section B) */}
      {isPackingFloorOpen && (packingFloorOrders.length > 0 || packingFloorBackorders.length > 0) ? (
        <AdminPackingFloorModal
          retailer={packingFloorRetailer}
          orders={packingFloorOrders}
          backorders={packingFloorBackorders}
          isOpen={isPackingFloorOpen}
          onClose={() => {
            setIsPackingFloorOpen(false);
            setPackingFloorRetailer(null);
            setPackingFloorOrders([]);
            setPackingFloorBackorders([]);
          }}
          onPackingComplete={(packedOrders, backorder) => {
            if (backorder) {
              alert(`Consolidated Packing Verified!\n• ${packedOrders.length} order(s) moved to Packed Orders.\n• Shortage rolled into Backorder ${backorder.order_number} in Partial Pending Orders.`);
            } else {
              alert(`Consolidated Packing Complete! All ${packedOrders.length} order(s) fully packed and moved to Packed Orders.`);
            }
          }}
        />
      ) : null}

      {/* 2. Admin Billing & Financial Overrides Modal (Section C) */}
      {isBillingOverrideOpen && (billingOverrideOrders.length > 0 || billingOverrideOrder) ? (
        <AdminBillingOverrideModal
          order={billingOverrideOrder}
          orders={billingOverrideOrders}
          retailer={billingOverrideRetailer}
          isOpen={isBillingOverrideOpen}
          onClose={() => {
            setIsBillingOverrideOpen(false);
            setBillingOverrideOrder(null);
            setBillingOverrideOrders([]);
            setBillingOverrideRetailer(null);
          }}
          onProceedToInvoice={(updatedOrder) => {
            handleOpenWorkflowModal(updatedOrder.id, 'invoice');
          }}
          onProceedToConsolidatedInvoice={(targetOrds, ret) => {
            handleGenerateConsolidatedTaxInvoice(ret, targetOrds);
          }}
        />
      ) : null}

      {/* 3. Backorder Resolution Modal (Section D) */}
      {isBackorderModalOpen && backorderRetailer && backorderList.length > 0 ? (
        <BackorderResolutionModal
          retailer={backorderRetailer}
          backorders={backorderList}
          isOpen={isBackorderModalOpen}
          onClose={() => {
            setIsBackorderModalOpen(false);
            setBackorderRetailer(null);
            setBackorderList([]);
          }}
        />
      ) : null}

      {/* 4. Full Order Processing Workflow Modal (Dispatch, DC, Invoicing, Ledger, Settlement) */}
      {processingOrderId && (
        <OrderProcessingWorkflowModal
          orderId={processingOrderId}
          isOpen={isProcessingModalOpen}
          initialStage={processingStage}
          onClose={() => {
            setIsProcessingModalOpen(false);
            setProcessingOrderId(null);
          }}
        />
      )}

      {/* 5. A4 Tax Invoice Print & Preview Modal (Section E) */}
      {selectedInvoiceForPreview && (
        <InvoicePreviewModal
          isOpen={isInvoicePreviewOpen}
          onClose={() => {
            setIsInvoicePreviewOpen(false);
            setSelectedInvoiceForPreview(null);
            setSelectedChallanForPreview(null);
            setSelectedRetailerForPreview(null);
          }}
          invoice={selectedInvoiceForPreview}
          challan={selectedChallanForPreview}
          retailer={selectedRetailerForPreview}
        />
      )}

      {/* 6. Order Detail Drawer */}
      <OrderDetailDrawer
        orderId={selectedOrderDetailId}
        isOpen={isOrderDetailDrawerOpen}
        onClose={() => {
          setIsOrderDetailDrawerOpen(false);
          setSelectedOrderDetailId(null);
        }}
      />

      {/* 7. Spot Order Modal */}
      <SpotOrderModal
        isOpen={isSpotOrderModalOpen}
        onClose={() => setIsSpotOrderModalOpen(false)}
      />

    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="py-24 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 font-mono tracking-wider">LOADING ADMIN ORDER PROCESSING COCKPIT...</p>
        </div>
      </div>
    }>
      <AdminOrdersContent />
    </Suspense>
  );
}
