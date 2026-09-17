import type { ElementProps, LottieAnimationData, TemplateParam } from '@campaigncut/composition';
import { fileNameFor, findFontByName } from '@campaigncut/server/fontNames';
import type { GoogleFontFetcher } from '@campaigncut/server/googleFonts';
import type { Db } from '@campaigncut/server/db';
import fs from 'node:fs';
import path from 'node:path';
import { findFontFileForStyle } from './fonts';
import { ELEMENT_TYPES, inferElementType, isElementType, type ElementType } from './elementTypes';
import { ASPECTS, aspectKey, frameFor, isAspect, type Aspect } from '@campaigncut/composition';
import { generateSchema, type TagReport } from './generateSchema';

/** Every problem found, so the author can fix them all at once. */
export class IngestFailure extends Error {
  constructor(
    public readonly problems: string[],
    public readonly report: (TagReport & { element?: string })[],
  ) {
    super(problems.join('\n'));
    this.name = 'IngestFailure';
  }
}

export type ThumbnailRenderer = (opts: {
  /** Every element in place on the timeline, images embedded as data URIs so no server is needed. */
  elements: ElementProps[];
  outputPath: string;
  frame: number;
  /** The shipped fonts as data URIs, so the thumbnail draws real text without a running server. */
  fonts: { family: string; style?: string; url: string }[];
}) => Promise<void>;

export type IngestOptions = {
  /**
   * A handover folder or a path to one Lottie JSON. The folder is either a
   * single Bodymovin export (data.json plus images/ and fonts/) or, since
   * M17, a folder of such exports, one per element, with an optional
   * elements.json manifest. See docs/AE-AUTHORING.md.
   */
  input: string;
  adType: string;
  name: string;
  /** Defaults to slugify(name). */
  slug?: string;
  /** Where /templates/<slug>/ is created. */
  templatesDir: string;
  /** Where font files must exist (app/public/fonts). Fonts handed over in the folder are copied here. */
  fontsDir: string;
  /** M59: font files uploaded from the app (media/fonts). Looked in after the handover. */
  fontLibraryDirs?: string[];
  /** M59: this computer's font folders. Looked in after the library; a face is matched by the names inside the file. */
  installedFontDirs?: string[];
  /** M59: fetches a face from Google Fonts when nobody has it. Absent: not tried. */
  fetchGoogleFont?: GoogleFontFetcher;
  db: Db;
  renderThumbnail: ThumbnailRenderer;
  log?: (line: string) => void;
};

/** One entry of elements.json. Only `folder` is required. */
export type ElementManifestEntry = {
  folder: string;
  slug?: string;
  name?: string;
  /** M31: one of ELEMENT_TYPES. Inferred from the slug when absent. */
  type?: string;
  /** M36: a designer's export of this element for another ratio, by aspect ("9:16": "02-lower-third-9x16"). */
  variants?: Record<string, string>;
  /** Defaults to the previous element's out point (0 for the first). */
  startFrame?: number;
  /** Defaults to the element's position in the list. */
  zIndex?: number;
};

export type ElementMeta = {
  slug: string;
  name: string;
  /** M31: what the element is (ELEMENT_TYPES). */
  type: ElementType;
  /** M36: the ratios a designer variant exists for, e.g. ["9:16"]. Absent when none. */
  variants?: Aspect[];
  startFrame: number;
  endFrame: number;
  zIndex: number;
  durationInFrames: number;
  /** Font families referenced by this element's text layers. */
  fonts: string[];
};

export type TemplateMeta = {
  slug: string;
  name: string;
  adType: string;
  /** The last element's out point. */
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  /** Font families referenced by any element, de-duplicated. */
  fonts: string[];
  /** The font file shipped for each family under templates/<slug>/fonts/. */
  fontFiles: { family: string; style: string; file: string }[];
  elements: ElementMeta[];
  /** The After Effects reference render, relative to the template dir, when one was handed over (M19). */
  reference?: string;
  /** M27: the comp background colour (#rrggbb) from elements.json, shown wherever no element covers the frame. */
  background?: string;
  /** M38: the template feeds the element library only; the "start a spot" grid leaves it out. */
  libraryOnly?: boolean;
};

