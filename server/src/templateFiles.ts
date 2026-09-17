import { aspectKey, isAspect, type LottieAnimationData, type TemplateFontFile, type TemplateParam } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Where a template element's files live. Since M17 every element has its
 * own directory, templates/<slug>/elements/<element>/, holding template.json
 * (the Lottie), schema.json and images/. Templates ingested before M17 kept
 * those files at the template root with one element whose slug equals the
 * template's; that layout is still readable. Both runners come through
 * here so neither ever guesses a path.
 *
 * M36: for a ratio other than 16:9, a designer variant may live under
 * variants/<9x16>/ beside the element; when it exists it is the element's
 * files for that ratio, else the master's are used (and auto-fitted).
 */
function masterDir(templatesDir: string, templateSlug: string, elementSlug: string): string {
  const own = path.join(templatesDir, templateSlug, 'elements', elementSlug);
  if (fs.existsSync(path.join(own, 'template.json'))) return own;
  return path.join(templatesDir, templateSlug);
}

/** True when a designer variant exists for this ratio. */
export function hasVariant(templatesDir: string, templateSlug: string, elementSlug: string, aspect: string): boolean {
  if (!isAspect(aspect) || aspect === '16:9') return false;
  return fs.existsSync(path.join(templatesDir, templateSlug, 'elements', elementSlug, 'variants', aspectKey(aspect), 'template.json'));
}

export function elementDir(templatesDir: string, templateSlug: string, elementSlug: string, aspect = '16:9'): string {
  if (hasVariant(templatesDir, templateSlug, elementSlug, aspect) && isAspect(aspect)) {
    return path.join(templatesDir, templateSlug, 'elements', elementSlug, 'variants', aspectKey(aspect));
  }
  return masterDir(templatesDir, templateSlug, elementSlug);
}

/** The server-relative URL of the element's Lottie, e.g. /templates/t/elements/open/template.json. */
export function elementLottieUrl(templatesDir: string, templateSlug: string, elementSlug: string, aspect = '16:9'): string {
  const dir = elementDir(templatesDir, templateSlug, elementSlug, aspect);
  const rel = path.relative(templatesDir, path.join(dir, 'template.json')).split(path.sep).join('/');
  return `/templates/${rel}`;
}

/** The URL base an element's relative image assets resolve against. */
export function elementBaseUrl(templatesDir: string, templateSlug: string, elementSlug: string, aspect = '16:9'): string {
  return elementLottieUrl(templatesDir, templateSlug, elementSlug, aspect).replace(/\/template\.json$/, '');
}

export function loadElementFiles(templatesDir: string, templateSlug: string, elementSlug: string, aspect = '16:9'): { lottie: LottieAnimationData; schema: TemplateParam[] } {
  const dir = elementDir(templatesDir, templateSlug, elementSlug, aspect);
  const lottieFile = path.join(dir, 'template.json');
  if (!fs.existsSync(lottieFile)) {
    throw new Error(`Template "${templateSlug}" has no files for element "${elementSlug}" (looked in ${dir})`);
  }
  const schemaFile = path.join(dir, 'schema.json');
  return {
    lottie: JSON.parse(fs.readFileSync(lottieFile, 'utf8')) as LottieAnimationData,
    schema: fs.existsSync(schemaFile) ? (JSON.parse(fs.readFileSync(schemaFile, 'utf8')) as TemplateParam[]) : [],
  };
}

export function loadElementSchema(templatesDir: string, templateSlug: string, elementSlug: string, aspect = '16:9'): TemplateParam[] {
  const file = path.join(elementDir(templatesDir, templateSlug, elementSlug, aspect), 'schema.json');
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as TemplateParam[]) : [];
}

/** A template's meta.json, or an empty object when it has none. */
export function readTemplateMeta(templatesDir: string, templateSlug: string): { fontFiles?: TemplateFontFile[]; background?: string; [k: string]: unknown } {
  const file = path.join(templatesDir, templateSlug, 'meta.json');
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { fontFiles?: TemplateFontFile[]; background?: string }) : {};
}

/**
 * M31: the font files a spot needs: its own template's, then those of every
 * other template an added element came from, each file tagged with its
 * template so both runners resolve it against the right folder.
 */
export function projectFontFiles(templatesDir: string, templateSlug: string, elements: { templateSlug: string }[]): TemplateFontFile[] {
  const slugs = [templateSlug, ...elements.map((e) => e.templateSlug).filter((s) => s !== templateSlug)];
  const seen = new Set<string>();
  const files: TemplateFontFile[] = [];
  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    for (const f of readTemplateMeta(templatesDir, slug).fontFiles ?? []) files.push({ ...f, templateSlug: slug });
  }
  return files;
}
