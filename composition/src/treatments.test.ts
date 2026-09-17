import { describe, expect, it } from 'vitest';
import type { TemplateParam } from './schema';
import { DEFAULT_ACCENT, isTreatment, TREATMENT_LABELS, TREATMENTS, treatmentFor, treatmentLayerFilter } from './treatments';

/** M39: style treatments over the whole spot, the same in both runners. */
const accent: TemplateParam = { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#F05929', path: '/layers/0' };
const surface: TemplateParam = { key: 'surface', role: 'surface', kind: 'color', label: 'Surface colour', default: '#0F1729', path: '/layers/1' };
const headline: TemplateParam = { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'X', path: '/layers/2' };

describe('treatments (M39)', () => {
  it('names the four treatments with labels, and knows an unknown one', () => {
    expect(TREATMENTS).toEqual(['clean', 'grit', 'glow', 'opaque']);
    expect(TREATMENTS.map((t) => TREATMENT_LABELS[t])).toEqual(['Clean', 'Grit', 'Glow', 'Opaque']);
    expect(isTreatment('glow')).toBe(true);
    expect(isTreatment('bubbly')).toBe(false);
    expect(isTreatment(undefined)).toBe(false);
  });

  it('is nothing for clean or an unknown name, so the composition draws the design as authored', () => {
    expect(treatmentFor('clean', [])).toBeUndefined();
    expect(treatmentFor(undefined, [])).toBeUndefined();
    expect(treatmentFor('bubbly', [])).toBeUndefined();
  });

  it('glows in the first accent colour the spot sets, the authored one when unset, the campaign blue when there is none', () => {
    expect(treatmentFor('glow', [{ schema: [surface, headline], values: {} }, { schema: [accent], values: { accent: '#00ff00' } }])).toEqual({ name: 'glow', accent: '#00FF00' });
    expect(treatmentFor('glow', [{ schema: [accent], values: {} }])).toEqual({ name: 'glow', accent: '#F05929' });
    expect(treatmentFor('glow', [{ schema: [headline], values: {} }])).toEqual({ name: 'glow', accent: DEFAULT_ACCENT });
    expect(treatmentFor('grit', [{ schema: [accent], values: {} }])).toEqual({ name: 'grit' });
  });

  it('puts a filter on the design for grit and glow, none for opaque (its plate is an SVG filter on text)', () => {
    expect(treatmentLayerFilter(undefined)).toBeUndefined();
    expect(treatmentLayerFilter({ name: 'grit' })).toBe('contrast(1.12)');
    expect(treatmentLayerFilter({ name: 'glow', accent: '#00FF00' })).toBe('drop-shadow(0 0 8px #00FF00) drop-shadow(0 0 18px #00FF00)');
    expect(treatmentLayerFilter({ name: 'opaque' })).toBeUndefined();
  });
});
