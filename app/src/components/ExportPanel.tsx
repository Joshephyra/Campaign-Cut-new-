import { Download, Film, Loader2, Share, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type RenderJob } from '../api';
import { Button, ICON } from './ui';

type Props = {
  projectId: number;
  pollIntervalMs?: number;
  /** M25: fired when a render ends (done or failed) so the export history can reload. */
  onFinished?: () => void;
  /** M35: the disclaimer check; red and blocking while not ok. */
  check?: { ok: boolean; seconds: number; message: string };
  /** M48: scenes whose footage slot has no clip; a note, never a block. */
  emptySlots?: string[];
};

/**
 * Export: queue a server-side render of THE composition with the original
 * footage, poll until it is done, then offer the MP4. AT-5 is watching it.
 */
export function ExportPanel({ projectId, pollIntervalMs = 1000, onFinished, check, emptySlots = [] }: Props) {
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
    <div className="flex items-center gap-3 text-xs">
      {emptySlots.length > 0 && (
        <span
          data-testid="empty-slots"
          title={`No clip yet in: ${emptySlots.join(', ')}. The designer's stand-in shows there, in the export too.`}
          className="inline-flex items-center gap-1.5 max-w-72 truncate text-fg-2"
        >
          <Film size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="shrink-0" />
          {emptySlots.length === 1 ? `No clip yet in ${emptySlots[0]}` : `No clip yet in ${emptySlots.length} scenes`}
        </span>
      )}
      {check && (
        <span
          data-testid="disclaimer-check"
          data-ok={check.ok ? 'true' : 'false'}
          title={check.message}
          className={`inline-flex items-center gap-1.5 max-w-72 truncate ${check.ok ? 'text-fg-3' : 'text-red'}`}
        >
          {check.ok ? <ShieldCheck size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-green shrink-0" /> : <ShieldAlert size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="shrink-0" />}
          {check.ok ? `Disclaimer ${check.seconds.toFixed(1)} s` : check.message}
        </span>
      )}
      {job?.status === 'queued' && <span className="text-fg-2">Queued</span>}
      {job?.status === 'rendering' && (
        <span className="inline-flex items-center gap-2 text-fg-2">
          <Loader2 size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="animate-spin text-blue" />
          Rendering <span className="text-fg tabular-nums">{`${Math.round(job.progress * 100)}%`}</span>
        </span>
      )}
      {job?.status === 'done' && job.outputUrl && (
        <a href={api.fileUrl(job.outputUrl)} download className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium text-fg bg-raised border border-line hover:bg-hover">
          <Download size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
          Download MP4
        </a>
      )}
      {job?.status === 'failed' && <span className="text-red max-w-64 truncate" title={job.error ?? ''}>Export failed: {job.error ?? 'unknown error'}</span>}
      {error && <span className="text-red">{error}</span>}
      <Button variant="primary" icon={Share} onClick={() => void start()} disabled={busy || (check !== undefined && !check.ok)} title={check && !check.ok ? check.message : undefined} className={busy ? 'cursor-wait' : ''}>
        Export MP4
      </Button>
    </div>
  );
}
