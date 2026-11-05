import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LandingSplashView } from '../src/components/views/LandingSplashView';

/**
 * The signed-out landing page is the app's homepage, and Google's OAuth
 * verification requires the privacy policy to be linked from it. These tests
 * render the real component so a refactor that drops the links fails here.
 */
const html = renderToStaticMarkup(
  React.createElement(LandingSplashView, { onAuthSuccess: () => {} })
);

test('the homepage links to the privacy policy and terms', () => {
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/tos"/);
});

test('the homepage still offers the Google sign-in', () => {
  assert.match(html, /Sign in with Google/);
});
