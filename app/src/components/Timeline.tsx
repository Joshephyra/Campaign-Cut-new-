import { DEFAULT_TRANSITION_FRAMES, formatTimecode, TRANSITION_PRESETS, type TransitionPreset } from '@campaigncut/composition';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type TimelineTransition = { afterElementId: number; preset: TransitionPreset; durationInFrames: number };

export type TimelineElement = {
  id: number;
  slug: string;
  /** Shown instead of the slug when present. */
  name?: string;
  zIndex: number;
  startFrame: number;
  endFrame: number;
  enabled: boolean;
};

export type ElementPatch = Partial<Pick<TimelineElement, 'startFrame' | 'endFrame' | 'enabled'>>;

type Props = {
  elements: TimelineElement[];
  fps: number;
  durationInFrames: number;
  /** The playhead. */
  frame: number;
  onSeek: (frame: number) => void;
  onChange: (elementId: number, patch: ElementPatch) => void;
  /** Transitions per boundary. A boundary with no entry is a cut. */
  transitions?: TimelineTransition[];
  onTransitionChange?: (afterElementId: number, t: { preset: TransitionPreset; durationInFrames: number }) => void;
  /** The element whose controls the inspector shows (M17). Click a name to select. */
  selectedId?: number;
  onSelect?: (elementId: number) => void;
};

/** Ruler labels never sit closer than this. */
const MIN_LABEL_PX = 56;
const STEPS_S = [1, 2, 5, 10, 15, 30, 60];

/**
 * M29: seconds between ruler labels for a track this long and this wide.
 * Unmeasured (width 0, before the first paint): at most a dozen labels.
 */
export function rulerInterval(totalSeconds: number, widthPx: number): number {
  for (const step of STEPS_S) {
    if (widthPx > 0 ? step * (widthPx / Math.max(totalSeconds, 1)) >= MIN_LABEL_PX : totalSeconds / step <= 12) return step;
  }
  return STEPS_S[STEPS_S.length - 1]!;
}

const LABEL_COLUMN = '9.5rem';

/**
 * The element stack in z order (top of the stack first), with in and out
 * points. Drag a bar to move an element in time; tick to toggle it; click
 * a name to select it for the inspector; click or drag the ruler to scrub.
 * Timecodes in Plex Mono, per DESIGN.md.
 */
