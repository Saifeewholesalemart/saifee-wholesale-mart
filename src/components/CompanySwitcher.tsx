'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { 
  Building2, ChevronDown, Check, Plus, Settings2, 
  Store, ShieldCheck, Sparkles, RefreshCw, Layers 
} from 'lucide-react';
import { AddBusinessModal } from './AddBusinessModal';
import { ManageBusinessesModal } from './ManageBusinessesModal';

interface CompanySwitcherProps {
  compactOnMobile?: boolean;
}

export function CompanySwitcher({ compactOnMobile = false }: CompanySwitcherProps) {
  const { 
    activeCompany, 
    activeCompanyId, 
    authorizedCompanies, 
    switchCompany,
    isSwitchingCompany 
  } = useDb();

  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (id: string) => {
    if (id === activeCompanyId) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    await switchCompany(id);
  };

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
            isOpen
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
              : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100'
          }`}
          title="Switch Active Business Workspace"
        >
          {/* Avatar Icon */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            {isSwitchingCompany ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Store className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Company Details */}
          <div className={`text-left ${compactOnMobile ? 'hidden sm:block' : 'block'}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[180px]">
                {activeCompany?.name || 'Saifee General Stores'}
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded uppercase tracking-wider">
                {activeCompany?.business_type?.split(' ')[0] || 'FMCG'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Workspace Active</span>
            </div>
          </div>

          {/* Chevron */}
          <ChevronDown 
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-xs sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Business Workspaces
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {authorizedCompanies.length} available
              </span>
            </div>

            {/* List of Companies */}
            <div className="p-1.5 max-h-60 overflow-y-auto space-y-1">
              {authorizedCompanies.map(company => {
                const isSelected = company.id === activeCompanyId;
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelect(company.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {company.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                          <span>{company.business_type || 'General Trading'}</span>
                          {company.city && (
                            <>
                              <span>•</span>
                              <span>{company.city}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Action Buttons */}
            <div className="p-1.5 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowAddModal(true);
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Business Company</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowManageModal(true);
                }}
                className="w-full px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Manage Businesses & Workspaces</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddBusinessModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <ManageBusinessesModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        onOpenAddModal={() => setShowAddModal(true)}
      />
    </>
  );
}
