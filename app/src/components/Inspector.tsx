import {
  DEFAULT_CHROMA_KEY,
  hexToRgba,
  isChromaKey,
  isMediaValue,
  type ChromaKey,
  type Fit,
  type MediaValue,
  type ParamValues,
  type TemplateParam,
} from '@campaigncut/composition';
import { useEffect, useRef, useState } from 'react';
import { api, type MediaAsset } from '../api';

type Props = {
  schema: TemplateParam[];
  values: ParamValues;
  onChange: (next: ParamValues) => void;
  /** Uploaded footage, for cc.mediaFill params. */
  assets?: MediaAsset[];
  /** For resolving a template's own image defaults (images/logo.png). */
  templateSlug?: string;
};

/**
 * The inspector is GENERATED from the schema. There is no per-template UI
 * code anywhere: a template with three text roles and one accent colour
 * produces three text fields and a colour picker, automatically.
 */
export function Inspector({ schema, values, onChange, assets = [], templateSlug = '' }: Props) {
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      {schema.map((param) => (
        <div key={param.key} data-testid={`param-${param.key}`}>
          {param.kind === 'text' && <TextControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
          {param.kind === 'color' && <ColorControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
          {param.kind === 'image' && (
            <ImageControl param={param} value={valueOf(param, values)} templateSlug={templateSlug} onChange={(v) => set(param.key, v)} />
          )}
          {param.kind === 'media' && (
            <MediaControl param={param} value={values[param.key]} assets={assets} onChange={(v) => set(param.key, v)} />
          )}
        </div>
      ))}
    </div>
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
function imagePreviewUrl(value: string, templateSlug: string): string | null {
  if (!value) return null;
  if (value.startsWith('data:') || /^https?:/.test(value)) return value;
  if (value.startsWith('/')) return api.fileUrl(value);
  return `${api.fileUrl(`/templates/${templateSlug}`)}/${value}`;
}

function ImageControl({
  param,
  value,
  templateSlug,
  onChange,
}: {
  param: TemplateParam;
  value: string;
  templateSlug: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = imagePreviewUrl(value, templateSlug);

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
  const id = `param-${param.key}-select`;
  const chosen = current ? assets.find((a) => a.id === current.assetId) : undefined;
  const fit: Fit = current?.fit ?? 'cover';

  return (
    <div>
      <Label param={param} htmlFor={id} />
      <select
        id={id}
        value={current ? String(current.assetId) : ''}
        onChange={(e) => onChange(e.target.value ? { assetId: Number(e.target.value), fit } : null)}
        className="w-full bg-panel border border-hairline px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-cobalt"
      >
        <option value="">None (authored slot)</option>
        {assets.map((a) => (
          <option key={a.id} value={String(a.id)}>
            {a.originalName}
          </option>
        ))}
      </select>
      {current && (
        <div className="flex items-center gap-2 mt-2">
          {chosen && <img src={api.fileUrl(chosen.thumbUrl)} alt="" className="w-16 aspect-video object-cover bg-black block" />}
          <div className="flex border border-hairline font-mono text-[10px]">
            {(['cover', 'contain'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onChange({ assetId: current.assetId, fit: f })}
                className={`px-2 py-1 ${fit === f ? 'bg-cobalt text-white' : 'text-muted hover:text-fg'}`}
              >
                {f === 'cover' ? 'Cover (crop)' : 'Contain (letterbox)'}
              </button>
            ))}
          </div>
        </div>
      )}
      {current && <ChromaControls value={current} onChange={onChange} />}
      <p className="font-mono text-[10px] text-muted mt-1">Upload clips in the Footage panel below.</p>
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
          <label className="flex items-center gap-2">
            <span className="w-20 text-muted">Screen colour</span>
            <select
              aria-label="Screen colour"
              value={key.color}
              onChange={(e) => onChange(withKey({ ...key, color: e.target.value as ChromaKey['color'] }))}
              className="bg-panel border border-hairline px-1 py-0.5 text-fg"
            >
              <option value="green">green</option>
              <option value="blue">blue</option>
            </select>
          </label>
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
