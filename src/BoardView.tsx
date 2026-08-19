// Standalone, code-protected public "arrival board" page — meant to be left open
// on a screen/TV at one of the two physical pickup locations (770 or Ohel), so
// people waiting there can see at a glance which buses are on the way and when
// they're expected. Reached via a link (…/?board=1). Read-only: no dispatcher
// actions live here, it only ever reads from dbService.
import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import dbService from './services/db';
import type { User, ActiveLocation, DepartureLocation } from './services/db';
import logo from './assets/logo.png';
import './App.css';

const TXT = {
  he: {
    title: 'לוח הגעות אוטובוסים',
    subtitle: 'מיועד לצוות בלבד — הזן קוד גישה אישי להצגת הלוח.',
    codePlaceholder: 'קוד גישה',
    continue: 'המשך',
    codeNotFound: 'קוד לא נמצא. נסה שוב בעוד רגע.',
    codeNotAllowed: 'קוד זה אינו מורשה לצפייה בלוח.',
    locationPrompt: 'באיזה מיקום נמצא המסך?',
    loc770: 'אני ב-770',
    locOhel: 'אני באוהל',
    changeLocation: 'שנה מיקום',
    boardFor770: 'אוטובוסים בדרך ל-770',
    boardForOhel: 'אוטובוסים בדרך לאוהל',
    empty: 'אין אוטובוסים בדרך כרגע',
    driverWord: 'נהג',
    arrivalWord: 'שעת הגעה משוערת',
  },
  en: {
    title: 'Bus Arrival Board',
    subtitle: 'Staff only — enter your personal access code to open the board.',
    codePlaceholder: 'Access code',
    continue: 'Continue',
    codeNotFound: 'Code not found. Try again in a moment.',
    codeNotAllowed: 'This code is not authorized to view the board.',
    locationPrompt: 'Which location is this screen at?',
    loc770: "I'm at 770",
    locOhel: "I'm at Ohel",
    changeLocation: 'Change location',
    boardFor770: 'Buses heading to 770',
    boardForOhel: 'Buses heading to Ohel',
    empty: 'No buses currently en route',
    driverWord: 'Driver',
    arrivalWord: 'Expected arrival',
  },
} as const;

export default function BoardView() {
  const [lang, setLang] = useState<'he' | 'en'>('he');
  const tx = TXT[lang];

  const [code, setCode] = useState('');
  const [viewer, setViewer] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [boardLocation, setBoardLocation] = useState<DepartureLocation | null>(null);
  const [activeLocations, setActiveLocations] = useState<ActiveLocation[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Pull the latest users/scans so code lookup + the board work even on a cold page load.
  useEffect(() => { dbService.fetchDataFromSheets(); }, []);

  // Live-updating clock in the corner.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time subscription — refresh the board on every Firestore change.
  useEffect(() => {
    if (!viewer || !boardLocation) return;
    const refresh = () => setActiveLocations(dbService.getActiveLocations());
    refresh();
    const unsubscribe = dbService.subscribe(refresh);
    return unsubscribe;
  }, [viewer, boardLocation]);

  const verifyCode = () => {
    const u = dbService.loginWithCode(code.trim());
    if (!u) { setError(tx.codeNotFound); return; }
    if (u.role !== 'admin' && u.role !== 'dispatcher' && u.role !== 'screen') { setError(tx.codeNotAllowed); return; }
    setError('');
    setViewer(u);
  };

  const wantedDirection = boardLocation === '770' ? 'to_770' : 'to_ohel';
  const incomingBuses = useMemo(() => {
    return activeLocations
      .filter(loc => loc.status === 'en_route' && loc.direction === wantedDirection)
      .sort((a, b) => (a.etaMinutes ?? Infinity) - (b.etaMinutes ?? Infinity));
  }, [activeLocations, wantedDirection]);

  const clockStr = now.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York',
  });

  const langToggle = (
    <button
      onClick={() => setLang(l => (l === 'he' ? 'en' : 'he'))}
      className="btn btn-secondary"
      style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', padding: '8px 14px', fontSize: '12px', color: '#fff' }}
    >
      {lang === 'he' ? 'English' : 'עברית'}
    </button>
  );

  // --- Step 1: access code ---
  if (!viewer) {
    return (
      <div dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', background: 'var(--bg-primary)' }}>
        {langToggle}
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '28px', textAlign: 'center' }}>
          <img src={logo} alt="Ohel" style={{ height: '54px', margin: '0 auto 14px', display: 'block' }} />
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>{tx.title}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 22px' }}>{tx.subtitle}</p>

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

          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '14px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  // --- Step 2: which physical location is this screen at ---
  if (!boardLocation) {
    return (
      <div dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', background: 'var(--bg-primary)' }}>
        {langToggle}
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '28px', textAlign: 'center' }}>
          <img src={logo} alt="Ohel" style={{ height: '54px', margin: '0 auto 14px', display: 'block' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 22px' }}>{tx.locationPrompt}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => setBoardLocation('770')} className="btn btn-primary" style={btnStyle}>{tx.loc770}</button>
            <button onClick={() => setBoardLocation('Ohel')} className="btn btn-primary" style={btnStyle}>{tx.locOhel}</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 3: the live board itself ---
  const boardTitle = boardLocation === '770' ? tx.boardFor770 : tx.boardForOhel;
  const accentColor = boardLocation === '770' ? 'var(--accent-route-770)' : 'var(--accent-route-ohel)';

  return (
    <div dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 40px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <img src={logo} alt="Ohel" style={{ height: '56px' }} />
          <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
            <div style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{boardTitle}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {tx.title}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            fontFamily: "'SF Mono', 'Roboto Mono', ui-monospace, 'Courier New', monospace",
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px',
          }}>
            {clockStr}
          </div>
          <button onClick={() => setLang(l => (l === 'he' ? 'en' : 'he'))} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', color: '#fff' }}>
            {lang === 'he' ? 'English' : 'עברית'}
          </button>
          <button onClick={() => setBoardLocation(null)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', color: '#fff' }}>
            {tx.changeLocation}
          </button>
        </div>
      </div>

      {/* Board rows */}
      <div style={{ flex: 1, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
        {incomingBuses.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center',
          }}>
            {tx.empty}
          </div>
        ) : (
          incomingBuses.map(bus => (
            <div
              key={bus.id}
              className="fade-in"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-panel)', border: `1px solid var(--border-color)`,
                borderInlineStart: `6px solid ${accentColor}`,
                borderRadius: '16px', padding: '24px 32px',
              }}
            >
              <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tx.driverWord}</div>
                <div style={{ fontSize: 'clamp(26px, 3.2vw, 44px)', fontWeight: 800, color: '#fff' }}>
                  {bus.name.replace(' (נהג)', '')}
                </div>
              </div>
              <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{tx.arrivalWord}</div>
                <div style={{
                  fontFamily: "'SF Mono', 'Roboto Mono', ui-monospace, 'Courier New', monospace",
                  fontSize: 'clamp(40px, 5.5vw, 76px)', fontWeight: 800, color: accentColor, lineHeight: 1,
                }}>
                  {bus.expectedArrivalTime || '—'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: '10px', border: '1px solid var(--border-color)',
  background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '16px', textAlign: 'center', boxSizing: 'border-box',
};
const btnStyle: CSSProperties = { width: '100%', padding: '13px', fontSize: '15px', fontWeight: 700 };
