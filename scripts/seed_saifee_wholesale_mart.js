/**
 * Seed script: Saifee Wholesale Mart (clean start)
 * Banata hai sirf: 1 company, 2 godowns (Main + Secondary), 1 admin login.
 * Koi sample brand, category, product ya customer nahi.
 *
 * Kaise chalana hai (project folder me, jahan package.json hai):
 *   node scripts/seed_saifee_wholesale_mart.js
 *
 * Ye script database se connect NAHI karti. Sirf ek SQL file banati hai:
 *   backups/seed_saifee_wholesale_mart.sql
 * Us file ko Supabase SQL Editor me paste karke Run karna hai.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  console.error('\n[ERROR] bcryptjs nahi mila. Ye script project folder ke andar se chalao (jahan node_modules hai).');
  process.exit(1);
}

// ---------------------------------------------------------------------
// Yahan baad me badal sakte ho (chalane se pehle)
// ---------------------------------------------------------------------
const COMPANY = {
  id: 'biz-saifee', // ID mat badalna: app me kuch jagah isi ID par fallback hai
  code: 'SWM',
  name: 'Saifee Wholesale Mart',
  business_type: 'FMCG Wholesale Distribution',
  address: 'Khachrod, Dist. Ujjain',
  city: 'Khachrod',
  state: 'Madhya Pradesh',
  state_code: '23', // GST state code (Madhya Pradesh = 23)
  invoice_prefix: 'SWM-INV',
  order_prefix: 'SWM-ORD',
  customer_term: 'Retailer',
  currency: 'INR'
  // GSTIN abhi nahi daal rahe, baad me app se daalenge
};

const GODOWNS = [
  { id: 'gdn-main', code: 'MAIN', name: 'Main Godown', is_default: true },
  { id: 'gdn-secondary', code: 'SECONDARY', name: 'Secondary Godown', is_default: false }
];
// ---------------------------------------------------------------------

const esc = (v) => String(v).replace(/'/g, "''");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const queue = [];
const waiters = [];
rl.on('line', (line) => {
  if (waiters.length) waiters.shift()(line);
  else queue.push(line);
});
function ask(question) {
  process.stdout.write(question);
  return new Promise((resolve) => {
    if (queue.length) resolve(queue.shift());
    else waiters.push(resolve);
  });
}

async function main() {
  console.log('==============================================================');
  console.log(' Saifee Wholesale Mart: Admin login banana');
  console.log('==============================================================\n');

  let adminName = (await ask('Admin ka naam (Enter dabao to "Admin"): ')).trim();
  if (!adminName) adminName = 'Admin';

  let mobile = '';
  while (!/^[0-9]{10}$/.test(mobile)) {
    mobile = (await ask('Admin ka 10 digit mobile number (isi se login hoga): ')).replace(/[^0-9]/g, '').slice(-10);
    if (!/^[0-9]{10}$/.test(mobile)) console.log('  -> Sahi 10 digit number daalo.');
  }

  let password = '';
  while (true) {
    password = (await ask('Admin password (kam se kam 12 characters): ')).trim();
    if (password.length < 12) {
      console.log('  -> Password kam se kam 12 characters ka hona chahiye.');
      continue;
    }
    const again = (await ask('Password dobara likho: ')).trim();
    if (again !== password) {
      console.log('  -> Dono password alag hain, dobara try karo.');
      continue;
    }
    break;
  }
  rl.close();

  const passwordHash = bcrypt.hashSync(password, 12);
  const email = 'admin@saifeewholesalemart.local';

  const sql = [];
  sql.push('-- =====================================================================');
  sql.push('-- Saifee Wholesale Mart: clean start seed (company + 2 godowns + admin)');
  sql.push('-- Target schema: supabase/clean_rebuild_schema.sql');
  sql.push('-- Safe to re-run: ON CONFLICT DO NOTHING');
  sql.push('-- =====================================================================');
  sql.push('BEGIN;');
  sql.push('');
  sql.push('-- 1. Company (tenant)');
  sql.push('INSERT INTO business_companies (id, code, name, business_type, address, city, state, state_code, invoice_prefix, order_prefix, customer_term, currency, status, is_default)');
  sql.push(`VALUES ('${esc(COMPANY.id)}', '${esc(COMPANY.code)}', '${esc(COMPANY.name)}', '${esc(COMPANY.business_type)}', '${esc(COMPANY.address)}', '${esc(COMPANY.city)}', '${esc(COMPANY.state)}', '${esc(COMPANY.state_code)}', '${esc(COMPANY.invoice_prefix)}', '${esc(COMPANY.order_prefix)}', '${esc(COMPANY.customer_term)}', '${esc(COMPANY.currency)}', 'active', TRUE)`);
  sql.push('ON CONFLICT (id) DO NOTHING;');
  sql.push('');
  sql.push('-- 2. Godowns');
  for (const g of GODOWNS) {
    sql.push('INSERT INTO godowns (id, business_id, company_id, code, name, city, state, is_default, status)');
    sql.push(`VALUES ('${esc(g.id)}', '${esc(COMPANY.id)}', '${esc(COMPANY.id)}', '${esc(g.code)}', '${esc(g.name)}', '${esc(COMPANY.city)}', '${esc(COMPANY.state)}', ${g.is_default ? 'TRUE' : 'FALSE'}, 'Active')`);
    sql.push('ON CONFLICT (business_id, code) DO NOTHING;');
  }
  sql.push('');
  sql.push('-- 3. Admin profile');
  sql.push('INSERT INTO profiles (id, business_id, email, mobile, contact_no, name, full_name, role, profile_type, password_hash, active, status)');
  sql.push(`VALUES ('p-admin-initial', '${esc(COMPANY.id)}', '${esc(email)}', '${esc(mobile)}', '${esc(mobile)}', '${esc(adminName)}', '${esc(adminName)}', 'admin', 'ADMIN', '${esc(passwordHash)}', TRUE, 'ACTIVE')`);
  sql.push('ON CONFLICT (id) DO NOTHING;');
  sql.push('');
  sql.push('-- 4. Admin membership');
  sql.push('INSERT INTO company_members (id, business_id, company_id, user_id, role, status)');
  sql.push(`VALUES ('mem-admin-initial', '${esc(COMPANY.id)}', '${esc(COMPANY.id)}', 'p-admin-initial', 'owner', 'active')`);
  sql.push('ON CONFLICT (business_id, user_id) DO NOTHING;');
  sql.push('');
  sql.push('COMMIT;');

  const outDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'seed_saifee_wholesale_mart.sql');
  fs.writeFileSync(outFile, sql.join('\n'), 'utf8');

  console.log('\n[PASS] SQL file ban gayi: ' + outFile);
  console.log('Ab is file ko Notepad me kholo, sab copy karo aur Supabase SQL Editor me paste karke Run karo.');
  console.log('Kaam hone ke baad is file ko delete kar dena (usme password ka hash hai).');
}

main().catch((err) => {
  console.error('[ERROR]', err && err.message ? err.message : err);
  process.exit(1);
});
