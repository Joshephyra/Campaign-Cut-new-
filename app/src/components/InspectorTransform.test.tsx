import { DEFAULT_TRANSFORM, type TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from './Inspector';

afterEach(cleanup);

/**
 * M28: a text or image control carries a Placement row driven by its
 * `<key>.transform` param: a hint to drag on the monitor, a Size slider, a
 * Tilt slider and Reset. Position is never typed; it is dragged (M18 gave
 * it X and Y fields, Josh sent them back).
 */
const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'Hi', path: '/layers/0' },
  { key: 'headline.transform', role: 'headline', kind: 'transform', label: 'Headline placement', default: DEFAULT_TRANSFORM, path: '/layers/0', for: 'headline' },
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#FF0000', path: '/layers/1/shapes/0/it/1' },
];

describe('Inspector placement control', () => {
  it('renders Size and Tilt sliders and a drag hint under the parent control, nothing for a colour, no number fields', () => {
    render(<Inspector schema={schema} values={{ headline: 'Hi' }} onChange={() => {}} />);
    {
      const fold = screen.getByRole('button', { name: /^Headline placement/ });
      if (fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold); // M66: folded until asked for
    }
    const block = screen.getByTestId('param-headline');
    const size = screen.getByLabelText('Headline size') as HTMLInputElement;
    const tilt = screen.getByLabelText('Headline tilt') as HTMLInputElement;
    expect(block.contains(size)).toBe(true);
    expect(block.contains(tilt)).toBe(true);
    expect(size.type).toBe('range');
    expect(tilt.type).toBe('range');
    expect(size.value).toBe('100');
    expect(tilt.value).toBe('0');
    expect(block.textContent).toMatch(/drag it on the video/i);
    expect(screen.queryByLabelText('Headline X')).toBeNull();
    expect(screen.queryByLabelText('Headline Y')).toBeNull();
    expect(screen.queryByLabelText(/drag headline on monitor/i)).toBeNull();
    expect(screen.queryByLabelText('Accent colour size')).toBeNull();
    expect(screen.queryByTestId('param-headline.transform')).toBeNull();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('shows a saved transform as percent and degrees', () => {
    render(<Inspector schema={schema} values={{ headline: 'Hi', 'headline.transform': { x: 0.125, y: -0.05, scale: 1.5, rotation: -7 } }} onChange={() => {}} />);
    {
      const fold = screen.getByRole('button', { name: /^Headline placement/ });
      if (fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold); // M66: folded until asked for
    }
    expect((screen.getByLabelText('Headline size') as HTMLInputElement).value).toBe('150');
    expect((screen.getByLabelText('Headline tilt') as HTMLInputElement).value).toBe('-7');
  });

  it('the sliders report scale and rotation, keeping the position', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ headline: 'Hi', 'headline.transform': { x: 0.1, y: 0, scale: 1.5, rotation: 0 } }} onChange={onChange} />);
    {
      const fold = screen.getByRole('button', { name: /^Headline placement/ });
      if (fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold); // M66: folded until asked for
    }
    fireEvent.change(screen.getByLabelText('Headline size'), { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ headline: 'Hi', 'headline.transform': { x: 0.1, y: 0, scale: 0.8, rotation: 0 } });
    fireEvent.change(screen.getByLabelText('Headline tilt'), { target: { value: '-7' } });
    expect(onChange).toHaveBeenLastCalledWith({ headline: 'Hi', 'headline.transform': { x: 0.1, y: 0, scale: 1.5, rotation: -7 } });
  });

  it('Reset restores the identity and is disabled at the identity', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Inspector schema={schema} values={{ headline: 'Hi', 'headline.transform': { x: 0.2, y: 0.1, scale: 2, rotation: 45 } }} onChange={onChange} />);
    {
      const fold = screen.getByRole('button', { name: /^Headline placement/ });
      if (fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold); // M66: folded until asked for
    }
    fireEvent.click(screen.getByLabelText('Reset Headline placement'));
    expect(onChange).toHaveBeenCalledWith({ headline: 'Hi', 'headline.transform': DEFAULT_TRANSFORM });
    rerender(<Inspector schema={schema} values={{ headline: 'Hi' }} onChange={onChange} />);
    {
      const fold = screen.getByRole('button', { name: /^Headline placement/ });
      if (fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold); // M66: folded until asked for
    }
    expect((screen.getByLabelText('Reset Headline placement') as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks the control whose placement is active on the monitor', () => {
    render(<Inspector schema={schema} values={{ headline: 'Hi' }} onChange={() => {}} activeKey="headline.transform" />);
    {
      const fold = screen.getByRole('button', { name: /^Headline placement/ });
      if (fold.getAttribute('aria-expanded') === 'false') fireEvent.click(fold); // M66: folded until asked for
    }
    expect(screen.getByTestId('param-headline').getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('param-accent').getAttribute('data-active')).toBe('false');
  });
});
