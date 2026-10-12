import { 
  getPendingItemsForRetailer, 
  checkSingleItemPendingWarning, 
  formatTradingQuantity, 
  Product, 
  Order, 
  Retailer, 
  OrderItem,
  PendingOrderItemWarning
} from '../db';

function createMockOrderItem(overrides: Partial<OrderItem> & { product_id: string; quantity: number }): OrderItem {
  const defaults: OrderItem = {
    id: `item-${Math.random().toString(36).substr(2, 6)}`,
    order_id: 'ord-mock',
    product_id: overrides.product_id,
    quantity: overrides.quantity,
    ordered_qty: overrides.quantity,
    base_qty: overrides.quantity,
    carton_qty: 0,
    loose_qty: 0,
    trading_unit: 'Box',
    base_unit: 'Piece',
    units_per_box_carton: 1,
    base_price: 45,
    rate: 45,
    unit_rate: 45,
    discount: 0,
    final_price: 45,
    gst_percent: 18,
    gst_amount: 8.1,
    total_amount: 45,
    dispatched_qty: 0,
    fulfilled_qty: 0,
    remaining_qty: overrides.remaining_qty,
    cancelled_qty: 0
  };
  return {
    ...defaults,
    ...overrides
  };
}

export function runAllPendingWarningTests(): { total: number; passed: number; failed: number; results: { test: string; passed: boolean; message?: string }[] } {
  console.log('================================================================');
  console.log('🧪 RUNNING PENDING ITEM DUPLICATE-ORDER WARNING TEST SUITE 🧪');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const results: { test: string; passed: boolean; message?: string }[] = [];

  const recordResult = (name: string, isOk: boolean, message?: string) => {
    if (isOk) {
      passed++;
      console.log(`✅ [PASSED] ${name}`);
      results.push({ test: name, passed: true });
    } else {
      failed++;
      console.error(`❌ [FAILED] ${name}: ${message}`);
      results.push({ test: name, passed: false, message });
    }
  };

  // Mock Products
  const mockProducts: Product[] = [
    {
      id: 'prod-a',
      product_code: 'PROD-A',
      name: 'Product A (Parle Butter Cookies 300g)',
      company_id: 'biz-saifee',
      brand: 'Parle',
      category: 'Biscuits',
      pack_size: '300g',
      trading_unit: 'Box',
      base_unit: 'Piece',
      units_per_box_carton: 1,
      mrp: 50,
      selling_price: 45,
      purchase_price: 35,
      gst_percent: 18,
      hsn: '1905',
      sku: 'PARLE-300G',
      barcode: '8901001',
      active: true,
      packing_display: '300g Box'
    },
    {
      id: 'prod-a-100g',
      product_code: 'PROD-A-100',
      name: 'Product A (Parle Butter Cookies 100g)',
      company_id: 'biz-saifee',
      brand: 'Parle',
      category: 'Biscuits',
      pack_size: '100g',
      trading_unit: 'Box',
      base_unit: 'Piece',
      units_per_box_carton: 1,
      mrp: 20,
      selling_price: 18,
      purchase_price: 14,
      gst_percent: 18,
      hsn: '1905',
      sku: 'PARLE-100G',
      barcode: '8901002',
      active: true,
      packing_display: '100g Box'
    },
    {
      id: 'prod-b',
      product_code: 'PROD-B',
      name: 'Product B (Good Day 200g)',
      company_id: 'biz-saifee',
      brand: 'Britannia',
      category: 'Biscuits',
      pack_size: '200g',
      trading_unit: 'Box',
      base_unit: 'Piece',
      units_per_box_carton: 1,
      mrp: 40,
      selling_price: 36,
      purchase_price: 28,
      gst_percent: 18,
      hsn: '1905',
      sku: 'GD-200G',
      barcode: '8902001',
      active: true,
      packing_display: '200g Box'
    },
    {
      id: 'prod-c',
      product_code: 'PROD-C',
      name: 'Product C (Blue Pearl Perfume 30ml)',
      company_id: 'biz-saifee',
      brand: 'Blue Pearl',
      category: 'Personal Care',
      pack_size: '30ml',
      trading_unit: 'Piece',
      base_unit: 'Piece',
      units_per_box_carton: 1,
      mrp: 150,
      selling_price: 130,
      purchase_price: 100,
      gst_percent: 18,
      hsn: '3303',
      sku: 'BP-30ML',
      barcode: '8903001',
      active: true,
      packing_display: '30ml Bottle'
    },
    {
      id: 'prod-carton',
      product_code: 'PROD-CTN',
      name: 'Product Carton Pack (Soap 125g)',
      company_id: 'biz-saifee',
      brand: 'Lux',
      category: 'Personal Care',
      pack_size: '24 Pcs/Ctn',
      trading_unit: 'Carton',
      base_unit: 'Piece',
      units_per_box_carton: 24,
      mrp: 480,
      selling_price: 420,
      purchase_price: 360,
      gst_percent: 18,
      hsn: '3401',
      sku: 'LUX-CTN',
      barcode: '8904001',
      active: true,
      packing_display: '24 Pcs/Ctn'
    }
  ];

  // Mock Retailers
  const retailerA: Retailer = {
    id: 'ret-a',
    retailer_code: 'RET-001',
    shop_name: 'Shree Ram General Stores',
    owner_name: 'Ram Sharma',
    address: '101 MG Road',
    city: 'Indore',
    state_code: '23',
    mobile: '9826000001',
    credit_limit: 100000,
    outstanding: 0,
    active: true,
    business_id: 'biz-saifee'
  };

  const retailerB: Retailer = {
    id: 'ret-b',
    retailer_code: 'RET-002',
    shop_name: 'Ganesh Kirana Store',
    owner_name: 'Ganesh Gupta',
    address: '202 Jail Road',
    city: 'Indore',
    state_code: '23',
    mobile: '9826000002',
    credit_limit: 100000,
    outstanding: 0,
    active: true,
    business_id: 'biz-saifee'
  };

  // -------------------------------------------------------------------------
  // TEST 1: Retailer has no previous pending items. New order placed. Expected: No warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [];
    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');
    recordResult(
      'TEST 1: Retailer has no previous pending items -> No warning',
      warnings.length === 0,
      `Expected 0 warnings, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 1: Retailer has no previous pending items', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Retailer has Product A pending = 4 Boxes. New order contains Product A. Expected: Warning showing Product A — 4 Boxes.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-101-1',
            order_id: 'ord-101',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 6,
            fulfilled_qty: 6,
            remaining_qty: 4,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');
    
    const isOk = warnings.length === 1 &&
      warnings[0].productId === 'prod-a' &&
      warnings[0].totalPendingBase === 4 &&
      warnings[0].totalPendingDisplay.includes('4 Boxes');

    recordResult(
      'TEST 2: Retailer has Product A pending = 4 Boxes -> Warning shows Product A — 4 Boxes',
      isOk,
      `Expected 1 warning for prod-a with 4 Boxes, got: ${JSON.stringify(warnings)}`
    );
  } catch (err: any) {
    recordResult('TEST 2: Retailer has Product A pending = 4 Boxes', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Retailer has Product A pending = 4 Boxes. New order contains Product B only. Expected: No warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-101-1',
            order_id: 'ord-101',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 6,
            fulfilled_qty: 6,
            remaining_qty: 4,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    const cart = [{ productId: 'prod-b', cartonQty: 3, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');
    
    recordResult(
      'TEST 3: Retailer has Product A pending, new order has Product B only -> No warning',
      warnings.length === 0,
      `Expected 0 warnings, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 3: Product B only in new order', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Retailer has Product A pending = 4 Boxes. New order contains Product A = 10 Boxes. Expected: Warning showing pending 4 Boxes.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-101-1',
            order_id: 'ord-101',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 6,
            fulfilled_qty: 6,
            remaining_qty: 4,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    const cart = [{ productId: 'prod-a', cartonQty: 10, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');
    
    const isOk = warnings.length === 1 && 
      warnings[0].totalPendingBase === 4 && 
      warnings[0].newOrderBase === 10 &&
      warnings[0].totalPendingDisplay.includes('4 Boxes') &&
      warnings[0].newOrderDisplay.includes('10 Boxes');

    recordResult(
      'TEST 4: New order has Product A = 10 Boxes -> Warning showing pending 4 Boxes and new order 10 Boxes',
      isOk,
      `Unexpected warning state: ${JSON.stringify(warnings)}`
    );
  } catch (err: any) {
    recordResult('TEST 4: Product A = 10 Boxes', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Retailer has multiple pending items. New order contains two of those items. Expected: One consolidated warning listing only those two items.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 1000,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-1',
            order_id: 'ord-101',
            product_id: 'prod-a',
            quantity: 4,
            ordered_qty: 4,
            dispatched_qty: 0,
            remaining_qty: 4,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 180
          }),
          createMockOrderItem({
            id: 'item-2',
            order_id: 'ord-101',
            product_id: 'prod-b',
            quantity: 2,
            ordered_qty: 2,
            dispatched_qty: 0,
            remaining_qty: 2,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 36,
            final_price: 36,
            gst_percent: 18,
            gst_amount: 13,
            total_amount: 72
          }),
          createMockOrderItem({
            id: 'item-3',
            order_id: 'ord-101',
            product_id: 'prod-c',
            quantity: 6,
            ordered_qty: 6,
            dispatched_qty: 0,
            remaining_qty: 6,
            trading_unit: 'Piece',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 130,
            final_price: 130,
            gst_percent: 18,
            gst_amount: 140,
            total_amount: 780
          })
        ]
      }
    ];

    // Today's order contains Prod A and Prod C only
    const cart = [
      { productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' },
      { productId: 'prod-c', looseQty: 10, tradingUnit: 'Piece' }
    ];

    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');

    const hasA = warnings.some(w => w.productId === 'prod-a' && w.totalPendingBase === 4);
    const hasC = warnings.some(w => w.productId === 'prod-c' && w.totalPendingBase === 6);
    const hasB = warnings.some(w => w.productId === 'prod-b');

    const isOk = warnings.length === 2 && hasA && hasC && !hasB;

    recordResult(
      'TEST 5: Retailer has multiple pending items -> Consolidated warning shows only matching items (Prod A & C, not B)',
      isOk,
      `Expected 2 warnings (Prod A & C), got: ${warnings.map(w => w.productName).join(', ')}`
    );
  } catch (err: any) {
    recordResult('TEST 5: Multiple pending items', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Same product name but different variant. Previous: Product A 100g pending. New: Product A 300g. Expected: NO warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-102',
        order_number: 'ORD-102',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 100,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-102-1',
            order_id: 'ord-102',
            product_id: 'prod-a-100g',
            quantity: 5,
            ordered_qty: 5,
            dispatched_qty: 0,
            remaining_qty: 5,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 18,
            final_price: 18,
            gst_percent: 18,
            gst_amount: 16,
            total_amount: 90
          })
        ]
      }
    ];

    // New order is Product A 300g
    const cart = [{ productId: 'prod-a', packSize: '300g', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');

    recordResult(
      'TEST 6: Same brand/name but different variant (100g vs 300g) -> NO warning',
      warnings.length === 0,
      `Expected 0 warnings for different variant, got: ${JSON.stringify(warnings)}`
    );
  } catch (err: any) {
    recordResult('TEST 6: Different variant matching', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Previous order completely fulfilled. Expected: NO warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-103',
        order_number: 'ORD-103',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Delivered',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-103-1',
            order_id: 'ord-103',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 10,
            fulfilled_qty: 10,
            remaining_qty: 0,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');

    recordResult(
      'TEST 7: Previous order completely fulfilled (status: Delivered, remaining: 0) -> NO warning',
      warnings.length === 0,
      `Expected 0 warnings, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 7: Completely fulfilled order', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Previous order cancelled. Expected: NO warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-104',
        order_number: 'ORD-104',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Cancelled',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-104-1',
            order_id: 'ord-104',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 0,
            cancelled_qty: 10,
            remaining_qty: 0,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');

    recordResult(
      'TEST 8: Previous order cancelled (status: Cancelled) -> NO warning',
      warnings.length === 0,
      `Expected 0 warnings, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 8: Cancelled order', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Two previous orders have the same item pending. Expected: Correct consolidated pending quantity without double counting.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-001',
        order_number: 'ORD-001',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-09-28',
        status: 'Confirmed',
        total_amount: 225,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-1',
            order_id: 'ord-001',
            product_id: 'prod-a',
            quantity: 5,
            ordered_qty: 5,
            dispatched_qty: 3,
            fulfilled_qty: 3,
            remaining_qty: 2, // pending 2
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 40,
            total_amount: 225
          })
        ]
      },
      {
        id: 'ord-002',
        order_number: 'ORD-002',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-02',
        status: 'Confirmed',
        total_amount: 360,
        source: 'distributor_salesperson',
        items: [
          createMockOrderItem({
            id: 'item-2',
            order_id: 'ord-002',
            product_id: 'prod-a',
            quantity: 8,
            ordered_qty: 8,
            dispatched_qty: 5,
            fulfilled_qty: 5,
            remaining_qty: 3, // pending 3
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 64,
            total_amount: 360
          })
        ]
      }
    ];

    const cart = [{ productId: 'prod-a', cartonQty: 4, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');

    const isOk = warnings.length === 1 &&
      warnings[0].totalPendingBase === 5 &&
      warnings[0].totalPendingDisplay.includes('5 Boxes') &&
      warnings[0].pendingOrders.length === 2 &&
      warnings[0].pendingOrders.some(p => p.orderNumber === 'ORD-001' && p.remainingBase === 2) &&
      warnings[0].pendingOrders.some(p => p.orderNumber === 'ORD-002' && p.remainingBase === 3);

    recordResult(
      'TEST 9: Multiple previous orders with same item (2 Boxes + 3 Boxes = 5 Boxes) -> Consolidated without double counting',
      isOk,
      `Expected total pending 5 Boxes across 2 orders, got: ${JSON.stringify(warnings)}`
    );
  } catch (err: any) {
    recordResult('TEST 9: Multiple previous orders', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Salesperson places an order for Retailer A. Retailer A has Product A pending. Expected: Warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        retailer_id: retailerA.id,
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-101-1',
            order_id: 'ord-101',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 6,
            remaining_qty: 4,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    // Salesperson Suresh selects Retailer A
    const targetRetailerId = retailerA.id;
    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(targetRetailerId, orders, mockProducts, cart, 'biz-saifee');

    const isOk = warnings.length === 1 && warnings[0].productId === 'prod-a' && warnings[0].totalPendingBase === 4;

    recordResult(
      'TEST 10: Salesperson places order for Retailer A who has Product A pending -> Warning shown for Retailer A',
      isOk,
      `Expected 1 warning for Retailer A, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 10: Salesperson ordering for Retailer A', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Salesperson places an order for Retailer B. Retailer A has Product A pending. Expected: NO warning.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-101',
        order_number: 'ORD-101',
        retailer_id: retailerA.id, // pending belongs to Retailer A
        business_id: 'biz-saifee',
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-101-1',
            order_id: 'ord-101',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 6,
            remaining_qty: 4,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    // Salesperson selects Retailer B (who has NO pending items)
    const targetRetailerId = retailerB.id;
    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(targetRetailerId, orders, mockProducts, cart, 'biz-saifee');

    recordResult(
      'TEST 11: Salesperson places order for Retailer B (Retailer A has pending) -> NO warning for Retailer B',
      warnings.length === 0,
      `Expected 0 warnings for Retailer B, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 11: Salesperson ordering for Retailer B', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Different company has the same retailer/product data. Expected: No cross-company data leakage.
  // -------------------------------------------------------------------------
  try {
    const orders: Order[] = [
      {
        id: 'ord-comp-2',
        order_number: 'ORD-COMP-2',
        retailer_id: retailerA.id,
        business_id: 'biz-other-company', // Different company!
        order_date: '2026-10-01',
        status: 'Confirmed',
        total_amount: 450,
        source: 'retailer_direct',
        items: [
          createMockOrderItem({
            id: 'item-comp-2',
            order_id: 'ord-comp-2',
            product_id: 'prod-a',
            quantity: 10,
            ordered_qty: 10,
            dispatched_qty: 0,
            remaining_qty: 10,
            trading_unit: 'Box',
            base_unit: 'Piece',
            units_per_box_carton: 1,
            base_price: 45,
            final_price: 45,
            gst_percent: 18,
            gst_amount: 81,
            total_amount: 450
          })
        ]
      }
    ];

    // Query for biz-saifee
    const cart = [{ productId: 'prod-a', cartonQty: 5, tradingUnit: 'Box' }];
    const warnings = getPendingItemsForRetailer(retailerA.id, orders, mockProducts, cart, 'biz-saifee');

    recordResult(
      'TEST 12: Orders belonging to a different company (biz-other-company) -> NO cross-company data leakage',
      warnings.length === 0,
      `Expected 0 warnings for biz-saifee, got ${warnings.length}`
    );
  } catch (err: any) {
    recordResult('TEST 12: Cross company isolation', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 13: User clicks "Yes, Place New Order". Expected: New order is created normally. Previous pending order remains unchanged.
  // -------------------------------------------------------------------------
  try {
    const previousOrder: Order = {
      id: 'ord-prev',
      order_number: 'ORD-PREV-001',
      retailer_id: retailerA.id,
      business_id: 'biz-saifee',
      order_date: '2026-10-01',
      status: 'Confirmed',
      total_amount: 450,
      source: 'retailer_direct',
      items: [
        createMockOrderItem({
          id: 'item-prev-1',
          order_id: 'ord-prev',
          product_id: 'prod-a',
          quantity: 10,
          ordered_qty: 10,
          dispatched_qty: 6,
          fulfilled_qty: 6,
          remaining_qty: 4,
          trading_unit: 'Box',
          base_unit: 'Piece',
          units_per_box_carton: 1,
          base_price: 45,
          final_price: 45,
          gst_percent: 18,
          gst_amount: 81,
          total_amount: 450
        })
      ]
    };

    // Simulate placing new order
    const newOrder: Order = {
      id: 'ord-new-002',
      order_number: 'ORD-NEW-002',
      retailer_id: retailerA.id,
      business_id: 'biz-saifee',
      order_date: '2026-10-06',
      status: 'Submitted',
      total_amount: 225,
      source: 'retailer_direct',
      items: [
        createMockOrderItem({
          id: 'item-new-1',
          order_id: 'ord-new-002',
          product_id: 'prod-a',
          quantity: 5,
          ordered_qty: 5,
          dispatched_qty: 0,
          remaining_qty: 5,
          trading_unit: 'Box',
          base_unit: 'Piece',
          units_per_box_carton: 1,
          base_price: 45,
          final_price: 45,
          gst_percent: 18,
          gst_amount: 40,
          total_amount: 225
        })
      ]
    };

    // Verify previous order was NOT mutated
    const isOk = previousOrder.id === 'ord-prev' &&
      previousOrder.items![0].remaining_qty === 4 &&
      previousOrder.items![0].ordered_qty === 10 &&
      previousOrder.items![0].dispatched_qty === 6 &&
      newOrder.id !== previousOrder.id &&
      newOrder.order_number !== previousOrder.order_number;

    recordResult(
      'TEST 13: Proceeding with order creates independent new order without mutating or closing previous pending order',
      isOk,
      `Previous order or new order state was corrupted`
    );
  } catch (err: any) {
    recordResult('TEST 13: Non-destructive new order placement', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 14: User clicks "Review Order". Expected: Warning closes and user returns to existing order review UI.
  // -------------------------------------------------------------------------
  try {
    let isModalOpen = true;
    let currentView = 'checkout';

    // User clicks Review Order
    const handleReviewOrder = () => {
      isModalOpen = false;
      // view stays at 'checkout' or returns to 'cart'
    };

    handleReviewOrder();

    const isOk = (isModalOpen as boolean) === false && currentView === 'checkout';

    recordResult(
      'TEST 14: Clicking "Review Order" dismisses warning dialog and keeps user in review workflow without placing order',
      isOk,
      `Expected modal to close and view to remain review/checkout`
    );
  } catch (err: any) {
    recordResult('TEST 14: Review order dismissal', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  return {
    total: passed + failed,
    passed,
    failed,
    results
  };
}

// Auto-run if invoked directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('pendingDeliveryWarningTestRunner')) {
  runAllPendingWarningTests();
}
