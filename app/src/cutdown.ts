import { isSceneType } from '@campaigncut/composition';

type Placed = { id: number; type: string; startFrame: number; endFrame: number; enabled: boolean };

/**
 * M52: make a longer spot fit a shorter length. Proof points come out from
 * the end, one at a time (never the opening, never a closing end card),
 * each with the overlays that sit on it, and what follows moves back to
 * close the gap, until the content fits. Returns the ids to hide and the
 * frames that change; hidden, not removed, so undo and Show bring them
 * back. `left` is how many seconds still run over when nothing more can go.
 */
export function cutDownToFit(elements: Placed[], targetFrames: number): { hide: number[]; patches: Map<number, { startFrame: number; endFrame: number }>; left: number } {
  const live = elements.filter((e) => e.enabled);
  let scenes = live.filter((e) => isSceneType(e.type)).sort((a, b) => a.startFrame - b.startFrame || a.id - b.id);
  const frames = new Map(live.map((e) => [e.id, { startFrame: e.startFrame, endFrame: e.endFrame }] as const));
  const hide: number[] = [];
  const content = () => Math.max(0, ...[...frames.values()].map((f) => f.endFrame));
  while (content() > targetFrames) {
    const last = scenes[scenes.length - 1];
    const closing = last && last.type === 'end-card';
    const candidates = scenes.slice(1, closing ? -1 : undefined);
    const gone = candidates[candidates.length - 1];
    if (!gone) break;
    const g = frames.get(gone.id)!;
    const length = g.endFrame - g.startFrame;
    hide.push(gone.id);
    frames.delete(gone.id);
    // the overlays on it go with it; everything after it moves back
    for (const e of live) {
      const f = frames.get(e.id);
      if (!f || e.id === gone.id) continue;
      if (!isSceneType(e.type) && f.startFrame >= g.startFrame && f.startFrame < g.endFrame) {
        hide.push(e.id);
        frames.delete(e.id);
      } else if (f.startFrame >= g.endFrame) {
        frames.set(e.id, { startFrame: f.startFrame - length, endFrame: f.endFrame - length });
      }
    }
    scenes = scenes.filter((s) => s.id !== gone.id);
  }
  const patches = new Map<number, { startFrame: number; endFrame: number }>();
  for (const e of live) {
    const f = frames.get(e.id);
    if (f && (f.startFrame !== e.startFrame || f.endFrame !== e.endFrame)) patches.set(e.id, f);
  }
  const left = Math.max(0, content() - targetFrames);
  return { hide, patches, left };
}
