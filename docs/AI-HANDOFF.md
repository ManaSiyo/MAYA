# Current handoff — October 17, 2026

## Current release state

The latest completed release is **7015b99**, including the voice pointer repairs,
CI diagnostics and fabric asset-cache follow-up. Exact Firebase release/page
stamps and the Cloud Run API commit were verified before this phase began.
The prior deployment-blocked observations in fixes.txt are historical.

This manifest records the deeper October 17 save/fabric repair before publication
on maya-v2. All 65 Node commands in Cloud Build's Test release contracts step have
passed locally, including the new Prompt/fabric/storage fixtures. Integrated
app-regression and server smoke also pass. Four obsolete literal expectations were
updated to their stronger account-bound equivalents without dropping behavioral
checks. Standalone authority is repeated last before commit. No production success is inferred from local checks. The deployed state must
be verified against this checkout's exact Git commit, release.json, App/Admin build
stamps and Cloud Run health; a green Vercel preview is insufficient.

## Request and release authority

Fromsa explicitly requested implementation of the latest audit findings, with
Brief/Operation Room fabric relevance first, voice responsiveness across web and
phone, Outbound secondary, a documented commit and automatic GitHub Push.
The follow-up asks for a deeper parallel audit, stronger/faster saves throughout
the app and shorter backend help. This phase started from clean 7015b99, matching
origin. No credentials, billing, production environment changes or personal Chrome
access are included. The requested private fur/green-pants demonstration has not
run; it requires fresh explicit permission for that Chrome access session.

## Current deeper audit implementation

Client/Playground project saves coalesce already-covered queued requests: seven
calls produce two commits in the deferred fixture, without acknowledging another
project/account. Opening another project flushes edits made while its target was
loading; New cancels earlier opens and respects a failed flush. Save/rename report
only acknowledged work, preserve newer edits and failed drafts, and suppress stale
account feedback. Delete pins account/board identity through its reads and late
acknowledgement. UTF-8 size checks retain oversized transcripts instead of silently
dropping them. Dirty or pending work warns before navigation even when online;
completed saves clear the pending timer. Browser/mobile termination remains
best-effort, not guaranteed persistence or a new offline store.

Fabric requests send bounded garment metadata, not embedded piece renders/patterns:
the integrated fixture is 6,012 bytes instead of more than 5.6 MB. The server reads
canonical saved garments/crops itself. Inventory loads independently of reference
photo/book/search work, so a failed dependency cannot hide available In House
photos. Reads cancel on scope changes; project lookbook hydration survives a
garment switch, and Operations prepares its actual selected piece and piece list.
This fixes an initially hidden saved selection and a delayed first read discarded
by the picker before Start could consume the saved material.

Save/Use/Remove share one serial queue per account/submission. An explicit Save A
keeps garment A when the user moves to garment B. Generation preconditions protect
concurrent windows; same-account renewal preserves queued work. A real project or
account change cancels unsent actions and ignores old acknowledgements. Writes have
a 15-second deadline; uncertain failure reloads the book for reconciliation, never
automatically resends the action. Favorites remain retryable after errors. Private
selectedByGarment assignments and stored-only selectedGarmentFingerprints prevent
one garment's material from being consumed by another or a changed saved garment.
Legacy ambiguous selections fail closed without read-time migration writes. New
seller listings are verified again before first Save/Use; stored URLs can be reused
for another explicitly chosen garment. Structured preferences preserve exclusions.

Fresh dissections receive UUID garment IDs; legacy saved indices remain compatible
on read. Brief rejects payloads above 25 MiB by UTF-8 byte size and retains the
generated draft for retry, including patterns; it no longer removes patterns and
claims a complete save. Removed 589 unreachable lines of the superseded Brief
sourcing implementation while keeping the shared viewer, CSS, local-folder support
and legacy migrations.

Brief full-document saves now require the reviewed Storage generation. Two tabs
cannot both replace the same revision: one gets a conflict and retains its draft.
Generation lineage follows the raw dissection, advances only on acknowledged writes
and never silently rebases a retained draft after reopening. Failed/corrupt reads
fail closed, unknown acknowledgements stay unsaved, and Operations receives the
exact acknowledged payload. Mutable submission JSON uses private,no-store and
X-Maya-Generation; the old file-size cache key no longer masks same-size edits.
The client and server agree on the 25 MiB UTF-8 data limit. Older open clients
must reload before saving; they receive 428 rather than a blind overwrite.

