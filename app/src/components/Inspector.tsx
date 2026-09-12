import { hexToRgba, type ParamValues, type TemplateParam } from '@campaigncut/composition';
import { useEffect, useState } from 'react';

type Props = {
  schema: TemplateParam[];
  values: ParamValues;
  onChange: (next: ParamValues) => void;
};

/**
 * The inspector is GENERATED from the schema. There is no per-template UI
 * code anywhere: a template with three text roles and one accent colour
 * produces three text fields and a colour picker, automatically.
 */
export function Inspector({ schema, values, onChange }: Props) {
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      {schema.map((param) => (
        <div key={param.key} data-testid={`param-${param.key}`}>
          {param.kind === 'text' && <TextControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
          {param.kind === 'color' && <ColorControl param={param} value={valueOf(param, values)} onChange={(v) => set(param.key, v)} />}
          {param.kind === 'image' && <Placeholder param={param} note="Logo upload arrives in M8." />}
          {param.kind === 'media' && <Placeholder param={param} note="Footage upload arrives in M7 and M8." />}
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

function Placeholder({ param, note }: { param: TemplateParam; note: string }) {
  return (
    <div>
      <Label param={param} />
      <div className="border border-dashed border-hairline px-2 py-2 font-mono text-[10px] text-muted">{note}</div>
    </div>
  );
}
