// Standalone, public self-registration page for new drivers/dispatchers.
// Reached via a link (…/join?role=driver or …/join?role=dispatcher - two
// separate links meant to be shared with each group; the role is locked when
// present, bare …/join falls back to a role picker). Anyone can submit their
// details here; it does NOT create a real User or login code - it only writes
// a pending_registrations doc and emails the manager. An admin reviews and
// approves it (see the pending-registrations modal/section in App.tsx), which
// is what actually creates the User with this requested (or an admin-edited) code.
import { useState, type CSSProperties } from 'react';
import dbService from './services/db';
import type { PendingRegistration } from './services/db';
import logo from './assets/logo.png';
import './App.css';

const TXT = {
  he: {
    title: 'בקשת הצטרפות',
    subtitle: 'נהג או סדרן חדש? מלא/י את הפרטים - מנהל המערכת יאשר את הבקשה.',
    nameLabel: 'שם מלא',
    namePlaceholder: 'שם מלא',
    phoneLabel: 'טלפון',
    phonePlaceholder: 'מספר טלפון',
    roleLabel: 'תפקיד',
    roleDriver: 'נהג',
    roleDispatcher: 'סדרן',
    joiningAs: 'נרשם/ת בתור',
    capacityLabel: 'מספר מקומות באוטובוס',
    bigBusLabel: 'אוטובוס גדול',
    codeLabel: 'בחר/י קוד כניסה אישי (לפחות 7 תווים)',
    codePlaceholder: 'קוד כניסה',
    codeTooShort: 'הקוד חייב להיות באורך 7 תווים לפחות',
    submit: 'שלח בקשה',
    submitting: 'שולח…',
    fillAllFields: 'נא למלא שם וטלפון',
    submitError: 'שגיאה בשליחת הבקשה, נסה שוב.',
    successTitle: 'הבקשה נשלחה בהצלחה!',
    successHint: 'מנהל המערכת יבדוק את הבקשה. האישור בדרך כלל ניתן תוך כמה דקות.',
    goToSite: 'כניסה לאתר',
    goToSiteHint: 'נסה/י להתחבר עם הקוד שבחרת בעוד דקה - סביר שהבקשה כבר תאושר.',
    another: 'שלח בקשה נוספת',
  },
  en: {
    title: 'Join Request',
    subtitle: 'New driver or dispatcher? Fill in your details - the manager will review the request.',
    nameLabel: 'Full name',
    namePlaceholder: 'Full name',
    phoneLabel: 'Phone',
    phonePlaceholder: 'Phone number',
    roleLabel: 'Role',
    roleDriver: 'Driver',
    roleDispatcher: 'Dispatcher',
    joiningAs: 'Joining as',
    capacityLabel: 'Bus seat capacity',
    bigBusLabel: 'Big bus',
    codeLabel: 'Choose a personal login code (7+ characters)',
    codePlaceholder: 'Login code',
    codeTooShort: 'The code must be at least 7 characters long',
    submit: 'Send Request',
    submitting: 'Sending…',
    fillAllFields: 'Please fill in your name and phone',
    submitError: 'Failed to send the request, try again.',
    successTitle: 'Request sent successfully!',
    successHint: "The manager will review it. Approval is usually given within a few minutes.",
    goToSite: 'Go to the site',
    goToSiteHint: "Try logging in with the code you chose in a minute - it's usually approved by then.",
    another: 'Send another request',
  },
} as const;

function roleFromQuery(): 'driver' | 'dispatcher' | null {
  const r = new URLSearchParams(window.location.search).get('role');
  return r === 'driver' || r === 'dispatcher' ? r : null;
}

