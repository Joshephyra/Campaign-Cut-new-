import { fileNameFor } from './fontNames';

/**
 * M59: a face fetched from Google Fonts by family and style, when neither
 * the handover, the font library nor this computer has it. Google's CSS
 * endpoint is asked for exactly the weight and slant the style names; an
 * old browser's user agent makes it answer with plain TTF files, which the
 * composition renders and the name-table reader can read back.
 *
 * Nothing is cached here: the ingest writes the file into the app's fonts
 * folder, and the next ingest finds it there.
 */
export type GoogleFontFile = { fileName: string; bytes: Uint8Array; url: string };
export type GoogleFontFetcher = (family: string, style: string) => Promise<GoogleFontFile | null>;

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;

const OLD_BROWSER = 'Mozilla/5.0 (Linux; U; Android 2.2)';

/** The CSS weight and slant a Bodymovin style names. */
export function googleWeight(style: string): { weight: number; italic: boolean } {
  let weight = 400;
  let italic = false;
  for (const raw of style.toLowerCase().split(/[\s-]+/)) {
    const word = raw.replace(/[^a-z]/g, '');
    switch (word) {
      case 'thin':
      case 'hairline':
        weight = 100;
        break;
      case 'extralight':
      case 'ultralight':
        weight = 200;
        break;
      case 'light':
        weight = 300;
        break;
      case 'regular':
      case 'normal':
      case 'book':
      case 'roman':
        weight = 400;
        break;
      case 'medium':
        weight = 500;
        break;
      case 'semibold':
      case 'demibold':
        weight = 600;
        break;
      case 'bold':
        weight = 700;
        break;
      case 'extrabold':
      case 'ultrabold':
        weight = 800;
        break;
      case 'black':
      case 'heavy':
        weight = 900;
        break;
      case 'italic':
      case 'oblique':
        italic = true;
        break;
      default:
        break;
    }
  }
  return { weight, italic };
}

export function googleCssUrl(family: string, style: string): string {
  const { weight, italic } = googleWeight(style);
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim()).replace(/%20/g, '+')}:ital,wght@${italic ? 1 : 0},${weight}`;
}

/** The @font-face blocks of a Google CSS answer. */
export function parseFontFaces(css: string): { weight: number; italic: boolean; url: string }[] {
  const out: { weight: number; italic: boolean; url: string }[] = [];
  for (const block of css.split('@font-face').slice(1)) {
    const weight = /font-weight:\s*(\d+)/.exec(block);
    const style = /font-style:\s*(\w+)/.exec(block);
    const url = /url\(([^)]+)\)/.exec(block);
    if (!weight || !url) continue;
    out.push({ weight: Number(weight[1]), italic: (style?.[1] ?? 'normal') === 'italic', url: url[1]!.replace(/^['"]|['"]$/g, '') });
  }
  return out;
}

export async function fetchGoogleFontWith(fetchImpl: FetchLike, family: string, style: string): Promise<GoogleFontFile | null> {
  const wanted = googleWeight(style);
  try {
    const css = await fetchImpl(googleCssUrl(family, style), { headers: { 'user-agent': OLD_BROWSER }, signal: AbortSignal.timeout(10000) });
    if (!css.ok) return null;
    const face = parseFontFaces(await css.text()).find((f) => f.weight === wanted.weight && f.italic === wanted.italic);
    if (!face) return null;
    const file = await fetchImpl(face.url, { headers: { 'user-agent': OLD_BROWSER }, signal: AbortSignal.timeout(20000) });
    if (!file.ok) return null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0) return null;
    const ext = /\.(ttf|otf|woff2|woff)(\?|$)/i.exec(face.url)?.[1]?.toLowerCase() ?? 'ttf';
    return { fileName: fileNameFor(family, style, `.${ext}`), bytes, url: face.url };
  } catch {
    return null; // offline, blocked or slow: the ingest says the face was not found and names the places it looked
  }
}

/** The real thing: Node's fetch. */
export const fetchGoogleFont: GoogleFontFetcher = (family, style) => fetchGoogleFontWith(fetch as unknown as FetchLike, family, style);
