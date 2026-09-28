// Step 2 of logging in with Face ID/fingerprint - verifies the assertion
// the browser returned from navigator.credentials.get() against the stored
// public key and challenge, then returns the full User doc so the client
// can log in exactly as it would after a normal code login.
//
// The identity that actually gets logged in comes from the CREDENTIAL's
// own stored userId (looked up by the credential id in the response, which
// is signed proof of possession), not from the client-supplied `userId` -
// that field is only used to find the matching challenge; a mismatch
// between the two is rejected rather than trusted.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';

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
  const response = req.body?.response;
  const credentialId = response?.id ? String(response.id) : '';
  if (!userId || !response || !credentialId) return res.status(400).json({ error: 'missing userId or response' });

  try {
    const challengeSnap = await db.collection('webauthn_challenges').doc(userId).get();
    const challengeDoc = challengeSnap.data();
    if (!challengeDoc || challengeDoc.type !== 'authentication' || Date.now() > challengeDoc.expiresAt) {
      return res.status(400).json({ error: 'authentication challenge expired or missing - try again' });
    }

    const credSnap = await db.collection('webauthn_credentials').doc(credentialId).get();
    const credDoc = credSnap.data();
    if (!credDoc || credDoc.userId !== userId) {
      return res.status(403).json({ error: 'credential does not match this device/user' });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeDoc.challenge,
      expectedOrigin: challengeDoc.origin,
      expectedRPID: challengeDoc.rpID,
      credential: {
        id: credentialId,
        publicKey: Buffer.from(credDoc.publicKey, 'base64'),
        counter: credDoc.counter,
        transports: credDoc.transports || undefined
      }
    });

    await db.collection('webauthn_challenges').doc(userId).delete();

    if (!verification.verified) {
      return res.status(400).json({ error: 'could not verify authentication' });
    }

    await db.collection('webauthn_credentials').doc(credentialId).update({
      counter: verification.authenticationInfo.newCounter
    });

    const userSnap = await db.collection('users').doc(userId).get();
    const user = userSnap.data();
    if (!user) return res.status(404).json({ error: 'user no longer exists' });

    return res.status(200).json({ ok: true, user });
  } catch (e) {
    return res.status(502).json({ error: 'authentication verification failed: ' + e.message });
  }
}
