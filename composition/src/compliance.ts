/**
 * M35: the one compliance check CampaignCut makes. A disclaimer must be on
 * screen for at least four seconds before a spot exports. Its wording is
 * the campaign's business; nothing here reads it beyond "not empty".
 */
export const DISCLAIMER_MIN_SECONDS = 4;

export type DisclaimerScene = { startFrame: number; endFrame: number; enabled: boolean; hasDisclaimer: boolean };

/** Seconds a disclaimer is on screen: the union of the enabled scenes that carry one. */
export function disclaimerSeconds(scenes: DisclaimerScene[], fps: number): number {
  const spans = scenes
    .filter((s) => s.enabled && s.hasDisclaimer && s.endFrame > s.startFrame)
    .map((s) => [s.startFrame, s.endFrame] as const)
    .sort((a, b) => a[0] - b[0]);
  let frames = 0;
  let cursor = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, cursor);
    if (end > from) frames += end - from;
    cursor = Math.max(cursor, end);
  }
  return Math.round((frames / fps) * 10) / 10;
}

export type DisclaimerCheck = { ok: boolean; seconds: number; message: string };

export function disclaimerCheck(scenes: DisclaimerScene[], fps: number): DisclaimerCheck {
  const seconds = disclaimerSeconds(scenes, fps);
  const has = scenes.some((s) => s.enabled && s.hasDisclaimer);
  if (!has) return { ok: false, seconds: 0, message: `No disclaimer on screen; one must show for at least ${DISCLAIMER_MIN_SECONDS.toFixed(1)} s. Add a disclaimer from the library or fill in the end card's.` };
  if (seconds < DISCLAIMER_MIN_SECONDS) {
    return { ok: false, seconds, message: `Disclaimer on screen for ${seconds.toFixed(1)} s; it must be at least ${DISCLAIMER_MIN_SECONDS.toFixed(1)} s. Lengthen the scene that carries it.` };
  }
  return { ok: true, seconds, message: `Disclaimer on screen for ${seconds.toFixed(1)} s` };
}

/** True when a text param is the disclaimer and its value (or default) says something. */
export function carriesDisclaimer(schema: { kind: string; role: string; key: string; default: unknown }[], values: Record<string, unknown>): boolean {
  return schema.some((p) => {
    if (p.kind !== 'text' || p.role !== 'safe.disclaimer') return false;
    const v = values[p.key] ?? p.default;
    return typeof v === 'string' && v.trim().length > 0;
  });
}


/**
 * M48: the scenes whose footage slot has no clip yet, in play order. The
 * designer's stand-in shows there, in the preview and in the export alike,
 * so the export panel says so before anyone presses Export. A note, not a
 * block: a stand-in is sometimes what a rough cut wants.
 */
export function emptySlots(scenes: { name: string; enabled: boolean; startFrame: number; schema: { kind: string; key: string }[]; values: Record<string, unknown> }[]): string[] {
  return scenes
    .filter((s) => s.enabled)
    .sort((a, b) => a.startFrame - b.startFrame)
    .filter((s) => {
      const slot = s.schema.find((p) => p.kind === 'media');
      if (!slot) return false;
      const v = s.values[slot.key];
      return !(v && typeof v === 'object' && 'assetId' in v && (v as { assetId: unknown }).assetId);
    })
    .map((s) => s.name);
}


/**
 * M49: everything a person checks before pressing Export, in one list.
 * The disclaimer rule blocks; the rest are notes: footage slots with no
 * clip, logo slots still showing the designer's stand-in, and text that is
 * still the designer's words. An item that does not apply to the spot (no
 * logo slot anywhere, say) is left out.
 */
export type ReadinessScene = {
  name: string;
  enabled: boolean;
  startFrame: number;
  endFrame: number;
  schema: { kind: string; role: string; key: string; default: unknown }[];
  values: Record<string, unknown>;
};

export type ReadinessItem = { key: 'disclaimer' | 'length' | 'footage' | 'logo' | 'words'; ok: boolean; blocking: boolean; message: string; scenes: string[]; /** M52: the content runs past the spot's length; a cut-down would fit it. */ over?: boolean };

/** M52: the lengths a spot comes in. */
export const SPOT_LENGTHS = [6, 15, 30, 60] as const;

