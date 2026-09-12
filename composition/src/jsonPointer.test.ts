import { describe, expect, it } from 'vitest';
import { resolvePointer } from './jsonPointer';

describe('resolvePointer (RFC 6901)', () => {
  const doc = { a: { b: [10, { c: 'deep' }] }, 'x/y': 1, 'm~n': 2 };

  it('walks objects and arrays', () => {
    expect(resolvePointer(doc, '/a/b/0')).toBe(10);
    expect(resolvePointer(doc, '/a/b/1/c')).toBe('deep');
  });

  it('returns the document for the empty pointer', () => {
    expect(resolvePointer(doc, '')).toBe(doc);
  });

  it('returns undefined for a missing path instead of throwing', () => {
    expect(resolvePointer(doc, '/a/zzz/0')).toBeUndefined();
    expect(resolvePointer(doc, '/a/b/9')).toBeUndefined();
  });

  it('unescapes ~1 as / and ~0 as ~', () => {
    expect(resolvePointer(doc, '/x~1y')).toBe(1);
    expect(resolvePointer(doc, '/m~0n')).toBe(2);
  });
});
