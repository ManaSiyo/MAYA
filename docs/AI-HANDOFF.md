# Current handoff - October 31, 2026

## Setup follow-up - current work

Owner reports Ads "not configured" and requests completing direct setup. Public
release.json, Admin build stamp and API health all report
7232f508944c4510a9696ec39bef361f09b27f7d (published October 31 21:43:36 UTC).
The missing-configuration state is on the new direct build, not an older release.
Owner declined Chrome access for this setup and says a key was supplied last
night. No Chrome access is authorized. Key source (Ads Manager versus Platform)
and presence of OPENAI_ADS_API_KEY / OPENAI_ADS_ACCOUNT_ID in Cloud Run were
requested without values; those answers are pending. The pasted key was not
installed or used. Only the owner handles credential entry. No production
configuration or live Ads report has been accessed in this follow-up.

Found an actual adapter/setup bug while checking current Google documentation:
Google retired developer tokens September 9, but the reader still required dev
and sent the old header. Remove that preflight requirement/header and the unused
GADS env read. Keep OAuth/client secret/refresh/customer requirements and optional
manager login ID. Missing OAuth config now returns safe field names and a
not_configured code to authenticated Admin diagnostics, without values. Fixtures
assert no token required/sent, no manager needed for direct account access, and
missing OAuth fails before fetching. Node 20/24 focused tests, all exact functional release gates, complete integrated
regression and smoke pass. Final standalone Aesthetic Control passed last. A separate local commit is
prepared; owner retains Push and credential setup. Owner controls Push.
No new visible UI; existing shared authority remains required.

Next: owner Push for the Google correction; obtain the pending key-source and
Cloud Run setting-presence answers, then guide owner-entered secrets and Cloud
project access without any Chrome control. The direct Ads Manager connector
confirmed the sole accessible account is Mana Siyo INC; its account Settings
link was obtained without Chrome. No account configuration or keys changed. No credentials should be pasted into chat. Do not restore Windsor.

## Previous verified direct reporting change

### Owner request / release boundary

Fromsa retired Windsor and requires direct connections only for campaign reports.
The working branch was clean and synchronized at ac048354edb2826ce6e4bccde398dfd92ebabe1e.
Its Hosting release marker and API health commit were observed matching after the
owner's Push earlier October 31. Prior WR independence, fabric responsiveness,
Glass-only controls and Studio removal remain intact. This task does not Push.

No owner Chrome, microphone, paid fabric search, production credentials or
environment settings were accessed. No advertising campaign, goal, audience,
ad, spending limit, budget or provider account was changed. A previously pasted
key was not used or stored; owner must manage its revocation. Live fabric/voice
acceptance remains stopped at the owner's request.

## Direct reporting change

- docs/server/ad-reporting.mjs owns read-only Google, Meta and ChatGPT reports.
  Google retains its existing owner configuration and v26 GAQL campaign report.
  Meta uses its existing token/account and direct account metadata, independent
  seven/thirty-day reach/frequency aggregates, daily campaigns and current states.
  ChatGPT follows the official OpenAI Advertiser API contract checked October 31:
  /v1/ad_account, /v1/campaigns and /v1/ad_account/insights at api.ads.openai.com.
- ChatGPT requires owner-installed OPENAI_ADS_API_KEY and OPENAI_ADS_ACCOUNT_ID;
  the model OPENAI_API_KEY is not reused. Account identity is verified first.
  Meta identity also verifies its configured account. No credentials installed.
  Missing/failed reporting stays visible; raw provider bodies and keys stay out
  of responses. Provider pagination is bounded and partial reports fail closed.
  Returned next URLs are never followed with credentials.
- Removed Windsor's runtime calls, fallback, environment-key read and MCP
  configuration field. Updated Maya's architecture description. Retired external
  account/grant/secret cleanup remains owner-managed. No external setup changed.
- Marketing and command snapshots share each provider's in-flight read and short
  server-memory cache (60s success / 10s failure). Sources fail independently.
  USD is combined only with USD; other/unknown currencies are explicit exclusions.
- Combined data uses thirty completed calendar days and provider account timezone
  reporting. A missing current-day report is unavailable, rather than yesterday
  mislabeled as today. Google/Meta/ChatGPT feed Admin and Maya's snapshot together.
- Campaign table identity includes provider plus ID, so identical names do not
  merge. Current inventory preserves active/paused/inactive/zero-delivery objects.
  Known inactive states cannot become "delivering" from old impressions.
  ChatGPT is included in the existing chart, legend, ticker and totals. Account
  daily CPC preserves provider values; table CPC labels its spend/click calculation.
  No conversion count is relabeled as a lead count.

## Shared aesthetics / tests

The existing Table, chart/legend, P1 note and Glass controls govern all reporting.
No new editor/material family or page CSS authority. Role usage was regenerated.
The new ad-reporting-ui fixture checks ChatGPT-only reports, duplicate names,
zero/paused/archived states, D/W/M, connection failures and different valid saved
Table/P1 settings at six phone/tablet/desktop widths. It runs through the existing
admin-ui-contract release gate, app-regression and final aesthetic-authority.

Server fixtures exercise exact provider URL/headers/fields, pagination/caps,
identity mismatch, missing/auth/empty states, currency isolation, separate Meta
link clicks/aggregate reach, cached concurrent reads and current-day unavailability.
The lead-feed-latency test extracted code using a retired Windsor-adjacent comment;
it now uses the explicit Marketing route boundary and asserts that boundary. All
lead assertions are retained. Historical literal Windsor assertions were replaced
with direct reader/connection contracts; no functional gate was removed.

Validation: focused ad-reporting passes on release Node 20.20.2 and local Node 24.
All exact functional/syntax release gates pass, as do the complete integrated
app-regression and server smoke. Focused admin-ui-contract, pill consistency,
admin-command and lead-feed-latency pass. Direct Ads UI verifies an actual
Admin-authenticated design Save from a separate Aesthetic Control page, then
computed live styles at six widths. Default/changed Ads screenshots were visually
inspected. Final standalone shared Aesthetic Control passed last before commit.
These are fake providers/synthetic accounts; they do not prove live API access.

## Exact next steps / limitations

Functional verification, visual review and final standalone aesthetic-authority
are complete and passed. Prepare the verified local commit without amend or Push. docs/COMMIT-REVIEW.txt records the final prepared change and validation.
Owner handles direct provider credentials per docs/DIRECT-AD-REPORTING.md. A local
fixture does not establish live API-key health, account access, ad delivery or
conversion completeness. After owner Push, verify Cloud Build, Hosting/page/API
commit and authenticated direct reporting before claiming this release is live.
Fresh per-session permission is required for future owner Chrome access.
