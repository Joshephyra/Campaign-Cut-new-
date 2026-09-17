import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute repo root, derived from this file's location. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The well-known folders from the CLAUDE.md repo layout. */
export const paths = {
  root: repoRoot,
  templates: path.join(repoRoot, 'templates'),
  media: path.join(repoRoot, 'media'),
  fonts: path.join(repoRoot, 'app', 'public', 'fonts'),
  /** M59: font files uploaded from the app, for any ingest to use. Under /media so it is gitignored. */
  fontLibrary: path.join(repoRoot, 'media', 'fonts'),
  /** SQLite file. Lives under /media so it is gitignored with the other generated data. */
  db: process.env.CAMPAIGNCUT_DB ?? path.join(repoRoot, 'media', 'campaigncut.db'),
} as const;
