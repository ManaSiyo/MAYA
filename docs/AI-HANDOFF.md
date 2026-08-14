# MAYA shared handoff

This is the current agent-neutral handoff for Claude and Codex. Keep it short
and replace stale task details instead of turning it into another history log.

## Current repository state

- Product version: `13.10`
- Production branch: `maya-v2`
- Starting commit for this handoff: `8085235`
- Local working folder used by Fromsa: `~/Desktop/MAYA-new`
- Deployment: a GitHub push triggers Cloud Build, Cloud Run, Firebase Hosting,
  and Firebase rules deployment.

## Continuity map

- `README.md`: stable architecture, data model, deployment, and operating rules.
- `requests.txt`: Fromsa's requests and noticed bugs, newest first.
- `fixes.txt`: incidents and changes that may not exist in Git history.
- `history.txt`: concise product narrative and shipped milestones.
- `docs/AI-HANDOFF.md`: only the current task and the exact next step.
- `docs/CODEX-handoff.md`: archived v12.9 technical review; not current state.

## Current direction

- Claude and Codex should be interchangeable. Neither agent should rely on a
  private conversation as the only record of a decision.
- Git commits are the authority for code. This file explains unfinished work,
  validation, and intent that a commit cannot show by itself.
- Do not let two agents edit `index.html` concurrently. Finish or commit one
  agent's work before the other continues.
- Do not push partial work. The deployment trigger currently accepts every
  branch pattern, so a push may reach production.

## Next safe work

1. Give the Favorites screen a dedicated, calmer glow animation. Do not modify
   the shared board-card pulse. Reduce the halo expansion by approximately 15%
   and avoid continuously repainting large multi-layer shadows if practical.
2. Consolidate the duplicate Operations Room files only after verifying the
   standalone Beta route and the Backend iframe still receive the same data.
3. Remove confirmed no-caller session functions separately from migration and
   legacy Storage cleanup code. Migration code needs evidence before deletion.

## Latest completed work

- Objective: make Claude and Codex interchangeable without relying on chat
  history.
- Completed: added root instructions for both agents, created this neutral
  handoff, marked the old Codex handoff as archived, corrected the documented
  product version, and excluded internal memory files from Firebase Hosting.
- Runtime files changed: none.
- Validation: Firebase configuration parsed successfully and `git diff --check`
  passed.
- Exact next edit: implement and visually verify the dedicated Favorites glow
  described above without changing `maya-vision-pulse`.

## Handoff template

Replace this section when a task is left unfinished:

- Objective:
- Last completed step:
- Files changed:
- Tests run and results:
- Known risk or uncertainty:
- Exact next command or edit:
