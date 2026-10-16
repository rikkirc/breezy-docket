import { useId, useState } from 'react'
import { setCapMode } from '../lib/student'
import {
  fullLoadFor,
  planStart,
  standardGraduation,
  termFromIndex,
  termIndex,
  termKey,
  termLabel,
  type Curriculum,
  type StudentData,
  type Term,
} from '../planner'

interface Props {
  curriculum: Curriculum
  student: StudentData
  onChange: (student: StudentData) => void
}

/** The unit cap: "Default" follows each semester's full load in the curriculum; "Custom" is one number. */
export function CapChoice({ curriculum, student, onChange }: Props) {
  const name = useId()
  const fullLoad = student.unit_caps.full_load === true
  const firstTerm = { year: 1, sem: 1 }
  const example = curriculum.subjects.length > 0 ? fullLoadFor(curriculum, firstTerm) : null

  return (
    <fieldset className="cap-choice">
      <legend>Unit cap per semester</legend>
      <label className="choice">
        <input type="radio" name={name} checked={fullLoad} onChange={() => onChange(setCapMode(student, true))} />
        <span>
          <span>
            <strong>Default</strong>: the full load of each semester
          </span>
          <span className="muted small-text">
            The cap follows your curriculum
            {example !== null ? ` (e.g. ${termLabel(firstTerm)}: ${example} units)` : ''}. Semesters after
            the standard plan use the largest full load.
          </span>
        </span>
      </label>
      <label className="choice">
        <input type="radio" name={name} checked={!fullLoad} onChange={() => onChange(setCapMode(student, false))} />
        <span>
          <span>
            <strong>Custom</strong>: choose your units per semester
          </span>
          <span className="muted small-text">
            The most units you can take while working: one number for every semester, or a different one for any
            semester.
          </span>
        </span>
      </label>
      {!fullLoad && (
        <>
          <CapInput value={student.unit_caps.default} onChange={(cap) => onChange(setCapMode(student, false, cap))} />
          <PerSemesterCaps curriculum={curriculum} student={student} onChange={onChange} />
        </>
      )}
    </fieldset>
  )
}

/** Lets the field be empty while typing; only whole numbers from 1 to 30 reach the plan. */
function CapInput({ value, onChange }: { value: number; onChange: (cap: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <label className="cap-number">
      <span>Units per semester</span>
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
    </label>
  )
}

/** Custom cap, semester by semester: blank means the number above. */
function PerSemesterCaps({ curriculum, student, onChange }: Props) {
  const start = planStart(student)
  const end = Math.max(termIndex(standardGraduation(curriculum) ?? start), termIndex(start)) + 4
  const terms: Term[] = []
  for (let i = termIndex(start); i <= end; i++) terms.push(termFromIndex(i))
  const set = (term: Term, cap: number | null) => {
    const byTerm = { ...student.unit_caps.by_term }
    if (cap === null) delete byTerm[termKey(term)]
    else byTerm[termKey(term)] = cap
    onChange({ ...student, unit_caps: { ...student.unit_caps, by_term: byTerm } })
  }
  const custom = terms.filter((t) => student.unit_caps.by_term?.[termKey(t)] !== undefined).length

  return (
    <details className="per-semester" open={custom > 0 || undefined}>
      <summary>Choose the units for each semester{custom > 0 ? ` (${custom} set)` : ''}</summary>
      <p className="muted small-text">Leave a semester blank to use {student.unit_caps.default} units.</p>
      <ul>
        {terms.map((t) => (
          <li key={termKey(t)}>
            <TermCapInput
              label={termLabel(t)}
              value={student.unit_caps.by_term?.[termKey(t)]}
              placeholder={student.unit_caps.default}
              onChange={(cap) => set(t, cap)}
            />
          </li>
        ))}
      </ul>
    </details>
  )
}

function TermCapInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: number | undefined
  placeholder: number
  onChange: (cap: number | null) => void
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  return (
    <label className="term-cap">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={30}
        value={text}
        placeholder={String(placeholder)}
        onChange={(e) => {
          setText(e.target.value)
          if (e.target.value === '') return onChange(null)
          const cap = Number(e.target.value)
          if (Number.isInteger(cap) && cap >= 1 && cap <= 30) onChange(cap)
        }}
      />
    </label>
  )
}
