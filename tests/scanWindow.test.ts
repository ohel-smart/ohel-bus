// Run with: node --test tests/scanWindow.test.ts   (Node 24 runs TypeScript directly)
import test from 'node:test';
import assert from 'node:assert';
import { windowBounds, inWindow, inPersonRange, OPEN_TRIP_LOOKBACK_MS } from '../src/services/scanWindow.ts';

// A stand-in for dbService.getLogicalDate: the New York calendar day. (The Erev Shabbat early
// cutover is injected per test, since it needs Hebcal.)
const nyDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));

const scan = (scannedAt: string, logicalDate = nyDay(scannedAt), extra = {}) => ({ scannedAt, logicalDate, driverId: 'd1', dispatcherId: 's1', ...extra });

test('window = the logical day plus the last 3 hours', () => {
  const now = new Date('2026-11-04T18:00:00Z'); // 13:00 New York
  const b = windowBounds(now, nyDay);
  assert.strictEqual(b.logicalDate, '2026-11-04');
  assert.strictEqual(b.sinceIso, '2026-11-04T15:00:00.000Z');
  assert.ok(inWindow(scan('2026-11-04T12:00:00Z'), b), 'a trip earlier today is in');
  assert.ok(!inWindow(scan('2026-11-03T12:00:00Z'), b), 'yesterday is out');
});

test('a trip that crosses midnight stays visible after the day rolls over', () => {
  // left 23:50 NY on Nov 4 (04:50Z Nov 5); now it is 00:20 NY on Nov 5 and the trip is still open
  const b = windowBounds(new Date('2026-11-05T05:20:00Z'), nyDay);
  assert.strictEqual(b.logicalDate, '2026-11-05');
  assert.ok(inWindow(scan('2026-11-05T04:50:00Z'), b), 'caught by the 3-hour lookback');
  assert.ok(!inWindow(scan('2026-11-05T01:00:00Z'), b), 'a trip from 20:00 NY the evening before is out');
});

test('the lookback is exactly 3 hours', () => {
  const now = new Date('2026-11-04T18:00:00Z');
  const b = windowBounds(now, nyDay);
  assert.ok(inWindow(scan(new Date(now.getTime() - OPEN_TRIP_LOOKBACK_MS).toISOString(), '2026-11-03'), b));
  assert.ok(!inWindow(scan(new Date(now.getTime() - OPEN_TRIP_LOOKBACK_MS - 1000).toISOString(), '2026-11-03'), b));
});

test('Erev Shabbat early cutover: after the cutover the logical day is already tomorrow', () => {
  // The injected logicalDateOf mimics the early cutover at 20:15Z (15:15 NY): later times belong to the next day.
  const cutoverIso = '2026-11-06T20:15:00Z';
  const logical = (iso: string) => (iso >= cutoverIso ? '2026-11-07' : '2026-11-06');
  const b = windowBounds(new Date('2026-11-06T20:30:00Z'), logical);
  assert.strictEqual(b.logicalDate, '2026-11-07');
  // a trip that left 15:00 NY (20:00Z) just before the cutover still counts: it is within the last 3 hours
  assert.ok(inWindow({ scannedAt: '2026-11-06T20:00:00Z', logicalDate: '2026-11-06' }, b));
  // one from the morning does not
  assert.ok(!inWindow({ scannedAt: '2026-11-06T13:00:00Z', logicalDate: '2026-11-06' }, b));
});

test('daylight-saving change: the lookback is absolute time, so it is unaffected', () => {
  // 2026-11-01 is the day the clocks go back in New York (06:00Z): 3 hours before 07:00Z is 04:00Z
  const b = windowBounds(new Date('2026-11-01T07:00:00Z'), nyDay);
  assert.strictEqual(b.sinceIso, '2026-11-01T04:00:00.000Z');
});

test('person range: id and inclusive date bounds', () => {
  const s = scan('2026-11-02T15:00:00Z');
  assert.ok(inPersonRange(s, 'driverId', 'd1', '2026-11-02', '2026-11-02'), 'both bounds inclusive');
  assert.ok(!inPersonRange(s, 'driverId', 'd2', '2026-10-01', '2026-11-30'), 'another driver');
  assert.ok(!inPersonRange(s, 'dispatcherId', 's1', '2026-11-03', '2026-11-30'), 'before the range');
  assert.ok(inPersonRange(s, 'dispatcherId', 's1', '2026-10-01', '2026-11-30'));
});

test('window and full set agree: filtering the full set equals the window rule', () => {
  const now = new Date('2026-11-04T18:00:00Z');
  const b = windowBounds(now, nyDay);
  const full = [
    scan('2026-11-04T14:00:00Z'), scan('2026-11-04T17:30:00Z'), scan('2026-11-04T05:30:00Z'), scan('2026-11-03T22:00:00Z'),
    scan('2026-10-31T10:00:00Z'), scan('2026-11-04T17:59:59Z'),
  ];
  const win = full.filter(s => inWindow(s, b)).map(s => s.scannedAt);
  assert.deepStrictEqual(win, ['2026-11-04T14:00:00Z', '2026-11-04T17:30:00Z', '2026-11-04T05:30:00Z', '2026-11-04T17:59:59Z']);
});
