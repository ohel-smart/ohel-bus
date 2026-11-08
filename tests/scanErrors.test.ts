// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveWithCodes, scanErrorCodeOf, ScanSaveError, isConnectionCode, SaveDeadlinePassed } from '../src/services/scanErrors.ts';

const never = new Promise(() => {});
const fsError = (code: string) => Object.assign(new Error(code), { code });

async function codeOf(opts: { ready?: Promise<unknown>; write?: (deadline: number) => Promise<unknown>; online?: boolean | (() => boolean) }) {
  try {
    await saveWithCodes({
      ready: opts.ready ?? Promise.resolve(),
      write: opts.write ?? (() => Promise.resolve()),
      isOnline: typeof opts.online === 'function' ? opts.online : () => (opts.online as boolean | undefined) ?? true,
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

test('A5: a phone that says it is offline still gets the attempt - if it works, the scan is saved', async () => {
  let started = false;
  assert.equal(await codeOf({ write: () => { started = true; return Promise.resolve(); }, online: false }), 'ok');
  assert.equal(started, true, 'navigator.onLine is only a hint');
});

test('really offline: the attempt fails or hangs briefly and the code is 7970770', async () => {
  assert.equal(await codeOf({ write: () => never, online: false }), '7970770');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unavailable')), online: false }), '7970770');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('invalid-argument')), online: false }), '555770', 'a site bug is a site bug offline too');
});

test('a phone that says it is offline waits only the short offline limit, not the full one', async () => {
  const t0 = Date.now();
  try {
    await saveWithCodes({ ready: Promise.resolve(), write: () => never, isOnline: () => false, readyTimeoutMs: 5_000, writeTimeoutMs: 5_000, offlineTimeoutMs: 40 });
    assert.fail('should have failed');
  } catch (e) {
    assert.equal(scanErrorCodeOf(e), '7970770');
  }
  assert.ok(Date.now() - t0 < 1_000);
});

test('write that never confirms while online -> 7970771; internet lost meanwhile -> 7970770', async () => {
  assert.equal(await codeOf({ write: () => never, online: true }), '7970771');
  let calls = 0;
  assert.equal(await codeOf({ write: () => never, online: () => calls++ < 1 }), '7970770');
});

test('the write gets a deadline before the on-screen time limit, and a retry past it is refused', async () => {
  let seen = 0;
  const t0 = Date.now();
  assert.equal(await codeOf({ write: (d) => { seen = d; return Promise.resolve(); } }), 'ok');
  assert.ok(seen > t0 && seen <= t0 + 30, 'deadline within the 30 ms write limit');
  assert.equal(await codeOf({ write: () => Promise.reject(new SaveDeadlinePassed()) }), '7970771');
});

test('sign-in that never finishes: 888771 (or 7970770 if the internet went), and no write starts', async () => {
  let started = false;
  const write = () => { started = true; return Promise.resolve(); };
  assert.equal(await codeOf({ ready: never, write, online: true }), '888771');
  let calls = 0;
  assert.equal(await codeOf({ ready: never, write, online: () => calls++ < 1 }), '7970770');
  assert.equal(started, false);
});

test('database refusals map to the 888 codes', async () => {
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('resource-exhausted')) }), '888770');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('permission-denied')) }), '888771');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unauthenticated')) }), '888771');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unavailable')) }), '888772');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('internal')) }), '888779');
});

test('A4: a malformed request is a site bug (555770); the server timing out while online is a connection problem (7970771)', async () => {
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('invalid-argument')) }), '555770');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('deadline-exceeded')) }), '7970771');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('aborted')) }), '888779', 'other errors stay database errors');
});

test('an unavailable/unknown error after the internet went is reported as no internet', async () => {
  const goesOffline = () => { let n = 0; return () => n++ < 1; }; // online when the save starts, offline by the time it fails
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('unavailable')), online: goesOffline() }), '7970770');
  assert.equal(await codeOf({ write: () => Promise.reject(fsError('deadline-exceeded')), online: goesOffline() }), '7970770');
  assert.equal(await codeOf({ write: () => Promise.reject(new Error('x')), online: goesOffline() }), '7970770');
});

test('a non-save error (site bug) is 555770', () => {
  assert.equal(scanErrorCodeOf(new TypeError('boom')), '555770');
  assert.equal(scanErrorCodeOf(undefined), '555770');
});

test('797 codes are the phone connection, the rest are not', () => {
  assert.equal(isConnectionCode('7970770'), true);
  assert.equal(isConnectionCode('7970771'), true);
  for (const c of ['888770', '888771', '888772', '888779', '555770'] as const) assert.equal(isConnectionCode(c), false);
});
