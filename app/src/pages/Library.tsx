import { formatTimecode } from '@campaigncut/composition';
import { useEffect, useState } from 'react';
import { api, type LibraryGroup, type TemplateSummary } from '../api';

type Props = {
  onOpenProject: (projectId: number) => void;
};

/**
 * Ad type > ad example. The user starts from a finished spot, not a blank
 * canvas: clicking an example creates a project with every authored value
 * already filled in and opens the editor.
 */
export function Library({ onOpenProject }: Props) {
  const [groups, setGroups] = useState<LibraryGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .library()
      .then((g) => {
        if (!cancelled) setGroups(g);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = async (t: TemplateSummary) => {
    setBusySlug(t.slug);
    try {
      const { id } = await api.createProject(t.slug);
      onOpenProject(id);
    } catch (e) {
      setError((e as Error).message);
      setBusySlug(null);
    }
  };

  return (
    <main className="min-h-screen bg-ink text-fg">
      <header className="border-b border-hairline px-8 h-12 flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight">CampaignCut</h1>
        <span className="font-mono text-xs text-muted">Library</span>
      </header>

      <div className="px-8 py-8 max-w-6xl">
        {error && <p className="font-mono text-xs text-danger mb-6">Could not load the library: {error}</p>}
        {groups === null && !error && <p className="font-mono text-xs text-muted">Loading…</p>}
        {groups?.length === 0 && (
          <p className="font-mono text-xs text-muted">No templates yet. Run npm run ingest on a Bodymovin export.</p>
        )}

        {groups?.map((group) => (
          <section key={group.adType} className="mb-10">
            <h2 className="text-xs uppercase tracking-widest text-muted mb-3">{group.adType}</h2>
            <div className="grid grid-cols-3 gap-px bg-hairline border border-hairline">
              {group.templates.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  disabled={busySlug !== null}
                  onClick={() => open(t)}
                  className="text-left bg-ink hover:bg-panel focus:outline-none focus-visible:ring-1 focus-visible:ring-cobalt disabled:opacity-60"
                >
                  <div className="aspect-video bg-black border-b border-hairline overflow-hidden">
                    <img src={api.fileUrl(t.thumbUrl)} alt="" className="w-full h-full object-cover block" />
                  </div>
                  <div className="p-3">
                    <div className="text-sm">{t.name}</div>
                    <div className="font-mono text-xs text-muted mt-1 flex gap-3">
                      <span>{formatTimecode(t.durationFrames, t.fps)}</span>
                      <span>
                        {t.width}×{t.height}
                      </span>
                      <span>{t.fps} fps</span>
                    </div>
                    {busySlug === t.slug && <div className="font-mono text-xs text-cobalt mt-2">Creating project…</div>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
