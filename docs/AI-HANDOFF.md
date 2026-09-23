# MAYA shared handoff

The one live file Claude and Codex both read first and both update last.
It is the current state of the work, never a history log. Replace stale
lines instead of appending. The narrative belongs in `history.txt`, the
incidents in `fixes.txt`, Fromsa's asks in `requests.txt`.

Whoever finishes a piece of work updates this file in the SAME commit.
If this file disagrees with chat memory, this file is right.

## The rules, in one place

1. One repository, one branch: `ManaSiyo/MAYA`, branch `maya-v2`, working
   folder `~/Desktop/MAYA-new`. No agent creates a second clone, ever. The
   duplicate clone of August 14 is what broke two days of pushes.
2. One agent at a time in `index.html`. Fetch and pull before starting.
   Read this file before starting. Update this file before stopping.
3. Commits are labelled: `[Claude][v13.xx] Description` or
   `[Codex][v13.xx] Description`. One category per commit.
4. Fromsa presses Push. Neither agent has his credentials, and neither
   agent touches a password, a key or a token, ever. Credential work is
   written up as numbered steps WITH clickable links, in `fixes.txt`.
5. Every shipped version bumps `<meta name="maya-version">` in BOTH
   `index.html` and `status.html`. They must match; the regression suite
   fails if they drift, and a mismatch means the Systems Map never signs
   people out after a deploy.
6. Every completed request in `requests.txt` earns an assertion in
   `tests/app-regression.mjs`. That is the whole anti-regression system.
7. Anything Fromsa reads on screen: no em dashes, no en dashes.

## If you are auditing this, start here

1. `AGENTS.md` for the layout and the rules. The folder changed on Aug 21:
   `frontend/index.html`, `backend/*.html`, `aesthetics/` at the root,
   everything else in `docs/`.
2. `docs/firebase.json` is the hosting map. Every old address is rewritten
   onto its new file, and the catch-all serves `frontend/index.html`. If a
   page 404s, this file is the first thing to read.
3. `tests/app-regression.mjs` is the browser and source contract. It runs only where
   there is Chromium and a free socket: `node tests/app-regression.mjs` from
   the repo root. `tests/smoke.mjs` covers the server. `/verify.html` is the
   only check Fromsa can run himself, because his Mac has no Node.
