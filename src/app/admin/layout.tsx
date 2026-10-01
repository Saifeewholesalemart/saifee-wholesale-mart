'use client';

import React, { useState } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, ShoppingCart, Combine, PackageCheck, Package, 
  FileSpreadsheet, FileText, Users, DollarSign, RotateCcw, 
  TrendingUp, Settings, LogOut, Menu, X, ArrowLeft, Cpu, ClipboardList, Tags, Boxes, Warehouse, ArrowLeftRight, Zap, UserCog, Store, Database
} from 'lucide-react';
import { CompanySwitcher } from '@/components/CompanySwitcher';
import { CompanySwitchingOverlay } from '@/components/CompanySwitchingOverlay';

interface MenuItem {
  name: string;
  path: string;
  icon: any;
}

const MENU_ITEMS: MenuItem[] = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: '⚡ Fast Trade Terminal', path: '/admin/terminal', icon: Zap },
  { name: 'Item Master (Products)', path: '/admin/products', icon: Package },
  { name: 'Import from Vyapar', path: '/admin/products/import-vyapar', icon: FileSpreadsheet },
  { name: 'Godowns / Warehouses', path: '/admin/godowns', icon: Warehouse },
  { name: 'Categories', path: '/admin/categories', icon: Tags },
  { name: 'Order Register', path: '/admin/orders', icon: ShoppingCart },
  { name: 'Purchases', path: '/admin/purchases', icon: PackageCheck },
  { name: 'AI Purchase Import', path: '/admin/purchase/import', icon: Cpu },
  { name: 'Inventory & Batch', path: '/admin/inventory', icon: Boxes },
  { name: 'Invoices (GST)', path: '/admin/invoices', icon: FileSpreadsheet },
  { name: 'Manage Profiles', path: '/admin/profiles', icon: UserCog },
  { name: 'Payments & Ledger', path: '/admin/payments', icon: DollarSign },
  { name: 'Cash Flow', path: '/admin/cash-flow', icon: ArrowLeftRight },
  { name: 'Returns History', path: '/admin/returns', icon: RotateCcw },
  { name: 'ERP Reports', path: '/admin/reports', icon: TrendingUp },
  { name: 'Database & Backups', path: '/admin/backup', icon: Database }
];

function AdminSidebar({
  activeCompany,
  currentUser,
  pathname,
  onLogout,
  onItemClick
}: {
  activeCompany: any;
  currentUser: any;
  pathname: string;
  onLogout: () => void;
  onItemClick?: () => void;
}) {
  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Package className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black text-white tracking-wide truncate">
            {activeCompany?.name?.toUpperCase() || 'SAIFEE DISTRIBUTOR'}
          </h1>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block truncate">
            {activeCompany?.business_type || 'ERP Admin Portal'}
          </span>
        </div>
      </div>

      {/* Menu links */}
      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30 font-bold'
                  : 'hover:bg-slate-800 hover:text-slate-100 active:bg-slate-800 text-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile & switch back */}
      <div className="p-4 border-t border-slate-800 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Saifee Admin'}</p>
            <p className="text-xs text-slate-400 truncate">{currentUser?.email || 'admin@saifee.com'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit ERP Admin</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, activeCompany } = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto close mobile drawer on route change
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    setCurrentUser('p-admin-1');
    router.push('/');
  };

  const currentTitle = MENU_ITEMS.find(m => m.path === pathname)?.name || `${activeCompany?.name || 'Saifee'} ERP`;

  return (
    <div className="flex-1 flex min-h-screen bg-slate-50 lg:h-screen lg:overflow-hidden">
      {/* Workspace Transition Overlay */}
      <CompanySwitchingOverlay />

      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden lg:block w-64 h-screen border-r border-slate-200 flex-shrink-0 bg-slate-900">
        <AdminSidebar
          activeCompany={activeCompany}
          currentUser={currentUser}
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] animate-in fade-in duration-150" 
            onClick={() => setSidebarOpen(false)} 
          />
          <aside className="relative w-72 max-w-[85vw] h-full flex flex-col z-50 bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Close button in top-right of mobile drawer */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center focus:outline-none cursor-pointer z-10"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
            <AdminSidebar
              activeCompany={activeCompany}
              currentUser={currentUser}
              pathname={pathname}
              onLogout={handleLogout}
              onItemClick={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen lg:h-screen lg:overflow-hidden">
        {/* Topbar for mobile & responsive quick stats */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 bg-white/95 backdrop-blur-xs border-b border-slate-200 flex-shrink-0 no-print">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg text-slate-700 focus:outline-none cursor-pointer flex-shrink-0 transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xs sm:text-base font-bold text-slate-800 leading-none truncate max-w-[140px] sm:max-w-none">
              {currentTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Multi-Company Workspace Switcher */}
            <CompanySwitcher compactOnMobile={true} />

            <div className="hidden md:block text-right">
              <span className="text-[10px] text-slate-400 font-bold block leading-none">LOCATION</span>
              <span className="text-xs font-semibold text-slate-700 mt-0.5 inline-block">
                {activeCompany?.city || 'Mumbai'} ({activeCompany?.state_code || '27'})
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content Wrapper */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 min-w-0 lg:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
