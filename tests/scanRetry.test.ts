// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETRY_ID_MAX_AGE_MS, forgetFailed, idForScan, rememberFailed, retryKey, type FailedScan } from '../src/services/scanRetry.ts';

const live = { driverId: 'd1', departureLocation: '770' };
let n = 0;
const fresh = () => `new${++n}`;

test('a retry of a failed scan reuses its id, so a scan that secretly landed is not duplicated', () => {
  const m = new Map<string, FailedScan>();
  const k = retryKey(live);
  const first = idForScan(m, k, 1_000, fresh);
  rememberFailed(m, k, first, 1_000);
  assert.equal(idForScan(m, k, 60_000, fresh), first);
});

test('after a success (or after 20 minutes) the next scan gets a new id', () => {
  const m = new Map<string, FailedScan>();
  const k = retryKey(live);
  rememberFailed(m, k, 'old', 0);
  forgetFailed(m, k);
  assert.notEqual(idForScan(m, k, 10, fresh), 'old');
  rememberFailed(m, k, 'old2', 0);
  assert.notEqual(idForScan(m, k, RETRY_ID_MAX_AGE_MS + 1, fresh), 'old2');
  assert.equal(m.size, 0, 'stale entries are dropped');
});

test('a different driver, or the other departure place, is a different scan', () => {
  const m = new Map<string, FailedScan>();
  rememberFailed(m, retryKey(live), 'x', 0);
  assert.notEqual(idForScan(m, retryKey({ ...live, driverId: 'd2' }), 1, fresh), 'x');
  assert.notEqual(idForScan(m, retryKey({ ...live, departureLocation: 'Ohel' }), 1, fresh), 'x');
});

test('manually entered past rides are told apart by the time typed, and never merge with a live scan', () => {
  const a = retryKey({ ...live, isLateEntry: true, scannedAt: '2026-11-07T10:00:00.000Z' });
  const b = retryKey({ ...live, isLateEntry: true, scannedAt: '2026-11-07T11:00:00.000Z' });
  assert.notEqual(a, b);
  assert.notEqual(a, retryKey(live));
  assert.equal(a, retryKey({ ...live, isLateEntry: true, scannedAt: '2026-11-07T10:00:00.000Z' }), 'the same typed ride retried is the same');
});

test('a driver self-report carries a typed time too: two different self-reported rides never merge', () => {
  const r1 = retryKey({ ...live, dispatcherId: 'self_report', scannedAt: '2026-11-08T10:00:00.000Z' });
  const r2 = retryKey({ ...live, dispatcherId: 'self_report', scannedAt: '2026-11-08T10:40:00.000Z' });
  assert.notEqual(r1, r2);
  assert.equal(r1, retryKey({ ...live, dispatcherId: 'self_report', scannedAt: '2026-11-08T10:00:00.000Z' }));
  assert.notEqual(r1, retryKey({ ...live, dispatcherId: 'disp1' }));
});
