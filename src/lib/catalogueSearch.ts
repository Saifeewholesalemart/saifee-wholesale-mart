/**
 * ============================================================================
 * Shared FMCG Catalogue Search & Precomputed Corpus Engine
 * Saifee General Stores FMCG Wholesale Distribution & Trade ERP
 * File: src/lib/catalogueSearch.ts
 * ============================================================================
 *
 * This module is the single source of truth for catalogue search logic used both by
 * the application frontend (src/app/admin/products/page.tsx) and the automated
 * benchmark test suite (migration_prep/test_catalogue_search_benchmark.js).
 */

export interface SearchableProduct {
  id: string;
  name: string;
  product_code?: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  company_id?: string;
  hsn?: string;
  selling_price: number;
  mrp: number;
  active: boolean;
  reorder_level?: number;
  updated_at?: string;
  [key: string]: any;
}

export interface SearchFilterOptions {
  searchTerm?: string;
  companyFilter?: string;
  categoryFilter?: string;
  statusFilter?: 'all' | 'active' | 'inactive';
  stockStatusFilter?: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';
  sortBy?: 'name' | 'stock_desc' | 'stock_asc' | 'price_desc' | 'mrp_desc' | 'updated';
  page?: number;
  pageSize?: number;
  inventoryMap?: Map<string, { available_qty: number; physical_qty?: number }>;
  categoryIdsLookup?: (productId: string) => string[];
}

/**
 * Builds the searchable corpus string for a single product across all 7 searchable fields:
 * product name, product code, SKU, barcode, brand, company name, and HSN.
 */
export function buildProductCorpus(product: SearchableProduct, companyName?: string): string {
  return `${product.name || ''} ${product.product_code || ''} ${product.sku || ''} ${product.barcode || ''} ${product.brand || ''} ${companyName || ''} ${product.hsn || ''}`.toLowerCase();
}

/**
 * Builds an O(1) lookup Map of product ID -> precomputed lowercase search corpus.
 */
export function buildSearchCorpusMap(
  products: SearchableProduct[],
  companyMap: Map<string, { name: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const comp = companyMap.get(p.company_id || '');
    map.set(p.id, buildProductCorpus(p, comp?.name));
  }
  return map;
}

/**
 * Executes high-performance tokenized multi-word search and filtering across the catalogue.
 * Guarantees that all tokens in the query must match across the 7 fields.
 */
export function filterCatalogueProducts<T extends SearchableProduct>(
  products: T[],
  searchCorpusMap: Map<string, string>,
  options: SearchFilterOptions = {}
): T[] {
  const {
    searchTerm = '',
    companyFilter = 'all',
    categoryFilter = 'all',
    statusFilter = 'all',
    stockStatusFilter = 'all',
    sortBy = 'name',
    inventoryMap,
    categoryIdsLookup
  } = options;

  const rawQ = searchTerm.trim().toLowerCase();
  const tokens = rawQ ? rawQ.split(/\s+/).filter(Boolean) : [];
  const hasTokens = tokens.length > 0;

  const result: T[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    // 1. Company Filter
    if (companyFilter !== 'all' && p.company_id !== companyFilter) continue;

    // 2. Category Filter (Optional)
    if (categoryFilter !== 'all' && categoryIdsLookup) {
      const catIds = categoryIdsLookup(p.id);
      if (categoryFilter === 'uncategorized') {
        if (catIds.length > 0) continue;
      } else {
        if (!catIds.includes(categoryFilter)) continue;
      }
    }

    // 3. Status Filter (Active / Inactive)
    if (statusFilter === 'active' && !p.active) continue;
    if (statusFilter === 'inactive' && p.active) continue;

    // 4. Stock Status Filter
    if (stockStatusFilter !== 'all' && inventoryMap) {
      const inv = inventoryMap.get(p.id);
      const avail = inv?.available_qty || 0;
      const reorder = p.reorder_level ?? 10;
      if (stockStatusFilter === 'in_stock' && avail <= 0) continue;
      if (stockStatusFilter === 'out_of_stock' && avail > 0) continue;
      if (stockStatusFilter === 'low_stock' && (avail > reorder || avail <= 0)) continue;
    }

    // 5. High-Performance Tokenized Multi-Word Search Filter
    if (hasTokens) {
      const corpus = searchCorpusMap.get(p.id) || '';
      let matchesAll = true;
      for (let t = 0; t < tokens.length; t++) {
        if (!corpus.includes(tokens[t])) {
          matchesAll = false;
          break;
        }
      }
      if (!matchesAll) continue;
    }

    result.push(p);
  }

  // 6. Sorting
  if (sortBy === 'name') {
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  if (sortBy === 'stock_desc' && inventoryMap) {
    return result.sort((a, b) => {
      const aInv = inventoryMap.get(a.id)?.available_qty || 0;
      const bInv = inventoryMap.get(b.id)?.available_qty || 0;
      return bInv - aInv;
    });
  }
  if (sortBy === 'stock_asc' && inventoryMap) {
    return result.sort((a, b) => {
      const aInv = inventoryMap.get(a.id)?.available_qty || 0;
      const bInv = inventoryMap.get(b.id)?.available_qty || 0;
      return aInv - bInv;
    });
  }
  if (sortBy === 'price_desc') return result.sort((a, b) => b.selling_price - a.selling_price);
  if (sortBy === 'mrp_desc') return result.sort((a, b) => b.mrp - a.mrp);
  if (sortBy === 'updated') {
    return result.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  }

  return result;
}
