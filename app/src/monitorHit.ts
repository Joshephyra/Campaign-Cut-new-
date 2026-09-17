import { LAYER_CLASS, layerClassFor, type TemplateParam } from '@campaigncut/composition';

/**
 * M28: finding the editable layer under the pointer on the monitor.
 *
 * The composition tags every placement layer with a class and each
 * element's Lottie wrapper with its element id (see applyLottieValues and
 * LottieLayer). lottie-web copies the class onto the layer's <g>, so the
 * layer's box on screen, wherever the animation has put it on this frame,
 * is one getBoundingClientRect away. A hidden layer has a zero-size box.
 */
export type Box = { left: number; top: number; width: number; height: number; right: number; bottom: number };

export type LayerBox = {
  elementId: number;
  /** The placement param's key, e.g. "headline.transform". */
  key: string;
  rect: Box;
};

/** The layers on screen, in paint order (later is on top). */
export function findLayerBoxes(monitor: HTMLElement, schemaFor: (elementId: number) => TemplateParam[] | undefined): LayerBox[] {
  const boxes: LayerBox[] = [];
  for (const wrapper of Array.from(monitor.querySelectorAll<HTMLElement>('[data-cc-element]'))) {
    const elementId = Number(wrapper.getAttribute('data-cc-element'));
    const placements = (schemaFor(elementId) ?? []).filter((p) => p.kind === 'transform');
    if (!Number.isFinite(elementId) || placements.length === 0) continue;
    for (const node of Array.from(wrapper.querySelectorAll<Element>(`.${LAYER_CLASS}`))) {
      const param = placements.find((p) => node.classList.contains(layerClassFor(p.key)));
      if (!param) continue;
      const r = node.getBoundingClientRect();
      boxes.push({ elementId, key: param.key, rect: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom } });
    }
  }
  return boxes;
}

/** The topmost layer whose box contains the point, or null. Zero-size boxes (hidden layers) never match. */
export function pickLayer(boxes: LayerBox[], x: number, y: number): LayerBox | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const { rect } = boxes[i]!;
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return boxes[i]!;
  }
  return null;
}
