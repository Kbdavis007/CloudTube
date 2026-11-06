# Proposal

## Why

This repository has no `.github/pull_request_template.md`, so every PR is described
differently and agents have no durable reminder to plan work in OpenSpec, declare a
lever autonomy level, record harness impact, or attach browser proof. The owner is the
only user and merges to `main` auto-deploy to production, so a consistent PR contract
is the cheapest place to keep agent-created PRs reviewable and safe.

## What Changes

- Add `.github/pull_request_template.md` with sections an agent fills every time:
  Summary (closes the issue), Type of change, OpenSpec, Lever, Harness impact,
  Verification, End-to-end proof (Playwright screenshots), Risk and rollback, Checklist.
- Adopt a minimal OpenSpec scaffold (`openspec/config.yaml`, `openspec/specs/`,
  `openspec/changes/`) so the template's "create a change first" and "edit and sync
  the existing change" instructions point at a real directory.
- Add a Playwright end-to-end check that renders the template and boots the app, and
  commit the resulting screenshots under `docs/screenshots/` as PR proof.

## Capabilities

### New Capabilities

_None. This is a tooling/documentation change: it adds a PR template and the OpenSpec
scaffold, and changes no system behavior. The change sets `skip_specs: true`._

### Modified Capabilities

_None._

## Impact

- New: `.github/pull_request_template.md`, `openspec/`, `playwright.config.ts`,
  `tests/e2e/pr-template.spec.ts`, `docs/screenshots/`.
- `package.json` and `bun.lock`: add the `@playwright/test` dev dependency and an
  `e2e` script.
- `AGENTS.md`: point at the template and the OpenSpec workflow.
- No runtime or API behaviour changes; no effect on the deployed Worker.
