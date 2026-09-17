import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

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
      <main role="alert" className="min-h-screen bg-bg text-fg flex items-center justify-center p-8">
        <div className="w-full max-w-xl rounded-xl bg-panel border border-line p-6 flex flex-col gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Something went wrong in the editor</h1>
          <p className="text-xs text-red-ink whitespace-pre-wrap rounded-md bg-red-tint p-3">{this.state.error.message}</p>
          <p className="text-xs text-fg-2">Your last saved changes are safe on the server. Reload the page to try again, or go back.</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button
              onClick={() => {
                this.setState({ error: null });
                this.props.onEscape();
              }}
            >
              {this.props.escapeLabel}
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
