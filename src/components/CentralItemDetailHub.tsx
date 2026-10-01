'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useDb } from '@/context/DbContext';
import { 
  Product, Inventory, InventoryBatch, Order, Invoice, Purchase, StockLedgerEntry, ItemActivityLog, Category,
  BaseUnit, TradeMode, formatQuantityDisplay, calculateBaseQuantity, splitBaseQuantity, getProductTradeMode, formatProductStockDisplay
} from '@/lib/db';
import { 
  Package, Edit3, ArrowLeft, Plus, CheckCircle2, XCircle, AlertTriangle, 
  Layers, ShoppingCart, FileText, FileSpreadsheet, DollarSign, History, 
  Boxes, Calendar, User, Tag, Clock, TrendingUp, ShieldCheck, ChevronRight,
  ChevronDown, ExternalLink, Search, Filter, RefreshCw, Barcode, Hash, Warehouse,
  Info, Check, X, ShieldAlert, ArrowUpRight, ArrowDownRight, Sparkles, SlidersHorizontal,
  MoreVertical, ArrowRight, Eye, ChevronUp
} from 'lucide-react';
import SmartSearchBar from '@/components/SmartSearchBar';

interface CentralItemDetailHubProps {
  productId: string;
  initialTab?: 'overview' | 'inventory' | 'purchases' | 'orders_billing' | 'more';
  initialSubTab?: 'details' | 'variants' | 'ledger' | 'activity' | 'categories' | 'orders' | 'billing';
  onBack?: () => void;
  onEdit?: (product: Product) => void;
  onAdjustStock?: (product: Product) => void;
  onAddVariant?: (product: Product) => void;
}

