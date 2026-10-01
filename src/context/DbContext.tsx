'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  db, Profile, Retailer, Product, Inventory, InventoryBatch, StockLedgerEntry, 
  Order, OrderChannel, Fulfilment, Invoice, InvoiceItem, Purchase, Payment, SalesReturn, Company, Supplier,
  BillingRateAuditLog, BillingRateRecord, DeliveryChallan, FifoBatchSuggestion, BatchAllocation,
  Category, ProductCategory, ItemActivityLog, VyaparImportBatch, InvoiceAuditLog, CustomerCreditProfile, CustomerLedgerEntry,
  BusinessCompany, CompanyMember, Godown, StockTransfer, StockTransferItem,
  calculateBaseQuantity, splitBaseQuantity, formatQuantityDisplay, formatItemQuantityDisplay, formatUnitName, calculateItemAmounts,
  calculateItemQuantities, calculateOrderQuantities, deriveOrderChannel,
  OrderItemQuantities, OrderQuantities, OrderComputedStatus,
  getPendingItemsForRetailer, checkSingleItemPendingWarning, PendingOrderItemWarning, PendingOrderRef, CartItemToCheck,
  CashFlowTransaction, CompanyOpeningBalance, CashFlowType, CashFlowPaymentMode, CashFlowSource, CashFlowStatus,
  TradeMode, formatAutoBoxQuantity, formatProductStockDisplay, getProductTradeMode, AutoBoxResult,
  DatabaseBackupSnapshot
} from '@/lib/db';

export type { PendingOrderItemWarning, PendingOrderRef, CartItemToCheck, CashFlowTransaction, CompanyOpeningBalance, CustomerCreditProfile, CustomerLedgerEntry, TradeMode, AutoBoxResult, DatabaseBackupSnapshot };

export interface RetailerCartItem {
  cartonQty: number;
  looseQty: number;
}

export interface SalespersonCartItem {
  cartonQty: number;
  looseQty: number;
  cartonDiscount: number;
  looseDiscount: number;
}

interface DbContextType {
  // Multi-Company / Multi-Business Tenant Context
  activeCompanyId: string;
  activeCompany: BusinessCompany;
  authorizedCompanies: BusinessCompany[];
  isSwitchingCompany: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  createBusinessCompany: (data: Parameters<typeof db.createBusinessCompany>[0]) => BusinessCompany;
  updateBusinessCompany: (id: string, updates: Parameters<typeof db.updateBusinessCompany>[1]) => BusinessCompany | null;

  // Multi-Godown & Warehouses Management
  godowns: Godown[];
  selectedGodownId: string;
  setSelectedGodownId: (godownId: string) => void;
  stockTransfers: StockTransfer[];
  getConsolidatedInventory: () => (Inventory & {
    godownBreakdown: {
      [godownId: string]: {
        physical: number;
        reserved: number;
        available: number;
        damaged: number;
        expired: number;
      };
    };
  })[];
  getGodowns: (targetBusinessId?: string) => Godown[];
  getDefaultGodown: (targetBusinessId?: string) => Godown | undefined;
  createGodown: (data: Omit<Godown, 'id' | 'created_at' | 'updated_at'>) => Godown;
  updateGodown: (id: string, updates: Partial<Godown>) => Godown | null;
  setDefaultGodown: (id: string) => Godown | null;
  toggleGodownStatus: (id: string) => Godown | null;
  getStockTransfers: () => StockTransfer[];
  createStockTransfer: (data: Parameters<typeof db.createStockTransfer>[0]) => StockTransfer;
  dispatchStockTransfer: (transferId: string) => StockTransfer;
  receiveStockTransfer: (transferId: string, itemReceipts?: Parameters<typeof db.receiveStockTransfer>[1]) => StockTransfer;
  cancelStockTransfer: (transferId: string) => StockTransfer;

  currentUser: Profile;
  setCurrentUser: (id: string) => void;
  profiles: Profile[];
  companies: Company[];
  suppliers: Supplier[];
  retailers: Retailer[];
  products: Product[];
  categories: Category[];
  productCategories: ProductCategory[];
  inventory: Inventory[];
  batches: InventoryBatch[];
  ledger: StockLedgerEntry[];
  orders: Order[];
  fulfilments: Fulfilment[];
  invoices: Invoice[];
  deliveryChallans: DeliveryChallan[];
  purchases: Purchase[];
  payments: Payment[];
  salesReturns: SalesReturn[];
  auditLogs: BillingRateAuditLog[];
  invoiceAuditLogs: InvoiceAuditLog[];
  itemActivityLogs: ItemActivityLog[];
  vyaparImports: VyaparImportBatch[];
  refreshState: () => void;
  
  // Cart states
  retailerCart: { [cartKey: string]: any };
  setRetailerCart: React.Dispatch<React.SetStateAction<{ [cartKey: string]: any }>>;
  salespersonCart: { [cartKey: string]: any };
  setSalespersonCart: React.Dispatch<React.SetStateAction<{ [cartKey: string]: any }>>;

  // Rate History & Manual Overrides
  getLastBillingRates: (retailerId: string, productId: string, tradingUnit?: string, limit?: number) => BillingRateRecord[];
  getFifoBatchSuggestions: (productId: string, requiredQty: number, selectedGodown?: string, targetMrp?: number) => FifoBatchSuggestion[];
  getCustomerCreditProfile: (retailerId: string, companyId?: string) => CustomerCreditProfile;
  postSalesInvoiceAtomic: (payload: Parameters<typeof db.postSalesInvoiceAtomic>[0]) => ReturnType<typeof db.postSalesInvoiceAtomic>;
  saveBillingRateAuditLog: (log: Omit<BillingRateAuditLog, 'id' | 'created_at'>) => BillingRateAuditLog;
  getBillingRateAuditLogs: () => BillingRateAuditLog[];
  getInvoiceAuditLogs: (invoiceId?: string) => InvoiceAuditLog[];
  updateInvoice: (
    invoiceId: string,
    updatedData: {
      date?: string;
      place_of_supply?: string;
      items: InvoiceItem[];
      paid_amount?: number;
    },
    reason: string,
    adminUser?: { id: string; name: string }
  ) => ReturnType<typeof db.updateInvoice>;
  updateFulfilmentItemManualRate: (fulfilmentId: string, fulfilmentItemId: string, manualRate: number | null | undefined, reason?: string) => boolean;

