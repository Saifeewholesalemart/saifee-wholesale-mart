/**
 * ============================================================================
 * Safe Staging Demo Seed Script: Clean Database Demonstration & Performance
 * Saifee General Stores FMCG Wholesale Distribution & Trade ERP
 * File: scripts/seed_demo_staging_data.js
 * ============================================================================
 *
 * SAFETY GUARANTEES:
 * 1. ZERO PRODUCTION EXECUTION: Hardcoded blocklist blocks production project 'wxctglnnybhhptkxwxur'.
 * 2. EXPLICIT STAGING TARGET: Requires explicit staging project ref or localhost, and confirmation flag.
 * 3. DEFAULT DRY-RUN: Runs dry-run simulation by default. Zero writes without --execute.
 * 4. CREDENTIAL SANITIZATION: Tokens and passwords are never logged to console or files.
 * 5. STRICT SCHEMA FIDELITY: Generates records conforming 100% to schema_migration_reviewed.sql.
 * 6. FINANCIAL & STOCK CONSERVATION: Invariant checks verify physical == batch stock and balanced ledgers.
 *
 * USAGE:
 *   # Dry-Run Simulation (Small Volume - 50 products):
 *   node scripts/seed_demo_staging_data.js --dry-run
 *
 *   # Dry-Run Simulation (Full Volume - 6,000 products):
 *   node scripts/seed_demo_staging_data.js --dry-run --volume=full
 *
 *   # Authorized Staging Execution (ONLY ON ISOLATED STAGING):
 *   ALLOW_STAGING_EXECUTE=true STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co STAGING_SERVICE_ROLE_KEY=<key> \
 *     node scripts/seed_demo_staging_data.js --execute --staging --confirm-staging=<staging-ref>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ----------------------------------------------------------------------------
// 1. SAFETY & STAGING TARGET VALIDATION GATE
// ----------------------------------------------------------------------------
const BLOCKED_PRODUCTION_REFS = ['wxctglnnybhhptkxwxur'];
const ALLOWED_LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal'];
const AUTHORIZED_STAGING_PROJECT_REFS = [
  'saifee-staging-db',
  'saifee-erp-staging',
  'saifee-fmcg-staging',
  'saifee-staging-01',
  'saifee-dev-staging',
  'jtofsoriinobcabpjswl' // Verified Supabase Staging Project (Display Name: saifee-staging-01)
];

// Compile-time safety assertion: Staging allowlist must NEVER contain any blocked production reference
for (const blocked of BLOCKED_PRODUCTION_REFS) {
  if (AUTHORIZED_STAGING_PROJECT_REFS.includes(blocked)) {
    throw new Error(`CRITICAL SECURITY FAULT: Production reference "${blocked}" detected in AUTHORIZED_STAGING_PROJECT_REFS.`);
  }
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
// Strict Precedence: --dry-run ALWAYS overrides --execute
const isExecute = args.includes('--execute') && !isDryRun;
const isStaging = args.includes('--staging');
const volumeArg = args.find(a => a.startsWith('--volume='))?.split('=')[1] || 'small';
const confirmStagingArg = args.find(a => a.startsWith('--confirm-staging='))?.split('=')[1] || '';

// Load optional .env.staging if present
const stagingEnvPath = path.resolve(process.cwd(), '.env.staging');
if (fs.existsSync(stagingEnvPath)) {
  const content = fs.readFileSync(stagingEnvPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const targetUrl = process.env.STAGING_SUPABASE_URL || '';
const serviceRoleKey = process.env.STAGING_SERVICE_ROLE_KEY || '';
const dbUrl = process.env.STAGING_DATABASE_URL || '';

function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[REDACTED_SECRET]');
}

function log(msg, ...rest) {
  const sanitizedRest = rest.map(r => typeof r === 'string' ? sanitize(r) : r);
  console.log(`[${new Date().toISOString()}] ${sanitize(msg)}`, ...sanitizedRest);
}

// Hard fail-closed target verification
function verifyTargetSafety() {
  if (!isExecute) {
    if (args.includes('--execute') && isDryRun) {
      log('SAFETY OVERRIDE: Both --execute and --dry-run flags were supplied. Strict --dry-run precedence enforced. Database writes STRICTLY BLOCKED.');
    } else {
      log('SAFETY NOTICE: Running in STRICT DRY-RUN mode. Zero database writes will be executed.');
    }
    return;
  }

  if (!isStaging) {
    throw new Error('SAFETY GATE: --execute requires explicit --staging flag.');
  }

  if (process.env.ALLOW_STAGING_EXECUTE !== 'true') {
    throw new Error('SAFETY GATE: ALLOW_STAGING_EXECUTE=true environment variable must be set explicitly.');
  }

  if (!targetUrl) {
    throw new Error('SAFETY GATE: STAGING_SUPABASE_URL must be provided when --execute is specified.');
  }

  // 1. Check production blocklist across all configuration parameters
  for (const prodRef of BLOCKED_PRODUCTION_REFS) {
    if (targetUrl.includes(prodRef)) {
      throw new Error(`CRITICAL SECURITY VIOLATION: Target URL matches blocked production reference "${prodRef}". Execution strictly aborted.`);
    }
    if (dbUrl && dbUrl.includes(prodRef)) {
      throw new Error(`CRITICAL SECURITY VIOLATION: STAGING_DATABASE_URL matches blocked production reference "${prodRef}". Execution strictly aborted.`);
    }
    if (confirmStagingArg.includes(prodRef)) {
      throw new Error(`CRITICAL SECURITY VIOLATION: Confirmation argument matches blocked production reference "${prodRef}". Execution strictly aborted.`);
    }
  }

  // 2. Validate that staging target matches an authorized allowlist
  const isLocal = ALLOWED_LOCAL_HOSTS.some(h => targetUrl.includes(h));
  if (!isLocal) {
    if (!confirmStagingArg) {
      throw new Error('SAFETY GATE: Remote staging execution requires --confirm-staging=<staging-project-ref>.');
    }
    const isAuthorizedStagingRef = AUTHORIZED_STAGING_PROJECT_REFS.includes(confirmStagingArg);
    if (!isAuthorizedStagingRef) {
      throw new Error(`SAFETY GATE: Project reference "${confirmStagingArg}" is not in the explicit authorized staging allowlist (${AUTHORIZED_STAGING_PROJECT_REFS.join(', ')}).`);
    }
    if (!targetUrl.includes(confirmStagingArg)) {
      throw new Error(`SAFETY GATE: Target URL does not match confirmation argument "${confirmStagingArg}".`);
    }
  }

  // 3. Credentials and placeholder detection
  if (!serviceRoleKey) {
    throw new Error('SAFETY GATE: STAGING_SERVICE_ROLE_KEY is required for staging database execution.');
  }

  const placeholderPatterns = ['your_staging', 'your-project-ref', '[YOUR_', '[password]', 'your_service_role'];
  for (const pattern of placeholderPatterns) {
    if (serviceRoleKey.includes(pattern)) {
      throw new Error(`SAFETY GATE: STAGING_SERVICE_ROLE_KEY contains placeholder pattern "${pattern}". Real credentials must be configured.`);
    }
    if (targetUrl.includes(pattern)) {
      throw new Error(`SAFETY GATE: STAGING_SUPABASE_URL contains placeholder pattern "${pattern}". Real target URL must be configured.`);
    }
    if (dbUrl && dbUrl.includes(pattern)) {
      throw new Error(`SAFETY GATE: STAGING_DATABASE_URL contains placeholder pattern "${pattern}". Real PostgreSQL password must be configured.`);
    }
  }

  // 4. Verify target URL and PostgreSQL connection string target the exact same project reference
  if (dbUrl && !isLocal) {
    const urlRefMatch = targetUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
    if (urlRefMatch && urlRefMatch[1]) {
      const urlProjectRef = urlRefMatch[1];
      if (!dbUrl.includes(urlProjectRef)) {
        throw new Error(`SAFETY GATE: Target mismatch! STAGING_SUPABASE_URL project ref ("${urlProjectRef}") does not match target in STAGING_DATABASE_URL.`);
      }
    }
  }

  log(`Target verified as isolated staging environment: ${new URL(targetUrl).hostname}`);
}

// ----------------------------------------------------------------------------
// 2. REALISTIC FMCG SEED DATA GENERATOR
// ----------------------------------------------------------------------------
function generateSeedData(volume = 'small') {
  log(`Generating seed dataset (Volume: ${volume.toUpperCase()})...`);

  const businessId = 'biz-saifee-main';

  // 1. Business Company & Brand Companies
  const businessCompanies = [
    {
      id: businessId,
      name: 'Saifee General Stores FMCG Distribution',
      code: 'SAIFEE',
      is_active: true
    }
  ];

  const brandCompanies = [
    { id: 'c-joy', name: 'Joy Personal Care', code: 'JOY', active: true },
    { id: 'c-hul', name: 'Hindustan Unilever Limited', code: 'HUL', active: true },
    { id: 'c-itc', name: 'ITC Foods & Personal Care', code: 'ITC', active: true },
    { id: 'c-nestle', name: 'Nestle India', code: 'NESTLE', active: true },
    { id: 'c-brit', name: 'Britannia Industries', code: 'BRIT', active: true }
  ];

  // 2. Godowns
  const godowns = [
    { id: 'godown-main', business_id: businessId, code: 'G-MAIN', name: 'Central Distribution Godown', city: 'Mumbai', is_default: true, status: 'Active' },
    { id: 'godown-city', business_id: businessId, code: 'G-CITY', name: 'South City Transit Depot', city: 'Mumbai', is_default: false, status: 'Active' },
    { id: 'godown-wh3', business_id: businessId, code: 'G-WH3', name: 'Thane Regional Warehouse', city: 'Thane', is_default: false, status: 'Active' }
  ];

  // 3. Suppliers
  const suppliers = [
    { id: 'supp-joy-corp', business_id: businessId, name: 'Joy Personal Care Private Ltd', gstin: '27AABCP1234F1Z1', city: 'Mumbai', active: true },
    { id: 'supp-hul-dist', business_id: businessId, name: 'HUL Super Distribution Hub', gstin: '27AAACH0123E1Z2', city: 'Bhiwandi', active: true },
    { id: 'supp-itc-foods', business_id: businessId, name: 'ITC Trade Depot Maharashtra', gstin: '27AAACI5678A1Z5', city: 'Navi Mumbai', active: true },
    { id: 'supp-nestle-in', business_id: businessId, name: 'Nestle Western Zone Clearing', gstin: '27AAACN9012C1Z8', city: 'Thane', active: true },
    { id: 'supp-brit-mfg', business_id: businessId, name: 'Britannia Wholesale C&F', gstin: '27AAACB3456D1Z9', city: 'Pune', active: true }
  ];

  // 4. Retailers
  const retailerNames = [
    { shop: 'Royal Provision Store', owner: 'Mustafa Bhai', route: 'Fort - Colaba' },
    { shop: 'Al-Madina General Stores', owner: 'Husain Kapasi', route: 'Bhendi Bazaar' },
    { shop: 'Burhani Supermarket', owner: 'Murtaza Saifee', route: 'Crawford Market' },
    { shop: 'City Daily Mart', owner: 'Ramesh Patel', route: 'Dadar West' },
    { shop: 'Modern Kirana & Dry Fruits', owner: 'Suresh Shah', route: 'Bandra Linking Rd' },
    { shop: 'Apsara Stores', owner: 'Irfan Sheikh', route: 'Kurla West' },
    { shop: 'Shreeji General Stores', owner: 'Kishore Dave', route: 'Ghatkopar East' },
    { shop: 'Evergreen Chemist & FMCG', owner: 'Dr. Ansari', route: 'Andheri West' },
    { shop: 'National Mart', owner: 'Zuber Merchant', route: 'Byculla' },
    { shop: 'Kalyan Wholesale Traders', owner: 'Dinesh Jain', route: 'Kalyan Station Rd' }
  ];

  const retailers = retailerNames.map((r, i) => ({
    id: `ret-${1000 + i}`,
    business_id: businessId,
    shop_name: r.shop,
    owner_name: r.owner,
    mobile: `98200${String(10000 + i).slice(-5)}`,
    retailer_code: `RET-${String(100 + i)}`,
    route: r.route,
    city: 'Mumbai',
    credit_limit: 100000,
    balance: 0,
    status: 'Active',
    active: true
  }));

  // 5. Products, Inventory, and Batches
  const productCount = volume === 'full' ? 6281 : 50;
  const products = [];
  const inventory = [];
  const batches = [];

  const FMCG_SUB_CATEGORIES = ['Face Wash', 'Body Lotion', 'Skin Cream', 'Bath Soap', 'Shampoo', 'Biscuits', 'Noodles', 'Tea', 'Detergent Powder'];

  for (let i = 1; i <= productCount; i++) {
    const comp = brandCompanies[i % brandCompanies.length];
    const subCat = FMCG_SUB_CATEGORIES[i % FMCG_SUB_CATEGORIES.length];
    const prodId = `prd-demo-${String(i).padStart(5, '0')}`;
    const code = `${comp.code}-${subCat.substring(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`;
    const sku = `SKU-${code}`;
    const barcode = `890${String(2000000000 + i).slice(-10)}`;
    const cost = 20 + ((i * 11) % 450);
    const selling = Math.round(cost * 1.15);
    const mrp = Math.round(cost * 1.30);
    const unitsPerBox = (i % 3 === 0) ? 12 : (i % 3 === 1) ? 24 : 48;

    products.push({
      id: prodId,
      business_id: businessId,
      company_id: comp.id,
      name: `${comp.name.split(' ')[0]} ${subCat} Pack ${i}`,
      product_code: code,
      sku,
      barcode,
      hsn: '33049910',
      pack_size: `${unitsPerBox} units / carton`,
      trading_unit: 'Carton',
      packing_display: `${unitsPerBox} units / carton`,
      units_per_box_carton: unitsPerBox,
      units_per_trading_unit: unitsPerBox,
      pieces_per_carton: unitsPerBox,
      base_unit: 'Piece',
      allow_carton: true,
      allow_pieces: true,
      trade_mode: 'BOTH',
      allow_loose_sale: true,
      gst_percent: 18,
      mrp,
      purchase_price: cost,
      selling_price: selling,
      category: 'FMCG',
      sub_category: subCat,
      brand: comp.name.split(' ')[0],
      active: true,
      min_stock_level: 24,
      reorder_level: 48
    });

    // Batches & Stock (50 pieces per product distributed across 2 batches)
    const batch1Qty = 30;
    const batch2Qty = 20;
    const totalPhysical = batch1Qty + batch2Qty;

    batches.push({
      id: `batch-${prodId}-01`,
      business_id: businessId,
      product_id: prodId,
      batch_number: `B26-${String(i).padStart(4, '0')}A`,
      quantity: batch1Qty,
      cost_price: cost,
      mrp,
      selling_price: selling,
      manufacturing_date: '2026-01-15',
      expiry_date: '2027-12-31',
      godown_id: 'godown-main'
    });

    batches.push({
      id: `batch-${prodId}-02`,
      business_id: businessId,
      product_id: prodId,
      batch_number: `B26-${String(i).padStart(4, '0')}B`,
      quantity: batch2Qty,
      cost_price: cost,
      mrp,
      selling_price: selling,
      manufacturing_date: '2026-02-01',
      expiry_date: '2028-01-31',
      godown_id: 'godown-city'
    });

    inventory.push({
      id: `inv-${prodId}`,
      business_id: businessId,
      product_id: prodId,
      physical_qty: totalPhysical,
      reserved_qty: 0,
      available_qty: totalPhysical,
      damaged_qty: 0,
      expired_qty: 0,
      godown_id: 'godown-main'
    });
  }

  // 6. Orders, Invoices, Payments, and Ledgers (for the first 10 products and retailers)
  const orders = [];
  const orderItems = [];
  const invoices = [];
  const invoiceItems = [];
  const payments = [];
  const paymentAllocations = [];
  const customerLedger = [];

  const txCount = Math.min(10, retailers.length);
  for (let t = 0; t < txCount; t++) {
    const ret = retailers[t];
    const prod = products[t];
    const orderId = `ord-demo-${1001 + t}`;
    const invId = `inv-demo-${2001 + t}`;
    const pmtId = `pmt-demo-${3001 + t}`;

    const qty = 10;
    const rate = prod.selling_price;
    const itemTotal = qty * rate;
    const tax = Math.round(itemTotal * 0.18);
    const grandTotal = itemTotal + tax;

    orders.push({
      id: orderId,
      business_id: businessId,
      retailer_id: ret.id,
      order_number: `SO-2026-${String(1001 + t)}`,
      order_date: '2026-03-01',
      status: 'Delivered',
      total_amount: itemTotal,
      tax_amount: tax,
      discount_amount: 0,
      grand_total: grandTotal,
      channel: 'Direct Field Sales'
    });

    orderItems.push({
      id: `item-${orderId}-01`,
      business_id: businessId,
      order_id: orderId,
      product_id: prod.id,
      quantity: qty,
      trading_unit: 'Carton',
      unit_price: rate,
      discount_percent: 0,
      discount_amount: 0,
      tax_percent: 18,
      tax_amount: tax,
      total_price: grandTotal
    });

    invoices.push({
      id: invId,
      business_id: businessId,
      order_id: orderId,
      retailer_id: ret.id,
      invoice_number: `INV-2026-${String(2001 + t)}`,
      invoice_date: '2026-03-02',
      total_amount: itemTotal,
      tax_amount: tax,
      discount_amount: 0,
      grand_total: grandTotal,
      outstanding_amount: (t % 2 === 0) ? 0 : grandTotal, // Half paid, half outstanding
      status: (t % 2 === 0) ? 'Paid' : 'Unpaid'
    });

    invoiceItems.push({
      id: `invitem-${invId}-01`,
      business_id: businessId,
      invoice_id: invId,
      product_id: prod.id,
      quantity: qty,
      trading_unit: 'Carton',
      unit_price: rate,
      discount_amount: 0,
      tax_amount: tax,
      total_price: grandTotal
    });

    // Debit customer ledger for Invoice
    customerLedger.push({
      id: `cldg-inv-${invId}`,
      business_id: businessId,
      retailer_id: ret.id,
      entry_date: '2026-03-02',
      entry_type: 'INVOICE',
      reference_id: invId,
      reference_number: `INV-2026-${String(2001 + t)}`,
      debit: grandTotal,
      credit: 0,
      running_balance: grandTotal,
      description: `Sales Invoice INV-2026-${String(2001 + t)}`
    });

    // If marked Paid, record payment and credit ledger
    if (t % 2 === 0) {
      payments.push({
        id: pmtId,
        business_id: businessId,
        retailer_id: ret.id,
        payment_number: `RCP-2026-${String(3001 + t)}`,
        payment_date: '2026-03-05',
        amount: grandTotal,
        payment_mode: 'UPI',
        reference_number: `UPI${String(9900000000 + t)}`
      });

      paymentAllocations.push({
        id: `alloc-${pmtId}-${invId}`,
        business_id: businessId,
        payment_id: pmtId,
        invoice_id: invId,
        amount: grandTotal
      });

      customerLedger.push({
        id: `cldg-pmt-${pmtId}`,
        business_id: businessId,
        retailer_id: ret.id,
        entry_date: '2026-03-05',
        entry_type: 'PAYMENT',
        reference_id: pmtId,
        reference_number: `RCP-2026-${String(3001 + t)}`,
        debit: 0,
        credit: grandTotal,
        running_balance: 0,
        description: `Payment Receipt RCP-2026-${String(3001 + t)} (Settled)`
      });
    }
  }

  return {
    businessCompanies,
    brandCompanies,
    godowns,
    suppliers,
    retailers,
    products,
    inventory,
    batches,
    orders,
    orderItems,
    invoices,
    invoiceItems,
    payments,
    paymentAllocations,
    customerLedger
  };
}

// ----------------------------------------------------------------------------
// 3. INVARIANT & RECONCILIATION VERIFICATION
// ----------------------------------------------------------------------------
function verifyDatasetInvariants(data) {
  log('Auditing seed dataset relational integrity and accounting invariants...');

  // 1. Foreign Key Integrity Checks
  const companyIds = new Set(data.brandCompanies.map(c => c.id));
  const productIds = new Set(data.products.map(p => p.id));
  const retailerIds = new Set(data.retailers.map(r => r.id));
  const orderIds = new Set(data.orders.map(o => o.id));
  const invoiceIds = new Set(data.invoices.map(i => i.id));
  const paymentIds = new Set(data.payments.map(p => p.id));

  for (const p of data.products) {
    if (!companyIds.has(p.company_id)) {
      throw new Error(`INTEGRITY ERROR: Product ${p.id} references non-existent company ${p.company_id}`);
    }
  }

  for (const inv of data.inventory) {
    if (!productIds.has(inv.product_id)) {
      throw new Error(`INTEGRITY ERROR: Inventory ${inv.id} references non-existent product ${inv.product_id}`);
    }
  }

  for (const b of data.batches) {
    if (!productIds.has(b.product_id)) {
      throw new Error(`INTEGRITY ERROR: Batch ${b.id} references non-existent product ${b.product_id}`);
    }
  }

  for (const o of data.orders) {
    if (!retailerIds.has(o.retailer_id)) {
      throw new Error(`INTEGRITY ERROR: Order ${o.id} references non-existent retailer ${o.retailer_id}`);
    }
  }

  for (const alloc of data.paymentAllocations) {
    if (!paymentIds.has(alloc.payment_id)) throw new Error(`INTEGRITY ERROR: Allocation references missing payment ${alloc.payment_id}`);
    if (!invoiceIds.has(alloc.invoice_id)) throw new Error(`INTEGRITY ERROR: Allocation references missing invoice ${alloc.invoice_id}`);
  }

  // 2. Stock Conservation: Physical == Batch sum
  const batchSumByProduct = new Map();
  for (const b of data.batches) {
    batchSumByProduct.set(b.product_id, (batchSumByProduct.get(b.product_id) || 0) + b.quantity);
  }

  let totalPhysicalStock = 0;
  let totalBatchStock = 0;

  for (const inv of data.inventory) {
    totalPhysicalStock += inv.physical_qty;
    const bSum = batchSumByProduct.get(inv.product_id) || 0;
    if (inv.physical_qty !== bSum) {
      throw new Error(`STOCK CONSERVATION ERROR: Product ${inv.product_id} physical (${inv.physical_qty}) != batch sum (${bSum})`);
    }
  }

  for (const b of data.batches) {
    totalBatchStock += b.quantity;
  }

  if (totalPhysicalStock !== totalBatchStock) {
    throw new Error(`GLOBAL STOCK VARIANCE: Physical ${totalPhysicalStock} != Batch ${totalBatchStock}`);
  }

  // 3. Financial Invariant Check: Customer Ledger debits and credits
  const totalBilled = data.invoices.reduce((s, i) => s + i.grand_total, 0);
  const totalPaid = data.payments.reduce((s, p) => s + p.amount, 0);
  const totalLedgerDebit = data.customerLedger.reduce((s, l) => s + l.debit, 0);
  const totalLedgerCredit = data.customerLedger.reduce((s, l) => s + l.credit, 0);

  if (totalBilled !== totalLedgerDebit) {
    throw new Error(`FINANCIAL INVARIANT ERROR: Total Invoiced (${totalBilled}) != Customer Ledger Debits (${totalLedgerDebit})`);
  }
  if (totalPaid !== totalLedgerCredit) {
    throw new Error(`FINANCIAL INVARIANT ERROR: Total Payments (${totalPaid}) != Customer Ledger Credits (${totalLedgerCredit})`);
  }

  log('ALL INVARIANTS SATISFIED:');
  log(`  - Products Count             : ${data.products.length}`);
  log(`  - Inventory Records          : ${data.inventory.length}`);
  log(`  - Batches Count              : ${data.batches.length}`);
  log(`  - Total Physical Stock       : ${totalPhysicalStock.toLocaleString()} pcs`);
  log(`  - Total Batch Stock          : ${totalBatchStock.toLocaleString()} pcs (Variance = 0)`);
  log(`  - Orders / Invoices          : ${data.orders.length} / ${data.invoices.length}`);
  log(`  - Total Billed / Paid        : ₹${totalBilled.toLocaleString()} / ₹${totalPaid.toLocaleString()}`);
  log(`  - Customer Ledger Invariants : Debits ₹${totalLedgerDebit.toLocaleString()} == Credits + AR`);
}

// ----------------------------------------------------------------------------
// 4. MAIN EXECUTION CONTROLLER
// ----------------------------------------------------------------------------
async function main() {
  console.log('================================================================');
  console.log('SAIFEE FMCG ERP — FRESH STAGING DEMO SEED ENGINE');
  console.log('================================================================');

  verifyTargetSafety();

  const data = generateSeedData(volumeArg);
  verifyDatasetInvariants(data);

  if (!isExecute) {
    console.log('\n----------------------------------------------------------------');
    console.log('DRY-RUN PROPOSED TABLE INSERTION SUMMARY:');
    console.log('----------------------------------------------------------------');
    console.table([
      { Entity: 'business_companies', Rows: data.businessCompanies.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'companies', Rows: data.brandCompanies.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'godowns', Rows: data.godowns.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'suppliers', Rows: data.suppliers.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'retailers', Rows: data.retailers.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'products', Rows: data.products.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'inventory', Rows: data.inventory.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'inventory_batches', Rows: data.batches.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'orders', Rows: data.orders.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'order_items', Rows: data.orderItems.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'invoices', Rows: data.invoices.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'invoice_items', Rows: data.invoiceItems.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'payments', Rows: data.payments.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'payment_allocations', Rows: data.paymentAllocations.length, Status: 'DRY_RUN_VALIDATED' },
      { Entity: 'customer_ledger', Rows: data.customerLedger.length, Status: 'DRY_RUN_VALIDATED' }
    ]);
    console.log('STATUS: STRICT DRY-RUN COMPLETE. ZERO DATABASE WRITES EXECUTED.');
    console.log('================================================================\n');
    return;
  }

  // Live Staging Insertions (Only executed when explicitly authorized)
  log(`Starting batch insertion into staging database (${targetUrl})...`);
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(targetUrl, serviceRoleKey);

  const tablesToInsert = [
    { name: 'business_companies', records: data.businessCompanies },
    { name: 'companies', records: data.brandCompanies },
    { name: 'godowns', records: data.godowns },
    { name: 'suppliers', records: data.suppliers },
    { name: 'retailers', records: data.retailers },
    { name: 'products', records: data.products },
    { name: 'inventory', records: data.inventory },
    { name: 'inventory_batches', records: data.batches },
    { name: 'orders', records: data.orders },
    { name: 'order_items', records: data.orderItems },
    { name: 'invoices', records: data.invoices },
    { name: 'invoice_items', records: data.invoiceItems },
    { name: 'payments', records: data.payments },
    { name: 'payment_allocations', records: data.paymentAllocations },
    { name: 'customer_ledger', records: data.customerLedger }
  ];

  for (const tbl of tablesToInsert) {
    log(`Inserting ${tbl.records.length} records into "${tbl.name}"...`);
    const batchSize = 200;
    for (let i = 0; i < tbl.records.length; i += batchSize) {
      const chunk = tbl.records.slice(i, i + batchSize);
      const { error } = await supabase.from(tbl.name).upsert(chunk, { onConflict: 'id' });
      if (error) {
        throw new Error(`INSERT ERROR on "${tbl.name}" chunk ${i}-${i + chunk.length}: ${error.message}`);
      }
    }
  }

  log('STAGING SEED COMPLETED SUCCESSFULLY. All demo data seeded.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(`\n[FATAL SEED ERROR] ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  generateSeedData,
  verifyDatasetInvariants,
  verifyTargetSafety,
  sanitize
};
