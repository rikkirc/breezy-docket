import { describe, expect, test } from 'vitest'
import { demoStudent, jdCurriculum } from '../data'
import { planCurriculum, standardGraduation, type Curriculum } from '../planner'
import {
  addSubject,
  curriculumProblem,
  curriculumProblems,
  draftProblem,
  emptyCurriculum,
  formatUnits,
  possiblePrerequisites,
  removeSubject,
  termsWithSubjects,
  togglePrerequisite,
  updateSubject,
} from './curriculum'
import { fromStored } from './storage'
import { freshStudent, recordResult, removeResult } from './student'

const Y1S1 = { year: 1, sem: 1 }
const Y1S2 = { year: 1, sem: 2 }

function twoSubjects(): Curriculum {
  let c = addSubject(emptyCurriculum(), { code: 'A', title: 'Alpha', units: 3, term: Y1S1 })
  c = addSubject(c, { code: 'B', title: 'Beta', units: 2, term: Y1S2 })
  return togglePrerequisite(c, 'B', 'A')
}

describe('editing the curriculum', () => {
  test('adding subjects builds the standard plan', () => {
    const c = twoSubjects()
    expect(c.subjects.find((s) => s.code === 'B')).toMatchObject({ standard_year: 1, offered_sem: 2, prerequisites: ['A'] })
    expect(standardGraduation(c)).toEqual(Y1S2)
    expect(planCurriculum(c, { ...freshStudent(), unit_caps: { default: 12 } }).graduation).toEqual(Y1S2)
  })

  test('drafts are checked', () => {
    const c = twoSubjects()
    expect(draftProblem(c, { code: ' ', title: 'X', units: 3, term: Y1S1 })).toMatch(/code/)
    expect(draftProblem(c, { code: 'A', title: 'X', units: 3, term: Y1S1 })).toMatch(/already/)
    expect(draftProblem(c, { code: 'A', title: 'X', units: 3, term: Y1S1 }, 'A')).toBeNull()
    expect(draftProblem(c, { code: 'C', title: '', units: 3, term: Y1S1 })).toMatch(/title/)
    expect(draftProblem(c, { code: 'C', title: 'X', units: 0, term: Y1S1 })).toMatch(/Units/)
  })

  test('renaming a code carries into prerequisites and results', () => {
    const student = { ...freshStudent(), results: [{ code: 'A', attempts: [{ ...Y1S1, result: 'Passed' as const }] }] }
    const ws = updateSubject({ curriculum: twoSubjects(), student }, 'A', { code: 'A1', title: 'Alpha', units: 3, term: Y1S1 })
    expect(ws.curriculum.subjects.find((s) => s.code === 'B')?.prerequisites).toEqual(['A1'])
    expect(ws.student.results[0].code).toBe('A1')
  })

  test('deleting a subject removes it from prerequisites and results', () => {
    const student = { ...freshStudent(), results: [{ code: 'A', attempts: [{ ...Y1S1, result: 'Passed' as const }] }] }
    const ws = removeSubject({ curriculum: twoSubjects(), student }, 'A')
    expect(ws.curriculum.subjects.map((s) => s.code)).toEqual(['B'])
    expect(ws.curriculum.subjects[0].prerequisites).toEqual([])
    expect(ws.student.results).toEqual([])
  })

  test('only earlier subjects can be prerequisites; a move that breaks one is reported', () => {
    const c = twoSubjects()
    expect(possiblePrerequisites(c, c.subjects[0])).toEqual([])
    expect(possiblePrerequisites(c, c.subjects[1]).map((s) => s.code)).toEqual(['A'])
    expect(curriculumProblems(c)).toEqual([])

    const moved = updateSubject({ curriculum: c, student: freshStudent() }, 'A', { code: 'A', title: 'Alpha', units: 3, term: { year: 2, sem: 1 } })
    expect(curriculumProblems(moved.curriculum)).toEqual([
      'B (Year 1, 2nd sem) needs A, which comes in Year 2, 1st sem. A prerequisite must come in an earlier semester.',
    ])
  })

  test('the JD curriculum has no problems and spans four years', () => {
    expect(curriculumProblems(jdCurriculum)).toEqual([])
    expect(curriculumProblem(jdCurriculum)).toBeNull()
    expect(termsWithSubjects(jdCurriculum)).toHaveLength(8)
  })

  test('units are spelled out', () => {
    expect(formatUnits(1)).toBe('1 unit')
    expect(formatUnits(3)).toBe('3 units')
  })
})

describe('recording results by semester', () => {
  test('record, change, then remove a result', () => {
    const passed = recordResult(freshStudent(), 'A', Y1S1, 'Ongoing')
    expect(passed.results).toEqual([{ code: 'A', attempts: [{ ...Y1S1, result: 'Ongoing' }] }])
    const failed = recordResult(passed, 'A', Y1S1, 'Failed')
    expect(failed.results[0].attempts).toEqual([{ ...Y1S1, result: 'Failed' }])
    const retaken = recordResult(failed, 'A', { year: 2, sem: 1 }, 'Passed')
    expect(retaken.results[0].attempts).toHaveLength(2)
    expect(removeResult(retaken, 'A', Y1S1).results[0].attempts).toEqual([{ year: 2, sem: 1, result: 'Passed' }])
  })
})

describe('saved data', () => {
  test('data from before the curriculum was editable keeps the JD curriculum and skips setup', () => {
    expect(fromStored({ student: demoStudent, isDemo: true })).toMatchObject({ curriculum: jdCurriculum, setupDone: true })
  })

  test('a broken stored curriculum is not loaded', () => {
    expect(fromStored({ student: demoStudent, isDemo: false, setupDone: true, curriculum: { program: {}, subjects: [] } })).toBeNull()
  })
})
