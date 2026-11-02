/**
 * Comprehensive Route-Level Authorization & Negative Testing Suite
 * Saifee General Stores FMCG Distributor ERP
 * File: scripts/test_route_auth.ts
 */

import assert from 'assert';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { db } from '../src/lib/db';
import { signSessionToken, SESSION_COOKIE_NAME, SessionPayload } from '../src/lib/authSession';

// Import Actual Next.js Route Handlers
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { GET as meHandler } from '../src/app/api/auth/me/route';
import { POST as logoutHandler } from '../src/app/api/auth/logout/route';
import { GET as companiesGetHandler, POST as companiesPostHandler } from '../src/app/api/admin/companies/route';
import { GET as companyGetHandler, DELETE as companyDeleteHandler } from '../src/app/api/admin/companies/[id]/route';
import { GET as profilesGetHandler, POST as profilesPostHandler } from '../src/app/api/admin/profiles/route';
import { GET as profileGetHandler, PUT as profilePutHandler, PATCH as profilePatchHandler } from '../src/app/api/admin/profiles/[id]/route';
import { GET as backupExportHandler } from '../src/app/api/admin/backup/export/route';
import { GET as snapshotGetHandler, POST as snapshotPostHandler, DELETE as snapshotDeleteHandler } from '../src/app/api/admin/backup/snapshot/route';
import { GET as snapshotsListHandler } from '../src/app/api/admin/backup/snapshots/route';
import { POST as backupRestoreHandler } from '../src/app/api/admin/backup/restore/route';
import { GET as salespersonOrdersHandler } from '../src/app/api/salesperson/orders/route';
import { GET as salespersonOrderByIdHandler } from '../src/app/api/salesperson/orders/[id]/route';

console.log('================================================================================');
console.log('FMCG ERP: Phase 1 Actual Route Authorization & Negative Case Regression Suite');
console.log('================================================================================\n');

