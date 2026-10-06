# MAYA assistant instructions

This repository is worked on by Codex. The repository files,
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
- Before connecting to or controlling any of Fromsa's Chrome windows, tabs, or
  profiles, send a permission notification and wait for his explicit answer.
  Ask again for each new Chrome access session, even if a previous task had
  access. Silence is not permission. Never use either Chrome while he says he
  is working in it. The MAYA and World of CEO Chrome sign-ins are separate;
  do not assume access to one grants access to the other. Use non-Chrome tools
  when possible, and do not switch profiles without that session's approval.
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
AGENTS.md                  active assistant instructions at the repository root
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

`AGENTS.md` stays at the repository root so Codex loads it automatically.
The retired Claude duplicate is in `_to_delete/`.

Communications changes also run `tests/maya-phone.mjs`, `tests/maya-messages.mjs`,
`tests/maya-transfer.mjs` and `tests/maya-feedback.mjs`. These use fake providers;
live call audio, SMS delivery and owner transfer acceptance still need an owner
verification after deployment. Avatar/Pinterest changes stay in Playground until
Fromsa approves promotion.

Outbound implementation: docs/server/outbound.mjs plus crm-intelligence.mjs,
crm-gmail.mjs, crm-ai.mjs and crm-store.mjs in docs/server. Admin provider hover
cards are aesthetics/ui/admin-systems.{js,css}; live pages no longer load the legacy
ai-meter.js component. Mailbox secrets and cost ledgers are server-only
private/outbound/<kind>/<account> objects; never expose them via client Storage rules.
Run tests/crm-intelligence.mjs, tests/crm-ui.mjs and tests/crm-failure-ui.mjs for
these paths; all are release gates. The failure suite covers account isolation,
pending edits, drawer dialogs and retired-meter absence with fake providers.
Hourly updates require owner-configured Cloud Scheduler, not a browser timer.
The $1 cap covers CRM text AI (Outbound plus owner SMS parsing), not voice, images or provider invoices.
Owner SMS access: docs/server/owner-sms-access.mjs provides AI-free history,
inbox, recorded actions, help/status and exact client-reply previews. Only raw
owner SMS SEND code authorizes a previewed client send; model/voice tools cannot
confirm it. Preserve recipient revalidation, block/STOP checks, expiry and the
non-retryable claim before provider calls. Reports are account-scoped snapshots
with explicit page commands. Read reports never mark client messages read.
Messages overflow archives privately via docs/server/message-archive.mjs before
the 400-entry live inbox is trimmed. Failed archive writes must not trim history;
explicit history deletion starts a new archive epoch. Run tests/owner-sms-access.mjs
and all communications suites; new runtime imports must ship in Dockerfile.
Owner conversation: docs/server/owner-conversation.mjs shares recent Messages
history and private account-bound memory/preferences across signed owner SMS and
owner phone calls. Supported runtime changes are remembered facts, response
style and signup SMS format; they do not execute code or alter authorization.
Owner phone `owner_control` is unavailable to clients. Signup formats use actual
lead fields, never example contacts. Run tests/owner-conversation.mjs plus the
communications suites. It is also a Cloud Build release gate.
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

Read `docs/design.md` before any aesthetic change. It is the sole active design
specification. Retired V3/V4 reports are under `_to_delete/`.
The shared component system is aesthetics/ui/components/{tokens.css,components.css,
components.js}. Owner-approved Aesthetic Control lives at
aesthetics/aesthetic-control.html and is linked from Admin → Systems. Saving
on the live site requires Admin auth and persists through /api/admin/design;
all served pages load aesthetics/ui/typography-controls.js. Local Save affects
only same-origin local pages. Old maya-buttons.css/maya-canon.css are adapters,
not independent design authorities. Typography offers one preview per role, with validated Jost/Cormorant and
Normal/ALL CAPS choices. Visuals groups button/icon glass before panel/table
controls. Preserve old saved schemas and semantic status colors when applying
shared text settings. Served pages load typography runtime v14.
Aesthetic Control opens within Admin through aesthetics/ui/admin-design.js; same-origin/source-checked close messages return via its logo. All Edit menus use the shared numeric input/select grid; popup padding has X/Y axes and legacy single-padding reads remain compatible. The fixed table formatting toolbar follows shared inner-panel material. Gallery Filter previews are retired; functional data filters remain. The saved editor material controls actual popups; formatting offers 200–500 weights and italic. Padding debug highlights exist only while a padding field is active. Restore uses the shared Refresh SVG. Run tests/component-gallery.mjs. Table preview cells use a fixed formatting toolbar; body selections edit complete semantic columns. Legacy row styles normalize to column settings without writing on load. The review section itself is the outer panel; never add a wrapper around its inner-panel pair. Every Edit restore returns to its last successful Save. Padding highlights are automatic and preview-only. Role counts are authored-template counts with linked pages and expandable source locations; regenerate with tests/typography-role-usage.py. Design saves atomically include a private audit trail;
/api/design must strip _history and /api/admin/design-history must stay Admin-gated.
Padding debug highlights are preview-only, never saved.

Outbound source-of-truth columns and priority rules are regression-tested in
`tests/outbound-priority.mjs` (invoked by outbound/app-regression) and populated
`tests/outbound-priority-ui.mjs` (invoked by outbound-ui). Keep unknown follow-up
history explicit. Refreshing a Sheet must not erase draft edits or re-count a
recorded send. No automatic email sending is part of the priority workflow.

Outbound September 29: four primary lists (All, Ceremonial, Corporate, Fashion House);
Email History dial in sidebar; all source columns use sort/contains/value filters
before batching. To Do and the global filter/action rows were retired.

