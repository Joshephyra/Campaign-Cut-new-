import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): never {
  throw new Error('Lottie layer 7 exploded');
}

describe('ErrorBoundary (M25)', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary escapeLabel="Back to library" onEscape={() => {}}>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('shows the error and a way out when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onEscape = vi.fn();
    render(
      <ErrorBoundary escapeLabel="Back to library" onEscape={onEscape}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Lottie layer 7 exploded');
    fireEvent.click(screen.getByRole('button', { name: 'Back to library' }));
    expect(onEscape).toHaveBeenCalled();
  });
});
