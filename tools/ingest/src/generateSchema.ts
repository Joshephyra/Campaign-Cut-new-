import { DEFAULT_TRANSFORM, MIN_SHRINK, rgbaToHex, type LottieAnimationData, type ParamKind, type TemplateParam } from '@campaigncut/composition';
import { keyFor, KNOWN_ROLES, labelFor, ROLES } from './roles';
import { parseTag } from './tags';

type AnyRecord = Record<string, unknown>;

export type IngestError = { layer: string; message: string };

export type TagReport = {
  /** The layer name as authored. */
  layer: string;
  status: ParamKind | 'error';
  path?: string;
  message?: string;
};

export type GeneratedSchema = {
  params: TemplateParam[];
  /** Font families referenced by any text layer, de-duplicated, in order of first use. */
  fonts: string[];
  /** Every cc.* tag encountered, in layer order, including the ones that errored. */
  report: TagReport[];
  errors: IngestError[];
};

/** Lottie layer types we care about. */
const LAYER_PRECOMP = 0;
const LAYER_IMAGE = 2;
const LAYER_SHAPE = 4;
const LAYER_TEXT = 5;

/** Average glyph width as a fraction of font size, for deriving maxChars. */
const AVERAGE_GLYPH_WIDTH = 0.55;

/**
 * Walk a Bodymovin export, find every cc.* layer, and emit the template
 * schema. Never throws for authoring mistakes: they come back in `errors`,
 * each naming the layer, so the CLI can print all of them at once.
 */
export function generateSchema(lottie: LottieAnimationData): GeneratedSchema {
  const params: Array<TemplateParam & { _order: number; _index: number }> = [];
  const report: TagReport[] = [];
  const errors: IngestError[] = [];
  const fontNames: string[] = [];
  const seenKeys = new Set<string>();
  const roleOrder = new Map<string, number>();
  /** M60: followers wait until every text tag is known, so a plate can be listed above or below its text. */
  const followers: Array<{ tag: string; role: string; index: number | undefined; follows: 'plate' | 'underline'; layer: AnyRecord; pointer: string }> = [];

  const fail = (layer: string, message: string) => {
    errors.push({ layer, message });
    report.push({ layer, status: 'error', message });
  };

  for (const { layer, pointer } of walkLayers(lottie)) {
    if (layer.ty === LAYER_TEXT) collectFonts(layer, fontNames);

    const name = typeof layer.nm === 'string' ? layer.nm : '';
    const parsed = parseTag(name);
    if (!parsed) continue;

    const { tag, role, index } = parsed;
    const spec = ROLES[role];
    if (!spec) {
      fail(tag, `Layer "${tag}": unknown role "${role}". Known roles: ${KNOWN_ROLES.join(', ')}. Tags are case-sensitive.`);
      continue;
    }
    if (parsed.follows) {
      if (spec.kind !== 'text') fail(tag, `Layer "${tag}": only a text can have a ${parsed.follows}; "${role}" is a ${spec.kind} role`);
      else if (layer.ty !== LAYER_SHAPE && layer.ty !== LAYER_IMAGE) fail(tag, `Layer "${tag}": a ${parsed.follows} must be a shape layer or an image layer, so its width can follow the copy (this is ty ${String(layer.ty)})`);
      else followers.push({ tag, role, index, follows: parsed.follows, layer, pointer });
      continue;
    }
    if (spec.repeated && index === undefined) {
      fail(tag, `Layer "${tag}": role "${role}" is repeated and needs an index, e.g. cc.${role}.1`);
      continue;
    }
    if (!spec.repeated && !spec.lines && index !== undefined) {
      fail(tag, `Layer "${tag}": role "${role}" is not repeatable; drop the ".${index}"`);
      continue;
    }

    const key = keyFor(role, index);
    if (seenKeys.has(key)) {
      fail(tag, `Layer "${tag}": duplicate tag; another layer already uses it`);
      continue;
    }

    const resolved = resolveTarget(spec.kind, layer, pointer, lottie, tag);
    if ('error' in resolved) {
      fail(tag, resolved.error);
      continue;
    }

    seenKeys.add(key);
    if (!roleOrder.has(role)) roleOrder.set(role, roleOrder.size);

    const param: TemplateParam & { _order: number; _index: number } = {
      key,
      role,
      kind: spec.kind,
      label: labelFor(role, index),
      default: resolved.defaultValue,
      path: resolved.path,
      _order: roleOrder.get(role)!,
      _index: index ?? 0,
    };
    if (resolved.maxChars !== undefined) param.maxChars = resolved.maxChars;
    if (spec.locked) param.locked = true;
    params.push(param);
    report.push({ layer: tag, status: spec.kind, path: resolved.path });

    // M18: text and images the user may edit can also be moved, scaled and
    // rotated. The placement param points at the LAYER (an image's own param
    // points at the asset). Locked roles (cc.safe.*) stay where they are.
    if ((spec.kind === 'text' || spec.kind === 'image') && !spec.locked) {
      params.push({
        key: `${key}.transform`,
        role,
        kind: 'transform',
        label: `${labelFor(role, index)} placement`,
        default: DEFAULT_TRANSFORM,
        path: pointer,
        for: key,
        _order: roleOrder.get(role)!,
        _index: index ?? 0,
      });
    }
  }

  // M60: each follower hangs off the text it names; a follower of an untagged text is a mistake worth naming.
  for (const f of followers) {
    const textKey = keyFor(f.role, f.index);
    if (!seenKeys.has(textKey)) {
      fail(f.tag, `Layer "${f.tag}": follows cc.${f.role}${f.index === undefined ? '' : `.${f.index}`}, but no text layer carries that tag`);
      continue;
    }
    let n = 1;
    let key = `${textKey}.${f.follows}`;
    while (seenKeys.has(key)) key = `${textKey}.${f.follows}.${++n}`;
    seenKeys.add(key);
    params.push({ key, role: f.role, kind: 'follow', label: `${labelFor(f.role, f.index)} ${f.follows}`, default: null, path: f.pointer, for: textKey, follows: f.follows, _order: roleOrder.get(f.role)!, _index: f.index ?? 0 });
    report.push({ layer: f.tag, status: 'follow', path: f.pointer });
  }

  params.sort((a, b) => a._order - b._order || a._index - b._index);
  const cleaned = params.map(({ _order, _index, ...p }) => p);

  return { params: cleaned, fonts: resolveFontFamilies(lottie, fontNames), report, errors };
}

