/**
 * Demo data hatane wali patch: src/lib/db.ts
 *
 * Kya karti hai:
 *  - Code me likhe demo data (demo companies, Godown A/B, demo retailers, brands,
 *    categories, demo logins) hata deti hai.
 *  - Sirf aapka asli minimum data rakhti hai, jo cloud database se bilkul match karta hai:
 *      company: Saifee Wholesale Mart (biz-saifee)
 *      godowns: Main Godown (MAIN) aur Secondary Godown (SECONDARY)
 *
 * Kaise chalana hai (project folder me, jahan package.json hai):
 *   node remove_demo_seeds.js
 *
 * Safety: pehle db.ts ki backup copy banti hai (src/lib/db.ts.backup-before-seed-cleanup).
 * Patch ke baad syntax check hota hai. Check fail hua to backup apne aap wapas laga di jaati hai.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'db.ts');
const BACKUP_PATH = DB_PATH + '.backup-before-seed-cleanup';

if (!fs.existsSync(DB_PATH)) {
  console.error('[ERROR] src/lib/db.ts nahi mila. Ye script project folder me chalao (jahan package.json hai).');
  process.exit(1);
}

const REPLACEMENTS = {
  SEED_BUSINESS_COMPANIES: `[
  {
    id: 'biz-saifee',
    code: 'SWM',
    name: 'Saifee Wholesale Mart',
    business_type: 'FMCG Wholesale Distribution',
    city: 'Indore',
    state: 'Madhya Pradesh',
    state_code: '23',
    currency: 'INR',
    invoice_prefix: 'SWM-INV',
    order_prefix: 'SWM-ORD',
    customer_term: 'Retailer',
    status: 'active',
    is_active: true,
    is_default: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }
]`,
  SEED_COMPANY_MEMBERS: `[
  { id: 'mem-admin-initial', business_id: 'biz-saifee', user_id: 'p-admin-initial', role: 'owner', created_at: '2026-01-01T00:00:00.000Z' }
]`,
  SEED_GODOWNS: `[
  {
    id: 'gdn-main',
    business_id: 'biz-saifee',
    company_id: 'biz-saifee',
    name: 'Main Godown',
    code: 'MAIN',
    city: 'Indore',
    state: 'Madhya Pradesh',
    is_default: true,
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'gdn-secondary',
    business_id: 'biz-saifee',
    company_id: 'biz-saifee',
    name: 'Secondary Godown',
    code: 'SECONDARY',
    city: 'Indore',
    state: 'Madhya Pradesh',
    is_default: false,
    status: 'Active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }
]`,
  SEED_COMPANY_OPENING_BALANCES: `[
  {
    company_id: 'biz-saifee',
    opening_balance: 0,
    as_of_date: '2026-04-01',
    mode_balances: { 'Cash': 0, 'UPI': 0, 'Bank Transfer': 0, 'Cheque': 0, 'Other': 0 },
    updated_by: 'Admin',
    updated_at: '2026-04-01T00:00:00.000Z'
  }
]`,
  SEED_COMPANIES: '[]',
  SEED_SUPPLIERS: '[]',
  SEED_RETAILERS: '[]',
  SEED_PROFILES: '[]',
  SEED_CATEGORIES: '[]'
};

// '[' se shuru karke uske matching ']' ka index (strings/comments/template literals ka dhyan rakhte hue)
function findArrayEnd(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i++;
        i++;
      }
    } else if (c === '`') {
      i++;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === '$' && src[i + 1] === '{') {
          let d = 1;
          i += 2;
          while (i < src.length && d > 0) {
            if (src[i] === '{') d++;
            else if (src[i] === '}') d--;
            i++;
          }
          continue;
        }
        i++;
      }
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) throw new Error('Unterminated comment');
      i = end + 1;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  throw new Error('Matching ] nahi mila');
}

let src = fs.readFileSync(DB_PATH, 'utf8');
const original = src;

fs.writeFileSync(BACKUP_PATH, original, 'utf8');
console.log('Backup bana di: ' + path.relative(process.cwd(), BACKUP_PATH));

const done = [];
for (const [name, replacement] of Object.entries(REPLACEMENTS)) {
  const re = new RegExp('(export\\s+)?const\\s+' + name + '\\s*:\\s*[A-Za-z_]+\\[\\]\\s*=\\s*\\[');
  const m = re.exec(src);
  if (!m) {
    console.error('[ERROR] ' + name + ' nahi mila. db.ts me kuch badal gaya hai. Backup wapas laga raha hu.');
    fs.writeFileSync(DB_PATH, original, 'utf8');
    process.exit(1);
  }
  const openIdx = m.index + m[0].length - 1;
  const closeIdx = findArrayEnd(src, openIdx);
  src = src.slice(0, openIdx) + replacement + src.slice(closeIdx + 1);
  done.push(name);
}

fs.writeFileSync(DB_PATH, src, 'utf8');

// Syntax check (Node 22.13+ me type-strip se)
try {
  const nodeModule = require('node:module');
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    const os = require('os');
    const { execFileSync } = require('child_process');
    const js = nodeModule.stripTypeScriptTypes(src, { mode: 'strip' });
    const tmp = path.join(os.tmpdir(), 'db_seed_check_' + Date.now() + '.mjs');
    fs.writeFileSync(tmp, js, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) {}
    }
    console.log('Syntax check: OK');
  } else {
    console.log('Syntax check skip hua (Node version purana hai). Baad me npm run dev se check ho jayega.');
  }
} catch (e) {
  console.error('[ERROR] Patch ke baad syntax check fail hua. Backup wapas laga raha hu.');
  console.error(String((e && e.stderr) || (e && e.message) || e).split('\n').slice(0, 8).join('\n'));
  fs.writeFileSync(DB_PATH, original, 'utf8');
  process.exit(1);
}

console.log('\n[PASS] Demo data hata diya. Badle gaye: ' + done.join(', '));
console.log('Ab browser ka purana local data bhi saaf karna hai (steps chat me bataye hain).');
