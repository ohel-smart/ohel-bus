// A scan that "failed" on screen may in fact have reached the server (a request that was already on
// the wire when the time limit hit). If the dispatcher then scans again, the second attempt must
// land on the SAME trip, or the group gets two announcements for one ride. So a failed scan's id is
// remembered for a while and reused by the next attempt of the same scan. Memory only, per device.
// Pure functions (no Firebase, no React) - tests/scanRetry.test.ts.

export const RETRY_ID_MAX_AGE_MS = 20 * 60 * 1000;

export interface FailedScan { id: string; atMs: number }

/**
 * What makes two attempts "the same scan": the same driver leaving the same place. A ride whose
 * time was TYPED (a manual late entry, or a driver's self-report) also carries that time, so two
 * different past rides for one driver never merge. A live scan has no typed time (it is "now"),
 * so there the driver and place are all there is.
 */
export function retryKey(s: { driverId: string; departureLocation?: string; isLateEntry?: boolean; dispatcherId?: string; scannedAt?: string }): string {
  const typedTime = s.isLateEntry === true || s.dispatcherId === 'self_report';
  return [s.driverId, s.departureLocation ?? '', typedTime ? `typed@${s.scannedAt ?? ''}` : 'live'].join('|');
}

/** The id to use for this attempt: the failed one's, if it is recent enough, else a fresh one. */
export function idForScan(failed: Map<string, FailedScan>, key: string, nowMs: number, makeId: () => string): string {
  for (const [k, f] of failed) if (nowMs - f.atMs > RETRY_ID_MAX_AGE_MS) failed.delete(k);
  return failed.get(key)?.id ?? makeId();
}

export function rememberFailed(failed: Map<string, FailedScan>, key: string, id: string, nowMs: number): void {
  failed.set(key, { id, atMs: nowMs });
}

export function forgetFailed(failed: Map<string, FailedScan>, key: string): void {
  failed.delete(key);
}
