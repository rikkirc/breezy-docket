// The account code and the security rules, against the Firebase emulators (no real project). Run with:
//   npm run test:firebase      (needs Java; the first run downloads the emulators)
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  connect,
  createAccount,
  deleteAccount,
  disconnect,
  loadPlan,
  savePlan,
  signOut,
  watchPlan,
  type Cloud,
} from '../src/cloud/account.ts'

const PROJECT = 'demo-curriculum'
const emulator = { auth: 'http://127.0.0.1:9099', firestoreHost: '127.0.0.1', firestorePort: 8080 }
const opened: Cloud[] = []
let devices = 0
/** A separate device: its own Firebase app and sign-in. */
function device(): Cloud {
  const cloud = connect({ projectId: PROJECT, apiKey: 'demo-key', authDomain: `${PROJECT}.firebaseapp.com` }, emulator, `device${devices++}`)
  opened.push(cloud)
  return cloud
}
after(async () => {
  for (const cloud of opened) await disconnect(cloud)
})

const email = (name: string) => `${name}.${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`
const denied = (promise: Promise<unknown>) =>
  assert.rejects(promise, (e: { code?: string }) => e.code === 'permission-denied')

const plan = {
  version: 1 as const,
  curriculum: { program: { name: 'Test' }, subjects: [{ code: 'A', title: 'Alpha', units: 3, standard_year: 1, offered_sem: 1, prerequisites: [] }] },
  student: { unit_caps: { default: 12 }, next_term: { year: 1, sem: 1 }, results: [] },
  setupDone: true,
}

test('a student saves and loads their own plan', async () => {
  const d = device()
  const user = await createAccount(d, email('juan'), 'a good password')
  assert.equal(await loadPlan(d, user.uid), null)
  await savePlan(d, user.uid, plan)
  assert.deepEqual(await loadPlan(d, user.uid), plan)
})

test('another device signed in to the same account sees the changes', async () => {
  const phone = device()
  const laptop = device()
  const address = email('maria')
  const user = await createAccount(phone, address, 'a good password')
  const { signInWithEmail } = await import('../src/cloud/account.ts')
  await signInWithEmail(laptop, address, 'a good password')

  const seen = new Promise<unknown>((resolve) => {
    const stop = watchPlan(laptop, user.uid, (p) => {
      stop()
      resolve(p)
    })
  })
  await savePlan(phone, user.uid, plan)
  assert.deepEqual(await seen, plan)
})

test("nobody can read or change another student's plan", async () => {
  const owner = device()
  const ownerUser = await createAccount(owner, email('owner'), 'a good password')
  await savePlan(owner, ownerUser.uid, plan)

  const other = device()
  await createAccount(other, email('other'), 'a good password')
  await denied(getDoc(doc(other.db, 'plans', ownerUser.uid)))
  await denied(setDoc(doc(other.db, 'plans', ownerUser.uid), { ...plan }))
  await denied(getDocs(collection(other.db, 'plans')))

  const signedOut = device()
  await denied(getDoc(doc(signedOut.db, 'plans', ownerUser.uid)))
})

test('only the plan fields can be stored, with a server timestamp', async () => {
  const d = device()
  const user = await createAccount(d, email('shape'), 'a good password')
  await denied(setDoc(doc(d.db, 'plans', user.uid), { ...plan, extra: 'x' }))
  await denied(setDoc(doc(d.db, 'plans', user.uid), { ...plan, updatedAt: new Date(0) }))
  await denied(setDoc(doc(d.db, 'plans', user.uid), { ...plan, version: 2 }))
  await denied(setDoc(doc(d.db, 'other', 'thing'), { a: 1 }))
})

test('the date the student agreed to the Privacy notice can be stored with the plan, as a date string only', async () => {
  const d = device()
  const user = await createAccount(d, email('consent'), 'a good password')
  const agreedAt = '2026-10-16T09:30:00.000Z'
  await savePlan(d, user.uid, plan, agreedAt)
  assert.deepEqual(await loadPlan(d, user.uid), { ...plan, consentedAt: agreedAt })

  await denied(setDoc(doc(d.db, 'plans', user.uid), { ...plan, consentedAt: 20261016, updatedAt: serverTimestamp() }))
  await denied(setDoc(doc(d.db, 'plans', user.uid), { ...plan, consentedAt: '', updatedAt: serverTimestamp() }))
  await denied(setDoc(doc(d.db, 'plans', user.uid), { ...plan, consentedAt: 'x'.repeat(41), updatedAt: serverTimestamp() }))
  // Still only the owner
  const other = device()
  await createAccount(other, email('nosy'), 'a good password')
  await denied(setDoc(doc(other.db, 'plans', user.uid), { ...plan, consentedAt: agreedAt, updatedAt: serverTimestamp() }))
})

test('deleting the account deletes the stored plan', async () => {
  const d = device()
  const address = email('leaving')
  const user = await createAccount(d, address, 'a good password')
  await savePlan(d, user.uid, plan)
  await deleteAccount(d, user.uid)
  assert.equal(d.auth.currentUser, null)

  // Recreating an account with that email gets a new, empty one
  const again = await createAccount(d, address, 'a good password')
  assert.equal(await loadPlan(d, again.uid), null)
  await signOut(d)
})
