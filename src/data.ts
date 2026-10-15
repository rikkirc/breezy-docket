import curriculumJson from '../data/jd-curriculum.json'
import demoJson from '../data/demo-student.json'
import type { Curriculum, StudentData, Subject } from './planner'

/** The sample JD curriculum: a starting point the student can load and edit, and the demo's curriculum. */
export const jdCurriculum = curriculumJson as Curriculum
export const demoStudent = demoJson as StudentData

export function subjectMap(curriculum: Curriculum): ReadonlyMap<string, Subject> {
  return new Map(curriculum.subjects.map((s) => [s.code, s]))
}
