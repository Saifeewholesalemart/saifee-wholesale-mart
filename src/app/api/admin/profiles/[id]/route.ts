import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profiles = db.getProfiles();
    const profile = profiles.find(p => p.id === id || p.retailer_id === id);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      return NextResponse.json({ success: true, message: 'Retailer profile updated successfully', data: updated });
    } else if (profile.role === 'staff' || profile.profile_type === 'STAFF') {
      const updated = db.updateStaffProfile(profile.id, body);
      return NextResponse.json({ success: true, message: 'Staff profile updated successfully', data: updated });
    } else {
      const updated = db.updateSalespersonProfile(profile.id, body);
      return NextResponse.json({ success: true, message: 'Salesperson profile updated successfully', data: updated });
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
    const { id } = await params;
    const body = await req.json();
    const { action, password, active } = body;

    if (action === 'reset_password') {
      if (!password || password.length < 6) {
        return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const success = db.resetProfilePassword(id, password);
      if (!success) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Password reset successfully' });
    }

    if (action === 'toggle_status') {
      const updated = db.toggleProfileStatus(id, active);
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Profile ${updated.active ? 'activated' : 'deactivated'} successfully`,
        data: updated
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Supported: reset_password, toggle_status' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to update profile' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = db.toggleProfileStatus(id, false);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Profile deactivated successfully', data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to deactivate profile' }, { status: 400 });
  }
}
