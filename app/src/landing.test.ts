import { describe, expect, it } from 'vitest';
import { frameAfterLanding, landingFrame } from './landing';

/** M41: a spot built from nothing grows scene after scene; overlays always land on a scene. */
const scenes = [
  { startFrame: 0, endFrame: 120, enabled: true },
  { startFrame: 120, endFrame: 270, enabled: true },
  { startFrame: 270, endFrame: 400, enabled: false },
];

describe('landingFrame', () => {
  it('puts anything at 0 in an empty spot', () => {
    expect(landingFrame('headline', [], 500)).toBe(0);
    expect(landingFrame('lower-third', [], 500)).toBe(0);
  });

  it('lands a scene at the playhead, never past the end of the last enabled scene', () => {
    expect(landingFrame('background', scenes, 60)).toBe(60);
    expect(landingFrame('end-card', scenes, 270)).toBe(270);
    expect(landingFrame('end-card', scenes, 900)).toBe(270);
    expect(landingFrame('open', scenes, -5)).toBe(0);
  });

  it('lands an overlay at the playhead, and past the end on the start of the last scene', () => {
    expect(landingFrame('lower-third', scenes, 60)).toBe(60);
    expect(landingFrame('caption', scenes, 269)).toBe(269);
    expect(landingFrame('caption', scenes, 270)).toBe(120);
    expect(landingFrame('disclaimer', scenes, 900)).toBe(120);
  });
});

describe('frameAfterLanding', () => {
  it('moves the playhead on after a scene and leaves it on the scene after an overlay', () => {
    expect(frameAfterLanding('headline', { startFrame: 120, endFrame: 240 }, 150)).toBe(240);
    expect(frameAfterLanding('lower-third', { startFrame: 120, endFrame: 240 }, 150)).toBe(150);
  });
});
