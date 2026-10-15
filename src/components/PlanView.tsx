import { useMemo, useState } from 'react'
import { curriculum, subjectsByCode } from '../data'
import { describeDelay, describeGap, setCap, termAfterResults } from '../lib/student'
import { capFromNow, failThisSem, thisSemSubjects } from '../lib/whatIf'
import {
  planCurriculum,
  termFromIndex,
  termIndex,
  termLabel,
  type Plan,
  type StudentData,
  type Term,
} from '../planner'

interface Props {
  plan: Plan
  student: StudentData
  onChange: (student: StudentData) => void
}

export function PlanView({ plan: realPlan, student, onChange }: Props) {
  const [failCode, setFailCode] = useState('')
  const [whatIfCap, setWhatIfCap] = useState<number | null>(null)
  const thisSem = thisSemSubjects(student, realPlan)
  // A subject can drop out of "this sem" after an edit on another screen; then that what-if no longer applies.
  const fail = thisSem.codes.includes(failCode) ? failCode : ''
  const whatIf = fail !== '' || whatIfCap !== null

  const whatIfPlan = useMemo(() => {
    if (!whatIf) return null
    let edited = student
    if (fail) edited = failThisSem(edited, realPlan, fail)
    if (whatIfCap !== null) edited = capFromNow(edited, whatIfCap)
    return planCurriculum(curriculum, edited)
  }, [whatIf, fail, whatIfCap, student, realPlan])
  const plan = whatIfPlan ?? realPlan

  const delays = new Map(plan.delays.map((d) => [d.code, d]))
  const resultsEnd = termAfterResults(student)
  const startsTooEarly = resultsEnd && termIndex(student.next_term) < termIndex(resultsEnd)

  return (
    <section aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="visually-hidden">
        Plan
      </h2>
      <Graduation plan={plan} whatIf={whatIf} />
      {whatIfPlan && <Comparison real={realPlan} whatIf={whatIfPlan} />}

      <details className="card what-if" open={whatIf || undefined}>
        <summary>What if…</summary>
        <p className="muted small-text">Try a change and see the new plan. Nothing is saved.</p>
        <label>
          <span>
            I fail this sem
            {thisSem.term ? ` (${termLabel(thisSem.term)})` : ''}
          </span>
          <select value={fail} onChange={(e) => setFailCode(e.target.value)} disabled={thisSem.codes.length === 0}>
            <option value="">Nothing — I pass everything</option>
            {thisSem.codes.map((code) => (
              <option key={code} value={code}>
                {code} {subjectsByCode.get(code)?.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>I take this many units every sem from now on</span>
          <select
            value={whatIfCap ?? ''}
            onChange={(e) => setWhatIfCap(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">My caps as they are</option>
            {[6, 9, 12, 15, 18, 21, 24].map((n) => (
              <option key={n} value={n}>
                {n} units
              </option>
            ))}
          </select>
        </label>
        {whatIf && (
          <button
            type="button"
            onClick={() => {
              setFailCode('')
              setWhatIfCap(null)
            }}
          >
            Back to my plan
          </button>
        )}
      </details>

      {!whatIf && startsTooEarly && (
        <p className="notice">
          Your results go up to {termLabel(previous(resultsEnd))}, but the plan starts at{' '}
          {termLabel(student.next_term)}.{' '}
          <button
            type="button"
            className="link"
            onClick={() => onChange({ ...student, next_term: resultsEnd })}
          >
            Plan from {termLabel(resultsEnd)}
          </button>
        </p>
      )}

      {plan.ongoing.length > 0 && (
        <p className="notice">
          Ongoing ({plan.ongoing.join(', ')}) is counted as passed. If you fail it, the plan will
          change.
        </p>
      )}

      {plan.terms.length === 0 && plan.unplanned.length === 0 && (
        <p className="empty">Nothing left to plan: every subject is passed or ongoing.</p>
      )}

      <ol className="terms">
        {plan.terms.map((t) => (
          <li key={termIndex(t.term)} className="card term">
            <div className="term-head">
              <h3>{t.label}</h3>
              {whatIf ? (
                <span className="cap-text">
                  {t.units} / {t.cap} units
                </span>
              ) : (
                <CapStepper
                  units={t.units}
                  cap={t.cap}
                  onChange={(cap) => onChange(setCap(student, t.term, cap))}
                  label={t.label}
                />
              )}
            </div>
            <ul className="subjects">
              {t.subjects.map((s) => {
                const delay = delays.get(s.code)
                return (
                  <li key={s.code} className="subject">
                    <div className="subject-line">
                      <span className="code">{s.code}</span>
                      <span className="title">{s.title}</span>
                      <span className="units">{s.units} u</span>
                    </div>
                    {delay ? (
                      <div className="delay">
                        <span className="badge badge-delayed">
                          Delayed from {termLabel(delay.standardTerm)}
                        </span>
                        <ul className="reasons">
                          {describeDelay(delay, subjectsByCode).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {s.warnings.map((w) => (
                      <p key={w} className="warning">
                        {w}
                      </p>
                    ))}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Comparison({ real, whatIf }: { real: Plan; whatIf: Plan }) {
  if (!real.graduation || !whatIf.graduation) return null
  const diff = termIndex(whatIf.graduation) - termIndex(real.graduation)
  return (
    <p className="notice" role="status">
      {diff === 0
        ? `Same graduation as your plan (${termLabel(real.graduation)}).`
        : `${describeGap(Math.abs(diff))} ${diff > 0 ? 'later' : 'earlier'} than your plan (${termLabel(real.graduation)}).`}
    </p>
  )
}

function Graduation({ plan, whatIf }: { plan: Plan; whatIf: boolean }) {
  if (!plan.graduation) {
    return (
      <div className="card summary summary-bad">
        <p className="summary-label">Can't finish with these settings</p>
        <p>
          These subjects never fit: {plan.unplanned.join(', ')}. Raise the unit cap or check their
          prerequisites.
        </p>
      </div>
    )
  }
  const behind = plan.termsBehind ?? 0
  return (
    <div className={`card summary ${behind > 0 ? 'summary-late' : 'summary-ok'}`}>
      <p className="summary-label">{whatIf ? 'What-if graduation' : 'Earliest graduation'}</p>
      <p className="summary-term">{termLabel(plan.graduation)}</p>
      <p>
        {behind > 0
          ? `${describeGap(behind)} behind the standard plan (${termLabel(plan.standardGraduation)}).`
          : behind < 0
            ? `${describeGap(-behind)} ahead of the standard plan (${termLabel(plan.standardGraduation)}).`
            : `On schedule with the standard plan.`}
      </p>
    </div>
  )
}

function CapStepper({
  units,
  cap,
  onChange,
  label,
}: {
  units: number
  cap: number
  onChange: (cap: number) => void
  label: string
}) {
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

function previous(term: Term): Term {
  return termFromIndex(termIndex(term) - 1)
}
