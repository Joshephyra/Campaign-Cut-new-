import { hexToRgba, type ParamValues, type TemplateParam } from '@campaigncut/composition';
import { Palette, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Theme } from '../api';
import { Button, ICON } from './ui';

/** One colour role as it stands across the spot. */
export type StyleRole = {
  role: string;
  label: string;
  /** The colour shown: the first scene's, in start order. */
  value: string;
  /** The designer's colour, from the first scene that has the role. */
  default: string;
  /** True when scenes carry different colours for this role. */
  mixed: boolean;
  elementIds: number[];
};

type ElementLike = { id: number; name: string; schema: TemplateParam[] };

/**
 * M32: the colour roles across every scene, in the order they first appear,
 * each with its current colour (the first scene's), the designer's, and
 * whether the scenes disagree.
 */
export function styleRoles(elements: ElementLike[], values: Record<number, ParamValues>): StyleRole[] {
  const roles: StyleRole[] = [];
  for (const e of elements) {
    for (const p of e.schema) {
      if (p.kind !== 'color') continue;
      const raw = values[e.id]?.[p.key];
      const current = typeof raw === 'string' && hexToRgba(raw) ? raw.toUpperCase() : String(p.default).toUpperCase();
      const existing = roles.find((r) => r.role === p.role);
      if (existing) {
        existing.elementIds.push(e.id);
        if (current !== existing.value) existing.mixed = true;
      } else {
        roles.push({ role: p.role, label: p.label, value: current, default: String(p.default).toUpperCase(), mixed: false, elementIds: [e.id] });
      }
    }
  }
  return roles;
}

type Props = {
  elements: ElementLike[];
  values: Record<number, ParamValues>;
  themes: Theme[];
  /** Colours by role to write into every scene that carries the role. */
  onApply: (colors: Record<string, string>) => void;
  onSaveTheme: (name: string, colors: Record<string, string>) => void;
  onDeleteTheme: (id: number) => void;
};

/** <input type="color"> insists on lower-case #rrggbb. */
const lower = (hex: string) => (hexToRgba(hex) ? hex.toLowerCase() : '#000000');

/**
 * The spot's colours: one row per colour role across every scene, changing
 * all of them at once; saved themes to apply to any spot.
 */
export function StylePanel({ elements, values, themes, onApply, onSaveTheme, onDeleteTheme }: Props) {
  const roles = styleRoles(elements, values);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const current = Object.fromEntries(roles.map((r) => [r.role, r.value]));
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveTheme(trimmed, current);
    setNaming(false);
    setName('');
  };

  return (
    <section className="px-4 py-4 border-b border-line">
      <h2 className="text-[13px] font-semibold flex items-center gap-2 mb-1">
        <Palette size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-2" />
        Colours across the spot
      </h2>
      <p className="text-[11px] text-fg-3 mb-3">A change here recolours every scene that uses the role.</p>
      {roles.length === 0 ? (
        <p className="text-xs text-fg-2">No colour roles in this spot.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roles.map((r) => (
            <RoleRow key={r.role} role={r} onChange={(hex) => onApply({ [r.role]: hex })} onReset={() => onApply({ [r.role]: r.default })} />
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-fg-2">Saved themes</h3>
        {!naming && roles.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setNaming(true)}>
            Save as theme
          </Button>
        )}
      </div>
      {naming && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            aria-label="Theme name"
            value={name}
            placeholder="Name this set of colours"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setNaming(false);
            }}
            className="field !py-1.5"
          />
          <Button size="sm" variant="primary" onClick={save} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      )}
      {themes.length === 0 ? (
        <p className="text-[11px] text-fg-3 mt-2">None yet. Save the colours you like and apply them to any spot.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {themes.map((t) => (
            <li key={t.id} className="flex items-center gap-2 h-9 px-2 rounded-md bg-raised">
              <button type="button" aria-label={`Apply ${t.name}`} onClick={() => onApply(t.colors)} className="flex-1 min-w-0 flex items-center gap-2 text-left text-xs text-fg hover:text-blue transition-colors">
                <span className="flex shrink-0 rounded-xs overflow-hidden border border-line">
                  {Object.values(t.colors)
                    .slice(0, 4)
                    .map((c, i) => (
                      <span key={i} aria-hidden="true" className="w-3 h-4 block" style={{ backgroundColor: c }} />
                    ))}
                </span>
                <span className="truncate">{t.name}</span>
              </button>
              <button type="button" aria-label={`Delete ${t.name}`} onClick={() => onDeleteTheme(t.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-md text-fg-3 hover:text-red hover:bg-red-tint transition-colors">
                <Trash2 size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoleRow({ role, onChange, onReset }: { role: StyleRole; onChange: (hex: string) => void; onReset: () => void }) {
  // The hex field can hold a half-typed value; only valid hex is applied.
  const [draft, setDraft] = useState(role.value);
  useEffect(() => setDraft(role.value), [role.value]);
  const valid = hexToRgba(draft) !== null;
  const emit = (v: string) => {
    setDraft(v);
    if (hexToRgba(v)) onChange(v.toUpperCase());
  };
  const changed = role.value !== role.default || role.mixed;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-2">{role.label}</span>
        {changed && (
          <button type="button" aria-label={`Reset ${role.label} to the designer`} onClick={onReset} className="inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg transition-colors">
            <RotateCcw size={11} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
            Designer's
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${role.label} swatch across the spot`} value={lower(valid ? draft : role.value)} onChange={(e) => emit(e.target.value)} className="swatch shrink-0 !w-9 !h-9" />
        <input type="text" aria-label={`${role.label} across the spot`} value={draft} onChange={(e) => emit(e.target.value)} spellCheck={false} aria-invalid={!valid} className="field !py-1.5 tabular-nums uppercase" />
      </div>
      {role.mixed && <span className="text-[11px] text-fg-3">Scenes differ; setting it here makes them match.</span>}
    </li>
  );
}
