import { formatTimecode } from '@campaigncut/composition';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { api, type LibraryGroup, type ProjectRow, type TemplateSummary } from '../api';
import { AddTemplate } from '../components/AddTemplate';

type Props = {
  onOpenProject: (projectId: number) => void;
};

/**
 * Ad type > ad example. The user starts from a finished spot, not a blank
 * canvas: clicking an example creates a project with every authored value
 * already filled in and opens the editor. Since M22 the projects already
 * made are listed above the templates, so a spot can be found again.
 */
export function Library({ onOpenProject }: Props) {
  const [groups, setGroups] = useState<LibraryGroup[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const loadProjects = () =>
    api
      .projects()
      .then(setProjects)
      .catch(() => setProjects([]));

  const loadGroups = () =>
    api
      .library()
      .then(setGroups)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void loadGroups();
    void loadProjects();
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

        <AddTemplate onIngested={() => void loadGroups()} />

        {projects.length > 0 && (
          <ProjectList
            projects={projects}
            onOpen={onOpenProject}
            onUpdate={setProjects}
            onError={(message) => setError(message)}
          />
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

/** "2026-09-13 12:30:05" -> "2026-09-13 12:30". SQLite's UTC text, shown as is. */
const shortStamp = (s: string) => s.slice(0, 16);

/**
 * M22: the projects already made. Open, rename in place, duplicate (which
 * opens the copy), and delete behind a second, confirming click. One shared
 * list on purpose: no accounts, no owners (CLAUDE.md non-goals).
 */
function ProjectList({
  projects,
  onOpen,
  onUpdate,
  onError,
}: {
  projects: ProjectRow[];
  onOpen: (id: number) => void;
  /** The list after a rename or delete, applied from the API's answer rather than refetched. */
  onUpdate: (next: (prev: ProjectRow[]) => ProjectRow[]) => void;
  onError: (message: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const startRename = (p: ProjectRow) => {
    setRenamingId(p.id);
    setDraft(p.name);
  };
  const commitRename = async (p: ProjectRow) => {
    const name = draft.trim();
    setRenamingId(null);
    if (!name || name === p.name) return;
    try {
      const row = await api.renameProject(p.id, name);
      onUpdate((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: row.name, updatedAt: row.updatedAt } : x)));
    } catch (e) {
      onError((e as Error).message);
    }
  };
  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>, p: ProjectRow) => {
    if (e.key === 'Enter') void commitRename(p);
    if (e.key === 'Escape') setRenamingId(null);
  };
  const duplicate = async (p: ProjectRow) => {
    setBusyId(p.id);
    try {
      const { id } = await api.duplicateProject(p.id);
      onOpen(id);
    } catch (e) {
      onError((e as Error).message);
      setBusyId(null);
    }
  };
  const remove = async (p: ProjectRow) => {
    setBusyId(p.id);
    try {
      await api.deleteProject(p.id);
      setConfirmingId(null);
      onUpdate((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-widest text-muted mb-3">Projects</h2>
      <ul className="border border-hairline divide-y divide-hairline">
        {projects.map((p) => (
          <li key={p.id} data-testid={`project-row-${p.id}`} className="flex items-center gap-4 px-3 h-11 bg-ink">
            <div className="flex-1 min-w-0">
              {renamingId === p.id ? (
                <input
                  autoFocus
                  aria-label={`New name for ${p.name}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onRenameKey(e, p)}
                  onBlur={() => void commitRename(p)}
                  className="w-full bg-panel border border-cobalt px-2 py-1 text-sm text-fg focus:outline-none"
                />
              ) : (
                <button type="button" aria-label={`Open ${p.name}`} onClick={() => onOpen(p.id)} className="block w-full text-sm text-left truncate hover:text-cobalt focus:outline-none">
                  {p.name}
                </button>
              )}
            </div>
            <span className="font-mono text-xs text-muted w-40 truncate">{p.templateName}</span>
            <span className="font-mono text-xs text-muted w-36">{shortStamp(p.updatedAt)}</span>
            <div className="flex gap-3 font-mono text-xs">
              <button type="button" aria-label={`Rename ${p.name}`} onClick={() => startRename(p)} disabled={busyId === p.id} className="text-muted hover:text-fg">
                Rename
              </button>
              <button type="button" aria-label={`Duplicate ${p.name}`} onClick={() => void duplicate(p)} disabled={busyId === p.id} className="text-muted hover:text-fg">
                Duplicate
              </button>
              {confirmingId === p.id ? (
                <>
                  <button type="button" aria-label={`Confirm delete ${p.name}`} onClick={() => void remove(p)} disabled={busyId === p.id} className="text-danger">
                    Really delete
                  </button>
                  <button type="button" aria-label={`Keep ${p.name}`} onClick={() => setConfirmingId(null)} className="text-muted hover:text-fg">
                    Keep
                  </button>
                </>
              ) : (
                <button type="button" aria-label={`Delete ${p.name}`} onClick={() => setConfirmingId(p.id)} disabled={busyId === p.id} className="text-muted hover:text-danger">
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
