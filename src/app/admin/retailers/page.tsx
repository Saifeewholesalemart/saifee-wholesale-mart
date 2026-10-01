'use client';

import React, { useState, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { Retailer } from '@/lib/db';
import Link from 'next/link';
import { Users, Edit, ShieldAlert, Check, Plus, Store, Phone, MapPin, Building2, CreditCard, Sparkles, AlertTriangle, ShoppingCart, DollarSign } from 'lucide-react';
import SmartSearchBar from '@/components/SmartSearchBar';
import AddRetailerModal from '@/components/AddRetailerModal';

export default function AdminRetailers() {
  const { retailers, refreshState, updateRetailerCreditLimit } = useDb();
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warning' | 'inactive'>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<Retailer | null>(null);

  // Quick Inline Credit Limit Edit states
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickLimitVal, setQuickLimitVal] = useState('');

  // Extract unique cities
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    retailers.forEach(r => {
      if (r.city) cities.add(r.city);
    });
    return Array.from(cities).sort();
  }, [retailers]);

  // Overall metrics calculation
  const metrics = useMemo(() => {
    let totalOutstanding = 0;
    let totalCredit = 0;
    let warningCount = 0;
    let activeCount = 0;

    retailers.forEach(r => {
      totalOutstanding += r.outstanding || 0;
      totalCredit += r.credit_limit || 0;
      if (r.active) activeCount++;
      if (r.outstanding > r.credit_limit) warningCount++;
    });

    return {
      totalCount: retailers.length,
      activeCount,
      warningCount,
      totalOutstanding,
      totalCredit
    };
  }, [retailers]);

  const filteredRetailers = useMemo(() => {
    return retailers.filter(r => {
      // Search
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || (
        (r.shop_name || '').toLowerCase().includes(q) ||
        (r.owner_name || '').toLowerCase().includes(q) ||
        (r.retailer_code || '').toLowerCase().includes(q) ||
        (r.gstin && r.gstin.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.mobile && r.mobile.includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q))
      );

      // City filter
      const matchCity = selectedCity === 'all' || r.city === selectedCity;

      // Status filter
      let matchStatus = true;
      const isExceeded = r.outstanding > r.credit_limit;
      if (statusFilter === 'active') matchStatus = r.active && !isExceeded;
      else if (statusFilter === 'warning') matchStatus = isExceeded;
      else if (statusFilter === 'inactive') matchStatus = !r.active;

      return matchSearch && matchCity && matchStatus;
    });
  }, [retailers, searchTerm, selectedCity, statusFilter]);

  const handleStartQuickEdit = (id: string, currentLimit: number) => {
    setQuickEditId(id);
    setQuickLimitVal(currentLimit.toString());
  };

  const handleSaveQuickEdit = (id: string) => {
    const limit = parseFloat(quickLimitVal);
    if (isNaN(limit) || limit < 0) {
      alert('Please enter a valid credit limit.');
      return;
    }

    updateRetailerCreditLimit(id, limit);
    setQuickEditId(null);
  };

  const handleOpenAddModal = () => {
    setEditingRetailer(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (retailer: Retailer) => {
    setEditingRetailer(retailer);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Customer Master
            </span>
            <span className="text-xs text-slate-400 font-bold">&bull;</span>
            <span className="text-xs text-slate-500 font-semibold">{retailers.length} Registered Accounts</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Retailer Profiles &amp; Limits</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage registered shops, audit purchase credit limits, and add new retailers.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/10 flex items-center justify-center gap-2 transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Retailer</span>
        </button>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Registered Shops</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-black text-slate-900">{metrics.totalCount}</span>
            <span className="text-xs font-bold text-emerald-600">({metrics.activeCount} Active)</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Outstanding Balance</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-black text-red-600">₹{metrics.totalOutstanding.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Credit Extended</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-black text-indigo-700">₹{metrics.totalCredit.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Credit Warning / Over-limit</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className={`text-2xl font-black ${metrics.warningCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {metrics.warningCount}
            </span>
            <span className="text-xs font-bold text-slate-500">accounts</span>
          </div>
        </div>
      </div>

      {/* Retailers Table & Filters Card */}
      <div className="erp-card bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Retailer Directory ({filteredRetailers.length}{filteredRetailers.length !== retailers.length ? ` of ${retailers.length}` : ''})
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* City filter */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="all">All Cities ({uniqueCities.length})</option>
              {uniqueCities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="warning">Credit Warning</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Search */}
            <div className="w-full sm:w-64">
              <SmartSearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search shop, owner, phone, code..."
                entityFilter={['retailer']}
                size="sm"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-table w-full min-w-[700px]">
            <thead>
              <tr>
                <th>Retailer / Shop Details</th>
                <th>Contact &amp; Location</th>
                <th className="text-right">Outstanding Bal</th>
                <th className="text-right">Credit Limit</th>
                <th className="text-right">Available Credit</th>
                <th>Account Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRetailers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-semibold">
                    No retailers matched the current search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRetailers.map(ret => {
                  const limitExceeded = ret.outstanding > ret.credit_limit;
                  const isQuickEditing = quickEditId === ret.id;
                  
                  return (
                    <tr key={ret.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/orders?retailer=${ret.id}`}
                            className="font-extrabold text-slate-900 hover:text-indigo-600 text-sm block leading-tight hover:underline"
                            title="View Orders for this Retailer"
                          >
                            {ret.shop_name}
                          </Link>
                          {!ret.active && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium block mt-0.5">
                          Code: <strong className="text-slate-700 font-bold">{ret.retailer_code}</strong> | GSTIN: {ret.gstin || 'Unregistered'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-slate-800 text-xs block">{ret.owner_name}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                          <span>Mob: <strong className="text-slate-700 font-mono">{ret.mobile}</strong></span>
                          <span>&bull;</span>
                          <span className="text-indigo-600 font-semibold">{ret.city || 'Mumbai'}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate max-w-xs">{ret.address}</span>
                      </td>

                      <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                        <span className={ret.outstanding > 0 ? 'text-red-600 font-mono' : 'text-slate-900 font-mono'}>
                          ₹{ret.outstanding.toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        {isQuickEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              value={quickLimitVal}
                              onChange={(e) => setQuickLimitVal(e.target.value)}
                              className="w-24 border border-slate-300 rounded-lg p-1 text-right font-bold text-xs"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveQuickEdit(ret.id)}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                              title="Save Limit"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 group">
                            <span className="font-bold text-slate-800 text-xs font-mono">₹{ret.credit_limit.toLocaleString('en-IN')}</span>
                            <button
                              onClick={() => handleStartQuickEdit(ret.id, ret.credit_limit)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer opacity-80 group-hover:opacity-100"
                              title="Quick Edit Credit Limit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-black text-sm">
                        <span className={limitExceeded ? 'text-red-600 font-mono' : 'text-emerald-700 font-mono'}>
                          ₹{(ret.credit_limit - ret.outstanding).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase inline-block ${
                          !ret.active 
                            ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                            : limitExceeded 
                              ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {!ret.active ? 'Disabled' : limitExceeded ? 'Credit Warning' : 'Active Account'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/admin/orders?retailer=${ret.id}`}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="View Orders"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Orders</span>
                          </Link>
                          <Link
                            href={`/admin/payments?retailer=${ret.id}`}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer border border-emerald-200"
                            title="View Payment Ledger"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ledger</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(ret)}
                            className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="Edit Full Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
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

      {/* Add & Edit Retailer Modal */}
      <AddRetailerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingRetailer}
        onSuccess={() => {
          refreshState();
        }}
      />
    </div>
  );
}

