/**
 * High-Performance Client & Server Compression Utilities
 * Uses web standard CompressionStream('gzip') / DecompressionStream('gzip')
 * to shrink multi-megabyte ERP databases by 90-95%, allowing instant transmission
 * through Supabase, Cloudflare, and browser network connections without hitting HTTP payload limits.
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * Compresses an arbitrary JavaScript object or string into a Base64 gzip string.
 */
export async function compressData<T = any>(data: T): Promise<string> {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  if (!isCompressionSupported()) {
    // Fallback: encode URI component or raw base64
    return btoa(unescape(encodeURIComponent(jsonStr)));
  }

  const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return arrayBufferToBase64(buffer);
}

/**
 * Decompresses a Base64 gzip string back into a parsed JavaScript object.
 */
export async function decompressData<T = any>(base64Data: string): Promise<T> {
  if (!isCompressionSupported()) {
    const raw = decodeURIComponent(escape(atob(base64Data)));
    return JSON.parse(raw) as T;
  }

  try {
    const buffer = base64ToArrayBuffer(base64Data);
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    return JSON.parse(text) as T;
  } catch (err) {
    // If it was raw uncompressed base64
    const raw = decodeURIComponent(escape(atob(base64Data)));
    return JSON.parse(raw) as T;
  }
}
