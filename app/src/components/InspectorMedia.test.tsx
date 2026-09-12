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
  { id: 4, originalName: 'rally.mp4', originalUrl: '/media/originals/4.mp4', proxyUrl: '/media/proxies/4.mp4', thumbUrl: '/media/thumbs/4.jpg', width: 1920, height: 1080, durationS: 5, fps: 30 },
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
