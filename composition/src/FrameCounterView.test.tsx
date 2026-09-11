import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatTimecode, FrameCounterView } from './FrameCounterView';

afterEach(cleanup);

// T2: the pure view shows the frame it is given and paints the background prop.
describe('FrameCounterView', () => {
  it('shows the current frame number', () => {
    render(<FrameCounterView frame={42} fps={30} background="#123456" />);
    expect(screen.getByTestId('frame-number').textContent).toBe('42');
  });

  it('applies the background colour prop to the full-frame wrapper', () => {
    render(<FrameCounterView frame={0} fps={30} background="#123456" />);
    const wrapper = screen.getByTestId('frame-counter');
    expect(wrapper.style.backgroundColor).toBe('rgb(18, 52, 86)');
  });

  it('shows a timecode derived from frame and fps', () => {
    render(<FrameCounterView frame={95} fps={30} background="#000000" />);
    expect(screen.getByTestId('timecode').textContent).toBe('00:03:05');
  });
});

describe('formatTimecode', () => {
  it('formats frame 0 as 00:00:00', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00');
  });

  it('rolls frames into seconds and seconds into minutes', () => {
    expect(formatTimecode(29, 30)).toBe('00:00:29');
    expect(formatTimecode(30, 30)).toBe('00:01:00');
    expect(formatTimecode(30 * 60 + 5, 30)).toBe('01:00:05');
  });
});
