import type { FirebaseOptions } from 'firebase/app'

/**
 * The Firebase project behind accounts (Firebase console → Project settings → Your apps → Web app → Config).
 * These values are not secret: access is controlled by firestore.rules and the authorized domains.
 * While this is null the app works exactly as before, with no account option. See docs/ACCOUNTS.md.
 */
export const firebaseConfig: FirebaseOptions | null = null
