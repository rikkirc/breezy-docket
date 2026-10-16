// What goes into the student's account, and what to do when they sign in. Pure: no Firebase here.
import type { Curriculum, StudentData } from '../planner'
import { studentProblem } from './backup'
import { cleanCurriculum, curriculumProblem } from './curriculum'
import type { Saved } from './storage'

/** The plan as stored in the account: one document per student. */
export interface CloudPlan {
  version: 1
  curriculum: Curriculum
  student: StudentData
  setupDone: boolean
}

export function toCloudPlan(saved: Saved): CloudPlan {
  return {
    version: 1,
    curriculum: cleanCurriculum(saved.curriculum),
    student: saved.student,
    setupDone: saved.setupDone,
  }
}

export function fromCloudPlan(plan: CloudPlan): Saved {
  return { curriculum: plan.curriculum, student: plan.student, setupDone: plan.setupDone, isDemo: false }
}

/** The account's copy, if it's usable; anything else is ignored rather than loaded. */
export function readCloudPlan(value: unknown): CloudPlan | null {
  if (typeof value !== 'object' || value === null) return null
  const plan = value as Partial<CloudPlan>
  if (plan.version !== 1 || typeof plan.setupDone !== 'boolean') return null
  if (curriculumProblem(plan.curriculum) !== null || studentProblem(plan.student) !== null) return null
  return { version: 1, curriculum: plan.curriculum!, student: plan.student!, setupDone: plan.setupDone }
}

/** Whether two plans hold the same curriculum, results and settings. */
export function samePlan(a: CloudPlan, b: CloudPlan): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** True when this device holds nothing of the student's own: the demo, or an untouched first visit. */
export function isBlank(saved: Saved): boolean {
  return saved.isDemo || (!saved.setupDone && saved.curriculum.subjects.length === 0 && saved.student.results.length === 0)
}

/**
 * On sign-in: use the account's plan, upload this device's, ask which to keep (both have a plan and they
 * differ), or do nothing (neither has one yet).
 */
export function decideOnSignIn(local: Saved, cloud: CloudPlan | null): 'use-cloud' | 'upload-local' | 'ask' | 'none' {
  if (cloud === null) return isBlank(local) ? 'none' : 'upload-local'
  if (isBlank(local) || samePlan(toCloudPlan(local), cloud)) return 'use-cloud'
  return 'ask'
}
