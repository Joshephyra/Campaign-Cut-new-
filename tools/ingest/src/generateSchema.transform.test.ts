import { DEFAULT_TRANSFORM, type LottieAnimationData } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateSchema } from './generateSchema';

/**
 * M18: every text and image tag that is not locked gets a companion
 * `<key>.transform` param pointing at its LAYER, so the user can move,
 * scale and rotate it. Colours, footage slots and cc.safe.* get none.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const standin = JSON.parse(fs.readFileSync(path.resolve(here, '..', 'fixtures', 'standin', 'data.json'), 'utf8')) as LottieAnimationData;

describe('generateSchema: transform params', () => {
  const { params, report } = generateSchema(standin);

  it('adds a transform param right after each text and image param, keyed <key>.transform', () => {
    const keys = params.map((p) => p.key);
    expect(keys.indexOf('headline.transform')).toBe(keys.indexOf('headline') + 1);
    expect(keys.indexOf('logo.transform')).toBe(keys.indexOf('logo') + 1);
    const t = params.find((p) => p.key === 'headline.transform')!;
    expect(t).toMatchObject({ kind: 'transform', role: 'headline', for: 'headline', label: 'Headline placement', default: DEFAULT_TRANSFORM });
  });

  it('points the transform at the layer, even for an image whose own param points at the asset', () => {
    const logo = params.find((p) => p.key === 'logo')!;
    const t = params.find((p) => p.key === 'logo.transform')!;
    expect(logo.path).toMatch(/^\/assets\//);
    expect(t.path).toMatch(/^\/layers\/\d+$/);
    const layer = (standin.layers as { nm: string }[])[Number(t.path.split('/')[2])]!;
    expect(layer.nm).toBe('cc.logo');
  });

  it('gives none to locked, colour or footage tags', () => {
    const keys = params.map((p) => p.key);
    expect(keys).not.toContain('disclaimer.transform');
    expect(keys).not.toContain('accent.transform');
    expect(keys).not.toContain('surface.transform');
    expect(keys).not.toContain('mediaFill.transform');
  });

  it('does not add rows to the tag report', () => {
    expect(report.map((r) => r.layer)).not.toContain('headline.transform');
    expect(report).toHaveLength(6);
  });
});
