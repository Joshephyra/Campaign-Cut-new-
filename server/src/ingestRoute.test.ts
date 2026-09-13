import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type RunIngest } from './app';
import { openDb, type Db } from './db/index';

/**
 * M24: POST /templates/ingest stages an uploaded handover folder and runs
 * the ingest command as a child process. The command is injected here so
 * the route can be tested without Remotion.
 */
type Part = { field: string; value?: string; filename?: string; bytes?: Buffer; contentType?: string };

function multipart(parts: Part[]) {
  const boundary = `----cc${Date.now()}${Math.random().toString(36).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const p of parts) {
    if (p.filename !== undefined) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${p.field}"; filename="${p.filename}"\r\nContent-Type: ${p.contentType ?? 'application/octet-stream'}\r\n\r\n`));
      chunks.push(p.bytes ?? Buffer.alloc(0));
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${p.field}"\r\n\r\n${p.value ?? ''}\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('POST /templates/ingest (M24)', () => {
  let tmp: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let runs: Parameters<RunIngest>[0][];
  let seenFiles: string[];
  let nextResult: { code: number; output: string };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ingest-route-'));
    db = openDb(':memory:');
    runs = [];
    seenFiles = [];
    nextResult = { code: 0, output: 'Ingested "Three Part" as three: 1920x1080 @ 30 fps, 240 frames, 3 element(s)\n' };
    const runIngest: RunIngest = async (opts) => {
      runs.push(opts);
      const walk = (dir: string, prefix = ''): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
          else seenFiles.push(rel);
        }
      };
      walk(opts.dir);
      return nextResult;
    };
    app = buildApp({ db, templatesDir: path.join(tmp, 'templates'), mediaDir: path.join(tmp, 'media'), runIngest, uploadsDir: path.join(tmp, 'uploads') });
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const files = (): Part[] => [
    { field: 'file', filename: 'Three Part/elements.json', bytes: Buffer.from('[]'), contentType: 'application/json' },
    { field: 'file', filename: 'Three Part/01-open/data.json', bytes: Buffer.from('{}'), contentType: 'application/json' },
    { field: 'file', filename: 'Three Part/02-lower-third/images/logo.png', bytes: Buffer.from('png'), contentType: 'image/png' },
    { field: 'file', filename: 'Three Part/fonts/IBMPlexSans-Regular.ttf', bytes: Buffer.from('ttf'), contentType: 'font/ttf' },
  ];

  it('stages the files at their relative paths (picked folder stripped) and runs the command with the fields', async () => {
    const { payload, headers } = multipart([{ field: 'name', value: 'Three Part' }, { field: 'adType', value: 'Contrast' }, { field: 'slug', value: 'three' }, ...files()]);
    const res = await app.inject({ method: 'POST', url: '/templates/ingest', payload, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, slug: 'three', output: nextResult.output });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ name: 'Three Part', adType: 'Contrast', slug: 'three' });
    expect(seenFiles.sort()).toEqual(['01-open/data.json', '02-lower-third/images/logo.png', 'elements.json', 'fonts/IBMPlexSans-Regular.ttf']);
    expect(runs[0]!.dir.startsWith(path.join(tmp, 'uploads'))).toBe(true);
    // the staging folder is removed after the run
    expect(fs.existsSync(runs[0]!.dir)).toBe(false);
  });

  it('derives the slug from the name when none is given', async () => {
    const { payload, headers } = multipart([{ field: 'name', value: 'Split Record :30' }, { field: 'adType', value: 'Contrast' }, ...files()]);
    const res = await app.inject({ method: 'POST', url: '/templates/ingest', payload, headers });
    expect(res.statusCode).toBe(200);
    expect(runs[0]!.slug).toBe('split-record-30');
    expect((res.json() as { slug: string }).slug).toBe('split-record-30');
  });

  it('turns a failing command into a 400 carrying its problems, verbatim', async () => {
    nextResult = {
      code: 1,
      output: 'Tags found: 2\n\nIngest rejected. 2 problems. Nothing written.\n  - Element "lower-third": Layer "cc.tagline": unknown role "tagline"\n  - Font "Nowhere Sans" (used by element "open") is not present\n',
    };
    const { payload, headers } = multipart([{ field: 'name', value: 'Three Part' }, { field: 'adType', value: 'Contrast' }, ...files()]);
    const res = await app.inject({ method: 'POST', url: '/templates/ingest', payload, headers });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { ok: boolean; problems: string[]; output: string };
    expect(body.ok).toBe(false);
    expect(body.problems).toEqual(['Element "lower-third": Layer "cc.tagline": unknown role "tagline"', 'Font "Nowhere Sans" (used by element "open") is not present']);
    expect(body.output).toBe(nextResult.output);
  });

  it('refuses a missing name or ad type, no files, and a path that escapes the folder', async () => {
    let r = await app.inject({ method: 'POST', url: '/templates/ingest', ...multipart([{ field: 'adType', value: 'Contrast' }, ...files()]) });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: string }).error).toMatch(/name/i);
    r = await app.inject({ method: 'POST', url: '/templates/ingest', ...multipart([{ field: 'name', value: 'X' }, ...files()]) });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: string }).error).toMatch(/ad type/i);
    r = await app.inject({ method: 'POST', url: '/templates/ingest', ...multipart([{ field: 'name', value: 'X' }, { field: 'adType', value: 'Bio' }]) });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: string }).error).toMatch(/file/i);
    r = await app.inject({
      method: 'POST',
      url: '/templates/ingest',
      ...multipart([{ field: 'name', value: 'X' }, { field: 'adType', value: 'Bio' }, { field: 'file', filename: 'h/../../etc/passwd', bytes: Buffer.from('x') }]),
    });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: string }).error).toMatch(/path/i);
    expect(runs).toHaveLength(0);
  });
});