export default function CentralItemDetailHub({
  productId,
  initialTab = 'overview',
  initialSubTab,
  onBack,
  onEdit,
  onAdjustStock,
  onAddVariant
}: CentralItemDetailHubProps) {
  const {
    products,
    companies,
    suppliers,
    retailers,
    categories,
    inventory,
    batches,
    orders,
    invoices,
    purchases,
    ledger,
    itemActivityLogs,
    godowns,
    getConsolidatedInventory,
    updateProduct,
    toggleProductStatus,
    adjustStock,
    addItemActivityLog,
    createProductVariant,
    makePurchase,
    getCategoriesForProduct,
    getCategoryIdsForProduct,
    setProductCategories,
    profiles
  } = useDb();

  // 5 Main Tabs: 'overview' | 'inventory' | 'purchases' | 'orders_billing' | 'more'
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'purchases' | 'orders_billing' | 'more'>(initialTab);

  // Sub-tab inside "Orders & Billing": 'orders' | 'billing'
  const [ordersBillingSubTab, setOrdersBillingSubTab] = useState<'orders' | 'billing'>(
    initialSubTab === 'billing' ? 'billing' : 'orders'
  );

  // Sub-tab inside "More": 'details' | 'variants' | 'ledger' | 'activity' | 'categories'
  const [moreSubTab, setMoreSubTab] = useState<'details' | 'variants' | 'ledger' | 'activity' | 'categories'>(
    (initialSubTab && ['details', 'variants', 'ledger', 'activity', 'categories'].includes(initialSubTab))
      ? (initialSubTab as any)
      : 'details'
  );

  // Header "More Actions" Dropdown
  const [showMoreActionsMenu, setShowMoreActionsMenu] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setShowMoreActionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Expandable sections in Overview
  const [showLastRatesAccordion, setShowLastRatesAccordion] = useState(false);
  const [showStockBreakdownAccordion, setShowStockBreakdownAccordion] = useState(false);

  // Sub-filters inside tabs
  const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState('all');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [orderRetailerFilter, setOrderRetailerFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [billingCustomerFilter, setBillingCustomerFilter] = useState('all');
  const [billingSearch, setBillingSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [lastRatesRetailerFilter, setLastRatesRetailerFilter] = useState('all');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Current Product & Inventory
  const product = products.find(p => p.id === productId);
  const company = companies.find(c => c.id === product?.company_id);
  const inv = inventory.find(i => i.product_id === productId) || {
    id: `inv-${productId}`,
    product_id: productId,
    physical_qty: 0,
    reserved_qty: 0,
    available_qty: 0,
    damaged_qty: 0,
    expired_qty: 0,
    updated_at: new Date().toISOString()
  };

  const tradeMeta = useMemo(() => {
    return product ? getProductTradeMode(product) : { tradeMode: 'PIECES' as TradeMode, allowCarton: false, allowPieces: true, packSize: 1 };
  }, [product]);

  // Edit Form State
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [editError, setEditError] = useState('');

  // Stock Adjustment Form State
  const [adjDirection, setAdjDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjCartonQty, setAdjCartonQty] = useState(1);
  const [adjLooseQty, setAdjLooseQty] = useState(0);
  const [adjReason, setAdjReason] = useState('Physical Stock Audit Reconciliation');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjBatchNumber, setAdjBatchNumber] = useState('');
  const [adjError, setAdjError] = useState('');

  // Variant Form State
  const [varPackSize, setVarPackSize] = useState('');
  const [varAllowCarton, setVarAllowCarton] = useState(true);
  const [varAllowPieces, setVarAllowPieces] = useState(true);
  const [varPiecesPerCarton, setVarPiecesPerCarton] = useState(24);
  const [varLoosePriceMode, setVarLoosePriceMode] = useState<'auto' | 'manual'>('auto');
  const [varLooseSellingPrice, setVarLooseSellingPrice] = useState<number | undefined>(undefined);
  const [varMrp, setVarMrp] = useState(100);
  const [varSelling, setVarSelling] = useState(85);
  const [varPurchase, setVarPurchase] = useState(75);
  const [varDealer, setVarDealer] = useState<number | undefined>(undefined);
  const [varSku, setVarSku] = useState('');
  const [varBarcode, setVarBarcode] = useState('');
  const [varError, setVarError] = useState('');

  // Category Assignment State
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);

  // Add Purchase Modal State
  const [purSupplierId, setPurSupplierId] = useState('');
  const [purInvoiceNumber, setPurInvoiceNumber] = useState('');
  const [purInvoiceDate, setPurInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [purCartonQty, setPurCartonQty] = useState(10);
  const [purLooseQty, setPurLooseQty] = useState(0);
  const [purRate, setPurRate] = useState(product?.purchase_price || 95);
  const [purDiscount, setPurDiscount] = useState(0);
  const [purBatch, setPurBatch] = useState('');
  const [purExpiry, setPurExpiry] = useState('');
  const [purGodown, setPurGodown] = useState('Central Godown (Indore Hub)');
  const [purError, setPurError] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ----------------------------------------------------
  // COMPUTED ITEM-CENTRIC DATA & TRANSACTION HISTORIES
  // ----------------------------------------------------

  const assignedCategories = product ? getCategoriesForProduct(product.id) : [];

  const itemBatches = product
    ? batches
        .filter(b => b.product_id === product.id)
        .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
    : [];

  const familyVariants = product
    ? products.filter(p => 
        p.id === product.id || 
        p.parent_product_id === product.id || 
        (product.parent_product_id && (p.id === product.parent_product_id || p.parent_product_id === product.parent_product_id))
      )
    : [];

  // Purchases containing this item
  const itemPurchases = useMemo(() => {
    if (!product) return [];
    const list: Array<{
      purchaseId: string;
      invoiceNumber: string;
      invoiceDate: string;
      supplierId: string;
      supplierName: string;
      quantity: number;
      tradingUnit: string;
      purchaseRate: number;
      discount: number;
      gstPercent: number;
      mrp: number;
      totalAmount: number;
      batchNumber: string;
      expiryDate?: string;
      status: string;
      source: string;
      cartonQty: number;
      looseQty: number;
      baseUnit: string;
      isOpeningStock: boolean;
    }> = [];

    purchases.forEach(pur => {
      pur.items?.forEach(item => {
        if (item.product_id === product.id) {
          const supp = suppliers.find(s => s.id === pur.supplier_id);
          const unitsPerPack = item.units_per_box_carton || item.units_per_trading_unit || product.units_per_box_carton || 1;
          const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
          const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
          const cRate = item.purchase_rate;
          const lRate = item.loose_purchase_rate || (cRate / unitsPerPack);
          const rawTotal = (cQty * cRate) + (lQty * lRate);
          const gstAmt = rawTotal * ((item.gst_percent || product.gst_percent) / 100);
          const isOpeningStock = pur.invoice_number?.startsWith('OPENING-') || pur.id.startsWith('pur-init-');

          list.push({
            purchaseId: pur.id,
            invoiceNumber: pur.invoice_number || 'N/A',
            invoiceDate: pur.invoice_date || pur.created_at,
            supplierId: pur.supplier_id,
            supplierName: isOpeningStock ? (supp?.name || 'Opening Stock (Initial Inventory Setup)') : (supp?.name || 'Authorized FMCG Supplier'),
            quantity: item.quantity,
            tradingUnit: item.trading_unit || product.trading_unit,
            purchaseRate: item.purchase_rate,
            discount: item.discount || 0,
            gstPercent: item.gst_percent || product.gst_percent,
            mrp: item.mrp || product.mrp,
            totalAmount: Math.round((rawTotal + gstAmt) * 100) / 100,
            batchNumber: item.batch || 'BCH-DEFAULT',
            expiryDate: item.expiry_date,
            status: pur.status,
            source: isOpeningStock ? 'Opening Stock / Initial Purchase' : pur.invoice_number?.startsWith('AI-') ? 'AI Purchase Import' : 'Manual Inward',
            cartonQty: cQty,
            looseQty: lQty,
            baseUnit: product.base_unit || 'Piece',
            isOpeningStock
          });
        }
      });
    });

    return list.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [purchases, product, suppliers]);

  // Orders containing this item
  const itemOrders = useMemo(() => {
    if (!product) return [];
    const list: Array<{
      orderId: string;
      orderNumber: string;
      orderDate: string;
      retailerId: string;
      retailerName: string;
      city: string;
      salespersonName?: string;
      orderedQty: number;
      confirmedQty: number;
      fulfilledQty: number;
      pendingQty: number;
      cancelledQty: number;
      tradingUnit: string;
      rate: number;
      discount: number;
      gstPercent: number;
      status: Order['status'];
      totalAmount: number;
    }> = [];

    orders.forEach(ord => {
      ord.items?.forEach(item => {
        if (item.product_id === product.id) {
          const ret = retailers.find(r => r.id === ord.retailer_id);
          const ordered = item.quantity;
          const confirmed = item.confirmed_qty !== undefined ? item.confirmed_qty : ordered;
          const pending = item.pending_qty !== undefined ? item.pending_qty : 0;
          const cancelled = item.cancelled_qty !== undefined ? item.cancelled_qty : 0;
          const fulfilled = Math.max(0, confirmed - pending);
          const effectiveRate = item.order_time_rate || product.selling_price;
          const itemVal = ordered * (effectiveRate - (item.discount || 0));

          list.push({
            orderId: ord.id,
            orderNumber: ord.order_number,
            orderDate: ord.order_date,
            retailerId: ord.retailer_id,
            retailerName: ret?.shop_name || 'Retail Store',
            city: ret?.city || 'Mumbai',
            salespersonName: (() => {
              const spProfile = profiles?.find(p => p.id === ord.created_by || p.name === ord.created_by || p.email === ord.created_by);
              return spProfile?.name?.replace(/\s*\([^)]*\)/g, '')?.trim() || ord.created_by;
            })(),
            orderedQty: ordered,
            confirmedQty: confirmed,
            fulfilledQty: fulfilled,
            pendingQty: pending,
            cancelledQty: cancelled,
            tradingUnit: item.trading_unit || product.trading_unit,
            rate: effectiveRate,
            discount: item.discount || 0,
            gstPercent: product.gst_percent,
            status: ord.status,
            totalAmount: Math.round(itemVal * (1 + product.gst_percent / 100))
          });
        }
      });
    });

    return list.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, product, retailers]);

  // Billing / Invoices containing this item
  const itemInvoices = useMemo(() => {
    if (!product) return [];
    const list: Array<{
      invoiceId: string;
      invoiceNumber: string;
      date: string;
      retailerId: string;
      retailerName: string;
      quantity: number;
      tradingUnit: string;
      rate: number;
      discount: number;
      taxableValue: number;
      cgst: number;
      sgst: number;
      igst: number;
      grandTotal: number;
      batchNumber: string;
      paidAmount: number;
      outstandingAmount: number;
    }> = [];

    invoices.forEach(invRec => {
      invRec.items?.forEach(item => {
        if (item.product_id === product.id) {
          const ret = retailers.find(r => r.id === invRec.retailer_id);
          list.push({
            invoiceId: invRec.id,
            invoiceNumber: invRec.invoice_number,
            date: invRec.date,
            retailerId: invRec.retailer_id,
            retailerName: ret?.shop_name || 'Retail Customer',
            quantity: item.quantity,
            tradingUnit: item.trading_unit || product.trading_unit,
            rate: item.rate,
            discount: item.discount || 0,
            taxableValue: item.taxable_value,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst || 0,
            grandTotal: item.total_amount,
            batchNumber: (item as any).batch_number || 'BCH-2026-A1',
            paidAmount: invRec.paid_amount,
            outstandingAmount: invRec.outstanding_amount
          });
        }
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, product, retailers]);

  // Stock Movement Ledger
  const itemLedger = useMemo(() => {
    if (!product) return [];
    return ledger
      .filter(l => l.product_id === product.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ledger, product]);

  // Activity Audit Log
  const itemLogs = useMemo(() => {
    if (!product) return [];
    return itemActivityLogs
      .filter(l => l.product_id === product.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [itemActivityLogs, product]);

  // Last 5 Billed Rates
  const lastFiveBilledRates = useMemo(() => {
    let pool = itemInvoices;
    if (lastRatesRetailerFilter !== 'all') {
      pool = pool.filter(i => i.retailerId === lastRatesRetailerFilter);
    }
    return pool.slice(0, 5);
  }, [itemInvoices, lastRatesRetailerFilter]);

  // Statistics
  const totalPurchasedQty = itemPurchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalPurchasedValue = itemPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const avgPurchaseRate = itemPurchases.length > 0 
    ? Math.round((itemPurchases.reduce((sum, p) => sum + p.purchaseRate, 0) / itemPurchases.length) * 100) / 100 
    : (product ? product.purchase_price : 0);

  const totalSoldQty = itemInvoices.reduce((sum, i) => sum + i.quantity, 0);
  const totalSoldRevenue = itemInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
  const avgBilledRate = itemInvoices.length > 0
    ? Math.round((itemInvoices.reduce((sum, i) => sum + i.rate, 0) / itemInvoices.length) * 100) / 100
    : (product ? product.selling_price : 0);

  const totalOrderedQty = itemOrders.reduce((sum, o) => sum + o.orderedQty, 0);
  const totalFulfilledQty = itemOrders.reduce((sum, o) => sum + o.fulfilledQty, 0);
  const totalPendingBackorderQty = itemOrders.reduce((sum, o) => sum + o.pendingQty, 0);

  const lastPurchase = itemPurchases[0];
  const lastOrder = itemOrders[0];
  const lastInvoice = itemInvoices[0];
  const lastAdjustment = itemLedger.find(l => l.reason.toLowerCase().includes('adjustment') || l.reason.toLowerCase().includes('audit'));

  // Margins
  const grossMarginRupees = product ? Math.round((product.selling_price - product.purchase_price) * 100) / 100 : 0;
  const grossMarginPercent = product && product.selling_price > 0 
    ? Math.round(((product.selling_price - product.purchase_price) / product.selling_price) * 1000) / 10 
    : 0;

  // Recent combined activities (Max 5)
  const recentActivities = useMemo(() => {
    if (!product) return [];
    const list: Array<{
      id: string;
      type: 'purchase' | 'order' | 'billing' | 'adjustment';
      title: string;
      date: string;
      details: string;
      tag: string;
      tagColor: string;
    }> = [];

    if (lastPurchase) {
      list.push({
        id: `pur-${lastPurchase.purchaseId}`,
        type: 'purchase',
        title: lastPurchase.isOpeningStock ? `Opening Stock Inward` : `Purchase: ${lastPurchase.supplierName}`,
        date: lastPurchase.invoiceDate,
        details: `${lastPurchase.quantity} ${product.trading_unit}s @ ₹${lastPurchase.purchaseRate} (Ref: ${lastPurchase.invoiceNumber})`,
        tag: lastPurchase.isOpeningStock ? 'Opening Stock' : 'Inward Purchase',
        tagColor: lastPurchase.isOpeningStock ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
      });
    }

    if (lastOrder) {
      list.push({
        id: `ord-${lastOrder.orderId}`,
        type: 'order',
        title: `Order: ${lastOrder.retailerName}`,
        date: lastOrder.orderDate,
        details: `${lastOrder.orderedQty} ${product.trading_unit}s @ ₹${lastOrder.rate} (${lastOrder.status})`,
        tag: 'Sales Order',
        tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      });
    }

    if (lastInvoice) {
      list.push({
        id: `inv-${lastInvoice.invoiceId}`,
        type: 'billing',
        title: `Tax Invoice: ${lastInvoice.retailerName}`,
        date: lastInvoice.date,
        details: `${lastInvoice.quantity} ${product.trading_unit}s billed @ ₹${lastInvoice.rate} (₹${lastInvoice.grandTotal.toLocaleString()})`,
        tag: 'Billed',
        tagColor: 'bg-amber-50 text-amber-800 border-amber-200'
      });
    }

    if (lastAdjustment) {
      list.push({
        id: `adj-${lastAdjustment.id}`,
        type: 'adjustment',
        title: `Stock Adjustment: ${lastAdjustment.reason}`,
        date: lastAdjustment.created_at,
        details: `${lastAdjustment.direction === 'IN' ? '+' : ''}${lastAdjustment.change_qty} ${product.trading_unit}s (${lastAdjustment.direction === 'IN' ? 'Stock IN' : 'Stock OUT'})`,
        tag: 'Adjustment',
        tagColor: 'bg-slate-100 text-slate-700 border-slate-200'
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [lastPurchase, lastOrder, lastInvoice, lastAdjustment, product]);

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  const handleOpenEdit = () => {
    if (!product) return;
    const meta = getProductTradeMode(product);
    setEditForm({
      ...product,
      name: product.name,
      product_code: product.product_code,
      sku: product.sku,
      barcode: product.barcode,
      company_id: product.company_id,
      brand: product.brand,
      description: product.description || '',
      pack_size: product.pack_size,
      trade_mode: meta.tradeMode,
      allow_carton: meta.allowCarton,
      allow_pieces: meta.allowPieces,
      pieces_per_carton: meta.packSize,
      trading_unit: meta.tradeMode === 'PIECES' ? 'Piece' : 'Carton',
      base_unit: 'Piece',
      units_per_box_carton: meta.packSize,
      units_per_trading_unit: meta.packSize,
      allow_loose_sale: meta.allowPieces,
      loose_price_mode: product.loose_price_mode || 'auto',
      loose_selling_price: product.loose_selling_price,
      loose_mrp: product.loose_mrp,
      loose_purchase_price: product.loose_purchase_price,
      carton_discount: product.carton_discount || 0,
      loose_discount: product.loose_discount || 0,
      mrp: product.mrp,
      selling_price: product.selling_price,
      purchase_price: product.purchase_price,
      dealer_price: product.dealer_price,
      gst_percent: product.gst_percent,
      hsn: product.hsn,
      min_stock_level: product.min_stock_level || 5,
      reorder_level: product.reorder_level || 10,
      batch_tracking_enabled: product.batch_tracking_enabled !== false,
      expiry_tracking_enabled: product.expiry_tracking_enabled !== false,
      active: product.active
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!editForm.name?.trim()) {
      setEditError('Product name is required');
      return;
    }
    if (!editForm.selling_price || editForm.selling_price <= 0) {
      setEditError('Valid distributor selling price is required');
      return;
    }
    if (!editForm.mrp || editForm.mrp <= 0) {
      setEditError('Valid MRP is required');
      return;
    }

    const allowCarton = editForm.allow_carton !== false && (editForm.allow_carton || editForm.trade_mode === 'CARTONS' || editForm.trade_mode === 'BOTH');
    const allowPieces = editForm.allow_pieces !== false && (editForm.allow_pieces || editForm.trade_mode === 'PIECES' || editForm.trade_mode === 'BOTH');

    if (!allowCarton && !allowPieces) {
      setEditError('Please select at least one Trading Unit: Carton/Box or Pieces');
      return;
    }

    const tradeMode: TradeMode = allowCarton && allowPieces ? 'BOTH' : allowCarton ? 'CARTONS' : 'PIECES';
    const packSize = allowCarton ? Math.max(1, editForm.pieces_per_carton || editForm.units_per_box_carton || 1) : 1;

    try {
      updateProduct(product.id, {
        ...editForm,
        name: editForm.name.trim(),
        trade_mode: tradeMode,
        allow_carton: allowCarton,
        allow_pieces: allowPieces,
        pieces_per_carton: packSize,
        units_per_box_carton: packSize,
        units_per_trading_unit: packSize,
        pack_size: tradeMode === 'PIECES' ? '1 Piece' : `${packSize} Pieces/Ctn`,
        trading_unit: tradeMode === 'PIECES' ? 'Piece' : 'Carton',
        base_unit: 'Piece',
        allow_loose_sale: allowPieces,
        sku: editForm.sku?.trim() || product.sku,
        barcode: editForm.barcode?.trim() || product.barcode,
        hsn: editForm.hsn?.trim() || product.hsn,
        description: editForm.description?.trim(),
        packing_display: tradeMode === 'PIECES' ? '1 Piece' : `${packSize} Pieces/Ctn`
      });
      setShowEditModal(false);
      showToast('Item details saved successfully.');
    } catch (err: any) {
      setEditError(err.message || 'Failed to update product details');
    }
  };

  const handleOpenPurchaseModal = () => {
    if (!product) return;
    const meta = getProductTradeMode(product);
    setPurSupplierId(suppliers[0]?.id || '');
    setPurInvoiceNumber(`PUR-${Date.now().toString().slice(-4)}`);
    setPurInvoiceDate(new Date().toISOString().split('T')[0]);
    setPurCartonQty(meta.tradeMode === 'PIECES' ? 0 : 10);
    setPurLooseQty(meta.tradeMode === 'PIECES' ? 50 : 0);
    setPurRate(product.purchase_price || 95);
    setPurDiscount(0);
    setPurBatch(`BCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setPurExpiry(d.toISOString().split('T')[0]);
    setPurError('');
    setShowPurchaseModal(true);
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!purSupplierId) {
      setPurError('Please select a supplier');
      return;
    }
    const meta = getProductTradeMode(product);
    const unitsPerPack = meta.packSize;
    const totalBaseUnits = meta.tradeMode === 'PIECES' 
      ? purLooseQty 
      : calculateBaseQuantity(purCartonQty, purLooseQty, unitsPerPack);

    if (totalBaseUnits <= 0) {
      setPurError(meta.tradeMode === 'PIECES' ? 'Please enter a valid piece quantity' : 'Please enter a valid carton or loose quantity');
      return;
    }
    if (!purRate || purRate <= 0) {
      setPurError('Please enter a valid purchase rate');
      return;
    }

    const looseRate = meta.tradeMode === 'PIECES' ? purRate : (purRate / unitsPerPack);
    const grossAmount = meta.tradeMode === 'PIECES' 
      ? (purLooseQty * purRate)
      : ((purCartonQty * purRate) + (purLooseQty * looseRate));
    const gstAmt = grossAmount * ((product.gst_percent || 18) / 100);
    const totalAmt = Math.round(grossAmount + gstAmt);

    try {
      makePurchase({
        supplier_id: purSupplierId,
        invoice_number: purInvoiceNumber.trim() || `PUR-${Date.now()}`,
        invoice_date: purInvoiceDate,
        total_amount: totalAmt,
        items: [
          {
            product_id: product.id,
            carton_qty: meta.tradeMode === 'PIECES' ? 0 : purCartonQty,
            loose_qty: meta.tradeMode === 'PIECES' ? purLooseQty : purLooseQty,
            base_qty: totalBaseUnits,
            quantity: totalBaseUnits,
            carton_rate: purRate,
            purchase_rate: purRate,
            loose_rate: looseRate,
            discount: purDiscount || 0,
            free_quantity: 0,
            mrp: product.mrp,
            gst_percent: product.gst_percent,
            hsn: product.hsn,
            batch: purBatch.trim() || `BCH-${Date.now().toString().slice(-4)}`,
            expiry_date: purExpiry || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
            trading_unit: meta.tradeMode === 'PIECES' ? 'Piece' : 'Carton',
            base_unit: 'Piece'
          }
        ]
      });

      setShowPurchaseModal(false);
      showToast(`Purchase recorded: +${formatProductStockDisplay(totalBaseUnits, product, true)} added to stock.`);
    } catch (err: any) {
      setPurError(err.message || 'Failed to record purchase');
    }
  };

  const handleOpenStockModal = () => {
    if (!product) return;
    const meta = getProductTradeMode(product);
    setAdjDirection('IN');
    setAdjCartonQty(meta.tradeMode === 'PIECES' ? 0 : 1);
    setAdjLooseQty(meta.tradeMode === 'PIECES' ? 10 : 0);
    setAdjReason('Physical Stock Audit Reconciliation');
    setAdjNotes('');
    setAdjBatchNumber('');
    setAdjError('');
    setShowStockModal(true);
  };

  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const meta = getProductTradeMode(product);
    const unitsPerPack = meta.packSize;
    const totalBase = meta.tradeMode === 'PIECES'
      ? adjLooseQty
      : calculateBaseQuantity(adjCartonQty, adjLooseQty, unitsPerPack);

    if (totalBase <= 0) {
      setAdjError('Please enter a valid quantity greater than zero');
      return;
    }

    try {
      adjustStock(
        product.id,
        totalBase,
        adjDirection,
        adjReason,
        adjNotes,
        adjBatchNumber || undefined,
        undefined,
        meta.tradeMode === 'PIECES' ? 0 : adjCartonQty,
        meta.tradeMode === 'PIECES' ? adjLooseQty : adjLooseQty
      );
      setShowStockModal(false);
      setAdjCartonQty(meta.tradeMode === 'PIECES' ? 0 : 1);
      setAdjLooseQty(meta.tradeMode === 'PIECES' ? 10 : 0);
      setAdjNotes('');
      const formattedQty = formatProductStockDisplay(totalBase, product, true);
      showToast(`Stock adjusted successfully: ${adjDirection === 'IN' ? '+' : '-'}${formattedQty}`);
    } catch (err: any) {
      setAdjError(err.message || 'Stock adjustment failed');
    }
  };

  const handleCreateVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!varPackSize.trim()) {
      setVarError('Variant name / description is required');
      return;
    }
    if (!varAllowCarton && !varAllowPieces) {
      setVarError('Please select at least one Trading Unit: Carton/Box or Pieces');
      return;
    }
    if (!varMrp || varMrp <= 0) {
      setVarError('Valid MRP is required');
      return;
    }

    const tradeMode: TradeMode = varAllowCarton && varAllowPieces ? 'BOTH' : varAllowCarton ? 'CARTONS' : 'PIECES';
    const packSize = varAllowCarton ? Math.max(1, varPiecesPerCarton || 1) : 1;

    try {
      const newVar = createProductVariant(product.id, {
        pack_size: tradeMode === 'PIECES' ? varPackSize.trim() : `${packSize} Pieces/Ctn`,
        trading_unit: tradeMode === 'PIECES' ? 'Piece' : 'Carton',
        base_unit: 'Piece',
        trade_mode: tradeMode,
        allow_carton: varAllowCarton,
        allow_pieces: varAllowPieces,
        pieces_per_carton: packSize,
        units_per_box_carton: packSize,
        units_per_trading_unit: packSize,
        allow_loose_sale: varAllowPieces,
        loose_price_mode: varLoosePriceMode,
        loose_selling_price: varLooseSellingPrice,
        mrp: varMrp,
        selling_price: varSelling,
        purchase_price: varPurchase,
        dealer_price: varDealer,
        sku: varSku.trim() || undefined,
        barcode: varBarcode.trim() || undefined
      });
      setShowVariantModal(false);
      setVarPackSize('');
      showToast(`Variant "${newVar.name}" created successfully.`);
    } catch (err: any) {
      setVarError(err.message || 'Failed to create variant');
    }
  };

  const handleOpenCategories = () => {
    if (!product) return;
    setSelectedCatIds(getCategoryIdsForProduct(product.id));
    setShowCategoryModal(true);
  };

  const handleSaveCategories = () => {
    if (!product) return;
    setProductCategories(product.id, selectedCatIds);
    const catNames = categories
      .filter(c => selectedCatIds.includes(c.id))
      .map(c => c.name);
    addItemActivityLog({
      product_id: product.id,
      action: 'Category Assignments Modified',
      details: catNames.length > 0 ? `Assigned to: ${catNames.join(', ')}` : 'Removed from all categories'
    });
    setShowCategoryModal(false);
    showToast('Category tags updated successfully.');
  };

  // If not mounted yet, render loading skeleton to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="space-y-6 pb-20 animate-pulse">
        <div className="h-28 bg-slate-200 rounded-2xl"></div>
        <div className="h-12 bg-slate-200 rounded-2xl"></div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  // If product not found
  if (!product) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Product Not Found</h3>
        <p className="text-xs text-slate-500">The product you are looking for does not exist or has been removed.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Back to Item Master
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top duration-150 ${
          toast.type === 'success' 
            ? 'bg-slate-900 text-white border-slate-700' 
            : 'bg-rose-900 text-white border-rose-700'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* ========================================================
          1. CLEAN ITEM HEADER (Maximum 2 Primary Buttons + More Actions)
          ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Product Identity & Core Attributes */}
          <div className="flex items-start gap-3.5">
            {onBack && (
              <button
                onClick={onBack}
                className="mt-0.5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex items-center justify-center cursor-pointer"
                title="Back to Item Master"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
              <Package className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{product.name}</h1>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                  MRP: ₹{product.mrp}
                </span>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                  product.active
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 border-slate-300 text-slate-500'
                }`}>
                  {product.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Minimal essential subtitle */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{company?.name || product.brand}</span>
                <span>•</span>
                <span>SKU: <strong className="font-mono text-slate-800">{product.sku}</strong></span>
                <span>•</span>
                <span>Pack: <strong className="text-slate-800">{product.pack_size}</strong></span>
              </div>

              {/* Key badges: Available Stock & Selling Price & Unit Info */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-baseline gap-1 text-xs">
                  <span className="text-slate-500 font-medium">Available:</span>
                  <span className={`font-black text-sm ${inv.available_qty <= (product.reorder_level || 10) ? 'text-amber-600' : 'text-slate-900'}`}>
                    {formatProductStockDisplay(inv.available_qty, product, true)}
                  </span>
                </div>

                {tradeMeta.allowCarton && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    <div className="flex items-baseline gap-1 text-xs">
                      <span className="text-slate-500 font-medium">Carton Rate:</span>
                      <span className="font-black text-indigo-700 text-sm">₹{product.selling_price}</span>
                      <span className="text-xs text-slate-500">/Carton</span>
                    </div>
                  </>
                )}

                {tradeMeta.allowPieces && tradeMeta.allowCarton && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    <div className="flex items-baseline gap-1 text-xs">
                      <span className="text-slate-500 font-medium">Loose Rate:</span>
                      <span className="font-black text-emerald-700 text-sm">
                        ₹{product.loose_selling_price || (product.selling_price / (tradeMeta.packSize || 1)).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">/Piece</span>
                    </div>
                  </>
                )}

                {tradeMeta.tradeMode === 'PIECES' && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    <div className="flex items-baseline gap-1 text-xs">
                      <span className="text-slate-500 font-medium">Selling Rate:</span>
                      <span className="font-black text-indigo-700 text-sm">₹{product.selling_price}</span>
                      <span className="text-xs text-slate-500">/Piece</span>
                    </div>
                  </>
                )}

                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                <div className="flex items-baseline gap-1 text-xs">
                  <span className="text-slate-500 font-medium">MRP:</span>
                  <span className="font-bold text-slate-800">₹{product.mrp}</span>
                </div>

                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                {tradeMeta.tradeMode === 'PIECES' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
                    Pieces Only
                  </span>
                ) : tradeMeta.tradeMode === 'CARTONS' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-300">
                    Carton Only
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-50 text-indigo-800 border border-indigo-300">
                    Dual: Ctn + Pcs
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Exactly 2 Primary Buttons + More Actions Menu */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {/* Primary Button 1: Edit Item */}
            <button
              onClick={handleOpenEdit}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Item</span>
            </button>

            {/* Primary Button 2: Add Purchase */}
            <button
              onClick={handleOpenPurchaseModal}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>Add Purchase</span>
            </button>

            {/* More Actions Dropdown Menu */}
            <div className="relative" ref={moreActionsRef}>
              <button
                onClick={() => setShowMoreActionsMenu(!showMoreActionsMenu)}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
                title="More Actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreActionsMenu && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs font-semibold animate-in fade-in zoom-in-95 duration-100 text-left">
                  <button
                    onClick={() => {
                      setShowMoreActionsMenu(false);
                      handleOpenStockModal();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Boxes className="w-4 h-4 text-slate-500" />
                    <span>Adjust Stock</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreActionsMenu(false);
                      setVarPackSize('');
                      setVarAllowCarton(tradeMeta.allowCarton);
                      setVarAllowPieces(tradeMeta.allowPieces);
                      setVarPiecesPerCarton(tradeMeta.packSize || 24);
                      setVarLoosePriceMode(product.loose_price_mode || 'auto');
                      setVarLooseSellingPrice(product.loose_selling_price);
                      setVarMrp(product.mrp);
                      setVarSelling(product.selling_price);
                      setVarPurchase(product.purchase_price);
                      setVarDealer(product.dealer_price);
                      setVarError('');
                      setShowVariantModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span>Add Variant</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreActionsMenu(false);
                      setSelectedCatIds(getCategoryIdsForProduct(product.id));
                      setShowCategoryModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Tag className="w-4 h-4 text-slate-500" />
                    <span>Manage Categories</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button
                    onClick={() => {
                      setShowMoreActionsMenu(false);
                      toggleProductStatus(product.id);
                      showToast(`Product ${product.active ? 'deactivated' : 'activated'}.`);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    {product.active ? (
                      <>
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span className="text-rose-600">Deactivate Item</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-600">Activate Item</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5 Main Tabs Navigation Bar */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-4 pt-3 overflow-x-auto text-xs font-bold">
          {[
            { id: 'overview', name: 'Overview', icon: FileText, count: null },
            { id: 'inventory', name: 'Stock & Batches', icon: Boxes, count: itemBatches.length },
            { id: 'purchases', name: 'Purchases', icon: Warehouse, count: itemPurchases.length },
            { id: 'orders_billing', name: 'Orders & Billing', icon: ShoppingCart, count: itemOrders.length + itemInvoices.length },
            { id: 'more', name: 'Details & History', icon: History, count: null }
          ].map(tab => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isCurrent 
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200/60 font-black' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                    isCurrent ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          TAB 1: OVERVIEW (Max 6 compact summary cards + Recent Activity)
          ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Max 6 Compact Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Available Stock */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Available Stock</span>
              <div className="mt-1">
                <span className={`text-sm font-black block leading-tight ${inv.available_qty <= (product.reorder_level || 10) ? 'text-amber-600' : 'text-slate-900'}`}>
                  {formatProductStockDisplay(inv.available_qty, product, true)}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">Ready to sell</span>
            </div>

            {/* 2. Physical Stock */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Physical Stock</span>
              <div className="mt-1">
                <span className="text-sm font-black text-slate-900 block leading-tight">
                  {formatProductStockDisplay(inv.physical_qty, product, true)}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">In godowns</span>
            </div>

            {/* 3. Reserved Stock */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Reserved Stock</span>
              <div className="mt-1">
                <span className="text-sm font-black text-amber-600 block leading-tight">
                  {formatProductStockDisplay(inv.reserved_qty, product, true)}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">Packed in orders</span>
            </div>

            {/* 4. Last Purchase Rate */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Last Purchase Rate</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-slate-900">
                  {lastPurchase ? `₹${lastPurchase.purchaseRate}` : `₹${product.purchase_price}`}
                </span>
                <span className="text-xs text-slate-500">/{tradeMeta.tradeMode === 'PIECES' ? 'Piece' : 'Carton'}</span>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5 truncate">
                {lastPurchase ? new Date(lastPurchase.invoiceDate).toLocaleDateString() : 'Baseline cost'}
              </span>
            </div>

            {/* 5. Last Billed Rate */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Last Billed Rate</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-indigo-700">
                  {lastInvoice ? `₹${lastInvoice.rate}` : `₹${product.selling_price}`}
                </span>
                <span className="text-xs text-slate-500">/{tradeMeta.tradeMode === 'PIECES' ? 'Piece' : 'Carton'}</span>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5 truncate">
                {lastInvoice ? new Date(lastInvoice.date).toLocaleDateString() : 'Catalogue rate'}
              </span>
            </div>

            {/* 6. Current Margin / Selling Price */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Selling Margin</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black text-emerald-700">₹{grossMarginRupees}</span>
                <span className="text-xs font-bold text-emerald-700">({grossMarginPercent}%)</span>
              </div>
              <span className="text-xs text-slate-500 font-medium block mt-0.5">₹{product.selling_price} selling</span>
            </div>
          </div>

          {/* Recent Activity (Max 5 records) with Direct Quick Jump Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
                <p className="text-xs text-slate-500 font-medium">Latest transactions and movements for this product</p>
              </div>

              {/* Direct Quick Jump Action Links */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTab('purchases')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  View All Purchases
                </button>
                <button
                  onClick={() => {
                    setActiveTab('orders_billing');
                    setOrdersBillingSubTab('orders');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  View All Orders
                </button>
                <button
                  onClick={() => {
                    setActiveTab('orders_billing');
                    setOrdersBillingSubTab('billing');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  View All Billing
                </button>
                <button
                  onClick={() => {
                    setActiveTab('more');
                    setMoreSubTab('ledger');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  View Stock Movement
                </button>
              </div>
            </div>

            {recentActivities.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                No recent transactions recorded for this item.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivities.map(act => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${act.tagColor}`}>
                        {act.tag}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">{act.title}</p>
                        <p className="text-xs text-slate-500 font-medium">{act.details}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
                      {new Date(act.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expandable Quick Section: View Last 5 Billed Rates */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              onClick={() => setShowLastRatesAccordion(!showLastRatesAccordion)}
              className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50/70 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">Quick Rate Intelligence: View Last 5 Billed Rates</span>
                <span className="text-xs text-slate-500 font-normal">(Click to expand)</span>
              </div>
              {showLastRatesAccordion ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showLastRatesAccordion && (
              <div className="p-4 border-t border-slate-100 space-y-3">
                {lastFiveBilledRates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No historical invoices recorded for this product yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Customer / Retailer</th>
                          <th className="pb-2">Invoice #</th>
                          <th className="pb-2">Qty</th>
                          <th className="pb-2">Billing Rate</th>
                          <th className="pb-2">Discount</th>
                          <th className="pb-2">Net Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lastFiveBilledRates.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 text-slate-600">{new Date(rec.date).toLocaleDateString()}</td>
                            <td className="py-2 font-semibold text-slate-800">{rec.retailerName}</td>
                            <td className="py-2 font-mono text-indigo-600 font-bold">{rec.invoiceNumber}</td>
                            <td className="py-2 font-bold text-slate-700">{rec.quantity} {rec.tradingUnit}s</td>
                            <td className="py-2 font-bold text-slate-900">₹{rec.rate}</td>
                            <td className="py-2 text-slate-500 font-medium">{rec.discount ? `₹${rec.discount}` : '-'}</td>
                            <td className="py-2 font-black text-emerald-700">₹{(rec.rate - (rec.discount || 0)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: INVENTORY (Focus ONLY on Stock, Batches & Adjustments)
          ======================================================== */}
      {activeTab === 'inventory' && (
        <div className="space-y-5">
          {/* Stock Summary Metrics */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Stock Status Summary</h3>
                <p className="text-xs text-slate-500 font-medium">Live inventory counts and warehouse allocations</p>
              </div>

              {/* Primary Inventory Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAdjDirection('IN');
                    setAdjCartonQty(1);
                    setAdjLooseQty(0);
                    setAdjError('');
                    setShowStockModal(true);
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Boxes className="w-4 h-4" />
                  <span>Adjust Stock</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('more');
                    setMoreSubTab('ledger');
                  }}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  View Stock Movement
                </button>
              </div>
            </div>

            {/* 6 Clean Stock Count Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase block">Physical Stock</span>
                <p className="text-sm font-black text-slate-900 mt-0.5">{formatProductStockDisplay(inv.physical_qty, product, true)}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase block">Reserved Stock</span>
                <p className="text-sm font-black text-amber-600 mt-0.5">{formatProductStockDisplay(inv.reserved_qty, product, true)}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase block">Available Stock</span>
                <p className="text-sm font-black text-emerald-600 mt-0.5">{formatProductStockDisplay(inv.available_qty, product, true)}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase block">Damaged Stock</span>
                <p className="text-sm font-black text-rose-600 mt-0.5">{formatProductStockDisplay(inv.damaged_qty || 0, product, true)}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase block">Expired Stock</span>
                <p className="text-sm font-black text-slate-600 mt-0.5">{formatProductStockDisplay(inv.expired_qty || 0, product, true)}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-xs font-bold text-slate-500 uppercase block">Pending Backorders</span>
                <p className="text-sm font-black text-indigo-700 mt-0.5">{formatProductStockDisplay(totalPendingBackorderQty, product, true)}</p>
              </div>
            </div>

            {/* Multi-Godown Stock Location Breakdown Table */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Multi-Godown Stock Distribution ({godowns.length} Facilities)
                  </h4>
                </div>
                <Link
                  href="/admin/inventory?tab=transfers"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <span>Transfer Stock</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3">Godown Location</th>
                      <th className="py-2.5 px-3 text-center">Physical Stock</th>
                      <th className="py-2.5 px-3 text-center">Reserved</th>
                      <th className="py-2.5 px-3 text-center">Available Stock</th>
                      <th className="py-2.5 px-3 text-center">Damaged / Exp</th>
                      <th className="py-2.5 px-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {godowns.map(g => {
                      const gInv = inventory.find(i => i.product_id === productId && i.godown_id === g.id);
                      const physical = gInv ? gInv.physical_qty : 0;
                      const reserved = gInv ? gInv.reserved_qty : 0;
                      const available = gInv ? gInv.available_qty : 0;
                      const bad = gInv ? (gInv.damaged_qty + gInv.expired_qty) : 0;
                      const totalConsPhysical = getConsolidatedInventory().find(c => c.product_id === productId)?.physical_qty || 1;
                      const sharePct = totalConsPhysical > 0 ? Math.round((physical / totalConsPhysical) * 100) : 0;

                      return (
                        <tr key={g.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{g.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">[{g.code}]</span>
                              {g.is_default && (
                                <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">{g.city || 'Central Location'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-slate-800">
                            {formatQuantityDisplay(physical, product.units_per_box_carton || 1, product.trading_unit, product.base_unit || 'Piece')}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                            {reserved > 0 ? (
                              <span className="text-indigo-600 font-bold">
                                {formatQuantityDisplay(reserved, product.units_per_box_carton || 1, product.trading_unit, product.base_unit || 'Piece')}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              available <= 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                            }`}>
                              {formatQuantityDisplay(available, product.units_per_box_carton || 1, product.trading_unit, product.base_unit || 'Piece')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {bad > 0 ? (
                              <span className="text-red-600 font-bold">
                                {formatQuantityDisplay(bad, product.units_per_box_carton || 1, product.trading_unit, product.base_unit || 'Piece')}
                              </span>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-bold text-slate-700">
                              <span>{sharePct}%</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${sharePct}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Batch-wise Stock Table (Only when batch tracking is enabled) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Batch-wise Inventory ({itemBatches.length})</h4>
                <p className="text-xs text-slate-500 font-medium">Active batch lots with FIFO expiry dates and godown locations</p>
              </div>
            </div>

            {itemBatches.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                No active batch consignments recorded for this product.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50/50">
                      <th className="p-2.5">Batch Number</th>
                      <th className="p-2.5">Godown Location</th>
                      <th className="p-2.5">Inward Date</th>
                      <th className="p-2.5">Expiry Date</th>
                      <th className="p-2.5">Cost Price</th>
                      <th className="p-2.5">Batch Stock</th>
                      <th className="p-2.5">Expiry Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemBatches.map(b => {
                      const expDate = new Date(b.expiry_date);
                      const now = new Date();
                      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysLeft <= 0;
                      const isExpiringSoon = daysLeft > 0 && daysLeft <= 60;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-indigo-700">{b.batch_number}</td>
                          <td className="p-2.5 text-slate-700 font-medium">{b.godown || 'Central Godown (Indore Hub)'}</td>
                          <td className="p-2.5 text-slate-600">{b.entry_date || 'N/A'}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{b.expiry_date}</td>
                          <td className="p-2.5 font-bold text-slate-800">₹{b.purchase_rate}</td>
                          <td className="p-2.5 font-black text-slate-900">
                            {formatQuantityDisplay(b.quantity, product.units_per_box_carton || 24, product.trading_unit, product.base_unit, true)}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              isExpired 
                                ? 'bg-rose-100 text-rose-700' 
                                : isExpiringSoon 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isExpired ? 'Expired' : isExpiringSoon ? `${daysLeft}d left` : 'Healthy'}
                            </span>
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

      {/* ========================================================
          TAB 3: PURCHASES
          ======================================================== */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Purchase History</h3>
              <p className="text-xs text-slate-500 font-medium">All vendor consignments and inward purchase entries</p>
            </div>

            {/* Quick Metrics Ribbon & Record Purchase Button */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
                <span>Inward: <strong className="text-slate-900 font-bold">{totalPurchasedQty} {product.trading_unit}s</strong></span>
                <span>•</span>
                <span>Avg Cost: <strong className="text-slate-900 font-bold">₹{avgPurchaseRate}</strong></span>
              </div>

              <button
                onClick={handleOpenPurchaseModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Purchase</span>
              </button>
            </div>
          </div>

          {/* Search & Supplier Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
            <div className="w-full sm:max-w-xs">
              <SmartSearchBar
                value={purchaseSearch}
                onChange={setPurchaseSearch}
                placeholder="Search invoice or batch..."
                size="sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-600 uppercase">Supplier:</span>
              <select
                value={purchaseSupplierFilter}
                onChange={(e) => setPurchaseSupplierFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Purchases Table (Essential Columns Only) */}
          {itemPurchases.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
              No purchase records found for this product.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50/50">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Purchase Ref #</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5">Inward Quantity</th>
                    <th className="p-2.5">Purchase Rate</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Source / Type</th>
                    <th className="p-2.5">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemPurchases
                    .filter(p => {
                      const matchSupp = purchaseSupplierFilter === 'all' || p.supplierId === purchaseSupplierFilter;
                      const matchQuery = purchaseSearch.trim() === '' || 
                        p.invoiceNumber.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
                        p.batchNumber.toLowerCase().includes(purchaseSearch.toLowerCase());
                      return matchSupp && matchQuery;
                    })
                    .map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-slate-600 whitespace-nowrap">{new Date(p.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{p.invoiceNumber}</span>
                            {p.isOpeningStock && (
                              <span className="px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
                                Opening
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">{p.supplierName}</td>
                        <td className="p-2.5">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">
                              {p.cartonQty > 0 || p.looseQty > 0
                                ? `${p.cartonQty} ${p.tradingUnit}${p.cartonQty !== 1 ? 's' : ''}${p.looseQty > 0 ? ` + ${p.looseQty} ${p.baseUnit}` : ''}`
                                : `${p.quantity} ${p.tradingUnit}s`
                              }
                            </span>
                            <span className="text-xs text-slate-500 font-medium">({p.quantity} Base {p.baseUnit}s)</span>
                          </div>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">₹{p.purchaseRate} <span className="text-xs font-normal text-slate-500">/ {p.tradingUnit}</span></td>
                        <td className="p-2.5 font-mono text-slate-600 font-semibold">{p.batchNumber}</td>
                        <td className="p-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${
                            p.isOpeningStock 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : p.source.includes('AI') 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {p.source}
                          </span>
                        </td>
                        <td className="p-2.5 font-black text-slate-900 whitespace-nowrap">₹{p.totalAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: ORDERS & BILLING (Combined with Segmented Switcher)
          ======================================================== */}
      {activeTab === 'orders_billing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          {/* Header & Segmented Control Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Orders &amp; Billing</h3>
              <p className="text-xs text-slate-500 font-medium">Retailer order bookings and GST tax invoices</p>
            </div>

            {/* Segmented Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-center">
              <button
                onClick={() => setOrdersBillingSubTab('orders')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  ordersBillingSubTab === 'orders'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders ({itemOrders.length})
              </button>
              <button
                onClick={() => setOrdersBillingSubTab('billing')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  ordersBillingSubTab === 'billing'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Billing / Invoices ({itemInvoices.length})
              </button>
            </div>
          </div>

          {/* VIEW 1: ORDERS */}
          {ordersBillingSubTab === 'orders' && (
            <div className="space-y-4">
              {/* Order Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <div className="w-full sm:max-w-xs">
                  <SmartSearchBar
                    value={orderSearch}
                    onChange={setOrderSearch}
                    placeholder="Search order #..."
                    entityFilter={['order']}
                    size="sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={orderRetailerFilter}
                    onChange={(e) => setOrderRetailerFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
                  >
                    <option value="all">All Retailers</option>
                    {retailers.map(r => (
                      <option key={r.id} value={r.id}>{r.shop_name}</option>
                    ))}
                  </select>

                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Packed">Packed</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              {itemOrders.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                  No orders booked for this item yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50/50">
                        <th className="p-2.5">Order #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Customer / Retailer</th>
                        <th className="p-2.5">Ordered Qty</th>
                        <th className="p-2.5">Order Rate</th>
                        <th className="p-2.5">Fulfilled Qty</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemOrders
                        .filter(o => {
                          const matchRet = orderRetailerFilter === 'all' || o.retailerId === orderRetailerFilter;
                          const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
                          const matchQuery = orderSearch.trim() === '' || o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase());
                          return matchRet && matchStatus && matchQuery;
                        })
                        .map((o, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-indigo-600">{o.orderNumber}</td>
                            <td className="p-2.5 text-slate-600">{new Date(o.orderDate).toLocaleDateString()}</td>
                            <td className="p-2.5 font-bold text-slate-800">
                              {o.retailerName} <span className="text-xs text-slate-500 font-normal">({o.city})</span>
                            </td>
                            <td className="p-2.5 font-black text-slate-900">{o.orderedQty} {o.tradingUnit}s</td>
                            <td className="p-2.5 font-bold text-slate-800">₹{o.rate}</td>
                            <td className="p-2.5 font-semibold text-emerald-600">{o.fulfilledQty} {o.tradingUnit}s</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                o.status === 'Delivered' 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : o.status === 'Dispatched' 
                                  ? 'bg-sky-50 text-sky-700' 
                                  : o.status === 'Cancelled'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: BILLING / INVOICES */}
          {ordersBillingSubTab === 'billing' && (
            <div className="space-y-4">
              {/* Billing Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
                <div className="w-full sm:max-w-xs">
                  <SmartSearchBar
                    value={billingSearch}
                    onChange={setBillingSearch}
                    placeholder="Search invoice #..."
                    entityFilter={['invoice']}
                    size="sm"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={billingCustomerFilter}
                    onChange={(e) => setBillingCustomerFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
                  >
                    <option value="all">All Retailers</option>
                    {retailers.map(r => (
                      <option key={r.id} value={r.id}>{r.shop_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Billing Invoices Table */}
              {itemInvoices.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                  No tax invoices generated for this item yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase bg-slate-50/50">
                        <th className="p-2.5">Invoice #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Customer / Retailer</th>
                        <th className="p-2.5">Quantity Billed</th>
                        <th className="p-2.5">Billing Rate</th>
                        <th className="p-2.5">Discount</th>
                        <th className="p-2.5">Final Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemInvoices
                        .filter(i => {
                          const matchCust = billingCustomerFilter === 'all' || i.retailerId === billingCustomerFilter;
                          const matchQuery = billingSearch.trim() === '' || i.invoiceNumber.toLowerCase().includes(billingSearch.toLowerCase());
                          return matchCust && matchQuery;
                        })
                        .map((invRow, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-indigo-600">{invRow.invoiceNumber}</td>
                            <td className="p-2.5 text-slate-600">{new Date(invRow.date).toLocaleDateString()}</td>
                            <td className="p-2.5 font-bold text-slate-800">{invRow.retailerName}</td>
                            <td className="p-2.5 font-black text-slate-900">{invRow.quantity} {invRow.tradingUnit}s</td>
                            <td className="p-2.5 font-bold text-indigo-700">₹{invRow.rate}</td>
                            <td className="p-2.5 text-slate-500 font-medium">{invRow.discount ? `₹${invRow.discount}` : '-'}</td>
                            <td className="p-2.5 font-black text-slate-900">₹{invRow.grandTotal.toLocaleString()}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 5: MORE (Item Details, Variants, Stock Movement, Audit, Categories)
          ======================================================== */}
      {activeTab === 'more' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          {/* Sub-Navigation Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto no-scrollbar">
            {[
              { id: 'details', label: 'Item Details', icon: Info },
              { id: 'variants', label: `Variants (${familyVariants.length})`, icon: Layers },
              { id: 'ledger', label: 'Stock Movement', icon: History },
              { id: 'activity', label: 'Activity History', icon: ShieldCheck },
              { id: 'categories', label: `Categories (${assignedCategories.length})`, icon: Tag }
            ].map(sub => {
              const Icon = sub.icon;
              const isSelected = moreSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setMoreSubTab(sub.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* SUB-SECTION 1: ITEM DETAILS (Clean Grouped Sections) */}
          {moreSubTab === 'details' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Item Master Specifications</h4>
                  <p className="text-xs text-slate-500 font-medium">Master product configuration and tax settings</p>
                </div>
                <button
                  onClick={handleOpenEdit}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. Basic Information */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                  <h5 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Basic Information
                  </h5>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Product Name</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <p className="font-bold text-slate-900">{product.name}</p>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                        MRP: ₹{product.mrp}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Company / Brand</span>
                    <p className="font-semibold text-slate-800">{company?.name || product.brand}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">SKU</span>
                    <p className="font-mono font-bold text-slate-800">{product.sku}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Barcode / EAN</span>
                    <p className="font-mono text-slate-700">{product.barcode || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Description</span>
                    <p className="text-slate-600 text-xs">{product.description || 'Standard FMCG packaged product.'}</p>
                  </div>
                </div>

                {/* 2. Unit & Pricing */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                  <h5 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Unit &amp; Pricing
                  </h5>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Unit of Measurement (UOM)</span>
                    <p className="font-bold text-indigo-700 text-sm">{product.base_unit || product.trading_unit || 'Piece'}</p>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Selling Price</span>
                      <p className="font-black text-indigo-600 text-sm">₹{product.selling_price}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">MRP</span>
                      <p className="font-black text-slate-900 text-sm">₹{product.mrp}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Purchase Cost</span>
                      <p className="font-bold text-slate-700">₹{product.purchase_price}</p>
                    </div>
                    {product.carton_discount ? (
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Discount</span>
                        <p className="font-bold text-amber-700">₹{product.carton_discount}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 3. Tax & Stock Settings */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                  <h5 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200 pb-1.5">
                    Tax &amp; Stock Settings
                  </h5>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">HSN Code</span>
                    <p className="font-mono font-bold text-slate-800">{product.hsn}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">GST Rate</span>
                    <p className="font-bold text-slate-800">{product.gst_percent}%</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Reorder Alert Level</span>
                    <p className="font-bold text-amber-600">{product.reorder_level || 10} {product.trading_unit}s</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Batch &amp; Expiry Tracking</span>
                    <p className="text-slate-700 font-medium">
                      {product.batch_tracking_enabled !== false ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-SECTION 2: VARIANTS */}
          {moreSubTab === 'variants' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Product Family Variants</h4>
                  <p className="text-xs text-slate-500 font-medium">Different pack sizes under this product family</p>
                </div>
                <button
                  onClick={() => {
                    setVarPackSize('');
                    setVarMrp(product.mrp);
                    setVarSelling(product.selling_price);
                    setVarPurchase(product.purchase_price);
                    setVarError('');
                    setShowVariantModal(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variant</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-2.5">Variant Name</th>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">MRP</th>
                      <th className="p-2.5">Selling Price</th>
                      <th className="p-2.5">Available Stock</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {familyVariants.map(v => {
                      const vInv = inventory.find(i => i.product_id === v.id);
                      const isCurrent = v.id === product.id;
                      return (
                        <tr key={v.id} className={`hover:bg-slate-50 ${isCurrent ? 'bg-indigo-50/20' : ''}`}>
                          <td className="p-2.5 font-bold text-slate-900">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{v.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                                MRP: ₹{v.mrp}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-extrabold">
                                  Current
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">{v.sku}</td>
                          <td className="p-2.5 font-black text-slate-900">₹{v.mrp}</td>
                          <td className="p-2.5 font-black text-indigo-600 text-sm">₹{v.selling_price}</td>
                          <td className="p-2.5 font-bold text-slate-800">{vInv?.available_qty || 0} {v.trading_unit}s</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                              v.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {v.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            {!isCurrent && (
                              <a
                                href={`/admin/products/${v.id}`}
                                className="text-indigo-600 hover:underline font-bold text-xs inline-flex items-center gap-0.5"
                              >
                                <span>Open</span>
                                <ChevronRight className="w-3 h-3" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-SECTION 3: STOCK MOVEMENT (LEDGER) */}
          {moreSubTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Stock Movement Ledger</h4>
                  <p className="text-xs text-slate-500 font-medium">Immutable record of stock IN and OUT movements</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={ledgerTypeFilter}
                    onChange={(e) => setLedgerTypeFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
                  >
                    <option value="all">All Movements</option>
                    <option value="IN">Stock IN Only</option>
                    <option value="OUT">Stock OUT Only</option>
                  </select>
                </div>
              </div>

              {itemLedger.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  No stock ledger entries recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-2.5">Date &amp; Time</th>
                        <th className="p-2.5">Reason / Event</th>
                        <th className="p-2.5">Direction</th>
                        <th className="p-2.5">Qty Change</th>
                        <th className="p-2.5">Reference Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemLedger
                        .filter(l => ledgerTypeFilter === 'all' || l.direction === ledgerTypeFilter)
                        .map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-600 font-medium">{new Date(l.created_at).toLocaleString()}</td>
                            <td className="p-2.5 font-bold text-slate-800">{l.reason}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                l.direction === 'IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {l.direction === 'IN' ? '+ IN' : '- OUT'}
                              </span>
                            </td>
                            <td className="p-2.5 font-black text-slate-900">
                              <div className="flex flex-col">
                                <span>
                                  {l.direction === 'IN' ? '+' : '-'}
                                  {formatQuantityDisplay(Math.abs(l.change_qty), product.units_per_box_carton || 24, product.trading_unit, product.base_unit, true)}
                                </span>
                                {l.previous_qty !== undefined && l.new_qty !== undefined && (
                                  <span className="text-xs text-slate-500 font-medium">
                                    Balance: {l.new_qty} {product.base_unit || 'Piece'}s
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 font-medium">{l.reference_id || 'DIRECT'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUB-SECTION 4: ACTIVITY HISTORY (AUDIT LOG) */}
          {moreSubTab === 'activity' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Item Activity &amp; Audit Trail</h4>
                <p className="text-xs text-slate-500 font-medium">Chronological history of price updates and detail changes</p>
              </div>

              {itemLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  No audit logs recorded for this item.
                </div>
              ) : (
                <div className="space-y-2">
                  {itemLogs.map(log => (
                    <div key={log.id} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{log.action}</span>
                          {log.reference_id && (
                            <span className="font-mono text-xs text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {log.reference_id}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-xs mt-0.5">{log.details}</p>
                      </div>
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-SECTION 5: CATEGORIES */}
          {moreSubTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Category Assignments</h4>
                  <p className="text-xs text-slate-500 font-medium">Categories are optional tags for grouping catalogue items</p>
                </div>
                <button
                  onClick={handleOpenCategories}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Manage Categories</span>
                </button>
              </div>

              {assignedCategories.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  This product is not assigned to any category. (Categories are optional).
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedCategories.map(cat => (
                    <div
                      key={cat.id}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT ITEM (Grouped Fieldsets)
          ======================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Edit3 className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">Edit Product Details</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Group 1: Basic Info */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">1. Basic Information</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Product Name *</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">SKU</label>
                    <input
                      type="text"
                      value={editForm.sku || ''}
                      onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Barcode / EAN</label>
                    <input
                      type="text"
                      value={editForm.barcode || ''}
                      onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Trading Unit & Pricing */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">2. Trading Unit &amp; Pricing</span>
                
                {/* Trading Unit Specification */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="font-black text-slate-700 block uppercase tracking-wider text-[10px]">
                    Trading Unit Configuration *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      editForm.allow_carton ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs">Carton / Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!editForm.allow_carton}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !editForm.allow_pieces) return;
                          setEditForm({ ...editForm, allow_carton: checked });
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      editForm.allow_pieces ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs">Pieces</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!editForm.allow_pieces}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !editForm.allow_carton) return;
                          setEditForm({ ...editForm, allow_pieces: checked });
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>
                  </div>

                  {editForm.allow_carton ? (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Pieces per Carton (Pack Size) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.pieces_per_carton || editForm.units_per_box_carton || ''}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setEditForm({
                            ...editForm,
                            pieces_per_carton: val,
                            units_per_box_carton: val,
                            units_per_trading_unit: val
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white"
                        required
                      />
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span><strong>Pieces Only Mode:</strong> Pack size is bypassed. Traded strictly in <strong>Pieces</strong>.</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      MRP (₹{editForm.allow_carton ? '/Carton' : '/Piece'}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.mrp || 0}
                      onChange={(e) => setEditForm({ ...editForm, mrp: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Selling Price (₹{editForm.allow_carton ? '/Carton' : '/Piece'}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.selling_price || 0}
                      onChange={(e) => setEditForm({ ...editForm, selling_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-indigo-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Purchase Cost (₹{editForm.allow_carton ? '/Carton' : '/Piece'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.purchase_price || 0}
                      onChange={(e) => setEditForm({ ...editForm, purchase_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                    />
                  </div>
                  {editForm.allow_carton && editForm.allow_pieces && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Loose Selling Price (₹/Piece)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.loose_selling_price || ''}
                        placeholder={editForm.selling_price && editForm.pieces_per_carton ? (editForm.selling_price / (editForm.pieces_per_carton || 1)).toFixed(2) : ''}
                        onChange={(e) => setEditForm({ ...editForm, loose_selling_price: parseFloat(e.target.value) || undefined })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-emerald-700"
                      />
                    </div>
                  )}
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.carton_discount || 0}
                      onChange={(e) => setEditForm({ ...editForm, carton_discount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Tax & Stock Settings */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">3. Tax &amp; Stock Settings</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={editForm.hsn || ''}
                      onChange={(e) => setEditForm({ ...editForm, hsn: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">GST Rate (%)</label>
                    <select
                      value={editForm.gst_percent ?? 18}
                      onChange={(e) => setEditForm({ ...editForm, gst_percent: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-bold"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Reorder Alert Level</label>
                    <input
                      type="number"
                      value={editForm.reorder_level || 10}
                      onChange={(e) => setEditForm({ ...editForm, reorder_level: parseInt(e.target.value, 10) || 5 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Minimum Stock</label>
                    <input
                      type="number"
                      value={editForm.min_stock_level || 5}
                      onChange={(e) => setEditForm({ ...editForm, min_stock_level: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD PURCHASE (Quick Purchase Record)
          ======================================================== */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Warehouse className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">Record Purchase: {product.name}</h3>
              </div>
              <button onClick={() => setShowPurchaseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {purError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{purError}</span>
              </div>
            )}

            <form onSubmit={handleSavePurchase} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Supplier *</label>
                  <select
                    value={purSupplierId}
                    onChange={(e) => setPurSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-bold"
                    required
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Invoice / Ref #</label>
                  <input
                    type="text"
                    value={purInvoiceNumber}
                    onChange={(e) => setPurInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={purInvoiceDate}
                    onChange={(e) => setPurInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                  />
                </div>

                {tradeMeta.allowCarton ? (
                  <>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Full Cartons (Cartons) *</label>
                      <input
                        type="number"
                        min="0"
                        value={purCartonQty}
                        onChange={(e) => setPurCartonQty(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Loose Pieces</label>
                      <input
                        type="number"
                        min="0"
                        value={purLooseQty}
                        onChange={(e) => setPurLooseQty(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Inward Quantity (Pieces) *</label>
                    <input
                      type="number"
                      min="1"
                      value={purLooseQty}
                      onChange={(e) => setPurLooseQty(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm"
                      required
                    />
                  </div>
                )}

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Purchase Rate (₹{tradeMeta.allowCarton ? '/Carton' : '/Piece'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purRate}
                    onChange={(e) => setPurRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm"
                    required
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-semibold text-slate-700 block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purDiscount}
                    onChange={(e) => setPurDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={purBatch}
                    onChange={(e) => setPurBatch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={purExpiry}
                    onChange={(e) => setPurExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1 text-xs font-bold">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Inward Base Quantity:</span>
                  <span className="font-bold text-slate-800">
                    {formatProductStockDisplay(
                      tradeMeta.tradeMode === 'PIECES'
                        ? purLooseQty
                        : calculateBaseQuantity(purCartonQty, purLooseQty, tradeMeta.packSize),
                      product,
                      true
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span>Calculated Total Amount:</span>
                  <span className="text-sm font-black text-indigo-600">
                    ₹{Math.round(
                      (tradeMeta.tradeMode === 'PIECES'
                        ? (purLooseQty * purRate)
                        : ((purCartonQty * purRate) + (purLooseQty * (purRate / (tradeMeta.packSize || 1))))) *
                      (1 + (product.gst_percent || 18) / 100)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Confirm Inward Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADJUST STOCK
          ======================================================== */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Boxes className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">Adjust Stock: {product.name}</h3>
              </div>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{adjError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjDirection('IN')}
                  className={`py-2 rounded-xl font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjDirection === 'IN' 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Stock IN (Add)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjDirection('OUT')}
                  className={`py-2 rounded-xl font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjDirection === 'OUT' 
                      ? 'bg-rose-50 border-rose-300 text-rose-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Stock OUT (Deduct)</span>
                </button>
              </div>

              {tradeMeta.allowCarton ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Cartons (Boxes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={adjCartonQty}
                      onChange={(e) => setAdjCartonQty(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-base font-black text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Loose (Pieces)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={adjLooseQty}
                      onChange={(e) => setAdjLooseQty(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-base font-black text-slate-900"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Adjustment Quantity (Pieces) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={adjLooseQty}
                    onChange={(e) => setAdjLooseQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-base font-black text-slate-900"
                    required
                  />
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Current Available:</span>
                  <span className="font-black text-slate-800">
                    {formatProductStockDisplay(inv.available_qty, product, true)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Adjustment Base Units:</span>
                  <span className={`font-black ${adjDirection === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {adjDirection === 'IN' ? '+' : '-'}
                    {tradeMeta.tradeMode === 'PIECES'
                      ? `${adjLooseQty} Pieces`
                      : formatProductStockDisplay(calculateBaseQuantity(adjCartonQty, adjLooseQty, tradeMeta.packSize), product, true)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason *</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-semibold text-slate-700"
                >
                  <option value="Physical Stock Audit Reconciliation">Physical Stock Audit Reconciliation</option>
                  <option value="Damaged Stock Write-off">Damaged Stock Write-off</option>
                  <option value="Expired Consignment Disposal">Expired Consignment Disposal</option>
                  <option value="Opening Balance Correction">Opening Balance Correction</option>
                  <option value="Other Manual Adjustment">Other Manual Adjustment</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Remarks &amp; Notes</label>
                <input
                  type="text"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="Audit reference, count sheet ID..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD VARIANT
          ======================================================== */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">Add Variant for {product.name}</h3>
              </div>
              <button onClick={() => setShowVariantModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {varError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{varError}</span>
              </div>
            )}

            <form onSubmit={handleCreateVariant} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">Variant Name (e.g. 500g, 1kg, Red) *</label>
                  <input
                    type="text"
                    value={varPackSize}
                    onChange={(e) => setVarPackSize(e.target.value)}
                    placeholder="e.g. 500g"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                    required
                  />
                </div>

                {/* Trading Unit Specification for Variant */}
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="font-black text-slate-700 block uppercase tracking-wider text-[10px]">
                    Variant Trading Unit Configuration *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      varAllowCarton ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs">Carton / Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={varAllowCarton}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !varAllowPieces) return;
                          setVarAllowCarton(checked);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      varAllowPieces ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs">Pieces</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={varAllowPieces}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !varAllowCarton) return;
                          setVarAllowPieces(checked);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>
                  </div>

                  {varAllowCarton && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Pieces per Carton (Pack Size) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={varPiecesPerCarton}
                        onChange={(e) => setVarPiecesPerCarton(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    MRP (₹{varAllowCarton ? '/Carton' : '/Piece'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={varMrp}
                    onChange={(e) => setVarMrp(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Selling Price (₹{varAllowCarton ? '/Carton' : '/Piece'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={varSelling}
                    onChange={(e) => setVarSelling(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Purchase Cost (₹{varAllowCarton ? '/Carton' : '/Piece'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={varPurchase}
                    onChange={(e) => setVarPurchase(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono"
                  />
                </div>

                {varAllowCarton && varAllowPieces && (
                  <div className="col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">
                      Loose Selling Price (₹/Piece)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={varLooseSellingPrice || ''}
                      placeholder={varSelling && varPiecesPerCarton ? (varSelling / varPiecesPerCarton).toFixed(2) : ''}
                      onChange={(e) => setVarLooseSellingPrice(parseFloat(e.target.value) || undefined)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-emerald-700"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Create Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: MANAGE CATEGORIES
          ======================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Tag className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">Assign Categories</h3>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select categories to tag <strong>{product.name}</strong>. Categories are optional and do not limit operations.
            </p>

            {categories.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-500">{selectedCatIds.length} of {categories.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCatIds(categories.map(c => c.id))}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Select All ({categories.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCatIds([])}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 p-2 rounded-xl">
              {categories.map(cat => {
                const isSelected = selectedCatIds.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    onClick={() => {
                      setSelectedCatIds(prev => 
                        prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                      );
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded text-indigo-600 pointer-events-none"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 text-xs">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCategories}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
              >
                Save Categories
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
