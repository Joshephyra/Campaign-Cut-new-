import type { MediaAsset, ProjectAudio } from '../api';

type Props = {
  /** Every uploaded asset; only the audio ones are offered. */
  assets: MediaAsset[];
  audio: ProjectAudio | null;
  onChange: (audio: ProjectAudio | null) => void;
};

/**
 * M20: the project's music bed. One track, a volume, and where in the
 * track to start. Nothing else: no ducking, no fades, no multi-track.
 * M29: tracks are rows to press and the start point is a slider.
 */
export function AudioPanel({ assets, audio, onChange }: Props) {
  const tracks = assets.filter((a) => a.kind === 'audio');
  const chosen = audio ? tracks.find((t) => t.id === audio.assetId) : undefined;
  const rowClass = (active: boolean) =>
    `w-full text-left flex items-center justify-between gap-3 px-3 h-9 text-xs ${active ? 'border-l-2 border-cobalt text-cobalt pl-[10px]' : 'text-fg hover:bg-panel'}`;

  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">Music</h2>
      {tracks.length === 0 ? (
        <p className="text-xs text-muted">No tracks yet. Upload an mp3 or wav in the Footage panel.</p>
      ) : (
        <ul className="border border-hairline divide-y divide-hairline">
          <li>
            <button type="button" aria-pressed={audio === null} onClick={() => onChange(null)} className={rowClass(audio === null)}>
              <span>No music</span>
            </button>
          </li>
          {tracks.map((t) => {
            const active = audio?.assetId === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-label={`Use ${t.originalName}`}
                  aria-pressed={active}
                  onClick={() => onChange({ assetId: t.id, volume: audio?.volume ?? 1, inS: audio?.inS ?? 0 })}
                  className={rowClass(active)}
                >
                  <span className="truncate">{t.originalName}</span>
                  <span className="font-mono text-[10px] text-muted shrink-0">{t.durationS.toFixed(1)} s</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {audio && (
        <div className="mt-3 flex flex-col gap-2 text-[11px] text-muted">
          <label className="flex items-center gap-2">
            <span className="w-12 shrink-0">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              aria-label="Music volume"
              value={Math.round(audio.volume * 100)}
              onChange={(e) => onChange({ ...audio, volume: Number(e.target.value) / 100 })}
              className="flex-1 accent-cobalt min-w-0"
            />
            <span className="font-mono w-12 text-right text-fg tabular-nums">{Math.round(audio.volume * 100)}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12 shrink-0">Start at</span>
            <input
              type="range"
              min={0}
              max={Math.max(chosen?.durationS ?? 0, audio.inS, 0.1)}
              step={0.1}
              aria-label="Music start"
              value={audio.inS}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) onChange({ ...audio, inS: Math.round(n * 10) / 10 });
              }}
              className="flex-1 accent-cobalt min-w-0"
            />
            <span className="font-mono w-12 text-right text-fg tabular-nums">{audio.inS.toFixed(1)} s</span>
          </label>
        </div>
      )}
    </div>
  );
}