4. `docs/server/server.js` is the whole API. Look for: the submission store in
   MAYA's own bucket, the credit meter (`/api/admin/spend`, `/api/admin/credit`),
   marketing (`/api/admin/marketing`), Pinterest OAuth, `/api/fetchpic` with
   its SSRF guard, the per-user rate limiter, and since v14.02 `POST /mcp`
   (MAYA's door, `maya-mcp.mjs`) plus `maya-character.md` (who she is).
5. Known open risks: no client side error reporting; the rate
   limiter is per Cloud Run instance and resets on restart; community
   provenance is app level only; submissions filed before Aug 17 may still be
   in the old Drive folder; Realtime availability still depends on the OpenAI
   account; no Gmail read integration exists.

## The playground rule, August 21

`playground/index.html` (served at /playground.html, linked from the MAYA door
on Admin on hover) is Fromsa's private staging copy. Experimental features go
there FIRST; `frontend/index.html` changes only when he approves a promotion.
It shares the live sign in and data, so destructive experiments still need
care. Keep the small amber Playground badge so the two are never confused.
Since v13.58 the playground has carried approved designs before promotion.
The v13.62 filing cabinet was promoted faithfully to the real app in v13.71,
but Playground still keeps its amber badge and remains the source of truth for
future visual experiments. Never regenerate it as frontend plus badge.

Admin access: ADMIN_EMAILS defaults to fromsa@manasiyo.com and
worldofsiyo@gmail.com only, overridable by env. /api/admin/users lists named
accounts (email + last seen) for the Users hover; markers at metrics/users/
carry email since v13.43, older ones are anonymous.

Marketing: WINDSOR_API_KEY on Cloud Run feeds /api/admin/marketing (chart,
campaign table, warnings, ticker) through Windsor, per connector. Direct
META_ADS_TOKEN / GOOGLE_ADS_* still win when set.

The fabric sourcing revamp shipped in v13.44; see that section below.

## v14.36 (Claude): the audit

September 22 22:59 request, CURRENT LOCAL work on top of owner commit 1a4184a:
- status.html: Mana links restored to left with delayed dismissal; reload/plus
  glyphs 39% larger; square nonshrinking gear. Affiliates removes extra Admin
  link and brand flyout; logo still returns Admin. Its drawer opens Messages,
  hiding Systems/Logs navigation. Stats: Total leads, New this week, Contacted,
  Closed, counting the loaded list. Shared Lead Station now has a status selector.
- server.js: admin-only lead update accepts new/contacted/closed and persists
  manual records or Wix overrides. Closed is recorded explicitly, not inferred
  from free text. Existing lastContact also counts as contacted.
- frontend/index.html + playground/index.html: current name/pencil editable;
  Randomize / Save / Replace. Explicit Save appends a UUID avatar in a cloud
  transaction, preserving previous same-name avatars. Implicit project edits no
  longer overwrite the roster. Unsaved current face appears in the dropdown.
  Save guards project/account changes and reports failures. Signature is
  non-enumerable so raw photo data is not duplicated in project serialization.
  Wheel and pinch zoom increments halved, home snap narrowed. Frontend receives
  Playground's paginated Pinterest saves and All Pinterest/My saves selector;
  provider-unavailable searches offer an external Pinterest search link.
  Playground-only flip/callout experiments preserved, not copied into frontend.
- tests/profile-crm.mjs: 22 offline checks pass (actual extracted avatar and lead
  functions, failed writes, account/project switches, inline JavaScript syntax).
  Admin UI 11 and admin-command 6 pass; server syntax and git diff whitespace pass.
  app-regression and maya-hands expectations updated, NOT browser-run because
  owner forbids computer use. Visual validation remains outstanding.
- No push, commit, deployment, computer use, live calls/SMS, paid AI requests,
  credentials or environment changes. GitHub Desktop draft in COMMIT-REVIEW.txt.
Next: owner reviews local changes and visual behavior before pushing. Native
Pinterest-wide provider access remains unverified. Affiliates is still an
admin-only preview, not a partner login/lead-assignment security implementation.

Owner now wants the customer-facing SMS/callback program, not owner-only staging.
No separate SMS checkbox exists yet. Owner prefers less visual clutter; explain
alternative explicit opt-in methods without falsely promising approval for the
current callback notice. Registration guide marks owner-only draft superseded.

September 22 evening CURRENT STATE: owner committed the preceding batch as
cbc5674; local HEAD/origin agree, and read-only HTTP checks confirm the live
/affiliates.html and /status.html serve the new route code. Privacy and terms
also return 200. Server deployment and authenticated affiliate data not verified.
Owner screenshots now establish account Active, campaign REJECTED for an
unverifiable compliant privacy policy, and Twilio error 30034. Inbound Sept 22
09:46 is Received in Twilio; outbound messages are Undelivered. Incoming webhook
URL/response is still needed; campaign rejection alone does not explain missing
inbox storage. No need to retrieve or change the Cloud auth token for 30034.

Earlier batch (superseded layout above): Mana hover moved below Mana, stayed clickable for
one second on pointer departure (visibility transition fixes immediate pointer
loss), supports focus-within; compact centered name/tier/actions, 10px icon
artwork, left-aligned note text with existing ping-pong overflow, keyboard-focusable
horizontal scroll region. SMS errors no longer misleadingly say 'still in review';
30034 has an explanation in the thread. privacy.html and terms.html are revised
DRAFTS for explicit optional permission and no third-party/affiliate marketing
sharing of SMS consent. Owner must align actual Wix opt-in before resubmission.
Full copy/paste draft and checklist: SMS-REGISTRATION-REVIEW.md. Owner confirmed Wix has no separate SMS checkbox and current scope is owner-only
Maya testing. Exact submitted policy URLs still unknown. Registration guide now
prioritizes truthful internal testing, with future customer flow clearly separate;
do not claim the Wix checkbox or automated alerts already exist.
Tests: 50 SMS and 11 admin contracts passed, eight inline scripts parse;
phone 48, transfer and feedback passed. Added browser regression cases, NOT run
this turn: owner explicitly forbids computer use, including GitHub Desktop.
No computer use, live SMS/calls, paid AI endpoints, credential/config changes,
commit or push performed. GitHub Desktop fields intentionally not updated;
commit summary is in docs/COMMIT-REVIEW.txt instead. Visual/browser validation is
still outstanding for these CSS changes. Prior 443 browser result predates them.
Next: owner reviews/publishes policy + consent flow, supplies exact Twilio URLs
and inbound Request Inspector HTTP result, runs error check and resubmits the
campaign, then verifies sender assignment after approval. Only then test receipt.

September 22 latest continuation, LOCAL ONLY: the reproduced SMS audit defects
are now fixed in maya-messages.mjs: exact opt-outs no longer classify 'No problem'
as STOP; explicit START/UNSTOP and signed Twilio OptOutType restore opt-in while
preserving admin blocks; repeated final statuses retain newly supplied error
codes. SMS and delivery callback signatures validate only the configured host
and the two known Maya/Cloud Run hosts wired in server.js. No forwarded-host
trust or signature bypass. Actual carrier failure is still unverified.

Affiliates Beta: /affiliates.html rewrites to backend/status.html, whose explicit
route view shows Fromsa's large initial profile, four stats and the existing Lead
Station. Mana hover includes the new page. Uses admin-only /api/admin/leads,
including current Wix callback leads and the same manual/phone leads, Call/Text/
Invoice/notes and on-demand Maya drawer. Stats are for the loaded list (up to 60),
not an all-time affiliate report. No affiliate invitations, assignments or partner
permissions yet. No production access was broadened. Unrelated ads/traffic/
submissions/AI-brief loads and marketing cache reads are skipped in this view.
Denied/expired/failed reads clear the list; stale responses cannot repaint it.
Changed this continuation: status.html, firebase.json, maya-messages.mjs,
server.js, SMS/browser regressions, AGENTS/CLAUDE route map and these handoff logs.
Validation: 50 SMS, 443 browser, 48 phone, transfer, feedback, 11 Admin UI,
6 admin command and API smoke checks passed. Desktop/mobile screenshots reviewed
at /private/tmp/maya-affiliates-desktop.png and maya-affiliates-mobile.png using
fictional leads. Earlier same-diff hands checks: 172 Playground / 171 frontend.
No live SMS or provider settings changed. Chrome extension access was unavailable,
but native Chrome controls opened Twilio successfully: the console redirects to
its signed-out Email login. Tab left open for owner sign-in. Actual Twilio status/
error and incoming webhook logs remain unread. GitHub Desktop Summary/Description
were filled and read back for this complete diff; Commit/Push left to owner.
Exact next step: owner review/commit/push the prepared diff, verify Cloud Build,
then verify owner phone -> Maya inbox and Maya Admin -> owner phone using Twilio
logs and physical receipt. Do not call live texting fixed until both are proven.
Separate affiliate accounts need scoped server authorization before invitations.

September 22 SMS follow-up, local only: backend/status.html now matches the
frontend's 16px drawer top padding and circular tabs, with gear/chat glyphs,
higher contact/back controls, a visible name-edit pencil and 40px voice button.
Rename success/errors and carrier feedback have a separate live status region
that polling does not erase; delayed responses stay on their own thread.
maya-messages.mjs recognizes conservative explicit introductions on incoming SMS
and names only an unnamed/Caller thread, never overwriting a manual name. This
uses no OpenAI call and does not grant the sender any identity/authorization.
Tests changed: maya-messages, app-regression and admin-ui-contract. Validation:
38 message checks, 48 phone checks, transfer, feedback, 11 Admin contracts and
438 browser assertions passed. Fictional-message screenshot inspected at
/private/tmp/maya-messages-sep22.png. Prior build-test fix remains in this diff.
Live Admin was opened and still showed the old text-pill tabs, not these edits.
Twilio Console opened signed out; no authenticated carrier logs were accessible,
then Chrome disconnected. Account unsuspension is owner-reported, not verified.
Incoming/outgoing SMS failure remains OPEN; no new real SMS/call or provider
configuration changes. Ordinary inbox/SMS paths have no OpenAI calls; phone and
browser Realtime do. Actual billing was not read.
Exact next step: owner signs into Twilio and Maya Admin; inspect latest inbound
webhook URL/HTTP result and outbound MessageSid status/error, then fix the proven
cause. Review and owner commit/push the local changes, verify Cloud Build, then
test both directions. GitHub Desktop summary must describe this whole diff.

September 21 implementation was committed by the owner as ae8704f (tt) on
September 22. Local HEAD and the existing origin/maya-v2 tracking ref agree;
GitHub confirms this commit was pushed. PR #1 has two successful Vercel checks
and failed Cloud Build 1b827272-c2f5-4b64-809d-285caafd9ce0 (3m 3s).
The release-contract gate failed on the stale two-button avatar assertion in
tests/maya-hands-smoke.mjs: Playground correctly has Randomize/Replace/Save.
Server build and all production deploy steps never started. No assistant push,
release bump, credentials, provider settings or live calls in this follow-up.
September 22 workflow change: AGENTS.md and CLAUDE.md now require automatically
preparing Desktop's Summary and Description before owner commit/push. This
follow-up also corrects that test to require exactly three buttons in Playground
and exactly two in the unpromoted frontend. GitHub plugin connected and repository
access verified. Validation: maya-hands-smoke passed 172 Playground and 171
frontend assertions; all seven non-browser release suites plus phone, Messages
and transfer passed locally. git diff --check and mirrored instructions passed.
Next: prepared Desktop commit fields describe the full current local diff;
Fromsa commits/pushes, then verify the new Cloud Build result. Do not amend
the already committed feature batch or rerun the old deployment automatically.
Exact review and remaining work: `REVIEW-2026-09-21.md`.

Changed: backend/status.html (compact tier/actions, handset, plus, safe Messages
names, delivery diagnostics, Logs tab); maya-phone.mjs (approved greeting,
customer transfer tool, blocked incoming calls, owner history, early audio,
signed caller/context binding and durable outbound briefing); new
maya-transfer.mjs (fixed owner, press-1 acceptance, decline/no-answer fallback);
maya-messages.mjs (early status callback recovery, carrier lookup, visible blocked
tombstones); new maya-feedback.mjs (atomic source+wording, generation retries,
no silent truncation of old requests); server.js wiring; Dockerfile and Cloud
Build module/test entries. Playground only: explicit avatar Save, name edit,
current avatar preview, saved-pin pagination and global/saved search selector.
frontend/index.html has NOT been promoted or modified.

Validation: phone 48 passed; Messages 33 passed; transfer and feedback suites
passed; browser 435 assertions passed (including the final
layout and staged behavior checks); admin command 6, UI contract 11, MCP 11 and API smoke
all pass. Local screenshots use invented contacts. No live audio, transfer,
SMS receipt, real Firestore/GCS write or provider-access verification claimed.

Next: read the review and finish remaining alert/integration work. Instant Wix
form call+SMS requires an authenticated event subscription; current Wix reader
is a ten-minute cache refreshed on demand, not an instant event source. Direct
Google/Meta authorization and replacing Windsor, extensive Wix analytics,
actual cost reconciliation, voice quality measurements and stronger owner auth
remain open. Do not claim the entire requested release is complete. The owner
publishes the studio number on Wix manually; no Maya contact page is requested.
Feedback given directly to Maya is the primary request queue; logging is not
implementation or permission to silently deploy. Preserve the original wording.

September 19 current audit: see `AUDIT-2026-09-19.md`. Owner requests economics
before any push, natural faster voice, an active CRM and direct Google/Meta
reporting without Windsor. Live Windsor warning: five accounts versus free-plan
limit one; reads paused. Admin treats the warning as campaigns and the ticker
incorrectly says campaigns are paused. Source delivery is unknown. Existing direct
API aggregate readers do not feed the Windsor-dependent combined campaign chart.
September 19 CRM patch is already in 9b0beac; its test updates/validation remain
outstanding. No new push or production configuration changes performed here.
Next: validate that patch, reject Windsor diagnostic rows, preserve unavailable
metrics as unknown, then reconcile actual provider costs after owner dashboard
sign-in. Audit changes only documentation; no new tests run for this note.

Run after v14.35 landed: maya-hands-smoke 171 app / 172 playground,
app-regression (only the known ops artifact), admin-ui-contract 11,
admin-command 6, maya-mcp, proxy-policy 27, ai-routing 7,
fabric-sourcing 6, smoke, maya-phone 40, maya-messages 17. Live: the app
and Admin pages arrive brotli compressed (210 KB and 70 KB) in about
0.3 s; /api/healthz 0.35 to 0.5 s warm, 1 s cold; the Cloud Run phone
status 0.6 s. Fixes: _phoneFindLead matches a phone number (7+ digits,
leading 1 dropped) before the unique first name, so note_lead on a
client call whose lead has no name still lands; the phone saveLead dep
names the thread (_messages.name) when Maya saves a lead by name.
Noted, not done: the greeting on a call starts about a second after
pickup because the OpenAI socket opens on Twilio's start event; opening
it from the incoming webhook would shave part of that. Texts through a
Messaging Service: set TWILIO_MESSAGING_SID (MG...) if Twilio ties the
campaign to the service rather than the number.

## v14.35 (Claude): Messages

docs/server/maya-messages.mjs (new). createMessageStore({ load, save })
keeps maya/sms/threads.json: threads keyed by E.164 number, each { number,
name, messages[], consent ('none' | 'asked' | 'yes' | 'stop'), unread,
updatedAt }; a message is { id, dir in|out, kind sms|call, text, ts,
status, by, seconds, mode }, capped at 400 per thread; writes are
serialized in memory. inbound() bumps unread and sets consent (a no or
STOP -> stop, anything else -> yes); outbound({ asks }) sets 'asked' on a
number's first text; call() writes a call line. sendSms(deps, { to, text })
posts to Twilio Messages.json from TWILIO_FROM_NUMBER (or
TWILIO_MESSAGING_SID when set); error 30034 or an A2P message reads as
"texting is waiting on the carrier registration". mountMessages(app,
deps): POST /api/phone/sms (Twilio's inbound text webhook, signature
checked with the same helper as voice, answers empty TwiML), GET
/api/admin/messages (thread list, newest first, with last and unread),
GET /api/admin/messages/thread?number= (the thread; clears unread), POST
/api/admin/messages/send { to, text, name } (409 when consent is stop;
the first text to a number is marked asks), POST
/api/admin/phone/call-client { to, name, reason } -> _phone.callClient.
maya-phone.mjs: placeCall(to, entry) is the shared Twilio call, callFromsa
uses it with mode 'brief', callClient({ to, name, reason }) with mode
'client' (US numbers only, never Fromsa's own); mode 'client' runs
clientCallInstructions (opens "Hi <first>, this is Maya from Mana Siyo.
Fromsa asked me to call about your request.", the reason, a question;
voicemail gets one sentence and end_call) with CLIENT_CALL_TOOLS
(note_lead fixed to that client, end_call). deps.onCallEnd(rec) fires for
inbound and client calls (not brief or admin) so the call lands in the
thread with what the person said. server.js wires _messages, the Twilio
deps, and the routes; Dockerfile copies the module; CI runs
tests/maya-messages.mjs (17 checks) next to maya-phone (40).
status.html: #adm-tabrow (Systems, Messages with an unread badge) at the
top of the drawer; #drawer.msgs hides the Systems links; #drawer-messages
holds #msg-list (rows: initial, name, when, last line, unread dot) and
#msg-thread (head with back, name, number and a "Maya, call" pill;
bubbles in/out; call lines; composer; a consent line). admTab(),
loadThreads(), openThread(), loadThread(), msgSend(), msgCall(),
_mayaCallClient(), leadOpenThread(i), leadMayaCall(i). The station's
phone icon is now leadMayaCall (a one line prompt for the reason, then
Maya calls and the thread opens); the tel: link is gone; a chat icon
(CHAT_SVG) opens the thread. Polls every 15 s while the tab is open; the
badge refreshes once a minute otherwise. Both tabs hide while Maya's
voice line is live (body.maya-live), as the links always did.
Twilio, his: point the number's Messaging webhook ("A message comes in")
at https://maya-api-53947659283.us-west1.run.app/api/phone/sms, POST.
Texts stay refused by Twilio until the A2P campaign is approved; calls
work now.

## v14.34 (Claude): the Lead Station, trimmed

server.js: LEADS_ONLY_FORMS (env WIX_LEADS_FORMS, default /call ?back/i)
keeps only the Call back form's submissions in wixLeads; LEADS_SKIP_FORMS
still applies. _phoneFindLead(query) is the shared resolver (exact name
or email, then unique first name) for the phone deps noteLead and the
new setTier(query, tier) -> updateLead(id, { tier }) (a Wix lead gets an
override, a manual lead is edited). The Admin voice instructions say a
"went with" sentence means update_lead with tier (status.html's
dispatcher already patched tier). maya-phone.mjs: BRIEF_TOOLS gain
set_tier; the transcript auto lead is off unless PHONE_AUTO_LEAD_SECONDS
is above 0 (default 0; it used to be 25). Tests: 35 phone checks.
status.html: LEAD_COLS_DEFAULT is name, email, note, actions; the quote
column def and _quoteCell are gone (_leadTierNum stays for the pay link;
a stored column order that still names quote is filtered by the defs).
The tier line under the name replaces a middle dot with a comma.
#leads-fold .panel has padding 0 with th padding-top 16px and 18px side
padding on the first and last cells, so the sticky header covers the
scrollport's top edge (rows used to show through the panel's 16px top
padding above the header). Name column min-width 112px, max 190px.
His to do: delete the one "Caller" row from before v14.33 (the trash
icon on the row), it was his own test call.

