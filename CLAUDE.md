# Breezy Docket — notes for Claude

A React 19 + TypeScript + Vite PWA that plans a student's remaining subjects into semesters. Optional Firebase accounts (Auth + Firestore). Live at https://rikkirc.github.io/breezy-docket/, deployed from `main`.

## Where things are
- `src/planner/` — the planning engine (pure functions, `planner.ts`); tests in `planner.test.ts`.
- `src/lib/` — data edits, storage, sync, backup, templates (each has a `*.test.ts`).
- `src/cloud/` — Firebase account code. `firestore.rules` + `scripts/test-firebase.ts` for rules.
- `src/components/` — one file per screen. `WorkingSubjects.tsx` is the main screen.
- `src/App.tsx` — screen routing. `App.test.tsx`, `Account.test.tsx` — jsdom screen tests.
- `data/jd-curriculum.json` — built-in template; `data/demo-student.json` — made-up demo student.
- `SPEC.md` — rules of the planner. `PROGRESS.md` — current state and next steps. `docs/CHANGELOG.md` — full history (only read when history matters).

## Keep sessions cheap
- Read only the files the task needs. Don't read `package-lock.json`, `docs/CHANGELOG.md` or `data/*.json` unless the task is about them.
- Prefer Grep / `sed -n` on a range over reading whole large files (`WorkingSubjects.tsx`, `AccountPanel.tsx`, `planner.ts`).
- Don't use subagents or parallel explorers unless asked.
- Run only the tests for what changed, with a quiet reporter, e.g. `npx vitest run src/planner --reporter=dot`. Run the full check once at the end: `npm run lint && npm run typecheck && npx vitest run --reporter=dot`.
- Skip `npm run test:firebase` (slow; needs Java and emulators) unless `firestore.rules` or `src/cloud/` changed — CI runs it anyway.
- Don't take screenshots or launch the browser unless asked.
- Keep replies short: what changed, test result, anything blocked.

## Conventions
- Plain, short UI wording (see existing screens). Never commit a real student's name, ID or grades.
- After a user-visible change, add a short entry at the top of `docs/CHANGELOG.md` and update **Current state** in `PROGRESS.md` (few lines).
- If `firestore.rules` changes, the rules publish automatically on merge to `main` (see `docs/ACCOUNTS.md`).
