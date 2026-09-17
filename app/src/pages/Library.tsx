import { formatTimecode } from '@campaigncut/composition';
import { Copy, FolderUp, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api, type Client, type LibraryGroup, type ProjectRow, type TemplateSummary } from '../api';
import { AddTemplate } from '../components/AddTemplate';
import { ClientsPanel } from '../components/ClientsPanel';
import { Button, ICON, Wordmark } from '../components/ui';

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
  // M33: which client new spots are for. Null is "no client".
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);

  const loadProjects = () =>
    api
      .projects()
      .then(setProjects)
      .catch(() => setProjects([]));
  const loadClients = () =>
    api
      .clients()
      .then((list) => {
        setClients(list);
        setClientId((id) => (id !== null && list.some((c) => c.id === id) ? id : null));
      })
      .catch(() => setClients([]));

  const loadGroups = () =>
    api
      .library()
      .then(setGroups)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void loadGroups();
    void loadProjects();
    void loadClients();
  }, []);

  const open = async (t: TemplateSummary) => {
    setBusySlug(t.slug);
    try {
      const { id } = await api.createProject(t.slug, clientId ?? undefined);
      onOpenProject(id);
    } catch (e) {
      setError((e as Error).message);
      setBusySlug(null);
    }
  };
  // M41: a spot from nothing, built from the library.
  const startBlank = async () => {
    setBusySlug('blank');
    try {
      const { id } = await api.createProject('blank', clientId ?? undefined);
      onOpenProject(id);
    } catch (e) {
      setError((e as Error).message);
      setBusySlug(null);
    }
  };

  const [adding, setAdding] = useState(false);
  const addSection = useRef<HTMLDivElement>(null);
  const startAdding = () => {
    setAdding(true);
    addSection.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="on-bar h-[52px] px-5 flex items-center justify-between border-b border-line bg-panel">
        <h1 className="m-0">
          <Wordmark />
        </h1>
        <Button variant="primary" icon={FolderUp} onClick={startAdding}>
          Add template
        </Button>
      </header>

      <div className="px-8 py-8 max-w-6xl mx-auto">
        {error && <p className="text-xs text-red-ink mb-6 rounded-md bg-red-tint px-3 py-2">Could not load the library: {error}</p>}
        {groups === null && !error && <p className="text-xs text-fg-3">Loading…</p>}
        {groups?.length === 0 && <p className="text-xs text-fg-2">No templates yet. Add one from an After Effects export below.</p>}

        {projects.length > 0 && (
          <ProjectList
            projects={projects}
            onOpen={onOpenProject}
            onUpdate={setProjects}
            onError={(message) => setError(message)}
          />
        )}

        {clients.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="New spots are for">
            <span className="text-xs text-fg-2 mr-1">New spots for</span>
            <ClientChip label="no client" active={clientId === null} onClick={() => setClientId(null)} />
            {clients.map((c) => (
              <ClientChip key={c.id} label={c.name} active={clientId === c.id} onClick={() => setClientId(c.id)} />
            ))}
          </div>
        )}

        {groups?.map((group) => (
          <section key={group.adType} className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold tracking-tight">{group.adType}</h2>
              <span className="text-xs text-fg-3">{clientId === null ? 'Start a new spot from a template' : `Start a new spot for ${clients.find((c) => c.id === clientId)?.name ?? 'the client'}`}</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {group.templates.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  disabled={busySlug !== null}
                  onClick={() => open(t)}
                  className="group text-left rounded-lg bg-panel border border-line overflow-hidden transition-colors hover:border-line-strong hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-60"
                >
                  <div className="aspect-video bg-stage overflow-hidden">
                    <img src={api.fileUrl(t.thumbUrl)} alt="" className="w-full h-full object-cover block transition-transform duration-300 group-hover:scale-[1.02]" />
                  </div>
                  <div className="p-3.5">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-fg-3 mt-1 flex gap-3 tabular-nums">
                      <span>{formatTimecode(t.durationFrames, t.fps)}</span>
                      <span>
                        {t.width}×{t.height}
                      </span>
                      <span>{t.fps} fps</span>
                    </div>
                    {busySlug === t.slug && <div className="text-xs text-blue mt-2">Creating project…</div>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {groups && (
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold tracking-tight">From nothing</h2>
              <span className="text-xs text-fg-3">{clientId === null ? 'An empty spot, built from the element library' : `An empty spot for ${clients.find((c) => c.id === clientId)?.name ?? 'the client'}, built from the element library`}</span>
            </div>
            <button
              type="button"
              aria-label="Start a spot from nothing"
              disabled={busySlug !== null}
              onClick={() => void startBlank()}
              className="group text-left rounded-lg bg-panel border border-dashed border-line-strong overflow-hidden transition-colors hover:border-blue hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-60 w-[calc((100%-2rem)/3)]"
            >
              <div className="aspect-video bg-stage flex items-center justify-center">
                <span className="text-sm font-medium text-fg-2 group-hover:text-fg">Empty spot</span>
              </div>
              <div className="p-3.5">
                <div className="text-sm font-medium">Start from nothing</div>
                <div className="text-xs text-fg-3 mt-1">Add scenes and overlays from every template</div>
                {busySlug === 'blank' && <div className="text-xs text-blue mt-2">Creating project…</div>}
              </div>
            </button>
          </section>
        )}

        <ClientsPanel clients={clients} onCreate={api.createClient} onUpdate={api.updateClient} onDelete={api.deleteClient} onChange={() => void loadClients()} />

        <div ref={addSection}>
          <AddTemplate open={adding || groups?.length === 0} onOpenChange={setAdding} onIngested={() => void loadGroups()} />
        </div>
      </div>
    </main>
  );
}

/** M33: one client in the "new spots for" row. */
function ClientChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`New spots for ${label}`}
      aria-pressed={active}
      onClick={onClick}
      className={`cc-press h-8 px-3.5 rounded-full text-xs font-medium ${active ? 'bg-blue text-on-blue' : 'bg-raised border border-line text-fg-2 hover:text-fg hover:bg-hover'}`}
    >
      {label}
    </button>
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

  const iconButton = 'cc-press inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs text-fg-2 hover:text-fg hover:bg-hover disabled:opacity-40';

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold tracking-tight">Projects</h2>
        <span className="text-xs text-fg-3">Your spots, newest first</span>
      </div>
      <ul className="rounded-lg bg-panel border border-line divide-y divide-line overflow-hidden">
        {projects.map((p) => (
          <li key={p.id} data-testid={`project-row-${p.id}`} className="flex items-center gap-4 px-4 h-12 hover:bg-raised transition-colors">
            <div className="flex-1 min-w-0">
              {renamingId === p.id ? (
                <input
                  autoFocus
                  aria-label={`New name for ${p.name}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onRenameKey(e, p)}
                  onBlur={() => void commitRename(p)}
                  className="field !py-1.5"
                />
              ) : (
                <button type="button" aria-label={`Open ${p.name}`} onClick={() => onOpen(p.id)} className="block w-full text-sm font-medium text-left truncate hover:text-blue transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue">
                  {p.name}
                </button>
              )}
            </div>
            <span className="text-xs text-fg-2 w-40 truncate">{p.templateName}</span>
            <span className="text-xs text-fg-3 w-40 truncate">{p.clientName ?? ''}</span>
            <span className="text-xs text-fg-3 w-36 tabular-nums">{shortStamp(p.updatedAt)}</span>
            <div className="flex gap-1">
              <button type="button" aria-label={`Rename ${p.name}`} onClick={() => startRename(p)} disabled={busyId === p.id} className={iconButton}>
                <Pencil size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
                Rename
              </button>
              <button type="button" aria-label={`Duplicate ${p.name}`} onClick={() => void duplicate(p)} disabled={busyId === p.id} className={iconButton}>
                <Copy size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
                Duplicate
              </button>
              {confirmingId === p.id ? (
                <>
                  <Button size="sm" variant="danger" aria-label={`Confirm delete ${p.name}`} onClick={() => void remove(p)} disabled={busyId === p.id}>
                    Really delete
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Keep ${p.name}`} onClick={() => setConfirmingId(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <button type="button" aria-label={`Delete ${p.name}`} onClick={() => setConfirmingId(p.id)} disabled={busyId === p.id} className={`${iconButton} hover:!text-red-ink`}>
                  <Trash2 size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
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
