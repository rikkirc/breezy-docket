import { nextTerm, termFromIndex, termIndex, termKey, termLabel } from './terms'
import type {
  Curriculum,
  Delay,
  DelayReason,
  Plan,
  PlannedTerm,
  StudentData,
  Subject,
  Term,
} from './types'

/** The last term of the standard plan: the latest standard term of any subject (Year 4, 2nd sem for the JD). */
export function standardGraduation(curriculum: Curriculum): Term | null {
  let last: Term | null = null
  for (const s of curriculum.subjects) {
    const term = { year: s.standard_year, sem: s.offered_sem }
    if (!last || termIndex(term) > termIndex(last)) last = term
  }
  return last
}

/** Stop looking once this many terms in a row have nothing that can be planned. */
const MAX_EMPTY_TERMS = 4

/** Picks the subjects to take in one term from the candidates that are open in it. */
export type Chooser = (candidates: Subject[], cap: number, context: ChooserContext) => Subject[]

export interface ChooserContext {
  /** For each remaining subject, how many remaining subjects depend on it, directly or through a chain. */
  dependents: Map<string, number>
  /** Position of each subject in the curriculum file, for stable tie-breaks. */
  order: Map<string, number>
}

export interface PlanOptions {
  chooser?: Chooser
}

/** The cap for a term before any per-term override: the default number, or the term's full load. */
export function baseCapFor(curriculum: Curriculum, student: StudentData, term: Term): number {
  return student.unit_caps.full_load ? fullLoadFor(curriculum, term) : student.unit_caps.default
}

export function capFor(curriculum: Curriculum, student: StudentData, term: Term): number {
  return student.unit_caps.by_term?.[termKey(term)] ?? baseCapFor(curriculum, student, term)
}

/**
 * The units of the subjects standardly taken in that term. A term with none (e.g. past the standard plan,
 * where delayed subjects land) gets the largest full load of any term.
 */
export function fullLoadFor(curriculum: Curriculum, term: Term): number {
  const loads = new Map<number, number>()
  for (const s of curriculum.subjects) {
    const i = termIndex({ year: s.standard_year, sem: s.offered_sem })
    loads.set(i, (loads.get(i) ?? 0) + s.units)
  }
  return loads.get(termIndex(term)) || Math.max(0, ...loads.values())
}

/**
 * Plans every subject the student hasn't passed into future terms, starting at student.next_term.
 * Pure: the inputs are not changed, so a what-if is just a call with edited inputs.
 */
export function planCurriculum(
  curriculum: Curriculum,
  student: StudentData,
  options: PlanOptions = {},
): Plan {
  const chooser = options.chooser ?? chooseBest
  const subjects = new Map(curriculum.subjects.map((s) => [s.code, s]))
  const order = new Map(curriculum.subjects.map((s, i) => [s.code, i]))

  const passed = new Set<string>()
  const ongoing = new Set<string>()
  for (const record of student.results) {
    if (record.attempts.some((a) => a.result === 'Passed')) passed.add(record.code)
    else if (record.attempts.some((a) => a.result === 'Ongoing')) ongoing.add(record.code)
  }

  // Ongoing counts as passed for planning; dependents carry a warning instead.
  const done = new Set([...passed, ...ongoing])
  const remaining = curriculum.subjects.filter((s) => !done.has(s.code))
  const context: ChooserContext = { dependents: countDependents(remaining), order }

  const terms: PlannedTerm[] = []
  const plannedIn = new Map<string, Term>()
  let open = [...remaining]
  let term = student.next_term
  let emptyStreak = 0

  while (open.length > 0 && emptyStreak < MAX_EMPTY_TERMS) {
    const cap = capFor(curriculum, student, term)
    const candidates = open.filter(
      (s) =>
        s.offered_sem === term.sem &&
        s.units <= cap &&
        s.prerequisites.every((p) => done.has(p) || !subjects.has(p)),
    )
    const chosen = chooser(candidates, cap, context).sort(
      (a, b) => order.get(a.code)! - order.get(b.code)!,
    )

    if (chosen.length === 0) {
      emptyStreak++
    } else {
      emptyStreak = 0
      terms.push({
        term,
        label: termLabel(term),
        cap,
        units: sumUnits(chosen),
        subjects: chosen.map((s) => ({
          code: s.code,
          title: s.title,
          units: s.units,
          warnings: s.prerequisites
            .filter((p) => ongoing.has(p))
            .map((p) => `Assumes ${p} (still Ongoing) will be passed.`),
        })),
      })
      for (const s of chosen) plannedIn.set(s.code, term)
      const chosenCodes = new Set(chosen.map((s) => s.code))
      open = open.filter((s) => !chosenCodes.has(s.code))
    }

    // Subjects taken this term count as passed from the next term on.
    for (const s of chosen) done.add(s.code)
    term = nextTerm(term)
  }

  const unplanned = open.map((s) => s.code)
  const standard = standardGraduation(curriculum)
  const graduation =
    unplanned.length > 0 ? null : (terms.at(-1)?.term ?? lastAttemptTerm(student))

  return {
    terms,
    graduation,
    standardGraduation: standard,
    termsBehind: graduation && standard ? termIndex(graduation) - termIndex(standard) : null,
    delays: findDelays(curriculum, student, terms, plannedIn),
    unplanned,
    ongoing: [...ongoing],
  }
}

