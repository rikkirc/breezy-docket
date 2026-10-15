import { describe, expect, test } from 'vitest'
import { curriculum, demoStudent } from '../data'
import { planCurriculum, type StudentData } from '../planner'
import { setAttempts } from './student'
import { capFromNow, failThisSem, thisSemSubjects } from './whatIf'

const plan = (student: StudentData) => planCurriculum(curriculum, student)

describe('what if I fail X this sem', () => {
  test('with nothing Ongoing, this sem is the first planned semester', () => {
    const real = plan(demoStudent)
    const thisSem = thisSemSubjects(demoStudent, real)
    expect(thisSem.term).toEqual({ year: 3, sem: 1 })
    expect(thisSem.codes).toEqual(real.terms[0].subjects.map((s) => s.code))
  })

  test('failing Corporation Law again in Year 3 pushes graduation a year', () => {
    const real = plan(demoStudent)
    const edited = failThisSem(demoStudent, real, '214')
    expect(edited.next_term).toEqual({ year: 3, sem: 2 })
    const whatIf = plan(edited)
    expect(whatIf.graduation).toEqual({ year: 6, sem: 2 })
    expect(whatIf.delays.find((d) => d.code === '214')?.reasons).toContainEqual({
      kind: 'failed',
      term: { year: 3, sem: 1 },
    })
  })

  test('the rest of the semester counts as passed', () => {
    const real = plan(demoStudent)
    const edited = failThisSem(demoStudent, real, '214')
    const others = real.terms[0].subjects.filter((s) => s.code !== '214')
    for (const s of others) {
      expect(edited.results.find((r) => r.code === s.code)?.attempts).toEqual([
        { year: 3, sem: 1, result: 'Passed' },
      ])
    }
  })

  test('with subjects Ongoing, those are this sem and failing one marks it Failed', () => {
    const student: StudentData = {
      ...setAttempts(demoStudent, '214', [
        { year: 2, sem: 1, result: 'Failed' },
        { year: 3, sem: 1, result: 'Ongoing' },
      ]),
      next_term: { year: 3, sem: 2 },
    }
    const real = plan(student)
    expect(thisSemSubjects(student, real)).toEqual({ term: { year: 3, sem: 1 }, codes: ['214'] })
    const edited = failThisSem(student, real, '214')
    expect(edited.results.find((r) => r.code === '214')?.attempts.at(-1)?.result).toBe('Failed')
    expect(plan(edited).ongoing).toEqual([])
  })

  test('the real data is not changed', () => {
    const before = JSON.stringify(demoStudent)
    failThisSem(demoStudent, plan(demoStudent), '214')
    capFromNow(demoStudent, 15)
    expect(JSON.stringify(demoStudent)).toBe(before)
  })
})

describe('what if I take N units', () => {
  test('15 units from Year 3 on still ends in Year 5, 2nd sem: the 214 chain decides', () => {
    expect(plan(capFromNow(demoStudent, 15)).graduation).toEqual({ year: 5, sem: 2 })
  })

  test('9 units from Year 3 on takes longer', () => {
    const whatIf = plan(capFromNow(demoStudent, 9))
    expect(whatIf.graduation).toEqual({ year: 6, sem: 2 })
    for (const t of whatIf.terms) expect(t.units).toBeLessThanOrEqual(9)
  })

  test('caps for past semesters are kept, future overrides are replaced', () => {
    const student = { ...demoStudent, unit_caps: { default: 12, by_term: { 'Y1-1': 21, 'Y4-1': 6 } } }
    expect(capFromNow(student, 15).unit_caps).toEqual({ default: 15, by_term: { 'Y1-1': 21 } })
  })
})
