// The five acceptance tests from SPEC.md, plus a few sanity checks.
import { describe, expect, test } from 'vitest'
import curriculumJson from '../../data/jd-curriculum.json'
import demoJson from '../../data/demo-student.json'
import { capFor, fullLoadFor, planCurriculum, termIndex, type Curriculum, type Plan, type StudentData } from '.'
import { planNaive } from './naive'

const curriculum = curriculumJson as Curriculum
const demo = demoJson as StudentData

/** A new student with nothing taken yet and the same cap every term. */
function freshStudent(cap: number): StudentData {
  return { unit_caps: { default: cap }, next_term: { year: 1, sem: 1 }, results: [] }
}

/** Returns every broken planning rule, so a failure names the subject and term. */
function ruleViolations(plan: Plan, student: StudentData): string[] {
  const subjects = new Map(curriculum.subjects.map((s) => [s.code, s]))
  const doneBy = new Map<string, number>()
  for (const r of student.results) {
    for (const a of r.attempts) {
      if (a.result !== 'Failed') doneBy.set(r.code, Math.min(termIndex(a), doneBy.get(r.code) ?? Infinity))
    }
  }
  for (const t of plan.terms) for (const s of t.subjects) doneBy.set(s.code, termIndex(t.term))

  const problems: string[] = []
  for (const t of plan.terms) {
    const units = t.subjects.reduce((n, s) => n + s.units, 0)
    if (units > capFor(curriculum, student, t.term)) problems.push(`${t.label}: ${units} units over the cap`)
    if (units !== t.units) problems.push(`${t.label}: reports ${t.units} units but has ${units}`)
    for (const planned of t.subjects) {
      const s = subjects.get(planned.code)!
      if (s.offered_sem !== t.term.sem) problems.push(`${s.code} in ${t.label}, the wrong semester`)
      for (const p of s.prerequisites) {
        if (!((doneBy.get(p) ?? Infinity) < termIndex(t.term))) {
          problems.push(`${s.code} in ${t.label} before its prerequisite ${p}`)
        }
      }
    }
  }
  const planned = plan.terms.flatMap((t) => t.subjects.map((s) => s.code))
  if (new Set(planned).size !== planned.length) problems.push('a subject is planned twice')
  return problems
}

describe('acceptance tests (SPEC.md)', () => {
  test('1. standard student: nothing failed, cap 21, graduates Year 4, 2nd sem', () => {
    const plan = planCurriculum(curriculum, freshStudent(21))
    expect(plan.unplanned).toEqual([])
    expect(plan.graduation).toEqual({ year: 4, sem: 2 })
    expect(plan.termsBehind).toBe(0)
  })

  test('2. demo student: failed 214, cap 12 from Year 3, graduates Year 5, 2nd sem with full 1st sems', () => {
    const plan = planCurriculum(curriculum, demo)
    expect(plan.graduation).toEqual({ year: 5, sem: 2 })
    expect(plan.termsBehind).toBe(2)

    const firstSems = plan.terms.filter((t) => t.term.sem === 1)
    expect(firstSems.map((t) => t.label)).toEqual([
      'Year 3, 1st sem',
      'Year 4, 1st sem',
      'Year 5, 1st sem',
    ])
    for (const t of firstSems) expect(t.units, t.label).toBe(12)
  })

  test('3. regression: the planner beats the simple standard-order fill (Year 6, 2nd sem)', () => {
    const naive = planNaive(curriculum, demo)
    expect(naive.graduation).toEqual({ year: 6, sem: 2 })

    const plan = planCurriculum(curriculum, demo)
    expect(termIndex(plan.graduation!)).toBeLessThan(termIndex(naive.graduation!))
  })

  describe('4. rules hold in every plan', () => {
    const failed = (code: string, year: number, sem: number) => ({
      code,
      attempts: [{ year, sem, result: 'Failed' as const }],
    })
    const cases: [string, StudentData][] = [
      ['standard, cap 21', freshStudent(21)],
      ['fresh, cap 12', freshStudent(12)],
      ['fresh, cap 9', freshStudent(9)],
      ['fresh, cap 15', freshStudent(15)],
      ['demo student', demo],
      ['demo student, cap 15', { ...demo, unit_caps: { ...demo.unit_caps, default: 15 } }],
      [
        'demo student, also failed Evidence (212) and Sales (216)',
        {
          ...demo,
          results: [
            ...demo.results.filter((r) => r.code !== '212' && r.code !== '216'),
            failed('212', 2, 2),
            failed('216', 2, 2),
          ],
        },
      ],
    ]

    test.each(cases)('%s', (_, student) => {
      const plan = planCurriculum(curriculum, student)
      expect(plan.unplanned).toEqual([])
      expect(ruleViolations(plan, student)).toEqual([])
    })

    test('the naive fill obeys the rules too (it is only slower)', () => {
      expect(ruleViolations(planNaive(curriculum, demo), demo)).toEqual([])
    })
  })

  test('5. delay reasons: Commercial Laws I (305) waits because 214 is not passed yet', () => {
    const plan = planCurriculum(curriculum, demo)
    const delay = plan.delays.find((d) => d.code === '305')
    expect(delay?.standardTerm).toEqual({ year: 3, sem: 1 })
    expect(delay?.plannedTerm).toEqual({ year: 4, sem: 1 })
    expect(delay?.reasons).toContainEqual({
      kind: 'prerequisite',
      term: { year: 3, sem: 1 },
      missing: ['214'],
    })
  })
})

