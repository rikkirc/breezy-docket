// Plain-language messages for the sign-in and sync errors students actually hit. No Firebase imports, so the
// sign-in screen doesn't load Firebase just for wording.
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match an account.',
  'auth/wrong-password': 'That email and password don’t match an account.',
  'auth/user-not-found': 'That email and password don’t match an account.',
  'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  unavailable: 'No connection. Check your internet and try again.',
  'auth/requires-recent-login': 'For your security, sign out, sign in again, then delete your account.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  // Firestore refused the save: usually the security rules in Firebase are older than the app.
  'permission-denied': 'Couldn’t save to your account (permission denied). Try again later; if it keeps happening, contact the app’s developer.',
  'auth/unauthorized-domain': 'Sign-in isn’t set up for this website yet (add it to Firebase’s authorized domains).',
}

export function describeAccountError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  if (MESSAGES[code]) return MESSAGES[code]
  return error instanceof Error && !code ? error.message : 'Something went wrong. Try again.'
}
