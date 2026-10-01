/**
 * Vyapar Product Data Import Engine
 * Saifee General Stores FMCG Distribution Management System
 * 
 * Handles client-side XLSX, XLS, and CSV parsing, intelligent column auto-detection,
 * multi-criteria product duplicate matching, fuzzy similarity analysis, row validation,
 * error report export, and template generation.
 */

import * as XLSX from 'xlsx';
import { Product, Company, BaseUnit } from './db';

// ----------------------------------------------------
// TARGET PRODUCT MASTER FIELD DEFINITIONS
// ----------------------------------------------------

export interface TargetFieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date';
  description: string;
  sample: string;
  autoDetectKeywords: string[];
}

export const TARGET_PRODUCT_FIELDS: TargetFieldDef[] = [
  {
    key: 'name',
    label: 'Product Name',
    required: true,
    type: 'string',
    description: 'Full commercial item name (e.g. Parle-G 100g, Fortune Sunlite 1L)',
    sample: 'Aashirvaad Superior MP Atta 5kg',
    autoDetectKeywords: ['item name', 'product name', 'item description', 'name', 'item', 'product', 'item title', 'particulars']
  },
  {
    key: 'company_name',
    label: 'Company / Manufacturer',
    required: false,
    type: 'string',
    description: 'Manufacturing company (e.g. ITC, Parle, Adani Wilmar, Tata Consumer)',
    sample: 'ITC Limited',
    autoDetectKeywords: ['company', 'manufacturer', 'mfr', 'mfg company', 'brand/company', 'company name', 'vendor']
  },
  {
    key: 'brand',
    label: 'Brand',
    required: false,
    type: 'string',
    description: 'Brand or product line (e.g. Aashirvaad, Sunfeast, Fortune)',
    sample: 'Aashirvaad',
    autoDetectKeywords: ['brand', 'brand name', 'sub brand', 'brandline']
  },
  {
    key: 'sku',
    label: 'SKU / Item Code',
    required: false,
    type: 'string',
    description: 'Unique internal item code or Vyapar item code',
    sample: 'SKU-AASH-5KG',
    autoDetectKeywords: ['item code', 'sku', 'item no', 'code', 'item id', 'product code', 'item code (sku)', 'item_code']
  },
  {
    key: 'barcode',
    label: 'Barcode / EAN / UPC',
    required: false,
    type: 'string',
    description: 'Scannable UPC / EAN-13 barcode number',
    sample: '8901030894567',
    autoDetectKeywords: ['barcode', 'upc', 'ean', 'bar code', 'ean code', 'upc code', 'scan code']
  },
  {
    key: 'category',
    label: 'Product Category',
    required: false,
    type: 'string',
    description: 'Product category or group (e.g. Atta & Flours, Biscuits & Cookies, Edible Oils)',
    sample: 'Atta & Flours',
    autoDetectKeywords: ['category', 'item category', 'item group', 'group', 'category name', 'dept', 'department']
  },
  {
    key: 'pack_size',
    label: 'Pack Size / Variant',
    required: false,
    type: 'string',
    description: 'Packaging specification (e.g. 5kg, 100g, 1L, 4 units/carton)',
    sample: '4 units/carton (5kg)',
    autoDetectKeywords: ['pack size', 'packing', 'packaging', 'pack', 'size', 'variant', 'weight', 'volume', 'pack_size']
  },
  {
    key: 'trading_unit',
    label: 'Trading Unit',
    required: false,
    type: 'string',
    description: 'Wholesale trading unit: Carton, Box, Case, Bag, Bundle, Dozen, Jar',
    sample: 'Carton',
    autoDetectKeywords: ['trading unit', 'unit', 'item unit', 'primary unit', 'box/carton', 'uom', 'sale unit']
  },
  {
    key: 'base_unit',
    label: 'Base / Loose Unit',
    required: false,
    type: 'string',
    description: 'Single retail consumer unit: Packet, Piece, Bottle, Pouch, Strip, Kg, Liter',
    sample: 'Packet',
    autoDetectKeywords: ['base unit', 'secondary unit', 'loose unit', 'pcs/unit', 'sub unit', 'retail unit']
  },
  {
    key: 'units_per_box_carton',
    label: 'Units per Carton / Box',
    required: false,
    type: 'number',
    description: 'Number of base consumer units in one trading carton',
    sample: '4',
    autoDetectKeywords: ['units/case', 'units per box', 'units per carton', 'conversion', 'pack quantity', 'units/box', 'units/carton', 'conversion rate', 'pcs per box', 'items/carton']
  },
  {
    key: 'mrp',
    label: 'MRP (Maximum Retail Price)',
    required: true,
    type: 'number',
    description: 'Maximum printed retail price per trading unit or package',
    sample: '1280.00',
    autoDetectKeywords: ['mrp', 'max retail price', 'm.r.p.', 'retail price', 'printed mrp', 'mrp (₹)']
  },
  {
    key: 'purchase_price',
    label: 'Purchase Rate (Cost Price)',
    required: true,
    type: 'number',
    description: 'Distributor purchase cost rate (excl. or incl. GST based on bill)',
    sample: '1050.00',
    autoDetectKeywords: ['purchase price', 'purchase rate', 'cost price', 'cost rate', 'buy price', 'buying rate', 'cost', 'purchase_rate']
  },
  {
    key: 'selling_price',
    label: 'Selling Price (Wholesale Rate)',
    required: true,
    type: 'number',
    description: 'Distributor selling price to retailers',
    sample: '1150.00',
    autoDetectKeywords: ['sale price', 'selling price', 'selling rate', 'sales price', 'distributor price', 'wholesale price', 'sales rate', 'rate']
  },
  {
    key: 'gst_percent',
    label: 'GST Rate %',
    required: false,
    type: 'number',
    description: 'Statutory GST percentage: 0, 5, 12, 18, or 28',
    sample: '5',
    autoDetectKeywords: ['tax rate', 'gst', 'gst %', 'tax %', 'gst rate', 'tax percentage', 'igst', 'vat', 'tax']
  },
  {
    key: 'hsn',
    label: 'HSN Code',
    required: false,
    type: 'string',
    description: '6 to 8-digit GST Harmonized System of Nomenclature code',
    sample: '11010000',
    autoDetectKeywords: ['hsn', 'hsn code', 'hsn/sac', 'sac code', 'hsn_code', 'commodity code']
  },
  {
    key: 'stock_qty',
    label: 'Opening / Current Stock',
    required: false,
    type: 'number',
    description: 'Initial stock quantity to inward into warehouse (in trading units)',
    sample: '25',
    autoDetectKeywords: ['opening stock', 'current stock', 'stock qty', 'quantity', 'stock', 'available stock', 'opening qty', 'qty in stock', 'opening_stock']
  },
  {
    key: 'batch_number',
    label: 'Batch Number',
    required: false,
    type: 'string',
    description: 'Manufacturer batch or lot number for opening stock',
    sample: 'BATCH-2026-A1',
    autoDetectKeywords: ['batch', 'batch no', 'batch number', 'lot no', 'lot number', 'batch_no']
  },
  {
    key: 'expiry_date',
    label: 'Expiry Date',
    required: false,
    type: 'date',
    description: 'Expiry date for the opening stock batch (YYYY-MM-DD or DD/MM/YYYY)',
    sample: '2027-12-31',
    autoDetectKeywords: ['expiry date', 'expiry', 'exp date', 'exp', 'expiration date', 'valid till', 'best before', 'expiry_date']
  },
  {
    key: 'supplier_name',
    label: 'Supplier / Vendor',
    required: false,
    type: 'string',
    description: 'Name of supplier / primary source for this item',
    sample: 'ITC Wholesale Distribution Depot',
    autoDetectKeywords: ['supplier', 'supplier name', 'vendor', 'party', 'distributor', 'source supplier']
  },
  {
    key: 'description',
    label: 'Item Description / Notes',
    required: false,
    type: 'string',
    description: 'Additional product notes or distributor remarks',
    sample: 'Packaged food staple. Handle with care.',
    autoDetectKeywords: ['description', 'remarks', 'item notes', 'notes', 'specifications', 'details']
  },
  {
    key: 'image_url',
    label: 'Product Image URL',
    required: false,
    type: 'string',
    description: 'Direct HTTPS URL link to product packaging photograph',
    sample: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
    autoDetectKeywords: ['image', 'image url', 'product image', 'photo', 'picture', 'img url']
  }
];

