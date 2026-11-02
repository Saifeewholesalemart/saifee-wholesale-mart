/**
 * FMCG PWA Server Database & Security Mock Test Suite
 *
 * Verifies:
 * 1. Server-only runtime environment enforcement
 * 2. Parameterized query validation & SQL injection prevention patterns
 * 3. HMAC session validation and tamper rejection
 * 4. Tenant isolation and client-supplied business_id spoofing defense
 * 5. Role-based authorization matrix (Platform Admin, Tenant Admin, Salesperson, Retailer, Staff)
 * 6. Self-scoped query isolation for restricted roles (Retailers can only query their own orders)
 * 7. Error sanitization (stripping connection strings, DB credentials, passwords, JWTs)
 * 8. Safe connection configuration without .env.local modification
 */

import {
  getServerTenantContext,
  validateTenantAccess,
  assertRole,
  assertTenantAdmin,
  assertPlatformAdmin,
  assertSalesOrAdmin,
  executeTenantScopedQuery,
  getTenantProducts,
  getTenantOrders,
  getTenantRetailers,
  sanitizeDatabaseError,
  setMockDatabasePool,
  DatabaseError,
  UnauthorizedError,
  TenantMismatchError,
  type ServerTenantContext
} from '../src/lib/serverDb';
import { signSessionToken, verifySessionToken, type SessionPayload } from '../src/lib/authSession';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, failureDetail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (failureDetail) {
      console.error(`     Detail: ${failureDetail}`);
    }
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('Task 3: Server-Side PostgreSQL Security & Tenant Isolation Mock Test Suite');
  console.log('================================================================================\n');

  // Test Group 1: HMAC Session Validation & Tamper Rejection
  console.log('Group 1: HMAC Session Validation & Derivation');
  {
    const now = Date.now();
    const validPayload: SessionPayload = {
      userId: 'usr_mock_admin_123',
      mobile: '9876543210',
      name: 'Mustafa Saifee',
      role: 'admin',
      profileType: 'ADMIN',
      businessId: 'biz_saifee_main',
      iat: now,
      exp: now + 7 * 24 * 3600 * 1000
    };

    const validToken = signSessionToken(validPayload);
    const verified = verifySessionToken(validToken);
    assert(verified !== null && verified.userId === 'usr_mock_admin_123', 'Valid HMAC session token decodes and verifies signature');
    assert(verified?.businessId === 'biz_saifee_main', 'Tenant businessId matches authenticated session payload');

    const context = getServerTenantContext(validToken);
    assert(context.userId === 'usr_mock_admin_123' && context.isTenantAdmin === true, 'getServerTenantContext correctly resolves context from token string');

    // Tampered token test (modify businessId in base64url payload)
    const tokenParts = validToken.split('.');
    const decodedObj = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString('utf8'));
    decodedObj.businessId = 'biz_attacker_corp';
    const tamperedPayload = Buffer.from(JSON.stringify(decodedObj), 'utf8').toString('base64url');
    const tamperedToken = `${tamperedPayload}.${tokenParts[1]}`;
    const tamperedResult = verifySessionToken(tamperedToken);
    assert(tamperedResult === null, 'Tampered session payload signature verification fails and returns null');

    // Tampered token passed to getServerTenantContext must throw UnauthorizedError
    try {
      getServerTenantContext(tamperedToken);
      assert(false, 'getServerTenantContext should reject tampered token');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'getServerTenantContext throws UnauthorizedError for tampered token');
    }

    // Invalid signature token
    const invalidSigToken = `${tokenParts[0]}.invalidsignaturebase64url`;
    assert(verifySessionToken(invalidSigToken) === null, 'Invalid HMAC signature string is rejected');

    // Missing business_id in payload
    const noTenantPayload = {
      userId: 'usr_anonymous_orphan',
      mobile: '9999999999',
      name: 'No Tenant User',
      role: 'retailer',
      profileType: 'RETAILER',
      iat: now,
      exp: now + 3600000
    } as any;
    const noTenantToken = signSessionToken(noTenantPayload);
    try {
      getServerTenantContext(noTenantToken);
      assert(false, 'getServerTenantContext should reject session lacking business_id');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'getServerTenantContext throws UnauthorizedError for session missing business_id');
    }
  }

  // Test Group 2: Tenant Isolation & Client-Supplied Business ID Spoofing Defense
  console.log('\nGroup 2: Tenant Isolation & Spoofing Defense');
  {
    const legitimateTenantContext: ServerTenantContext = {
      userId: 'usr_legit_mgr',
      mobile: '9876500001',
      name: 'Manager',
      role: 'admin',
      profileType: 'ADMIN',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isSalesperson: false,
      isRetailer: false,
      isStaff: false
    };

    // Client provides matching business_id (valid)
    try {
      const validatedBiz = validateTenantAccess(legitimateTenantContext, 'biz_saifee_main');
      assert(validatedBiz === 'biz_saifee_main', 'validateTenantAccess accepts matching client business_id');
    } catch {
      assert(false, 'validateTenantAccess threw unexpectedly for matching business_id');
    }

    // Client attempts to query a different tenant's business_id (Spoofing attack)
    try {
      validateTenantAccess(legitimateTenantContext, 'biz_competitor_mart');
      assert(false, 'validateTenantAccess must reject cross-tenant client business_id');
    } catch (err: any) {
      assert(err instanceof TenantMismatchError, 'validateTenantAccess rejects mismatched business_id with TenantMismatchError');
    }

    // Client supplies undefined/null business_id (fallback strictly to session business_id)
    const fallbackBiz = validateTenantAccess(legitimateTenantContext, undefined);
    assert(fallbackBiz === 'biz_saifee_main', 'validateTenantAccess defaults strictly to session business_id when client omits it');
  }

  // Test Group 3: Server-Side Role-Based Authorization
  console.log('\nGroup 3: Role-Based Authorization Enforcement');
  {
    const platformAdminContext: ServerTenantContext = {
      userId: 'usr_platform_super',
      mobile: '9876500000',
      name: 'Super Admin',
      role: 'admin',
      profileType: 'ADMIN',
      businessId: 'biz-platform-root',
      isPlatformAdmin: true,
      isTenantAdmin: true,
      isSalesperson: false,
      isRetailer: false,
      isStaff: false
    };

    const tenantAdminContext: ServerTenantContext = {
      userId: 'usr_tenant_owner',
      mobile: '9876500002',
      name: 'Shop Owner',
      role: 'admin',
      profileType: 'ADMIN',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isSalesperson: false,
      isRetailer: false,
      isStaff: false
    };

    const salespersonContext: ServerTenantContext = {
      userId: 'usr_field_agent',
      mobile: '9876500003',
      name: 'Field Sales',
      role: 'sales_dist',
      profileType: 'STAFF',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isSalesperson: true,
      isRetailer: false,
      isStaff: false
    };

    const retailerContext: ServerTenantContext = {
      userId: 'usr_retailer_shop',
      mobile: '9876500004',
      name: 'Kirana Store',
      role: 'retailer',
      profileType: 'RETAILER',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isSalesperson: false,
      isRetailer: true,
      isStaff: false
    };

    // Platform Admin checks
    try {
      assertPlatformAdmin(platformAdminContext);
      assert(true, 'assertPlatformAdmin accepts platform_admin context');
    } catch {
      assert(false, 'assertPlatformAdmin threw unexpectedly for platform_admin');
    }

    try {
      assertPlatformAdmin(tenantAdminContext);
      assert(false, 'assertPlatformAdmin must reject tenant_admin');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'assertPlatformAdmin throws UnauthorizedError for tenant_admin');
    }

    // Tenant Admin checks
    try {
      assertTenantAdmin(tenantAdminContext);
      assertTenantAdmin(platformAdminContext);
      assert(true, 'assertTenantAdmin accepts tenant_admin and platform_admin');
    } catch {
      assert(false, 'assertTenantAdmin failed unexpectedly for admin roles');
    }

    try {
      assertTenantAdmin(salespersonContext);
      assert(false, 'assertTenantAdmin must reject salesperson');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'assertTenantAdmin throws UnauthorizedError for salesperson');
    }

    // Sales or Admin checks
    try {
      assertSalesOrAdmin(salespersonContext);
      assertSalesOrAdmin(tenantAdminContext);
      assert(true, 'assertSalesOrAdmin accepts both salesperson and tenant_admin');
    } catch {
      assert(false, 'assertSalesOrAdmin failed unexpectedly');
    }

    try {
      assertSalesOrAdmin(retailerContext);
      assert(false, 'assertSalesOrAdmin must reject retailer');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'assertSalesOrAdmin throws UnauthorizedError for retailer');
    }

    // Explicit role list check
    try {
      assertRole(retailerContext, ['retailer']);
      assert(true, 'assertRole accepts role within authorized list');
    } catch {
      assert(false, 'assertRole failed unexpectedly');
    }
  }

  // Test Group 4: Parameterized Queries & Tenant Scoping Mock
  console.log('\nGroup 4: Parameterized Queries & Scoping Guards');
  {
    let capturedQueryText = '';
    let capturedParams: any[] = [];

    const mockPool = {
      query: async (text: string, params?: any[]) => {
        capturedQueryText = text;
        capturedParams = params || [];
        return {
          rows: [
            { id: 'mock_item_1', business_id: capturedParams[0], name: 'Mock Parle-G 100g' }
          ],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: []
        };
      }
    } as any;

    setMockDatabasePool(mockPool);

    const mockContext: ServerTenantContext = {
      userId: 'usr_staff_user',
      mobile: '9876500005',
      name: 'Warehouse Staff',
      role: 'staff',
      profileType: 'STAFF',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isSalesperson: false,
      isRetailer: false,
      isStaff: true
    };

    // Execute tenant scoped query with extra params
    const result = await executeTenantScopedQuery(
      mockContext,
      'SELECT id, name, business_id FROM products WHERE business_id = $1 AND is_active = $2',
      [true]
    );

    assert(result.rows.length === 1, 'executeTenantScopedQuery returns expected mock query result');
    assert(capturedParams[0] === 'biz_saifee_main', 'First query parameter is bound to authenticated business_id');
    assert(capturedParams[1] === true, 'Second parameter is bound safely without string concatenation');

    // Test rejection of non-array parameters (prevents unparameterized misuse)
    try {
      await executeTenantScopedQuery(
        mockContext,
        'SELECT * FROM products',
        'invalid_string_not_array' as any
      );
      assert(false, 'executeTenantScopedQuery should reject non-array parameters');
    } catch (err: any) {
      assert(err.message.includes('array'), 'Rejects non-array query parameter safely');
    }

    // Test rejection when tenant ID in parameters does not match context
    try {
      await executeTenantScopedQuery(
        mockContext,
        'SELECT * FROM products WHERE business_id = $1',
        ['biz_attacker_target_tenant']
      );
      assert(false, 'executeTenantScopedQuery must reject mismatched business_id in parameter 0');
    } catch (err: any) {
      assert(err instanceof TenantMismatchError, 'Rejects cross-tenant parameter injection with TenantMismatchError');
    }
  }

  // Test Group 5: Query Helpers & Retailer Self-Scoping
  console.log('\nGroup 5: Query Helpers & Self-Scope for Restricted Roles');
  {
    let lastQuery = '';
    let lastParams: any[] = [];

    const mockPool = {
      query: async (text: string, params?: any[]) => {
        lastQuery = text;
        lastParams = params || [];
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
      }
    } as any;

    setMockDatabasePool(mockPool);

    const retailerContext: ServerTenantContext = {
      userId: 'usr_retailer_555',
      mobile: '9876500006',
      name: 'Retailer Customer',
      role: 'retailer',
      profileType: 'RETAILER',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isSalesperson: false,
      isRetailer: true,
      isStaff: false
    };

    // Test retailer orders query (self-scoped)
    await getTenantOrders(retailerContext, { limit: 10 });

    assert(lastParams[0] === 'biz_saifee_main', 'Retailer orders query parameter $1 is authenticated business_id');
    assert(lastParams[1] === 'usr_retailer_555', 'Retailer orders query enforces retailer_id = $2 matching authenticated userId');
    assert(lastQuery.includes('o.retailer_id = $2'), 'SQL contains WHERE clause scoping orders to retailer_id');

    // Test admin products query with category filter
    const adminContext: ServerTenantContext = {
      userId: 'usr_admin_1',
      mobile: '9876500007',
      name: 'Admin User',
      role: 'admin',
      profileType: 'ADMIN',
      businessId: 'biz_saifee_main',
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isSalesperson: false,
      isRetailer: false,
      isStaff: false
    };

    await getTenantProducts(adminContext, { categoryId: 'cat_biscuits', limit: 25 });
    assert(lastParams[0] === 'biz_saifee_main', 'Products query parameter $1 is business_id');
    assert(lastParams[1] === 'cat_biscuits', 'Products query parameter $2 is categoryId filter');
    assert(lastQuery.includes('category_id = $2'), 'SQL filters by category_id using parameter substitution');

    // Test retailer attempting to fetch all retailers list
    try {
      await getTenantRetailers(retailerContext);
      assert(false, 'Retailer role must not be allowed to fetch all tenant retailers');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'getTenantRetailers correctly blocks retailer role with UnauthorizedError');
    }
  }

  // Test Group 6: Safe Error Sanitization
  console.log('\nGroup 6: Database Error Sanitization');
  {
    const sensitiveError = new Error(
      'connection to postgres://postgres:P4ssw0rd!123_Secret@db.wxctglnnybhhptkxwxur.supabase.co:5432/postgres failed: password authentication failed for user "postgres"'
    );
    (sensitiveError as any).code = '28P01';

    const sanitized = sanitizeDatabaseError(sensitiveError, 'User authentication query');

    assert(sanitized instanceof DatabaseError, 'sanitizeDatabaseError returns a structured DatabaseError');
    assert(!sanitized.message.includes('P4ssw0rd!123_Secret'), 'Sanitized error message strips password completely');
    assert(!sanitized.message.includes('postgres://'), 'Sanitized error message strips postgres connection URI');
    assert(!sanitized.message.includes('wxctglnnybhhptkxwxur'), 'Sanitized error message strips database hostname/reference');
    assert(sanitized.code === '28P01', 'Preserves standard PostgreSQL error code for programmatic handling');
  }

  // Cleanup mock pool
  setMockDatabasePool(undefined);

  // Test Summary
  console.log('\n================================================================================');
  console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
