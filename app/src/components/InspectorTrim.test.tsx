import type { TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '../api';
import { Inspector } from './Inspector';

afterEach(cleanup);

/** M20: a chosen clip can be trimmed (start and end, seconds) and its own sound muted. */
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

describe('Inspector footage trim', () => {
  it('shows start, end and mute for a chosen clip, with the clip length, and nothing without one', () => {
    render(<Inspector schema={schema} values={{ mediaFill: { assetId: 1, fit: 'cover' } }} onChange={() => {}} assets={[clip]} />);
    expect((screen.getByLabelText('Footage start') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('Footage end') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Mute footage sound') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/clip is 10\.0 s/i)).toBeTruthy();
    cleanup();
    render(<Inspector schema={schema} values={{ mediaFill: null }} onChange={() => {}} assets={[clip]} />);
    expect(screen.queryByLabelText('Footage start')).toBeNull();
  });

  it('reports trim and mute inside the footage value, keeping fit and key', () => {
    const onChange = vi.fn();
    const value = { assetId: 1, fit: 'contain', key: { color: 'green', threshold: 0.5, spill: 0.3 } };
    render(<Inspector schema={schema} values={{ mediaFill: value }} onChange={onChange} assets={[clip]} />);
    fireEvent.change(screen.getByLabelText('Footage start'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, inS: 1.5 } });
    fireEvent.change(screen.getByLabelText('Footage end'), { target: { value: '4' } });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, outS: 4 } });
    fireEvent.click(screen.getByLabelText('Mute footage sound'));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { ...value, muted: true } });
  });

  it('shows saved trim values', () => {
    render(<Inspector schema={schema} values={{ mediaFill: { assetId: 1, fit: 'cover', inS: 2, outS: 6.5, muted: true } }} onChange={() => {}} assets={[clip]} />);
    expect((screen.getByLabelText('Footage start') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Footage end') as HTMLInputElement).value).toBe('6.5');
    expect((screen.getByLabelText('Mute footage sound') as HTMLInputElement).checked).toBe(true);
  });
});

describe('Inspector footage choices (M20)', () => {
  it('offers only video assets for the footage slot, never audio tracks', () => {
    const bed: MediaAsset = { id: 9, kind: 'audio', originalName: 'bed.wav', originalUrl: '/media/originals/bed.wav', proxyUrl: '/media/originals/bed.wav', thumbUrl: null, width: 0, height: 0, durationS: 2, fps: 0 };
    render(<Inspector schema={schema} values={{ mediaFill: null }} onChange={() => {}} assets={[bed, clip]} />);
    const select = screen.getByLabelText('Footage') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['None (authored slot)', 'rally.mp4']);
  });
});
