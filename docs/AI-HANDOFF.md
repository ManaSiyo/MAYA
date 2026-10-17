# Current handoff — October 17, 2026

## Deployment follow-up

Commits 62ca204 (application repairs) and 384e327 (CI diagnostics) reached GitHub
through Desktop's existing authenticated session; the CLI cannot obtain GitHub
authentication. The first Cloud Build 8e22c3a7 failed release testing before any
deployment; its bounded log hid the error. The next build 2081fcda exposed an exact
Messages-heading assertion: x1258 before contact open, x1250 afterward, unchanged
width. A throttled real-page probe reproduced a baseline captured before the
native horizontal drawer animation finished. The 350ms test delay was invalid;
no runtime heading/style change was justified.

The fixture now waits for the actual scroll destination and keeps the original
exact heading equality assertion. It also exercises long inbox/transcript content
with forced 16px classic scrollbars at six widths and default/changed valid styles.
Every Node CI gate keeps a temporary full log, reports a compact success and
preserves the original failing exit plus error lines and tail. Shell dollars are
escaped for Cloud Build substitution. Behavioral probes verify success, exit 7
and an earlier surface failure hidden by later passing output. No visible UI is
added by this follow-up, and no release gate is skipped or weakened.

The corrected Messages UI, release-contract behavior and full integrated
app-regression pass locally. Final standalone shared Aesthetic Control authority
is the last check before commit. Commit the prepared follow-up and Push under
the existing authorization. Verify its exact commit on Firebase and Cloud Run;
the last public observation during the failed builds was 707592d. Vercel green
and successful GitHub Push are not deployment proof. Existing owner/provider
acceptance limitations below remain.

## Request and release authority

Fromsa explicitly requested implementation of the latest audit findings, with
Brief/Operation Room fabric relevance first, voice responsiveness across web and
phone, Outbound secondary, a documented commit and automatic GitHub Push.
Started on maya-v2 at 1b3f0df, matching origin. Included the interrupted October 8
workspace/fabric/automation changes already in this checkout. No unrelated files,
credentials, billing, production environment changes or personal Chrome access.

## Implemented behavior

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
URLs, and valid later JSON-LD/metadata images are tried. At most8 verified products
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
horizontal panes so the drawer cannot scroll it offscreen.

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

## Source and verification

Primary changed paths: backend/{status,backend,operations}.html, backend/outbound.js;
frontend/index.html, playground/index.html; shared fabric/presentation/typography/
voice runtime and gallery previews; server fabric-search/fabric-sourcing/ai-router,
realtime-voice/server/maya-phone, Messages/archive, automation/design validation;
Docker packaging, cloudbuild, generated role inventory, associated tests and docs.

Release gates include all new workspace/Brief/Admin/voice/account/stress fixtures.
app-regression adds behavior assertions and final aesthetic-authority re-executes
actual changed-surface UI checks even if imported earlier. Disabled/enabled Brief
Fabrics material fixtures use a real synthetic saved dissection; styling is not
weakened to fit obsolete fixtures. Admin account-race coverage verifies immediate
microphone capture is stopped and never attached after cancellation.

Validation: pinned root npm ci completed with the checked-in lockfile. The 55
functional Cloud Build suites plus server smoke passed after focused fixture/
regression repairs; full integrated app-regression passes, including the gallery,
both actual client surfaces, Admin, Brief/Operations and the founder corpus. Both
frontend/Playground hands batteries passed. Messages stress is 44/44 across 1293
signed inbounds, 242 callbacks and 84 Admin requests. Six exact Cloud Build syntax
checks, shared runtime syntax and git diff checks pass. Role inventory regenerated.
Default/changed saved settings, actual Save/failure/Restore, focus/errors and six
responsive widths are covered. Phone/desktop and saved-style screenshots were
visually inspected. Final standalone Aesthetic Control authority is the last check
before commit; its successful result is required by COMMIT-REVIEW. Isolated
browsers/fake auth, storage, merchants, OpenAI and Twilio are used; no actual SMS,
paid model calls, private client images or personal Chrome.

## Limits and exact next step

FOUNDER-CONVERSATION-AUDIT.md preserves the 60-intent synthetic corpus and historical
findings. Seven parser misses, 22 missing SMS capabilities, channel/history parity,
real model comprehension and owner binding remain separate open work. These
repairs do not make MAYA omniscient. CDN availability can still fail visual
comparison honestly. Receipt capacity needs an owner-approved archival design
before any future relaxation; never evict accepted IDs to make a test pass.

After successful gates, commit only this task with the prepared summary/body in
COMMIT-REVIEW.txt, then Push maya-v2 as explicitly authorized. Verify the exact
code commit via tests/verify-live.mjs, release.json, App/Admin maya-build stamps
and API health; GitHub/Vercel success alone is insufficient. Public checks cannot
prove signed-in Realtime bootstrap, live fabric quality or carrier/audio delivery.
Finish with owner acceptance of the ten FABRIC-SEARCH cases, real warm/cold wake
timings and a small SMS/phone round trip using the existing owner binding.
