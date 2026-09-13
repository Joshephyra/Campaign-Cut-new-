import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * tools/ae-preflight/dump.jsx runs inside After Effects (ExtendScript, ES3)
 * and writes the whole project out as text and JSON. Like preflight.jsx its
 * walker takes a small "env" of adapters instead of touching After Effects
 * classes, so it can run here against a fake project. The real run inside
 * After Effects is a manual test (MILESTONES M16).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(here, '..', '..', 'ae-preflight', 'dump.jsx');

type Ease = { speed: number; influence: number };
type Key = { t: number; v: unknown; in?: string; out?: string; easeIn?: Ease[]; easeOut?: Ease[] };
type FakeProp = {
  propertyType: 'PROPERTY' | 'NAMED_GROUP' | 'INDEXED_GROUP';
  matchName: string;
  name: string;
  enabled: boolean;
  isModified: boolean;
  value?: unknown;
  numKeys: number;
  keyTime: (k: number) => number;
  keyValue: (k: number) => unknown;
  keyInInterpolationType: (k: number) => string;
  keyOutInterpolationType: (k: number) => string;
  keyInTemporalEase: (k: number) => Ease[];
  keyOutTemporalEase: (k: number) => Ease[];
  canSetExpression: boolean;
  expression: string;
  expressionEnabled: boolean;
  numProperties: number;
  property: (i: number) => FakeProp;
};

function prop(matchName: string, name: string, value: unknown, opts: { keys?: Key[]; expression?: string; expressionEnabled?: boolean; modified?: boolean; enabled?: boolean } = {}): FakeProp {
  const keys = opts.keys ?? [];
  return {
    propertyType: 'PROPERTY',
    matchName,
    name,
    enabled: opts.enabled ?? true,
    isModified: opts.modified ?? (keys.length > 0 || !!opts.expression),
    value,
    numKeys: keys.length,
    keyTime: (k) => keys[k - 1]!.t,
    keyValue: (k) => keys[k - 1]!.v,
    keyInInterpolationType: (k) => keys[k - 1]!.in ?? 'LINEAR',
    keyOutInterpolationType: (k) => keys[k - 1]!.out ?? 'LINEAR',
    keyInTemporalEase: (k) => keys[k - 1]!.easeIn ?? [{ speed: 0, influence: 16.67 }],
    keyOutTemporalEase: (k) => keys[k - 1]!.easeOut ?? [{ speed: 0, influence: 16.67 }],
    canSetExpression: true,
    expression: opts.expression ?? '',
    expressionEnabled: opts.expressionEnabled ?? !!opts.expression,
    numProperties: 0,
    property: () => {
      throw new Error('leaf');
    },
  };
}

function group(matchName: string, name: string, children: FakeProp[], type: 'NAMED_GROUP' | 'INDEXED_GROUP' = 'NAMED_GROUP', enabled = true): FakeProp {
  return {
    propertyType: type,
    matchName,
    name,
    enabled,
    isModified: false,
    numKeys: 0,
    keyTime: () => 0,
    keyValue: () => null,
    keyInInterpolationType: () => 'LINEAR',
    keyOutInterpolationType: () => 'LINEAR',
    keyInTemporalEase: () => [],
    keyOutTemporalEase: () => [],
    canSetExpression: false,
    expression: '',
    expressionEnabled: false,
    numProperties: children.length,
    property: (i) => children[i - 1]!,
  };
}

type FakeLayer = {
  __kind: 'text' | 'shape' | 'footage' | 'precomp' | 'solid' | 'null' | 'camera' | 'light';
  __matte?: string;
  name: string;
  index: number;
  enabled: boolean;
  solo: boolean;
  shy: boolean;
  guideLayer: boolean;
  locked: boolean;
  inPoint: number;
  outPoint: number;
  startTime: number;
  stretch: number;
  parent: FakeLayer | null;
  blendingMode: string;
  threeDLayer: boolean;
  motionBlur: boolean;
  adjustmentLayer: boolean;
  timeRemapEnabled: boolean;
  hasTrackMatte: boolean;
  isTrackMatte: boolean;
  source: { name: string; id: number } | null;
  numProperties: number;
  property: (i: number) => FakeProp;
};

