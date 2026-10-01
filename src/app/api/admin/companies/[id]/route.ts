import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/companies/[id] - Get single company
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const companies = db.getCompanies();
    const company = companies.find(c => c.id === id);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    const linkedProducts = db.getAllProducts().filter(p => p.company_id === id);

    return NextResponse.json({
      success: true,
      company,
      linkedProductCount: linkedProducts.length
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/companies/[id] - Permanently delete company with foreign key / cascade options
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let action: 'unlink' | 'cascade' | 'error' = 'error';

    // Parse query param or body
    const url = new URL(req.url);
    const queryAction = url.searchParams.get('action');
    if (queryAction === 'unlink' || queryAction === 'cascade' || queryAction === 'error') {
      action = queryAction;
    } else {
      try {
        const body = await req.json();
        if (body?.action && (body.action === 'unlink' || body.action === 'cascade' || body.action === 'error')) {
          action = body.action;
        }
      } catch {}
    }

    const res = db.deleteCompany(id, { handleLinkedProducts: action });

    if (!res.success) {
      return NextResponse.json(
        {
          success: false,
          error: res.message || 'Cannot delete company',
          affectedProducts: res.affectedProducts || 0
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: res.message || 'Company permanently deleted successfully',
      affectedProducts: res.affectedProducts || 0
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete company' },
      { status: 500 }
    );
  }
}
