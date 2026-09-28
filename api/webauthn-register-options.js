// Step 1 of registering this device's Face ID/fingerprint (a WebAuthn
// "platform authenticator") for an already-logged-in user. Called right
// after a successful code login, once the user agrees to "connect this
// device". Returns the options object for navigator.credentials.create()
// (via @simplewebauthn/browser's startRegistration()); the browser itself
// prompts for the biometric, so the fingerprint/face image never leaves
// the device - only a public key and a signed challenge do.
//
// expectedOrigin/expectedRPID for the matching verify step are derived from
// THIS request's own Origin header (not hardcoded), and stored alongside
// the challenge so verification later reuses the exact same values.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generateRegistrationOptions } from '@simplewebauthn/server';

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
  if (!userId || !code) return res.status(400).json({ error: 'missing userId or code' });

  const origin = req.headers.origin;
  if (!origin) return res.status(400).json({ error: 'missing Origin header' });
  let rpID;
  try {
    rpID = new URL(origin).hostname;
  } catch {
    return res.status(400).json({ error: 'invalid Origin header' });
  }

  try {
    const userSnap = await db.collection('users').doc(userId).get();
    const user = userSnap.data();
    // The caller just logged in with `code` client-side - re-verifying it
    // matches this exact userId here stops a stranger who only knows (or
    // guesses) a userId from registering a biometric credential for an
    // account that isn't theirs.
    if (!user || user.code !== code) {
      return res.status(403).json({ error: 'not authorized' });
    }

    const existingCreds = await db.collection('webauthn_credentials').where('userId', '==', userId).get();
    const excludeCredentials = existingCreds.docs.map(d => ({
      id: d.id,
      transports: d.data().transports || undefined
    }));

    const options = await generateRegistrationOptions({
      rpName: 'אוהל בוס',
      rpID,
      userName: user.code,
      userID: new TextEncoder().encode(userId),
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials,
      // 'platform' restricts this to the device's own built-in sensor
      // (Face ID / Touch ID / Android fingerprint), not a USB security key.
      authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' }
    });

    await db.collection('webauthn_challenges').doc(userId).set({
      challenge: options.challenge,
      origin,
      rpID,
      type: 'registration',
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return res.status(200).json({ options });
  } catch (e) {
    return res.status(502).json({ error: 'failed to start registration: ' + e.message });
  }
}