function transform(position: unknown = [960, 540], extra: FakeProp[] = []) {
  return group('ADBE Transform Group', 'Transform', [
    prop('ADBE Anchor Point', 'Anchor Point', [0, 0], { modified: false }),
    prop('ADBE Position', 'Position', position, { modified: true }),
    prop('ADBE Scale', 'Scale', [100, 100], { modified: false }),
    prop('ADBE Rotate Z', 'Rotation', 0, { modified: false }),
    prop('ADBE Opacity', 'Opacity', 100, { modified: false }),
    ...extra,
  ]);
}

function layer(kind: FakeLayer['__kind'], name: string, index: number, groups: FakeProp[], o: Partial<FakeLayer> = {}): FakeLayer {
  return {
    __kind: kind,
    name,
    index,
    enabled: true,
    solo: false,
    shy: false,
    guideLayer: false,
    locked: false,
    inPoint: 0,
    outPoint: 5,
    startTime: 0,
    stretch: 100,
    parent: null,
    blendingMode: 'NORMAL',
    threeDLayer: false,
    motionBlur: false,
    adjustmentLayer: false,
    timeRemapEnabled: false,
    hasTrackMatte: false,
    isTrackMatte: false,
    source: null,
    numProperties: groups.length,
    property: (i) => groups[i - 1]!,
    ...o,
  };
}

type FakeItem = {
  __kind: 'comp' | 'footage' | 'solid' | 'folder';
  __path?: string;
  __color?: number[];
  id: number;
  name: string;
  parentFolder: { name: string } | null;
  width?: number;
  height?: number;
  duration?: number;
  frameRate?: number;
  pixelAspect?: number;
  hasVideo?: boolean;
  hasAudio?: boolean;
  bgColor?: number[];
  numLayers?: number;
  layer?: (i: number) => FakeLayer;
};

function comp(id: number, name: string, layers: FakeLayer[], settings: Partial<FakeItem> = {}): FakeItem {
  return {
    __kind: 'comp',
    id,
    name,
    parentFolder: null,
    width: 1920,
    height: 1080,
    duration: 5,
    frameRate: 30,
    pixelAspect: 1,
    bgColor: [0, 0, 0],
    numLayers: layers.length,
    layer: (i) => layers[i - 1]!,
    ...settings,
  };
}

function project(items: FakeItem[], activeCompName: string | null = null) {
  return { __active: activeCompName, numItems: items.length, item: (i: number) => items[i - 1]! };
}

const env = {
  appVersion: () => '24.6.0 (fake)',
  projectPath: () => 'C:/ads/contrast.aep',
  activeCompName: (p: { __active: string | null }) => p.__active,
  itemKind: (i: FakeItem) => i.__kind,
  footagePath: (i: FakeItem) => i.__path ?? null,
  solidColor: (i: FakeItem) => i.__color ?? null,
  layerKind: (l: FakeLayer) => l.__kind,
  blendModeName: (l: FakeLayer) => l.blendingMode,
  trackMatteName: (l: FakeLayer) => l.__matte ?? 'NO_TRACK_MATTE',
  propertyTypeName: (p: FakeProp) => p.propertyType,
  interpolationName: (t: string) => t,
  describeValue: (v: unknown) => v,
};

type Dump = {
  project: {
    file: string | null;
    appVersion: string;
    activeComp: string | null;
    items: Record<string, unknown>[];
    comps: {
      name: string;
      layers: Record<string, unknown>[];
      summary: { layers: number; keyframes: number; expressions: number; effects: number; masks: number; flags: Record<string, number> };
      expressions: { layer: string; property: string; expression: string; enabled: boolean }[];
    }[];
  };
  text: string;
  json: string;
};

