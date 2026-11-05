import test from 'node:test';
import assert from 'node:assert/strict';

import { loadViewState, saveViewState } from '../src/services/viewState';

/** Minimal localStorage stand-in; node has no DOM. */
function installLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  (globalThis as any).localStorage = storage;
  return { data, storage };
}

const KEY = 'cloudtube.view_state';

test('a reload restores the last view instead of the dashboard', () => {
  installLocalStorage();

  saveViewState({ tab: 'channels', selectedVideoId: '' });

  // A fresh page load reads the stored view.
  assert.deepEqual(loadViewState(), { tab: 'channels', selectedVideoId: '' });
});

test('the selected video is restored with the Videos tab', () => {
  installLocalStorage();

  saveViewState({ tab: 'player', selectedVideoId: 'dQw4w9WgXcQ' });

  assert.deepEqual(loadViewState(), { tab: 'player', selectedVideoId: 'dQw4w9WgXcQ' });
});

test('the first load with nothing stored falls back to the dashboard', () => {
  installLocalStorage();

  assert.deepEqual(loadViewState(), { tab: 'dashboard', selectedVideoId: '' });
});

test('a corrupt stored value falls back to the dashboard', () => {
  const { storage } = installLocalStorage();
  storage.setItem(KEY, '{not json');

  assert.deepEqual(loadViewState(), { tab: 'dashboard', selectedVideoId: '' });
});

test('an unknown tab is ignored rather than restored', () => {
  const { storage } = installLocalStorage();
  storage.setItem(KEY, JSON.stringify({ tab: 'not-a-real-tab', selectedVideoId: 'x' }));

  assert.deepEqual(loadViewState(), { tab: 'dashboard', selectedVideoId: '' });
});

test('a non-string selectedVideoId is normalised to empty', () => {
  const { storage } = installLocalStorage();
  storage.setItem(KEY, JSON.stringify({ tab: 'player', selectedVideoId: 42 }));

  assert.deepEqual(loadViewState(), { tab: 'player', selectedVideoId: '' });
});

test('storage write failures do not throw', () => {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {},
    clear: () => {},
  };

  assert.doesNotThrow(() => saveViewState({ tab: 'settings', selectedVideoId: '' }));
  assert.deepEqual(loadViewState(), { tab: 'dashboard', selectedVideoId: '' });
});
