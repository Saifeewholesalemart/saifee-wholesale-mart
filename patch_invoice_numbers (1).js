/**
 * Patch: Invoice number cloud server se (src/lib/db.ts), bina screen atkaye
 *
 * Pehle: INV/2026-27/ + (is browser ke invoices ki ginti + 1)  ->  do device par same number ban sakta tha.
 * Ab:    cloud database ka atomic counter se number aata hai. Internet na ho to bill nahi banega.
 *        Number bill dabate hi (screen ko rok kar nahi) alag se mangaya jaata hai.
 *
 * Chalane ka tarika (project folder me, jahan package.json hai):
 *   node patch_invoice_numbers.js
 *
 * Ye script teeno haalat sambhalti hai: pehli baar, pichla version laga ho, ya ye version pehle se laga ho.
 * Safety: db.ts ki backup copy banti hai (src/lib/db.ts.backup-before-invoice-numbers-v2).
 * Patch ke baad syntax check hota hai; fail hua to backup apne aap wapas lag jaati hai.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'src', 'lib', 'db.ts');
const BACKUP_PATH = DB_PATH + '.backup-before-invoice-numbers-v2';

if (!fs.existsSync(DB_PATH)) {
  console.error('[ERROR] src/lib/db.ts nahi mila. Ye script project folder me chalao (jahan package.json hai).');
  process.exit(1);
}

const original = fs.readFileSync(DB_PATH, 'utf8');
let src = original;

if (src.includes('// INVOICE_NUMBERS_V2')) {
  console.log('Ye patch pehle se laga hua hai. Kuch badalne ki zaroorat nahi.');
  process.exit(0);
}

fs.writeFileSync(BACKUP_PATH, original, 'utf8');
console.log('Backup bana di: ' + path.relative(process.cwd(), BACKUP_PATH));

const ANCHOR = '  // Active User session in DB (Defaults to unauthenticated guest)';

const V2_BLOCK = `  // INVOICE_NUMBERS_V2
  private preparedInvoiceNumber: string | null = null;

  /**
   * Cloud server se agla invoice number pehle hi le aata hai (screen ko rok kar nahi).
   * Uske baad bill banane wale function ko ye number turant mil jaata hai.
   */
  async prepareInvoiceNumber(): Promise<void> {
    this.preparedInvoiceNumber = null;
    if (typeof window === 'undefined') return;

    let res: Response;
    try {
      res = await fetch('/api/invoice-numbers/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    } catch {
      throw new Error('Internet ya server se connection nahi ho paya. Invoice number cloud se milna zaroori hai, isliye bill abhi nahi ban sakta. Internet check karke dobara try karein.');
    }

    if (res.status === 401) {
      throw new Error('Aapka login session khatam ho gaya hai. Dobara login karein.');
    }

    let data: any = null;
    try { data = await res.json(); } catch {}
    if (!res.ok || !data || !data.success || !data.number) {
      throw new Error('Invoice number cloud se nahi mil paya. Thodi der baad dobara try karein.');
    }
    this.preparedInvoiceNumber = String(data.number);
  }

  /**
   * Number mil gaya par bill nahi bana, to number server ko wapas de do (taaki number chhoote nahi).
   */
  releaseUnusedInvoiceNumber(): void {
    const unused = this.preparedInvoiceNumber;
    this.preparedInvoiceNumber = null;
    if (!unused || typeof window === 'undefined') return;
    try {
      fetch('/api/invoice-numbers/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: unused }),
        keepalive: true
      }).catch(() => {});
    } catch {}
  }

  /**
   * Bill ke liye invoice number. Pehle se mangaya hua number turant milta hai.
   * Agar kisi raaste ne pehle se number nahi mangaya, to safety ke liye server se seedha
   * (screen rok kar) number liya jaata hai. Internet ya server na ho to bill nahi banega.
   * Server-side / test (jahan browser nahi hota) me local formula chalta hai.
   */
  takeInvoiceNumber(localInvoices: Invoice[]): string {
    if (this.preparedInvoiceNumber) {
      const prepared = this.preparedInvoiceNumber;
      this.preparedInvoiceNumber = null;
      return prepared;
    }

    if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') {
      const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      const label = String(startYear % 100).padStart(2, '0') + '-' + String((startYear + 1) % 100).padStart(2, '0');
      return 'INV/' + label + '/' + String(localInvoices.length + 1).padStart(5, '0');
    }

    const fail = (message: string): never => {
      try { window.alert(message); } catch {}
      throw new Error(message);
    };

    let status = 0;
    let responseText = '';
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/invoice-numbers/next', false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send('{}');
      status = xhr.status;
      responseText = xhr.responseText;
    } catch {
      return fail('Internet ya server se connection nahi ho paya. Invoice number cloud se milna zaroori hai, isliye bill abhi nahi ban sakta. Internet check karke dobara try karein.');
    }

    if (status === 401) {
      return fail('Aapka login session khatam ho gaya hai. Dobara login karein.');
    }

    let data: any = null;
    try { data = JSON.parse(responseText); } catch {}
    if (status !== 200 || !data || !data.success || !data.number) {
      return fail('Invoice number cloud se nahi mil paya. Thodi der baad dobara try karein.');
    }
    return String(data.number);
  }

