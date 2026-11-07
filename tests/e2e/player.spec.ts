import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Screenshots are not deterministic, so a normal `npm run e2e` must not dirty
// the tree; refresh committed proof deliberately with `npm run e2e:proof`.
const SHOTS = resolve(root, process.env.E2E_SHOT_DIR || 'test-results/screenshots');

/**
 * The player mounts on its own with a synthetic queue, so this proves the two
 * behaviours the issue asks for without the Google sign-in gate: prev/next walks
 * the list the video was played from (not the library), and related videos are
 * offered under the player.
 */
test.describe('player navigation and related videos', () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test('prev/next walks the play queue and related videos play without saving', async ({ page }) => {
    await page.goto('/tests/harness/player.html');

    const label = page.getByTestId('player-queue-label');
    await expect(label).toHaveText('Video 1 of 3 in Search results');

    // Next moves forward within the queue.
    await page.getByRole('button', { name: /Next Video/ }).click();
    await expect(label).toHaveText('Video 2 of 3 in Search results');

    // Previous moves back.
    await page.getByRole('button', { name: /Previous Video/ }).click();
    await expect(label).toHaveText('Video 1 of 3 in Search results');

    // Related videos are offered, and playing one opens it in the player.
    const related = page.getByTestId('related-videos');
    await expect(related).toBeVisible();
    await expect(page.getByTestId('related-video-card')).toHaveCount(2);

    await page.getByTestId('related-video-card').first().click();
    await expect(page.locator('h1')).toHaveText('Related one');
    // The played related video is outside the queue, so the counter is honest.
    await expect(label).toHaveText('Not in Library');

    await page.screenshot({ path: resolve(SHOTS, 'player-related.png'), fullPage: false });
  });
});
