import { DEFAULT_TRANSFORM, type TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from './Inspector';

afterEach(cleanup);

/**
 * M18: a text or image control carries a Placement row (X, Y, Scale,
 * Rotation, Reset) driven by its `<key>.transform` param. X and Y are shown
 * as percent of the frame and stored as fractions.
 */
const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'Hi', path: '/layers/0' },
  { key: 'headline.transform', role: 'headline', kind: 'transform', label: 'Headline placement', default: DEFAULT_TRANSFORM, path: '/layers/0', for: 'headline' },
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#FF0000', path: '/layers/1/shapes/0/it/1' },
];

describe('Inspector placement control', () => {
  it('renders X, Y, Scale and Rotation under the parent control, and nothing for a colour', () => {
    render(<Inspector schema={schema} values={{ headline: 'Hi' }} onChange={() => {}} />);
    const block = screen.getByTestId('param-headline');
    expect(block.contains(screen.getByLabelText('Headline X'))).toBe(true);
    expect(block.contains(screen.getByLabelText('Headline Y'))).toBe(true);
    expect(block.contains(screen.getByLabelText('Headline scale'))).toBe(true);
    expect(block.contains(screen.getByLabelText('Headline rotation'))).toBe(true);
    expect(screen.queryByLabelText('Accent colour X')).toBeNull();
    // there is no separate top-level control for the transform param
    expect(screen.queryByTestId('param-headline.transform')).toBeNull();
    expect((screen.getByLabelText('Headline X') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('Headline scale') as HTMLInputElement).value).toBe('100');
  });

  it('shows a saved transform as percent and degrees', () => {
    render(<Inspector schema={schema} values={{ headline: 'Hi', 'headline.transform': { x: 0.125, y: -0.05, scale: 1.5, rotation: -7 } }} onChange={() => {}} />);
    expect((screen.getByLabelText('Headline X') as HTMLInputElement).value).toBe('12.5');
    expect((screen.getByLabelText('Headline Y') as HTMLInputElement).value).toBe('-5');
    expect((screen.getByLabelText('Headline scale') as HTMLInputElement).value).toBe('150');
    expect((screen.getByLabelText('Headline rotation') as HTMLInputElement).value).toBe('-7');
  });

  it('editing X reports a fraction, keeping the other fields', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ headline: 'Hi', 'headline.transform': { x: 0, y: 0, scale: 1.5, rotation: 0 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Headline X'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith({ headline: 'Hi', 'headline.transform': { x: 0.1, y: 0, scale: 1.5, rotation: 0 } });
    fireEvent.change(screen.getByLabelText('Headline scale'), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ headline: 'Hi', 'headline.transform': { x: 0, y: 0, scale: 0.8, rotation: 0 } });
  });

  it('Reset restores the identity', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ headline: 'Hi', 'headline.transform': { x: 0.2, y: 0.1, scale: 2, rotation: 45 } }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Reset Headline placement'));
    expect(onChange).toHaveBeenCalledWith({ headline: 'Hi', 'headline.transform': DEFAULT_TRANSFORM });
  });

  it('offers a drag-on-monitor toggle that reports which layer to drag', () => {
    const onDragKey = vi.fn();
    render(<Inspector schema={schema} values={{ headline: 'Hi' }} onChange={() => {}} dragKey={null} onDragKey={onDragKey} />);
    const toggle = screen.getByLabelText('Drag Headline on monitor');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onDragKey).toHaveBeenCalledWith('headline.transform');
  });
});
