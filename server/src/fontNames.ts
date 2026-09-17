import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * M59: read a font file's own names, so a face can be found by what it IS
 * rather than by what its file happens to be called. Windows ships Arial
 * Narrow Bold as ARIALNB.TTF; its name table says "Arial Narrow" / "Bold"
 * (and, typographically, "Arial" / "Narrow Bold", the pair After Effects
 * reports). Both pairs are returned so either spelling matches.
 *
 * Only the sfnt container is read (.ttf, .otf, .ttc): the table directory
 * and the name table, a few kilobytes, never the whole file. WOFF wraps the
 * tables in compression and is left to file-name matching.
 */
export type FontFace = { family: string; style: string };

const SFNT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc']);
export const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.woff', '.woff2']);

/** Every (family, style) pair the file's fonts call themselves. Empty when the file is not an sfnt font. */
export function readFontNames(file: string): FontFace[] {
  if (!SFNT_EXTENSIONS.has(path.extname(file).toLowerCase())) return [];
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return [];
  }
  try {
    const read = (offset: number, length: number): Buffer | null => {
      if (length <= 0 || length > 4 * 1024 * 1024) return null;
      const buf = Buffer.alloc(length);
      const got = fs.readSync(fd, buf, 0, length, offset);
      return got === length ? buf : null;
    };
    const head = read(0, 12);
    if (!head) return [];
    const tag = head.toString('latin1', 0, 4);
    const offsets: number[] = [];
    if (tag === 'ttcf') {
      const n = head.readUInt32BE(8);
      const table = read(12, Math.min(n, 64) * 4);
      if (!table) return [];
      for (let i = 0; i < Math.min(n, 64); i++) offsets.push(table.readUInt32BE(i * 4));
    } else if (head.readUInt32BE(0) === 0x00010000 || tag === 'OTTO' || tag === 'true') {
      offsets.push(0);
    } else {
      return [];
    }
    const out: FontFace[] = [];
    for (const off of offsets) {
      const dirHead = read(off, 12);
      if (!dirHead) continue;
      const numTables = dirHead.readUInt16BE(4);
      const dir = read(off + 12, numTables * 16);
      if (!dir) continue;
      for (let i = 0; i < numTables; i++) {
        if (dir.toString('latin1', i * 16, i * 16 + 4) !== 'name') continue;
        const nameOffset = dir.readUInt32BE(i * 16 + 8);
        const nameLength = dir.readUInt32BE(i * 16 + 12);
        const table = read(nameOffset, nameLength);
        if (table) for (const face of facesFromNameTable(table)) if (!out.some((f) => f.family === face.family && f.style === face.style)) out.push(face);
        break;
      }
    }
    return out;
  } finally {
    fs.closeSync(fd);
  }
}

/** The faces named in one `name` table: the typographic pair (ids 16/17) first, then the legacy pair (1/2). */
export function facesFromNameTable(table: Buffer): FontFace[] {
  if (table.length < 6) return [];
  const count = table.readUInt16BE(2);
  const strings = table.readUInt16BE(4);
  const best = new Map<number, { value: string; score: number }>();
  for (let r = 0; r < count; r++) {
    const rec = 6 + r * 12;
    if (rec + 12 > table.length) break;
    const platform = table.readUInt16BE(rec);
    const encoding = table.readUInt16BE(rec + 2);
    const language = table.readUInt16BE(rec + 4);
    const nameId = table.readUInt16BE(rec + 6);
    const length = table.readUInt16BE(rec + 8);
    const offset = table.readUInt16BE(rec + 10);
    if (![1, 2, 16, 17].includes(nameId)) continue;
    const start = strings + offset;
    if (start + length > table.length) continue;
    let value: string;
    let score: number;
    if (platform === 3 || platform === 0) {
      if (platform === 3 && ![0, 1, 10].includes(encoding)) continue;
      value = utf16be(table.subarray(start, start + length));
      score = platform === 3 && language === 0x409 ? 3 : 2;
    } else if (platform === 1 && encoding === 0) {
      value = table.toString('latin1', start, start + length);
      score = 1;
    } else continue;
    value = value.trim();
    if (!value) continue;
    const current = best.get(nameId);
    if (!current || score > current.score) best.set(nameId, { value, score });
  }
  const out: FontFace[] = [];
  const typographic = best.get(16)?.value;
  if (typographic) out.push({ family: typographic, style: best.get(17)?.value ?? 'Regular' });
  const legacy = best.get(1)?.value;
  if (legacy) {
    const face = { family: legacy, style: best.get(2)?.value ?? 'Regular' };
    if (!out.some((f) => f.family === face.family && f.style === face.style)) out.push(face);
  }
  return out;
}

