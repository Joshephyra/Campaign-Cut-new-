/**
 * M31: what an element is. The library groups by these, and the editor can
 * say "add a lower third". The designer names the type in elements.json;
 * when they do not, the slug usually says.
 */
export const ELEMENT_TYPES = ['open', 'headline', 'lower-third', 'caption', 'callout', 'overlay', 'stat', 'background', 'end-card', 'disclaimer'] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

export function isElementType(v: unknown): v is ElementType {
  return typeof v === 'string' && (ELEMENT_TYPES as readonly string[]).includes(v);
}

/**
 * M41: the types that are a scene of their own (they fill the frame and
 * follow one another) as against an overlay (it sits on a scene). Where a
 * library element lands when added, and where the playhead goes after,
 * follow from this.
 */
export const SCENE_TYPES: readonly ElementType[] = ['open', 'headline', 'stat', 'background', 'end-card'];

export function isSceneType(type: string): boolean {
  return (SCENE_TYPES as readonly string[]).includes(type);
}

/** Slug words that name a type, most specific first. */
const HINTS: [RegExp, ElementType][] = [
  [/(^|[-_])(lower[-_]?third|l3|lowerthird)([-_]|$)/, 'lower-third'],
  [/(^|[-_])(end[-_]?card|endcard|outro|closer)([-_]|$)/, 'end-card'],
  [/(^|[-_])(disclaimer|paid[-_]?for|paid-for-by|legal)([-_]|$)/, 'disclaimer'],
  [/(^|[-_])(stat|stats|statistic|number)([-_]|$)/, 'stat'],
  [/(^|[-_])(callout|call[-_]?out|arrow|pointer)([-_]|$)/, 'callout'],
  [/(^|[-_])(caption|quote|subtitle)([-_]|$)/, 'caption'],
  [/(^|[-_])(headline|title|hed)([-_]|$)/, 'headline'],
  [/(^|[-_])(background|bg|backdrop)([-_]|$)/, 'background'],
  [/(^|[-_])(open|opener|intro|cold[-_]?open)([-_]|$)/, 'open'],
  [/(^|[-_])(overlay|frame|texture|grain)([-_]|$)/, 'overlay'],
];

/** The type a slug suggests; overlay when it suggests nothing. */
export function inferElementType(slug: string): ElementType {
  const s = slug.toLowerCase().replace(/^[\s\d._-]+/, '');
  for (const [re, type] of HINTS) if (re.test(s)) return type;
  return 'overlay';
}

/** "lower-third" -> "Lower thirds": the plural label the library groups under. */
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  open: 'Openings',
  headline: 'Headlines',
  'lower-third': 'Lower thirds',
  caption: 'Captions',
  callout: 'Callouts',
  overlay: 'Overlays',
  stat: 'Proof points: stats',
  background: 'Proof points: footage',
  'end-card': 'End cards',
  disclaimer: 'Disclaimers',
};

/** M51: the order the picker lists the types in: the spot's shape first (opening, proof points, end cards), then what sits on a scene. */
export const PICKER_ORDER: readonly ElementType[] = ['open', 'background', 'stat', 'end-card', 'lower-third', 'headline', 'caption', 'callout', 'overlay', 'disclaimer'];

/**
 * M33: the colour roles a brand can set. The same list the ingest's role
 * table knows as colours (tools/ingest/src/roles.ts); a test keeps them equal.
 */
export const COLOR_ROLES: readonly { role: string; label: string }[] = [
  { role: 'accent', label: 'Accent colour' },
  { role: 'surface', label: 'Surface colour' },
];
