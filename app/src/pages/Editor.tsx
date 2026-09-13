import {
  applyLottieValues,
  compositionConfig,
  compositionDurationWithTransitions,
  EMPTY_LOTTIE,
  fontsFor,
  isChromaKey,
  isMediaValue,
  Main,
  mediaFillRect,
  mediaSourceFor,
  resolveLottieAssets,
  withBaseUrl,
  type ElementProps,
  type LottieAnimationData,
  type MainProps,
  type ParamValues,
  type TransitionPreset,
  type TransitionProps,
} from '@campaigncut/composition';
import { Player, type PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API, api, type MediaAsset, type ProjectDetail, type ProjectElement, type ProjectTransition } from '../api';
import { ExportPanel } from '../components/ExportPanel';
import { Inspector } from '../components/Inspector';
import { MediaPanel } from '../components/MediaPanel';
import { Timeline, type ElementPatch } from '../components/Timeline';
import { measurePlayback, type PlaybackSummary } from '../perf';

const BACKGROUND = '#000000';
/** Keep typing smooth: the composition re-applies values this long after the last keystroke. */
const RENDER_DEBOUNCE_MS = 60;
/** Persist this long after the last change. */
const SAVE_DEBOUNCE_MS = 400;

type Props = {
  projectId: number;
  onBack: () => void;
};

/** Each element's Lottie, by element id (M17). */
type Lotties = Record<number, LottieAnimationData>;
/** Each element's values, by element id. */
type ValuesByElement = Record<number, ParamValues>;
type Loaded = { detail: ProjectDetail; lotties: Lotties };
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** Elements as they play: earliest first, then bottom of the stack first. */
function inStartOrder<T extends { startFrame: number; zIndex: number }>(elements: T[]): T[] {
  return [...elements].sort((a, b) => a.startFrame - b.startFrame || a.zIndex - b.zIndex);
}

/** The element whose media slot the Footage panel drives: the first, in start order, that has one. */
function mediaElementOf(elements: ProjectElement[]): ProjectElement | undefined {
  return inStartOrder(elements).find((e) => e.schema.some((p) => p.kind === 'media'));
}

