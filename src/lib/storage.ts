// The student's data stays in this browser (localStorage), never on a server: grades are personal data.
import type { StudentData } from '../planner'

const KEY = 'curriculum-organizer:v1'

export interface Saved {
  student: StudentData
  /** True while the student is the made-up demo, so the app can say so. */
  isDemo: boolean
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSaved(parsed) ? parsed : null
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

function isSaved(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null) return false
  const { student, isDemo } = value as Partial<Saved>
  return (
    typeof isDemo === 'boolean' &&
    typeof student === 'object' &&
    student !== null &&
    typeof student.unit_caps?.default === 'number' &&
    typeof student.next_term?.year === 'number' &&
    typeof student.next_term?.sem === 'number' &&
    Array.isArray(student.results)
  )
}
