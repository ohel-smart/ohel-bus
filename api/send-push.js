// Sends a push notification from the manager to chosen people and/or whole groups.
//   body: { adminCode, title, body, groups?: ['drivers'|'dispatchers'|'admins'], userIds?: string[] }
// Only an admin may call it (same check as api/save-user.js). Uses data-only FCM messages; the
// service worker (public/firebase-messaging-sw.js) turns them into the visible notification.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function getDb() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_KEY) return null;
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_KEY)) });
  }
  return getFirestore();
}

const GROUP_ROLE = { dispatchers: 'dispatcher', admins: 'admin' };
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const db = getDb();
  if (!db) return res.status(500).json({ error: 'FIREBASE_KEY not configured' });

  const body = req.body || {};
  const adminCode = String(body.adminCode || '').trim();
  const title = String(body.title || '').trim().slice(0, 80);
  const text = String(body.body || '').trim().slice(0, 500);
  const groups = Array.isArray(body.groups) ? body.groups.filter((g) => GROUP_ROLE[g]) : [];
  const pickedIds = Array.isArray(body.userIds) ? body.userIds.map(String).slice(0, 500) : [];

  if (!adminCode) return res.status(401).json({ error: 'missing adminCode' });
  if (!title || !text) return res.status(400).json({ error: 'title and body are required' });
  if (!groups.length && !pickedIds.length) return res.status(400).json({ error: 'no recipients chosen' });

  try {
    const adminSnap = await db.collection('users').where('code', '==', adminCode).limit(1).get();
    if (adminSnap.docs[0]?.data().role !== 'admin') return res.status(403).json({ error: 'not authorized' });

    const adminDoc = adminSnap.docs[0];

    // Who is meant: the chosen groups (by role) plus the individually picked people.
    const all = await db.collection('users').get();
    const known = new Map(all.docs.filter((d) => d.data().role === 'admin' || d.data().role === 'dispatcher').map((d) => [d.id, { name: String(d.data().name || ''), role: String(d.data().role || '') }]));
    const recipients = new Set(pickedIds.filter((id) => known.has(id)));
    const roles = new Set(groups.map((g) => GROUP_ROLE[g]));
    known.forEach((u, id) => { if (roles.has(u.role)) recipients.add(id); });

    const devices = [];
    for (const ids of chunk([...recipients], 30)) {
      const snap = await db.collection('push_devices').where('userId', 'in', ids).get();
      snap.docs.forEach((d) => devices.push({ docId: d.id, userId: d.data().userId, token: d.data().token }));
    }

    const perUser = new Map([...recipients].map((id) => [id, { userId: id, name: known.get(id).name, role: known.get(id).role, devices: 0, sent: 0, failed: 0 }]));
    devices.forEach((d) => { perUser.get(d.userId).devices += 1; });

    let sent = 0;
    let failed = 0;
    const dead = [];
    for (const part of chunk(devices, 500)) {
      const result = await getMessaging().sendEach(part.map((d) => ({
        token: d.token,
        data: { title, body: text, url: '/?inbox=1' },
        webpush: { headers: { Urgency: 'high', TTL: '86400' } },
      })));
      result.responses.forEach((r, i) => {
        const row = perUser.get(part[i].userId);
        if (r.success) { sent += 1; row.sent += 1; }
        else {
          failed += 1;
          row.failed += 1;
          if (DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(part[i]);
          else console.warn('push failed', r.error?.code);
        }
      });
    }

    // A token the browser no longer knows is dropped, so it is not tried again.
    for (const d of dead) {
      await db.collection('push_devices').doc(d.docId).delete();
      await db.collection('push_status').doc(d.userId).set({ devices: FieldValue.increment(-1), updatedAt: new Date().toISOString() }, { merge: true });
    }

    const reachable = [...perUser.values()].filter((u) => u.devices > 0).length;
    const logRef = db.collection('push_log').doc();
    await logRef.set({
      id: logRef.id,
      title,
      body: text,
      sentAt: new Date().toISOString(),
      sentBy: { id: adminDoc.id, name: String(adminDoc.data().name || '') },
      groups,
      pickedCount: pickedIds.length,
      recipients: recipients.size,
      reachable,
      sent,
      failed,
      removed: dead.length,
      results: [...perUser.values()].slice(0, 300),
    });

    // Each recipient's own inbox (what the app shows when the notification is tapped): newest first, last 30.
    try {
      const sentAt = new Date().toISOString();
      const refs = [...recipients].map((id) => db.collection('push_inbox').doc(id));
      const current = refs.length ? await db.getAll(...refs) : [];
      const batch = db.batch();
      current.forEach((snap, i) => {
        const items = [{ id: logRef.id, title, body: text, sentAt }, ...((snap.exists && snap.data().items) || [])].slice(0, 30);
        batch.set(refs[i], { items, updatedAt: sentAt });
      });
      await batch.commit();
    } catch (e) {
      console.error('push inbox write failed', e);
    }

    return res.status(200).json({ ok: true, id: logRef.id, recipients: recipients.size, reachable, sent, failed, removed: dead.length });
  } catch (e) {
    console.error('send-push failed', e);
    return res.status(500).json({ error: 'server error' });
  }
}