// ----------------------------------------------------
// PROCESSED ROW INTERFACE
// ----------------------------------------------------

export interface ProcessedImportRow {
  rowNumber: number;
  rawValues: Record<string, any>;
  normalizedData: {
    name: string;
    company_name?: string;
    brand?: string;
    category?: string;
    sku?: string;
    barcode?: string;
    pack_size?: string;
    trading_unit?: string;
    base_unit?: BaseUnit;
    units_per_box_carton?: number;
    mrp: number;
    purchase_price: number;
    selling_price: number;
    gst_percent?: number;
    hsn?: string;
    description?: string;
    stock_qty?: number;
    stock_qty_is_base?: boolean;
    batch_number?: string;
    expiry_date?: string;
    supplier_name?: string;
    image_url?: string;
  };
  isValid: boolean;
  errors: string[];
  warnings: string[];
  matchType: 'NEW' | 'EXACT_MATCH' | 'FUZZY_MATCH' | 'INVALID';
  matchedProduct?: Product;
  matchCriteria?: string;
  matchDifferences?: string[];
  matchSimilarityScore?: number;
  action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'SKIP';
}

// ----------------------------------------------------
// 1. FILE PARSER
// ----------------------------------------------------

/**
 * Parses uploaded Excel (.xlsx, .xls) or CSV file into structured headers and raw rows.
 */
