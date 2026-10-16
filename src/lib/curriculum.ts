// Pure edits on the student's own curriculum (the subjects, their units and prerequisites).
// Edits that rename or delete a subject also update the student's results, so the two never disagree.
import { termIndex, termLabel, type Curriculum, type StudentData, type Subject, type Term } from '../planner'

export interface Workspace {
  curriculum: Curriculum
  student: StudentData
}

export const MAX_UNITS = 12
export const MAX_YEARS = 8

export function emptyCurriculum(): Curriculum {
  return { program: { name: 'My curriculum' }, subjects: [] }
}

export function standardTerm(subject: Subject): Term {
  return { year: subject.standard_year, sem: subject.offered_sem }
}

/** Every term from Year 1, 1st sem through the last year (at least `minYears`), each with its subjects. */
export function termsWithSubjects(curriculum: Curriculum, minYears = 1): { term: Term; subjects: Subject[] }[] {
  const lastYear = Math.max(minYears, ...curriculum.subjects.map((s) => s.standard_year))
  const terms: { term: Term; subjects: Subject[] }[] = []
  for (let year = 1; year <= lastYear; year++) {
    for (const sem of [1, 2]) {
      terms.push({ term: { year, sem }, subjects: curriculum.subjects.filter((s) => s.standard_year === year && s.offered_sem === sem) })
    }
  }
  return terms
}

export interface SubjectDraft {
  code: string
  title: string
  units: number
  term: Term
}

/** Why the draft can't be saved, or null. `originalCode` is the subject being edited, if any. */
export function draftProblem(curriculum: Curriculum, draft: SubjectDraft, originalCode?: string): string | null {
  const code = draft.code.trim()
  if (!code) return 'Enter a subject code.'
  if (code !== originalCode && curriculum.subjects.some((s) => s.code === code)) {
    return `There is already a subject with code ${code}.`
  }
  if (!draft.title.trim()) return 'Enter the subject title.'
  if (!Number.isInteger(draft.units) || draft.units < 1 || draft.units > MAX_UNITS) {
    return `Units must be a whole number from 1 to ${MAX_UNITS}.`
  }
  return null
}

export function addSubject(curriculum: Curriculum, draft: SubjectDraft): Curriculum {
  const subject: Subject = {
    code: draft.code.trim(),
    title: draft.title.trim(),
    units: draft.units,
    standard_year: draft.term.year,
    offered_sem: draft.term.sem,
    prerequisites: [],
  }
  return { ...curriculum, subjects: [...curriculum.subjects, subject] }
}

/** Saves an edited subject. A new code is carried into prerequisites and results. */
export function updateSubject(ws: Workspace, originalCode: string, draft: SubjectDraft): Workspace {
  const code = draft.code.trim()
  const rename = (c: string) => (c === originalCode ? code : c)
  const subjects = ws.curriculum.subjects.map((s) =>
    s.code === originalCode
      ? {
          ...s,
          code,
          title: draft.title.trim(),
          units: draft.units,
          standard_year: draft.term.year,
          offered_sem: draft.term.sem,
        }
      : { ...s, prerequisites: s.prerequisites.map(rename) },
  )
  return {
    curriculum: { ...ws.curriculum, subjects },
    student: { ...ws.student, results: ws.student.results.map((r) => ({ ...r, code: rename(r.code) })) },
  }
}

/** Deletes a subject, removes it from other subjects' prerequisites, and drops its results. */
export function removeSubject(ws: Workspace, code: string): Workspace {
  const subjects = ws.curriculum.subjects
    .filter((s) => s.code !== code)
    .map((s) => ({ ...s, prerequisites: s.prerequisites.filter((p) => p !== code) }))
  return {
    curriculum: { ...ws.curriculum, subjects },
    student: { ...ws.student, results: ws.student.results.filter((r) => r.code !== code) },
  }
}

