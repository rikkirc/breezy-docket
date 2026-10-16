// Export and import the student's data as a JSON file, so it can be backed up or moved to another device.
import type { Attempt, Curriculum, StudentData } from '../planner'
import { cleanCurriculum, curriculumProblem } from './curriculum'

export const BACKUP_APP = 'curriculum-organizer'
/** Version 2 added the curriculum; version 1 backups were made with the JD curriculum. */
export const BACKUP_VERSION = 2

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exported_at: string
  curriculum: Curriculum
  student: StudentData
}

export interface Imported {
  student: StudentData
  /** Missing from version 1 backups and bare student files. */
  curriculum?: Curriculum
}

export function makeBackup(curriculum: Curriculum, student: StudentData, now = new Date()): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exported_at: now.toISOString(), curriculum, student }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `curriculum-organizer-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/**
 * Reads a backup file's text. Also accepts bare student data in the shape of data/demo-student.json.
 * Throws an Error with a message fit to show the student when the file can't be used.
 */
export function parseBackup(text: string): Imported {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("This file isn't a backup: it isn't valid JSON.")
  }
  const candidate = isObject(value) && value.app === BACKUP_APP ? value.student : value
  if (isObject(value) && value.app === BACKUP_APP && typeof value.version === 'number' && value.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Reload the page and try again.')
  }
  const problem = studentProblem(candidate)
  if (problem) throw new Error(`This file can't be imported: ${problem}`)
  let curriculum: Curriculum | undefined
  if (isObject(value) && value.app === BACKUP_APP && value.curriculum !== undefined) {
    const curriculumIssue = curriculumProblem(value.curriculum)
    if (curriculumIssue) throw new Error(`This file can't be imported: ${curriculumIssue}`)
    curriculum = cleanCurriculum(value.curriculum as Curriculum)
  }
  return { student: cleanStudent(candidate as StudentData), ...(curriculum ? { curriculum } : {}) }
}

/** Keeps only the fields the app uses, so nothing unexpected is stored. */
function cleanStudent(student: StudentData): StudentData {
  return {
    ...(student.student ? { student: student.student } : {}),
    unit_caps: {
      default: student.unit_caps.default,
      ...(student.unit_caps.full_load ? { full_load: true } : {}),
      by_term: { ...student.unit_caps.by_term },
    },
    next_term: { year: student.next_term.year, sem: student.next_term.sem },
    ...(student.not_before && Object.keys(student.not_before).length > 0 ? { not_before: { ...student.not_before } } : {}),
    results: student.results.map((r) => ({
      code: r.code,
      attempts: r.attempts.map((a: Attempt) => ({ year: a.year, sem: a.sem, result: a.result })),
    })),
  }
}

/** Why the value isn't usable student data, or null if it is. Also used for what's in localStorage. */
export function studentProblem(value: unknown): string | null {
  if (!isObject(value)) return 'no student data found.'
  const caps = value.unit_caps
  if (!isObject(caps) || !isCap(caps.default)) return 'the unit cap is missing or not a whole number from 1 to 30.'
  if (caps.full_load !== undefined && typeof caps.full_load !== 'boolean') return 'the cap setting is not readable.'
  if (caps.by_term !== undefined) {
    if (!isObject(caps.by_term)) return 'the per-semester caps are not readable.'
    for (const [key, cap] of Object.entries(caps.by_term)) {
      if (!/^Y\d+-[12]$/.test(key) || !isCap(cap)) return `the cap for "${key}" is not valid.`
    }
  }
  if (!isTerm(value.next_term)) return 'the semester to plan from is missing.'
  if (value.not_before !== undefined) {
    if (!isObject(value.not_before)) return 'the postponed subjects are not readable.'
    for (const [code, key] of Object.entries(value.not_before)) {
      if (typeof key !== 'string' || !/^Y\d+-[12]$/.test(key)) return `the postponement of ${code} is not readable.`
    }
  }
  if (!Array.isArray(value.results)) return 'the results list is missing.'
  const seen = new Set<string>()
  for (const r of value.results) {
    if (!isObject(r) || typeof r.code !== 'string' || !Array.isArray(r.attempts)) return 'a result is not readable.'
    if (seen.has(r.code)) return `subject ${r.code} appears twice.`
    seen.add(r.code)
    for (const a of r.attempts) {
      if (!isTerm(a) || !['Passed', 'Failed', 'Ongoing'].includes((a as Record<string, unknown>).result as string)) {
        return `an attempt for subject ${r.code} is not readable.`
      }
    }
  }
  return null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCap(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 30
}

function isTerm(value: unknown): boolean {
  return (
    isObject(value) &&
    Number.isInteger(value.year) &&
    (value.year as number) >= 1 &&
    (value.year as number) <= 20 &&
    (value.sem === 1 || value.sem === 2)
  )
}
