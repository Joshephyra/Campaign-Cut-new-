import { isSceneType } from './elementTypes';

/**
 * M51: the shape of a political spot. An opening, proof points (three or
 * four in a :30, fewer in a :15) and an end card are the scenes; lower
 * thirds, captions, callouts, bars and disclaimers are parts of those
 * scenes, not scenes of their own. This reads that structure off the
 * elements as they stand: the scenes in play order, each named for its
 * place, each with the overlays that sit on it.
 */
export type StructureElement = { id: number; type: string; startFrame: number; endFrame: number; enabled: boolean };

export type StructureGroup<E extends StructureElement> = {
  scene: E;
  /** "Opening", "Proof point 2", "End card". */
  label: string;
  /** The overlays that start on this scene, in play order. */
  overlays: E[];
};

export type Structure<E extends StructureElement> = {
  groups: StructureGroup<E>[];
  /** Overlays with no scene to sit on (a spot with no scenes yet). */
  stray: E[];
};

export function structureOf<E extends StructureElement>(elements: E[]): Structure<E> {
  const live = elements.filter((e) => e.enabled);
  const scenes = live.filter((e) => isSceneType(e.type)).sort((a, b) => a.startFrame - b.startFrame || a.id - b.id);
  const overlays = live.filter((e) => !isSceneType(e.type)).sort((a, b) => a.startFrame - b.startFrame || a.id - b.id);
  let proof = 0;
  const groups: StructureGroup<E>[] = scenes.map((scene, i) => {
    const last = i === scenes.length - 1;
    const label = i === 0 ? 'Opening' : last && scene.type === 'end-card' ? 'End card' : `Proof point ${++proof}`;
    return { scene, label, overlays: [] };
  });
  const stray: E[] = [];
  for (const o of overlays) {
    // the scene under the overlay's start; past the last scene's start, the last scene; before the first, the first
    let at = -1;
    for (let i = 0; i < scenes.length; i++) if (scenes[i]!.startFrame <= o.startFrame) at = i;
    if (at < 0 && scenes.length > 0) at = 0;
    if (at < 0) stray.push(o);
    else groups[at]!.overlays.push(o);
  }
  return { groups, stray };
}

/** How many proof points a spot of this length usually carries: the words the picker and the gauge use. */
export function proofPointsFor(lengthS: number): string {
  if (lengthS >= 60) return 'six to eight proof points';
  if (lengthS >= 30) return 'three or four proof points';
  if (lengthS >= 15) return 'one or two proof points';
  return 'one proof point';
}