export async function parseUploadedVyaparFile(file: File): Promise<{
  sheetNames: string[];
  activeSheet: string;
  rawHeaders: string[];
  rawRows: Record<string, any>[];
  fileSize: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: true
  });

  const sheetNames = workbook.SheetNames;
  const activeSheet = sheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[activeSheet];

  if (!worksheet) {
    throw new Error('No valid worksheet found in the uploaded workbook.');
  }

  // Convert to JSON with headers
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false
  }) as any[][];

  if (jsonData.length === 0) {
    throw new Error('The uploaded sheet is completely empty.');
  }

  // Find the header row (first non-empty row)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i];
    const nonBlankCount = row.filter(cell => String(cell || '').trim().length > 0).length;
    if (nonBlankCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders: string[] = (jsonData[headerRowIndex] || []).map((h: any, idx: number) => {
    const str = String(h || '').trim();
    return str.length > 0 ? str : `Column_${idx + 1}`;
  });

  const dataRows = jsonData.slice(headerRowIndex + 1);
  const rawRows: Record<string, any>[] = [];

  dataRows.forEach((row) => {
    // Check if entire row is empty
    const hasData = row.some(cell => String(cell || '').trim().length > 0);
    if (!hasData) return;

    const rowObj: Record<string, any> = {};
    rawHeaders.forEach((header, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      } else if (typeof val === 'string') {
        val = val.trim();
      }
      rowObj[header] = val !== undefined ? val : '';
    });
    rawRows.push(rowObj);
  });

  return {
    sheetNames,
    activeSheet,
    rawHeaders,
    rawRows,
    fileSize: file.size
  };
}

// ----------------------------------------------------
// 2. INTELLIGENT COLUMN AUTO-DETECTION
// ----------------------------------------------------

/**
 * Heuristically auto-detects column mapping between Vyapar headers and Product Master fields.
 */
