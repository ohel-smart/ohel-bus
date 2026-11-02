// The "month" of the admin's bulk reports. By default it is simply the last month up to
// today; the manager can instead fix it to a cycle, e.g. "from the 10th" (it then runs to
// the 9th of the next month, the end day not included) or "from the 10th to the 20th".
// Always the most recent cycle that has already finished.

export interface ReportMonthRule { startDay: number | null; endDay: number | null }

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
// day `day` of month index `m` (0-based, may be out of range) in year `y`, clamped to that month's length
const dayOf = (y: number, m: number, day: number) => {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(day, last));
};

/** `todayYmd` is the logical date (YYYY-MM-DD). Returns null when no start day is set. */
export function reportMonthRange(rule: ReportMonthRule | undefined, todayYmd: string): { from: string; to: string } | null {
  const start = rule?.startDay;
  if (!start || start < 1 || start > 31) return null;
  const end = rule?.endDay && rule.endDay >= 1 && rule.endDay <= 31 ? rule.endDay : null;
  const [y, mo] = todayYmd.split('-').map(Number);
  for (let k = 0; k < 14; k++) {
    const m = mo - 1 - k;
    const from = dayOf(y, m, start);
    // no end day: up to, but not including, the start day of the next month
    const to = end === null ? dayOf(y, m + 1, start) - 86400000 : dayOf(y, end >= start ? m : m + 1, end);
    if (ymd(to) < todayYmd) return { from: ymd(from), to: ymd(to) };
  }
  return null;
}

/** "10/10 – 09/11" style label for a YYYY-MM-DD range. */
export function shortRange(r: { from: string; to: string }): string {
  const f = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}`;
  return `${f(r.from)} – ${f(r.to)}`;
}
