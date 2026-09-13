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
 */
export function AudioPanel({ assets, audio, onChange }: Props) {
  const tracks = assets.filter((a) => a.kind === 'audio');
  const chosen = audio ? tracks.find((t) => t.id === audio.assetId) : undefined;

  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-muted mb-3">Audio</h2>
      <label htmlFor="music-bed" className="text-xs text-muted block mb-1">
        Music bed
      </label>
      <select
        id="music-bed"
        aria-label="Music bed"
        value={audio ? String(audio.assetId) : ''}
        onChange={(e) => onChange(e.target.value ? { assetId: Number(e.target.value), volume: audio?.volume ?? 1, inS: audio?.inS ?? 0 } : null)}
        className="w-full bg-panel border border-hairline px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-cobalt"
      >
        <option value="">None</option>
        {tracks.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.originalName}
          </option>
        ))}
      </select>
      {tracks.length === 0 && <p className="font-mono text-[10px] text-muted mt-1">No tracks yet. Upload an mp3 or wav in the Footage panel.</p>}
      {audio && (
        <div className="mt-2 flex flex-col gap-2 font-mono text-[10px] text-muted">
          <label className="flex items-center gap-2">
            <span className="w-12">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              aria-label="Music volume"
              value={Math.round(audio.volume * 100)}
              onChange={(e) => onChange({ ...audio, volume: Number(e.target.value) / 100 })}
              className="flex-1 accent-cobalt"
            />
            <span className="w-8 text-right">{Math.round(audio.volume * 100)}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">Start</span>
            <input
              type="number"
              min={0}
              step={0.1}
              aria-label="Music start"
              value={audio.inS}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) onChange({ ...audio, inS: n });
              }}
              className="w-16 bg-panel border border-hairline px-1 py-0.5 text-fg focus:outline-none focus:border-cobalt"
            />
            <span>s into the track{chosen ? ` (${chosen.durationS.toFixed(1)} s long)` : ''}</span>
          </label>
        </div>
      )}
    </div>
  );
}
