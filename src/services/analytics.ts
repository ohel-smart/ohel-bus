// Pure analytics maths for the admin "Analytics" tab. No React, no dbService, no
// "now" of its own: everything it needs comes in as arguments, so it can be run
// against any list of scans, and it recomputes from scratch on every call (the
// tab calls it on each live update, so the numbers are always in sync with the
// scans table).
//
// Pipeline, in order:
//   1. valid rides only (real date, not today - today is still running)
//   2. the manager's rules: whole Hebrew months left out (default Tishrei) and a
//      ceiling on passengers per day (default 700)
//   3. automatic detection of special days, inside each kind of day (a Tuesday is
//      only compared with other Mon-Thu days, a Friday with other Fridays...).
//      The tolerance sharpens by itself as days accumulate (see flagDays).
//   4. averages per hour / per day over the NORMAL days only, plus totals per
//      week, Hebrew month and rolling 7/30/90 days.
import { HDate, HebrewCalendar, flags } from '@hebcal/core';
import type { Scan } from './db';
import { roundToHourStr } from './hebrewDate';

export type DayType = 'weekday' | 'sunday' | 'erev' | 'shabbat' | 'yomtov' | 'cholhamoed';
export const DAY_TYPES: DayType[] = ['weekday', 'erev', 'shabbat', 'sunday', 'yomtov', 'cholhamoed'];

export interface AnalyticsRules {
  /** A day with MORE passengers than this is left out. null = no ceiling. */
  maxPaxPerDay: number | null;
  /** Hebrew month names (hebcal spelling, e.g. 'Tishrei') whose days are left out. */
  excludeHebMonths: string[];
}
export const DEFAULT_RULES: AnalyticsRules = { maxPaxPerDay: 700, excludeHebMonths: ['Tishrei'] };

export type ExcludeReason = 'month' | 'ceiling';
export type AutoFlag = 'high' | 'low' | 'partial' | null;

export interface HourBucket { pax: number; trips: number; p770: number; pOhel: number; t770: number; tOhel: number }

export interface DayStat {
  date: string; // logicalDate, YYYY-MM-DD
  type: DayType;
  hebMonth: string;
  passengers: number;
  trips: number;
  seats: number; // seats offered, summed over the day's trips
  seats770: number; // ...of which on trips that left 770
  seatsOhel: number; // ...and on trips that left Ohel
  byHour: Record<number, HourBucket>;
  excluded: ExcludeReason | null; // left out by one of the manager's rules
  auto: AutoFlag; // special day detected automatically (still counted in totals)
  ratio: number | null; // passengers vs the usual for this kind of day (1 = typical)
}

export interface HourAvg {
  hour: number;
  pax: number; trips: number; p770: number; pOhel: number; // averages per normal day
  t770: number; tOhel: number; // trips from 770 / from Ohel, averaged per normal day
  min: number; max: number; // passengers, over the normal days
}

// none     = fewer than 3 days of this kind: nothing can be judged yet
// learning = 3-7 days: fixed tolerance, small sample
// adaptive = 8+ days: tolerance is learned from the spread of the days themselves
export type Confidence = 'none' | 'learning' | 'adaptive';

export interface TypeReport {
  type: DayType;
  days: DayStat[]; // every valid day of this kind, oldest first
  countedCount: number; // not excluded by a rule
  normalCount: number; // counted and not special
  specialCount: number;
  confidence: Confidence;
  hours: HourAvg[]; // contiguous range from first to last active hour
  peak: HourAvg | null;
  avgPassengersPerDay: number;
  avgTripsPerDay: number;
  avgSeatsPerTrip: number;
}

export interface Period {
  key: string;
  from: string; // first / last logicalDate that has data in the period
  to: string;
  days: number; // counted days
  special: number; // of those, auto-detected special days
  passengers: number;
  trips: number;
  load: number | null; // passengers / seats offered (0..1+)
  load770: number | null; // the same, only for trips that left 770
  loadOhel: number | null; // ...and only for trips that left Ohel
  avgPerDay: number; // passengers per NORMAL day
  avgTripsPerDay: number; // trips per NORMAL day
  peakHour: number | null;
}

export interface AnalyticsReport {
  types: Record<DayType, TypeReport>;
  allDays: DayStat[]; // every valid day, oldest first, with the manager's rules and the automatic flags applied
  reconcile: {
    validRides: number;
    countedRides: number;
    excludedMonthDays: number;
    excludedCeilingDays: number;
    excludedRides: number;
    skippedBadDate: number;
    skippedToday: number;
  };
  lastScanAt: string | null;
}

export interface AnalyticsOptions {
  /** Today's logical date. Days on/after it are still running, so they're left out. */
  todayLogical: string;
  /** Same as dbService.parseScannedAt, injected to keep this file pure. */
  parse: (scannedAt: string, logicalDate: string) => Date;
  rules?: AnalyticsRules;
}

