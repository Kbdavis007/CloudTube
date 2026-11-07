import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Screenshots are not deterministic, so a normal `npm run e2e` must not dirty
// the tree; refresh committed proof deliberately with `npm run e2e:proof`.
const SHOTS = resolve(root, process.env.E2E_SHOT_DIR || 'test-results/screenshots');
const FIXTURE = resolve(root, 'tests/fixtures/sample.webm');

/** Reads duration and codecs back from an exported file. */
async function probe(file: string) {
  const bytes = readFileSync(file);
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  return {
    bytes: bytes.byteLength,
    boxType: bytes.subarray(4, 8).toString('ascii'),
    duration: await input.computeDuration(),
    videoCodec: video?.codec ?? null,
    audioCodec: audio?.codec ?? null,
  };
}

/**
 * Drives the real editor (encode + export) in Chromium through the harness page,
 * which mounts EditorView without the app's Google sign-in gate. The fixture is
 * a ~2s WebM; the editor re-encodes trimmed spans with WebCodecs.
 */
test.describe('video editor', () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test('trims and combines two clips into one file of the trimmed length', async ({ page }) => {
    await page.goto('/tests/harness/editor.html');
    await expect(page.getByRole('heading', { name: 'Video Editor' })).toBeVisible();

    // Two clips from the same ~2s source: an untrimmed two-clip timeline is ~4s.
    await page.getByTestId('editor-file-input').setInputFiles([FIXTURE, FIXTURE]);
    await expect(page.getByTestId('editor-clip')).toHaveCount(2);

    // Trim the first clip to [0, 1]. React tracks the input value, so set it via
    // the native setter before dispatching the event it listens for.
    const firstOut = page.getByTestId('editor-clip').first().getByLabel('Trim out point');
    await firstOut.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '1');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The timeline total now reflects the trim: 1s + ~2s, not ~4s.
    await expect(page.getByTestId('preview-total')).toContainText('/ 0:03', { timeout: 5000 });

    await page.screenshot({ path: resolve(SHOTS, 'editor-timeline.png'), fullPage: true });

    // Record any request to the app's own API while exporting: the editor must
    // keep media on the device and never upload it.
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) apiCalls.push(`${request.method()} ${request.url()}`);
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('editor-export').click();
    const download = await downloadPromise;
    const saved = resolve(root, 'test-results', download.suggestedFilename());
    await download.saveAs(saved);

    const result = await probe(saved);
    // A real MP4 was produced (ISO-BMFF starts with an ftyp box).
    expect(result.boxType).toBe('ftyp');
    expect(result.bytes).toBeGreaterThan(1000);
    // The duration is the sum of the trimmed spans (~1s + ~2s), not ~4s.
    expect(result.duration).toBeGreaterThan(2.7);
    expect(result.duration).toBeLessThan(3.4);
    // The video is re-encoded; audio is present.
    expect(result.videoCodec).not.toBeNull();
    expect(result.audioCodec).not.toBeNull();
    // Nothing was uploaded: no call to the app's own API carried the media.
    expect(apiCalls, `unexpected API calls: ${apiCalls.join(', ')}`).toHaveLength(0);

    await expect(page.getByTestId('editor-notice')).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, 'editor-exported.png'), fullPage: true });
  });

  test('rejects a file it cannot decode and adds no clip', async ({ page }) => {
    await page.goto('/tests/harness/editor.html');
    await expect(page.getByRole('heading', { name: 'Video Editor' })).toBeVisible();

    await page.getByTestId('editor-file-input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('this is not a media file'),
    });

    await expect(page.getByTestId('editor-error')).toContainText('notes.txt');
    await expect(page.getByTestId('editor-clip')).toHaveCount(0);
  });

  test('adds a clip from the library dropdown, offering only editable videos', async ({ page }) => {
    await page.goto('/tests/harness/editor.html');
    await expect(page.getByRole('heading', { name: 'Video Editor' })).toBeVisible();

    const select = page.getByTestId('editor-library-select');
    await expect(select).toBeVisible();

    // Only the video with a direct media URL is offered.
    const options = await select.locator('option').allTextContents();
    expect(options.join(' ')).toContain('Editable saved clip');
    expect(options.join(' ')).not.toContain('Embed-only video');

    await select.selectOption({ label: 'Editable saved clip — 0:02.0' });
    await page.getByTestId('editor-library-add').click();

    // The saved video's bytes were read (same-origin fixture) into one clip.
    await expect(page.getByTestId('editor-clip')).toHaveCount(1);
    await expect(page.getByTestId('editor-clip')).toContainText('Editable saved clip');

    await page.screenshot({ path: resolve(SHOTS, 'editor-library.png'), fullPage: true });
  });
});
