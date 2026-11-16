// Web push (Firebase Cloud Messaging) from the device's side: ask permission once the person taps the
// bell inside their own account, get this device's token, and hand it to the server, which stores it
// next to that person (collection push_devices - see api/register-push.js). Nothing here runs by itself
// except a silent re-sync of a device that already said yes.
import { app } from './firebase';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const TOKEN_KEY = 'tp_push_token';

const readToken = (): string | null => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (token: string | null) => {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function getPushState(): PushState {
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // On an iPhone, push exists only for a site added to the home screen and opened from its icon.
  if (!capable) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && readToken()) return 'on';
  return 'off';
}

const deviceLabel = (): string => {
  const ua = navigator.userAgent;
  const os = /iphone|ipad|ipod/i.test(ua) ? 'iPhone' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Other';
  const browser = /samsungbrowser/i.test(ua) ? 'Samsung Internet' : /edg/i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /firefox|fxios/i.test(ua) ? 'Firefox' : 'Browser';
  return `${os} · ${browser}${isStandalone() ? ' · app' : ''}`;
};

async function post(body: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch('/api/register-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify(body) });
  } finally {
    clearTimeout(timer);
  }
}

async function currentToken(): Promise<string> {
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;
  const { getMessaging, getToken } = await import('firebase/messaging');
  const token = await getToken(getMessaging(app), { serviceWorkerRegistration: registration });
  if (!token) throw new Error('no-token');
  return token;
}

/** Called from a tap. Throws 'denied' if the person said no. */
export async function enablePush(code: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');
  const token = await currentToken();
  const resp = await post({ code, token, device: deviceLabel() });
  if (!resp.ok) throw new Error('register-failed');
  writeToken(token);
}

/** Silent: a device that already said yes tells the server who is signed in on it now. */
export async function syncPush(code: string): Promise<void> {
  if (getPushState() !== 'on') return;
  try {
    const token = await currentToken();
    const resp = await post({ code, token, device: deviceLabel() });
    if (resp.ok) writeToken(token);
  } catch { /* try again next time */ }
}

/** Stops this device getting this person's notifications (turn off, or logout). */
export async function disablePush(code: string): Promise<void> {
  const token = readToken();
  writeToken(null);
  if (!token) return;
  try { await post({ code, token, action: 'remove' }); } catch { /* the server drops dead tokens on its own */ }
}
