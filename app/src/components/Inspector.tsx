import {
  DEFAULT_CHROMA_KEY,
  DEFAULT_TRANSFORM,
  hexToRgba,
  isChromaKey,
  isMediaValue,
  isTransformValue,
  type ChromaKey,
  type Fit,
  type MediaValue,
  type ParamValues,
  type TemplateParam,
  type TransformValue,
} from '@campaigncut/composition';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api, type MediaAsset } from '../api';

type Props = {
  schema: TemplateParam[];
  values: ParamValues;
  onChange: (next: ParamValues) => void;
  /** Uploaded footage, for cc.mediaFill params. */
  assets?: MediaAsset[];
  /** For resolving a template's own image defaults (images/logo.png) when no elementBaseUrl is given. */
  templateSlug?: string;
  /** Server-relative base of the element's files, e.g. /templates/two/elements/open (M17). */
  elementBaseUrl?: string;
  /** M28: the placement param last pressed on the monitor (arrow keys nudge it), if it belongs to this element. */
  activeKey?: string | null;
};

/**
 * The inspector is GENERATED from the schema. There is no per-template UI
 * code anywhere: a template with three text roles and one accent colour
 * produces three text fields and a colour picker, automatically.
 */
export function Inspector({ schema, values, onChange, assets = [], templateSlug = '', elementBaseUrl, activeKey = null }: Props) {
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  const imageBase = elementBaseUrl ?? `/templates/${templateSlug}`;
  // Placement params ride under the text or image control they belong to.
  const placementFor = (key: string) => schema.find((p) => p.kind === 'transform' && p.for === key);

  return (
    <div className="flex flex-col gap-5">
      {schema
        .filter((param) => param.kind !== 'transform')
        .map((param) => {
          const placement = placementFor(param.key);
          const active = placement !== undefined && placement.key === activeKey;
          return (
            <div key={param.key} data-testid={`param-${param.key}`} data-active={active ? 'true' : 'false'} className={active ? 'border-l-2 border-cobalt -ml-3 pl-[10px]' : ''}>
              {param.kind === 'text' && <TextControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
              {param.kind === 'color' && <ColorControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
              {param.kind === 'image' && (
                <ImageControl param={param} value={valueOf(param, values)} imageBase={imageBase} onChange={(v) => set(param.key, v)} />
              )}
              {param.kind === 'media' && (
                <MediaControl param={param} value={values[param.key]} assets={assets} onChange={(v) => set(param.key, v)} />
              )}
              {(param.kind === 'text' || param.kind === 'color' || param.kind === 'image') && values[param.key] !== undefined && values[param.key] !== param.default && (
                <button
                  type="button"
                  aria-label={`Reset ${param.label} to authored`}
                  onClick={() => set(param.key, param.default)}
                  className="mt-1.5 text-[11px] text-muted hover:text-fg"
                >
                  Reset to authored
                </button>
              )}
              {placement && (
                <PlacementControl
                  param={placement}
                  parentLabel={param.label}
                  value={isTransformValue(values[placement.key]) ? (values[placement.key] as TransformValue) : DEFAULT_TRANSFORM}
                  onChange={(v) => set(placement.key, v)}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

// ---- placement (M18, M28) ----------------------------------------------

/**
 * Where a layer sits is set by dragging it on the monitor (M28); the
 * inspector only says so, and offers Size and Tilt as sliders. Scale is a
 * percentage of the authored size; tilt is added degrees. Reset returns to
 * exactly what the designer built.
 */
function PlacementControl({ param, parentLabel, value, onChange }: { param: TemplateParam; parentLabel: string; value: TransformValue; onChange: (v: TransformValue) => void }) {
  const isIdentity = value.x === 0 && value.y === 0 && value.scale === 1 && value.rotation === 0;
  const moved = value.x !== 0 || value.y !== 0;
  return (
    <div className="mt-2 flex flex-col gap-1.5" data-testid={`placement-${param.for ?? param.key}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted">{moved ? 'Moved. Drag it on the monitor to move it again.' : 'Drag it on the monitor to move it.'}</span>
        <button
          type="button"
          aria-label={`Reset ${param.label}`}
          disabled={isIdentity}
          onClick={() => onChange({ ...DEFAULT_TRANSFORM })}
          className="text-[11px] text-muted hover:text-fg disabled:opacity-40 shrink-0"
        >
          Reset
        </button>
      </div>
      <Slider label={`${parentLabel} size`} name="Size" min={25} max={300} value={Math.round(value.scale * 100)} unit="%" onChange={(n) => onChange({ ...value, scale: n / 100 })} />
      <Slider label={`${parentLabel} tilt`} name="Tilt" min={-45} max={45} value={Math.round(value.rotation)} unit="°" onChange={(n) => onChange({ ...value, rotation: n })} />
    </div>
  );
}

/** A labelled range with its value shown beside it as a fact, in mono. */
function Slider({ label, name, min, max, step = 1, value, unit, onChange }: { label: string; name: string; min: number; max: number; step?: number; value: number; unit: string; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-muted">
      <span className="w-8 shrink-0">{name}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-cobalt min-w-0" />
      <span className="font-mono w-11 text-right text-fg tabular-nums">
        {value}
        {unit}
      </span>
    </label>
  );
}

function valueOf(param: TemplateParam, values: ParamValues): string {
  const v = values[param.key] ?? param.default;
  return v === null || v === undefined ? '' : String(v);
}

/** The label row. `htmlFor` ties the name (and only the name) to the control. */
function Label({ param, htmlFor, right }: { param: TemplateParam; htmlFor?: string; right?: string }) {
  return (
    <div className="flex justify-between items-baseline mb-1">
      <label htmlFor={htmlFor} className="text-xs text-muted">
        {param.label}
      </label>
      {right && <span className="font-mono text-[10px] text-muted">{right}</span>}
    </div>
  );
}

// ---- text --------------------------------------------------------------

function TextControl({ param, value, onChange }: { param: TemplateParam; value: string; onChange: (v: string) => void }) {
  const max = param.maxChars;
  const id = `param-${param.key}-input`;
  return (
    <div>
      <Label param={param} htmlFor={id} right={max ? `${value.length}/${max}` : undefined} />
      <input
        id={id}
        type="text"
        value={value}
        maxLength={max}
        onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
        className="w-full bg-panel border border-hairline px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-cobalt"
      />
      {param.locked && <p className="font-mono text-[10px] text-muted mt-1">Position and size locked. Text is editable.</p>}
    </div>
  );
}

// ---- colour ------------------------------------------------------------

function ColorControl({ param, value, onChange }: { param: TemplateParam; value: string; onChange: (v: string) => void }) {
  // The hex field can hold a half-typed value; only valid hex is emitted.
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const id = `param-${param.key}-hex`;
  const valid = hexToRgba(draft) !== null;

  const emit = (v: string) => {
    setDraft(v);
    if (hexToRgba(v)) onChange(v.toUpperCase());
  };

  return (
    <div>
      <Label param={param} htmlFor={id} />
      <div className="flex gap-2 items-stretch">
        <input
          type="color"
          value={valid ? normalizeHex(draft) : normalizeHex(value)}
          onChange={(e) => emit(e.target.value)}
          aria-label={`${param.label} swatch`}
          data-testid="color-swatch"
          className="w-10 h-9 bg-transparent border border-hairline p-0.5 cursor-pointer"
        />
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => emit(e.target.value)}
          spellCheck={false}
          className={`flex-1 bg-panel border px-2 py-1.5 font-mono text-sm text-fg focus:outline-none focus:border-cobalt ${valid ? 'border-hairline' : 'border-danger'}`}
        />
      </div>
    </div>
  );
}

/** <input type="color"> insists on lower-case #rrggbb. */
function normalizeHex(hex: string): string {
  const rgba = hexToRgba(hex);
  if (!rgba) return '#000000';
  const byte = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${byte(rgba[0])}${byte(rgba[1])}${byte(rgba[2])}`;
}

// ---- image (cc.logo) ---------------------------------------------------

/** Where an image value can be shown from, in the browser. */
function imagePreviewUrl(value: string, imageBase: string): string | null {
  if (!value) return null;
  if (value.startsWith('data:') || /^https?:/.test(value)) return value;
  if (value.startsWith('/')) return api.fileUrl(value);
  return `${api.fileUrl(imageBase)}/${value}`;
}

function ImageControl({
  param,
  value,
  imageBase,
  onChange,
}: {
  param: TemplateParam;
  value: string;
  /** Server-relative base the element's own images resolve against. */
  imageBase: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = imagePreviewUrl(value, imageBase);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(file);
      onChange(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div>
      <Label param={param} right={busy ? 'uploading…' : undefined} />
      <div className="flex gap-3 items-center">
        <div className="w-20 h-12 bg-panel border border-hairline flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            <img src={preview} alt="" data-testid={`image-preview-${param.key}`} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="font-mono text-[10px] text-muted">none</span>
          )}
        </div>
        <label className="text-xs text-cobalt cursor-pointer">
          Replace
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            data-testid={`image-file-${param.key}`}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      <p className="font-mono text-[10px] text-muted mt-1">Fitted into the authored slot.</p>
      {error && <p className="font-mono text-[10px] text-danger mt-1">{error}</p>}
    </div>
  );
}

// ---- media (cc.mediaFill) ----------------------------------------------

function MediaControl({
  param,
  value,
  assets,
  onChange,
}: {
  param: TemplateParam;
  value: unknown;
  assets: MediaAsset[];
  onChange: (v: MediaValue | null) => void;
}) {
  const current = isMediaValue(value) ? value : null;
  const chosen = current ? assets.find((a) => a.id === current.assetId) : undefined;
  const fit: Fit = current?.fit ?? 'cover';

  // M29: the Footage panel's thumbnails are the picker. This shows the pick.
  if (!current) {
    return (
      <div>
        <Label param={param} />
        <p className="text-xs text-muted">No clip yet. Pick a clip in Footage below, or upload one there. The designer's slot shows until you do.</p>
      </div>
    );
  }

  return (
    <div>
      <Label param={param} />
      <div data-testid="footage-card" className="flex gap-3 items-center border border-hairline p-2">
        {chosen?.thumbUrl ? (
          <img src={api.fileUrl(chosen.thumbUrl)} alt="" className="w-20 aspect-video object-cover bg-black block shrink-0" />
        ) : (
          <div aria-hidden="true" className="w-20 aspect-video bg-panel shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs truncate">{chosen?.originalName ?? `Clip ${current.assetId}`}</div>
          {chosen && (
            <div className="font-mono text-[10px] text-muted mt-1">
              {chosen.durationS.toFixed(1)} s · {chosen.width}×{chosen.height}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <div role="group" aria-label="Fit" className="flex border border-hairline text-[11px]">
          {(['cover', 'contain'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={fit === f}
              onClick={() => onChange({ ...current, fit: f })}
              className={`px-2.5 py-1 ${fit === f ? 'bg-cobalt text-white' : 'text-muted hover:text-fg'}`}
            >
              {f === 'cover' ? 'Fill (crop)' : 'Fit (letterbox)'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-[11px] text-muted hover:text-fg shrink-0">
          Use the authored slot
        </button>
      </div>
      {chosen && chosen.durationS > 0 && <TrimBar value={current} clipLengthS={chosen.durationS} onChange={onChange} />}
      <label className="flex items-center gap-2 mt-2 text-[11px] text-muted">
        <input type="checkbox" aria-label="Mute footage sound" checked={current.muted === true} onChange={(e) => onChange({ ...current, muted: e.target.checked })} className="accent-cobalt" />
        Mute footage sound
      </label>
      <ChromaControls value={current} onChange={onChange} />
    </div>
  );
}

/** Tenths of a second: what the trim bar works in. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/**
 * M29: where in the clip to start and stop, as two handles on a bar over
 * the clip. Drag a handle (or press the bar to bring the nearer one), or
 * nudge a focused handle with the arrow keys (0.1 s, 1 s with Shift). The
 * times sit beside the bar as facts. Stored inside the footage value: no
 * `inS` means from the start, no `outS` means to the end.
 */
function TrimBar({ value, clipLengthS, onChange }: { value: MediaValue; clipLengthS: number; onChange: (v: MediaValue) => void }) {
  const len = tenth(clipLengthS);
  const inS = tenth(value.inS ?? 0);
  const outS = tenth(value.outS ?? len);
  const handle = useRef<'inS' | 'outS' | null>(null);

  const emit = (key: 'inS' | 'outS', raw: number) => {
    const t = tenth(key === 'inS' ? Math.min(Math.max(raw, 0), outS - 0.1) : Math.max(Math.min(raw, len), inS + 0.1));
    if (t === (key === 'inS' ? inS : outS)) return;
    const next = { ...value };
    if ((key === 'inS' && t === 0) || (key === 'outS' && t === len)) delete next[key];
    else next[key] = t;
    onChange(next);
  };
  const timeAt = (clientX: number, bar: HTMLElement) => {
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.min(Math.max(((clientX - rect.left) / rect.width) * len, 0), len);
  };
  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = timeAt(e.clientX, e.currentTarget);
    if (t === null) return;
    handle.current = Math.abs(t - inS) <= Math.abs(t - outS) ? 'inS' : 'outS';
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom or a synthetic pointer id */
    }
    e.preventDefault();
    emit(handle.current, t);
  };
  const onBarMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!handle.current || !(e.buttons & 1)) return;
    const t = timeAt(e.clientX, e.currentTarget);
    if (t !== null) emit(handle.current, t);
  };
  const onBarUp = () => {
    handle.current = null;
  };
  const onKey = (key: 'inS' | 'outS') => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 1 : 0.1;
    const current = key === 'inS' ? inS : outS;
    const next = { ArrowLeft: current - step, ArrowDown: current - step, ArrowRight: current + step, ArrowUp: current + step, Home: 0, End: len }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    emit(key, next);
  };
  const left = `${(inS / len) * 100}%`;
  const width = `${((outS - inS) / len) * 100}%`;
  const grip = (key: 'inS' | 'outS', label: string, at: number, side: 'left' | 'right') => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={len}
      aria-valuenow={at}
      aria-valuetext={`${at.toFixed(1)} s`}
      onKeyDown={onKey(key)}
      className="absolute top-0 bottom-0 w-2 bg-cobalt cursor-ew-resize focus:outline-none focus-visible:ring-1 focus-visible:ring-fg"
      style={{ left: `${(at / len) * 100}%`, transform: side === 'left' ? undefined : 'translateX(-100%)' }}
    />
  );

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Trim</span>
        <span className="font-mono text-fg tabular-nums">
          {inS.toFixed(1)} s – {outS.toFixed(1)} s of {len.toFixed(1)} s
        </span>
      </div>
      <div
        data-testid="trim-bar"
        className="relative h-6 bg-panel border border-hairline select-none touch-none"
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerUp={onBarUp}
        onPointerCancel={onBarUp}
      >
        <div className="absolute top-0 bottom-0 bg-cobalt/25 pointer-events-none" style={{ left, width }} />
        {grip('inS', 'Footage start', inS, 'left')}
        {grip('outS', 'Footage end', outS, 'right')}
      </div>
    </div>
  );
}

/** Chroma key: on/off, screen colour, threshold, spill. Stored inside the footage value. */
function ChromaControls({ value, onChange }: { value: MediaValue; onChange: (v: MediaValue) => void }) {
  const key: ChromaKey | null = isChromaKey(value.key) ? value.key : null;
  const withKey = (k: ChromaKey | null): MediaValue => {
    const { key: _dropped, ...rest } = value;
    return k ? { ...rest, key: k } : rest;
  };
  return (
    <div className="mt-2 border border-hairline p-2 flex flex-col gap-2 font-mono text-[10px]">
      <label className="flex items-center gap-2 text-fg">
        <input
          type="checkbox"
          aria-label="Key out green screen"
          checked={key !== null}
          onChange={(e) => onChange(withKey(e.target.checked ? DEFAULT_CHROMA_KEY : null))}
          className="accent-cobalt"
        />
        Key out green screen
      </label>
      {key && (
        <>
          <div className="flex items-center gap-2">
            <span className="w-20 text-muted">Screen colour</span>
            <div role="group" aria-label="Screen colour" className="flex border border-hairline">
              {(
                [
                  ['green', 'Green', '#1DB954'],
                  ['blue', 'Blue', '#1E5BFF'],
                ] as const
              ).map(([c, label, swatch]) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={key.color === c}
                  onClick={() => onChange(withKey({ ...key, color: c as ChromaKey['color'] }))}
                  className={`flex items-center gap-1.5 px-2 py-1 ${key.color === c ? 'bg-cobalt text-white' : 'text-muted hover:text-fg'}`}
                >
                  <span aria-hidden="true" className="w-2.5 h-2.5 block" style={{ backgroundColor: swatch }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <span className="w-20 text-muted">Threshold</span>
            <input
              type="range"
              aria-label="Threshold"
              min={0}
              max={1}
              step={0.05}
              value={key.threshold}
              onChange={(e) => onChange(withKey({ ...key, threshold: Number(e.target.value) }))}
              className="flex-1 accent-cobalt"
            />
            <span className="w-8 text-right">{key.threshold.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 text-muted">Spill</span>
            <input
              type="range"
              aria-label="Spill suppression"
              min={0}
              max={1}
              step={0.05}
              value={key.spill}
              onChange={(e) => onChange(withKey({ ...key, spill: Number(e.target.value) }))}
              className="flex-1 accent-cobalt"
            />
            <span className="w-8 text-right">{key.spill.toFixed(2)}</span>
          </label>
        </>
      )}
    </div>
  );
}