  // Single Order Direct Workflow
  updateOrderStatus: (orderId: string, status: Order['status'], notes?: string) => Order | null;
  confirmOrderQuantities: (orderId: string, itemConfirms: { itemId: string; confirmedQty: number }[]) => Order | null;
  updateOrderItemRate: (orderId: string, itemId: string, newRate: number, flatDiscount?: number, reason?: string, adminUser?: { id: string; name: string }) => Order | null;
  fullyConfirmOrder: (orderId: string, adminUser?: { id: string; name: string }) => Order | null;
  confirmOrder: (orderId: string, itemConfirms: { itemId: string; confirmedCartons?: number; confirmedQty?: number; pendingReason?: string }[], adminUser?: { id: string; name: string }) => Order | null;
  clearAllOrders: () => void;
  updateOrderItemFulfillment: (
    orderId: string,
    itemId: string,
    data: {
      confirmed_qty?: number;
      pending_reason?: string;
      cancel_qty?: number;
      cancel_reason?: string;
      backordered?: boolean;
    },
    adminUser?: { id: string; name: string }
  ) => Order | null;
  cancelOrderItemQuantity: (
    orderId: string,
    itemId: string,
    cancelQty: number,
    cancelReason: string,
    adminUser?: { id: string; name: string }
  ) => Order | null;
  addOrderItemToOrder: (
    orderId: string,
    itemData: {
      productId: string;
      selectedMrp?: number;
      pieceQty?: number;
      cartonQty: number;
      looseQty?: number;
      unitRate?: number;
      notes?: string;
    },
    adminUser?: { id: string; name: string }
  ) => Order | null;
  shortCloseBackorderItem: (
    orderId: string,
    itemId: string,
    reason: string,
    adminUser?: { id: string; name: string }
  ) => Order | null;
  allocateAndPackOrder: (
    orderId: string,
    allocations: {
      orderItemId: string;
      batchAllocations: BatchAllocation[];
    }[]
  ) => Order | null;
  dispatchOrder: (
    orderId: string,
    dispatchInfo?: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      dispatchGodown?: string;
      generateChallan?: boolean;
    },
    adminUser?: { id: string; name: string }
  ) => { order: Order; invoice: Invoice; challan?: DeliveryChallan } | null;
  dispatchRetailerPackingLot: (
    lotData: {
      retailerId: string;
      sourceOrderIds: string[];
      items: {
        originOrderId: string;
        originItemId: string;
        productId: string;
        productName: string;
        sku: string;
        mrp: number;
        unitsPerPack: number;
        tradingUnit: string;
        baseUnit: string;
        orderedCartons: number;
        orderedLoose?: number;
        packedCartons: number;
        packedLoose?: number;
        unitRate: number;
        purchaseCost: number;
        hsn?: string;
      }[];
    },
    dispatchInfo?: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      generateChallan?: boolean;
    },
    adminUser?: { id: string; name: string }
  ) => { invoice: Invoice; challan?: DeliveryChallan; updatedOrders: Order[] } | null;
  saveLotPackingProgress: (
    lotData: {
      retailerId: string;
      sourceOrderIds: string[];
      items: {
        originOrderId: string;
        originItemId: string;
        productId: string;
        packedPieces: number;
        packedCartons?: number;
        packedLoose?: number;
        unitRate?: number;
        notes?: string;
      }[];
    },
    adminUser?: { id: string; name: string }
  ) => { updatedOrders: Order[] } | null;
  completeOrder: (orderId: string, adminUser?: { id: string; name: string }) => Order | null;
  recordOrderPayment: (
    orderId: string,
    invoiceId: string,
    amount: number,
    method: Payment['method'],
    refNumber?: string,
    notes?: string,
    adminUser?: { id: string; name: string }
  ) => Payment | { id: string; type: 'credit_confirmed'; invoice_id: string } | null;
  getDeliveryChallans: () => DeliveryChallan[];
  getDeliveryChallanByOrderId: (orderId: string) => DeliveryChallan | undefined;
  getDeliveryChallanById: (challanId: string) => DeliveryChallan | undefined;

  // Conversion & formatting helpers
  calculateBaseQuantity: (cartonQty?: number, looseQty?: number, unitsPerTradingUnit?: number) => number;
  splitBaseQuantity: (totalBaseQty?: number, unitsPerTradingUnit?: number) => { cartonQty: number; looseQty: number };
  formatQuantityDisplay: (totalBaseQty?: number, unitsPerTradingUnit?: number, tradingUnit?: string, baseUnit?: string, includeTotalBadge?: boolean) => string;
  formatItemQuantityDisplay: typeof formatItemQuantityDisplay;
  formatUnitName: typeof formatUnitName;
  calculateItemAmounts: (cartonQty?: number, looseQty?: number, cartonRate?: number, looseRate?: number, cartonDiscount?: number, looseDiscount?: number, gstPercent?: number) => {
    grossAmount: number;
    discountAmount: number;
    taxableAmount: number;
    gstAmount: number;
    totalAmount: number;
    finalRate?: number;
    netTotal?: number;
  };
  calculateItemQuantities: typeof calculateItemQuantities;
  calculateOrderQuantities: typeof calculateOrderQuantities;
  deriveOrderChannel: typeof deriveOrderChannel;

  // Pending Item / Duplicate Order Warning System
  getPendingItemsForRetailer: (retailerId: string, cartItems: CartItemToCheck[], companyId?: string) => PendingOrderItemWarning[];
  checkSingleItemPendingWarning: (retailerId: string, productId: string, cartonQty?: number, looseQty?: number, packSize?: string, selectedMrp?: number, companyId?: string) => PendingOrderItemWarning | null;
  logPendingOrderProceedActivity: (retailerId: string, warnings: PendingOrderItemWarning[], newOrderNumber?: string) => void;

  // Consolidated Transactions
  placeOrder: (order: Omit<Order, 'id' | 'order_number' | 'status' | 'order_date'>) => Order;
  deleteOrder: (orderId: string) => boolean;
  removeOrderItem: (orderId: string, itemId: string) => Order | null;
  updateOrderItemQuantity: (orderId: string, itemId: string, cartonQty: number, looseQty: number) => Order | null;
  consolidateOrders: (retailerId: string, orderIds: string[]) => Fulfilment;
  getOrCreateActiveFulfilment: (retailerId: string) => Fulfilment;
  confirmConsolidation: (
    fulfilmentId: string,
    itemConfirms: {
      itemId: string;
      confirmedQty: number;
      manualRate?: number | null;
      rateReason?: string;
      discount?: number;
      cartonRate?: number;
      looseRate?: number;
      cartonDiscount?: number;
      looseDiscount?: number;
    }[]
  ) => Fulfilment | null;
  packConsolidation: (
    fulfilmentId: string,
    itemsWithAllocations: {
      fulfilmentItemId: string;
      batch_allocations: BatchAllocation[];
    }[]
  ) => Fulfilment | null;
  dispatchConsolidation: (
    fulfilmentId: string,
    dispatchInfo?: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      dispatchGodown?: string;
    }
  ) => Invoice | null;
  deliverConsolidation: (fulfilmentId: string) => Fulfilment | null;
  cancelConsolidation: (fulfilmentId: string) => Fulfilment | null;
  fulfilPendingItem: (orderId: string, orderItemId: string, confirmedQty: number) => Fulfilment | null;
  cancelPendingItem: (orderId: string, orderItemId: string, quantityToCancel: number, reason: string) => boolean;
  makeCounterSale: (
    retailerId: string,
    items: {
      productId: string;
      quantity?: number;
      cartonQty?: number;
      looseQty?: number;
      discount?: number;
      cartonDiscount?: number;
      looseDiscount?: number;
    }[],
    paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Credit' | 'Other'
  ) => Invoice;
  makePurchase: (purchase: Omit<Purchase, 'id' | 'status' | 'created_at'>) => Purchase;
  payInvoice: (retailerId: string, amount: number, method: Payment['method'], refNum?: string, notes?: string) => Payment;
  createDirectSalesReturn: (data: Parameters<typeof db.createDirectSalesReturn>[0]) => SalesReturn;
  returnSales: (
    invoiceId: string,
    items: {
      productId: string;
      quantity?: number;
      cartonQty?: number;
      looseQty?: number;
      tradingUnit?: 'Box' | 'Carton' | string;
      condition: 'Sellable' | 'Damaged';
    }[],
    reason: string
  ) => SalesReturn;
  createSupplier: (name: string, gstin: string, address: string) => Supplier;
  createCompany: (name: string, code?: string) => Company;
  deleteCompany: (id: string, options?: { handleLinkedProducts?: 'unlink' | 'cascade' | 'error' }) => { success: boolean; message?: string; affectedProducts?: number };
  createRetailer: (data: Parameters<typeof db.createRetailer>[0]) => Retailer;
  updateRetailer: (id: string, updates: Partial<Retailer>) => Retailer | null;
  createRetailerProfile: (data: Parameters<typeof db.createRetailerProfile>[0]) => { retailer: Retailer; profile: Profile };
  createSalespersonProfile: (data: Parameters<typeof db.createSalespersonProfile>[0]) => Profile;
  updateSalespersonProfile: (id: string, updates: Parameters<typeof db.updateSalespersonProfile>[1]) => Profile | null;
  createStaffProfile: (data: Parameters<typeof db.createStaffProfile>[0]) => Profile;
  updateStaffProfile: (id: string, updates: Parameters<typeof db.updateStaffProfile>[1]) => Profile | null;
  updateRetailerProfile: (retailerId: string, updates: Parameters<typeof db.updateRetailerProfile>[1]) => { retailer: Retailer; profile: Profile | null } | null;
  resetProfilePassword: (profileId: string, newPassword: string) => boolean;
  toggleProfileStatus: (profileId: string, forcedStatus?: boolean) => Profile | null;
  updateProfile: (id: string, updates: Partial<Profile>) => Profile | null;
  createProduct: (...args: Parameters<typeof db.createProduct>) => Product;
  createFullProduct: (productData: Parameters<typeof db.createFullProduct>[0]) => Product;
  createProductVariant: (parentProductId: string, variantData: Parameters<typeof db.createProductVariant>[1]) => Product;
  updateRetailerCreditLimit: (id: string, limit: number) => void;

  // Item Master Direct Control
  updateProduct: (productId: string, updates: Partial<Product>) => Product | null;
  deleteProduct: (productId: string) => boolean;
  bulkUpdateProducts: (
    productIds: string[],
    updates: Partial<Product>,
    categoryIds?: string[]
  ) => { updatedCount: number; products: Product[] };
  bulkDeleteProducts: (
    productIds: string[]
  ) => { deletedCount: number; deletedIds: string[] };
  toggleProductStatus: (productId: string) => Product | null;
  adjustStock: (
    productId: string,
    adjustmentQty: number,
    direction: 'IN' | 'OUT',
    reason: string,
    notes?: string,
    batchNumber?: string,
    godown?: string,
    cartonQty?: number,
    looseQty?: number,
    godownId?: string
  ) => Inventory | null;
  getItemActivityLogs: (productId?: string) => ItemActivityLog[];
  addItemActivityLog: (log: Omit<ItemActivityLog, 'id' | 'created_at'>) => ItemActivityLog;

  // Category Management & Multi-Category Assignments
  createCategory: (name: string, description?: string, active?: boolean) => Category;
  updateCategory: (id: string, data: { name?: string; description?: string; active?: boolean }) => Category | null;
  toggleCategoryStatus: (id: string) => Category | null;
  deleteCategory: (id: string) => boolean;
  assignCategoriesToProduct: (productId: string, categoryIds: string[]) => ProductCategory[];
  removeCategoryFromProduct: (productId: string, categoryId: string) => boolean;
  setProductCategories: (productId: string, categoryIds: string[]) => ProductCategory[];
  bulkAddCategoriesToProducts: (productIds: string[], categoryIds: string[]) => void;
  bulkReplaceCategoriesForProducts: (productIds: string[], categoryIds: string[]) => void;
  bulkRemoveCategoriesFromProducts: (productIds: string[], categoryIds: string[]) => void;
  bulkRemoveProductsFromCategory: (categoryId: string, productIds: string[]) => void;
  getCategoriesForProduct: (productId: string) => Category[];
  getCategoryIdsForProduct: (productId: string) => string[];
  getProductsForCategory: (categoryId: string) => Product[];
  getProductCountForCategory: (categoryId: string) => number;
  updateProductWithCategories: (productId: string, updates: Partial<Product>, categoryIds?: string[]) => Product | null;

  // Category Access Permissions & Assignments (Retailers & Salespersons)
  updateCategoryAssignments: (id: string, data: {
    salesperson_access_type?: 'all' | 'restricted';
    assigned_salesperson_ids?: string[];
    retailer_access_type?: 'all' | 'restricted';
    assigned_retailer_ids?: string[];
  }) => Category | null;
  updateSalespersonCategoryAssignments: (profileId: string, categoryIds: string[], accessMode?: 'all' | 'custom') => Profile | null;
  updateRetailerCategoryAssignments: (retailerId: string, categoryIds: string[], accessMode?: 'all' | 'custom') => Retailer | null;
  getAssignedCategoriesForSalesperson: (salespersonId: string) => Category[];
  getAssignedCategoriesForRetailer: (retailerId: string) => Category[];
  isProductVisibleToSalesperson: (productId: string, salespersonId: string) => boolean;
  isProductVisibleToRetailer: (productId: string, retailerId: string) => boolean;

  // Vyapar Product & Stock Import
  getVyaparImports: () => VyaparImportBatch[];
  executeVyaparBatchImport: (
    rowsToImport: any[],
    meta: {
      file_name: string;
      file_size?: number;
      column_mapping: Record<string, string>;
      user_id?: string;
      user_name?: string;
    }
  ) => { importId: string; batch: VyaparImportBatch };
  rollbackVyaparImport: (importId: string, reason?: string, userName?: string) => { success: boolean; message: string };

  // Catalog Purge & State Operations
  purgeAllDemoProductsAndInventory: () => void;

  // Cash Flow Financial Module
  cashFlowTransactions: CashFlowTransaction[];
  companyOpeningBalance: CompanyOpeningBalance;
  createCashFlowTransaction: (
    data: Omit<CashFlowTransaction, 'id' | 'transaction_number' | 'status' | 'created_at'>,
    adminUser?: { id: string; name: string }
  ) => CashFlowTransaction;
  updateCashFlowTransaction: (
    id: string,
    updates: Partial<CashFlowTransaction>,
    reason: string,
    adminUser?: { id: string; name: string }
  ) => CashFlowTransaction | null;
  voidCashFlowTransaction: (
    id: string,
    reason: string,
    adminUser?: { id: string; name: string }
  ) => CashFlowTransaction | null;
  updateCompanyOpeningBalance: (
    balance: CompanyOpeningBalance
  ) => void;
  refreshCashFlow: () => void;

  // Database Backup & Restore Utility
  exportFullDatabaseBackup: () => DatabaseBackupSnapshot;
  restoreFullDatabaseBackup: (backup: any) => { success: boolean; message: string; counts: Record<string, number> };
}

