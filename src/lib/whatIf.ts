// What-if scenarios: each returns an edited copy of the student to plan with, never saved.
import { nextTerm, parseTermKey, termIndex, type Plan, type StudentData, type Term } from '../planner'
import { attemptsFor, setAttempts } from './student'

/**
 * "This sem" is the semester in progress: the subjects marked Ongoing if there are any, otherwise the
 * first semester of the plan. Returns the codes that could be failed in it.
 */
export function thisSemSubjects(student: StudentData, plan: Plan): { term: Term | null; codes: string[] } {
  if (plan.ongoing.length > 0) {
    const terms = plan.ongoing.flatMap((code) =>
      attemptsFor(student, code).filter((a) => a.result === 'Ongoing'),
    )
    const latest = terms.sort((a, b) => termIndex(b) - termIndex(a))[0]
    return { term: latest ? { year: latest.year, sem: latest.sem } : null, codes: plan.ongoing }
  }
  const first = plan.terms[0]
  return first ? { term: first.term, codes: first.subjects.map((s) => s.code) } : { term: null, codes: [] }
}

/** What if the student fails one subject this sem (and passes the rest of it)? */
export function failThisSem(student: StudentData, plan: Plan, code: string): StudentData {
  if (plan.ongoing.includes(code)) {
    const attempts = attemptsFor(student, code).map((a) =>
      a.result === 'Ongoing' ? { ...a, result: 'Failed' as const } : a,
    )
    return setAttempts(student, code, attempts)
  }
  const first = plan.terms[0]
  if (!first || !first.subjects.some((s) => s.code === code)) return student

  // Take the first planned semester as planned: everything passes except the one subject.
  let next = student
  for (const s of first.subjects) {
    const result = s.code === code ? ('Failed' as const) : ('Passed' as const)
    next = setAttempts(next, s.code, [...attemptsFor(next, s.code), { ...first.term, result }])
  }
  return { ...next, next_term: nextTerm(first.term) }
}

/** What if the student takes this many units every semester from now on? */
export function capFromNow(student: StudentData, cap: number): StudentData {
  const pastOnly = Object.fromEntries(
    Object.entries(student.unit_caps.by_term ?? {}).filter(([key]) => {
      const term = parseTermKey(key)
      return term !== null && termIndex(term) < termIndex(student.next_term)
    }),
  )
  // A fixed number every semester, so the full-load setting is dropped too.
  return { ...student, unit_caps: { default: cap, by_term: pastOnly } }
}