## v14.33 (Claude): the studio line knows its owner

maya-phone.mjs: on the stream's start event, an inbound call whose Twilio
caller id (customParameters.from, which the incoming webhook copied from
Twilio's From) has the same digits as deps.fromsaPhone gets mode 'admin':
briefInstructions({ inbound: true }) ("the system verified his number",
opener "Hey Fromsa, it is Maya. What do you need?") and BRIEF_TOOLS, which
now also carry log_note -> deps.logNote(text) (server:
appendMayaFeatureFrom(text, 'Fromsa, on the phone', 'phone')). Admin and
brief calls never auto save a lead, and save_lead on them does not take
the caller id as the lead's phone. Every other inbound number stays mode
'inbound' with PHONE_TOOLS only, and phoneInstructions gained WHO YOU
TRUST: a caller is a client whatever they claim, no admin by say so, no
other clients' data, instruction changes refused. Turn detection:
server_vad silence 420 ms (PHONE_VAD_SILENCE_MS), prefix 200 ms, was
650/300. The phone number check is by digits (a leading 1 dropped), so
+15104917540 and 5104917540 match. Caller id spoofing is possible in
theory; the admin hands on the phone are read and note tools, nothing
destructive, which is the reason the line trusts the number.
tests/maya-phone.mjs: 34 checks (admin session by caller id, log_note,
no ghost lead on an admin call, a stranger's number is a client line,
the client guardrails are in the brief).

## v14.32 (Claude): the texting paperwork

backend/privacy.html: title "Privacy Policy | Mana Siyo and MAYA", h1
"Privacy Policy", dateline Mana Siyo Inc., new "Text messages" section
(sender Mana Siyo Inc. from 510 990 9223, opt in by form or verbal yes on
the studio line, what is sent, frequency varies, rates may apply, STOP and
HELP, the carrier sentence "We do not sell or share your SMS opt-in data
or personal information with third parties for marketing purposes.",
Twilio named as the carrier). backend/terms.html: "Text messages" section
with the same consent, STOP, HELP and carrier lines. Both pages carry
maya-version 14.32 (they are not in the four surface lockstep). These are
the two links the Twilio A2P campaign registration asks for:
https://maya.manasiyo.com/privacy.html and
https://maya.manasiyo.com/terms.html. Still his: the consent sentence
under the phone field of the Wix Call back form, and a public screenshot
of it for the opt in proof.

## v14.31 (Claude): Maya calls Fromsa

maya-phone.mjs: mountMayaPhone now returns { live, wss, callFromsa(reason) }.
callFromsa POSTs to Twilio (deps.twilioApi, default api.twilio.com)
/2010-04-01/Accounts/SID/Calls.json with Basic SID:token, form To =
deps.fromsaPhone (only ever his number), From = deps.fromNumber, Url =
https://publicHost/api/phone/outbound, Timeout 30; the returned CallSid is
kept in an in memory map with the reason (15 min TTL). POST
/api/phone/outbound (Twilio fetches it when he picks up): signature
checked, CallSid must be in that map (404 otherwise), answers the same
<Connect><Stream> TwiML. On the stream's start event a CallSid found in
the map flips the call to mode 'brief': briefInstructions(reason) and
BRIEF_TOOLS (list_leads -> deps.listLeads(n), note_lead ->
deps.noteLead(query, note), save_lead, end_call); the first
response.create says "Hey Fromsa, it is Maya." plus the reason. No auto
lead from a brief call; the transcript carries mode and reason.
server.js: POST /api/phone/call-me (admin, JSON { reason }) ->
_phone.callFromsa; the Admin realtime tool call_me (in the tool list and
in Maya's instructions) and status.html's dispatcher call that route.
Mount deps: accountSid TWILIO_ACCOUNT_SID, fromNumber TWILIO_FROM_NUMBER
(default +15109909223, the Oakland number he registered), fromsaPhone
FROMSA_PHONE (default his mobile), publicHost PHONE_PUBLIC_HOST (default
maya-api-53947659283.us-west1.run.app), model PHONE_REALTIME_MODEL falls
back to REALTIME_MODEL, listLeads reads loadLeadFeed, noteLead resolves
by resolveLeadExact then a unique first name, writes the email keyed
note store or updateLead(note) for leads without an email.
/api/phone/outbound gets express.urlencoded like /incoming.
tests/maya-phone.mjs: 28 checks now (a fake Twilio REST API answers the
placed call; the outbound TwiML is signed and known; the brief session
shape; list_leads and note_lead; end_call; a second call).
Env Fromsa sets: TWILIO_ACCOUNT_SID (the AC... id from the console).
Everything else has a working default.
Next (v14.32, his go): the Wix form hook and the call end trigger that
text the client, text Fromsa one line and ring him; texts wait on the
10DLC campaign approval.

## v14.30 (Claude): Maya on the phone, a year of leads

docs/server/maya-phone.mjs (new): mountMayaPhone(app, httpServer, deps).
POST /api/phone/incoming is Twilio's voice webhook: form encoded, checked
against X-Twilio-Signature (HMAC SHA1 of the URL Twilio called plus the
sorted form fields, keyed by TWILIO_AUTH_TOKEN), answered with TwiML
<Connect><Stream url="wss://HOST/api/phone/stream"> carrying three
parameters: token (HMAC SHA256 of the CallSid, keyed by the same auth
token), from, callSid. HOST is the host Twilio called (PHONE_PUBLIC_HOST
overrides). The stream MUST be the Cloud Run URL, not maya.manasiyo.com:
Firebase Hosting's /api rewrite does not carry WebSockets. So Twilio is
pointed at the Cloud Run service URL for the webhook too, and the
signature then matches. /api/phone/stream is a ws WebSocketServer on the
same http server (app.listen now returns _httpServer). On Twilio's start
event the token is checked, then one OpenAI Realtime socket opens
(wss://api.openai.com/v1/realtime?model=REALTIME_MODEL, Bearer
OPENAI_API_KEY, GA event shapes, no beta header): session.update with
audio/pcmu in and out, server_vad (650 ms silence), transcription
(PHONE_TRANSCRIBE_MODEL, default gpt-4o-mini-transcribe), voice
OPENAI_REALTIME_VOICE, the character file plus phoneInstructions(), tools
save_lead and end_call; then response.create so Maya greets first.
Twilio media -> input_audio_buffer.append; response.output_audio.delta ->
Twilio media; speech_started -> Twilio clear plus response.cancel (barge
in); transcripts collected from
conversation.item.input_audio_transcription.completed and
response.output_audio_transcript.done. save_lead -> deps.saveLead(lead,
prevId): appendManualLead with source 'phone' the first time, updateLead
after (one lead per call, up to four saves). end_call -> hang up 2.5 s
after the goodbye. On any end: if no lead was saved and the caller talked
at least PHONE_AUTO_LEAD_SECONDS (25) with 20+ characters of transcript, a
lead named "Caller" is saved from the transcript; the whole transcript
goes to GCS maya/phone/<CallSid>.json. Caps: PHONE_MAX_MINUTES (10),
PHONE_MAX_CALLS (3; the fourth caller hears a busy line). GET
/api/phone/status says whether the line is on and how many calls are
live. ws is a new dependency (package.json, Dockerfile copies
maya-phone.mjs); it is imported dynamically, so a machine without it
(the device VM) boots with the line off and a warning.
tests/maya-phone.mjs: a fake Twilio and a fake OpenAI over local
WebSockets, 21 checks (signature, TwiML, bad token, session shape, audio
both ways, barge in, save_lead and the update, end_call, the transcript,
the auto lead). It skips itself when express or ws is missing; CI installs
both (cloudbuild.yaml) and runs it, plus node --check on the module.
Lead Station: wixLeads reads WIX_LEADS_DAYS (365) instead of 28 days,
resolves form names once an hour (form-schema-service query) with
guessFormName() for deleted forms, skips forms matching
/volunteer|seamstress/i, lists 60, asks the model for the newest 20
summaries only, and joins tier and words with a comma (the middle dot is
gone). Each lead has `form`; the station badge shows the form name (WIX
leads) or PHONE. The feed reports year and phoneCount next to d28.
Env Fromsa sets on Cloud Run: TWILIO_AUTH_TOKEN (required), optional
PHONE_PUBLIC_HOST, PHONE_MAX_MINUTES, PHONE_MAX_CALLS,
PHONE_AUTO_LEAD_SECONDS, PHONE_TRANSCRIBE_MODEL. Cloud Run request
timeout must be at least PHONE_MAX_MINUTES (default 300 s; set 900 s).
Not built yet, on purpose: SMS after the call (needs A2P 10DLC or toll
free verification), outbound calls, the app's board tools on the phone.

## v14.29 (Claude): the iPad fits

Both surfaces, CSS: the @supports (height: 100dvh) block no longer nests
the 640px query; #screen-* and .hpane are 100dvh at every width (iPad
Safari's 100vh is the tall viewport, exactly the iPhone bug of v11.34, so
the drawer floor and the pill sat under the visible edge). New band
@media (min-width: 641px) and (max-width: 1279px): body.drawer-open
#voice-wrap max-width calc(100vw - 378px - 12px); #voice-row and
#secondary-row wrap; #notes-drawer bottom adds the safe area; the viewer
rows wrap; .modal-card max-width min(560px, 92vw), max-height 88dvh.
New @media (pointer: coarse) at any width: .item-card blur 12, .modal blur
18, the three drawers blur 20, #voice-bar blur 14 (the phone already had
the first two under 640; the iPad was paying the desktop blur).
JS, updateDrawerState: between 641 and 1279 wide, while hscroll.scrollLeft
is above 0, #voice-wrap gets translateX(calc(-50% + scrollLeft/2 px)),
which keeps it centered in the visible part of the board (the board pane
is 100vw and scrolls 378px under the drawer); otherwise the inline
transform is cleared. window resize calls updateDrawerState too (an iPad
turned in the hand). Nothing changes under 641 (the drawer covers the
board) or at 1280 and over.
Battery 3c14 resizes the page to 820 x 1180, opens the drawer and checks
the pill, the floor row and the Hey Maya switch are inside the viewport,
then closes it and checks the pill is back at the center: app 171,
playground 172. tests/tmp/tablet-shots.mjs (Claude session) takes iPad
gen 5, gen 11, Pro 11 landscape and iPhone 14 shots with a probe of the
key rects.
Not done, his: the Pinterest wider search (see v14.26); the live saved
pins search 502 is read in this round from a tab of mine and the finding
is in requests.txt.

