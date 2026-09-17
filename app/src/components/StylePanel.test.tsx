import type { TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StylePanel, styleRoles } from './StylePanel';

afterEach(cleanup);

/**
 * M32: the spot's colours, one row per colour role across every scene.
 * Changing one recolours every scene that carries the role. A set of
 * colours can be saved as a named theme and applied to any spot.
 */
const color = (key: string, label: string, dflt: string): TemplateParam => ({ key, role: key, kind: 'color', label, default: dflt, path: '/layers/0' });
const elements = [
  { id: 3, name: 'Open', schema: [color('accent', 'Accent colour', '#F05929'), color('surface', 'Surface colour', '#0F1729'), { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'x', path: '/layers/1' } as TemplateParam] },
  { id: 4, name: 'End card', schema: [color('accent', 'Accent colour', '#F05929')] },
];

describe('styleRoles', () => {
  it('collects the colour roles across scenes with their current value, default and whether scenes disagree', () => {
    const roles = styleRoles(elements, { 3: { accent: '#112233', surface: '#0F1729' }, 4: {} });
    expect(roles).toEqual([
      { role: 'accent', label: 'Accent colour', value: '#112233', default: '#F05929', mixed: true, elementIds: [3, 4] },
      { role: 'surface', label: 'Surface colour', value: '#0F1729', default: '#0F1729', mixed: false, elementIds: [3] },
    ]);
  });
});

describe('StylePanel', () => {
  const themes = [{ id: 9, name: 'Union blue', colors: { accent: '#1D4ED8', surface: '#0B1220' }, createdAt: '2026-09-17 10:00:00' }];

  it('shows one swatch per role, and a valid hex applies to the whole spot', () => {
    const onApply = vi.fn();
    render(<StylePanel elements={elements} values={{ 3: {}, 4: {} }} themes={themes} onApply={onApply} onSaveTheme={vi.fn()} onDeleteTheme={vi.fn()} />);
    expect((screen.getByLabelText('Accent colour across the spot') as HTMLInputElement).value).toBe('#F05929');
    expect((screen.getByLabelText('Surface colour across the spot') as HTMLInputElement).value).toBe('#0F1729');
    fireEvent.change(screen.getByLabelText('Accent colour across the spot'), { target: { value: '#12' } });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Accent colour across the spot'), { target: { value: '#1d4ed8' } });
    expect(onApply).toHaveBeenCalledWith({ accent: '#1D4ED8' });
  });

  it('says when scenes disagree and offers a reset to the designer\'s colours per role', () => {
    const onApply = vi.fn();
    render(<StylePanel elements={elements} values={{ 3: { accent: '#112233' }, 4: {} }} themes={[]} onApply={onApply} onSaveTheme={vi.fn()} onDeleteTheme={vi.fn()} />);
    expect(screen.getByText(/scenes differ/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Reset Accent colour to the designer'));
    expect(onApply).toHaveBeenCalledWith({ accent: '#F05929' });
    expect(screen.queryByLabelText('Reset Surface colour to the designer')).toBeNull();
  });

  it('applies and deletes saved themes, and saves the current colours as a new theme by name', () => {
    const onApply = vi.fn();
    const onSaveTheme = vi.fn();
    const onDeleteTheme = vi.fn();
    render(<StylePanel elements={elements} values={{ 3: { accent: '#112233' }, 4: { accent: '#112233' } }} themes={themes} onApply={onApply} onSaveTheme={onSaveTheme} onDeleteTheme={onDeleteTheme} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply Union blue' }));
    expect(onApply).toHaveBeenCalledWith({ accent: '#1D4ED8', surface: '#0B1220' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Union blue' }));
    expect(onDeleteTheme).toHaveBeenCalledWith(9);

    fireEvent.click(screen.getByRole('button', { name: 'Save as theme' }));
    const name = screen.getByLabelText('Theme name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Rally red' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(onSaveTheme).toHaveBeenCalledWith('Rally red', { accent: '#112233', surface: '#0F1729' });
  });
});
