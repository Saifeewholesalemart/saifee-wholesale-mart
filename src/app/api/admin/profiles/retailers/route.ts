import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim();
    let retailers = db.getRetailers();

    if (search) {
      retailers = retailers.filter(r =>
        (r.shop_name && r.shop_name.toLowerCase().includes(search)) ||
        (r.owner_name && r.owner_name.toLowerCase().includes(search)) ||
        (r.retailer_code && r.retailer_code.toLowerCase().includes(search)) ||
        (r.mobile && r.mobile.includes(search)) ||
        (r.address && r.address.toLowerCase().includes(search)) ||
        (r.city && r.city.toLowerCase().includes(search))
      );
    }

    const profiles = db.getProfiles().filter(p => p.role === 'retailer');

    const combined = retailers.map(r => {
      const p = profiles.find(pr => pr.retailer_id === r.id || pr.id === `p-ret-${r.id}`);
      return {
        ...r,
        profile_id: p?.id,
        email: p?.email,
        auth_active: p ? p.active : r.active
      };
    });

    return NextResponse.json({ success: true, count: combined.length, retailers: combined });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shop_name, owner_name, mobile, address, password, city, state_code, gstin, credit_limit, email } = body;

    if (!shop_name || !owner_name || !mobile || !address || !password) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: shop_name, owner_name, mobile, address, and password are required.'
      }, { status: 400 });
    }

    const result = db.createRetailerProfile({
      shop_name,
      owner_name,
      mobile,
      address,
      password,
      city,
      state_code,
      gstin,
      credit_limit,
      email
    });

    return NextResponse.json({
      success: true,
      message: 'Retailer Profile created successfully',
      data: result
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to create retailer' }, { status: 400 });
  }
}
