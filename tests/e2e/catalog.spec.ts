import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Screenshots are not deterministic, so a normal `npm run e2e` must not dirty
// the tree; refresh committed proof deliberately with `npm run e2e:proof`.
const SHOTS = resolve(root, process.env.E2E_SHOT_DIR || 'test-results/screenshots');

/**
 * The catalogue view mounts without the Google sign-in gate and reads the baked
 * catalogue, so it is the cheapest place to prove that the search / filter /
 * sort / pagination controls work over a real list of videos — the same shared
 * control the library and live search results now use.
 */
test.describe('catalogue search and filter', () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test('searches, filters, sorts and pages the baked catalogue', async ({ page }) => {
    await page.goto('/tests/harness/catalog.html');

    const bar = page.getByTestId('video-filter-bar');
    await expect(bar).toBeVisible();
    await expect(page.getByTestId('video-pagination')).toBeVisible();

    // A free-text search narrows the list: pick a real title token and confirm
    // the first card contains it while the total drops.
    const totalText = page.locator('text=/\\d[\\d,]* matches?/').first();
    const before = await totalText.textContent();
    const firstTitle = (await page.locator('h3').first().textContent()) ?? '';
    const token = firstTitle.trim().split(/\s+/)[0];
    expect(token.length).toBeGreaterThan(1);

    await page.getByTestId('video-filter-search').fill(token);
    await expect(page.locator('h3').first()).toContainText(new RegExp(token, 'i'));
    await expect(totalText).not.toHaveText(before ?? '');

    // A sort change reorders without throwing and keeps cards on screen.
    await page.getByTestId('video-filter-sort').selectOption('title');
    await expect(page.locator('h3').first()).toBeVisible();

    // Pagination moves to the next page of results.
    const pageLabel = page.getByTestId('video-pagination');
    await page.getByRole('button', { name: /Next/ }).click();
    await expect(pageLabel).toContainText('Page 2');

    await page.screenshot({ path: resolve(SHOTS, 'catalog-filter.png'), fullPage: false });

    // Clearing the filters restores the unfiltered catalogue.
    await page.getByTestId('video-filter-clear').click();
    await expect(page.getByTestId('video-filter-search')).toHaveValue('');
    await expect(totalText).toHaveText(before ?? '');
  });
});
