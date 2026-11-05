# Tasks

## 1. Pull request template

- [x] 1.1 Add `.github/pull_request_template.md` with Summary/Type of change, OpenSpec, Lever, Harness impact, Verification, End-to-end proof (Playwright), Risk and rollback, and Checklist sections
- [x] 1.2 Reference the repo's real rules (release-on-push, `bun.lock`, `npx tsc --noEmit` + `npm test` + `npx vite build`)

## 2. OpenSpec scaffold

- [x] 2.1 Initialise `openspec/` (`config.yaml`, `specs/`, `changes/`)
- [x] 2.2 Create this change with `skip_specs: true` and pass `openspec validate --strict`

## 3. End-to-end proof

- [x] 3.1 Add the `@playwright/test` dev dependency and an `e2e` npm script
- [x] 3.2 Add `playwright.config.ts` that boots the dev server and uses the system Chromium
- [x] 3.3 Add `tests/e2e/pr-template.spec.ts` (template sections, GitHub markdown render, app boot)
- [x] 3.4 Commit the screenshots under `docs/screenshots/`

## 4. Docs

- [x] 4.1 Point `AGENTS.md` at the template and the OpenSpec workflow
