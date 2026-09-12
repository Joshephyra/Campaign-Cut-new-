import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timeline, type TimelineElement } from './Timeline';

afterEach(cleanup);

const elements: TimelineElement[] = [
  { id: 1, slug: 'open', zIndex: 0, startFrame: 0, endFrame: 150, enabled: true },
  { id: 2, slug: 'end-card', zIndex: 1, startFrame: 150, endFrame: 300, enabled: true },
];

/** jsdom has no layout; give the track a known width so pixel deltas map to frames. */
function mockTrackWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: width, bottom: 20, width, height: 20, toJSON: () => ({}),
  } as DOMRect);
}

describe('Timeline', () => {
  it('shows one row per element, top of the stack first, with in/out timecodes in mono', () => {
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} />);
    const rows = screen.getAllByTestId(/^element-row-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('end-card');
    expect(rows[1]!.textContent).toContain('open');
    expect(screen.getByText('00:05:00 – 00:10:00')).toBeTruthy();
  });

  it('shows the playhead timecode', () => {
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={95} onSeek={() => {}} onChange={() => {}} />);
    expect(screen.getByTestId('playhead-timecode').textContent).toBe('00:03:05');
  });

  it('toggling an element off reports enabled: false', () => {
    const onChange = vi.fn();
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Toggle open'));
    expect(onChange).toHaveBeenCalledWith(1, { enabled: false });
  });

  it('clicking the ruler seeks to that frame', () => {
    mockTrackWidth(300); // 300px for 300 frames: 1px per frame
    const onSeek = vi.fn();
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={onSeek} onChange={() => {}} />);
    fireEvent.pointerDown(screen.getByTestId('ruler'), { clientX: 120, buttons: 1 });
    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('dragging a bar moves the element in time, keeping its length', () => {
    mockTrackWidth(300);
    const onChange = vi.fn();
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={onChange} />);
    const bar = screen.getByTestId('element-bar-1');
    fireEvent.pointerDown(bar, { clientX: 50, buttons: 1 });
    fireEvent.pointerMove(bar, { clientX: 80, buttons: 1 });
    fireEvent.pointerUp(bar, { clientX: 80 });
    expect(onChange).toHaveBeenLastCalledWith(1, { startFrame: 30, endFrame: 180 });
  });

  it('never drags an element before frame 0', () => {
    mockTrackWidth(300);
    const onChange = vi.fn();
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={onChange} />);
    const bar = screen.getByTestId('element-bar-1');
    fireEvent.pointerDown(bar, { clientX: 50, buttons: 1 });
    fireEvent.pointerMove(bar, { clientX: 10, buttons: 1 });
    fireEvent.pointerUp(bar, { clientX: 10 });
    expect(onChange).toHaveBeenLastCalledWith(1, { startFrame: 0, endFrame: 150 });
  });
});
