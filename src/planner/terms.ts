import type { Term } from './types'

/** The summer term's number: a year runs 1st sem, 2nd sem, then summer. */
export const SUMMER = 3
export const SEMS_PER_YEAR = 3

/**
 * Position of a term on a single timeline: Y1-1 is 0, Y1-2 is 1, Y1 summer is 2, Y2-1 is 3, and so on.
 * Summers with nothing in them are simply skipped by the planner and the screens.
 */
export function termIndex(term: Term): number {
  return (term.year - 1) * SEMS_PER_YEAR + (term.sem - 1)
}

export function termFromIndex(index: number): Term {
  return { year: Math.floor(index / SEMS_PER_YEAR) + 1, sem: (index % SEMS_PER_YEAR) + 1 }
}

export function nextTerm(term: Term): Term {
  return termFromIndex(termIndex(term) + 1)
}

/**
 * Position counting only the regular semesters (two a year), for "1 year behind" and the like. A summer
 * counts with the 2nd sem before it.
 */
export function semesterPosition(term: Term): number {
  return (term.year - 1) * 2 + (term.sem === 1 ? 0 : 1)
}

/** "Y3-1", the key used in unit_caps.by_term and placed. Summer is "Y3-3". */
export function termKey(term: Term): string {
  return `Y${term.year}-${term.sem}`
}

/** "1st sem", "2nd sem" or "Summer". */
export function semName(sem: number): string {
  return sem === SUMMER ? 'Summer' : sem === 1 ? '1st sem' : '2nd sem'
}

/** "Year 3, 1st sem", or "Year 3, Summer". */
export function termLabel(term: Term): string {
  return `Year ${term.year}, ${semName(term.sem)}`
}

/** The reverse of termKey: "Y3-1" → { year: 3, sem: 1 }, or null if it isn't a term key. */
export function parseTermKey(key: string): Term | null {
  const match = /^Y(\d+)-([123])$/.exec(key)
  return match ? { year: Number(match[1]), sem: Number(match[2]) } : null
}