const HI_FIXED = 1.35; // 3-7 days: above 135% of usual is special
const LO_FIXED = 0.6; //  ...below 60% of usual is special
const PARTIAL_TRIPS = 0.5; // fewer than half the usual trips: day probably not fully logged
const MIN_DAYS_TO_JUDGE = 3;
const MIN_DAYS_ADAPTIVE = 8;
const REL_FLOOR = 0.25;
const REL_CAP = 0.5;
const DEFAULT_SEATS = 24; // used only when a ride has no capacity recorded
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon: stays on the same calendar day in any timezone
}

/** Hebrew month name (hebcal spelling) of a logical date. */
export function hebMonthOfYmd(ymd: string): string {
  return new HDate(localDate(ymd)).getMonthName();
}

/** Does a stored rule name match this month? "Adar" covers both Adars of a leap year. */
function monthMatches(rule: string, month: string): boolean {
  return rule === month || (rule === 'Adar' && month.startsWith('Adar'));
}

/** What kind of day a logical date is. */
export function dayTypeOf(ymd: string): DayType {
  const d = localDate(ymd);
  const events = HebrewCalendar.getHolidaysOnDate(new HDate(d), false) ?? [];
  if (events.some(e => e.getFlags() & flags.CHAG)) return 'yomtov';
  if (events.some(e => e.getFlags() & flags.CHOL_HAMOED)) return 'cholhamoed';
  const dow = d.getDay();
  if (dow === 6) return 'shabbat';
  if (dow === 5 || events.some(e => e.getFlags() & flags.EREV)) return 'erev';
  if (dow === 0) return 'sunday';
  return 'weekday';
}

/**
 * Detects the special days of ONE kind, among the days the rules kept. Judged on
 * total passengers, in two passes so that special days can't drag their own
 * yardstick: pass 1 uses the median of all the days, pass 2 recomputes it from
 * the days that survived pass 1 and judges everything again.
 *  - fewer than 3 days: no judgement (nothing to compare against yet)
 *  - 3 to 7 days: special if above 135% or below 60% of the median
 *  - 8+ days: the tolerance is learned from the days' own spread (median absolute
 *    deviation), kept between 25% and 50% either side, so a steady stream of days
 *    gets a tight band and a naturally variable one gets a wider band.
 * A day with fewer than half the usual trips is marked 'partial' (probably not
 * logged in full) even when its passenger count looks fine.
 */
function flagDays(days: DayStat[]): Confidence {
  days.forEach(d => { d.auto = null; d.ratio = null; });
  const n = days.length;
  const confidence: Confidence = n < MIN_DAYS_TO_JUDGE ? 'none' : n < MIN_DAYS_ADAPTIVE ? 'learning' : 'adaptive';
  if (confidence === 'none') return confidence;

  const judge = (pool: DayStat[]) => {
    const pax = pool.map(d => d.passengers);
    const medPax = median(pax);
    const medTrips = median(pool.map(d => d.trips));
    if (medPax <= 0) return;
    let hi = HI_FIXED, lo = LO_FIXED;
    if (confidence === 'adaptive') {
      const mad = median(pax.map(x => Math.abs(x - medPax)));
      const rel = Math.min(REL_CAP, Math.max(REL_FLOOR, (3 * 1.4826 * mad) / medPax));
      hi = 1 + rel;
      lo = 1 - rel;
    }
    days.forEach(d => {
      const r = d.passengers / medPax;
      d.ratio = r;
      d.auto = r > hi ? 'high' : r < lo ? 'low' : (medTrips > 0 && d.trips < medTrips * PARTIAL_TRIPS ? 'partial' : null);
    });
  };

  judge(days);
  const survivors = days.filter(d => !d.auto);
  if (survivors.length >= MIN_DAYS_TO_JUDGE - 1 && survivors.length < n) judge(survivors);
  return confidence;
}

/** Seat-fill by direction over some days: passengers who left a place / seats offered on trips from there. */
function directionLoads(days: DayStat[]): { load770: number | null; loadOhel: number | null } {
  let p770 = 0, pOhel = 0, s770 = 0, sOhel = 0;
  for (const d of days) {
    s770 += d.seats770; sOhel += d.seatsOhel;
    for (const b of Object.values(d.byHour)) { p770 += b.p770; pOhel += b.pOhel; }
  }
  return { load770: s770 > 0 ? p770 / s770 : null, loadOhel: sOhel > 0 ? pOhel / sOhel : null };
}

