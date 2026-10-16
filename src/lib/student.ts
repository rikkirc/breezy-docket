// Pure edits on the student's data. Each returns a new object; nothing is changed in place.
import { chooseBest, countDependents, nextTerm, planCurriculum, termFromIndex, termIndex, termKey, termLabel } from '../planner'
import type { Attempt, Curriculum, Delay, Plan, Result, StudentData, Subject, SubjectRecord, Term } from '../planner'

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

/** Switches between a fixed cap every semester and the "default" cap: each semester's full load. */
export function setCapMode(student: StudentData, fullLoad: boolean, cap = student.unit_caps.default): StudentData {
  const { full_load: _, ...rest } = student.unit_caps
  return { ...student, unit_caps: fullLoad ? { ...rest, full_load: true } : { ...rest, default: cap } }
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
  for (const r of of('postponed')) lines.push(`You chose not to take it in ${termLabel(r.term)}.`)

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

/** Records (or changes) a subject's result in a semester. One attempt per subject per semester. */
export function recordResult(student: StudentData, code: string, term: Term, result: Result): StudentData {
  const attempts = attemptsFor(student, code)
  const same = (a: Attempt) => termIndex(a) === termIndex(term)
  const next = attempts.some(same)
    ? attempts.map((a) => (same(a) ? { ...a, result } : a))
    : [...attempts, { year: term.year, sem: term.sem, result }]
  return setAttempts(student, code, next)
}

/** Removes a subject's result in a semester (it goes back to being planned). */
export function removeResult(student: StudentData, code: string, term: Term): StudentData {
  return setAttempts(student, code, attemptsFor(student, code).filter((a) => termIndex(a) !== termIndex(term)))
}

/** Plans a subject in a chosen term ("Not this sem", "Move"). Subjects that need it follow through the prerequisite rules. */
export function placeSubject(student: StudentData, code: string, term: Term): StudentData {
  return { ...student, placed: { ...student.placed, [code]: termKey(term) } }
}

/** "Not this sem": the subject (offered in `term`'s semester) goes to the next time it's offered, a year later. */
export function postpone(student: StudentData, code: string, term: Term): StudentData {
  return placeSubject(student, code, { year: term.year + 1, sem: term.sem })
}

/** Undoes a move: the app plans the subject again. */
export function unplace(student: StudentData, code: string): StudentData {
  const placed = { ...student.placed }
  delete placed[code]
  return { ...student, placed }
}

/**
 * Semesters a planned subject can move to: later than where it's planned now, in the semester it's offered,
 * after every prerequisite is passed or planned, up to a year past the end of the plan.
 */
export function moveTargets(curriculum: Curriculum, plan: Plan, student: StudentData, code: string, from: number): Term[] {
  const subject = curriculum.subjects.find((s) => s.code === code)
  const plannedIndex = new Map<string, number>()
  for (const t of plan.terms) for (const s of t.subjects) plannedIndex.set(s.code, termIndex(t.term))
  const current = plannedIndex.get(code)
  if (!subject || current === undefined) return []

  // When each prerequisite is (or will be) done: its passing or ongoing attempt, else where it's planned.
  let after = -1
  for (const p of subject.prerequisites) {
    if (!curriculum.subjects.some((s) => s.code === p)) continue
    const attempt = attemptsFor(student, p).find((a) => a.result !== 'Failed')
    const done = attempt ? termIndex(attempt) : plannedIndex.get(p)
    if (done === undefined) return []
    after = Math.max(after, done)
  }

  const last = Math.max(current, ...plannedIndex.values()) + 2
  const targets: Term[] = []
  // Only later: never back before the semester it's in now.
  for (let i = Math.max(from, after + 1, current + 1); i <= last; i++) {
    const term = termFromIndex(i)
    if (term.sem === subject.offered_sem) targets.push(term)
  }
  return targets
}

/**
 * "Fit to the cap" for one over-cap semester: keeps the subjects the planner would choose (those others
 * depend on first, then the most units) and moves the rest to their next offering, a year later.
 * Subjects recorded in that semester stay; they count against the cap.
 */
export function fitTerm(curriculum: Curriculum, plan: Plan, student: StudentData, term: Term, cap: number): StudentData {
  const planned = plan.terms.find((t) => termIndex(t.term) === termIndex(term))
  if (!planned) return student
  const byCode = new Map(curriculum.subjects.map((s) => [s.code, s]))
  const recordedUnits = student.results
    .filter((r) => r.attempts.some((a) => termIndex(a) === termIndex(term)))
    .reduce((n, r) => n + (byCode.get(r.code)?.units ?? 0), 0)
  const subjects = planned.subjects.map((s) => byCode.get(s.code)).filter((s): s is Subject => s !== undefined)
  const remaining = curriculum.subjects.filter((s) => statusOf(attemptsFor(student, s.code)) !== 'Passed')
  const context = {
    dependents: countDependents(remaining),
    order: new Map(curriculum.subjects.map((s, i) => [s.code, i])),
  }
  const keep = new Set(chooseBest(subjects, Math.max(0, cap - recordedUnits), context).map((s) => s.code))
  return subjects
    .filter((s) => !keep.has(s.code))
    .reduce((st, s) => placeSubject(st, s.code, { year: term.year + 1, sem: term.sem }), student)
}

/** Subjects that need `code` and are planned within the next two semesters after `term`: moving it later blocks them. */
export function blockedByMoving(curriculum: Curriculum, plan: Plan, code: string, term: Term): { subject: Subject; term: Term }[] {
  const from = termIndex(term)
  const blocked: { subject: Subject; term: Term }[] = []
  for (const t of plan.terms) {
    const i = termIndex(t.term)
    if (i <= from || i > from + 2) continue
    for (const s of t.subjects) {
      const subject = curriculum.subjects.find((x) => x.code === s.code)
      if (subject?.prerequisites.includes(code)) blocked.push({ subject, term: t.term })
    }
  }
  return blocked
}

/** For a subject being taken now: the planned subjects that need it passed, earliest first. */
export function neededNext(curriculum: Curriculum, plan: Plan, code: string): { subject: Subject; term: Term }[] {
  const needed: { subject: Subject; term: Term }[] = []
  for (const t of plan.terms) {
    for (const s of t.subjects) {
      const subject = curriculum.subjects.find((x) => x.code === s.code)
      if (subject?.prerequisites.includes(code)) needed.push({ subject, term: t.term })
    }
  }
  return needed.sort((a, b) => termIndex(a.term) - termIndex(b.term))
}

/** The graduation term if the student fails a subject they're taking in `term` (null: can't finish). */
export function graduationIfFailed(curriculum: Curriculum, student: StudentData, code: string, term: Term): Term | null {
  return planCurriculum(curriculum, recordResult(student, code, term, 'Failed'), { overCap: 'flag' }).graduation
}
