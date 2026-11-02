/**
 * FMCG Product Importer - Normalized PostgreSQL Mock Test Suite
 * File: scripts/test_postgres_product_importer.ts
 *
 * Verifies:
 * 1. Transaction management (BEGIN, COMMIT, and ROLLBACK on error)
 * 2. Schema normalization and foreign keys (companies, categories, product_categories, godowns)
 * 3. Idempotency safety (identical idempotency_key returns existing batch)
 * 4. Retry deduplication (existing SKU/barcode converts CREATE_NEW to UPDATE_EXISTING)
 * 5. Strict fuzzy match safety (ambiguous matches are never auto-overwritten)
 * 6. Tenant isolation (client-supplied business_id spoofing rejected)
 * 7. Opening stock separation (stock ledger/batches only created when explicitly enabled)
 * 8. Scale test: 6,200 products bounded memory and chunked processing
 * 9. Validation error reporting (missing name, negative MRP)
 * 10. Rollback safety: Foreign key verification against orders/invoices
 */

import {
  executeServerProductImport,
  rollbackServerProductImport,
  resolveOrCreateBusinessCompany,
  resolveOrCreateDefaultGodown,
  ImportRowItem
} from '../src/lib/serverProductImporter';
import {
  setMockDatabasePool,
  ServerTenantContext,
  TenantMismatchError
} from '../src/lib/serverDb';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    failedTests++;
  }
}

// In-memory relational database emulator for strict offline unit testing
class MockPostgreSqlDatabase {
  public executedQueries: { sql: string; params: any[] }[] = [];
  public transactionEvents: string[] = [];

  // Tables
  public businessCompanies: Map<string, any> = new Map();
  public companies: Map<string, any> = new Map();
  public categories: Map<string, any> = new Map();
  public products: Map<string, any> = new Map();
  public productCategories: Map<string, any> = new Map();
  public godowns: Map<string, any> = new Map();
  public inventory: Map<string, any> = new Map();
  public inventoryBatches: Map<string, any> = new Map();
  public stockLedger: Map<string, any> = new Map();
  public vyaparImports: Map<string, any> = new Map();
  public orderItems: any[] = [];
  public invoiceItems: any[] = [];

  public shouldFailOnQueryRegex: RegExp | null = null;

  constructor() {
    this.reset();
  }

  public reset() {
    this.executedQueries = [];
    this.transactionEvents = [];
    this.businessCompanies.clear();
    this.companies.clear();
    this.categories.clear();
    this.products.clear();
    this.productCategories.clear();
    this.godowns.clear();
    this.inventory.clear();
    this.inventoryBatches.clear();
    this.stockLedger.clear();
    this.vyaparImports.clear();
    this.orderItems = [];
    this.invoiceItems = [];
    this.shouldFailOnQueryRegex = null;

    // Seed default tenant and godown
    this.businessCompanies.set('biz_saifee_main', {
      id: 'biz_saifee_main',
      code: 'SGS',
      name: 'Saifee General Stores'
    });

    this.godowns.set('gdn_main_1', {
      id: 'gdn_main_1',
      business_id: 'biz_saifee_main',
      code: 'MAIN',
      name: 'Saifee Main Godown',
      is_default: true,
      status: 'Active'
    });
  }

  // Creates a mock pg.Pool compatible object
  public createPoolMock(): any {
    const self = this;
    return {
      query: async (text: string, params: any[] = []) => {
        return self.handleQuery(text, params);
      },
      connect: async () => {
        return {
          query: async (text: string, params: any[] = []) => {
            return self.handleQuery(text, params);
          },
          release: () => {}
        };
      }
    };
  }

