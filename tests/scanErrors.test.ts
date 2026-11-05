// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveWithCodes, scanErrorCodeOf, ScanSaveError, mayStillArrive } from '../src/services/scanErrors.ts';

const never = new Promise(() => {});
const fsError = (code: string) => Object.assign(new Error(code), { code });

async function codeOf(opts: { ready?: Promise<unknown>; write?: () => Promise<unknown>; online?: boolean }) {
  try {
    await saveWithCodes({
      ready: opts.ready ?? Promise.resolve(),
      write: opts.write ?? (() => Promise.resolve()),
      isOnline: () => opts.online ?? true,
      readyTimeoutMs: 30,
      writeTimeoutMs: 30,
    });
    return 'ok';
  } catch (e) {
    assert.ok(e instanceof ScanSaveError, 'always a ScanSaveError');
    return scanErrorCodeOf(e);
  }
}

test('a normal save resolves', async () => {
  assert.equal(await codeOf({}), 'ok');
});

test('write that never confirms: offline -> 7970770, online -> 7970771', async () => {
  assert.equal(await codeOf({ write: () => never, online: false }), '7970770');
  assert.equal(await codeOf({ write: () => never, online: true }), '7970771');
});

test('sign-in that never finishes: offline -> 7970770, online -> 888771, and no write starts', async () => {
  let started = false;
  const write = () => { started = true; return Promise.resolve(); };
  assert.equal(await codeOf({ ready: never, write, online: false }), '7970770');
  assert.equal(await codeOf({ ready: never, write, online: true }), '888771');
  assert.equal(started, false);
});

test('database refusals map to the 888 codes', async () => {
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('resource-exhausted')) }), '888770');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('permission-denied')) }), '888771');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unauthenticated')) }), '888771');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unavailable')) }), '888772');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('internal')) }), '888779');
});

test('an unavailable/unknown error while offline is reported as no internet', async () => {
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unavailable')), online: false }), '7970770');
  assert.equal(await codeOf({ write: () => Promise.reject(new Error('x')), online: false }), '7970770');
});

test('a non-save error (site bug) is 555770', () => {
  assert.equal(scanErrorCodeOf(new TypeError('boom')), '555770');
  assert.equal(scanErrorCodeOf(undefined), '555770');
});

test('only the connection codes say the scan may still arrive by itself', () => {
  assert.equal(mayStillArrive('7970770'), true);
  assert.equal(mayStillArrive('7970771'), true);
  for (const c of ['888770', '888771', '888772', '888779', '555770'] as const) assert.equal(mayStillArrive(c), false);
});
