/**
 * Comprehensive FMCG Distributor Reports Aggregation & Analytics Engine
 * Saifee General Stores FMCG Distribution Management System
 */

import { 
  Invoice, Order, Fulfilment, Product, Retailer, Company, Profile, 
  Purchase, Payment, SalesReturn, InventoryBatch, Inventory, StockLedgerEntry, Supplier,
  BillingRateRecord
} from './db';

// ----------------------------------------------------
// FILTER STATE INTERFACE
// ----------------------------------------------------

export type DatePreset = 
  | 'today' 
  | 'yesterday' 
  | 'this_week' 
  | 'this_month' 
  | 'prev_month' 
  | 'current_quarter' 
  | 'prev_quarter' 
  | 'current_fy' 
  | 'prev_fy' 
  | 'custom'
  | 'all';

export interface ReportFilterState {
  datePreset: DatePreset;
  customStartDate?: string;
  customEndDate?: string;
  companyId?: string;
  category?: string;
  brand?: string;
  productId?: string;
  variantPacking?: string;
  retailerId?: string;
  salespersonId?: string;
  paymentStatus?: 'All' | 'Paid' | 'Partial' | 'Unpaid';
  orderStatus?: string;
  invoiceStatus?: string;
  batchNumber?: string;
  expiryStatus?: 'All' | 'valid' | '30d' | '60d' | '90d' | 'expired';
  godown?: string;
  channel?: string;
  searchQuery?: string;
}

export interface DbState {
  invoices: Invoice[];
  orders: Order[];
  fulfilments: Fulfilment[];
  products: Product[];
  retailers: Retailer[];
  companies: Company[];
  profiles: Profile[];
  purchases: Purchase[];
  payments: Payment[];
  salesReturns: SalesReturn[];
  batches: InventoryBatch[];
  inventory: Inventory[];
  ledger: StockLedgerEntry[];
  suppliers: Supplier[];
  godowns?: any[];
  categories?: any[];
}

export interface UserContext {
  role: 'admin' | 'sales_dist' | 'sales_co' | 'retailer' | 'staff';
  userId?: string;
  companyId?: string;
  retailerId?: string;
}

// ----------------------------------------------------
// DATE UTILITIES (Supporting Indian Financial Year: Apr 1 - Mar 31)
// ----------------------------------------------------

export function getDateRangeFromPreset(preset: DatePreset, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (preset) {
    case 'today': {
      return { start: startOfToday, end: today };
    }
    case 'yesterday': {
      const yestStart = new Date(startOfToday);
      yestStart.setDate(yestStart.getDate() - 1);
      const yestEnd = new Date(yestStart);
      yestEnd.setHours(23, 59, 59, 999);
      return { start: yestStart, end: yestEnd };
    }
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      return { start: monday, end: today };
    }
    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: firstDay, end: today };
    }
    case 'prev_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: firstDay, end: lastDay };
    }
    case 'current_quarter': {
      // Indian Financial Quarters: Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
      const month = now.getMonth(); // 0-indexed: 0=Jan, 3=Apr, 6=Jul, 8=Sep
      let qStartMonth = 0;
      if (month >= 3 && month <= 5) qStartMonth = 3;
      else if (month >= 6 && month <= 8) qStartMonth = 6;
      else if (month >= 9 && month <= 11) qStartMonth = 9;
      else qStartMonth = 0;

      const qStart = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
      return { start: qStart, end: today };
    }
    case 'prev_quarter': {
      const month = now.getMonth();
      let prevQStartMonth = 0;
      let prevQYear = now.getFullYear();

      if (month >= 3 && month <= 5) {
        prevQStartMonth = 0; // Jan-Mar
      } else if (month >= 6 && month <= 8) {
        prevQStartMonth = 3; // Apr-Jun
      } else if (month >= 9 && month <= 11) {
        prevQStartMonth = 6; // Jul-Sep
      } else {
        prevQStartMonth = 9; // Oct-Dec prev year
        prevQYear -= 1;
      }

      const qStart = new Date(prevQYear, prevQStartMonth, 1, 0, 0, 0, 0);
      const qEnd = new Date(prevQYear, prevQStartMonth + 3, 0, 23, 59, 59, 999);
      return { start: qStart, end: qEnd };
    }
    case 'current_fy': {
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0); // Apr 1
      const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999); // Mar 31
      return { start, end };
    }
    case 'prev_fy': {
      const currentYear = now.getFullYear();
      const fyStartYear = (now.getMonth() >= 3 ? currentYear : currentYear - 1) - 1;
      const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
      return { start, end };
    }
    case 'custom': {
      const start = customStart ? new Date(customStart + 'T00:00:00') : new Date(2020, 0, 1);
      const end = customEnd ? new Date(customEnd + 'T23:59:59.999') : today;
      return { start, end };
    }
    case 'all':
    default: {
      return { start: new Date(2020, 0, 1), end: new Date(2035, 11, 31) };
    }
  }
}

export function isDateInRange(dateStr: string | undefined | null, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= range.start && d <= range.end;
}

