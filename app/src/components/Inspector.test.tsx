import type { ParamValues, TemplateParam } from '@campaigncut/composition';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from './Inspector';

afterEach(cleanup);

const schema: TemplateParam[] = [
  { key: 'headline', role: 'headline', kind: 'text', label: 'Headline', default: 'A', path: '/layers/0', maxChars: 12 },
  { key: 'subhead', role: 'subhead', kind: 'text', label: 'Subhead', default: 'B', path: '/layers/1' },
  { key: 'disclaimer', role: 'safe.disclaimer', kind: 'text', label: 'Disclaimer', default: 'C', path: '/layers/2', locked: true },
  { key: 'accent', role: 'accent', kind: 'color', label: 'Accent colour', default: '#FF0000', path: '/layers/3/shapes/0/it/1' },
];

describe('Inspector (generated from the schema)', () => {
  it('renders exactly one control per param: 3 text and 1 colour', () => {
    render(<Inspector schema={schema} values={{}} onChange={() => {}} />);
    expect(screen.getAllByTestId(/^param-/)).toHaveLength(4);
    // three text fields, plus the colour's hex field which is also a textbox
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    expect(screen.getAllByTestId('color-swatch')).toHaveLength(1);
    expect(screen.getAllByRole('textbox').filter((el) => el.id.endsWith('-input'))).toHaveLength(3);
  });

  it('shows the saved value, falling back to the default', () => {
    render(<Inspector schema={schema} values={{ headline: 'Saved' }} onChange={() => {}} />);
    expect((screen.getByLabelText('Headline') as HTMLInputElement).value).toBe('Saved');
    expect((screen.getByLabelText('Subhead') as HTMLInputElement).value).toBe('B');
  });

  it('typing emits the new values object', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{ headline: 'A' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'VOTE' } });
    expect(onChange).toHaveBeenCalledWith({ headline: 'VOTE' });
  });

  it('enforces maxChars: the input is capped and longer input is truncated', () => {
    const onChange = vi.fn();
    // Hold real state so the counter reflects what was typed.
    function Stateful() {
      const [values, setValues] = useState<ParamValues>({});
      return (
        <Inspector
          schema={schema}
          values={values}
          onChange={(v) => {
            onChange(v);
            setValues(v);
          }}
        />
      );
    }
    render(<Stateful />);
    const input = screen.getByLabelText('Headline') as HTMLInputElement;
    expect(input.maxLength).toBe(12);
    fireEvent.change(input, { target: { value: 'THIS IS FAR TOO LONG' } });
    expect(onChange).toHaveBeenCalledWith({ headline: 'THIS IS FAR ' });
    expect(input.value).toBe('THIS IS FAR ');
    expect(screen.getByText('12/12')).toBeTruthy();
  });

  it('a colour has a swatch and a hex field, and only emits valid hex', () => {
    const onChange = vi.fn();
    render(<Inspector schema={schema} values={{}} onChange={onChange} />);
    const hex = screen.getByLabelText('Accent colour') as HTMLInputElement;
    expect(hex.value).toBe('#FF0000');
    fireEvent.change(hex, { target: { value: '#12' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(hex, { target: { value: '#2B54E6' } });
    expect(onChange).toHaveBeenCalledWith({ accent: '#2B54E6' });
    fireEvent.change(screen.getByTestId('color-swatch'), { target: { value: '#000000' } });
    expect(onChange).toHaveBeenCalledWith({ accent: '#000000' });
  });

  it('marks the disclaimer as locked in position but editable', () => {
    render(<Inspector schema={schema} values={{}} onChange={() => {}} />);
    const input = screen.getByLabelText('Disclaimer') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(screen.getByText(/position and size locked/i)).toBeTruthy();
  });

  it('shows placeholders for image and media params instead of controls', () => {
    const extra: TemplateParam[] = [
      { key: 'logo', role: 'logo', kind: 'image', label: 'Logo', default: 'images/logo.png', path: '/assets/0' },
      { key: 'mediaFill', role: 'mediaFill', kind: 'media', label: 'Footage', default: null, path: '/layers/9' },
    ];
    render(<Inspector schema={extra} values={{}} onChange={() => {}} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getAllByTestId(/^param-/)).toHaveLength(2);
  });
});
