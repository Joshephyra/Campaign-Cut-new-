import {
  applyLottieValues,
  compositionConfig,
  lottieDurationInFrames,
  Main,
  type LottieAnimationData,
  type MainProps,
  type ParamValues,
  type TemplateParam,
} from '@campaigncut/composition';
import { Player } from '@remotion/player';
import { useEffect, useMemo, useState } from 'react';
// M1/M2: one hardcoded template. The library and ingest come in later milestones.
import standinSchema from '../../templates/standin/schema.json';
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

const sourceLottie = standinLottie as LottieAnimationData;
const schema = standinSchema as TemplateParam[];
const BACKGROUND = '#0F4C5C';

/**
 * M2 TEST HARNESS. Throwaway. One control per schema param so typing can
 * be seen to change the video live. M6 replaces this with the real
 * schema-driven inspector.
 */
function Harness({ values, onChange }: { values: ParamValues; onChange: (next: ParamValues) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4 max-w-5xl mx-auto font-mono text-sm">
      {schema.map((param) => {
        const value = (values[param.key] ?? param.default) as string;
        const set = (v: string) => onChange({ ...values, [param.key]: v });
        return (
          <label key={param.key} className="flex items-center gap-3">
            <span className="w-32 text-neutral-400 shrink-0">{param.label}</span>
            {param.kind === 'color' ? (
              <>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="h-8 w-10 bg-transparent border border-neutral-700"
                  data-testid={`harness-${param.key}-swatch`}
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-700 px-2 py-1 text-neutral-100"
                  data-testid={`harness-${param.key}`}
                />
              </>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 px-2 py-1 text-neutral-100"
                data-testid={`harness-${param.key}`}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

export function App() {
  const server = useServerHealth();
  const [values, setValues] = useState<ParamValues>({});

  // The mutation layer runs on every change. It is memoized on `values`,
  // and useMemo keeps the inputProps object stable for the Player.
  const lottie = useMemo(() => applyLottieValues(sourceLottie, values, schema), [values]);
  const inputProps = useMemo<MainProps>(() => ({ background: BACKGROUND, lottie }), [lottie]);
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

      <Harness values={values} onChange={setValues} />

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
