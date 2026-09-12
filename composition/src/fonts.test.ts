import { describe, expect, it } from 'vitest';
import { fontFaceCss, fontsFor, type TemplateFont } from './fonts';

describe('fontFaceCss', () => {
  it('writes one @font-face per font with the family name lottie-web will ask for', () => {
    const css = fontFaceCss([
      { family: 'IBM Plex Sans', url: 'http://127.0.0.1:3001/templates/standin/fonts/IBMPlexSans-Regular.ttf' },
      { family: 'IBM Plex Mono', url: '/api/templates/standin/fonts/IBMPlexMono-Regular.woff2' },
    ]);
    expect(css).toContain(`font-family: "IBM Plex Sans"`);
    expect(css).toContain(`url("http://127.0.0.1:3001/templates/standin/fonts/IBMPlexSans-Regular.ttf") format("truetype")`);
    expect(css).toContain(`url("/api/templates/standin/fonts/IBMPlexMono-Regular.woff2") format("woff2")`);
    expect(css.match(/@font-face/g)).toHaveLength(2);
  });

  it('escapes quotes in family names and is empty for no fonts', () => {
    expect(fontFaceCss([])).toBe('');
    expect(fontFaceCss([{ family: 'Weird "Name"', url: '/x.otf' }])).toContain(`font-family: "Weird \\"Name\\""`);
  });
});

describe('fontsFor', () => {
  it('turns the meta font files into absolute URLs for a runner', () => {
    const files = [{ family: 'IBM Plex Sans', file: 'IBMPlexSans-Regular.ttf' }];
    const preview: TemplateFont[] = fontsFor(files, 'standin', '/api');
    const exported: TemplateFont[] = fontsFor(files, 'standin', 'http://127.0.0.1:3001');
    expect(preview).toEqual([{ family: 'IBM Plex Sans', url: '/api/templates/standin/fonts/IBMPlexSans-Regular.ttf' }]);
    expect(exported).toEqual([{ family: 'IBM Plex Sans', url: 'http://127.0.0.1:3001/templates/standin/fonts/IBMPlexSans-Regular.ttf' }]);
  });

  it('handles a missing or empty list', () => {
    expect(fontsFor(undefined, 'x', '/api')).toEqual([]);
    expect(fontsFor([], 'x', '/api')).toEqual([]);
  });
});
