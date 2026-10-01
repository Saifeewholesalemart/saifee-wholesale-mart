import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim();
    const type = searchParams.get('type'); // 'sales_dist' | 'sales_co'

    let profiles = db.getProfiles().filter(p => p.role === 'sales_dist' || p.role === 'sales_co');

    if (type) {
      profiles = profiles.filter(p => p.role === type);
    }

    if (search) {
      profiles = profiles.filter(p =>
        (p.name && p.name.toLowerCase().includes(search)) ||
        (p.email && p.email.toLowerCase().includes(search)) ||
        (p.mobile && p.mobile.includes(search))
      );
    }

    const companies = db.getCompanies();
    const categories = db.getCategories();

    const formatted = profiles.map(p => {
      const assignedCompanies = (p.assigned_company_ids || (p.company_id ? [p.company_id] : []))
        .map(cid => companies.find(c => c.id === cid)?.name)
        .filter(Boolean);

      const assignedCategories = (p.assigned_category_ids || [])
        .map(catId => categories.find(c => c.id === catId)?.name)
        .filter(Boolean);

      return {
        ...p,
        channel_code: p.role === 'sales_dist' ? 'CH_DIST_SALES' : 'CH_CO_SALES',
        channel_label: p.role === 'sales_dist' ? 'Distributor Salesperson' : 'Company Salesperson',
        assigned_company_names: assignedCompanies,
        assigned_category_names: assignedCategories,
        scope_summary: p.role === 'sales_dist' 
          ? 'Full Catalog Access (All Products, Companies & Categories)' 
          : `${assignedCompanies.length} Companies, ${assignedCategories.length} Categories`
      };
    });

    return NextResponse.json({ success: true, count: formatted.length, salespersons: formatted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, mobile, password, role, assigned_company_ids, assigned_category_ids, email } = body;

    if (!name || !mobile || !password || !role) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: name, mobile, password, and role are required.'
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to create salesperson' }, { status: 400 });
  }
}
