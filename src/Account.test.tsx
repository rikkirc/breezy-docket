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

vi.mock('./cloud/config', () => ({ firebaseConfig: { apiKey: 'test', projectId: 'test' } }))

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
    savePlan: async (_c: unknown, uid: string, plan: unknown) => {
      server.plans.set(uid, JSON.parse(JSON.stringify(plan)))
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

async function createAccount(user: UserEvent, email: string) {
  const panel = await screen.findByRole('region', { name: 'Account' })
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
    await createAccount(user, 'juan@example.com')
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toHaveTextContent('juan@example.com'))
    await waitFor(() => expect(server.plans.get('uid-juan@example.com')).toEqual(toCloudPlan(mine)))
    expect(screen.getByRole('status')).toHaveTextContent('Your plan is saved to your account.')
  })

  test('the app opens on the sign-in screen, even with a plan on this device', async () => {
    localStorage.setItem('curriculum-organizer:v1', JSON.stringify(mine))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Breezy Docket' })).toBeInTheDocument()
    expect(screen.getByText('Breeze your way through every sem, all the way to graduation.')).toBeInTheDocument()
    expect(screen.getByText('by: RCbreezy©')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument()
    expect(screen.queryByText('Expected graduation')).not.toBeInTheDocument()
  })

  test('someone still signed in goes straight to the plan in their account', async () => {
    server.current = { uid: 'google-uid', email: 'student@gmail.com', name: null }
    server.plans.set('google-uid', toCloudPlan(mine))
    render(<App />)
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  test('a new device opens the plan saved in the account', async () => {
    server.accounts.set('juan@example.com', { uid: 'uid-juan', password: 'pw123456' })
    server.plans.set('uid-juan', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
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
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument())
    expect(localStorage.getItem('curriculum-organizer:v1')).not.toContain('"setupDone":true')
    expect(server.plans.get('google-uid')).toEqual(toCloudPlan(mine))
  })

  test('deleting the account removes the stored plan', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.plans.set('google-uid', toCloudPlan(mine))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(screen.getByText('Expected graduation')).toBeInTheDocument())
    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    await waitFor(() => expect(server.plans.has('google-uid')).toBe(false))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
