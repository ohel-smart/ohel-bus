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

    const options = await generateRegistrationOptions({
      rpName: 'אוהל בוס',
      rpID,
      // The device's own "sign in with..." sheet shows userName as the
      // account label - the raw login code isn't meaningful there, so use
      // the person's actual name for both fields.
      userName: user.name,
      userID: new TextEncoder().encode(userId),
      userDisplayName: user.name,
      attestationType: 'none',
      // Deliberately NOT passing excludeCredentials: it lists this user's
      // OTHER already-registered credentials so the browser can refuse to
      // recreate one it thinks it still has - but that check can require
      // Safari to confirm across every synced device (iCloud Keychain),
      // and if a stale Firestore doc outlives the person manually deleting
      // the matching Keychain entry on their phone, that cross-device check
      // is exactly what forced the "scan a QR code from another device"
      // fallback instead of a normal local Face ID prompt. This app only
      // ever keeps one credential per user anyway (see webauthn-register-
      // verify.js, which deletes any previous one on success), so there's
      // nothing worth excluding.
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
