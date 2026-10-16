import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from './lib/curriculum'
import { demoSaved, initialSaved, loadSaved, save, type Saved } from './lib/storage'
import { planCurriculum, type StudentData } from './planner'
import { CurriculumView } from './components/CurriculumView'
import { SettingsView } from './components/SettingsView'
import { Setup } from './components/Setup'
import { WorkingSubjects } from './components/WorkingSubjects'

type Tab = 'working' | 'curriculum' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'working', label: 'Working Subjects' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [saved, setSaved] = useState<Saved>(() => loadSaved() ?? initialSaved())
  const [tab, setTab] = useState<Tab>('working')
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
    show(nextTab ?? 'working')
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
