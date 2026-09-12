import type { ElementProps } from './elements';

/** The small preset list from MILESTONES M10. Transitions are not authored in After Effects. */
export const TRANSITION_PRESETS = ['cut', 'fade', 'wipe', 'slide'] as const;
export type TransitionPreset = (typeof TRANSITION_PRESETS)[number];

/** A transition stored per element boundary: it plays as the named element ends. */
export type TransitionProps = {
  afterElementId: string;
  preset: TransitionPreset;
  durationInFrames: number;
};

/** Default transition length: half a second at 30 fps. */
export const DEFAULT_TRANSITION_FRAMES = 15;

export type Chain = {
  startFrame: number;
  durationInFrames: number;
  elementIds: string[];
  /** transitions[i] plays between elementIds[i] and elementIds[i + 1]. */
  transitions: TransitionProps[];
};

export type EffectiveElement = { id: string; startFrame: number; endFrame: number };

/**
 * Turn free-placed elements plus per-boundary transitions into chains.
 *
 * Elements are taken in start order. Two neighbours joined by a non-cut
 * transition form a chain: inside a chain the next element begins where the
 * previous one ends, minus the transition overlap (its own in point is
 * ignored). Elements not joined stand alone with their own in/out points.
 * A transition is capped below the shorter neighbour so both still show.
 */
export function effectiveTimeline(
  elements: ElementProps[],
  transitions: TransitionProps[],
): { chains: Chain[]; elements: EffectiveElement[] } {
  const visible = elements
    .filter((e) => e.enabled && e.endFrame > e.startFrame)
    .sort((a, b) => a.startFrame - b.startFrame || a.zIndex - b.zIndex);

  const chains: Chain[] = [];
  const effective: EffectiveElement[] = [];

  let i = 0;
  while (i < visible.length) {
    const first = visible[i]!;
    const chain: Chain = { startFrame: first.startFrame, durationInFrames: 0, elementIds: [first.id], transitions: [] };
    let cursor = first.startFrame;
    let current = first;
    effective.push({ id: current.id, startFrame: cursor, endFrame: cursor + (current.endFrame - current.startFrame) });
    cursor += current.endFrame - current.startFrame;

    while (i + 1 < visible.length) {
      const next = visible[i + 1]!;
      const t = transitions.find((x) => x.afterElementId === current.id && x.preset !== 'cut' && x.durationInFrames > 0);
      if (!t) break;
      const durA = current.endFrame - current.startFrame;
      const durB = next.endFrame - next.startFrame;
      const d = Math.max(1, Math.min(Math.round(t.durationInFrames), durA - 1, durB - 1));
      chain.transitions.push({ ...t, durationInFrames: d });
      chain.elementIds.push(next.id);
      cursor -= d;
      effective.push({ id: next.id, startFrame: cursor, endFrame: cursor + durB });
      cursor += durB;
      current = next;
      i++;
    }

    chain.durationInFrames = cursor - chain.startFrame;
    chains.push(chain);
    i++;
  }

  return { chains, elements: effective };
}

/** The composition lasts until the latest chain ends. Never less than one frame. */
export function compositionDurationWithTransitions(elements: ElementProps[], transitions: TransitionProps[]): number {
  const { chains } = effectiveTimeline(elements, transitions);
  let end = 0;
  for (const c of chains) end = Math.max(end, c.startFrame + c.durationInFrames);
  return Math.max(1, Math.round(end));
}
