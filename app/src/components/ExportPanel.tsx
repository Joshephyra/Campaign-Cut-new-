import type { Readiness } from '@campaigncut/composition';
import { Circle, CircleCheck, Download, Loader2, Share, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type RenderJob } from '../api';
import { Button, ICON } from './ui';

type Props = {
  projectId: number;
  pollIntervalMs?: number;
  /** M25: fired when a render ends (done or failed) so the export history can reload. */
  onFinished?: () => void;
  /** M49: everything to check before an export, in one list; the disclaimer blocks, the rest are notes. */
  readiness?: Readiness;
};

/**
 * Export: queue a server-side render of THE composition with the original
 * footage, poll until it is done, then offer the MP4. AT-5 is watching it.
 */
export function ExportPanel({ projectId, pollIntervalMs = 1000, onFinished, readiness }: Props) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const listWrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listOpen) return;
    const onPointer = (ev: PointerEvent) => {
      if (listWrap.current && ev.target instanceof Node && !listWrap.current.contains(ev.target)) setListOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setListOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [listOpen]);
  const blocking = readiness?.items.find((i) => i.blocking && !i.ok);
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
      {readiness && (
        <div className="relative" ref={listWrap}>
          <button
            type="button"
            data-testid="readiness"
            data-ok={readiness.ok ? 'true' : 'false'}
            data-blocked={readiness.blocked ? 'true' : 'false'}
            aria-expanded={listOpen}
            aria-controls="readiness-list"
            onClick={() => setListOpen((o) => !o)}
            title={readiness.ok ? 'Everything is in' : readiness.items.filter((i) => !i.ok).map((i) => i.message).join(' · ')}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-line bg-raised hover:bg-hover whitespace-nowrap ${readiness.blocked ? 'text-red' : readiness.ok ? 'text-fg-3' : 'text-fg-2'}`}
          >
            {readiness.blocked ? <ShieldAlert size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" /> : <ShieldCheck size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className={readiness.ok ? 'text-green' : ''} />}
            {readiness.ok ? 'Ready to export' : `${readiness.todo} to check`}
          </button>
          {listOpen && (
            <div id="readiness-list" role="region" aria-label="Ready to export?" className="absolute right-0 top-9 z-20 w-80 rounded-lg bg-panel border border-line shadow-float p-3 cc-appear">
              <h3 className="text-[13px] font-semibold mb-2">Ready to export?</h3>
              <ul className="flex flex-col gap-1.5">
                {readiness.items.map((i) => (
                  <li key={i.key} data-testid={`check-${i.key}`} data-ok={i.ok ? 'true' : 'false'} className={`flex items-start gap-2 text-xs leading-snug ${i.ok ? 'text-fg-2' : i.blocking ? 'text-red' : 'text-fg'}`}>
                    {i.ok ? <CircleCheck size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-green shrink-0 mt-0.5" /> : i.blocking ? <ShieldAlert size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="shrink-0 mt-0.5" /> : <Circle size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-3 shrink-0 mt-0.5" />}
                    <span>{i.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-fg-3">The disclaimer must be on for four seconds. The rest are up to you.</p>
            </div>
          )}
        </div>
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
      <Button variant="primary" icon={Share} onClick={() => void start()} disabled={busy || blocking !== undefined} title={blocking?.message} className={busy ? 'cursor-wait' : ''}>
        Export MP4
      </Button>
    </div>
  );
}
