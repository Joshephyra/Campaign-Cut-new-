import {
  accentOf,
  applyLottieValues,
  fitSpecsFrom, calloutsFrom,
  ASPECTS,
  autoFitBox,
  compositionConfig,
  readiness,
  fontFaceCss,
  fontLoadSpec,
  frameFor,
  isAspect,
  type Aspect,
  type Frame,
  contentSeconds,
  lengthLabel,
  SPOT_LENGTHS,
  spotDurationFrames,
  DEFAULT_TRANSFORM,
  DEFAULT_TRANSITION_FRAMES,
  ELEMENT_TYPE_LABELS,
  ELEMENT_TYPES,
  EMPTY_LOTTIE,
  fontsFor,
  isSceneType,
  PICKER_ORDER,
  structureOf,
  isTreatment,
  treatmentFor,
  isChromaKey,
  isMediaValue,
  isTransformValue,
  Main,
  mediaFillRect,
  mediaSourceFor,
  mediaTiming,
  resolveLottieAssets,
  successorOf,
  TRANSITION_PRESETS,
  withBaseUrl,
  type ElementProps,
  type LottieAnimationData,
  type MainMedia,
  type MainProps,
  type ParamValues,
  type TemplateFontFile,
  type TemplateParam,
  type TransitionPreset,
  type Treatment,
  type TransitionProps,
} from '@campaigncut/composition';
import { Player, type PlayerRef } from '@remotion/player';
import { ArrowLeftToLine, ArrowRightToLine, ChevronDown, ChevronLeft, Copy, Eye, EyeOff, Maximize2, MoreHorizontal, Pause, Pencil, Play, Plus, Redo2, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react';
import { StockPanel } from '../components/StockPanel';
import { Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { API, api, type LibraryElement, type MediaAsset, type ProjectAudio, type ProjectDetail, type ProjectElement, type ProjectTransition, type Theme } from '../api';
import { StylePanel } from '../components/StylePanel';
import { ElementPreview, previewValues } from '../components/ElementPreview';
import { frameAfterLanding, landingFrame } from '../landing';
import { moveOverlayToScene, reorderScenes } from '../reorder';
import { cutDownToFit } from '../cutdown';
import { ExportHistory } from '../components/ExportHistory';
import { ExportPanel } from '../components/ExportPanel';
import { Inspector } from '../components/Inspector';
import { ASSET_DRAG_TYPE, MediaPanel } from '../components/MediaPanel';
import { Button, IconButton, Section, Segmented, Slider, Switch, Wordmark, Chip } from '../components/ui';
import { canRedo, canUndo, createHistory, isTextEntry, pushHistory, redoHistory, undoHistory, undoRedoFor, type History } from '../history';
import { findLayerBoxes, pickLayer, type Box } from '../monitorHit';
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
/** M30: a patch to an element's timing or visibility. */
type ElementPatch = Partial<Pick<ProjectElement, 'startFrame' | 'endFrame' | 'enabled'>>;

/** Elements as they play: earliest first, then bottom of the stack first. */
function inStartOrder<T extends { startFrame: number; zIndex: number }>(elements: T[]): T[] {
  return [...elements].sort((a, b) => a.startFrame - b.startFrame || a.zIndex - b.zIndex);
}

/** The element whose media slot the library drives: the first, in start order, that has one. */
function mediaElementOf(elements: ProjectElement[]): ProjectElement | undefined {
  return inStartOrder(elements).find((e) => e.schema.some((p) => p.kind === 'media'));
}

/** An element has a boundary (and so a transition) when another enabled element actually follows it, the way the composition chains them. */
function boundariesAfter(elements: ProjectElement[]): Set<number> {
  const inOrder = inStartOrder(elements.filter((e) => e.enabled)).map((e) => ({ ...e, id: String(e.id) }));
  return new Set(inOrder.filter((e) => successorOf(e, inOrder, new Set()) !== undefined).map((e) => Number(e.id)));
}

const seconds = (frames: number) => frames / compositionConfig.fps;

/**
 * M30: the frame to show a scene on. Frame 0 of a scene is the start of its
 * entrance, usually empty; a second in (or the middle of a short scene) the
 * design is on screen and there is something to press.
 */
export function holdFrame(e: { startFrame: number; endFrame: number }): number {
  return e.startFrame + Math.min(compositionConfig.fps, Math.floor((e.endFrame - e.startFrame) / 2));
}

/** Seconds with tenths for the transport, the same format the chips and the panel use. */
function clock(frames: number): string {
  return `${seconds(Math.max(0, frames)).toFixed(1)} s`;
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
  /** The values as last saved (or loaded); the debounced save diffs against it. */
  const lastSaved = useRef<ValuesByElement | null>(null);

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

  /**
   * Load (or reload) the spot: its detail and every element's Lottie. A
   * reload after the aspect changes (M36) keeps the selection and treats the
   * loaded values as saved.
   */
  const load = useCallback(
    async (keepSelection = false) => {
      const detail = await api.project(projectId);
      const loadedLotties = await Promise.all(detail.elements.map(async (e) => [e.id, await api.elementLottie(e.lottieUrl)] as const));
      const lotties: Lotties = {};
      for (const [id, lottie] of loadedLotties) lotties[id] = lottie;
      const initial: ValuesByElement = {};
      for (const e of detail.elements) initial[e.id] = {};
      for (const v of detail.values) (initial[v.elementId] ??= {})[v.key] = v.value;
      lastSaved.current = null;
      setValues(initial);
      setElements(detail.elements.map((e) => ({ ...e, enabled: e.enabled ?? true })));
      setTransitions(detail.transitions ?? []);
      setAudio(detail.audio ?? null);
      setSelectedId((current) => (keepSelection && current !== null && detail.elements.some((e) => e.id === current) ? current : (inStartOrder(detail.elements)[0]?.id ?? null)));
      setLoaded({ detail, lotties });
    },
    [projectId],
  );
  useEffect(() => {
    let cancelled = false;
    load().catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // M36: the version's aspect ratio. Changing it saves, then reloads the
  // spot at that ratio's files (designer variants where they exist).
  const aspect = (isAspect(loaded?.detail.project.aspect) ? loaded!.detail.project.aspect : '16:9') as Aspect;
  const frame = useMemo(() => loaded?.detail.frame ?? frameFor(aspect), [loaded, aspect]);
  // M39: the style treatment across the spot. Applied at once in the
  // Player; saved through the project route. Both runners read it from props.
  const [treatment, setTreatment] = useState<Treatment>('clean');
  // M52: the spot's length. Timing is the designer's; the length is the spot's, and the content must fit it exactly.
  const [lengthS, setLengthS] = useState<number>(30);
  useEffect(() => {
    const saved = loaded?.detail.project.lengthS;
    setLengthS(typeof saved === 'number' && saved > 0 ? saved : 30);
  }, [loaded]);
  const changeLength = async (next: number) => {
    if (next === lengthS) return;
    setLengthS(next);
    setSaveState('saving');
    try {
      await api.setLength(projectId, next);
      setSaveState('saved');
    } catch (e) {
      setError((e as Error).message);
      setSaveState('error');
    }
  };
  /** M52: hide proof points from the end until the content fits the length; what follows moves back. Undo brings them back. */
  const cutDown = () => {
    const { hide, patches } = cutDownToFit(elements, Math.round(lengthS * compositionConfig.fps));
    if (hide.length === 0 && patches.size === 0) return;
    changeKey.current = `cutdown:${lengthS}`;
    setElements((prev) => prev.map((e) => (hide.includes(e.id) ? { ...e, enabled: false, ...(patches.get(e.id) ?? {}) } : patches.has(e.id) ? { ...e, ...patches.get(e.id) } : e)));
    for (const id of hide) pendingPatches.current.set(id, { ...pendingPatches.current.get(id), enabled: false });
    for (const [id, patch] of patches) pendingPatches.current.set(id, { ...pendingPatches.current.get(id), ...patch });
    setSaveState('dirty');
    flushPatches();
  };
  useEffect(() => {
    const saved = loaded?.detail.project.treatment;
    setTreatment(isTreatment(saved) ? saved : 'clean');
  }, [loaded]);
  const changeTreatment = async (next: Treatment) => {
    if (next === treatment) return;
    setTreatment(next);
    setSaveState('saving');
    try {
      await api.setTreatment(projectId, next);
      setSaveState('saved');
    } catch (e) {
      setError((e as Error).message);
      setSaveState('error');
    }
  };
  const [switchingAspect, setSwitchingAspect] = useState(false);
  const changeAspect = async (next: Aspect) => {
    if (next === aspect || switchingAspect) return;
    setSwitchingAspect(true);
    setSaveState('saving');
    try {
      await api.setAspect(projectId, next);
      await load(true);
      setSaveState('saved');
    } catch (e) {
      setError((e as Error).message);
      setSaveState('error');
    } finally {
      setSwitchingAspect(false);
    }
  };

  const refreshAssets = useCallback(
    () =>
      api
        .media()
        .then((list) => {
          setAssets(list);
          return list;
        })
        .catch(() => {
          setAssets([]);
          return [] as MediaAsset[];
        }),
    [],
  );
  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  // Persist changed values, debounced. Only the keys that changed are sent, each with its element.
  // (Declared above the loader so a reload can reset the baseline.)
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

  // Persist element timing and visibility, debounced per element.
  const pendingPatches = useRef(new Map<number, ElementPatch>());
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPatches = () => {
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
  const onElementChange = (id: number, patch: ElementPatch) => {
    changeKey.current = `element:${id}`;
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    pendingPatches.current.set(id, { ...pendingPatches.current.get(id), ...patch });
    setSaveState('dirty');
    flushPatches();
  };

  /** The scenes before and after one, in play order, for the Move earlier / later buttons. */
  const neighbours = (sceneId: number): { before: number | null; after: number | null } => {
    const scenes = elements.filter((e) => e.enabled && isSceneType(e.type)).sort((a, b) => a.startFrame - b.startFrame || a.id - b.id);
    const at = scenes.findIndex((e) => e.id === sceneId);
    if (at < 0) return { before: null, after: null };
    return { before: scenes[at - 1]?.id ?? null, after: scenes[at + 1]?.id ?? null };
  };

  /** M43: a scene chip dropped before or after another scene: the scenes are re-laid in the new order; overlays stay put. */
  const onReorder = (movedId: number, targetId: number, place: DropPlace) => {
    const patches = place === 'on' ? moveOverlayToScene(elements, movedId, targetId) : reorderScenes(elements, movedId, targetId, place);
    if (patches.size === 0) return;
    changeKey.current = `reorder:${movedId}`;
    setElements((prev) => prev.map((e) => (patches.has(e.id) ? { ...e, ...patches.get(e.id) } : e)));
    for (const [elementId, patch] of patches) pendingPatches.current.set(elementId, { ...pendingPatches.current.get(elementId), ...patch });
    setSaveState('dirty');
    flushPatches();
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
  // M25: arrow keys nudge the active placement (half a percent of the frame, 2% with Shift).
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
  /** One value of one element, from the monitor (typing on the video, dropping a clip). */
  const setElementValue = (elementId: number, key: string, value: unknown) => {
    changeKey.current = `${elementId}:${key}`;
    setValues((prev) => ({ ...prev, [elementId]: { ...prev[elementId], [key]: value } }));
  };

  // M28: the placement last pressed on the monitor. Dragging adds the
  // fraction of the monitor travelled to that layer's offset; arrow keys
  // nudge it. Choosing another element in the panel lets it go.
  const [active, setActive] = useState<{ elementId: number; key: string } | null>(null);
  useEffect(() => setActive((a) => (a && a.elementId !== selectedId ? null : a)), [selectedId]);
  const onPress = (elementId: number, key: string) => {
    setSelectedId(elementId);
    setActive({ elementId, key });
  };
  const onDrag = (elementId: number, key: string, dx: number, dy: number) => {
    changeKey.current = `${elementId}:${key}`;
    setValues((prev) => {
      const current = prev[elementId]?.[key];
      const base = isTransformValue(current) ? current : DEFAULT_TRANSFORM;
      return { ...prev, [elementId]: { ...prev[elementId], [key]: { ...base, x: base.x + dx, y: base.y + dy } } };
    });
  };
  nudgeRef.current = active ? (dx, dy) => onDrag(active.elementId, active.key, dx, dy) : null;
  const schemaFor = useCallback((elementId: number) => elements.find((e) => e.id === elementId)?.schema, [elements]);

  /** M30: a clip lands in an element's slot, from a press in the library or a drop on the video. */
  const assignClip = (element: ProjectElement, assetId: number) => {
    const mediaParam = element.schema.find((p) => p.kind === 'media');
    if (!mediaParam) return;
    const current = values[element.id]?.[mediaParam.key];
    setElementValue(element.id, mediaParam.key, { assetId, fit: isMediaValue(current) ? current.fit : 'cover' });
  };

  /**
   * The library's press goes to the SELECTED element when it has a
   * cc.mediaFill slot, else to the first element that does (M21).
   */
  const mediaElement = selected?.schema.some((p) => p.kind === 'media') ? selected : mediaElementOf(elements);
  const mediaParam = mediaElement?.schema.find((p) => p.kind === 'media');
  const selectFootage = (asset: MediaAsset) => {
    if (asset.kind === 'audio') {
      void onAudioChange({ assetId: asset.id, volume: audio?.volume ?? 1, inS: audio?.inS ?? 0 });
      return;
    }
    if (mediaElement) assignClip(mediaElement, asset.id);
  };

  const selectedAssetId = (() => {
    const v = mediaElement && mediaParam ? values[mediaElement.id]?.[mediaParam.key] : null;
    return isMediaValue(v) ? v.assetId : undefined;
  })();

  const boundaries = boundariesAfter(elements);

  // M35: the one compliance check, the same rule the export enforces.
  // M49: everything to check before an export, in one list (the disclaimer blocks; footage, logo and words are notes).
  const ready = useMemo(
    () => readiness(elements.map((e) => ({ name: e.name, enabled: e.enabled, startFrame: e.startFrame, endFrame: e.endFrame, schema: e.schema, values: values[e.id] ?? {} })), compositionConfig.fps, lengthS),
    [elements, values, lengthS],
  );


  // M31: the element library. The Add chip opens it; pressing an element
  // adds it at the playhead, selects it and shows it. Added elements can be
  // removed again; the spot's own can only be hidden.
  const [library, setLibrary] = useState<LibraryElement[] | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const frameRef = useRef(0);
  const seekRef = useRef<(frame: number) => void>(() => {});
  // M66 (Josh, 2026-09-17: the picker was "overwhelming"): the left column is the prototype's: tabs, and under
  // Templates the shelves as fold-out rows with counts and picture previews, browsed in place. No pop-over.
  const [leftTab, setLeftTab] = useState<LeftTab>(rememberedLeftTab);
  const chooseLeftTab = (tab: LeftTab) => {
    setLeftTab(tab);
    try {
      window.localStorage.setItem('cc.left.tab', tab);
    } catch {
      /* no storage: the choice lasts the session */
    }
  };
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [scrollToGroup, setScrollToGroup] = useState<string | null>(null);
  const loadLibrary = useCallback(() => {
    if (library !== null) return;
    api
      .libraryElements()
      .then(setLibrary)
      .catch((e: Error) => setLibraryError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once; the guard is the state itself
  }, [library === null]);
  useEffect(() => {
    if (leftTab === 'templates') loadLibrary();
  }, [leftTab, loadLibrary]);
  /** Bring the Templates tab forward with one shelf (or every shelf) open, so the strip's Add card and the panel still lead somewhere. */
  const openLibrary = (group: string | null = null) => {
    chooseLeftTab('templates');
    setOpenGroups((prev) => (typeof group === 'string' ? new Set([...prev, group]) : new Set(PICKER_ORDER as readonly string[])));
    setScrollToGroup(typeof group === 'string' ? group : null);
    loadLibrary();
  };
  const toggleGroup = (type: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  /** M42: the copy typed in the composer lands with the element: its first text role gets it, as the preview showed. */
  const addFromLibrary = async (item: LibraryElement, copy = '') => {
    setLibraryError(null);
    try {
      // M41: a scene lands at the playhead and moves it on; an overlay lands on the scene under the playhead.
      const element = await api.addElement(projectId, item.id, landingFrame(item.type, elements, frameRef.current, item.durationInFrames));
      const lottie = await api.elementLottie(element.lottieUrl);
      setLoaded((prev) => (prev ? { ...prev, lotties: { ...prev.lotties, [element.id]: lottie } } : prev));
      changeKey.current = `add:${element.id}`;
      const withCopy = previewValues(element.schema, copy);
      setValues((prev) => {
        if (prev[element.id]) return Object.keys(withCopy).length > 0 ? { ...prev, [element.id]: { ...prev[element.id], ...withCopy } } : prev;
        // the values the server gave the scene (its defaults, branded for a client's spot: M47), else the schema defaults
        const defaults: ParamValues = {};
        for (const p of element.schema) defaults[p.key] = p.default;
        for (const v of element.values ?? []) defaults[v.key] = v.value;
        return { ...prev, [element.id]: { ...defaults, ...withCopy } };
      });
      setElements((prev) => (prev.some((e) => e.id === element.id) ? prev.map((e) => (e.id === element.id ? { ...e, ...element } : e)) : [...prev, element]));
      setSelectedId(element.id);
      seekRef.current(frameAfterLanding(item.type, element, holdFrame(element)));
    } catch (e) {
      setLibraryError((e as Error).message);
    }
  };
  // M32: the spot's colours by role and the saved themes. The style route
  // writes the values on the server; here they are merged in and marked
  // saved so the debounced value save has nothing left to do.
  const [themes, setThemes] = useState<Theme[]>([]);
  const [styleError, setStyleError] = useState<string | null>(null);
  useEffect(() => {
    api
      .themes()
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);
  const applyStyle = async (colors: Record<string, string>) => {
    setStyleError(null);
    setSaveState('saving');
    try {
      const { values: written } = await api.applyStyle(projectId, colors);
      changeKey.current = 'style';
      setValues((prev) => {
        const next: ValuesByElement = { ...prev };
        for (const v of written) next[v.elementId] = { ...next[v.elementId], [v.key]: v.value };
        if (saveState === 'idle' || saveState === 'saved' || saveState === 'saving') lastSaved.current = next;
        return next;
      });
      setSaveState('saved');
    } catch (e) {
      setStyleError((e as Error).message);
      setSaveState('error');
    }
  };
  /** M33: put the client's brand back over the spot. Same merge as a style change. */
  const applyBrand = async () => {
    setStyleError(null);
    setSaveState('saving');
    try {
      const { values: written } = await api.applyBrand(projectId);
      changeKey.current = 'brand';
      setValues((prev) => {
        const next: ValuesByElement = { ...prev };
        for (const v of written) next[v.elementId] = { ...next[v.elementId], [v.key]: v.value };
        if (saveState === 'idle' || saveState === 'saved' || saveState === 'saving') lastSaved.current = next;
        return next;
      });
      setSaveState('saved');
    } catch (e) {
      setStyleError((e as Error).message);
      setSaveState('error');
    }
  };
  const saveTheme = async (name: string, colors: Record<string, string>) => {
    try {
      const theme = await api.saveTheme(name, colors);
      setThemes((prev) => [theme, ...prev]);
    } catch (e) {
      setStyleError((e as Error).message);
    }
  };
  const deleteTheme = async (id: number) => {
    try {
      await api.deleteTheme(id);
      setThemes((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setStyleError((e as Error).message);
    }
  };

  /**
   * M46: a second copy of a scene, with its words and colours, right after
   * it: a scene lands at the source's end and everything that starts there
   * or later moves on by the copy's length; an overlay lands where the
   * source is, to be dragged onto another scene.
   */
  const duplicateScene = async (sceneId: number) => {
    const source = elements.find((e) => e.id === sceneId);
    if (!source) return;
    setLibraryError(null);
    try {
      const scene = isSceneType(source.type);
      const at = scene ? source.endFrame : source.startFrame;
      const copy = await api.addElement(projectId, source.elementId ?? source.id, at);
      const lottie = await api.elementLottie(copy.lottieUrl);
      setLoaded((prev) => (prev ? { ...prev, lotties: { ...prev.lotties, [copy.id]: lottie } } : prev));
      changeKey.current = `duplicate:${copy.id}`;
      const words = { ...(values[source.id] ?? {}) };
      setValues((prev) => ({ ...prev, [copy.id]: { ...(prev[copy.id] ?? {}), ...words } }));
      const entries = Object.entries(words).map(([key, value]) => ({ elementId: copy.id, key, value }));
      if (entries.length > 0) await api.saveValues(projectId, entries);
      const length = copy.endFrame - copy.startFrame;
      const patches = new Map<number, ElementPatch>();
      if (scene) {
        for (const e of elements) if (e.id !== source.id && e.startFrame >= source.endFrame) patches.set(e.id, { startFrame: e.startFrame + length, endFrame: e.endFrame + length });
      }
      setElements((prev) => [...prev.filter((e) => e.id !== copy.id).map((e) => (patches.has(e.id) ? { ...e, ...patches.get(e.id) } : e)), { ...copy, enabled: true }]);
      for (const [elementId, patch] of patches) pendingPatches.current.set(elementId, { ...pendingPatches.current.get(elementId), ...patch });
      if (patches.size > 0) {
        setSaveState('dirty');
        flushPatches();
      }
      setSelectedId(copy.id);
      seekRef.current(holdFrame(copy));
    } catch (e) {
      setLibraryError((e as Error).message);
    }
  };

  const removeFromSpot = async (elementId: number) => {
    try {
      await api.removeElement(projectId, elementId);
      changeKey.current = `remove:${elementId}`;
      setElements((prev) => prev.filter((e) => e.id !== elementId));
      setTransitions((prev) => prev.filter((t) => t.afterElementId !== elementId));
      setValues((prev) => {
        const { [elementId]: _gone, ...rest } = prev;
        return rest;
      });
      if (selectedId === elementId) setSelectedId(inStartOrder(elements.filter((e) => e.id !== elementId))[0]?.id ?? null);
    } catch (e) {
      setLibraryError((e as Error).message);
    }
  };

  return (
    <main className="h-screen bg-bg text-fg flex flex-col overflow-hidden">
      <header className="on-bar h-[52px] px-4 flex items-center justify-between shrink-0 gap-4 border-b border-line bg-panel">
        <div className="flex items-center gap-3 min-w-0 w-[280px] shrink-0">
          <button type="button" onClick={onBack} className="cc-press inline-flex items-center gap-0.5 h-8 pl-1.5 pr-3 rounded-full text-xs font-medium text-fg-2 hover:text-fg hover:bg-hover">
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            Library
          </button>
          <Wordmark className="hidden xl:inline-flex" />
        </div>
        <ProjectName
          name={loaded?.detail.project.name ?? null}
          templateName={loaded ? [loaded.detail.template.name, loaded.detail.project.clientName ? `for ${loaded.detail.project.clientName}` : null].filter(Boolean).join(' · ') : null}
          onRename={async (name) => {
            const row = await api.renameProject(projectId, name);
            setLoaded((prev) => (prev ? { ...prev, detail: { ...prev.detail, project: { ...prev.detail.project, name: row.name } } } : prev));
          }}
        />
        <div className="flex items-center gap-3 shrink-0 justify-end">
          {loaded && (
            /* M62 (finish review): the length and the version in one raised frame, the chosen ones in the hover tone, so Export is the top bar's only blue. */
            <div className="inline-flex items-center rounded-full bg-raised border border-line p-0.5">
              <div role="group" aria-label="Spot length" title="A spot is exactly its length. Change it and the list beside Export says what to add or cut." className="inline-flex items-center">
                {[...new Set<number>([...SPOT_LENGTHS, lengthS])].sort((a, b) => a - b).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`Length ${lengthLabel(s)}`}
                    aria-pressed={s === lengthS}
                    onClick={() => void changeLength(s)}
                    className={`cc-press h-7 px-2.5 rounded-full text-xs font-medium tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${s === lengthS ? 'bg-hover text-fg' : 'text-fg-2 hover:text-fg hover:bg-hover'}`}
                  >
                    {lengthLabel(s)}
                  </button>
                ))}
              </div>
              <span aria-hidden="true" className="w-px h-4 bg-line mx-1" />
              <div role="group" aria-label="Version" className="inline-flex items-center">
                {ASPECTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-label={`Version ${a}`}
                    aria-pressed={a === aspect}
                    disabled={switchingAspect}
                    onClick={() => void changeAspect(a)}
                    className={`cc-press h-7 px-2.5 rounded-full text-xs font-medium tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${a === aspect ? 'bg-hover text-fg' : 'text-fg-2 hover:text-fg hover:bg-hover'} disabled:opacity-60`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
          {loaded && (
            <span className="inline-flex items-center rounded-full bg-raised border border-line p-0.5">
              <IconButton label="Undo" title="Undo (Ctrl+Z)" icon={Undo2} onClick={undo} disabled={!undoAvailable} className="!w-7 !h-7" />
              <IconButton label="Redo" title="Redo (Ctrl+Shift+Z)" icon={Redo2} onClick={redo} disabled={!redoAvailable} className="!w-7 !h-7" />
            </span>
          )}
          <span className="text-xs w-20 text-right">{loaded && <SaveIndicator state={saveState} />}</span>
          {loaded && <ExportPanel projectId={projectId} onFinished={() => setExportsTick((t) => t + 1)} readiness={ready} aspect={aspect} projectName={loaded.detail.project.name} onCutDown={cutDown} lengthLabel={lengthLabel(lengthS)} />}
        </div>
      </header>

      {error && <p className="text-xs text-red-ink p-8">Could not open the project: {error}</p>}
      {!loaded && !error && <p className="text-xs text-fg-3 p-8">Loading…</p>}
      {loaded && (
        <div className="flex flex-1 min-h-0">
          <aside className="w-[280px] shrink-0 border-r border-line bg-panel overflow-y-auto flex flex-col">
            {/* M66: the prototype's left column: one tab row, then the chosen library browsed in place. */}
            <div className="px-3 pt-3 pb-2 border-b border-line shrink-0">
              <Segmented
                label="Library"
                size="sm"
                value={leftTab}
                options={[
                  { value: 'templates', label: 'Templates' },
                  { value: 'footage', label: 'Footage' },
                  { value: 'stock', label: 'Stock' },
                  { value: 'brand', label: 'Brand' },
                ]}
                onChange={chooseLeftTab}
                className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-1"
              />
            </div>
            {leftTab === 'templates' && (
              <LibraryBrowser
                library={library}
                error={libraryError}
                inSpot={usesByElement(elements)}
                onAdd={(item, copy) => void addFromLibrary(item, copy)}
                openGroups={openGroups}
                onToggleGroup={toggleGroup}
                scrollTo={scrollToGroup}
                onScrolled={() => setScrollToGroup(null)}
              />
            )}
            {leftTab === 'footage' && <MediaPanel onSelect={selectFootage} selectedId={selectedAssetId} onChange={setAssets} audio={audio} onAudioChange={onAudioChange} withStock={false} />}
            {leftTab === 'stock' && (
              <div className="px-4 py-4">
                <StockPanel onImported={() => void refreshAssets()} />
              </div>
            )}
            {leftTab === 'brand' && (
              <>
                {styleError && <p className="px-4 pt-3 text-xs text-red-ink">{styleError}</p>}
                <StylePanel
                  elements={elements}
                  values={values}
                  themes={themes}
                  onApply={(c) => void applyStyle(c)}
                  onSaveTheme={(n, c) => void saveTheme(n, c)}
                  onDeleteTheme={(id) => void deleteTheme(id)}
                  clientName={loaded.detail.project.clientName ?? null}
                  onApplyBrand={loaded.detail.project.clientName ? () => void applyBrand() : undefined}
                  treatment={treatment}
                  onTreatment={(t) => void changeTreatment(t)}
                />
              </>
            )}
          </aside>

          <Monitor
            loaded={loaded}
            values={values}
            elements={elements}
            transitions={transitions}
            onTransitionChange={(id, t) => void onTransitionChange(id, t)}
            audio={audio}
            assets={assets}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            frameSize={frame}
            treatment={treatment}
            lengthS={lengthS}
            schemaFor={schemaFor}
            onPress={onPress}
            onDrag={onDrag}
            onAdd={() => openLibrary()}
            onReorder={onReorder}
            neighbours={neighbours}
            onDuplicate={(id) => void duplicateScene(id)}
            onToggleShow={(id, enabled) => onElementChange(id, { enabled })}
            onRemove={(id) => void removeFromSpot(id)}
            onFrame={(f) => {
              frameRef.current = f;
            }}
            seekRef={seekRef}
            onTextEdit={setElementValue}
            onDropAsset={(elementId, assetId) => {
              const element = elements.find((e) => e.id === elementId);
              if (element) {
                setSelectedId(elementId);
                assignClip(element, assetId);
              }
            }}
            onDropFile={async (elementId, file) => {
              const uploaded = await api.uploadMedia(file);
              const list = await refreshAssets();
              const element = elements.find((e) => e.id === elementId);
              const asset = list.find((a) => a.id === uploaded.id) ?? uploaded;
              if (element && asset.kind !== 'audio') {
                setSelectedId(elementId);
                assignClip(element, asset.id);
              }
            }}
          />

          <aside className="w-[320px] shrink-0 border-l border-line bg-panel overflow-y-auto">
            {!selected && (
              <div className="px-5 py-6" data-testid="empty-panel">
                <h2 className="text-lg font-semibold tracking-tight">Nothing on the video yet</h2>
                <p className="mt-2 text-[13px] text-fg-2">Add a scene from the library: a headline, a background, an end card. Overlays sit on top of the scene under the playhead.</p>
                <Button variant="ghost" className="mt-4" onClick={() => openLibrary()}>
                  Add the first scene
                </Button>
              </div>
            )}
            {selected && (
              <>
                <div className="px-5 pt-4 pb-3 border-b border-line flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight truncate">{selected.name}</h2>
                    <p className="text-[11px] text-fg-3 tabular-nums">
                      {seconds(selected.startFrame).toFixed(1)} s to {seconds(selected.endFrame).toFixed(1)} s
                    </p>
                    {aspect !== '16:9' && selected.variant === false && (
                      <p data-testid="autofit-note" className="mt-1 text-[11px] text-fg-2">
                        Auto-fitted from 16:9. Ask the designer for a {aspect} version of this scene.
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-fg-2 shrink-0">
                    Show
                    <Switch label={`Toggle ${selected.name}`} checked={selected.enabled} onChange={(enabled) => onElementChange(selected.id, { enabled })} />
                  </label>
                </div>
                <div className="px-5 py-4 border-b border-line">
                  <Inspector
                    key={selected.id}
                    schema={selected.schema}
                    values={values[selected.id] ?? {}}
                    onChange={setSelectedValues}
                    assets={assets}
                    templateSlug={loaded.detail.template.slug}
                    elementBaseUrl={selected.lottieUrl.replace(/\/template\.json$/, '')}
                    activeKey={active && active.elementId === selected.id ? active.key : null}
                  />
                </div>
                {boundaries.has(selected.id) && (
                  <Section title="How it ends" id="how-it-ends">
                    <TransitionControl element={selected} transition={transitions.find((t) => t.afterElementId === selected.id)} onChange={(t) => void onTransitionChange(selected.id, t)} />
                  </Section>
                )}
                <Section title={isSceneType(selected.type) ? 'Scene' : 'Overlay'} id="scene">
                  <p className="text-[11px] text-fg-3 mb-2">
                    {isSceneType(selected.type)
                      ? 'A second copy of this scene, with its words and colours, right after it.'
                      : 'A second copy of this overlay, with its words and colours, on the same scene. Drag its chip onto another scene.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" icon={Copy} onClick={() => void duplicateScene(selected.id)}>
                      {isSceneType(selected.type) ? 'Duplicate scene' : 'Duplicate'}
                    </Button>
                    {isSceneType(selected.type) && (
                      <>
                        {/* The keyboard's route to what a chip drag does (finish review, 2026-09-17). */}
                        <Button variant="ghost" size="sm" icon={ArrowLeftToLine} disabled={!neighbours(selected.id).before} onClick={() => neighbours(selected.id).before && onReorder(selected.id, neighbours(selected.id).before!, 'before')}>
                          Move earlier
                        </Button>
                        <Button variant="ghost" size="sm" icon={ArrowRightToLine} disabled={!neighbours(selected.id).after} onClick={() => neighbours(selected.id).after && onReorder(selected.id, neighbours(selected.id).after!, 'after')}>
                          Move later
                        </Button>
                      </>
                    )}
                  </div>
                </Section>
                {selected.added && (
                  <Section title="From the library" id="from-library">
                    <p className="text-[11px] text-fg-3 mb-2">Added from another template. Removing it puts the spot back as it was.</p>
                    <Button variant="danger" size="sm" icon={Trash2} onClick={() => void removeFromSpot(selected.id)}>
                      Remove from spot
                    </Button>
                  </Section>
                )}
              </>
            )}
            <Section title="Exports" id="exports">
              <ExportHistory projectId={projectId} refreshKey={exportsTick} projectName={loaded.detail.project.name} />
            </Section>
          </aside>
        </div>
      )}
    </main>
  );
}

const PRESET_LABEL: Record<TransitionPreset, string> = { cut: 'Cut', fade: 'Fade', wipe: 'Wipe', slide: 'Slide' };

/** M30: the transition on the boundary after an element, in its panel: a segmented row and a length slider in seconds. */
function TransitionControl({
  element,
  transition,
  onChange,
}: {
  element: ProjectElement;
  transition: ProjectTransition | undefined;
  onChange: (t: { preset: TransitionPreset; durationInFrames: number }) => void;
}) {
  const preset = transition?.preset ?? 'cut';
  const length = transition?.durationInFrames ?? DEFAULT_TRANSITION_FRAMES;
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={`Transition after ${element.slug}`}
        size="sm"
        value={preset}
        options={TRANSITION_PRESETS.map((p) => ({ value: p, label: PRESET_LABEL[p] }))}
        onChange={(p) => onChange({ preset: p, durationInFrames: length })}
        className="w-full [&>button]:flex-1"
      />
      {preset !== 'cut' && (
        <Slider
          label={`Transition length after ${element.slug}`}
          name="Over"
          min={3}
          max={Math.max(60, length)}
          step={1}
          value={length}
          format={(v) => `${seconds(v).toFixed(1)} s`}
          onChange={(n) => onChange({ preset, durationInFrames: Math.max(1, Math.round(n) || 1) })}
        />
      )}
    </div>
  );
}

/** M22: the project name, editable in place. Enter saves, Escape cancels, an empty name is ignored. */
function ProjectName({ name, templateName, onRename }: { name: string | null; templateName: string | null; onRename: (name: string) => Promise<void> }) {
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
        className="field max-w-sm !py-1.5 text-center font-semibold"
      />
    );
  }
  return (
    <h1 className="text-[13px] font-semibold tracking-tight flex items-center justify-center gap-2 min-w-0 flex-1">
      <span className="truncate">{name ?? '…'}</span>
      {templateName && (
        <>
          <span aria-hidden="true" className="text-fg-3 font-normal">
            ·
          </span>
          <span className="text-xs font-normal text-fg-3 truncate">{templateName}</span>
        </>
      )}
      {name !== null && (
        <IconButton
          label="Rename project"
          icon={Pencil}
          className="!w-7 !h-7 shrink-0"
          onClick={() => {
            setDraft(name);
            setError(null);
            setEditing(true);
          }}
        />
      )}
      {error && <span className="text-[11px] font-normal text-red-ink">{error}</span>}
    </h1>
  );
}

/**
 * M31: the element library, grouped by type, in the left column while
 * choosing. Never over the video.
 */
/** M45: how many scenes of the spot use each library element, by template element id. */
function usesByElement(elements: { elementId?: number; id: number }[]): Map<number, number> {
  const uses = new Map<number, number>();
  for (const e of elements) {
    const key = e.elementId ?? e.id;
    uses.set(key, (uses.get(key) ?? 0) + 1);
  }
  return uses;
}

/** M42: the library's Lotties, fetched once per page for every opening of the picker (a template's files do not change under a session). */
const pickerLotties = new Map<string, LottieAnimationData>();

type LeftTab = 'templates' | 'footage' | 'stock' | 'brand';
function rememberedLeftTab(): LeftTab {
  try {
    const saved = window.localStorage.getItem('cc.left.tab');
    return saved === 'footage' || saved === 'stock' || saved === 'brand' ? saved : 'templates';
  } catch {
    return 'templates';
  }
}

/**
 * M66: the Templates tab. Your copy at the top, then every shelf as a
 * fold-out row with its count; open one and its elements show as pictures,
 * drawn with your words, to press and add. Replaces the pop-over picker.
 */
function LibraryBrowser({
  library,
  error,
  inSpot,
  onAdd,
  openGroups,
  onToggleGroup,
  scrollTo,
  onScrolled,
}: {
  library: LibraryElement[] | null;
  error: string | null;
  /** M45: how many times each library element is already in the spot, by template element id. */
  inSpot: Map<number, number>;
  onAdd: (item: LibraryElement, copy: string) => void;
  openGroups: Set<string>;
  onToggleGroup: (type: string) => void;
  /** A shelf to bring into view once, from the strip's Add card or the panel. */
  scrollTo: string | null;
  onScrolled: () => void;
}) {
  const groups: { type: string; label: string; items: LibraryElement[] }[] = PICKER_ORDER.map((type) => ({ type, label: ELEMENT_TYPE_LABELS[type], items: (library ?? []).filter((e) => e.type === type) })).filter((g) => g.items.length > 0);
  const untyped = (library ?? []).filter((e) => !(ELEMENT_TYPES as readonly string[]).includes(e.type));
  if (untyped.length > 0) groups.push({ type: 'other', label: 'Other', items: untyped });

  // M37: the composer. Type your copy once; every text element previews
  // with it. Each element's Lottie is fetched once and drawn as a still.
  const [copy, setCopy] = useState('');
  const [previews, setPreviews] = useState<Record<number, LottieAnimationData>>(() => {
    const cached: Record<number, LottieAnimationData> = {};
    for (const item of library ?? []) {
      const l = pickerLotties.get(item.lottieUrl);
      if (l) cached[item.id] = l;
    }
    return cached;
  });
  useEffect(() => {
    let cancelled = false;
    for (const item of library ?? []) {
      if (previews[item.id]) continue;
      api
        .elementLottie(item.lottieUrl)
        .then((l) => {
          pickerLotties.set(item.lottieUrl, l);
          if (!cancelled) setPreviews((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: l }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per item; the cache guards repeats
  }, [library]);
  const libraryFonts = useMemo(() => {
    const seen = new Map<string, TemplateFontFile>();
    for (const item of library ?? []) for (const f of item.fontFiles ?? []) seen.set(`${f.templateSlug}/${f.file}`, f);
    return fontsFor([...seen.values()], '', API);
  }, [library]);
  const fontCss = useMemo(() => fontFaceCss(libraryFonts), [libraryFonts]);
  // M38: lottie-web keeps the character widths it measures on mount, so a
  // still drawn before its face loaded stays spaced like the fallback font.
  // The previews wait for the faces (nothing to wait for where the browser
  // has no font loading API, as in tests).
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fontSet = typeof document !== 'undefined' ? (document as { fonts?: { load: (spec: string) => Promise<unknown> } }).fonts : undefined;
    if (!fontSet || libraryFonts.length === 0) {
      setFontsReady(true);
      return;
    }
    setFontsReady(false);
    Promise.all(libraryFonts.map((f) => fontSet.load(fontLoadSpec(f)).catch(() => undefined))).then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [libraryFonts]);
  const holdFor = (item: LibraryElement, l: LottieAnimationData) => Number(l.ip) + Math.min(compositionConfig.fps, Math.floor(item.durationInFrames / 2));

  return (
    <div data-testid="library-browser" className="flex flex-col">
      {fontCss && <style>{fontCss}</style>}
      <div className="px-4 pt-3 pb-2">
        <label htmlFor="composer" className="block text-xs font-medium text-fg-2 mb-1.5">
          Your text
        </label>
        <input
          id="composer"
          aria-label="Preview every text element with your copy"
          value={copy}
          placeholder="Type your copy to see it in every element"
          onChange={(e) => setCopy(e.target.value)}
          className="field !py-1.5"
        />
        <p className="mt-1.5 text-[11px] text-fg-3">Every element previews with your words. Open a shelf and press one to add it.</p>
      </div>
      {error && <p className="px-4 pt-2 text-xs text-red-ink">{error}</p>}
      {library === null && !error && <p className="px-4 py-3 text-xs text-fg-3">Loading…</p>}
      {library !== null && library.length === 0 && <p className="px-4 py-3 text-xs text-fg-2">Nothing in the library yet. Add a template first.</p>}
      {groups.map((g) => {
        const open = openGroups.has(g.type);
        return (
          <section
            key={g.type}
            id={`picker-${g.type}`}
            data-testid={`shelf-${g.type}`}
            className="border-t border-line"
            ref={(node) => {
              if (node && scrollTo === g.type && library) {
                node.scrollIntoView?.({ block: 'start' });
                onScrolled();
              }
            }}
          >
            <div className="flex items-center gap-2 pr-4">
              <h3 className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => onToggleGroup(g.type)}
                  className="w-full h-10 pl-4 pr-2 inline-flex items-center gap-2 text-[13px] font-semibold text-fg text-left rounded-sm hover:bg-hover/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                >
                  <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className={`shrink-0 text-fg-3 transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
                  <span className="truncate">{g.label}</span>
                </button>
              </h3>
              <span className="text-[11px] text-fg-3 tabular-nums" aria-label={`${g.items.length} in ${g.label}`}>
                {g.items.length}
              </span>
            </div>
            {open && (
              <ul className="grid grid-cols-2 gap-2 px-4 pb-3">
                {g.items.map((item) => {
                  const uses = inSpot.get(item.id) ?? 0;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-label={`Add ${item.name} from ${item.templateName}`}
                        title={`${item.templateName} · ${seconds(item.durationInFrames).toFixed(1)} s`}
                        onClick={() => onAdd(item, copy)}
                        className="cc-press group/card w-full text-left rounded-lg overflow-hidden bg-raised border border-line hover:border-line-strong hover:bg-hover disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                      >
                        <div className="relative aspect-video bg-stage">
                          {fontsReady && previews[item.id] ? (
                            <ElementPreview
                              testId={`element-preview-${item.id}`}
                              lottie={previews[item.id]!}
                              schema={item.schema}
                              values={previewValues(item.schema, copy)}
                              frame={holdFor(item, previews[item.id]!)}
                              assetBase={`${API}${item.lottieUrl.replace(/\/template\.json$/, '')}`}
                              className="w-full h-full"
                            />
                          ) : (
                            item.thumbUrl && <img src={api.fileUrl(item.thumbUrl)} alt="" className="w-full h-full object-cover block" />
                          )}
                          <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue text-on-blue inline-flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity" aria-hidden="true">
                            <Plus size={12} strokeWidth={2} />
                          </span>
                          {uses > 0 && <span className="absolute bottom-1 left-1 px-1.5 py-px rounded-xs bg-blue text-[11px] font-semibold text-on-blue">{uses === 1 ? 'in the spot' : `in the spot ×${uses}`}</span>}
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="text-xs font-medium truncate">{item.name}</div>
                          <div className="text-[11px] text-fg-3 truncate tabular-nums">
                            {item.templateName} · {seconds(item.durationInFrames).toFixed(1)} s{uses > 0 ? (uses === 1 ? ' · in the spot' : ` · in the spot ×${uses}`) : ''}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const text = { idle: 'Saved', dirty: 'Unsaved', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[state];
  const colour = state === 'error' ? 'text-red-ink' : state === 'saved' || state === 'idle' ? 'text-fg-3' : 'text-blue';
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

type Outline = { left: number; top: number; width: number; height: number };

/** M43: the drag type a scene chip carries; M44: the one an overlay chip carries. Only scene chips take a drop. */
const SCENE_DRAG_TYPE = 'application/x-campaigncut-scene';
const OVERLAY_DRAG_TYPE = 'application/x-campaigncut-overlay';
type DropPlace = 'before' | 'after' | 'on';

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
  onTransitionChange,
  audio,
  assets,
  selectedId,
  onSelect,
  frameSize,
  treatment,
  lengthS,
  schemaFor,
  onPress,
  onDrag,
  onAdd,
  onReorder,
  neighbours,
  onDuplicate,
  onToggleShow,
  onRemove,
  onFrame,
  seekRef,
  onTextEdit,
  onDropAsset,
  onDropFile,
}: {
  loaded: Loaded;
  values: ValuesByElement;
  elements: ProjectElement[];
  transitions: ProjectTransition[];
  /** M55: a transition chosen on the marker between two scene chips. */
  onTransitionChange: (afterElementId: number, t: { preset: TransitionPreset; durationInFrames: number }) => void;
  /** M20: the music bed, or null. */
  audio: ProjectAudio | null;
  assets: MediaAsset[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  /** M36: the frame this version renders at. */
  frameSize: Frame;
  /** M39: the style treatment across the spot. */
  treatment: Treatment;
  /** M52: the spot's length in seconds; it plays exactly this long. */
  lengthS: number;
  /** M28: an element's schema, to know which layers on screen are placements. */
  schemaFor: (elementId: number) => TemplateParam[] | undefined;
  /** M28: a press on an editable layer: select its element and make that placement the active one. */
  onPress: (elementId: number, key: string) => void;
  /** Fractions of the monitor the pointer moved since the last call, for one placement. */
  onDrag: (elementId: number, key: string, dx: number, dy: number) => void;
  /** M31: the Add chip at the end of the scene strip. */
  onAdd: () => void;
  /** M43: a scene chip dropped before or after another scene. */
  onReorder: (movedId: number, targetId: number, place: DropPlace) => void;
  /** M66: the chip's own menu: the scenes either side of one, and the four commands. */
  neighbours: (sceneId: number) => { before: number | null; after: number | null };
  onDuplicate: (id: number) => void;
  onToggleShow: (id: number, enabled: boolean) => void;
  onRemove: (id: number) => void;
  /** M31: the playhead, for adding at the current frame. */
  onFrame: (frame: number) => void;
  /** M31: the editor seeks through this after adding. */
  seekRef: { current: (frame: number) => void };
  /** M30: typing on the video changes one text value. */
  onTextEdit: (elementId: number, key: string, value: string) => void;
  /** M30: a library clip dropped on the video lands in this element's slot. */
  onDropAsset: (elementId: number, assetId: number) => void;
  /** M30: a file from the desktop dropped on the video is uploaded, then lands in the slot. */
  onDropFile: (elementId: number, file: File) => Promise<void>;
}) {
  const { detail, lotties } = loaded;
  const slug = detail.template.slug;

  // M28 direct manipulation. A press on an editable layer (found by its box
  // in the rendered SVG) starts a drag; the preview itself is the feedback.
  // The only things drawn over the video: a hairline around the layer under
  // the pointer, the in-place text editor while typing, and the slot's
  // outline while a clip is dragged over it. Nothing at rest.
  const drag = useRef<{ elementId: number; key: string; originX: number; originY: number; applied: { x: number; y: number }; box: Box } | null>(null);
  const swallowClick = useRef(false);
  const [outline, setOutline] = useState<Outline | null>(null);
  // M43: which scene chip a dragged scene would land before or after.
  const [dropEdge, setDropEdge] = useState<{ id: number; place: DropPlace } | null>(null);
  // M55: which scene's "how it ends" marker is open in the strip.
  const [transitionMenu, setTransitionMenu] = useState<number | null>(null);
  // M66: which chip's menu is open; a press anywhere else, or Escape, closes it.
  // The strip scrolls sideways, which would clip a menu inside it, so the menu is fixed to the viewport at the dots' spot.
  const [chipMenu, setChipMenu] = useState<{ id: number; left: number; bottom: number } | null>(null);
  useEffect(() => {
    if (chipMenu === null) return;
    const close = () => setChipMenu(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [chipMenu]);
  const relative = (box: Box, monitor: DOMRect, dx = 0, dy = 0): Outline => ({ left: box.left - monitor.left + dx, top: box.top - monitor.top + dy, width: box.width, height: box.height });
  const layerAt = (monitor: HTMLElement, x: number, y: number) => pickLayer(findLayerBoxes(monitor, schemaFor), x, y);

  const onMonitorDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && !(e.buttons & 1)) return;
    const monitor = e.currentTarget;
    const hit = layerAt(monitor, e.clientX, e.clientY);
    if (!hit) return;
    e.stopPropagation();
    e.preventDefault();
    playerRef.current?.pause?.();
    try {
      monitor.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom or a synthetic pointer id */
    }
    drag.current = { elementId: hit.elementId, key: hit.key, originX: e.clientX, originY: e.clientY, applied: { x: 0, y: 0 }, box: hit.rect };
    setOutline(relative(hit.rect, monitor.getBoundingClientRect()));
    onPress(hit.elementId, hit.key);
  };
  const onMonitorMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const monitor = e.currentTarget;
    const rect = monitor.getBoundingClientRect();
    const d = drag.current;
    if (d && e.buttons & 1) {
      if (rect.width <= 0 || rect.height <= 0) return;
      // Fractions of the monitor travelled since the press; Shift keeps the larger axis only.
      let x = (e.clientX - d.originX) / rect.width;
      let y = (e.clientY - d.originY) / rect.height;
      if (e.shiftKey) {
        if (Math.abs(x) >= Math.abs(y)) y = 0;
        else x = 0;
      }
      if (x !== d.applied.x || y !== d.applied.y) {
        // M36: an auto-fitted element is drawn in a smaller box, so a fraction of the
        // monitor is a larger fraction of the element's own frame.
        const source = lotties[d.elementId];
        const authored = { width: Number(source?.w) || frameSize.width, height: Number(source?.h) || frameSize.height };
        const box = autoFitBox(authored, frameSize);
        onDrag(d.elementId, d.key, ((x - d.applied.x) * frameSize.width) / box.width, ((y - d.applied.y) * frameSize.height) / box.height);
        d.applied = { x, y };
        swallowClick.current = true;
      }
      setOutline(relative(d.box, rect, x * rect.width, y * rect.height));
      return;
    }
    if (d) return;
    const hit = layerAt(monitor, e.clientX, e.clientY);
    setOutline(hit ? relative(hit.rect, rect) : null);
  };
  const onMonitorUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
    swallowClick.current = true;
    setOutline(null);
  };
  /** The Player toggles playback on click; a press that picked a layer must not. */
  const onMonitorClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  // M30: type on the video. A double-click on a text layer opens a field
  // anchored to that layer; every keystroke reaches the composition.
  const [editing, setEditing] = useState<{ elementId: number; key: string; label: string; box: Outline; original: string } | null>(null);
  const onMonitorDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const monitor = e.currentTarget;
    const hit = layerAt(monitor, e.clientX, e.clientY);
    if (!hit) return;
    const schema = schemaFor(hit.elementId) ?? [];
    const placement = schema.find((p) => p.kind === 'transform' && p.key === hit.key);
    const text = placement?.for ? schema.find((p) => p.key === placement.for && p.kind === 'text') : undefined;
    if (!text) return;
    e.stopPropagation();
    e.preventDefault();
    playerRef.current?.pause?.();
    const current = values[hit.elementId]?.[text.key];
    const original = typeof current === 'string' ? current : String(text.default ?? '');
    onSelect(hit.elementId);
    setEditing({ elementId: hit.elementId, key: text.key, label: text.label, box: relative(hit.rect, monitor.getBoundingClientRect()), original });
    setOutline(null);
  };
  const editingValue = editing ? values[editing.elementId]?.[editing.key] : undefined;
  const editingText = typeof editingValue === 'string' ? editingValue : (editing?.original ?? '');
  const editingParam = editing ? schemaFor(editing.elementId)?.find((p) => p.key === editing.key) : undefined;

  // M30: drop a clip on the video. While a library clip (or a video file)
  // is over the monitor, the footage slot of the scene on screen lights up.
  const [dropBox, setDropBox] = useState<{ elementId: number; box: Outline; label: string } | null>(null);
  const [frame, setFrame] = useState(0);
  const dropTargetAt = (monitorRect: DOMRect) => {
    const onScreen = [...elements].filter((e) => e.enabled && frame >= e.startFrame && frame < e.endFrame && e.schema.some((p) => p.kind === 'media')).sort((a, b) => b.zIndex - a.zIndex)[0];
    const target = onScreen ?? mediaElementOf(elements);
    if (!target) return null;
    const mediaParam = target.schema.find((p) => p.kind === 'media')!;
    const source = lotties[target.id];
    const rect = source ? mediaFillRect(source, mediaParam.path) : null;
    const box: Outline = rect
      ? { left: rect.x * monitorRect.width, top: rect.y * monitorRect.height, width: rect.w * monitorRect.width, height: rect.h * monitorRect.height }
      : { left: 0, top: 0, width: monitorRect.width, height: monitorRect.height };
    return { elementId: target.id, box, label: `${mediaParam.label} · ${target.name}` };
  };
  const carriesClip = (e: ReactDragEvent) => Array.from(e.dataTransfer?.types ?? []).some((t) => t === ASSET_DRAG_TYPE || t === 'Files');
  const onMonitorDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!carriesClip(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dropBox) setDropBox(dropTargetAt(e.currentTarget.getBoundingClientRect()));
  };
  const onMonitorDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropBox(null);
  };
  const onMonitorDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!carriesClip(e)) return;
    e.preventDefault();
    const target = dropBox ?? dropTargetAt(e.currentTarget.getBoundingClientRect());
    setDropBox(null);
    if (!target) return;
    const id = Number(e.dataTransfer.getData(ASSET_DRAG_TYPE));
    if (Number.isFinite(id) && id > 0) {
      onDropAsset(target.elementId, id);
      return;
    }
    const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type.startsWith('video/'));
    if (file) void onDropFile(target.elementId, file);
  };

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

  /** The clip a scene carries in its footage slot, for its chip (M42 review): the asset behind its cc.mediaFill value, or none. */
  const chipClip = (e: ProjectElement) => {
    const mediaParam = e.schema.find((p) => p.kind === 'media');
    const v = mediaParam ? values[e.id]?.[mediaParam.key] : undefined;
    const assetId = v && typeof v === 'object' && 'assetId' in v ? (v as { assetId: number }).assetId : null;
    return assetId === null ? undefined : assets.find((a) => a.id === assetId);
  };
  const elementProps = useMemo<ElementProps[]>(
    () =>
      elements.map((e) => {
        const source = lotties[e.id];
        const base = `${API}${e.lottieUrl.replace(/\/template\.json$/, '')}`;
        const resolvedSource = source ? resolveLottieAssets(source, base) : EMPTY_LOTTIE;
        const resolvedValues = withBaseUrl(renderedValues[e.id] ?? {}, e.schema, API);
        const lottie = applyLottieValues(resolvedSource, resolvedValues, e.schema);
        return { id: String(e.id), lottie, startFrame: e.startFrame, endFrame: e.endFrame, zIndex: e.zIndex, enabled: e.enabled, media: mediaFor(e), callouts: calloutsFrom(e.schema, resolvedValues, accentOf(e.schema, resolvedValues)), fit: fitSpecsFrom(e.schema) };
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
    () => ({
      background: detail.meta?.background ?? BACKGROUND,
      audio: audioProps,
      elements: elementProps,
      transitions: transitionProps,
      fonts,
      frame: frameSize,
      // M39: the treatment, with the spot's accent for glow, the way the export runner builds it
      treatment: treatmentFor(treatment, elements.map((e) => ({ schema: e.schema, values: values[e.id] ?? {} }))) ?? null,
      lengthFrames: Math.round(lengthS * compositionConfig.fps),
    }),
    [detail.meta, audioProps, elementProps, transitionProps, fonts, frameSize, treatment, elements, values, lengthS],
  );
  const durationInFrames = spotDurationFrames(elementProps, transitionProps, Math.round(lengthS * compositionConfig.fps));
  const contentS = contentSeconds(elements, compositionConfig.fps);

  // Playhead: follow the Player, and drive it from the scene strip and the
  // transport. The Player's own chrome is off: the transport is drawn under
  // the monitor in the world's vocabulary, so nothing sits over the video.
  const playerRef = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onPause);
    };
  }, [loaded]);
  const seek = (f: number) => {
    playerRef.current?.seekTo(f);
    setFrame(f);
  };
  seekRef.current = seek;
  useEffect(() => onFrame(frame), [frame, onFrame]);
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying?.()) player.pause();
    else player.play?.();
  };
  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted?.()) player.unmute?.();
    else player.mute?.();
    setMuted(player.isMuted?.() ?? !muted);
  };
  // Space plays and pauses, outside text fields. One listener for the monitor's life.
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || isTextEntry(e.target)) return;
      e.preventDefault();
      togglePlayRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Open on a frame where the first scene's design is on screen, not on the empty first frame of its entrance.
  const firstScene = inStartOrder(elements)[0];
  const initialFrame = firstScene ? holdFrame(firstScene) : 0;
  // Once per spot opened, not on every reload: an added scene moves the playhead itself (M41).
  useEffect(() => setFrame(initialFrame), [loaded.detail.project.id]); // eslint-disable-line react-hooks/exhaustive-deps -- the opening frame, once

  // M12 measurement mode: open the editor with ?perf=<seconds> and the Player
  // is played from the start for that long while frame updates are counted.
  // The result lands under the monitor and on window.__ccPerf for scripts.
  const [perf, setPerf] = useState<PlaybackSummary | null>(null);
  useEffect(() => {
    const secondsToRun = Number(new URLSearchParams(window.location.search).get('perf'));
    const player = playerRef.current;
    if (!secondsToRun || !player) return;
    const t = setTimeout(async () => {
      const result = await measurePlayback(player, secondsToRun, compositionConfig.fps);
      (window as unknown as { __ccPerf?: PlaybackSummary }).__ccPerf = result;
      setPerf(result);
    }, 1500);
    return () => clearTimeout(t);
  }, [loaded]);

  const editorTop = editing ? Math.min(editing.box.top + editing.box.height + 8, Math.max(0, editing.box.top)) : 0;

  /** One chip: a scene (with its still and label) or an overlay (a small pill under its scene). Both drag; only scene chips take drops. */
  const chip = (e: ProjectElement, kind: 'scene' | 'overlay') => {
          const isSelected = e.id === selectedId;
          const onScreen = e.enabled && frame >= e.startFrame && frame < e.endFrame;
    const menuOpen = chipMenu?.id === e.id;
    const scene = isSceneType(e.type);
    const near = scene ? neighbours(e.id) : { before: null, after: null };
    const menuItem = 'w-full h-8 px-2.5 inline-flex items-center gap-2 rounded-md text-xs text-left text-fg hover:bg-hover disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:bg-hover';
    return (
          <div key={e.id} data-testid={`chip-${e.id}`} className={`relative group/chip ${kind === 'scene' ? 'flex [&>button:first-child]:flex-1' : 'inline-flex'}`}>
            <button
              type="button"
              aria-label={`Select ${e.name}`}
              data-testid={`scene-${e.id}`}
              data-selected={isSelected ? 'true' : 'false'}
              aria-pressed={isSelected}
              onClick={() => {
                onSelect(e.id);
                seek(holdFrame(e));
              }}
              draggable={e.enabled}
              title={!e.enabled ? 'Hidden scene · switch Show on to drag' : isSceneType(e.type) ? 'Drag to reorder' : 'Drag onto a scene'}
              data-drop-edge={dropEdge?.id === e.id ? dropEdge.place : undefined}
              onDragStart={(ev) => {
                // M43: a scene drags to reorder; M44: an overlay drags onto a scene.
                ev.dataTransfer.setData(isSceneType(e.type) ? SCENE_DRAG_TYPE : OVERLAY_DRAG_TYPE, String(e.id));
                ev.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(ev) => {
                const types = Array.from(ev.dataTransfer.types);
                const carried = types.includes(SCENE_DRAG_TYPE) ? 'scene' : types.includes(OVERLAY_DRAG_TYPE) ? 'overlay' : null;
                if (!isSceneType(e.type) || !carried) return;
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                const box = ev.currentTarget.getBoundingClientRect();
                const place: DropPlace = carried === 'overlay' ? 'on' : ev.clientX < box.left + box.width / 2 ? 'before' : 'after';
                setDropEdge((prev) => (prev?.id === e.id && prev.place === place ? prev : { id: e.id, place }));
              }}
              onDragLeave={(ev) => {
                if (ev.relatedTarget instanceof Node && ev.currentTarget.contains(ev.relatedTarget)) return;
                setDropEdge((prev) => (prev?.id === e.id ? null : prev));
              }}
              onDrop={(ev) => {
                const sceneId = Number(ev.dataTransfer.getData(SCENE_DRAG_TYPE));
                const overlayId = Number(ev.dataTransfer.getData(OVERLAY_DRAG_TYPE));
                setDropEdge(null);
                if (!isSceneType(e.type) || (!sceneId && !overlayId)) return;
                ev.preventDefault();
                if (overlayId) {
                  onReorder(overlayId, e.id, 'on');
                  return;
                }
                const box = ev.currentTarget.getBoundingClientRect();
                onReorder(sceneId, e.id, ev.clientX < box.left + box.width / 2 ? 'before' : 'after');
              }}
              className={`group relative overflow-hidden flex items-center text-left transition-colors ${kind === 'scene' ? 'min-w-44 gap-3 rounded-lg pl-2 pr-8 py-2' : 'gap-1.5 rounded-full h-7 pl-3 pr-7 text-xs'} ${e.enabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${
                onScreen ? 'bg-blue text-on-blue' : dropEdge?.id === e.id && dropEdge.place === 'on' ? 'bg-blue-tint text-fg' : 'bg-raised text-fg hover:bg-hover'
              } ${isSelected || dropEdge?.id === e.id && dropEdge.place === 'on' ? 'ring-2 ring-blue ring-offset-2 ring-offset-panel' : ''} ${e.enabled ? '' : 'opacity-60'} ${
                dropEdge?.id === e.id && dropEdge.place !== 'on' ? (dropEdge.place === 'before' ? 'shadow-[inset_3px_0_0_0_var(--color-blue)]' : 'shadow-[inset_-3px_0_0_0_var(--color-blue)]') : ''
              }`}
            >
              {/* M37: the scene as it stands, drawn at its hold frame with its own values. */}
              {kind === 'scene' && (
              <div className="relative w-16 shrink-0 rounded-md bg-stage overflow-hidden" style={{ aspectRatio: `${frameSize.width} / ${frameSize.height}` }}>
                {chipClip(e)?.thumbUrl && <img src={api.fileUrl(chipClip(e)!.thumbUrl!)} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                {lotties[e.id] && (
                  <ElementPreview
                    testId={`scene-thumb-${e.id}`}
                    lottie={lotties[e.id]!}
                    schema={e.schema}
                    values={renderedValues[e.id] ?? {}}
                    frame={Number(lotties[e.id]!.ip) + (holdFrame(e) - e.startFrame)}
                    assetBase={`${API}${e.lottieUrl.replace(/\/template\.json$/, '')}`}
                    className="w-full h-full"
                  />
                )}
              </div>
              )}
              <span className="flex flex-col items-start gap-0.5 min-w-0">
              <span className={`flex items-center gap-1.5 font-medium whitespace-nowrap ${kind === 'scene' ? 'text-[13px]' : 'text-xs'}`}>
                <span className="truncate">{e.name}</span>
                {!e.enabled && <EyeOff size={12} strokeWidth={1.75} aria-hidden="true" className={onScreen ? 'text-on-blue/70' : 'text-fg-3'} />}
              </span>
              {kind === 'scene' && (
              <span className={`text-[11px] tabular-nums truncate max-w-full ${onScreen ? 'text-on-blue/75' : 'text-fg-3'}`}>
                {seconds(e.startFrame).toFixed(1)} s · {seconds(e.endFrame - e.startFrame).toFixed(1)} s long
              </span>
              )}
              </span>
            </button>
            {/* M66: the chip's own menu (Josh: delete one opening without hunting for it in the panel). */}
            <button
              type="button"
              aria-label={`Actions for ${e.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                const rect = ev.currentTarget.getBoundingClientRect();
                setChipMenu((open) => (open?.id === e.id ? null : { id: e.id, left: rect.left, bottom: window.innerHeight - rect.top + 6 }));
              }}
              className={`absolute inline-flex items-center justify-center rounded-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
                kind === 'scene' ? 'top-1.5 right-1.5 w-6 h-6' : 'top-1 right-1 w-5 h-5'
              } ${menuOpen || isSelected ? 'opacity-100' : 'opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100'} ${onScreen ? 'text-on-blue/80 hover:bg-on-blue/15' : 'text-fg-3 hover:text-fg hover:bg-hover'}`}
            >
              <MoreHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div role="menu" aria-label={`Actions for ${e.name}`} onPointerDown={(ev) => ev.stopPropagation()} style={{ position: 'fixed', left: chipMenu!.left, bottom: chipMenu!.bottom }} className="z-30 w-48 rounded-lg bg-panel border border-line shadow-float p-1 cc-appear">
                <button type="button" role="menuitem" className={menuItem} onClick={() => { setChipMenu(null); onDuplicate(e.id); }}>
                  <Copy size={14} strokeWidth={1.75} aria-hidden="true" className="text-fg-3" />
                  {scene ? 'Duplicate scene' : 'Duplicate'}
                </button>
                {scene && (
                  <>
                    <button type="button" role="menuitem" className={menuItem} disabled={!near.before} onClick={() => { setChipMenu(null); if (near.before) onReorder(e.id, near.before, 'before'); }}>
                      <ArrowLeftToLine size={14} strokeWidth={1.75} aria-hidden="true" className="text-fg-3" />
                      Move earlier
                    </button>
                    <button type="button" role="menuitem" className={menuItem} disabled={!near.after} onClick={() => { setChipMenu(null); if (near.after) onReorder(e.id, near.after, 'after'); }}>
                      <ArrowRightToLine size={14} strokeWidth={1.75} aria-hidden="true" className="text-fg-3" />
                      Move later
                    </button>
                  </>
                )}
                <button type="button" role="menuitem" className={menuItem} onClick={() => { setChipMenu(null); onToggleShow(e.id, !e.enabled); }}>
                  {e.enabled ? <EyeOff size={14} strokeWidth={1.75} aria-hidden="true" className="text-fg-3" /> : <Eye size={14} strokeWidth={1.75} aria-hidden="true" className="text-fg-3" />}
                  {e.enabled ? 'Hide' : 'Show'}
                </button>
                {e.added && (
                  <button type="button" role="menuitem" className={`${menuItem} !text-red-ink hover:!bg-red-tint`} onClick={() => { setChipMenu(null); onRemove(e.id); }}>
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                    Remove from spot
                  </button>
                )}
              </div>
            )}
          </div>
    );
  };
  const structure = structureOf(elements);

  return (
    <section className="on-stage flex-1 min-w-0 flex flex-col bg-stage">
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        {/* M36: the monitor takes the version's ratio; a tall version is limited by height, a wide one by width. */}
        <div className="w-full max-w-[1400px]" style={{ maxWidth: `min(1400px, calc((100vh - 300px) * ${frameSize.width / frameSize.height}))` }}>
          {/* Program monitor. Nothing sits over the video at rest. */}
          <div
            data-testid="monitor"
            className="relative select-none rounded-lg overflow-hidden bg-black shadow-float"
            style={{ cursor: outline ? 'move' : undefined, touchAction: 'none' }}
            onPointerDownCapture={onMonitorDown}
            onPointerMoveCapture={onMonitorMove}
            onPointerUpCapture={onMonitorUp}
            onPointerCancelCapture={onMonitorUp}
            onPointerLeave={() => {
              if (!drag.current) setOutline(null);
            }}
            onClickCapture={onMonitorClick}
            onDoubleClickCapture={onMonitorDoubleClick}
            onDragOver={onMonitorDragOver}
            onDragEnter={onMonitorDragOver}
            onDragLeave={onMonitorDragLeave}
            onDrop={onMonitorDrop}
          >
            <Player
              ref={playerRef}
              component={Main}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={compositionConfig.fps}
              compositionWidth={frameSize.width}
              compositionHeight={frameSize.height}
              initialFrame={initialFrame}
              controls={false}
              clickToPlay={false}
              loop
              style={{ width: '100%' }}
            />
            {outline && !editing && (
              <div
                data-testid="layer-outline"
                aria-hidden="true"
                className="absolute rounded-xs ring-1 ring-blue ring-inset"
                style={{ pointerEvents: 'none', left: outline.left, top: outline.top, width: outline.width, height: outline.height }}
              />
            )}
            {dropBox && (
              <div
                data-testid="drop-target"
                aria-hidden="true"
                className="absolute rounded-md border-2 border-dashed border-blue bg-blue-tint flex items-end justify-start p-2 cc-appear"
                style={{ pointerEvents: 'none', left: dropBox.box.left, top: dropBox.box.top, width: dropBox.box.width, height: dropBox.box.height }}
              >
                <span className="px-2 py-1 rounded-sm bg-blue text-on-blue text-xs font-medium">Drop to use here · {dropBox.label}</span>
              </div>
            )}
            {elements.length === 0 && (
              <div data-testid="empty-spot" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-[13px] text-fg-2">An empty spot. Everything on the video comes from the library.</p>
                <Button variant="primary" onClick={onAdd}>
                  Add the first scene
                </Button>
              </div>
            )}
            {editing && editingParam && (
              <div
                className="absolute z-10 cc-appear"
                style={{ left: Math.max(8, Math.min(editing.box.left, 100000)), top: editorTop, width: Math.max(260, Math.min(editing.box.width + 24, 520)) }}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onDoubleClickCapture={(e) => e.stopPropagation()}
              >
                <div className="rounded-lg bg-panel/95 backdrop-blur border border-blue shadow-float p-2">
                  <textarea
                    autoFocus
                    aria-label={`Edit ${editing.label} on the video`}
                    rows={editingText.length > 40 ? 3 : 1}
                    value={editingText}
                    maxLength={editingParam.maxChars}
                    onChange={(e) => onTextEdit(editing.elementId, editing.key, editingParam.maxChars ? e.target.value.slice(0, editingParam.maxChars) : e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        setEditing(null);
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        onTextEdit(editing.elementId, editing.key, editing.original);
                        setEditing(null);
                      }
                    }}
                    onBlur={() => setEditing(null)}
                    className="w-full resize-none bg-transparent text-[15px] font-medium text-fg outline-none px-1.5 py-1"
                  />
                  <div className="flex items-center justify-between px-1.5 pt-1 text-[11px] text-fg-3">
                    <span>{editing.label}</span>
                    <span>
                      Enter to finish · Esc to cancel{editingParam.maxChars ? ` · ${editingText.length}/${editingParam.maxChars}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* The transport, in the world's vocabulary, under the video rather than on it. */}
          <div className="mt-3 flex items-center gap-3">
            <IconButton label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'} icon={playing ? Pause : Play} onClick={togglePlay} className="!w-9 !h-9 bg-blue text-on-blue hover:bg-blue-hover shrink-0" />
            <span className="text-xs text-fg tabular-nums shrink-0 w-24">
              {clock(frame)} <span className="text-fg-3">/ {clock(durationInFrames)}</span>
            </span>
            <input
              type="range"
              className="slider flex-1 min-w-0"
              aria-label="Scrub"
              min={0}
              max={Math.max(1, durationInFrames - 1)}
              step={1}
              value={Math.min(frame, Math.max(0, durationInFrames - 1))}
              style={{ '--p': `${(Math.min(frame, durationInFrames) / Math.max(1, durationInFrames)) * 100}%` } as CSSProperties}
              onChange={(e) => seek(Number(e.target.value))}
            />
            <IconButton label={muted ? 'Unmute' : 'Mute'} icon={muted ? VolumeX : Volume2} onClick={toggleMute} className="shrink-0" />
            <IconButton label="Full screen" icon={Maximize2} onClick={() => playerRef.current?.requestFullscreen?.()} className="shrink-0" />
          </div>
          <p className="text-xs text-fg-2 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>Drag a headline or logo to move it · double-click text to type · drop a clip on the footage · drag a chip to reorder</span>
            <span className="ml-auto flex gap-3 text-[11px] text-fg-3 tabular-nums">
              <span>
                {frameSize.width}×{frameSize.height}
              </span>
              <span>{compositionConfig.fps} fps</span>
              <span data-testid="length-gauge" className={contentS === lengthS ? '' : 'text-yellow-ink'}>
                {contentS.toFixed(1)} s of {lengthS.toFixed(1)} s
                {contentS !== lengthS && ` · ${Math.abs(lengthS - contentS).toFixed(1)} s ${contentS < lengthS ? 'to fill' : 'over'}`}
              </span>
              {hasFootage && <span>preview at proxy quality</span>}
            </span>
            {perf && (
              <span data-testid="perf-result" className={perf.meetsTarget ? 'text-green w-full' : 'text-red-ink w-full'}>
                measured {perf.fps.toFixed(1)} fps over {perf.seconds.toFixed(1)} s, {perf.droppedFrames} dropped, worst gap {Math.round(perf.worstGapMs)} ms
              </span>
            )}
          </p>
        </div>
      </div>

      {/* M30: the scene strip. M51: a spot's shape, opening, proof points, end card, each scene with what sits on it. */}
      <div className="on-bar shrink-0 border-t border-line bg-panel px-6 py-3 flex items-stretch gap-2 overflow-x-auto">
        {structure.stray.length > 0 && (
          <div className="flex flex-col gap-1 justify-center" data-testid="stray-overlays">
            {structure.stray.map((e) => chip(e, 'overlay'))}
          </div>
        )}
        {structure.groups.map((g, i) => {
          const next = structure.groups[i + 1];
          const current = transitions.find((t) => t.afterElementId === g.scene.id)?.preset ?? 'cut';
          return (
            <Fragment key={g.scene.id}>
              <div data-testid={`group-${g.scene.id}`} className="flex flex-col gap-1 shrink-0" style={{ flexGrow: Math.max(1, seconds(g.scene.endFrame - g.scene.startFrame)), flexBasis: 0 }}>
                <span className="text-xs font-medium text-fg-2 px-1">{g.label}</span>
                {chip(g.scene, 'scene')}
                {g.overlays.length > 0 && <div className="flex flex-wrap gap-1">{g.overlays.map((o) => chip(o, 'overlay'))}</div>}
              </div>
              {next && (
                <div className="relative shrink-0 flex flex-col pt-[21px]" data-testid={`transition-marker-${g.scene.id}`}>
                  {/* M55: how this scene ends, right where it ends. The same four choices as the panel. M62: centred on the scene chip (label line above, chip height below). */}
                  <div className="h-[52px] flex items-center">
                    <button
                      type="button"
                      aria-label={`Transition after ${g.scene.name}`}
                      aria-expanded={transitionMenu === g.scene.id}
                      title={`How ${g.label.toLowerCase()} ends: ${PRESET_LABEL[current]}`}
                      onClick={() => setTransitionMenu((open) => (open === g.scene.id ? null : g.scene.id))}
                      className={`inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full border text-[11px] font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${current === 'cut' ? 'border-line bg-panel text-fg-3 hover:text-fg hover:border-line-strong' : 'border-blue bg-blue-tint text-blue hover:bg-blue-tint/70'}`}
                    >
                      {current === 'cut' ? <span aria-hidden="true" data-testid="cut-bar" className="block w-px h-3 bg-current" /> : PRESET_LABEL[current]}
                    </button>
                  </div>
                  {transitionMenu === g.scene.id && (
                    <div role="group" aria-label={`Choose the transition after ${g.scene.name}`} className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20 flex items-center gap-0.5 rounded-full bg-panel border border-line shadow-float p-0.5 cc-appear">
                      {TRANSITION_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={p === current}
                          onClick={() => {
                            onTransitionChange(g.scene.id, { preset: p, durationInFrames: transitions.find((t) => t.afterElementId === g.scene.id)?.durationInFrames ?? DEFAULT_TRANSITION_FRAMES });
                            setTransitionMenu(null);
                          }}
                          className={`cc-press h-7 px-2.5 rounded-full text-xs font-medium whitespace-nowrap ${p === current ? 'bg-blue text-on-blue' : 'text-fg-2 hover:text-fg hover:bg-hover'}`}
                        >
                          {PRESET_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
        <button
          type="button"
          aria-label="Add a scene"
          title="Add a lower third, caption, end card or any other element from the library"
          onClick={onAdd}
          className="sticky right-0 z-10 shrink-0 self-stretch min-h-[52px] flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-panel px-3 text-xs font-medium text-fg-2 shadow-[-12px_0_12px_-6px_var(--color-panel)] hover:text-fg hover:border-blue hover:bg-blue-tint/40 transition-colors"
        >
          <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
          Add
        </button>
      </div>
    </section>
  );
}
