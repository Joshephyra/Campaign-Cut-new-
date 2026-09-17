/// <reference lib="dom" />
// The composition runs in a browser (Player) and in headless Chrome
// (renderMedia); the server and ingest programs merely import its types.
import { useEffect, useState, type ReactNode } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';

/**
 * A font face the template needs: the family name lottie-web will ask for,
 * the style Bodymovin recorded for it ("Regular", "Bold", "Bold Italic"...),
 * and where to fetch the file. One entry per family AND style (M27): a
 * family shipped as one file renders every weight with that file.
 */
export type TemplateFont = { family: string; style?: string; url: string };

/** What ingest writes into meta.json: family, style and the file shipped under templates/<slug>/fonts/. */
export type TemplateFontFile = {
  family: string;
  style?: string;
  file: string;
  /** M31: the template the file belongs to, when it is not the spot's own (an added library element). */
  templateSlug?: string;
};

function formatFor(url: string): string {
  if (url.startsWith('data:')) {
    const mime = url.slice(5, url.indexOf(';')).toLowerCase();
    if (mime.includes('woff2')) return 'woff2';
    if (mime.includes('woff')) return 'woff';
    if (mime.includes('otf') || mime.includes('opentype')) return 'opentype';
    return 'truetype';
  }
  const ext = url.toLowerCase().split('?')[0]!.split('.').pop();
  switch (ext) {
    case 'woff2':
      return 'woff2';
    case 'woff':
      return 'woff';
    case 'otf':
      return 'opentype';
    default:
      return 'truetype';
  }
}

const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The CSS weight and style a Bodymovin fStyle maps to. Mirrors lottie-web's
 * own reading of fStyle (getFontProperties), so the @font-face we declare
 * is the face lottie-web asks for.
 */
export function faceFor(style: string | undefined): { weight: string; fontStyle: string } {
  let weight = '400';
  let fontStyle = 'normal';
  for (const word of (style ?? '').split(' ')) {
    switch (word.toLowerCase()) {
      case 'italic':
      case 'oblique':
        fontStyle = 'italic';
        break;
      case 'bold':
        weight = '700';
        break;
      case 'black':
        weight = '900';
        break;
      case 'medium':
        weight = '500';
        break;
      case 'regular':
      case 'normal':
        weight = '400';
        break;
      case 'light':
      case 'thin':
        weight = '200';
        break;
      default:
        break;
    }
  }
  return { weight, fontStyle };
}

/** One @font-face per font face. The family name must equal the Lottie's fFamily. */
export function fontFaceCss(fonts: TemplateFont[]): string {
  return fonts
    .map((f) => {
      const face = faceFor(f.style);
      return `@font-face { font-family: ${quote(f.family)}; font-weight: ${face.weight}; font-style: ${face.fontStyle}; src: url(${quote(f.url)}) format("${formatFor(f.url)}"); font-display: block; }`;
    })
    .join('\n');
}

/** Meta font files -> URLs for a runner ('/api' in the Player, the server origin for export). */
export function fontsFor(files: TemplateFontFile[] | undefined, slug: string, baseUrl: string): TemplateFont[] {
  if (!files || files.length === 0) return [];
  return files.map((f) => ({ family: f.family, style: f.style, url: `${baseUrl}/templates/${f.templateSlug ?? slug}/fonts/${f.file}` }));
}

/** The `document.fonts.load` spec for a face: "italic 700 1em Family". Exported for the app's stills (M38). */
export function fontLoadSpec(f: TemplateFont): string {
  const face = faceFor(f.style);
  return `${face.fontStyle} ${face.weight} 1em ${quote(f.family)}`;
}

/**
 * Loads the template's fonts and holds the first frame until they are ready
 * (SPEC.md section 8: wait for document.fonts before the first render).
 * Both runners honour delayRender, so preview and export wait the same way.
 * Without this, text would draw in a fallback font and reflow later, which
 * is exactly the subtle breakage SPEC 8 warns about.
 *
 * M38: the children (the elements) mount only once the faces are ready.
 * lottie-web measures every character when it builds a text layer and
 * keeps those widths; an element mounted before its face loaded keeps the
 * fallback font's widths for good and draws the right glyphs at the wrong
 * spacing (found by the starter pack: Arial Narrow at frame 0 came out
 * spaced like Arial). Holding the frame was not enough; holding the mount is.
 */
export function TemplateFonts({ fonts, children }: { fonts: TemplateFont[]; children?: ReactNode }) {
  const css = fontFaceCss(fonts);
  const [handle] = useState(() => (fonts.length > 0 ? delayRender(`Loading ${fonts.length} template font(s)`) : null));
  const [ready, setReady] = useState(fonts.length === 0);

  useEffect(() => {
    if (handle === null) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    Promise.all(fonts.map((f) => document.fonts.load(fontLoadSpec(f))))
      .then(() => document.fonts.ready)
      .then(() => {
        setReady(true);
        finish();
      })
      .catch((err: unknown) => cancelRender(err instanceof Error ? err : new Error(`Font load failed: ${String(err)}`)));
    return finish;
    // The component is keyed on its URL list by Main, so fonts never change under a mounted instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return (
    <>
      {fonts.length > 0 && <style data-template-fonts="">{css}</style>}
      {ready ? children : null}
    </>
  );
}
