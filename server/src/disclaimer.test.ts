import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';

/** M35: an export is refused while the disclaimer is on screen for under four seconds, with the reason. */
const lottie = { fr: 30, ip: 0, op: 300, w: 1920, h: 1080, layers: [] };
const withDisclaimer = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' },
  { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example Committee', path: '/layers/1', locked: true },
];
const plain = [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' }];

describe('POST /render and the disclaimer minimum (M35)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let projectId: number;
  let card: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-disc-'));
    for (const [el, schema] of [
      ['open', plain],
      ['end-card', withDisclaimer],
    ] as const) {
      const dir = path.join(tmp, 't', 'elements', el);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
      fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie));
    }
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 300, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 225 });
    card = db.upsertTemplateElement({ templateId: t.id, slug: 'end-card', zIndex: 0, startFrame: 225, endFrame: 300 }).id; // 2.5 s
    app = buildApp({ db, templatesDir: tmp, mediaDir: path.join(tmp, 'media'), render: async () => {} });
    projectId = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('refuses a 2.5 s disclaimer naming the seconds, then renders once the end card is lengthened', async () => {
    const short = await app.inject({ method: 'POST', url: '/render', payload: { projectId } });
    expect(short.statusCode).toBe(400);
    expect((short.json() as { error: string }).error).toMatch(/2\.5 s.*4\.0 s/);

    await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${card}`, payload: { startFrame: 225, endFrame: 360 } }); // 4.5 s
    const ok = await app.inject({ method: 'POST', url: '/render', payload: { projectId } });
    expect(ok.statusCode).toBe(202);
  });

  it('a hidden or emptied disclaimer counts as none', async () => {
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/elements/${card}`, payload: { startFrame: 225, endFrame: 360 } });
    await app.inject({ method: 'PUT', url: `/projects/${projectId}/values`, payload: { values: [{ elementId: card, key: 'disclaimer', value: '   ' }] } });
    const res = await app.inject({ method: 'POST', url: '/render', payload: { projectId } });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/no disclaimer/i);
  });
});
