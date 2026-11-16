import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Send, RotateCcw, ChevronDown, ChevronUp, Smartphone, Users, History, Inbox, X } from 'lucide-react';
import { collection, getDocs, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import { db, authReady } from './services/firebase';
import { getPushState, enablePush, disablePush, syncPush, type PushState } from './services/push';
import type { User } from './services/db';
import { NY_TZ } from './services/nyTime';

type Lang = 'he' | 'en';
type Toast = (message: string, type?: 'success' | 'danger') => void;
type GroupKey = 'dispatchers' | 'admins';

const copy = {
  he: {
    // bell
    bellOn: 'התראות פעילות במכשיר הזה. לחץ לכיבוי',
    bellOff: 'לחץ כדי לקבל התראות במכשיר הזה',
    denied: 'התראות חסומות. יש לאפשר אותן בהגדרות הדפדפן ואז לנסות שוב',
    install: 'באייפון צריך קודם להוסיף את האתר למסך הבית (שיתוף ← הוסף למסך הבית), לפתוח מהאייקון, ואז ללחוץ שוב',
    unsupported: 'הדפדפן הזה לא תומך בהתראות',
    enabled: 'התראות הופעלו במכשיר הזה',
    disabled: 'התראות כובו במכשיר הזה',
    failed: 'לא הצלחנו להפעיל התראות, נסה שוב',
    // center
    title: 'מרכז התראות',
    tabCompose: 'שליחה', tabHistory: 'הודעות שנשלחו', tabDevices: 'מי מחובר',
    all: 'כולם', dispatchers: 'סדרנים', drivers: 'נהגים', admins: 'מנהלים',
    categories: 'למי לשלוח', pick: 'בחירת אנשים', picked: 'נבחרו', search: 'חיפוש לפי שם',
    deviceCount: (n: number) => (n ? `${n} מכשירים` : 'אין מכשיר'),
    subject: 'כותרת', message: 'הודעה', send: 'שלח התראה', sending: 'שולח...',
    chooseSomeone: 'בחר קטגוריה או אנשים', fillBoth: 'צריך כותרת והודעה',
    result: (sent: number, people: number, reach: number) => `נשלח ל-${sent} מכשירים (${reach} מתוך ${people} אנשים הפעילו התראות)`,
    sendFailed: 'השליחה נכשלה',
    hint: 'התראה מגיעה רק למי שהפעיל התראות בחשבון שלו (פעמון בראש המסך).',
    statPeople: 'אנשים עם התראות', statDevices: 'מכשירים', statSent: 'הודעות שנשלחו', statLast: 'נשלחה לאחרונה',
    never: 'עוד לא נשלחה',
    preview: 'כך זה ייראה בטלפון',
    audience: (people: number, reach: number) => `יגיע ל-${reach} מתוך ${people} אנשים`,
    noAudience: 'לא נבחרו נמענים',
    resend: 'שלח שוב', historySearch: 'חיפוש בהודעות', noHistory: 'עדיין לא נשלחו הודעות', loading: 'טוען...',
    by: 'נשלח על ידי', delivered: (n: number) => `${n} התקבלו`, failedN: (n: number) => `${n} נכשלו`,
    peopleN: (n: number) => `${n} נמענים`, who: 'מי קיבל',
    noDevice: 'בלי מכשיר', sentDevices: (n: number) => `${n} מכשירים`, failedDevices: 'נכשל',
    notOn: 'לא הפעילו', onList: 'הפעילו', noDevicesYet: 'אף אחד עדיין לא הפעיל התראות', lastSeen: 'נראה',
    groupLabel: { drivers: 'נהגים', dispatchers: 'סדרנים', admins: 'מנהלים' } as Record<string, string>,
    roleLabel: { driver: 'נהג', dispatcher: 'סדרן', admin: 'מנהל' } as Record<string, string>,
    people: 'אנשים',
    deviceCode: 'קוד מכשיר', registered: 'נרשם', deviceN: (n: number) => `מכשיר ${n}`, tapForDevices: 'לחץ על אדם כדי לראות את המכשירים שלו',
  },
  en: {
    bellOn: 'Notifications are on for this device. Tap to turn off',
    bellOff: 'Tap to get notifications on this device',
    denied: 'Notifications are blocked. Allow them in the browser settings, then try again',
    install: 'On iPhone, first add the site to the home screen (Share → Add to Home Screen), open it from the icon, then tap again',
    unsupported: 'This browser does not support notifications',
    enabled: 'Notifications turned on for this device',
    disabled: 'Notifications turned off for this device',
    failed: 'Could not turn on notifications, try again',
    title: 'Notification Center',
    tabCompose: 'Send', tabHistory: 'Sent messages', tabDevices: 'Who is connected',
    all: 'Everyone', dispatchers: 'Dispatchers', drivers: 'Drivers', admins: 'Managers',
    categories: 'Send to', pick: 'Pick people', picked: 'selected', search: 'Search by name',
    deviceCount: (n: number) => (n ? `${n} device${n > 1 ? 's' : ''}` : 'no device'),
    subject: 'Title', message: 'Message', send: 'Send notification', sending: 'Sending...',
    chooseSomeone: 'Choose a category or people', fillBoth: 'A title and a message are required',
    result: (sent: number, people: number, reach: number) => `Sent to ${sent} devices (${reach} of ${people} people have notifications on)`,
    sendFailed: 'Sending failed',
    hint: 'Only people who turned notifications on in their own account (the bell at the top) receive them.',
    statPeople: 'People with notifications', statDevices: 'Devices', statSent: 'Messages sent', statLast: 'Last sent',
    never: 'Not yet',
    preview: 'How it looks on the phone',
    audience: (people: number, reach: number) => `Will reach ${reach} of ${people} people`,
    noAudience: 'No recipients chosen',
    resend: 'Send again', historySearch: 'Search messages', noHistory: 'No messages sent yet', loading: 'Loading...',
    by: 'Sent by', delivered: (n: number) => `${n} delivered`, failedN: (n: number) => `${n} failed`,
    peopleN: (n: number) => `${n} recipients`, who: 'Who received it',
    noDevice: 'no device', sentDevices: (n: number) => `${n} devices`, failedDevices: 'failed',
    notOn: 'Not on', onList: 'On', noDevicesYet: 'Nobody has turned notifications on yet', lastSeen: 'seen',
    groupLabel: { drivers: 'Drivers', dispatchers: 'Dispatchers', admins: 'Managers' } as Record<string, string>,
    roleLabel: { driver: 'Driver', dispatcher: 'Dispatcher', admin: 'Manager' } as Record<string, string>,
    people: 'People',
    deviceCode: 'Device code', registered: 'Registered', deviceN: (n: number) => `Device ${n}`, tapForDevices: 'Tap a person to see their devices',
  },
};

const cleanName = (name: string) => name.replace(/ \((נהג|סדרן|מנהל|מסך)\)$/, '');
const fmtTime = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { timeZone: NY_TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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

  const label = state === 'on' ? t.bellOn : state === 'denied' ? t.denied : state === 'needs-install' ? t.install : state === 'unsupported' ? t.unsupported : t.bellOff;
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

interface PushStatus { devices: number; list?: { id?: string; device: string; lastSeenAt: string; createdAt?: string }[] }
interface LogResult { userId: string; name: string; role: string; devices: number; sent: number; failed: number }
interface LogEntry {
  id: string; title: string; body: string; sentAt: string; sentBy?: { id: string; name: string };
  groups?: string[]; pickedCount?: number; recipients: number; reachable: number; sent: number; failed: number; removed?: number;
  results?: LogResult[];
}

const panel = { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px' } as const;

/** The manager's notification center: send (categories and/or chosen people), the log of what was sent, and who can receive. */
export function NotificationsCenter({ lang, adminCode, users, onToast }: { lang: Lang; adminCode: string; users: User[]; onToast: Toast }) {
  const t = copy[lang];
  const [view, setView] = useState<'compose' | 'history' | 'devices'>('compose');
  const [groups, setGroups] = useState<Record<GroupKey, boolean>>({ dispatchers: false, admins: false });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showPeople, setShowPeople] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<Record<string, PushStatus>>({});
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await authReady;
      const [st, lg] = await Promise.all([
        getDocs(collection(db, 'push_status')),
        getDocs(query(collection(db, 'push_log'), orderBy('sentAt', 'desc'), limit(60))),
      ]);
      const map: Record<string, PushStatus> = {};
      st.docs.forEach(d => { map[d.id] = d.data() as PushStatus; });
      setStatus(map);
      setLog(lg.docs.map(d => d.data() as LogEntry));
    } catch { setLog(prev => prev ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const people = useMemo(
    () => users.filter(u => (u.role === 'admin' || u.role === 'dispatcher') && String(u.code ?? '').trim() !== '').sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), 'he')),
    [users],
  );
  const deviceCount = (id: string) => status[id]?.devices ?? 0;
  const everyone = groups.dispatchers && groups.admins;
  const setAll = (on: boolean) => setGroups({ dispatchers: on, admins: on });
  const toggleGroup = (key: GroupKey) => setGroups(g => ({ ...g, [key]: !g[key] }));
  const togglePerson = (id: string) => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Live preview of who the message would reach.
  const audience = useMemo(() => {
    const roleOf: Record<GroupKey, string> = { dispatchers: 'dispatcher', admins: 'admin' };
    const roles = new Set((Object.keys(groups) as GroupKey[]).filter(g => groups[g]).map(g => roleOf[g]));
    const ids = new Set<string>(picked);
    people.forEach(u => { if (roles.has(u.role)) ids.add(u.id); });
    return { people: ids.size, reach: [...ids].filter(id => (status[id]?.devices ?? 0) > 0).length };
  }, [groups, picked, people, status]);

  const send = async () => {
    if (sending) return;
    const chosenGroups = (Object.keys(groups) as GroupKey[]).filter(g => groups[g]);
    if (!chosenGroups.length && !picked.size) return onToast(t.chooseSomeone, 'danger');
    if (!title.trim() || !text.trim()) return onToast(t.fillBoth, 'danger');
    setSending(true);
    try {
      const resp = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode, title: title.trim(), body: text.trim(), groups: chosenGroups, userIds: [...picked] }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error('send-failed');
      onToast(t.result(data.sent ?? 0, data.recipients ?? 0, data.reachable ?? 0));
      setText('');
      setView('history');
      setOpenId(data.id ?? null);
      void load();
    } catch {
      onToast(t.sendFailed, 'danger');
    }
    setSending(false);
  };

  const resend = (entry: LogEntry) => {
    setTitle(entry.title);
    setText(entry.body);
    const g = new Set(entry.groups ?? []);
    setGroups({ dispatchers: g.has('dispatchers'), admins: g.has('admins') });
    setPicked(new Set());
    setView('compose');
  };

  const totalPeople = people.filter(u => deviceCount(u.id) > 0).length;
  const totalDevices = people.reduce((n, u) => n + deviceCount(u.id), 0);
  const chip = (active: boolean) => ({
    padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
    background: active ? 'rgba(226, 176, 78, 0.18)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--accent)' : '#fff',
  } as const);
  // One small rectangle per person: name, role, and a dot that is green when they have notifications on.
  const tileGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' } as const;
  const tile = (u: User, selected: boolean | null, onClick?: () => void) => {
    const n = deviceCount(u.id);
    return (
      <button
        key={u.id}
        type="button"
        onClick={onClick}
        aria-pressed={selected ?? undefined}
        title={n ? t.deviceCount(n) : t.deviceCount(0)}
        style={{
          all: 'unset', boxSizing: 'border-box', cursor: onClick ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', padding: '14px 14px', minHeight: '72px', borderRadius: '14px', minWidth: 0,
          border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-color)'}`,
          background: selected ? 'rgba(226, 176, 78, 0.16)' : 'rgba(255,255,255,0.04)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', flex: 'none', background: n ? '#49e79e' : 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName(u.name)}</span>
        </span>
        <span style={{ fontSize: '11px', color: selected ? 'var(--accent)' : 'var(--text-secondary)' }}>
          {t.roleLabel[u.role] ?? u.role} · {n ? t.deviceCount(n) : t.noDevice}
        </span>
      </button>
    );
  };

  const audienceLabel = (e: LogEntry) => [
    ...(e.groups ?? []).map(g => t.groupLabel[g] ?? g),
    ...(e.pickedCount ? [`${e.pickedCount} ${t.people}`] : []),
  ].join(' · ');

  const shownShown = people.filter(u => cleanName(u.name).toLowerCase().includes(search.trim().toLowerCase()));
  const history = (log ?? []).filter(e => `${e.title} ${e.body}`.toLowerCase().includes(historySearch.trim().toLowerCase()));

  const tabBtn = (key: typeof view, label: string, icon: React.ReactNode) => (
    <button type="button" onClick={() => setView(key)} style={{ ...chip(view === key), display: 'inline-flex', alignItems: 'center', gap: '6px', flex: '1 1 0', justifyContent: 'center' }}>
      {icon}<span>{label}</span>
    </button>
  );
  const stat = (label: string, value: string | number) => (
    <div style={{ ...panel, flex: '1 1 120px', padding: '10px 12px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Bell size={18} color="var(--accent)" />{t.title}
      </h2>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {stat(t.statPeople, `${totalPeople} / ${people.length}`)}
        {stat(t.statDevices, totalDevices)}
        {stat(t.statSent, log?.length ?? 0)}
        {stat(t.statLast, log?.[0] ? fmtTime(log[0].sentAt, lang) : t.never)}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {tabBtn('compose', t.tabCompose, <Send size={13} />)}
        {tabBtn('history', t.tabHistory, <History size={13} />)}
        {tabBtn('devices', t.tabDevices, <Smartphone size={13} />)}
      </div>

      {view === 'compose' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="form-label">{t.categories}</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={chip(everyone)} onClick={() => setAll(!everyone)}>{t.all}</button>
              <button type="button" style={chip(groups.dispatchers)} onClick={() => toggleGroup('dispatchers')}>{t.dispatchers}</button>
              <button type="button" style={chip(groups.admins)} onClick={() => toggleGroup('admins')}>{t.admins}</button>
              <button type="button" style={{ ...chip(picked.size > 0), display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => setShowPeople(v => !v)}>
                <Users size={12} />{t.pick}{picked.size ? ` (${picked.size} ${t.picked})` : ''}
                {showPeople ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: audience.people ? '#49e79e' : 'var(--text-secondary)' }}>
              {audience.people ? t.audience(audience.people, audience.reach) : t.noAudience}
            </div>
          </div>

          {showPeople && (
            <div>
              <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} />
              <div style={{ ...tileGrid, maxHeight: '260px', overflowY: 'auto', marginTop: '8px' }}>
                {shownShown.map(u => tile(u, picked.has(u.id), () => togglePerson(u.id)))}
              </div>
            </div>
          )}

          <div>
            <label className="form-label">{t.subject}</label>
            <input className="form-input" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="form-label">{t.message}</label>
            <textarea className="form-input" rows={3} value={text} maxLength={500} onChange={e => setText(e.target.value)} />
          </div>

          {(title.trim() || text.trim()) && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{t.preview}</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px', borderRadius: '18px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', maxWidth: '360px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontWeight: 800, fontSize: '12px' }}>OB</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{title.trim() || '…'}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text.trim()}</div>
                </div>
              </div>
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={send} disabled={sending} style={{ width: '100%' }}>
            <Send size={14} /><span>{sending ? t.sending : t.send}</span>
          </button>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.hint}</p>
        </div>
      )}

      {view === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input className="form-input" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder={t.historySearch} />
          {log === null && <div style={{ ...panel, color: 'var(--text-secondary)', fontSize: '13px' }}>{t.loading}</div>}
          {log !== null && history.length === 0 && <div style={{ ...panel, color: 'var(--text-secondary)', fontSize: '13px' }}>{t.noHistory}</div>}
          {history.map(entry => {
            const open = openId === entry.id;
            return (
              <div key={entry.id} style={panel}>
                <button type="button" onClick={() => setOpenId(open ? null : entry.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '14px', color: '#fff' }}>{entry.title}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtTime(entry.sentAt, lang)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.body}</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', fontSize: '11px', alignItems: 'center' }}>
                    {audienceLabel(entry) && <span style={{ ...chip(false), padding: '2px 10px', fontSize: '11px', cursor: 'inherit' }}>{audienceLabel(entry)}</span>}
                    <span style={{ color: 'var(--text-secondary)' }}>{t.peopleN(entry.recipients)}</span>
                    <span style={{ color: '#49e79e' }}>{t.delivered(entry.sent)}</span>
                    {entry.failed > 0 && <span style={{ color: '#f87171' }}>{t.failedN(entry.failed)}</span>}
                    <span style={{ marginInlineStart: 'auto', color: 'var(--text-secondary)' }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                  </div>
                </button>
                {open && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    {entry.sentBy?.name && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{t.by}: {cleanName(entry.sentBy.name)}</div>}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t.who}</div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {(entry.results ?? []).map(r => (
                        <div key={r.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                          <span>{cleanName(r.name)} <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>· {t.roleLabel[r.role] ?? r.role}</span></span>
                          <span style={{ color: r.devices === 0 ? 'var(--text-secondary)' : r.failed && !r.sent ? '#f87171' : '#49e79e' }}>
                            {r.devices === 0 ? t.noDevice : r.sent ? t.sentDevices(r.sent) : t.failedDevices}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => resend(entry)} style={{ marginTop: '10px', padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <RotateCcw size={12} />{t.resend}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'devices' && (
        <div style={panel}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            {totalPeople === 0 ? t.noDevicesYet : t.tapForDevices}
          </div>
          <div style={tileGrid}>
            {people.map(u => tile(u, detailId === u.id, () => setDetailId(detailId === u.id ? null : u.id)))}
          </div>
          {detailId && (() => {
            const person = people.find(u => u.id === detailId);
            const devs = status[detailId]?.list ?? [];
            if (!person) return null;
            return (
              <div style={{ marginTop: '14px', padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <strong style={{ color: '#fff', fontSize: '14px' }}>{cleanName(person.name)} <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 400 }}>· {t.roleLabel[person.role] ?? person.role}</span></strong>
                  <span style={{ fontSize: '12px', color: deviceCount(person.id) ? '#49e79e' : 'var(--text-secondary)' }}>{t.deviceCount(deviceCount(person.id))}</span>
                </div>
                {devs.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.noDevice}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {devs.map((d, i) => (
                    <div key={d.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}>
                      <Smartphone size={18} color="var(--accent)" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{t.deviceN(i + 1)} · {d.device || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {t.lastSeen} {fmtTime(d.lastSeenAt, lang)}{d.createdAt ? ` · ${t.registered} ${fmtTime(d.createdAt, lang)}` : ''}
                        </div>
                      </div>
                      {d.id && (
                        <div style={{ textAlign: 'center', direction: 'ltr' }}>
                          <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{t.deviceCode}</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '1px', color: 'var(--accent)', fontFamily: 'monospace' }}>{d.id}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Inbox: the messages the manager sent to this person, shown when a notification is tapped or when
// the person opens it from the header. One document per person (push_inbox/{userId}, written by api/send-push.js).

export interface InboxItem { id: string; title: string; body: string; sentAt: string }
const seenKey = (userId: string) => `tp_inbox_seen_${userId}`;
const readSeen = (userId: string): string => { try { return localStorage.getItem(seenKey(userId)) ?? ''; } catch { return ''; } };

export function useInbox(userId: string | null) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [seen, setSeen] = useState('');
  useEffect(() => {
    if (!userId) { setItems([]); return; }
    setSeen(readSeen(userId));
    let unsubscribe: (() => void) | null = null;
    let alive = true;
    (async () => {
      try {
        await authReady;
        if (!alive) return;
        unsubscribe = onSnapshot(doc(db, 'push_inbox', userId), snap => {
          setItems(((snap.data()?.items as InboxItem[] | undefined) ?? []).slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
        }, () => { /* offline or blocked: the inbox just stays as it was */ });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; unsubscribe?.(); };
  }, [userId]);
  const unread = items.filter(i => i.sentAt > seen).length;
  const markSeen = useCallback(() => {
    if (!userId || !items.length) return;
    const newest = items[0].sentAt;
    try { localStorage.setItem(seenKey(userId), newest); } catch { /* private mode */ }
    setSeen(newest);
  }, [userId, items]);
  return { items, unread, markSeen };
}

const inboxCopy = {
  he: { title: 'התראות שקיבלתי', empty: 'עוד לא קיבלת התראות', open: 'התראות שקיבלתי', close: 'סגור' },
  en: { title: 'My notifications', empty: 'No notifications yet', open: 'My notifications', close: 'Close' },
};

/** Header button with an unread badge. */
export function InboxButton({ lang, unread, onClick }: { lang: Lang; unread: number; onClick: () => void }) {
  const label = inboxCopy[lang].open;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={unread ? `${label} (${unread})` : label}
      style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 8px', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
    >
      <Inbox size={14} />
      {unread > 0 && (
        <span style={{ position: 'absolute', top: '-6px', insetInlineEnd: '-6px', minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

/** The list itself - opens full-screen over whatever the person was doing. */
export function InboxModal({ lang, open, items, seenBefore, onClose }: { lang: Lang; open: boolean; items: InboxItem[]; seenBefore: string; onClose: () => void }) {
  const t = inboxCopy[lang];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(1,2,4,0.82)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '460px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 20px 60px rgba(0,0,0,0.55)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <strong style={{ color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={16} color="var(--accent)" />{t.title}</strong>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ all: 'unset', cursor: 'pointer', color: '#fff', display: 'flex', padding: '4px' }}><X size={18} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>{t.empty}</div>}
          {items.map(item => {
            const fresh = item.sentAt > seenBefore;
            return (
              <div key={item.id} style={{ padding: '12px 14px', borderRadius: '16px', background: fresh ? 'rgba(226, 176, 78, 0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${fresh ? 'rgba(226, 176, 78, 0.45)' : 'rgba(255,255,255,0.1)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                  <strong style={{ color: '#fff', fontSize: '14px' }}>{item.title}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtTime(item.sentAt, lang)}</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
