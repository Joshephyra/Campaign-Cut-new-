/**
 * The template contract, per SPEC.md section 1.3. schema.json is generated
 * by the ingest tool (M3/M4); until then the stand-in's schema is written
 * by hand in the same shape.
 */
export type ParamKind = 'text' | 'color' | 'image' | 'media' | 'transform';

export type TemplateParam = {
  /** Identifier used as the key in a values object, e.g. "headline". */
  key: string;
  /** The cc.* role without the prefix, e.g. "headline", "accent", "stat.1". */
  role: string;
  kind: ParamKind;
  /** Human label in the editor. */
  label: string;
  /** What the designer authored. */
  default: unknown;
  /** From the AE text box, where derivable. */
  maxChars?: number;
  /** Disclaimer: position and size locked, text editable only. */
  locked?: boolean;
  /** transform only: the key of the text or image param this placement belongs to (M18). */
  for?: string;
  /**
   * JSON pointer (RFC 6901) into the Lottie. What it points at depends on kind:
   *   text      -> the text layer            (we write layer.t.d.k[*].s.t)
   *   color     -> the fill or stroke item   (we write item.c.k)
   *   image     -> the entry in assets       (we write asset.p / u / e)
   *   media     -> the slot layer            (we write layer.ks.o)
   *   transform -> the layer                 (we offset layer.ks.p / s / r)
   */
  path: string;
};

/** User-entered values, keyed by TemplateParam.key. */
export type ParamValues = Record<string, unknown>;
