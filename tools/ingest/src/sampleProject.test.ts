import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { ROLES } from './roles';
import { parseTag } from './tags';

/**
 * tools/ae-preflight/sample-project.jsx builds the sample "Contrast :30"
 * template inside After Effects. Its PLAN is plain data, checked here
 * against the same rules the ingest applies, so the project it builds
 * ingests first time. The build itself is a manual run.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(here, '..', '..', 'ae-preflight', 'sample-project.jsx');

type Layer = { kind: 'shape' | 'solid' | 'text' | 'image'; name: string; font?: string; box?: [number, number]; text?: string };
type Comp = { slug: string; name: string; folder: string; seconds: number; layers: Layer[] };
type Plan = {
  width: number;
  height: number;
  fps: number;
  folderName: string;
  fonts: { from: string; to: string }[];
  comps: Comp[];
  timeline: { slug: string; startFrame: number; zIndex: number }[];
  masterSeconds: number;
};

function load() {
  const src = fs.readFileSync(scriptPath, 'utf8');
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(`${src}\n;globalThis.__api = CC_SAMPLE;`, sandbox);
  return sandbox.__api as { PLAN: Plan; manifestJson: () => string };
}

describe('sample-project.jsx is ES3-safe ExtendScript', () => {
  const src = fs.readFileSync(scriptPath, 'utf8');
  it('uses no syntax After Effects cannot run', () => {
    expect(src).not.toMatch(/\bconst\b|\blet\b|=>|`|\bclass\b/);
    expect(src).not.toMatch(/\bJSON\.\w+/);
    expect(src).not.toMatch(/\.forEach\(|\.map\(|\.filter\(|\.indexOf\(|Array\.isArray/);
  });
  it('never renders or touches the render queue: the person renders the reference', () => {
    expect(src).not.toMatch(/renderQueue|\.render\(/);
  });
});

describe('the sample plan obeys the ingest rules', () => {
  const { PLAN, manifestJson } = load();

  it('is 1920x1080 at 30 fps with four comps the guide names', () => {
    expect([PLAN.width, PLAN.height, PLAN.fps]).toEqual([1920, 1080, 30]);
    expect(PLAN.comps.map((c) => c.slug)).toEqual(['open', 'lower-third', 'stat', 'end-card']);
    expect(PLAN.comps.map((c) => c.folder)).toEqual(['01-open', '02-lower-third', '03-stat', '04-end-card']);
  });

  it('tags only known roles, on the layer type each role needs, once per comp', () => {
    for (const comp of PLAN.comps) {
      const seen = new Set<string>();
      for (const layer of comp.layers) {
        const tag = parseTag(layer.name);
        if (!tag) continue;
        const spec = ROLES[tag.role];
        expect(spec, `${comp.slug}: ${layer.name}`).toBeTruthy();
        if (spec!.repeated) expect(tag.index, `${layer.name} needs an index`).toBeTypeOf('number');
        else if (!spec!.lines) expect(tag.index, `${layer.name} must not have an index`).toBeUndefined();
        const key = tag.index === undefined ? tag.role : `${tag.role}.${tag.index}`;
        expect(seen.has(key), `${comp.slug}: duplicate ${layer.name}`).toBe(false);
        seen.add(key);
        const kindOk = {
          text: layer.kind === 'text',
          color: layer.kind === 'shape',
          image: layer.kind === 'image',
          media: layer.kind === 'solid' || layer.kind === 'shape',
          transform: false,
        }[spec!.kind];
        expect(kindOk, `${comp.slug}: ${layer.name} is a ${layer.kind} layer`).toBe(true);
      }
      expect(seen.size, `${comp.slug} has no tags`).toBeGreaterThan(0);
    }
  });

  it('covers every role at least once across the spot, including the locked disclaimer and two stats', () => {
    const tags = PLAN.comps.flatMap((c) => c.layers.map((l) => l.name)).filter((n) => n.startsWith('cc.'));
    for (const role of ['cc.headline', 'cc.subhead', 'cc.body', 'cc.stat.1', 'cc.stat.2', 'cc.accent', 'cc.surface', 'cc.logo', 'cc.mediaFill', 'cc.safe.disclaimer']) {
      expect(tags, role).toContain(role);
    }
  });

  it('uses only the two fonts it copies, with the style the ingest will look for', () => {
    const fonts = new Set(PLAN.comps.flatMap((c) => c.layers.filter((l) => l.kind === 'text').map((l) => l.font)));
    expect([...fonts].sort()).toEqual(['Arial-BoldMT', 'ArialMT']);
    expect(PLAN.fonts.map((f) => f.to)).toEqual(['Arial-Regular.ttf', 'Arial-Bold.ttf']);
  });

  it('lays the comps out in order inside the master, ending before it does', () => {
    const fps = PLAN.fps;
    let previous = -1;
    for (const t of PLAN.timeline) {
      const comp = PLAN.comps.find((c) => c.slug === t.slug)!;
      expect(comp).toBeTruthy();
      expect(t.startFrame).toBeGreaterThan(previous);
      previous = t.startFrame;
      expect(t.startFrame + comp.seconds * fps).toBeLessThanOrEqual(PLAN.masterSeconds * fps);
    }
    expect(PLAN.timeline.map((t) => t.slug)).toEqual(PLAN.comps.map((c) => c.slug));
  });

  it('writes an elements.json the ingest accepts, carrying the comp background colour', () => {
    const parsed = JSON.parse(manifestJson()) as { background: string; elements: { folder: string; slug: string; name: string; startFrame: number; zIndex: number }[] };
    expect(parsed.background).toBe('#0F1729');
    const manifest = parsed.elements;
    expect(manifest).toEqual([
      { folder: '01-open', slug: 'open', name: 'Open', startFrame: 0, zIndex: 0 },
      { folder: '02-lower-third', slug: 'lower-third', name: 'Lower third', startFrame: 90, zIndex: 1 },
      { folder: '03-stat', slug: 'stat', name: 'Stat callout', startFrame: 300, zIndex: 0 },
      { folder: '04-end-card', slug: 'end-card', name: 'End card', startFrame: 750, zIndex: 0 },
    ]);
  });

  it('gives every text layer a box wide enough for its own copy at its size', () => {
    for (const comp of PLAN.comps) {
      for (const l of comp.layers) {
        if (l.kind !== 'text') continue;
        const [w, h] = l.box!;
        expect(w * h, `${l.name} box`).toBeGreaterThan(0);
        expect(l.text!.length, `${l.name} copy`).toBeGreaterThan(0);
      }
    }
  });
});
