import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Screenshots are not deterministic, so a normal `npm run e2e` must not dirty
// the tree; refresh committed proof deliberately with `npm run e2e:proof`.
const SHOTS = resolve(root, process.env.E2E_SHOT_DIR || 'test-results/screenshots');

/**
 * A search result can play in place. This mounts the real result card on its own
 * with fixed results, so it proves the behaviour without the sign-in gate.
 */
test.describe('inline playback in search results', () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test('a result plays inside its card, and more than one can play at once', async ({ page }) => {
    await page.goto('/tests/harness/search.html');

    const cards = page.getByTestId('search-result-card');
    await expect(cards).toHaveCount(2);

    // Nothing plays until a card's Play is pressed.
    await expect(page.getByTestId('search-inline-player')).toHaveCount(0);

    // Press Play on the first card: the player mounts inside that card only.
    await cards.nth(0).getByRole('button', { name: /Play .* in this card/ }).click();
    await expect(page.getByTestId('search-inline-player')).toHaveCount(1);
    await expect(cards.nth(0).getByTestId('search-inline-player')).toBeVisible();

    // Press Play on the second card too: both play at once.
    await cards.nth(1).getByRole('button', { name: /Play .* in this card/ }).click();
    await expect(page.getByTestId('search-inline-player')).toHaveCount(2);

    await page.screenshot({ path: resolve(SHOTS, 'search-inline-play.png'), fullPage: false });

    // "Full page" still opens the dedicated player for the result.
    await cards.nth(0).getByRole('button', { name: 'Full page' }).first().click();
    await expect(page.getByTestId('opened-full-page')).toContainText('Full page: r1');
  });

  test('the card stops playing on request', async ({ page }) => {
    await page.goto('/tests/harness/search.html');

    const card = page.getByTestId('search-result-card').first();
    await card.getByRole('button', { name: /Play .* in this card/ }).click();
    await expect(page.getByTestId('search-inline-player')).toHaveCount(1);

    await card.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByTestId('search-inline-player')).toHaveCount(0);
  });
});
