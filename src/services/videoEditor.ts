/**
 * Client-side video editor engine.
 *
 * Wraps Mediabunny to read clips, apply in/out trims, and assemble a timeline
 * into a single downloadable file. All work happens in the browser: media bytes
 * are read from the user's device and never uploaded.
 *
 * The export re-encodes the trimmed spans so a trim can land on any frame, not
 * just a key frame. Codecs are chosen from what the running browser can actually
 * encode (WebCodecs), preferring the source codec and falling back to a broadly
 * supported one.
 *
 * The pure helpers (timeline duration, trim clamping) and the metadata reader
 * have no WebCodecs dependency, so they are unit-testable in Node. Encoding
 * requires WebCodecs, which only the browser provides.
 */

import {
  ALL_FORMATS,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSampleSink,
  VideoSampleSource,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type OutputFormat,
  type VideoCodec,
} from 'mediabunny';

/** A clip added to the editor timeline. `file` stays on the device. */
export interface EditorClip {
  id: string;
  file: Blob;
  name: string;
  /** Full source duration, in seconds. */
  duration: number;
  width: number;
  height: number;
  /** In point, in seconds, within the source. */
  trimStart: number;
  /** Out point, in seconds, within the source. */
  trimEnd: number;
  hasAudio: boolean;
  videoCodec: VideoCodec | null;
  audioCodec: AudioCodec | null;
}

export type EditorErrorCode =
  | 'unsupported'
  | 'no-video'
  | 'empty-timeline'
  | 'canceled'
  | 'export-failed';

/** A user-facing editor failure, carrying a stable code for the UI to branch on. */
export class EditorError extends Error {
  readonly code: EditorErrorCode;

  constructor(code: EditorErrorCode, message: string) {
    super(message);
    this.name = 'EditorError';
    this.code = code;
  }
}

export interface ExportOptions {
  /** Progress from 0 to 1 as the output is written. */
  onProgress?: (progress: number) => void;
  /** When aborted, the export stops and throws an `EditorError` with code `canceled`. */
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  /** Duration of the assembled file, in seconds. */
  duration: number;
}

/** The span of a clip that ends up in the assembled timeline, in seconds. */
export const trimmedDuration = (clip: Pick<EditorClip, 'trimStart' | 'trimEnd'>): number =>
  Math.max(0, clip.trimEnd - clip.trimStart);

/** Total length of the assembled timeline, in seconds. */
export const timelineDuration = (clips: ReadonlyArray<Pick<EditorClip, 'trimStart' | 'trimEnd'>>): number =>
  clips.reduce((sum, clip) => sum + trimmedDuration(clip), 0);

/**
 * Clamp a requested in point so it stays before the out point and inside the
 * clip. An in point at or past the out point is pulled back by a hair rather
 * than allowed to cross, matching the "handles stop" rule.
 */
export function clampTrimStart(start: number, end: number, duration: number): number {
  const safeEnd = Math.min(Math.max(end, 0), duration);
  return Math.min(Math.max(start, 0), Math.max(0, safeEnd - 0.01));
}

/** Clamp a requested out point so it stays after the in point and inside the clip. */
export function clampTrimEnd(end: number, start: number, duration: number): number {
  const safeStart = Math.min(Math.max(start, 0), duration);
  return Math.max(Math.min(Math.max(end, 0), duration), Math.min(duration, safeStart + 0.01));
}

/** Human-readable time for the UI, e.g. `1:05.2`. */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  const secs = rest.toFixed(1).padStart(4, '0');
  return `${minutes}:${secs}`;
}

/**
 * Read a local media file into a clip: duration, resolution, and codecs. Throws
 * an `EditorError` naming the file when the browser cannot decode it.
 */
export async function readClip(file: Blob, name = 'clip'): Promise<EditorClip> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

  if (!(await input.canRead())) {
    throw new EditorError('unsupported', `"${name}" is not a media file this browser can read.`);
  }

  const video = await input.getPrimaryVideoTrack();
  if (!video) {
    throw new EditorError('no-video', `"${name}" has no video track, so it cannot be edited here.`);
  }

  const [duration, width, height] = await Promise.all([
    input.computeDuration(),
    video.getDisplayWidth(),
    video.getDisplayHeight(),
  ]);

  const audio = await input.getPrimaryAudioTrack();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    name,
    duration,
    width,
    height,
    trimStart: 0,
    trimEnd: duration,
    hasAudio: audio !== null,
    videoCodec: video.codec,
    audioCodec: audio ? audio.codec : null,
  };
}

const isEven = (value: number): boolean => value % 2 === 0;
const toEven = (value: number): number => Math.max(2, Math.round(value) - (Math.round(value) % 2));

/** Even-pixel output geometry taken from the first clip that has a video track. */
function pickGeometry(clips: ReadonlyArray<EditorClip>): { width: number; height: number } {
  const first = clips.find((clip) => clip.width > 0 && clip.height > 0);
  if (!first) throw new EditorError('no-video', 'None of the clips has a usable video track.');
  const width = toEven(first.width);
  const height = toEven(first.height);
  return { width: isEven(width) ? width : width + 1, height: isEven(height) ? height : height + 1 };
}

