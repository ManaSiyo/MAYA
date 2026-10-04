# MAYA folder map

| Folder | Purpose |
|---|---|
| `frontend/` | Client MAYA app, served at `/`. |
| `backend/` | Admin, Outbound, Brief, Operations and supporting pages. |
| `aesthetics/` | Served imagery, shared UI, and [Aesthetic Control](../aesthetics/aesthetic-control.html). The control's scripts, CSS and generated inventories are in `aesthetics/aesthetic-control/`. |
| `docs/` | Current design rules, runbooks, requests, fixes, Hosting map and Cloud Run source. Not served by Firebase Hosting. |
| `playground/` | Active client staging app, served at `/playground.html`. Kept separate so changes are not silently promoted to clients. |
| `tests/` | Release tests invoked by `cloudbuild.yaml`. Its root location is part of the current build contract. |
| `_to_delete/` | Local, Git-ignored recovery area. Firebase Hosting ignores it. |

Root `AGENTS.md` is read automatically by Codex. Root `cloudbuild.yaml`, `.firebaserc`, and `robots.txt` are required by deployment or crawlers. `docs/design.md` is the only active written design specification; Aesthetic Control is the owner-editable visual standard. The old preview URL rewrites to it.

## September 29 cleanup

The following were moved to `_to_delete/repo-cleanup-2026-09-29/` after a source-reference and deployment-path audit:

- Duplicate `CLAUDE.md` and `Claude outputs/` patch archive.
- Full old `docs/AI-HANDOFF.md` and `docs/history.txt`; short current files replaced them.
- `docs/archive/`, `docs/design/`, `docs/design-archive/`, obsolete `docs/AUDIT-*`, `docs/REVIEW-*`, V4 canon, migration/aesthetic audits, old release/SMS reviews and the one-off deep-audit prompt.
- Dormant `docs/backend/operating-room/` research prototype and its PDF/test materials. It was not imported by the live Operations page, Cloud Run, Hosting or release tests.
- Old Maya vision, local soul mirror and feature-log notes; the live character remains `docs/server/maya-character.md`, and live memory stays in the account-scoped service store.
- `tests/design-audit.py`, which only regenerated retired design-archive reports.

The earlier request and fix logs remain because they contain unresolved work. `docs/server/MIGRATION-RUNBOOK.md`, Firestore and Storage rules remain because migration status has not been confirmed. `docs/CODEX-MAYA-BRIEF.md`, the fabric study, and current provider/Outbound runbooks remain because release checks or current work reference them. No served imagery moved. The current `aesthetics/aesthetic-control.html` is an actual HTML page, not a PDF or Markdown mockup.

To restore any moved item before it is intentionally discarded, copy it from the matching path beneath `_to_delete/repo-cleanup-2026-09-29/`. Tracked files are also recoverable from Git history. No push or production deploy is part of this cleanup.

A byte-for-byte hash scan of the active product and documentation folders found no remaining identical files. Similar CSS files were retained where one is an active compatibility adapter; removing an adapter without migrating its selectors would change the served UI.
