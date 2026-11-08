// Error codes shown to a dispatcher when a scan does not reach the server, so they can read the
// code out to the manager and the manager knows at once whether it is the phone's internet or
// the database. Pure module (no Firebase, no React). A scan that gets a code is cancelled - it
// is never sent later (manager's decision, 2026-11-05) - so the dispatcher scans again.
//
//   7970770  The phone has no internet at all.
//   7970771  The phone is online but the server did not confirm the save in time
//            (very slow or stuck connection).
//   888770   The database refused the save because a quota ran out.
//   888771   The database refused the save: no permission, or the phone could not sign in to it.
//   888772   The database is temporarily unavailable (Google's side).
//   888779   Any other database error.
//   555770   An error inside the site itself (a bug), not the network or the database.

export type ScanErrorCode = '7970770' | '7970771' | '888770' | '888771' | '888772' | '888779' | '555770';

/** A phone connection problem (797...), as opposed to the database (888...) or the site (555...). */
export function isConnectionCode(code: ScanErrorCode): boolean {
  return code === '7970770' || code === '7970771';
}

export class ScanSaveError extends Error {
  readonly code: ScanErrorCode;
  readonly original?: unknown;
  constructor(code: ScanErrorCode, original?: unknown) {
    super(`Scan save failed (code ${code})`);
    this.name = 'ScanSaveError';
    this.code = code;
    this.original = original;
  }
}

/** Maps a Firestore error code (FirebaseError.code) to our code. */
export function codeForFirestoreError(fsCode: string | undefined, online: boolean): ScanErrorCode {
  switch (fsCode) {
    case 'resource-exhausted':
      return '888770';
    case 'permission-denied':
    case 'unauthenticated':
      return '888771';
    case 'unavailable':
      return online ? '888772' : '7970770';
    // The server did not answer within its own limit: on an online phone that is a stuck or
    // very slow connection (as for our own timeout), not a database that is down.
    case 'deadline-exceeded':
      return online ? '7970771' : '7970770';
    // The request itself was malformed (e.g. an undefined field in the scan): a bug in the site,
    // not the database - so the manager knows it is not worth waiting for Google.
    case 'invalid-argument':
      return '555770';
    default:
      return online ? '888779' : '7970770';
  }
}

/** Code for a save that neither succeeded nor failed within the time limit. */
export function codeForTimeout(online: boolean): ScanErrorCode {
  return online ? '7970771' : '7970770';
}

export const TIMED_OUT = Symbol('timed-out');

/** Resolves with the promise's value, or with TIMED_OUT once `ms` passes first. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

/** Thrown inside the write when its deadline has passed, so a late retry never goes through. */
export class SaveDeadlinePassed extends Error {
  constructor() { super('Scan save deadline passed - not sending it late'); this.name = 'SaveDeadlinePassed'; }
}

export interface SaveWithCodesOptions {
  /** Sign-in to the database; must settle before the write starts. */
  ready: Promise<unknown>;
  /**
   * Starts the actual write (called only after `ready`). It must not be queued for later:
   * every attempt it makes has to check `deadline` (ms since epoch) and give up with
   * SaveDeadlinePassed once it has passed.
   */
  write: (deadline: number) => Promise<unknown>;
  /** Only a hint (navigator.onLine can be wrong, e.g. after a Wi-Fi to cellular switch): it picks the code and shortens the wait, it never stops the attempt. */
  isOnline: () => boolean;
  now?: () => number;
  readyTimeoutMs: number;
  writeTimeoutMs: number;
  /** Longest wait for sign-in and for the save when the phone says it is offline (default 4 s). */
  offlineTimeoutMs?: number;
}

/**
 * Runs a save and turns every way it can go wrong into a ScanSaveError with a code.
 * A save that fails is final: a write that is still stuck at the time limit is given a deadline
 * that stops any later attempt, so a scan the dispatcher was told had failed does not suddenly
 * appear (and get announced) minutes later.
 *
 * The attempt is ALWAYS made, even when the phone claims to be offline: the flag is only a hint
 * and is sometimes wrong, and refusing to try left a connected dispatcher unable to scan. When it
 * says offline the waits are short, so a really offline phone still gets its answer (7970770)
 * quickly, and a phone that is in fact connected simply succeeds.
 */
export async function saveWithCodes(o: SaveWithCodesOptions): Promise<void> {
  const now = o.now ?? Date.now;
  const hintedOffline = !o.isOnline();
  const offlineCap = o.offlineTimeoutMs ?? 4000;
  const readyMs = hintedOffline ? Math.min(o.readyTimeoutMs, offlineCap) : o.readyTimeoutMs;
  const writeMs = hintedOffline ? Math.min(o.writeTimeoutMs, offlineCap) : o.writeTimeoutMs;
  if (await withTimeout(o.ready, readyMs) === TIMED_OUT) {
    throw new ScanSaveError(o.isOnline() ? '888771' : '7970770');
  }
  // Attempts stop a little before the on-screen time limit, so nothing starts after it.
  const deadline = now() + Math.round(writeMs * 0.8);
  let result;
  try {
    result = await withTimeout(o.write(deadline), writeMs);
  } catch (e) {
    if (e instanceof SaveDeadlinePassed) throw new ScanSaveError(codeForTimeout(o.isOnline()), e);
    throw new ScanSaveError(codeForFirestoreError((e as { code?: string } | null)?.code, o.isOnline()), e);
  }
  if (result === TIMED_OUT) throw new ScanSaveError(codeForTimeout(o.isOnline()));
}

/** The code carried by any error thrown from a scan save; unknown errors count as a site bug. */
export function scanErrorCodeOf(err: unknown): ScanErrorCode {
  return err instanceof ScanSaveError ? err.code : '555770';
}

const REASON: Record<ScanErrorCode, { he: string; en: string }> = {
  '7970770': { he: 'אין אינטרנט בטלפון', en: 'The phone has no internet' },
  '7970771': { he: 'האינטרנט איטי מאוד או תקוע - השרת לא אישר', en: 'Very slow or stuck connection - the server did not confirm' },
  '888770': { he: 'בעיה במסד הנתונים (המכסה נגמרה)', en: 'Database problem (quota ran out)' },
  '888771': { he: 'בעיה במסד הנתונים (אין הרשאה)', en: 'Database problem (no permission)' },
  '888772': { he: 'מסד הנתונים לא זמין כרגע', en: 'The database is unavailable right now' },
  '888779': { he: 'שגיאה במסד הנתונים', en: 'Database error' },
  '555770': { he: 'שגיאה באתר', en: 'Site error' },
};

export function scanErrorReason(code: ScanErrorCode, lang: 'he' | 'en'): string {
  return REASON[code][lang];
}

/** What the dispatcher should do next. The scan is cancelled in every case - it will not be sent later. */
export function scanErrorAdvice(code: ScanErrorCode, lang: 'he' | 'en'): string {
  if (isConnectionCode(code)) {
    return lang === 'he'
      ? 'הסריקה בוטלה ולא תישלח. בדוק שיש אינטרנט וסרוק שוב. אם זה חוזר, מסור למנהל את הקוד.'
      : 'The scan was cancelled and will not be sent. Check the internet connection and scan again. If it keeps happening, give the manager this code.';
  }
  return lang === 'he'
    ? 'הסריקה בוטלה ולא תישלח. מסור למנהל את הקוד.'
    : 'The scan was cancelled and will not be sent. Give the manager this code.';
}
