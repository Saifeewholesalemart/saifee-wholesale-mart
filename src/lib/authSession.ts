import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import type { Profile } from './db';

export interface SessionPayload {
  userId: string;
  mobile: string;
  name: string;
  role: 'admin' | 'sales_dist' | 'sales_co' | 'retailer' | 'staff';
  profileType: string;
  businessId: string;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'saifee_session';

// Ephemeral runtime secret storage for production when no env var is configured
declare global {
  // eslint-disable-next-line no-var
  var __saifee_ephemeral_session_secret: string | undefined;
}

/**
 * Derives a secure HMAC secret. In production, refuses static fallback and generates a strong random secret.
 */
export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) {
    return process.env.SESSION_SECRET.trim();
  }
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.trim()) {
    return process.env.NEXTAUTH_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    if (!globalThis.__saifee_ephemeral_session_secret) {
      console.warn('[SECURITY]: No SESSION_SECRET configured in production. Generating secure ephemeral in-memory secret.');
      globalThis.__saifee_ephemeral_session_secret = crypto.randomBytes(32).toString('hex');
    }
    return globalThis.__saifee_ephemeral_session_secret;
  }
  return 'saifee_fmcg_distributor_dev_session_secret_2026';
}

export const UNAUTHENTICATED_GUEST_PROFILE: Profile = {
  id: '',
  email: '',
  name: 'Not Signed In',
  full_name: 'Not Signed In',
  role: 'retailer',
  profile_type: 'RETAILER',
  active: false,
  status: 'INACTIVE',
};

/**
 * Verifies a plaintext password against a stored password or bcrypt hash.
 * If the stored credential is a bcrypt hash ($2a$, $2b$, $2y$), uses bcrypt.compareSync.
 * Otherwise, falls back to constant-time timingSafeEqual comparison.
 */
export function verifyPassword(entered: string, storedHashOrPassword: string): boolean {
  if (typeof entered !== 'string' || typeof storedHashOrPassword !== 'string') return false;
  if (!entered || !storedHashOrPassword) return false;

  const trimmedHash = storedHashOrPassword.trim();
  // Check if stored value is a standard bcrypt hash ($2a$, $2b$, $2y$)
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(trimmedHash)) {
    try {
      return bcrypt.compareSync(entered, trimmedHash);
    } catch {
      return false;
    }
  }

  // Constant-time timingSafeEqual fallback
  const enteredBuf = Buffer.from(entered, 'utf8');
  const actualBuf = Buffer.from(trimmedHash, 'utf8');

  if (enteredBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(enteredBuf, actualBuf);
}

/**
 * Constant-time case-sensitive password comparison preventing timing attacks
 * (Delegates to verifyPassword to support bcrypt hashes transparently)
 */
export function safeComparePassword(entered: string, actual: string): boolean {
  return verifyPassword(entered, actual);
}

/**
 * Validates Origin/Referer header against Host to protect cookie-authenticated mutations from CSRF
 */
export function validateCsrfOrigin(req: NextRequest | Request): boolean {
  const method = req.method.toUpperCase();
  // Safe read-only HTTP methods do not require CSRF origin validation
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const host = req.headers.get('host') || req.headers.get('x-forwarded-host');
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const secFetchSite = req.headers.get('sec-fetch-site');

  // Modern browser defense: sec-fetch-site
  if (secFetchSite === 'cross-site') {
    return false;
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (host && originHost.toLowerCase() !== host.toLowerCase()) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (host && refererHost.toLowerCase() !== host.toLowerCase()) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  // If both origin and referer are absent, allow local/PWA client calls unless sec-fetch-site says cross-site
  return true;
}

/**
 * Signs a session payload into a tamper-proof HMAC-SHA256 token
 */
export function signSessionToken(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, 'utf8').toString('base64url');
  const secret = getSessionSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the cryptographic HMAC-SHA256 signature and expiration of a session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  try {
    const secret = getSessionSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload: SessionPayload = JSON.parse(json);

    if (!payload.userId || !payload.exp || typeof payload.exp !== 'number' || !payload.role) {
      return null;
    }

    // Expiry check
    if (Date.now() > payload.exp) {
      return null;
    }

    // Future-dated clock-skew defense
    if (payload.iat && payload.iat > Date.now() + 60000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the session token from NextRequest cookies
 */
export function getSessionFromRequest(req: NextRequest | Request): SessionPayload | null {
  try {
    if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
      const cookieValue = (req as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
      if (cookieValue) {
        return verifySessionToken(cookieValue);
      }
    }

    // Fallback: parse Cookie header string
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      return verifySessionToken(decodeURIComponent(match[1]));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Revalidates session token against live server database profile.
 * Ensures deactivated accounts or changed roles immediately take effect.
 */
export async function getAuthenticatedUser(req: NextRequest | Request): Promise<{
  session: SessionPayload;
  profile: Profile;
} | null> {
  const session = getSessionFromRequest(req);
  if (!session) return null;

  // Profile ab cloud database (PostgreSQL) se aata hai, server ki memory se nahi.
  // Dynamic import: serverDb <-> authSession ka circular import avoid karne ke liye.
  const { getProfileById } = await import('./serverProfiles');
  const profile = await getProfileById(session.userId);

  if (!profile || profile.active === false || profile.status === 'INACTIVE') {
    return null;
  }

  // Revalidate and bind session properties to live database profile
  session.role = profile.role;
  session.profileType = profile.profile_type || (profile.role === 'admin' ? 'ADMIN' : 'RETAILER');
  if ((profile as any).business_id) {
    session.businessId = (profile as any).business_id;
  }

  return { session, profile };
}

/**
 * Sets the secure, HTTP-only session cookie on a NextResponse
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAgeSeconds = 7 * 24 * 60 * 60; // 7 days

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });

  response.cookies.set('saifee_user_id', '', {
    path: '/',
    maxAge: 0,
  });
}

/**
 * Clears the session cookie on a NextResponse during logout
 */
export function clearSessionCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('saifee_user_id', '', {
    path: '/',
    maxAge: 0,
  });
}

/**
 * Sanitizes an entity object (profile or retailer) by removing sensitive password fields
 */
export function sanitizeProfile<T extends Record<string, any>>(profile: T | null | undefined): Omit<T, 'password' | 'password_hash'> | null {
  if (!profile) return null;
  const { password, password_hash, ...sanitized } = profile;
  return sanitized as Omit<T, 'password' | 'password_hash'>;
}

/**
 * Sanitizes an array of entity objects
 */
export function sanitizeProfiles<T extends Record<string, any>>(profiles: T[]): Omit<T, 'password' | 'password_hash'>[] {
  if (!Array.isArray(profiles)) return [];
  return profiles.map(p => sanitizeProfile(p)!).filter(Boolean);
}
