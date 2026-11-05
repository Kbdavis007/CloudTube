import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveLegalPage } from '../worker/legalPages';

const publicFile = (name: string) => path.resolve(process.cwd(), 'public', name);

const privacy = readFileSync(publicFile('privacy.html'), 'utf8');
const tos = readFileSync(publicFile('tos.html'), 'utf8');
const legalCss = readFileSync(publicFile('legal.css'), 'utf8');

test('the friendly paths resolve to the legal pages', () => {
  assert.equal(resolveLegalPage('/privacy'), 'privacy.html');
  assert.equal(resolveLegalPage('/tos'), 'tos.html');
});

test('a trailing slash still resolves, so a hand-typed URL works', () => {
  assert.equal(resolveLegalPage('/privacy/'), 'privacy.html');
  assert.equal(resolveLegalPage('/tos/'), 'tos.html');
});

test('unrelated paths are left to the SPA', () => {
  for (const p of ['/', '/dashboard', '/settings', '/privacy.html', '/tos.html', '/api/health']) {
    assert.equal(resolveLegalPage(p), null, `${p} must not be treated as a legal page`);
  }
});

test('the privacy policy is a dedicated, self-contained HTML page', () => {
  assert.match(privacy, /^<!doctype html>/i);
  assert.match(privacy, /<title>Privacy Policy/);
  // Served straight from public/ with no build step, so it must carry its own
  // styling and must not depend on the app bundle.
  assert.match(privacy, /<link rel="stylesheet" href="\/legal\.css"/);
  assert.doesNotMatch(privacy, /<script/i, 'a policy a crawler reads needs no JavaScript');
});

test('the privacy policy names the app and how to make contact', () => {
  assert.match(privacy, /CloudTube/);
  assert.match(privacy, /mailto:kbdavis0007@gmail\.com/);
});

test('the privacy policy carries the Limited Use disclosure Google requires', () => {
  assert.match(privacy, /Limited Use/);
  assert.match(privacy, /Google API Services User Data Policy/);
  assert.match(privacy, /developers\.google\.com\/terms\/api-services-user-data-policy/);
});

test('the privacy policy says how to delete data and revoke access', () => {
  assert.match(privacy, /myaccount\.google\.com\/permissions/);
  assert.match(privacy, /IndexedDB/);
});

test('the terms page is a dedicated, self-contained HTML page', () => {
  assert.match(tos, /^<!doctype html>/i);
  assert.match(tos, /<title>Terms of Service/);
  assert.match(tos, /<link rel="stylesheet" href="\/legal\.css"/);
  assert.doesNotMatch(tos, /<script/i);
  assert.match(tos, /mailto:kbdavis0007@gmail\.com/);
});

test('the two pages link to each other, so a reviewer can navigate them', () => {
  assert.match(privacy, /href="\/tos"/);
  assert.match(tos, /href="\/privacy"/);
});

test('the shared stylesheet exists for the standalone pages', () => {
  assert.match(legalCss, /\.wrap/);
  assert.match(legalCss, /@media print/);
});
