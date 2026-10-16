import { describe, expect, test } from 'vitest'
import { demoStudent, jdCurriculum as curriculum, subjectMap } from '../data'

const subjectsByCode = subjectMap(curriculum)
import { planCurriculum, termIndex, termLabel } from '../planner'
import {
  describeDelay,
  describeGap,
  freshStudent,
  setAttempts,
  postpone,
  setCapMode,
  unplace,
  moveTargets,
  fitTerm,
  blockedByMoving,
  statusOf,
  termAfterResults,
} from './student'

describe('student edits', () => {
  test('status: Passed wins, otherwise the latest attempt', () => {
    expect(statusOf([])).toBe('Not taken')
    expect(
      statusOf([
        { year: 2, sem: 1, result: 'Failed' },
        { year: 3, sem: 1, result: 'Ongoing' },
      ]),
    ).toBe('Ongoing')
    expect(
      statusOf([
        { year: 3, sem: 1, result: 'Passed' },
        { year: 2, sem: 1, result: 'Failed' },
      ]),
    ).toBe('Passed')
  })

  test('setAttempts keeps one row per subject and drops empty rows', () => {
    const passed = setAttempts(demoStudent, '214', [
      { year: 2, sem: 1, result: 'Failed' },
      { year: 3, sem: 1, result: 'Passed' },
    ])
    expect(passed.results.filter((r) => r.code === '214')).toHaveLength(1)
    expect(setAttempts(passed, '214', []).results.some((r) => r.code === '214')).toBe(false)
    expect(demoStudent.results.find((r) => r.code === '214')!.attempts).toHaveLength(1)
  })

  test('postponing a subject plans it a year later, and undo clears it', () => {
    const later = postpone(demoStudent, '304', { year: 3, sem: 1 })
    expect(later.placed).toEqual({ '304': 'Y4-1' })
    expect(unplace(later, '304').placed).toEqual({})
  })

  test('a later subject can move to semesters it is offered in, after its prerequisites', () => {
    const plan = planCurriculum(curriculum, demoStudent)
    const now = termIndex({ year: 3, sem: 1 })
    // 312 needs 305, which is planned in Year 4, 1st sem: Year 4, 2nd sem at the earliest; it's there now
    expect(moveTargets(curriculum, plan, demoStudent, '312', now).map(termLabel)).toEqual(['Year 5, 2nd sem', 'Year 6, 2nd sem'])
    // Never earlier than where a subject is planned now: 404 (planned in a 2nd sem) only gets later 2nd sems
    const at404 = termIndex(plan.terms.find((t) => t.subjects.some((s) => s.code === '404'))!.term)
    const targets404 = moveTargets(curriculum, plan, demoStudent, '404', now)
    expect(targets404.length).toBeGreaterThan(0)
    expect(targets404.every((t) => termIndex(t) > at404 && t.sem === 2)).toBe(true)
  })

  test('the cap mode switches between full load and a fixed number', () => {
    const full = setCapMode(demoStudent, true)
    expect(full.unit_caps.full_load).toBe(true)
    expect(full.unit_caps.default).toBe(12)
    const fixed = setCapMode(full, false, 15)
    expect(fixed.unit_caps).toEqual({ ...demoStudent.unit_caps, default: 15 })
  })

  test('the term after the results', () => {
    expect(termAfterResults(freshStudent())).toBeNull()
    expect(termAfterResults(demoStudent)).toEqual({ year: 3, sem: 1 })
  })
})

describe('wording', () => {
  test('delay reasons for Commercial Laws I name Corporation Law', () => {
    const delay = planCurriculum(curriculum, demoStudent).delays.find((d) => d.code === '305')!
    expect(describeDelay(delay, subjectsByCode)).toEqual([
      'Needs 214 Corporation and Basic Securities Law passed first (not passed by Year 3, 1st sem).',
      'Only offered in the 1st sem.',
    ])
  })

  test('gaps in years and sems', () => {
    expect(describeGap(1)).toBe('1 sem')
    expect(describeGap(2)).toBe('1 year')
    expect(describeGap(5)).toBe('2 years and 1 sem')
  })
})

describe('over-cap actions', () => {
  test('"Fit" keeps what fits the cap (subjects others depend on first) and moves the rest a year later', () => {
    const plan = planCurriculum(curriculum, demoStudent, { overCap: 'flag' })
    const fitted = fitTerm(curriculum, plan, demoStudent, { year: 3, sem: 1 }, 12)
    const moved = Object.keys(fitted.placed ?? {})
    expect(moved.length).toBeGreaterThan(0)
    expect(Object.values(fitted.placed ?? {}).every((k) => k === 'Y4-1')).toBe(true)
    // 214 has subjects waiting on it, so it stays
    expect(moved).not.toContain('214')
    const after = planCurriculum(curriculum, fitted, { overCap: 'flag' })
    expect(after.terms.find((t) => t.term.year === 3 && t.term.sem === 1)!.units).toBeLessThanOrEqual(12)
  })

  test('moving a subject blocks the subjects that need it in the next two semesters', () => {
    const plan = planCurriculum(curriculum, demoStudent, { overCap: 'flag' })
    const blocked = blockedByMoving(curriculum, plan, '305', { year: 4, sem: 1 }).map((b) => b.subject.code)
    expect(blocked).toContain('312')
    expect(blockedByMoving(curriculum, plan, '303', { year: 3, sem: 1 })).toEqual([])
  })
})