function summarize(days: DayStat[], key: string): Period {
  const counted = days.filter(d => !d.excluded);
  const normal = counted.filter(d => !d.auto);
  const passengers = counted.reduce((a, d) => a + d.passengers, 0);
  const seats = counted.reduce((a, d) => a + d.seats, 0);
  const hourTotals = new Map<number, number>();
  counted.forEach(d => Object.entries(d.byHour).forEach(([h, b]) => hourTotals.set(Number(h), (hourTotals.get(Number(h)) ?? 0) + b.pax)));
  let peakHour: number | null = null, best = 0;
  hourTotals.forEach((v, h) => { if (v > best) { best = v; peakHour = h; } });
  const dates = counted.map(d => d.date).sort();
  return {
    key,
    from: dates[0] ?? '', to: dates[dates.length - 1] ?? '',
    days: counted.length,
    special: counted.length - normal.length,
    passengers,
    trips: counted.reduce((a, d) => a + d.trips, 0),
    load: seats > 0 ? passengers / seats : null,
    ...directionLoads(counted),
    avgPerDay: normal.length ? normal.reduce((a, d) => a + d.passengers, 0) / normal.length : 0,
    avgTripsPerDay: normal.length ? normal.reduce((a, d) => a + d.trips, 0) / normal.length : 0,
    peakHour,
  };
}

/** Average per hour over the given NORMAL days. A day with no ride in an hour is a real zero. */
function hourAverages(normal: DayStat[]): HourAvg[] {
  const n = normal.length;
  const hourSet = new Set<number>();
  normal.forEach(d => Object.keys(d.byHour).forEach(h => hourSet.add(Number(h))));
  const hours: HourAvg[] = [];
  if (!n || !hourSet.size) return hours;
  const lo = Math.min(...hourSet), hi = Math.max(...hourSet);
  for (let h = lo; h <= hi; h++) {
    const per = normal.map(d => d.byHour[h] ?? { pax: 0, trips: 0, p770: 0, pOhel: 0, t770: 0, tOhel: 0 });
    const avg = (f: (b: HourBucket) => number) => per.reduce((acc, b) => acc + f(b), 0) / n;
    const paxs = per.map(b => b.pax);
    hours.push({ hour: h, pax: avg(b => b.pax), trips: avg(b => b.trips), p770: avg(b => b.p770), pOhel: avg(b => b.pOhel), t770: avg(b => b.t770), tOhel: avg(b => b.tOhel), min: Math.min(...paxs), max: Math.max(...paxs) });
  }
  return hours;
}

/** Day of the week (0 = Sunday ... 6 = Saturday) of a logical date. */
export function dowOf(ymd: string): number {
  return localDate(ymd).getDay();
}

/**
 * Totals and the general hour-by-hour average for the days from `fromYmd` on
 * (the manager's rules already applied), optionally only the days `keep` accepts.
 */
export function windowSummary(
  allDays: DayStat[], fromYmd: string, keep: (d: DayStat) => boolean = () => true
): { period: Period; hours: HourAvg[]; peak: HourAvg | null } {
  const inWindow = allDays.filter(d => d.date >= fromYmd && keep(d));
  const hours = hourAverages(inWindow.filter(d => !d.excluded && !d.auto));
  const peak = hours.length ? hours.reduce((best, h) => (h.pax > best.pax ? h : best), hours[0]) : null;
  return { period: summarize(inWindow, `from${fromYmd}`), hours, peak };
}

export interface WeekdayAvg {
  dow: number; // 0 = Sunday ... 6 = Saturday
  days: number; // normal days that went into the average (0 = no data yet, everything below is 0)
  avgPassengers: number;
  avgTrips: number;
  avgTrips770: number; // average trips a day that left 770
  avgTripsOhel: number; // ...and that left Ohel
  load: number | null;
  load770: number | null;
  loadOhel: number | null;
  hours: HourAvg[];
  peak: HourAvg | null;
}

/** Average day for each of the seven days of the week, over the normal days from `fromYmd` on (no specific dates). */
export function weekdayAverages(allDays: DayStat[], fromYmd: string): WeekdayAvg[] {
  const normal = allDays.filter(d => d.date >= fromYmd && !d.excluded && !d.auto);
  const out: WeekdayAvg[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const days = normal.filter(d => localDate(d.date).getDay() === dow);
    if (!days.length) {
      out.push({ dow, days: 0, avgPassengers: 0, avgTrips: 0, avgTrips770: 0, avgTripsOhel: 0, load: null, load770: null, loadOhel: null, hours: [], peak: null });
      continue;
    }
    const hours = hourAverages(days);
    const seats = days.reduce((a, d) => a + d.seats, 0);
    const pax = days.reduce((a, d) => a + d.passengers, 0);
    out.push({
      dow, days: days.length,
      avgPassengers: pax / days.length,
      avgTrips: days.reduce((a, d) => a + d.trips, 0) / days.length,
      avgTrips770: hours.reduce((a, h) => a + h.t770, 0),
      avgTripsOhel: hours.reduce((a, h) => a + h.tOhel, 0),
      load: seats > 0 ? pax / seats : null,
      ...directionLoads(days),
      hours,
      peak: hours.length ? hours.reduce((best, h) => (h.pax > best.pax ? h : best), hours[0]) : null,
    });
  }
  return out;
}

