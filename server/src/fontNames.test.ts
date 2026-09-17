import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { faceMatches, fileNameFor, findFontByName, listFontLibrary, normStyle, readFontNames } from './fontNames';

/** M59: a face is found by the names inside the file, not by the file's name. */
const here = path.dirname(fileURLToPath(import.meta.url));
const plexBold = path.resolve(here, '..', '..', 'app', 'public', 'fonts', 'IBMPlexSans-Bold.ttf');
const plexRegular = path.resolve(here, '..', '..', 'app', 'public', 'fonts', 'IBMPlexSans-Regular.ttf');

describe('font names (M59)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fontnames-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the family and style out of a TTF, and nothing out of a WOFF or a non-font', () => {
    expect(readFontNames(plexBold)).toEqual([{ family: 'IBM Plex Sans', style: 'Bold' }]);
    fs.writeFileSync(path.join(dir, 'x.woff2'), 'wOF2');
    fs.writeFileSync(path.join(dir, 'y.ttf'), 'not a font at all');
    expect(readFontNames(path.join(dir, 'x.woff2'))).toEqual([]);
    expect(readFontNames(path.join(dir, 'y.ttf'))).toEqual([]);
  });

  it('matches styles by meaning: Regular is Book is Roman, Oblique is Italic, word order is free; a width may sit on either side', () => {
    expect(normStyle('Bold Italic')).toBe(normStyle('Italic Bold'));
    expect(faceMatches({ family: 'IBM Plex Sans', style: 'Regular' }, 'IBM Plex Sans', 'Book')).toBe(true);
    expect(faceMatches({ family: 'Arial', style: 'Bold Oblique' }, 'Arial', 'Bold Italic')).toBe(true);
    expect(faceMatches({ family: 'Arial Narrow', style: 'Bold' }, 'Arial', 'Narrow Bold')).toBe(true);
    expect(faceMatches({ family: 'Arial', style: 'Narrow Bold' }, 'Arial Narrow', 'Bold')).toBe(true);
    expect(faceMatches({ family: 'Arial', style: 'Bold' }, 'Arial Narrow', 'Bold')).toBe(false);
    expect(faceMatches({ family: 'IBM Plex Sans', style: 'Bold' }, 'IBM Plex Sans', 'Regular')).toBe(false);
  });

  it('finds a face in a folder by its inner names whatever the file is called, one level of sub-folders included', () => {
    fs.mkdirSync(path.join(dir, 'ibm'));
    fs.copyFileSync(plexBold, path.join(dir, 'ibm', 'plexb.ttf'));
    fs.copyFileSync(plexRegular, path.join(dir, 'mystery.ttf'));
    expect(findFontByName('IBM Plex Sans', 'Bold', [dir])).toBe(path.join(dir, 'ibm', 'plexb.ttf'));
    expect(findFontByName('IBM Plex Sans', 'Regular', [dir])).toBe(path.join(dir, 'mystery.ttf'));
    expect(findFontByName('IBM Plex Sans', 'Black', [dir])).toBeUndefined();
    expect(findFontByName('IBM Plex Sans', 'Bold', [path.join(dir, 'nowhere')])).toBeUndefined();
  });

  it('names a shipped file for the face, and lists a library by what each file is', () => {
    expect(fileNameFor('Arial Narrow', 'Bold', '.ttf')).toBe('ArialNarrow-Bold.ttf');
    expect(fileNameFor('IBM Plex Sans', '', 'otf')).toBe('IBMPlexSans-Regular.otf');
    fs.copyFileSync(plexBold, path.join(dir, 'plexb.ttf'));
    fs.writeFileSync(path.join(dir, 'PublicSans-Italic.woff2'), 'wOF2');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    expect(listFontLibrary(dir)).toEqual([
      { file: 'PublicSans-Italic.woff2', family: 'PublicSans', style: 'Italic' },
      { file: 'plexb.ttf', family: 'IBM Plex Sans', style: 'Bold' },
    ]);
    expect(listFontLibrary(path.join(dir, 'nowhere'))).toEqual([]);
  });
});
