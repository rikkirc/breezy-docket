import { useMemo, useState } from 'react'
import { subjectMap } from '../data'
import { formatUnits } from '../lib/curriculum'
import {
  attemptsFor,
  describeDelay,
  describeGap,
  recordResult,
  removeResult,
  setCap,
  setCapMode,
  statusOf,
} from '../lib/student'
import {
  baseCapFor,
  capFor,
  parseTermKey,
  planStart,
  termFromIndex,
  termIndex,
  termKey,
  termLabel,
  type Attempt,
  type Curriculum,
  type Overload,
  type Plan,
  type Result,
  type StudentData,
  type Subject,
  type Term,
} from '../planner'

interface Props {
  curriculum: Curriculum
  plan: Plan
  student: StudentData
  onChange: (student: StudentData) => void
}

const RESULT_LABEL: Record<Result, string> = { Passed: 'Passed', Failed: 'Failed', Ongoing: 'Taking' }

/**
 * Semester by semester, from Year 1 to graduation: what was taken (with results), the semester in
 * progress (record results here), and what's planned. Failing a subject re-plans everything after it.
 */
export function WorkingSubjects({ curriculum, plan, student, onChange }: Props) {
  const byCode = useMemo(() => subjectMap(curriculum), [curriculum])
  const delays = new Map(plan.delays.map((d) => [d.code, d]))
  const start = planStart(student)

  // Recorded attempts by semester
  const recorded = new Map<number, { subject: Subject; attempt: Attempt }[]>()
  for (const r of student.results) {
    const subject = byCode.get(r.code)
    if (!subject) continue
    for (const attempt of r.attempts) {
      const i = termIndex(attempt)
      recorded.set(i, [...(recorded.get(i) ?? []), { subject, attempt }])
    }
  }
  const planned = new Map(plan.terms.map((t) => [termIndex(t.term), t]))
  const current = plan.terms[0] ? termIndex(plan.terms[0].term) : null

  const indexes = [...recorded.keys(), ...planned.keys()]
  const last = indexes.length > 0 ? Math.max(...indexes) : -1
  const terms: number[] = []
  for (let i = 0; i <= last; i++) if (recorded.has(i) || planned.has(i)) terms.push(i)

  const passedUnits = curriculum.subjects
    .filter((s) => statusOf(attemptsFor(student, s.code)) === 'Passed')
    .reduce((n, s) => n + s.units, 0)
  const totalUnits = curriculum.subjects.reduce((n, s) => n + s.units, 0)

  return (
    <section aria-labelledby="working-heading">
      <h2 id="working-heading" className="visually-hidden">
        Working Subjects
      </h2>
      <Graduation plan={plan} passedUnits={passedUnits} totalUnits={totalUnits} />

      {plan.overloads[0] && <OverloadPrompt overload={plan.overloads[0]} student={student} start={start} onChange={onChange} />}

      {terms.length === 0 && <p className="empty">Add subjects on the Curriculum tab to see your semesters.</p>}

      <ol className="terms">
        {terms.map((i) => {
          const term = termFromIndex(i)
          const label = termLabel(term)
          const done = recorded.get(i) ?? []
          const next = planned.get(i)
          const isPast = i < termIndex(start) || (next === undefined && (current === null || i < current))
          const isCurrent = i === current
          const units = done.reduce((n, d) => n + d.subject.units, 0) + (next?.units ?? 0)
          const cap = capFor(curriculum, student, term)
          const recordedRows = done.map(({ subject, attempt }) => (
            <RecordedRow
              key={`${subject.code}-done`}
              subject={subject}
              attempt={attempt}
              onChange={(result) =>
                onChange(result === null ? removeResult(student, subject.code, term) : recordResult(student, subject.code, term, result))
              }
            />
          ))
          if (isPast) {
            // Finished semesters fold into one line, so the current one is easy to reach.
            const counts = (['Passed', 'Failed', 'Ongoing'] as Result[])
              .map((r) => [r, done.filter((d) => d.attempt.result === r).length] as const)
              .filter(([, n]) => n > 0)
              .map(([r, n]) => `${n} ${RESULT_LABEL[r].toLowerCase()}`)
            return (
              <li key={i} className="card term past" aria-label={label}>
                <details>
                  <summary className="term-head">
                    <h3>{label}</h3>
                    <span className="cap-text">
                      {formatUnits(units)} · {counts.join(', ')}
                    </span>
                  </summary>
                  <ul className="subjects">{recordedRows}</ul>
                </details>
              </li>
            )
          }
          return (
            <li key={i} className={`card term${isCurrent ? ' current' : ''}`} aria-label={label}>
              <div className="term-head">
                <h3>
                  {label}
                  {isCurrent && <span className="badge badge-ongoing tag">Now</span>}
                </h3>
                <CapStepper
                  label={label}
                  units={units}
                  cap={cap}
                  onChange={(n) => onChange(setCap(student, term, n, baseCapFor(curriculum, student, term)))}
                />
              </div>
              <ul className="subjects">
                {recordedRows}
                {next?.subjects.map((s) => {
                  const delay = delays.get(s.code)
                  return (
                    <li key={s.code} className="subject">
                      <div className="subject-line">
                        <span className="code">{s.code}</span>{' '}
                        <span className="title">{s.title}</span>
                        <span className="units">{formatUnits(s.units)}</span>
                      </div>
                      {delay && (
                        <div className="delay">
                          <span className="badge badge-delayed">Moved from {termLabel(delay.standardTerm)}</span>
                          <ul className="reasons">
                            {describeDelay(delay, byCode).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {isCurrent && (
                        <div className="row finish" role="group" aria-label={`Result for ${s.code}`}>
                          {(['Passed', 'Failed', 'Ongoing'] as Result[]).map((r) => (
                            <button key={r} type="button" className="small" onClick={() => onChange(recordResult(student, s.code, term, r))}>
                              {RESULT_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {isCurrent && next && next.subjects.length > 1 && (
                <div className="row start-term">
                  <button
                    type="button"
                    onClick={() =>
                      onChange(next.subjects.reduce((st, s) => recordResult(st, s.code, term, 'Passed'), student))
                    }
                  >
                    Mark all passed
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function RecordedRow({
  subject,
  attempt,
  onChange,
}: {
  subject: Subject
  attempt: Attempt
  onChange: (result: Result | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <li className="subject">
      <button
        type="button"
        className="subject-line subject-toggle"
        aria-expanded={open}
        aria-label={`${subject.code} ${subject.title}: ${RESULT_LABEL[attempt.result]}. Change`}
        onClick={() => setOpen(!open)}
      >
        <span className="code">{subject.code}</span>{' '}
        <span className="title">{subject.title}</span>
        <span className={`badge badge-${attempt.result.toLowerCase()}`}>{RESULT_LABEL[attempt.result]}</span>
      </button>
      {open && (
        <div className="row finish" role="group" aria-label={`Change result for ${subject.code}`}>
          {(['Passed', 'Failed', 'Ongoing'] as Result[])
            .filter((r) => r !== attempt.result)
            .map((r) => (
              <button
                key={r}
                type="button"
                className="small"
                onClick={() => {
                  onChange(r)
                  setOpen(false)
                }}
              >
                {RESULT_LABEL[r]}
              </button>
            ))}
          <button type="button" className="small danger" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      )}
    </li>
  )
}

function OverloadPrompt({
  overload,
  student,
  start,
  onChange,
}: {
  overload: Overload
  student: StudentData
  start: Term
  onChange: (student: StudentData) => void
}) {
  const [text, setText] = useState(String(overload.units))
  const units = Number(text)
  const valid = Number.isInteger(units) && units >= 1 && units <= 30
  const label = termLabel(overload.term)

  return (
    <div className="card prompt" role="alert">
      <p>
        <strong>
          {label} now has {formatUnits(overload.units)} of subjects, more than its full load of {overload.cap}.
        </strong>{' '}
        That's from the subjects that moved after a failed subject. How many units do you want to take?
      </p>
      <label className="cap-number">
        <span>Units to take</span>
        <input type="number" inputMode="numeric" min={1} max={30} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={!valid}
          onClick={() => {
            const byTerm = { ...student.unit_caps.by_term, [termKey(overload.term)]: units }
            onChange({ ...student, unit_caps: { ...student.unit_caps, by_term: byTerm } })
          }}
        >
          {label} only
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            // Every semester from now on: a fixed cap, dropping per-semester caps for those semesters.
            const fixed = setCapMode(student, false, units)
            const byTerm = Object.fromEntries(
              Object.entries(fixed.unit_caps.by_term ?? {}).filter(([key]) => {
                const term = parseTermKey(key)
                return term !== null && termIndex(term) < termIndex(start)
              }),
            )
            onChange({ ...fixed, unit_caps: { ...fixed.unit_caps, by_term: byTerm } })
          }}
        >
          Every semester from now on
        </button>
      </div>
      <p className="muted small-text">Fewer units than the subjects due means some move to a later semester.</p>
    </div>
  )
}

function Graduation({ plan, passedUnits, totalUnits }: { plan: Plan; passedUnits: number; totalUnits: number }) {
  if (!plan.graduation) {
    return (
      <div className="card summary summary-bad">
        <p className="summary-label">Can't finish with these settings</p>
        <p>
          These subjects never fit: {plan.unplanned.join(', ')}. Raise the unit cap or check their prerequisites.
        </p>
      </div>
    )
  }
  const behind = plan.termsBehind ?? 0
  const standard = plan.standardGraduation ? termLabel(plan.standardGraduation) : ''
  return (
    <div className={`card summary ${behind > 0 ? 'summary-late' : 'summary-ok'}`}>
      <p className="summary-label">Expected graduation</p>
      <p className="summary-term">{termLabel(plan.graduation)}</p>
      <p>
        {behind > 0
          ? `${describeGap(behind)} behind the standard plan (${standard}).`
          : behind < 0
            ? `${describeGap(-behind)} ahead of the standard plan (${standard}).`
            : 'On schedule with the standard plan.'}{' '}
        {passedUnits} of {totalUnits} units passed.
      </p>
    </div>
  )
}

function CapStepper({ units, cap, onChange, label }: { units: number; cap: number; onChange: (cap: number) => void; label: string }) {
  return (
    <div className="cap" role="group" aria-label={`Unit cap for ${label}`}>
      <span className="cap-text">
        {units} / {cap} units
      </span>
      <button type="button" aria-label="Lower the cap" onClick={() => onChange(cap - 1)} disabled={cap <= 1}>
        −
      </button>
      <button type="button" aria-label="Raise the cap" onClick={() => onChange(cap + 1)} disabled={cap >= 30}>
        +
      </button>
    </div>
  )
}