/**
 * The SPEC's choice rule, tried over every combination of candidates that fits the cap:
 * 1. prefer subjects other subjects depend on, 2. then fill as many units as possible,
 * 3. then prefer the earliest standard_year.
 */
export const chooseBest: Chooser = (candidates, cap, { dependents, order }) => {
  const sorted = [...candidates].sort((a, b) => order.get(a.code)! - order.get(b.code)!)
  let best: { picks: Subject[]; score: Score } = { picks: [], score: scoreOf([], dependents) }

  const search = (start: number, picks: Subject[], units: number) => {
    const score = scoreOf(picks, dependents)
    if (compareScores(score, best.score) < 0) best = { picks: [...picks], score }
    for (let i = start; i < sorted.length; i++) {
      const s = sorted[i]
      if (units + s.units > cap) continue
      picks.push(s)
      search(i + 1, picks, units + s.units)
      picks.pop()
    }
  }
  search(0, [], 0)
  return best.picks
}

interface Score {
  dependents: number
  units: number
  /** Units weighted by standard_year: lower means earlier-year subjects. */
  yearUnits: number
  key: string
}

function scoreOf(picks: Subject[], dependents: Map<string, number>): Score {
  return {
    dependents: picks.reduce((n, s) => n + (dependents.get(s.code) ?? 0), 0),
    units: sumUnits(picks),
    yearUnits: picks.reduce((n, s) => n + s.units * s.standard_year, 0),
    key: picks.map((s) => s.code).join(','),
  }
}

/** Negative when a is the better choice. */
function compareScores(a: Score, b: Score): number {
  return (
    b.dependents - a.dependents ||
    b.units - a.units ||
    a.yearUnits - b.yearUnits ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  )
}

/** For each subject, the number of subjects in the list that need it, directly or through a chain. */
export function countDependents(subjects: Subject[]): Map<string, number> {
  const directDependents = new Map<string, string[]>()
  for (const s of subjects) {
    for (const p of s.prerequisites) {
      directDependents.set(p, [...(directDependents.get(p) ?? []), s.code])
    }
  }
  const counts = new Map<string, number>()
  for (const s of subjects) {
    const seen = new Set<string>()
    const stack = [...(directDependents.get(s.code) ?? [])]
    while (stack.length > 0) {
      const code = stack.pop()!
      if (seen.has(code)) continue
      seen.add(code)
      stack.push(...(directDependents.get(code) ?? []))
    }
    counts.set(s.code, seen.size)
  }
  return counts
}

/**
 * A planned subject is delayed when it lands after its standard term (standard_year, offered_sem).
 * For each term from the standard term up to the planned one, say why it wasn't taken then.
 */
function findDelays(
  curriculum: Curriculum,
  student: StudentData,
  terms: PlannedTerm[],
  plannedIn: Map<string, Term>,
): Delay[] {
  const takenBy = new Map<string, number>()
  for (const t of terms) for (const s of t.subjects) takenBy.set(s.code, termIndex(t.term))
  const passedBy = new Map<string, number>()
  for (const record of student.results) {
    for (const a of record.attempts) {
      if (a.result === 'Failed') continue
      const index = termIndex(a)
      passedBy.set(record.code, Math.min(index, passedBy.get(record.code) ?? Infinity))
    }
  }
  for (const [code, index] of takenBy) passedBy.set(code, index)

  const failedIn = new Map<string, Set<number>>()
  for (const record of student.results) {
    failedIn.set(
      record.code,
      new Set(record.attempts.filter((a) => a.result === 'Failed').map(termIndex)),
    )
  }

  const startIndex = termIndex(student.next_term)
  const delays: Delay[] = []
  for (const subject of curriculum.subjects) {
    const planned = plannedIn.get(subject.code)
    if (!planned) continue
    const standardTerm = { year: subject.standard_year, sem: subject.offered_sem }
    const from = termIndex(standardTerm)
    const to = termIndex(planned)
    if (to <= from) continue

    const reasons: DelayReason[] = []
    for (let i = from; i < to; i++) {
      const term = termFromIndex(i)
      if (i < startIndex) {
        if (failedIn.get(subject.code)?.has(i)) reasons.push({ kind: 'failed', term })
        continue
      }
      if (subject.offered_sem !== term.sem) {
        reasons.push({ kind: 'other_semester', term })
        continue
      }
      const missing = subject.prerequisites.filter((p) => !((passedBy.get(p) ?? Infinity) < i))
      if (missing.length > 0) reasons.push({ kind: 'prerequisite', term, missing })
      else reasons.push({ kind: 'unit_cap', term })
    }
    delays.push({ code: subject.code, standardTerm, plannedTerm: planned, reasons })
  }
  return delays
}

function lastAttemptTerm(student: StudentData): Term | null {
  let last: Term | null = null
  for (const record of student.results) {
    for (const a of record.attempts) {
      if (!last || termIndex(a) > termIndex(last)) last = { year: a.year, sem: a.sem }
    }
  }
  return last
}

function sumUnits(subjects: Subject[]): number {
  return subjects.reduce((n, s) => n + s.units, 0)
}
