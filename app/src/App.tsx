import {
  compositionConfig,
  lottieDurationInFrames,
  Main,
  type LottieAnimationData,
  type MainProps,
} from '@campaigncut/composition';
import { Player } from '@remotion/player';
import { useEffect, useMemo, useState } from 'react';
// M1: one hardcoded template. The library and ingest come in later milestones.
import standinLottie from '../../templates/standin/template.json';

type ServerState = 'checking' | 'ok' | 'down';

function useServerHealth(): ServerState {
  const [state, setState] = useState<ServerState>('checking');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { status?: string }) => {
        if (!cancelled) setState(body.status === 'ok' ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setState('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function App() {
  const server = useServerHealth();

  const lottie = standinLottie as LottieAnimationData;
  const inputProps = useMemo<MainProps>(() => ({ background: '#0F4C5C', lottie }), [lottie]);
  const durationInFrames = lottieDurationInFrames(lottie, compositionConfig.fps);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200 p-8">
      <header className="flex items-baseline justify-between mb-6 max-w-5xl mx-auto">
        <h1 className="text-lg font-semibold tracking-tight">CampaignCut</h1>
        <p className="font-mono text-sm">
          server:{' '}
          <span className={server === 'ok' ? 'text-emerald-400' : server === 'down' ? 'text-red-400' : 'text-neutral-500'}>
            {server}
          </span>
        </p>
      </header>

      {/* Program monitor. Nothing ever overlays this. */}
      <section className="max-w-5xl mx-auto">
        <Player
          component={Main}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={compositionConfig.fps}
          compositionWidth={compositionConfig.width}
          compositionHeight={compositionConfig.height}
          controls
          loop
          style={{ width: '100%' }}
        />
        <p className="font-mono text-xs text-neutral-500 mt-3">
          {compositionConfig.id} · {compositionConfig.width}×{compositionConfig.height} · {compositionConfig.fps} fps ·{' '}
          {durationInFrames} frames · template: {String(lottie.nm ?? 'unnamed')}
        </p>
      </section>
    </main>
  );
}
