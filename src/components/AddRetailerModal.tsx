'use client';

import React, { useState, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { Retailer } from '@/lib/db';
import { Store, User, Phone, MapPin, Building, CreditCard, ShieldCheck, X, Check, AlertCircle, Sparkles } from 'lucide-react';

interface AddRetailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newRetailer: Retailer) => void;
  initialData?: Retailer | null;
  isQuickAdd?: boolean;
  defaultCity?: string;
  title?: string;
}

const COMMON_CITIES = ['Indore', 'Mumbai', 'Bhopal', 'Ujjain', 'Dewas', 'Thane', 'Navi Mumbai', 'Pune'];

export default function AddRetailerModal({
  isOpen,
  onClose,
  onSuccess,
  initialData = null,
  isQuickAdd = false,
  defaultCity = 'Indore',
  title
}: AddRetailerModalProps) {
  const { createRetailer, updateRetailer, retailers, categories } = useDb();

  const isEditing = Boolean(initialData && initialData.id);

  // Form states
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [customCity, setCustomCity] = useState('');
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('27');
  const [gstin, setGstin] = useState('');
  const [creditLimit, setCreditLimit] = useState('50000');
  const [active, setActive] = useState(true);
  const [categoryAccessMode, setCategoryAccessMode] = useState<'all' | 'custom'>('all');
  const [assignedCategoryIds, setAssignedCategoryIds] = useState<string[]>([]);

  // Error & loading states
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Suggested code preview
  const [nextCodePreview, setNextCodePreview] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setShopName(initialData.shop_name || '');
        setOwnerName(initialData.owner_name || '');
        setMobile(initialData.mobile || '');
        if (COMMON_CITIES.includes(initialData.city)) {
          setCity(initialData.city);
          setIsCustomCity(false);
          setCustomCity('');
        } else if (initialData.city) {
          setCity('Other');
          setIsCustomCity(true);
          setCustomCity(initialData.city);
        } else {
          setCity(defaultCity);
          setIsCustomCity(false);
          setCustomCity('');
        }
        setAddress(initialData.address || '');
        setStateCode(initialData.state_code || '27');
        setGstin(initialData.gstin || '');
        setCreditLimit(initialData.credit_limit?.toString() || '50000');
        setActive(initialData.active !== undefined ? initialData.active : true);
        setCategoryAccessMode(initialData.category_access_mode || 'all');
        setAssignedCategoryIds(Array.isArray(initialData.assigned_category_ids) ? initialData.assigned_category_ids : []);
        setNextCodePreview(initialData.retailer_code || '');
      } else {
        // Reset for new registration
        setShopName('');
        setOwnerName('');
        setMobile('');
        setCity(defaultCity);
        setIsCustomCity(false);
        setCustomCity('');
        setAddress('');
        setStateCode('27');
        setGstin('');
        setCreditLimit(isQuickAdd ? '25000' : '50000');
        setActive(true);
        setCategoryAccessMode('all');
        setAssignedCategoryIds([]);

        // Preview next code
        let maxNum = 124;
        retailers.forEach(r => {
          const match = r.retailer_code?.match(/RET-0*(\d+)/i);
          if (match && match[1]) {
            const n = parseInt(match[1], 10);
            if (n > maxNum) maxNum = n;
          }
        });
        setNextCodePreview(`RET-${String(maxNum + 1).padStart(5, '0')}`);
      }
      setErrors({});
      setSubmitting(false);
    }
  }, [isOpen, initialData, defaultCity, isQuickAdd, retailers]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!shopName.trim()) {
      newErrors.shopName = 'Shop Name / Business Name is required';
    }

    if (!ownerName.trim()) {
      newErrors.ownerName = 'Owner / Contact Person Name is required';
    }

    const cleanMobile = mobile.trim().replace(/\D/g, '');
    if (!cleanMobile) {
      newErrors.mobile = 'Mobile phone number is required';
    } else if (cleanMobile.length < 10) {
      newErrors.mobile = 'Please enter a valid 10-digit mobile number';
    }

    const effectiveCity = isCustomCity ? customCity.trim() : city.trim();
    if (!effectiveCity) {
      newErrors.city = 'City / Region is required';
    }

    if (!address.trim()) {
      newErrors.address = 'Shop address is required';
    }

    if (gstin.trim()) {
      const gstinVal = gstin.trim().toUpperCase();
      if (gstinVal.length !== 15) {
        newErrors.gstin = 'GSTIN must be 15 characters (or leave empty if unregistered)';
      }
    }

    const limitNum = parseFloat(creditLimit);
    if (isNaN(limitNum) || limitNum < 0) {
      newErrors.creditLimit = 'Please enter a valid positive credit limit amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const effectiveCity = isCustomCity ? customCity.trim() : city.trim();
      const parsedCreditLimit = parseFloat(creditLimit) || 50000;

      if (isEditing && initialData) {
        const updated = updateRetailer(initialData.id, {
          shop_name: shopName.trim(),
          owner_name: ownerName.trim(),
          mobile: mobile.trim(),
          city: effectiveCity,
          address: address.trim(),
          state_code: stateCode.trim() || '27',
          gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
          credit_limit: parsedCreditLimit,
          active,
          category_access_mode: categoryAccessMode,
          assigned_category_ids: categoryAccessMode === 'all' ? [] : assignedCategoryIds
        });

        if (updated) {
          onSuccess?.(updated);
          onClose();
        }
      } else {
        const created = createRetailer({
          shop_name: shopName.trim(),
          owner_name: ownerName.trim(),
          mobile: mobile.trim(),
          city: effectiveCity,
          address: address.trim(),
          state_code: stateCode.trim() || '27',
          gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
          credit_limit: parsedCreditLimit,
          active,
          category_access_mode: categoryAccessMode,
          assigned_category_ids: categoryAccessMode === 'all' ? [] : assignedCategoryIds
        });

        if (created) {
          onSuccess?.(created);
          onClose();
        }
      }
    } catch (err: any) {
      setErrors(prev => ({ ...prev, form: err.message || 'Failed to save retailer' }));
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = title || (isEditing ? 'Edit Retailer Profile' : isQuickAdd ? 'Quick Register Walk-in Customer' : 'Register New Retailer Shop');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/90 flex items-center justify-center text-white shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white leading-tight">{modalTitle}</h3>
                {!isEditing && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    New
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {isEditing ? `Updating ${initialData?.retailer_code || 'Retailer'}` : `Assigned ID: ${nextCodePreview || 'Auto-generated'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {errors.form && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 font-bold text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Shop Name & Owner Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Shop / Business Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Balaji Provisions"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className={`w-full bg-white border ${errors.shopName ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all`}
                  autoFocus
                />
              </div>
              {errors.shopName && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.shopName}</p>}
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Owner / Contact Person <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Rajesh Kumar"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className={`w-full bg-white border ${errors.ownerName ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all`}
                />
              </div>
              {errors.ownerName && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.ownerName}</p>}
            </div>
          </div>

          {/* Mobile & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Mobile Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="e.g. 9820012345"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  className={`w-full bg-white border ${errors.mobile ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono`}
                />
              </div>
              {errors.mobile && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.mobile}</p>}
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                City / Region <span className="text-red-500">*</span>
              </label>
              {!isCustomCity ? (
                <div className="flex gap-1.5">
                  <select
                    value={city}
                    onChange={(e) => {
                      if (e.target.value === 'Other') {
                        setIsCustomCity(true);
                        setCustomCity('');
                      } else {
                        setCity(e.target.value);
                      }
                    }}
                    className="flex-1 bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 outline-none"
                  >
                    {COMMON_CITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Other">+ Custom / Other City...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Enter city name..."
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    className={`flex-1 bg-white border ${errors.city ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCity(false);
                      setCity(COMMON_CITIES[0]);
                    }}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg text-xs font-bold"
                  >
                    Preset
                  </button>
                </div>
              )}
              {errors.city && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.city}</p>}
            </div>
          </div>

          {/* Shop Address */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Shop Street Address / Landmark <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Shop 4, Sector 15, Near Station Road..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`w-full bg-white border ${errors.address ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none`}
            />
            {errors.address && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.address}</p>}
          </div>

          {/* GSTIN & State Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                GSTIN <span className="text-slate-400 font-normal text-[11px]">(Optional for unregistered)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 27ABCDE1234F1Z5"
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className={`w-full bg-white border ${errors.gstin ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 outline-none uppercase font-mono`}
              />
              {errors.gstin && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.gstin}</p>}
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                GST State Code
              </label>
              <input
                type="text"
                placeholder="27 (Maharashtra)"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 outline-none font-mono"
              />
            </div>
          </div>

          {/* Credit Limit & Active status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Purchase Credit Limit (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-400 text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="50000"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className={`w-full bg-white border ${errors.creditLimit ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-250'} rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 outline-none`}
                />
              </div>
              {errors.creditLimit && <p className="text-[11px] text-red-500 font-semibold mt-1">{errors.creditLimit}</p>}
            </div>

            <div className="flex flex-col justify-center">
              <label className="block text-slate-700 font-bold mb-1.5">Account Status</label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  {active ? 'Active Customer (Can Place Orders)' : 'Inactive / Blocked Account'}
                </span>
              </label>
            </div>
          </div>

          {/* Category Access / Product Visibility Section */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-700 font-bold">
                  Assigned Product Categories
                </label>
                <p className="text-[11px] text-slate-500 font-normal">
                  Control which product categories this retailer can order from.
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCategoryAccessMode('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    categoryAccessMode === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Categories
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryAccessMode('custom')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    categoryAccessMode === 'custom'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Custom ({assignedCategoryIds.length})
                </button>
              </div>
            </div>

            {categoryAccessMode === 'custom' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 animate-in fade-in-50">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">Select Allowed Categories:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignedCategoryIds(categories.filter(c => c.active).map(c => c.id))}
                      className="text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignedCategoryIds([])}
                      className="text-slate-500 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                  {categories.length === 0 ? (
                    <span className="text-slate-400 text-xs italic">No categories created yet.</span>
                  ) : (
                    categories.map(c => {
                      const isSelected = assignedCategoryIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAssignedCategoryIds(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? <Check className="w-3 h-3" /> : null}
                          <span>{c.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs shadow-md shadow-indigo-900/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : isQuickAdd ? 'Add & Select Customer' : 'Register Retailer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
