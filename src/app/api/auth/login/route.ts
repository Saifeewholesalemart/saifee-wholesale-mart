import { NextRequest, NextResponse } from 'next/server';
import type { Profile, Retailer } from '@/lib/db';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { findProfileForLogin } from '@/lib/serverProfiles';
import { signSessionToken, setSessionCookie, sanitizeProfile, safeComparePassword, verifyPassword, validateCsrfOrigin, SessionPayload } from '@/lib/authSession';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile, password } = body;

    const inputVal = (mobile || '').toString().trim();
    const enteredPassword = (password || '').toString().trim();

    if (!inputVal) {
      return NextResponse.json(
        { success: false, error: 'Mobile number or User ID is required.' },
        { status: 400 }
      );
    }

    if (!enteredPassword) {
      return NextResponse.json(
        { success: false, error: 'Password is required.' },
        { status: 400 }
      );
    }

    const cleanDigits = inputVal.replace(/[^0-9]/g, '').slice(-10);

    // Profile cloud database (PostgreSQL / Supabase) se dhundhte hain
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Server database is not configured. Please contact the administrator.' },
        { status: 503 }
      );
    }

    const found = await findProfileForLogin(inputVal);
    const matchedProfile: Profile | undefined = found.profile ?? undefined;
    const associatedRetailer: Retailer | undefined = found.retailer ?? undefined;

    if (!matchedProfile) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials. Please verify your mobile number and password.' },
        { status: 401 }
      );
    }

    // 1.5 CSRF Origin Validation
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }

    // 2. Strict Server-Side Password Verification
    // NO UNIVERSAL BYPASS PASSWORDS. Strict bcrypt and constant-time verification.
    const profilePwd = (matchedProfile.password_hash || matchedProfile.password || '').trim();
    const retailerPwd = (associatedRetailer?.password || (associatedRetailer as any)?.password_hash || '').trim();

    const isMatch = verifyPassword(enteredPassword, profilePwd) || (retailerPwd ? verifyPassword(enteredPassword, retailerPwd) : false);

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials. Please verify your mobile number and password.' },
        { status: 401 }
      );
    }

    // 3. Verify Account Active Status
    if (matchedProfile.active === false || matchedProfile.status === 'INACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Your account is currently disabled. Please contact the administrator.' },
        { status: 403 }
      );
    }

    // 4. Determine Smart Target Route by Role
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

    // 5. Issue Tamper-Proof Cryptographic Session Token
    const sessionPayload: SessionPayload = {
      userId: matchedProfile.id,
      mobile: matchedProfile.mobile || cleanDigits || '',
      name: matchedProfile.name || matchedProfile.full_name || 'User',
      role: matchedProfile.role,
      profileType: matchedProfile.profile_type || 'RETAILER',
      businessId: (matchedProfile as any).business_id || 'biz-saifee',
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const token = signSessionToken(sessionPayload);

    // 6. Set HTTP-Only Cookie and Return Sanitized Profile (No Passwords!)
    const response = NextResponse.json({
      success: true,
      roleLabel,
      targetRoute,
      user: sanitizeProfile(matchedProfile)
    });

    setSessionCookie(response, token);

    return response;
  } catch (err: any) {
    console.error('[API Auth Login Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication service error. Please try again.' },
      { status: 500 }
    );
  }
}
