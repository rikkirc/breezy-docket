# Progress log (Breezy Docket)

What's done, what's next, and what's blocked. Newest entries first.

## Current state (2026-10-19) — welcome page, sign in, then Working Subjects; summer classes

- **Live:** https://rikkirc.github.io/breezy-docket/, deployed by GitHub Actions on every merge to `main` (after the tests pass).
- **Flow:** (0) a welcome page says what the app does and how to use it; "Get started" → sign in (Google or email; agree to the Privacy notice before creating an account; accounts from before the notice agree once) — then the account's plan; (1) enter every subject and its units by semester; (2) tick prerequisites; (3) review the default plan and choose the cap (Default = full load, or Custom); (4) on Working Subjects, record past semesters first, in order, as they happened, then each semester's results as you go; (5) failed subjects and everything that needs them move to their next offering automatically.
- **Screens:** setup (3 steps), Working Subjects (expected graduation; semesters from Year 1 to graduation with units taken vs the curriculum's load; finished ones folded; the Now one with Passed / Failed / Taking / Not this sem; Move… on later subjects; what moved and why), Curriculum, Settings, Privacy notice, How to use. Summer terms when the school offers summer classes.
- **Data:** the plan is kept in the student's account (Firestore) and in the browser (localStorage) while signed in; the date the student agreed to the Privacy notice is kept with the plan; backups include the curriculum.
- **Tests:** 129 — planner (33), data edits and wording (13), curriculum edits and recording (12), backup (14), templates (2), sync (7), screens in jsdom (31), account flow (17); plus 6 Firebase emulator tests (security rules and account code). CI runs lint, type check, tests and build on every push.

## Log

### 2026-10-19 — Welcome page, how to use, summer classes, agreement prompt
- **Welcome page** before sign-in: what the app does, how to use it, then "Get started" → sign-in ("← About Breezy Docket" goes back). How to use is also in Settings.
- **How to use** stresses recording past semesters first, in order, as they actually happened: a failed subject is marked Failed where it was first taken (not Taking), and the retake is recorded at its next offering. Working Subjects shows a "Start here" note until the first result is recorded.
- **Summer classes:** "My school offers summer classes" (setup step 1 and Curriculum tab) adds a Summer term to each year; subjects can be summer-only or "Also offered in the summer". Settings → Units per summer (blank = no summer classes) lets the planner use summers, e.g. to retake a failed subject without losing a year. Terms are now 1st sem, 2nd sem, Summer (`Y3-3`); stored data is unchanged. "Behind the standard plan" counts regular semesters (a summer counts with the 2nd sem before it).
- **Agreement prompt:** signed-in accounts with no agreement date (made before the Privacy notice) see "Please review the Privacy notice" once, with I agree (saves `consentedAt`) or Sign out. Settings → Account shows the date agreed. The agreement given at sign-up is kept until it is written, so an interrupted sign-in doesn't lose it.
- Checked end to end against the Firebase emulators (the real app in Chromium, email sign-up): `consentedAt` is stored on sign-up and kept through later saves; the prompt writes it for an account without one. Build with `VITE_FIREBASE_EMULATOR=true` to run the app against the emulators.
- Deploy: a repository named `<owner>.github.io` is served from the root (`/`), any other name from `/<name>/`.

### 2026-10-16 — Privacy notice, consent, unofficial label
- **Privacy notice** screen, linked from the sign-in screen and Settings → Account: what the app keeps, where (this device and Google Firebase; servers may be outside the Philippines), who can see it, how long, the student's rights, and grades as sensitive personal information under RA 10173. Checked against the code: no analytics or tracking; the developer can access the Firebase project; saved subject templates stay in the browser after sign-out. Questions and requests go to rikkicabanlet@gmail.com (`PRIVACY_CONTACT`).
- **Consent before an account is created:** "I've read the Privacy notice and agree to Breezy Docket keeping my plan and results in my account." Create account and Continue with Google stay disabled until it's ticked; email sign-in to an existing account doesn't need it. The date agreed is saved as `consentedAt` in the plan document and kept on every save; `firestore.rules` allows that one field (a date string) — publish the new rules before deploying.
- **Unofficial label** on the Xavier University - School of Law Curriculum (template list in setup, demo banner): "Based on the current official curriculum. Unofficial app, not affiliated with or endorsed by Xavier University." The template matches the current official curriculum; the leftover `check` notes are removed from `data/jd-curriculum.json`.
- Settings → Your data no longer says "Nothing is sent anywhere" when accounts are on.

### 2026-10-16 — Breezy Docket
- The app is now **Breezy Docket** (header, browser tab, phone install name). The sign-in screen shows the tagline "Breeze your way through every sem, all the way to graduation." and "by: RCbreezy©". The link is now https://rikkirc.github.io/breezy-docket/ (repository renamed from curriculum-organizer).

### 2026-10-16 — Sign-in first, focus notes, Xavier University curriculum
- **Sign-in screen first:** the app opens on "Sign in" (Google, or email and password, or create an account) and then shows the plan saved in that account. Someone already signed in on the device goes straight to their plan ("Opening your plan…" while it loads). Sign out returns to the sign-in screen and clears the device. A plan already on the device is offered to the account on first sign-in, as before. The "Have an account?" panel in setup is gone.
- **Taking subjects say what's riding on them:** "You need to pass this to take 305 Commercial Laws I (Year 4, 1st sem) …", then what failing would do: "Failing it would move your graduation to Year 6, 2nd sem." (in red), "…would move those subjects but not your graduation.", or "No later subject needs this one."
- **Xavier University - School of Law Curriculum** replaces "Sample JD curriculum" as the built-in template at the start of setup (same 53 subjects, 142 units).

### 2026-10-16 — Optional accounts (Firebase)
- Optional sign-in with Google or email and password: Settings → Account, and "Have an account? Sign in" on the first setup screen. Signed in, the plan is kept in the student's account (Firestore `plans/{uid}`) and syncs across devices; edits save shortly after they're made and changes from other devices appear automatically.
- First sign-in: an empty account takes the device's plan; a blank device takes the account's; if both differ, the student picks which to keep. Sign out clears the device (plan stays in the account). Delete my account removes the stored plan and the account.
- Security rules (`firestore.rules`): only the signed-in owner can read/write/delete their plan, in the plan's shape only; no listing. Tested on the Firebase emulators (`npm run test:firebase`, in CI).
- Firebase loads only when accounts are used (separate chunk). `@grpc/grpc-js` pinned to 1.14.6 (npm audit clean).
- Firebase project: `curriculum-organizer-ce412` (config in `src/cloud/config.ts`). Setup steps in docs/ACCOUNTS.md.

### 2026-10-16 — Move only forward; link follows the repository name
- Move… now offers only semesters later than where the subject is planned (still only the semester it's offered in, after its prerequisites).
- The deploy builds the site for `/<repository name>/`, so renaming the GitHub repository changes the link with no code change.

### 2026-10-16 (late night) — over-cap flags, templates, per-semester units, move warnings
- **Over the cap:** subjects no longer move on their own because a semester is full. They stay where prerequisites and offering allow; a semester over its cap turns red with three choices: **Fit to N units** (the app picks what moves to the next offering, keeping subjects others depend on), **Allow N units this sem**, or move subjects yourself (Not this sem / Move…). Planner option `overCap: 'flag'` (the app) vs the default `'fit'` (the SPEC acceptance tests).
- **Templates:** "Save these subjects as a template" with a name (setup steps 1 and 3, Curriculum tab); saved templates are listed at the start of setup next to the sample JD curriculum, with × to delete. Stored in this browser.
- **Custom cap:** one number for every semester, plus "Choose the units for each semester" (blank = the usual number).
- **Move warning:** next to Move… and Not this sem: "If you move this subject, you won't be able to take 305 Commercial Laws I in Year 4, 1st sem." for subjects that need it in the next two semesters.
- Settings: "Clear my results (keep my curriculum)" with a line explaining how it differs from Start over (kept: it isn't redundant).

### 2026-10-16 (night) — Move later subjects, Now follows Taking, tab order
- A semester with subjects marked **Taking** is the **Now** semester (it no longer jumps ahead when everything in it is Taking). "Mark all passed" there also passes the Taking subjects.
- The "Units to take" prompt is gone: on the full-load cap, subjects that don't fit a semester simply move to a later one.
- Tabs are now **Settings · Curriculum · Working Subjects** (Working Subjects still opens first).
- Subjects in semesters after Now have **Move…**: it lists the semesters the subject can go to (only the semester it's offered in, after its prerequisites are passed or planned, from Now to a year past the plan). Subjects can move earlier than their curriculum semester to plan ahead, or later. Subjects that need a moved subject follow through the prerequisite rules. "You moved it here. Undo" on each moved subject.
- "Not this sem" and Move share one setting: `placed` (subject → semester) on the student; older `not_before` data is read as `placed`.

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
- [ ] README screenshots: sign-in, setup, Working Subjects, focus notes.
- [ ] Demo link in the README (done) and a short case study (docs/CASE_STUDY.md).

## Known limits

- The cap is never exceeded automatically (open question in SPEC.md: can a student go over with approval?).
- No year-standing rules (e.g. review subjects needing all 3rd-year subjects) until the school confirms them.
- A prerequisite code that isn't in the curriculum is treated as satisfied.
