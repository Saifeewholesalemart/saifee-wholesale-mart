/**
 * Schema Safety Preflight Checker & Comprehensive Validator
 * Saifee FMCG Wholesale Distribution & Trade Management System
 * File: scripts/preflight_schema_check.ts
 *
 * SAFETY PRINCIPLES:
 * 1. READ-ONLY INSPECTION: Only queries metadata from information_schema.
 * 2. ZERO DESTRUCTIVE ACTIONS: Never drops, alters, resets, or migrates any table or data.
 * 3. ABORT ON MISMATCH: Fails safely before any DDL if tables, columns, types, or constraints mismatch.
 * 4. FULL 42-TABLE COVERAGE: Matches supabase/clean_rebuild_schema.sql.
 */

export interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
}

export interface ConstraintInfo {
  table_name: string;
  constraint_name: string;
  constraint_type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  columns?: string[];
  foreign_table_name?: string;
  foreign_columns?: string[];
  check_clause?: string;
}

export interface TableRlsStatus {
  table_name: string;
  rls_enabled: boolean;
  rls_forced?: boolean;
}

export interface PolicyInfo {
  table_name: string;
  policy_name: string;
  permissive?: string;
  roles?: string[];
  cmd?: string;
  qual?: string;
  with_check?: string;
}

export interface TableGrantInfo {
  table_name: string;
  grantee: string;
  privilege_type: string;
}

export interface PreflightMismatch {
  table: string;
  column?: string;
  constraint?: string;
  policy?: string;
  reason: string;
  existingType: string;
  expectedType: string;
  category?: 'MISSING_TABLE' | 'MISSING_COLUMN' | 'INCOMPATIBLE_TYPE' | 'UUID_DETECTED' | 'MISSING_CONSTRAINT' | 'CONFLICTING_CONSTRAINT' | 'RLS_DISABLED' | 'PERMISSIVE_POLICY' | 'MISSING_POLICY';
}

export interface PreflightCheckResult {
  isCompatible: boolean;
  tableCount: number;
  isEmptyDatabase: boolean;
  missingTables: string[];
  mismatches: PreflightMismatch[];
  summary: string;
}

export interface PreflightOptions {
  requireAllTables?: boolean;
  validateConstraints?: boolean;
  validateRls?: boolean;
  rlsStatuses?: TableRlsStatus[];
  policies?: PolicyInfo[];
  grants?: TableGrantInfo[];
}

export class SchemaPreflightMismatchError extends Error {
  public readonly mismatches: PreflightMismatch[];
  public readonly missingTables: string[];

  constructor(summary: string, mismatches: PreflightMismatch[], missingTables: string[] = []) {
    super(summary);
    this.name = 'SchemaPreflightMismatchError';
    this.mismatches = mismatches;
    this.missingTables = missingTables;
  }
}

/**
 * All 42 tables defined in supabase/clean_rebuild_schema.sql in topological order.
 */
export const ALL_42_SCHEMA_TABLES: string[] = [
  "system_settings",
  "business_companies",
  "profiles",
  "company_members",
  "godowns",
  "companies",
  "categories",
  "products",
  "product_categories",
  "suppliers",
  "product_aliases",
  "purchases",
  "purchase_items",
  "inventory",
  "inventory_batches",
  "stock_ledger",
  "stock_transfers",
  "stock_transfer_items",
  "retailers",
  "orders",
  "order_items",
  "fulfilments",
  "fulfilment_items",
  "invoices",
  "invoice_items",
  "delivery_challans",
  "delivery_challan_items",
  "payments",
  "payment_allocations",
  "customer_ledger",
  "cash_flow_transactions",
  "company_opening_balances",
  "sales_returns",
  "sales_return_items",
  "purchase_returns",
  "purchase_return_items",
  "billing_rate_audit_logs",
  "item_activity_logs",
  "invoice_audits",
  "vyapar_imports",
  "ai_purchase_imports",
  "ai_purchase_import_items"
];

/**
 * Expected columns and normalized types for all 42 tables.
 */
