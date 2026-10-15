import { useState } from 'react'
import { curriculum } from '../data'
import {
  attemptsFor,
  defaultAttemptTerm,
  markAllPassed,
  setAttempts,
  statusOf,
} from '../lib/student'
import { termIndex, termLabel, type Attempt, type Result, type StudentData, type Subject } from '../planner'

interface Props {
  student: StudentData
  onChange: (student: StudentData) => void
}

const RESULTS: Result[] = ['Passed', 'Failed', 'Ongoing']
const YEARS = [1, 2, 3, 4, 5, 6, 7, 8]

/** Subjects grouped by their standard term, in curriculum order. */
const groups: { key: string; label: string; subjects: Subject[] }[] = (() => {
  const byTerm = new Map<number, Subject[]>()
  for (const s of curriculum.subjects) {
    const i = termIndex({ year: s.standard_year, sem: s.offered_sem })
    byTerm.set(i, [...(byTerm.get(i) ?? []), s])
  }
  return [...byTerm.entries()]
    .sort(([a], [b]) => a - b)
    .map(([i, subjects]) => {
      const term = { year: subjects[0].standard_year, sem: subjects[0].offered_sem }
      return { key: String(i), label: termLabel(term), subjects }
    })
})()

export function ResultsView({ student, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const passedUnits = curriculum.subjects
    .filter((s) => statusOf(attemptsFor(student, s.code)) === 'Passed')
    .reduce((n, s) => n + s.units, 0)
  const totalUnits = curriculum.subjects.reduce((n, s) => n + s.units, 0)

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading">Your results</h2>
      <p className="muted">
        {passedUnits} of {totalUnits} units passed. Tap a subject to record a result. A retake is
        another attempt on the same subject.
      </p>

      {groups.map((g) => {
        const untouched = g.subjects.filter((s) => attemptsFor(student, s.code).length === 0)
        return (
          <div key={g.key} className="card group">
            <div className="group-head">
              <h3>{g.label}</h3>
              {untouched.length > 0 && (
                <button
                  type="button"
                  className="small"
                  onClick={() => onChange(markAllPassed(student, untouched))}
                >
                  Mark the rest passed
                </button>
              )}
            </div>
            <ul className="subjects">
              {g.subjects.map((s) => (
                <SubjectRow
                  key={s.code}
                  subject={s}
                  attempts={attemptsFor(student, s.code)}
                  open={open === s.code}
                  onToggle={() => setOpen(open === s.code ? null : s.code)}
                  onChange={(attempts) => onChange(setAttempts(student, s.code, attempts))}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function SubjectRow({
  subject,
  attempts,
  open,
  onToggle,
  onChange,
}: {
  subject: Subject
  attempts: Attempt[]
  open: boolean
  onToggle: () => void
  onChange: (attempts: Attempt[]) => void
}) {
  const status = statusOf(attempts)
  const editorId = `attempts-${subject.code}`
  const add = (result: Result) => onChange([...attempts, { ...defaultAttemptTerm(subject, attempts), result }])
  const replace = (i: number, attempt: Attempt) => onChange(attempts.map((a, j) => (j === i ? attempt : a)))

  return (
    <li className="subject">
      <button
        type="button"
        className="subject-line subject-toggle"
        aria-expanded={open}
        aria-controls={editorId}
        onClick={onToggle}
      >
        <span className="code">{subject.code}</span>
        <span className="title">{subject.title}</span>
        <span className={`badge badge-${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
      </button>

      {open && (
        <div id={editorId} className="attempts">
          <p className="muted small-text">
            {subject.units} units · offered {subject.offered_sem === 1 ? '1st' : '2nd'} sem
            {subject.prerequisites.length > 0 && ` · needs ${subject.prerequisites.join(', ')}`}
          </p>
          {subject.check && <p className="warning">To confirm: {subject.check}</p>}

          {attempts.map((a, i) => (
            <div key={i} className="attempt" role="group" aria-label={`Attempt ${i + 1}`}>
              <select
                aria-label="Year"
                value={a.year}
                onChange={(e) => replace(i, { ...a, year: Number(e.target.value) })}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              <select
                aria-label="Semester"
                value={a.sem}
                onChange={(e) => replace(i, { ...a, sem: Number(e.target.value) })}
              >
                <option value={1}>1st sem</option>
                <option value={2}>2nd sem</option>
              </select>
              <select
                aria-label="Result"
                value={a.result}
                onChange={(e) => replace(i, { ...a, result: e.target.value as Result })}
              >
                {RESULTS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                className="small danger"
                aria-label={`Remove attempt ${i + 1}`}
                onClick={() => onChange(attempts.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}

          {status !== 'Passed' && (
            <div className="add-attempt">
              <span className="muted small-text">
                {attempts.length === 0 ? 'Record' : 'Add a retake'} ({termLabel(defaultAttemptTerm(subject, attempts))}):
              </span>
              {RESULTS.map((r) => (
                <button key={r} type="button" className="small" onClick={() => add(r)}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
