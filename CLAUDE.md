# MAYA assistant instructions

This repository is worked on by both Codex and Claude. The repository files,
not chat memory, are the shared source of continuity.

Before changing anything:

1. Read `docs/README.md`.
2. Read `docs/AI-HANDOFF.md`.
3. Read `docs/requests.txt` and `docs/fixes.txt`.
4. Run `git status --short --branch` and inspect the latest commits.

While working:

- Preserve the sealed-project rule: one user has many projects and project data
  must never cross project or account boundaries.
- Never touch credentials, tokens, billing settings, or production environment
  variables unless Fromsa explicitly handles that step.
- Do not delete legacy migration or Storage cleanup paths merely because they
  look old. Confirm the migration is complete first.
- Keep changes focused and verify every edited path.
- Never push unless Fromsa explicitly asks. The current Cloud Build trigger can
  deploy a pushed branch to production.

Before handing off:

1. Run the narrowest relevant tests, then broader checks when available.
2. Update `docs/AI-HANDOFF.md` with changed files, validation, open risks, and
   the exact next step.
3. Update `docs/requests.txt` for owner-visible requests, `docs/fixes.txt` for operational
   incidents, and `docs/history.txt` only for meaningful shipped milestones.

## Where things live (v13.37)

Firebase Hosting still serves this repository with `public: "."`, but the
pages no longer sit loose at the root. `docs/firebase.json` maps every old
address onto its new file, so every URL that ever worked still works.

```
frontend/index.html        the app            → served at /
backend/status.html        Systems Map        → /status.html
backend/marketing.html     Marketing          → /marketing.html
backend/operations.html    Operations Room    → /operations.html
backend/backend.html       the Brief          → /backend.html
backend/privacy.html       privacy policy     → /privacy.html
backend/verify.html        deploy check       → /verify.html
aesthetics/                every picture the site serves, at the root
docs/                      everything an agent reads, nothing the web serves
docs/server/               Cloud Run: server.js, Dockerfile, rules
docs/firebase.json         the hosting map. Moving a page starts HERE.
robots.txt                 a real file, so a crawler is not handed the app
cloudbuild.yaml            Cloud Build reads it at the root, leave it there
tests/                     the suite resolves the repo root from its own folder
AGENTS.md / CLAUDE.md      this contract, one text under two names
```

- `aesthetics/` CANNOT move into `docs/`: `docs/**` is in the hosting ignore
  list, so the pictures would stop deploying and every page would lose its
  background and logo.
- Never move or rename a served page without editing the rewrites in
  `docs/firebase.json` in the SAME commit, and never touch `.git` or
  `.firebaserc`.

## The handoff is part of the change, not a chore afterwards

Every commit that changes behaviour updates, in the same commit:

1. This file, if the layout, the rules or the tooling changed.
2. `docs/AI-HANDOFF.md`: what changed, what was verified, what is still open,
   and the exact next step. It is a state file, not a log; replace stale lines.
3. `docs/requests.txt` for a request Fromsa made, `docs/fixes.txt` for an
   incident, `docs/history.txt` only for a shipped milestone.
4. `tests/app-regression.mjs`: one assertion per completed request. A change
   with no assertion is a regression waiting to happen.

`AGENTS.md` and `CLAUDE.md` are the same text under two names, because Codex
reads one and Claude reads the other. Change one, copy it to the other.
