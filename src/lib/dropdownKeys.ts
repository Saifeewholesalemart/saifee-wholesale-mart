/**
 * Arrow keys for every search box with a dropdown, app-wide.
 *
 * After typing in a search box, ↓ / ↑ move through the dropdown that opened under it,
 * Enter picks the highlighted entry and Esc clears the highlight. Focus stays in the
 * search box (many dropdowns close when the box loses focus), so the highlight is drawn
 * on the entry instead.
 *
 * Search boxes that already handle the arrow keys themselves are left alone: their own
 * handler marks the key as handled (preventDefault) and this helper then does nothing.
 * An input can also opt out with data-no-list-nav.
 */

const ACTIVE_ATTR = 'data-kb-active';
const STYLE_ID = 'dropdown-keys-style';

interface NavState { input: HTMLInputElement; items: HTMLElement[]; index: number }
let state: NavState | null = null;

function visible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

const ITEM_SELECTOR = [
  'button:not([disabled])', 'a[href]', '[role="option"]', 'li',
  '[class*="cursor-pointer"]', '[class*="hover:bg"]'
].join(',');

function itemsIn(panel: HTMLElement): HTMLElement[] {
  const all = Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(visible);
  // keep the innermost clickable entries (a row with a button inside -> the button)
  return all.filter(el => !all.some(other => other !== el && el.contains(other)));
}

function isTextInput(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.hasAttribute('data-no-list-nav')) return false;
  const t = (el.type || 'text').toLowerCase();
  return t === 'text' || t === 'search' || t === '' || t === 'tel' || t === 'email';
}

const isFloating = (el: Element) => {
  const pos = getComputedStyle(el).position;
  return pos === 'absolute' || pos === 'fixed';
};
const following = (input: HTMLElement, el: Element) =>
  Boolean(input.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);

/** The panel opens right under (or just over) the search box and overlaps it sideways. */
function closeUnder(input: HTMLElement, el: HTMLElement): boolean {
  const a = input.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const sideways = b.left < a.right && b.right > a.left;
  const below = b.top >= a.top && b.top - a.bottom < 80;
  const above = b.bottom <= a.bottom && a.top - b.bottom < 80;
  return sideways && (below || above);
}

/**
 * The entries of the dropdown that belongs to this input. Two layouts are common:
 * 1. the list floats just after the search box (box, then a positioned panel under it);
 * 2. the search box sits inside the floating panel, with the list below it.
 */
function findItems(input: HTMLInputElement): HTMLElement[] | null {
  // 1. a positioned panel just after the input
  let node: HTMLElement | null = input.parentElement;
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    const candidates = Array.from(node.querySelectorAll<HTMLElement>('[class*="absolute"],[class*="fixed"],[style*="position"]'));
    for (const el of candidates) {
      if (el === input || el.contains(input)) continue;
      if (!following(input, el)) continue;
      if (!isFloating(el) || !visible(el)) continue;
      if (!closeUnder(input, el)) continue;
      const items = itemsIn(el);
      if (items.length === 0) continue;
      return items;
    }
  }
  // 2. the input is inside the floating panel: the entries after the input
  node = input.parentElement;
  for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
    if (node === document.body) break;
    if (!isFloating(node) || !visible(node)) continue;
    // a full-screen layer (a modal) is not a dropdown
    const r = node.getBoundingClientRect();
    if (r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9) break;
    const items = itemsIn(node).filter(el => !el.contains(input) && following(input, el));
    if (items.length > 0) return items;
  }
  return null;
}

function clearHighlight() {
  if (state) state.items.forEach(el => el.removeAttribute(ACTIVE_ATTR));
  state = null;
}

function paint() {
  if (!state) return;
  state.items.forEach((el, i) => {
    if (i === state!.index) el.setAttribute(ACTIVE_ATTR, 'true');
    else el.removeAttribute(ACTIVE_ATTR);
  });
  state.items[state.index]?.scrollIntoView({ block: 'nearest' });
}

function press(el: HTMLElement) {
  const opts = { bubbles: true, cancelable: true, view: window };
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.click();
}

/** Arrow keys: run after the page's own handlers, so boxes that handle arrows keep their own behaviour. */
function onKeyDownBubble(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const input = e.target;
  if (!isTextInput(input)) return;

  const sameList = state && state.input === input && state.items.every(el => el.isConnected);
  if (!sameList) {
    const items = findItems(input);
    if (!items) { clearHighlight(); return; }
    clearHighlight();
    state = { input, items, index: -1 };
  }
  const s = state!;
  e.preventDefault();
  if (e.key === 'ArrowDown') s.index = Math.min(s.items.length - 1, s.index + 1);
  else s.index = s.index <= 0 ? -1 : s.index - 1;
  if (s.index === -1) { s.items.forEach(el => el.removeAttribute(ACTIVE_ATTR)); return; }
  paint();
}

/** Enter / Esc on a highlighted entry: run before the page's handlers, so the highlighted entry wins. */
function onKeyDownCapture(e: KeyboardEvent) {
  if (!state || e.target !== state.input || state.index < 0) return;
  if (e.key === 'Enter') {
    const el = state.items[state.index];
    if (!el || !el.isConnected) { clearHighlight(); return; }
    e.preventDefault();
    e.stopPropagation();
    clearHighlight();
    press(el);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    clearHighlight();
  }
}

function onInput(e: Event) {
  if (state && e.target === state.input) clearHighlight();
}

function onFocusOut(e: FocusEvent) {
  if (state && e.target === state.input) clearHighlight();
}

export function installDropdownKeys(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `[${ACTIVE_ATTR}]{background-color:#e0e7ff !important;outline:2px solid #4f46e5;outline-offset:-2px;}`;
    document.head.appendChild(style);
  }
  window.addEventListener('keydown', onKeyDownCapture, true);
  window.addEventListener('keydown', onKeyDownBubble, false);
  window.addEventListener('input', onInput, true);
  window.addEventListener('focusout', onFocusOut, true);
  return () => {
    window.removeEventListener('keydown', onKeyDownCapture, true);
    window.removeEventListener('keydown', onKeyDownBubble, false);
    window.removeEventListener('input', onInput, true);
    window.removeEventListener('focusout', onFocusOut, true);
    clearHighlight();
  };
}