// Mock helpers for creating NextRequest instances with cookies and headers
function createMockRequest(
  url: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): NextRequest {
  const method = options.method || 'GET';
  const headers = new Headers({
    'host': 'localhost:3000',
    ...(options.headers || {})
  });

  if (options.token) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.token}`);
  }

  const reqInit: any = {
    method,
    headers
  };

  if (options.body && method !== 'GET' && method !== 'HEAD') {
    reqInit.body = JSON.stringify(options.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), reqInit);
}

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  function runCase(name: string, fn: () => Promise<void>) {
    return fn()
      .then(() => {
        console.log(`  [PASS] ${name}`);
        passedCount++;
      })
      .catch((err: any) => {
        console.error(`  [FAIL] ${name}:`, err.message);
        failedCount++;
      });
  }

  // Pre-seed test profiles in memory database
  const profiles = db.getProfiles();
  
  // 1. Valid Admin Profile
  let adminProfile = profiles.find(p => p.role === 'admin');
  if (!adminProfile) {
    adminProfile = {
      id: 'p-admin-test',
      email: 'admin@saifee.com',
      name: 'Saifee Admin',
      role: 'admin',
      profile_type: 'ADMIN',
      mobile: '9826011111',
      password_hash: bcrypt.hashSync('AdminPassword123!', 10),
      active: true,
      status: 'ACTIVE'
    };
    profiles.push(adminProfile);
  } else {
    adminProfile.password_hash = bcrypt.hashSync('AdminPassword123!', 10);
    delete (adminProfile as any).password;
    adminProfile.active = true;
    adminProfile.status = 'ACTIVE';
  }

  // 2. Valid Retailer Profile
  let retailerProfile = profiles.find(p => p.role === 'retailer');
  if (!retailerProfile) {
    retailerProfile = {
      id: 'p-retailer-test',
      email: 'retailer@shop.com',
      name: 'Shree Krishna Kirana',
      role: 'retailer',
      profile_type: 'RETAILER',
      mobile: '9826022222',
      password_hash: bcrypt.hashSync('RetailerPassword123!', 10),
      active: true,
      status: 'ACTIVE'
    };
    profiles.push(retailerProfile);
  } else {
    retailerProfile.password_hash = bcrypt.hashSync('RetailerPassword123!', 10);
    delete (retailerProfile as any).password;
    retailerProfile.active = true;
    retailerProfile.status = 'ACTIVE';
  }

  // 3. Valid Salesperson Profile
  let salesProfile = profiles.find(p => p.role === 'sales_dist');
  if (!salesProfile) {
    salesProfile = {
      id: 'p-sales-test',
      email: 'sales@saifee.com',
      name: 'Ramesh Sales',
      role: 'sales_dist',
      profile_type: 'SALESPERSON',
      mobile: '9826033333',
      password_hash: bcrypt.hashSync('SalesPassword123!', 10),
      active: true,
      status: 'ACTIVE'
    };
    profiles.push(salesProfile);
  } else {
    salesProfile.password_hash = bcrypt.hashSync('SalesPassword123!', 10);
    delete (salesProfile as any).password;
    salesProfile.active = true;
    salesProfile.status = 'ACTIVE';
  }

  // 4. Deactivated Profile
  let deactivatedProfile = profiles.find(p => p.id === 'p-deactivated-test');
  if (!deactivatedProfile) {
    deactivatedProfile = {
      id: 'p-deactivated-test',
      email: 'deactivated@saifee.com',
      name: 'Deactivated User',
      role: 'staff',
      profile_type: 'STAFF',
      mobile: '9826044444',
      password_hash: bcrypt.hashSync('StaffPassword123!', 10),
      active: false,
      status: 'INACTIVE'
    };
    profiles.push(deactivatedProfile);
  } else {
    deactivatedProfile.password_hash = bcrypt.hashSync('StaffPassword123!', 10);
    delete (deactivatedProfile as any).password;
  }

  db.saveProfiles(profiles);

  // Helper token generators
  const makeToken = (profile: any, overrides: Partial<SessionPayload> = {}) => {
    return signSessionToken({
      userId: profile.id,
      mobile: profile.mobile,
      name: profile.name,
      role: profile.role,
      profileType: profile.profile_type,
      businessId: 'biz-saifee',
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      ...overrides
    });
  };

  const adminToken = makeToken(adminProfile);
  const retailerToken = makeToken(retailerProfile);
  const salesToken = makeToken(salesProfile);
  const deactivatedToken = makeToken(deactivatedProfile);

  console.log('--- TEST GROUP 1: Route Authentication & Negative Credentials ---');

  await runCase('Unauthenticated request to GET /api/admin/companies returns 401', async () => {
    const req = createMockRequest('/api/admin/companies');
    const res = await companiesGetHandler(req);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runCase('Unauthenticated request to GET /api/admin/backup/export returns 401', async () => {
    const req = createMockRequest('/api/admin/backup/export');
    const res = await backupExportHandler(req);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runCase('Unauthenticated request to GET /api/admin/backup/snapshots returns 401', async () => {
    const req = createMockRequest('/api/admin/backup/snapshots');
    const res = await snapshotsListHandler(req);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runCase('Tampered signature token returns 401', async () => {
    const parts = adminToken.split('.');
    const tamperedToken = `${parts[0]}.forged_invalid_signature_hex_123456`;
    const req = createMockRequest('/api/admin/companies', { token: tamperedToken });
    const res = await companiesGetHandler(req);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runCase('Expired session token returns 401', async () => {
    const expiredToken = makeToken(adminProfile, {
      exp: Date.now() - 10000 // 10 seconds in the past
    });
    const req = createMockRequest('/api/admin/companies', { token: expiredToken });
    const res = await companiesGetHandler(req);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  console.log('\n--- TEST GROUP 2: Role-Based Authorization & Privilege Escalation Defenses ---');

  await runCase('Retailer token accessing GET /api/admin/companies is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/companies', { token: retailerToken });
    const res = await companiesGetHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await runCase('Retailer token accessing GET /api/admin/backup/export is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/backup/export', { token: retailerToken });
    const res = await backupExportHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await runCase('Retailer token accessing POST /api/admin/backup/snapshot is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/backup/snapshot', {
      method: 'POST',
      token: retailerToken,
      headers: { 'origin': 'http://localhost:3000' }
    });
    const res = await snapshotPostHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await runCase('Retailer token accessing POST /api/admin/backup/restore is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/backup/restore', {
      method: 'POST',
      token: retailerToken,
      headers: { 'origin': 'http://localhost:3000' },
      body: { tables: {} }
    });
    const res = await backupRestoreHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await runCase('Retailer token accessing GET /api/salesperson/orders is rejected with 403', async () => {
    const req = createMockRequest('/api/salesperson/orders', { token: retailerToken });
    const res = await salespersonOrdersHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await runCase('Salesperson token accessing GET /api/admin/profiles is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/profiles', { token: salesToken });
    const res = await profilesGetHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await runCase('Salesperson querying orders cannot spoof salesperson_id query param', async () => {
    const req = createMockRequest(`/api/salesperson/orders?salesperson_id=spoofed-id-other`, { token: salesToken });
    const res = await salespersonOrdersHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    // Salesperson summary must belong to authenticated user, not spoofed target
    assert.strictEqual(data.salesperson.id, salesProfile.id);
  });

  console.log('\n--- TEST GROUP 3: Live Server Account Revalidation (Deactivation Defense) ---');

  await runCase('Deactivated account with cryptographically valid token is rejected with 401', async () => {
    const req = createMockRequest('/api/admin/companies', { token: deactivatedToken });
    const res = await companiesGetHandler(req);
    assert.strictEqual(res.status, 401, `Deactivated account must be rejected with 401, got ${res.status}`);
  });

  await runCase('Deactivated account accessing GET /api/auth/me returns authenticated: false', async () => {
    const req = createMockRequest('/api/auth/me', { token: deactivatedToken });
    const res = await meHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authenticated, false);
    assert.strictEqual(data.user, null);
  });

  console.log('\n--- TEST GROUP 4: CSRF Origin Protection on Mutations ---');

  await runCase('Cross-site mutation (Sec-Fetch-Site: cross-site) is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/companies', {
      method: 'POST',
      token: adminToken,
      headers: {
        'sec-fetch-site': 'cross-site',
        'origin': 'https://evil-attacker.com'
      },
      body: { name: 'Malicious Company' }
    });
    const res = await companiesPostHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403 CSRF rejection, got ${res.status}`);
    const data = await res.json();
    assert(data.error.includes('Cross-site request rejected'));
  });

  await runCase('Mismatching Origin header on mutation is rejected with 403', async () => {
    const req = createMockRequest('/api/admin/companies', {
      method: 'POST',
      token: adminToken,
      headers: {
        'origin': 'https://attacker.evil.com',
        'host': 'localhost:3000'
      },
      body: { name: 'Malicious Company' }
    });
    const res = await companiesPostHandler(req);
    assert.strictEqual(res.status, 403, `Expected 403 CSRF rejection, got ${res.status}`);
  });

  await runCase('Matching Origin on mutation succeeds for Administrator', async () => {
    const req = createMockRequest('/api/admin/companies', {
      method: 'POST',
      token: adminToken,
      headers: {
        'origin': 'http://localhost:3000',
        'host': 'localhost:3000'
      },
      body: { name: `Test Brand ${Date.now()}`, code: 'TB' }
    });
    const res = await companiesPostHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  console.log('\n--- TEST GROUP 5: Credential Leakage Prevention Across All Surfaces ---');

  await runCase('POST /api/auth/login does NOT leak password or password_hash in response', async () => {
    const req = createMockRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'origin': 'http://localhost:3000' },
      body: { mobile: adminProfile.mobile, password: 'AdminPassword123!' }
    });
    const res = await loginHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.password, undefined, 'password must not be in user payload');
    assert.strictEqual(data.user.password_hash, undefined, 'password_hash must not be in user payload');
  });

  await runCase('GET /api/auth/me does NOT leak password or password_hash in response', async () => {
    const req = createMockRequest('/api/auth/me', { token: adminToken });
    const res = await meHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.user.password, undefined);
    assert.strictEqual(data.user.password_hash, undefined);
  });

  await runCase('GET /api/admin/profiles does NOT leak password fields on any user', async () => {
    const req = createMockRequest('/api/admin/profiles', { token: adminToken });
    const res = await profilesGetHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.profiles.length > 0);
    for (const p of data.profiles) {
      assert.strictEqual(p.password, undefined, `password leaked on profile ${p.id}`);
      assert.strictEqual(p.password_hash, undefined, `password_hash leaked on profile ${p.id}`);
    }
  });

  await runCase('GET /api/admin/backup/export sanitizes both profiles AND retailers', async () => {
    const req = createMockRequest('/api/admin/backup/export', { token: adminToken });
    const res = await backupExportHandler(req);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    const backup = JSON.parse(text);
    assert(backup.tables.profiles && backup.tables.profiles.length > 0);
    for (const p of backup.tables.profiles) {
      assert.strictEqual(p.password, undefined, `password leaked in backup profile ${p.id}`);
      assert.strictEqual(p.password_hash, undefined, `password_hash leaked in backup profile ${p.id}`);
    }
    if (backup.tables.retailers) {
      for (const r of backup.tables.retailers) {
        assert.strictEqual(r.password, undefined, `password leaked in backup retailer ${r.id}`);
        assert.strictEqual(r.password_hash, undefined, `password_hash leaked in backup retailer ${r.id}`);
      }
    }
  });

  console.log('\n--- TEST GROUP 6: Strict Password Comparison & Timing Attack Defense ---');

  await runCase('Login rejects incorrect password with 401', async () => {
    const req = createMockRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'origin': 'http://localhost:3000' },
      body: { mobile: adminProfile.mobile, password: 'WrongPassword999' }
    });
    const res = await loginHandler(req);
    assert.strictEqual(res.status, 401);
  });

  await runCase('Login rejects case-altered password (case sensitivity strictly enforced)', async () => {
    const req = createMockRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'origin': 'http://localhost:3000' },
      body: { mobile: adminProfile.mobile, password: 'adminpassword123!' } // lowercase variant of AdminPassword123!
    });
    const res = await loginHandler(req);
    assert.strictEqual(res.status, 401, 'Case-altered password must be rejected');
  });

  await runCase('Universal bypass passwords (e.g. 123456 or saifee123) are rejected', async () => {
    const req = createMockRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'origin': 'http://localhost:3000' },
      body: { mobile: adminProfile.mobile, password: '123456' }
    });
    const res = await loginHandler(req);
    assert.strictEqual(res.status, 401, 'Universal password bypass must be rejected');
  });

  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: Passed: ${passedCount} | Failed: ${failedCount} | Total: ${passedCount + failedCount}`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
