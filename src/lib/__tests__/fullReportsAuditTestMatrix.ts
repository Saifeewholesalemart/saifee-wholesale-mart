import { 
  getPartyItemReport, 
  getItemReportByParty, 
  DbState, 
  UserContext, 
  ReportFilterState 
} from '../reportsEngine';
import { Product, Invoice, Purchase, SalesReturn, StockLedgerEntry, Retailer, Supplier, Profile, Company, Godown } from '../db';

async function runComprehensiveAudit() {
  console.log('====================================================');
  console.log('COMPREHENSIVE ERP AUDIT & TEST MATRIX EXECUTION');
  console.log('====================================================\n');

  // Multi-product setup
  const mockProducts: Product[] = [
    {
      id: 'prod-a',
      product_code: 'PRODA',
      name: 'Product A 100ml',
      company_id: 'biz-saifee',
      brand: 'Saifee Brand',
      category: 'Beverages',
      pack_size: '24 units/carton',
      trading_unit: 'Box',
      base_unit: 'Piece',
      units_per_box_carton: 24,
      mrp: 1200,
      selling_price: 1000,
      purchase_price: 800,
      gst_percent: 18,
      hsn: '2202',
      sku: 'SKU-PRODA-100',
      barcode: '100100100',
      active: true,
      packing_display: '24 units / carton'
    },
    {
      id: 'prod-b',
      product_code: 'PRODB',
      name: 'Product B 500g',
      company_id: 'biz-saifee',
      brand: 'Saifee Brand',
      category: 'Food',
      pack_size: '12 units/carton',
      trading_unit: 'Box',
      base_unit: 'Piece',
      units_per_box_carton: 12,
      mrp: 600,
      selling_price: 500,
      purchase_price: 400,
      gst_percent: 18,
      hsn: '1905',
      sku: 'SKU-PRODB-500',
      barcode: '200200200',
      active: true,
      packing_display: '12 units / carton'
    },
    {
      id: 'prod-c',
      product_code: 'PRODC',
      name: 'Product C 1L',
      company_id: 'biz-other', // Different tenant company
      brand: 'Other Brand',
      category: 'Beverages',
      pack_size: '10 units/carton',
      trading_unit: 'Box',
      base_unit: 'Piece',
      units_per_box_carton: 10,
      mrp: 1500,
      selling_price: 1200,
      purchase_price: 1000,
      gst_percent: 18,
      hsn: '2202',
      sku: 'SKU-PRODC-1L',
      barcode: '300300300',
      active: true,
      packing_display: '10 units / carton'
    }
  ];

  // Godowns
  const mockGodowns: Godown[] = [
    {
      id: 'gdn-main',
      company_id: 'biz-saifee',
      name: 'Main Godown',
      code: 'GD01',
      status: 'Active',
      created_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'gdn-branch',
      company_id: 'biz-saifee',
      name: 'Branch Godown',
      code: 'GD02',
      status: 'Active',
      created_at: '2026-01-01T00:00:00Z'
    }
  ];

  // Retailers
  const mockRetailers: Retailer[] = [
    {
      id: 'ret-a',
      retailer_code: 'RET-A',
      shop_name: 'Retailer A (Indore Store)',
      owner_name: 'Anand Kumar',
      address: 'Shop 1, Indore Market',
      city: 'Indore',
      state_code: '23',
      mobile: '9876543201',
      credit_limit: 500000,
      outstanding: 0,
      active: true,
      business_id: 'biz-saifee'
    },
    {
      id: 'ret-b',
      retailer_code: 'RET-B',
      shop_name: 'Retailer B (Bhopal Mart)',
      owner_name: 'Bharat Singh',
      address: 'Shop 2, Bhopal Market',
      city: 'Bhopal',
      state_code: '23',
      mobile: '9876543202',
      credit_limit: 500000,
      outstanding: 0,
      active: true,
      business_id: 'biz-saifee'
    }
  ];

  // Suppliers
  const mockSuppliers: Supplier[] = [
    {
      id: 'sup-a',
      name: 'Supplier A (National Agro)',
      gstin: '23AAAAA0000A1Z5',
      address: 'Industrial Area, Indore',
      active: true,
      business_id: 'biz-saifee'
    },
    {
      id: 'sup-b',
      name: 'Supplier B (Central FMCG)',
      gstin: '23BBBBB0000B1Z6',
      address: 'Sector 5, Bhopal',
      active: true,
      business_id: 'biz-saifee'
    }
  ];

  // Salespersons
  const mockProfiles: Profile[] = [
    {
      id: 'sp-ramesh',
      name: 'Ramesh',
      full_name: 'Ramesh Kumar',
      email: 'ramesh@saifee.com',
      role: 'sales_dist',
      active: true
    },
    {
      id: 'sp-vikas',
      name: 'Vikas',
      full_name: 'Vikas Sharma',
      email: 'vikas@saifee.com',
      role: 'sales_co',
      active: true
    }
  ];

  // Invoices (Sales source of truth)
  const mockInvoices: Invoice[] = [
    // Invoice 1: Retailer A, Product A, 10 Boxes (240 pcs), Amount = ₹10,000, Date = 2026-09-10, Salesperson = Ramesh, Channel = Distributor Salesperson, Godown = Main Godown
    {
      id: 'inv-1',
      invoice_number: 'INV-2026-001',
      retailer_id: 'ret-a',
      business_id: 'biz-saifee',
      date: '2026-09-10',
      status: 'Finalized',
      place_of_supply: 'Main Godown',
      subtotal: 10000,
      discount_amount: 0,
      taxable_value: 10000,
      cgst: 0,
      sgst: 0,
      igst: 0,
      round_off: 0,
      grand_total: 10000,
      paid_amount: 10000,
      outstanding_amount: 0,
      payment_mode: 'UPI',
      source_order_ids: ['order-1'],
      items: [
        {
          id: 'item-1',
          invoice_id: 'inv-1',
          product_id: 'prod-a',
          product_name: 'Product A 100ml',
          quantity: 240, // 10 boxes
          carton_qty: 10,
          loose_qty: 0,
          rate: 1000,
          discount: 0,
          taxable_value: 10000,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total_amount: 10000,
          packing: '24 units/carton',
          trading_unit: 'Box',
          hsn: '2202'
        }
      ]
    },
    // Invoice 2: Retailer B, Product A, 20 Boxes (480 pcs), Amount = ₹20,000, Date = 2026-09-15, Salesperson = Vikas, Channel = Company Salesperson, Godown = Branch Godown
    {
      id: 'inv-2',
      invoice_number: 'INV-2026-002',
      retailer_id: 'ret-b',
      business_id: 'biz-saifee',
      date: '2026-09-15',
      status: 'Finalized',
      place_of_supply: 'Branch Godown',
      subtotal: 20000,
      discount_amount: 0,
      taxable_value: 20000,
      cgst: 0,
      sgst: 0,
      igst: 0,
      round_off: 0,
      grand_total: 20000,
      paid_amount: 20000,
      outstanding_amount: 0,
      payment_mode: 'Bank Transfer',
      source_order_ids: ['order-2'],
      items: [
        {
          id: 'item-2',
          invoice_id: 'inv-2',
          product_id: 'prod-a',
          product_name: 'Product A 100ml',
          quantity: 480, // 20 boxes
          carton_qty: 20,
          loose_qty: 0,
          rate: 1000,
          discount: 0,
          taxable_value: 20000,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total_amount: 20000,
          packing: '24 units/carton',
          trading_unit: 'Box',
          hsn: '2202'
        }
      ]
    },
    // Invoice 3: Retailer A, Product B, 5 Boxes, Amount = ₹2,500, Date = 2026-09-20, Salesperson = Ramesh, Channel = Distributor Salesperson, Godown = Main Godown
    {
      id: 'inv-3',
      invoice_number: 'INV-2026-003',
      retailer_id: 'ret-a',
      business_id: 'biz-saifee',
      date: '2026-09-20',
      status: 'Finalized',
      place_of_supply: 'Main Godown',
      subtotal: 2500,
      discount_amount: 0,
      taxable_value: 2500,
      cgst: 0,
      sgst: 0,
      igst: 0,
      round_off: 0,
      grand_total: 2500,
      paid_amount: 2500,
      outstanding_amount: 0,
      payment_mode: 'Cash',
      source_order_ids: ['order-3'],
      items: [
        {
          id: 'item-3',
          invoice_id: 'inv-3',
          product_id: 'prod-b',
          product_name: 'Product B 500g',
          quantity: 60, // 5 boxes * 12
          carton_qty: 5,
          loose_qty: 0,
          rate: 500,
          discount: 0,
          taxable_value: 2500,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total_amount: 2500,
          packing: '12 units/carton',
          trading_unit: 'Box',
          hsn: '1905'
        }
      ]
    }
  ];

  // Orders linking invoices to Salespersons & Channels
  const mockOrders = [
    {
      id: 'order-1',
      order_number: 'ORD-001',
      retailer_id: 'ret-a',
      source: 'distributor_salesperson' as const,
      channel: 'Distributor Salesperson' as const,
      created_by: 'sp-ramesh',
      order_date: '2026-09-10',
      total_amount: 10000,
      status: 'Completed' as const,
      dispatch_godown: 'Main Godown'
    },
    {
      id: 'order-2',
      order_number: 'ORD-002',
      retailer_id: 'ret-b',
      source: 'company_salesperson' as const,
      channel: 'Company Salesperson' as const,
      created_by: 'sp-vikas',
      order_date: '2026-09-15',
      total_amount: 20000,
      status: 'Completed' as const,
      dispatch_godown: 'Branch Godown'
    },
    {
      id: 'order-3',
      order_number: 'ORD-003',
      retailer_id: 'ret-a',
      source: 'distributor_salesperson' as const,
      channel: 'Distributor Salesperson' as const,
      created_by: 'sp-ramesh',
      order_date: '2026-09-20',
      total_amount: 2500,
      status: 'Completed' as const,
      dispatch_godown: 'Main Godown'
    }
  ];

  // Purchases (Purchase source of truth)
  const mockPurchases: Purchase[] = [
    // Purchase 1: Supplier A, Product A, 20 Boxes (480 pcs), Amount = ₹16,000, Date = 2026-09-05, Godown = Main Godown
    {
      id: 'pur-1',
      invoice_number: 'PUR-2026-001',
      supplier_id: 'sup-a',
      business_id: 'biz-saifee',
      invoice_date: '2026-09-05',
      created_at: '2026-09-05T00:00:00Z',
      receiving_godown_id: 'gdn-main',
      status: 'Confirmed',
      total_amount: 16000,
      items: [
        {
          id: 'pitem-1',
          product_id: 'prod-a',
          quantity: 480, // 20 boxes * 24
          carton_qty: 20,
          loose_qty: 0,
          purchase_rate: 800,
          discount: 0,
          gst_percent: 0,
          units_per_box_carton: 24,
          trading_unit: 'Box',
          free_quantity: 0,
          mrp: 1200,
          hsn: '2202'
        }
      ]
    },
    // Purchase 2: Supplier B, Product A, 30 Boxes (720 pcs), Amount = ₹24,000, Date = 2026-09-08, Godown = Branch Godown
    {
      id: 'pur-2',
      invoice_number: 'PUR-2026-002',
      supplier_id: 'sup-b',
      business_id: 'biz-saifee',
      invoice_date: '2026-09-08',
      created_at: '2026-09-08T00:00:00Z',
      receiving_godown_id: 'gdn-branch',
      status: 'Confirmed',
      total_amount: 24000,
      items: [
        {
          id: 'pitem-2',
          product_id: 'prod-a',
          quantity: 720, // 30 boxes * 24
          carton_qty: 30,
          loose_qty: 0,
          purchase_rate: 800,
          discount: 0,
          gst_percent: 0,
          units_per_box_carton: 24,
          trading_unit: 'Box',
          free_quantity: 0,
          mrp: 1200,
          hsn: '2202'
        }
      ]
    }
  ];

  // Current Physical Inventory in Godowns (Rule 4, 25-27, 40, 44)
  // Product A: Main Godown = 25 Boxes (600 pcs, physical=600, reserved=24, available=576), Branch Godown = 15 Boxes (360 pcs)
  // Total Physical Stock across Godowns = 40 Boxes (960 pcs)
  const mockInventory = [
    {
      id: 'inv-a-main',
      product_id: 'prod-a',
      business_id: 'biz-saifee',
      godown_id: 'gdn-main',
      physical_qty: 600, // 25 boxes * 24
      reserved_qty: 24,  // 1 box reserved (available is 576, but Physical MUST be 600 / 25 Boxes)
      available_qty: 576,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-10-05T10:00:00Z'
    },
    {
      id: 'inv-a-branch',
      product_id: 'prod-a',
      business_id: 'biz-saifee',
      godown_id: 'gdn-branch',
      physical_qty: 360, // 15 boxes * 24
      reserved_qty: 0,
      available_qty: 360,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-10-05T10:00:00Z'
    },
    {
      id: 'inv-b-main',
      product_id: 'prod-b',
      business_id: 'biz-saifee',
      godown_id: 'gdn-main',
      physical_qty: 120, // 10 boxes * 12
      reserved_qty: 0,
      available_qty: 120,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-10-05T10:00:00Z'
    }
  ];

  const db: DbState = {
    products: mockProducts,
    retailers: mockRetailers,
    suppliers: mockSuppliers,
    godowns: mockGodowns,
    invoices: mockInvoices,
    purchases: mockPurchases,
    inventory: mockInventory,
    orders: mockOrders as any,
    profiles: mockProfiles,
    companies: [
      { id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true },
      { id: 'biz-other', name: 'Other Enterprise', code: 'OTH', active: true }
    ],
    salesReturns: [],
    fulfilments: [],
    payments: [],
    batches: [],
    ledger: []
  };

  const dummyContext: UserContext = { role: 'admin', companyId: 'biz-saifee' };

  let allPassed = true;
  const assert = (condition: boolean, testName: string, actual: any, expected: any) => {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName} -> Actual: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
      allPassed = false;
    }
  };

  // ----------------------------------------------------
  // CRITICAL ACCEPTANCE TEST 1: RULE 40 (Known Product A)
  // ----------------------------------------------------
  console.log('--- TEST 1: Rule 40 (Product A Known Totals) ---');
  {
    const filter: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30' };
    const res = getItemReportByParty(filter, db, dummyContext);
    const prodA = res.rows.find(r => r.productId === 'prod-a');
    
    // Product A had Sale = 10 Boxes (Inv 1) + 20 Boxes (Inv 2) = 30 Boxes, Amount = 30,000
    // Purchase = 20 Boxes (Pur 1) + 30 Boxes (Pur 2) = 50 Boxes, Amount = 40,000
    // Current Physical Inventory = 40 Boxes (Main 25 + Branch 15)
    assert(prodA?.saleQtyBase === 30, 'Product A Total Sale Qty Base = 30 Boxes', prodA?.saleQtyBase, 30);
    assert(prodA?.saleAmount === 30000, 'Product A Total Sale Amount = ₹30,000', prodA?.saleAmount, 30000);
    assert(prodA?.purchaseQtyBase === 50, 'Product A Total Purchase Qty Base = 50 Boxes', prodA?.purchaseQtyBase, 50);
    assert(prodA?.purchaseAmount === 40000, 'Product A Total Purchase Amount = ₹40,000', prodA?.purchaseAmount, 40000);
    assert(prodA?.closingInventoryBase === 40, 'Product A Total Closing Inventory = 40 Boxes', prodA?.closingInventoryBase, 40);
  }

  // ----------------------------------------------------
  // CRITICAL PARTY TEST: RULE 41 (Filter Retailer A)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Rule 41 (Filter Retailer A) ---');
  {
    const filter: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', retailerId: 'ret-a' };
    
    // 1. Party Report by Item
    const partyRes = getPartyItemReport(filter, db, dummyContext);
    assert(partyRes.rows.length === 1, 'Party Report has exactly 1 row for Retailer A', partyRes.rows.length, 1);
    const retA = partyRes.rows[0];
    assert(retA?.partyId === 'ret-a', 'Party row is Retailer A', retA?.partyId, 'ret-a');
    assert(retA?.saleQtyCartons === 15, 'Retailer A Total Sale Qty = 15 Boxes (Prod A 10 + Prod B 5)', retA?.saleQtyCartons, 15);
    assert(retA?.saleAmount === 12500, 'Retailer A Total Sale Amount = ₹12,500 (10,000 + 2,500)', retA?.saleAmount, 12500);
    assert(retA?.purchaseAmount === 0, 'Retailer A Purchase Amount = 0', retA?.purchaseAmount, 0);

    // 2. Item Report by Party (Retailer A filtered)
    const itemRes = getItemReportByParty(filter, db, dummyContext);
    const itemA = itemRes.rows.find(r => r.productId === 'prod-a');
    assert(itemA?.saleQtyBase === 10, 'Item Report: Product A Sale Qty for Retailer A = 10 Boxes', itemA?.saleQtyBase, 10);
    assert(itemA?.saleAmount === 10000, 'Item Report: Product A Sale Amount for Retailer A = ₹10,000', itemA?.saleAmount, 10000);
    assert(itemA?.closingInventoryBase === 40, 'Item Report: Product A Closing Inventory remains CURRENT physical stock (40 Boxes)', itemA?.closingInventoryBase, 40);
  }

  // ----------------------------------------------------
  // CRITICAL SUPPLIER TEST: RULE 42 (Filter Supplier A)
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Rule 42 (Filter Supplier A) ---');
  {
    const filter: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', retailerId: 'sup-a' };
    
    // 1. Party Report by Item
    const partyRes = getPartyItemReport(filter, db, dummyContext);
    assert(partyRes.rows.length === 1, 'Party Report has exactly 1 row for Supplier A', partyRes.rows.length, 1);
    const supA = partyRes.rows[0];
    assert(supA?.partyId === 'sup-a', 'Party row is Supplier A', supA?.partyId, 'sup-a');
    assert(supA?.purchaseQtyCartons === 20, 'Supplier A Purchase Qty = 20 Boxes', supA?.purchaseQtyCartons, 20);
    assert(supA?.purchaseAmount === 16000, 'Supplier A Purchase Amount = ₹16,000', supA?.purchaseAmount, 16000);
    assert(supA?.saleAmount === 0, 'Supplier A Sale Amount = 0', supA?.saleAmount, 0);

    // 2. Item Report by Party (Supplier A filtered)
    const itemRes = getItemReportByParty(filter, db, dummyContext);
    const itemA = itemRes.rows.find(r => r.productId === 'prod-a');
    assert(itemA?.purchaseQtyBase === 20, 'Item Report: Product A Purchase Qty for Supplier A = 20 Boxes', itemA?.purchaseQtyBase, 20);
    assert(itemA?.purchaseAmount === 16000, 'Item Report: Product A Purchase Amount for Supplier A = ₹16,000', itemA?.purchaseAmount, 16000);
  }

  // ----------------------------------------------------
  // CRITICAL CURRENT INVENTORY TEST: RULE 43 (Date Invariant)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Rule 43 (Closing Inventory Date Invariance) ---');
  {
    const filterSep: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30' };
    const resSep = getItemReportByParty(filterSep, db, dummyContext);
    const prodASep = resSep.rows.find(r => r.productId === 'prod-a');

    const filterJan: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-01-01', customEndDate: '2026-01-31' };
    const resJan = getItemReportByParty(filterJan, db, dummyContext);
    const prodAJan = resJan.rows.find(r => r.productId === 'prod-a');

    assert(prodASep?.closingInventoryBase === 40, 'Sep Date: Closing Inventory = 40 Boxes', prodASep?.closingInventoryBase, 40);
    assert(prodAJan?.closingInventoryBase === 40, 'Jan Date: Closing Inventory is STILL 40 Boxes (Date does NOT affect physical stock)', prodAJan?.closingInventoryBase, 40);
    assert(prodAJan?.saleAmount === 0, 'Jan Date: Sales Amount = 0 (Sales ARE filtered by date)', prodAJan?.saleAmount, 0);
  }

  // ----------------------------------------------------
  // CRITICAL GODOWN TEST: RULE 44 (Main vs Branch vs All)
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Rule 44 (Godown Filtering) ---');
  {
    // 1. Main Godown
    const filterMain: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', godown: 'Main Godown' };
    const resMain = getItemReportByParty(filterMain, db, dummyContext);
    const prodAMain = resMain.rows.find(r => r.productId === 'prod-a');
    assert(prodAMain?.closingInventoryBase === 25, 'Main Godown selected: Closing Inventory = 25 Boxes', prodAMain?.closingInventoryBase, 25);
    assert(prodAMain?.saleQtyBase === 10, 'Main Godown Sales = 10 Boxes (Inv 1)', prodAMain?.saleQtyBase, 10);

    // 2. Branch Godown
    const filterBranch: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', godown: 'Branch Godown' };
    const resBranch = getItemReportByParty(filterBranch, db, dummyContext);
    const prodABranch = resBranch.rows.find(r => r.productId === 'prod-a');
    assert(prodABranch?.closingInventoryBase === 15, 'Branch Godown selected: Closing Inventory = 15 Boxes', prodABranch?.closingInventoryBase, 15);
    assert(prodABranch?.saleQtyBase === 20, 'Branch Godown Sales = 20 Boxes (Inv 2)', prodABranch?.saleQtyBase, 20);

    // 3. All Godowns
    const filterAll: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', godown: 'all' };
    const resAll = getItemReportByParty(filterAll, db, dummyContext);
    const prodAAll = resAll.rows.find(r => r.productId === 'prod-a');
    assert(prodAAll?.closingInventoryBase === 40, 'All Godowns: Closing Inventory = 40 Boxes (25 + 15)', prodAAll?.closingInventoryBase, 40);
  }

  // ----------------------------------------------------
  // TEST MATRIX: SALESPERSON & CHANNEL FILTERS
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Salesperson & Channel Filters ---');
  {
    // Salesperson = Ramesh
    const filterRamesh: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', salespersonId: 'sp-ramesh' };
    const resRamesh = getPartyItemReport(filterRamesh, db, dummyContext);
    assert(resRamesh.summary.totalSaleAmount === 12500, 'Salesperson Ramesh: Total Sales = ₹12,500 (Inv 1 & 3)', resRamesh.summary.totalSaleAmount, 12500);

    // Salesperson = Vikas
    const filterVikas: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', salespersonId: 'sp-vikas' };
    const resVikas = getPartyItemReport(filterVikas, db, dummyContext);
    assert(resVikas.summary.totalSaleAmount === 20000, 'Salesperson Vikas: Total Sales = ₹20,000 (Inv 2)', resVikas.summary.totalSaleAmount, 20000);

    // Channel = Distributor Salesperson
    const filterChanDist: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', channel: 'Distributor Salesperson' };
    const resChanDist = getPartyItemReport(filterChanDist, db, dummyContext);
    assert(resChanDist.summary.totalSaleAmount === 12500, 'Channel Distributor Salesperson: Total Sales = ₹12,500', resChanDist.summary.totalSaleAmount, 12500);

    // Channel = Company Salesperson
    const filterChanCo: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', channel: 'Company Salesperson' };
    const resChanCo = getPartyItemReport(filterChanCo, db, dummyContext);
    assert(resChanCo.summary.totalSaleAmount === 20000, 'Channel Company Salesperson: Total Sales = ₹20,000', resChanCo.summary.totalSaleAmount, 20000);
  }

  // ----------------------------------------------------
  // TEST MATRIX: COMPLETE FILTER PERMUTATION (A through S)
  // ----------------------------------------------------
  console.log('\n--- TEST MATRIX 39: ALL FILTER PERMUTATIONS (A through S) ---');

  // A. No filters
  {
    const f: ReportFilterState = { datePreset: 'all' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.rows.length >= 2, 'Matrix A (No filters): Party Report Rows >= 2', pRes.rows.length >= 2, true);
    assert(iRes.rows.length >= 2, 'Matrix A (No filters): Item Report Rows >= 2', iRes.rows.length >= 2, true);
    assert(pRes.summary.totalSaleAmount === 32500, 'Matrix A: Total Sale Amount = ₹32,500', pRes.summary.totalSaleAmount, 32500);
    assert(pRes.summary.totalPurchaseAmount === 40000, 'Matrix A: Total Purchase Amount = ₹40,000', pRes.summary.totalPurchaseAmount, 40000);
  }

  // B. Date only
  {
    const f: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-12' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    // Sep 1 - Sep 12 has Inv 1 (Sep 10: ₹10,000) and Pur 1 (Sep 5: ₹16,000) & Pur 2 (Sep 8: ₹24,000)
    assert(pRes.summary.totalSaleAmount === 10000, 'Matrix B (Date only): Total Sale Amount = ₹10,000', pRes.summary.totalSaleAmount, 10000);
    assert(pRes.summary.totalPurchaseAmount === 40000, 'Matrix B (Date only): Total Purchase Amount = ₹40,000', pRes.summary.totalPurchaseAmount, 40000);
    // Closing inventory still current physical stock (40 boxes)
    const prodA = iRes.rows.find(r => r.productId === 'prod-a');
    assert(prodA?.closingInventoryBase === 40, 'Matrix B (Date only): Product A Closing Inventory = 40 Boxes', prodA?.closingInventoryBase, 40);
  }

  // C. Company only
  {
    const f: ReportFilterState = { datePreset: 'all', companyId: 'biz-saifee' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 32500, 'Matrix C (Company only): Total Sales = ₹32,500', pRes.summary.totalSaleAmount, 32500);
    assert(iRes.rows.every(r => r.companyId === 'biz-saifee' || !r.companyId), 'Matrix C: All rows belong to biz-saifee', true, true);
  }

  // D. Godown only
  {
    const f: ReportFilterState = { datePreset: 'all', godown: 'Main Godown' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    // Main Godown has Inv 1 (10,000), Inv 3 (2,500) = ₹12,500. Purchases = Pur 1 (₹16,000). Stock = 25 boxes.
    assert(pRes.summary.totalSaleAmount === 12500, 'Matrix D (Godown only): Total Sales = ₹12,500', pRes.summary.totalSaleAmount, 12500);
    assert(pRes.summary.totalPurchaseAmount === 16000, 'Matrix D (Godown only): Total Purchases = ₹16,000', pRes.summary.totalPurchaseAmount, 16000);
    const prodA = iRes.rows.find(r => r.productId === 'prod-a');
    assert(prodA?.closingInventoryBase === 25, 'Matrix D: Product A Godown Closing Stock = 25 Boxes', prodA?.closingInventoryBase, 25);
  }

  // E. Party only — Retailer
  {
    const f: ReportFilterState = { datePreset: 'all', retailerId: 'ret-a' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.rows.length === 1 && pRes.rows[0].partyId === 'ret-a', 'Matrix E (Party Retailer): Exactly Retailer A', true, true);
    assert(pRes.summary.totalSaleAmount === 12500, 'Matrix E: Retailer A Sales = ₹12,500', pRes.summary.totalSaleAmount, 12500);
    assert(pRes.summary.totalPurchaseAmount === 0, 'Matrix E: Retailer A Purchases = 0', pRes.summary.totalPurchaseAmount, 0);
  }

  // F. Party only — Supplier
  {
    const f: ReportFilterState = { datePreset: 'all', retailerId: 'sup-a' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.rows.length === 1 && pRes.rows[0].partyId === 'sup-a', 'Matrix F (Party Supplier): Exactly Supplier A', true, true);
    assert(pRes.summary.totalSaleAmount === 0, 'Matrix F: Supplier A Sales = 0', pRes.summary.totalSaleAmount, 0);
    assert(pRes.summary.totalPurchaseAmount === 16000, 'Matrix F: Supplier A Purchases = ₹16,000', pRes.summary.totalPurchaseAmount, 16000);
  }

  // G. Product only
  {
    const f: ReportFilterState = { datePreset: 'all', productId: 'prod-a' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 30000, 'Matrix G (Product only): Prod A Total Sales = ₹30,000', pRes.summary.totalSaleAmount, 30000);
    assert(pRes.summary.totalPurchaseAmount === 40000, 'Matrix G: Prod A Total Purchases = ₹40,000', pRes.summary.totalPurchaseAmount, 40000);
    assert(iRes.rows.length === 1 && iRes.rows[0].productId === 'prod-a', 'Matrix G: Item Report has 1 row', true, true);
  }

  // H. Salesperson only
  {
    const f: ReportFilterState = { datePreset: 'all', salespersonId: 'sp-ramesh' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 12500, 'Matrix H (Salesperson only): Ramesh Sales = ₹12,500', pRes.summary.totalSaleAmount, 12500);
  }

  // I. Channel only
  {
    const f: ReportFilterState = { datePreset: 'all', channel: 'Company Salesperson' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 20000, 'Matrix I (Channel only): Company Salesperson Sales = ₹20,000', pRes.summary.totalSaleAmount, 20000);
  }

  // J. Date + Party
  {
    const f: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-12', retailerId: 'ret-a' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 10000, 'Matrix J (Date + Party): Ret A Sales on Sep 1-12 = ₹10,000 (Inv 1)', pRes.summary.totalSaleAmount, 10000);
  }

  // K. Date + Product
  {
    const f: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-12', productId: 'prod-a' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 10000, 'Matrix K (Date + Product): Prod A Sales on Sep 1-12 = ₹10,000', pRes.summary.totalSaleAmount, 10000);
    assert(pRes.summary.totalPurchaseAmount === 40000, 'Matrix K: Prod A Purchases on Sep 1-12 = ₹40,000', pRes.summary.totalPurchaseAmount, 40000);
  }

  // L. Party + Product
  {
    const f: ReportFilterState = { datePreset: 'all', retailerId: 'ret-a', productId: 'prod-a' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 10000, 'Matrix L (Party + Product): Ret A + Prod A = ₹10,000', pRes.summary.totalSaleAmount, 10000);
    assert(iRes.rows.length === 1 && iRes.rows[0].saleAmount === 10000, 'Matrix L: Item Report Prod A = ₹10,000', true, true);
  }

  // M. Party + Salesperson
  {
    const f: ReportFilterState = { datePreset: 'all', retailerId: 'ret-a', salespersonId: 'sp-ramesh' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 12500, 'Matrix M (Party + Salesperson): Ret A + Ramesh = ₹12,500', pRes.summary.totalSaleAmount, 12500);
  }

  // N. Party + Channel
  {
    const f: ReportFilterState = { datePreset: 'all', retailerId: 'ret-b', channel: 'Company Salesperson' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 20000, 'Matrix N (Party + Channel): Ret B + Co Salesperson = ₹20,000', pRes.summary.totalSaleAmount, 20000);
  }

  // O. Product + Godown
  {
    const f: ReportFilterState = { datePreset: 'all', productId: 'prod-a', godown: 'Main Godown' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 10000, 'Matrix O (Product + Godown): Prod A in Main Godown Sales = ₹10,000', pRes.summary.totalSaleAmount, 10000);
    assert(pRes.summary.totalPurchaseAmount === 16000, 'Matrix O: Prod A in Main Godown Purchases = ₹16,000', pRes.summary.totalPurchaseAmount, 16000);
    const row = iRes.rows[0];
    assert(row?.closingInventoryBase === 25, 'Matrix O: Prod A Main Godown Stock = 25 Boxes', row?.closingInventoryBase, 25);
  }

  // P. Company + Godown
  {
    const f: ReportFilterState = { datePreset: 'all', companyId: 'biz-saifee', godown: 'Branch Godown' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 20000, 'Matrix P (Company + Godown): Branch Sales = ₹20,000', pRes.summary.totalSaleAmount, 20000);
    assert(pRes.summary.totalPurchaseAmount === 24000, 'Matrix P: Branch Purchases = ₹24,000', pRes.summary.totalPurchaseAmount, 24000);
    const prodA = iRes.rows.find(r => r.productId === 'prod-a');
    assert(prodA?.closingInventoryBase === 15, 'Matrix P: Prod A Branch Stock = 15 Boxes', prodA?.closingInventoryBase, 15);
  }

  // Q. Date + Party + Product
  {
    const f: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', retailerId: 'ret-a', productId: 'prod-b' };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 2500, 'Matrix Q (Date + Party + Product): Ret A + Prod B on Sep = ₹2,500', pRes.summary.totalSaleAmount, 2500);
  }

  // R. Date + Party + Salesperson + Channel
  {
    const f: ReportFilterState = { 
      datePreset: 'custom', 
      customStartDate: '2026-09-01', 
      customEndDate: '2026-09-30', 
      retailerId: 'ret-a', 
      salespersonId: 'sp-ramesh', 
      channel: 'Distributor Salesperson' 
    };
    const pRes = getPartyItemReport(f, db, dummyContext);
    assert(pRes.summary.totalSaleAmount === 12500, 'Matrix R (Date + Party + Salesperson + Channel): Ret A + Ramesh + Dist = ₹12,500', pRes.summary.totalSaleAmount, 12500);
  }

  // S. All filters together
  {
    const f: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      companyId: 'biz-saifee',
      godown: 'Main Godown',
      retailerId: 'ret-a',
      productId: 'prod-a',
      salespersonId: 'sp-ramesh',
      channel: 'Distributor Salesperson',
      category: 'Beverages'
    };
    const pRes = getPartyItemReport(f, db, dummyContext);
    const iRes = getItemReportByParty(f, db, dummyContext);
    assert(pRes.rows.length === 1, 'Matrix S (All filters together): Party Report has 1 row', pRes.rows.length, 1);
    assert(pRes.summary.totalSaleAmount === 10000, 'Matrix S: Total Sale Amount = ₹10,000', pRes.summary.totalSaleAmount, 10000);
    assert(iRes.rows.length === 1, 'Matrix S: Item Report has 1 row', iRes.rows.length, 1);
    assert(iRes.rows[0].saleAmount === 10000, 'Matrix S: Item Report Sale Amount = ₹10,000', iRes.rows[0].saleAmount, 10000);
    assert(iRes.rows[0].closingInventoryBase === 25, 'Matrix S: Item Report Godown Stock = 25 Boxes', iRes.rows[0].closingInventoryBase, 25);
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('ALL AUDIT & ACCEPTANCE MATRIX TESTS PASSED PERFECTLY! ✅');
  } else {
    console.error('SOME ACCEPTANCE MATRIX TESTS FAILED! ❌');
    process.exit(1);
  }
  console.log('====================================================\n');
}

runComprehensiveAudit();
