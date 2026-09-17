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
import { ImageUp, Lock, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api, type MediaAsset } from '../api';
import { FieldLabel, ICON, Segmented, Slider, Switch } from './ui';

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
          const changed = (param.kind === 'text' || param.kind === 'color' || param.kind === 'image') && values[param.key] !== undefined && values[param.key] !== param.default;
          return (
            <div
              key={param.key}
              data-testid={`param-${param.key}`}
              data-active={active ? 'true' : 'false'}
              className={`rounded-lg -mx-2 px-2 py-1 transition-colors ${active ? 'bg-blue-tint ring-1 ring-blue/60' : ''}`}
            >
              {param.kind === 'text' && <TextControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
              {param.kind === 'color' && <ColorControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
              {param.kind === 'image' && (
                <ImageControl param={param} value={valueOf(param, values)} imageBase={imageBase} onChange={(v) => set(param.key, v)} />
              )}
              {param.kind === 'media' && (
                <MediaControl param={param} value={values[param.key]} assets={assets} onChange={(v) => set(param.key, v)} />
              )}
              {changed && (
                <button
                  type="button"
                  aria-label={`Reset ${param.label} to authored`}
                  onClick={() => set(param.key, param.default)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg transition-colors"
                >
                  <RotateCcw size={12} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
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
    <div className="mt-2.5 flex flex-col gap-1" data-testid={`placement-${param.for ?? param.key}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-fg-3">{moved ? 'Moved. Drag it on the video to move it again.' : 'Drag it on the video to move it.'}</span>
        <button
          type="button"
          aria-label={`Reset ${param.label}`}
          disabled={isIdentity}
          onClick={() => onChange({ ...DEFAULT_TRANSFORM })}
          className="text-[11px] text-fg-3 hover:text-fg disabled:opacity-40 shrink-0 transition-colors"
        >
          Reset
        </button>
      </div>
      <Slider label={`${parentLabel} size`} name="Size" min={25} max={300} value={Math.round(value.scale * 100)} format={(v) => `${v}%`} onChange={(n) => onChange({ ...value, scale: n / 100 })} />
      <Slider label={`${parentLabel} tilt`} name="Tilt" min={-45} max={45} value={Math.round(value.rotation)} format={(v) => `${v}°`} onChange={(n) => onChange({ ...value, rotation: n })} />
    </div>
  );
}

function valueOf(param: TemplateParam, values: ParamValues): string {
  const v = values[param.key] ?? param.default;
  return v === null || v === undefined ? '' : String(v);
}

// ---- text --------------------------------------------------------------

function TextControl({ param, value, onChange }: { param: TemplateParam; value: string; onChange: (v: string) => void }) {
  const max = param.maxChars;
  const id = `param-${param.key}-input`;
  return (
    <div>
      <FieldLabel htmlFor={id} right={max ? `${value.length}/${max}` : undefined}>
        {param.label}
      </FieldLabel>
      <input id={id} type="text" value={value} maxLength={max} onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)} className="field" />
      {param.locked && (
        <p className="text-[11px] text-fg-3 mt-1.5 inline-flex items-center gap-1">
          <Lock size={11} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
          Position and size locked. Text is editable.
        </p>
      )}
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
      <FieldLabel htmlFor={id}>{param.label}</FieldLabel>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={valid ? normalizeHex(draft) : normalizeHex(value)}
          onChange={(e) => emit(e.target.value)}
          aria-label={`${param.label} swatch`}
          data-testid="color-swatch"
          className="swatch shrink-0"
        />
        <input id={id} type="text" value={draft} onChange={(e) => emit(e.target.value)} spellCheck={false} aria-invalid={!valid} className="field tabular-nums uppercase" />
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
      <FieldLabel right={busy ? 'uploading…' : undefined}>{param.label}</FieldLabel>
      <label className="flex gap-3 items-center rounded-lg bg-raised border border-line hover:border-line-strong p-2 cursor-pointer transition-colors">
        <div className="w-20 h-12 rounded-md bg-stage flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            <img src={preview} alt="" data-testid={`image-preview-${param.key}`} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[11px] text-fg-3">none</span>
          )}
        </div>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg">
            <ImageUp size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-blue" />
            Replace
          </span>
          <p className="text-[11px] text-fg-3 mt-0.5">Fitted into the authored slot.</p>
        </div>
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" data-testid={`image-file-${param.key}`} onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {error && <p className="text-[11px] text-red mt-1">{error}</p>}
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

  // M29: the library's thumbnails are the picker. This shows the pick.
  if (!current) {
    return (
      <div>
        <FieldLabel>{param.label}</FieldLabel>
        <div className="rounded-lg border border-dashed border-line-strong p-3">
          <p className="text-xs text-fg-2">No clip yet. Drag one from Footage onto the video, or pick a clip in Footage on the left.</p>
          <p className="text-[11px] text-fg-3 mt-1">The designer's slot shows until you do.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <FieldLabel>{param.label}</FieldLabel>
      <div data-testid="footage-card" className="flex gap-3 items-center rounded-lg bg-raised border border-line p-2">
        {chosen?.thumbUrl ? (
          <img src={api.fileUrl(chosen.thumbUrl)} alt="" className="w-20 aspect-video rounded-md object-cover bg-stage block shrink-0" />
        ) : (
          <div aria-hidden="true" className="w-20 aspect-video rounded-md bg-stage shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs truncate">{chosen?.originalName ?? `Clip ${current.assetId}`}</div>
          {chosen && (
            <div className="text-[11px] text-fg-3 mt-0.5 tabular-nums">
              {chosen.durationS.toFixed(1)} s · {chosen.width}×{chosen.height}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <Segmented
          label="Fit"
          size="sm"
          value={fit}
          options={[
            { value: 'cover', label: 'Fill (crop)' },
            { value: 'contain', label: 'Fit (letterbox)' },
          ]}
          onChange={(f) => onChange({ ...current, fit: f })}
        />
        <button type="button" onClick={() => onChange(null)} className="text-[11px] text-fg-3 hover:text-fg shrink-0 transition-colors">
          Use the authored slot
        </button>
      </div>
      {chosen && chosen.durationS > 0 && <TrimBar value={current} clipLengthS={chosen.durationS} onChange={onChange} />}
      <label className="flex items-center justify-between mt-3 text-xs text-fg-2">
        <span>Mute footage sound</span>
        <Switch label="Mute footage sound" checked={current.muted === true} onChange={(muted) => onChange({ ...current, muted })} />
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
      className="absolute top-0 bottom-0 w-2.5 bg-white rounded-xs cursor-ew-resize shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      style={{ left: `${(at / len) * 100}%`, transform: side === 'left' ? undefined : 'translateX(-100%)' }}
    />
  );

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-fg-2">Trim</span>
        <span className="text-fg tabular-nums">
          {inS.toFixed(1)} s – {outS.toFixed(1)} s of {len.toFixed(1)} s
        </span>
      </div>
      <div
        data-testid="trim-bar"
        className="relative h-7 rounded-md bg-stage border border-line select-none touch-none overflow-hidden"
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerUp={onBarUp}
        onPointerCancel={onBarUp}
      >
        <div className="absolute top-0 bottom-0 bg-blue/35 pointer-events-none" style={{ left, width }} />
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
    <div className="mt-3 flex flex-col gap-2.5">
      <label className="flex items-center justify-between text-xs text-fg-2">
        <span>Key out green screen</span>
        <Switch label="Key out green screen" checked={key !== null} onChange={(on) => onChange(withKey(on ? DEFAULT_CHROMA_KEY : null))} />
      </label>
      {key && (
        <div className="flex flex-col gap-2 rounded-lg bg-raised border border-line p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-fg-2">
            <span>Screen colour</span>
            <div role="group" aria-label="Screen colour" className="inline-flex p-0.5 bg-stage border border-line rounded-md">
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
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-xs font-medium transition-colors ${key.color === c ? 'bg-hover text-fg' : 'text-fg-2 hover:text-fg'}`}
                >
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-xs block" style={{ backgroundColor: swatch }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Slider label="Threshold" name="Threshold" min={0} max={1} step={0.05} value={key.threshold} format={(v) => v.toFixed(2)} onChange={(n) => onChange(withKey({ ...key, threshold: n }))} />
          <Slider label="Spill suppression" name="Spill" min={0} max={1} step={0.05} value={key.spill} format={(v) => v.toFixed(2)} onChange={(n) => onChange(withKey({ ...key, spill: n }))} />
        </div>
      )}
    </div>
  );
}
