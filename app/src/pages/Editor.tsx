import {
  applyLottieValues,
  compositionConfig,
  isMediaValue,
  lottieDurationInFrames,
  Main,
  mediaFillRect,
  mediaSourceFor,
  resolveLottieAssets,
  withBaseUrl,
  type LottieAnimationData,
  type MainProps,
  type ParamValues,
} from '@campaigncut/composition';
import { Player } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API, api, type MediaAsset, type ProjectDetail } from '../api';
import { Inspector } from '../components/Inspector';
import { MediaPanel } from '../components/MediaPanel';

const BACKGROUND = '#000000';
/** Keep typing smooth: the composition re-applies values this long after the last keystroke. */
const RENDER_DEBOUNCE_MS = 60;
/** Persist this long after the last change. */
const SAVE_DEBOUNCE_MS = 400;

type Props = {
  projectId: number;
  onBack: () => void;
};

type Loaded = { detail: ProjectDetail; lottie: LottieAnimationData };
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function Editor({ projectId, onBack }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ParamValues>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [assets, setAssets] = useState<MediaAsset[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .project(projectId)
      .then(async (detail) => {
        const lottie = await api.templateLottie(detail.template.slug);
        if (cancelled) return;
        const initial: ParamValues = {};
        for (const v of detail.values) initial[v.key] = v.value;
        setValues(initial);
        setLoaded({ detail, lottie });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const refreshAssets = useCallback(() => {
    api
      .media()
      .then(setAssets)
      .catch(() => setAssets([]));
  }, []);
  useEffect(refreshAssets, [refreshAssets]);

  // Persist changed values, debounced. Only the keys that changed are sent.
  const lastSaved = useRef<ParamValues | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (lastSaved.current === null) {
      lastSaved.current = values; // the values we loaded with; nothing to save yet
      return;
    }
    if (lastSaved.current === values) return;
    setSaveState('dirty');
    const timer = setTimeout(async () => {
      const previous = lastSaved.current ?? {};
      const elementId = loaded.detail.elements[0]?.id;
      if (elementId === undefined) return;
      const changed = Object.entries(values)
        .filter(([key, value]) => previous[key] !== value)
        .map(([key, value]) => ({ elementId, key, value }));
      if (changed.length === 0) return;
      setSaveState('saving');
      try {
        await api.saveValues(projectId, changed);
        lastSaved.current = values;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [values, loaded, projectId]);

  /** The Footage panel's "use this clip" hands the asset to the first cc.mediaFill param. */
  const selectFootage = (asset: MediaAsset) => {
    const mediaParam = loaded?.detail.schema.find((p) => p.kind === 'media');
    if (!mediaParam) return;
    const current = values[mediaParam.key];
    setValues({ ...values, [mediaParam.key]: { assetId: asset.id, fit: isMediaValue(current) ? current.fit : 'cover' } });
  };

  const selectedAssetId = (() => {
    const mediaParam = loaded?.detail.schema.find((p) => p.kind === 'media');
    const v = mediaParam ? values[mediaParam.key] : null;
    return isMediaValue(v) ? v.assetId : undefined;
  })();

  return (
    <main className="min-h-screen bg-ink text-fg flex flex-col">
      <header className="border-b border-hairline px-8 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="text-xs text-muted hover:text-fg">
            ← Library
          </button>
          <h1 className="text-sm font-semibold tracking-tight">{loaded?.detail.project.name ?? '…'}</h1>
        </div>
        <div className="font-mono text-xs text-muted flex gap-4">
          <SaveIndicator state={saveState} />
          <span>{loaded ? loaded.detail.template.slug : `project ${projectId}`}</span>
        </div>
      </header>

      {error && <p className="font-mono text-xs text-danger p-8">Could not open the project: {error}</p>}
      {!loaded && !error && <p className="font-mono text-xs text-muted p-8">Loading…</p>}
      {loaded && (
        <div className="flex flex-1 min-h-0">
          <Monitor loaded={loaded} values={values} assets={assets} />
          <aside className="w-80 border-l border-hairline shrink-0 overflow-y-auto">
            <div className="p-6 border-b border-hairline">
              <h2 className="text-xs uppercase tracking-widest text-muted mb-4">Inspector</h2>
              <Inspector
                schema={loaded.detail.schema}
                values={values}
                onChange={setValues}
                assets={assets}
                templateSlug={loaded.detail.template.slug}
              />
            </div>
            <div className="p-6">
              <MediaPanel onSelect={selectFootage} selectedId={selectedAssetId} onChange={setAssets} />
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const text = { dirty: 'Unsaved', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[state];
  const colour = state === 'error' ? 'text-danger' : state === 'saved' ? 'text-muted' : 'text-cobalt';
  return <span className={colour}>{text}</span>;
}

/** A value that trails `value` by `delay` ms, so fast typing does not re-render the video on every keystroke. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * The PREVIEW RUNNER's props. Same composition as the server, handed the
 * PROXY footage and /api-relative URLs. See server/src/renderProject.ts for
 * the export runner doing the same with originals.
 */
function Monitor({ loaded, values, assets }: { loaded: Loaded; values: ParamValues; assets: MediaAsset[] }) {
  const { detail, lottie: source } = loaded;
  const schema = detail.schema;
  const slug = detail.template.slug;

  const renderedValues = useDebounced(values, RENDER_DEBOUNCE_MS);
  const resolvedSource = useMemo(() => resolveLottieAssets(source, `${API}/templates/${slug}`), [source, slug]);
  const resolvedValues = useMemo(() => withBaseUrl(renderedValues, schema, API), [renderedValues, schema]);
  const lottie = useMemo(() => applyLottieValues(resolvedSource, resolvedValues, schema), [resolvedSource, resolvedValues, schema]);

  const media = useMemo<MainProps['media']>(() => {
    const mediaParam = schema.find((p) => p.kind === 'media');
    const v = mediaParam ? renderedValues[mediaParam.key] : null;
    if (!mediaParam || !isMediaValue(v)) return null;
    const asset = assets.find((a) => a.id === v.assetId);
    const rect = mediaFillRect(source, mediaParam.path);
    if (!asset || !rect) return null;
    return { src: api.fileUrl(mediaSourceFor(asset, 'preview')), rect, fit: v.fit };
  }, [schema, renderedValues, assets, source]);

  const inputProps = useMemo<MainProps>(() => ({ background: BACKGROUND, lottie, media }), [lottie, media]);
  const durationInFrames = lottieDurationInFrames(lottie, compositionConfig.fps);

  return (
    // Program monitor. Nothing ever overlays this.
    <section className="flex-1 p-8 min-w-0">
      <Player
        component={Main}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={compositionConfig.fps}
        compositionWidth={compositionConfig.width}
        compositionHeight={compositionConfig.height}
        controls
        loop
        style={{ width: '100%' }}
      />
      <p className="font-mono text-xs text-muted mt-3">
        {compositionConfig.width}×{compositionConfig.height} · {compositionConfig.fps} fps · {durationInFrames} frames
        {media ? ' · footage: proxy' : ''}
      </p>
    </section>
  );
}
