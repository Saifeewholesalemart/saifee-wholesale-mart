// Saifee General Stores - Database Backup & Master Data Export Engine
import * as XLSX from 'xlsx';
import { 
  DatabaseBackupSnapshot, 
  Product, 
  Inventory, 
  InventoryBatch, 
  Category, 
  Company, 
  Invoice, 
  Retailer, 
  Payment, 
  Purchase, 
  Supplier, 
  Godown, 
  formatProductStockDisplay
} from '@/lib/db';

/**
 * Generates standard timestamped filename
 * Example: saifee_fmcg_backup_2026-09-30_1830.json
 */
export function generateBackupFileName(prefix = 'saifee_fmcg_backup', extension = 'json'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${prefix}_${year}-${month}-${day}_${hours}${minutes}.${extension}`;
}

/**
 * Triggers browser download for a Blob
 */
export function triggerBrowserDownload(blob: Blob, fileName: string) {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads full JSON database backup snapshot
 */
export function downloadJsonBackup(snapshot: DatabaseBackupSnapshot) {
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const fileName = generateBackupFileName('saifee_fmcg_backup', 'json');
  triggerBrowserDownload(blob, fileName);
  return fileName;
}

/**
 * Creates Excel file (.xlsx) or CSV file (.csv) and triggers browser download
 */
export function downloadWorkbookFile(
  sheets: { name: string; data: any[] }[],
  fileName: string,
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31)); // sheet names max 31 chars
  });

  if (format === 'csv') {
    // Generate CSV for the primary sheet with UTF-8 BOM for Windows Excel
    const firstSheetName = wb.SheetNames[0];
    const firstWs = wb.Sheets[firstSheetName];
    const csvContent = XLSX.utils.sheet_to_csv(firstWs);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const finalFileName = fileName.endsWith('.csv') ? fileName : `${fileName.replace(/\.xlsx$/, '')}.csv`;
    triggerBrowserDownload(blob, finalFileName);
  } else {
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName.replace(/\.csv$/, '')}.xlsx`;
    triggerBrowserDownload(blob, finalFileName);
  }
}

// ==========================================
// MASTER EXPORT: 1. PRODUCTS MASTER
// ==========================================
export function exportProductsMaster(
  products: Product[],
  inventory: Inventory[],
  batches: InventoryBatch[],
  categories: Category[],
  companies: Company[],
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  const companyMap = new Map(companies.map(c => [c.id, c.name]));
  const invMap = new Map<string, { physical: number; reserved: number; available: number }>();

  inventory.forEach(inv => {
    const prev = invMap.get(inv.product_id) || { physical: 0, reserved: 0, available: 0 };
    invMap.set(inv.product_id, {
      physical: prev.physical + (inv.physical_qty || 0),
      reserved: prev.reserved + (inv.reserved_qty || 0),
      available: prev.available + (inv.available_qty || 0)
    });
  });

  const rows = products.map(prod => {
    const inv = invMap.get(prod.id);
    const compName = (prod.company_id ? companyMap.get(prod.company_id) : '') || prod.brand || '-';
    const catName = prod.category || 'General';
    const totalPhysical = inv ? inv.physical : 0;
    const totalReserved = inv ? inv.reserved : 0;
    const totalAvailable = inv ? inv.available : 0;
    const unitsPerPack = prod.units_per_box_carton || 1;
    const stockDisplay = formatProductStockDisplay(totalAvailable, prod);

    const unitCost = prod.purchase_price ? (prod.purchase_price / unitsPerPack) : 0;
    const totalCostValue = (totalPhysical * unitCost).toFixed(2);
    const unitMrp = prod.mrp ? (prod.mrp / unitsPerPack) : 0;
    const totalMrpValue = (totalPhysical * unitMrp).toFixed(2);

    return {
      'Product Code': prod.product_code || prod.id,
      'Product Name': prod.name,
      'Company / Brand': compName,
      'Category': catName,
      'Subcategory': prod.subcategory || '-',
      'Barcode / SKU': prod.barcode || prod.sku || '-',
      'HSN Code': prod.hsn || '-',
      'GST Tax Rate (%)': prod.gst_percent ?? 18,
      'MRP / Carton (₹)': Number(prod.mrp || 0).toFixed(2),
      'MRP / Loose (₹)': Number(prod.loose_mrp || unitMrp).toFixed(2),
      'Purchase Price / Carton (₹)': Number(prod.purchase_price || 0).toFixed(2),
      'Purchase Price / Loose (₹)': Number(prod.loose_purchase_price || unitCost).toFixed(2),
      'Selling Price / Carton (₹)': Number(prod.selling_price || 0).toFixed(2),
      'Selling Price / Loose (₹)': Number(prod.loose_selling_price || (prod.selling_price / unitsPerPack)).toFixed(2),
      'Dealer Rate (₹)': prod.dealer_price ? Number(prod.dealer_price).toFixed(2) : '-',
      'Units Per Carton / Box': unitsPerPack,
      'Base Unit': prod.base_unit || 'Piece',
      'Trading Unit': prod.trading_unit || 'Box',
      'Stock Physical (Base Units)': totalPhysical,
      'Stock Available (Base Units)': totalAvailable,
      'Stock Reserved (Base Units)': totalReserved,
      'Stock Display': stockDisplay,
      'Stock Valuation @ Cost (₹)': totalCostValue,
      'Stock Valuation @ MRP (₹)': totalMrpValue,
      'Trade Mode': prod.trade_mode || 'BOTH',
      'Allow Loose Sale': prod.allow_loose_sale !== false ? 'Yes' : 'No',
      'Status': prod.active ? 'Active' : 'Inactive'
    };
  });

  const fileName = generateBackupFileName('saifee_products_master', format);
  downloadWorkbookFile([{ name: 'Products Master', data: rows }], fileName, format);
  return { count: rows.length, fileName };
}

