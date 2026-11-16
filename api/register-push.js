// Stores / removes the push-notification token of one device next to the person signed in on it.
// Tokens live in `push_devices` (written only here, via firebase-admin - the security rules should
// keep clients out of that collection); `push_status/{userId}` holds just a device count, which the
// admin's send screen reads to show who can receive notifications.

import { createHash } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getDb() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_KEY) return null;
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_KEY)) });
  }
  return getFirestore();
}

const MAX_DEVICES_PER_USER = 5;
const docIdOf = (token) => createHash('sha256').update(token).digest('hex').slice(0, 40);

async function refreshStatus(db, userId) {
  const snap = await db.collection('push_devices').where('userId', '==', userId).get();
  await db.collection('push_status').doc(userId).set({ devices: snap.size, updatedAt: new Date().toISOString() });
  return snap;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const db = getDb();
  if (!db) return res.status(500).json({ error: 'FIREBASE_KEY not configured' });

  const body = req.body || {};
  const code = String(body.code || '').trim();
  const token = String(body.token || '').trim();
  if (!code || token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'missing code or token' });

  try {
    const userSnap = await db.collection('users').where('code', '==', code).limit(1).get();
    const userDoc = userSnap.docs[0];
    if (!userDoc) return res.status(403).json({ error: 'not authorized' });
    const user = userDoc.data();
    const ref = db.collection('push_devices').doc(docIdOf(token));

    if (body.action === 'remove') {
      const existing = await ref.get();
      if (existing.exists && existing.data().userId === userDoc.id) {
        await ref.delete();
        await refreshStatus(db, userDoc.id);
      }
      return res.status(200).json({ ok: true });
    }

    const now = new Date().toISOString();
    const existing = await ref.get();
    const previousOwner = existing.exists ? existing.data().userId : null;
    await ref.set({
      userId: userDoc.id,
      userName: String(user.name || ''),
      role: String(user.role || ''),
      token,
      device: String(body.device || '').slice(0, 80),
      createdAt: existing.exists ? existing.data().createdAt || now : now,
      lastSeenAt: now,
    });

    const mine = await refreshStatus(db, userDoc.id);
    // Keep the newest few devices per person; a phone that was replaced simply ages out.
    if (mine.size > MAX_DEVICES_PER_USER) {
      const oldest = mine.docs
        .map((d) => ({ id: d.id, seen: String(d.data().lastSeenAt || '') }))
        .sort((a, b) => a.seen.localeCompare(b.seen))
        .slice(0, mine.size - MAX_DEVICES_PER_USER);
      await Promise.all(oldest.map((o) => db.collection('push_devices').doc(o.id).delete()));
      await refreshStatus(db, userDoc.id);
    }
    // A shared phone that another person signed in on: the previous owner no longer has it.
    if (previousOwner && previousOwner !== userDoc.id) await refreshStatus(db, previousOwner);

    return res.status(200).json({ ok: true, userId: userDoc.id });
  } catch (e) {
    console.error('register-push failed', e);
    return res.status(500).json({ error: 'server error' });
  }
}
