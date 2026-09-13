import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Label and action for the way out, e.g. back to the library. */
  escapeLabel: string;
  onEscape: () => void;
};

type State = { error: Error | null };

/**
 * M25: a thrown render error shows what happened and a way out instead of
 * a blank page. Nothing overlays the monitor: the boundary replaces the
 * whole editor when it trips.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('CampaignCut editor crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="min-h-screen bg-ink text-fg p-8 flex flex-col gap-4 max-w-3xl">
        <h1 className="text-sm font-semibold tracking-tight">Something went wrong in the editor</h1>
        <p className="font-mono text-xs text-danger whitespace-pre-wrap">{this.state.error.message}</p>
        <p className="font-mono text-xs text-muted">Your last saved changes are safe on the server. Reload the page to try again, or go back.</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => window.location.reload()} className="border border-hairline px-3 py-1 font-mono text-xs hover:border-cobalt">
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              this.props.onEscape();
            }}
            className="border border-hairline px-3 py-1 font-mono text-xs hover:border-cobalt"
          >
            {this.props.escapeLabel}
          </button>
        </div>
      </main>
    );
  }
}