Admin/Outbound compact workspace: Lead Station includes Contacted as a distinct
persisted status. Outbound uses 250-record continuous batches and a compact view
menu, never page-switch navigation. Keep full-dataset filters ahead of batching.
The full regression HTTP fixture must serve CSS as text/css so the shared canon
is actually tested. tests/crm-ui.mjs covers append identity, selection and search.

Container packaging: tests/container-contract.mjs checks local runtime imports
against docs/server/Dockerfile COPY sources before the image is built. Run it
when adding server modules or changing the Dockerfile.

Standalone Marketing was retired September 29. `/marketing.html` and
`/backend/marketing.html` redirect to Admin; keep its embedded marketing modules
and server endpoints intact.

Aesthetic Control live surface editors: aesthetics/aesthetic-control/surface-editors.js.
Runtime v14 saves independent inner/filter geometry and three Lead Station column
styles, top-row and first-column materials via validated optional design keys.
Keep preview/live table data-col keys in sync so drag reordering preserves column
settings. Run component-gallery, design-config/design-contract and outbound-ui
(including lead-filter-ui) for these controls and Lead Station interactions.

October 2 controls: temporary editors anchor to their own trigger, with black popup
backings and validated Black table/header/first-column background choices. Inner
panel previews contain heading and metric together; outer padding surrounds them.
Panel/table controls and lead name/date/category share desktop rows. Wake changes
run tests/admin-wake.mjs (fake recognition; no microphone) in the release gate,
plus the existing communications and both frontend/Playground hands batteries.

Admin Systems changes run tests/admin-systems-ui.mjs (also in app-regression).
Provider hover cards expose authenticated configuration, not inference verification.
Owner approvals remain gated in a dashboard dialog; conversation stays inside Logs.

October 5 audit: Table geometry lives in
the Table Edit dropdown under Panels. Outer, Inner and Table share numeric/select material controls including background, blur, saturation and X/Y padding. The fixed cell formatting toolbar follows Inner material; Table remains independent. Optional semantic columnWidths (80–800px, name/contact/stage/note) apply to preview and live Leads; resize handles support pointer dragging and arrow keys. Legacy saves remain valid.
Functional Leads status choices use aesthetics/ui/lead-stage-menu.js with the
shared Edit dropdown material/X/Y padding, trigger anchoring, top layer and keyboard
navigation. The native select remains the authenticated save source. Systems no
longer loads Owner tools; underlying SMS access stays intact. Provider hover cards
load authenticated models independently of mailbox status and show explicit errors.
Vault restores compact grouping and descriptions of at most four words. Run
component-gallery, admin-systems-ui, outbound-ui/lead-filter-ui, design-config,
design-contract, CRM suites and app-regression for these changes.

Owner lead SMS reads: owner-conversation.mjs routes common newest-lead/count and
contact-number requests without text AI; the verified owner binding still gates
entry. Lead lists use durable owner-sms-access report pages. Phone owner_control
text_owner reports fetch live lead/contact fields rather than voice-formatted
prose; generic text normalizes spoken phone digits. Requested counts are 1–20.
Preserve non-retryable send claims, fixed owner recipient and client SEND gates.
Run owner-conversation, owner-sms-access, owner-crm, communications and app-regression.

October 5 Leads edits: Contact is the stored phone column; H5 names and H6 dates
are independently styled, date below name, with no category badges. Gallery and
live cells share semantic data-col keys. Old three-column design saves remain
valid; a fourth Contact column style is optional on the server and normalized
on the client. Run tests/lead-notes-ui.mjs and tests/lead-note-persistence.mjs
(both in app-regression) for reviewed note typing/dictation, save failures,
refresh precedence and unsent Booking Link drafts. Auth changes close note
editors; dictation must pause/release Hey Maya recognition. Note edits use
lead-update by stable ID; timestamps preserve reviewed edits over older notes.

Deployment verification: run the exact tests listed in cloudbuild.yaml, including
admin-ui-contract, before declaring a release ready. app-regression alone does
not cover that separate gate. Category badges are retired; the gate asserts
Contact/H5/H6 and reviewed message actions instead. tests/verify-release.mjs
proves tests/verify-live.mjs rejects an older commit even when maya-version is
unchanged. Verify release.json and page build stamps after the owner's Push;
Vercel success does not establish Firebase/Cloud Run deployment success.

October 5 inline Leads and drawer: Latest Notes edits within its cell; Enter/blur/Save persist, Escape/Cancel discard and failed saves keep the draft. Active edits resist refresh and release the frozen first column to keep controls reachable. Dictation retains explicit microphone start and wake pause. Messages displays known names (H1) above Messages (H2), hides duplicate numbers, and uses circular Phone/Share icons. Share contains booking drafts and reviewed invoices; never send automatically. Drawer scroll regions flex above its bottom voice dock. Run lead-notes-ui, component-gallery, outbound-ui, design-config/design-contract, communications and the exact Cloud Build test list before handoff.

Messages hierarchy: keep #adm-tabtitle (H2) fixed and visible when opening contacts; #msg-name is plain H3 with a hover/focus pencil. Systems Automations opens the drawer view, not a browser tab. docs/server/text-automations.mjs stores owner-account draft rules, uses the shared CRM AI budget, and has no send/timer capability. Only explicit Messages Send submits texts. Run tests/text-automations.mjs and tests/lead-notes-ui.mjs plus communications suites. Opening suggestions must not overwrite composer drafts; ignore stale account/recipient responses.
