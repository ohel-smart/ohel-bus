// The manager keeps the whole trip history on his own device (IndexedDB) and, on each open,
// only reads what may have changed since - instead of re-reading every trip ever (which grew
// with every ride: ~370 reads per open in Nov 2026, ~9,000 a year later). Pure planning
// logic, no Firebase and no React, so it can be tested with fixed dates (tests/adminSync.test.ts).
//
// Where the trips come from on the manager's screen:
//   - the last LIVE_DAYS logical days (today and the two before): a live listener, as before
//   - everything older: the copy on the device, refreshed only for days that may have changed:
//       * days with a `scan_days/{date}` mark newer than the last sync - every write the site
//         makes to a trip marks its day (new scan, late entry, edit, delete, end of trip)
//       * days that were not yet "settled" when the copy was saved: the bot still touches a
//         trip for up to 3 hours after it leaves (send confirmation, ETA correction) without
//         marking it, so a day counts as settled only once it ended over SETTLE_MS before the save
//       * everything, when `scan_days/_all` changed (a person was renamed across all trips),
//         when the copy is from an older format, or once it is FULL_REFRESH_MS old (a safety
//         net for anything changed outside the site, e.g. by hand in the Firebase console).

export const CACHE_VERSION = 1;
export const LIVE_DAYS = 3;
export const SETTLE_MS = 4 * 60 * 60 * 1000;
export const FULL_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
export const ALL_MARK = '_all';

export interface AdminCache<S> {
  v: number;
  scans: S[];
  savedAtMs: number; // when this copy was written
  settledBefore: string; // days strictly before this logical date were final when it was written
  syncedAtMs: number; // newest scan_days mark already applied (server time, ms)
  fullAtMs: number; // when the whole history was last read from the server
}

export interface Mark { date: string; updatedAtMs: number }

export type SyncPlan =
  | { kind: 'full'; reason: 'no-cache' | 'old-format' | 'monthly-refresh' | 'renamed' }
  | { kind: 'partial'; rangeFrom: string | null; dates: string[] }; // rangeFrom: refetch [rangeFrom, liveFrom)

/** First logical date served by the live listener: today and the LIVE_DAYS-1 days before it. */
export function liveFromDate(todayLogical: string, prevDay: (ymd: string) => string): string {
  let d = todayLogical;
  for (let i = 1; i < LIVE_DAYS; i++) d = prevDay(d);
  return d;
}

/** Days strictly before the returned logical date had ended over SETTLE_MS before `savedAtMs`. */
export function settledBeforeDate(savedAtMs: number, logicalDateOf: (iso: string) => string): string {
  return logicalDateOf(new Date(savedAtMs - SETTLE_MS).toISOString());
}

export function planSync<S>(cache: AdminCache<S> | null, marks: Mark[], liveFrom: string, nowMs: number): SyncPlan {
  if (!cache) return { kind: 'full', reason: 'no-cache' };
  if (cache.v !== CACHE_VERSION) return { kind: 'full', reason: 'old-format' };
  if (nowMs - cache.fullAtMs > FULL_REFRESH_MS) return { kind: 'full', reason: 'monthly-refresh' };
  const fresh = marks.filter(m => m.updatedAtMs > cache.syncedAtMs);
  if (fresh.some(m => m.date === ALL_MARK)) return { kind: 'full', reason: 'renamed' };
  const rangeFrom = cache.settledBefore < liveFrom ? cache.settledBefore : null;
  const dates = [...new Set(fresh.map(m => m.date))]
    .filter(d => d < liveFrom && (rangeFrom === null || d < rangeFrom))
    .sort();
  return { kind: 'partial', rangeFrom, dates };
}

/** Newest mark time seen, never going backwards. */
export function nextSyncedAt(previousMs: number, marks: Mark[]): number {
  return marks.reduce((max, m) => (m.updatedAtMs > max ? m.updatedAtMs : max), previousMs);
}

/**
 * The older part of the history after a partial refresh: every trip of a refetched day (or
 * range) is replaced by what the server returned for it, including days that are now empty;
 * days at or after liveFrom are dropped (the live listener owns them).
 */
export function applyPartial<S extends { logicalDate: string; id?: unknown }>(
  cached: S[], plan: Extract<SyncPlan, { kind: 'partial' }>, fetched: S[], liveFrom: string,
): S[] {
  const replaced = (d: string) => plan.dates.includes(d) || (plan.rangeFrom !== null && d >= plan.rangeFrom);
  const kept = cached.filter(s => s.logicalDate < liveFrom && !replaced(s.logicalDate));
  // By id, the fetched copy winning: a trip whose day was edited has a stale copy under its old day
  // and a fresh one under the new day when only one of the two days was refetched.
  return uniqueById([...kept, ...fetched.filter(s => s.logicalDate < liveFrom)]);
}

/** One entry per id; where an id repeats, the LAST one wins (put the authoritative list last). Entries without an id are kept as they are. */
export function uniqueById<S extends { id?: unknown }>(list: S[]): S[] {
  const last = new Map<string, S>();
  for (const s of list) if (typeof s.id === 'string') last.set(s.id, s);
  const seen = new Set<string>();
  const out: S[] = [];
  for (const s of list) {
    if (typeof s.id !== 'string') { out.push(s); continue; }
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(last.get(s.id)!);
  }
  return out;
}

/** The dates a write touches, as marks to write (valid logical dates only, no duplicates). */
export function marksFor(dates: Array<string | undefined | null>): string[] {
  return [...new Set(dates.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)))];
}

/**
 * After the older part is brought up to date, its size is compared with what the server says it
 * holds (a count query: one read per 1000 trips). A difference means the copy is missing trips or
 * keeps deleted ones, whatever the cause (an answer that came from the browser's own cache on a bad
 * connection, a change made outside the site) - so the whole older history is read again, once.
 * If the server's own answer was just read in full, a difference can only come from a write that
 * landed in between: accept it and let the next open check again.
 */
export function integrityVerdict(input: { localCount: number; serverCount: number; justReadInFull: boolean }): 'ok' | 'reload' | 'accept' {
  if (input.localCount === input.serverCount) return 'ok';
  return input.justReadInFull ? 'accept' : 'reload';
}
