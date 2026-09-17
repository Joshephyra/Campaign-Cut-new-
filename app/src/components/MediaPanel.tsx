import { formatTimecode } from '@campaigncut/composition';
import { useEffect, useRef, useState } from 'react';
import { api, type MediaAsset } from '../api';

type Props = {
  /** Called with the chosen asset when the user picks one; the editor hands it to cc.mediaFill. */
  onSelect?: (asset: MediaAsset) => void;
  selectedId?: number;
  /** Fired whenever the list is (re)loaded, so the editor can share it with the inspector. */
  onChange?: (assets: MediaAsset[]) => void;
};

/** Uploaded footage: thumbnail, name, duration, dimensions. */
export function MediaPanel({ onSelect, selectedId, onChange }: Props) {
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

  return (
    <div>
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">Footage</h2>
        <label className="text-xs text-cobalt cursor-pointer">
          Upload
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

      {status && <p className="font-mono text-[10px] text-cobalt mb-2">{status}</p>}
      {error && <p className="font-mono text-[10px] text-danger mb-2">{error}</p>}
      {assets?.length === 0 && !status && <p className="font-mono text-[10px] text-muted">No footage yet. Upload a clip.</p>}

      <ul className="flex flex-col gap-px bg-hairline border border-hairline">
        {assets?.map((a) => {
          const fps = Math.max(1, Math.round(a.fps));
          const selected = a.id === selectedId;
          return (
            <li key={a.id} className="bg-ink">
              <button
                type="button"
                onClick={() => onSelect?.(a)}
                className={`w-full text-left flex gap-3 p-2 hover:bg-panel focus:outline-none ${selected ? 'border-l-2 border-cobalt' : ''}`}
              >
                {a.thumbUrl ? (
                  <img src={api.fileUrl(a.thumbUrl)} alt="" className="w-20 aspect-video object-cover bg-black block shrink-0" />
                ) : (
                  <div aria-hidden="true" className="w-20 aspect-video bg-panel border border-hairline shrink-0 flex items-center justify-center font-mono text-xs text-muted">
                    ♪
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs truncate">{a.originalName}</div>
                  <div className="font-mono text-[10px] text-muted mt-1 flex gap-2">
                    {a.kind === 'audio' ? (
                      <>
                        <span>{a.durationS.toFixed(1)} s</span>
                        <span>audio</span>
                      </>
                    ) : (
                      <>
                        <span>{formatTimecode(Math.round(a.durationS * a.fps), fps)}</span>
                        <span>
                          {a.width}×{a.height}
                        </span>
                        <span>{Math.round(a.fps * 100) / 100} fps</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