## v14.28 (Claude): the pencil on hover, the consent line gone, the playground flip

Both surfaces: .avatar-switch-rename is opacity 0 and shows on
.avatar-switch-row:hover (the v14.26 active-row rule is gone; the
(hover: none) block keeps it on .active for phones); .session-item-rename
shows on .session-item:hover only, .active under (hover: none). #fb-consent
is display none (the telemetry consent stays whatever it was; the toggle
function remains for a future setting).
Playground only, the experiment Fromsa asked for: inside
#garment-image-wrap sit #pg-callouts (absolute, inset 0, pointer events
none, opacity 0, shown on wrap hover), #pg-flip (bottom right, camera
switch icon, shown on hover, always on touch) and #pg-card-back (display
none until .flipped; the drawer's glass; #pg-card-back-body with
.pgb-title, .pgb-row / .pgb-k / .pgb-v, .pgb-chips from card.refs).
_pgViewerExtras(item) renders both from card.profile (bio, aesthetic,
silhouette, color, era); the four callouts anchor at fixed fractions of
the wrap on the middle figure of the three view sheet (Aesthetic 0.545,
0.22 right; Silhouette 0.455, 0.47 left; Color 0.55, 0.40 right; Era
0.46, 0.76 left), an SVG draws dot and hairline, labels are positioned in
percent. It runs after renderViewerNotes (wrapped), on the image's load
and on resize. pgFlipCard: two half turns (.turning to 90deg in 380 ms,
swap .flipped while edge on, .turning-in at -90 without transition, then
.turned eases to 0 in 420 ms); no 3D stacking, so hit testing stays
sane (a true rotateY(180deg) card with preserve-3d let the front
intercept clicks on the back in Chromium). Full screen photo hides both.
A version step re-renders and unflips. Battery: 168 checks on the
playground, 167 on the app. tests/tmp/desk-shots.mjs in the Claude
session took the screenshots that verified the look.

## v14.27 (Claude): ready for a phone

How it was audited (repeatable): tests/tmp/mobile-shots.mjs in the Claude
session, Playwright with devices['iPhone 14'] against the battery's fake
API, cards placed through placeItemAt, screenshots of home, the drawer
(profile, clients, Pinterest, fabrics), the card editor, the feedback box
and the chip, plus a probe for horizontal overflow and page errors. Zero
errors, no horizontal overflow; the findings were visual.
Voice: _pgPhone() is (pointer: coarse) and not (hover: hover). On a phone
pgToggleWake opens the line (pgMayaStart) or hangs up (pgMayaStop) and
never starts the wake recognizer (_pgWakeStart returns at once), so no
Safari chime and it works on Chrome for iPhone which has no recognizer.
pgMayaStart asks for the microphone before the token fetch (inside the
tap), sets playsinline on the Audio element and calls play() in ontrack;
a 402 stops the mic tracks it took.
Touch: the (hover: none) rules show .fav-btn, .delete-btn, .stack-btn,
.dissect-btn and the resize handle only on .item-card.touched; the
pointerdown in makeDraggable marks the touched card and clears the
others. A tap still opens the card; closing it leaves that card marked.
Feedback box: the inline max-width:520px beat the phone rule (inline
beats a media query) so the card was 520 px on a 390 px screen; it is
min(520px, 94vw) now with 16 px side padding under 640 px; the other
inline card (max-width 420px) got the same treatment. #pg-maya-chip
bottom respects env(safe-area-inset-bottom); the Hey Maya label is
nowrap.
Known and left: a desktop board restores as a pile on a phone (v11.30
clamps every card into the viewport; the canvas is overflow hidden and
one screen tall). organize_board (pinterestLayout, one column on a
phone) and zoom out are the tools; a fresh project is the clean demo.
Notes are hidden in the card editor under 1280 px (by design). Battery:
165 checks per surface.

## v14.26 (Claude): demo readiness: the live drive, fabric thumbnails, Pinterest in words