function loadScript() {
  const src = fs.readFileSync(scriptPath, 'utf8');
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(`${src}\n;globalThis.__api = CC_DUMP;`, sandbox);
  return sandbox.__api as {
    buildDump: (project: unknown, env: unknown) => Dump;
    toJson: (value: unknown, indent?: string) => string;
    formatValue: (value: unknown) => string;
  };
}

describe('dump.jsx is ES3-safe ExtendScript', () => {
  const src = fs.readFileSync(scriptPath, 'utf8');
  it('uses no syntax After Effects cannot run', () => {
    expect(src).not.toMatch(/\bconst\b|\blet\b|=>|`|\bclass\b/);
    expect(src).not.toMatch(/\bJSON\.\w+/);
    expect(src).not.toMatch(/\.forEach\(|\.map\(|\.filter\(|\.indexOf\(|Array\.isArray/);
  });
  it('never renders, saves, or changes the project', () => {
    expect(src).not.toMatch(/renderQueue|\.render\(|saveAs|\.save\(|setValue|addProperty|\.remove\(/);
  });
});

describe('JSON writer', () => {
  const api = loadScript();
  it('round-trips nested values and escapes strings the way JSON.parse expects', () => {
    const value = {
      name: 'He said "hi"\nand left\ttab \\ slash',
      accent: 'Sénat – 東京',
      n: 1.5,
      nan: NaN,
      list: [1, 'two', null, true, [3]],
      nested: { empty: {}, emptyList: [] },
    };
    const text = api.toJson(value);
    expect(JSON.parse(text)).toEqual({ ...value, nan: null });
    expect(text).not.toMatch(/[^\x00-\x7f]/); // non-ASCII is \u-escaped so any editor can open the file
  });
});

describe('project dump', () => {
  const api = loadScript();

  const pos = prop('ADBE Position', 'Position', [960, 540], {
    keys: [
      { t: 0.5, v: [960, 700], in: 'LINEAR', out: 'BEZIER', easeOut: [{ speed: 0, influence: 75 }] },
      { t: 1, v: [960, 540], in: 'BEZIER', out: 'LINEAR', easeIn: [{ speed: 0, influence: 75 }] },
    ],
  });
  const scale = prop('ADBE Scale', 'Scale', [100, 100], { expression: 'wiggle(2, 10)', expressionEnabled: false });
  const headlineTransform = group('ADBE Transform Group', 'Transform', [
    prop('ADBE Anchor Point', 'Anchor Point', [0, 0], { modified: false }),
    pos,
    scale,
    prop('ADBE Opacity', 'Opacity', 100, { expression: 'loopOut("cycle")', expressionEnabled: true }),
  ]);
  const headline = layer(
    'text',
    'cc.headline',
    1,
    [
      group('ADBE Text Properties', 'Text', [
        prop('ADBE Text Document', 'Source Text', { font: 'IBMPlexSans-Bold', fontSize: 88, text: 'HEADLINE', boxText: true, tracking: -20, leading: 96, justification: 'LEFT' }, {
          keys: [
            { t: 0, v: { font: 'IBMPlexSans-Bold', fontSize: 88, text: 'HEADLINE', boxText: true }, in: 'HOLD', out: 'HOLD' },
            { t: 2, v: { font: 'IBMPlexSans-Bold', fontSize: 88, text: 'SECOND', boxText: true }, in: 'HOLD', out: 'HOLD' },
          ],
        }),
        group('ADBE Text Animators', 'Animators', [group('ADBE Text Animator', 'Animator 1', [group('ADBE Text Animator Properties', 'Properties', [prop('ADBE Text Opacity', 'Opacity', 0, { modified: true })])], 'INDEXED_GROUP')], 'INDEXED_GROUP'),
      ]),
      headlineTransform,
    ],
    { inPoint: 0.5, outPoint: 4.5, startTime: 0.5 },
  );

  const accent = layer(
    'shape',
    'cc.accent',
    2,
    [
      group('ADBE Root Vectors Group', 'Contents', [
        group('ADBE Vector Group', 'Bar', [
          group('ADBE Vectors Group', 'Contents', [
            prop('ADBE Vector Shape - Rect', 'Rectangle Path 1', { vertices: 4, closed: true }, { modified: true }),
            group('ADBE Vector Graphic - Fill', 'Fill 1', [prop('ADBE Vector Fill Color', 'Color', [0.94, 0.35, 0.16, 1], { modified: true })]),
            group('ADBE Vector Graphic - Stroke', 'Stroke 1', [prop('ADBE Vector Stroke Width', 'Stroke Width', 4, { modified: true })]),
            group('ADBE Vector Filter - Trim', 'Trim Paths 1', [prop('ADBE Vector Trim End', 'End', 100, { keys: [{ t: 0, v: 0 }, { t: 1, v: 100 }] })]),
          ], 'INDEXED_GROUP'),
        ]),
      ], 'INDEXED_GROUP'),
      group('ADBE Mask Parade', 'Masks', [
        group('ADBE Mask Atom', 'Mask 1', [
          prop('ADBE Mask Shape', 'Mask Path', { vertices: 6, closed: true }, { modified: true }),
          prop('ADBE Mask Feather', 'Mask Feather', [12, 12], { modified: true }),
          prop('ADBE Mask Offset', 'Mask Expansion', 0, { modified: false }),
        ], 'INDEXED_GROUP'),
      ], 'INDEXED_GROUP'),
      group('ADBE Effect Parade', 'Effects', [
        group('ADBE Gaussian Blur 2', 'Gaussian Blur', [prop('ADBE Gaussian Blur 2-0001', 'Blurriness', 8, { modified: true }), prop('ADBE Gaussian Blur 2-0002', 'Blur Dimensions', 1, { modified: false })], 'INDEXED_GROUP'),
      ], 'INDEXED_GROUP'),
      transform(),
    ],
    { parent: headline, blendingMode: 'MULTIPLY', threeDLayer: true, motionBlur: true, __matte: 'ALPHA', hasTrackMatte: true },
  );

  const footage = layer('footage', 'cc.logo', 3, [transform()], { source: { name: 'logo.png', id: 3 }, shy: true, timeRemapEnabled: true });
  const precomp = layer('precomp', 'Lower third', 4, [transform()], { source: { name: 'Lower third', id: 2 }, enabled: false, solo: true });
  const camera = layer('camera', 'Camera 1', 5, [transform()]);
  const adjust = layer('solid', 'adjust', 6, [transform()], { adjustmentLayer: true, source: { name: 'Black Solid 1', id: 4 } });

  const main = comp(1, 'Contrast 30', [headline, accent, footage, precomp, camera, adjust]);
  const lower = comp(2, 'Lower third', [layer('shape', 'bar', 1, [transform()])], { duration: 2.5, parentFolder: { name: 'precomps' } });
  const items: FakeItem[] = [
    main,
    lower,
    { __kind: 'footage', __path: 'C:/ads/assets/logo.png', id: 3, name: 'logo.png', parentFolder: { name: 'assets' }, width: 512, height: 512, duration: 0, hasVideo: true, hasAudio: false },
    { __kind: 'solid', __color: [0, 0, 0], id: 4, name: 'Black Solid 1', parentFolder: { name: 'Solids' }, width: 1920, height: 1080, duration: 0 },
    { __kind: 'folder', id: 5, name: 'assets', parentFolder: null },
  ];
  const dump = api.buildDump(project(items, 'Contrast 30'), env);

  it('records the project, app version, active comp and every item with its settings', () => {
    expect(dump.project.file).toBe('C:/ads/contrast.aep');
    expect(dump.project.appVersion).toBe('24.6.0 (fake)');
    expect(dump.project.activeComp).toBe('Contrast 30');
    expect(dump.project.items).toHaveLength(5);
    expect(dump.project.items[0]).toMatchObject({ kind: 'comp', id: 1, name: 'Contrast 30', width: 1920, height: 1080, frameRate: 30, duration: 5, bgColor: '#000000' });
    expect(dump.project.items[1]).toMatchObject({ kind: 'comp', name: 'Lower third', folder: 'precomps', duration: 2.5 });
    expect(dump.project.items[2]).toMatchObject({ kind: 'footage', name: 'logo.png', file: 'C:/ads/assets/logo.png', width: 512, height: 512, hasAudio: false, folder: 'assets' });
    expect(dump.project.items[3]).toMatchObject({ kind: 'solid', name: 'Black Solid 1', color: '#000000' });
    expect(dump.project.items[4]).toMatchObject({ kind: 'folder', name: 'assets' });
    expect(dump.text).toContain('Project: C:/ads/contrast.aep');
    expect(dump.text).toMatch(/\[3\] footage "logo.png"\s+\(in assets\)\s+512 x 512\s+C:\/ads\/assets\/logo.png/);
  });

  it('dumps every comp with its layers, flags, timing, parent, matte and source', () => {
    expect(dump.project.comps.map((c) => c.name)).toEqual(['Contrast 30', 'Lower third']);
    const [c] = dump.project.comps;
    expect(c!.layers).toHaveLength(6);
    expect(c!.layers[0]).toMatchObject({ index: 1, name: 'cc.headline', kind: 'text', inPoint: 0.5, outPoint: 4.5, startTime: 0.5, stretch: 100, parent: null, blendMode: 'NORMAL' });
    expect(c!.layers[1]).toMatchObject({ index: 2, name: 'cc.accent', kind: 'shape', parent: 'cc.headline', blendMode: 'MULTIPLY', threeD: true, motionBlur: true, trackMatte: 'ALPHA' });
    expect(c!.layers[2]).toMatchObject({ kind: 'footage', source: 'logo.png', shy: true, timeRemap: true });
    expect(c!.layers[3]).toMatchObject({ kind: 'precomp', source: 'Lower third', enabled: false, solo: true });
    expect(c!.layers[4]).toMatchObject({ kind: 'camera' });
    expect(c!.layers[5]).toMatchObject({ kind: 'solid', adjustmentLayer: true });
    expect(dump.text).toMatch(/\[2\] shape "cc.accent".*parent "cc.headline".*blend MULTIPLY.*3D.*motion blur.*matte ALPHA/);
    expect(dump.text).toMatch(/\[4\] precomp "Lower third" -> comp "Lower third".*hidden.*solo/);
  });

  it('dumps the property tree with static values, keyframes, interpolation, ease and expressions', () => {
    const [c] = dump.project.comps;
    const groups = c!.layers[0]!.groups as Record<string, unknown>[];
    const tf = groups.find((g) => g.matchName === 'ADBE Transform Group')!;
    const props = tf.properties as Record<string, unknown>[];
    const position = props.find((p) => p.matchName === 'ADBE Position')!;
    expect(position).toMatchObject({ name: 'Position', value: [960, 540], modified: true });
    expect(position.keys).toEqual([
      { time: 0.5, value: [960, 700], in: 'LINEAR', out: 'BEZIER', easeIn: [{ speed: 0, influence: 16.67 }], easeOut: [{ speed: 0, influence: 75 }] },
      { time: 1, value: [960, 540], in: 'BEZIER', out: 'LINEAR', easeIn: [{ speed: 0, influence: 75 }], easeOut: [{ speed: 0, influence: 16.67 }] },
    ]);
    const scaleP = props.find((p) => p.matchName === 'ADBE Scale')!;
    expect(scaleP).toMatchObject({ expression: 'wiggle(2, 10)', expressionEnabled: false });
    const opacity = props.find((p) => p.matchName === 'ADBE Opacity')!;
    expect(opacity).toMatchObject({ expression: 'loopOut("cycle")', expressionEnabled: true });
    // Unmodified statics are kept in the JSON but left out of the readable text.
    expect(props.find((p) => p.matchName === 'ADBE Anchor Point')).toMatchObject({ modified: false });
    expect(dump.text).toMatch(/Position: \[960, 540\]\s+2 keys/);
    expect(dump.text).toMatch(/0\.500s \[960, 700\] LINEAR\/BEZIER out\(speed 0, influence 75\)/);
    expect(dump.text).toMatch(/Scale: \[100, 100\]\s+expression \(DISABLED\): wiggle\(2, 10\)/);
    expect(dump.text).toMatch(/Opacity: 100\s+expression: loopOut\("cycle"\)/);
    expect(dump.text).not.toMatch(/Anchor Point: \[0, 0\]/);
  });

  it('dumps text documents and animators', () => {
    const [c] = dump.project.comps;
    const groups = c!.layers[0]!.groups as Record<string, unknown>[];
    const text = groups.find((g) => g.matchName === 'ADBE Text Properties')!;
    const doc = (text.properties as Record<string, unknown>[]).find((p) => p.matchName === 'ADBE Text Document')!;
    expect(doc.value).toMatchObject({ font: 'IBMPlexSans-Bold', fontSize: 88, text: 'HEADLINE', boxText: true, tracking: -20 });
    expect((doc.keys as unknown[]).length).toBe(2);
    expect(dump.text).toMatch(/Source Text: "HEADLINE" IBMPlexSans-Bold 88px box tracking -20 leading 96 LEFT\s+2 keys/);
    expect(dump.text).toMatch(/2\.000s "SECOND" IBMPlexSans-Bold 88px box HOLD\/HOLD/);
    expect(dump.text).toMatch(/Animator 1/);
  });

  it('dumps shape contents, masks and effects with their parameters', () => {
    expect(dump.text).toMatch(/Rectangle Path 1: path\(4 vertices, closed\)/);
    expect(dump.text).toMatch(/Fill 1[\s\S]*Color: #F05929/);
    expect(dump.text).toMatch(/Stroke 1[\s\S]*Stroke Width: 4/);
    expect(dump.text).toMatch(/Trim Paths 1[\s\S]*End: 100\s+2 keys/);
    expect(dump.text).toMatch(/Mask 1[\s\S]*Mask Path: path\(6 vertices, closed\)[\s\S]*Mask Feather: \[12, 12\]/);
    expect(dump.text).toMatch(/Gaussian Blur \(ADBE Gaussian Blur 2\)[\s\S]*Blurriness: 8/);
  });

  it('summarises each comp and lists every expression by layer and property path', () => {
    const [c, lower3] = dump.project.comps;
    expect(c!.summary).toEqual({
      layers: 6,
      keyframes: 6,
      expressions: 2,
      effects: 1,
      masks: 1,
      flags: { threeD: 1, blendModes: 1, timeRemap: 1, motionBlur: 1, adjustmentLayers: 1, camerasOrLights: 1, trackMattes: 1, precomps: 1 },
    });
    expect(c!.expressions).toEqual([
      { layer: 'cc.headline', property: 'Transform > Scale', expression: 'wiggle(2, 10)', enabled: false },
      { layer: 'cc.headline', property: 'Transform > Opacity', expression: 'loopOut("cycle")', enabled: true },
    ]);
    expect(lower3!.summary.keyframes).toBe(0);
    expect(dump.text).toMatch(/SUMMARY: 6 layers, 6 keyframes, 2 expressions, 1 effect, 1 mask/);
    expect(dump.text).toMatch(/EXPRESSIONS \(2\)[\s\S]*"cc.headline" > Transform > Opacity: loopOut\("cycle"\)/);
    expect(dump.text).toMatch(/EFFECTS \(1\)[\s\S]*"cc.accent": Gaussian Blur \(ADBE Gaussian Blur 2\)/);
  });

  it('serialises the same structure to JSON', () => {
    const parsed = JSON.parse(dump.json);
    expect(parsed.comps[0].layers[1].name).toBe('cc.accent');
    expect(parsed.items).toHaveLength(5);
  });
});
