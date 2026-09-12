import type { LottieAnimationData, TemplateParam } from '@campaigncut/composition';
import type { Db } from '@campaigncut/server/db';
import fs from 'node:fs';
import path from 'node:path';
import { findFontFile } from './fonts';
import { generateSchema, type TagReport } from './generateSchema';

/** Every problem found, so the author can fix them all at once. */
export class IngestFailure extends Error {
  constructor(
    public readonly problems: string[],
    public readonly report: TagReport[],
  ) {
    super(problems.join('\n'));
    this.name = 'IngestFailure';
  }
}

export type ThumbnailRenderer = (opts: {
  lottie: LottieAnimationData;
  outputPath: string;
  frame: number;
  /** The shipped fonts as data URIs, so the thumbnail draws real text without a running server. */
  fonts: { family: string; url: string }[];
}) => Promise<void>;

export type IngestOptions = {
  /** A handover folder (with data.json and optional images/ and fonts/) or a path to the Lottie JSON. */
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

export type TemplateMeta = {
  slug: string;
  name: string;
  adType: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  /** Font families referenced by text layers. */
  fonts: string[];
  /** The font file shipped for each family under templates/<slug>/fonts/. */
  fontFiles: { family: string; file: string }[];
};

export type IngestResult = {
  slug: string;
  dir: string;
  params: TemplateParam[];
  fonts: string[];
  report: TagReport[];
  meta: TemplateMeta;
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * One command turns a Bodymovin export into a working editable template.
 * Validates everything first (SPEC.md 1.4) and writes nothing on failure.
 */
export async function ingestTemplate(options: IngestOptions): Promise<IngestResult> {
  const { adType, name, templatesDir, fontsDir, db, renderThumbnail } = options;
  const log = options.log ?? (() => {});
  const slug = options.slug ?? slugify(name);
  const problems: string[] = [];

  // 1. Locate the Lottie and the handover folder around it.
  const { jsonPath, handoverDir } = locateInput(options.input);
  const lottie = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as LottieAnimationData;
  log(`Reading ${jsonPath}`);

  // 2. Tags -> schema. Authoring mistakes come back naming the layer.
  const generated = generateSchema(lottie);
  problems.push(...generated.errors.map((e) => e.message));

  // 3. Meta must be complete and non-zero.
  if (!slug) problems.push('Template name produces an empty slug');
  if (!name.trim()) problems.push('Template name is empty');
  if (!adType.trim()) problems.push('Ad type is empty');
  const meta: TemplateMeta = {
    slug,
    name,
    adType,
    durationInFrames: Number(lottie.op) - Number(lottie.ip),
    fps: Number(lottie.fr),
    width: Number(lottie.w),
    height: Number(lottie.h),
    fonts: generated.fonts,
    fontFiles: [],
  };
  for (const field of ['durationInFrames', 'fps', 'width', 'height'] as const) {
    const v = meta[field];
    if (!Number.isFinite(v) || v <= 0) problems.push(`Template ${field} is ${String(v)}; it must be a positive number`);
  }

  // 4. Every referenced font must have a file. Fonts in the handover get copied in.
  const handoverFonts = path.join(handoverDir, 'fonts');
  const fontCopies: Array<{ from: string; to: string }> = [];
  /** Where each family's file comes from, so it can be shipped with the template. */
  const fontSources: Array<{ family: string; from: string }> = [];
  const styleOf = (family: string): string | undefined => {
    const list = ((lottie.fonts as { list?: { fFamily?: string; fStyle?: string }[] } | undefined)?.list) ?? [];
    return list.find((f) => f.fFamily === family)?.fStyle;
  };
  for (const family of generated.fonts) {
    const inApp = findFontFile(family, [fontsDir], styleOf(family));
    if (inApp) {
      fontSources.push({ family, from: inApp });
      continue;
    }
    const inHandover = findFontFile(family, [handoverFonts], styleOf(family));
    if (inHandover) {
      fontCopies.push({ from: inHandover, to: path.join(fontsDir, path.basename(inHandover)) });
      fontSources.push({ family, from: inHandover });
      continue;
    }
    problems.push(
      `Font "${family}" is not present in ${fontsDir} and no matching file was handed over in ${handoverFonts}. ` +
        `Missing fonts silently reflow text, so the template is rejected. Hand over the font file with the template.`,
    );
  }

  if (problems.length > 0) throw new IngestFailure(problems, generated.report);

  // 5. Everything validated. Now write.
  const dir = path.join(templatesDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });
  for (const { from, to } of fontCopies) {
    fs.copyFileSync(from, to);
    log(`Copied font ${path.basename(from)} -> ${fontsDir}`);
  }

  fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie, null, 2) + '\n');
  const imagesDir = path.join(handoverDir, 'images');
  if (fs.existsSync(imagesDir)) {
    fs.cpSync(imagesDir, path.join(dir, 'images'), { recursive: true });
    log(`Copied images/`);
  }
  // SPEC 8: ship the font files alongside the template.
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  for (const { family, from } of fontSources) {
    const file = path.basename(from);
    fs.copyFileSync(from, path.join(dir, 'fonts', file));
    meta.fontFiles.push({ family, file });
  }
  if (fontSources.length > 0) log(`Shipped ${fontSources.length} font file(s) -> ${path.join(dir, 'fonts')}`);
  fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(generated.params, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  log(`Wrote template.json, schema.json, meta.json -> ${dir}`);

  // 6. Thumbnail from the middle frame, through the same composition.
  const thumbPath = path.join(dir, 'thumb.png');
  const thumbFonts = meta.fontFiles.map(({ family, file }) => {
    const bytes = fs.readFileSync(path.join(dir, 'fonts', file));
    const ext = path.extname(file).toLowerCase().slice(1);
    const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'otf' ? 'font/otf' : 'font/ttf';
    return { family, url: `data:${mime};base64,${bytes.toString('base64')}` };
  });
  // Likewise the template's own images: the thumbnail render has no server to fetch them from.
  await renderThumbnail({ lottie: withEmbeddedImages(lottie, dir), outputPath: thumbPath, frame: Math.floor(meta.durationInFrames / 2), fonts: thumbFonts });
  log(`Wrote thumb.png`);

  // 7. Register. Same slug updates rather than duplicates. A Bodymovin
  //    export is one comp, so it becomes one element spanning the template.
  const { id: templateId } = db.upsertTemplate({
    slug,
    name,
    adType,
    durationFrames: meta.durationInFrames,
    fps: meta.fps,
    width: meta.width,
    height: meta.height,
    thumbPath: path.relative(path.dirname(templatesDir), thumbPath).split(path.sep).join('/'),
  });
  db.upsertTemplateElement({ templateId, slug, zIndex: 0, startFrame: 0, endFrame: meta.durationInFrames });
  log(`Registered "${name}" (${slug}) under ad type "${adType}"`);

  return { slug, dir, params: generated.params, fonts: generated.fonts, report: generated.report, meta };
}

