import {
  applyLottieValues,
  compositionConfig,
  compositionDurationWithTransitions,
  DEFAULT_TRANSFORM,
  EMPTY_LOTTIE,
  fontsFor,
  isChromaKey,
  isMediaValue,
  isTransformValue,
  Main,
  mediaFillRect,
  mediaSourceFor,
  mediaTiming,
  resolveLottieAssets,
  withBaseUrl,
  type ElementProps,
  type LottieAnimationData,
  type MainMedia,
  type MainProps,
  type ParamValues,
  type TransitionPreset,
  type TransitionProps,
} from '@campaigncut/composition';
import { Player, type PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { API, api, type MediaAsset, type ProjectAudio, type ProjectDetail, type ProjectElement, type ProjectTransition } from '../api';
import { AudioPanel } from '../components/AudioPanel';
import { ExportHistory } from '../components/ExportHistory';
import { ExportPanel } from '../components/ExportPanel';
import { Inspector } from '../components/Inspector';
import { MediaPanel } from '../components/MediaPanel';
import { Timeline, type ElementPatch } from '../components/Timeline';
import { canRedo, canUndo, createHistory, isTextEntry, pushHistory, redoHistory, undoHistory, undoRedoFor, type History } from '../history';
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
/** M23: everything undo can bring back. */
type Snapshot = { values: ValuesByElement; elements: ProjectElement[]; transitions: ProjectTransition[]; audio: ProjectAudio | null };

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
  const [audio, setAudio] = useState<ProjectAudio | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  /** M25: bumped when an export finishes so the history list reloads. */
  const [exportsTick, setExportsTick] = useState(0);

  // M23: undo history over everything the user edits. Each change names the
  // control it came from so fast repeats (typing, dragging) fold into one step.
  const history = useRef<History<Snapshot> | null>(null);
  const changeKey = useRef<string | null>(null);
  const restoring = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => {
    if (!loaded) return;
    const snapshot: Snapshot = { values, elements, transitions, audio };
    if (history.current === null) {
      history.current = createHistory(snapshot);
      return;
    }
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    const p = history.current.present;
    if (p.values === values && p.elements === elements && p.transitions === transitions && p.audio === audio) return;
    history.current = pushHistory(history.current, snapshot, changeKey.current, Date.now());
    setHistoryTick((t) => t + 1);
  }, [loaded, values, elements, transitions, audio]);

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
        setAudio(detail.audio ?? null);
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
    changeKey.current = `element:${id}`;
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
    changeKey.current = `transition:${afterElementId}`;
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

  /** M20: the music bed. Saved immediately; null clears it. */
  const onAudioChange = async (next: ProjectAudio | null) => {
    changeKey.current = 'audio';
    setAudio(next);
    setSaveState('saving');
    try {
      await api.saveAudio(projectId, next);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  /**
   * M23: bring a snapshot back and save what differs. Values go through the
   * debounced value save (it diffs against what was last saved); elements,
   * transitions and the music bed are saved here, only where they changed.
   */
  const restore = async (snapshot: Snapshot) => {
    const before: Snapshot = { values, elements, transitions, audio };
    restoring.current = true;
    setValues(snapshot.values);
    setElements(snapshot.elements);
    setTransitions(snapshot.transitions);
    setAudio(snapshot.audio);
    setHistoryTick((t) => t + 1);
    setSaveState('saving');
    try {
      for (const e of snapshot.elements) {
        const was = before.elements.find((x) => x.id === e.id);
        if (!was || (was.startFrame === e.startFrame && was.endFrame === e.endFrame && was.enabled === e.enabled)) continue;
        await api.saveElement(projectId, e.id, { startFrame: e.startFrame, endFrame: e.endFrame, enabled: e.enabled });
      }
      const ids = new Set([...before.transitions, ...snapshot.transitions].map((t) => t.afterElementId));
      for (const id of ids) {
        const was = before.transitions.find((t) => t.afterElementId === id);
        const now = snapshot.transitions.find((t) => t.afterElementId === id);
        if (was?.preset === now?.preset && was?.durationInFrames === now?.durationInFrames) continue;
        await api.saveTransition(projectId, id, now ? { preset: now.preset, durationInFrames: now.durationInFrames } : { preset: 'cut', durationInFrames: 0 });
      }
      if (JSON.stringify(before.audio) !== JSON.stringify(snapshot.audio)) await api.saveAudio(projectId, snapshot.audio);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };
  const undo = () => {
    if (!history.current || !canUndo(history.current)) return;
    history.current = undoHistory(history.current);
    void restore(history.current.present);
  };
  const redo = () => {
    if (!history.current || !canRedo(history.current)) return;
    history.current = redoHistory(history.current);
    void restore(history.current.present);
  };
  const undoRef = useRef({ undo, redo });
  undoRef.current = { undo, redo };
  // M25: arrow keys nudge the placement being dragged (half a percent of the frame, 2% with Shift).
  const nudgeRef = useRef<((dx: number, dy: number) => void) | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextEntry(e.target)) return;
      const action = undoRedoFor(e);
      if (action) {
        e.preventDefault();
        if (action === 'undo') undoRef.current.undo();
        else undoRef.current.redo();
        return;
      }
      const nudge = nudgeRef.current;
      if (!nudge) return;
      const step = e.shiftKey ? 0.02 : 0.005;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = delta[e.key];
      if (!d) return;
      e.preventDefault();
      nudge(d[0], d[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const undoAvailable = historyTick >= 0 && history.current !== null && canUndo(history.current);
  const redoAvailable = historyTick >= 0 && history.current !== null && canRedo(history.current);

  const selected = elements.find((e) => e.id === selectedId) ?? inStartOrder(elements)[0];
  const setSelectedValues = (next: ParamValues) => {
    if (!selected) return;
    const current = values[selected.id] ?? {};
    const changed = Object.keys(next).find((k) => next[k] !== current[k]) ?? null;
    changeKey.current = changed ? `${selected.id}:${changed}` : null;
    setValues({ ...values, [selected.id]: next });
  };

  // M18: which placement param is being dragged on the monitor. Dragging
  // adds the fraction of the monitor travelled to the layer's offset.
  const [dragKey, setDragKey] = useState<string | null>(null);
  useEffect(() => setDragKey(null), [selectedId]);
  const onDrag = (dx: number, dy: number) => {
    if (!selected || !dragKey) return;
    changeKey.current = `${selected.id}:${dragKey}`;
    setValues((prev) => {
      const current = prev[selected.id]?.[dragKey];
      const base = isTransformValue(current) ? current : DEFAULT_TRANSFORM;
      return { ...prev, [selected.id]: { ...prev[selected.id], [dragKey]: { ...base, x: base.x + dx, y: base.y + dy } } };
    });
  };
  nudgeRef.current = dragKey ? onDrag : null;

  /**
   * The Footage panel's "use this clip" goes to the SELECTED element when it
   * has a cc.mediaFill slot, else to the first element that does (M21).
   */
  const mediaElement = selected?.schema.some((p) => p.kind === 'media') ? selected : mediaElementOf(elements);
  const mediaParam = mediaElement?.schema.find((p) => p.kind === 'media');
  const selectFootage = (asset: MediaAsset) => {
    // M20: an audio row in the Footage panel picks the music bed, not the slot.
    if (asset.kind === 'audio') {
      void onAudioChange({ assetId: asset.id, volume: audio?.volume ?? 1, inS: audio?.inS ?? 0 });
      return;
    }
    if (!mediaElement || !mediaParam) return;
    const current = values[mediaElement.id]?.[mediaParam.key];
    changeKey.current = `${mediaElement.id}:${mediaParam.key}`;
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
          <ProjectName
            name={loaded?.detail.project.name ?? null}
            onRename={async (name) => {
              const row = await api.renameProject(projectId, name);
              setLoaded((prev) => (prev ? { ...prev, detail: { ...prev.detail, project: { ...prev.detail.project, name: row.name } } } : prev));
            }}
          />
        </div>
        <div className="font-mono text-xs text-muted flex items-center gap-4">
          {loaded && (
            <span className="flex gap-2">
              <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!undoAvailable} className="hover:text-fg disabled:opacity-40">
                Undo
              </button>
              <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!redoAvailable} className="hover:text-fg disabled:opacity-40">
                Redo
              </button>
            </span>
          )}
          <SaveIndicator state={saveState} />
          <span>{loaded ? loaded.detail.template.slug : `project ${projectId}`}</span>
          {loaded && <ExportPanel projectId={projectId} onFinished={() => setExportsTick((t) => t + 1)} />}
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
            audio={audio}
            assets={assets}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            onElementChange={onElementChange}
            onTransitionChange={onTransitionChange}
            dragLabel={dragKey ? (selected?.schema.find((p) => p.key === dragKey)?.label ?? dragKey) : null}
            onDrag={onDrag}
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
                  dragKey={dragKey}
                  onDragKey={setDragKey}
                />
              )}
            </div>
            <div className="p-6 border-b border-hairline">
              <MediaPanel onSelect={selectFootage} selectedId={selectedAssetId} onChange={setAssets} />
            </div>
            <div className="p-6 border-b border-hairline">
              <AudioPanel assets={assets} audio={audio} onChange={onAudioChange} />
            </div>
            <div className="p-6">
              <ExportHistory projectId={projectId} refreshKey={exportsTick} />
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

/** M22: the project name, editable in place. Enter saves, Escape cancels, an empty name is ignored. */
function ProjectName({ name, onRename }: { name: string | null; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === name) return;
    try {
      await onRename(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Project name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={() => void commit()}
        className="bg-panel border border-cobalt px-2 py-0.5 text-sm text-fg focus:outline-none"
      />
    );
  }
  return (
    <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">
      <span>{name ?? '…'}</span>
      {name !== null && (
        <button
          type="button"
          aria-label="Rename project"
          onClick={() => {
            setDraft(name);
            setError(null);
            setEditing(true);
          }}
          className="font-mono text-[10px] font-normal text-muted hover:text-fg"
        >
          rename
        </button>
      )}
      {error && <span className="font-mono text-[10px] font-normal text-danger">{error}</span>}
    </h1>
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
  audio,
  assets,
  selectedId,
  onSelect,
  onElementChange,
  onTransitionChange,
  dragLabel,
  onDrag,
}: {
  loaded: Loaded;
  values: ValuesByElement;
  elements: ProjectElement[];
  transitions: ProjectTransition[];
  /** M20: the music bed, or null. */
  audio: ProjectAudio | null;
  assets: MediaAsset[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onElementChange: (id: number, patch: ElementPatch) => void;
  onTransitionChange: (afterElementId: number, t: { preset: TransitionPreset; durationInFrames: number }) => void;
  /** M18: the placement being dragged on the monitor (its label), or null when dragging is off. */
  dragLabel: string | null;
  /** Fractions of the monitor the pointer moved since the last call. */
  onDrag: (dx: number, dy: number) => void;
}) {
  const { detail, lotties } = loaded;

  // M18 drag surface. It draws NOTHING: the preview underneath is the feedback.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const onSurfaceDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastPointer.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom or a synthetic pointer id */
    }
    e.preventDefault();
  };
  const onSurfaceMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!lastPointer.current || !(e.buttons & 1)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    onDrag((e.clientX - lastPointer.current.x) / rect.width, (e.clientY - lastPointer.current.y) / rect.height);
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };
  const onSurfaceUp = () => {
    lastPointer.current = null;
  };
  const slug = detail.template.slug;

  const renderedValues = useDebounced(values, RENDER_DEBOUNCE_MS);

  /** M21: an element's own footage for its slot, from its own value, at the PREVIEW runner's proxy URL. */
  const mediaFor = useCallback(
    (e: ProjectElement): MainMedia | null => {
      const mediaParam = e.schema.find((p) => p.kind === 'media');
      const v = mediaParam ? renderedValues[e.id]?.[mediaParam.key] : null;
      if (!mediaParam || !isMediaValue(v)) return null;
      const asset = assets.find((a) => a.id === v.assetId);
      const source = lotties[e.id];
      const rect = source ? mediaFillRect(source, mediaParam.path) : null;
      if (!asset || !rect) return null;
      return {
        src: api.fileUrl(mediaSourceFor(asset, 'preview')),
        rect,
        fit: v.fit,
        key: isChromaKey(v.key) ? v.key : null,
        ...mediaTiming(v, compositionConfig.fps),
        muted: v.muted === true,
      };
    },
    [renderedValues, assets, lotties],
  );

  const elementProps = useMemo<ElementProps[]>(
    () =>
      elements.map((e) => {
        const source = lotties[e.id];
        const base = `${API}${e.lottieUrl.replace(/\/template\.json$/, '')}`;
        const resolvedSource = source ? resolveLottieAssets(source, base) : EMPTY_LOTTIE;
        const resolvedValues = withBaseUrl(renderedValues[e.id] ?? {}, e.schema, API);
        const lottie = applyLottieValues(resolvedSource, resolvedValues, e.schema);
        return { id: String(e.id), lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: e.enabled, media: mediaFor(e) };
      }),
    [elements, lotties, renderedValues, mediaFor],
  );
  const hasFootage = elementProps.some((e) => e.media);

  // M20: the music bed. Both runners play the original file; the server does the same with its absolute base.
  const audioProps = useMemo<MainProps['audio']>(() => {
    if (!audio) return null;
    const asset = assets.find((a) => a.id === audio.assetId);
    if (!asset) return null;
    return { src: api.fileUrl(asset.originalUrl), volume: audio.volume, ...(audio.inS > 0 ? { startFrom: Math.round(audio.inS * compositionConfig.fps) } : {}) };
  }, [audio, assets]);

  const transitionProps = useMemo<TransitionProps[]>(
    () => transitions.map((t) => ({ afterElementId: String(t.afterElementId), preset: t.preset, durationInFrames: t.durationInFrames })),
    [transitions],
  );
  const fonts = useMemo(() => fontsFor(detail.meta?.fontFiles, slug, API), [detail.meta, slug]);
  const inputProps = useMemo<MainProps>(
    () => ({ background: BACKGROUND, audio: audioProps, elements: elementProps, transitions: transitionProps, fonts }),
    [audioProps, elementProps, transitionProps, fonts],
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
    // Program monitor. Nothing ever overlays this visually. The M18 drag
    // surface is the one exception: an invisible pointer catcher, present only
    // while "Drag on monitor" is on, so the preview itself is the feedback.
    <section className="flex-1 p-8 min-w-0 overflow-y-auto">
      <div className="relative">
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
        {dragLabel && (
          <div
            data-testid="drag-surface"
            role="presentation"
            aria-label={`Drag to move ${dragLabel}`}
            className="absolute inset-0 cursor-move select-none touch-none"
            onPointerDown={onSurfaceDown}
            onPointerMove={onSurfaceMove}
            onPointerUp={onSurfaceUp}
            onPointerCancel={onSurfaceUp}
          />
        )}
      </div>
      <p className="font-mono text-xs text-muted mt-3">
        {compositionConfig.width}×{compositionConfig.height} · {compositionConfig.fps} fps · {durationInFrames} frames
        {hasFootage ? ' · footage: proxy' : ''}
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
