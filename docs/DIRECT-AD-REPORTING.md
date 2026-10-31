# Direct advertising reports

MAYA reads advertising data directly from Google Ads, Meta Marketing API and
OpenAI Advertiser API. It does not call Windsor, read its key, or fall back to it.
Retired external accounts/grants/secrets remain owner-managed; this change does
not alter them. All routes remain Admin-gated. Campaigns, bids, targeting,
conversion settings, ad content and budgets are read-only here.

## Owner setup

Only Fromsa handles production credentials and environment settings. Do not paste
keys into chat, commit them, put them in browser code, or reuse the exposed key.
No credentials were read, installed or changed by this repair.

Google uses the existing GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID and
optional GOOGLE_ADS_LOGIN_CUSTOMER_ID configuration. The server refreshes OAuth
and reads the v26 search endpoint with bounded pagination.

Meta uses the existing META_ADS_TOKEN and META_AD_ACCOUNT_ID. Tokens travel in
Authorization headers. Account currency/timezone and campaign inventory are read
directly; daily campaign rows feed the shared chart/table. Seven- and thirty-day
reach/frequency are provider aggregate values, never sums of daily reach.

ChatGPT uses OPENAI_ADS_API_KEY and OPENAI_ADS_ACCOUNT_ID, configured by the owner
on the server. This must be an **Advertiser API key scoped to the intended Ads
account**, not the model/Realtime OPENAI_API_KEY. The reader first calls
GET /v1/ad_account and checks its ID against the configured account. A mismatch
fails closed before campaign/report reads. Missing setup is visible in Admin.

Official contract checked October 31, 2026:
- https://developers.openai.com/ads/api-reference/authentication
- https://developers.openai.com/ads/api-reference/ad-account
- https://developers.openai.com/ads/api-reference/campaigns
- https://developers.openai.com/ads/api-reference/insights

Reports use GET /v1/campaigns and GET /v1/ad_account/insights at
https://api.ads.openai.com. Canonical projected fields use campaign.id/name/status,
metadata.readable_time and campaign/ad_account metrics; flat wire keys are parsed.
The daily account report preserves the provider's CPC, which can differ from
recent spend divided by clicks while costs finalize. The table explicitly labels
its CPC calculation as spend divided by link clicks for that selected window.
No goal conversions are relabeled as leads. Attribution parameters are explicit:
30-day click, 1-day view, ad-event time. This does not change campaign goals.

## Reporting behavior

Each provider has an 18-second request budget. Paginated reads cap at ten pages;
a missing/repeated cursor, invalid response or incomplete report fails instead of
publishing partial totals. Provider-supplied next URLs are never followed with
credentials. ChatGPT/Meta account IDs are verified before reporting. Provider
errors are reduced to safe categories rather than reflecting raw response bodies.

Marketing and the voice snapshot share an in-flight request and a 60-second
server-memory cache per configured provider; failed connection checks cache for
10 seconds. No account/project records or keys enter browser storage. One failed
provider leaves other direct reports available. The fixed configured advertising
accounts are owner-wide Admin sources, not client project data.

The chart has thirty completed calendar days. W uses the last seven completed
days, M thirty and D two; periods use each provider account's timezone, with the
combined calendar in America/Los_Angeles. Differences between account timezones
remain explicit rather than claiming UTC-aligned activity. Missing current-day
reports are unavailable in Maya's context, not yesterday relabeled as today.
Campaign identity includes provider plus campaign ID, keeping duplicate names
separate. Current inventory supplies paused/active/inactive state and zero-
delivery campaigns. Google retains the existing campaign search coverage; it does
not claim that absence of a delivery row proves a serving block.

The existing dollar dashboard combines USD only. Unknown or different currencies
remain explicit exclusions; no exchange rate is invented. Confirmed reporting
configuration does not prove delivery, tracking completeness or live credential
health. Local fixtures cannot establish production account access.

All added reporting appears in the existing Ad campaigns Table, chart/legend,
P1 connection note and shared controls. No new style family or editor exists.
Run tests/ad-reporting.mjs (Node 20 and local Node), tests/ad-reporting-ui.mjs,
admin-ui-contract, admin-command, exact release checks, integrated regression and
smoke. Final aesthetic-authority reexecutes the direct Ads UI fixture with changed
saved Table/P1 settings at six widths. Push remains owner-controlled; verify the
exact Hosting/API commit after deployment, then authenticated provider reporting.
