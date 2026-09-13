import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, COALESCE_MS, createHistory, isTextEntry, MAX_STEPS, pushHistory, redoHistory, undoHistory, undoRedoFor } from './history';

describe('history (M23)', () => {
  it('pushes, undoes and redoes', () => {
    let h = createHistory('a');
    expect(canUndo(h)).toBe(false);
    h = pushHistory(h, 'b', 'headline', 0);
    h = pushHistory(h, 'c', 'accent', 5000);
    expect(h.present).toBe('c');
    expect(canUndo(h)).toBe(true);
    h = undoHistory(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
    h = undoHistory(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = undoHistory(h); // nothing to undo: unchanged
    expect(h.present).toBe('a');
    h = redoHistory(h);
    h = redoHistory(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('a new push after undo clears the redo steps', () => {
    let h = pushHistory(createHistory('a'), 'b', null, 0);
    h = undoHistory(h);
    h = pushHistory(h, 'x', null, 5000);
    expect(canRedo(h)).toBe(false);
    expect(undoHistory(h).present).toBe('a');
  });

  it('coalesces fast changes to the same key into one step, but not across keys or after the window', () => {
    let h = createHistory('');
    h = pushHistory(h, 'V', 'headline', 0);
    h = pushHistory(h, 'VO', 'headline', 100);
    h = pushHistory(h, 'VOT', 'headline', 200);
    h = pushHistory(h, 'VOTE', 'headline', 300);
    expect(h.past).toEqual(['']);
    h = pushHistory(h, 'VOTE!', 'headline', 300 + COALESCE_MS + 1);
    expect(h.past).toEqual(['', 'VOTE']);
    h = pushHistory(h, 'VOTE!?', 'accent', 300 + COALESCE_MS + 2);
    expect(h.past).toEqual(['', 'VOTE', 'VOTE!']);
    expect(undoHistory(h).present).toBe('VOTE!');
  });

  it('ignores a push of the same value and caps the steps kept', () => {
    let h = createHistory(0);
    h = pushHistory(h, 0, null, 0);
    expect(h.past).toEqual([]);
    for (let i = 1; i <= MAX_STEPS + 20; i++) h = pushHistory(h, i, null, i * 10_000);
    expect(h.past).toHaveLength(MAX_STEPS);
    expect(h.past[0]).toBe(20);
  });

  it('maps keyboard shortcuts', () => {
    expect(undoRedoFor({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false })).toBe('undo');
    expect(undoRedoFor({ key: 'Z', ctrlKey: true, metaKey: false, shiftKey: true })).toBe('redo');
    expect(undoRedoFor({ key: 'y', ctrlKey: true, metaKey: false, shiftKey: false })).toBe('redo');
    expect(undoRedoFor({ key: 'z', ctrlKey: false, metaKey: true, shiftKey: false })).toBe('undo');
    expect(undoRedoFor({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
    expect(undoRedoFor({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
  });

  it('leaves text fields to the browser', () => {
    const text = document.createElement('input');
    text.type = 'text';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const area = document.createElement('textarea');
    const button = document.createElement('button');
    expect(isTextEntry(text)).toBe(true);
    expect(isTextEntry(area)).toBe(true);
    expect(isTextEntry(checkbox)).toBe(false);
    expect(isTextEntry(button)).toBe(false);
    expect(isTextEntry(document.body)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
