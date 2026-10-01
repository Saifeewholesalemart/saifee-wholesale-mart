import { Order, Retailer, Product, OrderItem, Invoice } from './db';

export type UserRole = 'ROLE_ADMIN' | 'ROLE_PACKER' | 'ROLE_BILLER' | 'ROLE_DISPATCHER';

export type TerminalAction = 
  | 'EDIT_PACKED_QTY'
  | 'EDIT_RATES'
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'DELETE_LOT'
  | 'GENERATE_INVOICE'
  | 'DISPATCH_CHALLAN'
  | 'SHORT_CLOSE_BACKORDER'
  | 'RESTORE_TRASH';

/**
 * Role-Ready Permission Matrix
 */
export function can(role: UserRole, action: TerminalAction): boolean {
  switch (role) {
    case 'ROLE_ADMIN':
      return true;
    case 'ROLE_PACKER':
      return action === 'EDIT_PACKED_QTY';
    case 'ROLE_BILLER':
      return action === 'EDIT_RATES' || action === 'GENERATE_INVOICE' || action === 'ADD_ITEM' || action === 'REMOVE_ITEM';
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
  packedPieces: number;
  unitRate: number; // Rate per piece (₹)
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
  fulfilledPieces: number;
  pendingPieces: number;
  lockedUnitRate: number; // Rate per piece (₹)
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
