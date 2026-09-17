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

describe('font faces by style (M27)', () => {
  it('declares weight and style per face the way lottie-web reads fStyle, so one family can ship several files', () => {
    const css = fontFaceCss([
      { family: 'Arial', style: 'Regular', url: '/api/templates/t/fonts/Arial-Regular.ttf' },
      { family: 'Arial', style: 'Bold', url: '/api/templates/t/fonts/Arial-Bold.ttf' },
      { family: 'Arial', style: 'Bold Italic', url: '/api/templates/t/fonts/Arial-BoldItalic.ttf' },
      { family: 'Inter', style: 'Black', url: '/api/x.ttf' },
      { family: 'Inter', style: 'Light', url: '/api/y.ttf' },
      { family: 'Old', url: '/api/z.ttf' },
    ]);
    const faces = css.split('\n');
    expect(faces[0]).toContain('font-weight: 400; font-style: normal;');
    expect(faces[1]).toContain('font-weight: 700; font-style: normal;');
    expect(faces[2]).toContain('font-weight: 700; font-style: italic;');
    expect(faces[3]).toContain('font-weight: 900;');
    expect(faces[4]).toContain('font-weight: 200;');
    expect(faces[5]).toContain('font-weight: 400; font-style: normal;'); // no style recorded: regular
    expect(css.match(/font-family: "Arial"/g)).toHaveLength(3);
  });

  it('carries the style from meta font files into the runner fonts', () => {
    const files = [
      { family: 'Arial', style: 'Regular', file: 'Arial-Regular.ttf' },
      { family: 'Arial', style: 'Bold', file: 'Arial-Bold.ttf' },
    ];
    expect(fontsFor(files, 'c', '/api')).toEqual([
      { family: 'Arial', style: 'Regular', url: '/api/templates/c/fonts/Arial-Regular.ttf' },
      { family: 'Arial', style: 'Bold', url: '/api/templates/c/fonts/Arial-Bold.ttf' },
    ]);
  });
});
