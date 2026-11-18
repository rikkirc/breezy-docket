# Progress log (Breezy Docket)

What's done, what's next, and what's blocked. Newest entries first.

## Current state (2026-10-19) — for every student: welcome page, sign in with consent, Working Subjects, summer classes

- **For:** college, graduate and professional students alike, studying full time or working while they study. The Xavier University - School of Law Curriculum is a built-in template (labelled unofficial); any program can be entered.
- **Live:** https://rikkirc.github.io/breezy-docket/, deployed by GitHub Actions on every merge to `main` (after the tests pass). Firestore security rules are published automatically when `firestore.rules` changes, after the rules tests pass.
- **Flow:** (0) a welcome page says what the app does and how to use it; "Get started" → sign in (Google or email; agree to the Privacy notice before creating an account; accounts from before the notice agree once) — then the account's plan; (1) enter every subject and its units by semester; (2) tick prerequisites; (3) review the default plan and choose the cap (Default = full load, or Custom); (4) on Working Subjects, record past semesters first, in order, as they happened, then each semester's results as you go; (5) failed subjects and everything that needs them move to their next offering automatically.
- **Screens:** setup (3 steps), Working Subjects (expected graduation; semesters from Year 1 to graduation with units taken vs the curriculum's load; finished ones folded; the Now one with Passed / Failed / Taking / Not this sem; Move… on later subjects; what moved and why), Curriculum, Settings, Privacy notice, How to use. Summer terms when the school offers summer classes.
- **Data and privacy:** the plan is kept in the student's account (Firestore) and in the browser (localStorage) while signed in; no other student can see it, and the Privacy notice says the developer can access the Firebase project. Students agree to the notice before creating an account (accounts from before it agree once); the date is kept with the plan as `consentedAt`. Backups include the curriculum.
- **Tests:** 130 — planner (33), data edits and wording (13), curriculum edits and recording (12), backup (14), templates (2), sync (7), screens in jsdom (31), account flow (18); plus 6 Firebase emulator tests (security rules and account code), also run before every rules publish. CI runs lint, type check, tests and build on every push.

## Log

The full history is in [docs/CHANGELOG.md](docs/CHANGELOG.md). Add each new entry there (newest first), and keep **Current state** above up to date in a few lines.

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
