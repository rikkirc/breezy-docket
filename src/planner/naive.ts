import { planCurriculum, type Chooser } from './planner'
import type { Curriculum, Plan, StudentData } from './types'

/**
 * The simple pass the SPEC rejects: walk the open subjects in standard-year order and take each one that
 * still fits under the cap. Kept only so a regression test can prove the real planner beats it.
 */
export const chooseInStandardOrder: Chooser = (candidates, cap, { order }) => {
  const sorted = [...candidates].sort(
    (a, b) => a.standard_year - b.standard_year || order.get(a.code)! - order.get(b.code)!,
  )
  const picks = []
  let units = 0
  for (const s of sorted) {
    if (units + s.units > cap) continue
    picks.push(s)
    units += s.units
  }
  return picks
}

export function planNaive(curriculum: Curriculum, student: StudentData): Plan {
  return planCurriculum(curriculum, student, { chooser: chooseInStandardOrder })
}
