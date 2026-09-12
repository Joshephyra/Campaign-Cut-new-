/** mm:ss:ff, the way an editor's timecode reads. */
export function formatTimecode(frame: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps));
  const total = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(total / safeFps);
  const frames = total % safeFps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}
