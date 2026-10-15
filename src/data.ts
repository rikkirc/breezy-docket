import curriculumJson from '../data/jd-curriculum.json'
import demoJson from '../data/demo-student.json'
import type { Curriculum, StudentData, Subject } from './planner'

export const curriculum = curriculumJson as Curriculum
export const demoStudent = demoJson as StudentData
export const subjectsByCode: ReadonlyMap<string, Subject> = new Map(
  curriculum.subjects.map((s) => [s.code, s]),
)
