import type { TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '../api';
import { Inspector } from './Inspector';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M20 gave a chosen clip a start and an end in seconds; M29 makes them two
 * handles on a bar over the clip (dragged, or nudged with the arrow keys),
 * with the times shown beside it as facts. Mute stays a tick.
 */
const schema: TemplateParam[] = [{ key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/0' }];
const clip: MediaAsset = {
  id: 1,
  kind: 'video',
  originalName: 'rally.mp4',
  originalUrl: '/media/originals/rally.mp4',
  proxyUrl: '/media/proxies/rally.mp4',
  thumbUrl: '/media/thumbs/rally.jpg',
  width: 1920,
  height: 1080,
  durationS: 10,
  fps: 30,
};

/** jsdom has no layout: the trim bar is 200 px wide, so 20 px is one second of a 10 s clip. */
function mockBarWidth() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 12, width: 200, height: 12, toJSON: () => ({}),
  } as DOMRect);
}

describe('Inspector footage trim', () => {
  it('shows two handles over the whole clip, the times as facts, and mute; nothing without a clip', () => {
    render(<Inspector schema={schema} values={{ mediaFill: { assetId: 1, fit: 'cover' } }} onChange={() => {}} assets={[clip]} />);
    const start = screen.getByRole('slider', { name: 'Footage start' });
    const end = screen.getByRole('slider', { name: 'Footage end' });
    expect(start.getAttribute('aria-valuenow')).toBe('0');
    expect(end.getAttribute('aria-valuenow')).toBe('10');
    expect(end.getAttribute('aria-valuemax')).toBe('10');
    expect(screen.getByText(/0\.0 s – 10\.0 s of 10\.0 s/)).toBeTruthy();
    expect((screen.getByLabelText('Mute footage sound') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    cleanup();
    render(<Inspector schema={schema} values={{ mediaFill: null }} onChange={() => {}} assets={[clip]} />);
    expect(screen.queryByRole('slider', { name: 'Footage start' })).toBeNull();
  });

  it('a press on the bar moves the nearer handle there; arrow keys nudge a handle by 0.1 s, 1 s with Shift; mute is kept inside the value', () => {
    mockBarWidth();
    const onChange = vi.fn();
    const value = { assetId: 1, fit: 'contain', key: { color: 'green', threshold: 0.5, spill: 0.3 } };
    render(<Inspector schema={schema} values={{ mediaFill: value }} onChange={onChange} assets={[clip]} />);
    fireEvent.pointerDown(screen.getByTestId('trim-bar'), { clientX: 30, buttons: 1, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, inS: 1.5 } });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Footage end' }), { key: 'ArrowLeft', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, outS: 9 } });
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Footage start' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, inS: 0.1 } });
    fireEvent.click(screen.getByLabelText('Mute footage sound'));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, muted: true } });
  });

  it('shows saved trim values and never lets the handles cross', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ mediaFill: { assetId: 1, fit: 'cover', inS: 2, outS: 2.1, muted: true } }} onChange={onChange} assets={[clip]} />);
    expect(screen.getByRole('slider', { name: 'Footage start' }).getAttribute('aria-valuenow')).toBe('2');
    expect(screen.getByRole('slider', { name: 'Footage end' }).getAttribute('aria-valuenow')).toBe('2.1');
    expect(screen.getByText(/2\.0 s – 2\.1 s of 10\.0 s/)).toBeTruthy();
    expect((screen.getByLabelText('Mute footage sound') as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Footage start' }), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
