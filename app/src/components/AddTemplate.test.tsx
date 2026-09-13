import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddTemplate } from './AddTemplate';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** M24: ingest a handover folder from the browser; the files travel with their paths inside the folder. */
function pickedFiles(): File[] {
  const make = (rel: string, bytes: string) => {
    const f = new File([bytes], rel.split('/').pop()!, { type: 'application/octet-stream' });
    Object.defineProperty(f, 'webkitRelativePath', { value: rel });
    return f;
  };
  return [make('Three Part/elements.json', '[]'), make('Three Part/01-open/data.json', '{}'), make('Three Part/fonts/IBMPlexSans-Regular.ttf', 'ttf')];
}

function mockApi(answer: unknown, status = 200) {
  const calls: { url: string; body: FormData }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    calls.push({ url: String(input), body: init?.body as FormData });
    return new Response(JSON.stringify(answer), { status });
  });
  return calls;
}

async function fillAndSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /From an After Effects export/ }));
  fireEvent.change(screen.getByTestId('handover-input'), { target: { files: pickedFiles() } });
  fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Three Part' } });
  fireEvent.change(screen.getByLabelText('Ad type'), { target: { value: 'Contrast' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingest' }));
}

describe('AddTemplate', () => {
  it('sends every file with its path inside the folder, plus the name and ad type, and reports success', async () => {
    const calls = mockApi({ ok: true, slug: 'three', output: 'Ingested "Three Part" as three' });
    const onIngested = vi.fn();
    render(<AddTemplate onIngested={onIngested} />);
    await fillAndSubmit();
    await waitFor(() => expect(onIngested).toHaveBeenCalledWith('three'));
    expect(calls[0]!.url).toBe('/api/templates/ingest');
    const body = calls[0]!.body;
    expect(body.get('name')).toBe('Three Part');
    expect(body.get('adType')).toBe('Contrast');
    const sent = body.getAll('file') as File[];
    expect(sent.map((f) => f.name)).toEqual(['Three Part/elements.json', 'Three Part/01-open/data.json', 'Three Part/fonts/IBMPlexSans-Regular.ttf']);
    expect(screen.getByText(/Ingested "three"/)).toBeTruthy();
  });

  it('shows every problem when the ingest rejects the folder', async () => {
    mockApi({ ok: false, output: 'Ingest rejected. 2 problems.\n  - Element "open": bad tag\n  - Font "X" missing', problems: ['Element "open": bad tag', 'Font "X" missing'] }, 400);
    const onIngested = vi.fn();
    render(<AddTemplate onIngested={onIngested} />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByTestId('ingest-problems')).toBeTruthy());
    expect(screen.getByText('Element "open": bad tag')).toBeTruthy();
    expect(screen.getByText('Font "X" missing')).toBeTruthy();
    expect(onIngested).not.toHaveBeenCalled();
  });

  it('keeps Ingest disabled until a folder, a name and an ad type are given', () => {
    mockApi({});
    render(<AddTemplate onIngested={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /From an After Effects export/ }));
    const button = screen.getByRole('button', { name: 'Ingest' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('handover-input'), { target: { files: pickedFiles() } });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'X' } });
    expect(button.disabled).toBe(false);
  });
});
