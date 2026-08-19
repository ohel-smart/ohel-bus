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

/** Hebrew day-of-week name, e.g. "יום ראשון". */
export function getDayOfWeekHe(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(date);
}

/**
 * Fixed list of Hebrew month keys (as returned by HDate#getMonthName()) with their
 * Hebrew display labels. "Adar" only exists in non-leap years; "Adar I"/"Adar II"
 * only exist in leap years - both are always offered as filter options since the
 * matching year determines which one is actually present in the data.
 */
export const HEBREW_MONTH_OPTIONS: { key: string; label: string }[] = [
  { key: 'Nisan', label: 'ניסן' },
  { key: 'Iyyar', label: 'אייר' },
  { key: 'Sivan', label: 'סיון' },
  { key: 'Tamuz', label: 'תמוז' },
  { key: 'Av', label: 'אב' },
  { key: 'Elul', label: 'אלול' },
  { key: 'Tishrei', label: 'תשרי' },
  { key: 'Cheshvan', label: 'חשון' },
  { key: 'Kislev', label: 'כסלו' },
  { key: 'Tevet', label: 'טבת' },
  { key: "Sh'vat", label: 'שבט' },
  { key: 'Adar', label: 'אדר' },
  { key: 'Adar I', label: 'אדר א׳' },
  { key: 'Adar II', label: 'אדר ב׳' },
];

const hebrewYearMonthCache = new Map<string, { year: number; monthKey: string }>();

/** Hebrew (year, month-key) for `date`, memoized per calendar day. */
export function getHebrewYearMonth(date: Date): { year: number; monthKey: string } {
  const key = date.toISOString().slice(0, 10);
  const cached = hebrewYearMonthCache.get(key);
  if (cached) return cached;
  let result = { year: 0, monthKey: '' };
  try {
    const hd = new HDate(date);
    result = { year: hd.getFullYear(), monthKey: hd.getMonthName() };
  } catch { /* leave zeroed on any calendar error */ }
  hebrewYearMonthCache.set(key, result);
  return result;
}

/** Hebrew year in Gematriya, e.g. 5786 -> "תשפ״ו". */
export function renderHebrewYear(year: number): string {
  try { return stripNiqqud(new HDate(1, 1, year).renderGematriya()).split(' ').pop() || String(year); }
  catch { return String(year); }
}

/** Exact "HH:MM" (24h) in the given timezone. */
export function exactTimeStr(date: Date, timeZone = 'America/New_York'): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone
  }).format(date);
}
