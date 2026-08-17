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
  const drivers = new Set(), dispatchers = new Set();
  for (const s of dayScans) {
    const n = parseInt(s.passengersCount, 10); if (!isNaN(n)) totalPassengers += n;
    const dn = String(s.driverName || '').replace(' (נהג)', '').trim(); if (dn) drivers.add(dn);
    const ds = String(s.dispatcherName || '').replace(' (סדרן)', '').trim();
    if (ds && ds !== 'דיווח עצמי') dispatchers.add(ds);
  }
  const totalRides = dayScans.length;
  const hebrewDate = hebrewDateOf(target);

  const rows = dayScans.map(s => `<tr>
    <td style="padding:6px 10px;border:1px solid #ddd;">${esc(String(s.driverName || '—').replace(' (נהג)', ''))}</td>
    <td style="padding:6px 10px;border:1px solid #ddd;">${s.departureLocation === '770' ? '770' : 'אוהל'}</td>
    <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;">${esc(s.passengersCount ?? '—')}</td>
    <td style="padding:6px 10px;border:1px solid #ddd;">${esc(String(s.dispatcherName || '—').replace(' (סדרן)', ''))}</td>
  </tr>`).join('');

  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111;">
    <h2>📊 סיכום נסיעות יומי</h2>
    <p><b>תאריך לועזי:</b> ${target}<br><b>תאריך עברי:</b> ${hebrewDate}</p>
    <ul>
      <li>🚗 סה"כ נסיעות: <b>${totalRides}</b></li>
      <li>👥 סה"כ אנשים שנסעו: <b>${totalPassengers}</b></li>
      <li>👨‍✈️ נהגים פעילים: <b>${drivers.size}</b> (${esc([...drivers].join(', ') || 'אין')})</li>
      <li>👤 סדרנים פעילים: <b>${dispatchers.size}</b> (${esc([...dispatchers].join(', ') || 'אין')})</li>
    </ul>
    ${totalRides ? `<table style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead><tr style="background:#f3f3f3;">
        <th style="padding:6px 10px;border:1px solid #ddd;">נהג</th>
        <th style="padding:6px 10px;border:1px solid #ddd;">מוצא</th>
        <th style="padding:6px 10px;border:1px solid #ddd;">אנשים</th>
        <th style="padding:6px 10px;border:1px solid #ddd;">סדרן</th>
      </tr></thead><tbody>${rows}</tbody></table>` : '<p>לא היו נסיעות ביום זה.</p>'}
    <p style="color:#888;font-size:12px;margin-top:16px;">נשלח אוטומטית ממערכת אוהל בוס.</p>
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
