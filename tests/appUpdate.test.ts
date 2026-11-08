// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUND_RELOAD_AFTER_MS, decideUpdate, fetchLatestBuildId } from '../src/services/appUpdate.ts';

const base = { current: 'a1', latest: 'b2', mode: 'idle' as const, returnedAfterHiddenMs: null };

test('same build, or no answer: nothing happens', () => {
  assert.equal(decideUpdate({ ...base, latest: 'a1' }), 'none');
  assert.equal(decideUpdate({ ...base, latest: null }), 'none');
  assert.equal(decideUpdate({ ...base, latest: null, mode: 'auto' }), 'none');
});

test('a page people use is never reloaded while they are on it - it only offers the update', () => {
  assert.equal(decideUpdate(base), 'banner');
  assert.equal(decideUpdate({ ...base, returnedAfterHiddenMs: 5_000 }), 'banner', 'a short app switch may be mid-form');
});

test('coming back after a real break updates before they start typing', () => {
  assert.equal(decideUpdate({ ...base, returnedAfterHiddenMs: BACKGROUND_RELOAD_AFTER_MS }), 'reload');
  assert.equal(decideUpdate({ ...base, returnedAfterHiddenMs: 60 * 60 * 1000 }), 'reload');
});

test('the unattended board reloads at once', () => {
  assert.equal(decideUpdate({ ...base, mode: 'auto' }), 'reload');
});

test('fetchLatestBuildId reads the id, defeats caches, and returns null on any failure', async () => {
  let asked = '';
  const ok = await fetchLatestBuildId(async (u, i) => { asked = u + JSON.stringify(i); return { ok: true, json: async () => ({ id: 'b2' }) }; }, 123);
  assert.equal(ok, 'b2');
  assert.match(asked, /^\/version\.json\?t=123/);
  assert.match(asked, /no-store/);
  assert.equal(await fetchLatestBuildId(async () => ({ ok: false, json: async () => ({}) })), null);
  assert.equal(await fetchLatestBuildId(async () => { throw new Error('offline'); }), null);
  assert.equal(await fetchLatestBuildId(async () => ({ ok: true, json: async () => ({ id: 5 }) })), null);
  assert.equal(await fetchLatestBuildId(async () => ({ ok: true, json: async () => { throw new Error('<html>'); } })), null);
});
