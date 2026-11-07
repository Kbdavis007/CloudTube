/**
 * Built-in sample clips, served by the app itself from `public/samples/`.
 *
 * They exist so the editor can be tried without a local file: pick one from the
 * dropdown and it is added like any other clip. Being same-origin, they are
 * always readable (no CORS), which also makes them a known-good fallback when a
 * source host blocks in-browser reading.
 */
export interface SampleClip {
  id: string;
  title: string;
  url: string;
  durationSeconds: number;
}

export const SAMPLE_CLIPS: SampleClip[] = [
  { id: 'testsrc', title: 'Sample · test pattern', url: '/samples/sample-1.mp4', durationSeconds: 5 },
  { id: 'bars', title: 'Sample · colour bars', url: '/samples/sample-2.mp4', durationSeconds: 5 },
  { id: 'gradient', title: 'Sample · gradient sweep', url: '/samples/sample-3.mp4', durationSeconds: 8 },
];
