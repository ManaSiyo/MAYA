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

## Where things live (v13.30)

The repository root IS the published website: Firebase Hosting serves it with
`public: "."`. So the root holds only what the web serves plus what the build
needs, and everything an agent reads lives in `docs/`.

- Served pages at the root: `index.html`, `status.html`, `backend.html`,
  `operations.html`, `verify.html`, and `aesthetics/`.
- `docs/`: `README.md`, `AI-HANDOFF.md`, `requests.txt`, `fixes.txt`,
  `history.txt`, `server/` (Cloud Run + rules), `firebase.json`, `archive/`.
- Root also keeps `cloudbuild.yaml` (Cloud Build reads it there), `tests/`
  (the suite resolves the repo root from its own folder), and these two
  contracts, which each agent looks for at the root.
- Never move or rename a served page without changing `docs/firebase.json` and
  the links in the other pages. Never touch `.git`.
