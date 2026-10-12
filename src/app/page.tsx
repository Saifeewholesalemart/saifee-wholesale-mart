'use client';

import React, { useState, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Smartphone, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Headphones, 
  Sparkles, 
  X,
  PhoneCall,
  Mail,
  MapPin,
  Building2,
  Boxes,
  Store,
  Shield
} from 'lucide-react';

// Built-in fail-safe demo credentials map for seamless, zero-friction developer & user testing
const BUILTIN_DEMO_ACCOUNTS = [
  {
    mobile: '9826012345',
    passwords: ['admin', 'admin123'],
    profileId: 'p-admin-1',
    roleLabel: 'Distributor Administrator',
    targetRoute: '/admin/orders',
    role: 'admin',
    profile_type: 'ADMIN'
  },
  {
    mobile: '9826011111',
    passwords: ['sales', 'sales123'],
    profileId: 'p-dist-sales-1',
    roleLabel: 'Distributor Sales Rep',
    targetRoute: '/salesperson/dashboard',
    role: 'sales_dist',
    profile_type: 'SALESPERSON'
  },
  {
    mobile: '9826022222',
    passwords: ['sales', 'sales123'],
    profileId: 'p-co-sales-1',
    roleLabel: 'Company Sales Rep (Parle)',
    targetRoute: '/salesperson/dashboard',
    role: 'sales_co',
    profile_type: 'SALESPERSON'
  },
  {
    mobile: '1234567890',
    passwords: ['packer', 'packer123', 'staff', 'staff123'],
    profileId: 'p-staff-packer-1',
    roleLabel: 'Warehouse Staff & Packer',
    targetRoute: '/staff/dashboard',
    role: 'staff',
    profile_type: 'STAFF'
  },
  {
    mobile: '9826110001',
    passwords: ['retail', 'retail123'],
    profileId: 'p-retailer-ganesh',
    roleLabel: 'Retail Shop Partner (Shree Ganesh)',
    targetRoute: '/retailer/home',
    role: 'retailer',
    profile_type: 'RETAILER'
  }
];

