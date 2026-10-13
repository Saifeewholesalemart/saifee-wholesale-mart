import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://wxctglnnybhhptkxwxur.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4Y3RnbG5ueWJoaHB0a3h3eHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzM4MjMsImV4cCI6MjEwNjQ0OTgyM30.VKVW7suM_0e_ZO1rnw2YtwTh97N2eLpB70XOJNzPUg0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
