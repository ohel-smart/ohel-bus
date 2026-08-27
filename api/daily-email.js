// Emails the manager a daily rides summary via Resend, self-triggered - not
// invoked by Vercel Cron (Hobby plan only allows once/day with up to ±59min of
// imprecision - see https://vercel.com/docs/cron-jobs/usage-and-pricing) and
// deliberately NOT invoked by the WhatsApp bot (separate repo) either, so this
// stays independent of that service's uptime. Instead, a GitHub Actions
// workflow (.github/workflows/daily-email-trigger.yml) pings this endpoint
// every few minutes; the function itself decides whether "now" is actually
// this day's trigger moment and no-ops otherwise. Reads ride data from
// Firestore (same source the app uses).

import { HDate, Location, Zmanim, isAssurBemlacha } from '@hebcal/core';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_KEY) return null;
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_KEY))
    });
  }
  return getFirestore();
}

// Hebrew date (niqqud stripped) via @hebcal/core — reliable regardless of the
// serverless runtime's ICU build, unlike Intl's 'he-IL-u-ca-hebrew'.
function hebrewDateOf(dateStr) {
  try {
    return new HDate(new Date(dateStr + 'T12:00:00')).renderGematriya().replace(/[֑-ׇ]/g, '');
  } catch {
    return '';
  }
}

// YYYY-MM-DD for a moment, in New York time (matches the app's logicalDate).
function nyDateStr(d) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const g = t => parts.find(x => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function prevDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// The UTC instant for a given HH:MM wall-clock moment in New York on `dateStr`.
function nyTimeUTC(dateStr, hour, minute) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  const offsetPart = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
    .formatToParts(utcGuess).find(p => p.type === 'timeZoneName').value; // e.g. "GMT-4"
  const offsetHours = parseInt((offsetPart.match(/GMT([+-]\d+)/) || [, '-4'])[1], 10);
  return new Date(utcGuess.getTime() - offsetHours * 3600000);
}

const NY_LOCATION = new Location(40.6690, -73.9429, false, 'America/New_York', 'Crown Heights', 'US');

// On Erev Shabbat/Erev Yom Tov, today's trigger moment is 15 minutes before
// sunset; otherwise it's 23:59 New York time. Mirrors getEarlyCutover in
// src/services/db.ts (the site's own logicalDate boundary) - independently
// reimplemented here (and again in the WhatsApp bot's index.js) since none of
// these three runtimes share code with each other.
function getTodaysTriggerMoment(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Local-constructed on purpose: Zmanim only reads the Y/M/D fields off this
    // Date (hours are ignored), and building it via the local constructor makes
    // those fields round-trip correctly regardless of the runtime's own timezone.
    const dayRef = new Date(y, m - 1, d);
    const sunset = new Zmanim(NY_LOCATION, dayRef, false).sunset();
    const justBefore = new Date(sunset.getTime() - 60000);
    const justAfter = new Date(sunset.getTime() + 60000);
    // Erev Shabbat/Erev Yom Tov = melacha becomes newly prohibited at tonight's
    // sunset (not already prohibited beforehand, e.g. this being Shabbat/Yom Tov
    // itself running into the evening doesn't count).
    if (!isAssurBemlacha(justBefore, NY_LOCATION, false) && isAssurBemlacha(justAfter, NY_LOCATION, false)) {
      return new Date(sunset.getTime() - 15 * 60000);
    }
  } catch { /* fall back to the 23:59 default below on any calculation error */ }
  return nyTimeUTC(dateStr, 23, 59);
}

