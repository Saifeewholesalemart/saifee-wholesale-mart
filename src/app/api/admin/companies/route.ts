import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/companies - List all registered companies / manufacturers
export async function GET() {
  try {
    const companies = db.getCompanies();
    return NextResponse.json({
      success: true,
      count: companies.length,
      companies
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

// POST /api/admin/companies - Create a new company / manufacturer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 }
      );
    }

    const created = db.createCompany(name.trim(), code?.trim() || undefined);
    return NextResponse.json({
      success: true,
      message: `Company "${created.name}" created successfully`,
      company: created
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create company' },
      { status: 400 }
    );
  }
}
