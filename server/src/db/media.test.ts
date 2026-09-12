import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './index';

describe('media_asset', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  afterEach(() => db.close());

  it('inserts and reads back an asset', () => {
    const { id } = db.insertMediaAsset({
      originalName: 'rally.mp4',
      originalPath: 'originals/1-rally.mp4',
      proxyPath: 'proxies/1.mp4',
      thumbPath: 'thumbs/1.jpg',
      width: 1920,
      height: 1080,
      durationS: 12.5,
      fps: 29.97,
    });
    const row = db.getMediaAsset(id)!;
    expect(row).toMatchObject({ id, originalName: 'rally.mp4', width: 1920, durationS: 12.5, fps: 29.97 });
    expect(db.listMediaAssets()).toHaveLength(1);
    expect(db.getMediaAsset(999)).toBeUndefined();
  });
});
