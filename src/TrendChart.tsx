// "Stock-style" day-by-day chart for the Analytics tab: one point per day, green where the
// day went up compared with the day before and red where it went down. Hebrew dates under
// the line, numbers on the side, and any day can be found by dragging a finger / the mouse
// over the chart, by the arrows, or by picking a date. Hand-made SVG (no chart library),
// drawn from the same `allDays` list the rest of the tab uses, so it follows every scan.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HDate } from '@hebcal/core';
import type { DayStat } from './services/analytics';
import { getHebrewDate } from './services/hebrewDate';
import { prevDay } from './services/nyTime';

type Metric = 'pax' | 'trips' | 'load';
type RangeKey = 'week' | 'month' | 'quarter' | 'year' | 'all';
type Mode = 'line' | 'bars';

const UP = '46, 204, 140';
const DOWN = '244, 63, 94';
const FLAT = '165, 174, 196';
const RANGE_DAYS: Record<RangeKey, number> = { week: 7, month: 30, quarter: 90, year: 365, all: Infinity };
const PAD = { l: 46, r: 12, t: 14, b: 30 };
const CHART_H = 260;

const noon = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const dayNum = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const ymdOfNum = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const hebFull = (ymd: string) => getHebrewDate(noon(ymd));
const hebShort = (ymd: string) => hebFull(ymd).replace(/\s+\S+$/, ''); // "ג׳ אלול"
const hebMonthOnly = (ymd: string) => hebShort(ymd).split(' ').slice(1).join(' '); // "אלול"

