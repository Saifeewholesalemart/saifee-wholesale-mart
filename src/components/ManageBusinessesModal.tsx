'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { BusinessCompany } from '@/lib/db';
import { Building2, X, Check, Edit2, Save, Plus, ArrowRight, ShieldCheck, MapPin, Phone, Hash } from 'lucide-react';

interface ManageBusinessesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
}

export function ManageBusinessesModal({ isOpen, onClose, onOpenAddModal }: ManageBusinessesModalProps) {
  const { authorizedCompanies, activeCompanyId, switchCompany, updateBusinessCompany } = useDb();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BusinessCompany>>({});
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleStartEdit = (company: BusinessCompany) => {
    setEditingId(company.id);
    setEditForm({
      name: company.name,
      business_type: company.business_type,
      legal_name: company.legal_name,
      gstin: company.gstin || '',
      phone: company.phone || '',
      city: company.city || '',
      address: company.address || ''
    });
  };

  const handleSaveEdit = (id: string) => {
    setSaving(true);
    updateBusinessCompany(id, editForm);
    setEditingId(null);
    setSaving(false);
  };

  const handleSwitch = async (id: string) => {
    if (id === activeCompanyId) return;
    await switchCompany(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Manage Business Companies</h2>
              <p className="text-xs text-slate-400">View and manage your independent business company workspaces</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Authorized Companies ({authorizedCompanies.length})
            </span>
            <button
              onClick={() => {
                onClose();
                onOpenAddModal();
              }}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Business</span>
            </button>
          </div>

          <div className="space-y-3">
            {authorizedCompanies.map(company => {
              const isActive = company.id === activeCompanyId;
              const isEditing = editingId === company.id;

              return (
                <div
                  key={company.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive 
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800 shadow-sm' 
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Business Name</label>
                          <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Business Type</label>
                          <input
                            type="text"
                            value={editForm.business_type || ''}
                            onChange={e => setEditForm({ ...editForm, business_type: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Legal Entity Name</label>
                          <input
                            type="text"
                            value={editForm.legal_name || ''}
                            onChange={e => setEditForm({ ...editForm, legal_name: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">GSTIN</label>
                          <input
                            type="text"
                            value={editForm.gstin || ''}
                            onChange={e => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                          <input
                            type="text"
                            value={editForm.phone || ''}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">City</label>
                          <input
                            type="text"
                            value={editForm.city || ''}
                            onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(company.id)}
                          disabled={saving}
                          className="px-3.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {company.name}
                          </h3>
                          {isActive && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-700 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Active Workspace
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">
                            {company.business_type || 'General Trading'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {company.gstin && (
                            <span className="flex items-center gap-1 font-mono">
                              <Hash className="w-3 h-3" />
                              GST: {company.gstin}
                            </span>
                          )}
                          {company.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {company.city}
                            </span>
                          )}
                          {company.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {company.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(company)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => handleSwitch(company.id)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 hover:bg-indigo-200/70 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Switch</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-2 py-1">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Multi-tenant data isolation active</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
