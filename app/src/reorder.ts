import { isSceneType } from '@campaigncut/composition';

type Placed = { id: number; type: string; startFrame: number; endFrame: number; enabled: boolean };

/**
 * M43: move one scene before or after another in the play order. The
 * scenes (open, headline, stat, background, end card) are re-laid in the
 * new order, each keeping its length, and the gaps between consecutive
 * scenes keep their places (a template's pacing survives; a spot built
 * end to end stays end to end). Overlays stay where they are: they sit on
 * whatever scene is under them. Returns the frames that change, by id.
 */
export function reorderScenes(elements: Placed[], movedId: number, targetId: number, place: 'before' | 'after'): Map<number, { startFrame: number; endFrame: number }> {
  const patches = new Map<number, { startFrame: number; endFrame: number }>();
  if (movedId === targetId) return patches;
  const scenes = elements.filter((e) => e.enabled && isSceneType(e.type)).sort((a, b) => a.startFrame - b.startFrame || a.id - b.id);
  const moved = scenes.find((e) => e.id === movedId);
  const target = scenes.find((e) => e.id === targetId);
  if (!moved || !target) return patches;

  // the pacing: where the first scene starts, and the gap before each later position
  const first = scenes[0]!.startFrame;
  const gaps = scenes.slice(1).map((e, i) => e.startFrame - scenes[i]!.endFrame);

  const order = scenes.filter((e) => e.id !== movedId);
  const at = order.findIndex((e) => e.id === targetId) + (place === 'after' ? 1 : 0);
  order.splice(at, 0, moved);

  let cursor = first;
  order.forEach((e, i) => {
    const start = Math.max(0, cursor + (i === 0 ? 0 : gaps[i - 1]!));
    const end = start + (e.endFrame - e.startFrame);
    if (start !== e.startFrame || end !== e.endFrame) patches.set(e.id, { startFrame: start, endFrame: end });
    cursor = end;
  });
  return patches;
}

/**
 * M44: put an overlay on a scene. The overlay keeps its length and starts
 * where the scene starts; nothing else moves. Nothing happens for a scene,
 * a hidden element, or a target that is not a scene.
 */
export function moveOverlayToScene(elements: Placed[], overlayId: number, sceneId: number): Map<number, { startFrame: number; endFrame: number }> {
  const patches = new Map<number, { startFrame: number; endFrame: number }>();
  const overlay = elements.find((e) => e.id === overlayId && e.enabled && !isSceneType(e.type));
  const scene = elements.find((e) => e.id === sceneId && e.enabled && isSceneType(e.type));
  if (!overlay || !scene || overlay.startFrame === scene.startFrame) return patches;
  patches.set(overlay.id, { startFrame: scene.startFrame, endFrame: scene.startFrame + (overlay.endFrame - overlay.startFrame) });
  return patches;
}
