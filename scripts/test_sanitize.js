/**
 * Test: Credential Sanitizer Redaction Test
 * Saifee General Stores FMCG Wholesale Distribution & Trade ERP
 * File: scripts/test_sanitize.js
 *
 * Verifies that sanitize() redacts both legacy JWTs and newer sb_secret_... keys
 * using mock dummy tokens (NO real credentials).
 */

const assert = require('assert');
const { sanitize } = require('./seed_demo_staging_data');

console.log('Running sanitize() credential redaction tests...\n');

// 1. Legacy JWT redaction
const dummyJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.mock_signature_xyz';
const jwtLog = `Error: Authentication failed with token ${dummyJwt} at endpoint`;
const sanitizedJwt = sanitize(jwtLog);

assert(!sanitizedJwt.includes(dummyJwt), 'FAIL: Dummy JWT was not redacted');
assert(sanitizedJwt.includes('[REDACTED_JWT]'), 'FAIL: [REDACTED_JWT] placeholder missing');
console.log('  PASS: Legacy JWT format redacted successfully.');

// 2. Newer sb_secret_... key redaction
const dummySecret = 'sb_secret_mockSecretKey1234567890_abcdef-XYZ';
const secretLog = `Client initialized with key ${dummySecret} for staging`;
const sanitizedSecret = sanitize(secretLog);

assert(!sanitizedSecret.includes(dummySecret), 'FAIL: Dummy sb_secret key was not redacted');
assert(sanitizedSecret.includes('[REDACTED_SECRET]'), 'FAIL: [REDACTED_SECRET] placeholder missing');
console.log('  PASS: sb_secret_... format redacted successfully.');

// 3. Combined / dual credential redaction
const combinedLog = `Credentials: JWT=${dummyJwt} and SECRET=${dummySecret}`;
const sanitizedCombined = sanitize(combinedLog);

assert(!sanitizedCombined.includes(dummyJwt), 'FAIL: JWT present in combined message');
assert(!sanitizedCombined.includes(dummySecret), 'FAIL: Secret key present in combined message');
assert(sanitizedCombined.includes('[REDACTED_JWT]'), 'FAIL: [REDACTED_JWT] missing in combined message');
assert(sanitizedCombined.includes('[REDACTED_SECRET]'), 'FAIL: [REDACTED_SECRET] missing in combined message');
console.log('  PASS: Combined JWT and sb_secret_ formats both redacted in single message.');

// 4. Safe string pass-through
const normalMsg = 'Target verified as isolated staging environment: jtofsoriinobcabpjswl.supabase.co';
assert.strictEqual(sanitize(normalMsg), normalMsg, 'FAIL: Normal log message modified unexpectedly');
assert.strictEqual(sanitize(''), '', 'FAIL: Empty string should return empty string');
console.log('  PASS: Standard text and empty values handled correctly.');

console.log('\nAll sanitize() redaction tests passed successfully!');
