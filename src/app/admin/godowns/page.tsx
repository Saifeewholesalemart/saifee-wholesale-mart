'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Warehouse, Plus, MapPin, Phone, User, CheckCircle2, 
  AlertCircle, Edit2, Star, ArrowRight, ArrowLeftRight, 
  Package, Boxes, TrendingUp, ShieldCheck, Search
} from 'lucide-react';
import Link from 'next/link';

export default function GodownsPage() {
  const { 
    godowns, 
    activeCompany, 
    inventory, 
    products, 
    createGodown, 
    updateGodown, 
    setDefaultGodown, 
    toggleGodownStatus, 
    setSelectedGodownId 
  } = useDb();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGodownId, setEditingGodownId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState('');

  // Calculate stats for a godown
  const getGodownStats = (godownId: string) => {
    const godownInv = inventory.filter(i => i.godown_id === godownId);
    let totalPhysical = 0;
    let totalReserved = 0;
    let totalValue = 0;
    let inStockSkuCount = 0;

    godownInv.forEach(inv => {
      if (inv.physical_qty > 0) {
        inStockSkuCount++;
        totalPhysical += inv.physical_qty;
        totalReserved += (inv.reserved_qty || 0);

        const prod = products.find(p => p.id === inv.product_id);
        const unitsPerPack = prod?.units_per_box_carton || 1;
        const purchasePrice = prod?.purchase_price || 0;
        const unitCost = purchasePrice / unitsPerPack;
        totalValue += inv.physical_qty * unitCost;
      }
    });

    return {
      skuCount: inStockSkuCount,
      totalPhysical,
      totalReserved,
      totalValue: Math.round(totalValue)
    };
  };

  const openCreateModal = () => {
    setFormError('');
    setName('');
    // Auto-generate code
    const nextNum = godowns.length + 1;
    setCode(`GD${String(nextNum).padStart(2, '0')}`);
    setAddress('');
    setCity('Indore');
    setState('Madhya Pradesh');
    setPincode('');
    setManagerName('');
    setPhone('');
    setIsDefault(godowns.length === 0);
    setEditingGodownId(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (g: typeof godowns[0]) => {
    setFormError('');
    setEditingGodownId(g.id);
    setName(g.name);
    setCode(g.code);
    setAddress(g.address || '');
    setCity(g.city || '');
    setState(g.state || '');
    setPincode(g.pincode || '');
    setManagerName(g.manager_name || '');
    setPhone(g.phone || '');
    setIsDefault(g.is_default || false);
    setIsCreateOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Godown name is required.');
      return;
    }
    if (!code.trim()) {
      setFormError('Godown code is required.');
      return;
    }

    try {
      if (editingGodownId) {
        updateGodown(editingGodownId, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          manager_name: managerName.trim(),
          phone: phone.trim(),
          is_default: isDefault
        });
      } else {
        createGodown({
          company_id: activeCompany.id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          manager_name: managerName.trim(),
          phone: phone.trim(),
          is_default: isDefault,
          status: 'Active'
        });
      }
      setIsCreateOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save godown.');
    }
  };

  const filteredGodowns = godowns.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.city && g.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (g.manager_name && g.manager_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalGodownStockValue = godowns.reduce((sum, g) => sum + getGodownStats(g.id).totalValue, 0);
  const activeGodownsCount = godowns.filter(g => g.status === 'Active').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Godowns & Warehouses</h1>
              <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                {activeCompany?.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-warehouse inventory nodes, stock storage locations, and inter-godown logistics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/inventory"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>Inventory Register</span>
          </Link>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Godown</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Godowns</p>
            <p className="text-lg font-black text-slate-900">{godowns.length} Facilities</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Operations</p>
            <p className="text-lg font-black text-emerald-700">{activeGodownsCount} Active</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stored Value</p>
            <p className="text-lg font-black text-slate-900">₹{totalGodownStockValue.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inter-Godown Transfers</p>
            <Link href="/admin/inventory?tab=transfers" className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1 mt-0.5">
              <span>View Transfer Hub</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search godowns by name, code, manager, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 px-2">
          Showing {filteredGodowns.length} of {godowns.length} Godowns
        </div>
      </div>

      {/* Godowns Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredGodowns.map((g) => {
          const stats = getGodownStats(g.id);
          const isPrimary = g.is_default;
          const isActive = g.status === 'Active';

          return (
            <div 
              key={g.id}
              className={`bg-white rounded-2xl border transition-all hover:shadow-md ${
                isPrimary ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shadow-xs ${
                    isPrimary 
                      ? 'bg-indigo-600 text-white shadow-indigo-200' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {g.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">{g.name}</h2>
                      {isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                          <Star className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                          Default Godown
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{g.address ? `${g.address}, ${g.city || ''} ${g.pincode || ''}` : g.city || 'Central Location'}</span>
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {g.status}
                </span>
              </div>

              {/* Godown Quick Metrics */}
              <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 bg-slate-50/50">
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Stocked SKUs</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{stats.skuCount} Products</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Physical Units</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{stats.totalPhysical.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Stored Value</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">₹{stats.totalValue.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Manager & Contact */}
              <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  {g.manager_name && (
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{g.manager_name}</span>
                    </div>
                  )}
                  {g.phone && (
                    <div className="flex items-center gap-1.5 font-medium text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{g.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200/80 rounded-b-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isPrimary && isActive && (
                    <button
                      onClick={() => setDefaultGodown(g.id)}
                      className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>Make Default</span>
                    </button>
                  )}
                  <button
                    onClick={() => toggleGodownStatus(g.id)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      isActive 
                        ? 'text-slate-600 hover:bg-slate-200' 
                        : 'text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(g)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Edit Godown"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  href="/admin/inventory"
                  onClick={() => setSelectedGodownId(g.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  <span>Godown Stock</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredGodowns.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Godowns Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery ? 'No godowns match your search criteria.' : 'Create your first godown facility to start tracking multi-warehouse inventory.'}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
          >
            Add New Godown
          </button>
        </div>
      )}

      {/* Create / Edit Godown Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Warehouse className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold tracking-wide">
                  {editingGodownId ? 'Edit Godown Facility' : 'Add New Godown / Warehouse'}
                </h3>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Godown Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Godown, Secondary Godown"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="GD01"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Physical Address</label>
                <input
                  type="text"
                  placeholder="Plot/Bay number, Industrial Estate"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">City</label>
                  <input
                    type="text"
                    placeholder="Indore"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">State</label>
                  <input
                    type="text"
                    placeholder="Madhya Pradesh"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Pincode</label>
                  <input
                    type="text"
                    placeholder="452001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Manager / In-Charge</label>
                  <input
                    type="text"
                    placeholder="Manager Name"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Contact Mobile</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">Set as Primary Default Godown for this business</span>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all cursor-pointer"
                >
                  {editingGodownId ? 'Update Godown' : 'Create Godown'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