export function formatINR(amount: number | undefined | null, maximumFractionDigits = 2): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 2 : 0
  })}`;
}

export function formatTradingUnit(unit: string): string {
  if (!unit) return '';
  const u = unit.toLowerCase();
  if (u.includes('carton')) return 'CTN';
  if (u.includes('box')) return 'BOX';
  if (u.includes('case')) return 'CASE';
  if (u.includes('bag')) return 'BAG';
  return unit.toUpperCase();
}

// ----------------------------------------------------
// RBAC SANITIZER & FILTER PREPARATION
// ----------------------------------------------------

export function applyRbacFilters(filters: ReportFilterState, user: UserContext): ReportFilterState {
  const secureFilters = { ...filters };
  if (user.role === 'retailer' && user.retailerId) {
    secureFilters.retailerId = user.retailerId;
  }
  if (user.role === 'sales_co' && user.companyId) {
    secureFilters.companyId = user.companyId;
  }
  if (user.role === 'sales_dist' && user.userId) {
    secureFilters.salespersonId = user.userId;
  }
  return secureFilters;
}

// ----------------------------------------------------
// SALESPERSON LINKAGE & RESOLUTION HELPERS
// ----------------------------------------------------

export function getOrderSalespersonId(order: Order, db: DbState): string | undefined {
  if (order.created_by) {
    const p = db.profiles.find(prof => prof.id === order.created_by);
    if (p && (p.role === 'sales_dist' || p.role === 'sales_co')) return p.id;
    if (p) return p.id;
  }

  // Check if order items belong exclusively to a company that has a company salesperson
  if (order.items && order.items.length > 0) {
    const compIds = Array.from(new Set(order.items.map(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      return prod?.company_id;
    }).filter(Boolean)));

    if (compIds.length === 1) {
      const coSalesperson = db.profiles.find(p => p.role === 'sales_co' && p.company_id === compIds[0]);
      if (coSalesperson) return coSalesperson.id;
    }
  }

  // Default deterministic territory allocation to distributor sales reps based on retailer/order
  const distSalesReps = db.profiles.filter(p => p.role === 'sales_dist');
  if (distSalesReps.length > 0) {
    const key = order.retailer_id || order.id || order.order_number;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % distSalesReps.length;
    return distSalesReps[idx].id;
  }

  return undefined;
}

export function getInvoiceSalespersonId(inv: Invoice, db: DbState): string | undefined {
  if ((inv as any).created_by) {
    const p = db.profiles.find(prof => prof.id === (inv as any).created_by);
    if (p && (p.role === 'sales_dist' || p.role === 'sales_co')) return p.id;
    if (p) return p.id;
  }
  if ((inv as any).salesperson_id) {
    const p = db.profiles.find(prof => prof.id === (inv as any).salesperson_id);
    if (p) return p.id;
  }

  // Look up order_ref_id
  if (inv.order_ref_id) {
    const order = db.orders.find(o => o.id === inv.order_ref_id || o.order_number === inv.order_ref_id);
    if (order) {
      const spId = getOrderSalespersonId(order, db);
      if (spId) return spId;
    }

    const ful = db.fulfilments.find(f => f.id === inv.order_ref_id || f.fulfilment_number === inv.order_ref_id);
    if (ful?.source_order_ids && ful.source_order_ids.length > 0) {
      const srcOrd = db.orders.find(o => (ful.source_order_ids?.includes(o.id) || ful.source_order_ids?.includes(o.order_number)));
      if (srcOrd) {
        const spId = getOrderSalespersonId(srcOrd, db);
        if (spId) return spId;
      }
    }
  }

  // Look up source_order_ids
  if (inv.source_order_ids && inv.source_order_ids.length > 0) {
    const srcOrd = db.orders.find(o => (inv.source_order_ids?.includes(o.id) || inv.source_order_ids?.includes(o.order_number)));
    if (srcOrd) {
      const spId = getOrderSalespersonId(srcOrd, db);
      if (spId) return spId;
    }
  }

  const orderNums = inv.source_order_numbers || inv.order_numbers;
  if (orderNums && orderNums.length > 0) {
    const srcOrd = db.orders.find(o => (orderNums.includes(o.order_number) || orderNums.includes(o.id)));
    if (srcOrd) {
      const spId = getOrderSalespersonId(srcOrd, db);
      if (spId) return spId;
    }
  }

  // Check if invoice items belong exclusively to a company that has a company salesperson
  if (inv.items && inv.items.length > 0) {
    const compIds = Array.from(new Set(inv.items.map(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      return prod?.company_id;
    }).filter(Boolean)));

    if (compIds.length === 1) {
      const coSalesperson = db.profiles.find(p => p.role === 'sales_co' && p.company_id === compIds[0]);
      if (coSalesperson) return coSalesperson.id;
    }
  }

  // Default deterministic territory allocation to distributor sales reps based on retailer/invoice:
  const distSalesReps = db.profiles.filter(p => p.role === 'sales_dist');
  if (distSalesReps.length > 0) {
    const key = inv.retailer_id || inv.id;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % distSalesReps.length;
    return distSalesReps[idx].id;
  }

  return undefined;
}

export function getInvoiceSalespersonName(inv: Invoice, db: DbState): string {
  const spId = getInvoiceSalespersonId(inv, db);
  if (spId) {
    const profile = db.profiles.find(p => p.id === spId);
    if (profile) return profile.name;
  }
  return 'Distributor Sales';
}

export function getOrderSalespersonName(order: Order, db: DbState): string {
  const spId = getOrderSalespersonId(order, db);
  if (spId) {
    const profile = db.profiles.find(p => p.id === spId);
    if (profile) return profile.name;
  }
  return 'Distributor Sales';
}

export function isInvoiceMatchingSalesperson(
  inv: Invoice,
  salespersonId: string | undefined,
  db: DbState
): boolean {
  if (!salespersonId) return true;
  const resolvedSpId = getInvoiceSalespersonId(inv, db);
  return resolvedSpId === salespersonId;
}

export function isOrderMatchingSalesperson(
  order: Order,
  salespersonId: string | undefined,
  db: DbState
): boolean {
  if (!salespersonId) return true;
  const resolvedSpId = getOrderSalespersonId(order, db);
  return resolvedSpId === salespersonId;
}

// ----------------------------------------------------
// SEARCH FILTER HELPERS
// ----------------------------------------------------

export function isInvoiceMatchingSearch(
  inv: Invoice,
  query: string | undefined,
  db: DbState
): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // 1. Invoice Number or ID
  if (inv.invoice_number?.toLowerCase().includes(q)) return true;
  if (inv.id?.toLowerCase().includes(q)) return true;
  if (inv.order_ref_id?.toLowerCase().includes(q)) return true;

  // 2. Retailer Info
  const ret = db.retailers.find(r => r.id === inv.retailer_id);
  if (ret) {
    if (ret.shop_name?.toLowerCase().includes(q)) return true;
    if (ret.owner_name?.toLowerCase().includes(q)) return true;
    if (ret.city?.toLowerCase().includes(q)) return true;
    if (ret.phone?.includes(q)) return true;
    if (ret.gstin?.toLowerCase().includes(q)) return true;
  }

  // 3. Salesperson Info
  const spName = getInvoiceSalespersonName(inv, db);
  if (spName?.toLowerCase().includes(q)) return true;

  // 4. Line Items / Product Info
  if (inv.items && inv.items.length > 0) {
    const hasItemMatch = inv.items.some(item => {
      if ((item as any).product_name?.toLowerCase().includes(q)) return true;
      if (item.packing?.toLowerCase().includes(q)) return true;
      if ((item as any).hsn_code?.toLowerCase().includes(q)) return true;
      const prod = db.products.find(p => p.id === item.product_id);
      if (prod) {
        if (prod.name?.toLowerCase().includes(q)) return true;
        if (prod.brand?.toLowerCase().includes(q)) return true;
        if (prod.category?.toLowerCase().includes(q)) return true;
        if (prod.hsn?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
    if (hasItemMatch) return true;
  }

  return false;
}

export function isOrderMatchingSearch(
  order: Order,
  query: string | undefined,
  db: DbState
): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (order.order_number?.toLowerCase().includes(q)) return true;
  if (order.id?.toLowerCase().includes(q)) return true;

  const ret = db.retailers.find(r => r.id === order.retailer_id);
  if (ret) {
    if (ret.shop_name?.toLowerCase().includes(q)) return true;
    if (ret.owner_name?.toLowerCase().includes(q)) return true;
    if (ret.city?.toLowerCase().includes(q)) return true;
  }

  const sp = db.profiles.find(p => p.id === order.created_by);
  if (sp && sp.name?.toLowerCase().includes(q)) return true;

  if (order.items && order.items.length > 0) {
    const hasItemMatch = order.items.some(item => {
      if (item.product_name?.toLowerCase().includes(q)) return true;
      const prod = db.products.find(p => p.id === item.product_id);
      if (prod) {
        if (prod.name?.toLowerCase().includes(q)) return true;
        if (prod.brand?.toLowerCase().includes(q)) return true;
        if (prod.category?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
    if (hasItemMatch) return true;
  }

  return false;
}

// ----------------------------------------------------
// UNIVERSAL INVOICE REPORT FILTER HELPER
// ----------------------------------------------------

export function isInvoiceMatchingReportFilters(
  inv: Invoice,
  f: ReportFilterState,
  db: DbState,
  dateRange: { start: Date; end: Date }
): boolean {
  if (!isDateInRange(inv.date, dateRange)) return false;
  if (f.searchQuery && !isInvoiceMatchingSearch(inv, f.searchQuery, db)) return false;
  if (f.retailerId && inv.retailer_id !== f.retailerId) return false;
  if (f.salespersonId && !isInvoiceMatchingSalesperson(inv, f.salespersonId, db)) return false;

  if (f.paymentStatus === 'Paid' && inv.outstanding_amount > 0) return false;
  if (f.paymentStatus === 'Unpaid' && inv.outstanding_amount <= 0) return false;
  if (f.paymentStatus === 'Partial' && (inv.paid_amount === 0 || inv.outstanding_amount === 0)) return false;

  if (f.companyId || f.category || f.brand || f.productId || f.variantPacking) {
    const hasMatchingItem = inv.items?.some(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (!prod) return false;
      if (f.companyId && prod.company_id !== f.companyId) return false;
      if (f.category && prod.category !== f.category) return false;
      if (f.brand && prod.brand !== f.brand) return false;
      if (f.productId && prod.id !== f.productId) return false;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return false;
      return true;
    });
    if (!hasMatchingItem) return false;
  }

  return true;
}

// ----------------------------------------------------
// A. SALES REPORTS
// ----------------------------------------------------

export interface SalesSummaryData {
  grossSales: number;
  salesReturn: number;
  netSales: number;
  discount: number;
  taxableSales: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  netInvoiceValue: number;
  totalCollection: number;
  totalOutstanding: number;
  totalQuantitySold: number;
  invoiceCount: number;
  retailerCount: number;
  averageInvoiceValue: number;
}

export function getSalesSummary(filters: ReportFilterState, db: DbState, user: UserContext): SalesSummaryData {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const matchedInvoices = db.invoices.filter(inv => isInvoiceMatchingReportFilters(inv, f, db, dateRange));

  let grossSales = 0;
  let discount = 0;
  let taxableSales = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let netInvoiceValue = 0;
  let totalCollection = 0;
  let totalOutstanding = 0;
  let grossQuantitySold = 0;
  const uniqueRetailers = new Set<string>();

  matchedInvoices.forEach(inv => {
    uniqueRetailers.add(inv.retailer_id);
    netInvoiceValue += inv.grand_total;
    totalCollection += inv.paid_amount;
    totalOutstanding += inv.outstanding_amount;

    const items = inv.items || [];
    const invLineGrossSum = items.reduce((sum, item) => {
      const prod = db.products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      return sum + (lineTaxable + lineDisc);
    }, 0);

    const invLineDiscountsSum = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const unallocatedBillDiscount = Math.max(0, (inv.discount_amount || 0) - invLineDiscountsSum);

    items.forEach(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      const lineGross = lineTaxable + lineDisc;
      const lineGst = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);

      const itemBillDiscountShare = (invLineGrossSum > 0 && unallocatedBillDiscount > 0)
        ? (lineGross / invLineGrossSum) * unallocatedBillDiscount
        : 0;
      const totalItemDiscount = lineDisc + itemBillDiscountShare;

      grossSales += lineGross;
      discount += totalItemDiscount;
      taxableSales += (lineGross - totalItemDiscount);
      cgst += (item.cgst || 0);
      sgst += (item.sgst || 0);
      igst += (item.igst || 0);
      grossQuantitySold += item.quantity;
    });
  });

  // Calculate sales returns for the matching period & filters
  let salesReturn = 0;
  let returnedQuantity = 0;
  db.salesReturns.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    const retailerId = sr.retailer_id || db.invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
    if (f.retailerId && retailerId !== f.retailerId) return;
    const inv = db.invoices.find(i => i.id === sr.invoice_id);
    if (f.salespersonId && (!inv || !isInvoiceMatchingSalesperson(inv, f.salespersonId, db))) return;

    sr.items?.forEach(sri => {
      const prod = db.products.find(p => p.id === sri.product_id);
      if (f.companyId && prod?.company_id !== f.companyId) return;
      if (f.category && prod?.category !== f.category) return;
      if (f.brand && prod?.brand !== f.brand) return;
      if (f.productId && prod?.id !== f.productId) return;
      if (f.variantPacking && prod?.pack_size !== f.variantPacking) return;

      const unitsPerPack = sri.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = sri.carton_qty !== undefined ? sri.carton_qty : Math.floor(sri.quantity / unitsPerPack);
      const lQty = sri.loose_qty !== undefined ? sri.loose_qty : (sri.quantity % unitsPerPack);
      const cRate = sri.rate;
      const lRate = sri.loose_rate || (cRate / unitsPerPack);
      const rawVal = (cQty * cRate) + (lQty * lRate);
      salesReturn += rawVal;
      returnedQuantity += sri.quantity;
    });
  });

  const netSales = Math.max(0, grossSales - discount - salesReturn);
  const totalQuantitySold = Math.max(0, grossQuantitySold - returnedQuantity);
  const invoiceCount = matchedInvoices.length;
  const averageInvoiceValue = invoiceCount > 0 ? Math.round(netInvoiceValue / invoiceCount) : 0;

  return {
    grossSales: Math.round(grossSales),
    salesReturn: Math.round(salesReturn),
    netSales: Math.round(netSales),
    discount: Math.round(discount),
    taxableSales: Math.round(taxableSales),
    gst: Math.round(cgst + sgst + igst),
    cgst: Math.round(cgst),
    sgst: Math.round(sgst),
    igst: Math.round(igst),
    netInvoiceValue: Math.round(netInvoiceValue),
    totalCollection: Math.round(totalCollection),
    totalOutstanding: Math.round(totalOutstanding),
    totalQuantitySold,
    invoiceCount,
    retailerCount: uniqueRetailers.size,
    averageInvoiceValue
  };
}

export interface ProductWiseSalesRow {
  productId: string;
  productName: string;
  companyName: string;
  category: string;
  brand: string;
  variantPacking: string;
  sku: string;
  tradingUnit: string;
  grossQuantitySold: number;
  returnQuantity: number;
  quantitySold: number;
  grossSales: number;
  discount: number;
  salesReturn: number;
  netSales: number;
  gst: number;
  averageSellingRate: number;
  purchaseCost: number;
  grossProfit: number;
  grossMarginPercent: number;
}

export function getProductWiseSales(filters: ReportFilterState, db: DbState, user: UserContext): ProductWiseSalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const productAggMap = new Map<string, {
    grossQuantity: number;
    returnQuantity: number;
    grossSales: number;
    discount: number;
    taxableValue: number;
    gst: number;
    salesReturn: number;
    totalAmount: number;
    totalCost: number;
  }>();

  // 1. Aggregate from invoice items
  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    const items = inv.items || [];
    const invLineGrossSum = items.reduce((sum, item) => {
      const prod = db.products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      return sum + (lineTaxable + lineDisc);
    }, 0);

    const invLineDiscountsSum = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const unallocatedBillDiscount = Math.max(0, (inv.discount_amount || 0) - invLineDiscountsSum);

    items.forEach(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const curr = productAggMap.get(prod.id) || {
        grossQuantity: 0,
        returnQuantity: 0,
        grossSales: 0,
        discount: 0,
        taxableValue: 0,
        gst: 0,
        salesReturn: 0,
        totalAmount: 0,
        totalCost: 0
      };

      const unitsPerPack = item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      const lineGross = lineTaxable + lineDisc;
      const lineGst = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);

      // Distribute any bill-level extra discount proportionally
      const itemBillDiscountShare = (invLineGrossSum > 0 && unallocatedBillDiscount > 0)
        ? (lineGross / invLineGrossSum) * unallocatedBillDiscount
        : 0;
      const totalItemDiscount = lineDisc + itemBillDiscountShare;

      // Batch cost calculation
      let costRate = prod.purchase_price;
      if (item.batch_number) {
        const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === item.batch_number);
        if (b) costRate = b.purchase_rate;
      }
      const lineCost = (cQty * costRate) + (lQty * (costRate / unitsPerPack));

      curr.grossQuantity += item.quantity;
      curr.grossSales += lineGross;
      curr.discount += totalItemDiscount;
      curr.taxableValue += (lineGross - totalItemDiscount);
      curr.gst += lineGst;
      curr.totalAmount += item.total_amount || (lineTaxable + lineGst);
      curr.totalCost += lineCost;

      productAggMap.set(prod.id, curr);
    });
  });

  // 2. Calculate return adjustments per product
  db.salesReturns.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    const retailerId = sr.retailer_id || db.invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
    if (f.retailerId && retailerId !== f.retailerId) return;
    const inv = db.invoices.find(i => i.id === sr.invoice_id);
    if (f.salespersonId && (!inv || !isInvoiceMatchingSalesperson(inv, f.salespersonId, db))) return;

    sr.items?.forEach(sri => {
      const prod = db.products.find(p => p.id === sri.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = sri.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = sri.carton_qty !== undefined ? sri.carton_qty : Math.floor(sri.quantity / unitsPerPack);
      const lQty = sri.loose_qty !== undefined ? sri.loose_qty : (sri.quantity % unitsPerPack);
      const cRate = sri.rate;
      const lRate = sri.loose_rate || (cRate / unitsPerPack);
      const rawVal = (cQty * cRate) + (lQty * lRate);

      const curr = productAggMap.get(sri.product_id) || {
        grossQuantity: 0,
        returnQuantity: 0,
        grossSales: 0,
        discount: 0,
        taxableValue: 0,
        gst: 0,
        salesReturn: 0,
        totalAmount: 0,
        totalCost: 0
      };

      curr.returnQuantity += sri.quantity;
      curr.salesReturn += rawVal;
      productAggMap.set(sri.product_id, curr);
    });
  });

  const rows: ProductWiseSalesRow[] = [];
  productAggMap.forEach((agg, prodId) => {
    const netQty = Math.max(0, agg.grossQuantity - agg.returnQuantity);
    const netSales = Math.max(0, agg.grossSales - agg.discount - agg.salesReturn);
    if (netQty <= 0 && netSales <= 0 && agg.grossSales <= 0) return;

    const prod = db.products.find(p => p.id === prodId)!;
    const company = db.companies.find(c => c.id === prod.company_id);

    const avgSellingRate = netQty > 0 ? netSales / netQty : (agg.grossQuantity > 0 ? agg.grossSales / agg.grossQuantity : 0);
    const grossProfit = netSales - agg.totalCost;
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const isCostVisible = user.role === 'admin';

    rows.push({
      productId: prod.id,
      productName: prod.name,
      companyName: company?.name || 'Unknown',
      category: prod.category || 'General',
      brand: prod.brand,
      variantPacking: prod.pack_size,
      sku: prod.sku || prod.product_code,
      tradingUnit: formatTradingUnit(prod.trading_unit),
      grossQuantitySold: agg.grossQuantity,
      returnQuantity: agg.returnQuantity,
      quantitySold: netQty,
      grossSales: Math.round(agg.grossSales),
      discount: Math.round(agg.discount),
      salesReturn: Math.round(agg.salesReturn),
      netSales: Math.round(netSales),
      gst: Math.round(agg.gst),
      averageSellingRate: Number(avgSellingRate.toFixed(2)),
      purchaseCost: isCostVisible ? Math.round(agg.totalCost) : 0,
      grossProfit: isCostVisible ? Math.round(grossProfit) : 0,
      grossMarginPercent: isCostVisible ? Number(grossMarginPercent.toFixed(1)) : 0
    });
  });

  return rows.sort((a, b) => b.netSales - a.netSales);
}

export interface DailySalesRow {
  date: string;
  invoiceCount: number;
  retailerCount: number;
  quantitySold: number;
  grossSales: number;
  discount: number;
  salesReturn: number;
  netSales: number;
  gst: number;
  collection: number;
  outstanding: number;
}

export function getDailySales(filters: ReportFilterState, db: DbState, user: UserContext): DailySalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const dateMap = new Map<string, {
    invoiceCount: number;
    retailers: Set<string>;
    quantitySold: number;
    grossSales: number;
    discount: number;
    salesReturn: number;
    returnQuantity: number;
    gst: number;
    netAmount: number;
    collection: number;
    outstanding: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    const dateKey = inv.date.slice(0, 10);
    const curr = dateMap.get(dateKey) || {
      invoiceCount: 0,
      retailers: new Set<string>(),
      quantitySold: 0,
      grossSales: 0,
      discount: 0,
      salesReturn: 0,
      returnQuantity: 0,
      gst: 0,
      netAmount: 0,
      collection: 0,
      outstanding: 0
    };

    const items = inv.items || [];
    const invLineGrossSum = items.reduce((sum, item) => {
      const prod = db.products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      return sum + (lineTaxable + lineDisc);
    }, 0);

    const invLineDiscountsSum = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const unallocatedBillDiscount = Math.max(0, (inv.discount_amount || 0) - invLineDiscountsSum);

    curr.invoiceCount += 1;
    curr.retailers.add(inv.retailer_id);
    curr.collection += inv.paid_amount;
    curr.outstanding += inv.outstanding_amount;
    curr.netAmount += inv.grand_total;

    items.forEach(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      const lineGross = lineTaxable + lineDisc;
      const lineGst = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);

      const itemBillDiscountShare = (invLineGrossSum > 0 && unallocatedBillDiscount > 0)
        ? (lineGross / invLineGrossSum) * unallocatedBillDiscount
        : 0;
      const totalItemDiscount = lineDisc + itemBillDiscountShare;

      curr.grossSales += lineGross;
      curr.discount += totalItemDiscount;
      curr.gst += lineGst;
      curr.quantitySold += item.quantity;
    });

    dateMap.set(dateKey, curr);
  });

  db.salesReturns.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    const retailerId = sr.retailer_id || db.invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
    if (f.retailerId && retailerId !== f.retailerId) return;
    const inv = db.invoices.find(i => i.id === sr.invoice_id);
    if (f.salespersonId && (!inv || !isInvoiceMatchingSalesperson(inv, f.salespersonId, db))) return;

    let retVal = 0;
    let retQty = 0;
    sr.items?.forEach(sri => {
      const prod = db.products.find(p => p.id === sri.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = sri.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = sri.carton_qty !== undefined ? sri.carton_qty : Math.floor(sri.quantity / unitsPerPack);
      const lQty = sri.loose_qty !== undefined ? sri.loose_qty : (sri.quantity % unitsPerPack);
      const cRate = sri.rate;
      const lRate = sri.loose_rate || (cRate / unitsPerPack);
      retVal += (cQty * cRate) + (lQty * lRate);
      retQty += sri.quantity;
    });

    if (retVal > 0 || retQty > 0) {
      const dateKey = sr.return_date.slice(0, 10);
      const curr = dateMap.get(dateKey) || {
        invoiceCount: 0,
        retailers: new Set<string>(),
        quantitySold: 0,
        grossSales: 0,
        discount: 0,
        salesReturn: 0,
        returnQuantity: 0,
        gst: 0,
        netAmount: 0,
        collection: 0,
        outstanding: 0
      };
      curr.salesReturn += retVal;
      curr.returnQuantity += retQty;
      dateMap.set(dateKey, curr);
    }
  });

  const rows: DailySalesRow[] = [];
  dateMap.forEach((agg, dateKey) => {
    const netSales = Math.max(0, agg.grossSales - agg.discount - agg.salesReturn);
    const netQty = Math.max(0, agg.quantitySold - agg.returnQuantity);
    rows.push({
      date: dateKey,
      invoiceCount: agg.invoiceCount,
      retailerCount: agg.retailers.size,
      quantitySold: netQty,
      grossSales: Math.round(agg.grossSales),
      discount: Math.round(agg.discount),
      salesReturn: Math.round(agg.salesReturn),
      netSales: Math.round(netSales),
      gst: Math.round(agg.gst),
      collection: Math.round(agg.collection),
      outstanding: Math.round(agg.outstanding)
    });
  });

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export interface MonthlySalesRow {
  month: string;
  monthKey: string;
  grossSales: number;
  salesReturn: number;
  netSales: number;
  discount: number;
  gst: number;
  collection: number;
  outstanding: number;
  grossProfit: number;
  growthPercent?: number;
}

export function getMonthlySales(filters: ReportFilterState, db: DbState, user: UserContext): MonthlySalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const monthMap = new Map<string, {
    grossSales: number;
    salesReturn: number;
    discount: number;
    gst: number;
    collection: number;
    outstanding: number;
    cogs: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    const d = new Date(inv.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const curr = monthMap.get(monthKey) || {
      grossSales: 0,
      salesReturn: 0,
      discount: 0,
      gst: 0,
      collection: 0,
      outstanding: 0,
      cogs: 0
    };

    const items = inv.items || [];
    const invLineGrossSum = items.reduce((sum, item) => {
      const prod = db.products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      return sum + (lineTaxable + lineDisc);
    }, 0);

    const invLineDiscountsSum = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const unallocatedBillDiscount = Math.max(0, (inv.discount_amount || 0) - invLineDiscountsSum);

    curr.collection += inv.paid_amount;
    curr.outstanding += inv.outstanding_amount;

    items.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = i.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      const lineDisc = i.discount || 0;
      const lineTaxable = i.taxable_value !== undefined 
        ? i.taxable_value 
        : Math.max(0, ((cQty * (i.carton_rate || i.rate)) + (lQty * (i.loose_rate || ((i.carton_rate || i.rate) / unitsPerPack)))) - lineDisc);
      const lineGross = lineTaxable + lineDisc;
      const lineGst = (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0);

      const itemBillDiscountShare = (invLineGrossSum > 0 && unallocatedBillDiscount > 0)
        ? (lineGross / invLineGrossSum) * unallocatedBillDiscount
        : 0;
      const totalItemDiscount = lineDisc + itemBillDiscountShare;

      let cost = prod.purchase_price;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === i.product_id && batch.batch_number === i.batch_number);
        if (b) cost = b.purchase_rate;
      }

      curr.grossSales += lineGross;
      curr.discount += totalItemDiscount;
      curr.gst += lineGst;
      curr.cogs += (cQty * cost) + (lQty * (cost / unitsPerPack));
    });

    monthMap.set(monthKey, curr);
  });

  db.salesReturns.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    const retailerId = sr.retailer_id || db.invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
    if (f.retailerId && retailerId !== f.retailerId) return;
    const inv = db.invoices.find(i => i.id === sr.invoice_id);
    if (f.salespersonId && (!inv || !isInvoiceMatchingSalesperson(inv, f.salespersonId, db))) return;

    let retVal = 0;
    sr.items?.forEach(sri => {
      const prod = db.products.find(p => p.id === sri.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = sri.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = sri.carton_qty !== undefined ? sri.carton_qty : Math.floor(sri.quantity / unitsPerPack);
      const lQty = sri.loose_qty !== undefined ? sri.loose_qty : (sri.quantity % unitsPerPack);
      const cRate = sri.rate;
      const lRate = sri.loose_rate || (cRate / unitsPerPack);
      retVal += (cQty * cRate) + (lQty * lRate);
    });

    if (retVal > 0) {
      const d = new Date(sr.return_date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const curr = monthMap.get(monthKey) || {
        grossSales: 0,
        salesReturn: 0,
        discount: 0,
        gst: 0,
        collection: 0,
        outstanding: 0,
        cogs: 0
      };
      curr.salesReturn += retVal;
      monthMap.set(monthKey, curr);
    }
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sortedKeys = Array.from(monthMap.keys()).sort();
  
  const rows: MonthlySalesRow[] = [];
  let prevNetSales = 0;

  sortedKeys.forEach(mKey => {
    const agg = monthMap.get(mKey)!;
    const [yearStr, monthNumStr] = mKey.split('-');
    const monthName = `${monthNames[parseInt(monthNumStr, 10) - 1]} ${yearStr}`;
    const netSales = Math.max(0, agg.grossSales - agg.discount - agg.salesReturn);
    const grossProfit = user.role === 'admin' ? netSales - agg.cogs : 0;
    
    let growthPercent: number | undefined = undefined;
    if (prevNetSales > 0) {
      growthPercent = Number((((netSales - prevNetSales) / prevNetSales) * 100).toFixed(1));
    }
    prevNetSales = netSales;

    rows.push({
      month: monthName,
      monthKey: mKey,
      grossSales: Math.round(agg.grossSales),
      salesReturn: Math.round(agg.salesReturn),
      netSales: Math.round(netSales),
      discount: Math.round(agg.discount),
      gst: Math.round(agg.gst),
      collection: Math.round(agg.collection),
      outstanding: Math.round(agg.outstanding),
      grossProfit: Math.round(grossProfit),
      growthPercent
    });
  });

  return rows.reverse();
}

export interface QuarterlySalesRow {
  quarter: string;
  grossSales: number;
  salesReturn: number;
  netSales: number;
  gst: number;
  collection: number;
  outstanding: number;
  grossProfit: number;
  growthPercent?: number;
}

export function getQuarterlySales(filters: ReportFilterState, db: DbState, user: UserContext): QuarterlySalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const qMap = new Map<string, {
    grossSales: number;
    salesReturn: number;
    discount: number;
    gst: number;
    collection: number;
    outstanding: number;
    cogs: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    const d = new Date(inv.date);
    const month = d.getMonth();
    let q = 'Q4';
    let fy = d.getFullYear();
    if (month >= 3 && month <= 5) { q = 'Q1'; fy = d.getFullYear(); }
    else if (month >= 6 && month <= 8) { q = 'Q2'; fy = d.getFullYear(); }
    else if (month >= 9 && month <= 11) { q = 'Q3'; fy = d.getFullYear(); }
    else { q = 'Q4'; fy = d.getFullYear() - 1; }

    const qKey = `FY${fy}-${fy + 1} ${q}`;
    const curr = qMap.get(qKey) || {
      grossSales: 0,
      salesReturn: 0,
      discount: 0,
      gst: 0,
      collection: 0,
      outstanding: 0,
      cogs: 0
    };

    const items = inv.items || [];
    const invLineGrossSum = items.reduce((sum, item) => {
      const prod = db.products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineDisc = item.discount || 0;
      const lineTaxable = item.taxable_value !== undefined 
        ? item.taxable_value 
        : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
      return sum + (lineTaxable + lineDisc);
    }, 0);

    const invLineDiscountsSum = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const unallocatedBillDiscount = Math.max(0, (inv.discount_amount || 0) - invLineDiscountsSum);

    curr.collection += inv.paid_amount;
    curr.outstanding += inv.outstanding_amount;

    items.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = i.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      const lineDisc = i.discount || 0;
      const lineTaxable = i.taxable_value !== undefined 
        ? i.taxable_value 
        : Math.max(0, ((cQty * (i.carton_rate || i.rate)) + (lQty * (i.loose_rate || ((i.carton_rate || i.rate) / unitsPerPack)))) - lineDisc);
      const lineGross = lineTaxable + lineDisc;
      const lineGst = (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0);

      const itemBillDiscountShare = (invLineGrossSum > 0 && unallocatedBillDiscount > 0)
        ? (lineGross / invLineGrossSum) * unallocatedBillDiscount
        : 0;
      const totalItemDiscount = lineDisc + itemBillDiscountShare;

      let cost = prod.purchase_price;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === i.product_id && batch.batch_number === i.batch_number);
        if (b) cost = b.purchase_rate;
      }

      curr.grossSales += lineGross;
      curr.discount += totalItemDiscount;
      curr.gst += lineGst;
      curr.cogs += (cQty * cost) + (lQty * (cost / unitsPerPack));
    });

    qMap.set(qKey, curr);
  });

  db.salesReturns.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    const retailerId = sr.retailer_id || db.invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
    if (f.retailerId && retailerId !== f.retailerId) return;
    const inv = db.invoices.find(i => i.id === sr.invoice_id);
    if (f.salespersonId && (!inv || !isInvoiceMatchingSalesperson(inv, f.salespersonId, db))) return;

    let retVal = 0;
    sr.items?.forEach(sri => {
      const prod = db.products.find(p => p.id === sri.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = sri.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = sri.carton_qty !== undefined ? sri.carton_qty : Math.floor(sri.quantity / unitsPerPack);
      const lQty = sri.loose_qty !== undefined ? sri.loose_qty : (sri.quantity % unitsPerPack);
      const cRate = sri.rate;
      const lRate = sri.loose_rate || (cRate / unitsPerPack);
      retVal += (cQty * cRate) + (lQty * lRate);
    });

    if (retVal > 0) {
      const d = new Date(sr.return_date);
      const month = d.getMonth();
      let q = 'Q4';
      let fy = d.getFullYear();
      if (month >= 3 && month <= 5) { q = 'Q1'; fy = d.getFullYear(); }
      else if (month >= 6 && month <= 8) { q = 'Q2'; fy = d.getFullYear(); }
      else if (month >= 9 && month <= 11) { q = 'Q3'; fy = d.getFullYear(); }
      else { q = 'Q4'; fy = d.getFullYear() - 1; }

      const qKey = `FY${fy}-${fy + 1} ${q}`;
      const curr = qMap.get(qKey) || {
        grossSales: 0,
        salesReturn: 0,
        discount: 0,
        gst: 0,
        collection: 0,
        outstanding: 0,
        cogs: 0
      };
      curr.salesReturn += retVal;
      qMap.set(qKey, curr);
    }
  });

  const sortedKeys = Array.from(qMap.keys()).sort();
  const rows: QuarterlySalesRow[] = [];
  let prevNet = 0;

  sortedKeys.forEach(qKey => {
    const agg = qMap.get(qKey)!;
    const netSales = Math.max(0, agg.grossSales - agg.discount - agg.salesReturn);
    const grossProfit = user.role === 'admin' ? netSales - agg.cogs : 0;
    
    let growthPercent: number | undefined = undefined;
    if (prevNet > 0) {
      growthPercent = Number((((netSales - prevNet) / prevNet) * 100).toFixed(1));
    }
    prevNet = netSales;

    rows.push({
      quarter: qKey,
      grossSales: Math.round(agg.grossSales),
      salesReturn: Math.round(agg.salesReturn),
      netSales: Math.round(netSales),
      gst: Math.round(agg.gst),
      collection: Math.round(agg.collection),
      outstanding: Math.round(agg.outstanding),
      grossProfit: Math.round(grossProfit),
      growthPercent
    });
  });

  return rows.reverse();
}

export interface InvoiceWiseSalesRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  retailerName: string;
  retailerCode: string;
  salespersonName: string;
  itemCount: number;
  totalQuantity: number;
  grossAmount: number;
  discount: number;
  gst: number;
  finalInvoiceAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  invoiceStatus: 'Final' | 'Cancelled';
  daysUnpaid: number;
}

export function getInvoiceWiseSales(filters: ReportFilterState, db: DbState, user: UserContext): InvoiceWiseSalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  return db.invoices
    .filter(inv => isInvoiceMatchingReportFilters(inv, f, db, dateRange))
    .map(inv => {
      const ret = db.retailers.find(r => r.id === inv.retailer_id);
      const salespersonName = getInvoiceSalespersonName(inv, db);

      const items = inv.items || [];
      const invLineGrossSum = items.reduce((sum, item) => {
        const prod = db.products.find(p => p.id === item.product_id);
        const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
        const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
        const lineDisc = item.discount || 0;
        const lineTaxable = item.taxable_value !== undefined 
          ? item.taxable_value 
          : Math.max(0, ((cQty * (item.carton_rate || item.rate)) + (lQty * (item.loose_rate || ((item.carton_rate || item.rate) / unitsPerPack)))) - lineDisc);
        return sum + (lineTaxable + lineDisc);
      }, 0);

      let totalQty = 0;
      items.forEach(i => { totalQty += i.quantity; });

      let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
      if (inv.outstanding_amount === 0) paymentStatus = 'Paid';
      else if (inv.paid_amount > 0) paymentStatus = 'Partial';

      const invDate = new Date(inv.date);
      const now = new Date();
      const daysUnpaid = Math.max(0, Math.floor((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.date.slice(0, 10),
        retailerName: ret?.shop_name || 'Retailer',
        retailerCode: ret?.retailer_code || 'RET',
        salespersonName,
        itemCount: items.length,
        totalQuantity: totalQty,
        grossAmount: Math.round(invLineGrossSum || inv.subtotal),
        discount: Math.round(inv.discount_amount),
        gst: Math.round(inv.cgst + inv.sgst + inv.igst),
        finalInvoiceAmount: Math.round(inv.grand_total),
        paidAmount: Math.round(inv.paid_amount),
        outstandingAmount: Math.round(inv.outstanding_amount),
        paymentStatus,
        invoiceStatus: 'Final' as const,
        daysUnpaid
      };
    })
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
}

// ----------------------------------------------------
// B. PROFIT & LOSS REPORTS
// ----------------------------------------------------

export interface ProfitReportRow {
  id: string;
  name: string;
  subName?: string;
  category?: string;
  brand?: string;
  variantPacking?: string;
  quantitySold: number;
  netSalesExclGst: number;
  actualCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalDiscount: number;
  salesReturnAdj: number;
  averageSellingRate?: number;
  averageCostRate?: number;
  outstanding?: number;
}

export function getProductWiseProfit(filters: ReportFilterState, db: DbState, user: UserContext): ProfitReportRow[] {
  if (user.role !== 'admin') return [];
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const map = new Map<string, {
    quantity: number;
    netSales: number;
    cogs: number;
    discount: number;
    returns: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    inv.items?.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;

      const curr = map.get(prod.id) || { quantity: 0, netSales: 0, cogs: 0, discount: 0, returns: 0 };
      
      let costRate = prod.purchase_price;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === i.batch_number);
        if (b) costRate = b.purchase_rate;
      }

      const unitsPerPack = i.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      const lineCost = (cQty * costRate) + (lQty * (costRate / unitsPerPack));

      curr.quantity += i.quantity;
      curr.netSales += i.taxable_value;
      curr.discount += i.discount || 0;
      curr.cogs += lineCost;

      map.set(prod.id, curr);
    });
  });

  const rows: ProfitReportRow[] = [];
  map.forEach((agg, prodId) => {
    const prod = db.products.find(p => p.id === prodId)!;
    const company = db.companies.find(c => c.id === prod.company_id);
    const grossProfit = agg.netSales - agg.cogs;
    const grossMargin = agg.netSales > 0 ? (grossProfit / agg.netSales) * 100 : 0;
    const avgSell = agg.quantity > 0 ? agg.netSales / agg.quantity : 0;
    const avgCost = agg.quantity > 0 ? agg.cogs / agg.quantity : 0;

    rows.push({
      id: prod.id,
      name: prod.name,
      subName: company?.name || '',
      category: prod.category || 'General',
      brand: prod.brand,
      variantPacking: prod.pack_size,
      quantitySold: agg.quantity,
      netSalesExclGst: Math.round(agg.netSales),
      actualCogs: Math.round(agg.cogs),
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMargin.toFixed(1)),
      totalDiscount: Math.round(agg.discount),
      salesReturnAdj: Math.round(agg.returns),
      averageSellingRate: Number(avgSell.toFixed(2)),
      averageCostRate: Number(avgCost.toFixed(2))
    });
  });

  return rows.sort((a, b) => b.grossProfit - a.grossProfit);
}

export function getRetailerWiseProfit(filters: ReportFilterState, db: DbState, user: UserContext): ProfitReportRow[] {
  if (user.role !== 'admin') return [];
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const map = new Map<string, {
    invoices: number;
    quantity: number;
    netSales: number;
    discount: number;
    cogs: number;
    returns: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    // Check matching items if category/company/brand filter is active
    const matchingItems = (inv.items || []).filter(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return false;
      if (f.companyId && prod.company_id !== f.companyId) return false;
      if (f.category && prod.category !== f.category) return false;
      if (f.brand && prod.brand !== f.brand) return false;
      if (f.productId && prod.id !== f.productId) return false;
      return true;
    });

    if (matchingItems.length === 0) return;

    const curr = map.get(inv.retailer_id) || { invoices: 0, quantity: 0, netSales: 0, discount: 0, cogs: 0, returns: 0 };
    curr.invoices += 1;

    matchingItems.forEach(i => {
      curr.quantity += i.quantity;
      const lineTaxable = (i.taxable_value !== undefined) ? i.taxable_value : (i.rate * i.quantity - (i.discount || 0));
      curr.netSales += lineTaxable;
      curr.discount += i.discount || 0;

      const prod = db.products.find(p => p.id === i.product_id);
      let costRate = prod?.purchase_price || 0;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === i.product_id && batch.batch_number === i.batch_number);
        if (b) costRate = b.purchase_rate;
      }
      const unitsPerPack = i.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      curr.cogs += (cQty * costRate) + (lQty * (costRate / unitsPerPack));
    });

    map.set(inv.retailer_id, curr);
  });

  const rows: ProfitReportRow[] = [];
  map.forEach((agg, retId) => {
    const ret = db.retailers.find(r => r.id === retId);
    if (!ret) return;

    const grossProfit = agg.netSales - agg.cogs;
    const grossMargin = agg.netSales > 0 ? (grossProfit / agg.netSales) * 100 : 0;

    rows.push({
      id: ret.id,
      name: ret.shop_name,
      subName: `${ret.retailer_code} • ${ret.city || 'Indore'}`,
      quantitySold: agg.quantity,
      netSalesExclGst: Math.round(agg.netSales),
      actualCogs: Math.round(agg.cogs),
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMargin.toFixed(1)),
      totalDiscount: Math.round(agg.discount),
      salesReturnAdj: Math.round(agg.returns),
      outstanding: ret.outstanding
    });
  });

  return rows.sort((a, b) => b.grossProfit - a.grossProfit);
}

export function getCompanyWiseProfit(filters: ReportFilterState, db: DbState, user: UserContext): ProfitReportRow[] {
  if (user.role !== 'admin') return [];
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const map = new Map<string, {
    productsSold: Set<string>;
    quantity: number;
    netSales: number;
    discount: number;
    cogs: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    inv.items?.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;

      const curr = map.get(prod.company_id) || { productsSold: new Set<string>(), quantity: 0, netSales: 0, discount: 0, cogs: 0 };
      curr.productsSold.add(prod.id);
      curr.quantity += i.quantity;
      curr.netSales += i.taxable_value;
      curr.discount += i.discount || 0;

      let cost = prod.purchase_price;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === i.batch_number);
        if (b) cost = b.purchase_rate;
      }
      const unitsPerPack = i.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      curr.cogs += (cQty * cost) + (lQty * (cost / unitsPerPack));

      map.set(prod.company_id, curr);
    });
  });

  const rows: ProfitReportRow[] = [];
  map.forEach((agg, compId) => {
    const comp = db.companies.find(c => c.id === compId);
    if (!comp) return;

    const grossProfit = agg.netSales - agg.cogs;
    const grossMargin = agg.netSales > 0 ? (grossProfit / agg.netSales) * 100 : 0;

    rows.push({
      id: comp.id,
      name: comp.name,
      subName: `Code: ${comp.code} • ${agg.productsSold.size} Products`,
      quantitySold: agg.quantity,
      netSalesExclGst: Math.round(agg.netSales),
      actualCogs: Math.round(agg.cogs),
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMargin.toFixed(1)),
      totalDiscount: Math.round(agg.discount),
      salesReturnAdj: 0
    });
  });

  return rows.sort((a, b) => b.grossProfit - a.grossProfit);
}

export interface InvoiceWiseProfitRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  retailerId: string;
  retailerName: string;
  retailerCode: string;
  city: string;
  salespersonName: string;
  itemCount: number;
  totalQuantity: number;
  grossAmount: number;
  discount: number;
  netSalesExclGst: number;
  gstAmount: number;
  finalInvoiceAmount: number;
  actualCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
}

export function getInvoiceWiseProfit(filters: ReportFilterState, db: DbState, user: UserContext): InvoiceWiseProfitRow[] {
  if (user.role !== 'admin') return [];
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  return db.invoices
    .filter(inv => isInvoiceMatchingReportFilters(inv, f, db, dateRange))
    .map(inv => {
      const ret = db.retailers.find(r => r.id === inv.retailer_id);
      const salespersonName = getInvoiceSalespersonName(inv, db);

      let totalQty = 0;
      let cogs = 0;

      inv.items?.forEach(i => {
        totalQty += i.quantity;
        const prod = db.products.find(p => p.id === i.product_id);
        let costRate = prod?.purchase_price || 0;
        if (i.batch_number) {
          const b = db.batches.find(batch => batch.product_id === i.product_id && batch.batch_number === i.batch_number);
          if (b) costRate = b.purchase_rate;
        }
        const unitsPerPack = i.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
        const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
        cogs += (cQty * costRate) + (lQty * (costRate / unitsPerPack));
      });

      const netSalesExclGst = inv.taxable_value;
      const grossProfit = netSalesExclGst - cogs;
      const grossMarginPercent = netSalesExclGst > 0 ? (grossProfit / netSalesExclGst) * 100 : 0;

      let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
      if (inv.outstanding_amount === 0) paymentStatus = 'Paid';
      else if (inv.paid_amount > 0) paymentStatus = 'Partial';

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.date.slice(0, 10),
        retailerId: inv.retailer_id,
        retailerName: ret?.shop_name || 'Retailer',
        retailerCode: ret?.retailer_code || 'RET',
        city: ret?.city || 'Mumbai',
        salespersonName,
        itemCount: inv.items?.length || 0,
        totalQuantity: totalQty,
        grossAmount: Math.round(inv.subtotal),
        discount: Math.round(inv.discount_amount),
        netSalesExclGst: Math.round(netSalesExclGst),
        gstAmount: Math.round(inv.cgst + inv.sgst + inv.igst),
        finalInvoiceAmount: Math.round(inv.grand_total),
        actualCogs: Math.round(cogs),
        grossProfit: Math.round(grossProfit),
        grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
        paidAmount: Math.round(inv.paid_amount),
        outstandingAmount: Math.round(inv.outstanding_amount),
        paymentStatus
      };
    })
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
}

export interface TotalProfitSummaryData {
  netSalesExclGst: number;
  actualCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalDiscounts: number;
  salesReturns: number;
  otherIncome: number;
  operatingExpenses: number | null;
  netProfit: number | null;
  expenseStatusMessage: string;
}

export function getTotalProfitSummary(filters: ReportFilterState, db: DbState, user: UserContext): TotalProfitSummaryData {
  const prodProfitRows = getProductWiseProfit(filters, db, user);
  
  let netSales = 0;
  let cogs = 0;
  let grossProfit = 0;
  let totalDiscounts = 0;
  let salesReturns = 0;

  prodProfitRows.forEach(r => {
    netSales += r.netSalesExclGst;
    cogs += r.actualCogs;
    grossProfit += r.grossProfit;
    totalDiscounts += r.totalDiscount;
    salesReturns += r.salesReturnAdj;
  });

  const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  return {
    netSalesExclGst: Math.round(netSales),
    actualCogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
    totalDiscounts: Math.round(totalDiscounts),
    salesReturns: Math.round(salesReturns),
    otherIncome: 0,
    operatingExpenses: null,
    netProfit: null,
    expenseStatusMessage: 'Net Profit calculation requires expense data.'
  };
}

// ----------------------------------------------------
// C. RETAILER REPORTS
// ----------------------------------------------------

export interface RetailerSalesSummaryRow {
  retailerId: string;
  retailerName: string;
  retailerCode: string;
  city: string;
  orderCount: number;
  invoiceCount: number;
  totalQuantity: number;
  grossSales: number;
  discount: number;
  netSales: number;
  collection: number;
  outstanding: number;
  lastOrderDate?: string;
  lastInvoiceDate?: string;
}

export function getRetailerSalesSummary(filters: ReportFilterState, db: DbState, user: UserContext): RetailerSalesSummaryRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const retMap = new Map<string, {
    orderCount: number;
    invoiceCount: number;
    totalQty: number;
    grossSales: number;
    discount: number;
    netSales: number;
    collection: number;
    lastOrderDate?: string;
    lastInvoiceDate?: string;
  }>();

  db.retailers.forEach(r => {
    if (f.retailerId && r.id !== f.retailerId) return;
    retMap.set(r.id, {
      orderCount: 0,
      invoiceCount: 0,
      totalQty: 0,
      grossSales: 0,
      discount: 0,
      netSales: 0,
      collection: 0
    });
  });

  db.orders.forEach(o => {
    if (!isDateInRange(o.order_date, dateRange)) return;
    if (f.salespersonId && !isOrderMatchingSalesperson(o, f.salespersonId, db)) return;
    const curr = retMap.get(o.retailer_id);
    if (curr) {
      curr.orderCount += 1;
      if (!curr.lastOrderDate || o.order_date > curr.lastOrderDate) {
        curr.lastOrderDate = o.order_date.slice(0, 10);
      }
    }
  });

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;
    const curr = retMap.get(inv.retailer_id);
    if (curr) {
      curr.invoiceCount += 1;
      curr.grossSales += inv.subtotal;
      curr.discount += inv.discount_amount;
      curr.netSales += inv.grand_total;
      curr.collection += inv.paid_amount;
      if (!curr.lastInvoiceDate || inv.date > curr.lastInvoiceDate) {
        curr.lastInvoiceDate = inv.date.slice(0, 10);
      }
      inv.items?.forEach(i => { curr.totalQty += i.quantity; });
    }
  });

  const rows: RetailerSalesSummaryRow[] = [];
  retMap.forEach((agg, retId) => {
    const ret = db.retailers.find(r => r.id === retId);
    if (!ret) return;
    if (f.salespersonId && agg.orderCount === 0 && agg.invoiceCount === 0) return;

    rows.push({
      retailerId: ret.id,
      retailerName: ret.shop_name,
      retailerCode: ret.retailer_code,
      city: ret.city || 'Indore',
      orderCount: agg.orderCount,
      invoiceCount: agg.invoiceCount,
      totalQuantity: agg.totalQty,
      grossSales: Math.round(agg.grossSales),
      discount: Math.round(agg.discount),
      netSales: Math.round(agg.netSales),
      collection: Math.round(agg.collection),
      outstanding: Math.round(ret.outstanding),
      lastOrderDate: agg.lastOrderDate || '—',
      lastInvoiceDate: agg.lastInvoiceDate || '—'
    });
  });

  return rows.sort((a, b) => b.netSales - a.netSales);
}

export interface RetailerOutstandingAgingRow {
  retailerId: string;
  retailerName: string;
  retailerCode: string;
  city: string;
  totalInvoiced: number;
  totalPaid: number;
  totalCreditNotes: number;
  outstanding: number;
  oldestOutstandingDate: string;
  pendingInvoicesCount: number;
  currentBucket: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  daysAbove90: number;
  paymentStatus: string;
}

export function getRetailerOutstandingAging(filters: ReportFilterState, db: DbState, user: UserContext): RetailerOutstandingAgingRow[] {
  const f = applyRbacFilters(filters, user);
  const now = new Date();

  return db.retailers
    .filter(r => (f.retailerId ? r.id === f.retailerId : true))
    .filter(r => {
      if (!f.salespersonId) return true;
      // Check if retailer is associated with this salesperson via invoices or orders
      const hasSpInvoice = db.invoices.some(i => i.retailer_id === r.id && isInvoiceMatchingSalesperson(i, f.salespersonId, db));
      const hasSpOrder = db.orders.some(o => o.retailer_id === r.id && isOrderMatchingSalesperson(o, f.salespersonId, db));
      return hasSpInvoice || hasSpOrder;
    })
    .map(ret => {
      const unpaidInvoices = db.invoices.filter(i => i.retailer_id === ret.id && i.outstanding_amount > 0 && (!f.salespersonId || isInvoiceMatchingSalesperson(i, f.salespersonId, db)));
      
      let totalInvoiced = 0;
      let totalPaid = 0;
      db.invoices.filter(i => i.retailer_id === ret.id && (!f.salespersonId || isInvoiceMatchingSalesperson(i, f.salespersonId, db))).forEach(i => {
        totalInvoiced += i.grand_total;
        totalPaid += i.paid_amount;
      });

      let currentBucket = 0;
      let days1to30 = 0;
      let days31to60 = 0;
      let days61to90 = 0;
      let daysAbove90 = 0;
      let oldestDate = '—';

      unpaidInvoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const ageDays = Math.max(0, Math.floor((now.getTime() - invDate.getTime()) / (1000 * 3600 * 24)));
        
        if (oldestDate === '—' || inv.date.slice(0, 10) < oldestDate) {
          oldestDate = inv.date.slice(0, 10);
        }

        if (ageDays === 0) currentBucket += inv.outstanding_amount;
        else if (ageDays <= 30) days1to30 += inv.outstanding_amount;
        else if (ageDays <= 60) days31to60 += inv.outstanding_amount;
        else if (ageDays <= 90) days61to90 += inv.outstanding_amount;
        else daysAbove90 += inv.outstanding_amount;
      });

      const invoicePendingTotal = unpaidInvoices.reduce((s, i) => s + i.outstanding_amount, 0);
      const unallocatedOpeningDues = Math.max(0, ret.outstanding - invoicePendingTotal);
      if (unallocatedOpeningDues > 0 && !f.salespersonId) {
        daysAbove90 += unallocatedOpeningDues;
        if (oldestDate === '—') oldestDate = 'Opening Balance';
      }

      let totalCreditNotes = 0;
      db.salesReturns?.forEach(sr => {
        const rId = sr.retailer_id || db.invoices.find(i => i.id === sr.invoice_id)?.retailer_id;
        if (rId !== ret.id) return;
        if (sr.total_amount !== undefined) {
          totalCreditNotes += sr.total_amount;
        } else {
          sr.items?.forEach(item => {
            const prod = db.products.find(p => p.id === item.product_id);
            const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
            const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
            const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
            const cRate = item.rate;
            const lRate = item.loose_rate ?? (cRate / unitsPerPack);
            const returnSub = (cQty * cRate) + (lQty * lRate);
            const prodGst = (item.gst_percent !== undefined && (item as any).gst_percent !== null)
              ? Number((item as any).gst_percent)
              : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0);
            const gst = returnSub * (prodGst / 100);
            totalCreditNotes += returnSub + gst;
          });
        }
      });

      return {
        retailerId: ret.id,
        retailerName: ret.shop_name,
        retailerCode: ret.retailer_code,
        city: ret.city || 'Indore',
        totalInvoiced: Math.round(totalInvoiced),
        totalPaid: Math.round(totalPaid),
        totalCreditNotes: Math.round(totalCreditNotes),
        outstanding: Math.round(f.salespersonId ? invoicePendingTotal : ret.outstanding),
        oldestOutstandingDate: oldestDate,
        pendingInvoicesCount: unpaidInvoices.length,
        currentBucket: Math.round(currentBucket),
        days1to30: Math.round(days1to30),
        days31to60: Math.round(days31to60),
        days61to90: Math.round(days61to90),
        daysAbove90: Math.round(daysAbove90),
        paymentStatus: ret.outstanding > 0 ? (unpaidInvoices.length > 2 ? 'Overdue' : 'Active Pending') : 'Clear'
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
}

// ----------------------------------------------------
// D. COMPANY & BRAND REPORTS
// ----------------------------------------------------

export interface CompanySalesRow {
  companyId: string;
  companyName: string;
  code: string;
  productCount: number;
  variantCount: number;
  quantitySold: number;
  grossSales: number;
  discount: number;
  netSales: number;
  actualCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  salesReturn: number;
}

export function getCompanyWiseSales(filters: ReportFilterState, db: DbState, user: UserContext): CompanySalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const compMap = new Map<string, {
    products: Set<string>;
    variants: Set<string>;
    quantity: number;
    grossSales: number;
    discount: number;
    netSales: number;
    cost: number;
    returns: number;
  }>();

  db.companies.forEach(c => {
    if (f.companyId && c.id !== f.companyId) return;
    compMap.set(c.id, {
      products: new Set<string>(),
      variants: new Set<string>(),
      quantity: 0,
      grossSales: 0,
      discount: 0,
      netSales: 0,
      cost: 0,
      returns: 0
    });
  });

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;
    inv.items?.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;

      const curr = compMap.get(prod.company_id);
      if (curr) {
        curr.products.add(prod.id);
        curr.variants.add(prod.pack_size);
        curr.quantity += i.quantity;
        const lineDisc = i.discount || 0;
        const lineTaxable = i.taxable_value || 0;
        curr.grossSales += lineTaxable + lineDisc;
        curr.discount += lineDisc;
        curr.netSales += lineTaxable;

        let cost = prod.purchase_price;
        if (i.batch_number) {
          const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === i.batch_number);
          if (b) cost = b.purchase_rate;
        }
        const unitsPerPack = i.units_per_trading_unit || prod.units_per_box_carton || 1;
        const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
        const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
        curr.cost += (cQty * cost) + (lQty * (cost / unitsPerPack));
      }
    });
  });

  db.salesReturns?.forEach(sr => {
    if (!isDateInRange(sr.return_date, dateRange)) return;
    const inv = db.invoices.find(i => i.id === sr.invoice_id);
    if (f.salespersonId && (!inv || !isInvoiceMatchingSalesperson(inv, f.salespersonId, db))) return;
    sr.items?.forEach(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (!prod) return;
      if (f.category && prod.category !== f.category) return;
      const curr = compMap.get(prod.company_id);
      if (curr) {
        const unitsPerPack = item.units_per_trading_unit || prod.units_per_box_carton || 1;
        const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
        const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
        const cRate = item.rate;
        const lRate = item.loose_rate ?? (cRate / unitsPerPack);
        curr.returns += (cQty * cRate) + (lQty * lRate);
      }
    });
  });

  const rows: CompanySalesRow[] = [];
  compMap.forEach((agg, compId) => {
    const comp = db.companies.find(c => c.id === compId);
    if (!comp) return;
    if (f.salespersonId && agg.quantity === 0 && agg.grossSales === 0) return;

    const grossProfit = user.role === 'admin' ? agg.netSales - agg.cost : 0;
    const grossMargin = user.role === 'admin' && agg.netSales > 0 ? (grossProfit / agg.netSales) * 100 : 0;

    rows.push({
      companyId: comp.id,
      companyName: comp.name,
      code: comp.code,
      productCount: agg.products.size,
      variantCount: agg.variants.size,
      quantitySold: agg.quantity,
      grossSales: Math.round(agg.grossSales),
      discount: Math.round(agg.discount),
      netSales: Math.round(agg.netSales),
      actualCost: user.role === 'admin' ? Math.round(agg.cost) : 0,
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMargin.toFixed(1)),
      salesReturn: Math.round(agg.returns)
    });
  });

  return rows.sort((a, b) => b.netSales - a.netSales);
}

export interface BrandSalesRow {
  brand: string;
  companyName: string;
  quantitySold: number;
  netSales: number;
  actualCost: number;
  grossProfit: number;
  grossMarginPercent: number;
}

export function getBrandWiseSales(filters: ReportFilterState, db: DbState, user: UserContext): BrandSalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const brandMap = new Map<string, {
    companyName: string;
    quantity: number;
    netSales: number;
    cost: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;
    inv.items?.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;

      const comp = db.companies.find(c => c.id === prod.company_id);
      const curr = brandMap.get(prod.brand) || {
        companyName: comp?.name || 'Company',
        quantity: 0,
        netSales: 0,
        cost: 0
      };

      curr.quantity += i.quantity;
      curr.netSales += i.taxable_value;

      let cost = prod.purchase_price;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === i.batch_number);
        if (b) cost = b.purchase_rate;
      }
      const unitsPerPack = i.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      curr.cost += (cQty * cost) + (lQty * (cost / unitsPerPack));

      brandMap.set(prod.brand, curr);
    });
  });

  const rows: BrandSalesRow[] = [];
  brandMap.forEach((agg, brandName) => {
    const grossProfit = user.role === 'admin' ? agg.netSales - agg.cost : 0;
    const grossMargin = user.role === 'admin' && agg.netSales > 0 ? (grossProfit / agg.netSales) * 100 : 0;

    rows.push({
      brand: brandName,
      companyName: agg.companyName,
      quantitySold: agg.quantity,
      netSales: Math.round(agg.netSales),
      actualCost: user.role === 'admin' ? Math.round(agg.cost) : 0,
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMargin.toFixed(1))
    });
  });

  return rows.sort((a, b) => b.netSales - a.netSales);
}

// ----------------------------------------------------
// D2. CATEGORY REPORTS
// ----------------------------------------------------

export interface CategorySalesRow {
  category: string;
  productCount: number;
  quantitySold: number;
  grossSales: number;
  discount: number;
  netSales: number;
  actualCost: number;
  grossProfit: number;
  grossMarginPercent: number;
}

export function getCategoryWiseSales(filters: ReportFilterState, db: DbState, user: UserContext): CategorySalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const catMap = new Map<string, {
    products: Set<string>;
    quantity: number;
    grossSales: number;
    discount: number;
    netSales: number;
    cost: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    inv.items?.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.brand && prod.brand !== f.brand) return;
      if (f.productId && prod.id !== f.productId) return;

      const catName = prod.category || 'General';
      const curr = catMap.get(catName) || {
        products: new Set<string>(),
        quantity: 0,
        grossSales: 0,
        discount: 0,
        netSales: 0,
        cost: 0
      };

      curr.products.add(prod.id);
      curr.quantity += i.quantity;
      const lineDisc = i.discount || 0;
      const lineTaxable = (i.taxable_value !== undefined) ? i.taxable_value : (i.rate * i.quantity - lineDisc);
      curr.grossSales += lineTaxable + lineDisc;
      curr.discount += lineDisc;
      curr.netSales += lineTaxable;

      let cost = prod.purchase_price;
      if (i.batch_number) {
        const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === i.batch_number);
        if (b) cost = b.purchase_rate;
      }
      const unitsPerPack = i.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      curr.cost += (cQty * cost) + (lQty * (cost / unitsPerPack));

      catMap.set(catName, curr);
    });
  });

  const rows: CategorySalesRow[] = [];
  catMap.forEach((agg, catName) => {
    const grossProfit = user.role === 'admin' ? agg.netSales - agg.cost : 0;
    const grossMargin = user.role === 'admin' && agg.netSales > 0 ? (grossProfit / agg.netSales) * 100 : 0;

    rows.push({
      category: catName,
      productCount: agg.products.size,
      quantitySold: agg.quantity,
      grossSales: Math.round(agg.grossSales),
      discount: Math.round(agg.discount),
      netSales: Math.round(agg.netSales),
      actualCost: user.role === 'admin' ? Math.round(agg.cost) : 0,
      grossProfit: Math.round(grossProfit),
      grossMarginPercent: Number(grossMargin.toFixed(1))
    });
  });

  return rows.sort((a, b) => b.netSales - a.netSales);
}

// ----------------------------------------------------
// E. SALESPERSON REPORTS
// ----------------------------------------------------

export interface SalespersonSalesRow {
  salespersonId: string;
  salespersonName: string;
  role: string;
  retailersServed: number;
  orderCount: number;
  invoiceCount: number;
  quantitySold: number;
  grossSales: number;
  discountGiven: number;
  netSales: number;
  collection: number;
  outstanding: number;
  grossProfit: number;
}

export function getSalespersonSales(filters: ReportFilterState, db: DbState, user: UserContext): SalespersonSalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const spMap = new Map<string, {
    retailers: Set<string>;
    orders: number;
    invoices: number;
    quantity: number;
    grossSales: number;
    discount: number;
    netSales: number;
    collection: number;
    outstanding: number;
    cost: number;
  }>();

  // Find sales reps
  const salesProfiles = db.profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co');
  salesProfiles.forEach(sp => {
    if (f.salespersonId && sp.id !== f.salespersonId) return;

    // If a Company Sales Rep (sales_co), they only sell products of their assigned company:
    if (sp.role === 'sales_co') {
      if (f.companyId && sp.company_id && sp.company_id !== f.companyId) {
        return;
      }
      if (f.category && sp.company_id) {
        const catInCompany = db.products.some(p => p.company_id === sp.company_id && p.category === f.category);
        if (!catInCompany) return;
      }
      if (f.brand && sp.company_id) {
        const brandInCompany = db.products.some(p => p.company_id === sp.company_id && p.brand === f.brand);
        if (!brandInCompany) return;
      }
      if (f.productId && sp.company_id) {
        const prod = db.products.find(p => p.id === f.productId);
        if (prod && prod.company_id !== sp.company_id) return;
      }
    }

    spMap.set(sp.id, {
      retailers: new Set<string>(),
      orders: 0,
      invoices: 0,
      quantity: 0,
      grossSales: 0,
      discount: 0,
      netSales: 0,
      collection: 0,
      outstanding: 0,
      cost: 0
    });
  });

  // Check matching items in orders:
  db.orders.forEach(o => {
    if (!isDateInRange(o.order_date, dateRange)) return;
    const spId = getOrderSalespersonId(o, db);
    if (!spId || !spMap.has(spId)) return;

    // If company/category/brand/product filter is active, check if order has matching items
    let hasMatchingItems = true;
    if (f.companyId || f.category || f.brand || f.productId || f.variantPacking) {
      hasMatchingItems = (o.items || []).some(item => {
        const prod = db.products.find(p => p.id === item.product_id);
        if (!prod) return false;
        if (f.companyId && prod.company_id !== f.companyId) return false;
        if (f.category && prod.category !== f.category) return false;
        if (f.brand && prod.brand !== f.brand) return false;
        if (f.productId && prod.id !== f.productId) return false;
        if (f.variantPacking && prod.pack_size !== f.variantPacking) return false;
        return true;
      });
    }

    if (hasMatchingItems) {
      const curr = spMap.get(spId)!;
      curr.orders += 1;
      curr.retailers.add(o.retailer_id);
    }
  });

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;
    const spId = getInvoiceSalespersonId(inv, db);
    if (!spId || !spMap.has(spId)) return;

    const curr = spMap.get(spId)!;

    // Filter items matching company / category / brand / product
    const matchingItems = (inv.items || []).filter(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return false;
      if (f.companyId && prod.company_id !== f.companyId) return false;
      if (f.category && prod.category !== f.category) return false;
      if (f.brand && prod.brand !== f.brand) return false;
      if (f.productId && prod.id !== f.productId) return false;
      if (f.variantPacking && prod.pack_size !== f.variantPacking) return false;
      return true;
    });

    if (matchingItems.length === 0) return;

    curr.invoices += 1;

    // If no product/company/category filter is active, take the full invoice amounts
    if (!f.companyId && !f.category && !f.brand && !f.productId && !f.variantPacking) {
      curr.grossSales += inv.subtotal;
      curr.discount += inv.discount_amount;
      curr.netSales += inv.grand_total;
      curr.collection += inv.paid_amount;
      curr.outstanding += inv.outstanding_amount;
    } else {
      // Calculate matching items contribution
      let itemGross = 0;
      let itemDisc = 0;
      let itemTotal = 0;

      matchingItems.forEach(i => {
        const lineTaxable = (i.taxable_value !== undefined) ? i.taxable_value : (i.rate * i.quantity - (i.discount || 0));
        const lineDisc = i.discount || 0;
        const lineTotal = (i.total_amount !== undefined) ? i.total_amount : lineTaxable * 1.18;
        itemGross += lineTaxable + lineDisc;
        itemDisc += lineDisc;
        itemTotal += lineTotal;
      });

      curr.grossSales += itemGross;
      curr.discount += itemDisc;
      curr.netSales += itemTotal;

      // Ratio of invoice paid/outstanding allocated to these items
      const ratio = inv.grand_total > 0 ? Math.min(1, itemTotal / inv.grand_total) : 0;
      curr.collection += inv.paid_amount * ratio;
      curr.outstanding += inv.outstanding_amount * ratio;
    }

    matchingItems.forEach(i => {
      curr.quantity += i.quantity;
      const prod = db.products.find(p => p.id === i.product_id);
      let cost = prod?.purchase_price || 0;
      if (i.batch_number && prod) {
        const b = db.batches.find(batch => batch.product_id === prod.id && batch.batch_number === i.batch_number);
        if (b) cost = b.purchase_rate;
      }
      const unitsPerPack = i.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
      const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
      curr.cost += (cQty * cost) + (lQty * (cost / unitsPerPack));
    });
  });

  const rows: SalespersonSalesRow[] = [];
  spMap.forEach((agg, spId) => {
    const sp = db.profiles.find(p => p.id === spId);
    if (!sp) return;

    // If a company/brand/product filter is active and the salesperson has 0 orders, 0 invoices, 0 sales for that company/brand, skip them
    if ((f.companyId || f.brand || f.productId || f.variantPacking) && agg.orders === 0 && agg.invoices === 0 && agg.quantity === 0) {
      return;
    }

    const grossProfit = user.role === 'admin' ? agg.netSales - agg.cost : 0;

    rows.push({
      salespersonId: sp.id,
      salespersonName: sp.name,
      role: sp.role === 'sales_dist' ? 'Distributor Rep' : 'Company Rep',
      retailersServed: agg.retailers.size,
      orderCount: agg.orders,
      invoiceCount: agg.invoices,
      quantitySold: agg.quantity,
      grossSales: Math.round(agg.grossSales),
      discountGiven: Math.round(agg.discount),
      netSales: Math.round(agg.netSales),
      collection: Math.round(agg.collection),
      outstanding: Math.round(agg.outstanding),
      grossProfit: Math.round(grossProfit)
    });
  });

  return rows.sort((a, b) => b.netSales - a.netSales);
}

export interface SalespersonDiscountRow {
  salespersonId: string;
  salespersonName: string;
  totalSales: number;
  totalDiscountGiven: number;
  discountPerTradingUnit: number;
  grossProfitImpact: number;
  totalQuantity: number;
}

export function getSalespersonDiscount(filters: ReportFilterState, db: DbState, user: UserContext): SalespersonDiscountRow[] {
  const spSales = getSalespersonSales(filters, db, user);
  return spSales.map(sp => {
    const discPerUnit = sp.quantitySold > 0 ? sp.discountGiven / sp.quantitySold : 0;
    return {
      salespersonId: sp.salespersonId,
      salespersonName: sp.salespersonName,
      totalSales: sp.netSales,
      totalDiscountGiven: sp.discountGiven,
      discountPerTradingUnit: Number(discPerUnit.toFixed(2)),
      grossProfitImpact: sp.discountGiven,
      totalQuantity: sp.quantitySold
    };
  });
}

// ----------------------------------------------------
// F. PURCHASE REPORTS
// ----------------------------------------------------

export interface PurchaseSummaryRow {
  purchaseId: string;
  purchaseDate: string;
  supplierName: string;
  invoiceNumber: string;
  itemCount: number;
  totalQuantity: number;
  purchaseValue: number;
  discount: number;
  gst: number;
  totalPurchaseAmount: number;
  godown: string;
  status: string;
}

export function getPurchaseSummary(filters: ReportFilterState, db: DbState, user: UserContext): PurchaseSummaryRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);
  const selectedPartyId = f.retailerId || (f as any).partyId || (f as any).supplierId;
  const isPartyFiltered = !!(selectedPartyId && selectedPartyId !== 'all');

  return (db.purchases || [])
    .filter(p => {
      if (p.status === 'Draft' || (p.status as string) === 'Cancelled') return false;
      if (!isDateInRange(p.invoice_date || p.created_at || '', dateRange)) return false;
      if (f.companyId && f.companyId !== 'all') {
        const biz = p.business_id || 'biz-saifee';
        if (biz !== f.companyId) return false;
      }
      if (f.godown && f.godown !== 'all') {
        const purGodown = p.receiving_godown_id || 'Main Godown';
        if (!isGodownMatch(purGodown, f.godown, db.godowns)) return false;
      }
      if (isPartyFiltered && !isPartyMatchingPurchase(p.supplier_id, selectedPartyId, db.suppliers)) return false;
      return true;
    })
    .map(p => {
      const supp = (db.suppliers || []).find(s => s.id === p.supplier_id || s.name.toLowerCase() === p.supplier_id.toLowerCase());
      const supplierName = supp?.name || (p as any).supplier_name || p.supplier_id || 'Supplier';
      let totalQty = 0;
      let totalDiscount = 0;
      let purchaseValue = 0;
      let totalGst = 0;

      const matchingItems = (p.items || []).filter(i => {
        const prod = (db.products || []).find(pr => pr.id === i.product_id);
        if (!prod) return false;
        if (f.companyId && f.companyId !== 'all' && prod.company_id !== f.companyId) return false;
        if (f.category && f.category !== 'all' && prod.category !== f.category) return false;
        if (f.productId && f.productId !== 'all' && prod.id !== f.productId) return false;
        return true;
      });

      if ((f.companyId || f.category || f.productId) && matchingItems.length === 0) {
        return null;
      }

      const itemsToCount = (f.companyId || f.category || f.productId) ? matchingItems : (p.items || []);

      itemsToCount.forEach(i => {
        const prod = (db.products || []).find(pr => pr.id === i.product_id);
        const unitsPerPack = i.units_per_box_carton || i.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
        const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
        const effectiveCartons = unitsPerPack > 1 ? (cQty + (lQty / unitsPerPack)) : (cQty > 0 ? cQty : i.quantity);
        const freeCartons = i.free_quantity ? (unitsPerPack > 1 ? Number((i.free_quantity / unitsPerPack).toFixed(2)) : i.free_quantity) : 0;

        totalQty += Number((effectiveCartons + freeCartons).toFixed(2));
        const purchaseRate = i.purchase_rate || i.carton_rate || prod?.purchase_price || 0;
        const lineDiscount = (i.discount || 0) * effectiveCartons;
        totalDiscount += lineDiscount;
        const lineCost = (i as any).taxable_value !== undefined ? (i as any).taxable_value : Math.max(0, (purchaseRate * effectiveCartons) - lineDiscount);
        purchaseValue += lineCost;
        const gstPct = i.gst_percent !== undefined ? i.gst_percent : (prod?.gst_percent !== undefined ? prod.gst_percent : 0);
        const lineGst = ((i as any).cgst || 0) + ((i as any).sgst || 0) + ((i as any).igst || 0) || Math.round(lineCost * (gstPct / 100) * 100) / 100;
        totalGst += lineGst;
      });

      return {
        purchaseId: p.id,
        purchaseDate: p.invoice_date || p.created_at || '',
        supplierName,
        invoiceNumber: p.invoice_number,
        itemCount: itemsToCount.length,
        totalQuantity: totalQty,
        purchaseValue: Math.round(purchaseValue),
        discount: Math.round(totalDiscount),
        gst: Math.round(totalGst),
        totalPurchaseAmount: Math.round(purchaseValue + totalGst),
        godown: p.receiving_godown_id || 'Main Godown',
        status: p.status
      };
    })
    .filter(Boolean) as PurchaseSummaryRow[];
}

export interface PurchaseRateHistoryRow {
  productId: string;
  productName: string;
  category?: string;
  variantPacking: string;
  tradingUnit: string;
  purchaseDate: string;
  supplierName: string;
  invoiceNumber: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchaseRate: number;
  landedCost: number;
  godown: string;
}

export function getPurchaseRateHistory(filters: ReportFilterState, db: DbState, user: UserContext): PurchaseRateHistoryRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);
  const selectedPartyId = f.retailerId || (f as any).partyId || (f as any).supplierId;
  const isPartyFiltered = !!(selectedPartyId && selectedPartyId !== 'all');

  const rows: PurchaseRateHistoryRow[] = [];

  (db.purchases || []).forEach(p => {
    if (p.status === 'Draft' || (p.status as string) === 'Cancelled') return;
    if (!isDateInRange(p.invoice_date || p.created_at || '', dateRange)) return;
    if (f.companyId && f.companyId !== 'all') {
      const biz = p.business_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }
    if (f.godown && f.godown !== 'all') {
      const purGodown = p.receiving_godown_id || 'Main Godown';
      if (!isGodownMatch(purGodown, f.godown, db.godowns)) return;
    }
    if (isPartyFiltered && !isPartyMatchingPurchase(p.supplier_id, selectedPartyId, db.suppliers)) return;

    const supp = (db.suppliers || []).find(s => s.id === p.supplier_id || s.name.toLowerCase() === p.supplier_id.toLowerCase());
    const supplierName = supp?.name || (p as any).supplier_name || p.supplier_id || 'Supplier';

    p.items?.forEach(item => {
      const prod = (db.products || []).find(pr => pr.id === item.product_id);
      if (!prod) return;
      if (f.companyId && f.companyId !== 'all' && prod.company_id !== f.companyId) return;
      if (f.category && f.category !== 'all' && prod.category !== f.category) return;
      if (f.productId && f.productId !== 'all' && prod.id !== f.productId) return;

      const unitsPerPack = item.units_per_box_carton || item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const cartonQty = Number((cQty + (lQty / unitsPerPack)).toFixed(2));
      const purchaseRate = item.purchase_rate || item.carton_rate || prod.purchase_price || 0;
      const gstPct = item.gst_percent !== undefined ? item.gst_percent : (prod.gst_percent !== undefined ? prod.gst_percent : 0);
      const landedCost = purchaseRate + (purchaseRate * (gstPct / 100));

      rows.push({
        productId: prod.id,
        productName: prod.name,
        category: prod.category || 'General',
        variantPacking: prod.pack_size || 'Standard',
        tradingUnit: formatTradingUnit(prod.trading_unit),
        purchaseDate: p.invoice_date || p.created_at || '',
        supplierName,
        invoiceNumber: p.invoice_number,
        batchNumber: item.batch || '—',
        expiryDate: item.expiry_date || '—',
        quantity: cartonQty,
        purchaseRate,
        landedCost: Number(landedCost.toFixed(2)),
        godown: p.receiving_godown_id || 'Main Godown'
      });
    });
  });

  return rows.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
}

// ----------------------------------------------------
// G. INVENTORY & STOCK REPORTS
// ----------------------------------------------------

export interface CurrentStockRow {
  productId: string;
  productName: string;
  companyName: string;
  category: string;
  brand: string;
  variantPacking: string;
  tradingUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  godown: string;
  batchNumber: string;
  expiryDate: string;
  
  // Stock quantities in Cartons / Boxes
  openingStockCartons: number;
  inwardStockCartons: number;
  outwardStockCartons: number;
  closingStockCartons: number;

  // Base unit counts
  openingStockBase: number;
  inwardStockBase: number;
  outwardStockBase: number;
  closingStockBase: number;

  physicalStock: number;
  reservedStock: number;
  availableStock: number; // in Cartons/Boxes
  damagedStock: number;
  expiredStock: number;
  purchaseRate: number; // Price per Carton/Box
  mrp: number;
  stockValue: number; // closingStockCartons * purchaseRate
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired';
}

export function getCurrentStock(filters: ReportFilterState, db: DbState, user: UserContext): CurrentStockRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);
  const now = new Date();

  const rows: CurrentStockRow[] = [];

  db.products.forEach(prod => {
    if (f.companyId && prod.company_id !== f.companyId) return;
    if (f.category && prod.category !== f.category) return;
    if (f.brand && prod.brand !== f.brand) return;
    if (f.productId && prod.id !== f.productId) return;

    const comp = db.companies.find(c => c.id === prod.company_id);
    const inv = db.inventory.find(i => i.product_id === prod.id);
    const prodBatches = db.batches.filter(b => b.product_id === prod.id);
    const unitsPerPack = prod.units_per_box_carton || prod.units_per_trading_unit || 1;
    const tradingUnit = prod.trading_unit || 'Box';
    const baseUnit = prod.base_unit || 'Piece';

    if (prodBatches.length > 0) {
      prodBatches.forEach(b => {
        if (f.batchNumber && b.batch_number !== f.batchNumber) return;

        const isExpired = new Date(b.expiry_date) < now;

        // Inward transactions in date range
        let inwardBase = 0;
        db.purchases.forEach(p => {
          if (!isDateInRange(p.invoice_date, dateRange)) return;
          p.items?.forEach(pi => {
            if (pi.product_id === prod.id && (pi.batch === b.batch_number || !b.batch_number)) {
              inwardBase += pi.quantity || (pi.carton_qty ? pi.carton_qty * unitsPerPack : 0);
            }
          });
        });
        db.salesReturns.forEach(sr => {
          if (!isDateInRange(sr.return_date, dateRange)) return;
          sr.items?.forEach(sri => {
            if (sri.product_id === prod.id) {
              inwardBase += sri.quantity;
            }
          });
        });

        // Outward transactions in date range
        let outwardBase = 0;
        db.invoices.forEach(invRec => {
          if (!isDateInRange(invRec.date, dateRange)) return;
          invRec.items?.forEach(ii => {
            if (ii.product_id === prod.id && (ii.batch_number === b.batch_number || !ii.batch_number)) {
              outwardBase += ii.quantity || ii.base_qty || 0;
            }
          });
        });

        const closingBase = Math.max(0, b.quantity || 0);
        const openingBase = Math.max(0, closingBase - inwardBase + outwardBase);

        const closingCartons = Number((closingBase / unitsPerPack).toFixed(2));
        const openingCartons = Number((openingBase / unitsPerPack).toFixed(2));
        const inwardCartons = Number((inwardBase / unitsPerPack).toFixed(2));
        const outwardCartons = Number((outwardBase / unitsPerPack).toFixed(2));

        let status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired' = 'In Stock';
        if (isExpired) status = 'Expired';
        else if (closingCartons === 0) status = 'Out of Stock';
        else if (closingCartons < 5) status = 'Low Stock';

        const stockValue = Math.round(closingCartons * b.purchase_rate);

        rows.push({
          productId: prod.id,
          productName: prod.name,
          companyName: comp?.name || 'Company',
          category: prod.category || 'General',
          brand: prod.brand,
          variantPacking: prod.pack_size,
          tradingUnit: formatTradingUnit(tradingUnit),
          baseUnit,
          unitsPerPack,
          godown: b.godown || 'Main Godown',
          batchNumber: b.batch_number,
          expiryDate: b.expiry_date,

          openingStockCartons: openingCartons,
          inwardStockCartons: inwardCartons,
          outwardStockCartons: outwardCartons,
          closingStockCartons: closingCartons,

          openingStockBase: openingBase,
          inwardStockBase: inwardBase,
          outwardStockBase: outwardBase,
          closingStockBase: closingBase,

          physicalStock: closingCartons,
          reservedStock: 0,
          availableStock: closingCartons,
          damagedStock: 0,
          expiredStock: isExpired ? closingCartons : 0,
          purchaseRate: b.purchase_rate,
          mrp: prod.mrp,
          stockValue,
          stockStatus: status
        });
      });
    } else {
      const physicalBase = inv?.physical_qty || 0;
      const reservedBase = inv?.reserved_qty || 0;
      const availableBase = inv?.available_qty || 0;
      const damagedBase = inv?.damaged_qty || 0;

      let inwardBase = 0;
      db.purchases.forEach(p => {
        if (!isDateInRange(p.invoice_date, dateRange)) return;
        p.items?.forEach(pi => {
          if (pi.product_id === prod.id) {
            inwardBase += pi.quantity || (pi.carton_qty ? pi.carton_qty * unitsPerPack : 0);
          }
        });
      });
      db.salesReturns.forEach(sr => {
        if (!isDateInRange(sr.return_date, dateRange)) return;
        sr.items?.forEach(sri => {
          if (sri.product_id === prod.id) {
            inwardBase += sri.quantity;
          }
        });
      });

      let outwardBase = 0;
      db.invoices.forEach(invRec => {
        if (!isDateInRange(invRec.date, dateRange)) return;
        invRec.items?.forEach(ii => {
          if (ii.product_id === prod.id) {
            outwardBase += ii.quantity || ii.base_qty || 0;
          }
        });
      });

      const closingBase = Math.max(0, availableBase);
      const openingBase = Math.max(0, closingBase - inwardBase + outwardBase);

      const closingCartons = Number((closingBase / unitsPerPack).toFixed(2));
      const openingCartons = Number((openingBase / unitsPerPack).toFixed(2));
      const inwardCartons = Number((inwardBase / unitsPerPack).toFixed(2));
      const outwardCartons = Number((outwardBase / unitsPerPack).toFixed(2));

      let status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired' = 'In Stock';
      if (closingCartons <= 0) status = 'Out of Stock';
      else if (closingCartons < 5) status = 'Low Stock';

      const stockValue = Math.round(closingCartons * prod.purchase_price);

      rows.push({
        productId: prod.id,
        productName: prod.name,
        companyName: comp?.name || 'Company',
        category: prod.category || 'General',
        brand: prod.brand,
        variantPacking: prod.pack_size,
        tradingUnit: formatTradingUnit(tradingUnit),
        baseUnit,
        unitsPerPack,
        godown: 'Main Godown',
        batchNumber: 'DEFAULT',
        expiryDate: '2027-12-31',

        openingStockCartons: openingCartons,
        inwardStockCartons: inwardCartons,
        outwardStockCartons: outwardCartons,
        closingStockCartons: closingCartons,

        openingStockBase: openingBase,
        inwardStockBase: inwardBase,
        outwardStockBase: outwardBase,
        closingStockBase: closingBase,

        physicalStock: Number((physicalBase / unitsPerPack).toFixed(2)),
        reservedStock: Number((reservedBase / unitsPerPack).toFixed(2)),
        availableStock: closingCartons,
        damagedStock: Number((damagedBase / unitsPerPack).toFixed(2)),
        expiredStock: 0,
        purchaseRate: prod.purchase_price,
        mrp: prod.mrp,
        stockValue,
        stockStatus: status
      });
    }
  });

  return rows.sort((a, b) => b.stockValue - a.stockValue);
}

export interface StockMovementRow {
  date: string;
  movementType: string;
  referenceNumber: string;
  productName: string;
  category?: string;
  variantPacking: string;
  tradingUnit: string;
  godown: string;
  quantityIn: number;
  quantityOut: number;
  unitCost: number;
  createdBy: string;
}

export function getStockMovement(filters: ReportFilterState, db: DbState, user: UserContext): StockMovementRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  return db.ledger
    .filter(entry => {
      if (!isDateInRange(entry.created_at, dateRange)) return false;
      const prod = db.products.find(p => p.id === entry.product_id);
      if (f.companyId && prod?.company_id !== f.companyId) return false;
      if (f.category && prod?.category !== f.category) return false;
      if (f.productId && prod?.id !== f.productId) return false;
      return true;
    })
    .map(entry => {
      const prod = db.products.find(p => p.id === entry.product_id);
      const userProf = db.profiles.find(p => p.id === entry.user_id);
      const unitsPerPack = prod?.units_per_box_carton || prod?.units_per_trading_unit || 1;

      return {
        date: entry.created_at.slice(0, 10),
        movementType: entry.reason,
        referenceNumber: entry.reference_id?.slice(0, 15) || 'SYSTEM',
        productName: prod?.name || 'Product',
        category: prod?.category || 'General',
        variantPacking: prod?.pack_size || '',
        tradingUnit: formatTradingUnit(prod?.trading_unit || 'Box'),
        godown: 'Main Godown',
        quantityIn: entry.direction === 'IN' ? Number((entry.change_qty / unitsPerPack).toFixed(2)) : 0,
        quantityOut: entry.direction === 'OUT' ? Number((Math.abs(entry.change_qty) / unitsPerPack).toFixed(2)) : 0,
        unitCost: prod?.purchase_price || 0,
        createdBy: userProf?.name || 'System Admin'
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ----------------------------------------------------
// H. OUTSTANDING & PAYMENT REPORTS
// ----------------------------------------------------

export interface PaymentCollectionRow {
  paymentId: string;
  paymentDate: string;
  paymentNumber: string;
  retailerName: string;
  retailerCode: string;
  method: string;
  amountReceived: number;
  referenceNumber: string;
  notes: string;
}

export function getPaymentCollection(filters: ReportFilterState, db: DbState, user: UserContext): PaymentCollectionRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  return db.payments
    .filter(p => {
      if (!isDateInRange(p.date, dateRange)) return false;
      if (f.retailerId && p.retailer_id !== f.retailerId) return false;
      return true;
    })
    .map(p => {
      const ret = db.retailers.find(r => r.id === p.retailer_id);
      return {
        paymentId: p.id,
        paymentDate: p.date.slice(0, 10),
        paymentNumber: p.payment_number,
        retailerName: ret?.shop_name || 'Retailer',
        retailerCode: ret?.retailer_code || 'RET',
        method: p.method,
        amountReceived: Math.round(p.amount),
        referenceNumber: p.reference_number || '—',
        notes: p.notes || ''
      };
    })
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

// ----------------------------------------------------
// I. GST REPORTS
// ----------------------------------------------------

export interface HSNWiseSalesRow {
  hsn: string;
  productNames: string;
  category?: string;
  taxableQuantity: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalInvoiceAmount: number;
}

export function getHSNWiseSales(filters: ReportFilterState, db: DbState, user: UserContext): HSNWiseSalesRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const hsnMap = new Map<string, {
    products: Set<string>;
    categories: Set<string>;
    qty: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>();

  db.invoices.forEach(inv => {
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    inv.items?.forEach(i => {
      const prod = db.products.find(p => p.id === i.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;

      const hsnKey = i.hsn || prod.hsn || '19053100';
      const curr = hsnMap.get(hsnKey) || {
        products: new Set<string>(),
        categories: new Set<string>(),
        qty: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0
      };

      curr.products.add(prod.name);
      if (prod.category) curr.categories.add(prod.category);
      curr.qty += i.quantity;
      curr.taxable += i.taxable_value;
      curr.cgst += i.cgst;
      curr.sgst += i.sgst;
      curr.igst += i.igst;
      curr.total += i.total_amount;

      hsnMap.set(hsnKey, curr);
    });
  });

  const rows: HSNWiseSalesRow[] = [];
  hsnMap.forEach((agg, hsn) => {
    rows.push({
      hsn,
      productNames: Array.from(agg.products).slice(0, 3).join(', ') + (agg.products.size > 3 ? ` +${agg.products.size - 3} more` : ''),
      category: Array.from(agg.categories).join(', ') || 'General',
      taxableQuantity: agg.qty,
      taxableValue: Math.round(agg.taxable),
      cgst: Math.round(agg.cgst),
      sgst: Math.round(agg.sgst),
      igst: Math.round(agg.igst),
      totalGst: Math.round(agg.cgst + agg.sgst + agg.igst),
      totalInvoiceAmount: Math.round(agg.total)
    });
  });

  return rows.sort((a, b) => b.taxableValue - a.taxableValue);
}

// ----------------------------------------------------
// J. ORDER REPORTS
// ----------------------------------------------------

export interface OrderSummaryRow {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  retailerName: string;
  salespersonName: string;
  status: string;
  itemCount: number;
  orderedQty: number;
  confirmedQty: number;
  pendingQty: number;
  orderValue: number;
}

export function getOrderSummary(filters: ReportFilterState, db: DbState, user: UserContext): OrderSummaryRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  return db.orders
    .filter(o => {
      if (!isDateInRange(o.order_date, dateRange)) return false;
      if (f.retailerId && o.retailer_id !== f.retailerId) return false;
      if (f.salespersonId && !isOrderMatchingSalesperson(o, f.salespersonId, db)) return false;
      if (f.orderStatus && f.orderStatus !== 'All' && o.status !== f.orderStatus) return false;

      // Filter by company/category/brand if specified
      if (f.companyId || f.category || f.brand || f.productId) {
        const hasMatchingItem = (o.items || []).some(i => {
          const prod = db.products.find(p => p.id === i.product_id);
          if (!prod) return false;
          if (f.companyId && prod.company_id !== f.companyId) return false;
          if (f.category && prod.category !== f.category) return false;
          if (f.brand && prod.brand !== f.brand) return false;
          if (f.productId && prod.id !== f.productId) return false;
          return true;
        });
        if (!hasMatchingItem) return false;
      }

      return true;
    })
    .map(o => {
      const ret = db.retailers.find(r => r.id === o.retailer_id);
      const salespersonName = getOrderSalespersonName(o, db);

      let ordered = 0;
      let confirmed = 0;
      let pending = 0;

      o.items?.forEach(i => {
        ordered += i.quantity;
        confirmed += i.confirmed_qty || 0;
        pending += i.pending_qty || 0;
      });

      return {
        orderId: o.id,
        orderNumber: o.order_number,
        orderDate: o.order_date.slice(0, 10),
        retailerName: ret?.shop_name || 'Retailer',
        salespersonName,
        status: o.status,
        itemCount: o.items?.length || 0,
        orderedQty: ordered,
        confirmedQty: confirmed,
        pendingQty: pending,
        orderValue: Math.round(o.total_amount)
      };
    })
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
}

// ----------------------------------------------------
// K. BATCH & EXPIRY REPORTS
// ----------------------------------------------------

export interface BatchExpiryRow {
  productId: string;
  productName: string;
  companyName: string;
  category: string;
  brand: string;
  variantPacking: string;
  tradingUnit: string;
  batchNumber: string;
  expiryDate: string;
  daysRemaining: number;
  godown: string;
  openingQuantity: number; // in Cartons/Boxes
  inwardQuantity: number;  // in Cartons/Boxes
  outwardQuantity: number; // in Cartons/Boxes
  availableQuantity: number; // Closing quantity in Cartons/Boxes
  purchaseRate: number;
  mrp: number;
  stockValue: number;
  status: 'Good' | 'Expiring in 30d' | 'Expiring in 60d' | 'Expiring in 90d' | 'Expired';
}

export function getBatchExpiryReport(filters: ReportFilterState, db: DbState, user: UserContext): BatchExpiryRow[] {
  const f = applyRbacFilters(filters, user);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);
  const now = new Date();

  const rows: BatchExpiryRow[] = [];

  db.batches.forEach(b => {
    const prod = db.products.find(p => p.id === b.product_id);
    if (!prod) return;
    if (f.companyId && prod.company_id !== f.companyId) return;
    if (f.category && prod.category !== f.category) return;
    if (f.productId && prod.id !== f.productId) return;

    const comp = db.companies.find(c => c.id === prod.company_id);
    const exp = new Date(b.expiry_date);
    const daysRemaining = Math.floor((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));

    let status: 'Good' | 'Expiring in 30d' | 'Expiring in 60d' | 'Expiring in 90d' | 'Expired' = 'Good';
    if (daysRemaining <= 0) status = 'Expired';
    else if (daysRemaining <= 30) status = 'Expiring in 30d';
    else if (daysRemaining <= 60) status = 'Expiring in 60d';
    else if (daysRemaining <= 90) status = 'Expiring in 90d';

    if (f.expiryStatus === '30d' && (daysRemaining < 0 || daysRemaining > 30)) return;
    if (f.expiryStatus === '60d' && (daysRemaining < 0 || daysRemaining > 60)) return;
    if (f.expiryStatus === '90d' && (daysRemaining < 0 || daysRemaining > 90)) return;
    if (f.expiryStatus === 'expired' && daysRemaining > 0) return;

    const unitsPerPack = prod.units_per_box_carton || prod.units_per_trading_unit || 1;

    // Calculate Inward during date range
    let inwardBase = 0;
    db.purchases.forEach(p => {
      if (!isDateInRange(p.invoice_date, dateRange)) return;
      p.items?.forEach(pi => {
        if (pi.product_id === prod.id && (pi.batch === b.batch_number || !b.batch_number)) {
          inwardBase += pi.quantity || (pi.carton_qty ? pi.carton_qty * unitsPerPack : 0);
        }
      });
    });
    db.salesReturns.forEach(sr => {
      if (!isDateInRange(sr.return_date, dateRange)) return;
      sr.items?.forEach(sri => {
        if (sri.product_id === prod.id) {
          inwardBase += sri.quantity;
        }
      });
    });

    // Calculate Outward during date range
    let outwardBase = 0;
    db.invoices.forEach(invRec => {
      if (!isDateInRange(invRec.date, dateRange)) return;
      invRec.items?.forEach(ii => {
        if (ii.product_id === prod.id && (ii.batch_number === b.batch_number || !ii.batch_number)) {
          outwardBase += ii.quantity || ii.base_qty || 0;
        }
      });
    });

    const closingBase = Math.max(0, b.quantity || 0);
    const openingBase = Math.max(0, closingBase - inwardBase + outwardBase);

    const closingCartons = Number((closingBase / unitsPerPack).toFixed(2));
    const openingCartons = Number((openingBase / unitsPerPack).toFixed(2));
    const inwardCartons = Number((inwardBase / unitsPerPack).toFixed(2));
    const outwardCartons = Number((outwardBase / unitsPerPack).toFixed(2));

    const stockValue = Math.round(closingCartons * b.purchase_rate);

    rows.push({
      productId: prod.id,
      productName: prod.name,
      companyName: comp?.name || 'Company',
      category: prod.category || 'General',
      brand: prod.brand,
      variantPacking: prod.pack_size,
      tradingUnit: formatTradingUnit(prod.trading_unit),
      batchNumber: b.batch_number,
      expiryDate: b.expiry_date,
      daysRemaining,
      godown: b.godown || 'Main Godown',
      openingQuantity: openingCartons,
      inwardQuantity: inwardCartons,
      outwardQuantity: outwardCartons,
      availableQuantity: closingCartons,
      purchaseRate: b.purchase_rate,
      mrp: prod.mrp,
      stockValue,
      status
    });
  });

  return rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ----------------------------------------------------
// PARTY REPORT BY ITEM (RETAILER-WISE SALES & PURCHASE SUMMARY)
// ----------------------------------------------------

export interface PartyReportSalesTransaction {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  orderNumber?: string;
  orderId?: string;
  date: string;
  retailerId: string;
  retailerName: string;
  partyName: string;
  productId: string;
  productName: string;
  brand?: string;
  variant?: string;
  packSize?: string;
  tradingUnit?: string;
  quantity: number; // in base units / pieces
  cartonQty?: number;
  looseQty?: number;
  rate: number; // billing rate
  discount: number;
  taxableValue: number;
  gstPercent?: number;
  gstAmount: number;
  finalAmount: number; // line total
  paymentMode?: string;
  salesperson?: string;
  channel?: string;
  godown?: string;
  status?: string;
}

export interface PartyReportPurchaseTransaction {
  id: string;
  purchaseId: string;
  purchaseNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  partyName: string;
  productId: string;
  productName: string;
  brand?: string;
  variant?: string;
  packSize?: string;
  tradingUnit?: string;
  quantity: number; // in base units / pieces
  cartonQty?: number;
  looseQty?: number;
  purchaseRate: number;
  discount: number;
  gstPercent?: number;
  gstAmount: number;
  purchaseAmount: number; // line total
  godown?: string;
  status?: string;
}

export interface PartyReportPartyRow {
  id: string; // party_id (retailer_id or supplier_id)
  partyId: string;
  retailerId: string;
  srNo: number;
  partyName: string;
  ownerName?: string;
  retailerCode?: string;
  mobile?: string;
  phone?: string;
  city?: string;
  gstin?: string;
  address?: string;
  partyType: 'Retailer' | 'Supplier' | 'Both';
  companyId?: string;
  companyName?: string;

  // 1. Sales Metrics (actual finalized sales in date range matching all filters)
  saleQty: number; // total units / pieces sold
  saleQtyCartons: number;
  saleQtyLoose: number;
  saleQtyDisplay: string;
  grossSaleAmount: number;
  saleDiscount: number;
  saleGst: number;
  saleReturnAmount: number;
  netSaleAmount: number;
  saleAmount: number; // Invoiced sales value (net of returns, or actual billed)
  invoicesCount: number;
  avgBillingRate: number; // saleAmount / saleQty

  // 2. Purchase Metrics (actual finalized purchases in date range matching all filters)
  purchaseQty: number; // total units / pieces purchased
  purchaseQtyCartons: number;
  purchaseQtyLoose: number;
  purchaseQtyDisplay: string;
  grossPurchaseAmount: number;
  purchaseDiscount: number;
  purchaseGst: number;
  purchaseReturnAmount: number;
  netPurchaseAmount: number;
  purchaseAmount: number; // Purchase value
  billsCount: number;
  purchaseBillsCount: number;
  avgPurchaseRate: number; // purchaseAmount / purchaseQty

  // Compatibility aliases
  productName?: string;
  totalSaleQtyPieces?: number;
  totalPurchaseQtyPieces?: number;
  totalSaleQtyBase?: number;
  totalPurchaseQtyBase?: number;
  closingInventoryDisplay?: string;
  totalClosingPhysicalPieces?: number;

  // Drilldown transaction arrays
  salesTransactions: PartyReportSalesTransaction[];
  purchaseTransactions: PartyReportPurchaseTransaction[];
  
  // Product-wise breakdown for this party
  productBreakdown: {
    productId: string;
    productName: string;
    brand?: string;
    variant?: string;
    packSize?: string;
    tradingUnit?: string;
    saleQty: number;
    saleAmount: number;
    avgRate: number;
    purchaseQty: number;
    purchaseAmount: number;
  }[];
}

// Backward compatibility type alias
export type PartyReportItemRow = PartyReportPartyRow;

export interface PartyItemReportSummary {
  recordCount: number; // Total number of active parties displayed
  totalSaleQty: number;
  totalSaleQtyCartons: number;
  totalSaleQtyLoose: number;
  totalSaleQtyDisplay: string;
  totalGrossSales: number;
  totalSalesReturn: number;
  totalNetSales: number;
  totalSaleGst: number;
  totalSaleDiscount: number;
  totalSaleAmount: number;
  totalInvoicesCount: number;

  totalPurchaseQty: number;
  totalPurchaseQtyCartons: number;
  totalPurchaseQtyLoose: number;
  totalPurchaseQtyDisplay: string;
  totalGrossPurchases: number;
  totalPurchaseReturn: number;
  totalNetPurchases: number;
  totalPurchaseGst: number;
  totalPurchaseDiscount: number;
  totalPurchaseAmount: number;
  totalPurchaseBillsCount: number;

  // Compatibility fields
  totalSaleQtyPieces?: number;
  totalSaleQtyBase?: number;
  totalGrossSaleAmount?: number;
  totalSaleGstAmount?: number;
  totalPurchaseQtyPieces?: number;
  totalPurchaseQtyBase?: number;
  totalClosingDisplay?: string;

  // Active item info if an item filter is selected
  selectedProduct?: {
    id: string;
    name: string;
    brand: string;
    packSize: string;
    tradingUnit: string;
    mrp: number;
    sellingPrice: number;
    purchasePrice: number;
    gstPercent: number;
    hsn: string;
    category: string;
  };
}

export function formatUnitQuantity(
  baseQty: number,
  looseQty: number,
  tradingUnit: string = 'Box',
  baseUnit: string = 'Piece',
  unitsPerPack: number = 1
): string {
  const getPlural = (count: number, unit: string) => {
    const u = (unit || 'Box').trim();
    if (count === 1) return `1 ${u}`;
    if (u.toLowerCase() === 'box') return `${count} Boxes`;
    if (u.toLowerCase() === 'case') return `${count} Cases`;
    if (u.toLowerCase() === 'carton') return `${count} Cartons`;
    if (u.toLowerCase() === 'bag') return `${count} Bags`;
    if (u.toLowerCase() === 'tin') return `${count} Tins`;
    if (u.toLowerCase() === 'dozen') return `${count} Dozens`;
    if (u.toLowerCase() === 'piece' || u.toLowerCase() === 'packet' || u.toLowerCase() === 'bottle' || u.toLowerCase() === 'pouch' || u.toLowerCase() === 'strip') {
      return `${count} ${u}s`;
    }
    if (u.endsWith('s') || u.endsWith('S')) return `${count} ${u}`;
    return `${count} ${u}s`;
  };

  if (baseQty === 0 && looseQty === 0) {
    return `0 ${tradingUnit.toLowerCase() === 'box' ? 'Boxes' : (tradingUnit.endsWith('s') ? tradingUnit : `${tradingUnit}s`)}`;
  }
  if (baseQty > 0 && looseQty > 0) {
    return `${getPlural(baseQty, tradingUnit)} + ${getPlural(looseQty, baseUnit)}`;
  }
  if (baseQty > 0) {
    return getPlural(baseQty, tradingUnit);
  }
  return getPlural(looseQty, baseUnit);
}

export function formatQuantity(base: number, loose: number): string {
  if (base === 0 && loose === 0) return '0';
  if (base > 0 && loose > 0) return `${base} + ${loose}`;
  if (base > 0) return `${base}`;
  return `${loose}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

