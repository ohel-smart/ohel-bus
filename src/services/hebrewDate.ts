// Hebrew-date + weekly-parsha helpers for the central summary table.
// Uses @hebcal/core (diaspora / chutz-la'aretz reading cycle).
import { HDate, HebrewCalendar } from '@hebcal/core';

// Remove Hebrew niqqud / cantillation so names render cleanly in a table.
function stripNiqqud(s: string): string {
  return s.replace(/[֑-ׇ]/g, '');
}

const parshaCache = new Map<string, string>();
const hebDateCache = new Map<string, string>();

/**
 * Weekly Torah portion (diaspora) for the week containing `date`, e.g. "כי תצא".
 * Computed from the Shabbat of that week and memoized per week.
 */
export function getWeeklyParsha(date: Date): string {
  let hd: HDate;
  try { hd = new HDate(date); } catch { return ''; }
  // Saturday of this week (getDay: 0=Sun .. 6=Sat).
  const sat = hd.add(6 - hd.getDay(), 'd');
  const key = sat.toString();
  const cached = parshaCache.get(key);
  if (cached !== undefined) return cached;

  let result = '';
  try {
    const evts = HebrewCalendar.calendar({
      start: sat, end: sat, sedrot: true, il: false, locale: 'he', noHolidays: true
    });
    if (evts.length > 0) {
      result = stripNiqqud(evts[0].render('he'))
        .replace(/^פרשת\s+/, '')
        .replace(/־/g, ' ')
        .trim();
    }
  } catch { /* leave blank on any calendar error */ }

  parshaCache.set(key, result);
  return result;
}

/** Hebrew date like "ג׳ אלול תשפ״ו" (niqqud stripped), memoized. */
export function getHebrewDate(date: Date): string {
  const key = date.toISOString().slice(0, 10);
  const cached = hebDateCache.get(key);
  if (cached !== undefined) return cached;
  let result = '';
  try { result = stripNiqqud(new HDate(date).renderGematriya()); } catch { /* blank */ }
  hebDateCache.set(key, result);
  return result;
}

/**
 * Round a moment to the nearest half hour (:00 / :30) in the given timezone and
 * return "HH:MM" (24h). 12:05->12:00, 12:25->12:30, 12:55->13:00.
 */
export function roundToHalfHourStr(date: Date, timeZone = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone
  }).formatToParts(date);
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  let total = Math.round((h * 60 + m) / 30) * 30;
  total = ((total % 1440) + 1440) % 1440;
  const rh = Math.floor(total / 60), rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

/** Exact "HH:MM" (24h) in the given timezone. */
export function exactTimeStr(date: Date, timeZone = 'America/New_York'): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone
  }).format(date);
}
