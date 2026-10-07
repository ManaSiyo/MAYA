# Current handoff — October 6, 2026

## Latest request and deployment state

Fromsa needs immediate callback alerts, inbound email events, faster voice/text,
verified model choices and responsive CSS for tonight's demo. The latest pushed
release e82b207 was verified live before these edits. The work below is local,
verified and prepared for owner Push. Never push automatically.

## Changes

- `docs/server/event-triggers.mjs`: RS256/site-installation/form-scoped Wix
  ingress, durable named Cloud Tasks before acknowledgement, authenticated
  submission-specific callback worker. Added Docker packaging/release tests.
- `lead-alerts.mjs`: ring and SMS dispatch independently; bounded preference
  formatting; preserve separate generation claims/uncertain outcomes. Persist
  dispatch, submission-age and provider timings. Admin warns when immediate
  event setup is absent.
- `crm-gmail.mjs`, `crm-intelligence.mjs`, `outbound.mjs`, `server.js`:
  owner-only Gmail INBOX watch registration, private revalidated mailbox
  bindings, authenticated Pub/Sub updates and mailbox-only history sync. Watch
  renewal through periodic sync; preserve history cursor, account scope,
  leases/replays and hourly scheduler clock. No new automatic client sends.
- `server.js`: raw contact/form reads bypass optional 20-model summary batch,
  use ten-second cache and invalidate on callback; exact event fetch avoids
  whole-feed scans. Optional Admin voice context cannot block startup beyond
  1,200 ms and explicitly reports unavailable facts.
- `maya-phone.mjs`: owner context starts during socket handshake, bounded
  1,200 ms; end-of-speech default 300 ms vs 420 ms. Separate startup/first-audio
  timings. These are not measured total response latencies.
- Shared typography runtime v19 fixes icon-marked form labels collapsing Color
  and Alignment controls. Responsive editor columns remain readable with large
  saved popup padding. All served cache references updated; gallery CSS v31.
  No saved aesthetic settings or images changed.

## Validation

All 35 Cloud Build test commands passed; full app-regression reached its final
`all passed`; real local server smoke passed, including newly mounted event
route negative/auth tests. Final callback/voice-context fixtures rerun after
last warning changes. Gallery: eleven widths, every role/menu/field bounds and
readability, Save/reload, screenshot reviewed. Outbound and populated lead menus:
seven widths, scrolling/keyboard/reorder. Lead note editor: four widths.
Communications: phone 59, messages 55, transfer, feedback, owner SMS/conversation;
CRM intelligence/UI/failure, both hands batteries, design/container/release
checks passed. New fixtures cover signed event scope, durable enqueue replay,
retry on incomplete sync, isolated mailbox watches and AI-free lead cache.

All provider tests are fake and Chromium is isolated. No personal Chrome access,
live calls/SMS, production env/credentials/billing changes or push occurred.
No actual OpenAI p50/p95 response time or carrier ringing time was measured.
Official model docs support keeping GPT-6 Luna plus Realtime 2.1 Mini; “GPT-6 Sol
Light” was not verified. Images remain unchanged. See EVENT-TRIGGERS.md.

## Exact next step / open risks

1. Owner Push, wait for Cloud Build and verify exact release.json with
   `node tests/verify-live.mjs --wait` against the new commit.
2. Owner configures Wix webhook public key/installed instance, Cloud Tasks queue,
   worker identity/IAM and Gmail Pub/Sub/watch. Exact runbook:
   [EVENT-TRIGGERS.md](EVENT-TRIGGERS.md). AGENTS reserves credentials and
   production environment changes for Fromsa. Code alone cannot activate events.
3. Keep dedicated two-minute callback Scheduler reconciliation and hourly
   Outbound reconciliation/renewal. Prior audit enabled Scheduler API but found
   zero jobs; do not assume one exists now. Polling alone misses the latency goal.
4. With Admin closed, submit an owner-approved callback and verify actual SMS,
   ringing/voice, webhook/task status and ledger timings. Verify a real inbound
   email sync and owner voice exchange. Never test sends on a client without
   review. Configuration/provider acceptance is not delivery confirmation.
5. Wix 1,250 ms acknowledgement includes cold-start/token overhead. Queue HTTP
   budget is 1,000 ms; signed retry/task dedup preserves durability. Measure
   before considering owner-controlled paid minimum instances. Provider outages,
   expired Gmail watches without periodic sync and unknown carrier outcomes
   remain operational risks. Tonight's live demo is not certified until step 4.

## Standing constraints

No automatic pushes; local verified commits authorized. Fresh approval for each
personal Chrome session, separate MAYA/Worldofsiyo sign-ins. Preserve sealed
projects/accounts, raw owner SEND confirmations, STOP/block gates, private
archives, generation claims and migration/cleanup paths. docs/design.md is the
active visual specification. Latest Notes remains inline Save/Cancel only;
outside click discards without saving or dictation controls.
