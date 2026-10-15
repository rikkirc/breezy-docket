# Curriculum Organizer

Plans the remaining subjects of a working law student (JD) into future semesters under a unit cap, and shows the earliest graduation term. See [SPEC.md](SPEC.md) for the full plan and [PROGRESS.md](PROGRESS.md) for where things stand.

**Status:** Milestone 1 — the planner logic and its tests. No screens yet.

## Run it

```sh
npm install
npm test          # the 5 acceptance tests from SPEC.md (Vitest)
npm run dev       # placeholder page until Milestone 2
```

## Layout

- `data/jd-curriculum.json` — the JD curriculum (53 subjects, 142 units).
- `data/demo-student.json` — a made-up student for tests and the demo. Never commit a real student's data.
- `src/planner/` — the planner, pure TypeScript with no UI:
  - `planCurriculum(curriculum, student)` returns the plan by term, graduation term, terms behind the standard plan, and why each delayed subject is delayed.
  - `planner.test.ts` — the acceptance tests.
  - `naive.ts` — the simple standard-order fill the spec rejects, kept for the regression test.
