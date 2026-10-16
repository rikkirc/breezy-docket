# Curriculum Organizer

Plans the remaining subjects of a working student into future semesters under a unit cap, and shows the earliest graduation term. The student first builds their own curriculum (subjects, units, prerequisites), or starts from a sample JD curriculum. See [SPEC.md](SPEC.md) for the full plan and [PROGRESS.md](PROGRESS.md) for where things stand.

**Live demo:** https://rikkirc.github.io/curriculum-organizer/ (updates on every merge to `main`; opens on a phone too).

**Status:** first-run setup builds the curriculum in 3 steps (subjects and units by semester → prerequisites → review the default plan and unit cap). Then Working Subjects shows every semester: record results as you go, and failed subjects plus everything that needs them move to their next offering automatically, with the expected graduation on top. JSON backup; installable on a phone (works offline). Data stays in your browser.

## Run it

```sh
npm install
npm test          # planner acceptance tests (SPEC.md) and screen tests (Vitest)
npm run dev       # the app at http://localhost:5173
```

## Layout

- `data/jd-curriculum.json` — the sample JD curriculum (53 subjects, 142 units), offered as a starting point and used by the demo.
- `data/demo-student.json` — a made-up student for tests and the demo. Never commit a real student's data.
- `src/planner/` — the planner, pure TypeScript with no UI:
  - `planCurriculum(curriculum, student)` returns the plan by term, graduation term, terms behind the standard plan, and why each delayed subject is delayed.
  - `planner.test.ts` — the acceptance tests.
  - `naive.ts` — the simple standard-order fill the spec rejects, kept for the regression test.
- `src/components/` — the setup steps (Subjects, Prerequisites, Review) and the Working Subjects, Curriculum and Settings screens.
- `src/lib/` — edits on the curriculum and the student's data, backup export/import, saving to localStorage.
- `public/` — the app manifest, icons and the offline service worker (`sw.js`).
- `.github/workflows/` — `tests.yml` (every push) and `deploy.yml` (GitHub Pages on merge to `main`).
