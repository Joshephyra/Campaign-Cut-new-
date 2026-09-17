/**
 * M36: aspect-ratio versions. 16:9 is the master; a spot is versioned into
 * 1:1, 4:5 and 9:16. The frame follows the spot's aspect in both runners;
 * positions stay fractions of the frame.
 */
export const ASPECTS = ['16:9', '1:1', '4:5', '9:16'] as const;
export type Aspect = (typeof ASPECTS)[number];

export type Frame = { width: number; height: number };

const FRAMES: Record<Aspect, Frame> = {
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
};

export function isAspect(v: unknown): v is Aspect {
  return typeof v === 'string' && (ASPECTS as readonly string[]).includes(v);
}

export function frameFor(aspect: Aspect): Frame {
  return { ...FRAMES[aspect] };
}

/** M57: the aspect a frame size is, exactly, or null: a template authored at 1080x1080 is a 1:1 template. */
export function aspectOfFrame(width: number, height: number): Aspect | null {
  for (const a of ASPECTS) if (FRAMES[a].width === width && FRAMES[a].height === height) return a;
  return null;
}

/** "9:16" -> "9x16": the folder name a designer variant lives under. */
export function aspectKey(aspect: Aspect): string {
  return aspect.replace(':', 'x');
}

export type AutoFitBox = { left: number; top: number; width: number; height: number; scale: number };

/**
 * Where an element authored at one frame size sits in another: contained
 * and centred, in pixels of the target frame. The identity when the sizes
 * match, so a 16:9 element in a 16:9 spot costs nothing.
 */
export function autoFitBox(authored: Frame, frame: Frame): AutoFitBox {
  const scale = Math.min(frame.width / authored.width, frame.height / authored.height);
  const width = authored.width * scale;
  const height = authored.height * scale;
  return { left: (frame.width - width) / 2, top: (frame.height - height) / 2, width, height, scale };
}

/** A footage slot that filled the authored frame keeps filling the new one. */
export function isFullBleed(rect: { x: number; y: number; w: number; h: number }): boolean {
  return rect.w >= 0.9 && rect.h >= 0.9;
}
