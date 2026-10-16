import { useCallback, useEffect, useRef, useState } from 'react'
import { initialSaved, type Saved } from '../lib/storage'
import { decideOnSignIn, fromCloudPlan, isBlank, readCloudPlan, toCloudPlan, type CloudPlan } from '../lib/sync'
import type { AccountUser, Cloud } from './account'
import { firebaseConfig } from './config'

type AccountModule = typeof import('./account')

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface Account {
  /** False until a Firebase project is set in config.ts: then the app has no account option at all. */
  enabled: boolean
  /** undefined while checking whether someone is signed in. */
  user: AccountUser | null | undefined
  status: SyncStatus
  /** False while a signed-in account's plan is being opened for the first time. */
  loaded: boolean
  /** On sign-in, when this device and the account both have a different plan: which to keep. */
  conflict: CloudPlan | null
  keepAccountPlan: () => void
  keepDevicePlan: () => void
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  createAccount: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const SAVE_DELAY_MS = 800

/**
 * When accounts are on, the student signs in first (App shows the sign-in screen until then). Signed in, the plan is also kept in the
 * student's account and follows them to any device; edits on one device show up on the others.
 */
export function useAccount(saved: Saved, setSaved: (saved: Saved) => void): Account {
  const enabled = firebaseConfig !== null
  const [user, setUser] = useState<AccountUser | null | undefined>(enabled ? undefined : null)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [conflict, setConflict] = useState<CloudPlan | null>(null)
  /** The account whose plan has been opened on this device. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const module = useRef<AccountModule | null>(null)
  const cloud = useRef<Cloud | null>(null)
  /** The plan as last sent to or received from the account, to avoid echoing it back. */
  const lastSynced = useRef<string | null>(null)
  const ready = useRef(false)
  const savedRef = useRef(saved)
  useEffect(() => {
    savedRef.current = saved
  }, [saved])

  // Connect to Firebase (only when configured) and follow sign-in state.
  useEffect(() => {
    if (!firebaseConfig) return
    let stop = () => {}
    let cancelled = false
    void import('./account').then((m) => {
      if (cancelled) return
      module.current = m
      cloud.current = m.connect(firebaseConfig!)
      stop = m.onUser(cloud.current, setUser)
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  // On sign-in: reconcile this device with the account, then follow changes from other devices.
  useEffect(() => {
    const m = module.current
    const c = cloud.current
    if (!user || !m || !c) return
    let stopWatching = () => {}
    let cancelled = false
    ready.current = false
    setStatus('syncing')
    const apply = (plan: CloudPlan) => {
      lastSynced.current = JSON.stringify(plan)
      setSaved(fromCloudPlan(plan))
    }
    void (async () => {
      try {
        const stored = readCloudPlan(await m.loadPlan(c, user.uid))
        if (cancelled) return
        const decision = decideOnSignIn(savedRef.current, stored)
        if (decision === 'use-cloud') apply(stored!)
        if (decision === 'upload-local') {
          const plan = toCloudPlan(savedRef.current)
          await m.savePlan(c, user.uid, plan)
          lastSynced.current = JSON.stringify(plan)
        }
        if (decision === 'ask') setConflict(stored)
        ready.current = decision !== 'ask'
        setStatus('synced')
        setLoadedFor(user.uid)
        stopWatching = m.watchPlan(c, user.uid, (value) => {
          const plan = readCloudPlan(value)
          if (!plan || !ready.current || JSON.stringify(plan) === lastSynced.current) return
          apply(plan)
        })
      } catch {
        if (cancelled) return
        // Offline or unreachable: open the plan on this device; edits save once the account can be reached.
        setStatus('error')
        setLoadedFor(user.uid)
      }
    })()
    return () => {
      cancelled = true
      stopWatching()
    }
  }, [user, setSaved])

  // Save edits to the account shortly after they're made.
  useEffect(() => {
    const m = module.current
    const c = cloud.current
    if (!user || !m || !c || !ready.current || isBlank(saved)) return
    const plan = toCloudPlan(saved)
    const json = JSON.stringify(plan)
    if (json === lastSynced.current) return
    setStatus('syncing')
    const timer = setTimeout(() => {
      lastSynced.current = json
      m.savePlan(c, user.uid, plan).then(
        () => setStatus('synced'),
        () => setStatus('error'),
      )
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [saved, user])

  const run = useCallback(async (action: (m: AccountModule, c: Cloud) => Promise<unknown>) => {
    if (!module.current || !cloud.current) throw new Error('Accounts are still loading. Try again in a moment.')
    await action(module.current, cloud.current)
  }, [])

  return {
    enabled,
    user,
    status,
    loaded: !user || loadedFor === user.uid,
    conflict,
    keepAccountPlan: () => {
      if (!conflict) return
      lastSynced.current = JSON.stringify(conflict)
      setSaved(fromCloudPlan(conflict))
      setConflict(null)
      ready.current = true
    },
    keepDevicePlan: () => {
      setConflict(null)
      lastSynced.current = null
      ready.current = true
      // The save effect uploads this device's plan on the next render.
      setSaved({ ...savedRef.current })
    },
    signInWithGoogle: () => run((m, c) => m.signInWithGoogle(c)),
    signInWithEmail: (email, password) => run((m, c) => m.signInWithEmail(c, email, password)),
    createAccount: (email, password) => run((m, c) => m.createAccount(c, email, password)),
    resetPassword: (email) => run((m, c) => m.resetPassword(c, email)),
    signOut: async () => {
      await run((m, c) => m.signOut(c))
      // Signed out, this device keeps nothing of the student's: their plan stays in the account.
      ready.current = false
      lastSynced.current = null
      setConflict(null)
      setStatus('idle')
      setSaved(initialSaved())
    },
    deleteAccount: async () => {
      if (!user) return
      await run((m, c) => m.deleteAccount(c, user.uid))
      ready.current = false
      lastSynced.current = null
      setStatus('idle')
      setSaved(initialSaved())
    },
  }
}
