import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db, authReady } from './services/firebase';
import { getPushState, enablePush, disablePush, syncPush, type PushState } from './services/push';
import type { User } from './services/db';

type Lang = 'he' | 'en';
type Toast = (message: string, type?: 'success' | 'danger') => void;

const copy = {
  he: {
    on: 'התראות פעילות במכשיר הזה. לחץ לכיבוי',
    off: 'לחץ כדי לקבל התראות במכשיר הזה',
    denied: 'התראות חסומות. יש לאפשר אותן בהגדרות הדפדפן ואז לנסות שוב',
    install: 'באייפון צריך קודם להוסיף את האתר למסך הבית (שיתוף ← הוסף למסך הבית), לפתוח מהאייקון, ואז ללחוץ שוב',
    unsupported: 'הדפדפן הזה לא תומך בהתראות',
    enabled: 'התראות הופעלו במכשיר הזה',
    disabled: 'התראות כובו במכשיר הזה',
    failed: 'לא הצלחנו להפעיל התראות, נסה שוב',
    title: 'שליחת התראה',
    all: 'כולם', dispatchers: 'סדרנים', drivers: 'נהגים', admins: 'מנהלים',
    categories: 'למי לשלוח', pick: 'בחירת אנשים', picked: 'נבחרו', search: 'חיפוש לפי שם',
    devices: (n: number) => (n ? `${n} מכשירים` : 'אין מכשיר'),
    subject: 'כותרת', message: 'הודעה', send: 'שלח התראה', sending: 'שולח...',
    chooseSomeone: 'בחר קטגוריה או אנשים', fillBoth: 'צריך כותרת והודעה',
    result: (sent: number, people: number, reach: number) => `נשלח ל-${sent} מכשירים (${reach} מתוך ${people} אנשים הפעילו התראות)`,
    sendFailed: 'השליחה נכשלה',
    hint: 'התראה מגיעה רק למי שהפעיל התראות בחשבון שלו (פעמון בראש המסך).',
  },
  en: {
    on: 'Notifications are on for this device. Tap to turn off',
    off: 'Tap to get notifications on this device',
    denied: 'Notifications are blocked. Allow them in the browser settings, then try again',
    install: 'On iPhone, first add the site to the home screen (Share → Add to Home Screen), open it from the icon, then tap again',
    unsupported: 'This browser does not support notifications',
    enabled: 'Notifications turned on for this device',
    disabled: 'Notifications turned off for this device',
    failed: 'Could not turn on notifications, try again',
    title: 'Send a notification',
    all: 'Everyone', dispatchers: 'Dispatchers', drivers: 'Drivers', admins: 'Managers',
    categories: 'Send to', pick: 'Pick people', picked: 'selected', search: 'Search by name',
    devices: (n: number) => (n ? `${n} device${n > 1 ? 's' : ''}` : 'no device'),
    subject: 'Title', message: 'Message', send: 'Send notification', sending: 'Sending...',
    chooseSomeone: 'Choose a category or people', fillBoth: 'A title and a message are required',
    result: (sent: number, people: number, reach: number) => `Sent to ${sent} devices (${reach} of ${people} people have notifications on)`,
    sendFailed: 'Sending failed',
    hint: 'Only people who turned notifications on in their own account (the bell at the top) receive them.',
  },
};

const cleanName = (name: string) => name.replace(/ \((נהג|סדרן|מנהל|מסך)\)$/, '');

/** The bell each signed-in person taps once, inside their own account, to receive notifications on this device. */
export function PushBell({ lang, user, onToast }: { lang: Lang; user: User; onToast: Toast }) {
  const t = copy[lang];
  const [state, setState] = useState<PushState>(() => getPushState());
  const [busy, setBusy] = useState(false);

  // A device that already said yes tells the server who is signed in on it now.
  useEffect(() => { void syncPush(user.code); }, [user.code]);

  const press = async () => {
    if (busy) return;
    if (state === 'on') {
      setBusy(true);
      await disablePush(user.code);
      setState(getPushState());
      setBusy(false);
      onToast(t.disabled);
      return;
    }
    if (state === 'denied') return onToast(t.denied, 'danger');
    if (state === 'needs-install') return onToast(t.install, 'danger');
    if (state === 'unsupported') return onToast(t.unsupported, 'danger');
    setBusy(true);
    try {
      await enablePush(user.code);
      onToast(t.enabled);
    } catch (e) {
      onToast(e instanceof Error && e.message === 'denied' ? t.denied : t.failed, 'danger');
    }
    setState(getPushState());
    setBusy(false);
  };

  const label = state === 'on' ? t.on : state === 'denied' ? t.denied : state === 'needs-install' ? t.install : state === 'unsupported' ? t.unsupported : t.off;
  return (
    <button
      type="button"
      onClick={press}
      title={label}
      aria-label={label}
      aria-pressed={state === 'on'}
      disabled={busy}
      style={{
        background: state === 'on' ? 'rgba(73, 231, 158, 0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${state === 'on' ? 'rgba(73, 231, 158, 0.5)' : 'var(--border-color)'}`,
        borderRadius: '6px', padding: '4px 8px', cursor: busy ? 'wait' : 'pointer',
        color: state === 'on' ? '#49e79e' : '#fff', display: 'inline-flex', alignItems: 'center', opacity: busy ? 0.6 : 1,
      }}
    >
      {state === 'on' ? <Bell size={14} /> : <BellOff size={14} />}
    </button>
  );
}

