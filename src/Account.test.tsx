// @vitest-environment jsdom
// The account flow with an in-memory stand-in for Firebase (the real Firebase calls are tested against the
// emulator in scripts/test-firebase.ts).
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { demoStudent, jdCurriculum } from './data'
import { toCloudPlan } from './lib/sync'

vi.mock('./cloud/config', () => ({ firebaseConfig: { apiKey: 'test', projectId: 'test' }, emulator: undefined }))

// The stand-in "server": accounts, stored plans, and who is watching.
const server = vi.hoisted(() => ({
  accounts: new Map<string, { uid: string; password: string }>(),
  plans: new Map<string, unknown>(),
  userListeners: new Set<(user: { uid: string; email: string; name: null } | null) => void>(),
  planListeners: new Map<string, Set<(plan: unknown) => void>>(),
  current: null as { uid: string; email: string; name: null } | null,
}))

vi.mock('./cloud/account', () => {
  const setUser = (user: typeof server.current) => {
    server.current = user
    for (const l of server.userListeners) l(user)
  }
  return {
    connect: () => ({}),
    onUser: (_c: unknown, cb: (u: typeof server.current) => void) => {
      server.userListeners.add(cb)
      queueMicrotask(() => cb(server.current))
      return () => server.userListeners.delete(cb)
    },
    signInWithGoogle: async () => setUser({ uid: 'google-uid', email: 'student@gmail.com', name: null }),
    signInWithEmail: async (_c: unknown, email: string, password: string) => {
      const account = server.accounts.get(email)
      if (!account || account.password !== password) throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' })
      setUser({ uid: account.uid, email, name: null })
    },
    createAccount: async (_c: unknown, email: string, password: string) => {
      if (server.accounts.has(email)) throw Object.assign(new Error('dup'), { code: 'auth/email-already-in-use' })
      server.accounts.set(email, { uid: `uid-${email}`, password })
      setUser({ uid: `uid-${email}`, email, name: null })
    },
    resetPassword: async () => {},
    signOut: async () => setUser(null),
    loadPlan: async (_c: unknown, uid: string) => server.plans.get(uid) ?? null,
    savePlan: async (_c: unknown, uid: string, plan: object, consentedAt?: string | null) => {
      server.plans.set(uid, JSON.parse(JSON.stringify({ ...plan, ...(consentedAt ? { consentedAt } : {}) })))
    },
    watchPlan: (_c: unknown, uid: string, cb: (plan: unknown) => void) => {
      const set = server.planListeners.get(uid) ?? new Set()
      set.add(cb)
      server.planListeners.set(uid, set)
      return () => set.delete(cb)
    },
    deleteAccount: async (_c: unknown, uid: string) => {
      server.plans.delete(uid)
      setUser(null)
    },
  }
})

/** Another device saving the plan: the server stores it and tells this device. */
function remoteSave(uid: string, plan: unknown) {
  server.plans.set(uid, plan)
  for (const l of server.planListeners.get(uid) ?? []) l(plan)
}