// ---- walking -----------------------------------------------------------

type Visit = { layer: AnyRecord; pointer: string };

function* walkLayers(lottie: LottieAnimationData): Generator<Visit> {
  const assets = Array.isArray(lottie.assets) ? (lottie.assets as AnyRecord[]) : [];
  const visitedComps = new Set<string>();

  function* walk(layers: unknown, prefix: string): Generator<Visit> {
    if (!Array.isArray(layers)) return;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i] as AnyRecord;
      if (!layer || typeof layer !== 'object') continue;
      const pointer = `${prefix}/layers/${i}`;
      yield { layer, pointer };

      if (layer.ty === LAYER_PRECOMP && typeof layer.refId === 'string' && !visitedComps.has(layer.refId)) {
        const assetIndex = assets.findIndex((a) => a?.id === layer.refId);
        if (assetIndex >= 0) {
          visitedComps.add(layer.refId);
          yield* walk(assets[assetIndex]!.layers, `/assets/${assetIndex}`);
        }
      }
    }
  }

  yield* walk(lottie.layers, '');
}

// ---- resolving each kind ----------------------------------------------

type Resolved = { path: string; defaultValue: unknown; maxChars?: number } | { error: string };

function resolveTarget(kind: ParamKind, layer: AnyRecord, pointer: string, lottie: LottieAnimationData, tag: string): Resolved {
  switch (kind) {
    case 'text':
      return resolveText(layer, pointer, tag);
    case 'color':
      return resolveColor(layer, pointer, tag);
    case 'image':
      return resolveImage(layer, lottie, tag);
    case 'media':
      return { path: pointer, defaultValue: null };
    case 'transform':
      return { error: `Layer "${tag}": placement is derived from text and image tags, not tagged directly` };
    case 'follow':
      return { error: `Layer "${tag}": a follower is tagged after its text (cc.headline.1.plate), never as a role of its own` };
  }
}

function firstTextStyle(layer: AnyRecord): AnyRecord | undefined {
  const doc = (layer.t as AnyRecord | undefined)?.d as AnyRecord | undefined;
  const keyframes = doc?.k;
  if (!Array.isArray(keyframes) || keyframes.length === 0) return undefined;
  const style = (keyframes[0] as AnyRecord).s;
  return style && typeof style === 'object' ? (style as AnyRecord) : undefined;
}

function resolveText(layer: AnyRecord, pointer: string, tag: string): Resolved {
  if (layer.ty !== LAYER_TEXT) {
    return { error: `Layer "${tag}": tagged as text but it is not a text layer (ty ${String(layer.ty)})` };
  }
  const style = firstTextStyle(layer);
  if (!style) return { error: `Layer "${tag}": text layer has no text document` };

  const out: Resolved = { path: pointer, defaultValue: typeof style.t === 'string' ? style.t : '' };
  const maxChars = deriveMaxChars(style);
  if (maxChars !== undefined) out.maxChars = maxChars;
  return out;
}

/**
 * Bodymovin writes box text (paragraph text) with `sz: [w, h]`. Point text
 * has no box, so no limit can be derived. Estimate: characters per line
 * from the box width and font size, times the number of lines that fit.
 */
