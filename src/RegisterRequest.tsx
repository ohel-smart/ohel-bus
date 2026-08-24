// Standalone, public self-registration page for new drivers/dispatchers.
// Reached via a link (…/join). Anyone can submit their details here; it does
// NOT create a real User or login code - it only writes a pending_registrations
// doc and emails the manager. An admin reviews and approves it from the normal
// "User Management" tab, which is what actually creates the User + code.
import { useState, type CSSProperties } from 'react';
import dbService from './services/db';
import type { PendingRegistration } from './services/db';
import logo from './assets/logo.png';
import './App.css';

const TXT = {
  he: {
    title: 'בקשת הצטרפות',
    subtitle: 'נהג או סדרן חדש? מלא/י את הפרטים - מנהל המערכת יאשר את הבקשה ויקצה לך קוד כניסה.',
    nameLabel: 'שם מלא',
    namePlaceholder: 'שם מלא',
    phoneLabel: 'טלפון',
    phonePlaceholder: 'מספר טלפון',
    roleLabel: 'תפקיד',
    roleDriver: 'נהג',
    roleDispatcher: 'סדרן',
    capacityLabel: 'מספר מקומות באוטובוס',
    bigBusLabel: 'אוטובוס גדול',
    submit: 'שלח בקשה',
    submitting: 'שולח…',
    fillAllFields: 'נא למלא שם וטלפון',
    submitError: 'שגיאה בשליחת הבקשה, נסה שוב.',
    successTitle: 'הבקשה נשלחה בהצלחה!',
    successHint: 'מנהל המערכת יבדוק את הבקשה ויקצה לך קוד כניסה אישי. תיצור קשר איתך בהמשך.',
    another: 'שלח בקשה נוספת',
  },
  en: {
    title: 'Join Request',
    subtitle: 'New driver or dispatcher? Fill in your details - the manager will review and assign you a login code.',
    nameLabel: 'Full name',
    namePlaceholder: 'Full name',
    phoneLabel: 'Phone',
    phonePlaceholder: 'Phone number',
    roleLabel: 'Role',
    roleDriver: 'Driver',
    roleDispatcher: 'Dispatcher',
    capacityLabel: 'Bus seat capacity',
    bigBusLabel: 'Big bus',
    submit: 'Send Request',
    submitting: 'Sending…',
    fillAllFields: 'Please fill in your name and phone',
    submitError: 'Failed to send the request, try again.',
    successTitle: 'Request sent successfully!',
    successHint: "The manager will review it and assign you a personal login code. You'll be contacted soon.",
    another: 'Send another request',
  },
} as const;

export default function RegisterRequest() {
  const [lang, setLang] = useState<'he' | 'en'>('he');
  const tx = TXT[lang];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'driver' | 'dispatcher'>('driver');
  const [capacity, setCapacity] = useState<number>(15);
  const [isBigBus, setIsBigBus] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { setError(tx.fillAllFields); return; }
    setError('');
    setSubmitting(true);
    try {
      const reg: Omit<PendingRegistration, 'id' | 'submittedAt'> = {
        name: name.trim(),
        phone: phone.trim(),
        role,
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
    setRole('driver');
    setCapacity(15);
    setIsBigBus(false);
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
            <div>
              <label style={labelStyle}>{tx.nameLabel}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={tx.namePlaceholder} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>{tx.phoneLabel}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={tx.phonePlaceholder} type="tel" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>{tx.roleLabel}</label>
              <select value={role} onChange={e => setRole(e.target.value as 'driver' | 'dispatcher')} style={{ ...inputStyle, textAlign: lang === 'he' ? 'right' : 'left' }}>
                <option value="driver">{tx.roleDriver}</option>
                <option value="dispatcher">{tx.roleDispatcher}</option>
              </select>
            </div>

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
            <button onClick={reset} className="btn btn-primary" style={btnStyle}>{tx.another}</button>
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
