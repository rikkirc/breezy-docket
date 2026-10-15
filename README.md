# Curriculum Organizer

Plans the remaining subjects of a working law student (JD) into future semesters under a unit cap, and shows the earliest graduation term. See [SPEC.md](SPEC.md) for the full plan and [PROGRESS.md](PROGRESS.md) for where things stand.

**Live demo:** https://rikkirc.github.io/curriculum-organizer/ (updates on every merge to `main`; opens on a phone too).

**Status:** Milestone 2 — screens for results entry, the plan by term, the graduation date and delay reasons. Your data stays in your browser.

## Run it

```sh
npm install
npm test          # planner acceptance tests (SPEC.md) and screen tests (Vitest)
npm run dev       # the app at http://localhost:5173
```

## Layout

- `data/jd-curriculum.json` — the JD curriculum (53 subjects, 142 units).
- `data/demo-student.json` — a made-up student for tests and the demo. Never commit a real student's data.
- `src/planner/` — the planner, pure TypeScript with no UI:
  - `planCurriculum(curriculum, student)` returns the plan by term, graduation term, terms behind the standard plan, and why each delayed subject is delayed.
  - `planner.test.ts` — the acceptance tests.
  - `naive.ts` — the simple standard-order fill the spec rejects, kept for the regression test.
- `src/components/` — the Plan, Results and Settings screens.
- `src/lib/` — edits on the student's data and saving to localStorage.
- `.github/workflows/` — `tests.yml` (every push) and `deploy.yml` (GitHub Pages on merge to `main`).
