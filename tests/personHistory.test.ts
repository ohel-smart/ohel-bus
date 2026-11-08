// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_MAX_DAYS, mergeHistory, nextHistorySlice } from '../src/services/personHistory.ts';

const TODAY = '2026-11-08';

test('the first slice is the 7 days before today (today itself is live, not part of it)', () => {
  assert.deepEqual(nextHistorySlice(TODAY, 0), { from: '2026-11-01', to: '2026-11-07', loadedDaysAfter: 7 });
});

test('slices are consecutive and never overlap, so each fetch reads only new days', () => {
  const seen = new Set<string>();
  let loaded = 0, slices = 0;
  for (let s = nextHistorySlice(TODAY, loaded); s; s = nextHistorySlice(TODAY, loaded)) {
    for (let d = new Date(`${s.from}T12:00:00Z`); d <= new Date(`${s.to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      assert.ok(!seen.has(k), `${k} fetched twice`);
      seen.add(k);
    }
    loaded = s.loadedDaysAfter; slices++;
    assert.ok(slices < 20);
  }
  assert.equal(seen.size, HISTORY_MAX_DAYS, 'exactly the 30 days before today');
  assert.ok(seen.has('2026-10-09') && !seen.has('2026-10-08'), 'the oldest day is 30 days back');
  assert.equal(slices, 5, '7+7+7+7+2');
});

test('nothing further back than 30 days can be reached', () => {
  assert.equal(nextHistorySlice(TODAY, HISTORY_MAX_DAYS), null);
  assert.equal(nextHistorySlice(TODAY, 99), null);
  assert.deepEqual(nextHistorySlice(TODAY, 28), { from: '2026-10-09', to: '2026-10-10', loadedDaysAfter: 30 });
});

test('works across month and year ends', () => {
  assert.deepEqual(nextHistorySlice('2026-01-03', 0), { from: '2025-12-27', to: '2026-01-02', loadedDaysAfter: 7 });
});

test('mergeHistory keeps one copy per id, newest data wins', () => {
  const out = mergeHistory([{ id: 'a', n: 1 }, { id: 'b', n: 1 }], [{ id: 'b', n: 2 }, { id: 'c', n: 1 }]);
  assert.deepEqual(out.map(s => `${s.id}${s.n}`).sort(), ['a1', 'b2', 'c1']);
});
