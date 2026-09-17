import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES, isSceneType, SCENE_TYPES } from './elementTypes';

/** M31 typed the library; tools/ingest tests cover inference. */
describe('scene types against overlays (M41)', () => {
  it('names the types that fill the frame and follow one another; the rest sit on a scene', () => {
    expect(SCENE_TYPES).toEqual(['open', 'headline', 'stat', 'background', 'end-card']);
    expect(ELEMENT_TYPES.filter((t) => !isSceneType(t))).toEqual(['lower-third', 'caption', 'callout', 'overlay', 'disclaimer']);
    expect(isSceneType('unknown')).toBe(false);
  });
});
