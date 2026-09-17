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
