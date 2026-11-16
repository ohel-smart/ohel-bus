import { useId } from 'react';
import { createPortal } from 'react-dom';
import './BusApprovalAnimation.css';

export type CompletedStage = 'passengers' | 'driver' | 'data' | 'location';
export type ApprovalStage = CompletedStage | 'pending' | 'approval' | 'success' | 'error';
interface Props {
  visible: boolean;
  stage: ApprovalStage;
  completed?: readonly CompletedStage[];
  language?: 'he' | 'en';
  errorMessage?: string;
  onDismiss?: () => void;
}
const copy = {
  he: {
    pending: ['מעבד את נתוני הנסיעה...', 'ממתין לאישור המערכת'],
    passengers: ['טוען את מספר הנוסעים...', 'קבלת נתוני הנסיעה'],
    driver: ['מאמת את פרטי הנהג...', 'בדיקת הנהג המשויך לנסיעה'],
    data: ['מסנכרן את נתוני הנסיעה...', 'שמירת הנתונים במערכת'],
    location: ['מאמת את נתוני המיקום...', 'בדיקת נתוני GPS'],
    approval: ['מאשר את יציאת האוטובוס...', 'משלים את תהליך הרישום'],
    success: ['האוטובוס אושר ליציאה!', 'נסיעה טובה ובטוחה'],
    error: ['לא ניתן לאשר את היציאה', 'יש לבדוק את הנתונים ולנסות שוב'],
    labels: ['נוסעים', 'נהג', 'נתונים', 'מיקום'], close: 'חזרה למערכת',
  },
  en: {
    pending: ['Processing trip data...', 'Waiting for system approval'],
    passengers: ['Loading passengers...', 'Retrieving passenger information'],
    driver: ['Verifying driver...', 'Checking assigned driver'],
    data: ['Synchronizing trip data...', 'Saving trip information'],
    location: ['Verifying location...', 'Checking GPS information'],
    approval: ['Approving departure...', 'Completing trip registration'],
    success: ['Bus approved for departure!', 'Have a safe journey'],
    error: ['Departure could not be approved', 'Please check the information and try again'],
    labels: ['Passengers', 'Driver', 'Trip data', 'Location'], close: 'Back to system',
  },
};
const nodes = [
  { key:'passengers', icon:'people', x:47, y:49, path:'M47 49 Q100 49 160 135' },
  { key:'driver', icon:'driver', x:273, y:49, path:'M273 49 Q220 49 160 135' },
  { key:'data', icon:'data', x:47, y:221, path:'M47 221 Q100 221 160 135' },
  { key:'location', icon:'pin', x:273, y:221, path:'M273 221 Q220 221 160 135' },
] as const;

