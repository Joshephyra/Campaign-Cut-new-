/**
 * The single composition's fixed parameters. There is exactly one
 * composition in this product (CLAUDE.md: one composition, two runners).
 * Both the browser Player and the server renderer read these values from
 * here so they can never disagree.
 *
 * Duration is NOT fixed here: it is derived from the Lottie being shown.
 * See lottieDuration.ts.
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

export type MainProps = {
  /** Solid background colour as a #rrggbb hex string. */
  background: string;
  /** The Lottie to composite over the background. */
  lottie: LottieAnimationData;
};

/** A valid, empty Lottie so the composition always has something to show. */
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
  lottie: EMPTY_LOTTIE,
};
