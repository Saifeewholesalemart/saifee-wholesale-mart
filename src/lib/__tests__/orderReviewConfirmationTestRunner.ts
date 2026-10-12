import { db, calculateOrderQuantities } from '../db';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING MANDATORY ORDER REVIEW & CONFIRMATION TEST SUITE 🧪');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 10;

  // Setup basic mock data if not initialized
  let retailers = db.getRetailers();
  let products = db.getProducts();
  
  if (retailers.length === 0) {
    const defaultRetailer = {
      id: 'ret-test-1',
      retailer_code: 'RET-00101',
      shop_name: 'Shree Ganesh Super Market',
      owner_name: 'Ganesh Patel',
      address: 'Shop 45, MG Road',
      city: 'Indore',
      state_code: '27',
      mobile: '9826110001',
      credit_limit: 150000,
      outstanding: 0,
      active: true,
      business_id: 'biz-saifee'
    };
    db.saveRetailers([defaultRetailer as any]);
    retailers = db.getRetailers();
  }

  if (products.length === 0) {
    const defaultProducts = [
      {
        id: 'prod-test-1',
        name: 'Parle-G 800g Super Saver',
        brand: 'Parle',
        category_id: 'cat-biscuits',
        sku: 'PARLE-G-800G',
        barcode: '8901719101010',
        mrp: 100,
        selling_price: 90,
        purchase_price: 75,
        units_per_box_carton: 24,
        pack_size: '24 Pcs/Box',
        trading_unit: 'Box',
        base_unit: 'Pcs',
        gst_percent: 18,
        hsn: '1905',
        active: true,
        business_id: 'biz-saifee'
      },
      {
        id: 'prod-test-2',
        name: 'Good Day Butter 600g Family Pack',
        brand: 'Britannia',
        category_id: 'cat-biscuits',
        sku: 'GOOD-DAY-600G',
        barcode: '8901719202020',
        mrp: 160,
        selling_price: 140,
        purchase_price: 115,
        units_per_box_carton: 12,
        pack_size: '12 Pcs/Box',
        trading_unit: 'Box',
        base_unit: 'Pcs',
        gst_percent: 18,
        hsn: '1905',
        active: true,
        business_id: 'biz-saifee'
      }
    ];
    db.saveProducts(defaultProducts as any);
    products = db.getProducts();
  }

  const testRetailer = retailers[0];
  const testProduct1 = products[0];
  const testProduct2 = products.length > 1 ? products[1] : products[0];

  console.log(`Using Test Retailer: ${testRetailer.shop_name} (${testRetailer.id})`);
  console.log(`Using Test Product 1: ${testProduct1.name} (${testProduct1.id})`);
  console.log(`Using Test Product 2: ${testProduct2.name} (${testProduct2.id})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Retailer creates order -> status is Submitted (Pending Confirmation) -> reviews -> confirms
  // --------------------------------------------------------------------------
  try {
    console.log('Test 1: Retailer creates order -> reviews -> confirms');
    
    // Initial order creation via Retailer Direct
    const initialOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 10,
          ordered_qty: 10,
          base_qty: 10,
          trading_unit: 'Piece',
          rate: testProduct1.selling_price || 100,
          unit_rate: testProduct1.selling_price || 100,
          gst_percent: testProduct1.gst_percent || 18
        }
      ],
      order_notes: 'Initial Retailer Order Notes'
    });

    if (!initialOrder) throw new Error('Order creation failed');
    if (initialOrder.status !== 'Submitted') throw new Error(`Expected status 'Submitted', got '${initialOrder.status}'`);
    
    // Quantity calculation before confirmation
    const qBefore = calculateOrderQuantities(initialOrder, products);
    if (qBefore.statusBadgeText !== 'ORDER PLACED / PENDING CONFIRMATION') {
      throw new Error(`Expected badge 'ORDER PLACED / PENDING CONFIRMATION', got '${qBefore.statusBadgeText}'`);
    }

    // Now confirm the order
    const confirmed = db.fullyConfirmOrder(initialOrder.id, { id: 'ret-user-1', name: 'Retailer User' });
    if (!confirmed) throw new Error('fullyConfirmOrder returned null');
    if (confirmed.status !== 'Confirmed') throw new Error(`Expected status 'Confirmed', got '${confirmed.status}'`);
    if (!confirmed.confirmed_at) throw new Error('confirmed_at timestamp was not set');

    const qAfter = calculateOrderQuantities(confirmed, products);
    if (qAfter.confirmedBase !== 10) {
      throw new Error(`Expected 10 confirmedBase, got ${qAfter.confirmedBase}`);
    }

    console.log('✅ Test 1 Passed: Retailer order created as Submitted/Pending Confirmation and successfully confirmed.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 1 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Retailer creates order -> reviews -> edits items -> confirms
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 2: Retailer creates order -> reviews -> edits items -> confirms');
    
    const initialOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 5,
          ordered_qty: 5,
          base_qty: 5,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        }
      ],
      order_notes: 'Order to be edited'
    });

    const originalOrderNumber = initialOrder.order_number;

    // Edit order in review modal: update quantity from 5 to 8 and update notes
    const updated = db.updateOrder(initialOrder.id, {
      items: [
        {
          ...initialOrder.items![0],
          quantity: 8,
          ordered_qty: 8,
          base_qty: 8
        }
      ],
      order_notes: 'Updated order notes after review'
    }, { id: 'ret-user-1', name: 'Retailer User' });

    if (!updated) throw new Error('updateOrder returned null');
    if (updated.order_number !== originalOrderNumber) throw new Error('Order number changed during edit!');
    if (!updated.items || updated.items[0].quantity !== 8) throw new Error(`Expected quantity 8, got ${updated.items?.[0]?.quantity}`);
    if (updated.order_notes !== 'Updated order notes after review') {
      throw new Error(`Order notes not updated. Got: "${updated.order_notes}"`);
    }

    // Confirm the edited order
    const confirmed = db.fullyConfirmOrder(updated.id, { id: 'ret-user-1', name: 'Retailer User' });
    if (!confirmed || confirmed.status !== 'Confirmed') throw new Error('Failed to confirm edited order');
    if (!confirmed.items || confirmed.items[0].confirmed_qty !== 8) throw new Error(`Expected confirmed_qty 8, got ${confirmed.items?.[0]?.confirmed_qty}`);

    console.log('✅ Test 2 Passed: Retailer order successfully edited during review and confirmed with preserved order number.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 2 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Retailer creates order -> reviews -> cancels
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 3: Retailer creates order -> reviews -> cancels');
    
    const initialOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 12,
          ordered_qty: 12,
          base_qty: 12,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        }
      ]
    });

    // Cancel the order
    const cancelled = db.cancelOrder(initialOrder.id, 'Retailer decided not to order after review', { id: 'ret-user-1', name: 'Retailer User' });
    if (!cancelled) throw new Error('cancelOrder returned null');
    if (cancelled.status !== 'Cancelled') throw new Error(`Expected status 'Cancelled', got '${cancelled.status}'`);
    if (!cancelled.cancellation_reason) {
      throw new Error(`cancellation_reason not set. Got: "${cancelled.cancellation_reason}"`);
    }

    console.log('✅ Test 3 Passed: Order successfully cancelled during review stage.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 3 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Salesperson creates order -> reviews -> confirms
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 4: Salesperson creates order -> reviews -> confirms');
    
    const salesOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'distributor_salesperson',
      channel: 'Distributor Salesperson',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 20,
          ordered_qty: 20,
          base_qty: 20,
          trading_unit: 'Piece',
          rate: 95,
          unit_rate: 95,
          gst_percent: 18
        }
      ],
      order_notes: 'Salesperson booked order'
    });

    if (salesOrder.status !== 'Submitted') throw new Error(`Sales order status should be Submitted, got ${salesOrder.status}`);

    const confirmed = db.fullyConfirmOrder(salesOrder.id, { id: 'sp-1', name: 'Salesperson User' });
    if (!confirmed || confirmed.status !== 'Confirmed') throw new Error('Failed to confirm sales order');

    console.log('✅ Test 4 Passed: Salesperson created order in Submitted status and confirmed.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 4 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Salesperson creates order -> reviews -> edits -> confirms
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 5: Salesperson creates order -> reviews -> edits -> confirms');
    
    const salesOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'distributor_salesperson',
      channel: 'Distributor Salesperson',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 15,
          ordered_qty: 15,
          base_qty: 15,
          trading_unit: 'Piece',
          rate: 95,
          unit_rate: 95,
          gst_percent: 18
        },
        {
          product_id: testProduct2.id,
          product_name: testProduct2.name,
          quantity: 10,
          ordered_qty: 10,
          base_qty: 10,
          trading_unit: 'Piece',
          rate: 150,
          unit_rate: 150,
          gst_percent: 18
        }
      ]
    });

    // Salesperson modifies line items: deletes item 2 and updates item 1 quantity to 25
    const updated = db.updateOrder(salesOrder.id, {
      items: [
        {
          ...salesOrder.items![0],
          quantity: 25,
          ordered_qty: 25,
          base_qty: 25
        }
      ],
      order_notes: 'Adjusted quantity after salesperson review'
    }, { id: 'sp-1', name: 'Salesperson User' });

    if (!updated || !updated.items || updated.items.length !== 1) throw new Error('Item deletion/update failed');
    if (updated.items[0].quantity !== 25) throw new Error(`Expected 25, got ${updated.items[0].quantity}`);

    const confirmed = db.fullyConfirmOrder(updated.id, { id: 'sp-1', name: 'Salesperson User' });
    if (!confirmed || confirmed.status !== 'Confirmed') throw new Error('Confirmation of edited order failed');

    console.log('✅ Test 5 Passed: Salesperson edited order during review and confirmed.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 5 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Order cannot be packed before confirmation (guard check)
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 6: Order cannot be packed before confirmation');
    
    const unconfirmedOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 5,
          ordered_qty: 5,
          base_qty: 5,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        }
      ]
    });

    // Attempting allocateAndPackOrder on unconfirmed order must fail/throw
    let packFailed = false;
    try {
      const packed = db.allocateAndPackOrder(unconfirmedOrder.id, [
        {
          orderItemId: unconfirmedOrder.items![0].id,
          batchAllocations: []
        }
      ]);
      if (!packed) packFailed = true;
    } catch (err) {
      packFailed = true;
    }

    if (!packFailed) {
      throw new Error('allocateAndPackOrder succeeded on an unconfirmed order!');
    }

    console.log('✅ Test 6 Passed: Unconfirmed order is strictly blocked from packing.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 6 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Order cannot be dispatched before confirmation (guard check)
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 7: Order cannot be dispatched before confirmation');
    
    const unconfirmedOrder = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 5,
          ordered_qty: 5,
          base_qty: 5,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        }
      ]
    });

    let dispatchFailed = false;
    try {
      const dispatched = db.dispatchOrder(unconfirmedOrder.id, {
        transportMode: 'Van',
        vehicleNumber: 'MH-04-1234',
        deliveryPerson: 'Driver',
        notes: 'Test',
        dispatchDate: new Date().toISOString(),
        dispatchGodown: 'Godown 1'
      });
      if (!dispatched) dispatchFailed = true;
    } catch (err) {
      dispatchFailed = true;
    }

    if (!dispatchFailed) {
      throw new Error('dispatchOrder succeeded on an unconfirmed order!');
    }

    console.log('✅ Test 7 Passed: Unconfirmed order is strictly blocked from dispatching.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 7 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Refreshing the page during review does not create duplicate orders
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 8: Refreshing the page during review does not create duplicate orders');
    
    const ordersBefore = db.getOrders().length;

    // Create single order
    const created = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 4,
          ordered_qty: 4,
          base_qty: 4,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        }
      ]
    });

    const ordersAfterCreation = db.getOrders().length;
    if (ordersAfterCreation !== ordersBefore + 1) {
      throw new Error(`Expected exactly 1 new order, got ${ordersAfterCreation - ordersBefore}`);
    }

    // Simulating page refresh / re-opening review modal on the same order:
    // Simply fetch existing order by ID without calling createOrder again
    const fetched = db.getOrder(created.id);
    if (!fetched || fetched.id !== created.id) throw new Error('Failed to retrieve existing order');

    const ordersAfterRefresh = db.getOrders().length;
    if (ordersAfterRefresh !== ordersAfterCreation) {
      throw new Error('Duplicate order created during view/refresh!');
    }

    console.log('✅ Test 8 Passed: No duplicate orders created during review re-renders or page reload.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 8 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Double-clicking Confirm does not create duplicate confirmation/events
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 9: Double-clicking Confirm does not create duplicate confirmation/events');
    
    const orderToConfirm = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 10,
          ordered_qty: 10,
          base_qty: 10,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        }
      ]
    });

    // First confirmation click
    const firstConfirm = db.fullyConfirmOrder(orderToConfirm.id, { id: 'admin-1', name: 'Admin' });
    if (!firstConfirm || firstConfirm.status !== 'Confirmed') throw new Error('First confirmation failed');
    const firstConfirmedAt = firstConfirm.confirmed_at;
    const historyCount1 = (firstConfirm as any).status_history?.length || 0;

    // Rapid second confirmation click (simulating double click)
    const secondConfirm = db.fullyConfirmOrder(orderToConfirm.id, { id: 'admin-1', name: 'Admin' });
    if (!secondConfirm || secondConfirm.status !== 'Confirmed') throw new Error('Second call failed');
    const historyCount2 = (secondConfirm as any).status_history?.length || 0;

    if (secondConfirm.confirmed_at !== firstConfirmedAt) {
      throw new Error('confirmed_at timestamp changed on redundant confirmation click');
    }
    if (historyCount2 !== historyCount1) {
      throw new Error('Duplicate status history event added on redundant confirmation click');
    }

    console.log('✅ Test 9 Passed: Double confirmation protected idempotently.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 9 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Existing partial fulfilment workflow continues to work correctly after confirmation
  // --------------------------------------------------------------------------
  try {
    console.log('\nTest 10: Existing partial fulfilment workflow continues to work correctly after confirmation');
    
    // Create and confirm order with 2 items
    const order = db.createOrder({
      retailer_id: testRetailer.id,
      source: 'retailer_direct',
      channel: 'Retailer Direct',
      items: [
        {
          product_id: testProduct1.id,
          product_name: testProduct1.name,
          quantity: 10,
          ordered_qty: 10,
          base_qty: 10,
          trading_unit: 'Piece',
          rate: 100,
          unit_rate: 100,
          gst_percent: 18
        },
        {
          product_id: testProduct2.id,
          product_name: testProduct2.name,
          quantity: 20,
          ordered_qty: 20,
          base_qty: 20,
          trading_unit: 'Piece',
          rate: 150,
          unit_rate: 150,
          gst_percent: 18
        }
      ]
    });

    // 1. Confirm order
    const confirmed = db.fullyConfirmOrder(order.id, { id: 'admin-1', name: 'Admin' });
    if (!confirmed) throw new Error('Confirmation failed');

    // 2. Partial Packing using saveLotPackingProgress (Pack 5 of item 1, 10 of item 2)
    const lotProgress = db.saveLotPackingProgress({
      retailerId: testRetailer.id,
      sourceOrderIds: [order.id],
      items: [
        {
          originOrderId: order.id,
          originItemId: order.items![0].id,
          productId: testProduct1.id,
          packedPieces: 5
        },
        {
          originOrderId: order.id,
          originItemId: order.items![1].id,
          productId: testProduct2.id,
          packedPieces: 10
        }
      ],
      markAsSealed: true
    }, { id: 'admin-1', name: 'Admin' });

    if (!lotProgress) throw new Error('saveLotPackingProgress returned null');
    const updatedOrder = db.getOrder(order.id);
    if (!updatedOrder) throw new Error('Order not found');

    if (updatedOrder.status !== 'Partially Fulfilled') {
      throw new Error(`Expected status 'Partially Fulfilled', got '${updatedOrder.status}'`);
    }

    // Check item remaining quantities
    const it1 = updatedOrder.items?.find(i => i.product_id === testProduct1.id);
    const it2 = updatedOrder.items?.find(i => i.product_id === testProduct2.id);

    if (it1?.remaining_qty !== 5) throw new Error(`Expected item 1 remaining 5, got ${it1?.remaining_qty}`);
    if (it2?.remaining_qty !== 10) throw new Error(`Expected item 2 remaining 10, got ${it2?.remaining_qty}`);

    console.log('✅ Test 10 Passed: Partial fulfilment correctly computes remaining shortages after confirmation and packing.');
    passedTests++;
  } catch (err: any) {
    console.error('❌ Test 10 Failed:', err.message);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL 10 TEST SCENARIOS PASSED WITH ZERO ERRORS! 🎉');
    process.exit(0);
  } else {
    console.error(`⚠️ ${totalTests - passedTests} TEST(S) FAILED.`);
    process.exit(1);
  }
}

runTests();
