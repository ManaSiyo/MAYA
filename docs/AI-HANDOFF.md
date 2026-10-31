# Current handoff — October 30, 2026

## Active owner request and release state

Fix Fabrics' slow/repeated searches, local-only results and disappearing loaded
cards; use Glass as the only pill family, fix the tall Operation Room selector,
remove the internal Studio preview entirely, and make WR Applicants the same
shared table as Admin. Check Google and ChatGPT ad reporting without changing
campaign state or spending. Owner retains Push. No personal Chrome, microphone,
live fabric/provider or ad mutations were performed in this change.

Baseline 43cddf822a1a14331094633ef8d17b14c5547322 was verified live: Cloud Build
cd73c38b-faf9-4e45-91d6-3177b053e501 succeeded October 30 at 1:26 PM Pacific
(19m27s). Hosting release marker, pages, API commit and affected public asset
bytes matched. Earlier notes about production remaining 3873ced are historical;
those prior WR/card fixture deployment blockers are resolved. This new overhaul
is local until the owner's next Push and exact deployed verification.

## Implemented

- aesthetics/ui/fabric-assistant.js: bounded memory-only confirmed-results cache
  for the current account/submission; key includes canonical garment metadata,
  preferences and exact reference. Garment returns restore without paid work;
  Refresh retains old confirmed cards and merges additional checked URLs. Empty,
  failed or cancelled refreshes cannot erase prior results. Changed requests and
  photo contexts discard incompatible sets. Actual account/project changes clear
  private state. Inventory/lookbook hydration no longer repaints Sourceable cards.
  All five visibly selected merchant groups are sent on initial requests.
- docs/server/fabric-{search,discovery}.mjs and fabric-retailers.mjs: balance
  candidates by approved merchant host before the eight-item cap. Direct seeds
  cover all five existing Shopify merchants (up to two queries each). Web output
  accepts up to sixteen cited candidates before balancing; web wait drops from
  35s to 20s. Node 20 combined-signal WeakMap retention remains. Seller facts,
  exclusions, canonical crops and one visual attempt of at most eight remain.
  No weak/unverified fallback, additional paid retry or shared private cache.
- Shared pill-runtime.js, typography-controls.js and gallery: one Glass editor
  and material for every pill, including Edit. Legacy regularPill is accepted by
  the server only for old saved schemas, ignored at runtime and omitted on new
  saves. Selected/hover white rims, semantics and keyboard focus remain. Native
  garment select follows shared P3 and saved Glass X/Y padding instead of row
  stretch; hidden voice UI retains its own visibility rules.
- Removed backend/design-studio-2.html, its UI CSS/JS, Hosting mapping, Admin
  Systems link and Aesthetic Control sample. Removed its positive demo test/gate
  and added absence assertions. Historical records are not rewritten. External
  advertising campaigns named Design Studio are unrelated and unchanged.
- WR Applicants table is primary with Wave/Number/Name/Look/Color/Email. Add
  applicant is collapsed below it. Removed the local table alignment override;
  default and changed table/header styles are compared directly with Admin.
- New docs/server/ad-reporting.mjs uses the existing Google configuration and
  supported v26 read endpoint, bounded pagination, account-local completed days
  and direct campaign/chart fallback when Windsor has no Google rows. It ships
  in Dockerfile. Admin honors reported PAUSED/ENABLED status before historical
  impressions and shows explicit connection availability using shared P1/Table.
  Empty charts distinguish missing time-series rows from connection setup and
  direct readers to the available campaign table without environment-variable copy.
  A ChatGPT Ads Manager link is available; no unsupported Ads API was invented.
- Brief/Operations/gallery fabric assets now use v6; exact no-cache rules stay.
  WR CSS uses v3. Typography role usage was regenerated after removing the page.
  Release/app-regression fixtures and the governing authority cover these paths.

## Live ad observations and remaining prerequisite

Read-only Ads Manager: Mana Siyo INC's “Capaign 1: Design studio” reports active,
with no serving issues. Windsor Google Ads: Mana Siyo's “Campaign 1 - Design
Studio” reports PAUSED in the 30-day data; the 7-day report had no rows. Empty
report rows do not prove account configuration or current delivery. No campaign,
budget, billing or production configuration was changed.

The owner pasted an apparent secret instead of reporting API documentation.
It was not echoed, used, stored in the repository, or installed. Owner was told
to revoke/replace it through its provider. Credentials/environment remain owner
controlled. A key alone does not establish a supported ChatGPT Ads reporting
contract: actual reporting documentation/redacted schema and owner-managed
connection setup remain required. MAYA explicitly reports that connection as
unavailable; connector snapshots are not hardcoded into dashboard metrics.

## Validation and exact next step

Locked npm ci completed. All 74 functional/syntax commands from current
cloudbuild.yaml pass under Node 20.20.2, including rerun retired UI/asset
expectations; integrated app-regression and server smoke pass. Forced-GC fabric
tests also pass on local Node 24. Browser fixtures use isolated Chromium,
synthetic records and fake providers; they establish no live merchant relevance,
paid API latency, microphone quality or real-device behavior. The final standalone shared Aesthetic Control gate passed last, with
default/changed saved styles, actual Save propagation and six responsive widths.
Default and changed WR, Glass/gallery, Ads copy and Operation Room selector
screenshots were visually inspected. No visible mismatch remains in the fixtures.

Next: the verified task is prepared for a local commit; Fromsa retains Push.
Never Push without the owner's explicit request. After owner Push, inspect the exact Cloud Build and verify release.json, App/Admin/API
commit plus affected v6 assets/cache policies before calling the changes live.
Live testing remains stopped; any future personal Chrome access needs a fresh
session-specific permission notification and explicit approval.
