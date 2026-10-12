import { Order, Retailer, Product, OrderItem, Invoice } from './db';

export type UserRole = 'ROLE_ADMIN' | 'ROLE_PACKER' | 'ROLE_BILLER' | 'ROLE_DISPATCHER';

export type TerminalAction = 
  | 'EDIT_PACKED_QTY'
  | 'EDIT_RATES'
  | 'EDIT_DISCOUNT'
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'DELETE_LOT'
  | 'GENERATE_INVOICE'
  | 'DISPATCH_CHALLAN'
  | 'SHORT_CLOSE_BACKORDER'
  | 'RESTORE_TRASH'
  | 'CONTINUE_PACKING_PENDING'
  | 'OVERRIDE_CONFIRMED_QTY';

/**
 * Role-Ready Permission Matrix
 */
export function can(role: UserRole, action: TerminalAction): boolean {
  switch (role) {
    case 'ROLE_ADMIN':
      return true;
    case 'ROLE_PACKER':
      return action === 'EDIT_PACKED_QTY' || action === 'CONTINUE_PACKING_PENDING';
    case 'ROLE_BILLER':
      return action === 'EDIT_RATES' || action === 'EDIT_DISCOUNT' || action === 'GENERATE_INVOICE';
    case 'ROLE_DISPATCHER':
      return action === 'DISPATCH_CHALLAN';
    default:
      return false;
  }
}

/**
 * MASTER COMMODITY PRINCIPLE: "MRP IS HERO"
 * Generates composite key strictly separating identical SKUs with different MRP revisions.
 */
export function getCompositeKey(sku: string, mrp: number): string {
  return `${(sku || 'SKU').trim()}__MRP_${Number(mrp || 0).toFixed(2)}`;
}

export interface OriginBadgeInfo {
  orderId: string;
  orderNumber: string;
  source: string;
  channelCode: string;
  channelLabel: string;
  badgeClass: string;
  orderDate: string;
  totalAmount: number;
  salespersonName?: string;
}

export interface PackingLotItem {
  compositeKey: string;
  productId: string;
  productName: string;
  brand?: string;
  sku: string;
  hsn?: string;
  mrp: number;
  tradingUnit: string; // 'Piece' / 'Pcs'
  baseUnit: string;
  unitsPerPack: number;
  
  // Single piece unit metrics
  orderedPieces: number;
  confirmedPieces?: number;
  packedPieces: number;
  unitRate: number; // Rate per piece (₹)
  flatDiscount?: number; // Flat ₹ discount per box/carton
  purchaseCost: number; // Purchase cost per piece (₹)
  marginPct: number | null; // ((unitRate - purchaseCost) / unitRate) * 100
  gstPercent: number;
  lineTaxable: number; // packedPieces * unitRate
  lineGst: number; // lineTaxable * (gstPercent / 100)
  lineTotal: number; // lineTaxable + lineGst
  availStockPieces: number;
  isBackorder: boolean;
  originOrderNumber: string;
  originOrderId: string;
  originItemId: string;
  originTag: string;
  daysPending: number;

  // Aliases for compatibility
  orderedCartons?: number;
  orderedLoose?: number;
  orderedBaseQty?: number;
  packedCartons?: number;
  packedLoose?: number;
  packedBaseQty?: number;
  effectivePackedCartons?: number;
  availStockCartons?: number;
}

export interface RetailerPackingLot {
  retailer: Retailer;
  sourceOrders: Order[];
  originBadges: OriginBadgeInfo[];
  items: PackingLotItem[];
  totalPieces: number;
  totalPackedPieces: number;
  taxableSubtotal: number;
  gstTotal: number;
  netGrandTotal: number;
  averageMarginPct: number | null;
  currentOutstanding: number;
  creditLimit: number;
  postBillOutstanding: number;
  creditLimitExceeded: boolean;
  exceededAmount: number;
  hasBackordersInjected: boolean;

  // Aliases for compatibility
  totalCartons?: number;
  totalPackedCartons?: number;
}

export interface RetailerPendingProductBreakdown {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  itemId: string;
  orderedPieces: number;
  confirmedPieces: number;
  previouslyPackedPieces: number;
  pendingPieces: number;
  pendingCartons: number;
  pendingLoose: number;
  lockedUnitRate: number;
  flatDiscount?: number;
  channel?: string;
  salesperson?: string;
}

export interface RetailerPendingProductItem {
  productId: string;
  productName: string;
  brand?: string;
  sku: string;
  mrp: number;
  tradingUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  totalPendingPieces: number;
  totalPendingCartons: number;
  totalPendingLoose: number;
  availStockPieces: number;
  availStockCartons: number;
  ordersBreakdown: RetailerPendingProductBreakdown[];
}

export interface RetailerPendingOrderGroup {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  orderStatus: string;
  source: string;
  channelBadge: OriginBadgeInfo;
  notes?: string;
  items: BackorderQueueItem[];
  totalOrderedPieces: number;
  totalFulfilledPieces: number;
  totalPendingPieces: number;
  totalPendingValue: number;
  daysPending: number;
  hasStockForOrder: boolean;
}

export interface RetailerPendingGroup {
  retailerId: string;
  retailer: Retailer;
  retailerName: string;
  retailerCity: string;
  retailerBeat?: string;
  retailerPhone?: string;
  retailerAddress?: string;
  currentOutstanding: number;
  creditLimit: number;
  creditLimitExceeded: boolean;
  orders: RetailerPendingOrderGroup[];
  totalPendingOrders: number;
  totalPendingItems: number;
  totalPendingPieces: number;
  totalPendingValue: number;
  maxDaysPending: number;
  earliestOrderDate: string;
  latestOrderDate: string;
  allStockAvailable: boolean;
  hasSomeStockAvailable: boolean;
}

export interface RetailerPendingOrderCard {
  retailerId: string;
  retailer: Retailer;
  shopName: string;
  ownerName: string;
  city: string;
  phone: string;
  route?: string;
  pendingOrdersCount: number;
  pendingItemsCount: number;
  totalPendingCartons: number;
  totalPendingPieces: number;
  pendingProducts: RetailerPendingProductItem[];
  sourceOrderIds: string[];
  sourceOrderNumbers: string[];
  earliestOrderDate: string;
  latestOrderDate: string;
}

export interface BackorderQueueItem {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  retailerId: string;
  retailerName: string;
  retailerCity: string;
  retailerBeat?: string;
  retailerPhone?: string;
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  mrp: number;
  unitsPerPack: number;
  tradingUnit: string;
  baseUnit: string;
  
  // Single piece unit metrics
  orderedPieces: number;
  confirmedPieces?: number;
  fulfilledPieces: number;
  pendingPieces: number;
  lockedUnitRate: number; // Rate per piece (₹)
  flatDiscount?: number;
  daysPending: number;
  availStockPieces: number;
  lastInvoiceNumber?: string;
  compositeKey: string;

  // Aliases for compatibility
  orderedCartons?: number;
  orderedLoose?: number;
  fulfilledCartons?: number;
  fulfilledLoose?: number;
  pendingCartons?: number;
  pendingLoose?: number;
  availStockCartons?: number;
}

export interface DeletedItemRecord {
  id: string;
  type: 'ITEM' | 'LOT_ORDER';
  deletedAt: string;
  deletedBy: string;
  retailerId: string;
  retailerName: string;
  orderId: string;
  orderNumber: string;
  itemId?: string;
  productName: string;
  sku?: string;
  mrp?: number;
  packedPieces?: number;
  pieceQty?: number;
  unitRate: number;
  rawItemData?: any;
  cartonQty?: number;
}
