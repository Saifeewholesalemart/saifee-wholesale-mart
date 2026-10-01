'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter, usePathname } from 'next/navigation';
import { Shield, Smartphone, Store, User, Boxes } from 'lucide-react';

export default function RoleSwitcher() {
  const { currentUser, setCurrentUser, profiles } = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // We only show the active switcher on client side
  if (!currentUser) return null;

  // Strict Admin Isolation: Do not render floating role switcher inside the Admin ERP portal
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const handleRoleChange = (userId: string) => {
    setCurrentUser(userId);
    const targetUser = profiles.find(p => p.id === userId);
    setIsOpen(false);
    
    if (targetUser) {
      if (targetUser.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (targetUser.role === 'sales_dist' || targetUser.role === 'sales_co') {
        router.push('/sales/dashboard');
      } else if (targetUser.role === 'retailer') {
        router.push('/retailer/dashboard');
      } else if (targetUser.role === 'staff' || targetUser.profile_type === 'STAFF') {
        router.push('/staff/dashboard');
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-indigo-600" />;
      case 'sales_dist':
      case 'sales_co':
        return <Smartphone className="w-4 h-4 text-cyan-600" />;
      case 'retailer':
        return <Store className="w-4 h-4 text-emerald-600" />;
      case 'staff':
        return <Boxes className="w-4 h-4 text-amber-600" />;
      default:
        return <User className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px] animate-in fade-in duration-100" 
          onClick={() => setIsOpen(false)} 
        />
      )}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 no-print">
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 active:scale-95 transition-all text-[11px] sm:text-xs font-semibold tracking-wider border border-slate-700 cursor-pointer"
          >
            {getRoleIcon(currentUser.role)}
            <span className="truncate max-w-[140px] sm:max-w-none">ROLE: {currentUser.name.split(' ')[0].toUpperCase()} ({currentUser.role.toUpperCase()})</span>
          </button>

          {isOpen && (
            <div className="absolute bottom-12 sm:bottom-14 right-0 w-[calc(100vw-24px)] max-w-xs sm:w-80 max-h-[75vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 p-2 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Switch Demo User Role
              </div>
              <div className="space-y-1 mt-1">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleRoleChange(p.id)}
                    className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg transition-all text-xs cursor-pointer ${
                      currentUser.id === p.id 
                        ? 'bg-indigo-50 border border-indigo-100 font-semibold' 
                        : 'hover:bg-slate-50 active:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="mt-0.5">{getRoleIcon(p.role)}</div>
                    <div className="flex-1">
                      <div className="text-slate-800 font-bold">{p.name}</div>
                      <div className="text-slate-500 text-xs mt-0.5 font-medium leading-tight">
                        {p.role === 'admin' && 'Full ERP access, Purchases, Consolidation, Invoices'}
                        {p.role === 'sales_dist' && 'Distributor Sales: Places orders for any product & retailer'}
                        {p.role === 'sales_co' && `Company Sales (${p.company_id?.split('-')[1]?.toUpperCase()}): Places brand orders`}
                        {p.role === 'retailer' && 'Retailer direct: Places orders, views invoices & outstanding'}
                        {(p.role === 'staff' || p.profile_type === 'STAFF') && `${p.custom_role || 'Warehouse Staff'}: Order packing queues & box verification`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
