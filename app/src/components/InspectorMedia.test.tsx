import type { TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from './Inspector';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const schema: TemplateParam[] = [
  { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
  { key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/2' },
];

const assets = [
  { id: 4, kind: 'video' as const, originalName: 'rally.mp4', originalUrl: '/media/originals/4.mp4', proxyUrl: '/media/proxies/4.mp4', thumbUrl: '/media/thumbs/4.jpg', width: 1920, height: 1080, durationS: 5, fps: 30 },
];

describe('Inspector: image and media params', () => {
  it('uploads a logo image and emits its server URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ url: '/media/images/9-logo.png' }), { status: 201 }));
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{}} onChange={onChange} assets={assets} templateSlug="t" />);
    const file = new File([new Uint8Array([1])], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('image-file-logo'), { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ logo: '/media/images/9-logo.png' }));
  });

  it('shows the current logo, resolving a template-relative default against the template folder', () => {
    render(<Inspector schema={schema} values={{}} onChange={() => {}} assets={assets} templateSlug="t" />);
    expect(screen.getByTestId('image-preview-logo').getAttribute('src')).toBe('/api/templates/t/images/logo.png');
  });

  /** M29: the Footage panel's thumbnails are the picker; the inspector shows what was picked. No select. */
  it('with no clip, points at the Footage panel and offers no select', () => {
    render(<Inspector schema={schema} values={{}} onChange={() => {}} assets={assets} templateSlug="t" />);
    expect(screen.getByTestId('param-mediaFill').textContent).toMatch(/pick a clip in footage/i);
    expect(document.querySelector('select')).toBeNull();
    expect(screen.queryByRole('button', { name: /authored slot/i })).toBeNull();
  });

  it('shows the chosen clip as a card, switches fit to contain, and can go back to the authored slot', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ mediaFill: { assetId: 4, fit: 'cover' } }} onChange={onChange} assets={assets} templateSlug="t" />);
    const card = screen.getByTestId('footage-card');
    expect(card.textContent).toContain('rally.mp4');
    expect(card.querySelector('img')!.getAttribute('src')).toBe('/api/media/thumbs/4.jpg');
    fireEvent.click(screen.getByRole('button', { name: /letterbox/i }));
    expect(onChange).toHaveBeenCalledWith({ mediaFill: { assetId: 4, fit: 'contain' } });
    fireEvent.click(screen.getByRole('button', { name: /authored slot/i }));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: null });
  });
});

describe('Inspector: chroma key controls on a footage param', () => {
  const mediaOnly: TemplateParam[] = [{ key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/2' }];

  it('shows no key controls until a clip is chosen, then a "key out green screen" toggle', () => {
    const { rerender } = render(<Inspector schema={mediaOnly} values={{}} onChange={() => {}} assets={assets} templateSlug="t" />);
    expect(screen.queryByLabelText(/key out/i)).toBeNull();
    rerender(<Inspector schema={mediaOnly} values={{ mediaFill: { assetId: 4, fit: 'cover' } }} onChange={() => {}} assets={assets} templateSlug="t" />);
    expect((screen.getByLabelText(/key out/i) as HTMLInputElement).checked).toBe(false);
  });

  it('turning the key on stores the default key; the sliders adjust threshold and spill; the swatches pick the colour; off clears it', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Inspector schema={mediaOnly} values={{ mediaFill: { assetId: 4, fit: 'cover' } }} onChange={onChange} assets={assets} templateSlug="t" />,
    );
    fireEvent.click(screen.getByLabelText(/key out/i));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover', key: { color: 'green', threshold: 0.5, spill: 0.3 } } });

    rerender(
      <Inspector
        schema={mediaOnly}
        values={{ mediaFill: { assetId: 4, fit: 'cover', key: { color: 'green', threshold: 0.5, spill: 0.3 } } }}
        onChange={onChange}
        assets={assets}
        templateSlug="t"
      />,
    );
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: '0.7' } });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover', key: { color: 'green', threshold: 0.7, spill: 0.3 } } });
    fireEvent.change(screen.getByLabelText(/spill/i), { target: { value: '0.1' } });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover', key: { color: 'green', threshold: 0.5, spill: 0.1 } } });
    const swatches = screen.getByRole('group', { name: 'Screen colour' });
    expect(swatches.querySelector('select')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover', key: { color: 'blue', threshold: 0.5, spill: 0.3 } } });
    fireEvent.click(screen.getByLabelText(/key out/i));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover' } });
  });
});
