# Current handoff — October 7, 2026

## Current request — Aesthetic Control enforcement (October 7)

Fromsa asked why Automations bypasses Aesthetic Control, requested removal of
conflicts and a mandatory internal final aesthetic check. Repaired locally:
- backend/status.html: explicit H2/H3/P1/P3 Automations roles; shared field and
  Inner material; removed duplicated form styling and forced blue drawer headings.
- typography-controls.js v22: explicit role/field/inner contracts; all heading
  colors follow saved roles. Semantic status colors and table settings retained.
- maya-canon.css v14: legacy fixed field font yields to explicit roles. Active
  adapters remain necessary; no migration paths or served files were deleted.
- tests/aesthetic-authority.mjs: computed-style mutation checks typography,
  field backing/border/radius/X-Y padding, Inner material and six viewport widths.
  Required in app-regression and Cloud Build. Role inventory regenerated; runtime
  and adapter cache versions updated on served pages. Retired the obsolete
  v13.77 assertion requiring fixed blue headings. AGENTS.md/design.md define
  the last aesthetic completion check and require extending coverage for new UI.

Validation: 45 Cloud Build test suites passed; isolated Automations screenshot
reviewed. Full app regression, smoke, required syntax and diff checks passed.
No personal Chrome access, production changes or push. Exact next step: owner
Push, then verify the exact release with tests/verify-live.mjs --wait and confirm
saved settings on authenticated live Admin. Local verification is not deployment.
Previous audit/open provider and migration risks below remain applicable.

## Previous request

Fromsa first requested a parallel read-only audit, grouped by area and prioritizing
Admin, then explicitly asked to wait for the other agent and implement the fixes.
Wait completed: Backend and fabrics — Fabrics and design finished at deb7081;
implementation began from its clean tree, preserving c09328e and deb7081.
No push, production configuration, credentials, billing, live provider call or
personal Chrome access occurred.

## Prepared locally, by area

- **Admin (backend/status.html):** async requests and approvals bind to account/
  session and stable lead IDs. Same-account token renewal preserves drafts,
  pending send IDs and notes; actual account changes clear private state and
  cancel stale voice/results. Remove persisted customer-data marketing cache.
  Invoices retain created links when lead attachment fails, offer save-only
  retry, survive dialog reopen and insert internal unsent Text drafts. Missing
  phone feedback is visible. tests/admin-state-races.mjs covers interleavings.
- **Backend storage/communications:** docs/server/lead-store.mjs shares validated,
  generation-checked lead/note writes across Admin, phone and owner commands;
  unreadable storage fails instead of becoming an empty overwrite. Admin lead-add
  retries retain account-bound receipts, phone updates return the complete lead,
  and owner notes carry timestamps. Submission uploads deny unknown ownership;
  feeds finish pagination before limiting. Blocked STOP persists consent and
  archived delivery statuses survive overflow retries. New lead-store/admin-storage
  fixtures and existing communications suites cover these paths.
- **Outbound:** reviewed sends include expectedEmail in the confirmation/request
  fingerprint and revalidate the current recipient at the durable claim. A changed
  address requires fresh review. Missing Sheet history/baselines no longer
  double-count locally recorded sends. Four primary lists remain unchanged.
- **Client projects (frontend + Playground):** account generation and UID pin async
  reads/writes, migrations and share publication. Initial saves/queued edits retain
  dirty work; pending uploads cannot replace newer pictures/summary. Shares own
  independent image copies. Project-face copies for avatar lifetime remain
  Playground-only. tests/project-lifecycle.mjs executes these races.
- **Brief / Operation Room:** queued immutable dissection saves require server
  acknowledgement, preserve generated work on failure and offer save-only retry.
  Opening saved work does not trigger paid missing-image generation. Operations
  measurements bind to account/submission/exact garment, run inputs freeze, and
  startup, CLO, redraw, scoring, SVG and streaming reject stale contexts. The new
  fabric assistant/lookbooks from deb7081 are preserved. tests/brief-operation-races.mjs
  covers save/context and run interleavings. Local folder reads cannot adopt old
  cloud pieces; same-submission reloads retain pending work and generated patterns
  save on their original raw pieces. Invalid folders preserve the prior save target.
