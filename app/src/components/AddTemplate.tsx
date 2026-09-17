import { useRef, useState, type FormEvent } from 'react';
import { api, type IngestAnswer } from '../api';

/** The ad types the library groups by; anything typed is accepted too. */
const AD_TYPES = ['Contrast', 'Bio', 'Issue', 'GOTV', 'Endorsement'];

type Props = {
  /** Called after a successful ingest so the library reloads. */
  onIngested: (slug: string) => void;
};

/**
 * M24: run the ingest without a terminal. Pick the handover folder (the
 * browser hands over every file with its path inside it), name it, choose
 * an ad type, press Ingest. The server runs the same ingest command and
 * its output, problems included, comes back here.
 */
export function AddTemplate({ onIngested }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [adType, setAdType] = useState('Contrast');
  const [files, setFiles] = useState<{ path: string; file: File }[]>([]);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<IngestAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const onFolder = (list: FileList | null) => {
    const picked = Array.from(list ?? []).map((file) => ({ path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, file }));
    setFiles(picked);
    setAnswer(null);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setAnswer(null);
    setError(null);
    try {
      const result = await api.ingestTemplate(files, { name: name.trim(), adType: adType.trim() });
      setAnswer(result);
      if (result.ok) onIngested(result.slug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const folderName = files[0]?.path.split('/')[0] ?? null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Add template</span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="font-mono text-xs text-cobalt">
          {open ? 'Close' : 'From an After Effects export…'}
        </button>
      </div>
      {open && (
        <form onSubmit={(e) => void submit(e)} className="border border-hairline p-4 flex flex-col gap-3 max-w-2xl">
          <p className="font-mono text-[10px] text-muted">
            Pick the handover folder: one Bodymovin export, or one sub-folder per element with an optional elements.json, plus fonts/ and reference.mp4. See docs/AE-AUTHORING.md.
          </p>
          <label className="text-xs text-muted flex flex-col gap-1">
            Handover folder
            <input
              ref={folderInput}
              type="file"
              data-testid="handover-input"
              aria-label="Handover folder"
              multiple
              // @ts-expect-error non-standard attribute understood by every desktop browser
              webkitdirectory=""
              directory=""
              onChange={(e) => onFolder(e.target.files)}
              className="font-mono text-xs"
            />
            {folderName && (
              <span className="font-mono text-[10px]">
                {files.length} file{files.length === 1 ? '' : 's'} from "{folderName}"
              </span>
            )}
          </label>
          <label className="text-xs text-muted flex flex-col gap-1">
            Template name
            <input aria-label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrast :30 / Split Record" className="bg-panel border border-hairline px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-cobalt" />
          </label>
          <label className="text-xs text-muted flex flex-col gap-1">
            Ad type
            <input aria-label="Ad type" list="ad-types" value={adType} onChange={(e) => setAdType(e.target.value)} className="bg-panel border border-hairline px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-cobalt" />
            <datalist id="ad-types">
              {AD_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || files.length === 0 || !name.trim() || !adType.trim()}
              className="px-3 py-1.5 border border-cobalt text-cobalt text-xs font-mono hover:bg-cobalt hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-cobalt"
            >
              {busy ? 'Ingesting… (the thumbnail render takes a moment)' : 'Ingest'}
            </button>
            {error && <span className="font-mono text-xs text-danger">{error}</span>}
          </div>
          {answer && !answer.ok && (
            <div data-testid="ingest-problems" className="border border-danger p-3">
              <p className="font-mono text-xs text-danger mb-2">
                Ingest rejected. {answer.problems.length} problem{answer.problems.length === 1 ? '' : 's'}. Nothing written.
              </p>
              <ul className="font-mono text-[11px] text-fg list-disc pl-4 flex flex-col gap-1">
                {answer.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {answer?.ok && <p className="font-mono text-xs text-emerald-400">Ingested "{answer.slug}". It is in the library below.</p>}
          {answer && (
            <details className="font-mono text-[10px] text-muted">
              <summary>Full output</summary>
              <pre className="whitespace-pre-wrap mt-2">{answer.output}</pre>
            </details>
          )}
        </form>
      )}
    </section>
  );
}
