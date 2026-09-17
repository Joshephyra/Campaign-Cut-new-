import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * tools/ae-preflight/preflight.jsx runs inside After Effects (ExtendScript,
 * ES3). Its report logic is isolated from the After Effects globals so it
 * can be exercised here against a fake comp. The real run inside After
 * Effects is a manual test (MILESTONES M15).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(here, '..', '..', 'ae-preflight', 'preflight.jsx');

type FakeProperty = { name: string; matchName: string; numProperties?: number; property?: (i: number) => FakeProperty; enabled?: boolean };
type FakeLayer = {
  name: string;
  index: number;
  kind: 'text' | 'shape' | 'av' | 'camera' | 'light' | 'null';
  threeDLayer?: boolean;
  blendingMode?: string;
  timeRemapEnabled?: boolean;
  motionBlur?: boolean;
  adjustmentLayer?: boolean;
  effects?: { name: string; matchName: string }[];
  text?: { font: string; fontSize: number; text: string; boxText?: boolean };
  fill?: boolean;
  stroke?: boolean;
};

/** Build the small subset of the After Effects object model the script touches. */
function fakeComp(name: string, layers: FakeLayer[], settings = { width: 1920, height: 1080, frameRate: 30, duration: 5 }) {
  const layerObjects = layers.map((l) => ({
    name: l.name,
    index: l.index,
    threeDLayer: l.threeDLayer ?? false,
    blendingMode: l.blendingMode ?? 'NORMAL',
    timeRemapEnabled: l.timeRemapEnabled ?? false,
    motionBlur: l.motionBlur ?? false,
    adjustmentLayer: l.adjustmentLayer ?? false,
    __kind: l.kind,
    __text: l.text,
    __fill: l.fill ?? false,
    __stroke: l.stroke ?? false,
    __effects: l.effects ?? [],
  }));
  return { name, ...settings, numLayers: layerObjects.length, layer: (i: number) => layerObjects[i - 1] };
}

/** Adapters the script uses instead of touching After Effects classes directly. */
const env = {
  isTextLayer: (l: { __kind: string }) => l.__kind === 'text',
  isShapeLayer: (l: { __kind: string }) => l.__kind === 'shape',
  isCameraOrLight: (l: { __kind: string }) => l.__kind === 'camera' || l.__kind === 'light',
  blendModeName: (l: { blendingMode: string }) => l.blendingMode,
  effectsOf: (l: { __effects: { name: string; matchName: string }[] }) => l.__effects,
  textDocumentOf: (l: { __text?: { font: string; fontSize: number; text: string; boxText?: boolean } }) => l.__text ?? null,
  hasFillOrStroke: (l: { __fill: boolean; __stroke: boolean }) => l.__fill || l.__stroke,
};

function loadScript() {
  const src = fs.readFileSync(scriptPath, 'utf8');
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(`${src}\n;globalThis.__api = CC_PREFLIGHT;`, sandbox);
  return sandbox.__api as {
    parseTag: (name: string) => { tag: string; role: string; index: number | null } | null;
    buildReport: (comp: unknown, env: unknown) => { text: string; tags: { layer: string; status: string }[]; problems: string[]; fonts: string[] };
  };
}

