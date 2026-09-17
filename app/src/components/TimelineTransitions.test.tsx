import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timeline, type TimelineElement } from './Timeline';

afterEach(cleanup);

const two: TimelineElement[] = [
  { id: 1, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150, enabled: true },
  { id: 2, slug: 'end-card', zIndex: 1, startFrame: 150, endFrame: 300, enabled: true },
];

const pressed = (group: HTMLElement) =>
  Array.from(group.querySelectorAll('button'))
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);

/** M29: the transition on a boundary is a segmented row (Cut, Fade, Wipe, Slide) and a length slider shown in seconds. No select, no frame count to type. */
describe('Timeline transitions', () => {
  it('shows one transition row per boundary between consecutive elements, none for a single element', () => {
    const { unmount } = render(
      <Timeline elements={two} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={() => {}} />,
    );
    expect(screen.getAllByTestId(/^transition-after-/)).toHaveLength(1);
    expect(pressed(screen.getByRole('group', { name: 'Transition after open' }))).toEqual(['Cut']);
    unmount();

    render(<Timeline elements={[two[0]!]} fps={30} durationInFrames={150} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={() => {}} />);
    expect(screen.queryAllByTestId(/^transition-after-/)).toHaveLength(0);
  });

  it('offers Cut, Fade, Wipe and Slide as buttons, and no select', () => {
    render(<Timeline elements={two} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Transition after open' });
    expect(Array.from(group.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Cut', 'Fade', 'Wipe', 'Slide']);
    expect(document.querySelector('select')).toBeNull();
  });

  it('pressing a preset reports it with the default length', () => {
    const onTransitionChange = vi.fn();
    render(<Timeline elements={two} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={onTransitionChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fade' }));
    expect(onTransitionChange).toHaveBeenCalledWith(1, { preset: 'fade', durationInFrames: 15 });
    expect(screen.queryByLabelText('Transition length after open')).toBeNull(); // a cut has no length
  });

  it('shows the stored transition, its length as a slider in seconds, and reports a new length in frames', () => {
    const onTransitionChange = vi.fn();
    render(
      <Timeline
        elements={two}
        fps={30}
        durationInFrames={285}
        frame={0}
        onSeek={() => {}}
        onChange={() => {}}
        transitions={[{ afterElementId: 1, preset: 'wipe', durationInFrames: 15 }]}
        onTransitionChange={onTransitionChange}
      />,
    );
    expect(pressed(screen.getByRole('group', { name: 'Transition after open' }))).toEqual(['Wipe']);
    const length = screen.getByLabelText('Transition length after open') as HTMLInputElement;
    expect(length.type).toBe('range');
    expect(length.value).toBe('15');
    expect(screen.getByText('0.5 s')).toBeTruthy();
    fireEvent.change(length, { target: { value: '30' } });
    expect(onTransitionChange).toHaveBeenCalledWith(1, { preset: 'wipe', durationInFrames: 30 });
  });
});
