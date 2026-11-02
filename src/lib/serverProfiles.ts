/**
 * Server-Side Profile Lookup (PostgreSQL / Supabase)
 * File: src/lib/serverProfiles.ts
 *
 * Login aur session check ab seedha cloud database ki `profiles` aur `retailers`
 * tables se hota hai. Server ki memory me padi demo accounts se nahi.
 *
 * SERVER-ONLY: sirf API routes se import karo.
 */

import { executeRawQuery } from './serverDb';
import type { Profile, Retailer } from './db';

function lastTenDigits(value: string): string {
  return (value || '').replace(/[^0-9]/g, '').slice(-10);
}

/**
 * Profile ko uski ID se laata hai (session check ke liye).
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  if (!id || typeof id !== 'string') return null;
  const res = await executeRawQuery<any>('SELECT * FROM profiles WHERE id = $1 LIMIT 1', [id]);
  return (res.rows[0] as Profile | undefined) ?? null;
}

async function getRetailerById(id: string): Promise<Retailer | null> {
  if (!id) return null;
  const res = await executeRawQuery<any>('SELECT * FROM retailers WHERE id = $1 LIMIT 1', [id]);
  return (res.rows[0] as Retailer | undefined) ?? null;
}

/**
 * Login ke liye profile dhundta hai.
 * Match: mobile / contact_no / phone (aakhri 10 digit), profile ID, ya email.
 * Retailer ke case me: retailer ka mobile ya retailer_code se, uske linked profile tak.
 */
export async function findProfileForLogin(
  input: string
): Promise<{ profile: Profile | null; retailer: Retailer | null }> {
  const raw = (input || '').trim();
  if (!raw) return { profile: null, retailer: null };

  const digits = lastTenDigits(raw);
  const digitsParam = digits.length >= 10 ? digits : '';

  // 1. Seedha profile match
  const profRes = await executeRawQuery<any>(
    `SELECT * FROM profiles
      WHERE ($1::text <> '' AND (
              right(regexp_replace(coalesce(mobile, ''),     '[^0-9]', '', 'g'), 10) = $1::text
           OR right(regexp_replace(coalesce(contact_no, ''), '[^0-9]', '', 'g'), 10) = $1::text
           OR right(regexp_replace(coalesce(phone, ''),      '[^0-9]', '', 'g'), 10) = $1::text))
         OR lower(id) = lower($2::text)
         OR lower(email) = lower($2::text)
      ORDER BY (active IS NOT FALSE) DESC, created_at ASC
      LIMIT 1`,
    [digitsParam, raw]
  );

  let profile = (profRes.rows[0] as Profile | undefined) ?? null;
  let retailer: Retailer | null = null;

  if (profile) {
    if (profile.retailer_id) {
      retailer = await getRetailerById(profile.retailer_id);
    }
    return { profile, retailer };
  }

  // 2. Retailer ke mobile / retailer_code se, phir uske linked profile tak
  const retRes = await executeRawQuery<any>(
    `SELECT * FROM retailers
      WHERE ($1::text <> '' AND right(regexp_replace(coalesce(mobile, ''), '[^0-9]', '', 'g'), 10) = $1::text)
         OR lower(retailer_code) = lower($2::text)
      ORDER BY (active IS NOT FALSE) DESC, created_at ASC
      LIMIT 1`,
    [digitsParam, raw]
  );

  retailer = (retRes.rows[0] as Retailer | undefined) ?? null;
  if (!retailer) return { profile: null, retailer: null };

  const linkedRes = await executeRawQuery<any>(
    'SELECT * FROM profiles WHERE retailer_id = $1 ORDER BY created_at ASC LIMIT 1',
    [retailer.id]
  );
  profile = (linkedRes.rows[0] as Profile | undefined) ?? null;

  return { profile, retailer: profile ? retailer : null };
}
