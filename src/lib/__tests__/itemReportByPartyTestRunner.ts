import { 
  getItemReportByParty, 
  DbState, 
  UserContext, 
  ReportFilterState 
} from '../reportsEngine';
import { Product, Invoice, Purchase, SalesReturn, StockLedgerEntry, Retailer, Supplier } from '../db';

async function runTests() {
  console.log('========================================');
  console.log('RUNNING ITEM REPORT BY PARTY TESTS');
  console.log('========================================\n');

  const mockProducts: Product[] = [
    {
      id: 'prod-a',
      product_code: 'PRODA',
      name: 'Item Alpha 100g',
      company_id: 'biz-saifee',
      brand: 'Saifee Agro',
      category: 'Pesticides',
      pack_size: '100g',
      trading_unit: 'Box',
      units_per_box_carton: 10,
      mrp: 500,
      selling_price: 450,
      purchase_price: 350,
      gst_percent: 18,
      hsn: '3808',
      sku: 'SKU-PRODA',
      barcode: '11111111',
      active: true,
      packing_display: '100g pack'
    },
    {
      id: 'prod-b',
      product_code: 'PRODB',
      name: 'Item Beta 500g',
      company_id: 'biz-saifee',
      brand: 'Saifee Agro',
      category: 'Fertilizers',
      pack_size: '500g',
      trading_unit: 'Box',
      units_per_box_carton: 5,
      mrp: 1000,
      selling_price: 900,
      purchase_price: 750,
      gst_percent: 18,
      hsn: '3808',
      sku: 'SKU-PRODB',
      barcode: '22222222',
      active: true,
      packing_display: '500g pack'
    }
  ];

  const mockRetailers: Retailer[] = [
    {
      id: 'ret-1',
      shop_name: 'Alpha Retailer',
      owner_name: 'John Doe',
      retailer_code: 'RET001',
      address: 'Indore Market',
      city: 'Indore',
      state_code: '23',
      mobile: '9876543210',
      credit_limit: 500000,
      outstanding: 0,
      active: true
    }
  ];

  const mockSuppliers: Supplier[] = [
    {
      id: 'sup-1',
      name: 'Beta Supplier Corp',
      business_id: 'biz-saifee',
      gstin: '23AAAAA0000A1Z5',
      address: 'Indore',
      active: true
    }
  ];

  const mockInvoices: Invoice[] = [
    {
      id: 'inv-1',
      invoice_number: 'INV-2026-001',
      retailer_id: 'ret-1',
      business_id: 'biz-saifee',
      date: '2026-09-10',
      status: 'Finalized',
      place_of_supply: '23-Madhya Pradesh',
      subtotal: 9000,
      discount_amount: 0,
      taxable_value: 9000,
      cgst: 810,
      sgst: 810,
      igst: 0,
      round_off: 0,
      grand_total: 10620,
      paid_amount: 10620,
      outstanding_amount: 0,
      payment_mode: 'UPI',
      items: [
        {
          id: 'item-1',
          invoice_id: 'inv-1',
          product_id: 'prod-a',
          product_name: 'Item Alpha 100g',
          quantity: 20, // 20 pieces = 2 boxes
          carton_qty: 2,
          loose_qty: 0,
          rate: 450,
          discount: 0,
          taxable_value: 9000,
          cgst: 810,
          sgst: 810,
          igst: 0,
          total_amount: 10620,
          packing: '100g',
          trading_unit: 'Box',
          hsn: '3808'
        }
      ]
    }
  ];

  const mockPurchases: Purchase[] = [
    {
      id: 'pur-1',
      invoice_number: 'PUR-2026-001',
      supplier_id: 'sup-1',
      business_id: 'biz-saifee',
      invoice_date: '2026-09-05',
      created_at: '2026-09-05T00:00:00Z',
      status: 'Confirmed',
      total_amount: 41300,
      items: [
        {
          id: 'pitem-1',
          product_id: 'prod-a',
          quantity: 100, // 100 pieces = 10 boxes
          carton_qty: 10,
          loose_qty: 0,
          purchase_rate: 3500, // per box of 10
          discount: 0,
          gst_percent: 18,
          units_per_box_carton: 10,
          trading_unit: 'Box',
          free_quantity: 0,
          mrp: 500,
          hsn: '3808'
        }
      ]
    }
  ];

  const mockInventory = [
    {
      id: 'inv-stock-1',
      product_id: 'prod-a',
      business_id: 'biz-saifee',
      godown_id: 'gdn-saifee-main',
      godown_name: 'Main Godown',
      quantity: 80, // 80 pieces in stock
      physical_qty: 80,
      available_qty: 70,
      reserved_qty: 10,
      damaged_qty: 0,
      expired_qty: 0,
      updated_at: '2026-09-01T00:00:00Z'
    }
  ];

  const db: DbState = {
    products: mockProducts,
    retailers: mockRetailers,
    suppliers: mockSuppliers,
    invoices: mockInvoices,
    purchases: mockPurchases,
    inventory: mockInventory,
    salesReturns: [],
    companies: [{ id: 'biz-saifee', name: 'Saifee General Stores', code: 'SGS', active: true }],
    profiles: [],
    orders: [],
    fulfilments: [],
    payments: [],
    batches: [],
    ledger: []
  };

  const dummyContext: UserContext = { role: 'admin', companyId: 'biz-saifee' };
  const filters: ReportFilterState = {
    datePreset: 'custom',
    customStartDate: '2026-09-01',
    customEndDate: '2026-09-30'
  };

  const result = getItemReportByParty(filters, db, dummyContext);

  console.log('Test 1 (Item Alpha Product Aggregation):');
  const prodARow = result.rows.find(r => r.productId === 'prod-a');
  console.log('  Item Alpha Sale Qty Pieces:', prodARow?.totalSaleQtyPieces, '(Expected: 20)');
  console.log('  Item Alpha Net Sale Amount:', prodARow?.saleAmount, '(Expected: 9000 [Net without GST])');
  console.log('  Item Alpha Purchase Qty Pieces:', prodARow?.totalPurchaseQtyPieces, '(Expected: 100)');
  console.log('  Item Alpha Purchase Amount:', prodARow?.purchaseAmount, '(Expected: 35000 [Net without GST])');
  console.log('  Item Alpha Physical Stock Pieces:', prodARow?.totalClosingPhysicalPieces, '(Expected: 80)');
  console.log('  Item Alpha Party Sales Count:', prodARow?.partySalesBreakdown.length, '(Expected: 1)');
  
  if (
    prodARow?.totalSaleQtyPieces === 20 &&
    prodARow?.saleAmount === 9000 &&
    prodARow?.totalPurchaseQtyPieces === 100 &&
    prodARow?.purchaseAmount === 35000 &&
    prodARow?.totalClosingPhysicalPieces === 80 &&
    prodARow?.partySalesBreakdown.length === 1
  ) {
    console.log('  STATUS: PASSED ✅\n');
  } else {
    console.error('  STATUS: FAILED ❌\n');
    process.exit(1);
  }

  console.log('========================================');
  console.log('ALL ITEM REPORT BY PARTY TESTS PASSED ✅');
  console.log('========================================');
}

runTests();
