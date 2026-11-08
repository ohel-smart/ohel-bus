// How a driver's / dispatcher's own earlier days are reached: one week at a time, never further
// back than 30 days. Today is not part of it (it is always on screen, live). Pure functions, no
// Firebase and no React, so the rules can be run against fixed dates (tests/personHistory.test.ts).

export const HISTORY_MAX_DAYS = 30;
export const HISTORY_STEP_DAYS = 7;

export interface HistorySlice {
  /** first and last logical date of the slice, inclusive (YYYY-MM-DD) */
  from: string;
  to: string;
  /** how many days back from today the person has reached once this slice is loaded */
  loadedDaysAfter: number;
}

const shift = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The next piece to fetch, given today's logical date and how many days back are already loaded
 * (0 = nothing yet). null once the 30-day limit is reached. Slices are consecutive and do not
 * overlap, so each reads only the days that are new.
 */
export function nextHistorySlice(logicalToday: string, loadedDays: number): HistorySlice | null {
  if (loadedDays >= HISTORY_MAX_DAYS) return null;
  const reach = Math.min(loadedDays + HISTORY_STEP_DAYS, HISTORY_MAX_DAYS);
  return { from: shift(logicalToday, -reach), to: shift(logicalToday, -(loadedDays + 1)), loadedDaysAfter: reach };
}

export function mergeHistory<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const byId = new Map(existing.map(s => [s.id, s]));
  for (const s of incoming) byId.set(s.id, s);
  return [...byId.values()];
}