/** A copy of the Lottie with relative image assets embedded as data URIs, for renders that have no server. */
export function withEmbeddedImages(lottie: LottieAnimationData, templateDir: string): LottieAnimationData {
  if (!Array.isArray(lottie.assets)) return lottie;
  const mimeFor = (file: string) => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
  };
  const assets = (lottie.assets as Record<string, unknown>[]).map((a) => {
    if (typeof a.p !== 'string' || a.e === 1 || /^(https?:|data:|\/)/.test(a.p)) return a;
    const dir = typeof a.u === 'string' ? a.u : '';
    const file = path.join(templateDir, dir, a.p);
    if (!fs.existsSync(file)) return a;
    return { ...a, u: '', e: 1, p: `data:${mimeFor(file)};base64,${fs.readFileSync(file).toString('base64')}` };
  });
  return { ...lottie, assets };
}

function locateInput(input: string): { jsonPath: string; handoverDir: string } {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new IngestFailure([`Input not found: ${resolved}`], []);

  if (fs.statSync(resolved).isFile()) {
    return { jsonPath: resolved, handoverDir: path.dirname(resolved) };
  }

  const preferred = path.join(resolved, 'data.json');
  if (fs.existsSync(preferred)) return { jsonPath: preferred, handoverDir: resolved };

  const candidates = fs
    .readdirSync(resolved)
    .filter((f) => f.endsWith('.json') && !['schema.json', 'meta.json'].includes(f));
  if (candidates.length === 0) throw new IngestFailure([`No Bodymovin JSON found in ${resolved}`], []);
  if (candidates.length > 1) {
    throw new IngestFailure([`Several JSON files in ${resolved}; name the export data.json or pass the file path`], []);
  }
  return { jsonPath: path.join(resolved, candidates[0]!), handoverDir: resolved };
}
