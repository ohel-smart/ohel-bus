// Which trips a non-admin screen keeps live ("the window"), and which trips belong to one
// person in a chosen period. Pure functions with no Firebase and no React, so the rules can
// be run against fixed clocks (see tests/scanWindow.test.ts).
//
// The window is "everything of the current logical day" plus "anything that left in the last
// 3 hours". The second part matters for a trip that crosses midnight (leaves 23:50, arrives
// 00:37 - already the next logical day) and around the Erev Shabbat early cutover; the longest
// trip on record is 77 minutes, so 3 hours is a wide margin.

export const OPEN_TRIP_LOOKBACK_MS = 3 * 60 * 60 * 1000;

export interface WindowBounds {
  /** The current logical day (YYYY-MM-DD); matched with `logicalDate ==`. */
  logicalDate: string;
  /** ISO time 3 hours ago; matched with `scannedAt >=`. */
  sinceIso: string;
}

export interface WindowScan {
  logicalDate: string;
  scannedAt: string;
}

export function windowBounds(now: Date, logicalDateOf: (iso: string) => string): WindowBounds {
  return {
    logicalDate: logicalDateOf(now.toISOString()),
    sinceIso: new Date(now.getTime() - OPEN_TRIP_LOOKBACK_MS).toISOString(),
  };
}

/** The same test the two Firestore listeners (logicalDate == day, scannedAt >= since) apply together. */
export function inWindow(scan: WindowScan, bounds: WindowBounds): boolean {
  return scan.logicalDate === bounds.logicalDate || scan.scannedAt >= bounds.sinceIso;
}

export type PersonField = 'driverId' | 'dispatcherId';

export interface PersonScan extends WindowScan {
  driverId: string;
  dispatcherId: string;
}

/** The same test the person query (field == id, logicalDate between from and to, inclusive) applies. */
export function inPersonRange(scan: PersonScan, field: PersonField, id: string, from: string, to: string): boolean {
  return scan[field] === id && scan.logicalDate >= from && scan.logicalDate <= to;
}
