// Admin-only "Analytics" tab, loaded lazily from App.tsx so drivers and dispatchers
// never download it. All the maths lives in services/analytics.ts and is recomputed
// from the live scans list on every render, so the numbers follow every new scan
// without any refresh. Charts are hand-made glass bars (no chart library).
// It always looks at the last 90 logical days and only ever shows averages:
//   - Sunday to Thursday are averaged together (the headline numbers),
//   - Friday and Saturday each get their own average, over all the Fridays / Saturdays.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import type { Scan } from './services/db';
import { buildAnalytics, windowSummary, weekdayAverages, dowOf, DEFAULT_RULES, type AnalyticsRules, type DayStat, type HourAvg, type WeekdayAvg } from './services/analytics';
import TrendChart from './TrendChart';
import { HEBREW_MONTH_OPTIONS } from './services/hebrewDate';
import { prevDay } from './services/nyTime';

interface Props {
  scans: Scan[];
  lang: 'he' | 'en';
  todayLogical: string;
  parse: (scannedAt: string, logicalDate: string) => Date;
  rules: AnalyticsRules | undefined;
  onRulesChange: (rules: AnalyticsRules) => void;
}

const WINDOW_DAYS = 90;
const BAR_H = 96;
const GOLD_RGB = '226, 176, 78';
const TEAL_RGB = '6, 182, 212';

// The "dark glass with a coloured glow" look: near-black glass, a soft colour
// rising from the bottom corner, a hairline border and a bright thin line along
// the top edge. Used for the cards, the tiles and the chart bars themselves.
const glassBg = (rgb: string, strength = 0.42) =>
  `radial-gradient(75% 110% at 0% 100%, rgba(${rgb}, ${strength}), rgba(${rgb}, 0) 70%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.3))`;
const topEdge: CSSProperties = {
  position: 'absolute', top: 0, left: '18px', right: '18px', height: '1px', pointerEvents: 'none',
  background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75) 25%, rgba(255,255,255,0.75) 75%, rgba(255,255,255,0))',
};
// A bar is a small pane of that same glass: dark base, strong colour glow from the
// bottom, a bright top edge, and a hairline border.
const glassBar = (rgb: string): CSSProperties => ({
  background: `radial-gradient(130% 100% at 0% 100%, rgba(${rgb}, 0.95), rgba(${rgb}, 0.25) 75%), linear-gradient(180deg, rgba(255,255,255,0.16), rgba(0,0,0,0.38))`,
  border: '1px solid rgba(255,255,255,0.24)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), 0 4px 12px rgba(0,0,0,0.45)',
});

const num = (n: number) => Math.round(n).toLocaleString('en-US');
// Two parts of one total, rounded so that the rounded parts add up to the rounded total
// (156.67 + 141.67 = 298.33 shows as 157 + 141 = 298, never 157 + 142 = 299). The part with the
// larger fraction takes the missing unit.
function splitRound(a: number, b: number): [number, number] {
  const target = Math.round(a + b);
  let ra = Math.floor(a), rb = Math.floor(b);
  const aFirst = a - ra >= b - rb;
  for (let missing = target - ra - rb; missing > 0; missing--) {
    if (aFirst === (missing % 2 === 1)) ra++; else rb++;
  }
  return [ra, rb];
}
// The busiest hour of each direction (they are usually not the same hour).
function peaksByPlace(hours: HourAvg[]): { p770: HourAvg | null; pOhel: HourAvg | null } {
  const best = (f: (h: HourAvg) => number) => hours.reduce<HourAvg | null>((b, h) => (f(h) > 0 && (!b || f(h) > f(b)) ? h : b), null);
  return { p770: best(h => h.p770), pOhel: best(h => h.pOhel) };
}
const pctNum = (x: number | null) => (x == null ? '—' : String(Math.round(x * 100)));
const pctText = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const muted: CSSProperties = { color: 'var(--text-secondary)', fontSize: '12px' };
const cardStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' };

