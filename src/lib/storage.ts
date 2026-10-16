// The student's data stays in this browser (localStorage), never on a server: grades are personal data.
import { demoStudent, jdCurriculum } from '../data'
import type { Curriculum, StudentData } from '../planner'
import { placedOf, studentProblem } from './backup'
import { curriculumProblem, emptyCurriculum } from './curriculum'
import { freshStudent } from './student'

const KEY = 'curriculum-organizer:v1'

export interface Saved {
  /** The student's own curriculum: subjects, units and prerequisites. */
  curriculum: Curriculum
  student: StudentData
  /** True while the student is the made-up demo, so the app can say so. */
  isDemo: boolean
  /** False until the student has entered their subjects and prerequisites and reviewed the default plan. */
  setupDone: boolean
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return fromStored(JSON.parse(raw))
  } catch {
    return null
  }
}

export function save(saved: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Private mode or full storage: the app still works, it just won't remember.
  }
}

/**
 * Checks what was stored. Data saved before the curriculum was editable has no curriculum: it was made
 * with the JD curriculum, so it keeps that one and skips setup.
 */
export function fromStored(value: unknown): Saved | null {
  if (typeof value !== 'object' || value === null) return null
  const stored = value as Partial<Saved>
  if (typeof stored.isDemo !== 'boolean' || studentProblem(stored.student) !== null) return null
  const placed = placedOf(stored.student!)
  const { not_before: _, ...rest } = stored.student as StudentData & { not_before?: unknown }
  const student: StudentData = { ...rest, ...(placed ? { placed } : {}) }
  if (stored.curriculum === undefined) {
    return { curriculum: jdCurriculum, student, isDemo: stored.isDemo, setupDone: true }
  }
  if (curriculumProblem(stored.curriculum) !== null) return null
  return {
    curriculum: stored.curriculum,
    student,
    isDemo: stored.isDemo,
    setupDone: stored.setupDone !== false,
  }
}

/** A first visit: an empty curriculum and the setup steps. */
export function initialSaved(): Saved {
  return { curriculum: emptyCurriculum(), student: freshStudent(), isDemo: false, setupDone: false }
}

/** The made-up demo student on the Xavier University - School of Law curriculum. */
export function demoSaved(): Saved {
  return { curriculum: jdCurriculum, student: demoStudent, isDemo: true, setupDone: true }
}
