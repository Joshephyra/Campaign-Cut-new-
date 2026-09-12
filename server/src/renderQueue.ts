import type { MainProps } from '@campaigncut/composition';
import fs from 'node:fs';
import path from 'node:path';
import type { Db, RenderRow } from './db/index';
import { buildProjectProps } from './renderProject';

/** Renders `props` to `outputPath`, reporting progress 0..1. The real one wraps renderMedia. */
export type RenderFn = (args: { props: MainProps; outputPath: string; onProgress: (fraction: number) => void }) => Promise<void>;

export type RenderQueueOptions = {
  db: Db;
  templatesDir: string;
  /** Absolute directory for output files; recorded relative to its parent (the media dir). */
  rendersDir: string;
  serverBase: string;
  render: RenderFn;
};

/**
 * SPEC.md section 6: one job at a time, simple in-process queue. No fan-out,
 * no Lambda. Jobs live in the `render` table so progress can be polled.
 */
export class RenderQueue {
  private pending: number[] = [];
  private running = false;
  private listeners: Array<(job: RenderRow) => void> = [];
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly options: RenderQueueOptions) {
    fs.mkdirSync(options.rendersDir, { recursive: true });
  }

  /** Queue a render of a project. Throws if the project does not exist. */
  enqueue(projectId: number): { id: number } {
    const { db } = this.options;
    if (!db.getProject(projectId)) throw new Error(`No project ${projectId}`);
    const { id } = db.insertRender(projectId);
    this.pending.push(id);
    // Start on the next tick so the caller sees the job as 'queued' first.
    setTimeout(() => void this.pump(), 0);
    return { id };
  }

  onChange(listener: (job: RenderRow) => void): void {
    this.listeners.push(listener);
  }

  /** Resolves once every queued job has finished (done or failed). */
  idle(): Promise<void> {
    if (!this.running && this.pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private update(id: number, patch: Parameters<Db['updateRender']>[1]): void {
    if (!this.options.db.open) return; // the process is shutting down
    this.options.db.updateRender(id, patch);
    const job = this.options.db.getRender(id);
    if (job) for (const l of this.listeners) l(job);
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length > 0 && this.options.db.open) {
        const id = this.pending.shift()!;
        await this.runOne(id);
      }
    } finally {
      this.running = false;
      const resolvers = this.idleResolvers.splice(0);
      for (const r of resolvers) r();
    }
  }

  private async runOne(id: number): Promise<void> {
    const { db, templatesDir, rendersDir, serverBase, render } = this.options;
    const job = db.getRender(id);
    if (!job) return;
    this.update(id, { status: 'rendering', progress: 0 });
    try {
      const props = buildProjectProps({ db, templatesDir, projectId: job.projectId, serverBase });
      const fileName = `project-${job.projectId}-${id}.mp4`;
      const outputPath = path.join(rendersDir, fileName);
      let last = -1;
      await render({
        props,
        outputPath,
        onProgress: (fraction) => {
          const pct = Math.floor(fraction * 100);
          if (pct !== last) {
            last = pct;
            this.update(id, { progress: Math.min(1, Math.max(0, fraction)) });
          }
        },
      });
      const relative = `${path.basename(rendersDir)}/${fileName}`;
      this.update(id, { status: 'done', progress: 1, outputPath: relative, error: null });
    } catch (err) {
      this.update(id, { status: 'failed', error: (err as Error).message });
    }
  }
}
