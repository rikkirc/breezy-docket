// Firebase sign-in and the student's plan document. Loaded only when accounts are used (dynamic import), so the
// app stays small for everyone else. Imports only Firebase and types, so the emulator tests can run it in Node.
import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  terminate,
  type Firestore,
} from 'firebase/firestore'
import type { CloudPlan } from '../lib/sync'

export interface Cloud {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

export interface AccountUser {
  uid: string
  email: string | null
  name: string | null
}

export function connect(config: FirebaseOptions, emulator?: { auth: string; firestoreHost: string; firestorePort: number }, name?: string): Cloud {
  const app = initializeApp(config, name)
  const auth = getAuth(app)
  const db = getFirestore(app)
  if (emulator) {
    connectAuthEmulator(auth, emulator.auth, { disableWarnings: true })
    connectFirestoreEmulator(db, emulator.firestoreHost, emulator.firestorePort)
  }
  return { app, auth, db }
}

export async function disconnect(cloud: Cloud): Promise<void> {
  await terminate(cloud.db)
  await deleteApp(cloud.app)
}

function toUser(user: User): AccountUser {
  return { uid: user.uid, email: user.email, name: user.displayName }
}

export function onUser(cloud: Cloud, callback: (user: AccountUser | null) => void): () => void {
  return onAuthStateChanged(cloud.auth, (user) => callback(user ? toUser(user) : null))
}

export async function signInWithGoogle(cloud: Cloud): Promise<AccountUser> {
  return toUser((await signInWithPopup(cloud.auth, new GoogleAuthProvider())).user)
}

export async function signInWithEmail(cloud: Cloud, email: string, password: string): Promise<AccountUser> {
  return toUser((await signInWithEmailAndPassword(cloud.auth, email, password)).user)
}

export async function createAccount(cloud: Cloud, email: string, password: string): Promise<AccountUser> {
  return toUser((await createUserWithEmailAndPassword(cloud.auth, email, password)).user)
}

export async function resetPassword(cloud: Cloud, email: string): Promise<void> {
  await sendPasswordResetEmail(cloud.auth, email)
}

export async function signOut(cloud: Cloud): Promise<void> {
  await firebaseSignOut(cloud.auth)
}

const planDoc = (cloud: Cloud, uid: string) => doc(cloud.db, 'plans', uid)

/** The raw stored plan, or null if the account has none yet. Check it with readCloudPlan before use. */
export async function loadPlan(cloud: Cloud, uid: string): Promise<unknown> {
  const snapshot = await getDoc(planDoc(cloud, uid))
  return snapshot.exists() ? withoutTimestamp(snapshot.data()) : null
}

/** Stores the plan, with the date the student agreed to the Privacy notice when there is one. */
export async function savePlan(cloud: Cloud, uid: string, plan: CloudPlan, consentedAt?: string | null): Promise<void> {
  await setDoc(planDoc(cloud, uid), { ...plan, ...(consentedAt ? { consentedAt } : {}), updatedAt: serverTimestamp() })
}

/** Calls back with plans saved from other devices (this device's own pending writes are skipped). */
export function watchPlan(cloud: Cloud, uid: string, callback: (plan: unknown) => void): () => void {
  return onSnapshot(planDoc(cloud, uid), (snapshot) => {
    if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return
    callback(withoutTimestamp(snapshot.data()))
  })
}

/** Deletes the student's stored plan and their account. */
export async function deleteAccount(cloud: Cloud, uid: string): Promise<void> {
  await deleteDoc(planDoc(cloud, uid))
  const user = cloud.auth.currentUser
  if (user) await deleteUser(user)
}

function withoutTimestamp(data: Record<string, unknown>): Record<string, unknown> {
  const { updatedAt: _, ...rest } = data
  return rest
}
