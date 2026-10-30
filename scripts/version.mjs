#!/usr/bin/env node
/**
 * Computes the current semantic version and commit provenance from git, then
 * writes src/generated/version.ts so the app and server can display and report
 * exactly which release is running.
 *
 * Source of truth is git tags (vMAJOR.MINOR.PATCH). When no tag exists yet the
 * package.json version is used as a fallback.
 *
 * Output is derived only from git state (no wall-clock values) so the generated
 * file stays stable between releases and does not dirty the working tree.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const git = (args, fallback = '') => {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

// CI checkouts (Cloudflare Workers Builds, GitHub Actions) are often shallow
// clones with no tags, which would silently degrade the version to a bare commit
// hash. Pull the tags once so the release label stays meaningful. Opt out with
// GIT_FETCH_TAGS=0 (e.g. offline builds).
if (process.env.GIT_FETCH_TAGS !== '0' && git('tag -l') === '') {
  git('fetch --tags --force --quiet');
}

const latestTag = git('describe --tags --abbrev=0'); // e.g. v0.1.0
const describe = git('describe --tags --always --dirty'); // e.g. v0.1.0-2-g1a2b3c4-dirty
const commit = git('rev-parse --short HEAD', 'unknown');
const commitFull = git('rev-parse HEAD', 'unknown');
const commitDate = git('log -1 --format=%cI', '');
const branch = git('rev-parse --abbrev-ref HEAD', 'unknown');
// Only tracked modifications count as dirty. Build-time artifacts that are
  // not committed (e.g. package-lock.json created by `npm install`, or the
  // generated version file itself) must not flip the badge to "-dirty".
  const dirty = git('status --porcelain --untracked-files=no').length > 0;

const version = (latestTag || `v${pkg.version}`).replace(/^v/, '');
const tag = `v${version}`;

// Commits since the last tag, used to show how far ahead of the release we are.
let commitsSinceTag = 0;
if (latestTag) {
  const count = git(`rev-list ${latestTag}..HEAD --count`, '0');
  commitsSinceTag = Number.parseInt(count, 10) || 0;
}

const ts = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT.
 * Produced by scripts/version.mjs from git tags and commit state.
 * Regenerate with: npm run version:sync
 */
export const VERSION = ${JSON.stringify(version)};
export const TAG = ${JSON.stringify(tag)};
export const COMMIT = ${JSON.stringify(commit)};
export const COMMIT_FULL = ${JSON.stringify(commitFull)};
export const COMMIT_DATE = ${JSON.stringify(commitDate)};
export const BRANCH = ${JSON.stringify(branch)};
export const DIRTY = ${dirty};
export const COMMITS_SINCE_TAG = ${commitsSinceTag};
export const DESCRIBE = ${JSON.stringify(describe)};

/** Short label for badges, e.g. "v0.1.0" or "v0.1.0+2". */
export const VERSION_LABEL = DESCRIBE.startsWith("v") ? DESCRIBE : TAG;
/** Full provenance string, e.g. "v0.1.0 (1a2b3c4) on main". */
export const VERSION_FULL = \`\${TAG} (\${COMMIT})\${DIRTY ? ' dirty' : ''} on \${BRANCH}\`;
`;

const outFile = resolve(root, 'src/generated/version.ts');
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, ts, 'utf8');

console.log(
  `[version] ${tag} · commit ${commit}${dirty ? ' (dirty)' : ''} · branch ${branch}` +
    (commitsSinceTag ? ` · ${commitsSinceTag} commit(s) since ${latestTag}` : '')
);

export { version, tag, commit, branch, dirty };
