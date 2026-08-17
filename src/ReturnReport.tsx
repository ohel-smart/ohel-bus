// Standalone, code-protected driver self-report page for return trips.
// Reached via a link (…/?report=return). Drivers enter their personal code,
// pick the origin, number of passengers and time — it writes a ride straight
// into the same datastore the app uses (dbService.addScan), so it appears in
// the central table, the WhatsApp/email summaries, AND the driver's own
// "My Trips Today" list in the main app — no dispatcher scan needed.
import { useState, useEffect, type CSSProperties } from 'react';
import dbService, { LOCATIONS } from './services/db';
import type { User, DepartureLocation } from './services/db';
import logo from './assets/logo.png';
import './App.css';

const TXT = {
  he: {
    title: 'דיווח נסיעת חזרה',
    subtitle: 'מיועד לנהגים בלבד — הזן את הקוד האישי ודווח על הנסיעה.',
    codePlaceholder: 'קוד אישי',
    continue: 'המשך',
    codeNotFound: 'קוד לא נמצא. נסה שוב בעוד רגע.',
    codeNotDriver: 'הקוד הזה אינו של נהג.',
    driverLabel: 'נהג',
    originLabel: 'מאיפה יצאת',
    originOhel: 'אוהל (חזור)',
    origin770: '770 (הלוך)',
    passengersLabel: 'כמה אנשים',
    passengersPlaceholder: 'מספר הנוסעים',
    passengersInvalid: 'מספר אנשים לא תקין',
    timeLabel: 'שעה',
    submit: 'שלח דיווח',
    submitting: 'שולח…',
    switchDriver: 'החלף נהג',
    submitError: 'שגיאה בשליחה, נסה שוב.',
    successTitle: 'הדיווח נקלט בהצלחה!',
    successHint: 'הנסיעה נכנסה גם לרשימת "הנסיעות שלי היום" שלך באפליקציה.',
    another: 'דיווח נוסף',
    peopleWord: 'אנשים',
  },
  en: {
    title: 'Report a Return Trip',
    subtitle: 'For drivers only — enter your personal code and report the trip.',
    codePlaceholder: 'Personal code',
    continue: 'Continue',
    codeNotFound: 'Code not found. Try again in a moment.',
    codeNotDriver: 'This code does not belong to a driver.',
    driverLabel: 'Driver',
    originLabel: 'Where did you leave from',
    originOhel: 'Ohel (return)',
    origin770: '770 (outbound)',
    passengersLabel: 'How many people',
    passengersPlaceholder: 'Number of passengers',
    passengersInvalid: 'Invalid number of people',
    timeLabel: 'Time',
    submit: 'Send Report',
    submitting: 'Sending…',
    switchDriver: 'Switch driver',
    submitError: 'Failed to send, try again.',
    successTitle: 'Report received successfully!',
    successHint: 'This trip also appears in your "My Trips Today" list in the app.',
    another: 'Report another',
    peopleWord: 'people',
  },
} as const;

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function buildScannedAt(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  const d = new Date();
  if (!isNaN(h) && !isNaN(m)) d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function ReturnReport() {
  const [lang, setLang] = useState<'he' | 'en'>('he');
  const tx = TXT[lang];

  const [code, setCode] = useState('');
  const [driver, setDriver] = useState<User | null>(null);
  const [origin, setOrigin] = useState<DepartureLocation>('Ohel');
  const [passengers, setPassengers] = useState('');
  const [time, setTime] = useState(nowHHMM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Pull the latest users so code lookup works even on a cold page load.
  useEffect(() => { dbService.fetchDataFromSheets(); }, []);

  const verifyCode = () => {
    const u = dbService.loginWithCode(code.trim());
    if (!u) { setError(tx.codeNotFound); return; }
    if (u.role !== 'driver' && u.role !== 'admin') { setError(tx.codeNotDriver); return; }
    setError('');
    setDriver(u);
  };

  const submit = async () => {
    const pax = parseInt(passengers, 10);
    if (isNaN(pax) || pax < 0) { setError(tx.passengersInvalid); return; }
    setError('');
    setSubmitting(true);
    try {
      await dbService.addScan({
        dispatcherId: 'self_report',
        dispatcherName: lang === 'he' ? 'דיווח עצמי' : 'Self report',
        driverId: driver!.id,
        driverName: driver!.name,
        passengersCount: pax,
        scannedAt: buildScannedAt(time),
        location: { latitude: LOCATIONS[origin].latitude, longitude: LOCATIONS[origin].longitude },
        departureLocation: origin,
      });
      setDone(true);
    } catch {
      setError(tx.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPassengers('');
    setTime(nowHHMM());
    setOrigin('Ohel');
    setDone(false);
    setError('');
  };

  const driverLabel = driver ? driver.name.replace(' (נהג)', '') : '';

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

        {/* Step 1: code */}
        {!driver && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') verifyCode(); }}
              placeholder={tx.codePlaceholder}
              inputMode="numeric"
              style={inputStyle}
            />
            <button onClick={verifyCode} className="btn btn-primary" style={btnStyle}>{tx.continue}</button>
          </div>
        )}

        {/* Step 2: form */}
        {driver && !done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: lang === 'he' ? 'right' : 'left' }}>
            <div style={{ background: 'rgba(226,176,78,0.08)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tx.driverLabel}</span>
              <strong style={{ display: 'block', color: '#fff', fontSize: '15px' }}>{driverLabel}</strong>
            </div>

            <div>
              <label style={labelStyle}>{tx.originLabel}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {([['Ohel', tx.originOhel], ['770', tx.origin770]] as [DepartureLocation, string][]).map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setOrigin(val)}
                    className={`btn ${origin === val ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ ...btnStyle, flex: 1, color: origin === val ? '#000' : '#fff' }}
                  >{lbl}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>{tx.passengersLabel}</label>
              <input
                value={passengers}
                onChange={e => setPassengers(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={tx.passengersPlaceholder}
                inputMode="numeric"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>{tx.timeLabel}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
            </div>

            <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ ...btnStyle, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? tx.submitting : tx.submit}
            </button>
            <button onClick={() => { setDriver(null); setCode(''); }} className="btn btn-secondary" style={{ ...btnStyle, color: '#fff' }}>
              {tx.switchDriver}
            </button>
          </div>
        )}

        {/* Step 3: success */}
        {done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '46px' }}>✅</div>
            <strong style={{ color: 'var(--success)', fontSize: '18px' }}>{tx.successTitle}</strong>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              {driverLabel} · {origin === 'Ohel' ? 'אוהל' : '770'} · {passengers} {tx.peopleWord} · {time}
            </p>
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
