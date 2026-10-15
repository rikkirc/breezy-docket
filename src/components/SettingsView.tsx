import { useRef, useState } from 'react'
import { demoStudent } from '../data'
import { backupFileName, makeBackup, parseBackup } from '../lib/backup'
import { isInstalled, useInstallPrompt } from '../lib/useInstallPrompt'
import { freshStudent, termAfterResults } from '../lib/student'
import { parseTermKey, termIndex, termLabel, type StudentData } from '../planner'

interface Props {
  student: StudentData
  isDemo: boolean
  onChange: (student: StudentData) => void
  onReset: (student: StudentData, isDemo: boolean, show?: 'plan' | 'results') => void
}

export function SettingsView({ student, isDemo, onChange, onReset }: Props) {
  // Caps for semesters already taken no longer affect the plan, so only future ones are listed.
  const overrides = Object.entries(student.unit_caps.by_term ?? {}).filter(([key]) => {
    const term = parseTermKey(key)
    return term !== null && termIndex(term) >= termIndex(student.next_term)
  })
  const suggested = termAfterResults(student)
  const fileInput = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const install = useInstallPrompt()

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(makeBackup(student), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName()
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importBackup = async (file: File) => {
    try {
      const imported = parseBackup(await file.text())
      if (!window.confirm('Replace the data in this browser with the backup?')) return
      setImportError(null)
      onReset(imported, false, 'plan')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">Settings</h2>

      <div className="card form">
        <label>
          <span>Plan from</span>
          <span className="row">
            <select
              aria-label="Plan from year"
              value={student.next_term.year}
              onChange={(e) =>
                onChange({ ...student, next_term: { ...student.next_term, year: Number(e.target.value) } })
              }
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Plan from semester"
              value={student.next_term.sem}
              onChange={(e) =>
                onChange({ ...student, next_term: { ...student.next_term, sem: Number(e.target.value) } })
              }
            >
              <option value={1}>1st sem</option>
              <option value={2}>2nd sem</option>
            </select>
          </span>
          <span className="muted small-text">
            The first semester you haven't taken yet.
            {suggested && ` Your results suggest ${termLabel(suggested)}.`}
          </span>
        </label>

        <label>
          <span>Unit cap per semester</span>
          <CapInput
            value={student.unit_caps.default}
            onChange={(cap) => onChange({ ...student, unit_caps: { ...student.unit_caps, default: cap } })}
          />
          <span className="muted small-text">
            The most units you can take while working. Change a single semester with the − / + on the
            Plan.
          </span>
        </label>

        {overrides.length > 0 && (
          <div>
            <span>Semesters with their own cap</span>
            <ul className="overrides">
              {overrides.map(([key, cap]) => (
                <li key={key}>
                  {termLabel(parseTermKey(key)!)}: {cap} units{' '}
                  <button
                    type="button"
                    className="small"
                    onClick={() => {
                      const byTerm = { ...student.unit_caps.by_term }
                      delete byTerm[key]
                      onChange({ ...student, unit_caps: { ...student.unit_caps, by_term: byTerm } })
                    }}
                  >
                    Use default
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!isInstalled() && (
        <div className="card form">
          <h3>Install on your phone</h3>
          {install ? (
            <div className="row">
              <button type="button" onClick={() => void install()}>
                Install the app
              </button>
            </div>
          ) : (
            <p className="muted">
              iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: open the
              Chrome menu (⋮), then Add to Home screen or Install app.
            </p>
          )}
          <p className="muted small-text">It then opens like an app and works offline.</p>
        </div>
      )}

      <div className="card form">
        <h3>Your data</h3>
        <p className="muted">
          Everything stays in this browser on this device. Nothing is sent anywhere. Export a backup
          to keep a copy or to move to another phone or computer.
        </p>
        <div className="row">
          <button type="button" onClick={exportBackup}>
            Export backup
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Backup file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importBackup(file)
            }}
          />
        </div>
        {importError && (
          <p className="error" role="alert">
            {importError}
          </p>
        )}
        <div className="row">
          <button
            type="button"
            className="danger"
            onClick={() => {
              const message = isDemo
                ? 'Start your own plan? The demo student will be cleared.'
                : 'Clear all your results and start over? This cannot be undone.'
              if (window.confirm(message)) onReset(freshStudent(), false)
            }}
          >
            Start fresh
          </button>
          {!isDemo && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Replace your data with the demo student? Your results will be lost.')) {
                  onReset(demoStudent, true)
                }
              }}
            >
              Load the demo student
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/** Lets the field be empty while typing; only whole numbers from 1 to 30 reach the plan. */
function CapInput({ value, onChange }: { value: number; onChange: (cap: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={30}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const cap = Number(e.target.value)
        if (e.target.value !== '' && Number.isInteger(cap) && cap >= 1 && cap <= 30) onChange(cap)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}
