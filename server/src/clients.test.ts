import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb, type Db } from './db/index';

/**
 * M33: clients over HTTP, and a spot created for a client opens already
 * branded: its colours by role, its logo in every logo slot, its
 * disclaimer in every disclaimer field.
 */
const lottie = { fr: 30, ip: 0, op: 150, w: 1920, h: 1080, layers: [] };
const schema = [
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#F05929', path: '/layers/0' },
  { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
  { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'Paid for by Example Committee', path: '/layers/1', locked: true },
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/2' },
];
const brand = { name: 'Rivera for Senate', logoUrl: '/media/images/rivera.png', colors: { accent: '#1d4ed8' }, disclaimer: 'Paid for by Rivera for Senate' };

describe('client routes (M33)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let elementId: number;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-clients-'));
    const dir = path.join(tmp, 't', 'elements', 'open');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(schema));
    fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(lottie));
    db = openDb(':memory:');
    const t = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' });
    elementId = db.upsertTemplateElement({ templateId: t.id, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150 }).id;
    app = buildApp({ db, templatesDir: tmp });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('POST, GET, PATCH and DELETE /clients; a client needs a name and #rrggbb colours', async () => {
    const created = await app.inject({ method: 'POST', url: '/clients', payload: brand });
    expect(created.statusCode).toBe(201);
    const client = created.json() as { id: number; colors: Record<string, string> };
    expect(client).toMatchObject({ name: 'Rivera for Senate', logoUrl: '/media/images/rivera.png', colors: { accent: '#1D4ED8' }, disclaimer: 'Paid for by Rivera for Senate' });
    expect((await app.inject({ method: 'GET', url: '/clients' })).json()).toEqual([expect.objectContaining({ id: client.id })]);
    const patched = await app.inject({ method: 'PATCH', url: `/clients/${client.id}`, payload: { name: 'Rivera for US Senate', colors: { accent: '#1D4ED8', surface: '#0b1220' } } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ name: 'Rivera for US Senate', colors: { accent: '#1D4ED8', surface: '#0B1220' }, disclaimer: 'Paid for by Rivera for Senate' });
    expect((await app.inject({ method: 'POST', url: '/clients', payload: { ...brand, name: ' ' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/clients', payload: { ...brand, colors: { accent: 'blue' } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/clients/${client.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/clients/${client.id}` })).statusCode).toBe(404);
  });

  it('a spot created for a client opens branded, names its client, and the brand can be applied again', async () => {
    const client = (await app.inject({ method: 'POST', url: '/clients', payload: brand })).json() as { id: number };
    const created = await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't', clientId: client.id } });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { id: number }).id;
    const detail = (await app.inject({ method: 'GET', url: `/projects/${id}` })).json() as { project: { clientId: number; clientName: string; name: string }; values: { elementId: number; key: string; value: unknown }[] };
    expect(detail.project).toMatchObject({ clientId: client.id, clientName: 'Rivera for Senate', name: 'Rivera for Senate: T' });
    const value = (key: string) => detail.values.find((v) => v.elementId === elementId && v.key === key)!.value;
    expect(value('accent')).toBe('#1D4ED8');
    expect(value('logo')).toBe('/media/images/rivera.png');
    expect(value('disclaimer')).toBe('Paid for by Rivera for Senate');
    expect(value('headline')).toBe('HI');

    db.setProjectValues(id, [{ elementId, key: 'accent', value: '#000000' }]);
    const again = await app.inject({ method: 'POST', url: `/projects/${id}/brand` });
    expect(again.statusCode).toBe(200);
    expect((again.json() as { values: unknown[] }).values).toEqual(expect.arrayContaining([{ elementId, key: 'accent', value: '#1D4ED8' }]));
    expect(db.getProject(id)!.values.find((v) => v.key === 'accent')!.value).toBe('#1D4ED8');

    const plain = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't' } })).json() as { id: number }).id;
    expect((await app.inject({ method: 'POST', url: `/projects/${plain}/brand` })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't', clientId: 999 } })).statusCode).toBe(404);
  });

  it('an empty logo or disclaimer on the client leaves the designer\'s in place', async () => {
    const client = (await app.inject({ method: 'POST', url: '/clients', payload: { name: 'Quiet', logoUrl: '', colors: {}, disclaimer: '' } })).json() as { id: number };
    const id = ((await app.inject({ method: 'POST', url: '/projects', payload: { templateSlug: 't', clientId: client.id } })).json() as { id: number }).id;
    const values = db.getProject(id)!.values;
    expect(values.find((v) => v.key === 'logo')!.value).toBe('images/logo.png');
    expect(values.find((v) => v.key === 'disclaimer')!.value).toBe('Paid for by Example Committee');
    expect(values.find((v) => v.key === 'accent')!.value).toBe('#F05929');
  });
});
