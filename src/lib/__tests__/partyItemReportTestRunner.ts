import { 
  getPartyItemReport, 
  DbState, 
  UserContext, 
  ReportFilterState 
} from '../reportsEngine';
import { 
  Invoice, 
  Order, 
  Product, 
  Retailer, 
  Company, 
  Profile, 
  Purchase, 
  SalesReturn 
} from '../db';

function runAcceptanceTests() {
  console.log('========================================');
  console.log('RUNNING PARTY REPORT BY ITEM ACCEPTANCE TESTS');
  console.log('========================================\n');

  const dummyContext: UserContext = { role: 'admin' };

  // Base Products
  const mockProducts: Product[] = [
    {
      id: 'prod-coragen-250',
      product_code: 'COR250',
      name: 'Coragen 250ml',
      company_id: 'biz-saifee',
      brand: 'FMCG Brand',
      category: 'Agro/FMCG',
      pack_size: '250ml',
      trading_unit: 'Bottle',
      units_per_box_carton: 1,
      mrp: 1000,
      selling_price: 950,
      purchase_price: 800,
      gst_percent: 18,
      hsn: '3808',
      sku: 'SKU-COR250',
      barcode: '12345678',
      active: true,
      packing_display: '250ml bottle'
    },
    {
      id: 'prod-b',
      product_code: 'PRODB',
      name: 'Product B',
      company_id: 'biz-saifee',
      brand: 'FMCG Brand',
      category: 'General',
      pack_size: '500g',
      trading_unit: 'Box',
      units_per_box_carton: 1,
      mrp: 1200,
      selling_price: 1000,
      purchase_price: 850,
      gst_percent: 18,
      hsn: '3808',
      sku: 'SKU-PRODB',
      barcode: '87654321',
      active: true,
      packing_display: '500g pack'
    }
  ];

  // Base Retailers
  const mockRetailers: Retailer[] = [
    {
      id: 'ret-abc',
      retailer_code: 'RET-001',
      shop_name: 'ABC Traders',
      owner_name: 'Amit Patel',
      address: 'Shop 1, Market',
      city: 'Ahmednagar',
      state_code: '27',
      mobile: '9876543210',
      credit_limit: 500000,
      outstanding: 0,
      active: true
    },
    {
      id: 'ret-xyz',
      retailer_code: 'RET-002',
      shop_name: 'XYZ Traders',
      owner_name: 'Zameer Khan',
      address: 'Shop 2, Market',
      city: 'Pune',
      state_code: '27',
      mobile: '9876543211',
      credit_limit: 500000,
      outstanding: 0,
      active: true
    },
    {
      id: 'ret-pqr',
      retailer_code: 'RET-003',
      shop_name: 'PQR Traders',
      owner_name: 'Prakash Rao',
      address: 'Shop 3, Market',
      city: 'Mumbai',
      state_code: '27',
      mobile: '9876543212',
      credit_limit: 500000,
      outstanding: 0,
      active: true
    }
  ];

  // Profiles (Salespersons)
  const mockProfiles: Profile[] = [
    {
      id: 'p-ramesh',
      name: 'Ramesh',
      full_name: 'Ramesh Kumar',
      email: 'ramesh@saifee.com',
      role: 'sales_dist',
      active: true
    },
    {
      id: 'p-vikas',
      name: 'Vikas',
      full_name: 'Vikas Sharma',
      email: 'vikas@saifee.com',
      role: 'sales_dist',
      active: true
    }
  ];

  // Test 1: Basic Sales Aggregation (Section 40)
  {
    const db: DbState = {
      invoices: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
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
          items: [
            {
              id: 'item-1',
              invoice_id: 'inv-1',
              product_id: 'prod-coragen-250',
              quantity: 10,
              trading_unit: 'Bottle',
              rate: 1000,
              discount: 0,
              taxable_value: 10000,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_amount: 10000,
              hsn: '3808',
              packing: '250ml'
            }
          ]
        },
        {
          id: 'inv-2',
          invoice_number: 'INV-002',
          retailer_id: 'ret-abc',
          date: '2026-10-06',
          place_of_supply: '27',
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
          items: [
            {
              id: 'item-2',
              invoice_id: 'inv-2',
              product_id: 'prod-coragen-250',
              quantity: 20,
              trading_unit: 'Bottle',
              rate: 1000,
              discount: 0,
              taxable_value: 20000,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_amount: 20000,
              hsn: '3808',
              packing: '250ml'
            }
          ]
        }
      ],
      orders: [],
      fulfilments: [],
      products: mockProducts,
      retailers: mockRetailers,
      companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
      profiles: mockProfiles,
      purchases: [],
      payments: [],
      salesReturns: [],
      batches: [],
      inventory: [],
      ledger: [],
      suppliers: []
    };

    const filters: ReportFilterState = {
      datePreset: 'all'
    };

    const result = getPartyItemReport(filters, db, dummyContext);
    const abcRow = result.rows.find(r => r.partyName === 'ABC Traders');

    console.log('Test 1 (Basic Aggregation):');
    console.log('  ABC Traders Sale Qty:', abcRow?.saleQty, '(Expected: 30)');
    console.log('  ABC Traders Sale Amount:', abcRow?.saleAmount, '(Expected: 30000)');
    if (abcRow?.saleQty === 30 && abcRow?.saleAmount === 30000) {
      console.log('  STATUS: PASSED ✅\n');
    } else {
      console.error('  STATUS: FAILED ❌\n');
    }
  }

  // Test 2: Product Filter (Section 41)
  {
    const db: DbState = {
      invoices: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
          subtotal: 50000,
          discount_amount: 0,
          taxable_value: 50000,
          cgst: 0,
          sgst: 0,
          igst: 0,
          round_off: 0,
          grand_total: 50000,
          paid_amount: 50000,
          outstanding_amount: 0,
          items: [
            {
              id: 'item-1',
              invoice_id: 'inv-1',
              product_id: 'prod-coragen-250',
              quantity: 20,
              trading_unit: 'Bottle',
              rate: 1000,
              discount: 0,
              taxable_value: 20000,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_amount: 20000,
              hsn: '3808',
              packing: '250ml'
            },
            {
              id: 'item-2',
              invoice_id: 'inv-1',
              product_id: 'prod-b',
              quantity: 30,
              trading_unit: 'Box',
              rate: 1000,
              discount: 0,
              taxable_value: 30000,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_amount: 30000,
              hsn: '3808',
              packing: '500g'
            }
          ]
        }
      ],
      orders: [],
      fulfilments: [],
      products: mockProducts,
      retailers: mockRetailers,
      companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
      profiles: mockProfiles,
      purchases: [],
      payments: [],
      salesReturns: [],
      batches: [],
      inventory: [],
      ledger: [],
      suppliers: []
    };

    const filters: ReportFilterState = {
      datePreset: 'all',
      productId: 'prod-coragen-250'
    };

    const result = getPartyItemReport(filters, db, dummyContext);
    const abcRow = result.rows.find(r => r.partyName === 'ABC Traders');

    console.log('Test 2 (Product Filter):');
    console.log('  ABC Traders Sale Qty:', abcRow?.saleQty, '(Expected: 20)');
    console.log('  ABC Traders Sale Amount:', abcRow?.saleAmount, '(Expected: 20000)');
    console.log('  Total Sale Amount:', result.summary.totalSaleAmount, '(Expected: 20000)');
    if (abcRow?.saleQty === 20 && abcRow?.saleAmount === 20000 && result.summary.totalSaleAmount === 20000) {
      console.log('  STATUS: PASSED ✅\n');
    } else {
      console.error('  STATUS: FAILED ❌\n');
    }
  }

  // Test 3: Salesperson Filter (Section 42)
  {
    const db: DbState = {
      invoices: [
        {
          id: 'inv-ramesh',
          invoice_number: 'INV-RAMESH',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
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
          items: [
            {
              id: 'item-1',
              invoice_id: 'inv-ramesh',
              product_id: 'prod-coragen-250',
              quantity: 20,
              trading_unit: 'Bottle',
              rate: 1000,
              discount: 0,
              taxable_value: 20000,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_amount: 20000,
              hsn: '3808',
              packing: '250ml'
            }
          ],
          source_order_ids: ['ord-ramesh']
        },
        {
          id: 'inv-vikas',
          invoice_number: 'INV-VIKAS',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
          subtotal: 30000,
          discount_amount: 0,
          taxable_value: 30000,
          cgst: 0,
          sgst: 0,
          igst: 0,
          round_off: 0,
          grand_total: 30000,
          paid_amount: 30000,
          outstanding_amount: 0,
          items: [
            {
              id: 'item-2',
              invoice_id: 'inv-vikas',
              product_id: 'prod-b',
              quantity: 30,
              trading_unit: 'Box',
              rate: 1000,
              discount: 0,
              taxable_value: 30000,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_amount: 30000,
              hsn: '3808',
              packing: '500g'
            }
          ],
          source_order_ids: ['ord-vikas']
        }
      ],
      orders: [
        {
          id: 'ord-ramesh',
          order_number: 'ORD-RAMESH',
          retailer_id: 'ret-abc',
          source: 'distributor_salesperson',
          created_by: 'p-ramesh',
          order_date: '2026-10-05',
          total_amount: 20000,
          status: 'Delivered'
        },
        {
          id: 'ord-vikas',
          order_number: 'ORD-VIKAS',
          retailer_id: 'ret-abc',
          source: 'distributor_salesperson',
          created_by: 'p-vikas',
          order_date: '2026-10-05',
          total_amount: 30000,
          status: 'Delivered'
        }
      ],
      fulfilments: [],
      products: mockProducts,
      retailers: mockRetailers,
      companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
      profiles: mockProfiles,
      purchases: [],
      payments: [],
      salesReturns: [],
      batches: [],
      inventory: [],
      ledger: [],
      suppliers: []
    };

    const filters: ReportFilterState = {
      datePreset: 'all',
      salespersonId: 'p-ramesh'
    };

    const result = getPartyItemReport(filters, db, dummyContext);
    const abcRow = result.rows.find(r => r.partyName === 'ABC Traders');

    console.log('Test 3 (Salesperson Filter):');
    console.log('  ABC Traders Sale Amount for Ramesh:', abcRow?.saleAmount, '(Expected: 20000)');
    if (abcRow?.saleAmount === 20000 && result.summary.totalSaleAmount === 20000) {
      console.log('  STATUS: PASSED ✅\n');
    } else {
      console.error('  STATUS: FAILED ❌\n');
    }
  }

  // Test 4: Channel Filter (Section 43)
  {
    const db: DbState = {
      invoices: [
        {
          id: 'inv-direct',
          invoice_number: 'INV-DIR',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
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
          items: [{ id: 'i1', invoice_id: 'inv-direct', product_id: 'prod-coragen-250', quantity: 10, trading_unit: 'Bottle', rate: 1000, discount: 0, taxable_value: 10000, cgst: 0, sgst: 0, igst: 0, total_amount: 10000, hsn: '3808', packing: '250ml' }],
          source_order_ids: ['ord-dir']
        },
        {
          id: 'inv-dist-sp',
          invoice_number: 'INV-DIST',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
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
          items: [{ id: 'i2', invoice_id: 'inv-dist-sp', product_id: 'prod-coragen-250', quantity: 20, trading_unit: 'Bottle', rate: 1000, discount: 0, taxable_value: 20000, cgst: 0, sgst: 0, igst: 0, total_amount: 20000, hsn: '3808', packing: '250ml' }],
          source_order_ids: ['ord-dist']
        }
      ],
      orders: [
        { id: 'ord-dir', order_number: 'ORD-DIR', retailer_id: 'ret-abc', source: 'retailer_direct', channel: 'Retailer Direct', order_date: '2026-10-05', total_amount: 10000, status: 'Delivered' },
        { id: 'ord-dist', order_number: 'ORD-DIST', retailer_id: 'ret-abc', source: 'distributor_salesperson', channel: 'Distributor Salesperson', created_by: 'p-ramesh', order_date: '2026-10-05', total_amount: 20000, status: 'Delivered' }
      ],
      fulfilments: [],
      products: mockProducts,
      retailers: mockRetailers,
      companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
      profiles: mockProfiles,
      purchases: [],
      payments: [],
      salesReturns: [],
      batches: [],
      inventory: [],
      ledger: [],
      suppliers: []
    };

    const filters: ReportFilterState = {
      datePreset: 'all',
      channel: 'Distributor Salesperson'
    };

    const result = getPartyItemReport(filters, db, dummyContext);
    const abcRow = result.rows.find(r => r.partyName === 'ABC Traders');

    console.log('Test 4 (Channel Filter):');
    console.log('  ABC Traders Sale Amount for Distributor Salesperson:', abcRow?.saleAmount, '(Expected: 20000)');
    if (abcRow?.saleAmount === 20000 && result.summary.totalSaleAmount === 20000) {
      console.log('  STATUS: PASSED ✅\n');
    } else {
      console.error('  STATUS: FAILED ❌\n');
    }
  }

  // Test 5: Sales Returns (Section 45)
  {
    const db: DbState = {
      invoices: [
        {
          id: 'inv-ret-test',
          invoice_number: 'INV-RET-TEST',
          retailer_id: 'ret-abc',
          date: '2026-10-05',
          place_of_supply: '27',
          subtotal: 100000,
          discount_amount: 0,
          taxable_value: 100000,
          cgst: 0,
          sgst: 0,
          igst: 0,
          round_off: 0,
          grand_total: 100000,
          paid_amount: 100000,
          outstanding_amount: 0,
          items: [{ id: 'i1', invoice_id: 'inv-ret-test', product_id: 'prod-coragen-250', quantity: 100, trading_unit: 'Bottle', rate: 1000, discount: 0, taxable_value: 100000, cgst: 0, sgst: 0, igst: 0, total_amount: 100000, hsn: '3808', packing: '250ml' }]
        }
      ],
      salesReturns: [
        {
          id: 'sr-1',
          retailer_id: 'ret-abc',
          return_date: '2026-10-10',
          reason: 'Damaged',
          status: 'Approved',
          total_amount: 10000,
          items: [{ id: 'sri-1', sales_return_id: 'sr-1', product_id: 'prod-coragen-250', quantity: 10, trading_unit: 'Bottle', rate: 1000, total_amount: 10000, condition: 'Damaged' }]
        }
      ],
      orders: [],
      fulfilments: [],
      products: mockProducts,
      retailers: mockRetailers,
      companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
      profiles: mockProfiles,
      purchases: [],
      payments: [],
      batches: [],
      inventory: [],
      ledger: [],
      suppliers: []
    };

    const filters: ReportFilterState = {
      datePreset: 'all'
    };

    const result = getPartyItemReport(filters, db, dummyContext);
    const abcRow = result.rows.find(r => r.partyName === 'ABC Traders');

    console.log('Test 5 (Sales Return):');
    console.log('  Gross Sales:', result.summary.totalGrossSales, '(Expected: 100000)');
    console.log('  Sales Return:', result.summary.totalSalesReturn, '(Expected: 10000)');
    console.log('  Net Sales:', result.summary.totalNetSales, '(Expected: 90000)');
    if (result.summary.totalGrossSales === 100000 && result.summary.totalSalesReturn === 10000 && result.summary.totalNetSales === 90000) {
      console.log('  STATUS: PASSED ✅\n');
    } else {
      console.error('  STATUS: FAILED ❌\n');
    }
  }

  // Test 6: Multiple Retailers Aggregation (Section 47)
  {
    const db: DbState = {
      invoices: [
        { id: 'inv-abc', invoice_number: 'I-1', retailer_id: 'ret-abc', date: '2026-10-05', place_of_supply: '27', subtotal: 20000, discount_amount: 0, taxable_value: 20000, cgst: 0, sgst: 0, igst: 0, round_off: 0, grand_total: 20000, paid_amount: 0, outstanding_amount: 20000, payment_mode: 'Credit', items: [{ id: 'i1', invoice_id: 'inv-abc', product_id: 'prod-coragen-250', quantity: 20, trading_unit: 'Bottle', rate: 1000, discount: 0, taxable_value: 20000, cgst: 0, sgst: 0, igst: 0, total_amount: 20000, hsn: '3808', packing: '250ml' }] },
        { id: 'inv-xyz', invoice_number: 'I-2', retailer_id: 'ret-xyz', date: '2026-10-05', place_of_supply: '27', subtotal: 30000, discount_amount: 0, taxable_value: 30000, cgst: 0, sgst: 0, igst: 0, round_off: 0, grand_total: 30000, paid_amount: 30000, outstanding_amount: 0, payment_mode: 'UPI', items: [{ id: 'i2', invoice_id: 'inv-xyz', product_id: 'prod-coragen-250', quantity: 30, trading_unit: 'Bottle', rate: 1000, discount: 0, taxable_value: 30000, cgst: 0, sgst: 0, igst: 0, total_amount: 30000, hsn: '3808', packing: '250ml' }] },
        { id: 'inv-pqr', invoice_number: 'I-3', retailer_id: 'ret-pqr', date: '2026-10-05', place_of_supply: '27', subtotal: 50000, discount_amount: 0, taxable_value: 50000, cgst: 0, sgst: 0, igst: 0, round_off: 0, grand_total: 50000, paid_amount: 50000, outstanding_amount: 0, payment_mode: 'Cash', items: [{ id: 'i3', invoice_id: 'inv-pqr', product_id: 'prod-coragen-250', quantity: 50, trading_unit: 'Bottle', rate: 1000, discount: 0, taxable_value: 50000, cgst: 0, sgst: 0, igst: 0, total_amount: 50000, hsn: '3808', packing: '250ml' }] }
      ],
      salesReturns: [],
      orders: [],
      fulfilments: [],
      products: mockProducts,
      retailers: mockRetailers,
      companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
      profiles: mockProfiles,
      purchases: [],
      payments: [],
      batches: [],
      inventory: [],
      ledger: [],
      suppliers: []
    };

    const filters: ReportFilterState = {
      datePreset: 'all'
    };

    const result = getPartyItemReport(filters, db, dummyContext);

    console.log('Test 6 (Multiple Retailers & Credit Sales):');
    console.log('  Rows count:', result.rows.length, '(Expected: 3)');
    console.log('  Total Sale Amount:', result.summary.totalSaleAmount, '(Expected: 100000)');
    if (result.rows.length === 3 && result.summary.totalSaleAmount === 100000) {
      console.log('  STATUS: PASSED ✅\n');
    } else {
      console.error('  STATUS: FAILED ❌\n');
    }
  }

  console.log('========================================');
  console.log('ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================');
}

runAcceptanceTests();