Admin Prompt Engine binds Firebase reads/writes/fallback drafts to the current
Google account/session, starts independent live/private reads together, preserves
typing and later edits, restores the newer acknowledged document, and serializes
Save. Save before initial loading finishes requires review rather than blindly
replacing untouched fields. Failed reads/writes retain editable words and truthful
status. Outbound revisions prevent a pre-save background read from overwriting an
acknowledged edit; overlapping refreshes coalesce into one catch-up read.

Operations now keeps failed Logic Save/Reset/Test lock drafts and reports failure;
scoped account keys preserve legacy objects without inheriting unknown-owner shapes.
Unsafe/unreadable inputs stop generation before embeddings/classification. Failed
measurement writes keep the actual visible values in account/submission/garment
memory instead of silently using older dimensions. Saved garment identity includes
piece ID and image: identical images no longer share dimensions. Previous image-only
session keys are retained; saved IDs require re-entry under the new key. Logic drafts
survive incidental render/token renewal; explicit garment/account navigation
invalidates them. Unsaved measurements remain page-local, not durable cloud data.

The owner explicitly requested no aesthetic changes. Actual style probes found a
pre-existing Operations authority gap: Logic remains Jost/400 with 12×10 padding,
measurement fields 14×8 and translucent local backings; saved Editor material and
full P1/P3 font/weight do not govern these fields/warnings. Adding shared annotations
would change their defaults, so this phase preserves them. Caption size, pills and
drawer materials still respond and six-width error tests record both behavior and
the limitation. Do not claim full field authority or complete aesthetic reconciliation.

Thirty selected backend helper passages were shortened from 597 to 486 words
(18.6%); the stale four-minute deployment promise was also removed. This measures
those passages, not every backend string. The edits reuse the existing aesthetic
system: no CSS, role, material or layout authority changes and no new components.
The existing shared presentation settings and final authority gate still apply.

## Previously shipped behavior retained

Fabrics: Brief and Operation Room use the same inline viewer, optional expansion,
Sourceable/In House/Favorites and store filter. Search requires acknowledged saved
dissection; reading never generates missing pieces. Stable garment IDs distinguish
duplicate names and preserve selection when returning from Operations. A legacy
saved piece uses its original index as a read-only identity until explicit Save.
The selected canonical saved crop is the visual ranking target; original photo
and client words remain discovery context. Hard exclusions/latest replacements
are independent of positive traits. Finished clothing, tools/notions, swatches
and unrelated materials are rejected. Seller-backed URLs/images/facts remain
separate from visual interpretation. Missing images no longer become invented
URLs, and valid later JSON-LD/metadata images are tried. At most eight verified products
enter one 8-second fabric.visual_rank attempt; weak/failed comparison returns no
recommendations with an explicit warning. Image/CDN failures can still prevent
comparison; no automatic paid retry or quality/ChatGPT-equivalence claim.

Brief/Operations: usable inline result height, responsive standalone heading,
submission-only Brief loading, saved-only bridge, no stale garment repost during
navigation, and private summary/reference/Operations prompt clearing. A broken
favorite photo retains Remove/Use controls. Existing grounded pattern generation
and purchase scope are unchanged.

Admin/aesthetics: explicit typography beats generic inference without coupling
table styles; phone Feature Requests put owner/date above request; hidden settings
failure forms stay hidden; saved dock inset changes actual geometry. Automations
Example/Save completion orders preserve drafts and disclose later unsaved changes.
Active linked workspace previews expose shared roles, Inner/Outer/fields/pills,
semantic nonFabric color and label/field/dock spacing. All changed presentation
uses saved Aesthetic Control settings, including new keyboard Glass/P3 recovery
buttons on Admin, client and Playground. Admin recovery lives outside transformed
horizontal panes so the drawer cannot scroll it offscreen. Recovery presses do
not dismiss or move any of the three surfaces' open drawers.

Voice: shared bounded silent standby, only for enabled wake/visible authorized
scope; no microphone track or response until wake/tap. Both channel and server
session acknowledgment establish readiness. Activation requests microphone access
immediately and sends fresh page context before attaching it. No timer-driven
paid reconnection. Standby expires after 120s; the next interaction may prepare
again. Setup 20s, active idle 120s and maximum 15min cleanup; off/hidden/page-exit or
account/project changes release resources. Same-account token renewal preserves
session. Blocked autoplay exposes Tap to hear Maya. Disconnect/idle invalidates
queued tools and pending approval creation; already reviewed approvals survive.
Shared server/phone delivery keeps the configured voice, defaults to Marin,
concise natural replies, 1.05 speed, 300ms VAD and 250ms prefix. Optional context is
bounded to 400ms; token mint has one total 10s deadline including compatibility
retry. Auth/spend-ledger persistence remains outside these budgets. This is not a
measured production latency SLA or proof of sharper live audio.

