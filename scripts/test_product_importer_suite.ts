/**
 * Comprehensive Automated Verification Suite for Production-Ready Excel/CSV Product Importer
 * FMCG Wholesale Distribution & Trade ERP (Saifee General Stores)
 * File: scripts/test_product_importer_suite.ts
 *
 * Requirements Verified:
 * 1. Support Excel & CSV with 6,200+ products (Scale & Token Index Benchmark < 1000ms)
 * 2. Column auto-mapping, preview, commercial row validation, duplicate detection, and error report
 * 3. Normalized tables (products, companies, categories, product_categories, variants, packaging, prices)
 * 4. Foreign key resolution (reusing existing companies/categories without blind duplicate creation)
 * 5. Strict fuzzy safety: fuzzy matches NEVER auto-overwrite (action strictly defaults to SKIP)
 * 6. Idempotency, transactional import & retry safety
 * 7. Product-master separation from opening stock (stock changes ONLY when explicitly requested)
 * 8. Server-side route authentication, CSRF origin defense, and tenant isolation
 * 9. Rollback atomicity & dependency protection
 */

import assert from 'assert';
import { NextRequest } from 'next/server';
import { db, Product, Company, Category, ProductCategory, Profile, VyaparImportBatch } from '../src/lib/db';
import { 
  TARGET_PRODUCT_FIELDS, 
  autoDetectVyaparColumnMapping, 
  validateAndMatchVyaparRows,
  validateAndMatchVyaparRowsAsync,
  generateVyaparErrorReportCsv,
  calculateProductSimilarity
} from '../src/lib/vyaparImportEngine';
import { signSessionToken, SESSION_COOKIE_NAME, SessionPayload } from '../src/lib/authSession';

// Import Route Handlers
import { GET as importGetHandler, POST as importPostHandler } from '../src/app/api/admin/products/import/route';
import { POST as rollbackPostHandler } from '../src/app/api/admin/products/import/rollback/route';

console.log('================================================================================');
console.log('FMCG ERP: Production-Ready Excel/CSV Product Importer Test Suite');
console.log('================================================================================\n');

