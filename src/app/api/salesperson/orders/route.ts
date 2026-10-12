import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/salesperson/orders
 * Returns orders scoped to the salesperson role & brand/category assignment.
 * Query parameters:
 *  - salesperson_id (optional, defaults to current session user or header)
 *  - retailer_id (optional, filter orders for a specific retailer)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const salespersonId = 
      searchParams.get('salesperson_id') || 
      req.headers.get('x-salesperson-id') || 
      db.getCurrentUser()?.id;
    const retailerId = searchParams.get('retailer_id') || undefined;

    if (!salespersonId) {
      return NextResponse.json({
        success: false,
        error: 'Authentication Required: salesperson_id must be provided in query parameters or x-salesperson-id header.'
      }, { status: 401 });
    }

    const profile = db.getProfiles().find(p => p.id === salespersonId);
    if (!profile) {
      return NextResponse.json({
        success: false,
        error: `Salesperson profile not found with ID: ${salespersonId}`
      }, { status: 404 });
    }

    // Verify profile belongs to salesperson or admin
    const isValidSalesRole = 
      profile.role === 'sales_dist' || 
      profile.role === 'sales_co' || 
      profile.role === 'admin' ||
      profile.profile_type === 'SALESPERSON';

    if (!isValidSalesRole) {
      return NextResponse.json({
        success: false,
        error: `Unauthorized: User role '${profile.role}' is not authorized for salesperson order APIs.`
      }, { status: 403 });
    }

    // Query scoped orders strictly enforcing brand/category isolation
    const orders = db.getScopedOrdersForSalesperson(salespersonId, { retailerId });

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
