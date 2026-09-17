import type { ParamValues, TemplateParam } from './schema';

/**
 * M39: style treatments. A treatment is a look laid over the whole spot in
 * the composition, the same in both runners: nothing in the designer's
 * Lottie changes, so the animation cannot break.
 *
 *   clean   the design as authored
 *   grit    film grain over the frame, a touch more contrast on the design
 *   glow    the design glows in the spot's accent colour
 *   opaque  text sits on a white plate in dark ink, like a highlighter
 *
 * "Bubbly" from the prototype is a font and radius swap; text must render
 * in the designer's font, so that one is a designed variant from After
 * Effects (a later milestone), not a treatment.
 */
export const TREATMENTS = ['clean', 'grit', 'glow', 'opaque'] as const;
export type Treatment = (typeof TREATMENTS)[number];

export const TREATMENT_LABELS: Record<Treatment, string> = {
  clean: 'Clean',
  grit: 'Grit',
  glow: 'Glow',
  opaque: 'Opaque',
};

export function isTreatment(value: unknown): value is Treatment {
  return typeof value === 'string' && (TREATMENTS as readonly string[]).includes(value);
}

/** What the composition is handed: the treatment and, for glow, the colour it glows in. */
export type TreatmentProps = { name: Treatment; accent?: string };

/** The accent the spot glows in when no element sets one (the campaign blue). */
export const DEFAULT_ACCENT = '#2F6BFF';

/**
 * The treatment props for a spot: the accent comes from the first element
 * that has a colour value in the "accent" role, else the default. Both
 * runners build props through this, so preview and export agree.
 */
export function treatmentFor(name: Treatment | string | null | undefined, elements: { schema: TemplateParam[]; values: ParamValues }[]): TreatmentProps | undefined {
  const treatment = isTreatment(name) ? name : 'clean';
  if (treatment === 'clean') return undefined;
  if (treatment !== 'glow') return { name: treatment };
  for (const el of elements) {
    for (const p of el.schema) {
      if (p.kind !== 'color' || p.role !== 'accent') continue;
      const v = el.values[p.key] ?? p.default;
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return { name: 'glow', accent: v.toUpperCase() };
    }
  }
  return { name: 'glow', accent: DEFAULT_ACCENT };
}

/** The accent colour an element carries (its "accent" role's value, else the authored one, else the campaign blue). */
export function accentOf(schema: TemplateParam[], values: ParamValues): string {
  for (const p of schema) {
    if (p.kind !== 'color' || p.role !== 'accent') continue;
    const v = values[p.key] ?? p.default;
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  }
  return DEFAULT_ACCENT;
}

/** The CSS filter a treatment puts on each element's whole design (not its footage). */
export function treatmentLayerFilter(t: TreatmentProps | undefined): string | undefined {
  if (!t) return undefined;
  switch (t.name) {
    case 'grit':
      return 'contrast(1.12)';
    case 'glow':
    case 'opaque':
    case 'clean':
      return undefined;
  }
}

/** The class every accent-coloured layer carries, so glow can find it. */
export const ACCENT_CLASS = 'cc-accent';
/** The class every editable text layer carries (also in transform.ts as TEXT_CLASS). */
const TEXT = 'cc-text';

/**
 * The CSS a treatment addresses to layers inside the designs. Glow is a
 * drop shadow on each text and accent layer, not on the whole design: a
 * shadow follows the element's silhouette, and a design's surface fills
 * the frame, so a shadow on the whole would fall off the frame and never
 * round the words. Opaque is the plate filter on text (the filter itself
 * is an SVG in Main).
 */
export function treatmentCss(t: TreatmentProps | undefined): string {
  if (!t) return '';
  switch (t.name) {
    case 'glow': {
      const c = t.accent ?? DEFAULT_ACCENT;
      return `[data-treatment="glow"] .${TEXT}, [data-treatment="glow"] .${ACCENT_CLASS} { filter: drop-shadow(0 0 8px ${c}) drop-shadow(0 0 18px ${c}); }`;
    }
    case 'opaque':
      return `[data-treatment="opaque"] .${TEXT}:not(.cc-key-disclaimer) { filter: url(#${OPAQUE_PLATE_FILTER_ID}); color: ${OPAQUE_INK}; }`;
    case 'grit':
    case 'clean':
      return '';
  }
}

/** A tile of fractal noise for grit, as an SVG data URI (no file to fetch, so both runners have it). */
export const GRIT_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** The ink text is set in on an opaque plate. */
export const OPAQUE_INK = '#0B1C30';
export const OPAQUE_PLATE_FILTER_ID = 'cc-opaque-plate';
