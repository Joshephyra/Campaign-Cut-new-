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
 * The element a transition after `current` leads into: the next one in start
 * order that actually follows it (starts at or after its end). An element
 * that overlaps it, a lower third sitting over an open, is not a successor
 * and keeps its own timing (M31).
 */
export function successorOf<T extends { id: string; startFrame: number; endFrame: number }>(current: T, inOrder: T[], taken: Set<string>): T | undefined {
  return inOrder.find((e) => !taken.has(e.id) && e.id !== current.id && e.startFrame >= current.endFrame);
}

/**
 * Turn free-placed elements plus per-boundary transitions into chains.
 *
 * Elements are taken in start order. An element joined to its successor by
 * a non-cut transition forms a chain: inside a chain the next element
 * begins where the previous one ends, minus the transition overlap (its own
 * in point is ignored). Elements not joined stand alone with their own
 * in/out points, and so does anything that overlaps a chained element.
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
  const taken = new Set<string>();

  for (const first of visible) {
    if (taken.has(first.id)) continue;
    taken.add(first.id);
    const chain: Chain = { startFrame: first.startFrame, durationInFrames: 0, elementIds: [first.id], transitions: [] };
    let cursor = first.startFrame;
    let current = first;
    effective.push({ id: current.id, startFrame: cursor, endFrame: cursor + (current.endFrame - current.startFrame) });
    cursor += current.endFrame - current.startFrame;

    for (;;) {
      const t = transitions.find((x) => x.afterElementId === current.id && x.preset !== 'cut' && x.durationInFrames > 0);
      if (!t) break;
      const next = successorOf(current, visible, taken);
      if (!next) break;
      const durA = current.endFrame - current.startFrame;
      const durB = next.endFrame - next.startFrame;
      const d = Math.max(1, Math.min(Math.round(t.durationInFrames), durA - 1, durB - 1));
      chain.transitions.push({ ...t, durationInFrames: d });
      chain.elementIds.push(next.id);
      taken.add(next.id);
      cursor -= d;
      effective.push({ id: next.id, startFrame: cursor, endFrame: cursor + durB });
      cursor += durB;
      current = next;
    }

    chain.durationInFrames = cursor - chain.startFrame;
    chains.push(chain);
  }

  return { chains, elements: effective };
}

/** The composition lasts until the latest chain ends. Never less than one frame. */
/**
 * M52: how long the spot plays. A spot has a fixed length (:06, :15, :30,
 * :60); it plays exactly that long in both runners, whatever the content
 * does (the readiness list says when the content does not fit). Without a
 * length, the content's own end.
 */
export function spotDurationFrames(elements: ElementProps[], transitions: TransitionProps[], lengthFrames?: number | null): number {
  if (lengthFrames && lengthFrames > 0) return Math.round(lengthFrames);
  return compositionDurationWithTransitions(elements, transitions);
}

export function compositionDurationWithTransitions(elements: ElementProps[], transitions: TransitionProps[]): number {
  const { chains } = effectiveTimeline(elements, transitions);
  let end = 0;
  for (const c of chains) end = Math.max(end, c.startFrame + c.durationInFrames);
  return Math.max(1, Math.round(end));
}
