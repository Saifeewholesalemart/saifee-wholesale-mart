'use client';

import { getSellerDetails } from '@/lib/db';
import React, { useState, useEffect } from 'react';
import { useDb } from '@/context/DbContext';
import { useRouter } from 'next/navigation';
import { homePathFor } from '@/lib/useUrlStep';
import { 
  Package, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Headphones, 
  X,
  PhoneCall,
  Mail,
  MapPin
} from 'lucide-react';

export default function Home() {
  const { setCurrentUser, profiles, retailers, activeCompany, isAuthenticated, isAuthLoading, currentUser } = useDb();
  const router = useRouter();

  // Already signed in (for example after pressing Back): go to the app, not the login form
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    const home = homePathFor(currentUser);
    if (home) router.replace(home);
  }, [isAuthLoading, isAuthenticated, currentUser, router]);

  // Form states
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRole, setSuccessRole] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);

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

    // Server-side authentication with graceful offline fallback
    try {
      let loginData: any = null;
      let isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (!isOffline) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: inputVal, password: enteredPassword })
          });

          loginData = await res.json();

          if (!res.ok || !loginData.success) {
            setErrorMessage(loginData.error || 'Authentication error. Please verify credentials.');
            setIsLoading(false);
            return;
          }
        } catch (fetchErr) {
          // Network failed, fall back to offline verification check
          isOffline = true;
        }
      }

      if (isOffline) {
        // Strict Offline Mode: Verify against previously cached session on this device
        // Do NOT silently default to Distributor Admin
        const cachedRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('fmcg_cached_session') : null;
        let cachedSession: any = null;
        try {
          cachedSession = cachedRaw ? JSON.parse(cachedRaw) : null;
        } catch {}

        const cachedMobile = (cachedSession?.user?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
        const cachedId = (cachedSession?.user?.id || '').toLowerCase();

        if (cachedSession?.user && ((cleanDigits && cleanDigits === cachedMobile) || inputVal.toLowerCase() === cachedId)) {
          // Valid cached offline user
          const uRole = cachedSession.user.role;
          let targetRoute = '/retailer/home';
          if (uRole === 'admin') targetRoute = '/admin/orders';
          else if (uRole === 'sales_dist' || uRole === 'sales_co') targetRoute = '/salesperson/dashboard';
          else if (uRole === 'staff') targetRoute = '/staff/dashboard';

          loginData = {
            success: true,
            user: cachedSession.user,
            roleLabel: `${cachedSession.user.name} (Offline)`,
            targetRoute
          };
        } else {
          setErrorMessage('Offline Authentication: No verified session found on this device for these credentials. Please connect online once to sign in.');
          setIsLoading(false);
          return;
        }
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

        // Cache session for offline hydration
        if (loginData.user) {
          localStorage.setItem('fmcg_cached_session', JSON.stringify({
            user: loginData.user,
            savedAt: Date.now()
          }));
        }
      } catch {}

      // Authenticate User in Context
      setCurrentUser(loginData.user.id, loginData.user);
      setSuccessRole(loginData.roleLabel);

      setTimeout(() => {
        // replace: Back from the app must not return to the login form
        router.replace(loginData.targetRoute);
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
                <p className="text-xs text-slate-400">{getSellerDetails(activeCompany).name}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Helpline &amp; Password Reset</div>
                  <div className="text-slate-300 font-mono mt-0.5">{getSellerDetails(activeCompany).phone || 'Please contact your administrator'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mon - Sat: 9:00 AM to 9:00 PM</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Email Support</div>
                  <div className="text-slate-300 font-mono mt-0.5">{(activeCompany as any)?.email || 'Please contact your administrator'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Wholesale Depot / Office</div>
                  <div className="text-slate-300 mt-0.5">{getSellerDetails(activeCompany).address || 'Khachrod, Dist. Ujjain'}, {getSellerDetails(activeCompany).stateLabel}</div>
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
