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

  it('pulls an overlay back so it ends with the last scene, but never before the scene under the playhead starts (M42)', () => {
    // 150 frames long from 200 would run to 350, past the end at 270: pulled back to 120
    expect(landingFrame('lower-third', scenes, 200, 150)).toBe(120);
    // 60 long from 250 would end at 310: pulled back to 210, still on the second scene
    expect(landingFrame('caption', scenes, 250, 60)).toBe(210);
    // longer than what is under the playhead: stays where it was put
    expect(landingFrame('caption', scenes, 200, 400)).toBe(200);
    // fits as it is: unchanged
    expect(landingFrame('caption', scenes, 60, 30)).toBe(60);
  });
});

describe('frameAfterLanding', () => {
  it('moves the playhead on after a scene and leaves it on the scene after an overlay', () => {
    expect(frameAfterLanding('stat', { startFrame: 120, endFrame: 240 }, 150)).toBe(240);
    expect(frameAfterLanding('lower-third', { startFrame: 120, endFrame: 240 }, 150)).toBe(150);
  });
});
