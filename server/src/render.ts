import { compositionConfig, type MainProps } from '@campaigncut/composition';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Resolve the composition package's Remotion entry through node resolution,
 *  so the server never hardcodes a path into another workspace. */
const entryPoint = require.resolve('@campaigncut/composition/entry');

/** Bundle once per process; every render in this process reuses it. */
let bundlePromise: Promise<string> | undefined;
function getServeUrl(): Promise<string> {
  bundlePromise ??= bundle({ entryPoint });
  return bundlePromise;
}

export type RenderOptions = {
  outputPath: string;
  inputProps: MainProps;
  onProgress?: (fraction: number) => void;
};

/**
 * Server-side runner. Renders THE composition (same file the Player uses)
 * with renderMedia. The only thing that may differ from the Player is the
 * inputProps it is handed.
 */
export async function renderComposition({ outputPath, inputProps, onProgress }: RenderOptions): Promise<string> {
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => onProgress?.(progress),
  });

  return path.resolve(outputPath);
}

export type ThumbnailOptions = {
  outputPath: string;
  inputProps: MainProps;
  /** Frame to capture. Defaults to the middle of the composition. */
  frame?: number;
};

/** One PNG frame of the same composition, for template thumbnails. */
export async function renderThumbnail({ outputPath, inputProps, frame }: ThumbnailOptions): Promise<string> {
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, id: compositionConfig.id, inputProps });

  await renderStill({
    composition,
    serveUrl,
    output: outputPath,
    inputProps,
    frame: frame ?? Math.floor(composition.durationInFrames / 2),
    imageFormat: 'png',
  });

  return path.resolve(outputPath);
}
