/**
 * Word search used by every search box.
 * "ponds talc" finds "Ponds Body Talc 300gm": every typed word must be present,
 * in any order and with other words in between.
 */

let lastQuery = '';
let lastWords: string[] = [];

function wordsOf(query: string): string[] {
  if (query !== lastQuery) {
    lastQuery = query;
    lastWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  }
  return lastWords;
}

export function hasWords(text: unknown, query: unknown): boolean {
  // Lists (for example a list of order numbers) keep the exact-match check
  if (Array.isArray(text)) return text.includes(query as never);
  if (typeof text !== 'string') return false;
  const q = typeof query === 'string' ? query : String(query ?? '');
  const words = wordsOf(q);
  if (words.length === 0) return text.includes(q);
  const hay = text.toLowerCase();
  for (const w of words) if (!hay.includes(w)) return false;
  return true;
}
