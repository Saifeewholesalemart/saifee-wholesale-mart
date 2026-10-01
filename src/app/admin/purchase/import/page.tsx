'use client';

import React, { useState, useRef } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { 
  Upload, Cpu, Check, AlertTriangle, AlertCircle, RefreshCw, X, 
  Search, PlusCircle, CheckCircle, HelpCircle, FileText, Download, 
  Filter, Eye, Landmark, Truck, ChevronDown, Plus, UserPlus, Building2, Sparkles,
  Edit3, Sliders, CheckSquare, Layers
} from 'lucide-react';
import { Product, Purchase } from '@/lib/db';
import SmartSearchBar from '@/components/SmartSearchBar';

interface ExtractedLine {
  id: string;
  extracted_name: string;
  custom_name?: string;
  company_id?: string;
  barcode?: string;
  sku?: string;
  pack_size: string;
  quantity: number;
  trading_unit: 'Box' | 'Carton' | string;
  purchase_rate: number;
  discount: number;
  free_quantity: number;
  mrp: number;
  gst_percent: number;
  hsn: string;
  batch: string;
  expiry_date: string;
  matched_product_id: string; // references Product.id
  suggested_product_id?: string; // suggested Product.id for fuzzy match
  difference?: string; // difference text like "Weight: 300g vs 100g"
  confidence: 'GREEN' | 'YELLOW' | 'RED';
  resolved_from?: 'USE_EXISTING' | 'CREATE_NEW' | 'CREATE_VARIANT' | 'SEARCH_MANUAL';
  resolution_time?: string;

  // Essential FMCG UOM & Wholesale Pricing Controls
  rate_uom: 'carton' | 'piece'; // Rate Is For: "Per Carton / Box" vs "Per Piece / Pouch"
  units_per_pack: number; // Pack Size (Pieces per Carton)
  selling_price: number; // Wholesale selling price (manually entered/adjusted)
  selling_uom: 'carton' | 'piece'; // Selling rate unit: per carton or per piece
}

interface ExtractedInvoice {
  supplier_name: string;
  supplier_gstin?: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  lines: ExtractedLine[];
}

// Helper: Extract pack size number (units per carton)
function parsePackSizeNumber(packStr?: string, fallbackUnits?: number): number {
  if (fallbackUnits && fallbackUnits > 0) return fallbackUnits;
  if (!packStr) return 1;
  const match = packStr.match(/(?:x\s*|×\s*|\/\s*|(\d+)\s*(?:pcs|pc|units|pkts|pouch|pouches|items|nos|sachets|packs))/i)
    || packStr.match(/(\d+)\s*(?:units|pcs|pc|pkts|pouch|pouches|items)/i)
    || packStr.match(/\b(\d+)\b/);
  if (match) {
    const val = parseInt(match[1] || match[0], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 1;
}

// Helper: Extract weight/volume (e.g. 100g, 300ml, 500 gm, 1 kg) from string
function extractWeightOrVolume(name: string): { value: number; unit: string; raw: string } | null {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(g|gm|kg|ml|l|ltr|ltrs|pc|pcs|units)\b/i);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    return {
      value: val,
      unit: unit === 'gm' ? 'g' : unit === 'ltrs' || unit === 'ltr' ? 'l' : unit,
      raw: match[0]
    };
  }
  return null;
}

// Helper: Extract brand/company name from product name
function extractCompanyOrBrand(name: string, companies: any[]): { name: string; id: string } | null {
  const lowercaseName = name.toLowerCase();
  for (const comp of companies) {
    if (lowercaseName.includes(comp.name.toLowerCase())) {
      return { name: comp.name, id: comp.id };
    }
  }
  return null;
}