- **Aesthetic Control:** snapshot before async Save; lock preview editing until
  acknowledgement; keep the prior Restore baseline after failure. Runtime v21 /
  gallery v32 preserve the approved visual canon. Correct active documentation
  conflicts about category badges, H5/H6/H3, note blur/dictation and Inner toolbar
  material. Regenerate the authored typography usage inventory after final code.
- **Release:** pinned root/server lockfiles and mandatory Chromium/communications
  dependency installation. No release gate may be silently skipped. Docker bakes
  the commit without production environment changes; public health reports it.
  verify-live requires the site and API to match HEAD; old-API rejection is tested.
  New gates run in cloudbuild.yaml and app-regression.

## Validation

All 44 suites listed in cloudbuild.yaml pass, plus full app-regression and server
smoke (46 suite invocations), required syntax checks and git diff --check. The
final Outbound UI fixture was rerun after replacing an unauthenticated/stubbed
status setup with a fake authenticated session and the real refresh path; it
passes populated filtering, saved statuses and seven viewport widths. Gallery
covers eleven widths and immutable Save, Admin races cover identity/drafts/
approvals, project lifecycle covers delayed cloud writes, and Brief/Operations
cover local transitions and stale paid-work continuations. The authored typography
inventory was regenerated. Local Node 24.19.0 with pinned installed dependencies,
isolated headless Chromium and fake providers only; no personal Chrome or live
sends. Actual Cloud Build/Node 20 deployment remains an owner Push step.

## Live evidence / exact next step

Public read-only checks on October 7 at 08:49 Pacific: release.json, Admin
and API health returned HTTP 200. Hosting still reported
`e82b2072dd7b203acbc870a6de0863a19559ad8b`, published October 7 00:44:24 UTC;
the old API health response had no commit field. Availability does not prove the
pending local code is live. The Google Cloud Build check for pushed 71c9ce9 failed
at Test release contracts before deployment; available evidence did not identify
its exact failing assertion. Vercel success is not Firebase/Cloud Run success.

1. Owner reviews the prepared local commit and Pushes when ready. c09328e and
   deb7081 were already local and unpushed when implementation began. Never push
   automatically. After deployment run `node tests/verify-live.mjs --wait` for
   the exact pushed HEAD, including its API commit.
2. Verify authenticated Admin renewal/account changes, a reviewed invoice link,
   design Save, and fabric search/lookbook round trip. Real provider acceptance,
   delivery, voice and live AI relevance/latency still need owner verification.
   Use FABRIC-SEARCH.md for the ten owner-approved comparison cases; no claim of
   ChatGPT parity or production-ready pattern fit/sewability/laser output.
3. Avatar behavior remains in Playground until Fromsa approves promotion. Existing
   already-broken avatar references are not repaired by the forward-looking fix.
   Legacy migration/Storage cleanup remains; no data migration was run.
4. Admin invoice recovery is retained in the page session. An unknown provider
   creation outcome requires checking Wix before creating another link; this is
   not an exactly-once invoice ledger. Admin lead-add receipts fail closed at
   10,000 entries and need a future archival path. Lead history is preserved
   rather than silently dropping old records; monitor its eventual object size.
5. Existing event/Tasks/Gmail/Scheduler setup remains owner-only. Prior open work:
   archived synthetic owner reply SID reconciliation, 10,000-send ledger archival
   and scoped legacy memory migration. Amazon remains web discovery; blocked
   merchants show unknown facts and Britex store-only inventory is unavailable.

## Standing boundaries

Only Fromsa handles production credentials, billing and environment settings.
Fresh explicit permission is required for each personal Chrome session; none was
used. Private accounts/projects, explicit SMS SEND gates, STOP/block rules,
archives and legacy migration paths remain intact. Local verified commits are
authorized; pushes are not. docs/COMMIT-REVIEW.txt describes the new commit.
