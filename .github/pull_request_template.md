<!--
CloudTube pull request template.

Written for AI agents (and humans) opening a PR on this repo. Fill in every
section and delete the guidance comments as you go, but keep the section
headings: reviewers and automation look for them.

Two repo rules shape everything below:
  * Every merge to `main` auto-deploys to production, so every PR is a release.
    See AGENTS.md and docs/VERSIONING.md.
  * Behaviour changes are planned in `openspec/` before code is written.
-->

## Summary

<!-- One or two sentences: what changes, and why. Lead with the user-visible effect. -->

Closes #<issue-number>

## Type of change

<!-- Tick the one that applies. It decides which of the sections below are required. -->

- [ ] New capability / new item — spec first
- [ ] Bug fix — edit and sync the existing OpenSpec change
- [ ] Change to existing behaviour — edit and sync the existing OpenSpec change
- [ ] Docs / config / tooling only — no behaviour change
- [ ] Breaking change — called out under "Risk and rollback"

## OpenSpec

<!--
This repo is spec-driven (`openspec/`). A behaviour change must have an OpenSpec
change proposal that is kept in sync with the code, not written after the fact.

  New item / capability        -> create the change first, then implement it:
                                    openspec new change <kebab-name>
                                    # in an agent: /openspec-propose "<idea>"
  Bug fix / edit existing      -> edit the SAME change that owns it and re-sync:
                                    /openspec-update-change <name>
                                    /openspec-sync-specs
  Docs / config / tooling only -> the change sets `skip_specs: true`.

Validate before you push:  openspec validate --all --strict
-->

- Change: `openspec/changes/<name>/`
- Spec(s) touched: `openspec/specs/<capability>/`
- [ ] Change proposal created or updated **before** implementation (not retrofitted)
- [ ] `openspec validate --all --strict` passes — output:

```
$ openspec validate --all --strict
<paste output>
```

## Lever

<!--
Lever sets how far an agent may take a change. Declare the level used here.
Dials live in `~/.copilot/lever.yml`; the default for this repo is L4.

L0 propose · L1 draft · L2 ready (human lands) · L3 grant · L4 gated self-merge · L5 release
-->

- Autonomy level: `L?`
- Landed by: `agent` / `human`

## Harness impact

<!--
Harness engineering keeps durable instructions, constraints, feedback and memory
in the repo so the next agent run does not repeat a mistake.
Kit: https://harnessworks.github.io/harness-starter-kit/ (tracked in `.harness/source.json`).
Add only the smallest useful piece; prefer updating existing docs over duplicating.
-->

- Instructions updated (`AGENTS.md`, `docs/`):
- Constraints / checks added (lint, type check, drift check, CI):
- Feedback added (test, fixture, smoke check):
- Memory / failure record (`docs/failures/*.md`) and the check that prevents recurrence:
- `.harness/source.json` updated: yes / no / n-a

## Verification

<!-- Paste real command output. Do not tick a box you did not run. -->

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | |
| `npm test` | |
| `npx vite build` | |

## End-to-end proof (Playwright)

<!--
A green type-check is not proof the change works. Drive the real app in a browser
with Playwright and attach screenshots — drag the images into this description, or
commit them under `docs/screenshots/` and link them here.

  UI change        -> drive the actual flow; capture before/after.
  Docs/config      -> capture the rendered result (e.g. this PR body) plus the
                      app still booting.
-->

- Flow driven in the browser:
- Screenshots (attach or link):

| Before | After |
| --- | --- |
|  |  |

## Risk and rollback

- Risk:
- Rollback: revert this PR (`git revert`), or redeploy the previous tag; `main` re-deploys in ~1–2 min.

## Checklist

- [ ] Branch is `openhands/<slug>` or a focused topic branch; commits are conventional (`feat:`, `fix:`, `docs:`, `chore:`)
- [ ] `npx tsc --noEmit`, `npm test` and `npx vite build` pass (output above)
- [ ] OpenSpec change created or updated and validated
- [ ] Playwright screenshots attached as proof
- [ ] No secrets committed, and no `package-lock.json` (this project tracks `bun.lock`)
- [ ] `CHANGELOG.md` left to `npm run release:patch` (do not hand-edit it)
- [ ] Scope is one logical change

---

_This PR was created by an AI agent (OpenHands) on behalf of the repository owner._