export default function AIPurchaseImport() {
  const { 
    products, suppliers, purchases, makePurchase, refreshState, 
    createSupplier, createProduct, createFullProduct, companies, createCompany 
  } = useDb();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core States
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [verificationData, setVerificationData] = useState<ExtractedInvoice | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugInfo, setDebugInfo] = useState<{
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    requestStatus?: string;
    responseStatus?: string;
    parsedJson?: any;
    error?: string;
  } | null>(null);

  // Resolution Modal States
  const [resolvingLineId, setResolvingLineId] = useState<string | null>(null);
  const [resolutionMode, setResolutionMode] = useState<'NEW_PRODUCT' | 'NEW_VARIANT' | 'SEARCH' | 'REVIEW_FUZZY' | 'EDIT_SINGLE' | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Form States for single product / variant creation
  const [formProductName, setFormProductName] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formUnit, setFormUnit] = useState('g');
  const [formPacking, setFormPacking] = useState('');
  const [formHsn, setFormHsn] = useState('');
  const [formGstRate, setFormGstRate] = useState(18);
  const [formMrp, setFormMrp] = useState(0);
  const [formRate, setFormRate] = useState(0);
  const [formSellingPrice, setFormSellingPrice] = useState(0);
  const [formBatch, setFormBatch] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formFreeQuantity, setFormFreeQuantity] = useState(0);
  const [selectedParentProductId, setSelectedParentProductId] = useState('');

  // ERP UI States
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [viewingRawData, setViewingRawData] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('Credit');
  const [dispatchMode, setDispatchMode] = useState('Road');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RESOLVED' | 'PENDING'>('ALL');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  // Company Detection & Prompt States (Rule 1 & Rule 2)
  const [detectedUnmappedCompany, setDetectedUnmappedCompany] = useState('');
  const [mappedCompanyId, setMappedCompanyId] = useState('');
  const [showCompanyApprovalModal, setShowCompanyApprovalModal] = useState(false);
  const [newCompanyNameInput, setNewCompanyNameInput] = useState('');
  const [newCompanyCodeInput, setNewCompanyCodeInput] = useState('');
  const [existingCompanySelection, setExistingCompanySelection] = useState('');
  const [bulkToolbarCompanyId, setBulkToolbarCompanyId] = useState('');

  // Automated Batch Editor Modal (Rule 3)
  const [showAutomatedEditorModal, setShowAutomatedEditorModal] = useState(false);
  const [automatedMarginPercent, setAutomatedMarginPercent] = useState<number>(15);

  // Supplier Creation Modal States
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierFormName, setSupplierFormName] = useState('');
  const [supplierFormGstin, setSupplierFormGstin] = useState('');
  const [supplierFormAddress, setSupplierFormAddress] = useState('');

  const handleOpenSupplierModal = (prefillExtracted = true) => {
    if (prefillExtracted && verificationData) {
      setSupplierFormName(verificationData.supplier_name || '');
      setSupplierFormGstin(verificationData.supplier_gstin || '');
      setSupplierFormAddress('');
    } else {
      setSupplierFormName('');
      setSupplierFormGstin('');
      setSupplierFormAddress('');
    }
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supplierFormName.trim()) {
      alert('Please enter supplier name.');
      return;
    }
    const newSupp = createSupplier(
      supplierFormName.trim(),
      supplierFormGstin.trim().toUpperCase(),
      supplierFormAddress.trim() || 'Local'
    );
    if (newSupp) {
      setSelectedSupplierId(newSupp.id);
      setShowSupplierModal(false);
      setSupplierFormName('');
      setSupplierFormGstin('');
      setSupplierFormAddress('');
    }
  };

  // 1. Trigger File Upload & Call API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg('');
    setVerificationData(null);
    setDuplicateWarning(false);
    setUploadedFileName(file.name);
    setDebugInfo({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      requestStatus: 'Sending file to server...',
      responseStatus: 'Waiting for AI response...',
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/purchase/import', {
        method: 'POST',
        body: formData
      });

      const res = await response.json();
      if (!res.success) {
        setDebugInfo(prev => ({
          ...prev,
          requestStatus: 'Failed',
          responseStatus: `${response.status} ${response.statusText}`,
          error: res.error || 'Server returned failure'
        }));
        setErrorMsg(res.error || 'Failed to read invoice. Please verify your invoice file and try again.');
        return;
      }

      const ocrData = res.data;
      setDebugInfo(prev => ({
        ...prev,
        requestStatus: 'Success',
        responseStatus: '200 OK',
        parsedJson: ocrData
      }));
      
      // Try to match the extracted supplier with a database supplier
      const extractedSupplierName = ocrData.supplier_name;
      const extractedSupplierGstin = ocrData.supplier_gstin;
      
      let matchedSupplierId = '';
      if (extractedSupplierName) {
        const match = suppliers.find(s => {
          if (extractedSupplierGstin && s.gstin && s.gstin.toLowerCase().replace(/[^a-z0-9]/g, '') === extractedSupplierGstin.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            return true;
          }
          return s.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(extractedSupplierName.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                 extractedSupplierName.toLowerCase().replace(/[^a-z0-9]/g, '').includes(s.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        });
        if (match) {
          matchedSupplierId = match.id;
        }
      }
      setSelectedSupplierId(matchedSupplierId);

      // Check if invoice supplier/brand company matches an existing company in DB
      const rawComp = ocrData.supplier_name
        ? ocrData.supplier_name.replace(/\s*(Pvt|Ltd|Private|Limited|LLP|Enterprises|Agency|Agencies|Distributors|Traders|Trading|Co|Company)\b/gi, '').trim()
        : (ocrData.lines?.[0]?.extracted_name?.split(/\s+/)?.[0] || '');

      const existingCompanyMatch = companies.find(c => 
        c.name.toLowerCase() === rawComp.toLowerCase() || 
        (rawComp.length > 3 && c.name.toLowerCase().includes(rawComp.toLowerCase())) || 
        (rawComp.length > 3 && rawComp.toLowerCase().includes(c.name.toLowerCase()))
      );

      let defaultCompId = '';
      if (existingCompanyMatch) {
        defaultCompId = existingCompanyMatch.id;
        setMappedCompanyId(existingCompanyMatch.id);
        setBulkToolbarCompanyId(existingCompanyMatch.id);
        setDetectedUnmappedCompany('');
      } else if (rawComp) {
        setMappedCompanyId('');
        setDetectedUnmappedCompany(rawComp);
        setNewCompanyNameInput(rawComp);
        setNewCompanyCodeInput(rawComp.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, ''));
        setExistingCompanySelection(companies[0]?.id || '');
        setShowCompanyApprovalModal(true);
      }

      // Perform client side matching against the actual products database
      const processedLines: ExtractedLine[] = ocrData.lines.map((line: any, idx: number) => {
        let matchedId = '';
        let suggestedId = '';
        let differenceText = '';
        let confidence: 'GREEN' | 'YELLOW' | 'RED' = 'RED';

        const invWeight = extractWeightOrVolume(line.extracted_name);
        const matchedCompObj = extractCompanyOrBrand(line.extracted_name, companies);
        const lineCompanyId = matchedCompObj?.id || defaultCompId || '';

        // A. Barcode exact match
        if (line.barcode) {
          const match = products.find(p => p.barcode === line.barcode);
          if (match) {
            matchedId = match.id;
            confidence = 'GREEN';
          }
        }

        // B. SKU exact match
        if (!matchedId && line.sku) {
          const match = products.find(p => p.sku === line.sku);
          if (match) {
            matchedId = match.id;
            confidence = 'GREEN';
          }
        }

        // C. Name match / Similarity match (word tokens)
        if (!matchedId) {
          const lName = line.extracted_name.toLowerCase();
          let match = products.find(p => p.name.toLowerCase() === lName);
          if (match) {
            matchedId = match.id;
            confidence = 'GREEN';
          } else {
            const words = lName.split(/\s+/).filter((w: string) => w.length > 1 && !w.match(/^\d+(?:g|gm|kg|ml|l|ltr|pc|pcs)?$/i));
            if (words.length > 0) {
              const fuzzyMatches = products.map(p => {
                const s1 = p.name.toLowerCase();
                const matchCount = words.filter((word: string) => s1.includes(word)).length;
                let score = 0;
                if (matchCount > 0) {
                  score = matchCount / words.length;
                }
                return { product: p, score };
              }).filter(item => item.score >= 0.5);

              if (fuzzyMatches.length > 0) {
                const bestMatch = fuzzyMatches.sort((a, b) => b.score - a.score)[0].product;
                const dbWeight = extractWeightOrVolume(bestMatch.name);
                const dbCompany = companies.find(c => c.id === bestMatch.company_id)?.name || bestMatch.brand || '';
                const invCompany = matchedCompObj?.name || rawComp;

                const isWeightMismatch = invWeight && dbWeight && (invWeight.value !== dbWeight.value || invWeight.unit !== dbWeight.unit);
                const isWeightMissing = invWeight && !dbWeight;
                const isCompanyMismatch = invCompany && dbCompany && invCompany.toLowerCase() !== dbCompany.toLowerCase();
                const isPackSizeMismatch = line.pack_size && bestMatch.pack_size && line.pack_size.toLowerCase() !== bestMatch.pack_size.toLowerCase();

                if (isWeightMismatch) {
                  suggestedId = bestMatch.id;
                  confidence = 'YELLOW';
                  differenceText = `⚠️ Weight Mismatch: Invoice ${invWeight.raw} vs Database ${dbWeight.raw}`;
                } else if (isWeightMissing) {
                  suggestedId = bestMatch.id;
                  confidence = 'YELLOW';
                  differenceText = `⚠️ Weight Suffix missing in Database`;
                } else if (isCompanyMismatch) {
                  suggestedId = bestMatch.id;
                  confidence = 'YELLOW';
                  differenceText = `⚠️ Brand Mismatch: ${invCompany} vs ${dbCompany}`;
                } else if (isPackSizeMismatch) {
                  suggestedId = bestMatch.id;
                  confidence = 'YELLOW';
                  differenceText = `⚠️ Pack Size Mismatch: ${line.pack_size} vs ${bestMatch.pack_size}`;
                } else {
                  if (invWeight && dbWeight && invWeight.value === dbWeight.value && invWeight.unit === dbWeight.unit && !isCompanyMismatch) {
                    matchedId = bestMatch.id;
                    confidence = 'GREEN';
                  } else {
                    suggestedId = bestMatch.id;
                    confidence = 'YELLOW';
                    differenceText = `⚠️ Verify pack size / product details`;
                  }
                }
              }
            }
          }
        }

        const resolvedProd = products.find(p => p.id === matchedId) || products.find(p => p.id === suggestedId);
        const finalCompId = resolvedProd?.company_id || lineCompanyId;
        const unitsPerPack = resolvedProd?.units_per_box_carton || parsePackSizeNumber(line.pack_size) || 1;
        const isPieceUnit = (line.trading_unit && (line.trading_unit.toLowerCase() === 'piece' || line.trading_unit.toLowerCase() === 'pouch'));
        const initialRateUom: 'carton' | 'piece' = isPieceUnit ? 'piece' : 'carton';
        const initialLandedCarton = initialRateUom === 'piece' ? (line.purchase_rate * unitsPerPack) : line.purchase_rate;
        const initialSellingPrice = resolvedProd?.selling_price && resolvedProd.selling_price > 0
          ? resolvedProd.selling_price
          : (resolvedProd?.mrp ? Math.round(resolvedProd.mrp * 0.9) : Math.round(line.purchase_rate * 1.15));

        return {
          id: `line-${idx}-${Date.now()}`,
          extracted_name: line.extracted_name,
          custom_name: line.extracted_name,
          company_id: finalCompId,
          barcode: line.barcode,
          sku: line.sku,
          pack_size: line.pack_size || (resolvedProd?.pack_size || `${unitsPerPack} units/carton`),
          quantity: line.quantity,
          trading_unit: line.trading_unit || 'Carton',
          purchase_rate: line.purchase_rate,
          discount: line.discount || 0,
          free_quantity: line.free_quantity || 0,
          mrp: line.mrp || resolvedProd?.mrp || 0,
          gst_percent: line.gst_percent || resolvedProd?.gst_percent || 18,
          hsn: line.hsn || resolvedProd?.hsn || '',
          batch: line.batch || '',
          expiry_date: line.expiry_date || '',
          matched_product_id: matchedId,
          suggested_product_id: suggestedId,
          difference: differenceText,
          confidence,
          rate_uom: initialRateUom,
          units_per_pack: unitsPerPack,
          selling_price: initialSellingPrice,
          selling_uom: 'carton' as const
        };
      });

      // Check for duplicate invoice alert
      const isDuplicate = matchedSupplierId ? purchases.some(p => 
        p.supplier_id === matchedSupplierId && 
        p.invoice_number === ocrData.invoice_number
      ) : false;

      setDuplicateWarning(isDuplicate);
      setVerificationData({
        supplier_name: ocrData.supplier_name,
        supplier_gstin: ocrData.supplier_gstin,
        invoice_number: ocrData.invoice_number,
        invoice_date: ocrData.invoice_date,
        total_amount: ocrData.total_amount,
        lines: processedLines
      });

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Unable to read invoice. Please try another file.');
      setDebugInfo(prev => ({
        ...prev,
        requestStatus: 'Failed',
        error: err.message || 'Unknown error occurred'
      }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Field update handler for line items
  const handleUpdateLineField = (lineId: string, field: keyof ExtractedLine, val: any) => {
    if (!verificationData) return;
    
    const lines = verificationData.lines.map(line => {
      if (line.id === lineId) {
        const updated = { ...line, [field]: val };
        
        // If product select is changed manually, update confidence to GREEN & sync pack size / pricing
        if (field === 'matched_product_id') {
          updated.confidence = 'GREEN';
          const prod = products.find(p => p.id === val);
          if (prod) {
            updated.gst_percent = prod.gst_percent;
            updated.hsn = prod.hsn;
            updated.mrp = prod.mrp;
            updated.company_id = prod.company_id;
            updated.units_per_pack = prod.units_per_box_carton || parsePackSizeNumber(prod.pack_size) || updated.units_per_pack || 1;
            if (prod.selling_price && prod.selling_price > 0) {
              updated.selling_price = prod.selling_price;
              updated.selling_uom = 'carton';
            }
          }
        }
        return updated;
      }
      return line;
    });

    // Recalculate total_amount dynamically based on updated lines
    const total_amount = lines.reduce((sum, line) => {
      const lineSub = line.purchase_rate * line.quantity;
      const discLine = line.discount * line.quantity;
      const taxable = Math.max(0, lineSub - discLine);
      const gst = taxable * (line.gst_percent / 100);
      return sum + taxable + gst;
    }, 0);

    setVerificationData({
      ...verificationData,
      lines,
      total_amount
    });
  };

  // Batch Assign Company to Lines (Rule 1 & Rule 2)
  const handleApplyCompanyToAll = (companyId: string, onlyUnassigned = false) => {
    if (!verificationData || !companyId) return;
    const comp = companies.find(c => c.id === companyId);
    if (!comp) return;

    const lines = verificationData.lines.map(line => {
      if (onlyUnassigned && line.company_id) {
        return line;
      }
      return {
        ...line,
        company_id: companyId
      };
    });

    setVerificationData({
      ...verificationData,
      lines
    });

    alert(`Applied company "${comp.name}" to ${onlyUnassigned ? 'all unassigned items' : 'all items'}!`);
  };

  // Apply Wholesale Margin % to All Lines (Rule 3)
  const handleApplyMarginToAll = (percent: number) => {
    if (!verificationData) return;
    const lines = verificationData.lines.map(line => {
      const pRate = line.purchase_rate || 0;
      const newSellingPrice = pRate > 0 ? Math.round(pRate * (1 + percent / 100)) : line.selling_price;
      return {
        ...line,
        selling_price: newSellingPrice
      };
    });

    setVerificationData({
      ...verificationData,
      lines
    });
  };

  // Save All Automated Edits & Create Master Products (Rule 1, Rule 2, Rule 3)
  const handleSaveAutomatedEdits = () => {
    if (!verificationData) return;

    // 1. Strict Validation: Every item must have a valid company assigned!
    const unassignedLines = verificationData.lines.filter(l => !l.company_id);
    if (unassignedLines.length > 0) {
      alert(`Cannot save: ${unassignedLines.length} item(s) are missing an assigned Company / Manufacturer.\n\nPlease select a company for each item (or use "Apply Company to All") before proceeding.`);
      return;
    }

    // 2. Create products with user-customized details
    let createdCount = 0;
    const updatedLines = verificationData.lines.map(line => {
      const assignedComp = companies.find(c => c.id === line.company_id);
      const compName = assignedComp?.name || 'General';
      const itemName = (line.custom_name || line.extracted_name).trim();

      let targetProduct = products.find(p => p.id === line.matched_product_id);
      if (!targetProduct) {
        // Find existing product by exact name & company
        targetProduct = products.find(p => 
          p.name.toLowerCase() === itemName.toLowerCase() && 
          p.company_id === line.company_id
        );
      }

      if (!targetProduct) {
        // Create full master product entry
        const unitsPerPack = line.units_per_pack || parsePackSizeNumber(line.pack_size) || 1;
        const purchaseRate = line.purchase_rate || 0;
        const mrp = line.mrp || (purchaseRate ? Math.round(purchaseRate * 1.25) : 100);
        const sellingPrice = line.selling_price || (purchaseRate ? Math.round(purchaseRate * 1.15) : Math.round(mrp * 0.9));

        targetProduct = createFullProduct({
          name: itemName,
          company_id: line.company_id!,
          brand: compName,
          category: compName,
          pack_size: line.pack_size || `${unitsPerPack} Pc`,
          trading_unit: line.trading_unit || 'Carton',
          units_per_box_carton: unitsPerPack,
          allow_loose_sale: true,
          mrp: mrp,
          purchase_price: purchaseRate,
          selling_price: sellingPrice,
          gst_percent: line.gst_percent || 18,
          hsn: line.hsn || '1905',
          active: true
        });
        createdCount++;
      }

      return {
        ...line,
        matched_product_id: targetProduct.id,
        confidence: 'GREEN' as const,
        resolved_from: 'CREATE_NEW' as const,
        resolution_time: new Date().toISOString(),
        gst_percent: targetProduct.gst_percent || line.gst_percent || 18,
        hsn: targetProduct.hsn || line.hsn || '',
        mrp: targetProduct.mrp || line.mrp || 0,
        selling_price: line.selling_price || targetProduct.selling_price || 0,
        selling_uom: 'carton' as const
      };
    });

    setVerificationData({
      ...verificationData,
      lines: updatedLines
    });

    setShowAutomatedEditorModal(false);
    alert(`Successfully verified all ${verificationData.lines.length} items and created/mapped ${createdCount} master products with your custom details!`);
  };

  const handleResolveLine = (lineId: string, productId: string, method: 'USE_EXISTING' | 'CREATE_NEW' | 'CREATE_VARIANT' | 'SEARCH_MANUAL') => {
    if (!verificationData) return;
    const lines = verificationData.lines.map(line => {
      if (line.id === lineId) {
        const prod = products.find(p => p.id === productId);
        const packSize = prod ? (prod.units_per_box_carton || parsePackSizeNumber(prod.pack_size) || line.units_per_pack) : line.units_per_pack;
        const landedCarton = line.rate_uom === 'piece' ? (line.purchase_rate * packSize) : line.purchase_rate;
        const sellingPrice = prod && prod.selling_price > 0
          ? prod.selling_price
          : (line.selling_price || (prod?.mrp ? Math.round(prod.mrp * 0.9) : Math.round(landedCarton * 1.15)));

        return {
          ...line,
          matched_product_id: productId,
          company_id: prod?.company_id || line.company_id,
          confidence: 'GREEN' as const,
          resolved_from: method,
          resolution_time: new Date().toISOString(),
          gst_percent: prod ? prod.gst_percent : line.gst_percent,
          hsn: prod ? prod.hsn : line.hsn,
          mrp: prod ? prod.mrp : line.mrp,
          units_per_pack: packSize,
          selling_price: sellingPrice,
          selling_uom: 'carton' as const
        };
      }
      return line;
    });

    const total_amount = lines.reduce((sum, line) => {
      const lineSub = line.purchase_rate * line.quantity;
      const discLine = line.discount * line.quantity;
      const taxable = Math.max(0, lineSub - discLine);
      const gst = taxable * (line.gst_percent / 100);
      return sum + taxable + gst;
    }, 0);

    setVerificationData({ 
      ...verificationData, 
      lines,
      total_amount 
    });
    setResolvingLineId(null);
    setResolutionMode(null);
  };

  const handleConfirmPurchase = () => {
    if (!verificationData) return;

    // 1. Supplier Check
    let currentSupplierId = selectedSupplierId;
    if (!currentSupplierId) {
      if (verificationData.supplier_name) {
        const match = suppliers.find(s => s.name.toLowerCase() === verificationData.supplier_name.toLowerCase());
        if (match) {
          currentSupplierId = match.id;
        } else {
          const newSupp = createSupplier(
            verificationData.supplier_name,
            verificationData.supplier_gstin || '',
            'Local'
          );
          currentSupplierId = newSupp.id;
        }
        setSelectedSupplierId(currentSupplierId);
      } else {
        alert('Please select or create a supplier first.');
        return;
      }
    }

    // 2. Validate that every line has an assigned company and product
    const unassignedCompanyLines = verificationData.lines.filter(l => !l.company_id);
    if (unassignedCompanyLines.length > 0) {
      alert(`Cannot confirm purchase: ${unassignedCompanyLines.length} item(s) do not have a Company assigned.\n\nPlease assign a company to each item before confirming.`);
      return;
    }

    // 3. Resolve any remaining unmatched lines under their assigned company
    const resolvedLines = verificationData.lines.map(l => {
      let productId = l.matched_product_id;
      if (!productId || l.confidence !== 'GREEN') {
        const exactName = (l.custom_name || l.extracted_name).trim();
        const comp = companies.find(c => c.id === l.company_id);
        const compName = comp?.name || 'General';

        let prod = products.find(p => p.name.toLowerCase() === exactName.toLowerCase() && p.company_id === l.company_id);
        if (!prod) {
          const weightInfo = extractWeightOrVolume(l.extracted_name);
          const packSize = l.pack_size || (weightInfo ? `${weightInfo.raw}` : '1 Pc');
          const pRate = l.purchase_rate || 0;
          const mrp = l.mrp || (pRate ? Math.round(pRate * 1.25) : 100);
          const sPrice = l.selling_price || (pRate ? Math.round(pRate * 1.15) : Math.round(mrp * 0.9));

          prod = createProduct(
            exactName,
            compName,
            packSize,
            l.hsn || '1905',
            l.gst_percent || 18,
            mrp,
            sPrice
          );
        }
        productId = prod.id;
      }

      return {
        ...l,
        matched_product_id: productId,
        confidence: 'GREEN' as const
      };
    });

    // 4. Process Confirm Purchase Transaction
    makePurchase({
      supplier_id: currentSupplierId,
      invoice_number: verificationData.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
      invoice_date: verificationData.invoice_date || new Date().toISOString().split('T')[0],
      total_amount: verificationData.total_amount,
      items: resolvedLines.map(l => {
        const piecePurchaseRate = l.purchase_rate || 0;
        const pieceSellingRate = l.selling_price || 0;
        const pieceQty = l.quantity || 0;

        return {
          product_id: l.matched_product_id,
          quantity: pieceQty,
          carton_qty: 0,
          loose_qty: pieceQty,
          trading_unit: 'Piece',
          base_unit: 'Piece',
          units_per_trading_unit: 1,
          units_per_box_carton: 1,
          purchase_rate: Math.round(piecePurchaseRate * 100) / 100,
          carton_rate: Math.round(piecePurchaseRate * 100) / 100,
          loose_purchase_rate: Math.round(piecePurchaseRate * 100) / 100,
          loose_rate: Math.round(piecePurchaseRate * 100) / 100,
          selling_price: Math.round(pieceSellingRate * 100) / 100,
          loose_selling_price: Math.round(pieceSellingRate * 100) / 100,
          discount: l.discount || 0,
          free_quantity: l.free_quantity || 0,
          mrp: l.mrp || 0,
          gst_percent: l.gst_percent || 18,
          hsn: l.hsn || '',
          batch: l.batch || '',
          expiry_date: l.expiry_date || ''
        };
      })
    });

    alert('Purchase successfully inwarded! Master product records, batches, and inventory have been saved to your catalog.');
    router.push('/admin/products');
  };

  // Open Detailed Single Item Editor Modal
  const openSingleItemEditorModal = (lineId: string) => {
    const line = verificationData?.lines.find(l => l.id === lineId);
    if (!line) return;

    setResolvingLineId(lineId);
    setResolutionMode('EDIT_SINGLE');
    setFormProductName(line.custom_name || line.extracted_name);
    setFormCompanyId(line.company_id || '');
    setFormPacking(line.pack_size);
    setFormHsn(line.hsn);
    setFormGstRate(line.gst_percent);
    setFormMrp(line.mrp);
    setFormRate(line.purchase_rate);
    setFormSellingPrice(line.selling_price);
    setFormQuantity(line.quantity);
    setFormFreeQuantity(line.free_quantity);
    setFormBatch(line.batch);
    setFormExpiry(line.expiry_date);
  };

  const handleSaveSingleItemEdit = () => {
    if (!resolvingLineId || !verificationData) return;
    if (!formCompanyId) {
      alert('Please select a company for this item.');
      return;
    }

    const comp = companies.find(c => c.id === formCompanyId);
    const compName = comp?.name || 'General';
    const itemName = formProductName.trim();

    // Check if product exists or create it
    let matchedProd = products.find(p => p.id === formCompanyId) || products.find(p => p.name.toLowerCase() === itemName.toLowerCase() && p.company_id === formCompanyId);
    if (!matchedProd) {
      matchedProd = createProduct(
        itemName,
        compName,
        formPacking || '1 Pc',
        formHsn || '1905',
        formGstRate || 18,
        formMrp || 100,
        formSellingPrice || formRate || 90
      );
    }

    const lines = verificationData.lines.map(l => {
      if (l.id === resolvingLineId) {
        return {
          ...l,
          custom_name: itemName,
          company_id: formCompanyId,
          matched_product_id: matchedProd.id,
          confidence: 'GREEN' as const,
          resolved_from: 'CREATE_NEW' as const,
          pack_size: formPacking,
          hsn: formHsn,
          gst_percent: formGstRate,
          mrp: formMrp,
          purchase_rate: formRate,
          selling_price: formSellingPrice,
          quantity: formQuantity,
          free_quantity: formFreeQuantity,
          batch: formBatch,
          expiry_date: formExpiry
        };
      }
      return l;
    });

    const total_amount = lines.reduce((sum, line) => {
      const lineSub = line.purchase_rate * line.quantity;
      const discLine = line.discount * line.quantity;
      const taxable = Math.max(0, lineSub - discLine);
      const gst = taxable * (line.gst_percent / 100);
      return sum + taxable + gst;
    }, 0);

    setVerificationData({
      ...verificationData,
      lines,
      total_amount
    });

    setResolvingLineId(null);
    setResolutionMode(null);
  };

  // Search Modal
  const openSearchModal = (lineId: string, query: string) => {
    setResolvingLineId(lineId);
    setResolutionMode('SEARCH');
    setSearchQuery(query);
  };

  const openCreateVariantModal = (lineId: string, parentProductId?: string) => {
    setResolvingLineId(lineId);
    setResolutionMode('NEW_VARIANT');
    setSelectedParentProductId(parentProductId || '');
    
    const line = verificationData?.lines.find(l => l.id === lineId);
    const parent = products.find(p => p.id === parentProductId);
    const weightInfo = line ? extractWeightOrVolume(line.extracted_name) : null;
    
    if (parent) {
      const baseName = parent.name.replace(/\d+\s*(?:g|gm|kg|ml|l|ltr|pcs|pc|units)\b/i, '').trim();
      setFormProductName(baseName);
      setFormCompanyId(parent.company_id);
      setFormCompanyName(companies.find(c => c.id === parent.company_id)?.name || parent.brand || '');
      setFormHsn(parent.hsn);
      setFormGstRate(parent.gst_percent);
      setFormPacking(parent.pack_size);
    } else {
      setFormProductName(line ? line.extracted_name.replace(/\d+\s*(?:g|gm|kg|ml|l|ltr|pcs|pc|units)\b/i, '').trim() : '');
      setFormCompanyId(line?.company_id || '');
      setFormCompanyName('');
      setFormHsn(line ? line.hsn : '');
      setFormGstRate(line ? line.gst_percent : 18);
      setFormPacking(line ? line.pack_size : '');
    }
    
    setFormWeight(weightInfo ? weightInfo.value.toString() : '');
    setFormUnit(weightInfo ? weightInfo.unit : 'g');
    setFormMrp(line ? line.mrp : 0);
    setFormRate(line ? line.purchase_rate : 0);
  };

  const openCreateProductModal = (lineId: string) => {
    setResolvingLineId(lineId);
    setResolutionMode('NEW_PRODUCT');
    
    const line = verificationData?.lines.find(l => l.id === lineId);
    const weightInfo = line ? extractWeightOrVolume(line.extracted_name) : null;
    
    setFormProductName(line ? line.extracted_name.replace(/\d+\s*(?:g|gm|kg|ml|l|ltr|pcs|pc|units)\b/i, '').trim() : '');
    setFormCompanyId(line?.company_id || '');
    setFormCompanyName(companies.find(c => c.id === line?.company_id)?.name || '');
    setFormWeight(weightInfo ? weightInfo.value.toString() : '');
    setFormUnit(weightInfo ? weightInfo.unit : 'g');
    setFormPacking(line ? line.pack_size : '');
    setFormHsn(line ? line.hsn : '');
    setFormGstRate(line ? line.gst_percent : 18);
    setFormMrp(line ? line.mrp : 0);
    setFormRate(line ? line.purchase_rate : 0);
  };

  const openReviewFuzzyModal = (lineId: string, suggestedProductId: string) => {
    setResolvingLineId(lineId);
    setResolutionMode('REVIEW_FUZZY');
    setSelectedParentProductId(suggestedProductId);
  };

  // Search Results
  const searchResults = searchQuery.trim() === '' ? [] : products.filter(p => {
    const q = searchQuery.toLowerCase();
    const compName = companies.find(c => c.id === p.company_id)?.name || '';
    return p.name.toLowerCase().includes(q) ||
           p.sku.toLowerCase().includes(q) ||
           p.barcode.toLowerCase().includes(q) ||
           compName.toLowerCase().includes(q);
  });

  // Download Extracted Data Handler
  const handleDownloadExtractedData = () => {
    if (!verificationData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(verificationData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `extracted_invoice_${verificationData.invoice_number || 'draft'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Dynamic Companies List from Extracted Lines
  const invoiceCompanies = Array.from(new Set(
    (verificationData?.lines || []).map(line => {
      const comp = companies.find(c => c.id === line.company_id);
      return comp?.name;
    }).filter((name): name is string => typeof name === 'string')
  ));

  // Filter and Search verification lines
  const filteredLines = (verificationData?.lines || []).map((line, idx) => ({ ...line, originalIdx: idx })).filter((line) => {
    if (tableSearchQuery.trim() !== '') {
      const q = tableSearchQuery.toLowerCase();
      const matchedProd = products.find(p => p.id === line.matched_product_id);
      const suggestedProd = products.find(p => p.id === line.suggested_product_id);
      
      const inExtractedName = (line.custom_name || line.extracted_name).toLowerCase().includes(q);
      const inMatchedName = matchedProd?.name.toLowerCase().includes(q) || false;
      const inSuggestedName = suggestedProd?.name.toLowerCase().includes(q) || false;
      const inHsn = line.hsn.toLowerCase().includes(q) || matchedProd?.hsn.toLowerCase().includes(q) || false;
      const inBatch = line.batch.toLowerCase().includes(q);
      const inSku = line.sku?.toLowerCase().includes(q) || matchedProd?.sku.toLowerCase().includes(q) || suggestedProd?.sku.toLowerCase().includes(q) || false;
      
      if (!inExtractedName && !inMatchedName && !inSuggestedName && !inHsn && !inBatch && !inSku) {
        return false;
      }
    }

    if (statusFilter === 'RESOLVED' && line.confidence !== 'GREEN') {
      return false;
    }
    if (statusFilter === 'PENDING' && line.confidence === 'GREEN') {
      return false;
    }

    if (matchTypeFilter !== 'ALL' && line.confidence !== matchTypeFilter) {
      return false;
    }

    if (companyFilter !== 'ALL') {
      const company = companies.find(c => c.id === line.company_id);
      const compName = company ? company.name.toLowerCase() : '';
      if (!compName.includes(companyFilter.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Verification Counts
  const linesCount = verificationData?.lines.length || 0;
  const highMatchesCount = verificationData?.lines.filter(l => l.confidence === 'GREEN').length || 0;
  const fuzzyMatchesCount = verificationData?.lines.filter(l => l.confidence === 'YELLOW').length || 0;
  const unmatchedCount = verificationData?.lines.filter(l => l.confidence === 'RED').length || 0;
  const unassignedCompanyCount = verificationData?.lines.filter(l => !l.company_id).length || 0;
  const isFullyResolved = linesCount > 0 && fuzzyMatchesCount === 0 && unmatchedCount === 0 && unassignedCompanyCount === 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">AI Purchase Import</h2>
          <p className="text-xs text-slate-500 mt-1">Extract purchase bills, assign companies, customize product details, and inward stock.</p>
        </div>
        {verificationData && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAutomatedEditorModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm text-xs transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>⚡ Automated Review &amp; Edit All</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to discard this parsed invoice and upload a new one?")) {
                  setVerificationData(null);
                  setUploadedFileName('');
                  setDuplicateWarning(false);
                  setErrorMsg('');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-bold rounded-lg shadow-sm text-xs transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New Bill</span>
            </button>
          </div>
        )}
      </div>

      {!verificationData ? (
        <div className="max-w-3xl mx-auto my-8 space-y-6">
          <div className="erp-card bg-white p-8 space-y-6 shadow-sm border border-slate-200 rounded-2xl">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Select supplier &amp; Upload Purchase Bill</h3>
            
            <div className="space-y-5">
              {/* Supplier select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Supplier (Optional)</label>
                  <button
                    type="button"
                    onClick={() => handleOpenSupplierModal(false)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Supplier</span>
                  </button>
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3.5 text-xs outline-none focus:border-indigo-500 font-semibold text-slate-700 bg-white shadow-sm transition-all"
                >
                  <option value="">-- Choose Supplier (Auto-detected from bill if left empty) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.gstin ? `(${s.gstin})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Drag & Drop File Upload */}
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={uploading}
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 p-4 transition-all ${
                    uploading 
                      ? 'bg-indigo-50/25 border-indigo-200 cursor-wait' 
                      : 'bg-white border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50 shadow-sm'
                  }`}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
                      <span className="text-xs font-bold text-indigo-700">AI Reading invoice...</span>
                      <span className="text-xs text-slate-500 font-medium">Performing OCR &amp; extracting items from purchase invoice</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">Select Purchase Bill</span>
                      <span className="text-xs text-slate-500 font-medium text-center">Supports PDF, JPG, PNG bills</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start justify-between gap-3 text-xs font-semibold shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Extraction Notice</span>
                  <p className="mt-1 opacity-90">{errorMsg}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unrecognized Company Approval Banner (Rule 1 & Rule 2) */}
          {detectedUnmappedCompany && !mappedCompanyId && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-200/80 rounded-xl text-amber-900 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-950 uppercase tracking-wide">
                    Detected New Company: &ldquo;{detectedUnmappedCompany}&rdquo;
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5 font-medium">
                    This invoice contains items from an unrecognized company. Please create this company or map to an existing one.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewCompanyNameInput(detectedUnmappedCompany);
                  setNewCompanyCodeInput(detectedUnmappedCompany.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setExistingCompanySelection(companies[0]?.id || '');
                  setShowCompanyApprovalModal(true);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                <span>+ Create or Map Company</span>
              </button>
            </div>
          )}

          {/* Unassigned Company Warning Banner */}
          {unassignedCompanyCount > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-200 text-rose-900 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-rose-950 uppercase tracking-wide">
                    Company Selection Required for {unassignedCompanyCount} Item(s)
                  </h4>
                  <p className="text-xs text-rose-800 mt-0.5 font-medium">
                    Always specify under which company each item belongs. Use the batch selector below or set individually in each row.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={bulkToolbarCompanyId}
                  onChange={(e) => setBulkToolbarCompanyId(e.target.value)}
                  className="border border-rose-300 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">-- Choose Company for All --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!bulkToolbarCompanyId) {
                      alert('Please choose a company from the dropdown first.');
                      return;
                    }
                    handleApplyCompanyToAll(bulkToolbarCompanyId, true);
                  }}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Apply to Unassigned
                </button>
              </div>
            </div>
          )}

          {/* 3. Summary Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">TOTAL ITEMS</span>
                <p className="text-xl font-black text-slate-800 leading-none mt-1">{linesCount}</p>
                <span className="text-xs text-slate-500 font-medium block mt-0.5">Parsed from bill</span>
              </div>
            </div>

            <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">HIGH MATCH</span>
                <p className="text-xl font-black text-emerald-700 leading-none mt-1">{highMatchesCount}</p>
                <span className="text-xs text-emerald-600 font-bold block mt-0.5">✓ Ready</span>
              </div>
            </div>

            <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">FUZZY MATCH</span>
                <p className="text-xl font-black text-amber-700 leading-none mt-1">{fuzzyMatchesCount}</p>
                <span className="text-xs text-amber-600 font-bold block mt-0.5">⚠ Needs verify</span>
              </div>
            </div>

            <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">UNMATCHED</span>
                <p className="text-xl font-black text-rose-700 leading-none mt-1">{unmatchedCount}</p>
                <span className="text-xs text-rose-600 font-bold block mt-0.5">🔴 Needs linking</span>
              </div>
            </div>

            <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">COMPANIES</span>
                <p className="text-xl font-black text-purple-700 leading-none mt-1">{invoiceCompanies.length}</p>
                <span className="text-xs text-purple-600 font-bold block mt-0.5">Assigned brands</span>
              </div>
            </div>
          </div>

          {/* Automated Batch Review Action Banner (Rule 3) */}
          <div className="p-4 bg-linear-to-r from-purple-700 via-indigo-600 to-indigo-800 rounded-2xl text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                  <span>⚡ Automated Option: Review &amp; Edit Every Information Manually</span>
                </h4>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Open the full batch editor to customize Product Names, Companies, Packing, HSN, Tax, MRP, and Rates before creating.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAutomatedEditorModal(true)}
              className="px-5 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-purple-600" />
              <span>⚡ Open Automated Batch Editor</span>
            </button>
          </div>

          {/* 4. Uploaded Invoice Information */}
          <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex flex-col xl:flex-row items-center justify-between gap-4 text-xs shadow-sm">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0 w-full xl:w-auto pb-3 xl:pb-0 border-b xl:border-b-0 xl:border-r border-slate-100 xl:pr-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">INVOICE FILE</span>
                <span className="font-bold text-slate-800 truncate block max-w-[200px]" title={uploadedFileName}>{uploadedFileName || 'Uploaded Invoice'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1 w-full text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Supplier Link</label>
                  <button
                    type="button"
                    onClick={() => handleOpenSupplierModal(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add</span>
                  </button>
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Invoice Number</label>
                <input
                  type="text"
                  value={verificationData.invoice_number}
                  onChange={(e) => setVerificationData({ ...verificationData, invoice_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Invoice Date</label>
                <input
                  type="date"
                  value={verificationData.invoice_date}
                  onChange={(e) => setVerificationData({ ...verificationData, invoice_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="45 Days">45 Days</option>
                  <option value="60 Days">60 Days</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Dispatch Mode</label>
                <select
                  value={dispatchMode}
                  onChange={(e) => setDispatchMode(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="Road">Road</option>
                  <option value="Rail">Rail</option>
                  <option value="Air">Air</option>
                  <option value="Courier">Courier</option>
                  <option value="Hand Delivery">Hand Delivery</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 xl:pl-6 xl:border-l border-slate-100 w-full xl:w-auto justify-end">
              <button
                type="button"
                onClick={() => setViewingRawData(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-bold rounded-lg shadow-sm transition-all flex-shrink-0 cursor-pointer text-xs"
              >
                <Eye className="w-4 h-4" />
                <span>View Extracted Data</span>
              </button>
            </div>
          </div>

          {/* 5. Filter / Search & Batch Company Toolbar (Rule 1 & Rule 2) */}
          <div className="erp-card bg-white p-4 border border-slate-200/80 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto flex-1">
              {/* Search */}
              <div className="flex-1 min-w-[200px] lg:max-w-xs">
                <SmartSearchBar
                  value={tableSearchQuery}
                  onChange={setTableSearchQuery}
                  placeholder="Search by product, SKU, HSN..."
                  entityFilter={['product']}
                  size="sm"
                />
              </div>

              {/* Status */}
              <div className="flex items-center gap-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="RESOLVED">Resolved Only</option>
                  <option value="PENDING">Pending Review</option>
                </select>
              </div>

              {/* Match Type */}
              <div className="flex items-center gap-1">
                <select
                  value={matchTypeFilter}
                  onChange={(e) => setMatchTypeFilter(e.target.value as any)}
                  className="border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="ALL">All Match Types</option>
                  <option value="GREEN">High Match</option>
                  <option value="YELLOW">Fuzzy Match</option>
                  <option value="RED">Unmatched</option>
                </select>
              </div>

              {/* Company Filter */}
              <div className="flex items-center gap-1">
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="ALL">All Companies</option>
                  {invoiceCompanies.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Batch Set Company for All Items */}
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 pl-1">Set Company for All:</span>
                <select
                  value={bulkToolbarCompanyId}
                  onChange={(e) => setBulkToolbarCompanyId(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">-- Choose Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!bulkToolbarCompanyId) {
                      alert('Please select a company first.');
                      return;
                    }
                    handleApplyCompanyToAll(bulkToolbarCompanyId, false);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Apply All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCompanyNameInput('');
                    setNewCompanyCodeInput('');
                    setShowCompanyApprovalModal(true);
                  }}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  title="Create new company"
                >
                  + New
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-shrink-0">
              <button
                type="button"
                onClick={handleDownloadExtractedData}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold rounded-lg shadow-sm transition-all cursor-pointer text-xs"
              >
                <Download className="w-4 h-4 text-slate-550" />
                <span>Download Extracted Data</span>
              </button>

              <div className="relative group">
                <button
                  onClick={handleConfirmPurchase}
                  disabled={!isFullyResolved || !selectedSupplierId}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-bold shadow-md transition-all ${
                    isFullyResolved && selectedSupplierId
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-lg'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Purchase</span>
                </button>
                {(!isFullyResolved || !selectedSupplierId) && (
                  <span className="absolute bottom-full right-0 mb-2 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-center leading-normal z-20">
                    {!selectedSupplierId ? 'Select database supplier' : unassignedCompanyCount > 0 ? `Assign company to all ${unassignedCompanyCount} remaining items` : 'Resolve all items before confirming'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 6. Main Product List Table */}
          <div className="erp-card bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50/75 select-none">
                    <th className="py-4 pl-4 pr-2 text-center w-[40px]">#</th>
                    <th className="py-4 px-3 w-[260px]">Product Details &amp; Printed MRP</th>
                    <th className="py-4 px-3 w-[220px]">Company / Manufacturer</th>
                    <th className="py-4 px-3 w-[220px]">Matched Product / Master</th>
                    <th className="py-4 px-3 w-[140px] text-center">Stock Inward Qty (Pcs)</th>
                    <th className="py-4 px-3 w-[160px]">Purchase Rate / Pc (₹)</th>
                    <th className="py-4 px-3 w-[180px] text-right bg-emerald-50/40 border-x border-emerald-100/60">Wholesale Selling Rate</th>
                    <th className="py-4 px-3 w-[110px] text-right">Taxable (₹)</th>
                    <th className="py-4 px-3 w-[80px] text-center">GST</th>
                    <th className="py-4 px-3 w-[110px] text-right">Total (₹)</th>
                    <th className="py-4 pl-3 pr-4 text-center w-[100px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold text-xs">
                        No product lines match the active search/filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((line, fIndex) => {
                      const matchedProduct = products.find(p => p.id === line.matched_product_id);
                      const suggestedProduct = products.find(p => p.id === line.suggested_product_id);
                      const assignedCompany = companies.find(c => c.id === line.company_id);

                      const piecePurchaseRate = line.purchase_rate || 0;
                      const pieceSellingRate = line.selling_price || 0;
                      const pieceInwardQty = line.quantity || 0;
                      const pieceFreeQty = line.free_quantity || 0;

                      const marginPercent = pieceSellingRate > 0 ? (((pieceSellingRate - piecePurchaseRate) / pieceSellingRate) * 100) : 0;
                      const isNegativeMargin = pieceSellingRate > 0 && pieceSellingRate < piecePurchaseRate;

                      const discLine = (line.discount || 0) * pieceInwardQty;
                      const taxable = Math.max(0, (piecePurchaseRate * pieceInwardQty) - discLine);
                      const gstAmount = taxable * ((line.gst_percent || 18) / 100);
                      const totalVal = taxable + gstAmount;

                      return (
                        <tr key={line.id} id={line.id} className="hover:bg-slate-50/40 transition-colors align-top">
                          {/* 1. # */}
                          <td className="py-4 pl-4 pr-2 text-center font-bold text-slate-500 border-r border-slate-50 font-mono pt-4">
                            {fIndex + 1}
                          </td>

                          {/* 2. Product Details */}
                          <td className="py-4 px-3">
                            <span className="font-extrabold text-slate-900 block text-xs leading-snug">
                              {line.custom_name || line.extracted_name}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 font-medium mt-1.5">
                              {line.mrp ? <span className="font-bold text-emerald-700">MRP: ₹{line.mrp}</span> : null}
                              {line.mrp ? <span className="text-slate-300">•</span> : null}
                              <span>HSN: <strong className="text-slate-700 font-bold">{line.hsn || '—'}</strong></span>
                              <span className="text-slate-300">•</span>
                              <span>Batch: <strong className="text-slate-700 font-bold">{line.batch || '—'}</strong></span>
                              <span className="text-slate-300">•</span>
                              <span>Exp: <strong className="text-slate-700 font-bold">{line.expiry_date || '—'}</strong></span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {line.confidence === 'GREEN' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ HIGH MATCH
                                </span>
                              )}
                              {line.confidence === 'YELLOW' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                  ⚠ FUZZY MATCH
                                </span>
                              )}
                              {line.confidence === 'RED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  ! UNMATCHED
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Company / Manufacturer Selector (Rule 1 & Rule 2) */}
                          <td className="py-4 px-3 border-r border-slate-50">
                            <div className="space-y-1">
                              <select
                                value={line.company_id || ''}
                                onChange={(e) => handleUpdateLineField(line.id, 'company_id', e.target.value)}
                                className={`w-full border rounded-lg p-2 text-xs font-bold outline-none ${
                                  !line.company_id 
                                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-600' 
                                    : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500'
                                }`}
                              >
                                <option value="">-- Select Company (Required) --</option>
                                {companies.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              {!line.company_id ? (
                                <span className="text-[10px] font-bold text-rose-600 block">
                                  ⚠️ Required: Select Company
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 block">
                                  🏢 Brand: {assignedCompany?.name}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. Matched Product / Action */}
                          <td className="py-4 px-3 border-r border-slate-50">
                            {line.confidence === 'GREEN' && matchedProduct && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-xs leading-tight">{matchedProduct.name}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                                    MRP: ₹{matchedProduct.mrp}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 block font-medium">
                                  SKU: {matchedProduct.sku} &bull; {companies.find(c => c.id === matchedProduct.company_id)?.name || matchedProduct.brand}
                                </span>
                                <div className="flex items-center gap-2 pt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                                    ✓ Linked
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openSearchModal(line.id, line.extracted_name)}
                                    className="text-[10px] text-slate-500 hover:text-indigo-600 underline font-semibold cursor-pointer"
                                  >
                                    Change
                                  </button>
                                </div>
                              </div>
                            )}

                            {line.confidence === 'YELLOW' && suggestedProduct && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-xs leading-tight">{suggestedProduct.name}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                                    MRP: ₹{suggestedProduct.mrp}
                                  </span>
                                </div>
                                <div className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  {line.difference || '⚠️ Verify product details'}
                                </div>

                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => openReviewFuzzyModal(line.id, suggestedProduct.id)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2 py-1 rounded shadow-xs transition-all cursor-pointer uppercase"
                                  >
                                    Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openSearchModal(line.id, line.extracted_name)}
                                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] px-2 py-1 rounded shadow-xs transition-all cursor-pointer uppercase"
                                  >
                                    Search
                                  </button>
                                </div>
                              </div>
                            )}

                            {line.confidence === 'RED' && (
                              <div className="space-y-1.5">
                                <span className="font-bold text-rose-600 text-xs block">No matching product found</span>
                                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => openSearchModal(line.id, line.extracted_name)}
                                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] px-2 py-1 rounded cursor-pointer uppercase"
                                  >
                                    Search
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCreateVariantModal(line.id, line.suggested_product_id || line.matched_product_id)}
                                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-[10px] px-2 py-1 rounded cursor-pointer uppercase"
                                  >
                                    + Variant
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCreateProductModal(line.id)}
                                    className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-[10px] px-2 py-1 rounded cursor-pointer uppercase"
                                  >
                                    + Product
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 5. Stock Inward Qty (Pcs) */}
                          <td className="py-4 px-3 text-center border-r border-slate-50">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="flex flex-col items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={line.quantity}
                                    onChange={(e) => handleUpdateLineField(line.id, 'quantity', parseInt(e.target.value) || 0)}
                                    className="w-16 border border-slate-300 rounded text-center py-1 font-bold text-slate-800 focus:border-indigo-500 outline-none text-xs bg-white font-mono shadow-2xs"
                                  />
                                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Billed</span>
                                </div>
                                <span className="text-xs text-slate-400 font-bold pb-2">+</span>
                                <div className="flex flex-col items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={line.free_quantity}
                                    onChange={(e) => handleUpdateLineField(line.id, 'free_quantity', parseInt(e.target.value) || 0)}
                                    className="w-12 border border-slate-200 rounded text-center py-1 font-semibold text-slate-600 focus:border-indigo-500 outline-none text-xs bg-white font-mono"
                                  />
                                  <span className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Free</span>
                                </div>
                              </div>
                              <div className="text-[10px] font-bold text-indigo-700">
                                Total: {(pieceInwardQty + pieceFreeQty)} Pcs
                              </div>
                            </div>
                          </td>

                          {/* 6. Purchase Rate per Piece (₹) & Disc */}
                          <td className="py-4 px-3 space-y-1.5 border-r border-slate-50">
                            <div>
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                <span>Rate / Pc (₹):</span>
                              </div>
                              <div className="relative flex items-center">
                                <span className="text-xs text-slate-500 font-bold absolute left-1.5">₹</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={line.purchase_rate}
                                  onChange={(e) => handleUpdateLineField(line.id, 'purchase_rate', parseFloat(e.target.value) || 0)}
                                  className="w-full pl-4 pr-1.5 py-1 text-right font-extrabold text-slate-800 font-mono text-xs border border-slate-200 rounded-lg focus:border-indigo-500 outline-none bg-white shadow-2xs"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                              <span className="font-semibold text-[10px]">Disc:</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={line.discount}
                                onChange={(e) => handleUpdateLineField(line.id, 'discount', parseFloat(e.target.value) || 0)}
                                className="w-14 text-right py-0.5 px-1 font-bold text-slate-700 font-mono text-xs border border-slate-200 rounded focus:border-indigo-500 outline-none bg-white"
                              />
                            </div>
                          </td>

                          {/* 7. Wholesale Selling Rate per Piece & Live Margin % */}
                          <td className="py-4 px-3 bg-emerald-50/20 border-r border-emerald-100/50">
                            <div className={`p-2 rounded-xl border space-y-1.5 ${isNegativeMargin ? 'bg-rose-50/80 border-rose-300' : 'bg-white border-emerald-200 shadow-2xs'}`}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Rate / Pc:</span>
                                <div className="relative flex items-center flex-1 max-w-[100px]">
                                  <span className="text-xs text-slate-500 font-bold absolute left-1.5">₹</span>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={line.selling_price || ''}
                                    onChange={(e) => handleUpdateLineField(line.id, 'selling_price', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className={`w-full pl-4 pr-1.5 py-1 text-right font-black font-mono text-xs border rounded-lg bg-white outline-none ${
                                      isNegativeMargin 
                                        ? 'border-rose-400 text-rose-800 focus:border-rose-600' 
                                        : 'border-emerald-300 text-emerald-950 focus:border-emerald-600'
                                    }`}
                                  />
                                </div>
                              </div>

                              {pieceSellingRate > 0 ? (
                                isNegativeMargin ? (
                                  <div className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] tracking-tight animate-pulse">
                                    <span>⚠️ Negative ({marginPercent.toFixed(1)}%)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] tracking-tight">
                                    <span>✓ {marginPercent >= 0 ? `+${marginPercent.toFixed(1)}%` : `${marginPercent.toFixed(1)}%`} Margin</span>
                                  </div>
                                )
                              ) : (
                                <div className="text-[10px] text-amber-800 font-bold text-center bg-amber-50 rounded py-0.5 border border-amber-200">
                                  Set Selling Rate
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 8. Taxable */}
                          <td className="py-4 px-3 text-right font-bold text-slate-800 font-mono text-xs border-l border-slate-50 pr-2">
                            ₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 9. GST */}
                          <td className="py-4 px-3 text-center border-l border-slate-50">
                            <span className="font-bold text-slate-700 text-xs block">{line.gst_percent || 18}%</span>
                            <span className="text-[11px] text-slate-500 block font-mono font-bold mt-0.5">
                              ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* 10. Total */}
                          <td className="py-4 px-3 text-right font-extrabold text-indigo-700 font-mono text-xs border-l border-slate-50 pr-2">
                            ₹{totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 11. Actions */}
                          <td className="py-4 pl-3 pr-4 text-center border-l border-slate-50">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openSingleItemEditorModal(line.id)}
                                className="flex items-center gap-1 text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer uppercase w-full justify-center"
                                title="Edit every detail manually"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              {line.confidence !== 'GREEN' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (line.confidence === 'YELLOW') {
                                      openReviewFuzzyModal(line.id, suggestedProduct!.id);
                                    } else {
                                      openSearchModal(line.id, line.extracted_name);
                                    }
                                  }}
                                  className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer uppercase w-full text-center"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="h-24" />
        </div>
      )}

      {/* 6. Sticky Bottom Review Bar */}
      {verificationData && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 flex items-center justify-between shadow-2xl animate-slide-up no-print">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${isFullyResolved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isFullyResolved ? <CheckCircle className="w-4.5 h-4.5" /> : <AlertTriangle className="w-4.5 h-4.5" />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {isFullyResolved 
                  ? `✓ All ${linesCount} items resolved & verified with assigned companies` 
                  : `${highMatchesCount} of ${linesCount} items ready. ${unassignedCompanyCount > 0 ? `${unassignedCompanyCount} missing company.` : ''} ${fuzzyMatchesCount + unmatchedCount} need review.`}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {!isFullyResolved 
                  ? 'Assign companies and resolve all items to enable purchase confirmation.' 
                  : 'Master catalog, stock ledger, and batch inventories will update automatically upon confirmation.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">INVOICE TOTAL</span>
              <span className="text-sm font-extrabold text-slate-800">₹{verificationData.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAutomatedEditorModal(true)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>⚡ Automated Batch Editor</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={!isFullyResolved || !selectedSupplierId}
                className={`flex items-center gap-1.5 font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer ${
                  isFullyResolved && selectedSupplierId
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Confirm Purchase &amp; Inward Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: AUTOMATED BATCH REVIEW & FULL MANUAL EDITOR (Rule 3)
          ======================================================== */}
      {showAutomatedEditorModal && verificationData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in no-print overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl border border-slate-200 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/75 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>⚡ Automated Item Review &amp; Full Manual Editor</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800">
                      {verificationData.lines.length} Items
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Review and manually edit every field (Product Name, Company, Packing, Tax, MRP, Rates, Batch, Expiry) for each individual item before creating master products.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAutomatedEditorModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch Controls Toolbar */}
            <div className="p-4 bg-purple-50/50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-purple-950 uppercase tracking-wide">1. Company For All:</span>
                  <select
                    value={bulkToolbarCompanyId}
                    onChange={(e) => setBulkToolbarCompanyId(e.target.value)}
                    className="border border-purple-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white shadow-2xs"
                  >
                    <option value="">-- Choose Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!bulkToolbarCompanyId) {
                        alert('Please choose a company first.');
                        return;
                      }
                      handleApplyCompanyToAll(bulkToolbarCompanyId, false);
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Apply to All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCompanyNameInput('');
                      setNewCompanyCodeInput('');
                      setShowCompanyApprovalModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    + New Company
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pl-3 border-l border-purple-200">
                  <span className="font-extrabold text-purple-950 uppercase tracking-wide">2. Quick Margin:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyMarginToAll(10)}
                    className="px-2.5 py-1.5 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 font-bold rounded-lg cursor-pointer"
                  >
                    +10%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMarginToAll(15)}
                    className="px-2.5 py-1.5 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 font-bold rounded-lg cursor-pointer"
                  >
                    +15%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyMarginToAll(20)}
                    className="px-2.5 py-1.5 bg-white border border-purple-200 hover:bg-purple-100 text-purple-800 font-bold rounded-lg cursor-pointer"
                  >
                    +20%
                  </button>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-purple-900">
                  {unassignedCompanyCount > 0 
                    ? `⚠️ ${unassignedCompanyCount} items need company selection` 
                    : `✓ All ${linesCount} items ready for creation`}
                </span>
              </div>
            </div>

            {/* Editable Table */}
            <div className="p-4 overflow-y-auto overflow-x-auto flex-1 text-xs">
              <table className="w-full text-left border-collapse min-w-[1500px]">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider bg-slate-100/75 select-none">
                    <th className="py-3 px-2 text-center w-[40px]">#</th>
                    <th className="py-3 px-2 w-[280px]">Master Product Name</th>
                    <th className="py-3 px-2 w-[200px]">Company / Brand <span className="text-rose-500">*</span></th>
                    <th className="py-3 px-2 w-[140px]">Pack Size / Pcs</th>
                    <th className="py-3 px-2 w-[110px]">HSN Code</th>
                    <th className="py-3 px-2 w-[90px]">GST Slab</th>
                    <th className="py-3 px-2 w-[100px]">MRP (₹)</th>
                    <th className="py-3 px-2 w-[90px] text-center">Inward Qty</th>
                    <th className="py-3 px-2 w-[80px] text-center">Free Qty</th>
                    <th className="py-3 px-2 w-[110px]">Purchase Rate (₹)</th>
                    <th className="py-3 px-2 w-[150px] bg-emerald-50/50">Wholesale Rate (₹)</th>
                    <th className="py-3 px-2 w-[110px]">Batch No.</th>
                    <th className="py-3 px-2 w-[120px]">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {verificationData.lines.map((line, idx) => {
                    const pRate = line.purchase_rate || 0;
                    const sRate = line.selling_price || 0;
                    const margin = sRate > 0 ? (((sRate - pRate) / sRate) * 100) : 0;
                    const isNeg = sRate > 0 && sRate < pRate;

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* # */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500 font-mono">
                          {idx + 1}
                        </td>

                        {/* Product Name */}
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={line.custom_name !== undefined ? line.custom_name : line.extracted_name}
                            onChange={(e) => handleUpdateLineField(line.id, 'custom_name', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none text-xs"
                            placeholder="Product Name"
                          />
                        </td>

                        {/* Company Dropdown (Rule 1 & Rule 2) */}
                        <td className="py-2.5 px-2">
                          <select
                            value={line.company_id || ''}
                            onChange={(e) => handleUpdateLineField(line.id, 'company_id', e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded-lg font-bold text-xs outline-none ${
                              !line.company_id
                                ? 'border-rose-400 bg-rose-50/60 text-rose-900'
                                : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500'
                            }`}
                          >
                            <option value="">-- Choose Company --</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Pack Size */}
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={line.pack_size}
                            onChange={(e) => handleUpdateLineField(line.id, 'pack_size', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                            placeholder="e.g. 24 Pcs"
                          />
                        </td>

                        {/* HSN */}
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={line.hsn}
                            onChange={(e) => handleUpdateLineField(line.id, 'hsn', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                            placeholder="HSN"
                          />
                        </td>

                        {/* GST */}
                        <td className="py-2.5 px-2">
                          <select
                            value={line.gst_percent}
                            onChange={(e) => handleUpdateLineField(line.id, 'gst_percent', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>

                        {/* MRP */}
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            step="any"
                            value={line.mrp || ''}
                            onChange={(e) => handleUpdateLineField(line.id, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800 bg-white focus:border-indigo-500 outline-none text-xs text-right"
                            placeholder="0.00"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            value={line.quantity}
                            onChange={(e) => handleUpdateLineField(line.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-1.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none text-xs text-center"
                          />
                        </td>

                        {/* Free Quantity */}
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            value={line.free_quantity}
                            onChange={(e) => handleUpdateLineField(line.id, 'free_quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-1.5 py-1.5 border border-slate-200 rounded-lg font-mono font-semibold text-slate-600 bg-white focus:border-indigo-500 outline-none text-xs text-center"
                          />
                        </td>

                        {/* Purchase Rate */}
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            step="any"
                            value={line.purchase_rate}
                            onChange={(e) => handleUpdateLineField(line.id, 'purchase_rate', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none text-xs text-right"
                          />
                        </td>

                        {/* Wholesale Selling Rate & Margin */}
                        <td className="py-2.5 px-2 bg-emerald-50/30">
                          <div className="space-y-1">
                            <input
                              type="number"
                              step="any"
                              value={line.selling_price || ''}
                              onChange={(e) => handleUpdateLineField(line.id, 'selling_price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className={`w-full px-2 py-1.5 border rounded-lg font-mono font-black text-xs text-right outline-none ${
                                isNeg 
                                  ? 'border-rose-400 bg-rose-50 text-rose-900' 
                                  : 'border-emerald-300 bg-white text-emerald-950'
                              }`}
                            />
                            {sRate > 0 && (
                              <div className={`text-[10px] text-center font-bold rounded py-0.5 ${isNeg ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                {margin >= 0 ? `+${margin.toFixed(1)}%` : `${margin.toFixed(1)}%`} Margin
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Batch */}
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={line.batch}
                            onChange={(e) => handleUpdateLineField(line.id, 'batch', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                            placeholder="Batch"
                          />
                        </td>

                        {/* Expiry */}
                        <td className="py-2.5 px-2">
                          <input
                            type="date"
                            value={line.expiry_date}
                            onChange={(e) => handleUpdateLineField(line.id, 'expiry_date', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/75 rounded-b-2xl">
              <div>
                <p className="text-xs font-bold text-slate-700">
                  {unassignedCompanyCount > 0 ? (
                    <span className="text-rose-600 font-extrabold">⚠️ Warning: {unassignedCompanyCount} item(s) are missing Company selection.</span>
                  ) : (
                    <span className="text-emerald-700 font-extrabold">✓ All {linesCount} items have valid companies and details ready to create.</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAutomatedEditorModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAutomatedEdits}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Save &amp; Create All Master Products with My Edits</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: SINGLE ITEM DETAILED MANUAL EDITOR
          ======================================================== */}
      {resolutionMode === 'EDIT_SINGLE' && resolvingLineId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Manual Item Information Editor</h3>
                  <p className="text-xs text-slate-500 font-medium">Edit every field of this item before adding to catalog</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setResolvingLineId(null);
                  setResolutionMode(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">Master Product Name</label>
                <input
                  type="text"
                  value={formProductName}
                  onChange={(e) => setFormProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-indigo-500 outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">
                    Company / Manufacturer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCompanyId}
                    onChange={(e) => setFormCompanyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                  >
                    <option value="">-- Choose Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Pack Size</label>
                  <input
                    type="text"
                    value={formPacking}
                    onChange={(e) => setFormPacking(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-indigo-500 outline-none text-xs"
                    placeholder="e.g. 24 units/carton"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">HSN Code</label>
                  <input
                    type="text"
                    value={formHsn}
                    onChange={(e) => setFormHsn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-indigo-500 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">GST Slab</label>
                  <select
                    value={formGstRate}
                    onChange={(e) => setFormGstRate(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">MRP (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={formMrp || ''}
                    onChange={(e) => setFormMrp(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-emerald-800 bg-white focus:border-indigo-500 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Purchase Rate / Pc (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={formRate || ''}
                    onChange={(e) => setFormRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Wholesale Rate / Pc (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={formSellingPrice || ''}
                    onChange={(e) => setFormSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-black text-emerald-950 bg-white focus:border-emerald-600 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Batch Number</label>
                  <input
                    type="text"
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white focus:border-indigo-500 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Billed Quantity (Pcs)</label>
                  <input
                    type="number"
                    min="0"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">Free Quantity (Pcs)</label>
                  <input
                    type="number"
                    min="0"
                    value={formFreeQuantity}
                    onChange={(e) => setFormFreeQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:border-indigo-500 outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setResolvingLineId(null);
                  setResolutionMode(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSingleItemEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Resolution Dialog Forms (Search, Fuzzy Review, Variant) */}
      {resolvingLineId && resolutionMode !== 'EDIT_SINGLE' && (() => {
        const line = verificationData?.lines.find(l => l.id === resolvingLineId);
        if (!line) return null;
        
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in no-print overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-850 uppercase tracking-wide">
                    {resolutionMode === 'SEARCH' && 'Search & Link Product'}
                    {resolutionMode === 'NEW_VARIANT' && 'Create New Variant'}
                    {resolutionMode === 'NEW_PRODUCT' && 'Create New Product'}
                    {resolutionMode === 'REVIEW_FUZZY' && 'Review Product Match'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Invoice Product: "{line.extracted_name}"</p>
                </div>
                <button 
                  onClick={() => {
                    setResolvingLineId(null);
                    setResolutionMode(null);
                  }}
                  className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
                {resolutionMode === 'REVIEW_FUZZY' && (() => {
                  const suggestedProduct = products.find(p => p.id === line.suggested_product_id);
                  if (!suggestedProduct) return <p className="text-slate-400">Loading suggestion details...</p>;
                  
                  const invWeight = extractWeightOrVolume(line.extracted_name);
                  const dbWeight = extractWeightOrVolume(suggestedProduct.name);
                  const dbCompany = companies.find(c => c.id === suggestedProduct.company_id)?.name || suggestedProduct.brand || '';
                  
                  const isWeightMismatch = invWeight && dbWeight && (invWeight.value !== dbWeight.value || invWeight.unit !== dbWeight.unit);
                  
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 border border-slate-150 rounded-xl p-4 bg-slate-50/50">
                        <div className="space-y-2 border-r border-slate-200/80 pr-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice Item</span>
                          <p className="font-extrabold text-slate-800 text-xs leading-snug">{line.extracted_name}</p>
                          <div className="space-y-1 mt-2 text-xs text-slate-500 font-medium">
                            <p><span className="font-bold text-slate-600">Weight:</span> {invWeight?.raw || '—'}</p>
                            <p><span className="font-bold text-slate-600">Pack Size:</span> {line.pack_size || '—'}</p>
                          </div>
                        </div>
                        <div className="space-y-2 pl-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suggested Product</span>
                          <p className="font-extrabold text-slate-800 text-xs leading-snug">{suggestedProduct.name}</p>
                          <div className="space-y-1 mt-2 text-xs text-slate-500 font-medium">
                            <p><span className="font-bold text-slate-600">Weight:</span> {dbWeight?.raw || '—'}</p>
                            <p><span className="font-bold text-slate-600">Company:</span> {dbCompany}</p>
                          </div>
                        </div>
                      </div>

                      {isWeightMismatch ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                          <AlertTriangle className="w-5.5 h-5.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-xs uppercase tracking-wider">⚠️ Variant Difference Detected</p>
                            <p className="text-xs text-amber-800 font-medium mt-1 leading-snug">
                              Invoice variant is <span className="font-bold">{invWeight?.raw}</span>, but the database suggested match is <span className="font-bold">{dbWeight?.raw}</span>.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-950 flex items-start gap-2.5">
                          <HelpCircle className="w-5.5 h-5.5 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-xs uppercase tracking-wider">Verification Required</p>
                            <p className="text-xs text-indigo-900 font-medium mt-1 leading-snug">
                              Fuzzy matching suggests a similar product. Please review closely to ensure correct variant mapping.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => openCreateVariantModal(line.id, suggestedProduct.id)}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition-colors cursor-pointer text-xs uppercase tracking-wider"
                        >
                          <PlusCircle className="w-4 h-4" />
                          Create New Variant ({invWeight?.raw || 'New Suffix'})
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Other Actions</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openSearchModal(line.id, line.extracted_name)}
                            className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl cursor-pointer text-xs transition-colors"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Search Variant
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              handleResolveLine(line.id, suggestedProduct.id, 'USE_EXISTING');
                            }}
                            className="flex items-center justify-center gap-1.5 bg-amber-50/50 hover:bg-amber-50 border border-amber-200/80 text-amber-800 font-bold py-2.5 px-3 rounded-xl cursor-pointer text-xs transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Use Existing {dbWeight?.raw || ''}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {resolutionMode === 'SEARCH' && (
                  <div className="space-y-4">
                    <SmartSearchBar
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search by name, company, SKU, barcode..."
                      entityFilter={['product']}
                      size="sm"
                    />

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {searchResults.length === 0 ? (
                        <p className="text-center py-8 text-slate-400 font-medium">
                          {searchQuery === '' ? 'Type search query to search database products.' : 'No matching products found.'}
                        </p>
                      ) : (
                        searchResults.map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => handleResolveLine(line.id, p.id, 'SEARCH_MANUAL')}
                            className="p-3 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/20 cursor-pointer flex justify-between items-center transition-all"
                          >
                            <div>
                              <span className="font-bold text-slate-800 block text-xs">{p.name}</span>
                              <span className="text-xs text-slate-500 block mt-0.5 font-medium">
                                Company: {companies.find(c => c.id === p.company_id)?.name || 'General'} &bull; Packing: {p.pack_size}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 hover:underline">Link &bull; Select</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {resolutionMode === 'NEW_PRODUCT' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Product Name Base</label>
                      <input
                        type="text"
                        value={formProductName}
                        onChange={(e) => setFormProductName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-550 outline-none"
                        placeholder="e.g. New Product XYZ"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                          Company / Brand <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formCompanyId}
                          onChange={(e) => setFormCompanyId(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold bg-white focus:border-indigo-550 outline-none"
                        >
                          <option value="">-- Choose Company --</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Packing Details</label>
                        <input
                          type="text"
                          value={formPacking}
                          onChange={(e) => setFormPacking(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-550 outline-none"
                          placeholder="e.g. 24 units/carton"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">HSN Code</label>
                        <input
                          type="text"
                          value={formHsn}
                          onChange={(e) => setFormHsn(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-550 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">GST Rate (%)</label>
                        <input
                          type="number"
                          value={formGstRate}
                          onChange={(e) => setFormGstRate(parseInt(e.target.value) || 18)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold focus:border-indigo-550 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingLineId(null);
                          setResolutionMode(null);
                        }}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-slate-500 font-bold hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!formProductName || !formCompanyId) {
                            alert('Please fill out Product Name and select a Company.');
                            return;
                          }
                          const comp = companies.find(c => c.id === formCompanyId);
                          const newProd = createProduct(
                            formProductName,
                            comp?.name || 'General',
                            formPacking || '1 Pc',
                            formHsn || line.hsn,
                            formGstRate || line.gst_percent,
                            formMrp || line.mrp,
                            formRate || line.purchase_rate
                          );
                          handleResolveLine(line.id, newProd.id, 'CREATE_NEW');
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-colors cursor-pointer text-xs"
                      >
                        Create Product &amp; Add to Purchase
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL: COMPANY APPROVAL & CREATION PROMPT (Rule 1 & Rule 2)
          ======================================================== */}
      {showCompanyApprovalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl border border-amber-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {detectedUnmappedCompany ? `Detected New Company: "${detectedUnmappedCompany}"` : 'Manage Companies'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Please create this company or map it to an existing company.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyApprovalModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              We never automatically create companies in your database without your permission. Please choose an option below:
            </p>

            <div className="space-y-3.5 text-xs">
              {/* Option 1: Create New Company */}
              <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2.5">
                <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <span>Choice 1: Create New Company</span>
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newCompanyNameInput}
                    onChange={(e) => setNewCompanyNameInput(e.target.value)}
                    placeholder="Company Name (e.g. RIYA)"
                    className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 bg-white outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={newCompanyCodeInput}
                    onChange={(e) => setNewCompanyCodeInput(e.target.value.toUpperCase())}
                    placeholder="Code"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 bg-white outline-none focus:border-indigo-500 uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newCompanyNameInput.trim()) {
                      alert('Please enter a company name.');
                      return;
                    }
                    const created = createCompany(newCompanyNameInput.trim(), newCompanyCodeInput.trim() || undefined);
                    setMappedCompanyId(created.id);
                    setBulkToolbarCompanyId(created.id);
                    if (verificationData) {
                      handleApplyCompanyToAll(created.id, true);
                    }
                    setDetectedUnmappedCompany('');
                    setShowCompanyApprovalModal(false);
                    alert(`Company "${created.name}" created and assigned!`);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create Company &ldquo;{newCompanyNameInput || detectedUnmappedCompany || 'New'}&rdquo;</span>
                </button>
              </div>

              {/* Option 2: Map to Existing Company */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-800">Choice 2: Map to Existing Company</h4>
                <select
                  value={existingCompanySelection}
                  onChange={(e) => setExistingCompanySelection(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Existing Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!existingCompanySelection) {
                      alert('Please select an existing company from the dropdown.');
                      return;
                    }
                    setMappedCompanyId(existingCompanySelection);
                    setBulkToolbarCompanyId(existingCompanySelection);
                    if (verificationData) {
                      handleApplyCompanyToAll(existingCompanySelection, true);
                    }
                    setDetectedUnmappedCompany('');
                    setShowCompanyApprovalModal(false);
                    const comp = companies.find(c => c.id === existingCompanySelection);
                    alert(`Mapped invoice items to "${comp?.name || 'existing company'}".`);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Map to Selected Company
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCompanyApprovalModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
              >
                Decide Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Supplier Creation Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Add Supplier Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Create a new supplier profile for this purchase invoice</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  Supplier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={supplierFormName}
                  onChange={(e) => setSupplierFormName(e.target.value)}
                  placeholder="e.g. Parle Agro Pvt Ltd"
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs font-bold text-slate-800 focus:border-indigo-600 outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">GSTIN</label>
                <input
                  type="text"
                  maxLength={15}
                  value={supplierFormGstin}
                  onChange={(e) => setSupplierFormGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 24AAAAA0000A1Z5"
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono font-bold text-slate-800 uppercase focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">Address / Contact</label>
                <textarea
                  rows={2}
                  value={supplierFormAddress}
                  onChange={(e) => setSupplierFormAddress(e.target.value)}
                  placeholder="e.g. Ring Road, Surat, Gujarat"
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-800 focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raw Extracted Data Modal */}
      {viewingRawData && verificationData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-800">Raw Extracted Invoice JSON</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRawData(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs">
              <pre>{JSON.stringify(verificationData, null, 2)}</pre>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingRawData(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
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
