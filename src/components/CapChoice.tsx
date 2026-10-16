import { useId, useState } from 'react'
import { setCapMode } from '../lib/student'
import { fullLoadFor, termLabel, type Curriculum, type StudentData } from '../planner'

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
            <strong>Custom</strong>: the same number every semester
          </span>
          <span className="muted small-text">The most units you can take while working.</span>
        </span>
      </label>
      {!fullLoad && (
        <CapInput value={student.unit_caps.default} onChange={(cap) => onChange(setCapMode(student, false, cap))} />
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
