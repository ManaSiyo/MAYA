# Founder conversation and Messages stress audit — October 8, 2026

MAYA cannot yet support a single, consistently capable founder conversation across SMS and Admin. The audit found four reproducible Messages defects, seven owner-SMS parsing misses even with a correct scripted model decision available, and 22 requested capabilities without an owner-SMS tool in this 60-intent corpus.

Baseline: `2af5039` on `maya-v2`, matching the local remote-tracking branch at audit start. This identifies the audited code, not a newly verified production deployment. This change adds tests and documentation only. No application runtime, credentials, production settings, real messages or personal Chrome sessions were changed. No visible UI is added; all existing shared aesthetic authority remains in force.

## What was actually exercised

- **60 distinct founder intents × 20 phrasing variants = 1,200 inputs**, each run twice through the actual owner CRM, conversation and paged-report engines: **2,400 executions**.
- Mode A deliberately disables AI to measure deterministic fallback. Mode B supplies a hand-authored expected action to test execution. It does not ask a language model to understand the question.
- **10 multi-turn sessions, 31 exchanges** check supplied recent context, durable memory/restart, account isolation, lead corrections, reviewed client sends, duplicate requests, full report pagination, response preferences, signup format, unsupported requests and malformed responses.
- Actual Express Messages routes, signature verification, SMS adapter, message store and archive: **1,280 signed inbound events, 241 callbacks and 78 Admin Send requests**. Synthetic Twilio accepted 46 local submissions; **zero real messages** were sent. Owner-command delegation in this transport fixture is a disclosed stub; the separate founder fixture executes the real owner handlers.
- Transport audit: **28 checks passed; 4 failed**, reproduced on two runs. It intentionally exits nonzero while those defects remain. It is a diagnostic suite, not a passing release gate.
- Owner-SMS corpus: 34 tool intents, 4 scripted conversational examples, 22 missing-tool probes. Of 680 supported-tool variants, 673 matched their procedural/data oracle under scripted routing and 7 did not. All 440 missing-tool executions correctly rejected the injected unavailable action; those are NOT successful answers to the founder's request. The 80 scripted chat replies do not measure intelligence.
- With AI unavailable, 34 of the 680 supported-tool variants matched. Most variants deliberately add greetings/context to expose fallback limits. This is a stress corpus, not a representative success-rate estimate. General conversation still requires available inference.

The service-level lead readers are supplied synthetic fixtures. They intentionally do not claim coverage of the production feed adapters, the current owner's live binding, live account data, provider reasoning, carrier delivery or production latency. The source audit below separately identifies adapter and channel gaps.

## Messages / Admin: fix these first

| Priority | Reproduction and observed result | Required change and acceptance test |
| --- | --- | --- |
| P1 | Hold Admin Send's first contact read. Persist STOP on another instance, then release the stale read. The durable claim sees newer storage, but Send still returns HTTP 200 and submits with `consentAtProvider: stop`. | Validate current STOP/block state inside the generation-checked claim and recheck at dispatch; keep duplicate/uncertain-send protection. The existing race probe must produce no provider submission and a truthful stopped response. |
| P2 | Replay a signed inbound SID after it leaves the 400-message live window. Unread rises 800→801 and chronology uses the replay time. | Deduplicate retained/archive identities before inbox mutation; preserve original timestamp and unread count. Include storage failure and explicit deletion-epoch cases. |
| P2 | An owner TwiML reply moves to the archive under `owner-reply-<inbound SID>`. A valid delivered callback with its `replyTo` cannot find that archived alias, leaving it accepted. | Reconcile the alias inside the archive with the same mismatch guard as live history; preserve terminal status ordering across concurrent callbacks. |
| P2 | Admin accepts `+447700900123` for SMS. The real server adapter returns HTTP 502: “that is not a US mobile number,” with no provider call. | Align SMS with the documented explicit-country-code contract through reviewed sends; keep calls' separate US-only scope. Test UI start through actual send adapter, not only opening the composer. |