// ==========================================
// MASTER EXPORT: 2. SALES REGISTER / INVOICES
// ==========================================
export function exportSalesRegisterInvoices(
  invoices: Invoice[],
  retailers: Retailer[],
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const retMap = new Map(retailers.map(r => [r.id, r]));

  const rows = invoices.map(inv => {
    const retailer = inv.retailer_id ? retMap.get(inv.retailer_id) : null;
    const shopName = retailer?.shop_name || 'Counter Customer';
    const contact = retailer?.mobile || retailer?.phone || '-';
    const gstin = retailer?.gstin || '-';
    const route = retailer?.route || retailer?.beat_name || '-';

    const grandTotal = Number(inv.grand_total || 0);
    const paidAmount = Number(inv.paid_amount || 0);
    const balanceDue = Number(inv.outstanding_amount ?? (grandTotal - paidAmount));
    const totalTax = Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0);

    return {
      'Invoice No': inv.invoice_number || inv.id,
      'Invoice Date': inv.date || '-',
      'Retailer / Shop Name': shopName,
      'Owner Name': retailer?.owner_name || '-',
      'Mobile No': contact,
      'Retailer GSTIN': gstin,
      'Route / Beat': route,
      'Place of Supply': inv.place_of_supply || 'Maharashtra (27)',
      'Items Count': inv.items?.length || 0,
      'Taxable Subtotal (₹)': Number(inv.taxable_value || inv.subtotal || 0).toFixed(2),
      'CGST (₹)': Number(inv.cgst || 0).toFixed(2),
      'SGST (₹)': Number(inv.sgst || 0).toFixed(2),
      'IGST (₹)': Number(inv.igst || 0).toFixed(2),
      'Total GST Tax (₹)': totalTax.toFixed(2),
      'Round Off (₹)': Number(inv.round_off || 0).toFixed(2),
      'Grand Total (₹)': grandTotal.toFixed(2),
      'Amount Paid (₹)': paidAmount.toFixed(2),
      'Balance Due (₹)': balanceDue.toFixed(2),
      'Payment Status': inv.payment_status || (balanceDue <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid'),
      'Payment Mode': inv.payment_mode || 'Credit'
    };
  });

  const fileName = generateBackupFileName('saifee_sales_register_invoices', format);
  downloadWorkbookFile([{ name: 'Sales Register', data: rows }], fileName, format);
  return { count: rows.length, fileName };
}

