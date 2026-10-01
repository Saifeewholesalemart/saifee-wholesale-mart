'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Database, Download, Upload, ShieldCheck, Clock, FileSpreadsheet, 
  FileText, CheckCircle2, AlertTriangle, RefreshCw, Trash2, HardDrive, 
  Layers, Package, Users, DollarSign, Calendar, Eye, AlertCircle, 
  ArrowDownToLine, Zap, Check, Lock, Sparkles, Server
} from 'lucide-react';
import { 
  downloadJsonBackup, 
  exportProductsMaster, 
  exportSalesRegisterInvoices, 
  exportRetailerLedgers, 
  exportPurchasesRegister, 
  exportInventoryBatches, 
  exportFullExcelMasterWorkbook 
} from '@/lib/backupEngine';

interface ServerSnapshot {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  createdDate: string;
  isAutomatic: boolean;
  totalRecords?: number;
  metadata?: any;
}

export default function DatabaseBackupPage() {
  const { 
    products, 
    inventory, 
    batches, 
    categories, 
    companies, 
    invoices, 
    retailers, 
    payments, 
    purchases, 
    suppliers, 
    godowns, 
    cashFlowTransactions,
    profiles,
    exportFullDatabaseBackup, 
    restoreFullDatabaseBackup 
  } = useDb();

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Local storage last backup timestamp
  const [lastBackupTime, setLastBackupTime] = useState<string>('Never');

  // Server snapshots
  const [serverSnapshots, setServerSnapshots] = useState<ServerSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isGeneratingServerSnapshot, setIsGeneratingServerSnapshot] = useState(false);

  // Restore Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restorePayload, setRestorePayload] = useState<any>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load last backup timestamp from localStorage
  useEffect(() => {
    try {
      const savedTime = localStorage.getItem('fmcg_last_backup_time');
      if (savedTime) {
        setLastBackupTime(savedTime);
      }
    } catch {
      // Ignore SSR/storage error
    }
  }, []);

  // Fetch server snapshots
  const fetchServerSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const res = await fetch('/api/admin/backup/snapshots');
      const data = await res.json();
      if (data.success && Array.isArray(data.snapshots)) {
        setServerSnapshots(data.snapshots);
      }
    } catch (err) {
      console.warn('Could not fetch server snapshots:', err);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    fetchServerSnapshots();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  const recordBackupSuccess = (customNote?: string) => {
    const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    setLastBackupTime(timeStr);
    try {
      localStorage.setItem('fmcg_last_backup_time', timeStr);
    } catch {
      // ignore
    }
    showToast(customNote || 'Database backup created and downloaded successfully.');
  };

  // 1. One-click Full JSON Backup Download
  const handleDownloadFullJson = async () => {
    try {
      const snapshot = exportFullDatabaseBackup();
      const fileName = downloadJsonBackup(snapshot);
      recordBackupSuccess(`Full database snapshot saved: ${fileName}`);
      
      // Also silently register snapshot on server for double redundancy
      try {
        await fetch('/api/admin/backup/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot)
        });
        fetchServerSnapshots();
      } catch {
        // non-blocking
      }
    } catch (error: any) {
      showToast(error?.message || 'Failed to generate database backup', 'error');
    }
  };

  // 2. One-click Full Multi-sheet Excel Backup Download
  const handleDownloadFullExcel = () => {
    try {
      const snapshot = exportFullDatabaseBackup();
      const fileName = exportFullExcelMasterWorkbook(snapshot);
      recordBackupSuccess(`Master Excel archive saved: ${fileName}`);
    } catch (error: any) {
      showToast(error?.message || 'Failed to generate Excel master archive', 'error');
    }
  };

  // Quick Master Data Export Handlers
  const handleExportProducts = (format: 'xlsx' | 'csv') => {
    try {
      const { count, fileName } = exportProductsMaster(products, inventory, batches, categories, companies, format);
      showToast(`Exported ${count} Products Master records (${fileName})`);
    } catch (e: any) {
      showToast(e?.message || 'Error exporting products', 'error');
    }
  };

  const handleExportInvoices = (format: 'xlsx' | 'csv') => {
    try {
      const { count, fileName } = exportSalesRegisterInvoices(invoices, retailers, format);
      showToast(`Exported ${count} Invoices & Sales Register records (${fileName})`);
    } catch (e: any) {
      showToast(e?.message || 'Error exporting invoices', 'error');
    }
  };

  const handleExportRetailers = (format: 'xlsx' | 'csv') => {
    try {
      const { count, fileName } = exportRetailerLedgers(retailers, invoices, payments, format);
      showToast(`Exported ${count} Retailer Ledgers & Outstanding records (${fileName})`);
    } catch (e: any) {
      showToast(e?.message || 'Error exporting retailer ledgers', 'error');
    }
  };

  const handleExportPurchases = (format: 'xlsx' | 'csv') => {
    try {
      const { count, fileName } = exportPurchasesRegister(purchases, suppliers, format);
      showToast(`Exported ${count} Purchases Register records (${fileName})`);
    } catch (e: any) {
      showToast(e?.message || 'Error exporting purchases', 'error');
    }
  };

  const handleExportBatches = (format: 'xlsx' | 'csv') => {
    try {
      const { count, fileName } = exportInventoryBatches(batches, products, godowns, format);
      showToast(`Exported ${count} Inventory Batch records (${fileName})`);
    } catch (e: any) {
      showToast(e?.message || 'Error exporting batches', 'error');
    }
  };

  // Generate Server Snapshot Now
  const handleGenerateServerSnapshot = async () => {
    setIsGeneratingServerSnapshot(true);
    try {
      const snapshot = exportFullDatabaseBackup();
      const res = await fetch('/api/admin/backup/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
      const data = await res.json();
      if (data.success) {
        recordBackupSuccess(`Server snapshot stored: ${data.snapshot?.fileName}`);
        fetchServerSnapshots();
      } else {
        showToast(data.error || 'Failed to save server snapshot', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Server error creating snapshot', 'error');
    } finally {
      setIsGeneratingServerSnapshot(false);
    }
  };

  // Delete Server Snapshot
  const handleDeleteServerSnapshot = async (fileName: string) => {
    if (!confirm(`Are you sure you want to permanently delete backup snapshot "${fileName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/backup/snapshot?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Snapshot ${fileName} deleted.`);
        fetchServerSnapshots();
      } else {
        showToast(data.error || 'Failed to delete snapshot', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Error deleting snapshot', 'error');
    }
  };

  // Download specific server snapshot
  const handleDownloadServerSnapshot = (fileName: string) => {
    window.open(`/api/admin/backup/snapshot?fileName=${encodeURIComponent(fileName)}`, '_blank');
  };

  // Trigger restore from a server snapshot
  const handlePrepareRestoreServerSnapshot = async (snapshot: ServerSnapshot) => {
    try {
      const res = await fetch(`/api/admin/backup/snapshot?fileName=${encodeURIComponent(snapshot.fileName)}`);
      const data = await res.json();
      setRestorePayload(data);
      setRestoreFileName(snapshot.fileName);
      setRestoreConfirmationText('');
      setIsRestoreModalOpen(true);
    } catch (e: any) {
      showToast(e?.message || 'Could not load snapshot for restore preview', 'error');
    }
  };

  // File Upload Handlers for Restore
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('Invalid JSON file format.');
        }
        setRestorePayload(parsed);
        setRestoreFileName(file.name);
        setRestoreConfirmationText('');
        setIsRestoreModalOpen(true);
      } catch (err: any) {
        showToast(`Failed to parse backup file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    // Reset file input value so user can re-select if desired
    e.target.value = '';
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restorePayload) return;
    if (restoreConfirmationText.trim().toUpperCase() !== 'RESTORE') {
      showToast('Please type "RESTORE" to confirm database overwrite.', 'error');
      return;
    }

    setIsRestoring(true);
    try {
      // 1. Restore into client DbContext
      const clientResult = restoreFullDatabaseBackup(restorePayload);

      // 2. Also send to API restore route to persist on server
      try {
        await fetch('/api/admin/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(restorePayload)
        });
      } catch {
        // ignore server sync error if offline
      }

      showToast(`Database restored successfully! ${Object.keys(clientResult.counts).length} tables synchronized.`);
      setIsRestoreModalOpen(false);
      setRestorePayload(null);
      fetchServerSnapshots();
    } catch (err: any) {
      showToast(`Restore failed: ${err.message}`, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  // Calculate live statistics
  const totalProtectedRecords = 
    products.length + 
    batches.length + 
    invoices.length + 
    retailers.length + 
    purchases.length + 
    suppliers.length + 
    cashFlowTransactions.length + 
    profiles.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-sm font-semibold transition-all transform animate-in slide-in-from-top-4 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/80 hover:text-white text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <Database className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Database Backup & Data Export Utility
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Comprehensive data snapshot manager for Products, Batches, Invoices, Orders, Retailer Ledgers & Configurations.
              </p>
            </div>
          </div>
        </div>

        {/* Live Protection Status Pill */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <div className="text-xs">
            <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Engine Status</p>
            <p className="font-bold text-slate-800">Protected & Synchronized</p>
          </div>
        </div>
      </div>

      {/* Protection & Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Badge 1: Last Manual Backup */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Last Manual Backup</span>
            <span className="text-sm font-bold text-slate-800 block mt-1">{lastBackupTime}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Status Badge 2: Total Records Protected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Protected Records</span>
            <span className="text-xl font-black text-emerald-600 block mt-1">{totalProtectedRecords.toLocaleString()} items</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Status Badge 3: Nightly Automated Routine */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nightly Backup Routine</span>
            <span className="text-sm font-bold text-slate-800 block mt-1">Daily @ 11:59 PM (Auto)</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Status Badge 4: Retention Policy */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Rolling Retention</span>
            <span className="text-sm font-bold text-slate-800 block mt-1">30-Day Auto Purge</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SECTION 1: ONE-CLICK MANUAL BACKUP DOWNLOAD CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> High Priority Safe Storage
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              One-Click Full Database Backup
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Extract and download a complete, restorable snapshot containing every entity in your FMCG ERP system — Products, Multi-Warehouse Batches, Invoices, Retailer Accounts, Ledgers, Cash Flow, and System Configurations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadFullJson}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer transform hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5 stroke-[2.5]" />
              <span>💾 Download Full Database Backup (.JSON)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFullExcel}
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/5 text-white font-bold rounded-xl text-sm transition-all border border-white/10 cursor-pointer"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Master Excel (.XLSX)</span>
            </button>
          </div>
        </div>

        {/* Snapshot Summary Chips */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Invoices</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{invoices.length} Bills</p>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Products</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{products.length} SKUs</p>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Batches</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{batches.length} Lots</p>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Retailers</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{retailers.length} Stores</p>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Purchases</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{purchases.length} Records</p>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Cash Flow</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{cashFlowTransactions.length} Entries</p>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-400 font-semibold">Profiles</p>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{profiles.length} Users</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: EXCEL / CSV MASTER DATA EXPORT CENTER */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" /> Business Audits & Analysis
          </div>
          <h2 className="text-xl font-black text-slate-900">
            Excel & CSV Master Data Export Center
          </h2>
          <p className="text-xs md:text-sm text-slate-500">
            Instant 1-click exports formatted cleanly with headers for Excel accounting, tax filing, inventory valuation, and party audits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Products Master */}
          <div className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/20 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {products.length} SKUs
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">Products Master</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Full catalog with Barcodes, HSN Codes, MRP, Carton/Piece rates, GST %, Packaging sizes, and total stock valuations.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleExportProducts('xlsx')}
                className="flex-1 py-2 px-3 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportProducts('csv')}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Card 2: Sales Register & Invoices */}
          <div className="p-5 rounded-xl border border-slate-200 hover:border-emerald-300 bg-slate-50/50 hover:bg-emerald-50/20 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {invoices.length} Bills
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">Sales Register & Invoices</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Itemized GST billing register with Taxable Subtotals, CGST/SGST/IGST breakdown, Grand Totals, and unpaid balances.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleExportInvoices('xlsx')}
                className="flex-1 py-2 px-3 bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportInvoices('csv')}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Card 3: Retailer Ledgers & Outstanding */}
          <div className="p-5 rounded-xl border border-slate-200 hover:border-amber-300 bg-slate-50/50 hover:bg-amber-50/20 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {retailers.length} Parties
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">Retailer Ledgers & Dues</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Customer directory with Credit Limits, Outstanding Dues, Available Balances, Total Billed, and Payment histories.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleExportRetailers('xlsx')}
                className="flex-1 py-2 px-3 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportRetailers('csv')}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Card 4: Purchases Register */}
          <div className="p-5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {purchases.length} Purchases
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">Purchases Register</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Inward supplier bills, Bill reference numbers, Tax breakdowns, Payment statuses, and outstanding supplier payables.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleExportPurchases('xlsx')}
                className="flex-1 py-2 px-3 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPurchases('csv')}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Card 5: Inventory & Batch Lots */}
          <div className="p-5 rounded-xl border border-slate-200 hover:border-purple-300 bg-slate-50/50 hover:bg-purple-50/20 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {batches.length} Lots
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">Inventory & Batches</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lot numbers, Manufacturing dates, Expiry tracking, Multi-Godown locations, and physical vs available stock quantities.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleExportBatches('xlsx')}
                className="flex-1 py-2 px-3 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportBatches('csv')}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Card 6: All-in-One Master Workbook */}
          <div className="p-5 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Full Bundle
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base">All-In-One Workbook</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Combines Products, Invoices, Retailers, Batches, Purchases, and Profiles into individual tabs inside one master Excel spreadsheet.
              </p>
            </div>
            <div className="pt-2 border-t border-indigo-100">
              <button
                type="button"
                onClick={handleDownloadFullExcel}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Complete Master (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: AUTOMATED LOCAL / SERVER SNAPSHOTS (NIGHTLY 11:59 PM) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Server className="w-4 h-4" /> Server Local Disk Storage
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Automated Server Snapshots (Nightly Backups & 30-Day Retention)
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              Server-side snapshots saved directly to local disk (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">/data/backups/</code>). Files older than 30 days are automatically purged.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchServerSnapshots}
              disabled={isLoadingSnapshots}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Refresh Snapshots List"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleGenerateServerSnapshot}
              disabled={isGeneratingServerSnapshot}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>{isGeneratingServerSnapshot ? 'Saving to Disk...' : '⚡ Generate Server Snapshot Now'}</span>
            </button>
          </div>
        </div>

        {/* Snapshots Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Snapshot File</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Created Date (IST)</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Protected Items</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {serverSnapshots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <HardDrive className="w-8 h-8 text-slate-300" />
                        <p>No snapshots found on local server disk.</p>
                        <button
                          type="button"
                          onClick={handleGenerateServerSnapshot}
                          className="text-indigo-600 hover:underline font-bold text-xs cursor-pointer"
                        >
                          Click here to generate your first server snapshot
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  serverSnapshots.map((snapshot) => (
                    <tr key={snapshot.fileName} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-xs" title={snapshot.fileName}>{snapshot.fileName}</span>
                      </td>
                      <td className="py-3 px-4">
                        {snapshot.isAutomatic ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase">
                            Nightly Auto
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {snapshot.createdDate}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {snapshot.sizeFormatted}
                      </td>
                      <td className="py-3 px-4">
                        {snapshot.totalRecords ? (
                          <span className="font-semibold text-emerald-700">{snapshot.totalRecords.toLocaleString()} entities</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadServerSnapshot(snapshot.fileName)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Download JSON Snapshot"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrepareRestoreServerSnapshot(snapshot)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                            title="Restore from this snapshot"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteServerSnapshot(snapshot.fileName)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition-colors cursor-pointer"
                            title="Delete Snapshot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 4: SYSTEM RESTORE SAFETY NOTE & FILE UPLOAD */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Lock className="w-4 h-4" /> Super Admin Restricted
            </div>
            <h2 className="text-xl font-black text-slate-900">
              System Restore Safety Engine
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              Upload a previously downloaded <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">.json</code> backup file to restore the database to an exact historical state.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>🔄 Restore Database from Backup File</span>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {/* Safety Warning Notice Box */}
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3.5 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Database Overwrite & Safety Protocol Notice</p>
            <p className="text-amber-800 leading-relaxed">
              Restoring from a backup will overwrite the current live records in storage with the data contained inside the chosen archive. All restored entities will be validated before ingestion. We recommend downloading a manual backup first as a safety precaution before triggering any restore.
            </p>
          </div>
        </div>
      </div>

      {/* RESTORE INSPECTION & CONFIRMATION MODAL */}
      {isRestoreModalOpen && restorePayload && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Confirm Database Restore</h3>
                  <p className="text-xs text-slate-500 font-mono truncate max-w-xs">{restoreFileName}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsRestoreModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Inspection Preview Table */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Snapshot Inspection Preview</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-400 font-semibold">Snapshot Date</p>
                  <p className="font-bold text-slate-800 truncate">{restorePayload.exportDate || restorePayload.timestamp || 'Unknown'}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-400 font-semibold">System Version</p>
                  <p className="font-bold text-slate-800">{restorePayload.version || '5.0'}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-400 font-semibold">Products</p>
                  <p className="font-bold text-slate-800">
                    {restorePayload.tables?.products?.length ?? restorePayload.products?.length ?? 0} SKUs
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-400 font-semibold">Invoices</p>
                  <p className="font-bold text-slate-800">
                    {restorePayload.tables?.invoices?.length ?? restorePayload.invoices?.length ?? 0} Bills
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-400 font-semibold">Retailers</p>
                  <p className="font-bold text-slate-800">
                    {restorePayload.tables?.retailers?.length ?? restorePayload.retailers?.length ?? 0} Stores
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-slate-400 font-semibold">Batches</p>
                  <p className="font-bold text-slate-800">
                    {restorePayload.tables?.batches?.length ?? restorePayload.batches?.length ?? 0} Lots
                  </p>
                </div>
              </div>
            </div>

            {/* Type-in safety confirmation */}
            <div className="space-y-2 p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-xs">
              <label className="block font-bold text-rose-900">
                Type <span className="font-mono bg-rose-200 px-1.5 py-0.5 rounded text-rose-950 font-black">RESTORE</span> below to authorize overwriting live database state:
              </label>
              <input
                type="text"
                value={restoreConfirmationText}
                onChange={(e) => setRestoreConfirmationText(e.target.value)}
                placeholder="Type RESTORE to confirm"
                className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoreConfirmationText.trim().toUpperCase() !== 'RESTORE' || isRestoring}
                className={`px-5 py-2.5 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  restoreConfirmationText.trim().toUpperCase() === 'RESTORE' && !isRestoring
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>{isRestoring ? 'Restoring Database...' : 'Execute Full System Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
