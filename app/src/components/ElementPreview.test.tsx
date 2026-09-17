import type { TemplateParam } from '@campaigncut/composition';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M37: a still of one element at a chosen frame, with values applied:
 * the composer's copy in the library picker, the scene's own values on
 * the scene chips. lottie-web draws it once into a box; no Player.
 */
const loadAnimation = vi.fn();
const goToAndStop = vi.fn();
const destroy = vi.fn();
vi.mock('lottie-web', () => ({ default: { loadAnimation: (...args: unknown[]) => loadAnimation(...args) } }));

const lottie = { fr: 30, ip: 0, op: 90, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'AUTHORED', f: 'X', s: 10 }, t: 0 }] } } }] };
const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'AUTHORED', path: '/layers/0' },
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#FF0000', path: '/layers/1' },
];

beforeEach(() => {
  loadAnimation.mockReset().mockReturnValue({ goToAndStop, destroy });
  goToAndStop.mockReset();
  destroy.mockReset();
});
afterEach(cleanup);

describe('ElementPreview', () => {
  it('draws the element once at the frame, with the given values applied, and tears down on unmount', async () => {
    const { ElementPreview } = await import('./ElementPreview');
    const { unmount } = render(<ElementPreview lottie={lottie} schema={schema} values={{ headline: 'YOUR COPY' }} frame={30} />);
    expect(loadAnimation).toHaveBeenCalledTimes(1);
    const args = loadAnimation.mock.calls[0]![0] as { renderer: string; autoplay: boolean; loop: boolean; animationData: { layers: { t: { d: { k: { s: { t: string } }[] } } }[] } };
    expect(args.renderer).toBe('svg');
    expect(args.autoplay).toBe(false);
    expect(args.animationData.layers[0]!.t.d.k[0]!.s.t).toBe('YOUR COPY');
    expect(goToAndStop).toHaveBeenCalledWith(30, true);
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('puts the composer copy into the first text role only, when asked to preview copy', async () => {
    const { previewValues } = await import('./ElementPreview');
    const two: TemplateParam[] = [
      { key: 'subhead', role: 'subhead', kind: 'text', label: 'Subhead', default: 'B', path: '/layers/0' },
      { key: 'body', role: 'body', kind: 'text', label: 'Body', default: 'C', path: '/layers/1' },
      { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'D', path: '/layers/2', locked: true },
    ];
    expect(previewValues(two, 'Hello')).toEqual({ subhead: 'Hello' });
    expect(previewValues([two[2]!], 'Hello')).toEqual({}); // a disclaimer keeps its wording
    expect(previewValues(two, '')).toEqual({});
  });
});
