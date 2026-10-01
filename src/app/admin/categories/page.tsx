'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Tags, Plus, Search, Filter, Edit2, Trash2, CheckCircle2, 
  XCircle, Package, ArrowRight, Check, X, AlertTriangle, 
  Layers, ChevronRight, Sparkles, FolderPlus, Info, RefreshCw,
  Eye, CheckSquare, Square, ShieldAlert, FolderKanban,
  SlidersHorizontal, CheckCheck, ListFilter, Boxes, ExternalLink,
  DollarSign, Hash, Barcode, Warehouse, UserCheck, Users, Store,
  ShieldCheck, Lock, Unlock, User, UserX, CheckCircle, Shield
} from 'lucide-react';
import { Category, Product, Profile, Retailer } from '@/lib/db';
import SmartSearchBar from '@/components/SmartSearchBar';

export default function CategoryManagementPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    products,
    companies,
    categories,
    productCategories,
    inventory,
    batches,
    profiles,
    retailers,
    createCategory,
    updateCategory,
    toggleCategoryStatus,
    deleteCategory,
    assignCategoriesToProduct,
    removeCategoryFromProduct,
    setProductCategories,
    bulkAddCategoriesToProducts,
    bulkReplaceCategoriesForProducts,
    bulkRemoveCategoriesFromProducts,
    bulkRemoveProductsFromCategory,
    getCategoriesForProduct,
    getCategoryIdsForProduct,
    getProductsForCategory,
    getProductCountForCategory,
    updateProductWithCategories,
    updateCategoryAssignments,
    updateSalespersonCategoryAssignments,
    updateRetailerCategoryAssignments,
    getAssignedCategoriesForSalesperson,
    getAssignedCategoriesForRetailer
  } = useDb();

  // Tab State: 'categories' | 'assignments' | 'view_all' | 'manage_items'
  const [activeTab, setActiveTab] = useState<'categories' | 'assignments' | 'view_all' | 'manage_items'>('categories');

  // Category Filtering & Search
  const [categorySearch, setCategorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Product List Filtering & Search (common across view_all and manage_items)
  const [productSearch, setProductSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Selected Category for Detail View / Drawer inside Category Directory
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryProductSearch, setCategoryProductSearch] = useState('');
  const [selectedCategoryProductIds, setSelectedCategoryProductIds] = useState<string[]>([]);

  // Modals State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<Category | null>(null);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState<Category | null>(null);
  const [showAddProductsModal, setShowAddProductsModal] = useState<Category | null>(null);
  const [showEditProductCategoriesModal, setShowEditProductCategoriesModal] = useState<Product | null>(null);
  const [showProductDetailsModal, setShowProductDetailsModal] = useState<Product | null>(null);

  // Category Access & Assignment Modal State
  const [showAccessModal, setShowAccessModal] = useState<Category | null>(null);
  const [accessSalespersonMode, setAccessSalespersonMode] = useState<'all' | 'restricted'>('all');
  const [accessSalespersonIds, setAccessSalespersonIds] = useState<string[]>([]);
  const [accessRetailerMode, setAccessRetailerMode] = useState<'all' | 'restricted'>('all');
  const [accessRetailerIds, setAccessRetailerIds] = useState<string[]>([]);
  const [accessSalespersonSearch, setAccessSalespersonSearch] = useState('');
  const [accessRetailerSearch, setAccessRetailerSearch] = useState('');

  // Assignments Matrix Tab State
  const [assignmentSubTab, setAssignmentSubTab] = useState<'salespersons' | 'retailers' | 'matrix'>('salespersons');
  const [selectedAssigneeSalespersonId, setSelectedAssigneeSalespersonId] = useState<string>('');
  const [selectedAssigneeRetailerId, setSelectedAssigneeRetailerId] = useState<string>('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeCategorySearch, setAssigneeCategorySearch] = useState('');

  // Bulk Modals
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showBulkReplaceModal, setShowBulkReplaceModal] = useState(false);
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);
  const [bulkSelectedCategoryIds, setBulkSelectedCategoryIds] = useState<string[]>([]);

  // Modal Form States
  const [formCategoryName, setFormCategoryName] = useState('');
  const [formCategoryDesc, setFormCategoryDesc] = useState('');
  const [formCategoryActive, setFormCategoryActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Add Products to Category modal selection
  const [addProductsSearch, setAddProductsSearch] = useState('');
  const [addProductsSelectedIds, setAddProductsSelectedIds] = useState<string[]>([]);

  // Single Product Edit Categories modal selection
  const [productEditCategoryIds, setProductEditCategoryIds] = useState<string[]>([]);

  // Toast / Status Message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ----------------------------------------------------
  // COMPUTED STATS & FILTERED DATA
  // ----------------------------------------------------

  const totalCategories = categories.length;
  const activeCategoriesCount = categories.filter(c => c.active).length;
  const inactiveCategoriesCount = categories.filter(c => !c.active).length;
  const totalAssignmentsCount = productCategories.length;

  const uncategorizedCount = useMemo(() => {
    return products.filter(p => getCategoryIdsForProduct(p.id).length === 0).length;
  }, [products, productCategories]);

  // Filtered Categories List
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchSearch = categorySearch.trim() === '' ||
        cat.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(categorySearch.toLowerCase()));
      
      const matchStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && cat.active) || 
        (statusFilter === 'inactive' && !cat.active);

      return matchSearch && matchStatus;
    });
  }, [categories, categorySearch, statusFilter]);

  // Filtered Products for View All Items & Manage Items
  const filteredProducts = useMemo(() => {
    return products.filter(prod => {
      const matchSearch = productSearch.trim() === '' ||
        prod.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        prod.brand.toLowerCase().includes(productSearch.toLowerCase()) ||
        prod.product_code.toLowerCase().includes(productSearch.toLowerCase()) ||
        prod.hsn.includes(productSearch) ||
        (prod.sku && prod.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
        (prod.barcode && prod.barcode.toLowerCase().includes(productSearch.toLowerCase()));

      const matchCompany = companyFilter === 'all' || prod.company_id === companyFilter;

      let matchCategory = true;
      if (productCategoryFilter !== 'all') {
        const assignedCatIds = getCategoryIdsForProduct(prod.id);
        if (productCategoryFilter === 'uncategorized') {
          matchCategory = assignedCatIds.length === 0;
        } else {
          matchCategory = assignedCatIds.includes(productCategoryFilter);
        }
      }

      let matchStatus = true;
      if (productStatusFilter !== 'all') {
        matchStatus = productStatusFilter === 'active' ? prod.active : !prod.active;
      }

      return matchSearch && matchCompany && matchCategory && matchStatus;
    });
  }, [products, productSearch, companyFilter, productCategoryFilter, productStatusFilter, productCategories]);

  // Products belonging to the selected category inside detail drawer
  const categoryAssignedProducts = useMemo(() => {
    if (!selectedCategory) return [];
    const prods = getProductsForCategory(selectedCategory.id);
    if (!categoryProductSearch.trim()) return prods;
    const term = categoryProductSearch.toLowerCase();
    return prods.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.product_code.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    );
  }, [selectedCategory, productCategories, products, categoryProductSearch]);

  // Products available to add to selected category (not yet in this category)
  const availableProductsForCategory = useMemo(() => {
    if (!showAddProductsModal) return [];
    const existingCatProdIds = new Set(
      productCategories
        .filter(pc => pc.category_id === showAddProductsModal.id)
        .map(pc => pc.product_id)
    );
    const available = products.filter(p => !existingCatProdIds.has(p.id));
    if (!addProductsSearch.trim()) return available;
    const term = addProductsSearch.toLowerCase();
    return available.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.brand.toLowerCase().includes(term) ||
      p.product_code.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    );
  }, [showAddProductsModal, products, productCategories, addProductsSearch]);

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  const handleOpenAddCategory = () => {
    setFormCategoryName('');
    setFormCategoryDesc('');
    setFormCategoryActive(true);
    setFormError('');
    setShowAddCategoryModal(true);
  };

  const handleSaveAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanName = formCategoryName.trim();
    if (!cleanName) {
      setFormError('Category name is required.');
      return;
    }
    try {
      const created = createCategory(cleanName, formCategoryDesc.trim(), formCategoryActive);
      setShowAddCategoryModal(false);
      showToast(`Category "${created.name}" created successfully!`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create category.');
    }
  };

  const handleOpenEditCategory = (cat: Category) => {
    setShowEditCategoryModal(cat);
    setFormCategoryName(cat.name);
    setFormCategoryDesc(cat.description || '');
    setFormCategoryActive(cat.active);
    setFormError('');
  };

  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditCategoryModal) return;
    setFormError('');
    const cleanName = formCategoryName.trim();
    if (!cleanName) {
      setFormError('Category name is required.');
      return;
    }
    try {
      const updated = updateCategory(showEditCategoryModal.id, {
        name: cleanName,
        description: formCategoryDesc.trim(),
        active: formCategoryActive
      });
      if (updated) {
        setShowEditCategoryModal(null);
        if (selectedCategory && selectedCategory.id === updated.id) {
          setSelectedCategory(updated);
        }
        showToast(`Category "${updated.name}" updated successfully!`);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to update category.');
    }
  };

  const handleToggleStatus = (cat: Category) => {
    const updated = toggleCategoryStatus(cat.id);
    if (updated) {
      if (selectedCategory && selectedCategory.id === updated.id) {
        setSelectedCategory(updated);
      }
      showToast(`Category "${cat.name}" is now ${updated.active ? 'Active' : 'Inactive'}.`, 'info');
    }
  };

  const handleOpenDeleteModal = (cat: Category) => {
    setShowDeleteCategoryModal(cat);
  };

  const handleConfirmDelete = () => {
    if (!showDeleteCategoryModal) return;
    const catName = showDeleteCategoryModal.name;
    const deleted = deleteCategory(showDeleteCategoryModal.id);
    if (deleted) {
      if (selectedCategory && selectedCategory.id === showDeleteCategoryModal.id) {
        setSelectedCategory(null);
      }
      setShowDeleteCategoryModal(null);
      showToast(`Category "${catName}" deleted. Associated products were preserved.`, 'info');
    }
  };

  // Add Products to Category Handler
  const handleOpenAddProductsModal = (cat: Category) => {
    setShowAddProductsModal(cat);
    setAddProductsSearch('');
    setAddProductsSelectedIds([]);
  };

  const handleConfirmAddProductsToCategory = () => {
    if (!showAddProductsModal || addProductsSelectedIds.length === 0) return;
    bulkAddCategoriesToProducts(addProductsSelectedIds, [showAddProductsModal.id]);
    showToast(`Added ${addProductsSelectedIds.length} product(s) to "${showAddProductsModal.name}".`);
    setShowAddProductsModal(null);
  };

  // Remove Products from Category Handler
  const handleRemoveProductFromCategory = (productId: string, productName: string) => {
    if (!selectedCategory) return;
    removeCategoryFromProduct(productId, selectedCategory.id);
    showToast(`Removed "${productName}" from "${selectedCategory.name}".`);
  };

  const handleBulkRemoveFromCategory = () => {
    if (!selectedCategory || selectedCategoryProductIds.length === 0) return;
    bulkRemoveProductsFromCategory(selectedCategory.id, selectedCategoryProductIds);
    showToast(`Removed ${selectedCategoryProductIds.length} product(s) from "${selectedCategory.name}".`);
    setSelectedCategoryProductIds([]);
  };

  // Single Product Edit Categories Modal
  const handleOpenEditProductCategories = (prod: Product) => {
    setShowEditProductCategoriesModal(prod);
    setProductEditCategoryIds(getCategoryIdsForProduct(prod.id));
  };

  const handleSaveEditProductCategories = () => {
    if (!showEditProductCategoriesModal) return;
    setProductCategories(showEditProductCategoriesModal.id, productEditCategoryIds);
    showToast(`Updated categories for "${showEditProductCategoriesModal.name}".`);
    setShowEditProductCategoriesModal(null);
  };

  // ----------------------------------------------------
  // CATEGORY ACCESS & ASSIGNMENT HANDLERS
  // ----------------------------------------------------

  const salespersonsList = useMemo(() => {
    return profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co');
  }, [profiles]);

  const handleOpenAccessModal = (cat: Category) => {
    setShowAccessModal(cat);
    setAccessSalespersonMode(cat.salesperson_access_type || 'all');
    setAccessSalespersonIds(cat.assigned_salesperson_ids || []);
    setAccessRetailerMode(cat.retailer_access_type || 'all');
    setAccessRetailerIds(cat.assigned_retailer_ids || []);
    setAccessSalespersonSearch('');
    setAccessRetailerSearch('');
  };

  const handleSaveAccessModal = () => {
    if (!showAccessModal) return;
    try {
      const updated = updateCategoryAssignments(showAccessModal.id, {
        salesperson_access_type: accessSalespersonMode,
        assigned_salesperson_ids: accessSalespersonMode === 'all' ? [] : accessSalespersonIds,
        retailer_access_type: accessRetailerMode,
        assigned_retailer_ids: accessRetailerMode === 'all' ? [] : accessRetailerIds
      });
      if (updated) {
        setShowAccessModal(null);
        showToast(`Access permissions for "${updated.name}" updated successfully!`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update access permissions.', 'error');
    }
  };

  const handleToggleCategoryForSalesperson = (salespersonId: string, categoryId: string) => {
    const sp = profiles.find(p => p.id === salespersonId);
    if (!sp) return;
    const currentCats = sp.category_access_mode === 'custom' && Array.isArray(sp.assigned_category_ids)
      ? sp.assigned_category_ids
      : categories.filter(c => c.active).map(c => c.id);
    
    const newCats = currentCats.includes(categoryId)
      ? currentCats.filter(id => id !== categoryId)
      : [...currentCats, categoryId];
    
    updateSalespersonCategoryAssignments(salespersonId, newCats, 'custom');
    showToast(`Updated category assignments for ${sp.name}!`);
  };

  const handleSetAllCategoriesForSalesperson = (salespersonId: string, enableAll: boolean) => {
    const sp = profiles.find(p => p.id === salespersonId);
    if (!sp) return;
    if (enableAll) {
      updateSalespersonCategoryAssignments(salespersonId, [], 'all');
      showToast(`Granted access to ALL categories for ${sp.name}!`);
    } else {
      updateSalespersonCategoryAssignments(salespersonId, [], 'custom');
      showToast(`Cleared all category assignments for ${sp.name}!`);
    }
  };

  const handleToggleCategoryForRetailer = (retailerId: string, categoryId: string) => {
    const ret = retailers.find(r => r.id === retailerId);
    if (!ret) return;
    const currentCats = ret.category_access_mode === 'custom' && Array.isArray(ret.assigned_category_ids)
      ? ret.assigned_category_ids
      : categories.filter(c => c.active).map(c => c.id);
    
    const newCats = currentCats.includes(categoryId)
      ? currentCats.filter(id => id !== categoryId)
      : [...currentCats, categoryId];
    
    updateRetailerCategoryAssignments(retailerId, newCats, 'custom');
    showToast(`Updated category assignments for ${ret.shop_name}!`);
  };

  const handleSetAllCategoriesForRetailer = (retailerId: string, enableAll: boolean) => {
    const ret = retailers.find(r => r.id === retailerId);
    if (!ret) return;
    if (enableAll) {
      updateRetailerCategoryAssignments(retailerId, [], 'all');
      showToast(`Granted access to ALL categories for ${ret.shop_name}!`);
    } else {
      updateRetailerCategoryAssignments(retailerId, [], 'custom');
      showToast(`Cleared all category assignments for ${ret.shop_name}!`);
    }
  };

  // Product Details Modal
  const handleOpenProductDetails = (prod: Product) => {
    setShowProductDetailsModal(prod);
  };

  // Bulk Product Selection
  const handleToggleSelectAllProducts = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleToggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Bulk Actions
  const handleOpenBulkAdd = () => {
    setBulkSelectedCategoryIds([]);
    setShowBulkAddModal(true);
  };

  const handleConfirmBulkAdd = () => {
    if (bulkSelectedCategoryIds.length === 0 || selectedProductIds.length === 0) return;
    bulkAddCategoriesToProducts(selectedProductIds, bulkSelectedCategoryIds);
    showToast(`Added ${bulkSelectedCategoryIds.length} category(s) to ${selectedProductIds.length} product(s) while preserving existing assignments.`);
    setShowBulkAddModal(false);
    setSelectedProductIds([]);
  };

  const handleOpenBulkReplace = () => {
    setBulkSelectedCategoryIds([]);
    setShowBulkReplaceModal(true);
  };

  const handleConfirmBulkReplace = () => {
    if (selectedProductIds.length === 0) return;
    bulkReplaceCategoriesForProducts(selectedProductIds, bulkSelectedCategoryIds);
    showToast(`Replaced categories for ${selectedProductIds.length} product(s) with ${bulkSelectedCategoryIds.length} selected category(s).`);
    setShowBulkReplaceModal(false);
    setSelectedProductIds([]);
  };

  const handleOpenBulkRemove = () => {
    setBulkSelectedCategoryIds([]);
    setShowBulkRemoveModal(true);
  };

  const handleConfirmBulkRemove = () => {
    if (bulkSelectedCategoryIds.length === 0 || selectedProductIds.length === 0) return;
    bulkRemoveCategoriesFromProducts(selectedProductIds, bulkSelectedCategoryIds);
    showToast(`Removed selected categories from ${selectedProductIds.length} product(s).`);
    setShowBulkRemoveModal(false);
    setSelectedProductIds([]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-3 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950 text-emerald-200 border-emerald-800' 
            : toastMessage.type === 'error'
            ? 'bg-red-950 text-red-200 border-red-800'
            : 'bg-indigo-950 text-indigo-200 border-indigo-800'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/30">
              <Tags className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Product Category Management</h1>
              <p className="text-xs text-slate-500 font-medium">Create manual categories, view all catalog items, assign products to multiple categories, and manage catalogue filtering.</p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddCategory}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('categories')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Total Categories</span>
            <span suppressHydrationWarning className="text-2xl font-black text-slate-800 mt-0.5 block">{totalCategories}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <FolderKanban className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('categories')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Active Categories</span>
            <span suppressHydrationWarning className="text-2xl font-black text-emerald-600 mt-0.5 block">{activeCategoriesCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => {
            setProductCategoryFilter('uncategorized');
            setActiveTab('view_all');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-300 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Uncategorized Items</span>
            <span suppressHydrationWarning className="text-2xl font-black text-amber-600 mt-0.5 block">{uncategorizedCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('manage_items')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-violet-300 transition-all"
        >
          <div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Total Category Links</span>
            <span suppressHydrationWarning className="text-2xl font-black text-violet-600 mt-0.5 block">{totalAssignmentsCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 no-print overflow-x-auto">
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'categories'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Tags className="w-4 h-4" />
          <span suppressHydrationWarning>Category Directory ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'assignments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Access Permissions (Retailers &amp; Salespersons)</span>
        </button>

        <button
          onClick={() => setActiveTab('view_all')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'view_all'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span suppressHydrationWarning>View All Items ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('manage_items')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'manage_items'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Manage Items &amp; Bulk Assignment</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: CATEGORY DIRECTORY
          ======================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:max-w-sm">
              <SmartSearchBar
                value={categorySearch}
                onChange={setCategorySearch}
                placeholder="Search categories..."
                entityFilter={['category']}
                size="sm"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/50">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Categories ({categories.length})</option>
                  <option value="active">Active Only ({activeCategoriesCount})</option>
                  <option value="inactive">Inactive Only ({inactiveCategoriesCount})</option>
                </select>
              </div>

              {categorySearch && (
                <button
                  onClick={() => setCategorySearch('')}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>

          {/* Categories Grid / Empty State */}
          {categories.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto">
                <Tags className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-black text-slate-800">No Categories Created Yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The system initially starts with zero default categories. As the Admin, you can manually create categories (such as <span className="font-bold text-slate-700">FMCG</span>, <span className="font-bold text-slate-700">Snacks</span>, <span className="font-bold text-slate-700">Beverages</span>, <span className="font-bold text-slate-700">Personal Care</span>, <span className="font-bold text-slate-700">Offers</span>) whenever needed.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleOpenAddCategory}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Category</span>
                </button>
              </div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
              <p className="text-xs font-bold text-slate-500">No categories matching "{categorySearch}"</p>
              <button
                onClick={() => { setCategorySearch(''); setStatusFilter('all'); }}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((cat) => {
                const prodCount = getProductCountForCategory(cat.id);
                const isSelected = selectedCategory?.id === cat.id;
                const isRestrictedSales = cat.salesperson_access_type === 'restricted' && (cat.assigned_salesperson_ids?.length || 0) > 0;
                const isRestrictedRetailer = cat.retailer_access_type === 'restricted' && (cat.assigned_retailer_ids?.length || 0) > 0;

                return (
                  <div
                    key={cat.id}
                    className={`bg-white rounded-2xl border p-5 transition-all flex flex-col justify-between space-y-4 hover:shadow-md ${
                      isSelected 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' 
                        : 'border-slate-200 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-800 leading-snug">{cat.name}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                              cat.active 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {cat.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {cat.description ? (
                            <p className="text-xs text-slate-500 line-clamp-2">{cat.description}</p>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No description provided</p>
                          )}
                        </div>
                      </div>

                      {/* Product count & Access pills */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedCategory(isSelected ? null : cat)}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700 transition-colors cursor-pointer"
                          >
                            <Package className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{prodCount} Assigned {prodCount === 1 ? 'Product' : 'Products'}</span>
                          </button>
                        </div>

                        {/* Access Control Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {isRestrictedSales ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200 flex items-center gap-1" title="Restricted to specific salespersons">
                              <UserCheck className="w-3 h-3 text-purple-600" />
                              <span>{cat.assigned_salesperson_ids?.length} Salespeople</span>
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-semibold border border-slate-200 flex items-center gap-1" title="Available to all salespersons">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>All Salespeople</span>
                            </span>
                          )}

                          {isRestrictedRetailer ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1" title="Restricted to specific retailers">
                              <Store className="w-3 h-3 text-amber-600" />
                              <span>{cat.assigned_retailer_ids?.length} Retailers</span>
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-semibold border border-slate-200 flex items-center gap-1" title="Available to all retailers">
                              <Store className="w-3 h-3 text-slate-400" />
                              <span>All Retailers</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {/* Assign Access */}
                        <button
                          type="button"
                          onClick={() => handleOpenAccessModal(cat)}
                          title="Configure Retailer & Salesperson Access"
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Access</span>
                        </button>

                        {/* Toggle Active */}
                        <button
                          onClick={() => handleToggleStatus(cat)}
                          title={cat.active ? 'Deactivate Category' : 'Activate Category'}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            cat.active 
                              ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {cat.active ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          title="Edit Category Name & Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleOpenDeleteModal(cat)}
                          title="Delete Category"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* View Products */}
                      <button
                        onClick={() => setSelectedCategory(isSelected ? null : cat)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{isSelected ? 'Close View' : 'View Products'}</span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CATEGORY PRODUCT DRILL-DOWN DRAWER / PANEL */}
          {selectedCategory && (
            <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-xl p-6 space-y-5 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                    <Tags className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-800">{selectedCategory.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedCategory.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedCategory.active ? 'Active Category' : 'Inactive Category'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {categoryAssignedProducts.length} assigned product(s) in this category
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenAddProductsModal(selectedCategory)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Products to Category</span>
                  </button>

                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search & Bulk Remove within category */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:max-w-xs">
                  <SmartSearchBar
                    value={categoryProductSearch}
                    onChange={setCategoryProductSearch}
                    placeholder="Search products in category..."
                    entityFilter={['product']}
                    size="sm"
                  />
                </div>

                {selectedCategoryProductIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">{selectedCategoryProductIds.length} selected</span>
                    <button
                      onClick={handleBulkRemoveFromCategory}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Remove Selected from Category
                    </button>
                  </div>
                )}
              </div>

              {/* Product Table for Category */}
              {categoryAssignedProducts.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">No products assigned to "{selectedCategory.name}" yet.</p>
                  <button
                    onClick={() => handleOpenAddProductsModal(selectedCategory)}
                    className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign products now</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={
                              categoryAssignedProducts.length > 0 &&
                              categoryAssignedProducts.every(p => selectedCategoryProductIds.includes(p.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategoryProductIds(Array.from(new Set([
                                  ...selectedCategoryProductIds,
                                  ...categoryAssignedProducts.map(p => p.id)
                                ])));
                              } else {
                                const currentIds = new Set(categoryAssignedProducts.map(p => p.id));
                                setSelectedCategoryProductIds(prev => prev.filter(id => !currentIds.has(id)));
                              }
                            }}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4 text-left">Product Name</th>
                        <th className="py-3 px-4 text-left">Brand</th>
                        <th className="py-3 px-4 text-left">All Categories</th>
                        <th className="py-3 px-4 text-right">Selling Price</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {categoryAssignedProducts.map((p) => {
                        const isChecked = selectedCategoryProductIds.includes(p.id);
                        const allAssigned = getCategoriesForProduct(p.id);

                        return (
                          <tr key={p.id} className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-indigo-50/30' : ''}`}>
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategoryProductIds(prev => [...prev, p.id]);
                                  } else {
                                    setSelectedCategoryProductIds(prev => prev.filter(id => id !== p.id));
                                  }
                                }}
                                className="rounded text-indigo-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleOpenProductDetails(p)}
                                className="font-extrabold text-slate-900 text-sm text-left hover:text-indigo-600 hover:underline flex flex-wrap items-center gap-1.5 leading-tight cursor-pointer"
                              >
                                <span>{p.name}</span>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                                  MRP: ₹{p.mrp.toFixed(2)}
                                </span>
                              </button>
                              <span className="text-xs text-slate-500 font-medium block mt-0.5">
                                {p.product_code} {p.sku ? `| SKU: ${p.sku}` : ''}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700 text-xs">{p.brand}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {allAssigned.map(c => (
                                  <span
                                    key={c.id}
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                      c.id === selectedCategory.id 
                                        ? 'bg-indigo-600 text-white font-black' 
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {c.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                              ₹{p.selling_price.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenProductDetails(p)}
                                  title="View Full Product Details"
                                  className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditProductCategories(p)}
                                  title="Manage All Categories For This Product"
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Manage Categories
                                </button>
                                <button
                                  onClick={() => handleRemoveProductFromCategory(p.id, p.name)}
                                  title={`Remove from ${selectedCategory.name}`}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: ACCESS & ASSIGNMENTS (RETAILERS & SALESPERSONS)
          ======================================================== */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">Access Control &amp; Allocation</span>
              <h2 className="text-lg font-black mt-0.5">Category Assignment &amp; Visibility Permissions</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Control which product categories are assigned to <strong className="text-white">Individual Retailers</strong> (for retailer app ordering) and <strong className="text-white">Individual Salespersons</strong> (for order taking on field beats).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1 rounded-xl bg-indigo-800/80 text-indigo-200 text-xs font-bold border border-indigo-700">
                {categories.filter(c => c.active).length} Active Categories
              </span>
              <span className="px-3 py-1 rounded-xl bg-purple-800/80 text-purple-200 text-xs font-bold border border-purple-700">
                {salespersonsList.length} Salespeople
              </span>
              <span className="px-3 py-1 rounded-xl bg-amber-800/80 text-amber-200 text-xs font-bold border border-amber-700">
                {retailers.length} Retailers
              </span>
            </div>
          </div>

          {/* Sub-Navigation */}
          <div className="flex border-b border-slate-200 gap-4 bg-white px-4 pt-3 rounded-2xl shadow-xs">
            <button
              onClick={() => setAssignmentSubTab('salespersons')}
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                assignmentSubTab === 'salespersons'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>By Individual Salesperson ({salespersonsList.length})</span>
            </button>

            <button
              onClick={() => setAssignmentSubTab('retailers')}
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                assignmentSubTab === 'retailers'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>By Individual Retailer ({retailers.length})</span>
            </button>

            <button
              onClick={() => setAssignmentSubTab('matrix')}
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                assignmentSubTab === 'matrix'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Category Access Matrix ({categories.length})</span>
            </button>
          </div>

          {/* SUB-TAB 1: BY SALESPERSON */}
          {assignmentSubTab === 'salespersons' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Salesperson List */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Salesperson</span>
                  <span className="text-xs text-slate-400 font-bold">{salespersonsList.length} total</span>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {salespersonsList.map(sp => {
                    const isSelected = (selectedAssigneeSalespersonId || salespersonsList[0]?.id) === sp.id;
                    const assignedCats = getAssignedCategoriesForSalesperson(sp.id);
                    const isAll = sp.category_access_mode !== 'custom';

                    return (
                      <div
                        key={sp.id}
                        onClick={() => setSelectedAssigneeSalespersonId(sp.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{sp.name}</span>
                            <span className="text-[11px] text-slate-500 block">{sp.email}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            sp.role === 'sales_co' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {sp.role === 'sales_co' ? 'Company Sales' : 'Distributor Sales'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className={`font-semibold ${isAll ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {isAll ? '✓ All Categories' : `${assignedCats.length} Assigned`}
                          </span>
                          <span className="text-indigo-600 font-bold hover:underline">Configure →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Category Assignment Toggles */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
                {(() => {
                  const activeSpId = selectedAssigneeSalespersonId || salespersonsList[0]?.id;
                  const activeSp = profiles.find(p => p.id === activeSpId);
                  if (!activeSp) {
                    return <div className="text-center py-12 text-slate-400 font-bold text-xs">Please select a salesperson from the left list.</div>;
                  }

                  const isAllAccess = activeSp.category_access_mode !== 'custom';
                  const assignedCatIds = new Set(
                    isAllAccess
                      ? categories.filter(c => c.active).map(c => c.id)
                      : (activeSp.assigned_category_ids || [])
                  );

                  return (
                    <div className="space-y-5">
                      {/* Person Details Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-800">{activeSp.name}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              activeSp.role === 'sales_co' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                              {activeSp.role === 'sales_co' ? 'Company Salesperson' : 'Distributor Salesperson'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {isAllAccess ? 'Can take orders for all active product categories' : `Assigned to ${assignedCatIds.size} specific categories`}
                          </p>
                        </div>

                        {/* Quick Mode Switch */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetAllCategoriesForSalesperson(activeSp.id, true)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isAllAccess 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            All Categories
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetAllCategoriesForSalesperson(activeSp.id, false)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              !isAllAccess 
                                ? 'bg-indigo-600 text-white shadow-xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            Custom Selection
                          </button>
                        </div>
                      </div>

                      {/* Bulk Select/Clear Buttons */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Categories Allocation ({assignedCatIds.size} of {categories.length} Selected)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = categories.filter(c => c.active).map(c => c.id);
                              updateSalespersonCategoryAssignments(activeSp.id, allIds, 'custom');
                              showToast(`Selected all categories for ${activeSp.name}!`);
                            }}
                            className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              updateSalespersonCategoryAssignments(activeSp.id, [], 'custom');
                              showToast(`Cleared all categories for ${activeSp.name}!`);
                            }}
                            className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {/* Categories Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {categories.map(cat => {
                          const isAssigned = assignedCatIds.has(cat.id);
                          const prodCount = getProductCountForCategory(cat.id);

                          return (
                            <div
                              key={cat.id}
                              onClick={() => handleToggleCategoryForSalesperson(activeSp.id, cat.id)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                isAssigned
                                  ? 'bg-indigo-50/50 border-indigo-400 shadow-xs ring-1 ring-indigo-400/50'
                                  : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  isAssigned ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isAssigned && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                  <span className={`text-xs font-bold block ${isAssigned ? 'text-indigo-950' : 'text-slate-700'}`}>
                                    {cat.name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium block">
                                    {prodCount} products
                                  </span>
                                </div>
                              </div>
                              <span className={`text-xs font-bold ${isAssigned ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {isAssigned ? 'Assigned' : 'Off'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: BY RETAILER */}
          {assignmentSubTab === 'retailers' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Retailer List */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Retailer</span>
                  <span className="text-xs text-slate-400 font-bold">{retailers.length} total</span>
                </div>

                <input
                  type="text"
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  placeholder="Search retailer shop / code..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:border-indigo-500 outline-none"
                />

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {retailers
                    .filter(r => !assigneeSearch.trim() || r.shop_name.toLowerCase().includes(assigneeSearch.toLowerCase()) || r.retailer_code.toLowerCase().includes(assigneeSearch.toLowerCase()))
                    .map(ret => {
                      const isSelected = (selectedAssigneeRetailerId || retailers[0]?.id) === ret.id;
                      const assignedCats = getAssignedCategoriesForRetailer(ret.id);
                      const isAll = ret.category_access_mode !== 'custom';

                      return (
                        <div
                          key={ret.id}
                          onClick={() => setSelectedAssigneeRetailerId(ret.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50/70 border-amber-500 shadow-xs ring-1 ring-amber-500'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">{ret.shop_name}</span>
                              <span className="text-[11px] text-slate-500 block">{ret.retailer_code} • {ret.city || 'Mumbai'}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className={`font-semibold ${isAll ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {isAll ? '✓ All Categories' : `${assignedCats.length} Categories`}
                            </span>
                            <span className="text-amber-700 font-bold hover:underline">Configure →</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: Category Assignment Toggles for Retailer */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
                {(() => {
                  const activeRetId = selectedAssigneeRetailerId || retailers[0]?.id;
                  const activeRet = retailers.find(r => r.id === activeRetId);
                  if (!activeRet) {
                    return <div className="text-center py-12 text-slate-400 font-bold text-xs">Please select a retailer from the left list.</div>;
                  }

                  const isAllAccess = activeRet.category_access_mode !== 'custom';
                  const assignedCatIds = new Set(
                    isAllAccess
                      ? categories.filter(c => c.active).map(c => c.id)
                      : (activeRet.assigned_category_ids || [])
                  );

                  return (
                    <div className="space-y-5">
                      {/* Retailer Details Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-800">{activeRet.shop_name}</h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {activeRet.retailer_code}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {isAllAccess ? 'Can order all active product categories from retailer portal' : `Restricted to ${assignedCatIds.size} specific categories`}
                          </p>
                        </div>

                        {/* Quick Mode Switch */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetAllCategoriesForRetailer(activeRet.id, true)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isAllAccess 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            All Categories
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetAllCategoriesForRetailer(activeRet.id, false)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              !isAllAccess 
                                ? 'bg-amber-600 text-white shadow-xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            Custom Selection
                          </button>
                        </div>
                      </div>

                      {/* Bulk Select/Clear Buttons */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Categories Available To Retailer ({assignedCatIds.size} of {categories.length} Selected)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = categories.filter(c => c.active).map(c => c.id);
                              updateRetailerCategoryAssignments(activeRet.id, allIds, 'custom');
                              showToast(`Selected all categories for ${activeRet.shop_name}!`);
                            }}
                            className="text-xs text-amber-700 font-bold hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              updateRetailerCategoryAssignments(activeRet.id, [], 'custom');
                              showToast(`Cleared all categories for ${activeRet.shop_name}!`);
                            }}
                            className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {/* Categories Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {categories.map(cat => {
                          const isAssigned = assignedCatIds.has(cat.id);
                          const prodCount = getProductCountForCategory(cat.id);

                          return (
                            <div
                              key={cat.id}
                              onClick={() => handleToggleCategoryForRetailer(activeRet.id, cat.id)}
                              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                isAssigned
                                  ? 'bg-amber-50/50 border-amber-400 shadow-xs ring-1 ring-amber-400/50'
                                  : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  isAssigned ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isAssigned && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                  <span className={`text-xs font-bold block ${isAssigned ? 'text-amber-950' : 'text-slate-700'}`}>
                                    {cat.name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium block">
                                    {prodCount} products
                                  </span>
                                </div>
                              </div>
                              <span className={`text-xs font-bold ${isAssigned ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {isAssigned ? 'Available' : 'Hidden'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: CATEGORY ACCESS MATRIX */}
          {assignmentSubTab === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">All Categories Permissions Matrix</h3>
                  <p className="text-xs text-slate-500 font-medium">Click on any category to configure salesperson or retailer restrictions</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Category Name</th>
                      <th className="py-3 px-4">Active Products</th>
                      <th className="py-3 px-4">Salesperson Access</th>
                      <th className="py-3 px-4">Retailer Access</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map(cat => {
                      const prodCount = getProductCountForCategory(cat.id);
                      const isSalesRestricted = cat.salesperson_access_type === 'restricted' && (cat.assigned_salesperson_ids?.length || 0) > 0;
                      const isRetailerRestricted = cat.retailer_access_type === 'restricted' && (cat.assigned_retailer_ids?.length || 0) > 0;

                      return (
                        <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">{cat.name}</td>
                          <td className="py-3 px-4 text-slate-600">{prodCount} products</td>
                          <td className="py-3 px-4">
                            {isSalesRestricted ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Restricted ({cat.assigned_salesperson_ids?.length} Salespeople)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                Open to All Salespeople
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isRetailerRestricted ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Restricted ({cat.assigned_retailer_ids?.length} Retailers)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                Open to All Retailers
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenAccessModal(cat)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                              Configure Access
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

      {/* ========================================================
          TAB 3: VIEW ALL ITEMS (COMPLETE PRODUCT MASTER LIST)
          ======================================================== */}
      {activeTab === 'view_all' && (
        <div className="space-y-6">
          {/* Header Description & Summary Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">Product Master Directory</span>
              <h2 className="text-base font-black mt-0.5">Complete FMCG Products Master Catalogue</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Showing all items in the master database regardless of category assignment — including products with zero categories, single category, or multiple categories.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setActiveTab('manage_items')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Manage &amp; Bulk Assign</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <div className="w-full lg:max-w-xs">
              <SmartSearchBar
                value={productSearch}
                onChange={setProductSearch}
                placeholder="Search by name, SKU, code, brand, HSN..."
                entityFilter={['product']}
                size="sm"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Company Filter */}
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Company:</span>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Brands/Companies</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/50">
                <Tags className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase">Category:</span>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="uncategorized" className="font-bold text-amber-700">
                    ⚠️ Uncategorized Products ({uncategorizedCount})
                  </option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.active ? '' : '(Inactive)'} ({getProductCountForCategory(c.id)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
                <select
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {(productSearch || companyFilter !== 'all' || productCategoryFilter !== 'all' || productStatusFilter !== 'all') && (
                <button
                  onClick={() => { 
                    setProductSearch(''); 
                    setCompanyFilter('all'); 
                    setProductCategoryFilter('all');
                    setProductStatusFilter('all');
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* View All Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Product Name &amp; Code</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Assigned Categories</th>
                    <th className="py-3 px-4 text-right">MRP</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No products match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const assignedCats = getCategoriesForProduct(p.id);

                      return (
                        <tr 
                          key={p.id} 
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleOpenProductDetails(p)}
                              className="font-extrabold text-slate-900 text-sm text-left hover:text-indigo-600 hover:underline flex flex-wrap items-center gap-1.5 leading-tight cursor-pointer"
                            >
                              <span>{p.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                                MRP: ₹{p.mrp.toFixed(2)}
                              </span>
                            </button>
                            <span className="text-xs text-slate-500 font-medium block mt-0.5">
                              Code: {p.product_code} | HSN: {p.hsn} {p.sku ? `| SKU: ${p.sku}` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700 text-xs">
                            {p.brand}
                          </td>
                          <td className="py-3 px-4">
                            {assignedCats.length === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                ⚠️ Unassigned (0)
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {assignedCats.map(cat => (
                                  <span
                                    key={cat.id}
                                    className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                                      cat.active 
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                        : 'bg-slate-100 text-slate-500 border border-slate-200 line-through'
                                    }`}
                                  >
                                    {cat.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-600 text-xs">
                            ₹{p.mrp.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                            ₹{p.selling_price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              p.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenProductDetails(p)}
                                title="Open Complete Product Details"
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Details</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditProductCategories(p)}
                                title="Manage Category Assignments for this Product"
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Manage Categories
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: MANAGE ITEMS & BULK ASSIGNMENT
          ======================================================== */}
      {activeTab === 'manage_items' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Category Operations</span>
              <h2 className="text-base font-black text-slate-800">Manage Product Category Assignments</h2>
              <p className="text-xs text-slate-500 mt-1">
                Select one or multiple products to assign, replace, or remove categories in bulk without altering pricing, stock, or history.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSelectAllProducts}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                {selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0
                  ? 'Deselect All'
                  : 'Select All Visible'}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <div className="w-full lg:max-w-xs">
              <SmartSearchBar
                value={productSearch}
                onChange={setProductSearch}
                placeholder="Search products..."
                entityFilter={['product']}
                size="sm"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Company:</span>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Brands/Companies</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50/50">
                <Tags className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase">Category:</span>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="uncategorized">Uncategorized ({uncategorizedCount})</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.active ? '' : '(Inactive)'} ({getProductCountForCategory(c.id)})
                    </option>
                  ))}
                </select>
              </div>

              {(productSearch || companyFilter !== 'all' || productCategoryFilter !== 'all') && (
                <button
                  onClick={() => { setProductSearch(''); setCompanyFilter('all'); setProductCategoryFilter('all'); }}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Sticky Bulk Action Toolbar */}
          {selectedProductIds.length > 0 && (
            <div className="sticky top-4 z-40 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 bg-indigo-500 text-white rounded-lg text-xs font-black">
                  {selectedProductIds.length} Products Selected
                </span>
                <span className="text-xs font-medium text-slate-300 hidden md:inline">
                  Select bulk category action to apply:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenBulkAdd}
                  title="Add categories without modifying existing ones"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Categories (Preserve Existing)</span>
                </button>
                <button
                  onClick={handleOpenBulkReplace}
                  title="Replace all existing categories with newly selected ones"
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace Categories (Overwrite)</span>
                </button>
                <button
                  onClick={handleOpenBulkRemove}
                  title="Remove specific categories from selected products"
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Categories</span>
                </button>
                <button
                  onClick={() => setSelectedProductIds([])}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Interactive Multi-Select Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={handleToggleSelectAllProducts}
                        className="rounded text-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Product Description</th>
                    <th className="py-3 px-4">Brand / Company</th>
                    <th className="py-3 px-4">Current Category Assignments</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const assignedCats = getCategoriesForProduct(p.id);
                    const isChecked = selectedProductIds.includes(p.id);

                    return (
                      <tr 
                        key={p.id} 
                        className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-indigo-50/40' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleProductSelection(p.id)}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 text-sm block leading-tight">{p.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                              MRP: ₹{p.mrp.toFixed(2)}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium block mt-0.5">
                            Code: {p.product_code} | HSN: {p.hsn} {p.sku ? `| SKU: ${p.sku}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{p.brand}</td>
                        <td className="py-3 px-4">
                          {assignedCats.length === 0 ? (
                            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                              Unassigned
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {assignedCats.map(cat => (
                                <span
                                  key={cat.id}
                                  className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                                    cat.active 
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                      : 'bg-slate-100 text-slate-500 border border-slate-200 line-through'
                                  }`}
                                >
                                  {cat.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-800">
                          ₹{p.selling_price.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenEditProductCategories(p)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Manage Categories
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
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: PRODUCT DETAILS                               */}
      {/* ---------------------------------------------------- */}
      {showProductDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Product Master Item Details</span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h3 className="text-base font-black text-slate-800">{showProductDetailsModal.name}</h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                    MRP: ₹{showProductDetailsModal.mrp.toFixed(2)}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium mt-0.5 block">Brand: {showProductDetailsModal.brand} | {showProductDetailsModal.product_code}</span>
              </div>
              <button 
                onClick={() => setShowProductDetailsModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase block">SKU / Code</span>
                <p className="font-bold text-slate-800">{showProductDetailsModal.sku || showProductDetailsModal.product_code}</p>
                <span className="text-xs text-slate-500 block">Barcode: {showProductDetailsModal.barcode || 'N/A'}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase block">Packaging &amp; Units</span>
                <p className="font-bold text-slate-800">{showProductDetailsModal.pack_size}</p>
                <span className="text-xs text-slate-500 block">Trading Unit: {showProductDetailsModal.trading_unit}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase block">Wholesale Pricing</span>
                <p className="font-black text-indigo-600 text-sm">₹{showProductDetailsModal.selling_price.toFixed(2)}</p>
                <span className="text-xs text-emerald-800 font-bold block">Printed MRP: ₹{showProductDetailsModal.mrp.toFixed(2)}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase block">Tax &amp; Compliance</span>
                <p className="font-bold text-slate-800">GST: {showProductDetailsModal.gst_percent}%</p>
                <span className="text-xs text-slate-500 block">HSN Code: {showProductDetailsModal.hsn}</span>
              </div>
            </div>

            {/* Live Inventory Status */}
            {(() => {
              const inv = inventory.find(i => i.product_id === showProductDetailsModal.id);
              const prodBatches = batches.filter(b => b.product_id === showProductDetailsModal.id && b.quantity > 0);

              return (
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Live Warehouse Inventory</span>
                    <span className="text-xs font-bold text-slate-500">{prodBatches.length} Active Batches</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2 rounded-xl border border-indigo-100">
                      <span className="text-xs font-bold text-slate-500 uppercase block">Physical</span>
                      <strong className="text-slate-800 text-xs">{inv?.physical_qty || 0}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-100">
                      <span className="text-xs font-bold text-slate-500 uppercase block">Reserved</span>
                      <strong className="text-slate-800 text-xs">{inv?.reserved_qty || 0}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-100">
                      <span className="text-xs font-bold text-emerald-700 uppercase block">Available</span>
                      <strong className="text-emerald-700 text-xs">{inv?.available_qty || 0}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Current Category Assignments */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Assigned Product Categories</span>
              {getCategoriesForProduct(showProductDetailsModal.id).length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                  ⚠️ This product is currently unassigned to any category.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {getCategoriesForProduct(showProductDetailsModal.id).map(cat => (
                    <span
                      key={cat.id}
                      className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                        cat.active 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-slate-200 text-slate-600 line-through'
                      }`}
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowProductDetailsModal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetProd = showProductDetailsModal;
                  setShowProductDetailsModal(null);
                  handleOpenEditProductCategories(targetProd);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                Manage Categories
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 0: CATEGORY ACCESS & VISIBILITY PERMISSIONS   */}
      {/* ---------------------------------------------------- */}
      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800">
                      Configure Access: <span className="text-indigo-600">{showAccessModal.name}</span>
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      showAccessModal.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {showAccessModal.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Choose which salespeople and retailers can view &amp; order products from this category.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAccessModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              {/* SECTION 1: SALESPERSON ACCESS */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Salesperson Field Permissions</h4>
                  </div>

                  {/* Mode selector */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setAccessSalespersonMode('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accessSalespersonMode === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Salespeople
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccessSalespersonMode('restricted')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accessSalespersonMode === 'restricted'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Restricted ({accessSalespersonIds.length})
                    </button>
                  </div>
                </div>

                {accessSalespersonMode === 'all' ? (
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Unrestricted Access:</strong> All company and distributor salespersons can view and sell items from <strong>{showAccessModal.name}</strong> on their beat routes.</span>
                  </div>
                ) : (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search salespeople..."
                          value={accessSalespersonSearch}
                          onChange={(e) => setAccessSalespersonSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-semibold"
                        />
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setAccessSalespersonIds(salespersonsList.map(s => s.id))}
                          className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Select All ({salespersonsList.length})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setAccessSalespersonIds([])}
                          className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {salespersonsList
                        .filter(sp => 
                          !accessSalespersonSearch || 
                          sp.name.toLowerCase().includes(accessSalespersonSearch.toLowerCase()) ||
                          sp.email.toLowerCase().includes(accessSalespersonSearch.toLowerCase())
                        )
                        .map(sp => {
                          const isChecked = accessSalespersonIds.includes(sp.id);
                          return (
                            <div
                              key={sp.id}
                              onClick={() => {
                                setAccessSalespersonIds(prev =>
                                  prev.includes(sp.id) ? prev.filter(id => id !== sp.id) : [...prev, sp.id]
                                );
                              }}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded text-indigo-600 cursor-pointer"
                                />
                                <div>
                                  <span className="text-xs font-bold text-slate-800 block leading-tight">{sp.name}</span>
                                  <span className="text-[10px] text-slate-500">{sp.email}</span>
                                </div>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                sp.role === 'sales_co' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {sp.role === 'sales_co' ? 'Company' : 'Distributor'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: RETAILER ACCESS */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Retailer Portal Permissions</h4>
                  </div>

                  {/* Mode selector */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setAccessRetailerMode('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accessRetailerMode === 'all'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Retailers
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccessRetailerMode('restricted')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accessRetailerMode === 'restricted'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Restricted ({accessRetailerIds.length})
                    </button>
                  </div>
                </div>

                {accessRetailerMode === 'all' ? (
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Unrestricted Access:</strong> All registered retailer accounts can browse and order items from <strong>{showAccessModal.name}</strong> on their direct ordering app.</span>
                  </div>
                ) : (
                  <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search shop, owner, city..."
                          value={accessRetailerSearch}
                          onChange={(e) => setAccessRetailerSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500 font-semibold"
                        />
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setAccessRetailerIds(retailers.map(r => r.id))}
                          className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                        >
                          Select All ({retailers.length})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setAccessRetailerIds([])}
                          className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {retailers
                        .filter(r => 
                          !accessRetailerSearch || 
                          r.shop_name.toLowerCase().includes(accessRetailerSearch.toLowerCase()) ||
                          r.owner_name.toLowerCase().includes(accessRetailerSearch.toLowerCase()) ||
                          r.retailer_code.toLowerCase().includes(accessRetailerSearch.toLowerCase()) ||
                          (r.city && r.city.toLowerCase().includes(accessRetailerSearch.toLowerCase()))
                        )
                        .map(r => {
                          const isChecked = accessRetailerIds.includes(r.id);
                          return (
                            <div
                              key={r.id}
                              onClick={() => {
                                setAccessRetailerIds(prev =>
                                  prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                                );
                              }}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-amber-50/80 border-amber-500 ring-1 ring-amber-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded text-amber-600 cursor-pointer"
                                />
                                <div>
                                  <span className="text-xs font-bold text-slate-800 block leading-tight">{r.shop_name}</span>
                                  <span className="text-[10px] text-slate-500">{r.owner_name} • {r.city}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {r.retailer_code}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-medium">
                <span>Sales: <strong>{accessSalespersonMode === 'all' ? 'All' : `${accessSalespersonIds.length} Selected`}</strong></span>
                <span className="mx-2">•</span>
                <span>Retailers: <strong>{accessRetailerMode === 'all' ? 'All' : `${accessRetailerIds.length} Selected`}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccessModal(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAccessModal}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Access Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: CREATE NEW CATEGORY                         */}
      {/* ---------------------------------------------------- */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-800">Create New Category</h3>
              </div>
              <button 
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddCategory} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. FMCG, Snacks, Beverages, Personal Care, Offers"
                  value={formCategoryName}
                  onChange={(e) => setFormCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Description (Optional)</label>
                <textarea
                  placeholder="Brief description of products grouped under this category..."
                  value={formCategoryDesc}
                  onChange={(e) => setFormCategoryDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Initial Status</span>
                  <span className="text-xs text-slate-500 font-medium">Active categories appear in catalogue filters.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCategoryActive}
                    onChange={(e) => setFormCategoryActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: EDIT CATEGORY                               */}
      {/* ---------------------------------------------------- */}
      {showEditCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-800">Edit Category</h3>
              </div>
              <button 
                onClick={() => setShowEditCategoryModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCategory} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formCategoryName}
                  onChange={(e) => setFormCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Description</label>
                <textarea
                  value={formCategoryDesc}
                  onChange={(e) => setFormCategoryDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Category Status</span>
                  <span className="text-xs text-slate-500 font-medium">Deactivated categories hide from catalogue filters.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCategoryActive}
                    onChange={(e) => setFormCategoryActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditCategoryModal(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: DELETE CATEGORY CONFIRMATION                */}
      {/* ---------------------------------------------------- */}
      {showDeleteCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">Delete Category</h3>
                <span className="text-xs text-red-600 font-bold">Safe Unlink Action</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <p className="text-xs text-slate-700 font-bold">
                Are you sure you want to delete category <span className="text-indigo-600">"{showDeleteCategoryModal.name}"</span>?
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will unassign <span className="font-bold text-slate-700">{getProductCountForCategory(showDeleteCategoryModal.id)} products</span> from this category. 
                <span className="font-bold text-emerald-700 block mt-1">
                  ✓ None of your products, stock, batches, pricing, purchases, orders, or reports will be deleted.
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteCategoryModal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: ADD PRODUCTS TO CATEGORY                    */}
      {/* ---------------------------------------------------- */}
      {showAddProductsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">Add Products to "{showAddProductsModal.name}"</h3>
                <p className="text-xs text-slate-500 font-medium">Select products from your catalogue to assign to this category.</p>
              </div>
              <button 
                onClick={() => setShowAddProductsModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <SmartSearchBar
              value={addProductsSearch}
              onChange={setAddProductsSearch}
              placeholder="Search products by name, code, brand..."
              entityFilter={['product']}
              size="sm"
            />

            {availableProductsForCategory.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-500">{addProductsSelectedIds.length} of {availableProductsForCategory.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddProductsSelectedIds(availableProductsForCategory.map(p => p.id))}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Select All ({availableProductsForCategory.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setAddProductsSelectedIds([])}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Product selection list */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {availableProductsForCategory.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-bold">
                  All catalogue products are already assigned to this category or no matching products found.
                </div>
              ) : (
                availableProductsForCategory.map(p => {
                  const isChecked = addProductsSelectedIds.includes(p.id);
                  const currCats = getCategoriesForProduct(p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setAddProductsSelectedIds(prev => 
                          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isChecked ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by row onClick
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 text-sm block leading-tight">{p.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                              MRP: ₹{p.mrp.toFixed(2)}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">{p.brand} | {p.pack_size}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {currCats.length > 0 && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            {currCats.length} other {currCats.length === 1 ? 'cat' : 'cats'}
                          </span>
                        )}
                        <span className="font-bold text-slate-800 text-xs">₹{p.selling_price.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600">
                {addProductsSelectedIds.length} product(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductsModal(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addProductsSelectedIds.length === 0}
                  onClick={handleConfirmAddProductsToCategory}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Assign to Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: EDIT SINGLE PRODUCT CATEGORIES              */}
      {/* ---------------------------------------------------- */}
      {showEditProductCategoriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Product Category Master</span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h3 className="text-base font-black text-slate-800 line-clamp-1">{showEditProductCategoriesModal.name}</h3>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                    MRP: ₹{showEditProductCategoriesModal.mrp.toFixed(2)}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium mt-0.5 block">Brand: {showEditProductCategoriesModal.brand} | {showEditProductCategoriesModal.pack_size}</span>
              </div>
              <button 
                onClick={() => setShowEditProductCategoriesModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Select Categories Assigned to this Product:
                </label>
                {categories.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setProductEditCategoryIds(categories.map(c => c.id))}
                      className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Select All ({categories.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setProductEditCategoryIds([])}
                      className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>

              {categories.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                  No categories created in the system yet. Create categories first.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {categories.map(cat => {
                    const isSelected = productEditCategoryIds.includes(cat.id);

                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setProductEditCategoryIds(prev =>
                            prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                          );
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold block">{cat.name}</span>
                            {!cat.active && (
                              <span className="text-xs text-slate-500 font-bold">(Inactive)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
              <span className="font-bold">Multi-Category Note:</span> Assigning this product to multiple categories will make it appear under each category during catalogue search and filtering without duplicating product inventory.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditProductCategoriesModal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditProductCategories}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Save Category Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 6: BULK ADD CATEGORIES                         */}
      {/* ---------------------------------------------------- */}
      {showBulkAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Bulk Action</span>
                <h3 className="text-base font-black text-slate-800">Add Categories ({selectedProductIds.length} Products)</h3>
              </div>
              <button 
                onClick={() => setShowBulkAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select one or more categories to <span className="font-bold text-slate-700">append</span> to the {selectedProductIds.length} selected products. All existing category assignments will be preserved.
            </p>

            {categories.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-500">{bulkSelectedCategoryIds.length} of {categories.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkSelectedCategoryIds(categories.map(c => c.id))}
                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Select All ({categories.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setBulkSelectedCategoryIds([])}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {categories.map(cat => {
                const isSelected = bulkSelectedCategoryIds.includes(cat.id);

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setBulkSelectedCategoryIds(prev =>
                        prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                      );
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'bg-indigo-50 border-indigo-500 font-bold text-indigo-900' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs">{cat.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkAddModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSelectedCategoryIds.length === 0}
                onClick={handleConfirmBulkAdd}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Add Categories
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 7: BULK REPLACE CATEGORIES (WITH CONFIRMATION) */}
      {/* ---------------------------------------------------- */}
      {showBulkReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Replace Action</span>
                <h3 className="text-base font-black text-slate-800">Replace Categories ({selectedProductIds.length} Products)</h3>
              </div>
              <button 
                onClick={() => setShowBulkReplaceModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Admin Confirmation Required</span>
              </div>
              <p className="text-xs leading-relaxed">
                This action will <span className="font-black underline">remove all currently assigned categories</span> on the {selectedProductIds.length} selected products and apply only the newly selected categories.
              </p>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-500">{bulkSelectedCategoryIds.length} of {categories.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkSelectedCategoryIds(categories.map(c => c.id))}
                    className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
                  >
                    Select All ({categories.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setBulkSelectedCategoryIds([])}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {categories.map(cat => {
                const isSelected = bulkSelectedCategoryIds.includes(cat.id);

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setBulkSelectedCategoryIds(prev =>
                        prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                      );
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'bg-amber-50 border-amber-500 font-bold text-amber-900' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-amber-600 cursor-pointer"
                      />
                      <span className="text-xs">{cat.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkReplaceModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkReplace}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                Confirm &amp; Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 8: BULK REMOVE CATEGORIES                      */}
      {/* ---------------------------------------------------- */}
      {showBulkRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Bulk Remove</span>
                <h3 className="text-base font-black text-slate-800">Remove Categories ({selectedProductIds.length} Products)</h3>
              </div>
              <button 
                onClick={() => setShowBulkRemoveModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Select categories to remove from the {selectedProductIds.length} selected products:
            </p>

            {categories.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-500">{bulkSelectedCategoryIds.length} of {categories.length} selected</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkSelectedCategoryIds(categories.map(c => c.id))}
                    className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Select All ({categories.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setBulkSelectedCategoryIds([])}
                    className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {categories.map(cat => {
                const isSelected = bulkSelectedCategoryIds.includes(cat.id);

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setBulkSelectedCategoryIds(prev =>
                        prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                      );
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'bg-red-50 border-red-500 font-bold text-red-900' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-red-600 cursor-pointer"
                      />
                      <span className="text-xs">{cat.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkRemoveModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSelectedCategoryIds.length === 0}
                onClick={handleConfirmBulkRemove}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                Remove from Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
