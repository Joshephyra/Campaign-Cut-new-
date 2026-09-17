import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Section } from './ui';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* no storage */
  }
});

/** M53: a section with an id folds from its title and is remembered per browser; its action stays live while folded. */
describe('Section', () => {
  it('folds and unfolds from its title, keeps the action, and remembers the fold', () => {
    const { unmount } = render(
      <Section id="footage" title="Footage" action={<button type="button">Upload</button>}>
        <p>the clips</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: 'Footage' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('the clips')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByText('the clips')).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    unmount();
    render(
      <Section id="footage" title="Footage">
        <p>the clips</p>
      </Section>,
    );
    expect(screen.queryByText('the clips')).toBeNull(); // remembered
    fireEvent.click(screen.getByRole('button', { name: 'Footage' }));
    expect(screen.getByText('the clips')).toBeTruthy();
  });

  it('without an id it is a plain titled block', () => {
    render(
      <Section title="Exports">
        <p>none yet</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: 'Exports' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
