import { useEffect, useMemo, useState } from 'react'
import { curriculum, demoStudent } from './data'
import { loadSaved, save, type Saved } from './lib/storage'
import { planCurriculum, type StudentData } from './planner'
import { PlanView } from './components/PlanView'
import { ResultsView } from './components/ResultsView'
import { SettingsView } from './components/SettingsView'

type Tab = 'plan' | 'results' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'results', label: 'Results' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [saved, setSaved] = useState<Saved>(() => loadSaved() ?? { student: demoStudent, isDemo: true })
  const [tab, setTab] = useState<Tab>('plan')
  const plan = useMemo(() => planCurriculum(curriculum, saved.student), [saved.student])

  useEffect(() => save(saved), [saved])

  const update = (student: StudentData) => setSaved((s) => ({ ...s, student }))
  const show = (next: Tab) => {
    setTab(next)
    document.scrollingElement?.scrollTo?.(0, 0)
  }

  return (
    <>
      <header className="app-header">
        <h1>Curriculum Organizer</h1>
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
      </header>

      <main>
        {saved.isDemo && (
          <p className="banner">
            You're looking at a made-up demo student. To plan your own, go to{' '}
            <button type="button" className="link" onClick={() => show('settings')}>
              Settings
            </button>{' '}
            and start fresh.
          </p>
        )}
        {tab === 'plan' && <PlanView plan={plan} student={saved.student} onChange={update} />}
        {tab === 'results' && <ResultsView student={saved.student} onChange={update} />}
        {tab === 'settings' && (
          <SettingsView
            student={saved.student}
            isDemo={saved.isDemo}
            onChange={update}
            onReset={(student, isDemo) => {
              setSaved({ student, isDemo })
              show(isDemo ? 'plan' : 'results')
            }}
          />
        )}
      </main>
    </>
  )
}
