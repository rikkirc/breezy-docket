import { useMemo, useState } from 'react'
import { subjectMap } from '../data'
import { possiblePrerequisites, standardTerm, termsWithSubjects, togglePrerequisite } from '../lib/curriculum'
import { termIndex, termLabel, type Curriculum, type Subject } from '../planner'

interface Props {
  curriculum: Curriculum
  onChange: (curriculum: Curriculum) => void
}

/** Step 2: for each subject, tick the earlier subjects that must be passed first. */
export function PrerequisitesEditor({ curriculum, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const byCode = useMemo(() => subjectMap(curriculum), [curriculum])

  return (
    <div>
      {termsWithSubjects(curriculum)
        .filter((t) => t.subjects.length > 0)
        .map(({ term, subjects }) => (
          <section key={termIndex(term)} className="card group" aria-label={termLabel(term)}>
            <div className="group-head">
              <h3>{termLabel(term)}</h3>
            </div>
            <ul className="subjects">
              {subjects.map((s) => {
                // Also list current prerequisites that aren't earlier any more (e.g. after a move), so they can be unticked.
                const possible = possiblePrerequisites(curriculum, s)
                const misplaced = s.prerequisites
                  .map((p) => byCode.get(p))
                  .filter((p): p is Subject => p !== undefined && !possible.includes(p))
                const options = [...possible, ...misplaced]
                const isOpen = open === s.code
                const listId = `prereqs-${s.code}`
                return (
                  <li key={s.code} className="subject">
                    <button
                      type="button"
                      className="subject-line subject-toggle"
                      aria-expanded={options.length > 0 ? isOpen : undefined}
                      aria-controls={options.length > 0 ? listId : undefined}
                      disabled={options.length === 0}
                      onClick={() => setOpen(isOpen ? null : s.code)}
                    >
                      <span className="code">{s.code}</span>{' '}
                      <span className="title">{s.title}</span>
                      <span className="units">{s.prerequisites.length > 0 ? `${s.prerequisites.length} needed` : ''}</span>
                    </button>
                    {s.prerequisites.length > 0 ? (
                      <ul className="chips" aria-label={`Prerequisites of ${s.code}`}>
                        {s.prerequisites.map((p) => (
                          <li key={p} className="chip">
                            <span>
                              <span className="chip-code">{p}</span> {byCode.get(p)?.title ?? ''}
                            </span>
                            <button
                              type="button"
                              className="chip-remove"
                              aria-label={`Remove ${p} as a prerequisite of ${s.code}`}
                              onClick={() => onChange(togglePrerequisite(curriculum, s.code, p))}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="needs small-text">
                        {options.length === 0 ? 'First semester: no prerequisites.' : 'No prerequisites. Tap to add.'}
                      </p>
                    )}
                    {isOpen && (
                      <PrerequisiteChecklist
                        id={listId}
                        subject={s}
                        options={options}
                        onToggle={(code) => onChange(togglePrerequisite(curriculum, s.code, code))}
                        onDone={() => setOpen(null)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
    </div>
  )
}

function PrerequisiteChecklist({
  id,
  subject,
  options,
  onToggle,
  onDone,
}: {
  id: string
  subject: Subject
  options: Subject[]
  onToggle: (code: string) => void
  onDone: () => void
}) {
  // Newest semester first: a subject's prerequisites are usually in the semesters just before it.
  const groups = new Map<number, Subject[]>()
  for (const o of options) {
    const i = termIndex(standardTerm(o))
    groups.set(i, [...(groups.get(i) ?? []), o])
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => b - a)

  return (
    <fieldset id={id} className="checklist">
      <legend>What must be passed before {subject.code}?</legend>
      {ordered.map(([i, subjects]) => (
        <div key={i} className="checklist-group">
          <p className="checklist-term">{termLabel(standardTerm(subjects[0]))}</p>
          {subjects.map((o) => (
            <label key={o.code} className="check">
              <input type="checkbox" checked={subject.prerequisites.includes(o.code)} onChange={() => onToggle(o.code)} />
              <span className="code">{o.code}</span>{' '}
              <span>{o.title}</span>
            </label>
          ))}
        </div>
      ))}
      <button type="button" className="primary" onClick={onDone}>
        Done
      </button>
    </fieldset>
  )
}