describe('planner details', () => {
  test('every remaining subject is planned exactly once', () => {
    const plan = planCurriculum(curriculum, demo)
    const passed = demo.results.filter((r) => r.attempts.some((a) => a.result === 'Passed'))
    const planned = plan.terms.flatMap((t) => t.subjects)
    expect(planned.length + passed.length).toBe(curriculum.subjects.length)
    expect(planned.reduce((n, s) => n + s.units, 0)).toBe(71)
  })

  test('the failed subject itself is delayed because it was failed', () => {
    const delay = planCurriculum(curriculum, demo).delays.find((d) => d.code === '214')
    expect(delay?.plannedTerm).toEqual({ year: 3, sem: 1 })
    expect(delay?.reasons).toContainEqual({ kind: 'failed', term: { year: 2, sem: 1 } })
  })

  test('Ongoing counts as passed for planning, with a warning on what depends on it', () => {
    const student: StudentData = {
      ...demo,
      results: [
        ...demo.results.filter((r) => r.code !== '214'),
        { code: '214', attempts: [{ year: 3, sem: 1, result: 'Ongoing' }] },
      ],
      next_term: { year: 3, sem: 2 },
    }
    const plan = planCurriculum(curriculum, student)
    expect(plan.ongoing).toEqual(['214'])
    const commercial2 = plan.terms.flatMap((t) => t.subjects).find((s) => s.code === '315')
    expect(commercial2?.warnings).toEqual(['Assumes 214 (still Ongoing) will be passed.'])
    expect(plan.terms[0].subjects.map((s) => s.code)).toContain('315')
  })

  test('a cap too small for a subject leaves it unplanned instead of looping forever', () => {
    const plan = planCurriculum(curriculum, freshStudent(4))
    expect(plan.graduation).toBeNull()
    expect(plan.unplanned).toContain('111')
  })

  test('the inputs are not changed', () => {
    const before = JSON.stringify(demo)
    planCurriculum(curriculum, demo)
    expect(JSON.stringify(demo)).toBe(before)
  })
})

describe('the Default cap (full load of each semester)', () => {
  const fullLoad = (student: StudentData): StudentData => ({
    ...student,
    unit_caps: { ...student.unit_caps, full_load: true },
  })

  test('full load per semester comes from the curriculum; later semesters use the largest', () => {
    expect(fullLoadFor(curriculum, { year: 1, sem: 1 })).toBe(18)
    expect(fullLoadFor(curriculum, { year: 2, sem: 1 })).toBe(21)
    expect(fullLoadFor(curriculum, { year: 5, sem: 1 })).toBe(21)
  })

  test('a new student on full load graduates on time and never goes over a semester\'s full load', () => {
    const student = fullLoad(freshStudent(12))
    const plan = planCurriculum(curriculum, student)
    expect(plan.graduation).toEqual({ year: 4, sem: 2 })
    expect(ruleViolations(plan, student)).toEqual([])
  })

  test('per-semester overrides still win over the full load', () => {
    const student = fullLoad({ ...freshStudent(12), unit_caps: { default: 12, by_term: { 'Y1-1': 9 } } })
    expect(capFor(curriculum, student, { year: 1, sem: 1 })).toBe(9)
    expect(capFor(curriculum, student, { year: 1, sem: 2 })).toBe(16)
  })
})