/** The manager's send screen: categories (everyone / dispatchers / drivers / managers) and/or chosen people. */
export function PushSendCard({ lang, adminCode, users, onToast }: { lang: Lang; adminCode: string; users: User[]; onToast: Toast }) {
  const t = copy[lang];
  const [groups, setGroups] = useState<Record<'dispatchers' | 'drivers' | 'admins', boolean>>({ dispatchers: false, drivers: false, admins: false });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showPeople, setShowPeople] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [devices, setDevices] = useState<Record<string, number>>({});

  // Device counts per person (just numbers, no tokens) so the list shows who can receive anything.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await authReady;
        const snap = await getDocs(collection(db, 'push_status'));
        if (!alive) return;
        const counts: Record<string, number> = {};
        snap.docs.forEach(d => { counts[d.id] = Number(d.data().devices) || 0; });
        setDevices(counts);
      } catch { /* the list still works without counts */ }
    })();
    return () => { alive = false; };
  }, [result]);

  const people = useMemo(
    () => users.filter(u => u.role !== 'screen').sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), 'he')),
    [users],
  );
  const shown = people.filter(u => cleanName(u.name).toLowerCase().includes(search.trim().toLowerCase()));
  const everyone = groups.dispatchers && groups.drivers && groups.admins;
  const setAll = (on: boolean) => setGroups({ dispatchers: on, drivers: on, admins: on });
  const toggleGroup = (key: 'dispatchers' | 'drivers' | 'admins') => setGroups(g => ({ ...g, [key]: !g[key] }));
  const togglePerson = (id: string) => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const send = async () => {
    if (sending) return;
    const chosenGroups = (['dispatchers', 'drivers', 'admins'] as const).filter(g => groups[g]);
    if (!chosenGroups.length && !picked.size) return onToast(t.chooseSomeone, 'danger');
    if (!title.trim() || !text.trim()) return onToast(t.fillBoth, 'danger');
    setSending(true);
    setResult('');
    try {
      const resp = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode, title: title.trim(), body: text.trim(), groups: chosenGroups, userIds: [...picked] }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error('send-failed');
      const summary = t.result(data.sent ?? 0, data.recipients ?? 0, data.reachable ?? 0);
      setResult(summary);
      onToast(summary);
      setText('');
    } catch {
      onToast(t.sendFailed, 'danger');
    }
    setSending(false);
  };

  const chip = (active: boolean) => ({
    padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
    background: active ? 'rgba(226, 176, 78, 0.18)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--accent)' : '#fff',
  } as const);

  return (
    <div className="card" id="push-send-card">
      <h3 className="card-title"><Bell size={16} color="var(--accent)" />{t.title}</h3>

      <div className="form-group">
        <label className="form-label">{t.categories}</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={chip(everyone)} onClick={() => setAll(!everyone)}>{t.all}</button>
          <button type="button" style={chip(groups.dispatchers)} onClick={() => toggleGroup('dispatchers')}>{t.dispatchers}</button>
          <button type="button" style={chip(groups.drivers)} onClick={() => toggleGroup('drivers')}>{t.drivers}</button>
          <button type="button" style={chip(groups.admins)} onClick={() => toggleGroup('admins')}>{t.admins}</button>
          <button type="button" style={chip(picked.size > 0)} onClick={() => setShowPeople(v => !v)}>
            {t.pick}{picked.size ? ` (${picked.size} ${t.picked})` : ''}
          </button>
        </div>
      </div>

      {showPeople && (
        <div className="form-group">
          <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} />
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {shown.map(u => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '4px 2px' }}>
                <input type="checkbox" checked={picked.has(u.id)} onChange={() => togglePerson(u.id)} />
                <span style={{ flex: 1 }}>{cleanName(u.name)}</span>
                <span style={{ fontSize: '11px', color: (devices[u.id] ?? 0) > 0 ? '#49e79e' : 'var(--text-secondary)' }}>{t.devices(devices[u.id] ?? 0)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">{t.subject}</label>
        <input className="form-input" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">{t.message}</label>
        <textarea className="form-input" rows={3} value={text} maxLength={500} onChange={e => setText(e.target.value)} />
      </div>

      <button type="button" className="btn btn-primary" onClick={send} disabled={sending} style={{ width: '100%' }}>
        <Send size={14} />
        <span>{sending ? t.sending : t.send}</span>
      </button>
      {result && <p style={{ fontSize: '12px', color: '#49e79e', marginTop: '8px' }}>{result}</p>}
      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>{t.hint}</p>
    </div>
  );
}
