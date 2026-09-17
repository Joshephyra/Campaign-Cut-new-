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
  /**
   * M57: may carry an index as well: cc.headline.1, cc.headline.2 are the
   * lines of one headline, each its own layer, so a design that sets each
   * line on its own plate stays editable line by line. Plain cc.headline
   * still works.
   */
  lines?: boolean;
};

export const ROLES: Readonly<Record<string, RoleSpec>> = {
  headline: { kind: 'text', label: 'Headline', lines: true },
  subhead: { kind: 'text', label: 'Subhead', lines: true },
  body: { kind: 'text', label: 'Body', lines: true },
  stat: { kind: 'text', label: 'Stat', repeated: true },
  accent: { kind: 'color', label: 'Accent colour' },
  surface: { kind: 'color', label: 'Surface colour' },
  logo: { kind: 'image', label: 'Logo' },
  /** M58: any replaceable photo or picture that is not the logo: cc.image.1, cc.image.2, … one slot each. */
  image: { kind: 'image', label: 'Photo', repeated: true },
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
