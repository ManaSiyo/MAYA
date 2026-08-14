# MAYA assistant instructions

This repository is worked on by both Codex and Claude. The repository files,
not chat memory, are the shared source of continuity.

Before changing anything:

1. Read `README.md`.
2. Read `docs/AI-HANDOFF.md`.
3. Read `requests.txt` and `fixes.txt`.
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
3. Update `requests.txt` for owner-visible requests, `fixes.txt` for operational
   incidents, and `history.txt` only for meaningful shipped milestones.