export function formatDualQuantity(baseQty: number, looseQty: number): string {
  return formatQuantity(baseQty, looseQty);
}

export function isGodownMatch(recordGodownRef?: string, filterGodown?: string, godowns?: any[]): boolean {
  if (!filterGodown || filterGodown === 'all') return true;
  if (!recordGodownRef) return false;
  
  const recRef = recordGodownRef.trim().toLowerCase();
  const filterRef = filterGodown.trim().toLowerCase();
  
  if (recRef === filterRef) return true;
  if (recRef.includes(filterRef) || filterRef.includes(recRef)) return true;
  
  if (godowns && godowns.length > 0) {
    const matchedGodown = godowns.find(g => 
      (g.id && g.id.toLowerCase() === recRef) ||
      (g.name && g.name.toLowerCase() === recRef) ||
      (g.code && g.code.toLowerCase() === recRef)
    );
    if (matchedGodown) {
      if (
        (matchedGodown.id && matchedGodown.id.toLowerCase() === filterRef) ||
        (matchedGodown.name && matchedGodown.name.toLowerCase() === filterRef) ||
        (matchedGodown.code && matchedGodown.code.toLowerCase() === filterRef)
      ) {
        return true;
      }
    }

    const filterMatchedGodown = godowns.find(g => 
      (g.id && g.id.toLowerCase() === filterRef) ||
      (g.name && g.name.toLowerCase() === filterRef) ||
      (g.code && g.code.toLowerCase() === filterRef)
    );
    if (filterMatchedGodown) {
      if (
        (filterMatchedGodown.id && filterMatchedGodown.id.toLowerCase() === recRef) ||
        (filterMatchedGodown.name && filterMatchedGodown.name.toLowerCase() === recRef) ||
        (filterMatchedGodown.code && filterMatchedGodown.code.toLowerCase() === recRef)
      ) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Helper to match an invoice's retailer against the active party filter.
 */
export function isPartyMatchingInvoice(
  invRetailerId?: string, 
  filterPartyId?: string, 
  retailers?: Retailer[]
): boolean {
  if (!filterPartyId || filterPartyId === 'all') return true;
  if (!invRetailerId) return false;
  if (invRetailerId === filterPartyId) return true;

  if (retailers && retailers.length > 0) {
    const r1 = retailers.find(r => r.id === invRetailerId || r.retailer_code === invRetailerId || r.shop_name?.toLowerCase() === invRetailerId.toLowerCase());
    const r2 = retailers.find(r => r.id === filterPartyId || r.retailer_code === filterPartyId || r.shop_name?.toLowerCase() === filterPartyId.toLowerCase());
    
    if (r1 && (r1.id === filterPartyId || r1.retailer_code === filterPartyId || r1.shop_name?.toLowerCase() === filterPartyId.toLowerCase())) {
      return true;
    }
    if (r2 && (r2.id === invRetailerId || r2.retailer_code === invRetailerId || r2.shop_name?.toLowerCase() === invRetailerId.toLowerCase())) {
      return true;
    }
  }

  return invRetailerId.toLowerCase() === filterPartyId.toLowerCase();
}

/**
 * Helper to match a purchase's supplier against the active party filter.
 */
export function isPartyMatchingPurchase(
  purSupplierId?: string, 
  filterPartyId?: string, 
  suppliers?: Supplier[]
): boolean {
  if (!filterPartyId || filterPartyId === 'all') return true;
  if (!purSupplierId) return false;
  if (purSupplierId === filterPartyId) return true;

  if (suppliers && suppliers.length > 0) {
    const s1 = suppliers.find(s => s.id === purSupplierId || s.name.toLowerCase() === purSupplierId.toLowerCase());
    const s2 = suppliers.find(s => s.id === filterPartyId || s.name.toLowerCase() === filterPartyId.toLowerCase());
    
    if (s1 && (s1.id === filterPartyId || s1.name.toLowerCase() === filterPartyId.toLowerCase())) {
      return true;
    }
    if (s2 && (s2.id === purSupplierId || s2.name.toLowerCase() === purSupplierId.toLowerCase())) {
      return true;
    }
  }

  return purSupplierId.toLowerCase() === filterPartyId.toLowerCase();
}

/**
 * Main Aggregation Function for "Party Report by Item"
 * Aggregates actual sales and purchase transactions grouped by Retailer / Party.
 * Respects all filters: datePreset/custom dates, company, godown, category, item/product, variant, retailer, salesperson, channel, search query.
 */
export function getPartyItemReport(
  filters: ReportFilterState,
  db: DbState,
  userContext: UserContext
): { rows: PartyReportPartyRow[]; summary: PartyItemReportSummary } {
  const f = applyRbacFilters(filters, userContext);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  // Lookup Maps
  const orderMap = new Map<string, Order>();
  (db.orders || []).forEach(o => {
    orderMap.set(o.id, o);
    if (o.order_number) orderMap.set(o.order_number, o);
  });

  const retailerMap = new Map<string, Retailer>();
  (db.retailers || []).forEach(r => {
    retailerMap.set(r.id, r);
    if (r.retailer_code) retailerMap.set(r.retailer_code, r);
  });

  const supplierMap = new Map<string, Supplier>();
  (db.suppliers || []).forEach(s => {
    supplierMap.set(s.id, s);
    if (s.name) supplierMap.set(s.name, s);
  });

  const productMap = new Map<string, Product>();
  (db.products || []).forEach(p => {
    productMap.set(p.id, p);
    if (p.product_code) productMap.set(p.product_code, p);
  });

  const companyMap = new Map<string, Company>();
  (db.companies || []).forEach(c => {
    companyMap.set(c.id, c);
  });

  // Selected Product Information (if item filter is active)
  let selectedProductInfo: PartyItemReportSummary['selectedProduct'] | undefined = undefined;
  if (f.productId && f.productId !== 'all') {
    const prod = productMap.get(f.productId);
    if (prod) {
      selectedProductInfo = {
        id: prod.id,
        name: prod.name,
        brand: prod.brand || '',
        packSize: prod.pack_size || prod.packing_display || '',
        tradingUnit: prod.trading_unit || 'Box',
        mrp: prod.mrp || 0,
        sellingPrice: prod.selling_price || 0,
        purchasePrice: prod.purchase_price || 0,
        gstPercent: (prod.gst_percent !== undefined && prod.gst_percent !== null) ? Number(prod.gst_percent) : 0,
        hsn: prod.hsn || '',
        category: prod.category || ''
      };
    }
  }

  // Identify party filter mode
  const selectedPartyId = f.retailerId || (f as any).partyId || (f as any).supplierId;
  const isPartyFiltered = !!(selectedPartyId && selectedPartyId !== 'all');

  // Party Accumulator Structure
  interface PartyAccumulator {
    partyId: string;
    retailerId: string;
    partyName: string;
    ownerName?: string;
    retailerCode?: string;
    mobile?: string;
    phone?: string;
    city?: string;
    gstin?: string;
    address?: string;
    partyType: 'Retailer' | 'Supplier' | 'Both';
    companyId?: string;
    companyName?: string;

    saleQty: number;
    saleQtyCartons: number;
    saleQtyLoose: number;
    grossSaleAmount: number;
    saleDiscount: number;
    saleGst: number;
    saleReturnAmount: number;
    invoicesSet: Set<string>;

    purchaseQty: number;
    purchaseQtyCartons: number;
    purchaseQtyLoose: number;
    grossPurchaseAmount: number;
    purchaseDiscount: number;
    purchaseGst: number;
    purchaseReturnAmount: number;
    purchaseBillsSet: Set<string>;

    salesTransactions: PartyReportSalesTransaction[];
    purchaseTransactions: PartyReportPurchaseTransaction[];
    productBreakdownMap: Map<string, {
      productId: string;
      productName: string;
      brand?: string;
      variant?: string;
      packSize?: string;
      tradingUnit?: string;
      saleQty: number;
      saleAmount: number;
      avgRate: number;
      purchaseQty: number;
      purchaseAmount: number;
    }>;
  }

  const partyAccumulators = new Map<string, PartyAccumulator>();

  // Helper to get or create party accumulator
  const getOrCreateParty = (
    partyId: string,
    type: 'Retailer' | 'Supplier' = 'Retailer'
  ): PartyAccumulator => {
    let acc = partyAccumulators.get(partyId);
    if (!acc) {
      const retailer = retailerMap.get(partyId);
      const supplier = supplierMap.get(partyId);
      const name = retailer?.shop_name || supplier?.name || partyId;
      const owner = retailer?.owner_name || '';
      const code = retailer?.retailer_code || '';
      const mob = retailer?.mobile || retailer?.phone || '';
      const city = retailer?.city || '';
      const gstin = retailer?.gstin || supplier?.gstin || '';
      const addr = retailer?.address || supplier?.address || '';

      acc = {
        partyId,
        retailerId: partyId,
        partyName: name,
        ownerName: owner,
        retailerCode: code,
        mobile: mob,
        phone: mob,
        city,
        gstin,
        address: addr,
        partyType: retailer && supplier ? 'Both' : (retailer ? 'Retailer' : (supplier ? 'Supplier' : 'Retailer')),
        saleQty: 0,
        saleQtyCartons: 0,
        saleQtyLoose: 0,
        grossSaleAmount: 0,
        saleDiscount: 0,
        saleGst: 0,
        saleReturnAmount: 0,
        invoicesSet: new Set(),
        purchaseQty: 0,
        purchaseQtyCartons: 0,
        purchaseQtyLoose: 0,
        grossPurchaseAmount: 0,
        purchaseDiscount: 0,
        purchaseGst: 0,
        purchaseReturnAmount: 0,
        purchaseBillsSet: new Set(),
        salesTransactions: [],
        purchaseTransactions: [],
        productBreakdownMap: new Map()
      };
      partyAccumulators.set(partyId, acc);
    }
    return acc;
  };

  // 1. PROCESS SALES INVOICES (ACTUAL SALES TRANSACTIONS)
  (db.invoices || []).forEach(inv => {
    // Company isolation filter
    if (f.companyId && f.companyId !== 'all') {
      const biz = inv.business_id || inv.company_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }

    // Exclude cancelled invoices
    if (inv.status === 'Cancelled' || inv.invoice_status === 'Cancelled') return;

    // Date range filter
    if (!isDateInRange(inv.date || inv.created_at || '', dateRange)) return;

    // Retailer / Party filter
    if (isPartyFiltered && !isPartyMatchingInvoice(inv.retailer_id, selectedPartyId, db.retailers)) return;

    // Resolve originating order
    const srcOrderId = (inv.source_order_ids && inv.source_order_ids[0]) || inv.order_ref_id;
    const srcOrder = srcOrderId ? orderMap.get(srcOrderId) : undefined;

    // Salesperson resolution
    const spId = srcOrder ? getOrderSalespersonId(srcOrder, db) : getInvoiceSalespersonId(inv, db);
    const spProfile = spId ? db.profiles.find(p => p.id === spId) : undefined;
    const spName = spProfile?.full_name || spProfile?.name || getInvoiceSalespersonName(inv, db);

    // Apply Salesperson Filter
    if (f.salespersonId && f.salespersonId !== 'all') {
      const matchSp = (spId && spId === f.salespersonId) || 
                      (spName && spName.toLowerCase().includes(f.salespersonId.toLowerCase()));
      if (!matchSp) return;
    }

    // Order channel resolution (Strict 4 Channels)
    let orderChannel = 'Distributor Salesperson';
    const rawChan = (srcOrder?.channel || srcOrder?.source || (inv as any).channel || '').toLowerCase();
    if (rawChan.includes('direct') || rawChan.includes('retailer direct') || rawChan.includes('retailer_direct')) {
      orderChannel = 'Retailer Direct';
    } else if (rawChan.includes('company')) {
      orderChannel = 'Company Salesperson';
    } else if (rawChan.includes('counter') || rawChan.includes('counter_sale')) {
      orderChannel = 'On Counter Sale';
    } else {
      orderChannel = 'Distributor Salesperson';
    }

    // Apply Channel Filter
    if (f.channel && f.channel !== 'all' && orderChannel !== f.channel) {
      return;
    }

    // Godown resolution for sales transaction
    const invGodown = srcOrder?.dispatch_godown || inv.place_of_supply || 'Main Godown';

    // Apply Godown Filter
    if (f.godown && f.godown !== 'all') {
      if (!isGodownMatch(invGodown, f.godown, db.godowns)) return;
    }

    const partyAcc = getOrCreateParty(inv.retailer_id, 'Retailer');
    const retailer = retailerMap.get(inv.retailer_id);
    const partyName = retailer?.shop_name || retailer?.owner_name || partyAcc.partyName;

    // Process Line Items
    (inv.items || []).forEach((item, itemIdx) => {
      const prod = productMap.get(item.product_id);
      
      // Category Filter
      if (f.category && f.category !== 'all' && prod?.category !== f.category) {
        return;
      }

      // Brand Filter
      if (f.brand && f.brand !== 'all' && prod?.brand !== f.brand) {
        return;
      }

      // Product / Item Filter (Variant matching by product_id)
      if (f.productId && f.productId !== 'all' && item.product_id !== f.productId) {
        return;
      }

      // Variant / Pack Size Filter
      if (f.variantPacking && f.variantPacking !== 'all') {
        const itemPack = item.packing || prod?.pack_size || '';
        if (itemPack !== f.variantPacking) return;
      }

      // Quantities & Calculations
      const unitsPerPack = item.units_per_box_carton || item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const basePieces = item.base_qty !== undefined ? item.base_qty : (item.quantity !== undefined ? item.quantity : 0);
      const cQty = item.carton_qty !== undefined ? item.carton_qty : (unitsPerPack > 1 ? Math.floor(basePieces / unitsPerPack) : basePieces);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (unitsPerPack > 1 ? (basePieces % unitsPerPack) : 0);

      const unitRate = item.carton_rate || item.rate || item.unit_rate || prod?.selling_price || 0;
      const flatDiscount = (item.discount || 0) + (item.carton_discount || 0);
      const effectiveRate = Math.max(0, unitRate - flatDiscount);
      const effectiveCartons = unitsPerPack > 1 ? (cQty + (lQty / unitsPerPack)) : (cQty > 0 ? cQty : basePieces);
      const lineTaxable = item.taxable_value !== undefined ? item.taxable_value : Math.round(effectiveCartons * effectiveRate * 100) / 100;
      const itemGstPct = (item.gst_percent !== undefined && item.gst_percent !== null)
        ? Number(item.gst_percent)
        : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0);
      const lineGst = ((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)) || Math.round(lineTaxable * (itemGstPct / 100) * 100) / 100;
      const lineTotal = item.total_amount !== undefined ? item.total_amount : Math.round((lineTaxable + lineGst) * 100) / 100;

      partyAcc.saleQty += basePieces;
      partyAcc.saleQtyCartons += cQty;
      partyAcc.saleQtyLoose += lQty;
      partyAcc.grossSaleAmount += lineTaxable;
      partyAcc.saleDiscount += (flatDiscount * effectiveCartons);
      partyAcc.saleGst += lineGst;
      partyAcc.invoicesSet.add(inv.id);

      // Product Breakdown Map for Drill-down
      const pKey = item.product_id;
      let pEntry = partyAcc.productBreakdownMap.get(pKey);
      if (!pEntry) {
        pEntry = {
          productId: item.product_id,
          productName: item.product_name || prod?.name || 'FMCG Product',
          brand: prod?.brand,
          variant: prod?.pack_size || item.packing || 'Standard',
          packSize: prod?.pack_size || item.packing || 'Standard',
          tradingUnit: item.trading_unit || prod?.trading_unit || 'Box',
          saleQty: 0,
          saleAmount: 0,
          avgRate: 0,
          purchaseQty: 0,
          purchaseAmount: 0
        };
        partyAcc.productBreakdownMap.set(pKey, pEntry);
      }
      pEntry.saleQty += basePieces;
      pEntry.saleAmount += lineTaxable;
      pEntry.avgRate = pEntry.saleQty > 0 ? Math.round((pEntry.saleAmount / pEntry.saleQty) * 100) / 100 : 0;

      // Add to sales transactions list
      partyAcc.salesTransactions.push({
        id: item.id || `inv-item-${inv.id}-${itemIdx}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        orderNumber: srcOrder?.order_number || inv.order_ref_id,
        orderId: srcOrder?.id,
        date: inv.date || inv.created_at || '',
        retailerId: inv.retailer_id,
        retailerName: partyName,
        partyName,
        productId: item.product_id,
        productName: item.product_name || prod?.name || 'FMCG Product',
        brand: prod?.brand,
        variant: prod?.pack_size || item.packing || (unitsPerPack > 1 ? `${unitsPerPack} pcs/box` : '1 pc'),
        packSize: prod?.pack_size || item.packing || 'Standard',
        tradingUnit: item.trading_unit || prod?.trading_unit || 'Box',
        quantity: basePieces,
        cartonQty: cQty,
        looseQty: lQty,
        rate: effectiveRate,
        discount: flatDiscount,
        taxableValue: lineTaxable,
        gstPercent: itemGstPct,
        gstAmount: lineGst,
        finalAmount: lineTaxable,
        paymentMode: inv.payment_mode || 'Credit',
        salesperson: spName,
        channel: orderChannel,
        godown: invGodown,
        status: inv.status || 'Finalized'
      });
    });
  });

  // 2. PROCESS SALES RETURNS
  (db.salesReturns || []).forEach(sr => {
    if (f.companyId && f.companyId !== 'all') {
      const biz = sr.business_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }

    if (sr.status === 'Cancelled') return;
    if (!isDateInRange(sr.return_date, dateRange)) return;
    if (isPartyFiltered && !isPartyMatchingInvoice(sr.retailer_id || '', selectedPartyId, db.retailers)) return;

    if (sr.retailer_id) {
      const partyAcc = partyAccumulators.get(sr.retailer_id);
      if (partyAcc) {
        (sr.items || []).forEach(srItem => {
          const prod = productMap.get(srItem.product_id);
          if (f.category && f.category !== 'all' && prod?.category !== f.category) return;
          if (f.productId && f.productId !== 'all' && srItem.product_id !== f.productId) return;
          const returnTaxable = (srItem as any).taxable_value !== undefined ? (srItem as any).taxable_value : (srItem.total_amount || 0);
          partyAcc.saleReturnAmount += returnTaxable;
        });
      }
    }
  });

  // 3. PROCESS PURCHASES (ACTUAL PURCHASE TRANSACTIONS)
  (db.purchases || []).forEach(pur => {
    if (f.companyId && f.companyId !== 'all') {
      const biz = pur.business_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }

    if (pur.status === 'Draft' || (pur.status as string) === 'Cancelled') return;
    if (!isDateInRange(pur.invoice_date || pur.created_at || '', dateRange)) return;

    // Party filter for purchases
    if (isPartyFiltered && !isPartyMatchingPurchase(pur.supplier_id, selectedPartyId, db.suppliers)) return;

    // Godown filter for purchases
    const purGodown = pur.receiving_godown_id || 'Main Godown';
    if (f.godown && f.godown !== 'all') {
      if (!isGodownMatch(purGodown, f.godown, db.godowns)) return;
    }

    const partyAcc = getOrCreateParty(pur.supplier_id, 'Supplier');
    const supplier = supplierMap.get(pur.supplier_id);
    const supplierName = supplier?.name || partyAcc.partyName;

    (pur.items || []).forEach((pItem, pIdx) => {
      const prod = productMap.get(pItem.product_id);

      // Category Filter
      if (f.category && f.category !== 'all' && prod?.category !== f.category) {
        return;
      }

      // Brand Filter
      if (f.brand && f.brand !== 'all' && prod?.brand !== f.brand) {
        return;
      }

      // Product / Item Filter
      if (f.productId && f.productId !== 'all' && pItem.product_id !== f.productId) {
        return;
      }

      // Variant Filter
      if (f.variantPacking && f.variantPacking !== 'all') {
        const itemPack = prod?.pack_size || '';
        if (itemPack !== f.variantPacking) return;
      }

      // Quantities & Calculations
      const unitsPerPack = pItem.units_per_box_carton || pItem.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const basePieces = pItem.base_qty !== undefined ? pItem.base_qty : (pItem.quantity !== undefined ? pItem.quantity : 0);
      const cQty = pItem.carton_qty !== undefined ? pItem.carton_qty : (unitsPerPack > 1 ? Math.floor(basePieces / unitsPerPack) : basePieces);
      const lQty = pItem.loose_qty !== undefined ? pItem.loose_qty : (unitsPerPack > 1 ? (basePieces % unitsPerPack) : 0);
      const purchaseRate = pItem.purchase_rate || pItem.carton_rate || prod?.purchase_price || 0;
      const effectiveCartons = unitsPerPack > 1 ? (cQty + (lQty / unitsPerPack)) : (cQty > 0 ? cQty : basePieces);
      const lineCost = (pItem as any).taxable_value !== undefined ? (pItem as any).taxable_value : Math.round(effectiveCartons * purchaseRate * 100) / 100;
      const gstPct = pItem.gst_percent !== undefined ? pItem.gst_percent : (prod?.gst_percent !== undefined ? prod.gst_percent : 0);
      const lineGst = ((pItem as any).cgst || 0) + ((pItem as any).sgst || 0) + ((pItem as any).igst || 0) || Math.round(lineCost * (gstPct / 100) * 100) / 100;
      const lineTotal = (pItem as any).total_amount !== undefined ? (pItem as any).total_amount : Math.round((lineCost + lineGst) * 100) / 100;

      partyAcc.purchaseQty += basePieces;
      partyAcc.purchaseQtyCartons += cQty;
      partyAcc.purchaseQtyLoose += lQty;
      partyAcc.grossPurchaseAmount += lineCost;
      partyAcc.purchaseGst += lineGst;
      partyAcc.purchaseBillsSet.add(pur.id);

      // Product Breakdown Map for Drill-down
      const pKey = pItem.product_id;
      let pEntry = partyAcc.productBreakdownMap.get(pKey);
      if (!pEntry) {
        pEntry = {
          productId: pItem.product_id,
          productName: prod?.name || 'FMCG Product',
          brand: prod?.brand,
          variant: prod?.pack_size || 'Standard',
          packSize: prod?.pack_size || 'Standard',
          tradingUnit: pItem.trading_unit || prod?.trading_unit || 'Box',
          saleQty: 0,
          saleAmount: 0,
          avgRate: 0,
          purchaseQty: 0,
          purchaseAmount: 0
        };
        partyAcc.productBreakdownMap.set(pKey, pEntry);
      }
      pEntry.purchaseQty += basePieces;
      pEntry.purchaseAmount += lineCost;

      // Add to purchase transactions list
      partyAcc.purchaseTransactions.push({
        id: pItem.id || `pur-item-${pur.id}-${pIdx}`,
        purchaseId: pur.id,
        purchaseNumber: pur.invoice_number,
        date: pur.invoice_date || pur.created_at || '',
        supplierId: pur.supplier_id,
        supplierName,
        partyName: supplierName,
        productId: pItem.product_id,
        productName: prod?.name || 'FMCG Product',
        brand: prod?.brand,
        variant: prod?.pack_size || (unitsPerPack > 1 ? `${unitsPerPack} pcs/box` : '1 pc'),
        packSize: prod?.pack_size || 'Standard',
        tradingUnit: pItem.trading_unit || prod?.trading_unit || 'Box',
        quantity: basePieces,
        cartonQty: cQty,
        looseQty: lQty,
        purchaseRate,
        discount: pItem.discount || 0,
        gstPercent: (pItem.gst_percent !== undefined && pItem.gst_percent !== null) 
          ? Number(pItem.gst_percent) 
          : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0),
        gstAmount: lineGst,
        purchaseAmount: lineCost,
        godown: purGodown,
        status: pur.status || 'Confirmed'
      });
    });
  });

  // 4. CONSTRUCT PARTY ROWS
  let rows: PartyReportPartyRow[] = [];
  let rowIdx = 1;

  partyAccumulators.forEach((acc) => {
    // Only include parties with transactions in the filtered set
    const hasSales = acc.saleQty > 0 || acc.grossSaleAmount > 0;
    const hasPurchases = acc.purchaseQty > 0 || acc.grossPurchaseAmount > 0;

    if (!hasSales && !hasPurchases && !isPartyFiltered) {
      return;
    }

    const netSaleAmt = Math.max(0, acc.grossSaleAmount - acc.saleReturnAmount);
    const saleAmt = Math.round(netSaleAmt * 100) / 100;
    const purAmt = Math.round(acc.grossPurchaseAmount * 100) / 100;
    const avgBillingRate = acc.saleQty > 0 ? Math.round((saleAmt / acc.saleQty) * 100) / 100 : 0;
    const avgPurchaseRate = acc.purchaseQty > 0 ? Math.round((purAmt / acc.purchaseQty) * 100) / 100 : 0;

    const row: PartyReportPartyRow = {
      id: acc.partyId,
      partyId: acc.partyId,
      retailerId: acc.partyId,
      srNo: rowIdx++,
      partyName: acc.partyName,
      ownerName: acc.ownerName,
      retailerCode: acc.retailerCode,
      mobile: acc.mobile,
      phone: acc.phone,
      city: acc.city,
      gstin: acc.gstin,
      address: acc.address,
      partyType: acc.partyType,
      companyId: acc.companyId,
      companyName: acc.companyName,

      // Sales Metrics
      saleQty: acc.saleQty,
      saleQtyCartons: acc.saleQtyCartons,
      saleQtyLoose: acc.saleQtyLoose,
      saleQtyDisplay: selectedProductInfo ? formatUnitQuantity(acc.saleQtyCartons, acc.saleQtyLoose, selectedProductInfo.tradingUnit, 'Piece', 1) : formatQuantity(acc.saleQtyCartons, acc.saleQtyLoose),
      grossSaleAmount: Math.round(acc.grossSaleAmount * 100) / 100,
      saleDiscount: Math.round(acc.saleDiscount * 100) / 100,
      saleGst: Math.round(acc.saleGst * 100) / 100,
      saleReturnAmount: Math.round(acc.saleReturnAmount * 100) / 100,
      netSaleAmount: saleAmt,
      saleAmount: saleAmt,
      invoicesCount: acc.invoicesSet.size,
      avgBillingRate,

      // Purchase Metrics
      purchaseQty: acc.purchaseQty,
      purchaseQtyCartons: acc.purchaseQtyCartons,
      purchaseQtyLoose: acc.purchaseQtyLoose,
      purchaseQtyDisplay: selectedProductInfo ? formatUnitQuantity(acc.purchaseQtyCartons, acc.purchaseQtyLoose, selectedProductInfo.tradingUnit, 'Piece', 1) : formatQuantity(acc.purchaseQtyCartons, acc.purchaseQtyLoose),
      grossPurchaseAmount: purAmt,
      purchaseDiscount: Math.round(acc.purchaseDiscount * 100) / 100,
      purchaseGst: Math.round(acc.purchaseGst * 100) / 100,
      purchaseReturnAmount: Math.round(acc.purchaseReturnAmount * 100) / 100,
      netPurchaseAmount: purAmt,
      purchaseAmount: purAmt,
      billsCount: acc.purchaseBillsSet.size,
      purchaseBillsCount: acc.purchaseBillsSet.size,
      avgPurchaseRate,

      // Compatibility fields
      productName: acc.partyName,
      totalSaleQtyPieces: acc.saleQty,
      totalPurchaseQtyPieces: acc.purchaseQty,
      totalSaleQtyBase: acc.saleQtyCartons,
      totalPurchaseQtyBase: acc.purchaseQtyCartons,
      closingInventoryDisplay: '0',
      totalClosingPhysicalPieces: 0,

      // Transactions & Breakdown
      salesTransactions: acc.salesTransactions,
      purchaseTransactions: acc.purchaseTransactions,
      productBreakdown: Array.from(acc.productBreakdownMap.values()).sort((a, b) => b.saleAmount - a.saleAmount)
    };

    rows.push(row);
  });

  // 5. SEARCH FILTER ACROSS MULTIPLE FIELDS
  if (f.searchQuery && f.searchQuery.trim()) {
    const q = f.searchQuery.trim().toLowerCase();
    rows = rows.filter(r => {
      // 1. Retailer Name & Info
      if (r.partyName.toLowerCase().includes(q)) return true;
      if (r.ownerName && r.ownerName.toLowerCase().includes(q)) return true;
      if (r.retailerCode && r.retailerCode.toLowerCase().includes(q)) return true;
      if (r.mobile && r.mobile.includes(q)) return true;
      if (r.phone && r.phone.includes(q)) return true;
      if (r.city && r.city.toLowerCase().includes(q)) return true;
      if (r.gstin && r.gstin.toLowerCase().includes(q)) return true;

      // 2. Product Name, SKU, Order #, Invoice # in Sales Transactions
      const matchInSales = r.salesTransactions.some(t =>
        (t.productName && t.productName.toLowerCase().includes(q)) ||
        (t.brand && t.brand.toLowerCase().includes(q)) ||
        (t.invoiceNumber && t.invoiceNumber.toLowerCase().includes(q)) ||
        (t.orderNumber && t.orderNumber.toLowerCase().includes(q)) ||
        (t.salesperson && t.salesperson.toLowerCase().includes(q))
      );
      if (matchInSales) return true;

      // 3. Purchase Transactions
      const matchInPurchase = r.purchaseTransactions.some(t =>
        (t.productName && t.productName.toLowerCase().includes(q)) ||
        (t.purchaseNumber && t.purchaseNumber.toLowerCase().includes(q)) ||
        (t.supplierName && t.supplierName.toLowerCase().includes(q))
      );
      if (matchInPurchase) return true;

      // 4. Product Breakdown
      const matchInBreakdown = r.productBreakdown.some(pb =>
        pb.productName.toLowerCase().includes(q) ||
        (pb.brand && pb.brand.toLowerCase().includes(q))
      );
      if (matchInBreakdown) return true;

      return false;
    });

    // Re-index serial numbers
    rows = rows.map((r, i) => ({ ...r, srNo: i + 1 }));
  }

  // 6. CALCULATE TOTALS ACCORDING TO FILTERED DATASET
  let totalSaleQty = 0;
  let totalSaleQtyCartons = 0;
  let totalSaleQtyLoose = 0;
  let totalGrossSales = 0;
  let totalSalesReturn = 0;
  let totalNetSales = 0;
  let totalSaleGst = 0;
  let totalSaleDiscount = 0;
  let totalInvoicesCount = 0;

  let totalPurchaseQty = 0;
  let totalPurchaseQtyCartons = 0;
  let totalPurchaseQtyLoose = 0;
  let totalGrossPurchases = 0;
  let totalPurchaseReturn = 0;
  let totalNetPurchases = 0;
  let totalPurchaseGst = 0;
  let totalPurchaseDiscount = 0;
  let totalPurchaseBillsCount = 0;

  const countedInvoiceIds = new Set<string>();
  const countedPurchaseIds = new Set<string>();

  rows.forEach(r => {
    totalSaleQty += r.saleQty;
    totalSaleQtyCartons += r.saleQtyCartons;
    totalSaleQtyLoose += r.saleQtyLoose;
    totalGrossSales += r.grossSaleAmount;
    totalSalesReturn += r.saleReturnAmount;
    totalNetSales += r.saleAmount;
    totalSaleGst += r.saleGst;
    totalSaleDiscount += r.saleDiscount;

    r.salesTransactions.forEach(t => countedInvoiceIds.add(t.invoiceId));

    totalPurchaseQty += r.purchaseQty;
    totalPurchaseQtyCartons += r.purchaseQtyCartons;
    totalPurchaseQtyLoose += r.purchaseQtyLoose;
    totalGrossPurchases += r.purchaseAmount;
    totalPurchaseReturn += r.purchaseReturnAmount;
    totalNetPurchases += r.netPurchaseAmount;
    totalPurchaseGst += r.purchaseGst;
    totalPurchaseDiscount += r.purchaseDiscount;

    r.purchaseTransactions.forEach(t => countedPurchaseIds.add(t.purchaseId));
  });

  totalInvoicesCount = countedInvoiceIds.size;
  totalPurchaseBillsCount = countedPurchaseIds.size;

  const summary: PartyItemReportSummary = {
    recordCount: rows.length,
    totalSaleQty,
    totalSaleQtyCartons,
    totalSaleQtyLoose,
    totalSaleQtyDisplay: totalSaleQty.toLocaleString('en-IN'),
    totalGrossSales: Math.round(totalGrossSales * 100) / 100,
    totalSalesReturn: Math.round(totalSalesReturn * 100) / 100,
    totalNetSales: Math.round(totalNetSales * 100) / 100,
    totalSaleGst: Math.round(totalSaleGst * 100) / 100,
    totalSaleDiscount: Math.round(totalSaleDiscount * 100) / 100,
    totalSaleAmount: Math.round(totalNetSales * 100) / 100,
    totalInvoicesCount,

    totalPurchaseQty,
    totalPurchaseQtyCartons,
    totalPurchaseQtyLoose,
    totalPurchaseQtyDisplay: totalPurchaseQty.toLocaleString('en-IN'),
    totalGrossPurchases: Math.round(totalGrossPurchases * 100) / 100,
    totalPurchaseReturn: Math.round(totalPurchaseReturn * 100) / 100,
    totalNetPurchases: Math.round(totalNetPurchases * 100) / 100,
    totalPurchaseGst: Math.round(totalPurchaseGst * 100) / 100,
    totalPurchaseDiscount: Math.round(totalPurchaseDiscount * 100) / 100,
    totalPurchaseAmount: Math.round(totalGrossPurchases * 100) / 100,
    totalPurchaseBillsCount,

    // Compatibility fields
    totalSaleQtyPieces: totalSaleQty,
    totalSaleQtyBase: totalSaleQtyCartons,
    totalGrossSaleAmount: Math.round(totalGrossSales * 100) / 100,
    totalSaleGstAmount: Math.round(totalSaleGst * 100) / 100,
    totalPurchaseQtyPieces: totalPurchaseQty,
    totalPurchaseQtyBase: totalPurchaseQtyCartons,
    totalClosingDisplay: '0',

    selectedProduct: selectedProductInfo
  };

  return { rows, summary };
}

// ----------------------------------------------------
// ITEM REPORT BY PARTY (PRODUCT-WISE SALES, PURCHASES & CLOSING INVENTORY)
// ----------------------------------------------------

export interface ItemReportByPartyRow {
  id: string; // product_id
  productId: string;
  variantId?: string;
  srNo: number;
  productName: string;
  productCode?: string;
  sku: string;
  barcode?: string;
  brand?: string;
  category?: string;
  packSize: string;
  variantPacking?: string;
  tradingUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  companyId?: string;
  companyName?: string;
  mrp: number;
  sellingPrice: number;
  purchasePrice: number;
  gstPercent?: number;
  hsn?: string;

  // 1. Sales Metrics
  saleQtyBase: number;
  saleQtyLoose: number;
  saleQtyDisplay: string;
  totalSaleQtyPieces: number;
  grossSaleAmount: number;
  saleDiscount: number;
  saleGst: number;
  saleReturnAmount: number;
  saleAmount: number; // Net Sales
  invoicesCount: number;
  avgSaleRate: number;

  // 2. Purchase Metrics
  purchaseQtyBase: number;
  purchaseQtyLoose: number;
  purchaseQtyDisplay: string;
  totalPurchaseQtyPieces: number;
  purchaseAmount: number;
  purchaseBillsCount: number;
  avgPurchaseRate: number;

  // 3. Closing Inventory (Current Physical Godown Stock)
  closingInventoryBase: number;
  closingInventoryLoose: number;
  closingInventoryDisplay: string;
  totalClosingPhysicalPieces: number;

  // Inventory breakdown
  physicalStockPieces: number;
  physicalStockDisplay: string;
  reservedStockPieces: number;
  reservedStockDisplay: string;
  availableStockPieces: number;
  availableStockDisplay: string;
  damagedStockPieces: number;
  damagedStockDisplay: string;
  expiredStockPieces: number;
  expiredStockDisplay: string;
  pendingStockPieces: number;
  pendingStockDisplay: string;

  // Godown breakdown
  godownStockBreakdown: {
    godownId: string;
    godownName: string;
    physical: number;
    reserved: number;
    available: number;
    damaged: number;
    expired: number;
  }[];

  // Party breakdown for drill-down inspection
  partySalesBreakdown: {
    partyId: string;
    partyName: string;
    partyType: 'Retailer' | 'Supplier' | 'Customer';
    saleQty: number;
    saleQtyDisplay: string;
    saleAmount: number;
    invoiceCount: number;
  }[];
  partyPurchaseBreakdown: {
    partyId: string;
    partyName: string;
    purchaseQty: number;
    purchaseQtyDisplay: string;
    purchaseAmount: number;
    billCount: number;
  }[];

  // Transaction Lists for Drill-Down
  salesTransactions: PartyReportSalesTransaction[];
  purchaseTransactions: PartyReportPurchaseTransaction[];
  stockMovements: StockLedgerEntry[];
}

export interface ItemReportByPartySummary {
  recordCount: number;
  totalSaleQtyPieces: number;
  totalSaleQtyBase: number;
  totalSaleQtyLoose: number;
  totalGrossSaleAmount: number;
  totalSaleDiscount: number;
  totalSaleGst: number;
  totalSaleReturnAmount: number;
  totalSaleAmount: number; // Net Sales
  totalPurchaseQtyPieces: number;
  totalPurchaseQtyBase: number;
  totalPurchaseQtyLoose: number;
  totalPurchaseAmount: number;

  // Closing Inventory Totals
  totalClosingPhysicalPieces: number;
  totalClosingDisplay: string;
  isSingleUnitType: boolean;
  commonTradingUnit?: string;
  unitWiseTotals: { [unit: string]: number };
}

/**
 * Aggregation Function for "Item Report by Party"
 * Product-Centric: Primary table row is each Product / Item.
 * Calculates Sales, Purchases, Party Breakdown, and Godown Physical Stock.
 */
export function getItemReportByParty(
  filters: ReportFilterState,
  db: DbState,
  userContext: UserContext
): { rows: ItemReportByPartyRow[]; summary: ItemReportByPartySummary } {
  const f = applyRbacFilters(filters, userContext);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const orderMap = new Map<string, Order>();
  (db.orders || []).forEach(o => {
    orderMap.set(o.id, o);
    if (o.order_number) orderMap.set(o.order_number, o);
  });

  const retailerMap = new Map<string, Retailer>();
  (db.retailers || []).forEach(r => {
    retailerMap.set(r.id, r);
    if (r.retailer_code) retailerMap.set(r.retailer_code, r);
  });

  const supplierMap = new Map<string, Supplier>();
  (db.suppliers || []).forEach(s => {
    supplierMap.set(s.id, s);
    if (s.name) supplierMap.set(s.name, s);
  });

  const companyMap = new Map<string, Company>();
  (db.companies || []).forEach(c => {
    companyMap.set(c.id, c);
  });

  const selectedPartyId = f.retailerId || (f as any).partyId || (f as any).supplierId;
  const isPartyFiltered = !!(selectedPartyId && selectedPartyId !== 'all');

  // Candidate products based on category/brand/company/product filter
  const candidateProducts = (db.products || []).filter(prod => {
    if (f.companyId && f.companyId !== 'all' && prod.company_id && prod.company_id !== f.companyId) return false;
    if (f.category && f.category !== 'all' && prod.category !== f.category) return false;
    if (f.brand && f.brand !== 'all' && prod.brand !== f.brand) return false;
    if (f.productId && f.productId !== 'all' && prod.id !== f.productId) return false;
    if (f.variantPacking && f.variantPacking !== 'all' && prod.pack_size !== f.variantPacking) return false;
    return true;
  });

  interface ProductAccumulator {
    product: Product;
    saleQtyBase: number;
    saleQtyLoose: number;
    totalSaleQtyPieces: number;
    grossSaleAmount: number;
    saleDiscount: number;
    saleGst: number;
    saleReturnAmount: number;
    invoicesSet: Set<string>;
    purchaseQtyBase: number;
    purchaseQtyLoose: number;
    totalPurchaseQtyPieces: number;
    purchaseAmount: number;
    purchaseBillsSet: Set<string>;
    salesTransactions: PartyReportSalesTransaction[];
    purchaseTransactions: PartyReportPurchaseTransaction[];
    partySalesMap: Map<string, { partyId: string; partyName: string; partyType: 'Retailer' | 'Supplier' | 'Customer'; saleQty: number; saleAmount: number; invoiceCount: number }>;
    partyPurchaseMap: Map<string, { partyId: string; partyName: string; purchaseQty: number; purchaseAmount: number; billCount: number }>;
  }

  const productAccumulators = new Map<string, ProductAccumulator>();

  candidateProducts.forEach(prod => {
    productAccumulators.set(prod.id, {
      product: prod,
      saleQtyBase: 0,
      saleQtyLoose: 0,
      totalSaleQtyPieces: 0,
      grossSaleAmount: 0,
      saleDiscount: 0,
      saleGst: 0,
      saleReturnAmount: 0,
      invoicesSet: new Set(),
      purchaseQtyBase: 0,
      purchaseQtyLoose: 0,
      totalPurchaseQtyPieces: 0,
      purchaseAmount: 0,
      purchaseBillsSet: new Set(),
      salesTransactions: [],
      purchaseTransactions: [],
      partySalesMap: new Map(),
      partyPurchaseMap: new Map()
    });
  });

  // 1. Process Sales Invoices
  (db.invoices || []).forEach(inv => {
    if (f.companyId && f.companyId !== 'all') {
      const biz = inv.business_id || inv.company_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }

    if (inv.status === 'Cancelled' || inv.invoice_status === 'Cancelled') return;
    if (!isDateInRange(inv.date || inv.created_at || '', dateRange)) return;
    if (isPartyFiltered && !isPartyMatchingInvoice(inv.retailer_id, selectedPartyId, db.retailers)) return;

    const srcOrderId = (inv.source_order_ids && inv.source_order_ids[0]) || inv.order_ref_id;
    const srcOrder = srcOrderId ? orderMap.get(srcOrderId) : undefined;

    const spId = srcOrder ? getOrderSalespersonId(srcOrder, db) : getInvoiceSalespersonId(inv, db);
    const spProfile = spId ? db.profiles.find(p => p.id === spId) : undefined;
    const spName = spProfile?.full_name || spProfile?.name || getInvoiceSalespersonName(inv, db);

    if (f.salespersonId && f.salespersonId !== 'all') {
      const matchSp = (spId && spId === f.salespersonId) || 
                      (spName && spName.toLowerCase().includes(f.salespersonId.toLowerCase()));
      if (!matchSp) return;
    }

    let orderChannel = 'Distributor Salesperson';
    const rawChan = (srcOrder?.channel || srcOrder?.source || (inv as any).channel || '').toLowerCase();
    if (rawChan.includes('direct') || rawChan.includes('retailer direct')) {
      orderChannel = 'Retailer Direct';
    } else if (rawChan.includes('company')) {
      orderChannel = 'Company Salesperson';
    } else if (rawChan.includes('counter')) {
      orderChannel = 'On Counter Sale';
    } else {
      orderChannel = 'Distributor Salesperson';
    }

    if (f.channel && f.channel !== 'all' && orderChannel !== f.channel) return;

    const invGodown = srcOrder?.dispatch_godown || inv.place_of_supply || 'Main Godown';
    if (f.godown && f.godown !== 'all') {
      if (!isGodownMatch(invGodown, f.godown, db.godowns)) return;
    }

    const retailer = retailerMap.get(inv.retailer_id);
    const partyName = retailer?.shop_name || retailer?.owner_name || inv.retailer_id || 'Retailer';

    (inv.items || []).forEach((item, itemIdx) => {
      const accum = productAccumulators.get(item.product_id);
      if (!accum) return;

      const prod = accum.product;
      const unitsPerPack = item.units_per_box_carton || item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const basePieces = item.base_qty !== undefined ? item.base_qty : (item.quantity !== undefined ? item.quantity : 0);
      const cQty = item.carton_qty !== undefined ? item.carton_qty : (unitsPerPack > 1 ? Math.floor(basePieces / unitsPerPack) : basePieces);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (unitsPerPack > 1 ? (basePieces % unitsPerPack) : 0);

      const unitRate = item.carton_rate || item.rate || item.unit_rate || prod?.selling_price || 0;
      const flatDiscount = (item.discount || 0) + (item.carton_discount || 0);
      const effectiveRate = Math.max(0, unitRate - flatDiscount);
      const effectiveCartons = unitsPerPack > 1 ? (cQty + (lQty / unitsPerPack)) : (cQty > 0 ? cQty : basePieces);
      const lineTaxable = item.taxable_value !== undefined ? item.taxable_value : Math.round(effectiveCartons * effectiveRate * 100) / 100;
      const itemGstPct = (item.gst_percent !== undefined && item.gst_percent !== null)
        ? Number(item.gst_percent)
        : ((prod?.gst_percent !== undefined && prod?.gst_percent !== null) ? Number(prod.gst_percent) : 0);
      const lineGst = ((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)) || Math.round(lineTaxable * (itemGstPct / 100) * 100) / 100;
      const lineTotal = item.total_amount !== undefined ? item.total_amount : Math.round((lineTaxable + lineGst) * 100) / 100;

      accum.saleQtyBase += cQty;
      accum.saleQtyLoose += lQty;
      accum.totalSaleQtyPieces += basePieces;
      accum.grossSaleAmount += lineTaxable;
      accum.saleDiscount += (flatDiscount * effectiveCartons);
      accum.saleGst += lineGst;
      accum.invoicesSet.add(inv.id);

      const pKey = inv.retailer_id || partyName;
      let partyEntry = accum.partySalesMap.get(pKey);
      if (!partyEntry) {
        partyEntry = {
          partyId: inv.retailer_id,
          partyName,
          partyType: 'Retailer',
          saleQty: 0,
          saleAmount: 0,
          invoiceCount: 0
        };
        accum.partySalesMap.set(pKey, partyEntry);
      }
      partyEntry.saleQty += basePieces;
      partyEntry.saleAmount += lineTaxable;
      partyEntry.invoiceCount += 1;

      accum.salesTransactions.push({
        id: item.id || `inv-item-${inv.id}-${itemIdx}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        orderNumber: srcOrder?.order_number || inv.order_ref_id,
        orderId: srcOrder?.id,
        date: inv.date || inv.created_at || '',
        retailerId: inv.retailer_id,
        retailerName: partyName,
        partyName,
        productId: item.product_id,
        productName: item.product_name || prod?.name || 'FMCG Product',
        brand: prod?.brand,
        variant: prod?.pack_size || item.packing || (unitsPerPack > 1 ? `${unitsPerPack} pcs/box` : '1 pc'),
        packSize: prod?.pack_size || item.packing || 'Standard',
        tradingUnit: item.trading_unit || prod?.trading_unit || 'Box',
        quantity: basePieces,
        cartonQty: cQty,
        looseQty: lQty,
        rate: effectiveRate,
        discount: flatDiscount,
        taxableValue: lineTaxable,
        gstPercent: itemGstPct,
        gstAmount: lineGst,
        finalAmount: lineTaxable,
        paymentMode: inv.payment_mode || 'Credit',
        salesperson: spName,
        channel: orderChannel,
        godown: invGodown,
        status: inv.status || 'Finalized'
      });
    });
  });

  // 2. Process Sales Returns
  (db.salesReturns || []).forEach(sr => {
    if (f.companyId && f.companyId !== 'all') {
      const biz = sr.business_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }

    if (sr.status === 'Cancelled') return;
    if (!isDateInRange(sr.return_date, dateRange)) return;
    if (isPartyFiltered && !isPartyMatchingInvoice(sr.retailer_id || '', selectedPartyId, db.retailers)) return;

    (sr.items || []).forEach(srItem => {
      const accum = productAccumulators.get(srItem.product_id);
      if (!accum) return;
      const returnTaxable = (srItem as any).taxable_value !== undefined ? (srItem as any).taxable_value : (srItem.total_amount || 0);
      accum.saleReturnAmount += returnTaxable;
    });
  });

  // 3. Process Purchases
  (db.purchases || []).forEach(pur => {
    if (f.companyId && f.companyId !== 'all') {
      const biz = pur.business_id || 'biz-saifee';
      if (biz !== f.companyId) return;
    }

    if (pur.status === 'Draft' || (pur.status as string) === 'Cancelled') return;
    if (!isDateInRange(pur.invoice_date || pur.created_at || '', dateRange)) return;
    if (isPartyFiltered && !isPartyMatchingPurchase(pur.supplier_id, selectedPartyId, db.suppliers)) return;

    const purGodown = pur.receiving_godown_id || 'Main Godown';
    if (f.godown && f.godown !== 'all') {
      if (!isGodownMatch(purGodown, f.godown, db.godowns)) return;
    }

    const supplier = supplierMap.get(pur.supplier_id);
    const supplierName = supplier?.name || pur.supplier_id || 'Supplier';

    (pur.items || []).forEach((pItem, pIdx) => {
      const accum = productAccumulators.get(pItem.product_id);
      if (!accum) return;

      const prod = accum.product;
      const unitsPerPack = pItem.units_per_box_carton || pItem.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const basePieces = pItem.base_qty !== undefined ? pItem.base_qty : (pItem.quantity !== undefined ? pItem.quantity : 0);
      const cQty = pItem.carton_qty !== undefined ? pItem.carton_qty : (unitsPerPack > 1 ? Math.floor(basePieces / unitsPerPack) : basePieces);
      const lQty = pItem.loose_qty !== undefined ? pItem.loose_qty : (unitsPerPack > 1 ? (basePieces % unitsPerPack) : 0);
      const purchaseRate = pItem.purchase_rate || pItem.carton_rate || prod?.purchase_price || 0;
      const effectiveCartons = unitsPerPack > 1 ? (cQty + (lQty / unitsPerPack)) : (cQty > 0 ? cQty : basePieces);
      const lineCost = (pItem as any).taxable_value !== undefined ? (pItem as any).taxable_value : Math.round(effectiveCartons * purchaseRate * 100) / 100;
      const gstPct = pItem.gst_percent !== undefined ? pItem.gst_percent : (prod?.gst_percent !== undefined ? prod.gst_percent : 0);
      const lineGst = ((pItem as any).cgst || 0) + ((pItem as any).sgst || 0) + ((pItem as any).igst || 0) || Math.round(lineCost * (gstPct / 100) * 100) / 100;
      const lineTotal = (pItem as any).total_amount !== undefined ? (pItem as any).total_amount : Math.round((lineCost + lineGst) * 100) / 100;

      accum.purchaseQtyBase += cQty;
      accum.purchaseQtyLoose += lQty;
      accum.totalPurchaseQtyPieces += basePieces;
      accum.purchaseAmount += lineCost;
      accum.purchaseBillsSet.add(pur.id);

      const sKey = pur.supplier_id || supplierName;
      let partyEntry = accum.partyPurchaseMap.get(sKey);
      if (!partyEntry) {
        partyEntry = {
          partyId: pur.supplier_id,
          partyName: supplierName,
          purchaseQty: 0,
          purchaseAmount: 0,
          billCount: 0
        };
        accum.partyPurchaseMap.set(sKey, partyEntry);
      }
      partyEntry.purchaseQty += basePieces;
      partyEntry.purchaseAmount += lineCost;
      partyEntry.billCount += 1;

      accum.purchaseTransactions.push({
        id: pItem.id || `pur-item-${pur.id}-${pIdx}`,
        purchaseId: pur.id,
        purchaseNumber: pur.invoice_number,
        date: pur.invoice_date || pur.created_at || '',
        supplierId: pur.supplier_id,
        supplierName,
        partyName: supplierName,
        productId: pItem.product_id,
        productName: prod?.name || 'FMCG Product',
        brand: prod?.brand,
        variant: prod?.pack_size || (unitsPerPack > 1 ? `${unitsPerPack} pcs/box` : '1 pc'),
        packSize: prod?.pack_size || 'Standard',
        tradingUnit: pItem.trading_unit || prod?.trading_unit || 'Box',
        quantity: basePieces,
        cartonQty: cQty,
        looseQty: lQty,
        purchaseRate,
        discount: pItem.discount || 0,
        gstPercent: pItem.gst_percent !== undefined ? pItem.gst_percent : (prod?.gst_percent !== undefined ? prod.gst_percent : 0),
        gstAmount: lineGst,
        purchaseAmount: lineCost,
        godown: purGodown,
        status: pur.status || 'Confirmed'
      });
    });
  });

  // 4. Construct Item Rows with Godown Physical Inventory
  const allGodowns = (db.godowns && db.godowns.length > 0) ? db.godowns : [
    { id: 'gdn-saifee-main', name: 'Main Godown', code: 'GD01' },
    { id: 'gdn-saifee-secondary', name: 'Secondary Godown', code: 'GD02' }
  ];

  let rows: ItemReportByPartyRow[] = [];
  let rowIdx = 1;

  productAccumulators.forEach((accum) => {
    const prod = accum.product;
    const comp = companyMap.get(prod.company_id);
    const unitsPerPack = prod.units_per_box_carton || prod.units_per_trading_unit || 1;
    const tradingUnit = prod.trading_unit || 'Box';
    const baseUnit = prod.base_unit || 'Piece';

    // Closing Inventory (Current Physical Godown Stock)
    let rawInvRows = (db.inventory || []).filter(i => i.product_id === prod.id);
    if (f.companyId && f.companyId !== 'all') {
      rawInvRows = rawInvRows.filter(i => (i.business_id || 'biz-saifee') === f.companyId);
    }

    let totPhysicalPieces = 0;
    let totReservedPieces = 0;
    let totAvailablePieces = 0;
    let totDamagedPieces = 0;
    let totExpiredPieces = 0;
    let totPendingPieces = 0;

    const godownBreakdown: ItemReportByPartyRow['godownStockBreakdown'] = [];

    // Discover all unique godowns from both configured godowns and inventory records
    const godownList: { id: string; name: string; code: string }[] = [];
    const seenGodowns = new Set<string>();

    (allGodowns as any[]).forEach((g: any) => {
      const gKey = g.id || g.name;
      if (!seenGodowns.has(gKey)) {
        seenGodowns.add(gKey);
        godownList.push({ id: g.id, name: g.name, code: g.code || g.id });
      }
    });

    rawInvRows.forEach(r => {
      if (r.godown_id && !seenGodowns.has(r.godown_id)) {
        seenGodowns.add(r.godown_id);
        const gName = (r as any).godown_name || r.godown_id;
        godownList.push({ id: r.godown_id, name: gName, code: r.godown_id });
      }
    });

    godownList.forEach(g => {
      const gInv = rawInvRows.find(r => r.godown_id === g.id || r.godown_id === g.name || r.godown_id === g.code);
      let p = gInv ? (gInv.physical_qty !== undefined ? gInv.physical_qty : ((gInv as any).quantity || 0)) : 0;
      let r = gInv?.reserved_qty || 0;
      let a = gInv ? (gInv.available_qty !== undefined ? gInv.available_qty : Math.max(0, p - r)) : 0;
      let d = gInv?.damaged_qty || 0;
      let e = gInv?.expired_qty || 0;

      if (!gInv) {
        const gBatches = (db.batches || []).filter(b => 
          b.product_id === prod.id && 
          (b.godown_id === g.id || b.godown?.toLowerCase().includes(g.name.toLowerCase()))
        );
        if (gBatches.length > 0) {
          p = gBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
          a = p;
        }
      }

      godownBreakdown.push({
        godownId: g.id,
        godownName: g.name,
        physical: p,
        reserved: r,
        available: a,
        damaged: d,
        expired: e
      });

      if (f.godown && f.godown !== 'all') {
        const isMatch = isGodownMatch(g.id, f.godown, db.godowns) || isGodownMatch(g.name, f.godown, db.godowns) || isGodownMatch(g.code, f.godown, db.godowns);
        if (isMatch) {
          totPhysicalPieces += p;
          totReservedPieces += r;
          totAvailablePieces += a;
          totDamagedPieces += d;
          totExpiredPieces += e;
        }
      } else {
        totPhysicalPieces += p;
        totReservedPieces += r;
        totAvailablePieces += a;
        totDamagedPieces += d;
        totExpiredPieces += e;
      }
    });

    const closingInvBase = unitsPerPack > 1 ? Math.floor(totPhysicalPieces / unitsPerPack) : totPhysicalPieces;
    const closingInvLoose = unitsPerPack > 1 ? (totPhysicalPieces % unitsPerPack) : 0;
    const closingInvDisplay = formatUnitQuantity(closingInvBase, closingInvLoose, tradingUnit, baseUnit, unitsPerPack);

    const netSaleAmount = Math.max(0, accum.grossSaleAmount - accum.saleReturnAmount);
    const avgSaleRate = accum.saleQtyBase > 0 ? Math.round((netSaleAmount / accum.saleQtyBase) * 100) / 100 : 0;
    const avgPurchaseRate = accum.purchaseQtyBase > 0 ? Math.round((accum.purchaseAmount / accum.purchaseQtyBase) * 100) / 100 : 0;

    const partySalesBreakdown = Array.from(accum.partySalesMap.values()).map(p => ({
      ...p,
      saleQtyDisplay: formatUnitQuantity(
        unitsPerPack > 1 ? Math.floor(p.saleQty / unitsPerPack) : p.saleQty,
        unitsPerPack > 1 ? (p.saleQty % unitsPerPack) : 0,
        tradingUnit, baseUnit, unitsPerPack
      )
    }));

    const partyPurchaseBreakdown = Array.from(accum.partyPurchaseMap.values()).map(p => ({
      ...p,
      purchaseQtyDisplay: formatUnitQuantity(
        unitsPerPack > 1 ? Math.floor(p.purchaseQty / unitsPerPack) : p.purchaseQty,
        unitsPerPack > 1 ? (p.purchaseQty % unitsPerPack) : 0,
        tradingUnit, baseUnit, unitsPerPack
      )
    }));

    const hasPartyActivity = accum.grossSaleAmount > 0 || accum.purchaseAmount > 0;
    const hasGeneralActivity = accum.grossSaleAmount > 0 || accum.purchaseAmount > 0 || totPhysicalPieces > 0;

    if (isPartyFiltered) {
      if (!hasPartyActivity && !f.productId) {
        return;
      }
    } else {
      if (!hasGeneralActivity && !f.productId && !f.category && !f.companyId && !f.brand) {
        return;
      }
    }

    rows.push({
      id: prod.id,
      productId: prod.id,
      variantId: prod.parent_product_id,
      srNo: rowIdx++,
      productName: prod.name,
      productCode: prod.product_code,
      sku: prod.sku || prod.product_code || `SKU-${prod.id}`,
      barcode: prod.barcode,
      brand: prod.brand,
      category: prod.category,
      packSize: prod.pack_size || prod.packing_display || 'Standard',
      variantPacking: prod.pack_size || prod.packing_display || 'Standard',
      tradingUnit,
      baseUnit,
      unitsPerPack,
      companyId: prod.company_id,
      companyName: comp?.name || 'Company',
      mrp: prod.mrp,
      sellingPrice: prod.selling_price,
      purchasePrice: prod.purchase_price,
      gstPercent: (prod.gst_percent !== undefined && prod.gst_percent !== null) ? Number(prod.gst_percent) : 0,
      hsn: prod.hsn || '',

      saleQtyBase: accum.saleQtyBase,
      saleQtyLoose: accum.saleQtyLoose,
      saleQtyDisplay: formatUnitQuantity(accum.saleQtyBase, accum.saleQtyLoose, tradingUnit, baseUnit, unitsPerPack),
      totalSaleQtyPieces: accum.totalSaleQtyPieces,
      grossSaleAmount: Math.round(accum.grossSaleAmount * 100) / 100,
      saleDiscount: Math.round(accum.saleDiscount * 100) / 100,
      saleGst: Math.round(accum.saleGst * 100) / 100,
      saleReturnAmount: Math.round(accum.saleReturnAmount * 100) / 100,
      saleAmount: Math.round(netSaleAmount * 100) / 100,
      invoicesCount: accum.invoicesSet.size,
      avgSaleRate,

      purchaseQtyBase: accum.purchaseQtyBase,
      purchaseQtyLoose: accum.purchaseQtyLoose,
      purchaseQtyDisplay: formatUnitQuantity(accum.purchaseQtyBase, accum.purchaseQtyLoose, tradingUnit, baseUnit, unitsPerPack),
      totalPurchaseQtyPieces: accum.totalPurchaseQtyPieces,
      purchaseAmount: Math.round(accum.purchaseAmount * 100) / 100,
      purchaseBillsCount: accum.purchaseBillsSet.size,
      avgPurchaseRate,

      closingInventoryBase: closingInvBase,
      closingInventoryLoose: closingInvLoose,
      closingInventoryDisplay: closingInvDisplay,
      totalClosingPhysicalPieces: totPhysicalPieces,

      physicalStockPieces: totPhysicalPieces,
      physicalStockDisplay: closingInvDisplay,
      reservedStockPieces: totReservedPieces,
      reservedStockDisplay: formatUnitQuantity(totReservedPieces, 0, tradingUnit, baseUnit, unitsPerPack),
      availableStockPieces: totAvailablePieces,
      availableStockDisplay: formatUnitQuantity(totAvailablePieces, 0, tradingUnit, baseUnit, unitsPerPack),
      damagedStockPieces: totDamagedPieces,
      damagedStockDisplay: formatUnitQuantity(totDamagedPieces, 0, tradingUnit, baseUnit, unitsPerPack),
      expiredStockPieces: totExpiredPieces,
      expiredStockDisplay: formatUnitQuantity(totExpiredPieces, 0, tradingUnit, baseUnit, unitsPerPack),
      pendingStockPieces: totPendingPieces,
      pendingStockDisplay: formatUnitQuantity(totPendingPieces, 0, tradingUnit, baseUnit, unitsPerPack),

      godownStockBreakdown: godownBreakdown,
      partySalesBreakdown,
      partyPurchaseBreakdown,
      salesTransactions: accum.salesTransactions,
      purchaseTransactions: accum.purchaseTransactions,
      stockMovements: (db.ledger || []).filter(l => l.product_id === prod.id)
    });
  });

  // 5. Search Filter
  if (f.searchQuery && f.searchQuery.trim()) {
    const q = f.searchQuery.trim().toLowerCase();
    rows = rows.filter(r => 
      r.productName.toLowerCase().includes(q) ||
      (r.sku && r.sku.toLowerCase().includes(q)) ||
      (r.brand && r.brand.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      r.salesTransactions.some(t => t.retailerName.toLowerCase().includes(q) || t.invoiceNumber.toLowerCase().includes(q)) ||
      r.purchaseTransactions.some(t => t.supplierName.toLowerCase().includes(q) || t.purchaseNumber.toLowerCase().includes(q))
    );
    rows = rows.map((r, i) => ({ ...r, srNo: i + 1 }));
  }

  // 6. Aggregate Summary Totals
  let totalSalePieces = 0;
  let totalSaleBase = 0;
  let totalSaleLoose = 0;
  let totalGrossSaleAmt = 0;
  let totalDiscount = 0;
  let totalGst = 0;
  let totalReturnAmt = 0;
  let totalNetSaleAmt = 0;
  let totalPurchasePieces = 0;
  let totalPurchaseBase = 0;
  let totalPurchaseLoose = 0;
  let totalPurchaseAmt = 0;
  let totalClosingPhysical = 0;

  const unitWiseTotals: { [unit: string]: number } = {};
  const distinctTradingUnits = new Set<string>();

  rows.forEach(r => {
    totalSalePieces += r.totalSaleQtyPieces;
    totalSaleBase += r.saleQtyBase;
    totalSaleLoose += r.saleQtyLoose;
    totalGrossSaleAmt += r.grossSaleAmount;
    totalDiscount += r.saleDiscount;
    totalGst += r.saleGst;
    totalReturnAmt += r.saleReturnAmount;
    totalNetSaleAmt += r.saleAmount;
    totalPurchasePieces += r.totalPurchaseQtyPieces;
    totalPurchaseBase += r.purchaseQtyBase;
    totalPurchaseLoose += r.purchaseQtyLoose;
    totalPurchaseAmt += r.purchaseAmount;
    totalClosingPhysical += r.totalClosingPhysicalPieces;

    const unit = r.tradingUnit || 'Box';
    distinctTradingUnits.add(unit);
    unitWiseTotals[unit] = (unitWiseTotals[unit] || 0) + r.closingInventoryBase;
  });

  const isSingleUnitType = distinctTradingUnits.size === 1;
  const commonTradingUnit = isSingleUnitType ? Array.from(distinctTradingUnits)[0] : undefined;

  let totalClosingDisplay = 'Multiple Units';
  if (isSingleUnitType && commonTradingUnit) {
    totalClosingDisplay = formatUnitQuantity(unitWiseTotals[commonTradingUnit], 0, commonTradingUnit, 'Piece', 1);
  } else if (rows.length === 0) {
    totalClosingDisplay = '0 Boxes';
  } else {
    const unitSummaryParts = Object.entries(unitWiseTotals)
      .filter(([_, count]) => count > 0)
      .map(([unit, count]) => `${count} ${unit.toLowerCase() === 'box' ? 'Boxes' : (unit.endsWith('s') ? unit : `${unit}s`)}`);
    totalClosingDisplay = unitSummaryParts.length > 0 ? unitSummaryParts.join(', ') : 'Multiple Units';
  }

  const summary: ItemReportByPartySummary = {
    recordCount: rows.length,
    totalSaleQtyPieces: totalSalePieces,
    totalSaleQtyBase: totalSaleBase,
    totalSaleQtyLoose: totalSaleLoose,
    totalGrossSaleAmount: Math.round(totalGrossSaleAmt * 100) / 100,
    totalSaleDiscount: Math.round(totalDiscount * 100) / 100,
    totalSaleGst: Math.round(totalGst * 100) / 100,
    totalSaleReturnAmount: Math.round(totalReturnAmt * 100) / 100,
    totalSaleAmount: Math.round(totalNetSaleAmt * 100) / 100,
    totalPurchaseQtyPieces: totalPurchasePieces,
    totalPurchaseQtyBase: totalPurchaseBase,
    totalPurchaseQtyLoose: totalPurchaseLoose,
    totalPurchaseAmount: Math.round(totalPurchaseAmt * 100) / 100,
    totalClosingPhysicalPieces: totalClosingPhysical,
    totalClosingDisplay,
    isSingleUnitType,
    commonTradingUnit,
    unitWiseTotals
  };

  return { rows, summary };
}




