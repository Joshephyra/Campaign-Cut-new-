import type { TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from './Inspector';

afterEach(cleanup);

/** M25: "Reset to authored" appears only when a value differs from the designer's default, and restores it. */
const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'AUTHORED', path: '/layers/0' },
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#FF0000', path: '/layers/1/shapes/0/it/1' },
];

describe('Inspector reset to authored', () => {
  it('shows a reset only for values that differ from the default', () => {
    render(<Inspector schema={schema} values={{ headline: 'VOTE', accent: '#FF0000' }} onChange={() => {}} />);
    expect(screen.getByLabelText('Reset Headline to authored')).toBeTruthy();
    expect(screen.queryByLabelText('Reset Accent colour to authored')).toBeNull();
  });

  it('restores the default', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ headline: 'VOTE', accent: '#00FF00' }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Reset Accent colour to authored'));
    expect(onChange).toHaveBeenCalledWith({ headline: 'VOTE', accent: '#FF0000' });
  });
});
