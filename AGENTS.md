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
- Fromsa authorizes local commits of completed, verified requested work. Prepare
  an accurate commit summary and description covering changes, validation and
  remaining limitations, then commit the task's files so only Push remains for
  Fromsa in GitHub Desktop. Do not include unrelated edits. No computer use is
  needed: use Git directly. Never amend existing commits unless explicitly asked.
  Keep docs/COMMIT-REVIEW.txt aligned with the current prepared commit.

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
                           Affiliates Beta    → /affiliates.html (admin-only route view)
backend/marketing.html     Marketing          → /marketing.html
backend/operations.html    Operation Room     → /operations.html
backend/outbound.html      Outbound           → /outbound.html
backend/outbound.js        Outbound UI logic (served alongside its page)
backend/outbound-priority.js  Pure priority/follow-up calculations (public, no secrets)
backend/backend.html       the Brief          → /backend.html
backend/privacy.html       privacy policy     → /privacy.html
backend/verify.html        deploy check       → /verify.html
aesthetics/                every picture the site serves, at the root
docs/                      everything an agent reads, nothing the web serves
docs/server/               Cloud Run: server.js, Dockerfile, rules,
                           maya-mcp.mjs (Maya's MCP door) and
                           maya-character.md (who Maya is, read per call)
docs/firebase.json         the hosting map. Moving a page starts HERE.
playground/index.html      Fromsa's private copy → /playground.html. New or
                           risky features land HERE first and are promoted to
                           frontend/index.html only when he approves.
robots.txt                 a real file, so a crawler is not handed the app
cloudbuild.yaml            Cloud Build reads it at the root, leave it there
tests/                     the suite resolves the repo root from its own folder
docs/MAYA-INDEPENDENCE.md  the roadmap for Maya as an entity; read it before
                           touching her voice, memory, tools or the door
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

Communications changes also run `tests/maya-phone.mjs`, `tests/maya-messages.mjs`,
`tests/maya-transfer.mjs` and `tests/maya-feedback.mjs`. These use fake providers;
live call audio, SMS delivery and owner transfer acceptance still need an owner
verification after deployment. Avatar/Pinterest changes stay in Playground until
Fromsa approves promotion.

Outbound implementation: docs/server/outbound.mjs plus crm-intelligence.mjs,
crm-gmail.mjs, crm-ai.mjs and crm-store.mjs in docs/server. The shared Admin/Outbound
meter is aesthetics/ui/ai-meter.js. Mailbox secrets and cost ledgers are server-only
private/outbound/<kind>/<account> objects; never expose them via client Storage rules.
Run tests/crm-intelligence.mjs, tests/crm-ui.mjs and tests/crm-failure-ui.mjs for
these paths; all are release gates. The failure suite covers account isolation,
pending edits, drawer dialogs and meter recovery with fake providers.
Hourly updates require owner-configured Cloud Scheduler, not a browser timer.
The $1 cap covers CRM text AI (Outbound plus owner SMS parsing), not voice, images or provider invoices.
Owner commands: docs/server/owner-crm.mjs and aesthetics/ui/owner-crm.js. Run
tests/owner-crm.mjs and tests/owner-crm-ui.mjs. Owner activation binds a verified
allowlisted Admin account to the configured phone; never accept a phone or UID
from SMS text. Gmail candidates stay account scoped until the owner adds a lead.

Model defaults and chat
compatibility: docs/server/model-config.mjs. Outbound stores each admin's
workspace under maya/outbound/<encoded Google sub>.json with GCS generation
preconditions. Never replace that account-scoped key with a shared file.
Run tests/outbound.mjs for Outbound/model changes; it uses fake providers.
Run tests/outbound-ui.mjs for Outbound/shared CRM UI changes; its browser routes
use local files and fake data. It includes tests/lead-filter-ui.mjs for populated
open status menus, clipping, scrolling and keyboard focus. Both are in the Cloud
Build release gate.
See docs/OUTBOUND-SETUP.md for owner-only connection and launch steps.

## Visual canon

`docs/Aesthetics.pdf` (V3) is the primary aesthetic reference.
`docs/MAYA-V4-CANON.md` extends it for dense interfaces; it does not replace V3.
Backend pages load `aesthetics/ui/maya-canon.css`; consumer and Playground retain
their approved frontend styling as the reference. Change backend tokens and
components in the shared CSS, not a new per-page visual system. Jost is functional; Cormorant
is reserved for branding/display. Data and metrics use Jost with tabular numerals.

Outbound source-of-truth columns and priority rules are regression-tested in
`tests/outbound-priority.mjs` (invoked by outbound/app-regression) and populated
`tests/outbound-priority-ui.mjs` (invoked by outbound-ui). Keep unknown follow-up
history explicit. Refreshing a Sheet must not erase draft edits or re-count a
recorded send. No automatic email sending is part of the To Do queue.

Admin/Outbound compact workspace: Lead Station includes Contacted as a distinct
persisted status. Outbound uses 250-record continuous batches and a compact view
menu, never page-switch navigation. Keep full-dataset filters ahead of batching.
The full regression HTTP fixture must serve CSS as text/css so the shared canon
is actually tested. tests/crm-ui.mjs covers append identity, selection and search.
