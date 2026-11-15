// Which "day" a trip belongs to (its logicalDate). Pure functions, no Firebase and no React, so the
// rule can be run against fixed clocks (tests/logicalDay.test.ts). The WhatsApp bot keeps a copy of
// the same rule (whatsapp-bot/logical-day.js) - change both together.
//
// The rule, all in America/New_York time:
//  - A regular day runs from 04:00 until 03:59 the next morning. A trip at 00:30 still belongs to
//    the day that is just ending. Shabbat is a regular day in this respect: it runs from the
//    Erev Shabbat cutover until Sunday 03:59.
//  - Erev Shabbat / Erev Yom Tov: the day ends 15 minutes before that evening's sunset (the trips
//    after that moment already belong to the next day).
//  - Yom Tov days that are not Shabbat: the day ends at midnight, as it always did, so the next
//    day starts at 00:00.

import { Location, Zmanim, isAssurBemlacha } from '@hebcal/core';

/** The hour (New York) at which a regular day ends and the next one starts. */
export const DAY_ENDS_HOUR = 4;

// Crown Heights.
const NY_LOCATION = new Location(40.6690, -73.9429, false, 'America/New_York', 'Crown Heights', 'US');

const nyParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
});

/** New York calendar day (YYYY-MM-DD) and clock hour (0-23) of a moment. */
export function nyDayAndHour(date: Date): { ymd: string; hour: number } {
  const parts = nyParts.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { ymd: `${get('year')}-${get('month')}-${get('day')}`, hour: parseInt(get('hour'), 10) % 24 };
}

// Adds `days` calendar days to a YYYY-MM-DD string, letting the local Date
// constructor normalize month/year rollovers.
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const earlyCutoverCache = new Map<string, Date | null>();

// On Erev Shabbat / Erev Yom Tov the organization's "day" ends 15 minutes before
// sunset (America/New_York), not at the regular hour - a scan after that moment already
// belongs to the next logical day. Returns the cutover Date for `ymd` (YYYY-MM-DD,
// NY calendar date), or null if `ymd` is not an erev day.
export function getEarlyCutover(ymd: string): Date | null {
  const cached = earlyCutoverCache.get(ymd);
  if (cached !== undefined) return cached;

  let result: Date | null = null;
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    // Local-constructed on purpose: Zmanim only reads the Y/M/D fields off this Date
    // (hours are ignored), and building it via the local constructor makes those
    // fields round-trip correctly regardless of the runtime's own timezone.
    const dayRef = new Date(y, m - 1, d);
    const sunset = new Zmanim(NY_LOCATION, dayRef, false).sunset();
    const justBeforeSunset = new Date(sunset.getTime() - 60000);
    const justAfterSunset = new Date(sunset.getTime() + 60000);
    // Erev Shabbat / Erev Yom Tov = melacha becomes newly prohibited at tonight's
    // sunset. If it was already prohibited beforehand (e.g. this is Shabbat or a
    // Yom Tov day itself, still running into the evening, or day 1 of a 2-day
    // diaspora Yom Tov flowing straight into day 2), that's not "erev" of anything.
    if (!isAssurBemlacha(justBeforeSunset, NY_LOCATION, false) && isAssurBemlacha(justAfterSunset, NY_LOCATION, false)) {
      result = new Date(sunset.getTime() - 15 * 60000);
    }
  } catch { /* treat the day as a regular one on any calculation error */ }

  earlyCutoverCache.set(ymd, result);
  return result;
}

const restDayCache = new Map<string, boolean>();

/** Shabbat or Yom Tov: work is forbidden in the middle of this New York calendar day. */
export function isRestDay(ymd: string): boolean {
  const cached = restDayCache.get(ymd);
  if (cached !== undefined) return cached;
  let result = false;
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    // 17:00 UTC is 12:00 (winter) or 13:00 (summer) in New York: well inside the day, far from sunset.
    result = isAssurBemlacha(new Date(Date.UTC(y, m - 1, d, 17)), NY_LOCATION, false);
  } catch { /* a regular day */ }
  restDayCache.set(ymd, result);
  return result;
}

/** Is `ymd` a Saturday? */
export function isSaturday(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6;
}

/** A Yom Tov day that is not Shabbat: its day still ends at midnight. */
export function endsAtMidnight(ymd: string): boolean {
  return isRestDay(ymd) && !isSaturday(ymd);
}

/** Does the day `ymd` end at the regular 04:00 (not at an early erev cutover, not at midnight)? */
export function endsAtRegularHour(ymd: string): boolean {
  return getEarlyCutover(ymd) === null && !endsAtMidnight(ymd);
}

/** The logical day (YYYY-MM-DD) that the moment `iso` belongs to. */
export function logicalDateOf(iso: string): string {
  const date = new Date(iso);
  const { ymd, hour } = nyDayAndHour(date);

  // The small hours: still the day that is just ending, unless that day ended earlier (erev) or at midnight.
  if (hour < DAY_ENDS_HOUR) {
    const prev = addDaysToYmd(ymd, -1);
    if (endsAtRegularHour(prev)) return prev;
  }

  // On Erev Shabbat / Erev Yom Tov this day already ends 15 minutes before tonight's sunset.
  const cutover = getEarlyCutover(ymd);
  if (cutover && date.getTime() >= cutover.getTime()) {
    return addDaysToYmd(ymd, 1);
  }

  return ymd;
}

/**
 * Position of a clock hour inside a logical day: 0 for 04:00 ... 19 for 23:00, 20 for 00:00 ... 23 for 03:00.
 * Use it to order hours the way the day runs (a trip at 00:30 comes last, not first).
 */
export function hourPosInDay(hour: number): number {
  return (hour - DAY_ENDS_HOUR + 24) % 24;
}

/** The clock hour (0-23) at position `pos` of a logical day (inverse of hourPosInDay). */
export function hourAtPos(pos: number): number {
  return (pos + DAY_ENDS_HOUR) % 24;
}
