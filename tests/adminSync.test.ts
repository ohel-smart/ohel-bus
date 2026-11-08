// Run: node --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  liveFromDate, settledBeforeDate, planSync, applyPartial, nextSyncedAt, marksFor, integrityVerdict, uniqueById,
  CACHE_VERSION, FULL_REFRESH_MS, SETTLE_MS, type AdminCache,
} from '../src/services/adminSync.ts';

const prevDay = (ymd: string) => {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
// Plain New York midnight rollover (the Erev Shabbat cutover only moves the boundary earlier,
// which makes a day settle earlier - never later - so it cannot hide a change).
const nyDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

type S = { id: string; logicalDate: string };
const NOW = Date.parse('2026-11-10T15:00:00Z'); // 10:00 NY
const cache = (over: Partial<AdminCache<S>> = {}): AdminCache<S> => ({
  v: CACHE_VERSION, scans: [], savedAtMs: NOW - 3600_000, settledBefore: '2026-11-08',
  syncedAtMs: 1000, fullAtMs: NOW - 86400_000, ...over,
});

test('live part = today and the two days before', () => {
  assert.equal(liveFromDate('2026-11-10', prevDay), '2026-11-08');
  assert.equal(liveFromDate('2026-03-01', prevDay), '2026-02-27');
});

test('a day is settled only once it ended more than 4 hours before the save', () => {
  // saved 10:00 NY on the 10th -> 06:00 NY is still the 10th -> days before the 10th are settled
  assert.equal(settledBeforeDate(NOW, nyDate), '2026-11-10');
  // saved 02:00 NY on the 10th -> 22:00 NY on the 9th -> only days before the 9th are settled
  assert.equal(settledBeforeDate(Date.parse('2026-11-10T07:00:00Z'), nyDate), '2026-11-09');
  assert.equal(SETTLE_MS, 4 * 3600_000);
});

test('full reload: no copy, old format, a month old, or a rename across all trips', () => {
  assert.deepEqual(planSync(null, [], '2026-11-08', NOW), { kind: 'full', reason: 'no-cache' });
  assert.deepEqual(planSync(cache({ v: 0 }), [], '2026-11-08', NOW), { kind: 'full', reason: 'old-format' });
  assert.deepEqual(planSync(cache({ fullAtMs: NOW - FULL_REFRESH_MS - 1 }), [], '2026-11-08', NOW), { kind: 'full', reason: 'monthly-refresh' });
  assert.deepEqual(planSync(cache(), [{ date: '_all', updatedAtMs: 2000 }], '2026-11-08', NOW), { kind: 'full', reason: 'renamed' });
  // an old rename mark that was already applied does not force another full reload
  assert.equal(planSync(cache(), [{ date: '_all', updatedAtMs: 1000 }], '2026-11-08', NOW).kind, 'partial');
});

test('partial: only days marked after the last sync, older than the live part', () => {
  const marks = [
    { date: '2026-10-01', updatedAtMs: 5000 },  // edited old day -> refetch
    { date: '2026-10-01', updatedAtMs: 6000 },  // same day twice -> once
    { date: '2026-09-15', updatedAtMs: 900 },   // already applied -> skip
    { date: '2026-11-09', updatedAtMs: 7000 },  // live part -> the listener has it
    { date: '2026-10-20', updatedAtMs: 7000 },
  ];
  assert.deepEqual(planSync(cache({ settledBefore: '2026-11-08' }), marks, '2026-11-08', NOW),
    { kind: 'partial', rangeFrom: null, dates: ['2026-10-01', '2026-10-20'] });
});

test('days that were not settled when the copy was saved are refetched once they leave the live part', () => {
  // copy saved on the 5th (settled before the 5th); now the live part starts on the 8th
  const plan = planSync(cache({ settledBefore: '2026-11-05' }), [
    { date: '2026-11-06', updatedAtMs: 5000 },   // inside the range anyway -> not listed twice
    { date: '2026-11-01', updatedAtMs: 5000 },
  ], '2026-11-08', NOW);
  assert.deepEqual(plan, { kind: 'partial', rangeFrom: '2026-11-05', dates: ['2026-11-01'] });
});

test('applyPartial replaces refetched days completely (also days that became empty) and drops the live part', () => {
  const cached: S[] = [
    { id: 'a', logicalDate: '2026-10-01' }, { id: 'b', logicalDate: '2026-10-01' }, // b was deleted on the server
    { id: 'c', logicalDate: '2026-10-02' },                                          // untouched
    { id: 'd', logicalDate: '2026-11-05' }, { id: 'e', logicalDate: '2026-11-06' },  // unsettled range
    { id: 'f', logicalDate: '2026-11-09' },                                          // live part
    { id: 'g', logicalDate: '2026-10-03' },                                          // its day is now empty
  ];
  const plan = { kind: 'partial' as const, rangeFrom: '2026-11-05', dates: ['2026-10-01', '2026-10-03'] };
  const fetched: S[] = [{ id: 'a', logicalDate: '2026-10-01' }, { id: 'e', logicalDate: '2026-11-06' }, { id: 'h', logicalDate: '2026-11-07' }];
  const out = applyPartial(cached, plan, fetched, '2026-11-08').map(s => s.id).sort();
  assert.deepEqual(out, ['a', 'c', 'e', 'h']);
});

test('sync time never goes backwards; marks only for valid dates, once', () => {
  assert.equal(nextSyncedAt(5000, [{ date: 'x', updatedAtMs: 3000 }, { date: 'y', updatedAtMs: 8000 }]), 8000);
  assert.equal(nextSyncedAt(5000, []), 5000);
  assert.deepEqual(marksFor(['2026-11-10', '2026-11-10', '', undefined, null, '2026-1-5', '2026-11-09']), ['2026-11-10', '2026-11-09']);
});

test('end to end on a simulated month: the device copy always equals the server', () => {
  // A small simulated server; every write by the site marks its day, the bot edits recent
  // trips without marking. After each "open", the device copy must match the server exactly.
  type T = S & { rev: number; at: number };
  let server: T[] = [];
  const marks: { date: string; updatedAtMs: number }[] = [];
  let clock = Date.parse('2026-10-01T12:00:00Z');
  let device: AdminCache<T> | null = null;
  let seq = 0;
  const rand = (() => { let s = 99; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
  const today = () => nyDate(new Date(clock).toISOString());
  const siteWrite = (date: string) => marks.push({ date, updatedAtMs: clock });

  const open = () => {
    const liveFrom = liveFromDate(today(), prevDay);
    const plan = planSync(device, marks, liveFrom, clock);
    let older: T[];
    let full = 0;
    if (plan.kind === 'full') { older = server.filter(s => s.logicalDate < liveFrom).map(s => ({ ...s })); full = clock; }
    else {
      const fetched = server.filter(s => plan.dates.includes(s.logicalDate) || (plan.rangeFrom !== null && s.logicalDate >= plan.rangeFrom && s.logicalDate < liveFrom)).map(s => ({ ...s }));
      older = applyPartial(device!.scans, plan, fetched, liveFrom);
    }
    const live = server.filter(s => s.logicalDate >= liveFrom).map(s => ({ ...s }));
    const view = [...older, ...live];
    const key = (x: T[]) => JSON.stringify([...x].sort((a, b) => a.id.localeCompare(b.id)));
    assert.equal(key(view), key(server), `device copy differs from the server at ${new Date(clock).toISOString()}`);
    device = {
      v: CACHE_VERSION, scans: view, savedAtMs: clock, settledBefore: settledBeforeDate(clock, nyDate),
      syncedAtMs: nextSyncedAt(device?.syncedAtMs ?? 0, marks), fullAtMs: full || device!.fullAtMs,
    };
  };

  for (let step = 0; step < 2000; step++) {
    clock += Math.floor(rand() * 90) * 60_000; // up to 1.5 h
    const r = rand();
    const d = today();
    if (r < 0.45) { server.push({ id: 's' + seq++, logicalDate: d, rev: 0, at: clock }); siteWrite(d); }       // new scan
    else if (r < 0.55 && server.length) {                                                                        // bot edit, recent only, no mark
      const recent = server.filter(s => clock - s.at < 3 * 3600_000);
      if (recent.length) recent[Math.floor(rand() * recent.length)].rev++;
    } else if (r < 0.62 && server.length) {                                                                      // manager edits any trip
      const s = server[Math.floor(rand() * server.length)]; s.rev++; siteWrite(s.logicalDate);
    } else if (r < 0.66 && server.length) {                                                                      // manager deletes any trip
      const i = Math.floor(rand() * server.length); const [s] = server.splice(i, 1); siteWrite(s.logicalDate);
    } else if (r < 0.70) {                                                                                       // late entry for yesterday
      const y = prevDay(d); server.push({ id: 's' + seq++, logicalDate: y, rev: 0, at: clock }); siteWrite(y);
    } else if (r < 0.71) { server.forEach(s => s.rev++); marks.push({ date: '_all', updatedAtMs: clock }); }    // rename
    else if (r < 0.80) open();                                                                                     // manager opens the site
  }
  open();
});

test('integrity check: equal counts are fine; a difference triggers one full re-read, unless the full read was just done', () => {
  assert.equal(integrityVerdict({ localCount: 341, serverCount: 341, justReadInFull: false }), 'ok');
  assert.equal(integrityVerdict({ localCount: 340, serverCount: 341, justReadInFull: false }), 'reload', 'a trip missing from the copy');
  assert.equal(integrityVerdict({ localCount: 342, serverCount: 341, justReadInFull: false }), 'reload', 'a deleted trip still in the copy');
  assert.equal(integrityVerdict({ localCount: 340, serverCount: 341, justReadInFull: true }), 'accept', 'no loop: the server was just read in full');
  assert.equal(integrityVerdict({ localCount: 0, serverCount: 0, justReadInFull: true }), 'ok');
});

test('C5: a trip that moved to another day never shows twice, and the freshly read copy wins', () => {
  const liveFrom = '2026-11-08';
  const stale = { id: 't1', logicalDate: '2026-11-03', n: 'old' };
  const other = { id: 't2', logicalDate: '2026-11-03', n: 'x' };
  const moved = { id: 't1', logicalDate: '2026-11-04', n: 'fresh' };
  // only the NEW day was refetched (the old day's mark was never written)
  const out = applyPartial([stale, other], { kind: 'partial', rangeFrom: null, dates: ['2026-11-04'] }, [moved], liveFrom);
  assert.deepEqual(out.map(s => `${s.id}:${s.logicalDate}:${s.n}`).sort(), ['t1:2026-11-04:fresh', 't2:2026-11-03:x']);
});

test('uniqueById: last wins, order of first appearance, entries without an id are untouched', () => {
  const out = uniqueById([{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { v: 9 }, { id: 'a', v: 2 }, { v: 9 }]);
  assert.deepEqual(out, [{ id: 'a', v: 2 }, { id: 'b', v: 1 }, { v: 9 }, { v: 9 }]);
  assert.deepEqual(uniqueById([]), []);
});