function emptyType(type: DayType): TypeReport {
  return { type, days: [], countedCount: 0, normalCount: 0, specialCount: 0, confidence: 'none', hours: [], peak: null, avgPassengersPerDay: 0, avgTripsPerDay: 0, avgSeatsPerTrip: 0 };
}

export function buildAnalytics(scans: Scan[], opts: AnalyticsOptions): AnalyticsReport {
  const rules = opts.rules ?? DEFAULT_RULES;
  const dayMap = new Map<string, DayStat>();
  let skippedBadDate = 0, skippedToday = 0, validRides = 0;
  let lastScanMs = 0;

  for (const s of scans) {
    if (!s.logicalDate || !YMD.test(s.logicalDate)) { skippedBadDate++; continue; }
    if (s.logicalDate >= opts.todayLogical) { skippedToday++; continue; }
    const when = opts.parse(s.scannedAt, s.logicalDate);
    if (isNaN(when.getTime())) { skippedBadDate++; continue; }
    validRides++;
    if (when.getTime() > lastScanMs) lastScanMs = when.getTime();

    const hour = parseInt(roundToHourStr(when).slice(0, 2), 10);
    const pax = Number.isFinite(s.passengersCount) && s.passengersCount > 0 ? s.passengersCount : 0;
    const seats = s.driverCapacity > 0 ? s.driverCapacity : DEFAULT_SEATS;

    let day = dayMap.get(s.logicalDate);
    if (!day) {
      day = {
        date: s.logicalDate, type: dayTypeOf(s.logicalDate), hebMonth: hebMonthOfYmd(s.logicalDate),
        passengers: 0, trips: 0, seats: 0, seats770: 0, seatsOhel: 0, byHour: {}, excluded: null, auto: null, ratio: null,
      };
      dayMap.set(s.logicalDate, day);
    }
    day.passengers += pax;
    day.trips += 1;
    day.seats += seats;
    if (s.departureLocation === '770') day.seats770 += seats; else day.seatsOhel += seats;
    const b = day.byHour[hour] ?? (day.byHour[hour] = { pax: 0, trips: 0, p770: 0, pOhel: 0, t770: 0, tOhel: 0 });
    b.pax += pax;
    b.trips += 1;
    if (s.departureLocation === '770') { b.p770 += pax; b.t770 += 1; } else { b.pOhel += pax; b.tOhel += 1; }
  }

  const allDays = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Rules: month first, then ceiling. A day left out here never takes part in
  // the automatic detection, so it can't distort what "usual" means.
  let excludedMonthDays = 0, excludedCeilingDays = 0, excludedRides = 0;
  for (const d of allDays) {
    if (rules.excludeHebMonths.some(m => monthMatches(m, d.hebMonth))) { d.excluded = 'month'; excludedMonthDays++; }
    else if (rules.maxPaxPerDay && d.passengers > rules.maxPaxPerDay) { d.excluded = 'ceiling'; excludedCeilingDays++; }
    if (d.excluded) excludedRides += d.trips;
  }

  const types = {} as Record<DayType, TypeReport>;
  for (const type of DAY_TYPES) {
    const days = allDays.filter(d => d.type === type);
    if (!days.length) { types[type] = emptyType(type); continue; }

    const counted = days.filter(d => !d.excluded);
    const confidence = flagDays(counted);
    const normal = counted.filter(d => !d.auto);
    const n = normal.length;

    const hours = hourAverages(normal);
    const peak = hours.length ? hours.reduce((best, h) => (h.pax > best.pax ? h : best), hours[0]) : null;
    const tripsTotal = normal.reduce((a, d) => a + d.trips, 0);
    types[type] = {
      type, days, confidence,
      countedCount: counted.length,
      normalCount: n,
      specialCount: counted.length - n,
      hours, peak,
      avgPassengersPerDay: n ? normal.reduce((a, d) => a + d.passengers, 0) / n : 0,
      avgTripsPerDay: n ? tripsTotal / n : 0,
      avgSeatsPerTrip: tripsTotal ? normal.reduce((a, d) => a + d.seats, 0) / tripsTotal : 0,
    };
  }

  return {
    types, allDays,
    reconcile: {
      validRides, countedRides: validRides - excludedRides, excludedMonthDays, excludedCeilingDays, excludedRides,
      skippedBadDate, skippedToday,
    },
    lastScanAt: lastScanMs ? new Date(lastScanMs).toISOString() : null,
  };
}
