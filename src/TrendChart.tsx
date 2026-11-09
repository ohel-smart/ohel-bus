// "Stock-style" day-by-day chart for the Analytics tab: one point per day, green where the
// day went up compared with the day before and red where it went down. Hebrew dates under
// the line, numbers on the side, and any day can be found by dragging a finger / the mouse
// over the chart, by the arrows, or by picking a date. Hand-made SVG (no chart library),
// drawn from the same `allDays` list the rest of the tab uses, so it follows every scan.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dowOf, type DayStat } from './services/analytics';
import { getHebrewDate } from './services/hebrewDate';
import { prevDay } from './services/nyTime';

type Metric = 'pax' | 'trips' | 'load';
type RangeKey = 'week' | 'month' | 'quarter' | 'year' | 'all';
type Mode = 'line' | 'bars';

const UP = '52, 211, 153';
const DOWN = '251, 113, 133';
const FLAT = '100, 210, 255'; // #64D2FF
const GOLD = '226, 176, 78';
const RANGE_DAYS: Record<RangeKey, number> = { week: 7, month: 30, quarter: 90, year: 365, all: Infinity };
const PAD = { l: 40, r: 6, t: 12, b: 24 };
const CHART_H = 250;

const noon = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const dayNum = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
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

// A day only counts as "up" or "down" when it is clearly different (10% or more); smaller wobbles are steady.
const SIG = 0.1;
// 'none' = nothing sensible to compare the day with (too few similar days yet)
type Tone = 'up' | 'down' | 'flat' | 'none';
const toneRgb = (t: Tone) => (t === 'up' ? UP : t === 'down' ? DOWN : FLAT);
const toneOf = (v: number, ref: number | null): Tone => (!ref || ref <= 0 ? 'none' : (v - ref) / ref >= SIG ? 'up' : (v - ref) / ref <= -SIG ? 'down' : 'flat');

