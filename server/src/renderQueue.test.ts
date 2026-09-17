import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';
import { RenderQueue, type RenderFn } from './renderQueue';

const lottie = { fr: 30, ip: 0, op: 30, w: 1920, h: 1080, layers: [] };

/** A stand-in renderer: reports progress in two steps and writes a small file. */
const fakeRender: RenderFn = async ({ outputPath, onProgress }) => {
  onProgress(0.5);
  await new Promise((r) => setTimeout(r, 20));
  onProgress(1);
  fs.writeFileSync(outputPath, 'MP4');
};

describe('RenderQueue', () => {
  let tmp: string;
  let db: Db;
  let projectId: number;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rq-'));
    fs.mkdirSync(path.join(tmp, 'templates', 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'schema.json'), JSON.stringify([{ key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example Committee', path: '/layers/0', locked: true }])); // M35: an export needs a 4 s disclaimer
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 30, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 150 });
    projectId = db.createProject({ templateId: t.id, name: 'P', values: [] }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const makeQueue = (render: RenderFn = fakeRender) =>
    new RenderQueue({ db, templatesDir: path.join(tmp, 'templates'), rendersDir: path.join(tmp, 'renders'), serverBase: 'http://x', render });

  it('moves a job through queued, rendering, done and records the output', async () => {
    const queue = makeQueue();
    const seen: string[] = [];
    queue.onChange((job) => seen.push(`${job.status}:${job.progress}`));

    const { id } = queue.enqueue(projectId);
    expect(db.getRender(id)!.status).toBe('queued');
    await queue.idle();

    const job = db.getRender(id)!;
    expect(job.status).toBe('done');
    expect(job.progress).toBe(1);
    expect(job.outputPath).toMatch(/^renders\/.*\.mp4$/);
    expect(fs.existsSync(path.join(tmp, job.outputPath))).toBe(true);
    expect(seen[0]).toBe('rendering:0');
    expect(seen.at(-1)).toBe('done:1');
  });

  it('renders one job at a time, in order', async () => {
    const order: number[] = [];
    let running = 0;
    let maxRunning = 0;
    const render: RenderFn = async ({ outputPath, props }) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      order.push(props.elements.length);
      await new Promise((r) => setTimeout(r, 15));
      fs.writeFileSync(outputPath, 'x');
      running--;
    };
    const queue = makeQueue(render);
    const a = queue.enqueue(projectId).id;
    const b = queue.enqueue(projectId).id;
    expect(db.getRender(b)!.status).toBe('queued');
    await queue.idle();
    expect(maxRunning).toBe(1);
    expect(db.getRender(a)!.status).toBe('done');
    expect(db.getRender(b)!.status).toBe('done');
    expect(order).toHaveLength(2);
  });

  it('records a failure with its message and keeps going', async () => {
    let calls = 0;
    const render: RenderFn = async ({ outputPath }) => {
      calls++;
      if (calls === 1) throw new Error('Chrome exploded');
      fs.writeFileSync(outputPath, 'x');
    };
    const queue = makeQueue(render);
    const a = queue.enqueue(projectId).id;
    const b = queue.enqueue(projectId).id;
    await queue.idle();
    expect(db.getRender(a)).toMatchObject({ status: 'failed', error: 'Chrome exploded' });
    expect(db.getRender(b)!.status).toBe('done');
  });

  it('refuses an unknown project', () => {
    expect(() => makeQueue().enqueue(999)).toThrow(/999/);
  });
});

describe('render API', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rapi-'));
    fs.mkdirSync(path.join(tmp, 'templates', 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'schema.json'), JSON.stringify([{ key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example Committee', path: '/layers/0', locked: true }])); // M35: an export needs a 4 s disclaimer
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 30, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 150 });
    app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media'), render: fakeRender, serverBase: 'http://x' });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.renderQueue.idle();
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('POST /render queues a job; GET /render/:id reports progress and then a download URL', async () => {
    const res = await app.inject({ method: 'POST', url: '/render', payload: { projectId } });
    expect(res.statusCode).toBe(202);
    const { id, status } = res.json() as { id: number; status: string };
    expect(status).toBe('queued');

    await vi.waitFor(async () => {
      const poll = (await app.inject({ method: 'GET', url: `/render/${id}` })).json() as { status: string; progress: number; outputUrl: string | null };
      expect(poll.status).toBe('done');
      expect(poll.progress).toBe(1);
      expect(poll.outputUrl).toMatch(/^\/media\/renders\/.*\.mp4$/);
    });

    const file = (await app.inject({ method: 'GET', url: ((await app.inject({ method: 'GET', url: `/render/${id}` })).json() as { outputUrl: string }).outputUrl })).statusCode;
    expect(file).toBe(200);
  });

  it('GET /renders?projectId= lists a project\'s jobs newest first, and unknown ids are 404', async () => {
    await app.inject({ method: 'POST', url: '/render', payload: { projectId } });
    await app.inject({ method: 'POST', url: '/render', payload: { projectId } });
    const list = (await app.inject({ method: 'GET', url: `/renders?projectId=${projectId}` })).json() as { id: number }[];
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBeGreaterThan(list[1]!.id);
    expect((await app.inject({ method: 'GET', url: '/render/999' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/render', payload: { projectId: 999 } })).statusCode).toBe(404);
  });
});


/** M50: a render is of one version. A batch queues one job per version, each with its own frame and file name. */
describe('render versions (M50)', () => {
  let tmp: string;
  let db: Db;
  let projectId: number;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-rv-'));
    fs.mkdirSync(path.join(tmp, 'templates', 't'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'template.json'), JSON.stringify(lottie));
    fs.writeFileSync(path.join(tmp, 'templates', 't', 'schema.json'), JSON.stringify([{ key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example Committee', path: '/layers/0', locked: true }]));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 30, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 't', zIndex: 0, startFrame: 0, endFrame: 150 });
    projectId = db.createProject({ templateId: t.id, name: 'P', values: [] }).id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('a queued job carries its version: the props frame and the file name follow it, not the spot\'s current aspect', async () => {
    const frames: Record<number, { width: number; height: number } | undefined> = {};
    const queue = new RenderQueue({
      db, templatesDir: path.join(tmp, 'templates'), rendersDir: path.join(tmp, 'renders'), serverBase: 'http://x',
      render: async ({ props, outputPath }) => { frames[Number(/^project-\d+-(\d+)/.exec(path.basename(outputPath))![1])] = props.frame; fs.writeFileSync(outputPath, 'x'); },
    });
    const wide = queue.enqueue(projectId).id;
    const tall = queue.enqueue(projectId, '9:16').id;
    expect(db.getRender(wide)!.aspect).toBe('16:9');
    expect(db.getRender(tall)!.aspect).toBe('9:16');
    await queue.idle();
    expect(frames[wide]).toEqual({ width: 1920, height: 1080 });
    expect(frames[tall]).toEqual({ width: 1080, height: 1920 });
    expect(db.getRender(wide)!.outputPath).toBe(`renders/project-${projectId}-${wide}.mp4`);
    expect(db.getRender(tall)!.outputPath).toBe(`renders/project-${projectId}-${tall}-9x16.mp4`);
    expect(db.prepare(`PRAGMA table_info(render)`).all().map((c) => (c as { name: string }).name)).toContain('aspect');
  });

  it('POST /render with aspects queues one job per version and answers them all; a bad aspect is refused', async () => {
    const app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media'), render: fakeRender, serverBase: 'http://x' });
    try {
      const res = await app.inject({ method: 'POST', url: '/render', payload: { projectId, aspects: ['16:9', '1:1', '4:5', '9:16'] } });
      expect(res.statusCode).toBe(202);
      const body = res.json() as { id: number; aspect: string; jobs: { id: number; aspect: string; status: string }[] };
      expect(body.jobs.map((j) => j.aspect)).toEqual(['16:9', '1:1', '4:5', '9:16']);
      expect(body.jobs.every((j) => j.status === 'queued')).toBe(true);
      expect(body.id).toBe(body.jobs[0]!.id);
      expect((await app.inject({ method: 'POST', url: '/render', payload: { projectId, aspects: ['3:2'] } })).statusCode).toBe(400);
      const one = (await app.inject({ method: 'POST', url: '/render', payload: { projectId } })).json() as { aspect: string; jobs: unknown[] };
      expect(one.aspect).toBe('16:9');
      expect(one.jobs).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