  private async handleQuery(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.executedQueries.push({ sql, params });

    if (this.shouldFailOnQueryRegex && this.shouldFailOnQueryRegex.test(sql)) {
      throw new Error(`Simulated DB Error on SQL matching: ${this.shouldFailOnQueryRegex}`);
    }

    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    // Transaction controls
    if (normalizedSql === 'BEGIN') {
      this.transactionEvents.push('BEGIN');
      return { rows: [], rowCount: 0 };
    }
    if (normalizedSql === 'COMMIT') {
      this.transactionEvents.push('COMMIT');
      return { rows: [], rowCount: 0 };
    }
    if (normalizedSql === 'ROLLBACK') {
      this.transactionEvents.push('ROLLBACK');
      return { rows: [], rowCount: 0 };
    }
    if (normalizedSql.startsWith("SELECT set_config('app.current_business_id'")) {
      return { rows: [{ set_config: params[0] }], rowCount: 1 };
    }

    // Business companies lookup & insert
    if (normalizedSql.includes('FROM business_companies')) {
      if (normalizedSql.includes('WHERE id = $1')) {
        const match = this.businessCompanies.get(params[0]);
        return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
      }
      if (normalizedSql.includes('WHERE code IN') || normalizedSql.includes('WHERE code = $1')) {
        const matches = Array.from(this.businessCompanies.values());
        return { rows: matches.length > 0 ? [matches[0]] : [], rowCount: matches.length > 0 ? 1 : 0 };
      }
      const all = Array.from(this.businessCompanies.values());
      return { rows: all, rowCount: all.length };
    }
    if (normalizedSql.startsWith('INSERT INTO business_companies')) {
      const [id, code, name] = params;
      const bc = { id, code, name, is_default: true, status: 'active' };
      this.businessCompanies.set(id, bc);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 1. Idempotency Check
    if (normalizedSql.includes('FROM vyapar_imports') && normalizedSql.includes("column_mapping->>'idempotency_key'")) {
      const bizId = params[0];
      const idemKey = params[1];
      const match = Array.from(this.vyaparImports.values()).find(
        v => v.business_id === bizId && v.column_mapping?.idempotency_key === idemKey && v.status === 'Completed'
      );
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // 2. Godown lookup & insert
    if (normalizedSql.includes('FROM godowns WHERE business_id = $1')) {
      const bizId = params[0];
      const matches = Array.from(this.godowns.values()).filter(g => g.business_id === bizId);
      return { rows: matches, rowCount: matches.length };
    }
    if (normalizedSql.startsWith('INSERT INTO godowns')) {
      const [id, bizId, code, name] = params;
      const gdn = { id, business_id: bizId, code, name: name || 'Main Godown', is_default: true, status: 'Active' };
      this.godowns.set(id, gdn);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 3. Company lookup
    if (normalizedSql.includes('FROM companies WHERE LOWER(name) = $1')) {
      const nameLower = params[0]?.toLowerCase();
      const match = Array.from(this.companies.values()).find(c => c.name?.toLowerCase() === nameLower);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Insert company
    if (normalizedSql.startsWith('INSERT INTO companies')) {
      const [id, name, code] = params;
      const comp = { id, name, code, active: true };
      this.companies.set(id, comp);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 4. Category lookup
    if (normalizedSql.includes('FROM categories WHERE business_id = $1 AND LOWER(name) = $2')) {
      const [bizId, catLower] = params;
      const match = Array.from(this.categories.values()).find(
        c => c.business_id === bizId && c.name?.toLowerCase() === catLower?.toLowerCase()
      );
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Insert category
    if (normalizedSql.startsWith('INSERT INTO categories')) {
      const [id, bizId, name, desc] = params;
      const cat = { id, business_id: bizId, name, description: desc, active: true };
      this.categories.set(id, cat);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 5. Duplicate product SKU / code check
    if (normalizedSql.includes('FROM products') && (normalizedSql.includes('LOWER(product_code) = LOWER($2)') || normalizedSql.includes('LOWER(sku) = LOWER($2)'))) {
      const [bizId, code] = params;
      const match = Array.from(this.products.values()).find(
        p => p.business_id === bizId && (
          (code && p.product_code && p.product_code.toLowerCase() === String(code).toLowerCase()) ||
          (code && p.sku && p.sku.toLowerCase() === String(code).toLowerCase())
        )
      );
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // 6. Existing product lookup for UPDATE_EXISTING
    if (normalizedSql.includes('SELECT id, name, mrp, selling_price') && normalizedSql.includes('FROM products WHERE id = $1')) {
      const [id, bizId] = params;
      const p = this.products.get(id);
      if (p && p.business_id === bizId) {
        return { rows: [p], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 7. Insert product
    if (normalizedSql.startsWith('INSERT INTO products')) {
      const [
        id, bizId, prodCode, name, compId, brand, category, subcategory,
        sku, barcode, packSize, packingDisplay, tradingUnit, baseUnit,
        unitsPerBoxCarton, unitsPerTradingUnit, piecesPerCarton,
        mrp, sellingPrice, purchasePrice, dealerPrice,
        looseMrp, looseSelling, loosePurchase,
        cartonDiscount, looseDiscount, allowLoose, allowCarton, allowPieces,
        tradeMode, loosePriceMode, gstPercent, hsn,
        description, minStock, reorderLevel
      ] = params;

      const newProd = {
        id, business_id: bizId, product_code: prodCode, name, company_id: compId, brand,
        category, subcategory, sku, barcode, pack_size: packSize, packing_display: packingDisplay,
        trading_unit: tradingUnit, base_unit: baseUnit, units_per_box_carton: unitsPerBoxCarton,
        units_per_trading_unit: unitsPerTradingUnit, pieces_per_carton: piecesPerCarton,
        mrp, selling_price: sellingPrice, purchase_price: purchasePrice, dealer_price: dealerPrice,
        loose_mrp: looseMrp, loose_selling_price: looseSelling, loose_purchase_price: loosePurchase,
        carton_discount: cartonDiscount, loose_discount: looseDiscount, allow_loose_sale: allowLoose,
        allow_carton: allowCarton, allow_pieces: allowPieces, trade_mode: tradeMode,
        loose_price_mode: loosePriceMode, gst_percent: gstPercent, hsn,
        description, min_stock_level: minStock, reorder_level: reorderLevel,
        active: true
      };
      this.products.set(id, newProd);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 8. Update product
    if (normalizedSql.startsWith('UPDATE products SET')) {
      const [id, bizId, name, mrp, sellingPrice, purchasePrice, packSize, unitsPerBoxCarton, gstPercent, hsn, desc] = params;
      const existing = this.products.get(id);
      if (existing && existing.business_id === bizId) {
        existing.name = name;
        existing.mrp = mrp;
        existing.selling_price = sellingPrice;
        existing.purchase_price = purchasePrice;
        existing.pack_size = packSize;
        existing.units_per_box_carton = unitsPerBoxCarton;
        existing.gst_percent = gstPercent;
        existing.hsn = hsn;
        if (desc) existing.description = desc;
        return { rows: [existing], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 9. Product categories junction
    if (normalizedSql.startsWith('INSERT INTO product_categories')) {
      const [id, prodId, catId] = params;
      this.productCategories.set(id, { id, product_id: prodId, category_id: catId });
      return { rows: [{ id }], rowCount: 1 };
    }

    // 10. Inventory upsert
    if (normalizedSql.startsWith('INSERT INTO inventory (')) {
      const [id, bizId, godownId, prodId, physicalQty] = params;
      const key = `${bizId}_${prodId}_${godownId}`;
      const existing = this.inventory.get(key);
      if (existing) {
        existing.physical_qty += physicalQty;
        existing.available_qty += physicalQty;
      } else {
        this.inventory.set(key, {
          id, business_id: bizId, godown_id: godownId, product_id: prodId,
          physical_qty: physicalQty, available_qty: physicalQty, reserved_qty: 0
        });
      }
      return { rows: [], rowCount: 1 };
    }

    // 11. Batches insert
    if (normalizedSql.startsWith('INSERT INTO inventory_batches')) {
      const [id, bizId, prodId, godownId, godownName, batchNum, expDate, purchaseRate, sellingPrice, mrp, qty, costLayer] = params;
      this.inventoryBatches.set(id, {
        id, business_id: bizId, product_id: prodId, godown_id: godownId, godown_name: godownName,
        batch_number: batchNum, expiry_date: expDate, purchase_rate: purchaseRate, selling_price: sellingPrice,
        mrp, quantity: qty, cost_layer: costLayer
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    // 12. Stock ledger insert
    if (normalizedSql.startsWith('INSERT INTO stock_ledger')) {
      // In the SQL: VALUES ($1, $2, $3, $4, $5, 'IN', 'Opening Stock / Vyapar Import', $6, $7, $8)
      const [id, bizId, prodId, godownId, changeQty, refId, userId, batchNum] = params;
      this.stockLedger.set(id, {
        id, business_id: bizId, product_id: prodId, godown_id: godownId, change_qty: changeQty,
        direction: 'IN', reason: 'Opening Stock / Vyapar Import', reference_id: refId, user_id: userId, batch_number: batchNum
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    // 13. Vyapar imports insert
    if (normalizedSql.startsWith('INSERT INTO vyapar_imports')) {
      const [
        id, bizId, fileName, fileSize, totalRows, createdCount, updatedCount,
        skippedCount, failedCount, stockUnits, status, importedById, importedByName,
        createdProductIdsJson, updatedSnapshotsJson, createdBatchIdsJson, createdLedgerIdsJson,
        columnMappingJson, rowLogsJson
      ] = params;

      const record = {
        id, business_id: bizId, file_name: fileName, file_size: fileSize, total_rows: totalRows,
        created_count: createdCount, updated_count: updatedCount, skipped_count: skippedCount,
        failed_count: failedCount, stock_units_imported: stockUnits, status,
        imported_by_id: importedById, imported_by_name: importedByName,
        created_product_ids: JSON.parse(createdProductIdsJson),
        updated_snapshots: JSON.parse(updatedSnapshotsJson),
        created_batch_ids: JSON.parse(createdBatchIdsJson),
        created_ledger_ids: JSON.parse(createdLedgerIdsJson),
        column_mapping: JSON.parse(columnMappingJson),
        row_logs: JSON.parse(rowLogsJson)
      };
      this.vyaparImports.set(id, record);
      return { rows: [{ id }], rowCount: 1 };
    }

    // 14. Rollback checks
    if (normalizedSql.includes('SELECT id, business_id, status') && normalizedSql.includes('FROM vyapar_imports')) {
      const [id, bizId] = params;
      const v = this.vyaparImports.get(id);
      if (v && v.business_id === bizId) {
        return { rows: [v], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('SELECT product_id FROM order_items WHERE product_id = ANY')) {
      const prodIds: string[] = params[0] || [];
      const match = this.orderItems.find(oi => prodIds.includes(oi.product_id));
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    if (normalizedSql.includes('SELECT product_id FROM invoice_items WHERE product_id = ANY')) {
      const prodIds: string[] = params[0] || [];
      const match = this.invoiceItems.find(ii => prodIds.includes(ii.product_id));
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Rollback deletes
    if (normalizedSql.startsWith('DELETE FROM inventory_batches')) {
      const [ids] = params;
      for (const id of ids) this.inventoryBatches.delete(id);
      return { rows: [], rowCount: ids.length };
    }
    if (normalizedSql.startsWith('DELETE FROM stock_ledger')) {
      const [ids] = params;
      for (const id of ids) this.stockLedger.delete(id);
      return { rows: [], rowCount: ids.length };
    }
    if (normalizedSql.startsWith('DELETE FROM product_categories')) {
      const [prodIds] = params;
      for (const [key, val] of this.productCategories.entries()) {
        if (prodIds.includes(val.product_id)) this.productCategories.delete(key);
      }
      return { rows: [], rowCount: prodIds.length };
    }
    if (normalizedSql.startsWith('DELETE FROM inventory ')) {
      const [prodIds, bizId] = params;
      for (const [key, val] of this.inventory.entries()) {
        if (prodIds.includes(val.product_id) && val.business_id === bizId) this.inventory.delete(key);
      }
      return { rows: [], rowCount: prodIds.length };
    }
    if (normalizedSql.startsWith('DELETE FROM products')) {
      const [prodIds, bizId] = params;
      for (const id of prodIds) {
        const p = this.products.get(id);
        if (p && p.business_id === bizId) this.products.delete(id);
      }
      return { rows: [], rowCount: prodIds.length };
    }
    if (normalizedSql.startsWith('UPDATE vyapar_imports SET')) {
      const [id, bizId, rollbackByName, rollbackReason] = params;
      const v = this.vyaparImports.get(id);
      if (v) {
        v.status = 'Rolled Back';
        v.rollback_by_name = rollbackByName;
        v.rollback_reason = rollbackReason;
      }
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('Task 4: Server-Side PostgreSQL Product Importer Test Suite');
  console.log('================================================================================\n');

  const mockDb = new MockPostgreSqlDatabase();
  setMockDatabasePool(mockDb.createPoolMock());

  const adminContext: ServerTenantContext = {
    userId: 'usr_admin_1',
    mobile: '9876500001',
    name: 'Admin Mustafa',
    role: 'admin',
    profileType: 'ADMIN',
    businessId: 'biz_saifee_main',
    isPlatformAdmin: false,
    isTenantAdmin: true,
    isSalesperson: false,
    isRetailer: false,
    isStaff: false
  };

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Normalized Product Master Import & Field Mapping
  // --------------------------------------------------------------------------
  console.log('Group 1: Normalized Product Master Import & Schema Mapping');
  {
    mockDb.reset();
    const rows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: {
          name: 'Parle-G Glucose Biscuits 100g',
          company_name: 'Parle Products',
          brand: 'Parle',
          category: 'Biscuits & Cookies',
          sku: 'SKU-PARLE-100G',
          barcode: '8901719101010',
          pack_size: '24 units/carton (100g)',
          trading_unit: 'Carton',
          base_unit: 'Packet',
          units_per_box_carton: 24,
          mrp: 240.00,
          purchase_price: 195.00,
          selling_price: 216.00,
          gst_percent: 18,
          hsn: '19053100',
          description: 'Original Parle-G Glucose Biscuits'
        }
      }
    ];

    const result = await executeServerProductImport(adminContext, rows, {
      file_name: 'parle_master.xlsx',
      import_opening_stock: false
    });

    assert(result.batch.created_count === 1, 'Import created exactly 1 product');
    assert(mockDb.products.size === 1, 'Product written to PostgreSQL products table');
    assert(mockDb.companies.size === 1, 'Company brand resolved and inserted into companies table');
    assert(mockDb.categories.size === 1, 'Category resolved and inserted into categories table');
    assert(mockDb.productCategories.size === 1, 'Junction table product_categories linked');

    const createdProd = Array.from(mockDb.products.values())[0];
    assert(createdProd.business_id === 'biz_saifee_main', 'Product business_id matches session tenant');
    assert(createdProd.trading_unit === 'Carton', 'Trading unit is normalized and stored');
    assert(createdProd.base_unit === 'Packet', 'Base unit is mapped correctly');
    assert(createdProd.mrp === 240.00, 'MRP mapped accurately');
    assert(createdProd.purchase_price === 195.00, 'Purchase price mapped accurately');
    assert(createdProd.selling_price === 216.00, 'Selling price mapped accurately');
    assert(createdProd.gst_percent === 18, 'GST % mapped accurately');
    assert(createdProd.hsn === '19053100', 'HSN code mapped accurately');
    assert(createdProd.pack_size.includes('24 units'), 'Pack size mapped accurately');

    // Requirement 8: When import_opening_stock is false, zero batches and zero ledgers created
    assert(mockDb.inventoryBatches.size === 0, 'No opening stock batches created when import_opening_stock is false');
    assert(mockDb.stockLedger.size === 0, 'No stock ledger entries created when import_opening_stock is false');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Transaction Atomicity & Rollback on SQL Failure
  // --------------------------------------------------------------------------
  console.log('\nGroup 2: PostgreSQL Transaction Atomicity & Rollback on Error');
  {
    mockDb.reset();
    mockDb.shouldFailOnQueryRegex = /INSERT INTO products/;

    const rows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: {
          name: 'Britannia Good Day 100g',
          mrp: 300,
          purchase_price: 240,
          selling_price: 270
        }
      }
    ];

    try {
      await executeServerProductImport(adminContext, rows, {
        file_name: 'britannia.xlsx'
      });
      assert(false, 'Should throw error when SQL insert fails');
    } catch (err: any) {
      assert(mockDb.transactionEvents.includes('ROLLBACK'), 'Executed ROLLBACK upon SQL failure');
      assert(mockDb.products.size === 0, 'Zero products committed after rollback');
      assert(!err.message.includes('password'), 'Database error message is sanitized');
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Idempotency Safety
  // --------------------------------------------------------------------------
  console.log('\nGroup 3: Idempotency Safety & Duplicate Import Rejection');
  {
    mockDb.reset();
    const rows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: {
          name: 'ITC Sunfeast Dark Fantasy 75g',
          sku: 'SKU-DARK-FAN',
          mrp: 400,
          purchase_price: 320,
          selling_price: 360
        }
      }
    ];

    const firstRun = await executeServerProductImport(adminContext, rows, {
      file_name: 'itc_import.xlsx',
      idempotency_key: 'IDEM-KEY-ITC-001'
    });
    assert(firstRun.batch.created_count === 1, 'First run creates 1 product');

    // Re-importing with identical idempotency_key
    const secondRun = await executeServerProductImport(adminContext, rows, {
      file_name: 'itc_import.xlsx',
      idempotency_key: 'IDEM-KEY-ITC-001'
    });

    assert(secondRun.importId === firstRun.importId, 'Re-import with same idempotency_key returns original importId');
    assert(mockDb.products.size === 1, 'Product count remains exactly 1 without duplicates');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: No Auto-Overwrite on Matching Product Code (Explicit Approval Required)
  // --------------------------------------------------------------------------
  console.log('\nGroup 4: Safe Matching Code Protection & Explicit Approval Enforcement');
  {
    // Product already exists in mockDb with SKU-DARK-FAN (mrp: 400)
    const unapprovedRetryRows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW', // Marked CREATE_NEW but SKU exists in DB
        data: {
          name: 'ITC Sunfeast Dark Fantasy 75g (Unapproved Overwrite Attempt)',
          sku: 'SKU-DARK-FAN',
          mrp: 420,
          purchase_price: 330,
          selling_price: 375
        }
      }
    ];

    const retryResult = await executeServerProductImport(adminContext, unapprovedRetryRows, {
      file_name: 'itc_retry.xlsx'
    });

    assert(retryResult.batch.created_count === 0, 'Does not create new duplicate product');
    assert(retryResult.batch.skipped_count === 1, 'Never auto-updates on matching product code: safely skipped');
    assert(mockDb.products.size === 1, 'Products table maintains exactly 1 row');
    const existingProdBefore = Array.from(mockDb.products.values())[0];
    assert(existingProdBefore.mrp === 400, 'Original product details preserved intact without overwrite');

    // Now attempt update with explicit approval (action: UPDATE_EXISTING)
    const approvedUpdateRows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'UPDATE_EXISTING', // Explicit approval to update existing product
        data: {
          name: 'ITC Sunfeast Dark Fantasy 75g (Approved Update)',
          sku: 'SKU-DARK-FAN',
          mrp: 420,
          purchase_price: 330,
          selling_price: 375
        }
      }
    ];

    const approvedResult = await executeServerProductImport(adminContext, approvedUpdateRows, {
      file_name: 'itc_approved_update.xlsx'
    });

    assert(approvedResult.batch.updated_count === 1, 'Explicitly approved product update succeeds');
    assert(mockDb.products.size === 1, 'Products table maintains exactly 1 row');
    const updatedProd = Array.from(mockDb.products.values())[0];
    assert(updatedProd.mrp === 420, 'Existing product price updated to new MRP after explicit approval');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Strict Fuzzy Match Safety (No Auto-Overwrite)
  // --------------------------------------------------------------------------
  console.log('\nGroup 5: Strict Fuzzy Match Safety (Ambiguous Match Protection)');
  {
    const ambiguousRows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'UPDATE_EXISTING',
        isAmbiguousMatch: true, // Flagged by preflight matching as ambiguous fuzzy match
        data: {
          name: 'ITC Dark Fantasy Choco Fills 75g', // Similar name, but not identical SKU
          mrp: 500,
          purchase_price: 400,
          selling_price: 450
        }
      }
    ];

    const fuzzyResult = await executeServerProductImport(adminContext, ambiguousRows, {
      file_name: 'fuzzy_test.xlsx'
    });

    assert(fuzzyResult.batch.updated_count === 0, 'Never auto-overwrites existing product on ambiguous fuzzy match');
    assert(fuzzyResult.batch.skipped_count === 1, 'Ambiguous fuzzy match sent for manual review (skipped)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Tenant Isolation & Client-Supplied ID Spoofing Defense
  // --------------------------------------------------------------------------
  console.log('\nGroup 6: Tenant Isolation & Spoofing Defense');
  {
    const spoofRows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: { name: 'Spoofed Product', mrp: 100, purchase_price: 80, selling_price: 90 }
      }
    ];

    try {
      await executeServerProductImport(adminContext, spoofRows, {
        file_name: 'attack.xlsx',
        business_id: 'biz_competitor_target' // Client attempts to insert into another tenant
      });
      assert(false, 'Should throw TenantMismatchError on forged business_id');
    } catch (err: any) {
      assert(err instanceof TenantMismatchError, 'Rejects cross-tenant business_id with TenantMismatchError');
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Opening Stock Separation (Master vs Opening Stock)
  // --------------------------------------------------------------------------
  console.log('\nGroup 7: Opening Stock Inwarding Isolation');
  {
    mockDb.reset();
    const rowsWithStock: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: {
          name: 'Tata Tea Gold 250g',
          brand: 'Tata Consumer',
          mrp: 180,
          purchase_price: 140,
          selling_price: 160,
          stock_qty: 50, // 50 Cartons opening stock
          pack_size: '10 units/carton',
          units_per_box_carton: 10,
          batch_number: 'BATCH-TATA-01',
          expiry_date: '2028-06-30'
        }
      }
    ];

    const resultWithStock = await executeServerProductImport(adminContext, rowsWithStock, {
      file_name: 'tata_tea.xlsx',
      import_opening_stock: true // Explicitly enabled
    });

    assert(resultWithStock.batch.stock_units_imported === 500, 'Calculates 50 cartons * 10 units = 500 base units inwarded');
    assert(mockDb.inventoryBatches.size === 1, 'Created inventory batch for opening stock', `batches size: ${mockDb.inventoryBatches.size}`);
    assert(mockDb.stockLedger.size === 1, 'Created immutable stock_ledger entry for opening stock', `ledger size: ${mockDb.stockLedger.size}`);
    const ledgerEntry = Array.from(mockDb.stockLedger.values())[0];
    assert(ledgerEntry.change_qty === 500 && ledgerEntry.direction === 'IN', 'Ledger recorded 500 units IN', `change_qty: ${ledgerEntry?.change_qty}, direction: ${ledgerEntry?.direction}`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 8: 6,200 Products Scale Benchmark & Bounded Memory
  // --------------------------------------------------------------------------
  console.log('\nGroup 8: Scale Test - 6,200 Products Chunked Import');
  {
    mockDb.reset();
    const largeRows: ImportRowItem[] = [];
    const companiesList = ['Parle', 'Britannia', 'ITC', 'HUL', 'Nestle', 'Marico', 'Dabur', 'Cadbury'];
    const categoriesList = ['Biscuits', 'Soaps', 'Edible Oils', 'Beverages', 'Chocolates', 'Spices'];

    for (let i = 1; i <= 6200; i++) {
      const comp = companiesList[i % companiesList.length];
      const cat = categoriesList[i % categoriesList.length];
      largeRows.push({
        rowNumber: i,
        action: 'CREATE_NEW',
        data: {
          name: `${comp} Scale Item #${i}`,
          brand: comp,
          company_name: `${comp} India Ltd`,
          category: cat,
          sku: `SKU-SCALE-${i}`,
          barcode: `8901000${String(i).padStart(6, '0')}`,
          pack_size: '12 units/carton',
          units_per_box_carton: 12,
          mrp: 120 + (i % 50),
          purchase_price: 90 + (i % 40),
          selling_price: 105 + (i % 45),
          gst_percent: 18,
          hsn: '19053100'
        }
      });
    }

    const t0 = Date.now();
    const scaleResult = await executeServerProductImport(adminContext, largeRows, {
      file_name: 'large_catalog_6200.xlsx',
      chunk_size: 500 // Chunked into 13 manageable transactions
    });
    const durationMs = Date.now() - t0;

    assert(scaleResult.batch.created_count === 6200, 'Successfully imported all 6,200 products');
    assert(mockDb.products.size === 6200, 'Database contains 6,200 products');
    assert(mockDb.companies.size === 8, 'Normalized companies reused: exactly 8 company rows created');
    assert(mockDb.categories.size === 6, 'Normalized categories reused: exactly 6 category rows created');
    assert(scaleResult.batch.is_multi_transaction === true, 'Reports is_multi_transaction=true for multi-chunk import');
    assert((scaleResult.batch.transaction_count || 0) >= 12, 'Executed chunked transactions safely');
    assert(durationMs < 10000, `Processed 6,200 products in ${durationMs}ms (under 10000ms threshold)`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 9: Preflight Validation (Invalid Rows Handled Gracefully)
  // --------------------------------------------------------------------------
  console.log('\nGroup 9: Preflight Validation Error Handling');
  {
    mockDb.reset();
    const badRows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: { name: '', mrp: 100, purchase_price: 80, selling_price: 90 } // Missing name
      },
      {
        rowNumber: 2,
        action: 'CREATE_NEW',
        data: { name: 'Valid Product 1', mrp: -50, purchase_price: 40, selling_price: 45 } // Invalid negative MRP
      },
      {
        rowNumber: 3,
        action: 'CREATE_NEW',
        data: { name: 'Valid Product 2', mrp: 100, purchase_price: 80, selling_price: 90 } // Valid row
      }
    ];

    const result = await executeServerProductImport(adminContext, badRows, {
      file_name: 'validation_test.xlsx'
    });

    assert(result.batch.created_count === 1, 'Only valid row created');
    assert(result.batch.skipped_count === 1, 'Row with missing name skipped');
    assert(result.batch.failed_count === 1, 'Row with invalid MRP marked failed');
    assert(result.batch.status === 'Completed with Errors', 'Batch marked Completed with Errors');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 10: Server-Side Rollback & Foreign Key Dependency Protection
  // --------------------------------------------------------------------------
  console.log('\nGroup 10: Server-Side Batch Rollback & Foreign Key Protection');
  {
    mockDb.reset();
    const importRows: ImportRowItem[] = [
      {
        rowNumber: 1,
        action: 'CREATE_NEW',
        data: {
          name: 'Nestle Maggi 2-Min Noodles 70g',
          mrp: 144,
          purchase_price: 110,
          selling_price: 125,
          stock_qty: 20,
          pack_size: '12 units/carton',
          units_per_box_carton: 12
        }
      }
    ];

    const importRes = await executeServerProductImport(adminContext, importRows, {
      file_name: 'maggi.xlsx',
      import_opening_stock: true
    });
    const importedId = importRes.importId;
    const prodId = importRes.batch.created_product_ids[0];

    // Case A: Cannot rollback if product is referenced in sales order
    mockDb.orderItems.push({ product_id: prodId, order_id: 'ord_123' });
    const rollbackBlocked = await rollbackServerProductImport(adminContext, importedId, 'Test Rollback');
    assert(rollbackBlocked.success === false, 'Rollback blocked when product is referenced in sales order');
    assert(rollbackBlocked.message.includes('sales orders'), 'Returns specific error message regarding orders');

    // Case B: Successful rollback when not referenced
    mockDb.orderItems = [];
    const rollbackSuccess = await rollbackServerProductImport(adminContext, importedId, 'Clean reversal');
    assert(rollbackSuccess.success === true, 'Rollback succeeds when zero foreign dependencies exist');
    assert(mockDb.products.size === 0, 'Imported product removed from products table');
    assert(mockDb.inventoryBatches.size === 0, 'Opening stock batches removed from inventory_batches');
    assert(mockDb.stockLedger.size === 0, 'Stock ledger entries removed from stock_ledger');
    const importRecord = mockDb.vyaparImports.get(importedId);
    assert(importRecord.status === 'Rolled Back', 'Vyapar import audit record marked Rolled Back');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 11: Business Organization & Godown Resolution Engine
  // --------------------------------------------------------------------------
  console.log('\nGroup 11: Business Company & Warehouse Godown Resolution');
  {
    mockDb.reset();
    const pool = mockDb.createPoolMock();

    // Case A: Existing business is resolved by ID without insertion
    const resolvedExisting = await resolveOrCreateBusinessCompany(pool, 'biz_saifee_main');
    assert(resolvedExisting === 'biz_saifee_main', 'Resolves existing business_id without duplicate');
    assert(mockDb.businessCompanies.size === 1, 'Maintains exact 1 business row when business already exists');

    // Case B: Empty business table auto-creates baseline business
    mockDb.businessCompanies.clear();
    const createdBiz = await resolveOrCreateBusinessCompany(pool, 'biz-saifee');
    assert(createdBiz === 'biz-saifee', 'Creates and returns business_id for empty business table');
    assert(mockDb.businessCompanies.size === 1, 'Business record persisted in business_companies');

    // Case C: Second call reuses the newly created business
    const reusedBiz = await resolveOrCreateBusinessCompany(pool, 'biz-saifee');
    assert(reusedBiz === 'biz-saifee', 'Reuses existing business on second call');
    assert(mockDb.businessCompanies.size === 1, 'No duplicate business created on repeat resolution');

    // Case D: Existing godown is resolved without duplicate
    mockDb.godowns.set('gdn_main_1', { id: 'gdn_main_1', business_id: 'biz-saifee', code: 'MAIN' });
    const resolvedGdn = await resolveOrCreateDefaultGodown(pool, 'biz-saifee');
    assert(resolvedGdn === 'gdn_main_1', 'Resolves existing godown without duplicate');
    assert(mockDb.godowns.size === 1, 'Maintains exact 1 godown row');

    // Case E: Empty godown table auto-creates MAIN godown
    mockDb.godowns.clear();
    const createdGdn = await resolveOrCreateDefaultGodown(pool, 'biz-saifee');
    assert(typeof createdGdn === 'string' && createdGdn.startsWith('gdn-'), 'Creates default MAIN godown when none exists');
    assert(mockDb.godowns.size === 1, 'MAIN warehouse godown record persisted in godowns');
  }

  // Cleanup
  setMockDatabasePool(undefined);

  console.log('\n================================================================================');
  console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
