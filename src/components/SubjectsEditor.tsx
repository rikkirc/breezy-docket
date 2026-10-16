import { useRef, useState } from 'react'
import {
  addSubject,
  draftProblem,
  formatUnits,
  MAX_UNITS,
  MAX_YEARS,
  removeSubject,
  termsWithSubjects,
  totalUnits,
  updateSubject,
  type SubjectDraft,
  type Workspace,
} from '../lib/curriculum'
import { termIndex, termLabel, type Subject, type Term } from '../planner'

interface Props {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
}

/** Step 1: every subject with its units, under the semester it's taken in the standard plan. */
export function SubjectsEditor({ workspace, onChange }: Props) {
  const { curriculum } = workspace
  const [years, setYears] = useState(() => Math.max(4, ...curriculum.subjects.map((s) => s.standard_year)))
  const [editing, setEditing] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const terms = termsWithSubjects(curriculum, years)
  const lastYear = terms.at(-1)?.term.year ?? years

  return (
    <div>
      {terms.map(({ term, subjects }) => {
        const index = termIndex(term)
        return (
          <section key={index} className="card group" aria-label={termLabel(term)}>
            <div className="group-head">
              <h3>{termLabel(term)}</h3>
              <span className="muted small-text">{formatUnits(totalUnits(subjects))}</span>
            </div>
            <ul className="subjects">
              {subjects.map((s) =>
                editing === s.code ? (
                  <li key={s.code} className="subject">
                    <SubjectForm
                      initial={{ code: s.code, title: s.title, units: s.units, term }}
                      years={lastYear}
                      submitLabel="Save"
                      problem={(draft) => draftProblem(curriculum, draft, s.code)}
                      onSubmit={(draft) => {
                        onChange(updateSubject(workspace, s.code, draft))
                        setEditing(null)
                      }}
                      onCancel={() => setEditing(null)}
                      onDelete={() => {
                        const hasResults = workspace.student.results.some((r) => r.code === s.code)
                        const message = hasResults
                          ? `Delete ${s.code} ${s.title}? Its recorded results will be deleted too.`
                          : `Delete ${s.code} ${s.title}?`
                        if (window.confirm(message)) {
                          onChange(removeSubject(workspace, s.code))
                          setEditing(null)
                        }
                      }}
                    />
                  </li>
                ) : (
                  <SubjectRow key={s.code} subject={s} onEdit={() => setEditing(s.code)} />
                ),
              )}
            </ul>
            {addingTo === index ? (
              <SubjectForm
                initial={{ code: '', title: '', units: 3, term }}
                years={lastYear}
                submitLabel="Add"
                keepOpen
                problem={(draft) => draftProblem(curriculum, draft)}
                onSubmit={(draft) => onChange({ ...workspace, curriculum: addSubject(curriculum, draft) })}
                onCancel={() => setAddingTo(null)}
              />
            ) : (
              <button type="button" className="small add" onClick={() => setAddingTo(index)}>
                + Add a subject to {termLabel(term)}
              </button>
            )}
          </section>
        )
      })}

      {lastYear < MAX_YEARS && (
        <button type="button" className="add-year" onClick={() => setYears(lastYear + 1)}>
          + Add Year {lastYear + 1}
        </button>
      )}
    </div>
  )
}

function SubjectRow({ subject, onEdit }: { subject: Subject; onEdit: () => void }) {
  return (
    <li className="subject">
      <button type="button" className="subject-line subject-toggle" onClick={onEdit} aria-label={`Edit ${subject.code} ${subject.title}`}>
        <span className="code">{subject.code}</span>{' '}
        <span className="title">{subject.title}</span>
        <span className="units">{formatUnits(subject.units)}</span>
      </button>
    </li>
  )
}

function SubjectForm({
  initial,
  years,
  submitLabel,
  keepOpen = false,
  problem,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial: SubjectDraft
  years: number
  submitLabel: string
  /** Clear the form after submitting, ready for the next subject. */
  keepOpen?: boolean
  problem: (draft: SubjectDraft) => string | null
  onSubmit: (draft: SubjectDraft) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [code, setCode] = useState(initial.code)
  const [title, setTitle] = useState(initial.title)
  const [units, setUnits] = useState(String(initial.units))
  const [term, setTerm] = useState<Term>(initial.term)
  const [error, setError] = useState<string | null>(null)
  const codeInput = useRef<HTMLInputElement>(null)

  return (
    <form
      className="subject-form"
      onSubmit={(e) => {
        e.preventDefault()
        const draft = { code, title, units: Number(units), term }
        const issue = problem(draft)
        if (issue) {
          setError(issue)
          return
        }
        onSubmit(draft)
        setError(null)
        if (keepOpen) {
          setCode('')
          setTitle('')
          codeInput.current?.focus()
        }
      }}
    >
      <div className="form-row">
        <label className="field-code">
          <span>Code</span>
          <input ref={codeInput} value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" />
        </label>
        <label className="field-units">
          <span>Units</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_UNITS}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
        </label>
      </div>
      <label>
        <span>Subject title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
      </label>
      {onDelete && (
        <div className="form-row">
          <label>
            <span>Year</span>
            <select value={term.year} onChange={(e) => setTerm({ ...term, year: Number(e.target.value) })}>
              {Array.from({ length: Math.max(years, term.year) }, (_, i) => i + 1).map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Semester</span>
            <select value={term.sem} onChange={(e) => setTerm({ ...term, sem: Number(e.target.value) })}>
              <option value={1}>1st sem</option>
              <option value={2}>2nd sem</option>
            </select>
          </label>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          {keepOpen ? 'Done' : 'Cancel'}
        </button>
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  )
}
