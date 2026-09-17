import { useEffect, useState } from 'react';
import { api, type RenderJob } from '../api';

type Props = {
  projectId: number;
  /** Bump to reload, e.g. when an export finishes. */
  refreshKey?: number;
};

/** M25: this project's earlier exports, newest first: time and a download link, or the error. */
export function ExportHistory({ projectId, refreshKey = 0 }: Props) {
  const [renders, setRenders] = useState<RenderJob[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .renders(projectId)
      .then((list) => {
        if (!cancelled) setRenders(list.filter((r) => r.status === 'done' || r.status === 'failed'));
      })
      .catch(() => {
        if (!cancelled) setRenders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">Exports</h2>
      {renders === null && <p className="font-mono text-[10px] text-muted">Loading…</p>}
      {renders?.length === 0 && <p className="font-mono text-[10px] text-muted">No exports yet. Export MP4 is in the header.</p>}
      {renders && renders.length > 0 && (
        <ul data-testid="export-history" className="border border-hairline divide-y divide-hairline font-mono text-[11px]">
          {renders.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-2 py-1.5">
              <span className="text-muted">{(r.updatedAt ?? r.createdAt ?? '').slice(0, 16) || `render ${r.id}`}</span>
              {r.status === 'done' && r.outputUrl ? (
                <a href={api.fileUrl(r.outputUrl)} download className="text-cobalt underline underline-offset-2">
                  Download
                </a>
              ) : (
                <span className="text-danger truncate" title={r.error ?? ''}>
                  failed{r.error ? `: ${r.error}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
