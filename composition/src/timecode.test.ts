import { describe, expect, it } from 'vitest';
import { formatTimecode } from './timecode';

describe('formatTimecode', () => {
  it('formats frame 0 as 00:00:00', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00');
  });

  it('rolls frames into seconds and seconds into minutes', () => {
    expect(formatTimecode(29, 30)).toBe('00:00:29');
    expect(formatTimecode(30, 30)).toBe('00:01:00');
    expect(formatTimecode(30 * 60 + 5, 30)).toBe('01:00:05');
    expect(formatTimecode(900, 30)).toBe('00:30:00');
  });
});
