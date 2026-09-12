import type { ParamKind } from '@campaigncut/composition';

/**
 * The role table from SPEC.md 1.1. Adding a role here is the only change
 * needed for the generator to understand a new tag. Keep in sync with
 * docs/AE-AUTHORING.md.
 */
export type RoleSpec = {
  kind: ParamKind;
  label: string;
  /** Must be written as cc.<role>.<n>. */
  repeated?: boolean;
  /** Position and size locked; only the value is editable. */
  locked?: boolean;
};

export const ROLES: Readonly<Record<string, RoleSpec>> = {
  headline: { kind: 'text', label: 'Headline' },
  subhead: { kind: 'text', label: 'Subhead' },
  body: { kind: 'text', label: 'Body' },
  stat: { kind: 'text', label: 'Stat', repeated: true },
  accent: { kind: 'color', label: 'Accent colour' },
  surface: { kind: 'color', label: 'Surface colour' },
  logo: { kind: 'image', label: 'Logo' },
  mediaFill: { kind: 'media', label: 'Footage' },
  'safe.disclaimer': { kind: 'text', label: 'Disclaimer', locked: true },
};

export const KNOWN_ROLES = Object.keys(ROLES);

/** "safe.disclaimer" -> "disclaimer"; ("stat", 2) -> "stat.2". */
export function keyFor(role: string, index: number | undefined): string {
  const base = role.includes('.') ? role.slice(role.lastIndexOf('.') + 1) : role;
  return index === undefined ? base : `${base}.${index}`;
}

export function labelFor(role: string, index: number | undefined): string {
  const spec = ROLES[role];
  const base = spec?.label ?? role;
  return index === undefined ? base : `${base} ${index}`;
}
