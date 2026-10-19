import { useState } from 'react'
import { describeAccountError as message } from '../cloud/errors'
import type { Account } from '../cloud/useAccount'

type Mode = 'sign-in' | 'create'

/** Sign in (Google or email), or, when signed in, the account and its sync status. */
export function AccountPanel({ account, onPrivacy }: { account: Account; onPrivacy: () => void }) {
  if (!account.enabled) return null
  return (
    <section className="card form account" aria-labelledby="account-heading">
      <h3 id="account-heading">Account</h3>
      {account.user === undefined ? (
        <p className="muted">Checking…</p>
      ) : account.user ? (
        <SignedIn account={account} onPrivacy={onPrivacy} />
      ) : (
        <SignInForm account={account} onPrivacy={onPrivacy} />
      )}
    </section>
  )
}

function SignedIn({ account, onPrivacy }: { account: Account; onPrivacy: () => void }) {
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
      <p className="muted small-text">
        {account.consentedAt
          ? `You agreed to the Privacy notice on ${new Date(account.consentedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}.`
          : 'You haven’t agreed to the Privacy notice yet.'}{' '}
        <button type="button" className="link" onClick={onPrivacy}>
          Privacy notice
        </button>
      </p>
    </>
  )
}

function SignInForm({ account, onPrivacy }: { account: Account; onPrivacy: () => void }) {
  const [mode, setMode] = useState<Mode>('sign-in')
  // Needed before an account can be created (Create account, or Google, which may create one).
  const [agreed, setAgreed] = useState(false)
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
      <label className="consent">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I've read the{' '}
          <button type="button" className="link" onClick={onPrivacy}>
            Privacy notice
          </button>{' '}
          and agree to Breezy Docket keeping my plan and results in my account.
        </span>
      </label>
      <button
        type="button"
        className="google"
        disabled={busy || !agreed}
        onClick={() => attempt(() => account.signInWithGoogle(agreed))}
      >
        Continue with Google
      </button>
      <form
        className="email-sign-in"
        onSubmit={(e) => {
          e.preventDefault()
          void attempt(() =>
            mode === 'create'
              ? account.createAccount(email.trim(), password, agreed)
              : account.signInWithEmail(email.trim(), password),
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
          <button type="submit" className="primary" disabled={busy || (mode === 'create' && !agreed)}>
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
        You agree once, when you create an account or continue with Google. Signing in to an existing account with your
        email doesn’t need it again.
      </p>
    </>
  )
}

/** The first screen when accounts are on: sign in (or create an account) to open your plan. */
export function SignInScreen({ account, onPrivacy, onBack }: { account: Account; onPrivacy: () => void; onBack: () => void }) {
  return (
    <section className="sign-in-screen" aria-labelledby="sign-in-heading">
      <button type="button" className="link small-text" onClick={onBack}>
        ← About Breezy Docket
      </button>
      <h2 id="sign-in-heading">Sign in</h2>
      <p className="muted">
        Plan the rest of your subjects semester by semester and see when you'll graduate. Sign in to open your plan, or
        create an account to start one.
      </p>
      <AccountPanel account={account} onPrivacy={onPrivacy} />
    </section>
  )
}

/** For accounts made before the Privacy notice: agree once, or sign out. */
export function ConsentPrompt({ account, onPrivacy }: { account: Account; onPrivacy: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <section className="consent-prompt" aria-labelledby="consent-heading">
      <div className="card" role="alertdialog" aria-labelledby="consent-heading">
        <h2 id="consent-heading">Please review the Privacy notice</h2>
        <p>
          Breezy Docket now asks everyone to agree to its Privacy notice: what it keeps (your curriculum, results and
          plan), where, who can see it and how to delete it.
        </p>
        <p>
          <button type="button" className="link" onClick={onPrivacy}>
            Read the Privacy notice
          </button>
        </p>
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError(null)
              account
                .agree()
                .catch((e: unknown) => setError(message(e)))
                .finally(() => setBusy(false))
            }}
          >
            I agree
          </button>
          <button type="button" disabled={busy} onClick={() => account.signOut().catch((e: unknown) => setError(message(e)))}>
            Sign out
          </button>
        </div>
        <p className="muted small-text">
          I agree to Breezy Docket keeping my plan and results in my account. Signed in as{' '}
          {account.user?.email ?? account.user?.name ?? 'your account'}.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
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
