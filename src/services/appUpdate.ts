// Deciding what an open page does when a newer build of the site has been published.
// Pure functions (no DOM, no network handles of their own) so they can be tested with plain node.
//
// The check is one request for a ~40 byte static file (/version.json) - nothing to do with
// Firestore, so it costs no database reads.

export type UpdateMode =
  | 'auto'    // nobody types here (the arrival board on a screen): reload as soon as a new build is seen
  | 'idle';   // people use it: never reload under their hands; offer it, and reload after a break

export type UpdateAction = 'none' | 'banner' | 'reload';

// How long the page must have been in the background (screen locked, another app in front) before
// coming back to it reloads on its own. Shorter than this the person may be in the middle of a form.
export const BACKGROUND_RELOAD_AFTER_MS = 2 * 60 * 1000;

export async function fetchLatestBuildId(
  fetchFn: (url: string, init?: { cache?: 'no-store' }) => Promise<{ ok: boolean; json(): Promise<unknown> }>,
  now: number = Date.now(),
): Promise<string | null> {
  try {
    // The query string defeats any cache between the phone and the server.
    const res = await fetchFn(`/version.json?t=${now}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json() as { id?: unknown };
    return typeof body?.id === 'string' && body.id ? body.id : null;
  } catch {
    return null; // offline, or a hiccup: just try again at the next check
  }
}

export function decideUpdate(input: {
  current: string;
  latest: string | null;
  mode: UpdateMode;
  /** how long the page was hidden before it became visible again; null = it is visible and was not hidden */
  returnedAfterHiddenMs: number | null;
}): UpdateAction {
  const { current, latest, mode, returnedAfterHiddenMs } = input;
  if (!latest || latest === current) return 'none';
  if (mode === 'auto') return 'reload';
  if (returnedAfterHiddenMs !== null && returnedAfterHiddenMs >= BACKGROUND_RELOAD_AFTER_MS) return 'reload';
  return 'banner';
}
