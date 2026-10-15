# Curriculum Organizer

Plans the remaining subjects of a working law student (JD) into future semesters under a unit cap, and shows the earliest graduation term. See [SPEC.md](SPEC.md) for the full plan and [PROGRESS.md](PROGRESS.md) for where things stand.

**Live demo:** https://rikkirc.github.io/curriculum-organizer/ (updates on every merge to `main`; opens on a phone too).

**Status:** Milestone 3 — results entry, the plan by term, graduation date and delay reasons, what-if ("fail X this sem", "take 15 units"), JSON backup export/import, and installable on a phone (works offline). Your data stays in your browser.

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
- `src/lib/` — edits on the student's data, what-if scenarios, backup export/import, saving to localStorage.
- `public/` — the app manifest, icons and the offline service worker (`sw.js`).
- `.github/workflows/` — `tests.yml` (every push) and `deploy.yml` (GitHub Pages on merge to `main`).
