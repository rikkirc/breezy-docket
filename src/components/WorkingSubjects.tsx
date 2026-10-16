import { type ReactNode, useMemo, useState } from 'react'
import { subjectMap } from '../data'
import { formatUnits } from '../lib/curriculum'
import {
  attemptsFor,
  blockedByMoving,
  fitTerm,
  describeDelay,
  graduationIfFailed,
  neededNext,
  describeGap,
  moveTargets,
  placeSubject,
  postpone,
  recordResult,
  removeResult,
  statusOf,
  unplace,
} from '../lib/student'
import {
  planStart,
  type Term,
  termFromIndex,
  termIndex,
  termKey,
  termLabel,
  type Attempt,
  type Curriculum,
  type Plan,
  type Result,
  type StudentData,
  type Subject,
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
  const overloads = new Map(plan.overloads.map((o) => [termIndex(o.term), o]))
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
  // Each semester's load in the curriculum, fixed: what the student takes is shown against it.
  const loads = new Map<number, number>()
  for (const s of curriculum.subjects) {
    const i = termIndex({ year: s.standard_year, sem: s.offered_sem })
    loads.set(i, (loads.get(i) ?? 0) + s.units)
  }
  // "Now" is the semester with subjects marked Taking; with none, the first semester with planned subjects.
  const taking = student.results.flatMap((r) => r.attempts.filter((a) => a.result === 'Ongoing').map(termIndex))
  const current = taking.length > 0 ? Math.max(...taking) : plan.terms[0] ? termIndex(plan.terms[0].term) : null

  const indexes = [...recorded.keys(), ...planned.keys()]
  const last = indexes.length > 0 ? Math.max(...indexes) : -1
  const terms: number[] = []
  for (let i = 0; i <= last; i++) if (recorded.has(i) || planned.has(i)) terms.push(i)

  const isPastTerm = (i: number) =>
    current === null ? !planned.has(i) : i < current && (i < termIndex(start) || !planned.has(i))

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

      {terms.length === 0 && <p className="empty">Add subjects on the Curriculum tab to see your semesters.</p>}

      <ol className="terms">
        {terms.map((i) => {
          const term = termFromIndex(i)
          const label = termLabel(term)
          const done = recorded.get(i) ?? []
          const next = planned.get(i)
          const isPast = isPastTerm(i)
          const isCurrent = i === current
          const units = done.reduce((n, d) => n + d.subject.units, 0) + (next?.units ?? 0)
          const over = current !== null && i >= current ? overloads.get(i) : undefined
          const recordedRows = done.map(({ subject, attempt }) => (
            <RecordedRow
              key={`${subject.code}-done`}
              subject={subject}
              attempt={attempt}
              note={
                attempt.result === 'Ongoing' && !isPastTerm(i) ? (
                  <FocusNote
                    needed={neededNext(curriculum, plan, subject.code)}
                    graduation={plan.graduation}
                    ifFailed={graduationIfFailed(curriculum, student, subject.code, term)}
                  />
                ) : null
              }
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
                      {unitsOf(units, loads.get(i))} · {counts.join(', ')}
                    </span>
                  </summary>
                  <ul className="subjects">{recordedRows}</ul>
                </details>
              </li>
            )
          }
          return (
            <li key={i} className={`card term${isCurrent ? ' current' : ''}${over ? ' has-over' : ''}`} aria-label={label}>
              <div className="term-head">
                <h3>
                  {label}
                  {isCurrent && <span className="badge badge-ongoing tag">Now</span>}
                </h3>
                <span className={`cap-text${over ? ' over' : ''}`} aria-label={`Units for ${label}`}>
                  {unitsOf(units, loads.get(i))}
                </span>
              </div>
              {over && (
                <div className="over-cap" role="alert" aria-label={`${label} is over the cap`}>
                  <p>
                    <strong>
                      {formatUnits(over.units)} planned, more than your cap of {over.cap}.
                    </strong>{' '}
                    Choose what to do for {label}:
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      className="small"
                      onClick={() => onChange(fitTerm(curriculum, plan, student, term, over.cap))}
                    >
                      Fit to {over.cap} units
                    </button>
                    <button
                      type="button"
                      className="small"
                      onClick={() =>
                        onChange({
                          ...student,
                          unit_caps: { ...student.unit_caps, by_term: { ...student.unit_caps.by_term, [termKey(term)]: over.units } },
                        })
                      }
                    >
                      Allow {over.units} units this sem
                    </button>
                  </div>
                  <p className="small-text muted">
                    "Fit" moves the subjects the app picks to their next offering. Or move subjects yourself with{' '}
                    {isCurrent ? 'Not this sem' : 'Move…'}.
                  </p>
                </div>
              )}
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
                      {student.placed?.[s.code] && (
                        <p className="moved-note small-text">
                          You moved it here.{' '}
                          <button
                            type="button"
                            className="link"
                            aria-label={`Undo the move of ${s.code}`}
                            onClick={() => onChange(unplace(student, s.code))}
                          >
                            Undo
                          </button>
                        </p>
                      )}
                      {current !== null && i >= current && (
                        <BlockedNote blocked={blockedByMoving(curriculum, plan, s.code, term)} />
                      )}
                      {current !== null && i > current && (
                        <MovePicker
                          code={s.code}
                          targets={moveTargets(curriculum, plan, student, s.code, current)}
                          onMove={(target) => onChange(placeSubject(student, s.code, target))}
                        />
                      )}
                      {isCurrent && (
                        <div className="row finish result-buttons" role="group" aria-label={`Result for ${s.code}`}>
                          {(['Passed', 'Failed', 'Ongoing'] as Result[]).map((r) => (
                            <button key={r} type="button" className="small" onClick={() => onChange(recordResult(student, s.code, term, r))}>
                              {RESULT_LABEL[r]}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="small"
                            aria-label={`Not this sem: move ${s.code} to ${termLabel({ year: term.year + 1, sem: term.sem })}`}
                            onClick={() => onChange(postpone(student, s.code, term))}
                          >
                            Not this sem
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {isCurrent && (next?.subjects.length ?? 0) + done.filter((d) => d.attempt.result === 'Ongoing').length > 1 && (
                <div className="row start-term">
                  <button
                    type="button"
                    onClick={() => {
                      const codes = [
                        ...done.filter((d) => d.attempt.result === 'Ongoing').map((d) => d.subject.code),
                        ...(next?.subjects.map((s) => s.code) ?? []),
                      ]
                      onChange(codes.reduce((st, code) => recordResult(st, code, term, 'Passed'), student))
                    }}
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
  note,
  onChange,
}: {
  subject: Subject
  attempt: Attempt
  note?: ReactNode
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
      {note}
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

/** On a subject marked Taking: what passing it unlocks, and what failing it would cost. */
function FocusNote({ needed, graduation, ifFailed }: { needed: { subject: Subject; term: Term }[]; graduation: Term | null; ifFailed: Term | null }) {
  const later = graduation && (!ifFailed || termIndex(ifFailed) > termIndex(graduation))
  const list = needed.map((n) => `${n.subject.code} ${n.subject.title} (${termLabel(n.term)})`)
  const unlocks =
    list.length > 0 ? `You need to pass this to take ${list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`}. ` : ''
  const cost = !later
    ? needed.length > 0
      ? `Failing it would move ${needed.length === 1 ? 'that subject' : 'those subjects'} but not your graduation.`
      : 'No later subject needs this one.'
    : ifFailed
      ? `Failing it would move your graduation to ${termLabel(ifFailed)}.`
      : 'Failing it would leave you unable to finish with these settings.'
  return <p className={`focus-note small-text${later ? ' focus-key' : ''}`}>{unlocks + cost}</p>
}

/** Next to Move / Not this sem: the subjects that need this one and are planned soon. */
function BlockedNote({ blocked }: { blocked: { subject: Subject; term: Term }[] }) {
  if (blocked.length === 0) return null
  const list = blocked.map((b) => `${b.subject.code} ${b.subject.title} in ${termLabel(b.term)}`)
  return (
    <p className="blocked-note small-text">
      If you move this subject, you won't be able to take {list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} or ${list.at(-1)}`}.
    </p>
  )
}

/** "Move" on a later semester's subject: pick another semester it can go to. */
function MovePicker({ code, targets, onMove }: { code: string; targets: Term[]; onMove: (term: Term) => void }) {
  const [open, setOpen] = useState(false)
  if (targets.length === 0) return null
  return (
    <div className="move">
      {open ? (
        <div className="row move-targets" role="group" aria-label={`Move ${code} to`}>
          <span className="muted small-text">Move to:</span>
          {targets.map((t) => (
            <button
              key={termIndex(t)}
              type="button"
              className="small"
              onClick={() => {
                onMove(t)
                setOpen(false)
              }}
            >
              {termLabel(t)}
            </button>
          ))}
          <button type="button" className="small link" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="small" aria-label={`Move ${code} to another semester`} onClick={() => setOpen(true)}>
          Move…
        </button>
      )}
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

/** "12 of 16 units" against the curriculum's load for the semester, or "3 units" past the standard plan. */
function unitsOf(units: number, load: number | undefined): string {
  return load === undefined ? formatUnits(units) : `${units} of ${formatUnits(load)}`
}
