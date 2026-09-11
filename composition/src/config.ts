/**
 * The single composition's fixed parameters. There is exactly one
 * composition in this product (CLAUDE.md: one composition, two runners).
 * Both the browser Player and the server renderer read these values from
 * here so they can never disagree.
 */
export const compositionConfig = {
  id: 'main',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150, // 5 seconds
} as const;

export type MainProps = {
  /** Solid background colour as a #rrggbb hex string. */
  background: string;
};

export const defaultProps: MainProps = {
  background: '#0F4C5C',
};
