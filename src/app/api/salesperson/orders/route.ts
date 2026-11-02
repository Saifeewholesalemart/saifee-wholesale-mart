import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/authSession';

/**
 * GET /api/salesperson/orders
 * Returns orders scoped to the authenticated salesperson role & brand/category assignment.
 * Session verification enforced: client-supplied salesperson ID is NEVER trusted for non-admins.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({
        success: false,
        error: 'Authentication Required: Please log in to view scoped orders.'
      }, { status: 401 });
    }

    const { session, profile: authProfile } = auth;
    const isAdmin = session.role === 'admin' || session.profileType === 'ADMIN';
    const isSalesperson = 
      session.role === 'sales_dist' || 
      session.role === 'sales_co' || 
      session.profileType === 'SALESPERSON';

    if (!isAdmin && !isSalesperson) {
      return NextResponse.json({
        success: false,
        error: `Unauthorized: User role '${session.role}' is not authorized for salesperson order APIs.`
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const retailerId = searchParams.get('retailer_id') || undefined;

    // Strict Authorization: Salespersons CANNOT spoof another salesperson ID.
    // Only verified Administrators can query on behalf of another salesperson ID.
    let targetSalespersonId = session.userId;
    if (isAdmin && searchParams.get('salesperson_id')) {
      targetSalespersonId = searchParams.get('salesperson_id')!;
    }

    const profile = db.getProfiles().find(p => p.id === targetSalespersonId);
    if (!profile) {
      return NextResponse.json({
        success: false,
        error: `Salesperson profile not found with ID: ${targetSalespersonId}`
      }, { status: 404 });
    }

    // Query scoped orders strictly enforcing brand/category isolation
    const orders = db.getScopedOrdersForSalesperson(targetSalespersonId, { retailerId });

    const isRestricted = profile.role === 'sales_co' || profile.sales_role_type === 'COMPANY' || profile.trade_scope === 'RESTRICTED';
    const companies = db.getCompanies();
    const categories = db.getCategories();

    const assignedCompanyNames = (profile.assigned_company_ids || (profile.company_id ? [profile.company_id] : []))
      .map(cid => companies.find(c => c.id === cid)?.name)
      .filter(Boolean);

    const assignedCategoryNames = (profile.assigned_category_ids || [])
      .map(catId => categories.find(c => c.id === catId)?.name)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      count: orders.length,
      salesperson: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        role: profile.role,
        sales_role_type: profile.role === 'sales_dist' ? 'DISTRIBUTOR' : 'COMPANY',
        role_display: profile.role === 'sales_co' ? 'Company Salesperson' : 'Distributor Salesperson',
        is_restricted: isRestricted,
        scope_summary: !isRestricted 
          ? 'Full Catalog Access (All Brands & Categories)'
          : `${assignedCompanyNames.length} Companies (${assignedCompanyNames.join(', ')}), ${assignedCategoryNames.length} Categories`,
        assigned_company_ids: profile.assigned_company_ids || (profile.company_id ? [profile.company_id] : []),
        assigned_company_names: assignedCompanyNames,
        assigned_category_ids: profile.assigned_category_ids || [],
        assigned_category_names: assignedCategoryNames
      },
      orders
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Server error occurred while fetching scoped orders.'
    }, { status: 500 });
  }
}
