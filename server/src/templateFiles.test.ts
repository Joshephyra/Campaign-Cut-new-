import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { elementDir, elementLottieUrl, loadElementFiles } from './templateFiles';

/**
 * M17: a template's elements live under templates/<slug>/elements/<element>/.
 * Templates ingested before M17 keep template.json and schema.json at the
 * template root with one element whose slug equals the template's; both
 * runners resolve files through these helpers so neither guesses a path.
 */
describe('template element files', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-tf-'));
    fs.mkdirSync(path.join(tmp, 't', 'elements', 'a'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 't', 'elements', 'a', 'template.json'), JSON.stringify({ nm: 'a', layers: [] }));
    fs.writeFileSync(path.join(tmp, 't', 'elements', 'a', 'schema.json'), JSON.stringify([{ key: 'headline' }]));
    fs.mkdirSync(path.join(tmp, 'legacy'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'legacy', 'template.json'), JSON.stringify({ nm: 'legacy', layers: [] }));
    fs.writeFileSync(path.join(tmp, 'legacy', 'schema.json'), '[]');
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('resolves an element to elements/<slug>/ and its Lottie URL to match', () => {
    expect(elementDir(tmp, 't', 'a')).toBe(path.join(tmp, 't', 'elements', 'a'));
    expect(elementLottieUrl(tmp, 't', 'a')).toBe('/templates/t/elements/a/template.json');
    expect(loadElementFiles(tmp, 't', 'a')).toEqual({ lottie: { nm: 'a', layers: [] }, schema: [{ key: 'headline' }] });
  });

  it('falls back to the template root for a pre-M17 single-element template', () => {
    expect(elementDir(tmp, 'legacy', 'legacy')).toBe(path.join(tmp, 'legacy'));
    expect(elementLottieUrl(tmp, 'legacy', 'legacy')).toBe('/templates/legacy/template.json');
    expect(loadElementFiles(tmp, 'legacy', 'legacy').lottie).toEqual({ nm: 'legacy', layers: [] });
  });

  it('throws naming the template and element when the files are missing', () => {
    expect(() => loadElementFiles(tmp, 't', 'nope')).toThrow(/t.*nope/);
  });
});