export default function RegisterRequest() {
  const lockedRole = roleFromQuery();
  // Drivers land in English by default (switchable to Hebrew); dispatchers
  // and the role-less fallback land in Hebrew by default (switchable to English).
  const [lang, setLang] = useState<'he' | 'en'>(lockedRole === 'driver' ? 'en' : 'he');
  const tx = TXT[lang];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'driver' | 'dispatcher'>(lockedRole || 'driver');
  const [capacity, setCapacity] = useState<number>(15);
  const [isBigBus, setIsBigBus] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { setError(tx.fillAllFields); return; }
    if (code.trim().length <= 6) { setError(tx.codeTooShort); return; }
    setError('');
    setSubmitting(true);
    try {
      const reg: Omit<PendingRegistration, 'id' | 'submittedAt'> = {
        name: name.trim(),
        phone: phone.trim(),
        role,
        code: code.trim(),
        ...(role === 'driver' ? { capacity, isBigBus } : {})
      };
      await dbService.submitRegistration(reg);
      fetch('/api/registration-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reg)
      }).catch(() => {}); // the request itself is already saved either way; the email is best-effort
      setDone(true);
    } catch {
      setError(tx.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setName('');
    setPhone('');
    setRole(lockedRole || 'driver');
    setCapacity(15);
    setIsBigBus(false);
    setCode('');
    setDone(false);
    setError('');
  };

  return (
    <div dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      <button
        onClick={() => setLang(l => (l === 'he' ? 'en' : 'he'))}
        className="btn btn-secondary"
        style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', padding: '8px 14px', fontSize: '12px', color: '#fff' }}
      >
        {lang === 'he' ? 'English' : 'עברית'}
      </button>

      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '28px', textAlign: 'center' }}>
        <img src={logo} alt="Ohel" style={{ height: '54px', margin: '0 auto 14px', display: 'block' }} />
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>{tx.title}</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 22px' }}>{tx.subtitle}</p>

        {!done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: lang === 'he' ? 'right' : 'left' }}>
            {lockedRole && (
              <div style={{ background: 'rgba(226,176,78,0.08)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tx.joiningAs}</span>
                <strong style={{ display: 'block', color: 'var(--accent)', fontSize: '15px' }}>
                  {role === 'driver' ? tx.roleDriver : tx.roleDispatcher}
                </strong>
              </div>
            )}

            <div>
              <label style={labelStyle}>{tx.nameLabel}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={tx.namePlaceholder} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>{tx.phoneLabel}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={tx.phonePlaceholder} type="tel" style={inputStyle} />
            </div>

            {!lockedRole && (
              <div>
                <label style={labelStyle}>{tx.roleLabel}</label>
                <select value={role} onChange={e => setRole(e.target.value as 'driver' | 'dispatcher')} style={{ ...inputStyle, textAlign: lang === 'he' ? 'right' : 'left' }}>
                  <option value="driver">{tx.roleDriver}</option>
                  <option value="dispatcher">{tx.roleDispatcher}</option>
                </select>
              </div>
            )}

            {role === 'driver' && (
              <div>
                <label style={labelStyle}>{tx.capacityLabel}</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(Math.max(1, parseInt(e.target.value) || 15))}
                  style={{ ...inputStyle, textAlign: lang === 'he' ? 'right' : 'left' }}
                />
              </div>
            )}

            {role === 'driver' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                <input type="checkbox" checked={isBigBus} onChange={e => setIsBigBus(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                {tx.bigBusLabel}
              </label>
            )}

            <div>
              <label style={labelStyle}>{tx.codeLabel}</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder={tx.codePlaceholder} style={inputStyle} />
            </div>

            <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ ...btnStyle, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? tx.submitting : tx.submit}
            </button>
          </div>
        )}

        {done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '46px' }}>✅</div>
            <strong style={{ color: 'var(--success)', fontSize: '18px' }}>{tx.successTitle}</strong>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{tx.successHint}</p>
            <a href="/" className="btn btn-primary" style={{ ...btnStyle, textDecoration: 'none', display: 'block', boxSizing: 'border-box' }}>
              {tx.goToSite}
            </a>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{tx.goToSiteHint}</p>
            <button onClick={reset} className="btn btn-secondary" style={{ ...btnStyle, color: '#fff' }}>{tx.another}</button>
          </div>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '14px' }}>{error}</p>}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: '10px', border: '1px solid var(--border-color)',
  background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '16px', textAlign: 'center', boxSizing: 'border-box',
};
const btnStyle: CSSProperties = { width: '100%', padding: '13px', fontSize: '15px', fontWeight: 700 };
const labelStyle: CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' };
