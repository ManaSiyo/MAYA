# MAYA handoff — September 29, 2026

## Current state

The owner-approved web preview is now [Aesthetic Control](../aesthetics/aesthetic-control.html). It is the visual editor for typography, pills, overlays, icons and page examples. Its supporting files live in `aesthetics/aesthetic-control/`; `docs/design.md` is the sole written specification. Admin → Systems opens the new page. The old `/playground/components/index.html` address has a Hosting rewrite to the new HTML. The existing authenticated `/api/admin/design` Save and public `/api/design` read contract are unchanged. Saving on the live service still needs verification after an owner-requested deployment.

The repository audit moved obsolete audits, retired design files, the duplicate `CLAUDE.md`, a Claude patch archive and dormant pattern-making research into `_to_delete/repo-cleanup-2026-09-29/`. That folder is ignored by Git and Firebase Hosting; the original working files remain locally recoverable. No migration, Storage cleanup, credentials, tokens, billing or production environment settings were touched. The full previous handoff and history are preserved in the same local cleanup folder. See `docs/REPO-MAP.md` for the map and exact move list.

`frontend/`, `backend/`, `docs/`, and `aesthetics/` are the primary product folders. Root `AGENTS.md`, `cloudbuild.yaml`, `robots.txt` and `.firebaserc` remain because the tools or deployment need those names and locations. Root `tests/` remains because Cloud Build and test imports expect it. Root `playground/` remains the active staging copy at `/playground.html`; moving it would require a separate release migration. Do not delete either just to make the root look shorter.

## Validation

`tests/design-contract.mjs`, `tests/typography-usage.mjs`, `tests/container-contract.mjs`, `tests/style-inventory.py`, `tests/component-gallery.mjs` and full `tests/app-regression.mjs` passed locally after the moves. The gallery browser check covered Save/reload, Admin application and widths 320–1920px. `docs/firebase.json` parsed successfully. Production Hosting and Cloud Run have not changed; no push was made.

## Open risks and exact next step

The typography Save endpoint was tested locally with mocked authenticated requests, not yet against live Cloud Run. The `_to_delete` backup is intentionally local and ignored; Git history retains tracked source after a local commit. The next step, only when Fromsa requests it, is to push the verified branch and check the live Aesthetic Control route, old preview URL, Admin link, owner Save and shared styles on client/Admin/Outbound. Keep the sealed-project/account rule intact.
