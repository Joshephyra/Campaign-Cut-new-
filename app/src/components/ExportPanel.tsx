import { ASPECTS, type Readiness } from '@campaigncut/composition';
import { ChevronDown, Circle, CircleCheck, Download, Loader2, Share, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type RenderJob } from '../api';
import { exportFileName } from '../exportName';
import { Button, ICON, IconButton } from './ui';

type Props = {
  projectId: number;
  pollIntervalMs?: number;
  /** M25: fired when a render ends (done or failed) so the export history can reload. */
  onFinished?: () => void;
  /** M49: everything to check before an export, in one list; the disclaimer blocks, the rest are notes. */
  readiness?: Readiness;
  /** M50: the spot's current version, named on the export menu. */
  aspect?: string;
  /** The spot's name, for the downloaded file's name. */
  projectName?: string | null;
  /** M52: hide proof points from the end until the content fits the spot's length. */
  onCutDown?: () => void;
  /** M52: ":30", for the cut-down button. */
  lengthLabel?: string;
};

/**
 * Export: queue a server-side render of THE composition with the original
 * footage, poll until it is done, then offer the MP4. AT-5 is watching it.
 */
export function ExportPanel({ projectId, pollIntervalMs = 1000, onFinished, readiness, aspect = '16:9', projectName = null, onCutDown, lengthLabel = '' }: Props) {
  // M50: one job for this version, or one per version for a batch.
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const job = jobs.length === 1 ? jobs[0]! : null;
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

  const start = async (aspects?: string[]) => {
    setError(null);
    setMenuOpen(false);
    try {
      const started = await api.startRender(projectId, aspects);
      setJobs(started.jobs ?? [started]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const unfinished = jobs.filter((j) => j.status === 'queued' || j.status === 'rendering');
  useEffect(() => {
    if (jobs.length === 0) return;
    if (unfinished.length === 0) {
      finished.current?.();
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const fresh = await Promise.all(unfinished.map((j) => api.renderStatus(j.id)));
        setJobs((prev) => prev.map((j) => fresh.find((f) => f.id === j.id) ?? j));
      } catch (e) {
        setError((e as Error).message);
      }
    }, pollIntervalMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unfinished derives from jobs
  }, [jobs, pollIntervalMs]);

  const busy = unfinished.length > 0;
  const batch = jobs.length > 1 ? jobs : null;
  const batchDone = batch ? batch.filter((j) => j.status === 'done').length : 0;
  const batchFailed = batch ? batch.filter((j) => j.status === 'failed').length : 0;
  const batchProgress = batch ? batch.reduce((sum, j) => sum + (j.status === 'done' ? 1 : j.status === 'rendering' ? j.progress : 0), 0) / batch.length : 0;

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
                    <span>
                      {i.message}
                      {i.key === 'length' && i.over && onCutDown && (
                        <button type="button" onClick={onCutDown} className="ml-2 inline-flex items-center h-6 px-2 rounded-md bg-raised border border-line text-xs font-medium text-fg hover:bg-hover">
                          Cut down to {lengthLabel}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-fg-3">The disclaimer must be on for four seconds. The rest are up to you.</p>
            </div>
          )}
        </div>
      )}
      {batch && busy && (
        <span className="inline-flex items-center gap-2 text-fg-2" data-testid="batch-progress">
          <Loader2 size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="animate-spin text-blue" />
          Exporting {batchDone + 1} of {batch.length} <span className="text-fg tabular-nums">{`${Math.round(batchProgress * 100)}%`}</span>
        </span>
      )}
      {batch && !busy && (
        <span className="text-fg-2" data-testid="batch-done">
          {batchFailed === 0 ? `${batchDone} versions exported · in Exports below` : `${batchDone} of ${batch.length} versions exported · ${batchFailed} failed`}
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
        <a href={api.fileUrl(job.outputUrl)} download={exportFileName(projectName, job.aspect ?? aspect)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium text-fg bg-raised border border-line hover:bg-hover">
          <Download size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
          Download MP4
        </a>
      )}
      {job?.status === 'failed' && <span className="text-red max-w-64 truncate" title={job.error ?? ''}>Export failed: {job.error ?? 'unknown error'}</span>}
      {error && <span className="text-red">{error}</span>}
      <div className="relative inline-flex items-stretch">
        <Button variant="primary" icon={Share} onClick={() => void start()} disabled={busy || blocking !== undefined} title={blocking?.message} className={`${busy ? 'cursor-wait' : ''} rounded-r-none`}>
          Export MP4
        </Button>
        <IconButton
          label="Export options"
          icon={ChevronDown}
          disabled={busy || blocking !== undefined}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="!h-9 !w-8 !rounded-l-none border-l border-white/20 bg-blue text-white hover:bg-blue-hover"
        />
        {menuOpen && (
          <ul role="menu" aria-label="Export options" className="absolute right-0 top-10 z-20 w-64 rounded-lg bg-panel border border-line shadow-float p-1 cc-appear text-[13px]">
            <li role="none">
              <button type="button" role="menuitem" onClick={() => void start()} className="w-full text-left rounded-md px-3 py-2 hover:bg-hover">
                This version ({aspect})
              </button>
            </li>
            <li role="none">
              <button type="button" role="menuitem" onClick={() => void start([...ASPECTS])} className="w-full text-left rounded-md px-3 py-2 hover:bg-hover">
                All four versions <span className="text-fg-3">({ASPECTS.join(', ')})</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
