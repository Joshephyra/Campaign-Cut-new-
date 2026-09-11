import { describe, expect, it } from 'vitest';
import { compositionConfig, defaultProps } from './config';

// T1: the exported composition config is what MILESTONES M0 promises.
describe('compositionConfig', () => {
  it('is the single composition named "main"', () => {
    expect(compositionConfig.id).toBe('main');
  });

  it('is 1920x1080 (16:9 only, per CLAUDE.md non-goals)', () => {
    expect(compositionConfig.width).toBe(1920);
    expect(compositionConfig.height).toBe(1080);
  });

  it('has a positive integer fps and duration', () => {
    expect(Number.isInteger(compositionConfig.fps)).toBe(true);
    expect(compositionConfig.fps).toBeGreaterThan(0);
    expect(Number.isInteger(compositionConfig.durationInFrames)).toBe(true);
    expect(compositionConfig.durationInFrames).toBeGreaterThan(0);
  });

  it('ships default props with a background colour', () => {
    expect(defaultProps.background).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
