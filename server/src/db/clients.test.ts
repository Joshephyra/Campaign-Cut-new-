import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index';

/**
 * M33: a client profile is a brand guide the library keeps: name, logo,
 * colours by role, disclaimer. A spot belongs to one. No users, no logins.
 */
describe('clients (M33)', () => {
  let db: Db;
  let templateId: number;
  beforeEach(() => {
    db = openDb(':memory:');
    templateId = db.upsertTemplate({ slug: 't', name: 'T', adType: 'Bio', durationFrames: 150, fps: 30, width: 1920, height: 1080, thumbPath: '' }).id;
  });
  afterEach(() => db.close());

  it('saves, lists by name, reads one, updates parts, and deletes', () => {
    const a = db.insertClient({ name: 'Rivera for Senate', logoUrl: '/media/images/rivera.png', colors: { accent: '#1D4ED8' }, disclaimer: 'Paid for by Rivera for Senate' }).id;
    const b = db.insertClient({ name: 'Ahmed for Mayor', logoUrl: '', colors: {}, disclaimer: '' }).id;
    expect(db.listClients().map((c) => c.name)).toEqual(['Ahmed for Mayor', 'Rivera for Senate']);
    expect(db.getClient(a)).toEqual({ id: a, name: 'Rivera for Senate', logoUrl: '/media/images/rivera.png', colors: { accent: '#1D4ED8' }, disclaimer: 'Paid for by Rivera for Senate', createdAt: expect.any(String) });
    db.updateClient(a, { colors: { accent: '#1D4ED8', surface: '#0B1220' }, disclaimer: 'Paid for by Rivera for Senate. Approved by Maria Rivera.' });
    expect(db.getClient(a)).toMatchObject({ name: 'Rivera for Senate', colors: { accent: '#1D4ED8', surface: '#0B1220' }, disclaimer: 'Paid for by Rivera for Senate. Approved by Maria Rivera.' });
    expect(db.deleteClient(b)).toBe(true);
    expect(db.deleteClient(b)).toBe(false);
    expect(db.listClients().map((c) => c.id)).toEqual([a]);
  });

  it('a spot belongs to a client; the column survives old databases; deleting the client leaves the spot without one', () => {
    const client = db.insertClient({ name: 'Rivera for Senate', logoUrl: '', colors: {}, disclaimer: '' }).id;
    const withClient = db.createProject({ templateId, name: 'Tuesday', clientId: client, values: [] }).id;
    const without = db.createProject({ templateId, name: 'Plain', values: [] }).id;
    expect(db.getProject(withClient)).toMatchObject({ clientId: client, clientName: 'Rivera for Senate' });
    expect(db.getProject(without)).toMatchObject({ clientId: null, clientName: null });
    expect(db.listProjects().map((p) => [p.name, p.clientName])).toEqual([
      ['Plain', null],
      ['Tuesday', 'Rivera for Senate'],
    ]);
    const copy = db.duplicateProject(withClient, 'Copy').id;
    expect(db.getProject(copy)!.clientId).toBe(client);
    db.deleteClient(client);
    expect(db.getProject(withClient)).toMatchObject({ clientId: null, clientName: null });
    const columns = (db.prepare(`PRAGMA table_info(project)`).all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('client_id');
  });
});
