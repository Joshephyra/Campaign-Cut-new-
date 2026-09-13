import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M22: the project name in the editor header is editable in place. */
const lottie = { fr: 30, ip: 0, op: 60, w: 1920, h: 1080, layers: [{ ty: 5, nm: 'cc.headline', t: { d: { k: [{ s: { t: 'HI', f: 'X', s: 10 }, t: 0 }] } } }] };
const detail = {
  project: { id: 7, name: 'Demo project', templateId: 1, templateSlug: 'demo', templateName: 'Demo' },
  template: { id: 1, slug: 'demo', name: 'Demo', durationFrames: 60, fps: 30, width: 1920, height: 1080, thumbUrl: '' },
  elements: [{ id: 3, slug: 'demo', name: 'Demo', zIndex: 0, startFrame: 0, endFrame: 60, enabled: true, lottieUrl: '/templates/demo/template.json', schema: [{ key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'HI', path: '/layers/0' }] }],
  transitions: [],
  meta: { fonts: [], fontFiles: [] },
  audio: null,
  values: [{ elementId: 3, key: 'headline', value: 'HI' }],
};

describe('Editor project name', () => {
  it('renames the project from the header and saves it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/projects/7' && !init?.method) return new Response(JSON.stringify(detail), { status: 200 });
      if (url === '/api/projects/7' && init?.method === 'PATCH') return new Response(JSON.stringify({ ...detail.project, name: 'Final cut' }), { status: 200 });
      if (url === '/api/templates/demo/template.json') return new Response(JSON.stringify(lottie), { status: 200 });
      if (url === '/api/media') return new Response('[]', { status: 200 });
      return new Response('not found', { status: 404 });
    });
    render(<Editor projectId={7} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText('Rename project')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Rename project'));
    const input = screen.getByLabelText('Project name') as HTMLInputElement;
    expect(input.value).toBe('Demo project');
    fireEvent.change(input, { target: { value: 'Final cut' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Final cut'));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ name: 'Final cut' });
  });
});
