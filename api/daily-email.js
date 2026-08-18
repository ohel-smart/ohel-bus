// Vercel Cron function — emails the manager the previous day's rides summary
// via Resend. Scheduled daily in vercel.json. Runs on the site's cloud (Vercel),
// which — unlike the free Render bot — never spins down, so the email is reliable.
// Reads the current ride data from the Apps Script endpoint (same source the app uses).

import { HDate } from '@hebcal/core';

const SHEETS_URL = process.env.SHEETS_URL ||
  "https://script.google.com/macros/s/AKfycbygfgRFNFwPqcX0XK3P9GNbYKWW89oSh1rCQ6k8WY6dEskVPYW0qkm8xuKXdwhpNLel/exec";

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

const esc = v => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export default async function handler(req, res) {
  // Only Vercel Cron (or an explicit ?key=CRON_SECRET) may trigger a send.
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

  // The day that just ended, in New York time.
  const target = nyDateStr(new Date(Date.now() - 6 * 3600 * 1000));

  let scans = [];
  try {
    const r = await fetch(SHEETS_URL + '?_t=' + Date.now());
    const data = await r.json();
    scans = Array.isArray(data.scans) ? data.scans : [];
  } catch (e) {
    return res.status(502).json({ error: 'failed to fetch data: ' + e.message });
  }

  const dayScans = scans.filter(s => String(s.logicalDate || '').slice(0, 10) === target);
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
    return res.status(200).json({ ok: true, date: target, totalRides, totalPassengers });
  } catch (e) {
    return res.status(502).json({ error: 'send failed: ' + e.message });
  }
}
