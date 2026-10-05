# MAYA handoff — October 5, 2026

## Current request: known message names and compact model hover cards

Started clean at 1311620, matching origin/maya-v2. Messages preserve the known
Lead name when an inbox response has a blank or generic Caller name. Unnamed
threads resolve an exact phone match from the current account's loaded Leads,
with US country-code normalization and no guessed name when matches conflict.
Manual/real thread names remain preferred. Call transcripts label client turns
with that same known name (or phone), including outbound client calls.
No automatic rename write or authorization change is introduced.

Model Snapshot groups repeated models into one model line with comma-separated
uses. Provider summaries include model/transport; endpoint details expand only
on click, not hover/focus. Compact cards cap at 340px and remain viewport bounded.
Admin Systems asset refs advance to v3; no configured models are changed.

## Changed paths and validation

backend/status.html; aesthetics/ui/admin-systems.js/css; admin-systems-ui and
app-regression; design/requests/fixes/COMMIT-REVIEW. Validation passed: full
app-regression, compact cards at seven widths/landscapes, authenticated name
retention/phone matching/transcript labels; fake phone (57), messages (55),
transfer and feedback suites. Git diff checks passed. Logs are in
/private/tmp/maya-name-{hover-regression,phone,communications}.log.

## Exact next step and remaining live verification

Verified changes are prepared as a local commit. Fromsa pushes
from GitHub Desktop; no push is authorized. After deployment, verify lead-name
message navigation and compact provider hover cards. Actual Gmail connection and
Gemini/image inference remain unverified. No personal Chrome session used here.

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
