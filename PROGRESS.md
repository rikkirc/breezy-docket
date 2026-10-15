# Progress log

What's done, what's next, and what's blocked. Newest entries first.

## Current state (2026-10-15) — Milestone 1: planner + tests

- **Stack:** React + Vite + TypeScript, Vitest. No screens yet (a placeholder page only).
- **Planner:** `src/planner/`, a pure module: takes the curriculum and the student's results, returns the plan by term, graduation term, terms behind the standard plan, and delay reasons.
- **Tests:** the 5 acceptance tests from SPEC.md pass, plus rule checks on 7 different students and a few edge cases (17 tests). CI runs lint, type check, tests and build on every push.

## Log

### 2026-10-15
- Set up the React + Vite + TypeScript project and moved the JSON files into `data/`, where SPEC.md expects them.
- Wrote the planner. For each term it tries every combination of open subjects that fits the cap and picks, in order: the most subjects other subjects depend on, then the most units, then the earliest standard year.
- Results on the demo student (failed 214, cap 12 from Year 3): graduates **Year 5, 2nd sem**, every 1st sem exactly 12 units. The simple standard-order fill gives Year 6, 2nd sem.
- Standard student (cap 21): graduates Year 4, 2nd sem.
- Delay reasons per term: prerequisite not passed yet (names it), offered only in the other semester, no room under the cap, or failed in that term.
- Ongoing counts as passed for planning; subjects that depend on it carry a warning.
- A subject that can never fit (e.g. more units than the cap) is reported as unplanned instead of looping forever.
- GitHub Actions workflow (`tests.yml`).

## Next

### Milestone 2 — screens
- [ ] Results entry: mark each subject Passed / Failed / Ongoing and the term taken.
- [ ] Unit cap per term (default 12).
- [ ] Plan by term, with the graduation date and how far it is from Year 4, 2nd sem.
- [ ] Delay reasons for each delayed subject.
- [ ] Save to localStorage (data stays on the device).
- [ ] GitHub Pages deploy from `main`, so every merge gives a link to open on a phone.

### Milestone 3
- [ ] What-if ("fail X this sem", "take 15 units") without saving.
- [ ] Export / import JSON backup.
- [ ] PWA install.

## Known limits

- Subjects flagged with `check` in the curriculum JSON (214, 204, 206, 404, 414, 312, 315) still need confirming against the official curriculum; plans for them may change.
- No summer terms, and the cap is never exceeded (open question in SPEC.md: can a student go over with approval?).
- No year-standing rules (e.g. review subjects needing all 3rd-year subjects) until the school confirms them.
- A prerequisite code that isn't in the curriculum is treated as satisfied.
