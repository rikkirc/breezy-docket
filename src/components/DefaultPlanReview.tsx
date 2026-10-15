import { curriculumProblems, formatUnits, termsWithSubjects, totalUnits } from '../lib/curriculum'
import { standardGraduation, termIndex, termLabel, type Curriculum } from '../planner'

/** Step 3: the default (standard) plan the student has built, with anything that would break it. */
export function DefaultPlanReview({ curriculum }: { curriculum: Curriculum }) {
  const graduation = standardGraduation(curriculum)
  const problems = curriculumProblems(curriculum)
  const terms = termsWithSubjects(curriculum).filter((t) => t.subjects.length > 0)

  return (
    <div className="review">
      <div className="card summary summary-ok">
        <p className="summary-label">Your default plan</p>
        <p className="summary-term">{graduation ? termLabel(graduation) : '—'}</p>
        <p>
          {curriculum.subjects.length} subjects, {formatUnits(totalUnits(curriculum.subjects))}
          {graduation ? `, graduating in ${termLabel(graduation)} when nothing is delayed.` : '.'}
        </p>
      </div>

      {problems.length > 0 && (
        <div className="error problems" role="alert">
          <p>Fix these in Prerequisites, or the plan can't follow them:</p>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {terms.map(({ term, subjects }) => (
        <section key={termIndex(term)} className="card group" aria-label={termLabel(term)}>
          <div className="group-head">
            <h3>{termLabel(term)}</h3>
            <span className="muted small-text">{formatUnits(totalUnits(subjects))}</span>
          </div>
          <ul className="subjects">
            {subjects.map((s) => (
              <li key={s.code} className="subject">
                <div className="subject-line">
                  <span className="code">{s.code}</span>{' '}
                  <span className="title">{s.title}</span>
                  <span className="units">{formatUnits(s.units)}</span>
                </div>
                {s.prerequisites.length > 0 && (
                  <p className="needs small-text">Needs {s.prerequisites.join(', ')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
