import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER_MIN_SECONDS, ELEMENT_TYPES } from '@campaigncut/composition';
import { ROLES } from './roles';
import { parseTag } from './tags';

/**
 * M38: tools/ae-preflight/starter-pack.jsx builds the starter element pack
 * inside After Effects: one comp per element, every type the library
 * knows, so a spot can be assembled from the picker before a designer has
 * handed anything over. Its PLAN is plain data, checked here against the
 * ingest's own rules so the pack ingests first time.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(here, '..', '..', 'ae-preflight', 'starter-pack.jsx');

type Layer = { kind: 'shape' | 'solid' | 'text' | 'image'; name: string; font?: string; box?: [number, number]; text?: string; rect?: number[]; opacity?: number };
type Comp = { slug: string; name: string; type: string; folder: string; seconds: number; layers: Layer[] };
type Plan = {
  width: number;
  height: number;
  fps: number;
  folderName: string;
  name: string;
  adType: string;
  fonts: { from: string; to: string }[];
  comps: Comp[];
  masterName: string;
};

function load() {
  const src = fs.readFileSync(scriptPath, 'utf8');
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(`${src}\n;globalThis.__api = CC_PACK;`, sandbox);
  return sandbox.__api as { PLAN: Plan; manifestJson: () => string; exportConfigJsx: (root: string) => string; masterSeconds: () => number };
}

describe('starter-pack.jsx is ES3-safe ExtendScript', () => {
  const src = fs.readFileSync(scriptPath, 'utf8');
  it('uses no syntax After Effects cannot run', () => {
    expect(src).not.toMatch(/\bconst\b|\blet\b|=>|`|\bclass\b/);
    expect(src).not.toMatch(/\bJSON\.\w+/);
    expect(src).not.toMatch(/\.forEach\(|\.map\(|\.filter\(|\.indexOf\(|Array\.isArray/);
  });
  it('never renders: aerender renders the reference afterwards', () => {
    expect(src).not.toMatch(/renderQueue|\.render\(/);
  });
  it('quits After Effects when run unattended and never pops up', () => {
    expect(src).toMatch(/\$\.__ccQuiet/);
    expect(src).toMatch(/app\.quit\(\)/);
  });
});

describe('the starter pack plan obeys the ingest rules', () => {
  const { PLAN, manifestJson, exportConfigJsx, masterSeconds } = load();

  it('is 1920x1080 at 30 fps, named for the library', () => {
    expect([PLAN.width, PLAN.height, PLAN.fps]).toEqual([1920, 1080, 30]);
    expect(PLAN.folderName).toBe('starter-pack');
    expect(PLAN.name).toBe('Starter pack');
  });

  it('has at least eighteen elements covering every library type', () => {
    expect(PLAN.comps.length).toBeGreaterThanOrEqual(18);
    const types = new Set(PLAN.comps.map((c) => c.type));
    for (const type of ELEMENT_TYPES) expect(types.has(type), `no element of type ${type}`).toBe(true);
    for (const c of PLAN.comps) expect((ELEMENT_TYPES as readonly string[]).includes(c.type), `${c.slug}: type ${c.type}`).toBe(true);
  });

  it('gives every element a unique slug and a numbered folder in order', () => {
    const slugs = PLAN.comps.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const folders = PLAN.comps.map((c) => c.folder);
    expect(new Set(folders).size).toBe(folders.length);
    folders.forEach((f, i) => expect(f, `folder ${i}`).toMatch(new RegExp(`^${String(i + 1).padStart(2, '0')}-`)));
  });

  it('tags only known roles, on the layer type each role needs, once per comp, and every comp has a tag', () => {
    for (const comp of PLAN.comps) {
      const seen = new Set<string>();
      for (const layer of comp.layers) {
        const tag = parseTag(layer.name);
        if (!tag) continue;
        const spec = ROLES[tag.role];
        expect(spec, `${comp.slug}: ${layer.name}`).toBeTruthy();
        if (spec!.repeated) expect(tag.index, `${layer.name} needs an index`).toBeTypeOf('number');
        else expect(tag.index, `${layer.name} must not have an index`).toBeUndefined();
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

  it('gives text elements editable copy and colour elements a role the style panel can recolour', () => {
    for (const comp of PLAN.comps) {
      const tags = comp.layers.map((l) => l.name).filter((n) => n.startsWith('cc.'));
      if (['headline', 'lower-third', 'caption', 'callout', 'stat', 'end-card', 'disclaimer'].includes(comp.type)) {
        expect(tags.some((t) => /^cc\.(headline|subhead|body|stat\.\d+|safe\.disclaimer)$/.test(t)), `${comp.slug} has no text role`).toBe(true);
      }
      if (comp.type === 'background') expect(tags, `${comp.slug} needs footage or a surface`).toEqual(expect.arrayContaining([expect.stringMatching(/^cc\.(mediaFill|surface)$/)]));
      expect(tags.some((t) => t === 'cc.accent' || t === 'cc.surface'), `${comp.slug} has no colour role`).toBe(true);
    }
  });

  it('adds up to a :30 and a :15 from its standard lengths (M52)', () => {
    const by = (slug: string) => PLAN.comps.find((c) => c.slug === slug)!.seconds;
    expect(by('opening') + by('background-footage') + by('stat-big') + by('quote') + by('end-card-vote')).toBe(30);
    expect(by('opening-short') + by('background-footage-short') + by('background-footage-short') + by('end-card-learn')).toBe(15);
    expect(PLAN.comps.filter((c) => c.type === 'open').map((c) => c.seconds).sort()).toEqual([3, 5]);
    expect(PLAN.comps.filter((c) => c.type === 'background').map((c) => c.seconds).sort()).toEqual([4, 6, 6, 6]);
    expect(PLAN.comps.filter((c) => c.type === 'end-card').map((c) => c.seconds).sort()).toEqual([4, 7]);
  });

  it('keeps every disclaimer on screen for the four seconds the rule needs', () => {
    const withDisclaimer = PLAN.comps.filter((c) => c.layers.some((l) => l.name === 'cc.safe.disclaimer'));
    expect(withDisclaimer.length).toBeGreaterThanOrEqual(3);
    for (const c of withDisclaimer) expect(c.seconds, `${c.slug} disclaimer`).toBeGreaterThanOrEqual(DISCLAIMER_MIN_SECONDS);
    expect(PLAN.comps.filter((c) => c.type === 'disclaimer').every((c) => c.layers.some((l) => l.name === 'cc.safe.disclaimer'))).toBe(true);
  });

  it('uses only the fonts it copies, with the style the ingest will look for', () => {
    const fonts = new Set(PLAN.comps.flatMap((c) => c.layers.filter((l) => l.kind === 'text').map((l) => l.font)));
    expect([...fonts].sort()).toEqual(['Arial-BoldMT', 'ArialMT', 'ArialNarrow-Bold']);
    expect(PLAN.fonts.map((f) => f.to).sort()).toEqual(['Arial-Bold.ttf', 'Arial-Regular.ttf', 'ArialNarrow-Bold.ttf']);
  });

  it('gives every text layer a box with room for its own copy, inside the frame', () => {
    for (const comp of PLAN.comps) {
      for (const l of comp.layers) {
        if (l.kind !== 'text') continue;
        const [w, h] = l.box!;
        expect(w * h, `${l.name} box`).toBeGreaterThan(0);
        expect(l.text!.length, `${l.name} copy`).toBeGreaterThan(0);
      }
      for (const l of comp.layers) {
        if (!l.rect) continue;
        const [x, y, w, h] = l.rect as [number, number, number, number];
        expect(x >= 0 && y >= 0 && x + w <= PLAN.width && y + h <= PLAN.height, `${comp.slug}: ${l.name} leaves the frame`).toBe(true);
        if (l.opacity !== undefined) expect(l.opacity > 0 && l.opacity <= 100).toBe(true);
      }
    }
  });

  it('writes an elements.json the ingest accepts: library only, typed, laid end to end, with the background', () => {
    const parsed = JSON.parse(manifestJson()) as { background: string; libraryOnly: boolean; elements: { folder: string; slug: string; name: string; type: string; startFrame?: number; zIndex: number }[] };
    expect(parsed.background).toMatch(/^#[0-9A-F]{6}$/);
    expect(parsed.libraryOnly).toBe(true);
    expect(parsed.elements.map((e) => [e.folder, e.slug, e.name, e.type])).toEqual(PLAN.comps.map((c) => [c.folder, c.slug, c.name, c.type]));
    for (const e of parsed.elements) {
      expect(e.startFrame).toBeUndefined();
      expect(e.zIndex).toBe(0);
    }
  });

  it('lays the master out end to end, exactly as long as the elements together', () => {
    const total = PLAN.comps.reduce((s, c) => s + c.seconds, 0);
    expect(masterSeconds()).toBe(total);
    expect(PLAN.masterName).toContain('reference');
  });

  it('writes an export config naming every comp and its numbered folder, for the unattended exporter', () => {
    const jsx = exportConfigJsx('C:/x/starter-pack');
    expect(jsx).not.toMatch(/\bconst\b|\blet\b|=>|`/);
    expect(jsx).toContain("project: 'C:/x/starter-pack/starter-pack.aep'");
    expect(jsx).toContain("logDir: 'C:/x/starter-pack'");
    for (const c of PLAN.comps) {
      expect(jsx).toContain(`{ comp: '${c.name}', destination: 'C:/x/starter-pack/${c.folder}/data.json' }`);
    }
    const sandbox: Record<string, unknown> = {};
    vm.runInNewContext(`${jsx}\n;globalThis.__cfg = CC_CONFIG;`, sandbox);
    expect((sandbox.__cfg as { exports: unknown[] }).exports).toHaveLength(PLAN.comps.length);
  });
});