// Presentation only. The existing departure handler owns state, requests and timing.
export default function BusApprovalAnimation({visible, stage, completed = [], language = 'he', errorMessage, onDismiss}: Props) {
  const uid = `obs-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const id = (s: string) => `${uid}-${s}`;
  const ref = (s: string) => `#${id(s)}`;
  const url = (s: string) => `url(${ref(s)})`;
  if (!visible || typeof document === 'undefined') return null;
  const t = copy[language];
  const success = stage === 'success', error = stage === 'error', finished = success || error;
  return createPortal(
    <div className={`obs-overlay ${success ? 'is-success' : ''} ${error ? 'is-error' : ''}`} dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className="obs-content">
        <div className="obs-brand">OHEL SMART</div>
        <div className="obs-graphic">
          <svg viewBox="0 0 320 280" fill="none" aria-hidden="true">
            <defs>
              <mask id={id('beamMask')} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="280"><rect width="320" height="280" fill="#fff"/><circle cx="160" cy="135" r="48" fill="#000"/></mask>
              <filter id={id('lift')} x="-30%" y="-30%" width="160%" height="175%"><feDropShadow dx="0" dy="6" stdDeviation="9" floodColor="#000" floodOpacity=".45"/></filter>
              <linearGradient id={id('sheen')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".12"/><stop offset=".5" stopColor="#fff" stopOpacity=".045"/><stop offset="1" stopColor="#fff" stopOpacity=".02"/></linearGradient>
              <linearGradient id={id('sheenBlue')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4C7CE8" stopOpacity=".46"/><stop offset=".5" stopColor="#2A4FB5" stopOpacity=".42"/><stop offset="1" stopColor="#14286B" stopOpacity=".55"/></linearGradient>
              <linearGradient id={id('sheenGold')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FFDFA0" stopOpacity=".22"/><stop offset=".5" stopColor="#E7B453" stopOpacity=".08"/><stop offset="1" stopColor="#E7B453" stopOpacity=".04"/></linearGradient>
              <linearGradient id={id('sheenGreen')} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#79FFC0" stopOpacity=".34"/><stop offset=".5" stopColor="#49E79E" stopOpacity=".12"/><stop offset="1" stopColor="#1A633F" stopOpacity=".10"/></linearGradient>
              <linearGradient id={id('sweep')} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#fff" stopOpacity="0"/><stop offset=".5" stopColor="#fff" stopOpacity=".34"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
              <linearGradient id={id('gold')} x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#FFDFA0"/><stop offset=".5" stopColor="#E7B453"/><stop offset="1" stopColor="#A47835"/></linearGradient>
              <radialGradient id={id('glow')}><stop stopColor="#E7B453" stopOpacity=".15"/><stop offset="1" stopColor="#E7B453" stopOpacity="0"/></radialGradient>
              <radialGradient id={id('green')}><stop stopColor="#1A633F"/><stop offset="1" stopColor="#10291E"/></radialGradient>
              <g id={id('bus')} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="-19" y="-24" width="38" height="46" rx="9"/><rect x="-13" y="-16" width="26" height="18" rx="3"/><path d="M0 -16 V2 M-12 12 H-7 M7 12 H12 M-11 22 V27 M11 22 V27"/></g>
              <g id={id('people')} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="-5" cy="-6" r="5"/><path d="M-15 12 V7 Q-15 0 -5 0 Q5 0 5 7 V12 M7 -11 A5 5 0 0 1 7 -1 M10 2 Q16 4 16 12"/></g>
              <g id={id('driver')} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><circle cy="-7" r="6"/><path d="M-13 12 V7 Q-13 0 0 0 Q13 0 13 7 V12 M-5 2 L0 9 L5 2"/></g>
              <g id={id('data')} stroke="currentColor" strokeWidth="1.7"><ellipse cy="-10" rx="12" ry="5"/><path d="M-12 -10 V10 C-12 17 12 17 12 10 V-10 M-12 -3 C-12 4 12 4 12 -3 M-12 4 C-12 11 12 11 12 4"/></g>
              <g id={id('pin')} stroke="currentColor" strokeWidth="1.7"><path d="M0 16 S-12 2 -12 -6 A12 12 0 1 1 12 -6 C12 2 0 16 0 16 Z"/><circle cy="-6" r="4"/></g>
              <g id={id('check')}><circle r="9" fill="#23A96C" stroke="#121517" strokeWidth="2"/><path d="M-4 0 L-1 3 L4 -3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></g>
            </defs>
            <g className={`obs-loading ${finished ? 'obs-loading-hidden' : ''}`}>
              <circle cx="160" cy="135" r="125" fill={url('glow')}/>
              <circle cx="160" cy="135" r="78" stroke="#BC9555" strokeOpacity=".3" strokeDasharray="2 7"/>
              {nodes.map((n,i) => <g key={n.key} mask={url('beamMask')}><path d={n.path} stroke={completed.includes(n.key) ? '#244C9E' : '#8E713D'} strokeOpacity=".47" strokeWidth="1.3"/><path d={n.path} stroke={completed.includes(n.key) ? '#5C8DF0' : '#EEBC5D'} strokeWidth="2.2" strokeLinecap="round" className="obs-beam" style={{animationDelay:`${i * -.25}s`}}/></g>)}
              <circle cx="160" cy="135" r="62" stroke="#BD9553" strokeOpacity=".22" strokeWidth="3"/>
              <circle className="obs-ring" cx="160" cy="135" r="62" stroke={url('gold')} strokeWidth="4" strokeLinecap="round" strokeDasharray="110 280"/>
              <circle className="obs-ring-secondary" cx="160" cy="135" r="72" stroke="#DCB269" strokeOpacity=".53" strokeDasharray="18 435" strokeWidth="1.5"/>
              <circle cx="160" cy="135" r="48" fill="#000" fillOpacity=".2" filter={url('lift')}/>
              <circle cx="160" cy="135" r="48" fill="#0B0C10" fillOpacity=".42"/>
              <circle cx="160" cy="135" r="48" fill={url('sheen')} stroke="#E7B453" strokeOpacity=".5"/>
              <path d="M126.1 101.1 A48 48 0 0 1 193.9 101.1" stroke="#fff" strokeOpacity=".55" strokeLinecap="round"/>
              <use href={ref('bus')} x="160" y="135" color="#F0C875" className="obs-bus-icon"/>
              {nodes.map((n,i) => {
                const done = completed.includes(n.key), active = stage === n.key;
                const x0 = n.x - 25, y0 = n.y - 25;
                return <g key={n.key} className="obs-node" style={{animationDelay:`${90 + i * 70}ms`}}>
                  <defs><clipPath id={id(`clip-${n.key}`)}><rect x={x0} y={y0} width="50" height="50" rx="15"/></clipPath></defs>
                  {active && <rect x={n.x-28} y={n.y-28} width="56" height="56" rx="18" stroke="#E7B453" className="obs-node-pulse"/>}
                  <rect x={x0} y={y0} width="50" height="50" rx="15" fill="#000" fillOpacity=".18" filter={url('lift')}/>
                  <rect x={x0} y={y0} width="50" height="50" rx="15" fill="#0B0C10" fillOpacity=".34"/>
                  <rect x={x0} y={y0} width="50" height="50" rx="15" fill={url('sheen')} stroke="#fff" strokeOpacity=".2"/>
                  <rect x={x0} y={y0} width="50" height="50" rx="15" fill={url('sheenGold')} stroke="#E7B453" strokeOpacity=".8" className="obs-node-tint" style={{opacity: active && !done ? 1 : 0}}/>
                  <rect x={x0} y={y0} width="50" height="50" rx="15" fill={url('sheenBlue')} stroke="#3A6BD8" strokeOpacity=".95" className="obs-node-tint" style={{opacity: done ? 1 : 0}}/>
                  <path d={`M${x0 + 15} ${y0 + .75} H${x0 + 35}`} stroke={done ? '#B9CCF5' : '#fff'} strokeOpacity={done ? .8 : .55} strokeLinecap="round"/>
                  <g clipPath={url(`clip-${n.key}`)}><g transform={`rotate(18 ${n.x} ${n.y})`}><rect x={x0 - 44} y={y0 - 20} width="16" height="90" fill={url('sweep')} className="obs-sweep" style={{animationDelay:`${i * .55}s`}}/></g></g>
                  <use href={ref(n.icon)} x={n.x} y={n.y} color={done ? '#9DBBF7' : '#E3BC75'}/>
                  <text x={n.x} y={n.y+43} textAnchor="middle" fontSize="11" fill="#fff" fillOpacity=".78">{t.labels[i]}</text>
                  {done && <g className="obs-small-check"><use href={ref('check')} x={n.x+22} y={n.y-21}/></g>}
                </g>;
              })}
            </g>
            {success && <g className="obs-success-graphic"><circle cx="160" cy="135" r="88" fill="#43D892" fillOpacity=".025" stroke="#43D892" strokeOpacity=".15"/><circle cx="160" cy="135" r="73" stroke="#43D892" strokeOpacity=".22"/><circle className="obs-success-pulse" cx="160" cy="135" r="57" stroke="#49E79E"/><circle className="obs-success-circle" cx="160" cy="135" r="57" fill={url('green')} fillOpacity=".55" stroke="#49E79E" strokeWidth="2"/><circle cx="160" cy="135" r="57" fill={url('sheenGreen')}/><path d="M119.7 94.7 A57 57 0 0 1 200.3 94.7" stroke="#fff" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round"/><path className="obs-success-check" d="M135 135 L153 153 L186 118" stroke="#79FFC0" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"/></g>}
            {error && <g className="obs-success-graphic"><circle cx="160" cy="135" r="73" stroke="#F87171" strokeOpacity=".22"/><circle cx="160" cy="135" r="57" fill="#321B20" stroke="#F87171" strokeWidth="2"/><path d="M142 117 L178 153 M178 117 L142 153" stroke="#FCA5A5" strokeWidth="5" strokeLinecap="round"/></g>}
          </svg>
        </div>
        <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} aria-atomic="true" className="obs-announcement">
          <div key={stage} className="obs-status-copy"><h2 className="obs-title">{t[stage][0]}</h2><p className="obs-subtitle">{error && errorMessage ? errorMessage : t[stage][1]}</p></div>
        </div>
        {!finished && <div className="obs-progress" aria-hidden="true"><div className="obs-progress-bar"/></div>}
        {error && onDismiss && <button type="button" className="obs-dismiss" onClick={onDismiss}>{t.close}</button>}
      </div>
    </div>, document.body
  );
}
