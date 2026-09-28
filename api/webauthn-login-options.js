// Step 1 of logging in with Face ID/fingerprint instead of the numeric
// code - the client already knows which userId this device was previously
// registered for (saved in its own localStorage after a successful
// webauthn-register-verify), so no code is needed here; the biometric
// check itself IS the authentication.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

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
  if (!userId) return res.status(400).json({ error: 'missing userId' });

  const origin = req.headers.origin;
  if (!origin) return res.status(400).json({ error: 'missing Origin header' });
  let rpID;
  try {
    rpID = new URL(origin).hostname;
  } catch {
    return res.status(400).json({ error: 'invalid Origin header' });
  }

  try {
    const credsSnap = await db.collection('webauthn_credentials').where('userId', '==', userId).get();
    if (credsSnap.empty) {
      return res.status(404).json({ error: 'no biometric credential registered for this device' });
    }
    const allowCredentials = credsSnap.docs.map(d => ({
      id: d.id,
      transports: d.data().transports || undefined
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'required'
    });

    await db.collection('webauthn_challenges').doc(userId).set({
      challenge: options.challenge,
      origin,
      rpID,
      type: 'authentication',
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.status(200).json({ options });
  } catch (e) {
    return res.status(502).json({ error: 'failed to start authentication: ' + e.message });
  }
}
