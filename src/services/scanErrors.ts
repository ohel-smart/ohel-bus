// Error codes shown to a dispatcher when a scan does not reach the server, so they can read the
// code out to the manager and the manager knows at once whether it is the phone's internet or
// the database. Pure module (no Firebase, no React).
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

/** True when the save may still go through by itself once the connection returns. */
export function mayStillArrive(code: ScanErrorCode): boolean {
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
    case 'deadline-exceeded':
      return online ? '888772' : '7970770';
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

export interface SaveWithCodesOptions {
  /** Sign-in to the database; must settle before the write starts. */
  ready: Promise<unknown>;
  /** Starts the actual write (called only after `ready`). */
  write: () => Promise<unknown>;
  isOnline: () => boolean;
  readyTimeoutMs: number;
  writeTimeoutMs: number;
}

/**
 * Runs a save and turns every way it can go wrong into a ScanSaveError with a code.
 * A write that times out is not cancelled - Firestore keeps it queued and may still deliver it.
 */
export async function saveWithCodes(o: SaveWithCodesOptions): Promise<void> {
  if (await withTimeout(o.ready, o.readyTimeoutMs) === TIMED_OUT) {
    throw new ScanSaveError(o.isOnline() ? '888771' : '7970770');
  }
  let result;
  try {
    result = await withTimeout(o.write(), o.writeTimeoutMs);
  } catch (e) {
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

/** What the dispatcher should do next. */
export function scanErrorAdvice(code: ScanErrorCode, lang: 'he' | 'en'): string {
  if (mayStillArrive(code)) {
    return lang === 'he'
      ? 'אל תסרוק שוב ואל תסגור או תרענן את הדף - הסריקה תעלה לבד כשהחיבור יחזור. אם היא לא מופיעה בעוד כמה דקות, מסור למנהל את הקוד.'
      : 'Do not scan again and do not close or refresh the page - the scan will go up by itself once the connection is back. If it does not appear within a few minutes, give the manager this code.';
  }
  return lang === 'he'
    ? 'הסריקה לא נשמרה. מסור למנהל את הקוד.'
    : 'The scan was not saved. Give the manager this code.';
}
