# MAYA handoff — October 5, 2026

## Current request: owner SMS lead access and usable phone-to-text numbers

Started clean at 5ce96f0, two local commits ahead of origin/maya-v2. Screenshot
shows "Send me the last 5 leads" returning a generic uncertain-result reply and
phone-requested numbers arriving as spoken words. No live trace was accessed, so
the exact provider failure behind that SMS is not proven.

Common newest-lead/count and contact-number SMS requests now bypass text AI.
Examples: Send me the last 5 leads, LEADS 5, Text me the latest five leads,
What's Nick's phone number? Requested counts are validated 1–20, default 5.
Owner binding/signature checks remain; no client write/send is authorized by a
read phrase. Lead lists use durable account-scoped report pages with MORE.

Phone owner_control text_owner now offers live leads/contact report selectors;
the server fetches numeric contact fields instead of accepting dictated contact
prose. Generic legacy owner text normalizes complete spoken plus-number sequences
into digits. Voice/audio style is explicitly separate from SMS formatting.
Non-retryable send claims and fixed owner recipient remain; carrier acceptance
still does not prove delivery. Conversational AI failures identify the unavailable
chat path and the working direct read commands instead of implying a failed send.

## Changed paths and validation

owner-conversation.mjs, owner-sms-access.mjs, maya-phone.mjs; tests for conversation,
SMS access and app-regression; AGENTS/requests/fixes/COMMIT-REVIEW.
Passed: AI-down natural lead reads, requested count, numeric contacts, paginated
continuations, grounded owner phone text and duplicate-send prevention; owner-crm,
phone (57), messages (55), transfer/feedback and container contract. Full app-regression passed; final focused conversation/SMS suites also passed. All providers fake; no real SMS/call, credentials or production changes.

## Exact next step

Verified changes are prepared as a local commit. Fromsa pushes all three local commits.
After Cloud Build deploys, verify live release.json, then SMS "Send me the last 5
leads" and request a lead-number text on an owner call. Live delivery/voice model
choice still requires owner verification. No personal Chrome session used here.

Prior live owner verification remains: MAYA HELP/INBOX/THREAD Nick/MORE/ACTIONS,
normal memory recall and separately authorized client REPLY/SEND; scheduler/signup/
booking alerts, microphone wake/audio, SMS delivery/carrier receipt and owner transfer.
Read docs/OUTBOUND-SETUP.md for owner-only connection/setup steps. No automatic
sending was introduced; account/project boundaries remain sealed.

## Standing constraints

Ask and wait before each user Chrome session; never use Chrome while Fromsa works
in it. MAYA and Worldofsiyo profiles are separate. Keep project/account data
sealed; no credentials, billing, production variables or legacy migration/Storage
cleanup changes. docs/design.md is the sole active design specification.
Approved booking URL: https://wix.to/wT2lSqE.