Sources: [Messages store and routes](server/maya-messages.mjs) (inbound around 118; status around 187; send around 382), [archive](server/message-archive.mjs), [Admin typed-number entry](../backend/status.html) around 3560, [design contract](design.md) around 297. Executable reproductions: [message-stress.mjs](../tests/message-stress.mjs).

## Owner SMS: conversation gaps and prepared changes

1. **Normalization can intercept the wrong contact before AI.** `THREAD Avery Stone please`, `LEAD Avery Stone please`, `ACTIONS please` and four related variants are consumed as exact commands with the extra words inside the identity. Correct scripted AI is never consulted. Normalize supported conversational framing before selecting a command; preserve literal quoted client text. Clarify genuine ambiguities rather than treating polite wording as a name. Keep these seven cases as end-to-end fixtures.
2. **Cancellation is not an action.** After a lead preview, a scripted “Okay, I will not change it” chat reply leaves the original `YES` code valid. Add explicit draft identity, cancel/replace actions and persisted outcomes. Do not claim cancellation from prose alone. Multiple independent REPLY previews remaining valid is not itself a defect; a future replacement request must explicitly identify which preview it revokes.
3. **Grounding of ordinary chat relies on instructions.** A deliberately injected chat response saying an invoice was sent and claiming 9,999 completed leads passes straight through, with zero real actions. This is a guard probe, not evidence that a live model hallucinated. Require receipts for completed-action claims and fresh tool results for business facts; include adversarial model-output tests.
4. **Reports are retrieved without a second reasoning step.** “What did Avery decide on the last call, in one sentence?” selects `client_history` and returns paged raw history. Add a bounded read → reason → respond step with source/result identifiers and no model-authorized sends. Retain explicit full reports on request.
5. **Natural continuation is absent.** `MORE code page` works, but “keep going” has no exposed/forwarded SMS action. Track the current report by owner conversation and resolve “next” without mixing simultaneous reports or another account.
6. **Full reports and individual lookup disagree.** Full lead lists traverse retained records; `_phoneFindLead` and reply revalidation use the default 60-row feed. A lead in a full report may then be missing from lookup, booking or update. Use stable-ID/full-source lookup with complete/partial evidence, bounded reads and account checks. Test identities beyond row 60 and ambiguous names across page boundaries.
7. **Several useful predicates are absent.** Status/all/count exist; date, source, material and follow-up queries do not. Add validated read predicates against authoritative data rather than counting the six-row model snapshot. Individual SMS contact replies also omit stored stage.
8. **Client-specific action reports miss some evidence.** `ACTIONS Avery` omits the booking/alert audit adapter appended to unfiltered ACTIONS. Filter that evidence by validated recipient so failed sends with no message record remain discoverable.
9. **Preference correction/removal is incomplete.** Memory and behavior saves work, but the SMS model catalogue omits `forget`, and the handler removes memory facts rather than behavior rules. Expose scoped inspect/replace/remove operations and test conflicting preferences across a restart.
10. **Length and timing need an explicit product contract.** Chat slices 2,000 characters to 1,600 without continuation; reports split at 900 characters, including within records. Make normal replies concise, keep record boundaries and offer conversational expansion. Add total request deadlines and truthful pending/unavailable outcomes; preserve non-retryable writes instead of racing mutating promises.

Sources: [owner-crm.mjs](server/owner-crm.mjs), [owner-conversation.mjs](server/owner-conversation.mjs), [owner-sms-access.mjs](server/owner-sms-access.mjs), [server adapters](server/server.js) around 4560 and 4794–4844. Reproductions: [founder-conversation-stress.mjs](../tests/founder-conversation-stress.mjs).

## Admin / founder access and channel consistency

Admin currently offers voice transcripts, not typed conversation with Maya. Its Messages composer sends to a contact. Admin voice exposes business metrics, team-sheet reads, people/journal and dashboard actions that owner SMS cannot call. SMS exposes client SMS/call history, reply previews and response/signup preferences that Admin voice cannot call. Owner phone has another narrower tool schema, including different list limits. A provider connection alone does not make its information accessible through every conversation.

