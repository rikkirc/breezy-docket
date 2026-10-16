import { useState } from 'react'
import type { Workspace } from '../lib/curriculum'
import { CapChoice } from './CapChoice'
import { DefaultPlanReview } from './DefaultPlanReview'
import { PrerequisitesEditor } from './PrerequisitesEditor'
import { SubjectsEditor } from './SubjectsEditor'
import { SaveTemplate, TemplatePicker } from './Templates'

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
          <div className="card intro">
            <TemplatePicker hasSubjects={!empty} onLoad={(curriculum) => onChange({ ...workspace, curriculum })} />
            {empty && (
              <button type="button" className="link" onClick={onTryDemo}>
                Or look around with a demo student
              </button>
            )}
          </div>
          <SubjectsEditor workspace={workspace} onChange={onChange} />
          <SaveTemplate curriculum={workspace.curriculum} />
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
          <div className="card form">
            <CapChoice
              curriculum={workspace.curriculum}
              student={workspace.student}
              onChange={(student) => onChange({ ...workspace, student })}
            />
            <p className="muted small-text">You can change this, or set a different cap for one semester, later.</p>
          </div>
          <DefaultPlanReview curriculum={workspace.curriculum} />
          <SaveTemplate curriculum={workspace.curriculum} />
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
            Done: go to Working Subjects
          </button>
        )}
      </div>
    </section>
  )
}
