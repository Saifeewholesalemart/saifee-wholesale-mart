'use client';

import React, { useState, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  TrendingUp, DollarSign, Store, Building2, Users, 
  PackageCheck, Package, CreditCard, FileSpreadsheet, 
  ShoppingCart, Calendar, Warehouse, Shield, CheckCircle2,
  Printer, ArrowLeft, X
} from 'lucide-react';
import { 
  ReportFilterState, UserContext,
  getInvoiceWiseSales, getSalesSummary, getProductWiseProfit,
  getRetailerSalesSummary, getCompanyWiseSales, getSalespersonSales,
  getPurchaseSummary, getCurrentStock, getRetailerOutstandingAging,
  getHSNWiseSales, getOrderSummary, getBatchExpiryReport
} from '@/lib/reportsEngine';
import ReportFilterBar from '@/components/reports/ReportFilterBar';
import FilterDiagnosticsBar from '@/components/reports/FilterDiagnosticsBar';

// Category Views
import SalesReportsView from '@/components/reports/categories/SalesReportsView';
import ProfitLossReportsView from '@/components/reports/categories/ProfitLossReportsView';
import RetailerReportsView from '@/components/reports/categories/RetailerReportsView';
import CompanyBrandReportsView from '@/components/reports/categories/CompanyBrandReportsView';
import SalespersonReportsView from '@/components/reports/categories/SalespersonReportsView';
import PurchaseReportsView from '@/components/reports/categories/PurchaseReportsView';
import InventoryReportsView from '@/components/reports/categories/InventoryReportsView';
import OutstandingReportsView from '@/components/reports/categories/OutstandingReportsView';
import GSTReportsView from '@/components/reports/categories/GSTReportsView';
import OrderReportsView from '@/components/reports/categories/OrderReportsView';
import BatchExpiryReportsView from '@/components/reports/categories/BatchExpiryReportsView';
import GodownReportsView from '@/components/reports/categories/GodownReportsView';
import PartyItemReportsView from '@/components/reports/categories/PartyItemReportsView';

export type ReportCategory = 
  | 'sales' 
  | 'party_item'
  | 'profit_loss' 
  | 'retailer' 
  | 'company_brand' 
  | 'salesperson' 
  | 'purchase' 
  | 'inventory' 
  | 'outstanding' 
  | 'gst' 
  | 'orders' 
  | 'batch_expiry' 
  | 'godown';

