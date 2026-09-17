import { ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { useState } from 'react';
import { api, type LibraryFont } from '../api';
import { ICON } from './ui';

/**
 * M59: the fonts the ingest can use without a handover. Uploaded faces live
 * in the server's font library; the ingest also reads every font installed
 * on this computer and asks Google Fonts. The list loads when opened, so the
 * template form costs nothing until someone looks.
 */
export function FontLibrary() {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<LibraryFont[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const list = await api.fonts();
      setFonts(Array.isArray(list) ? list : []);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && fonts === null) void load();
  };
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const added = await api.uploadFonts(Array.from(files));
      setFonts((prev) => [...(prev ?? []).filter((p) => !added.some((a) => a.file === p.file)), ...added].sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="font-library" className="rounded-lg bg-raised border border-line">
      <button type="button" aria-expanded={open} onClick={toggle} className="w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-fg hover:bg-hover rounded-lg transition-colors">
        {open ? <ChevronDown size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-3" /> : <ChevronRight size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-3" />}
        Fonts on hand
        <span className="ml-auto text-[11px] font-normal text-fg-3">installed fonts, Google Fonts, and what is uploaded here</span>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-[11px] text-fg-3">
            An ingest looks for each face in the handover, in the fonts already in the app, here, in the fonts installed on this computer, and on Google Fonts, in that order. Upload a face only when an ingest says it was not found.
          </p>
          {fonts === null && !error ? (
            <p className="text-[11px] text-fg-3">Loading…</p>
          ) : fonts && fonts.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Uploaded fonts">
              {fonts.map((f) => (
                <li key={f.file} className="h-6 px-2 rounded-md bg-panel border border-line text-[11px] text-fg-2 inline-flex items-center" title={f.file}>
                  {f.family} · {f.style}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-fg-3">Nothing uploaded yet.</p>
          )}
          <label className="inline-flex items-center gap-1.5 self-start h-7 px-2.5 rounded-md bg-panel border border-line hover:border-line-strong text-xs font-medium text-fg cursor-pointer transition-colors">
            <Upload size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-blue" />
            {busy ? 'Uploading…' : 'Upload font files'}
            <input type="file" multiple accept=".ttf,.otf,.ttc,.woff,.woff2" className="sr-only" aria-label="Font files" disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
          </label>
          {error && <p className="text-[11px] text-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
