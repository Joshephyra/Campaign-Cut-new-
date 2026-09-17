import { useEffect, type RefObject } from 'react';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';
import { CALLOUT_DRAW_FRAMES, calloutLayerClass, type Callout } from './callouts';

/**
 * M56: draws a circle, an underline or a highlight on one word of a text
 * layer, inside the layer's own SVG group so it follows the designer's
 * animation. lottie-web renders one <text> per character with a matrix
 * transform; the word's box is the union of its characters' boxes in the
 * group's coordinates. The draw-on follows the composition's frame, so
 * both runners draw the same picture at the same frame.
 *
 * Only mounted when there is something to draw: it reads the current
 * frame, which needs a Remotion context.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

type Box = { x: number; y: number; width: number; height: number };

/** The word's box in the group's coordinate space, or null when the text is not rendered yet. */
export function measureWord(group: Element, word: number): Box | null {
  const chars = Array.from(group.children).filter((c) => c.tagName.toLowerCase() === 'text') as SVGGraphicsElement[];
  if (chars.length === 0 || typeof chars[0]!.getBBox !== 'function') return null;
  // group the characters into words the way wordRanges does: whitespace splits
  const words: SVGGraphicsElement[][] = [];
  let current: SVGGraphicsElement[] = [];
  for (const c of chars) {
    if ((c.textContent ?? '').trim() === '') {
      if (current.length > 0) words.push(current);
      current = [];
    } else current.push(c);
  }
  if (current.length > 0) words.push(current);
  const target = words[word];
  if (!target) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of target) {
    const b = c.getBBox();
    if (b.width === 0 && b.height === 0) continue;
    const m = /matrix\(([^)]+)\)/.exec(c.getAttribute('transform') ?? '');
    const [a = 1, , , d = 1, e = 0, f = 0] = m ? m[1]!.split(/[\s,]+/).map(Number) : [];
    const sx = Number.isFinite(a) ? a : 1;
    const sy = Number.isFinite(d) ? d : 1;
    x0 = Math.min(x0, e + b.x * sx);
    y0 = Math.min(y0, f + b.y * sy);
    x1 = Math.max(x1, e + (b.x + b.width) * sx);
    y1 = Math.max(y1, f + (b.y + b.height) * sy);
  }
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The path a style draws around a box (in the group's units). */
export function calloutPath(style: Callout['style'], box: Box): { d: string; length: number; stroke: number } {
  const stroke = Math.max(4, Math.round(box.height * 0.06));
  if (style === 'underline') {
    const y = box.y + box.height * 0.82;
    const d = `M ${box.x - stroke} ${y} Q ${box.x + box.width / 2} ${y + stroke * 1.5} ${box.x + box.width + stroke} ${y}`;
    return { d, length: box.width + stroke * 2 + stroke * 2, stroke };
  }
  // a circle: an ellipse a little larger than the word, started at the left, drawn round
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.45;
  const rx = box.width / 2 + box.height * 0.35;
  const ry = box.height * 0.62;
  const d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
  // Ramanujan's approximation of the ellipse's perimeter
  const h = ((rx - ry) * (rx - ry)) / ((rx + ry) * (rx + ry));
  const length = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  return { d, length, stroke };
}

/** Draws every callout once; true when each one either drew or has nothing to draw yet at this frame. */
function drawAll(root: HTMLElement, callouts: Callout[], startFrame: number, frame: number): boolean {
  let ready = true;
  for (const c of callouts) {
    if (c.style === 'bigger') continue; // lives in the Lottie as a text animator
    const group = root.querySelector(`.${calloutLayerClass(c.key)}`);
    if (!group) {
      ready = false;
      continue;
    }
    const id = `cc-callout-${c.key}`;
    let el = group.querySelector<SVGElement>(`[data-callout="${id}"]`);
    const box = measureWord(group, c.word);
    if (!box) {
      el?.remove();
      ready = false;
      continue;
    }
    // progress of the draw-on, 0..1, from the callout's start within the element
    const local = frame - startFrame - c.startFrame;
    const progress = Math.max(0, Math.min(1, local / CALLOUT_DRAW_FRAMES));
    if (local < 0) {
      el?.remove();
      continue;
    }
    if (c.style === 'highlight') {
      if (!el || el.tagName.toLowerCase() !== 'rect') {
        el?.remove();
        el = document.createElementNS(SVG_NS, 'rect');
        el.setAttribute('data-callout', id);
        el.setAttribute('fill', c.color);
        el.setAttribute('fill-opacity', '0.55');
        el.setAttribute('rx', String(Math.round(box.height * 0.08)));
        group.insertBefore(el, group.firstChild); // behind the letters
      }
      const pad = box.height * 0.08;
      el.setAttribute('x', String(box.x - pad));
      el.setAttribute('y', String(box.y + box.height * 0.1));
      el.setAttribute('height', String(box.height * 0.85));
      el.setAttribute('width', String((box.width + pad * 2) * progress));
    } else {
      const { d, length, stroke } = calloutPath(c.style, box);
      if (!el || el.tagName.toLowerCase() !== 'path') {
        el?.remove();
        el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('data-callout', id);
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', c.color);
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
        group.appendChild(el); // over the letters
      }
      el.setAttribute('d', d);
      el.setAttribute('stroke-width', String(stroke));
      el.setAttribute('stroke-dasharray', String(length));
      el.setAttribute('stroke-dashoffset', String(length * (1 - progress)));
    }
  }
  return ready;
}

export function CalloutOverlay({ host, callouts, startFrame, version }: { host: RefObject<HTMLDivElement | null>; callouts: Callout[]; startFrame: number; version: unknown }) {
  const frame = useCurrentFrame();
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    // lottie-web builds its SVG after mount: draw now if it is there, else hold the frame and watch for it.
    if (drawAll(root, callouts, startFrame, frame)) return;
    const handle = delayRender('Drawing callouts');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(giveUp);
      continueRender(handle);
    };
    const observer = new MutationObserver(() => {
      if (drawAll(root, callouts, startFrame, frame)) finish();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    const giveUp = setTimeout(() => {
      drawAll(root, callouts, startFrame, frame);
      finish();
    }, 5000);
    return finish;
  }, [host, callouts, startFrame, frame, version]);
  return null;
}
