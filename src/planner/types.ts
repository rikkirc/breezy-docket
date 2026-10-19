// Shapes of data/jd-curriculum.json and data/demo-student.json, and of the plan the planner returns.

export interface Subject {
  code: string
  title: string
  units: number
  standard_year: number
  /** The semester the subject runs in: 1 or 2, or 3 for a summer-only subject. */
  offered_sem: number
  /** Also offered in the summer, for schools that open subjects then (e.g. to retake a failed one). */
  summer?: boolean
  /** Codes that must be passed before the subject can be taken. */
  prerequisites: string[]
  /** A note that the subject still needs confirming against the official curriculum. */
  check?: string
}

export interface Curriculum {
  program: {
    name: string
    terms_per_year?: number
    term_names?: string[]
    note?: string
    /** The school offers summer classes: summer terms and "also offered in summer" are available. */
    summer?: boolean
  }
  subjects: Subject[]
}

export interface Term {
  year: number
  sem: number
}

export type Result = 'Passed' | 'Failed' | 'Ongoing'

export interface Attempt extends Term {
  result: Result
}

/** One row per subject; retakes are extra attempts, never duplicate rows. */
export interface SubjectRecord {
  code: string
  attempts: Attempt[]
}

export interface StudentData {
  student?: { name: string; program: string }
  unit_caps: {
    /** The cap for every semester, unless full_load is on. */
    default: number
    /**
     * "Default" cap: each semester's cap is its full load in the curriculum (the units of the subjects
     * standardly taken in it). Semesters past the standard plan use the largest full load.
     */
    full_load?: boolean
    /**
     * Most units in a summer. Unset: the summer's load in the curriculum (none unless a subject is
     * summer-only). 0: no summer classes.
     */
    summer?: number
    /** Overrides by term, keyed like "Y3-1" (a summer is "Y3-3"). */
    by_term?: Record<string, number>
  }
  /** The first term the planner may fill. */
  next_term: Term
  results: SubjectRecord[]
  /**
   * Subjects the student moved: code → the term to plan it in, keyed like "Y4-1". If its prerequisites
   * aren't passed by then, it goes to the first term after that they allow.
   */
  placed?: Record<string, string>
}

export interface PlannedSubject {
  code: string
  title: string
  units: number
  /** E.g. a prerequisite that is still Ongoing, so the plan assumes it will be passed. */
  warnings: string[]
}

export interface PlannedTerm {
  term: Term
  label: string
  cap: number
  units: number
  subjects: PlannedSubject[]
}

export type DelayReason =
  | { kind: 'prerequisite'; term: Term; missing: string[] }
  | { kind: 'other_semester'; term: Term }
  | { kind: 'unit_cap'; term: Term }
  | { kind: 'failed'; term: Term }
  | { kind: 'postponed'; term: Term }

export interface Delay {
  code: string
  standardTerm: Term
  plannedTerm: Term
  reasons: DelayReason[]
}

/** A term whose subjects add up to more units than its cap. */
export interface Overload {
  term: Term
  /** Units of everything in the term: recorded results there plus planned subjects. */
  units: number
  cap: number
}

export interface Plan {
  terms: PlannedTerm[]
  /** The last planned term, or null if some subjects can never be planned. */
  graduation: Term | null
  /** The last term of the standard plan, or null for an empty curriculum. */
  standardGraduation: Term | null
  /** How many regular semesters after the standard plan's end the student graduates (0 = on time; a summer counts with the 2nd sem before it). */
  termsBehind: number | null
  delays: Delay[]
  /** Subjects the planner could not fit anywhere (e.g. more units than the cap, or a prerequisite that is never offered). */
  unplanned: string[]
  /** Terms over their cap. With overCap "fit" only subjects the student placed can cause this. */
  overloads: Overload[]
  /** Subjects marked Ongoing, which count as passed for planning. */
  ongoing: string[]
}
