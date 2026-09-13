import type { LottieAnimationData, TemplateParam } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Where a template element's files live. Since M17 every element has its
 * own directory, templates/<slug>/elements/<element>/, holding template.json
 * (the Lottie), schema.json and images/. Templates ingested before M17 kept
 * those files at the template root with one element whose slug equals the
 * template's; that layout is still readable. Both runners come through
 * here so neither ever guesses a path.
 */
export function elementDir(templatesDir: string, templateSlug: string, elementSlug: string): string {
  const own = path.join(templatesDir, templateSlug, 'elements', elementSlug);
  if (fs.existsSync(path.join(own, 'template.json'))) return own;
  return path.join(templatesDir, templateSlug);
}

/** The server-relative URL of the element's Lottie, e.g. /templates/t/elements/open/template.json. */
export function elementLottieUrl(templatesDir: string, templateSlug: string, elementSlug: string): string {
  const dir = elementDir(templatesDir, templateSlug, elementSlug);
  const rel = path.relative(templatesDir, path.join(dir, 'template.json')).split(path.sep).join('/');
  return `/templates/${rel}`;
}

/** The URL base an element's relative image assets resolve against. */
export function elementBaseUrl(templatesDir: string, templateSlug: string, elementSlug: string): string {
  return elementLottieUrl(templatesDir, templateSlug, elementSlug).replace(/\/template\.json$/, '');
}

export function loadElementFiles(templatesDir: string, templateSlug: string, elementSlug: string): { lottie: LottieAnimationData; schema: TemplateParam[] } {
  const dir = elementDir(templatesDir, templateSlug, elementSlug);
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

export function loadElementSchema(templatesDir: string, templateSlug: string, elementSlug: string): TemplateParam[] {
  const file = path.join(elementDir(templatesDir, templateSlug, elementSlug), 'schema.json');
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as TemplateParam[]) : [];
}
