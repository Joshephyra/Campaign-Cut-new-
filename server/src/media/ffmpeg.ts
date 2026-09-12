import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * FFmpeg and ffprobe via child process (CLAUDE.md locked stack).
 *
 * Binaries are found, in order: CAMPAIGNCUT_FFMPEG_DIR, the PATH, and on
 * Windows the winget install folder (so a shell started before the install
 * still works). Fails loudly if none is found.
 */
type Bin = 'ffmpeg' | 'ffprobe';
const found = new Map<Bin, string>();

export function findBinary(name: Bin): string {
  const cached = found.get(name);
  if (cached) return cached;

  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const candidates: string[] = [];
  if (process.env.CAMPAIGNCUT_FFMPEG_DIR) candidates.push(path.join(process.env.CAMPAIGNCUT_FFMPEG_DIR, exe));
  candidates.push(name);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const packages = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(packages)) {
      for (const pkg of fs.readdirSync(packages).filter((d) => d.startsWith('Gyan.FFmpeg'))) {
        const pkgDir = path.join(packages, pkg);
        for (const sub of fs.readdirSync(pkgDir).filter((d) => d.startsWith('ffmpeg-'))) {
          candidates.push(path.join(pkgDir, sub, 'bin', exe));
        }
      }
    }
  }

  for (const candidate of candidates) {
    const r = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
    if (r.status === 0) {
      found.set(name, candidate);
      return candidate;
    }
  }
  throw new Error(`${name} not found. Install FFmpeg (winget install Gyan.FFmpeg) or set CAMPAIGNCUT_FFMPEG_DIR to its bin folder.`);
}

function run(bin: Bin, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(findBinary(bin), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited with code ${String(code)}: ${stderr.trim() || '(no output)'}`));
    });
  });
}

export type ProbeInfo = {
  width: number;
  height: number;
  /** Seconds. 0 for a still image. */
  durationS: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
};

function parseRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/').map(Number);
  if (!num || !den) return Number(rate) || 0;
  return num / den;
}

/** ffprobe -> width, height, duration, fps. Rejects naming the file if it is not media. */
export async function probe(file: string): Promise<ProbeInfo> {
  let out: string;
  try {
    ({ stdout: out } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]));
  } catch (err) {
    throw new Error(`Could not read ${path.basename(file)} as media: ${(err as Error).message}`);
  }
  const data = JSON.parse(out) as {
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string; duration?: string }[];
    format?: { duration?: string };
  };
  const video = data.streams?.find((s) => s.codec_type === 'video');
  if (!video || !video.width || !video.height) throw new Error(`${path.basename(file)} has no video stream`);
  const duration = Number(data.format?.duration ?? video.duration ?? 0);
  return {
    width: video.width,
    height: video.height,
    durationS: Number.isFinite(duration) ? duration : 0,
    fps: parseRate(video.avg_frame_rate && video.avg_frame_rate !== '0/0' ? video.avg_frame_rate : video.r_frame_rate),
    codec: video.codec_name ?? '',
    hasAudio: Boolean(data.streams?.some((s) => s.codec_type === 'audio')),
  };
}

/** SPEC.md section 5: ~960x540, H.264, faststart, moderate bitrate. Height follows the aspect ratio. */
export async function makeProxy(input: string, output: string): Promise<void> {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await run('ffmpeg', [
    '-y', '-v', 'error',
    '-i', input,
    '-vf', 'scale=960:-2',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k',
    output,
  ]);
}

/** One JPEG frame, 480 wide, at the given time. */
export async function makePoster(input: string, output: string, atSeconds: number): Promise<void> {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await run('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', String(Math.max(0, atSeconds)),
    '-i', input,
    '-frames:v', '1',
    '-vf', 'scale=480:-2',
    '-q:v', '3',
    output,
  ]);
}
