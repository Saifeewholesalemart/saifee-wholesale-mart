import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/salesperson/orders/[id]
 * Retrieves order details strictly scoped to salesperson's authorized brand/category scope.
 * If Company Salesperson, hides out-of-scope line items and recalculates scoped invoice totals.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.id;
    const { searchParams } = new URL(req.url);
    const salespersonId = 
      searchParams.get('salesperson_id') || 
      req.headers.get('x-salesperson-id') || 
      db.getCurrentUser()?.id;

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

    // Scoped order query
    const scopedOrder = db.getScopedOrderByIdForSalesperson(orderId, salespersonId);

    if (!scopedOrder) {
      // Check if order exists in general to provide a clear permission error
      const rawOrder = db.getOrders().find(o => o.id === orderId);
      if (rawOrder) {
        return NextResponse.json({
          success: false,
          error: 'Access Restricted: This order contains zero products within your assigned company / brand scope.',
          scoped_restricted: true
        }, { status: 403 });
      }
      return NextResponse.json({
        success: false,
        error: `Order with ID '${orderId}' not found.`
      }, { status: 404 });
    }

    const isRestricted = profile.role === 'sales_co' || profile.sales_role_type === 'COMPANY' || profile.trade_scope === 'RESTRICTED';
    const companies = db.getCompanies();
    const categories = db.getCategories();
    const retailers = db.getRetailers();
    const retailer = retailers.find(r => r.id === scopedOrder.retailer_id);

    const assignedCompanyNames = (profile.assigned_company_ids || (profile.company_id ? [profile.company_id] : []))
      .map(cid => companies.find(c => c.id === cid)?.name)
      .filter(Boolean);

    const assignedCategoryNames = (profile.assigned_category_ids || [])
      .map(catId => categories.find(c => c.id === catId)?.name)
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      salesperson: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        sales_role_type: profile.role === 'sales_dist' ? 'DISTRIBUTOR' : 'COMPANY',
        role_display: profile.role === 'sales_co' ? 'Company Salesperson' : 'Distributor Salesperson',
        is_restricted: isRestricted,
        assigned_company_names: assignedCompanyNames,
        assigned_category_names: assignedCategoryNames
      },
      retailer: retailer ? {
        id: retailer.id,
        shop_name: retailer.shop_name,
        owner_name: retailer.owner_name,
        mobile: retailer.mobile,
        address: retailer.address,
        city: retailer.city,
        state_code: retailer.state_code
      } : null,
      order: scopedOrder
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Server error occurred while fetching order details.'
    }, { status: 500 });
  }
}
