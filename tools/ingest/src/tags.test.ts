import { describe, expect, it } from 'vitest';
import { parseTag } from './tags';

describe('parseTag', () => {
  it('returns null for an untagged layer', () => {
    expect(parseTag('Shape Layer 14')).toBeNull();
    expect(parseTag('bg-sweep-2')).toBeNull();
    expect(parseTag('cc-headline')).toBeNull();
    expect(parseTag('CC.headline')).toBeNull();
  });

  it('parses a single slot', () => {
    expect(parseTag('cc.headline')).toEqual({ tag: 'cc.headline', role: 'headline', index: undefined });
  });

  it('parses a repeated slot with a 1-based index', () => {
    expect(parseTag('cc.stat.2')).toEqual({ tag: 'cc.stat.2', role: 'stat', index: 2 });
  });

  it('keeps dotted roles that are not numeric indexes', () => {
    expect(parseTag('cc.safe.disclaimer')).toEqual({ tag: 'cc.safe.disclaimer', role: 'safe.disclaimer', index: undefined });
  });

  it('trims surrounding whitespace but is otherwise exact', () => {
    expect(parseTag('  cc.accent ')).toEqual({ tag: 'cc.accent', role: 'accent', index: undefined });
    expect(parseTag('cc.Accent')).toEqual({ tag: 'cc.Accent', role: 'Accent', index: undefined });
  });
});