describe('working semester by semester', () => {
  /** Passed everything in Year 1 and Year 2, 1st sem, except a failed 214. */
  function failed214(): StudentData {
    const results = curriculum.subjects
      .filter((s) => s.standard_year === 1 || (s.standard_year === 2 && s.offered_sem === 1))
      .map((s) => ({
        code: s.code,
        attempts: [{ year: s.standard_year, sem: s.offered_sem, result: s.code === '214' ? ('Failed' as const) : ('Passed' as const) }],
      }))
    return { unit_caps: { default: 12, full_load: true }, next_term: { year: 1, sem: 1 }, results }
  }
  const termOf = (plan: Plan, code: string) =>
    plan.terms.find((t) => t.subjects.some((s) => s.code === code))?.term

  test('no subject is planned before its semester in the curriculum', () => {
    for (const student of [freshStudent(21), freshStudent(30), demo]) {
      const plan = planCurriculum(curriculum, student)
      for (const t of plan.terms) {
        for (const s of t.subjects) {
          const subject = curriculum.subjects.find((x) => x.code === s.code)!
          expect(termIndex(t.term), s.code).toBeGreaterThanOrEqual(termIndex({ year: subject.standard_year, sem: subject.offered_sem }))
        }
      }
    }
  })

  test('a failed subject moves to its next offering, and the subjects that need it move after it', () => {
    const plan = planCurriculum(curriculum, failed214())
    expect(termOf(plan, '214')).toEqual({ year: 3, sem: 1 })
    expect(termOf(plan, '305')).toEqual({ year: 4, sem: 1 })
    expect(termOf(plan, '312')).toEqual({ year: 4, sem: 2 })
    expect(termOf(plan, '401.2')).toEqual({ year: 5, sem: 2 })
    // Subjects that don't depend on 214 stay where the curriculum puts them
    expect(termOf(plan, '303')).toEqual({ year: 3, sem: 1 })
    expect(termOf(plan, '211')).toEqual({ year: 2, sem: 2 })
  })

  test('on the full-load cap, subjects that no longer fit a semester move to a later one', () => {
    // Year 4, 1st sem would need 20 units (17 + the moved 305); its full load is 17
    const plan = planCurriculum(curriculum, failed214())
    const y41 = plan.terms.find((t) => t.term.year === 4 && t.term.sem === 1)!
    expect(y41.units).toBeLessThanOrEqual(17)
    expect(ruleViolations(plan, failed214())).toEqual([])
  })

  test('the semester in progress keeps its unrecorded subjects and counts the recorded ones', () => {
    // 214 failed in Year 3, 1st sem; nothing else recorded there yet
    const student: StudentData = {
      ...demo,
      results: [
        ...demo.results.filter((r) => r.code !== '214'),
        { code: '214', attempts: [{ year: 2, sem: 1, result: 'Failed' }, { year: 3, sem: 1, result: 'Failed' }] },
      ],
    }
    const plan = planCurriculum(curriculum, student)
    const current = plan.terms[0]
    expect(current.term).toEqual({ year: 3, sem: 1 })
    expect(current.subjects.map((s) => s.code)).not.toContain('214')
    expect(current.units).toBeLessThanOrEqual(12 - 3)
    expect(termOf(plan, '214')).toEqual({ year: 4, sem: 1 })
    expect(plan.delays.find((d) => d.code === '214')?.reasons).toContainEqual({ kind: 'failed', term: { year: 3, sem: 1 } })
  })
})

describe('moving subjects', () => {
  test('"Not this sem": the subject waits for its next offering, and the subjects that need it wait too', () => {
    const plan = planCurriculum(curriculum, { ...demo, placed: { '304': 'Y4-1' } })
    const termOf = (code: string) => plan.terms.find((t) => t.subjects.some((s) => s.code === code))?.term
    expect(termOf('304')).toEqual({ year: 4, sem: 1 })
    expect(termOf('314')).toEqual({ year: 4, sem: 2 })
    expect(termIndex(termOf('412.1')!)).toBeGreaterThanOrEqual(termIndex({ year: 5, sem: 1 }))
    expect(plan.delays.find((d) => d.code === '304')?.reasons).toContainEqual({ kind: 'postponed', term: { year: 3, sem: 1 } })
    expect(ruleViolations(plan, demo)).toEqual([])
  })

  test('a subject moved ahead of its curriculum semester goes there when its prerequisites allow', () => {
    // 303 Practice Court (Year 3, 1st sem, no prerequisites) moved to Year 3, 1st sem is a no-op;
    // 404 Labor Law Review (Year 4, 2nd sem; needs 205, 215, both passed) moved up to Year 3, 2nd sem
    const plan = planCurriculum(curriculum, { ...demo, placed: { '404': 'Y3-2' } })
    const termOf = (code: string) => plan.terms.find((t) => t.subjects.some((s) => s.code === code))?.term
    expect(termOf('404')).toEqual({ year: 3, sem: 2 })
    expect(ruleViolations(plan, demo)).toEqual([])
  })

  test('a subject moved before its prerequisites are done waits until they are', () => {
    // 305 needs 214, which is retaken in Year 3, 1st sem; moving 305 to Year 3, 1st sem can't hold
    const plan = planCurriculum(curriculum, { ...demo, placed: { '305': 'Y3-1' } })
    const termOf = (code: string) => plan.terms.find((t) => t.subjects.some((s) => s.code === code))?.term
    expect(termOf('305')).toEqual({ year: 4, sem: 1 })
  })
})

describe('over the cap: the app flags instead of moving', () => {
  test('with overCap "flag", subjects stay where prerequisites allow and over-cap terms are reported', () => {
    const plan = planCurriculum(curriculum, demo, { overCap: 'flag' })
    const y31 = plan.terms.find((t) => t.term.year === 3 && t.term.sem === 1)!
    // All of Year 3, 1st sem except 305 (waits for 214), plus the retaken 214
    expect(y31.units).toBe(16)
    expect(plan.overloads[0]).toEqual({ term: { year: 3, sem: 1 }, units: 16, cap: 12 })
    expect(plan.delays.flatMap((d) => d.reasons).some((r) => r.kind === 'unit_cap')).toBe(false)
  })

  test('the default "fit" mode still moves subjects to respect the cap (SPEC acceptance behaviour)', () => {
    const plan = planCurriculum(curriculum, demo)
    expect(plan.overloads).toEqual([])
    expect(plan.graduation).toEqual({ year: 5, sem: 2 })
  })
})
