import fs from 'node:fs';
import path from 'node:path';

const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);

/** "IBM Plex Sans" -> "ibmplexsans". Same treatment for file names. */
export function normalizeFontName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Find a font file for a family by file name: a file whose normalized name
 * starts with the normalized family. Searches the directories in order.
 * Among matches, prefer the one whose name contains the requested style
 * (Bodymovin's fStyle, e.g. "Regular", "Bold"), then a "Regular" file, then
 * the first alphabetically. Deliberately simple; reading name tables out of
 * font binaries is more than a proof of concept needs.
 */
export function findFontFile(family: string, dirs: string[], style?: string): string | undefined {
  const wanted = normalizeFontName(family);
  if (!wanted) return undefined;
  const wantedStyle = style ? normalizeFontName(style) : '';
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const matches = fs
      .readdirSync(dir)
      .sort()
      .filter((file) => FONT_EXTENSIONS.has(path.extname(file).toLowerCase()) && normalizeFontName(file).startsWith(wanted));
    if (matches.length === 0) continue;
    const byStyle = wantedStyle ? matches.find((f) => normalizeFontName(f).slice(wanted.length).includes(wantedStyle)) : undefined;
    const regular = matches.find((f) => normalizeFontName(f).slice(wanted.length).includes('regular'));
    return path.join(dir, byStyle ?? regular ?? matches[0]!);
  }
  return undefined;
}

/**
 * The file name suffixes (after the family) that mean a given style. Foundry
 * names ("Arial-Bold.ttf"), Windows names ("arialbd.ttf") and bare regular
 * files ("arial.ttf") are all common in a handover.
 */
const STYLE_SUFFIXES: Record<string, string[]> = {
  regular: ['', 'regular', 'normal', 'roman', 'book', 'r'],
  bold: ['bold', 'bd', 'b'],
  italic: ['italic', 'it', 'i', 'oblique'],
  bolditalic: ['bolditalic', 'bi', 'z', 'boldoblique'],
};

/**
 * M27: a file for one family AND one style, strictly. "Arial" + "Bold" must
 * be a bold file; a regular file is not an acceptable stand-in, because the
 * browser would fake the weight and the text would no longer match After
 * Effects. Returns undefined when no file carries that style.
 */
export function findFontFileForStyle(family: string, style: string, dirs: string[]): string | undefined {
  const wanted = normalizeFontName(family);
  if (!wanted) return undefined;
  const styleKey = normalizeFontName(style || 'Regular');
  const accepted = STYLE_SUFFIXES[styleKey] ?? [styleKey];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).sort();
    for (const file of files) {
      if (!FONT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      const stem = normalizeFontName(path.basename(file, path.extname(file)));
      if (!stem.startsWith(wanted)) continue;
      const suffix = stem.slice(wanted.length);
      if (accepted.includes(suffix)) return path.join(dir, file);
    }
  }
  return undefined;
}
