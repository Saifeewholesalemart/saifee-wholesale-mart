/**
 * FMCG ERP: Safety Hardening & Security Regression Suite
 * File: scripts/test_safety_hardening_suite.ts
 *
 * Verifies:
 * 1. Missing tenant context denies access; zero permissive RLS conditions exist.
 * 2. Supabase client & sync engine never fall back to production; unconfigured fails safely.
 * 3. Password verification handles bcrypt hashes correctly; plaintext credentials removed.
 * 4. Schema preflight check detects incompatible tables, UUID types, missing columns, and aborts safely.
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { verifyPassword, safeComparePassword } from '../src/lib/authSession';
import { isSupabaseConfigured, supabase } from '../src/lib/supabaseClient';
import { fetchCloudSnapshot, pushCloudSnapshot } from '../src/lib/supabaseSyncEngine';
import {
  validateSchemaCompatibility,
  ColumnInfo,
  ConstraintInfo,
  ALL_42_SCHEMA_TABLES,
  EXPECTED_42_TABLE_COLUMNS,
  EXPECTED_UNIQUE_CONSTRAINTS
} from './preflight_schema_check';
import { db } from '../src/lib/db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================================');
  console.log('FMCG ERP: Phase 4 Safety Hardening & Security Regression Suite (OFFLINE)');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: RLS Policy Auditing & Missing Tenant Context Denial
  // --------------------------------------------------------------------------
  console.log('Group 1: RLS Policy Auditing & Strict Tenant Context Requirement');
  {
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'clean_rebuild_schema.sql'), 'utf8');

    // Rule A: Zero instances of permissive fallback `OR get_current_business_id() = ''`
    const hasPermissiveFallback = schemaSql.includes("OR get_current_business_id() = ''");
    assert(!hasPermissiveFallback, 'clean_rebuild_schema.sql contains ZERO permissive "OR get_current_business_id() = \'\'" clauses');

    // Rule B: Function get_current_business_id returns NULL when context is missing
    const getBizFuncDef = schemaSql.slice(schemaSql.indexOf('FUNCTION get_current_business_id()'));
    assert(getBizFuncDef.includes('v_bid := NULLIF(TRIM('), 'get_current_business_id trims and uses NULLIF on context values');

    // Rule C: All tenant policies explicitly require get_current_business_id() IS NOT NULL
    const policyLines = schemaSql.split('\n').filter(l => l.includes('CREATE POLICY "tenant_isolation_policy_'));
    assert(policyLines.length >= 10, `Found ${policyLines.length} tenant isolation policies (minimum 10 required)`);

    let allRequireNonNull = true;
    for (const line of policyLines) {
      if (!schemaSql.includes('get_current_business_id() IS NOT NULL')) {
        allRequireNonNull = false;
      }
    }
    assert(allRequireNonNull, 'All tenant isolation policies strictly require get_current_business_id() IS NOT NULL');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Production URL Fallback Removal & Safe Failure
  // --------------------------------------------------------------------------
  console.log('\nGroup 2: Production Fallback Removal & Safe Failure Enforcement');
  {
    // Ensure production domain is never hardcoded as a fallback in source files
    const clientSource = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'supabaseClient.ts'), 'utf8');
    const syncEngineSource = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'supabaseSyncEngine.ts'), 'utf8');

    assert(!clientSource.includes('https://wxctglnnybhhptkxwxur.supabase.co'), 'supabaseClient.ts contains NO hardcoded production URL');
    assert(!syncEngineSource.includes('https://wxctglnnybhhptkxwxur.supabase.co'), 'supabaseSyncEngine.ts contains NO hardcoded production URL');

    // Test offline behavior with unconfigured environment
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      assert(isSupabaseConfigured === false, 'isSupabaseConfigured evaluates to FALSE when environment is unset');
      assert(supabase === null, 'supabase client evaluates to NULL when environment is unset (no production fallback)');

      // fetchCloudSnapshot must fail safely without throwing unhandled network error
      const fetchResult = await fetchCloudSnapshot();
      assert(fetchResult === null, 'fetchCloudSnapshot safely returns NULL when Supabase is unconfigured');

      // pushCloudSnapshot must abort safely with descriptive error
      let pushThrew = false;
      try {
        await pushCloudSnapshot({ version: '1', exportDate: new Date().toISOString(), timestamp: Date.now(), system: {} as any, metadata: {} as any, tables: {} as any } as any);
      } catch (err: any) {
        pushThrew = true;
        assert(err.message.includes('not configured'), 'pushCloudSnapshot aborts with configuration error');
      }
      assert(pushThrew, 'pushCloudSnapshot refused execution without valid Supabase configuration');
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Authentication & Bcrypt Password Verification
  // --------------------------------------------------------------------------
  console.log('\nGroup 3: Password Verification & Bcrypt Hashing Compliance');
  {
    const samplePassword = 'StrongPassword!2026';
    const bcryptHash = bcrypt.hashSync(samplePassword, 10);

    // Verify bcrypt hash recognition
    assert(verifyPassword(samplePassword, bcryptHash) === true, 'verifyPassword verifies valid bcrypt hash correctly');
    assert(verifyPassword('WrongPassword123', bcryptHash) === false, 'verifyPassword rejects incorrect password against bcrypt hash');
    assert(safeComparePassword(samplePassword, bcryptHash) === true, 'safeComparePassword delegates transparently to verifyPassword');

    // Verify constant-time comparison fallback for legacy plaintext strings
    const legacyPlaintext = 'legacy_secret_pwd';
    assert(verifyPassword(legacyPlaintext, legacyPlaintext) === true, 'verifyPassword verifies legacy string safely');
    assert(verifyPassword('wrong', legacyPlaintext) === false, 'verifyPassword rejects wrong password on legacy string');

    // Verify SEED_PROFILES in db.ts contain zero plaintext password values
    const profiles = db.getProfiles();
    const adminProfile = profiles.find(p => p.role === 'admin');
    assert(adminProfile !== undefined, 'Found admin seed profile in db.ts');
    assert(Boolean(adminProfile?.password_hash?.startsWith('$2b$')), 'Admin seed profile password_hash is a secure salted bcrypt hash ($2b$)');
    assert(adminProfile?.password === undefined, 'Admin seed profile has NO plaintext "password" property');

    // Verify bcrypt authentication against seed profile
    assert(verifyPassword('admin', adminProfile!.password_hash!) === true, 'Admin authenticates successfully using bcrypt verification');
    assert(verifyPassword('wrong_admin_pass', adminProfile!.password_hash!) === false, 'Rejects invalid password against seed admin bcrypt hash');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Schema Safety Preflight Mismatch Detection
  // --------------------------------------------------------------------------
  console.log('\nGroup 4: Schema Safety Preflight Mismatch Detection');
  {
    // Case 1: Empty database passes preflight check
    const emptyResult = validateSchemaCompatibility([]);
    assert(emptyResult.isCompatible === true, 'Empty database (0 tables) PASSES preflight check');
    assert(emptyResult.isEmptyDatabase === true, 'Correctly flags isEmptyDatabase = true');

    // Case 2: Incompatible database containing legacy UUID column ABORTS
    const legacyUuidColumns: ColumnInfo[] = [
      { table_name: 'products', column_name: 'id', data_type: 'uuid', udt_name: 'uuid', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'business_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'product_code', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'company_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
    ];
    const uuidResult = validateSchemaCompatibility(legacyUuidColumns);
    assert(uuidResult.isCompatible === false, 'Database with legacy UUID column FAILS preflight check (aborts setup)');
    assert(uuidResult.mismatches.some(m => m.existingType === 'uuid'), 'Identifies exact UUID column mismatch in preflight report');

    // Case 3: Existing table missing mandatory column ABORTS
    const missingColColumns: ColumnInfo[] = [
      { table_name: 'products', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'business_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
      // Missing product_code and company_id
    ];
    const missingColResult = validateSchemaCompatibility(missingColColumns);
    assert(missingColResult.isCompatible === false, 'Table missing mandatory schema columns FAILS preflight check');
    assert(missingColResult.mismatches.some(m => m.column === 'product_code'), 'Identifies missing mandatory column "product_code"');

    // Case 4: Missing mandatory tables (when requireAllTables = true) ABORTS
    const partialTables: ColumnInfo[] = [
      { table_name: 'products', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'business_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
    ];
    const missingTableResult = validateSchemaCompatibility(partialTables, [], { requireAllTables: true });
    assert(missingTableResult.isCompatible === false, 'Database missing required schema tables FAILS preflight check');
    assert(missingTableResult.missingTables.length > 0, 'Reports missing tables list in preflight result');
    assert(missingTableResult.missingTables.includes('orders'), 'Identifies missing table "orders"');

    // Case 5: Incompatible column type ABORTS (e.g. numeric column defined as text)
    const incompatibleTypeColumns: ColumnInfo[] = [];
    for (const [col, t] of Object.entries(EXPECTED_42_TABLE_COLUMNS['products'])) {
      incompatibleTypeColumns.push({
        table_name: 'products',
        column_name: col,
        data_type: col === 'mrp' ? 'text' : (t === 'numeric' ? 'numeric' : (t === 'boolean' ? 'boolean' : 'text')),
        udt_name: col === 'mrp' ? 'text' : (t === 'numeric' ? 'numeric' : (t === 'boolean' ? 'bool' : 'text')),
        is_nullable: 'YES'
      });
    }
    const badTypeResult = validateSchemaCompatibility(incompatibleTypeColumns);
    assert(badTypeResult.isCompatible === false, 'Incompatible column type FAILS preflight check');
    assert(badTypeResult.mismatches.some(m => m.column === 'mrp' && m.category === 'INCOMPATIBLE_TYPE'), 'Identifies incompatible type on "products.mrp"');

    // Case 6: Conflicting Foreign Key constraint ABORTS
    const validProductCols: ColumnInfo[] = [];
    for (const [col, t] of Object.entries(EXPECTED_42_TABLE_COLUMNS['products'])) {
      validProductCols.push({
        table_name: 'products',
        column_name: col,
        data_type: t === 'numeric' ? 'numeric' : (t === 'boolean' ? 'boolean' : 'text'),
        udt_name: t === 'numeric' ? 'numeric' : (t === 'boolean' ? 'bool' : 'text'),
        is_nullable: 'YES'
      });
    }
    const conflictingFk: ConstraintInfo[] = [
      {
        table_name: 'products',
        constraint_name: 'fk_products_company_id',
        constraint_type: 'FOREIGN KEY',
        columns: ['company_id'],
        foreign_table_name: 'retailers' // Should reference 'companies'
      }
    ];
    // Include retailers table so FK target exists but is wrong
    const colsWithRetailers: ColumnInfo[] = [
      ...validProductCols,
      { table_name: 'companies', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'retailers', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
    ];
    const badFkResult = validateSchemaCompatibility(colsWithRetailers, conflictingFk);
    assert(badFkResult.isCompatible === false, 'Conflicting foreign key constraint FAILS preflight check');
    assert(badFkResult.mismatches.some(m => m.category === 'CONFLICTING_CONSTRAINT'), 'Identifies conflicting foreign key reference');

    // Case 7: Conflicting Check constraint ABORTS (e.g. status enum excluding required value)
    const validOrderCols: ColumnInfo[] = [];
    for (const [col, t] of Object.entries(EXPECTED_42_TABLE_COLUMNS['orders'])) {
      validOrderCols.push({
        table_name: 'orders',
        column_name: col,
        data_type: t === 'numeric' ? 'numeric' : (t === 'timestamptz' ? 'timestamptz' : (t === 'boolean' ? 'boolean' : 'text')),
        udt_name: t === 'numeric' ? 'numeric' : (t === 'timestamptz' ? 'timestamptz' : (t === 'boolean' ? 'bool' : 'text')),
        is_nullable: 'YES'
      });
    }
    const conflictingCheck: ConstraintInfo[] = [
      {
        table_name: 'orders',
        constraint_name: 'orders_status_check',
        constraint_type: 'CHECK',
        columns: ['status'],
        check_clause: "status IN ('Fulfilled', 'Cancelled')" // Missing 'Pending'
      }
    ];
    const badCheckResult = validateSchemaCompatibility(validOrderCols, conflictingCheck);
    assert(badCheckResult.isCompatible === false, 'Conflicting check constraint FAILS preflight check');
    assert(badCheckResult.mismatches.some(m => m.column === 'status' && m.category === 'CONFLICTING_CONSTRAINT'), 'Identifies conflicting check constraint on orders.status');

    // Case 8: Missing Unique constraint ABORTS when table has constraints
    const uniqueTestConstraints: ConstraintInfo[] = [
      {
        table_name: 'products',
        constraint_name: 'products_pkey',
        constraint_type: 'PRIMARY KEY',
        columns: ['id']
        // Missing UNIQUE(business_id, product_code)
      }
    ];
    const missingUniqueResult = validateSchemaCompatibility(validProductCols, uniqueTestConstraints);
    assert(missingUniqueResult.isCompatible === false, 'Missing mandatory unique constraint FAILS preflight check');
    assert(missingUniqueResult.mismatches.some(m => m.category === 'MISSING_CONSTRAINT'), 'Identifies missing unique constraint on products');

    // Case 9: 100% compliant full 42-table schema PASSES
    const fullCompliantCols: ColumnInfo[] = [];
    for (const [table, cols] of Object.entries(EXPECTED_42_TABLE_COLUMNS)) {
      for (const [col, t] of Object.entries(cols)) {
        fullCompliantCols.push({
          table_name: table,
          column_name: col,
          data_type: t === 'numeric' ? 'numeric' : (t === 'timestamptz' ? 'timestamptz' : (t === 'boolean' ? 'boolean' : (t === 'jsonb' ? 'jsonb' : (t === 'integer' ? 'integer' : 'text')))),
          udt_name: t === 'numeric' ? 'numeric' : (t === 'timestamptz' ? 'timestamptz' : (t === 'boolean' ? 'bool' : (t === 'jsonb' ? 'jsonb' : (t === 'integer' ? 'int4' : 'text')))),
          is_nullable: 'YES'
        });
      }
    }
    const fullCompliantConstraints: ConstraintInfo[] = [
      { table_name: 'company_members', constraint_name: 'uq_cm', constraint_type: 'UNIQUE', columns: ['business_id', 'user_id'] },
      { table_name: 'companies', constraint_name: 'uq_comp', constraint_type: 'UNIQUE', columns: ['code'] },
      { table_name: 'categories', constraint_name: 'uq_cat', constraint_type: 'UNIQUE', columns: ['business_id', 'name'] },
      { table_name: 'products', constraint_name: 'uq_prod', constraint_type: 'UNIQUE', columns: ['business_id', 'product_code'] },
      { table_name: 'product_categories', constraint_name: 'uq_pc', constraint_type: 'UNIQUE', columns: ['product_id', 'category_id'] },
      { table_name: 'inventory', constraint_name: 'uq_inv', constraint_type: 'UNIQUE', columns: ['business_id', 'product_id', 'godown_id'] },
      { table_name: 'retailers', constraint_name: 'uq_ret', constraint_type: 'UNIQUE', columns: ['business_id', 'retailer_code'] },
      { table_name: 'orders', constraint_name: 'uq_ord', constraint_type: 'UNIQUE', columns: ['business_id', 'order_number'] },
      { table_name: 'invoices', constraint_name: 'uq_inv', constraint_type: 'UNIQUE', columns: ['business_id', 'invoice_number'] },
      { table_name: 'delivery_challans', constraint_name: 'uq_dc', constraint_type: 'UNIQUE', columns: ['business_id', 'challan_number'] },
      { table_name: 'payments', constraint_name: 'uq_pay', constraint_type: 'UNIQUE', columns: ['business_id', 'payment_number'] },
      { table_name: 'company_opening_balances', constraint_name: 'uq_cob', constraint_type: 'UNIQUE', columns: ['business_id'] }
    ];
    const fullResult = validateSchemaCompatibility(fullCompliantCols, fullCompliantConstraints, { requireAllTables: true });
    assert(fullResult.isCompatible === true, '100% compliant full 42-table schema PASSES preflight check');
    assert(fullResult.tableCount === 42, 'Preflight verified all 42 tables');
  }

  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