const DbContext = createContext<DbContextType | undefined>(undefined);

export function DbProvider({ children }: { children: React.ReactNode }) {
  // Multi-Company Tenant State
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => db.getInitialActiveBusinessCompanyId());
  const [activeCompany, setActiveCompany] = useState<BusinessCompany>(() => db.getInitialBusinessCompanies()[0]);
  const [authorizedCompanies, setAuthorizedCompanies] = useState<BusinessCompany[]>(() => db.getInitialBusinessCompanies());
  const [isSwitchingCompany, setIsSwitchingCompany] = useState<boolean>(false);

  const [godowns, setGodowns] = useState<Godown[]>(() => db.getInitialGodowns());
  const [selectedGodownId, setSelectedGodownId] = useState<string>('all');
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => db.getInitialStockTransfers());

  const [currentUser, setCurrentUserState] = useState<Profile>(() => db.getInitialCurrentUser());
  const [profiles, setProfiles] = useState<Profile[]>(() => db.getInitialProfiles());
  const [companies, setCompanies] = useState<Company[]>(() => db.getInitialCompanies());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => db.getInitialSuppliers());
  const [retailers, setRetailers] = useState<Retailer[]>(() => db.getInitialRetailers());
  const [products, setProducts] = useState<Product[]>(() => db.getInitialProducts());
  const [categories, setCategories] = useState<Category[]>(() => db.getInitialCategories());
  const [productCategories, setProductCategoriesState] = useState<ProductCategory[]>(() => db.getInitialProductCategories());
  const [inventory, setInventory] = useState<Inventory[]>(() => db.getInitialInventory());
  const [batches, setBatches] = useState<InventoryBatch[]>(() => db.getInitialBatches());
  const [ledger, setLedger] = useState<StockLedgerEntry[]>(() => db.getInitialLedger());
  const [orders, setOrders] = useState<Order[]>(() => db.getInitialOrders());
  const [fulfilments, setFulfilments] = useState<Fulfilment[]>(() => db.getInitialFulfilments());
  const [invoices, setInvoices] = useState<Invoice[]>(() => db.getInitialInvoices());
  const [deliveryChallans, setDeliveryChallans] = useState<DeliveryChallan[]>(() => db.getInitialDeliveryChallans());
  const [purchases, setPurchases] = useState<Purchase[]>(() => db.getInitialPurchases());
  const [payments, setPayments] = useState<Payment[]>(() => db.getInitialPayments());
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>(() => db.getInitialSalesReturns());
  const [auditLogs, setAuditLogs] = useState<BillingRateAuditLog[]>(() => db.getInitialAuditLogs());
  const [invoiceAuditLogs, setInvoiceAuditLogs] = useState<InvoiceAuditLog[]>(() => db.getInitialInvoiceAuditLogs());
  const [itemActivityLogs, setItemActivityLogs] = useState<ItemActivityLog[]>(() => db.getInitialItemActivityLogs());
  const [vyaparImports, setVyaparImports] = useState<VyaparImportBatch[]>(() => db.getInitialVyaparImports());
  const [cashFlowTransactions, setCashFlowTransactions] = useState<CashFlowTransaction[]>(() => db.getCashFlowTransactions());
  const [companyOpeningBalance, setCompanyOpeningBalance] = useState<CompanyOpeningBalance>(() => db.getCompanyOpeningBalance());

  // persistent cart states
  const [retailerCart, setRetailerCart] = useState<{ [prodId: string]: number }>({});
  const [salespersonCart, setSalespersonCart] = useState<{ [prodId: string]: { quantity: number; discount: number } }>({});

  const loadData = useCallback(() => {
    const activeId = db.getActiveBusinessCompanyId();
    setActiveCompanyId(activeId);
    setActiveCompany(db.getActiveBusinessCompany());
    setAuthorizedCompanies([...db.getUserAuthorizedBusinesses()]);
    setGodowns([...db.getGodowns(activeId)]);
    setStockTransfers([...db.getStockTransfers(activeId)]);
    setProfiles([...db.getProfiles()]);
    setCompanies([...db.getCompanies()]);
    setSuppliers([...db.getSuppliers(activeId)]);
    setRetailers([...db.getRetailers(activeId)]);
    setProducts([...db.getProducts(activeId)]);
    setCategories([...db.getCategories(activeId)]);
    setProductCategoriesState([...db.getProductCategories(activeId)]);
    setInventory([...db.getInventory(activeId)]);
    setBatches([...db.getBatches(activeId)]);
    setLedger([...db.getLedger(activeId)]);
    setOrders([...db.getOrders(activeId)]);
    setFulfilments([...db.getFulfilments(activeId)]);
    setInvoices([...db.getInvoices(activeId)]);
    setDeliveryChallans([...db.getDeliveryChallans(activeId)]);
    setPurchases([...db.getPurchases(activeId)]);
    setPayments([...db.getPayments(activeId)]);
    setSalesReturns([...db.getSalesReturns(activeId)]);
    setAuditLogs([...db.getBillingRateAuditLogs(activeId)]);
    setInvoiceAuditLogs([...db.getInvoiceAuditLogs(undefined, activeId)]);
    setItemActivityLogs([...db.getItemActivityLogs(undefined, activeId)]);
    setVyaparImports([...db.getVyaparImports(activeId)]);
    setCashFlowTransactions([...db.getCashFlowTransactions(activeId)]);
    setCompanyOpeningBalance(db.getCompanyOpeningBalance(activeId));
    setCurrentUserState(db.getCurrentUser());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const switchCompany = useCallback(async (companyId: string) => {
    setIsSwitchingCompany(true);
    db.setActiveBusinessCompanyId(companyId);
    setActiveCompanyId(companyId);
    setActiveCompany(db.getActiveBusinessCompany());
    // Clear in-memory carts for clean separation between companies
    setRetailerCart({});
    setSalespersonCart({});
    loadData();
    setTimeout(() => {
      setIsSwitchingCompany(false);
    }, 250);
  }, [loadData]);

  const createBusinessCompany = (data: Parameters<typeof db.createBusinessCompany>[0]) => {
    const res = db.createBusinessCompany(data);
    loadData();
    return res;
  };

  const updateBusinessCompany = (id: string, updates: Parameters<typeof db.updateBusinessCompany>[1]) => {
    const res = db.updateBusinessCompany(id, updates);
    loadData();
    return res;
  };

  const refreshState = () => {
    loadData();
  };

  const setCurrentUser = (id: string) => {
    db.setCurrentUser(id);
    setCurrentUserState(db.getCurrentUser());
    // Clear carts on user account switch to prevent cross-session cart bleeding
    setRetailerCart({});
    setSalespersonCart({});
  };

  const getLastBillingRates = (retailerId: string, productId: string, tradingUnit?: string, limit: number = 5) => {
    return db.getLastBillingRates(retailerId, productId, tradingUnit, limit);
  };

  const getFifoBatchSuggestions = (productId: string, requiredQty: number, selectedGodown?: string, targetMrp?: number) => {
    return db.getFifoBatchSuggestions(productId, requiredQty, selectedGodown, targetMrp);
  };

  const saveBillingRateAuditLog = (log: Omit<BillingRateAuditLog, 'id' | 'created_at'>) => {
    const res = db.saveBillingRateAuditLog(log);
    refreshState();
    return res;
  };

  const getBillingRateAuditLogs = () => {
    return db.getBillingRateAuditLogs();
  };

  const getInvoiceAuditLogs = (invoiceId?: string) => {
    return db.getInvoiceAuditLogs(invoiceId);
  };

  const updateInvoice = (
    invoiceId: string,
    updatedData: {
      date?: string;
      place_of_supply?: string;
      items: InvoiceItem[];
      paid_amount?: number;
    },
    reason: string,
    adminUser?: { id: string; name: string }
  ) => {
    const res = db.updateInvoice(invoiceId, updatedData, reason, adminUser);
    refreshState();
    return res;
  };

  const updateFulfilmentItemManualRate = (
    fulfilmentId: string,
    fulfilmentItemId: string,
    manualRate: number | null | undefined,
    reason?: string
  ) => {
    const res = db.updateFulfilmentItemManualRate(fulfilmentId, fulfilmentItemId, manualRate, reason);
    refreshState();
    return res;
  };

  // Direct Order Workflow Methods
  const updateOrderStatus = (orderId: string, status: Order['status'], notes?: string) => {
    const res = db.updateOrderStatus(orderId, status, notes);
    refreshState();
    return res;
  };

  const addOrderItemToOrder = (
    orderId: string,
    itemData: {
      productId: string;
      selectedMrp?: number;
      pieceQty?: number;
      cartonQty: number;
      looseQty?: number;
      unitRate?: number;
      notes?: string;
    },
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.addOrderItemToOrder(orderId, itemData, user);
    refreshState();
    return res;
  };

  const shortCloseBackorderItem = (
    orderId: string,
    itemId: string,
    reason: string,
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.shortCloseBackorderItem(orderId, itemId, reason, user);
    refreshState();
    return res;
  };

  const confirmOrderQuantities = (orderId: string, itemConfirms: { itemId: string; confirmedQty: number }[]) => {
    const res = db.confirmOrderQuantities(orderId, itemConfirms);
    refreshState();
    return res;
  };

  const allocateAndPackOrder = (
    orderId: string,
    allocations: {
      orderItemId: string;
      batchAllocations: BatchAllocation[];
    }[]
  ) => {
    const res = db.allocateAndPackOrder(orderId, allocations);
    refreshState();
    return res;
  };

  const dispatchOrder = (
    orderId: string,
    dispatchInfo?: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      dispatchGodown?: string;
      generateChallan?: boolean;
    },
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.dispatchOrder(orderId, dispatchInfo, user);
    refreshState();
    return res;
  };

  const dispatchRetailerPackingLot = (
    lotData: {
      retailerId: string;
      sourceOrderIds: string[];
      items: {
        originOrderId: string;
        originItemId: string;
        productId: string;
        productName: string;
        sku: string;
        mrp: number;
        unitsPerPack: number;
        tradingUnit: string;
        baseUnit: string;
        orderedCartons: number;
        orderedLoose?: number;
        packedCartons: number;
        packedLoose?: number;
        unitRate: number;
        purchaseCost: number;
        hsn?: string;
      }[];
    },
    dispatchInfo?: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      generateChallan?: boolean;
    },
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.dispatchRetailerPackingLot(lotData, dispatchInfo, user);
    refreshState();
    return res;
  };

  const saveLotPackingProgress = (
    lotData: {
      retailerId: string;
      sourceOrderIds: string[];
      items: {
        originOrderId: string;
        originItemId: string;
        productId: string;
        packedPieces: number;
        packedCartons?: number;
        packedLoose?: number;
        unitRate?: number;
        notes?: string;
      }[];
    },
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.saveLotPackingProgress(lotData, user);
    refreshState();
    return res;
  };

  const completeOrder = (orderId: string, adminUser?: { id: string; name: string }) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.completeOrder(orderId, user);
    refreshState();
    return res;
  };

  const recordOrderPayment = (
    orderId: string,
    invoiceId: string,
    amount: number,
    method: Payment['method'],
    refNumber?: string,
    notes?: string,
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.recordOrderPayment(orderId, invoiceId, amount, method, refNumber, notes, user);
    refreshState();
    return res;
  };

  const getDeliveryChallans = () => {
    return db.getDeliveryChallans();
  };

  const getDeliveryChallanByOrderId = (orderId: string) => {
    return db.getDeliveryChallanByOrderId(orderId);
  };

  const getDeliveryChallanById = (challanId: string) => {
    return db.getDeliveryChallanById(challanId);
  };

  const placeOrder = (orderData: Omit<Order, 'id' | 'order_number' | 'status' | 'order_date'>) => {
    const res = db.createOrder(orderData);
    refreshState();
    return res;
  };

  const deleteOrder = (orderId: string) => {
    const res = db.deleteOrder(orderId);
    refreshState();
    return res;
  };

  const removeOrderItem = (orderId: string, itemId: string) => {
    const res = db.removeOrderItem(orderId, itemId);
    refreshState();
    return res;
  };

  const updateOrderItemQuantity = (orderId: string, itemId: string, cartonQty: number, looseQty: number) => {
    const res = db.updateOrderItemQuantity(orderId, itemId, cartonQty, looseQty);
    refreshState();
    return res;
  };

  const consolidateOrders = (retailerId: string, orderIds: string[]) => {
    const res = db.consolidateRetailerOrders(retailerId, orderIds);
    refreshState();
    return res;
  };

  const getOrCreateActiveFulfilment = (retailerId: string) => {
    const res = db.getOrCreateActiveFulfilment(retailerId);
    refreshState();
    return res;
  };

  const confirmConsolidation = (
    fulfilmentId: string,
    itemConfirms: {
      itemId: string;
      confirmedQty: number;
      manualRate?: number | null;
      rateReason?: string;
      discount?: number;
      cartonRate?: number;
      looseRate?: number;
      cartonDiscount?: number;
      looseDiscount?: number;
    }[]
  ) => {
    const res = db.confirmFulfilment(fulfilmentId, itemConfirms);
    refreshState();
    return res;
  };

  const packConsolidation = (
    fulfilmentId: string,
    itemsWithAllocations: {
      fulfilmentItemId: string;
      batch_allocations: BatchAllocation[];
    }[]
  ) => {
    const res = db.packFulfilment(fulfilmentId, itemsWithAllocations);
    refreshState();
    return res;
  };

  const dispatchConsolidation = (
    fulfilmentId: string,
    dispatchInfo?: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      dispatchGodown?: string;
    }
  ) => {
    const res = db.dispatchFulfilment(fulfilmentId, dispatchInfo);
    refreshState();
    return res;
  };

  const deliverConsolidation = (fulfilmentId: string) => {
    const res = db.deliverFulfilment(fulfilmentId);
    refreshState();
    return res;
  };

  const cancelConsolidation = (fulfilmentId: string) => {
    const res = db.cancelFulfilment(fulfilmentId);
    refreshState();
    return res;
  };
  const updateOrderItemRate = (
    orderId: string,
    itemId: string,
    newRate: number,
    flatDiscount: number = 0,
    reason: string = 'Admin Approved Rate Override',
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.updateOrderItemRate(orderId, itemId, newRate, flatDiscount, reason, user);
    refreshState();
    return res;
  };

  const fullyConfirmOrder = (orderId: string, adminUser?: { id: string; name: string }) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.fullyConfirmOrder(orderId, user);
    refreshState();
    return res;
  };

  const confirmOrder = (
    orderId: string,
    itemConfirms: { itemId: string; confirmedCartons?: number; confirmedQty?: number; pendingReason?: string }[],
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.confirmOrder(orderId, itemConfirms, user);
    refreshState();
    return res;
  };

  const clearAllOrders = useCallback(() => {
    db.clearAllOrders();
    refreshState();
  }, [refreshState]);

  const updateOrderItemFulfillment = (
    orderId: string,
    itemId: string,
    data: {
      confirmed_qty?: number;
      pending_reason?: string;
      cancel_qty?: number;
      cancel_reason?: string;
      backordered?: boolean;
    },
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.updateOrderItemFulfillment(orderId, itemId, data, user);
    refreshState();
    return res;
  };

  const cancelOrderItemQuantity = (
    orderId: string,
    itemId: string,
    cancelQty: number,
    cancelReason: string,
    adminUser?: { id: string; name: string }
  ) => {
    const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
    const res = db.cancelOrderItemQuantity(orderId, itemId, cancelQty, cancelReason, user);
    refreshState();
    return res;
  };

  const fulfilPendingItem = (orderId: string, orderItemId: string, confirmedQty: number) => {
    const res = db.fulfilPendingItem(orderId, orderItemId, confirmedQty);
    refreshState();
    return res;
  };

  const cancelPendingItem = (orderId: string, orderItemId: string, quantityToCancel: number, reason: string) => {
    const res = db.cancelPendingItem(orderId, orderItemId, quantityToCancel, reason);
    refreshState();
    return res;
  };

  const makeCounterSale = (
    retailerId: string,
    items: {
      productId: string;
      quantity?: number;
      cartonQty?: number;
      looseQty?: number;
      discount?: number;
      cartonDiscount?: number;
      looseDiscount?: number;
    }[],
    paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Credit' | 'Other'
  ) => {
    const res = db.createCounterSale(retailerId, items, paymentMethod);
    refreshState();
    return res;
  };

  const makePurchase = (purchaseData: Omit<Purchase, 'id' | 'status' | 'created_at'>) => {
    const res = db.confirmPurchase(purchaseData);
    refreshState();
    return res;
  };

  const payInvoice = (retailerId: string, amount: number, method: Payment['method'], refNum?: string, notes?: string) => {
    const res = db.recordPayment(retailerId, amount, method, refNum, notes);
    refreshState();
    return res;
  };

  const createDirectSalesReturn = (data: Parameters<typeof db.createDirectSalesReturn>[0]) => {
    const res = db.createDirectSalesReturn(data);
    refreshState();
    return res;
  };

  const returnSales = (
    invoiceId: string,
    items: {
      productId: string;
      quantity?: number;
      cartonQty?: number;
      looseQty?: number;
      tradingUnit?: 'Box' | 'Carton' | string;
      condition: 'Sellable' | 'Damaged';
    }[],
    reason: string
  ) => {
    const res = db.processSalesReturn(invoiceId, items, reason);
    refreshState();
    return res;
  };

  const createSupplier = (name: string, gstin: string, address: string) => {
    const res = db.createSupplier(name, gstin, address);
    refreshState();
    return res;
  };

  const createCompany = (name: string, code?: string) => {
    const res = db.createCompany(name, code);
    loadData();
    refreshState();
    return res;
  };

  const createProduct = (...args: Parameters<typeof db.createProduct>) => {
    const res = db.createProduct(...args);
    refreshState();
    return res;
  };

  const createFullProduct = (productData: Parameters<typeof db.createFullProduct>[0]) => {
    const res = db.createFullProduct(productData);
    refreshState();
    return res;
  };

  const createProductVariant = (parentProductId: string, variantData: Parameters<typeof db.createProductVariant>[1]) => {
    const res = db.createProductVariant(parentProductId, variantData);
    refreshState();
    return res;
  };

  const createRetailer = (data: Parameters<typeof db.createRetailer>[0]) => {
    const res = db.createRetailer(data);
    refreshState();
    return res;
  };

  const updateRetailer = (id: string, updates: Partial<Retailer>) => {
    const res = db.updateRetailer(id, updates);
    refreshState();
    return res;
  };

  const updateRetailerCreditLimit = (id: string, limit: number) => {
    const rets = db.getRetailers();
    const ret = rets.find(r => r.id === id);
    if (ret) {
      ret.credit_limit = limit;
      db.saveRetailers(rets);
      refreshState();
    }
  };

  const createRetailerProfile = (data: Parameters<typeof db.createRetailerProfile>[0]) => {
    const res = db.createRetailerProfile(data);
    refreshState();
    return res;
  };

  const createSalespersonProfile = (data: Parameters<typeof db.createSalespersonProfile>[0]) => {
    const res = db.createSalespersonProfile(data);
    refreshState();
    return res;
  };

  const updateSalespersonProfile = (id: string, updates: Parameters<typeof db.updateSalespersonProfile>[1]) => {
    const res = db.updateSalespersonProfile(id, updates);
    refreshState();
    return res;
  };

  const createStaffProfile = (data: Parameters<typeof db.createStaffProfile>[0]) => {
    const res = db.createStaffProfile(data);
    refreshState();
    return res;
  };

  const updateStaffProfile = (id: string, updates: Parameters<typeof db.updateStaffProfile>[1]) => {
    const res = db.updateStaffProfile(id, updates);
    refreshState();
    return res;
  };

  const updateRetailerProfile = (retailerId: string, updates: Parameters<typeof db.updateRetailerProfile>[1]) => {
    const res = db.updateRetailerProfile(retailerId, updates);
    refreshState();
    return res;
  };

  const resetProfilePassword = (profileId: string, newPassword: string) => {
    const res = db.resetProfilePassword(profileId, newPassword);
    refreshState();
    return res;
  };

  const toggleProfileStatus = (profileId: string, forcedStatus?: boolean) => {
    const res = db.toggleProfileStatus(profileId, forcedStatus);
    refreshState();
    return res;
  };

  const updateProfile = (id: string, updates: Partial<Profile>) => {
    const res = db.updateProfile(id, updates);
    refreshState();
    return res;
  };

  // Category Management & Multi-Category Assignments
  const createCategory = (name: string, description?: string, active: boolean = true) => {
    const res = db.createCategory(name, description, active);
    refreshState();
    return res;
  };

  const updateCategory = (id: string, data: { name?: string; description?: string; active?: boolean }) => {
    const res = db.updateCategory(id, data);
    refreshState();
    return res;
  };

  const toggleCategoryStatus = (id: string) => {
    const res = db.toggleCategoryStatus(id);
    refreshState();
    return res;
  };

  const deleteCategory = (id: string) => {
    const res = db.deleteCategory(id);
    refreshState();
    return res;
  };

  const assignCategoriesToProduct = (productId: string, categoryIds: string[]) => {
    const res = db.assignCategoriesToProduct(productId, categoryIds);
    refreshState();
    return res;
  };

  const removeCategoryFromProduct = (productId: string, categoryId: string) => {
    const res = db.removeCategoryFromProduct(productId, categoryId);
    refreshState();
    return res;
  };

  const setProductCategories = (productId: string, categoryIds: string[]) => {
    const res = db.setProductCategories(productId, categoryIds);
    refreshState();
    return res;
  };

  const bulkAddCategoriesToProducts = (productIds: string[], categoryIds: string[]) => {
    db.bulkAddCategoriesToProducts(productIds, categoryIds);
    refreshState();
  };

  const bulkReplaceCategoriesForProducts = (productIds: string[], categoryIds: string[]) => {
    db.bulkReplaceCategoriesForProducts(productIds, categoryIds);
    refreshState();
  };

  const bulkRemoveCategoriesFromProducts = (productIds: string[], categoryIds: string[]) => {
    db.bulkRemoveCategoriesFromProducts(productIds, categoryIds);
    refreshState();
  };

  const bulkRemoveProductsFromCategory = (categoryId: string, productIds: string[]) => {
    db.bulkRemoveProductsFromCategory(categoryId, productIds);
    refreshState();
  };

  const getCategoriesForProduct = (productId: string) => {
    return db.getCategoriesForProduct(productId);
  };

  const getCategoryIdsForProduct = (productId: string) => {
    return db.getCategoryIdsForProduct(productId);
  };

  const getProductsForCategory = (categoryId: string) => {
    return db.getProductsForCategory(categoryId);
  };

  const getProductCountForCategory = (categoryId: string) => {
    return db.getProductCountForCategory(categoryId);
  };

  const updateCategoryAssignments = (id: string, data: {
    salesperson_access_type?: 'all' | 'restricted';
    assigned_salesperson_ids?: string[];
    retailer_access_type?: 'all' | 'restricted';
    assigned_retailer_ids?: string[];
  }) => {
    const res = db.updateCategoryAssignments(id, data);
    refreshState();
    return res;
  };

  const updateSalespersonCategoryAssignments = (profileId: string, categoryIds: string[], accessMode: 'all' | 'custom' = 'custom') => {
    const res = db.updateSalespersonCategoryAssignments(profileId, categoryIds, accessMode);
    refreshState();
    return res;
  };

  const updateRetailerCategoryAssignments = (retailerId: string, categoryIds: string[], accessMode: 'all' | 'custom' = 'custom') => {
    const res = db.updateRetailerCategoryAssignments(retailerId, categoryIds, accessMode);
    refreshState();
    return res;
  };

  const getAssignedCategoriesForSalesperson = (salespersonId: string) => {
    return db.getAssignedCategoriesForSalesperson(salespersonId);
  };

  const getAssignedCategoriesForRetailer = (retailerId: string) => {
    return db.getAssignedCategoriesForRetailer(retailerId);
  };

  const isProductVisibleToSalesperson = (productId: string, salespersonId: string) => {
    return db.isProductVisibleToSalesperson(productId, salespersonId);
  };

  const isProductVisibleToRetailer = (productId: string, retailerId: string) => {
    return db.isProductVisibleToRetailer(productId, retailerId);
  };

  const deleteCompany = (id: string, options?: { handleLinkedProducts?: 'unlink' | 'cascade' | 'error' }) => {
    const res = db.deleteCompany(id, options);
    if (res.success) {
      loadData();
      refreshState();
      try {
        fetch(`/api/admin/companies/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: options?.handleLinkedProducts || 'error' })
        }).catch(e => console.warn('[DbContext] API company delete sync:', e));
      } catch {}
    }
    return res;
  };

  const updateProduct = (productId: string, updates: Partial<Product>) => {
    const res = db.updateProduct(productId, updates);
    refreshState();
    return res;
  };

  const deleteProduct = (productId: string) => {
    const res = db.deleteProduct(productId);
    loadData();
    refreshState();
    return res;
  };

  const toggleProductStatus = (productId: string) => {
    const res = db.toggleProductStatus(productId);
    refreshState();
    return res;
  };

  const adjustStock = (
    productId: string,
    adjustmentQty: number,
    direction: 'IN' | 'OUT',
    reason: string,
    notes?: string,
    batchNumber?: string,
    godown?: string,
    cartonQty?: number,
    looseQty?: number,
    godownId?: string
  ) => {
    const res = db.adjustStock(productId, adjustmentQty, direction, reason, notes, batchNumber, godown, cartonQty, looseQty, godownId);
    refreshState();
    return res;
  };

  const getItemActivityLogs = (productId?: string) => {
    return db.getItemActivityLogs(productId);
  };

  const addItemActivityLog = (log: Omit<ItemActivityLog, 'id' | 'created_at'>) => {
    const res = db.addItemActivityLog(log);
    refreshState();
    return res;
  };

  const updateProductWithCategories = (productId: string, updates: Partial<Product>, categoryIds?: string[]) => {
    const res = db.updateProductWithCategories(productId, updates, categoryIds);
    refreshState();
    return res;
  };

  const bulkUpdateProducts = (
    productIds: string[],
    updates: Partial<Product>,
    categoryIds?: string[]
  ) => {
    const res = db.bulkUpdateProducts(productIds, updates, categoryIds);
    loadData();
    refreshState();
    return res;
  };

  const bulkDeleteProducts = (productIds: string[]) => {
    const res = db.bulkDeleteProducts(productIds);
    loadData();
    refreshState();
    return res;
  };


  const getPendingItemsForRetailerHelper = (
    retailerId: string,
    cartItems: CartItemToCheck[],
    companyId?: string
  ): PendingOrderItemWarning[] => {
    const effectiveCompId = companyId || activeCompanyId;
    return getPendingItemsForRetailer(retailerId, orders, products, cartItems, effectiveCompId);
  };

  const checkSingleItemPendingWarningHelper = (
    retailerId: string,
    productId: string,
    cartonQty: number = 0,
    looseQty: number = 0,
    packSize?: string,
    selectedMrp?: number,
    companyId?: string
  ): PendingOrderItemWarning | null => {
    const effectiveCompId = companyId || activeCompanyId;
    return checkSingleItemPendingWarning(
      retailerId,
      productId,
      orders,
      products,
      cartonQty,
      looseQty,
      packSize,
      selectedMrp,
      effectiveCompId
    );
  };

  const logPendingOrderProceedActivity = (
    retailerId: string,
    warnings: PendingOrderItemWarning[],
    newOrderNumber?: string
  ) => {
    if (!warnings || warnings.length === 0) return;
    const ret = retailers.find(r => r.id === retailerId);
    const retailerName = ret?.shop_name || 'Retailer';
    const activeBiz = activeCompanyId;

    warnings.forEach(w => {
      const prevOrderNums = Array.from(new Set(w.pendingOrders.map(p => p.orderNumber))).join(', ');
      const user = currentUser?.name || 'User';

      db.addItemActivityLog({
        product_id: w.productId,
        action: 'Pending Item Warning → User Proceeded With New Order',
        details: `Retailer: ${retailerName} (${ret?.retailer_code || 'RET'}) | Variant: ${w.packSize} | Existing Pending: ${w.totalPendingDisplay} (${prevOrderNums}) | New Order: ${w.newOrderDisplay}${newOrderNumber ? ` [${newOrderNumber}]` : ''} | Acknowledged & Proceeded by ${user}`,
        old_value: `Pending: ${w.totalPendingDisplay}`,
        new_value: `New Order: ${w.newOrderDisplay}`,
        user_id: currentUser?.id || 'system',
        user_name: user,
        business_id: activeBiz
      });
    });
    refreshState();
  };

  return (
    <DbContext.Provider
      value={{
        activeCompanyId,
        activeCompany,
        authorizedCompanies,
        isSwitchingCompany,
        switchCompany,
        createBusinessCompany,
        updateBusinessCompany,
        godowns,
        selectedGodownId,
        setSelectedGodownId,
        stockTransfers,
        getConsolidatedInventory: () => db.getConsolidatedInventory(activeCompanyId),
        getGodowns: (targetBiz?: string) => db.getGodowns(targetBiz || activeCompanyId),
        getDefaultGodown: (targetBiz?: string) => db.getDefaultGodown(targetBiz || activeCompanyId),
        createGodown: (data) => {
          const res = db.createGodown(data, activeCompanyId);
          loadData();
          return res;
        },
        updateGodown: (id, updates) => {
          const res = db.updateGodown(id, updates, activeCompanyId);
          loadData();
          return res;
        },
        setDefaultGodown: (id) => {
          const res = db.setDefaultGodown(id, activeCompanyId);
          loadData();
          return res;
        },
        toggleGodownStatus: (id) => {
          const res = db.toggleGodownStatus(id, activeCompanyId);
          loadData();
          return res;
        },
        getStockTransfers: () => db.getStockTransfers(activeCompanyId),
        createStockTransfer: (data) => {
          const res = db.createStockTransfer(data, activeCompanyId);
          loadData();
          return res;
        },
        dispatchStockTransfer: (transferId) => {
          const res = db.dispatchStockTransfer(transferId, activeCompanyId);
          loadData();
          return res;
        },
        receiveStockTransfer: (transferId, itemReceipts) => {
          const res = db.receiveStockTransfer(transferId, itemReceipts, activeCompanyId);
          loadData();
          return res;
        },
        cancelStockTransfer: (transferId) => {
          const res = db.cancelStockTransfer(transferId, activeCompanyId);
          loadData();
          return res;
        },
        currentUser,
        setCurrentUser,
        profiles,
        companies,
        suppliers,
        retailers,
        products,
        categories,
        productCategories,
        inventory,
        batches,
        ledger,
        orders,
        fulfilments,
        invoices,
        deliveryChallans,
        purchases,
        payments,
        salesReturns,
        auditLogs,
        itemActivityLogs,
        refreshState,
        retailerCart,
        setRetailerCart,
        salespersonCart,
        setSalespersonCart,
        calculateBaseQuantity,
        splitBaseQuantity,
        formatQuantityDisplay,
        formatItemQuantityDisplay,
        formatUnitName,
        calculateItemAmounts,
        calculateItemQuantities,
        calculateOrderQuantities,
        deriveOrderChannel,
        getPendingItemsForRetailer: getPendingItemsForRetailerHelper,
        checkSingleItemPendingWarning: checkSingleItemPendingWarningHelper,
        logPendingOrderProceedActivity,
        updateOrderItemRate,
        fullyConfirmOrder,
        confirmOrder,
        clearAllOrders,
        updateOrderItemFulfillment,
        cancelOrderItemQuantity,
        addOrderItemToOrder,
        shortCloseBackorderItem,
        getLastBillingRates,
        getFifoBatchSuggestions,
        saveBillingRateAuditLog,
        getBillingRateAuditLogs,
        updateFulfilmentItemManualRate,
        updateOrderStatus,
        confirmOrderQuantities,
        allocateAndPackOrder,
        dispatchOrder,
        dispatchRetailerPackingLot,
        saveLotPackingProgress,
        completeOrder,
        recordOrderPayment,
        getDeliveryChallans,
        getDeliveryChallanByOrderId,
        getDeliveryChallanById,
        placeOrder,
        deleteOrder,
        removeOrderItem,
        updateOrderItemQuantity,
        consolidateOrders,
        getOrCreateActiveFulfilment,
        confirmConsolidation,
        packConsolidation,
        dispatchConsolidation,
        deliverConsolidation,
        cancelConsolidation,
        fulfilPendingItem,
        cancelPendingItem,
        makeCounterSale,
        makePurchase,
        payInvoice,
        createDirectSalesReturn,
        returnSales,
        createSupplier,
        createCompany,
        deleteCompany,
        createRetailer,
        updateRetailer,
        createRetailerProfile,
        createSalespersonProfile,
        updateSalespersonProfile,
        createStaffProfile,
        updateStaffProfile,
        updateRetailerProfile,
        resetProfilePassword,
        toggleProfileStatus,
        updateProfile,
        createProduct,
        createFullProduct,
        createProductVariant,
        updateProduct,
        deleteProduct,
        toggleProductStatus,
        adjustStock,
        getItemActivityLogs,
        addItemActivityLog,
        updateRetailerCreditLimit,
        invoiceAuditLogs,
        getInvoiceAuditLogs,
        getCustomerCreditProfile: (retailerId, companyId) => db.getCustomerCreditProfile(retailerId, companyId || activeCompanyId),
        postSalesInvoiceAtomic: (payload) => {
          const res = db.postSalesInvoiceAtomic({
            ...payload,
            business_company_id: payload.business_company_id || activeCompanyId
          });
          refreshState();
          return res;
        },
        updateInvoice,
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
        bulkUpdateProducts,
        bulkDeleteProducts,
        updateCategoryAssignments,
        updateSalespersonCategoryAssignments,
        updateRetailerCategoryAssignments,
        getAssignedCategoriesForSalesperson,
        getAssignedCategoriesForRetailer,
        isProductVisibleToSalesperson,
        isProductVisibleToRetailer,
        vyaparImports,
        getVyaparImports: () => db.getVyaparImports(),
        executeVyaparBatchImport: (rowsToImport, meta) => {
          const res = db.executeVyaparBatchImport(rowsToImport, meta);
          loadData();
          return res;
        },
        rollbackVyaparImport: (importId, reason, userName) => {
          const res = db.rollbackVyaparImport(importId, reason, userName);
          loadData();
          return res;
        },
        purgeAllDemoProductsAndInventory: () => {
          db.purgeAllDemoProductsAndInventory();
          loadData();
        },

        // Cash Flow Module
        cashFlowTransactions,
        companyOpeningBalance,
        createCashFlowTransaction: (data, adminUser) => {
          const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
          const res = db.createCashFlowTransaction(data, user);
          refreshState();
          return res;
        },
        updateCashFlowTransaction: (id, updates, reason, adminUser) => {
          const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
          const res = db.updateCashFlowTransaction(id, updates, reason, user);
          refreshState();
          return res;
        },
        voidCashFlowTransaction: (id, reason, adminUser) => {
          const user = adminUser || (currentUser ? { id: currentUser.id, name: currentUser.name } : undefined);
          const res = db.voidCashFlowTransaction(id, reason, user);
          refreshState();
          return res;
        },
        updateCompanyOpeningBalance: (balance) => {
          db.saveCompanyOpeningBalance(balance);
          refreshState();
        },
        refreshCashFlow: () => {
          refreshState();
        },

        // Database Backup & Restore
        exportFullDatabaseBackup: () => db.exportFullDatabaseBackup(),
        restoreFullDatabaseBackup: (backup: any) => {
          const res = db.restoreFullDatabaseBackup(backup);
          loadData();
          refreshState();
          return res;
        }
      }}
    >
      {children}
    </DbContext.Provider>
  );
}

export function useDb() {
  const context = useContext(DbContext);
  if (context === undefined) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return context;
}
