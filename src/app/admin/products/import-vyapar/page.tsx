'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, AlertCircle, 
  ArrowRight, ArrowLeft, RefreshCw, X, Search, Filter, Eye, Download, 
  RotateCcw, Package, Layers, ShieldCheck, HelpCircle, Check, Sparkles, 
  Boxes, Landmark, ChevronRight, Info, AlertOctagon, History, FileText,
  SlidersHorizontal, ChevronDown, CheckCheck
} from 'lucide-react';
import { 
  TARGET_PRODUCT_FIELDS, TargetFieldDef, ProcessedImportRow,
  parseUploadedVyaparFile, autoDetectVyaparColumnMapping, 
  validateAndMatchVyaparRows, generateVyaparErrorReportCsv,
  generateVyaparSampleWorkbook
} from '@/lib/vyaparImportEngine';
import { VyaparImportBatch, formatQuantityDisplay } from '@/lib/db';
import SmartSearchBar from '@/components/SmartSearchBar';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'confirm' | 'processing' | 'complete';

export default function VyaparProductImportPage() {
  const { 
    products, companies, vyaparImports, executeVyaparBatchImport, 
    rollbackVyaparImport, currentUser, refreshState 
  } = useDb();
  const router = useRouter();

  // Primary Active Tab: 'wizard' | 'history'
  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');

  // Step 1: Upload State
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Mapping State
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Step 3: Validation & Matching State
  const [processedRows, setProcessedRows] = useState<ProcessedImportRow[]>([]);
  const [globalMatchPolicy, setGlobalMatchPolicy] = useState<'update' | 'skip' | 'prompt'>('update');
  const [previewFilterTab, setPreviewFilterTab] = useState<'all' | 'new' | 'exact' | 'fuzzy' | 'errors' | 'skipped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowForReview, setSelectedRowForReview] = useState<ProcessedImportRow | null>(null);

  // Step 5: Live Execution Progress
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [importResult, setImportResult] = useState<{ importId: string; batch: VyaparImportBatch } | null>(null);

  // History Tab States
  const [selectedHistoryBatch, setSelectedHistoryBatch] = useState<VyaparImportBatch | null>(null);
  const [rollbackModalBatch, setRollbackModalBatch] = useState<VyaparImportBatch | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackStatusMsg, setRollbackStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ----------------------------------------------------
  // HANDLERS: STEP 1 - FILE UPLOAD & PARSING
  // ----------------------------------------------------

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processSelectedFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    processSelectedFile(droppedFile);
  };

  const processSelectedFile = async (selectedFile: File) => {
    setUploadError(null);
    setIsParsing(true);
    try {
      const parsed = await parseUploadedVyaparFile(selectedFile);
      setFile(selectedFile);
      setRawHeaders(parsed.rawHeaders);
      setRawRows(parsed.rawRows);
      setSheetNames(parsed.sheetNames);
      setActiveSheet(parsed.activeSheet);
      setFileSize(parsed.fileSize);

      // Run auto-column detection heuristics
      const detected = autoDetectVyaparColumnMapping(parsed.rawHeaders);
      setColumnMapping(detected);

      setCurrentStep('mapping');
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to parse the uploaded file. Please ensure it is a valid Excel or CSV spreadsheet.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const buffer = generateVyaparSampleWorkbook();
    const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Vyapar_Product_Import_Sample_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // HANDLERS: STEP 2 - COLUMN MAPPING
  // ----------------------------------------------------

  const handleMapColumn = (targetKey: string, sourceHeader: string) => {
    setColumnMapping(prev => {
      const updated = { ...prev };
      if (!sourceHeader) {
        delete updated[targetKey];
      } else {
        updated[targetKey] = sourceHeader;
      }
      return updated;
    });
  };

  const handleAutoDetectAll = () => {
    const detected = autoDetectVyaparColumnMapping(rawHeaders);
    setColumnMapping(detected);
  };

  const handleResetMapping = () => {
    setColumnMapping({});
  };

  const isRequiredMappingComplete = useMemo(() => {
    const requiredKeys = TARGET_PRODUCT_FIELDS.filter(f => f.required).map(f => f.key);
    return requiredKeys.every(k => !!columnMapping[k]);
  }, [columnMapping]);

  const handleProceedToValidation = () => {
    if (!isRequiredMappingComplete) {
      alert('Please map all required fields: Product Name, MRP, Purchase Price, and Selling Price.');
      return;
    }

    // Run validation and matching
    const processed = validateAndMatchVyaparRows(rawRows, columnMapping, products, companies);
    setProcessedRows(processed);
    setCurrentStep('preview');
  };

  // ----------------------------------------------------
  // HANDLERS: STEP 3 - VALIDATION & MATCHING PREVIEW
  // ----------------------------------------------------

  const previewStats = useMemo(() => {
    const total = processedRows.length;
    const valid = processedRows.filter(r => r.isValid).length;
    const invalid = total - valid;
    const exactMatches = processedRows.filter(r => r.matchType === 'EXACT_MATCH').length;
    const fuzzyMatches = processedRows.filter(r => r.matchType === 'FUZZY_MATCH').length;
    const newItems = processedRows.filter(r => r.matchType === 'NEW').length;
    const toCreate = processedRows.filter(r => r.action === 'CREATE_NEW').length;
    const toUpdate = processedRows.filter(r => r.action === 'UPDATE_EXISTING').length;
    const toSkip = processedRows.filter(r => r.action === 'SKIP').length;
    const totalStockUnits = processedRows.reduce((sum, r) => {
      if (r.action === 'SKIP' || !r.isValid) return sum;
      const units = r.normalizedData.units_per_box_carton || 1;
      const stock = r.normalizedData.stock_qty || 0;
      return sum + (stock * units);
    }, 0);

    return {
      total,
      valid,
      invalid,
      exactMatches,
      fuzzyMatches,
      newItems,
      toCreate,
      toUpdate,
      toSkip,
      totalStockUnits
    };
  }, [processedRows]);

  const filteredPreviewRows = useMemo(() => {
    return processedRows.filter(row => {
      // Tab filter
      if (previewFilterTab === 'new' && row.matchType !== 'NEW') return false;
      if (previewFilterTab === 'exact' && row.matchType !== 'EXACT_MATCH') return false;
      if (previewFilterTab === 'fuzzy' && row.matchType !== 'FUZZY_MATCH') return false;
      if (previewFilterTab === 'errors' && row.isValid) return false;
      if (previewFilterTab === 'skipped' && row.action !== 'SKIP') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (row.normalizedData.name || '').toLowerCase();
        const sku = (row.normalizedData.sku || '').toLowerCase();
        const barcode = (row.normalizedData.barcode || '').toLowerCase();
        const brand = (row.normalizedData.brand || '').toLowerCase();
        const comp = (row.normalizedData.company_name || '').toLowerCase();
        return name.includes(q) || sku.includes(q) || barcode.includes(q) || brand.includes(q) || comp.includes(q);
      }

      return true;
    });
  }, [processedRows, previewFilterTab, searchQuery]);

  const handleRowActionChange = (rowNumber: number, action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'SKIP') => {
    setProcessedRows(prev => prev.map(r => r.rowNumber === rowNumber ? { ...r, action } : r));
  };

  const handleApplyGlobalPolicy = (policy: 'update' | 'skip' | 'prompt') => {
    setGlobalMatchPolicy(policy);
    setProcessedRows(prev => prev.map(r => {
      if (!r.isValid) return { ...r, action: 'SKIP' };
      if (r.matchType === 'EXACT_MATCH') {
        return { ...r, action: policy === 'skip' ? 'SKIP' : 'UPDATE_EXISTING' };
      }
      if (r.matchType === 'FUZZY_MATCH') {
        return { ...r, action: policy === 'update' ? 'UPDATE_EXISTING' : 'SKIP' };
      }
      return { ...r, action: 'CREATE_NEW' };
    }));
  };

  const handleDownloadErrorReport = () => {
    const csvContent = generateVyaparErrorReportCsv(processedRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vyapar_Import_Errors_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ----------------------------------------------------
  // HANDLERS: STEP 4 & 5 - EXECUTION & PROGRESS
  // ----------------------------------------------------

  const handleStartImport = async () => {
    setCurrentStep('processing');
    setProgressPercent(5);
    setProgressText('Preparing products and opening stock ledgers...');

    // Extract valid actionable rows
    const actionableRows = processedRows.filter(r => r.isValid && r.action !== 'SKIP');

    const mappedPayload = actionableRows.map(r => ({
      rowNumber: r.rowNumber,
      action: r.action,
      existingProductId: r.matchedProduct?.id,
      data: r.normalizedData
    }));

    // Non-blocking chunked simulation to show progress bar
    const chunkSize = 25;
    const totalChunks = Math.ceil(mappedPayload.length / chunkSize) || 1;

    for (let i = 0; i < totalChunks; i++) {
      const currentCount = Math.min(mappedPayload.length, (i + 1) * chunkSize);
      const percent = Math.round((currentCount / (mappedPayload.length || 1)) * 90);
      setProgressPercent(percent);
      setProgressText(`Processing batch ${i + 1} of ${totalChunks} (${currentCount} of ${mappedPayload.length} items)...`);
      await new Promise(res => setTimeout(res, 80));
    }

    setProgressPercent(95);
    setProgressText('Finalizing warehouse stock and generating audit history logs...');

    try {
      const result = executeVyaparBatchImport(mappedPayload, {
        file_name: file?.name || 'vyapar_products.xlsx',
        file_size: fileSize,
        column_mapping: columnMapping,
        user_name: currentUser.name,
        user_id: currentUser.id
      });

      setImportResult(result);
      setProgressPercent(100);
      setProgressText('Import completed successfully!');
      setCurrentStep('complete');
    } catch (err: any) {
      alert(`Import error: ${err?.message || 'Failed to complete batch import.'}`);
      setCurrentStep('preview');
    }
  };

  // ----------------------------------------------------
  // HANDLERS: ROLLBACK & HISTORY
  // ----------------------------------------------------

  const handleExecuteRollback = () => {
    if (!rollbackModalBatch) return;
    setRollbackStatusMsg(null);

    const res = rollbackVyaparImport(rollbackModalBatch.id, rollbackReason, currentUser.name);
    if (res.success) {
      setRollbackStatusMsg({ type: 'success', text: res.message });
      setTimeout(() => {
        setRollbackModalBatch(null);
        setRollbackReason('');
        setRollbackStatusMsg(null);
      }, 2500);
    } else {
      setRollbackStatusMsg({ type: 'error', text: res.message });
    }
  };

  const handleResetAll = () => {
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setProcessedRows([]);
    setImportResult(null);
    setCurrentStep('upload');
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              ERP Migration Tool
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-500">Excel / CSV Catalog Ingestion</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">Import Products from Vyapar</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Seamlessly transfer your entire product catalog, master packaging, wholesale &amp; MRP rates, GST tax slabs, and warehouse opening stock from Vyapar exports into Saifee Distributor ERP.
          </p>
        </div>

        {/* Action buttons / Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => { setActiveTab('wizard'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'wizard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>New Import Wizard</span>
          </button>
          <button
            onClick={() => { setActiveTab('history'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Import History ({vyaparImports.length})</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: NEW IMPORT WIZARD */}
      {/* ==================================================== */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* STEP INDICATOR */}
          {currentStep !== 'complete' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
              <div className="flex items-center justify-between min-w-[650px] text-xs font-bold">
                {[
                  { id: 'upload', label: '1. Upload File', stepNum: 1 },
                  { id: 'mapping', label: '2. Map Columns', stepNum: 2 },
                  { id: 'preview', label: '3. Match & Validate', stepNum: 3 },
                  { id: 'confirm', label: '4. Inward Review', stepNum: 4 },
                  { id: 'processing', label: '5. Processing', stepNum: 5 }
                ].map((s, idx, arr) => {
                  const isCurrent = currentStep === s.id;
                  const isDone = ['upload', 'mapping', 'preview', 'confirm', 'processing'].indexOf(currentStep) > idx;

                  return (
                    <React.Fragment key={s.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs transition-colors ${
                          isDone 
                            ? 'bg-emerald-600 text-white' 
                            : isCurrent 
                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {isDone ? <Check className="w-4 h-4" /> : s.stepNum}
                        </div>
                        <span className={`${isCurrent ? 'text-indigo-600 font-extrabold' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                          {s.label}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-3 ${isDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 1: FILE UPLOAD */}
          {/* ---------------------------------------------------- */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 transition-colors text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="vyapar-file-upload"
                />

                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="space-y-4 py-8 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Drag &amp; Drop your Vyapar Product Export here
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports Excel (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">.xlsx</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">.xls</code>) and CSV (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">.csv</code>) files exported from Vyapar Desktop or Mobile.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors"
                  >
                    Browse Local File
                  </button>
                </div>
              </div>

              {uploadError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3 text-xs font-semibold">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Upload Error</strong>
                    <span>{uploadError}</span>
                  </div>
                </div>
              )}

              {/* Sample Template & Help Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                    <Download className="w-4 h-4" />
                    <span>Download Sample Vyapar Template</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Need a reference format? Download our pre-formatted Vyapar Excel template containing sample FMCG products with MRP, rates, GST slabs, and opening stock columns.
                  </p>
                  <button
                    onClick={handleDownloadSampleTemplate}
                    className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel Template (.xlsx)</span>
                  </button>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span>How to Export from Vyapar</span>
                  </div>
                  <ol className="text-xs text-slate-500 space-y-1.5 list-decimal pl-4">
                    <li>Open your Vyapar Software on Desktop or Mobile.</li>
                    <li>Navigate to <strong>Items &gt; Product List</strong>.</li>
                    <li>Click the <strong>Export (Excel / CSV)</strong> button on the top right.</li>
                    <li>Upload that exact downloaded file above.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 2: COLUMN MAPPING */}
          {/* ---------------------------------------------------- */}
          {currentStep === 'mapping' && (
            <div className="space-y-6">
              {/* Mapping Control Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Map Columns to Product Master</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    File: <strong className="text-slate-800">{file?.name}</strong> &bull; {rawRows.length} rows found across {rawHeaders.length} columns.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoDetectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Detect Mappings</span>
                  </button>
                  <button
                    onClick={handleResetMapping}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              {/* Column Mapping Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="p-3.5">Target Product Field</th>
                        <th className="p-3.5">Field Type &amp; Details</th>
                        <th className="p-3.5">Vyapar File Column</th>
                        <th className="p-3.5">Sample Values from File</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {TARGET_PRODUCT_FIELDS.map(targetField => {
                        const selectedHeader = columnMapping[targetField.key] || '';
                        const isMapped = !!selectedHeader;

                        // Sample values from first 2 non-empty rows
                        const samples = selectedHeader
                          ? rawRows
                              .map(r => String(r[selectedHeader] || ''))
                              .filter(v => v.trim().length > 0)
                              .slice(0, 2)
                              .join(' | ')
                          : '';

                        return (
                          <tr key={targetField.key} className={isMapped ? 'bg-indigo-50/15' : 'hover:bg-slate-50/50'}>
                            {/* Target Field */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-800 text-xs">{targetField.label}</span>
                                {targetField.required && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    Required
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-mono block mt-0.5">{targetField.key}</span>
                            </td>

                            {/* Description */}
                            <td className="p-3.5 text-slate-600 text-xs max-w-xs">
                              <span>{targetField.description}</span>
                            </td>

                            {/* Column Selector */}
                            <td className="p-3.5 min-w-[220px]">
                              <select
                                value={selectedHeader}
                                onChange={(e) => handleMapColumn(targetField.key, e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border transition-colors outline-none focus:ring-2 focus:ring-indigo-500 ${
                                  isMapped
                                    ? 'border-indigo-300 bg-white text-indigo-950 font-bold'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                                }`}
                              >
                                <option value="">-- Ignore / Do Not Map --</option>
                                {rawHeaders.map(h => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </td>

                            {/* Sample Preview */}
                            <td className="p-3.5 text-slate-600 font-mono text-xs max-w-xs truncate">
                              {samples || <span className="text-slate-300 italic font-sans">No data</span>}
                            </td>

                            {/* Status */}
                            <td className="p-3.5 text-center">
                              {isMapped ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" /> Mapped
                                </span>
                              ) : targetField.required ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3" /> Missing
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-500">Optional</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to File Upload</span>
                </button>
                <button
                  onClick={handleProceedToValidation}
                  disabled={!isRequiredMappingComplete}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                    isRequiredMappingComplete
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>Validate &amp; Match Products</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 3: MATCHING & VALIDATION PREVIEW */}
          {/* ---------------------------------------------------- */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              {/* KPI DASHBOARD CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Total Rows</span>
                  <p className="text-xl font-black text-slate-800 mt-1">{previewStats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">New to Create</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">{previewStats.toCreate}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Exact Matches (Update)</span>
                  <p className="text-xl font-black text-blue-700 mt-1">{previewStats.exactMatches}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Fuzzy Review</span>
                  <p className="text-xl font-black text-amber-700 mt-1">{previewStats.fuzzyMatches}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">Errors / Invalid</span>
                  <p className="text-xl font-black text-rose-700 mt-1">{previewStats.invalid}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">Opening Stock</span>
                  <p className="text-xl font-black text-purple-700 mt-1">{previewStats.totalStockUnits} Pcs</p>
                </div>
              </div>

              {/* Global Controls & Filters Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Search */}
                <div className="flex-1 max-w-sm">
                  <SmartSearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search product name, SKU, brand..."
                    entityFilter={['product']}
                    size="sm"
                  />
                </div>

                {/* Global Policy Selector & Error Exporter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
                    <span className="text-xs font-bold text-slate-600 uppercase px-1">When Matched:</span>
                    <button
                      onClick={() => handleApplyGlobalPolicy('update')}
                      className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                        globalMatchPolicy === 'update' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Update Details
                    </button>
                    <button
                      onClick={() => handleApplyGlobalPolicy('skip')}
                      className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                        globalMatchPolicy === 'skip' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Skip Matches
                    </button>
                  </div>

                  {previewStats.invalid > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Errors CSV ({previewStats.invalid})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* TABS */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: `All Processed (${previewStats.total})` },
                  { id: 'new', label: `New Items (${previewStats.toCreate})` },
                  { id: 'exact', label: `Exact Matches (${previewStats.exactMatches})` },
                  { id: 'fuzzy', label: `Fuzzy Review (${previewStats.fuzzyMatches})` },
                  { id: 'errors', label: `Errors (${previewStats.invalid})` },
                  { id: 'skipped', label: `Skipped (${previewStats.toSkip})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPreviewFilterTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      previewFilterTab === tab.id
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* PREVIEW TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-xs">
                      <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="p-3.5 text-center">Row</th>
                        <th className="p-3.5">Product Name &amp; Brand</th>
                        <th className="p-3.5">SKU / Barcode</th>
                        <th className="p-3.5 text-right">Rates (MRP / Buy / Sale)</th>
                        <th className="p-3.5 text-center">Stock Inward</th>
                        <th className="p-3.5">Match Status</th>
                        <th className="p-3.5 text-center">Action to Take</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">
                            No products matching the current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPreviewRows.map(row => {
                          const d = row.normalizedData;

                          return (
                            <tr 
                              key={row.rowNumber} 
                              className={`hover:bg-slate-50/50 ${
                                !row.isValid 
                                  ? 'bg-rose-50/30' 
                                  : row.matchType === 'EXACT_MATCH'
                                  ? 'bg-blue-50/15'
                                  : row.matchType === 'FUZZY_MATCH'
                                  ? 'bg-amber-50/15'
                                  : ''
                              }`}
                            >
                              {/* Row # */}
                              <td className="p-3.5 text-center font-mono text-slate-500 text-xs font-bold">
                                {row.rowNumber}
                              </td>

                              {/* Name & Brand */}
                              <td className="p-3.5 max-w-xs">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-extrabold text-slate-900 block leading-snug text-sm">{d.name}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                                      MRP: ₹{d.mrp}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <span>{d.brand || d.company_name || 'General'}</span>
                                    <span>&bull;</span>
                                    <span>{d.category || 'FMCG'}</span>
                                  </div>
                                </div>
                                {row.errors.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {row.errors.map((err, i) => (
                                      <span key={i} className="text-xs text-rose-600 font-bold block">
                                        &bull; {err}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* SKU / Barcode */}
                              <td className="p-3.5 font-mono text-xs text-slate-700">
                                <div className="font-bold">{d.sku || <span className="text-slate-400 italic font-sans">Auto-Gen</span>}</div>
                                {d.barcode && <div className="text-xs text-slate-500">{d.barcode}</div>}
                              </td>

                              {/* Rates */}
                              <td className="p-3.5 text-right font-mono text-xs">
                                <div className="font-extrabold text-slate-900 text-sm">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black">
                                    MRP: ₹{d.mrp.toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-slate-500 text-xs font-semibold mt-0.5">Buy: ₹{d.purchase_price.toFixed(2)}</div>
                                <div className="text-emerald-700 font-bold text-xs">Sale: ₹{d.selling_price.toFixed(2)}</div>
                              </td>

                              {/* Stock */}
                              <td className="p-3.5 text-center">
                                {d.stock_qty && d.stock_qty > 0 ? (
                                  <div>
                                    <span className="font-black text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-xs block">
                                      {d.stock_qty} {d.trading_unit || 'Cartons'}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium block mt-0.5">
                                      ({d.stock_qty * (d.units_per_box_carton || 1)} Base Pcs)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic text-xs font-medium">0 Units</span>
                                )}
                              </td>

                              {/* Match Status */}
                              <td className="p-3.5">
                                {row.matchType === 'NEW' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    New Item
                                  </span>
                                )}
                                {row.matchType === 'EXACT_MATCH' && (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                                      Exact Match
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium block mt-0.5 truncate max-w-[150px]">
                                      {row.matchCriteria}
                                    </span>
                                  </div>
                                )}
                                {row.matchType === 'FUZZY_MATCH' && (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                                      Fuzzy Match ({row.matchSimilarityScore}%)
                                    </span>
                                    <button
                                      onClick={() => setSelectedRowForReview(row)}
                                      className="text-xs text-indigo-600 hover:underline font-bold block mt-0.5 cursor-pointer"
                                    >
                                      Review Diffs ({row.matchDifferences?.length || 0})
                                    </button>
                                  </div>
                                )}
                                {!row.isValid && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                                    Invalid Row
                                  </span>
                                )}
                              </td>

                              {/* Action Selector */}
                              <td className="p-3.5 text-center">
                                {row.isValid ? (
                                  <select
                                    value={row.action}
                                    onChange={(e) => handleRowActionChange(row.rowNumber, e.target.value as any)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors outline-none cursor-pointer ${
                                      row.action === 'CREATE_NEW'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : row.action === 'UPDATE_EXISTING'
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    <option value="CREATE_NEW">Create New</option>
                                    {row.matchedProduct && <option value="UPDATE_EXISTING">Update Existing</option>}
                                    <option value="SKIP">Skip Row</option>
                                  </select>
                                ) : (
                                  <span className="text-slate-500 text-xs font-bold uppercase">Skipped (Invalid)</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCurrentStep('mapping')}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Column Mapping</span>
                </button>
                <button
                  onClick={() => setCurrentStep('confirm')}
                  disabled={previewStats.toCreate + previewStats.toUpdate === 0}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                    previewStats.toCreate + previewStats.toUpdate > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>Review Final Summary ({previewStats.toCreate + previewStats.toUpdate} Products)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 4: FINAL CONFIRMATION & INWARD REVIEW */}
          {/* ---------------------------------------------------- */}
          {currentStep === 'confirm' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-black text-slate-900">Confirm Product Catalog Ingestion</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Please review the final transaction impact before injecting these products into your live ERP database.
                  </p>
                </div>

                {/* Breakdown Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">1. Product Master Creation</span>
                    <p className="text-2xl font-black text-emerald-700">{previewStats.toCreate} Items</p>
                    <p className="text-xs text-emerald-900 font-medium">
                      Will be registered with distinct SKUs, barcodes, MRPs, and packaging structures.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">2. Existing Product Updates</span>
                    <p className="text-2xl font-black text-blue-700">{previewStats.toUpdate} Items</p>
                    <p className="text-xs text-blue-900 font-medium">
                      Will be updated with new rates. Previous values will be snapshotted in Activity Logs.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-1">
                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">3. Warehouse Stock Inward</span>
                    <p className="text-2xl font-black text-purple-700">{previewStats.totalStockUnits} Base Units</p>
                    <p className="text-xs text-purple-900 font-medium">
                      Will create Opening Batches, Stock Ledger IN events, and an Inward Purchase entry.
                    </p>
                  </div>
                </div>

                {/* Audit Trail Note */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 space-y-1 leading-relaxed">
                    <strong className="text-slate-800 font-bold block">Immutable Audit Trail &amp; Safe Rollback Support</strong>
                    <p>
                      Every action taken during this import is logged to the product’s <strong>Item Activity History</strong>. A dedicated batch record will be created under <strong>Import History</strong> with 1-click safe Rollback capability.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Product Review</span>
                </button>
                <button
                  onClick={handleStartImport}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Execute Vyapar Import Now</span>
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 5: LIVE BATCH PROCESSING */}
          {/* ---------------------------------------------------- */}
          {currentStep === 'processing' && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center space-y-6 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900">Ingesting Vyapar Products into Database...</h3>
                <p className="text-xs text-slate-500 font-mono">{progressText}</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-black text-indigo-600">{progressPercent}% Completed</span>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* STEP 6: COMPLETION SUMMARY */}
          {/* ---------------------------------------------------- */}
          {currentStep === 'complete' && importResult && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-3xl mx-auto text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCheck className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900">Import Batch Successfully Completed!</h3>
                <p className="text-xs text-slate-500">
                  Batch Reference: <strong className="font-mono text-indigo-600">{importResult.importId}</strong>
                </p>
              </div>

              {/* Stat summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Created</span>
                  <span className="text-lg font-black text-slate-800">{importResult.batch.created_count} Items</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Updated</span>
                  <span className="text-lg font-black text-slate-800">{importResult.batch.updated_count} Items</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase block">Skipped</span>
                  <span className="text-lg font-black text-slate-800">{importResult.batch.skipped_count} Items</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <span className="text-xs font-bold text-purple-700 uppercase block">Stock Inwarded</span>
                  <span className="text-lg font-black text-purple-700">{importResult.batch.stock_units_imported} Pcs</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
                <Link
                  href="/admin/products"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-colors"
                >
                  View in Item Master
                </Link>
                <Link
                  href="/admin/purchases"
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  View Inward Purchases
                </Link>
                <button
                  onClick={handleResetAll}
                  className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: IMPORT BATCH HISTORY & ROLLBACK LOGS */}
      {/* ==================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Historical Import Batches</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete immutable audit record of all past Vyapar file import runs.
                </p>
              </div>
              <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 self-start">
                Total Runs: {vyaparImports.length}
              </span>
            </div>

            {vyaparImports.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-semibold space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                <p>No Vyapar product imports have been executed yet.</p>
                <button
                  onClick={() => setActiveTab('wizard')}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                >
                  Start First Import
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-3.5">Import ID &amp; Date</th>
                      <th className="p-3.5">File Name</th>
                      <th className="p-3.5 text-center">Total Rows</th>
                      <th className="p-3.5 text-center">Created</th>
                      <th className="p-3.5 text-center">Updated</th>
                      <th className="p-3.5 text-center">Stock Inward</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vyaparImports.map(batch => (
                      <tr key={batch.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-indigo-600 block">{batch.id}</span>
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(batch.imported_at).toLocaleString('en-IN')} &bull; by {batch.imported_by_name || 'Admin'}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {batch.file_name}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-700">{batch.total_rows}</td>
                        <td className="p-3.5 text-center font-extrabold text-emerald-700">{batch.created_count}</td>
                        <td className="p-3.5 text-center font-extrabold text-blue-700">{batch.updated_count}</td>
                        <td className="p-3.5 text-center font-extrabold text-purple-700">{batch.stock_units_imported} Pcs</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
                            batch.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : batch.status === 'Rolled Back'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {batch.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => setSelectedHistoryBatch(batch)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors"
                          >
                            View Logs ({batch.row_logs?.length || 0})
                          </button>
                          {batch.status === 'Completed' && (
                            <button
                              onClick={() => {
                                setRollbackModalBatch(batch);
                                setRollbackReason('');
                                setRollbackStatusMsg(null);
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition-colors"
                            >
                              Rollback
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: SIDE-BY-SIDE MATCH COMPARISON MODAL */}
      {/* ==================================================== */}
      {selectedRowForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Product Match &amp; Differences Inspection</h3>
                <p className="text-xs text-slate-500 font-mono">Row #{selectedRowForReview.rowNumber}: {selectedRowForReview.normalizedData.name}</p>
              </div>
              <button
                onClick={() => setSelectedRowForReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium">
                <strong>Match Criteria:</strong> {selectedRowForReview.matchCriteria}
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Existing */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-500 block tracking-wider">Existing Product in DB</span>
                  <p className="font-black text-slate-800 text-sm">{selectedRowForReview.matchedProduct?.name}</p>
                  <div className="space-y-1 font-mono text-xs text-slate-600">
                    <div>MRP: <strong className="text-slate-800">₹{selectedRowForReview.matchedProduct?.mrp}</strong></div>
                    <div>Purchase Price: <strong className="text-slate-800">₹{selectedRowForReview.matchedProduct?.purchase_price}</strong></div>
                    <div>Selling Price: <strong className="text-slate-800">₹{selectedRowForReview.matchedProduct?.selling_price}</strong></div>
                    <div>GST: <strong className="text-slate-800">{selectedRowForReview.matchedProduct?.gst_percent}%</strong></div>
                    <div>Packing: <strong className="text-slate-800">{selectedRowForReview.matchedProduct?.pack_size}</strong></div>
                  </div>
                </div>

                {/* Vyapar Import */}
                <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-200 space-y-2">
                  <span className="text-xs font-bold uppercase text-indigo-700 block tracking-wider">Vyapar Import Row</span>
                  <p className="font-black text-indigo-950 text-sm">{selectedRowForReview.normalizedData.name}</p>
                  <div className="space-y-1 font-mono text-xs text-slate-700">
                    <div>MRP: <strong className="text-indigo-900">₹{selectedRowForReview.normalizedData.mrp}</strong></div>
                    <div>Purchase Price: <strong className="text-indigo-900">₹{selectedRowForReview.normalizedData.purchase_price}</strong></div>
                    <div>Selling Price: <strong className="text-indigo-900">₹{selectedRowForReview.normalizedData.selling_price}</strong></div>
                    <div>GST: <strong className="text-indigo-900">{selectedRowForReview.normalizedData.gst_percent}%</strong></div>
                    <div>Packing: <strong className="text-indigo-900">{selectedRowForReview.normalizedData.pack_size}</strong></div>
                  </div>
                </div>
              </div>

              {/* Differences List */}
              {selectedRowForReview.matchDifferences && selectedRowForReview.matchDifferences.length > 0 && (
                <div className="space-y-1 pt-2">
                  <span className="font-bold text-slate-700 text-xs block">Detected Field Differences:</span>
                  <div className="space-y-1">
                    {selectedRowForReview.matchDifferences.map((diff, i) => (
                      <div key={i} className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded text-rose-800 font-medium text-xs">
                        &bull; {diff}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Select resolution for this item:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleRowActionChange(selectedRowForReview.rowNumber, 'SKIP');
                    setSelectedRowForReview(null);
                  }}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    handleRowActionChange(selectedRowForReview.rowNumber, 'CREATE_NEW');
                    setSelectedRowForReview(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Create as New Item
                </button>
                <button
                  onClick={() => {
                    handleRowActionChange(selectedRowForReview.rowNumber, 'UPDATE_EXISTING');
                    setSelectedRowForReview(null);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  Update Existing Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: IMPORT BATCH LOGS DRAWER */}
      {/* ==================================================== */}
      {selectedHistoryBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Import Batch Logs: {selectedHistoryBatch.id}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  File: {selectedHistoryBatch.file_name} &bull; {new Date(selectedHistoryBatch.imported_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryBatch(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-xs text-slate-500 block font-bold uppercase">Created</span>
                  <span className="font-black text-emerald-700 text-base">{selectedHistoryBatch.created_count}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-xs text-slate-500 block font-bold uppercase">Updated</span>
                  <span className="font-black text-blue-700 text-base">{selectedHistoryBatch.updated_count}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-xs text-slate-500 block font-bold uppercase">Skipped</span>
                  <span className="font-black text-slate-700 text-base">{selectedHistoryBatch.skipped_count}</span>
                </div>
                <div className="p-2 bg-purple-50 rounded border border-purple-200">
                  <span className="text-xs text-purple-700 block font-bold uppercase">Stock Inward</span>
                  <span className="font-black text-purple-700 text-base">{selectedHistoryBatch.stock_units_imported} Pcs</span>
                </div>
              </div>

              {/* Table of row logs */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-2.5 text-center">Row</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">SKU / Barcode</th>
                      <th className="p-2.5 text-center">Action</th>
                      <th className="p-2.5">Stock &amp; Batch Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedHistoryBatch.row_logs?.map(log => (
                      <tr key={log.row_number} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center font-mono text-slate-400 font-bold">{log.row_number}</td>
                        <td className="p-2.5 font-bold text-slate-800">{log.product_name}</td>
                        <td className="p-2.5 font-mono text-slate-600 text-xs font-medium">{log.sku || log.barcode || '—'}</td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            log.action_taken === 'CREATED' ? 'bg-emerald-50 text-emerald-700' :
                            log.action_taken === 'UPDATED' ? 'bg-blue-50 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {log.action_taken}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 text-xs font-medium">
                          {log.stock_inward_qty ? (
                            <span>{log.stock_inward_qty} Base Pcs {log.batch_number ? `(Batch: ${log.batch_number})` : ''}</span>
                          ) : (
                            <span className="text-slate-400 italic">No stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedHistoryBatch(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: ROLLBACK CONFIRMATION MODAL */}
      {/* ==================================================== */}
      {rollbackModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col my-8 max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Rollback Import Batch</h3>
              </div>
              <button
                onClick={() => setRollbackModalBatch(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed font-medium">
                You are about to roll back batch <strong className="font-mono text-slate-900">{rollbackModalBatch.id}</strong> ({rollbackModalBatch.file_name}).
              </p>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1.5">
                <strong className="block font-bold">What this rollback will do:</strong>
                <ul className="list-disc pl-4 space-y-0.5 text-xs font-medium">
                  <li>Remove <strong>{rollbackModalBatch.created_product_ids.length}</strong> created products &amp; inventory balances.</li>
                  <li>Revert <strong>{rollbackModalBatch.updated_snapshots.length}</strong> updated products to their exact previous state.</li>
                  <li>Remove the <strong>{rollbackModalBatch.stock_units_imported} units</strong> opening stock and purchase record.</li>
                  <li>Will abort if any product is already referenced in an active sales invoice.</li>
                </ul>
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Reason for Rollback (Optional):</label>
                <input
                  type="text"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="e.g. Uploaded wrong price list, duplicated export..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              {rollbackStatusMsg && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  rollbackStatusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {rollbackStatusMsg.text}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setRollbackModalBatch(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRollback}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Confirm Safe Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
