// Everything in this app runs on New York time, whatever timezone the device
// is actually in (a dispatcher or admin may be abroad). These helpers convert
// between real instants (Date / ISO strings) and New York wall-clock strings.

export const NY_TZ = 'America/New_York';

interface NyParts { y: number; m: number; d: number; h: number; mi: number; s: number }

function nyParts(ts: number): NyParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NY_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" of the given instant, as read on a New York wall clock. */
export function nyDateStr(date: Date = new Date()): string {
  const p = nyParts(date.getTime());
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** "YYYY-MM-DDTHH:MM" (the datetime-local format) of the instant in New York. */
export function nyLocalInput(date: Date = new Date()): string {
  const p = nyParts(date.getTime());
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Same as nyLocalInput but takes an ISO string. */
export function isoToNyLocalInput(iso: string): string {
  return nyLocalInput(new Date(iso));
}

/** The calendar day before the given "YYYY-MM-DD". */
export function prevDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Reads "YYYY-MM-DDTHH:MM" as a New York wall-clock time and returns the real
 * instant it denotes (DST-aware). Two passes settle the UTC offset even when
 * the guess lands on the other side of a DST switch.
 */
export function nyWallToDate(local: string): Date {
  const [datePart, timePart = '00:00'] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, h, mi);
  let ts = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(ts);
    const shownAsUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
    ts = asUtc - (shownAsUtc - Math.floor(ts / 1000) * 1000);
  }
  return new Date(ts);
}
