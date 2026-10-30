#!/usr/bin/env node
/**
 * Records a deployment of the current build and keeps the release log in sync.
 *
 * It:
 *   1. Reads the version/commit from src/generated/version.ts.
 *   2. Appends a row to docs/DEPLOYMENTS.md (the deployment ledger).
 *   3. Flips "Deployed: pending" to the deployment timestamp for this version
 *      in CHANGELOG.md.
 *
 * Usage:
 *   node scripts/deploy.mjs --env production --url https://cloudtube.example --notes "first prod ship"
 *   node scripts/deploy.mjs --env preview --push
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
};
const push = process.argv.includes('--push');

const env = arg('--env', 'local');
const url = arg('--url', '—');
const notes = arg('--notes', '');
const actor = arg('--actor', process.env.GITHUB_ACTOR || 'local');

// Pull the build's identity straight from the generated module (single source).
const versionSrc = readFileSync(resolve(root, 'src/generated/version.ts'), 'utf8');
const pick = (key) => versionSrc.match(new RegExp(`export const ${key} = "([^"]*)"`))?.[1] ?? 'unknown';
const version = pick('VERSION');
const tag = pick('TAG');
const commit = pick('COMMIT');
const branch = pick('BRANCH');

const now = new Date().toISOString();
const stamp = now.replace('T', ' ').slice(0, 16) + ' UTC';

// --- 1. Append to the deployment ledger -------------------------------------
const ledgerPath = resolve(root, 'docs/DEPLOYMENTS.md');
const row = `| ${stamp} | \`${tag}\` | \`${commit}\` | ${env} | ${url} | ${actor} | ${notes || '—'} |`;

let ledger;
if (existsSync(ledgerPath)) {
  ledger = readFileSync(ledgerPath, 'utf8');
} else {
  ledger = `# Deployment Ledger

Every deployment of CloudTube is recorded here. The version shown is the git tag
the build was cut from; the commit is the exact revision that was served.

| Deployed (UTC) | Version | Commit | Environment | URL | Actor | Notes |
| --- | --- | --- | --- | --- | --- | --- |
`;
}

const header = '| Deployed (UTC) | Version | Commit | Environment | URL | Actor | Notes |';
const sep = '| --- | --- | --- | --- | --- | --- | --- |';
if (!ledger.includes(header)) {
  ledger = `${ledger.trimEnd()}\n\n${header}\n${sep}\n`;
}
ledger = `${ledger.trimEnd()}\n${row}\n`;
writeFileSync(ledgerPath, ledger, 'utf8');
console.log(`[deploy] Logged ${tag} (${commit}) to docs/DEPLOYMENTS.md`);

// --- 2. Mark the CHANGELOG entry as deployed --------------------------------
const changelogPath = resolve(root, 'CHANGELOG.md');
if (existsSync(changelogPath)) {
  let changelog = readFileSync(changelogPath, 'utf8');
  const heading = `## [${version}]`;
  const idx = changelog.indexOf(heading);
  if (idx !== -1) {
    const before = changelog.slice(0, idx);
    const after = changelog.slice(idx);
    if (after.includes('**Deployed:** pending')) {
      changelog = before + after.replace('**Deployed:** pending', `**Deployed:** ${stamp} (${env})`);
      writeFileSync(changelogPath, changelog, 'utf8');
      console.log(`[deploy] Marked ${tag} as deployed in CHANGELOG.md`);
    }
  }
}

if (push) {
  execSync('git add docs/DEPLOYMENTS.md CHANGELOG.md', { cwd: root, stdio: 'inherit' });
  execSync(`git commit -m "chore(deploy): ${tag} to ${env}"`, { cwd: root, stdio: 'inherit' });
  execSync(`git push origin ${branch}`, { cwd: root, stdio: 'inherit' });
  console.log(`[deploy] Committed and pushed deployment record for ${tag}.`);
}