/** A smooth curve through the points (Catmull-Rom as beziers), kept inside [yTop, yBottom]. */
function smoothPath(P: [number, number][], yTop: number, yBottom: number): string {
  if (P.length < 2) return P.length ? `M ${P[0][0]} ${P[0][1]}` : '';
  const cy = (v: number) => Math.min(yBottom, Math.max(yTop, v));
  let d = `M ${P[0][0]} ${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] ?? p2;
    const t = 0.18;
    d += ` C ${p1[0] + (p2[0] - p0[0]) * t} ${cy(p1[1] + (p2[1] - p0[1]) * t)}, ${p2[0] - (p3[0] - p1[0]) * t} ${cy(p2[1] - (p3[1] - p1[1]) * t)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const sign = (n: number) => (n > 0 ? '▲' : n < 0 ? '▼' : '■');

interface Pt { date: string; v: number; day: DayStat }

export default function TrendChart({ days, lang }: { days: DayStat[]; lang: 'he' | 'en' }) {
  const he = lang === 'he';
  const [metric, setMetric] = useState<Metric>('pax');
  const [range, setRange] = useState<RangeKey>('quarter');
  // zoom: a window (first/last index) inside the days of the chosen period; null = the whole period
  const [zoom, setZoom] = useState<{ from: number; to: number } | null>(null);
  const [mode, setMode] = useState<Mode>('line');
  const [selDate, setSelDate] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  // How far the visible window has been moved up from its starting place (in the chart's own units). 0 = the average sits in the middle.
  const [panState, setPanState] = useState(0);
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
      if (dowOf(d.date) === 6) continue; // Shabbat is left out of the chart
      const v = metric === 'pax' ? d.passengers : metric === 'trips' ? d.trips : d.seats > 0 ? (d.passengers / d.seats) * 100 : null;
      if (v != null) out.push({ date: d.date, v, day: d });
    }
    return out;
  }, [days, metric]);

  // Every day is judged against all the days together: the middle value (median) of every day logged, so a few odd days
  // cannot drag it. Days the manager left out of the calculation do not count unless nothing else exists.
  // There is always something to compare with, and it sharpens by itself as days accumulate.
  const overall = useMemo(() => {
    const median = (a: number[]) => { const t = [...a].sort((x, y) => x - y), m = Math.floor(t.length / 2); return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
    const counted = series.filter(p => !p.day.excluded);
    return median((counted.length ? counted : series).map(p => p.v));
  }, [series]);
  const toneOfPt = (p: Pt): Tone => toneOf(p.v, overall);

  const base = useMemo(() => {
    if (!series.length) return [];
    const last = series[series.length - 1].date;
    const n = RANGE_DAYS[range];
    if (!Number.isFinite(n)) return series;
    let from = last;
    for (let i = 1; i < n; i++) from = prevDay(from);
    return series.filter(p => p.date >= from);
  }, [series, range]);
  const pts = useMemo(() => (zoom ? base.slice(zoom.from, zoom.to + 1) : base), [base, zoom]);

  const innerW = Math.max(60, width - PAD.l - PAD.r);
  const innerH = CHART_H - PAD.t - PAD.b;

  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const n = pts.length;
    const vals = pts.map(p => p.v);
    const maxVal = Math.max(...vals);
    // The visible window starts centred on the average (the middle of the screen = the usual day), reaching from
    // 0 to twice the average. Days above it are one scroll away (panState moves the window up, see panBy).
    const typ = overall > 0 ? overall : Math.max(maxVal, 1);
    const span = typ * 2;
    const panMax = Math.max(0, Math.ceil(maxVal * 1.06 - span));
    const pan = Math.min(Math.max(0, panState), panMax);
    const yMin = pan, yMax = span + pan;
    const ticks = niceTicks(yMin, yMax).filter(t => t >= yMin - 1e-9 && t <= yMax + 1e-9);
    // one slot per logged day, evenly spaced: a day that is left out (Saturday) leaves no hole
    const idx = new Map(pts.map((p, i) => [p.date, i]));
    const xi = (i: number) => PAD.l + (i / (n - 1)) * innerW;
    const x = (date: string) => xi(idx.get(date) ?? 0);
    const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
    return { n, ticks, yMin, yMax, x, xi, y, typ, span, panMax, pan };
  }, [pts, innerW, innerH, overall, panState]);

  // labels under the line: a handful of logged days for short ranges, the first day of each Hebrew month for long ones
  const xTicks = useMemo(() => {
    if (!geo) return [];
    const maxLabels = Math.max(2, Math.floor(innerW / 58));
    const out: { date: string; label: string }[] = [];
    if (pts.length <= 45) {
      const stride = Math.max(1, Math.ceil(pts.length / maxLabels));
      pts.forEach((p, i) => { if (i % stride === 0) out.push({ date: p.date, label: hebShort(p.date) }); });
    } else {
      const starts: string[] = [];
      pts.forEach((p, i) => { if (i === 0 || hebMonthOnly(p.date) !== hebMonthOnly(pts[i - 1].date)) starts.push(p.date); });
      const stride = Math.max(1, Math.ceil(starts.length / maxLabels));
      starts.forEach((date, i) => { if (i % stride === 0) out.push({ date, label: hebMonthOnly(date) }); });
    }
    return out;
  }, [geo, pts, innerW]);

  const selIdx = useMemo(() => (selDate ? pts.findIndex(p => p.date === selDate) : -1), [pts, selDate]);
  const shownIdx = selIdx >= 0 ? selIdx : pts.length - 1;
  const shown = pts[shownIdx];
  const scrubbing = selIdx >= 0;

  // zoom in (factor < 1) or out (factor > 1) around a point of the chart (0 = left edge, 1 = right edge)
  const zoomBy = (factor: number, anchor = 0.5) => {
    const n = base.length;
    const from = zoom ? zoom.from : 0, to = zoom ? zoom.to : n - 1;
    const len = to - from;
    const newLen = Math.min(n - 1, Math.max(4, Math.round(len * factor)));
    if (newLen >= n - 1) { setZoom(null); return; }
    const a = from + anchor * len;
    const nf = Math.min(n - 1 - newLen, Math.max(0, Math.round(a - anchor * newLen)));
    setZoom({ from: nf, to: nf + newLen });
  };
  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  const anchorOf = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    return rect ? Math.min(1, Math.max(0, (clientX - rect.left - PAD.l) / Math.max(1, rect.width - PAD.l - PAD.r))) : 0.5;
  };
  const anchorRef = useRef(anchorOf);
  anchorRef.current = anchorOf;
  // ctrl / cmd + wheel (a trackpad pinch counts as one) zooms; a plain wheel still scrolls the page
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomRef.current(e.deltaY > 0 ? 1.18 : 1 / 1.18, anchorRef.current(e.clientX));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [series.length < 2]);
  const fingers = useRef(new Map<number, number>());
  const lastSpread = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    fingers.current.set(e.pointerId, e.clientX);
    if (fingers.current.size === 1) pickByX(e.clientX);
    else lastSpread.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, e.clientX);
    if (fingers.current.size >= 2) {
      const [a, b] = [...fingers.current.values()];
      const spread = Math.abs(a - b);
      if (lastSpread.current > 0 && spread > 8) zoomBy(lastSpread.current / spread, anchorOf((a + b) / 2));
      lastSpread.current = spread;
    } else if (e.buttons) pickByX(e.clientX); // the line only moves while pressing / dragging, and stays where it is left
  };
  const onUp = (e: React.PointerEvent) => { fingers.current.delete(e.pointerId); lastSpread.current = 0; };

  const pickByX = (clientX: number) => {
    if (!geo || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < pts.length; i++) { const dd = Math.abs(geo.xi(i) - px); if (dd < bestD) { bestD = dd; best = i; } }
    setSelDate(pts[best].date);
    setNotice('');
  };

  const step = (delta: number) => {
    if (!pts.length) return;
    const i = Math.min(pts.length - 1, Math.max(0, shownIdx + delta));
    setSelDate(pts[i].date);
    setNotice('');
  };

  // move the visible window up (positive) or down (negative); it never goes below the start (average in the middle)
  const panBy = (delta: number) => { if (geo) setPanState(Math.min(geo.panMax, Math.max(0, geo.pan + delta))); };
  const panByRef = useRef(panBy);
  panByRef.current = panBy;
  const axisDrag = useRef<{ y: number; pan: number } | null>(null);
  const onAxisDown = (e: React.PointerEvent) => {
    if (!geo) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    axisDrag.current = { y: e.clientY, pan: geo.pan };
  };
  const onAxisMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!axisDrag.current || !geo) return;
    // dragging down pulls the higher part of the chart into view, like dragging a map
    setPanState(Math.min(geo.panMax, Math.max(0, axisDrag.current.pan + ((e.clientY - axisDrag.current.y) / innerH) * geo.span)));
  };
  const onAxisUp = (e: React.PointerEvent) => { e.stopPropagation(); axisDrag.current = null; };

  const jumpTo = (ymd: string) => {
    if (!ymd || !series.length) return;
    let i = series.findIndex(p => p.date >= ymd);
    if (i < 0) i = series.length - 1;
    const hit = series[i];
    setNotice(hit.date === ymd || dowOf(ymd) === 6 ? '' : (he ? 'אין נתונים ביום הזה, הוצג היום הקרוב ביותר.' : 'No data on that day, showing the closest one.'));
    if (!pts.some(p => p.date === hit.date)) { if (!base.some(p => p.date === hit.date)) setRange('all'); setZoom(null); }
    setSelDate(hit.date);
  };

  if (series.length < 2) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '28px' }}>{he ? 'אין עדיין מספיק ימים להצגת גרף.' : 'Not enough days for a chart yet.'}</div>;
  }

  const lastPt = pts[pts.length - 1];
  // the trend over the period: the latest week against all the days before it (by median, so one spike does not decide it)
  const med = (a: Pt[]) => { const t = a.map(p => p.v).sort((x, y) => x - y), m = Math.floor(t.length / 2); return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
  // days left out of the calculation do not take part unless nothing else is available
  const usable = pts.filter(p => !p.day.excluded).length >= 2 ? pts.filter(p => !p.day.excluded) : pts;
  const tail = usable.slice(-Math.min(7, Math.max(1, usable.length - 1)));
  const before = usable.slice(0, usable.length - tail.length);
  const periodStart = med(before), periodEnd = med(tail);
  const periodDelta = periodEnd - periodStart;
  const periodTone: Tone = toneOf(periodEnd, periodStart);
  const dayTone = toneOfPt(shown);
  const headTone: Tone = scrubbing ? dayTone : periodTone;
  const headDelta = scrubbing ? shown.v - overall : periodDelta;
  const headBase = scrubbing ? overall : periodStart;
  const headPct = headBase ? (headDelta / headBase) * 100 : null;
  // for load a high value is bad, so green and red swap (the arrows still show the real direction)
  const rgbOf = (t: Tone) => toneRgb(metric === 'load' ? (t === 'up' ? 'down' : t === 'down' ? 'up' : t) : t);
  const headRgb = rgbOf(headTone);

  const deltaText = (d: number, pct: number | null) => {
    const abs = metric === 'load' ? `${Math.abs(Math.round(d * 10) / 10)}` : Math.abs(Math.round(d)).toLocaleString('en-US');
    return `${sign(d)} ${abs}${metric === 'load' ? (he ? ' נק׳' : ' pts') : ''}${pct != null && metric !== 'load' ? ` (${Math.abs(Math.round(pct * 10) / 10)}%)` : ''}`;
  };
  const toneWord = (t: Tone) => metric === 'load'
    ? (t === 'up' ? (he ? 'עומס גבוה' : 'High load') : t === 'down' ? (he ? 'עומס נמוך' : 'Low load') : (he ? 'עומס רגיל' : 'Typical load'))
    : (t === 'up' ? (he ? 'יום חזק' : 'Strong day') : t === 'down' ? (he ? 'יום חלש' : 'Weak day') : (he ? 'יום רגיל' : 'Typical day'));
  const headText = headTone === 'flat' ? `■ ${scrubbing ? toneWord('flat') : he ? 'מגמה יציבה' : 'Steady trend'}` : deltaText(headDelta, headPct);

  const weekday = (ymd: string) => noon(ymd).toLocaleDateString(he ? 'he-IL' : 'en-US', { weekday: 'long' });
  const greg = (ymd: string) => noon(ymd).toLocaleDateString(he ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  // quiet controls: a soft segmented pill for the choices, plain text tabs for the period
  const seg = (active: boolean): CSSProperties => ({
    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', padding: '6px 11px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
    transition: 'background .2s, color .2s',
  });
  const segWrap: CSSProperties = { display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' };
  const tab = (active: boolean): CSSProperties => ({
    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', padding: '8px 4px 7px', fontSize: '13px', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
    borderBottom: `1.5px solid ${active ? `rgb(${GOLD})` : 'transparent'}`,
    transition: 'color .2s',
  });
  const ghost: CSSProperties = { all: 'unset', cursor: 'pointer', width: '34px', height: '34px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.05)', boxSizing: 'border-box' };

  const pill = (pos: CSSProperties): CSSProperties => ({
    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', position: 'absolute', left: PAD.l + 8, padding: '4px 11px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600,
    color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', direction: he ? 'rtl' : 'ltr', ...pos,
  });

  const rangeLabels: Record<RangeKey, string> = he
    ? { week: 'שבוע', month: 'חודש', quarter: '3 חודשים', year: 'שנה', all: 'הכל' }
    : { week: 'Week', month: 'Month', quarter: '3 months', year: 'Year', all: 'All' };

  const selX = geo ? geo.x(shown.date) : 0;
  const selInView = !geo || (shown.v >= geo.yMin && shown.v <= geo.yMax);
  const selY = geo ? Math.min(PAD.t + innerH - 4, Math.max(PAD.t + 4, geo.y(shown.v))) : 0;

  const excludedNote = shown.day.excluded === 'month'
    ? (he ? 'מחוץ לחישוב: חודש שהוצא' : 'Left out: excluded month')
    : shown.day.excluded === 'ceiling'
      ? (he ? 'מחוץ לחישוב: מעל התקרה' : 'Left out: over the ceiling')
      : shown.day.auto === 'high' ? (he ? 'יום חריג: גבוה' : 'Unusual: high')
      : shown.day.auto === 'low' ? (he ? 'יום חריג: נמוך' : 'Unusual: low')
      : shown.day.auto === 'partial' ? (he ? 'יום חריג: חלקי' : 'Unusual: partial')
      : '';

  const barW = Math.max(1.2, Math.min(16, (innerW / (geo ? geo.n : 1)) * 0.6));
  const baseY = geo ? geo.y(Math.max(geo.yMin, 0)) : 0;
  const hair = 'rgba(255,255,255,0.08)';

  const facts = [
    { label: he ? 'נוסעים' : 'People', value: shown.day.passengers.toLocaleString('en-US') },
    { label: he ? 'נסיעות' : 'Trips', value: shown.day.trips.toLocaleString('en-US') },
    { label: he ? 'עומס' : 'Load', value: shown.day.seats > 0 ? `${Math.round((shown.day.passengers / shown.day.seats) * 100)}%` : '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        @keyframes tc-in { from { opacity: 0; } to { opacity: 1; } }
        .tc-in { animation: tc-in .6s ease both; }
        .tc-ctl:focus-visible { outline: 2px solid rgba(255,255,255,.55); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .tc-in { animation: none; } }
      `}</style>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div role="group" aria-label={he ? 'מדד' : 'Metric'} style={segWrap}>
          {(['pax', 'trips', 'load'] as Metric[]).map(m => (
            <button key={m} type="button" className="tc-ctl" aria-pressed={metric === m} onClick={() => { setMetric(m); setPanState(0); setNotice(''); }} style={seg(metric === m)}>
              {m === 'pax' ? (he ? 'נוסעים' : 'People') : m === 'trips' ? (he ? 'נסיעות' : 'Trips') : (he ? 'עומס' : 'Load')}
            </button>
          ))}
        </div>
        <div role="group" aria-label={he ? 'סוג גרף' : 'Chart type'} style={segWrap}>
          <button type="button" className="tc-ctl" aria-pressed={mode === 'line'} onClick={() => setMode('line')} style={seg(mode === 'line')}>{he ? 'קו' : 'Line'}</button>
          <button type="button" className="tc-ctl" aria-pressed={mode === 'bars'} onClick={() => setMode('bars')} style={seg(mode === 'bars')}>{he ? 'עמודות' : 'Bars'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 2px 0' }}>
        <div style={{ fontSize: '12px', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.55)' }}>
          {metricLabel} · <span style={{ color: `rgb(${GOLD})`, fontWeight: 600 }}>{hebFull(shown.date)}</span> · {weekday(shown.date)} · {greg(shown.date)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 14px' }}>
          <span style={{ fontSize: '46px', fontWeight: 300, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(shown.v)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: `rgb(${headRgb})`, background: `rgba(${headRgb}, 0.12)`, padding: '4px 10px', borderRadius: '999px', fontVariantNumeric: 'tabular-nums', direction: 'ltr', unicodeBidi: 'isolate' }}>
              {headText}
            </span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
              {scrubbing
                ? [headTone === 'flat' ? '' : toneWord(headTone), excludedNote].filter(Boolean).join(' · ')
                : (he ? `מגמת השבוע האחרון · ${hebShort(tail[0].date)} – ${hebShort(lastPt.date)}` : `latest week · ${hebShort(tail[0].date)} – ${hebShort(lastPt.date)}`)}
            </span>
          </span>
        </div>
      </div>

      <div
        ref={boxRef}
        tabIndex={0}
        role="img"
        aria-label={he ? `גרף ${metricLabel} לפי ימים. חצים ימינה ושמאלה מעבירים בין ימים.` : `Daily ${metricLabel} chart. Left and right arrows move between days.`}
        onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); panBy(geo ? geo.span / 4 : 0); } else if (e.key === 'ArrowDown') { e.preventDefault(); panBy(geo ? -geo.span / 4 : 0); } else if (e.key === 'Escape') setSelDate(null); }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        style={{ position: 'relative', width: '100%', height: `${CHART_H}px`, direction: 'ltr', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'crosshair', outline: 'none' }}
      >
        {geo && (
          <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
            <defs>
              <clipPath id="tc-clip"><rect x={PAD.l - 8} y={PAD.t} width={innerW + 16} height={innerH} /></clipPath>
            </defs>

            {geo.ticks.map(t => (
              <g key={t}>
                <line x1={PAD.l} x2={PAD.l + innerW} y1={geo.y(t)} y2={geo.y(t)} stroke="rgba(255,255,255,0.06)" />
                <text x={PAD.l - 10} y={geo.y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="rgba(255,255,255,0.4)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
              </g>
            ))}

            {xTicks.map(t => (
              <text key={t.date} x={Math.min(Math.max(geo.x(t.date), PAD.l + 14), PAD.l + innerW - 14)} y={PAD.t + innerH + 17} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.45)">{t.label}</text>
            ))}

            {/* the average: a faint line across the middle (it moves down when the window is moved up) */}
            {geo.typ >= geo.yMin && geo.typ <= geo.yMax && (
              <g>
                <line x1={PAD.l} x2={PAD.l + innerW} y1={geo.y(geo.typ)} y2={geo.y(geo.typ)} stroke={`rgba(${GOLD}, 0.32)`} strokeDasharray="3 5" />
                <text x={PAD.l + innerW - 2} y={geo.y(geo.typ) - 5} textAnchor="end" fontSize="10" fill={`rgba(${GOLD}, 0.7)`}>{he ? 'ממוצע' : 'average'}</text>
              </g>
            )}

            <g key={`${metric}-${range}-${mode}`} className="tc-in" clipPath="url(#tc-clip)">
              {mode === 'line' ? (() => {
                // runs of days with no long hole between them; a hole is bridged by a faint dashed line, never drawn as a change
                const runs: Pt[][] = [];
                pts.forEach((p, i) => { if (i === 0 || dayNum(p.date) - dayNum(pts[i - 1].date) > 3) runs.push([p]); else runs[runs.length - 1].push(p); });
                const yBot = PAD.t + innerH;
                // the curve is kept between its own highest and lowest point (it never overshoots), even where they are outside the window
                const paths = runs.map(r => {
                  const P = r.map(p => [geo.x(p.date), geo.y(p.v)] as [number, number]);
                  const ys = P.map(q => q[1]);
                  return smoothPath(P, Math.min(...ys), Math.max(...ys));
                });
                return (
                  <>
                    <defs>
                      <linearGradient id="tc-stroke" gradientUnits="userSpaceOnUse" x1={PAD.l} x2={PAD.l + innerW} y1="0" y2="0">
                        {pts.map(p => <stop key={p.date} offset={(geo.x(p.date) - PAD.l) / innerW} stopColor={`rgb(${rgbOf(toneOfPt(p))})`} />)}
                      </linearGradient>
                      <linearGradient id="tc-vfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.3" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
                      <filter id="tc-blur" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
                    </defs>
                    {runs.map((r, i) => {
                      // the light under the line is the line's own colour (green under green, red under red), fading downwards
                      const x0 = geo.x(r[0].date), x1 = geo.x(r[r.length - 1].date), top = Math.min(...r.map(p => geo.y(p.v)));
                      return (
                        <g key={`a${i}`}>
                          <mask id={`tc-mask-${i}`} maskUnits="userSpaceOnUse" x={x0 - 1} y={top - 1} width={Math.max(1, x1 - x0) + 2} height={Math.max(1, yBot - top) + 2}>
                            <rect x={x0 - 1} y={top - 1} width={Math.max(1, x1 - x0) + 2} height={Math.max(1, yBot - top) + 2} fill="url(#tc-vfade)" />
                          </mask>
                          <path d={`${paths[i]} L ${x1} ${yBot} L ${x0} ${yBot} Z`} fill="url(#tc-stroke)" mask={`url(#tc-mask-${i})`} />
                        </g>
                      );
                    })}
                    {runs.slice(1).map((r, i) => {
                      const a = runs[i][runs[i].length - 1];
                      return <line key={`g${i}`} x1={geo.x(a.date)} y1={geo.y(a.v)} x2={geo.x(r[0].date)} y2={geo.y(r[0].v)} stroke="rgba(165,174,196,0.4)" strokeWidth="1.2" strokeDasharray="2 6" />;
                    })}
                    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                      {paths.map((d, i) => <path key={`b${i}`} d={d} stroke="url(#tc-stroke)" strokeWidth="5" opacity="0.28" filter="url(#tc-blur)" />)}
                      {paths.map((d, i) => <path key={`c${i}`} d={d} stroke="url(#tc-stroke)" strokeWidth={pts.length > 150 ? 1.6 : 2} />)}
                    </g>
                  </>
                );
              })() : (
                pts.map(p => {
                  const yy = geo.y(p.v);
                  return <rect key={p.date} x={geo.x(p.date) - barW / 2} y={yy} width={barW} height={Math.max(1, baseY - yy)} rx={Math.min(2.5, barW / 2)} fill={`rgb(${rgbOf(toneOfPt(p))})`} fillOpacity={p.day.excluded ? 0.35 : 0.8} />;
                })
              )}
            </g>

            {/* the day being looked at */}
            <line x1={selX} x2={selX} y1={PAD.t} y2={PAD.t + innerH} stroke={`rgba(${GOLD}, 0.55)`} />
            {selInView && <circle cx={selX} cy={selY} r="8" fill={`rgba(${headRgb}, 0.18)`} />}
            {selInView && <circle cx={selX} cy={selY} r="3.6" fill="#0b0f1a" stroke={`rgb(${headRgb})`} strokeWidth="2" />}
            {(() => {
              // a day outside the window is marked at the edge with an arrow showing where it is
              const label = (selInView ? '' : shown.v > (geo?.yMax ?? 0) ? '▲ ' : '▼ ') + fmt(shown.v), w = Math.max(40, label.length * 8 + 18);
              const tx = Math.min(Math.max(selX, PAD.l + w / 2), PAD.l + innerW - w / 2), ty = Math.max(0, selY - 38);
              return (
                <g>
                  <rect x={tx - w / 2} y={ty} width={w} height="22" rx="11" fill="rgba(20,26,44,0.95)" stroke="rgba(255,255,255,0.3)" />
                  <text x={tx} y={ty + 15} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#fff">{label}</text>
                </g>
              );
            })()}
          </svg>
        )}
        {geo && geo.panMax > 0 && (
          <>
            {/* drag (or scroll) here to move the window up and down */}
            <div
              onPointerDown={onAxisDown} onPointerMove={onAxisMove} onPointerUp={onAxisUp} onPointerCancel={onAxisUp}
              onWheel={e => { e.preventDefault(); panByRef.current(-e.deltaY * (geo.span / innerH)); }}
              aria-hidden="true"
              style={{ position: 'absolute', left: 0, top: PAD.t, width: PAD.l, height: innerH, touchAction: 'none', cursor: 'ns-resize' }}
            />
            {pts.some(p => p.v > geo.yMax) && (
              <button type="button" className="tc-ctl" onPointerDown={e => e.stopPropagation()} onClick={() => panBy(geo.span * 0.8)} style={pill({ top: PAD.t + 4 })}>
                ▲ {he ? `${pts.filter(p => p.v > geo.yMax).length} ימים גבוהים יותר` : `${pts.filter(p => p.v > geo.yMax).length} higher days`}
              </button>
            )}
            {geo.pan > 0 && (
              <button type="button" className="tc-ctl" onPointerDown={e => e.stopPropagation()} onClick={() => setPanState(0)} style={pill({ bottom: PAD.b + 6 })}>
                ▼ {he ? 'חזרה לממוצע' : 'back to the average'}
              </button>
            )}
          </>
        )}
      </div>

      {zoom && (
        <input
          type="range"
          aria-label={he ? 'הזזת החלון בזמן' : 'Move the window in time'}
          min={0}
          max={base.length - 1 - (zoom.to - zoom.from)}
          value={zoom.from}
          onChange={e => { const f = Number(e.target.value); setZoom({ from: f, to: f + (zoom.to - zoom.from) }); }}
          style={{ direction: 'ltr', width: '100%', accentColor: `rgb(${GOLD})`, margin: '-4px 0' }}
        />
      )}

      <div role="group" aria-label={he ? 'תקופה' : 'Period'} style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${hair}`, paddingTop: '2px' }}>
        {(Object.keys(RANGE_DAYS) as RangeKey[]).map(k => (
          <button key={k} type="button" className="tc-ctl" aria-pressed={range === k} onClick={() => { setRange(k); setZoom(null); setPanState(0); setSelDate(null); setNotice(''); }} style={tab(range === k)}>{rangeLabels[k]}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: '4px 0' }}>
        {facts.map((c, i) => (
          <div key={c.label} style={{ textAlign: 'center', borderInlineStart: i ? `1px solid ${hair}` : 'none' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.45)' }}>{c.label}</div>
            <b style={{ fontSize: '19px', fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{c.value}</b>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="tc-ctl" onClick={() => step(-1)} aria-label={he ? 'היום הקודם' : 'Previous day'} style={ghost}>
            {he ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button type="button" className="tc-ctl" onClick={() => step(1)} aria-label={he ? 'היום הבא' : 'Next day'} style={ghost}>
            {he ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          {scrubbing && <button type="button" className="tc-ctl" onClick={() => { setSelDate(null); setNotice(''); }} style={{ all: 'unset', cursor: 'pointer', fontSize: '12px', color: `rgb(${GOLD})`, padding: '6px 4px' }}>{he ? 'היום האחרון' : 'Latest'}</button>}
        </div>
        <input
          type="date"
          aria-label={he ? 'מעבר לתאריך' : 'Go to date'}
          value={shown.date}
          min={series[0].date}
          max={series[series.length - 1].date}
          onChange={e => jumpTo(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)', fontSize: '13px', colorScheme: 'dark', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap', fontSize: '11px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
        {notice && <span style={{ color: `rgb(${GOLD})` }}>{notice}</span>}
        {metric === 'load' ? (
          <>
            <span><span style={{ color: `rgb(${UP})` }}>●</span> {he ? 'נמוך' : 'low'}</span>
            <span><span style={{ color: `rgb(${DOWN})` }}>●</span> {he ? 'גבוה' : 'high'}</span>
          </>
        ) : (
          <>
            <span><span style={{ color: `rgb(${UP})` }}>●</span> {he ? 'חזק' : 'strong'}</span>
            <span><span style={{ color: `rgb(${DOWN})` }}>●</span> {he ? 'חלש' : 'weak'}</span>
          </>
        )}
        <span><span style={{ color: `rgb(${FLAT})` }}>●</span> {he ? 'רגיל' : 'typical'}</span>
        <span>┄ {he ? 'ללא נתונים' : 'no data'}</span>
        {pts.some(p => p.day.excluded) && <span>{he ? '◌ מחוץ לחישוב' : '◌ left out'}</span>}
      </div>
    </div>
  );
}
