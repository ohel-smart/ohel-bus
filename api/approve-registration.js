// Approves a pending self-registration request (creates the real User doc +
// deletes the pending_registrations doc) entirely server-side, in one atomic
// Firestore batch write.
//
// This used to happen as two separate client-side Firestore calls, wrapped in
// a client-side setTimeout-based timeout race for safety. That guard doesn't
// actually help against the real-world failure mode: a browser tab that gets
// backgrounded (the admin switches apps, the phone screen locks) mid-approval
// has its JS timers throttled by the OS/browser - including the "safety"
// timeout itself, which relies on the exact same setTimeout mechanism as the
// real operation it's meant to catch. The result was a silently stuck pending
// card with no feedback, reproduced live. Doing the actual writes server-side
// removes the browser tab's lifecycle from the equation entirely - once this
// request is sent, it completes independently of whether the admin's tab
// stays in the foreground. The atomic batch also removes the earlier
// create-then-delete race entirely: either both writes land, or neither does.

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const db = getDb();
  if (!db) return res.status(500).json({ error: 'FIREBASE_KEY not configured' });

  const body = req.body || {};
  const pendingId = String(body.pendingId || '').trim();
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const role = body.role === 'driver' || body.role === 'dispatcher' ? body.role : '';
  const code = String(body.code || '').trim();
  const capacity = Number.isFinite(body.capacity) ? body.capacity : undefined;
  const isBigBus = !!body.isBigBus;

  if (!pendingId || !name || !phone || !role || !code) {
    return res.status(400).json({ error: 'missing required fields (pendingId, name, phone, role, code)' });
  }

  try {
    const pendingRef = db.collection('pending_registrations').doc(pendingId);
    const pendingSnap = await pendingRef.get();
    if (!pendingSnap.exists) {
      return res.status(404).json({ error: 'pending registration not found - it may already have been approved or rejected' });
    }

    const dupSnap = await db.collection('users').where('code', '==', code).limit(1).get();
    if (!dupSnap.empty) {
      return res.status(409).json({ error: 'code already in use by another user' });
    }

    const roleSuffix = role === 'driver' ? ' (נהג)' : ' (סדרן)';
    const userId = 'usr_' + Math.random().toString(36).slice(2, 11);
    const userRef = db.collection('users').doc(userId);

    const userDoc = {
      id: userId,
      name: name + roleSuffix,
      phone,
      role,
      code,
      createdAt: new Date().toISOString()
    };
    if (role === 'driver') {
      userDoc.capacity = capacity;
      userDoc.isBigBus = isBigBus;
    }

    // Atomic: either both writes land, or neither does - no partial state
    // where a user exists but the pending request wasn't cleaned up, or vice versa.
    const batch = db.batch();
    batch.set(userRef, userDoc);
    batch.delete(pendingRef);
    await batch.commit();

    return res.status(200).json({ ok: true, userId, name: userDoc.name });
  } catch (e) {
    return res.status(502).json({ error: 'approval failed: ' + e.message });
  }
}
