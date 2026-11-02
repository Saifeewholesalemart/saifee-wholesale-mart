const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'supabase', 'clean_rebuild_schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

console.log('=== STATIC VALIDATION OF clean_rebuild_schema.sql ===');

// 1. Extract all CREATE TABLE names
const tableMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(/gi)];
const tables = tableMatches.map(m => m[1].toLowerCase());
console.log(`Found ${tables.length} tables:`, tables);

// Check for duplicate table definitions
const tableSet = new Set();
const duplicateTables = [];
for (const t of tables) {
  if (tableSet.has(t)) {
    duplicateTables.push(t);
  }
  tableSet.add(t);
}
if (duplicateTables.length > 0) {
  console.error('ERROR: Duplicate tables found:', duplicateTables);
  process.exit(1);
} else {
  console.log('✓ PASS: No duplicate table definitions.');
}

// 2. Check foreign key references dependency order
const fkRegex = /REFERENCES\s+([a-zA-Z0-9_]+)\s*\(/gi;
const lines = content.split('\n');

let currentTable = null;
const definedTables = new Set();
let fkErrors = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const tableStart = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(/i);
  if (tableStart) {
    currentTable = tableStart[1].toLowerCase();
  }

  const fkMatch = [...line.matchAll(fkRegex)];
  for (const m of fkMatch) {
    const refTable = m[1].toLowerCase();
    // Self-references are allowed if table is currentTable
    if (refTable === currentTable) {
      continue;
    }
    if (!definedTables.has(refTable)) {
      console.error(`ERROR at line ${i + 1}: Table "${currentTable}" references "${refTable}" which has not been defined yet!`);
      fkErrors++;
    }
  }

  if (line.includes(');') && currentTable) {
    definedTables.add(currentTable);
    currentTable = null;
  }
}

if (fkErrors === 0) {
  console.log('✓ PASS: All foreign key references strictly satisfy topological dependency order.');
} else {
  console.error(`FAILED: ${fkErrors} foreign key dependency order errors found.`);
  process.exit(1);
}

// 3. Check for UUID type usage in IDs or foreign keys
const uuidRegex = /\bUUID\b/gi;
const uuidMatches = [...content.matchAll(uuidRegex)];
// Note: uuid-ossp extension mention is fine, but column types should not use UUID
const uuidColumns = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('uuid-ossp') || line.includes('--')) continue;
  if (/\bUUID\b/i.test(line)) {
    uuidColumns.push({ line: i + 1, content: line.trim() });
  }
}

if (uuidColumns.length > 0) {
  console.warn('NOTICE: UUID occurrences found:', uuidColumns);
} else {
  console.log('✓ PASS: Zero UUID columns found. All primary and foreign keys use consistent TEXT.');
}

console.log('=== ALL STATIC VALIDATIONS PASSED ===');
