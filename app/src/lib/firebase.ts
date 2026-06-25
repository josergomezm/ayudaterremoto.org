import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'

// Admin-tier auth only (Google Sign-In). The field tier (civilian/responder) does
// NOT use Firebase — it stays on the offline Cédula soft-gate + device token.
const app = initializeApp({
  apiKey: 'AIzaSyDdhq_Jo1CmWsrAmV5oO24V08KXcwIssxs',
  authDomain: 'ayudaterremotovenezuela.firebaseapp.com',
  projectId: 'ayudaterremotovenezuela',
  storageBucket: 'ayudaterremotovenezuela.firebasestorage.app',
  messagingSenderId: '255058191174',
  appId: '1:255058191174:web:85dc8ed2b8920f2eeebb47',
  measurementId: 'G-GKZYSEHZ7F',
})

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export let analytics: Analytics | null = null

if (import.meta.env.DEV) {
  // The Auth emulator intercepts the Google popup and shows a fake account
  // chooser — so sign-in works locally with no real Google credentials.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
} else {
  // Initialize analytics only in production when supported (prevents errors on Capacitor/custom environments)
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app)
    }
  }).catch((err) => {
    console.warn('Firebase Analytics is not supported in this environment:', err)
  })
}
