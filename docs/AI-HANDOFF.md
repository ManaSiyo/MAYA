# MAYA handoff — October 1, 2026

## Release status

This task began at local 9480a64, one commit ahead of origin/maya-v2 (25e8091).
9480a64 adds owner conversation/memory; 25e8091 contains compact Aesthetic Control. Production release
was not rechecked during this implementation; do not infer live deployment
from the remote branch. Owner conversation and the additional SMS access changes are local only.
No push, production preference write, real SMS or real call was performed.

## Current prepared change

The additional SMS access implementation provides THREAD/CONVERSATION/HISTORY,
INBOX, ACTIONS, FEATURES, STATUS, LEAD, MAYA HELP/COMMANDS and explicit MORE
code/page requests. "Where/what/when did you text Nick?" is a deterministic
history alias. Exact commands bypass AI; reads still work when inference/cost
limits prevent normal chat. Source-backed reports include message direction,
recipient, actor, time, delivery status/error and full stored call transcript.
Ambiguous contacts require an exact name/number. Reports are private hashed-UID
snapshots with 24-hour expiry and explicit paging; they do not mark client
messages read. Normal intent and owner phone controls can retrieve those records.

REPLY Nick: text creates a durable exact recipient/message preview. Only raw
owner SMS SEND code confirms it. The model and voice tool cannot invoke that
confirmation. It expires after 10 minutes, rechecks lead phone and STOP/block,
and claims before the provider call. Unknown results never retry automatically.
Accepted sends record carrier status and Messages; a failed history write is
reported accurately without repeating the send. ACTIONS includes these outcomes.
Global ACTIONS covers retained client communications, booking/alert results,
owner preferences, reply drafts/results and feature requests. It excludes the
owner's own report echo thread, and is not an exhaustive internal event trace.

Messages now archive overflow privately per contact/epoch before reducing the
live window to 400 entries. Archive failures preserve the live record; generation
retries do not duplicate overflow. Late delivery callbacks update archived
messages. Explicit Delete history rotates the visible epoch, preserving deletion
behavior when a contact returns. Already-discarded messages cannot be recovered.
Existing private SMS report snapshots expire separately after 24 hours.

Additional changed paths: owner-sms-access.mjs and message-archive.mjs (new),
maya-messages.mjs, owner-conversation.mjs, owner-crm.mjs, maya-phone.mjs, server.js,
Dockerfile, cloudbuild.yaml, tests/owner-sms-access.mjs and app-regression.mjs.
AGENTS.md, character, roadmap, setup and continuity files describe the scope.


Verified owner SMS is now a conversation flow instead of a lead-only parser.
It reads recent Messages history, bounded lead context and durable owner
memory/response preferences. An ordinary conversation produces a reply.
Explicit remembered facts, response style and signup SMS formatting save at
runtime. Unsupported new functionality is logged honestly in the feature
inbox. Lead changes retain the existing YES confirmation; client booking
messages retain BOOK/voice preview and confirmation.

Owner phone calls read the same memory/preferences and recent text/call history.
Only owner brief/admin calls expose owner_control; clients cannot call it.
Controls save memory/style/format, read settings, or text a requested summary
to the fixed configured owner number. The signed sender and existing enabled
Admin account binding establish identity. A UID or phone in text cannot grant
access. State uses private/owner-conversation/<hashed uid>.json with generation
preconditions and idempotency. Uncertain text/feature attempts do not repeat.
Long UTF-8 context is bounded; unavailable lead/history reads do not prevent
ordinary conversation, but unavailable memory storage fails safely.

Signup texts use the live owner template and actual lead values. The default
is the requested greeting, name/phone, and category/quoted request. Example
contacts are placeholders, never lead edits. Formatting does not resend old
alerts. SMS auto-linking of the number depends on the receiving phone app.
The existing text/call alerts and scheduler requirements remain.

Changed runtime paths: docs/server/owner-conversation.mjs (new), owner-crm.mjs,
server.js, maya-phone.mjs, lead-alerts.mjs and maya-character.md. Dockerfile
ships the new module; Cloud Build gates it with tests/owner-conversation.mjs.
Tests/maya-phone.mjs and app-regression.mjs add coverage. AGENTS.md,
MAYA-INDEPENDENCE.md, OUTBOUND-SETUP.md, requests/fixes and commit review
record the current scope and deployment requirements.

## Validation

Passed: owner-sms-access (history both ways, archived overflow, stored call
transcripts, delivery states, AI-free commands, cross-account paging isolation,
snapshots across restarts/new messages, ambiguity, exact reply confirmation,
changed recipients, STOP/block, expiry, uncertain sends, archive/storage failure
and generation-conflict preservation); owner-conversation (ordinary replies, text/voice recall, durable storage,
account binding/isolation, formatting with actual contact data, lead confirmation,
idempotency, uncertain sends, conflicts, storage failures, bounded Unicode
context and unconfirmed feature logging); owner-crm; lead-alerts;
maya-phone (57 checks); maya-messages (55); maya-transfer; maya-feedback;
crm-intelligence (19); container-contract; real local server smoke; full
app-regression in isolated headless Chromium; edited JavaScript syntax and
git diff --check. All messaging/inference checks use fake providers.
No real SMS delivery, live audio or model intent quality is proven by fixtures.

Bundled Node: /Users/fromsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.
Local dependency resolver: /private/tmp/maya-oct1-loader.mjs maps express,
Playwright and WebSockets. WebSockets use the bundled Playwright utilsBundle
through /private/tmp/maya-oct1-ws.mjs. Those temporary files are not deployment
requirements. CI installs express/ws normally. Isolated Chromium executable:
/private/tmp/maya-pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell.

## Open risks and exact next step

Do not push without Fromsa's explicit request. The verified requested work is
committed locally; owner Push from GitHub Desktop is the next release step.
After deployment, verify Cloud Build and /release.json. The existing enabled
owner binding needs no reactivation; otherwise enable text commands in Admin
once using the allowlisted owner account. Then owner-test a normal greeting,
a remembered fact and follow-up, the signup format request, and a phone call
that recalls it and texts a requested summary. Also test MAYA HELP, INBOX, THREAD
Nick, explicit MORE pages and ACTIONS from the owner phone with mobile internet
off. Use a separately authorized test client reply to verify REPLY/SEND and
actual delivery; do not test on an arbitrary client. Inspect actual carrier delivery.
Supported preferences then apply without another code deployment. Arbitrary
new tools/code still need implementation. Explicit SMS read/reply commands need no inference. Normal SMS conversation retains the combined
$1/day CRM text AI cap and current provider selection; voice uses its own meter.

Earlier live Admin Messages inspection found the owner's signup-format request
answered with the lead parser's add/update clarification. That was a routing
limitation, not evidence of missing owner authorization or an API inability to
converse. The new handler addresses it. No conversation was sent during review.

Gmail owner mailbox readiness and real Gemini inference still need owner live
verification. Chrome has not been accessed in this chat. Before any Chrome
session ask for explicit approval and verify Fromsa is idle in that window.
MAYA and Worldofsiyo profiles remain separate. Prefer the Codex browser and
non-Chrome tools. Booking/scheduler/alerts and actual call/text receipt need
owner checks after deployment; no credentials/environment changes were made.

## Standing constraints

Keep account/project data sealed. Never touch credentials, billing, production
variables or legacy migration/Storage cleanup paths. See root AGENTS.md for
served layout and checks. docs/design.md remains the sole visual specification;
Aesthetic Control and its compact typography work remain in 25e8091.
The approved booking URL remains https://wix.to/wT2lSqE.
