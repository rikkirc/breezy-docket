import { useState } from 'react'
import { describeAccountError as message } from '../cloud/errors'
import type { Account } from '../cloud/useAccount'

type Mode = 'sign-in' | 'create'

/** Sign in (Google or email), or, when signed in, the account and its sync status. */
export function AccountPanel({ account }: { account: Account }) {
  if (!account.enabled) return null
  return (
    <section className="card form account" aria-labelledby="account-heading">
      <h3 id="account-heading">Account</h3>
      {account.user === undefined ? (
        <p className="muted">Checking…</p>
      ) : account.user ? (
        <SignedIn account={account} />
      ) : (
        <SignInForm account={account} />
      )}
    </section>
  )
}

function SignedIn({ account }: { account: Account }) {
  const [error, setError] = useState<string | null>(null)
  const user = account.user!
  const status = {
    idle: '',
    syncing: 'Saving to your account…',
    synced: 'Your plan is saved to your account.',
    error: 'Couldn’t reach your account. Your changes are kept on this device and will be saved when you’re back online.',
  }[account.status]

  return (
    <>
      <p>
        Signed in as <strong>{user.email ?? user.name ?? 'your account'}</strong>
      </p>
      {status && (
        <p className={account.status === 'error' ? 'error' : 'muted small-text'} role="status">
          {status}
        </p>
      )}
      <div className="row">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Sign out? Your plan stays in your account; this device’s copy is cleared.')) {
              account.signOut().catch((e: unknown) => setError(message(e)))
            }
          }}
        >
          Sign out
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (window.confirm('Delete your account and the plan saved in it? This cannot be undone.')) {
              account.deleteAccount().catch((e: unknown) => setError(message(e)))
            }
          }}
        >
          Delete my account
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

function SignInForm({ account }: { account: Account }) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const attempt = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="muted">Your plan is kept in your account, so it opens on any device you sign in on.</p>
      <button type="button" className="google" disabled={busy} onClick={() => attempt(account.signInWithGoogle)}>
        Continue with Google
      </button>
      <form
        className="email-sign-in"
        onSubmit={(e) => {
          e.preventDefault()
          void attempt(() =>
            mode === 'create' ? account.createAccount(email.trim(), password) : account.signInWithEmail(email.trim(), password),
          )
        }}
      >
        <p className="or small-text muted">or with email</p>
        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <div className="row">
          <button type="submit" className="primary" disabled={busy}>
            {mode === 'create' ? 'Create account' : 'Sign in'}
          </button>
          <button type="button" className="link" onClick={() => setMode(mode === 'create' ? 'sign-in' : 'create')}>
            {mode === 'create' ? 'I already have an account' : 'Create an account'}
          </button>
        </div>
        {mode === 'sign-in' && (
          <button
            type="button"
            className="link small-text"
            onClick={() => {
              if (!email.trim()) {
                setError('Enter your email first, then tap “Forgot password”.')
                return
              }
              void attempt(async () => {
                await account.resetPassword(email.trim())
                setNotice(`We sent a password reset link to ${email.trim()}.`)
              })
            }}
          >
            Forgot password?
          </button>
        )}
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <p className="muted small-text">
        Signing in stores your curriculum, results and settings in Google Firebase, linked to your account, so only you
        can open them. You can delete them any time with “Delete my account”.
      </p>
    </>
  )
}

/** The first screen when accounts are on: sign in (or create an account) to open your plan. */
export function SignInScreen({ account }: { account: Account }) {
  return (
    <section className="sign-in-screen" aria-labelledby="sign-in-heading">
      <div className="brand">
        <p className="tagline">Breeze your way through every sem, all the way to graduation.</p>
        <p className="byline">by: RCbreezy©</p>
      </div>
      <h2 id="sign-in-heading">Sign in</h2>
      <p className="muted">
        Plan the rest of your subjects semester by semester and see when you'll graduate. Sign in to open your plan, or
        create an account to start one.
      </p>
      <AccountPanel account={account} />
    </section>
  )
}

/** When this device and the account both have a plan and they differ: which one to keep. */
export function ConflictPrompt({ account }: { account: Account }) {
  if (!account.conflict) return null
  return (
    <div className="card prompt-conflict" role="alertdialog" aria-labelledby="conflict-heading">
      <h3 id="conflict-heading">Which plan do you want to keep?</h3>
      <p>Your account already has a plan, and it's different from the one on this device.</p>
      <div className="row">
        <button type="button" className="primary" onClick={account.keepAccountPlan}>
          Use my account's plan
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Replace the plan in your account with this device’s plan?')) account.keepDevicePlan()
          }}
        >
          Keep this device's plan
        </button>
      </div>
      <p className="muted small-text">The one you don't keep is replaced.</p>
    </div>
  )
}
