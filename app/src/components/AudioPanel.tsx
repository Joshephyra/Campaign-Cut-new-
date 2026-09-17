import { Check, VolumeX } from 'lucide-react';
import type { MediaAsset, ProjectAudio } from '../api';
import { ICON, Slider } from './ui';

type Props = {
  /** Every uploaded asset; only the audio ones are offered. */
  assets: MediaAsset[];
  audio: ProjectAudio | null;
  onChange: (audio: ProjectAudio | null) => void;
};

/**
 * M20: the project's music bed. One track, a volume, and where in the
 * track to start. Nothing else: no ducking, no fades, no multi-track.
 * M29/M30: tracks are rows to press; volume and start are sliders.
 */
export function AudioPanel({ assets, audio, onChange }: Props) {
  const tracks = assets.filter((a) => a.kind === 'audio');
  const chosen = audio ? tracks.find((t) => t.id === audio.assetId) : undefined;
  const row = (active: boolean) =>
    `w-full text-left flex items-center gap-2.5 h-9 px-3 rounded-md text-xs transition-colors ${active ? 'bg-blue-tint text-fg' : 'text-fg-2 hover:bg-hover hover:text-fg'}`;

  return (
    <div>
      {tracks.length === 0 ? (
        <p className="text-xs text-fg-2">No tracks yet. Upload an mp3 or wav in the Footage panel.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          <li>
            <button type="button" aria-pressed={audio === null} onClick={() => onChange(null)} className={row(audio === null)}>
              <VolumeX size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" className={audio === null ? 'text-blue' : 'text-fg-3'} />
              <span className="flex-1">No music</span>
              {audio === null && <Check size={14} strokeWidth={2} aria-hidden="true" className="text-blue" />}
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
                  className={row(active)}
                >
                  <span aria-hidden="true" className={`w-4 h-4 rounded-xs shrink-0 ${active ? 'bg-blue' : 'bg-line-strong'}`} />
                  <span className="flex-1 truncate">{t.originalName}</span>
                  <span className="text-[11px] text-fg-3 tabular-nums">{t.durationS.toFixed(1)} s</span>
                  {active && <Check size={14} strokeWidth={2} aria-hidden="true" className="text-blue" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {audio && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Slider label="Music volume" name="Volume" min={0} max={100} step={1} value={Math.round(audio.volume * 100)} format={(v) => `${v}%`} onChange={(n) => onChange({ ...audio, volume: n / 100 })} />
          <Slider
            label="Music start"
            name="Start at"
            min={0}
            max={Math.max(chosen?.durationS ?? 0, audio.inS, 0.1)}
            step={0.1}
            value={audio.inS}
            format={(v) => `${v.toFixed(1)} s`}
            onChange={(n) => {
              if (Number.isFinite(n) && n >= 0) onChange({ ...audio, inS: Math.round(n * 10) / 10 });
            }}
          />
        </div>
      )}
    </div>
  );
}
