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

/** M33: the colour roles a client's brand can set are the colour roles the tag vocabulary knows. Keep the two lists the same. */
describe('COLOR_ROLES matches the role table', () => {
  it('lists every colour role with its label', async () => {
    const { COLOR_ROLES } = await import('@campaigncut/composition');
    const { ROLES } = await import('./roles');
    const fromRoles = Object.entries(ROLES)
      .filter(([, spec]) => spec.kind === 'color')
      .map(([role, spec]) => ({ role, label: spec.label }));
    expect(COLOR_ROLES).toEqual(fromRoles);
  });
});

/** M60: a plate or an underline that follows a text. */
describe('parseTag: followers (M60)', () => {
  it('reads the text it follows and what it is to it', () => {
    expect(parseTag('cc.headline.1.plate')).toEqual({ tag: 'cc.headline.1.plate', role: 'headline', index: 1, follows: 'plate' });
    expect(parseTag('cc.headline.underline')).toEqual({ tag: 'cc.headline.underline', role: 'headline', index: undefined, follows: 'underline' });
    expect(parseTag('cc.stat.2.plate')).toEqual({ tag: 'cc.stat.2.plate', role: 'stat', index: 2, follows: 'plate' });
    expect(parseTag('cc.headline.Plate')).toEqual({ tag: 'cc.headline.Plate', role: 'headline.Plate', index: undefined });
  });
});
