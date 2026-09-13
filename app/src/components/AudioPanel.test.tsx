import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '../api';
import { AudioPanel } from './AudioPanel';

afterEach(cleanup);

/** M20: one music bed per project: which track, how loud, where in the track to start. */
const bed: MediaAsset = { id: 9, kind: 'audio', originalName: 'bed.wav', originalUrl: '/media/originals/bed.wav', proxyUrl: '/media/originals/bed.wav', thumbUrl: null, width: 0, height: 0, durationS: 2, fps: 0 };
const clip: MediaAsset = { id: 1, kind: 'video', originalName: 'rally.mp4', originalUrl: '/media/originals/rally.mp4', proxyUrl: '/media/proxies/rally.mp4', thumbUrl: '/media/thumbs/rally.jpg', width: 1920, height: 1080, durationS: 10, fps: 30 };

describe('AudioPanel', () => {
  it('lists only audio assets and reports a chosen track at full volume from the start', () => {
    const onChange = vi.fn();
    render(<AudioPanel assets={[bed, clip]} audio={null} onChange={onChange} />);
    const select = screen.getByLabelText('Music bed') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['None', 'bed.wav']);
    fireEvent.change(select, { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith({ assetId: 9, volume: 1, inS: 0 });
    expect(screen.queryByLabelText('Music volume')).toBeNull();
  });

  it('with a track chosen, volume and start report changes and None clears it', () => {
    const onChange = vi.fn();
    render(<AudioPanel assets={[bed]} audio={{ assetId: 9, volume: 0.4, inS: 1 }} onChange={onChange} />);
    expect((screen.getByLabelText('Music volume') as HTMLInputElement).value).toBe('40');
    expect((screen.getByLabelText('Music start') as HTMLInputElement).value).toBe('1');
    fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '70' } });
    expect(onChange).toHaveBeenLastCalledWith({ assetId: 9, volume: 0.7, inS: 1 });
    fireEvent.change(screen.getByLabelText('Music start'), { target: { value: '0.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ assetId: 9, volume: 0.4, inS: 0.5 });
    fireEvent.change(screen.getByLabelText('Music bed'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('says so when no audio has been uploaded', () => {
    render(<AudioPanel assets={[clip]} audio={null} onChange={() => {}} />);
    expect(screen.getByText(/upload an mp3 or wav in the footage panel/i)).toBeTruthy();
  });
});
