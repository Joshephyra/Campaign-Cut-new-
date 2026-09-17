import { isSceneType } from '@campaigncut/composition';

type Placed = { startFrame: number; endFrame: number; enabled: boolean };

/**
 * M41: where a library element lands when added, given the playhead.
 * A scene (open, headline, stat, background, end card) lands at the
 * playhead, never past the end of the last scene, so a spot built from
 * nothing grows one scene after another. An overlay (lower third, caption,
 * callout, bar, disclaimer) lands at the playhead, pulled back so it ends
 * no later than the last scene does when it can fit on the scene under the
 * playhead; past the end, it lands on the last scene. So an overlay always
 * sits on something and, where it can, never runs on over nothing. An
 * empty spot puts everything at 0.
 */
export function landingFrame(type: string, elements: Placed[], playhead: number, length = 0): number {
  const placed = elements.filter((e) => e.enabled);
  if (placed.length === 0) return 0;
  const end = Math.max(...placed.map((e) => e.endFrame));
  const at = Math.max(0, Math.round(playhead));
  if (isSceneType(type)) return Math.min(at, end);
  const last = placed.reduce((a, b) => (b.startFrame >= a.startFrame ? b : a));
  const from = at < end ? at : last.startFrame;
  const covering = placed.filter((e) => e.startFrame <= from && from < e.endFrame);
  const under = covering.length > 0 ? covering.reduce((a, b) => (b.startFrame >= a.startFrame ? b : a)) : last;
  // Pull back only when the overlay can fit on the scene under the playhead; when it is longer than
  // that scene it stays where it was put, and the person shortens it or lengthens the scene.
  const fit = end - Math.max(0, Math.round(length));
  return fit >= under.startFrame ? Math.min(from, fit) : from;
}

/**
 * Where the playhead goes once an element has landed: a scene moves it on
 * to its own end, so the next add follows; an overlay leaves it on the
 * scene, at the overlay's hold frame.
 */
export function frameAfterLanding(type: string, element: { startFrame: number; endFrame: number }, holdFrame: number): number {
  return isSceneType(type) ? element.endFrame : holdFrame;
}