export function Timeline({ elements, fps, durationInFrames, frame, onSeek, onChange, transitions = [], onTransitionChange, selectedId, onSelect }: Props) {
  const total = Math.max(1, durationInFrames);
  const pct = (f: number) => `${(Math.min(Math.max(f, 0), total) / total) * 100}%`;
  const rows = [...elements].sort((a, b) => b.zIndex - a.zIndex || b.id - a.id);

  // Boundaries exist between consecutive ENABLED elements in start order.
  const inOrder = elements.filter((e) => e.enabled).sort((a, b) => a.startFrame - b.startFrame || a.zIndex - b.zIndex);
  const hasBoundaryAfter = new Set(inOrder.slice(0, -1).map((e) => e.id));
  const transitionAfter = (id: number) => transitions.find((t) => t.afterElementId === id);

  // M29: the ruler's real width decides how many labels fit.
  const ruler = useRef<HTMLDivElement>(null);
  const [rulerWidth, setRulerWidth] = useState(0);
  useEffect(() => {
    const el = ruler.current;
    if (!el) return;
    const measure = () => setRulerWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const totalSeconds = total / fps;
  const step = rulerInterval(totalSeconds, rulerWidth);
  const labels = Array.from({ length: Math.floor(totalSeconds / step) + 1 }, (_, i) => i * step);

  const frameAt = (clientX: number, track: HTMLElement) => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const f = Math.round(((clientX - rect.left) / rect.width) * total);
    return Math.min(Math.max(f, 0), total);
  };

  /** Keep receiving moves after the pointer leaves the element. Tolerates environments without capture. */
  const capture = (el: HTMLElement, pointerId: number) => {
    try {
      el.setPointerCapture?.(pointerId);
    } catch {
      /* jsdom, or a synthetic pointer id: dragging still works while the pointer stays over the element */
    }
  };

  // ---- scrubbing -------------------------------------------------------
  const onRulerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    capture(e.currentTarget, e.pointerId);
    onSeek(frameAt(e.clientX, e.currentTarget));
  };
  const onRulerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) onSeek(frameAt(e.clientX, e.currentTarget));
  };

  // ---- dragging a bar --------------------------------------------------
  const drag = useRef<{ id: number; originX: number; start: number; length: number; pxPerFrame: number } | null>(null);

  const moveTo = (clientX: number) => {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((clientX - d.originX) / d.pxPerFrame);
    const start = Math.max(0, d.start + delta);
    onChange(d.id, { startFrame: start, endFrame: start + d.length });
  };

  const onBarPointerDown = (el: TimelineElement) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget.parentElement;
    if (!track) return;
    const width = track.getBoundingClientRect().width;
    if (width <= 0) return;
    capture(e.currentTarget, e.pointerId);
    drag.current = { id: el.id, originX: e.clientX, start: el.startFrame, length: el.endFrame - el.startFrame, pxPerFrame: width / total };
    onSelect?.(el.id);
    e.preventDefault();
  };
  const onBarPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current && e.buttons & 1) moveTo(e.clientX);
  };
  const onBarPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    moveTo(e.clientX);
    drag.current = null;
  };

  const playhead = <div className="absolute top-0 bottom-0 w-px bg-cobalt pointer-events-none" style={{ left: pct(frame) }} />;

  return (
    <div className="border-t border-hairline mt-6 pt-4" data-testid="timeline">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Timeline</span>
        <span className="font-mono text-xs text-fg tabular-nums">
          <span data-testid="playhead-timecode">{formatTimecode(frame, fps)}</span>
          <span className="text-muted"> / {formatTimecode(total, fps)}</span>
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `${LABEL_COLUMN} 1fr` }}>
        {/* ruler */}
        <div />
        <div
          ref={ruler}
          data-testid="ruler"
          className="relative h-6 border-b border-hairline cursor-crosshair select-none font-mono text-[10px]"
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
        >
          {labels.map((s) => (
            <span
              key={s}
              data-testid="ruler-label"
              className="absolute top-1 text-muted"
              style={{ left: pct(s * fps), transform: s === 0 ? undefined : s >= totalSeconds ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {s}s
            </span>
          ))}
          {playhead}
        </div>

        {rows.map((el) => {
          const selected = el.id === selectedId;
          return (
            <div key={el.id} className="contents" data-testid={`element-row-${el.id}`} data-selected={selected ? 'true' : 'false'}>
              <div className={`flex items-center gap-2.5 h-10 pr-3 border-b border-hairline ${selected ? 'border-l-2 border-l-cobalt pl-2.5' : 'pl-3'}`}>
                <input
                  type="checkbox"
                  aria-label={`Toggle ${el.slug}`}
                  checked={el.enabled}
                  onChange={(e) => onChange(el.id, { enabled: e.target.checked })}
                  className="accent-cobalt"
                />
                <button
                  type="button"
                  aria-label={`Select ${el.name ?? el.slug}`}
                  onClick={() => onSelect?.(el.id)}
                  className={`truncate text-left text-xs ${selected ? 'text-cobalt' : el.enabled ? 'text-fg' : 'text-muted line-through'}`}
                >
                  {el.name ?? el.slug}
                </button>
              </div>
              <div className="relative h-10 border-b border-hairline">
                <div
                  data-testid={`element-bar-${el.id}`}
                  title={`${formatTimecode(el.startFrame, fps)} – ${formatTimecode(el.endFrame, fps)}`}
                  className={`absolute top-1.5 bottom-1.5 border cursor-grab active:cursor-grabbing select-none flex items-center px-2.5 overflow-hidden text-xs ${
                    selected ? 'border-cobalt' : 'border-hairline'
                  } ${el.enabled ? 'bg-panel text-fg' : 'bg-transparent border-dashed text-muted'}`}
                  style={{ left: pct(el.startFrame), width: pct(el.endFrame - el.startFrame) }}
                  onPointerDown={onBarPointerDown(el)}
                  onPointerMove={onBarPointerMove}
                  onPointerUp={onBarPointerUp}
                  onPointerCancel={onBarPointerUp}
                >
                  <span className="truncate">{el.name ?? el.slug}</span>
                </div>
                {playhead}
              </div>

              {hasBoundaryAfter.has(el.id) && (
                <TransitionRow element={el} fps={fps} transition={transitionAfter(el.id)} onChange={(t) => onTransitionChange?.(el.id, t)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRESET_LABEL: Record<TransitionPreset, string> = { cut: 'Cut', fade: 'Fade', wipe: 'Wipe', slide: 'Slide' };

/** M29: the transition on the boundary after an element: a segmented row of presets, and a length slider shown in seconds. */
function TransitionRow({
  element,
  fps,
  transition,
  onChange,
}: {
  element: TimelineElement;
  fps: number;
  transition: TimelineTransition | undefined;
  onChange: (t: { preset: TransitionPreset; durationInFrames: number }) => void;
}) {
  const preset = transition?.preset ?? 'cut';
  const length = transition?.durationInFrames ?? DEFAULT_TRANSITION_FRAMES;
  return (
    <>
      <div className="h-9 border-b border-hairline flex items-center pl-3 pr-3 text-[11px] text-muted">
        <span className="pl-[22px]">then</span>
      </div>
      <div className="h-9 border-b border-hairline flex items-center gap-3 text-[11px]" data-testid={`transition-after-${element.id}`}>
        <div role="group" aria-label={`Transition after ${element.slug}`} className="flex border border-hairline">
          {TRANSITION_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => onChange({ preset: p, durationInFrames: length })}
              className={`px-2.5 py-1 ${preset === p ? 'bg-cobalt text-white' : 'text-muted hover:text-fg'}`}
            >
              {PRESET_LABEL[p]}
            </button>
          ))}
        </div>
        {preset !== 'cut' && (
          <label className="flex items-center gap-2 text-muted min-w-0">
            <input
              type="range"
              min={3}
              max={Math.max(60, length)}
              step={1}
              aria-label={`Transition length after ${element.slug}`}
              value={length}
              onChange={(e) => onChange({ preset, durationInFrames: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
              className="w-24 min-w-10 shrink accent-cobalt"
            />
            <span className="font-mono text-fg tabular-nums whitespace-nowrap">{(length / fps).toFixed(1)} s</span>
          </label>
        )}
      </div>
    </>
  );
}