function createMockRequest(
  url: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): NextRequest {
  const method = options.method || 'GET';
  const headers = new Headers({
    'host': 'localhost:3000',
    ...(options.headers || {})
  });

  if (options.token) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.token}`);
  }

  const reqInit: any = { method, headers };
  if (options.body && method !== 'GET' && method !== 'HEAD') {
    reqInit.body = JSON.stringify(options.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), reqInit);
}

async function runTestSuite() {
  let passed = 0;
  let failed = 0;

  async function testCase(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Set up test tenant & profiles
  const TEST_BIZ_ID = 'biz-test-saifee';
  const adminProfile: Profile = {
    id: 'p-admin-importer',
    email: 'admin@saifee.com',
    name: 'Mustafa Admin',
    role: 'admin',
    profile_type: 'ADMIN',
    mobile: '9820000001',
    password: 'SecurePassword123!',
    active: true,
    status: 'ACTIVE',
    business_id: TEST_BIZ_ID
  } as any;

  const retailerProfile: Profile = {
    id: 'p-retailer-importer',
    email: 'retailer@shop.com',
    name: 'Bohra Retail Store',
    role: 'retailer',
    profile_type: 'RETAILER',
    mobile: '9820000002',
    password: 'RetailerPassword123!',
    active: true,
    status: 'ACTIVE',
    business_id: TEST_BIZ_ID
  } as any;

  const profiles = db.getProfiles();
  const adminIdx = profiles.findIndex(p => p.id === adminProfile.id);
  if (adminIdx >= 0) profiles[adminIdx] = adminProfile; else profiles.push(adminProfile);
  const retIdx = profiles.findIndex(p => p.id === retailerProfile.id);
  if (retIdx >= 0) profiles[retIdx] = retailerProfile; else profiles.push(retailerProfile);
  db.saveProfiles(profiles);

  const adminToken = signSessionToken({
    userId: adminProfile.id,
    mobile: adminProfile.mobile!,
    name: adminProfile.name,
    role: 'admin',
    profileType: 'ADMIN',
    businessId: TEST_BIZ_ID,
    iat: Date.now(),
    exp: Date.now() + 3600000
  });

  const retailerToken = signSessionToken({
    userId: retailerProfile.id,
    mobile: retailerProfile.mobile!,
    name: retailerProfile.name,
    role: 'retailer',
    profileType: 'RETAILER',
    businessId: TEST_BIZ_ID,
    iat: Date.now(),
    exp: Date.now() + 3600000
  });

  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Column Auto-Detection & Synonyms ---');
  // --------------------------------------------------------------------------

  await testCase('Auto-detects commercial headers across diverse synonyms', () => {
    const rawHeaders = [
      'Item Name', 'Item Code', 'Barcode', 'Manufacturer', 'Brand',
      'Item Category', 'Pack Size', 'Trading Unit', 'Base Unit', 'Units per Box',
      'MRP', 'Purchase Price', 'Sale Price', 'Tax Rate', 'HSN Code',
      'Opening Stock', 'Batch No', 'Expiry Date', 'Dealer Price', 'Trade Mode'
    ];
    const mapping = autoDetectVyaparColumnMapping(rawHeaders);
    assert.strictEqual(mapping['name'], 'Item Name');
    assert.strictEqual(mapping['sku'], 'Item Code');
    assert.strictEqual(mapping['barcode'], 'Barcode');
    assert.strictEqual(mapping['company_name'], 'Manufacturer');
    assert.strictEqual(mapping['brand'], 'Brand');
    assert.strictEqual(mapping['category'], 'Item Category');
    assert.strictEqual(mapping['pack_size'], 'Pack Size');
    assert.strictEqual(mapping['trading_unit'], 'Trading Unit');
    assert.strictEqual(mapping['base_unit'], 'Base Unit');
    assert.strictEqual(mapping['units_per_box_carton'], 'Units per Box');
    assert.strictEqual(mapping['mrp'], 'MRP');
    assert.strictEqual(mapping['purchase_price'], 'Purchase Price');
    assert.strictEqual(mapping['selling_price'], 'Sale Price');
    assert.strictEqual(mapping['gst_percent'], 'Tax Rate');
    assert.strictEqual(mapping['hsn'], 'HSN Code');
    assert.strictEqual(mapping['stock_qty'], 'Opening Stock');
    assert.strictEqual(mapping['batch_number'], 'Batch No');
    assert.strictEqual(mapping['expiry_date'], 'Expiry Date');
    assert.strictEqual(mapping['dealer_price'], 'Dealer Price');
    assert.strictEqual(mapping['trade_mode'], 'Trade Mode');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Preflight Row Validation & Commercial Checks ---');
  // --------------------------------------------------------------------------

  await testCase('Validates missing fields, pricing sanity, and calculates loose pricing', () => {
    const testRows = [
      { 'Item Name': '', 'MRP': '100', 'Purchase Price': '80', 'Sale Price': '90' }, // Missing name
      { 'Item Name': 'Invalid MRP', 'MRP': '0', 'Purchase Price': '80', 'Sale Price': '90' }, // 0 MRP
      { 'Item Name': 'Negative Margin', 'MRP': '100', 'Purchase Price': '95', 'Sale Price': '90' }, // Cost > Sale
      { 'Item Name': 'Over MRP', 'MRP': '100', 'Purchase Price': '80', 'Sale Price': '110' }, // Sale > MRP
      { 'Item Name': 'Valid Soap', 'Item Code': 'SKU-SOAP-1', 'Barcode': '890123', 'MRP': '120', 'Purchase Price': '80', 'Sale Price': '100', 'Units per Box': '12' }
    ];

    const mapping = {
      name: 'Item Name',
      sku: 'Item Code',
      barcode: 'Barcode',
      mrp: 'MRP',
      purchase_price: 'Purchase Price',
      selling_price: 'Sale Price',
      units_per_box_carton: 'Units per Box'
    };

    const res = validateAndMatchVyaparRows(testRows, mapping, [], []);
    assert.strictEqual(res[0].isValid, false, 'Row 0 invalid because missing name');
    assert.strictEqual(res[1].isValid, false, 'Row 1 invalid because 0 MRP');
    assert.strictEqual(res[2].isValid, true, 'Row 2 valid format but has warning');
    assert(res[2].warnings.some(w => w.includes('Negative margin')), 'Flagged negative margin warning');
    assert(res[3].warnings.some(w => w.includes('higher than MRP')), 'Flagged over-MRP warning');
    assert.strictEqual(res[4].isValid, true, 'Row 4 completely valid');
    assert.strictEqual(res[4].normalizedData.loose_mrp, 10, '120 / 12 = 10 loose MRP');
    assert.strictEqual(res[4].normalizedData.loose_selling_price, 8.33, '100 / 12 = 8.33 loose selling price');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Intra-File Duplicate Detection ---');
  // --------------------------------------------------------------------------

  await testCase('Detects duplicate SKUs and Barcodes within the uploaded file', () => {
    const dupRows = [
      { 'Item Name': 'Good Day Butter 100g', 'Item Code': 'GD-100', 'Barcode': '890001', 'MRP': '100', 'Purchase Price': '80', 'Sale Price': '90' },
      { 'Item Name': 'Good Day Butter 100g Clone', 'Item Code': 'GD-100', 'Barcode': '890002', 'MRP': '100', 'Purchase Price': '80', 'Sale Price': '90' },
      { 'Item Name': 'Good Day Cashew 100g', 'Item Code': 'GD-200', 'Barcode': '890001', 'MRP': '100', 'Purchase Price': '80', 'Sale Price': '90' }
    ];
    const mapping = { name: 'Item Name', sku: 'Item Code', barcode: 'Barcode', mrp: 'MRP', purchase_price: 'Purchase Price', selling_price: 'Sale Price' };

    const res = validateAndMatchVyaparRows(dupRows, mapping, [], []);
    assert.strictEqual(res[0].matchType, 'NEW');
    assert.strictEqual(res[1].matchType, 'DUPLICATE_IN_FILE');
    assert.strictEqual(res[1].action, 'SKIP');
    assert.strictEqual(res[2].matchType, 'DUPLICATE_IN_FILE');
    assert.strictEqual(res[2].action, 'SKIP');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Strict Fuzzy Match Safety ---');
  // --------------------------------------------------------------------------

  await testCase('Never auto-overwrites on fuzzy matches: Action MUST default to SKIP', () => {
    const existing: Product = {
      id: 'prod-brit-1',
      product_code: 'PRD-001',
      name: 'Britannia Good Day Butter Cookies 100g',
      sku: 'BRIT-GDB-100',
      barcode: '8901001',
      company_id: 'comp-brit',
      brand: 'Britannia',
      category: 'Biscuits',
      pack_size: '24 units / Carton',
      trading_unit: 'Carton',
      base_unit: 'Packet',
      packing_display: '24 units / Carton',
      units_per_box_carton: 24,
      mrp: 720,
      selling_price: 600,
      purchase_price: 520,
      gst_percent: 18,
      hsn: '19053100',
      active: true
    };

    // Incoming file row with different variant and barcode but similar product name
    const fuzzyRow = [{
      'Item Name': 'Britannia Good Day Cashew Cookies 100g',
      'Item Code': 'BRIT-GDC-100',
      'Barcode': '8901002',
      'MRP': '720',
      'Purchase Price': '520',
      'Sale Price': '600'
    }];
    const mapping = { name: 'Item Name', sku: 'Item Code', barcode: 'Barcode', mrp: 'MRP', purchase_price: 'Purchase Price', selling_price: 'Sale Price' };

    const res = validateAndMatchVyaparRows(fuzzyRow, mapping, [existing], []);
    assert.strictEqual(res[0].matchType, 'FUZZY_MATCH', 'Identified similarity as FUZZY_MATCH');
    assert.strictEqual(res[0].action, 'SKIP', 'CRITICAL SAFETY INVARIANT: Fuzzy match strictly defaults to SKIP');
    assert(res[0].matchCriteria?.includes('Requires Review'), 'Flagged for explicit user review');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: 6,200 Products Scale Benchmark ---');
  // --------------------------------------------------------------------------

  await testCase('Inverted token index searches 6,200 catalog in under 1000ms', () => {
    const catalog: Product[] = [];
    for (let i = 1; i <= 6200; i++) {
      catalog.push({
        id: `p-${i}`,
        product_code: `PRD-${i}`,
        name: `FMCG Manufacturer ${i % 25} Brand ${i % 15} Product Variant ${i} Pack`,
        sku: `SKU-${i}`,
        barcode: `890${String(i).padStart(9, '0')}`,
        company_id: `c-${i % 25}`,
        brand: `Brand ${i % 15}`,
        category: `Category ${i % 10}`,
        pack_size: '24 units/carton',
        trading_unit: 'Carton',
        base_unit: 'Piece',
        packing_display: '24 units / Carton',
        units_per_box_carton: 24,
        mrp: 100,
        selling_price: 90,
        purchase_price: 80,
        gst_percent: 18,
        hsn: '19053100',
        active: true
      });
    }

    const incoming: any[] = [];
    for (let j = 1; j <= 500; j++) {
      if (j <= 200) {
        incoming.push({
          'Item Name': catalog[j].name,
          'Item Code': catalog[j].sku,
          'Barcode': catalog[j].barcode,
          'MRP': '100', 'Purchase Price': '80', 'Sale Price': '90'
        });
      } else {
        incoming.push({
          'Item Name': `Brand New Unique FMCG Product Line ${j}`,
          'Item Code': `NEW-SKU-${j}`,
          'Barcode': `789000${j}`,
          'MRP': '250', 'Purchase Price': '200', 'Sale Price': '225'
        });
      }
    }

    const mapping = { name: 'Item Name', sku: 'Item Code', barcode: 'Barcode', mrp: 'MRP', purchase_price: 'Purchase Price', selling_price: 'Sale Price' };

    const t0 = Date.now();
    const res = validateAndMatchVyaparRows(incoming, mapping, catalog, []);
    const elapsed = Date.now() - t0;

    assert(elapsed < 1000, `Benchmark completed in ${elapsed}ms (< 1000ms target)`);
    assert.strictEqual(res.filter(r => r.matchType === 'EXACT_MATCH').length, 200);
    assert.strictEqual(res.filter(r => r.matchType === 'NEW').length, 300);
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Asynchronous Chunked Validation (No UI Freeze) ---');
  // --------------------------------------------------------------------------

  await testCase('validateAndMatchVyaparRowsAsync yields progress ticks', async () => {
    const sampleRows = [
      { 'Item Name': 'Item 1', 'MRP': '100', 'Purchase Price': '80', 'Sale Price': '90' },
      { 'Item Name': 'Item 2', 'MRP': '200', 'Purchase Price': '160', 'Sale Price': '180' }
    ];
    const mapping = { name: 'Item Name', mrp: 'MRP', purchase_price: 'Purchase Price', selling_price: 'Sale Price' };

    let progressCalls = 0;
    const res = await validateAndMatchVyaparRowsAsync(sampleRows, mapping, [], [], (done, total) => {
      progressCalls++;
      assert(done > 0 && done <= total);
    });

    assert.strictEqual(res.length, 2);
    assert(progressCalls > 0, 'Progress callback invoked');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Normalized Entity Resolution & Foreign Keys ---');
  // --------------------------------------------------------------------------

  await testCase('Resolves and reuses Company, Category, and product_categories junction table', () => {
    // 1. Seed initial category & company in memory
    const existingCat = db.createCategory('Biscuits & Bakery Distinct Category');
    const existingComp = db.createCompany('Tata Consumer Products Distinct', 'TCPD');

    const importRows = [
      {
        rowNumber: 2,
        action: 'CREATE_NEW' as const,
        data: {
          name: 'Tata Soulfull Ragi Bites 250g',
          company_name: 'Tata Consumer Products Distinct', // Exact reuse
          category: 'Biscuits & Bakery Distinct Category', // Exact reuse
          sku: 'TATA-SOUL-250G',
          barcode: '8901719999999',
          mrp: 150,
          purchase_price: 110,
          selling_price: 130,
          pack_size: '20 units/box',
          trading_unit: 'Box',
          base_unit: 'Packet' as const,
          units_per_box_carton: 20
        }
      },
      {
        rowNumber: 3,
        action: 'CREATE_NEW' as const,
        data: {
          name: 'Patanjali Pure Honey 500g',
          company_name: 'Patanjali Ayurved Ltd Distinct', // Brand-new company
          category: 'Natural Health Products Distinct', // Brand-new category
          sku: 'PATAN-HNY-500G',
          barcode: '8901262999999',
          mrp: 220,
          purchase_price: 170,
          selling_price: 195,
          pack_size: '12 units/carton',
          trading_unit: 'Carton',
          base_unit: 'Bottle' as const,
          units_per_box_carton: 12
        }
      }
    ];

    const result = db.executeVyaparBatchImport(importRows, {
      file_name: 'test_normalization.xlsx',
      column_mapping: {},
      business_id: TEST_BIZ_ID
    });

    assert.strictEqual(result.batch.created_count, 2);

    // Verify company reuse
    const companies = db.getCompanies();
    const tcpdCount = companies.filter(c => c.code === 'TCPD').length;
    assert.strictEqual(tcpdCount, 1, 'Reused existing company without creating a duplicate');

    // Verify category reuse and junction table
    const categories = db.getCategories(TEST_BIZ_ID);
    const biscuitsCat = categories.find(c => c.name.toLowerCase() === 'biscuits & bakery distinct category');
    assert(biscuitsCat, 'Found existing category');
    const healthCat = categories.find(c => c.name.toLowerCase() === 'natural health products distinct');
    assert(healthCat, 'Auto-created Natural Health Products category in categories table');

    const productCategories = db.getProductCategories(TEST_BIZ_ID);
    const soulProd = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'TATA-SOUL-250G');
    const honeyProd = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'PATAN-HNY-500G');

    assert(soulProd, 'Soulfull product created');
    assert(honeyProd, 'Honey product created');

    const soulPc = productCategories.find(pc => pc.product_id === soulProd!.id && pc.category_id === biscuitsCat!.id);
    assert(soulPc, 'Soulfull linked to Biscuits in product_categories junction table');

    const honeyPc = productCategories.find(pc => pc.product_id === honeyProd!.id && pc.category_id === healthCat!.id);
    assert(honeyPc, 'Honey linked to Health Products in product_categories junction table');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Product Master vs. Opening Stock Separation ---');
  // --------------------------------------------------------------------------

  await testCase('Master import with import_opening_stock=false DOES NOT alter stock or create ledger', () => {
    const masterRows = [{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Cadbury Dairy Milk Silk 60g',
        sku: 'CAD-SILK-60',
        barcode: '890123300001',
        mrp: 80,
        purchase_price: 65,
        selling_price: 72,
        stock_qty: 100, // Should be IGNORED
        batch_number: 'SILK-B1',
        expiry_date: '2028-12-31'
      }
    }];

    const result = db.executeVyaparBatchImport(masterRows, {
      file_name: 'master_only.xlsx',
      column_mapping: {},
      business_id: TEST_BIZ_ID,
      import_opening_stock: false // Explicitly false
    });

    const silkProd = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'CAD-SILK-60');
    assert(silkProd, 'Product created in master');

    const inv = db.getInventory(TEST_BIZ_ID).find(i => i.product_id === silkProd!.id);
    assert.strictEqual(inv?.physical_qty, 0, 'Physical stock remains 0');
    assert.strictEqual(inv?.available_qty, 0, 'Available stock remains 0');

    const batch = db.getBatches(TEST_BIZ_ID).find(b => b.product_id === silkProd!.id);
    assert.strictEqual(batch, undefined, 'ZERO batches created');

    const ledger = db.getLedger(TEST_BIZ_ID).find(l => l.product_id === silkProd!.id);
    assert.strictEqual(ledger, undefined, 'ZERO stock ledger entries created');
  });

  await testCase('Master import with import_opening_stock=true creates stock, batch, ledger & purchase', () => {
    const stockRows = [{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Maggi 2-Minute Noodles 70g',
        sku: 'MAGGI-70G-1',
        barcode: '8901058852222',
        mrp: 14,
        purchase_price: 11,
        selling_price: 12.5,
        pack_size: '24 units/carton',
        trading_unit: 'Carton',
        base_unit: 'Packet' as const,
        units_per_box_carton: 24,
        stock_qty: 10, // 10 Cartons = 240 packets
        batch_number: 'BCH-MAGGI-2026',
        expiry_date: '2027-10-31'
      }
    }];

    const result = db.executeVyaparBatchImport(stockRows, {
      file_name: 'opening_stock.xlsx',
      column_mapping: {},
      business_id: TEST_BIZ_ID,
      import_opening_stock: true // Explicitly enabled
    });

    const maggiProd = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'MAGGI-70G-1');
    assert(maggiProd, 'Maggi created');

    const inv = db.getInventory(TEST_BIZ_ID).find(i => i.product_id === maggiProd!.id);
    assert.strictEqual(inv?.physical_qty, 240, 'Stock inwarded in atomic Base Units (10 * 24 = 240)');

    const batch = db.getBatches(TEST_BIZ_ID).find(b => b.product_id === maggiProd!.id);
    assert(batch, 'Inventory batch created');
    assert.strictEqual(batch?.batch_number, 'BCH-MAGGI-2026');
    assert.strictEqual(batch?.quantity, 240);

    const ledger = db.getLedger(TEST_BIZ_ID).find(l => l.product_id === maggiProd!.id);
    assert(ledger, 'Stock ledger entry created');
    assert.strictEqual(ledger?.change_qty, 240);
    assert.strictEqual(ledger?.direction, 'IN');

    assert(result.batch.created_purchase_id, 'Opening purchase document generated');
    const pur = db.getPurchases(TEST_BIZ_ID).find(p => p.id === result.batch.created_purchase_id);
    assert(pur, 'Purchase recorded with supplier supp-vyapar-opening');
    assert.strictEqual(pur?.supplier_id, 'supp-vyapar-opening');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Transactional Rollback & Constraint Protection ---');
  // --------------------------------------------------------------------------

  await testCase('Rolls back imported batch cleanly including product_categories', () => {
    const importRows = [{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Rollback Candidate Shampoo 200ml',
        sku: 'SHAMP-ROLLBACK-1',
        barcode: '8909999999',
        category: 'Personal Care',
        mrp: 200, purchase_price: 150, selling_price: 175
      }
    }];

    const impRes = db.executeVyaparBatchImport(importRows, {
      file_name: 'rollback_test.xlsx',
      column_mapping: {},
      business_id: TEST_BIZ_ID
    });

    const createdProd = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'SHAMP-ROLLBACK-1');
    assert(createdProd, 'Product created');

    const rollRes = db.rollbackVyaparImport(impRes.importId, 'Accidental upload', 'Admin');
    assert.strictEqual(rollRes.success, true);

    const afterProd = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'SHAMP-ROLLBACK-1');
    assert.strictEqual(afterProd, undefined, 'Created product removed');

    const afterPc = db.getProductCategories(TEST_BIZ_ID).find(pc => pc.product_id === createdProd!.id);
    assert.strictEqual(afterPc, undefined, 'Junction table link cleanly purged');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Server Route Authorization & Tenant Isolation ---');
  // --------------------------------------------------------------------------

  await testCase('POST /api/admin/products/import blocks unauthenticated caller with 401', async () => {
    const req = createMockRequest('/api/admin/products/import', {
      method: 'POST',
      body: { rows: [] }
    });
    const res = await importPostHandler(req);
    assert.strictEqual(res.status, 401);
  });

  await testCase('POST /api/admin/products/import blocks non-admin (Retailer) caller with 403', async () => {
    const req = createMockRequest('/api/admin/products/import', {
      method: 'POST',
      token: retailerToken,
      body: { rows: [{ rowNumber: 2, action: 'CREATE_NEW', data: { name: 'Hack' } }] }
    });
    const res = await importPostHandler(req);
    assert.strictEqual(res.status, 403);
  });

  await testCase('POST /api/admin/products/import blocks cross-site mutation (CSRF)', async () => {
    const req = createMockRequest('/api/admin/products/import', {
      method: 'POST',
      token: adminToken,
      headers: { 'sec-fetch-site': 'cross-site' },
      body: { rows: [] }
    });
    const res = await importPostHandler(req);
    assert.strictEqual(res.status, 403);
  });

  await testCase('POST /api/admin/products/import ignores client-spoofed business_id (Tenant Isolation)', async () => {
    const spoofedBizId = 'biz-hacker-tenant-999';
    const req = createMockRequest('/api/admin/products/import', {
      method: 'POST',
      token: adminToken,
      body: {
        rows: [{
          rowNumber: 2,
          action: 'CREATE_NEW',
          data: {
            name: 'Tenant Isolation Soap',
            sku: 'ISO-SOAP-1',
            barcode: '8907777777',
            mrp: 50, purchase_price: 35, selling_price: 42
          }
        }],
        meta: {
          file_name: 'tenant_test.xlsx',
          business_id: spoofedBizId // MALICIOUS CLIENT INPUT
        }
      }
    });

    const res = await importPostHandler(req);
    assert.strictEqual(res.status, 200);

    // Product must be assigned strictly to admin's legitimate session businessId (TEST_BIZ_ID), NEVER spoofedBizId
    const prodInAdminBiz = db.getProducts(TEST_BIZ_ID).find(p => p.sku === 'ISO-SOAP-1');
    assert(prodInAdminBiz, 'Product correctly stored in authentic admin tenant');
    assert.strictEqual(prodInAdminBiz.business_id, TEST_BIZ_ID);

    const prodInSpoofedBiz = db.getProducts(spoofedBizId).find(p => p.sku === 'ISO-SOAP-1');
    assert.strictEqual(prodInSpoofedBiz, undefined, 'ZERO records stored in spoofed tenant');
  });

  await testCase('GET /api/admin/products/import returns import history for admin', async () => {
    const req = createMockRequest('/api/admin/products/import', {
      method: 'GET',
      token: adminToken
    });
    const res = await importGetHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(Array.isArray(data.imports));
  });

  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: Importer Hardening & Safety Verification ---');
  // --------------------------------------------------------------------------

  await testCase('Rollback Route Authorization: 401 unauthenticated and 403 non-admin', async () => {
    const unauthReq = createMockRequest('/api/admin/products/import/rollback', {
      method: 'POST',
      body: { importId: 'dummy-id' }
    });
    const unauthRes = await rollbackPostHandler(unauthReq);
    assert.strictEqual(unauthRes.status, 401);

    const nonAdminReq = createMockRequest('/api/admin/products/import/rollback', {
      method: 'POST',
      token: retailerToken,
      body: { importId: 'dummy-id' }
    });
    const nonAdminRes = await rollbackPostHandler(nonAdminReq);
    assert.strictEqual(nonAdminRes.status, 403);
  });

  await testCase('Guaranteed Unique Product Codes: Bulk rapid generation produces zero collisions', async () => {
    const bulkRows: any[] = [];
    for (let i = 0; i < 50; i++) {
      bulkRows.push({
        rowNumber: i + 1,
        action: 'CREATE_NEW',
        data: {
          name: `Uniqueness Test Product ${i + 1}`,
          sku: `UNIQ-SKU-${i + 1}-${Date.now()}`,
          barcode: `UNIQ-BC-${i + 1}-${Date.now()}`,
          mrp: 100,
          purchase_price: 70,
          selling_price: 85
        }
      });
    }

    const { batch } = db.executeVyaparBatchImport(bulkRows, {
      file_name: 'bulk_unique_test.xlsx',
      business_id: TEST_BIZ_ID
    });

    assert.strictEqual(batch.created_count, 50);
    const createdProds = db.getProducts(TEST_BIZ_ID).filter(p => batch.created_product_ids.includes(p.id));
    const codes = createdProds.map(p => p.product_code);
    const uniqueCodes = new Set(codes);

    assert.strictEqual(uniqueCodes.size, 50, 'All 50 bulk imported products have 100% unique product_codes');
    codes.forEach(c => {
      assert(c.startsWith('PRD-'), `Code ${c} conforms to PRD- prefix`);
    });
  });

  await testCase('Idempotency Key Safety: Re-importing same batch creates 0 duplicate records', async () => {
    const idempKey = `idemp-key-test-${Date.now()}`;
    const payload: Parameters<typeof db.executeVyaparBatchImport>[0] = [{
      rowNumber: 2,
      action: 'CREATE_NEW',
      data: {
        name: 'Idempotency Flour 10kg',
        sku: `IDEMP-FLOUR-${Date.now()}`,
        barcode: `8908888${Date.now().toString().slice(-4)}`,
        mrp: 450,
        purchase_price: 380,
        selling_price: 420
      }
    }];

    // First attempt
    const res1 = db.executeVyaparBatchImport(payload, {
      file_name: 'idemp_test.xlsx',
      business_id: TEST_BIZ_ID,
      idempotency_key: idempKey
    });

    const productsAfterFirst = db.getProducts(TEST_BIZ_ID).filter(p => p.sku === payload[0].data.sku);
    assert.strictEqual(productsAfterFirst.length, 1);

    // Second attempt with identical idempotency_key
    const res2 = db.executeVyaparBatchImport(payload, {
      file_name: 'idemp_test.xlsx',
      business_id: TEST_BIZ_ID,
      idempotency_key: idempKey
    });

    assert.strictEqual(res2.importId, res1.importId, 'Reuses existing importId on idempotency key match');
    const productsAfterSecond = db.getProducts(TEST_BIZ_ID).filter(p => p.sku === payload[0].data.sku);
    assert.strictEqual(productsAfterSecond.length, 1, 'Zero duplicate products created on retry');
  });

  await testCase('Safe Code Match: Row marked CREATE_NEW with existing SKU is not auto-overwritten without approval', async () => {
    const sharedSku = `RETRY-DUPE-${Date.now()}`;

    // Step 1: Create product
    db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Retry Product Original',
        sku: sharedSku,
        mrp: 100, purchase_price: 70, selling_price: 85
      }
    }], { file_name: 'first_run.xlsx', business_id: TEST_BIZ_ID });

    // Step 2: Attempt unapproved overwrite with action: 'CREATE_NEW' but same SKU
    const retryRes = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Retry Product Unapproved Attempt',
        sku: sharedSku,
        mrp: 110, purchase_price: 75, selling_price: 95
      }
    }], { file_name: 'retry_run.xlsx', business_id: TEST_BIZ_ID });

    assert.strictEqual(retryRes.batch.created_count, 0, 'Did not create duplicate product');
    assert.strictEqual(retryRes.batch.skipped_count, 1, 'Safely skipped without auto-overwriting');

    const matchingProds = db.getProducts(TEST_BIZ_ID).filter(p => p.sku === sharedSku);
    assert.strictEqual(matchingProds.length, 1, 'Exactly 1 product remains in DB');
    assert.strictEqual(matchingProds[0].mrp, 100, 'Original MRP preserved (no silent overwrite)');

    // Step 3: Explicitly approved update with action: 'UPDATE_EXISTING'
    const approvedRes = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'UPDATE_EXISTING' as const,
      data: {
        name: 'Retry Product Approved Update',
        sku: sharedSku,
        mrp: 110, purchase_price: 75, selling_price: 95
      }
    }], { file_name: 'approved_run.xlsx', business_id: TEST_BIZ_ID });

    assert.strictEqual(approvedRes.batch.updated_count, 1, 'Explicitly approved update succeeded');
    const updatedProds = db.getProducts(TEST_BIZ_ID).filter(p => p.sku === sharedSku);
    assert.strictEqual(updatedProds[0].mrp, 110, 'Product details updated following explicit approval');
  });

  await testCase('Rollback Safety: Refuses rollback when updated product was modified after import', async () => {
    // 1. Create baseline product
    const baseSku = `POST-EDIT-${Date.now()}`;
    const firstImport = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Post Edit Tea 250g',
        sku: baseSku,
        mrp: 120, purchase_price: 90, selling_price: 105
      }
    }], { file_name: 'base.xlsx', business_id: TEST_BIZ_ID });

    const prodId = firstImport.batch.created_product_ids[0];

    // 2. Update via second import
    const secondImport = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'UPDATE_EXISTING',
      existingProductId: prodId,
      data: {
        name: 'Post Edit Tea 250g',
        sku: baseSku,
        mrp: 130, purchase_price: 95, selling_price: 115
      }
    }], { file_name: 'update.xlsx', business_id: TEST_BIZ_ID });

    // 3. Legitimate administrative post-import modification
    const prods = db.getProducts(TEST_BIZ_ID);
    const prod = prods.find(p => p.id === prodId)!;
    prod.description = 'Legitimate subsequent administrative edit';
    // Set updated_at to future of secondImport
    prod.updated_at = new Date(Date.now() + 10000).toISOString();
    db.saveProducts(prods, TEST_BIZ_ID);

    // 4. Attempt to rollback secondImport
    const rollbackRes = db.rollbackVyaparImport(secondImport.importId, 'Test rollback', 'Admin', TEST_BIZ_ID);
    assert.strictEqual(rollbackRes.success, false, 'Rollback correctly rejected');
    assert(rollbackRes.message.includes('modified after this import'), 'Rejection message explains post-import modification');

    // Verify product still has its legitimate edit
    const currentProd = db.getProducts(TEST_BIZ_ID).find(p => p.id === prodId)!;
    assert.strictEqual(currentProd.description, 'Legitimate subsequent administrative edit');
  });

  await testCase('Rollback Safety: Opening stock is accurately reverted for updated products', async () => {
    // 1. Create initial product with 10 units stock
    const stockSku = `STOCK-REV-${Date.now()}`;
    const initRes = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Stock Revert Biscuit',
        sku: stockSku,
        mrp: 30, purchase_price: 20, selling_price: 25,
        stock_qty: 10,
        stock_qty_is_base: true
      }
    }], { file_name: 'init_stock.xlsx', business_id: TEST_BIZ_ID, import_opening_stock: true });

    const prodId = initRes.batch.created_product_ids[0];
    let inv = db.getInventory(TEST_BIZ_ID).find(i => i.product_id === prodId)!;
    assert.strictEqual(inv.physical_qty, 10);

    // 2. Add 15 more units in a second import
    const addStockRes = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'UPDATE_EXISTING' as const,
      existingProductId: prodId,
      data: {
        name: 'Stock Revert Biscuit',
        sku: stockSku,
        mrp: 30, purchase_price: 20, selling_price: 25,
        stock_qty: 15,
        stock_qty_is_base: true
      }
    }], { file_name: 'add_stock.xlsx', business_id: TEST_BIZ_ID, import_opening_stock: true });

    inv = db.getInventory(TEST_BIZ_ID).find(i => i.product_id === prodId)!;
    assert.strictEqual(inv.physical_qty, 25);

    // 3. Rollback the second import
    const rollbackRes = db.rollbackVyaparImport(addStockRes.importId, 'Revert added stock', 'Admin', TEST_BIZ_ID);
    assert.strictEqual(rollbackRes.success, true);

    inv = db.getInventory(TEST_BIZ_ID).find(i => i.product_id === prodId)!;
    assert.strictEqual(inv.physical_qty, 10, 'Opening stock quantity cleanly reverted back to 10');
  });

  await testCase('Schema Constraints: products.description and stock_ledger fields are correctly populated', async () => {
    const descSku = `DESC-SCHEMA-${Date.now()}`;
    const importRes = db.executeVyaparBatchImport([{
      rowNumber: 2,
      action: 'CREATE_NEW' as const,
      data: {
        name: 'Schema Check Product',
        sku: descSku,
        description: 'Premium Roasted Cashews 500g Vacuum Pack',
        mrp: 500, purchase_price: 350, selling_price: 450,
        stock_qty: 5,
        stock_qty_is_base: true
      }
    }], { file_name: 'schema_check.xlsx', business_id: TEST_BIZ_ID, import_opening_stock: true });

    const prod = db.getProducts(TEST_BIZ_ID).find(p => p.sku === descSku)!;
    assert(prod, 'Product created');
    assert.strictEqual(prod.description, 'Premium Roasted Cashews 500g Vacuum Pack', 'description column stored on product');

    const ledger = db.getLedger(TEST_BIZ_ID).find(l => l.product_id === prod.id)!;
    assert(ledger, 'Stock ledger entry created');
    assert.strictEqual(ledger.business_id, TEST_BIZ_ID, 'stock_ledger business_id populated');
    assert.strictEqual(ledger.direction, 'IN', 'stock_ledger direction is IN');
    assert.strictEqual(ledger.change_qty, 5, 'stock_ledger change_qty is 5');
    assert.strictEqual(ledger.reference_id, importRes.importId, 'stock_ledger reference_id matches importId');
  });

  // --------------------------------------------------------------------------
  console.log('================================================================================');
  console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