beforeEach(() => {
  localStorage.clear()
  server.accounts.clear()
  server.plans.clear()
  server.userListeners.clear()
  server.planListeners.clear()
  server.current = null
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function tab(name: string) {
  return within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('button', { name })
}

const CONSENT = /I've read the Privacy notice and agree/

/** From the welcome page to the sign-in screen. */
async function getStarted(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Get started' }))
}

/** The plan as stored by someone who agreed to the Privacy notice before. */
const agreedPlan = () => ({ ...toCloudPlan(mine), consentedAt: '2026-10-01T08:00:00.000Z' })

/** Ticks "I've read the Privacy notice and agree…" on the sign-in screen. */
async function agree(user: UserEvent) {
  await user.click(await screen.findByRole('checkbox', { name: CONSENT }))
}

/** The plan as stored, without the agreement date. */
function storedPlan(uid: string) {
  const { consentedAt: _, ...plan } = server.plans.get(uid) as Record<string, unknown>
  return plan
}

async function createAccount(user: UserEvent, email: string) {
  const panel = await screen.findByRole('region', { name: 'Account' })
  await agree(user)
  await user.click(within(panel).getByRole('button', { name: 'Create an account' }))
  await user.type(within(panel).getByLabelText('Email'), email)
  await user.type(within(panel).getByLabelText('Password'), 'a good password')
  await user.click(within(panel).getByRole('button', { name: 'Create account' }))
}

const mine = { curriculum: jdCurriculum, student: demoStudent, isDemo: false, setupDone: true }

describe('accounts', () => {
  test('signing up uploads the plan on this device to the new account', async () => {
    localStorage.setItem('curriculum-organizer:v1', JSON.stringify(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await createAccount(user, 'juan@example.com')
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toHaveTextContent('juan@example.com'))
    await waitFor(() => expect(storedPlan('uid-juan@example.com')).toEqual(toCloudPlan(mine)))
    expect(screen.getByRole('status')).toHaveTextContent('Your plan is saved to your account.')
  })

  test('the app opens on a welcome page that says what it does and how to use it, then the sign-in screen', async () => {
    localStorage.setItem('curriculum-organizer:v1', JSON.stringify(mine))
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'What it does' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Breezy Docket' })).toBeInTheDocument()
    expect(screen.getByText('Breeze your way through every sem, all the way to graduation.')).toBeInTheDocument()
    expect(screen.getByText('by: RCbreezy©')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How to use it' })).toBeInTheDocument()
    expect(screen.getByText(/Record your past semesters first, in order, as they actually happened/)).toBeInTheDocument()
    expect(screen.getByText(/took 214 Corporation and Basic Securities Law in Year 2, 1st sem and failed it/)).toHaveTextContent(
      'Mark it Failed in Year 2, 1st sem, not Taking.',
    )
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
    expect(screen.queryByText('Expected graduation')).not.toBeInTheDocument()

    await getStarted(user)
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← About Breezy Docket' }))
    expect(screen.getByRole('heading', { name: 'What it does' })).toBeInTheDocument()
  })

  test('someone still signed in goes straight to the plan in their account', async () => {
    server.current = { uid: 'google-uid', email: 'student@gmail.com', name: null }
    server.plans.set('google-uid', agreedPlan())
    render(<App />)
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  test('creating an account or continuing with Google waits for the Privacy notice to be agreed; signing in does not', async () => {
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const panel = await screen.findByRole('region', { name: 'Account' })
    const google = within(panel).getByRole('button', { name: 'Continue with Google' })
    expect(google).toBeDisabled()
    // Signing in to an existing account doesn't need it
    expect(within(panel).getByRole('button', { name: 'Sign in' })).toBeEnabled()
    await user.click(within(panel).getByRole('button', { name: 'Create an account' }))
    expect(within(panel).getByRole('button', { name: 'Create account' })).toBeDisabled()

    await agree(user)
    expect(google).toBeEnabled()
    expect(within(panel).getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  test('the date the student agreed is saved with their plan, and kept on later saves', async () => {
    localStorage.setItem('curriculum-organizer:v1', JSON.stringify(mine))
    const before = Date.now()
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await createAccount(user, 'ana@example.com')
    await waitFor(() => expect(server.plans.get('uid-ana@example.com')).toHaveProperty('consentedAt'))
    const agreedAt = (server.plans.get('uid-ana@example.com') as { consentedAt: string }).consentedAt
    expect(Date.parse(agreedAt)).toBeGreaterThanOrEqual(before - 1000)
    expect(Date.parse(agreedAt)).toBeLessThanOrEqual(Date.now())

    // An edit saves the plan again: the agreement date stays
    await user.click(await screen.findByRole('button', { name: 'Not this sem: move 301 to Year 4, 1st sem' }))
    await waitFor(() => expect((server.plans.get('uid-ana@example.com') as { student: { placed?: object } }).student.placed).toEqual({ '301': 'Y4-1' }), { timeout: 3000 })
    expect(server.plans.get('uid-ana@example.com')).toHaveProperty('consentedAt', agreedAt)
  })

  test('signing in with email to an account that agreed before keeps that date', async () => {
    server.accounts.set('juan@example.com', { uid: 'uid-juan', password: 'pw123456' })
    server.plans.set('uid-juan', { ...toCloudPlan(mine), consentedAt: '2026-10-01T08:00:00.000Z' })
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const panel = await screen.findByRole('region', { name: 'Account' })
    await user.type(within(panel).getByLabelText('Email'), 'juan@example.com')
    await user.type(within(panel).getByLabelText('Password'), 'pw123456')
    await user.click(within(panel).getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Not this sem: move 301 to Year 4, 1st sem' }))
    await waitFor(() => expect((server.plans.get('uid-juan') as { student: { placed?: object } }).student.placed).toEqual({ '301': 'Y4-1' }), { timeout: 3000 })
    expect(server.plans.get('uid-juan')).toHaveProperty('consentedAt', '2026-10-01T08:00:00.000Z')
  })

  test('an agreement recorded on another device is kept by saves from this one', async () => {
    server.accounts.set('juan@example.com', { uid: 'uid-juan', password: 'pw123456' })
    server.plans.set('uid-juan', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const panel = await screen.findByRole('region', { name: 'Account' })
    await user.type(within(panel).getByLabelText('Email'), 'juan@example.com')
    await user.type(within(panel).getByLabelText('Password'), 'pw123456')
    await user.click(within(panel).getByRole('button', { name: 'Sign in' }))
    // No agreement yet, so the prompt shows; then another device records one, and the prompt goes away
    expect(await screen.findByRole('heading', { name: 'Please review the Privacy notice' })).toBeInTheDocument()
    act(() => remoteSave('uid-juan', { ...toCloudPlan(mine), consentedAt: '2026-10-16T10:00:00.000Z' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Not this sem: move 301 to Year 4, 1st sem' }))
    await waitFor(() => expect((server.plans.get('uid-juan') as { student: { placed?: object } }).student.placed).toEqual({ '301': 'Y4-1' }), { timeout: 3000 })
    expect(server.plans.get('uid-juan')).toHaveProperty('consentedAt', '2026-10-16T10:00:00.000Z')
  })

  test('continuing with Google records the agreement on an account that has a plan but no date yet', async () => {
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await agree(user)
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(server.plans.get('google-uid')).toHaveProperty('consentedAt'))
    expect(storedPlan('google-uid')).toEqual(toCloudPlan(mine))
  })

  test('the Privacy notice opens from the sign-in screen and from Settings → Account', async () => {
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const consent = (await screen.findByRole('checkbox', { name: CONSENT })).closest('label')!
    await user.click(within(consent).getByRole('button', { name: 'Privacy notice' }))
    expect(screen.getByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
    expect(screen.getByText(/sensitive personal information under the Data Privacy Act of 2012 \(RA 10173\)/)).toBeInTheDocument()
    expect(screen.getByText(/no analytics or tracking/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'rikkicabanlet@gmail.com' })).toHaveAttribute('href', 'mailto:rikkicabanlet@gmail.com')
    await user.click(screen.getByRole('button', { name: '← Back' }))
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()

    await agree(user)
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(tab('Settings'))
    await user.click(within(screen.getByRole('region', { name: 'Account' })).getByRole('button', { name: 'Privacy notice' }))
    expect(screen.getByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Back' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  test('an account from before the Privacy notice is asked once to agree; the date is saved and shown', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.accounts.set('juan@example.com', { uid: 'uid-juan', password: 'pw123456' })
    server.plans.set('uid-juan', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const panel = await screen.findByRole('region', { name: 'Account' })
    await user.type(within(panel).getByLabelText('Email'), 'juan@example.com')
    await user.type(within(panel).getByLabelText('Password'), 'pw123456')
    await user.click(within(panel).getByRole('button', { name: 'Sign in' }))

    const prompt = await screen.findByRole('alertdialog', { name: 'Please review the Privacy notice' })
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
    expect(screen.queryByText('Expected graduation')).not.toBeInTheDocument()
    await user.click(within(prompt).getByRole('button', { name: 'Read the Privacy notice' }))
    expect(screen.getByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Back' }))

    await user.click(screen.getByRole('button', { name: 'I agree' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    expect(server.plans.get('uid-juan')).toHaveProperty('consentedAt')
    expect(storedPlan('uid-juan')).toEqual(toCloudPlan(mine))
    await user.click(tab('Settings'))
    expect(screen.getByText(/You agreed to the Privacy notice on/)).toBeInTheDocument()

    // Next sign-in: not asked again
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    const again = await screen.findByRole('region', { name: 'Account' })
    await user.type(within(again).getByLabelText('Email'), 'juan@example.com')
    await user.type(within(again).getByLabelText('Password'), 'pw123456')
    await user.click(within(again).getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/You agreed to the Privacy notice on/)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog', { name: 'Please review the Privacy notice' })).not.toBeInTheDocument()
  })

  test('the agreement prompt lets the student sign out instead', async () => {
    server.current = { uid: 'google-uid', email: 'student@gmail.com', name: null }
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    const prompt = await screen.findByRole('alertdialog', { name: 'Please review the Privacy notice' })
    await user.click(within(prompt).getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'What it does' })).toBeInTheDocument()
    expect(server.plans.get('google-uid')).not.toHaveProperty('consentedAt')
  })

  test('a new device opens the plan saved in the account', async () => {
    server.accounts.set('juan@example.com', { uid: 'uid-juan', password: 'pw123456' })
    server.plans.set('uid-juan', agreedPlan())
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const panel = await screen.findByRole('region', { name: 'Account' })
    await user.type(within(panel).getByLabelText('Email'), 'juan@example.com')
    await user.type(within(panel).getByLabelText('Password'), 'pw123456')
    await user.click(within(panel).getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    expect(screen.getByText('Expected graduation').parentElement).toHaveTextContent('Year 5, 2nd sem')
  })

  test('a wrong password says so plainly', async () => {
    server.accounts.set('juan@example.com', { uid: 'uid-juan', password: 'pw123456' })
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    const panel = await screen.findByRole('region', { name: 'Account' })
    await user.type(within(panel).getByLabelText('Email'), 'juan@example.com')
    await user.type(within(panel).getByLabelText('Password'), 'wrong-one')
    await user.click(within(panel).getByRole('button', { name: 'Sign in' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent(/That email and password don.t match an account/)
  })

  test('when the device and the account have different plans, the student chooses', async () => {
    localStorage.setItem('curriculum-organizer:v1', JSON.stringify(mine))
    const other = toCloudPlan({ ...mine, student: { ...demoStudent, unit_caps: { default: 21 } } })
    server.plans.set('google-uid', other)
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await agree(user)
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    const prompt = await screen.findByRole('alertdialog', { name: 'Which plan do you want to keep?' })
    await user.click(within(prompt).getByRole('button', { name: "Use my account's plan" }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('curriculum-organizer:v1')!).student.unit_caps.default).toBe(21)
  })

  test('changes from another device show up, and edits here are saved to the account', async () => {
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await agree(user)
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())

    // Another device marks 214 Passed in Year 3, 1st sem
    const results = [...demoStudent.results.filter((r) => r.code !== '214'), {
      code: '214',
      attempts: [{ year: 2, sem: 1, result: 'Failed' as const }, { year: 3, sem: 1, result: 'Passed' as const }],
    }]
    act(() => remoteSave('google-uid', toCloudPlan({ ...mine, student: { ...demoStudent, results } })))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /214 Corporation and Basic Securities Law: Passed/ })).toBeInTheDocument(),
    )

    // An edit here goes to the account
    await user.click(screen.getByRole('button', { name: 'Not this sem: move 301 to Year 4, 1st sem' }))
    await waitFor(() => expect((server.plans.get('google-uid') as { student: { placed?: object } }).student.placed).toEqual({ '301': 'Y4-1' }), { timeout: 3000 })
  })

  test('signing out clears this device; the plan stays in the account', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await agree(user)
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument())
    expect(localStorage.getItem('curriculum-organizer:v1')).not.toContain('"setupDone":true')
    expect(storedPlan('google-uid')).toEqual(toCloudPlan(mine))
  })

  test('deleting the account removes the stored plan', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await getStarted(user)
    await agree(user)
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    await waitFor(() => expect(server.plans.has('google-uid')).toBe(false))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
