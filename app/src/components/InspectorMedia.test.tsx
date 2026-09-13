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

  it('lets the user pick footage from the uploaded clips and choose fit', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{}} onChange={onChange} assets={assets} templateSlug="t" />);
    fireEvent.change(screen.getByLabelText('Footage'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith({ mediaFill: { assetId: 4, fit: 'cover' } });
  });

  it('shows the chosen clip and switches fit to contain', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ mediaFill: { assetId: 4, fit: 'cover' } }} onChange={onChange} assets={assets} templateSlug="t" />);
    expect((screen.getByLabelText('Footage') as HTMLSelectElement).value).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: /contain/i }));
    expect(onChange).toHaveBeenCalledWith({ mediaFill: { assetId: 4, fit: 'contain' } });
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

  it('turning the key on stores the default key; the sliders adjust threshold and spill; off clears it', () => {
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
    fireEvent.change(screen.getByLabelText(/screen colour/i), { target: { value: 'blue' } });
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover', key: { color: 'blue', threshold: 0.5, spill: 0.3 } } });
    fireEvent.click(screen.getByLabelText(/key out/i));
    expect(onChange).toHaveBeenLastCalledWith({ mediaFill: { assetId: 4, fit: 'cover' } });
  });
});