export default function AdminReports() {
  const db = useDb();
  const { currentUser, setCurrentUser, invoices, retailers, products, companies, profiles, purchases, payments, salesReturns, batches, inventory, ledger, suppliers } = db;

  // Active Category State
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('sales');

  // Shared Global Filter State across reports
  const [filters, setFilters] = useState<ReportFilterState>({
    datePreset: 'this_month',
    paymentStatus: 'All',
    orderStatus: 'All',
    expiryStatus: 'All'
  });

  const [showCharts, setShowCharts] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Database snapshot
  const dbState = {
    invoices,
    orders: db.orders,
    fulfilments: db.fulfilments,
    products,
    retailers,
    companies,
    profiles,
    purchases,
    payments,
    salesReturns,
    batches,
    inventory,
    ledger,
    suppliers,
    categories: db.categories || []
  };

  const userContext: UserContext = {
    role: currentUser?.role || 'admin',
    userId: currentUser?.id,
    companyId: currentUser?.company_id,
    retailerId: currentUser?.retailer_id
  };

  // 13 Report Categories Configuration
  const categories: { id: ReportCategory; name: string; shortName: string; icon: any; badge?: string }[] = [
    { id: 'sales', name: 'A. Sales Reports', shortName: 'Sales', icon: TrendingUp },
    { id: 'party_item', name: 'B. Party Report By Item', shortName: 'Party Report', icon: Users, badge: 'New' },
    { id: 'profit_loss', name: 'C. Profit & Loss', shortName: 'P&L / Margin', icon: DollarSign, badge: 'Admin' },
    { id: 'retailer', name: 'D. Retailer Reports', shortName: 'Retailers', icon: Store },
    { id: 'company_brand', name: 'E. Company & Brand', shortName: 'Companies', icon: Building2 },
    { id: 'salesperson', name: 'F. Salesperson Reports', shortName: 'Sales Reps', icon: Users },
    { id: 'purchase', name: 'G. Purchase Reports', shortName: 'Purchases', icon: PackageCheck },
    { id: 'inventory', name: 'H. Inventory Reports', shortName: 'Inventory', icon: Package },
    { id: 'outstanding', name: 'I. Outstanding & Payments', shortName: 'Receivables', icon: CreditCard },
    { id: 'gst', name: 'J. GST Reports', shortName: 'GST Returns', icon: FileSpreadsheet },
    { id: 'orders', name: 'K. Order Reports', shortName: 'Orders', icon: ShoppingCart },
    { id: 'batch_expiry', name: 'L. Batch & Expiry', shortName: 'Batch/Expiry', icon: Calendar },
    { id: 'godown', name: 'M. Godown Reports', shortName: 'Godown', icon: Warehouse }
  ];

  // Selected Invoice for inspection modal
  const inspectedInvoice = invoices.find(i => i.id === selectedInvoiceId);
  const inspectedRetailer = inspectedInvoice ? retailers.find(r => r.id === inspectedInvoice.retailer_id) : null;

  // Compute Export Dataset dynamically based on active category and active filters
  const exportConfig = useMemo(() => {
    switch (activeCategory) {
      case 'sales': {
        const data = getInvoiceWiseSales(filters, dbState, userContext);
        const summary = getSalesSummary(filters, dbState, userContext);
        const columns = [
          { header: 'Invoice #', key: 'invoiceNumber' },
          { header: 'Date', key: 'invoiceDate' },
          { header: 'Retailer', key: 'retailerName' },
          { header: 'Retailer Code', key: 'retailerCode' },
          { header: 'Salesperson', key: 'salespersonName' },
          { header: 'Items Count', key: 'itemCount', format: 'number' as const },
          { header: 'Quantity Sold', key: 'totalQuantity', format: 'number' as const },
          { header: 'Gross Subtotal', key: 'grossAmount', format: 'currency' as const },
          { header: 'Discount', key: 'discount', format: 'currency' as const },
          { header: 'GST Amount', key: 'gst', format: 'currency' as const },
          { header: 'Final Invoice Amount', key: 'finalInvoiceAmount', format: 'currency' as const },
          { header: 'Paid Amount', key: 'paidAmount', format: 'currency' as const },
          { header: 'Outstanding Amount', key: 'outstandingAmount', format: 'currency' as const },
          { header: 'Payment Status', key: 'paymentStatus' }
        ];
        const totals = {
          invoiceNumber: 'TOTAL',
          totalQuantity: summary.totalQuantitySold,
          grossAmount: summary.grossSales,
          discount: summary.discount,
          gst: summary.gst,
          finalInvoiceAmount: summary.netInvoiceValue,
          paidAmount: summary.totalCollection,
          outstandingAmount: summary.totalOutstanding
        };
        return { columns, data, totals };
      }
      case 'profit_loss': {
        const data = getProductWiseProfit(filters, dbState, userContext);
        const columns = [
          { header: 'Product Name', key: 'name' },
          { header: 'Category', key: 'category' },
          { header: 'Brand', key: 'brand' },
          { header: 'Variant', key: 'variantPacking' },
          { header: 'Qty Sold', key: 'quantitySold', format: 'number' as const },
          { header: 'Net Sales', key: 'netSalesExclGst', format: 'currency' as const },
          { header: 'COGS', key: 'actualCogs', format: 'currency' as const },
          { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const },
          { header: 'Margin %', key: 'grossMarginPercent', format: 'percent' as const }
        ];
        return { columns, data, totals: undefined };
      }
      case 'retailer': {
        const data = getRetailerSalesSummary(filters, dbState, userContext);
        const columns = [
          { header: 'Retailer Name', key: 'retailerName' },
          { header: 'Retailer Code', key: 'retailerCode' },
          { header: 'City', key: 'city' },
          { header: 'Orders', key: 'orderCount', format: 'number' as const },
          { header: 'Invoices', key: 'invoiceCount', format: 'number' as const },
          { header: 'Qty Sold', key: 'totalQuantity', format: 'number' as const },
          { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const },
          { header: 'Discount', key: 'discount', format: 'currency' as const },
          { header: 'Net Sales', key: 'netSales', format: 'currency' as const },
          { header: 'Collection', key: 'collection', format: 'currency' as const },
          { header: 'Outstanding', key: 'outstanding', format: 'currency' as const }
        ];
        return { columns, data, totals: undefined };
      }
      case 'company_brand': {
        const data = getCompanyWiseSales(filters, dbState, userContext);
        const columns = [
          { header: 'Company Name', key: 'companyName' },
          { header: 'Code', key: 'code' },
          { header: 'Products', key: 'productCount', format: 'number' as const },
          { header: 'Qty Sold', key: 'quantitySold', format: 'number' as const },
          { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const },
          { header: 'Discount', key: 'discount', format: 'currency' as const },
          { header: 'Net Sales', key: 'netSales', format: 'currency' as const },
          { header: 'Actual Cost', key: 'actualCost', format: 'currency' as const },
          { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const },
          { header: 'Margin %', key: 'grossMarginPercent', format: 'percent' as const },
          { header: 'Sales Return', key: 'salesReturn', format: 'currency' as const }
        ];
        return { columns, data, totals: undefined };
      }
      case 'salesperson': {
        const data = getSalespersonSales(filters, dbState, userContext);
        const columns = [
          { header: 'Salesperson Name', key: 'salespersonName' },
          { header: 'Role', key: 'role' },
          { header: 'Stores Served', key: 'retailersServed', format: 'number' as const },
          { header: 'Orders', key: 'orderCount', format: 'number' as const },
          { header: 'Invoices', key: 'invoiceCount', format: 'number' as const },
          { header: 'Qty Sold', key: 'quantitySold', format: 'number' as const },
          { header: 'Gross Sales', key: 'grossSales', format: 'currency' as const },
          { header: 'Discount Given', key: 'discountGiven', format: 'currency' as const },
          { header: 'Net Sales', key: 'netSales', format: 'currency' as const },
          { header: 'Collection', key: 'collection', format: 'currency' as const },
          { header: 'Outstanding', key: 'outstanding', format: 'currency' as const },
          { header: 'Gross Profit', key: 'grossProfit', format: 'currency' as const }
        ];
        return { columns, data, totals: undefined };
      }
      case 'orders': {
        const data = getOrderSummary(filters, dbState, userContext);
        const columns = [
          { header: 'Order #', key: 'orderNumber' },
          { header: 'Date', key: 'orderDate' },
          { header: 'Retailer', key: 'retailerName' },
          { header: 'Salesperson', key: 'salespersonName' },
          { header: 'Status', key: 'status' },
          { header: 'Items', key: 'itemCount', format: 'number' as const },
          { header: 'Ordered Qty', key: 'orderedQty', format: 'number' as const },
          { header: 'Confirmed Qty', key: 'confirmedQty', format: 'number' as const },
          { header: 'Pending Qty', key: 'pendingQty', format: 'number' as const },
          { header: 'Order Value', key: 'orderValue', format: 'currency' as const }
        ];
        return { columns, data, totals: undefined };
      }
      case 'gst': {
        const data = getHSNWiseSales(filters, dbState, userContext);
        const columns = [
          { header: 'HSN Code', key: 'hsn' },
          { header: 'Products', key: 'productNames' },
          { header: 'Category', key: 'category' },
          { header: 'Taxable Qty', key: 'taxableQuantity', format: 'number' as const },
          { header: 'Taxable Value', key: 'taxableValue', format: 'currency' as const },
          { header: 'CGST', key: 'cgst', format: 'currency' as const },
          { header: 'SGST', key: 'sgst', format: 'currency' as const },
          { header: 'IGST', key: 'igst', format: 'currency' as const },
          { header: 'Total GST', key: 'totalGst', format: 'currency' as const },
          { header: 'Total Invoice Value', key: 'totalInvoiceAmount', format: 'currency' as const }
        ];
        return { columns, data, totals: undefined };
      }
      default: {
        const data = getInvoiceWiseSales(filters, dbState, userContext);
        const columns = [
          { header: 'Invoice #', key: 'invoiceNumber' },
          { header: 'Date', key: 'invoiceDate' },
          { header: 'Retailer', key: 'retailerName' },
          { header: 'Salesperson', key: 'salespersonName' },
          { header: 'Grand Total', key: 'finalInvoiceAmount', format: 'currency' as const },
          { header: 'Payment Status', key: 'paymentStatus' }
        ];
        return { columns, data, totals: undefined };
      }
    }
  }, [activeCategory, filters, dbState, userContext]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-black rounded uppercase tracking-wider">
              Distributor Management System
            </span>
            <span className="text-xs text-slate-400 font-bold">&bull; 5,500+ FMCG Catalog</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1 tracking-tight">
            ERP Financial &amp; Operations Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit commercial sales, batch FIFO gross margins, stock valuations, aged receivables, and tax filings.
          </p>
        </div>

        {/* Right Tools (Diagnostics Toggle & Role Switcher) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              showDiagnostics
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🧪</span>
            <span className="hidden sm:inline">{showDiagnostics ? 'Hide Diagnostics' : 'Filter Diagnostics'}</span>
          </button>

          {/* Role Switcher for Testing Access Control */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <Shield className="w-4 h-4 text-slate-500 ml-1.5" />
            <span className="text-xs font-bold text-slate-500 uppercase mr-1">Role:</span>
            <select
              value={currentUser?.id || 'p-admin-1'}
              onChange={(e) => setCurrentUser(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="p-admin-1">Distributor Admin (Full Access)</option>
              <option value="p-dist-sales-1">Distributor Salesperson (Rajesh)</option>
              <option value="p-co-sales-1">Company Salesperson (Parle Suresh)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 12 Report Categories Navigation Bar */}
      <div className="erp-card bg-white p-2.5 shadow-sm border border-slate-200 no-print overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{cat.name}</span>
                {cat.badge && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-extrabold ${
                    isActive ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {cat.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Common Universal Report Filter Bar */}
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        dbState={dbState}
        userContext={userContext}
        reportTitle={categories.find(c => c.id === activeCategory)?.name || 'Distributor Report'}
        exportColumns={exportConfig.columns}
        exportData={exportConfig.data}
        exportTotals={exportConfig.totals}
        showCharts={showCharts}
        onToggleCharts={() => setShowCharts(!showCharts)}
      />

      {/* Interactive Filter Diagnostics & Testing Bar (when toggled) */}
      {showDiagnostics && (
        <FilterDiagnosticsBar
          filters={filters}
          onChange={setFilters}
          dbState={dbState}
          userContext={userContext}
          activeCategory={activeCategory}
        />
      )}

      {/* DYNAMIC REPORT CATEGORY VIEW */}
      <div className="transition-all duration-150">
        {activeCategory === 'sales' && (
          <SalesReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
            onSelectInvoice={(id) => setSelectedInvoiceId(id)}
          />
        )}

        {activeCategory === 'party_item' && (
          <PartyItemReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'profit_loss' && (
          <ProfitLossReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
            onSelectInvoice={(id) => setSelectedInvoiceId(id)}
          />
        )}

        {activeCategory === 'retailer' && (
          <RetailerReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'company_brand' && (
          <CompanyBrandReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'salesperson' && (
          <SalespersonReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'purchase' && (
          <PurchaseReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'inventory' && (
          <InventoryReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'outstanding' && (
          <OutstandingReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
            onSelectInvoice={(id) => setSelectedInvoiceId(id)}
          />
        )}

        {activeCategory === 'gst' && (
          <GSTReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
            onSelectInvoice={(id) => setSelectedInvoiceId(id)}
          />
        )}

        {activeCategory === 'orders' && (
          <OrderReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'batch_expiry' && (
          <BatchExpiryReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}

        {activeCategory === 'godown' && (
          <GodownReportsView
            filters={filters}
            dbState={dbState}
            userContext={userContext}
            showCharts={showCharts}
          />
        )}
      </div>

      {/* Invoice Detail Quick Inspection Modal */}
      {inspectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold tracking-wide">Tax Invoice: {inspectedInvoice.invoice_number}</h3>
                <p className="text-xs text-slate-400">
                  {inspectedRetailer?.shop_name} &bull; {inspectedInvoice.date.slice(0, 10)}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoiceId(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block">Place of Supply</span>
                  <span className="font-bold text-slate-800">{inspectedInvoice.place_of_supply}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">GSTIN</span>
                  <span className="font-mono font-bold text-slate-800">{inspectedRetailer?.gstin || 'URP'}</span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Invoice Line Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5 text-right">Rate</th>
                        <th className="p-2.5 text-right">Taxable</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectedInvoice.items?.map((item, idx) => {
                        const prod = products.find(p => p.id === item.product_id);
                        return (
                          <tr key={idx}>
                            <td className="p-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-slate-800">{prod?.name || item.product_id}</span>
                                {prod?.mrp && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                                    MRP: ₹{prod.mrp}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-medium">{item.packing}</span>
                            </td>
                            <td className="p-2.5 text-right font-semibold">{item.quantity} {item.trading_unit}</td>
                            <td className="p-2.5 text-right">₹{item.rate}</td>
                            <td className="p-2.5 text-right font-medium">₹{item.taxable_value.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-extrabold text-slate-900">₹{item.total_amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{inspectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span className="font-bold text-amber-600">-₹{inspectedInvoice.discount_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Value</span>
                  <span className="font-bold">₹{inspectedInvoice.taxable_value.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CGST / SGST</span>
                  <span className="font-bold">₹{(inspectedInvoice.cgst + inspectedInvoice.sgst).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-indigo-950">
                  <span>Grand Total</span>
                  <span className="text-indigo-700">₹{inspectedInvoice.grand_total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-500 font-semibold">Payment Received</span>
                  <span className="font-bold text-emerald-600">₹{inspectedInvoice.paid_amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Outstanding Balance</span>
                  <span className="font-bold text-red-600">₹{inspectedInvoice.outstanding_amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setSelectedInvoiceId(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
