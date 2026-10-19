# Curriculum Organizer: spec (v0.1)

## Problem

Working students can't take a full load, so they fall off the standard 4-year plan. Each semester they rebuild their plan by hand: which subjects are open to them, what a failed subject delays, and when they can graduate. This app does that planning for them.

**Users:** law students first (JD), later any college student working while studying.

## First version (MVP)

1. **One curriculum:** load `data/jd-curriculum.json` (53 subjects, 142 units).
2. **Record results:** for each subject the student marks Passed, Failed, or Ongoing, and the term it was taken.
3. **Unit cap per term:** the student sets the most units they can take each semester (default 12). It can differ by term.
4. **Automatic plan:** the app plans every remaining subject into future semesters (see "Planning rules").
5. **Graduation date:** shows the earliest possible graduation term, and how far it is from the standard plan (Year 4, 2nd sem).
6. ~~**What-if:** "What if I fail X this sem?" and "What if I take 15 units?" Show the new plan and graduation date, without saving.~~ **Removed** (Oct 2026): it slowed down the main task, recording results. Working Subjects now shows the effect of a failed subject directly, and each subject marked Taking says what failing it would do to graduation.
7. **Why is it delayed:** for each delayed subject, say why: a prerequisite not passed yet, only offered in the other semester, or no room under the unit cap.
8. **Backup:** export and import the student's data as a JSON file.

**Not in v1:** other schools' curricula, summer terms, accounts, cloud sync, grade averages. (Accounts, cloud sync and summer terms were added later; see PROGRESS.md.)

## Data

- `data/jd-curriculum.json`: each subject has `code`, `title`, `units`, `standard_year`, `offered_sem` (1 or 2), and `prerequisites` (a list of subject codes). It is the Xavier University - School of Law curriculum, matching the current official curriculum (an unofficial app, not affiliated with or endorsed by Xavier University).
- `data/demo-student.json`: a made-up student for tests, screenshots and the live demo. **Never commit a real student's name, ID number or grades.**
- A subject is defined once. Retakes are extra attempts on the same subject, not duplicate rows.
- Results (Passed, Failed, Ongoing) are entered by the student. Plan states (On schedule, Delayed) are calculated by the app, never typed in.

## Planning rules

A subject can be planned in a term only if:

- it is offered in that semester (`offered_sem`);
- all its prerequisites are **passed** by the end of the previous term (Ongoing counts as passed for planning, with a warning);
- the term's total units stay at or under the cap.

**Choosing subjects for a term** (order matters):

1. Prefer subjects that other subjects depend on, so chains of prerequisites don't slip.
2. Then fill as many units as possible up to the cap.
3. Then prefer subjects with the earliest `standard_year`.

A simple pass that fills each term in standard-year order is **not good enough**: it wastes units and adds a full year in the test case below. With about 10 candidate subjects per term, trying every combination per term is fast enough.

## Acceptance tests (write these first)

The planner is pure logic with no screens, tested with Vitest.

1. **Standard student:** nothing failed, cap 21 → graduates **Year 4, 2nd sem**, matching the standard plan.
2. **Demo student** (`demo-student.json`): passed all of Years 1–2 except Corporation Law (214, failed in Year 2 1st sem); cap 12 from Year 3 → graduates **Year 5, 2nd sem**. Every 1st sem from Year 3 on must be exactly 12 units.
3. **Regression:** the simple standard-order fill gives Year 6, 2nd sem for test 2. The real planner must beat it.
4. **Rules hold in every plan:** no subject before its prerequisites, none in the wrong semester, no term over the cap.
5. **Delay reasons:** in test 2, Commercial Laws I (305) is delayed because 214 isn't passed yet.

## Tech (suggested)

- Web app: React + Vite + TypeScript, installable on a phone as a PWA. No Android build needed, so it works on both phone and desktop from one link.
- Data stays in the browser (localStorage). No server in v1. Grades are personal data under the Data Privacy Act of 2012, so they stay on the student's device.
- Deploy to GitHub Pages from `main` with a GitHub Action, so the README can link a live demo.
- Same repo habits as Vault: README, `PROGRESS.md`, tests in CI.

## Milestones

1. Planner logic and the 5 tests above, with no UI.
2. Screens: results entry, plan by term, graduation date, delay reasons.
3. What-if (later removed), export/import, PWA install, live deploy.
4. Portfolio: README with screenshots, demo link, short case study.

## Open questions

- Confirm the subjects flagged with `check` in the JSON (214, 204, 206, 404, 414, 312, 315).
- Are there year-standing rules, such as "review subjects need all 3rd-year subjects passed"?
- Can a student ever go over the cap with approval? Your own plan has 13 units in Year 3, 2nd sem.
- Is there a maximum residency (years allowed to finish the program)?
