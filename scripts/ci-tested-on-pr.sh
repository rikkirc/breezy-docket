#!/usr/bin/env bash
# Used by the Deploy and Firestore rules workflows on a push to main: did the Tests workflow already pass, on a pull
# request, on exactly the files now on main? If so the merge workflow can skip running the same tests again.
#
# Writes tested=true or tested=false to $GITHUB_OUTPUT. It answers true only when all of these hold:
#   - the pushed commit belongs to a merged pull request into main;
#   - the pull request's last commit already contained the previous main (it was up to date), and the pushed commit
#     has the same files as that last commit, so the Tests run tested exactly what is now on main;
#   - a Tests run for that last commit succeeded with every step named in the arguments actually run (not skipped
#     because only docs changed).
# Anything else (a manual run, a direct push, an out-of-date branch, an API error) answers false, and the caller runs
# the full tests itself. It never fails the job.
#
# Usage: scripts/ci-tested-on-pr.sh "Unit tests" "Firebase rules tests"
# Needs: GH_TOKEN (actions: read, pull-requests: read, contents: read), GITHUB_REPOSITORY, GITHUB_SHA,
#        BEFORE (main before the push), GITHUB_OUTPUT.
set -uo pipefail

answer() {
  echo "tested=$1" >> "$GITHUB_OUTPUT"
  if [ "$1" = true ]; then echo "::notice::$2"; else echo "Running the tests here: $2"; fi
  exit 0
}

repo="$GITHUB_REPOSITORY"
[ "${GITHUB_EVENT_NAME:-}" = push ] || answer false "not a push to main."
[ -n "${BEFORE:-}" ] && [ "$BEFORE" != 0000000000000000000000000000000000000000 ] || answer false "no previous main commit."

head=$(gh api "repos/$repo/commits/$GITHUB_SHA/pulls" \
  --jq '[.[] | select(.merged_at != null and .base.ref == "main")][0].head.sha // empty') || answer false "couldn't look up the pull request."
[ -n "$head" ] || answer false "commit $GITHUB_SHA is not from a merged pull request."

status=$(gh api "repos/$repo/compare/$BEFORE...$head" --jq .status) || answer false "couldn't compare with main."
case "$status" in ahead | identical) ;; *) answer false "the pull request was not up to date with main ($status)." ;; esac

merged_tree=$(gh api "repos/$repo/git/commits/$GITHUB_SHA" --jq .tree.sha) || answer false "couldn't read the pushed commit."
head_tree=$(gh api "repos/$repo/git/commits/$head" --jq .tree.sha) || answer false "couldn't read the pull request's commit."
[ "$merged_tree" = "$head_tree" ] || answer false "main's files differ from the tested pull request's."

runs=$(gh api "repos/$repo/actions/workflows/tests.yml/runs?event=pull_request&head_sha=$head&status=success" \
  --jq '.workflow_runs[].id') || answer false "couldn't list the Tests runs."
for run in $runs; do
  ok=true
  for step in "$@"; do
    conclusion=$(gh api "repos/$repo/actions/runs/$run/jobs" \
      --jq "[.jobs[].steps[] | select(.name == \"$step\")][0].conclusion // empty") || { ok=false; break; }
    [ "$conclusion" = success ] || { ok=false; break; }
  done
  [ "$ok" = true ] && answer true "Tests run $run already passed on these exact files (pull request commit $head); not running them again."
done
answer false "no successful Tests run that ran: $*."
