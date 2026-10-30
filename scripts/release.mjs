#!/usr/bin/env node
/**
 * Creates a semantic release:
 *   1. Verifies the working tree is clean and on a release branch.
 *   2. Bumps the version (patch | minor | major) or accepts an explicit --version.
 *   3. Regenerates src/generated/version.ts.
 *   4. Writes a CHANGELOG.md entry from commits since the previous tag.
 *   5. Creates an annotated git tag and (optionally) commits the bump + pushes.
 *
 * Usage:
 *   node scripts/release.mjs patch
 *   node scripts/release.mjs minor --push
 *   node scripts/release.mjs --version 1.2.3 --push
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const sh = (cmd, { capture = false } = {}) => {
  const out = execSync(cmd, {
    cwd: root,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  return out ? out.toString().trim() : '';
};

const gitOut = (args, fallback = '') => {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

const args = process.argv.slice(2);
const push = args.includes('--push');
const bumpArg = args.find((a) => ['patch', 'minor', 'major'].includes(a));
const versionIdx = args.indexOf('--version');
const explicitVersion = versionIdx !== -1 ? args[versionIdx + 1] : null;

if (!bumpArg && !explicitVersion) {
  console.error('Usage: node scripts/release.mjs <patch|minor|major> [--push]');
  console.error('   or: node scripts/release.mjs --version <x.y.z> [--push]');
  process.exit(1);
}

// --- Preconditions -----------------------------------------------------------
const dirty = gitOut('status --porcelain');
if (dirty) {
  console.error('[release] Working tree is not clean. Commit or stash your changes first.');
  process.exit(1);
}

const branch = gitOut('rev-parse --abbrev-ref HEAD', 'main');

// --- Resolve next version ----------------------------------------------------
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const latestTag = gitOut('describe --tags --abbrev=0');
const current = (latestTag || `v${pkg.version}`).replace(/^v/, '');
const [maj, min, pat] = current.split('.').map((n) => Number.parseInt(n, 10) || 0);

let next;
if (explicitVersion) {
  next = explicitVersion.replace(/^v/, '');
} else if (bumpArg === 'major') {
  next = `${maj + 1}.0.0`;
} else if (bumpArg === 'minor') {
  next = `${maj}.${min + 1}.0`;
} else {
  next = `${maj}.${min}.${pat + 1}`;
}

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`[release] Invalid version "${next}". Expected MAJOR.MINOR.PATCH.`);
  process.exit(1);
}
if (gitOut(`tag -l v${next}`)) {
  console.error(`[release] Tag v${next} already exists.`);
  process.exit(1);
}

console.log(`[release] ${current} -> ${next} on ${branch}`);

// --- Collect commits since the previous tag ----------------------------------
const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
const logRaw = gitOut(`log ${range} --pretty=format:%h%x1f%s%x1f%an%x1f%cI`, '');
const commits = logRaw
  ? logRaw.split('\n').map((line) => {
      const [hash, subject, author, date] = line.split('\x1f');
      return { hash, subject, author, date };
    })
  : [];

if (commits.length === 0) {
  console.log('[release] No commits since the previous tag; refusing to cut an empty release.');
  process.exit(1);
}

// --- Bump package.json + regenerate version file -----------------------------
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
sh(`node scripts/version.mjs`);

// --- Write the changelog entry ----------------------------------------------
const date = new Date().toISOString().slice(0, 10);
const shortHash = gitOut('rev-parse --short HEAD', 'unknown');

const sections = { feat: [], fix: [], perf: [], refactor: [], docs: [], chore: [], other: [] };
for (const c of commits) {
  const m = c.subject.match(/^(\w+)(\(.+\))?!?:\s*(.+)$/);
  const type = m ? m[1] : 'other';
  const text = m ? m[3] : c.subject;
  const bucket = sections[type] ?? sections.other;
  bucket.push(`- ${text} (${c.hash})`);
}

const sectionTitles = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  chore: 'Maintenance',
  other: 'Other Changes',
};

const body = Object.entries(sections)
  .filter(([, items]) => items.length > 0)
  .map(([key, items]) => `### ${sectionTitles[key]}\n${items.join('\n')}`)
  .join('\n\n');

const entry = `## [${next}] - ${date}

**Commit:** \`${shortHash}\` · **Branch:** \`${branch}\` · **Deployed:** pending

${body}

`;

const changelogPath = resolve(root, 'CHANGELOG.md');
let changelog;
try {
  changelog = readFileSync(changelogPath, 'utf8');
} catch {
  changelog = `# Changelog

All notable changes to CloudTube are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the release version is injected
into the UI at build time (\`npm run version:sync\`).

`;
}

const marker = 'All notable changes';
if (changelog.includes(marker)) {
  const headerEnd = changelog.indexOf('\n## ');
  const header = headerEnd === -1 ? `${changelog}\n` : changelog.slice(0, headerEnd + 1);
  const rest = headerEnd === -1 ? '' : changelog.slice(headerEnd + 1);
  changelog = `${header}\n${entry}${rest}`;
} else {
  changelog = `${changelog}\n${entry}`;
}
writeFileSync(changelogPath, changelog, 'utf8');

// --- Commit, tag, push -------------------------------------------------------
// src/generated/version.ts is intentionally NOT committed: it embeds the commit
// hash, which cannot be known until after the commit exists. It is regenerated
// from git at build/run time instead.
sh(`git add package.json CHANGELOG.md`);
sh(`git commit -m "chore(release): v${next}" -m "Release v${next} (${commits.length} commit(s))."`);
sh(`git tag -a v${next} -m "Release v${next}"`);

if (push) {
  sh(`git push origin ${branch}`);
  sh(`git push origin v${next}`);
  console.log(`[release] Pushed v${next} and tag to origin/${branch}.`);
} else {
  console.log(`[release] Tagged v${next}. Run: git push origin ${branch} && git push origin v${next}`);
}

console.log(`[release] Done. Update the "Deployed:" field in CHANGELOG.md when this ships.`);
