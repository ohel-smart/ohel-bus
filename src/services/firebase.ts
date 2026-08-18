import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB6D83wnOoA8oLWn5SFzIIpcbb-f454kDo',
  authDomain: 'ohel-smart.firebaseapp.com',
  projectId: 'ohel-smart',
  storageBucket: 'ohel-smart.firebasestorage.app',
  messagingSenderId: '48634858514',
  appId: '1:48634858514:web:bf105e7711b80319cb5ccb',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Resolves once an authenticated (anonymous) session is ready — every Firestore
// read/write must wait for this, since the security rules require request.auth != null.
export const authReady: Promise<void> = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve();
    } else {
      signInAnonymously(auth).catch((e) => console.error('Firebase anonymous sign-in failed:', e));
    }
  });
});