export function autoDetectVyaparColumnMapping(rawHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  TARGET_PRODUCT_FIELDS.forEach(targetField => {
    let bestMatchHeader = '';
    let highestScore = 0;

    rawHeaders.forEach(header => {
      if (usedHeaders.has(header)) return;
      const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

      targetField.autoDetectKeywords.forEach(keyword => {
        const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        
        // Exact match
        if (cleanHeader === cleanKeyword) {
          if (highestScore < 100) {
            highestScore = 100;
            bestMatchHeader = header;
          }
        }
        // Header contains keyword
        else if (cleanHeader.includes(cleanKeyword) && cleanKeyword.length > 3) {
          const score = 80 + (cleanKeyword.length / cleanHeader.length) * 10;
          if (score > highestScore) {
            highestScore = score;
            bestMatchHeader = header;
          }
        }
        // Keyword contains header
        else if (cleanKeyword.includes(cleanHeader) && cleanHeader.length > 3) {
          const score = 70 + (cleanHeader.length / cleanKeyword.length) * 10;
          if (score > highestScore) {
            highestScore = score;
            bestMatchHeader = header;
          }
        }
      });
    });

    if (bestMatchHeader && highestScore >= 70) {
      mapping[targetField.key] = bestMatchHeader;
      usedHeaders.add(bestMatchHeader);
    }
  });

  return mapping;
}

// ----------------------------------------------------
// 3. FUZZY STRING SIMILARITY HELPER
// ----------------------------------------------------

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Computes token-based and character-based similarity between two product names (0 to 1).
 */
export function calculateProductSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeString(nameA);
  const normB = normalizeString(nameB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));

  const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);
  const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;

  // Substring containment boost
  let containmentBonus = 0;
  if (normA.includes(normB) || normB.includes(normA)) {
    containmentBonus = 0.25;
  }

  return Math.min(1.0, jaccardScore * 0.75 + containmentBonus);
}

// ----------------------------------------------------
// 4. ROW VALIDATOR & MATCHING ENGINE
// ----------------------------------------------------

/**
 * Validates, normalizes, and compares uploaded rows against existing product catalog.
 */
