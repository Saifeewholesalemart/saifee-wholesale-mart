import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// Strictly configure local development server to use Staging Supabase project only (jtofsoriinobcabpjswl)
// Reads credentials dynamically from .env.staging; NEVER connects to production (wxctglnnybhhptkxwxur).
const stagingEnvPath = path.resolve(process.cwd(), '.env.staging');
let stagingDatabaseUrl = '';
let stagingSupabaseUrl = '';
let stagingSupabaseAnonKey = '';
let stagingServiceRoleKey = '';

if (fs.existsSync(stagingEnvPath)) {
  const content = fs.readFileSync(stagingEnvPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (k === 'STAGING_DATABASE_URL') stagingDatabaseUrl = v;
        if (k === 'STAGING_SUPABASE_URL') stagingSupabaseUrl = v;
        if (k === 'STAGING_SUPABASE_ANON_KEY') stagingSupabaseAnonKey = v;
        if (k === 'STAGING_SERVICE_ROLE_KEY') stagingServiceRoleKey = v;
      }
    }
  }
}

// Block production credentials unconditionally
if (stagingDatabaseUrl.includes('wxctglnnybhhptkxwxur') || stagingSupabaseUrl.includes('wxctglnnybhhptkxwxur')) {
  throw new Error('[CRITICAL SECURITY VIOLATION]: Production project wxctglnnybhhptkxwxur is strictly blocked!');
}

if (stagingDatabaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = stagingDatabaseUrl;
}
if (stagingSupabaseUrl && (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('wxctglnnybhhptkxwxur'))) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = stagingSupabaseUrl;
}
if (stagingSupabaseAnonKey && (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('wxctglnnybhhptkxwxur'))) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = stagingSupabaseAnonKey;
}
if (stagingServiceRoleKey && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = stagingServiceRoleKey;
}

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.0.103', 'localhost:3000'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: stagingSupabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingSupabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }
};

export default nextConfig;