function deriveMaxChars(style: AnyRecord): number | undefined {
  const size = style.sz;
  const fontSize = typeof style.s === 'number' ? style.s : undefined;
  if (!Array.isArray(size) || size.length < 2 || !fontSize || fontSize <= 0) return undefined;
  const [w, h] = size as [number, number];
  // M65: a box's lines are counted at its leading, never at less than the type's own size: a designer's one-line
  // box drawn tall with a tight leading (the handover's 297-high boxes at 44 leading under 180 px type) is one line.
  const lineHeight = Math.max(typeof style.lh === 'number' && style.lh > 0 ? style.lh : fontSize * 1.2, fontSize);
  const perLine = Math.floor(w / (AVERAGE_GLYPH_WIDTH * fontSize));
  const lines = Math.max(1, Math.floor(h / lineHeight));
  // M61: box text shrinks to fit, down to MIN_SHRINK of its size, so that many more characters fit on the same lines.
  return Math.max(1, Math.round((perLine * lines) / MIN_SHRINK));
}

function resolveColor(layer: AnyRecord, pointer: string, tag: string): Resolved {
  if (layer.ty !== LAYER_SHAPE) {
    return { error: `Layer "${tag}": tagged as a colour but it is not a shape layer, so it has no fill or stroke` };
  }
  const found = findFillOrStroke(layer.shapes, `${pointer}/shapes`);
  if (!found) return { error: `Layer "${tag}": tagged as a colour but it has no fill or stroke to change` };

  const colour = (found.item.c as AnyRecord | undefined) ?? {};
  let rgba: number[] | undefined;
  if (Array.isArray(colour.k) && typeof colour.k[0] === 'number') rgba = colour.k as number[];
  else if (Array.isArray(colour.k) && Array.isArray((colour.k[0] as AnyRecord | undefined)?.s)) rgba = (colour.k[0] as AnyRecord).s as number[];

  return { path: found.path, defaultValue: rgba ? rgbaToHex(rgba) : null };
}

/** First fill in document order; failing that, the first stroke. Recurses into groups. */
function findFillOrStroke(shapes: unknown, prefix: string): { item: AnyRecord; path: string } | undefined {
  let firstStroke: { item: AnyRecord; path: string } | undefined;

  const visit = (items: unknown, p: string): { item: AnyRecord; path: string } | undefined => {
    if (!Array.isArray(items)) return undefined;
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as AnyRecord;
      if (!item || typeof item !== 'object') continue;
      const path = `${p}/${i}`;
      if (item.ty === 'fl') return { item, path };
      if (item.ty === 'st' && !firstStroke) firstStroke = { item, path };
      if (item.ty === 'gr') {
        const inner = visit(item.it, `${path}/it`);
        if (inner) return inner;
      }
    }
    return undefined;
  };

  return visit(shapes, prefix) ?? firstStroke;
}

function resolveImage(layer: AnyRecord, lottie: LottieAnimationData, tag: string): Resolved {
  if (layer.ty !== LAYER_IMAGE || typeof layer.refId !== 'string') {
    return { error: `Layer "${tag}": tagged as an image but it is not an image layer` };
  }
  const assets = Array.isArray(lottie.assets) ? (lottie.assets as AnyRecord[]) : [];
  const index = assets.findIndex((a) => a?.id === layer.refId);
  if (index < 0 || typeof assets[index]!.p !== 'string') {
    return { error: `Layer "${tag}": image layer references asset "${layer.refId}" which has no image source` };
  }
  const asset = assets[index]!;
  const dir = typeof asset.u === 'string' ? asset.u : '';
  return { path: `/assets/${index}`, defaultValue: `${dir}${asset.p as string}` };
}

// ---- fonts -------------------------------------------------------------

function collectFonts(layer: AnyRecord, into: string[]): void {
  const doc = (layer.t as AnyRecord | undefined)?.d as AnyRecord | undefined;
  if (!Array.isArray(doc?.k)) return;
  for (const keyframe of doc.k as AnyRecord[]) {
    const style = keyframe.s as AnyRecord | undefined;
    if (style && typeof style.f === 'string' && !into.includes(style.f)) into.push(style.f);
  }
}

/** Map Bodymovin font names (fName) to families (fFamily) via the fonts list. */
function resolveFontFamilies(lottie: LottieAnimationData, fontNames: string[]): string[] {
  const list = ((lottie.fonts as AnyRecord | undefined)?.list as AnyRecord[] | undefined) ?? [];
  const families: string[] = [];
  for (const name of fontNames) {
    const entry = list.find((f) => f.fName === name);
    const family = typeof entry?.fFamily === 'string' ? entry.fFamily : name;
    if (!families.includes(family)) families.push(family);
  }
  return families;
}
