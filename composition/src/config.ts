import type { ElementProps } from './elements';
import type { TransitionProps } from './transitions';

/**
 * The single composition's fixed parameters. There is exactly one
 * composition in this product (CLAUDE.md: one composition, two runners).
 * Both the browser Player and the server renderer read these values from
 * here so they can never disagree.
 *
 * Duration is NOT fixed here: it is derived from the elements being shown.
 * See elements.ts.
 */
export const compositionConfig = {
  id: 'main',
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/**
 * The parts of a Bodymovin/Lottie export the composition needs to know
 * about. Everything else is passed through untouched to the renderer.
 */
export type LottieAnimationData = {
  v?: string;
  /** Authored frame rate. */
  fr: number;
  /** In point, in Lottie frames. */
  ip: number;
  /** Out point, in Lottie frames. */
  op: number;
  w: number;
  h: number;
  nm?: string;
  ddd?: number;
  assets?: unknown[];
  layers: unknown[];
  fonts?: unknown;
  markers?: unknown[];
  [key: string]: unknown;
};

/** Footage for the cc.mediaFill slot. Declared here to avoid an import cycle with media.ts. */
export type MainMedia = {
  /** Proxy URL in the Player, original URL on the server. See mediaSourceFor(). */
  src: string;
  /** Slot rectangle as fractions of the frame. */
  rect: { x: number; y: number; w: number; h: number };
  fit: 'cover' | 'contain';
};

export type MainProps = {
  /** Solid background colour as a #rrggbb hex string. */
  background: string;
  /** User footage shown through the cc.mediaFill slot, or null. */
  media: MainMedia | null;
  /** The timeline: every element with its Lottie and in/out points. */
  elements: ElementProps[];
  /** Transitions per element boundary. Absent or empty means every boundary is a cut. */
  transitions?: TransitionProps[];
};

/** A valid, empty Lottie for tests and placeholders. */
export const EMPTY_LOTTIE: LottieAnimationData = {
  v: '5.12.2',
  fr: compositionConfig.fps,
  ip: 0,
  op: 1,
  w: compositionConfig.width,
  h: compositionConfig.height,
  nm: 'empty',
  ddd: 0,
  assets: [],
  layers: [],
};

export const defaultProps: MainProps = {
  background: '#0F4C5C',
  media: null,
  elements: [],
};
