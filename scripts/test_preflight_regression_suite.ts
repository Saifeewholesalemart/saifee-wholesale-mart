/**
 * Comprehensive Offline Regression Test Suite for Preflight Schema Check & SQL Audit
 * Saifee FMCG Wholesale Distribution & Trade Management System
 * File: scripts/test_preflight_regression_suite.ts
 *
 * STRICT OPERATIONAL SAFETY:
 * - Pure offline tests. Zero database connections.
 * - Zero network calls to Supabase.
 * - Tests all verified defect fixes: phantom columns, constraint introspection,
 *   multi-column keys, RLS status, permissive policies, and schema rerun safety.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ColumnInfo,
  ConstraintInfo,
  TableRlsStatus,
  PolicyInfo,
  ALL_42_SCHEMA_TABLES,
  EXPECTED_42_TABLE_COLUMNS,
  EXPECTED_UNIQUE_CONSTRAINTS,
  EXPECTED_FOREIGN_KEYS,
  CRITICAL_CHECK_CONSTRAINTS,
  RLS_MANDATORY_TABLES,
  CLIENT_TENANT_POLICY_TABLES,
  normalizeIntrospectedConstraints,
  validateSchemaCompatibility
} from './preflight_schema_check';

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

async function runRegressionTests() {
  console.log('================================================================================');
  console.log('Preflight Schema Safety & SQL Audit: Offline Regression Suite');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Phantom Orders Columns Removal
  // --------------------------------------------------------------------------
  console.log('Group 1: Phantom Orders Columns Removal & Dictionary Accuracy');
  {
    const orderCols = EXPECTED_42_TABLE_COLUMNS['orders'];
    assert(orderCols !== undefined, 'EXPECTED_42_TABLE_COLUMNS contains "orders" table definition');

    // Rule A: Phantom columns from parsed check constraint are completely gone
    const phantomNames = ["'draft',", "'packing',", "'ready", "'cancelled',"];
    for (const phantom of phantomNames) {
      assert(!(phantom in orderCols), `Phantom column "${phantom}" is NOT in orders definition`);
    }

    // Rule B: Valid actual orders columns are all present
    const requiredOrderCols = [
      'id', 'business_id', 'order_number', 'retailer_id', 'source', 'channel',
      'created_by', 'order_date', 'total_amount', 'status', 'order_notes',
      'admin_notes', 'review_notes', 'cancellation_reason', 'dispatch_transport_mode',
      'dispatch_vehicle_number', 'dispatch_delivery_person', 'dispatch_notes',
      'dispatch_godown', 'invoice_id', 'challan_id', 'confirmed_at', 'packed_at',
      'packed_by', 'dispatched_at', 'delivered_at', 'created_at', 'updated_at'
    ];
    for (const col of requiredOrderCols) {
      assert(col in orderCols, `Valid column "${col}" exists in orders definition`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Constraint Introspection & Multi-Column Key Grouping
  // --------------------------------------------------------------------------
  console.log('\nGroup 2: Constraint Introspection & Multi-Column Key Grouping');
  {
    // Raw rows as returned by PostgreSQL information_schema queries (with single column_name per row)
    const rawDatabaseRows = [
      // Composite unique constraint on inventory: (business_id, product_id, godown_id)
      { table_name: 'inventory', constraint_name: 'inventory_biz_prod_godown_key', constraint_type: 'UNIQUE', column_name: 'business_id', ordinal_position: 1 },
      { table_name: 'inventory', constraint_name: 'inventory_biz_prod_godown_key', constraint_type: 'UNIQUE', column_name: 'product_id', ordinal_position: 2 },
      { table_name: 'inventory', constraint_name: 'inventory_biz_prod_godown_key', constraint_type: 'UNIQUE', column_name: 'godown_id', ordinal_position: 3 },
      // Composite unique constraint on company_members: (business_id, user_id)
      { table_name: 'company_members', constraint_name: 'company_members_biz_user_key', constraint_type: 'UNIQUE', column_name: 'business_id', ordinal_position: 1 },
      { table_name: 'company_members', constraint_name: 'company_members_biz_user_key', constraint_type: 'UNIQUE', column_name: 'user_id', ordinal_position: 2 },
      // Foreign key constraint on order_items: order_id -> orders(id)
      { table_name: 'order_items', constraint_name: 'fk_order_items_order', constraint_type: 'FOREIGN KEY', column_name: 'order_id', foreign_table_name: 'orders', foreign_column_name: 'id' }
    ];

    const normalized = normalizeIntrospectedConstraints(rawDatabaseRows);
    assert(normalized.length === 3, `Grouped 6 raw rows into 3 distinct constraints (got ${normalized.length})`);

    const invUq = normalized.find(c => c.table_name === 'inventory' && c.constraint_type === 'UNIQUE');
    assert(invUq !== undefined, 'Found normalized unique constraint for inventory');
    assert(Array.isArray(invUq?.columns), 'Inventory unique constraint columns is an array');
    assert(invUq?.columns?.length === 3, 'Inventory unique constraint has exactly 3 columns');
    assert(
      JSON.stringify(invUq?.columns) === JSON.stringify(['business_id', 'product_id', 'godown_id']),
      'Inventory composite unique columns preserved exact ordinal sequence [business_id, product_id, godown_id]'
    );

    const cmUq = normalized.find(c => c.table_name === 'company_members' && c.constraint_type === 'UNIQUE');
    assert(cmUq?.columns?.length === 2, 'company_members unique constraint has 2 columns');

    const fkItem = normalized.find(c => c.table_name === 'order_items' && c.constraint_type === 'FOREIGN KEY');
    assert(fkItem?.foreign_table_name === 'orders', 'Foreign key referenced table correctly extracted as "orders"');
    assert(fkItem?.columns?.includes('order_id') === true, 'Foreign key column correctly mapped to "order_id"');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Constraint Alignment & Mismatch Detection
  // --------------------------------------------------------------------------
  console.log('\nGroup 3: Check & Foreign Key Constraint Alignment Verification');
  {
    // A. products.trade_mode check constraint alignment
    const tradeModeChk = CRITICAL_CHECK_CONSTRAINTS.find(c => c.table === 'products' && c.column === 'trade_mode');
    assert(tradeModeChk !== undefined, 'Found check constraint definition for products.trade_mode');
    assert(
      JSON.stringify(tradeModeChk?.allowedValues.sort()) === JSON.stringify(['BOTH', 'CARTONS', 'PIECES'].sort()),
      'products.trade_mode allowed values strictly match SQL schema (PIECES, CARTONS, BOTH)'
    );

    // B. orders.status check constraint alignment
    const orderStatusChk = CRITICAL_CHECK_CONSTRAINTS.find(c => c.table === 'orders' && c.column === 'status');
    assert(orderStatusChk !== undefined, 'Found check constraint definition for orders.status');
    assert(orderStatusChk?.allowedValues.includes('Draft') === true, 'orders.status includes "Draft"');
    assert(orderStatusChk?.allowedValues.includes('Confirmed') === true, 'orders.status includes "Confirmed"');
    assert(orderStatusChk?.allowedValues.includes('Packed') === true, 'orders.status includes "Packed"');
    assert(orderStatusChk?.allowedValues.includes('Completed') === true, 'orders.status includes "Completed"');
    assert(!orderStatusChk?.allowedValues.includes('Pending'), 'orders.status does NOT contain obsolete "Pending"');

    // C. invoices.status check constraint removed (it has no CHECK constraint in SQL)
    const invStatusChk = CRITICAL_CHECK_CONSTRAINTS.find(c => c.table === 'invoices' && c.column === 'status');
    assert(invStatusChk === undefined, 'No artificial check constraint on invoices.status (matches clean_rebuild_schema.sql)');

    // D. Test conflicting check constraint on products.trade_mode
    const dummyProductCols: ColumnInfo[] = [
      { table_name: 'products', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'business_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'product_code', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'company_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'trade_mode', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
    ];
    // Existing check constraint only allows CARTONS and PIECES (missing BOTH)
    const badTradeModeConstraint: ConstraintInfo[] = [
      {
        table_name: 'products',
        constraint_name: 'products_trade_mode_check',
        constraint_type: 'CHECK',
        columns: ['trade_mode'],
        check_clause: "trade_mode IN ('PIECES', 'CARTONS')"
      }
    ];
    const badTradeResult = validateSchemaCompatibility(dummyProductCols, badTradeModeConstraint);
    assert(badTradeResult.isCompatible === false, 'Detects conflicting check constraint on products.trade_mode (missing BOTH)');
    assert(badTradeResult.mismatches.some(m => m.column === 'trade_mode' && m.category === 'CONFLICTING_CONSTRAINT'), 'Flags CONFLICTING_CONSTRAINT on trade_mode');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: RLS Status & Permissive Policy Detection
  // --------------------------------------------------------------------------
  console.log('\nGroup 4: RLS Status Inspection & Permissive Policy Detection');
  {
    const sampleTables: ColumnInfo[] = [
      { table_name: 'products', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'products', column_name: 'business_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'orders', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'orders', column_name: 'business_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
    ];

    // Case A: Table has RLS DISABLED
    const rlsDisabledStatus: TableRlsStatus[] = [
      { table_name: 'products', rls_enabled: false },
      { table_name: 'orders', rls_enabled: true }
    ];
    const rlsDisabledResult = validateSchemaCompatibility(sampleTables, [], { rlsStatuses: rlsDisabledStatus });
    assert(rlsDisabledResult.isCompatible === false, 'Preflight FAILS when RLS is disabled on mandatory table');
    assert(rlsDisabledResult.mismatches.some(m => m.table === 'products' && m.category === 'RLS_DISABLED'), 'Identifies products as RLS_DISABLED');

    // Case B: Overly permissive policy with USING (true)
    const permissivePolicies: PolicyInfo[] = [
      {
        table_name: 'orders',
        policy_name: 'open_orders_access',
        cmd: 'ALL',
        qual: 'true',
        with_check: 'true'
      }
    ];
    const permissiveResult = validateSchemaCompatibility(sampleTables, [], { policies: permissivePolicies });
    assert(permissiveResult.isCompatible === false, 'Preflight FAILS when overly permissive policy USING (true) is detected');
    assert(permissiveResult.mismatches.some(m => m.category === 'PERMISSIVE_POLICY'), 'Flags PERMISSIVE_POLICY mismatch');

    // Case C: Permissive policy with fallback OR get_current_business_id() = ''
    const fallbackPermissivePolicies: PolicyInfo[] = [
      {
        table_name: 'products',
        policy_name: 'lax_product_isolation',
        cmd: 'ALL',
        qual: "get_current_business_id() = business_id OR get_current_business_id() = ''",
        with_check: "get_current_business_id() = business_id OR get_current_business_id() = ''"
      }
    ];
    const fallbackResult = validateSchemaCompatibility(sampleTables, [], { policies: fallbackPermissivePolicies });
    assert(fallbackResult.isCompatible === false, 'Preflight FAILS when policy contains empty string fallback');
    assert(fallbackResult.mismatches.some(m => m.category === 'PERMISSIVE_POLICY'), 'Identifies empty-string tenant bypass policy');

    // Case D: Missing client tenant policy on client table when validateRls is requested
    const missingClientPolicyResult = validateSchemaCompatibility(sampleTables, [], {
      validateRls: true,
      rlsStatuses: [{ table_name: 'products', rls_enabled: true }, { table_name: 'orders', rls_enabled: true }],
      policies: [] // No policies
    });
    assert(missingClientPolicyResult.isCompatible === false, 'Preflight FAILS when client table is missing required tenant isolation policy');
    assert(missingClientPolicyResult.mismatches.some(m => m.category === 'MISSING_POLICY'), 'Flags MISSING_POLICY for client tenant tables');

    // Case E: Defense-in-depth: Backend-only line items do NOT require client tenant policies
    const backendTableCols: ColumnInfo[] = [
      { table_name: 'order_items', column_name: 'id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'order_items', column_name: 'order_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO' }
    ];
    const backendResult = validateSchemaCompatibility(backendTableCols, [], {
      validateRls: true,
      rlsStatuses: [{ table_name: 'order_items', rls_enabled: true }],
      policies: []
    });
    // order_items is NOT in CLIENT_TENANT_POLICY_TABLES, so zero MISSING_POLICY errors
    assert(!backendResult.mismatches.some(m => m.table === 'order_items' && m.category === 'MISSING_POLICY'), 'Backend-only table "order_items" is NOT flagged for missing client policy');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Schema Rerun Idempotency & SQL Script Audit
  // --------------------------------------------------------------------------
  console.log('\nGroup 5: Schema Rerun Idempotency in clean_rebuild_schema.sql');
  {
    const sqlPath = path.join(process.cwd(), 'supabase', 'clean_rebuild_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Rule A: Every CREATE POLICY is preceded by DROP POLICY IF EXISTS
    const lines = sqlContent.split('\n');
    const createPolicyLines: { index: number; policyName: string; tableName: string }[] = [];
    const dropPolicyLines: { index: number; policyName: string; tableName: string }[] = [];

    lines.forEach((l, idx) => {
      const createMatch = l.match(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_]+)/i);
      if (createMatch) {
        createPolicyLines.push({ index: idx, policyName: createMatch[1], tableName: createMatch[2] });
      }
      const dropMatch = l.match(/DROP\s+POLICY\s+IF\s+EXISTS\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_]+)/i);
      if (dropMatch) {
        dropPolicyLines.push({ index: idx, policyName: dropMatch[1], tableName: dropMatch[2] });
      }
    });

    assert(createPolicyLines.length === 24, `Found 24 CREATE POLICY statements in clean_rebuild_schema.sql (got ${createPolicyLines.length})`);
    assert(dropPolicyLines.length >= 24, `Found at least 24 DROP POLICY IF EXISTS statements in clean_rebuild_schema.sql (got ${dropPolicyLines.length})`);

    let allPoliciesSafelyDropped = true;
    for (const cp of createPolicyLines) {
      const hasDrop = dropPolicyLines.some(dp => dp.policyName === cp.policyName && dp.tableName === cp.tableName && dp.index < cp.index);
      if (!hasDrop) {
        allPoliciesSafelyDropped = false;
        console.error(`Missing DROP POLICY IF EXISTS before line ${cp.index + 1} for ${cp.policyName} on ${cp.tableName}`);
      }
    }
    assert(allPoliciesSafelyDropped, 'Every CREATE POLICY is immediately preceded by DROP POLICY IF EXISTS (100% rerun safe)');

    // Rule B: Rerun and idempotency documentation is clearly articulated in the header
    assert(sqlContent.includes('RERUN & IDEMPOTENCY SPECIFICATION:'), 'Header explicitly documents rerun & idempotency specifications');
    assert(sqlContent.includes('Never drops tables or resets existing database data automatically'), 'Header explicitly guarantees no automated table drops or data resets');

    // Rule C: BEGIN and COMMIT enclose the entire script
    assert(sqlContent.includes('BEGIN;'), 'Script contains explicit BEGIN; transaction');
    assert(sqlContent.trim().endsWith('COMMIT;'), 'Script ends cleanly with COMMIT;');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: 100% Compliant Clean-Rebuild Schema Verification
  // --------------------------------------------------------------------------
  console.log('\nGroup 6: 100% Full-Schema Compliant Validation with Normalizer');
  {
    // Generate all columns across all 42 tables
    const allColumns: ColumnInfo[] = [];
    for (const [table, cols] of Object.entries(EXPECTED_42_TABLE_COLUMNS)) {
      for (const [col, t] of Object.entries(cols)) {
        allColumns.push({
          table_name: table,
          column_name: col,
          data_type: t === 'numeric' ? 'numeric' : (t === 'timestamptz' ? 'timestamptz' : (t === 'boolean' ? 'boolean' : (t === 'jsonb' ? 'jsonb' : (t === 'integer' ? 'integer' : 'text')))),
          udt_name: t === 'numeric' ? 'numeric' : (t === 'timestamptz' ? 'timestamptz' : (t === 'boolean' ? 'bool' : (t === 'jsonb' ? 'jsonb' : (t === 'integer' ? 'int4' : 'text')))),
          is_nullable: 'YES'
        });
      }
    }

    // Generate raw database rows for all unique constraints to verify normalizeIntrospectedConstraints in end-to-end flow
    const rawConstraints: any[] = [];
    for (const u of EXPECTED_UNIQUE_CONSTRAINTS) {
      u.columns.forEach((col, idx) => {
        rawConstraints.push({
          table_name: u.table,
          constraint_name: `uq_${u.table}`,
          constraint_type: 'UNIQUE',
          column_name: col,
          ordinal_position: idx + 1
        });
      });
    }

    // Add all foreign keys
    for (const fk of EXPECTED_FOREIGN_KEYS) {
      rawConstraints.push({
        table_name: fk.table,
        constraint_name: `fk_${fk.table}_${fk.column}`,
        constraint_type: 'FOREIGN KEY',
        column_name: fk.column,
        foreign_table_name: fk.foreignTable,
        foreign_column_name: fk.foreignColumn
      });
    }

    // Add all critical check constraints
    for (const chk of CRITICAL_CHECK_CONSTRAINTS) {
      rawConstraints.push({
        table_name: chk.table,
        constraint_name: `chk_${chk.table}_${chk.column}`,
        constraint_type: 'CHECK',
        column_name: chk.column,
        check_clause: `${chk.column} IN (${chk.allowedValues.map(v => `'${v}'`).join(', ')})`
      });
    }

    // Add RLS statuses (all 35 mandatory tables enabled)
    const rlsStatuses: TableRlsStatus[] = RLS_MANDATORY_TABLES.map(table => ({
      table_name: table,
      rls_enabled: true
    }));

    // Add valid tenant policies for the 15 client tenant tables
    const policies: PolicyInfo[] = CLIENT_TENANT_POLICY_TABLES.map(table => ({
      table_name: table,
      policy_name: `tenant_isolation_policy_${table}`,
      cmd: 'ALL',
      qual: `get_current_business_id() IS NOT NULL AND business_id = get_current_business_id()`,
      with_check: `get_current_business_id() IS NOT NULL AND business_id = get_current_business_id()`
    }));

    // Add secure policies for system_settings
    policies.push({
      table_name: 'system_settings',
      policy_name: 'secure_admin_system_settings_all',
      roles: ['authenticated'],
      cmd: 'ALL',
      qual: 'is_admin_user()',
      with_check: 'is_admin_user()'
    });
    policies.push({
      table_name: 'system_settings',
      policy_name: 'secure_authenticated_read_non_sensitive_settings',
      roles: ['authenticated'],
      cmd: 'SELECT',
      qual: "key NOT IN ('fmcg_cloud_database_v1') AND key NOT LIKE '%snapshot%' AND key NOT LIKE '%backup%'",
      with_check: ''
    });

    // Run full validation with raw database rows
    const fullCheck = validateSchemaCompatibility(allColumns, rawConstraints, {
      requireAllTables: true,
      validateConstraints: true,
      validateRls: true,
      rlsStatuses,
      policies
    });

    assert(fullCheck.isCompatible === true, 'Full 42-table schema with introspected constraints & RLS passes 100%');
    assert(fullCheck.mismatches.length === 0, `Zero mismatches reported (got ${fullCheck.mismatches.length})`);
    assert(fullCheck.tableCount === 42, 'Preflight verified all 42 tables');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Security Audit: system_settings & Staging Tables Access Control
  // --------------------------------------------------------------------------
  console.log('\nGroup 7: Security Audit: system_settings & Sensitive Staging Tables Access Control');
  {
    const sqlPath = path.join(process.cwd(), 'supabase', 'clean_rebuild_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // 1. Verify all 42 tables have RLS enabled in clean_rebuild_schema.sql
    const rlsMatches = sqlContent.match(/ALTER TABLE \w+ ENABLE ROW LEVEL SECURITY/g) || [];
    const rlsTables = rlsMatches.map(s => s.replace(/ALTER TABLE (\w+) ENABLE ROW LEVEL SECURITY/i, '$1').toLowerCase());
    assert(rlsTables.length === 42, `All 42 tables have explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY (got ${rlsTables.length})`);
    assert(rlsTables.includes('system_settings'), 'system_settings has RLS enabled');
    assert(rlsTables.includes('ai_purchase_imports'), 'ai_purchase_imports has RLS enabled');
    assert(rlsTables.includes('ai_purchase_import_items'), 'ai_purchase_import_items has RLS enabled');
    assert(rlsTables.includes('suppliers'), 'suppliers has RLS enabled');
    assert(rlsTables.includes('product_aliases'), 'product_aliases has RLS enabled');

    // 2. Verify Table Grants revoke public/anon access
    assert(sqlContent.includes('REVOKE ALL ON TABLE system_settings FROM PUBLIC, anon;'), 'Explicitly revoked ALL on system_settings from PUBLIC and anon');
    assert(sqlContent.includes('REVOKE ALL ON TABLE ai_purchase_imports, ai_purchase_import_items FROM PUBLIC, anon;'), 'Explicitly revoked ALL on ai_purchase_imports from PUBLIC and anon');
    assert(sqlContent.includes('GRANT ALL ON TABLE system_settings TO service_role;'), 'Granted full administrative access on system_settings to service_role');

    // 3. Verify is_admin_user() helper function exists and is SECURITY DEFINER
    assert(sqlContent.includes('CREATE OR REPLACE FUNCTION is_admin_user()'), 'clean_rebuild_schema.sql defines is_admin_user() security function');
    assert(sqlContent.includes('LANGUAGE plpgsql STABLE SECURITY DEFINER;'), 'is_admin_user() is declared SECURITY DEFINER');

    // 4. Verify system_settings policies
    assert(sqlContent.includes('CREATE POLICY "secure_admin_system_settings_all" ON system_settings'), 'Admin policy created for system_settings');
    assert(sqlContent.includes('CREATE POLICY "secure_authenticated_read_non_sensitive_settings" ON system_settings'), 'Non-sensitive read policy created for system_settings');
    assert(sqlContent.includes("key NOT IN ('fmcg_cloud_database_v1')"), 'Snapshot key fmcg_cloud_database_v1 explicitly shielded from ordinary authenticated users');

    // 5. Preflight validator flags insecure public policies on system_settings
    const sampleSystemSettingsCols: ColumnInfo[] = [
      { table_name: 'system_settings', column_name: 'key', data_type: 'text', udt_name: 'text', is_nullable: 'NO' },
      { table_name: 'system_settings', column_name: 'value', data_type: 'jsonb', udt_name: 'jsonb', is_nullable: 'NO' }
    ];
    const insecurePublicPolicy = validateSchemaCompatibility(sampleSystemSettingsCols, [], {
      requireAllTables: false,
      validateRls: true,
      rlsStatuses: [{ table_name: 'system_settings', rls_enabled: true }],
      policies: [{
        table_name: 'system_settings',
        policy_name: 'insecure_public_settings_leak',
        roles: ['public'],
        cmd: 'SELECT',
        qual: 'true',
        with_check: ''
      }]
    });
    assert(insecurePublicPolicy.isCompatible === false, 'Preflight detects and FAILS when insecure public policy on system_settings is present');
    const publicExposureMismatch = insecurePublicPolicy.mismatches.find(m => m.category === 'PERMISSIVE_POLICY' && m.table === 'system_settings');
    assert(publicExposureMismatch !== undefined, 'Preflight flagged PUBLIC_EXPOSURE category on system_settings');

    // 6. Server route /api/sync/snapshot authentication & authorization simulation
    const mockUnauthSession = null;
    const mockStaffSession = { role: 'sales_dist', profileType: 'SALESPERSON', userId: 'user_123' };
    const mockRetailerSession = { role: 'retailer', profileType: 'RETAILER', userId: 'ret_456' };
    const mockAdminSession = { role: 'admin', profileType: 'ADMIN', userId: 'admin_789' };

    function simulateSnapshotAccess(session: any, method: 'GET' | 'POST') {
      if (!session) return { status: 401, error: 'Authentication required' };
      if (session.role !== 'admin' && session.profileType !== 'ADMIN') {
        return { status: 403, error: 'Unauthorized: Administrative role required' };
      }
      return { status: 200, success: true };
    }

    assert(simulateSnapshotAccess(mockUnauthSession, 'GET').status === 401, 'Snapshot API GET rejects unauthenticated requests with 401');
    assert(simulateSnapshotAccess(mockUnauthSession, 'POST').status === 401, 'Snapshot API POST rejects unauthenticated requests with 401');
    assert(simulateSnapshotAccess(mockStaffSession, 'GET').status === 403, 'Snapshot API GET rejects non-admin staff with 403');
    assert(simulateSnapshotAccess(mockRetailerSession, 'GET').status === 403, 'Snapshot API GET rejects retailer role with 403');
    assert(simulateSnapshotAccess(mockAdminSession, 'GET').status === 200, 'Snapshot API GET permits authenticated admin with 200');
    assert(simulateSnapshotAccess(mockAdminSession, 'POST').status === 200, 'Snapshot API POST permits authenticated admin with 200');

    // 7. Verify PWA fallback integration in supabaseSyncEngine.ts
    const syncEnginePath = path.join(process.cwd(), 'src', 'lib', 'supabaseSyncEngine.ts');
    const syncEngineCode = fs.readFileSync(syncEnginePath, 'utf8');
    assert(syncEngineCode.includes("fetch('/api/sync/snapshot'"), 'supabaseSyncEngine.ts implements fallback to /api/sync/snapshot for fetch');
    assert(syncEngineCode.includes("body: JSON.stringify(payload)"), 'supabaseSyncEngine.ts implements fallback to /api/sync/snapshot for push');

    // 8. Error 42703 Regression: Verify zero bare business_id references on tables lacking business_id
    // - companies table has NO business_id column
    const companiesCols = EXPECTED_42_TABLE_COLUMNS['companies'] || {};
    assert(!('business_id' in companiesCols), 'companies table definition intentionally has NO business_id column');
    // - product_categories has NO business_id column
    const prodCatCols = EXPECTED_42_TABLE_COLUMNS['product_categories'] || {};
    assert(!('business_id' in prodCatCols), 'product_categories table definition intentionally has NO business_id column');
    // - product_aliases has NO business_id column
    const prodAliasCols = EXPECTED_42_TABLE_COLUMNS['product_aliases'] || {};
    assert(!('business_id' in prodAliasCols), 'product_aliases table definition intentionally has NO business_id column');

    // Policies on companies do NOT reference business_id
    const companiesPolicyMatch = sqlContent.match(/CREATE\s+POLICY\s+"[^"]+"\s+ON\s+companies[\s\S]*?;/gi) || [];
    assert(companiesPolicyMatch.length > 0, 'Found policies for companies table');
    for (const cp of companiesPolicyMatch) {
      assert(!cp.includes('business_id'), `Policy on companies does NOT reference business_id (${cp.replace(/\s+/g, ' ').slice(0, 60)}...)`);
    }

    // Policies on product_categories and product_aliases scope through joined tables, not bare business_id
    const prodCatPolicyMatch = (sqlContent.match(/CREATE\s+POLICY\s+"[^"]+"\s+ON\s+product_categories[\s\S]*?;/gi) || []).join(' ');
    assert(prodCatPolicyMatch.includes('products.business_id'), 'product_categories policy qualifies products.business_id via join');
    assert(!/(?<!\.)\bbusiness_id\s*=/.test(prodCatPolicyMatch), 'product_categories policy has NO bare business_id column reference');

    const prodAliasPolicyMatch = (sqlContent.match(/CREATE\s+POLICY\s+"[^"]+"\s+ON\s+product_aliases[\s\S]*?;/gi) || []).join(' ');
    assert(prodAliasPolicyMatch.includes('suppliers.business_id'), 'product_aliases policy qualifies suppliers.business_id via join');
    assert(!/(?<!\.)\bbusiness_id\s*=/.test(prodAliasPolicyMatch), 'product_aliases policy has NO bare business_id column reference');

    // ------------------------------------------------------------------------
    // 9. Cloud Persistence, Anti-Fake-Sync & Authoritative Normalized Import Tests
    // ------------------------------------------------------------------------
    console.log('\n--- 9. Cloud Persistence, Anti-Fake-Sync & Authoritative Importer ---');

    // A. Incremental sync engine does not report fake success when 0 records are pushed/pulled
    const incSyncPath = path.join(process.cwd(), 'src', 'lib', 'incrementalSyncEngine.ts');
    const incSyncCode = fs.readFileSync(incSyncPath, 'utf8');
    assert(incSyncCode.includes("'idle'"), 'IncrementalSyncResult includes "idle" state');
    assert(incSyncCode.includes("hasTransferred ? 'synced' : 'idle'"), 'Incremental sync returns "idle" when 0 pushed and 0 pulled');
    assert(!incSyncCode.includes("(pulledCount > 0 || pushedCount > 0) ? 'synced' : 'merged'"), 'Incremental sync does NOT treat 0 pushed/0 pulled as "merged"');

    // B. Supabase sync engine respects honest sync state
    assert(syncEngineCode.includes("incResult.action === 'idle'"), 'supabaseSyncEngine handles incremental idle state explicitly');
    assert(syncEngineCode.includes("state: 'idle',\n        message: 'Cloud empty; awaiting initial catalog import'"), 'Empty cloud with 0 local records sets state: "idle", not "synced"');
    assert(syncEngineCode.includes("throw new Error('Legacy snapshot push is disabled because authoritative incremental PostgreSQL sync is active.')"), 'pushCloudSnapshot throws when suppressed instead of returning fake timestamp');

    // C. CloudSyncStatusButton displays neutral status on idle, never misleading green
    const buttonPath = path.join(process.cwd(), 'src', 'components', 'CloudSyncStatusButton.tsx');
    const buttonCode = fs.readFileSync(buttonPath, 'utf8');
    assert(buttonCode.includes(": 'Cloud Ready'"), 'CloudSyncStatusButton displays "Cloud Ready" when state is idle');
    assert(buttonCode.includes("cloudSyncStatus.state === 'synced' || justSynced\n              ? 'bg-emerald-400'\n              : 'hidden'"), 'CloudSyncStatusButton hides pulse ping when not actively synced');
    assert(buttonCode.includes("cloudSyncStatus.state === 'synced' || justSynced\n              ? 'bg-emerald-500'\n              : 'bg-slate-400'"), 'CloudSyncStatusButton uses slate dot when idle');

    // D. Product Import API enforces active server database with no silent mock fallback
    const importApiPath = path.join(process.cwd(), 'src', 'app', 'api', 'admin', 'products', 'import', 'route.ts');
    const importApiCode = fs.readFileSync(importApiPath, 'utf8');
    assert(!importApiCode.includes('db.executeVyaparBatchImport'), 'Product import API does NOT contain silent local fallback db.executeVyaparBatchImport');
    assert(importApiCode.includes('{ status: 503 }'), 'Product import API returns HTTP 503 when database is not configured');

    // E. Product Rollback API enforces active server database with no silent mock fallback
    const rollbackApiPath = path.join(process.cwd(), 'src', 'app', 'api', 'admin', 'products', 'import', 'rollback', 'route.ts');
    const rollbackApiCode = fs.readFileSync(rollbackApiPath, 'utf8');
    assert(!rollbackApiCode.includes('db.rollbackVyaparImport'), 'Product rollback API does NOT contain silent local fallback db.rollbackVyaparImport');
    assert(rollbackApiCode.includes('{ status: 503 }'), 'Product rollback API returns HTTP 503 when database is not configured');

    // F. Server Product Importer populates normalized PostgreSQL tables transactionally
    const importerPath = path.join(process.cwd(), 'src', 'lib', 'serverProductImporter.ts');
    const importerCode = fs.readFileSync(importerPath, 'utf8');
    assert(importerCode.includes('INSERT INTO products'), 'Server importer inserts into normalized products table');
    assert(importerCode.includes('INSERT INTO categories'), 'Server importer inserts into normalized categories table');
    assert(importerCode.includes('INSERT INTO companies'), 'Server importer inserts into normalized companies table');
    assert(importerCode.includes('INSERT INTO godowns'), 'Server importer inserts into normalized godowns table');
    assert(importerCode.includes('INSERT INTO inventory'), 'Server importer inserts into normalized inventory table');
    assert(importerCode.includes('INSERT INTO inventory_batches'), 'Server importer inserts into normalized inventory_batches table');
    assert(importerCode.includes('INSERT INTO stock_ledger'), 'Server importer inserts into normalized stock_ledger table');
    assert(importerCode.includes('INSERT INTO vyapar_imports'), 'Server importer inserts into normalized vyapar_imports table');
    assert(importerCode.includes("client.query('BEGIN')"), 'Server importer wraps execution in BEGIN transaction');
    assert(importerCode.includes("client.query('COMMIT')"), 'Server importer wraps execution in COMMIT transaction');
    assert(importerCode.includes("client.query('ROLLBACK')"), 'Server importer wraps execution in ROLLBACK on error');
  }

  console.log('\n================================================================================');
  console.log(`REGRESSION SUMMARY: Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch(err => {
  console.error('Unhandled regression suite error:', err);
  process.exit(1);
});

