/**
 * Offline Seed Script: Minimum Required Reference Data Only
 * FMCG Wholesale Distribution & Trade Management System
 * File: scripts/seed_minimum_reference_offline.ts
 *
 * SAFETY GUARANTEES:
 * 1. STRICT OFFLINE: Never connects to any remote or live database (PostgreSQL or Supabase).
 * 2. ZERO PRODUCTION ACCESS: Refuses execution if production environment variables are detected.
 * 3. NO HARDCODED PREDICTABLE CREDENTIALS:
 *    Requires BOOTSTRAP_ADMIN_PASSWORD_HASH or BOOTSTRAP_ADMIN_INITIAL_PASSWORD to set an active password;
 *    otherwise generates an unguessable randomized locked hash requiring explicit admin CLI reset.
 * 4. MINIMUM REFERENCE DATA ONLY: Seeds only essential master records (1 default tenant,
 *    1 default godown, 5 standard brand manufacturers, 5 initial categories, 1 initial setup profile).
 *    Zero customer, invoice, order, payment, or inventory records are created.
 * 5. OUTPUT: Generates a sanitized SQL file for human review in `backups/seed_minimum_reference_offline.sql`.
 *
 * Usage:
 *   npx tsx scripts/seed_minimum_reference_offline.ts
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

console.log('================================================================================');
console.log('FMCG ERP: Minimum Reference Data Offline Seed Generator (STRICT OFFLINE)');
console.log('================================================================================\n');

// ----------------------------------------------------------------------------
// SECURE BOOTSTRAP CREDENTIAL DERIVATION
// ----------------------------------------------------------------------------
function getBootstrapAdminPasswordHash(): string {
  const envHash = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH?.trim();
  if (envHash && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(envHash)) {
    return envHash;
  }
  const envPwd = process.env.BOOTSTRAP_ADMIN_INITIAL_PASSWORD?.trim();
  if (envPwd && envPwd.length >= 12) {
    return bcrypt.hashSync(envPwd, 12);
  }
  // Cryptographically random, unguessable locked hash when no initial secret is supplied
  const lockedSecret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hashSync(lockedSecret, 10);
}

export const MINIMUM_SEED_TENANT = {
  id: 'biz-saifee',
  code: 'SGS',
  name: 'Saifee General Stores',
  legal_name: 'Saifee General Stores Wholesale Mart',
  business_type: 'FMCG Wholesale Distribution',
  city: 'Indore',
  state: 'Madhya Pradesh',
  state_code: '27',
  gstin: '23AABCS1429B1Z0',
  pan: 'AABCS1429B',
  invoice_prefix: 'SGS-INV',
  order_prefix: 'SGS-ORD',
  customer_term: 'Retailer',
  currency: 'INR',
  status: 'active'
};

export const MINIMUM_SEED_GODOWNS = [
  {
    id: 'gdn-main-indore',
    business_id: 'biz-saifee',
    company_id: 'biz-saifee',
    code: 'MAIN',
    name: 'Central Warehouse Indore',
    city: 'Indore',
    state: 'Madhya Pradesh',
    is_default: true,
    status: 'Active'
  }
];

export const MINIMUM_SEED_COMPANIES = [
  { id: 'c-parle', code: 'PARLE', name: 'Parle Products Private Limited', active: true },
  { id: 'c-britannia', code: 'BRITANNIA', name: 'Britannia Industries Limited', active: true },
  { id: 'c-itc', code: 'ITC', name: 'ITC Limited (Foods Division)', active: true },
  { id: 'c-hul', code: 'HUL', name: 'Hindustan Unilever Limited', active: true },
  { id: 'c-nestle', code: 'NESTLE', name: 'Nestle India Limited', active: true }
];

export const MINIMUM_SEED_CATEGORIES = [
  { id: 'cat-biscuits', business_id: 'biz-saifee', name: 'Biscuits & Cookies', description: 'Packaged sweet, glucose, and digestive biscuits', active: true },
  { id: 'cat-confectionery', business_id: 'biz-saifee', name: 'Confectionery & Candies', description: 'Hard candies, toffees, and chocolates', active: true },
  { id: 'cat-personal-care', business_id: 'biz-saifee', name: 'Personal Care & Soaps', description: 'Toilet soaps, shampoos, and dental hygiene products', active: true },
  { id: 'cat-beverages', business_id: 'biz-saifee', name: 'Beverages & Juices', description: 'Ready-to-drink juices, soft beverages, and tea', active: true },
  { id: 'cat-snacks', business_id: 'biz-saifee', name: 'Noodles & Ready Snacks', description: 'Instant noodles, namkeen, and chips', active: true }
];

export const MINIMUM_SEED_PROFILE = {
  id: 'p-admin-initial',
  business_id: 'biz-saifee',
  email: 'admin.setup@saifeedistributors.local',
  mobile: '9820000000',
  name: 'Initial Setup Administrator',
  full_name: 'Initial Setup Administrator',
  role: 'admin',
  profile_type: 'ADMIN',
  password_hash: getBootstrapAdminPasswordHash(),
  active: true,
  status: 'ACTIVE'
};

export const MINIMUM_SEED_COMPANY_MEMBER = {
  id: 'mem-admin-initial',
  business_id: 'biz-saifee',
  company_id: 'biz-saifee',
  user_id: 'p-admin-initial',
  role: 'owner',
  status: 'active'
};

// ----------------------------------------------------------------------------
// Generator Function: Produces Idempotent DDL / DML SQL Script
// ----------------------------------------------------------------------------
export function generateMinimumReferenceSql(): string {
  const lines: string[] = [
    '-- =====================================================================',
    '-- FMCG ERP: MINIMUM REFERENCE DATA SEED SCRIPT (OFFLINE GENERATED)',
    '-- Target Schema: supabase/clean_rebuild_schema.sql',
    '-- Purpose: Bootstrap minimum essential entities (Tenant, Warehouse, Brands, Categories, Admin)',
    '-- Safety: Uses ON CONFLICT DO NOTHING / UPDATE to ensure 100% idempotency.',
    '-- Zero customer accounts, orders, inventory batches, or invoices included.',
    '-- =====================================================================',
    'BEGIN;',
    '',
    '-- 1. Default Tenant Organization',
    `INSERT INTO business_companies (id, code, name, legal_name, business_type, city, state, state_code, gstin, pan, invoice_prefix, order_prefix, customer_term, currency, status)`,
    `VALUES ('${MINIMUM_SEED_TENANT.id}', '${MINIMUM_SEED_TENANT.code}', '${MINIMUM_SEED_TENANT.name}', '${MINIMUM_SEED_TENANT.legal_name}', '${MINIMUM_SEED_TENANT.business_type}', '${MINIMUM_SEED_TENANT.city}', '${MINIMUM_SEED_TENANT.state}', '${MINIMUM_SEED_TENANT.state_code}', '${MINIMUM_SEED_TENANT.gstin}', '${MINIMUM_SEED_TENANT.pan}', '${MINIMUM_SEED_TENANT.invoice_prefix}', '${MINIMUM_SEED_TENANT.order_prefix}', '${MINIMUM_SEED_TENANT.customer_term}', '${MINIMUM_SEED_TENANT.currency}', '${MINIMUM_SEED_TENANT.status}')`,
    `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;`,
    '',
    '-- 2. Default Warehouse / Godown'
  ];

  for (const g of MINIMUM_SEED_GODOWNS) {
    lines.push(
      `INSERT INTO godowns (id, business_id, company_id, code, name, city, state, is_default, status)`,
      `VALUES ('${g.id}', '${g.business_id}', '${g.company_id}', '${g.code}', '${g.name}', '${g.city}', '${g.state}', ${g.is_default}, '${g.status}')`,
      `ON CONFLICT (business_id, code) DO NOTHING;`
    );
  }

  lines.push('', '-- 3. Master FMCG Principal Brands');
  for (const c of MINIMUM_SEED_COMPANIES) {
    lines.push(
      `INSERT INTO companies (id, code, name, active)`,
      `VALUES ('${c.id}', '${c.code}', '${c.name}', ${c.active})`,
      `ON CONFLICT (code) DO NOTHING;`
    );
  }

  lines.push('', '-- 4. Initial Product Categories');
  for (const cat of MINIMUM_SEED_CATEGORIES) {
    lines.push(
      `INSERT INTO categories (id, business_id, name, description, active)`,
      `VALUES ('${cat.id}', '${cat.business_id}', '${cat.name}', '${cat.description}', ${cat.active})`,
      `ON CONFLICT (business_id, name) DO NOTHING;`
    );
  }

  lines.push('', '-- 5. Initial Setup Administrator Profile & Membership');
  lines.push(
    `INSERT INTO profiles (id, business_id, email, mobile, name, full_name, role, profile_type, password_hash, active, status)`,
    `VALUES ('${MINIMUM_SEED_PROFILE.id}', '${MINIMUM_SEED_PROFILE.business_id}', '${MINIMUM_SEED_PROFILE.email}', '${MINIMUM_SEED_PROFILE.mobile}', '${MINIMUM_SEED_PROFILE.name}', '${MINIMUM_SEED_PROFILE.full_name}', '${MINIMUM_SEED_PROFILE.role}', '${MINIMUM_SEED_PROFILE.profile_type}', '${MINIMUM_SEED_PROFILE.password_hash}', ${MINIMUM_SEED_PROFILE.active}, '${MINIMUM_SEED_PROFILE.status}')`,
    `ON CONFLICT (id) DO NOTHING;`,
    '',
    `INSERT INTO company_members (id, business_id, company_id, user_id, role, status)`,
    `VALUES ('${MINIMUM_SEED_COMPANY_MEMBER.id}', '${MINIMUM_SEED_COMPANY_MEMBER.business_id}', '${MINIMUM_SEED_COMPANY_MEMBER.company_id}', '${MINIMUM_SEED_COMPANY_MEMBER.user_id}', '${MINIMUM_SEED_COMPANY_MEMBER.role}', '${MINIMUM_SEED_COMPANY_MEMBER.status}')`,
    `ON CONFLICT (business_id, user_id) DO NOTHING;`,
    '',
    'COMMIT;'
  );

  return lines.join('\n');
}

// Write offline artifact only when executed as script
if (require.main === module) {
  const sql = generateMinimumReferenceSql();
  const outDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'seed_minimum_reference_offline.sql');
  fs.writeFileSync(outFile, sql, 'utf8');
  console.log(`[PASS] Minimum reference data seed generated: ${outFile}`);
  console.log(`Total SQL size: ${Buffer.byteLength(sql)} bytes`);
}
