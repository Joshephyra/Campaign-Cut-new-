import { useEffect, useRef, useState } from 'react';
import { api, type RenderJob } from '../api';

type Props = {
  projectId: number;
  pollIntervalMs?: number;
  /** M25: fired when a render ends (done or failed) so the export history can reload. */
  onFinished?: () => void;
};

/**
 * Export: queue a server-side render of THE composition with the original
 * footage, poll until it is done, then offer the MP4. AT-5 is watching it.
 */
export function ExportPanel({ projectId, pollIntervalMs = 1000, onFinished }: Props) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  const start = async () => {
    setError(null);
    try {
      const started = await api.startRender(projectId);
      setJob(started);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!job) return;
    if (job.status === 'done' || job.status === 'failed') {
      finished.current?.();
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setJob(await api.renderStatus(job.id));
      } catch (e) {
        setError((e as Error).message);
      }
    }, pollIntervalMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [job, pollIntervalMs]);

  const busy = job !== null && (job.status === 'queued' || job.status === 'rendering');

  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      {job?.status === 'queued' && <span className="text-muted">Queued</span>}
      {job?.status === 'rendering' && (
        <span className="text-cobalt">
          Rendering <span>{`${Math.round(job.progress * 100)}%`}</span>
        </span>
      )}
      {job?.status === 'done' && job.outputUrl && (
        <a href={api.fileUrl(job.outputUrl)} download className="text-cobalt underline underline-offset-2">
          Download MP4
        </a>
      )}
      {job?.status === 'failed' && <span className="text-danger">Export failed: {job.error ?? 'unknown error'}</span>}
      {error && <span className="text-danger">{error}</span>}
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="border border-fg px-4 py-1.5 text-xs font-sans font-semibold text-fg hover:bg-fg hover:text-ink disabled:opacity-50 disabled:cursor-wait"
      >
        Export MP4
      </button>
    </div>
  );
}
