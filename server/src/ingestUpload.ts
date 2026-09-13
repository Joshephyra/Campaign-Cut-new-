import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './paths';

/**
 * M24: run the ingest COMMAND (tools/ingest) on a staged handover folder.
 * The browser gets no second ingest: the same CLI runs as a child process,
 * as ffmpeg does, and its output comes back verbatim.
 */
export type RunIngestOptions = { dir: string; name: string; adType: string; slug: string };
export type RunIngest = (opts: RunIngestOptions) => Promise<{ code: number; output: string }>;

const require = createRequire(import.meta.url);

export const runIngestCommand: RunIngest = ({ dir, name, adType, slug }) =>
  new Promise((resolve, reject) => {
    const tsxCli = require.resolve('tsx/cli');
    const cli = path.join(repoRoot, 'tools', 'ingest', 'src', 'cli-ingest.ts');
    const child = spawn(process.execPath, [tsxCli, cli, dir, '--ad-type', adType, '--name', name, '--slug', slug], {
      cwd: path.join(repoRoot, 'tools', 'ingest'),
      env: { ...process.env, INIT_CWD: repoRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });

/** "  - Element "x": ..." lines from the command's output. */
export function problemsFrom(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter((line) => /^\s+- /.test(line))
    .map((line) => line.replace(/^\s+- /, '').trim());
}

/**
 * A safe relative path for a staged file. The browser sends each file as
 * "<picked folder>/<path inside it>"; the picked folder's own name is
 * dropped. Anything absolute or climbing out is refused.
 */
export function stagedRelativePath(filename: string): string | null {
  const normalised = filename.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalised.startsWith('/') || /^[A-Za-z]:/.test(normalised)) return null;
  const parts = normalised.split('/').filter((p) => p.length > 0);
  if (parts.some((p) => p === '..' || p === '.')) return null;
  if (parts.length === 0) return null;
  const inside = parts.length > 1 ? parts.slice(1) : parts;
  return inside.join('/');
}

export function makeStagingDir(uploadsDir: string): string {
  fs.mkdirSync(uploadsDir, { recursive: true });
  return fs.mkdtempSync(path.join(uploadsDir, 'handover-'));
}

export const defaultUploadsDir = () => path.join(os.tmpdir(), 'campaigncut-uploads');
