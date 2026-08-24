// Emails the manager whenever someone submits the public self-registration
// form (…/join). Called directly by the client (RegisterRequest.tsx) right
// after it writes the pending_registrations doc to Firestore - this function
// doesn't touch Firestore itself, it only relays the submitted fields by email.

const esc = v => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.MANAGER_EMAIL;
  if (!apiKey || !to) return res.status(500).json({ error: 'email not configured (RESEND_API_KEY / MANAGER_EMAIL)' });

  const body = req.body || {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const role = body.role === 'driver' || body.role === 'dispatcher' ? body.role : '';
  if (!name || !phone || !role) return res.status(400).json({ error: 'missing required fields (name, phone, role)' });

  const capacity = Number.isFinite(body.capacity) ? body.capacity : null;
  const isBigBus = !!body.isBigBus;
  const roleLabel = role === 'driver' ? 'נהג' : 'סדרן';

  const GOLD = '#b9872f', GOLD_BG = '#fbf3e3', INK = '#1a1a1a', MUTED = '#6b6b6b', BORDER = '#e3d9c4';
  const row = (label, value) => `<tr><td style="padding:6px 0;color:${MUTED};font-size:13px;width:110px;">${label}</td><td style="padding:6px 0;color:${INK};font-size:13px;font-weight:700;">${esc(value)}</td></tr>`;

  const html = `<div dir="rtl" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:${INK};background:#ffffff;padding:32px;">
    <div style="border-bottom:3px solid ${GOLD};padding-bottom:16px;margin-bottom:20px;">
      <div style="font-size:20px;font-weight:700;">📝 בקשת הרשמה חדשה ממתינה לאישור</div>
    </div>
    <div style="background:${GOLD_BG};border:1px solid ${BORDER};border-radius:10px;padding:16px 18px;margin-bottom:16px;">
      <table role="presentation" width="100%" style="border-collapse:collapse;">
        ${row('שם', name)}
        ${row('טלפון', phone)}
        ${row('תפקיד', roleLabel)}
        ${role === 'driver' && capacity !== null ? row('מספר מקומות', String(capacity)) : ''}
        ${role === 'driver' ? row('אוטובוס גדול', isBigBus ? 'כן' : 'לא') : ''}
      </table>
    </div>
    <p style="color:${MUTED};font-size:13px;">כדי לאשר ולהנפיק קוד כניסה, היכנס לאפליקציה בתור מנהל ← לשונית "ניהול משתמשים" ← "בקשות הרשמה ממתינות".</p>
  </div>`;

  try {
    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Ohel Bus <onboarding@resend.dev>',
        to: to.split(',').map(x => x.trim()),
        subject: `בקשת הרשמה חדשה: ${name} (${roleLabel})`,
        html
      })
    });
    const respBody = await er.text();
    if (!er.ok) return res.status(502).json({ error: 'resend failed', status: er.status, body: respBody });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'send failed: ' + e.message });
  }
}
