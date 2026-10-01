'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  PackageCheck, ChevronDown, ChevronUp, Plus, Trash2, ArrowLeft, 
  ShieldAlert, Building2, X, Check, Layers, Package, Tag, Sparkles, Boxes,
  Warehouse
} from 'lucide-react';
import { PurchaseItem, formatQuantityDisplay, BaseUnit, TradeMode, getProductTradeMode, formatProductStockDisplay } from '@/lib/db';
import SmartSearchBar from '@/components/SmartSearchBar';

interface UIItemRow {
  productId: string;
  cartonQty: number;
  looseQty: number;
  quantity: number;
  purchaseRate: number;
  discount: number;
  freeQuantity: number;
  mrp: number;
  gstPercent: number;
  sellingPrice?: number;
  hsn: string;
  batch: string;
  manufacturingDate: string;
  expiryDate: string;
}

export default function AdminPurchases() {
  const { 
    purchases, suppliers, products, makePurchase, createSupplier, 
    companies, createCompany, createFullProduct, createProductVariant,
    categories, godowns 
  } = useDb();
  
  // Navigation State
  const [isEnteringNewPurchase, setIsEnteringNewPurchase] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [receivingGodownId, setReceivingGodownId] = useState('');
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierGstin, setNewSupplierGstin] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [supplierActionMsg, setSupplierActionMsg] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<UIItemRow[]>([
    {
      productId: '',
      cartonQty: 0,
      looseQty: 0,
      quantity: 0,
      purchaseRate: 0,
      discount: 0,
      freeQuantity: 0,
      mrp: 0,
      gstPercent: 0,
      sellingPrice: 0,
      hsn: '',
      batch: '',
      manufacturingDate: '',
      expiryDate: ''
    }
  ]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');

  // 1. Add Company Modal State
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');

  // 2. Add Product Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [activeRowIndexForCreation, setActiveRowIndexForCreation] = useState<number | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCompanyId, setNewProdCompanyId] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('FMCG');
  const [newProdSelectedCategoryIds, setNewProdSelectedCategoryIds] = useState<string[]>([]);
  const [newProdAllowCarton, setNewProdAllowCarton] = useState(true);
  const [newProdAllowPieces, setNewProdAllowPieces] = useState(true);
  const [newProdPiecesPerCarton, setNewProdPiecesPerCarton] = useState(24);
  const [newProdLoosePriceMode, setNewProdLoosePriceMode] = useState<'auto' | 'manual'>('auto');
  const [newProdLooseSellingPrice, setNewProdLooseSellingPrice] = useState<number>(0);
  const [newProdPurchasePrice, setNewProdPurchasePrice] = useState<number>(0);
  const [newProdMrp, setNewProdMrp] = useState<number>(0);
  const [newProdSellingPrice, setNewProdSellingPrice] = useState<number>(0);
  const [newProdGst, setNewProdGst] = useState<number>(18);
  const [newProdHsn, setNewProdHsn] = useState('19053100');

  // 3. Add Variant Modal State
  const [showAddVariantModal, setShowAddVariantModal] = useState(false);
  const [variantParentProductId, setVariantParentProductId] = useState('');
  const [variantPackSize, setVariantPackSize] = useState('12 Pieces/Ctn');
  const [variantAllowCarton, setVariantAllowCarton] = useState(true);
  const [variantAllowPieces, setVariantAllowPieces] = useState(true);
  const [variantPiecesPerCarton, setVariantPiecesPerCarton] = useState(12);
  const [variantLoosePriceMode, setVariantLoosePriceMode] = useState<'auto' | 'manual'>('auto');
  const [variantLooseSellingPrice, setVariantLooseSellingPrice] = useState<number>(0);
  const [variantPurchasePrice, setVariantPurchasePrice] = useState<number>(0);
  const [variantMrp, setVariantMrp] = useState<number>(0);
  const [variantSellingPrice, setVariantSellingPrice] = useState<number>(0);
  const [variantHsn, setVariantHsn] = useState('');
  const [variantGst, setVariantGst] = useState<number>(18);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSaveNewSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSupplierName.trim()) {
      alert('Please enter a Supplier / Purchaser Name.');
      return;
    }

    const created = createSupplier(
      newSupplierName.trim(),
      newSupplierGstin.trim().toUpperCase() || 'URP',
      newSupplierAddress.trim() || 'Local Warehousing Zone'
    );

    setSupplierId(created.id);
    setNewSupplierName('');
    setNewSupplierGstin('');
    setNewSupplierAddress('');
    setShowAddSupplierModal(false);
    setSupplierActionMsg(`Purchaser / Supplier "${created.name}" registered and selected successfully!`);
    setTimeout(() => setSupplierActionMsg(''), 4000);
  };

  const handleSaveNewCompany = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCompanyName.trim()) {
      alert('Please enter a Company Name.');
      return;
    }
    const created = createCompany(newCompanyName.trim(), newCompanyCode.trim() || undefined);
    setNewCompanyName('');
    setNewCompanyCode('');
    setShowAddCompanyModal(false);
    setNewProdCompanyId(created.id);
    setSupplierActionMsg(`Company "${created.name}" registered successfully!`);
    setTimeout(() => setSupplierActionMsg(''), 4000);
  };

  const handleSaveNewProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newProdName.trim()) {
      alert('Please enter a Product Name.');
      return;
    }
    if (!newProdCompanyId) {
      alert('Please select a Company.');
      return;
    }
    if (newProdMrp <= 0 || newProdPurchasePrice <= 0) {
      alert('Please enter valid positive amounts for MRP and Purchase Cost.');
      return;
    }

    const allowCarton = newProdAllowCarton;
    const allowPieces = newProdAllowPieces;
    if (!allowCarton && !allowPieces) {
      alert('Please select at least one Trading Unit: Carton/Box or Pieces.');
      return;
    }
    const tradeMode: TradeMode = allowCarton && allowPieces ? 'BOTH' : allowCarton ? 'CARTONS' : 'PIECES';
    const packSize = allowCarton ? Math.max(1, newProdPiecesPerCarton || 1) : 1;

    const created = createFullProduct({
      name: newProdName.trim(),
      company_id: newProdCompanyId,
      brand: newProdBrand.trim() || companies.find(c => c.id === newProdCompanyId)?.name || 'General',
      category: newProdCategory,
      categoryIds: newProdSelectedCategoryIds,
      trade_mode: tradeMode,
      allow_carton: allowCarton,
      allow_pieces: allowPieces,
      pieces_per_carton: packSize,
      pack_size: tradeMode === 'PIECES' ? '1 Piece' : `${packSize} Pieces/Ctn`,
      trading_unit: tradeMode === 'PIECES' ? 'Piece' : 'Carton',
      base_unit: 'Piece',
      units_per_box_carton: packSize,
      units_per_trading_unit: packSize,
      allow_loose_sale: allowPieces,
      loose_price_mode: newProdLoosePriceMode,
      loose_selling_price: newProdLoosePriceMode === 'manual' ? newProdLooseSellingPrice : undefined,
      mrp: newProdMrp,
      purchase_price: newProdPurchasePrice,
      selling_price: newProdSellingPrice || Math.round(newProdPurchasePrice * 1.15),
      gst_percent: newProdGst,
      hsn: newProdHsn.trim() || '19053100'
    });

    // Assign to active row or append new row
    if (activeRowIndexForCreation !== null && activeRowIndexForCreation < items.length) {
      setItems(items.map((it, idx) => {
        if (idx === activeRowIndexForCreation) {
          const cQty = tradeMode === 'PIECES' ? 0 : 1;
          const lQty = tradeMode === 'PIECES' ? 10 : 0;
          return {
            ...it,
            productId: created.id,
            cartonQty: cQty,
            looseQty: lQty,
            quantity: tradeMode === 'PIECES' ? lQty : (cQty * packSize + lQty),
            purchaseRate: created.purchase_price,
            mrp: created.mrp,
            gstPercent: created.gst_percent,
            hsn: created.hsn
          };
        }
        return it;
      }));
    } else {
      const firstEmptyIdx = items.findIndex(it => !it.productId);
      const cQty = tradeMode === 'PIECES' ? 0 : 1;
      const lQty = tradeMode === 'PIECES' ? 10 : 0;
      if (firstEmptyIdx !== -1) {
        setItems(items.map((it, idx) => {
          if (idx === firstEmptyIdx) {
            return {
              ...it,
              productId: created.id,
              cartonQty: cQty,
              looseQty: lQty,
              quantity: tradeMode === 'PIECES' ? lQty : (cQty * packSize + lQty),
              purchaseRate: created.purchase_price,
              mrp: created.mrp,
              gstPercent: created.gst_percent,
              hsn: created.hsn
            };
          }
          return it;
        }));
      } else {
        setItems([
          ...items,
          {
            productId: created.id,
            cartonQty: cQty,
            looseQty: lQty,
            quantity: tradeMode === 'PIECES' ? lQty : (cQty * packSize + lQty),
            purchaseRate: created.purchase_price,
            discount: 0,
            freeQuantity: 0,
            mrp: created.mrp,
            gstPercent: created.gst_percent,
            hsn: created.hsn,
            batch: '',
            manufacturingDate: '',
            expiryDate: ''
          }
        ]);
      }
    }

    // Reset form
    setNewProdName('');
    setNewProdBrand('');
    setNewProdPurchasePrice(0);
    setNewProdMrp(0);
    setNewProdSellingPrice(0);
    setShowAddProductModal(false);
    setActiveRowIndexForCreation(null);
    setSupplierActionMsg(`New Product "${created.name}" created and loaded into purchase inward basket!`);
    setTimeout(() => setSupplierActionMsg(''), 4000);
  };

  const handleSelectVariantParent = (parentId: string) => {
    setVariantParentProductId(parentId);
    const parent = products.find(p => p.id === parentId);
    if (parent) {
      const meta = getProductTradeMode(parent);
      setVariantHsn(parent.hsn);
      setVariantGst(parent.gst_percent);
      setVariantMrp(Math.round(parent.mrp * 1.5));
      setVariantPurchasePrice(Math.round(parent.purchase_price * 1.5));
      setVariantSellingPrice(Math.round(parent.selling_price * 1.5));
      setVariantAllowCarton(meta.allowCarton);
      setVariantAllowPieces(meta.allowPieces);
      setVariantPiecesPerCarton(meta.packSize || 12);
      setVariantLoosePriceMode(parent.loose_price_mode || 'auto');
      setVariantLooseSellingPrice(parent.loose_selling_price || 0);
    }
  };

  const handleSaveNewVariant = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!variantParentProductId) {
      alert('Please select an existing parent product.');
      return;
    }
    if (!variantPackSize.trim()) {
      alert('Please specify the variant packaging / size.');
      return;
    }
    if (variantMrp <= 0 || variantPurchasePrice <= 0) {
      alert('Please enter valid positive amounts for Variant MRP and Purchase Cost.');
      return;
    }

    const allowCarton = variantAllowCarton;
    const allowPieces = variantAllowPieces;
    if (!allowCarton && !allowPieces) {
      alert('Please select at least one Trading Unit: Carton/Box or Pieces.');
      return;
    }
    const tradeMode: TradeMode = allowCarton && allowPieces ? 'BOTH' : allowCarton ? 'CARTONS' : 'PIECES';
    const packSize = allowCarton ? Math.max(1, variantPiecesPerCarton || 1) : 1;

    const created = createProductVariant(variantParentProductId, {
      pack_size: tradeMode === 'PIECES' ? variantPackSize.trim() : `${packSize} Pieces/Ctn`,
      trading_unit: tradeMode === 'PIECES' ? 'Piece' : 'Carton',
      base_unit: 'Piece',
      trade_mode: tradeMode,
      allow_carton: allowCarton,
      allow_pieces: allowPieces,
      pieces_per_carton: packSize,
      units_per_box_carton: packSize,
      units_per_trading_unit: packSize,
      allow_loose_sale: allowPieces,
      loose_price_mode: variantLoosePriceMode,
      loose_selling_price: variantLoosePriceMode === 'manual' ? variantLooseSellingPrice : undefined,
      mrp: variantMrp,
      purchase_price: variantPurchasePrice,
      selling_price: variantSellingPrice || Math.round(variantPurchasePrice * 1.15),
      hsn: variantHsn.trim() || undefined,
      gst_percent: variantGst
    });

    // Assign to active row or append new row
    const cQty = tradeMode === 'PIECES' ? 0 : 1;
    const lQty = tradeMode === 'PIECES' ? 10 : 0;
    if (activeRowIndexForCreation !== null && activeRowIndexForCreation < items.length) {
      setItems(items.map((it, idx) => {
        if (idx === activeRowIndexForCreation) {
          return {
            ...it,
            productId: created.id,
            cartonQty: cQty,
            looseQty: lQty,
            quantity: tradeMode === 'PIECES' ? lQty : (cQty * packSize + lQty),
            purchaseRate: created.purchase_price,
            mrp: created.mrp,
            gstPercent: created.gst_percent,
            hsn: created.hsn
          };
        }
        return it;
      }));
    } else {
      const firstEmptyIdx = items.findIndex(it => !it.productId);
      if (firstEmptyIdx !== -1) {
        setItems(items.map((it, idx) => {
          if (idx === firstEmptyIdx) {
            return {
              ...it,
              productId: created.id,
              cartonQty: cQty,
              looseQty: lQty,
              quantity: tradeMode === 'PIECES' ? lQty : (cQty * packSize + lQty),
              purchaseRate: created.purchase_price,
              mrp: created.mrp,
              gstPercent: created.gst_percent,
              hsn: created.hsn
            };
          }
          return it;
        }));
      } else {
        setItems([
          ...items,
          {
            productId: created.id,
            cartonQty: cQty,
            looseQty: lQty,
            quantity: tradeMode === 'PIECES' ? lQty : (cQty * packSize + lQty),
            purchaseRate: created.purchase_price,
            discount: 0,
            freeQuantity: 0,
            mrp: created.mrp,
            gstPercent: created.gst_percent,
            hsn: created.hsn,
            batch: '',
            manufacturingDate: '',
            expiryDate: ''
          }
        ]);
      }
    }

    // Reset form
    setVariantPackSize('12 Pieces/Ctn');
    setVariantPurchasePrice(0);
    setVariantMrp(0);
    setVariantSellingPrice(0);
    setShowAddVariantModal(false);
    setActiveRowIndexForCreation(null);
    setSupplierActionMsg(`New Variant "${created.name}" created and loaded into purchase inward basket!`);
    setTimeout(() => setSupplierActionMsg(''), 4000);
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const meta = getProductTradeMode(prod);

    setItems(items.map((item, idx) => {
      if (idx === index) {
        const cQty = meta.tradeMode === 'PIECES' ? 0 : (item.cartonQty > 0 ? item.cartonQty : 1);
        const lQty = meta.tradeMode === 'PIECES' ? (item.looseQty > 0 ? item.looseQty : 10) : (item.looseQty || 0);
        const totalBase = meta.tradeMode === 'PIECES' ? lQty : ((cQty * meta.packSize) + lQty);
        return {
          ...item,
          productId: prodId,
          cartonQty: cQty,
          looseQty: lQty,
          quantity: totalBase,
          purchaseRate: prod.purchase_price,
          mrp: prod.mrp,
          gstPercent: prod.gst_percent,
          sellingPrice: prod.selling_price || Math.round(prod.purchase_price * 1.15),
          hsn: prod.hsn
        };
      }
      return item;
    }));
  };

  const handleUpdateItemField = (index: number, field: keyof UIItemRow, value: any) => {
    setItems(items.map((item, idx) => {
      if (idx === index) {
        const updated = { ...item, [field]: value };
        const prod = products.find(p => p.id === updated.productId);
        if (prod) {
          const meta = getProductTradeMode(prod);
          if (field === 'cartonQty' || field === 'looseQty') {
            updated.quantity = meta.tradeMode === 'PIECES'
              ? (updated.looseQty || 0)
              : (((updated.cartonQty || 0) * meta.packSize) + (updated.looseQty || 0));
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleAddItemRow = () => {
    setItems([
      ...items,
      {
        productId: '',
        cartonQty: 0,
        looseQty: 0,
        quantity: 0,
        purchaseRate: 0,
        discount: 0,
        freeQuantity: 0,
        mrp: 0,
        gstPercent: 0,
        sellingPrice: 0,
        hsn: '',
        batch: '',
        manufacturingDate: '',
        expiryDate: ''
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Perform purchase calculation
  const calculateTotalAmount = () => {
    return items.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return sum;
      const meta = getProductTradeMode(prod);
      if (meta.tradeMode === 'PIECES') {
        const lineSub = item.purchaseRate * (item.looseQty || 0);
        const discLine = item.discount * (item.looseQty || 0);
        const taxable = Math.max(0, lineSub - discLine);
        const gst = taxable * (item.gstPercent / 100);
        return sum + taxable + gst;
      } else {
        const effectiveCartons = (item.cartonQty || 0) + ((item.looseQty || 0) / meta.packSize);
        const lineSub = item.purchaseRate * effectiveCartons;
        const discLine = item.discount * effectiveCartons;
        const taxable = Math.max(0, lineSub - discLine);
        const gst = taxable * (item.gstPercent / 100);
        return sum + taxable + gst;
      }
    }, 0);
  };

  const handleConfirmPurchase = (force = false) => {
    // Validations
    if (!supplierId) {
      alert('Please select a supplier.');
      return;
    }
    if (!invoiceNumber.trim()) {
      alert('Please enter a purchase invoice number.');
      return;
    }
    if (!invoiceDate) {
      alert('Please select an invoice date.');
      return;
    }

    const invalidItem = items.some(item => {
      if (!item.productId) return true;
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return true;
      const meta = getProductTradeMode(prod);
      const totalBaseQty = meta.tradeMode === 'PIECES'
        ? (item.looseQty || 0)
        : (((item.cartonQty || 0) * meta.packSize) + (item.looseQty || 0));
      if (totalBaseQty <= 0) return true;
      if (!item.purchaseRate || item.purchaseRate <= 0) return true;
      if (!item.mrp || item.mrp <= 0) return true;
      return false;
    });

    if (invalidItem) {
      alert('Please select valid products with positive inward quantity, purchase rate, and MRP for all items.');
      return;
    }

    // Duplicate Check
    if (!force) {
      const potentialDuplicate = purchases.find(
        p => 
          p.supplier_id === supplierId && 
          p.invoice_number.trim().toLowerCase() === invoiceNumber.trim().toLowerCase() && 
          p.invoice_date === invoiceDate
      );
      if (potentialDuplicate) {
        setDuplicateWarning(`Possible duplicate purchase invoice. Invoice #${invoiceNumber} for this supplier on ${invoiceDate} is already seed/recorded.`);
        return;
      }
    }

    // Process Transaction
    const totalVal = calculateTotalAmount();
    const purchaseItems = items.map(item => {
      const prod = products.find(p => p.id === item.productId)!;
      const meta = getProductTradeMode(prod);
      const totalBaseQty = meta.tradeMode === 'PIECES'
        ? (item.looseQty || 0)
        : (((item.cartonQty || 0) * meta.packSize) + (item.looseQty || 0));
      const effectiveBatch = item.batch?.trim() || (invoiceNumber.trim() ? `LOT-${invoiceNumber.trim()}` : `LOT-${invoiceDate}`);
      const looseRate = meta.tradeMode === 'PIECES' ? item.purchaseRate : (item.purchaseRate / meta.packSize);
      return {
        product_id: item.productId,
        quantity: totalBaseQty,
        base_qty: totalBaseQty,
        trading_unit: meta.tradeMode === 'PIECES' ? 'Piece' : 'Carton',
        base_unit: 'Piece',
        units_per_box_carton: meta.packSize,
        units_per_trading_unit: meta.packSize,
        carton_qty: meta.tradeMode === 'PIECES' ? 0 : (item.cartonQty || 0),
        loose_qty: item.looseQty || 0,
        purchase_rate: item.purchaseRate,
        carton_rate: item.purchaseRate,
        loose_purchase_rate: looseRate,
        loose_rate: looseRate,
        discount: item.discount || 0,
        free_quantity: item.freeQuantity || 0,
        mrp: item.mrp,
        gst_percent: item.gstPercent !== undefined ? item.gstPercent : (prod?.gst_percent || 18),
        selling_price: item.sellingPrice || prod?.selling_price || Math.round(item.purchaseRate * 1.15),
        hsn: item.hsn || prod?.hsn || '19053100',
        batch: effectiveBatch,
        manufacturing_date: item.manufacturingDate || undefined,
        expiry_date: item.expiryDate || undefined
      };
    });

    makePurchase({
      supplier_id: supplierId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      receiving_godown_id: receivingGodownId || undefined,
      total_amount: Math.round(totalVal),
      items: purchaseItems
    });

    alert(`Purchase inward successfully confirmed! Inventory balances updated.`);
    
    // Reset Form
    setSupplierId('');
    setReceivingGodownId('');
    setInvoiceNumber('');
    setItems([
      {
        productId: '',
        cartonQty: 0,
        looseQty: 0,
        quantity: 0,
        purchaseRate: 0,
        discount: 0,
        freeQuantity: 0,
        mrp: 0,
        gstPercent: 0,
        sellingPrice: 0,
        hsn: '',
        batch: '',
        manufacturingDate: '',
        expiryDate: ''
      }
    ]);
    setDuplicateWarning(null);
    setIsEnteringNewPurchase(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Purchase Inward Ledger</h2>
          <p className="text-xs text-slate-500 mt-1">Review historical incoming stock purchases, batches received from FMCG suppliers, and purchase rate variances.</p>
        </div>
        {!isEnteringNewPurchase ? (
          <div className="flex items-center gap-2 self-start flex-wrap">
            <button
              type="button"
              onClick={() => {
                setNewCompanyName('');
                setNewCompanyCode('');
                setShowAddCompanyModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Create a new FMCG company/manufacturer"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>🏢 + New Company</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRowIndexForCreation(null);
                setNewProdCompanyId(companies[0]?.id || '');
                setNewProdName('');
                setNewProdBrand('');
                setNewProdPurchasePrice(0);
                setNewProdMrp(0);
                setNewProdSellingPrice(0);
                setShowAddProductModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Create a new master product"
            >
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span>📦 + New Master Product</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRowIndexForCreation(null);
                if (products.length > 0) {
                  handleSelectVariantParent(products[0].id);
                }
                setShowAddVariantModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Add a new packaging/size variant"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>🔀 + New Variant</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddSupplierModal(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ Add Supplier</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEnteringNewPurchase(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Purchase</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 self-start flex-wrap">
            <button
              type="button"
              onClick={() => {
                setNewCompanyName('');
                setNewCompanyCode('');
                setShowAddCompanyModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>🏢 + New Company</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRowIndexForCreation(null);
                setNewProdCompanyId(companies[0]?.id || '');
                setShowAddProductModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span>📦 + New Product</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveRowIndexForCreation(null);
                if (products.length > 0) {
                  handleSelectVariantParent(products[0].id);
                }
                setShowAddVariantModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>🔀 + New Variant</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsEnteringNewPurchase(false);
                setDuplicateWarning(null);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to History</span>
            </button>
          </div>
        )}
      </div>

      {duplicateWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 text-xs font-semibold">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold">{duplicateWarning}</p>
            <p className="text-xs text-amber-700 font-normal mt-0.5">Do you still want to force confirm this inward shipment?</p>
          </div>
          <div className="flex gap-2 self-end sm:self-center">
            <button 
              onClick={() => handleConfirmPurchase(true)} 
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold transition-colors text-xs cursor-pointer"
            >
              Yes, Force Inward
            </button>
            <button 
              onClick={() => setDuplicateWarning(null)} 
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold transition-colors text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: MANUAL PURCHASE ENTRY FORM */}
      {isEnteringNewPurchase ? (
        <div className="erp-card bg-white p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">New Purchase Inward Invoice</h3>
            {supplierActionMsg && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{supplierActionMsg}</span>
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Supplier / Purchaser</label>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Purchaser</span>
                </button>
              </div>
              <div className="flex gap-2">
                <select
                  value={supplierId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setShowAddSupplierModal(true);
                    } else {
                      setSupplierId(e.target.value);
                    }
                  }}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-indigo-500 font-semibold text-slate-700 bg-white"
                >
                  <option value="">-- Select Supplier / Purchaser --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.gstin})</option>
                  ))}
                  <option value="__add_new__" className="text-indigo-600 font-bold bg-indigo-50">+ Add New Purchaser / Supplier...</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  title="Add New Supplier / Purchaser"
                  className="px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Receiving Godown / Facility</label>
              <select
                value={receivingGodownId}
                onChange={(e) => setReceivingGodownId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-indigo-500 font-semibold text-slate-700 bg-white"
              >
                <option value="">-- Default Godown --</option>
                {godowns.filter(g => g.status === 'Active').map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code}){g.is_default ? ' [Default]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Purchase Invoice Number</label>
              <input
                type="text"
                placeholder="e.g. GST-10254"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 font-semibold"
              />
            </div>
          </div>

          {/* Quick-Action Creation Toolbar */}
          <div className="p-3 bg-linear-to-r from-slate-50 to-indigo-50/50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">⚡ Quick Actions:</span>
              <span className="text-slate-500 font-medium">Add missing entities on-the-fly without losing your purchase bill inputs</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setNewCompanyName('');
                  setNewCompanyCode('');
                  setShowAddCompanyModal(true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>🏢 + New Company</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRowIndexForCreation(null);
                  setNewProdCompanyId(companies[0]?.id || '');
                  setShowAddProductModal(true);
                }}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Package className="w-3.5 h-3.5 text-indigo-600" />
                <span>📦 + New Master Product</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveRowIndexForCreation(null);
                  if (products.length > 0) {
                    handleSelectVariantParent(products[0].id);
                  }
                  setShowAddVariantModal(true);
                }}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>🔀 + New Variant</span>
              </button>
            </div>
          </div>

          {/* Items Entry Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Purchase Items Basket</h4>
                <p className="text-xs text-slate-500">Select product lines or quickly register new master items / variants directly during inward</p>
              </div>

              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors self-start cursor-pointer border border-indigo-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Another Row</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full min-w-[950px] text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-2.5 w-1/4">Product</th>
                    <th className="p-2.5">Pack Details</th>
                    <th className="p-2.5 text-center">Inward Quantity</th>
                    <th className="p-2.5 text-center">Free Cartons</th>
                    <th className="p-2.5 text-right">Purchase Rate (₹)</th>
                    <th className="p-2.5 text-right">MRP (₹)</th>
                    <th className="p-2.5 text-center">GST %</th>
                    <th className="p-2.5 text-right">Selling Price (₹)</th>
                    <th className="p-2.5 text-center">Batch No. <span className="text-[10px] text-slate-400 font-normal block sm:inline">(Opt)</span></th>
                    <th className="p-2.5 text-center">Expiry Date <span className="text-[10px] text-slate-400 font-normal block sm:inline">(Opt)</span></th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const selectedProd = products.find(p => p.id === item.productId);
                    const tradeInfo = selectedProd ? getProductTradeMode(selectedProd) : null;
                    const isPiecesOnly = tradeInfo?.tradeMode === 'PIECES';
                    const isCartonsOnly = tradeInfo?.tradeMode === 'CARTONS';
                    const unitsPerPack = tradeInfo?.packSize || selectedProd?.units_per_box_carton || 1;
                    return (
                      <tr key={idx} className="align-middle">
                        {/* Product selection */}
                        <td className="p-2">
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__add_new_item__') {
                                setActiveRowIndexForCreation(idx);
                                setShowAddProductModal(true);
                              } else if (val === '__add_new_variant__') {
                                setActiveRowIndexForCreation(idx);
                                setShowAddVariantModal(true);
                              } else if (val === '__add_new_company__') {
                                setActiveRowIndexForCreation(idx);
                                setShowAddCompanyModal(true);
                              } else {
                                handleProductSelect(idx, val);
                              }
                            }}
                            className="w-full border border-slate-250 bg-white rounded p-1.5 text-xs outline-none focus:border-indigo-500 font-medium"
                          >
                            <option value="">-- Choose Product --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} [{p.brand}] — {p.pack_size}
                              </option>
                            ))}
                            <option disabled value="">──────────────</option>
                            <option value="__add_new_item__" className="text-indigo-600 font-bold bg-indigo-50">
                              + Add New Master Product...
                            </option>
                            <option value="__add_new_variant__" className="text-purple-600 font-bold bg-purple-50">
                              + Add New Variant for Product...
                            </option>
                            <option value="__add_new_company__" className="text-slate-600 font-bold bg-slate-50">
                              + Add New Company...
                            </option>
                          </select>
                        </td>

                        {/* Packing & Unit */}
                        <td className="p-2 text-slate-500 font-medium">
                          {selectedProd ? (
                            <div>
                              <span className="font-bold text-slate-800 text-xs">
                                {isPiecesOnly ? 'Pieces Only' : (selectedProd.pack_size || `${unitsPerPack} Pieces/Ctn`)}
                              </span>
                              <span className="block text-xs text-slate-500 font-mono">
                                {isPiecesOnly ? 'Single Unit (1 Piece)' : `1 Carton = ${unitsPerPack} Pieces`}
                              </span>
                            </div>
                          ) : (
                            <span className="italic text-xs text-slate-400">No product</span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="p-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {isPiecesOnly ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-indigo-600 font-bold uppercase">Pieces</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={item.looseQty || item.quantity || ''}
                                  onChange={(e) => handleUpdateItemField(idx, 'looseQty', parseInt(e.target.value, 10) || 0)}
                                  className="w-20 border border-indigo-200 bg-indigo-50/40 rounded p-1 text-center font-bold text-indigo-700 text-xs"
                                />
                              </div>
                            ) : isCartonsOnly ? (
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-slate-500 font-bold uppercase">Cartons</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={item.cartonQty || ''}
                                  onChange={(e) => handleUpdateItemField(idx, 'cartonQty', parseInt(e.target.value, 10) || 0)}
                                  className="w-16 border border-slate-250 rounded p-1 text-center font-bold text-slate-800 text-xs"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-slate-500 font-bold uppercase">Cartons</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={item.cartonQty || ''}
                                    onChange={(e) => handleUpdateItemField(idx, 'cartonQty', parseInt(e.target.value, 10) || 0)}
                                    className="w-14 border border-slate-250 rounded p-1 text-center font-bold text-slate-800 text-xs"
                                  />
                                </div>
                                <span className="text-slate-400 font-bold text-xs mt-3">+</span>
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-indigo-600 font-bold uppercase">Pieces</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={item.looseQty || ''}
                                    onChange={(e) => handleUpdateItemField(idx, 'looseQty', parseInt(e.target.value, 10) || 0)}
                                    className="w-14 border border-indigo-200 bg-indigo-50/40 rounded p-1 text-center font-bold text-indigo-700 text-xs"
                                  />
                                </div>
                              </div>
                            )}
                            {selectedProd && (
                              <span className="text-xs text-slate-600 font-medium">
                                Total: <strong className="text-slate-900 font-bold">{item.quantity} Pieces</strong>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Free Quantity */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            placeholder={isPiecesOnly ? 'Pcs' : 'Ctns'}
                            title={isPiecesOnly ? 'Free Pieces' : 'Free Cartons'}
                            value={item.freeQuantity || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                            className="w-14 border border-slate-200 rounded p-1 text-center font-bold text-slate-850 text-xs"
                          />
                        </td>

                        {/* Purchase Rate */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.purchaseRate || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'purchaseRate', parseFloat(e.target.value) || 0)}
                            className="w-20 border border-slate-200 rounded p-1 text-right font-semibold text-xs"
                          />
                        </td>

                        {/* MRP */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.mrp || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-16 border border-slate-200 rounded p-1 text-right font-semibold text-xs"
                          />
                        </td>

                        {/* GST % */}
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="28"
                            step="1"
                            value={item.gstPercent !== undefined ? item.gstPercent : 18}
                            onChange={(e) => handleUpdateItemField(idx, 'gstPercent', parseFloat(e.target.value) || 0)}
                            className="w-14 border border-slate-200 rounded p-1 text-center font-bold text-slate-700 text-xs"
                            title="Tax GST Percentage"
                          />
                        </td>

                        {/* Selling Price */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Selling"
                            value={item.sellingPrice || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 border border-slate-200 rounded p-1 text-right font-semibold text-indigo-700 text-xs"
                            title="Selling Price per Carton"
                          />
                        </td>

                        {/* Batch Number */}
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            placeholder="Optional"
                            value={item.batch}
                            onChange={(e) => handleUpdateItemField(idx, 'batch', e.target.value)}
                            className="w-24 border border-slate-200 rounded p-1 text-center font-mono text-xs"
                          />
                        </td>

                        {/* Expiry Date */}
                        <td className="p-2 text-center">
                          <input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => handleUpdateItemField(idx, 'expiryDate', e.target.value)}
                            className="border border-slate-200 rounded p-1 text-xs"
                          />
                        </td>

                        {/* Trash Action */}
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleRemoveItemRow(idx)}
                            disabled={items.length === 1}
                            className="p-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Summary & Confirm */}
          <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm font-semibold text-slate-600 text-center sm:text-left">
              <span>GST Inclusive Valuation: </span>
              <strong className="text-base text-slate-800 font-extrabold block sm:inline">₹{calculateTotalAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </div>

            <button
              onClick={() => handleConfirmPurchase(false)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/10 transition-colors w-full sm:w-auto cursor-pointer"
            >
              CONFIRM PURCHASE &amp; INCREASE STOCK
            </button>
          </div>
        </div>
      ) : (
        /* VIEW 2: HISTORICAL PURCHASES LEDGER */
        <div className="erp-card bg-white p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Historical Inward Transactions ({purchases.length})</h3>
            </div>
            <div className="w-full sm:max-w-xs">
              <SmartSearchBar
                value={purchaseSearchTerm}
                onChange={setPurchaseSearchTerm}
                placeholder="Search supplier, bill #, items..."
                entityFilter={['supplier', 'product']}
                size="sm"
              />
            </div>
          </div>

          {purchases.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              No inward stock purchases recorded yet. Upload a bill using AI Import or click "+ New Purchase".
            </div>
          ) : (
            <div className="space-y-3">
              {purchases
                .filter(pur => {
                  if (!purchaseSearchTerm.trim()) return true;
                  const q = purchaseSearchTerm.toLowerCase().trim();
                  const supplierObj = suppliers.find(s => s.id === pur.supplier_id);
                  const matchSup = (supplierObj?.name || '').toLowerCase().includes(q);
                  const matchInv = (pur.invoice_number || '').toLowerCase().includes(q);
                  const matchItem = pur.items?.some(i => {
                    const prod = products.find(p => p.id === i.product_id);
                    return (prod?.name || '').toLowerCase().includes(q);
                  });
                  return matchSup || matchInv || matchItem;
                })
                .map(pur => {
                const supplierObj = suppliers.find(s => s.id === pur.supplier_id);
                const isExpanded = expandedId === pur.id;
                const isOpeningStock = pur.invoice_number.startsWith('OPENING-') || pur.id.startsWith('pur-init-');
                const receivingGodown = godowns.find(g => g.id === pur.receiving_godown_id);
                
                return (
                  <div key={pur.id} className={`border rounded-xl p-4 space-y-3 transition-all ${
                    isOpeningStock 
                      ? 'border-emerald-200 bg-emerald-50/20' 
                      : 'border-slate-200 bg-slate-50/20'
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {isOpeningStock ? (supplierObj?.name || 'Opening Stock (Initial Inventory Setup)') : (supplierObj?.name || 'Unknown Supplier')}
                          </span>
                          {isOpeningStock && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Opening Stock / Initial Purchase</span>
                            </span>
                          )}
                          {receivingGodown && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{receivingGodown.name} ({receivingGodown.code})</span>
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block mt-1">
                          Invoice Code: <strong className="text-slate-800 font-bold">{pur.invoice_number}</strong> &bull; Date: {new Date(pur.invoice_date).toLocaleDateString('en-IN')} {isOpeningStock && <>&bull; Source: <span className="text-indigo-600 font-semibold">Manual Item Creation</span></>}
                        </span>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <span className="text-xs text-slate-500 block uppercase font-bold">Inward Value</span>
                          <span className="font-black text-slate-900 text-base">₹{pur.total_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <button
                          onClick={() => toggleExpand(pur.id)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items details */}
                    {isExpanded && (
                      <div className="border-t border-slate-200/80 pt-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Inward Products &amp; Batches</h4>
                          {isOpeningStock && (
                            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Direct Inventory &amp; Stock Ledger Entry
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[700px] text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs font-bold text-slate-600 uppercase pb-1.5">
                                <th className="pb-1.5">Product Description</th>
                                <th className="pb-1.5 text-center font-bold">Qty Inwarded</th>
                                <th className="pb-1.5 text-center font-bold">Base Units</th>
                                <th className="pb-1.5 text-center font-bold">Free Qty</th>
                                <th className="pb-1.5 text-right">Inward Rate</th>
                                <th className="pb-1.5 text-right">MRP</th>
                                <th className="pb-1.5 text-center font-mono">Batch</th>
                                <th className="pb-1.5 text-right">Expiry Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {pur.items?.map((item, idx) => {
                                const prod = products.find(p => p.id === item.product_id);
                                const unitsPerPack = item.units_per_box_carton || prod?.units_per_box_carton || 1;
                                const tradingUnit = item.trading_unit || prod?.trading_unit || 'Carton';
                                const baseUnit = item.base_unit || prod?.base_unit || 'Piece';
                                return (
                                  <tr key={idx} className="text-slate-600">
                                    <td className="py-2.5 font-semibold text-slate-800">
                                      <div>
                                        <span className="font-bold text-slate-900 text-sm block">{prod?.name || 'Item'}</span>
                                        <span className="text-xs text-slate-500 font-medium">1 {tradingUnit} = {unitsPerPack} {baseUnit}s</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 text-center font-bold text-slate-900 text-xs">
                                      {formatQuantityDisplay(item.quantity, unitsPerPack, tradingUnit, baseUnit)}
                                    </td>
                                    <td className="py-2.5 text-center font-mono text-indigo-700 font-bold text-xs">
                                      {item.quantity} {baseUnit}s
                                    </td>
                                    <td className="py-2.5 text-center font-bold text-emerald-700 text-xs">
                                      {item.free_quantity ? `${item.free_quantity} ${tradingUnit}s` : '-'}
                                    </td>
                                    <td className="py-2.5 text-right font-bold text-slate-900 text-xs">₹{item.purchase_rate.toFixed(2)}</td>
                                    <td className="py-2.5 text-right text-xs font-semibold text-slate-700">₹{item.mrp.toFixed(2)}</td>
                                    <td className="py-2.5 text-center font-mono font-bold text-slate-800 bg-slate-50 rounded px-2 py-0.5 text-xs">{item.batch || '—'}</td>
                                    <td className="py-2.5 text-right text-slate-600 text-xs font-medium">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add New Supplier / Purchaser Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 text-left">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">Add New Supplier / Purchaser</h3>
                  <p className="text-xs text-slate-500 font-medium">Register a vendor/purchaser for stock inwards</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSupplier} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Supplier / Purchaser Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parle Agro Distributors / Metro Wholesale Hub"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  GSTIN (15-Digit GST Number)
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 27ABCDE1234F1Z5 (or leave blank if URP)"
                  value={newSupplierGstin}
                  onChange={(e) => setNewSupplierGstin(e.target.value.toUpperCase())}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold text-slate-800 uppercase outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Depot / Warehouse Address
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. MIDC Industrial Area, Andheri East, Mumbai, MH"
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-colors cursor-pointer text-center text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-900/10 transition-colors cursor-pointer text-center text-xs"
                >
                  Save &amp; Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Add New FMCG Company</h3>
                  <p className="text-xs text-emerald-100">Register brand manufacturer / distributor company</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCompanyModal(false)}
                className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCompany} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Company / Manufacturer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mondelez India Foods Pvt Ltd, Amul India"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Brand Code / Prefix (Optional)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="e.g. MDLZ, AMUL, UNL"
                  value={newCompanyCode}
                  onChange={(e) => setNewCompanyCode(e.target.value.toUpperCase())}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold text-slate-800 uppercase outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-colors cursor-pointer text-center text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-900/10 transition-colors cursor-pointer text-center text-xs"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Master Item Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Add New Master Item / SKU</h3>
                  <p className="text-xs text-blue-100">Create new catalogue product and auto-populate inward basket</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddProductModal(false);
                  setActiveRowIndexForCreation(null);
                }}
                className="p-1 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewProduct} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Manufacturer Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newProdCompanyId}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setShowAddCompanyModal(true);
                      } else {
                        setNewProdCompanyId(e.target.value);
                      }
                    }}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="__add_new__" className="text-emerald-700 font-bold bg-emerald-50">
                      + Add New FMCG Company...
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Brand Name / Line
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Parle, Cadbury, Tata Tea"
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Product / Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parle Hide & Seek Chocolate Biscuits"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1 md:col-span-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                      Product Categories
                    </label>
                    {categories.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setNewProdSelectedCategoryIds(categories.map(c => c.id));
                            setNewProdCategory(categories.map(c => c.name).join(', '));
                          }}
                          className="font-bold text-indigo-600 hover:underline cursor-pointer text-[11px]"
                        >
                          Select All ({categories.length})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewProdSelectedCategoryIds([]);
                            setNewProdCategory('');
                          }}
                          className="font-bold text-slate-500 hover:underline cursor-pointer text-[11px]"
                        >
                          Deselect All
                        </button>
                      </div>
                    )}
                  </div>
                  {categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-28 overflow-y-auto">
                      {categories.map(cat => {
                        const isSelected = newProdSelectedCategoryIds.includes(cat.id);
                        return (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => {
                              setNewProdSelectedCategoryIds(prev => 
                                prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                              );
                              setNewProdCategory(cat.name);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-xs' 
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. FMCG, Snacks, Beverages"
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Trading Unit Selection */}
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 md:col-span-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                      Trading Unit Options <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Choose how this product is purchased and sold (Carton/Box, Pieces, or Both).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      newProdAllowCarton ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs">Carton / Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={newProdAllowCarton}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !newProdAllowPieces) return;
                          setNewProdAllowCarton(checked);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      newProdAllowPieces ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs">Pieces</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={newProdAllowPieces}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !newProdAllowCarton) return;
                          setNewProdAllowPieces(checked);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>
                  </div>

                  {newProdAllowCarton ? (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Pieces per Carton (Pack Size) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newProdPiecesPerCarton || ''}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setNewProdPiecesPerCarton(val);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-900 bg-white text-xs"
                        required
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                      <Boxes className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>Single unit mode: Stock and inwarding will strictly trade in <strong>Pieces</strong>.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Purchase Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newProdPurchasePrice || ''}
                    onChange={(e) => setNewProdPurchasePrice(Number(e.target.value))}
                    className="w-full border border-blue-300 rounded-lg p-2 text-xs font-black text-blue-700 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newProdMrp || ''}
                    onChange={(e) => setNewProdMrp(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-black text-slate-800 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Wholesale Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newProdSellingPrice || ''}
                    onChange={(e) => setNewProdSellingPrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* Loose Selling Controls for Dual Trade */}
              {newProdAllowCarton && newProdAllowPieces && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-950 block">Loose Piece Rate Options</span>
                      <span className="text-xs text-slate-500 font-medium">Automatic pro-rata or custom pricing for piece sales</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-100/60">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Pricing Mode</label>
                      <select
                        value={newProdLoosePriceMode}
                        onChange={(e) => setNewProdLoosePriceMode(e.target.value as any)}
                        className="w-full border border-indigo-200 bg-white rounded p-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="auto">Auto Pro-Rata (Carton Price / Pack Size)</option>
                        <option value="manual">Manual Loose Piece Rate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                        Loose Piece Rate (₹/Piece)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={newProdLoosePriceMode === 'auto'}
                        value={newProdLoosePriceMode === 'auto' ? ((newProdSellingPrice || 0) / (newProdPiecesPerCarton || 1)).toFixed(2) : newProdLooseSellingPrice || ''}
                        onChange={(e) => setNewProdLooseSellingPrice(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full border border-indigo-200 bg-white rounded p-1.5 text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    GST Rate
                  </label>
                  <select
                    value={newProdGst}
                    onChange={(e) => setNewProdGst(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value={0}>0% (Exempted / Nil)</option>
                    <option value={5}>5% (Basic FMCG / Essentials)</option>
                    <option value={12}>12% (Packaged Foods / Processed)</option>
                    <option value={18}>18% (Standard FMCG / Confectionery)</option>
                    <option value={28}>28% (Luxury / Aerated)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1905, 2106"
                    value={newProdHsn}
                    onChange={(e) => setNewProdHsn(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProductModal(false);
                    setActiveRowIndexForCreation(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-colors cursor-pointer text-center text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-900/10 transition-colors cursor-pointer text-center text-xs"
                >
                  Save &amp; Inward Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Variant in Existing Item Modal */}
      {showAddVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-5 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Add New Variant to Existing Item</h3>
                  <p className="text-xs text-purple-100">Create new pack size or unit variant inheriting brand, HSN and tax codes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddVariantModal(false);
                  setActiveRowIndexForCreation(null);
                }}
                className="p-1 rounded-lg text-purple-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewVariant} className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Select Base Parent Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={variantParentProductId}
                  onChange={(e) => handleSelectVariantParent(e.target.value)}
                  className="w-full border border-purple-200 bg-purple-50/50 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">-- Choose Base Master Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.pack_size || p.trading_unit}] - Current MRP: ₹{p.mrp}
                    </option>
                  ))}
                </select>
              </div>

              {variantParentProductId && (
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-purple-900">Parent Line: </span>
                    <span className="text-purple-800 font-medium">
                      {companies.find(c => c.id === products.find(p => p.id === variantParentProductId)?.company_id)?.name || products.find(p => p.id === variantParentProductId)?.brand} &bull; {products.find(p => p.id === variantParentProductId)?.category}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-purple-700">
                    Tax: {variantGst}% | HSN: {variantHsn || 'N/A'}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    New Variant Pack Size / Packaging <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500g Family Pack, 1L Pet Bottle"
                    value={variantPackSize}
                    onChange={(e) => setVariantPackSize(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    autoFocus
                  />
                </div>

                {/* Trading Unit Selection for Variant */}
                <div className="space-y-3 bg-purple-50/50 p-3.5 rounded-xl border border-purple-200 md:col-span-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                      Trading Unit Options <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Choose how this variant is purchased and sold (Carton/Box, Pieces, or Both).
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      variantAllowCarton ? 'bg-purple-100/70 border-purple-400 text-purple-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-purple-600" />
                        <span className="text-xs">Carton / Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={variantAllowCarton}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !variantAllowPieces) return;
                          setVariantAllowCarton(checked);
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                    </label>

                    <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      variantAllowPieces ? 'bg-purple-100/70 border-purple-400 text-purple-900 font-bold' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs">Pieces</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={variantAllowPieces}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (!checked && !variantAllowCarton) return;
                          setVariantAllowPieces(checked);
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                    </label>
                  </div>

                  {variantAllowCarton ? (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Pieces per Carton (Pack Size) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={variantPiecesPerCarton || ''}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setVariantPiecesPerCarton(val);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-purple-500 outline-none font-bold text-slate-900 bg-white text-xs"
                        required
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-purple-100/60 rounded-lg border border-purple-200 text-xs text-purple-800 font-medium flex items-center gap-2">
                      <Boxes className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>Single unit mode: Stock and inwarding will strictly trade in <strong>Pieces</strong>.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Purchase Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={variantPurchasePrice || ''}
                    onChange={(e) => setVariantPurchasePrice(Number(e.target.value))}
                    className="w-full border border-purple-300 rounded-lg p-2 text-xs font-black text-purple-700 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    MRP (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={variantMrp || ''}
                    onChange={(e) => setVariantMrp(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-black text-slate-800 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Wholesale Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={variantSellingPrice || ''}
                    onChange={(e) => setVariantSellingPrice(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* Loose Selling Controls for Dual Trade */}
              {variantAllowCarton && variantAllowPieces && (
                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-950 block">Loose Piece Rate Options</span>
                      <span className="text-xs text-slate-500 font-medium">Automatic pro-rata or custom pricing for piece sales</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-100/60">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Pricing Mode</label>
                      <select
                        value={variantLoosePriceMode}
                        onChange={(e) => setVariantLoosePriceMode(e.target.value as any)}
                        className="w-full border border-purple-200 bg-white rounded p-1.5 text-xs font-semibold text-slate-800"
                      >
                        <option value="auto">Auto Pro-Rata (Carton Price / Pack Size)</option>
                        <option value="manual">Manual Loose Piece Rate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                        Loose Piece Rate (₹/Piece)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={variantLoosePriceMode === 'auto'}
                        value={variantLoosePriceMode === 'auto' ? ((variantSellingPrice || 0) / (variantPiecesPerCarton || 1)).toFixed(2) : variantLooseSellingPrice || ''}
                        onChange={(e) => setVariantLooseSellingPrice(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full border border-purple-200 bg-white rounded p-1.5 text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    GST Rate
                  </label>
                  <select
                    value={variantGst}
                    onChange={(e) => setVariantGst(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value={0}>0% (Exempted / Nil)</option>
                    <option value={5}>5% (Basic FMCG / Essentials)</option>
                    <option value={12}>12% (Packaged Foods / Processed)</option>
                    <option value={18}>18% (Standard FMCG / Confectionery)</option>
                    <option value={28}>28% (Luxury / Aerated)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1905, 2106"
                    value={variantHsn}
                    onChange={(e) => setVariantHsn(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-semibold text-slate-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddVariantModal(false);
                    setActiveRowIndexForCreation(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-colors cursor-pointer text-center text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md shadow-purple-900/10 transition-colors cursor-pointer text-center text-xs"
                >
                  Save &amp; Inward Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
