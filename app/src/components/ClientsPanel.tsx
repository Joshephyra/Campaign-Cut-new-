import { COLOR_ROLES, hexToRgba } from '@campaigncut/composition';
import { Building2, ImageUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { api, type Client, type ClientInput } from '../api';
import { Button, FieldLabel, ICON } from './ui';

type Props = {
  clients: Client[];
  onCreate: (input: ClientInput) => Promise<Client>;
  onUpdate: (id: number, input: ClientInput) => Promise<Client>;
  onDelete: (id: number) => Promise<void>;
  /** After any change, so the library reloads the list. */
  onChange: () => void;
};

/**
 * M33: the clients an agency keeps: a name, a logo, the brand colours and
 * the disclaimer. A spot made for a client opens already branded. This is
 * a record in the library, not an account.
 */
export function ClientsPanel({ clients, onCreate, onUpdate, onDelete, onChange }: Props) {
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: ClientInput) => {
    setError(null);
    try {
      if (editing === 'new') await onCreate(input);
      else if (editing) await onUpdate(editing.id, input);
      setEditing(null);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (id: number) => {
    setError(null);
    try {
      await onDelete(id);
      setConfirmingId(null);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold tracking-tight">Clients</h2>
        {editing === null && (
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
            Add a client
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-ink mb-3">{error}</p>}
      {clients.length === 0 && editing === null && (
        <p className="text-xs text-fg-2 mb-3">No clients yet. A client is a brand guide: logo, colours and disclaimer. Spots made for a client open already branded.</p>
      )}
      {clients.length > 0 && (
        <ul className="rounded-xl bg-panel border border-line divide-y divide-line overflow-hidden mb-3">
          {clients.map((c) => (
            <li key={c.id} data-testid={`client-row-${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-raised transition-colors">
              <div className="w-14 h-10 rounded-md bg-raised border border-line flex items-center justify-center overflow-hidden shrink-0">
                {c.logoUrl ? <img src={api.fileUrl(c.logoUrl)} alt="" className="max-w-full max-h-full object-contain" /> : <Building2 size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-fg-3 truncate">{c.disclaimer || 'No disclaimer set'}</div>
              </div>
              <span className="flex rounded-xs overflow-hidden border border-line shrink-0">
                {COLOR_ROLES.map(({ role, label }) => (
                  <span key={role} title={label} aria-hidden="true" className="w-4 h-5 block" style={{ backgroundColor: c.colors[role] ?? 'transparent' }} />
                ))}
              </span>
              <div className="flex gap-1 shrink-0">
                <button type="button" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-fg-2 hover:text-fg hover:bg-hover transition-colors">
                  <Pencil size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
                  Edit
                </button>
                {confirmingId === c.id ? (
                  <>
                    <Button size="sm" variant="danger" aria-label={`Really delete ${c.name}`} onClick={() => void remove(c.id)}>
                      Really delete
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Keep ${c.name}`} onClick={() => setConfirmingId(null)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <button type="button" aria-label={`Delete ${c.name}`} onClick={() => setConfirmingId(c.id)} className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-fg-2 hover:text-red-ink hover:bg-hover transition-colors">
                    <Trash2 size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing !== null && <ClientForm initial={editing === 'new' ? null : editing} onSubmit={submit} onCancel={() => setEditing(null)} />}
    </section>
  );
}

function ClientForm({ initial, onSubmit, onCancel }: { initial: Client | null; onSubmit: (input: ClientInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? '');
  const [colors, setColors] = useState<Record<string, string>>(initial?.colors ?? {});
  const [disclaimer, setDisclaimer] = useState(initial?.disclaimer ?? '');
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    try {
      const { url } = await api.uploadImage(file);
      setLogoUrl(url);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const setColor = (role: string, raw: string) => {
    setColors((prev) => {
      const next = { ...prev };
      if (raw.trim() === '') delete next[role];
      else next[role] = raw;
      return next;
    });
  };
  const valid = name.trim().length > 0 && Object.values(colors).every((c) => hexToRgba(c) !== null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const cleaned: Record<string, string> = {};
    for (const [role, c] of Object.entries(colors)) if (hexToRgba(c)) cleaned[role] = c.toUpperCase();
    await onSubmit({ name: name.trim(), logoUrl, colors: cleaned, disclaimer: disclaimer.trim() });
    setBusy(false);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl bg-panel border border-line p-5 flex flex-col gap-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="client-name">Client name</FieldLabel>
          <input id="client-name" aria-label="Client name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rivera for Senate" className="field" autoFocus />
        </div>
        <div>
          <FieldLabel>Logo</FieldLabel>
          <label className="flex items-center gap-3 rounded-lg bg-raised border border-line hover:border-line-strong p-2 cursor-pointer transition-colors">
            <div className="w-16 h-10 rounded-md bg-raised border border-line flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? <img src={api.fileUrl(logoUrl)} alt="" data-testid="client-logo-preview" className="max-w-full max-h-full object-contain" /> : <span className="text-[11px] text-fg-3">none</span>}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
              <ImageUp size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-blue" />
              {logoUrl ? 'Replace' : 'Upload'}
            </span>
            <input ref={fileInput} type="file" accept="image/*" className="sr-only" data-testid="client-logo-input" onChange={(e) => void onLogo(e.target.files?.[0])} />
          </label>
          {uploadError && <p className="text-[11px] text-red-ink mt-1">{uploadError}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {COLOR_ROLES.map(({ role, label }) => {
          const value = colors[role] ?? '';
          const ok = value === '' || hexToRgba(value) !== null;
          return (
            <div key={role}>
              <FieldLabel htmlFor={`client-color-${role}`}>{label}</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${label} swatch`}
                  value={hexToRgba(value) ? value.toLowerCase() : '#000000'}
                  onChange={(e) => setColor(role, e.target.value.toUpperCase())}
                  className="swatch shrink-0"
                />
                <input id={`client-color-${role}`} aria-label={label} value={value} placeholder="Leave empty to keep the designer's" onChange={(e) => setColor(role, e.target.value)} spellCheck={false} aria-invalid={!ok} className="field tabular-nums uppercase" />
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <FieldLabel htmlFor="client-disclaimer">Disclaimer</FieldLabel>
        <input id="client-disclaimer" aria-label="Disclaimer" value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} placeholder="Paid for by Rivera for Senate" className="field" />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={!valid || busy}>
          Save client
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
