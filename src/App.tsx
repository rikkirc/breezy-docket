import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from './lib/curriculum'
import { demoSaved, initialSaved, loadSaved, save, type Saved } from './lib/storage'
import { planCurriculum, type StudentData } from './planner'
import { CurriculumView } from './components/CurriculumView'
import { PlanView } from './components/PlanView'
import { ResultsView } from './components/ResultsView'
import { SettingsView } from './components/SettingsView'
import { Setup } from './components/Setup'

type Tab = 'plan' | 'results' | 'curriculum' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'results', label: 'Working Subjects' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [saved, setSaved] = useState<Saved>(() => loadSaved() ?? initialSaved())
  const [tab, setTab] = useState<Tab>('plan')
  const plan = useMemo(() => planCurriculum(saved.curriculum, saved.student), [saved.curriculum, saved.student])

  useEffect(() => save(saved), [saved])

  const updateStudent = (student: StudentData) => setSaved((s) => ({ ...s, student }))
  const updateWorkspace = ({ curriculum, student }: Workspace) => setSaved((s) => ({ ...s, curriculum, student }))
  const show = (next: Tab) => {
    setTab(next)
    document.scrollingElement?.scrollTo?.(0, 0)
  }
  const replace = (next: Saved, nextTab?: Tab) => {
    setSaved(next)
    show(nextTab ?? 'plan')
  }

  return (
    <>
      <header className="app-header">
        <h1>Curriculum Organizer</h1>
        {saved.setupDone && (
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
        {!saved.setupDone ? (
          <Setup
            workspace={saved}
            onChange={updateWorkspace}
            onFinish={() => {
              setSaved((s) => ({ ...s, setupDone: true }))
              show('results')
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
            {tab === 'plan' && (
              <PlanView curriculum={saved.curriculum} plan={plan} student={saved.student} onChange={updateStudent} />
            )}
            {tab === 'results' && (
              <ResultsView curriculum={saved.curriculum} student={saved.student} onChange={updateStudent} />
            )}
            {tab === 'curriculum' && <CurriculumView workspace={saved} onChange={updateWorkspace} />}
            {tab === 'settings' && (
              <SettingsView
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
