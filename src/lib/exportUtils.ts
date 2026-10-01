/**
 * Export and Print Utilities for Saifee FMCG Reports Module
 */

export interface ExportColumn<T = any> {
  header: string;
  key?: keyof T | string;
  accessor?: (row: T) => string | number | null | undefined;
  format?: 'currency' | 'number' | 'text' | 'date' | 'percent';
}

export interface ExportOptions<T = any> {
  reportTitle: string;
  subtitle?: string;
  filterSummary?: string[];
  columns: ExportColumn<T>[];
  data: T[];
  totalsRow?: Record<string, string | number>;
  companyName?: string;
}

/**
 * Format value according to column specification
 */
export function formatValueForExport(val: any, format?: string): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (format === 'currency') return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (format === 'percent') return `${val.toFixed(1)}%`;
    return val.toLocaleString('en-IN');
  }
  return String(val).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Clean value for CSV (escape quotes and commas)
 */
function cleanForCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export to CSV with metadata header
 */
export function exportToCSV<T>(options: ExportOptions<T>): void {
  const { reportTitle, filterSummary = [], columns, data, totalsRow, companyName = 'SAIFEE GENERAL STORES' } = options;
  
  const now = new Date();
  const timestamp = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const csvLines: string[] = [];

  // Metadata Header
  csvLines.push(cleanForCSV(companyName.toUpperCase()));
  csvLines.push(cleanForCSV(reportTitle));
  csvLines.push(cleanForCSV(`Generated on: ${timestamp}`));
  if (filterSummary.length > 0) {
    csvLines.push(cleanForCSV(`Applied Filters: ${filterSummary.join(' | ')}`));
  }
  csvLines.push(''); // Empty line before table

  // Column Headers
  const headerRow = columns.map(c => cleanForCSV(c.header)).join(',');
  csvLines.push(headerRow);

  // Data Rows
  data.forEach(row => {
    const rowValues = columns.map(col => {
      let rawVal: any;
      if (col.accessor) {
        rawVal = col.accessor(row);
      } else if (col.key) {
        rawVal = (row as any)[col.key];
      }
      return cleanForCSV(formatValueForExport(rawVal, col.format));
    });
    csvLines.push(rowValues.join(','));
  });

  // Totals Row
  if (totalsRow) {
    csvLines.push('');
    const totalsValues = columns.map((col, idx) => {
      if (idx === 0 && !totalsRow[col.header] && !totalsRow[col.key as string]) {
        return cleanForCSV('TOTAL');
      }
      const val = (col.key && totalsRow[col.key as string]) !== undefined 
        ? totalsRow[col.key as string] 
        : totalsRow[col.header];
      return cleanForCSV(val !== undefined ? formatValueForExport(val, col.format) : '');
    });
    csvLines.push(totalsValues.join(','));
  }

  // Generate and trigger download with UTF-8 BOM
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export to Excel (HTML table format that opens natively in MS Excel)
 */
export function exportToExcel<T>(options: ExportOptions<T>): void {
  const { reportTitle, filterSummary = [], columns, data, totalsRow, companyName = 'SAIFEE GENERAL STORES' } = options;
  const now = new Date();
  const timestamp = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${reportTitle.slice(0, 30)}</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        .title { font-size: 16pt; font-weight: bold; color: #1e1b4b; }
        .meta { font-size: 10pt; color: #64748b; }
        th { background-color: #312e81; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 10px; }
        td { border: 1px solid #e2e8f0; padding: 5px 8px; font-size: 10pt; }
        .total-row td { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #334155; }
        .num { text-align: right; }
      </style>
    </head>
    <body>
      <div class="title">${companyName} - ${reportTitle}</div>
      <div class="meta">Generated: ${timestamp}</div>
      ${filterSummary.length > 0 ? `<div class="meta">Filters: ${filterSummary.join(' | ')}</div>` : ''}
      <br/>
      <table>
        <thead>
          <tr>
            ${columns.map(c => `<th>${c.header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach(row => {
    html += '<tr>';
    columns.forEach(col => {
      let rawVal: any;
      if (col.accessor) {
        rawVal = col.accessor(row);
      } else if (col.key) {
        rawVal = (row as any)[col.key];
      }
      const isNum = typeof rawVal === 'number' || col.format === 'currency' || col.format === 'percent';
      const formatted = formatValueForExport(rawVal, col.format);
      html += `<td class="${isNum ? 'num' : ''}">${formatted}</td>`;
    });
    html += '</tr>';
  });

  if (totalsRow) {
    html += '<tr class="total-row">';
    columns.forEach((col, idx) => {
      if (idx === 0 && !totalsRow[col.header] && !totalsRow[col.key as string]) {
        html += '<td>TOTAL</td>';
        return;
      }
      const val = (col.key && totalsRow[col.key as string]) !== undefined 
        ? totalsRow[col.key as string] 
        : totalsRow[col.header];
      const isNum = typeof val === 'number' || col.format === 'currency' || col.format === 'percent';
      html += `<td class="${isNum ? 'num' : ''}">${val !== undefined ? formatValueForExport(val, col.format) : ''}</td>`;
    });
    html += '</tr>';
  }

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}.xls`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy Table Data to Clipboard as TSV (Tab Separated Values)
 */
export async function copyTableToClipboard<T>(options: ExportOptions<T>): Promise<boolean> {
  const { reportTitle, columns, data, totalsRow } = options;
  const lines: string[] = [];

  // Header
  lines.push(columns.map(c => c.header).join('\t'));

  // Data
  data.forEach(row => {
    const rowValues = columns.map(col => {
      let rawVal: any;
      if (col.accessor) {
        rawVal = col.accessor(row);
      } else if (col.key) {
        rawVal = (row as any)[col.key];
      }
      return formatValueForExport(rawVal, col.format).replace(/\t/g, ' ');
    });
    lines.push(rowValues.join('\t'));
  });

  // Totals
  if (totalsRow) {
    const totalsValues = columns.map((col, idx) => {
      if (idx === 0 && !totalsRow[col.header] && !totalsRow[col.key as string]) {
        return 'TOTAL';
      }
      const val = (col.key && totalsRow[col.key as string]) !== undefined 
        ? totalsRow[col.key as string] 
        : totalsRow[col.header];
      return val !== undefined ? formatValueForExport(val, col.format).replace(/\t/g, ' ') : '';
    });
    lines.push(totalsValues.join('\t'));
  }

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard', e);
    return false;
  }
}

/**
 * Trigger print dialog
 */
export function printReport(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
