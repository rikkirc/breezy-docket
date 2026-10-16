// Curriculum templates: the student's subjects, units and prerequisites saved under a name, in this browser.
import type { Curriculum } from '../planner'
import { cleanCurriculum, curriculumProblem } from './curriculum'

const KEY = 'curriculum-organizer:templates'

export interface Template {
  name: string
  savedAt: string
  curriculum: Curriculum
}

export function loadTemplates(): Template[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is Template =>
        typeof t === 'object' && t !== null && typeof t.name === 'string' && curriculumProblem(t.curriculum) === null,
    )
  } catch {
    return []
  }
}

/** Saves (or replaces, by name) a template and returns the new list. */
export function saveTemplate(name: string, curriculum: Curriculum, now = new Date()): Template[] {
  const trimmed = name.trim()
  const template: Template = {
    name: trimmed,
    savedAt: now.toISOString(),
    curriculum: { ...cleanCurriculum(curriculum), program: { name: trimmed } },
  }
  const templates = [...loadTemplates().filter((t) => t.name !== trimmed), template]
  write(templates)
  return templates
}

export function deleteTemplate(name: string): Template[] {
  const templates = loadTemplates().filter((t) => t.name !== name)
  write(templates)
  return templates
}

function write(templates: Template[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(templates))
  } catch {
    // Private mode or full storage: templates just aren't kept.
  }
}
