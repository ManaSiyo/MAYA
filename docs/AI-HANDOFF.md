# Current handoff — October 6, 2026

## Latest request and deployment state

Fromsa requested a messaging/MAYA/CSS robustness audit, responsive phone/iPad/
desktop checks, shared aesthetics everywhere, and provider verification. Outbound,
Playground and Affiliates functionality is excluded; shared style regression gates
still run. Fresh personal MAYA Chrome approval was requested and remains pending.
No Chrome profile was accessed. No push, live send, credentials, production env
or billing changes occurred.

Public verify-live found production e82b2072dd7b203acbc870a6de0863a19559ad8b,
while origin/maya-v2 is 71c9ce9939e4f64ffa3f0e4c244a542fe67456c3. Both carry
14.40, so version equality does NOT establish a deployment. Investigate Cloud
Build before declaring the earlier event/latency shipment live.

## Local audit fixes

- backend/status.html: common known-name resolution for inbox/conversation;
  reject phone strings/Caller placeholders, preserve newer drafts during send,
  guard list/thread responses by auth and request sequence, preserve unchanged
  transcript DOM/open state, load earlier archived history in 100-message pages.
  Hidden drawer/background polling no longer reads/marks a conversation read.
- docs/server/maya-messages.mjs: durable account/request-bound send claims before
  provider calls, replay receipts, no automatic retry after uncertain outcomes,
  explicit 1,600-character rejection instead of truncating reviewed drafts.
  Read acknowledgements preserve concurrent arrivals. History pagination never
  marks read. Signed owner reply callbacks bind the real SMS SID and status.
- docs/server/owner-conversation.mjs and server.js: optional conversational
  context budget 800ms; browser voice/remember/forget share account-bound owner
  memory with SMS/phone. Legacy memory is preserved, now fails closed on invalid/
  unavailable reads and uses generation preconditions for writes. No automatic
  migration of the legacy global notebook into individual owner accounts.
- Shared typography runtime v20: messages/composer P1, timestamps P4, Share menu
  follows saved popup material/XY padding, expanded transcripts use Inner panel
  material instead of an enormous pill. Low-specificity composer selector keeps
  table formatting authoritative. All served references bumped, usage regenerated.
  Composer/name/transcript flex bounds and long-text wrapping repaired.

## Validation

All 35 Cloud Build gates passed during this audit, with final affected tests rerun
following the last changes. Full app-regression and local server smoke passed.
Gallery: eleven widths/all popup and field bounds, save/reload. Messages: nine
widths (320–1920), names, archive loading, preserved transcripts, saved typography,
Share material, composer overflow; screenshot reviewed. Communications suites use
fake providers; memory/read/send/session races have new behavioral fixtures in
message-races.mjs. Owner forget remains account isolated. See COMMIT-REVIEW.txt.

Official OpenAI latency guidance supports removing optional blocking work. Keep
current configured model choices; no unsupported model rename or premium tier
was introduced. Actual carrier/voice p50/p95 and authenticated Gmail/Gemini
inference have NOT been measured in this audit. Fabric, AI routing and CRM
connection failure fixtures passed; these do not establish live provider health.

## Open risks / exact next step

1. Owner Push only when ready; investigate why 71c9ce9 is absent from production.
   Verify exact release.json commit and both deployed pages after Cloud Build.
2. Approve a fresh MAYA Chrome session to inspect authenticated connection state,
   deployment history and actual saved styling; never infer live health from mocks.
3. Prior immediate Wix/Tasks/Gmail/Scheduler setup remains owner-controlled. Follow
   EVENT-TRIGGERS.md. Missing setup cannot be solved by a model upgrade.
4. Real owner SMS reply/delivery callback and owner phone/browser memory checks
   after deployment. Historical synthetic SMS IDs cannot be retroactively recovered
   without carrier records. A callback arriving after its synthetic reply archived
   still needs archive SID reconciliation; current binding covers live records.
5. Send ledger fails closed at 10,000 requests, with no unsafe claim eviction.
   Add archival before this capacity is reached. Older cached send clients must
   reload once: send request IDs are now required. Uncertain sends stay nonretryable;
   never blindly retry or certify delivery without carrier evidence.
6. Legacy global memory remains for existing MCP compatibility. Review a scoped
   migration with Fromsa before deleting it; old facts are not implicitly copied
   into every owner's private memory. No data was flushed or deleted.

## Standing constraints

No automatic pushes. Local verified commits authorized. Sealed accounts/projects,
raw SMS SEND approvals, STOP/block gates, archives and migration paths preserved.
Only Fromsa handles credentials, billing and production environment configuration.
