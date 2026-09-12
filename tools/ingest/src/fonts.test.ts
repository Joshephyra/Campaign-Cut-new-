import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findFontFile, normalizeFontName } from './fonts';

describe('normalizeFontName', () => {
  it('lower-cases and strips spaces, hyphens and underscores', () => {
    expect(normalizeFontName('IBM Plex Sans')).toBe('ibmplexsans');
    expect(normalizeFontName('IBMPlexSans-Regular.ttf')).toBe('ibmplexsansregular.ttf');
  });
});

describe('findFontFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fonts-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('matches a family to a file whose name starts with the family', () => {
    fs.writeFileSync(path.join(dir, 'IBMPlexSans-Regular.ttf'), 'x');
    fs.writeFileSync(path.join(dir, 'IBMPlexMono-Regular.ttf'), 'x');
    expect(path.basename(findFontFile('IBM Plex Sans', [dir])!)).toBe('IBMPlexSans-Regular.ttf');
    expect(path.basename(findFontFile('IBM Plex Mono', [dir])!)).toBe('IBMPlexMono-Regular.ttf');
  });

  it('accepts otf, ttf, woff and woff2', () => {
    fs.writeFileSync(path.join(dir, 'Inter-Regular.woff2'), 'x');
    expect(findFontFile('Inter', [dir])).toBeTruthy();
  });

  it('returns undefined when nothing matches', () => {
    fs.writeFileSync(path.join(dir, 'IBMPlexSans-Regular.ttf'), 'x');
    expect(findFontFile('Arial', [dir])).toBeUndefined();
  });

  it('searches directories in order and ignores missing ones', () => {
    fs.writeFileSync(path.join(dir, 'Arial.ttf'), 'x');
    expect(findFontFile('Arial', [path.join(dir, 'does-not-exist'), dir])).toBeTruthy();
  });
});

describe('findFontFile: style preference', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fonts-style-'));
    for (const f of ['IBMPlexSans-Bold.ttf', 'IBMPlexSans-Regular.ttf', 'IBMPlexSans-Italic.ttf']) fs.writeFileSync(path.join(dir, f), 'x');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prefers the file matching the requested style', () => {
    expect(path.basename(findFontFile('IBM Plex Sans', [dir], 'Bold')!)).toBe('IBMPlexSans-Bold.ttf');
    expect(path.basename(findFontFile('IBM Plex Sans', [dir], 'Regular')!)).toBe('IBMPlexSans-Regular.ttf');
  });

  it('falls back to Regular when no style is given or the style has no file', () => {
    expect(path.basename(findFontFile('IBM Plex Sans', [dir])!)).toBe('IBMPlexSans-Regular.ttf');
    expect(path.basename(findFontFile('IBM Plex Sans', [dir], 'Black')!)).toBe('IBMPlexSans-Regular.ttf');
  });
});