async function pickVideoCodec(
  clips: ReadonlyArray<EditorClip>,
  format: OutputFormat,
  geometry: { width: number; height: number }
): Promise<VideoCodec> {
  const supported = format.getSupportedVideoCodecs();
  const preferred = clips.map((clip) => clip.videoCodec).filter((codec): codec is VideoCodec => codec !== null);
  // AVC first: it is the natural, most widely playable codec for the MP4 output.
  // Fall back to a clip's own codec, then to the remaining encodable options.
  const candidates = ['avc', ...preferred, 'vp9', 'vp8', 'av1'] as VideoCodec[];

  for (const codec of candidates) {
    if (!supported.includes(codec)) continue;
    if (await canEncodeVideo(codec, { width: geometry.width, height: geometry.height })) return codec;
  }
  throw new EditorError('unsupported', 'This browser cannot encode a video codec for the export.');
}

async function pickAudioCodec(
  clips: ReadonlyArray<EditorClip>,
  format: OutputFormat
): Promise<AudioCodec | null> {
  const supported = format.getSupportedAudioCodecs();
  const preferred = clips
    .filter((clip) => clip.hasAudio)
    .map((clip) => clip.audioCodec)
    .filter((codec): codec is AudioCodec => codec !== null);
  // AAC first for MP4 compatibility, then a clip's own codec, then the rest.
  const candidates = ['aac', ...preferred, 'opus', 'vorbis'] as AudioCodec[];

  for (const codec of candidates) {
    if (!supported.includes(codec)) continue;
    if (await canEncodeAudio(codec)) return codec;
  }
  // No encodable audio codec: export the video silently rather than fail.
  return null;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new EditorError('canceled', 'Export canceled.');
}

function toEditorError(error: unknown): EditorError {
  if (error instanceof EditorError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new EditorError('export-failed', `Export failed: ${message}`);
}

/** Validated, clamped spans for each clip in timeline order. */
function prepareSegments(clips: ReadonlyArray<EditorClip>): Array<{ clip: EditorClip; start: number; end: number }> {
  if (clips.length === 0) {
    throw new EditorError('empty-timeline', 'Add at least one clip before exporting.');
  }

  return clips.map((clip) => {
    const start = Math.min(Math.max(clip.trimStart, 0), clip.duration);
    const end = Math.min(Math.max(clip.trimEnd, 0), clip.duration);
    if (!(end - start > 0)) {
      throw new EditorError('empty-timeline', `Clip "${clip.name}" has no trimmed duration.`);
    }
    return { clip, start, end };
  });
}

/**
 * Assemble the timeline into one MP4 file. Clips play in array order, each
 * restricted to its trimmed span; the output duration equals the sum of those
 * spans. Rejects an empty timeline and an aborted export.
 */
export async function assembleTimeline(
  clips: ReadonlyArray<EditorClip>,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const segments = prepareSegments(clips);
  const geometry = pickGeometry(clips);
  const format = new Mp4OutputFormat();

  const videoCodec = await pickVideoCodec(clips, format, geometry);
  const audioCodec = clips.some((clip) => clip.hasAudio) ? await pickAudioCodec(clips, format) : null;

  const target = new BufferTarget();
  const output = new Output({ format, target });
  const videoSource = new VideoSampleSource({
    codec: videoCodec,
    quality: new Quality('high'),
    sizeChangeBehavior: 'contain',
    transform: { width: geometry.width, height: geometry.height, fit: 'contain' },
  });
  output.addVideoTrack(videoSource);

  const audioSource = audioCodec
    ? new AudioSampleSource({ codec: audioCodec, quality: new Quality('high') })
    : null;
  if (audioSource) output.addAudioTrack(audioSource);

  const total = timelineDuration(clips);
  let offset = 0;

  try {
    await output.start();

    for (const segment of segments) {
      throwIfAborted(options.signal);
      const input = new Input({ source: new BlobSource(segment.clip.file), formats: ALL_FORMATS });

      const video = await input.getPrimaryVideoTrack();
      if (video) {
        for await (const sample of new VideoSampleSink(video).samples(segment.start, segment.end)) {
          throwIfAborted(options.signal);
          const within = sample.timestamp - segment.start;
          sample.setTimestamp(offset + within);
          await videoSource.add(sample);
          sample.close();
          if (total > 0) options.onProgress?.(Math.min(0.999, (offset + within) / total));
        }
      }

      if (audioSource) {
        const audio = await input.getPrimaryAudioTrack();
        if (audio && (await audio.canDecode())) {
          for await (const sample of new AudioSampleSink(audio).samples(segment.start, segment.end)) {
            throwIfAborted(options.signal);
            sample.setTimestamp(sample.timestamp - segment.start + offset);
            await audioSource.add(sample);
            sample.close();
          }
        }
      }

      offset += segment.end - segment.start;
    }

    videoSource.close();
    audioSource?.close();
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw toEditorError(error);
  }

  const buffer = target.buffer;
  if (!buffer) throw new EditorError('export-failed', 'Export produced no data.');

  options.onProgress?.(1);
  const extension = format.fileExtension.replace(/^\./, '');
  return {
    blob: new Blob([buffer], { type: format.mimeType }),
    filename: `cloudtube-edit-${Date.now()}.${extension}`,
    mimeType: format.mimeType,
    duration: total,
  };
}