export function togglePrerequisite(curriculum: Curriculum, code: string, prerequisite: string): Curriculum {
  return {
    ...curriculum,
    subjects: curriculum.subjects.map((s) => {
      if (s.code !== code) return s
      const has = s.prerequisites.includes(prerequisite)
      return {
        ...s,
        prerequisites: has ? s.prerequisites.filter((p) => p !== prerequisite) : [...s.prerequisites, prerequisite],
      }
    }),
  }
}

/** Subjects that can be a prerequisite of this one: those in an earlier term of the standard plan. */
export function possiblePrerequisites(curriculum: Curriculum, subject: Subject): Subject[] {
  const index = termIndex(standardTerm(subject))
  return curriculum.subjects.filter((s) => termIndex(standardTerm(s)) < index)
}

/** Things in the curriculum that would stop the standard plan from working, in plain words. */
export function curriculumProblems(curriculum: Curriculum): string[] {
  const byCode = new Map(curriculum.subjects.map((s) => [s.code, s]))
  const problems: string[] = []
  for (const s of curriculum.subjects) {
    for (const p of s.prerequisites) {
      const prerequisite = byCode.get(p)
      if (!prerequisite) {
        problems.push(`${s.code} needs ${p}, which isn't in the curriculum.`)
      } else if (termIndex(standardTerm(prerequisite)) >= termIndex(standardTerm(s))) {
        problems.push(
          `${s.code} (${termLabel(standardTerm(s))}) needs ${p}, which comes in ${termLabel(standardTerm(prerequisite))}. A prerequisite must come in an earlier semester.`,
        )
      }
    }
  }
  return problems
}

export function totalUnits(subjects: Subject[]): number {
  return subjects.reduce((n, s) => n + s.units, 0)
}

/** "1 unit", "3 units". */
export function formatUnits(units: number): string {
  return `${units} ${units === 1 ? 'unit' : 'units'}`
}

/** Why the value isn't a usable curriculum, or null if it is. Used for localStorage and backups. */
export function curriculumProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'no curriculum found.'
  const { program, subjects } = value as Partial<Curriculum>
  if (typeof program !== 'object' || program === null || typeof program.name !== 'string') {
    return 'the curriculum has no name.'
  }
  if (!Array.isArray(subjects)) return 'the curriculum has no subject list.'
  const seen = new Set<string>()
  for (const s of subjects as unknown[]) {
    if (typeof s !== 'object' || s === null) return 'a subject is not readable.'
    const subject = s as Partial<Subject>
    if (typeof subject.code !== 'string' || !subject.code) return 'a subject has no code.'
    if (seen.has(subject.code)) return `subject ${subject.code} appears twice in the curriculum.`
    seen.add(subject.code)
    if (typeof subject.title !== 'string') return `subject ${subject.code} has no title.`
    if (!Number.isInteger(subject.units) || subject.units! < 1 || subject.units! > MAX_UNITS) {
      return `subject ${subject.code} has invalid units.`
    }
    if (!Number.isInteger(subject.standard_year) || subject.standard_year! < 1 || subject.standard_year! > MAX_YEARS) {
      return `subject ${subject.code} has an invalid year.`
    }
    if (subject.offered_sem !== 1 && subject.offered_sem !== 2) return `subject ${subject.code} has an invalid semester.`
    if (!Array.isArray(subject.prerequisites) || subject.prerequisites.some((p) => typeof p !== 'string')) {
      return `subject ${subject.code} has unreadable prerequisites.`
    }
  }
  return null
}

/** Keeps only the fields the app uses. */
export function cleanCurriculum(curriculum: Curriculum): Curriculum {
  return {
    program: { name: curriculum.program.name },
    subjects: curriculum.subjects.map((s) => ({
      code: s.code,
      title: s.title,
      units: s.units,
      standard_year: s.standard_year,
      offered_sem: s.offered_sem,
      prerequisites: [...s.prerequisites],
      ...(s.check ? { check: s.check } : {}),
    })),
  }
}
