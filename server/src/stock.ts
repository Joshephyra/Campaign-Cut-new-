/**
 * M34: stock footage. One provider today, Pexels, behind a small shape so
 * another site can be added without touching the routes. The API key comes
 * from the environment (PEXELS_API_KEY), never from source.
 */

export type StockResult = {
  provider: 'pexels';
  id: string;
  title: string;
  thumbUrl: string;
  durationS: number;
  width: number;
  height: number;
  /** "Name on Pexels": shown beside the clip, kept in the file name. */
  credit: string;
  pageUrl: string;
};

export type StockOptions = {
  /** Empty means stock is off. */
  apiKey: string;
  /** Injected in tests; the global fetch otherwise. */
  fetch?: typeof fetch;
};

type PexelsFile = { id: number; quality: string; file_type: string; width: number; height: number; link: string };
type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  url: string;
  user?: { name?: string };
  video_files: PexelsFile[];
};

/** "https://www.pexels.com/video/a-crowd-at-a-rally-3571264/" -> "A crowd at a rally". */
function titleFromPageUrl(url: string, id: number): string {
  const slug = url.replace(/\/+$/, '').split('/').pop() ?? '';
  const words = slug.replace(new RegExp(`-?${id}$`), '').split('-').filter(Boolean).join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : `Pexels video ${id}`;
}

export function parsePexelsVideos(json: { videos?: PexelsVideo[]; [k: string]: unknown }): StockResult[] {
  return (json.videos ?? []).map((v) => ({
    provider: 'pexels',
    id: String(v.id),
    title: titleFromPageUrl(v.url ?? '', v.id),
    thumbUrl: v.image ?? '',
    durationS: Number(v.duration) || 0,
    width: Number(v.width) || 0,
    height: Number(v.height) || 0,
    credit: `${v.user?.name?.trim() || 'Unknown'} on Pexels`,
    pageUrl: v.url ?? '',
  }));
}

/** The largest mp4 at or under 1080p (the export is 1080p; 4K only costs time), else the smallest there is. */
export function pickPexelsFile(files: PexelsFile[]): PexelsFile | undefined {
  const mp4s = files.filter((f) => f.file_type === 'video/mp4' && f.link);
  const fitting = mp4s.filter((f) => f.height <= 1080).sort((a, b) => b.height - a.height);
  if (fitting[0]) return fitting[0];
  return mp4s.sort((a, b) => a.height - b.height)[0];
}

const PEXELS = 'https://api.pexels.com';

export function pexelsClient(options: StockOptions) {
  const doFetch = options.fetch ?? fetch;
  const headers = { Authorization: options.apiKey };
  return {
    enabled: options.apiKey.trim().length > 0,
    async search(query: string): Promise<StockResult[]> {
      const res = await doFetch(`${PEXELS}/videos/search?query=${encodeURIComponent(query)}&per_page=24&orientation=landscape`, { headers });
      if (!res.ok) throw new Error(`Pexels answered ${res.status}`);
      return parsePexelsVideos((await res.json()) as { videos?: PexelsVideo[] });
    },
    /** The clip's details and the file to download, or null when Pexels has no such video. */
    async video(id: string): Promise<{ result: StockResult; file: PexelsFile } | null> {
      const res = await doFetch(`${PEXELS}/videos/videos/${encodeURIComponent(id)}`, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Pexels answered ${res.status}`);
      const video = (await res.json()) as PexelsVideo;
      const file = pickPexelsFile(video.video_files ?? []);
      if (!file) return null;
      return { result: parsePexelsVideos({ videos: [video] })[0]!, file };
    },
    async download(link: string): Promise<Buffer> {
      const res = await doFetch(link);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}
