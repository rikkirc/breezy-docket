import { useState } from 'react'
import { curriculumProblems, type Workspace } from '../lib/curriculum'
import { DefaultPlanReview } from './DefaultPlanReview'
import { PrerequisitesEditor } from './PrerequisitesEditor'
import { SubjectsEditor } from './SubjectsEditor'
import { SaveTemplate } from './Templates'

type Part = 'subjects' | 'prerequisites' | 'review'

const PARTS: { id: Part; label: string }[] = [
  { id: 'subjects', label: 'Subjects' },
  { id: 'prerequisites', label: 'Prerequisites' },
  { id: 'review', label: 'Default plan' },
]

/** After setup: edit the curriculum any time. Changes re-plan right away. */
export function CurriculumView({ workspace, onChange }: { workspace: Workspace; onChange: (ws: Workspace) => void }) {
  const [part, setPart] = useState<Part>('subjects')
  const problems = curriculumProblems(workspace.curriculum)

  return (
    <section aria-labelledby="curriculum-heading">
      <h2 id="curriculum-heading">Curriculum</h2>
      <p className="muted">Your subjects, units and prerequisites. Changes update your plan right away.</p>
      <div className="segmented" role="group" aria-label="Curriculum part">
        {PARTS.map((p) => (
          <button key={p.id} type="button" aria-pressed={part === p.id} onClick={() => setPart(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {problems.length > 0 && part !== 'review' && (
        <p className="error">
          {problems.length === 1 ? '1 problem' : `${problems.length} problems`} with prerequisites. See Default plan.
        </p>
      )}
      {part === 'subjects' && <SubjectsEditor workspace={workspace} onChange={onChange} />}
      {part === 'prerequisites' && (
        <PrerequisitesEditor
          curriculum={workspace.curriculum}
          onChange={(curriculum) => onChange({ ...workspace, curriculum })}
        />
      )}
      {part === 'review' && <DefaultPlanReview curriculum={workspace.curriculum} />}
      <SaveTemplate curriculum={workspace.curriculum} />
    </section>
  )
}
