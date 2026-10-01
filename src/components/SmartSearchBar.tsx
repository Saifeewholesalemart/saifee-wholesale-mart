'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Search, X, Package, Store, FileText, ShoppingCart, 
  Tag, MapPin, DollarSign, ArrowRight, CornerDownLeft, Sparkles
} from 'lucide-react';

export interface SuggestionItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'product' | 'retailer' | 'invoice' | 'order' | 'category' | 'brand' | 'custom' | 'supplier';
  badge?: string;
  data?: any;
  searchValue?: string;
}

export interface SmartSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  wrapperClassName?: string;
  onSelectSuggestion?: (suggestion: SuggestionItem) => void;
  customSuggestions?: (string | SuggestionItem)[];
  entityFilter?: ('product' | 'retailer' | 'invoice' | 'order' | 'category' | 'supplier')[];
  disabled?: boolean;
  autoFocus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showCategoryBadges?: boolean;
  maxSuggestions?: number;
}

export default function SmartSearchBar({
  value,
  onChange,
  placeholder = 'Type to search anything...',
  className = '',
  inputClassName = '',
  wrapperClassName = '',
  onSelectSuggestion,
  customSuggestions,
  entityFilter,
  disabled = false,
  autoFocus = false,
  size = 'md',
  showCategoryBadges = true,
  maxSuggestions = 8
}: SmartSearchBarProps) {
  const { products, retailers, invoices, orders, categories, suppliers } = useDb();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate matching suggestions
  const suggestions = useMemo(() => {
    const query = (value || '').trim().toLowerCase();
    if (!query) return [];

    const results: SuggestionItem[] = [];
    const seenTitles = new Set<string>();

    // 1. Custom / Local suggestions provided by the caller
    if (customSuggestions && customSuggestions.length > 0) {
      customSuggestions.forEach((item, idx) => {
        if (typeof item === 'string') {
          if (item.toLowerCase().includes(query) && !seenTitles.has(item.toLowerCase())) {
            seenTitles.add(item.toLowerCase());
            results.push({
              id: `custom-${idx}-${item}`,
              title: item,
              category: 'custom',
              badge: 'Suggestion',
              searchValue: item
            });
          }
        } else if (item && typeof item === 'object') {
          const matchTitle = (item.title || '').toLowerCase().includes(query);
          const matchSub = (item.subtitle || '').toLowerCase().includes(query);
          if ((matchTitle || matchSub) && !seenTitles.has(item.title.toLowerCase())) {
            seenTitles.add(item.title.toLowerCase());
            results.push({
              ...item,
              id: item.id || `custom-${idx}`,
              searchValue: item.searchValue || item.title
            });
          }
        }
      });
    }

    const shouldInclude = (type: 'product' | 'retailer' | 'invoice' | 'order' | 'category' | 'supplier') => {
      if (!entityFilter || entityFilter.length === 0) return true;
      return entityFilter.includes(type);
    };

    // 2. Products
    if (shouldInclude('product') && products) {
      for (const prod of products) {
        if (results.length >= maxSuggestions * 2) break;
        const matchName = (prod.name || '').toLowerCase().includes(query);
        const matchBrand = (prod.brand || '').toLowerCase().includes(query);
        const matchSku = (prod.sku || '').toLowerCase().includes(query);
        const matchBarcode = (prod.barcode || '').toLowerCase().includes(query);
        const matchCode = (prod.product_code || '').toLowerCase().includes(query);

        if ((matchName || matchBrand || matchSku || matchBarcode || matchCode) && !seenTitles.has(prod.name.toLowerCase())) {
          seenTitles.add(prod.name.toLowerCase());
          results.push({
            id: `prod-${prod.id}`,
            title: prod.name,
            subtitle: `MRP: ₹${prod.mrp || 0} • Wholesale: ₹${prod.selling_price} • ${prod.pack_size || prod.trading_unit} • ${prod.brand || 'FMCG'}`,
            category: 'product',
            badge: 'Product',
            data: prod,
            searchValue: prod.name
          });
        }
      }
    }

    // 3. Retailers
    if (shouldInclude('retailer') && retailers) {
      for (const ret of retailers) {
        if (results.length >= maxSuggestions * 2) break;
        const matchShop = (ret.shop_name || '').toLowerCase().includes(query);
        const matchOwner = (ret.owner_name || '').toLowerCase().includes(query);
        const matchCity = (ret.city || '').toLowerCase().includes(query);
        const matchCode = (ret.retailer_code || '').toLowerCase().includes(query);
        const matchMobile = (ret.mobile || '').toLowerCase().includes(query);

        if ((matchShop || matchOwner || matchCity || matchCode || matchMobile) && !seenTitles.has(ret.shop_name.toLowerCase())) {
          seenTitles.add(ret.shop_name.toLowerCase());
          results.push({
            id: `ret-${ret.id}`,
            title: ret.shop_name,
            subtitle: `${ret.owner_name} • ${ret.city || 'MH'} • Mob: ${ret.mobile}`,
            category: 'retailer',
            badge: 'Retailer',
            data: ret,
            searchValue: ret.shop_name
          });
        }
      }
    }

    // 4. Invoices
    if (shouldInclude('invoice') && invoices) {
      for (const inv of invoices) {
        if (results.length >= maxSuggestions * 2) break;
        const matchNum = (inv.invoice_number || '').toLowerCase().includes(query);
        if (matchNum && !seenTitles.has(inv.invoice_number.toLowerCase())) {
          seenTitles.add(inv.invoice_number.toLowerCase());
          const ret = retailers?.find(r => r.id === inv.retailer_id);
          results.push({
            id: `inv-${inv.id}`,
            title: inv.invoice_number,
            subtitle: `${ret?.shop_name || 'Retailer'} • ₹${inv.grand_total.toLocaleString('en-IN')} • ${inv.outstanding_amount <= 0 ? 'Paid' : 'Unpaid'}`,
            category: 'invoice',
            badge: 'Invoice',
            data: inv,
            searchValue: inv.invoice_number
          });
        }
      }
    }

    // 5. Orders
    if (shouldInclude('order') && orders) {
      for (const ord of orders) {
        if (results.length >= maxSuggestions * 2) break;
        const matchNum = (ord.order_number || '').toLowerCase().includes(query);
        if (matchNum && !seenTitles.has(ord.order_number.toLowerCase())) {
          seenTitles.add(ord.order_number.toLowerCase());
          const ret = retailers?.find(r => r.id === ord.retailer_id);
          results.push({
            id: `ord-${ord.id}`,
            title: ord.order_number,
            subtitle: `${ret?.shop_name || 'Retailer'} • ${ord.status} • ₹${ord.total_amount.toLocaleString('en-IN')}`,
            category: 'order',
            badge: 'Order',
            data: ord,
            searchValue: ord.order_number
          });
        }
      }
    }

    // 6. Categories
    if (shouldInclude('category') && categories) {
      for (const cat of categories) {
        if (results.length >= maxSuggestions * 2) break;
        const matchCat = (cat.name || '').toLowerCase().includes(query);
        if (matchCat && !seenTitles.has(`cat-${cat.name.toLowerCase()}`)) {
          seenTitles.add(`cat-${cat.name.toLowerCase()}`);
          results.push({
            id: `cat-${cat.id}`,
            title: cat.name,
            subtitle: cat.description || 'Product Category',
            category: 'category',
            badge: 'Category',
            data: cat,
            searchValue: cat.name
          });
        }
      }
    }

    // 7. Suppliers
    if (shouldInclude('supplier') && suppliers) {
      for (const sup of suppliers) {
        if (results.length >= maxSuggestions * 2) break;
        const matchSup = (sup.name || '').toLowerCase().includes(query);
        if (matchSup && !seenTitles.has(sup.name.toLowerCase())) {
          seenTitles.add(sup.name.toLowerCase());
          results.push({
            id: `sup-${sup.id}`,
            title: sup.name,
            subtitle: `GSTIN: ${sup.gstin || 'N/A'} • ${sup.address || 'Supplier'}`,
            category: 'supplier',
            badge: 'Supplier',
            data: sup,
            searchValue: sup.name
          });
        }
      }
    }

    return results.slice(0, maxSuggestions);
  }, [value, customSuggestions, entityFilter, products, retailers, invoices, orders, categories, suppliers, maxSuggestions]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSelect = (item: SuggestionItem) => {
    const textToFill = item.searchValue || item.title;
    onChange(textToFill);
    setIsOpen(false);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Helper to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return text;
    const q = query.trim().toLowerCase();
    const index = text.toLowerCase().indexOf(q);
    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + q.length);
    const after = text.substring(index + q.length);

    return (
      <>
        {before}
        <span className="bg-indigo-100 text-indigo-900 font-extrabold px-0.5 rounded">
          {match}
        </span>
        {after}
      </>
    );
  };

  // Category Icon & Color Mapping
  const getCategoryBadge = (cat: SuggestionItem['category']) => {
    switch (cat) {
      case 'product':
        return {
          icon: Package,
          bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Product'
        };
      case 'retailer':
        return {
          icon: Store,
          bgColor: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'Retailer'
        };
      case 'invoice':
        return {
          icon: FileText,
          bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          label: 'Invoice'
        };
      case 'order':
        return {
          icon: ShoppingCart,
          bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
          label: 'Order'
        };
      case 'category':
        return {
          icon: Tag,
          bgColor: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'Category'
        };
      case 'supplier':
        return {
          icon: Store,
          bgColor: 'bg-slate-100 text-slate-700 border-slate-200',
          label: 'Supplier'
        };
      default:
        return {
          icon: Sparkles,
          bgColor: 'bg-slate-100 text-slate-600 border-slate-200',
          label: 'Result'
        };
    }
  };

  const sizeClasses = {
    sm: 'py-1.5 pl-8 pr-7 text-xs',
    md: 'py-2 pl-9 pr-8 text-xs',
    lg: 'py-2.5 pl-10 pr-9 text-sm'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5 left-2.5',
    md: 'w-4 h-4 left-3',
    lg: 'w-4.5 h-4.5 left-3.5'
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${wrapperClassName}`}>
      {/* Search Input Container */}
      <div className="relative w-full flex items-center">
        <Search className={`absolute text-slate-400 pointer-events-none ${iconSizes[size]}`} />
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-250 focus:border-indigo-500 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all ${sizeClasses[size]} ${inputClassName}`}
        />

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && value.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header Tag */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-extrabold uppercase text-slate-500 tracking-wider">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <Sparkles className="w-3.5 h-3.5" />
              Live Suggestions ({suggestions.length})
            </span>
            <span className="text-xs text-slate-500 font-semibold lowercase">
              press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">↑</kbd> <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">↓</kbd> or click to fill
            </span>
          </div>

          {/* Suggestions List */}
          {suggestions.length === 0 ? (
            <div className="p-5 text-center text-slate-500 text-xs space-y-1">
              <p className="font-semibold text-slate-700">No suggestions matching &quot;{value}&quot;</p>
              <p className="text-xs text-slate-400">Keep typing to refine your search</p>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 p-1">
              {suggestions.map((item, index) => {
                const badgeInfo = getCategoryBadge(item.category);
                const IconComponent = badgeInfo.icon;
                const isSelected = selectedIndex === index;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/90 text-indigo-950 ring-1 ring-indigo-200 font-bold' 
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-lg border shrink-0 ${badgeInfo.bgColor}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold leading-snug truncate">
                          {highlightMatch(item.title, value)}
                        </div>
                        {item.subtitle && (
                          <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Tag & Enter Indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showCategoryBadges && (
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${badgeInfo.bgColor}`}>
                          {item.badge || badgeInfo.label}
                        </span>
                      )}
                      <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tip: Click any suggestion to instantly filter the view</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
            >
              Close suggestions
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