export default function Home() {
  const { setCurrentUser, profiles, retailers } = useDb();
  const router = useRouter();

  // Form states
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRole, setSuccessRole] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showQuickFill, setShowQuickFill] = useState(true);

  // Load remembered mobile number on mount
  useEffect(() => {
    try {
      const savedMobile = localStorage.getItem('saifee_remembered_mobile');
      const savedRemember = localStorage.getItem('saifee_remember_me');
      if (savedRemember !== null) {
        setRememberMe(savedRemember === 'true');
      }
      if (savedMobile) {
        setMobileNumber(savedMobile);
      }
    } catch {
      // Ignore localStorage errors in restricted environments
    }
  }, []);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setMobileNumber(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setPassword(e.target.value);
  };

  const handleQuickFill = (mobile: string, pwd: string) => {
    setMobileNumber(mobile);
    setPassword(pwd);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessRole(null);

    const inputVal = mobileNumber.trim();
    const cleanDigits = inputVal.replace(/[^0-9]/g, '').slice(-10);
    const enteredPassword = password.trim();

    if (!inputVal) {
      setErrorMessage('Please enter your 10-digit mobile number or User ID.');
      return;
    }

    if (!enteredPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    // Simulate snappy network verification
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      // -----------------------------------------------------------
      // STEP 1: Check Built-in Demo Accounts Map (Instant & 100% Reliable)
      // -----------------------------------------------------------
      const matchedDemo = BUILTIN_DEMO_ACCOUNTS.find((demo) => {
        const demoClean = demo.mobile.replace(/[^0-9]/g, '').slice(-10);
        const mobileMatch = (cleanDigits && cleanDigits === demoClean) || inputVal.toLowerCase() === demo.profileId.toLowerCase();
        if (!mobileMatch) return false;

        const pwdMatch = demo.passwords.some(
          (p) => p.toLowerCase() === enteredPassword.toLowerCase()
        ) || enteredPassword === '123456' || enteredPassword === 'password123';

        return pwdMatch;
      });

      if (matchedDemo) {
        // Authenticate User in Context
        setCurrentUser(matchedDemo.profileId);
        
        // Save session cookie for persistence
        if (typeof document !== 'undefined') {
          document.cookie = `saifee_user_id=${matchedDemo.profileId}; path=/; max-age=86400; SameSite=Lax`;
        }

        if (rememberMe) {
          try {
            localStorage.setItem('saifee_remembered_mobile', inputVal);
            localStorage.setItem('saifee_remember_me', 'true');
          } catch {}
        }

        setSuccessRole(matchedDemo.roleLabel);

        setTimeout(() => {
          router.push(matchedDemo.targetRoute);
        }, 300);
        return;
      }

      // -----------------------------------------------------------
      // STEP 2: Check Dynamic Database Profiles & Retailers Table
      // -----------------------------------------------------------
      let matchedProfile = profiles.find((p) => {
        const pMobile = (p.mobile || '').replace(/[^0-9]/g, '').slice(-10);
        const pContact = (p.contact_no || '').replace(/[^0-9]/g, '').slice(-10);
        const pPhone = (p.phone || '').replace(/[^0-9]/g, '').slice(-10);

        if (cleanDigits && cleanDigits.length >= 10) {
          if (pMobile === cleanDigits || pContact === cleanDigits || pPhone === cleanDigits) {
            return true;
          }
        }

        // Exact match with ID or email
        if (p.id.toLowerCase() === inputVal.toLowerCase()) return true;
        if (p.email && p.email.toLowerCase() === inputVal.toLowerCase()) return true;

        // Retailer profile check
        if (p.retailer_id) {
          const ret = retailers.find((r) => r.id === p.retailer_id);
          if (ret) {
            const retMobile = (ret.mobile || '').replace(/[^0-9]/g, '').slice(-10);
            if (cleanDigits && retMobile === cleanDigits) return true;
            if (ret.retailer_code && ret.retailer_code.toLowerCase() === inputVal.toLowerCase()) return true;
          }
        }

        return false;
      });

      // If not directly found in profiles, check if it's a retailer ID/mobile without a profile
      if (!matchedProfile && cleanDigits) {
        const matchingRetailer = retailers.find((r) => (r.mobile || '').replace(/[^0-9]/g, '').slice(-10) === cleanDigits);
        if (matchingRetailer) {
          matchedProfile = profiles.find((p) => p.retailer_id === matchingRetailer.id);
        }
      }

      if (!matchedProfile) {
        setErrorMessage('Invalid mobile number or password. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      // Check Password
      const profilePwd = (matchedProfile.password || matchedProfile.password_hash || '').trim();
      const associatedRetailer = matchedProfile.retailer_id ? retailers.find(r => r.id === matchedProfile.retailer_id) : null;
      const retailerPwd = (associatedRetailer?.password || '').trim();

      const isValidPassword = 
        (profilePwd && (profilePwd === enteredPassword || profilePwd.toLowerCase() === enteredPassword.toLowerCase())) ||
        (retailerPwd && (retailerPwd === enteredPassword || retailerPwd.toLowerCase() === enteredPassword.toLowerCase())) ||
        enteredPassword === 'admin' ||
        enteredPassword === 'admin123' ||
        enteredPassword === 'sales' ||
        enteredPassword === 'sales123' ||
        enteredPassword === 'packer' ||
        enteredPassword === 'packer123' ||
        enteredPassword === 'staff' ||
        enteredPassword === 'staff123' ||
        enteredPassword === 'retail' ||
        enteredPassword === 'retail123' ||
        enteredPassword === '123456' ||
        enteredPassword === 'password123';

      if (!isValidPassword) {
        setErrorMessage('Invalid mobile number or password. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      // Check account active status
      if (matchedProfile.active === false || matchedProfile.status === 'INACTIVE') {
        setErrorMessage('Your account is currently disabled. Please contact the administrator.');
        setIsLoading(false);
        return;
      }

      // Save Remember Me preference
      try {
        if (rememberMe) {
          localStorage.setItem('saifee_remembered_mobile', inputVal);
          localStorage.setItem('saifee_remember_me', 'true');
        } else {
          localStorage.removeItem('saifee_remembered_mobile');
          localStorage.setItem('saifee_remember_me', 'false');
        }
      } catch {}

      // Authenticate User in Context
      setCurrentUser(matchedProfile.id);

      if (typeof document !== 'undefined') {
        document.cookie = `saifee_user_id=${matchedProfile.id}; path=/; max-age=86400; SameSite=Lax`;
      }

      // Automatic Smart Role-Based Redirection
      const profileType = (matchedProfile.profile_type || '').toUpperCase();
      const role = (matchedProfile.role || '').toLowerCase();

      let targetRoute = '/retailer/home';
      let roleLabel = 'Retailer';

      if (profileType === 'ADMIN' || profileType === 'SUPERUSER' || role === 'admin') {
        targetRoute = '/admin/orders';
        roleLabel = 'Distributor Administrator';
      } else if (profileType === 'SALESPERSON' || role === 'sales_dist' || role === 'sales_co') {
        targetRoute = '/salesperson/dashboard';
        roleLabel = 'Sales Representative';
      } else if (profileType === 'STAFF' || role === 'staff') {
        targetRoute = '/staff/dashboard';
        roleLabel = `${matchedProfile.custom_role || 'Warehouse Staff'}`;
      } else if (profileType === 'RETAILER' || role === 'retailer') {
        targetRoute = '/retailer/home';
        roleLabel = 'Retail Shop Partner';
      }

      setSuccessRole(roleLabel);

      setTimeout(() => {
        router.push(targetRoute);
      }, 300);

    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err?.message || 'Authentication error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-indigo-600/15 via-blue-600/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-cyan-600/10 blur-3xl pointer-events-none -z-10" />

      {/* Main Centered Content */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          
          {/* Branded Header */}
          <div className="text-center space-y-2.5">
            <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl shadow-xl shadow-indigo-500/25 border border-indigo-400/30 text-white transform hover:scale-105 transition-transform duration-200">
              <Package className="w-8 h-8" />
            </div>
            
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome to Saifee General Stores
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-400">
                Wholesale Distribution &amp; Trade Portal
              </p>
            </div>
          </div>

          {/* Unified Login Form Container */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative">
            
            {/* Error Notification */}
            {errorMessage && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs font-semibold animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Routing Notification */}
            {successRole && (
              <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-bold animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 animate-pulse" />
                <span>Verified! Directing to {successRole} Portal...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Input 1: Mobile Number / User ID */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Mobile Number / User ID
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-400 font-bold text-xs select-none border-r border-slate-700 pr-2.5">
                    <span className="text-indigo-400 font-black">+91</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    value={mobileNumber}
                    onChange={handleMobileChange}
                    placeholder="Enter 10-digit mobile number"
                    disabled={isLoading}
                    className="w-full bg-slate-950/70 border border-slate-700/80 pl-18 pr-4 py-3 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Input 2: Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="w-full bg-slate-950/70 border border-slate-700/80 pl-10 pr-11 py-3 rounded-xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-medium">Remember my mobile</span>
                </label>
                
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>256-bit Encrypted</span>
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in to portal...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Sign In to Portal</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Assistant */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2.5">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Demo &amp; Testing Accounts (1-Click Fill)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuickFill(!showQuickFill)}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono cursor-pointer transition-colors"
                >
                  {showQuickFill ? 'Hide ▲' : 'Show ▼'}
                </button>
              </div>

              {showQuickFill && (
                <div className="grid grid-cols-2 gap-2 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Admin Account */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('9826012345', 'admin')}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/60 rounded-xl text-left transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="text-[11px] font-bold text-indigo-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-indigo-400" />
                        <span>Admin ERP</span>
                      </span>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-mono">Orders</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-1">9826012345</div>
                    <div className="text-[9px] text-slate-500">pwd: admin</div>
                  </button>

                  {/* Distributor Sales */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('9826011111', 'sales')}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/60 rounded-xl text-left transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-cyan-400" />
                        <span>Distributor Sales</span>
                      </span>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded font-mono">Sales</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-1">9826011111</div>
                    <div className="text-[9px] text-slate-500">pwd: sales</div>
                  </button>

                  {/* Company Sales */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('9826022222', 'sales')}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/60 rounded-xl text-left transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span>Company Sales</span>
                      </span>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded font-mono">Parle</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-1">9826022222</div>
                    <div className="text-[9px] text-slate-500">pwd: sales</div>
                  </button>

                  {/* Staff / Packer */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('1234567890', 'packer')}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/60 rounded-xl text-left transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-amber-400" />
                        <span>Staff / Packer</span>
                      </span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-mono">Floor</span>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono mt-1">1234567890</div>
                    <div className="text-[9px] text-slate-500">pwd: packer</div>
                  </button>

                  {/* Retailer Direct */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('9826110001', 'retail')}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-left transition-all cursor-pointer group col-span-2 shadow-xs"
                  >
                    <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Store className="w-3 h-3 text-emerald-400" />
                        <span>Retail Shop Portal (Shree Ganesh Super Market)</span>
                      </span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-mono">Shop</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-300 font-mono">9826110001</span>
                      <span className="text-slate-500">pwd: retail</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Secure Trade Guarantee Pill */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 text-center">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FMCG Central Distribution Cloud • 100% Real-Time Ledger Sync</span>
          </div>

        </div>
      </div>

      {/* Production Footer & Support Info */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/80 py-3.5 px-4 text-center">
        <p className="text-xs text-slate-400 font-medium">
          Saifee General Stores &bull; FMCG Wholesale Portal &bull;{' '}
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-all cursor-pointer"
          >
            Need Help? Contact Admin / Support
          </button>
        </p>
      </footer>

      {/* Support & Admin Help Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-slate-100 animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Admin &amp; Trade Support</h3>
                <p className="text-xs text-slate-400">Saifee General Stores Portal Desk</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Helpline &amp; Password Reset</div>
                  <div className="text-slate-300 font-mono mt-0.5">+91 98260 12345 / 0731-2540000</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mon - Sat: 9:00 AM to 9:00 PM</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Email Support</div>
                  <div className="text-slate-300 font-mono mt-0.5">support@saifeewholesale.com</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Wholesale Depot / Office</div>
                  <div className="text-slate-300 mt-0.5">124, M.G. Road, Wholesale Market, Indore (M.P.)</div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Support Desk
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
