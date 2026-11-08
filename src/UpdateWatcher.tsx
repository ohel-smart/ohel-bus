import { useEffect, useRef, useState } from 'react';
import { BACKGROUND_RELOAD_AFTER_MS, decideUpdate, fetchLatestBuildId, type UpdateMode } from './services/appUpdate.ts';

// Keeps an open page from running an old build for days. Checks /version.json every minute while
// the page is on screen, and right when it comes back to the front. A page whose build is older:
//  - on the arrival board: reloads by itself;
//  - elsewhere: shows a small "new version" pill (tap = update) and, if the person had left the
//    app for a couple of minutes, updates by itself when they return (before they start typing).
const CHECK_EVERY_MS = 60 * 1000;

export default function UpdateWatcher({ mode }: { mode: UpdateMode }) {
  const [newer, setNewer] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    // `npm run dev` has no version.json; nothing to compare.
    if (import.meta.env.DEV) return;
    const current = __BUILD_ID__;

    const reload = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };

    const check = async (returnedAfterHiddenMs: number | null) => {
      const latest = await fetchLatestBuildId((u, i) => fetch(u, i));
      const action = decideUpdate({ current, latest, mode, returnedAfterHiddenMs });
      if (action === 'reload') reload();
      else if (action === 'banner') setNewer(true);
    };

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? null : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      void check(away);
    };

    const timer = window.setInterval(() => { if (!document.hidden) void check(null); }, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisibility);
    void check(null);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode]);

  if (!newer) return null;
  const he = (localStorage.getItem('tp_lang') || 'he') !== 'en';
  return (
    <button className="update-pill" onClick={() => window.location.reload()} dir={he ? 'rtl' : 'ltr'}>
      <span className="update-pill-dot" aria-hidden="true" />
      {he ? 'יצאה גרסה חדשה · לחץ לעדכון' : 'New version · tap to update'}
    </button>
  );
}

export { BACKGROUND_RELOAD_AFTER_MS };
