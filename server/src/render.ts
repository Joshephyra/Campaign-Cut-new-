import { compositionConfig, type MainProps } from '@campaigncut/composition';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Resolve the composition package's Remotion entry through node resolution,
 *  so the server never hardcodes a path into another workspace. */
const entryPoint = require.resolve('@campaigncut/composition/entry');

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
export async function renderComposition({ outputPath, inputProps, onProgress }: RenderOptions) {
  const serveUrl = await bundle({ entryPoint });

  const composition = await selectComposition({
    serveUrl,
    id: compositionConfig.id,
    inputProps,
  });

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
