'use client';

import React, { useState, useMemo } from 'react';
import { useDb } from '@/context/DbContext';
import { Profile, Retailer, Company, Category } from '@/lib/db';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Shield, Store, Smartphone, Building2,
  Tags, Search, Edit, KeyRound, Power, Check, X, Eye, EyeOff,
  AlertCircle, Sparkles, CheckCircle2,
  Phone, MapPin, RefreshCw, AlertTriangle, Layers,
  CreditCard, Filter, UserCog, HardHat, Briefcase, Plus, ChevronDown
} from 'lucide-react';

const COMMON_JOB_ROLES = [
  'Packer',
  'Biller',
  'Tempo Loader',
  'Godown Boy',
  'Floor Supervisor',
  'Dispatch Boy',
  'Inventory Checker',
  'Night Auditor',
  'Gate Security',
  'Accountant'
];

export default function ManageProfilesPage() {
  const {
    profiles, retailers, companies, categories,
    createRetailerProfile, createSalespersonProfile, createStaffProfile,
    updateSalespersonProfile, updateRetailerProfile, updateStaffProfile,
    resetProfilePassword, toggleProfileStatus
  } = useDb();

  const router = useRouter();

  // Top Section Navigation: 'create' | 'all'
  const [activeMainTab, setActiveMainTab] = useState<'create' | 'all'>('all');

  // "Create Profile" Sub-Segment: 'retailer' | 'salesperson' | 'staff'
  const [createProfileType, setCreateProfileType] = useState<'retailer' | 'salesperson' | 'staff'>('retailer');

  // "All Profiles" Sub-Filter: 'all' | 'retailers' | 'salespersons' | 'staff'
  const [directoryFilter, setDirectoryFilter] = useState<'all' | 'retailers' | 'salespersons' | 'staff'>('all');

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // ----------------------------------------------------
  // FORM STATES: RETAILER PROFILE
  // ----------------------------------------------------
  const [retShopName, setRetShopName] = useState('');
  const [retOwnerName, setRetOwnerName] = useState('');
  const [retContactNo, setRetContactNo] = useState('');
  const [retShopAddress, setRetShopAddress] = useState('');
  const [retCity, setRetCity] = useState('Indore');
  const [retPassword, setRetPassword] = useState('');
  const [retShowPassword, setRetShowPassword] = useState(false);
  const [retGstin, setRetGstin] = useState('');
  const [retCreditLimit, setRetCreditLimit] = useState('50000');
  const [retSubmitting, setRetSubmitting] = useState(false);
  const [retErrors, setRetErrors] = useState<{ [key: string]: string }>({});

  // ----------------------------------------------------
  // FORM STATES: SALESPERSON PROFILE
  // ----------------------------------------------------
  const [salesFullName, setSalesFullName] = useState('');
  const [salesContactNo, setSalesContactNo] = useState('');
  const [salesPassword, setSalesPassword] = useState('');
  const [salesShowPassword, setSalesShowPassword] = useState(false);
  const [salesType, setSalesType] = useState<'sales_dist' | 'sales_co'>('sales_dist');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [salesSubmitting, setSalesSubmitting] = useState(false);
  const [salesErrors, setSalesErrors] = useState<{ [key: string]: string }>({});

  // ----------------------------------------------------
  // FORM STATES: STAFF / JOB WORKER PROFILE
  // ----------------------------------------------------
  const [staffFullName, setStaffFullName] = useState('');
  const [staffContactNo, setStaffContactNo] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffShowPassword, setStaffShowPassword] = useState(false);
  const [staffCustomRole, setStaffCustomRole] = useState('Packer');
  const [staffRoleSearch, setStaffRoleSearch] = useState('');
  const [showStaffRoleDropdown, setShowStaffRoleDropdown] = useState(false);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffErrors, setStaffErrors] = useState<{ [key: string]: string }>({});

  // ----------------------------------------------------
  // DIRECTORY SEARCH & STATUS FILTERS
  // ----------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [salesRoleFilter, setSalesRoleFilter] = useState<'all' | 'sales_dist' | 'sales_co'>('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('all');

  // ----------------------------------------------------
  // MODAL STATES (EDIT, RESET PASSWORD, SCOPE, CONFIRM)
  // ----------------------------------------------------
  const [editingRetailer, setEditingRetailer] = useState<Retailer | null>(null);
  const [editingSalesperson, setEditingSalesperson] = useState<Profile | null>(null);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [editStaffRoleSearch, setEditStaffRoleSearch] = useState('');
  const [showEditStaffRoleDropdown, setShowEditStaffRoleDropdown] = useState(false);

  const [resetPwdProfile, setResetPwdProfile] = useState<{ id: string; name: string; roleText: string } | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdModalSubmitting, setPwdModalSubmitting] = useState(false);

  const [confirmStatusModal, setConfirmStatusModal] = useState<{ profileId: string; name: string; currentActive: boolean } | null>(null);
  const [viewScopeModal, setViewScopeModal] = useState<Profile | null>(null);

  // Active Companies & Categories
  const activeCompaniesList = useMemo(() => companies.filter(c => c.active !== false), [companies]);
  const activeCategoriesList = useMemo(() => categories.filter(c => c.active !== false), [categories]);

  // Dynamic list of all existing roles entered in the system + standard defaults
  const allKnownJobRoles = useMemo(() => {
    const rolesSet = new Set<string>(COMMON_JOB_ROLES);
    profiles.forEach(p => {
      if (p.role === 'staff' && p.custom_role) {
        rolesSet.add(p.custom_role.trim());
      }
    });
    return Array.from(rolesSet);
  }, [profiles]);

  // ----------------------------------------------------
  // COMPUTED UNIFIED PROFILES & METRICS
  // ----------------------------------------------------
  const metrics = useMemo(() => {
    const totalRetailers = retailers.length;
    const activeRetailers = retailers.filter(r => r.active).length;
    const salesProfiles = profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co');
    const distSalesCount = salesProfiles.filter(p => p.role === 'sales_dist').length;
    const coSalesCount = salesProfiles.filter(p => p.role === 'sales_co').length;
    const staffProfiles = profiles.filter(p => p.role === 'staff' || p.profile_type === 'STAFF');
    const activeStaffCount = staffProfiles.filter(p => p.active).length;
    const totalProfiles = retailers.length + salesProfiles.length + staffProfiles.length;

    return {
      totalRetailers,
      activeRetailers,
      distSalesCount,
      coSalesCount,
      totalSales: salesProfiles.length,
      totalStaff: staffProfiles.length,
      activeStaffCount,
      totalProfiles
    };
  }, [profiles, retailers]);

  // Unified List of All Directory Items
  type UnifiedProfileRow =
    | { kind: 'retailer'; data: Retailer; profileId: string }
    | { kind: 'salesperson'; data: Profile; profileId: string }
    | { kind: 'staff'; data: Profile; profileId: string };

  const unifiedList = useMemo<UnifiedProfileRow[]>(() => {
    const rows: UnifiedProfileRow[] = [];

    // 1. Retailers
    if (directoryFilter === 'all' || directoryFilter === 'retailers') {
      retailers.forEach(r => {
        const userProfile = profiles.find(p => p.retailer_id === r.id || p.id === r.id);
        rows.push({
          kind: 'retailer',
          data: r,
          profileId: userProfile?.id || r.id
        });
      });
    }

    // 2. Salespersons
    if (directoryFilter === 'all' || directoryFilter === 'salespersons') {
      const sales = profiles.filter(p => p.role === 'sales_dist' || p.role === 'sales_co');
      sales.forEach(s => {
        rows.push({
          kind: 'salesperson',
          data: s,
          profileId: s.id
        });
      });
    }

    // 3. Staff / Job Workers
    if (directoryFilter === 'all' || directoryFilter === 'staff') {
      const staffList = profiles.filter(p => p.role === 'staff' || p.profile_type === 'STAFF');
      staffList.forEach(st => {
        rows.push({
          kind: 'staff',
          data: st,
          profileId: st.id
        });
      });
    }

    return rows;
  }, [retailers, profiles, directoryFilter]);

  // Filtered Directory Rows
  const filteredRows = useMemo(() => {
    return unifiedList.filter(row => {
      // 1. Status filter
      const isActive = row.kind === 'retailer' ? row.data.active : row.data.active;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      // 2. Sales role filter (if on salespersons)
      if (row.kind === 'salesperson' && salesRoleFilter !== 'all') {
        if (row.data.role !== salesRoleFilter) return false;
      }

      // 3. Staff role filter (if filtering by specific staff role)
      if (row.kind === 'staff' && staffRoleFilter !== 'all') {
        if (row.data.custom_role !== staffRoleFilter) return false;
      }

      // 4. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (row.kind === 'retailer') {
          const r = row.data;
          const matchShop = r.shop_name?.toLowerCase().includes(q);
          const matchOwner = r.owner_name?.toLowerCase().includes(q);
          const matchMobile = r.mobile?.toLowerCase().includes(q);
          const matchCode = r.retailer_code?.toLowerCase().includes(q);
          const matchCity = r.city?.toLowerCase().includes(q);
          const matchAddress = r.address?.toLowerCase().includes(q);
          if (!matchShop && !matchOwner && !matchMobile && !matchCode && !matchCity && !matchAddress) {
            return false;
          }
        } else if (row.kind === 'staff') {
          const st = row.data;
          const matchName = (st.full_name || st.name)?.toLowerCase().includes(q);
          const matchMobile = (st.contact_no || st.mobile)?.includes(q);
          const matchRole = st.custom_role?.toLowerCase().includes(q);
          const matchEmail = st.email?.toLowerCase().includes(q);
          if (!matchName && !matchMobile && !matchRole && !matchEmail) return false;
        } else {
          const s = row.data;
          const matchName = s.name?.toLowerCase().includes(q);
          const matchMobile = s.mobile?.toLowerCase().includes(q);
          const matchEmail = s.email?.toLowerCase().includes(q);
          if (!matchName && !matchMobile && !matchEmail) return false;
        }
      }

      return true;
    });
  }, [unifiedList, statusFilter, salesRoleFilter, staffRoleFilter, searchTerm]);

  // ----------------------------------------------------
  // VALIDATION & SUBMISSION: RETAILER
  // ----------------------------------------------------
  const validateRetailerForm = () => {
    const errs: { [key: string]: string } = {};
    if (!retShopName.trim()) errs.shopName = 'Shop Name is required';
    if (!retOwnerName.trim()) errs.ownerName = 'Owner Name is required';

    const cleanMobile = retContactNo.replace(/\D/g, '');
    if (!cleanMobile) {
      errs.contactNo = 'Contact Number is required';
    } else if (cleanMobile.length !== 10) {
      errs.contactNo = 'Contact Number must be exactly 10 digits';
    }

    if (!retShopAddress.trim()) errs.shopAddress = 'Shop Address is required';
    if (!retPassword || retPassword.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setRetErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateRetailerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRetailerForm()) return;

    try {
      setRetSubmitting(true);
      const cleanMobile = retContactNo.replace(/\D/g, '');
      const created = createRetailerProfile({
        shop_name: retShopName.trim(),
        owner_name: retOwnerName.trim(),
        mobile: cleanMobile,
        address: retShopAddress.trim(),
        city: retCity.trim() || 'Indore',
        password: retPassword.trim(),
        gstin: retGstin.trim() ? retGstin.trim().toUpperCase() : undefined,
        credit_limit: parseFloat(retCreditLimit) || 50000
      });

      showToast(`Retailer Profile for "${created.retailer.shop_name}" saved successfully!`, 'success');

      // Reset form
      setRetShopName('');
      setRetOwnerName('');
      setRetContactNo('');
      setRetShopAddress('');
      setRetCity('Indore');
      setRetPassword('');
      setRetGstin('');
      setRetCreditLimit('50000');
      setRetErrors({});

      setActiveMainTab('all');
      setDirectoryFilter('retailers');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create retailer profile', 'error');
    } finally {
      setRetSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // VALIDATION & SUBMISSION: SALESPERSON
  // ----------------------------------------------------
  const validateSalespersonForm = () => {
    const errs: { [key: string]: string } = {};
    if (!salesFullName.trim()) errs.fullName = 'Full Name is required';

    const cleanMobile = salesContactNo.replace(/\D/g, '');
    if (!cleanMobile) {
      errs.contactNo = 'Contact Number is required';
    } else if (cleanMobile.length !== 10) {
      errs.contactNo = 'Contact Number must be exactly 10 digits';
    }

    if (!salesPassword || salesPassword.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (salesType === 'sales_co') {
      if (selectedCompanyIds.length === 0) {
        errs.companies = 'Please select at least one permitted Company / Manufacturer';
      }
      if (selectedCategoryIds.length === 0) {
        errs.categories = 'Please select at least one permitted Product Category';
      }
    }

    setSalesErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSalespersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSalespersonForm()) return;

    try {
      setSalesSubmitting(true);
      const cleanMobile = salesContactNo.replace(/\D/g, '');
      const created = createSalespersonProfile({
        name: salesFullName.trim(),
        mobile: cleanMobile,
        password: salesPassword.trim(),
        role: salesType,
        assigned_company_ids: salesType === 'sales_co' ? selectedCompanyIds : [],
        assigned_category_ids: salesType === 'sales_co' ? selectedCategoryIds : []
      });

      showToast(`Salesperson Profile for "${created.name}" created successfully!`, 'success');

      // Reset form
      setSalesFullName('');
      setSalesContactNo('');
      setSalesPassword('');
      setSalesType('sales_dist');
      setSelectedCompanyIds([]);
      setSelectedCategoryIds([]);
      setSalesErrors({});

      setActiveMainTab('all');
      setDirectoryFilter('salespersons');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create salesperson profile', 'error');
    } finally {
      setSalesSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // VALIDATION & SUBMISSION: STAFF / JOB WORKER
  // ----------------------------------------------------
  const validateStaffForm = () => {
    const errs: { [key: string]: string } = {};
    if (!staffFullName.trim()) errs.fullName = 'Full Name is required';

    const cleanMobile = staffContactNo.replace(/\D/g, '');
    if (!cleanMobile) {
      errs.contactNo = 'Contact Number is required';
    } else if (cleanMobile.length !== 10) {
      errs.contactNo = 'Contact Number must be exactly 10 digits';
    }

    if (!staffPassword || staffPassword.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (!staffCustomRole.trim()) {
      errs.customRole = 'Job Role / Designation is required';
    }

    setStaffErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStaffForm()) return;

    try {
      setStaffSubmitting(true);
      const cleanMobile = staffContactNo.replace(/\D/g, '');
      const created = createStaffProfile({
        full_name: staffFullName.trim(),
        contact_no: cleanMobile,
        password: staffPassword.trim(),
        custom_role: staffCustomRole.trim()
      });

      showToast(`Staff Profile for "${created.full_name || created.name}" (${created.custom_role}) saved successfully!`, 'success');

      // Reset form
      setStaffFullName('');
      setStaffContactNo('');
      setStaffPassword('');
      setStaffCustomRole('Packer');
      setStaffRoleSearch('');
      setShowStaffRoleDropdown(false);
      setStaffErrors({});

      setActiveMainTab('all');
      setDirectoryFilter('staff');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create staff profile', 'error');
    } finally {
      setStaffSubmitting(false);
    }
  };

  // Multi-Select Helpers for Company Rep
  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]
    );
  };

  const selectAllCompanies = () => {
    setSelectedCompanyIds(activeCompaniesList.map(c => c.id));
  };

  const clearAllCompanies = () => {
    setSelectedCompanyIds([]);
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  const selectAllCategories = () => {
    setSelectedCategoryIds(activeCategoriesList.map(c => c.id));
  };

  const clearAllCategories = () => {
    setSelectedCategoryIds([]);
  };

  // ----------------------------------------------------
  // STATUS TOGGLE & PASSWORD RESET HANDLERS
  // ----------------------------------------------------
  const handleToggleStatus = (profileId: string) => {
    try {
      const updated = toggleProfileStatus(profileId);
      if (updated) {
        showToast(`Profile "${updated.name}" is now ${updated.active ? 'Active' : 'Inactive'}.`, 'info');
      } else {
        showToast('Profile status updated.', 'info');
      }
      setConfirmStatusModal(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'error');
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdProfile) return;
    if (newPasswordVal.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      setPwdModalSubmitting(true);
      resetProfilePassword(resetPwdProfile.id, newPasswordVal);
      showToast(`Password for ${resetPwdProfile.name} successfully updated.`, 'success');
      setResetPwdProfile(null);
      setNewPasswordVal('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset password', 'error');
    } finally {
      setPwdModalSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50 text-slate-900 pb-16">

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
              toast.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' :
                'bg-indigo-50 border-indigo-300 text-indigo-900'
            }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ========================================================
            TOP NAVIGATION & METRICS HEADER (STRICTLY "MANAGE PROFILES")
            ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <span>Manage Profiles</span>
                </h1>
                <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
                  Unified user directory, credential storage, and role management for Retailers, Sales Reps, and Warehouse Staff.
                </p>
              </div>
            </div>
          </div>

          {/* Primary Action Tabs: [ + CREATE PROFILE ] | [ ⚙️ ALL PROFILES ] */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveMainTab('create')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${activeMainTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Create Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${activeMainTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>⚙️ All Profiles</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeMainTab === 'all' ? 'bg-indigo-700 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}>
                {metrics.totalProfiles}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Retailers</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{metrics.totalRetailers}</p>
              <span className="text-[10px] text-emerald-600 font-bold">{metrics.activeRetailers} Active</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
              <Store className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dist. Sales</p>
              <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5">{metrics.distSalesCount}</p>
              <span className="text-[9px] font-mono text-indigo-700 font-bold bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                CH_DIST_SALES
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Co. Sales</p>
              <p className="text-xl sm:text-2xl font-black text-purple-600 mt-0.5">{metrics.coSalesCount}</p>
              <span className="text-[9px] font-mono text-purple-700 font-bold bg-purple-50 px-1 py-0.5 rounded border border-purple-100">
                CH_CO_SALES
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Staff / Workers</p>
              <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{metrics.totalStaff}</p>
              <span className="text-[9px] font-mono text-amber-800 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                STAFF_OPS
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
              <HardHat className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Profiles</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{metrics.totalProfiles}</p>
              <span className="text-[10px] text-slate-500 font-medium">Unified Directory</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
              <Shield className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ========================================================
            TAB 1: [ + CREATE PROFILE ]
            ======================================================== */}
        {activeMainTab === 'create' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">

            {/* Profile Type Segment Toggle: 3 OPTIONS */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Select Profile Category to Create
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* 1. Retailer */}
                <button
                  type="button"
                  onClick={() => setCreateProfileType('retailer')}
                  className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all text-left cursor-pointer ${createProfileType === 'retailer'
                      ? 'bg-blue-50/70 border-blue-500 text-slate-900 shadow-xs ring-2 ring-blue-500/20'
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${createProfileType === 'retailer' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
                    }`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>Retailer Profile</span>
                      {createProfileType === 'retailer' && <Check className="w-4 h-4 text-blue-600" />}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed truncate">
                      Shop owner credentials &amp; customer address.
                    </p>
                  </div>
                </button>

                {/* 2. Salesperson */}
                <button
                  type="button"
                  onClick={() => setCreateProfileType('salesperson')}
                  className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all text-left cursor-pointer ${createProfileType === 'salesperson'
                      ? 'bg-indigo-50/70 border-indigo-500 text-slate-900 shadow-xs ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${createProfileType === 'salesperson' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
                    }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>Salesperson Profile</span>
                      {createProfileType === 'salesperson' && <Check className="w-4 h-4 text-indigo-600" />}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed truncate">
                      Distributor or Company field sales reps.
                    </p>
                  </div>
                </button>

                {/* 3. Staff / Job Worker */}
                <button
                  type="button"
                  onClick={() => setCreateProfileType('staff')}
                  className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all text-left cursor-pointer ${createProfileType === 'staff'
                      ? 'bg-amber-50/70 border-amber-500 text-slate-900 shadow-xs ring-2 ring-amber-500/20'
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${createProfileType === 'staff' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
                    }`}>
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>Staff / Worker</span>
                      {createProfileType === 'staff' && <Check className="w-4 h-4 text-amber-600" />}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed truncate">
                      Packers, Billers, Loaders with custom roles.
                    </p>
                  </div>
                </button>

              </div>
            </div>

            {/* ----------------------------------------------------
                FORM A: RETAILER PROFILE
                ---------------------------------------------------- */}
            {createProfileType === 'retailer' && (
              <form onSubmit={handleCreateRetailerSubmit} className="space-y-5 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-widest">
                    RETAILER PROFILE SPECIFICATION
                  </span>
                  <span className="text-xs text-slate-400">* Mandatory fields</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Shop Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Shop Name</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={retShopName}
                      onChange={(e) => setRetShopName(e.target.value)}
                      placeholder="e.g. Mahavir Super Market"
                      className={`w-full bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${retErrors.shopName ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                        }`}
                    />
                    {retErrors.shopName && <p className="text-[11px] text-rose-600 font-semibold">{retErrors.shopName}</p>}
                  </div>

                  {/* 2. Owner / Contact Person */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Owner / Contact Person</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={retOwnerName}
                      onChange={(e) => setRetOwnerName(e.target.value)}
                      placeholder="e.g. Ramesh Chandra Jain"
                      className={`w-full bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${retErrors.ownerName ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                        }`}
                    />
                    {retErrors.ownerName && <p className="text-[11px] text-rose-600 font-semibold">{retErrors.ownerName}</p>}
                  </div>

                  {/* 3. Contact No. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Contact No. (Login ID)</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">10 Digits</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={retContactNo}
                        onChange={(e) => setRetContactNo(e.target.value.replace(/\D/g, ''))}
                        placeholder="9826012345"
                        className={`w-full bg-slate-50 border pl-12 pr-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-semibold ${retErrors.contactNo ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                    </div>
                    {retErrors.contactNo && <p className="text-[11px] text-rose-600 font-semibold">{retErrors.contactNo}</p>}
                  </div>

                  {/* 4. City */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>City / Beat Region</span>
                    </label>
                    <input
                      type="text"
                      value={retCity}
                      onChange={(e) => setRetCity(e.target.value)}
                      placeholder="e.g. Indore, Dewas, Ujjain"
                      className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 5. Shop Address */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Shop Address &amp; Delivery Location</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={retShopAddress}
                      onChange={(e) => setRetShopAddress(e.target.value)}
                      placeholder="e.g. Shop 12, Siyaganj Wholesale Market, Near Tower"
                      className={`w-full bg-slate-50 border px-3.5 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${retErrors.shopAddress ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                        }`}
                    />
                    {retErrors.shopAddress && <p className="text-[11px] text-rose-600 font-semibold">{retErrors.shopAddress}</p>}
                  </div>

                  {/* 6. Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Password</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Min 6 characters</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={retShowPassword ? 'text' : 'password'}
                        value={retPassword}
                        onChange={(e) => setRetPassword(e.target.value)}
                        placeholder="Create retailer login password"
                        className={`w-full bg-slate-50 border px-3.5 py-2.5 pr-10 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${retErrors.password ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setRetShowPassword(!retShowPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {retShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {retErrors.password && <p className="text-[11px] text-rose-600 font-semibold">{retErrors.password}</p>}
                  </div>

                  {/* 7. GSTIN */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>GSTIN (Optional)</span>
                      <span className="text-[10px] text-slate-400">15-char code</span>
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={retGstin}
                      onChange={(e) => setRetGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 23AABCR1234F1Z1"
                      className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRetShopName('');
                      setRetOwnerName('');
                      setRetContactNo('');
                      setRetShopAddress('');
                      setRetPassword('');
                      setRetGstin('');
                      setRetErrors({});
                    }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Reset Fields
                  </button>
                  <button
                    type="submit"
                    disabled={retSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{retSubmitting ? 'Saving Retailer...' : 'Save Retailer Profile'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ----------------------------------------------------
                FORM B: SALESPERSON PROFILE
                ---------------------------------------------------- */}
            {createProfileType === 'salesperson' && (
              <form onSubmit={handleCreateSalespersonSubmit} className="space-y-5 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-widest">
                    SALESPERSON PROFILE SPECIFICATION
                  </span>
                  <span className="text-xs text-slate-400">* Mandatory fields</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Full Name</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={salesFullName}
                      onChange={(e) => setSalesFullName(e.target.value)}
                      placeholder="e.g. Suresh N. Sharma"
                      className={`w-full bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${salesErrors.fullName ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                        }`}
                    />
                    {salesErrors.fullName && <p className="text-[11px] text-rose-600 font-semibold">{salesErrors.fullName}</p>}
                  </div>

                  {/* 2. Contact No. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Contact No. (Login ID)</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">10 Digits</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={salesContactNo}
                        onChange={(e) => setSalesContactNo(e.target.value.replace(/\D/g, ''))}
                        placeholder="9826198765"
                        className={`w-full bg-slate-50 border pl-12 pr-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold ${salesErrors.contactNo ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                    </div>
                    {salesErrors.contactNo && <p className="text-[11px] text-rose-600 font-semibold">{salesErrors.contactNo}</p>}
                  </div>

                  {/* 3. Password */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Password</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Min 6 characters</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={salesShowPassword ? 'text' : 'password'}
                        value={salesPassword}
                        onChange={(e) => setSalesPassword(e.target.value)}
                        placeholder="Create salesperson login password"
                        className={`w-full bg-slate-50 border px-3.5 py-2.5 pr-10 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${salesErrors.password ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setSalesShowPassword(!salesShowPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {salesShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {salesErrors.password && <p className="text-[11px] text-rose-600 font-semibold">{salesErrors.password}</p>}
                  </div>
                </div>

                {/* Salesperson Type Selector */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Salesperson Type &amp; Ingestion Channel *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      onClick={() => setSalesType('sales_dist')}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${salesType === 'sales_dist'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                        }`}
                    >
                      <input
                        type="radio"
                        name="salespersonType"
                        checked={salesType === 'sales_dist'}
                        onChange={() => setSalesType('sales_dist')}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">Distributor Salesperson</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                            CH_DIST_SALES
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Full Catalog Access (Scope = ALL). Unrestricted access across all brands.
                        </p>
                      </div>
                    </label>

                    <label
                      onClick={() => setSalesType('sales_co')}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${salesType === 'sales_co'
                          ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                        }`}
                    >
                      <input
                        type="radio"
                        name="salespersonType"
                        checked={salesType === 'sales_co'}
                        onChange={() => setSalesType('sales_co')}
                        className="mt-1 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">Company Salesperson</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                            CH_CO_SALES
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Restricted Ingestion Scope. Locked strictly to assigned manufacturers and categories.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Conditional Company & Category Selectors */}
                {salesType === 'sales_dist' ? (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3 text-indigo-900 shadow-2xs">
                    <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900">
                        Full Catalog Access (Scope = ALL)
                      </h4>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Assigned to all products, companies, and categories (<span className="font-mono text-indigo-800 font-bold">CH_DIST_SALES</span>).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-4 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-purple-900">
                          Mandatory Scope Restriction (Channel: CH_CO_SALES)
                        </h4>
                        <p className="text-xs text-slate-600">
                          This salesperson can strictly view and book orders only for the selected companies and categories.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* 1. Companies */}
                      <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-purple-600" />
                            <span>Select Permitted Companies</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex items-center gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={selectAllCompanies}
                              className="text-purple-600 hover:text-purple-800 font-bold cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={clearAllCompanies}
                              className="text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            placeholder="Filter companies..."
                            className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {activeCompaniesList
                            .filter(c => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()))
                            .map(c => {
                              const isSelected = selectedCompanyIds.includes(c.id);
                              return (
                                <label
                                  key={c.id}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${isSelected
                                      ? 'bg-purple-50 text-purple-900 border border-purple-300 font-bold'
                                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                    }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleCompanySelection(c.id)}
                                      className="rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    <span>{c.name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">{c.code}</span>
                                </label>
                              );
                            })}
                        </div>
                        {salesErrors.companies && <p className="text-[11px] text-rose-600 font-semibold">{salesErrors.companies}</p>}
                      </div>

                      {/* 2. Categories */}
                      <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            <Tags className="w-3.5 h-3.5 text-purple-600" />
                            <span>Select Permitted Categories</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex items-center gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={selectAllCategories}
                              className="text-purple-600 hover:text-purple-800 font-bold cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={clearAllCategories}
                              className="text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            placeholder="Filter categories..."
                            className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {activeCategoriesList
                            .filter(cat => !categorySearch || cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                            .map(cat => {
                              const isSelected = selectedCategoryIds.includes(cat.id);
                              return (
                                <label
                                  key={cat.id}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${isSelected
                                      ? 'bg-purple-50 text-purple-900 border border-purple-300 font-bold'
                                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                    }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleCategorySelection(cat.id)}
                                      className="rounded text-purple-600 focus:ring-purple-500"
                                    />
                                    <span>{cat.name}</span>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                        {salesErrors.categories && <p className="text-[11px] text-rose-600 font-semibold">{salesErrors.categories}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSalesFullName('');
                      setSalesContactNo('');
                      setSalesPassword('');
                      setSalesType('sales_dist');
                      setSelectedCompanyIds([]);
                      setSelectedCategoryIds([]);
                      setSalesErrors({});
                    }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Reset Fields
                  </button>
                  <button
                    type="submit"
                    disabled={salesSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{salesSubmitting ? 'Saving Salesperson...' : 'Save Salesperson Profile'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ----------------------------------------------------
                FORM C: STAFF / JOB WORKER PROFILE (CUSTOM ROLES)
                ---------------------------------------------------- */}
            {createProfileType === 'staff' && (
              <form onSubmit={handleCreateStaffSubmit} className="space-y-5 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-widest">
                    STAFF / JOB WORKER SPECIFICATION
                  </span>
                  <span className="text-xs text-slate-400">* Mandatory fields</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Full Name / Worker Name</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={staffFullName}
                      onChange={(e) => setStaffFullName(e.target.value)}
                      placeholder="e.g. Ramesh Solanki, Mukesh Yadav"
                      className={`w-full bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${staffErrors.fullName ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                        }`}
                    />
                    {staffErrors.fullName && <p className="text-[11px] text-rose-600 font-semibold">{staffErrors.fullName}</p>}
                  </div>

                  {/* 2. Contact No. */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Contact No. (Login ID)</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">10 Digits</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={staffContactNo}
                        onChange={(e) => setStaffContactNo(e.target.value.replace(/\D/g, ''))}
                        placeholder="9826660001"
                        className={`w-full bg-slate-50 border pl-12 pr-3.5 py-2.5 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-semibold ${staffErrors.contactNo ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                    </div>
                    {staffErrors.contactNo && <p className="text-[11px] text-rose-600 font-semibold">{staffErrors.contactNo}</p>}
                  </div>

                  {/* 3. Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Password</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Min 6 characters</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={staffShowPassword ? 'text' : 'password'}
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="Create staff login password"
                        className={`w-full bg-slate-50 border px-3.5 py-2.5 pr-10 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${staffErrors.password ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setStaffShowPassword(!staffShowPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {staffShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {staffErrors.password && <p className="text-[11px] text-rose-600 font-semibold">{staffErrors.password}</p>}
                  </div>

                  {/* 4. Flexible Dynamic Creatable Role Input */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>Job Role / Designation</span>
                        <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                        Type or Select Any Role
                      </span>
                    </label>
                    
                    <div className="relative">
                      <input
                        type="text"
                        value={staffCustomRole}
                        onChange={(e) => {
                          setStaffCustomRole(e.target.value);
                          setStaffRoleSearch(e.target.value);
                          setShowStaffRoleDropdown(true);
                        }}
                        onFocus={() => setShowStaffRoleDropdown(true)}
                        placeholder="Type any role (e.g. Packer, Biller, Loader...)"
                        className={`w-full bg-slate-50 border px-3.5 py-2.5 pr-10 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold ${staffErrors.customRole ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-300'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffRoleDropdown(!showStaffRoleDropdown)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Creatable Combobox Dropdown */}
                    {showStaffRoleDropdown && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          Suggested / Existing Roles
                        </div>
                        {allKnownJobRoles
                          .filter(r => !staffRoleSearch || r.toLowerCase().includes(staffRoleSearch.toLowerCase()))
                          .map((roleName) => (
                            <button
                              key={roleName}
                              type="button"
                              onClick={() => {
                                setStaffCustomRole(roleName);
                                setShowStaffRoleDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${staffCustomRole.toLowerCase() === roleName.toLowerCase()
                                  ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200'
                                  : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                              <span>{roleName}</span>
                              {staffCustomRole.toLowerCase() === roleName.toLowerCase() && (
                                <Check className="w-3.5 h-3.5 text-amber-600" />
                              )}
                            </button>
                          ))}

                        {staffRoleSearch && !allKnownJobRoles.some(r => r.toLowerCase() === staffRoleSearch.toLowerCase().trim()) && (
                          <button
                            type="button"
                            onClick={() => {
                              setStaffCustomRole(staffRoleSearch.trim());
                              setShowStaffRoleDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create new role &quot;{staffRoleSearch.trim()}&quot;</span>
                          </button>
                        )}
                      </div>
                    )}

                    {staffErrors.customRole && <p className="text-[11px] text-rose-600 font-semibold">{staffErrors.customRole}</p>}

                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {COMMON_JOB_ROLES.slice(0, 6).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setStaffCustomRole(role);
                            setShowStaffRoleDropdown(false);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${staffCustomRole.toLowerCase() === role.toLowerCase()
                              ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                            }`}
                        >
                          + {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setStaffFullName('');
                      setStaffContactNo('');
                      setStaffPassword('');
                      setStaffCustomRole('Packer');
                      setStaffErrors({});
                    }}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Reset Fields
                  </button>
                  <button
                    type="submit"
                    disabled={staffSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{staffSubmitting ? 'Saving Staff Profile...' : 'Save Staff Profile'}</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

        {/* ========================================================
            TAB 2: [ ⚙️ ALL PROFILES DIRECTORY ]
            ======================================================== */}
        {activeMainTab === 'all' && (
          <div className="space-y-4">

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
              
              {/* Filter Sub-Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setDirectoryFilter('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${directoryFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  All Profiles ({metrics.totalProfiles})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryFilter('retailers')}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${directoryFilter === 'retailers'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  Retailers ({metrics.totalRetailers})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryFilter('salespersons')}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${directoryFilter === 'salespersons'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  Salespersons ({metrics.totalSales})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryFilter('staff')}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${directoryFilter === 'staff'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  Staff / Workers ({metrics.totalStaff})
                </button>
              </div>

              {/* Search & Secondary Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search name, shop, role, mobile..."
                    className="w-full bg-slate-50 border border-slate-300 pl-9 pr-3.5 py-2 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>

                {/* Role Specific Filters */}
                {directoryFilter === 'salespersons' && (
                  <select
                    value={salesRoleFilter}
                    onChange={(e: any) => setSalesRoleFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Sales Roles</option>
                    <option value="sales_dist">Distributor Reps (CH_DIST_SALES)</option>
                    <option value="sales_co">Company Reps (CH_CO_SALES)</option>
                  </select>
                )}

                {directoryFilter === 'staff' && (
                  <select
                    value={staffRoleFilter}
                    onChange={(e: any) => setStaffRoleFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="all">All Staff Roles</option>
                    {allKnownJobRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
              </div>

            </div>

            {/* Unified Profiles Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Name / Identity</th>
                      <th className="py-3 px-4">Type / Role</th>
                      <th className="py-3 px-4">Contact / Login ID</th>
                      <th className="py-3 px-4">Address / Scope</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-medium text-sm">No profiles found</p>
                          <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or create a new profile.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        if (row.kind === 'retailer') {
                          const r = row.data;
                          return (
                            <tr
                              key={`ret-${r.id}`}
                              className="hover:bg-slate-50/70 transition-colors text-slate-700"
                            >
                              {/* 1. Name / Identity */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 font-bold">
                                    <Store className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-black text-slate-900 block">{r.shop_name}</span>
                                    <span className="text-[11px] text-slate-500 font-medium">{r.owner_name}</span>
                                    <span className="text-[10px] font-mono text-slate-400 ml-1.5 font-bold">{r.retailer_code || r.id}</span>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Type / Role */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                  <Store className="w-3 h-3" />
                                  <span>Retailer</span>
                                </span>
                              </td>

                              {/* 3. Contact */}
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {r.mobile}
                              </td>

                              {/* 4. Address / Scope */}
                              <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                                <span>{r.address}</span>
                                {r.city && <span className="text-[10px] text-slate-400 block font-medium">{r.city}</span>}
                              </td>

                              {/* 5. Status */}
                              <td className="py-3.5 px-4">
                                {r.active ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Inactive
                                  </span>
                                )}
                              </td>

                              {/* 6. Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit */}
                                  <button
                                    type="button"
                                    onClick={() => setEditingRetailer(r)}
                                    title="Edit Retailer Profile"
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Reset Password */}
                                  <button
                                    type="button"
                                    onClick={() => setResetPwdProfile({
                                      id: row.profileId,
                                      name: `${r.shop_name} (${r.owner_name})`,
                                      roleText: 'Retailer Account'
                                    })}
                                    title="Reset Password"
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Deactivate / Activate */}
                                  <button
                                    type="button"
                                    onClick={() => setConfirmStatusModal({
                                      profileId: row.profileId,
                                      name: r.shop_name,
                                      currentActive: r.active
                                    })}
                                    title={r.active ? 'Deactivate Retailer' : 'Activate Retailer'}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer shadow-2xs ${r.active
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                                      }`}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else if (row.kind === 'staff') {
                          const st = row.data;
                          return (
                            <tr
                              key={`st-${st.id}`}
                              className="hover:bg-slate-50/70 transition-colors text-slate-700"
                            >
                              {/* 1. Name / Identity */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 font-bold">
                                    <HardHat className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-black text-slate-900 block">{st.full_name || st.name}</span>
                                    <span className="text-[10px] font-mono text-slate-400">ID: {st.id}</span>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Type / Role */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                  <HardHat className="w-3 h-3 text-amber-600" />
                                  <span>Staff: {st.custom_role || 'Staff Worker'}</span>
                                </span>
                              </td>

                              {/* 3. Contact */}
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {st.contact_no || st.mobile || 'N/A'}
                              </td>

                              {/* 4. Address / Scope */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  <Briefcase className="w-3 h-3 text-slate-500" />
                                  <span>Internal Ops • {st.custom_role || 'Staff'}</span>
                                </span>
                              </td>

                              {/* 5. Status */}
                              <td className="py-3.5 px-4">
                                {st.active ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Inactive
                                  </span>
                                )}
                              </td>

                              {/* 6. Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingStaff(st);
                                      setEditStaffRoleSearch(st.custom_role || '');
                                    }}
                                    title="Edit Staff Profile"
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Reset Password */}
                                  <button
                                    type="button"
                                    onClick={() => setResetPwdProfile({
                                      id: st.id,
                                      name: `${st.full_name || st.name} (${st.custom_role || 'Staff'})`,
                                      roleText: 'Staff Account'
                                    })}
                                    title="Reset Password"
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Deactivate / Activate */}
                                  <button
                                    type="button"
                                    onClick={() => setConfirmStatusModal({
                                      profileId: st.id,
                                      name: `${st.full_name || st.name} (${st.custom_role || 'Staff'})`,
                                      currentActive: st.active
                                    })}
                                    title={st.active ? 'Deactivate Staff' : 'Activate Staff'}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer shadow-2xs ${st.active
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                                      }`}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          const sp = row.data;
                          const isDist = sp.role === 'sales_dist';
                          const assignedCompanies = sp.assigned_company_ids || (sp.company_id ? [sp.company_id] : []);
                          const assignedCategories = sp.assigned_category_ids || [];

                          return (
                            <tr
                              key={`sp-${sp.id}`}
                              className="hover:bg-slate-50/70 transition-colors text-slate-700"
                            >
                              {/* 1. Name / Identity */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 border ${isDist ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-purple-50 border-purple-200 text-purple-600'
                                    }`}>
                                    {isDist ? <Smartphone className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <span className="font-black text-slate-900 block">{sp.name}</span>
                                    <span className="text-[10px] font-mono text-slate-400">{sp.email || `ID: ${sp.id}`}</span>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Type / Role */}
                              <td className="py-3.5 px-4">
                                {isDist ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      <Smartphone className="w-3 h-3" />
                                      <span>Dist Sales Rep</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 block ml-0.5">CH_DIST_SALES</span>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                                      <Building2 className="w-3 h-3" />
                                      <span>Co. Sales Rep</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 block ml-0.5">CH_CO_SALES</span>
                                  </div>
                                )}
                              </td>

                              {/* 3. Contact */}
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {sp.mobile || 'N/A'}
                              </td>

                              {/* 4. Address / Scope */}
                              <td className="py-3.5 px-4">
                                {isDist ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    <span>Full Catalog (ALL)</span>
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setViewScopeModal(sp)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 cursor-pointer transition-colors"
                                    >
                                      <Layers className="w-3 h-3" />
                                      <span>{assignedCompanies.length} Brands, {assignedCategories.length} Cats</span>
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* 5. Status */}
                              <td className="py-3.5 px-4">
                                {sp.active ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Inactive
                                  </span>
                                )}
                              </td>

                              {/* 6. Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit */}
                                  <button
                                    type="button"
                                    onClick={() => setEditingSalesperson(sp)}
                                    title="Edit Salesperson Scope & Info"
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Reset Password */}
                                  <button
                                    type="button"
                                    onClick={() => setResetPwdProfile({
                                      id: sp.id,
                                      name: sp.name,
                                      roleText: isDist ? 'Distributor Rep (CH_DIST_SALES)' : 'Company Rep (CH_CO_SALES)'
                                    })}
                                    title="Reset Password"
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Deactivate / Activate */}
                                  <button
                                    type="button"
                                    onClick={() => setConfirmStatusModal({
                                      profileId: sp.id,
                                      name: sp.name,
                                      currentActive: sp.active
                                    })}
                                    title={sp.active ? 'Deactivate Salesperson' : 'Activate Salesperson'}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer shadow-2xs ${sp.active
                                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                                      }`}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ========================================================
          MODAL 1: RESET PASSWORD MODAL
          ======================================================== */}
      {resetPwdProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Reset Account Password</h3>
                  <p className="text-xs text-slate-400 font-medium">{resetPwdProfile.roleText}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetPwdProfile(null);
                  setNewPasswordVal('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Profile</span>
              <span className="text-xs font-bold text-slate-900 block mt-0.5">{resetPwdProfile.name}</span>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>New 6-Character Password</span>
                  <span className="text-[10px] text-slate-400">Required</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Enter new 6+ char password"
                    className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 pr-10 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetPwdProfile(null);
                    setNewPasswordVal('');
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdModalSubmitting || newPasswordVal.length < 6}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {pwdModalSubmitting ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: CONFIRM STATUS TOGGLE MODAL
          ======================================================== */}
      {confirmStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Power className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-slate-900">
                {confirmStatusModal.currentActive ? 'Deactivate Profile?' : 'Activate Profile?'}
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to change status for <strong className="text-slate-900">{confirmStatusModal.name}</strong>?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStatusModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleStatus(confirmStatusModal.profileId)}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${confirmStatusModal.currentActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
              >
                {confirmStatusModal.currentActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: EDIT STAFF MODAL
          ======================================================== */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Edit Staff Profile</h3>
                  <p className="text-xs text-slate-400 font-medium">Update name, contact, or custom role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const updated = updateStaffProfile(editingStaff.id, {
                    full_name: editingStaff.full_name || editingStaff.name,
                    contact_no: editingStaff.contact_no || editingStaff.mobile,
                    custom_role: editingStaff.custom_role,
                    active: editingStaff.active
                  });
                  if (updated) {
                    showToast(`Staff profile for "${updated.full_name || updated.name}" updated successfully!`, 'success');
                  }
                  setEditingStaff(null);
                } catch (err: any) {
                  showToast(err?.message || 'Failed to update staff profile', 'error');
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={editingStaff.full_name || editingStaff.name || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Contact Number (10 Digits)</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editingStaff.contact_no || editingStaff.mobile || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, contact_no: e.target.value.replace(/\D/g, ''), mobile: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Custom Job Role / Designation</span>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded">Creatable</span>
                </label>
                <input
                  type="text"
                  value={editingStaff.custom_role || ''}
                  onChange={(e) => {
                    setEditingStaff({ ...editingStaff, custom_role: e.target.value });
                    setEditStaffRoleSearch(e.target.value);
                    setShowEditStaffRoleDropdown(true);
                  }}
                  onFocus={() => setShowEditStaffRoleDropdown(true)}
                  placeholder="e.g. Packer, Biller, Tempo Loader..."
                  className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                {showEditStaffRoleDropdown && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto p-1.5 space-y-1">
                    {allKnownJobRoles
                      .filter(r => !editStaffRoleSearch || r.toLowerCase().includes(editStaffRoleSearch.toLowerCase()))
                      .map((roleName) => (
                        <button
                          key={roleName}
                          type="button"
                          onClick={() => {
                            setEditingStaff({ ...editingStaff, custom_role: roleName });
                            setShowEditStaffRoleDropdown(false);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-700 flex items-center justify-between cursor-pointer"
                        >
                          <span>{roleName}</span>
                          {editingStaff.custom_role === roleName && <Check className="w-3.5 h-3.5 text-amber-600" />}
                        </button>
                      ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COMMON_JOB_ROLES.slice(0, 5).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setEditingStaff({ ...editingStaff, custom_role: role });
                        setShowEditStaffRoleDropdown(false);
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                    >
                      + {role}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: EDIT RETAILER MODAL
          ======================================================== */}
      {editingRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Edit Retailer Profile</h3>
                  <p className="text-xs text-slate-400 font-medium">Update shop master and contact info</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRetailer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const updated = updateRetailerProfile(editingRetailer.id, {
                    shop_name: editingRetailer.shop_name,
                    owner_name: editingRetailer.owner_name,
                    mobile: editingRetailer.mobile,
                    address: editingRetailer.address,
                    city: editingRetailer.city,
                    gstin: editingRetailer.gstin
                  });
                  if (updated) {
                    showToast(`Retailer profile for "${updated.retailer.shop_name}" updated successfully!`, 'success');
                  }
                  setEditingRetailer(null);
                } catch (err: any) {
                  showToast(err?.message || 'Failed to update retailer profile', 'error');
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Shop Name</label>
                  <input
                    type="text"
                    value={editingRetailer.shop_name}
                    onChange={(e) => setEditingRetailer({ ...editingRetailer, shop_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Owner Name</label>
                  <input
                    type="text"
                    value={editingRetailer.owner_name}
                    onChange={(e) => setEditingRetailer({ ...editingRetailer, owner_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Contact Number</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={editingRetailer.mobile}
                    onChange={(e) => setEditingRetailer({ ...editingRetailer, mobile: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">City / Beat</label>
                  <input
                    type="text"
                    value={editingRetailer.city || ''}
                    onChange={(e) => setEditingRetailer({ ...editingRetailer, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Shop Address</label>
                <textarea
                  rows={2}
                  value={editingRetailer.address}
                  onChange={(e) => setEditingRetailer({ ...editingRetailer, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRetailer(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: EDIT SALESPERSON MODAL
          ======================================================== */}
      {editingSalesperson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Edit Salesperson Profile</h3>
                  <p className="text-xs text-slate-400 font-medium">Update name, mobile, or assigned brand/category scope</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSalesperson(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const updated = updateSalespersonProfile(editingSalesperson.id, {
                    name: editingSalesperson.name,
                    mobile: editingSalesperson.mobile,
                    assigned_company_ids: editingSalesperson.assigned_company_ids || [],
                    assigned_category_ids: editingSalesperson.assigned_category_ids || []
                  });
                  if (updated) {
                    showToast(`Salesperson profile for "${updated.name}" updated successfully!`, 'success');
                  }
                  setEditingSalesperson(null);
                } catch (err: any) {
                  showToast(err?.message || 'Failed to update salesperson profile', 'error');
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={editingSalesperson.name}
                  onChange={(e) => setEditingSalesperson({ ...editingSalesperson, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Contact Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editingSalesperson.mobile || ''}
                  onChange={(e) => setEditingSalesperson({ ...editingSalesperson, mobile: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-slate-50 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {editingSalesperson.role === 'sales_co' && (
                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-purple-900 block">Company Scope Restrictions</span>
                  <p className="text-[11px] text-slate-600">
                    Currently assigned to {(editingSalesperson.assigned_company_ids || []).length} brands and {(editingSalesperson.assigned_category_ids || []).length} categories.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSalesperson(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 6: VIEW SALESPERSON SCOPE MODAL
          ======================================================== */}
      {viewScopeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-black text-slate-900">Assigned Scope Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewScopeModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block">Permitted Companies</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(viewScopeModal.assigned_company_ids || (viewScopeModal.company_id ? [viewScopeModal.company_id] : [])).map(cId => {
                    const comp = companies.find(c => c.id === cId);
                    return (
                      <span key={cId} className="px-2 py-1 rounded-md bg-purple-50 text-purple-800 font-bold border border-purple-200">
                        {comp?.name || cId}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block">Permitted Categories</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(viewScopeModal.assigned_category_ids || []).map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    return (
                      <span key={catId} className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
                        {cat?.name || catId}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setViewScopeModal(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
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
