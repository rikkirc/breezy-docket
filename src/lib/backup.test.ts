import { describe, expect, test } from 'vitest'
import { demoStudent, jdCurriculum } from '../data'
import { emptyCurriculum } from './curriculum'
import { backupFileName, makeBackup, parseBackup, studentProblem } from './backup'

describe('backup', () => {
  test('export then import gives back the same curriculum and data', () => {
    const text = JSON.stringify(makeBackup(jdCurriculum, demoStudent, new Date('2026-10-15T08:00:00Z')))
    expect(JSON.parse(text)).toMatchObject({ app: 'curriculum-organizer', version: 2 })
    const { student, unit_caps, next_term, results } = demoStudent
    const imported = parseBackup(text)
    expect(imported.student).toEqual({ student, unit_caps, next_term, results })
    expect(imported.curriculum?.subjects).toEqual(jdCurriculum.subjects)
  })

  test('a version 1 backup (no curriculum) still imports', () => {
    const v1 = { app: 'curriculum-organizer', version: 1, exported_at: '2026-10-15T08:00:00Z', student: demoStudent }
    const imported = parseBackup(JSON.stringify(v1))
    expect(imported.curriculum).toBeUndefined()
    expect(imported.student.results).toHaveLength(demoStudent.results.length)
  })

  test('a broken curriculum is refused', () => {
    const backup = makeBackup({ ...emptyCurriculum(), subjects: [{ code: 'A', title: 'A', units: 0, standard_year: 1, offered_sem: 1, prerequisites: [] }] }, demoStudent)
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/subject A has invalid units/)
  })

  test('accepts bare student data like data/demo-student.json, dropping unknown fields', () => {
    const imported = parseBackup(JSON.stringify(demoStudent))
    expect(imported.student.results).toHaveLength(demoStudent.results.length)
    expect('expected' in imported.student).toBe(false)
  })

  test('file name carries the date', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('curriculum-organizer-backup-2026-10-05.json')
  })

  test.each([
    ['not JSON', 'hello', /isn't valid JSON/],
    ['an unrelated JSON file', '{"name":"x"}', /unit cap/],
    ['a bad result', JSON.stringify({ ...demoStudent, results: [{ code: '101', attempts: [{ year: 1, sem: 1, result: 'A+' }] }] }), /attempt for subject 101/],
    ['a duplicate subject', JSON.stringify({ ...demoStudent, results: [demoStudent.results[0], demoStudent.results[0]] }), /appears twice/],
    ['a cap over 30', JSON.stringify({ ...demoStudent, unit_caps: { default: 99 } }), /unit cap/],
    ['a semester 3', JSON.stringify({ ...demoStudent, next_term: { year: 3, sem: 3 } }), /plan from/],
    ['a newer version', JSON.stringify({ app: 'curriculum-organizer', version: 9, student: demoStudent }), /newer version/],
  ])('rejects %s with a clear message', (_, text, message) => {
    expect(() => parseBackup(text)).toThrow(message)
  })

  test('the demo student is valid', () => {
    expect(studentProblem(demoStudent)).toBeNull()
  })
})
