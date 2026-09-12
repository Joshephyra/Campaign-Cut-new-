import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timeline, type TimelineElement } from './Timeline';

afterEach(cleanup);

const two: TimelineElement[] = [
  { id: 1, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150, enabled: true },
  { id: 2, slug: 'end-card', zIndex: 1, startFrame: 150, endFrame: 300, enabled: true },
];

describe('Timeline transitions', () => {
  it('shows one transition control per boundary between consecutive elements, none for a single element', () => {
    const { unmount } = render(
      <Timeline elements={two} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={() => {}} />,
    );
    expect(screen.getAllByTestId(/^transition-after-/)).toHaveLength(1);
    expect((screen.getByLabelText('Transition after open') as HTMLSelectElement).value).toBe('cut');
    unmount();

    render(<Timeline elements={[two[0]!]} fps={30} durationInFrames={150} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={() => {}} />);
    expect(screen.queryAllByTestId(/^transition-after-/)).toHaveLength(0);
  });

  it('offers cut, fade, wipe and slide', () => {
    render(<Timeline elements={two} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={() => {}} />);
    const options = Array.from((screen.getByLabelText('Transition after open') as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(['cut', 'fade', 'wipe', 'slide']);
  });

  it('picking a preset reports it with the default length', () => {
    const onTransitionChange = vi.fn();
    render(<Timeline elements={two} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} transitions={[]} onTransitionChange={onTransitionChange} />);
    fireEvent.change(screen.getByLabelText('Transition after open'), { target: { value: 'fade' } });
    expect(onTransitionChange).toHaveBeenCalledWith(1, { preset: 'fade', durationInFrames: 15 });
  });

  it('shows the stored transition and lets the length be changed', () => {
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
    expect((screen.getByLabelText('Transition after open') as HTMLSelectElement).value).toBe('wipe');
    fireEvent.change(screen.getByLabelText('Transition length after open'), { target: { value: '30' } });
    expect(onTransitionChange).toHaveBeenCalledWith(1, { preset: 'wipe', durationInFrames: 30 });
  });
});