`;

let replacedCount = 0;

if (src.includes('takeInvoiceNumber(')) {
  // Pichla (v1) version laga hai: uske method ko naye block se badlo
  const startMarker = '  /**\n   * Invoice number cloud server se aata hai';
  const start = src.indexOf(startMarker);
  const end = src.indexOf(ANCHOR);
  if (start === -1 || end === -1 || end < start) {
    console.error('[ERROR] Pichle patch ka block pehchan nahi paya. Backup wapas laga raha hu.');
    fs.writeFileSync(DB_PATH, original, 'utf8');
    process.exit(1);
  }
  src = src.slice(0, start) + V2_BLOCK + src.slice(end);
  console.log('Pichla version upgrade kiya.');
} else {
  // Pehli baar: purani local counter wali lines badlo aur block jodo
  const pattern = /const (invoiceNumber|invNum) = `INV\/2026-27\/\$\{String\(invoices\.length \+ 1\)\.padStart\(5, '0'\)\}`;/g;
  src = src.replace(pattern, (m, varName) => {
    replacedCount++;
    return 'const ' + varName + ' = this.takeInvoiceNumber(invoices);';
  });
  if (replacedCount === 0) {
    console.error('[ERROR] Invoice number wali lines nahi mili. db.ts me kuch badal gaya hai. Backup wapas laga raha hu.');
    fs.writeFileSync(DB_PATH, original, 'utf8');
    process.exit(1);
  }
  if (src.split(ANCHOR).length !== 2) {
    console.error('[ERROR] db.ts me method jodne ki jagah nahi mili. Backup wapas laga raha hu.');
    fs.writeFileSync(DB_PATH, original, 'utf8');
    process.exit(1);
  }
  src = src.replace(ANCHOR, V2_BLOCK + ANCHOR);
}

fs.writeFileSync(DB_PATH, src, 'utf8');

// Syntax check (Node 22.13+)
try {
  const nodeModule = require('node:module');
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    const os = require('os');
    const { execFileSync } = require('child_process');
    const js = nodeModule.stripTypeScriptTypes(src, { mode: 'strip' });
    const tmp = path.join(os.tmpdir(), 'db_inv_check_' + Date.now() + '.mjs');
    fs.writeFileSync(tmp, js, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) {}
    }
    console.log('Syntax check: OK');
  } else {
    console.log('Syntax check skip hua (Node version purana hai).');
  }
} catch (e) {
  console.error('[ERROR] Patch ke baad syntax check fail hua. Backup wapas laga raha hu.');
  console.error(String((e && e.stderr) || (e && e.message) || e).split('\n').slice(0, 8).join('\n'));
  fs.writeFileSync(DB_PATH, original, 'utf8');
  process.exit(1);
}

console.log('\n[PASS] Invoice number patch lag gaya.' + (replacedCount ? ' (' + replacedCount + ' jagah badli)' : ''));