export function validateAndMatchVyaparRows(
  rawRows: Record<string, any>[],
  columnMapping: Record<string, string>,
  existingProducts: Product[],
  companies: Company[]
): ProcessedImportRow[] {
  const processedRows: ProcessedImportRow[] = [];

  // Lookup indexes for fast matching
  const skuMap = new Map<string, Product>();
  const barcodeMap = new Map<string, Product>();
  const exactNameMap = new Map<string, Product>();

  existingProducts.forEach(p => {
    if (p.sku) skuMap.set(normalizeString(p.sku), p);
    if (p.barcode) barcodeMap.set(normalizeString(p.barcode), p);
    if (p.name) exactNameMap.set(normalizeString(p.name), p);
  });

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // 1-indexed including header row
    const errors: string[] = [];
    const warnings: string[] = [];

    // Helper to extract value by target field key
    const getVal = (targetKey: string): string => {
      const header = columnMapping[targetKey];
      if (!header || raw[header] === undefined || raw[header] === null) return '';
      return String(raw[header]).trim();
    };

    const rawName = getVal('name');
    const rawCompany = getVal('company_name');
    const rawBrand = getVal('brand');
    const rawCategory = getVal('category');
    const rawSku = getVal('sku');
    const rawBarcode = getVal('barcode');
    const rawPackSize = getVal('pack_size');
    const rawTradingUnit = getVal('trading_unit') || 'Carton';
    const rawBaseUnit = (getVal('base_unit') || 'Packet') as BaseUnit;
    const rawUnitsPerPackStr = getVal('units_per_box_carton');
    const rawMrpStr = getVal('mrp');
    const rawPurchaseStr = getVal('purchase_price');
    const rawSellingStr = getVal('selling_price');
    const rawGstStr = getVal('gst_percent');
    const rawHsn = getVal('hsn');
    const rawDesc = getVal('description');
    const rawStockStr = getVal('stock_qty');
    const rawBatch = getVal('batch_number');
    const rawExpiry = getVal('expiry_date');
    const rawSupplier = getVal('supplier_name');
    const rawImageUrl = getVal('image_url');

    // 1. Mandatory Validations
    if (!rawName) {
      errors.push('Product Name is missing.');
    }

    const mrp = parseFloat(rawMrpStr.replace(/[^0-9.]/g, ''));
    if (isNaN(mrp) || mrp <= 0) {
      errors.push(`Invalid or missing MRP: "${rawMrpStr}"`);
    }

    const purchasePrice = parseFloat(rawPurchaseStr.replace(/[^0-9.]/g, ''));
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      errors.push(`Invalid or missing Purchase Price: "${rawPurchaseStr}"`);
    }

    const sellingPrice = parseFloat(rawSellingStr.replace(/[^0-9.]/g, ''));
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      errors.push(`Invalid or missing Selling Price: "${rawSellingStr}"`);
    }

    // Units per box/carton
    let unitsPerPack = parseInt(rawUnitsPerPackStr.replace(/[^0-9]/g, ''), 10);
    if (isNaN(unitsPerPack) || unitsPerPack <= 0) {
      const matchNumber = rawPackSize.match(/\d+/);
      unitsPerPack = matchNumber ? parseInt(matchNumber[0], 10) : 1;
    }
    if (unitsPerPack <= 0) unitsPerPack = 1;

    // GST %
    let gstPercent = parseFloat(rawGstStr.replace(/[^0-9.]/g, ''));
    if (isNaN(gstPercent)) {
      gstPercent = 18; // default standard FMCG GST
    } else {
      const standardRates = [0, 5, 12, 18, 28];
      if (!standardRates.includes(gstPercent)) {
        // Map to nearest standard rate
        const closest = standardRates.reduce((prev, curr) => 
          Math.abs(curr - gstPercent) < Math.abs(prev - gstPercent) ? curr : prev
        );
        warnings.push(`Non-standard GST rate (${gstPercent}%). Adjusted to closest statutory slab (${closest}%).`);
        gstPercent = closest;
      }
    }

    // Stock Quantity
    const stockQty = parseFloat(rawStockStr.replace(/[^0-9.]/g, ''));
    const safeStockQty = !isNaN(stockQty) && stockQty > 0 ? stockQty : 0;

    // Normalised Expiry Date
    let cleanExpiry = rawExpiry;
    if (cleanExpiry) {
      // Check if format is DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = cleanExpiry.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmyMatch) {
        cleanExpiry = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
      const testDate = new Date(cleanExpiry);
      if (isNaN(testDate.getTime())) {
        warnings.push(`Invalid Expiry Date "${rawExpiry}". Defaulted to 2027-12-31.`);
        cleanExpiry = '2027-12-31';
      }
    }

    // Commercial logic checks
    if (!isNaN(mrp) && !isNaN(sellingPrice) && sellingPrice > mrp) {
      warnings.push(`Selling Price (₹${sellingPrice}) is higher than MRP (₹${mrp}).`);
    }
    if (!isNaN(purchasePrice) && !isNaN(sellingPrice) && purchasePrice > sellingPrice) {
      warnings.push(`Purchase Price (₹${purchasePrice}) exceeds Selling Price (₹${sellingPrice}). Negative margin!`);
    }

    const isValid = errors.length === 0;

    // 2. Product Matching Logic
    let matchedProduct: Product | undefined;
    let matchType: 'NEW' | 'EXACT_MATCH' | 'FUZZY_MATCH' | 'INVALID' = isValid ? 'NEW' : 'INVALID';
    let matchCriteria: string | undefined;
    const matchDifferences: string[] = [];
    let similarityScore: number | undefined;

    if (isValid) {
      const normSku = normalizeString(rawSku);
      const normBarcode = normalizeString(rawBarcode);
      const normName = normalizeString(rawName);

      // Match 1: SKU
      if (normSku && skuMap.has(normSku)) {
        matchedProduct = skuMap.get(normSku);
        matchType = 'EXACT_MATCH';
        matchCriteria = `Exact SKU Match (${matchedProduct?.sku})`;
      }
      // Match 2: Barcode
      else if (normBarcode && barcodeMap.has(normBarcode)) {
        matchedProduct = barcodeMap.get(normBarcode);
        matchType = 'EXACT_MATCH';
        matchCriteria = `Exact Barcode Match (${matchedProduct?.barcode})`;
      }
      // Match 3: Exact Product Name
      else if (normName && exactNameMap.has(normName)) {
        matchedProduct = exactNameMap.get(normName);
        matchType = 'EXACT_MATCH';
        matchCriteria = `Exact Name Match ("${matchedProduct?.name}")`;
      }
      // Match 4: Company + Pack size
      else if (rawCompany && rawPackSize) {
        const comp = companies.find(c => c.name.toLowerCase() === rawCompany.toLowerCase());
        if (comp) {
          const matchedByCompPack = existingProducts.find(
            p => p.company_id === comp.id && normalizeString(p.pack_size) === normalizeString(rawPackSize) && normalizeString(p.name).includes(normalizeString(rawName.split(' ')[0] || ''))
          );
          if (matchedByCompPack) {
            matchedProduct = matchedByCompPack;
            matchType = 'EXACT_MATCH';
            matchCriteria = `Exact Company & Pack Size Match (${comp.name} - ${matchedByCompPack.pack_size})`;
          }
        }
      }

      // Match 5: Fuzzy Similarity Match (if no exact match found)
      if (!matchedProduct && rawName) {
        let highestSim = 0;
        let candidate: Product | undefined;

        for (const existing of existingProducts) {
          const sim = calculateProductSimilarity(rawName, existing.name);
          if (sim > highestSim) {
            highestSim = sim;
            candidate = existing;
          }
        }

        if (candidate && highestSim >= 0.70) {
          matchedProduct = candidate;
          matchType = 'FUZZY_MATCH';
          similarityScore = Math.round(highestSim * 100);
          matchCriteria = `Fuzzy Name Match (${similarityScore}% similar to "${candidate.name}")`;
        }
      }

      // Compute field differences if a match was found
      if (matchedProduct) {
        if (matchedProduct.mrp !== mrp) {
          matchDifferences.push(`MRP: ₹${matchedProduct.mrp} (Existing) vs ₹${mrp} (Vyapar)`);
        }
        if (matchedProduct.selling_price !== sellingPrice) {
          matchDifferences.push(`Selling Price: ₹${matchedProduct.selling_price} (Existing) vs ₹${sellingPrice} (Vyapar)`);
        }
        if (matchedProduct.purchase_price !== purchasePrice) {
          matchDifferences.push(`Purchase Price: ₹${matchedProduct.purchase_price} (Existing) vs ₹${purchasePrice} (Vyapar)`);
        }
        if (matchedProduct.gst_percent !== gstPercent) {
          matchDifferences.push(`GST: ${matchedProduct.gst_percent}% (Existing) vs ${gstPercent}% (Vyapar)`);
        }
        if (matchedProduct.pack_size !== rawPackSize && rawPackSize) {
          matchDifferences.push(`Packing: "${matchedProduct.pack_size}" (Existing) vs "${rawPackSize}" (Vyapar)`);
        }
      }
    }

    // Default action assignment
    let defaultAction: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'SKIP' = 'CREATE_NEW';
    if (!isValid) {
      defaultAction = 'SKIP';
    } else if (matchType === 'EXACT_MATCH') {
      defaultAction = 'UPDATE_EXISTING';
    } else if (matchType === 'FUZZY_MATCH') {
      defaultAction = 'SKIP'; // require explicit review
    }

    processedRows.push({
      rowNumber: rowNum,
      rawValues: raw,
      normalizedData: {
        name: rawName,
        company_name: rawCompany,
        brand: rawBrand,
        category: rawCategory,
        sku: rawSku,
        barcode: rawBarcode,
        pack_size: rawPackSize || `${unitsPerPack} units/${rawTradingUnit}`,
        trading_unit: rawTradingUnit,
        base_unit: rawBaseUnit,
        units_per_box_carton: unitsPerPack,
        mrp: isNaN(mrp) ? 0 : mrp,
        purchase_price: isNaN(purchasePrice) ? 0 : purchasePrice,
        selling_price: isNaN(sellingPrice) ? 0 : sellingPrice,
        gst_percent: gstPercent,
        hsn: rawHsn,
        description: rawDesc,
        stock_qty: safeStockQty,
        stock_qty_is_base: false,
        batch_number: rawBatch,
        expiry_date: cleanExpiry,
        supplier_name: rawSupplier,
        image_url: rawImageUrl
      },
      isValid,
      errors,
      warnings,
      matchType,
      matchedProduct,
      matchCriteria,
      matchDifferences,
      matchSimilarityScore: similarityScore,
      action: defaultAction
    });
  });

  return processedRows;
}

