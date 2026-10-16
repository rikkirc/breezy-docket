import type { FirebaseOptions } from 'firebase/app'

/**
 * The Firebase project behind accounts (Firebase console → Project settings → Your apps → Web app → Config).
 * These values are not secret: every Firebase web app ships them. Access is controlled by firestore.rules
 * and the authorized domains. Set this to null to turn accounts off. See docs/ACCOUNTS.md.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyABK-G8XBUEYiSPY4xLgKOw1XdR_VjQ_jU',
  authDomain: 'curriculum-organizer-ce412.firebaseapp.com',
  projectId: 'curriculum-organizer-ce412',
  storageBucket: 'curriculum-organizer-ce412.firebasestorage.app',
  messagingSenderId: '366778320824',
  appId: '1:366778320824:web:84436f2d8de3882bf8314d',
}
