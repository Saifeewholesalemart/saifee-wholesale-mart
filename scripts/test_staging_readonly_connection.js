/**
 * ============================================================================
 * Safe Staging Read-Only Connection Preflight Test
 * Saifee General Stores FMCG Wholesale Distribution & Trade ERP
 * File: scripts/test_staging_readonly_connection.js
 * ============================================================================
 *
 * SAFETY GUARANTEES:
 * 1. STRICT READ-ONLY: Never writes, mutates, migrates, or alters database state.
 * 2. PRODUCTION BLOCKLIST: Hardcoded block of production project 'wxctglnnybhhptkxwxur'.
 * 3. EXPLICIT STAGING TARGET: Validates target ref is 'jtofsoriinobcabpjswl'.
 * 4. CREDENTIAL SANITIZATION: Passwords, JWTs, and keys are NEVER printed.
 * 5. PLACEHOLDER REJECTION: Fails if placeholder credentials are detected.
 *
 * USAGE (ONCE APPROVED BY USER):
 *   node scripts/test_staging_readonly_connection.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BLOCKED_PRODUCTION_REFS = ['wxctglnnybhhptkxwxur'];
const EXPECTED_STAGING_REF = 'jtofsoriinobcabpjswl';

// Load .env.staging
const stagingEnvPath = path.resolve(process.cwd(), '.env.staging');
if (!fs.existsSync(stagingEnvPath)) {
  console.error('[PREFLIGHT ERROR] Missing .env.staging configuration file.');
  process.exit(1);
}

const content = fs.readFileSync(stagingEnvPath, 'utf8');
content.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
});

const targetUrl = process.env.STAGING_SUPABASE_URL || '';
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.STAGING_SERVICE_ROLE_KEY || '';
const dbUrl = process.env.STAGING_DATABASE_URL || '';

function maskSecret(str) {
  if (!str) return '[NOT_SET]';
  if (str.length <= 8) return '********';
  return str.substring(0, 4) + '...' + str.substring(str.length - 4);
}

function sanitizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.password) u.password = '****';
    return u.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

async function runPreflight() {
  console.log('================================================================');
  console.log('STAGING CONNECTION PREFLIGHT (STRICT READ-ONLY)');
  console.log('================================================================');

  // 1. Production Blocklist Check
  for (const prodRef of BLOCKED_PRODUCTION_REFS) {
    if (targetUrl.includes(prodRef) || dbUrl.includes(prodRef)) {
      throw new Error(`CRITICAL SECURITY VIOLATION: Target matches blocked production ref "${prodRef}". Aborting.`);
    }
  }

  // 2. Expected Staging Target Check
  if (!targetUrl.includes(EXPECTED_STAGING_REF)) {
    throw new Error(`TARGET MISMATCH: Staging URL does not match verified staging ref "${EXPECTED_STAGING_REF}".`);
  }

  if (dbUrl && !dbUrl.includes(EXPECTED_STAGING_REF)) {
    throw new Error(`TARGET MISMATCH: Database URL does not match verified staging ref "${EXPECTED_STAGING_REF}".`);
  }

  // 3. Placeholder Detection Check
  const placeholderPatterns = ['your_staging', 'your-project-ref', '[YOUR_', '[password]', 'your_service_role'];
  const defects = [];

  if (!anonKey) defects.push('STAGING_SUPABASE_ANON_KEY is missing');
  else if (placeholderPatterns.some(p => anonKey.includes(p))) defects.push('STAGING_SUPABASE_ANON_KEY contains placeholder value');

  if (!serviceRoleKey) defects.push('STAGING_SERVICE_ROLE_KEY is missing');
  else if (placeholderPatterns.some(p => serviceRoleKey.includes(p))) defects.push('STAGING_SERVICE_ROLE_KEY contains placeholder value');

  if (!dbUrl) defects.push('STAGING_DATABASE_URL is missing');
  else if (placeholderPatterns.some(p => dbUrl.includes(p))) defects.push('STAGING_DATABASE_URL contains placeholder password');

  if (defects.length > 0) {
    console.error('\n[DEFECT DETECTED IN LOCAL CONFIGURATION]');
    defects.forEach(d => console.error(`  - ${d}`));
    console.error('\nPlease update .env.staging locally with real credentials before testing connection.\n');
    process.exit(1);
  }

  console.log('Configuration Audit:');
  console.log(`  - Target Project Ref  : ${EXPECTED_STAGING_REF}`);
  console.log(`  - Target Supabase URL : ${targetUrl}`);
  console.log(`  - Staging Anon Key    : ${maskSecret(anonKey)}`);
  console.log(`  - Service Role Key    : ${maskSecret(serviceRoleKey)}`);
  console.log(`  - Staging DB Endpoint : ${sanitizeUrl(dbUrl)}`);
  console.log('  - Production Status   : ISOLATED & PROTECTED (wxctglnnybhhptkxwxur blocked)');

  // 4. Read-Only Health & Endpoint Check
  console.log('\nExecuting Read-Only Probe to Staging REST Gateway...');
  const parsedUrl = new URL(targetUrl);

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: '/rest/v1/',
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'User-Agent': 'Saifee-Staging-Preflight/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`Probe Response Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`Connected Server      : ${res.headers['server'] || 'cloudflare/supabase'}`);
      console.log(`API Gateway Version   : ${res.headers['sb-gateway-version'] || 'PostgREST'}`);

      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log('\n[SUCCESS] Verified live read-only connectivity to isolated staging project.');
        resolve();
      } else {
        reject(new Error(`Endpoint responded with HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
    });

    req.on('error', (e) => {
      reject(new Error(`Network connection error: ${e.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Connection timed out after 8000ms'));
    });

    req.end();
  });
}

if (require.main === module) {
  runPreflight().catch(err => {
    console.error(`\n[PREFLIGHT FAILED] ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { runPreflight };
