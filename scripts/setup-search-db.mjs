/**
 * Enable the D1-backed search cache.
 *
 * The Worker code and the schema already ship; the only thing missing on a
 * fresh account is the database itself and its binding. This script creates the
 * database, applies the migration, and writes the binding into wrangler.jsonc,
 * so the durable layer is one command instead of a manual dashboard trip.
 *
 * Usage:
 *   node scripts/setup-search-db.mjs            # create + bind + migrate
 *   node scripts/setup-search-db.mjs --status   # show current binding
 *
 * Requires CLOUDFLARE_API_TOKEN (Workers Scripts: Edit + D1: Edit) and
 * CLOUDFLARE_ACCOUNT_ID, or a prior `wrangler login`. Until it is run the search
 * API still works — it falls back to the Cloudflare edge cache and the service
 * worker, just without the durable cross-colo layer.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wranglerPath = resolve(root, 'wrangler.jsonc');
const DB_NAME = 'cloudtube-search';
const BINDING = 'DB';

const wrangler = (args, { capture = true } = {}) =>
  execFileSync('npx', ['--yes', 'wrangler', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

const currentBinding = () => {
  const text = readFileSync(wranglerPath, 'utf8');
  const match = text.match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/i);
  return match ? match[1] : null;
};

if (process.argv.includes('--status')) {
  const id = currentBinding();
  console.log(id ? `[search-db] binding ${BINDING} -> ${id}` : '[search-db] no D1 binding yet');
  process.exit(0);
}

if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error(
    '[search-db] Set CLOUDFLARE_API_TOKEN (Workers Scripts: Edit + D1: Edit) and\n' +
      '            CLOUDFLARE_ACCOUNT_ID, or run `npx wrangler login` first.'
  );
  process.exit(1);
}

// 1. Create the database (idempotent: reuse the existing one if present).
let databaseId = currentBinding();
if (!databaseId) {
  console.log(`[search-db] creating D1 database "${DB_NAME}"...`);
  const out = wrangler(['d1', 'create', DB_NAME]);
  const created = out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i) ?? out.match(/"([0-9a-f-]{36})"/i);
  if (!created) {
    console.error('[search-db] could not parse a database id from:\n' + out);
    process.exit(1);
  }
  databaseId = created[1];
  console.log(`[search-db] created ${databaseId}`);
} else {
  console.log(`[search-db] reusing existing database ${databaseId}`);
}

// 2. Write the binding into wrangler.jsonc, replacing any placeholder.
const text = readFileSync(wranglerPath, 'utf8');
const block = `  "d1_databases": [
    {
      "binding": "${BINDING}",
      "database_name": "${DB_NAME}",
      "database_id": "${databaseId}"
    }
  ],`;

let next;
if (/"d1_databases"\s*:/.test(text)) {
  next = text.replace(/"d1_databases"\s*:\s*\[[\s\S]*?\],/, block);
} else {
  next = text.replace(/"previews"\s*:\s*\{\}/, `"previews": {},\n${block}`);
}
if (next === text) {
  console.error('[search-db] could not find an anchor to insert the binding into wrangler.jsonc');
  process.exit(1);
}
writeFileSync(wranglerPath, next);
console.log(`[search-db] wrote binding ${BINDING} into wrangler.jsonc`);

// 3. Apply the migration (the Worker also creates the table lazily, so this is
//    belt-and-braces for a clean first deploy).
const migration = resolve(root, 'migrations/0001_video_search_cache.sql');
if (existsSync(migration)) {
  console.log('[search-db] applying migration 0001_video_search_cache.sql...');
  wrangler(['d1', 'execute', BINDING, '--remote', '--file', migration], { capture: false });
}

console.log(
  '\n[search-db] done. Commit wrangler.jsonc and deploy:\n' +
    '  git add wrangler.jsonc && git commit -m "chore(search): enable D1 search cache"\n' +
    '  npm run deploy'
);
