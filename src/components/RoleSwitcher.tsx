'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter, usePathname } from 'next/navigation';
import { Shield, Smartphone, Store, User, Boxes, AlertTriangle } from 'lucide-react';

export default function RoleSwitcher() {
  const { currentUser, setCurrentUser, profiles, isAuthenticated } = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // SECURITY: Prevent client-side role switching completely in production environments
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Do not render switcher if unauthenticated or on root login landing page
  if (!isAuthenticated || !currentUser || !currentUser.id || pathname === '/' || pathname?.startsWith('/admin')) {
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

      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end">
        {isOpen && (
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-2 mb-3 w-64 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom-2 duration-150">
            <div className="px-2 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dev Switcher</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-2.5 h-2.5" /> Dev Mode
              </span>
            </div>

            <div className="space-y-1">
              {profiles.filter(p => p.active !== false).map(p => {
                const isSelected = p.id === currentUser.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleRoleChange(p.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-100' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="shrink-0 p-1 rounded-md bg-slate-100">
                      {getRoleIcon(p.role)}
                    </div>
                    <div className="truncate flex-1">
                      <p className="truncate leading-tight">{p.name || p.full_name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{p.custom_role || p.role.replace('_', ' ')}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-slate-900 hover:bg-slate-800 text-white rounded-full p-2.5 shadow-lg border border-slate-700 flex items-center gap-2 text-xs font-medium transition-all active:scale-95"
          title="Development Role Switcher (Disabled in Production)"
        >
          {getRoleIcon(currentUser.role)}
          <span className="hidden sm:inline font-semibold">Switch Role</span>
        </button>
      </div>
    </>
  );
}
