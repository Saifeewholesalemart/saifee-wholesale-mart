// Saifee General Stores - Multi-Business & FMCG Database Engine (V5 Multi-Tenant)

export interface BusinessCompany {
  id: string; // e.g. 'biz-saifee', 'biz-second-trading'
  name: string; // e.g. 'Saifee General Stores', 'Saifee Wholesale & Trading'
  legal_name?: string;
  business_type: string; // 'FMCG Distribution' | 'Wholesale Trading' | 'Retail Chain' | 'Manufacturing' | string
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  logo_url?: string;
  currency?: string; // 'INR'
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  business_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  created_at: string;
}

export type ProfileType = 'RETAILER' | 'SALESPERSON' | 'STAFF' | 'ADMIN';
export type SalesRoleType = 'DISTRIBUTOR' | 'COMPANY';

export interface DatabaseBackupSnapshot {
  version: string;
  system: string;
  timestamp: string;
  exportDate: string;
  metadata: {
    totalRecords: number;
    businessCompaniesCount: number;
    productsCount: number;
    batchesCount: number;
    inventoryCount: number;
    invoicesCount: number;
    ordersCount: number;
    retailersCount: number;
    suppliersCount: number;
    profilesCount: number;
    paymentsCount: number;
    purchasesCount: number;
    salesReturnsCount: number;
    godownsCount: number;
    categoriesCount: number;
    cashFlowCount: number;
  };
  tables: {
    business_companies: BusinessCompany[];
    company_members: CompanyMember[];
    godowns: Godown[];
    stock_transfers: StockTransfer[];
    companies: Company[];
    suppliers: Supplier[];
    retailers: Retailer[];
    profiles: Profile[];
    categories: Category[];
    products: Product[];
    product_categories: ProductCategory[];
    inventory: Inventory[];
    batches: InventoryBatch[];
    stock_ledger: StockLedgerEntry[];
    orders: Order[];
    fulfilments: Fulfilment[];
    invoices: Invoice[];
    delivery_challans: DeliveryChallan[];
    purchases: Purchase[];
    payments: Payment[];
    sales_returns: SalesReturn[];
    company_opening_balances: CompanyOpeningBalance[];
    cash_flow: CashFlowTransaction[];
    billing_rate_audits: BillingRateAuditLog[];
    item_activity_logs: ItemActivityLog[];
    invoice_audits: InvoiceAuditLog[];
  };
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  full_name?: string;
  role: 'admin' | 'sales_dist' | 'sales_co' | 'retailer' | 'staff';
  profile_type?: ProfileType;
  mobile?: string;
  contact_no?: string;
  phone?: string;
  password?: string;
  password_hash?: string;
  active: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  
  // Polymorphic Retailer Fields:
  retailer_id?: string;
  shop_name?: string;
  shop_address?: string;
  address?: string;
  city?: string;
  state_code?: string;
  gstin?: string;
  credit_limit?: number;
  assigned_salesperson_id?: string;
  retailer_code?: string;
  
  // Polymorphic Salesperson Fields:
  sales_role_type?: SalesRoleType;
  trade_scope?: 'ALL' | 'RESTRICTED';
  company_id?: string; // For company salesperson brand link (primary/fallback)
  assigned_company_ids?: string[]; // Multiple companies / manufacturers assigned
  category_access_mode?: 'all' | 'custom'; // 'all' (default) or 'custom'
  assigned_category_ids?: string[]; // Custom assigned category IDs for this salesperson
  
  // Polymorphic Staff / Job Worker Fields:
  custom_role?: string; // e.g. "Packer", "Biller", "Godown Boy", "Floor Supervisor", "Tempo Loader", "Dispatch Boy"
  department?: string;

  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  active: boolean;
  business_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  gstin: string;
  address: string;
  active: boolean;
  business_id?: string;
}

export interface Retailer {
  id: string;
  retailer_code: string; // e.g. RET-00125
  shop_name: string;
  owner_name: string;
  address: string;
  city: string; // City filter field
  state_code: string; // default to Maharashtra (27)
  gstin?: string;
  mobile: string;
  phone?: string;
  password?: string;
  beat_name?: string;
  route?: string;
  credit_limit: number;
  outstanding: number;
  outstanding_balance?: number;
  current_balance?: number;
  active: boolean;
  business_id?: string;
  category_access_mode?: 'all' | 'custom'; // 'all' (default) or 'custom'
  assigned_category_ids?: string[]; // Custom assigned category IDs for this retailer
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  business_id?: string;
  salesperson_access_type?: 'all' | 'restricted'; // 'all' (default) or 'restricted'
  assigned_salesperson_ids?: string[]; // List of salesperson profile IDs allowed to view/sell this category
  retailer_access_type?: 'all' | 'restricted'; // 'all' (default) or 'restricted'
  assigned_retailer_ids?: string[]; // List of retailer IDs allowed to view/order this category
  created_at: string;
  updated_at?: string;
}

export interface ProductCategory {
  id: string;
  product_id: string;
  category_id: string;
  business_id?: string;
  created_at: string;
  updated_at?: string;
}

export type BaseUnit = 'Piece' | 'Packet' | 'Bottle' | 'Pouch' | 'Strip' | 'Kg' | 'Gram' | 'Litre' | 'Ml' | 'Other' | 'Bag' | 'Tin' | 'Box' | 'Dozen';
export type TradingUnit = 'Box' | 'Carton' | 'Case' | 'Bag' | 'Bundle' | 'Dozen' | 'Tin' | 'Other' | string;
export type TradeMode = 'PIECES' | 'CARTONS' | 'BOTH';

export interface Product {
  id: string;
  product_code: string;
  name: string;
  company_id: string;
  brand: string;
  category: string;
  subcategory?: string;
  description?: string;
  sku: string;
  barcode: string;
  pack_size: string; // e.g., "24 units/carton" or "12 Pieces/Ctn"
  trading_unit: 'Box' | 'Carton' | 'Case' | 'Bag' | 'Bundle' | 'Dozen' | 'Other' | string;
  trade_mode?: TradeMode; // 'PIECES' | 'CARTONS' | 'BOTH'
  allow_carton?: boolean;
  allow_pieces?: boolean;
  pieces_per_carton?: number; // Integer pack ratio (e.g. 12 means 1 Carton = 12 Pieces)
  base_unit?: BaseUnit; // e.g., 'Packet', 'Piece', 'Bottle', etc.
  packing_display: string; // e.g., "24 units / carton"
  units_per_box_carton: number; // e.g., 24
  units_per_trading_unit?: number; // alias for units_per_box_carton
  allow_loose_sale?: boolean; // true / false (default true)
  mrp: number; // MRP per trading unit
  loose_mrp?: number; // MRP per loose base unit
  selling_price: number; // Distributor Selling Price per trading unit
  loose_selling_price?: number; // Selling price per loose base unit
  loose_price_mode?: 'auto' | 'manual'; // auto (selling_price / units) vs manual
  carton_discount?: number; // Flat rupee discount per trading unit
  loose_discount?: number; // Flat rupee discount per loose base unit
  purchase_price: number; // Reference cost per trading unit
  loose_purchase_price?: number; // Reference cost per loose unit
  dealer_price?: number; // Optional dealer rate
  gst_percent: number;
  hsn: string;
  min_stock_level?: number;
  reorder_level?: number;
  batch_tracking_enabled?: boolean;
  expiry_tracking_enabled?: boolean;
  parent_product_id?: string;
  variant_attribute?: string;
  variant_value?: string;
  image_url?: string;
  active: boolean;
  business_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ItemActivityLog {
  id: string;
  product_id: string;
  action: string; // e.g. 'Item Master Created', 'Price Updated', 'Stock Adjusted', 'Details Updated', 'Status Changed', 'Variant Added', 'Category Assigned', 'Purchase Received', 'Order Billed'
  details: string;
  old_value?: string;
  new_value?: string;
  reference_id?: string;
  user_id?: string;
  user_name?: string;
  business_id?: string;
  created_at: string;
}

export interface Godown {
  id: string;
  company_id: string; // scoped to business_id (e.g. 'biz-saifee')
  name: string; // 'Main Godown', 'Secondary Godown'
  code: string; // 'GD01', 'GD02'
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  manager_name?: string;
  phone?: string;
  is_default?: boolean;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at?: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  godown_id?: string; // 'gdn-saifee-main', 'gdn-saifee-secondary'
  physical_qty: number; // in base units
  reserved_qty: number; // in base units
  available_qty: number; // physical_qty - reserved_qty in base units
  damaged_qty: number; // in base units
  expired_qty: number; // in base units
  pending_qty?: number;
  business_id?: string;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  product_id: string;
  godown_id?: string;
  godown?: string; // e.g. 'Main Godown (Bhiwandi Bay 1)', 'Central Godown (Indore Hub)', 'City Godown (South Bay 2)'
  batch_number: string;
  mfg_date?: string;
  expiry_date: string;
  purchase_rate: number;
  mrp: number;
  selling_price?: number;
  loose_selling_price?: number;
  quantity: number; // in base units
  entry_date?: string; // e.g. '2026-03-01'
  cost_layer?: string; // e.g. 'PO-2026-031'
  business_id?: string;
}

export interface BatchAllocation {
  batch_id: string;
  batch_number: string;
  allocated_qty: number; // in base units
  godown_id?: string;
  godown?: string;
  cost_layer?: string;
  purchase_rate?: number;
  mrp?: number;
  selling_price?: number;
  loose_selling_price?: number;
  expiry_date?: string;
  entry_date?: string;
}

export interface StockLedgerEntry {
  id: string;
  product_id: string;
  godown_id?: string;
  change_qty: number; // positive or negative in base units
  previous_qty?: number;
  new_qty?: number;
  direction: 'IN' | 'OUT';
  reason: string; // 'Purchase', 'Sale', 'Sales Return', 'Damage', 'Adjustment', 'Stock Transfer In', 'Stock Transfer Out'
  reference_id?: string;
  user_id?: string;
  business_id?: string;
  created_at: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  batch_id?: string;
  batch_number?: string;
  quantity: number; // base units
  carton_qty?: number;
  loose_qty?: number;
  received_qty?: number; // base units received
  received_carton_qty?: number;
  received_loose_qty?: number;
}

export interface StockTransfer {
  id: string;
  transfer_number: string; // e.g. TR-2026-00001
  company_id: string;
  from_godown_id: string;
  to_godown_id: string;
  status: 'Draft' | 'Requested' | 'Approved' | 'Dispatched' | 'Received' | 'Completed' | 'Cancelled';
  requested_by?: string;
  approved_by?: string;
  dispatched_at?: string;
  received_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  items: StockTransferItem[];
}

export interface OrderItem {
  id: string;
  order_id?: string;
  product_id: string;
  product_name?: string;
  batch_id?: string;
  selected_mrp?: number;
  mrp?: number;
  purchase_rate?: number;
  quantity: number; // total base units (or primary quantity count)
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  carton_qty?: number; // full trading unit count
  loose_qty?: number; // loose base unit count
  base_qty?: number; // total integer base units
  carton_rate?: number; // rate per carton
  rate?: number; // alias for carton_rate
  loose_rate?: number; // rate per loose unit
  carton_discount?: number; // discount per carton
  loose_discount?: number; // discount per loose unit
  loose_mrp?: number;
  base_price: number; // primary carton rate or calculated rate
  discount: number; // total or primary unit flat rupee discount
  final_price: number;
  gst_percent: number;
  gst_amount: number;
  total_amount: number;
  created_at?: string;
  
  // Rate Snapshot & Manual Rate Override fields:
  catalogue_rate_at_order?: number;
  order_time_rate?: number;
  manual_billing_rate?: number;
  final_applied_rate?: number;
  manual_rate_applied?: boolean;
  manual_rate_updated_by?: string;
  manual_rate_updated_at?: string;
  manual_rate_reason?: string;

  // Backorder Lifecycle & Partial Fulfillment Tracking (Specification 1)
  ordered_qty?: number; // Total ordered base units (int)
  fulfilled_qty?: number; // Cumulative fulfilled base units across all invoices (int)
  remaining_qty?: number; // Remaining unfulfilled base units (int, ordered_qty - fulfilled_qty)
  status?: 'PENDING' | 'PARTIALLY_FULFILLED' | 'COMPLETED' | string;
  ordered_pieces?: number;
  fulfilled_pieces?: number;
  cancelled_pieces?: number;
  packed_pieces?: number;
  packed_cartons?: number;
  packing_notes?: string;
  unit_rate?: number;

  // Extended fields for partial fulfillment:
  confirmed_qty?: number; // in base units
  packed_qty?: number; // in base units
  dispatched_qty?: number; // in base units
  delivered_qty?: number; // in base units
  pending_qty?: number; // in base units
  cancelled_qty?: number; // in base units
  cancel_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  pending_reason?: 'Stock Unavailable' | 'Partial Stock Available' | 'Awaiting Purchase' | 'Retailer Requested Later' | 'Delivery Issue' | 'Other' | string;
  backordered?: boolean;
  batch_allocations?: BatchAllocation[];
}

export type OrderChannel =
  | 'Retailer Direct'
  | 'Distributor Salesperson'
  | 'Company Salesperson'
  | 'On Counter Sale';

export interface Order {
  id: string;
  order_number: string;
  retailer_id: string;
  source: 'distributor_salesperson' | 'company_salesperson' | 'retailer_direct' | 'counter_sale';
  channel?: OrderChannel;
  created_by?: string;
  created_at?: string;
  order_date: string;
  total_amount: number;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Confirmed' | 'Partially Confirmed' | 'Packing' | 'PACKING_IN_PROGRESS' | 'Packed' | 'PACKED_AND_SEALED' | 'Ready for Dispatch' | 'Partially Dispatched' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'Partially Fulfilled' | 'Fully Fulfilled' | 'Completed';
  items?: OrderItem[];
  confirmed_at?: string;
  packed_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
  admin_notes?: string;
  review_notes?: string;
  dispatch_transport_mode?: string;
  dispatch_vehicle_number?: string;
  dispatch_delivery_person?: string;
  dispatch_notes?: string;
  dispatch_godown?: string;
  invoice_id?: string;
  challan_id?: string;
  business_id?: string;
  updated_at?: string;
}

export interface FulfilmentItemSourceBreakdown {
  order_id: string;
  order_number: string;
  source: string;
  order_date: string;
  quantity: number; // in base units
  confirmed_qty?: number; // in base units
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  carton_qty?: number;
  loose_qty?: number;
  order_time_rate?: number;
  carton_rate?: number;
  loose_rate?: number;
  discount?: number;
  carton_discount?: number;
  loose_discount?: number;
  selected_mrp?: number;
  batch_id?: string;
  purchase_rate?: number;
}

export interface FulfilmentItem {
  id: string;
  fulfilment_id: string;
  order_item_id: string;
  product_id: string;
  batch_id?: string;
  selected_mrp?: number;
  purchase_rate?: number;
  original_qty: number; // in base units
  confirmed_qty: number; // in base units
  packed_qty?: number; // in base units
  dispatched_qty?: number; // in base units
  pending_qty: number; // in base units
  trading_unit?: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  carton_rate?: number;
  loose_rate?: number;
  carton_discount?: number;
  loose_discount?: number;
  order_id?: string;
  retailer_id?: string;
  source_orders_breakdown?: FulfilmentItemSourceBreakdown[];
  batch_allocations?: BatchAllocation[];
  order_time_rate?: number;
  discount?: number; // flat rupee discount
  manual_billing_rate?: number;
  override_reason?: string;
  final_applied_rate?: number;
  manual_rate_applied?: boolean;
  manual_rate_updated_by?: string;
  manual_rate_updated_at?: string;
  manual_rate_reason?: string;
}

export interface Fulfilment {
  id: string;
  retailer_id: string;
  fulfilment_number: string;
  source_order_ids?: string[];
  status: 'Packing' | 'Confirmed' | 'Partially Confirmed' | 'Packed' | 'Ready for Dispatch' | 'Partially Dispatched' | 'Dispatched' | 'Delivered' | 'Cancelled';
  created_at: string;
  items?: FulfilmentItem[];
  confirmed_at?: string;
  packed_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
  dispatch_transport_mode?: string;
  dispatch_vehicle_number?: string;
  dispatch_delivery_person?: string;
  dispatch_notes?: string;
  dispatch_godown?: string;
  invoice_id?: string;
  challan_id?: string;
  business_id?: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name?: string;
  variant_name?: string;
  description?: string;
  hsn: string;
  packing: string;
  quantity: number; // base units or primary qty
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  rate: number; // carton rate
  carton_rate?: number;
  loose_rate?: number;
  discount: number; // total discount
  carton_discount?: number;
  loose_discount?: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  batch_number?: string;
  batch_id?: string;
  mrp?: number;
  purchase_rate?: number;
  catalogue_rate?: number;
  order_time_rate?: number;
  manual_billing_rate?: number;
  override_reason?: string;
  rate_override_applied?: boolean;
  manual_rate_applied?: boolean;
  manual_rate_reason?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  retailer_id: string;
  order_ref_id?: string; // order_id or fulfilment_id
  source_order_ids?: string[];
  source_order_numbers?: string[];
  order_numbers?: string[];
  fulfilment_number?: string;
  date: string;
  place_of_supply: string;
  subtotal: number;
  discount_amount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  round_off: number;
  grand_total: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status?: 'Paid' | 'Partial' | 'Unpaid' | string;
  items?: InvoiceItem[];
  has_manual_rates?: boolean;
  payment_mode?: string;
  payment_reference?: string;
  notes?: string;
  business_id?: string;
  last_edited_at?: string;
  last_edited_by?: string;
  edit_count?: number;
}

export interface CustomerCreditProfile {
  found: boolean;
  retailer_id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  credit_limit: number;
  total_outstanding: number;
  available_credit: number;
  unpaid_invoices_count: number;
  oldest_unpaid_days: number;
  is_limit_exceeded: boolean;
  has_overdue_invoices: boolean;
  is_blocked: boolean;
  block_reason?: string;
  aging_buckets: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
}

export interface CustomerLedgerEntry {
  id: string;
  business_id?: string;
  retailer_id: string;
  entry_type: 'DEBIT' | 'CREDIT';
  category: 'SALES_INVOICE' | 'PAYMENT_RECEIVED' | 'SALES_RETURN' | 'OPENING_BALANCE' | 'MANUAL_JOURNAL' | 'DISCOUNT_CREDIT' | 'BAD_DEBT_WRITEOFF';
  reference_number: string;
  reference_id?: string;
  date: string;
  amount: number;
  running_balance: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface InvoiceChangeField {
  field: string;
  label: string;
  old_value: any;
  new_value: any;
}

export interface InvoiceItemDiff {
  product_id: string;
  product_name: string;
  action: 'added' | 'removed' | 'modified';
  old_qty?: number;
  new_qty?: number;
  old_rate?: number;
  new_rate?: number;
  old_discount?: number;
  new_discount?: number;
  old_total?: number;
  new_total?: number;
  details?: string;
}

export interface InvoiceAuditLog {
  id: string;
  invoice_id: string;
  invoice_number: string;
  retailer_id: string;
  retailer_name: string;
  admin_id: string;
  admin_name: string;
  timestamp: string;
  reason: string;
  old_grand_total: number;
  new_grand_total: number;
  old_outstanding_amount: number;
  new_outstanding_amount: number;
  retailer_outstanding_delta: number;
  field_changes: InvoiceChangeField[];
  item_changes: InvoiceItemDiff[];
  snapshot_before: Invoice;
  snapshot_after: Invoice;
  business_id?: string;
}

export interface DeliveryChallanItem {
  id: string;
  challan_id: string;
  order_item_id?: string;
  product_id: string;
  product_name: string;
  brand?: string;
  variant_name?: string;
  pack_size: string;
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  dispatched_qty: number; // in base units
  batch_number: string;
  batch_id?: string;
  mrp?: number;
  purchase_rate?: number;
  expiry_date?: string;
}

export interface DeliveryChallan {
  id: string;
  challan_number: string;
  order_id: string;
  order_number?: string;
  fulfilment_id?: string;
  retailer_id: string;
  invoice_id?: string;
  invoice_number?: string;
  dispatch_date: string;
  transport_mode?: string;
  vehicle_number?: string;
  delivery_person?: string;
  notes?: string;
  total_quantity?: number; // total base units
  total_items?: number;
  total_units?: number;
  items: DeliveryChallanItem[];
  business_id?: string;
  created_at: string;
}

export interface BillingRateAuditLog {
  id: string;
  order_id?: string;
  order_item_id?: string;
  fulfilment_id?: string;
  invoice_id?: string;
  retailer_id: string;
  product_id: string;
  catalogue_rate: number;
  order_time_rate: number;
  manual_billing_rate: number;
  final_applied_rate: number;
  discount: number;
  admin_user_id?: string;
  admin_user_name?: string;
  reason: string;
  business_id?: string;
  created_at: string;
}

export interface BillingRateRecord {
  id: string;
  order_number: string;
  invoice_number?: string;
  date: string;
  quantity: number; // base units
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  packing: string;
  catalogue_rate: number;
  carton_rate?: number;
  loose_rate?: number;
  discount: number;
  carton_discount?: number;
  loose_discount?: number;
  applied_rate: number;
  final_applied_rate: number;
  manual_rate_applied?: boolean;
  manual_rate_reason?: string;
  rate_source?: string; // 'Admin Manual Override' | 'Agreed Order Rate' | 'Catalogue Dealer Rate'
  business_id?: string;
}

export interface FifoBatchSuggestion {
  batch: InventoryBatch;
  suggested_qty: number; // in base units
  priority: number;
  is_earliest_entry: boolean;
  has_expiry_warning: boolean;
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  product_id: string;
  quantity: number; // base units
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  units_per_box_carton?: number;
  purchase_rate: number; // carton purchase rate
  carton_rate?: number; // alias for purchase_rate
  loose_purchase_rate?: number; // loose unit purchase rate
  loose_rate?: number; // alias for loose_purchase_rate
  selling_price?: number;
  loose_selling_price?: number;
  discount: number;
  free_quantity: number;
  mrp: number;
  gst_percent: number;
  hsn: string;
  batch?: string;
  manufacturing_date?: string;
  expiry_date?: string;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  receiving_godown_id?: string;
  status: 'Draft' | 'Confirmed';
  business_id?: string;
  created_at: string;
  items?: PurchaseItem[];
}

export interface Payment {
  id: string;
  retailer_id: string;
  payment_number: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Credit' | 'Other';
  reference_number?: string;
  notes?: string;
  date: string;
  business_id?: string;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount_allocated: number;
  business_id?: string;
}

export type CashFlowType = 'CASH_IN' | 'CASH_OUT';
export type CashFlowPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';
export type CashFlowSource = 
  | 'Manual Entry'
  | 'Invoice Payment'
  | 'Retailer Payment'
  | 'Supplier Payment'
  | 'Purchase Payment'
  | 'Opening Balance'
  | 'Counter Sale'
  | 'Reversal / Void';
export type CashFlowStatus = 'Active' | 'Voided';

export interface CashFlowEditHistoryEntry {
  id: string;
  field: string;
  old_value: any;
  new_value: any;
  changed_by: string;
  changed_at: string;
  reason: string;
}

export interface CashFlowTransaction {
  id: string;
  transaction_number: string; // e.g. CF-2026-00001
  company_id: string; // business_id e.g. 'biz-saifee' or 'biz-second-trading'
  date: string; // YYYY-MM-DD or ISO
  time: string; // HH:mm:ss or HH:mm
  type: CashFlowType;
  amount: number;
  payment_mode: CashFlowPaymentMode;
  category: string;
  party_type?: 'retailer' | 'supplier' | 'other';
  party_id?: string;
  party_name: string;
  reference_number?: string;
  source_type: CashFlowSource;
  source_id?: string;
  linked_invoice_id?: string;
  linked_invoice_number?: string;
  linked_retailer_id?: string;
  linked_supplier_id?: string;
  linked_purchase_id?: string;
  remarks?: string;
  status: CashFlowStatus;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  edit_history?: CashFlowEditHistoryEntry[];
}

export interface CompanyOpeningBalance {
  company_id: string;
  opening_balance: number;
  as_of_date: string; // e.g. '2026-04-01'
  mode_balances?: { [key in CashFlowPaymentMode]?: number };
  updated_by?: string;
  updated_at?: string;
}

export const DEFAULT_CASH_IN_CATEGORIES = [
  'Retailer Payment',
  'Invoice Payment',
  'Advance Received',
  'Other Income',
  'Cash Deposit',
  'Bank Receipt',
  'Other'
] as const;

export const DEFAULT_CASH_OUT_CATEGORIES = [
  'Supplier Payment',
  'Purchase Payment',
  'Transport',
  'Freight',
  'Salary',
  'Rent',
  'Electricity',
  'Office Expense',
  'Bank Charges',
  'Other Expense'
] as const;

export interface SalesReturnItem {
  id: string;
  sales_return_id: string;
  product_id: string;
  quantity: number; // base units
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  rate: number; // carton or effective rate
  loose_rate?: number;
  hsn?: string;
  mrp?: number;
  gst_percent?: number;
  taxable_value?: number;
  gst_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total_amount?: number;
  condition: 'Sellable' | 'Damaged';
}

export interface SalesReturn {
  id: string;
  credit_note_number?: string;
  retailer_id?: string;
  invoice_id?: string;
  return_date: string;
  receiving_godown_id?: string;
  reason: string;
  status: string;
  taxable_amount?: number;
  gst_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  round_off?: number;
  total_amount?: number;
  business_id?: string;
  items?: SalesReturnItem[];
}

export interface PurchaseReturnItem {
  id: string;
  purchase_return_id: string;
  product_id: string;
  quantity: number; // base units
  carton_qty?: number;
  loose_qty?: number;
  base_qty?: number;
  trading_unit: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  rate: number;
}

export interface PurchaseReturn {
  id: string;
  purchase_id: string;
  return_date: string;
  reason: string;
  status: string;
  business_id?: string;
  items?: PurchaseReturnItem[];
}

export interface ProductAlias {
  id: string;
  supplier_id: string;
  alias_name: string;
  product_id: string;
  business_id?: string;
}

export interface AIPurchaseImportItem {
  id: string;
  import_id: string;
  extracted_name: string;
  matched_product_id?: string;
  match_confidence: 'GREEN' | 'YELLOW' | 'RED';
  quantity?: number; // base units
  carton_qty?: number;
  loose_qty?: number;
  trading_unit?: string;
  base_unit?: string;
  units_per_trading_unit?: number;
  purchase_rate?: number;
  mrp?: number;
  gst_percent?: number;
  hsn?: string;
  batch?: string;
  expiry_date?: string;
}

export interface AIPurchaseImport {
  id: string;
  supplier_name?: string;
  supplier_gstin?: string;
  invoice_number?: string;
  invoice_date?: string;
  total_amount?: number;
  status: 'Pending_Verification' | 'Confirmed';
  image_url?: string;
  business_id?: string;
  created_at: string;
  items?: AIPurchaseImportItem[];
}

export interface VyaparImportSnapshot {
  product_id: string;
  previous_product: Product;
}

export interface VyaparImportRowLog {
  row_number: number;
  product_name: string;
  sku?: string;
  barcode?: string;
  action_taken: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  product_id?: string;
  changes?: { field: string; old_value: any; new_value: any }[];
  stock_inward_qty?: number;
  batch_number?: string;
  expiry_date?: string;
  error?: string;
}

export interface VyaparImportBatch {
  id: string;
  file_name: string;
  file_size?: number;
  imported_at: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  stock_units_imported: number;
  status: 'Completed' | 'Completed with Errors' | 'Rolled Back' | 'Failed';
  imported_by_id?: string;
  imported_by_name?: string;
  created_product_ids: string[];
  updated_snapshots: VyaparImportSnapshot[];
  created_purchase_id?: string;
  created_batch_ids: string[];
  created_ledger_ids: string[];
  column_mapping: Record<string, string>;
  row_logs: VyaparImportRowLog[];
  rollback_at?: string;
  rollback_by_name?: string;
  rollback_reason?: string;
  business_id?: string;
}

// ----------------------------------------------------
// FLEXIBLE TRADING UNITS & AUTO-BOX CONVERSION ENGINE
// Standard nomenclature: Strictly "Pieces" (Pcs)
// ----------------------------------------------------

export interface AutoBoxResult {
  isPieceOnly: boolean;
  tradeMode: TradeMode;
  packSize: number;
  totalPieces: number;
  fullCartons: number;
  loosePieces: number;
  displayOrdered: string;
  displayStock: string;
  defaultPackedPieces: number;
  defaultPackedCartons: number | null;
  defaultPackedLoose: number;
  tradingUnitText: string;
}

/**
 * Derives the active trade mode, carton/piece permissions, and effective pack size for a product.
 */
export function getProductTradeMode(product?: Partial<Product> | null): {
  tradeMode: TradeMode;
  allowCarton: boolean;
  allowPieces: boolean;
  packSize: number;
} {
  if (!product) {
    return { tradeMode: 'PIECES', allowCarton: false, allowPieces: true, packSize: 1 };
  }

  const packSize = Math.max(1, product.pieces_per_carton || product.units_per_box_carton || product.units_per_trading_unit || 1);

  if (product.trade_mode) {
    const tm = product.trade_mode;
    return {
      tradeMode: tm,
      allowCarton: tm === 'CARTONS' || tm === 'BOTH',
      allowPieces: tm === 'PIECES' || tm === 'BOTH',
      packSize: tm === 'PIECES' ? 1 : packSize,
    };
  }

  if (product.allow_carton !== undefined || product.allow_pieces !== undefined) {
    const allowCarton = Boolean(product.allow_carton);
    const allowPieces = product.allow_pieces !== undefined ? Boolean(product.allow_pieces) : !allowCarton;
    let tradeMode: TradeMode = 'PIECES';
    if (allowCarton && allowPieces) tradeMode = 'BOTH';
    else if (allowCarton) tradeMode = 'CARTONS';
    else tradeMode = 'PIECES';

    return {
      tradeMode,
      allowCarton,
      allowPieces,
      packSize: tradeMode === 'PIECES' ? 1 : packSize,
    };
  }

  // Fallback inferred from legacy fields
  const tradingUnitLower = (product.trading_unit || '').toLowerCase();
  const isCtnOrBox = tradingUnitLower.includes('carton') || tradingUnitLower.includes('box') || tradingUnitLower.includes('case') || tradingUnitLower.includes('bag') || tradingUnitLower.includes('bundle') || tradingUnitLower.includes('dozen');
  const isPieceOnly = tradingUnitLower === 'piece' || tradingUnitLower === 'pieces' || tradingUnitLower === 'pcs' || tradingUnitLower === 'packet' || tradingUnitLower === 'unit' || tradingUnitLower === 'bottle';

  if (isPieceOnly || (packSize <= 1 && !isCtnOrBox)) {
    return {
      tradeMode: 'PIECES',
      allowCarton: false,
      allowPieces: true,
      packSize: 1,
    };
  }

  if (isCtnOrBox) {
    const allowPieces = product.allow_loose_sale === true;
    return {
      tradeMode: allowPieces ? 'BOTH' : 'CARTONS',
      allowCarton: true,
      allowPieces,
      packSize,
    };
  }

  return {
    tradeMode: 'BOTH',
    allowCarton: true,
    allowPieces: true,
    packSize,
  };
}

/**
 * Core Auto-Box Conversion Engine for Order Processing & Terminal Display.
 * Evaluates ordered pieces and converts to auto-box breakdown or pure pieces mode.
 */
export function formatAutoBoxQuantity(
  orderedPieces: number,
  product?: Partial<Product> | null,
  customPackSize?: number
): AutoBoxResult {
  const meta = getProductTradeMode(product);
  const packSize = customPackSize && customPackSize > 0 ? customPackSize : meta.packSize;
  const isPieceOnly = meta.tradeMode === 'PIECES' || !packSize || packSize <= 1;
  const totalPieces = Math.max(0, Math.floor(Number(orderedPieces) || 0));

  if (isPieceOnly) {
    return {
      isPieceOnly: true,
      tradeMode: 'PIECES',
      packSize: 1,
      totalPieces,
      fullCartons: 0,
      loosePieces: totalPieces,
      displayOrdered: `${totalPieces} Pieces`,
      displayStock: `${totalPieces} Pieces`,
      defaultPackedPieces: totalPieces,
      defaultPackedCartons: null,
      defaultPackedLoose: totalPieces,
      tradingUnitText: 'Pieces',
    };
  }

  const fullCartons = Math.floor(totalPieces / packSize);
  const loosePieces = totalPieces % packSize;

  const displayOrdered = loosePieces > 0
    ? `${fullCartons} Box + ${loosePieces} Pieces (${totalPieces} Pieces)`
    : `${fullCartons} Box (${totalPieces} Pieces)`;

  let displayStock = '';
  if (meta.tradeMode === 'CARTONS') {
    displayStock = `${fullCartons} Ctns (Pack: ${packSize} Pieces/Ctn)`;
  } else {
    displayStock = loosePieces > 0
      ? `${fullCartons} Ctns + ${loosePieces} Pieces (Pack: ${packSize} Pieces/Ctn)`
      : `${fullCartons} Ctns (Pack: ${packSize} Pieces/Ctn)`;
  }

  return {
    isPieceOnly: false,
    tradeMode: meta.tradeMode,
    packSize,
    totalPieces,
    fullCartons,
    loosePieces,
    displayOrdered,
    displayStock,
    defaultPackedPieces: totalPieces,
    defaultPackedCartons: fullCartons,
    defaultPackedLoose: loosePieces,
    tradingUnitText: meta.tradeMode === 'CARTONS' ? 'Carton / Box' : 'Both (Carton & Pieces)',
  };
}

/**
 * Formats inventory stock according to configured trading mode.
 * - Pieces only: Stock: X Pieces (Trading Unit: Pieces)
 * - Carton only: Stock: X Ctns (Pack: N Pieces/Ctn)
 * - Both: Stock: X Ctns + Y Pieces (Pack: N Pieces/Ctn)
 */
export function formatProductStockDisplay(
  totalPieces: number,
  product?: Partial<Product> | null
): {
  display: string;
  badge: string;
  tradeMode: TradeMode;
  fullCartons: number;
  loosePieces: number;
  totalPieces: number;
  packSize: number;
};
export function formatProductStockDisplay(
  totalPieces: number,
  product: Partial<Product> | null | undefined,
  asString: true
): string;
export function formatProductStockDisplay(
  totalPieces: number,
  product: Partial<Product> | null | undefined,
  asString: false
): {
  display: string;
  badge: string;
  tradeMode: TradeMode;
  fullCartons: number;
  loosePieces: number;
  totalPieces: number;
  packSize: number;
};
export function formatProductStockDisplay(
  totalPieces: number,
  product?: Partial<Product> | null,
  asString?: boolean
): any {
  const auto = formatAutoBoxQuantity(totalPieces, product);
  if (asString) {
    return auto.displayStock;
  }
  let badge = 'Pieces Only';
  if (auto.tradeMode === 'CARTONS') {
    badge = 'Carton Only';
  } else if (auto.tradeMode === 'BOTH') {
    badge = 'Dual: Ctn + Pcs';
  }
  return {
    display: auto.displayStock,
    badge,
    tradeMode: auto.tradeMode,
    fullCartons: auto.fullCartons,
    loosePieces: auto.loosePieces,
    totalPieces: auto.totalPieces,
    packSize: auto.packSize,
  };
}

/**
 * Total piece quantity calculation.
 * Returns the exact numeric piece count.
 */
export function calculateBaseQuantity(cartonQty: number = 0, looseQty: number = 0, unitsPerTradingUnit: number = 1): number {
  const cQty = Math.max(0, Math.floor(Number(cartonQty) || 0));
  const lQty = Math.max(0, Math.floor(Number(looseQty) || 0));
  const u = Math.max(1, Math.floor(Number(unitsPerTradingUnit) || 1));
  if (u > 1) {
    return (cQty * u) + lQty;
  }
  return cQty + lQty;
}

/**
 * Splits total pieces into carton quantity and remaining loose pieces.
 */
export function splitBaseQuantity(totalBaseQty: number = 0, unitsPerTradingUnit: number = 1): { cartonQty: number; looseQty: number } {
  const total = Math.max(0, Math.floor(Number(totalBaseQty) || 0));
  const u = Math.max(1, Math.floor(Number(unitsPerTradingUnit) || 1));
  if (u > 1) {
    return { cartonQty: Math.floor(total / u), looseQty: total % u };
  }
  return { cartonQty: 0, looseQty: total };
}

/**
 * Formats a unit name strictly with standardized terminology.
 */
export function formatUnitName(name: string = 'Piece', count: number = 1): string {
  if (count === 1) return 'Piece';
  const lower = (name || '').trim().toLowerCase();
  if (lower === 'piece' || lower === 'pc' || lower === 'unit' || lower === 'units') return 'Pieces';
  if (lower === 'box' || lower === 'boxes') return 'Boxes';
  if (lower === 'carton' || lower === 'cartons' || lower === 'ctn') return 'Ctns';
  if (lower === 'bottle') return 'Bottles';
  if (lower === 'packet' || lower === 'pkt') return 'Packets';
  if (lower === 'strip') return 'Strips';
  if (lower === 'pouch') return 'Pouches';
  if (name.endsWith('s') || name.endsWith('S')) return name;
  return `${name}s`;
}

/**
 * Formats a piece quantity into a clean, human-readable display string (e.g. "50 Pieces" or "2 Ctns (Pack: 12 Pieces/Ctn)").
 */
export function formatQuantityDisplay(
  totalBaseQty: number = 0,
  unitsPerTradingUnit: number = 1,
  tradingUnit: string = 'Piece',
  baseUnit: string = 'Piece',
  includeTotalBadge: boolean = false
): string {
  const total = Math.max(0, Math.floor(Number(totalBaseQty) || 0));
  const packSize = Math.max(1, Number(unitsPerTradingUnit) || 1);
  const tUpper = (tradingUnit || '').toUpperCase();

  if (packSize > 1 && tUpper !== 'PIECES' && tUpper !== 'PIECE') {
    const fullCartons = Math.floor(total / packSize);
    const loosePieces = total % packSize;
    if (tUpper === 'CARTONS' || tUpper === 'CARTON') {
      return `${fullCartons} Ctns (Pack: ${packSize} Pieces/Ctn)`;
    }
    if (fullCartons > 0 && loosePieces > 0) {
      return `${fullCartons} Ctns + ${loosePieces} Pieces (Pack: ${packSize} Pieces/Ctn)`;
    } else if (fullCartons > 0) {
      return `${fullCartons} Ctns (Pack: ${packSize} Pieces/Ctn)`;
    } else {
      return `${loosePieces} Pieces`;
    }
  }

  return `${total} Pieces`;
}

/**
 * Formats item quantity as simple piece count.
 */
export function formatItemQuantityDisplay(
  baseQty: number = 0,
  unitsPerTradingUnit: number = 1,
  tradingUnit: string = 'Piece',
  baseUnit: string = 'Piece',
  orderUnitMode?: 'loose' | 'carton' | 'mixed'
): string {
  return formatQuantityDisplay(baseQty, unitsPerTradingUnit, tradingUnit, baseUnit);
}

/**
 * Calculates item pricing, discounts, and GST strictly for piece-based sales:
 * Taxable Amount = (Quantity * Unit Rate) - (Quantity * Discount)
 * GST Amount = Taxable Amount * (GST% / 100)
 * Total Amount = Taxable Amount + GST Amount
 */
export function calculateItemAmounts(
  cartonQty: number = 0,
  looseQty: number = 0,
  cartonRate: number = 0,
  looseRate: number = 0,
  cartonDiscount: number = 0,
  looseDiscount: number = 0,
  gstPercent: number = 0
) {
  const totalQty = Math.max(0, Math.floor((Number(cartonQty) || 0) + (Number(looseQty) || 0)));
  const unitRate = Math.max(0, Number(cartonRate) || Number(looseRate) || 0);
  const discountPerPc = Math.max(0, Number(cartonDiscount) || Number(looseDiscount) || 0);

  const grossAmount = totalQty * unitRate;
  const discountAmount = totalQty * discountPerPc;
  const taxableAmount = Math.max(0, grossAmount - discountAmount);
  const gstAmount = taxableAmount * ((Number(gstPercent) || 0) / 100);
  const totalAmount = taxableAmount + gstAmount;

  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    gstAmount,
    totalAmount,
    finalRate: totalAmount,
    netTotal: totalAmount
  };
}

// ----------------------------------------------------
// ORDER & ITEM QUANTITY CALCULATION HELPERS
// ----------------------------------------------------

export interface OrderItemQuantities {
  orderedCartons: number;
  confirmedCartons: number;
  dispatchedCartons: number;
  cancelledCartons: number;
  pendingConfirmationCartons: number;
  pendingDispatchCartons: number;
  totalUnfulfilledCartons: number;

  // Base piece integer counts
  orderedBase: number;
  confirmedBase: number;
  dispatchedBase: number;
  cancelledBase: number;
  pendingConfirmationBase: number;
  pendingDispatchBase: number;
  totalUnfulfilledBase: number;

  // Formatted display strings
  displayOrdered: string;
  displayConfirmed: string;
  displayDispatched: string;
  displayCancelled: string;
  displayPending: string;
  displayPendingConfirmation: string;
  displayPendingDispatch: string;

  // Unit metadata
  orderUnitMode: 'loose' | 'carton' | 'mixed';
  effectiveUnit: string;
  tradingUnit: string;
  baseUnit: string;
  unitsPerPack: number;

  // Pricing & rates
  cartonRate: number;
  looseRate: number;
  effectiveRate: number;
  effectiveUnitRateLabel: string;
  totalValue: number;
  fulfilledValue: number;
  pendingValue: number;

  // MRP metadata
  effectiveMrp: number;
  displayMrp: string;
  mrpUnitLabel: string;
}

export function calculateItemQuantities(item: OrderItem, product?: Product): OrderItemQuantities {
  const tradingUnit = 'Piece';
  const baseUnit = 'Piece';
  const unitsPerPack = 1;

  // 1. Determine exact pieces ordered
  let orderedBase = 0;
  if (item.base_qty !== undefined && item.base_qty > 0) {
    orderedBase = item.base_qty;
  } else if (item.quantity !== undefined && item.quantity > 0) {
    orderedBase = item.quantity;
  } else if (item.ordered_qty !== undefined && item.ordered_qty > 0) {
    orderedBase = item.ordered_qty;
  } else {
    orderedBase = (item.carton_qty || 0) + (item.loose_qty || 0);
  }
  orderedBase = Math.max(0, Math.floor(orderedBase));

  // 2. Cancelled pieces
  let cancelledBase = Math.max(0, Math.floor(item.cancelled_qty || 0));
  cancelledBase = Math.min(orderedBase, cancelledBase);
  const activeOrderedBase = Math.max(0, orderedBase - cancelledBase);

  // 3. Confirmed pieces
  let confirmedBase = activeOrderedBase;
  if (item.confirmed_qty !== undefined) {
    confirmedBase = Math.min(activeOrderedBase, Math.max(0, Math.floor(item.confirmed_qty)));
  }

  // 4. Dispatched / Fulfilled pieces
  let dispatchedBase = 0;
  if (item.fulfilled_qty !== undefined) {
    dispatchedBase = Math.min(activeOrderedBase, Math.max(0, Math.floor(item.fulfilled_qty)));
  } else if (item.dispatched_qty !== undefined) {
    dispatchedBase = Math.min(activeOrderedBase, Math.max(0, Math.floor(item.dispatched_qty)));
  } else if (item.delivered_qty !== undefined) {
    dispatchedBase = Math.min(activeOrderedBase, Math.max(0, Math.floor(item.delivered_qty)));
  }

  const pendingConfirmationBase = Math.max(0, activeOrderedBase - confirmedBase);
  const pendingDispatchBase = Math.max(0, confirmedBase - dispatchedBase);
  const totalUnfulfilledBase = item.remaining_qty !== undefined
    ? Math.min(activeOrderedBase, Math.max(0, Math.floor(item.remaining_qty)))
    : Math.max(0, activeOrderedBase - dispatchedBase);

  // Display strings
  const displayOrdered = `${orderedBase} Pcs`;
  const displayConfirmed = `${confirmedBase} Pcs`;
  const displayDispatched = `${dispatchedBase} Pcs`;
  const displayCancelled = `${cancelledBase} Pcs`;
  const displayPending = `${totalUnfulfilledBase} Pcs`;
  const displayPendingConfirmation = `${pendingConfirmationBase} Pcs`;
  const displayPendingDispatch = `${pendingDispatchBase} Pcs`;

  // Pricing strictly per piece
  const unitRate = item.manual_billing_rate ?? item.final_applied_rate ?? item.carton_rate ?? item.loose_rate ?? item.rate ?? item.final_price ?? item.base_price ?? product?.selling_price ?? 0;
  const effectiveRate = unitRate;
  const effectiveUnitRateLabel = `₹${unitRate.toFixed(2)} / Pc`;

  const totalValue = item.total_amount ?? (orderedBase * unitRate);
  const fulfilledValue = dispatchedBase * unitRate;
  const pendingValue = totalUnfulfilledBase * unitRate;

  // MRP
  const effectiveMrp = item.selected_mrp ?? product?.mrp ?? 0;
  const formattedMrpVal = Number.isInteger(effectiveMrp) ? effectiveMrp.toString() : Number(effectiveMrp).toFixed(2);
  const displayMrp = `MRP ₹${formattedMrpVal}`;
  const mrpUnitLabel = `MRP ₹${formattedMrpVal} / Pc`;

  return {
    orderedCartons: orderedBase,
    confirmedCartons: confirmedBase,
    dispatchedCartons: dispatchedBase,
    cancelledCartons: cancelledBase,
    pendingConfirmationCartons: pendingConfirmationBase,
    pendingDispatchCartons: pendingDispatchBase,
    totalUnfulfilledCartons: totalUnfulfilledBase,

    orderedBase,
    confirmedBase,
    dispatchedBase,
    cancelledBase,
    pendingConfirmationBase,
    pendingDispatchBase,
    totalUnfulfilledBase,

    displayOrdered,
    displayConfirmed,
    displayDispatched,
    displayCancelled,
    displayPending,
    displayPendingConfirmation,
    displayPendingDispatch,

    orderUnitMode: 'loose',
    effectiveUnit: 'Piece',
    tradingUnit: 'Piece',
    baseUnit: 'Piece',
    unitsPerPack: 1,

    cartonRate: unitRate,
    looseRate: unitRate,
    effectiveRate: unitRate,
    effectiveUnitRateLabel,
    totalValue: Math.round(totalValue),
    fulfilledValue: Math.round(fulfilledValue),
    pendingValue: Math.round(pendingValue),

    effectiveMrp,
    displayMrp,
    mrpUnitLabel
  };
}

export type OrderComputedStatus =
  | 'Pending Confirmation'
  | 'Partially Confirmed'
  | 'Confirmed'
  | 'Packed'
  | 'Partially Dispatched'
  | 'Partially Fulfilled'
  | 'Completed'
  | 'Cancelled';

export interface OrderQuantities {
  orderedCartons: number;
  confirmedCartons: number;
  dispatchedCartons: number;
  cancelledCartons: number;
  pendingConfirmationCartons: number;
  pendingDispatchCartons: number;
  totalUnfulfilledCartons: number;

  orderedBase: number;
  confirmedBase: number;
  dispatchedBase: number;
  cancelledBase: number;
  pendingConfirmationBase: number;
  pendingDispatchBase: number;
  totalUnfulfilledBase: number;

  displayOrdered: string;
  displayConfirmed: string;
  displayDispatched: string;
  displayPending: string;

  totalValue: number;
  fulfilledValue: number;
  pendingValue: number;
  computedStatus: OrderComputedStatus;
  statusBadge: { label: string; colorClass: string; bgClass: string; borderClass: string };
}

export function calculateOrderQuantities(order: Order, products: Product[] = []): OrderQuantities {
  let orderedBase = 0;
  let confirmedBase = 0;
  let dispatchedBase = 0;
  let cancelledBase = 0;
  let totalValue = 0;
  let fulfilledValue = 0;
  let pendingValue = 0;

  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const q = calculateItemQuantities(item, prod);
      orderedBase += q.orderedBase;
      confirmedBase += q.confirmedBase;
      dispatchedBase += q.dispatchedBase;
      cancelledBase += q.cancelledBase;
      totalValue += q.totalValue;
      fulfilledValue += q.fulfilledValue;
      pendingValue += q.pendingValue;
    });
  } else {
    totalValue = order.total_amount || 0;
  }

  const activeOrderedBase = Math.max(0, orderedBase - cancelledBase);
  const pendingConfirmationBase = Math.max(0, activeOrderedBase - confirmedBase);
  const pendingDispatchBase = Math.max(0, confirmedBase - dispatchedBase);
  const totalUnfulfilledBase = Math.max(0, activeOrderedBase - dispatchedBase);

  const displayOrdered = `${orderedBase} Pcs`;
  const displayConfirmed = `${confirmedBase} Pcs`;
  const displayDispatched = `${dispatchedBase} Pcs`;
  const displayPending = `${totalUnfulfilledBase} Pcs`;

  let computedStatus: OrderComputedStatus = 'Pending Confirmation';

  if (order.status === 'Cancelled' || (orderedBase > 0 && cancelledBase >= orderedBase)) {
    computedStatus = 'Cancelled';
  } else if (totalUnfulfilledBase === 0 && (dispatchedBase > 0 || order.status === 'Delivered')) {
    computedStatus = 'Completed';
  } else if (dispatchedBase > 0 && dispatchedBase === confirmedBase && pendingConfirmationBase > 0) {
    computedStatus = 'Partially Fulfilled';
  } else if (dispatchedBase > 0 && dispatchedBase < confirmedBase) {
    computedStatus = 'Partially Dispatched';
  } else if (order.status === 'Packed') {
    computedStatus = 'Packed';
  } else if (dispatchedBase === 0 && confirmedBase === activeOrderedBase && activeOrderedBase > 0) {
    computedStatus = 'Confirmed';
  } else if (dispatchedBase === 0 && confirmedBase > 0 && confirmedBase < activeOrderedBase) {
    computedStatus = 'Partially Confirmed';
  } else {
    computedStatus = 'Pending Confirmation';
  }

  let statusBadge: { label: string; colorClass: string; bgClass: string; borderClass: string } = {
    label: computedStatus,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200'
  };

  switch (computedStatus) {
    case 'Pending Confirmation':
      statusBadge = { label: 'Pending Confirmation', colorClass: 'text-amber-800', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' };
      break;
    case 'Partially Confirmed':
      statusBadge = { label: 'Partially Confirmed', colorClass: 'text-blue-800', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' };
      break;
    case 'Confirmed':
      statusBadge = { label: 'Confirmed', colorClass: 'text-indigo-800', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200' };
      break;
    case 'Packed':
      statusBadge = { label: 'Ready to Dispatch (Packed)', colorClass: 'text-purple-800', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' };
      break;
    case 'Partially Dispatched':
      statusBadge = { label: 'Partially Dispatched', colorClass: 'text-indigo-800', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200' };
      break;
    case 'Partially Fulfilled':
      statusBadge = { label: 'Partially Fulfilled', colorClass: 'text-amber-800', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' };
      break;
    case 'Completed':
      statusBadge = { label: 'Completed', colorClass: 'text-emerald-800', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200' };
      break;
    case 'Cancelled':
      statusBadge = { label: 'Cancelled', colorClass: 'text-red-800', bgClass: 'bg-red-50', borderClass: 'border-red-200' };
      break;
  }

  return {
    orderedCartons: orderedBase,
    confirmedCartons: confirmedBase,
    dispatchedCartons: dispatchedBase,
    cancelledCartons: cancelledBase,
    pendingConfirmationCartons: pendingConfirmationBase,
    pendingDispatchCartons: pendingDispatchBase,
    totalUnfulfilledCartons: totalUnfulfilledBase,

    orderedBase,
    confirmedBase,
    dispatchedBase,
    cancelledBase,
    pendingConfirmationBase,
    pendingDispatchBase,
    totalUnfulfilledBase,

    displayOrdered,
    displayConfirmed,
    displayDispatched,
    displayPending,

    totalValue: Math.round(totalValue),
    fulfilledValue: Math.round(fulfilledValue),
    pendingValue: Math.round(pendingValue),
    computedStatus,
    statusBadge
  };
}


export function deriveOrderChannel(order: Order): { code: string; label: OrderChannel; badgeClass: string } {
  // Direct match on approved 4 channels
  if (order.channel === 'Retailer Direct') {
    return { code: 'retailer_direct', label: 'Retailer Direct', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (order.channel === 'Distributor Salesperson') {
    return { code: 'distributor_salesperson', label: 'Distributor Salesperson', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  }
  if (order.channel === 'Company Salesperson') {
    return { code: 'company_salesperson', label: 'Company Salesperson', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
  if (order.channel === 'On Counter Sale') {
    return { code: 'counter_sale', label: 'On Counter Sale', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
  }

  // Legacy/fallback string matching mapped strictly into the 4 approved channels
  if (order.channel) {
    const lower = (order.channel as string).toLowerCase();
    if (lower.includes('company')) {
      return { code: 'company_salesperson', label: 'Company Salesperson', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    if (lower.includes('counter') || lower.includes('pos')) {
      return { code: 'counter_sale', label: 'On Counter Sale', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    if (lower.includes('distributor') || lower.includes('salesperson') || lower.includes('sales')) {
      return { code: 'distributor_salesperson', label: 'Distributor Salesperson', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    return { code: 'retailer_direct', label: 'Retailer Direct', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
  }

  // Fallback to source
  switch (order.source) {
    case 'retailer_direct':
      return { code: 'retailer_direct', label: 'Retailer Direct', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'distributor_salesperson':
      return { code: 'distributor_salesperson', label: 'Distributor Salesperson', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'company_salesperson':
      return { code: 'company_salesperson', label: 'Company Salesperson', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'counter_sale':
      return { code: 'counter_sale', label: 'On Counter Sale', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    default:
      return { code: 'retailer_direct', label: 'Retailer Direct', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
}

// ----------------------------------------------------
// PENDING ITEM / DUPLICATE ORDER WARNING TYPES & HELPERS
// ----------------------------------------------------

export interface PendingOrderRef {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  channel: OrderChannel;
  channelBadgeClass: string;
  orderStatus: OrderComputedStatus;
  orderedCartons: number;
  confirmedCartons: number;
  dispatchedCartons: number;
  cancelledCartons: number;
  remainingCartons: number;
  remainingBase: number;
  displayOrdered: string;
  displayConfirmed: string;
  displayDispatched: string;
  displayPending: string;
  unitPrice: number;
  itemTotalValue: number;
}

export interface PendingOrderItemWarning {
  productId: string;
  productName: string;
  brand: string;
  packSize: string;
  sku: string;
  tradingUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  newOrderCartons: number;
  newOrderLoose: number;
  newOrderBase: number;
  newOrderDisplay: string;
  totalPendingCartons: number;
  totalPendingBase: number;
  totalPendingDisplay: string;
  pendingOrders: PendingOrderRef[];
}

export interface CartItemToCheck {
  productId: string;
  cartonQty?: number;
  looseQty?: number;
  quantity?: number;
  packSize?: string;
  selectedMrp?: number;
  tradingUnit?: string;
  baseUnit?: string;
}

/**
 * Checks if items in a proposed cart/order have unfulfilled (pending) quantities
 * from previous open orders for the exact same retailer and company.
 */
export function getPendingItemsForRetailer(
  retailerId: string,
  orders: Order[] = [],
  products: Product[] = [],
  cartItems: CartItemToCheck[] = [],
  companyId?: string
): PendingOrderItemWarning[] {
  if (!retailerId || !orders || orders.length === 0 || !cartItems || cartItems.length === 0) {
    return [];
  }

  // Filter open orders for this exact retailer and company
  const relevantOrders = orders.filter(ord => {
    if (ord.retailer_id !== retailerId) return false;
    if (companyId && ord.business_id && ord.business_id !== companyId) return false;
    // Exclude completed or fully cancelled orders
    if (ord.status === 'Cancelled' || ord.status === 'Completed' || ord.status === 'Delivered') return false;
    return true;
  });

  if (relevantOrders.length === 0) return [];

  const warnings: PendingOrderItemWarning[] = [];

  // For each item in current cart / new order
  cartItems.forEach(cartItem => {
    const prod = products.find(p => p.id === cartItem.productId);
    if (!prod) return;

    const unitsPerPack = prod.units_per_box_carton || 1;
    const tradingUnit = cartItem.tradingUnit || prod.trading_unit || 'Carton';
    const baseUnit = cartItem.baseUnit || prod.base_unit || 'Unit';

    const newCartons = Number(cartItem.cartonQty || 0);
    const newLoose = Number(cartItem.looseQty || 0);
    let newOrderBase = 0;
    if (cartItem.quantity !== undefined && cartItem.quantity > 0) {
      newOrderBase = cartItem.quantity;
    } else {
      newOrderBase = calculateBaseQuantity(newCartons, newLoose, unitsPerPack);
    }
    if (newOrderBase <= 0 && newCartons <= 0 && newLoose <= 0) return;

    const newOrderDisplay = formatQuantityDisplay(newOrderBase, unitsPerPack, tradingUnit, baseUnit);

    const pendingRefs: PendingOrderRef[] = [];
    let totalPendingBase = 0;
    let totalPendingCartons = 0;

    relevantOrders.forEach(ord => {
      // Find matching items in this order
      const matchingItems = (ord.items || []).filter(ordItem => {
        if (ordItem.product_id !== cartItem.productId) return false;

        // Exact variant / pack_size check
        const ordPack = prod.pack_size;
        const cartPack = cartItem.packSize || prod.pack_size;
        if (ordPack && cartPack && ordPack.trim().toLowerCase() !== cartPack.trim().toLowerCase()) return false;

        // If selected MRP is provided, check compatibility
        if (cartItem.selectedMrp && ordItem.selected_mrp && ordItem.selected_mrp !== cartItem.selectedMrp) {
          return false;
        }

        return true;
      });

      matchingItems.forEach(ordItem => {
        const itemQuantities = calculateItemQuantities(ordItem, prod);
        if (itemQuantities.totalUnfulfilledBase > 0) {
          totalPendingBase += itemQuantities.totalUnfulfilledBase;
          totalPendingCartons += itemQuantities.totalUnfulfilledCartons;

          const channelInfo = deriveOrderChannel(ord);

          pendingRefs.push({
            orderId: ord.id,
            orderNumber: ord.order_number,
            orderDate: ord.order_date || '',
            channel: channelInfo.label,
            channelBadgeClass: channelInfo.badgeClass,
            orderStatus: itemQuantities.totalUnfulfilledCartons === 0 ? 'Completed' : (ord.status as OrderComputedStatus || 'Pending Confirmation'),
            orderedCartons: itemQuantities.orderedCartons,
            confirmedCartons: itemQuantities.confirmedCartons,
            dispatchedCartons: itemQuantities.dispatchedCartons,
            cancelledCartons: itemQuantities.cancelledCartons,
            remainingCartons: itemQuantities.totalUnfulfilledCartons,
            remainingBase: itemQuantities.totalUnfulfilledBase,
            displayOrdered: itemQuantities.displayOrdered,
            displayConfirmed: itemQuantities.displayConfirmed,
            displayDispatched: itemQuantities.displayDispatched,
            displayPending: itemQuantities.displayPending,
            unitPrice: itemQuantities.effectiveRate,
            itemTotalValue: itemQuantities.totalValue
          });
        }
      });
    });

    if (pendingRefs.length > 0 && totalPendingBase > 0) {
      warnings.push({
        productId: prod.id,
        productName: prod.name,
        brand: prod.brand,
        packSize: cartItem.packSize || prod.pack_size,
        sku: prod.sku || prod.product_code,
        tradingUnit,
        baseUnit,
        unitsPerPack,
        newOrderCartons: newCartons,
        newOrderLoose: newLoose,
        newOrderBase,
        newOrderDisplay,
        totalPendingCartons: Math.round(totalPendingCartons * 100) / 100,
        totalPendingBase,
        totalPendingDisplay: formatQuantityDisplay(totalPendingBase, unitsPerPack, tradingUnit, baseUnit),
        pendingOrders: pendingRefs
      });
    }
  });

  return warnings;
}

/**
 * Checks a single proposed item for pending unfulfilled quantity in previous orders.
 */
export function checkSingleItemPendingWarning(
  retailerId: string,
  productId: string,
  orders: Order[] = [],
  products: Product[] = [],
  cartonQty: number = 0,
  looseQty: number = 0,
  packSize?: string,
  selectedMrp?: number,
  companyId?: string
): PendingOrderItemWarning | null {
  const warnings = getPendingItemsForRetailer(
    retailerId,
    orders,
    products,
    [{ productId, cartonQty, looseQty, packSize, selectedMrp }],
    companyId
  );
  return warnings.length > 0 ? warnings[0] : null;
}

// ----------------------------------------------------
// SEED DATA GENERATORS
// ----------------------------------------------------

export const SEED_BUSINESS_COMPANIES: BusinessCompany[] = [
  {
    id: 'biz-saifee',
    name: 'Saifee General Stores',
    legal_name: 'Saifee General Stores Private Limited',
    business_type: 'FMCG Distribution',
    gstin: '27ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    email: 'contact@saifeegeneralstores.com',
    phone: '+91 98200 12345',
    address: 'Shop 1-4, Ground Floor, Saifee Jubilee Market, Bhendi Bazaar, South Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra (27)',
    pincode: '400003',
    currency: 'INR',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'biz-second-trading',
    name: 'Saifee Wholesale & Trading',
    legal_name: 'Saifee Wholesale & Trading Enterprises LLP',
    business_type: 'Wholesale Trading & Distribution',
    gstin: '27XYZAB5678C1Z2',
    pan: 'XYZAB5678C',
    email: 'orders@saifeetrading.com',
    phone: '+91 98199 54321',
    address: 'Plot 45-B, Sector 19, APMC Commodity Market, Vashi, Navi Mumbai',
    city: 'Navi Mumbai',
    state: 'Maharashtra (27)',
    pincode: '400705',
    currency: 'INR',
    is_active: true,
    created_at: '2026-02-15T00:00:00.000Z',
    updated_at: '2026-02-15T00:00:00.000Z'
  }
];

export const SEED_COMPANY_MEMBERS: CompanyMember[] = [
  { id: 'mem-1', business_id: 'biz-saifee', user_id: 'p-admin-1', role: 'owner', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-2', business_id: 'biz-second-trading', user_id: 'p-admin-1', role: 'owner', created_at: '2026-02-15T00:00:00.000Z' },
  { id: 'mem-3', business_id: 'biz-saifee', user_id: 'p-dist-sales-1', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-4', business_id: 'biz-saifee', user_id: 'p-dist-sales-2', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-5', business_id: 'biz-saifee', user_id: 'p-dist-sales-3', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-6', business_id: 'biz-saifee', user_id: 'p-co-sales-1', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-8', business_id: 'biz-second-trading', user_id: 'p-dist-sales-1', role: 'staff', created_at: '2026-02-15T00:00:00.000Z' },
  { id: 'mem-ret-1', business_id: 'biz-saifee', user_id: 'p-retailer-ganesh', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-ret-2', business_id: 'biz-saifee', user_id: 'p-retailer-om', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-ret-3', business_id: 'biz-saifee', user_id: 'p-retailer-gupta', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-ret-4', business_id: 'biz-saifee', user_id: 'p-retailer-apna', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mem-ret-5', business_id: 'biz-saifee', user_id: 'p-retailer-laxmi', role: 'staff', created_at: '2026-01-01T00:00:00.000Z' }
];

const SEED_COMPANIES: Company[] = [
  { id: 'c-parle', name: 'Parle', code: 'PARLE', active: true },
  { id: 'c-britannia', name: 'Britannia Industries', code: 'BRITANNIA', active: true },
  { id: 'c-itc', name: 'ITC Limited', code: 'ITC', active: true },
  { id: 'c-hul', name: 'Hindustan Unilever (HUL)', code: 'HUL', active: true },
  { id: 'c-nestle', name: 'Nestlé India', code: 'NESTLE', active: true },
  { id: 'c-pepsico', name: 'PepsiCo India', code: 'PEPSICO', active: true },
  { id: 'c-cocacola', name: 'Coca-Cola India', code: 'COCACOLA', active: true },
  { id: 'c-tata', name: 'Tata Consumer Products', code: 'TATA', active: true },
  { id: 'c-dabur', name: 'Dabur India', code: 'DABUR', active: true },
  { id: 'c-colgate', name: 'Colgate-Palmolive', code: 'COLGATE', active: true }
];

const SEED_SUPPLIERS: Supplier[] = [
  { id: 's-prashant-medico', name: 'Prashant Medico', gstin: '27PRASH1234M1Z5', address: 'Shop 1, Main Road, Station Area, Indore, MP', active: true, business_id: 'biz-saifee' },
  { id: 's-johnson-aadesh', name: 'Johnson Aadesh Enterprises', gstin: '27JOHNA5678E1Z2', address: 'Shop 12, Commercial Complex, Wholesale Hub, Indore, MP', active: true, business_id: 'biz-saifee' }
];

const SEED_RETAILERS: Retailer[] = [
  { id: 'ret-shree-ganesh', retailer_code: 'RET-00101', shop_name: 'Shree Ganesh Super Market', owner_name: 'Ganesh Patel', address: 'Shop 45, MG Road, Central Market', city: 'Indore', state_code: '27', gstin: '23AABCG1234F1Z1', mobile: '9826110001', credit_limit: 150000, outstanding: 0, active: true, business_id: 'biz-saifee' },
  { id: 'ret-om-kirana', retailer_code: 'RET-00102', shop_name: 'Om Kirana & General Store', owner_name: 'Om Prakash Gupta', address: '12, Jail Road, Near Tower', city: 'Indore', state_code: '27', gstin: '23BCOPK5678M1Z2', mobile: '9826220002', credit_limit: 100000, outstanding: 0, active: true, business_id: 'biz-saifee' },
  { id: 'ret-gupta-provision', retailer_code: 'RET-00103', shop_name: 'Gupta Provision Store', owner_name: 'Ramesh Gupta', address: '78, Malwa Mill Chauraha', city: 'Indore', state_code: '27', gstin: '23CGUPR9012N1Z3', mobile: '9826330003', credit_limit: 120000, outstanding: 0, active: true, business_id: 'biz-saifee' },
  { id: 'ret-apna-bazaar', retailer_code: 'RET-00104', shop_name: 'Apna Bazaar Mart', owner_name: 'Sunil Jain', address: '102, Scheme 54, Vijay Nagar', city: 'Indore', state_code: '27', gstin: '23DSUNJ3456P1Z4', mobile: '9826440004', credit_limit: 200000, outstanding: 0, active: true, business_id: 'biz-saifee' },
  { id: 'ret-laxmi-traders', retailer_code: 'RET-00105', shop_name: 'Laxmi Trading & Daily Needs', owner_name: 'Mahesh Sharma', address: '24, Rajwada Main Bazaar', city: 'Indore', state_code: '27', gstin: '23EMSHR7890Q1Z5', mobile: '9826550005', credit_limit: 180000, outstanding: 0, active: true, business_id: 'biz-saifee' }
];

const SEED_PROFILES: Profile[] = [
  { id: 'p-admin-1', email: 'admin@saifee.com', name: 'Saifee Admin Manager', role: 'admin', active: true },
  { id: 'p-dist-sales-1', email: 'rajesh.sales@saifee.com', name: 'Rajesh Kumar (Distributor Sales)', role: 'sales_dist', active: true },
  { id: 'p-dist-sales-2', email: 'amit.sales@saifee.com', name: 'Amit Sharma (Distributor Sales)', role: 'sales_dist', active: true },
  { id: 'p-dist-sales-3', email: 'rahul.sales@saifee.com', name: 'Rahul Verma (Distributor Sales)', role: 'sales_dist', active: true },
  { id: 'p-co-sales-1', email: 'suresh.parle@parle.com', name: 'Suresh N. (Parle Salesperson)', role: 'sales_co', company_id: 'c-parle', active: true },
  { id: 'p-co-sales-2', email: 'anil.britannia@britannia.com', name: 'Anil K. (Britannia Salesperson)', role: 'sales_co', company_id: 'c-britannia', active: true },
  { id: 'p-co-sales-3', email: 'vikas.hul@hul.com', name: 'Vikas J. (HUL Salesperson)', role: 'sales_co', company_id: 'c-hul', active: true },
  { id: 'p-retailer-ganesh', email: 'ganesh.supermarket@gmail.com', name: 'Ganesh Patel (Shree Ganesh Super Market)', role: 'retailer', retailer_id: 'ret-shree-ganesh', active: true },
  { id: 'p-retailer-om', email: 'om.kirana.indore@gmail.com', name: 'Om Prakash (Om Kirana & General Store)', role: 'retailer', retailer_id: 'ret-om-kirana', active: true },
  { id: 'p-retailer-gupta', email: 'gupta.provisions@gmail.com', name: 'Ramesh Gupta (Gupta Provision Store)', role: 'retailer', retailer_id: 'ret-gupta-provision', active: true },
  { id: 'p-retailer-apna', email: 'apna.bazaar.indore@gmail.com', name: 'Sunil Jain (Apna Bazaar Mart)', role: 'retailer', retailer_id: 'ret-apna-bazaar', active: true },
  { id: 'p-retailer-laxmi', email: 'laxmi.dailyneeds@gmail.com', name: 'Mahesh Sharma (Laxmi Trading)', role: 'retailer', retailer_id: 'ret-laxmi-traders', active: true },
  { id: 'p-staff-packer-1', email: 'ramesh.packer@saifee.local', name: 'Ramesh Solanki', full_name: 'Ramesh Solanki', mobile: '9826660001', contact_no: '9826660001', role: 'staff', profile_type: 'STAFF', custom_role: 'Packer', active: true, status: 'ACTIVE' },
  { id: 'p-staff-biller-1', email: 'deepak.biller@saifee.local', name: 'Deepak Sharma', full_name: 'Deepak Sharma', mobile: '9826770002', contact_no: '9826770002', role: 'staff', profile_type: 'STAFF', custom_role: 'Biller', active: true, status: 'ACTIVE' },
  { id: 'p-staff-loader-1', email: 'mukesh.loader@saifee.local', name: 'Mukesh Yadav', full_name: 'Mukesh Yadav', mobile: '9826880003', contact_no: '9826880003', role: 'staff', profile_type: 'STAFF', custom_role: 'Tempo Loader', active: true, status: 'ACTIVE' }
];

// Clean FMCG Master Categories (Retained for live catalog entry)
const SEED_CATEGORIES: Category[] = [
  ...SEED_COMPANIES.map(c => ({
    id: `cat-${c.id}`,
    name: c.name,
    description: `Products manufactured and distributed by ${c.name}`,
    active: true,
    business_id: 'biz-saifee',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  })),
  { id: 'cat-biscuits', name: 'Biscuits', description: 'Biscuits, cookies, and rusks', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-snacks', name: 'Snacks', description: 'Namkeen, chips, wafers, and confectionery', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-beverages', name: 'Beverages', description: 'Tea, coffee, soft drinks, juices, and syrups', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-personal-care', name: 'Personal Care', description: 'Soaps, shampoos, oral care, and cosmetics', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-household-care', name: 'Household Care', description: 'Detergents, dishwash, cleaners, and fabric care', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-staples', name: 'Staples', description: 'Atta, salt, spices, pulses, and commodities', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-packaged-foods', name: 'Packaged Foods', description: 'Noodles, pasta, sauces, jams, and ready meals', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-health-wellness', name: 'Health & Wellness', description: 'Health supplements, ayurvedic, and nutritional items', active: true, business_id: 'biz-saifee', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-trad-grains', name: 'Grains & Rice', description: 'Wholesale rice and food grains', active: true, business_id: 'biz-second-trading', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-trad-sugar', name: 'Sugar & Sweeteners', description: 'Bulk refined sugar and jaggery', active: true, business_id: 'biz-second-trading', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-trad-oils', name: 'Edible Oils', description: 'Bulk edible oils and ghee', active: true, business_id: 'biz-second-trading', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }
];

// Clean Purged Datasets (Zero demo items, ready for live wholesale FMCG data entry)
const SEED_PRODUCTS: Product[] = [];
const SEED_PRODUCT_CATEGORIES: ProductCategory[] = [];

export const SEED_GODOWNS: Godown[] = [
  {
    id: 'gdn-saifee-main',
    company_id: 'biz-saifee',
    name: 'Main Godown',
    code: 'GD01',
    address: '124, M.G. Road, Wholesale Market',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    manager_name: 'Murtaza Saifee',
    phone: '+91 98260 12345',
    is_default: true,
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'gdn-saifee-secondary',
    company_id: 'biz-saifee',
    name: 'Secondary Godown',
    code: 'GD02',
    address: 'Plot 45, Sector B, Sanwer Road Industrial Area',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452015',
    manager_name: 'Huzefa Saifee',
    phone: '+91 98260 67890',
    is_default: false,
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'gdn-hub-a',
    company_id: 'biz-dist-hub',
    name: 'Godown A (Central Hub)',
    code: 'GD01',
    address: 'Bhiwandi Logistics Park, Unit 12',
    city: 'Bhiwandi',
    state: 'Maharashtra',
    pincode: '421302',
    manager_name: 'Logistics Manager',
    phone: '+91 98190 11223',
    is_default: true,
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'gdn-hub-b',
    company_id: 'biz-dist-hub',
    name: 'Godown B (Express Bay)',
    code: 'GD02',
    address: 'Vashi APMC Market, Sector 19',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400703',
    manager_name: 'Operations Lead',
    phone: '+91 98190 44556',
    is_default: false,
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z'
  }
];

export const SEED_STOCK_TRANSFERS: StockTransfer[] = [];
const SEED_INVENTORY: Inventory[] = [];
const SEED_BATCHES: InventoryBatch[] = [];
const SEED_LEDGER: StockLedgerEntry[] = [];
const SEED_ORDERS: Order[] = [];
const SEED_FULFILMENTS: Fulfilment[] = [];

const SEED_INVOICES: Invoice[] = [];

const SEED_DELIVERY_CHALLANS: DeliveryChallan[] = [];
const SEED_PURCHASES: Purchase[] = [];
const SEED_PAYMENTS: Payment[] = [];
const SEED_SALES_RETURNS: SalesReturn[] = [];

const SEED_COMPANY_OPENING_BALANCES: CompanyOpeningBalance[] = [
  {
    company_id: 'biz-saifee',
    opening_balance: 0,
    as_of_date: '2026-04-01',
    mode_balances: {
      'Cash': 0,
      'UPI': 0,
      'Bank Transfer': 0,
      'Cheque': 0,
      'Other': 0
    },
    updated_by: 'Admin',
    updated_at: '2026-04-01T00:00:00.000Z'
  },
  {
    company_id: 'biz-second-trading',
    opening_balance: 0,
    as_of_date: '2026-04-01',
    mode_balances: {
      'Cash': 0,
      'UPI': 0,
      'Bank Transfer': 0,
      'Cheque': 0,
      'Other': 0
    },
    updated_by: 'Admin',
    updated_at: '2026-04-01T00:00:00.000Z'
  }
];

const SEED_CASH_FLOW_TRANSACTIONS: CashFlowTransaction[] = [];
const SEED_RATE_AUDIT_LOGS: BillingRateAuditLog[] = [];
const SEED_ITEM_ACTIVITY_LOGS: ItemActivityLog[] = [];

// ----------------------------------------------------
// LOCAL DB STORE INTERFACE
// ----------------------------------------------------

class FMCGDatabase {
  private memoryStore: Record<string, any> = {};

  constructor() {
    // Constructor initializes cleanly. Real user products, inventory, and purchases are preserved in localStorage.
    if (typeof window !== 'undefined') {
      this.cleanOldStorage();
    }
  }

  private cleanOldStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const legacyKeys = [
        'fmcg_demo_data_purged_clean_v1',
        'fmcg_stock_100_ctn_applied_v1',
        'fmcg_stock_auto_restock_applied_v1'
      ];
      legacyKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      // Remove wrongly classified suppliers from retailer store in localStorage
      const rawRetailers = localStorage.getItem('fmcg_retailers_v4') || localStorage.getItem('fmcg_retailers');
      if (rawRetailers) {
        try {
          const parsed = JSON.parse(rawRetailers);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((r: any) => 
              r.id !== 'ret-prashant-medico' && 
              r.id !== 'ret-johnson-aadesh' &&
              r.id !== 'ret-prashant-medico-trd' &&
              r.id !== 'ret-johnson-aadesh-trd' &&
              !r.shop_name?.toLowerCase().includes('prashant medico') &&
              !r.shop_name?.toLowerCase().includes('johnson aadesh')
            );
            if (filtered.length !== parsed.length) {
              localStorage.setItem('fmcg_retailers_v4', JSON.stringify(filtered));
              localStorage.setItem('fmcg_retailers', JSON.stringify(filtered));
            }
          }
        } catch {}
      }

      // Also clean stale retailer profiles
      const rawProfiles = localStorage.getItem('fmcg_profiles_v4') || localStorage.getItem('fmcg_profiles');
      if (rawProfiles) {
        try {
          const parsed = JSON.parse(rawProfiles);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((p: any) => 
              p.id !== 'p-retailer-1' && 
              p.id !== 'p-retailer-2' &&
              p.retailer_id !== 'ret-prashant-medico' &&
              p.retailer_id !== 'ret-johnson-aadesh'
            );
            if (filtered.length !== parsed.length) {
              localStorage.setItem('fmcg_profiles_v4', JSON.stringify(filtered));
              localStorage.setItem('fmcg_profiles', JSON.stringify(filtered));
            }
          }
        } catch {}
      }
    } catch {}
  }

  /**
   * Complete clean purge of all demo products, inventory batches, ledger logs, purchases, test orders, invoices, and payment/return records,
   * retaining Prashant Medico and Johnson Aadesh Enterprises strictly as Suppliers.
   */
  public purgeAllDemoProductsAndInventory(): void {
    // 1. Reset products and product categories to empty
    this.saveStore('fmcg_products', []);
    this.saveStore('fmcg_product_categories', []);

    // 2. Reset inventory, batches, stock transfers, and stock ledger to empty
    this.saveStore('fmcg_inventory', []);
    this.saveStore('fmcg_batches', []);
    this.saveStore('fmcg_stock_ledger', []);
    this.saveStore('fmcg_stock_transfers', []);

    // 3. Reset demo orders, fulfilments, invoices, delivery challans, purchases, payments, returns
    this.saveStore('fmcg_orders', []);
    this.saveStore('fmcg_fulfilments', []);
    this.saveStore('fmcg_invoices', []);
    this.saveStore('fmcg_delivery_challans', []);
    this.saveStore('fmcg_purchases', []);
    this.saveStore('fmcg_payments', []);
    this.saveStore('fmcg_sales_returns', []);

    // 4. Reset logs and audit history
    this.saveStore('fmcg_billing_rate_audits', []);
    this.saveStore('fmcg_item_activity_logs', []);
    this.saveStore('fmcg_invoice_audits', []);
    this.saveStore('fmcg_cash_flow', []);

    // 5. Reset purchasers / retailers to empty
    this.saveStore('fmcg_retailers', SEED_RETAILERS);

    // 6. Reset suppliers to Prashant Medico and Johnson Aadesh Enterprises
    this.saveStore('fmcg_suppliers', SEED_SUPPLIERS);

    // 7. Reset profiles
    this.saveStore('fmcg_profiles', SEED_PROFILES);

    // 8. Reset opening balances to zero initial state
    this.saveStore('fmcg_company_opening_balances', SEED_COMPANY_OPENING_BALANCES);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('fmcg_purchasers_purged_clean_v3', 'true');
        localStorage.removeItem('fmcg_demo_data_purged_clean_v1');
        localStorage.removeItem('fmcg_stock_100_ctn_applied_v1');
      } catch {}
    }
  }

  private getTombstones(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('fmcg_tombstones_v4');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set();
  }

  private recordTombstone(entityType: string, id: string): void {
    if (typeof window === 'undefined') return;
    try {
      const tombstones = this.getTombstones();
      tombstones.add(id);
      tombstones.add(`${entityType}:${id}`);
      localStorage.setItem('fmcg_tombstones_v4', JSON.stringify(Array.from(tombstones)));
    } catch {}
  }

  private getStore<T>(key: string, defaultValue: T[]): T[] {
    const vKey = `${key}_v4`;
    if (this.memoryStore[vKey]) {
      return Array.isArray(this.memoryStore[vKey]) 
        ? ([...(this.memoryStore[vKey] as T[])]) 
        : (this.memoryStore[vKey] as T[]);
    }
    if (typeof window === 'undefined') {
      this.memoryStore[vKey] = [...defaultValue];
      return [...defaultValue];
    }
    try {
      const data = localStorage.getItem(vKey);
      const tombstones = this.getTombstones();

      if (!data) {
        // First run on clean device: filter out any tombstones from defaultValue
        const initialFiltered = defaultValue.filter((it: any) => !it || !it.id || !tombstones.has(it.id));
        this.memoryStore[vKey] = [...initialFiltered];
        try {
          localStorage.setItem(vKey, JSON.stringify(initialFiltered));
        } catch {
          this.cleanOldStorage();
        }
        return [...initialFiltered];
      }
      const parsed = JSON.parse(data);
      let items: any[] = Array.isArray(parsed) ? parsed : [parsed];
      let needsResave = false;

      // Filter out any tombstoned/deleted entities
      if (tombstones.size > 0) {
        const preLen = items.length;
        items = items.filter((it: any) => !it || !it.id || !tombstones.has(it.id));
        if (items.length !== preLen) {
          needsResave = true;
        }
      }

      // Auto-assign correct business_id to items if missing (without resurrecting deleted items)
      if (
        key !== 'fmcg_profiles' && 
        key !== 'fmcg_companies' && 
        key !== 'fmcg_business_companies' && 
        key !== 'fmcg_company_members'
      ) {
        items = items.map(item => {
          if (item && typeof item === 'object') {
            // Strictly enforce secondary business assignment for second trading items
            if (
              item.id === 'prd-trad-basmati-50kg' ||
              item.id === 'prd-trad-sugar-m30' ||
              item.id === 'prd-trad-oil-15l' ||
              item.id?.startsWith('prd-trad-') ||
              item.id?.startsWith('ret-trad-') ||
              item.id?.startsWith('cat-trad-') ||
              item.id === 's-trad-commodities'
            ) {
              if (item.business_id !== 'biz-second-trading') {
                needsResave = true;
                return { ...item, business_id: 'biz-second-trading' };
              }
              return item;
            }

            if (!item.business_id) {
              needsResave = true;
              return { ...item, business_id: 'biz-saifee' };
            }
          }
          return item;
        });
      }

      // Filter out supplier duplicates if they exist in retailers or profiles
      if (key === 'fmcg_retailers') {
        const preLen = items.length;
        items = items.filter((r: any) => 
          r.id !== 'ret-prashant-medico' && 
          r.id !== 'ret-johnson-aadesh' &&
          r.id !== 'ret-prashant-medico-trd' &&
          r.id !== 'ret-johnson-aadesh-trd' &&
          !r.shop_name?.toLowerCase().includes('prashant medico') &&
          !r.shop_name?.toLowerCase().includes('johnson aadesh')
        );
        if (items.length !== preLen) {
          needsResave = true;
        }
      } else if (key === 'fmcg_profiles') {
        const preLen = items.length;
        items = items.filter((p: any) => 
          p.id !== 'p-retailer-1' && 
          p.id !== 'p-retailer-2' &&
          p.retailer_id !== 'ret-prashant-medico' &&
          p.retailer_id !== 'ret-johnson-aadesh'
        );
        if (items.length !== preLen) {
          needsResave = true;
        }
      }

      if (needsResave) {
        try { localStorage.setItem(vKey, JSON.stringify(items)); } catch {}
      }

      this.memoryStore[vKey] = Array.isArray(items) ? [...items] : items;
      return Array.isArray(items) ? ([...items] as T[]) : (items as T[]);
    } catch {
      this.memoryStore[vKey] = [...defaultValue];
      return [...defaultValue];
    }
  }

  private saveStore<T>(key: string, data: T[]): void {
    const vKey = `${key}_v4`;
    this.memoryStore[vKey] = Array.isArray(data) ? [...data] : data;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(vKey, JSON.stringify(data));
    } catch (e) {
      console.warn(`[FMCGDatabase] Storage quota reached for ${vKey}. Purging legacy storage and trimming...`);
      this.cleanOldStorage();
      try {
        localStorage.setItem(vKey, JSON.stringify(data));
      } catch (innerErr) {
        console.warn(`[FMCGDatabase] Could not persist ${vKey} to localStorage. Retaining in memory.`);
      }
    }
  }

  // SSR & Hydration safe Initial State Getters
  getInitialCurrentUser(): Profile { return SEED_PROFILES[0]; }
  getInitialProfiles(): Profile[] { return SEED_PROFILES; }
  getInitialBusinessCompanies(): BusinessCompany[] { return SEED_BUSINESS_COMPANIES; }
  getInitialActiveBusinessCompanyId(): string { return 'biz-saifee'; }
  getInitialCompanyMembers(): CompanyMember[] { return SEED_COMPANY_MEMBERS; }
  getInitialGodowns(): Godown[] { return SEED_GODOWNS.filter(g => (g.company_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialCompanies(): Company[] { return SEED_COMPANIES; }
  getInitialSuppliers(): Supplier[] { return SEED_SUPPLIERS.filter(s => (s.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialRetailers(): Retailer[] { return SEED_RETAILERS.filter(r => (r.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialProducts(): Product[] { return SEED_PRODUCTS.filter(p => (p.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialCategories(): Category[] { return SEED_CATEGORIES.filter(c => (c.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialProductCategories(): ProductCategory[] { return SEED_PRODUCT_CATEGORIES.filter(pc => (pc.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialInventory(): Inventory[] { return SEED_INVENTORY.filter(i => (i.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialBatches(): InventoryBatch[] { return SEED_BATCHES.filter(b => (b.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialLedger(): StockLedgerEntry[] { return SEED_LEDGER.filter(l => (l.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialStockTransfers(): StockTransfer[] { return SEED_STOCK_TRANSFERS.filter(st => (st.company_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialOrders(): Order[] { return SEED_ORDERS.filter(o => (o.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialFulfilments(): Fulfilment[] { return SEED_FULFILMENTS.filter(f => (f.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialInvoices(): Invoice[] { return SEED_INVOICES.filter(i => (i.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialDeliveryChallans(): DeliveryChallan[] { return SEED_DELIVERY_CHALLANS.filter(dc => (dc.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialPurchases(): Purchase[] { return SEED_PURCHASES.filter(p => (p.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialPayments(): Payment[] { return SEED_PAYMENTS.filter(p => (p.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialSalesReturns(): SalesReturn[] { return SEED_SALES_RETURNS.filter(sr => (sr.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialAuditLogs(): BillingRateAuditLog[] { return SEED_RATE_AUDIT_LOGS.filter(al => (al.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialItemActivityLogs(): ItemActivityLog[] { return SEED_ITEM_ACTIVITY_LOGS.filter(ial => (ial.business_id || 'biz-saifee') === 'biz-saifee'); }
  getInitialInvoiceAuditLogs(): InvoiceAuditLog[] { return []; }

  // ----------------------------------------------------
  // MULTI-BUSINESS / MULTI-COMPANY TENANT STATE & METHODS
  // ----------------------------------------------------
  private activeBusinessCompanyId: string = 'biz-saifee';

  getActiveBusinessCompanyId(): string {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('fmcg_active_business_id');
        if (saved) {
          const companies = this.getBusinessCompanies();
          if (companies.some(c => c.id === saved && c.is_active !== false)) {
            this.activeBusinessCompanyId = saved;
            return saved;
          }
        }
      } catch {}
    }
    return this.activeBusinessCompanyId || 'biz-saifee';
  }

  setActiveBusinessCompanyId(id: string): void {
    this.activeBusinessCompanyId = id;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('fmcg_active_business_id', id);
      } catch {}
    }
  }

  getBusinessCompanies(): BusinessCompany[] {
    return this.getStore<BusinessCompany>('fmcg_business_companies', SEED_BUSINESS_COMPANIES);
  }

  saveBusinessCompanies(companies: BusinessCompany[]): void {
    this.saveStore('fmcg_business_companies', companies);
  }

  getActiveBusinessCompany(): BusinessCompany {
    const companies = this.getBusinessCompanies();
    const activeId = this.getActiveBusinessCompanyId();
    return companies.find(c => c.id === activeId) || companies[0] || SEED_BUSINESS_COMPANIES[0];
  }

  createBusinessCompany(data: {
    name: string;
    business_type?: string;
    legal_name?: string;
    gstin?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state_code?: string;
    pincode?: string;
    currency?: string;
    is_default?: boolean;
  }): BusinessCompany {
    const companies = this.getBusinessCompanies();
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('Business Company name is required');

    const newCompany: BusinessCompany = {
      id: `biz-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now().toString()}`,
      name: cleanName,
      business_type: data.business_type || 'General Trading',
      legal_name: data.legal_name || cleanName,
      gstin: data.gstin?.trim()?.toUpperCase(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      address: data.address?.trim(),
      city: data.city?.trim() || 'Mumbai',
      state_code: data.state_code?.trim() || '27',
      pincode: data.pincode?.trim(),
      currency: data.currency || 'INR',
      is_active: true,
      is_default: Boolean(data.is_default),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add company member for the current user
    const members = this.getCompanyMembers();
    members.push({
      id: `cm-${Date.now()}`,
      business_id: newCompany.id,
      user_id: this.currentUserId,
      role: 'owner',
      created_at: new Date().toISOString()
    });
    this.saveCompanyMembers(members);

    companies.push(newCompany);
    this.saveBusinessCompanies(companies);
    return newCompany;
  }

  updateBusinessCompany(id: string, updates: Partial<BusinessCompany>): BusinessCompany | null {
    const companies = this.getBusinessCompanies();
    const idx = companies.findIndex(c => c.id === id);
    if (idx === -1) return null;
    companies[idx] = {
      ...companies[idx],
      ...updates,
      id: companies[idx].id,
      updated_at: new Date().toISOString()
    };
    this.saveBusinessCompanies(companies);
    return companies[idx];
  }

  getCompanyMembers(): CompanyMember[] {
    return this.getStore<CompanyMember>('fmcg_company_members', SEED_COMPANY_MEMBERS);
  }

  saveCompanyMembers(members: CompanyMember[]): void {
    this.saveStore('fmcg_company_members', members);
  }

  getUserAuthorizedBusinesses(userId?: string): BusinessCompany[] {
    const uId = userId || this.currentUserId;
    const allCompanies = this.getBusinessCompanies().filter(c => c.is_active !== false);
    const members = this.getCompanyMembers();
    const user = this.getCurrentUser();
    if (user.role === 'admin' || uId === 'p-admin-1') {
      return allCompanies;
    }
    const userBizIds = new Set(members.filter(m => m.user_id === uId).map(m => m.business_id));
    const filtered = allCompanies.filter(c => userBizIds.has(c.id));
    return filtered.length > 0 ? filtered : allCompanies;
  }

  // Active User session in Mock DB (Defaults to Admin for easy initial testing)
  private currentUserId = 'p-admin-1';

  getCurrentUser(): Profile {
    const users = this.getProfiles();
    return users.find(u => u.id === this.currentUserId) || users[0];
  }

  setCurrentUser(id: string): void {
    this.currentUserId = id;
  }

  getProfiles(): Profile[] {
    return this.getStore<Profile>('fmcg_profiles', SEED_PROFILES);
  }

  saveProfiles(profiles: Profile[]): void {
    this.saveStore('fmcg_profiles', profiles);
  }

  updateProfile(id: string, updates: Partial<Profile>): Profile | null {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;
    profiles[idx] = { ...profiles[idx], ...updates, updated_at: new Date().toISOString() };
    this.saveProfiles(profiles);
    return profiles[idx];
  }

  createSalespersonProfile(data: {
    name: string;
    mobile: string;
    password: string;
    role: 'sales_dist' | 'sales_co';
    assigned_company_ids?: string[];
    assigned_category_ids?: string[];
    email?: string;
  }): Profile {
    const name = (data.name || '').trim();
    const mobile = (data.mobile || '').trim();
    const password = (data.password || '').trim();
    const role = data.role;
    const assigned_company_ids = Array.isArray(data.assigned_company_ids) ? data.assigned_company_ids : [];
    const assigned_category_ids = Array.isArray(data.assigned_category_ids) ? data.assigned_category_ids : [];

    if (!name) throw new Error('Salesperson full name is required');
    if (!mobile || !/^\d{10}$/.test(mobile.replace(/\D/g, ''))) {
      throw new Error('A valid 10-digit mobile number is required');
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (role !== 'sales_dist' && role !== 'sales_co') {
      throw new Error('Valid salesperson type (Distributor or Company) is required');
    }

    if (role === 'sales_co') {
      if (assigned_company_ids.length === 0) {
        throw new Error('Please select at least one Company / Manufacturer for Company Salesperson');
      }
      if (assigned_category_ids.length === 0) {
        throw new Error('Please select at least one Category for Company Salesperson');
      }
    }

    const profiles = this.getProfiles();
    const existing = profiles.find(p => p.mobile === cleanMobile && p.role === role);
    if (existing) {
      throw new Error(`A salesperson profile with mobile number ${cleanMobile} already exists`);
    }

    const newId = `p-sales-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const email = data.email?.trim() || `${cleanMobile}@sales.saifee.local`;

    const newProfile: Profile = {
      id: newId,
      email,
      name,
      mobile: cleanMobile,
      password,
      role,
      active: true,
      category_access_mode: role === 'sales_co' ? 'custom' : 'all',
      company_id: role === 'sales_co' && assigned_company_ids.length > 0 ? assigned_company_ids[0] : undefined,
      assigned_company_ids: role === 'sales_co' ? assigned_company_ids : [],
      assigned_category_ids: role === 'sales_co' ? assigned_category_ids : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    profiles.unshift(newProfile);
    this.saveProfiles(profiles);
    return newProfile;
  }

  createRetailerProfile(data: {
    shop_name: string;
    owner_name: string;
    mobile: string;
    address: string;
    password: string;
    city?: string;
    state_code?: string;
    gstin?: string;
    credit_limit?: number;
    email?: string;
  }): { retailer: Retailer; profile: Profile } {
    const shop_name = (data.shop_name || '').trim();
    const owner_name = (data.owner_name || '').trim();
    const mobile = (data.mobile || '').trim();
    const address = (data.address || '').trim();
    const password = (data.password || '').trim();

    if (!shop_name) throw new Error('Shop Name is required');
    if (!owner_name) throw new Error('Owner Name is required');
    if (!mobile || !/^\d{10}$/.test(mobile.replace(/\D/g, ''))) {
      throw new Error('A valid 10-digit mobile contact number is required');
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!address) throw new Error('Shop Address is required');
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Create the retailer entity
    const retailer = this.createRetailer({
      shop_name,
      owner_name,
      mobile: cleanMobile,
      address,
      city: data.city || 'Indore',
      state_code: data.state_code || '27',
      gstin: data.gstin,
      credit_limit: data.credit_limit || 50000,
      active: true,
      category_access_mode: 'all',
      assigned_category_ids: []
    });

    // Also attach password & timestamps to retailer record
    retailer.password = password;
    retailer.created_at = new Date().toISOString();
    retailer.updated_at = new Date().toISOString();
    this.updateRetailer(retailer.id, { password, updated_at: new Date().toISOString() });

    // Create auth profile for Retailer PWA access
    const profiles = this.getProfiles();
    const profileId = `p-ret-${retailer.id}`;
    const email = data.email?.trim() || `${cleanMobile}@retailer.saifee.local`;

    const newProfile: Profile = {
      id: profileId,
      email,
      name: `${owner_name} (${shop_name})`,
      mobile: cleanMobile,
      password,
      role: 'retailer',
      retailer_id: retailer.id,
      active: true,
      category_access_mode: 'all',
      assigned_category_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    profiles.unshift(newProfile);
    this.saveProfiles(profiles);

    return { retailer, profile: newProfile };
  }

  createStaffProfile(data: {
    full_name: string;
    contact_no: string;
    password: string;
    custom_role: string;
    email?: string;
  }): Profile {
    const full_name = (data.full_name || '').trim();
    const contact_no = (data.contact_no || '').trim();
    const password = (data.password || '').trim();
    const custom_role = (data.custom_role || '').trim();

    if (!full_name) throw new Error('Full Name is required');
    if (!contact_no || !/^\d{10}$/.test(contact_no.replace(/\D/g, ''))) {
      throw new Error('A valid 10-digit mobile contact number is required');
    }
    const cleanMobile = contact_no.replace(/\D/g, '');
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (!custom_role) {
      throw new Error('Job Role / Designation is required');
    }

    const profiles = this.getProfiles();
    const existing = profiles.find(p => p.mobile === cleanMobile && p.role === 'staff');
    if (existing) {
      throw new Error(`A staff profile with contact number ${cleanMobile} already exists`);
    }

    const newId = `p-staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const email = data.email?.trim() || `${cleanMobile}@staff.saifee.local`;

    const newProfile: Profile = {
      id: newId,
      email,
      name: full_name,
      full_name,
      mobile: cleanMobile,
      contact_no: cleanMobile,
      password,
      password_hash: password,
      role: 'staff',
      profile_type: 'STAFF',
      custom_role,
      active: true,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    profiles.unshift(newProfile);
    this.saveProfiles(profiles);
    return newProfile;
  }

  updateStaffProfile(id: string, updates: {
    full_name?: string;
    name?: string;
    contact_no?: string;
    mobile?: string;
    password?: string;
    custom_role?: string;
    active?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
  }): Profile | null {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const current = profiles[idx];
    const full_name = updates.full_name !== undefined ? updates.full_name.trim() : (updates.name !== undefined ? updates.name.trim() : (current.full_name || current.name));
    const cleanMobile = updates.contact_no !== undefined ? updates.contact_no.trim().replace(/\D/g, '') : (updates.mobile !== undefined ? updates.mobile.trim().replace(/\D/g, '') : (current.mobile || ''));
    const custom_role = updates.custom_role !== undefined ? updates.custom_role.trim() : (current.custom_role || 'Staff');
    const active = updates.active !== undefined ? Boolean(updates.active) : (updates.status !== undefined ? updates.status === 'ACTIVE' : current.active);

    const updated: Profile = {
      ...current,
      name: full_name,
      full_name,
      mobile: cleanMobile,
      contact_no: cleanMobile,
      custom_role,
      active,
      status: active ? 'ACTIVE' : 'INACTIVE',
      password: updates.password !== undefined && updates.password.trim().length >= 6 ? updates.password.trim() : current.password,
      updated_at: new Date().toISOString()
    };

    profiles[idx] = updated;
    this.saveProfiles(profiles);
    return updated;
  }

  updateSalespersonProfile(id: string, updates: {
    name?: string;
    mobile?: string;
    password?: string;
    role?: 'sales_dist' | 'sales_co';
    assigned_company_ids?: string[];
    assigned_category_ids?: string[];
    active?: boolean;
    email?: string;
  }): Profile | null {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const current = profiles[idx];
    const role = updates.role !== undefined ? updates.role : current.role;
    const assigned_company_ids = updates.assigned_company_ids !== undefined
      ? (role === 'sales_co' ? updates.assigned_company_ids : [])
      : (role === 'sales_co' ? (current.assigned_company_ids || []) : []);
    const assigned_category_ids = updates.assigned_category_ids !== undefined
      ? (role === 'sales_co' ? updates.assigned_category_ids : [])
      : (role === 'sales_co' ? (current.assigned_category_ids || []) : []);

    const updated: Profile = {
      ...current,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      mobile: updates.mobile !== undefined ? updates.mobile.trim().replace(/\D/g, '') : current.mobile,
      email: updates.email !== undefined ? updates.email.trim() : current.email,
      password: updates.password !== undefined && updates.password.trim() ? updates.password.trim() : current.password,
      role,
      active: updates.active !== undefined ? Boolean(updates.active) : current.active,
      category_access_mode: role === 'sales_co' ? 'custom' : 'all',
      company_id: role === 'sales_co' && assigned_company_ids.length > 0 ? assigned_company_ids[0] : undefined,
      assigned_company_ids,
      assigned_category_ids,
      updated_at: new Date().toISOString()
    };

    profiles[idx] = updated;
    this.saveProfiles(profiles);
    return updated;
  }

  updateRetailerProfile(retailerId: string, updates: {
    shop_name?: string;
    owner_name?: string;
    mobile?: string;
    address?: string;
    city?: string;
    state_code?: string;
    gstin?: string;
    credit_limit?: number;
    active?: boolean;
    password?: string;
    email?: string;
  }): { retailer: Retailer; profile: Profile | null } | null {
    const ret = this.updateRetailer(retailerId, {
      shop_name: updates.shop_name,
      owner_name: updates.owner_name,
      mobile: updates.mobile ? updates.mobile.replace(/\D/g, '') : undefined,
      address: updates.address,
      city: updates.city,
      state_code: updates.state_code,
      gstin: updates.gstin,
      credit_limit: updates.credit_limit,
      active: updates.active,
      password: updates.password
    });
    if (!ret) return null;

    const profiles = this.getProfiles();
    const pIdx = profiles.findIndex(p => p.retailer_id === retailerId || p.id === `p-ret-${retailerId}`);
    let updatedProfile: Profile | null = null;
    if (pIdx !== -1) {
      profiles[pIdx] = {
        ...profiles[pIdx],
        name: updates.owner_name && updates.shop_name ? `${updates.owner_name} (${updates.shop_name})` : (updates.owner_name || profiles[pIdx].name),
        mobile: updates.mobile !== undefined ? updates.mobile.replace(/\D/g, '') : profiles[pIdx].mobile,
        password: updates.password !== undefined && updates.password.trim() ? updates.password.trim() : profiles[pIdx].password,
        active: updates.active !== undefined ? updates.active : profiles[pIdx].active,
        email: updates.email !== undefined ? updates.email : profiles[pIdx].email,
        updated_at: new Date().toISOString()
      };
      this.saveProfiles(profiles);
      updatedProfile = profiles[pIdx];
    }

    return { retailer: ret, profile: updatedProfile };
  }

  resetProfilePassword(profileId: string, newPassword: string): boolean {
    const pwd = (newPassword || '').trim();
    if (!pwd || pwd.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === profileId);
    if (idx === -1) {
      // Check if it's a retailer ID
      const retailerProfile = profiles.find(p => p.retailer_id === profileId);
      if (retailerProfile) {
        retailerProfile.password = pwd;
        retailerProfile.updated_at = new Date().toISOString();
        this.saveProfiles(profiles);
        this.updateRetailer(profileId, { password: pwd });
        return true;
      }
      return false;
    }

    profiles[idx].password = pwd;
    profiles[idx].updated_at = new Date().toISOString();
    this.saveProfiles(profiles);

    if (profiles[idx].retailer_id) {
      this.updateRetailer(profiles[idx].retailer_id!, { password: pwd });
    }
    return true;
  }

  toggleProfileStatus(profileId: string, forcedStatus?: boolean): Profile | null {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === profileId);
    if (idx === -1) return null;

    const newStatus = forcedStatus !== undefined ? forcedStatus : !profiles[idx].active;
    profiles[idx].active = newStatus;
    profiles[idx].updated_at = new Date().toISOString();
    this.saveProfiles(profiles);

    if (profiles[idx].retailer_id) {
      this.updateRetailer(profiles[idx].retailer_id!, { active: newStatus });
    }
    return profiles[idx];
  }

  exportFullDatabaseBackup(): DatabaseBackupSnapshot {
    const business_companies = this.getStore<BusinessCompany>('fmcg_business_companies', SEED_BUSINESS_COMPANIES);
    const company_members = this.getStore<CompanyMember>('fmcg_company_members', SEED_COMPANY_MEMBERS);
    const godowns = this.getStore<Godown>('fmcg_godowns', SEED_GODOWNS);
    const stock_transfers = this.getStore<StockTransfer>('fmcg_stock_transfers', SEED_STOCK_TRANSFERS);
    const companies = this.getStore<Company>('fmcg_companies', SEED_COMPANIES);
    const suppliers = this.getStore<Supplier>('fmcg_suppliers', SEED_SUPPLIERS);
    const retailers = this.getStore<Retailer>('fmcg_retailers', SEED_RETAILERS);
    const profiles = this.getStore<Profile>('fmcg_profiles', SEED_PROFILES);
    const categories = this.getStore<Category>('fmcg_categories', SEED_CATEGORIES);
    const products = this.getStore<Product>('fmcg_products', SEED_PRODUCTS);
    const product_categories = this.getStore<ProductCategory>('fmcg_product_categories', SEED_PRODUCT_CATEGORIES);
    const inventory = this.getStore<Inventory>('fmcg_inventory', SEED_INVENTORY);
    const batches = this.getStore<InventoryBatch>('fmcg_batches', SEED_BATCHES);
    const stock_ledger = this.getStore<StockLedgerEntry>('fmcg_stock_ledger', SEED_LEDGER);
    const orders = this.getStore<Order>('fmcg_orders', SEED_ORDERS);
    const fulfilments = this.getStore<Fulfilment>('fmcg_fulfilments', SEED_FULFILMENTS);
    const invoices = this.getStore<Invoice>('fmcg_invoices', SEED_INVOICES);
    const delivery_challans = this.getStore<DeliveryChallan>('fmcg_delivery_challans', SEED_DELIVERY_CHALLANS);
    const purchases = this.getStore<Purchase>('fmcg_purchases', SEED_PURCHASES);
    const payments = this.getStore<Payment>('fmcg_payments', SEED_PAYMENTS);
    const sales_returns = this.getStore<SalesReturn>('fmcg_sales_returns', SEED_SALES_RETURNS);
    const company_opening_balances = this.getStore<CompanyOpeningBalance>('fmcg_company_opening_balances', SEED_COMPANY_OPENING_BALANCES);
    const cash_flow = this.getStore<CashFlowTransaction>('fmcg_cash_flow', SEED_CASH_FLOW_TRANSACTIONS);
    const billing_rate_audits = this.getStore<BillingRateAuditLog>('fmcg_billing_rate_audits', SEED_RATE_AUDIT_LOGS);
    const item_activity_logs = this.getStore<ItemActivityLog>('fmcg_item_activity_logs', SEED_ITEM_ACTIVITY_LOGS);
    const invoice_audits = this.getStore<InvoiceAuditLog>('fmcg_invoice_audits', []);

    const totalRecords =
      business_companies.length +
      company_members.length +
      godowns.length +
      stock_transfers.length +
      companies.length +
      suppliers.length +
      retailers.length +
      profiles.length +
      categories.length +
      products.length +
      product_categories.length +
      inventory.length +
      batches.length +
      stock_ledger.length +
      orders.length +
      fulfilments.length +
      invoices.length +
      delivery_challans.length +
      purchases.length +
      payments.length +
      sales_returns.length +
      company_opening_balances.length +
      cash_flow.length +
      billing_rate_audits.length +
      item_activity_logs.length +
      invoice_audits.length;

    const now = new Date();
    const timestamp = now.toISOString();
    const exportDate = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    return {
      version: '5.0',
      system: 'Saifee General Stores FMCG Distribution ERP',
      timestamp,
      exportDate,
      metadata: {
        totalRecords,
        businessCompaniesCount: business_companies.length,
        productsCount: products.length,
        batchesCount: batches.length,
        inventoryCount: inventory.length,
        invoicesCount: invoices.length,
        ordersCount: orders.length,
        retailersCount: retailers.length,
        suppliersCount: suppliers.length,
        profilesCount: profiles.length,
        paymentsCount: payments.length,
        purchasesCount: purchases.length,
        salesReturnsCount: sales_returns.length,
        godownsCount: godowns.length,
        categoriesCount: categories.length,
        cashFlowCount: cash_flow.length
      },
      tables: {
        business_companies,
        company_members,
        godowns,
        stock_transfers,
        companies,
        suppliers,
        retailers,
        profiles,
        categories,
        products,
        product_categories,
        inventory,
        batches,
        stock_ledger,
        orders,
        fulfilments,
        invoices,
        delivery_challans,
        purchases,
        payments,
        sales_returns,
        company_opening_balances,
        cash_flow,
        billing_rate_audits,
        item_activity_logs,
        invoice_audits
      }
    };
  }

  restoreFullDatabaseBackup(backup: any): { success: boolean; message: string; counts: Record<string, number> } {
    if (!backup || typeof backup !== 'object') {
      throw new Error('Invalid backup data format. Expected a JSON object.');
    }
    const tables = backup.tables || backup;
    if (!tables || typeof tables !== 'object') {
      throw new Error('Invalid backup structure. Missing database tables payload.');
    }

    const counts: Record<string, number> = {};

    if (Array.isArray(tables.business_companies)) {
      this.saveStore('fmcg_business_companies', tables.business_companies);
      counts.business_companies = tables.business_companies.length;
    }
    if (Array.isArray(tables.company_members)) {
      this.saveStore('fmcg_company_members', tables.company_members);
      counts.company_members = tables.company_members.length;
    }
    if (Array.isArray(tables.godowns)) {
      this.saveStore('fmcg_godowns', tables.godowns);
      counts.godowns = tables.godowns.length;
    }
    if (Array.isArray(tables.stock_transfers)) {
      this.saveStore('fmcg_stock_transfers', tables.stock_transfers);
      counts.stock_transfers = tables.stock_transfers.length;
    }
    if (Array.isArray(tables.companies)) {
      this.saveStore('fmcg_companies', tables.companies);
      counts.companies = tables.companies.length;
    }
    if (Array.isArray(tables.suppliers)) {
      this.saveStore('fmcg_suppliers', tables.suppliers);
      counts.suppliers = tables.suppliers.length;
    }
    if (Array.isArray(tables.retailers)) {
      this.saveStore('fmcg_retailers', tables.retailers);
      counts.retailers = tables.retailers.length;
    }
    if (Array.isArray(tables.profiles)) {
      this.saveStore('fmcg_profiles', tables.profiles);
      counts.profiles = tables.profiles.length;
    }
    if (Array.isArray(tables.categories)) {
      this.saveStore('fmcg_categories', tables.categories);
      counts.categories = tables.categories.length;
    }
    if (Array.isArray(tables.products)) {
      this.saveStore('fmcg_products', tables.products);
      counts.products = tables.products.length;
    }
    if (Array.isArray(tables.product_categories)) {
      this.saveStore('fmcg_product_categories', tables.product_categories);
      counts.product_categories = tables.product_categories.length;
    }
    if (Array.isArray(tables.inventory)) {
      this.saveStore('fmcg_inventory', tables.inventory);
      counts.inventory = tables.inventory.length;
    }
    if (Array.isArray(tables.batches)) {
      this.saveStore('fmcg_batches', tables.batches);
      counts.batches = tables.batches.length;
    }
    if (Array.isArray(tables.stock_ledger)) {
      this.saveStore('fmcg_stock_ledger', tables.stock_ledger);
      counts.stock_ledger = tables.stock_ledger.length;
    }
    if (Array.isArray(tables.orders)) {
      this.saveStore('fmcg_orders', tables.orders);
      counts.orders = tables.orders.length;
    }
    if (Array.isArray(tables.fulfilments)) {
      this.saveStore('fmcg_fulfilments', tables.fulfilments);
      counts.fulfilments = tables.fulfilments.length;
    }
    if (Array.isArray(tables.invoices)) {
      this.saveStore('fmcg_invoices', tables.invoices);
      counts.invoices = tables.invoices.length;
    }
    if (Array.isArray(tables.delivery_challans)) {
      this.saveStore('fmcg_delivery_challans', tables.delivery_challans);
      counts.delivery_challans = tables.delivery_challans.length;
    }
    if (Array.isArray(tables.purchases)) {
      this.saveStore('fmcg_purchases', tables.purchases);
      counts.purchases = tables.purchases.length;
    }
    if (Array.isArray(tables.payments)) {
      this.saveStore('fmcg_payments', tables.payments);
      counts.payments = tables.payments.length;
    }
    if (Array.isArray(tables.sales_returns)) {
      this.saveStore('fmcg_sales_returns', tables.sales_returns);
      counts.sales_returns = tables.sales_returns.length;
    }
    if (Array.isArray(tables.company_opening_balances)) {
      this.saveStore('fmcg_company_opening_balances', tables.company_opening_balances);
      counts.company_opening_balances = tables.company_opening_balances.length;
    }
    if (Array.isArray(tables.cash_flow)) {
      this.saveStore('fmcg_cash_flow', tables.cash_flow);
      counts.cash_flow = tables.cash_flow.length;
    }
    if (Array.isArray(tables.billing_rate_audits)) {
      this.saveStore('fmcg_billing_rate_audits', tables.billing_rate_audits);
      counts.billing_rate_audits = tables.billing_rate_audits.length;
    }
    if (Array.isArray(tables.item_activity_logs)) {
      this.saveStore('fmcg_item_activity_logs', tables.item_activity_logs);
      counts.item_activity_logs = tables.item_activity_logs.length;
    }
    if (Array.isArray(tables.invoice_audits)) {
      this.saveStore('fmcg_invoice_audits', tables.invoice_audits);
      counts.invoice_audits = tables.invoice_audits.length;
    }

    return {
      success: true,
      message: 'Database backup restored successfully into active memory and storage.',
      counts
    };
  }

  getCompanies(): Company[] {
    const list = this.getStore<Company>('fmcg_companies', SEED_COMPANIES);
    let changed = false;
    const migrated = list.map(c => {
      if (c.id === 'c-parle' && c.name === 'Parle Products') {
        changed = true;
        return { ...c, name: 'Parle' };
      }
      return c;
    });
    if (changed) {
      this.saveStore('fmcg_companies', migrated);
      return migrated;
    }
    return list;
  }

  createCompany(name: string, code?: string): Company {
    const companies = this.getCompanies();
    const cleanName = name.trim();
    const existing = companies.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const newCompany: Company = {
      id: `c-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now().toString()}`,
      name: cleanName,
      code: (code && code.trim().toUpperCase()) || cleanName.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CO',
      active: true
    };
    companies.push(newCompany);
    this.saveStore('fmcg_companies', companies);

    // Auto-create category for this company if not already existing
    const categories = this.getCategories();
    if (!categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase() || c.id === `cat-${newCompany.id}`)) {
      categories.push({
        id: `cat-${newCompany.id}`,
        business_id: this.getActiveBusinessCompanyId(),
        name: cleanName,
        description: `Products manufactured and distributed by ${cleanName}`,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      this.saveCategories(categories);
    }

    return newCompany;
  }

  saveCompanies(companies: Company[]): void {
    this.saveStore('fmcg_companies', companies);
  }

  deleteCompany(id: string, options?: { handleLinkedProducts?: 'unlink' | 'cascade' | 'error' }): { success: boolean; message?: string; affectedProducts?: number } {
    const companies = this.getCompanies();
    const comp = companies.find(c => c.id === id);
    if (!comp) return { success: false, message: 'Company not found' };

    const products = this.getAllProducts();
    const referencingProducts = products.filter(p => p.company_id === id);
    const mode = options?.handleLinkedProducts || 'error';

    if (referencingProducts.length > 0) {
      if (mode === 'error') {
        return {
          success: false,
          message: `Cannot delete "${comp.name}": ${referencingProducts.length} product(s) are currently assigned to this company. Please choose to unlink or delete linked products.`,
          affectedProducts: referencingProducts.length
        };
      } else if (mode === 'unlink') {
        // Set company_id to undefined/unassigned for all referencing products
        const updatedProducts = products.map(p => {
          if (p.company_id === id) {
            const { company_id, ...rest } = p;
            return { ...rest, company_id: undefined, updated_at: new Date().toISOString() };
          }
          return p;
        });
        this.saveStore('fmcg_products', updatedProducts);
      } else if (mode === 'cascade') {
        // Cascade delete all referencing products and their inventory/batches
        const refIds = new Set(referencingProducts.map(p => p.id));
        const remainingProducts = products.filter(p => p.company_id !== id);
        this.saveStore('fmcg_products', remainingProducts);

        // Remove inventory & batches for cascade-deleted products
        const inv = this.getStore<Inventory>('fmcg_inventory', SEED_INVENTORY).filter(i => !refIds.has(i.product_id));
        this.saveStore('fmcg_inventory', inv);
        const batches = this.getStore<InventoryBatch>('fmcg_batches', SEED_BATCHES).filter(b => !refIds.has(b.product_id));
        this.saveStore('fmcg_batches', batches);
      }
    }

    // Unassign from salesperson profile scopes
    const profiles = this.getProfiles();
    let profilesChanged = false;
    const updatedProfiles = profiles.map(p => {
      let changed = false;
      let newCompId = p.company_id;
      let newAssignedIds = p.assigned_company_ids;

      if (p.company_id === id) {
        newCompId = undefined;
        changed = true;
      }
      if (p.assigned_company_ids && p.assigned_company_ids.includes(id)) {
        newAssignedIds = p.assigned_company_ids.filter(cid => cid !== id);
        changed = true;
      }

      if (changed) {
        profilesChanged = true;
        return {
          ...p,
          company_id: newCompId,
          assigned_company_ids: newAssignedIds,
          updated_at: new Date().toISOString()
        };
      }
      return p;
    });

    if (profilesChanged) {
      this.saveProfiles(updatedProfiles);
    }

    // Save filtered companies
    const filtered = companies.filter(c => c.id !== id);
    this.saveCompanies(filtered);

    // Record tombstone to prevent resurrection on reload
    this.recordTombstone('company', id);

    return { 
      success: true, 
      message: `Company "${comp.name}" permanently deleted.`,
      affectedProducts: referencingProducts.length 
    };
  }

  getSuppliers(targetBusinessId?: string): Supplier[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Supplier>('fmcg_suppliers', SEED_SUPPLIERS);
    return all.filter(s => (s.business_id || 'biz-saifee') === activeBiz);
  }

  getAllSuppliers(): Supplier[] {
    return this.getStore<Supplier>('fmcg_suppliers', SEED_SUPPLIERS);
  }

  saveSuppliers(suppliers: Supplier[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Supplier>('fmcg_suppliers', SEED_SUPPLIERS);
    const otherBiz = all.filter(s => (s.business_id || 'biz-saifee') !== activeBiz);
    const tagged = suppliers.map(s => ({ ...s, business_id: s.business_id || activeBiz }));
    this.saveStore('fmcg_suppliers', [...otherBiz, ...tagged]);
  }

  createSupplier(name: string, gstin: string, address: string): Supplier {
    const suppliers = this.getSuppliers();
    const newSupplier: Supplier = {
      id: `s-${Date.now()}`,
      business_id: this.getActiveBusinessCompanyId(),
      name,
      gstin,
      address,
      active: true
    };
    suppliers.push(newSupplier);
    this.saveSuppliers(suppliers);
    return newSupplier;
  }

  getRetailers(targetBusinessId?: string): Retailer[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Retailer>('fmcg_retailers', SEED_RETAILERS);
    return all.filter(r => (r.business_id || 'biz-saifee') === activeBiz);
  }

  getAllRetailers(): Retailer[] {
    return this.getStore<Retailer>('fmcg_retailers', SEED_RETAILERS);
  }

  saveRetailers(retailers: Retailer[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Retailer>('fmcg_retailers', SEED_RETAILERS);
    const otherBiz = all.filter(r => (r.business_id || 'biz-saifee') !== activeBiz);
    const tagged = retailers.map(r => ({ ...r, business_id: r.business_id || activeBiz }));
    this.saveStore('fmcg_retailers', [...otherBiz, ...tagged]);
  }

  createRetailer(data: {
    shop_name: string;
    owner_name: string;
    mobile: string;
    address: string;
    city?: string;
    state_code?: string;
    gstin?: string;
    credit_limit?: number;
    retailer_code?: string;
    active?: boolean;
    category_access_mode?: 'all' | 'custom';
    assigned_category_ids?: string[];
  }): Retailer {
    const activeBiz = this.getActiveBusinessCompanyId();
    const retailers = this.getRetailers(activeBiz);
    const shopName = (data.shop_name || '').trim();
    const ownerName = (data.owner_name || '').trim();
    const mobile = (data.mobile || '').trim();
    const address = (data.address || '').trim();
    const city = (data.city || 'Mumbai').trim();
    const stateCode = (data.state_code || '27').trim();
    const gstin = data.gstin?.trim() ? data.gstin.trim().toUpperCase() : undefined;
    const creditLimit = typeof data.credit_limit === 'number' && !isNaN(data.credit_limit) ? Math.max(0, data.credit_limit) : 50000;
    const active = data.active !== undefined ? Boolean(data.active) : true;
    const category_access_mode = data.category_access_mode || 'all';
    const assigned_category_ids = category_access_mode === 'custom' ? (data.assigned_category_ids || []) : [];

    if (!shopName) throw new Error('Shop name is required');
    if (!ownerName) throw new Error('Owner name is required');
    if (!mobile) throw new Error('Mobile number is required');
    if (!address) throw new Error('Address is required');

    // Generate unique retailer code if not provided
    let code = (data.retailer_code || '').trim().toUpperCase();
    if (!code) {
      let maxNum = 124;
      retailers.forEach(r => {
        const match = r.retailer_code?.match(/RET-0*(\d+)/i);
        if (match && match[1]) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const nextNum = maxNum + 1;
      code = `RET-${String(nextNum).padStart(5, '0')}`;
    }

    const newId = `ret-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newRetailer: Retailer = {
      id: newId,
      business_id: activeBiz,
      retailer_code: code,
      shop_name: shopName,
      owner_name: ownerName,
      address,
      city: city || 'Mumbai',
      state_code: stateCode || '27',
      gstin,
      mobile,
      credit_limit: creditLimit,
      outstanding: 0,
      active,
      category_access_mode,
      assigned_category_ids
    };

    retailers.unshift(newRetailer);
    this.saveRetailers(retailers, activeBiz);
    return newRetailer;
  }

  updateRetailer(id: string, updates: Partial<Retailer>): Retailer | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const retailers = this.getRetailers(activeBiz);
    const index = retailers.findIndex(r => r.id === id);
    if (index === -1) return null;

    const current = retailers[index];
    const updatedRetailer: Retailer = {
      ...current,
      ...updates,
      id: current.id,
      business_id: current.business_id || activeBiz,
      shop_name: updates.shop_name !== undefined ? updates.shop_name.trim() : current.shop_name,
      owner_name: updates.owner_name !== undefined ? updates.owner_name.trim() : current.owner_name,
      mobile: updates.mobile !== undefined ? updates.mobile.trim() : current.mobile,
      address: updates.address !== undefined ? updates.address.trim() : current.address,
      city: updates.city !== undefined ? updates.city.trim() : current.city,
      state_code: updates.state_code !== undefined ? updates.state_code.trim() : current.state_code,
      gstin: updates.gstin !== undefined ? (updates.gstin?.trim() ? updates.gstin.trim().toUpperCase() : undefined) : current.gstin,
      credit_limit: updates.credit_limit !== undefined ? Math.max(0, Number(updates.credit_limit) || 0) : current.credit_limit,
      outstanding: updates.outstanding !== undefined ? Number(updates.outstanding) || 0 : current.outstanding,
      active: updates.active !== undefined ? Boolean(updates.active) : current.active,
      category_access_mode: updates.category_access_mode !== undefined ? updates.category_access_mode : current.category_access_mode,
      assigned_category_ids: updates.assigned_category_ids !== undefined ? updates.assigned_category_ids : current.assigned_category_ids
    };

    retailers[index] = updatedRetailer;
    this.saveRetailers(retailers, activeBiz);
    return updatedRetailer;
  }

  getProducts(targetBusinessId?: string): Product[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Product>('fmcg_products', SEED_PRODUCTS);
    return all.filter(p => {
      const isSecondBizItem = 
        p.business_id === 'biz-second-trading' ||
        p.id === 'prd-trad-basmati-50kg' ||
        p.id === 'prd-trad-sugar-m30' ||
        p.id === 'prd-trad-oil-15l' ||
        p.id?.startsWith('prd-trad-');
      const itemBiz = isSecondBizItem ? 'biz-second-trading' : (p.business_id || 'biz-saifee');
      return itemBiz === activeBiz;
    });
  }

  getAllProducts(): Product[] {
    return this.getStore<Product>('fmcg_products', SEED_PRODUCTS);
  }

  saveProducts(products: Product[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Product>('fmcg_products', SEED_PRODUCTS);
    const otherBiz = all.filter(p => (p.business_id || 'biz-saifee') !== activeBiz);
    const tagged = products.map(p => ({ ...p, business_id: p.business_id || activeBiz }));
    this.saveStore('fmcg_products', [...otherBiz, ...tagged]);
  }

  // ----------------------------------------------------
  // CATEGORIES & MANY-TO-MANY PRODUCT CATEGORIES
  // ----------------------------------------------------

  getCategories(targetBusinessId?: string): Category[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Category>('fmcg_categories', SEED_CATEGORIES);
    return all.filter(c => (c.business_id || 'biz-saifee') === activeBiz);
  }

  getAllCategories(): Category[] {
    return this.getStore<Category>('fmcg_categories', SEED_CATEGORIES);
  }

  saveCategories(categories: Category[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Category>('fmcg_categories', SEED_CATEGORIES);
    const otherBiz = all.filter(c => (c.business_id || 'biz-saifee') !== activeBiz);
    const tagged = categories.map(c => ({ ...c, business_id: c.business_id || activeBiz }));
    this.saveStore('fmcg_categories', [...otherBiz, ...tagged]);
  }

  createCategory(name: string, description?: string, active: boolean = true): Category {
    const activeBiz = this.getActiveBusinessCompanyId();
    const categories = this.getCategories(activeBiz);
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Category name cannot be empty');
    const existing = categories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) throw new Error(`Category "${cleanName}" already exists`);

    const newCategory: Category = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      business_id: activeBiz,
      name: cleanName,
      description: description?.trim() || '',
      active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    categories.push(newCategory);
    this.saveCategories(categories, activeBiz);
    return newCategory;
  }

  updateCategory(id: string, data: { name?: string; description?: string; active?: boolean }): Category | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const categories = this.getCategories(activeBiz);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return null;

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error('Category name cannot be empty');
      const duplicate = categories.find(c => c.id !== id && c.name.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) throw new Error(`Category "${cleanName}" already exists`);
      categories[index].name = cleanName;
    }
    if (data.description !== undefined) {
      categories[index].description = data.description.trim();
    }
    if (data.active !== undefined) {
      categories[index].active = data.active;
    }
    categories[index].updated_at = new Date().toISOString();

    this.saveCategories(categories, activeBiz);
    return categories[index];
  }

  toggleCategoryStatus(id: string): Category | null {
    const categories = this.getCategories();
    const cat = categories.find(c => c.id === id);
    if (!cat) return null;
    return this.updateCategory(id, { active: !cat.active });
  }

  deleteCategory(id: string): boolean {
    const activeBiz = this.getActiveBusinessCompanyId();
    const categories = this.getCategories(activeBiz);
    const filteredCategories = categories.filter(c => c.id !== id);
    if (filteredCategories.length === categories.length) return false;

    this.saveCategories(filteredCategories, activeBiz);

    // Remove only associated product-category junction mappings (never delete products!)
    const productCategories = this.getProductCategories(activeBiz);
    const remainingPCs = productCategories.filter(pc => pc.category_id !== id);
    this.saveProductCategories(remainingPCs, activeBiz);
    return true;
  }

  getProductCategories(targetBusinessId?: string): ProductCategory[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<ProductCategory>('fmcg_product_categories', SEED_PRODUCT_CATEGORIES);
    return all.filter(pc => (pc.business_id || 'biz-saifee') === activeBiz);
  }

  saveProductCategories(pcs: ProductCategory[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<ProductCategory>('fmcg_product_categories', SEED_PRODUCT_CATEGORIES);
    const otherBiz = all.filter(pc => (pc.business_id || 'biz-saifee') !== activeBiz);
    const tagged = pcs.map(pc => ({ ...pc, business_id: pc.business_id || activeBiz }));
    this.saveStore('fmcg_product_categories', [...otherBiz, ...tagged]);
  }

  getCategoriesForProduct(productId: string): Category[] {
    const pcs = this.getProductCategories().filter(pc => pc.product_id === productId);
    const catMap = new Map(this.getCategories().map(c => [c.id, c]));
    return pcs.map(pc => catMap.get(pc.category_id)).filter((c): c is Category => Boolean(c));
  }

  getCategoryIdsForProduct(productId: string): string[] {
    return this.getProductCategories()
      .filter(pc => pc.product_id === productId)
      .map(pc => pc.category_id);
  }

  getProductsForCategory(categoryId: string): Product[] {
    const pcs = this.getProductCategories().filter(pc => pc.category_id === categoryId);
    const prodMap = new Map(this.getProducts().map(p => [p.id, p]));
    return pcs.map(pc => prodMap.get(pc.product_id)).filter((p): p is Product => Boolean(p));
  }

  getProductCountForCategory(categoryId: string): number {
    return this.getProductCategories().filter(pc => pc.category_id === categoryId).length;
  }

  assignCategoriesToProduct(productId: string, categoryIds: string[]): ProductCategory[] {
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const now = new Date().toISOString();
    let modified = false;

    categoryIds.forEach(catId => {
      if (!pcs.some(pc => pc.product_id === productId && pc.category_id === catId)) {
        pcs.push({
          id: `pc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          business_id: activeBiz,
          product_id: productId,
          category_id: catId,
          created_at: now,
          updated_at: now
        });
        modified = true;
      }
    });

    if (modified) {
      this.saveProductCategories(pcs, activeBiz);
    }
    return pcs.filter(pc => pc.product_id === productId);
  }

  removeCategoryFromProduct(productId: string, categoryId: string): boolean {
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const filtered = pcs.filter(pc => !(pc.product_id === productId && pc.category_id === categoryId));
    if (filtered.length === pcs.length) return false;
    this.saveProductCategories(filtered, activeBiz);
    return true;
  }

  setProductCategories(productId: string, categoryIds: string[]): ProductCategory[] {
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const filtered = pcs.filter(pc => pc.product_id !== productId);
    const now = new Date().toISOString();

    const uniqueCatIds = Array.from(new Set(categoryIds));
    uniqueCatIds.forEach(catId => {
      filtered.push({
        id: `pc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        business_id: activeBiz,
        product_id: productId,
        category_id: catId,
        created_at: now,
        updated_at: now
      });
    });

    this.saveProductCategories(filtered, activeBiz);
    return filtered.filter(pc => pc.product_id === productId);
  }

  bulkAddCategoriesToProducts(productIds: string[], categoryIds: string[]): void {
    if (!productIds.length || !categoryIds.length) return;
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const now = new Date().toISOString();
    let modified = false;

    const uniqueCatIds = Array.from(new Set(categoryIds));
    productIds.forEach(prodId => {
      uniqueCatIds.forEach(catId => {
        if (!pcs.some(pc => pc.product_id === prodId && pc.category_id === catId)) {
          pcs.push({
            id: `pc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            business_id: activeBiz,
            product_id: prodId,
            category_id: catId,
            created_at: now,
            updated_at: now
          });
          modified = true;
        }
      });
    });

    if (modified) {
      this.saveProductCategories(pcs, activeBiz);
    }
  }

  bulkReplaceCategoriesForProducts(productIds: string[], categoryIds: string[]): void {
    if (!productIds.length) return;
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const prodIdSet = new Set(productIds);
    const filtered = pcs.filter(pc => !prodIdSet.has(pc.product_id));
    const now = new Date().toISOString();

    const uniqueCatIds = Array.from(new Set(categoryIds));
    productIds.forEach(prodId => {
      uniqueCatIds.forEach(catId => {
        filtered.push({
          id: `pc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          business_id: activeBiz,
          product_id: prodId,
          category_id: catId,
          created_at: now,
          updated_at: now
        });
      });
    });

    this.saveProductCategories(filtered, activeBiz);
  }

  bulkRemoveCategoriesFromProducts(productIds: string[], categoryIds: string[]): void {
    if (!productIds.length || !categoryIds.length) return;
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const prodIdSet = new Set(productIds);
    const catIdSet = new Set(categoryIds);

    const filtered = pcs.filter(pc => !(prodIdSet.has(pc.product_id) && catIdSet.has(pc.category_id)));
    this.saveProductCategories(filtered, activeBiz);
  }

  bulkRemoveProductsFromCategory(categoryId: string, productIds: string[]): void {
    if (!productIds.length) return;
    const activeBiz = this.getActiveBusinessCompanyId();
    const pcs = this.getProductCategories(activeBiz);
    const prodIdSet = new Set(productIds);
    const filtered = pcs.filter(pc => !(pc.category_id === categoryId && prodIdSet.has(pc.product_id)));
    this.saveProductCategories(filtered, activeBiz);
  }

  // ----------------------------------------------------
  // CATEGORY ACCESS PERMISSIONS & ASSIGNMENTS (RETAILERS & SALESPERSONS)
  // ----------------------------------------------------

  updateCategoryAssignments(id: string, data: {
    salesperson_access_type?: 'all' | 'restricted';
    assigned_salesperson_ids?: string[];
    retailer_access_type?: 'all' | 'restricted';
    assigned_retailer_ids?: string[];
  }): Category | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const categories = this.getCategories(activeBiz);
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return null;

    if (data.salesperson_access_type !== undefined) {
      categories[index].salesperson_access_type = data.salesperson_access_type;
    }
    if (data.assigned_salesperson_ids !== undefined) {
      categories[index].assigned_salesperson_ids = Array.from(new Set(data.assigned_salesperson_ids));
    }
    if (data.retailer_access_type !== undefined) {
      categories[index].retailer_access_type = data.retailer_access_type;
    }
    if (data.assigned_retailer_ids !== undefined) {
      categories[index].assigned_retailer_ids = Array.from(new Set(data.assigned_retailer_ids));
    }
    categories[index].updated_at = new Date().toISOString();

    this.saveCategories(categories, activeBiz);
    return categories[index];
  }

  updateSalespersonCategoryAssignments(profileId: string, categoryIds: string[], accessMode: 'all' | 'custom' = 'custom'): Profile | null {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    if (index === -1) return null;

    profiles[index].category_access_mode = accessMode;
    profiles[index].assigned_category_ids = accessMode === 'all' ? [] : Array.from(new Set(categoryIds));
    this.saveProfiles(profiles);
    return profiles[index];
  }

  updateRetailerCategoryAssignments(retailerId: string, categoryIds: string[], accessMode: 'all' | 'custom' = 'custom'): Retailer | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const retailers = this.getRetailers(activeBiz);
    const index = retailers.findIndex(r => r.id === retailerId);
    if (index === -1) return null;

    retailers[index].category_access_mode = accessMode;
    retailers[index].assigned_category_ids = accessMode === 'all' ? [] : Array.from(new Set(categoryIds));
    this.saveRetailers(retailers, activeBiz);
    return retailers[index];
  }

  getAssignedCategoriesForSalesperson(salespersonId: string): Category[] {
    const allCategories = this.getCategories().filter(c => c.active);
    const profile = this.getProfiles().find(p => p.id === salespersonId);
    if (!profile) return allCategories;

    // Admin has access to everything
    if (profile.role === 'admin') return allCategories;

    // 1. Profile-level custom category assignment
    if (profile.category_access_mode === 'custom' && Array.isArray(profile.assigned_category_ids) && profile.assigned_category_ids.length > 0) {
      const assignedSet = new Set(profile.assigned_category_ids);
      return allCategories.filter(c => assignedSet.has(c.id));
    }

    // 2. Category-level salesperson restriction checks
    let visible = allCategories.filter(c => {
      if (c.salesperson_access_type === 'restricted' && Array.isArray(c.assigned_salesperson_ids)) {
        return c.assigned_salesperson_ids.includes(salespersonId);
      }
      return true;
    });

    // 3. For Company Salesperson (sales_co), if linked to company/companies, filter to categories associated with those companies
    if (profile.role === 'sales_co') {
      const allowedCompanyIds = new Set<string>();
      if (Array.isArray(profile.assigned_company_ids) && profile.assigned_company_ids.length > 0) {
        profile.assigned_company_ids.forEach(id => allowedCompanyIds.add(id));
      } else if (profile.company_id) {
        allowedCompanyIds.add(profile.company_id);
      }

      if (allowedCompanyIds.size > 0) {
        const companyProducts = this.getProducts().filter(p => p.company_id && allowedCompanyIds.has(p.company_id));
        const companyProdIds = new Set(companyProducts.map(p => p.id));
        const pcs = this.getProductCategories();
        const companyCatIds = new Set(pcs.filter(pc => companyProdIds.has(pc.product_id)).map(pc => pc.category_id));
        
        const scoped = visible.filter(c => companyCatIds.has(c.id) || companyProducts.some(p => (p.category || '').toLowerCase() === c.name.toLowerCase()));
        if (scoped.length > 0) return scoped;
      }
    }

    return visible;
  }

  getAssignedCategoriesForRetailer(retailerId: string): Category[] {
    const allCategories = this.getCategories().filter(c => c.active);
    const retailer = this.getRetailers().find(r => r.id === retailerId);
    if (!retailer) return allCategories;

    // 1. Retailer-level custom category assignment
    if (retailer.category_access_mode === 'custom' && Array.isArray(retailer.assigned_category_ids)) {
      const assignedSet = new Set(retailer.assigned_category_ids);
      return allCategories.filter(c => assignedSet.has(c.id));
    }

    // 2. Category-level retailer restriction checks
    return allCategories.filter(c => {
      if (c.retailer_access_type === 'restricted' && Array.isArray(c.assigned_retailer_ids)) {
        return c.assigned_retailer_ids.includes(retailerId);
      }
      return true;
    });
  }

  isProductVisibleToSalesperson(productId: string, salespersonId: string): boolean {
    const profile = this.getProfiles().find(p => p.id === salespersonId);
    if (!profile) return true;
    if (profile.role === 'admin') return true;

    const prod = this.getProducts().find(p => p.id === productId);
    if (!prod) return false;

    // Strict Company Filter for Company Salesperson (sales_co / CH_CO_SALES)
    if (profile.role === 'sales_co') {
      const allowedCompanyIds = new Set<string>();
      if (Array.isArray(profile.assigned_company_ids) && profile.assigned_company_ids.length > 0) {
        profile.assigned_company_ids.forEach(id => allowedCompanyIds.add(id));
      } else if (profile.company_id) {
        allowedCompanyIds.add(profile.company_id);
      }

      if (allowedCompanyIds.size > 0) {
        if (!prod.company_id || !allowedCompanyIds.has(prod.company_id)) {
          return false;
        }
      }
    }

    // Category restriction
    const allowedCats = this.getAssignedCategoriesForSalesperson(salespersonId);
    const allowedCatIds = new Set(allowedCats.map(c => c.id));
    const prodCatIds = this.getCategoryIdsForProduct(productId);
    
    // If product is mapped to any allowed category
    if (prodCatIds.some(cid => allowedCatIds.has(cid))) return true;

    // Fallback: check product.category string matching allowed category name
    if (prod && allowedCats.some(c => c.name.toLowerCase() === (prod.category || '').toLowerCase())) {
      return true;
    }

    // If uncategorized products and salesperson has unrestricted access
    if (profile.category_access_mode !== 'custom' && allowedCats.length === this.getCategories().filter(c => c.active).length) {
      return true;
    }

    return false;
  }

  isProductVisibleToRetailer(productId: string, retailerId: string): boolean {
    const allowedCats = this.getAssignedCategoriesForRetailer(retailerId);
    const allowedCatIds = new Set(allowedCats.map(c => c.id));
    const prodCatIds = this.getCategoryIdsForProduct(productId);

    if (prodCatIds.some(cid => allowedCatIds.has(cid))) return true;

    const prod = this.getProducts().find(p => p.id === productId);
    if (prod && allowedCats.some(c => c.name.toLowerCase() === (prod.category || '').toLowerCase())) {
      return true;
    }

    const retailer = this.getRetailers().find(r => r.id === retailerId);
    if (retailer && retailer.category_access_mode !== 'custom' && allowedCats.length === this.getCategories().filter(c => c.active).length) {
      return true;
    }

    return false;
  }

  // ----------------------------------------------------
  // ITEM ACTIVITY AUDIT LOG METHODS
  // ----------------------------------------------------

  getItemActivityLogs(productId?: string, targetBusinessId?: string): ItemActivityLog[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<ItemActivityLog>('fmcg_item_activity_logs', SEED_ITEM_ACTIVITY_LOGS);
    const scoped = all.filter(l => (l.business_id || 'biz-saifee') === activeBiz);
    if (!productId) return [...scoped].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return scoped
      .filter(l => l.product_id === productId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  saveItemActivityLogs(logs: ItemActivityLog[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<ItemActivityLog>('fmcg_item_activity_logs', SEED_ITEM_ACTIVITY_LOGS);
    const otherBiz = all.filter(l => (l.business_id || 'biz-saifee') !== activeBiz);
    const tagged = logs.map(l => ({ ...l, business_id: l.business_id || activeBiz }));
    this.saveStore('fmcg_item_activity_logs', [...otherBiz, ...tagged]);
  }

  addItemActivityLog(log: Omit<ItemActivityLog, 'id' | 'created_at'>): ItemActivityLog {
    const activeBiz = this.getActiveBusinessCompanyId();
    const logs = this.getItemActivityLogs(undefined, activeBiz);
    const newLog: ItemActivityLog = {
      ...log,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      business_id: activeBiz,
      created_at: new Date().toISOString()
    };
    logs.unshift(newLog);
    this.saveItemActivityLogs(logs, activeBiz);
    return newLog;
  }

  // ----------------------------------------------------
  // PRODUCT MASTER MANAGEMENT & EDIT
  // ----------------------------------------------------

  updateProduct(productId: string, updates: Partial<Product>): Product | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const index = products.findIndex(p => p.id === productId);
    if (index === -1) return null;

    const oldProd = { ...products[index] };
    const changedFields: string[] = [];

    if (updates.name !== undefined && updates.name !== oldProd.name) {
      changedFields.push(`Name: "${oldProd.name}" ➔ "${updates.name}"`);
    }
    if (updates.selling_price !== undefined && updates.selling_price !== oldProd.selling_price) {
      changedFields.push(`Selling Price: ₹${oldProd.selling_price} ➔ ₹${updates.selling_price}`);
    }
    if (updates.loose_selling_price !== undefined && updates.loose_selling_price !== oldProd.loose_selling_price) {
      changedFields.push(`Loose Selling Price: ₹${oldProd.loose_selling_price ?? 0} ➔ ₹${updates.loose_selling_price}`);
    }
    if (updates.purchase_price !== undefined && updates.purchase_price !== oldProd.purchase_price) {
      changedFields.push(`Cost Price: ₹${oldProd.purchase_price} ➔ ₹${updates.purchase_price}`);
    }
    if (updates.mrp !== undefined && updates.mrp !== oldProd.mrp) {
      changedFields.push(`MRP: ₹${oldProd.mrp} ➔ ₹${updates.mrp}`);
    }
    if (updates.dealer_price !== undefined && updates.dealer_price !== oldProd.dealer_price) {
      changedFields.push(`Dealer Price: ₹${oldProd.dealer_price ?? 0} ➔ ₹${updates.dealer_price}`);
    }
    if (updates.gst_percent !== undefined && updates.gst_percent !== oldProd.gst_percent) {
      changedFields.push(`GST: ${oldProd.gst_percent}% ➔ ${updates.gst_percent}%`);
    }
    if (updates.hsn !== undefined && updates.hsn !== oldProd.hsn) {
      changedFields.push(`HSN: ${oldProd.hsn} ➔ ${updates.hsn}`);
    }
    if (updates.sku !== undefined && updates.sku !== oldProd.sku) {
      changedFields.push(`SKU: ${oldProd.sku} ➔ ${updates.sku}`);
    }
    if (updates.barcode !== undefined && updates.barcode !== oldProd.barcode) {
      changedFields.push(`Barcode: ${oldProd.barcode} ➔ ${updates.barcode}`);
    }
    if (updates.pack_size !== undefined && updates.pack_size !== oldProd.pack_size) {
      changedFields.push(`Pack Size: "${oldProd.pack_size}" ➔ "${updates.pack_size}"`);
    }
    if (updates.trade_mode !== undefined && updates.trade_mode !== oldProd.trade_mode) {
      changedFields.push(`Trading Mode: ${oldProd.trade_mode || 'PIECES'} ➔ ${updates.trade_mode}`);
    }
    if (updates.trading_unit !== undefined && updates.trading_unit !== oldProd.trading_unit) {
      changedFields.push(`Trading Unit: ${oldProd.trading_unit} ➔ ${updates.trading_unit}`);
    }
    if (updates.base_unit !== undefined && updates.base_unit !== oldProd.base_unit) {
      changedFields.push(`Base Unit: ${oldProd.base_unit ?? 'Packet'} ➔ ${updates.base_unit}`);
    }
    if (updates.units_per_box_carton !== undefined && updates.units_per_box_carton !== oldProd.units_per_box_carton) {
      changedFields.push(`Units/Pack: ${oldProd.units_per_box_carton} ➔ ${updates.units_per_box_carton}`);
    }
    if (updates.allow_loose_sale !== undefined && updates.allow_loose_sale !== oldProd.allow_loose_sale) {
      changedFields.push(`Allow Loose Sale: ${oldProd.allow_loose_sale !== false ? 'Yes' : 'No'} ➔ ${updates.allow_loose_sale ? 'Yes' : 'No'}`);
    }
    if (updates.active !== undefined && updates.active !== oldProd.active) {
      changedFields.push(`Status: ${oldProd.active ? 'Active' : 'Inactive'} ➔ ${updates.active ? 'Active' : 'Inactive'}`);
    }

    const unitsPerPack = updates.units_per_box_carton ?? updates.pieces_per_carton ?? updates.units_per_trading_unit ?? oldProd.units_per_box_carton ?? 1;
    const sellingPrice = updates.selling_price !== undefined ? updates.selling_price : oldProd.selling_price;
    const loosePriceMode = updates.loose_price_mode || oldProd.loose_price_mode || 'auto';
    
    let looseSellingPrice = updates.loose_selling_price !== undefined 
      ? updates.loose_selling_price 
      : oldProd.loose_selling_price;
      
    if (loosePriceMode === 'auto' && (updates.selling_price !== undefined || updates.units_per_box_carton !== undefined || looseSellingPrice === undefined)) {
      looseSellingPrice = Math.round((sellingPrice / Math.max(1, unitsPerPack)) * 100) / 100;
    }

    const tradeMode: TradeMode = updates.trade_mode !== undefined
      ? updates.trade_mode
      : (updates.allow_carton && updates.allow_pieces ? 'BOTH' : updates.allow_carton ? 'CARTONS' : updates.allow_pieces ? 'PIECES' : (oldProd.trade_mode || (unitsPerPack > 1 ? 'BOTH' : 'PIECES')));

    products[index] = {
      ...products[index],
      ...updates,
      business_id: products[index].business_id || activeBiz,
      trade_mode: tradeMode,
      allow_carton: updates.allow_carton !== undefined ? updates.allow_carton : (tradeMode === 'CARTONS' || tradeMode === 'BOTH'),
      allow_pieces: updates.allow_pieces !== undefined ? updates.allow_pieces : (tradeMode === 'PIECES' || tradeMode === 'BOTH'),
      pieces_per_carton: unitsPerPack,
      units_per_box_carton: unitsPerPack,
      units_per_trading_unit: unitsPerPack,
      loose_price_mode: loosePriceMode,
      loose_selling_price: looseSellingPrice,
      allow_loose_sale: updates.allow_loose_sale !== undefined ? updates.allow_loose_sale : (tradeMode === 'PIECES' || tradeMode === 'BOTH'),
      base_unit: updates.base_unit || oldProd.base_unit || 'Packet',
      carton_discount: updates.carton_discount !== undefined ? updates.carton_discount : (oldProd.carton_discount || 0),
      loose_discount: updates.loose_discount !== undefined ? updates.loose_discount : (oldProd.loose_discount || 0),
      updated_at: new Date().toISOString()
    };
    this.saveProducts(products, activeBiz);

    if (changedFields.length > 0) {
      this.addItemActivityLog({
        product_id: productId,
        action: 'Item Master Details Updated',
        details: changedFields.join(', '),
        user_id: this.currentUserId,
        user_name: this.getCurrentUser().name
      });
    }

    return products[index];
  }

  toggleProductStatus(productId: string): Product | null {
    const products = this.getProducts();
    const prod = products.find(p => p.id === productId);
    if (!prod) return null;
    return this.updateProduct(productId, { active: !prod.active });
  }

  updateProductWithCategories(productId: string, updates: Partial<Product>, categoryIds?: string[]): Product | null {
    const updated = this.updateProduct(productId, updates);
    if (!updated) return null;

    if (categoryIds !== undefined) {
      this.setProductCategories(productId, categoryIds);
      const catNames = this.getCategories()
        .filter(c => categoryIds.includes(c.id))
        .map(c => c.name);
      this.addItemActivityLog({
        product_id: productId,
        action: 'Categories Updated',
        details: catNames.length > 0 ? `Assigned to: ${catNames.join(', ')}` : 'Cleared all category assignments',
        user_id: this.currentUserId,
        user_name: this.getCurrentUser().name
      });
    }

    return updated;
  }

  bulkUpdateProducts(
    productIds: string[],
    updates: Partial<Product>,
    categoryIds?: string[]
  ): { updatedCount: number; products: Product[] } {
    if (!productIds || productIds.length === 0) {
      return { updatedCount: 0, products: [] };
    }
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const updatedList: Product[] = [];
    const idSet = new Set(productIds);

    const changedFieldNames: string[] = [];
    if (updates.company_id !== undefined) changedFieldNames.push('Company');
    if (updates.brand !== undefined) changedFieldNames.push('Brand');
    if (updates.category !== undefined) changedFieldNames.push('Category');
    if (updates.gst_percent !== undefined) changedFieldNames.push('GST Slab');
    if (updates.hsn !== undefined) changedFieldNames.push('HSN');
    if (updates.trade_mode !== undefined || updates.allow_carton !== undefined || updates.allow_pieces !== undefined) changedFieldNames.push('Trade Mode');
    if (updates.units_per_box_carton !== undefined || updates.pieces_per_carton !== undefined) changedFieldNames.push('Pack Size / Ratio');
    if (updates.trading_unit !== undefined) changedFieldNames.push('Trading Unit');
    if (updates.base_unit !== undefined) changedFieldNames.push('Base Unit');
    if (updates.active !== undefined) changedFieldNames.push('Active Status');
    if (categoryIds !== undefined) changedFieldNames.push('Catalogue Categories');

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      if (idSet.has(prod.id)) {
        const oldProd = { ...prod };
        const unitsPerPack = updates.units_per_box_carton ?? updates.pieces_per_carton ?? updates.units_per_trading_unit ?? oldProd.units_per_box_carton ?? 1;
        const sellingPrice = updates.selling_price !== undefined ? updates.selling_price : oldProd.selling_price;
        const loosePriceMode = updates.loose_price_mode || oldProd.loose_price_mode || 'auto';
        
        let looseSellingPrice = updates.loose_selling_price !== undefined 
          ? updates.loose_selling_price 
          : oldProd.loose_selling_price;
          
        if (loosePriceMode === 'auto' && (updates.selling_price !== undefined || updates.units_per_box_carton !== undefined || updates.pieces_per_carton !== undefined || looseSellingPrice === undefined)) {
          looseSellingPrice = Math.round((sellingPrice / Math.max(1, unitsPerPack)) * 100) / 100;
        }

        const tradeMode: TradeMode = updates.trade_mode !== undefined
          ? updates.trade_mode
          : (updates.allow_carton !== undefined || updates.allow_pieces !== undefined
              ? (updates.allow_carton && updates.allow_pieces ? 'BOTH' : updates.allow_carton ? 'CARTONS' : updates.allow_pieces ? 'PIECES' : (oldProd.trade_mode || (unitsPerPack > 1 ? 'BOTH' : 'PIECES')))
              : (oldProd.trade_mode || (unitsPerPack > 1 ? 'BOTH' : 'PIECES')));

        const allowCarton = updates.allow_carton !== undefined ? updates.allow_carton : (tradeMode === 'CARTONS' || tradeMode === 'BOTH');
        const allowPieces = updates.allow_pieces !== undefined ? updates.allow_pieces : (tradeMode === 'PIECES' || tradeMode === 'BOTH');

        let packSize = updates.pack_size;
        if (!packSize && (updates.pieces_per_carton !== undefined || updates.units_per_box_carton !== undefined)) {
          packSize = `${unitsPerPack} ${updates.base_unit || oldProd.base_unit || 'Pieces'}/${updates.trading_unit || oldProd.trading_unit || 'Ctn'}`;
        }

        products[i] = {
          ...prod,
          ...updates,
          ...(packSize ? { pack_size: packSize, packing_display: packSize } : {}),
          business_id: prod.business_id || activeBiz,
          trade_mode: tradeMode,
          allow_carton: allowCarton,
          allow_pieces: allowPieces,
          pieces_per_carton: unitsPerPack,
          units_per_box_carton: unitsPerPack,
          units_per_trading_unit: unitsPerPack,
          loose_price_mode: loosePriceMode,
          loose_selling_price: looseSellingPrice,
          allow_loose_sale: updates.allow_loose_sale !== undefined ? updates.allow_loose_sale : allowPieces,
          base_unit: updates.base_unit || oldProd.base_unit || 'Packet',
          trading_unit: updates.trading_unit || oldProd.trading_unit || 'Carton',
          updated_at: new Date().toISOString()
        };
        updatedList.push(products[i]);

        if (categoryIds !== undefined) {
          this.setProductCategories(prod.id, categoryIds);
        }

        this.addItemActivityLog({
          product_id: prod.id,
          action: 'Bulk Update Applied',
          details: `Batch edited (${productIds.length} items): ${changedFieldNames.join(', ')}`,
          user_id: this.currentUserId,
          user_name: this.getCurrentUser().name
        });
      }
    }

    this.saveProducts(products, activeBiz);
    return { updatedCount: updatedList.length, products: updatedList };
  }

  deleteProduct(productId: string): boolean {
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const prodIdx = products.findIndex(p => p.id === productId);
    if (prodIdx === -1) return false;

    const prod = products[prodIdx];
    products.splice(prodIdx, 1);
    this.saveProducts(products, activeBiz);

    // Remove associated inventory
    const inventory = this.getInventory(activeBiz);
    const updatedInventory = inventory.filter(i => i.product_id !== productId);
    this.saveInventory(updatedInventory, activeBiz);

    // Remove associated batches
    const batches = this.getBatches(activeBiz);
    const updatedBatches = batches.filter(b => b.product_id !== productId);
    this.saveBatches(updatedBatches, activeBiz);

    // Remove from product-category junction
    const pcs = this.getProductCategories(activeBiz);
    const updatedPCs = pcs.filter(pc => pc.product_id !== productId);
    this.saveProductCategories(updatedPCs, activeBiz);

    this.addItemActivityLog({
      product_id: productId,
      action: 'Item Master Deleted',
      details: `Product "${prod.name}" (${prod.product_code || prod.id}) was permanently deleted.`,
      user_id: this.currentUserId,
      user_name: this.getCurrentUser().name
    });

    return true;
  }

  bulkDeleteProducts(productIds: string[]): { deletedCount: number; deletedIds: string[] } {
    if (!productIds || productIds.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const idSet = new Set(productIds);
    const deletedProducts: Product[] = [];
    const remainingProducts: Product[] = [];

    for (const p of products) {
      if (idSet.has(p.id)) {
        deletedProducts.push(p);
      } else {
        remainingProducts.push(p);
      }
    }

    if (deletedProducts.length === 0) {
      return { deletedCount: 0, deletedIds: [] };
    }

    this.saveProducts(remainingProducts, activeBiz);

    // Remove associated inventory
    const inventory = this.getInventory(activeBiz);
    const updatedInventory = inventory.filter(i => !idSet.has(i.product_id));
    this.saveInventory(updatedInventory, activeBiz);

    // Remove associated batches
    const batches = this.getBatches(activeBiz);
    const updatedBatches = batches.filter(b => !idSet.has(b.product_id));
    this.saveBatches(updatedBatches, activeBiz);

    // Remove from product-category junction
    const pcs = this.getProductCategories(activeBiz);
    const updatedPCs = pcs.filter(pc => !idSet.has(pc.product_id));
    this.saveProductCategories(updatedPCs, activeBiz);

    // Log activity for each deleted product
    const currentUser = this.getCurrentUser();
    for (const prod of deletedProducts) {
      this.addItemActivityLog({
        product_id: prod.id,
        action: 'Item Master Deleted (Bulk)',
        details: `Product "${prod.name}" (${prod.product_code || prod.id}) was permanently deleted via bulk delete (${deletedProducts.length} items).`,
        user_id: this.currentUserId,
        user_name: currentUser.name
      });
    }

    return {
      deletedCount: deletedProducts.length,
      deletedIds: deletedProducts.map(p => p.id)
    };
  }

  // ----------------------------------------------------
  // STOCK ADJUSTMENT (PHYSICAL/AVAILABLE AUDIT)
  // ----------------------------------------------------

  adjustStock(
    productId: string,
    adjustmentQty: number, // in base units (or primary unit)
    direction: 'IN' | 'OUT',
    reason: string,
    notes?: string,
    batchNumber?: string,
    godown?: string,
    cartonQty?: number,
    looseQty?: number,
    godownId?: string
  ): Inventory | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const inventory = this.getInventory(activeBiz);
    const godowns = this.getGodowns(activeBiz);
    const defGodown = godowns.find(g => g.is_default && g.status === 'Active') || godowns[0];
    const targetGodownId = godownId || (godown ? godowns.find(g => g.name === godown || g.id === godown)?.id : undefined) || defGodown?.id || 'gdn-saifee-main';
    const targetGodownName = godowns.find(g => g.id === targetGodownId)?.name || godown || 'Main Godown';

    let inv = inventory.find(i => i.product_id === productId && (i.godown_id === targetGodownId || !i.godown_id));
    if (!inv) {
      inv = {
        id: `inv-${productId}-${targetGodownId}`,
        product_id: productId,
        godown_id: targetGodownId,
        physical_qty: 0,
        reserved_qty: 0,
        available_qty: 0,
        damaged_qty: 0,
        expired_qty: 0,
        business_id: activeBiz,
        updated_at: new Date().toISOString()
      };
      inventory.push(inv);
    } else if (!inv.godown_id) {
      inv.godown_id = targetGodownId;
    }

    const products = this.getProducts(activeBiz);
    const prod = products.find(p => p.id === productId);
    const unitsPerPack = prod?.units_per_box_carton || 1;
    const tradingUnit = prod?.trading_unit || 'Carton';
    const baseUnit = prod?.base_unit || 'Packet';

    // Calculate effective base quantity
    let totalBaseChange = 0;
    if (cartonQty !== undefined || looseQty !== undefined) {
      totalBaseChange = calculateBaseQuantity(cartonQty || 0, looseQty || 0, unitsPerPack);
    } else {
      totalBaseChange = Math.abs(adjustmentQty);
    }

    const effectiveQty = direction === 'IN' ? totalBaseChange : -totalBaseChange;
    const oldPhysical = inv.physical_qty;
    const oldAvailable = inv.available_qty;

    if (direction === 'OUT' && inv.available_qty < totalBaseChange) {
      throw new Error(`Insufficient available stock (${inv.available_qty} ${baseUnit}s) in ${targetGodownName} for stock reduction of ${totalBaseChange} ${baseUnit}s`);
    }

    inv.physical_qty = Math.max(0, inv.physical_qty + effectiveQty);
    inv.available_qty = Math.max(0, inv.physical_qty - (inv.reserved_qty || 0));
    inv.updated_at = new Date().toISOString();
    this.saveInventory(inventory, activeBiz);

    // Update batch if provided or adjust batches
    const batches = this.getBatches(activeBiz);
    const prodBatches = batches.filter(b => b.product_id === productId && (b.godown_id === targetGodownId || b.godown === targetGodownName));
    if (prodBatches.length > 0) {
      if (batchNumber) {
        const targetBatch = prodBatches.find(b => b.batch_number === batchNumber);
        if (targetBatch) {
          targetBatch.quantity = Math.max(0, targetBatch.quantity + effectiveQty);
        }
      } else {
        if (effectiveQty > 0) {
          prodBatches[prodBatches.length - 1].quantity += effectiveQty;
        } else {
          let rem = Math.abs(effectiveQty);
          for (const b of prodBatches) {
            if (rem <= 0) break;
            const take = Math.min(b.quantity, rem);
            b.quantity -= take;
            rem -= take;
          }
        }
      }
      this.saveBatches(batches, activeBiz);
    } else if (direction === 'IN' && totalBaseChange > 0) {
      batches.push({
        id: `batch-${productId}-${targetGodownId}-${Date.now()}`,
        product_id: productId,
        godown_id: targetGodownId,
        godown: targetGodownName,
        batch_number: batchNumber || `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        expiry_date: '2027-12-31',
        purchase_rate: prod?.purchase_price || 0,
        mrp: prod?.mrp || 0,
        selling_price: prod?.selling_price,
        loose_selling_price: prod?.loose_selling_price,
        quantity: totalBaseChange,
        entry_date: new Date().toISOString().split('T')[0],
        business_id: activeBiz
      });
      this.saveBatches(batches, activeBiz);
    }

    // Record in immutable stock ledger (in base units)
    const ledger = this.getLedger(activeBiz);
    const ledgerEntry: StockLedgerEntry = {
      id: `led-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      business_id: activeBiz,
      product_id: productId,
      godown_id: targetGodownId,
      change_qty: effectiveQty,
      direction,
      reason: `Stock Adjustment (${reason}) - ${targetGodownName}`,
      reference_id: batchNumber || `ADJ-${Date.now().toString().slice(-6)}`,
      user_id: this.currentUserId,
      created_at: new Date().toISOString()
    };
    ledger.push(ledgerEntry);
    this.saveLedger(ledger, activeBiz);

    // Format human-friendly display text
    const displayQtyStr = formatQuantityDisplay(totalBaseChange, unitsPerPack, tradingUnit, baseUnit, true);
    const oldStockDisplay = formatQuantityDisplay(oldPhysical, unitsPerPack, tradingUnit, baseUnit);
    const newStockDisplay = formatQuantityDisplay(inv.physical_qty, unitsPerPack, tradingUnit, baseUnit);

    // Record in Item Activity Log
    this.addItemActivityLog({
      product_id: productId,
      action: direction === 'IN' ? 'Stock Added (Manual Adjustment)' : 'Stock Deducted (Manual Adjustment)',
      details: `${direction === 'IN' ? '+' : '-'}${displayQtyStr} (${targetGodownName}) - ${reason}${notes ? ` (${notes})` : ''}`,
      old_value: `${oldStockDisplay} (${oldPhysical} ${baseUnit}s)`,
      new_value: `${newStockDisplay} (${inv.physical_qty} ${baseUnit}s)`,
      user_id: this.currentUserId,
      user_name: this.getCurrentUser().name,
      reference_id: ledgerEntry.id
    });

    return inv;
  }

  createProduct(
    name: string,
    companyName: string,
    packing: string,
    hsn: string,
    gst: number,
    mrp: number = 0,
    rate: number = 0,
    categoryIds?: string[],
    baseUnit: BaseUnit = 'Packet',
    allowLooseSale: boolean = true,
    looseSellingPrice?: number,
    cartonDiscount: number = 0,
    looseDiscount: number = 0
  ): Product {
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const companies = this.getCompanies();
    
    let comp = companies.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === companyName.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (!comp) {
      comp = {
        id: `c-${Date.now()}`,
        name: companyName,
        code: companyName.substring(0, 5).toUpperCase(),
        active: true
      };
      companies.push(comp);
      this.saveStore('fmcg_companies', companies);
    }

    const unitsPerPack = parseInt(packing.match(/\d+/)?.[0] || '24', 10);
    const sellingPrice = rate || (mrp ? Math.round(mrp * 0.85) : 85);
    const calculatedLoosePrice = looseSellingPrice ?? Math.round((sellingPrice / Math.max(1, unitsPerPack)) * 100) / 100;

    const newProd: Product = {
      id: `prd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      business_id: activeBiz,
      product_code: `PRD-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      company_id: comp.id,
      brand: companyName,
      category: 'FMCG',
      subcategory: 'Groceries',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `BC-${Date.now().toString().slice(-8)}`,
      pack_size: packing,
      trading_unit: unitsPerPack === 1 ? 'Piece' : (packing.toLowerCase().includes('box') ? 'Box' : 'Carton'),
      base_unit: 'Piece',
      trade_mode: unitsPerPack > 1 ? (allowLooseSale ? 'BOTH' : 'CARTONS') : 'PIECES',
      allow_carton: unitsPerPack > 1,
      allow_pieces: unitsPerPack === 1 || allowLooseSale,
      pieces_per_carton: unitsPerPack,
      packing_display: packing,
      units_per_box_carton: unitsPerPack,
      units_per_trading_unit: unitsPerPack,
      allow_loose_sale: unitsPerPack === 1 || allowLooseSale,
      loose_price_mode: looseSellingPrice ? 'manual' : 'auto',
      loose_selling_price: calculatedLoosePrice,
      carton_discount: cartonDiscount,
      loose_discount: looseDiscount,
      mrp: mrp || (rate ? Math.round(rate * 1.2) : 100),
      selling_price: sellingPrice,
      purchase_price: rate ? Math.round(rate * 0.88) : (mrp ? Math.round(mrp * 0.75) : 75),
      loose_purchase_price: Math.round(((rate ? Math.round(rate * 0.88) : (mrp ? Math.round(mrp * 0.75) : 75)) / Math.max(1, unitsPerPack)) * 100) / 100,
      dealer_price: rate ? Math.round(rate * 0.95) : undefined,
      gst_percent: gst,
      hsn: hsn.trim(),
      batch_tracking_enabled: true,
      expiry_tracking_enabled: true,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    products.push(newProd);
    this.saveProducts(products, activeBiz);

    if (categoryIds && categoryIds.length > 0) {
      this.assignCategoriesToProduct(newProd.id, categoryIds);
    }

    const inventory = this.getInventory(activeBiz);
    const newInv: Inventory = {
      id: `inv-${newProd.id}`,
      business_id: activeBiz,
      product_id: newProd.id,
      physical_qty: 0,
      reserved_qty: 0,
      available_qty: 0,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: new Date().toISOString()
    };
    inventory.push(newInv);
    this.saveInventory(inventory, activeBiz);

    this.addItemActivityLog({
      product_id: newProd.id,
      action: 'Item Master Created',
      details: `Created new item "${newProd.name}" (${newProd.pack_size}) with base unit ${newProd.base_unit}, trading unit ${newProd.trading_unit} (Loose sale: ${allowLooseSale ? 'Yes' : 'No'})`,
      user_id: this.currentUserId,
      user_name: this.getCurrentUser().name
    });

    return newProd;
  }

  createFullProduct(productData: {
    name: string;
    company_id: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    pack_size: string;
    trading_unit: 'Box' | 'Carton' | 'Case' | 'Bag' | 'Bundle' | 'Dozen' | 'Other' | string;
    trade_mode?: TradeMode;
    allow_carton?: boolean;
    allow_pieces?: boolean;
    pieces_per_carton?: number;
    base_unit?: BaseUnit;
    units_per_box_carton?: number;
    units_per_trading_unit?: number;
    allow_loose_sale?: boolean;
    loose_price_mode?: 'auto' | 'manual';
    loose_selling_price?: number;
    loose_mrp?: number;
    carton_discount?: number;
    loose_discount?: number;
    mrp: number;
    purchase_price: number;
    loose_purchase_price?: number;
    selling_price: number;
    dealer_price?: number;
    gst_percent: number;
    hsn: string;
    sku?: string;
    barcode?: string;
    min_stock_level?: number;
    reorder_level?: number;
    batch_tracking_enabled?: boolean;
    expiry_tracking_enabled?: boolean;
    image_url?: string;
    active?: boolean;
    categoryIds?: string[];
    add_initial_stock?: boolean;
    initial_stock_qty?: number; // integer base units
    initial_carton_qty?: number;
    initial_loose_qty?: number;
    initial_purchase_rate?: number;
    initial_supplier_id?: string;
    initial_purchase_date?: string;
    initial_batch_number?: string;
    initial_expiry_date?: string;
    initial_godown?: string;
    initial_notes?: string;
  }): Product {
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const companies = this.getCompanies();
    const comp = companies.find(c => c.id === productData.company_id);

    const unitsPerPack = Math.max(1, productData.pieces_per_carton || productData.units_per_box_carton || productData.units_per_trading_unit || parseInt(productData.pack_size.match(/\d+/)?.[0] || '24', 10));
    
    let tradeMode: TradeMode = productData.trade_mode || 'PIECES';
    if (!productData.trade_mode) {
      if (productData.allow_carton && productData.allow_pieces) tradeMode = 'BOTH';
      else if (productData.allow_carton) tradeMode = 'CARTONS';
      else if (productData.allow_pieces) tradeMode = 'PIECES';
      else tradeMode = unitsPerPack > 1 ? 'BOTH' : 'PIECES';
    }

    const allowCarton = productData.allow_carton !== undefined ? productData.allow_carton : (tradeMode === 'CARTONS' || tradeMode === 'BOTH');
    const allowPieces = productData.allow_pieces !== undefined ? productData.allow_pieces : (tradeMode === 'PIECES' || tradeMode === 'BOTH');

    const loosePriceMode = productData.loose_price_mode || (productData.loose_selling_price ? 'manual' : 'auto');
    const looseSellingPrice = productData.loose_selling_price ?? (Math.round((productData.selling_price / unitsPerPack) * 100) / 100);
    const looseMrp = productData.loose_mrp ?? (Math.round((productData.mrp / unitsPerPack) * 100) / 100);
    const loosePurchasePrice = productData.loose_purchase_price ?? (Math.round((productData.purchase_price / unitsPerPack) * 100) / 100);

    const newProd: Product = {
      id: `prd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      business_id: activeBiz,
      product_code: `PRD-${Date.now().toString().slice(-6)}`,
      name: productData.name.trim(),
      company_id: productData.company_id,
      brand: productData.brand?.trim() || comp?.name || 'General',
      category: productData.category?.trim() || comp?.name || 'FMCG',
      subcategory: productData.subcategory?.trim() || 'General',
      description: productData.description?.trim() || '',
      sku: productData.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: productData.barcode?.trim() || `BC-${Date.now().toString().slice(-8)}`,
      pack_size: productData.pack_size.trim(),
      trading_unit: productData.trading_unit,
      trade_mode: tradeMode,
      allow_carton: allowCarton,
      allow_pieces: allowPieces,
      pieces_per_carton: unitsPerPack,
      base_unit: productData.base_unit || 'Packet',
      packing_display: productData.pack_size.trim(),
      units_per_box_carton: unitsPerPack,
      units_per_trading_unit: unitsPerPack,
      allow_loose_sale: allowPieces,
      loose_price_mode: loosePriceMode,
      loose_selling_price: looseSellingPrice,
      loose_mrp: looseMrp,
      loose_purchase_price: loosePurchasePrice,
      carton_discount: productData.carton_discount || 0,
      loose_discount: productData.loose_discount || 0,
      mrp: productData.mrp,
      selling_price: productData.selling_price,
      purchase_price: productData.purchase_price,
      dealer_price: productData.dealer_price,
      gst_percent: productData.gst_percent,
      hsn: productData.hsn.trim(),
      min_stock_level: productData.min_stock_level || 5,
      reorder_level: productData.reorder_level || 10,
      batch_tracking_enabled: productData.batch_tracking_enabled !== false,
      expiry_tracking_enabled: productData.expiry_tracking_enabled !== false,
      image_url: productData.image_url,
      active: productData.active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    products.push(newProd);
    this.saveProducts(products, activeBiz);

    if (productData.categoryIds && productData.categoryIds.length > 0) {
      this.assignCategoriesToProduct(newProd.id, productData.categoryIds);
    }

    // Calculate initial stock in base units
    const shouldAddStock = productData.add_initial_stock !== false;
    let initialCartonQty = Math.max(0, productData.initial_carton_qty || 0);
    let initialLooseQty = Math.max(0, productData.initial_loose_qty || 0);
    let initBaseQty = 0;

    if (shouldAddStock) {
      if (productData.initial_carton_qty !== undefined || productData.initial_loose_qty !== undefined) {
        initBaseQty = calculateBaseQuantity(initialCartonQty, initialLooseQty, unitsPerPack);
      } else if (productData.initial_stock_qty !== undefined && productData.initial_stock_qty > 0) {
        initBaseQty = Math.floor(productData.initial_stock_qty);
        const split = splitBaseQuantity(initBaseQty, unitsPerPack);
        initialCartonQty = split.cartonQty;
        initialLooseQty = split.looseQty;
      }
    }

    // 1. Inventory Record
    const inventory = this.getInventory(activeBiz);
    const newInv: Inventory = {
      id: `inv-${newProd.id}`,
      business_id: activeBiz,
      product_id: newProd.id,
      physical_qty: initBaseQty,
      reserved_qty: 0,
      available_qty: initBaseQty,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: new Date().toISOString()
    };
    inventory.push(newInv);
    this.saveInventory(inventory, activeBiz);

    if (initBaseQty > 0) {
      const initialPurchaseRate = productData.initial_purchase_rate !== undefined && productData.initial_purchase_rate > 0
        ? productData.initial_purchase_rate
        : productData.purchase_price;
      const initialLoosePurchaseRate = Math.round((initialPurchaseRate / unitsPerPack) * 100) / 100;
      
      const suppliers = this.getSuppliers(activeBiz);
      const defaultSupplier = suppliers[0];
      const supplierId = productData.initial_supplier_id || defaultSupplier?.id || 's-parle-agency';
      const purchaseDate = productData.initial_purchase_date || new Date().toISOString().split('T')[0];
      const batchNumber = productData.initial_batch_number?.trim() || `BCH-${new Date().getFullYear()}-01`;
      const expiryDate = productData.initial_expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const godown = productData.initial_godown || 'Central Godown (Indore Hub)';
      const invoiceNumber = `OPENING-${newProd.product_code}`;
      const totalAmount = Math.round(((initialCartonQty * initialPurchaseRate) + (initialLooseQty * initialLoosePurchaseRate)) * 100) / 100;

      // 2. Batches
      const batches = this.getBatches(activeBiz);
      batches.push({
        id: `bch-${newProd.id}-init-${Date.now()}`,
        business_id: activeBiz,
        product_id: newProd.id,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        purchase_rate: initialPurchaseRate,
        mrp: newProd.mrp,
        selling_price: newProd.selling_price,
        loose_selling_price: looseSellingPrice,
        quantity: initBaseQty,
        godown: godown,
        entry_date: purchaseDate,
        cost_layer: invoiceNumber
      });
      this.saveBatches(batches, activeBiz);

      // 3. Purchase Stock Record (Opening Stock Transaction)
      const purchases = this.getPurchases(activeBiz);
      const purId = `pur-init-${newProd.id}`;
      const newPurchase: Purchase = {
        id: purId,
        business_id: activeBiz,
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        invoice_date: purchaseDate,
        total_amount: Math.round(totalAmount),
        status: 'Confirmed',
        created_at: new Date().toISOString(),
        items: [
          {
            id: `puritem-${newProd.id}`,
            purchase_id: purId,
            product_id: newProd.id,
            quantity: initBaseQty,
            carton_qty: initialCartonQty,
            loose_qty: initialLooseQty,
            base_qty: initBaseQty,
            trading_unit: newProd.trading_unit,
            base_unit: newProd.base_unit || 'Piece',
            units_per_trading_unit: unitsPerPack,
            units_per_box_carton: unitsPerPack,
            purchase_rate: initialPurchaseRate,
            carton_rate: initialPurchaseRate,
            loose_purchase_rate: initialLoosePurchaseRate,
            loose_rate: initialLoosePurchaseRate,
            discount: 0,
            free_quantity: 0,
            mrp: newProd.mrp,
            gst_percent: newProd.gst_percent,
            hsn: newProd.hsn,
            batch: batchNumber,
            expiry_date: expiryDate
          }
        ]
      };
      purchases.push(newPurchase);
      this.savePurchases(purchases, activeBiz);

      // 4. Stock Ledger Record (Double-entry audit)
      const ledger = this.getLedger(activeBiz);
      ledger.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        business_id: activeBiz,
        product_id: newProd.id,
        change_qty: initBaseQty,
        previous_qty: 0,
        new_qty: initBaseQty,
        direction: 'IN',
        reason: 'Opening Stock / Initial Purchase',
        reference_id: invoiceNumber,
        user_id: this.currentUserId,
        created_at: new Date().toISOString()
      });
      this.saveLedger(ledger, activeBiz);
    }

    const stockDisplayStr = formatQuantityDisplay(initBaseQty, unitsPerPack, newProd.trading_unit, newProd.base_unit || 'Packet', true);
    this.addItemActivityLog({
      product_id: newProd.id,
      action: 'Item Master Created',
      details: initBaseQty > 0 
        ? `Created new item "${newProd.name}" (${newProd.pack_size}) with initial purchase stock ${stockDisplayStr}`
        : `Created new item "${newProd.name}" (${newProd.pack_size}) with 0 initial stock`,
      user_id: this.currentUserId,
      user_name: this.getCurrentUser().name
    });

    return newProd;
  }

  createProductVariant(parentProductId: string, variantData: {
    name?: string;
    pack_size: string;
    trading_unit: 'Box' | 'Carton' | 'Case' | 'Bag' | 'Bundle' | 'Dozen' | 'Other' | string;
    trade_mode?: TradeMode;
    allow_carton?: boolean;
    allow_pieces?: boolean;
    pieces_per_carton?: number;
    base_unit?: BaseUnit;
    units_per_box_carton?: number;
    units_per_trading_unit?: number;
    allow_loose_sale?: boolean;
    loose_price_mode?: 'auto' | 'manual';
    loose_selling_price?: number;
    carton_discount?: number;
    loose_discount?: number;
    mrp: number;
    purchase_price?: number;
    selling_price?: number;
    dealer_price?: number;
    hsn?: string;
    gst_percent?: number;
    sku?: string;
    barcode?: string;
    variant_attribute?: string;
    variant_value?: string;
    categoryIds?: string[];
  }): Product {
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const parent = products.find(p => p.id === parentProductId);
    if (!parent) throw new Error('Parent product not found');

    const tradeMode: TradeMode = variantData.trade_mode || (variantData.allow_carton && variantData.allow_pieces ? 'BOTH' : variantData.allow_carton ? 'CARTONS' : 'PIECES');
    const allowCarton = variantData.allow_carton !== undefined ? variantData.allow_carton : (tradeMode !== 'PIECES');
    const allowPieces = variantData.allow_pieces !== undefined ? variantData.allow_pieces : (tradeMode !== 'CARTONS');
    const unitsPerPack = allowCarton 
      ? Math.max(1, variantData.pieces_per_carton || variantData.units_per_box_carton || parseInt(variantData.pack_size.match(/\d+/)?.[0] || '24', 10))
      : 1;
    const piecesPerCarton = unitsPerPack;

    const variantName = variantData.name?.trim() || `${parent.brand} ${parent.name.replace(/\s*\([^)]*\)/g, '').replace(/\s*\d+g|\d+kg|\d+ml|\d+l/gi, '')} ${variantData.pack_size}`.trim();
    const sellingPrice = variantData.selling_price || (variantData.purchase_price ? Math.round(variantData.purchase_price * 1.15) : Math.round(variantData.mrp * 0.9));
    const looseSellingPrice = variantData.loose_selling_price ?? Math.round((sellingPrice / Math.max(1, unitsPerPack)) * 100) / 100;

    const newVariant: Product = {
      id: `prd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      business_id: activeBiz,
      product_code: `PRD-${Date.now().toString().slice(-6)}`,
      name: variantName,
      company_id: parent.company_id,
      brand: parent.brand,
      category: parent.category,
      subcategory: parent.subcategory,
      description: parent.description,
      sku: variantData.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      barcode: variantData.barcode?.trim() || `BC-${Date.now().toString().slice(-8)}`,
      pack_size: tradeMode === 'PIECES' ? variantData.pack_size.trim() : `${piecesPerCarton} Pieces/Ctn`,
      trading_unit: tradeMode === 'PIECES' ? 'Piece' : variantData.trading_unit,
      trade_mode: tradeMode,
      allow_carton: allowCarton,
      allow_pieces: allowPieces,
      pieces_per_carton: piecesPerCarton,
      base_unit: variantData.base_unit || parent.base_unit || 'Piece',
      packing_display: tradeMode === 'PIECES' ? variantData.pack_size.trim() : `${piecesPerCarton} Pieces/Ctn`,
      units_per_box_carton: unitsPerPack,
      units_per_trading_unit: unitsPerPack,
      allow_loose_sale: allowPieces,
      loose_price_mode: variantData.loose_price_mode || 'auto',
      loose_selling_price: looseSellingPrice,
      carton_discount: variantData.carton_discount || 0,
      loose_discount: variantData.loose_discount || 0,
      mrp: variantData.mrp,
      selling_price: sellingPrice,
      purchase_price: variantData.purchase_price || Math.round(variantData.mrp * 0.8),
      loose_purchase_price: Math.round(((variantData.purchase_price || Math.round(variantData.mrp * 0.8)) / Math.max(1, unitsPerPack)) * 100) / 100,
      dealer_price: variantData.dealer_price,
      gst_percent: variantData.gst_percent !== undefined ? variantData.gst_percent : parent.gst_percent,
      hsn: variantData.hsn?.trim() || parent.hsn,
      min_stock_level: parent.min_stock_level || 5,
      reorder_level: parent.reorder_level || 10,
      batch_tracking_enabled: parent.batch_tracking_enabled !== false,
      expiry_tracking_enabled: parent.expiry_tracking_enabled !== false,
      parent_product_id: parentProductId,
      variant_attribute: variantData.variant_attribute || 'Pack Size',
      variant_value: variantData.variant_value || variantData.pack_size,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    products.push(newVariant);
    this.saveProducts(products, activeBiz);

    const initialCategories = variantData.categoryIds ?? this.getCategoryIdsForProduct(parentProductId);
    if (initialCategories && initialCategories.length > 0) {
      this.assignCategoriesToProduct(newVariant.id, initialCategories);
    }

    const inventory = this.getInventory(activeBiz);
    const newInv: Inventory = {
      id: `inv-${newVariant.id}`,
      business_id: activeBiz,
      product_id: newVariant.id,
      physical_qty: 0,
      reserved_qty: 0,
      available_qty: 0,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: new Date().toISOString()
    };
    inventory.push(newInv);
    this.saveInventory(inventory, activeBiz);

    this.addItemActivityLog({
      product_id: parentProductId,
      action: 'Variant Created',
      details: `Added new variant "${newVariant.name}" (${newVariant.pack_size})`,
      reference_id: newVariant.id,
      user_id: this.currentUserId,
      user_name: this.getCurrentUser().name
    });

    this.addItemActivityLog({
      product_id: newVariant.id,
      action: 'Item Master Created',
      details: `Created as variant of "${parent.name}"`,
      reference_id: parentProductId,
      user_id: this.currentUserId,
      user_name: this.getCurrentUser().name
    });

    return newVariant;
  }

  // ----------------------------------------------------
  // GODOWNS / WAREHOUSES MANAGEMENT
  // ----------------------------------------------------

  getGodowns(targetBusinessId?: string): Godown[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Godown>('fmcg_godowns', SEED_GODOWNS);
    return all.filter(g => (g.company_id || 'biz-saifee') === activeBiz);
  }

  getAllGodowns(): Godown[] {
    return this.getStore<Godown>('fmcg_godowns', SEED_GODOWNS);
  }

  saveGodowns(godowns: Godown[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Godown>('fmcg_godowns', SEED_GODOWNS);
    const otherBiz = all.filter(g => (g.company_id || 'biz-saifee') !== activeBiz);
    const tagged = godowns.map(g => ({ ...g, company_id: g.company_id || activeBiz }));
    this.saveStore('fmcg_godowns', [...otherBiz, ...tagged]);
  }

  getDefaultGodown(targetBusinessId?: string): Godown | undefined {
    const godowns = this.getGodowns(targetBusinessId);
    return godowns.find(g => g.is_default && g.status === 'Active') || godowns[0];
  }

  createGodown(data: Omit<Godown, 'id' | 'created_at' | 'updated_at'>, targetBusinessId?: string): Godown {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const godowns = this.getGodowns(activeBiz);
    
    // Validate uniqueness of code within company
    const code = data.code.trim().toUpperCase();
    if (godowns.some(g => g.code.toUpperCase() === code)) {
      throw new Error(`Godown code "${code}" already exists for this business.`);
    }

    // If marked as default, unset others
    if (data.is_default) {
      godowns.forEach(g => { g.is_default = false; });
    }

    const newGodown: Godown = {
      id: `gdn-${activeBiz}-${Date.now()}`,
      company_id: activeBiz,
      name: data.name.trim(),
      code,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      manager_name: data.manager_name,
      phone: data.phone,
      is_default: data.is_default || godowns.length === 0,
      status: data.status || 'Active',
      created_at: new Date().toISOString()
    };

    godowns.push(newGodown);
    this.saveGodowns(godowns, activeBiz);

    // Initialize 0-inventory rows for existing products in this new godown
    const inventory = this.getInventory(activeBiz);
    const products = this.getProducts(activeBiz);
    products.forEach(p => {
      const exists = inventory.some(i => i.product_id === p.id && i.godown_id === newGodown.id);
      if (!exists) {
        inventory.push({
          id: `inv-${p.id}-${newGodown.id}`,
          product_id: p.id,
          godown_id: newGodown.id,
          physical_qty: 0,
          reserved_qty: 0,
          available_qty: 0,
          damaged_qty: 0,
          expired_qty: 0,
          business_id: activeBiz,
          updated_at: new Date().toISOString()
        });
      }
    });
    this.saveInventory(inventory, activeBiz);

    return newGodown;
  }

  updateGodown(id: string, updates: Partial<Godown>, targetBusinessId?: string): Godown | null {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const godowns = this.getGodowns(activeBiz);
    const g = godowns.find(item => item.id === id);
    if (!g) return null;

    if (updates.is_default) {
      godowns.forEach(item => { item.is_default = false; });
    }

    Object.assign(g, updates, { updated_at: new Date().toISOString() });
    this.saveGodowns(godowns, activeBiz);
    return g;
  }

  setDefaultGodown(id: string, targetBusinessId?: string): Godown | null {
    return this.updateGodown(id, { is_default: true }, targetBusinessId);
  }

  toggleGodownStatus(id: string, targetBusinessId?: string): Godown | null {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const godowns = this.getGodowns(activeBiz);
    const g = godowns.find(item => item.id === id);
    if (!g) return null;

    const newStatus = g.status === 'Active' ? 'Inactive' : 'Active';
    if (newStatus === 'Inactive' && g.is_default) {
      g.is_default = false;
      const otherActive = godowns.find(item => item.id !== id && item.status === 'Active');
      if (otherActive) otherActive.is_default = true;
    }

    g.status = newStatus;
    g.updated_at = new Date().toISOString();
    this.saveGodowns(godowns, activeBiz);
    return g;
  }

  // ----------------------------------------------------
  // INVENTORY & STOCK AGGREGATIONS (GODOWN-AWARE & CONSOLIDATED)
  // ----------------------------------------------------

  getInventory(targetBusinessId?: string, godownId?: string): Inventory[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Inventory>('fmcg_inventory', SEED_INVENTORY);
    let scoped = all.filter(i => (i.business_id || 'biz-saifee') === activeBiz);
    
    // Auto-migrate any legacy items lacking godown_id to default godown (e.g. gdn-saifee-main)
    const defaultGodown = this.getDefaultGodown(activeBiz);
    const defGodownId = defaultGodown?.id || (activeBiz === 'biz-saifee' ? 'gdn-saifee-main' : 'gdn-hub-a');
    let migrated = false;
    scoped = scoped.map(i => {
      if (!i.godown_id) {
        migrated = true;
        return { ...i, godown_id: defGodownId };
      }
      return i;
    });
    if (migrated) {
      this.saveInventory(scoped, activeBiz);
    }

    if (godownId && godownId !== 'all') {
      return scoped.filter(i => i.godown_id === godownId);
    }

    return scoped;
  }

  getAllInventory(): Inventory[] {
    return this.getStore<Inventory>('fmcg_inventory', SEED_INVENTORY);
  }

  saveInventory(inventory: Inventory[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Inventory>('fmcg_inventory', SEED_INVENTORY);
    const otherBiz = all.filter(i => (i.business_id || 'biz-saifee') !== activeBiz);
    const tagged = inventory.map(i => ({ ...i, business_id: i.business_id || activeBiz }));
    this.saveStore('fmcg_inventory', [...otherBiz, ...tagged]);
  }

  getConsolidatedInventory(targetBusinessId?: string): (Inventory & {
    godownBreakdown: {
      [godownId: string]: {
        physical: number;
        reserved: number;
        available: number;
        damaged: number;
        expired: number;
      };
    };
  })[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const rawInv = this.getInventory(activeBiz);
    const godowns = this.getGodowns(activeBiz);

    return products.map(prod => {
      const prodRows = rawInv.filter(i => i.product_id === prod.id);
      let totPhysical = 0;
      let totReserved = 0;
      let totAvailable = 0;
      let totDamaged = 0;
      let totExpired = 0;

      const breakdown: { [godownId: string]: { physical: number; reserved: number; available: number; damaged: number; expired: number } } = {};
      godowns.forEach(g => {
        const row = prodRows.find(r => r.godown_id === g.id);
        const p = row?.physical_qty || 0;
        const r = row?.reserved_qty || 0;
        const a = row ? (row.available_qty !== undefined ? row.available_qty : Math.max(0, p - r)) : 0;
        const d = row?.damaged_qty || 0;
        const e = row?.expired_qty || 0;

        breakdown[g.id] = { physical: p, reserved: r, available: a, damaged: d, expired: e };
        totPhysical += p;
        totReserved += r;
        totAvailable += a;
        totDamaged += d;
        totExpired += e;
      });

      return {
        id: `inv-cons-${prod.id}`,
        product_id: prod.id,
        godown_id: 'all',
        physical_qty: totPhysical,
        reserved_qty: totReserved,
        available_qty: totAvailable,
        damaged_qty: totDamaged,
        expired_qty: totExpired,
        business_id: activeBiz,
        updated_at: new Date().toISOString(),
        godownBreakdown: breakdown
      };
    });
  }

  getBatches(targetBusinessId?: string): InventoryBatch[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<InventoryBatch>('fmcg_batches', SEED_BATCHES);
    return all.filter(b => (b.business_id || 'biz-saifee') === activeBiz);
  }

  getAllBatches(): InventoryBatch[] {
    return this.getStore<InventoryBatch>('fmcg_batches', SEED_BATCHES);
  }

  saveBatches(batches: InventoryBatch[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<InventoryBatch>('fmcg_batches', SEED_BATCHES);
    const otherBiz = all.filter(b => (b.business_id || 'biz-saifee') !== activeBiz);
    const tagged = batches.map(b => ({ ...b, business_id: b.business_id || activeBiz }));
    this.saveStore('fmcg_batches', [...otherBiz, ...tagged]);
  }

  // ----------------------------------------------------
  // INTER-GODOWN STOCK TRANSFERS
  // ----------------------------------------------------

  getStockTransfers(targetBusinessId?: string): StockTransfer[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<StockTransfer>('fmcg_stock_transfers', SEED_STOCK_TRANSFERS);
    return all.filter(t => (t.company_id || 'biz-saifee') === activeBiz);
  }

  saveStockTransfers(transfers: StockTransfer[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<StockTransfer>('fmcg_stock_transfers', SEED_STOCK_TRANSFERS);
    const otherBiz = all.filter(t => (t.company_id || 'biz-saifee') !== activeBiz);
    const tagged = transfers.map(t => ({ ...t, company_id: t.company_id || activeBiz }));
    this.saveStore('fmcg_stock_transfers', [...otherBiz, ...tagged]);
  }

  createStockTransfer(data: {
    fromGodownId: string;
    toGodownId: string;
    notes?: string;
    items: {
      productId: string;
      batchId?: string;
      batchNumber?: string;
      cartonQty?: number;
      looseQty?: number;
      quantity?: number; // base units
    }[];
    autoDispatch?: boolean;
  }, targetBusinessId?: string): StockTransfer {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const transfers = this.getStockTransfers(activeBiz);
    const products = this.getProducts(activeBiz);

    if (data.fromGodownId === data.toGodownId) {
      throw new Error('Source and destination godowns cannot be identical.');
    }

    const year = new Date().getFullYear();
    const existingCount = transfers.filter(t => (t.transfer_number || '').includes(`TR-${year}`)).length;
    const transferNumber = `TR-${year}-${String(existingCount + 1).padStart(5, '0')}`;
    const transferId = `tr-${Date.now()}`;

    const items: StockTransferItem[] = data.items.map(it => {
      const prod = products.find(p => p.id === it.productId);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      let baseQty = it.quantity !== undefined ? it.quantity : calculateBaseQuantity(it.cartonQty || 0, it.looseQty || 0, unitsPerPack);
      let cQty = it.cartonQty !== undefined ? it.cartonQty : Math.floor(baseQty / unitsPerPack);
      let lQty = it.looseQty !== undefined ? it.looseQty : (baseQty % unitsPerPack);

      return {
        id: `tr-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        transfer_id: transferId,
        product_id: it.productId,
        batch_id: it.batchId,
        batch_number: it.batchNumber,
        quantity: baseQty,
        carton_qty: cQty,
        loose_qty: lQty,
        received_qty: 0,
        received_carton_qty: 0,
        received_loose_qty: 0
      };
    });

    const newTransfer: StockTransfer = {
      id: transferId,
      transfer_number: transferNumber,
      company_id: activeBiz,
      from_godown_id: data.fromGodownId,
      to_godown_id: data.toGodownId,
      status: 'Draft',
      requested_by: this.currentUserId,
      notes: data.notes,
      created_at: new Date().toISOString(),
      items
    };

    transfers.push(newTransfer);
    this.saveStockTransfers(transfers, activeBiz);

    if (data.autoDispatch) {
      return this.dispatchStockTransfer(transferId, activeBiz);
    }

    return newTransfer;
  }

  dispatchStockTransfer(transferId: string, targetBusinessId?: string): StockTransfer {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const transfers = this.getStockTransfers(activeBiz);
    const tr = transfers.find(t => t.id === transferId);
    if (!tr) throw new Error('Stock transfer not found');
    if (tr.status === 'Dispatched' || tr.status === 'Completed' || tr.status === 'Received') {
      return tr;
    }

    const inventory = this.getInventory(activeBiz);
    const batches = this.getBatches(activeBiz);
    const ledgers = this.getLedger(activeBiz);
    const godowns = this.getGodowns(activeBiz);
    const fromGodown = godowns.find(g => g.id === tr.from_godown_id);
    const toGodown = godowns.find(g => g.id === tr.to_godown_id);

    // Validate available stock in from_godown
    tr.items.forEach(it => {
      let invRow = inventory.find(i => i.product_id === it.product_id && i.godown_id === tr.from_godown_id);
      if (!invRow || invRow.available_qty < it.quantity) {
        const avail = invRow?.available_qty || 0;
        throw new Error(`Insufficient available stock in ${fromGodown?.name || 'source godown'} for product (${avail} available, ${it.quantity} requested).`);
      }
    });

    // Deduct stock from from_godown
    tr.items.forEach(it => {
      let invRow = inventory.find(i => i.product_id === it.product_id && i.godown_id === tr.from_godown_id);
      if (invRow) {
        invRow.physical_qty = Math.max(0, invRow.physical_qty - it.quantity);
        invRow.available_qty = Math.max(0, invRow.physical_qty - (invRow.reserved_qty || 0));
        invRow.updated_at = new Date().toISOString();
      }

      // Update batches in from_godown
      if (it.batch_number) {
        const b = batches.find(batch => batch.product_id === it.product_id && (batch.godown_id === tr.from_godown_id || batch.godown === fromGodown?.name) && batch.batch_number === it.batch_number);
        if (b) {
          b.quantity = Math.max(0, b.quantity - it.quantity);
        }
      }

      // Log Ledger Out
      ledgers.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        product_id: it.product_id,
        godown_id: tr.from_godown_id,
        change_qty: -it.quantity,
        direction: 'OUT',
        reason: `Stock Transfer Out (${fromGodown?.name} -> ${toGodown?.name})`,
        reference_id: tr.transfer_number,
        user_id: this.currentUserId,
        business_id: activeBiz,
        created_at: new Date().toISOString()
      });
    });

    tr.status = 'Dispatched';
    tr.dispatched_at = new Date().toISOString();
    tr.updated_at = new Date().toISOString();

    this.saveInventory(inventory, activeBiz);
    this.saveBatches(batches, activeBiz);
    this.saveLedger(ledgers, activeBiz);
    this.saveStockTransfers(transfers, activeBiz);

    return tr;
  }

  receiveStockTransfer(
    transferId: string,
    itemReceipts?: {
      itemId: string;
      receivedQty: number; // in base units
      receivedCartonQty?: number;
      receivedLooseQty?: number;
    }[],
    targetBusinessId?: string
  ): StockTransfer {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const transfers = this.getStockTransfers(activeBiz);
    const tr = transfers.find(t => t.id === transferId);
    if (!tr) throw new Error('Stock transfer not found');
    if (tr.status === 'Completed') return tr;

    const inventory = this.getInventory(activeBiz);
    const batches = this.getBatches(activeBiz);
    const ledgers = this.getLedger(activeBiz);
    const godowns = this.getGodowns(activeBiz);
    const products = this.getProducts(activeBiz);
    const fromGodown = godowns.find(g => g.id === tr.from_godown_id);
    const toGodown = godowns.find(g => g.id === tr.to_godown_id);

    let allItemsFullyReceived = true;

    tr.items.forEach(it => {
      const prod = products.find(p => p.id === it.product_id);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      const receipt = itemReceipts?.find(r => r.itemId === it.id);

      let deltaToReceive = 0;
      if (receipt) {
        let proposedBase = receipt.receivedQty !== undefined ? receipt.receivedQty : calculateBaseQuantity(receipt.receivedCartonQty || 0, receipt.receivedLooseQty || 0, unitsPerPack);
        deltaToReceive = Math.max(0, Math.min(it.quantity - (it.received_qty || 0), proposedBase));
      } else {
        // Full receipt of remaining
        deltaToReceive = Math.max(0, it.quantity - (it.received_qty || 0));
      }

      if (deltaToReceive > 0) {
        it.received_qty = (it.received_qty || 0) + deltaToReceive;
        it.received_carton_qty = Math.floor(it.received_qty / unitsPerPack);
        it.received_loose_qty = it.received_qty % unitsPerPack;

        // Increase to_godown stock
        let toInv = inventory.find(i => i.product_id === it.product_id && i.godown_id === tr.to_godown_id);
        if (!toInv) {
          toInv = {
            id: `inv-${it.product_id}-${tr.to_godown_id}`,
            product_id: it.product_id,
            godown_id: tr.to_godown_id,
            physical_qty: deltaToReceive,
            reserved_qty: 0,
            available_qty: deltaToReceive,
            damaged_qty: 0,
            expired_qty: 0,
            business_id: activeBiz,
            updated_at: new Date().toISOString()
          };
          inventory.push(toInv);
        } else {
          toInv.physical_qty += deltaToReceive;
          toInv.available_qty = toInv.physical_qty - (toInv.reserved_qty || 0);
          toInv.updated_at = new Date().toISOString();
        }

        // Add/update batch in to_godown
        if (it.batch_number) {
          let toBatch = batches.find(b => b.product_id === it.product_id && (b.godown_id === tr.to_godown_id || b.godown === toGodown?.name) && b.batch_number === it.batch_number);
          if (toBatch) {
            toBatch.quantity += deltaToReceive;
          } else {
            const srcBatch = batches.find(b => b.product_id === it.product_id && b.batch_number === it.batch_number);
            batches.push({
              id: `batch-${it.product_id}-${tr.to_godown_id}-${Date.now()}`,
              product_id: it.product_id,
              godown_id: tr.to_godown_id,
              godown: toGodown?.name || 'Secondary Godown',
              batch_number: it.batch_number,
              mfg_date: srcBatch?.mfg_date || '2026-06-01',
              expiry_date: srcBatch?.expiry_date || '2027-06-30',
              purchase_rate: srcBatch?.purchase_rate || prod?.purchase_price || 0,
              mrp: srcBatch?.mrp || prod?.mrp || 0,
              selling_price: srcBatch?.selling_price || prod?.selling_price,
              loose_selling_price: srcBatch?.loose_selling_price || prod?.loose_selling_price,
              quantity: deltaToReceive,
              entry_date: new Date().toISOString().split('T')[0],
              business_id: activeBiz
            });
          }
        }

        // Ledger In
        ledgers.push({
          id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          product_id: it.product_id,
          godown_id: tr.to_godown_id,
          change_qty: deltaToReceive,
          direction: 'IN',
          reason: `Stock Transfer In (${fromGodown?.name} -> ${toGodown?.name})`,
          reference_id: tr.transfer_number,
          user_id: this.currentUserId,
          business_id: activeBiz,
          created_at: new Date().toISOString()
        });
      }

      if ((it.received_qty || 0) < it.quantity) {
        allItemsFullyReceived = false;
      }
    });

    tr.status = allItemsFullyReceived ? 'Completed' : 'Received';
    tr.received_at = new Date().toISOString();
    tr.updated_at = new Date().toISOString();

    this.saveInventory(inventory, activeBiz);
    this.saveBatches(batches, activeBiz);
    this.saveLedger(ledgers, activeBiz);
    this.saveStockTransfers(transfers, activeBiz);

    return tr;
  }

  cancelStockTransfer(transferId: string, targetBusinessId?: string): StockTransfer {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const transfers = this.getStockTransfers(activeBiz);
    const tr = transfers.find(t => t.id === transferId);
    if (!tr) throw new Error('Stock transfer not found');
    if (tr.status === 'Completed' || tr.status === 'Cancelled') {
      return tr;
    }

    // If dispatched, return remaining unreceived quantities to from_godown
    if (tr.status === 'Dispatched' || tr.status === 'Received') {
      const inventory = this.getInventory(activeBiz);
      const batches = this.getBatches(activeBiz);
      const ledgers = this.getLedger(activeBiz);
      const godowns = this.getGodowns(activeBiz);
      const fromGodown = godowns.find(g => g.id === tr.from_godown_id);

      tr.items.forEach(it => {
        const unreceived = it.quantity - (it.received_qty || 0);
        if (unreceived > 0) {
          let fromInv = inventory.find(i => i.product_id === it.product_id && i.godown_id === tr.from_godown_id);
          if (fromInv) {
            fromInv.physical_qty += unreceived;
            fromInv.available_qty = fromInv.physical_qty - (fromInv.reserved_qty || 0);
            fromInv.updated_at = new Date().toISOString();
          }

          if (it.batch_number) {
            let b = batches.find(batch => batch.product_id === it.product_id && (batch.godown_id === tr.from_godown_id || batch.godown === fromGodown?.name) && batch.batch_number === it.batch_number);
            if (b) {
              b.quantity += unreceived;
            }
          }

          ledgers.push({
            id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            product_id: it.product_id,
            godown_id: tr.from_godown_id,
            change_qty: unreceived,
            direction: 'IN',
            reason: `Stock Transfer Cancelled (${tr.transfer_number})`,
            reference_id: tr.transfer_number,
            user_id: this.currentUserId,
            business_id: activeBiz,
            created_at: new Date().toISOString()
          });
        }
      });

      this.saveInventory(inventory, activeBiz);
      this.saveBatches(batches, activeBiz);
      this.saveLedger(ledgers, activeBiz);
    }

    tr.status = 'Cancelled';
    tr.updated_at = new Date().toISOString();
    this.saveStockTransfers(transfers, activeBiz);
    return tr;
  }

  getLedger(targetBusinessId?: string): StockLedgerEntry[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<StockLedgerEntry>('fmcg_ledger', SEED_LEDGER);
    return all.filter(l => (l.business_id || 'biz-saifee') === activeBiz);
  }

  getAllLedger(): StockLedgerEntry[] {
    return this.getStore<StockLedgerEntry>('fmcg_ledger', SEED_LEDGER);
  }

  saveLedger(ledger: StockLedgerEntry[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<StockLedgerEntry>('fmcg_ledger', SEED_LEDGER);
    const otherBiz = all.filter(l => (l.business_id || 'biz-saifee') !== activeBiz);
    const tagged = ledger.map(l => ({ ...l, business_id: l.business_id || activeBiz }));
    this.saveStore('fmcg_ledger', [...otherBiz, ...tagged]);
  }

  private refreshAllOrders(orders: Order[], fulfilments: Fulfilment[]): void {
    const products = this.getProducts();
    orders.forEach(order => {
      if (!order.items) return;

      order.items.forEach(item => {
        const itemBaseQty = item.base_qty ?? item.quantity;
        if (item.cancelled_qty === undefined) item.cancelled_qty = 0;
        if (item.confirmed_qty === undefined) item.confirmed_qty = 0;
        if (item.packed_qty === undefined) item.packed_qty = 0;
        if (item.dispatched_qty === undefined) item.dispatched_qty = 0;
        if (item.delivered_qty === undefined) item.delivered_qty = 0;

        // Sync higher counts from any active external fulfilments if they exist
        fulfilments.forEach(ful => {
          if (ful.status === 'Cancelled') return;
          
          // Match by specific source_orders_breakdown for this order, or direct item ID
          const fItem = ful.items?.find(fi => 
            fi.order_item_id === item.id ||
            fi.source_orders_breakdown?.some(sob => sob.order_id === order.id && fi.product_id === item.product_id)
          );
          if (!fItem) return;

          // Check if there is a breakdown entry for this specific order
          const sobEntry = fItem.source_orders_breakdown?.find(sob => sob.order_id === order.id);
          const qty = sobEntry ? (sobEntry.confirmed_qty || 0) : (fItem.confirmed_qty || 0);
          
          if (['Confirmed', 'Partially Confirmed', 'Packed', 'Dispatched', 'Delivered'].includes(ful.status)) {
            item.confirmed_qty = Math.max(item.confirmed_qty || 0, qty);
          }
          if (['Packed', 'Dispatched', 'Delivered'].includes(ful.status)) {
            item.packed_qty = Math.max(item.packed_qty || 0, fItem.packed_qty || qty);
          }
          if (['Dispatched', 'Delivered'].includes(ful.status)) {
            item.dispatched_qty = Math.max(item.dispatched_qty || 0, fItem.dispatched_qty || qty);
          }
          if (ful.status === 'Delivered') {
            item.delivered_qty = Math.max(item.delivered_qty || 0, fItem.dispatched_qty || qty);
          }
        });

        const cancelled = Math.min(itemBaseQty, Math.max(0, item.cancelled_qty || 0));
        item.cancelled_qty = cancelled;
        const activeBase = Math.max(0, itemBaseQty - cancelled);
        item.confirmed_qty = Math.min(activeBase, Math.max(0, item.confirmed_qty || 0));
        const dispatchedOrDelivered = Math.max(item.dispatched_qty || 0, item.delivered_qty || 0);
        item.pending_qty = Math.max(0, itemBaseQty - dispatchedOrDelivered - cancelled);
      });
      
      const orderCalc = calculateOrderQuantities(order, products);
      if (orderCalc.computedStatus === 'Cancelled') {
        order.status = 'Cancelled';
      } else if (orderCalc.computedStatus === 'Completed') {
        order.status = 'Completed';
      } else if (orderCalc.computedStatus === 'Packed') {
        order.status = 'Packed';
      } else if (orderCalc.computedStatus === 'Partially Dispatched') {
        order.status = 'Partially Dispatched';
      } else if (orderCalc.computedStatus === 'Partially Fulfilled') {
        order.status = 'Partially Fulfilled';
      } else if (orderCalc.computedStatus === 'Confirmed') {
        order.status = 'Confirmed';
      } else if (orderCalc.computedStatus === 'Partially Confirmed') {
        order.status = 'Partially Confirmed';
      } else if (order.status === 'Under Review') {
        order.status = 'Under Review';
      } else {
        order.status = 'Submitted';
      }
    });
  }

  private ensureCustomCompletedOrders(targetBusinessId: string = 'biz-saifee'): Order[] {
    // Check existing products ONLY - strictly do NOT create any new item
    const existingProducts = this.getProducts(targetBusinessId);
    if (existingProducts.length === 0) return [];

    const retailers = this.getRetailers(targetBusinessId);
    if (retailers.length === 0) return [];

    const newOrders: Order[] = [];

    retailers.forEach((ret, idx) => {
      // Pick existing items only (1 to 3 items per order)
      const itemCount = Math.min(existingProducts.length, ((idx % 3) + 1));
      const chosenProds: Product[] = [];
      for (let i = 0; i < itemCount; i++) {
        chosenProds.push(existingProducts[(idx + i) % existingProducts.length]);
      }

      const orderId = `ord-comp-${Date.now()}-${idx + 1}`;
      const orderNum = `SO-2026-${String(100 + idx + 1).padStart(5, '0')}`;
      const dayNum = String(10 + idx * 3).padStart(2, '0');
      const orderDate = `2026-09-${dayNum}`;

      let orderTotal = 0;
      const orderItems: OrderItem[] = chosenProds.map((prod, pIdx) => {
        const cartonQty = (idx + pIdx + 1) * 2;
        const unitsPerCtn = prod.units_per_box_carton || 1;
        const baseQty = cartonQty * unitsPerCtn;
        const rate = prod.selling_price || prod.mrp || 100;
        const finalPrice = rate * cartonQty;
        const gstPct = prod.gst_percent || 18;
        const gstAmt = (finalPrice * gstPct) / 100;
        const itemTotal = finalPrice + gstAmt;
        orderTotal += itemTotal;

        return {
          id: `oi-${orderId}-${pIdx + 1}`,
          order_id: orderId,
          product_id: prod.id,
          product_name: prod.name,
          quantity: baseQty,
          trading_unit: prod.trading_unit || 'Carton',
          base_unit: prod.base_unit || 'Piece',
          units_per_trading_unit: unitsPerCtn,
          units_per_box_carton: unitsPerCtn,
          carton_qty: cartonQty,
          loose_qty: 0,
          base_qty: baseQty,
          carton_rate: rate,
          rate: rate,
          base_price: rate,
          discount: 0,
          final_price: finalPrice,
          gst_percent: gstPct,
          gst_amount: gstAmt,
          total_amount: itemTotal,
          ordered_qty: baseQty,
          confirmed_qty: baseQty,
          packed_qty: baseQty,
          dispatched_qty: baseQty,
          delivered_qty: baseQty,
          fulfilled_qty: baseQty,
          pending_qty: 0,
          status: 'COMPLETED'
        };
      });

      const completedOrder: Order = {
        id: orderId,
        order_number: orderNum,
        retailer_id: ret.id,
        source: 'retailer_direct',
        channel: 'Retailer Direct',
        created_at: `${orderDate}T10:00:00.000Z`,
        order_date: orderDate,
        total_amount: Math.round(orderTotal * 100) / 100,
        status: 'Completed',
        confirmed_at: `${orderDate}T11:00:00.000Z`,
        packed_at: `${orderDate}T14:00:00.000Z`,
        dispatched_at: `${orderDate}T16:00:00.000Z`,
        delivered_at: `${orderDate}T18:00:00.000Z`,
        admin_notes: 'Completed order delivered to retailer store',
        business_id: targetBusinessId,
        items: orderItems
      };

      newOrders.push(completedOrder);
    });

    if (newOrders.length > 0) {
      const allOrders = this.getStore<Order>('fmcg_orders', SEED_ORDERS);
      this.saveOrders([...allOrders, ...newOrders], targetBusinessId);
    }
    return newOrders;
  }

  getOrders(targetBusinessId?: string): Order[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    let all = this.getStore<Order>('fmcg_orders', SEED_ORDERS);
    let scopedOrders = all.filter(o => (o.business_id || 'biz-saifee') === activeBiz);

    if (scopedOrders.length === 0) {
      const generated = this.ensureCustomCompletedOrders(activeBiz);
      if (generated.length > 0) {
        scopedOrders = generated;
      }
    }

    const fulfilments = this.getFulfilments(activeBiz);
    const hashBefore = JSON.stringify(scopedOrders);
    this.refreshAllOrders(scopedOrders, fulfilments);
    const hashAfter = JSON.stringify(scopedOrders);
    if (hashBefore !== hashAfter) {
      this.saveOrders(scopedOrders, activeBiz);
    }
    return scopedOrders;
  }

  getAllOrders(): Order[] {
    return this.getStore<Order>('fmcg_orders', SEED_ORDERS);
  }

  saveOrders(orders: Order[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Order>('fmcg_orders', SEED_ORDERS);
    const otherBiz = all.filter(o => (o.business_id || 'biz-saifee') !== activeBiz);
    const tagged = orders.map(o => ({ ...o, business_id: o.business_id || activeBiz }));
    this.saveStore('fmcg_orders', [...otherBiz, ...tagged]);
  }

  clearAllOrders(targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    this.saveOrders([], activeBiz);
    this.saveFulfilments([], activeBiz);
    this.saveDeliveryChallans([], activeBiz);
    const logs = this.getItemActivityLogs(undefined, activeBiz).filter(l => 
      !l.action.includes('Order') && 
      !l.action.includes('Rate Approved') && 
      !l.action.includes('Quantity Fulfilled') && 
      !l.action.includes('Rate Override') &&
      !l.action.includes('Fully Confirmed') &&
      !l.action.includes('Partially Confirmed') &&
      !l.action.includes('Cancelled')
    );
    this.saveItemActivityLogs(logs, activeBiz);
  }

  getFulfilments(targetBusinessId?: string): Fulfilment[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Fulfilment>('fmcg_fulfilments', SEED_FULFILMENTS);
    return all.filter(f => (f.business_id || 'biz-saifee') === activeBiz);
  }

  saveFulfilments(fulfilments: Fulfilment[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Fulfilment>('fmcg_fulfilments', SEED_FULFILMENTS);
    const otherBiz = all.filter(f => (f.business_id || 'biz-saifee') !== activeBiz);
    const tagged = fulfilments.map(f => ({ ...f, business_id: f.business_id || activeBiz }));
    this.saveStore('fmcg_fulfilments', [...otherBiz, ...tagged]);
  }

  getInvoices(targetBusinessId?: string): Invoice[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Invoice>('fmcg_invoices', SEED_INVOICES);
    return all.filter(i => (i.business_id || 'biz-saifee') === activeBiz);
  }

  getAllInvoices(): Invoice[] {
    return this.getStore<Invoice>('fmcg_invoices', SEED_INVOICES);
  }

  saveInvoices(invoices: Invoice[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Invoice>('fmcg_invoices', SEED_INVOICES);
    const otherBiz = all.filter(i => (i.business_id || 'biz-saifee') !== activeBiz);
    const tagged = invoices.map(i => ({ ...i, business_id: i.business_id || activeBiz }));
    this.saveStore('fmcg_invoices', [...otherBiz, ...tagged]);
  }

  getDeliveryChallans(targetBusinessId?: string): DeliveryChallan[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<DeliveryChallan>('fmcg_delivery_challans', SEED_DELIVERY_CHALLANS);
    return all.filter(dc => (dc.business_id || 'biz-saifee') === activeBiz);
  }

  saveDeliveryChallans(challans: DeliveryChallan[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<DeliveryChallan>('fmcg_delivery_challans', SEED_DELIVERY_CHALLANS);
    const otherBiz = all.filter(dc => (dc.business_id || 'biz-saifee') !== activeBiz);
    const tagged = challans.map(dc => ({ ...dc, business_id: dc.business_id || activeBiz }));
    this.saveStore('fmcg_delivery_challans', [...otherBiz, ...tagged]);
  }

  getDeliveryChallanByOrderId(orderId: string): DeliveryChallan | undefined {
    return this.getDeliveryChallans().find(dc => dc.order_id === orderId);
  }

  getDeliveryChallanById(challanId: string): DeliveryChallan | undefined {
    return this.getDeliveryChallans().find(dc => dc.id === challanId);
  }

  getPurchases(targetBusinessId?: string): Purchase[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Purchase>('fmcg_purchases', SEED_PURCHASES);
    return all.filter(p => (p.business_id || 'biz-saifee') === activeBiz);
  }

  getAllPurchases(): Purchase[] {
    return this.getStore<Purchase>('fmcg_purchases', SEED_PURCHASES);
  }

  savePurchases(purchases: Purchase[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Purchase>('fmcg_purchases', SEED_PURCHASES);
    const otherBiz = all.filter(p => (p.business_id || 'biz-saifee') !== activeBiz);
    const tagged = purchases.map(p => ({ ...p, business_id: p.business_id || activeBiz }));
    this.saveStore('fmcg_purchases', [...otherBiz, ...tagged]);
  }

  getPayments(targetBusinessId?: string): Payment[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Payment>('fmcg_payments', SEED_PAYMENTS);
    return all.filter(p => (p.business_id || 'biz-saifee') === activeBiz);
  }

  getAllPayments(): Payment[] {
    return this.getStore<Payment>('fmcg_payments', SEED_PAYMENTS);
  }

  savePayments(payments: Payment[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<Payment>('fmcg_payments', SEED_PAYMENTS);
    const otherBiz = all.filter(p => (p.business_id || 'biz-saifee') !== activeBiz);
    const tagged = payments.map(p => ({ ...p, business_id: p.business_id || activeBiz }));
    this.saveStore('fmcg_payments', [...otherBiz, ...tagged]);
  }

  getPaymentAllocations(targetBusinessId?: string): PaymentAllocation[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<PaymentAllocation>('fmcg_payment_allocations', []);
    return all.filter(pa => (pa.business_id || 'biz-saifee') === activeBiz);
  }

  savePaymentAllocations(allocs: PaymentAllocation[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<PaymentAllocation>('fmcg_payment_allocations', []);
    const otherBiz = all.filter(pa => (pa.business_id || 'biz-saifee') !== activeBiz);
    const tagged = allocs.map(pa => ({ ...pa, business_id: pa.business_id || activeBiz }));
    this.saveStore('fmcg_payment_allocations', [...otherBiz, ...tagged]);
  }

  getSalesReturns(targetBusinessId?: string): SalesReturn[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<SalesReturn>('fmcg_sales_returns', SEED_SALES_RETURNS);
    return all.filter(sr => (sr.business_id || 'biz-saifee') === activeBiz);
  }

  saveSalesReturns(returns: SalesReturn[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<SalesReturn>('fmcg_sales_returns', SEED_SALES_RETURNS);
    const otherBiz = all.filter(sr => (sr.business_id || 'biz-saifee') !== activeBiz);
    const tagged = returns.map(sr => ({ ...sr, business_id: sr.business_id || activeBiz }));
    this.saveStore('fmcg_sales_returns', [...otherBiz, ...tagged]);
  }

  getPurchaseReturns(targetBusinessId?: string): PurchaseReturn[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<PurchaseReturn>('fmcg_purchase_returns', []);
    return all.filter(pr => (pr.business_id || 'biz-saifee') === activeBiz);
  }

  savePurchaseReturns(returns: PurchaseReturn[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<PurchaseReturn>('fmcg_purchase_returns', []);
    const otherBiz = all.filter(pr => (pr.business_id || 'biz-saifee') !== activeBiz);
    const tagged = returns.map(pr => ({ ...pr, business_id: pr.business_id || activeBiz }));
    this.saveStore('fmcg_purchase_returns', [...otherBiz, ...tagged]);
  }

  // ----------------------------------------------------
  // CASH FLOW METHODS & MULTI-COMPANY ISOLATION
  // ----------------------------------------------------

  syncAutomaticCashFlowEntries(targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const payments = this.getPayments(activeBiz);
    const all = this.getStore<CashFlowTransaction>('fmcg_cash_flow_transactions', SEED_CASH_FLOW_TRANSACTIONS);
    const retailers = this.getRetailers(activeBiz);
    
    let modified = false;
    const existingTxNumbers = new Set(all.map(t => t.transaction_number));
    const existingSourceIds = new Set(all.filter(t => t.company_id === activeBiz && t.source_id).map(t => t.source_id));

    payments.forEach(pay => {
      if (existingSourceIds.has(pay.id)) return;

      const ret = retailers.find(r => r.id === pay.retailer_id);
      const payYear = pay.date ? new Date(pay.date).getFullYear() : new Date().getFullYear();
      let txNum = `CF-${payYear}-${String(all.length + 1).padStart(5, '0')}`;
      let counter = 1;
      while (existingTxNumbers.has(txNum)) {
        txNum = `CF-${payYear}-${String(all.length + counter).padStart(5, '0')}`;
        counter++;
      }
      existingTxNumbers.add(txNum);
      existingSourceIds.add(pay.id);

      const dateStr = pay.date ? (pay.date.includes('T') ? pay.date.split('T')[0] : pay.date) : new Date().toISOString().split('T')[0];
      const timeStr = pay.date && pay.date.includes('T') ? pay.date.split('T')[1].substring(0, 8) : '12:00:00';

      const autoTx: CashFlowTransaction = {
        id: `cf-auto-${pay.id}`,
        transaction_number: txNum,
        company_id: activeBiz,
        date: dateStr,
        time: timeStr,
        type: 'CASH_IN',
        amount: pay.amount,
        payment_mode: pay.method === 'Credit' ? 'Cash' : (pay.method as CashFlowPaymentMode),
        category: 'Retailer Payment',
        party_type: 'retailer',
        party_id: pay.retailer_id,
        party_name: ret?.shop_name || 'Retailer',
        reference_number: pay.reference_number || pay.payment_number,
        source_type: 'Retailer Payment',
        source_id: pay.id,
        linked_retailer_id: pay.retailer_id,
        remarks: pay.notes || `Payment received from ${ret?.shop_name || 'Retailer'} (Ref: ${pay.payment_number})`,
        status: 'Active',
        created_by: 'System (Payment Sync)',
        created_at: pay.date || new Date().toISOString(),
        edit_history: []
      };

      all.push(autoTx);
      modified = true;
    });

    if (modified) {
      this.saveStore('fmcg_cash_flow_transactions', all);
    }
  }

  getCashFlowTransactions(targetBusinessId?: string): CashFlowTransaction[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    this.syncAutomaticCashFlowEntries(activeBiz);
    const all = this.getStore<CashFlowTransaction>('fmcg_cash_flow_transactions', SEED_CASH_FLOW_TRANSACTIONS);
    return all.filter(cf => (cf.company_id || 'biz-saifee') === activeBiz);
  }

  getAllCashFlowTransactions(): CashFlowTransaction[] {
    return this.getStore<CashFlowTransaction>('fmcg_cash_flow_transactions', SEED_CASH_FLOW_TRANSACTIONS);
  }

  saveCashFlowTransactions(transactions: CashFlowTransaction[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<CashFlowTransaction>('fmcg_cash_flow_transactions', SEED_CASH_FLOW_TRANSACTIONS);
    const otherBiz = all.filter(cf => (cf.company_id || 'biz-saifee') !== activeBiz);
    const tagged = transactions.map(cf => ({ ...cf, company_id: cf.company_id || activeBiz }));
    this.saveStore('fmcg_cash_flow_transactions', [...otherBiz, ...tagged]);
  }

  getCompanyOpeningBalances(): CompanyOpeningBalance[] {
    return this.getStore<CompanyOpeningBalance>('fmcg_company_opening_balances', SEED_COMPANY_OPENING_BALANCES);
  }

  getCompanyOpeningBalance(targetBusinessId?: string): CompanyOpeningBalance {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getCompanyOpeningBalances();
    const found = all.find(b => b.company_id === activeBiz);
    if (found) return found;
    return {
      company_id: activeBiz,
      opening_balance: 150000,
      as_of_date: '2026-04-01',
      mode_balances: {
        'Cash': 50000,
        'UPI': 60000,
        'Bank Transfer': 40000,
        'Cheque': 0,
        'Other': 0
      },
      updated_by: 'System',
      updated_at: new Date().toISOString()
    };
  }

  saveCompanyOpeningBalance(balance: CompanyOpeningBalance, targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getCompanyOpeningBalances();
    const otherBiz = all.filter(b => b.company_id !== activeBiz);
    const updated: CompanyOpeningBalance = {
      ...balance,
      company_id: activeBiz,
      updated_at: new Date().toISOString()
    };
    this.saveStore('fmcg_company_opening_balances', [...otherBiz, updated]);
  }

  createCashFlowTransaction(
    data: Omit<CashFlowTransaction, 'id' | 'transaction_number' | 'status' | 'created_at'>,
    adminUser?: { id: string; name: string }
  ): CashFlowTransaction {
    const activeBiz = data.company_id || this.getActiveBusinessCompanyId();
    const transactions = this.getCashFlowTransactions(activeBiz);
    const year = data.date ? new Date(data.date).getFullYear() : new Date().getFullYear();
    const nextNum = `CF-${year}-${String(transactions.length + 1).padStart(5, '0')}`;
    const now = new Date();
    const timeStr = data.time || now.toTimeString().split(' ')[0];

    const newTx: CashFlowTransaction = {
      ...data,
      id: `cf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      transaction_number: nextNum,
      company_id: activeBiz,
      time: timeStr,
      status: 'Active',
      created_by: adminUser?.name || data.created_by || 'Saifee Admin',
      created_at: now.toISOString(),
      edit_history: []
    };

    transactions.unshift(newTx);
    this.saveCashFlowTransactions(transactions, activeBiz);
    return newTx;
  }

  updateCashFlowTransaction(
    id: string,
    updates: Partial<CashFlowTransaction>,
    reason: string,
    adminUser?: { id: string; name: string }
  ): CashFlowTransaction | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const transactions = this.getCashFlowTransactions(activeBiz);
    const tx = transactions.find(t => t.id === id);
    if (!tx) return null;

    const now = new Date().toISOString();
    const editorName = adminUser?.name || 'Saifee Admin';

    // Track field changes in edit history
    const historyEntries: CashFlowEditHistoryEntry[] = tx.edit_history ? [...tx.edit_history] : [];
    const fieldsToTrack: (keyof CashFlowTransaction)[] = [
      'amount', 'payment_mode', 'category', 'party_name', 'date', 'reference_number', 'remarks', 'type'
    ];

    fieldsToTrack.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== tx[field]) {
        historyEntries.push({
          id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          field: String(field),
          old_value: tx[field],
          new_value: updates[field],
          changed_by: editorName,
          changed_at: now,
          reason: reason || 'Manual Edit'
        });
      }
    });

    const updatedTx: CashFlowTransaction = {
      ...tx,
      ...updates,
      updated_by: editorName,
      updated_at: now,
      edit_history: historyEntries
    };

    const newTransactions = transactions.map(t => t.id === id ? updatedTx : t);
    this.saveCashFlowTransactions(newTransactions, activeBiz);
    return updatedTx;
  }

  voidCashFlowTransaction(
    id: string,
    reason: string,
    adminUser?: { id: string; name: string }
  ): CashFlowTransaction | null {
    const activeBiz = this.getActiveBusinessCompanyId();
    const transactions = this.getCashFlowTransactions(activeBiz);
    const tx = transactions.find(t => t.id === id);
    if (!tx) return null;

    const now = new Date().toISOString();
    const voiderName = adminUser?.name || 'Saifee Admin';

    const historyEntries: CashFlowEditHistoryEntry[] = tx.edit_history ? [...tx.edit_history] : [];
    historyEntries.push({
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      field: 'status',
      old_value: tx.status,
      new_value: 'Voided',
      changed_by: voiderName,
      changed_at: now,
      reason: reason || 'Void / Reversal'
    });

    const updatedTx: CashFlowTransaction = {
      ...tx,
      status: 'Voided',
      voided_at: now,
      voided_by: voiderName,
      void_reason: reason,
      updated_by: voiderName,
      updated_at: now,
      edit_history: historyEntries
    };

    const newTransactions = transactions.map(t => t.id === id ? updatedTx : t);
    this.saveCashFlowTransactions(newTransactions, activeBiz);
    return updatedTx;
  }

  getProductAliases(targetBusinessId?: string): ProductAlias[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<ProductAlias>('fmcg_product_aliases', []);
    return all.filter(pa => (pa.business_id || 'biz-saifee') === activeBiz);
  }

  saveProductAliases(aliases: ProductAlias[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<ProductAlias>('fmcg_product_aliases', []);
    const otherBiz = all.filter(pa => (pa.business_id || 'biz-saifee') !== activeBiz);
    const tagged = aliases.map(pa => ({ ...pa, business_id: pa.business_id || activeBiz }));
    this.saveStore('fmcg_product_aliases', [...otherBiz, ...tagged]);
  }

  getAIImports(targetBusinessId?: string): AIPurchaseImport[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<AIPurchaseImport>('fmcg_ai_imports', []);
    return all.filter(ai => (ai.business_id || 'biz-saifee') === activeBiz);
  }

  saveAIImports(imports: AIPurchaseImport[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<AIPurchaseImport>('fmcg_ai_imports', []);
    const otherBiz = all.filter(ai => (ai.business_id || 'biz-saifee') !== activeBiz);
    const tagged = imports.map(ai => ({ ...ai, business_id: ai.business_id || activeBiz }));
    this.saveStore('fmcg_ai_imports', [...otherBiz, ...tagged]);
  }

  getBillingRateAuditLogs(targetBusinessId?: string): BillingRateAuditLog[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<BillingRateAuditLog>('fmcg_rate_audit_logs', SEED_RATE_AUDIT_LOGS);
    return all.filter(l => (l.business_id || 'biz-saifee') === activeBiz);
  }

  saveBillingRateAuditLog(log: Omit<BillingRateAuditLog, 'id' | 'created_at'>): BillingRateAuditLog {
    const activeBiz = this.getActiveBusinessCompanyId();
    const logs = this.getBillingRateAuditLogs(activeBiz);
    const user = this.getCurrentUser();
    const newLog: BillingRateAuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      business_id: activeBiz,
      admin_user_id: log.admin_user_id || user.id,
      admin_user_name: log.admin_user_name || user.name,
      created_at: new Date().toISOString()
    };
    logs.unshift(newLog); // Newest first
    const all = this.getStore<BillingRateAuditLog>('fmcg_rate_audit_logs', SEED_RATE_AUDIT_LOGS);
    const otherBiz = all.filter(l => (l.business_id || 'biz-saifee') !== activeBiz);
    this.saveStore('fmcg_rate_audit_logs', [...otherBiz, ...logs]);
    return newLog;
  }

  getInvoiceAuditLogs(invoiceId?: string, targetBusinessId?: string): InvoiceAuditLog[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<InvoiceAuditLog>('fmcg_invoice_audit_logs', []);
    const scoped = all.filter(l => (l.business_id || 'biz-saifee') === activeBiz);
    if (!invoiceId) return [...scoped].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return scoped
      .filter(l => l.invoice_id === invoiceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  saveInvoiceAuditLog(log: InvoiceAuditLog): void {
    const activeBiz = this.getActiveBusinessCompanyId();
    const logs = this.getInvoiceAuditLogs(undefined, activeBiz);
    const taggedLog = { ...log, business_id: log.business_id || activeBiz };
    logs.unshift(taggedLog);
    const all = this.getStore<InvoiceAuditLog>('fmcg_invoice_audit_logs', []);
    const otherBiz = all.filter(l => (l.business_id || 'biz-saifee') !== activeBiz);
    this.saveStore('fmcg_invoice_audit_logs', [...otherBiz, ...logs]);
  }

  /**
   * Admin Invoice Editing Engine:
   * Recalculates all financial totals, taxes, round-off.
   * Atomically reconciles retailer outstanding balance by the exact delta.
   * Atomically adjusts inventory physical and batch quantities with StockLedgerEntry.
   * Maintains an immutable InvoiceAuditLog trace with item-by-item diffs.
   */
  updateInvoice(
    invoiceId: string,
    updatedData: {
      date?: string;
      place_of_supply?: string;
      items: InvoiceItem[];
      paid_amount?: number;
    },
    reason: string,
    adminUser?: { id: string; name: string }
  ): {
    invoice: Invoice;
    auditLog: InvoiceAuditLog;
    retailerDelta: number;
    stockAdjustments: { productId: string; productName: string; deltaBaseQty: number }[];
  } | null {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(i => i.id === invoiceId);
    if (index === -1) return null;

    const oldInvoice = JSON.parse(JSON.stringify(invoices[index])) as Invoice;
    const retailers = this.getRetailers();
    const ret = retailers.find(r => r.id === oldInvoice.retailer_id);
    if (!ret) return null;

    const products = this.getProducts();
    const inventory = this.getInventory();
    const batches = this.getBatches();
    const ledgers = this.getLedger();
    const orders = this.getOrders();
    const fulfilments = this.getFulfilments();
    const challans = this.getDeliveryChallans();

    const isLocalState = (ret.state_code || '27') === '27';

    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let hasManualRates = false;

    const processedItems: InvoiceItem[] = updatedData.items.map(rawItem => {
      const prod = products.find(p => p.id === rawItem.product_id);
      const unitsPerPack = rawItem.units_per_trading_unit || rawItem.units_per_box_carton || prod?.units_per_box_carton || 1;
      const tradingUnit = rawItem.trading_unit || prod?.trading_unit || 'Carton';
      const baseUnit = rawItem.base_unit || prod?.base_unit || 'Piece';
      const gstPercent = prod?.gst_percent ?? 18;

      const cartonQty = rawItem.carton_qty !== undefined
        ? rawItem.carton_qty
        : (rawItem.base_qty !== undefined ? Math.floor(rawItem.base_qty / unitsPerPack) : (rawItem.quantity || 0));
      const looseQty = rawItem.loose_qty !== undefined
        ? rawItem.loose_qty
        : (rawItem.base_qty !== undefined ? rawItem.base_qty % unitsPerPack : 0);
      const totalBaseQty = rawItem.base_qty !== undefined
        ? rawItem.base_qty
        : (cartonQty * unitsPerPack + looseQty);

      const cartonRate = rawItem.carton_rate ?? rawItem.rate ?? prod?.selling_price ?? 0;
      const looseRate = rawItem.loose_rate ?? prod?.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);

      const cartonDiscount = rawItem.carton_discount ?? 0;
      const looseDiscount = rawItem.loose_discount ?? 0;

      const amounts = calculateItemAmounts(
        cartonQty,
        looseQty,
        cartonRate,
        looseRate,
        cartonDiscount,
        looseDiscount,
        gstPercent
      );

      let itemCGST = 0;
      let itemSGST = 0;
      let itemIGST = 0;

      if (isLocalState) {
        itemCGST = amounts.gstAmount / 2;
        itemSGST = amounts.gstAmount / 2;
      } else {
        itemIGST = amounts.gstAmount;
      }

      subtotal += amounts.grossAmount;
      discountTotal += amounts.discountAmount;
      taxableTotal += amounts.taxableAmount;
      cgstTotal += itemCGST;
      sgstTotal += itemSGST;
      igstTotal += itemIGST;

      if (rawItem.manual_rate_applied || rawItem.rate_override_applied) {
        hasManualRates = true;
      }

      return {
        id: rawItem.id || `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        invoice_id: invoiceId,
        product_id: rawItem.product_id,
        hsn: rawItem.hsn || prod?.hsn || '0000',
        packing: rawItem.packing || prod?.pack_size || `${unitsPerPack} units/${tradingUnit}`,
        quantity: totalBaseQty,
        carton_qty: cartonQty,
        loose_qty: looseQty,
        base_qty: totalBaseQty,
        trading_unit: tradingUnit,
        base_unit: baseUnit,
        units_per_trading_unit: unitsPerPack,
        units_per_box_carton: unitsPerPack,
        rate: cartonRate,
        carton_rate: cartonRate,
        loose_rate: looseRate,
        discount: amounts.discountAmount,
        carton_discount: cartonDiscount,
        loose_discount: looseDiscount,
        taxable_value: amounts.taxableAmount,
        cgst: itemCGST,
        sgst: itemSGST,
        igst: itemIGST,
        total_amount: amounts.totalAmount,
        batch_number: rawItem.batch_number,
        batch_id: rawItem.batch_id,
        mrp: rawItem.mrp ?? prod?.mrp,
        purchase_rate: rawItem.purchase_rate ?? prod?.purchase_price,
        catalogue_rate: rawItem.catalogue_rate ?? prod?.selling_price,
        order_time_rate: rawItem.order_time_rate ?? cartonRate,
        manual_billing_rate: rawItem.manual_billing_rate,
        rate_override_applied: rawItem.rate_override_applied,
        manual_rate_applied: rawItem.manual_rate_applied,
        manual_rate_reason: rawItem.manual_rate_reason,
        override_reason: rawItem.override_reason
      };
    });

    const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = Math.round((grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal)) * 100) / 100;
    const paidAmount = updatedData.paid_amount !== undefined ? updatedData.paid_amount : oldInvoice.paid_amount;
    const newOutstandingAmount = Math.max(0, grandTotal - paidAmount);

    // Reconcile Retailer Outstanding Balance
    const oldInvoiceUnpaid = oldInvoice.grand_total - oldInvoice.paid_amount;
    const newInvoiceUnpaid = grandTotal - paidAmount;
    const retailerDelta = Math.round((newInvoiceUnpaid - oldInvoiceUnpaid) * 100) / 100;

    ret.outstanding = Math.max(0, Math.round((ret.outstanding + retailerDelta) * 100) / 100);
    this.saveRetailers(retailers);

    // Reconcile Inventory and Batches with StockLedgerEntry
    const stockAdjustments: { productId: string; productName: string; deltaBaseQty: number }[] = [];
    const oldProductQtys: { [prodId: string]: number } = {};
    oldInvoice.items?.forEach(item => {
      const q = item.base_qty ?? item.quantity ?? 0;
      oldProductQtys[item.product_id] = (oldProductQtys[item.product_id] || 0) + q;
    });

    const newProductQtys: { [prodId: string]: number } = {};
    processedItems.forEach(item => {
      const q = item.base_qty ?? item.quantity ?? 0;
      newProductQtys[item.product_id] = (newProductQtys[item.product_id] || 0) + q;
    });

    const allProductIds = Array.from(new Set([...Object.keys(oldProductQtys), ...Object.keys(newProductQtys)]));
    const user = this.getCurrentUser();
    const editorId = adminUser?.id || user.id;
    const editorName = adminUser?.name || user.name || 'Admin';

    allProductIds.forEach(prodId => {
      const oldQty = oldProductQtys[prodId] || 0;
      const newQty = newProductQtys[prodId] || 0;
      const delta = newQty - oldQty; // positive = more sold (deduct stock), negative = returned (add stock)

      if (delta !== 0) {
        const prod = products.find(p => p.id === prodId);
        stockAdjustments.push({
          productId: prodId,
          productName: prod?.name || prodId,
          deltaBaseQty: delta
        });

        const inv = inventory.find(i => i.product_id === prodId);
        if (inv) {
          if (delta > 0) {
            inv.physical_qty = Math.max(0, inv.physical_qty - delta);
          } else {
            inv.physical_qty += Math.abs(delta);
          }
          inv.available_qty = Math.max(0, inv.physical_qty - inv.reserved_qty);
          inv.updated_at = new Date().toISOString();
        }

        const prodBatch = batches.find(b => b.product_id === prodId);
        if (prodBatch) {
          if (delta > 0) {
            prodBatch.quantity = Math.max(0, prodBatch.quantity - delta);
          } else {
            prodBatch.quantity += Math.abs(delta);
          }
        }

        ledgers.push({
          id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          product_id: prodId,
          change_qty: -delta,
          direction: delta > 0 ? 'OUT' : 'IN',
          reason: 'Invoice Edit Adjustment',
          reference_id: invoiceId,
          user_id: editorId,
          created_at: new Date().toISOString()
        });
      }
    });

    this.saveInventory(inventory);
    this.saveBatches(batches);
    this.saveLedger(ledgers);

    // Sync Delivery Challan if linked
    const linkedChallan = challans.find(c => c.invoice_id === invoiceId || c.id === oldInvoice.order_ref_id || c.order_id === oldInvoice.order_ref_id);
    if (linkedChallan) {
      linkedChallan.items = processedItems.map(pi => {
        const prod = products.find(p => p.id === pi.product_id);
        return {
          id: `dc-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          challan_id: linkedChallan.id,
          product_id: pi.product_id,
          product_name: prod?.name || 'Product',
          brand: prod?.brand,
          variant_name: prod?.name,
          pack_size: pi.packing,
          trading_unit: pi.trading_unit,
          base_unit: pi.base_unit,
          units_per_trading_unit: pi.units_per_trading_unit,
          units_per_box_carton: pi.units_per_box_carton,
          carton_qty: pi.carton_qty,
          loose_qty: pi.loose_qty,
          base_qty: pi.base_qty,
          dispatched_qty: pi.quantity,
          batch_number: pi.batch_number || 'N/A',
          batch_id: pi.batch_id,
          mrp: pi.mrp,
          purchase_rate: pi.purchase_rate,
          expiry_date: batches.find(b => b.product_id === pi.product_id)?.expiry_date
        };
      });
      linkedChallan.total_items = linkedChallan.items.length;
      linkedChallan.total_units = linkedChallan.items.reduce((s, i) => s + i.dispatched_qty, 0);
      this.saveDeliveryChallans(challans);
    }

    // Build Item Diffs & Field Diffs for Audit Trail
    const itemChanges: InvoiceItemDiff[] = [];
    oldInvoice.items?.forEach(oldItem => {
      const newItem = processedItems.find(ni => ni.product_id === oldItem.product_id);
      const prod = products.find(p => p.id === oldItem.product_id);
      const prodName = prod?.name || oldItem.packing || 'Product';

      if (!newItem) {
        itemChanges.push({
          product_id: oldItem.product_id,
          product_name: prodName,
          action: 'removed',
          old_qty: oldItem.base_qty ?? oldItem.quantity,
          new_qty: 0,
          old_rate: oldItem.carton_rate ?? oldItem.rate,
          new_rate: 0,
          old_discount: oldItem.discount,
          new_discount: 0,
          old_total: oldItem.total_amount,
          new_total: 0,
          details: `Removed line item (${oldItem.carton_qty || 0} CTN, ${oldItem.loose_qty || 0} Loose)`
        });
      } else {
        const qtyChanged = (oldItem.base_qty ?? oldItem.quantity) !== (newItem.base_qty ?? newItem.quantity);
        const rateChanged = (oldItem.carton_rate ?? oldItem.rate) !== (newItem.carton_rate ?? newItem.rate) || (oldItem.loose_rate !== newItem.loose_rate);
        const discChanged = oldItem.discount !== newItem.discount;
        const totalChanged = Math.abs(oldItem.total_amount - newItem.total_amount) > 0.01;

        if (qtyChanged || rateChanged || discChanged || totalChanged) {
          const detailsParts: string[] = [];
          if (qtyChanged) detailsParts.push(`Qty: ${oldItem.carton_qty || 0}C/${oldItem.loose_qty || 0}L ➔ ${newItem.carton_qty || 0}C/${newItem.loose_qty || 0}L`);
          if (rateChanged) detailsParts.push(`Rate: ₹${oldItem.carton_rate ?? oldItem.rate} ➔ ₹${newItem.carton_rate ?? newItem.rate}`);
          if (discChanged) detailsParts.push(`Disc: ₹${oldItem.discount} ➔ ₹${newItem.discount}`);
          if (totalChanged) detailsParts.push(`Line Total: ₹${oldItem.total_amount.toFixed(2)} ➔ ₹${newItem.total_amount.toFixed(2)}`);

          itemChanges.push({
            product_id: oldItem.product_id,
            product_name: prodName,
            action: 'modified',
            old_qty: oldItem.base_qty ?? oldItem.quantity,
            new_qty: newItem.base_qty ?? newItem.quantity,
            old_rate: oldItem.carton_rate ?? oldItem.rate,
            new_rate: newItem.carton_rate ?? newItem.rate,
            old_discount: oldItem.discount,
            new_discount: newItem.discount,
            old_total: oldItem.total_amount,
            new_total: newItem.total_amount,
            details: detailsParts.join(' | ')
          });
        }
      }
    });

    processedItems.forEach(newItem => {
      const wasInOld = oldInvoice.items?.some(oi => oi.product_id === newItem.product_id);
      if (!wasInOld) {
        const prod = products.find(p => p.id === newItem.product_id);
        itemChanges.push({
          product_id: newItem.product_id,
          product_name: prod?.name || 'Product',
          action: 'added',
          old_qty: 0,
          new_qty: newItem.base_qty ?? newItem.quantity,
          old_rate: 0,
          new_rate: newItem.carton_rate ?? newItem.rate,
          old_discount: 0,
          new_discount: newItem.discount,
          old_total: 0,
          new_total: newItem.total_amount,
          details: `Added new line item: ${newItem.carton_qty || 0} CTN ${newItem.loose_qty || 0} Loose @ ₹${newItem.carton_rate ?? newItem.rate}`
        });
      }
    });

    const fieldChanges: InvoiceChangeField[] = [];
    if (oldInvoice.grand_total !== grandTotal) {
      fieldChanges.push({
        field: 'grand_total',
        label: 'Grand Total',
        old_value: `₹${oldInvoice.grand_total.toLocaleString('en-IN')}`,
        new_value: `₹${grandTotal.toLocaleString('en-IN')}`
      });
    }
    if (oldInvoice.taxable_value !== taxableTotal) {
      fieldChanges.push({
        field: 'taxable_value',
        label: 'Taxable Value',
        old_value: `₹${oldInvoice.taxable_value.toLocaleString('en-IN')}`,
        new_value: `₹${taxableTotal.toLocaleString('en-IN')}`
      });
    }
    if (oldInvoice.outstanding_amount !== newOutstandingAmount) {
      fieldChanges.push({
        field: 'outstanding_amount',
        label: 'Outstanding Balance',
        old_value: `₹${oldInvoice.outstanding_amount.toLocaleString('en-IN')}`,
        new_value: `₹${newOutstandingAmount.toLocaleString('en-IN')}`
      });
    }
    if (updatedData.date && oldInvoice.date !== updatedData.date) {
      fieldChanges.push({
        field: 'date',
        label: 'Invoice Date',
        old_value: oldInvoice.date.slice(0, 10),
        new_value: updatedData.date.slice(0, 10)
      });
    }
    if (updatedData.place_of_supply && oldInvoice.place_of_supply !== updatedData.place_of_supply) {
      fieldChanges.push({
        field: 'place_of_supply',
        label: 'Place of Supply',
        old_value: oldInvoice.place_of_supply,
        new_value: updatedData.place_of_supply
      });
    }

    const updatedInvoice: Invoice = {
      ...oldInvoice,
      date: updatedData.date || oldInvoice.date,
      place_of_supply: updatedData.place_of_supply || oldInvoice.place_of_supply,
      subtotal,
      discount_amount: discountTotal,
      taxable_value: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: paidAmount,
      outstanding_amount: newOutstandingAmount,
      items: processedItems,
      has_manual_rates: hasManualRates,
      last_edited_at: new Date().toISOString(),
      last_edited_by: editorName,
      edit_count: (oldInvoice.edit_count || 0) + 1
    };

    const auditLog: InvoiceAuditLog = {
      id: `inv-audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      invoice_id: invoiceId,
      invoice_number: oldInvoice.invoice_number,
      retailer_id: ret.id,
      retailer_name: ret.shop_name,
      admin_id: editorId,
      admin_name: editorName,
      timestamp: new Date().toISOString(),
      reason: reason || 'Admin adjusted invoice line items and values',
      old_grand_total: oldInvoice.grand_total,
      new_grand_total: grandTotal,
      old_outstanding_amount: oldInvoice.outstanding_amount,
      new_outstanding_amount: newOutstandingAmount,
      retailer_outstanding_delta: retailerDelta,
      field_changes: fieldChanges,
      item_changes: itemChanges,
      snapshot_before: oldInvoice,
      snapshot_after: updatedInvoice
    };

    invoices[index] = updatedInvoice;
    this.saveInvoices(invoices);
    this.saveInvoiceAuditLog(auditLog);

    // =========================================================================
    // BIDIRECTIONAL SYNC: Invoice -> Respective Order(s)
    // Propagate all quantity, rate, discount, and grand total changes to linked orders
    // =========================================================================
    try {
      const orders = this.getOrders();
      let ordersUpdated = false;

      orders.forEach(order => {
        const isDirectMatch = order.id === oldInvoice.order_ref_id || 
                              order.order_number === oldInvoice.order_ref_id || 
                              order.invoice_id === invoiceId;
        const isSourceMatch = oldInvoice.source_order_ids?.includes(order.id) || 
                              oldInvoice.source_order_numbers?.includes(order.order_number);

        if (isDirectMatch || isSourceMatch) {
          const updatedOrderItems: OrderItem[] = processedItems.map(pi => {
            const existingOrderItem = order.items?.find(it => it.product_id === pi.product_id);
            const prod = products.find(p => p.id === pi.product_id);
            const gstPercent = prod?.gst_percent ?? 18;
            const gstAmount = (pi.cgst || 0) + (pi.sgst || 0) + (pi.igst || 0);

            const baseQty = pi.base_qty ?? pi.quantity ?? 0;
            const cartonQty = pi.carton_qty ?? 0;
            const looseQty = pi.loose_qty ?? 0;

            return {
              id: existingOrderItem?.id || `ord-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              order_id: order.id,
              product_id: pi.product_id,
              quantity: baseQty,
              carton_qty: cartonQty,
              loose_qty: looseQty,
              base_qty: baseQty,
              trading_unit: pi.trading_unit || 'Carton',
              base_unit: pi.base_unit || 'Piece',
              units_per_trading_unit: pi.units_per_trading_unit || 1,
              units_per_box_carton: pi.units_per_box_carton || 1,
              carton_rate: pi.carton_rate ?? pi.rate ?? 0,
              loose_rate: pi.loose_rate ?? 0,
              carton_discount: pi.carton_discount ?? 0,
              loose_discount: pi.loose_discount ?? 0,
              base_price: pi.carton_rate ?? pi.rate ?? 0,
              discount: pi.discount ?? 0,
              final_price: pi.taxable_value ?? 0,
              gst_percent: gstPercent,
              gst_amount: gstAmount,
              total_amount: pi.total_amount ?? 0,
              final_applied_rate: pi.carton_rate ?? pi.rate ?? (pi.taxable_value !== undefined && pi.carton_qty ? pi.taxable_value / pi.carton_qty : 0),
              confirmed_qty: baseQty,
              dispatched_qty: baseQty,
              delivered_qty: order.status === 'Delivered' ? baseQty : (existingOrderItem?.delivered_qty || baseQty),
              pending_qty: 0,
              manual_rate_applied: pi.manual_rate_applied || pi.rate_override_applied,
              manual_rate_reason: pi.manual_rate_reason || pi.override_reason,
              manual_billing_rate: pi.manual_billing_rate,
              catalogue_rate_at_order: existingOrderItem?.catalogue_rate_at_order ?? pi.catalogue_rate,
              order_time_rate: existingOrderItem?.order_time_rate ?? pi.order_time_rate
            };
          });

          order.items = updatedOrderItems;
          order.total_amount = grandTotal;
          order.invoice_id = invoiceId;
          order.updated_at = new Date().toISOString();
          ordersUpdated = true;

          this.addItemActivityLog({
            product_id: processedItems[0]?.product_id || 'general',
            action: 'Order Auto-Synced from Invoice Edit',
            details: `Order ${order.order_number} automatically updated to mirror Invoice ${oldInvoice.invoice_number} edits (New Grand Total: ₹${grandTotal.toLocaleString('en-IN')})`,
            old_value: `Total: ₹${oldInvoice.grand_total}`,
            new_value: `Total: ₹${grandTotal}`,
            reference_id: order.id,
            user_id: editorId,
            user_name: editorName
          });
        }
      });

      if (ordersUpdated) {
        this.saveOrders(orders);
      }
    } catch (syncErr) {
      console.error('Failed to sync invoice edits to linked order:', syncErr);
    }

    return {
      invoice: updatedInvoice,
      auditLog,
      retailerDelta,
      stockAdjustments
    };
  }

  /**
   * Fetches the last billing records for a specific retailer and exact product variant/packing.
   * Strictly matches retailer_id, product_id (exact variant), and trading_unit.
   * Returns newest-first records capped at limit (default 5).
   */
  getLastBillingRates(
    retailerId: string,
    productId: string,
    tradingUnit?: string,
    limit: number = 5
  ): BillingRateRecord[] {
    const invoices = this.getInvoices();
    const orders = this.getOrders();
    const fulfilments = this.getFulfilments();
    const products = this.getProducts();
    const targetProd = products.find(p => p.id === productId);

    const records: BillingRateRecord[] = [];

    // Filter invoices for this specific retailer
    const retailerInvoices = invoices.filter(inv => inv.retailer_id === retailerId);

    retailerInvoices.forEach(inv => {
      inv.items?.forEach(item => {
        // Strict matching of exact product variant ID
        if (item.product_id === productId) {
          if (tradingUnit && item.trading_unit !== tradingUnit) return;

          // Find matching order number if possible
          let orderNum = '';
          if (inv.order_ref_id) {
            const ord = orders.find(o => o.id === inv.order_ref_id);
            if (ord) {
              orderNum = ord.order_number;
            } else {
              const ful = fulfilments.find(f => f.id === inv.order_ref_id);
              if (ful) {
                const origOrder = orders.find(o =>
                  o.items?.some(oi => ful.items?.some(fi => fi.order_item_id === oi.id))
                );
                orderNum = origOrder ? origOrder.order_number : ful.fulfilment_number;
              } else {
                orderNum = inv.order_ref_id.startsWith('ORD-') ? inv.order_ref_id : 'POS-SALE';
              }
            }
          }
          if (!orderNum) {
            orderNum = inv.invoice_number.replace('INV', 'ORD');
          }

          const catRate = item.catalogue_rate || targetProd?.selling_price || item.rate;
          const disc = item.discount || 0;
          const appliedRate = item.rate;
          const finalAppliedRate = item.rate - disc;

          let rateSource = 'Catalogue Dealer Rate';
          if (item.manual_rate_applied) {
            rateSource = 'Admin Manual Override';
          } else if (item.order_time_rate !== undefined && Math.abs(item.order_time_rate - catRate) > 0.01) {
            rateSource = 'Agreed Order Rate';
          }

          const unitsPerPack = item.units_per_trading_unit || targetProd?.units_per_box_carton || 1;
          const { cartonQty, looseQty } = splitBaseQuantity(item.quantity, unitsPerPack);
          const cartonRate = item.carton_rate ?? item.rate;
          const looseRate = item.loose_rate ?? targetProd?.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
          const cartonDisc = item.carton_discount ?? item.discount ?? 0;
          const looseDisc = item.loose_discount ?? 0;

          records.push({
            id: item.id || `rec-${inv.id}-${Math.random()}`,
            order_number: orderNum,
            invoice_number: inv.invoice_number,
            date: inv.date,
            quantity: item.quantity,
            carton_qty: item.carton_qty ?? cartonQty,
            loose_qty: item.loose_qty ?? looseQty,
            base_qty: item.base_qty ?? item.quantity,
            trading_unit: item.trading_unit,
            base_unit: item.base_unit || targetProd?.base_unit || 'Packet',
            units_per_trading_unit: unitsPerPack,
            packing: item.packing || targetProd?.pack_size || '',
            catalogue_rate: catRate,
            carton_rate: cartonRate,
            loose_rate: looseRate,
            discount: disc,
            carton_discount: cartonDisc,
            loose_discount: looseDisc,
            applied_rate: appliedRate,
            final_applied_rate: finalAppliedRate,
            manual_rate_applied: item.manual_rate_applied || false,
            manual_rate_reason: item.manual_rate_reason,
            rate_source: rateSource
          });
        }
      });
    });

    // Sort descending by date (newest first)
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return records.slice(0, limit);
  }

  /**
   * Retrieves customer credit profile, total outstanding debt, credit limit,
   * available credit balance, and overdue invoice ageing buckets.
   */
  getCustomerCreditProfile(retailerId: string, companyId?: string): CustomerCreditProfile {
    const activeBiz = companyId || this.getActiveBusinessCompanyId();
    const retailers = this.getRetailers(activeBiz);
    const ret = retailers.find(r => r.id === retailerId);
    if (!ret) {
      return {
        found: false,
        retailer_id: retailerId,
        retailer_code: '',
        shop_name: 'Customer Not Found',
        owner_name: '',
        credit_limit: 0,
        total_outstanding: 0,
        available_credit: 0,
        unpaid_invoices_count: 0,
        oldest_unpaid_days: 0,
        is_limit_exceeded: false,
        has_overdue_invoices: false,
        is_blocked: false,
        aging_buckets: { current_0_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 }
      };
    }

    const invoices = this.getInvoices(activeBiz).filter(
      i => i.retailer_id === retailerId && (i.outstanding_amount || 0) > 0.01
    );

    let oldestDays = 0;
    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b90_plus = 0;
    const now = Date.now();

    invoices.forEach(inv => {
      const invDate = new Date(inv.date).getTime();
      const ageDays = Math.max(0, Math.floor((now - invDate) / (1000 * 60 * 60 * 24)));
      if (ageDays > oldestDays) oldestDays = ageDays;
      const amt = inv.outstanding_amount || 0;
      if (ageDays <= 30) b0_30 += amt;
      else if (ageDays <= 60) b31_60 += amt;
      else if (ageDays <= 90) b61_90 += amt;
      else b90_plus += amt;
    });

    const creditLimit = ret.credit_limit || 50000;
    const outstanding = ret.outstanding || 0;
    const available = Math.max(0, creditLimit - outstanding);
    const isLimitExceeded = outstanding > creditLimit;
    const hasOverdue = oldestDays > 30;
    const isBlocked = isLimitExceeded || hasOverdue;

    let blockReason = '';
    if (isLimitExceeded && hasOverdue) {
      blockReason = `Outstanding balance (₹${outstanding.toLocaleString('en-IN')}) exceeds credit limit (₹${creditLimit.toLocaleString('en-IN')}) AND has bills ${oldestDays} days overdue.`;
    } else if (isLimitExceeded) {
      blockReason = `Outstanding balance (₹${outstanding.toLocaleString('en-IN')}) exceeds approved credit limit of ₹${creditLimit.toLocaleString('en-IN')}.`;
    } else if (hasOverdue) {
      blockReason = `Customer has overdue unpaid invoices (>30 days). Oldest unpaid invoice is ${oldestDays} days overdue.`;
    }

    return {
      found: true,
      retailer_id: ret.id,
      retailer_code: ret.retailer_code,
      shop_name: ret.shop_name,
      owner_name: ret.owner_name,
      credit_limit: creditLimit,
      total_outstanding: outstanding,
      available_credit: available,
      unpaid_invoices_count: invoices.length,
      oldest_unpaid_days: oldestDays,
      is_limit_exceeded: isLimitExceeded,
      has_overdue_invoices: hasOverdue,
      is_blocked: isBlocked,
      block_reason: isBlocked ? blockReason : undefined,
      aging_buckets: {
        current_0_30: b0_30,
        days_31_60: b31_60,
        days_61_90: b61_90,
        days_90_plus: b90_plus
      }
    };
  }

  /**
   * Posts a sales invoice in a single atomic transaction.
   * Deducts base inventory and batch quantities, writes stock ledger entries,
   * creates the invoice with tax breakdown, and posts the customer debit ledger.
   */
  postSalesInvoiceAtomic(payload: {
    business_company_id?: string;
    retailer_id: string;
    order_id?: string;
    fulfilment_id?: string;
    place_of_supply?: string;
    payment_mode?: string;
    payment_reference?: string;
    paid_amount?: number;
    notes?: string;
    user_id?: string;
    admin_user?: { id: string; name: string };
    items: {
      product_id: string;
      batch_id?: string;
      batch_number?: string;
      carton_qty?: number;
      loose_qty?: number;
      base_qty?: number;
      trading_unit?: string;
      base_unit?: string;
      units_per_trading_unit?: number;
      carton_rate?: number;
      loose_rate?: number;
      carton_discount?: number;
      loose_discount?: number;
      mrp?: number;
      purchase_rate?: number;
      gst_percent?: number;
      hsn?: string;
      packing?: string;
    }[];
  }): {
    success: boolean;
    invoice: Invoice;
    creditProfile: CustomerCreditProfile;
    newOutstanding: number;
  } {
    const activeBiz = payload.business_company_id || this.getActiveBusinessCompanyId();
    const retailers = this.getRetailers(activeBiz);
    const ret = retailers.find(r => r.id === payload.retailer_id);
    if (!ret) throw new Error(`Customer with ID ${payload.retailer_id} not found`);

    const products = this.getProducts(activeBiz);
    const inventory = this.getInventory(activeBiz);
    const batches = this.getBatches(activeBiz);
    const ledgers = this.getLedger(activeBiz);
    const invoices = this.getInvoices(activeBiz);

    const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const invoicePrefix = 'INV';
    const invoiceNumber = `INV/2026-27/${String(invoices.length + 1).padStart(5, '0')}`;
    const placeOfSupply = payload.place_of_supply || ret.state_code || '27';
    const paidAmount = Math.max(0, payload.paid_amount || 0);

    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const invoiceItems: InvoiceItem[] = [];

    // 1. Process line items and validate inventory availability in base units
    for (const item of payload.items) {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) throw new Error(`Product with ID ${item.product_id} not found`);

      const unitsPerPack = item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const cartonQty = Math.max(0, item.carton_qty || 0);
      const looseQty = Math.max(0, item.loose_qty || 0);
      const baseQty = item.base_qty || (cartonQty * unitsPerPack) + looseQty;

      if (baseQty <= 0) throw new Error(`Item "${prod.name}" has 0 quantity`);

      // Inventory check in base units
      const inv = inventory.find(i => i.product_id === prod.id);
      if (!inv || inv.physical_qty < baseQty) {
        throw new Error(`Insufficient stock for "${prod.name}". Available: ${inv?.physical_qty || 0} ${prod.base_unit || 'pieces'}, Requested: ${baseQty}`);
      }

      // Rates & discounts
      const cartonRate = item.carton_rate ?? prod.selling_price;
      const looseRate = item.loose_rate ?? prod.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
      const cartonDisc = item.carton_discount ?? 0;
      const looseDisc = item.loose_discount ?? 0;
      const gstPercent = item.gst_percent ?? prod.gst_percent ?? 18;

      const taxableVal = (cartonQty * Math.max(0, cartonRate - cartonDisc)) + (looseQty * Math.max(0, looseRate - looseDisc));
      const lineDisc = (cartonQty * cartonDisc) + (looseQty * looseDisc);
      const lineGst = Math.round(taxableVal * (gstPercent / 100) * 100) / 100;

      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (placeOfSupply === '27' || placeOfSupply.includes('27')) {
        lineCgst = Math.round((lineGst / 2) * 100) / 100;
        lineSgst = lineGst - lineCgst;
      } else {
        lineIgst = lineGst;
      }

      const lineTotal = taxableVal + lineGst;

      subtotal += (cartonQty * cartonRate) + (looseQty * looseRate);
      discountTotal += lineDisc;
      taxableTotal += taxableVal;
      cgstTotal += lineCgst;
      sgstTotal += lineSgst;
      igstTotal += lineIgst;

      // Deduct stock from batch or FIFO
      let assignedBatchNumber = item.batch_number || 'BCH-2026-A1';
      if (item.batch_id) {
        const b = batches.find(batch => batch.id === item.batch_id);
        if (b) {
          b.quantity = Math.max(0, b.quantity - baseQty);
          assignedBatchNumber = b.batch_number;
        }
      } else {
        let rem = baseQty;
        const prodBatches = batches.filter(b => b.product_id === prod.id && b.quantity > 0);
        for (const b of prodBatches) {
          if (rem <= 0) break;
          const take = Math.min(b.quantity, rem);
          b.quantity -= take;
          rem -= take;
          assignedBatchNumber = b.batch_number;
        }
      }

      // Deduct inventory master
      inv.physical_qty = Math.max(0, inv.physical_qty - baseQty);
      inv.available_qty = Math.max(0, inv.physical_qty - (inv.reserved_qty || 0));
      inv.updated_at = new Date().toISOString();

      // Record in Stock Ledger (in Base Units)
      ledgers.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        business_id: activeBiz,
        product_id: prod.id,
        change_qty: -baseQty,
        direction: 'OUT',
        reason: `Counter Sale (${invoiceNumber})`,
        reference_id: invoiceId,
        user_id: payload.user_id || 'p-admin-1',
        created_at: new Date().toISOString()
      });

      invoiceItems.push({
        id: `inv-item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        invoice_id: invoiceId,
        product_id: prod.id,
        hsn: item.hsn || prod.hsn,
        packing: item.packing || prod.pack_size,
        quantity: baseQty,
        trading_unit: item.trading_unit || prod.trading_unit || 'Carton',
        base_unit: item.base_unit || prod.base_unit || 'Piece',
        units_per_trading_unit: unitsPerPack,
        units_per_box_carton: unitsPerPack,
        carton_qty: cartonQty,
        loose_qty: looseQty,
        base_qty: baseQty,
        rate: cartonRate,
        carton_rate: cartonRate,
        loose_rate: looseRate,
        discount: lineDisc,
        carton_discount: cartonDisc,
        loose_discount: looseDisc,
        taxable_value: taxableVal,
        cgst: lineCgst,
        sgst: lineSgst,
        igst: lineIgst,
        total_amount: lineTotal,
        batch_number: assignedBatchNumber,
        batch_id: item.batch_id,
        mrp: item.mrp || prod.mrp,
        purchase_rate: item.purchase_rate || prod.purchase_price
      });
    }

    const grandTotalBeforeRound = taxableTotal + cgstTotal + sgstTotal + igstTotal;
    const grandTotal = Math.round(grandTotalBeforeRound);
    const roundOff = Math.round((grandTotal - grandTotalBeforeRound) * 100) / 100;
    const outstandingAmount = Math.max(0, grandTotal - paidAmount);

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      retailer_id: ret.id,
      order_ref_id: payload.order_id || payload.fulfilment_id,
      date: new Date().toISOString(),
      place_of_supply: placeOfSupply,
      subtotal,
      discount_amount: discountTotal,
      taxable_value: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      items: invoiceItems,
      notes: payload.notes,
      business_id: activeBiz
    };

    invoices.push(newInvoice);
    this.saveInvoices(invoices, activeBiz);
    this.saveInventory(inventory, activeBiz);
    this.saveBatches(batches, activeBiz);
    this.saveLedger(ledgers, activeBiz);

    // Update retailer outstanding debt balance
    ret.outstanding = (ret.outstanding || 0) + outstandingAmount;
    this.saveRetailers(retailers, activeBiz);

    // Record payment if paid amount > 0
    if (paidAmount > 0) {
      const payments = this.getPayments(activeBiz);
      const paymentAllocations = this.getPaymentAllocations(activeBiz);
      const payId = `pay-${Date.now()}`;
      const payNum = `PAY-${Date.now().toString().slice(-6)}`;

      payments.push({
        id: payId,
        retailer_id: ret.id,
        payment_number: payNum,
        amount: paidAmount,
        method: (payload.payment_mode === 'Cash' || payload.payment_mode === 'UPI' || payload.payment_mode === 'Bank Transfer' || payload.payment_mode === 'Cheque') ? payload.payment_mode : 'Other',
        reference_number: payload.payment_reference || `POS-${invoiceNumber}`,
        notes: `Instant counter receipt for ${invoiceNumber}`,
        date: new Date().toISOString(),
        business_id: activeBiz
      });

      paymentAllocations.push({
        id: `pa-${Date.now()}`,
        payment_id: payId,
        invoice_id: invoiceId,
        amount_allocated: paidAmount,
        business_id: activeBiz
      });

      this.savePayments(payments, activeBiz);
      this.savePaymentAllocations(paymentAllocations, activeBiz);
    }

    const updatedProfile = this.getCustomerCreditProfile(ret.id, activeBiz);

    return {
      success: true,
      invoice: newInvoice,
      creditProfile: updatedProfile,
      newOutstanding: ret.outstanding
    };
  }

  /**
   * Suggests batches for packing strictly using FIFO (First In, First Out).
   * Prioritizes older eligible stock entry/purchase dates and older cost layers.
   * If targetMrp is provided, prioritizes matching MRP stock lots via FIFO.
   * Does NOT deduct stock (simulation / suggestion only).
   */
  getFifoBatchSuggestions(
    productId: string,
    requiredQty: number,
    selectedGodown?: string,
    targetMrp?: number
  ): FifoBatchSuggestion[] {
    const batches = this.getBatches();
    let prodBatches = batches.filter(b => b.product_id === productId && b.quantity > 0);

    if (selectedGodown && selectedGodown !== 'all') {
      prodBatches = prodBatches.filter(b => b.godown_id === selectedGodown || b.godown === selectedGodown);
    }

    if (targetMrp !== undefined && targetMrp !== null && targetMrp > 0) {
      const matchingMrpBatches = prodBatches.filter(b => b.mrp === targetMrp);
      const otherBatches = prodBatches.filter(b => b.mrp !== targetMrp);

      matchingMrpBatches.sort((a, b) => {
        const timeA = a.entry_date ? new Date(a.entry_date).getTime() : (a.mfg_date ? new Date(a.mfg_date).getTime() : 0);
        const timeB = b.entry_date ? new Date(b.entry_date).getTime() : (b.mfg_date ? new Date(b.mfg_date).getTime() : 0);
        if (timeA !== timeB) return timeA - timeB;
        return (a.cost_layer || '').localeCompare(b.cost_layer || '');
      });

      otherBatches.sort((a, b) => {
        const timeA = a.entry_date ? new Date(a.entry_date).getTime() : (a.mfg_date ? new Date(a.mfg_date).getTime() : 0);
        const timeB = b.entry_date ? new Date(b.entry_date).getTime() : (b.mfg_date ? new Date(b.mfg_date).getTime() : 0);
        if (timeA !== timeB) return timeA - timeB;
        return (a.cost_layer || '').localeCompare(b.cost_layer || '');
      });

      prodBatches = [...matchingMrpBatches, ...otherBatches];
    } else {
      // FIFO Sorting: Older entry_date / purchase_date / mfg_date first, then cost_layer
      prodBatches.sort((a, b) => {
        const timeA = a.entry_date ? new Date(a.entry_date).getTime() : (a.mfg_date ? new Date(a.mfg_date).getTime() : 0);
        const timeB = b.entry_date ? new Date(b.entry_date).getTime() : (b.mfg_date ? new Date(b.mfg_date).getTime() : 0);
        if (timeA !== timeB) return timeA - timeB;
        return (a.cost_layer || '').localeCompare(b.cost_layer || '');
      });
    }

    const earliestExpiry = prodBatches.length > 0 
      ? Math.min(...prodBatches.map(b => new Date(b.expiry_date).getTime())) 
      : 0;

    let remaining = Math.max(0, requiredQty);
    return prodBatches.map((b, index) => {
      const alloc = Math.min(b.quantity, remaining);
      remaining -= alloc;
      const bExpiry = new Date(b.expiry_date).getTime();
      return {
        batch: b,
        suggested_qty: alloc,
        priority: index + 1,
        is_earliest_entry: index === 0,
        has_expiry_warning: bExpiry > earliestExpiry && alloc > 0 && prodBatches.some(other => new Date(other.expiry_date).getTime() < bExpiry && other.quantity > 0)
      };
    });
  }

  /**
   * Updates manual billing rate on a fulfilment item and saves audit log.
   */
  updateFulfilmentItemManualRate(
    fulfilmentId: string,
    fulfilmentItemId: string,
    manualRate: number | null | undefined,
    reason?: string
  ): boolean {
    const fulfilments = this.getFulfilments();
    const ful = fulfilments.find(f => f.id === fulfilmentId);
    if (!ful) return false;

    const fItem = ful.items?.find(fi => fi.id === fulfilmentItemId);
    if (!fItem) return false;

    const products = this.getProducts();
    const prod = products.find(p => p.id === fItem.product_id);
    const orders = this.getOrders();
    let orderItem: OrderItem | undefined;
    orders.forEach(o => {
      const oi = o.items?.find(i => i.id === fItem.order_item_id);
      if (oi) orderItem = oi;
    });

    const catRate = prod?.selling_price || 0;
    const orderRate = orderItem?.order_time_rate || orderItem?.base_price || catRate;
    const disc = orderItem?.discount || 0;

    if (manualRate !== null && manualRate !== undefined && manualRate > 0) {
      fItem.manual_billing_rate = manualRate;
      fItem.manual_rate_applied = true;
      fItem.manual_rate_reason = reason || 'Admin manual rate adjustment';
      fItem.override_reason = reason || 'Admin manual rate adjustment';
      fItem.final_applied_rate = manualRate - disc;
      fItem.manual_rate_updated_by = this.currentUserId;
      fItem.manual_rate_updated_at = new Date().toISOString();

      if (orderItem) {
        orderItem.manual_billing_rate = manualRate;
        orderItem.final_applied_rate = manualRate - disc;
        orderItem.manual_rate_applied = true;
        orderItem.manual_rate_reason = reason || 'Admin manual rate adjustment';
        orderItem.manual_rate_updated_by = this.currentUserId;
        orderItem.manual_rate_updated_at = new Date().toISOString();
        this.saveOrders(orders);
      }

      this.saveBillingRateAuditLog({
        fulfilment_id: fulfilmentId,
        order_item_id: fItem.order_item_id,
        retailer_id: ful.retailer_id,
        product_id: fItem.product_id,
        catalogue_rate: catRate,
        order_time_rate: orderRate,
        manual_billing_rate: manualRate,
        final_applied_rate: manualRate - disc,
        discount: disc,
        reason: reason || 'Admin manual rate adjustment'
      });
    } else {
      fItem.manual_billing_rate = undefined;
      fItem.manual_rate_applied = false;
      fItem.manual_rate_reason = undefined;
      fItem.override_reason = undefined;
      fItem.final_applied_rate = orderRate - disc;
      fItem.manual_rate_updated_by = undefined;
      fItem.manual_rate_updated_at = undefined;

      if (orderItem) {
        orderItem.manual_billing_rate = undefined;
        orderItem.final_applied_rate = orderRate - disc;
        orderItem.manual_rate_applied = false;
        orderItem.manual_rate_reason = undefined;
        this.saveOrders(orders);
      }
    }

    this.saveFulfilments(fulfilments);
    return true;
  }

  // ----------------------------------------------------
  // TRANSACTION LOGIC ENGINE
  // ----------------------------------------------------

  createOrder(orderData: Omit<Order, 'id' | 'order_number' | 'status' | 'order_date'>): Order {
    const orders = this.getOrders();
    const products = this.getProducts();
    const orderNum = `ORD-${new Date().getFullYear()}-${String(orders.length + 1).padStart(5, '0')}`;
    
    let totalOrderAmount = 0;

    const processedItems: OrderItem[] = (orderData.items || []).map(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
      const baseUnit = item.base_unit || prod?.base_unit || 'Packet';

      // Determine carton & loose quantities
      let cartonQty = item.carton_qty !== undefined ? item.carton_qty : 0;
      let looseQty = item.loose_qty !== undefined ? item.loose_qty : 0;
      let baseQty = item.base_qty !== undefined ? item.base_qty : (item.quantity !== undefined && item.carton_qty === undefined && item.loose_qty === undefined ? item.quantity : calculateBaseQuantity(cartonQty, looseQty, unitsPerPack));

      if (item.carton_qty === undefined && item.loose_qty === undefined && item.quantity !== undefined) {
        const split = splitBaseQuantity(item.quantity, unitsPerPack);
        cartonQty = split.cartonQty;
        looseQty = split.looseQty;
      }

      const cartonRate = item.carton_rate ?? item.base_price ?? prod?.selling_price ?? 0;
      const looseRate = item.loose_rate ?? prod?.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
      const cartonDiscount = item.carton_discount ?? item.discount ?? 0;
      const looseDiscount = item.loose_discount ?? 0;
      const gstPercent = item.gst_percent ?? prod?.gst_percent ?? 0;

      const amounts = calculateItemAmounts(cartonQty, looseQty, cartonRate, looseRate, cartonDiscount, looseDiscount, gstPercent);
      totalOrderAmount += amounts.totalAmount;

      return {
        ...item,
        quantity: baseQty, // stored in integer base units
        carton_qty: cartonQty,
        loose_qty: looseQty,
        base_qty: baseQty,
        trading_unit: tradingUnit,
        base_unit: baseUnit,
        units_per_trading_unit: unitsPerPack,
        carton_rate: cartonRate,
        loose_rate: looseRate,
        carton_discount: cartonDiscount,
        loose_discount: looseDiscount,
        catalogue_rate_at_order: item.catalogue_rate_at_order ?? (prod?.selling_price || cartonRate),
        order_time_rate: item.order_time_rate ?? cartonRate,
        base_price: cartonRate,
        discount: amounts.discountAmount,
        final_price: amounts.taxableAmount,
        gst_percent: gstPercent,
        gst_amount: amounts.gstAmount,
        total_amount: amounts.totalAmount,
        final_applied_rate: Math.max(0, cartonRate - cartonDiscount),
        manual_rate_applied: false
      };
    });

    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      order_number: orderNum,
      status: 'Submitted',
      order_date: new Date().toISOString(),
      total_amount: Math.round(totalOrderAmount),
      items: processedItems
    };

    orders.push(newOrder);
    this.saveOrders(orders);
    return newOrder;
  }

  /**
   * BIDIRECTIONAL SYNC: Order -> Respective Invoice
   * Automatically synchronizes order changes (quantities, rates, line item additions/removals)
   * to any existing linked Tax Invoice, reconciling retailer outstanding balance, GST calculations,
   * delivery challans, and stock ledgers.
   */
  syncOrderToLinkedInvoice(order: Order, adminUser?: { id: string; name: string }, reason?: string): Invoice | null {
    try {
      const invoices = this.getInvoices();
      const linkedInvoiceIndex = invoices.findIndex(inv => 
        inv.order_ref_id === order.id ||
        inv.order_ref_id === order.order_number ||
        inv.id === order.invoice_id ||
        inv.source_order_ids?.includes(order.id) ||
        inv.source_order_numbers?.includes(order.order_number)
      );

      if (linkedInvoiceIndex === -1) {
        return null;
      }

      const oldInvoice = invoices[linkedInvoiceIndex];
      const retailers = this.getRetailers();
      const ret = retailers.find(r => r.id === (order.retailer_id || oldInvoice.retailer_id)) || retailers[0];
      const products = this.getProducts();
      const inventory = this.getInventory();
      const batches = this.getBatches();
      const ledgers = this.getLedger();
      const challans = this.getDeliveryChallans();
      const isLocalState = (ret?.state_code || '27') === '27';

      // If multi-order consolidated invoice, collect all contributing orders
      const allOrders = this.getOrders();
      const isMultiOrder = (oldInvoice.source_order_ids && oldInvoice.source_order_ids.length > 1);
      
      // Build combined order items
      let sourceOrderItems: OrderItem[] = [];
      if (isMultiOrder && oldInvoice.source_order_ids) {
        const contributingOrders = allOrders.filter(o => oldInvoice.source_order_ids?.includes(o.id));
        contributingOrders.forEach(co => {
          const orderToUse = co.id === order.id ? order : co;
          if (orderToUse.items) {
            sourceOrderItems.push(...orderToUse.items);
          }
        });
      } else {
        sourceOrderItems = order.items || [];
      }

      let subtotal = 0;
      let discountTotal = 0;
      let taxableTotal = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;
      let hasManualRates = false;

      const processedItems: InvoiceItem[] = sourceOrderItems.map(orderItem => {
        const prod = products.find(p => p.id === orderItem.product_id);
        const unitsPerPack = orderItem.units_per_trading_unit || orderItem.units_per_box_carton || prod?.units_per_box_carton || 1;
        const tradingUnit = orderItem.trading_unit || prod?.trading_unit || 'Carton';
        const baseUnit = orderItem.base_unit || prod?.base_unit || 'Piece';
        const gstPercent = orderItem.gst_percent ?? prod?.gst_percent ?? 18;

        const cartonQty = orderItem.carton_qty !== undefined
          ? orderItem.carton_qty
          : (orderItem.base_qty !== undefined ? Math.floor(orderItem.base_qty / unitsPerPack) : (orderItem.quantity || 0));
        const looseQty = orderItem.loose_qty !== undefined
          ? orderItem.loose_qty
          : (orderItem.base_qty !== undefined ? orderItem.base_qty % unitsPerPack : 0);
        const totalBaseQty = orderItem.base_qty !== undefined
          ? orderItem.base_qty
          : calculateBaseQuantity(cartonQty, looseQty, unitsPerPack);

        const cartonRate = orderItem.carton_rate ?? orderItem.base_price ?? prod?.selling_price ?? 0;
        const looseRate = orderItem.loose_rate ?? prod?.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
        const cartonDiscount = orderItem.carton_discount ?? orderItem.discount ?? 0;
        const looseDiscount = orderItem.loose_discount ?? 0;

        const amounts = calculateItemAmounts(
          cartonQty,
          looseQty,
          cartonRate,
          looseRate,
          cartonDiscount,
          looseDiscount,
          gstPercent
        );

        let itemCGST = 0;
        let itemSGST = 0;
        let itemIGST = 0;

        if (isLocalState) {
          itemCGST = amounts.gstAmount / 2;
          itemSGST = amounts.gstAmount / 2;
        } else {
          itemIGST = amounts.gstAmount;
        }

        subtotal += amounts.grossAmount;
        discountTotal += amounts.discountAmount;
        taxableTotal += amounts.taxableAmount;
        cgstTotal += itemCGST;
        sgstTotal += itemSGST;
        igstTotal += itemIGST;

        if (orderItem.manual_rate_applied) {
          hasManualRates = true;
        }

        const existingInvItem = oldInvoice.items?.find(ii => ii.product_id === orderItem.product_id);

        return {
          id: existingInvItem?.id || `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          invoice_id: oldInvoice.id,
          product_id: orderItem.product_id,
          hsn: existingInvItem?.hsn || prod?.hsn || '0000',
          packing: existingInvItem?.packing || prod?.pack_size || `${unitsPerPack} units/${tradingUnit}`,
          quantity: totalBaseQty,
          carton_qty: cartonQty,
          loose_qty: looseQty,
          base_qty: totalBaseQty,
          trading_unit: tradingUnit,
          base_unit: baseUnit,
          units_per_trading_unit: unitsPerPack,
          units_per_box_carton: unitsPerPack,
          rate: cartonRate,
          carton_rate: cartonRate,
          loose_rate: looseRate,
          discount: amounts.discountAmount,
          carton_discount: cartonDiscount,
          loose_discount: looseDiscount,
          taxable_value: amounts.taxableAmount,
          cgst: itemCGST,
          sgst: itemSGST,
          igst: itemIGST,
          total_amount: amounts.totalAmount,
          batch_number: existingInvItem?.batch_number,
          batch_id: existingInvItem?.batch_id,
          mrp: existingInvItem?.mrp ?? prod?.mrp,
          purchase_rate: existingInvItem?.purchase_rate ?? prod?.purchase_price,
          catalogue_rate: existingInvItem?.catalogue_rate ?? prod?.selling_price,
          order_time_rate: orderItem.order_time_rate ?? cartonRate,
          manual_billing_rate: orderItem.manual_billing_rate,
          rate_override_applied: orderItem.manual_rate_applied,
          manual_rate_applied: orderItem.manual_rate_applied,
          manual_rate_reason: orderItem.manual_rate_reason,
          override_reason: orderItem.manual_rate_reason
        };
      });

      const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
      const roundOff = Math.round((grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal)) * 100) / 100;
      const paidAmount = oldInvoice.paid_amount || 0;
      const newOutstandingAmount = Math.max(0, grandTotal - paidAmount);

      // Reconcile Retailer Outstanding Balance
      const oldInvoiceUnpaid = oldInvoice.grand_total - paidAmount;
      const newInvoiceUnpaid = grandTotal - paidAmount;
      const retailerDelta = Math.round((newInvoiceUnpaid - oldInvoiceUnpaid) * 100) / 100;

      if (retailerDelta !== 0 && ret) {
        ret.outstanding = Math.max(0, Math.round((ret.outstanding + retailerDelta) * 100) / 100);
        this.saveRetailers(retailers);
      }

      // Reconcile Inventory and Batches
      const oldProductQtys: { [prodId: string]: number } = {};
      oldInvoice.items?.forEach(item => {
        const q = item.base_qty ?? item.quantity ?? 0;
        oldProductQtys[item.product_id] = (oldProductQtys[item.product_id] || 0) + q;
      });

      const newProductQtys: { [prodId: string]: number } = {};
      processedItems.forEach(item => {
        const q = item.base_qty ?? item.quantity ?? 0;
        newProductQtys[item.product_id] = (newProductQtys[item.product_id] || 0) + q;
      });

      const allProductIds = Array.from(new Set([...Object.keys(oldProductQtys), ...Object.keys(newProductQtys)]));
      const editorId = adminUser?.id || this.currentUserId;
      const editorName = adminUser?.name || 'Admin';

      allProductIds.forEach(prodId => {
        const oldQty = oldProductQtys[prodId] || 0;
        const newQty = newProductQtys[prodId] || 0;
        const delta = newQty - oldQty;

        if (delta !== 0) {
          const inv = inventory.find(i => i.product_id === prodId);
          if (inv) {
            if (delta > 0) {
              inv.physical_qty = Math.max(0, inv.physical_qty - delta);
            } else {
              inv.physical_qty += Math.abs(delta);
            }
            inv.available_qty = Math.max(0, inv.physical_qty - inv.reserved_qty);
            inv.updated_at = new Date().toISOString();
          }

          const prodBatch = batches.find(b => b.product_id === prodId);
          if (prodBatch) {
            if (delta > 0) {
              prodBatch.quantity = Math.max(0, prodBatch.quantity - delta);
            } else {
              prodBatch.quantity += Math.abs(delta);
            }
          }

          ledgers.push({
            id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            product_id: prodId,
            change_qty: -delta,
            direction: delta > 0 ? 'OUT' : 'IN',
            reason: `Auto-Sync from Order ${order.order_number} Edit`,
            reference_id: oldInvoice.id,
            user_id: editorId,
            created_at: new Date().toISOString()
          });
        }
      });

      this.saveInventory(inventory);
      this.saveBatches(batches);
      this.saveLedger(ledgers);

      // Sync Delivery Challan if linked
      const linkedChallan = challans.find(c => c.invoice_id === oldInvoice.id || c.id === oldInvoice.order_ref_id || c.order_id === order.id);
      if (linkedChallan) {
        linkedChallan.items = processedItems.map(pi => {
          const prod = products.find(p => p.id === pi.product_id);
          return {
            id: `dc-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            challan_id: linkedChallan.id,
            product_id: pi.product_id,
            product_name: prod?.name || 'Product',
            brand: prod?.brand,
            variant_name: prod?.name,
            pack_size: pi.packing,
            trading_unit: pi.trading_unit,
            base_unit: pi.base_unit,
            units_per_trading_unit: pi.units_per_trading_unit,
            units_per_box_carton: pi.units_per_box_carton,
            carton_qty: pi.carton_qty,
            loose_qty: pi.loose_qty,
            base_qty: pi.base_qty,
            dispatched_qty: pi.quantity,
            batch_number: pi.batch_number || 'N/A',
            batch_id: pi.batch_id,
            mrp: pi.mrp,
            purchase_rate: pi.purchase_rate,
            expiry_date: batches.find(b => b.product_id === pi.product_id)?.expiry_date
          };
        });
        linkedChallan.total_items = linkedChallan.items.length;
        linkedChallan.total_units = linkedChallan.items.reduce((s, i) => s + i.dispatched_qty, 0);
        this.saveDeliveryChallans(challans);
      }

      const updatedInvoice: Invoice = {
        ...oldInvoice,
        subtotal,
        discount_amount: discountTotal,
        taxable_value: taxableTotal,
        cgst: cgstTotal,
        sgst: sgstTotal,
        igst: igstTotal,
        round_off: roundOff,
        grand_total: grandTotal,
        outstanding_amount: newOutstandingAmount,
        items: processedItems,
        has_manual_rates: hasManualRates || oldInvoice.has_manual_rates,
        last_edited_at: new Date().toISOString(),
        last_edited_by: `${editorName} (Auto-sync from Order ${order.order_number})`,
        edit_count: (oldInvoice.edit_count || 0) + 1
      };

      invoices[linkedInvoiceIndex] = updatedInvoice;
      this.saveInvoices(invoices);

      // Record invoice audit log
      const auditLog: InvoiceAuditLog = {
        id: `inv-audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        invoice_id: oldInvoice.id,
        invoice_number: oldInvoice.invoice_number,
        retailer_id: ret?.id || '',
        retailer_name: ret?.shop_name || 'Retailer',
        admin_id: editorId,
        admin_name: editorName,
        timestamp: new Date().toISOString(),
        reason: reason || `Automatic sync from edits on Order ${order.order_number}`,
        old_grand_total: oldInvoice.grand_total,
        new_grand_total: grandTotal,
        old_outstanding_amount: oldInvoice.outstanding_amount,
        new_outstanding_amount: newOutstandingAmount,
        retailer_outstanding_delta: retailerDelta,
        field_changes: [
          {
            field: 'grand_total',
            label: 'Grand Total (Order Sync)',
            old_value: `₹${oldInvoice.grand_total.toLocaleString('en-IN')}`,
            new_value: `₹${grandTotal.toLocaleString('en-IN')}`
          }
        ],
        item_changes: [],
        snapshot_before: oldInvoice,
        snapshot_after: updatedInvoice
      };
      this.saveInvoiceAuditLog(auditLog);

      return updatedInvoice;
    } catch (err) {
      console.error('Failed to sync order edit to linked invoice:', err);
      return null;
    }
  }

  deleteOrder(orderId: string): boolean {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return false;

    const targetOrder = orders[idx];

    // Check if there is a linked invoice
    const invoices = this.getInvoices();
    const linkedInvoiceIndex = invoices.findIndex(inv => 
      inv.order_ref_id === orderId ||
      inv.order_ref_id === targetOrder.order_number ||
      inv.id === targetOrder.invoice_id ||
      inv.source_order_ids?.includes(orderId) ||
      inv.source_order_numbers?.includes(targetOrder.order_number)
    );

    if (linkedInvoiceIndex !== -1) {
      const oldInvoice = invoices[linkedInvoiceIndex];
      // Reconcile retailer outstanding (remove unpaid invoice amount)
      const retailers = this.getRetailers();
      const ret = retailers.find(r => r.id === oldInvoice.retailer_id);
      if (ret) {
        const unpaid = Math.max(0, oldInvoice.grand_total - (oldInvoice.paid_amount || 0));
        ret.outstanding = Math.max(0, Math.round((ret.outstanding - unpaid) * 100) / 100);
        this.saveRetailers(retailers);
      }

      // Reconcile inventory (return base quantities to physical stock)
      const inventory = this.getInventory();
      const batches = this.getBatches();
      const ledgers = this.getLedger();
      oldInvoice.items?.forEach(it => {
        const q = it.base_qty ?? it.quantity ?? 0;
        const inv = inventory.find(i => i.product_id === it.product_id);
        if (inv) {
          inv.physical_qty += q;
          inv.available_qty = Math.max(0, inv.physical_qty - inv.reserved_qty);
        }
        const b = batches.find(bt => bt.product_id === it.product_id);
        if (b) {
          b.quantity += q;
        }
        ledgers.push({
          id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          product_id: it.product_id,
          change_qty: q,
          direction: 'IN',
          reason: `Order ${targetOrder.order_number} Deleted - Stock Returned`,
          reference_id: oldInvoice.id,
          user_id: this.currentUserId,
          created_at: new Date().toISOString()
        });
      });
      this.saveInventory(inventory);
      this.saveBatches(batches);
      this.saveLedger(ledgers);

      // Remove invoice
      invoices.splice(linkedInvoiceIndex, 1);
      this.saveInvoices(invoices);
    }

    orders.splice(idx, 1);
    this.saveOrders(orders);

    // Also remove from any draft fulfilments
    const fulfilments = this.getFulfilments();
    let fulChanged = false;
    fulfilments.forEach(ful => {
      if (ful.source_order_ids && ful.source_order_ids.includes(orderId)) {
        ful.source_order_ids = ful.source_order_ids.filter(id => id !== orderId);
        if (ful.items) {
          ful.items.forEach(fi => {
            if (fi.source_orders_breakdown) {
              fi.source_orders_breakdown = fi.source_orders_breakdown.filter(sob => sob.order_id !== orderId);
            }
          });
          ful.items = ful.items.filter(fi => (fi.source_orders_breakdown && fi.source_orders_breakdown.length > 0) || fi.order_item_id !== orderId);
        }
        fulChanged = true;
      }
    });
    if (fulChanged) {
      this.saveFulfilments(fulfilments);
    }
    return true;
  }

  removeOrderItem(orderId: string, itemId: string): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items) return null;

    order.items = order.items.filter(it => it.id !== itemId);
    if (order.items.length === 0) {
      this.deleteOrder(orderId);
      return null;
    }

    // Recalculate order total
    let total = 0;
    order.items.forEach(it => {
      total += (it.total_amount || 0);
    });
    order.total_amount = Math.round(total);

    this.saveOrders(orders);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, undefined, `Removed line item from Order ${order.order_number}`);

    return order;
  }

  updateOrderItemQuantity(orderId: string, itemId: string, cartonQty: number, looseQty: number): Order | null {
    const orders = this.getOrders();
    const products = this.getProducts();
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items) return null;

    const item = order.items.find(it => it.id === itemId);
    if (!item) return null;

    const prod = products.find(p => p.id === item.product_id);
    const unitsPerPack = item.units_per_trading_unit || item.units_per_box_carton || prod?.units_per_box_carton || 1;
    const cQty = Math.max(0, Math.floor(cartonQty || 0));
    const lQty = Math.max(0, Math.floor(looseQty || 0));
    const baseQty = calculateBaseQuantity(cQty, lQty, unitsPerPack);

    const cartonRate = item.carton_rate ?? item.base_price ?? prod?.selling_price ?? 0;
    const looseRate = item.loose_rate ?? prod?.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
    const cartonDiscount = item.carton_discount ?? item.discount ?? 0;
    const looseDiscount = item.loose_discount ?? 0;
    const gstPercent = item.gst_percent ?? prod?.gst_percent ?? 0;

    const amounts = calculateItemAmounts(cQty, lQty, cartonRate, looseRate, cartonDiscount, looseDiscount, gstPercent);

    // Preserve initial ordered_qty if not already established
    if (item.ordered_qty === undefined) {
      item.ordered_qty = item.base_qty ?? item.quantity ?? baseQty;
    }

    item.carton_qty = cQty;
    item.loose_qty = lQty;
    item.base_qty = baseQty;
    item.quantity = baseQty;
    item.packed_qty = baseQty;
    item.discount = amounts.discountAmount;
    item.final_price = amounts.taxableAmount;
    item.gst_amount = amounts.gstAmount;
    item.total_amount = amounts.totalAmount;
    item.final_applied_rate = Math.max(0, cartonRate - cartonDiscount);

    // Calculate remaining shortage if any fulfillment took place
    const ful = item.fulfilled_qty || 0;
    const can = item.cancelled_qty || 0;
    item.remaining_qty = Math.max(0, (item.ordered_qty || baseQty) - ful - can);
    item.pending_qty = item.remaining_qty;

    let totalOrderAmount = 0;
    order.items.forEach(it => {
      totalOrderAmount += (it.total_amount || 0);
    });
    order.total_amount = Math.round(totalOrderAmount);

    this.saveOrders(orders);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, undefined, `Updated item quantity on Order ${order.order_number}`);

    return order;
  }

  /**
   * Adds an item directly into an active order/lot from warehouse terminal
   */
  addOrderItemToOrder(
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
  ): Order | null {
    const orders = this.getOrders();
    const products = this.getProducts();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    if (order.status === 'Completed' || order.status === 'Delivered') return null;

    const prod = products.find(p => p.id === itemData.productId);
    if (!prod) return null;

    const unitsPerPack = prod.units_per_box_carton || 1;
    const cQty = Math.max(0, Math.floor(itemData.cartonQty || 0));
    const lQty = Math.max(0, Math.floor(itemData.looseQty || 0));
    const baseQty = calculateBaseQuantity(cQty, lQty, unitsPerPack);
    if (baseQty <= 0) return order;

    const mrp = itemData.selectedMrp || prod.mrp;
    const cartonRate = itemData.unitRate !== undefined ? itemData.unitRate : prod.selling_price;
    const looseRate = prod.loose_selling_price || (Math.round((cartonRate / unitsPerPack) * 100) / 100);
    const gstPercent = prod.gst_percent || 18;

    const amounts = calculateItemAmounts(cQty, lQty, cartonRate, looseRate, 0, 0, gstPercent);

    if (!order.items) order.items = [];

    const newItem: OrderItem = {
      id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      product_id: prod.id,
      quantity: baseQty,
      base_qty: baseQty,
      carton_qty: cQty,
      loose_qty: lQty,
      ordered_qty: baseQty,
      fulfilled_qty: 0,
      remaining_qty: baseQty,
      status: 'PENDING',
      trading_unit: prod.trading_unit || 'Carton',
      base_unit: prod.base_unit || 'Pcs',
      units_per_trading_unit: unitsPerPack,
      units_per_box_carton: unitsPerPack,
      base_price: cartonRate,
      carton_rate: cartonRate,
      loose_rate: looseRate,
      manual_billing_rate: cartonRate,
      manual_rate_applied: itemData.unitRate !== undefined,
      manual_rate_reason: itemData.notes || 'Added from Warehouse Terminal',
      discount: 0,
      carton_discount: 0,
      loose_discount: 0,
      final_price: amounts.taxableAmount,
      final_applied_rate: cartonRate,
      gst_percent: gstPercent,
      gst_amount: amounts.gstAmount,
      total_amount: amounts.totalAmount,
      selected_mrp: mrp,
      purchase_rate: prod.purchase_price
    };

    order.items.push(newItem);

    // Recalculate order total
    let total = 0;
    order.items.forEach(it => { total += (it.total_amount || 0); });
    order.total_amount = Math.round(total);

    this.saveOrders(orders);

    this.addItemActivityLog({
      product_id: prod.id,
      action: 'Item Added to Order',
      details: `Added ${cQty} Cartons of ${prod.name} (MRP ₹${mrp}) at ₹${cartonRate}/Ctn to Order ${order.order_number}`,
      reference_id: order.id,
      user_id: adminUser?.id || this.currentUserId,
      user_name: adminUser?.name || 'Admin'
    });

    return order;
  }

  /**
   * Short-closes remaining balance on backordered item with mandatory reason audit
   */
  shortCloseBackorderItem(
    orderId: string,
    itemId: string,
    reason: string,
    adminUser?: { id: string; name: string }
  ): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;
    const targetItem = order.items?.find(i => i.id === itemId);
    if (!targetItem) return null;

    const itemBaseQty = targetItem.ordered_qty ?? targetItem.base_qty ?? targetItem.quantity;
    const fulfilledQty = targetItem.fulfilled_qty ?? targetItem.dispatched_qty ?? 0;
    const currentCancelled = targetItem.cancelled_qty || 0;
    const remainingToCancel = targetItem.remaining_qty !== undefined
      ? targetItem.remaining_qty
      : Math.max(0, itemBaseQty - fulfilledQty - currentCancelled);

    if (remainingToCancel <= 0) return order;

    return this.updateOrderItemFulfillment(
      orderId,
      itemId,
      {
        cancel_qty: remainingToCancel,
        cancel_reason: reason || 'Short-closed from Backorder Queue'
      },
      adminUser
    );
  }

  /**
   * Consolidates retailer's orders into a single fulfilment draft.
   * Groups strictly by exact product variant and preserves all original source orders.
   */
  consolidateRetailerOrders(retailerId: string, orderIds: string[]): Fulfilment {
    const orders = this.getOrders();
    const products = this.getProducts();
    const activeOrders = orders.filter(o => 
      orderIds.includes(o.id) && 
      o.retailer_id === retailerId &&
      !['Delivered', 'Cancelled'].includes(o.status)
    );

    const fulfilments = this.getFulfilments();
    const fId = `ful-${Date.now()}`;
    const fNum = `FUL-${new Date().getFullYear()}-${String(fulfilments.length + 1).padStart(5, '0')}`;

    // Group order items strictly by exact product variant & commercial trading unit
    const variantMap: {
      [key: string]: {
        productId: string;
        tradingUnit: string;
        baseUnit: string;
        unitsPerPack: number;
        totalBaseQty: number;
        orderTimeRate: number;
        cartonRate: number;
        looseRate: number;
        discount: number;
        cartonDiscount: number;
        looseDiscount: number;
        manualBillingRate?: number;
        manualRateApplied?: boolean;
        manualRateReason?: string;
        orderItemIds: string[];
        sourceOrders: FulfilmentItemSourceBreakdown[];
      }
    } = {};

    activeOrders.forEach(o => {
      o.items?.forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
        const delivered = item.delivered_qty || 0;
        const cancelled = item.cancelled_qty || 0;
        const itemBaseQty = item.base_qty ?? item.quantity;
        const pending = Math.max(0, itemBaseQty - delivered - cancelled);
        
        if (pending > 0) {
          const mrp = item.selected_mrp || prod?.mrp || 0;
          const key = `${item.product_id}__MRP_${mrp}`;
          const splitPending = splitBaseQuantity(pending, unitsPerPack);
          const cartonRate = item.carton_rate ?? item.order_time_rate ?? item.base_price ?? prod?.selling_price ?? 0;
          const looseRate = item.loose_rate ?? prod?.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
          const cartonDisc = item.carton_discount ?? item.discount ?? 0;
          const looseDisc = item.loose_discount ?? 0;

          if (!variantMap[key]) {
            variantMap[key] = {
              productId: item.product_id,
              tradingUnit: item.trading_unit || prod?.trading_unit || 'Carton',
              baseUnit: item.base_unit || prod?.base_unit || 'Packet',
              unitsPerPack,
              totalBaseQty: 0,
              orderTimeRate: cartonRate,
              cartonRate,
              looseRate,
              discount: item.discount ?? 0,
              cartonDiscount: cartonDisc,
              looseDiscount: looseDisc,
              manualBillingRate: item.manual_billing_rate,
              manualRateApplied: item.manual_rate_applied,
              manualRateReason: item.manual_rate_reason,
              orderItemIds: [],
              sourceOrders: []
            };
          }

          variantMap[key].totalBaseQty += pending;
          variantMap[key].orderItemIds.push(item.id);
          variantMap[key].sourceOrders.push({
            order_id: o.id,
            order_number: o.order_number,
            source: o.source,
            order_date: o.order_date,
            quantity: pending,
            confirmed_qty: pending,
            trading_unit: item.trading_unit || prod?.trading_unit || 'Carton',
            base_unit: item.base_unit || prod?.base_unit || 'Packet',
            units_per_trading_unit: unitsPerPack,
            carton_qty: splitPending.cartonQty,
            loose_qty: splitPending.looseQty,
            order_time_rate: cartonRate,
            carton_rate: cartonRate,
            loose_rate: looseRate,
            discount: item.discount ?? 0,
            carton_discount: cartonDisc,
            loose_discount: looseDisc,
            selected_mrp: item.selected_mrp,
            batch_id: item.batch_id,
            purchase_rate: item.purchase_rate
          });
        }
      });
      // Mark source orders as Under Review while preserving all original data
      o.status = 'Under Review';
    });

    const items: FulfilmentItem[] = Object.values(variantMap).map(grp => {
      const baseRate = grp.manualRateApplied && grp.manualBillingRate ? grp.manualBillingRate : grp.cartonRate;
      const finalRate = baseRate - (grp.cartonDiscount || 0);
      const split = splitBaseQuantity(grp.totalBaseQty, grp.unitsPerPack);

      return {
        id: `ful-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        fulfilment_id: fId,
        order_item_id: grp.orderItemIds[0] || `oi-${grp.productId}`,
        product_id: grp.productId,
        original_qty: grp.totalBaseQty,
        confirmed_qty: grp.totalBaseQty,
        pending_qty: 0,
        trading_unit: grp.tradingUnit,
        base_unit: grp.baseUnit,
        units_per_trading_unit: grp.unitsPerPack,
        carton_qty: split.cartonQty,
        loose_qty: split.looseQty,
        base_qty: grp.totalBaseQty,
        carton_rate: baseRate,
        loose_rate: grp.looseRate,
        carton_discount: grp.cartonDiscount,
        loose_discount: grp.looseDiscount,
        retailer_id: retailerId,
        source_orders_breakdown: grp.sourceOrders,
        order_time_rate: grp.orderTimeRate,
        discount: grp.cartonDiscount,
        manual_billing_rate: grp.manualBillingRate,
        manual_rate_applied: grp.manualRateApplied,
        manual_rate_reason: grp.manualRateReason,
        override_reason: grp.manualRateReason,
        final_applied_rate: finalRate
      };
    });

    this.saveOrders(orders);

    const existingDraftIndex = fulfilments.findIndex(f => 
      f.retailer_id === retailerId && f.status === 'Packing'
    );

    const newFulfilment: Fulfilment = {
      id: existingDraftIndex !== -1 ? fulfilments[existingDraftIndex].id : fId,
      retailer_id: retailerId,
      fulfilment_number: existingDraftIndex !== -1 ? fulfilments[existingDraftIndex].fulfilment_number : fNum,
      source_order_ids: activeOrders.map(o => o.id),
      status: 'Packing',
      created_at: new Date().toISOString(),
      items
    };

    if (existingDraftIndex !== -1) {
      fulfilments[existingDraftIndex] = newFulfilment;
    } else {
      fulfilments.push(newFulfilment);
    }

    this.saveFulfilments(fulfilments);
    return newFulfilment;
  }

  getOrCreateActiveFulfilment(retailerId: string): Fulfilment {
    const fulfilments = this.getFulfilments();
    const active = fulfilments.find(f => f.retailer_id === retailerId && f.status !== 'Delivered' && f.status !== 'Cancelled');
    if (active) {
      return active;
    }
    const orders = this.getOrders();
    const eligibleOrders = orders.filter(o => 
      o.retailer_id === retailerId && 
      o.status !== 'Delivered' && 
      o.status !== 'Cancelled' &&
      o.items?.some(item => {
        const delivered = item.delivered_qty || 0;
        const cancelled = item.cancelled_qty || 0;
        const pending = (item.base_qty ?? item.quantity) - delivered - cancelled;
        return pending > 0;
      })
    );
    const orderIds = eligibleOrders.map(o => o.id);
    return this.consolidateRetailerOrders(retailerId, orderIds);
  }

  /**
   * Confirms a consolidated fulfilment, processes stock reservation & handles partial logic.
   * Also supports updating manual rates and flat rupee discounts per commercial unit.
   */
  confirmFulfilment(
    fulfilmentId: string,
    itemConfirms: {
      itemId: string;
      confirmedQty: number; // in integer base units
      manualRate?: number | null;
      rateReason?: string;
      discount?: number;
      cartonRate?: number;
      looseRate?: number;
      cartonDiscount?: number;
      looseDiscount?: number;
    }[]
  ): Fulfilment | null {
    const fulfilments = this.getFulfilments();
    const ful = fulfilments.find(f => f.id === fulfilmentId);
    if (!ful) return null;

    const inventory = this.getInventory();
    const orders = this.getOrders();
    const products = this.getProducts();

    // Track if there are pending quantities (for backorder)
    let hasPending = false;

    // Apply confirms
    ful.items = ful.items?.map(fItem => {
      const prod = products.find(p => p.id === fItem.product_id);
      const unitsPerPack = fItem.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const match = itemConfirms.find(c => c.itemId === fItem.id);
      const confQty = match !== undefined ? Math.min(fItem.original_qty, Math.max(0, match.confirmedQty)) : fItem.confirmed_qty;
      const pendQty = Math.max(0, fItem.original_qty - confQty);

      if (pendQty > 0) {
        hasPending = true;
      }

      // Update rates & discounts if provided
      if (match) {
        if (match.manualRate !== undefined && match.manualRate !== null && match.manualRate > 0) {
          fItem.manual_billing_rate = match.manualRate;
          fItem.carton_rate = match.manualRate;
          fItem.manual_rate_applied = true;
          fItem.manual_rate_reason = match.rateReason || 'Admin manual rate adjustment';
          fItem.manual_rate_updated_by = this.currentUserId;
          fItem.manual_rate_updated_at = new Date().toISOString();

          // Save audit log
          this.saveBillingRateAuditLog({
            fulfilment_id: ful.id,
            order_item_id: fItem.order_item_id,
            retailer_id: ful.retailer_id,
            product_id: fItem.product_id,
            catalogue_rate: prod?.selling_price || 0,
            order_time_rate: fItem.order_time_rate || 0,
            manual_billing_rate: match.manualRate,
            final_applied_rate: match.manualRate - (fItem.carton_discount || fItem.discount || 0),
            discount: fItem.carton_discount || fItem.discount || 0,
            reason: match.rateReason || 'Admin manual rate adjustment'
          });
        }

        if (match.cartonRate !== undefined && match.cartonRate > 0) {
          fItem.carton_rate = match.cartonRate;
        }
        if (match.looseRate !== undefined && match.looseRate > 0) {
          fItem.loose_rate = match.looseRate;
        }
        if (match.cartonDiscount !== undefined) {
          fItem.carton_discount = Math.max(0, match.cartonDiscount);
          fItem.discount = Math.max(0, match.cartonDiscount);
        }
        if (match.looseDiscount !== undefined) {
          fItem.loose_discount = Math.max(0, match.looseDiscount);
        }
        if (match.discount !== undefined && match.cartonDiscount === undefined) {
          fItem.discount = Math.max(0, match.discount);
          fItem.carton_discount = Math.max(0, match.discount);
        }
      }

      const activeRate = fItem.manual_rate_applied && fItem.manual_billing_rate ? fItem.manual_billing_rate : (fItem.carton_rate ?? fItem.order_time_rate ?? prod?.selling_price ?? 0);
      const activeDisc = fItem.carton_discount ?? fItem.discount ?? 0;
      fItem.final_applied_rate = Math.max(0, activeRate - activeDisc);

      const split = splitBaseQuantity(confQty, unitsPerPack);
      fItem.carton_qty = split.cartonQty;
      fItem.loose_qty = split.looseQty;
      fItem.base_qty = confQty;

      // Update inventory reservations: Reserved Stock += delta
      const prevConf = fItem.confirmed_qty || 0;
      const delta = confQty - prevConf;
      const inv = inventory.find(i => i.product_id === fItem.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty + delta);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }

      return {
        ...fItem,
        confirmed_qty: confQty,
        pending_qty: pendQty
      };
    });
    const nextStatus = hasPending ? 'Partially Confirmed' : 'Confirmed';
    ful.status = nextStatus;
    ful.confirmed_at = new Date().toISOString();

    // Update statuses of consolidated orders
    const sourceOrderIds = ful.source_order_ids || [];
    orders.forEach(o => {
      if (sourceOrderIds.includes(o.id)) {
        o.status = nextStatus;
        o.confirmed_at = new Date().toISOString();
      }
    });

    this.saveFulfilments(fulfilments);
    this.refreshAllOrders(orders, fulfilments);
    this.saveOrders(orders);
    this.saveInventory(inventory);

    return ful;
  }

  /**
   * Transitions a consolidated fulfilment to Packed status.
   * Records batch allocations without premature inventory deduction.
   */
  packFulfilment(
    fulfilmentId: string,
    itemsWithAllocations: {
      fulfilmentItemId: string;
      batch_allocations: BatchAllocation[];
    }[]
  ): Fulfilment | null {
    const fulfilments = this.getFulfilments();
    const ful = fulfilments.find(f => f.id === fulfilmentId);
    if (!ful) return null;

    let isPartial = false;

    // Assign allocations to fulfilment items (in base units)
    ful.items?.forEach(fItem => {
      const match = itemsWithAllocations.find(a => a.fulfilmentItemId === fItem.id);
      if (match) {
        fItem.batch_allocations = match.batch_allocations;
        const totalAllocated = match.batch_allocations.reduce((s, b) => s + b.allocated_qty, 0);
        fItem.packed_qty = totalAllocated;
        if (totalAllocated < fItem.confirmed_qty) {
          isPartial = true;
        }
      }
    });

    const nextStatus = isPartial ? 'Packing' : 'Packed';
    ful.status = nextStatus;
    ful.packed_at = new Date().toISOString();

    const orders = this.getOrders();
    const sourceOrderIds = ful.source_order_ids || [];
    orders.forEach(o => {
      if (sourceOrderIds.includes(o.id)) {
        o.status = nextStatus;
        o.packed_at = new Date().toISOString();
      }
    });

    this.saveFulfilments(fulfilments);
    this.refreshAllOrders(orders, fulfilments);
    this.saveOrders(orders);
    return ful;
  }

  /**
   * Dispatches and generates invoice and delivery challan.
   * Deducts inventory atomically from exact allocated batches in base units.
   */
  dispatchFulfilment(
    fulfilmentId: string,
    dispatchInfo: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      dispatchGodown?: string;
    } = {}
  ): Invoice | null {
    const fulfilments = this.getFulfilments();
    const ful = fulfilments.find(f => f.id === fulfilmentId);
    if (!ful) return null;

    if (ful.status === 'Dispatched' || ful.status === 'Delivered') {
      const invoices = this.getInvoices();
      return invoices.find(i => i.order_ref_id === fulfilmentId) || null;
    }

    const retailers = this.getRetailers();
    const ret = retailers.find(r => r.id === ful.retailer_id);
    if (!ret) return null;

    const products = this.getProducts();
    const inventory = this.getInventory();
    const ledgers = this.getLedger();
    const batches = this.getBatches();
    const invoices = this.getInvoices();
    const challans = this.getDeliveryChallans();
    const orders = this.getOrders();

    // Calculations
    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let hasManualRatesApplied = false;

    const invoiceId = `inv-${Date.now()}`;
    const challanId = `dc-${Date.now()}`;
    const invoiceNumber = `INV/2026-27/${String(invoices.length + 1).padStart(5, '0')}`;
    const challanNumber = `DC/2026-27/${String(challans.length + 1).padStart(5, '0')}`;

    const invoiceItems: InvoiceItem[] = [];
    const challanItems: DeliveryChallanItem[] = [];

    ful.items?.forEach(fItem => {
      const qtyToDispatch = fItem.packed_qty || fItem.confirmed_qty;
      if (qtyToDispatch <= 0) return;

      const prod = products.find(p => p.id === fItem.product_id);
      if (!prod) return;

      const unitsPerPack = fItem.units_per_trading_unit || prod.units_per_box_carton || 1;
      const tradingUnit = fItem.trading_unit || prod.trading_unit || 'Carton';
      const baseUnit = fItem.base_unit || prod.base_unit || 'Packet';

      let oiCartonRate = fItem.carton_rate ?? prod.selling_price;
      let oiLooseRate = fItem.loose_rate ?? prod.loose_selling_price ?? (Math.round((oiCartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
      let oiCartonDisc = fItem.carton_discount ?? fItem.discount ?? 0;
      let oiLooseDisc = fItem.loose_discount ?? 0;
      let oiManualRate: number | undefined = undefined;
      let oiManualReason: string | undefined = undefined;
      let oiManualApplied = false;

      if (fItem.manual_rate_applied && fItem.manual_billing_rate && fItem.manual_billing_rate > 0) {
        oiManualRate = fItem.manual_billing_rate;
        oiCartonRate = fItem.manual_billing_rate;
        oiManualReason = fItem.manual_rate_reason;
        oiManualApplied = true;
      } else if (fItem.order_time_rate) {
        oiCartonRate = fItem.order_time_rate;
      }

      if (oiManualApplied) {
        hasManualRatesApplied = true;
      }

      // Allocations resolution
      let allocations = fItem.batch_allocations || [];
      if (allocations.length === 0) {
        const fifo = this.getFifoBatchSuggestions(fItem.product_id, qtyToDispatch, dispatchInfo.dispatchGodown, fItem.selected_mrp);
        allocations = fifo.filter(f => f.suggested_qty > 0).map(f => ({
          batch_id: f.batch.id,
          batch_number: f.batch.batch_number,
          allocated_qty: f.suggested_qty,
          godown: f.batch.godown,
          cost_layer: f.batch.cost_layer,
          mrp: f.batch.mrp,
          purchase_rate: f.batch.purchase_rate,
          selling_price: f.batch.selling_price || prod.selling_price,
          loose_selling_price: f.batch.loose_selling_price || prod.loose_selling_price,
          expiry_date: f.batch.expiry_date,
          entry_date: f.batch.entry_date
        }));
        if (allocations.length === 0) {
          allocations.push({
            batch_id: 'bch-default',
            batch_number: 'BCH-2026-A1',
            allocated_qty: qtyToDispatch,
            mrp: fItem.selected_mrp || prod.mrp,
            purchase_rate: fItem.purchase_rate || prod.purchase_price,
            selling_price: prod.selling_price,
            loose_selling_price: prod.loose_selling_price
          });
        }
      }

      fItem.batch_allocations = allocations;
      fItem.dispatched_qty = qtyToDispatch;

      allocations.forEach(alloc => {
        const batch = batches.find(b => b.id === alloc.batch_id);
        if (batch) {
          batch.quantity = Math.max(0, batch.quantity - alloc.allocated_qty);
        }

        const allocMrp = alloc.mrp ?? batch?.mrp ?? fItem.selected_mrp ?? prod.mrp;
        const allocPurchaseRate = alloc.purchase_rate ?? batch?.purchase_rate ?? fItem.purchase_rate ?? prod.purchase_price;
        const allocCartonPrice = fItem.manual_rate_applied && fItem.manual_billing_rate 
          ? fItem.manual_billing_rate 
          : (alloc.selling_price ?? batch?.selling_price ?? oiCartonRate);
        const allocLoosePrice = alloc.loose_selling_price ?? batch?.loose_selling_price ?? oiLooseRate;

        const allocQty = alloc.allocated_qty;
        const { cartonQty: allocCartonQty, looseQty: allocLooseQty } = splitBaseQuantity(allocQty, unitsPerPack);

        const amounts = calculateItemAmounts(
          allocCartonQty,
          allocLooseQty,
          allocCartonPrice,
          allocLoosePrice,
          oiCartonDisc,
          oiLooseDisc,
          prod.gst_percent
        );

        let itemCGST = 0;
        let itemSGST = 0;
        let itemIGST = 0;

        if (ret.state_code === '27') { // Local sale: CGST/SGST (Half each)
          itemCGST = amounts.gstAmount / 2;
          itemSGST = amounts.gstAmount / 2;
        } else { // Interstate sale: IGST
          itemIGST = amounts.gstAmount;
        }

        subtotal += amounts.grossAmount;
        discountTotal += amounts.discountAmount;
        taxableTotal += amounts.taxableAmount;
        cgstTotal += itemCGST;
        sgstTotal += itemSGST;
        igstTotal += itemIGST;

        invoiceItems.push({
          id: `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          invoice_id: invoiceId,
          product_id: prod.id,
          hsn: prod.hsn,
          packing: prod.pack_size,
          quantity: allocQty,
          carton_qty: allocCartonQty,
          loose_qty: allocLooseQty,
          base_qty: allocQty,
          trading_unit: tradingUnit,
          base_unit: baseUnit,
          units_per_trading_unit: unitsPerPack,
          rate: allocCartonPrice,
          carton_rate: allocCartonPrice,
          loose_rate: allocLoosePrice,
          discount: amounts.discountAmount,
          carton_discount: oiCartonDisc,
          loose_discount: oiLooseDisc,
          taxable_value: amounts.taxableAmount,
          cgst: itemCGST,
          sgst: itemSGST,
          igst: itemIGST,
          total_amount: amounts.totalAmount,
          batch_number: alloc.batch_number,
          batch_id: alloc.batch_id,
          mrp: allocMrp,
          purchase_rate: allocPurchaseRate,
          catalogue_rate: prod.selling_price,
          order_time_rate: fItem.order_time_rate ?? oiCartonRate,
          manual_billing_rate: oiManualApplied ? oiManualRate : undefined,
          rate_override_applied: oiManualApplied,
          manual_rate_applied: oiManualApplied,
          manual_rate_reason: oiManualReason,
          override_reason: oiManualReason
        });

        challanItems.push({
          id: `dc-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          challan_id: challanId,
          order_item_id: fItem.order_item_id,
          product_id: prod.id,
          product_name: prod.name,
          brand: prod.brand,
          variant_name: prod.name,
          pack_size: prod.pack_size,
          trading_unit: tradingUnit,
          base_unit: baseUnit,
          units_per_trading_unit: unitsPerPack,
          carton_qty: allocCartonQty,
          loose_qty: allocLooseQty,
          base_qty: allocQty,
          dispatched_qty: allocQty,
          batch_number: alloc.batch_number,
          batch_id: alloc.batch_id,
          mrp: allocMrp,
          purchase_rate: allocPurchaseRate,
          expiry_date: batch?.expiry_date
        });

        // Record Stock Ledger Entry for this specific batch allocation (in base units)
        ledgers.push({
          id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          product_id: prod.id,
          change_qty: -allocQty,
          direction: 'OUT',
          reason: 'Sale',
          reference_id: ful.id,
          user_id: this.currentUserId,
          created_at: new Date().toISOString()
        });
      });

      // Deduct from Physical and Reserved stock (in base units)
      const inv = inventory.find(i => i.product_id === fItem.product_id);
      if (inv) {
        inv.physical_qty = Math.max(0, inv.physical_qty - qtyToDispatch);
        inv.reserved_qty = Math.max(0, inv.reserved_qty - qtyToDispatch);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }
    });

    const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal);

    const sourceOrders = orders.filter(o => ful.source_order_ids?.includes(o.id));
    const sourceOrderNumbers = sourceOrders.map(o => o.order_number);

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      retailer_id: ret.id,
      order_ref_id: fulfilmentId,
      source_order_ids: ful.source_order_ids || [],
      source_order_numbers: sourceOrderNumbers,
      fulfilment_number: ful.fulfilment_number,
      date: dispatchInfo.dispatchDate ? new Date(dispatchInfo.dispatchDate).toISOString() : new Date().toISOString(),
      place_of_supply: ret.state_code === '27' ? 'Maharashtra (27)' : `Out of State (${ret.state_code})`,
      subtotal,
      discount_amount: discountTotal,
      taxable_value: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: 0,
      outstanding_amount: grandTotal,
      items: invoiceItems,
      has_manual_rates: hasManualRatesApplied
    };

    const newChallan: DeliveryChallan = {
      id: challanId,
      challan_number: challanNumber,
      order_id: ful.source_order_ids?.[0] || fulfilmentId,
      fulfilment_id: fulfilmentId,
      retailer_id: ret.id,
      created_at: new Date().toISOString(),
      dispatch_date: dispatchInfo.dispatchDate || new Date().toISOString(),
      transport_mode: dispatchInfo.transportMode || 'Distributor Delivery Van',
      vehicle_number: dispatchInfo.vehicleNumber || 'MH-04-AZ-4592',
      delivery_person: dispatchInfo.deliveryPerson || 'Delivery Team',
      notes: dispatchInfo.notes || 'Handle with care',
      items: challanItems,
      total_items: challanItems.length,
      total_units: challanItems.reduce((s, i) => s + i.dispatched_qty, 0)
    };

    invoices.push(newInvoice);
    challans.push(newChallan);

    // Update Retailer Outstanding: Outstanding += grandTotal
    ret.outstanding += grandTotal;
    this.saveRetailers(retailers);

    // Save inventory & ledgers
    this.saveInventory(inventory);
    this.saveLedger(ledgers);
    this.saveBatches(batches);
    this.saveInvoices(invoices);
    this.saveDeliveryChallans(challans);

    // Update Fulfilment status to Dispatched
    ful.status = 'Dispatched';
    ful.dispatched_at = new Date().toISOString();
    ful.dispatch_transport_mode = dispatchInfo.transportMode;
    ful.dispatch_vehicle_number = dispatchInfo.vehicleNumber;
    ful.dispatch_delivery_person = dispatchInfo.deliveryPerson;
    ful.dispatch_notes = dispatchInfo.notes;
    ful.dispatch_godown = dispatchInfo.dispatchGodown;
    ful.invoice_id = invoiceId;
    ful.challan_id = challanId;
    this.saveFulfilments(fulfilments);
    this.refreshAllOrders(orders, fulfilments);

    const sourceOrderIds = ful.source_order_ids || [];
    orders.forEach(o => {
      if (sourceOrderIds.includes(o.id)) {
        o.dispatched_at = new Date().toISOString();
        o.invoice_id = invoiceId;
        o.challan_id = challanId;

        // Update item-level cumulative fulfilled_qty, remaining_qty, and line status (Specification 1 & 4)
        (o.items || []).forEach(it => {
          const matchingFulItem = ful.items?.find(f => f.order_item_id === it.id || f.product_id === it.product_id);
          if (matchingFulItem) {
            const billedThisTime = matchingFulItem.packed_qty || matchingFulItem.confirmed_qty || 0;
            const prevFul = it.fulfilled_qty || 0;
            it.fulfilled_qty = prevFul + billedThisTime;
            it.ordered_qty = it.ordered_qty ?? it.base_qty ?? it.quantity;
            it.remaining_qty = Math.max(0, it.ordered_qty - it.fulfilled_qty - (it.cancelled_qty || 0));
            it.status = it.remaining_qty === 0 ? 'COMPLETED' : 'PARTIALLY_FULFILLED';
            it.dispatched_qty = it.fulfilled_qty;
            it.pending_qty = it.remaining_qty;
            it.confirmed_qty = 0;
          }
        });

        // Check if all items in order are completed (Specification 4: Lifecycle Automation)
        const hasRemaining = (o.items || []).some(it => {
          const ord = it.ordered_qty ?? it.base_qty ?? it.quantity;
          const fulQ = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
          const canQ = it.cancelled_qty ?? 0;
          return (ord - fulQ - canQ) > 0;
        });

        if (!hasRemaining) {
          o.status = 'Completed';
        } else {
          o.status = 'Partially Confirmed';
        }
      }
    });
    this.saveOrders(orders);

    return newInvoice;
  }

  /**
   * Transitions a consolidated fulfilment to Delivered status
   */
  deliverFulfilment(fulfilmentId: string): Fulfilment | null {
    const fulfilments = this.getFulfilments();
    const ful = fulfilments.find(f => f.id === fulfilmentId);
    if (!ful) return null;

    ful.status = 'Delivered';
    ful.delivered_at = new Date().toISOString();

    const orders = this.getOrders();
    const associatedOrderItemIds = ful.items?.map(i => i.order_item_id) || [];
    orders.forEach(o => {
      const match = o.items?.some(oi => associatedOrderItemIds.includes(oi.id));
      if (match) {
        o.status = 'Delivered';
        o.delivered_at = new Date().toISOString();
      }
    });

    this.saveFulfilments(fulfilments);
    this.refreshAllOrders(orders, fulfilments);
    this.saveOrders(orders);
    return ful;
  }

  /**
   * Cancels a consolidated fulfilment and releases reserved quantities
   */
  cancelFulfilment(fulfilmentId: string): Fulfilment | null {
    const fulfilments = this.getFulfilments();
    const ful = fulfilments.find(f => f.id === fulfilmentId);
    if (!ful) return null;

    const inventory = this.getInventory();
    
    // Release reservations (in base units)
    ful.items?.forEach(fItem => {
      const inv = inventory.find(i => i.product_id === fItem.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty - fItem.confirmed_qty);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }
    });

    ful.status = 'Cancelled';

    const orders = this.getOrders();
    const associatedOrderItemIds = ful.items?.map(i => i.order_item_id) || [];
    orders.forEach(o => {
      const match = o.items?.some(oi => associatedOrderItemIds.includes(oi.id));
      if (match) {
        o.status = 'Submitted'; // return to submitted for re-consolidation
      }
    });

    this.saveFulfilments(fulfilments);
    this.refreshAllOrders(orders, fulfilments);
    this.saveOrders(orders);
    this.saveInventory(inventory);
    return ful;
  }

  fulfilPendingItem(orderId: string, orderItemId: string, confirmedQty: number): Fulfilment | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const oItem = order.items?.find(oi => oi.id === orderItemId);
    if (!oItem) return null;

    const inventory = this.getInventory();
    const inv = inventory.find(i => i.product_id === oItem.product_id);
    if (!inv) return null;

    if (inv.available_qty < confirmedQty) {
      confirmedQty = Math.max(0, inv.available_qty);
    }
    if (confirmedQty <= 0) return null;

    const fulfilments = this.getFulfilments();
    const fId = `ful-${Date.now()}`;
    const fNum = `FUL-${new Date().getFullYear()}-${String(fulfilments.length + 1).padStart(5, '0')}`;

    const delivered = oItem.delivered_qty || 0;
    const cancelled = oItem.cancelled_qty || 0;
    const currentPending = oItem.quantity - delivered - cancelled;

    const newFul: Fulfilment = {
      id: fId,
      retailer_id: order.retailer_id,
      fulfilment_number: fNum,
      status: 'Confirmed',
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      items: [
        {
          id: `ful-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fulfilment_id: fId,
          order_item_id: orderItemId,
          product_id: oItem.product_id,
          selected_mrp: oItem.selected_mrp,
          purchase_rate: oItem.purchase_rate,
          original_qty: currentPending,
          confirmed_qty: confirmedQty,
          pending_qty: Math.max(0, currentPending - confirmedQty)
        }
      ]
    };

    inv.reserved_qty += confirmedQty;
    inv.available_qty = inv.physical_qty - inv.reserved_qty;

    fulfilments.push(newFul);
    this.saveFulfilments(fulfilments);
    this.saveInventory(inventory);

    this.refreshAllOrders(orders, fulfilments);
    this.saveOrders(orders);

    return newFul;
  }

  cancelPendingItem(orderId: string, orderItemId: string, quantityToCancel: number, reason: string): boolean {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    const oItem = order.items?.find(oi => oi.id === orderItemId);
    if (!oItem) return false;

    const itemBaseQty = oItem.base_qty ?? oItem.quantity;
    const currentCancelled = oItem.cancelled_qty || 0;
    const currentDispatched = oItem.dispatched_qty || oItem.delivered_qty || 0;
    const maxCancellable = Math.max(0, itemBaseQty - currentDispatched - currentCancelled);
    const cancelBaseQty = Math.min(maxCancellable, Math.max(0, quantityToCancel));

    oItem.cancelled_qty = currentCancelled + cancelBaseQty;
    oItem.cancel_reason = reason;
    oItem.cancelled_by = this.currentUserId;
    oItem.cancelled_at = new Date().toISOString();

    // If confirmed qty was higher than remaining active qty, reduce confirmed qty and release reservation
    const activeQty = itemBaseQty - oItem.cancelled_qty;
    if ((oItem.confirmed_qty || 0) > activeQty) {
      const reduceDelta = (oItem.confirmed_qty || 0) - activeQty;
      oItem.confirmed_qty = activeQty;
      const inventory = this.getInventory();
      const inv = inventory.find(i => i.product_id === oItem.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty - reduceDelta);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
        this.saveInventory(inventory);
      }
    }

    oItem.pending_qty = Math.max(0, itemBaseQty - currentDispatched - oItem.cancelled_qty);

    const fulfilments = this.getFulfilments();
    this.refreshAllOrders(orders, fulfilments);
    this.saveOrders(orders);

    return true;
  }

  /**
   * POS Counter Walk-in Sale creation with dual carton and loose quantity support
   */
  createCounterSale(
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
    paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Credit' | 'Other' = 'UPI'
  ): Invoice {
    const retailers = this.getRetailers();
    const ret = retailers.find(r => r.id === retailerId) || retailers[0];

    const products = this.getProducts();
    const inventory = this.getInventory();
    const ledgers = this.getLedger();
    const batches = this.getBatches();
    const invoices = this.getInvoices();

    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const invoiceId = `inv-pos-${Date.now()}`;
    const invoiceItems: InvoiceItem[] = [];

    items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return;

      const unitsPerPack = prod.units_per_box_carton || 1;
      const tradingUnit = prod.trading_unit || 'Carton';
      const baseUnit = prod.base_unit || 'Packet';

      let cQty = item.cartonQty !== undefined ? item.cartonQty : 0;
      let lQty = item.looseQty !== undefined ? item.looseQty : 0;
      let baseQty = 0;

      if (item.cartonQty === undefined && item.looseQty === undefined && item.quantity !== undefined) {
        baseQty = item.quantity;
        const split = splitBaseQuantity(baseQty, unitsPerPack);
        cQty = split.cartonQty;
        lQty = split.looseQty;
      } else {
        baseQty = calculateBaseQuantity(cQty, lQty, unitsPerPack);
      }

      if (baseQty <= 0) return;

      const cRate = prod.selling_price;
      const lRate = prod.loose_selling_price ?? (Math.round((cRate / Math.max(1, unitsPerPack)) * 100) / 100);
      const cDisc = item.cartonDiscount ?? item.discount ?? 0;
      const lDisc = item.looseDiscount ?? 0;

      const amounts = calculateItemAmounts(cQty, lQty, cRate, lRate, cDisc, lDisc, prod.gst_percent);

      let cgst = 0, sgst = 0, igst = 0;
      if (ret.state_code === '27') {
        cgst = amounts.gstAmount / 2;
        sgst = amounts.gstAmount / 2;
      } else {
        igst = amounts.gstAmount;
      }

      subtotal += amounts.grossAmount;
      discountTotal += amounts.discountAmount;
      taxableTotal += amounts.taxableAmount;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      // Decrement from Batch stock & retrieve batch number (in base units)
      let batchNumber = '';
      const batch = batches.find(b => b.product_id === prod.id && b.quantity >= baseQty) || batches.find(b => b.product_id === prod.id);
      if (batch) {
        batch.quantity = Math.max(0, batch.quantity - baseQty);
        batchNumber = batch.batch_number;
      }

      invoiceItems.push({
        id: `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        invoice_id: invoiceId,
        product_id: prod.id,
        hsn: prod.hsn,
        packing: prod.pack_size,
        quantity: baseQty,
        carton_qty: cQty,
        loose_qty: lQty,
        base_qty: baseQty,
        trading_unit: tradingUnit,
        base_unit: baseUnit,
        units_per_trading_unit: unitsPerPack,
        rate: cRate,
        carton_rate: cRate,
        loose_rate: lRate,
        discount: amounts.discountAmount,
        carton_discount: cDisc,
        loose_discount: lDisc,
        taxable_value: amounts.taxableAmount,
        cgst,
        sgst,
        igst,
        total_amount: amounts.totalAmount,
        batch_number: batchNumber
      });

      // Deduct Stock ledger & inventory in base units
      const inv = inventory.find(i => i.product_id === prod.id);
      if (inv) {
        inv.physical_qty = Math.max(0, inv.physical_qty - baseQty);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }

      ledgers.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product_id: prod.id,
        change_qty: -baseQty,
        direction: 'OUT',
        reason: 'Sale',
        reference_id: invoiceId,
        user_id: this.currentUserId,
        created_at: new Date().toISOString()
      });
    });

    const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal);

    const invNum = `INV/2026-27/${String(invoices.length + 1).padStart(5, '0')}`;
    const paidAmount = paymentMethod === 'Credit' ? 0 : grandTotal;
    const outstandingAmount = grandTotal - paidAmount;

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invNum,
      retailer_id: ret.id,
      date: new Date().toISOString(),
      place_of_supply: ret.state_code === '27' ? 'Maharashtra (27)' : `Out of State (${ret.state_code})`,
      subtotal,
      discount_amount: discountTotal,
      taxable_value: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      items: invoiceItems
    };

    // Create matching Order record for on-counter sale so it appears in Order Register & history
    const orders = this.getOrders();
    const orderId = `ord-pos-${Date.now()}`;
    const orderNumber = `ORD-${String(orders.length + 1050).padStart(4, '0')}`;
    const orderItems: OrderItem[] = invoiceItems.map(invItem => ({
      id: `oi-${invItem.id}`,
      order_id: orderId,
      product_id: invItem.product_id,
      quantity: invItem.quantity,
      trading_unit: invItem.trading_unit,
      base_unit: invItem.base_unit,
      units_per_trading_unit: invItem.units_per_trading_unit,
      units_per_box_carton: invItem.units_per_box_carton,
      carton_qty: invItem.carton_qty,
      loose_qty: invItem.loose_qty,
      base_qty: invItem.base_qty,
      carton_rate: invItem.carton_rate,
      loose_rate: invItem.loose_rate,
      base_price: invItem.rate,
      discount: invItem.discount,
      carton_discount: invItem.carton_discount,
      loose_discount: invItem.loose_discount,
      final_price: invItem.taxable_value,
      gst_percent: invItem.cgst + invItem.sgst > 0 ? Math.round(((invItem.cgst + invItem.sgst) / Math.max(1, invItem.taxable_value)) * 100) : 18,
      gst_amount: invItem.cgst + invItem.sgst + invItem.igst,
      total_amount: invItem.total_amount,
      confirmed_qty: invItem.quantity,
      dispatched_qty: invItem.quantity,
      delivered_qty: invItem.quantity,
      pending_qty: 0,
      batch_number: invItem.batch_number
    }));

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      retailer_id: ret.id,
      source: 'counter_sale',
      channel: 'On Counter Sale',
      status: 'Completed',
      order_date: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      dispatched_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      total_amount: grandTotal,
      invoice_id: invoiceId,
      items: orderItems
    };

    newInvoice.order_ref_id = orderId;
    orders.push(newOrder);
    this.saveOrders(orders);

    invoices.push(newInvoice);
    this.saveInvoices(invoices);

    // If there is any unpaid, add to outstanding
    ret.outstanding += (newInvoice.grand_total - newInvoice.paid_amount);
    this.saveRetailers(retailers);

    // If paid immediately, create a Payment entry
    if (newInvoice.paid_amount > 0) {
      const payments = this.getPayments();
      const payId = `pay-pos-${Date.now()}`;
      const payNum = `PAY-${new Date().getFullYear()}-${String(payments.length + 1).padStart(5, '0')}`;
      
      const newPay: Payment = {
        id: payId,
        retailer_id: ret.id,
        payment_number: payNum,
        amount: newInvoice.paid_amount,
        method: paymentMethod !== 'Credit' ? paymentMethod : 'Cash',
        reference_number: `POS-REF-${Date.now().toString().slice(-6)}`,
        notes: `Immediate POS Payment via ${paymentMethod}`,
        date: new Date().toISOString()
      };
      payments.push(newPay);
      this.savePayments(payments);

      const allocations = this.getPaymentAllocations();
      allocations.push({
        id: `alloc-${Date.now()}`,
        payment_id: payId,
        invoice_id: invoiceId,
        amount_allocated: newInvoice.paid_amount
      });
      this.savePaymentAllocations(allocations);
    }

    this.saveInventory(inventory);
    this.saveLedger(ledgers);
    this.saveBatches(batches);

    // Log Activity History
    this.addItemActivityLog({
      product_id: invoiceItems[0]?.product_id || '',
      action: 'On Counter Sale Created',
      details: `Order ${orderNumber} & Invoice ${invNum} created via On Counter Sale for ${ret.shop_name} (Amount: ₹${grandTotal}, Payment: ${paymentMethod})`,
      reference_id: orderId,
      user_id: this.currentUserId,
      user_name: 'Admin / POS Counter'
    });

    return newInvoice;
  }

  /**
   * Records a supplier purchase manually or after AI validation (with dual carton & loose quantity inwarding)
   */
  confirmPurchase(purchaseData: Omit<Purchase, 'id' | 'status' | 'created_at'>): Purchase {
    const activeBiz = this.getActiveBusinessCompanyId();
    const purchases = this.getPurchases(activeBiz);
    const inventory = this.getInventory(activeBiz);
    const batches = this.getBatches(activeBiz);
    const ledgers = this.getLedger(activeBiz);
    const products = this.getProducts(activeBiz);
    const godowns = this.getGodowns(activeBiz);
    const defGodown = godowns.find(g => g.is_default && g.status === 'Active') || godowns[0];
    const targetGodownId = purchaseData.receiving_godown_id || defGodown?.id || (activeBiz === 'biz-saifee' ? 'gdn-saifee-main' : 'gdn-hub-a');
    const targetGodownName = godowns.find(g => g.id === targetGodownId)?.name || 'Main Godown';

    const pId = `pur-${Date.now()}`;
    const newPurchase: Purchase = {
      ...purchaseData,
      id: pId,
      receiving_godown_id: targetGodownId,
      business_id: activeBiz,
      status: 'Confirmed',
      created_at: new Date().toISOString()
    };

    // Stock updates & batches (stored in integer base units)
    newPurchase.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
      const baseUnit = item.base_unit || prod?.base_unit || 'Packet';

      let cQty = item.carton_qty !== undefined ? item.carton_qty : 0;
      let lQty = item.loose_qty !== undefined ? item.loose_qty : 0;
      let totalBaseQty = 0;

      if (item.carton_qty === undefined && item.loose_qty === undefined && item.quantity !== undefined) {
        totalBaseQty = item.quantity + (item.free_quantity || 0);
        const split = splitBaseQuantity(totalBaseQty, unitsPerPack);
        cQty = split.cartonQty;
        lQty = split.looseQty;
      } else {
        totalBaseQty = calculateBaseQuantity(cQty, lQty, unitsPerPack) + (item.free_quantity || 0);
      }

      item.quantity = totalBaseQty;
      item.carton_qty = cQty;
      item.loose_qty = lQty;
      item.base_qty = totalBaseQty;
      item.trading_unit = tradingUnit;
      item.base_unit = baseUnit;
      item.units_per_trading_unit = unitsPerPack;

      // Safe batch & expiry assignment
      const effectiveBatch = (item.batch && item.batch.trim())
        ? item.batch.trim()
        : (newPurchase.invoice_number?.trim() ? `LOT-${newPurchase.invoice_number.trim()}` : `LOT-${new Date().toISOString().split('T')[0]}`);
      const effectiveExpiry = item.expiry_date || '';

      item.batch = effectiveBatch;
      item.expiry_date = effectiveExpiry;

      // Update product master pricing & pack size if provided
      if (prod) {
        if (item.purchase_rate > 0) prod.purchase_price = item.purchase_rate;
        if (item.loose_purchase_rate && item.loose_purchase_rate > 0) {
          prod.loose_purchase_price = item.loose_purchase_rate;
        } else if (item.purchase_rate > 0) {
          prod.loose_purchase_price = Math.round((item.purchase_rate / Math.max(1, unitsPerPack)) * 100) / 100;
        }
        if (item.mrp > 0) prod.mrp = item.mrp;
        if (item.gst_percent !== undefined) prod.gst_percent = item.gst_percent;
        if (item.selling_price && item.selling_price > 0) {
          prod.selling_price = item.selling_price;
        }
        if (item.loose_selling_price && item.loose_selling_price > 0) {
          prod.loose_selling_price = item.loose_selling_price;
        } else if (item.selling_price && item.selling_price > 0) {
          prod.loose_selling_price = Math.round((item.selling_price / Math.max(1, unitsPerPack)) * 100) / 100;
        }
        if (item.units_per_box_carton && item.units_per_box_carton > 0) {
          prod.units_per_box_carton = item.units_per_box_carton;
        }
        prod.updated_at = new Date().toISOString();
      }

      // 1. Stock Ledger
      ledgers.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product_id: item.product_id,
        godown_id: targetGodownId,
        change_qty: totalBaseQty,
        direction: 'IN',
        reason: `Purchase Inward (${targetGodownName})`,
        reference_id: pId,
        user_id: this.currentUserId,
        business_id: activeBiz,
        created_at: new Date().toISOString()
      });

      // 2. Main Inventory Table Update
      let inv = inventory.find(i => i.product_id === item.product_id && (i.godown_id === targetGodownId || !i.godown_id));
      if (inv) {
        inv.godown_id = targetGodownId;
        inv.physical_qty += totalBaseQty;
        inv.available_qty = inv.physical_qty - (inv.reserved_qty || 0);
        inv.updated_at = new Date().toISOString();
      } else {
        inv = {
          id: `inv-${item.product_id}-${targetGodownId}`,
          product_id: item.product_id,
          godown_id: targetGodownId,
          physical_qty: totalBaseQty,
          reserved_qty: 0,
          available_qty: totalBaseQty,
          damaged_qty: 0,
          expired_qty: 0,
          business_id: activeBiz,
          updated_at: new Date().toISOString()
        };
        inventory.push(inv);
      }

      // 3. Batch Inventory Update (in base units)
      const existingBatch = batches.find(b => b.product_id === item.product_id && (b.godown_id === targetGodownId || b.godown === targetGodownName) && b.batch_number === effectiveBatch);
      if (existingBatch) {
        existingBatch.quantity += totalBaseQty;
        existingBatch.godown_id = targetGodownId;
        if (item.purchase_rate > 0) existingBatch.purchase_rate = item.purchase_rate;
        if (item.mrp > 0) existingBatch.mrp = item.mrp;
        if (item.selling_price && item.selling_price > 0) existingBatch.selling_price = item.selling_price;
        if (item.loose_selling_price && item.loose_selling_price > 0) {
          existingBatch.loose_selling_price = item.loose_selling_price;
        } else if (item.selling_price && item.selling_price > 0) {
          existingBatch.loose_selling_price = Math.round((item.selling_price / Math.max(1, unitsPerPack)) * 100) / 100;
        }
        if (effectiveExpiry) existingBatch.expiry_date = effectiveExpiry;
      } else {
        const looseSellingPrice = item.loose_selling_price || prod?.loose_selling_price || (Math.round(((item.selling_price || prod?.selling_price || item.mrp * 0.85) / Math.max(1, unitsPerPack)) * 100) / 100);
        batches.push({
          id: `batch-${item.product_id}-${targetGodownId}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          product_id: item.product_id,
          godown_id: targetGodownId,
          godown: targetGodownName,
          batch_number: effectiveBatch,
          expiry_date: effectiveExpiry,
          mfg_date: item.manufacturing_date,
          purchase_rate: item.purchase_rate,
          mrp: item.mrp,
          selling_price: item.selling_price || prod?.selling_price || Math.round(item.purchase_rate * 1.15),
          loose_selling_price: looseSellingPrice,
          quantity: totalBaseQty,
          entry_date: new Date().toISOString().split('T')[0],
          business_id: activeBiz
        });
      }
    });

    purchases.push(newPurchase);
    this.savePurchases(purchases, activeBiz);
    this.saveInventory(inventory, activeBiz);
    this.saveBatches(batches, activeBiz);
    this.saveLedger(ledgers, activeBiz);
    this.saveProducts(products, activeBiz);

    return newPurchase;
  }

  /**
   * Records a Retailer payment and allocates it (oldest-first by default)
   */
  recordPayment(retailerId: string, amount: number, method: Payment['method'], refNum?: string, notes?: string): Payment {
    const payments = this.getPayments();
    const payId = `pay-${Date.now()}`;
    const payNum = `PAY-${new Date().getFullYear()}-${String(payments.length + 1).padStart(5, '0')}`;

    const newPayment: Payment = {
      id: payId,
      retailer_id: retailerId,
      payment_number: payNum,
      amount,
      method,
      reference_number: refNum,
      notes,
      date: new Date().toISOString()
    };

    payments.push(newPayment);
    this.savePayments(payments);

    // Allocation logic (oldest first)
    const invoices = this.getInvoices();
    const allocations = this.getPaymentAllocations();
    const retailers = this.getRetailers();

    // Find unpaid invoices for this retailer, sorted by date ascending
    const unpaidInvoices = invoices
      .filter(i => i.retailer_id === retailerId && i.outstanding_amount > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let remainingPayment = amount;

    unpaidInvoices.forEach(inv => {
      if (remainingPayment <= 0) return;

      const allocationAmt = Math.min(inv.outstanding_amount, remainingPayment);
      inv.outstanding_amount -= allocationAmt;
      inv.paid_amount += allocationAmt;
      remainingPayment -= allocationAmt;

      allocations.push({
        id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        payment_id: payId,
        invoice_id: inv.id,
        amount_allocated: allocationAmt
      });
    });

    // Update retailer outstanding account: Outstanding -= amount
    const ret = retailers.find(r => r.id === retailerId);
    if (ret) {
      ret.outstanding -= amount;
      this.saveRetailers(retailers);
    }

    this.saveInvoices(invoices);
    this.savePaymentAllocations(allocations);

    // Auto-record Cash Flow transaction for money in
    try {
      this.createCashFlowTransaction({
        company_id: newPayment.business_id || this.getActiveBusinessCompanyId(),
        date: (newPayment.date || new Date().toISOString()).split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        type: 'CASH_IN',
        amount: newPayment.amount,
        payment_mode: newPayment.method === 'Credit' ? 'Cash' : (newPayment.method as CashFlowPaymentMode),
        category: 'Retailer Payment',
        party_type: 'retailer',
        party_id: retailerId,
        party_name: ret?.shop_name || 'Retailer',
        reference_number: newPayment.reference_number || newPayment.payment_number,
        source_type: 'Retailer Payment',
        source_id: newPayment.id,
        linked_retailer_id: retailerId,
        remarks: newPayment.notes || `Payment received from ${ret?.shop_name || 'Retailer'} (Ref: ${newPayment.payment_number})`,
        created_by: 'System (Payment Sync)'
      });
    } catch (e) {
      console.warn('Auto cash flow entry creation skipped:', e);
    }

    return newPayment;
  }

  /**
   * Creates a direct Sales Return & Credit Note for a retailer without invoice dependency.
   * Allows admin to specify manual product items, carton & loose quantities, condition, and manual rates.
   */
  createDirectSalesReturn(data: {
    retailerId: string;
    invoiceId?: string;
    receiving_godown_id?: string;
    returnDate?: string;
    reason: string;
    items: {
      productId: string;
      cartonQty?: number;
      looseQty?: number;
      quantity?: number; // base units
      rate: number; // carton/trading unit return rate (manually entered by Admin)
      looseRate?: number; // loose unit rate
      condition: 'Sellable' | 'Damaged';
    }[];
  }): SalesReturn {
    const activeBiz = this.getActiveBusinessCompanyId();
    const sReturns = this.getSalesReturns(activeBiz);
    const inventory = this.getInventory(activeBiz);
    const ledgers = this.getLedger(activeBiz);
    const retailers = this.getRetailers(activeBiz);
    const invoices = this.getInvoices(activeBiz);
    const products = this.getProducts(activeBiz);
    const godowns = this.getGodowns(activeBiz);
    const defGodown = godowns.find(g => g.is_default && g.status === 'Active') || godowns[0];
    const targetGodownId = data.receiving_godown_id || defGodown?.id || (activeBiz === 'biz-saifee' ? 'gdn-saifee-main' : 'gdn-hub-a');
    const targetGodownName = godowns.find(g => g.id === targetGodownId)?.name || 'Main Godown';

    const retProfile = retailers.find(r => r.id === data.retailerId);
    const invRef = data.invoiceId ? invoices.find(i => i.id === data.invoiceId) : undefined;

    // Generate sequential Credit Note number CN-YYYY-XXXXX
    const year = new Date().getFullYear();
    const existingCNCount = sReturns.filter(sr => (sr.credit_note_number || '').includes(`CN-${year}`)).length;
    const creditNoteNumber = `CN-${year}-${String(existingCNCount + 1).padStart(5, '0')}`;
    const retId = `sr-${Date.now()}`;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCreditAmount = 0;

    const returnItems: SalesReturnItem[] = [];

    data.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      const tradingUnit = prod?.trading_unit || 'Carton';
      const baseUnit = prod?.base_unit || 'Piece';

      let cQty = item.cartonQty !== undefined ? item.cartonQty : 0;
      let lQty = item.looseQty !== undefined ? item.looseQty : 0;
      let totalBaseQty = 0;

      if (item.cartonQty === undefined && item.looseQty === undefined && item.quantity !== undefined) {
        totalBaseQty = item.quantity;
        const split = splitBaseQuantity(totalBaseQty, unitsPerPack);
        cQty = split.cartonQty;
        lQty = split.looseQty;
      } else {
        totalBaseQty = calculateBaseQuantity(cQty, lQty, unitsPerPack);
      }

      if (totalBaseQty <= 0) return;

      const cartonRate = item.rate;
      const looseRate = item.looseRate !== undefined ? item.looseRate : Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100;
      
      const lineTaxable = (cQty * cartonRate) + (lQty * looseRate);
      const gstPercent = prod?.gst_percent || 18;
      const lineGst = (lineTaxable * gstPercent) / 100;
      const lineTotal = lineTaxable + lineGst;

      const retStateCode = retProfile?.state_code || '27';
      const isInterState = retStateCode !== '27' && retStateCode !== '23';
      const lineCgst = isInterState ? 0 : lineGst / 2;
      const lineSgst = isInterState ? 0 : lineGst / 2;
      const lineIgst = isInterState ? lineGst : 0;

      totalTaxable += lineTaxable;
      totalCgst += lineCgst;
      totalSgst += lineSgst;
      totalIgst += lineIgst;
      totalCreditAmount += lineTotal;

      const srItem: SalesReturnItem = {
        id: `sr-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sales_return_id: retId,
        product_id: item.productId,
        quantity: totalBaseQty,
        carton_qty: cQty,
        loose_qty: lQty,
        base_qty: totalBaseQty,
        trading_unit: tradingUnit,
        base_unit: baseUnit,
        units_per_trading_unit: unitsPerPack,
        rate: cartonRate,
        loose_rate: looseRate,
        hsn: prod?.hsn || '19053100',
        mrp: prod?.mrp,
        gst_percent: gstPercent,
        taxable_value: Math.round(lineTaxable * 100) / 100,
        gst_amount: Math.round(lineGst * 100) / 100,
        cgst: Math.round(lineCgst * 100) / 100,
        sgst: Math.round(lineSgst * 100) / 100,
        igst: Math.round(lineIgst * 100) / 100,
        total_amount: Math.round(lineTotal * 100) / 100,
        condition: item.condition
      };

      returnItems.push(srItem);

      // Inventory adjustment for target Godown
      let stock = inventory.find(i => i.product_id === item.productId && (i.godown_id === targetGodownId || !i.godown_id));
      if (!stock) {
        stock = {
          id: `inv-${item.productId}-${targetGodownId}`,
          product_id: item.productId,
          godown_id: targetGodownId,
          physical_qty: 0,
          reserved_qty: 0,
          available_qty: 0,
          damaged_qty: 0,
          expired_qty: 0,
          business_id: activeBiz,
          updated_at: new Date().toISOString()
        };
        inventory.push(stock);
      } else if (!stock.godown_id) {
        stock.godown_id = targetGodownId;
      }

      if (item.condition === 'Sellable') {
        stock.physical_qty += totalBaseQty;
        stock.available_qty = stock.physical_qty - (stock.reserved_qty || 0);
      } else {
        stock.damaged_qty += totalBaseQty;
      }
      stock.updated_at = new Date().toISOString();

      // Stock Ledger Entry
      ledgers.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product_id: item.productId,
        godown_id: targetGodownId,
        change_qty: totalBaseQty,
        direction: 'IN',
        reason: `Sales Return (${item.condition} -> ${targetGodownName}) - ${creditNoteNumber}`,
        reference_id: creditNoteNumber,
        user_id: this.currentUserId,
        business_id: activeBiz,
        created_at: data.returnDate || new Date().toISOString()
      });
    });

    const grandCreditRounded = Math.round(totalCreditAmount);
    const roundOff = grandCreditRounded - totalCreditAmount;

    const newReturn: SalesReturn = {
      id: retId,
      credit_note_number: creditNoteNumber,
      retailer_id: data.retailerId,
      invoice_id: data.invoiceId,
      receiving_godown_id: targetGodownId,
      return_date: data.returnDate || new Date().toISOString(),
      reason: data.reason,
      status: 'Confirmed',
      taxable_amount: Math.round(totalTaxable * 100) / 100,
      gst_amount: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
      cgst: Math.round(totalCgst * 100) / 100,
      sgst: Math.round(totalSgst * 100) / 100,
      igst: Math.round(totalIgst * 100) / 100,
      round_off: Math.round(roundOff * 100) / 100,
      total_amount: grandCreditRounded,
      business_id: activeBiz,
      items: returnItems
    };

    sReturns.push(newReturn);
    this.saveSalesReturns(sReturns);
    this.saveInventory(inventory);
    this.saveLedger(ledgers);

    // Update retailer outstanding
    if (retProfile) {
      retProfile.outstanding = Math.max(0, retProfile.outstanding - grandCreditRounded);
      this.saveRetailers(retailers);
    }

    // If linked to an invoice, decrease invoice outstanding as well
    if (invRef) {
      invRef.outstanding_amount = Math.max(0, invRef.outstanding_amount - grandCreditRounded);
      this.saveInvoices(invoices);
    }

    return newReturn;
  }

  /**
   * Processes a Sales Return for a specific invoice (legacy adapter calling createDirectSalesReturn)
   */
  processSalesReturn(
    invoiceId: string,
    returns: {
      productId: string;
      quantity?: number;
      cartonQty?: number;
      looseQty?: number;
      tradingUnit?: 'Box' | 'Carton' | string;
      condition: 'Sellable' | 'Damaged';
    }[],
    reason: string
  ): SalesReturn {
    const invoices = this.getInvoices();
    const products = this.getProducts();
    const invRef = invoices.find(i => i.id === invoiceId);
    const retailerId = invRef?.retailer_id || '';

    const items = returns.map(r => {
      const prod = products.find(p => p.id === r.productId);
      const unitsPerPack = prod?.units_per_box_carton || 1;
      const matchingInvItem = invRef?.items?.find(item => item.product_id === r.productId);
      const cartonRate = matchingInvItem ? (matchingInvItem.carton_rate ?? matchingInvItem.rate) : (prod?.selling_price || 0);
      const looseRate = matchingInvItem ? (matchingInvItem.loose_rate ?? prod?.loose_selling_price ?? Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100) : (prod?.loose_selling_price || 0);

      return {
        productId: r.productId,
        cartonQty: r.cartonQty,
        looseQty: r.looseQty,
        quantity: r.quantity,
        rate: cartonRate,
        looseRate: looseRate,
        condition: r.condition
      };
    });

    return this.createDirectSalesReturn({
      retailerId,
      invoiceId,
      reason,
      items
    });
  }

  /**
   * Updates order status with optional notes
   */
  updateOrderStatus(orderId: string, status: Order['status'], notes?: string): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = status;
    if (notes) {
      if (status === 'Under Review') {
        order.review_notes = notes;
      }
      order.admin_notes = notes;
    }
    this.saveOrders(orders);
    return order;
  }

  /**
   * Updates an item's rate and flat rupee discount for an order item.
   * Maintains original ordered rate without overwriting historical snapshot.
   * Recalculates line totals and order totals, and logs to item activity history.
   */
  updateOrderItemRate(
    orderId: string,
    itemId: string,
    newRate: number,
    flatDiscount: number = 0,
    reason: string = 'Admin Approved Rate Override',
    adminUser?: { id: string; name: string }
  ): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    // Strict Read-Only Guard: Completed / Delivered orders cannot be modified
    if (order.status === 'Completed' || order.status === 'Delivered') {
      return null;
    }

    const products = this.getProducts();
    const targetItem = order.items?.find(i => i.id === itemId);
    if (!targetItem) return null;

    const prod = products.find(p => p.id === targetItem.product_id);
    const unitsPerPack = targetItem.units_per_trading_unit || prod?.units_per_box_carton || 1;

    const oldRate = targetItem.carton_rate ?? targetItem.order_time_rate ?? targetItem.base_price ?? prod?.selling_price ?? 0;
    const oldDiscount = targetItem.carton_discount ?? targetItem.discount ?? 0;

    // Preserve historical rates
    if (targetItem.order_time_rate === undefined) {
      targetItem.order_time_rate = oldRate;
    }
    if (targetItem.catalogue_rate_at_order === undefined) {
      targetItem.catalogue_rate_at_order = prod?.selling_price || oldRate;
    }

    const approvedRate = Math.max(0, newRate);
    const approvedFlatDisc = Math.max(0, flatDiscount);
    const finalRatePerCarton = Math.max(0, approvedRate - approvedFlatDisc);

    targetItem.carton_rate = approvedRate;
    targetItem.manual_billing_rate = approvedRate;
    targetItem.carton_discount = approvedFlatDisc;
    targetItem.discount = approvedFlatDisc;
    targetItem.manual_rate_applied = true;
    targetItem.manual_rate_updated_by = adminUser?.name || 'Admin';
    targetItem.manual_rate_updated_at = new Date().toISOString();
    targetItem.manual_rate_reason = reason;

    // Recalculate line total with flat discount
    const cartonQty = targetItem.carton_qty !== undefined ? targetItem.carton_qty : Math.floor(targetItem.quantity / unitsPerPack);
    const looseQty = targetItem.loose_qty !== undefined ? targetItem.loose_qty : (targetItem.quantity % unitsPerPack);
    const looseRate = targetItem.loose_rate ?? (Math.round((approvedRate / unitsPerPack) * 100) / 100);
    const looseDisc = targetItem.loose_discount ?? 0;
    const gstPercent = targetItem.gst_percent ?? prod?.gst_percent ?? 0;

    const amounts = calculateItemAmounts(
      cartonQty,
      looseQty,
      approvedRate,
      looseRate,
      approvedFlatDisc,
      looseDisc,
      gstPercent
    );

    targetItem.base_price = approvedRate;
    targetItem.final_price = amounts.taxableAmount;
    targetItem.final_applied_rate = finalRatePerCarton;
    targetItem.gst_amount = amounts.gstAmount;
    targetItem.total_amount = amounts.totalAmount;

    // Recalculate order total
    order.total_amount = Math.round((order.items || []).reduce((sum, it) => sum + (it.total_amount || 0), 0));

    // Activity Log
    this.addItemActivityLog({
      product_id: targetItem.product_id,
      action: 'Rate & Flat Discount Updated by Admin',
      details: `Order ${order.order_number}: Approved Rate changed from ₹${oldRate} to ₹${approvedRate}/Carton, Flat Discount=₹${approvedFlatDisc}/Carton, Net Final=₹${finalRatePerCarton}/Carton (Reason: ${reason})`,
      old_value: `Rate: ₹${oldRate}, Disc: ₹${oldDiscount}`,
      new_value: `Approved Rate: ₹${approvedRate}, Disc: ₹${approvedFlatDisc}, Net: ₹${finalRatePerCarton}`,
      reference_id: order.id,
      user_id: adminUser?.id || this.currentUserId,
      user_name: adminUser?.name || 'Admin User'
    });

    this.saveOrders(orders);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, adminUser, `Rate updated for ${targetItem.product_id}: Approved Rate ₹${approvedRate}, Disc ₹${approvedFlatDisc} (Reason: ${reason})`);

    return order;
  }

  /**
   * Fully confirms all items in an order (sets confirmed qty = ordered active qty, pending = 0)
   */
  fullyConfirmOrder(orderId: string, adminUser?: { id: string; name: string }): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const inventory = this.getInventory();
    const products = this.getProducts();

    (order.items || []).forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const oldConfirmed = item.confirmed_qty || 0;
      const targetConfirmed = item.quantity - (item.cancelled_qty || 0);
      const delta = targetConfirmed - oldConfirmed;

      item.confirmed_qty = targetConfirmed;
      item.pending_qty = 0;
      item.pending_reason = undefined;

      const inv = inventory.find(i => i.product_id === item.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty + delta);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }

      this.addItemActivityLog({
        product_id: item.product_id,
        action: 'Item Fully Confirmed',
        details: `Order ${order.order_number}: Confirmed full quantity ${Math.round((targetConfirmed / unitsPerPack) * 100) / 100} Cartons`,
        old_value: `Confirmed=${Math.round((oldConfirmed / unitsPerPack) * 100) / 100}`,
        new_value: `Confirmed=${Math.round((targetConfirmed / unitsPerPack) * 100) / 100}`,
        reference_id: order.id,
        user_id: adminUser?.id || this.currentUserId,
        user_name: adminUser?.name || 'Admin User'
      });
    });

    order.status = 'Confirmed';
    order.confirmed_at = new Date().toISOString();

    this.saveOrders(orders);
    this.saveInventory(inventory);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, adminUser, `Fully confirmed Order ${order.order_number}`);

    return order;
  }

  /**
   * Confirms specific item quantities and pending reasons for an order
   */
  confirmOrder(
    orderId: string,
    itemConfirms: { itemId: string; confirmedCartons?: number; confirmedQty?: number; pendingReason?: string }[],
    adminUser?: { id: string; name: string }
  ): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    // Strict Read-Only Guard: Completed / Delivered orders cannot be re-confirmed
    if (order.status === 'Completed' || order.status === 'Delivered') {
      return order;
    }

    const inventory = this.getInventory();
    const products = this.getProducts();
    let allFullyConfirmed = true;

    (order.items || []).forEach(item => {
      const conf = itemConfirms.find(c => c.itemId === item.id);
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const itemBaseQty = item.ordered_qty ?? item.base_qty ?? item.quantity;
      const alreadyFulfilled = item.fulfilled_qty ?? item.dispatched_qty ?? 0;
      const maxAllowed = item.remaining_qty !== undefined ? item.remaining_qty : Math.max(0, itemBaseQty - alreadyFulfilled - (item.cancelled_qty || 0));

      let newConfirmed = item.confirmed_qty || 0;
      if (conf) {
        if (conf.confirmedQty !== undefined) {
          newConfirmed = Math.min(maxAllowed, Math.max(0, conf.confirmedQty));
        } else if (conf.confirmedCartons !== undefined) {
          newConfirmed = Math.min(maxAllowed, Math.max(0, Math.round(conf.confirmedCartons * unitsPerPack)));
        }
        if (conf.pendingReason !== undefined) {
          item.pending_reason = conf.pendingReason;
        }
      }

      const oldConfirmed = item.confirmed_qty || 0;
      const delta = newConfirmed - oldConfirmed;
      item.confirmed_qty = newConfirmed;
      item.pending_qty = Math.max(0, maxAllowed - newConfirmed);

      if (newConfirmed < maxAllowed) {
        allFullyConfirmed = false;
      }

      const inv = inventory.find(i => i.product_id === item.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty + delta);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }

      if (conf) {
        this.addItemActivityLog({
          product_id: item.product_id,
          action: newConfirmed >= maxAllowed ? 'Item Fully Confirmed' : 'Item Partially Confirmed',
          details: `Order ${order.order_number}: Confirmed ${Math.round((newConfirmed / unitsPerPack) * 100) / 100}/${Math.round((maxAllowed / unitsPerPack) * 100) / 100} Cartons${item.pending_reason ? ` (Pending Reason: ${item.pending_reason})` : ''}`,
          old_value: `Confirmed=${Math.round((oldConfirmed / unitsPerPack) * 100) / 100}`,
          new_value: `Confirmed=${Math.round((newConfirmed / unitsPerPack) * 100) / 100}`,
          reference_id: order.id,
          user_id: adminUser?.id || this.currentUserId,
          user_name: adminUser?.name || 'Admin User'
        });
      }
    });

    const orderCalc = calculateOrderQuantities(order, products);
    if (orderCalc.computedStatus === 'Cancelled') {
      order.status = 'Cancelled';
    } else if (orderCalc.computedStatus === 'Completed') {
      order.status = 'Delivered';
    } else if (orderCalc.computedStatus === 'Packed') {
      order.status = 'Packed';
    } else if (orderCalc.computedStatus === 'Partially Dispatched') {
      order.status = 'Partially Dispatched';
    } else if (orderCalc.computedStatus === 'Partially Fulfilled') {
      order.status = 'Partially Fulfilled';
    } else if (orderCalc.computedStatus === 'Confirmed') {
      order.status = 'Confirmed';
    } else if (orderCalc.computedStatus === 'Partially Confirmed') {
      order.status = 'Partially Confirmed';
    } else if (order.status === 'Under Review') {
      order.status = 'Under Review';
    } else {
      order.status = 'Submitted';
    }
    order.confirmed_at = new Date().toISOString();

    this.saveOrders(orders);
    this.saveInventory(inventory);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, adminUser, `Confirmed quantities updated on Order ${order.order_number}`);

    return order;
  }

  /**
   * Confirms order item quantities, calculates pending quantities, and updates inventory reservations
   */
  confirmOrderQuantities(orderId: string, itemConfirms: { itemId: string; confirmedQty: number }[]): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const inventory = this.getInventory();
    const products = this.getProducts();
    let hasPending = false;

    order.items = order.items?.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      const unitsPerPack = item.units_per_trading_unit || prod?.units_per_box_carton || 1;
      const match = itemConfirms.find(c => c.itemId === item.id);
      const itemBaseQty = item.base_qty ?? item.quantity;
      const confQty = match !== undefined ? Math.min(itemBaseQty, Math.max(0, match.confirmedQty)) : (item.confirmed_qty ?? itemBaseQty);
      const prevConfirmed = item.confirmed_qty || 0;
      const delta = confQty - prevConfirmed;

      const pendQty = Math.max(0, itemBaseQty - confQty - (item.cancelled_qty || 0));
      if (pendQty > 0) {
        hasPending = true;
      }

      // Update inventory reservations: Reserved += delta (in base units)
      const inv = inventory.find(i => i.product_id === item.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty + delta);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }

      const split = splitBaseQuantity(confQty, unitsPerPack);

      return {
        ...item,
        carton_qty: split.cartonQty,
        loose_qty: split.looseQty,
        base_qty: itemBaseQty,
        confirmed_qty: confQty,
        pending_qty: pendQty
      };
    });

    const orderCalc = calculateOrderQuantities(order, products);
    if (orderCalc.computedStatus === 'Cancelled') {
      order.status = 'Cancelled';
    } else if (orderCalc.computedStatus === 'Completed') {
      order.status = 'Delivered';
    } else if (orderCalc.computedStatus === 'Packed') {
      order.status = 'Packed';
    } else if (orderCalc.computedStatus === 'Partially Dispatched') {
      order.status = 'Partially Dispatched';
    } else if (orderCalc.computedStatus === 'Partially Fulfilled') {
      order.status = 'Partially Fulfilled';
    } else if (orderCalc.computedStatus === 'Confirmed') {
      order.status = 'Confirmed';
    } else if (orderCalc.computedStatus === 'Partially Confirmed') {
      order.status = 'Partially Confirmed';
    } else if (order.status === 'Under Review') {
      order.status = 'Under Review';
    } else {
      order.status = 'Submitted';
    }
    order.confirmed_at = new Date().toISOString();

    this.saveOrders(orders);
    this.saveInventory(inventory);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, undefined, `Confirmed quantities updated on Order ${order.order_number}`);

    return order;
  }

  /**
   * Updates fulfilment details for an individual order item (confirm qty, pending reason, backordered status)
   */
  updateOrderItemFulfillment(
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
  ): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const inventory = this.getInventory();
    const products = this.getProducts();
    const targetItem = order.items?.find(i => i.id === itemId);
    if (!targetItem) return null;

    const prod = products.find(p => p.id === targetItem.product_id);
    const unitsPerPack = targetItem.units_per_trading_unit || prod?.units_per_box_carton || 1;
    const itemBaseQty = targetItem.base_qty ?? targetItem.quantity;
    const oldConfirmed = targetItem.confirmed_qty || 0;
    const oldPendingReason = targetItem.pending_reason || 'None';

    if (data.cancel_qty !== undefined && data.cancel_qty > 0) {
      const currentCancelled = targetItem.cancelled_qty || 0;
      const currentDispatched = targetItem.dispatched_qty || targetItem.delivered_qty || 0;
      const maxCancellable = Math.max(0, itemBaseQty - currentDispatched - currentCancelled);
      const qtyToCancel = Math.min(maxCancellable, data.cancel_qty);

      targetItem.cancelled_qty = currentCancelled + qtyToCancel;
      targetItem.cancel_reason = data.cancel_reason || targetItem.cancel_reason || 'Cancelled by Admin';
      targetItem.cancelled_by = adminUser?.name || 'Admin';
      targetItem.cancelled_at = new Date().toISOString();

      // If confirmed qty was higher than remaining active qty, reduce confirmed qty
      const activeQty = Math.max(0, itemBaseQty - targetItem.cancelled_qty);
      if ((targetItem.confirmed_qty || 0) > activeQty) {
        const reduceDelta = (targetItem.confirmed_qty || 0) - activeQty;
        targetItem.confirmed_qty = activeQty;
        const inv = inventory.find(i => i.product_id === targetItem.product_id);
        if (inv) {
          inv.reserved_qty = Math.max(0, inv.reserved_qty - reduceDelta);
          inv.available_qty = inv.physical_qty - inv.reserved_qty;
        }
      }
    }

    if (data.confirmed_qty !== undefined) {
      const maxAllowed = Math.max(0, itemBaseQty - (targetItem.cancelled_qty || 0));
      const newConfirmed = Math.min(maxAllowed, Math.max(0, data.confirmed_qty));
      const delta = newConfirmed - (targetItem.confirmed_qty || 0);

      targetItem.confirmed_qty = newConfirmed;

      // Adjust inventory reservation delta
      const inv = inventory.find(i => i.product_id === targetItem.product_id);
      if (inv) {
        inv.reserved_qty = Math.max(0, inv.reserved_qty + delta);
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }
    }

    if (data.pending_reason !== undefined) {
      targetItem.pending_reason = data.pending_reason;
    }

    if (data.backordered !== undefined) {
      targetItem.backordered = data.backordered;
    }

    // Recompute item pending qty
    const itemDispatched = targetItem.dispatched_qty || targetItem.delivered_qty || 0;
    const itemCancelled = targetItem.cancelled_qty || 0;
    targetItem.pending_qty = Math.max(0, itemBaseQty - itemDispatched - itemCancelled);

    // Recompute overall order status using quantitative helper
    const orderCalc = calculateOrderQuantities(order, products);
    if (orderCalc.computedStatus === 'Completed') {
      order.status = 'Delivered';
    } else if (orderCalc.computedStatus === 'Cancelled') {
      order.status = 'Cancelled';
    } else if (orderCalc.computedStatus === 'Packed') {
      order.status = 'Packed';
    } else if (orderCalc.computedStatus === 'Partially Dispatched') {
      order.status = 'Partially Dispatched';
    } else if (orderCalc.computedStatus === 'Partially Fulfilled') {
      order.status = 'Partially Fulfilled';
    } else if (orderCalc.computedStatus === 'Partially Confirmed') {
      order.status = 'Partially Confirmed';
    } else if (orderCalc.computedStatus === 'Confirmed') {
      order.status = 'Confirmed';
    } else if (order.status === 'Under Review') {
      order.status = 'Under Review';
    } else {
      order.status = 'Submitted';
    }

    // Audit Logging
    this.addItemActivityLog({
      product_id: targetItem.product_id,
      action: data.cancel_qty ? 'Order Item Cancelled' : 'Order Fulfilment Updated',
      details: `Order ${order.order_number}: Confirmed=${Math.round(((targetItem.confirmed_qty || 0) / unitsPerPack) * 100) / 100} Cartons, Reason="${targetItem.pending_reason || 'None'}"${data.cancel_qty ? `, Cancelled=${Math.round((data.cancel_qty / unitsPerPack) * 100) / 100} Cartons (Reason: ${data.cancel_reason || 'Admin Cancel'})` : ''}`,
      old_value: `Confirmed=${Math.round((oldConfirmed / unitsPerPack) * 100) / 100}, Reason=${oldPendingReason}`,
      new_value: `Confirmed=${Math.round(((targetItem.confirmed_qty || 0) / unitsPerPack) * 100) / 100}, Reason=${targetItem.pending_reason || 'None'}`,
      reference_id: order.id,
      user_id: adminUser?.id || this.currentUserId,
      user_name: adminUser?.name || 'Admin User'
    });

    this.saveOrders(orders);
    this.saveInventory(inventory);

    // Auto-sync to linked invoice if exists
    this.syncOrderToLinkedInvoice(order, adminUser, data.cancel_qty ? `Cancelled item quantity on Order ${order.order_number}: ${data.cancel_reason || ''}` : `Updated fulfillment on Order ${order.order_number}`);

    return order;
  }

  /**
   * Specifically cancels a quantity of an order item
   */
  cancelOrderItemQuantity(
    orderId: string,
    itemId: string,
    cancelQtyBaseUnits: number,
    cancelReason: string,
    adminUser?: { id: string; name: string }
  ): Order | null {
    return this.updateOrderItemFulfillment(
      orderId,
      itemId,
      {
        cancel_qty: cancelQtyBaseUnits,
        cancel_reason: cancelReason
      },
      adminUser
    );
  }

  /**
   * Allocates batches to order items and transitions status to Packed
   */
  allocateAndPackOrder(
    orderId: string,
    allocations: {
      orderItemId: string;
      batchAllocations: { batch_id: string; batch_number: string; allocated_qty: number }[];
    }[]
  ): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    order.items = order.items?.map(item => {
      const match = allocations.find(a => a.orderItemId === item.id);
      if (match) {
        const totalPacked = match.batchAllocations.reduce((s, b) => s + b.allocated_qty, 0);
        return {
          ...item,
          batch_allocations: match.batchAllocations,
          packed_qty: totalPacked
        };
      }
      return item;
    });

    order.status = 'Packed';
    order.packed_at = new Date().toISOString();

    this.saveOrders(orders);
    return order;
  }

  /**
   * Dispatches order: Atomically deducts stock from exact batches, generates Delivery Challan (if requested) and Tax Invoice, updates ledger, and locks allocations.
   * Option A: generateChallan = true -> Generates Delivery Challan & Tax Invoice.
   * Option B: generateChallan = false -> Proceeds without Delivery Challan (records 'Dispatched Without Delivery Challan').
   */
  dispatchOrder(
    orderId: string,
    dispatchInfo: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      dispatchGodown?: string;
      generateChallan?: boolean;
    } = {},
    adminUser?: { id: string; name: string }
  ): { order: Order; invoice: Invoice; challan?: DeliveryChallan } | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    // Prevent duplicate invoice generation on already completed / fully fulfilled orders
    const hasRemainingItems = (order.items || []).some(it => {
      const ord = it.ordered_qty ?? it.base_qty ?? it.quantity;
      const ful = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
      const can = it.cancelled_qty ?? 0;
      return (ord - ful - can) > 0;
    });

    if (order.status === 'Completed' || order.status === 'Delivered' || !hasRemainingItems) {
      const invoices = this.getInvoices();
      const challans = this.getDeliveryChallans();
      const inv = invoices.find(i => i.order_ref_id === order.id || i.id === order.invoice_id) || invoices.find(i => i.source_order_ids?.includes(order.id));
      const dc = challans.find(c => c.order_id === order.id || c.id === order.challan_id);
      if (inv) {
        return { order, invoice: inv, challan: dc };
      }
    }

    const shouldGenerateChallan = dispatchInfo.generateChallan !== false;
    const retailers = this.getRetailers();
    const ret = retailers.find(r => r.id === order.retailer_id) || retailers[0];
    const products = this.getProducts();
    const inventory = this.getInventory();
    const batches = this.getBatches();
    const ledgers = this.getLedger();
    const invoices = this.getInvoices();
    const challans = this.getDeliveryChallans();

    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalDispatchedUnits = 0;

    const invoiceId = `inv-${Date.now()}`;
    const challanId = `dc-${Date.now()}`;
    const invoiceNumber = `INV/2026-27/${String(invoices.length + 1).padStart(5, '0')}`;
    const challanNumber = `DC/2026-27/${String(challans.length + 1).padStart(5, '0')}`;

    const invoiceItems: InvoiceItem[] = [];
    const challanItems: DeliveryChallanItem[] = [];

    order.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) return;

      const unitsPerPack = item.units_per_trading_unit || prod.units_per_box_carton || 1;
      const tradingUnit = item.trading_unit || prod.trading_unit || 'Carton';
      const baseUnit = item.base_unit || prod.base_unit || 'Packet';

      const ordBase = item.ordered_qty ?? item.base_qty ?? item.quantity;
      const fulBase = item.fulfilled_qty ?? item.dispatched_qty ?? 0;
      const canBase = item.cancelled_qty ?? 0;
      const remainingUnbilled = item.remaining_qty !== undefined ? item.remaining_qty : Math.max(0, ordBase - fulBase - canBase);

      const requestedQty = item.packed_qty || item.confirmed_qty || remainingUnbilled;
      const qtyToDispatch = Math.min(remainingUnbilled, requestedQty);
      if (qtyToDispatch <= 0) return; // Prevent duplicate invoice for already fulfilled item/qty!

      totalDispatchedUnits += qtyToDispatch;

      // Rate Priority: Manual billing rate > Order-time rate > Default Selling Price
      const cartonRate = item.manual_rate_applied && item.manual_billing_rate ? item.manual_billing_rate : (item.carton_rate ?? item.order_time_rate ?? item.base_price ?? prod.selling_price);
      const looseRate = item.loose_rate ?? prod.loose_selling_price ?? (Math.round((cartonRate / Math.max(1, unitsPerPack)) * 100) / 100);
      const cartonDisc = item.carton_discount ?? item.discount ?? 0;
      const looseDisc = item.loose_discount ?? 0;

      // Allocations resolution (in base units)
      let allocations = item.batch_allocations || [];
      if (allocations.length === 0) {
        const prodBatches = batches.filter(b => b.product_id === prod.id && b.quantity > 0)
          .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
        
        let rem = qtyToDispatch;
        allocations = [];
        for (const b of prodBatches) {
          if (rem <= 0) break;
          const take = Math.min(b.quantity, rem);
          if (take > 0) {
            allocations.push({ batch_id: b.id, batch_number: b.batch_number, allocated_qty: take });
            rem -= take;
          }
        }
        if (allocations.length === 0) {
          allocations.push({ batch_id: 'bch-default', batch_number: 'BCH-2026-A1', allocated_qty: qtyToDispatch });
        }
      }

      item.batch_allocations = allocations;
      
      // Cumulative fulfilled & remaining calculation (Specification 1 & 4)
      const prevFulfilled = item.fulfilled_qty || 0;
      const newlyBilled = qtyToDispatch;
      item.fulfilled_qty = prevFulfilled + newlyBilled;
      item.ordered_qty = item.ordered_qty ?? item.base_qty ?? item.quantity;
      item.remaining_qty = Math.max(0, item.ordered_qty - item.fulfilled_qty - (item.cancelled_qty || 0));
      item.status = item.remaining_qty === 0 ? 'COMPLETED' : 'PARTIALLY_FULFILLED';
      item.dispatched_qty = item.fulfilled_qty;
      item.pending_qty = item.remaining_qty;
      item.confirmed_qty = 0;

      allocations.forEach(alloc => {
        const batch = batches.find(b => b.id === alloc.batch_id);
        if (batch) {
          batch.quantity = Math.max(0, batch.quantity - alloc.allocated_qty);
        }

        const allocMrp = alloc.mrp ?? batch?.mrp ?? item.selected_mrp ?? prod.mrp;
        const allocPurchaseRate = alloc.purchase_rate ?? batch?.purchase_rate ?? item.purchase_rate ?? prod.purchase_price;
        const allocCartonPrice = item.manual_rate_applied && item.manual_billing_rate 
          ? item.manual_billing_rate 
          : (alloc.selling_price ?? batch?.selling_price ?? cartonRate);
        const allocLoosePrice = alloc.loose_selling_price ?? batch?.loose_selling_price ?? looseRate;

        const allocQty = alloc.allocated_qty;
        const { cartonQty: allocCartonQty, looseQty: allocLooseQty } = splitBaseQuantity(allocQty, unitsPerPack);

        const amounts = calculateItemAmounts(
          allocCartonQty,
          allocLooseQty,
          allocCartonPrice,
          allocLoosePrice,
          cartonDisc,
          looseDisc,
          prod.gst_percent
        );

        let cgst = 0, sgst = 0, igst = 0;
        if (ret.state_code === '27') {
          cgst = amounts.gstAmount / 2;
          sgst = amounts.gstAmount / 2;
        } else {
          igst = amounts.gstAmount;
        }

        subtotal += amounts.grossAmount;
        discountTotal += amounts.discountAmount;
        taxableTotal += amounts.taxableAmount;
        cgstTotal += cgst;
        sgstTotal += sgst;
        igstTotal += igst;

        invoiceItems.push({
          id: `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          invoice_id: invoiceId,
          product_id: prod.id,
          hsn: prod.hsn,
          packing: prod.pack_size,
          quantity: allocQty,
          carton_qty: allocCartonQty,
          loose_qty: allocLooseQty,
          base_qty: allocQty,
          trading_unit: tradingUnit,
          base_unit: baseUnit,
          units_per_trading_unit: unitsPerPack,
          rate: allocCartonPrice,
          carton_rate: allocCartonPrice,
          loose_rate: allocLoosePrice,
          discount: amounts.discountAmount,
          carton_discount: cartonDisc,
          loose_discount: looseDisc,
          taxable_value: amounts.taxableAmount,
          cgst,
          sgst,
          igst,
          total_amount: amounts.totalAmount,
          batch_number: alloc.batch_number,
          batch_id: alloc.batch_id,
          mrp: allocMrp,
          purchase_rate: allocPurchaseRate,
          catalogue_rate: prod.selling_price,
          order_time_rate: item.order_time_rate ?? item.base_price,
          manual_billing_rate: item.manual_billing_rate,
          manual_rate_applied: item.manual_rate_applied,
          manual_rate_reason: item.manual_rate_reason
        });

        if (shouldGenerateChallan) {
          challanItems.push({
            id: `dc-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            challan_id: challanId,
            order_item_id: item.id,
            product_id: prod.id,
            product_name: prod.name,
            brand: prod.brand,
            variant_name: prod.name,
            pack_size: prod.pack_size,
            trading_unit: tradingUnit,
            base_unit: baseUnit,
            units_per_trading_unit: unitsPerPack,
            carton_qty: allocCartonQty,
            loose_qty: allocLooseQty,
            base_qty: allocQty,
            dispatched_qty: allocQty,
            batch_number: alloc.batch_number,
            batch_id: alloc.batch_id,
            mrp: allocMrp,
            purchase_rate: allocPurchaseRate,
            expiry_date: batch?.expiry_date
          });
        }

        // Stock Ledger Outward entry (in base units)
        ledgers.push({
          id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          product_id: prod.id,
          change_qty: -allocQty,
          direction: 'OUT',
          reason: 'Sale',
          reference_id: order.id,
          user_id: adminUser?.id || this.currentUserId,
          created_at: new Date().toISOString()
        });
      });

      // Deduct inventory physical & reserved quantities in base units
      const inv = inventory.find(i => i.product_id === prod.id);
      if (inv) {
        inv.physical_qty = Math.max(0, inv.physical_qty - qtyToDispatch);
        inv.reserved_qty = Math.max(0, inv.reserved_qty - (item.confirmed_qty || qtyToDispatch));
        inv.available_qty = inv.physical_qty - inv.reserved_qty;
      }
    });

    const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal);

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      retailer_id: ret.id,
      order_ref_id: order.id,
      date: dispatchInfo.dispatchDate || new Date().toISOString(),
      place_of_supply: ret.state_code === '27' ? 'Maharashtra (27)' : `Out of State (${ret.state_code})`,
      subtotal,
      discount_amount: discountTotal,
      taxable_value: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: 0,
      outstanding_amount: grandTotal,
      items: invoiceItems
    };

    let newChallan: DeliveryChallan | undefined = undefined;
    if (shouldGenerateChallan) {
      newChallan = {
        id: challanId,
        challan_number: challanNumber,
        order_id: order.id,
        order_number: order.order_number,
        retailer_id: ret.id,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        dispatch_date: dispatchInfo.dispatchDate || new Date().toISOString(),
        transport_mode: dispatchInfo.transportMode || 'Distributor Delivery Van',
        vehicle_number: dispatchInfo.vehicleNumber || 'MH-04-AZ-4592',
        delivery_person: dispatchInfo.deliveryPerson || 'Delivery Staff',
        notes: dispatchInfo.notes || 'Dispatched in good condition.',
        total_quantity: totalDispatchedUnits,
        items: challanItems,
        created_at: new Date().toISOString()
      };
      challans.push(newChallan);
      this.saveDeliveryChallans(challans);
    }

    // Update retailer ledger
    ret.outstanding += grandTotal;

    // Determine if fully or partially dispatched (Specification 4: Lifecycle Automation)
    const hasAnyRemaining = (order.items || []).some(it => {
      const ord = it.ordered_qty ?? it.base_qty ?? it.quantity;
      const ful = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
      const can = it.cancelled_qty ?? 0;
      return (ord - ful - can) > 0;
    });

    if (!hasAnyRemaining) {
      order.status = 'Completed';
    } else {
      order.status = 'Partially Fulfilled';
    }

    order.dispatched_at = dispatchInfo.dispatchDate || new Date().toISOString();
    order.invoice_id = invoiceId;
    if (newChallan) {
      order.challan_id = challanId;
    }
    order.dispatch_transport_mode = dispatchInfo.transportMode;
    order.dispatch_vehicle_number = dispatchInfo.vehicleNumber;
    order.dispatch_delivery_person = dispatchInfo.deliveryPerson;
    order.dispatch_notes = dispatchInfo.notes;

    invoices.push(newInvoice);
    this.saveInvoices(invoices);
    this.saveOrders(orders);
    this.saveInventory(inventory);
    this.saveBatches(batches);
    this.saveLedger(ledgers);
    this.saveRetailers(retailers);

    // Activity Log
    this.addItemActivityLog({
      product_id: order.items?.[0]?.product_id || '',
      action: shouldGenerateChallan ? 'Delivery Challan & Dispatch Generated' : 'Dispatched Without Delivery Challan',
      details: shouldGenerateChallan
        ? `Order ${order.order_number}: Dispatched with Delivery Challan ${challanNumber} and Tax Invoice ${invoiceNumber}. Dispatched Units: ${totalDispatchedUnits}`
        : `Order ${order.order_number}: Dispatched Without Delivery Challan. Tax Invoice ${invoiceNumber} generated. Dispatched Units: ${totalDispatchedUnits}`,
      reference_id: order.id,
      user_id: adminUser?.id || this.currentUserId,
      user_name: adminUser?.name || 'Admin User'
    });

    return { order, invoice: newInvoice, challan: newChallan };
  }

  /**
   * Saves packing progress for an order or consolidated packing lot:
   * 1. Updates modified packed quantities, piece/box counts, unit rates, and manual line notes directly in the DB.
   * 2. Sets order status to 'PACKING_IN_PROGRESS' (or 'Packing').
   * 3. Does NOT generate invoice, does NOT lock order, does NOT finalize GST ledger entries.
   */
  saveLotPackingProgress(
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
  ): { updatedOrders: Order[] } | null {
    const orders = this.getOrders();
    const sourceOrders = orders.filter(o => lotData.sourceOrderIds.includes(o.id));
    if (sourceOrders.length === 0) return null;

    sourceOrders.forEach(ord => {
      if (ord.status !== 'Completed' && ord.status !== 'Dispatched' && ord.status !== 'Delivered') {
        ord.status = 'PACKING_IN_PROGRESS';
        ord.packed_at = new Date().toISOString();
        if (adminUser?.name) {
          ord.review_notes = ord.review_notes ? `${ord.review_notes} | Staged by ${adminUser.name}` : `Packing staged by ${adminUser.name}`;
        }
      }

      (ord.items || []).forEach(it => {
        const update = lotData.items.find(u => u.originOrderId === ord.id && u.originItemId === it.id);
        if (update) {
          it.packed_qty = Math.max(0, update.packedPieces);
          it.packed_pieces = Math.max(0, update.packedPieces);
          it.packed_cartons = Math.max(0, update.packedCartons !== undefined ? update.packedCartons : update.packedPieces);
          if (update.packedLoose !== undefined) {
            it.loose_qty = update.packedLoose;
          }
          if (update.unitRate !== undefined && update.unitRate > 0) {
            it.unit_rate = update.unitRate;
            it.rate = update.unitRate;
            it.base_price = update.unitRate;
          }
          if (update.notes) {
            (it as any).packing_notes = update.notes;
          }
        }
      });
      ord.updated_at = new Date().toISOString();
    });

    this.saveOrders(orders);
    return { updatedOrders: sourceOrders };
  }

  /**
   * Dispatches an entire Unified Retailer Packing Lot with STRICT 1-BILL consolidation:
   * 1. Creates EXACTLY ONE Tax Invoice for all packed items across all source orders in the lot.
   * 2. Preserves exact product_name, MRP, and pack config on invoice items without generic mutations.
   * 3. Calculates shortages (ordered_qty - packed_qty):
   *    - Shortages are automatically preserved as unfulfilled remaining quantities on source order items (and in backorder queue).
   *    - Parent source orders with 0 remaining quantities transition to 'Completed'.
   *    - Parent source orders with shortages transition to 'Partially Fulfilled'.
   *    - Parent source orders with shortages transition to 'Partially Fulfilled'.
   * 4. Deducts stock atomically from batches/inventory and records ledger entries.
   */
  dispatchRetailerPackingLot(
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
    dispatchInfo: {
      transportMode?: string;
      vehicleNumber?: string;
      deliveryPerson?: string;
      notes?: string;
      dispatchDate?: string;
      generateChallan?: boolean;
    } = {},
    adminUser?: { id: string; name: string }
  ): { invoice: Invoice; challan?: DeliveryChallan; updatedOrders: Order[] } | null {
    const orders = this.getOrders();
    const sourceOrders = orders.filter(o => lotData.sourceOrderIds.includes(o.id));
    if (sourceOrders.length === 0 && lotData.sourceOrderIds.length > 0) return null;

    const retailers = this.getRetailers();
    const ret = retailers.find(r => r.id === lotData.retailerId) || retailers[0];
    const products = this.getProducts();
    const inventory = this.getInventory();
    const batches = this.getBatches();
    const ledgers = this.getLedger();
    const invoices = this.getInvoices();
    const challans = this.getDeliveryChallans();

    const invoiceId = `inv-${Date.now()}`;
    const challanId = `dc-${Date.now()}`;
    const invoiceNumber = `INV/2026-27/${String(invoices.length + 1).padStart(5, '0')}`;
    const challanNumber = `DC/2026-27/${String(challans.length + 1).padStart(5, '0')}`;

    let subtotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalDispatchedUnits = 0;

    const invoiceItems: InvoiceItem[] = [];
    const challanItems: DeliveryChallanItem[] = [];

    // Filter items that have at least 1 carton or loose unit packed
    const activePackedItems = lotData.items.filter(it => (it.packedCartons > 0 || (it.packedLoose || 0) > 0));
    if (activePackedItems.length === 0) return null;

    activePackedItems.forEach(lotItem => {
      const prod = products.find(p => p.id === lotItem.productId);
      const unitsPerPack = lotItem.unitsPerPack || prod?.units_per_box_carton || 1;
      const tradingUnit = lotItem.tradingUnit || prod?.trading_unit || 'Carton';
      const baseUnit = lotItem.baseUnit || prod?.base_unit || 'Piece';
      const packedCartons = Math.max(0, lotItem.packedCartons || 0);
      const packedLoose = Math.max(0, lotItem.packedLoose || 0);
      const packedBaseUnits = (packedCartons * unitsPerPack) + packedLoose;
      const effectiveCartonQty = packedCartons + (packedLoose / unitsPerPack);
      const unitRate = lotItem.unitRate;
      const unitLooseRate = Math.round((unitRate / unitsPerPack) * 100) / 100;
      const mrp = lotItem.mrp || prod?.mrp || 0;

      totalDispatchedUnits += packedBaseUnits;

      // Mathematical Financials (Formula: Taxable = effectiveCartonQty * unitRate)
      const lineTaxable = Math.round(effectiveCartonQty * unitRate * 100) / 100;
      const gstPercent = prod?.gst_percent || 18;
      const gstAmount = Math.round(lineTaxable * (gstPercent / 100) * 100) / 100;

      let cgst = 0, sgst = 0, igst = 0;
      if (ret.state_code === '27') {
        cgst = Math.round((gstAmount / 2) * 100) / 100;
        sgst = Math.round((gstAmount / 2) * 100) / 100;
      } else {
        igst = gstAmount;
      }

      const lineTotal = lineTaxable + cgst + sgst + igst;
      subtotal += lineTaxable;
      taxableTotal += lineTaxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;

      // Exact preserved product description (No name mutation)
      const packConfig = `${unitsPerPack} ${baseUnit}/${tradingUnit}`;
      const exactDescription = `${lotItem.productName} (${packConfig}) - MRP ₹${mrp.toFixed(2)}`;

      // Stock Deduction & FIFO Batch Allocation
      const prodBatches = batches.filter(b => b.product_id === lotItem.productId && b.quantity > 0)
        .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

      let remUnits = packedBaseUnits;
      let allocatedBatchNumber = 'BCH-2026-A1';
      let allocatedBatchId = 'bch-default';

      for (const b of prodBatches) {
        if (remUnits <= 0) break;
        const take = Math.min(b.quantity, remUnits);
        if (take > 0) {
          b.quantity -= take;
          remUnits -= take;
          allocatedBatchNumber = b.batch_number;
          allocatedBatchId = b.id;
        }
      }

      // Add to SINGLE invoice items with dual carton + loose breakdown
      invoiceItems.push({
        id: `inv-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        invoice_id: invoiceId,
        product_id: lotItem.productId,
        product_name: lotItem.productName,
        variant_name: exactDescription,
        description: exactDescription,
        hsn: lotItem.hsn || prod?.hsn || '1902',
        packing: packConfig,
        quantity: packedBaseUnits,
        carton_qty: packedCartons,
        loose_qty: packedLoose,
        base_qty: packedBaseUnits,
        trading_unit: tradingUnit,
        base_unit: baseUnit,
        units_per_trading_unit: unitsPerPack,
        units_per_box_carton: unitsPerPack,
        rate: unitRate,
        carton_rate: unitRate,
        loose_rate: unitLooseRate,
        discount: 0,
        carton_discount: 0,
        loose_discount: 0,
        taxable_value: lineTaxable,
        cgst,
        sgst,
        igst,
        total_amount: lineTotal,
        batch_number: allocatedBatchNumber,
        batch_id: allocatedBatchId,
        mrp,
        purchase_rate: lotItem.purchaseCost,
        catalogue_rate: prod?.selling_price || unitRate,
        manual_billing_rate: unitRate,
        manual_rate_applied: true
      });

      if (dispatchInfo.generateChallan !== false) {
        challanItems.push({
          id: `dc-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          challan_id: challanId,
          order_item_id: lotItem.originItemId,
          product_id: lotItem.productId,
          product_name: lotItem.productName,
          brand: prod?.brand,
          variant_name: exactDescription,
          pack_size: packConfig,
          trading_unit: tradingUnit,
          base_unit: baseUnit,
          units_per_trading_unit: unitsPerPack,
          carton_qty: packedCartons,
          loose_qty: packedLoose,
          base_qty: packedBaseUnits,
          dispatched_qty: packedBaseUnits,
          batch_number: allocatedBatchNumber,
          batch_id: allocatedBatchId,
          mrp,
          purchase_rate: lotItem.purchaseCost
        });
      }

      // Record Stock Ledger Entry
      ledgers.push({
        id: `led-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product_id: lotItem.productId,
        change_qty: -packedBaseUnits,
        direction: 'OUT',
        reason: 'Sale',
        reference_id: invoiceId,
        user_id: adminUser?.id || this.currentUserId,
        created_at: new Date().toISOString()
      });

      // Deduct inventory physical & reserved quantities
      const inv = inventory.find(i => i.product_id === lotItem.productId);
      if (inv) {
        inv.physical_qty = Math.max(0, inv.physical_qty - packedBaseUnits);
        inv.available_qty = Math.max(0, inv.physical_qty - (inv.reserved_qty || 0));
      }

      // Update the originating order item's fulfilled and remaining quantities
      const srcOrder = orders.find(o => o.id === lotItem.originOrderId);
      if (srcOrder && srcOrder.items) {
        const srcItem = srcOrder.items.find(i => i.id === lotItem.originItemId);
        if (srcItem) {
          // Initialize srcItem.ordered_qty if missing, preserving original ordered base units
          if (srcItem.ordered_qty === undefined) {
            const ordCartons = lotItem.orderedCartons ?? 0;
            const ordLoose = lotItem.orderedLoose ?? 0;
            const fromLot = (ordCartons * unitsPerPack) + ordLoose;
            srcItem.ordered_qty = fromLot > 0 ? fromLot : (srcItem.base_qty ?? srcItem.quantity ?? packedBaseUnits);
          }

          const ordBase = srcItem.ordered_qty;
          const prevFul = srcItem.fulfilled_qty || 0;
          const newFul = prevFul + packedBaseUnits;
          const remaining = Math.max(0, ordBase - newFul - (srcItem.cancelled_qty || 0));

          srcItem.fulfilled_qty = newFul;
          srcItem.remaining_qty = remaining;
          srcItem.status = remaining === 0 ? 'COMPLETED' : (newFul > 0 ? 'PARTIALLY_FULFILLED' : 'WAITING_STOCK');
          srcItem.dispatched_qty = newFul;
          srcItem.pending_qty = remaining;
          srcItem.packed_qty = packedBaseUnits;
          srcItem.carton_rate = unitRate;
          srcItem.rate = unitRate;
          srcItem.order_time_rate = srcItem.order_time_rate || unitRate;
          srcItem.manual_billing_rate = unitRate;
        }
      }
    });

    // Also ensure any items in the source orders that were packed with 0 have their ordered_qty and remaining_qty initialized
    lotData.items.filter(it => (it.packedCartons <= 0 && (it.packedLoose || 0) <= 0)).forEach(lotItem => {
      const srcOrder = orders.find(o => o.id === lotItem.originOrderId);
      if (srcOrder && srcOrder.items) {
        const srcItem = srcOrder.items.find(i => i.id === lotItem.originItemId);
        if (srcItem) {
          const prod = products.find(p => p.id === lotItem.productId);
          const unitsPerPack = lotItem.unitsPerPack || prod?.units_per_box_carton || 1;
          if (srcItem.ordered_qty === undefined) {
            const ordCartons = lotItem.orderedCartons ?? 0;
            const ordLoose = lotItem.orderedLoose ?? 0;
            const fromLot = (ordCartons * unitsPerPack) + ordLoose;
            srcItem.ordered_qty = fromLot > 0 ? fromLot : (srcItem.base_qty ?? srcItem.quantity ?? 0);
          }
          const ordBase = srcItem.ordered_qty;
          const prevFul = srcItem.fulfilled_qty || 0;
          const remaining = Math.max(0, ordBase - prevFul - (srcItem.cancelled_qty || 0));
          srcItem.remaining_qty = remaining;
          srcItem.pending_qty = remaining;
          if (remaining > 0 && (srcItem.fulfilled_qty || 0) === 0) {
            srcItem.status = 'WAITING_STOCK';
          }
        }
      }
    });

    // Update parent order statuses
    sourceOrders.forEach(ord => {
      const hasShortages = (ord.items || []).some(it => {
        const ordBase = it.ordered_qty ?? it.base_qty ?? it.quantity ?? 0;
        const fulBase = it.fulfilled_qty ?? it.dispatched_qty ?? 0;
        const canBase = it.cancelled_qty ?? 0;
        const rem = it.remaining_qty !== undefined ? it.remaining_qty : Math.max(0, ordBase - fulBase - canBase);
        return rem > 0;
      });

      ord.status = hasShortages ? 'Partially Fulfilled' : 'Completed';
      ord.dispatched_at = dispatchInfo.dispatchDate || new Date().toISOString();
      ord.invoice_id = invoiceId;
      if (dispatchInfo.generateChallan !== false) {
        ord.challan_id = challanId;
      }
    });

    const grandTotal = Math.round(taxableTotal + cgstTotal + sgstTotal + igstTotal);
    const roundOff = grandTotal - (taxableTotal + cgstTotal + sgstTotal + igstTotal);

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      retailer_id: ret.id,
      order_ref_id: sourceOrders[0]?.id || '',
      source_order_ids: lotData.sourceOrderIds,
      source_order_numbers: sourceOrders.map(o => o.order_number),
      order_numbers: sourceOrders.map(o => o.order_number),
      date: dispatchInfo.dispatchDate || new Date().toISOString(),
      place_of_supply: ret.state_code === '27' ? 'Maharashtra (27)' : `Out of State (${ret.state_code})`,
      subtotal,
      discount_amount: 0,
      taxable_value: taxableTotal,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: 0,
      outstanding_amount: grandTotal,
      payment_status: 'Unpaid',
      items: invoiceItems
    };

    let newChallan: DeliveryChallan | undefined = undefined;
    if (dispatchInfo.generateChallan !== false) {
      newChallan = {
        id: challanId,
        challan_number: challanNumber,
        order_id: sourceOrders[0]?.id || '',
        order_number: sourceOrders.map(o => o.order_number).join(', '),
        retailer_id: ret.id,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        dispatch_date: dispatchInfo.dispatchDate || new Date().toISOString(),
        transport_mode: dispatchInfo.transportMode || 'Distributor Delivery Van',
        vehicle_number: dispatchInfo.vehicleNumber || 'MH-04-AZ-4592',
        delivery_person: dispatchInfo.deliveryPerson || 'Delivery Staff',
        notes: dispatchInfo.notes || 'Dispatched from Retailer Packing Lot',
        total_quantity: totalDispatchedUnits,
        items: challanItems,
        created_at: new Date().toISOString()
      };
      challans.push(newChallan);
      this.saveDeliveryChallans(challans);
    }

    // Update retailer ledger
    ret.outstanding = (ret.outstanding || 0) + grandTotal;
    ret.outstanding_balance = (ret.outstanding_balance || 0) + grandTotal;
    ret.current_balance = (ret.current_balance || 0) + grandTotal;

    invoices.push(newInvoice);
    this.saveInvoices(invoices);
    this.saveOrders(orders);
    this.saveInventory(inventory);
    this.saveBatches(batches);
    this.saveLedger(ledgers);
    this.saveRetailers(retailers);

    // Audit Log
    this.addItemActivityLog({
      product_id: activePackedItems[0]?.productId || '',
      action: '1-Bill Retailer Lot Dispatched',
      details: `Generated single Tax Invoice ${invoiceNumber} for ${ret.shop_name}. Merged orders: ${sourceOrders.map(o => o.order_number).join(', ')}. Total Value: ₹${grandTotal}`,
      reference_id: newInvoice.id,
      user_id: adminUser?.id || this.currentUserId,
      user_name: adminUser?.name || 'Floor Admin'
    });

    return { invoice: newInvoice, challan: newChallan, updatedOrders: sourceOrders };
  }

  /**
   * Marks an order as Completed when all quantities are fulfilled and billing is closed.
   */
  completeOrder(orderId: string, adminUser?: { id: string; name: string }): Order | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

    const totalUnfulfilledRemaining = (order.items || []).reduce((s, it) => {
      const itemBase = it.base_qty ?? it.quantity;
      const itemDisp = it.dispatched_qty || 0;
      const itemCanc = it.cancelled_qty || 0;
      return s + Math.max(0, itemBase - itemDisp - itemCanc);
    }, 0);

    if (totalUnfulfilledRemaining > 0) {
      return null;
    }

    order.status = 'Completed';
    order.delivered_at = new Date().toISOString();

    this.addItemActivityLog({
      product_id: order.items?.[0]?.product_id || '',
      action: 'Order Completed',
      details: `Order ${order.order_number} marked as Completed. All items dispatched and billing completed.`,
      reference_id: order.id,
      user_id: adminUser?.id || this.currentUserId,
      user_name: adminUser?.name || 'Admin User'
    });

    this.saveOrders(orders);
    return order;
  }

  /**
   * Records payment against an order's invoice, or confirms credit terms without creating a payment voucher
   */
  recordOrderPayment(
    orderId: string,
    invoiceId: string,
    amount: number,
    method: Payment['method'],
    refNumber?: string,
    notes?: string,
    adminUser?: { id: string; name: string }
  ): Payment | { id: string; type: 'credit_confirmed'; invoice_id: string } | null {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    const invoices = this.getInvoices();
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return null;

    const retailers = this.getRetailers();
    const ret = retailers.find(r => r.id === inv.retailer_id);

    if (method === 'Credit') {
      // For Credit / Pay Later: NO money is received.
      // Do NOT create an entry in the Payments / Cash / Bank receipts ledger.
      // The Invoice itself remains open (outstanding) in the retailer's ledger.
      inv.notes = (inv.notes ? inv.notes + ' | ' : '') + `Credit / Pay Later terms confirmed (${notes || 'On Account'})`;

      this.addItemActivityLog({
        product_id: order?.items?.[0]?.product_id || '',
        action: 'Invoice Settled on Credit Terms',
        details: `Invoice ${inv.invoice_number} (Order ${order?.order_number || ''}): Confirmed on Credit / Pay Later terms for ₹${inv.outstanding_amount}. No payment receipt generated. Retailer ledger balance remains due: ₹${ret?.outstanding || 0}.`,
        reference_id: inv.id,
        user_id: adminUser?.id || this.currentUserId,
        user_name: adminUser?.name || 'Admin User'
      });

      this.saveInvoices(invoices);
      this.saveOrders(orders);
      return { id: `cred-${Date.now()}`, type: 'credit_confirmed', invoice_id: inv.id };
    }

    // Money Collection (UPI, Cash, Bank Transfer, Cheque, Other):
    const payments = this.getPayments();
    const allocations = this.getPaymentAllocations();

    const payId = `pay-${Date.now()}`;
    const payNum = `PAY-${new Date().getFullYear()}-${String(payments.length + 1).padStart(5, '0')}`;

    const allocAmt = Math.min(inv.outstanding_amount, amount);
    inv.outstanding_amount = Math.max(0, inv.outstanding_amount - allocAmt);
    inv.paid_amount += allocAmt;

    const newPayment: Payment = {
      id: payId,
      retailer_id: inv.retailer_id,
      payment_number: payNum,
      amount: allocAmt,
      method,
      reference_number: refNumber || `REF-${Date.now().toString().slice(-6)}`,
      notes: notes || `Payment collection for Invoice ${inv.invoice_number} (Order ${order?.order_number || ''})`,
      date: new Date().toISOString()
    };

    payments.push(newPayment);
    this.savePayments(payments);

    allocations.push({
      id: `alloc-${Date.now()}`,
      payment_id: payId,
      invoice_id: inv.id,
      amount_allocated: allocAmt
    });
    this.savePaymentAllocations(allocations);

    if (ret) {
      ret.outstanding = Math.max(0, ret.outstanding - allocAmt);
      this.saveRetailers(retailers);
    }

    if (order && inv.outstanding_amount === 0) {
      const allDelivered = order.items?.every(i => (i.pending_qty || 0) === 0);
      if (allDelivered) {
        order.status = 'Delivered';
        order.delivered_at = new Date().toISOString();
      }
    }

    this.saveInvoices(invoices);
    this.savePaymentAllocations(allocations);
    this.saveOrders(orders);

    return newPayment;
  }

  // ----------------------------------------------------
  // VYAPAR PRODUCT & STOCK IMPORT REPOSITORY & METHODS
  // ----------------------------------------------------

  /**
   * Executes a batch import of products and opening stock from Vyapar.
   */
  executeVyaparBatchImport(
    rowsToImport: {
      rowNumber: number;
      action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'SKIP';
      existingProductId?: string;
      data: {
        name: string;
        company_name?: string;
        brand?: string;
        category?: string;
        sku?: string;
        barcode?: string;
        pack_size?: string;
        trading_unit?: string;
        base_unit?: BaseUnit;
        units_per_box_carton?: number;
        mrp: number;
        purchase_price: number;
        selling_price: number;
        gst_percent?: number;
        hsn?: string;
        description?: string;
        stock_qty?: number;
        stock_qty_is_base?: boolean;
        batch_number?: string;
        expiry_date?: string;
        supplier_name?: string;
        image_url?: string;
      };
    }[],
    meta: {
      file_name: string;
      file_size?: number;
      column_mapping: Record<string, string>;
      user_id?: string;
      user_name?: string;
    }
  ): { importId: string; batch: VyaparImportBatch } {
    const activeBiz = this.getActiveBusinessCompanyId();
    const products = this.getProducts(activeBiz);
    const companies = this.getCompanies();
    const inventory = this.getInventory(activeBiz);
    const batches = this.getBatches(activeBiz);
    const ledgers = this.getLedger(activeBiz);
    const purchases = this.getPurchases(activeBiz);
    const activityLogs = this.getItemActivityLogs(undefined, activeBiz);
    const vyaparImports = this.getVyaparImports(activeBiz);

    const importId = `IMP-VYAPAR-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const userName = meta.user_name || 'Admin';
    const userId = meta.user_id || 'p-admin-1';

    const createdProductIds: string[] = [];
    const updatedSnapshots: VyaparImportSnapshot[] = [];
    const createdBatchIds: string[] = [];
    const createdLedgerIds: string[] = [];
    const purchaseItems: PurchaseItem[] = [];
    const rowLogs: VyaparImportRowLog[] = [];

    let totalStockInward = 0;
    let totalPurchaseVal = 0;

    for (const item of rowsToImport) {
      if (item.action === 'SKIP') {
        rowLogs.push({
          row_number: item.rowNumber,
          product_name: item.data.name,
          sku: item.data.sku,
          barcode: item.data.barcode,
          action_taken: 'SKIPPED'
        });
        continue;
      }

      // Find or create Company
      const compName = (item.data.company_name?.trim() || item.data.brand?.trim() || 'General FMCG');
      let comp = companies.find(c => c.name.toLowerCase() === compName.toLowerCase());
      if (!comp) {
        const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const newComp: Company = {
          id: newCompId,
          name: compName,
          code: compName.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || 'FMCG',
          active: true
        };
        companies.push(newComp);
        comp = newComp;
      }
      const companyId = comp.id;
      const companyName = comp.name;

      const unitsPerPack = Math.max(1, item.data.units_per_box_carton || parseInt(item.data.pack_size?.match(/\d+/)?.[0] || '1', 10));
      const packSizeStr = item.data.pack_size?.trim() || `${unitsPerPack} units/${item.data.trading_unit || 'Carton'}`;
      const tradingUnit = item.data.trading_unit || 'Carton';
      const baseUnit = item.data.base_unit || 'Packet';
      const gstPercent = item.data.gst_percent !== undefined ? Number(item.data.gst_percent) : 18;
      const hsnCode = item.data.hsn?.trim() || '19053100';

      // Determine stock quantity in base units
      const rawStock = Math.max(0, item.data.stock_qty || 0);
      const baseQty = item.data.stock_qty_is_base ? Math.floor(rawStock) : Math.floor(rawStock * unitsPerPack);
      const batchNum = item.data.batch_number?.trim() || `VYP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const expDate = item.data.expiry_date?.trim() || '2027-12-31';

      if (item.action === 'CREATE_NEW') {
        const newProdId = `prd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newSku = item.data.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`;
        const newBarcode = item.data.barcode?.trim() || `BC-${Date.now().toString().slice(-8)}`;

        const newProd: Product = {
          id: newProdId,
          business_id: activeBiz,
          product_code: `PRD-${Date.now().toString().slice(-6)}`,
          name: item.data.name.trim(),
          company_id: companyId,
          brand: item.data.brand?.trim() || companyName,
          category: item.data.category?.trim() || companyName,
          subcategory: 'General',
          description: item.data.description?.trim() || '',
          sku: newSku,
          barcode: newBarcode,
          pack_size: packSizeStr,
          trading_unit: tradingUnit,
          base_unit: baseUnit,
          packing_display: packSizeStr,
          units_per_box_carton: unitsPerPack,
          units_per_trading_unit: unitsPerPack,
          allow_loose_sale: true,
          loose_price_mode: 'auto',
          loose_selling_price: Math.round((item.data.selling_price / unitsPerPack) * 100) / 100,
          loose_mrp: Math.round((item.data.mrp / unitsPerPack) * 100) / 100,
          loose_purchase_price: Math.round((item.data.purchase_price / unitsPerPack) * 100) / 100,
          carton_discount: 0,
          loose_discount: 0,
          mrp: item.data.mrp,
          selling_price: item.data.selling_price,
          purchase_price: item.data.purchase_price,
          gst_percent: gstPercent,
          hsn: hsnCode,
          min_stock_level: 5,
          reorder_level: 10,
          batch_tracking_enabled: true,
          expiry_tracking_enabled: true,
          image_url: item.data.image_url,
          active: true,
          created_at: timestamp,
          updated_at: timestamp
        };

        products.push(newProd);
        createdProductIds.push(newProdId);

        // Inventory balance
        inventory.push({
          id: `inv-${newProdId}`,
          business_id: activeBiz,
          product_id: newProdId,
          physical_qty: baseQty,
          reserved_qty: 0,
          available_qty: baseQty,
          damaged_qty: 0,
          expired_qty: 0,
          updated_at: timestamp
        });

        if (baseQty > 0) {
          totalStockInward += baseQty;
          
          // Batch
          const bchId = `bch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          batches.push({
            id: bchId,
            business_id: activeBiz,
            product_id: newProdId,
            batch_number: batchNum,
            expiry_date: expDate,
            purchase_rate: item.data.purchase_price,
            mrp: item.data.mrp,
            selling_price: item.data.selling_price,
            quantity: baseQty,
            godown: 'Main Godown',
            cost_layer: importId
          });
          createdBatchIds.push(bchId);

          // Ledger Entry
          const ledId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          ledgers.push({
            id: ledId,
            business_id: activeBiz,
            product_id: newProdId,
            change_qty: baseQty,
            reason: 'Opening Stock / Vyapar Import',
            direction: 'IN',
            reference_id: importId,
            user_id: userId,
            created_at: timestamp
          });
          createdLedgerIds.push(ledId);

          // Purchase line item
          const ctnQty = Math.floor(baseQty / unitsPerPack);
          const looseQty = baseQty % unitsPerPack;
          const lineVal = (ctnQty * item.data.purchase_price) + (looseQty * (item.data.purchase_price / unitsPerPack));
          const lineGst = lineVal * (gstPercent / 100);
          totalPurchaseVal += lineVal + lineGst;

          purchaseItems.push({
            product_id: newProdId,
            quantity: baseQty,
            carton_qty: ctnQty,
            loose_qty: looseQty,
            trading_unit: tradingUnit,
            base_unit: baseUnit,
            units_per_box_carton: unitsPerPack,
            units_per_trading_unit: unitsPerPack,
            purchase_rate: item.data.purchase_price,
            carton_rate: item.data.purchase_price,
            loose_purchase_rate: Math.round((item.data.purchase_price / unitsPerPack) * 100) / 100,
            discount: 0,
            free_quantity: 0,
            mrp: item.data.mrp,
            gst_percent: gstPercent,
            hsn: hsnCode,
            batch: batchNum,
            expiry_date: expDate
          });
        }

        // Activity Log
        activityLogs.push({
          id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          business_id: activeBiz,
          product_id: newProdId,
          action: 'Item Master Created (Vyapar Import)',
          details: `Imported from ${meta.file_name} with ${baseQty} base units opening stock.`,
          reference_id: importId,
          user_name: userName,
          created_at: timestamp
        });

        rowLogs.push({
          row_number: item.rowNumber,
          product_name: newProd.name,
          sku: newProd.sku,
          barcode: newProd.barcode,
          action_taken: 'CREATED',
          product_id: newProdId,
          stock_inward_qty: baseQty,
          batch_number: baseQty > 0 ? batchNum : undefined,
          expiry_date: baseQty > 0 ? expDate : undefined
        });

      } else if (item.action === 'UPDATE_EXISTING' && item.existingProductId) {
        const existing = products.find(p => p.id === item.existingProductId);
        if (existing) {
          // Snapshot previous state
          updatedSnapshots.push({
            product_id: existing.id,
            previous_product: JSON.parse(JSON.stringify(existing))
          });

          const fieldChanges: { field: string; old_value: any; new_value: any }[] = [];

          if (item.data.mrp !== existing.mrp) {
            fieldChanges.push({ field: 'MRP', old_value: existing.mrp, new_value: item.data.mrp });
            existing.mrp = item.data.mrp;
          }
          if (item.data.purchase_price !== existing.purchase_price) {
            fieldChanges.push({ field: 'Purchase Price', old_value: existing.purchase_price, new_value: item.data.purchase_price });
            existing.purchase_price = item.data.purchase_price;
          }
          if (item.data.selling_price !== existing.selling_price) {
            fieldChanges.push({ field: 'Selling Price', old_value: existing.selling_price, new_value: item.data.selling_price });
            existing.selling_price = item.data.selling_price;
          }
          if (item.data.gst_percent !== undefined && item.data.gst_percent !== existing.gst_percent) {
            fieldChanges.push({ field: 'GST %', old_value: existing.gst_percent, new_value: item.data.gst_percent });
            existing.gst_percent = item.data.gst_percent;
          }
          if (item.data.hsn && item.data.hsn !== existing.hsn) {
            fieldChanges.push({ field: 'HSN', old_value: existing.hsn, new_value: item.data.hsn });
            existing.hsn = item.data.hsn;
          }
          if (item.data.description && item.data.description !== existing.description) {
            fieldChanges.push({ field: 'Description', old_value: existing.description, new_value: item.data.description });
            existing.description = item.data.description;
          }
          if (item.data.barcode && item.data.barcode !== existing.barcode) {
            fieldChanges.push({ field: 'Barcode', old_value: existing.barcode, new_value: item.data.barcode });
            existing.barcode = item.data.barcode;
          }

          existing.updated_at = timestamp;

          // Inward stock if specified
          if (baseQty > 0) {
            totalStockInward += baseQty;
            const inv = inventory.find(i => i.product_id === existing.id);
            if (inv) {
              inv.physical_qty += baseQty;
              inv.available_qty += baseQty;
              inv.updated_at = timestamp;
            } else {
              inventory.push({
                id: `inv-${existing.id}`,
                business_id: activeBiz,
                product_id: existing.id,
                physical_qty: baseQty,
                reserved_qty: 0,
                available_qty: baseQty,
                damaged_qty: 0,
                expired_qty: 0,
                updated_at: timestamp
              });
            }

            const bchId = `bch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            batches.push({
              id: bchId,
              business_id: activeBiz,
              product_id: existing.id,
              batch_number: batchNum,
              expiry_date: expDate,
              purchase_rate: item.data.purchase_price,
              mrp: item.data.mrp,
              selling_price: item.data.selling_price,
              quantity: baseQty,
              godown: 'Main Godown',
              cost_layer: importId
            });
            createdBatchIds.push(bchId);

            const ledId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            ledgers.push({
              id: ledId,
              business_id: activeBiz,
              product_id: existing.id,
              change_qty: baseQty,
              reason: 'Opening Stock Inward / Vyapar Import',
              direction: 'IN',
              reference_id: importId,
              user_id: userId,
              created_at: timestamp
            });
            createdLedgerIds.push(ledId);

            const ctnQty = Math.floor(baseQty / unitsPerPack);
            const looseQty = baseQty % unitsPerPack;
            const lineVal = (ctnQty * item.data.purchase_price) + (looseQty * (item.data.purchase_price / unitsPerPack));
            const lineGst = lineVal * (existing.gst_percent / 100);
            totalPurchaseVal += lineVal + lineGst;

            purchaseItems.push({
              product_id: existing.id,
              quantity: baseQty,
              carton_qty: ctnQty,
              loose_qty: looseQty,
              trading_unit: existing.trading_unit,
              base_unit: existing.base_unit,
              units_per_box_carton: unitsPerPack,
              units_per_trading_unit: unitsPerPack,
              purchase_rate: existing.purchase_price,
              carton_rate: existing.purchase_price,
              loose_purchase_rate: Math.round((existing.purchase_price / unitsPerPack) * 100) / 100,
              discount: 0,
              free_quantity: 0,
              mrp: existing.mrp,
              gst_percent: existing.gst_percent,
              hsn: existing.hsn,
              batch: batchNum,
              expiry_date: expDate
            });
          }

          // Activity Logs
          fieldChanges.forEach(fc => {
            activityLogs.push({
              id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              business_id: activeBiz,
              product_id: existing.id,
              action: `Field Updated (${fc.field})`,
              details: `Updated via Vyapar import from ${meta.file_name}`,
              old_value: String(fc.old_value),
              new_value: String(fc.new_value),
              reference_id: importId,
              user_name: userName,
              created_at: timestamp
            });
          });

          rowLogs.push({
            row_number: item.rowNumber,
            product_name: existing.name,
            sku: existing.sku,
            barcode: existing.barcode,
            action_taken: 'UPDATED',
            product_id: existing.id,
            changes: fieldChanges,
            stock_inward_qty: baseQty > 0 ? baseQty : undefined,
            batch_number: baseQty > 0 ? batchNum : undefined,
            expiry_date: baseQty > 0 ? expDate : undefined
          });
        }
      }
    }

    // Create consolidated inward purchase record if opening stock was inwarded
    let createdPurchaseId: string | undefined;
    if (purchaseItems.length > 0) {
      createdPurchaseId = `pur-vyapar-${Date.now()}`;
      purchases.push({
        id: createdPurchaseId,
        business_id: activeBiz,
        supplier_id: 'supp-vyapar-opening',
        invoice_number: `VYAPAR-IMP-${Date.now().toString().slice(-6)}`,
        invoice_date: new Date().toISOString().split('T')[0],
        total_amount: Math.round(totalPurchaseVal),
        status: 'Confirmed',
        created_at: timestamp,
        items: purchaseItems
      });
      this.savePurchases(purchases, activeBiz);
    }

    // Save batch record
    const batchRecord: VyaparImportBatch = {
      id: importId,
      business_id: activeBiz,
      file_name: meta.file_name,
      file_size: meta.file_size,
      imported_at: timestamp,
      total_rows: rowsToImport.length,
      created_count: createdProductIds.length,
      updated_count: updatedSnapshots.length,
      skipped_count: rowsToImport.filter(r => r.action === 'SKIP').length,
      failed_count: 0,
      stock_units_imported: totalStockInward,
      status: 'Completed',
      imported_by_id: userId,
      imported_by_name: userName,
      created_product_ids: createdProductIds,
      updated_snapshots: updatedSnapshots,
      created_purchase_id: createdPurchaseId,
      created_batch_ids: createdBatchIds,
      created_ledger_ids: createdLedgerIds,
      column_mapping: meta.column_mapping,
      row_logs: rowLogs
    };

    vyaparImports.unshift(batchRecord);

    // Save all stores
    this.saveProducts(products, activeBiz);
    this.saveCompanies(companies);
    this.saveInventory(inventory, activeBiz);
    this.saveBatches(batches, activeBiz);
    this.saveLedger(ledgers, activeBiz);
    this.saveItemActivityLogs(activityLogs, activeBiz);
    this.saveVyaparImports(vyaparImports, activeBiz);

    return { importId, batch: batchRecord };
  }

  getInitialVyaparImports(): VyaparImportBatch[] {
    return this.getVyaparImports();
  }

  getVyaparImports(targetBusinessId?: string): VyaparImportBatch[] {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<VyaparImportBatch>('fmcg_vyapar_imports', []);
    return all.filter(v => (v.business_id || 'biz-saifee') === activeBiz);
  }

  saveVyaparImports(imports: VyaparImportBatch[], targetBusinessId?: string): void {
    const activeBiz = targetBusinessId || this.getActiveBusinessCompanyId();
    const all = this.getStore<VyaparImportBatch>('fmcg_vyapar_imports', []);
    const otherBiz = all.filter(v => (v.business_id || 'biz-saifee') !== activeBiz);
    const tagged = imports.map(v => ({ ...v, business_id: v.business_id || activeBiz }));
    this.saveStore('fmcg_vyapar_imports', [...otherBiz, ...tagged]);
  }

  /**
   * Rolls back an imported Vyapar batch safely, preserving unrelated transactions.
   */
  rollbackVyaparImport(importId: string, reason?: string, userName?: string): { success: boolean; message: string } {
    const activeBiz = this.getActiveBusinessCompanyId();
    const vyaparImports = this.getVyaparImports(activeBiz);
    const batch = vyaparImports.find(b => b.id === importId);
    if (!batch) {
      return { success: false, message: 'Import batch not found.' };
    }
    if (batch.status === 'Rolled Back') {
      return { success: false, message: 'This import batch has already been rolled back.' };
    }

    // Check safety: Ensure none of the created products are used in Invoices or Orders
    const invoices = this.getInvoices(activeBiz);
    const orders = this.getOrders(activeBiz);
    const createdSet = new Set(batch.created_product_ids);

    const usedInvoices = invoices.filter(inv => inv.items?.some(i => createdSet.has(i.product_id)));
    const usedOrders = orders.filter(ord => ord.items?.some(i => createdSet.has(i.product_id)));

    if (usedInvoices.length > 0 || usedOrders.length > 0) {
      return {
        success: false,
        message: `Cannot rollback: Products from this import are linked to ${usedInvoices.length} existing invoice(s) and ${usedOrders.length} order(s). Reversal would corrupt financial ledgers.`
      };
    }

    // Safe to rollback
    let products = this.getProducts(activeBiz);
    let inventory = this.getInventory(activeBiz);
    let batches = this.getBatches(activeBiz);
    let ledgers = this.getLedger(activeBiz);
    let purchases = this.getPurchases(activeBiz);
    const activityLogs = this.getItemActivityLogs(undefined, activeBiz);

    // 1. Remove created products and their inventory
    products = products.filter(p => !createdSet.has(p.id));
    inventory = inventory.filter(inv => !createdSet.has(inv.product_id));

    // 2. Restore updated products to pre-import snapshots
    batch.updated_snapshots?.forEach(snap => {
      const idx = products.findIndex(p => p.id === snap.product_id);
      if (idx !== -1) {
        products[idx] = snap.previous_product;
      }
    });

    // 3. Remove created opening batches
    const batchSet = new Set(batch.created_batch_ids || []);
    batches = batches.filter(b => !batchSet.has(b.id));

    // 4. Remove created ledger entries
    const ledgerSet = new Set(batch.created_ledger_ids || []);
    ledgers = ledgers.filter(l => !ledgerSet.has(l.id));

    // 5. Remove opening purchase record
    if (batch.created_purchase_id) {
      purchases = purchases.filter(pur => pur.id !== batch.created_purchase_id);
    }

    // 6. Update batch status
    batch.status = 'Rolled Back';
    batch.rollback_at = new Date().toISOString();
    batch.rollback_by_name = userName || 'Admin';
    batch.rollback_reason = reason || 'Admin requested rollback';

    // Save all stores
    this.saveProducts(products, activeBiz);
    this.saveInventory(inventory, activeBiz);
    this.saveBatches(batches, activeBiz);
    this.saveLedger(ledgers, activeBiz);
    this.savePurchases(purchases, activeBiz);
    this.saveVyaparImports(vyaparImports, activeBiz);

    return {
      success: true,
      message: `Successfully rolled back batch ${importId}. Removed ${batch.created_product_ids.length} created products and restored ${batch.updated_snapshots.length} updated products.`
    };
  }
}

export const db = new FMCGDatabase();
