// Creates or updates a User doc entirely server-side, via firebase-admin.
//
// handleCreateUser/handleSaveEditUser in App.tsx used to do this as client-side
// Firestore calls (a fresh fetchDataFromSheets() read for the duplicate-code
// check, then a setDoc write) - the same pattern that, in the registration-
// approval flow, was proven to hang indefinitely with zero feedback whenever
// the browser tab lost timer/network priority (backgrounded, screen locked).
// Reproduced live here too, including on a simple admin-code edit. Doing the
// actual read+write server-side removes the browser tab's lifecycle from the
// equation entirely, same fix as api/approve-registration.js.

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

const ROLE_SUFFIX = { driver: ' (נהג)', dispatcher: ' (סדרן)', screen: ' (מסך)', admin: ' (מנהל)' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const db = getDb();
  if (!db) return res.status(500).json({ error: 'FIREBASE_KEY not configured' });

  const body = req.body || {};
  const userId = body.userId ? String(body.userId).trim() : null; // present = editing an existing user
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const role = ['driver', 'dispatcher', 'admin', 'screen'].includes(body.role) ? body.role : '';
  const code = String(body.code || '').trim();
  const capacity = Number.isFinite(body.capacity) ? body.capacity : undefined;
  const isBigBus = !!body.isBigBus;
  const canSelfReport = !!body.canSelfReport;

  // A screen isn't a real staff member - "phone" is a free-text location note
  // there instead, so it isn't required (mirrors the client-side rule).
  if (!name || !code || !role || (role !== 'screen' && !phone)) {
    return res.status(400).json({ error: 'missing required fields (name, phone, role, code)' });
  }

  try {
    const dupSnap = await db.collection('users').where('code', '==', code).limit(2).get();
    const hasConflict = dupSnap.docs.some(d => d.id !== userId);
    if (hasConflict) {
      return res.status(409).json({ error: 'code already in use by another user' });
    }

    const id = userId || ('usr_' + Math.random().toString(36).slice(2, 11));
    const userDoc = {
      id,
      name: name + (ROLE_SUFFIX[role] || ''),
      phone,
      role,
      code,
      createdAt: userId ? undefined : new Date().toISOString()
    };
    if (role === 'driver') {
      userDoc.capacity = capacity;
      userDoc.isBigBus = isBigBus;
      userDoc.canSelfReport = canSelfReport;
    }
    // Firestore rejects `undefined` field values - strip them (createdAt on
    // edits, capacity/isBigBus/canSelfReport for non-driver roles).
    Object.keys(userDoc).forEach(k => userDoc[k] === undefined && delete userDoc[k]);

    if (userId) {
      // Editing: merge so createdAt (and any other field this endpoint
      // doesn't know about) on the existing doc is preserved.
      await db.collection('users').doc(userId).set(userDoc, { merge: true });
    } else {
      await db.collection('users').doc(id).set(userDoc);
    }

    return res.status(200).json({ ok: true, userId: id, name: userDoc.name });
  } catch (e) {
    return res.status(502).json({ error: 'save failed: ' + e.message });
  }
}
