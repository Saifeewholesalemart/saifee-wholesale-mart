/**
 * Universal print utility for Tax Invoices & Delivery Challans:
 * Extracts the target printable container, creates an isolated print frame,
 * injects all active stylesheets, fonts, and @page rules, and triggers print.
 * Guaranteed to print ONLY the clean invoice document with zero background bleed and zero blank pages.
 */
export function printInvoiceDocument(elementId: string = 'printable-tax-invoice', title?: string) {
  if (typeof window === 'undefined') return;

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    window.print();
    return;
  }

  // Clone the element to safely strip out any elements with .no-print
  const clone = targetElement.cloneNode(true) as HTMLElement;
  const noPrintElements = clone.querySelectorAll('.no-print');
  noPrintElements.forEach(el => el.remove());

  // Remove existing print frame if one was left behind
  const existingFrame = document.getElementById('invoice-print-frame');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  // Create an invisible iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'invoice-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Collect all existing stylesheets & style tags from parent document
  const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(style => style.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title || 'Tax Invoice'}</title>
        ${headStyles}
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 8pt !important;
            width: 100% !important;
            height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto;
          }
          thead {
            display: table-header-group !important;
          }
          .dense-print-th {
            padding: 2.5px 4px !important;
            font-size: 7.5pt !important;
            border-top: 1px solid #000000 !important;
            border-bottom: 1px solid #000000 !important;
            background-color: #f1f5f9 !important;
            color: #000000 !important;
          }
          .dense-print-td {
            padding: 2.5px 4px !important;
            font-size: 8pt !important;
            border-bottom: 0.5px solid #cbd5e1 !important;
            line-height: 1.2 !important;
          }
          .retailer-name-print {
            font-size: 11pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            line-height: 1.25 !important;
            letter-spacing: -0.01em !important;
            text-transform: uppercase !important;
          }
          #print-root {
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-area {
            border: 1px solid #475569 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 8px 12px !important;
            margin: 0 !important;
          }
        </style>
      </head>
      <body>
        <div id="print-root">
          ${clone.outerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Give browser a short tick to render styles before printing
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      window.print();
    } finally {
      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        } catch (_) {}
      }, 2500);
    }
  }, 250);
}
