import { DEFAULT_TRANSITION_FRAMES, formatTimecode, TRANSITION_PRESETS, type TransitionPreset } from '@campaigncut/composition';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

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

  return (
    <div className="border-t border-hairline mt-6 pt-4 font-mono text-[11px]" data-testid="timeline">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs uppercase tracking-widest text-muted font-sans">Timeline</span>
        <span className="text-fg">
          <span data-testid="playhead-timecode">{formatTimecode(frame, fps)}</span>
          <span className="text-muted"> / {formatTimecode(total, fps)}</span>
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '11rem 1fr' }}>
        {/* ruler */}
        <div />
        <div
          data-testid="ruler"
          className="relative h-5 border-b border-hairline cursor-crosshair select-none"
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
        >
          {Array.from({ length: Math.floor(total / fps) + 1 }, (_, s) => (
            <span key={s} className="absolute top-0 text-muted" style={{ left: pct(s * fps), transform: 'translateX(-50%)' }}>
              {s}s
            </span>
          ))}
          <div className="absolute top-0 bottom-0 w-px bg-cobalt pointer-events-none" style={{ left: pct(frame) }} />
        </div>

        {rows.map((el) => (
          <div key={el.id} className="contents" data-testid={`element-row-${el.id}`} data-selected={el.id === selectedId ? 'true' : 'false'}>
            <div className={`flex items-center gap-2 h-8 pr-3 border-b border-hairline ${el.id === selectedId ? 'border-l-2 border-l-cobalt pl-2' : 'pl-[10px]'}`}>
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
                className={`truncate text-left font-sans text-xs ${el.id === selectedId ? 'text-cobalt' : el.enabled ? 'text-fg' : 'text-muted line-through'}`}
              >
                {el.name ?? el.slug}
              </button>
            </div>
            <div className="relative h-8 border-b border-hairline">
              <div
                data-testid={`element-bar-${el.id}`}
                className={`absolute top-1 bottom-1 border ${el.enabled ? 'bg-panel border-hairline' : 'bg-transparent border-dashed border-hairline'} cursor-grab active:cursor-grabbing select-none flex items-center px-2 overflow-hidden`}
                style={{ left: pct(el.startFrame), width: pct(el.endFrame - el.startFrame) }}
                onPointerDown={onBarPointerDown(el)}
                onPointerMove={onBarPointerMove}
                onPointerUp={onBarPointerUp}
                onPointerCancel={onBarPointerUp}
              >
                <span className="text-muted whitespace-nowrap">
                  {formatTimecode(el.startFrame, fps)} – {formatTimecode(el.endFrame, fps)}
                </span>
              </div>
              <div className="absolute top-0 bottom-0 w-px bg-cobalt pointer-events-none" style={{ left: pct(frame) }} />
            </div>

            {hasBoundaryAfter.has(el.id) && (
              <TransitionControl
                element={el}
                transition={transitionAfter(el.id)}
                onChange={(t) => onTransitionChange?.(el.id, t)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The transition on the boundary after an element: preset plus length in frames. */
function TransitionControl({
  element,
  transition,
  onChange,
}: {
  element: TimelineElement;
  transition: TimelineTransition | undefined;
  onChange: (t: { preset: TransitionPreset; durationInFrames: number }) => void;
}) {
  const preset = transition?.preset ?? 'cut';
  const length = transition?.durationInFrames ?? DEFAULT_TRANSITION_FRAMES;
  return (
    <>
      <div className="h-7 border-b border-hairline flex items-center pr-3 text-muted">
        <span className="pl-5">↳ then</span>
      </div>
      <div className="h-7 border-b border-hairline flex items-center gap-2" data-testid={`transition-after-${element.id}`}>
        <select
          aria-label={`Transition after ${element.slug}`}
          value={preset}
          onChange={(e) => onChange({ preset: e.target.value as TransitionPreset, durationInFrames: length })}
          className="bg-panel border border-hairline px-1 py-0.5 text-fg focus:outline-none focus:border-cobalt"
        >
          {TRANSITION_PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {preset !== 'cut' && (
          <>
            <input
              type="number"
              min={1}
              aria-label={`Transition length after ${element.slug}`}
              value={length}
              onChange={(e) => onChange({ preset, durationInFrames: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
              className="w-14 bg-panel border border-hairline px-1 py-0.5 text-fg focus:outline-none focus:border-cobalt"
            />
            <span className="text-muted">frames</span>
          </>
        )}
      </div>
    </>
  );
}
