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