// ==========================================
// MASTER EXPORT: 3. RETAILER LEDGERS & OUTSTANDING
// ==========================================
export function exportRetailerLedgers(
  retailers: Retailer[],
  invoices: Invoice[],
  payments: Payment[],
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  // Aggregate sales and payments per retailer
  const invoiceAgg = new Map<string, { totalBilled: number; invoiceCount: number; pendingDue: number }>();
  invoices.forEach(inv => {
    if (!inv.retailer_id) return;
    const prev = invoiceAgg.get(inv.retailer_id) || { totalBilled: 0, invoiceCount: 0, pendingDue: 0 };
    const billTotal = Number(inv.grand_total || 0);
    const paid = Number(inv.paid_amount || 0);
    const due = Number(inv.outstanding_amount ?? (billTotal - paid));
    invoiceAgg.set(inv.retailer_id, {
      totalBilled: prev.totalBilled + billTotal,
      invoiceCount: prev.invoiceCount + 1,
      pendingDue: prev.pendingDue + (due > 0 ? due : 0)
    });
  });

  const paymentAgg = new Map<string, { totalPaid: number; paymentCount: number }>();
  payments.forEach(p => {
    if (!p.retailer_id) return;
    const prev = paymentAgg.get(p.retailer_id) || { totalPaid: 0, paymentCount: 0 };
    paymentAgg.set(p.retailer_id, {
      totalPaid: prev.totalPaid + Number(p.amount || 0),
      paymentCount: prev.paymentCount + 1
    });
  });

  const rows = retailers.map(ret => {
    const invStats = invoiceAgg.get(ret.id) || { totalBilled: 0, invoiceCount: 0, pendingDue: 0 };
    const payStats = paymentAgg.get(ret.id) || { totalPaid: 0, paymentCount: 0 };

    const creditLimit = Number(ret.credit_limit || 0);
    const currentOutstanding = Number(ret.current_balance ?? ret.outstanding_balance ?? ret.outstanding ?? invStats.pendingDue);
    const availableCredit = Math.max(0, creditLimit - currentOutstanding);

    return {
      'Retailer Code': ret.retailer_code || ret.id,
      'Shop Name': ret.shop_name,
      'Owner Name': ret.owner_name || '-',
      'Mobile / Contact': ret.mobile || ret.phone || '-',
      'GSTIN': ret.gstin || '-',
      'Address': ret.address || '-',
      'City': ret.city || '-',
      'State Code': ret.state_code || '27',
      'Route / Beat': ret.route || ret.beat_name || '-',
      'Credit Limit (₹)': creditLimit.toFixed(2),
      'Current Outstanding (₹)': currentOutstanding.toFixed(2),
      'Available Credit (₹)': availableCredit.toFixed(2),
      'Total Invoices Billed': invStats.invoiceCount,
      'Total Invoiced Value (₹)': invStats.totalBilled.toFixed(2),
      'Total Payments Recorded (₹)': payStats.totalPaid.toFixed(2),
      'Account Status': ret.active ? 'Active' : 'Inactive'
    };
  });

  const fileName = generateBackupFileName('saifee_retailer_ledgers_outstanding', format);
  downloadWorkbookFile([{ name: 'Retailer Ledgers', data: rows }], fileName, format);
  return { count: rows.length, fileName };
}

// ==========================================
// MASTER EXPORT: 4. PURCHASES REGISTER
// ==========================================
export function exportPurchasesRegister(
  purchases: Purchase[],
  suppliers: Supplier[],
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const supMap = new Map(suppliers.map(s => [s.id, s]));

  const rows = purchases.map(pur => {
    const supplier = pur.supplier_id ? supMap.get(pur.supplier_id) : null;
    const supName = supplier?.name || 'Vendor';
    const totalAmount = Number(pur.total_amount || 0);

    return {
      'Purchase ID': pur.id,
      'Supplier Invoice No': pur.invoice_number || pur.id,
      'Invoice Date': pur.invoice_date || pur.created_at?.split('T')[0] || '-',
      'Supplier / Vendor Name': supName,
      'Supplier GSTIN': supplier?.gstin || '-',
      'Supplier Address': supplier?.address || '-',
      'Items Count': pur.items?.length || 0,
      'Grand Total (₹)': totalAmount.toFixed(2),
      'Status': pur.status || 'Confirmed',
      'Created At': pur.created_at || '-'
    };
  });

  const fileName = generateBackupFileName('saifee_purchases_register', format);
  downloadWorkbookFile([{ name: 'Purchases Register', data: rows }], fileName, format);
  return { count: rows.length, fileName };
}

