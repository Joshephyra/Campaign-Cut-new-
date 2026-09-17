import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES, inferElementType, isElementType } from './elementTypes';

/**
 * M31: every element has a type so the library can say "add a lower third"
 * rather than "add element 02". The designer names it in elements.json; when
 * they do not, the slug usually says.
 */
describe('element types', () => {
  it('is a fixed list', () => {
    expect(ELEMENT_TYPES).toEqual(['open', 'headline', 'lower-third', 'caption', 'callout', 'overlay', 'stat', 'background', 'end-card', 'disclaimer']);
    expect(isElementType('caption')).toBe(true);
    expect(isElementType('Caption')).toBe(false);
    expect(isElementType('banner')).toBe(false);
  });

  it('infers a type from the slug, and falls back to overlay', () => {
    expect(inferElementType('open')).toBe('open');
    expect(inferElementType('01-open')).toBe('open');
    expect(inferElementType('lower-third')).toBe('lower-third');
    expect(inferElementType('lower-third-2')).toBe('lower-third');
    expect(inferElementType('l3-name')).toBe('lower-third');
    expect(inferElementType('stat-callout')).toBe('stat');
    expect(inferElementType('callout-arrow')).toBe('callout');
    expect(inferElementType('end-card')).toBe('end-card');
    expect(inferElementType('endcard')).toBe('end-card');
    expect(inferElementType('disclaimer')).toBe('disclaimer');
    expect(inferElementType('paid-for-by')).toBe('disclaimer');
    expect(inferElementType('caption-quote')).toBe('caption');
    expect(inferElementType('headline-big')).toBe('headline');
    expect(inferElementType('bg-gradient')).toBe('background');
    expect(inferElementType('background')).toBe('background');
    expect(inferElementType('sparkle')).toBe('overlay');
  });
});
