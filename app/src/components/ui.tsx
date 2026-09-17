import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

/**
 * M30: the shared control vocabulary. One shape for buttons, one for
 * segmented choices, one slider, one switch, one section title. Every
 * screen uses these so the same action looks the same everywhere.
 */

export const ICON = { size: 16, strokeWidth: 1.75 } as const;

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-blue text-white hover:bg-blue-hover active:bg-blue-deep shadow-card',
  secondary: 'bg-raised text-fg border border-line hover:bg-hover hover:border-line-strong',
  ghost: 'text-fg-2 hover:text-fg hover:bg-hover',
  danger: 'text-red hover:bg-red-tint',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: LucideIcon }) {
  const pad = size === 'sm' ? 'h-7 px-2.5 text-xs gap-1.5' : 'h-9 px-3.5 text-[13px] gap-2';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-medium rounded-md whitespace-nowrap select-none transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none ${pad} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({ label, icon: Icon, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={rest.title ?? label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-fg-2 hover:text-fg hover:bg-hover transition-colors duration-150 disabled:opacity-35 disabled:pointer-events-none ${className}`}
      {...rest}
    >
      <Icon size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" />
    </button>
  );
}

/** A row of mutually exclusive choices. `label` names the group for assistive tech. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  className = '',
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pad = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]';
  return (
    <div role="group" aria-label={label} className={`inline-flex p-0.5 bg-raised border border-line rounded-md ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-colors duration-150 ${pad} ${
              active ? 'bg-blue text-white shadow-card' : 'text-fg-2 hover:text-fg hover:bg-hover'
            }`}
          >
            {o.icon && <o.icon size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled range with its value read out beside it. */
export function Slider({
  label,
  name,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (v) => String(v),
  disabled,
}: {
  label: string;
  /** Shown to the user; `label` is the accessible name. */
  name?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (n: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const p = max > min ? ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100 : 0;
  return (
    <label className="flex items-center gap-3 text-xs text-fg-2">
      {name && <span className="w-14 shrink-0">{name}</span>}
      <input
        type="range"
        className="slider flex-1 min-w-0"
        style={{ '--p': `${p}%` } as CSSProperties}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-14 text-right text-fg tabular-nums shrink-0">{format(value)}</span>
    </label>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <input type="checkbox" role="switch" className="switch" aria-label={label} aria-checked={checked} checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

/** A panel section: title on the left, an optional action on the right, then the content. */
/** M53: whether a section is folded, remembered per browser under its id (a per-viewer convenience; never state that must persist). */
export function useCollapsed(id: string | undefined, initial = false): [boolean, (next: boolean) => void] {
  const key = id ? `cc.folded.${id}` : null;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!key) return initial;
    try {
      const saved = window.localStorage.getItem(key);
      return saved === null ? initial : saved === '1';
    } catch {
      return initial;
    }
  });
  const set = (next: boolean) => {
    setCollapsed(next);
    if (!key) return;
    try {
      window.localStorage.setItem(key, next ? '1' : '0');
    } catch {
      /* a private window, or blocked storage: the fold still works for the session */
    }
  };
  return [collapsed, set];
}

/**
 * A titled block of a panel. With an `id` it folds: the title is a button
 * with a chevron, the fold is remembered per browser, and anything in
 * `action` stays live beside the title while folded. `note` is a one-line
 * explanation that folds with the body.
 */
export function Section({
  title,
  action,
  children,
  className = '',
  id,
  icon: Icon,
  note,
  defaultCollapsed = false,
  level = 2,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  icon?: LucideIcon;
  note?: ReactNode;
  defaultCollapsed?: boolean;
  /** 2 for a panel's sections, 3 for a block inside one. */
  level?: 2 | 3;
}) {
  const [collapsed, setCollapsed] = useCollapsed(id, defaultCollapsed);
  const foldable = id !== undefined;
  const Heading = level === 3 ? 'h3' : 'h2';
  const titleClass = level === 3 ? 'text-xs font-semibold text-fg-2' : 'text-[13px] font-semibold text-fg';
  const label = (
    <>
      {Icon && <Icon size={ICON.size} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="text-fg-2" />}
      {title}
    </>
  );
  return (
    <section id={id} data-collapsed={foldable ? String(collapsed) : undefined} className={`${level === 3 ? '' : 'px-5 py-4 border-b border-line last:border-b-0'} ${className}`}>
      <div className={`flex items-center justify-between gap-2 ${collapsed ? '' : 'mb-3'}`}>
        <Heading className={`${titleClass} min-w-0`}>
          {foldable ? (
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
              className="inline-flex items-center gap-2 max-w-full whitespace-nowrap text-left rounded-sm -ml-1 pl-1 pr-1 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              <ChevronDown size={14} strokeWidth={ICON.strokeWidth} aria-hidden="true" className={`shrink-0 text-fg-3 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`} />
              {label}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">{label}</span>
          )}
        </Heading>
        {action}
      </div>
      {!collapsed && note && <p className="text-[11px] text-fg-3 -mt-2 mb-3">{note}</p>}
      {!collapsed && children}
    </section>
  );
}

/** A field's name, sitting above its control, with an optional fact on the right. */
export function FieldLabel({ htmlFor, children, right }: { htmlFor?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-2">
        {children}
      </label>
      {right && <span className="text-[11px] text-fg-3 tabular-nums">{right}</span>}
    </div>
  );
}

/** The wordmark: a blue play mark and the name. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect width="22" height="22" rx="6" fill="var(--color-blue)" />
        <path d="M8.5 6.5v9l7-4.5z" fill="#fff" />
      </svg>
      <span className="text-[15px] font-bold tracking-tight text-fg">CampaignCut</span>
    </span>
  );
}
