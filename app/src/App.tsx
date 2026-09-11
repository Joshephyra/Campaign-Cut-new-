import { compositionConfig, defaultProps, FrameCounter } from '@campaigncut/composition';
import { Player } from '@remotion/player';
import { useEffect, useState } from 'react';

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
          component={FrameCounter}
          inputProps={defaultProps}
          durationInFrames={compositionConfig.durationInFrames}
          fps={compositionConfig.fps}
          compositionWidth={compositionConfig.width}
          compositionHeight={compositionConfig.height}
          controls
          loop
          style={{ width: '100%' }}
        />
        <p className="font-mono text-xs text-neutral-500 mt-3">
          {compositionConfig.id} · {compositionConfig.width}×{compositionConfig.height} · {compositionConfig.fps} fps ·{' '}
          {compositionConfig.durationInFrames} frames
        </p>
      </section>
    </main>
  );
}
