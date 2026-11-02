// The "month" of the admin's bulk reports. By default it is simply the last month up to
// today; the manager can instead fix it to a cycle of the HEBREW calendar, e.g. "from the
// 10th" (it then runs to the 9th of the next Hebrew month, the end day not included) or
// "from the 10th to the 20th". Always the most recent cycle that has already finished.

import { HDate } from '@hebcal/core';
import { getHebrewDate } from './hebrewDate';

export interface ReportMonthRule { startDay: number | null; endDay: number | null }

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** First day (as an absolute day number) of the Hebrew month containing `abs`, and its length. */
const monthOf = (abs: number) => {
  const h = new HDate(abs);
  const len = HDate.daysInMonth(h.getMonth(), h.getFullYear());
  return { start: abs - h.getDate() + 1, len };
};

/** `todayYmd` is the logical date (YYYY-MM-DD). Returns null when no start day is set. */
export function reportMonthRange(rule: ReportMonthRule | undefined, todayYmd: string): { from: string; to: string } | null {
  const start = rule?.startDay;
  if (!start || start < 1 || start > 30) return null;
  const end = rule?.endDay && rule.endDay >= 1 && rule.endDay <= 30 ? rule.endDay : null;
  const [y, m, d] = todayYmd.split('-').map(Number);
  const todayAbs = new HDate(new Date(y, m - 1, d)).abs();
  let month = monthOf(todayAbs);
  for (let k = 0; k < 14; k++) {
    const next = monthOf(month.start + month.len);
    const from = month.start + Math.min(start, month.len) - 1;
    // no end day: up to, but not including, the start day of the next Hebrew month
    const to = end === null
      ? next.start + Math.min(start, next.len) - 2
      : end >= start ? month.start + Math.min(end, month.len) - 1 : next.start + Math.min(end, next.len) - 1;
    if (to < todayAbs) return { from: ymd(new HDate(from).greg()), to: ymd(new HDate(to).greg()) };
    month = monthOf(month.start - 1);
  }
  return null;
}

/**
 * One specific Hebrew month picked from the calendar: it starts on the picked day and ends the
 * day before the same day of the next Hebrew month - so picking the 1st gives exactly that
 * whole month (א׳ חשוון -> the last day of חשוון), picking the 10th gives 10th -> 9th.
 */
export function cycleStartingOn(startYmd: string): { from: string; to: string } {
  const [y, m, d] = startYmd.split('-').map(Number);
  const h = new HDate(new Date(y, m - 1, d));
  const abs = h.abs();
  const month = monthOf(abs);
  const next = monthOf(month.start + month.len);
  const day = h.getDate();
  const to = day === 1 ? month.start + month.len - 1 : next.start + Math.min(day, next.len) - 2;
  return { from: startYmd, to: ymd(new HDate(to).greg()) };
}

/** "י׳ חשוון – ט׳ כסלו" style label for a YYYY-MM-DD range (Hebrew dates, year left out). */
export function shortRange(r: { from: string; to: string }): string {
  const f = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return getHebrewDate(new Date(y, m - 1, d)).replace(/\s+\S+$/, '');
  };
  return `${f(r.from)} – ${f(r.to)}`;
}
