import { Upload } from 'lucide-react';
import { useState } from 'react';
import { api, type LibraryFont } from '../api';
import { CHIP_CLASS, ICON, Section } from './ui';

/**
 * M59: the fonts the ingest can use without a handover. Uploaded faces live
 * in the server's font library; the ingest also reads every font installed
 * on this computer and asks Google Fonts. Folded like every other section
 * (M62); the list loads on first open, so the template form costs nothing
 * until someone looks.
 */
export function FontLibrary() {
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
    <Section
      level={3}
      id="fonts-on-hand"
      title="Fonts on hand"
      defaultCollapsed
      note="An ingest looks for each face in the handover, in the fonts already in the app, here, in the fonts installed on this computer, and on Google Fonts, in that order. Upload a face only when an ingest says it was not found."
      onToggle={(collapsed) => {
        if (!collapsed && fonts === null) void load();
      }}
      className="rounded-lg bg-raised border border-line px-3 py-2"
    >
      <div data-testid="font-library" className="flex flex-col gap-2">
        {fonts === null && !error ? (
          <p className="text-[11px] text-fg-3">Loading…</p>
        ) : fonts && fonts.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Uploaded fonts">
            {fonts.map((f) => (
              <li key={f.file} className={`${CHIP_CLASS} bg-panel border border-line text-fg-2`} title={f.file}>
                {f.family} · {f.style}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-fg-3">Nothing uploaded yet.</p>
        )}
        <label className={`${CHIP_CLASS} self-start bg-panel border border-line text-fg hover:border-line-strong hover:bg-hover cursor-pointer`}>
          <Upload size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-blue" />
          {busy ? 'Uploading…' : 'Upload font files'}
          <input type="file" multiple accept=".ttf,.otf,.ttc,.woff,.woff2" className="sr-only" aria-label="Font files" disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
        </label>
        {error && <p className="text-[11px] text-red-ink">{error}</p>}
      </div>
    </Section>
  );
}
