import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rulerInterval, Timeline, type TimelineElement } from './Timeline';

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
  it('shows one row per element, top of the stack first; the bar carries the name and its in/out timecodes as a title', () => {
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} />);
    const rows = screen.getAllByTestId(/^element-row-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('end-card');
    expect(rows[1]!.textContent).toContain('open');
    const bar = screen.getByTestId('element-bar-2');
    expect(bar.textContent).toContain('end-card');
    expect(bar.getAttribute('title')).toBe('00:05:00 – 00:10:00');
    expect(screen.queryByText('00:05:00 – 00:10:00')).toBeNull();
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

/**
 * M29: ruler labels are spaced by the track's real width so they never
 * run into each other: at least 56 px between labels, from 1 s steps up
 * to a minute. Without a measurement (first paint), at most a dozen labels.
 */
describe('Timeline ruler spacing (M29)', () => {
  it('picks the step from the seconds per pixel', () => {
    expect(rulerInterval(5, 1000)).toBe(1);
    expect(rulerInterval(10, 300)).toBe(2);
    expect(rulerInterval(30, 450)).toBe(5);
    expect(rulerInterval(120, 450)).toBe(15);
    expect(rulerInterval(30, 0)).toBe(5);
    expect(rulerInterval(600, 0)).toBe(60);
  });

  it('labels a 10 s track 300 px wide every 2 s', () => {
    mockTrackWidth(300);
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} />);
    expect(screen.getAllByTestId('ruler-label').map((n) => n.textContent)).toEqual(['0s', '2s', '4s', '6s', '8s', '10s']);
  });
});

describe('Timeline selection (M17)', () => {
  it('clicking an element name selects it and the selected row is marked', () => {
    const onSelect = vi.fn();
    render(<Timeline elements={elements} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} selectedId={1} onSelect={onSelect} />);
    expect(screen.getByTestId('element-row-1').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('element-row-2').getAttribute('data-selected')).toBe('false');
    fireEvent.click(screen.getByLabelText('Select end-card'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('shows an element name when it has one, else its slug', () => {
    const named = elements.map((e) => (e.id === 2 ? { ...e, name: 'End card' } : e));
    render(<Timeline elements={named} fps={30} durationInFrames={300} frame={0} onSeek={() => {}} onChange={() => {}} />);
    expect(screen.getByLabelText('Select End card')).toBeTruthy();
    expect(screen.getByLabelText('Select open')).toBeTruthy();
  });
});
