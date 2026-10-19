import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from './lib/curriculum'
import { demoSaved, initialSaved, loadSaved, save, type Saved } from './lib/storage'
import { planCurriculum, type StudentData } from './planner'
import { CurriculumView } from './components/CurriculumView'
import { SettingsView } from './components/SettingsView'
import { Setup } from './components/Setup'
import { ConflictPrompt, ConsentPrompt, SignInScreen } from './components/AccountPanel'
import { HowToUsePage, Welcome } from './components/HowToUse'
import { PrivacyNotice } from './components/PrivacyNotice'
import { UNOFFICIAL_NOTE, XU_LAW } from './components/Templates'
import { useAccount } from './cloud/useAccount'
import { WorkingSubjects } from './components/WorkingSubjects'

type Tab = 'working' | 'curriculum' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'working', label: 'Working Subjects' },
]

export default function App() {
  const [saved, setSaved] = useState<Saved>(() => loadSaved() ?? initialSaved())
  const [tab, setTab] = useState<Tab>('working')
  /** A page shown over everything else: the Privacy notice or How to use. */
  const [page, setPage] = useState<'privacy' | 'how-to' | null>(null)
  /** Signed out: the welcome page first, then the sign-in screen after "Get started". */
  const [started, setStarted] = useState(false)
  const plan = useMemo(() => planCurriculum(saved.curriculum, saved.student, { overCap: 'flag' }), [saved.curriculum, saved.student])

  useEffect(() => save(saved), [saved])
  const account = useAccount(saved, setSaved)

  const updateStudent = (student: StudentData) => setSaved((s) => ({ ...s, student }))
  const updateWorkspace = ({ curriculum, student }: Workspace) => setSaved((s) => ({ ...s, curriculum, student }))
  const show = (next: Tab) => {
    setTab(next)
    setPage(null)
    document.scrollingElement?.scrollTo?.(0, 0)
  }
  const open = (next: 'privacy' | 'how-to' | null) => {
    setPage(next)
    document.scrollingElement?.scrollTo?.(0, 0)
  }
  const openPrivacy = () => open('privacy')
  const replace = (next: Saved, nextTab?: Tab) => {
    setSaved(next)
    show(nextTab ?? 'working')
  }

  // With accounts on, the app opens on the sign-in screen and then shows the signed-in account's plan.
  const signedIn = !account.enabled || (!!account.user && account.loaded)
  // Accounts made before the Privacy notice agree once before anything else.
  const asking = signedIn && account.needsConsent

  return (
    <>
      <header className="app-header">
        <h1>Breezy Docket</h1>
        {saved.setupDone && signedIn && !asking && !page && (
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tab"
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => show(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main>
        {signedIn && !page && <ConflictPrompt account={account} />}
        {page === 'privacy' ? (
          <PrivacyNotice onBack={() => open(null)} />
        ) : page === 'how-to' ? (
          <HowToUsePage onBack={() => open(null)} />
        ) : !signedIn ? (
          account.user === null ? (
            started ? (
              <SignInScreen account={account} onPrivacy={openPrivacy} onBack={() => setStarted(false)} />
            ) : (
              <Welcome onStart={() => setStarted(true)} onPrivacy={openPrivacy} />
            )
          ) : (
            <p className="muted loading" role="status">
              {account.user ? 'Opening your plan…' : 'Loading…'}
            </p>
          )
        ) : asking ? (
          <ConsentPrompt account={account} onPrivacy={openPrivacy} />
        ) : !saved.setupDone ? (
          <Setup
            workspace={saved}
            onChange={updateWorkspace}
            onFinish={() => {
              setSaved((s) => ({ ...s, setupDone: true }))
              show('working')
            }}
            onTryDemo={() => replace(demoSaved())}
          />
        ) : (
          <>
            {saved.isDemo && (
              <p className="banner">
                You're looking at a made-up demo student on the {XU_LAW}. To plan your own, go to{' '}
                <button type="button" className="link" onClick={() => show('settings')}>
                  Settings
                </button>
                .<span className="unofficial small-text">{UNOFFICIAL_NOTE}</span>
              </p>
            )}
            {tab === 'working' && (
              <WorkingSubjects curriculum={saved.curriculum} plan={plan} student={saved.student} onChange={updateStudent} />
            )}
            {tab === 'curriculum' && <CurriculumView workspace={saved} onChange={updateWorkspace} />}
            {tab === 'settings' && (
              <SettingsView
                account={account}
                onPrivacy={openPrivacy}
                onHowTo={() => open('how-to')}
                curriculum={saved.curriculum}
                student={saved.student}
                isDemo={saved.isDemo}
                onChange={updateStudent}
                onReplace={replace}
              />
            )}
          </>
        )}
      </main>
    </>
  )
}
