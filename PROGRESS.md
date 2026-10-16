# Progress log

What's done, what's next, and what's blocked. Newest entries first.

## Current state (2026-10-16) — Working Subjects is the main screen

- **Live:** https://rikkirc.github.io/curriculum-organizer/, deployed by GitHub Actions on every merge to `main` (after the tests pass).
- **Flow:** (1) enter every subject and its units by semester; (2) tick prerequisites; (3) review the default plan and choose the cap (Default = full load, or Custom); (4) on Working Subjects, record each semester's results as you go; (5) failed subjects and everything that needs them move to their next offering automatically.
- **Screens:** setup (3 steps), Working Subjects (expected graduation; semesters from Year 1 to graduation with units taken vs the curriculum's load; finished ones folded; the current one with Passed / Failed / Taking / Not this sem; what moved and why; a prompt when a full-load semester is pushed over its load), Curriculum, Settings.
- **Data:** curriculum and results stay in the browser (localStorage); backups include the curriculum.
- **Tests:** 75 — planner (25), data edits and wording (7), curriculum edits and recording (10), backup (13), screens in jsdom (20). CI runs lint, type check, tests and build on every push.

## Log

### 2026-10-16 (evening) — "Not this sem" and fixed semester units
- Subjects in the current semester have a **Not this sem** button: the subject moves to the next semester it's offered (a year later), and every subject that needs it moves too, following the prerequisite rules. The moved subject says "You chose not to take it in …" with an Undo link. Stored as `not_before` on the student (kept in backups).
- Each semester shows the units taken against that semester's load in the curriculum ("12 of 16 units"); the − / + buttons are gone, so the curriculum load stays fixed. Semesters after the standard plan show just their units. The cap itself is set in Settings (Default or Custom) or by the full-load prompt.

### 2026-10-16 (later) — Working Subjects replaces the Plan
- The Plan tab and what-if are gone. Working Subjects now shows every semester: finished ones fold to one line ("18 units · 6 passed"), the current one has Passed / Failed / Taking per subject and "Mark all passed", later ones show what's planned. Tap a recorded result to change or remove it.
- Expected graduation and units passed moved to the top of Working Subjects.
- Planning keeps each subject in its semester from the curriculum; it never pulls a subject earlier. A failed subject goes to the next semester it's offered, and every subject that needs it moves to its next offering after that ("Moved from Year 3, 1st sem: Needs 214 … passed first").
- Each semester shows its units against its cap, with − / + to change it.
- On the Default (full load) cap, when moved subjects push a semester over its full load, a prompt asks how many units to take: for that semester only, or every semester from now on.
- The semester in progress is the latest one with a recorded result (or the plan-from term in Settings, if later); unrecorded subjects in it stay planned there.
- Review shows each prerequisite's full title. The sample JD curriculum no longer carries "To confirm" notes; subjects come only from the student's curriculum.
- SPEC.md still lists what-if; it was removed at the user's request (see above).

### 2026-10-16 — chips, Working Subjects, Default cap
- Prerequisites show as boxed chips, each with an × to remove it (Prerequisites step and Curriculum tab). The Default plan review shows them as boxes too, without ×.
- The Results tab is now **Working Subjects**.
- Unit cap has two choices (Settings and setup step 3): **Default**, where each semester's cap is its full load in the curriculum (semesters after the standard plan use the largest full load), or **Custom**, one number every semester. The − / + per semester still overrides either.

### 2026-10-15 (late night) — the student builds the curriculum
- First visit opens a 3-step setup instead of the demo: Subjects (add code, title, units under each semester; add more years up to Year 8; edit, move or delete), Prerequisites (tick earlier subjects only), Review (default plan, total units, standard graduation, unit cap).
- "Use the sample JD curriculum" loads the 53 JD subjects to edit; "look around with a demo student" opens the demo.
- Curriculum tab to change subjects and prerequisites later. Renaming a code carries into prerequisites and results; deleting a subject removes its results (asks first). Moving a subject so a prerequisite is no longer earlier is reported in plain words.
- Plan: "I'm taking these now" on the next semester records its subjects as Ongoing; a "Taking now" card then has Passed / Failed / Not taking it for each.
- The standard graduation term now comes from the curriculum (latest semester with subjects) instead of a fixed Year 4, 2nd sem.
- Units spelled out everywhere ("3 units", "1 unit").
- Settings: "Clear my results" (keeps the curriculum) and "Start over" (back to setup) replace "Start fresh".
- Saved data and version 1 backups from before keep working on the JD curriculum. Backups are now version 2 and include the curriculum.
- Screen readers now hear "214 Corporation…" instead of "214Corporation…" on subject rows.

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
- [x] What-if ("fail X this sem", "take 15 units") without saving. (Removed later with the Plan tab.)
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
