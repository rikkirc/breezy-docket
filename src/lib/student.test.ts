import { describe, expect, test } from 'vitest'
import { demoStudent, jdCurriculum as curriculum, subjectMap } from '../data'

const subjectsByCode = subjectMap(curriculum)
import { planCurriculum } from '../planner'
import {
  describeDelay,
  describeGap,
  freshStudent,
  setAttempts,
  postpone,
  setCapMode,
  undoPostpone,
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
    expect(later.not_before).toEqual({ '304': 'Y4-1' })
    expect(undoPostpone(later, '304').not_before).toEqual({})
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
