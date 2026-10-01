'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useDb } from '@/context/DbContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Package, Plus, Search, Filter, Edit3, Boxes, Layers, Tag,
  ArrowUpDown, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  ExternalLink, DollarSign, Barcode, Hash, Warehouse, RefreshCw,
  Sparkles, SlidersHorizontal, Info, Check, X, ShieldAlert, ArrowLeft,
  MoreVertical, Eye, History, ShoppingCart, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
  Building2, Calendar, ShieldCheck, Image as ImageIcon, Trash2, FolderPlus
} from 'lucide-react';
import { 
  Product, BaseUnit, TradeMode, formatQuantityDisplay, calculateBaseQuantity, splitBaseQuantity,
  formatProductStockDisplay, formatAutoBoxQuantity, getProductTradeMode
} from '@/lib/db';
import CentralItemDetailHub from '@/components/CentralItemDetailHub';
import SmartSearchBar from '@/components/SmartSearchBar';

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProductId = searchParams.get('id');

  const {
    products,
    activeCompanyId,
    companies,
    categories,
    suppliers,
    inventory,
    batches,
    createFullProduct,
    updateProduct,
    deleteProduct,
    bulkUpdateProducts,
    bulkDeleteProducts,
    toggleProductStatus,
    adjustStock,
    makePurchase,
    createCompany,
    deleteCompany,
    createCategory,
    setProductCategories,
    getCategoriesForProduct,
    getCategoryIdsForProduct
  } = useDb();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Selected Product for Detail View (Direct Hub View)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(queryProductId || null);
  const [hubInitialTab, setHubInitialTab] = useState<'overview' | 'inventory' | 'purchases' | 'orders_billing' | 'more'>('overview');
  const [hubInitialSubTab, setHubInitialSubTab] = useState<'details' | 'variants' | 'ledger' | 'activity' | 'categories' | 'orders' | 'billing' | undefined>(undefined);

  useEffect(() => {
    if (queryProductId) {
      setSelectedProductId(queryProductId);
    }
  }, [queryProductId]);

  // Directory Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock_desc' | 'stock_asc' | 'price_desc' | 'mrp_desc' | 'updated'>('name');

  // Row 3-dot active dropdown state
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setActiveRowMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<Product | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState<Product | null>(null);

  // Add Product Form State
  const [formName, setFormName] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('FMCG');
  const [formDescription, setFormDescription] = useState('');
  const [formAllowCarton, setFormAllowCarton] = useState(true);
  const [formAllowPieces, setFormAllowPieces] = useState(true);
  const [formPiecesPerCarton, setFormPiecesPerCarton] = useState(24);
  const [formPackSize, setFormPackSize] = useState('24 Pieces/Ctn');
  const [formTradingUnit, setFormTradingUnit] = useState<'Box' | 'Carton'>('Carton');
  const [formBaseUnit, setFormBaseUnit] = useState<BaseUnit>('Piece');
  const [formUnitsPerPack, setFormUnitsPerPack] = useState(24);
  const [formAllowLooseSale, setFormAllowLooseSale] = useState(true);
  const [formLoosePriceMode, setFormLoosePriceMode] = useState<'auto' | 'manual'>('auto');
  const [formLooseSellingPrice, setFormLooseSellingPrice] = useState<number | undefined>(undefined);
  const [formCartonDiscount, setFormCartonDiscount] = useState(0);
  const [formLooseDiscount, setFormLooseDiscount] = useState(0);
  const [formMrp, setFormMrp] = useState(120);
  const [formSelling, setFormSelling] = useState(108);
  const [formPurchase, setFormPurchase] = useState(95);
  const [formDealer, setFormDealer] = useState<number | undefined>(undefined);
  const [formGst, setFormGst] = useState(18);
  const [formHsn, setFormHsn] = useState('19053100');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formMinStock, setFormMinStock] = useState(5);
  const [formReorderLevel, setFormReorderLevel] = useState(10);
  const [formSelectedCatIds, setFormSelectedCatIds] = useState<string[]>([]);
  const [formBatchTrackingEnabled, setFormBatchTrackingEnabled] = useState(true);
  const [formExpiryTrackingEnabled, setFormExpiryTrackingEnabled] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Initial Stock Fields
  const [formAddInitialStock, setFormAddInitialStock] = useState(true);
  const [formInitialStockCartons, setFormInitialStockCartons] = useState(10);
  const [formInitialStockLoose, setFormInitialStockLoose] = useState(2);
  const [formInitialPurchaseRate, setFormInitialPurchaseRate] = useState<number | undefined>(undefined);
  const [formInitialSupplierId, setFormInitialSupplierId] = useState('');
  const [formInitialPurchaseDate, setFormInitialPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [formInitialBatchNumber, setFormInitialBatchNumber] = useState(`BCH-${new Date().getFullYear()}-01`);
  const [formInitialExpiryDate, setFormInitialExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formInitialGodown, setFormInitialGodown] = useState('Central Godown (Indore Hub)');
  const [formInitialNotes, setFormInitialNotes] = useState('Opening Stock / Initial Purchase');
  const [formError, setFormError] = useState('');

  // Stock Adjustment Form State
  const [adjDirection, setAdjDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjCartonQty, setAdjCartonQty] = useState(1);
  const [adjLooseQty, setAdjLooseQty] = useState(0);
  const [adjReason, setAdjReason] = useState('Physical Stock Audit Reconciliation');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjError, setAdjError] = useState('');

  // Edit Modal Form State
  const [editFormData, setEditFormData] = useState<Partial<Product>>({});
  const [editError, setEditError] = useState('');

  // Category Assignment Modal State
  const [modalCatIds, setModalCatIds] = useState<string[]>([]);

  // Add Purchase Modal State
  const [purSupplierId, setPurSupplierId] = useState('');
  const [purInvoiceNumber, setPurInvoiceNumber] = useState('');
  const [purInvoiceDate, setPurInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [purQuantity, setPurQuantity] = useState(10);
  const [purRate, setPurRate] = useState(95);
  const [purBatch, setPurBatch] = useState('');
  const [purExpiry, setPurExpiry] = useState('');
  const [purError, setPurError] = useState('');

  // Multi-Selection State for Bulk Operations
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

  // Delete Product Confirmation State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Manage Companies Modal State
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<{ id: string; name: string; productCount: number } | null>(null);
  const [deletingCompanyLoading, setDeletingCompanyLoading] = useState(false);

  // Create Category Modal State
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [categoryModalError, setCategoryModalError] = useState('');

  // Bulk Edit Form fields & toggles
  const [bulkFields, setBulkFields] = useState({
    company: false,
    brand: false,
    category: false,
    gst: false,
    tradeMode: false,
    packSize: false,
    hsn: false,
    status: false,
    categories: false,
  });

  const [bulkValues, setBulkValues] = useState({
    company_id: '',
    brand: '',
    category: '',
    gst_percent: 18,
    trade_mode: 'BOTH' as TradeMode,
    allow_carton: true,
    allow_pieces: true,
    pieces_per_carton: 24,
    trading_unit: 'Carton',
    base_unit: 'Piece' as BaseUnit,
    hsn: '',
    active: true,
    categoryIds: [] as string[],
  });

  const [bulkError, setBulkError] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ----------------------------------------------------
  // COMPUTED STATS & FILTERED DIRECTORY
  // ----------------------------------------------------

  const currentBusinessProducts = useMemo(() => {
    const currentBiz = activeCompanyId || 'biz-saifee';
    return products.filter(p => {
      const isSecondBizItem = 
        p.business_id === 'biz-second-trading' ||
        p.id === 'prd-trad-basmati-50kg' ||
        p.id === 'prd-trad-sugar-m30' ||
        p.id === 'prd-trad-oil-15l' ||
        p.id?.startsWith('prd-trad-');
      const itemBiz = isSecondBizItem ? 'biz-second-trading' : (p.business_id || 'biz-saifee');
      return itemBiz === currentBiz;
    });
  }, [products, activeCompanyId]);

  const totalProducts = currentBusinessProducts.length;
  const activeProductsCount = currentBusinessProducts.filter(p => p.active).length;

  const totalValuation = useMemo(() => {
    return currentBusinessProducts.reduce((sum, p) => {
      const inv = inventory.find(i => i.product_id === p.id);
      const baseQty = inv?.physical_qty || 0;
      const unitsPerPack = p.units_per_box_carton || 24;
      const cartonEquivalent = baseQty / unitsPerPack;
      return sum + (cartonEquivalent * p.purchase_price);
    }, 0);
  }, [currentBusinessProducts, inventory]);

  const lowStockCount = useMemo(() => {
    return currentBusinessProducts.filter(p => {
      const inv = inventory.find(i => i.product_id === p.id);
      const avail = inv?.available_qty || 0;
      const reorder = p.reorder_level || 10;
      return avail <= reorder && p.active;
    }).length;
  }, [currentBusinessProducts, inventory]);

  const inStockCount = useMemo(() => {
    return currentBusinessProducts.filter(p => {
      const inv = inventory.find(i => i.product_id === p.id);
      return (inv?.available_qty || 0) > 0 && p.active;
    }).length;
  }, [currentBusinessProducts, inventory]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return currentBusinessProducts.filter(p => {
      // Company Filter
      if (companyFilter !== 'all' && p.company_id !== companyFilter) return false;

      // Category Filter (Optional filter)
      if (categoryFilter !== 'all') {
        const catIds = getCategoryIdsForProduct(p.id);
        if (categoryFilter === 'uncategorized') {
          if (catIds.length > 0) return false;
        } else {
          if (!catIds.includes(categoryFilter)) return false;
        }
      }

      // Status Filter
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;

      // Stock Status Filter
      const inv = inventory.find(i => i.product_id === p.id);
      const avail = inv?.available_qty || 0;
      const reorder = p.reorder_level || 10;
      if (stockStatusFilter === 'in_stock' && avail <= 0) return false;
      if (stockStatusFilter === 'out_of_stock' && avail > 0) return false;
      if (stockStatusFilter === 'low_stock' && (avail > reorder || avail <= 0)) return false;

      // Search Filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const comp = companies.find(c => c.id === p.company_id);
        const matchName = p.name ? p.name.toLowerCase().includes(q) : false;
        const matchCode = p.product_code ? p.product_code.toLowerCase().includes(q) : false;
        const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
        const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        const matchBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
        const matchCompany = comp?.name ? comp.name.toLowerCase().includes(q) : false;
        const matchHsn = p.hsn ? p.hsn.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode && !matchSku && !matchBarcode && !matchBrand && !matchCompany && !matchHsn) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock_desc') {
        const aInv = inventory.find(i => i.product_id === a.id)?.available_qty || 0;
        const bInv = inventory.find(i => i.product_id === b.id)?.available_qty || 0;
        return bInv - aInv;
      }
      if (sortBy === 'stock_asc') {
        const aInv = inventory.find(i => i.product_id === a.id)?.available_qty || 0;
        const bInv = inventory.find(i => i.product_id === b.id)?.available_qty || 0;
        return aInv - bInv;
      }
      if (sortBy === 'price_desc') return b.selling_price - a.selling_price;
      if (sortBy === 'mrp_desc') return b.mrp - a.mrp;
      if (sortBy === 'updated') {
        return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      }
      return 0;
    });
  }, [products, companyFilter, categoryFilter, statusFilter, stockStatusFilter, searchTerm, sortBy, inventory, companies, getCategoryIdsForProduct]);

  // Available unique brands & categories for suggestion chips
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    currentBusinessProducts.forEach(p => {
      if (p.brand && p.brand.trim()) brands.add(p.brand.trim());
    });
    return Array.from(brands).sort();
  }, [currentBusinessProducts]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    currentBusinessProducts.forEach(p => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats).sort();
  }, [currentBusinessProducts]);

  // Multi-selection computed states
  const isAllFilteredSelected = useMemo(() => {
    if (filteredProducts.length === 0) return false;
    return filteredProducts.every(p => selectedProductIds.includes(p.id));
  }, [filteredProducts, selectedProductIds]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredProducts.length === 0) return false;
    const selectedFilteredCount = filteredProducts.filter(p => selectedProductIds.includes(p.id)).length;
    return selectedFilteredCount > 0 && selectedFilteredCount < filteredProducts.length;
  }, [filteredProducts, selectedProductIds]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredProducts.map(p => p.id));
      setSelectedProductIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const newIds = new Set([...selectedProductIds, ...filteredProducts.map(p => p.id)]);
      setSelectedProductIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRow = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleClearSelection = () => {
    setSelectedProductIds([]);
  };

  const handleOpenBulkEdit = () => {
    if (selectedProductIds.length === 0) return;
    setBulkError('');
    setBulkFields({
      company: false,
      brand: false,
      category: false,
      gst: false,
      tradeMode: false,
      packSize: false,
      hsn: false,
      status: false,
      categories: false,
    });
    setBulkValues({
      company_id: companies[0]?.id || '',
      brand: '',
      category: 'FMCG',
      gst_percent: 18,
      trade_mode: 'BOTH',
      allow_carton: true,
      allow_pieces: true,
      pieces_per_carton: 24,
      trading_unit: 'Carton',
      base_unit: 'Piece',
      hsn: '',
      active: true,
      categoryIds: [],
    });
    setShowBulkEditModal(true);
  };

  const handleApplyBulkEdit = () => {
    const hasAnyField = Object.values(bulkFields).some(Boolean);
    if (!hasAnyField) {
      setBulkError('Please check at least one field above that you want to update.');
      return;
    }

    setBulkSubmitting(true);
    setBulkError('');

    try {
      const updates: Partial<Product> = {};

      if (bulkFields.company) {
        if (!bulkValues.company_id) {
          setBulkError('Please select a valid Company / Manufacturer');
          setBulkSubmitting(false);
          return;
        }
        updates.company_id = bulkValues.company_id;
      }

      if (bulkFields.brand) {
        if (!bulkValues.brand.trim()) {
          setBulkError('Please enter a valid Brand name');
          setBulkSubmitting(false);
          return;
        }
        updates.brand = bulkValues.brand.trim();
      }

      if (bulkFields.category) {
        if (!bulkValues.category.trim()) {
          setBulkError('Please enter a valid Primary Category');
          setBulkSubmitting(false);
          return;
        }
        updates.category = bulkValues.category.trim();
      }

      if (bulkFields.gst) {
        updates.gst_percent = Number(bulkValues.gst_percent);
      }

      if (bulkFields.tradeMode || bulkFields.packSize) {
        const allowCarton = bulkValues.trade_mode === 'CARTONS' || bulkValues.trade_mode === 'BOTH';
        const allowPieces = bulkValues.trade_mode === 'PIECES' || bulkValues.trade_mode === 'BOTH';
        const packRatio = Math.max(1, bulkValues.pieces_per_carton || 1);

        updates.trade_mode = bulkValues.trade_mode;
        updates.allow_carton = allowCarton;
        updates.allow_pieces = allowPieces;
        updates.pieces_per_carton = packRatio;
        updates.units_per_box_carton = packRatio;
        updates.units_per_trading_unit = packRatio;
        updates.trading_unit = bulkValues.trading_unit || 'Carton';
        updates.base_unit = bulkValues.base_unit || 'Piece';
        updates.pack_size = bulkValues.trade_mode === 'PIECES' ? '1 Piece' : `${packRatio} ${bulkValues.base_unit || 'Pieces'}/${bulkValues.trading_unit || 'Ctn'}`;
      }

      if (bulkFields.hsn) {
        updates.hsn = bulkValues.hsn.trim();
      }

      if (bulkFields.status) {
        updates.active = bulkValues.active;
      }

      const categoryIdsToPass = bulkFields.categories ? bulkValues.categoryIds : undefined;

      const res = bulkUpdateProducts(selectedProductIds, updates, categoryIdsToPass);

      showToast(`Successfully updated ${res.updatedCount} product(s) in bulk.`);
      setShowBulkEditModal(false);
      setSelectedProductIds([]);
    } catch (err: any) {
      setBulkError(err.message || 'Failed to update selected products.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    setBulkDeleteSubmitting(true);
    try {
      const res = bulkDeleteProducts(selectedProductIds);
      if (selectedProductId && selectedProductIds.includes(selectedProductId)) {
        setSelectedProductId(null);
      }
      setSelectedProductIds([]);
      setShowBulkDeleteModal(false);
      setShowBulkEditModal(false);
      showToast(`Successfully deleted ${res.deletedCount} product(s) in bulk.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete selected products.', 'error');
    } finally {
      setBulkDeleteSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  const handleOpenHub = (
    prodId: string, 
    tab: 'overview' | 'inventory' | 'purchases' | 'orders_billing' | 'more' = 'overview',
    subTab?: 'details' | 'variants' | 'ledger' | 'activity' | 'categories' | 'orders' | 'billing'
  ) => {
    setSelectedProductId(prodId);
    setHubInitialTab(tab);
    setHubInitialSubTab(subTab);
    setActiveRowMenuId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseHub = () => {
    setSelectedProductId(null);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCompanyId = formCompanyId || companies[0]?.id || '';
    if (!formName.trim()) {
      setFormError('Product name is required');
      return;
    }
    if (!effectiveCompanyId) {
      setFormError('Please select or register a company/manufacturer');
      return;
    }
    if (!formSelling || formSelling <= 0) {
      setFormError('Please enter a valid distributor selling rate');
      return;
    }
    if (!formMrp || formMrp <= 0) {
      setFormError('Please enter a valid MRP');
      return;
    }
    if (!formAllowCarton && !formAllowPieces) {
      setFormError('Please select at least one Trading Unit: Carton/Box or Pieces');
      return;
    }

    const tradeMode: TradeMode = formAllowCarton && formAllowPieces ? 'BOTH' : formAllowCarton ? 'CARTONS' : 'PIECES';
    const effectivePackSize = formAllowCarton ? Math.max(1, formPiecesPerCarton || 1) : 1;
    const packSizeStr = tradeMode === 'PIECES' ? '1 Piece' : `${effectivePackSize} Pieces/Ctn`;
    const tradingUnitStr = tradeMode === 'PIECES' ? 'Piece' : 'Carton';
    const baseUnitStr: BaseUnit = 'Piece';

    if (formAddInitialStock) {
      if (formInitialStockCartons < 0 || formInitialStockLoose < 0) {
        setFormError('Initial stock quantity cannot be negative');
        return;
      }
      if (formBatchTrackingEnabled && (formInitialStockCartons > 0 || formInitialStockLoose > 0) && !formInitialBatchNumber.trim()) {
        setFormError('Batch number is required when batch tracking is enabled and initial stock is entered');
        return;
      }
      if (formExpiryTrackingEnabled && (formInitialStockCartons > 0 || formInitialStockLoose > 0) && !formInitialExpiryDate) {
        setFormError('Expiry date is required when expiry tracking is enabled and initial stock is entered');
        return;
      }
    }

    const initialCartons = formAllowCarton ? formInitialStockCartons : 0;
    const initialLoose = tradeMode === 'PIECES' ? formInitialStockCartons : (formAllowPieces ? formInitialStockLoose : 0);
    const initialBaseUnits = formAddInitialStock ? calculateBaseQuantity(initialCartons, initialLoose, effectivePackSize) : 0;

    try {
      const newProd = createFullProduct({
        name: formName.trim(),
        company_id: effectiveCompanyId,
        brand: formBrand.trim() || undefined,
        category: formCategory.trim() || undefined,
        description: formDescription.trim() || undefined,
        pack_size: packSizeStr,
        trading_unit: tradingUnitStr,
        trade_mode: tradeMode,
        allow_carton: formAllowCarton,
        allow_pieces: formAllowPieces,
        pieces_per_carton: effectivePackSize,
        base_unit: baseUnitStr,
        units_per_box_carton: effectivePackSize,
        units_per_trading_unit: effectivePackSize,
        allow_loose_sale: formAllowPieces,
        loose_price_mode: formLoosePriceMode,
        loose_selling_price: formLooseSellingPrice,
        carton_discount: formCartonDiscount,
        loose_discount: formLooseDiscount,
        mrp: formMrp,
        selling_price: formSelling,
        purchase_price: formPurchase,
        dealer_price: formDealer,
        gst_percent: formGst,
        hsn: formHsn.trim() || '19053100',
        sku: formSku.trim() || undefined,
        barcode: formBarcode.trim() || undefined,
        min_stock_level: formMinStock,
        reorder_level: formReorderLevel,
        batch_tracking_enabled: formBatchTrackingEnabled,
        expiry_tracking_enabled: formExpiryTrackingEnabled,
        image_url: formImageUrl.trim() || undefined,
        active: formActive,
        categoryIds: formSelectedCatIds,
        // Initial stock details
        add_initial_stock: formAddInitialStock,
        initial_carton_qty: initialCartons,
        initial_loose_qty: initialLoose,
        initial_stock_qty: initialBaseUnits,
        initial_purchase_rate: formInitialPurchaseRate !== undefined && formInitialPurchaseRate > 0 ? formInitialPurchaseRate : formPurchase,
        initial_supplier_id: formInitialSupplierId || undefined,
        initial_purchase_date: formInitialPurchaseDate || undefined,
        initial_batch_number: formInitialBatchNumber.trim() || undefined,
        initial_expiry_date: formInitialExpiryDate || undefined,
        initial_godown: formInitialGodown || undefined,
        initial_notes: formInitialNotes.trim() || undefined
      });

      setShowAddProductModal(false);
      setFormName('');
      setFormBrand('');
      setFormDescription('');
      setFormSku('');
      setFormBarcode('');
      setFormImageUrl('');
      setFormInitialStockCartons(10);
      setFormInitialStockLoose(2);
      setFormSelectedCatIds([]);
      setFormError('');

      const stockSummary = formAddInitialStock && initialBaseUnits > 0
        ? ` with ${formatQuantityDisplay(initialBaseUnits, effectivePackSize, tradingUnitStr, baseUnitStr, true)} opening stock`
        : '';
      showToast(`Product "${newProd.name}" created successfully${stockSummary}.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product');
    }
  };

  const handleOpenEditModal = (prod: Product) => {
    const meta = getProductTradeMode(prod);
    setEditFormData({
      ...prod,
      name: prod.name,
      product_code: prod.product_code,
      sku: prod.sku,
      barcode: prod.barcode,
      company_id: prod.company_id,
      brand: prod.brand,
      description: prod.description || '',
      pack_size: prod.pack_size,
      trading_unit: prod.trading_unit || 'Carton',
      trade_mode: meta.tradeMode,
      allow_carton: meta.allowCarton,
      allow_pieces: meta.allowPieces,
      pieces_per_carton: meta.packSize,
      base_unit: prod.base_unit || 'Piece',
      units_per_box_carton: meta.packSize,
      units_per_trading_unit: meta.packSize,
      allow_loose_sale: meta.allowPieces,
      loose_price_mode: prod.loose_price_mode || 'auto',
      loose_selling_price: prod.loose_selling_price,
      loose_mrp: prod.loose_mrp,
      loose_purchase_price: prod.loose_purchase_price,
      carton_discount: prod.carton_discount || 0,
      loose_discount: prod.loose_discount || 0,
      mrp: prod.mrp,
      selling_price: prod.selling_price,
      purchase_price: prod.purchase_price,
      dealer_price: prod.dealer_price,
      gst_percent: prod.gst_percent,
      hsn: prod.hsn,
      min_stock_level: prod.min_stock_level || 5,
      reorder_level: prod.reorder_level || 10,
      active: prod.active
    });
    setEditError('');
    setActiveRowMenuId(null);
    setShowEditModal(prod);
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    if (!editFormData.name?.trim()) {
      setEditError('Product name is required');
      return;
    }
    if (!editFormData.selling_price || editFormData.selling_price <= 0) {
      setEditError('Valid selling price is required');
      return;
    }

    const allowCarton = editFormData.allow_carton !== false && (editFormData.allow_carton || editFormData.trade_mode === 'CARTONS' || editFormData.trade_mode === 'BOTH');
    const allowPieces = editFormData.allow_pieces !== false && (editFormData.allow_pieces || editFormData.trade_mode === 'PIECES' || editFormData.trade_mode === 'BOTH');

    if (!allowCarton && !allowPieces) {
      setEditError('Please select at least one Trading Unit: Carton/Box or Pieces');
      return;
    }

    const tradeMode: TradeMode = allowCarton && allowPieces ? 'BOTH' : allowCarton ? 'CARTONS' : 'PIECES';
    const packSize = allowCarton ? Math.max(1, editFormData.pieces_per_carton || editFormData.units_per_box_carton || 1) : 1;

    try {
      updateProduct(showEditModal.id, {
        ...editFormData,
        name: editFormData.name.trim(),
        trade_mode: tradeMode,
        allow_carton: allowCarton,
        allow_pieces: allowPieces,
        pieces_per_carton: packSize,
        units_per_box_carton: packSize,
        units_per_trading_unit: packSize,
        pack_size: tradeMode === 'PIECES' ? '1 Piece' : `${packSize} Pieces/Ctn`,
        trading_unit: tradeMode === 'PIECES' ? 'Piece' : 'Carton',
        base_unit: 'Piece',
        allow_loose_sale: allowPieces
      });
      setShowEditModal(null);
      showToast(`Product "${editFormData.name}" updated successfully.`);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update product');
    }
  };

  const handleOpenStockModal = (prod: Product) => {
    const meta = getProductTradeMode(prod);
    setAdjDirection('IN');
    setAdjCartonQty(meta.tradeMode === 'PIECES' ? 0 : 1);
    setAdjLooseQty(meta.tradeMode === 'PIECES' ? 10 : 0);
    setAdjReason('Physical Stock Audit Reconciliation');
    setAdjNotes('');
    setAdjError('');
    setActiveRowMenuId(null);
    setShowStockModal(prod);
  };

  const handleSaveStockModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showStockModal) return;
    const meta = getProductTradeMode(showStockModal);
    const totalBase = meta.tradeMode === 'PIECES'
      ? adjLooseQty
      : calculateBaseQuantity(adjCartonQty, adjLooseQty, meta.packSize);

    if (totalBase <= 0) {
      setAdjError('Please enter a valid quantity greater than zero');
      return;
    }

    try {
      adjustStock(
        showStockModal.id,
        totalBase,
        adjDirection,
        adjReason,
        adjNotes,
        undefined,
        undefined,
        adjCartonQty,
        adjLooseQty
      );
      setShowStockModal(null);
      showToast(`Stock adjusted: ${adjDirection === 'IN' ? '+' : '-'}${totalBase} Pieces`);
    } catch (err: any) {
      setAdjError(err.message || 'Stock adjustment failed');
    }
  };

  const handleOpenPurchaseModal = (prod: Product) => {
    setPurSupplierId(suppliers[0]?.id || '');
    setPurInvoiceNumber(`PUR-${Date.now().toString().slice(-4)}`);
    setPurInvoiceDate(new Date().toISOString().split('T')[0]);
    setPurQuantity(10);
    setPurRate(prod.purchase_price || 95);
    setPurBatch(`BCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setPurExpiry(d.toISOString().split('T')[0]);
    setPurError('');
    setActiveRowMenuId(null);
    setShowPurchaseModal(prod);
  };

  const handleSavePurchaseModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPurchaseModal) return;
    if (!purSupplierId) {
      setPurError('Please select a supplier');
      return;
    }
    if (!purQuantity || purQuantity <= 0) {
      setPurError('Please enter a valid quantity');
      return;
    }
    if (!purRate || purRate <= 0) {
      setPurError('Please enter a valid purchase rate');
      return;
    }

    try {
      makePurchase({
        supplier_id: purSupplierId,
        invoice_number: purInvoiceNumber.trim() || `PUR-${Date.now()}`,
        invoice_date: purInvoiceDate,
        total_amount: Math.round(purQuantity * purRate * (1 + (showPurchaseModal.gst_percent || 18) / 100)),
        items: [
          {
            product_id: showPurchaseModal.id,
            quantity: purQuantity,
            purchase_rate: purRate,
            discount: 0,
            free_quantity: 0,
            mrp: showPurchaseModal.mrp,
            gst_percent: showPurchaseModal.gst_percent,
            hsn: showPurchaseModal.hsn,
            batch: purBatch.trim() || `BCH-${Date.now().toString().slice(-4)}`,
            expiry_date: purExpiry || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
            trading_unit: showPurchaseModal.trading_unit
          }
        ]
      });

      setShowPurchaseModal(null);
      showToast(`Purchase recorded: +${purQuantity} ${showPurchaseModal.trading_unit}(s) added.`);
    } catch (err: any) {
      setPurError(err.message || 'Failed to record purchase');
    }
  };

  const handleOpenCategoryModal = (prod: Product) => {
    setModalCatIds(getCategoryIdsForProduct(prod.id));
    setActiveRowMenuId(null);
    setShowCategoryModal(prod);
  };

  const handleSaveCategoryModal = () => {
    if (!showCategoryModal) return;
    setProductCategories(showCategoryModal.id, modalCatIds);
    setShowCategoryModal(null);
    showToast(`Categories updated for "${showCategoryModal.name}".`);
  };

  // If not mounted yet, render loading skeleton to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="space-y-6 pb-20 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="h-20 bg-slate-200 rounded-2xl"></div>
          <div className="h-20 bg-slate-200 rounded-2xl"></div>
          <div className="h-20 bg-slate-200 rounded-2xl"></div>
          <div className="h-20 bg-slate-200 rounded-2xl"></div>
          <div className="h-20 bg-slate-200 rounded-2xl"></div>
        </div>
        <div className="h-12 bg-slate-200 rounded-2xl"></div>
        <div className="h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  // If a product is selected, render the simplified Central Item Detail Hub directly
  if (selectedProductId) {
    return (
      <CentralItemDetailHub
        productId={selectedProductId}
        initialTab={hubInitialTab}
        initialSubTab={hubInitialSubTab}
        onBack={handleCloseHub}
        onEdit={(prod) => handleOpenEditModal(prod)}
        onAdjustStock={(prod) => handleOpenStockModal(prod)}
      />
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

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Item Master &amp; Product Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository for all FMCG products. Click any item to inspect its transactions, stock, and history.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => {
              setNewCompanyName('');
              setNewCompanyCode('');
              setCompanyError('');
              setCompanySuccess('');
              setShowCompanyModal(true);
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
            title="Manage and create manufacturers/companies"
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>🏢 Manage Companies</span>
          </button>

          <button
            onClick={() => {
              setNewCategoryName('');
              setNewCategoryDesc('');
              setCategoryModalError('');
              setShowCreateCategoryModal(true);
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
            title="Create a new master category"
          >
            <FolderPlus className="w-4 h-4 text-emerald-600" />
            <span>📁 + New Category</span>
          </button>

          <button
            onClick={() => router.push('/admin/products/import-vyapar')}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-2 shadow-2xs cursor-pointer transition-colors"
            title="Bulk import products, pricing & opening stock from Vyapar ERP export"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import from Vyapar</span>
          </button>

          <button
            onClick={() => {
              setFormCompanyId(companies[0]?.id || '');
              setFormError('');
              setShowAddProductModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Compact KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Total Products</span>
          <span suppressHydrationWarning className="text-xl font-black text-slate-900 mt-0.5 block">{totalProducts}</span>
          <span className="text-xs text-slate-500 font-medium block mt-0.5">Master items</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Active Products</span>
          <span suppressHydrationWarning className="text-xl font-black text-emerald-600 mt-0.5 block">{activeProductsCount}</span>
          <span className="text-xs text-slate-500 font-medium block mt-0.5">Visible for sales</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">In Stock</span>
          <span suppressHydrationWarning className="text-xl font-black text-slate-900 mt-0.5 block">{inStockCount}</span>
          <span className="text-xs text-emerald-600 font-bold block mt-0.5">Ready to deliver</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Low Stock Alert</span>
          <span suppressHydrationWarning className="text-xl font-black text-amber-600 mt-0.5 block">{lowStockCount}</span>
          <span className="text-xs text-amber-600 font-bold block mt-0.5">Below reorder</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Stock Valuation</span>
          <span suppressHydrationWarning className="text-xl font-black text-indigo-700 mt-0.5 block truncate">
            ₹{Math.round(totalValuation).toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium block mt-0.5">At purchase cost</span>
        </div>
      </div>

      {/* Streamlined Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between">
          <div className="w-full md:max-w-md">
            <SmartSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search product name, SKU, barcode, brand..."
              entityFilter={['product', 'category']}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Company Filter */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
            >
              <option value="all">All Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Optional Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="uncategorized">Uncategorized Items</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock Only</option>
              <option value="low_stock">Low Stock (Alert)</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white outline-none cursor-pointer"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="stock_desc">Sort: Stock (High-Low)</option>
              <option value="stock_asc">Sort: Stock (Low-High)</option>
              <option value="price_desc">Sort: Price (High-Low)</option>
              <option value="mrp_desc">Sort: MRP (High-Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================
          SIMPLIFIED MAIN ITEM LIST (8 Essential Columns Only)
          ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Package className="w-7 h-7 text-slate-400" />
            </div>
            {products.length === 0 ? (
              <div className="space-y-3 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-800">No products found</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Your live FMCG product catalog is ready. Click <span className="font-semibold text-indigo-600">&quot;+ Add Product&quot;</span> or <span className="font-semibold text-purple-600">&quot;AI Purchase Import&quot;</span> to add items.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    + Add Product
                  </button>
                  <button
                    onClick={() => router.push('/admin/purchase/import')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Purchase Import
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-slate-800">No matching products found</h3>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms or filter criteria.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all products"
                      checked={isAllFilteredSelected}
                      ref={el => {
                        if (el) el.indeterminate = isSomeFilteredSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      title={isAllFilteredSelected ? "Deselect All Filtered" : "Select All Filtered"}
                    />
                  </th>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Company / Brand</th>
                  <th className="p-3.5">SKU / Barcode</th>
                  <th className="p-3.5">Available Stock</th>
                  <th className="p-3.5">Purchase Price</th>
                  <th className="p-3.5">Selling Price</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(prod => {
                  const isRowSelected = selectedProductIds.includes(prod.id);
                  const comp = companies.find(c => c.id === prod.company_id);
                  const inv = inventory.find(i => i.product_id === prod.id);
                  const avail = inv?.available_qty || 0;
                  const reorder = prod.reorder_level || 10;
                  const isLow = avail <= reorder && prod.active;
                  const isMenuOpen = activeRowMenuId === prod.id;

                  return (
                    <tr key={prod.id} className={`transition-colors ${isRowSelected ? 'bg-indigo-50/70 hover:bg-indigo-50/90' : 'hover:bg-slate-50/70'}`}>
                      {/* 0. Row Selection Checkbox */}
                      <td className="p-3.5 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${prod.name}`}
                          checked={isRowSelected}
                          onChange={() => handleToggleSelectRow(prod.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          title={`Select ${prod.name}`}
                        />
                      </td>

                      {/* 1. Product Name */}
                      <td className="p-3.5">
                        <button
                          onClick={() => handleOpenHub(prod.id)}
                          className="font-extrabold text-slate-900 text-sm hover:text-indigo-600 text-left transition-colors cursor-pointer flex flex-wrap items-center gap-1.5 group"
                        >
                          <span>{prod.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                            MRP: ₹{prod.mrp}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </button>
                      </td>

                      {/* 2. Company / Brand */}
                      <td className="p-3.5 font-bold text-slate-700 text-xs">
                        {comp?.name || prod.brand}
                      </td>

                      {/* 3. SKU / Barcode */}
                      <td className="p-3.5 font-mono text-xs text-slate-700">
                        <div className="font-bold">{prod.sku}</div>
                        {prod.barcode && <div className="text-xs text-slate-500 font-medium">{prod.barcode}</div>}
                      </td>

                      {/* 4. Available Stock */}
                      <td className="p-3.5">
                        {(() => {
                          const stockMeta = formatProductStockDisplay(avail, prod);
                          return (
                            <div className="flex flex-col gap-1">
                              <span className={`font-black text-sm ${isLow ? 'text-amber-600' : avail === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {stockMeta.display}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                  stockMeta.tradeMode === 'BOTH'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : stockMeta.tradeMode === 'CARTONS'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                  {stockMeta.badge}
                                </span>
                                {isLow && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-200">
                                    Low Stock
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 5. Purchase Price */}
                      <td className="p-3.5">
                        {(() => {
                          const meta = getProductTradeMode(prod);
                          const purchaseRate = prod.purchase_price || 0;
                          const loosePurchase = prod.loose_purchase_price || (meta.packSize > 1 ? (purchaseRate / meta.packSize) : purchaseRate);
                          return (
                            <div className="space-y-0.5">
                              {meta.tradeMode === 'PIECES' ? (
                                <span className="font-bold text-slate-800 text-sm block">
                                  ₹{purchaseRate}<span className="text-xs text-slate-500 font-medium">/Piece</span>
                                </span>
                              ) : (
                                <>
                                  <span className="font-bold text-slate-800 text-sm block">
                                    ₹{purchaseRate}<span className="text-xs text-slate-500 font-medium">/Carton</span>
                                  </span>
                                  {meta.allowPieces && (
                                    <span className="text-xs text-slate-500 font-semibold block">
                                      ₹{Number(loosePurchase).toFixed(2)}/Piece
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* 6. Current Selling Price */}
                      <td className="p-3.5">
                        {(() => {
                          const meta = getProductTradeMode(prod);
                          return (
                            <div className="space-y-0.5">
                              {meta.tradeMode === 'PIECES' ? (
                                <span className="font-black text-indigo-700 text-sm block">
                                  ₹{prod.selling_price}<span className="text-xs text-slate-500 font-medium">/Piece</span>
                                </span>
                              ) : (
                                <>
                                  <span className="font-black text-indigo-700 text-sm block">
                                    ₹{prod.selling_price}<span className="text-xs text-slate-500 font-medium">/Carton</span>
                                  </span>
                                  {meta.allowPieces && (
                                    <span className="text-xs text-emerald-700 font-bold block">
                                      ₹{(prod.loose_selling_price || (prod.selling_price / meta.packSize)).toFixed(2)}/Piece
                                    </span>
                                  )}
                                </>
                              )}
                              <span className="text-xs text-slate-600 font-bold block">MRP: ₹{prod.mrp}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 7. Status */}
                      <td className="p-3.5">
                        <button
                          onClick={() => {
                            toggleProductStatus(prod.id);
                            showToast(`Product ${prod.active ? 'deactivated' : 'activated'}.`);
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold border cursor-pointer ${
                            prod.active
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {prod.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* 8. Action: Primary Buttons (View, Edit) + 3-Dot Dropdown */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          {/* Primary Action 1: View */}
                          <button
                            onClick={() => handleOpenHub(prod.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="View Item Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* Primary Action 2: Edit */}
                          <button
                            onClick={() => handleOpenEditModal(prod)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Edit Item"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* Secondary Actions 3-Dot Dropdown */}
                          <div className="relative" ref={isMenuOpen ? rowMenuRef : undefined}>
                            <button
                              onClick={() => setActiveRowMenuId(isMenuOpen ? null : prod.id)}
                              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="More Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs font-semibold animate-in fade-in zoom-in-95 duration-100 text-left">
                                <button
                                  onClick={() => handleOpenPurchaseModal(prod)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Add Purchase</span>
                                </button>

                                <button
                                  onClick={() => handleOpenStockModal(prod)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Boxes className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Adjust Stock</span>
                                </button>

                                <button
                                  onClick={() => handleOpenHub(prod.id, 'purchases')}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                                  <span>View Purchase History</span>
                                </button>

                                <button
                                  onClick={() => handleOpenHub(prod.id, 'orders_billing', 'orders')}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
                                  <span>View Order History</span>
                                </button>

                                <button
                                  onClick={() => handleOpenHub(prod.id, 'orders_billing', 'billing')}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                                  <span>View Billing History</span>
                                </button>

                                <button
                                  onClick={() => handleOpenCategoryModal(prod)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Manage Categories</span>
                                </button>

                                <div className="my-1 border-t border-slate-100"></div>

                                <button
                                  onClick={() => {
                                    toggleProductStatus(prod.id);
                                    setActiveRowMenuId(null);
                                    showToast(`Product ${prod.active ? 'deactivated' : 'activated'}.`);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  {prod.active ? (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Deactivate Product</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Activate Product</span>
                                    </>
                                  )}
                                </button>

                                <div className="my-1 border-t border-slate-100"></div>

                                <button
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    setProductToDelete(prod);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Delete Product</span>
                                </button>
                              </div>
                            )}
                          </div>
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

      {/* ========================================================
          MODAL: ADD NEW PRODUCT (Clean Grouped Form with Automated Initial Stock)
          ======================================================== */}
      {showAddProductModal && (() => {
        const unitsPerTUnit = Math.max(1, formUnitsPerPack || 1);
        const baseQtyComputed = formAddInitialStock 
          ? calculateBaseQuantity(formInitialStockCartons, formInitialStockLoose, unitsPerTUnit) 
          : 0;
        const currentRate = formInitialPurchaseRate !== undefined && formInitialPurchaseRate > 0 
          ? formInitialPurchaseRate 
          : formPurchase;
        const currentLooseRate = Math.round((currentRate / unitsPerTUnit) * 100) / 100;
        const stockValuation = formAddInitialStock 
          ? Math.round(((formInitialStockCartons * currentRate) + (formInitialStockLoose * currentLooseRate)) * 100) / 100 
          : 0;
        const marginPerCarton = Math.round((formSelling - formPurchase) * 100) / 100;
        const marginPercent = formSelling > 0 ? Math.round((marginPerCarton / formSelling) * 1000) / 10 : 0;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5 text-indigo-600">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Add New FMCG Item</h3>
                    <p className="text-xs text-slate-600 font-medium">Create product master &amp; optionally inward initial purchase stock into inventory</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in shake">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateProduct} className="space-y-5 text-xs">
                {/* 1. PRODUCT DETAILS */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>1. Product Master Details</span>
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-xs">
                      <input
                        type="checkbox"
                        checked={formActive}
                        onChange={(e) => setFormActive(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span>Active in Catalogue</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">Product Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Parle-G Glucose Biscuits 100g"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Company / Manufacturer <span className="text-red-500">*</span></label>
                      <select
                        value={formCompanyId || (companies[0]?.id || '')}
                        onChange={(e) => {
                          setFormCompanyId(e.target.value);
                          const c = companies.find(comp => comp.id === e.target.value);
                          if (c) setFormBrand(c.name);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-semibold text-slate-800"
                        required
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Brand Name</label>
                      <input
                        type="text"
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        placeholder="e.g. Parle"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Primary Category</label>
                      <input
                        type="text"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="e.g. Biscuits / FMCG"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 block">Assign Catalogue Categories</label>
                        {categories.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setFormSelectedCatIds(categories.map(c => c.id))}
                              className="font-bold text-indigo-600 hover:underline cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setFormSelectedCatIds([])}
                              className="font-bold text-slate-500 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                      <select
                        multiple
                        value={formSelectedCatIds}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setFormSelectedCatIds(selected);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xs h-16 outline-none focus:border-indigo-500"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <span className="text-xs text-slate-500 font-medium block mt-0.5">Hold Ctrl / Cmd to select multiple</span>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">SKU Code</label>
                      <input
                        type="text"
                        value={formSku}
                        onChange={(e) => setFormSku(e.target.value)}
                        placeholder="Auto-generated if blank (e.g. SKU-1025)"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Barcode / EAN</label>
                      <input
                        type="text"
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        placeholder="e.g. 8901719101015"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono text-xs bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">Product Image URL (Optional)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formImageUrl}
                          onChange={(e) => setFormImageUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/... or leave blank"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. TRADING UNIT SPECIFICATION */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                      <span>2. Trading Unit Specification</span>
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {formAllowCarton && formAllowPieces ? 'Dual-Tradeable (Carton & Pieces)' : formAllowCarton ? 'Carton Only' : 'Pieces Only'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1.5">
                        Trading Unit Controls <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-6 p-3 bg-white rounded-xl border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                          <input
                            type="checkbox"
                            checked={formAllowCarton}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (!checked && !formAllowPieces) {
                                setFormAllowPieces(true);
                              }
                              setFormAllowCarton(checked);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Carton / Box</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                          <input
                            type="checkbox"
                            checked={formAllowPieces}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (!checked && !formAllowCarton) {
                                setFormAllowCarton(true);
                              }
                              setFormAllowPieces(checked);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Pieces</span>
                        </label>
                      </div>
                    </div>

                    {/* Case B & Case C: If Carton / Box is enabled, require Pieces per Carton input */}
                    {formAllowCarton ? (
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                        <div>
                          <label className="font-bold text-slate-800 block mb-1">
                            Pieces per Carton (Pack Ratio) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={formPiecesPerCarton}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setFormPiecesPerCarton(val);
                              setFormUnitsPerPack(val);
                            }}
                            placeholder="e.g. 12 or 24"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white"
                            required
                          />
                          <span className="text-[11px] text-slate-500 font-medium block mt-1">
                            1 Carton = {formPiecesPerCarton} Pieces
                          </span>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Base Single Unit</label>
                          <input
                            type="text"
                            value="Pieces"
                            disabled
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-bold"
                          />
                          <span className="text-[11px] text-slate-500 font-medium block mt-1">
                            Strict single-unit nomenclature: Pieces
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
                        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>Pieces Only Mode:</strong> Pack size is bypassed. Base trading and billing unit is strictly <strong>Pieces (Pcs)</strong> with 1:1 ratio.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. PRICING, MARGINS & TAXES */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3. Pricing, Margins &amp; Compliance</span>
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        MRP (₹{formAllowCarton ? '/Carton' : '/Piece'}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formMrp}
                        onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Purchase Cost (₹{formAllowCarton ? '/Carton' : '/Piece'}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formPurchase}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setFormPurchase(val);
                          if (formInitialPurchaseRate === undefined) {
                            setFormInitialPurchaseRate(val);
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Selling Price (₹{formAllowCarton ? '/Carton' : '/Piece'}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formSelling}
                        onChange={(e) => setFormSelling(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-indigo-600 bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Selling Margin</label>
                      <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-extrabold flex items-center justify-between">
                        <span>₹{marginPerCarton}</span>
                        <span className="text-xs text-emerald-700 font-bold">({marginPercent}%)</span>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Discount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCartonDiscount}
                        onChange={(e) => setFormCartonDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">GST Rate (%)</label>
                      <select
                        value={formGst}
                        onChange={(e) => setFormGst(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-bold text-slate-800"
                      >
                        <option value={0}>0% (Tax-Free)</option>
                        <option value={5}>5% (Basic FMCG)</option>
                        <option value={12}>12% (Standard)</option>
                        <option value={18}>18% (Standard FMCG)</option>
                        <option value={28}>28% (Luxury / Aerated)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">HSN Code</label>
                      <input
                        type="text"
                        value={formHsn}
                        onChange={(e) => setFormHsn(e.target.value)}
                        placeholder="19053100"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. TRACKING & EXPIRY CONFIGURATION */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block border-b border-slate-200 pb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>4. Tracking &amp; Quality Controls</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors">
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">Batch Tracking</span>
                        <span className="text-xs text-slate-500 font-medium">Track distinct manufacturing lots &amp; batch numbers</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formBatchTrackingEnabled}
                        onChange={(e) => setFormBatchTrackingEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>

                    <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors">
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">Expiry Tracking</span>
                        <span className="text-xs text-slate-500 font-medium">Enforce FIFO dispatch and near-expiry alerts</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formExpiryTrackingEnabled}
                        onChange={(e) => setFormExpiryTrackingEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>

                {/* 5. INITIAL STOCK INWARD (OPENING PURCHASE TRANSACTION) */}
                <div className="bg-indigo-50/40 p-4 rounded-xl border-2 border-indigo-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                    <div>
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Warehouse className="w-4 h-4 text-indigo-600" />
                        <span>5. Initial Stock &amp; Opening Purchase</span>
                      </span>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">Automatically create an Opening Purchase transaction and update warehouse stock ledger</p>
                    </div>

                    {/* Toggle: Add Initial Stock Yes / No */}
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-indigo-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setFormAddInitialStock(true)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formAddInitialStock 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Yes, Add Initial Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormAddInitialStock(false)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          !formAddInitialStock 
                            ? 'bg-slate-700 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        No (0 Stock)
                      </button>
                    </div>
                  </div>

                  {formAddInitialStock ? (
                    <div className="space-y-4 pt-1">
                      {/* Quantity Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {formAllowCarton && (
                          <div>
                            <label className="font-bold text-slate-800 block mb-1 text-xs">
                              Initial Stock (Cartons) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formInitialStockCartons}
                              onChange={(e) => setFormInitialStockCartons(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm bg-white"
                              required
                            />
                          </div>
                        )}

                        {formAllowPieces && (
                          <div>
                            <label className="font-bold text-slate-800 block mb-1 text-xs">
                              {formAllowCarton ? 'Loose Stock (Pieces)' : 'Initial Stock (Pieces)'} <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formAllowCarton ? formInitialStockLoose : formInitialStockCartons}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                if (formAllowCarton) {
                                  setFormInitialStockLoose(val);
                                } else {
                                  setFormInitialStockCartons(val);
                                }
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm bg-white"
                              required
                            />
                          </div>
                        )}

                        <div>
                          <label className="font-bold text-slate-800 block mb-1 text-xs">
                            Purchase Cost (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formInitialPurchaseRate !== undefined ? formInitialPurchaseRate : formPurchase}
                            onChange={(e) => setFormInitialPurchaseRate(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-800 block mb-1 text-xs">
                            Purchase / Inward Date
                          </label>
                          <input
                            type="date"
                            value={formInitialPurchaseDate}
                            onChange={(e) => setFormInitialPurchaseDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-800 bg-white"
                          />
                        </div>
                      </div>

                      {/* LIVE CALCULATION SUMMARY CARD */}
                      <div className="p-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl shadow-md space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-700/50 pb-2">
                          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Live Stock Calculation &amp; Valuation</span>
                          </span>
                          <span className="text-xs text-indigo-200 font-mono font-bold">
                            {formAllowCarton 
                              ? `(${formInitialStockCartons} × ${unitsPerTUnit}) + ${formInitialStockLoose} = ${baseQtyComputed} Pieces`
                              : `${baseQtyComputed} Pieces`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                          <div className="bg-white/10 p-2.5 rounded-lg">
                            <span className="text-xs text-indigo-200 uppercase font-bold block">Total Initial Stock</span>
                            <p className="text-sm font-black text-white mt-0.5">
                              {formAllowCarton 
                                ? (formAllowPieces && formInitialStockLoose > 0 ? `${formInitialStockCartons} Ctns + ${formInitialStockLoose} Pieces` : `${formInitialStockCartons} Ctns`)
                                : `${formInitialStockCartons} Pieces`}
                            </p>
                          </div>

                          <div className="bg-white/10 p-2.5 rounded-lg">
                            <span className="text-xs text-indigo-200 uppercase font-bold block">Total Pieces</span>
                            <p className="text-sm font-black text-emerald-300 mt-0.5 font-mono">
                              {baseQtyComputed.toLocaleString()} Pieces
                            </p>
                          </div>

                          <div className="bg-white/10 p-2.5 rounded-lg">
                            <span className="text-xs text-indigo-200 uppercase font-bold block">Opening Stock Valuation</span>
                            <p className="text-sm font-black text-amber-300 mt-0.5">
                              ₹{stockValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Batch, Expiry, Supplier & Godown Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1 text-xs">
                            Supplier / Opening Source
                          </label>
                          <select
                            value={formInitialSupplierId}
                            onChange={(e) => setFormInitialSupplierId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-semibold text-slate-800 text-xs"
                          >
                            <option value="">-- Opening Stock (Direct Setup) --</option>
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        {formBatchTrackingEnabled && (
                          <div>
                            <label className="font-bold text-slate-700 block mb-1 text-xs">
                              Opening Batch Number <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formInitialBatchNumber}
                              onChange={(e) => setFormInitialBatchNumber(e.target.value)}
                              placeholder="e.g. BCH-2026-01"
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono font-bold text-indigo-700 text-xs bg-white"
                              required={formBatchTrackingEnabled && baseQtyComputed > 0}
                            />
                          </div>
                        )}

                        {formExpiryTrackingEnabled && (
                          <div>
                            <label className="font-bold text-slate-700 block mb-1 text-xs">
                              Batch Expiry Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={formInitialExpiryDate}
                              onChange={(e) => setFormInitialExpiryDate(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-800 text-xs bg-white"
                              required={formExpiryTrackingEnabled && baseQtyComputed > 0}
                            />
                          </div>
                        )}

                        <div>
                          <label className="font-bold text-slate-700 block mb-1 text-xs">
                            Initial Godown Location
                          </label>
                          <select
                            value={formInitialGodown}
                            onChange={(e) => setFormInitialGodown(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white font-semibold text-slate-800 text-xs"
                          >
                            <option value="Central Godown (Indore Hub)">Central Godown (Indore Hub)</option>
                            <option value="Main Godown (Bhiwandi Bay 1)">Main Godown (Bhiwandi Bay 1)</option>
                            <option value="City Godown (South Bay 2)">City Godown (South Bay 2)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="font-bold text-slate-700 block mb-1 text-xs">
                            Notes / Reference Document
                          </label>
                          <input
                            type="text"
                            value={formInitialNotes}
                            onChange={(e) => setFormInitialNotes(e.target.value)}
                            placeholder="Opening Stock / Initial Purchase"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-600 text-xs flex items-center gap-2.5">
                      <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>Product will be created in Master with <strong>0 physical &amp; available stock</strong>. Stock can be added later via Purchase Entry or Stock Adjustment.</span>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-md shadow-indigo-900/10 flex items-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Create Product &amp; {formAddInitialStock && baseQtyComputed > 0 ? 'Record Opening Purchase' : 'Save'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL: QUICK EDIT PRODUCT
          ======================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Edit3 className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">Edit: {showEditModal.name}</h3>
              </div>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Brand</label>
                  <input
                    type="text"
                    value={editFormData.brand || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={editFormData.hsn || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, hsn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono"
                  />
                </div>

                {/* Trading Unit Specification */}
                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="font-black text-slate-700 block uppercase tracking-wider text-[10px]">
                    Trading Unit Configuration *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      editFormData.allow_carton ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs">Carton / Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!editFormData.allow_carton}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !editFormData.allow_pieces) return;
                          setEditFormData({ ...editFormData, allow_carton: checked });
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      editFormData.allow_pieces ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs">Pieces</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!editFormData.allow_pieces}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !editFormData.allow_carton) return;
                          setEditFormData({ ...editFormData, allow_pieces: checked });
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>
                  </div>

                  {editFormData.allow_carton ? (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Pieces per Carton (Pack Size) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editFormData.pieces_per_carton || editFormData.units_per_box_carton || ''}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setEditFormData({
                            ...editFormData,
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

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    MRP (₹{editFormData.allow_carton ? '/Carton' : '/Piece'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.mrp || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Selling Price (₹{editFormData.allow_carton ? '/Carton' : '/Piece'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.selling_price || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Purchase Cost (₹{editFormData.allow_carton ? '/Carton' : '/Piece'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.purchase_price || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold"
                  />
                </div>

                {editFormData.allow_carton && editFormData.allow_pieces && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Loose Selling Price (₹/Piece)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.loose_selling_price || ''}
                      placeholder={editFormData.selling_price && editFormData.pieces_per_carton ? (editFormData.selling_price / (editFormData.pieces_per_carton || 1)).toFixed(2) : ''}
                      onChange={(e) => setEditFormData({ ...editFormData, loose_selling_price: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-emerald-700"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
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
          MODAL: QUICK STOCK ADJUSTMENT
          ======================================================== */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Boxes className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">Adjust Stock: {showStockModal.name}</h3>
              </div>
              <button onClick={() => setShowStockModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{adjError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStockModal} className="space-y-3.5 text-xs">
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
                  <span>Stock IN</span>
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
                  <span>Stock OUT</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block mb-1">
                  Adjustment Quantity ({showStockModal.base_unit || 'Unit'}s)
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjCartonQty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setAdjCartonQty(val);
                    setAdjLooseQty(0);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-base font-black text-slate-900"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-600">Current Available:</span>
                  <span className="font-black text-slate-900">
                    {formatQuantityDisplay(
                      inventory.find(i => i.product_id === showStockModal.id)?.available_qty || 0,
                      showStockModal.units_per_box_carton || 24,
                      showStockModal.trading_unit,
                      showStockModal.base_unit,
                      true
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-600">Adjustment Base Units:</span>
                  <span className={`font-black ${adjDirection === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {adjDirection === 'IN' ? '+' : '-'}
                    {calculateBaseQuantity(adjCartonQty, adjLooseQty, showStockModal.units_per_box_carton || 24)} {showStockModal.base_unit || 'Piece'}s
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
                  <option value="Other Adjustment">Other Adjustment</option>
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
                  onClick={() => setShowStockModal(null)}
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
          MODAL: QUICK PURCHASE (From 3-Dot Menu)
          ======================================================== */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Warehouse className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base">Add Purchase: {showPurchaseModal.name}</h3>
              </div>
              <button onClick={() => setShowPurchaseModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {purError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{purError}</span>
              </div>
            )}

            <form onSubmit={handleSavePurchaseModal} className="space-y-3.5 text-xs">
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

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity ({showPurchaseModal.trading_unit}s) *</label>
                  <input
                    type="number"
                    min="1"
                    value={purQuantity}
                    onChange={(e) => setPurQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Purchase Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purRate}
                    onChange={(e) => setPurRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-black text-slate-900 text-sm"
                    required
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

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Record Inward Purchase
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
                <h3 className="font-bold text-base">Assign Categories: {showCategoryModal.name}</h3>
              </div>
              <button onClick={() => setShowCategoryModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-500">{modalCatIds.length} of {categories.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalCatIds(categories.map(c => c.id))}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Select All ({categories.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setModalCatIds([])}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 p-2 rounded-xl">
              {categories.map(cat => {
                const isSelected = modalCatIds.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    onClick={() => {
                      setModalCatIds(prev =>
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
                onClick={() => setShowCategoryModal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCategoryModal}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
              >
                Save Categories
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          STICKY BOTTOM ACTION BAR (When Items Selected)
          ======================================================== */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom duration-200 w-[94%] max-w-2xl">
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-black text-sm tracking-tight text-white">
                {selectedProductIds.length} {selectedProductIds.length === 1 ? 'Item' : 'Items'} Selected
              </span>
              {selectedProductIds.length < filteredProducts.length && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer ml-1"
                >
                  Select All Filtered ({filteredProducts.length})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenBulkEdit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Bulk Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                title="Delete all selected items"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected ({selectedProductIds.length})</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Clear Selection"
              >
                <X className="w-4 h-4" />
                <span>Clear Selection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: BULK UPDATE PRODUCTS
          ======================================================== */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">
                    Bulk Update {selectedProductIds.length} Products
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select which fields you want to update across all {selectedProductIds.length} selected items.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkEditModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Tip */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 flex items-start gap-2 text-xs text-indigo-900">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Selective Overwrite:</strong> Only checked fields will be updated on the selected products. Unchecked fields will retain their current values.
              </span>
            </div>

            {/* Error Message */}
            {bulkError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Form Fields List */}
            <div className="space-y-3.5 divide-y divide-slate-100 text-xs">
              {/* 1. Company / Manufacturer */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.company}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, company: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update Company / Manufacturer</span>
                </label>
                {bulkFields.company && (
                  <div className="pl-6 space-y-1.5 animate-in fade-in duration-150">
                    <select
                      value={bulkValues.company_id}
                      onChange={(e) => setBulkValues(prev => ({ ...prev, company_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-900 bg-white"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">All selected items will be reassigned to this company.</p>
                  </div>
                )}
              </div>

              {/* 2. Brand */}
              <div className="pt-3">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.brand}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, brand: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update Brand</span>
                </label>
                {bulkFields.brand && (
                  <div className="pl-6 space-y-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      list="bulk-brand-suggestions"
                      value={bulkValues.brand}
                      onChange={(e) => setBulkValues(prev => ({ ...prev, brand: e.target.value }))}
                      placeholder="Enter brand name (e.g. Britannia, Parle, Lux, Riya)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-900"
                    />
                    <datalist id="bulk-brand-suggestions">
                      {availableBrands.map(b => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                    {availableBrands.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-medium">Quick pick:</span>
                        {availableBrands.slice(0, 5).map(b => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBulkValues(prev => ({ ...prev, brand: b }))}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Primary Category */}
              <div className="pt-3">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.category}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, category: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update Primary Category</span>
                </label>
                {bulkFields.category && (
                  <div className="pl-6 space-y-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      list="bulk-category-suggestions"
                      value={bulkValues.category}
                      onChange={(e) => setBulkValues(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g. FMCG, Biscuits, Personal Care, Beverages"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-900"
                    />
                    <datalist id="bulk-category-suggestions">
                      {availableCategories.map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>

              {/* 4. GST Tax Slab */}
              <div className="pt-3">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.gst}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, gst: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update GST Tax Slab (%)</span>
                </label>
                {bulkFields.gst && (
                  <div className="pl-6 space-y-2 animate-in fade-in duration-150">
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 5, 12, 18, 28].map(slab => (
                        <button
                          key={slab}
                          type="button"
                          onClick={() => setBulkValues(prev => ({ ...prev, gst_percent: slab }))}
                          className={`py-2 px-3 rounded-xl font-black text-xs border text-center transition-all cursor-pointer ${
                            bulkValues.gst_percent === slab
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {slab}% {slab === 0 ? '(Exempt)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Trading Unit Mode & Pack Ratio */}
              <div className="pt-3">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.tradeMode}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, tradeMode: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update Trading Unit Mode &amp; Pack Size</span>
                </label>
                {bulkFields.tradeMode && (
                  <div className="pl-6 space-y-3 animate-in fade-in duration-150">
                    <div>
                      <span className="font-semibold text-slate-600 block mb-1">Trading Unit Mode:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'BOTH' as TradeMode, label: 'Both (Carton & Pieces)' },
                          { id: 'CARTONS' as TradeMode, label: 'Cartons Only' },
                          { id: 'PIECES' as TradeMode, label: 'Pieces Only' },
                        ].map(mode => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setBulkValues(prev => ({ ...prev, trade_mode: mode.id }))}
                            className={`py-2 px-2.5 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                              bulkValues.trade_mode === mode.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">Pieces per Carton:</label>
                        <input
                          type="number"
                          min="1"
                          value={bulkValues.pieces_per_carton}
                          onChange={(e) => setBulkValues(prev => ({ ...prev, pieces_per_carton: parseInt(e.target.value, 10) || 1 }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">Trading Unit Name:</label>
                        <select
                          value={bulkValues.trading_unit}
                          onChange={(e) => setBulkValues(prev => ({ ...prev, trading_unit: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-900 bg-white"
                        >
                          <option value="Carton">Carton</option>
                          <option value="Box">Box</option>
                          <option value="Case">Case</option>
                          <option value="Bag">Bag</option>
                          <option value="Bundle">Bundle</option>
                          <option value="Dozen">Dozen</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">Base Unit Name:</label>
                        <select
                          value={bulkValues.base_unit}
                          onChange={(e) => setBulkValues(prev => ({ ...prev, base_unit: e.target.value as BaseUnit }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-900 bg-white"
                        >
                          <option value="Piece">Piece</option>
                          <option value="Packet">Packet</option>
                          <option value="Bottle">Bottle</option>
                          <option value="Pouch">Pouch</option>
                          <option value="Strip">Strip</option>
                          <option value="Tin">Tin</option>
                          <option value="Kg">Kg</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. HSN Code */}
              <div className="pt-3">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.hsn}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, hsn: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update HSN Code</span>
                </label>
                {bulkFields.hsn && (
                  <div className="pl-6 space-y-1.5 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={bulkValues.hsn}
                      onChange={(e) => setBulkValues(prev => ({ ...prev, hsn: e.target.value }))}
                      placeholder="e.g. 19053100, 33051090"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-mono text-slate-900 font-bold"
                    />
                  </div>
                )}
              </div>

              {/* 7. Active Status */}
              <div className="pt-3">
                <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bulkFields.status}
                    onChange={(e) => setBulkFields(prev => ({ ...prev, status: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                  />
                  <span>Update Active Status</span>
                </label>
                {bulkFields.status && (
                  <div className="pl-6 flex items-center gap-3 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => setBulkValues(prev => ({ ...prev, active: true }))}
                      className={`py-2 px-4 rounded-xl font-bold text-xs border cursor-pointer transition-all ${
                        bulkValues.active
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Active (Visible in Sales &amp; Orders)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkValues(prev => ({ ...prev, active: false }))}
                      className={`py-2 px-4 rounded-xl font-bold text-xs border cursor-pointer transition-all ${
                        !bulkValues.active
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Inactive (Hidden / Archived)
                    </button>
                  </div>
                )}
              </div>

              {/* 8. Catalogue Categories */}
              {categories.length > 0 && (
                <div className="pt-3">
                  <label className="flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={bulkFields.categories}
                      onChange={(e) => setBulkFields(prev => ({ ...prev, categories: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                    />
                    <span>Update Assigned Catalogue Categories</span>
                  </label>
                  {bulkFields.categories && (
                    <div className="pl-6 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                        <span>{bulkValues.categoryIds.length} of {categories.length} categories selected</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setBulkValues(prev => ({ ...prev, categoryIds: categories.map(c => c.id) }))}
                            className="text-indigo-600 hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span>|</span>
                          <button
                            type="button"
                            onClick={() => setBulkValues(prev => ({ ...prev, categoryIds: [] }))}
                            className="text-slate-500 hover:underline cursor-pointer"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-100 p-2 rounded-xl">
                        {categories.map(cat => {
                          const isChecked = bulkValues.categoryIds.includes(cat.id);
                          return (
                            <label
                              key={cat.id}
                              onClick={() => {
                                setBulkValues(prev => ({
                                  ...prev,
                                  categoryIds: isChecked
                                    ? prev.categoryIds.filter(id => id !== cat.id)
                                    : [...prev.categoryIds, cat.id]
                                }));
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{cat.name}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="rounded text-indigo-600 pointer-events-none"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation Section */}
            {Object.values(bulkFields).some(Boolean) && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-1 text-xs text-amber-900">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Confirmation Note:</span>
                </div>
                <p className="text-amber-800/90 font-medium">
                  Are you sure you want to apply changes to <strong>{selectedProductIds.length}</strong> selected product(s)?
                  This batch action will update: <span className="font-bold underline">{
                    [
                      bulkFields.company ? 'Company' : null,
                      bulkFields.brand ? 'Brand' : null,
                      bulkFields.category ? 'Category' : null,
                      bulkFields.gst ? `GST (${bulkValues.gst_percent}%)` : null,
                      bulkFields.tradeMode ? `Trading Mode (${bulkValues.trade_mode}) & Pack Size (${bulkValues.pieces_per_carton})` : null,
                      bulkFields.hsn ? `HSN (${bulkValues.hsn})` : null,
                      bulkFields.status ? `Status (${bulkValues.active ? 'Active' : 'Inactive'})` : null,
                      bulkFields.categories ? `${bulkValues.categoryIds.length} Categories` : null,
                    ].filter(Boolean).join(', ')
                  }</span>.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowBulkEditModal(false);
                  setShowBulkDeleteModal(true);
                }}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                title="Permanently delete all selected products"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete ({selectedProductIds.length}) Selected</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBulkEditModal(false)}
                  disabled={bulkSubmitting}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkEdit}
                  disabled={bulkSubmitting || !Object.values(bulkFields).some(Boolean)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                    bulkSubmitting || !Object.values(bulkFields).some(Boolean)
                      ? 'bg-indigo-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                  }`}
                >
                  {bulkSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Applying Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Apply Changes to {selectedProductIds.length} Products</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: BULK DELETE CONFIRMATION
          ======================================================== */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 tracking-tight">
                  Delete {selectedProductIds.length} Selected Products
                </h3>
                <p className="text-xs text-slate-500 font-medium">Permanent bulk deletion confirmation</p>
              </div>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Warning: Irreversible Batch Action</span>
              </div>
              <p className="text-rose-700 leading-relaxed font-medium">
                You are about to permanently delete <strong>{selectedProductIds.length} product(s)</strong>.
                This action will remove their master records, associated godown inventory balances, batch tracking entries, and catalogue category assignments.
              </p>
            </div>

            {/* Selected Items Preview List */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Items to be deleted ({selectedProductIds.length}):
              </label>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 p-1">
                {products
                  .filter(p => selectedProductIds.includes(p.id))
                  .map(p => {
                    const comp = companies.find(c => c.id === p.company_id);
                    const inv = inventory.find(i => i.product_id === p.id);
                    const avail = inv?.available_qty || 0;
                    return (
                      <div key={p.id} className="p-2 flex items-center justify-between text-xs hover:bg-white rounded-lg transition-colors">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            {comp && <span>{comp.name}</span>}
                            {p.sku && <span>• SKU: {p.sku}</span>}
                            <span>• {p.pack_size || '1 Piece'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-slate-700">{avail} units</span>
                          <span className="block text-[10px] text-slate-500">₹{p.selling_price}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkDeleteSubmitting}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleteSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-md shadow-rose-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {bulkDeleteSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting Products...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete {selectedProductIds.length} Products</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================
          MODAL: DELETE PRODUCT CONFIRMATION
          ======================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900">Delete Product</h3>
                <p className="text-xs text-slate-500 font-medium">{productToDelete.name}</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 text-xs text-rose-900 leading-relaxed space-y-1">
              <p className="font-bold">
                Are you sure you want to delete <span className="underline">{productToDelete.name}</span> ({productToDelete.pack_size})?
              </p>
              <p className="text-rose-700">
                This will permanently delete the product, its inventory balances, and batch records. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = productToDelete.name;
                  deleteProduct(productToDelete.id);
                  setProductToDelete(null);
                  showToast(`Product "${name}" deleted successfully.`);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Product</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: MANAGE COMPANIES (Create / Remove)
          ======================================================== */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">Manage Companies / Manufacturers</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Register new company brands or remove unused companies.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {companyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{companyError}</span>
              </div>
            )}

            {companySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{companySuccess}</span>
              </div>
            )}

            {/* Form: Add New Company */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCompanyError('');
                setCompanySuccess('');
                if (!newCompanyName.trim()) {
                  setCompanyError('Company name is required');
                  return;
                }
                try {
                  const created = createCompany(newCompanyName.trim(), newCompanyCode.trim() || undefined);
                  setNewCompanyName('');
                  setNewCompanyCode('');
                  setCompanySuccess(`Company "${created.name}" created successfully!`);
                  showToast(`Company "${created.name}" created.`);
                } catch (err: any) {
                  setCompanyError(err.message || 'Failed to create company');
                }
              }}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
            >
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">+ Add New Company</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Company / Manufacturer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hindustan Unilever, Nestle, ITC, Riya"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-semibold text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Short Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. HUL, NES"
                    value={newCompanyCode}
                    onChange={(e) => setNewCompanyCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-semibold text-slate-900 bg-white uppercase"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Company</span>
                </button>
              </div>
            </form>

            {/* Existing Companies List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Existing Companies ({companies.length})</h4>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {companies.map(c => {
                  const productCount = currentBusinessProducts.filter(p => p.company_id === c.id).length;
                  return (
                    <div key={c.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{c.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                            {c.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {productCount} {productCount === 1 ? 'product' : 'products'} registered
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCompanyError('');
                          setCompanySuccess('');
                          if (productCount > 0) {
                            setConfirmDeleteCompany({ id: c.id, name: c.name, productCount });
                          } else {
                            const res = deleteCompany(c.id);
                            if (!res.success) {
                              setCompanyError(res.message || 'Cannot delete company');
                            } else {
                              setCompanySuccess(`Company "${c.name}" permanently deleted.`);
                              showToast(`Company "${c.name}" deleted.`);
                            }
                          }
                        }}
                        className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRM COMPANY DELETION WITH LINKED PRODUCTS
          ======================================================== */}
      {confirmDeleteCompany && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 tracking-tight">Delete &ldquo;{confirmDeleteCompany.name}&rdquo;?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{confirmDeleteCompany.productCount} Linked Product(s) Detected</p>
                </div>
              </div>
              <button
                type="button"
                disabled={deletingCompanyLoading}
                onClick={() => setConfirmDeleteCompany(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This company has <span className="font-bold text-slate-900">{confirmDeleteCompany.productCount} product(s)</span> assigned in your Item Master. How would you like to handle them?
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Unlink / Set to None */}
              <button
                type="button"
                disabled={deletingCompanyLoading}
                onClick={() => {
                  setDeletingCompanyLoading(true);
                  try {
                    const res = deleteCompany(confirmDeleteCompany.id, { handleLinkedProducts: 'unlink' });
                    if (!res.success) {
                      setCompanyError(res.message || 'Failed to delete company');
                    } else {
                      setCompanySuccess(`Company "${confirmDeleteCompany.name}" deleted and ${confirmDeleteCompany.productCount} product(s) unlinked.`);
                      showToast(`Company "${confirmDeleteCompany.name}" deleted (products unlinked).`);
                      setConfirmDeleteCompany(null);
                    }
                  } finally {
                    setDeletingCompanyLoading(false);
                  }
                }}
                className="w-full p-3 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-left rounded-xl text-xs transition-colors cursor-pointer"
              >
                <div className="font-black text-blue-900 flex items-center justify-between">
                  <span>1. Unlink Products (Recommended)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">Safe</span>
                </div>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Keep the products in your Item Master, but set Company to &ldquo;Unassigned&rdquo;.
                </p>
              </button>

              {/* Option 2: Cascade Delete */}
              <button
                type="button"
                disabled={deletingCompanyLoading}
                onClick={() => {
                  setDeletingCompanyLoading(true);
                  try {
                    const res = deleteCompany(confirmDeleteCompany.id, { handleLinkedProducts: 'cascade' });
                    if (!res.success) {
                      setCompanyError(res.message || 'Failed to delete company');
                    } else {
                      setCompanySuccess(`Company "${confirmDeleteCompany.name}" and all ${confirmDeleteCompany.productCount} linked products deleted.`);
                      showToast(`Company "${confirmDeleteCompany.name}" and ${confirmDeleteCompany.productCount} products permanently deleted.`);
                      setConfirmDeleteCompany(null);
                    }
                  } finally {
                    setDeletingCompanyLoading(false);
                  }
                }}
                className="w-full p-3 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200 text-left rounded-xl text-xs transition-colors cursor-pointer"
              >
                <div className="font-black text-rose-900 flex items-center justify-between">
                  <span>2. Cascade Delete Everything</span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-mono">Destructive</span>
                </div>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Permanently delete this company AND all its {confirmDeleteCompany.productCount} products and inventory batches.
                </p>
              </button>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                disabled={deletingCompanyLoading}
                onClick={() => setConfirmDeleteCompany(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATE NEW CATEGORY
          ======================================================== */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 tracking-tight">Create New Category</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Add a new category to master catalog.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{categoryModalError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCategoryModalError('');
                if (!newCategoryName.trim()) {
                  setCategoryModalError('Category name is required');
                  return;
                }
                try {
                  const created = createCategory(newCategoryName.trim(), newCategoryDesc.trim() || undefined);
                  setShowCreateCategoryModal(false);
                  showToast(`Category "${created.name}" created successfully.`);
                } catch (err: any) {
                  setCategoryModalError(err.message || 'Failed to create category');
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Biscuits, Beverages, Personal Care, Spices"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-semibold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Brief description of products under this category..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium text-slate-800 bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateCategoryModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400 font-bold">Loading Item Master...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