// The big cards are plain dark glass: no coloured glow and no bright top line
// (those are kept for the small tiles).
function GlassCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.3))', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '22px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', ...style,
      }}
    >
      {children}
    </div>
  );
}

const isSunToThu = (d: DayStat) => dowOf(d.date) <= 4 && (d.type === 'weekday' || d.type === 'sunday');

export default function Analytics({ scans, lang, todayLogical, parse, rules, onRulesChange }: Props) {
  const he = lang === 'he';
  const activeRules = rules ?? DEFAULT_RULES;
  const [showSettings, setShowSettings] = useState(false);
  const [ceilingText, setCeilingText] = useState(activeRules.maxPaxPerDay ? String(activeRules.maxPaxPerDay) : '');

  const report = useMemo(
    () => buildAnalytics(scans, { todayLogical, parse, rules: activeRules }),
    [scans, todayLogical, parse, activeRules]
  );

  const fromYmd = useMemo(() => {
    let d = todayLogical;
    for (let i = 0; i < WINDOW_DAYS; i++) d = prevDay(d);
    return d;
  }, [todayLogical]);

  const main = useMemo(() => windowSummary(report.allDays, fromYmd, isSunToThu), [report, fromYmd]);
  const weekdays = useMemo(() => weekdayAverages(report.allDays, fromYmd), [report, fromYmd]);
  // The day whose hour-by-hour chart is open under the seven tiles (default: the busiest day).
  const [pickedDow, setPickedDow] = useState<number | null>(null);
  // Tap a day to open its details, tap the same day again to close them.
  const selected = weekdays.find(w => w.dow === pickedDow && w.days > 0) ?? null;
  const [showGeneral, setShowGeneral] = useState(false);
  const selPeople = selected ? splitRound(selected.hours.reduce((a, h) => a + h.p770, 0), selected.hours.reduce((a, h) => a + h.pOhel, 0)) : [0, 0];
  const selTrips = selected ? splitRound(selected.avgTrips770, selected.avgTripsOhel) : [0, 0];

  const mainNormal = main.period.days - main.period.special;
  const mainPeaks = useMemo(() => peaksByPlace(main.hours), [main]);
  const tot770 = main.hours.reduce((a, h) => a + h.p770, 0);
  const totOhel = main.hours.reduce((a, h) => a + h.pOhel, 0);
  const trips770 = main.hours.reduce((a, h) => a + h.t770, 0);
  const tripsOhel = main.hours.reduce((a, h) => a + h.tOhel, 0);
  const [people770Shown, peopleOhelShown] = splitRound(tot770, totOhel);
  const [trips770Shown, tripsOhelShown] = splitRound(trips770, tripsOhel);

  const toggleMonth = (key: string) => {
    const has = activeRules.excludeHebMonths.includes(key);
    onRulesChange({ ...activeRules, excludeHebMonths: has ? activeRules.excludeHebMonths.filter(m => m !== key) : [...activeRules.excludeHebMonths, key] });
  };
  // The ceiling is applied only after the manager confirms it, and the screen then says it worked.
  const ceilingNum = Number(ceilingText);
  const ceilingTyped: number | null | undefined = ceilingText === '' ? null : Number.isFinite(ceilingNum) && ceilingNum >= 50 ? Math.round(ceilingNum) : undefined;
  const ceilingChanged = ceilingTyped !== undefined && ceilingTyped !== activeRules.maxPaxPerDay;
  const [ceilingDone, setCeilingDone] = useState<number | null | 'none'>('none');
  useEffect(() => {
    if (ceilingDone === 'none') return;
    const timer = setTimeout(() => setCeilingDone('none'), 5000);
    return () => clearTimeout(timer);
  }, [ceilingDone]);
  const confirmCeiling = () => {
    if (!ceilingChanged || ceilingTyped === undefined) return;
    onRulesChange({ ...activeRules, maxPaxPerDay: ceilingTyped });
    setCeilingDone(ceilingTyped);
  };

  const r = report.reconcile;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <GlassCard style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{he ? 'אנליטיקה' : 'Analytics'}</h2>
            <p style={muted}>{he ? 'ממוצעים בלבד, מתעדכנים אוטומטית עם כל סריקה חדשה.' : 'Averages only, updated automatically with every new scan.'}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(v => !v)}
            aria-expanded={showSettings}
            className={`btn ${showSettings ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 12px', fontSize: '12px', flexShrink: 0, color: showSettings ? '#000' : '#fff' }}
          >
            <Settings size={14} />
            <span>{he ? 'הגדרות הסטטיסטיקה' : 'Statistics settings'}</span>
          </button>
        </div>

        {showSettings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
            <p style={muted}>{he ? 'נשמרים במערכת, ולכן זהים בטלפון ובמחשב. כל שינוי מחשב הכול מחדש מיד.' : 'Saved in the system, so identical on phone and computer. Any change recalculates everything at once.'}</p>
            <div>
              <span style={{ ...muted, color: '#fff' }}>{he ? 'חודשים שלא נכנסים לחישוב' : 'Months left out of the calculation'}</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {HEBREW_MONTH_OPTIONS.filter(m => m.key !== 'Adar I' && m.key !== 'Adar II').map(m => {
                  const on = activeRules.excludeHebMonths.includes(m.key);
                  return (
                    <button key={m.key} type="button" onClick={() => toggleMonth(m.key)} aria-pressed={on}
                      className={`btn ${on ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '5px 12px', fontSize: '12px', color: on ? '#000' : '#fff' }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="analytics-ceiling" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ ...muted, color: '#fff' }}>{he ? 'תקרה ליום: יום עם יותר נוסעים מזה לא נכנס לחישוב' : 'Daily ceiling: a day with more people than this is left out'}</span>
                <input
                  id="analytics-ceiling"
                  value={ceilingText}
                  onChange={e => { setCeilingText(e.target.value.replace(/[^0-9]/g, '')); setCeilingDone('none'); }}
                  onKeyDown={e => { if (e.key === 'Enter') confirmCeiling(); }}
                  inputMode="numeric"
                  placeholder="700"
                  style={{ width: '90px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: '#fff', textAlign: 'center', fontSize: '14px' }}
                />
                <button type="button" onClick={confirmCeiling} disabled={!ceilingChanged} className={`btn ${ceilingChanged ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '7px 16px', fontSize: '13px', color: ceilingChanged ? '#000' : 'rgba(255,255,255,0.4)', opacity: ceilingChanged ? 1 : 0.7 }}>
                  {he ? 'אישור' : 'Confirm'}
                </button>
              </label>
              {ceilingChanged && <span style={{ ...muted, color: 'var(--accent)' }}>{he ? 'עוד לא נשמר. לחץ אישור כדי לעדכן את החישוב.' : 'Not saved yet. Press Confirm to update the calculation.'}</span>}
              {ceilingTyped === undefined && <span style={{ ...muted, color: '#fb7185' }}>{he ? 'התקרה צריכה להיות 50 לפחות (או ריקה, בלי תקרה).' : 'The ceiling must be at least 50 (or empty for none).'}</span>}
              {ceilingDone !== 'none' && !ceilingChanged && (
                <span style={{ ...muted, color: '#34d399', fontWeight: 700 }}>
                  ✓ {ceilingDone === null ? (he ? 'התקרה בוטלה והחישוב עודכן.' : 'Ceiling removed, calculation updated.') : (he ? `התקרה עודכנה ל-${ceilingDone} והחישוב עודכן.` : `Ceiling set to ${ceilingDone}, calculation updated.`)}
                </span>
              )}
            </div>
            <p style={{ ...muted, fontSize: '11px' }}>
              {he
                ? `התאמה: ${r.validRides} נסיעות תקינות · ${r.countedRides} נכללו · ${r.excludedRides} הוצאו לפי הכללים (${r.excludedMonthDays} ימי חודש שהוצא, ${r.excludedCeilingDays} ימים מעל התקרה)${r.skippedToday ? ` · ${r.skippedToday} מהיום עד שייגמר` : ''}${r.skippedBadDate ? ` · ${r.skippedBadDate} עם תאריך לא תקין` : ''}.`
                : `Reconciliation: ${r.validRides} valid rides · ${r.countedRides} counted · ${r.excludedRides} left out by the rules (${r.excludedMonthDays} days in excluded months, ${r.excludedCeilingDays} over the ceiling)${r.skippedToday ? ` · ${r.skippedToday} from today until it ends` : ''}${r.skippedBadDate ? ` · ${r.skippedBadDate} with a bad date` : ''}.`}
            </p>
          </div>
        )}
      </GlassCard>

      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '4px 4px -8px' }}>{he ? 'מגמה יום אחרי יום' : 'Day-by-day trend'}</h3>
      <GlassCard style={{ padding: '16px 12px 14px' }}>
        <TrendChart days={report.allDays} lang={lang} />
      </GlassCard>

      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '4px 4px -8px' }}>{he ? 'ראשון עד חמישי' : 'Sunday to Thursday'}</h3>
      {mainNormal === 0 ? (
        <GlassCard style={{ ...muted, textAlign: 'center', padding: '28px' }}>{he ? 'אין עדיין ימים מלאים של ראשון עד חמישי.' : 'No full Sunday to Thursday days yet.'}</GlassCard>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', alignItems: 'stretch' }}>
            <Tile
              label={he ? 'עומס (מילוי הנסיעות)' : 'Load (seats filled)'}
              splitLabel={he ? 'עומס לפי מקום' : 'load by place'}
              value={main.period.load == null ? '—' : `${Math.round(main.period.load * 100)}%`}
              rgb="6, 182, 212"
              detail={[{ label: he ? 'מ-770' : 'from 770', value: pctText(main.period.load770) }, { label: he ? 'מהאוהל' : 'from Ohel', value: pctText(main.period.loadOhel) }]}
            />
            <Tile label={he ? 'ממוצע יומי (נוסעים)' : 'Daily average (people)'} splitLabel={he ? 'נוסעים לפי מקום' : 'people by place'} value={num(main.period.avgPerDay)} rgb="139, 92, 246" detail={[{ label: he ? 'מ-770' : 'from 770', value: String(people770Shown) }, { label: he ? 'מהאוהל' : 'from Ohel', value: String(peopleOhelShown) }]} />
            <Tile label={he ? 'ממוצע יומי (סה״כ נסיעות)' : 'Daily average (total trips)'} splitLabel={he ? 'נסיעות לפי מקום' : 'trips by place'} value={num(main.period.avgTripsPerDay)} rgb="16, 185, 129" detail={[{ label: he ? 'נסיעות מ-770' : 'trips from 770', value: String(trips770Shown) }, { label: he ? 'נסיעות מהאוהל' : 'trips from Ohel', value: String(tripsOhelShown) }]} />
            <Tile
              label={he ? 'שעת השיא הממוצעת' : 'Average peak hour'}
              value="—"
              rgb="226, 176, 78"
              always
              detail={[
                { label: he ? 'מ-770' : 'from 770', value: mainPeaks.p770 ? hh(mainPeaks.p770.hour) : '—', sub: mainPeaks.p770 ? (he ? `${num(mainPeaks.p770.p770)} נוסעים` : `${num(mainPeaks.p770.p770)} people`) : undefined },
                { label: he ? 'מהאוהל' : 'from Ohel', value: mainPeaks.pOhel ? hh(mainPeaks.pOhel.hour) : '—', sub: mainPeaks.pOhel ? (he ? `${num(mainPeaks.pOhel.pOhel)} נוסעים` : `${num(mainPeaks.pOhel.pOhel)} people`) : undefined },
              ]}
            />
          </div>

        </>
      )}

      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '4px 4px -8px' }}>{he ? 'ממוצע לכל יום בשבוע' : 'Average for each day of the week'}</h3>
      <GlassCard style={{ ...cardStyle, padding: '18px 8px' }}>
        <p style={{ ...muted, padding: '0 10px' }}>{he ? 'כל המספרים הם ממוצע ליום, מכל הימים מאותו יום בשבוע (כל ימי השישי, כל ימי הראשון...). לחיצה על יום פותחת אותו לפי שעות.' : 'Each day is averaged over all days of that kind (all Fridays, all Sundays...). Tap a day to see it by hour.'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '3px' }}>
          {weekdays.map(w => <DayTile key={w.dow} w={w} lang={lang} active={selected?.dow === w.dow} onPick={() => setPickedDow(cur => (cur === w.dow ? null : w.dow))} />)}
        </div>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              {dayName(selected.dow, lang, true)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SplitStat title={he ? 'אנשים' : 'People'} a={String(selPeople[0])} b={String(selPeople[1])} he={he} />
              <SplitStat title={he ? 'נסיעות' : 'Trips'} a={String(selTrips[0])} b={String(selTrips[1])} he={he} />
              <SplitStat title={he ? 'עומס' : 'Load'} a={pctText(selected.load770)} b={pctText(selected.loadOhel)} he={he} />
            </div>
            <DirectionCharts hours={selected.hours} he={he} />
          </div>
        )}
      </GlassCard>

      {main.hours.length > 0 && (
        <GlassCard style={cardStyle}>
          <button
            type="button"
            onClick={() => setShowGeneral(v => !v)}
            aria-expanded={showGeneral}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{he ? 'ממוצע כללי לפי שעות' : 'General average by hour'}</h3>
            <span aria-hidden="true" style={{ color: 'var(--text-secondary)', fontSize: '13px', transform: showGeneral ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▾</span>
          </button>
          {showGeneral && <DirectionCharts hours={main.hours} he={he} />}
        </GlassCard>
      )}
    </div>
  );
}

// A headline tile. When it has `detail`, tapping it swaps the big number for the split
// (for example from 770 / from Ohel) in the same spot, and tapping again brings the total back.
function Tile({ label, splitLabel, value, rgb, detail, always }: { label: string; splitLabel?: string; value: string; rgb: string; detail?: { label: string; value: string; sub?: string }[]; always?: boolean }) {
  const [tapped, setTapped] = useState(false);
  const split = !!detail && (always || tapped);
  const body = (
    <>
      <span aria-hidden="true" style={topEdge} />
      <span style={{ minHeight: '46px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: split ? 'space-evenly' : 'center' }}>
        {split && detail
          ? detail.flatMap((d, i) => [
              i > 0 ? <span key={`div${i}`} aria-hidden="true" style={{ width: '1px', alignSelf: 'stretch', margin: '2px 0', background: 'rgba(255,255,255,0.14)' }} /> : null,
              <span key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, gap: '2px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.66)' }}>{d.label}</span>
                <b style={{ fontSize: '22px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{d.value}</b>
                {d.sub && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.66)' }}>{d.sub}</span>}
              </span>,
            ])
          : <strong style={{ fontSize: '28px', color: '#fff', lineHeight: 1.1 }}>{value}</strong>}
      </span>
      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.25, marginTop: '6px' }}>
        {split ? (splitLabel ?? label) : label}{detail && !always ? ' ▾' : ''}
      </span>
    </>
  );
  const style: CSSProperties = {
    position: 'relative', padding: '14px 4px', textAlign: 'center', borderRadius: '20px', minWidth: 0, minHeight: '112px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: glassBg(rgb, 0.5), border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
  };
  if (!detail || always) return <div className="card" style={style}>{body}</div>;
  return (
    <button type="button" onClick={() => setTapped(v => !v)} aria-pressed={tapped} className="card" style={{ ...style, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
      {body}
    </button>
  );
}

// A wide strip with the two directions far apart and a line between them. Used for the
// selected day, where there is room (the seven day tiles are too narrow for this).
function SplitStat({ title, a, b, he }: { title: string; a: string; b: string; he: boolean }) {
  const col = (label: string, value: string) => (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', lineHeight: 1.1 }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.66)' }}>{label}</span>
      <b style={{ fontSize: '26px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    </span>
  );
  return (
    <div style={{ position: 'relative', padding: '10px 12px 12px', borderRadius: '18px', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.25))', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', justifyItems: 'center' }}>
        {col(he ? 'מ-770' : 'from 770', a)}
        <span aria-hidden="true" style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.22)' }} />
        {col(he ? 'מהאוהל' : 'from Ohel', b)}
      </div>
    </div>
  );
}

// Three charts on the same hours: both directions combined, then 770 and Ohel on their
// own. The two direction charts share one scale so they can be compared by eye.
function DirectionCharts({ hours, he }: { hours: HourAvg[]; he: boolean }) {
  if (!hours.length) return null;
  const dirMax = Math.max(1, ...hours.map(h => Math.max(h.p770, h.pOhel)));
  const totalMax = Math.max(1, ...hours.map(h => h.pax));
  const peaks = peaksByPlace(hours);
  const totalPeak = hours.reduce<HourAvg | null>((b, h) => (h.pax > 0 && (!b || h.pax > b.pax) ? h : b), null);
  const sum770 = hours.reduce((a, h) => a + h.p770, 0), sumOhel = hours.reduce((a, h) => a + h.pOhel, 0);
  const [shown770, shownOhel] = splitRound(sum770, sumOhel);
  const parts: { key: string; title: string; rgb: string; total: number; rows: { hour: number; v: number }[]; max: number; peak?: number }[] = [
    { key: 'all', title: he ? 'סה״כ, שני הכיוונים יחד' : 'Total, both directions', rgb: '139, 92, 246', total: shown770 + shownOhel, rows: hours.map(h => ({ hour: h.hour, v: h.pax })), max: totalMax, peak: totalPeak?.hour },
    { key: '770', title: he ? 'מ-770 לאוהל' : '770 → Ohel', rgb: GOLD_RGB, total: shown770, rows: hours.map(h => ({ hour: h.hour, v: h.p770 })), max: dirMax, peak: peaks.p770?.hour },
    { key: 'ohel', title: he ? 'מהאוהל ל-770' : 'Ohel → 770', rgb: TEAL_RGB, total: shownOhel, rows: hours.map(h => ({ hour: h.hour, v: h.pOhel })), max: dirMax, peak: peaks.pOhel?.hour },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {parts.map(c => (
        <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#fff' }}>
              <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, ...glassBar(c.rgb) }} />
              {c.title}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {he ? 'סה״כ ביום' : 'Total a day'}: <b style={{ color: '#fff' }}>{num(c.total)}</b>
            </span>
          </div>
          <HourBars rows={c.rows} rgb={c.rgb} max={c.max} peak={c.peak} label={`${c.title}: ${he ? 'ממוצע נוסעים לפי שעה' : 'average people by hour'}`} />
        </div>
      ))}
    </div>
  );
}

function HourBars({ rows, rgb, max, peak, label }: { rows: { hour: number; v: number }[]; rgb: string; max: number; peak?: number; label: string }) {
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      {/* the chart sits on its own pane of glass */}
      <div style={{ position: 'relative', minWidth: `${rows.length * 18 + 24}px`, padding: '14px 12px 8px', borderRadius: '18px', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div
          dir="ltr"
          role="img"
          aria-label={label}
          style={{
            display: 'flex', alignItems: 'flex-end', gap: '4px', height: `${BAR_H + 18}px`,
            backgroundImage: 'repeating-linear-gradient(to top, rgba(255,255,255,0.07) 0 1px, transparent 1px 28px)',
          }}
        >
          {rows.map(r => {
            const h = Math.round((r.v / max) * BAR_H);
            const isPeak = r.hour === peak;
            return (
              <div
                key={r.hour}
                style={{
                  flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  borderRadius: '6px', outline: isPeak ? '1px solid rgba(226,176,78,0.9)' : 'none', outlineOffset: '2px',
                  boxShadow: isPeak ? '0 0 14px rgba(226,176,78,0.35)' : 'none',
                }}
              >
                <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 800, color: isPeak ? 'var(--accent)' : '#fff', paddingBottom: '2px', fontVariantNumeric: 'tabular-nums' }}>{r.v >= 0.5 ? num(r.v) : ''}</div>
                {h > 0 && <div style={{ height: `${h}px`, boxSizing: 'border-box', borderRadius: '6px 6px 2px 2px', ...glassBar(rgb) }} />}
              </div>
            );
          })}
        </div>
        <div dir="ltr" style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          {rows.map(r => <span key={r.hour} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '10px', color: 'var(--text-secondary)' }}>{r.hour}</span>)}
        </div>
      </div>
    </div>
  );
}

// Saturday is written as "מוצש" (the rides run after Shabbat ends), not "שבת".
const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצש'];
const DAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayName(dow: number, lang: 'he' | 'en', long = false): string {
  if (!long) return lang === 'he' ? DAY_NAMES_HE[dow] : DAY_SHORT_EN[dow];
  if (lang === 'he' && dow === 6) return DAY_NAMES_HE[6];
  // 2026-11-01 was a Sunday, so day 0..6 maps onto the 1st..7th of that month.
  return new Date(2026, 10, 1 + dow, 12).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { weekday: 'long' });
}

// One narrow tile per day of the week, seven in a row: the day, the average number
// of people, the average trips from 770 and from Ohel, and the average load.
function DayTile({ w, lang, active, onPick }: { w: WeekdayAvg; lang: 'he' | 'en'; active: boolean; onPick: () => void }) {
  const he = lang === 'he';
  const has = w.days > 0;
  const [split, setSplit] = useState(false);
  const [loadSplit, setLoadSplit] = useState(false);
  // Two values side by side with a line between them: 770 on one side, Ohel on the other.
  const pair = (a: string, b: string, unit = '') => {
    // `self` pushes a value outward, away from the line, using physical sides (the page
    // is right-to-left in Hebrew, so the first column is the right-hand one there).
    const col = (label: string, value: string, self: 'left' | 'right') => (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', lineHeight: 1, justifySelf: self }}>
        <span style={{ fontSize: 'clamp(8px, 9cqw, 13px)', color: 'rgba(255,255,255,0.66)', fontWeight: 400 }}>{label}</span>
        <span style={{ fontSize: 'clamp(11px, 14cqw, 24px)', fontWeight: 800 }}>{value}<small style={{ fontSize: 'clamp(7px, 8cqw, 13px)', fontWeight: 400 }}>{unit}</small></span>
      </span>
    );
    return (
      // two equal halves with the line exactly in the middle; each value sits at its own outer edge
      <span style={{ display: 'grid', gridTemplateColumns: '1fr clamp(1px, calc((100cqw - 80px) * 0.4), 96px) 1fr', alignItems: 'center', width: '100%', padding: '0 clamp(2px, 3cqw, 14px)', boxSizing: 'border-box' }}>
        {col('770', a, he ? 'right' : 'left')}
        {/* the middle track grows with the tile, so on a wide screen the line sits well apart from both values */}
        <span aria-hidden="true" style={{ width: '1px', justifySelf: 'center', height: 'clamp(28px, 26cqw, 52px)', background: 'rgba(255,255,255,0.28)' }} />
        {col(he ? 'אוהל' : 'Ohel', b, he ? 'left' : 'right')}
      </span>
    );
  };
  // Every number sits under its own small label. Metrics are separated by a hairline
  // and the labels have a fixed two-line height, so the numbers line up across tiles.
  const metric = (label: string, value: ReactNode, opts: { big?: boolean; first?: boolean; slot?: number } = {}) => (
    <span
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', width: '100%',
        paddingTop: opts.first ? 0 : '7px', borderTop: opts.first ? 'none' : '1px solid rgba(255,255,255,0.09)',
      }}
    >
      <span style={{ fontSize: 'clamp(9.5px, 8cqw, 13px)', color: 'rgba(255,255,255,0.66)', lineHeight: 1.15, minHeight: '2.3em', display: 'flex', alignItems: 'center', textAlign: 'center', letterSpacing: '0.01em' }}>{label}</span>
      <b style={{ fontSize: opts.big ? 'clamp(19px, 17cqw, 34px)' : 'clamp(14px, 12cqw, 24px)', lineHeight: 1, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minHeight: opts.slot ? `clamp(${opts.slot}px, 28cqw, 56px)` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{value}</b>
    </span>
  );
  const loadPill = (
    <span style={{ fontSize: 'clamp(12px, 9cqw, 17px)' }}>
      {w.load == null ? '0%' : `${Math.round(w.load * 100)}%`}
    </span>
  );
  return (
    // a div (not a button) so the trips number inside can be its own button
    <div
      role="button"
      tabIndex={has ? 0 : -1}
      aria-pressed={active}
      aria-disabled={!has}
      aria-label={dayName(w.dow, lang, true)}
      onClick={() => { if (has) onPick(); }}
      onKeyDown={e => { if (has && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(); } }}
      style={{
        position: 'relative', minWidth: 0, padding: '10px 1px 10px', borderRadius: '16px', cursor: has ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center',
        background: glassBg(active ? GOLD_RGB : '139, 92, 246', active ? 0.55 : 0.3),
        border: `1px solid ${active ? 'rgba(226,176,78,0.8)' : 'rgba(255,255,255,0.14)'}`,
        boxShadow: active ? '0 0 14px rgba(226,176,78,0.3), inset 0 1px 0 rgba(255,255,255,0.12)' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
        opacity: has ? 1 : 0.55, color: '#fff', fontFamily: 'inherit', containerType: 'inline-size',
      }}
    >
      <span aria-hidden="true" style={{ ...topEdge, left: '10px', right: '10px' }} />
      <span style={{ fontSize: 'clamp(10.5px, 9cqw, 16px)', fontWeight: 800, letterSpacing: '-0.02em', padding: '3px 3px', borderRadius: '99px', whiteSpace: 'nowrap', background: active ? 'rgba(226,176,78,0.28)' : 'rgba(255,255,255,0.08)', border: `1px solid ${active ? 'rgba(226,176,78,0.6)' : 'rgba(255,255,255,0.16)'}` }}>
        {dayName(w.dow, lang)}
      </span>
      {metric(he ? 'אנשים' : 'people', num(w.avgPassengers), { big: true, first: true })}
      {/* total trips: tapping swaps the number for the split by place, in the same spot */}
      <button
        type="button"
        disabled={!has}
        aria-pressed={split}
        onClick={e => { e.stopPropagation(); setSplit(v => !v); }}
        style={{ all: 'unset', cursor: has ? 'pointer' : 'default', width: '100%', boxSizing: 'border-box' }}
      >
        {metric(
          split ? (he ? 'לפי מקום ▾' : 'by place ▾') : (he ? 'סה״כ נסיעות ▾' : 'total trips ▾'),
          split && has ? (
            pair(...splitRound(w.avgTrips770, w.avgTripsOhel).map(String) as [string, string])
          ) : num(w.avgTrips),
          { slot: 30 }
        )}
      </button>
      {/* load: tapping swaps the percentage for the load of each direction, in the same spot */}
      <button
        type="button"
        disabled={!has}
        aria-pressed={loadSplit}
        onClick={e => { e.stopPropagation(); setLoadSplit(v => !v); }}
        style={{ all: 'unset', cursor: has ? 'pointer' : 'default', width: '100%', boxSizing: 'border-box' }}
      >
        {metric(
          loadSplit ? (he ? 'עומס לפי מקום ▾' : 'load by place ▾') : (he ? 'עומס ▾' : 'load ▾'),
          loadSplit && has ? (
            pair(pctNum(w.load770), pctNum(w.loadOhel), '%')
          ) : loadPill,
          { slot: 30 }
        )}
      </button>
    </div>
  );
}