Prepare a shared owner capability registry and a distinct Admin founder-chat composer. Reuse existing authenticated readers and reviewed mutation services rather than inventing parallel stores. The shared conversation should persist recent turns and acknowledged outcomes by account, then expose the same supported tools through SMS, owner phone and the authenticated Admin login. Keep channel-specific rendering and explicit approval mechanics. Any new composer must use Aesthetic Control's active text/field/pill/panel settings and pass the final visual authority check.

Identity must come from verified transport/account binding. The code's default Admin allowlist includes `worldofsiyo@gmail.com` and `fromsa@manasiyo.com`; environment configuration can override it. This audit did not inspect that environment or the live binding, so it cannot certify that either is currently enabled or that one is the sole Admin. Owner SMS binds one Google `sub`; logging into the other permitted account does not merge its memory.

A new Admin text endpoint must verify the current login matches the owner binding before reading owner-phone history. Today `ownerConversation.decide` calls a history adapter without a UID; the adapter reads the configured owner thread. `requireAdmin` alone would not preserve that boundary. Admin voice currently clears transcript DOM on reconnection and does not persist those turns for later SMS recall.

Additional source-audited Admin issues: lead read DTOs omit stage and voice `update_lead` lacks a stage argument; the daily ad fallback can convert missing daily breakdown into zero; team-sheet reads silently cap tabs/rows/columns (voice further trims rows). Preserve unknown/partial metadata and provide pagination before allowing confident answers about absent data.

Sources: [Admin UI](../backend/status.html) around 967, 2197, 2454, 2488, 2530 and 2581; [server.js](server/server.js) around 198, 1537, 1546, 3266, 3341, 3990 and 4821; [admin-command.mjs](server/admin-command.mjs) around 26 and 170.

## Outbound, Brief, Operation Room and projects

SMS has no callable reader for Outbound prioritization/email history, Gmail review, campaign analysis, saved briefs, manufacturing progress, fabrics/lookbooks or client projects. These are capability gaps, not proof that their underlying providers are disconnected. Start with account-bound read tools and explicit source coverage; only then add reviewed drafts/actions using existing services. Do not collapse project/account boundaries to make Maya appear omniscient.

The CRM AI meter is already available through SMS STATUS, including spend, reserved amount and the $1 daily limit. It should be routed and summarized rather than implemented twice. SMS uses the configured CRM provider-selection adapter; it is not guaranteed to use OpenAI. Outbound and owner SMS share that daily allowance. This audit neither changed that budget nor tested the live providers.

## Responsiveness and real-model acceptance

Measured synthetic fixture timings are below. They establish local execution behavior only. Memory storage and loopback HTTP exclude real auth/GCS/model/carrier latency; they are not a promised reply SLA.

- Owner engine corpus: p50 0.028 ms, p95 0.088 ms.
- Signed inbound HTTP: p95 9.53 ms; Admin Send: p95 34.92 ms; maximum measured request 37.96 ms.
- Current production code budgets full lead reads at six seconds and AI calls at eight seconds, after optional context reads up to 800 ms. Storage/report/reply persistence are outside these budgets; the webhook waits for the whole workflow. There is no demonstrated total production deadline.

Next acceptance stage: run this same corpus against the actual configured model in an isolated account with synthetic data and outbound providers replaced, recording model/version, chosen tool, source facts, exact argument fidelity, truthful action claims, clarification quality, concision, latency and usage. Include conversation corrections, “her/the second one,” interruption, uncertain provider outcomes, partial data and context truncation. Score wrong recipients, unauthorized sends and invented completion as hard failures; score an explicit unavailable answer separately from successful task completion. Then perform a small owner-approved live SMS round trip for carrier timing. No current number measures actual model semantic accuracy.

## Reproduction and validation

```sh
MAYA_FOUNDER_STRESS_REPORT=/tmp/maya-founder-stress-results.json node tests/founder-conversation-stress.mjs
MAYA_MESSAGE_STRESS_RESULTS=/tmp/maya-message-stress-results.json node tests/message-stress.mjs
```

The first runs safety/data contracts and prints open audit observations. The second intentionally exits 1 on the four reproduced defects. Do not weaken those assertions to obtain a green result. Exact counts/timing may vary with scheduling; the identified failures reproduced twice. The founder corpus is included in app-regression; the failing transport diagnostic remains separate until fixes are implemented.

