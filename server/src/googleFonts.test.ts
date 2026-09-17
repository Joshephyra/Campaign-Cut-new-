import { describe, expect, it } from 'vitest';
import { fetchGoogleFontWith, googleCssUrl, googleWeight, parseFontFaces, type FetchLike } from './googleFonts';

/** M59: a face nobody has on hand is fetched from Google Fonts, exactly the weight and slant asked for, as a TTF. */
const css = (weight: number, style: 'normal' | 'italic', url: string) => `@font-face {\n  font-family: 'Public Sans';\n  font-style: ${style};\n  font-weight: ${weight};\n  src: url(${url}) format('truetype');\n}\n`;

function fakeFetch(answers: Record<string, { status: number; body: string | Uint8Array }>): { fetch: FetchLike; calls: { url: string; ua?: string }[] } {
  const calls: { url: string; ua?: string }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, ua: init?.headers?.['user-agent'] });
    const a = answers[url];
    if (!a) return { ok: false, status: 404, text: async () => 'not found', arrayBuffer: async () => new ArrayBuffer(0) };
    return {
      ok: a.status < 400,
      status: a.status,
      text: async () => (typeof a.body === 'string' ? a.body : ''),
      arrayBuffer: async () => (typeof a.body === 'string' ? new TextEncoder().encode(a.body).buffer : (a.body.buffer as ArrayBuffer)),
    };
  };
  return { fetch, calls };
}

describe('Google Fonts (M59)', () => {
  it('turns a style into a weight and slant, and asks for exactly that', () => {
    expect(googleWeight('Bold')).toEqual({ weight: 700, italic: false });
    expect(googleWeight('Bold Italic')).toEqual({ weight: 700, italic: true });
    expect(googleWeight('Regular')).toEqual({ weight: 400, italic: false });
    expect(googleWeight('SemiBold')).toEqual({ weight: 600, italic: false });
    expect(googleWeight('Black')).toEqual({ weight: 900, italic: false });
    expect(googleCssUrl('Public Sans', 'Bold Italic')).toBe('https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@1,700');
  });

  it('parses the @font-face blocks', () => {
    expect(parseFontFaces(css(700, 'normal', 'https://x/a.ttf') + css(700, 'italic', "'https://x/b.ttf'"))).toEqual([
      { weight: 700, italic: false, url: 'https://x/a.ttf' },
      { weight: 700, italic: true, url: 'https://x/b.ttf' },
    ]);
  });

  it('fetches the face with an old browser user agent (so the answer is TTF) and names the file for the face', async () => {
    const bytes = new Uint8Array([0, 1, 0, 0, 9]);
    const { fetch, calls } = fakeFetch({
      'https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,700': { status: 200, body: css(700, 'normal', 'https://fonts.gstatic.com/s/publicsans/v21/abc.ttf') },
      'https://fonts.gstatic.com/s/publicsans/v21/abc.ttf': { status: 200, body: bytes },
    });
    const got = await fetchGoogleFontWith(fetch, 'Public Sans', 'Bold');
    expect(got).toEqual({ fileName: 'PublicSans-Bold.ttf', bytes, url: 'https://fonts.gstatic.com/s/publicsans/v21/abc.ttf' });
    expect(calls.map((c) => c.ua)).toEqual(['Mozilla/5.0 (Linux; U; Android 2.2)', 'Mozilla/5.0 (Linux; U; Android 2.2)']);
  });

  it('answers null for a family Google does not have, a weight the family lacks, an empty file, or no network', async () => {
    const unknown = fakeFetch({ 'https://fonts.googleapis.com/css2?family=Knockout:ital,wght@0,700': { status: 400, body: '<html>' } });
    expect(await fetchGoogleFontWith(unknown.fetch, 'Knockout', 'Bold')).toBeNull();
    const wrongWeight = fakeFetch({ 'https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,900': { status: 200, body: css(700, 'normal', 'https://x/a.ttf') } });
    expect(await fetchGoogleFontWith(wrongWeight.fetch, 'Public Sans', 'Black')).toBeNull();
    const empty = fakeFetch({ 'https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400': { status: 200, body: css(400, 'normal', 'https://x/a.ttf') }, 'https://x/a.ttf': { status: 200, body: new Uint8Array(0) } });
    expect(await fetchGoogleFontWith(empty.fetch, 'Public Sans', 'Regular')).toBeNull();
    const offline: FetchLike = async () => {
      throw new Error('ENOTFOUND');
    };
    expect(await fetchGoogleFontWith(offline, 'Public Sans', 'Regular')).toBeNull();
  });
});