How the live app was audited (repeatable): from Fromsa's signed in Chrome
tab on maya.manasiyo.com, a script injected into the page (a <script>
element; the extension's isolated world cannot see page globals) called
window._pgTool for every non spending tool with a stub data channel,
timed each, captured window errors and console.error, and wrote the
result to document.documentElement.dataset.audit. Read it back from the
isolated world. Findings: 30 steps, zero page errors, everything under
2 s except the wider Pinterest search (15 s then "23") and the first
visit. /root/audit-driver.js in the Claude session is the script.
Fabrics: aesthetics/fabrics/*.JPG are 3 to 4 MB originals (23 MB for
eight) and were painted as swatches and even as the drawer tab icon.
aesthetics/fabrics/thumbs/<name>.jpg (640 px, quality 82, made with PIL
on the device) are what paint now: fabricsInventory items carry thumb;
_fabricThumb(f) returns thumb, else the thumbs path for a house fileName
without a dataUrl, else the dataUrl (a designer's own upload);
fabricSwatchUrl (card dots, viewer chips, staged chips) prefers thumb;
the house grid, the pick grid and the spec rows use _fabricThumb; the
tab icon is thumbs/Orange Cheetah.jpg. dataUrl (the original) stays for
analyzeFabricWithVision and the OpenAI edit anchors. Add a fabric: drop
the JPG and regenerate its thumb (PIL: thumbnail((640, 640)), quality 82).
Pinterest: pinFetch names a timeout (pinterest_timeout, was a DOMException
whose .code 23 leaked to the app as the word "23") and unreachable;
non ok answers carry e.status and 429 is pinterest_rate; pinErr answers
504 / 429 / 502 with {error, upstream, detail}. _pinWideSearch speaks
the failure in words (took too long, needs to be connected again, asking
for a short pause, did not answer) with needs: reconnect | retry, and
tells Maya the wall still searches. The live wider search returned 502
pinterest_error at the time of the audit; the detail now rides in the
response so the next round can read what Pinterest said.
Aesthetic: #drawer-avatar-rename is display none; .avatar-switch-rename
shows only on .avatar-switch-row.active (hover no longer reveals it, the
x still shows on hover); toggleAvatarSwitcher files the client on the
board (_saveCurrentAvatarToLibrary) when the roster lacks it and falls
back to a synthetic row, so the current client is always listed and
highlighted. Card editor: .vn-profile .note-group-title is white and
600 weight, .note-detail is rgba(222,230,245,0.74).
Sight: the look instruction says the picture is what she answers from;
the board and drawer lists are a silent aid for exact names, never
recited. The board's pictures paint (Firebase Storage answers
access-control-allow-origin * on every response, verified with curl) and
the pins paint since v14.25.
From the inbox of Sep 2, 9:53 to 9:59 pm (read live before this round):
the yes is in the tool now: modify_garment and visualize answer {ok:false,
needsConfirmation:true, say} until called with confirm true (the
instructions alone did not hold; _pgClassifyFail already treats
needsConfirmation as 'confirmation', never a defect); the decls carry
confirm. A card without z (a pin brought in, an upload, a fresh render)
takes ++_zCounter in the render function, so it lands on top. The
feedback box is z 260 (it was 200, the same as the viewer, so it opened
behind the open picture: "the box did not appear"). look carries the
open picture itself at 1024 px via _pgPictureData(src) (canvas, CORS,
cached) as a second input_image, and the page capture is JPEG 0.78;
window._pgLastLook keeps the last capture for a human to inspect.
Open from that inbox: "add my logo onto the back properly, this is not
my logo" (a render fidelity ask; references by words help, the image
model decides the rest).
Voice: /api/voice-token answers error voice_credit when OpenAI's message
says insufficient_quota / billing / quota / hard limit; pgMayaStart
toasts "The studio's OpenAI credit has run out. Top it up, then say Hey
Maya again." Battery: 157 checks per surface.

## v14.25 (Claude): from Maya's inbox: feedback submitted, stop, references, the wall in her picture

RULE, FIRST: before any audit or any "check the feedback" round, read
Maya's live inbox. It is GET /api/admin/maya-features (Bearer the admin
token from localStorage maya_admin_tok on status.html) plus
GET /api/admin/feedback; the Admin Feature requests fold renders both,
newest first; the MCP door (/api/mcp, tool maya_inbox) reads the same
store once MAYA_MCP_TOKEN is set on Cloud Run. On Sep 2 night Fromsa gave
Maya nine notes and she logged two of her own; all landed instantly (the
pipe was never broken); Claude had read the inbox before that session
and did not read it again, so the audit missed them. Never again.
App: submitFeedback toasts "Feedback submitted."; _pgRunCall logs a
failed tool as "Tool <name> failed: <reason>" (was "Maya could not
viewer"); _pgAutoLog sends through _pgLogSend(body, attempt) which retries
at 20 s and 60 s on a network failure or a 5xx (never on 400/401).
Visualize by voice: the tool takes references (comma separated words);
it sets window._pgRefIntent {ts, refs} (empty for none/fresh) and
maybeAskImageRef consumes it within 90 s: the named inspirations are
matched by words against title/caption/bio (stop words dropped, then
_pgFindCardDetailed), selectedImageReferences is set, the popup never
opens, _runVisualizeNow runs; window._pgRefResult {used, missed} is
read by the tool after its 500 ms wait and spoken back (missing names
are named). Nothing named means nothing attached.
Her eyes: _pgPinThumbs() collects the visible .pin-pic/.pin-tile imgs
(https only, up to 12) in #pinterest-drawer-body, POSTs the uncached
ones to /api/pinterest/thumbs {urls} and keeps data URLs in
_pgPinThumbCache; _pgLook swaps them in through html2canvas onclone, so
the wall paints; look returns pinsPainted. Server route: requireGoogleUser,
one rateLimit tick per batch, pinimg.com hosts only, 600 KB per picture,
8 s each, answers {thumbs: {url: dataUrl|null}}.
Instructions: "feedback submitted" after Submit; STOP MEANS STOP (scroll
stop, say nothing; only goodbye / hang up / end the call end the call,
and the hang_up line says never on "stop"); SPENDING (say the render back
in one line, wait for a yes, never ask twice); GARMENT FIRST; visualize
carries references; look says the pins are painted in. Battery: 154
checks per surface. Open from the same inbox: "let me try it on" in one
step (item 2), fresh renders never blending old inspirations by hand
(the voice path is done; the button path still asks).

## v14.24 (Claude): the audit round: 403, the wall, uploads, Admin, Maya's eyes

OPENAI ERROR 403: localStorage maya_openai_model held gpt-4o (an old
settings screen); proxy-policy refuses unknown models with 403
model_not_allowed; callOpenAIChat printed only the status. Fixes: getModel()
drops anything but gpt-4.1 / gpt-4o-mini; MODEL_UPGRADES also maps gpt-4o,
gpt-4, gpt-4-turbo (TERRA) and gpt-4.1-mini (LUNA); the chat error prefers
err.error.message, then err.detail, then the error word.
Pinterest: _pinBoardsCache (cleared by _pinReload) so Boards never refetch
in a session; openPinterestDrawer keeps _pinPicked when the wall is kept
and shows the foot when picks exist (it used to reset the Set while the
checkmarks stayed); _pinWideSearch resets picks on a new wall.
Upload: onFacePhotoSelected no longer persists the full size data URL
before the shrink, and files the client (_saveCurrentAvatarToLibrary) at
once plus queueSave.
Body direction: buildMeasClause appends " BODY, atelier direction: " +
_promptCfg.body after the natural proportions sentence.
Admin: lead column 'Contact' (phone field when present, else email);
#pe-fold is visible again with a fourth textarea #pe-body, loaded and
saved with the other three (config/prompting.body); the body layer
paragraph explains where it lands.
Maya's eyes: _pgPinsOnScreen() lists visible .pin-pic / .pin-tile in the
drawer body with pos (row x col terciles of the visible body rect), words
(alt or board name), picked; _pgDrawerState carries pinsOnScreen + a
truth note, the search word and the scope; look returns board +
drawer alongside the screenshot; bring_in_pins takes position (via
_pgPinsByPlace) and answers with the list when nothing sits there; the
server decl drops required query and the instructions say the list is
her eyes on the wall and to never invent a card or pin. Battery: 148
checks per surface.

## v14.23 (Claude): the profile tidied, Randomize fixed, white notes, all of Pinterest

Profile: .avatar-switch-actions holds Randomize and Replace only.
#drawer-avatar-rename (pencil) sits after the caret in .pg-avatar-nameline
and calls pgRenameClient(). Each roster row has .avatar-switch-rename
(pgRenameAvatarRow(id): in place input) and the x; renameAvatarById(id,
name) rewrites the settings/avatars list under the new key and, when that
client is on the board, updateClientNameInline follows.
Randomize: _refreshActiveAvatarView used to repaint only under a
.viewing-avatar class that the cabinet layout never sets, so nothing
showed; it now always runs _renderAvatarBody + refreshDrawerClientName,
and randomizeAvatar files the client (_saveCurrentAvatarToLibrary) and
queues a save. The public headshots list (MAYA_PUBLIC_HEADSHOTS) is served
from /aesthetics/headshots/, verified live.
Card editor: renderViewerNotes pushes the profile group with an empty
title (no "Notes" subheader; empty titles are skipped in the join).
#viewer-notes .vn-profile .note-item .note-detail is white and upright
(the old .vn-profile .note-detail rule tied on specificity with the later
generic italic rule and lost); the column's head, items, titles and group
titles are brighter across the board.
Search, third room: _pinWideSearch(q, scope) with scope 'saved' (GET
/api/pinterest/search) or 'everywhere' (GET /api/pinterest/everywhere).
_pinSearchAllPill adds #pin-search-all (class fabrics-tab, "All of
Pinterest") to #pin-tabs after a saved search; _pinSearchEnter goes to
everywhere by itself when saved is empty; a not_available answer returns
{needs:'access'} with a plain reason. search_pins tool: scope
'saved'|'everywhere' (the server decl carries the enum); instructions
describe three rooms with OFFER between them. Server route: tries
Pinterest v5 GET /search/partner/pins (term, country_code US, limit 50;
BETA, granted per app by Pinterest, read from the v5 OpenAPI spec), then
Google Custom Search image search with siteSearch pinterest.com when
GOOGLE_CSE_KEY + GOOGLE_CSE_CX are set (healthz reports pinterestWeb),
else 501 not_available. Both doors are Fromsa's to open: request beta
access for search/partner/pins in the Pinterest developer portal, or set
the two Google keys on Cloud Run. Battery: 143 checks per surface.

## v14.22 (Claude): the third rung of the safety ladder

_runVisualizeNow (both surfaces): faceDescClause and lineageAnchor are
`let` now, plus `let faceSkipped` and `window._mayaRenderNote`. The face
branch's callOpenAIImageEditSafe call is wrapped: on isSafetyRejection
after the softened retry it sets faceSkipped, nulls lineageAnchor and
faceDescClause (they carry the same face), writes _mayaRenderNote, toasts,
and auto logs; the following branches became `if (!dataUrl && ...)` so the
render falls through to refs, lineage, or plain generation on a fit model
with measClause intact. _pgWatchRender appends "Also say this plainly:
<note>" to the finished message when the note is set. The generic safety
toast no longer blames vocabulary alone. Battery: 135 checks per surface;
the scenario stubs callOpenAIImageEditSafe/callOpenAIImageSafe, waits out
the 520ms fly in timer, and restores the seeded board.

## v14.21 (Claude): THE PROMOTION. frontend/index.html IS the Playground now

Fromsa said "everything", so frontend/index.html was replaced by a copy of
playground/index.html with exactly two differences: no #pg-badge (and no
amber label script), and the Tip pill kept on the floor row (Tip, Logout,
Feedback, Hey Maya). Everything else is identical, including the voice
layer (~1,570 lines at the tail: pgMayaStart, _pgTool with every hand,
sight, wake word, glide, matcher, observer, telemetry), the survey zoom,
the screen order (inspo, favorites, community; _pgScreenPos), the
Background fold, the caption and profile sweeps, the drawer glass on
popups, the Pinterest search pill and wider search, Improve Maya with
Maya's logs. The server needed nothing: the realtime session already
admits any signed in user. From here, edit BOTH files for every change
(the two differ by two hunks; `diff playground/index.html
frontend/index.html` must stay that small), or edit the Playground and
re-promote with the v14.21 script pattern. tests/maya-hands-smoke.mjs runs
itself once per surface (MAYA_SURFACE / MAYA_SURFACES) and fails if either
fails. The v13.92 arrow assertion was updated to the v14.06 canon (42px).

## v14.20 (Claude): the drawer organized, the wider finger search, natural proportions

Tab title Profile (pgShow + the span). #pg-projects is a pg-fold above
#pg-stats; the cabinet controller moves .drawer-sessions into
#pg-projects-body, adds class open, and CSS keeps #drawer-sessions-list
display:block !important inside it. toggleSessionsDropdown is overridden to
open the fold and repaint; loadSavedSessionById is wrapped so opening a
project never hides the list. pgUpdatePill also writes #pg-projects-current
(the summary's italic name). .pg-avatar-actions and .pg-project-beside are
display:none (the elements stay for the tools and tests); the client
dropdown (toggleAvatarSwitcher) now opens with .avatar-switch-actions:
Rename (pgRenameClient), Randomize (randomizeAvatar), Replace photo
(pgReplaceFace), Remove photo (pgRemoveFace), then the rows, then + New
avatar. Rename a project: renameProjectById(id, name) saves through
projectStore.save when it is the open one, else updates the doc (name +
revision increment) and _touchIndex; pgRenameProject(id) is the in place
input (pencil .session-item-rename on every row; the open row's title too).
Search (playground): #pin-search-btn is an inline SVG glass in a 24px
circle, the box is 150px centered; typing filters (_pinSearchInput), Enter
runs _pinWideSearch(q) (shared with the search_pins wider branch), an
emptied box or the toggle restores (_pinSearchRestore). buildMeasClause
always ends with the natural proportions sentence (head about one eighth
of height, face reference sets likeness only). Battery: 133 checks.

## v14.19 (Claude): the drawer untangled

The avatar pane had two identities braided together. currentClientName is
the PROJECT label (the Save flow names it; autoName otherwise) and
lastSummary.client.name is the CLIENT (face, measurements, the person who
wears the board). Three fallbacks leaked the project label into the client
(saveAvatar, randomizeAvatar, onFacePhotoSelected) and updateClientNameInline
wrote both; all four are client only now, and refreshDrawerClientName no
longer falls back to the project label. pgUpdatePill writes the open
project's name into #pg-project-beside (class .on) and syncs .active on
the list rows from projectStore.currentId; it runs after every
refreshDrawerClientName and _renderSessionsDropdown, plus a 1.2s watch on
(currentId, currentClientName, autoName) that repaints only on change. The
store's methods are NOT wrapped: the regression suite reads them by
source (projectStore.save.toString()). The photo
button calls toggleAvatarSwitcher. switchAvatar and newAvatar go through
_wearClient(a): identity fields only, the board and the notes stay, then
queueSave. deleteAvatar(id) removes a roster entry (confirm gated, rewrites
settings/avatars). pgRenameClient() is an in place input over the name
span (Enter or blur keeps, Escape drops) that names the client and files it
in the library. The Projects tile uses projectStore.list() (listSessions
never existed on the store). Voice: list_clients and switch_client.
Battery: 124 checks.

## v14.18 (Claude): the universal glide and the wider search

The glide is _pgGlideStart(els, dir, axis) now: element or array, axis 'x'
or 'y', 1.5px/frame rAF over scrollLeft/scrollTop, every element moving
together. Favorites glides 'x', community glides all .community-row rows
'x' at once, pins glide 'y'; stop stays a first class direction everywhere.
search_pins has two rooms: the loaded wall first (returning a spoken OFFER
of the wider search), then wider:true, or a local miss, calls GET
/api/pinterest/search, a new server proxy over Pinterest v5 /search/pins
(everything the ACCOUNT has saved, page_size 48, biggest image picked,
requireAuthHeader + Google user + pinConfigured). The wall re-renders those
pins (window._pinWiderActive) and clear_pin_search restores the cached wall.
Pinterest exposes no public search beyond an account's own saves; the tool
says so and points at describe_garment for fresh imagery. Battery: 115
checks.

## v14.17 (Claude): Pinterest search, the glide, position words

The search: #pin-search-btn + #pin-search-input in #pin-tabs; _pinSearch(q)
filters .pin-pic by dataset.alt and .pin-tile by name, plural tolerant,
returns the visible count. Voice: search_pins(query) opens the drawer,
filters, scrolls to top and starts the glide; clear_pin_search restores;
bring_in_pins collects only visible pins. The glide: _pgGlideStart(el, dir)
is a 1.5px/frame rAF loop stopping on _pgGlideStop (the stop direction on
scroll and scroll_pins), wheel/pointerdown, the end of the wall, or hang_up.
Position words: _pgPosWord(it, pool) buckets style.left/top into terciles
(top/middle/bottom x left/center/right); _pgBoardSnapshot carries pos, the
server sanitizer passes it (24 chars) and boardLines print it; the matcher
resolves 2D regions with version-family collapse and candidate ambiguity.
Search filtered only the LOADED wall in this version; v14.18 added the true
API search of everything the account saved. Battery: 109 checks.

## v14.16 (Claude): the studio gauge and the fast Admin

_mayaUsage gained admin (from /api/usage admin:true); _renderDrawerStats has
an admin branch (full ring, Studio, no cap) on BOTH index and playground.
Admin: loadMkt's paint block extracted to _paintMkt(d, alsoBrief); success
saves maya_mkt_cache (localStorage, ts + payload); _mktWarmPaint paints the
cache instantly at boot when a cached admin token exists (48h ceiling), with
fetchBrief gated to fresh fetches only. Assertions in the v14.16 block.

## v14.15 (Claude): the feedback round

Four fixes straight from maya/features.json: brevity after actions and
live write_feedback typing (both in the voice instructions, UNDERSTANDING
THEM block), singular/plural tolerant pin matching in bring_in_pins, and a
self-explaining dissect refusal. Assertion in the v14.15 regression block.

## v14.14 (Claude): the release audit, blockers closed

Codex's 20-finding review, triaged and fixed before any push. The load
bearing changes: _pgFindCardDetailed no longer falls back to the open card
on a zero-score named query (the deictic path is untouched); every mutating
card tool uses the detailed matcher and surfaces candidates; delete_card is
a two-call confirm handshake staged by card id with a 60s window
(window._pgPendingDelete). _pgRunCall races every tool against
window._PG_TOOL_TIMEOUT_MS (default 25s), catches throws, classifies
failures (_pgClassifyFail: expected/ambiguity/confirmation/timeout/defect;
only defect and timeout auto-file), posts consented telemetry
(_pgTelemetry, gated by localStorage maya_improve_consent, toggle in the
Improve Maya modal), and ALWAYS sends function_call_output. pgMayaStart
resets _pgToolChain and mints _pgTraceId. _pgWatchRender polls
_renderLabels and _pgLastRenderError and injects the true outcome into the
conversation; modify/visualize answer STARTED. Server: withLock promise
mutex around features/memory/soul/people/telemetry; POST /api/telemetry
(sanitized schema, capped 5000); GET /api/admin/maya-digest (admin
Markdown); mcpAuthScope splits header (full) from query token (readonly,
MCP_HEADER_ONLY_TOOLS = feature_done, journal, memory, leads). cloudbuild
runs the browser battery when chromium installs, skips loudly otherwise.
Battery: 97 checks incl. the routing layer driven through _pgOnMessage.
Deferred items and reasons live in requests.txt.

NEXT (Fromsa): push (v14.10 through v14.14 ride it). The Claude connector
keeps working read-only via ?token=; for full access it needs the token as
an Authorization header (see fixes.txt).

## v14.13 (Claude): she understands the card in front of her

The comprehension pass, from a live session. Root causes, not symptoms:
`visualize` always ran `visualizeGarment()` (home screen: avatar check then
`openFabricMode()`), so talking to an open picture could never render and
always popped a fabric chooser. Fixed with `modify_garment(text)` which
pushes into `visualizeModifications` and calls `modifySubmit()` (the direct
apply path, no picker), and `visualize` is now context aware. `viewer`
next/prev called `_favStep` (favorites strip) instead of `viewerStep`
(versions): new `card_version` tool plus `_pgStep()` which checks
`#viewer-version-nav` visibility. `_pgFindCardDetailed` replaces the flat
matcher: deixis (open card), position (left/right/middle by style.left),
recency, double weight on the five design notes and color, version families
collapsed to newest, and `ambiguous` + candidates on a genuine tie so she
asks. `showError` records `window._pgLastRenderError` and auto-logs; new
`render_status` tool. Instructions gained THE CARD EDITOR and UNDERSTANDING
THEM sections. 44 tools. Battery: 82 checks.

Also: docs/CODEX-MAYA-BRIEF.md is the second-engineer handoff (frustrations,
fixes, repo map, prior art on tool design and voice repair, paste prompt).
Open question it raises: 44 flat tools is past reliable selection; consider
per-mode tool sets pushed with session.update when the viewer opens.

NEXT (Fromsa): push. Then open a picture and just talk to it: "make it a
trench coat", "go back to the previous version", "the red one".

## v14.12 (Claude): the second pass

Audit findings on my own v14.10/v14.11 work, all fixed: #pinterest-drawer-body
is STATIC markup, always in the DOM, so every "is Pinterest open" check must
use offsetParent, never bare existence (scroll_pins, scroll's pins branch,
and scroll's bare-area inference all fixed; two scripted battery scenarios
now pin this). /api/usage returns admin:true and leftUsd; check_credits now
honors both. addManualRef dedupes silently, so add_reference counts items
before and after and reports "already on the canvas". viewer returns a
spoken reason on a miss. New tools: move_card (style.left/top are canvas
units so zoom never skews the step; _persistSession saves), resize_card
(140 to 640 px clamp, mirrors the resize handle's img sizing), list_favorites
and open_favorite (items filter favorited+image; openFavoriteForSubmit),
set_quality (writes STORAGE_KEY_IMG_QUALITY directly, never saveSettings,
which would clobber the model input; only medium and high exist in the app),
clear_hints. Battery: 73 checks. She is at 41 tools.

NEXT (Fromsa): push. Then on a call: "move the red dress to the center and
make it bigger", "open my favorite with the gold collar", "high quality
this time".

## v14.11 (Claude): thirteen new hands

The method: inventory every interactive element in the live playground DOM
(buttons, onclicks, pills) via the browser, then close the gap between what
a finger can do and what Maya can. New _pgTool cases: zoom (window.pgZoomTo
added inside the zoom closure, clamped to zfloor), organize_board
(brandTitleClick), dissect_card (.dissect-btn on the matched card),
add_reference (addManualRef at a center-ish xy; the v14.07 wrapper divides
by zoom), card_details (card.profile + refs), list_projects / open_project
(parse .session-item[data-id] title attrs, call loadSavedSessionById) /
new_project (newConsultation), check_credits (GET /api/usage: spentUsd,
capUsd, images), background (pgApplyBackground star / pgGenerateBackground),
randomize_avatar, set_measurement (spoken name to ameas-* id map, then
saveAvatar), pick_fabric (mode-choose then .fabric-pick match then
fabric-pick-confirm). Viewer map: heart, photo, attributes. Server declares
all thirteen, the viewer enum grew, and the instructions carry one line per
power. Battery: 59 checks in tests/maya-hands-smoke.mjs.

NEXT (Fromsa): push, then on a call try "step back and look at the whole
board", "what do my favorites say about me", "my waist is 29", and inside a
photo "switch the fabric to the midnight velvet".

## v14.10 (Claude): her legs and ears

tests/maya-hands-smoke.mjs is the new battery: serves the repo with a fake
/api, boots playground headless (fake media flags), seeds two cards, fires
~30 calls through `_pgTool` with good and bad args, asserts shape not just
success, checks the v14.09 auto-log fires on failure, and that the wake
plumbing never throws. Run it after touching anything in the voice agent.
Found: no screen navigation and no general scroll (the "cannot go down"
bug). Fixed: `go_to_screen` (setScreen 0/1/2) and `scroll` (favorites
scroller sideways, community rows sideways, pins down; no area = the screen
under her, or step a screen). `_pgFindCard` hay now includes profile
bio/aesthetic/silhouette/color/era. Server: both voice-token routes send
audio.input.noise_reduction far_field (+ gpt-4o-mini-transcribe on the app
line) and RETRY WITH THE PLAIN SHAPE if OpenAI rejects it, so voice cannot
die from the upgrade. Instructions carry the honest-ears line. Metas and
changelog stamp 14.10.

NEXT (Fromsa): push, then call her in a noisy room and say "go to my
favorites" and "keep going".

## v14.09 (Claude): the autonomous observer

Maya logs her own limits. `_pgAutoLog(text, who, source)` in the playground
buffers, renders and POSTs to /api/feature; `_PG_CANT` catches her "I can't"
lines on the transcript, `_PG_WISH` catches user wishes, and the failed-tool
hook sits IN `_pgRunCall` itself (fires on `out.ok === false`, `hang_up`
excluded). Dedupe by normalized 160 chars in `_pgLogSeen`. The Improve Maya
modal has two tabs (`#fb-tabs`: Your note / Maya's logs); `openFeedback`
re-renders and resets to the note tab. Server: /api/feature reads
`source:'maya'` (who defaults to Maya); voice instructions carry the "YOUR
OWN LIMITS ARE LOGGED FOR YOU" paragraph. Admin front room filters
`source==='app'||source==='maya'`. Metas and changelog stamp 14.09.

NEXT (Fromsa): push (five commits ride it: v14.05 through v14.09). Then set
MAYA_MCP_TOKEN on Cloud Run and add the connector (steps in docs/fixes.txt).

## v14.08 (Claude): triple-audit round 3, the sign-off

Third independent pass, clean browser: both pages boot with zero JS errors;
the five-truths notes render centered; every voice wrapper verified as a
function (`startVisualizeListen`/`stopVisualizeListen` wrapped, 402 resume);
`get_feature_digest` answered; Feature requests dedupe live; the hamburger
computes 32x28 with the fixed stylesheet. Version metas and the changelog
stamp at 14.08. Fromsa's loop for big rounds is now the house method: build,
fresh scan and fix, scan again, three commits.

NEXT (Fromsa): push (three commits ride this push: v14.06, v14.07, v14.08).
Then live: open a card and watch the five truths fill in as the sweep runs;
say Hey Maya out of credits and confirm the wake word survives; ask her to
read the feature inbox on Admin.

## v14.07 (Claude): triple-audit round 2, the fresh-eyes fixes

An independent audit agent re-read the Aug 27-28 ledger against the code and
found 13 real defects (33 of 41 claims verified clean). All fixed:
`get_feature_digest` answered on Admin; wake word survives the 402 branch and
the viewer's Tap to Listen (`startVisualizeListen`/`stopVisualizeListen`
wrapped); look-then-greet on connect; Feature requests dedupe (inbox text set);
pinch-resize seeds `offsetWidth`; fly animations and `addManualRef` divide by
the zoom; fullscreen photo hides `.submit-wrap`; `@media (hover:none)` shows
the pills on phones; mobile toast 96px; `_capTries` three-strikes; dead
`wrap.classList.remove('open')` gone. 396 assertions green. Round 3 follows.

## v14.06 (Claude): the five truths (triple-audit round 1)

`playground/index.html`, `backend/status.html`, metas, `tests/*`: the caption
sweep became the PROFILE sweep (`card.profile` = bio, aesthetic, silhouette,
color, era via one json_object vision call; `card.caption` = bio; cards with
only the old caption get upgraded; live viewer repaints on arrival);
`renderViewerNotes` leads with the five centered subheadlines for every card;
`#viewer-notes` text centered; viewer block 30px lower; toast bottom 72px;
favorites arrows in the canon pill recipe at 42px insets; the submit-wrap rise
keeps the 16px bottom radius. Probed headless: titles Bio/Aesthetic/
Silhouette/Color/Era, centered, Design ideas intact, 0 JS errors; 395
assertions green. Rounds 2 and 3 of Fromsa's triple audit follow separately.

## v14.05 (Claude): the door actually opens

Live smoke test of production (v14.03 at the time) found that
`POST https://maya.manasiyo.com/mcp` never reached the server: the hosting
catch-all rewrite served `frontend/index.html` with a 200. The route existed
only on Cloud Run. Fix: `docs/firebase.json` rewrites `/mcp` to the run
service, and `server.js` mounts the door at BOTH `/mcp` and `/api/mcp`
(`/api/**` was always routed, so `/api/mcp` works on any deploy).
`fixes.txt` now tells Fromsa to use `/api/mcp?token=...` for the Claude
connector. One new regression assertion covers all three.

Everything else verified live on v14.03: floor row Logout/Feedback/Hey Maya,
the switch, ticker strip under the drawer at z 0, Feature requests fold
painting 5 rows, prompting engine hidden, sources table hidden, all five
health lights green, /api/voice-token and /api/feature deployed (401 clean
when unauthenticated). The v14.04 items (eyes, glass, THE hamburger fix)
are committed but were not yet pushed at test time; re-verify after push.

## v14.04 (Claude): Maya opens her eyes, one feedback stream, the Bible of glass

`playground/index.html`, `backend/status.html`, `docs/server/server.js`,
`aesthetics/ui/status-v13.19.css`, `backend/marketing.html`, `frontend/index.html`
(meta), `tests/*`:

- **MAYA SEES**: tool `look` captures the live page with html2canvas (cdnjs,
  loaded once on demand, useCORS, ~1100px wide jpeg) and sends it into the
  Realtime session as an `input_image`; she also looks on arrival. Fallback on
  capture failure: the structured board snapshot. Instructions tell her to look
  whenever something visual is referenced and never to guess the screen.
- **More hands**: `open_card`, `delete_card`, `favorite_card` (match by words
  via `_pgFindCard` over captions/titles/refs), `viewer(action)` (close, next,
  prev, post_wall, get_it_made, listen, switch_fabric, add_reference),
  `pin_view(all|boards)`, `open_board(name)`, `scroll_pins(direction)`.
- **Her voice on screen**: `#pg-maya-lines` is the tap-to-listen echo's exact
  voice (Cormorant italic 11px, whisper faint), absolute in `#screen-inspo`
  just above the Visualize pill, three rows, older lines fade and leave, the
  whole thing fades ~6s after the last word. The logo breathes
  (`pgMayaBreathe`, 3.2s) while she is live. One warm opinion allowed, rarely.
- **Every picture speaks**: `_pgCaptionOne` sweep (7s interval, one at a time,
  gpt-4o-mini via the proxy) writes `card.caption` (max 10 words) for any
  pictured card without one; `_buildPieceSummaryLine` returns the caption when
  present, so favorites hover and the viewer's piece line show it. Persisted.
- **Improve Maya**: the feedback popup is one box and one Submit (chips,
  Tap to Listen and Talk to Maya removed); every note goes to /api/feedback
  AND /api/feature (one stream). Toast: "Thank you. Maya keeps it."
- **The drawer is the Bible**: `.modal` overlay is translucent
  (rgba(8,12,24,0.38) + blur 28) and `.modal-card`, `.mmp-card`, `.mcp-card`
  all wear the drawer gradient glass, radius 18. Wall/favorites glow eased 5%.
  The two destination pills live INSIDE `#garment-image-wrap`, hover-revealed
  over a black rise.
- **THE HAMBURGER, actually fixed**: `aesthetics/ui/status-v13.19.css` carried
  `.systems-map .top-btn.hamburger{width:36px;height:36px}` and a min-height,
  loading after the inline styles and overriding every prior fix. Removed;
  verified live-computed 32x28 on both pages is now inevitable.
- **Admin Feature requests**: two rooms (Front end, what users ask; Admin
  side, what we ask), the feedback store merged into the front room, a hover
  check (`markFeatureDone` → `POST /api/admin/maya-feature-done`) marks a wish
  shipped or unshipped.
- Verified: 392 browser assertions + suites; headless probe: transcript rows,
  parent, position above the pill, Improve Maya, submit-wrap in the photo,
  logo animation, 0 JS errors.

NEXT (Fromsa): push, then talk to her with eyes: "let's work on the white and
red outfit, the girl with the apple". Watch the first `look`: html2canvas may
miss a cross-origin picture here and there; if her sight reads wrong, say
which card and we tighten the capture. Visualization speed is a decision, not
a bug: a low-quality fast preview upgraded on heart would cut the wait
roughly in half at a quarter of the render price; say the word.

## v14.03 (Claude): Maya on the user side, drag while zoomed, Admin round

`playground/index.html`, `backend/status.html`, `docs/server/server.js`,
`backend/marketing.html`, `frontend/index.html` (meta only), `tests/*`:

- **Playground, everything works zoomed**: pointer deltas in `makeDraggable`
  and the resize handle are divided by `pgZoomLevel()`; the
  `pointer-events:none` rule is gone. Cards drag, resize, open and favorite
  at any zoom.
- **Backgrounds fold**: two pills, "Upload" and "Generate", side by side in
  `#pg-bg-pills`, lower, near the floor divider.
- **Floor row**: Logout (left), Feedback (middle), Hey Maya switch (right).
  Tip is gone from the playground only (the app keeps it).
- **Hey Maya on the user side**: `POST /api/voice-token` (any signed in user,
  rate limited, 402 when the trial is spent, priced `PRICE_REALTIME` 0.10 per
  call opened) builds a Realtime session from `maya-character.md` plus the
  client's own board (sent in the body) with tools executed in the browser:
  `open_drawer`, `close_drawer`, `bring_in_pins` (matches words against the
  loaded pins' alt text, picks, `_pinImport()`), `describe_garment`
  (`processConsultation`), `visualize`, `write_feedback`, `log_feature`
  (`POST /api/feature`, new, any user, lands in the inbox as source `app`),
  `list_board`, `hang_up`. The wake word (`_pgWake*`, localStorage
  `maya_pg_wake`) pauses while the moodboard's Tap to Listen or the feedback
  listener owns the speech engine (they are wrapped). Her lines show above
  the voice bar (`#pg-maya-lines`), a chip at the bottom right hangs up.
- **Feedback popup**: the drawer's exact glass, an X pill on the title, a
  Feedback / Feature request chip pair, "Talk to Maya" (she takes structured
  notes into the box via `write_feedback`), Submit posts to `/api/feedback`
  and, for a feature request, to `/api/feature`.
- **Admin**: `.top-btn` carries the app's exact shadow, hover and 44px hit
  target (the hamburger is the same object now); `toggleWakeWord` is async
  and primes the microphone on the click, transient recognizer errors no
  longer snap the switch off; `#voice-dock` padding-top 9, margin-bottom -16;
  **Feature requests** fold (`#features-fold`, `loadFeatureRequests()` from
  `/api/admin/maya-features`, who / concise ask / day, done ones struck)
  replaced the Prompting Engine fold, which is `hidden` but still loads and
  saves; the Sources of traffic table is hidden inside the Bottom Line.
- **Changelog rule**: `#changes-fold` carries `data-version`; the regression
  suite fails when it drifts from the meta version. Two entries added.
- Verified: 386 browser assertions, 11 MCP, smoke; headless screenshots of
  the playground floor row, the feedback popup and the Admin drawer.

NEXT (Fromsa): push, then on the playground flip Hey Maya on, allow the mic,
say "Hey Maya" and ask her to open the drawer, bring in a pin by name, and
visualize. Report what she got wrong; that is the next round. Open MAYA's
door (fixes.txt) if not yet done.

## v14.02 (Claude): zoom v5, the frozen meter, the drawer floor, MAYA's door

`playground/index.html`, `frontend/index.html`, `backend/status.html`,
`backend/marketing.html`, `docs/server/server.js`, `docs/server/maya-mcp.mjs`
(new), `docs/server/maya-character.md` (new), `docs/server/Dockerfile`,
`cloudbuild.yaml`, `tests/*`:

- **Playground zoom v5** (replaces v4): the transform is on `#maya-canvas` (the
  cards' own container), not on the whole screen. v4 measured the children of
  `#screen-inspo` (so the bbox was always the full canvas, never the cards) and
  the canvas' `overflow:hidden` cropped every card placed past the fold: that
  was the crop Fromsa saw. Now `measure()` reads the canvas' children, the
  cluster's own bbox glides to the center as the scale falls, and the floor is
  `MINZ = 0.40` unless the cluster would still crop at 0.40 (then the fit
  scale, never below 0.12). No CSS transition: a rAF lerp (`z += d * 0.32`)
  drives every frame, so wheel bursts never restart an easing curve. Card
  glass (`backdrop-filter`) rests while zoomed (the single most expensive
  thing to scale). The screens are NOT pinned any more: plain wheel is never
  touched (canon: native scroll only), so scrolling to favorites and pulling
  the drawer work while zoomed. `parkVoiceBar` is gone (the voice bar is a
  sibling of the canvas, it never moved). Verified headless: 13 cards spread
  to y=1650 on a 900px viewport, 0 cropped at the floor, back to 1 clean.
- **The money counter never restarts**: `TRIAL_EPOCH` is frozen at `v14.00`
  with a loud comment. Do NOT bump it in a release; an out-of-band reset is
  the Cloud Run env var, never code.
- **Gauge ring** bluer (`rgba(128,176,255,0.95)`) and 5 percent thinner (5.2),
  both files.
- **Admin**: the marquee moved out of `#top-bar` into its own fixed
  `#ticker-bar` at z 0, beneath the panes (z 1), so the drawer slides over it;
  `placeTicker()` fits it between the wordmark and the hamburger. The Hey Maya
  pill is an Apple-style switch (`.mt-switch` / `.mt-knob`, word fixed as
  "Hey Maya", `role="switch"`); `#voice-dock` padding-top 38 to 12 so the
  divider sits low; every drawer line `text-align:center`.
- **MAYA's door**: `POST /mcp` is a Model Context Protocol server (Streamable
  HTTP, JSON replies, protocol 2025-06-18) exposing `maya_status`, `maya_inbox`,
  `maya_feature_done`, `maya_memory`, `maya_people`, `maya_soul`,
  `maya_journal`, `maya_leads`. Pure module `docs/server/maya-mcp.mjs`, tested
  by `tests/maya-mcp.mjs` (11 cases) and two smoke checks. Guarded by
  `MAYA_MCP_TOKEN` (Bearer header or `?token=`); with no token the door is
  closed (503). Fromsa's steps to open it are in `fixes.txt`.
- **MAYA's character**: `docs/server/maya-character.md` ships in the container
  and is read into the voice instructions first (`MAYA_CHARACTER`). It is the
  builder-with-taste personality Fromsa asked for; edit it to change how she
  thinks. The GCS `maya/soul.md` stays her journal.
- **Docs**: this file trimmed to a state file (older sections archived);
  `docs/MAYA-INDEPENDENCE.md` is the roadmap for Maya as an entity;
  `docs/AUDIT-2026-08-27.md` is the codebase audit.

(Superseded by v14.03 above.)

## v14.01 (Claude): the lag found and killed + zoom v4 + wall enforcement

- **THE ADMIN LAG ROOT CAUSE**: base `.top-btn` has `transition:all .2s`; the
  admin hamburger inherited it, so its transform animated 200ms behind the
  drawer. Fix: `.top-btn.hamburger{transition:opacity .25s}` + the scroll
  listener calls `update` synchronously (no rAF). This was the years-long
  "drawer not the same" complaint.
- **Admin `#drawer`** = frontend `#notes-drawer` glass verbatim (top:10 right:18
  bottom:10 left:0, gradient, 18px radius, blur 28, inset shadows, padding
  56/12/16). v13.98 full-bleed reverted.
- **Playground zoom v4** (`playground/index.html` addon): `measure()` computes
  the card bounding box (children of #screen-inspo minus #voice-wrap, offset*
  geometry); transform = translate(center-delta) + scale about the bbox center,
  so nothing crops; `parkVoiceBar()` reparents #voice-wrap to body (fixed,
  bottom 22) while zoomed and restores it after; screens pinned: overflowY
  hidden + `scrollSnapType:none` + scroll listener forcing scrollTop 0; ALL
  plain wheel consumed while zoomed. Live-verified.
- **Stats v14.01**: gauge = dollars left (cap 'left of $2'), ring stroke 5.5;
  `pg-stat-images` tile = "Visualizations left" (cardsLeft). Both files.
- **Wall enforcement**: `communityBoard.reconcile()` (both files) sweeps this
  uid's posts where pid == current project against currently-favorited postIds;
  orphans deleted with storage copy. Called on wall entry.
- Invoice modal fully centered; background pills stacked lower; changelog
  relabeled to Fromsa-local dates.
- Repo cleanup r1: `MAYA-audit-2026-08-24.html`, `tests/_drawer.png` moved to
  `_to_delete/`. Deep dead-code pass queued (Codex-friendly; docs current).

## v14.00 (Claude): the honest meter, playground round 3, invoice sending

`docs/server/server.js`, `frontend/index.html`, `playground/index.html`,
`backend/status.html`:

- **Economics**: PRICE_IMAGE 0.13 (medium x0.5 = $0.065/card, the true cost; the
  old 0.05 was silently halved to 0.025). TRIAL_EPOCH `v14.00` resets all.
  `/api/usage` adds `perCardUsd`.
- **Stats in cards**: gauge "N card renders left" (cardsLeft = leftUsd/perCard);
  dollars tile -> Projects (from projectStore.listSessions); "Images rendered" ->
  "Cards rendered"; popup copy 30 free / ~75 for $5; no dollar faces the user.
- **Invoice composer**: `_invEmailLead` / `_invTextLead` send the pay link via
  Gmail compose / sms:, buttons labeled with the lead's first name; sheet chip
  centered on ADMIN (`left:50%;translateX(-50%)`, padding-top 2px).
- **Playground zoom v3**: MINZ 0.25; origin 50%/50%; `#screens` overflowY hidden
  while zoomed (favorites can never pull up); snap to 1 past z>0.92 on zoom-in +
  touchend (fixes stuck pointer-events / the + icon); wheel still ctrl/meta-only.
- **Playground**: badge `#pg-badge` moved into `#top-left-brand` (same row);
  halo alphas ~x0.72; backgrounds v2 (`maya_pg_bgs` list, every generated one
  saved, `pgUploadBackground` + hidden file input, cards named Birth of a Star /
  Generated background / My background, cap 6).
- Viewer actions column centered (`#viewer-actions{flex column center}`), both.
- Emails sent to Fromsa: typography audit (MAYA vs Apple), unit economics.
- Verified headless: zoom lock+snap+unlock, badge in brand row, gauge "card
  renders left", upload pill, 0 JS errors. All suites pass.

NEXT decisions Fromsa owes: the $50 consultation pay link (flow queued with his
popup copy); then the queued audit fixes (lead-email note migration, vision 403,
dissect mismatch, README/verify-live, deploy gate).

## v13.99 (Claude): playground feedback round

`playground/index.html`, `frontend/index.html`:

- **Zoom gesture fixed**: fires ONLY on trackpad pinch (browser reports it as
  ctrl+wheel) or Cmd/Ctrl+scroll; plain scroll always navigates screens
  (`if (!(e.ctrlKey || e.metaKey)) return;`). Touch pinch unchanged.
- **Screen order**: inspo (land) → favorites → community wall, via flex `order`
  on `#screens` + `window._pgScreenPos = {1:0, 2:1, 0:2}` mapping in
  `setScreen`/resize; `data-screen` semantics untouched so wall/favorites logic
  still keys correctly. Zoom's `onInspo()` now checks position 0.
- **Background cards**: fabric-card style (2-col grid, 16:10 image,
  `.pg-bg-cardname` under each: Birth of a Star / My background / Generated
  background); `addBgCard()` helper; generate still never auto-swaps.
- **Projects pill 16px** (was 19) in app + playground; still Cormorant italic,
  centered, caret absolute.
- Verified headless: visual order correct, lands on inspo, plain wheel does NOT
  zoom, ctrl+wheel does, reset works, card 160px wide, pill 16px, 0 JS errors.

## Older versions

v13.24 through v13.98 live in `docs/archive/AI-HANDOFF-through-v13.98.md`.
The narrative is in `docs/history.txt`, the asks in `docs/requests.txt`.
