# Progress log

What's done, what's next, and what's blocked. Newest entries first.

## Current state (2026-10-15) — Milestone 3: what-if, backup, installable

- **Live:** https://rikkirc.github.io/curriculum-organizer/, deployed by GitHub Actions on every merge to `main` (after the tests pass).
- **Screens:** Plan (graduation date, terms with − / + unit cap, delay reasons, what-if), Results (Passed / Failed / Ongoing per subject, retakes as extra attempts), Settings (plan-from term, default cap, install, backup, start fresh / demo).
- **Data:** stays in the browser (localStorage); export/import a JSON backup to keep a copy or move devices.
- **Install:** add to the home screen on iPhone or Android; opens like an app and works offline.
- **Tests:** 53 — planner acceptance tests and checks (17), data edits and wording (8), what-if (8), backup (11), and 9 that drive the screens (jsdom). CI runs lint, type check, tests and build on every push.

## Log

### 2026-10-15 (night) — Milestone 3
- What-if on the Plan: "I fail X this sem" (this sem = the Ongoing subjects, or the first planned semester) and "I take N units every sem from now on". Shows the what-if graduation next to your real one; nothing is saved.
- Demo student: failing 214 again → Year 6, 2nd sem (1 year later); 9 units → Year 6, 2nd sem; 15 units → still Year 5, 2nd sem (the 214 → 305 → 312 → 401.2 chain sets the date, not the cap).
- Backup: Export downloads `curriculum-organizer-backup-YYYY-MM-DD.json`; Import checks the file and says plainly what's wrong if it can't be used. Also accepts files shaped like `data/demo-student.json`.
- Installable app (PWA): manifest, icons, and a service worker so it opens offline. Checked in Chromium: reloads with the network off.
- Settings → Install on your phone: an Install button where the browser offers one, otherwise steps for iPhone and Android.
- Confirmed Milestone 2's first Pages deploy succeeded.

### 2026-10-15 (evening) — Milestone 2
- Screens: Plan, Results and Settings, built for phone first; light and dark mode follow the phone's setting.
- Plan: earliest graduation and the gap to Year 4, 2nd sem; each term with its units and a − / + cap; delayed subjects say why in plain words ("Needs 214 Corporation and Basic Securities Law passed first…").
- Results: tap a subject to record Passed / Failed / Ongoing and the term; retakes default to the next time the subject runs; "Mark the rest passed" per semester for quick entry; subjects flagged `check` show their note.
- If the results go past the plan's start term, the Plan offers to start from the next one.
- Saved in localStorage; nothing leaves the device.
- GitHub Pages deploy workflow (`deploy.yml`).

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
- [x] Results entry: mark each subject Passed / Failed / Ongoing and the term taken.
- [x] Unit cap per term (default 12).
- [x] Plan by term, with the graduation date and how far it is from Year 4, 2nd sem.
- [x] Delay reasons for each delayed subject.
- [x] Save to localStorage (data stays on the device).
- [x] GitHub Pages deploy from `main`, so every merge gives a link to open on a phone.
- [ ] Try it on a real phone after the first deploy.

### Milestone 3
- [x] What-if ("fail X this sem", "take 15 units") without saving.
- [x] Export / import JSON backup.
- [x] PWA install.
- [ ] Install on a real iPhone and Android phone; check it opens offline.

### Milestone 4 — portfolio
- [ ] README with screenshots (phone Plan, Results, what-if).
- [ ] Demo link in the README (done) and a short case study (docs/CASE_STUDY.md).

## Known limits

- Subjects flagged with `check` in the curriculum JSON (214, 204, 206, 404, 414, 312, 315) still need confirming against the official curriculum; plans for them may change.
- No summer terms, and the cap is never exceeded (open question in SPEC.md: can a student go over with approval?).
- No year-standing rules (e.g. review subjects needing all 3rd-year subjects) until the school confirms them.
- A prerequisite code that isn't in the curriculum is treated as satisfied.
