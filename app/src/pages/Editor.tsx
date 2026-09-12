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
import { api, type ProjectDetail } from '../api';

const BACKGROUND = '#000000';

type Props = {
  projectId: number;
  onBack: () => void;
};

type Loaded = { detail: ProjectDetail; lottie: LottieAnimationData };

export function Editor({ projectId, onBack }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ParamValues>({});

  useEffect(() => {
    let cancelled = false;
    api
      .project(projectId)
      .then(async (detail) => {
        const lottie = await api.templateLottie(detail.template.slug);
        if (cancelled) return;
        const initial: ParamValues = {};
        for (const v of detail.values) initial[v.key] = v.value;
        setValues(initial);
        setLoaded({ detail, lottie });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <main className="min-h-screen bg-ink text-fg flex flex-col">
      <header className="border-b border-hairline px-8 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="text-xs text-muted hover:text-fg">
            ← Library
          </button>
          <h1 className="text-sm font-semibold tracking-tight">{loaded?.detail.project.name ?? '…'}</h1>
        </div>
        <span className="font-mono text-xs text-muted">{loaded ? loaded.detail.template.slug : `project ${projectId}`}</span>
      </header>

      {error && <p className="font-mono text-xs text-danger p-8">Could not open the project: {error}</p>}
      {!loaded && !error && <p className="font-mono text-xs text-muted p-8">Loading…</p>}
      {loaded && <EditorBody loaded={loaded} values={values} onChange={setValues} />}
    </main>
  );
}

function EditorBody({ loaded, values, onChange }: { loaded: Loaded; values: ParamValues; onChange: (v: ParamValues) => void }) {
  const { detail, lottie: source } = loaded;
  const schema = detail.schema;

  const lottie = useMemo(() => applyLottieValues(source, values, schema), [source, values, schema]);
  const inputProps = useMemo<MainProps>(() => ({ background: BACKGROUND, lottie }), [lottie]);
  const durationInFrames = lottieDurationInFrames(lottie, compositionConfig.fps);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Program monitor. Nothing ever overlays this. */}
      <section className="flex-1 p-8 min-w-0">
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
        <p className="font-mono text-xs text-muted mt-3">
          {compositionConfig.width}×{compositionConfig.height} · {compositionConfig.fps} fps · {durationInFrames} frames
        </p>
      </section>

      {/* Inspector. M6 generates the real controls from the schema; this is the M2 harness in its place. */}
      <aside className="w-80 border-l border-hairline p-6 shrink-0">
        <h2 className="text-xs uppercase tracking-widest text-muted mb-4">Inspector</h2>
        <Harness schema={schema} values={values} onChange={onChange} />
      </aside>
    </div>
  );
}

function Harness({ schema, values, onChange }: { schema: TemplateParam[]; values: ParamValues; onChange: (v: ParamValues) => void }) {
  return (
    <div className="flex flex-col gap-4 font-mono text-xs">
      {schema.map((param) => {
        const value = String(values[param.key] ?? param.default ?? '');
        const set = (v: string) => onChange({ ...values, [param.key]: v });
        return (
          <label key={param.key} className="flex flex-col gap-1">
            <span className="text-muted">{param.label}</span>
            <div className="flex gap-2">
              {param.kind === 'color' && (
                <input
                  type="color"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="h-8 w-10 bg-transparent border border-hairline"
                  data-testid={`harness-${param.key}-swatch`}
                />
              )}
              <input
                type="text"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="flex-1 bg-panel border border-hairline px-2 py-1 text-fg focus:outline-none focus:border-cobalt"
                data-testid={`harness-${param.key}`}
              />
            </div>
          </label>
        );
      })}
    </div>
  );
}
