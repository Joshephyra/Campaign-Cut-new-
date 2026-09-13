/**
 * M23: a pure undo history. `present` is what the editor shows; `past` and
 * `future` hold the steps behind and ahead. Fast successive pushes with the
 * same `key` (typing in one field, dragging one bar) coalesce into a single
 * step, so undo goes back a word, not a keystroke.
 */
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null;
  lastPushAt: number;
};

/** Changes to the same key within this window are one undo step. */
export const COALESCE_MS = 800;
/** Steps kept behind the present. */
export const MAX_STEPS = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastPushAt: -Infinity };
}

/**
 * Record a new present. `key` names the control that changed; `now` is the
 * clock (injected for tests). A push clears any redo steps.
 */
export function pushHistory<T>(h: History<T>, next: T, key: string | null, now: number): History<T> {
  if (Object.is(next, h.present)) return h;
  const coalesce = key !== null && key === h.lastKey && now - h.lastPushAt < COALESCE_MS;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-MAX_STEPS);
  return { past, present: next, future: [], lastKey: key, lastPushAt: now };
}

export function undoHistory<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1]!;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], lastKey: null, lastPushAt: -Infinity };
}

export function redoHistory<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next!, future: rest, lastKey: null, lastPushAt: -Infinity };
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;

/** True when a keyboard event happened inside something the browser edits itself (its own undo applies there). */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'file', 'color'].includes(target.type);
  }
  return target instanceof HTMLSelectElement;
}

/** Ctrl+Z / Cmd+Z undo; Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y redo. */
export function undoRedoFor(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): 'undo' | 'redo' | null {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return null;
  const k = e.key.toLowerCase();
  if (k === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (k === 'y') return 'redo';
  return null;
}