// ----------------------------------------------------
// 5. ERROR REPORT EXPORTER
// ----------------------------------------------------

/**
 * Generates downloadable CSV string of validation errors and rejected rows.
 */
export function generateVyaparErrorReportCsv(processedRows: ProcessedImportRow[]): string {
  const invalidRows = processedRows.filter(r => !r.isValid || r.errors.length > 0 || r.warnings.length > 0);
  
  const headers = ['Row #', 'Product Name', 'SKU', 'Status', 'Errors', 'Warnings', 'Raw Values'];
  const csvLines: string[] = [headers.map(h => `"${h}"`).join(',')];

  invalidRows.forEach(row => {
    const rawSummary = Object.entries(row.rawValues)
      .map(([k, v]) => `${k}: ${v}`)
      .slice(0, 5)
      .join(' | ');

    const line = [
      row.rowNumber,
      `"${(row.normalizedData.name || 'Unnamed').replace(/"/g, '""')}"`,
      `"${(row.normalizedData.sku || 'N/A').replace(/"/g, '""')}"`,
      `"${row.isValid ? 'Valid with Warnings' : 'Invalid / Rejected'}"`,
      `"${row.errors.join('; ').replace(/"/g, '""')}"`,
      `"${row.warnings.join('; ').replace(/"/g, '""')}"`,
      `"${rawSummary.replace(/"/g, '""')}"`
    ];
    csvLines.push(line.join(','));
  });

  return csvLines.join('\n');
}

