import { isSceneType } from '@campaigncut/composition';

type Placed = { startFrame: number; endFrame: number; enabled: boolean };

/**
 * M41: where a library element lands when added, given the playhead.
 * A scene (open, headline, stat, background, end card) lands at the
 * playhead, never past the end of the last scene, so a spot built from
 * nothing grows one scene after another. An overlay (lower third, caption,
 * callout, bar, disclaimer) lands at the playhead too, but never past the
 * end: past it, on the start of the last scene, so it always overlays
 * something. An empty spot puts everything at 0.
 */
export function landingFrame(type: string, elements: Placed[], playhead: number): number {
  const placed = elements.filter((e) => e.enabled);
  if (placed.length === 0) return 0;
  const end = Math.max(...placed.map((e) => e.endFrame));
  const at = Math.max(0, Math.round(playhead));
  if (isSceneType(type)) return Math.min(at, end);
  if (at < end) return at;
  const last = placed.reduce((a, b) => (b.startFrame >= a.startFrame ? b : a));
  return last.startFrame;
}

/**
 * Where the playhead goes once an element has landed: a scene moves it on
 * to its own end, so the next add follows; an overlay leaves it on the
 * scene, at the overlay's hold frame.
 */
export function frameAfterLanding(type: string, element: { startFrame: number; endFrame: number }, holdFrame: number): number {
  return isSceneType(type) ? element.endFrame : holdFrame;
}
