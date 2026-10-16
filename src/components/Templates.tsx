import { useState } from 'react'
import { jdCurriculum } from '../data'
import { formatUnits, totalUnits } from '../lib/curriculum'
import { deleteTemplate, loadTemplates, saveTemplate, type Template } from '../lib/templates'
import type { Curriculum } from '../planner'

/** At the start of setup: begin from a saved template or the sample JD curriculum. */
export function TemplatePicker({
  hasSubjects,
  onLoad,
}: {
  hasSubjects: boolean
  onLoad: (curriculum: Curriculum) => void
}) {
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates())
  const load = (curriculum: Curriculum, name: string) => {
    if (!hasSubjects || window.confirm(`Replace the subjects you've entered with "${name}"?`)) onLoad(curriculum)
  }

  return (
    <div className="templates">
      <p className="templates-label">Start from a template</p>
      <ul className="template-list">
        {templates.map((t) => (
          <li key={t.name} className="template">
            <button type="button" className="template-load" onClick={() => load(t.curriculum, t.name)}>
              <span className="template-name">{t.name}</span>
              <span className="muted small-text">
                {t.curriculum.subjects.length} subjects, {formatUnits(totalUnits(t.curriculum.subjects))}
              </span>
            </button>
            <button
              type="button"
              className="chip-remove"
              aria-label={`Delete the template ${t.name}`}
              onClick={() => {
                if (window.confirm(`Delete the template "${t.name}"? Your current subjects are not affected.`)) {
                  setTemplates(deleteTemplate(t.name))
                }
              }}
            >
              ×
            </button>
          </li>
        ))}
        <li className="template">
          <button type="button" className="template-load" onClick={() => load(jdCurriculum, 'the sample JD curriculum')}>
            <span className="template-name">Sample JD curriculum</span>
            <span className="muted small-text">
              {jdCurriculum.subjects.length} subjects, {formatUnits(totalUnits(jdCurriculum.subjects))} · for law students
            </span>
          </button>
        </li>
      </ul>
    </div>
  )
}

/** Saves the current subjects, units and prerequisites as a named template in this browser. */
export function SaveTemplate({ curriculum }: { curriculum: Curriculum }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  if (curriculum.subjects.length === 0) return null
  const taken = loadTemplates().some((t) => t.name === name.trim())

  return (
    <form
      className="card form save-template"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        if (taken && !window.confirm(`Replace the template "${name.trim()}"?`)) return
        saveTemplate(name, curriculum)
        setSaved(name.trim())
        setName('')
      }}
    >
      <label>
        <span>Save these subjects as a template</span>
        <span className="row">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(null)
            }}
            placeholder="e.g. JD – Evening program"
            aria-label="Template name"
            autoComplete="off"
          />
          <button type="submit" disabled={!name.trim()}>
            Save template
          </button>
        </span>
        <span className="muted small-text">
          Keeps the subjects, units and prerequisites so you can start from them again. Saved in this browser.
        </span>
      </label>
      {saved && (
        <p className="notice" role="status">
          Saved "{saved}".
        </p>
      )}
    </form>
  )
}
