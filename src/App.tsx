import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from './lib/curriculum'
import { demoSaved, initialSaved, loadSaved, save, type Saved } from './lib/storage'
import { planCurriculum, type StudentData } from './planner'
import { CurriculumView } from './components/CurriculumView'
import { SettingsView } from './components/SettingsView'
import { Setup } from './components/Setup'
import { ConflictPrompt, SignInScreen } from './components/AccountPanel'
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
  const plan = useMemo(() => planCurriculum(saved.curriculum, saved.student, { overCap: 'flag' }), [saved.curriculum, saved.student])

  useEffect(() => save(saved), [saved])
  const account = useAccount(saved, setSaved)

  const updateStudent = (student: StudentData) => setSaved((s) => ({ ...s, student }))
  const updateWorkspace = ({ curriculum, student }: Workspace) => setSaved((s) => ({ ...s, curriculum, student }))
  const show = (next: Tab) => {
    setTab(next)
    document.scrollingElement?.scrollTo?.(0, 0)
  }
  const replace = (next: Saved, nextTab?: Tab) => {
    setSaved(next)
    show(nextTab ?? 'working')
  }

  // With accounts on, the app opens on the sign-in screen and then shows the signed-in account's plan.
  const signedIn = !account.enabled || (!!account.user && account.loaded)

  return (
    <>
      <header className="app-header">
        <h1>Breezy Docket</h1>
        {saved.setupDone && signedIn && (
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
        {signedIn && <ConflictPrompt account={account} />}
        {!signedIn ? (
          account.user === null ? (
            <SignInScreen account={account} />
          ) : (
            <p className="muted loading" role="status">
              {account.user ? 'Opening your plan…' : 'Loading…'}
            </p>
          )
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
                You're looking at a made-up demo student. To plan your own, go to{' '}
                <button type="button" className="link" onClick={() => show('settings')}>
                  Settings
                </button>
                .
              </p>
            )}
            {tab === 'working' && (
              <WorkingSubjects curriculum={saved.curriculum} plan={plan} student={saved.student} onChange={updateStudent} />
            )}
            {tab === 'curriculum' && <CurriculumView workspace={saved} onChange={updateWorkspace} />}
            {tab === 'settings' && (
              <SettingsView
                account={account}
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