export function Editor({ projectId, onBack }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ValuesByElement>({});
  const [elements, setElements] = useState<ProjectElement[]>([]);
  const [transitions, setTransitions] = useState<ProjectTransition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [assets, setAssets] = useState<MediaAsset[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .project(projectId)
      .then(async (detail) => {
        const loadedLotties = await Promise.all(detail.elements.map(async (e) => [e.id, await api.elementLottie(e.lottieUrl)] as const));
        if (cancelled) return;
        const lotties: Lotties = {};
        for (const [id, lottie] of loadedLotties) lotties[id] = lottie;
        const initial: ValuesByElement = {};
        for (const e of detail.elements) initial[e.id] = {};
        for (const v of detail.values) (initial[v.elementId] ??= {})[v.key] = v.value;
        setValues(initial);
        setElements(detail.elements.map((e) => ({ ...e, enabled: e.enabled ?? true })));
        setTransitions(detail.transitions ?? []);
        setSelectedId(inStartOrder(detail.elements)[0]?.id ?? null);
        setLoaded({ detail, lotties });
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

  // Persist changed values, debounced. Only the keys that changed are sent, each with its element.
  const lastSaved = useRef<ValuesByElement | null>(null);
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
      const changed = Object.entries(values).flatMap(([id, elementValues]) => {
        const elementId = Number(id);
        const before = previous[elementId] ?? {};
        return Object.entries(elementValues)
          .filter(([key, value]) => before[key] !== value)
          .map(([key, value]) => ({ elementId, key, value }));
      });
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

  // Persist element moves and toggles, debounced per element.
  const pendingPatches = useRef(new Map<number, ElementPatch>());
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onElementChange = (id: number, patch: ElementPatch) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    pendingPatches.current.set(id, { ...pendingPatches.current.get(id), ...patch });
    setSaveState('dirty');
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(async () => {
      const batch = Array.from(pendingPatches.current.entries());
      pendingPatches.current.clear();
      setSaveState('saving');
      try {
        for (const [elementId, p] of batch) await api.saveElement(projectId, elementId, p);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, SAVE_DEBOUNCE_MS);
  };

  /** Choose the transition after an element. Saved immediately; a cut removes the row. */
  const onTransitionChange = async (afterElementId: number, t: { preset: TransitionPreset; durationInFrames: number }) => {
    setTransitions((prev) => {
      const rest = prev.filter((x) => x.afterElementId !== afterElementId);
      return t.preset === 'cut' ? rest : [...rest, { afterElementId, ...t }];
    });
    setSaveState('saving');
    try {
      await api.saveTransition(projectId, afterElementId, t);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const selected = elements.find((e) => e.id === selectedId) ?? inStartOrder(elements)[0];
  const setSelectedValues = (next: ParamValues) => {
    if (!selected) return;
    setValues({ ...values, [selected.id]: next });
  };

  /** The Footage panel's "use this clip" hands the asset to the first element with a cc.mediaFill slot. */
  const mediaElement = mediaElementOf(elements);
  const mediaParam = mediaElement?.schema.find((p) => p.kind === 'media');
  const selectFootage = (asset: MediaAsset) => {
    if (!mediaElement || !mediaParam) return;
    const current = values[mediaElement.id]?.[mediaParam.key];
    setValues({
      ...values,
      [mediaElement.id]: { ...values[mediaElement.id], [mediaParam.key]: { assetId: asset.id, fit: isMediaValue(current) ? current.fit : 'cover' } },
    });
  };

  const selectedAssetId = (() => {
    const v = mediaElement && mediaParam ? values[mediaElement.id]?.[mediaParam.key] : null;
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
        <div className="font-mono text-xs text-muted flex items-center gap-4">
          <SaveIndicator state={saveState} />
          <span>{loaded ? loaded.detail.template.slug : `project ${projectId}`}</span>
          {loaded && <ExportPanel projectId={projectId} />}
        </div>
      </header>

      {error && <p className="font-mono text-xs text-danger p-8">Could not open the project: {error}</p>}
      {!loaded && !error && <p className="font-mono text-xs text-muted p-8">Loading…</p>}
      {loaded && (
        <div className="flex flex-1 min-h-0">
          <Monitor
            loaded={loaded}
            values={values}
            elements={elements}
            transitions={transitions}
            assets={assets}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onElementChange={onElementChange}
            onTransitionChange={onTransitionChange}
          />
          <aside className="w-80 border-l border-hairline shrink-0 overflow-y-auto">
            <div className="p-6 border-b border-hairline">
              <h2 className="text-xs uppercase tracking-widest text-muted mb-3">Inspector</h2>
              {elements.length > 1 && (
                <div className="flex flex-wrap gap-1 mb-4" role="tablist" aria-label="Elements">
                  {inStartOrder(elements).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="tab"
                      aria-selected={e.id === selected?.id}
                      data-testid={`element-tab-${e.id}`}
                      onClick={() => setSelectedId(e.id)}
                      className={`text-xs px-2 py-1 border ${e.id === selected?.id ? 'border-cobalt text-cobalt' : 'border-hairline text-muted hover:text-fg'}`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
              {selected && (
                <Inspector
                  key={selected.id}
                  schema={selected.schema}
                  values={values[selected.id] ?? {}}
                  onChange={setSelectedValues}
                  assets={assets}
                  templateSlug={loaded.detail.template.slug}
                  elementBaseUrl={selected.lottieUrl.replace(/\/template\.json$/, '')}
                />
              )}
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
 * the export runner doing the same with originals. Every element is built
 * from its own Lottie, schema and values, exactly as the export runner does.
 */
function Monitor({
  loaded,
  values,
  elements,
  transitions,
  assets,
  selectedId,
  onSelect,
  onElementChange,
  onTransitionChange,
}: {
  loaded: Loaded;
  values: ValuesByElement;
  elements: ProjectElement[];
  transitions: ProjectTransition[];
  assets: MediaAsset[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onElementChange: (id: number, patch: ElementPatch) => void;
  onTransitionChange: (afterElementId: number, t: { preset: TransitionPreset; durationInFrames: number }) => void;
}) {
  const { detail, lotties } = loaded;
  const slug = detail.template.slug;

  const renderedValues = useDebounced(values, RENDER_DEBOUNCE_MS);

  const elementProps = useMemo<ElementProps[]>(
    () =>
      elements.map((e) => {
        const source = lotties[e.id];
        const base = `${API}${e.lottieUrl.replace(/\/template\.json$/, '')}`;
        const resolvedSource = source ? resolveLottieAssets(source, base) : EMPTY_LOTTIE;
        const resolvedValues = withBaseUrl(renderedValues[e.id] ?? {}, e.schema, API);
        const lottie = applyLottieValues(resolvedSource, resolvedValues, e.schema);
        return { id: String(e.id), lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: e.enabled };
      }),
    [elements, lotties, renderedValues],
  );

  const media = useMemo<MainProps['media']>(() => {
    for (const e of inStartOrder(elements)) {
      const mediaParam = e.schema.find((p) => p.kind === 'media');
      const v = mediaParam ? renderedValues[e.id]?.[mediaParam.key] : null;
      if (!mediaParam || !isMediaValue(v)) continue;
      const asset = assets.find((a) => a.id === v.assetId);
      const source = lotties[e.id];
      const rect = source ? mediaFillRect(source, mediaParam.path) : null;
      if (!asset || !rect) continue;
      return { src: api.fileUrl(mediaSourceFor(asset, 'preview')), rect, fit: v.fit, key: isChromaKey(v.key) ? v.key : null };
    }
    return null;
  }, [elements, renderedValues, assets, lotties]);

  const transitionProps = useMemo<TransitionProps[]>(
    () => transitions.map((t) => ({ afterElementId: String(t.afterElementId), preset: t.preset, durationInFrames: t.durationInFrames })),
    [transitions],
  );
  const fonts = useMemo(() => fontsFor(detail.meta?.fontFiles, slug, API), [detail.meta, slug]);
  const inputProps = useMemo<MainProps>(
    () => ({ background: BACKGROUND, media, elements: elementProps, transitions: transitionProps, fonts }),
    [media, elementProps, transitionProps, fonts],
  );
  const durationInFrames = compositionDurationWithTransitions(elementProps, transitionProps);

  // Playhead: follow the Player, and drive it when the timeline is scrubbed.
  const playerRef = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    player.addEventListener('frameupdate', onFrame);
    return () => player.removeEventListener('frameupdate', onFrame);
  }, [loaded]);
  const seek = (f: number) => {
    playerRef.current?.seekTo(f);
    setFrame(f);
  };

  // M12 measurement mode: open the editor with ?perf=<seconds> and the Player
  // is played from the start for that long while frame updates are counted.
  // The result lands in the footer and on window.__ccPerf for scripts.
  const [perf, setPerf] = useState<PlaybackSummary | null>(null);
  useEffect(() => {
    const seconds = Number(new URLSearchParams(window.location.search).get('perf'));
    const player = playerRef.current;
    if (!seconds || !player) return;
    const t = setTimeout(async () => {
      const result = await measurePlayback(player, seconds, compositionConfig.fps);
      (window as unknown as { __ccPerf?: PlaybackSummary }).__ccPerf = result;
      setPerf(result);
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    // Program monitor. Nothing ever overlays this.
    <section className="flex-1 p-8 min-w-0 overflow-y-auto">
      <Player
        ref={playerRef}
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
        {perf && (
          <span data-testid="perf-result" className={perf.meetsTarget ? ' text-emerald-400' : ' text-danger'}>
            {' · measured '}{perf.fps.toFixed(1)} fps over {perf.seconds.toFixed(1)} s, {perf.droppedFrames} dropped, worst gap {Math.round(perf.worstGapMs)} ms
          </span>
        )}
      </p>
      <Timeline
        elements={elements}
        fps={compositionConfig.fps}
        durationInFrames={durationInFrames}
        frame={frame}
        onSeek={seek}
        onChange={onElementChange}
        transitions={transitions}
        onTransitionChange={onTransitionChange}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </section>
  );
}
