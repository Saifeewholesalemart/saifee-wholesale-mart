import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Active high-availability multimodal Gemini models in order of verified speed and reliability
const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash'
];

async function generateWithFallback(genAI: GoogleGenerativeAI, prompt: string, docPart: any) {
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    // Try each model with retry on transient load spikes
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini OCR] Trying model ${modelName} (attempt ${attempt})...`);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.1
          }
        });

        const result = await model.generateContent([prompt, docPart]);
        let responseText = result.response.text().trim();
        
        // Clean markdown code blocks if returned
        if (responseText.startsWith('```')) {
          responseText = responseText.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
        }

        // Ensure valid JSON extract even if extra characters wrap the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseText = jsonMatch[0];
        }

        const parsed = JSON.parse(responseText);
        console.log(`[Gemini OCR] Successfully extracted invoice using model: ${modelName}`);
        return { data: parsed, modelUsed: modelName };
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || '').toLowerCase();
        const isTransient = errMsg.includes('503') || 
                            errMsg.includes('high demand') || 
                            errMsg.includes('service unavailable') || 
                            errMsg.includes('429') || 
                            errMsg.includes('rate limit') || 
                            errMsg.includes('resource exhausted') ||
                            errMsg.includes('overloaded');

        console.warn(`[Gemini OCR] Model ${modelName} (attempt ${attempt}) error:`, err.message || err);

        if (isTransient && attempt < 2) {
          // Brief 1s backoff before retry on same model
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Cascade to next candidate model
        break;
      }
    }
  }

  throw lastError || new Error('All Gemini candidate models failed to parse invoice.');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check if Gemini API Key is configured in environment variables
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      return NextResponse.json({ 
        success: false, 
        error: 'Gemini AI is not configured. Please configure the Gemini API key in your environment variables.' 
      }, { status: 400 });
    }

    let extractedData;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);

      // Convert file to base64 Part for Gemini API
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const docPart = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: file.type || 'application/pdf'
        }
      };

      const prompt = `
        You are an expert OCR parser for FMCG wholesale purchase bill invoices.
        Analyze the uploaded document (PDF or image) and extract the invoice details.
        
        Follow these critical rules:
        1. Extract raw values exactly as they are printed on the invoice. Do NOT modify them.
        2. Do NOT guess or hallucinate any fields. If a value is not clearly visible or not present in the document, return null.
        3. For items:
           - "description": The printed product name/description.
           - "quantity": Number of units purchased (e.g. cartons/boxes/bags).
           - "unit": e.g. "Carton" or "Box" or "Bag" or "Unit" as printed on the invoice.
           - "free_quantity": Quantity given free under schemes if printed, otherwise return null or 0.
           - "purchase_rate": The purchase rate per unit/carton/box.
           - "gst_rate": The GST percent for this line item (e.g. 18, 12, 5, 28, 0, or null).
           - "batch_number": The printed batch number for the line, if present.
           - "expiry_date": The printed expiry date in YYYY-MM-DD format (or estimate as last day of month if only Month/Year is printed, e.g. EXP 12/27 -> 2027-12-31).
        
        Return a strict JSON object conforming exactly to this structure:
        {
          "supplier": {
            "name": "Supplier name",
            "gstin": "Supplier GSTIN (15 characters)",
            "address": "Supplier address"
          },
          "invoice": {
            "invoice_number": "Invoice/Bill Number",
            "invoice_date": "YYYY-MM-DD",
            "place_of_supply": "State code/name"
          },
          "items": [
            {
              "description": "Product name/description",
              "sku": "SKU/Product code if printed",
              "barcode": "Barcode number if printed",
              "hsn": "HSN Code",
              "packing": "Pack size display, e.g. 24 units/carton",
              "quantity": 10,
              "unit": "Carton",
              "free_quantity": 0,
              "purchase_rate": 100.00,
              "discount": 0.00,
              "mrp": 120.00,
              "gst_rate": 18,
              "batch_number": "Batch code",
              "manufacturing_date": "YYYY-MM-DD or null",
              "expiry_date": "YYYY-MM-DD or null"
            }
          ],
          "totals": {
            "subtotal": 1000.00,
            "discount": 0.00,
            "taxable_value": 1000.00,
            "cgst": 90.00,
            "sgst": 90.00,
            "igst": 0.00,
            "grand_total": 1180.00
          }
        }
      `;

      const { data: extractedRaw, modelUsed } = await generateWithFallback(genAI, prompt, docPart);

      // Map the strict schema to the application's expected format
      const linesMapped = (extractedRaw.items || []).map((item: any) => ({
        extracted_name: item.description || '',
        barcode: item.barcode || null,
        sku: item.sku || null,
        pack_size: item.packing || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0,
        trading_unit: (item.unit && (item.unit.toLowerCase().includes('box') ? 'Box' : 'Carton')) || 'Carton',
        purchase_rate: typeof item.purchase_rate === 'number' ? item.purchase_rate : parseFloat(item.purchase_rate) || 0,
        discount: typeof item.discount === 'number' ? item.discount : parseFloat(item.discount) || 0,
        free_quantity: typeof item.free_quantity === 'number' ? item.free_quantity : parseInt(item.free_quantity) || 0,
        mrp: typeof item.mrp === 'number' ? item.mrp : parseFloat(item.mrp) || 0,
        gst_percent: typeof item.gst_rate === 'number' ? item.gst_rate : parseInt(item.gst_rate) || 0,
        hsn: item.hsn || '',
        batch: item.batch_number || '',
        expiry_date: item.expiry_date || ''
      }));

      extractedData = {
        supplier_name: extractedRaw.supplier?.name || '',
        supplier_gstin: extractedRaw.supplier?.gstin || '',
        invoice_number: extractedRaw.invoice?.invoice_number || '',
        invoice_date: extractedRaw.invoice?.invoice_date || '',
        total_amount: extractedRaw.totals?.grand_total || linesMapped.reduce((sum: number, l: any) => sum + (l.purchase_rate * l.quantity), 0),
        lines: linesMapped,
        model_used: modelUsed
      };

    } catch (err: any) {
      console.error('Gemini API execution failed:', err);
      const isOverloaded = (err.message || '').includes('503') || (err.message || '').includes('high demand') || (err.message || '').includes('temporarily');
      return NextResponse.json({ 
        success: false, 
        error: isOverloaded
          ? 'Gemini servers are experiencing temporary high demand. Please click "Try Again" to re-process.'
          : `AI invoice processing notice: ${err.message || 'Unknown error'}` 
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: extractedData
    });

  } catch (error: any) {
    console.error('OCR API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error during invoice processing' }, { status: 500 });
  }
}
