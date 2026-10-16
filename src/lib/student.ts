// Pure edits on the student's data. Each returns a new object; nothing is changed in place.
import { nextTerm, termFromIndex, termIndex, termKey, termLabel } from '../planner'
import type { Attempt, Delay, Result, StudentData, Subject, SubjectRecord, Term } from '../planner'

export const DEFAULT_CAP = 12

export function freshStudent(): StudentData {
  return { unit_caps: { default: DEFAULT_CAP }, next_term: { year: 1, sem: 1 }, results: [] }
}

export function attemptsFor(student: StudentData, code: string): Attempt[] {
  return student.results.find((r) => r.code === code)?.attempts ?? []
}

/** What the student has recorded for a subject: Passed wins over any later attempt; otherwise the latest attempt. */
export function statusOf(attempts: Attempt[]): Result | 'Not taken' {
  if (attempts.length === 0) return 'Not taken'
  if (attempts.some((a) => a.result === 'Passed')) return 'Passed'
  return [...attempts].sort((a, b) => termIndex(b) - termIndex(a))[0].result
}

export function setAttempts(student: StudentData, code: string, attempts: Attempt[]): StudentData {
  const others = student.results.filter((r) => r.code !== code)
  const sorted = [...attempts].sort((a, b) => termIndex(a) - termIndex(b))
  const results: SubjectRecord[] = sorted.length > 0 ? [...others, { code, attempts: sorted }] : others
  return { ...student, results }
}

/** The term a new attempt defaults to: the standard term, or the next time it runs after the last attempt. */
export function defaultAttemptTerm(subject: Subject, attempts: Attempt[]): Term {
  if (attempts.length === 0) return { year: subject.standard_year, sem: subject.offered_sem }
  const last = Math.max(...attempts.map(termIndex))
  let term = nextTerm(termFromIndex(last))
  while (term.sem !== subject.offered_sem) term = nextTerm(term)
  return term
}

/** Marks every subject in the list that has no attempts yet as Passed in its standard term. */
export function markAllPassed(student: StudentData, subjects: Subject[]): StudentData {
  let next = student
  for (const s of subjects) {
    if (attemptsFor(next, s.code).length > 0) continue
    next = setAttempts(next, s.code, [{ year: s.standard_year, sem: s.offered_sem, result: 'Passed' }])
  }
  return next
}

export function setCap(student: StudentData, term: Term, cap: number): StudentData {
  const byTerm = { ...student.unit_caps.by_term }
  if (cap === student.unit_caps.default) delete byTerm[termKey(term)]
  else byTerm[termKey(term)] = cap
  return { ...student, unit_caps: { ...student.unit_caps, by_term: byTerm } }
}

/** The term after the student's latest recorded attempt, or null if nothing is recorded. */
export function termAfterResults(student: StudentData): Term | null {
  const indexes = student.results.flatMap((r) => r.attempts.map(termIndex))
  if (indexes.length === 0) return null
  const last = Math.max(...indexes)
  return nextTerm(termFromIndex(last))
}

/** One plain sentence per kind of reason, e.g. "Needs 214 passed first (not passed by Year 3, 1st sem)." */
export function describeDelay(delay: Delay, subjects: ReadonlyMap<string, Subject>): string[] {
  const lines: string[] = []
  const of = <K extends Delay['reasons'][number]['kind']>(kind: K) =>
    delay.reasons.filter((r): r is Extract<Delay['reasons'][number], { kind: K }> => r.kind === kind)

  for (const r of of('failed')) lines.push(`Failed in ${termLabel(r.term)}.`)

  const prereqs = of('prerequisite')
  if (prereqs.length > 0) {
    const missing = [...new Set(prereqs.flatMap((r) => r.missing))]
    const names = missing.map((c) => `${c} ${subjects.get(c)?.title ?? ''}`.trim())
    lines.push(
      `Needs ${joinAnd(names)} passed first (not passed by ${termLabel(prereqs[0].term)}).`,
    )
  }

  if (of('other_semester').length > 0) {
    lines.push(`Only offered in the ${delay.standardTerm.sem === 1 ? '1st' : '2nd'} sem.`)
  }

  const full = of('unit_cap')
  if (full.length > 0) {
    lines.push(`No room under the unit cap in ${joinAnd(full.map((r) => termLabel(r.term)))}.`)
  }
  return lines
}

/** "1 sem", "1 year", "1 year and 1 sem". */
export function describeGap(terms: number): string {
  const years = Math.floor(terms / 2)
  const sems = terms % 2
  const parts = []
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`)
  if (sems > 0) parts.push('1 sem')
  return parts.join(' and ')
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** "I'm taking these now": records the subjects as Ongoing in that term and plans from the term after it. */
export function startTerm(student: StudentData, term: Term, codes: string[]): StudentData {
  let next = student
  for (const code of codes) {
    next = setAttempts(next, code, [...attemptsFor(next, code), { year: term.year, sem: term.sem, result: 'Ongoing' }])
  }
  return { ...next, next_term: nextTerm(term) }
}

/** Turns a subject's Ongoing attempt into Passed or Failed. */
export function finishOngoing(student: StudentData, code: string, result: 'Passed' | 'Failed'): StudentData {
  return setAttempts(
    student,
    code,
    attemptsFor(student, code).map((a) => (a.result === 'Ongoing' ? { ...a, result } : a)),
  )
}

/** Removes a subject's Ongoing attempt (the student dropped it or didn't enrol after all). */
export function dropOngoing(student: StudentData, code: string): StudentData {
  return setAttempts(student, code, attemptsFor(student, code).filter((a) => a.result !== 'Ongoing'))
}
