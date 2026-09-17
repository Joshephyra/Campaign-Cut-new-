import { describe, expect, it } from 'vitest';
import { exportFileName } from './exportName';

describe('exportFileName', () => {
  it('names the file for the spot and its version, safe for any file system', () => {
    expect(exportFileName('Rivera for Senate: New spot', '9:16')).toBe('rivera-for-senate-new-spot-9x16.mp4');
    expect(exportFileName('Contrast :30 project', '16:9')).toBe('contrast-30-project-16x9.mp4');
    expect(exportFileName('  Émilie / Été  ', '1:1')).toBe('emilie-ete-1x1.mp4');
  });
  it('falls back to "spot" and 16:9', () => {
    expect(exportFileName('', undefined)).toBe('spot-16x9.mp4');
    expect(exportFileName(null, null)).toBe('spot-16x9.mp4');
    expect(exportFileName('!!!', '4:5')).toBe('spot-4x5.mp4');
  });
});
