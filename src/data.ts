import curriculumJson from '../data/jd-curriculum.json'
import demoJson from '../data/demo-student.json'
import type { Curriculum, StudentData, Subject } from './planner'

/** The Xavier University - School of Law JD curriculum: a built-in template the student can load and edit, and the demo's curriculum. */
export const jdCurriculum: Curriculum = {
  program: { name: curriculumJson.program.name },
  // Only the fields the planner uses.
  subjects: (curriculumJson as Curriculum).subjects.map((s) => ({
    code: s.code,
    title: s.title,
    units: s.units,
    standard_year: s.standard_year,
    offered_sem: s.offered_sem,
    prerequisites: s.prerequisites,
  })),
}
export const demoStudent = demoJson as StudentData

export function subjectMap(curriculum: Curriculum): ReadonlyMap<string, Subject> {
  return new Map(curriculum.subjects.map((s) => [s.code, s]))
}
