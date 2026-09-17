import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type RenderJob } from '../api';
import { exportFileName } from '../exportName';
import { ICON } from './ui';

type Props = {
  projectId: number;
  /** Bump to reload, e.g. when an export finishes. */
  refreshKey?: number;
  /** The spot's name, for the downloaded file's name. */
  projectName?: string | null;
};

/** M25: this project's earlier exports, newest first: time and a download link, or the error. */
export function ExportHistory({ projectId, refreshKey = 0, projectName = null }: Props) {
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
      {renders === null && <p className="text-xs text-fg-3">Loading…</p>}
      {renders?.length === 0 && <p className="text-xs text-fg-2">No exports yet. Export MP4 is in the top bar.</p>}
      {renders && renders.length > 0 && (
        <ul data-testid="export-history" className="flex flex-col gap-1 text-xs">
          {renders.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 h-9 px-3 rounded-md bg-raised">
              <span className="text-fg-2 tabular-nums">
                {(r.updatedAt ?? r.createdAt ?? '').slice(0, 16) || `render ${r.id}`}
                {r.aspect && <span className="ml-2 text-fg-3">{r.aspect}</span>}
              </span>
              {r.status === 'done' && r.outputUrl ? (
                <a href={api.fileUrl(r.outputUrl)} download={exportFileName(projectName, r.aspect)} className="inline-flex items-center gap-1.5 text-blue hover:text-blue-hover font-medium">
                  <Download size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
                  Download
                </a>
              ) : (
                <span className="text-red truncate" title={r.error ?? ''}>
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