function utf16be(buf: Buffer): string {
  let s = '';
  for (let i = 0; i + 1 < buf.length; i += 2) s += String.fromCharCode(buf.readUInt16BE(i));
  return s;
}

const normFamily = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
/** "Regular", "Book", "Roman", "Normal" and "Plain" all mean the plain face; "Oblique" is italic. Word order does not matter. */
export function normStyle(s: string): string {
  const words = s
    .toLowerCase()
    .replace(/oblique/g, 'italic')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !['regular', 'normal', 'roman', 'book', 'plain'].includes(w));
  return words.sort().join('');
}

/** Whether a file's face is the family and style asked for, whichever spelling the file uses. */
export function faceMatches(face: FontFace, family: string, style: string): boolean {
  const wantFamily = normFamily(family);
  const wantStyle = normStyle(style || 'Regular');
  if (normFamily(face.family) === wantFamily && normStyle(face.style) === wantStyle) return true;
  // "Arial" + "Narrow Bold" against a file that says "Arial Narrow" + "Bold", and the reverse
  return normFamily(face.family + ' ' + face.style) === normFamily(family + ' ' + style) && normStyle(face.family + ' ' + face.style).includes(wantStyle);
}

/** Where this computer keeps its fonts. */
export function systemFontDirs(): string[] {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return [path.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts'), path.join(process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts')];
    case 'darwin':
      return ['/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts')];
    default:
      return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(home, '.fonts'), path.join(home, '.local', 'share', 'fonts')];
  }
}

/** Font files under a directory, two levels deep (Linux and macOS nest them by family). */
export function fontFilesIn(dir: string, depth = 2): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0) out.push(...fontFilesIn(full, depth - 1));
    } else if (SFNT_EXTENSIONS.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

const cache = new Map<string, { mtime: number; faces: FontFace[] }>();

/** The faces of a file, read once per file version. */
export function cachedFontNames(file: string): FontFace[] {
  let mtime = 0;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return [];
  }
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.faces;
  const faces = readFontNames(file);
  cache.set(file, { mtime, faces });
  return faces;
}

/** The first file in the directories whose own names say it is this family and style. */
export function findFontByName(family: string, style: string, dirs: string[]): string | undefined {
  for (const dir of dirs) {
    for (const file of fontFilesIn(dir)) {
      if (cachedFontNames(file).some((face) => faceMatches(face, family, style))) return file;
    }
  }
  return undefined;
}

/** The file name a face is shipped under: "Arial Narrow" + "Bold" + ".ttf" -> ArialNarrow-Bold.ttf, so file-name lookups find it next time. */
export function fileNameFor(family: string, style: string, ext: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '');
  return `${clean(family) || 'Font'}-${clean(style) || 'Regular'}${ext.startsWith('.') ? ext : `.${ext}`}`;
}

/** M59: what the font library holds, for the app: each file with the face it says it is (or, for WOFF, the face its name says). */
export function listFontLibrary(dir: string): { file: string; family: string; style: string }[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: { file: string; family: string; style: string }[] = [];
  for (const file of entries.sort()) {
    const ext = path.extname(file).toLowerCase();
    if (!FONT_EXTENSIONS.has(ext)) continue;
    const faces = readFontNames(path.join(dir, file));
    if (faces.length > 0) {
      const face = faces[faces.length - 1]!; // the legacy pair reads as people say it: "Arial Narrow" / "Bold"
      out.push({ file, family: face.family, style: face.style });
    } else {
      const stem = path.basename(file, ext);
      const dash = stem.indexOf('-');
      out.push({ file, family: dash > 0 ? stem.slice(0, dash) : stem, style: dash > 0 ? stem.slice(dash + 1) : 'Regular' });
    }
  }
  return out;
}
