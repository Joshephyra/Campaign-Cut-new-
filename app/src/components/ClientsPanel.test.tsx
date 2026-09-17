import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../api';
import { ClientsPanel } from './ClientsPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * M33: the clients an agency keeps, in the library: name, logo, colours,
 * disclaimer. Add, edit, delete. No accounts behind them.
 */
const rivera: Client = { id: 1, name: 'Rivera for Senate', logoUrl: '/media/images/rivera.png', colors: { accent: '#1D4ED8', surface: '#0B1220' }, disclaimer: 'Paid for by Rivera for Senate', createdAt: '2026-09-17 10:00:00' };

describe('ClientsPanel', () => {
  it('lists clients with their colours and logo, and adds one from the form', async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn().mockResolvedValue({ ...rivera, id: 2, name: 'Ahmed for Mayor' });
    render(<ClientsPanel clients={[rivera]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} onChange={onChange} />);
    const row = screen.getByTestId('client-row-1');
    expect(row.textContent).toContain('Rivera for Senate');
    expect(row.textContent).toContain('Paid for by Rivera for Senate');
    expect(row.querySelector('img')!.getAttribute('src')).toBe('/api/media/images/rivera.png');

    fireEvent.click(screen.getByRole('button', { name: 'Add a client' }));
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Ahmed for Mayor' } });
    fireEvent.change(screen.getByLabelText('Accent colour'), { target: { value: '#B91C1C' } });
    fireEvent.change(screen.getByLabelText('Disclaimer'), { target: { value: 'Paid for by Ahmed for Mayor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save client' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: 'Ahmed for Mayor', logoUrl: '', colors: { accent: '#B91C1C' }, disclaimer: 'Paid for by Ahmed for Mayor' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('uploads a logo through the images route and keeps its URL on the client', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ url: '/media/images/9-ahmed.png' }), { status: 201 }));
    const onCreate = vi.fn().mockResolvedValue({ ...rivera, id: 2 });
    render(<ClientsPanel clients={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a client' }));
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Ahmed for Mayor' } });
    fireEvent.change(screen.getByTestId('client-logo-input'), { target: { files: [new File([new Uint8Array([1])], 'ahmed.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByTestId('client-logo-preview').getAttribute('src')).toBe('/api/media/images/9-ahmed.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Save client' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: '/media/images/9-ahmed.png' })));
  });

  it('edits a client in place and deletes behind a confirming press', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ...rivera, name: 'Rivera for US Senate' });
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ClientsPanel clients={[rivera]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={onDelete} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rivera for Senate' }));
    const name = screen.getByLabelText('Client name') as HTMLInputElement;
    expect(name.value).toBe('Rivera for Senate');
    expect((screen.getByLabelText('Accent colour') as HTMLInputElement).value).toBe('#1D4ED8');
    fireEvent.change(name, { target: { value: 'Rivera for US Senate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save client' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(1, { name: 'Rivera for US Senate', logoUrl: '/media/images/rivera.png', colors: { accent: '#1D4ED8', surface: '#0B1220' }, disclaimer: 'Paid for by Rivera for Senate' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete Rivera for Senate' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Really delete Rivera for Senate' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(1));
  });
});
