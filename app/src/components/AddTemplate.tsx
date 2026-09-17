import { FolderUp } from 'lucide-react';
import { FontLibrary } from './FontLibrary';
import { useRef, useState, type FormEvent } from 'react';
import { api, type IngestAnswer } from '../api';
import { Button, FieldLabel } from './ui';

/** The ad types the library groups by; anything typed is accepted too. */
const AD_TYPES = ['Contrast', 'Bio', 'Issue', 'GOTV', 'Endorsement'];

type Props = {
  /** Called after a successful ingest so the library reloads. */
  onIngested: (slug: string) => void;
  /** M30: the library's top-bar button opens the form from outside. Uncontrolled when absent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * M24: run the ingest without a terminal. Pick the handover folder (the
 * browser hands over every file with its path inside it), name it, choose
 * an ad type, press Ingest. The server runs the same ingest command and
 * its output, problems included, comes back here.
 */
export function AddTemplate({ onIngested, open: openProp, onOpenChange }: Props) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
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
        <span className="text-base font-semibold tracking-tight">Add a template</span>
        {open && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(false)} className="text-xs font-medium text-fg-3 hover:text-fg transition-colors">
            Close
          </button>
        )}
      </div>
      {!open && (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong hover:border-blue hover:bg-blue-tint/40 p-8 text-center transition-colors"
        >
          <FolderUp size={22} strokeWidth={1.75} aria-hidden="true" className="text-blue" />
          <span className="text-[13px] font-medium text-fg">From an After Effects export…</span>
          <span className="text-xs text-fg-3">A handover folder of Bodymovin exports, fonts and the reference render becomes a template in the library.</span>
        </button>
      )}
      {open && (
        <form onSubmit={(e) => void submit(e)} className="rounded-xl bg-panel border border-line p-5 flex flex-col gap-4 max-w-2xl">
          <p className="text-xs text-fg-2">
            Pick the handover folder: one Bodymovin export, or one sub-folder per element with an optional elements.json, plus fonts/ and reference.mp4. See docs/AE-AUTHORING.md.
          </p>
          <div>
            <FieldLabel>Handover folder</FieldLabel>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong hover:border-blue hover:bg-blue-tint/40 p-6 cursor-pointer transition-colors text-center">
              <FolderUp size={22} strokeWidth={1.75} aria-hidden="true" className="text-blue" />
              <span className="text-[13px] font-medium text-fg">{folderName ? `${files.length} file${files.length === 1 ? '' : 's'} from "${folderName}"` : 'Choose the handover folder'}</span>
              <span className="text-xs text-fg-3">The whole folder: the Bodymovin exports, fonts and reference render</span>
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
                className="sr-only"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="template-name">Template name</FieldLabel>
              <input id="template-name" aria-label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrast :30 / Split Record" className="field" />
            </div>
            <div>
              <FieldLabel htmlFor="ad-type">Ad type</FieldLabel>
              <input id="ad-type" aria-label="Ad type" list="ad-types" value={adType} onChange={(e) => setAdType(e.target.value)} className="field" />
              <datalist id="ad-types">
                {AD_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={busy || files.length === 0 || !name.trim() || !adType.trim()}>
              {busy ? 'Ingesting… (the thumbnail render takes a moment)' : 'Ingest'}
            </Button>
            {error && <span className="text-xs text-red-ink">{error}</span>}
          </div>
          {answer && !answer.ok && (
            <div data-testid="ingest-problems" className="rounded-lg bg-red-tint border border-red/40 p-3">
              <p className="text-xs text-red-ink font-medium mb-2">
                Ingest rejected. {answer.problems.length} problem{answer.problems.length === 1 ? '' : 's'}. Nothing written.
              </p>
              <ul className="text-xs text-fg list-disc pl-4 flex flex-col gap-1">
                {answer.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {answer?.ok && <p className="text-xs text-green">Ingested "{answer.slug}". It is in the library above.</p>}
          {answer && (
            <details className="text-[11px] text-fg-3">
              <summary className="cursor-pointer">Full output</summary>
              <pre className="whitespace-pre-wrap mt-2 rounded-md bg-raised border border-line p-3 text-fg-2">{answer.output}</pre>
            </details>
          )}
          <FontLibrary />
        </form>
      )}
    </section>
  );
}