The broader release sweep also exposed an obsolete circle-only assertion for Outbound campaign icons. The approved design uses independent X/Y padding and permits oval capsules. Only that test was corrected to verify glyph + padding + border dimensions, centering and capsule radius at all seven existing widths. No runtime styling was changed. Final verification status is recorded in AI-HANDOFF.md and COMMIT-REVIEW.txt.

## All 60 canonical requests and observed fixture replies

Every contact, number, business amount and message below is synthetic. “Scripted AI” means the expected action/reply was supplied by the test; it is not a live model's answer. Report excerpts are shortened for readability; full outputs regenerate with the commands above. Each row also had 19 contextual/politeness variants.

| # | Area | Founder request | Execution mode / canonical result |
| --- | --- | --- | --- |
| 1 | Leads | Text me the latest five leads | **AI-free tool**: Latest leads \| page 1/1 \| snapshot / Latest leads / Avery Stone / +14155550140 / client0@example.invalid / Status: Not contacted / Linen suit request 0 /  / Fixture Client 1 / +1415555020… |
| 2 | Leads | Text me all the leads | **AI-free tool**: All leads \| page 1/9 \| snapshot / All leads / 78 shown of 78 matching leads. /  / Avery Stone / +14155550140 / client0@example.invalid / Status: Not contacted / Linen suit request 0 /  / … |
| 3 | Leads | Text me all the contacted leads | **AI-free tool**: Contacted leads \| page 1/2 \| snapshot / Contacted leads / 13 shown of 13 matching leads. /  / Fixture Client 1 / +14155550201 / client1@example.invalid / Status: Contacted / Linen suit re… |
| 4 | Leads | Show all not contacted leads | **AI-free tool**: Not contacted leads \| page 1/2 \| snapshot / Not contacted leads / 13 shown of 13 matching leads. /  / Avery Stone / +14155550140 / client0@example.invalid / Status: Not contacted / Linen … |
| 5 | Leads | Show all in progress leads | **AI-free tool**: In progress leads \| page 1/2 \| snapshot / In progress leads / 13 shown of 13 matching leads. /  / Fixture Client 2 / +14155550202 / client2@example.invalid / Status: In progress / Linen s… |
| 6 | Leads | List all booked leads | **AI-free tool**: Booked leads \| page 1/2 \| snapshot / Booked leads / 13 shown of 13 matching leads. /  / Fixture Client 3 / +14155550203 / client3@example.invalid / Status: Booked / Linen suit request 3 /… |
| 7 | Leads | List all completed leads | **AI-free tool**: Completed leads \| page 1/2 \| snapshot / Completed leads / 13 shown of 13 matching leads. /  / Fixture Client 4 / +14155550204 / client4@example.invalid / Status: Completed / Linen suit re… |
| 8 | Leads | List all cancelled leads | **AI-free tool**: Cancelled leads \| page 1/2 \| snapshot / Cancelled leads / 13 shown of 13 matching leads. /  / Fixture Client 5 / +14155550205 / client5@example.invalid / Status: Cancelled / Linen suit re… |
| 9 | Leads | How many leads do we have? | **AI-free tool**: Leads: 78. / Not contacted: 13 / Contacted: 13 / In progress: 13 / Booked: 13 / Completed: 13 / Cancelled: 13 / Closed (previous): 0 / Passed (previous): 0 / Status unavailable: 0 |
| 10 | Leads | How many contacted leads do we have? | **AI-free tool**: Contacted leads: 13. |
| 11 | Leads | Count the booked leads | **AI-free tool**: Booked leads: 13. |
| 12 | Leads | Show the latest three contacted leads | **AI-free tool**: Contacted leads \| page 1/1 \| snapshot / Contacted leads / 3 shown of 13 matching leads. /  / Fixture Client 1 / +14155550201 / client1@example.invalid / Status: Contacted / Linen suit req… |
| 13 | Leads | What's Avery Stone's phone number? | **AI-free tool**: Avery Stone / +14155550140 / client0@example.invalid / Linen suit request 0 |
| 14 | Leads | LEAD Avery Stone | **AI-free tool**: Avery Stone: +14155550140 |
| 15 | Leads | What's Missing Person's phone number? | **AI-free tool**: No exact fixture contact matches. Clarify the name. |
| 16 | Messages | THREAD Avery Stone | **AI-free tool**: Avery Stone (+14155550140) conversation (newest first) \| page 1/1 \| snapshot / Avery Stone (+14155550140) conversation (newest first) / 2026-10-07T12:00:00Z \| Call from Avery Stone (+1415… |
| 17 | Messages | What did you text Avery Stone? | **AI-free tool**: Avery Stone (+14155550140) conversation (newest first) \| page 1/1 \| snapshot / Avery Stone (+14155550140) conversation (newest first) / 2026-10-07T12:00:00Z \| Call from Avery Stone (+1415… |
| 18 | Messages | Show Avery Stone's last call transcript | **Scripted AI → tool**: Avery Stone (+14155550140) conversation (newest first) \| page 1/1 \| snapshot / Avery Stone (+14155550140) conversation (newest first) / 2026-10-07T12:00:00Z \| Call from Avery Stone (+1415… |
| 19 | Messages | INBOX | **AI-free tool**: Messages inbox \| page 1/1 \| snapshot / Messages inbox / Avery Stone: +14155550140 / No activity \| unread 2 \| ok / Your fitting is confirmed. / End of report. Request again for new activity. |
| 20 | Messages | ACTIONS | **AI-free tool**: Recorded actions \| page 1/1 \| snapshot / Recorded actions / 2026-10-07T12:00:00Z \| Call from Avery Stone (+14155550140) \| Avery Stone \| 50s \| call / Avery Stone: Prefer linen / MAYA: I wi… |
| 21 | Messages | ACTIONS Avery Stone | **AI-free tool**: Recorded actions \| page 1/1 \| snapshot / Recorded actions / 2026-10-07T12:00:00Z \| Call from Avery Stone (+14155550140) \| Avery Stone \| 50s \| call / Avery Stone: Prefer linen / MAYA: I wi… |
| 22 | Systems | STATUS | **AI-free tool**: Fixture service ready. CRM AI spent $0.23, reserved $0.02, limit $1.00. No live provider was queried. |
| 23 | Systems | MAYA HELP | **AI-free tool**: SMS help \| page 1/2 \| snapshot / SMS help / MAYA SMS controls: / THREAD Nick: stored texts both ways and call transcripts, with times and delivery status. / INBOX: contacts and latest act… |
| 24 | Systems | FEATURES | **AI-free tool**: Feature requests \| page 1/1 \| snapshot / Feature requests / Daily briefing requested, not active / End of report. Request again for new activity. |
| 25 | Memory | Remember that I prefer linen for summer suits | **Scripted AI → tool**: Remembered: I prefer linen for summer suits. |
| 26 | Memory | Keep your replies concise and conversational | **Scripted AI → tool**: Saved for future texts and owner calls: Keep replies concise and conversational. |
| 27 | Memory | For new leads, text the name and actual phone number first | **Scripted AI → tool**: Saved. Future signup texts will use this format with each lead’s actual details: / {name}: {phone} / {category}: {request} |
| 28 | Leads | Add Jordan Vale at 4155550188, interested in a linen suit | **Scripted AI → tool**: Add: Jordan Vale · +14155550188 · Interested in a linen suit / Reply YES &lt;code&gt; within 10 minutes to save. Nothing has changed yet. |
| 29 | Leads | Mark Avery Stone as completed | **Scripted AI → tool**: Update: Avery Stone · completed / Reply YES &lt;code&gt; within 10 minutes to save. Nothing has changed yet. |
| 30 | Leads | Update Avery Stone: fitting next Tuesday | **Scripted AI → tool**: Update: Avery Stone · Fitting next Tuesday / Reply YES &lt;code&gt; within 10 minutes to save. Nothing has changed yet. |
| 31 | Messages | Send the booking link to Avery Stone | **AI-free tool**: Preview for Avery Stone (+14155550140): / Fixture booking URL: https://example.invalid/book / Reply BOOK &lt;code&gt; within 10 minutes to send. Nothing has gone to the client. |
| 32 | Messages | Draft this text to Avery Stone: "Your fitting is ready." | **Scripted AI → tool**: Text preview for Avery Stone (+14155550140): / Your fitting is ready. / Nothing sent. Reply SEND &lt;code&gt; within 10 minutes to send this exact text. |
| 33 | Systems | Log a feature request for a daily founder briefing by text | **Scripted AI → tool**: Logged for implementation. This change is not active yet: Daily founder briefing by text |
| 34 | Conversation | Hi Maya, how are you? | **Scripted chat**: Hi Fromsa. What would you like to work on? |
| 35 | Conversation | Update that person we talked about | **Scripted chat**: Which contact, and what should I change? |
| 36 | Conversation | Text Alex | **Scripted chat**: Which Alex, and what exact message would you like to send? |
| 37 | Conversation | What do you remember about my preferences? | **Scripted chat**: I have no saved preferences in this fresh test account. |
| 38 | Admin ads | How much did we spend on Google Ads today? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 39 | Admin ads | Compare Google and Meta cost per lead this month | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 40 | Admin ads | Which campaigns are actually delivering right now? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 41 | Admin insights | Where are we losing people between ad clicks and leads? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 42 | Outbound Gmail | Summarize the important unread emails in my connected mailbox | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 43 | Outbound Gmail | Show Gmail contacts I should add as leads | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 44 | Outbound | Who needs an email follow-up today? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 45 | Outbound | Save a follow-up email draft for Avery in Outbound without sending it | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 46 | Outbound | Did we already email this fashion house? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 47 | Brief | Summarize the latest client design brief | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 48 | Operation Room | What is the progress of the linen suit in Operation Room? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 49 | Operation Room | Find fabric matching the saved linen suit request | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 50 | Operation Room | Show the saved fabrics for this project | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 51 | Frontend projects | Which projects did the client save? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 52 | Admin team | What is on the team sheet today? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 53 | Admin invoices | Create a reviewed invoice draft for Avery | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 54 | Systems | What commit is live right now? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 55 | Systems | How much of the AI budget have we used today? | **Scripted AI → tool**: Fixture service ready. CRM AI spent $0.23, reserved $0.02, limit $1.00. No live provider was queried. |
| 56 | Automations | Remind me tomorrow morning to call Avery | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 57 | Leads | How many new leads came in yesterday? | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 58 | Leads | Find all leads asking for linen suits | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 59 | Founder briefing | Give me a concise briefing on leads, ads and overdue follow-ups | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |
| 60 | Conversation | Keep going with the next page | **Unavailable SMS tool**: That action is not available. I can remember preferences, change signup text format, look up leads or log a new feature. |

## Seven phrasing misses with correct scripted routing available

- LEAD Avery Stone please → No exact fixture contact matches. Clarify the name.
- THREAD Avery Stone please → No exact fixture contact matches. Clarify the name.
- What did you text Avery Stone? please → No exact fixture contact matches. Clarify the name.
- ACTIONS please → No exact fixture contact matches. Clarify the name.
- ACTIONS / Keep it concise. → No exact fixture contact matches. Clarify the name.
- ACTIONS Avery Stone please → No exact fixture contact matches. Clarify the name.
- Send the booking link to Avery Stone please → No exact fixture contact matches. Clarify the name.

## Exercised multi-turn contracts

- Durable memory, restart and account isolation (2 exchanges).
- Pronoun reference retains exact earlier contact (2 exchanges).
- Corrected lead preview supersedes old confirmation (4 exchanges).
- Exact reviewed client text, explicit SEND and duplicate SID (4 exchanges).
- All-lead pagination is durable, scoped and a stable snapshot (9 exchanges).
- Response preferences are supplied to subsequent turns (2 exchanges).
- Signup format uses actual lead fields (2 exchanges).
- Unsupported feature logging does not activate a capability (2 exchanges).
- Malformed model output and model-created SEND cannot mutate (2 exchanges).
- Forged sender, binding takeover and unavailable account remain isolated (2 exchanges).
