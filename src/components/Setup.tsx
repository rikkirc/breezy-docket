import { useState } from 'react'
import { jdCurriculum } from '../data'
import type { Workspace } from '../lib/curriculum'
import { DEFAULT_CAP } from '../lib/student'
import { DefaultPlanReview } from './DefaultPlanReview'
import { PrerequisitesEditor } from './PrerequisitesEditor'
import { SubjectsEditor } from './SubjectsEditor'

type Step = 0 | 1 | 2

const STEPS = ['Subjects', 'Prerequisites', 'Review'] as const

interface Props {
  workspace: Workspace
  onChange: (workspace: Workspace) => void
  onFinish: () => void
  onTryDemo: () => void
}

/** First run: build the curriculum (subjects, then prerequisites), review the default plan, then start. */
export function Setup({ workspace, onChange, onFinish, onTryDemo }: Props) {
  const [step, setStep] = useState<Step>(0)
  const empty = workspace.curriculum.subjects.length === 0
  const go = (next: Step) => {
    setStep(next)
    document.scrollingElement?.scrollTo?.(0, 0)
  }

  return (
    <section aria-labelledby="setup-heading">
      <ol className="steps" aria-label="Setup steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : undefined}>
            <span className="step-number">{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <h2 id="setup-heading">Your subjects</h2>
          <p className="muted">
            Add every subject in your curriculum with its units, under the semester it's taken in the standard
            plan, from Year 1 up to graduation.
          </p>
          {empty && (
            <div className="card intro">
              <p>Studying law? Start from a sample JD curriculum (53 subjects) and edit it to match your school's.</p>
              <div className="row">
                <button
                  type="button"
                  onClick={() => onChange({ ...workspace, curriculum: { ...jdCurriculum, program: { name: jdCurriculum.program.name } } })}
                >
                  Use the sample JD curriculum
                </button>
                <button type="button" className="link" onClick={onTryDemo}>
                  Or look around with a demo student
                </button>
              </div>
            </div>
          )}
          <SubjectsEditor workspace={workspace} onChange={onChange} />
        </>
      )}

      {step === 1 && (
        <>
          <h2 id="setup-heading">Prerequisites</h2>
          <p className="muted">
            Tap a subject and tick the earlier subjects that must be passed before you can take it.
          </p>
          <PrerequisitesEditor
            curriculum={workspace.curriculum}
            onChange={(curriculum) => onChange({ ...workspace, curriculum })}
          />
        </>
      )}

      {step === 2 && (
        <>
          <h2 id="setup-heading">Review your default plan</h2>
          <p className="muted">This is the structure the app plans from. You can change it any time on the Curriculum tab.</p>
          <label className="card form cap-setting">
            <span>Most units you can take per semester</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              defaultValue={workspace.student.unit_caps.default || DEFAULT_CAP}
              onChange={(e) => {
                const cap = Number(e.target.value)
                if (Number.isInteger(cap) && cap >= 1 && cap <= 30) {
                  onChange({
                    ...workspace,
                    student: { ...workspace.student, unit_caps: { ...workspace.student.unit_caps, default: cap } },
                  })
                }
              }}
            />
            <span className="muted small-text">While working. You can set a different cap for any semester later.</span>
          </label>
          <DefaultPlanReview curriculum={workspace.curriculum} />
        </>
      )}

      <div className="wizard-nav">
        {step > 0 && (
          <button type="button" onClick={() => go((step - 1) as Step)}>
            Back
          </button>
        )}
        {step < 2 ? (
          <button type="button" className="primary" disabled={empty} onClick={() => go((step + 1) as Step)}>
            Next: {STEPS[step + 1]}
          </button>
        ) : (
          <button type="button" className="primary" onClick={onFinish}>
            Done: record my results
          </button>
        )}
      </div>
    </section>
  )
}
