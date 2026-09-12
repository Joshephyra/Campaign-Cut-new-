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
 * Deliberately simple; reading name tables out of font binaries is more
 * than a proof of concept needs.
 */
export function findFontFile(family: string, dirs: string[]): string | undefined {
  const wanted = normalizeFontName(family);
  if (!wanted) return undefined;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!FONT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      if (normalizeFontName(file).startsWith(wanted)) return path.join(dir, file);
    }
  }
  return undefined;
}