describe('preflight.jsx is ES3-safe ExtendScript', () => {
  const src = fs.readFileSync(scriptPath, 'utf8');
  it('uses no syntax After Effects cannot run', () => {
    expect(src).not.toMatch(/\bconst\b|\blet\b|=>|`|\bclass\b/);
    expect(src).not.toMatch(/\bJSON\.\w+/); // ExtendScript has no JSON object
    expect(src).not.toMatch(/\.forEach\(|\.map\(|\.filter\(|\.indexOf\(/); // ES5 array methods are absent
  });
  it('does not export or change anything: no render queue, no file writes except the report', () => {
    expect(src).not.toMatch(/renderQueue|\.render\(|saveAs|\.save\(/);
  });
});

describe('preflight report', () => {
  const api = loadScript();

  it('parses tags the same way the ingest tool does', () => {
    expect(api.parseTag('cc.headline')).toEqual({ tag: 'cc.headline', role: 'headline', index: null });
    expect(api.parseTag('cc.stat.2')).toEqual({ tag: 'cc.stat.2', role: 'stat', index: 2 });
    expect(api.parseTag('cc.safe.disclaimer')).toEqual({ tag: 'cc.safe.disclaimer', role: 'safe.disclaimer', index: null });
    expect(api.parseTag('Shape Layer 1')).toBeNull();
    expect(api.parseTag('CC.headline')).toBeNull();
  });

  it('reports comp settings, every tag with its resolved role, and referenced fonts', () => {
    const comp = fakeComp('Contrast 30', [
      { name: 'cc.headline', index: 1, kind: 'text', text: { font: 'IBMPlexSans-Bold', fontSize: 88, text: 'HEADLINE', boxText: true } },
      { name: 'cc.accent', index: 2, kind: 'shape', fill: true },
      { name: 'cc.stat.1', index: 3, kind: 'text', text: { font: 'IBMPlexMono-Regular', fontSize: 40, text: '42%' } },
      { name: 'bg-sweep', index: 4, kind: 'shape', fill: true },
    ]);
    const r = api.buildReport(comp, env);
    expect(r.text).toContain('Comp: Contrast 30');
    expect(r.text).toContain('1920 x 1080');
    expect(r.text).toContain('30 fps');
    expect(r.text).toContain('5.00 s');
    expect(r.tags.map((t) => `${t.layer} -> ${t.status}`)).toEqual(['cc.headline -> text', 'cc.accent -> color', 'cc.stat.1 -> text']);
    expect(r.fonts).toEqual(['IBMPlexSans-Bold', 'IBMPlexMono-Regular']);
    expect(r.problems).toEqual([]);
    expect(r.text).toContain('Fonts referenced');
  });

  it('flags text layers that look editable but are untagged', () => {
    const comp = fakeComp('c', [{ name: 'Title', index: 1, kind: 'text', text: { font: 'Arial', fontSize: 60, text: 'Vote' } }]);
    const r = api.buildReport(comp, env);
    expect(r.text).toMatch(/untagged text layer.*"Title"/i);
  });

  it('names layers with unsupported effects, blend modes, 3D, time remap, motion blur and adjustment layers, and cameras or lights', () => {
    const comp = fakeComp('c', [
      { name: 'glow-title', index: 1, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' }, effects: [{ name: 'Glow', matchName: 'ADBE Glo2' }] },
      { name: 'multiply-bg', index: 2, kind: 'shape', fill: true, blendingMode: 'MULTIPLY' },
      { name: 'cube', index: 3, kind: 'shape', fill: true, threeDLayer: true },
      { name: 'Camera 1', index: 4, kind: 'camera' },
      { name: 'remapped', index: 5, kind: 'av', timeRemapEnabled: true },
      { name: 'blurry', index: 6, kind: 'shape', fill: true, motionBlur: true },
      { name: 'adjust', index: 7, kind: 'av', adjustmentLayer: true, effects: [{ name: 'Gaussian Blur', matchName: 'ADBE Gaussian Blur 2' }] },
    ]);
    const r = api.buildReport(comp, env);
    const text = r.text;
    expect(text).toMatch(/"glow-title".*effect.*Glow/i);
    expect(text).toMatch(/"multiply-bg".*blend mode MULTIPLY/i);
    expect(text).toMatch(/"cube".*3D/i);
    expect(text).toMatch(/"Camera 1".*camera/i);
    expect(text).toMatch(/"remapped".*time remap/i);
    expect(text).toMatch(/"blurry".*motion blur/i);
    expect(text).toMatch(/"adjust".*adjustment layer/i);
  });

  it('flags tagging mistakes the ingest would reject: unknown roles, wrong layer types, missing fills, duplicates', () => {
    const comp = fakeComp('c', [
      { name: 'cc.tagline', index: 1, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } },
      { name: 'cc.accent', index: 2, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } },
      { name: 'cc.surface', index: 3, kind: 'shape', fill: false },
      { name: 'cc.headline', index: 4, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } },
      { name: 'cc.headline', index: 5, kind: 'text', text: { font: 'A', fontSize: 1, text: 'y' } },
      { name: 'cc.Headline', index: 6, kind: 'text', text: { font: 'A', fontSize: 1, text: 'z' } },
    ]);
    const r = api.buildReport(comp, env);
    expect(r.problems.join('\n')).toMatch(/"cc.tagline".*unknown role/i);
    expect(r.problems.join('\n')).toMatch(/"cc.accent".*not a shape layer/i);
    expect(r.problems.join('\n')).toMatch(/"cc.surface".*no fill or stroke/i);
    expect(r.problems.join('\n')).toMatch(/"cc.headline".*duplicate/i);
    expect(r.problems.join('\n')).toMatch(/"cc.Headline".*unknown role/i);
    expect(r.text).toMatch(/PROBLEMS \(5\)/);
  });

  it('M57: numbered lines of a headline are not a problem; a stat without an index still is', () => {
    const r = api.buildReport(fakeComp('c', [
      { name: 'cc.headline.1', index: 1, kind: 'text', text: { font: 'A', fontSize: 1, text: 'AYUDA' } },
      { name: 'cc.headline.2', index: 2, kind: 'text', text: { font: 'A', fontSize: 1, text: 'A LOS' } },
      { name: 'cc.stat', index: 3, kind: 'text', text: { font: 'A', fontSize: 1, text: '1' } },
    ]), env);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/"cc.stat".*needs an index/);
    expect(r.text).toMatch(/cc.headline.1/);
    expect(r.text).toMatch(/cc.headline.2/);
  });

  it('M58: cc.image.N is a photo slot on an image layer, never on text', () => {
    const r = api.buildReport(fakeComp('c', [
      { name: 'cc.image.1', index: 1, kind: 'av' },
      { name: 'cc.image.2', index: 2, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } },
    ]), env);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/"cc.image.2".*not an image/);
    expect(r.text).toMatch(/cc.image.1\s+image/);
  });

  it('M60: a plate or underline on a shape layer follows its text; one on a text layer or without a text is named', () => {
    const r = api.buildReport(fakeComp('c', [
      { name: 'cc.headline.1.plate', index: 1, kind: 'shape', fill: true },
      { name: 'cc.headline.1', index: 2, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } },
      { name: 'cc.headline.1.underline', index: 3, kind: 'shape', fill: false, stroke: true },
      { name: 'cc.headline.2.plate', index: 4, kind: 'text', text: { font: 'A', fontSize: 1, text: 'y' } },
      { name: 'cc.headline.3.plate', index: 5, kind: 'shape', fill: true },
    ]), env);
    expect(r.text).toMatch(/cc.headline.1.plate\s+follow\s+follows cc.headline.1/);
    expect(r.problems).toHaveLength(2);
    expect(r.problems[0]).toMatch(/"cc.headline.2.plate".*must be a shape layer or an image layer/);
    expect(r.problems[1]).toMatch(/"cc.headline.3.plate".*follows cc.headline.3, but no text layer carries that tag/);
  });

  it('ends with a clear verdict line', () => {
    const clean = api.buildReport(fakeComp('c', [{ name: 'cc.headline', index: 1, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } }]), env);
    expect(clean.text).toMatch(/READY TO EXPORT/);
    const bad = api.buildReport(fakeComp('c', [{ name: 'cc.nope', index: 1, kind: 'text', text: { font: 'A', fontSize: 1, text: 'x' } }]), env);
    expect(bad.text).toMatch(/FIX BEFORE EXPORTING/);
  });
});