function niceTicks(lo: number, hi: number, n = 4): number[] {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 1e6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const colorOf = (delta: number) => (delta > 0 ? UP : delta < 0 ? DOWN : FLAT);
const sign = (n: number) => (n > 0 ? '▲' : n < 0 ? '▼' : '■');

interface Pt { date: string; v: number; day: DayStat }

export default function TrendChart({ days, lang }: { days: DayStat[]; lang: 'he' | 'en' }) {
  const he = lang === 'he';
  const [metric, setMetric] = useState<Metric>('pax');
  const [range, setRange] = useState<RangeKey>('quarter');
  const [mode, setMode] = useState<Mode>('line');
  const [selDate, setSelDate] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, Math.floor(el.clientWidth))));
    ro.observe(el);
    setWidth(Math.max(240, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const fmt = (v: number) => (metric === 'load' ? `${Math.round(v)}%` : Math.round(v).toLocaleString('en-US'));
  const metricLabel = metric === 'pax' ? (he ? 'נוסעים' : 'People') : metric === 'trips' ? (he ? 'נסיעות' : 'Trips') : (he ? 'עומס' : 'Load');

  // every day with data, for the chosen metric
  const series = useMemo<Pt[]>(() => {
    const out: Pt[] = [];
    for (const d of days) {
      const v = metric === 'pax' ? d.passengers : metric === 'trips' ? d.trips : d.seats > 0 ? (d.passengers / d.seats) * 100 : null;
      if (v != null) out.push({ date: d.date, v, day: d });
    }
    return out;
  }, [days, metric]);

  const pts = useMemo(() => {
    if (!series.length) return [];
    const last = series[series.length - 1].date;
    const n = RANGE_DAYS[range];
    if (!Number.isFinite(n)) return series;
    let from = last;
    for (let i = 1; i < n; i++) from = prevDay(from);
    return series.filter(p => p.date >= from);
  }, [series, range]);

  const innerW = Math.max(60, width - PAD.l - PAD.r);
  const innerH = CHART_H - PAD.t - PAD.b;

  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const d0 = dayNum(pts[0].date), d1 = dayNum(pts[pts.length - 1].date);
    const span = Math.max(1, d1 - d0);
    const vals = pts.map(p => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (mode === 'bars') lo = 0;
    else { const pad = Math.max((hi - lo) * 0.12, hi * 0.02, 1); lo = Math.max(0, lo - pad); hi += pad; }
    const ticks = niceTicks(lo, hi);
    const yMin = ticks[0], yMax = ticks[ticks.length - 1];
    const x = (date: string) => PAD.l + ((dayNum(date) - d0) / span) * innerW;
    const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
    return { d0, d1, span, ticks, yMin, yMax, x, y };
  }, [pts, mode, innerW, innerH]);

  // labels under the line: a handful of days for short ranges, the start of each Hebrew month for long ones
  const xTicks = useMemo(() => {
    if (!geo) return [];
    const maxLabels = Math.max(2, Math.floor(innerW / 58));
    const out: { date: string; label: string }[] = [];
    if (geo.span <= 45) {
      const step = [1, 2, 3, 5, 7, 10, 14, 21].find(s => Math.floor(geo.span / s) + 1 <= maxLabels) ?? 21;
      for (let o = 0; o <= geo.span; o += step) { const date = ymdOfNum(geo.d0 + o); out.push({ date, label: hebShort(date) }); }
    } else {
      const starts: string[] = [];
      for (let n = geo.d0; n <= geo.d1; n++) {
        const date = ymdOfNum(n);
        if (new HDate(noon(date)).getDate() === 1) starts.push(date);
      }
      const stride = Math.max(1, Math.ceil(starts.length / maxLabels));
      starts.forEach((date, i) => { if (i % stride === 0) out.push({ date, label: hebMonthOnly(date) }); });
    }
    return out;
  }, [geo, innerW]);

  const selIdx = useMemo(() => (selDate ? pts.findIndex(p => p.date === selDate) : -1), [pts, selDate]);
  const shownIdx = selIdx >= 0 ? selIdx : pts.length - 1;
  const shown = pts[shownIdx];
  const scrubbing = selIdx >= 0;

  const pickByX = (clientX: number) => {
    if (!geo || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < pts.length; i++) { const dd = Math.abs(geo.x(pts[i].date) - px); if (dd < bestD) { bestD = dd; best = i; } }
    setSelDate(pts[best].date);
    setNotice('');
  };

  const step = (delta: number) => {
    if (!pts.length) return;
    const i = Math.min(pts.length - 1, Math.max(0, shownIdx + delta));
    setSelDate(pts[i].date);
    setNotice('');
  };

  const jumpTo = (ymd: string) => {
    if (!ymd || !series.length) return;
    let i = series.findIndex(p => p.date >= ymd);
    if (i < 0) i = series.length - 1;
    const hit = series[i];
    setNotice(hit.date === ymd ? '' : (he ? 'אין נתונים ביום הזה, הוצג היום הקרוב ביותר.' : 'No data on that day, showing the closest one.'));
    if (!pts.some(p => p.date === hit.date)) setRange('all');
    setSelDate(hit.date);
  };

  if (series.length < 2) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '28px' }}>{he ? 'אין עדיין מספיק ימים להצגת גרף.' : 'Not enough days for a chart yet.'}</div>;
  }

  const first = pts[0], lastPt = pts[pts.length - 1];
  const periodDelta = lastPt.v - first.v;
  const prevPt = shownIdx > 0 ? pts[shownIdx - 1] : null;
  const dayDelta = prevPt ? shown.v - prevPt.v : 0;
  const headDelta = scrubbing ? dayDelta : periodDelta;
  const headBase = scrubbing ? prevPt?.v ?? null : first.v;
  const headPct = headBase ? (headDelta / headBase) * 100 : null;
  const headRgb = colorOf(headDelta);
  const overallRgb = colorOf(periodDelta);

  const deltaText = (d: number, pct: number | null) => {
    const abs = metric === 'load' ? `${Math.abs(Math.round(d * 10) / 10)}` : Math.abs(Math.round(d)).toLocaleString('en-US');
    return `${sign(d)} ${abs}${metric === 'load' ? (he ? ' נק׳' : ' pts') : ''}${pct != null && metric !== 'load' ? ` (${Math.abs(Math.round(pct * 10) / 10)}%)` : ''}`;
  };

  const weekday = (ymd: string) => noon(ymd).toLocaleDateString(he ? 'he-IL' : 'en-US', { weekday: 'long' });
  const greg = (ymd: string) => noon(ymd).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const chip = (active: boolean): CSSProperties => ({
    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', padding: '6px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
    color: active ? '#fff' : 'var(--text-secondary)',
    background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
    border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : 'transparent'}`,
  });

  const rangeLabels: Record<RangeKey, string> = he
    ? { week: 'שבוע', month: 'חודש', quarter: '3 חודשים', year: 'שנה', all: 'הכל' }
    : { week: 'Week', month: 'Month', quarter: '3 months', year: 'Year', all: 'All' };

  const selX = geo ? geo.x(shown.date) : 0;
  const selY = geo ? geo.y(shown.v) : 0;
  const tagLabel = hebShort(shown.date);
  const tagW = Math.max(54, tagLabel.length * 7.5 + 16);
  const tagX = Math.min(Math.max(selX, PAD.l + tagW / 2), PAD.l + innerW - tagW / 2);

  const excludedNote = shown.day.excluded === 'month'
    ? (he ? 'לא נכלל בממוצעים (חודש שהוצא מהחישוב)' : 'Not counted in the averages (month left out)')
    : shown.day.excluded === 'ceiling'
      ? (he ? 'לא נכלל בממוצעים (מעל התקרה)' : 'Not counted in the averages (over the ceiling)')
      : shown.day.auto === 'high' ? (he ? 'יום חריג: גבוה מהרגיל' : 'Unusual day: higher than usual')
      : shown.day.auto === 'low' ? (he ? 'יום חריג: נמוך מהרגיל' : 'Unusual day: lower than usual')
      : shown.day.auto === 'partial' ? (he ? 'יום חריג: כנראה לא נרשם במלואו' : 'Unusual day: probably not fully logged')
      : '';

  const barW = Math.max(1.2, Math.min(18, (innerW / (geo ? geo.span + 1 : 1)) * 0.68));
  const baseY = geo ? geo.y(Math.max(geo.yMin, 0)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <style>{`
        @keyframes tc-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .tc-in { animation: tc-in .55s cubic-bezier(.22,1,.36,1) both; }
        .tc-chip:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .tc-in { animation: none; } }
      `}</style>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 4px' }}>
        <div role="group" aria-label={he ? 'מדד' : 'Metric'} style={{ display: 'flex', gap: '2px' }}>
          {(['pax', 'trips', 'load'] as Metric[]).map(m => (
            <button key={m} type="button" className="tc-chip" aria-pressed={metric === m} onClick={() => { setMetric(m); setNotice(''); }} style={chip(metric === m)}>
              {m === 'pax' ? (he ? 'נוסעים' : 'People') : m === 'trips' ? (he ? 'נסיעות' : 'Trips') : (he ? 'עומס' : 'Load')}
            </button>
          ))}
        </div>
        <div role="group" aria-label={he ? 'סוג גרף' : 'Chart type'} style={{ display: 'flex', gap: '2px' }}>
          <button type="button" className="tc-chip" aria-pressed={mode === 'line'} onClick={() => setMode('line')} style={chip(mode === 'line')}>{he ? 'קו' : 'Line'}</button>
          <button type="button" className="tc-chip" aria-pressed={mode === 'bars'} onClick={() => setMode('bars')} style={chip(mode === 'bars')}>{he ? 'עמודות' : 'Bars'}</button>
        </div>
      </div>

      <div style={{ padding: '4px 6px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 12px' }}>
          <span style={{ fontSize: '34px', fontWeight: 800, color: '#fff', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{fmt(shown.v)}</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: `rgb(${headRgb})`, fontVariantNumeric: 'tabular-nums' }}>
            {prevPt || !scrubbing ? deltaText(headDelta, headPct) : '—'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {scrubbing ? (he ? 'מהיום הקודם' : 'vs previous day') : (he ? `בתקופה · ${hebShort(first.date)} – ${hebShort(lastPt.date)}` : `over the period · ${hebShort(first.date)} – ${hebShort(lastPt.date)}`)}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', minHeight: '18px' }}>
          {metricLabel} · <b style={{ color: '#fff' }}>{hebFull(shown.date)}</b> · {weekday(shown.date)} · <span style={{ color: 'var(--text-secondary)' }}>{greg(shown.date)}</span>
        </div>
      </div>

      <div
        ref={boxRef}
        tabIndex={0}
        role="img"
        aria-label={he ? `גרף ${metricLabel} לפי ימים. חצים ימינה ושמאלה מעבירים בין ימים.` : `Daily ${metricLabel} chart. Left and right arrows move between days.`}
        onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'Escape') setSelDate(null); }}
        onPointerDown={e => pickByX(e.clientX)}
        onPointerMove={e => { if (e.pointerType === 'mouse' || e.buttons) pickByX(e.clientX); }}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setSelDate(null); }}
        style={{ position: 'relative', width: '100%', height: `${CHART_H}px`, direction: 'ltr', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'crosshair', outline: 'none' }}
      >
        {geo && (
          <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
            <defs>
              <linearGradient id="tc-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={`rgb(${overallRgb})`} stopOpacity="0.34" />
                <stop offset="1" stopColor={`rgb(${overallRgb})`} stopOpacity="0" />
              </linearGradient>
              <filter id="tc-glow" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            {geo.ticks.map(t => (
              <g key={t}>
                <line x1={PAD.l} x2={PAD.l + innerW} y1={geo.y(t)} y2={geo.y(t)} stroke="rgba(255,255,255,0.07)" strokeDasharray="2 5" />
                <text x={PAD.l - 8} y={geo.y(t) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.55)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
              </g>
            ))}
            <line x1={PAD.l} x2={PAD.l + innerW} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="rgba(255,255,255,0.22)" />

            {xTicks.map(t => (
              <g key={t.date}>
                <line x1={geo.x(t.date)} x2={geo.x(t.date)} y1={PAD.t + innerH} y2={PAD.t + innerH + 4} stroke="rgba(255,255,255,0.3)" />
                <text x={Math.min(Math.max(geo.x(t.date), PAD.l + 14), PAD.l + innerW - 14)} y={PAD.t + innerH + 18} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.62)">{t.label}</text>
              </g>
            ))}

            <g key={`${metric}-${range}-${mode}`} className="tc-in">
              {mode === 'line' ? (
                <>
                  <path
                    d={`M ${geo.x(pts[0].date)} ${geo.y(pts[0].v)} ${pts.slice(1).map(p => `L ${geo.x(p.date)} ${geo.y(p.v)}`).join(' ')} L ${geo.x(lastPt.date)} ${PAD.t + innerH} L ${geo.x(pts[0].date)} ${PAD.t + innerH} Z`}
                    fill="url(#tc-area)"
                  />
                  <g filter="url(#tc-glow)" strokeWidth={pts.length > 150 ? 1.8 : 2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
                    {pts.slice(1).map((p, i) => {
                      // a stretch with no logged days (more than 3 in a row) is drawn as a faint dashed bridge, not as a real change
                      const gap = dayNum(p.date) - dayNum(pts[i].date) > 3;
                      return (
                        <line
                          key={p.date}
                          x1={geo.x(pts[i].date)} y1={geo.y(pts[i].v)} x2={geo.x(p.date)} y2={geo.y(p.v)}
                          stroke={gap ? 'rgba(165,174,196,0.5)' : `rgb(${colorOf(p.v - pts[i].v)})`}
                          strokeDasharray={gap ? '3 6' : undefined}
                          strokeWidth={gap ? 1.4 : undefined}
                        />
                      );
                    })}
                  </g>
                  {pts.length <= 60 && pts.map(p => (
                    <circle key={p.date} cx={geo.x(p.date)} cy={geo.y(p.v)} r={p.day.excluded ? 3.2 : 2.2} fill={p.day.excluded ? 'transparent' : '#0d1220'} stroke="rgba(255,255,255,0.65)" strokeWidth={p.day.excluded ? 1.2 : 1} />
                  ))}
                </>
              ) : (
                pts.map((p, i) => {
                  const rgb = colorOf(i === 0 ? 0 : p.v - pts[i - 1].v);
                  const yy = geo.y(p.v);
                  return <rect key={p.date} x={geo.x(p.date) - barW / 2} y={yy} width={barW} height={Math.max(1, baseY - yy)} rx={Math.min(3, barW / 2)} fill={`rgb(${rgb})`} fillOpacity={p.day.excluded ? 0.4 : 0.88} />;
                })
              )}
            </g>

            {/* the day being looked at */}
            <line x1={selX} x2={selX} y1={PAD.t} y2={PAD.t + innerH} stroke="rgba(255,255,255,0.5)" strokeDasharray="3 4" />
            <circle cx={selX} cy={selY} r="9" fill={`rgba(${headRgb}, 0.22)`} />
            <circle cx={selX} cy={selY} r="4.6" fill={`rgb(${headRgb})`} stroke="#fff" strokeWidth="1.6" />
            <rect x={tagX - tagW / 2} y={PAD.t + innerH + 5} width={tagW} height="20" rx="10" fill="rgba(20,26,44,0.95)" stroke="rgba(255,255,255,0.4)" />
            <text x={tagX} y={PAD.t + innerH + 19} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{tagLabel}</text>
          </svg>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '0 2px' }}>
        <div role="group" aria-label={he ? 'תקופה' : 'Period'} style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
          {(Object.keys(RANGE_DAYS) as RangeKey[]).map(k => (
            <button key={k} type="button" className="tc-chip" aria-pressed={range === k} onClick={() => { setRange(k); setSelDate(null); setNotice(''); }} style={{ ...chip(range === k), padding: '6px 10px' }}>{rangeLabels[k]}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        {[
          { label: he ? 'נוסעים' : 'People', value: shown.day.passengers.toLocaleString('en-US') },
          { label: he ? 'נסיעות' : 'Trips', value: shown.day.trips.toLocaleString('en-US') },
          { label: he ? 'עומס' : 'Load', value: shown.day.seats > 0 ? `${Math.round((shown.day.passengers / shown.day.seats) * 100)}%` : '—' },
        ].map(c => (
          <div key={c.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '14px', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.label}</div>
            <b style={{ fontSize: '18px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{c.value}</b>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '0 2px' }}>
        <button type="button" className="tc-chip" onClick={() => step(-1)} aria-label={he ? 'היום הקודם' : 'Previous day'} style={{ ...chip(false), border: '1px solid rgba(255,255,255,0.2)', padding: '6px 8px', display: 'inline-flex' }}>
          {he ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button type="button" className="tc-chip" onClick={() => step(1)} aria-label={he ? 'היום הבא' : 'Next day'} style={{ ...chip(false), border: '1px solid rgba(255,255,255,0.2)', padding: '6px 8px', display: 'inline-flex' }}>
          {he ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {he ? 'מעבר לתאריך' : 'Go to date'}
          <input
            type="date"
            value={shown.date}
            min={series[0].date}
            max={series[series.length - 1].date}
            onChange={e => jumpTo(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', colorScheme: 'dark' }}
          />
        </label>
        {scrubbing && <button type="button" className="tc-chip" onClick={() => { setSelDate(null); setNotice(''); }} style={{ ...chip(false), fontSize: '12px' }}>{he ? 'חזרה להיום האחרון' : 'Back to latest'}</button>}
      </div>

      {(excludedNote || notice) && (
        <p style={{ margin: 0, padding: '0 4px', fontSize: '12px', color: notice ? 'rgb(226,176,78)' : 'var(--text-secondary)' }}>{notice || excludedNote}</p>
      )}
      <p style={{ margin: 0, padding: '0 4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
        {he ? 'ירוק: עלייה לעומת היום שלפניו · אדום: ירידה · קו מקווקו: תקופה בלי ימים רשומים. גררו על הגרף כדי לראות כל יום. היום הנוכחי נכנס רק אחרי שייגמר.' : 'Green: up vs the day before · red: down · dashed: stretch with no logged days. Drag over the chart to see any day. Today is added once it has ended.'}
      </p>
    </div>
  );
}