// ==========================================
// MASTER EXPORT: 5. INVENTORY BATCHES
// ==========================================
export function exportInventoryBatches(
  batches: InventoryBatch[],
  products: Product[],
  godowns: Godown[],
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const prodMap = new Map(products.map(p => [p.id, p]));
  const godownMap = new Map(godowns.map(g => [g.id, g.name]));

  const todayStr = new Date().toISOString().split('T')[0];

  const rows = batches.map(batch => {
    const product = prodMap.get(batch.product_id);
    const godownName = batch.godown_id ? (godownMap.get(batch.godown_id) || batch.godown) : (batch.godown || 'Main Godown');
    const isExpired = batch.expiry_date ? batch.expiry_date < todayStr : false;

    return {
      'Batch ID': batch.id,
      'Batch Number': batch.batch_number || 'Default Batch',
      'Product Name': product?.name || batch.product_id,
      'Barcode / SKU': product?.barcode || product?.sku || '-',
      'Warehouse / Godown': godownName,
      'Mfg Date': batch.mfg_date || '-',
      'Expiry Date': batch.expiry_date || '-',
      'Quantity (Base Units)': batch.quantity || 0,
      'Purchase Rate (₹)': Number(batch.purchase_rate || product?.purchase_price || 0).toFixed(2),
      'Selling Rate (₹)': Number(batch.selling_price || product?.selling_price || 0).toFixed(2),
      'MRP (₹)': Number(batch.mrp || product?.mrp || 0).toFixed(2),
      'Entry Date': batch.entry_date || '-',
      'Expiry Status': isExpired ? 'Expired' : 'Valid'
    };
  });

  const fileName = generateBackupFileName('saifee_inventory_batches', format);
  downloadWorkbookFile([{ name: 'Inventory Batches', data: rows }], fileName, format);
  return { count: rows.length, fileName };
}

// ==========================================
// MASTER EXPORT: 6. COMPREHENSIVE MULTI-SHEET WORKBOOK
// ==========================================
export function exportFullExcelMasterWorkbook(
  snapshot: DatabaseBackupSnapshot
) {
  const wb = XLSX.utils.book_new();

  // 1. Products Sheet
  const productRows = snapshot.tables.products.map(p => ({
    'Code': p.product_code || p.id,
    'Name': p.name,
    'Brand': p.brand || '-',
    'Category': p.category || '-',
    'MRP': p.mrp,
    'Purchase Price': p.purchase_price,
    'Selling Price': p.selling_price,
    'Units Per Box': p.units_per_box_carton,
    'GST %': p.gst_percent
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products');

  // 2. Invoices Sheet
  const invoiceRows = snapshot.tables.invoices.map(i => ({
    'Invoice No': i.invoice_number,
    'Date': i.date,
    'Retailer ID': i.retailer_id,
    'Taxable Value': i.taxable_value,
    'CGST': i.cgst,
    'SGST': i.sgst,
    'IGST': i.igst,
    'Grand Total': i.grand_total,
    'Paid Amount': i.paid_amount,
    'Outstanding Amount': i.outstanding_amount,
    'Status': i.payment_status
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), 'Invoices');

  // 3. Retailers Sheet
  const retailerRows = snapshot.tables.retailers.map(r => ({
    'Code': r.retailer_code,
    'Shop Name': r.shop_name,
    'Owner': r.owner_name,
    'Mobile': r.mobile,
    'GSTIN': r.gstin,
    'Route': r.route,
    'Credit Limit': r.credit_limit,
    'Outstanding': r.outstanding
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(retailerRows), 'Retailers');

  // 4. Batches Sheet
  const batchRows = snapshot.tables.batches.map(b => ({
    'Batch No': b.batch_number,
    'Product ID': b.product_id,
    'Quantity': b.quantity,
    'Mfg Date': b.mfg_date,
    'Expiry Date': b.expiry_date,
    'MRP': b.mrp,
    'Purchase Rate': b.purchase_rate
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batchRows), 'Batches');

  // 5. Purchases Sheet
  const purchaseRows = snapshot.tables.purchases.map(p => ({
    'Invoice No': p.invoice_number,
    'Date': p.invoice_date,
    'Supplier ID': p.supplier_id,
    'Grand Total': p.total_amount,
    'Status': p.status
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseRows), 'Purchases');

  // 6. Profiles & Users Sheet
  const profileRows = snapshot.tables.profiles.map(pr => ({
    'ID': pr.id,
    'Name': pr.name || pr.full_name,
    'Email / Username': pr.email,
    'Role': pr.role,
    'Profile Type': pr.profile_type,
    'Contact No': pr.contact_no || pr.mobile
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profileRows), 'Profiles');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = generateBackupFileName('saifee_complete_master_workbook', 'xlsx');
  triggerBrowserDownload(blob, fileName);
  return fileName;
}