/** ":30" for 30. */
export function lengthLabel(lengthS: number): string {
  return `:${String(Math.round(lengthS)).padStart(2, '0')}`;
}

/** The content's length in seconds: where the last enabled element ends. */
export function contentSeconds(scenes: { enabled: boolean; endFrame: number }[], fps: number): number {
  const end = scenes.filter((s) => s.enabled).reduce((m, s) => Math.max(m, s.endFrame), 0);
  return Math.round((end / fps) * 10) / 10;
}

export type Readiness = { ok: boolean; blocked: boolean; todo: number; items: ReadinessItem[] };

const names = (list: string[]) => (list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`);

export function readiness(scenes: ReadinessScene[], fps: number, lengthS?: number | null): Readiness {
  const live = scenes.filter((s) => s.enabled).sort((a, b) => a.startFrame - b.startFrame);
  const items: ReadinessItem[] = [];

  // M52: a spot is exactly its length. Timing is the designer's; the fit comes from which scenes are in.
  if (lengthS && lengthS > 0) {
    const content = contentSeconds(scenes, fps);
    const gap = Math.round((lengthS - content) * 10) / 10;
    const label = lengthLabel(lengthS);
    if (Math.abs(gap) < 0.05) items.push({ key: 'length', ok: true, blocking: true, message: `Exactly ${lengthS.toFixed(1)} s, a ${label}`, scenes: [] });
    else if (gap > 0) items.push({ key: 'length', ok: false, blocking: true, message: `The spot is ${content.toFixed(1)} s; a ${label} must be exactly ${lengthS.toFixed(1)} s. Add ${gap.toFixed(1)} s of scenes.`, scenes: [] });
    else items.push({ key: 'length', ok: false, blocking: true, over: true, message: `The spot is ${content.toFixed(1)} s; a ${label} must be exactly ${lengthS.toFixed(1)} s. Cut ${(-gap).toFixed(1)} s of scenes, or make it longer.`, scenes: [] });
  }

  const disclaimer = disclaimerCheck(scenes.map((s) => ({ startFrame: s.startFrame, endFrame: s.endFrame, enabled: s.enabled, hasDisclaimer: carriesDisclaimer(s.schema, s.values) })), fps);
  items.push({ key: 'disclaimer', ok: disclaimer.ok, blocking: true, message: disclaimer.ok ? `Disclaimer on screen ${disclaimer.seconds.toFixed(1)} s` : disclaimer.message, scenes: [] });

  if (live.some((s) => s.schema.some((p) => p.kind === 'media'))) {
    const empty = emptySlots(live);
    items.push({ key: 'footage', ok: empty.length === 0, blocking: false, message: empty.length === 0 ? 'Every footage slot has a clip' : empty.length === 1 ? `No clip yet in ${empty[0]}` : `No clip yet in ${empty.length} scenes: ${names(empty)}`, scenes: empty });
  }

  const standIn = live.filter((s) => s.schema.some((p) => p.kind === 'image' && p.role === 'logo' && (s.values[p.key] === undefined || s.values[p.key] === null || s.values[p.key] === p.default))).map((s) => s.name);
  if (live.some((s) => s.schema.some((p) => p.kind === 'image' && p.role === 'logo'))) {
    items.push({ key: 'logo', ok: standIn.length === 0, blocking: false, message: standIn.length === 0 ? 'Your logo is in' : standIn.length === 1 ? `The designer's stand-in logo in ${standIn[0]}` : `The designer's stand-in logo in ${standIn.length} scenes: ${names(standIn)}`, scenes: standIn });
  }

  const designers = live.filter((s) => s.schema.some((p) => p.kind === 'text' && p.role !== 'safe.disclaimer' && (s.values[p.key] === undefined || s.values[p.key] === p.default))).map((s) => s.name);
  if (live.some((s) => s.schema.some((p) => p.kind === 'text' && p.role !== 'safe.disclaimer'))) {
    items.push({ key: 'words', ok: designers.length === 0, blocking: false, message: designers.length === 0 ? 'Every line is yours' : designers.length === 1 ? `Still the designer's words in ${designers[0]}` : `Still the designer's words in ${designers.length} scenes: ${names(designers)}`, scenes: designers });
  }

  const blocked = items.some((i) => i.blocking && !i.ok);
  const todo = items.filter((i) => !i.ok).length;
  return { ok: todo === 0, blocked, todo, items };
}
