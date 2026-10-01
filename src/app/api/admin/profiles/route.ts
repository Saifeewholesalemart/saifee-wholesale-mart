import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const search = searchParams.get('search')?.toLowerCase().trim();

    let profiles = db.getProfiles();

    if (role) {
      profiles = profiles.filter(p => p.role === role);
    }

    if (search) {
      profiles = profiles.filter(p => 
        (p.name && p.name.toLowerCase().includes(search)) ||
        (p.email && p.email.toLowerCase().includes(search)) ||
        (p.mobile && p.mobile.includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      count: profiles.length,
      profiles
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to fetch profiles'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profileType } = body;

    if (profileType === 'retailer') {
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
    } else if (profileType === 'salesperson') {
      const { name, mobile, password, role, assigned_company_ids, assigned_category_ids, email } = body;

      if (!name || !mobile || !password || !role) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: name, mobile, password, and role (sales_dist or sales_co) are required.'
        }, { status: 400 });
      }

      if (role === 'sales_co') {
        if (!assigned_company_ids || !Array.isArray(assigned_company_ids) || assigned_company_ids.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Company Salesperson requires selecting at least one Company / Manufacturer.'
          }, { status: 400 });
        }
        if (!assigned_category_ids || !Array.isArray(assigned_category_ids) || assigned_category_ids.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Company Salesperson requires selecting at least one Category.'
          }, { status: 400 });
        }
      }

      const profile = db.createSalespersonProfile({
        name,
        mobile,
        password,
        role,
        assigned_company_ids,
        assigned_category_ids,
        email
      });

      return NextResponse.json({
        success: true,
        message: 'Salesperson Profile created successfully',
        data: profile
      }, { status: 201 });
    } else if (profileType === 'staff') {
      const { full_name, name, contact_no, mobile, password, custom_role, email } = body;
      const staffName = full_name || name;
      const staffContact = contact_no || mobile;

      if (!staffName || !staffContact || !password || !custom_role) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields: full_name, contact_no, password, and custom_role are required.'
        }, { status: 400 });
      }

      const profile = db.createStaffProfile({
        full_name: staffName,
        contact_no: staffContact,
        password,
        custom_role,
        email
      });

      return NextResponse.json({
        success: true,
        message: 'Staff / Job Worker Profile created successfully',
        data: profile
      }, { status: 201 });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid profileType. Must be "retailer", "salesperson", or "staff".'
      }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to create profile'
    }, { status: 400 });
  }
}