export type ElementIngestResult = ElementMeta & {
  dir: string;
  params: TemplateParam[];
  report: TagReport[];
};

export type IngestResult = {
  slug: string;
  dir: string;
  /** Every element's params, in element order. */
  params: TemplateParam[];
  fonts: string[];
  /** Every element's tag report, in element order, each entry naming its element. */
  report: (TagReport & { element: string })[];
  meta: TemplateMeta;
  elements: ElementIngestResult[];
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "02-lower-third" -> "lower-third"; "Lower Third" -> "lower-third". */
export function elementSlugFromFolder(folder: string): string {
  return slugify(folder.replace(/^[\s\d._-]+/, '')) || slugify(folder);
}

/** "lower-third" -> "Lower third". */
export function elementNameFromSlug(slug: string): string {
  const words = slug.split('-').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One element as found in the handover, before validation. */
type DiscoveredElement = {
  slug: string;
  name: string;
  type: ElementType;
  /** The export folder: images/ and fonts/ are looked up here. */
  folder: string;
  jsonPath: string;
  startFrame?: number;
  zIndex?: number;
  /** M36: designer variants for other ratios, each its own export folder. */
  variants: { aspect: Aspect; folder: string; jsonPath: string }[];
};

/** M36: a variant, read and checked against its master. */
type PreparedVariant = { aspect: Aspect; folder: string; lottie: LottieAnimationData; params: TemplateParam[]; fonts: string[] };

/**
 * One command turns a Bodymovin export (or a folder of them) into a working
 * editable template. Validates everything first (SPEC.md 1.4) and writes
 * nothing on failure.
 */
export async function ingestTemplate(options: IngestOptions): Promise<IngestResult> {
  const { adType, name, templatesDir, fontsDir, db, renderThumbnail } = options;
  const log = options.log ?? (() => {});
  const slug = options.slug ?? slugify(name);
  const problems: string[] = [];

  // 1. Find the elements in the handover.
  const { handoverDir, elements: found, background, libraryOnly, manifestProblems } = discoverElements(options.input, slug, name);
  problems.push(...manifestProblems);
  log(`Reading ${handoverDir}: ${found.length} element(s)`);

  // 2. Every element: Lottie -> tags -> schema. Authoring mistakes come back naming the element and layer.
  type Prepared = DiscoveredElement & {
    lottie: LottieAnimationData;
    params: TemplateParam[];
    fonts: string[];
    report: TagReport[];
    durationInFrames: number;
    preparedVariants: PreparedVariant[];
  };
  const prepared: Prepared[] = [];
  const seenSlugs = new Set<string>();
  for (const el of found) {
    if (seenSlugs.has(el.slug)) {
      problems.push(`Duplicate element slug "${el.slug}" in elements.json; element slugs must be unique`);
      continue;
    }
    seenSlugs.add(el.slug);
    const lottie = JSON.parse(fs.readFileSync(el.jsonPath, 'utf8')) as LottieAnimationData;
    foldWidthIntoFamily(lottie);
    const generated = generateSchema(lottie);
    for (const e of generated.errors) problems.push(`Element "${el.slug}": ${e.message}`);
    const durationInFrames = Number(lottie.op) - Number(lottie.ip);
    // M36: each variant must be the ratio's frame size and carry the master's tags, so the same values apply.
    const variants: PreparedVariant[] = [];
    for (const v of el.variants) {
      const vl = JSON.parse(fs.readFileSync(v.jsonPath, 'utf8')) as LottieAnimationData;
      foldWidthIntoFamily(vl);
      const vg = generateSchema(vl);
      for (const e of vg.errors) problems.push(`Element "${el.slug}", ${v.aspect} variant: ${e.message}`);
      const want = frameFor(v.aspect);
      if (Number(vl.w) !== want.width || Number(vl.h) !== want.height) {
        problems.push(`Element "${el.slug}": the ${v.aspect} variant is ${Number(vl.w)}x${Number(vl.h)}; a ${v.aspect} export must be ${want.width}x${want.height}`);
      }
      const masterKeys = generated.params.map((p) => p.key).sort().join(', ');
      const variantKeys = vg.params.map((p) => p.key).sort().join(', ');
      if (masterKeys !== variantKeys) {
        problems.push(`Element "${el.slug}": the ${v.aspect} variant is tagged differently from the 16:9 master (master: ${masterKeys || 'none'}; variant: ${variantKeys || 'none'}). Tag both the same so one set of values fits both.`);
      }
      variants.push({ aspect: v.aspect, folder: v.folder, lottie: vl, params: vg.params, fonts: vg.fonts });
    }
    prepared.push({ ...el, lottie, params: generated.params, fonts: generated.fonts, report: generated.report, durationInFrames, preparedVariants: variants });
  }

  // 3. Comp settings: taken from the first element; every other element must match.
  if (!slug) problems.push('Template name produces an empty slug');
  if (!name.trim()) problems.push('Template name is empty');
  if (!adType.trim()) problems.push('Ad type is empty');
  const first = prepared[0];
  const fps = first ? Number(first.lottie.fr) : 0;
  const width = first ? Number(first.lottie.w) : 0;
  const height = first ? Number(first.lottie.h) : 0;
  for (const el of prepared.slice(1)) {
    const [f, w, h] = [Number(el.lottie.fr), Number(el.lottie.w), Number(el.lottie.h)];
    if (f !== fps) problems.push(`Element "${el.slug}": frame rate ${f} differs from "${first!.slug}" (${fps}); every element must share fps, width and height`);
    if (w !== width || h !== height) {
      problems.push(`Element "${el.slug}": size ${w}x${h} differs from "${first!.slug}" (${width}x${height}); every element must share fps, width and height`);
    }
  }
  for (const el of prepared) {
    if (!Number.isFinite(el.durationInFrames) || el.durationInFrames <= 0) {
      problems.push(`Element "${el.slug}": durationInFrames is ${String(el.durationInFrames)}; it must be a positive number`);
    }
  }

  // 4. Timeline: explicit start frames from the manifest, else end to end.
  const elementMetas: ElementMeta[] = [];
  let cursor = 0;
  prepared.forEach((el, i) => {
    const startFrame = el.startFrame ?? cursor;
    const endFrame = startFrame + el.durationInFrames;
    cursor = endFrame;
    const variantAspects = el.preparedVariants.map((v) => v.aspect);
    elementMetas.push({
      slug: el.slug,
      name: el.name,
      type: el.type,
      ...(variantAspects.length > 0 ? { variants: variantAspects } : {}),
      startFrame,
      endFrame,
      zIndex: el.zIndex ?? i,
      durationInFrames: el.durationInFrames,
      fonts: el.fonts,
    });
  });
  const durationInFrames = elementMetas.reduce((max, e) => Math.max(max, e.endFrame), 0);

  const fonts: string[] = [];
  for (const el of prepared) for (const f of [...el.fonts, ...el.preparedVariants.flatMap((v) => v.fonts)]) if (!fonts.includes(f)) fonts.push(f);

  const meta: TemplateMeta = { slug, name, adType, durationInFrames, fps, width, height, fonts, fontFiles: [], elements: elementMetas, ...(background ? { background } : {}), ...(libraryOnly ? { libraryOnly: true } : {}) };
  for (const field of ['durationInFrames', 'fps', 'width', 'height'] as const) {
    const v = meta[field];
    if (!Number.isFinite(v) || v <= 0) problems.push(`Template ${field} is ${String(v)}; it must be a positive number`);
  }

  // 5. Every referenced font FACE (family and style) must have a file (M27: a
  //    family shipped as one file renders every weight with that file). Fonts
  //    in the handover get copied in.
  const fontDirs = [path.join(handoverDir, 'fonts'), ...prepared.flatMap((el) => [path.join(el.folder, 'fonts'), ...el.preparedVariants.map((v) => path.join(v.folder, 'fonts'))])];
  const fontCopies: Array<{ from: string; to: string }> = [];
  const fontSources: Array<{ family: string; style: string; from: string }> = [];
  const faces = fontFaces(
    prepared.flatMap((el) => [
      { slug: el.slug, lottie: el.lottie, fonts: el.fonts },
      ...el.preparedVariants.map((v) => ({ slug: `${el.slug} (${v.aspect})`, lottie: v.lottie, fonts: v.fonts })),
    ]),
  );
  // M59: after the handover, the font library, this computer's own fonts (matched by the
  // names inside each file, whatever it is called) and Google Fonts. Every find is copied
  // into fontsDir under the face's own name, so the next ingest finds it at once.
  const libraryDirs = options.fontLibraryDirs ?? [];
  const installedDirs = options.installedFontDirs ?? [];
  const fontBytes: Array<{ to: string; bytes: Uint8Array }> = [];
  for (const face of faces) {
    const shippedAs = (from: string) => path.join(fontsDir, fileNameFor(face.family, face.style, path.extname(from)));
    const inApp = findFontFileForStyle(face.family, face.style, [fontsDir]) ?? findFontByName(face.family, face.style, [fontsDir]);
    if (inApp) {
      fontSources.push({ family: face.family, style: face.style, from: inApp });
      continue;
    }
    const inHandover = findFontFileForStyle(face.family, face.style, fontDirs) ?? findFontByName(face.family, face.style, fontDirs);
    if (inHandover) {
      fontCopies.push({ from: inHandover, to: path.join(fontsDir, path.basename(inHandover)) });
      fontSources.push({ family: face.family, style: face.style, from: inHandover });
      log(`Font ${face.family} ${face.style}: handed over (${path.basename(inHandover)})`);
      continue;
    }
    const inLibrary = findFontFileForStyle(face.family, face.style, libraryDirs) ?? findFontByName(face.family, face.style, libraryDirs);
    if (inLibrary) {
      fontCopies.push({ from: inLibrary, to: shippedAs(inLibrary) });
      fontSources.push({ family: face.family, style: face.style, from: shippedAs(inLibrary) }); // shipped from the renamed copy, once written
      log(`Font ${face.family} ${face.style}: from the font library (${inLibrary})`);
      continue;
    }
    const installed = findFontByName(face.family, face.style, installedDirs);
    if (installed) {
      fontCopies.push({ from: installed, to: shippedAs(installed) });
      fontSources.push({ family: face.family, style: face.style, from: shippedAs(installed) });
      log(`Font ${face.family} ${face.style}: installed on this computer (${installed})`);
      continue;
    }
    const fetched = options.fetchGoogleFont ? await options.fetchGoogleFont(face.family, face.style) : null;
    if (fetched) {
      const to = path.join(fontsDir, fetched.fileName);
      fontBytes.push({ to, bytes: fetched.bytes });
      fontSources.push({ family: face.family, style: face.style, from: to });
      log(`Font ${face.family} ${face.style}: from Google Fonts (${fetched.url})`);
      continue;
    }
    const users = face.elements.map((s) => `"${s}"`).join(', ');
    const looked = [`in ${fontsDir}`, 'in a fonts/ folder of the handover', libraryDirs.length > 0 ? 'in the font library' : '', installedDirs.length > 0 ? 'among the fonts installed on this computer' : '', options.fetchGoogleFont ? 'on Google Fonts' : ''].filter(Boolean).join(', ');
    problems.push(
      `Font "${face.family}" style "${face.style}" (used by element ${users}) was not found: not ${looked}. ` +
        `A missing face would be faked by the browser and no longer match After Effects, so the template is rejected. Hand over that font file (for example ${fileNameFor(face.family, face.style, '.ttf')}), or upload it under "Fonts on hand".`,
    );
  }

  const flatReport = prepared.flatMap((el) => el.report.map((r) => ({ ...r, element: el.slug })));
  if (problems.length > 0) throw new IngestFailure(problems, flatReport);

  // 6. Everything validated. Now write.
  const dir = path.join(templatesDir, slug);
  const elementsRoot = path.join(dir, 'elements');
  fs.mkdirSync(elementsRoot, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });
  for (const { from, to } of fontCopies) {
    fs.copyFileSync(from, to);
    log(`Copied font ${path.basename(from)} -> ${to}`);
  }
  for (const { to, bytes } of fontBytes) {
    fs.writeFileSync(to, bytes);
    log(`Wrote font ${path.basename(to)} -> ${fontsDir}`);
  }
  // A re-ingest that lost an element removes its files; pre-M17 root files go too.
  for (const stale of fs.readdirSync(elementsRoot)) {
    if (!prepared.some((el) => el.slug === stale)) fs.rmSync(path.join(elementsRoot, stale), { recursive: true, force: true });
  }
  for (const rootFile of ['template.json', 'schema.json']) fs.rmSync(path.join(dir, rootFile), { force: true });
  fs.rmSync(path.join(dir, 'images'), { recursive: true, force: true });

  const written: ElementIngestResult[] = [];
  prepared.forEach((el, i) => {
    const elDir = path.join(elementsRoot, el.slug);
    fs.rmSync(elDir, { recursive: true, force: true });
    fs.mkdirSync(elDir, { recursive: true });
    fs.writeFileSync(path.join(elDir, 'template.json'), JSON.stringify(el.lottie, null, 2) + '\n');
    fs.writeFileSync(path.join(elDir, 'schema.json'), JSON.stringify(el.params, null, 2) + '\n');
    const imagesDir = path.join(el.folder, 'images');
    if (fs.existsSync(imagesDir)) fs.cpSync(imagesDir, path.join(elDir, 'images'), { recursive: true });
    // M36: designer variants live beside the element, one folder per ratio.
    for (const v of el.preparedVariants) {
      const vDir = path.join(elDir, 'variants', aspectKey(v.aspect));
      fs.mkdirSync(vDir, { recursive: true });
      fs.writeFileSync(path.join(vDir, 'template.json'), JSON.stringify(v.lottie, null, 2) + '\n');
      fs.writeFileSync(path.join(vDir, 'schema.json'), JSON.stringify(v.params, null, 2) + '\n');
      const vImages = path.join(v.folder, 'images');
      if (fs.existsSync(vImages)) fs.cpSync(vImages, path.join(vDir, 'images'), { recursive: true });
      log(`Wrote ${v.aspect} variant of "${el.slug}" -> ${vDir}`);
    }
    written.push({ ...elementMetas[i]!, dir: elDir, params: el.params, report: el.report });
    log(`Wrote element "${el.slug}" (${el.params.length} param(s), frames ${elementMetas[i]!.startFrame}-${elementMetas[i]!.endFrame}) -> ${elDir}`);
  });

  // SPEC 8: ship the font files alongside the template.
  fs.rmSync(path.join(dir, 'fonts'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  for (const { family, style, from } of fontSources) {
    const file = path.basename(from);
    fs.copyFileSync(from, path.join(dir, 'fonts', file));
    meta.fontFiles.push({ family, style, file });
  }
  if (fontSources.length > 0) log(`Shipped ${fontSources.length} font file(s) -> ${path.join(dir, 'fonts')}`);
  // M19: the After Effects reference render travels with the template for the fidelity harness.
  const referenceSource = path.join(handoverDir, 'reference.mp4');
  fs.rmSync(path.join(dir, 'reference.mp4'), { force: true });
  if (fs.existsSync(referenceSource)) {
    fs.copyFileSync(referenceSource, path.join(dir, 'reference.mp4'));
    meta.reference = 'reference.mp4';
    log(`Copied reference.mp4`);
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  log(`Wrote meta.json -> ${dir}`);

  // 7. Thumbnail: the whole timeline at its middle frame, through the same composition.
  const thumbPath = path.join(dir, 'thumb.png');
  const thumbFonts = meta.fontFiles.map(({ family, style, file }) => {
    const bytes = fs.readFileSync(path.join(dir, 'fonts', file));
    const ext = path.extname(file).toLowerCase().slice(1);
    const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'otf' ? 'font/otf' : 'font/ttf';
    return { family, style, url: `data:${mime};base64,${bytes.toString('base64')}` };
  });
  const thumbElements: ElementProps[] = prepared.map((el, i) => ({
    id: el.slug,
    lottie: withEmbeddedImages(el.lottie, written[i]!.dir),
    startFrame: elementMetas[i]!.startFrame,
    endFrame: elementMetas[i]!.endFrame,
    zIndex: elementMetas[i]!.zIndex,
    enabled: true,
  }));
  await renderThumbnail({ elements: thumbElements, outputPath: thumbPath, frame: thumbnailFrame(elementMetas, durationInFrames), fonts: thumbFonts });
  log(`Wrote thumb.png`);

  // 8. Register. Same slug updates rather than duplicates.
  const { id: templateId } = db.upsertTemplate({
    slug,
    name,
    adType,
    durationFrames: durationInFrames,
    fps,
    width,
    height,
    thumbPath: path.relative(path.dirname(templatesDir), thumbPath).split(path.sep).join('/'),
    libraryOnly: Boolean(libraryOnly),
  });
  for (const e of elementMetas) {
    db.upsertTemplateElement({ templateId, slug: e.slug, name: e.name, type: e.type, zIndex: e.zIndex, startFrame: e.startFrame, endFrame: e.endFrame });
  }
  db.deleteTemplateElementsExcept(
    templateId,
    elementMetas.map((e) => e.slug),
  );
  log(`Registered "${name}" (${slug}) under ad type "${adType}" with ${elementMetas.length} element(s)`);

  return {
    slug,
    dir,
    params: written.flatMap((e) => e.params),
    fonts,
    report: flatReport,
    meta,
    elements: written,
  };
}

/**
 * The frame the thumbnail shows: the busiest moment of the timeline (most
 * elements on screen), and among those the one nearest the middle. The bare
 * middle frame can land in a gap between elements and come out black.
 */
export function thumbnailFrame(elements: { startFrame: number; endFrame: number }[], durationInFrames: number): number {
  const mid = Math.floor(durationInFrames / 2);
  let best = { frame: mid, count: -1, distance: Infinity };
  for (let f = 0; f < durationInFrames; f++) {
    const count = elements.filter((e) => e.startFrame <= f && f < e.endFrame).length;
    const distance = Math.abs(f - mid);
    if (count > best.count || (count === best.count && distance < best.distance)) best = { frame: f, count, distance };
  }
  return best.frame;
}

/** A copy of the Lottie with relative image assets embedded as data URIs, for renders that have no server. */
export function withEmbeddedImages(lottie: LottieAnimationData, elementDir: string): LottieAnimationData {
  if (!Array.isArray(lottie.assets)) return lottie;
  const mimeFor = (file: string) => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
  };
  const assets = (lottie.assets as Record<string, unknown>[]).map((a) => {
    if (typeof a.p !== 'string' || a.e === 1 || /^(https?:|data:|\/)/.test(a.p)) return a;
    const dir = typeof a.u === 'string' ? a.u : '';
    const file = path.join(elementDir, dir, a.p);
    if (!fs.existsSync(file)) return a;
    return { ...a, u: '', e: 1, p: `data:${mimeFor(file)};base64,${fs.readFileSync(file).toString('base64')}` };
  });
  return { ...lottie, assets };
}

/** The Bodymovin JSON inside an export folder, if the folder is one. */
function exportJsonIn(folder: string): string | undefined {
  const preferred = path.join(folder, 'data.json');
  if (fs.existsSync(preferred)) return preferred;
  const candidates = fs.readdirSync(folder).filter((f) => f.endsWith('.json') && !['schema.json', 'meta.json', 'elements.json'].includes(f));
  if (candidates.length === 1) return path.join(folder, candidates[0]!);
  if (candidates.length > 1) throw new IngestFailure([`Several JSON files in ${folder}; name the export data.json or pass the file path`], []);
  return undefined;
}

/**
 * Find the elements in a handover. A JSON path or an export folder is one
 * element named after the template. A folder of export folders is one
 * element each, ordered by elements.json when present, else by name.
 */
type Discovered = { handoverDir: string; elements: DiscoveredElement[]; background?: string; libraryOnly: boolean; manifestProblems: string[] };

function discoverElements(input: string, templateSlug: string, templateName: string): Discovered {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new IngestFailure([`Input not found: ${resolved}`], []);

  // A one-comp handover is the whole spot, so it is a scene: an opening unless its name says otherwise (M62 review; a lone overlay would have no scene to sit on).
  const singleType = (): ElementType => { const t = inferElementType(templateSlug); return t === 'overlay' ? 'open' : t; };
  const single = (jsonPath: string, folder: string): DiscoveredElement => ({ slug: templateSlug, name: templateName, type: singleType(), folder, jsonPath, variants: [] });

  if (fs.statSync(resolved).isFile()) {
    return { handoverDir: path.dirname(resolved), elements: [single(resolved, path.dirname(resolved))], libraryOnly: false, manifestProblems: [] };
  }

  const ownJson = exportJsonIn(resolved);
  if (ownJson) return { handoverDir: resolved, elements: [single(ownJson, resolved)], libraryOnly: false, manifestProblems: [] };

  const manifestFile = path.join(resolved, 'elements.json');
  const problems: string[] = [];
  const manifestProblems: string[] = [];
  const elements: DiscoveredElement[] = [];
  let background: string | undefined;
  let libraryOnly = false;

  if (fs.existsSync(manifestFile)) {
    // Either a bare list of elements, or { background?, libraryOnly?, elements } (M27, M38).
    const parsed = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ElementManifestEntry[] | { background?: unknown; libraryOnly?: unknown; elements?: ElementManifestEntry[] };
    const manifest = Array.isArray(parsed) ? parsed : parsed.elements;
    if (!Array.isArray(manifest) || manifest.length === 0) {
      throw new IngestFailure([`${manifestFile} must be a non-empty list of { folder, slug?, name?, startFrame?, zIndex? }, or { background, elements: [...] }`], []);
    }
    if (!Array.isArray(parsed) && parsed.background !== undefined) {
      if (typeof parsed.background === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.background)) background = parsed.background.toUpperCase();
      else manifestProblems.push(`elements.json "background" must be a #rrggbb colour, got ${JSON.stringify(parsed.background)}`);
    }
    if (!Array.isArray(parsed) && parsed.libraryOnly !== undefined) {
      if (typeof parsed.libraryOnly === 'boolean') libraryOnly = parsed.libraryOnly;
      else manifestProblems.push(`elements.json "libraryOnly" must be true or false, got ${JSON.stringify(parsed.libraryOnly)}`);
    }
    for (const entry of manifest) {
      const folder = path.join(resolved, String(entry.folder ?? ''));
      if (!entry.folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
        problems.push(`elements.json names folder "${String(entry.folder)}" but it does not exist in ${resolved}`);
        continue;
      }
      const jsonPath = exportJsonIn(folder);
      if (!jsonPath) {
        problems.push(`elements.json names folder "${entry.folder}" but it holds no Bodymovin JSON`);
        continue;
      }
      const elSlug = entry.slug ? slugify(entry.slug) : elementSlugFromFolder(entry.folder);
      let type: ElementType = inferElementType(elSlug);
      if (entry.type !== undefined) {
        if (isElementType(entry.type)) type = entry.type;
        else problems.push(`Element "${elSlug}": unknown type "${String(entry.type)}" in elements.json; use one of ${ELEMENT_TYPES.join(', ')}`);
      }
      // M36: variants by ratio, each an export folder inside the handover.
      const variants: DiscoveredElement['variants'] = [];
      if (entry.variants !== undefined) {
        if (!entry.variants || typeof entry.variants !== 'object' || Array.isArray(entry.variants)) {
          problems.push(`Element "${elSlug}": "variants" must be an object of ratio to folder, for example { "9:16": "02-lower-third-9x16" }`);
        } else {
          for (const [aspect, vf] of Object.entries(entry.variants)) {
            if (!isAspect(aspect) || aspect === '16:9') {
              problems.push(`Element "${elSlug}": unknown variant ratio "${aspect}"; use one of ${ASPECTS.join(', ')} (16:9 is the master itself)`);
              continue;
            }
            const vFolder = path.join(resolved, String(vf));
            if (!fs.existsSync(vFolder) || !fs.statSync(vFolder).isDirectory()) {
              problems.push(`Element "${elSlug}": the ${aspect} variant names folder "${String(vf)}" but it does not exist in ${resolved}`);
              continue;
            }
            const vJson = exportJsonIn(vFolder);
            if (!vJson) {
              problems.push(`Element "${elSlug}": the ${aspect} variant folder "${String(vf)}" holds no Bodymovin JSON`);
              continue;
            }
            variants.push({ aspect, folder: vFolder, jsonPath: vJson });
          }
        }
      }
      elements.push({
        slug: elSlug,
        name: entry.name?.trim() || elementNameFromSlug(elSlug),
        type,
        variants,
        folder,
        jsonPath,
        startFrame: entry.startFrame === undefined ? undefined : Math.max(0, Math.round(Number(entry.startFrame))),
        zIndex: entry.zIndex === undefined ? undefined : Math.round(Number(entry.zIndex)),
      });
    }
  } else {
    const folders = fs
      .readdirSync(resolved)
      .filter((f) => fs.statSync(path.join(resolved, f)).isDirectory() && !['fonts', 'images'].includes(f))
      .sort();
    for (const f of folders) {
      const jsonPath = exportJsonIn(path.join(resolved, f));
      if (!jsonPath) continue;
      const elSlug = elementSlugFromFolder(f);
      elements.push({ slug: elSlug, name: elementNameFromSlug(elSlug), type: inferElementType(elSlug), folder: path.join(resolved, f), jsonPath, variants: [] });
    }
  }

  if (problems.length > 0) throw new IngestFailure(problems, []);
  if (elements.length === 0) {
    throw new IngestFailure([`No Bodymovin JSON found in ${resolved}: expected data.json, or one sub-folder per element each holding an export`], []);
  }
  return { handoverDir: resolved, elements, background, libraryOnly, manifestProblems };
}

/**
 * M27: every font FACE the elements use, as (family, style) from each
 * export's fonts list, with the elements that use it. A family with no
 * list entry (older exports) counts as Regular.
 */
/** The width words After Effects folds into a font's style ("Narrow Bold") that name a family of their own on disk. */
const WIDTH_WORDS = ['Narrow', 'Condensed', 'Compressed', 'Extended', 'Expanded', 'Wide'];

/**
 * M38: Bodymovin reports Arial Narrow Bold as family "Arial", style
 * "Narrow Bold". The browser has no notion of "Narrow" in a style, so that
 * face would collide with Arial Bold and render in the wrong font. The
 * width belongs to the family: "Arial Narrow", style "Bold", which is also
 * how the file is named. Rewrites the Lottie's font list in place, so the
 * schema, the shipped faces and the rendered text all agree.
 */
export function foldWidthIntoFamily(lottie: LottieAnimationData): void {
  const list = ((lottie.fonts as { list?: { fFamily?: string; fStyle?: string }[] } | undefined)?.list) ?? [];
  for (const f of list) {
    if (typeof f.fFamily !== 'string' || typeof f.fStyle !== 'string') continue;
    const words = f.fStyle.split(/\s+/).filter(Boolean);
    const widths = words.filter((w) => WIDTH_WORDS.some((x) => x.toLowerCase() === w.toLowerCase()));
    if (widths.length === 0) continue;
    const rest = words.filter((w) => !widths.includes(w));
    f.fFamily = `${f.fFamily} ${widths.join(' ')}`;
    f.fStyle = rest.join(' ') || 'Regular';
  }
}

export function fontFaces(elements: { slug: string; lottie: LottieAnimationData; fonts: string[] }[]): { family: string; style: string; elements: string[] }[] {
  const faces: { family: string; style: string; elements: string[] }[] = [];
  const add = (family: string, style: string, slug: string) => {
    const key = `${family} ${style}`;
    let face = faces.find((f) => `${f.family} ${f.style}` === key);
    if (!face) {
      face = { family, style, elements: [] };
      faces.push(face);
    }
    if (!face.elements.includes(slug)) face.elements.push(slug);
  };
  for (const el of elements) {
    const list = ((el.lottie.fonts as { list?: { fFamily?: string; fStyle?: string }[] } | undefined)?.list) ?? [];
    const listed = list.filter((f) => typeof f.fFamily === 'string' && f.fFamily.length > 0);
    if (listed.length > 0) {
      for (const f of listed) add(f.fFamily!, (f.fStyle && f.fStyle.trim()) || 'Regular', el.slug);
    } else {
      for (const family of el.fonts) add(family, 'Regular', el.slug);
    }
  }
  return faces;
}
