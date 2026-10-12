import { db, calculateOrderQuantities } from '../db';

export async function runOrderSyncTests(): Promise<{ passed: boolean; passedTests: number; totalTests: number }> {
  console.log('================================================================');
  console.log('🧪 RUNNING PACKER, BILLER & ADMIN PORTAL ORDER SYNC TEST SUITE 🧪');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 8;

  // Setup test environment
  let retailers = db.getRetailers();
  let products = db.getProducts();

  if (retailers.length === 0) {
    db.saveRetailers([{
      id: 'ret-sync-1',
      retailer_code: 'RET-SYNC-01',
      shop_name: 'Shree Ram General Stores Khachrod',
      owner_name: 'Ramji Seth',
      address: 'Station Road, Khachrod',
      city: 'Khachrod',
      state_code: '27',
      mobile: '9826110099',
      credit_limit: 200000,
      outstanding: 0,
      active: true,
      business_id: 'biz-saifee'
    } as any]);
    retailers = db.getRetailers();
  }

  if (products.length < 3) {
    db.saveProducts([
      {
        id: 'prod-perf-white',
        name: 'PERF.MLD WHITE ORG 30 ML(1*180)MRP-',
        brand: 'Riya',
        category_id: 'cat-perfume',
        sku: 'BC-17450854',
        barcode: 'BC-17450854',
        mrp: 225,
        selling_price: 180,
        purchase_price: 150,
        units_per_box_carton: 180,
        pack_size: '180 pcs/box',
        trading_unit: 'Box',
        base_unit: 'Piece',
        gst_percent: 18,
        hsn: '3307',
        active: true,
        business_id: 'biz-saifee'
      },
      {
        id: 'prod-perf-bawri',
        name: 'PERF.BAWRI 30 ML (1*180)',
        brand: 'Riya',
        category_id: 'cat-perfume',
        sku: 'BC-17450815',
        barcode: 'BC-17450815',
        mrp: 225,
        selling_price: 180,
        purchase_price: 150,
        units_per_box_carton: 180,
        pack_size: '180 pcs/box',
        trading_unit: 'Box',
        base_unit: 'Piece',
        gst_percent: 18,
        hsn: '3307',
        active: true,
        business_id: 'biz-saifee'
      },
      {
        id: 'prod-perf-bindas',
        name: 'PERF.BINDAS BLK 30 ML (1*180)',
        brand: 'Riya',
        category_id: 'cat-perfume',
        sku: 'BC-17450816',
        barcode: 'BC-17450816',
        mrp: 225,
        selling_price: 180,
        purchase_price: 150,
        units_per_box_carton: 180,
        pack_size: '180 pcs/box',
        trading_unit: 'Box',
        base_unit: 'Piece',
        gst_percent: 18,
        hsn: '3307',
        active: true,
        business_id: 'biz-saifee'
      }
    ] as any);
    products = db.getProducts();
  }

  const ret = retailers[0];
  const p1 = products[0]; // prod-perf-white
  const p2 = products[1]; // prod-perf-bawri
  const p3 = products[2]; // prod-perf-bindas

  // --------------------------------------------------------------------------
  // TEST 1: Order Creation & Admin Confirmation Sync
  // --------------------------------------------------------------------------
  try {
    console.log('Test 1: Order creation by salesperson and Admin confirmation sync');
    const order = db.createOrder({
      retailer_id: ret.id,
      source: 'distributor_salesperson',
      channel: 'Distributor Salesperson',
      items: [
        { product_id: p1.id, carton_qty: 0, loose_qty: 5, quantity: 5, rate: 180, total_amount: 900 },
        { product_id: p2.id, carton_qty: 0, loose_qty: 1, quantity: 1, rate: 180, total_amount: 180 },
        { product_id: p3.id, carton_qty: 0, loose_qty: 6, quantity: 6, rate: 180, total_amount: 1080 }
      ]
    });
    if (!order) throw new Error('Order creation failed');

    // Admin fully confirms the order
    const confirmed = db.fullyConfirmOrder(order.id, { id: 'admin-1', name: 'Admin Master' });
    if (!confirmed) throw new Error('fullyConfirmOrder failed');
    if (confirmed.status !== 'Confirmed') throw new Error(`Expected Confirmed status, got ${confirmed.status}`);
    
    // Check confirmed quantities on items
    confirmed.items?.forEach(it => {
      const ordQty = it.ordered_qty ?? it.quantity;
      if (it.confirmed_qty !== ordQty) {
        throw new Error(`Item ${it.product_id} confirmed_qty ${it.confirmed_qty} !== ordered ${ordQty}`);
      }
    });

    console.log('  ✅ Test 1 Passed: Order created and confirmed with synchronized line items.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 1 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Packer Partial Packing with Shortages (0 packed for OOS items)
  // --------------------------------------------------------------------------
  let testOrder2Id = '';
  try {
    console.log('Test 2: Packer partial packing with 0 packed for OOS items (Save Progress)');
    const order2 = db.createOrder({
      retailer_id: ret.id,
      source: 'distributor_salesperson',
      channel: 'Distributor Salesperson',
      items: [
        { product_id: p1.id, carton_qty: 0, loose_qty: 5, quantity: 5, rate: 180, total_amount: 900 },
        { product_id: p2.id, carton_qty: 0, loose_qty: 1, quantity: 1, rate: 180, total_amount: 180 },
        { product_id: p3.id, carton_qty: 0, loose_qty: 6, quantity: 6, rate: 180, total_amount: 1080 }
      ]
    });
    if (!order2) throw new Error('Order 2 creation failed');
    testOrder2Id = order2.id;
    db.fullyConfirmOrder(order2.id, { id: 'admin-1', name: 'Admin Master' });

    // Packer packs: 5 of p1 (In Stock), 0 of p2 (OOS), 0 of p3 (OOS)
    const p1Item = order2.items!.find(i => i.product_id === p1.id)!;
    const p2Item = order2.items!.find(i => i.product_id === p2.id)!;
    const p3Item = order2.items!.find(i => i.product_id === p3.id)!;

    const saveResult = db.saveLotPackingProgress({
      retailerId: ret.id,
      sourceOrderIds: [order2.id],
      items: [
        { originOrderId: order2.id, originItemId: p1Item.id, productId: p1.id, packedPieces: 5, packedCartons: 0, packedLoose: 5 },
        { originOrderId: order2.id, originItemId: p2Item.id, productId: p2.id, packedPieces: 0, packedCartons: 0, packedLoose: 0 },
        { originOrderId: order2.id, originItemId: p3Item.id, productId: p3.id, packedPieces: 0, packedCartons: 0, packedLoose: 0 }
      ],
      markAsSealed: false
    }, { id: 'packer-1', name: 'Warehouse Packer' });

    if (!saveResult) throw new Error('saveLotPackingProgress returned null');

    // Reload order from DB and verify packed_qty is 0 for p2 & p3 (NOT overwritten to ordered_qty!)
    const reloaded = db.getOrders().find(o => o.id === order2.id)!;
    if (reloaded.status !== 'PACKING_IN_PROGRESS') {
      throw new Error(`Expected PACKING_IN_PROGRESS status, got ${reloaded.status}`);
    }

    const itP1 = reloaded.items!.find(i => i.product_id === p1.id)!;
    const itP2 = reloaded.items!.find(i => i.product_id === p2.id)!;
    const itP3 = reloaded.items!.find(i => i.product_id === p3.id)!;

    if (itP1.packed_qty !== 5) throw new Error(`Expected p1 packed_qty=5, got ${itP1.packed_qty}`);
    if (itP2.packed_qty !== 0) throw new Error(`Expected p2 packed_qty=0 (OOS), got ${itP2.packed_qty}`);
    if (itP3.packed_qty !== 0) throw new Error(`Expected p3 packed_qty=0 (OOS), got ${itP3.packed_qty}`);

    console.log('  ✅ Test 2 Passed: 0 packed quantities strictly preserved without reverting to ordered qty.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 2 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Packer Seals Lot with Shortages -> Status Syncs to 'Partially Fulfilled'
  // --------------------------------------------------------------------------
  try {
    console.log('Test 3: Packer seals lot with shortages (Mark Packed & Sealed)');
    const order = db.getOrders().find(o => o.id === testOrder2Id)!;
    const p1Item = order.items!.find(i => i.product_id === p1.id)!;
    const p2Item = order.items!.find(i => i.product_id === p2.id)!;
    const p3Item = order.items!.find(i => i.product_id === p3.id)!;

    const sealResult = db.saveLotPackingProgress({
      retailerId: ret.id,
      sourceOrderIds: [order.id],
      items: [
        { originOrderId: order.id, originItemId: p1Item.id, productId: p1.id, packedPieces: 5, packedCartons: 0, packedLoose: 5 },
        { originOrderId: order.id, originItemId: p2Item.id, productId: p2.id, packedPieces: 0, packedCartons: 0, packedLoose: 0 },
        { originOrderId: order.id, originItemId: p3Item.id, productId: p3.id, packedPieces: 0, packedCartons: 0, packedLoose: 0 }
      ],
      markAsSealed: true
    }, { id: 'packer-1', name: 'Warehouse Packer' });

    if (!sealResult) throw new Error('Mark packed and sealed returned null');

    const sealedOrder = db.getOrders().find(o => o.id === order.id)!;
    if (sealedOrder.status !== 'Partially Fulfilled') {
      throw new Error(`Expected status Partially Fulfilled due to shortages, got ${sealedOrder.status}`);
    }

    const itP2 = sealedOrder.items!.find(i => i.product_id === p2.id)!;
    const itP3 = sealedOrder.items!.find(i => i.product_id === p3.id)!;
    if (itP2.remaining_qty !== 1) throw new Error(`Expected p2 remaining_qty=1, got ${itP2.remaining_qty}`);
    if (itP3.remaining_qty !== 6) throw new Error(`Expected p3 remaining_qty=6, got ${itP3.remaining_qty}`);

    console.log('  ✅ Test 3 Passed: Lot sealed with shortages routed correctly to Partially Fulfilled with pending quantities.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 3 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Biller Invoice Generation (Only bills 5 pcs of P1, 0 pcs for P2 & P3)
  // --------------------------------------------------------------------------
  let generatedInvoiceId = '';
  try {
    console.log('Test 4: Biller generates GST invoice for packed lot (Only packed items billed)');
    const order = db.getOrders().find(o => o.id === testOrder2Id)!;
    const p1Item = order.items!.find(i => i.product_id === p1.id)!;

    const invoiceRes = db.generateInvoiceForPackedLot({
      retailerId: ret.id,
      sourceOrderIds: [order.id],
      items: [
        {
          originOrderId: order.id,
          originItemId: p1Item.id,
          productId: p1.id,
          productName: p1.name,
          sku: p1.sku,
          mrp: p1.mrp,
          unitsPerPack: 180,
          tradingUnit: 'Box',
          baseUnit: 'Piece',
          packedCartons: 0,
          packedLoose: 5,
          packedPieces: 5,
          unitRate: 180,
          purchaseCost: 150,
          hsn: '3307'
        }
      ]
    }, {
      paymentMode: 'Credit',
      notes: 'Biller invoice for in-stock pieces'
    }, { id: 'biller-1', name: 'Biller Desk' });

    if (!invoiceRes?.invoice) throw new Error('generateInvoiceForPackedLot returned null');
    generatedInvoiceId = invoiceRes.invoice.id;

    // Verify invoice items: should ONLY have 1 item (P1) for 5 pcs
    if (invoiceRes.invoice.items?.length !== 1) {
      throw new Error(`Expected exactly 1 invoice item, got ${invoiceRes.invoice.items?.length}`);
    }
    const invItem = invoiceRes.invoice.items[0];
    if (invItem.quantity !== 5) throw new Error(`Expected invoice item quantity 5, got ${invItem.quantity}`);
    if (invItem.product_id !== p1.id) throw new Error(`Expected invoice item product ${p1.id}, got ${invItem.product_id}`);

    // Verify origin order in DB: p1 is fulfilled, p2 and p3 remain pending
    const updatedOrder = db.getOrders().find(o => o.id === order.id)!;
    const upP1 = updatedOrder.items!.find(i => i.product_id === p1.id)!;
    const upP2 = updatedOrder.items!.find(i => i.product_id === p2.id)!;
    const upP3 = updatedOrder.items!.find(i => i.product_id === p3.id)!;

    if (upP1.fulfilled_qty !== 5) throw new Error(`Expected p1 fulfilled_qty=5, got ${upP1.fulfilled_qty}`);
    if (upP1.remaining_qty !== 0) throw new Error(`Expected p1 remaining_qty=0, got ${upP1.remaining_qty}`);
    if (upP2.remaining_qty !== 1) throw new Error(`Expected p2 remaining_qty=1, got ${upP2.remaining_qty}`);
    if (upP3.remaining_qty !== 6) throw new Error(`Expected p3 remaining_qty=6, got ${upP3.remaining_qty}`);
    if (updatedOrder.status !== 'Partially Fulfilled') {
      throw new Error(`Expected order status Partially Fulfilled, got ${updatedOrder.status}`);
    }

    console.log('  ✅ Test 4 Passed: Biller generated invoice for packed pieces only; parent order and backorders synchronized.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 4 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Stock Arrives & Packer Continues Packing Pending Backorder
  // --------------------------------------------------------------------------
  try {
    console.log('Test 5: Stock arrives -> Packer fulfills remaining pending pieces');
    const order = db.getOrders().find(o => o.id === testOrder2Id)!;
    const p2Item = order.items!.find(i => i.product_id === p2.id)!;
    const p3Item = order.items!.find(i => i.product_id === p3.id)!;

    // Packer packs newly arrived stock: 1 pc of p2, 6 pcs of p3
    const contRes = db.continuePackingPendingItems({
      retailerId: ret.id,
      items: [
        { originOrderId: order.id, originItemId: p2Item.id, productId: p2.id, newlyPackedPieces: 1, newlyPackedCartons: 0, newlyPackedLoose: 1 },
        { originOrderId: order.id, originItemId: p3Item.id, productId: p3.id, newlyPackedPieces: 6, newlyPackedCartons: 0, newlyPackedLoose: 6 }
      ]
    }, { id: 'packer-1', name: 'Warehouse Packer' });

    if (!contRes) throw new Error('continuePackingPendingItems returned null');

    const updatedOrder = db.getOrders().find(o => o.id === order.id)!;
    const upP2 = updatedOrder.items!.find(i => i.product_id === p2.id)!;
    const upP3 = updatedOrder.items!.find(i => i.product_id === p3.id)!;

    if (upP2.packed_qty !== 1) throw new Error(`Expected p2 packed_qty=1, got ${upP2.packed_qty}`);
    if (upP3.packed_qty !== 6) throw new Error(`Expected p3 packed_qty=6, got ${upP3.packed_qty}`);
    if (upP2.remaining_qty !== 0) throw new Error(`Expected p2 remaining_qty=0, got ${upP2.remaining_qty}`);
    if (upP3.remaining_qty !== 0) throw new Error(`Expected p3 remaining_qty=0, got ${upP3.remaining_qty}`);
    if (updatedOrder.status !== 'Packed') throw new Error(`Expected status Packed, got ${updatedOrder.status}`);

    console.log('  ✅ Test 5 Passed: Backorder fulfillment updated packed pieces and transitioned order to Packed for billing.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 5 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Biller Bills 2nd Shipment -> Order Transitions to Completed
  // --------------------------------------------------------------------------
  try {
    console.log('Test 6: Biller generates 2nd invoice -> Order completes 100%');
    const order = db.getOrders().find(o => o.id === testOrder2Id)!;
    const p2Item = order.items!.find(i => i.product_id === p2.id)!;
    const p3Item = order.items!.find(i => i.product_id === p3.id)!;

    const inv2 = db.generateInvoiceForPackedLot({
      retailerId: ret.id,
      sourceOrderIds: [order.id],
      items: [
        { originOrderId: order.id, originItemId: p2Item.id, productId: p2.id, productName: p2.name, sku: p2.sku, mrp: p2.mrp, unitsPerPack: 180, tradingUnit: 'Box', baseUnit: 'Piece', packedCartons: 0, packedLoose: 1, packedPieces: 1, unitRate: 180, purchaseCost: 150 },
        { originOrderId: order.id, originItemId: p3Item.id, productId: p3.id, productName: p3.name, sku: p3.sku, mrp: p3.mrp, unitsPerPack: 180, tradingUnit: 'Box', baseUnit: 'Piece', packedCartons: 0, packedLoose: 6, packedPieces: 6, unitRate: 180, purchaseCost: 150 }
      ]
    }, { paymentMode: 'Credit' }, { id: 'biller-1', name: 'Biller Desk' });

    if (!inv2?.invoice) throw new Error('2nd invoice generation failed');

    const completedOrder = db.getOrders().find(o => o.id === order.id)!;
    if (completedOrder.status !== 'Completed') {
      throw new Error(`Expected order status Completed, got ${completedOrder.status}`);
    }

    completedOrder.items?.forEach(it => {
      if ((it.remaining_qty || 0) > 0) {
        throw new Error(`Expected item ${it.product_id} remaining_qty=0, got ${it.remaining_qty}`);
      }
    });

    console.log('  ✅ Test 6 Passed: 2nd invoice generated and parent order marked Completed with 0 remaining.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 6 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Multi-Order Consolidated Lot Packing & 1-Bill Sync
  // --------------------------------------------------------------------------
  try {
    console.log('Test 7: Consolidated packing of 3 separate orders for same retailer into 1 Bill');
    const o1 = db.createOrder({ retailer_id: ret.id, items: [{ product_id: p1.id, carton_qty: 0, loose_qty: 2, quantity: 2, rate: 180, total_amount: 360 }] });
    const o2 = db.createOrder({ retailer_id: ret.id, items: [{ product_id: p1.id, carton_qty: 0, loose_qty: 3, quantity: 3, rate: 180, total_amount: 540 }] });
    const o3 = db.createOrder({ retailer_id: ret.id, items: [{ product_id: p1.id, carton_qty: 0, loose_qty: 4, quantity: 4, rate: 180, total_amount: 720 }] });
    if (!o1 || !o2 || !o3) throw new Error('Multi-order creation failed');

    db.fullyConfirmOrder(o1.id);
    db.fullyConfirmOrder(o2.id);
    db.fullyConfirmOrder(o3.id);

    // Total ordered for p1 across 3 orders = 2 + 3 + 4 = 9 pcs
    // Packer packs 9 pcs in consolidated terminal
    const multiDispatch = db.generateInvoiceForPackedLot({
      retailerId: ret.id,
      sourceOrderIds: [o1.id, o2.id, o3.id],
      items: [
        { originOrderId: o1.id, originItemId: o1.items![0].id, productId: p1.id, productName: p1.name, packedCartons: 0, packedLoose: 2, packedPieces: 2, unitRate: 180, purchaseCost: 150 },
        { originOrderId: o2.id, originItemId: o2.items![0].id, productId: p1.id, productName: p1.name, packedCartons: 0, packedLoose: 3, packedPieces: 3, unitRate: 180, purchaseCost: 150 },
        { originOrderId: o3.id, originItemId: o3.items![0].id, productId: p1.id, productName: p1.name, packedCartons: 0, packedLoose: 4, packedPieces: 4, unitRate: 180, purchaseCost: 150 }
      ]
    }, { paymentMode: 'Credit', notes: 'Consolidated multi-order bill' });

    if (!multiDispatch?.invoice) throw new Error('Consolidated invoice failed');
    if (multiDispatch.invoice.source_order_ids?.length !== 3) {
      throw new Error(`Expected 3 source_order_ids on invoice, got ${multiDispatch.invoice.source_order_ids?.length}`);
    }

    const o1Reload = db.getOrders().find(o => o.id === o1.id)!;
    const o2Reload = db.getOrders().find(o => o.id === o2.id)!;
    const o3Reload = db.getOrders().find(o => o.id === o3.id)!;

    if (o1Reload.status !== 'Completed' || o2Reload.status !== 'Completed' || o3Reload.status !== 'Completed') {
      throw new Error(`Expected all 3 orders to be Completed, got o1=${o1Reload.status}, o2=${o2Reload.status}, o3=${o3Reload.status}`);
    }

    console.log('  ✅ Test 7 Passed: 3 merged orders consolidated into 1 Bill, all source orders synced to Completed.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 7 Failed: ${err?.message}\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Admin Direct Portal Dispatch & Live Ledger Stock Sync
  // --------------------------------------------------------------------------
  try {
    console.log('Test 8: Admin direct portal lot dispatch and stock ledger OUT sync');
    const invBefore = db.getInventory().find(i => i.product_id === p1.id)?.physical_qty || 0;
    
    const adminOrder = db.createOrder({
      retailer_id: ret.id,
      items: [{ product_id: p1.id, carton_qty: 0, loose_qty: 2, quantity: 2, rate: 180, total_amount: 360 }]
    });
    if (!adminOrder) throw new Error('Admin order creation failed');
    db.fullyConfirmOrder(adminOrder.id);

    const adminDispatch = db.dispatchRetailerPackingLot({
      retailerId: ret.id,
      sourceOrderIds: [adminOrder.id],
      items: [{
        originOrderId: adminOrder.id,
        originItemId: adminOrder.items![0].id,
        productId: p1.id,
        productName: p1.name,
        sku: p1.sku,
        mrp: p1.mrp,
        unitsPerPack: 180,
        tradingUnit: 'Box',
        baseUnit: 'Piece',
        orderedCartons: 0,
        orderedLoose: 2,
        packedCartons: 0,
        packedLoose: 2,
        unitRate: 180,
        purchaseCost: 150
      }]
    }, { generateChallan: true });

    if (!adminDispatch?.invoice) throw new Error('Admin dispatch failed');
    if (!adminDispatch.challan) throw new Error('Delivery challan not generated');

    // Verify stock ledger entry recorded
    const ledgers = db.getLedger().filter(l => l.reference_id === adminDispatch.invoice.id);
    if (ledgers.length === 0) throw new Error('Stock ledger entry was not recorded for invoice');
    if (ledgers[0].direction !== 'OUT' || ledgers[0].change_qty !== -2) {
      throw new Error(`Expected ledger entry OUT -2, got ${ledgers[0].direction} ${ledgers[0].change_qty}`);
    }

    console.log('  ✅ Test 8 Passed: Admin portal dispatch generated invoice, challan, and atomic stock ledger entry.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ Test 8 Failed: ${err?.message}\n`);
  }

  console.log('================================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  return {
    passed: passedTests === totalTests,
    passedTests,
    totalTests
  };
}

if (require.main === module) {
  runOrderSyncTests().then(res => {
    if (!res.passed) process.exit(1);
  });
}