const esc = v => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export default async function handler(req, res) {
  // Only an automated trigger (our GitHub Actions pinger, or an explicit
  // ?key=CRON_SECRET) may cause a send.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'] || '';
  const ua = req.headers['user-agent'] || '';
  const allowed = secret
    ? (auth === `Bearer ${secret}` || req.query.key === secret)
    : ua.includes('vercel-cron');
  if (!allowed) return res.status(403).json({ error: 'forbidden' });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.MANAGER_EMAIL;
  if (!apiKey || !to) return res.status(500).json({ error: 'email not configured (RESEND_API_KEY / MANAGER_EMAIL)' });

  const db = getDb();
  if (!db) return res.status(500).json({ error: 'FIREBASE_KEY not configured' });

  const stateRef = db.collection('bot_state').doc('daily_email');
  const stateSnap = await stateRef.get();
  const lastSent = stateSnap.exists ? stateSnap.data().lastEmailDate : null;

  const today = nyDateStr(new Date());
  const yesterday = prevDateStr(today);

  // Yesterday's own trigger moment necessarily already passed - it was up to a
  // full day ago. If it was never sent, catch up on it now, whatever time it
  // happens to be. This is the actual fix: the old version only compared
  // `now` against *today's* freshly-recomputed trigger moment, which gave a
  // real send window of about ONE MINUTE per day (between 23:59 NY and the
  // midnight rollover a minute later, after which `target` silently became
  // tomorrow's date and that day's email was skipped forever). GitHub
  // Actions' cron pings routinely land 30-90+ minutes apart on this repo
  // (not the configured 10 - see workflow comment), so that one-minute
  // window was being missed almost every night.
  let target;
  if (lastSent !== yesterday) {
    target = yesterday;
  } else {
    const triggerMoment = getTodaysTriggerMoment(today);
    if (Date.now() < triggerMoment.getTime()) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'not yet time', date: today, triggerMoment: triggerMoment.toISOString() });
    }
    if (lastSent === today) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'already sent for this date', date: today });
    }
    target = today;
  }

  let dayScans = [];
  try {
    const snap = await db.collection('scans').where('logicalDate', '==', target).get();
    dayScans = snap.docs.map(d => d.data());
  } catch (e) {
    return res.status(502).json({ error: 'failed to fetch data: ' + e.message });
  }
  let totalPassengers = 0;
  // Map name -> set of origins they departed from, so the summary shows WHERE each one left from.
  const drivers = new Map(), dispatchers = new Map();
  for (const s of dayScans) {
    const n = parseInt(s.passengersCount, 10); if (!isNaN(n)) totalPassengers += n;
    const origin = s.departureLocation === '770' ? '770' : 'אוהל';
    const dn = String(s.driverName || '').replace(' (נהג)', '').trim();
    if (dn) { if (!drivers.has(dn)) drivers.set(dn, new Set()); drivers.get(dn).add(origin); }
    const ds = String(s.dispatcherName || '').replace(' (סדרן)', '').trim();
    if (ds && ds !== 'דיווח עצמי') { if (!dispatchers.has(ds)) dispatchers.set(ds, new Set()); dispatchers.get(ds).add(origin); }
  }
  const formatWithOrigins = m => [...m.entries()].map(([name, origins]) => `${name} (${[...origins].join(', ')})`).join(', ') || 'אין';
  const totalRides = dayScans.length;
  const hebrewDate = hebrewDateOf(target);

  // Brand palette (matches the driver PDF report) — inlined per-element since
  // email clients don't reliably support CSS custom properties or <style> classes.
  const GOLD = '#b9872f', GOLD_BG = '#fbf3e3', INK = '#1a1a1a', MUTED = '#6b6b6b', BORDER = '#e3d9c4';

  const rows = dayScans.map((s, i) => `<tr style="background:${i % 2 === 1 ? '#faf7f0' : '#ffffff'};">
    <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};">${esc(String(s.driverName || '—').replace(' (נהג)', ''))}</td>
    <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};color:${GOLD};font-weight:700;">${s.departureLocation === '770' ? '770' : 'אוהל'}</td>
    <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};text-align:center;">${esc(s.passengersCount ?? '—')}</td>
    <td style="padding:8px 10px;border-bottom:1px solid ${BORDER};">${esc(String(s.dispatcherName || '—').replace(' (סדרן)', ''))}</td>
  </tr>`).join('');

  const statCard = (value, label) => `<td style="background:${GOLD_BG};border:1px solid ${BORDER};border-radius:10px;padding:14px 18px;" width="50%">
    <div style="font-size:24px;font-weight:800;color:${INK};line-height:1.2;">${value}</div>
    <div style="font-size:12px;color:${MUTED};margin-top:4px;">${label}</div>
  </td>`;

  const html = `<div dir="rtl" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:${INK};background:#ffffff;padding:32px;">
    <table role="presentation" width="100%" style="border-collapse:collapse;border-bottom:3px solid ${GOLD};padding-bottom:16px;margin-bottom:20px;">
      <tr>
        <td style="padding-bottom:16px;" width="60">
          <img src="https://ohel-bus.vercel.app/logo-dark.png" alt="Ohel Smart" width="44" height="44" style="display:block;height:44px;width:auto;">
        </td>
        <td style="padding-bottom:16px;padding-inline-start:16px;">
          <div style="font-size:20px;font-weight:700;color:${INK};">📊 סיכום נסיעות יומי</div>
          <div style="font-size:15px;font-weight:700;color:${GOLD};margin-top:2px;">${target}${hebrewDate ? ' · ' + hebrewDate : ''}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:12px 0;margin-bottom:12px;">
      <tr>${statCard(totalRides, '🚗 סה"כ נסיעות')}${statCard(totalPassengers, '👥 סה"כ אנשים שנסעו')}</tr>
    </table>
    <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:12px 0;margin-bottom:22px;">
      <tr>${statCard(drivers.size, '👨‍✈️ נהגים פעילים')}${statCard(dispatchers.size, '👤 סדרנים פעילים')}</tr>
    </table>

    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:8px;">
      <tr><td style="color:${MUTED};padding:2px 0;"><b style="color:${INK};">נהגים:</b> ${esc(formatWithOrigins(drivers))}</td></tr>
      <tr><td style="color:${MUTED};padding:2px 0;"><b style="color:${INK};">סדרנים:</b> ${esc(formatWithOrigins(dispatchers))}</td></tr>
    </table>

    ${totalRides ? `<table role="presentation" style="border-collapse:collapse;width:100%;font-size:12.5px;margin-top:14px;">
      <thead><tr style="background:${INK};color:#ffffff;">
        <th style="padding:9px 10px;font-weight:600;text-align:right;">נהג</th>
        <th style="padding:9px 10px;font-weight:600;text-align:right;">מוצא</th>
        <th style="padding:9px 10px;font-weight:600;text-align:center;">אנשים</th>
        <th style="padding:9px 10px;font-weight:600;text-align:right;">סדרן</th>
      </tr></thead><tbody>${rows}</tbody></table>` : `<p style="text-align:center;color:${MUTED};padding:20px;">לא היו נסיעות ביום זה.</p>`}

    <p style="color:${MUTED};font-size:11px;text-align:center;margin-top:24px;">הופק אוטומטית ממערכת אוהל בוס</p>
  </div>`;

  try {
    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Ohel Bus <onboarding@resend.dev>',
        to: to.split(',').map(x => x.trim()),
        subject: `סיכום נסיעות יומי - אוהל בוס (${target}${hebrewDate ? ' | ' + hebrewDate : ''})`,
        html
      })
    });
    const body = await er.text();
    if (!er.ok) return res.status(502).json({ error: 'resend failed', status: er.status, body });
    await stateRef.set({ lastEmailDate: target }, { merge: true });
    return res.status(200).json({ ok: true, date: target, totalRides, totalPassengers });
  } catch (e) {
    return res.status(502).json({ error: 'send failed: ' + e.message });
  }
}
