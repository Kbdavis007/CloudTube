import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATE = resolve(root, '.github/pull_request_template.md');
const SHOTS = resolve(root, 'docs/screenshots');

const template = readFileSync(TEMPLATE, 'utf8');

/** Headings the template must keep: agents and reviewers key off them. */
const REQUIRED_SECTIONS = [
  '## Summary',
  '## Type of change',
  '## OpenSpec',
  '## Lever',
  '## Harness impact',
  '## Verification',
  '## End-to-end proof (Playwright)',
  '## Risk and rollback',
  '## Checklist',
];

test.describe('pull request template', () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test('keeps the sections the issue asks for', () => {
    for (const section of REQUIRED_SECTIONS) {
      expect(template, `missing section: ${section}`).toContain(section);
    }
    // The three practices the issue names, plus the release rule for this repo.
    expect(template).toContain('openspec validate');
    expect(template).toContain('/openspec-update-change');
    expect(template).toContain('L0 propose');
    expect(template).toContain('harness-starter-kit');
    expect(template).toContain('Playwright');
    expect(template).toContain('CHANGELOG.md');
    // Evidence must not be linked by branch name: the URL 404s once the branch
    // is deleted on merge. Pin it to a commit SHA or a GitHub-uploaded image.
    expect(template).toContain('never by branch name');
    expect(template).toContain('<full-commit-sha>');
    // A PR body is filled by an agent: it must tell the agent to close the issue.
    expect(template).toMatch(/Closes #<issue-number>/);
  });

  test('renders as GitHub-flavoured markdown', async ({ page, request }) => {
    const res = await request.post('https://api.github.com/markdown', {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      data: { text: template, mode: 'gfm', context: 'Kbdavis007/CloudTube' },
    });
    expect(res.ok(), `GitHub markdown API: ${res.status()}`).toBeTruthy();

    const html = await res.text();
    // GitHub returned real HTML, not an error string.
    expect(html).toContain('<h2');
    expect(html).toContain('OpenSpec');

    await page.setContent(
      `<style>
         body { font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif;
                max-width: 900px; margin: 24px auto; padding: 0 16px; color: #1f2328; }
         h2 { border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
         code { background: #f6f8fa; padding: .2em .4em; border-radius: 6px; }
         pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }
         table { border-collapse: collapse; } td, th { border: 1px solid #d0d7de; padding: 6px 13px; }
       </style>
       <article class="markdown-body">${html}</article>`
    );

    await page.screenshot({
      path: resolve(SHOTS, 'pr-template-rendered.png'),
      fullPage: true,
    });
  });
});

test.describe('app smoke (the template is not a behaviour change)', () => {
  test('the app still boots and serves its health endpoint', async ({ page }) => {
    const health = await page.request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    const body = await health.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');

    await page.goto('/');
    await expect(page).toHaveTitle(/CloudTube/);
    // The signed-out landing view is the first screen; no crash on boot.
    await expect(page.getByText('Your Personal YouTube Library').first()).toBeVisible();

    await page.screenshot({
      path: resolve(SHOTS, 'app-boots.png'),
      fullPage: true,
    });
  });
});
