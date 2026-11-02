import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, sanitizeProfile, validateCsrfOrigin } from '@/lib/authSession';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const isSelf = auth.session.userId === id;
    const isAdmin = auth.session.role === 'admin' || auth.session.profileType === 'ADMIN';

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Cannot view other profiles' }, { status: 403 });
    }

    const profiles = db.getProfiles();
    const profile = profiles.find(p => p.id === id || p.retailer_id === id);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: sanitizeProfile(profile) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }

    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const profiles = db.getProfiles();
    const profile = profiles.find(p => p.id === id || p.retailer_id === id);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role === 'retailer') {
      const retailerId = profile.retailer_id || id;
      const updated = db.updateRetailerProfile(retailerId, body);
      return NextResponse.json({ success: true, message: 'Retailer profile updated successfully', data: sanitizeProfile(updated as any) });
    } else if (profile.role === 'staff' || profile.profile_type === 'STAFF') {
      const updated = db.updateStaffProfile(profile.id, body);
      return NextResponse.json({ success: true, message: 'Staff profile updated successfully', data: sanitizeProfile(updated) });
    } else {
      const updated = db.updateSalespersonProfile(profile.id, body);
      return NextResponse.json({ success: true, message: 'Salesperson profile updated successfully', data: sanitizeProfile(updated) });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update profile' }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }

    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const profiles = db.getProfiles();
    const profile = profiles.find(p => p.id === id || p.retailer_id === id);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    if (body.active !== undefined) {
      const active = Boolean(body.active);
      const updated = db.toggleProfileStatus(profile.id, active);
      return NextResponse.json({ success: true, message: `Profile status updated to ${active ? 'active' : 'inactive'}`, profile: sanitizeProfile(updated) });
    }

    return NextResponse.json({ success: false, error: 'No valid patch operation supplied' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to patch profile' }, { status: 400 });
  }
}