// ----------------------------------------------------
// 6. SAMPLE TEMPLATE BUILDER
// ----------------------------------------------------

/**
 * Creates sample downloadable Vyapar export Excel file (.xlsx) with realistic FMCG items.
 */
export function generateVyaparSampleWorkbook(): Uint8Array {
  const sampleData = [
    {
      'Item Name': 'Aashirvaad Superior MP Atta 5kg',
      'Company Name': 'ITC',
      'Brand': 'Aashirvaad',
      'Item Code': 'AASH-5KG-01',
      'Barcode': '8901030894567',
      'Item Category': 'Atta & Flours',
      'Pack Size': '4 units/carton (5kg)',
      'Trading Unit': 'Carton',
      'Base Unit': 'Packet',
      'Units per Box': 4,
      'MRP': 1280.00,
      'Purchase Price': 1050.00,
      'Sale Price': 1150.00,
      'Tax Rate': 5,
      'HSN Code': '11010000',
      'Opening Stock': 25,
      'Batch No': 'BCH-2026-A1',
      'Expiry Date': '2027-12-31',
      'Supplier Name': 'ITC Wholesale Hub',
      'Description': 'Premium Whole Wheat Atta. Fast moving staple.'
    },
    {
      'Item Name': 'Parle-G Gold Biscuits 1kg Family Pack',
      'Company Name': 'Parle',
      'Brand': 'Parle-G',
      'Item Code': 'PARLE-G-GOLD-1KG',
      'Barcode': '8901719101234',
      'Item Category': 'Biscuits & Cookies',
      'Pack Size': '12 units/box',
      'Trading Unit': 'Box',
      'Base Unit': 'Packet',
      'Units per Box': 12,
      'MRP': 1440.00,
      'Purchase Price': 1150.00,
      'Sale Price': 1260.00,
      'Tax Rate': 18,
      'HSN Code': '19053100',
      'Opening Stock': 40,
      'Batch No': 'PARLE-2026-G1',
      'Expiry Date': '2027-08-31',
      'Supplier Name': 'Parle Products Depot',
      'Description': 'Glucose Biscuits Family Mega Pack.'
    },
    {
      'Item Name': 'Fortune Sunlite Refined Sunflower Oil 1L Pouch',
      'Company Name': 'Adani Wilmar',
      'Brand': 'Fortune',
      'Item Code': 'FORT-SUN-1L',
      'Barcode': '8906007281001',
      'Item Category': 'Edible Oils',
      'Pack Size': '16 pouches/carton',
      'Trading Unit': 'Carton',
      'Base Unit': 'Pouch',
      'Units per Box': 16,
      'MRP': 2400.00,
      'Purchase Price': 1950.00,
      'Sale Price': 2100.00,
      'Tax Rate': 5,
      'HSN Code': '15121910',
      'Opening Stock': 15,
      'Batch No': 'FORT-2026-S1',
      'Expiry Date': '2027-06-30',
      'Supplier Name': 'Adani Wilmar Supply C&F',
      'Description': 'Refined Sunflower Oil Enriched with Vitamins A & D.'
    },
    {
      'Item Name': 'Tata Salt Vacuum Evaporated Iodized 1kg',
      'Company Name': 'Tata Consumer',
      'Brand': 'Tata Salt',
      'Item Code': 'TATA-SALT-1KG',
      'Barcode': '8904043901005',
      'Item Category': 'Spices & Seasonings',
      'Pack Size': '24 packets/bag',
      'Trading Unit': 'Bag',
      'Base Unit': 'Packet',
      'Units per Box': 24,
      'MRP': 720.00,
      'Purchase Price': 540.00,
      'Sale Price': 600.00,
      'Tax Rate': 0,
      'HSN Code': '25010010',
      'Opening Stock': 50,
      'Batch No': 'TATA-2026-T1',
      'Expiry Date': '2028-12-31',
      'Supplier Name': 'Tata Consumer C&F',
      'Description': 'Desh Ka Namak - Vacuum Evaporated Iodized Salt.'
    },
    {
      'Item Name': 'Surf Excel Quick Wash Detergent Powder 1kg',
      'Company Name': 'Hindustan Unilever',
      'Brand': 'Surf Excel',
      'Item Code': 'SURF-QW-1KG',
      'Barcode': '8901030381005',
      'Item Category': 'Household & Cleaning',
      'Pack Size': '18 packets/carton',
      'Trading Unit': 'Carton',
      'Base Unit': 'Packet',
      'Units per Box': 18,
      'MRP': 3960.00,
      'Purchase Price': 3150.00,
      'Sale Price': 3450.00,
      'Tax Rate': 18,
      'HSN Code': '34029011',
      'Opening Stock': 20,
      'Batch No': 'HUL-2026-S1',
      'Expiry Date': '2028-06-30',
      'Supplier Name': 'Hindustan Unilever Depot',
      'Description': 'Premium laundry detergent with X-Tra Clean Particles.'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  
  // Set column widths for readability
  ws['!cols'] = [
    { wch: 35 }, // Item Name
    { wch: 20 }, // Company Name
    { wch: 16 }, // Brand
    { wch: 18 }, // Item Code
    { wch: 16 }, // Barcode
    { wch: 22 }, // Item Category
    { wch: 25 }, // Pack Size
    { wch: 14 }, // Trading Unit
    { wch: 12 }, // Base Unit
    { wch: 14 }, // Units per Box
    { wch: 12 }, // MRP
    { wch: 14 }, // Purchase Price
    { wch: 12 }, // Sale Price
    { wch: 10 }, // Tax Rate
    { wch: 12 }, // HSN Code
    { wch: 14 }, // Opening Stock
    { wch: 16 }, // Batch No
    { wch: 14 }, // Expiry Date
    { wch: 25 }, // Supplier Name
    { wch: 40 }  // Description
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vyapar Products');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}
