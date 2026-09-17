import { formatTimecode } from '@campaigncut/composition';
import { Film, Music, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { api, type MediaAsset, type ProjectAudio } from '../api';
import { AudioPanel } from './AudioPanel';
import { StockPanel } from './StockPanel';
import { ICON } from './ui';

/** The drag payload a library clip carries onto the monitor (M30). */
export const ASSET_DRAG_TYPE = 'application/x-campaigncut-asset';

type Props = {
  /** Called with the chosen asset when the user presses one; the editor hands it to the selected element's slot. */
  onSelect?: (asset: MediaAsset) => void;
  selectedId?: number;
  /** Fired whenever the list is (re)loaded, so the editor can share it with the inspector. */
  onChange?: (assets: MediaAsset[]) => void;
  /** M30: the music bed lives in this panel's Music section when the editor passes it. */
  audio?: ProjectAudio | null;
  onAudioChange?: (audio: ProjectAudio | null) => void;
};

/**
 * The library (M30): everything the user has uploaded, as thumbnails to
 * press or drag onto the video, and the music bed below.
 */
export function MediaPanel({ onSelect, selectedId, onChange, audio, onAudioChange }: Props) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () =>
    api
      .media()
      .then((list) => {
        setAssets(list);
        onChange?.(list);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void refresh();
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStatus(`Uploading ${file.name}…`);
    try {
      await api.uploadMedia(file);
      await refresh();
      setStatus(null);
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onDragStart = (asset: MediaAsset) => (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(ASSET_DRAG_TYPE, String(asset.id));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const clips = assets?.filter((a) => a.kind !== 'audio') ?? [];
  const tracks = assets?.filter((a) => a.kind === 'audio') ?? [];

  return (
    <div className="flex flex-col">
      <section className="px-4 py-4 border-b border-line">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold flex items-center gap-2">
            <Film size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-2" />
            Footage
          </h2>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md bg-raised border border-line text-fg hover:bg-hover hover:border-line-strong transition-colors">
              <Upload size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
              Upload
            </span>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,audio/*,.mp4,.mov,.m4v,.webm,.mxf,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              className="sr-only"
              data-testid="media-file-input"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
        </div>

        {status && <p className="text-xs text-blue mb-2">{status}</p>}
        {error && <p className="text-xs text-red mb-2">{error}</p>}
        {assets !== null && clips.length === 0 && !status && (
          <div className="rounded-lg border border-dashed border-line-strong p-4 text-center">
            <p className="text-xs text-fg-2">No footage yet. Upload a clip.</p>
            <p className="text-[11px] text-fg-3 mt-1">mp4, mov or webm. Drag it onto the video once it is here.</p>
          </div>
        )}

        {clips.length > 0 && (
          <ul className="grid grid-cols-2 gap-2">
            {clips.map((a) => {
              const fps = Math.max(1, Math.round(a.fps));
              const selected = a.id === selectedId;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    draggable
                    data-testid={`library-asset-${a.id}`}
                    onDragStart={onDragStart(a)}
                    onClick={() => onSelect?.(a)}
                    title="Press to use in the selected scene, or drag onto the video"
                    className={`group w-full text-left rounded-lg overflow-hidden bg-raised border transition-colors cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
                      selected ? 'border-blue' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="relative aspect-video bg-stage">
                      {a.thumbUrl && <img src={api.fileUrl(a.thumbUrl)} alt="" className="w-full h-full object-cover block" draggable={false} />}
                      <span className="absolute bottom-1 right-1 px-1 py-px rounded-xs bg-black/70 text-[10px] text-fg tabular-nums">{formatTimecode(Math.round(a.durationS * a.fps), fps)}</span>
                      {selected && <span className="absolute top-1 left-1 px-1.5 py-px rounded-xs bg-blue text-[10px] font-semibold text-white">In use</span>}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-xs truncate">{a.originalName}</div>
                      <div className="text-[11px] text-fg-3 mt-0.5 flex gap-2 tabular-nums">
                        <span>
                          {a.width}×{a.height}
                        </span>
                        <span>{Math.round(a.fps * 100) / 100} fps</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <StockPanel onImported={() => void refresh()} />
      </section>

      <section className="px-4 py-4 border-b border-line">
        <h2 className="text-[13px] font-semibold flex items-center gap-2 mb-3">
          <Music size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-2" />
          Music
        </h2>
        {onAudioChange ? (
          <AudioPanel assets={assets ?? []} audio={audio ?? null} onChange={onAudioChange} />
        ) : tracks.length === 0 ? (
          <p className="text-xs text-fg-2">No tracks yet. Upload an mp3 or wav.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tracks.map((t) => (
              <li key={t.id} className="flex items-center justify-between h-9 px-3 rounded-md bg-raised text-xs">
                <span className="truncate">{t.originalName}</span>
                <span className="text-fg-3 tabular-nums">{t.durationS.toFixed(1)} s</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="px-4 py-3 text-[11px] text-fg-3">Upload also accepts mp3 and wav for music.</p>
    </div>
  );
}
