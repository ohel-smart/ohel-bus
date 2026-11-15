// Run with: node --test tests/logicalDay.test.ts   (Node 24 runs TypeScript directly)
import test from 'node:test';
import assert from 'node:assert';
import { logicalDateOf, isRestDay, getEarlyCutover, hourPosInDay, hourAtPos } from '../src/services/logicalDay.ts';
import { buildAnalytics, DEFAULT_RULES } from '../src/services/analytics.ts';

// New York is UTC-5 from 2026-11-01 (winter) and UTC-4 before that / from 2026-03-08 (summer).

test('a regular day runs from 04:00 to 03:59 New York time', () => {
  // Wed 2026-11-11 (winter): 03:59 NY = 08:59Z, 04:00 NY = 09:00Z
  assert.strictEqual(logicalDateOf('2026-11-11T08:59:00Z'), '2026-11-10');
  assert.strictEqual(logicalDateOf('2026-11-11T09:00:00Z'), '2026-11-11');
  assert.strictEqual(logicalDateOf('2026-11-11T05:03:00Z'), '2026-11-10'); // 00:03 NY, just after midnight
  assert.strictEqual(logicalDateOf('2026-11-12T04:59:00Z'), '2026-11-11'); // 23:59 NY
  assert.strictEqual(logicalDateOf('2026-11-12T05:00:00Z'), '2026-11-11'); // 00:00 NY - still Wednesday
});

test('the same in summer time (UTC-4)', () => {
  // Tue 2026-07-14: 03:59 NY = 07:59Z, 04:00 NY = 08:00Z
  assert.strictEqual(logicalDateOf('2026-07-14T07:59:00Z'), '2026-07-13');
  assert.strictEqual(logicalDateOf('2026-07-14T08:00:00Z'), '2026-07-14');
});

test('Sunday runs from 04:00 Sunday to 03:59 Monday, but Shabbat is left as it was (midnight)', () => {
  // Sat 2026-11-14 is Shabbat -> it ends at midnight, so Sunday starts at 00:00
  assert.ok(isRestDay('2026-11-14'));
  assert.strictEqual(logicalDateOf('2026-11-15T05:00:00Z'), '2026-11-15'); // Sun 00:00 NY
  assert.strictEqual(logicalDateOf('2026-11-15T07:00:00Z'), '2026-11-15'); // Sun 02:00 NY
  assert.strictEqual(logicalDateOf('2026-11-15T12:00:00Z'), '2026-11-15'); // Sun 07:00 NY
  // ...and Sunday (a regular day) runs on until Monday 04:00
  assert.strictEqual(logicalDateOf('2026-11-16T08:59:00Z'), '2026-11-15'); // Mon 03:59 NY
  assert.strictEqual(logicalDateOf('2026-11-16T09:00:00Z'), '2026-11-16'); // Mon 04:00 NY
});

test('Erev Shabbat ends 15 minutes before sunset, as before - and its small hours belong to Thursday', () => {
  const cut = getEarlyCutover('2026-11-13');
  assert.ok(cut, 'Friday 2026-11-13 is an erev day');
  assert.strictEqual(logicalDateOf(new Date(cut.getTime() - 1000).toISOString()), '2026-11-13');
  assert.strictEqual(logicalDateOf(cut.toISOString()), '2026-11-14');
  assert.strictEqual(logicalDateOf('2026-11-13T07:00:00Z'), '2026-11-12'); // Fri 02:00 NY -> still Thursday
  assert.strictEqual(logicalDateOf('2026-11-13T09:00:00Z'), '2026-11-13'); // Fri 04:00 NY -> Friday
});

test('Saturday night: Shabbat day 2026-11-14 runs to midnight, trips after midnight are Sunday', () => {
  assert.strictEqual(logicalDateOf('2026-11-15T04:59:00Z'), '2026-11-14'); // Sat 23:59 NY
  assert.strictEqual(logicalDateOf('2026-11-14T06:00:00Z'), '2026-11-14'); // Sat 01:00 NY (Friday erev ended at sunset)
});

test('Yom Tov is treated like Shabbat (Rosh Hashana 5787: Sat 12 and Sun 13 Sep 2026)', () => {
  assert.ok(isRestDay('2026-09-12') && isRestDay('2026-09-13'));
  assert.ok(getEarlyCutover('2026-09-11'), 'Friday 11 Sep is the erev');
  // Monday 14 Sep 02:00 NY (06:00Z) follows a Yom Tov day -> it already is Monday
  assert.strictEqual(logicalDateOf('2026-09-14T06:00:00Z'), '2026-09-14');
  // Tuesday 15 Sep 02:00 NY follows a regular Monday -> still Monday
  assert.strictEqual(logicalDateOf('2026-09-15T06:00:00Z'), '2026-09-14');
});

test('around the spring DST change the day still turns at 04:00', () => {
  // Sun 2026-03-08: clocks jump 02:00 -> 03:00. 03:30 NY = 07:30Z (EDT), 04:00 NY = 08:00Z
  assert.strictEqual(logicalDateOf('2026-03-09T07:30:00Z'), '2026-03-08'); // Mon 03:30 NY
  assert.strictEqual(logicalDateOf('2026-03-09T08:00:00Z'), '2026-03-09'); // Mon 04:00 NY
});

test('hours are ordered the way the day runs: 04 first, 00-03 last', () => {
  assert.strictEqual(hourPosInDay(4), 0);
  assert.strictEqual(hourPosInDay(23), 19);
  assert.strictEqual(hourPosInDay(0), 20);
  assert.strictEqual(hourPosInDay(3), 23);
  for (let h = 0; h < 24; h++) assert.strictEqual(hourAtPos(hourPosInDay(h)), h);
});

test('the analytics hour axis puts a trip just after midnight at the end of its day', () => {
  const mk = (scannedAt: string, logicalDate: string, pax: number) => ({
    id: scannedAt, scannedAt, logicalDate, passengersCount: pax, driverCapacity: 20, departureLocation: '770',
  }) as any;
  const scans = [
    mk('2026-11-10T15:00:00Z', logicalDateOf('2026-11-10T15:00:00Z'), 10), // 10:00 NY
    mk('2026-11-10T20:00:00Z', logicalDateOf('2026-11-10T20:00:00Z'), 10), // 15:00 NY
    mk('2026-11-11T05:30:00Z', logicalDateOf('2026-11-11T05:30:00Z'), 7),  // 00:30 NY on the 11th = the 10th
  ];
  assert.deepStrictEqual(scans.map(s => s.logicalDate), ['2026-11-10', '2026-11-10', '2026-11-10']);
  const r = buildAnalytics(scans, { todayLogical: '2026-11-12', parse: a => new Date(a), rules: { ...DEFAULT_RULES, excludeHebMonths: [] } });
  const hours = r.types.weekday.hours.map(h => h.hour);
  assert.strictEqual(hours[0], 10);
  assert.strictEqual(hours[hours.length - 1], 1, 'the 00:30 trip is rounded to 01:00 and sits last'); // rounds to nearest hour
  assert.ok(hours.indexOf(15) < hours.indexOf(1), 'afternoon comes before the after-midnight hour');
});
