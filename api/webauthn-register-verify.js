// Step 2 of registering this device's Face ID/fingerprint - verifies the
// attestation the browser returned from navigator.credentials.create()
// against the challenge webauthn-register-options.js stored, and on
// success saves the new credential (public key only, never the biometric
// itself) so this device can log this user in without the numeric code.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

function getDb() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_KEY) return null;
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_KEY)) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const db = getDb();
  if (!db) return res.status(500).json({ error: 'FIREBASE_KEY not configured' });

  const userId = String(req.body?.userId || '').trim();
  const code = String(req.body?.code || '').trim();
  const response = req.body?.response;
  if (!userId || !code || !response) return res.status(400).json({ error: 'missing userId, code or response' });

  try {
    const userSnap = await db.collection('users').doc(userId).get();
    const user = userSnap.data();
    if (!user || user.code !== code) {
      return res.status(403).json({ error: 'not authorized' });
    }

    const challengeSnap = await db.collection('webauthn_challenges').doc(userId).get();
    const challengeDoc = challengeSnap.data();
    if (!challengeDoc || challengeDoc.type !== 'registration' || Date.now() > challengeDoc.expiresAt) {
      return res.status(400).json({ error: 'registration challenge expired or missing - try again' });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeDoc.challenge,
      expectedOrigin: challengeDoc.origin,
      expectedRPID: challengeDoc.rpID
    });

    await db.collection('webauthn_challenges').doc(userId).delete();

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'could not verify registration' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await db.collection('webauthn_credentials').doc(credential.id).set({
      userId,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: credential.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'registration verification failed: ' + e.message });
  }
}
