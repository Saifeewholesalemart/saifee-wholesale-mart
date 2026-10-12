import { 
  getPartyItemReport, 
  getItemReportByParty,
  getPurchaseSummary,
  getPurchaseRateHistory,
  DbState, 
  UserContext, 
  ReportFilterState 
} from '../reportsEngine';
import { 
  Invoice, 
  Product, 
  Retailer, 
  Purchase, 
  Supplier,
  Inventory
} from '../db';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

export function runMultiSupplierPurchaseTests() {
  console.log('====================================================');
  console.log('RUNNING COMPREHENSIVE MULTI-SUPPLIER PURCHASE TESTS');
  console.log('====================================================\n');

  const adminContext: UserContext = { role: 'admin' };

  // Base Products
  const mockProducts: Product[] = [
    {
      id: 'prod-coragen-250',
      product_code: 'COR250',
      name: 'Coragen 250ml',
      company_id: 'biz-saifee',
      brand: 'FMCG Agri',
      category: 'Pesticides',
      pack_size: '250ml',
      packing_display: '250ml pack',
      trading_unit: 'Box',
      units_per_box_carton: 1,
      mrp: 1000,
      selling_price: 950,
      purchase_price: 800,
      gst_percent: 18,
      hsn: '3808',
      sku: 'SKU-COR250',
      barcode: '12345678',
      active: true
    },
    {
      id: 'prod-coragen-100',
      product_code: 'COR100',
      name: 'Coragen 100ml',
      company_id: 'biz-saifee',
      brand: 'FMCG Agri',
      category: 'Pesticides',
      pack_size: '100ml',
      packing_display: '100ml pack',
      trading_unit: 'Box',
      units_per_box_carton: 1,
      mrp: 500,
      selling_price: 450,
      purchase_price: 400,
      gst_percent: 18,
      hsn: '3808',
      sku: 'SKU-COR100',
      barcode: '12345679',
      active: true
    },
    {
      id: 'prod-parle-g',
      product_code: 'PARLEG',
      name: 'Parle-G 100g',
      company_id: 'biz-saifee',
      brand: 'Parle',
      category: 'Biscuits',
      pack_size: '100g',
      packing_display: '100g pack',
      trading_unit: 'Box',
      units_per_box_carton: 1,
      mrp: 100,
      selling_price: 90,
      purchase_price: 80,
      gst_percent: 18,
      hsn: '1905',
      sku: 'SKU-PARLEG',
      barcode: '98765432',
      active: true
    }
  ];

  // Base Suppliers (5 Suppliers)
  const mockSuppliers: Supplier[] = [
    { id: 's-prashant-medico', name: 'Prashant Medico', gstin: '27PRASH1234M1Z5', address: 'Indore', active: true, business_id: 'biz-saifee' },
    { id: 's-abc-pharma', name: 'ABC Pharma', gstin: '27ABCPH9012F1Z3', address: 'Indore', active: true, business_id: 'biz-saifee' },
    { id: 's-xyz-distributors', name: 'XYZ Distributors', gstin: '27XYZDI3456G1Z4', address: 'Indore', active: true, business_id: 'biz-saifee' },
    { id: 's-shree-medical', name: 'Shree Medical', gstin: '27SHREE7890H1Z5', address: 'Indore', active: true, business_id: 'biz-saifee' },
    { id: 's-johnson-aadesh', name: 'Johnson Aadesh Enterprises', gstin: '27JOHNA5678E1Z2', address: 'Indore', active: true, business_id: 'biz-saifee' }
  ];

  // Base Retailers
  const mockRetailers: Retailer[] = [
    {
      id: 'ret-abc-traders',
      retailer_code: 'RET-001',
      shop_name: 'ABC Traders',
      owner_name: 'Amit Patel',
      address: 'Indore',
      city: 'Indore',
      state_code: '27',
      mobile: '9826111111',
      credit_limit: 100000,
      outstanding: 0,
      active: true,
      business_id: 'biz-saifee'
    },
    {
      id: 'ret-shree-ganesh',
      retailer_code: 'RET-002',
      shop_name: 'Shree Ganesh Super Market',
      owner_name: 'Ganesh Patel',
      address: 'Indore',
      city: 'Indore',
      state_code: '27',
      mobile: '9826222222',
      credit_limit: 150000,
      outstanding: 0,
      active: true,
      business_id: 'biz-saifee'
    }
  ];

  const mockInventory: Inventory[] = [
    {
      id: 'inv-1',
      business_id: 'biz-saifee',
      product_id: 'prod-coragen-250',
      godown_id: 'gdn-saifee-main',
      physical_qty: 50,
      available_qty: 50,
      reserved_qty: 0,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-10-01T00:00:00Z'
    },
    {
      id: 'inv-2',
      business_id: 'biz-saifee',
      product_id: 'prod-coragen-100',
      godown_id: 'gdn-saifee-main',
      physical_qty: 80,
      available_qty: 80,
      reserved_qty: 0,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-10-01T00:00:00Z'
    },
    {
      id: 'inv-3',
      business_id: 'biz-saifee',
      product_id: 'prod-parle-g',
      godown_id: 'gdn-saifee-main',
      physical_qty: 120,
      available_qty: 120,
      reserved_qty: 0,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-10-01T00:00:00Z'
    }
  ];

  // Purchases across 3 suppliers:
  // Prashant Medico: 10 Boxes of Coragen 250ml @ 1,000 = 10,000
  // ABC Pharma: 20 Boxes of Coragen 250ml @ 1,000 = 20,000
  // XYZ Distributors: 30 Boxes of Coragen 250ml @ 1,000 = 30,000
  const mockPurchases: Purchase[] = ([
    {
      id: 'pur-1',
      business_id: 'biz-saifee',
      supplier_id: 's-prashant-medico',
      invoice_number: 'PUR-PRASH-01',
      invoice_date: '2026-09-10',
      created_at: '2026-09-10T00:00:00Z',
      total_amount: 10000,
      status: 'Confirmed',
      receiving_godown_id: 'gdn-saifee-main',
      items: [
        {
          id: 'pitem-1',
          purchase_id: 'pur-1',
          product_id: 'prod-coragen-250',
          quantity: 10,
          carton_qty: 10,
          loose_qty: 0,
          purchase_rate: 1000,
          gst_percent: 0,
          total_amount: 10000
        } as any
      ]
    },
    {
      id: 'pur-2',
      business_id: 'biz-saifee',
      supplier_id: 's-abc-pharma',
      invoice_number: 'PUR-ABC-01',
      invoice_date: '2026-09-15',
      total_amount: 20000,
      status: 'Confirmed',
      receiving_godown_id: 'gdn-saifee-main',
      items: [
        {
          id: 'pitem-2',
          purchase_id: 'pur-2',
          product_id: 'prod-coragen-250',
          quantity: 20,
          carton_qty: 20,
          loose_qty: 0,
          purchase_rate: 1000,
          gst_percent: 0,
          total_amount: 20000
        } as any
      ]
    },
    {
      id: 'pur-3',
      business_id: 'biz-saifee',
      supplier_id: 's-xyz-distributors',
      invoice_number: 'PUR-XYZ-01',
      invoice_date: '2026-09-20',
      total_amount: 30000,
      status: 'Confirmed',
      receiving_godown_id: 'gdn-saifee-main',
      items: [
        {
          id: 'pitem-3',
          purchase_id: 'pur-3',
          product_id: 'prod-coragen-250',
          quantity: 30,
          carton_qty: 30,
          loose_qty: 0,
          purchase_rate: 1000,
          gst_percent: 0,
          total_amount: 30000
        } as any
      ]
    },
    // Draft purchase (must be excluded)
    {
      id: 'pur-draft',
      business_id: 'biz-saifee',
      supplier_id: 's-shree-medical',
      invoice_number: 'PUR-DRAFT-01',
      invoice_date: '2026-09-22',
      total_amount: 5000,
      status: 'Draft',
      receiving_godown_id: 'gdn-saifee-main',
      items: [
        {
          id: 'pitem-draft',
          purchase_id: 'pur-draft',
          product_id: 'prod-coragen-250',
          quantity: 5,
          carton_qty: 5,
          loose_qty: 0,
          purchase_rate: 1000,
          gst_percent: 0,
          total_amount: 5000
        } as any
      ]
    },
    // Cancelled purchase (must be excluded)
    {
      id: 'pur-cancelled',
      business_id: 'biz-saifee',
      supplier_id: 's-johnson-aadesh',
      invoice_number: 'PUR-CANC-01',
      invoice_date: '2026-09-25',
      total_amount: 8000,
      status: 'Cancelled' as any,
      receiving_godown_id: 'gdn-saifee-main',
      items: [
        {
          id: 'pitem-cancelled',
          purchase_id: 'pur-cancelled',
          product_id: 'prod-coragen-250',
          quantity: 8,
          carton_qty: 8,
          loose_qty: 0,
          purchase_rate: 1000,
          gst_percent: 0,
          total_amount: 8000
        } as any
      ]
    }
  ] as any) as Purchase[];

  // Invoices (Sales)
  const mockInvoices: Invoice[] = [
    {
      id: 'inv-sale-1',
      invoice_number: 'INV-001',
      retailer_id: 'ret-abc-traders',
      date: '2026-09-12',
      grand_total: 9500,
      paid_amount: 9500,
      outstanding_amount: 0,
      status: 'Finalized',
      items: [
        {
          id: 'sitem-1',
          invoice_id: 'inv-sale-1',
          product_id: 'prod-coragen-250',
          quantity: 10,
          carton_qty: 10,
          loose_qty: 0,
          rate: 950,
          unit_rate: 950,
          carton_rate: 950,
          taxable_value: 9500,
          gst_percent: 0,
          total_amount: 9500
        } as any
      ]
    } as any
  ];

  const db: DbState = {
    invoices: mockInvoices,
    orders: [],
    fulfilments: [],
    products: mockProducts,
    retailers: mockRetailers,
    companies: [{ id: 'biz-saifee', name: 'Saifee General Stores' } as any],
    profiles: [],
    purchases: mockPurchases,
    payments: [],
    salesReturns: [],
    batches: [],
    inventory: mockInventory,
    ledger: [],
    suppliers: mockSuppliers,
    godowns: [{ id: 'gdn-saifee-main', name: 'Main Godown', code: 'GD01' }]
  };

  // =========================================================================
  // TEST 1: Party = All Parties in Party Report by Item
  // Expected: Purchase Qty = 60 (10 + 20 + 30), Purchase Amount = ₹60,000
  // =========================================================================
  console.log('\n--- TEST 1: Party = All Parties in Party Report by Item ---');
  {
    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 'all'
    };

    const res = getPartyItemReport(filter, db, adminContext);
    assert(res.summary.totalPurchaseQty === 60, `Total Purchase Qty across all suppliers should be 60, got ${res.summary.totalPurchaseQty}`);
    assert(res.summary.totalPurchaseAmount === 60000, `Total Purchase Amount across all suppliers should be 60000, got ${res.summary.totalPurchaseAmount}`);
    
    // Check individual supplier rows
    const prashantRow = res.rows.find(r => r.partyName === 'Prashant Medico' || r.partyId === 's-prashant-medico');
    const abcRow = res.rows.find(r => r.partyName === 'ABC Pharma' || r.partyId === 's-abc-pharma');
    const xyzRow = res.rows.find(r => r.partyName === 'XYZ Distributors' || r.partyId === 's-xyz-distributors');

    assert(!!prashantRow && prashantRow.purchaseQty === 10, 'Prashant Medico row has 10 purchase qty');
    assert(!!abcRow && abcRow.purchaseQty === 20, 'ABC Pharma row has 20 purchase qty');
    assert(!!xyzRow && xyzRow.purchaseQty === 30, 'XYZ Distributors row has 30 purchase qty');
  }

  // =========================================================================
  // TEST 2: Party = All Parties in Item Report by Party
  // Expected: Coragen 250ml Purchase Qty = 60, Purchase Amount = ₹60,000
  // =========================================================================
  console.log('\n--- TEST 2: Party = All Parties in Item Report by Party ---');
  {
    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 'all'
    };

    const res = getItemReportByParty(filter, db, adminContext);
    const coragenRow = res.rows.find(r => r.productId === 'prod-coragen-250');
    assert(!!coragenRow, 'Coragen 250ml row exists');
    assert(coragenRow?.purchaseQtyBase === 60, `Coragen 250ml Purchase Qty is 60, got ${coragenRow?.purchaseQtyBase}`);
    assert(coragenRow?.purchaseAmount === 60000, `Coragen 250ml Purchase Amount is 60000, got ${coragenRow?.purchaseAmount}`);
    assert(res.summary.totalPurchaseQtyPieces === 60, `Summary total purchase qty is 60, got ${res.summary.totalPurchaseQtyPieces}`);
    assert(res.summary.totalPurchaseAmount === 60000, `Summary total purchase amount is 60000, got ${res.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 3: Specific Supplier Filter (Party = Prashant Medico)
  // Expected: Purchase Qty = 10, Purchase Amount = ₹10,000
  // =========================================================================
  console.log('\n--- TEST 3: Specific Supplier Filter (Party = Prashant Medico) ---');
  {
    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 's-prashant-medico'
    };

    const resPartyItem = getPartyItemReport(filter, db, adminContext);
    assert(resPartyItem.summary.totalPurchaseQty === 10, `Party Report: Prashant Medico purchase qty is 10, got ${resPartyItem.summary.totalPurchaseQty}`);
    assert(resPartyItem.summary.totalPurchaseAmount === 10000, `Party Report: Prashant Medico purchase amount is 10000, got ${resPartyItem.summary.totalPurchaseAmount}`);

    const resItemParty = getItemReportByParty(filter, db, adminContext);
    assert(resItemParty.summary.totalPurchaseQtyPieces === 10, `Item Report: Prashant Medico purchase qty is 10, got ${resItemParty.summary.totalPurchaseQtyPieces}`);
    assert(resItemParty.summary.totalPurchaseAmount === 10000, `Item Report: Prashant Medico purchase amount is 10000, got ${resItemParty.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 4: Specific Supplier Filter (Party = ABC Pharma)
  // Expected: Purchase Qty = 20, Purchase Amount = ₹20,000
  // =========================================================================
  console.log('\n--- TEST 4: Specific Supplier Filter (Party = ABC Pharma) ---');
  {
    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 's-abc-pharma'
    };

    const resPartyItem = getPartyItemReport(filter, db, adminContext);
    assert(resPartyItem.summary.totalPurchaseQty === 20, `Party Report: ABC Pharma purchase qty is 20, got ${resPartyItem.summary.totalPurchaseQty}`);
    assert(resPartyItem.summary.totalPurchaseAmount === 20000, `Party Report: ABC Pharma purchase amount is 20000, got ${resPartyItem.summary.totalPurchaseAmount}`);

    const resItemParty = getItemReportByParty(filter, db, adminContext);
    assert(resItemParty.summary.totalPurchaseQtyPieces === 20, `Item Report: ABC Pharma purchase qty is 20, got ${resItemParty.summary.totalPurchaseQtyPieces}`);
    assert(resItemParty.summary.totalPurchaseAmount === 20000, `Item Report: ABC Pharma purchase amount is 20000, got ${resItemParty.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 5: Specific Supplier Filter (Party = XYZ Distributors)
  // Expected: Purchase Qty = 30, Purchase Amount = ₹30,000
  // =========================================================================
  console.log('\n--- TEST 5: Specific Supplier Filter (Party = XYZ Distributors) ---');
  {
    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 's-xyz-distributors'
    };

    const resPartyItem = getPartyItemReport(filter, db, adminContext);
    assert(resPartyItem.summary.totalPurchaseQty === 30, `Party Report: XYZ Distributors purchase qty is 30, got ${resPartyItem.summary.totalPurchaseQty}`);
    assert(resPartyItem.summary.totalPurchaseAmount === 30000, `Party Report: XYZ Distributors purchase amount is 30000, got ${resPartyItem.summary.totalPurchaseAmount}`);

    const resItemParty = getItemReportByParty(filter, db, adminContext);
    assert(resItemParty.summary.totalPurchaseQtyPieces === 30, `Item Report: XYZ Distributors purchase qty is 30, got ${resItemParty.summary.totalPurchaseQtyPieces}`);
    assert(resItemParty.summary.totalPurchaseAmount === 30000, `Item Report: XYZ Distributors purchase amount is 30000, got ${resItemParty.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 6: Retailer Filter (Party = ABC Traders)
  // Expected: Retailer Sales = 10 units / ₹9,500, Purchase Qty = 0, Pur Amt = 0 (MUST NOT DEFAULT TO PRASHANT MEDICO)
  // =========================================================================
  console.log('\n--- TEST 6: Retailer Filter (Party = ABC Traders) ---');
  {
    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 'ret-abc-traders'
    };

    const resPartyItem = getPartyItemReport(filter, db, adminContext);
    assert(resPartyItem.summary.totalSaleQty === 10, `Party Report: Sale Qty for ABC Traders is 10, got ${resPartyItem.summary.totalSaleQty}`);
    assert(resPartyItem.summary.totalSaleAmount === 9500, `Party Report: Sale Amount for ABC Traders is 9500, got ${resPartyItem.summary.totalSaleAmount}`);
    assert(resPartyItem.summary.totalPurchaseQty === 0, `Party Report: Purchase Qty for Retailer ABC Traders is 0 (NOT Prashant Medico), got ${resPartyItem.summary.totalPurchaseQty}`);
    assert(resPartyItem.summary.totalPurchaseAmount === 0, `Party Report: Purchase Amount for Retailer ABC Traders is 0, got ${resPartyItem.summary.totalPurchaseAmount}`);

    const resItemParty = getItemReportByParty(filter, db, adminContext);
    assert(resItemParty.summary.totalSaleQtyPieces === 10, `Item Report: Sale Qty for ABC Traders is 10, got ${resItemParty.summary.totalSaleQtyPieces}`);
    assert(resItemParty.summary.totalPurchaseQtyPieces === 0, `Item Report: Purchase Qty for Retailer ABC Traders is 0, got ${resItemParty.summary.totalPurchaseQtyPieces}`);
    assert(resItemParty.summary.totalPurchaseAmount === 0, `Item Report: Purchase Amount for Retailer ABC Traders is 0, got ${resItemParty.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 7: Multi-Product and Multi-Variant Aggregation across Multiple Suppliers
  // =========================================================================
  console.log('\n--- TEST 7: Multi-Product and Multi-Variant Aggregation ---');
  {
    const multiProdPurchases: Purchase[] = ([
      // Product A 100ml: Supp 1 = 10, Supp 2 = 20 -> 30
      {
        id: 'pur-mp-1',
        business_id: 'biz-saifee',
        supplier_id: 's-prashant-medico',
        invoice_number: 'PUR-MP-01',
        invoice_date: '2026-09-05',
        total_amount: 4000,
        status: 'Confirmed',
        items: [{ id: 'p-1', purchase_id: 'pur-mp-1', product_id: 'prod-coragen-100', quantity: 10, carton_qty: 10, loose_qty: 0, purchase_rate: 400, taxable_value: 4000, gst_percent: 0, total_amount: 4000 } as any]
      },
      {
        id: 'pur-mp-2',
        business_id: 'biz-saifee',
        supplier_id: 's-abc-pharma',
        invoice_number: 'PUR-MP-02',
        invoice_date: '2026-09-06',
        total_amount: 8000,
        status: 'Confirmed',
        items: [{ id: 'p-2', purchase_id: 'pur-mp-2', product_id: 'prod-coragen-100', quantity: 20, carton_qty: 20, loose_qty: 0, purchase_rate: 400, taxable_value: 8000, gst_percent: 0, total_amount: 8000 } as any]
      },
      // Product A 250ml: Supp 1 = 30, Supp 2 = 40 -> 70
      {
        id: 'pur-mp-3',
        business_id: 'biz-saifee',
        supplier_id: 's-prashant-medico',
        invoice_number: 'PUR-MP-03',
        invoice_date: '2026-09-07',
        total_amount: 24000,
        status: 'Confirmed',
        items: [{ id: 'p-3', purchase_id: 'pur-mp-3', product_id: 'prod-coragen-250', quantity: 30, carton_qty: 30, loose_qty: 0, purchase_rate: 800, taxable_value: 24000, gst_percent: 0, total_amount: 24000 } as any]
      },
      {
        id: 'pur-mp-4',
        business_id: 'biz-saifee',
        supplier_id: 's-xyz-distributors',
        invoice_number: 'PUR-MP-04',
        invoice_date: '2026-09-08',
        total_amount: 32000,
        status: 'Confirmed',
        items: [{ id: 'p-4', purchase_id: 'pur-mp-4', product_id: 'prod-coragen-250', quantity: 40, carton_qty: 40, loose_qty: 0, purchase_rate: 800, taxable_value: 32000, gst_percent: 0, total_amount: 32000 } as any]
      },
      // Product B (Parle G): Supp 1 = 30, Supp 2 = 40 -> 70
      {
        id: 'pur-mp-5',
        business_id: 'biz-saifee',
        supplier_id: 's-shree-medical',
        invoice_number: 'PUR-MP-05',
        invoice_date: '2026-09-09',
        total_amount: 2400,
        status: 'Confirmed',
        items: [{ id: 'p-5', purchase_id: 'pur-mp-5', product_id: 'prod-parle-g', quantity: 30, carton_qty: 30, loose_qty: 0, purchase_rate: 80, taxable_value: 2400, gst_percent: 0, total_amount: 2400 } as any]
      },
      {
        id: 'pur-mp-6',
        business_id: 'biz-saifee',
        supplier_id: 's-johnson-aadesh',
        invoice_number: 'PUR-MP-06',
        invoice_date: '2026-09-10',
        created_at: '2026-09-10T00:00:00Z',
        total_amount: 3200,
        status: 'Confirmed',
        items: [{ id: 'p-6', purchase_id: 'pur-mp-6', product_id: 'prod-parle-g', quantity: 40, carton_qty: 40, loose_qty: 0, purchase_rate: 80, taxable_value: 3200, gst_percent: 0, total_amount: 3200 } as any]
      }
    ] as any) as Purchase[];

    const dbMulti: DbState = {
      ...db,
      purchases: multiProdPurchases
    };

    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 'all'
    };

    const res = getItemReportByParty(filter, dbMulti, adminContext);
    const r100 = res.rows.find(r => r.productId === 'prod-coragen-100');
    const r250 = res.rows.find(r => r.productId === 'prod-coragen-250');
    const rParle = res.rows.find(r => r.productId === 'prod-parle-g');

    assert(r100?.purchaseQtyBase === 30, `Product A 100ml purchase qty is 30, got ${r100?.purchaseQtyBase}`);
    assert(r250?.purchaseQtyBase === 70, `Product A 250ml purchase qty is 70, got ${r250?.purchaseQtyBase}`);
    assert(rParle?.purchaseQtyBase === 70, `Product B (Parle-G) purchase qty is 70, got ${rParle?.purchaseQtyBase}`);
    assert(res.summary.totalPurchaseQtyPieces === 170, `Total Purchase Qty across all products is 170, got ${res.summary.totalPurchaseQtyPieces}`);
    assert(res.summary.totalPurchaseAmount === 73600, `Total Purchase Amount across all products is 73600, got ${res.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 8: getPurchaseSummary and getPurchaseRateHistory
  // =========================================================================
  console.log('\n--- TEST 8: Inward Purchase Register & Rate History Multi-Supplier ---');
  {
    const filterAll: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 'all'
    };
    const purSummary = getPurchaseSummary(filterAll, db, adminContext);
    assert(purSummary.length === 3, `Purchase Summary should have 3 confirmed purchases, got ${purSummary.length}`);
    const totQty = purSummary.reduce((sum, r) => sum + r.totalQuantity, 0);
    assert(totQty === 60, `Purchase Summary total quantity is 60, got ${totQty}`);

    const filterPrashant: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 's-prashant-medico'
    };
    const purPrashant = getPurchaseSummary(filterPrashant, db, adminContext);
    assert(purPrashant.length === 1, `Purchase Summary for Prashant Medico has 1 row, got ${purPrashant.length}`);
    assert(purPrashant[0].totalQuantity === 10, `Purchase Summary for Prashant Medico total quantity is 10, got ${purPrashant[0].totalQuantity}`);
  }

  // =========================================================================
  // TEST 9: Closing Inventory Invariance
  // =========================================================================
  console.log('\n--- TEST 9: Closing Inventory Invariance ---');
  {
    const filterAll: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', retailerId: 'all' };
    const filterPrashant: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', retailerId: 's-prashant-medico' };
    const filterABC: ReportFilterState = { datePreset: 'custom', customStartDate: '2026-09-01', customEndDate: '2026-09-30', retailerId: 's-abc-pharma' };

    const resAll = getItemReportByParty(filterAll, db, adminContext);
    const resPrashant = getItemReportByParty(filterPrashant, db, adminContext);
    const resABC = getItemReportByParty(filterABC, db, adminContext);

    const stockAll = resAll.rows.find(r => r.productId === 'prod-coragen-250')?.physicalStockPieces;
    const stockPrashant = resPrashant.rows.find(r => r.productId === 'prod-coragen-250')?.physicalStockPieces;
    const stockABC = resABC.rows.find(r => r.productId === 'prod-coragen-250')?.physicalStockPieces;

    assert(stockAll === 50, `Closing stock for Coragen 250ml in All Parties is 50, got ${stockAll}`);
    assert(stockPrashant === 50, `Closing stock for Coragen 250ml in Prashant Medico is 50, got ${stockPrashant}`);
    assert(stockABC === 50, `Closing stock for Coragen 250ml in ABC Pharma is 50, got ${stockABC}`);
  }

  // =========================================================================
  // TEST 10: Net Purchase Amount & Net Rate (Exclusive of GST) Verification
  // =========================================================================
  console.log('\n--- TEST 10: Net Purchase Amount & Net Rate (Exclusive of GST) ---');
  {
    const gstPurchases: Purchase[] = ([
      {
        id: 'pur-gst-1',
        business_id: 'biz-saifee',
        supplier_id: 's-prashant-medico',
        invoice_number: 'PUR-GST-01',
        invoice_date: '2026-09-10',
        created_at: '2026-09-10T00:00:00Z',
        total_amount: 11800, // 10,000 + 18% GST (1,800)
        status: 'Confirmed',
        receiving_godown_id: 'gdn-saifee-main',
        items: [
          {
            id: 'pitem-gst-1',
            purchase_id: 'pur-gst-1',
            product_id: 'prod-coragen-250',
            quantity: 10,
            carton_qty: 10,
            loose_qty: 0,
            purchase_rate: 1000,
            taxable_value: 10000,
            gst_percent: 18,
            cgst: 900,
            sgst: 900,
            total_amount: 11800
          } as any
        ]
      }
    ] as any) as Purchase[];

    const dbGst: DbState = {
      ...db,
      purchases: gstPurchases
    };

    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      retailerId: 'all'
    };

    // 1. Party Report by Item
    const resParty = getPartyItemReport(filter, dbGst, adminContext);
    const prashantRow = resParty.rows.find(r => r.partyId === 's-prashant-medico');
    assert(!!prashantRow, 'Prashant Medico row exists');
    assert(prashantRow?.purchaseAmount === 10000, `Party Report purchaseAmount is Net ₹10,000 (NOT inclusive ₹11,800), got ${prashantRow?.purchaseAmount}`);
    assert(prashantRow?.avgPurchaseRate === 1000, `Party Report avgPurchaseRate is Net ₹1,000 (NOT inclusive ₹1,180), got ${prashantRow?.avgPurchaseRate}`);
    assert(resParty.summary.totalPurchaseAmount === 10000, `Party Report summary totalPurchaseAmount is Net ₹10,000, got ${resParty.summary.totalPurchaseAmount}`);

    // 2. Item Report by Party
    const resItem = getItemReportByParty(filter, dbGst, adminContext);
    const coragenRow = resItem.rows.find(r => r.productId === 'prod-coragen-250');
    assert(!!coragenRow, 'Coragen row exists');
    assert(coragenRow?.purchaseAmount === 10000, `Item Report purchaseAmount is Net ₹10,000 (NOT inclusive ₹11,800), got ${coragenRow?.purchaseAmount}`);
    assert(coragenRow?.avgPurchaseRate === 1000, `Item Report avgPurchaseRate is Net ₹1,000, got ${coragenRow?.avgPurchaseRate}`);
    assert(resItem.summary.totalPurchaseAmount === 10000, `Item Report summary totalPurchaseAmount is Net ₹10,000, got ${resItem.summary.totalPurchaseAmount}`);
  }

  // =========================================================================
  // TEST 11: Net Selling Rate & Avg Selling Rate (Exclusive of GST) Verification
  // =========================================================================
  console.log('\n--- TEST 11: Net Selling Rate & Avg Selling Rate (Exclusive of GST) ---');
  {
    const gstInvoices: Invoice[] = ([
      {
        id: 'inv-gst-1',
        invoice_number: 'INV-GST-01',
        retailer_id: 'ret-abc-traders',
        date: '2026-09-12',
        subtotal: 9500,
        taxable_value: 9500, // 10 boxes @ 950
        cgst: 855,
        sgst: 855,
        grand_total: 11210, // 9,500 + 18% GST (1,710)
        paid_amount: 11210,
        outstanding_amount: 0,
        status: 'Finalized',
        items: [
          {
            id: 'sitem-gst-1',
            invoice_id: 'inv-gst-1',
            product_id: 'prod-coragen-250',
            quantity: 10,
            carton_qty: 10,
            loose_qty: 0,
            rate: 950,
            unit_rate: 950,
            carton_rate: 950,
            taxable_value: 9500,
            gst_percent: 18,
            cgst: 855,
            sgst: 855,
            total_amount: 11210
          } as any
        ]
      }
    ] as any) as Invoice[];

    const dbSalesGst: DbState = {
      ...db,
      invoices: gstInvoices,
      purchases: []
    };

    const filter: ReportFilterState = {
      datePreset: 'custom',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
      productId: 'prod-coragen-250'
    };

    // 1. Party Report by Item
    const resParty = getPartyItemReport(filter, dbSalesGst, adminContext);
    const abcRow = resParty.rows.find(r => r.partyId === 'ret-abc-traders');
    assert(!!abcRow, 'ABC Traders row exists');
    assert(abcRow?.saleAmount === 9500, `Party Report saleAmount is Net ₹9,500 (NOT inclusive ₹11,210), got ${abcRow?.saleAmount}`);
    assert(abcRow?.avgBillingRate === 950, `Party Report avgBillingRate is Net ₹950 (NOT inclusive ₹1,121), got ${abcRow?.avgBillingRate}`);
    assert(resParty.summary.totalSaleAmount === 9500, `Party Report summary totalSaleAmount is Net ₹9,500, got ${resParty.summary.totalSaleAmount}`);

    // 2. Item Report by Party
    const resItem = getItemReportByParty(filter, dbSalesGst, adminContext);
    const coragenRow = resItem.rows.find(r => r.productId === 'prod-coragen-250');
    assert(!!coragenRow, 'Coragen row exists');
    assert(coragenRow?.saleAmount === 9500, `Item Report saleAmount is Net ₹9,500 (NOT inclusive ₹11,210), got ${coragenRow?.saleAmount}`);
    assert(coragenRow?.avgSaleRate === 950, `Item Report avgSaleRate is Net ₹950, got ${coragenRow?.avgSaleRate}`);
    assert(resItem.summary.totalSaleAmount === 9500, `Item Report summary totalSaleAmount is Net ₹9,500, got ${resItem.summary.totalSaleAmount}`);
  }

  console.log('\n====================================================');
  console.log('ALL MULTI-SUPPLIER PURCHASE TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runMultiSupplierPurchaseTests();
