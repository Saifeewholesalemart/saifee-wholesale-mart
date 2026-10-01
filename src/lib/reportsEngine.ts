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
            const gst = returnSub * ((prod?.gst_percent || 18) / 100);
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

  return db.purchases
    .filter(p => isDateInRange(p.invoice_date, dateRange))
    .map(p => {
      const supp = db.suppliers.find(s => s.id === p.supplier_id);
      let totalQty = 0;
      let totalDiscount = 0;
      let purchaseValue = 0;
      let totalGst = 0;

      const matchingItems = (p.items || []).filter(i => {
        const prod = db.products.find(pr => pr.id === i.product_id);
        if (!prod) return false;
        if (f.companyId && prod.company_id !== f.companyId) return false;
        if (f.category && prod.category !== f.category) return false;
        if (f.productId && prod.id !== f.productId) return false;
        return true;
      });

      if ((f.companyId || f.category || f.productId) && matchingItems.length === 0) {
        return null;
      }

      const itemsToCount = (f.companyId || f.category || f.productId) ? matchingItems : (p.items || []);

      itemsToCount.forEach(i => {
        const prod = db.products.find(pr => pr.id === i.product_id);
        const unitsPerPack = i.units_per_box_carton || i.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const cQty = i.carton_qty !== undefined ? i.carton_qty : Math.floor(i.quantity / unitsPerPack);
        const lQty = i.loose_qty !== undefined ? i.loose_qty : (i.quantity % unitsPerPack);
        const effectiveCartons = cQty + (lQty / unitsPerPack);
        const freeCartons = i.free_quantity ? Number((i.free_quantity / unitsPerPack).toFixed(2)) : 0;

        totalQty += Number((effectiveCartons + freeCartons).toFixed(2));
        const lineDiscount = (i.discount || 0) * effectiveCartons;
        totalDiscount += lineDiscount;
        const lineVal = Math.max(0, (i.purchase_rate * effectiveCartons) - lineDiscount);
        purchaseValue += lineVal;
        totalGst += lineVal * ((i.gst_percent || 0) / 100);
      });

      return {
        purchaseId: p.id,
        purchaseDate: p.invoice_date,
        supplierName: supp?.name || 'Supplier',
        invoiceNumber: p.invoice_number,
        itemCount: itemsToCount.length,
        totalQuantity: totalQty,
        purchaseValue: Math.round(purchaseValue),
        discount: Math.round(totalDiscount),
        gst: Math.round(totalGst),
        totalPurchaseAmount: Math.round(purchaseValue + totalGst),
        godown: 'Main Godown',
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

  const rows: PurchaseRateHistoryRow[] = [];

  db.purchases.forEach(p => {
    if (!isDateInRange(p.invoice_date, dateRange)) return;
    const supp = db.suppliers.find(s => s.id === p.supplier_id);

    p.items?.forEach(item => {
      const prod = db.products.find(pr => pr.id === item.product_id);
      if (!prod) return;
      if (f.companyId && prod.company_id !== f.companyId) return;
      if (f.category && prod.category !== f.category) return;
      if (f.productId && prod.id !== f.productId) return;

      const unitsPerPack = item.units_per_box_carton || item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const cartonQty = Number((cQty + (lQty / unitsPerPack)).toFixed(2));
      const landedCost = item.purchase_rate + (item.purchase_rate * (item.gst_percent / 100));

      rows.push({
        productId: prod.id,
        productName: prod.name,
        category: prod.category || 'General',
        variantPacking: prod.pack_size,
        tradingUnit: formatTradingUnit(prod.trading_unit),
        purchaseDate: p.invoice_date,
        supplierName: supp?.name || 'Supplier',
        invoiceNumber: p.invoice_number,
        batchNumber: item.batch || '—',
        expiryDate: item.expiry_date || '—',
        quantity: cartonQty,
        purchaseRate: item.purchase_rate,
        landedCost: Number(landedCost.toFixed(2)),
        godown: 'Main Godown'
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
// PARTY REPORT BY ITEM (SALES & PURCHASES PER PARTY)
// ----------------------------------------------------

export interface PartyReportItem {
  id: string;
  srNo: number;
  partyName: string;
  partyType: 'SUPPLIER' | 'RETAILER' | 'BOTH';
  saleQtyBase: number;
  saleQtyLoose: number;
  saleAmount: number;
  purchaseQtyBase: number;
  purchaseQtyLoose: number;
  purchaseAmount: number;
}

export interface PartyReportItemRow {
  id: string;
  srNo: number;
  partyName: string;
  partyType: 'Customer' | 'Supplier' | 'Both';
  saleQtyBase: number;
  saleQtyLoose: number;
  saleQtyDisplay: string;
  saleAmount: number;
  purchaseQtyBase: number;
  purchaseQtyLoose: number;
  purchaseQtyDisplay: string;
  purchaseAmount: number;
}

export interface PartyItemReportSummary {
  totalSaleQtyBase: number;
  totalSaleQtyLoose: number;
  totalSaleAmount: number;
  totalPurchaseQtyBase: number;
  totalPurchaseQtyLoose: number;
  totalPurchaseAmount: number;
  recordCount: number;
}

export function formatQuantity(base: number, loose: number): string {
  if (base === 0 && loose === 0) return '0';
  if (loose > 0) return `${base} + ${loose}`;
  return `${base}`;
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

export function getPartyItemReport(
  filters: ReportFilterState,
  db: DbState,
  userContext: UserContext
): { rows: PartyReportItemRow[]; summary: PartyItemReportSummary } {
  const f = applyRbacFilters(filters, userContext);
  const dateRange = getDateRangeFromPreset(f.datePreset, f.customStartDate, f.customEndDate);

  const partyMap = new Map<string, {
    partyName: string;
    partyType: 'Customer' | 'Supplier' | 'Both';
    saleQtyBase: number;
    saleQtyLoose: number;
    saleAmount: number;
    purchaseQtyBase: number;
    purchaseQtyLoose: number;
    purchaseAmount: number;
  }>();

  // 1. Initialize all registered Retailers (Customers)
  (db.retailers || []).forEach(r => {
    if (r.active === false) return;
    const partyName = r.shop_name 
      ? `${r.shop_name}${r.owner_name ? ` (${r.owner_name})` : ''}`
      : r.owner_name || r.retailer_code || 'Retailer';

    partyMap.set(r.id, {
      partyName,
      partyType: 'Customer',
      saleQtyBase: 0,
      saleQtyLoose: 0,
      saleAmount: 0,
      purchaseQtyBase: 0,
      purchaseQtyLoose: 0,
      purchaseAmount: 0
    });
  });

  // 2. Initialize all registered Suppliers (Vendors)
  (db.suppliers || []).forEach(s => {
    if (s.active === false) return;
    const existing = partyMap.get(s.id);
    if (existing) {
      existing.partyType = 'Both';
    } else {
      partyMap.set(s.id, {
        partyName: s.name,
        partyType: 'Supplier',
        saleQtyBase: 0,
        saleQtyLoose: 0,
        saleAmount: 0,
        purchaseQtyBase: 0,
        purchaseQtyLoose: 0,
        purchaseAmount: 0
      });
    }
  });

  // 3. Process Sales from Invoices
  const invoicedOrderIds = new Set<string>();
  (db.invoices || []).forEach(inv => {
    if (inv.order_ref_id) invoicedOrderIds.add(inv.order_ref_id);
    inv.source_order_ids?.forEach(id => invoicedOrderIds.add(id));
    if (!isInvoiceMatchingReportFilters(inv, f, db, dateRange)) return;

    const retailer = db.retailers.find(r => r.id === inv.retailer_id);
    const partyId = retailer?.id || inv.retailer_id || `retailer-${inv.invoice_number}`;
    const partyName = retailer?.shop_name 
      ? `${retailer.shop_name}${retailer.owner_name ? ` (${retailer.owner_name})` : ''}`
      : retailer?.owner_name || retailer?.retailer_code || 'Customer';

    inv.items?.forEach(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (f.companyId && prod && prod.company_id !== f.companyId) return;
      if (f.category && prod && prod.category !== f.category) return;
      if (f.brand && prod && prod.brand !== f.brand) return;
      if (f.productId && prod && prod.id !== f.productId) return;
      if (f.variantPacking && prod && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor(item.quantity / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : (item.quantity % unitsPerPack);
      const lineTotal = item.total_amount !== undefined 
        ? item.total_amount 
        : (item.quantity * (item.rate || 0));

      const existing = partyMap.get(partyId) || {
        partyName,
        partyType: 'Customer',
        saleQtyBase: 0,
        saleQtyLoose: 0,
        saleAmount: 0,
        purchaseQtyBase: 0,
        purchaseQtyLoose: 0,
        purchaseAmount: 0
      };

      existing.saleQtyBase += cQty;
      existing.saleQtyLoose += lQty;
      existing.saleAmount += lineTotal;
      partyMap.set(partyId, existing);
    });
  });

  // 4. Process Sales from Completed Orders (not separately invoiced)
  (db.orders || []).forEach(ord => {
    if (invoicedOrderIds.has(ord.id)) return;
    if (ord.status !== 'Completed' && ord.status !== 'Delivered' && ord.status !== 'Fully Fulfilled') return;
    if (!isDateInRange(ord.order_date || ord.created_at || '', dateRange)) return;

    const retailer = db.retailers.find(r => r.id === ord.retailer_id);
    const partyId = retailer?.id || ord.retailer_id || `retailer-${ord.order_number}`;
    const partyName = retailer?.shop_name 
      ? `${retailer.shop_name}${retailer.owner_name ? ` (${retailer.owner_name})` : ''}`
      : retailer?.owner_name || retailer?.retailer_code || 'Customer';

    ord.items?.forEach(item => {
      const prod = db.products.find(p => p.id === item.product_id);
      if (f.companyId && prod && prod.company_id !== f.companyId) return;
      if (f.category && prod && prod.category !== f.category) return;
      if (f.brand && prod && prod.brand !== f.brand) return;
      if (f.productId && prod && prod.id !== f.productId) return;
      if (f.variantPacking && prod && prod.pack_size !== f.variantPacking) return;

      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = item.carton_qty !== undefined ? item.carton_qty : Math.floor((item.delivered_qty || item.quantity) / unitsPerPack);
      const lQty = item.loose_qty !== undefined ? item.loose_qty : ((item.delivered_qty || item.quantity) % unitsPerPack);
      const lineTotal = item.total_amount !== undefined 
        ? item.total_amount 
        : ((item.delivered_qty || item.quantity) * (item.carton_rate || item.rate || 0));

      const existing = partyMap.get(partyId) || {
        partyName,
        partyType: 'Customer',
        saleQtyBase: 0,
        saleQtyLoose: 0,
        saleAmount: 0,
        purchaseQtyBase: 0,
        purchaseQtyLoose: 0,
        purchaseAmount: 0
      };

      existing.saleQtyBase += cQty;
      existing.saleQtyLoose += lQty;
      existing.saleAmount += lineTotal;
      partyMap.set(partyId, existing);
    });
  });

  // 5. Process Purchases from Purchases Master
  (db.purchases || []).forEach(pur => {
    if (!isDateInRange(pur.invoice_date || pur.created_at || '', dateRange)) return;

    const supplier = db.suppliers.find(s => s.id === pur.supplier_id);
    const partyId = supplier?.id || pur.supplier_id || `supplier-${pur.id}`;
    const partyName = supplier?.name || 'Supplier';

    const pItems = pur.items && pur.items.length > 0 ? pur.items : [];

    pItems.forEach(pItem => {
      const prod = db.products.find(p => p.id === pItem.product_id);
      if (f.companyId && prod && prod.company_id !== f.companyId) return;
      if (f.category && prod && prod.category !== f.category) return;
      if (f.brand && prod && prod.brand !== f.brand) return;
      if (f.productId && prod && prod.id !== f.productId) return;

      const unitsPerPack = pItem.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const cQty = pItem.carton_qty !== undefined ? pItem.carton_qty : Math.floor(pItem.quantity / unitsPerPack);
      const lQty = pItem.loose_qty !== undefined ? pItem.loose_qty : (pItem.quantity % unitsPerPack);
      const lineCost = (pItem.quantity * (pItem.purchase_rate || pItem.carton_rate || 0)) || (pur.total_amount || 0);

      const existing = partyMap.get(partyId) || {
        partyName,
        partyType: 'Supplier',
        saleQtyBase: 0,
        saleQtyLoose: 0,
        saleAmount: 0,
        purchaseQtyBase: 0,
        purchaseQtyLoose: 0,
        purchaseAmount: 0
      };

      if (existing.saleAmount > 0) {
        existing.partyType = 'Both';
      }
      existing.purchaseQtyBase += cQty;
      existing.purchaseQtyLoose += lQty;
      existing.purchaseAmount += lineCost;
      partyMap.set(partyId, existing);
    });
  });

  // 6. Convert to formatted rows
  let rows: PartyReportItemRow[] = [];
  let idx = 1;

  partyMap.forEach((val, id) => {
    const finalSaleBase = val.saleQtyBase + Math.floor(val.saleQtyLoose / 24);
    const finalSaleLoose = val.saleQtyLoose % 24;
    const finalPurchaseBase = val.purchaseQtyBase + Math.floor(val.purchaseQtyLoose / 24);
    const finalPurchaseLoose = val.purchaseQtyLoose % 24;

    rows.push({
      id,
      srNo: idx++,
      partyName: val.partyName,
      partyType: val.partyType,
      saleQtyBase: finalSaleBase,
      saleQtyLoose: finalSaleLoose,
      saleQtyDisplay: formatQuantity(finalSaleBase, finalSaleLoose),
      saleAmount: Math.round(val.saleAmount * 100) / 100,
      purchaseQtyBase: finalPurchaseBase,
      purchaseQtyLoose: finalPurchaseLoose,
      purchaseQtyDisplay: formatQuantity(finalPurchaseBase, finalPurchaseLoose),
      purchaseAmount: Math.round(val.purchaseAmount * 100) / 100
    });
  });

  // 7. Real-time Search Query Filtering
  if (f.searchQuery && f.searchQuery.trim()) {
    const q = f.searchQuery.trim().toLowerCase();
    rows = rows.filter(r => r.partyName.toLowerCase().includes(q));
    rows = rows.map((r, i) => ({ ...r, srNo: i + 1 }));
  }

  // 8. Aggregate Summary Totals
  let totalSaleBase = 0;
  let totalSaleLoose = 0;
  let totalSaleAmt = 0;
  let totalPurchaseBase = 0;
  let totalPurchaseLoose = 0;
  let totalPurchaseAmt = 0;

  rows.forEach(r => {
    totalSaleBase += r.saleQtyBase;
    totalSaleLoose += r.saleQtyLoose;
    totalSaleAmt += r.saleAmount;
    totalPurchaseBase += r.purchaseQtyBase;
    totalPurchaseLoose += r.purchaseQtyLoose;
    totalPurchaseAmt += r.purchaseAmount;
  });

  const summary: PartyItemReportSummary = {
    totalSaleQtyBase: totalSaleBase,
    totalSaleQtyLoose: totalSaleLoose,
    totalSaleAmount: Math.round(totalSaleAmt * 100) / 100,
    totalPurchaseQtyBase: totalPurchaseBase,
    totalPurchaseQtyLoose: totalPurchaseLoose,
    totalPurchaseAmount: Math.round(totalPurchaseAmt * 100) / 100,
    recordCount: rows.length
  };

  return { rows, summary };
}