export const EXPECTED_42_TABLE_COLUMNS: Record<string, Record<string, string>> = {
  "system_settings": {
    "key": "text",
    "value": "jsonb",
    "updated_at": "timestamptz"
  },
  "business_companies": {
    "id": "text",
    "code": "text",
    "name": "text",
    "legal_name": "text",
    "business_type": "text",
    "logo_url": "text",
    "gstin": "text",
    "pan": "text",
    "address": "text",
    "city": "text",
    "state": "text",
    "state_code": "text",
    "pincode": "text",
    "phone": "text",
    "email": "text",
    "currency": "text",
    "is_default": "boolean",
    "invoice_prefix": "text",
    "order_prefix": "text",
    "customer_term": "text",
    "settings": "jsonb",
    "modules": "jsonb",
    "status": "text",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "profiles": {
    "id": "text",
    "business_id": "text",
    "email": "text",
    "mobile": "text",
    "phone": "text",
    "contact_no": "text",
    "name": "text",
    "full_name": "text",
    "role": "text",
    "profile_type": "text",
    "sales_role_type": "text",
    "trade_scope": "text",
    "custom_role": "text",
    "department": "text",
    "password_hash": "text",
    "company_id": "text",
    "retailer_id": "text",
    "assigned_company_ids": "jsonb",
    "assigned_category_ids": "jsonb",
    "category_access_mode": "text",
    "active": "boolean",
    "status": "text",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "company_members": {
    "id": "text",
    "business_id": "text",
    "company_id": "text",
    "user_id": "text",
    "role": "text",
    "status": "text",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "godowns": {
    "id": "text",
    "business_id": "text",
    "company_id": "text",
    "code": "text",
    "name": "text",
    "address": "text",
    "city": "text",
    "state": "text",
    "pincode": "text",
    "manager_name": "text",
    "phone": "text",
    "is_default": "boolean",
    "status": "text",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "companies": {
    "id": "text",
    "name": "text",
    "code": "text",
    "active": "boolean",
    "created_at": "timestamptz"
  },
  "categories": {
    "id": "text",
    "business_id": "text",
    "name": "text",
    "description": "text",
    "salesperson_access_type": "text",
    "assigned_salesperson_ids": "jsonb",
    "retailer_access_type": "text",
    "assigned_retailer_ids": "jsonb",
    "active": "boolean",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "products": {
    "id": "text",
    "business_id": "text",
    "product_code": "text",
    "name": "text",
    "company_id": "text",
    "brand": "text",
    "category": "text",
    "subcategory": "text",
    "sku": "text",
    "barcode": "text",
    "pack_size": "text",
    "packing_display": "text",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_box_carton": "integer",
    "units_per_trading_unit": "integer",
    "pieces_per_carton": "integer",
    "mrp": "numeric",
    "selling_price": "numeric",
    "purchase_price": "numeric",
    "dealer_price": "numeric",
    "loose_mrp": "numeric",
    "loose_selling_price": "numeric",
    "loose_purchase_price": "numeric",
    "carton_discount": "numeric",
    "loose_discount": "numeric",
    "allow_loose_sale": "boolean",
    "allow_carton": "boolean",
    "allow_pieces": "boolean",
    "trade_mode": "text",
    "loose_price_mode": "text",
    "gst_percent": "numeric",
    "hsn": "text",
    "image_url": "text",
    "description": "text",
    "min_stock_level": "integer",
    "reorder_level": "integer",
    "batch_tracking_enabled": "boolean",
    "expiry_tracking_enabled": "boolean",
    "parent_product_id": "text",
    "variant_attribute": "text",
    "variant_value": "text",
    "active": "boolean",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "product_categories": {
    "id": "text",
    "product_id": "text",
    "category_id": "text",
    "created_at": "timestamptz"
  },
  "suppliers": {
    "id": "text",
    "business_id": "text",
    "name": "text",
    "gstin": "text",
    "address": "text",
    "active": "boolean",
    "created_at": "timestamptz"
  },
  "product_aliases": {
    "id": "text",
    "supplier_id": "text",
    "alias_name": "text",
    "product_id": "text"
  },
  "purchases": {
    "id": "text",
    "business_id": "text",
    "supplier_id": "text",
    "invoice_number": "text",
    "invoice_date": "text",
    "total_amount": "numeric",
    "receiving_godown_id": "text",
    "status": "text",
    "created_at": "timestamptz"
  },
  "purchase_items": {
    "id": "text",
    "purchase_id": "text",
    "product_id": "text",
    "quantity": "integer",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_trading_unit": "integer",
    "units_per_box_carton": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "base_qty": "integer",
    "purchase_rate": "numeric",
    "carton_rate": "numeric",
    "loose_purchase_rate": "numeric",
    "loose_rate": "numeric",
    "selling_price": "numeric",
    "loose_selling_price": "numeric",
    "discount": "numeric",
    "free_quantity": "integer",
    "mrp": "numeric",
    "gst_percent": "numeric",
    "hsn": "text",
    "batch": "text",
    "manufacturing_date": "text",
    "expiry_date": "text"
  },
  "inventory": {
    "id": "text",
    "business_id": "text",
    "godown_id": "text",
    "product_id": "text",
    "physical_qty": "integer",
    "reserved_qty": "integer",
    "available_qty": "integer",
    "damaged_qty": "integer",
    "expired_qty": "integer",
    "pending_qty": "integer",
    "updated_at": "timestamptz"
  },
  "inventory_batches": {
    "id": "text",
    "business_id": "text",
    "product_id": "text",
    "godown_id": "text",
    "godown_name": "text",
    "godown": "text",
    "batch_number": "text",
    "mfg_date": "text",
    "expiry_date": "text",
    "purchase_rate": "numeric",
    "selling_price": "numeric",
    "loose_selling_price": "numeric",
    "mrp": "numeric",
    "quantity": "integer",
    "entry_date": "text",
    "cost_layer": "text",
    "created_at": "timestamptz"
  },
  "stock_ledger": {
    "id": "text",
    "business_id": "text",
    "product_id": "text",
    "godown_id": "text",
    "change_qty": "integer",
    "direction": "text",
    "reason": "text",
    "reference_id": "text",
    "user_id": "text",
    "batch_id": "text",
    "batch_number": "text",
    "previous_qty": "integer",
    "new_qty": "integer",
    "notes": "text",
    "created_at": "timestamptz"
  },
  "stock_transfers": {
    "id": "text",
    "business_id": "text",
    "company_id": "text",
    "transfer_number": "text",
    "from_godown_id": "text",
    "to_godown_id": "text",
    "status": "text",
    "requested_by": "text",
    "approved_by": "text",
    "dispatched_at": "timestamptz",
    "received_at": "timestamptz",
    "notes": "text",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "stock_transfer_items": {
    "id": "text",
    "transfer_id": "text",
    "product_id": "text",
    "batch_id": "text",
    "batch_number": "text",
    "quantity": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "received_qty": "integer",
    "received_carton_qty": "integer",
    "received_loose_qty": "integer"
  },
  "retailers": {
    "id": "text",
    "business_id": "text",
    "retailer_code": "text",
    "shop_name": "text",
    "owner_name": "text",
    "address": "text",
    "city": "text",
    "state": "text",
    "state_code": "text",
    "pincode": "text",
    "gstin": "text",
    "mobile": "text",
    "phone": "text",
    "credit_limit": "numeric",
    "outstanding": "numeric",
    "outstanding_balance": "numeric",
    "current_balance": "numeric",
    "beat_name": "text",
    "route": "text",
    "password_hash": "text",
    "assigned_category_ids": "jsonb",
    "category_access_mode": "text",
    "active": "boolean",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "orders": {
    "id": "text",
    "business_id": "text",
    "order_number": "text",
    "retailer_id": "text",
    "source": "text",
    "channel": "text",
    "created_by": "text",
    "order_date": "timestamptz",
    "total_amount": "numeric",
    "status": "text",
    "order_notes": "text",
    "admin_notes": "text",
    "review_notes": "text",
    "cancellation_reason": "text",
    "dispatch_transport_mode": "text",
    "dispatch_vehicle_number": "text",
    "dispatch_delivery_person": "text",
    "dispatch_notes": "text",
    "dispatch_godown": "text",
    "invoice_id": "text",
    "challan_id": "text",
    "confirmed_at": "timestamptz",
    "packed_at": "timestamptz",
    "packed_by": "text",
    "dispatched_at": "timestamptz",
    "delivered_at": "timestamptz",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "order_items": {
    "id": "text",
    "order_id": "text",
    "product_id": "text",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_trading_unit": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "base_qty": "integer",
    "quantity": "integer",
    "base_price": "numeric",
    "carton_rate": "numeric",
    "loose_rate": "numeric",
    "discount": "numeric",
    "carton_discount": "numeric",
    "loose_discount": "numeric",
    "final_price": "numeric",
    "gst_percent": "numeric",
    "gst_amount": "numeric",
    "total_amount": "numeric",
    "catalogue_rate_at_order": "numeric",
    "order_time_rate": "numeric",
    "manual_billing_rate": "numeric",
    "final_applied_rate": "numeric",
    "manual_rate_applied": "boolean",
    "manual_rate_updated_by": "text",
    "manual_rate_updated_at": "timestamptz",
    "manual_rate_reason": "text",
    "batch_id": "text",
    "rate": "numeric",
    "mrp": "numeric",
    "purchase_rate": "numeric",
    "ordered_qty": "integer",
    "confirmed_qty": "integer",
    "packed_qty": "integer",
    "fulfilled_qty": "integer",
    "dispatched_qty": "integer",
    "remaining_qty": "integer",
    "pending_qty": "integer",
    "batch_allocations": "jsonb",
    "status": "text"
  },
  "fulfilments": {
    "id": "text",
    "business_id": "text",
    "retailer_id": "text",
    "fulfilment_number": "text",
    "status": "text",
    "created_at": "timestamptz"
  },
  "fulfilment_items": {
    "id": "text",
    "fulfilment_id": "text",
    "order_item_id": "text",
    "product_id": "text",
    "original_qty": "integer",
    "confirmed_qty": "integer",
    "pending_qty": "integer",
    "manual_billing_rate": "numeric",
    "manual_rate_applied": "boolean",
    "manual_rate_updated_by": "text",
    "manual_rate_updated_at": "timestamptz",
    "manual_rate_reason": "text"
  },
  "invoices": {
    "id": "text",
    "business_id": "text",
    "company_id": "text",
    "invoice_number": "text",
    "retailer_id": "text",
    "order_ref_id": "text",
    "source_order_ids": "jsonb",
    "source_order_numbers": "jsonb",
    "order_numbers": "jsonb",
    "fulfilment_number": "text",
    "date": "timestamptz",
    "place_of_supply": "text",
    "subtotal": "numeric",
    "discount_amount": "numeric",
    "taxable_value": "numeric",
    "cgst": "numeric",
    "sgst": "numeric",
    "igst": "numeric",
    "round_off": "numeric",
    "grand_total": "numeric",
    "paid_amount": "numeric",
    "outstanding_amount": "numeric",
    "payment_status": "text",
    "payment_mode": "text",
    "payment_reference": "text",
    "status": "text",
    "notes": "text",
    "has_manual_rates": "boolean",
    "last_edited_at": "timestamptz",
    "last_edited_by": "text",
    "edit_count": "integer",
    "created_at": "timestamptz",
    "updated_at": "timestamptz"
  },
  "invoice_items": {
    "id": "text",
    "invoice_id": "text",
    "product_id": "text",
    "product_name": "text",
    "hsn": "text",
    "packing": "text",
    "quantity": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "base_qty": "integer",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_trading_unit": "integer",
    "rate": "numeric",
    "carton_rate": "numeric",
    "loose_rate": "numeric",
    "discount": "numeric",
    "carton_discount": "numeric",
    "loose_discount": "numeric",
    "taxable_value": "numeric",
    "gst_percent": "numeric",
    "gst_amount": "numeric",
    "cgst": "numeric",
    "sgst": "numeric",
    "igst": "numeric",
    "total_amount": "numeric",
    "batch_number": "text",
    "batch_id": "text",
    "mrp": "numeric",
    "purchase_rate": "numeric",
    "catalogue_rate": "numeric",
    "order_time_rate": "numeric",
    "manual_billing_rate": "numeric",
    "manual_rate_applied": "boolean",
    "manual_rate_reason": "text",
    "variant_name": "text",
    "description": "text"
  },
  "delivery_challans": {
    "id": "text",
    "business_id": "text",
    "challan_number": "text",
    "order_id": "text",
    "order_number": "text",
    "retailer_id": "text",
    "invoice_id": "text",
    "invoice_number": "text",
    "dispatch_date": "timestamptz",
    "transport_mode": "text",
    "vehicle_number": "text",
    "delivery_person": "text",
    "notes": "text",
    "total_quantity": "integer",
    "total_items": "integer",
    "created_at": "timestamptz"
  },
  "delivery_challan_items": {
    "id": "text",
    "challan_id": "text",
    "order_item_id": "text",
    "product_id": "text",
    "product_name": "text",
    "brand": "text",
    "variant_name": "text",
    "pack_size": "text",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_trading_unit": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "base_qty": "integer",
    "dispatched_qty": "integer",
    "batch_number": "text",
    "batch_id": "text",
    "mrp": "numeric",
    "purchase_rate": "numeric",
    "expiry_date": "text"
  },
  "payments": {
    "id": "text",
    "business_id": "text",
    "retailer_id": "text",
    "payment_number": "text",
    "amount": "numeric",
    "method": "text",
    "reference_number": "text",
    "notes": "text",
    "date": "timestamptz"
  },
  "payment_allocations": {
    "id": "text",
    "business_id": "text",
    "payment_id": "text",
    "invoice_id": "text",
    "amount_allocated": "numeric"
  },
  "customer_ledger": {
    "id": "text",
    "business_id": "text",
    "retailer_id": "text",
    "entry_type": "text",
    "category": "text",
    "reference_number": "text",
    "reference_id": "text",
    "date": "timestamptz",
    "amount": "numeric",
    "running_balance": "numeric",
    "balance_after": "numeric",
    "notes": "text",
    "created_by": "text",
    "created_at": "timestamptz"
  },
  "cash_flow_transactions": {
    "id": "text",
    "business_id": "text",
    "company_id": "text",
    "transaction_number": "text",
    "date": "timestamptz",
    "time": "text",
    "type": "text",
    "amount": "numeric",
    "payment_mode": "text",
    "category": "text",
    "party_type": "text",
    "party_id": "text",
    "party_name": "text",
    "reference_type": "text",
    "reference_id": "text",
    "reference_number": "text",
    "source_type": "text",
    "source_id": "text",
    "linked_invoice_id": "text",
    "linked_invoice_number": "text",
    "linked_retailer_id": "text",
    "linked_supplier_id": "text",
    "linked_purchase_id": "text",
    "remarks": "text",
    "description": "text",
    "status": "text",
    "voided_at": "timestamptz",
    "voided_by": "text",
    "void_reason": "text",
    "edit_history": "jsonb",
    "created_by": "text",
    "created_by_id": "text",
    "created_by_name": "text",
    "created_at": "timestamptz",
    "updated_by": "text",
    "updated_at": "timestamptz"
  },
  "company_opening_balances": {
    "id": "text",
    "business_id": "text",
    "company_id": "text",
    "opening_balance": "numeric",
    "as_of_date": "text",
    "mode_balances": "jsonb",
    "updated_by": "text",
    "updated_at": "timestamptz"
  },
  "sales_returns": {
    "id": "text",
    "business_id": "text",
    "invoice_id": "text",
    "credit_note_number": "text",
    "retailer_id": "text",
    "receiving_godown_id": "text",
    "return_date": "timestamptz",
    "reason": "text",
    "status": "text",
    "taxable_amount": "numeric",
    "gst_amount": "numeric",
    "cgst": "numeric",
    "sgst": "numeric",
    "igst": "numeric",
    "round_off": "numeric",
    "total_amount": "numeric"
  },
  "sales_return_items": {
    "id": "text",
    "sales_return_id": "text",
    "product_id": "text",
    "quantity": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "base_qty": "integer",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_trading_unit": "integer",
    "rate": "numeric",
    "loose_rate": "numeric",
    "hsn": "text",
    "mrp": "numeric",
    "gst_percent": "numeric",
    "taxable_value": "numeric",
    "gst_amount": "numeric",
    "cgst": "numeric",
    "sgst": "numeric",
    "igst": "numeric",
    "total_amount": "numeric",
    "condition": "text"
  },
  "purchase_returns": {
    "id": "text",
    "business_id": "text",
    "purchase_id": "text",
    "return_date": "timestamptz",
    "reason": "text",
    "status": "text"
  },
  "purchase_return_items": {
    "id": "text",
    "purchase_return_id": "text",
    "product_id": "text",
    "quantity": "integer",
    "carton_qty": "integer",
    "loose_qty": "integer",
    "base_qty": "integer",
    "trading_unit": "text",
    "base_unit": "text",
    "units_per_trading_unit": "integer",
    "rate": "numeric"
  },
  "billing_rate_audit_logs": {
    "id": "text",
    "business_id": "text",
    "order_id": "text",
    "order_item_id": "text",
    "fulfilment_id": "text",
    "invoice_id": "text",
    "retailer_id": "text",
    "product_id": "text",
    "catalogue_rate": "numeric",
    "order_time_rate": "numeric",
    "manual_billing_rate": "numeric",
    "final_applied_rate": "numeric",
    "discount": "numeric",
    "admin_user_id": "text",
    "admin_user_name": "text",
    "reason": "text",
    "created_at": "timestamptz"
  },
  "item_activity_logs": {
    "id": "text",
    "business_id": "text",
    "product_id": "text",
    "action": "text",
    "details": "text",
    "old_value": "jsonb",
    "new_value": "jsonb",
    "reference_id": "text",
    "user_id": "text",
    "user_name": "text",
    "created_at": "timestamptz"
  },
  "invoice_audits": {
    "id": "text",
    "business_id": "text",
    "invoice_id": "text",
    "invoice_number": "text",
    "retailer_id": "text",
    "retailer_name": "text",
    "admin_id": "text",
    "admin_name": "text",
    "action": "text",
    "admin_user_id": "text",
    "admin_user_name": "text",
    "reason": "text",
    "timestamp": "timestamptz",
    "old_grand_total": "numeric",
    "new_grand_total": "numeric",
    "old_outstanding_amount": "numeric",
    "new_outstanding_amount": "numeric",
    "retailer_outstanding_delta": "numeric",
    "field_changes": "jsonb",
    "item_changes": "jsonb",
    "snapshot_before": "jsonb",
    "snapshot_after": "jsonb",
    "old_data": "jsonb",
    "new_data": "jsonb",
    "diff_fields": "jsonb",
    "created_at": "timestamptz"
  },
  "vyapar_imports": {
    "id": "text",
    "business_id": "text",
    "file_name": "text",
    "file_size": "integer",
    "imported_at": "timestamptz",
    "total_rows": "integer",
    "created_count": "integer",
    "updated_count": "integer",
    "skipped_count": "integer",
    "failed_count": "integer",
    "stock_units_imported": "integer",
    "status": "text",
    "imported_by_id": "text",
    "imported_by_name": "text",
    "created_product_ids": "jsonb",
    "updated_snapshots": "jsonb",
    "created_purchase_id": "text",
    "created_batch_ids": "jsonb",
    "created_ledger_ids": "jsonb",
    "column_mapping": "jsonb",
    "row_logs": "jsonb",
    "rollback_at": "timestamptz",
    "rollback_by_name": "text",
    "rollback_reason": "text"
  },
  "ai_purchase_imports": {
    "id": "text",
    "business_id": "text",
    "supplier_name": "text",
    "supplier_gstin": "text",
    "invoice_number": "text",
    "invoice_date": "text",
    "total_amount": "numeric",
    "status": "text",
    "image_url": "text",
    "created_at": "timestamptz"
  },
  "ai_purchase_import_items": {
    "id": "text",
    "import_id": "text",
    "extracted_name": "text",
    "matched_product_id": "text",
    "match_confidence": "text",
    "quantity": "integer",
    "trading_unit": "text",
    "purchase_rate": "numeric",
    "mrp": "numeric",
    "gst_percent": "numeric",
    "hsn": "text",
    "batch": "text",
    "expiry_date": "text"
  }
};

/**
 * Expected unique constraints across tables.
 */
export const EXPECTED_UNIQUE_CONSTRAINTS = [
  {
    "table": "business_companies",
    "columns": [
      "code"
    ]
  },
  {
    "table": "profiles",
    "columns": [
      "email"
    ]
  },
  {
    "table": "company_members",
    "columns": [
      "business_id",
      "user_id"
    ]
  },
  {
    "table": "godowns",
    "columns": [
      "business_id",
      "code"
    ]
  },
  {
    "table": "companies",
    "columns": [
      "code"
    ]
  },
  {
    "table": "categories",
    "columns": [
      "business_id",
      "name"
    ]
  },
  {
    "table": "products",
    "columns": [
      "business_id",
      "product_code"
    ]
  },
  {
    "table": "product_categories",
    "columns": [
      "product_id",
      "category_id"
    ]
  },
  {
    "table": "suppliers",
    "columns": [
      "business_id",
      "gstin"
    ]
  },
  {
    "table": "product_aliases",
    "columns": [
      "supplier_id",
      "alias_name"
    ]
  },
  {
    "table": "inventory",
    "columns": [
      "business_id",
      "product_id",
      "godown_id"
    ]
  },
  {
    "table": "stock_transfers",
    "columns": [
      "transfer_number"
    ]
  },
  {
    "table": "retailers",
    "columns": [
      "business_id",
      "retailer_code"
    ]
  },
  {
    "table": "orders",
    "columns": [
      "business_id",
      "order_number"
    ]
  },
  {
    "table": "fulfilments",
    "columns": [
      "fulfilment_number"
    ]
  },
  {
    "table": "invoices",
    "columns": [
      "business_id",
      "invoice_number"
    ]
  },
  {
    "table": "delivery_challans",
    "columns": [
      "business_id",
      "challan_number"
    ]
  },
  {
    "table": "payments",
    "columns": [
      "business_id",
      "payment_number"
    ]
  },
  {
    "table": "company_opening_balances",
    "columns": [
      "business_id"
    ]
  }
];

/**
 * Critical Foreign Key mappings that must be preserved.
 */
export const EXPECTED_FOREIGN_KEYS = [
  {
    "table": "profiles",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "company_members",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "company_members",
    "column": "company_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "company_members",
    "column": "user_id",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "godowns",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "godowns",
    "column": "company_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "categories",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "products",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "products",
    "column": "company_id",
    "foreignTable": "companies",
    "foreignColumn": "id"
  },
  {
    "table": "products",
    "column": "parent_product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "product_categories",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "product_categories",
    "column": "category_id",
    "foreignTable": "categories",
    "foreignColumn": "id"
  },
  {
    "table": "suppliers",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "product_aliases",
    "column": "supplier_id",
    "foreignTable": "suppliers",
    "foreignColumn": "id"
  },
  {
    "table": "product_aliases",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "purchases",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "purchases",
    "column": "supplier_id",
    "foreignTable": "suppliers",
    "foreignColumn": "id"
  },
  {
    "table": "purchases",
    "column": "receiving_godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "purchase_items",
    "column": "purchase_id",
    "foreignTable": "purchases",
    "foreignColumn": "id"
  },
  {
    "table": "purchase_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "inventory",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "inventory",
    "column": "godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "inventory",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "inventory_batches",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "inventory_batches",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "inventory_batches",
    "column": "godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "stock_ledger",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "stock_ledger",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "stock_ledger",
    "column": "godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "stock_ledger",
    "column": "user_id",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "stock_transfers",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "stock_transfers",
    "column": "from_godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "stock_transfers",
    "column": "to_godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "stock_transfer_items",
    "column": "transfer_id",
    "foreignTable": "stock_transfers",
    "foreignColumn": "id"
  },
  {
    "table": "stock_transfer_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "retailers",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "orders",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "orders",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "orders",
    "column": "created_by",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "order_items",
    "column": "order_id",
    "foreignTable": "orders",
    "foreignColumn": "id"
  },
  {
    "table": "order_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "order_items",
    "column": "manual_rate_updated_by",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "fulfilments",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "fulfilments",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "fulfilment_items",
    "column": "fulfilment_id",
    "foreignTable": "fulfilments",
    "foreignColumn": "id"
  },
  {
    "table": "fulfilment_items",
    "column": "order_item_id",
    "foreignTable": "order_items",
    "foreignColumn": "id"
  },
  {
    "table": "fulfilment_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "fulfilment_items",
    "column": "manual_rate_updated_by",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "invoices",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "invoices",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "invoices",
    "column": "order_ref_id",
    "foreignTable": "orders",
    "foreignColumn": "id"
  },
  {
    "table": "invoice_items",
    "column": "invoice_id",
    "foreignTable": "invoices",
    "foreignColumn": "id"
  },
  {
    "table": "invoice_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "delivery_challans",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "delivery_challans",
    "column": "order_id",
    "foreignTable": "orders",
    "foreignColumn": "id"
  },
  {
    "table": "delivery_challans",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "delivery_challans",
    "column": "invoice_id",
    "foreignTable": "invoices",
    "foreignColumn": "id"
  },
  {
    "table": "delivery_challan_items",
    "column": "challan_id",
    "foreignTable": "delivery_challans",
    "foreignColumn": "id"
  },
  {
    "table": "delivery_challan_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "payments",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "payments",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "payment_allocations",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "payment_allocations",
    "column": "payment_id",
    "foreignTable": "payments",
    "foreignColumn": "id"
  },
  {
    "table": "payment_allocations",
    "column": "invoice_id",
    "foreignTable": "invoices",
    "foreignColumn": "id"
  },
  {
    "table": "customer_ledger",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "customer_ledger",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "customer_ledger",
    "column": "created_by",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "cash_flow_transactions",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "cash_flow_transactions",
    "column": "company_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "company_opening_balances",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "company_opening_balances",
    "column": "company_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "sales_returns",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "sales_returns",
    "column": "invoice_id",
    "foreignTable": "invoices",
    "foreignColumn": "id"
  },
  {
    "table": "sales_returns",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "sales_returns",
    "column": "receiving_godown_id",
    "foreignTable": "godowns",
    "foreignColumn": "id"
  },
  {
    "table": "sales_return_items",
    "column": "sales_return_id",
    "foreignTable": "sales_returns",
    "foreignColumn": "id"
  },
  {
    "table": "sales_return_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "purchase_returns",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "purchase_returns",
    "column": "purchase_id",
    "foreignTable": "purchases",
    "foreignColumn": "id"
  },
  {
    "table": "purchase_return_items",
    "column": "purchase_return_id",
    "foreignTable": "purchase_returns",
    "foreignColumn": "id"
  },
  {
    "table": "purchase_return_items",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "order_id",
    "foreignTable": "orders",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "order_item_id",
    "foreignTable": "order_items",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "fulfilment_id",
    "foreignTable": "fulfilments",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "invoice_id",
    "foreignTable": "invoices",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "retailer_id",
    "foreignTable": "retailers",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "billing_rate_audit_logs",
    "column": "admin_user_id",
    "foreignTable": "profiles",
    "foreignColumn": "id"
  },
  {
    "table": "item_activity_logs",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "item_activity_logs",
    "column": "product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  },
  {
    "table": "invoice_audits",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "invoice_audits",
    "column": "invoice_id",
    "foreignTable": "invoices",
    "foreignColumn": "id"
  },
  {
    "table": "vyapar_imports",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "ai_purchase_imports",
    "column": "business_id",
    "foreignTable": "business_companies",
    "foreignColumn": "id"
  },
  {
    "table": "ai_purchase_import_items",
    "column": "import_id",
    "foreignTable": "ai_purchase_imports",
    "foreignColumn": "id"
  },
  {
    "table": "ai_purchase_import_items",
    "column": "matched_product_id",
    "foreignTable": "products",
    "foreignColumn": "id"
  }
];

/**
 * Critical Check Constraint validations.
 */
export const CRITICAL_CHECK_CONSTRAINTS = [
  {
    "table": "products",
    "column": "trade_mode",
    "allowedValues": [
      "PIECES",
      "CARTONS",
      "BOTH"
    ]
  },
  {
    "table": "orders",
    "column": "source",
    "allowedValues": [
      "distributor_salesperson",
      "company_salesperson",
      "retailer_direct",
      "counter_sale"
    ]
  },
  {
    "table": "orders",
    "column": "status",
    "allowedValues": [
      "Draft",
      "Submitted",
      "Under Review",
      "Confirmed",
      "Partially Confirmed",
      "Packing",
      "PACKING_IN_PROGRESS",
      "Packed",
      "PACKED_AND_SEALED",
      "Ready for Dispatch",
      "Partially Dispatched",
      "Dispatched",
      "Delivered",
      "Cancelled",
      "Partially Fulfilled",
      "Fully Fulfilled",
      "Completed"
    ]
  },
  {
    "table": "invoices",
    "column": "payment_status",
    "allowedValues": [
      "Paid",
      "Partial",
      "Unpaid"
    ]
  },
  {
    "table": "retailers",
    "column": "category_access_mode",
    "allowedValues": [
      "all",
      "custom"
    ]
  },
  {
    "table": "stock_ledger",
    "column": "direction",
    "allowedValues": [
      "IN",
      "OUT"
    ]
  },
  {
    "table": "customer_ledger",
    "column": "entry_type",
    "allowedValues": [
      "DEBIT",
      "CREDIT",
      "INVOICE",
      "PAYMENT",
      "RETURN",
      "ADJUSTMENT"
    ]
  },
  {
    "table": "cash_flow_transactions",
    "column": "type",
    "allowedValues": [
      "INFLOW",
      "OUTFLOW",
      "CASH_IN",
      "CASH_OUT"
    ]
  },
  {
    "table": "cash_flow_transactions",
    "column": "payment_mode",
    "allowedValues": [
      "Cash",
      "UPI",
      "Bank Transfer",
      "Cheque",
      "Other"
    ]
  },
  {
    "table": "cash_flow_transactions",
    "column": "status",
    "allowedValues": [
      "PENDING",
      "VERIFIED",
      "CANCELLED",
      "Active",
      "Voided"
    ]
  },
  {
    "table": "vyapar_imports",
    "column": "status",
    "allowedValues": [
      "Completed",
      "Completed with Errors",
      "Rolled Back",
      "Failed"
    ]
  },
  {
    "table": "ai_purchase_import_items",
    "column": "match_confidence",
    "allowedValues": [
      "GREEN",
      "YELLOW",
      "RED"
    ]
  },
  {
    "table": "business_companies",
    "column": "status",
    "allowedValues": [
      "active",
      "inactive",
      "archived"
    ]
  },
  {
    "table": "profiles",
    "column": "role",
    "allowedValues": [
      "admin",
      "sales_dist",
      "sales_co",
      "retailer",
      "staff"
    ]
  },
  {
    "table": "company_members",
    "column": "role",
    "allowedValues": [
      "owner",
      "admin",
      "manager",
      "staff",
      "salesperson",
      "retailer"
    ]
  },
  {
    "table": "purchases",
    "column": "status",
    "allowedValues": [
      "Draft",
      "Confirmed"
    ]
  },
  {
    "table": "sales_return_items",
    "column": "condition",
    "allowedValues": [
      "Sellable",
      "Damaged"
    ]
  }
];

/**
 * 35 tables requiring Row Level Security enabled (defense-in-depth).
 */
export const RLS_MANDATORY_TABLES: string[] = [
  "business_companies",
  "profiles",
  "company_members",
  "godowns",
  "companies",
  "categories",
  "products",
  "product_categories",
  "suppliers",
  "product_aliases",
  "purchases",
  "purchase_items",
  "inventory",
  "inventory_batches",
  "stock_ledger",
  "stock_transfers",
  "stock_transfer_items",
  "retailers",
  "orders",
  "order_items",
  "fulfilments",
  "fulfilment_items",
  "invoices",
  "invoice_items",
  "delivery_challans",
  "delivery_challan_items",
  "payments",
  "payment_allocations",
  "customer_ledger",
  "cash_flow_transactions",
  "company_opening_balances",
  "sales_returns",
  "sales_return_items",
  "purchase_returns",
  "purchase_return_items",
  "billing_rate_audit_logs",
  "item_activity_logs",
  "invoice_audits",
  "vyapar_imports",
  "ai_purchase_imports",
  "ai_purchase_import_items",
  "system_settings"
];

/**
 * 15 core client-accessible tenant tables requiring dedicated tenant isolation policies.
 * Backend-only line items and ledgers use default-deny with service-role bypass.
 */
export const CLIENT_TENANT_POLICY_TABLES: string[] = [
  "business_companies",
  "profiles",
  "company_members",
  "godowns",
  "categories",
  "products",
  "inventory",
  "inventory_batches",
  "stock_ledger",
  "retailers",
  "orders",
  "invoices",
  "payments",
  "customer_ledger",
  "vyapar_imports"
];

/**
 * Backwards-compatibility alias for test suites expecting TARGET_SCHEMA_KEY_TYPES
 */
export const TARGET_SCHEMA_KEY_TYPES: Record<string, Record<string, string>> = {
  business_companies: { id: 'text' },
  profiles: { id: 'text', business_id: 'text' },
  company_members: { id: 'text', business_id: 'text', user_id: 'text' },
  godowns: { id: 'text', business_id: 'text' },
  companies: { id: 'text' },
  categories: { id: 'text', business_id: 'text' },
  products: { id: 'text', business_id: 'text', company_id: 'text', product_code: 'text' },
  product_categories: { id: 'text', product_id: 'text', category_id: 'text' },
  suppliers: { id: 'text', business_id: 'text' },
  purchases: { id: 'text', business_id: 'text', supplier_id: 'text' },
  purchase_items: { id: 'text', purchase_id: 'text', product_id: 'text' },
  inventory: { id: 'text', business_id: 'text', product_id: 'text' },
  inventory_batches: { id: 'text', business_id: 'text', product_id: 'text' },
  stock_ledger: { id: 'text', business_id: 'text', product_id: 'text' },
  retailers: { id: 'text', business_id: 'text', retailer_code: 'text' },
  orders: { id: 'text', business_id: 'text', retailer_id: 'text', order_number: 'text' },
  order_items: { id: 'text', order_id: 'text', product_id: 'text' },
  invoices: { id: 'text', business_id: 'text', retailer_id: 'text', invoice_number: 'text' },
  invoice_items: { id: 'text', invoice_id: 'text', product_id: 'text' },
  payments: { id: 'text', business_id: 'text', retailer_id: 'text' },
  customer_ledger: { id: 'text', business_id: 'text', retailer_id: 'text' },
  vyapar_imports: { id: 'text', business_id: 'text' }
};

/**
 * Helper to determine data type category compatibility.
 */
function isTypeCompatible(existingRawType: string, expectedCategory: string): boolean {
  const norm = existingRawType.toLowerCase();
  switch (expectedCategory) {
    case 'text':
      return ['text', 'varchar', 'character varying', 'char', 'character', 'bpchar', 'name'].includes(norm);
    case 'numeric':
      return ['numeric', 'decimal', 'float8', 'float4', 'double precision', 'real', 'money'].includes(norm);
    case 'integer':
      return ['integer', 'int4', 'bigint', 'int8', 'smallint', 'int2', 'serial', 'bigserial'].includes(norm);
    case 'boolean':
      return ['boolean', 'bool'].includes(norm);
    case 'timestamptz':
      return ['timestamptz', 'timestamp with time zone', 'timestamp without time zone', 'timestamp', 'date'].includes(norm);
    case 'jsonb':
      return ['jsonb', 'json'].includes(norm);
    default:
      return norm === expectedCategory;
  }
}

/**
 * Normalizes raw introspected constraint records into structured ConstraintInfo objects.
 * Accurately groups multi-column keys and deduplicates columns in ordinal order.
 */
export function normalizeIntrospectedConstraints(rawList: any[]): ConstraintInfo[] {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [];
  }

  // Check if every item is already a clean ConstraintInfo with an array of columns and no raw column_name to group
  const isAlreadyStructured = rawList.every(
    item => Array.isArray(item.columns) && !('column_name' in item)
  );
  if (isAlreadyStructured) {
    return rawList.map(item => ({
      table_name: String(item.table_name || '').toLowerCase(),
      constraint_name: String(item.constraint_name || ''),
      constraint_type: (item.constraint_type || 'UNIQUE').toUpperCase() as any,
      columns: (item.columns || []).map((c: string) => String(c).toLowerCase()),
      foreign_table_name: item.foreign_table_name ? String(item.foreign_table_name).toLowerCase() : undefined,
      foreign_columns: Array.isArray(item.foreign_columns)
        ? item.foreign_columns.map((c: string) => String(c).toLowerCase())
        : undefined,
      check_clause: item.check_clause
    }));
  }

  const grouped = new Map<string, {
    table_name: string;
    constraint_name: string;
    constraint_type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
    columnsMap: Map<string, number>;
    foreign_table_name?: string;
    foreign_columnsMap: Map<string, number>;
    check_clause?: string;
  }>();

  for (const row of rawList) {
    const tableName = String(row.table_name || '').toLowerCase();
    const constraintName = String(row.constraint_name || `${tableName}_unnamed_idx`);
    const key = `${tableName}::${constraintName}`;

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        table_name: tableName,
        constraint_name: constraintName,
        constraint_type: (row.constraint_type || 'UNIQUE').toUpperCase() as any,
        columnsMap: new Map<string, number>(),
        foreign_table_name: row.foreign_table_name ? String(row.foreign_table_name).toLowerCase() : undefined,
        foreign_columnsMap: new Map<string, number>(),
        check_clause: row.check_clause || undefined
      };
      grouped.set(key, entry);
    }

    // Accumulate columns (preserving ordinal order if available)
    if (Array.isArray(row.columns)) {
      row.columns.forEach((col: string, idx: number) => {
        if (col && !entry!.columnsMap.has(String(col).toLowerCase())) {
          entry!.columnsMap.set(String(col).toLowerCase(), idx);
        }
      });
    } else if (row.column_name) {
      const col = String(row.column_name).toLowerCase();
      const ord = typeof row.ordinal_position === 'number' ? row.ordinal_position : entry.columnsMap.size;
      if (!entry.columnsMap.has(col)) {
        entry.columnsMap.set(col, ord);
      }
    }

    // Accumulate foreign table and foreign columns
    if (row.foreign_table_name && !entry.foreign_table_name) {
      entry.foreign_table_name = String(row.foreign_table_name).toLowerCase();
    }
    if (Array.isArray(row.foreign_columns)) {
      row.foreign_columns.forEach((col: string, idx: number) => {
        if (col && !entry!.foreign_columnsMap.has(String(col).toLowerCase())) {
          entry!.foreign_columnsMap.set(String(col).toLowerCase(), idx);
        }
      });
    } else if (row.foreign_column_name) {
      const fCol = String(row.foreign_column_name).toLowerCase();
      const ord = typeof row.ordinal_position === 'number' ? row.ordinal_position : entry.foreign_columnsMap.size;
      if (!entry.foreign_columnsMap.has(fCol)) {
        entry.foreign_columnsMap.set(fCol, ord);
      }
    }

    if (row.check_clause && !entry.check_clause) {
      entry.check_clause = row.check_clause;
    }
  }

  const result: ConstraintInfo[] = [];
  for (const entry of grouped.values()) {
    const sortedCols = Array.from(entry.columnsMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(e => e[0]);

    const sortedForeignCols = Array.from(entry.foreign_columnsMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(e => e[0]);

    result.push({
      table_name: entry.table_name,
      constraint_name: entry.constraint_name,
      constraint_type: entry.constraint_type,
      columns: sortedCols,
      foreign_table_name: entry.foreign_table_name,
      foreign_columns: sortedForeignCols.length > 0 ? sortedForeignCols : undefined,
      check_clause: entry.check_clause
    });
  }

  return result;
}

/**
 * Validates database schema columns, constraints, and RLS policies against clean_rebuild_schema.sql.
 * Pure offline function.
 */
export function validateSchemaCompatibility(
  columns: ColumnInfo[],
  constraints: ConstraintInfo[] = [],
  options: PreflightOptions = {}
): PreflightCheckResult {
  const tableNames = new Set(columns.map(c => c.table_name.toLowerCase()));
  const mismatches: PreflightMismatch[] = [];
  const missingTables: string[] = [];

  // 1. If 0 tables, the database is completely empty and safe for initial rebuild
  if (tableNames.size === 0) {
    return {
      isCompatible: true,
      tableCount: 0,
      isEmptyDatabase: true,
      missingTables: [],
      mismatches: [],
      summary: 'Database is completely empty (0 tables). 100% safe for clean rebuild schema execution.'
    };
  }

  // 2. Scan every column in database for fatal legacy UUID data types
  for (const c of columns) {
    const rawType = (c.udt_name || c.data_type || '').toLowerCase();
    if (rawType === 'uuid') {
      mismatches.push({
        table: c.table_name,
        column: c.column_name,
        reason: `Legacy UUID data type detected on ${c.table_name}.${c.column_name}. Clean rebuild schema requires TEXT identifiers.`,
        existingType: 'uuid',
        expectedType: 'text',
        category: 'UUID_DETECTED'
      });
    }
  }

  // 3. Table existence check (when requireAllTables is enabled or full validation requested)
  if (options.requireAllTables) {
    for (const reqTable of ALL_42_SCHEMA_TABLES) {
      if (!tableNames.has(reqTable)) {
        missingTables.push(reqTable);
        mismatches.push({
          table: reqTable,
          reason: `Mandatory schema table "${reqTable}" is missing from existing database.`,
          existingType: 'MISSING_TABLE',
          expectedType: 'TABLE_EXISTS',
          category: 'MISSING_TABLE'
        });
      }
    }
  }

  // 4. Map columns by table.column
  const columnMap = new Map<string, ColumnInfo>();
  for (const c of columns) {
    columnMap.set(`${c.table_name.toLowerCase()}.${c.column_name.toLowerCase()}`, c);
  }

  // 5. Validate columns and data types for all tables present
  for (const [table, expectedCols] of Object.entries(EXPECTED_42_TABLE_COLUMNS)) {
    if (!tableNames.has(table)) {
      continue; // Handled by missingTables check above if requireAllTables is active
    }

    for (const [colName, expectedCategory] of Object.entries(expectedCols)) {
      const existing = columnMap.get(`${table}.${colName}`);
      if (!existing) {
        mismatches.push({
          table,
          column: colName,
          reason: `Mandatory schema column "${colName}" is missing from existing table "${table}".`,
          existingType: 'MISSING',
          expectedType: expectedCategory,
          category: 'MISSING_COLUMN'
        });
        continue;
      }

      const existingRaw = (existing.udt_name || existing.data_type || '').toLowerCase();
      if (!isTypeCompatible(existingRaw, expectedCategory)) {
        mismatches.push({
          table,
          column: colName,
          reason: `Incompatible column type for ${table}.${colName}: found "${existingRaw}", expected "${expectedCategory}".`,
          existingType: existingRaw,
          expectedType: expectedCategory,
          category: 'INCOMPATIBLE_TYPE'
        });
      }
    }
  }

  // 6. Constraint Validations (when constraints are supplied or validateConstraints enabled)
  const normalizedConstraints = normalizeIntrospectedConstraints(constraints);
  if (normalizedConstraints.length > 0 || options.validateConstraints) {
    const constraintMap = new Map<string, ConstraintInfo[]>();
    for (const cn of normalizedConstraints) {
      const t = cn.table_name.toLowerCase();
      const list = constraintMap.get(t) || [];
      list.push(cn);
      constraintMap.set(t, list);
    }

    // A. Validate Unique Constraints on present tables
    for (const u of EXPECTED_UNIQUE_CONSTRAINTS) {
      if (!tableNames.has(u.table)) continue;
      const tConstraints = constraintMap.get(u.table) || [];
      const targetCols = [...u.columns].map(x => x.toLowerCase()).sort().join(',');
      const hasUnique = tConstraints.some(c => {
        if (c.constraint_type !== 'UNIQUE' && c.constraint_type !== 'PRIMARY KEY') return false;
        if (!c.columns || c.columns.length === 0) return false;
        const normCols = [...c.columns].map(x => x.toLowerCase()).sort().join(',');
        return normCols === targetCols;
      });

      if (!hasUnique && (tConstraints.length > 0 || options.validateConstraints)) {
        mismatches.push({
          table: u.table,
          constraint: `UNIQUE(${u.columns.join(', ')})`,
          reason: `Required unique constraint on (${u.columns.join(', ')}) is missing from table "${u.table}".`,
          existingType: 'MISSING_CONSTRAINT',
          expectedType: 'UNIQUE',
          category: 'MISSING_CONSTRAINT'
        });
      }
    }

    // B. Validate Foreign Keys on present tables
    for (const fk of EXPECTED_FOREIGN_KEYS) {
      if (!tableNames.has(fk.table) || !tableNames.has(fk.foreignTable)) continue;
      const tConstraints = constraintMap.get(fk.table) || [];
      const fkList = tConstraints.filter(c => c.constraint_type === 'FOREIGN KEY');
      const matchingFk = fkList.find(c => c.columns?.includes(fk.column.toLowerCase()));

      if (matchingFk) {
        if (matchingFk.foreign_table_name && matchingFk.foreign_table_name.toLowerCase() !== fk.foreignTable.toLowerCase()) {
          mismatches.push({
            table: fk.table,
            column: fk.column,
            constraint: matchingFk.constraint_name,
            reason: `Conflicting foreign key on ${fk.table}.${fk.column}: references "${matchingFk.foreign_table_name}", expected "${fk.foreignTable}".`,
            existingType: matchingFk.foreign_table_name,
            expectedType: fk.foreignTable,
            category: 'CONFLICTING_CONSTRAINT'
          });
        }
      } else if (options.validateConstraints) {
        mismatches.push({
          table: fk.table,
          column: fk.column,
          reason: `Required foreign key on ${fk.table}.${fk.column} referencing "${fk.foreignTable}" is missing.`,
          existingType: 'MISSING_CONSTRAINT',
          expectedType: fk.foreignTable,
          category: 'MISSING_CONSTRAINT'
        });
      }
    }

    // C. Validate Check Constraints on present tables
    for (const chk of CRITICAL_CHECK_CONSTRAINTS) {
      if (!tableNames.has(chk.table)) continue;
      const tConstraints = constraintMap.get(chk.table) || [];
      const checkList = tConstraints.filter(c => c.constraint_type === 'CHECK');
      const matchingCheck = checkList.find(c =>
        c.columns?.includes(chk.column.toLowerCase()) ||
        (c.check_clause && c.check_clause.toLowerCase().includes(chk.column.toLowerCase()))
      );

      if (matchingCheck && matchingCheck.check_clause) {
        const clause = matchingCheck.check_clause.toUpperCase();
        for (const val of chk.allowedValues) {
          if (clause.includes('IN (') && !clause.includes(`'${val.toUpperCase()}'`) && !clause.includes(val.toUpperCase())) {
            mismatches.push({
              table: chk.table,
              column: chk.column,
              constraint: matchingCheck.constraint_name,
              reason: `Conflicting check constraint on ${chk.table}.${chk.column}: expression does not permit required value "${val}".`,
              existingType: matchingCheck.check_clause,
              expectedType: chk.allowedValues.join(', '),
              category: 'CONFLICTING_CONSTRAINT'
            });
            break;
          }
        }
      } else if (options.validateConstraints) {
        mismatches.push({
          table: chk.table,
          column: chk.column,
          reason: `Required check constraint on ${chk.table}.${chk.column} permitting (${chk.allowedValues.join(', ')}) is missing.`,
          existingType: 'MISSING_CONSTRAINT',
          expectedType: `CHECK (${chk.column} IN (${chk.allowedValues.map(v => `'${v}'`).join(', ')}))`,
          category: 'MISSING_CONSTRAINT'
        });
      }
    }
  }

  // 7. RLS & Policy Inspection (Read-Only Safety Verification)
  const rlsList = options.rlsStatuses || [];
  if (rlsList.length > 0 || options.validateRls) {
    const rlsMap = new Map<string, TableRlsStatus>();
    for (const r of rlsList) {
      rlsMap.set(r.table_name.toLowerCase(), r);
    }
    for (const table of RLS_MANDATORY_TABLES) {
      if (!tableNames.has(table)) continue;
      const rls = rlsMap.get(table);
      if (rls && rls.rls_enabled === false) {
        mismatches.push({
          table,
          reason: `Row Level Security is DISABLED on sensitive business table "${table}". Schema requires RLS enabled.`,
          existingType: 'RLS_DISABLED',
          expectedType: 'RLS_ENABLED',
          category: 'RLS_DISABLED'
        });
      }
    }
  }

  const policyList = options.policies || [];
  if (policyList.length > 0 || options.validateRls) {
    const policyTableMap = new Map<string, PolicyInfo[]>();
    for (const p of policyList) {
      const t = p.table_name.toLowerCase();
      const list = policyTableMap.get(t) || [];
      list.push(p);
      policyTableMap.set(t, list);
    }

    // Flag unexpectedly permissive policies on tenant tables
    for (const p of policyList) {
      const t = p.table_name.toLowerCase();
      if (!tableNames.has(t)) continue;
      const qual = (p.qual || '').toLowerCase().trim();
      const withCheck = (p.with_check || '').toLowerCase().trim();

      const isPermissiveQual = qual === 'true' || qual === '(true)' || qual.includes("or get_current_business_id() = ''") || qual.includes('or true');
      const isPermissiveCheck = withCheck === 'true' || withCheck === '(true)' || withCheck.includes("or get_current_business_id() = ''") || withCheck.includes('or true');

      if (isPermissiveQual || isPermissiveCheck) {
        mismatches.push({
          table: t,
          policy: p.policy_name,
          reason: `Unexpectedly permissive RLS policy "${p.policy_name}" detected on table "${t}": expression allows unrestricted tenant bypass (${qual || withCheck}).`,
          existingType: qual || withCheck,
          expectedType: 'STRICT_TENANT_ISOLATION',
          category: 'PERMISSIVE_POLICY'
        });
      }
    }

    // Flag missing client tenant policies on client-facing tables
    if (options.validateRls) {
      for (const clientTable of CLIENT_TENANT_POLICY_TABLES) {
        if (!tableNames.has(clientTable)) continue;
        const pList = policyTableMap.get(clientTable) || [];
        const hasTenantPolicy = pList.some(p => {
          const expr = `${p.qual || ''} ${p.with_check || ''}`.toLowerCase();
          return expr.includes('get_current_business_id()');
        });

        if (!hasTenantPolicy) {
          mismatches.push({
            table: clientTable,
            reason: `Table "${clientTable}" is missing required tenant isolation policy referencing get_current_business_id().`,
            existingType: 'MISSING_POLICY',
            expectedType: 'TENANT_ISOLATION_POLICY',
            category: 'MISSING_POLICY'
          });
        }
      }

      // Flag permissive or public exposure policies on system_settings
      const sysSettingsPolicies = policyTableMap.get('system_settings') || [];
      for (const p of sysSettingsPolicies) {
        const roles = (p.roles || []).map(r => r.toLowerCase());
        const qual = (p.qual || '').toLowerCase().trim();
        const withCheck = (p.with_check || '').toLowerCase().trim();
        const isPublicOrAnon = roles.includes('public') || roles.includes('anon') || roles.length === 0;

        // If policy grants access to public/anon without restrictive condition
        if (isPublicOrAnon && (qual === '' || qual === 'true' || qual === '(true)' || qual.includes('1 = 1') || !qual.includes('is_admin_user'))) {
          mismatches.push({
            table: 'system_settings',
            policy: p.policy_name,
            reason: `Insecure public/anon policy "${p.policy_name}" detected on "system_settings". Cloud database snapshots must not be exposed publicly.`,
            existingType: 'PUBLIC_EXPOSURE',
            expectedType: 'SECURE_ADMIN_POLICY',
            category: 'PERMISSIVE_POLICY'
          });
        }
      }
    }
  }

  const isCompatible = mismatches.length === 0 && missingTables.length === 0;
  return {
    isCompatible,
    tableCount: tableNames.size,
    isEmptyDatabase: false,
    missingTables,
    mismatches,
    summary: isCompatible
      ? `Database contains ${tableNames.size} fully compatible tables. Safe to proceed.`
      : `Preflight check FAILED: ${mismatches.length} mismatch(es) detected (${missingTables.length} missing tables). Aborting setup.`
  };
}

/**
 * SQL Queries for live read-only inspection (when authorized in staging)
 */
export const PREFLIGHT_TABLES_SQL = `
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`;

export const PREFLIGHT_INSPECTION_SQL = `
  SELECT 
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position;
`;

export const PREFLIGHT_CONSTRAINTS_SQL = `
  SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    kcu.ordinal_position,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    cc.check_clause
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
  WHERE tc.table_schema = 'public'
  ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
`;

export const PREFLIGHT_RLS_STATUS_SQL = `
  SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname;
`;

export const PREFLIGHT_RLS_POLICIES_SQL = `
  SELECT 
    schemaname,
    tablename AS table_name,
    policyname AS policy_name,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
`;

export const PREFLIGHT_TABLE_GRANTS_SQL = `
  SELECT 
    table_name,
    grantee,
    privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
  ORDER BY table_name, grantee, privilege_type;
`;

/**
 * Live schema inspection runner.
 * READ-ONLY: Never executes DDL, never drops or resets tables.
 * Throws SchemaPreflightMismatchError on mismatch.
 */
export async function inspectDatabaseSchemaPreflight(
  pool: any,
  options: PreflightOptions = {}
): Promise<PreflightCheckResult> {
  const colRes = await pool.query(PREFLIGHT_INSPECTION_SQL);
  const rawColumns: ColumnInfo[] = colRes.rows || [];

  let rawConstraints: ConstraintInfo[] = [];
  try {
    const conRes = await pool.query(PREFLIGHT_CONSTRAINTS_SQL);
    rawConstraints = normalizeIntrospectedConstraints(conRes.rows || []);
  } catch (err: any) {
    console.warn('[PREFLIGHT_WARN] Could not inspect constraints:', err?.message);
  }

  let rlsStatuses: TableRlsStatus[] = [];
  try {
    const rlsRes = await pool.query(PREFLIGHT_RLS_STATUS_SQL);
    rlsStatuses = rlsRes.rows || [];
  } catch (err: any) {
    console.warn('[PREFLIGHT_WARN] Could not inspect RLS statuses:', err?.message);
  }

  let policies: PolicyInfo[] = [];
  try {
    const polRes = await pool.query(PREFLIGHT_RLS_POLICIES_SQL);
    policies = polRes.rows || [];
  } catch (err: any) {
    console.warn('[PREFLIGHT_WARN] Could not inspect RLS policies:', err?.message);
  }

  let grants: TableGrantInfo[] = [];
  try {
    const grantRes = await pool.query(PREFLIGHT_TABLE_GRANTS_SQL);
    grants = grantRes.rows || [];
  } catch (err: any) {
    console.warn('[PREFLIGHT_WARN] Could not inspect table grants:', err?.message);
  }

  const mergedOptions: PreflightOptions = {
    ...options,
    rlsStatuses: options.rlsStatuses || rlsStatuses,
    policies: options.policies || policies,
    grants: options.grants || grants
  };

  const result = validateSchemaCompatibility(rawColumns, rawConstraints, mergedOptions);
  if (!result.isCompatible) {
    throw new SchemaPreflightMismatchError(result.summary, result.mismatches, result.missingTables);
  }

  return result;
}
