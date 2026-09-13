import type { ElementProps, LottieAnimationData, TemplateParam } from '@campaigncut/composition';
import type { Db } from '@campaigncut/server/db';
import fs from 'node:fs';
import path from 'node:path';
import { findFontFile } from './fonts';
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
  fonts: { family: string; url: string }[];
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
  db: Db;
  renderThumbnail: ThumbnailRenderer;
  log?: (line: string) => void;
};

/** One entry of elements.json. Only `folder` is required. */
export type ElementManifestEntry = {
  folder: string;
  slug?: string;
  name?: string;
  /** Defaults to the previous element's out point (0 for the first). */
  startFrame?: number;
  /** Defaults to the element's position in the list. */
  zIndex?: number;
};

export type ElementMeta = {
  slug: string;
  name: string;
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
  fontFiles: { family: string; file: string }[];
  elements: ElementMeta[];
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
  /** The export folder: images/ and fonts/ are looked up here. */
  folder: string;
  jsonPath: string;
  startFrame?: number;
  zIndex?: number;
};

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
  const { handoverDir, elements: found } = discoverElements(options.input, slug, name);
  log(`Reading ${handoverDir}: ${found.length} element(s)`);

  // 2. Every element: Lottie -> tags -> schema. Authoring mistakes come back naming the element and layer.
  type Prepared = DiscoveredElement & {
    lottie: LottieAnimationData;
    params: TemplateParam[];
    fonts: string[];
    report: TagReport[];
    durationInFrames: number;
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
    const generated = generateSchema(lottie);
    for (const e of generated.errors) problems.push(`Element "${el.slug}": ${e.message}`);
    const durationInFrames = Number(lottie.op) - Number(lottie.ip);
    prepared.push({ ...el, lottie, params: generated.params, fonts: generated.fonts, report: generated.report, durationInFrames });
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
    elementMetas.push({ slug: el.slug, name: el.name, startFrame, endFrame, zIndex: el.zIndex ?? i, durationInFrames: el.durationInFrames, fonts: el.fonts });
  });
  const durationInFrames = elementMetas.reduce((max, e) => Math.max(max, e.endFrame), 0);

  const fonts: string[] = [];
  for (const el of prepared) for (const f of el.fonts) if (!fonts.includes(f)) fonts.push(f);

  const meta: TemplateMeta = { slug, name, adType, durationInFrames, fps, width, height, fonts, fontFiles: [], elements: elementMetas };
  for (const field of ['durationInFrames', 'fps', 'width', 'height'] as const) {
    const v = meta[field];
    if (!Number.isFinite(v) || v <= 0) problems.push(`Template ${field} is ${String(v)}; it must be a positive number`);
  }

  // 5. Every referenced font must have a file. Fonts in the handover get copied in.
  const fontDirs = [path.join(handoverDir, 'fonts'), ...prepared.map((el) => path.join(el.folder, 'fonts'))];
  const fontCopies: Array<{ from: string; to: string }> = [];
  const fontSources: Array<{ family: string; from: string }> = [];
  const styleOf = (family: string): string | undefined => {
    for (const el of prepared) {
      const list = ((el.lottie.fonts as { list?: { fFamily?: string; fStyle?: string }[] } | undefined)?.list) ?? [];
      const hit = list.find((f) => f.fFamily === family);
      if (hit?.fStyle) return hit.fStyle;
    }
    return undefined;
  };
  for (const family of fonts) {
    const inApp = findFontFile(family, [fontsDir], styleOf(family));
    if (inApp) {
      fontSources.push({ family, from: inApp });
      continue;
    }
    const inHandover = findFontFile(family, fontDirs, styleOf(family));
    if (inHandover) {
      fontCopies.push({ from: inHandover, to: path.join(fontsDir, path.basename(inHandover)) });
      fontSources.push({ family, from: inHandover });
      continue;
    }
    const users = prepared.filter((el) => el.fonts.includes(family)).map((el) => `"${el.slug}"`).join(', ');
    problems.push(
      `Font "${family}" (used by element ${users}) is not present in ${fontsDir} and no matching file was handed over in a fonts/ folder. ` +
        `Missing fonts silently reflow text, so the template is rejected. Hand over the font file with the template.`,
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
    log(`Copied font ${path.basename(from)} -> ${fontsDir}`);
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
    written.push({ ...elementMetas[i]!, dir: elDir, params: el.params, report: el.report });
    log(`Wrote element "${el.slug}" (${el.params.length} param(s), frames ${elementMetas[i]!.startFrame}-${elementMetas[i]!.endFrame}) -> ${elDir}`);
  });

  // SPEC 8: ship the font files alongside the template.
  fs.rmSync(path.join(dir, 'fonts'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  for (const { family, from } of fontSources) {
    const file = path.basename(from);
    fs.copyFileSync(from, path.join(dir, 'fonts', file));
    meta.fontFiles.push({ family, file });
  }
  if (fontSources.length > 0) log(`Shipped ${fontSources.length} font file(s) -> ${path.join(dir, 'fonts')}`);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  log(`Wrote meta.json -> ${dir}`);

  // 7. Thumbnail: the whole timeline at its middle frame, through the same composition.
  const thumbPath = path.join(dir, 'thumb.png');
  const thumbFonts = meta.fontFiles.map(({ family, file }) => {
    const bytes = fs.readFileSync(path.join(dir, 'fonts', file));
    const ext = path.extname(file).toLowerCase().slice(1);
    const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'otf' ? 'font/otf' : 'font/ttf';
    return { family, url: `data:${mime};base64,${bytes.toString('base64')}` };
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
  });
  for (const e of elementMetas) {
    db.upsertTemplateElement({ templateId, slug: e.slug, name: e.name, zIndex: e.zIndex, startFrame: e.startFrame, endFrame: e.endFrame });
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
function discoverElements(input: string, templateSlug: string, templateName: string): { handoverDir: string; elements: DiscoveredElement[] } {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new IngestFailure([`Input not found: ${resolved}`], []);

  const single = (jsonPath: string, folder: string): DiscoveredElement => ({ slug: templateSlug, name: templateName, folder, jsonPath });

  if (fs.statSync(resolved).isFile()) {
    return { handoverDir: path.dirname(resolved), elements: [single(resolved, path.dirname(resolved))] };
  }

  const ownJson = exportJsonIn(resolved);
  if (ownJson) return { handoverDir: resolved, elements: [single(ownJson, resolved)] };

  const manifestFile = path.join(resolved, 'elements.json');
  const problems: string[] = [];
  const elements: DiscoveredElement[] = [];

  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ElementManifestEntry[];
    if (!Array.isArray(manifest) || manifest.length === 0) throw new IngestFailure([`${manifestFile} must be a non-empty list of { folder, slug?, name?, startFrame?, zIndex? }`], []);
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
      elements.push({
        slug: elSlug,
        name: entry.name?.trim() || elementNameFromSlug(elSlug),
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
      elements.push({ slug: elSlug, name: elementNameFromSlug(elSlug), folder: path.join(resolved, f), jsonPath });
    }
  }

  if (problems.length > 0) throw new IngestFailure(problems, []);
  if (elements.length === 0) {
    throw new IngestFailure([`No Bodymovin JSON found in ${resolved}: expected data.json, or one sub-folder per element each holding an export`], []);
  }
  return { handoverDir: resolved, elements };
}
