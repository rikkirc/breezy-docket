import type { Term } from './types'

export const SEMS_PER_YEAR = 2

/** Position of a term on a single timeline: Y1-1 is 0, Y1-2 is 1, Y2-1 is 2, and so on. */
export function termIndex(term: Term): number {
  return (term.year - 1) * SEMS_PER_YEAR + (term.sem - 1)
}

export function termFromIndex(index: number): Term {
  return { year: Math.floor(index / SEMS_PER_YEAR) + 1, sem: (index % SEMS_PER_YEAR) + 1 }
}

export function nextTerm(term: Term): Term {
  return termFromIndex(termIndex(term) + 1)
}

/** "Y3-1", the key used in unit_caps.by_term. */
export function termKey(term: Term): string {
  return `Y${term.year}-${term.sem}`
}

/** "Year 3, 1st sem". */
export function termLabel(term: Term): string {
  return `Year ${term.year}, ${term.sem === 1 ? '1st' : '2nd'} sem`
}