Messages: STOP/block is checked inside durable claim and before dispatch;
uncertain sends remain non-retryable. Archived inbound identities deduplicate
before consent/unread/chronology. Archived owner-reply aliases reconcile carrier
states monotonically. Explicit-country-code SMS matches Admin; calls remain
US-only. Content-free inbound receipts survive explicit history deletion and fail
closed at 10000 without eviction; STOP still persists at capacity. Legacy deleted/
blocked events predating these receipts cannot be reconstructed. The unchanged
strict diagnostic now passes 44/44 and is a mandatory release gate.

Accounts/Outbound: unpublish pins UID and generation through every awaited delete
and fallback query, including A→B→A. Same-account token renewal preserves Outbound
drafts and request identity; actual account changes clear private state.

## Current source, evidence and test gaps

Changed runtime paths: frontend/index.html, playground/index.html;
backend/{backend,operations,status,outbound}.html and backend/outbound.js;
aesthetics/ui/fabric-assistant.js; docs/server/{fabric-search.mjs,fabric-sourcing.js}.
Tests include project-lifecycle, brief-operation-races, fabric-search/sourcing,
crm-failure-ui and new admin-prompt-saves/fabric-workflow-ui. Both new suites are
wired into the exact Cloud Build list and app-regression; existing gates remain.

Small synthetic images previously missed multi-megabyte piece serialization.
Immediate acknowledgements and isolated Save checks missed edits during target
loading, older reads after Save, queued same-submission garment changes and an
initial lookbook read invalidated by picker movement. A global selected URL also
failed to express garment identity. New fixtures defer real served-function/API
responses and check the actual request payload, storage outcome, retry and UI
acknowledgement, not only the presence of guards in source. Scripted providers
still do not measure retailer relevance or real model comprehension.

Pinned root npm ci completed with the checked-in lockfile. Focused client
project-lifecycle/account-race checks, both frontend/Playground hands batteries,
syntax and diff checks passed during this phase. Prompt coverage contains 16
deferred read/save/account scenarios. All 65 current Cloud Build test commands,
full integrated app-regression (636 named checks plus other imported suite assertions)
and real-server smoke pass. Current communications include the strict 44/44
transport diagnostic. Shared authority passed in both gate paths and is repeated
standalone last before commit. Source-usage positions were regenerated; role counts
and markup categories are unchanged. All 32 executable inline scripts parse, and
all six changed pages retain byte-identical style blocks. No inline style was added
or altered; two retired template declarations disappeared with the dead code.
No actual SMS, paid model calls, private client images or personal Chrome were used.
The documented legacy Operations field-authority gap remains outside the owner's
no-aesthetic-change scope; passing existing checks does not claim it is fixed.

The implementation uses abortable requests and visibility-aware lifecycle work;
hidden-page timers can be throttled, so exit warnings and background saves are
best-effort. Storage generation preconditions reject conflicting writes rather
than allowing stale replacements. Primary references checked for this review:
[MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController),
[MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API),
[Cloud Storage request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).
An aborted client wait is not proof that a server write was rolled back; reconcile
uncertain outcomes before a reviewed retry.

## Limits and exact next step

FOUNDER-CONVERSATION-AUDIT.md preserves the 60-intent synthetic corpus and historical
findings. Seven parser misses, 22 missing SMS capabilities, channel/history parity,
real model comprehension and owner binding remain separate open work. These
repairs do not make MAYA omniscient. CDN availability can still fail visual
comparison honestly. Receipt capacity needs an owner-approved archival design
before any future relaxation; never evict accepted IDs to make a test pass.

Next: repeat standalone Aesthetic Control authority last, inspect the changed
surface results, commit only the requested files using COMMIT-REVIEW.txt and Push
maya-v2 under the existing explicit authorization. Verify the new exact code commit through verify-live,
release.json, App/Admin stamps, API health and changed asset bytes/cache policy.
Do not add a shipped history milestone until that verification succeeds.

The real private fur/green-pants workflow is still **not run**; obtain fresh
specific Chrome permission before accessing either owner profile. Public release
checks and fixtures cannot establish private data behavior, signed-in Realtime
bootstrap, live fabric quality or carrier/audio delivery. Owner acceptance still
includes the ten FABRIC-SEARCH cases, warm/cold wake timings and a small SMS/phone
round trip using the existing owner binding.
