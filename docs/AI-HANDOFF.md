# Current handoff — October 31, 2026

## Owner request and release boundary

Fromsa clarified that every table must use the same Aesthetic Control aesthetics,
with independent data. WR should currently be empty. He also asked to dive into
Fabrics and undo the bottlenecks that made it less responsive.

Working branch maya-v2 was clean at 03311d3, one commit ahead of origin. That
October 30 overhaul is still local. The last verified deployed baseline was
43cddf822a1a14331094633ef8d17b14c5547322 on October 30, Cloud Build
cd73c38b-faf9-4e45-91d6-3177b053e501. This task does not Push or deploy.
No personal Chrome, microphone, paid fabric/provider test, credentials or
production configuration was accessed. Live acceptance remains stopped.

## WR repair

WR's applicants were already in private account-bound WR storage, but its gallery
incorrectly fetched /api/admin/submissions and client thumbnails. Removed that
Admin-data connection and its thumbnail queue from aesthetics/ui/wr.js. The page
now starts with an empty WR gallery and reads only its own WR applicants. Opening
it never inserts sample records. Existing deliberately saved WR records remain;
no production records were deleted or hidden by a new storage namespace.

All tables still use the existing global Table material/header/body settings.
No alternate table style, token or editor was added. WR retains Wave, Number,
Name, Look, Color, Email and its collapsed Add applicant form. Loading/error
states appear outside that form; a failed or invalid read cannot claim an empty
workspace, and stale read failures cannot replace a newer request. The served
WR script reference is v3. tests/wr-ui.mjs supplies populated Admin fixtures but
requires zero WR reads of them, zero thumbnail requests, zero sample writes,
independent explicit applicant saves, visible read failures, and default/changed
saved settings at six widths.

## Fabric bottlenecks reproduced and removed

- A held keyword-feed fixture reproduces the serial barrier: web-discovered
  seller checks did not start until every seed operation finished. They now start
  immediately after discovery and overlap the seed branch. Exact duplicate URLs
  share a verification promise within that request only, with separate candidate
  reasons and garment qualification. No private cross-request result cache or
  extra paid provider attempt was introduced.
- Optional Shopify price/unit metadata could consume the remaining eight-second
  seller budget even for an otherwise valid listing. It now gets at most 1.2s
  inside that budget. Known swatches, unavailable and non-fabric pages skip this
  unnecessary enrichment. Fast variant prices still work; selected swatches remain
  rejected and unknown facts remain blank. Main seller/redirect bounds, the Node
  20 WeakMap lifetime guard and one visual pass of at most eight are unchanged.
- Retaining product arrays did not retain their DOM: paint rebuilt loaded cards
  during Refresh. Unchanged cards/images now stay mounted, including while more
  results arrive. Explicit Refresh retries failed photos without replacing healthy
  images. It does not loop failed-image retries automatically.
- At most two prepared reference photos are reused within the current account /
  submission, avoiding repeated fetch/decode/resize for unchanged garment context.
  Explicit reset/new reference invalidates the relevant preparation; account/project
  changes clear it. Completed empty contexts can be reused for 30 seconds on a
  return, avoiding another automatic paid search. Refresh remains explicit.
- Safe timing now starts before saved-context reads and firstResultsMs describes
  checked results, rather than the earlier hidden preliminary-candidate event.

Changed runtime paths: aesthetics/ui/fabric-assistant.js, aesthetics/ui/wr.js,
backend/wr.html, docs/server/fabric-search.mjs. Updated fabric server/workflow,
WR and app-regression fixtures plus AGENTS, design, FABRIC-SEARCH, README,
requests/fixes and COMMIT-REVIEW. Typography usage metadata was regenerated. No new visible component or visual authority.

## Validation and remaining work

Locked npm ci completed. All 74 functional/syntax release gates and the latest focused WR/fabric checks
have passed; integrated app-regression and final server smoke also pass. The fabric server
suite has 53 behavioral checks, including held transport overlap/deduplication,
short optional metadata deadlines, fast variant facts and swatch/stock rejection.
Forced-GC deadline fixtures pass on release Node 20.20.2 and local Node 24.
The full fabric UI workflow passes at 4x CPU, including actual image-node identity,
prepared-photo reuse, empty-result reuse and account/project cancellation.

The retry fixture now explicitly sets its own response instead of depending on
a prior image-failure scenario. Final standalone Aesthetic Control passed last with default/changed saved
settings, real Save propagation and visual review. The empty WR default/changed
screenshots were inspected; all changed elements follow the existing controls. These are fake
providers and synthetic data: no assertion establishes live seller relevance,
paid-provider speed, microphone quality or current production behavior.

Next: the verified change is prepared as a new local commit without amending
03311d3. Fromsa retains Push, which publishes both local commits. After owner Push,
verify the exact Cloud Build, release.json, page/API commit and shared asset bytes /
cache headers before calling these repairs live. Fresh session-specific permission
is required for any future personal Chrome access.

## Separate unresolved ad setup

The October 30 Google reporting / Glass / Studio removal changes remain in
03311d3. ChatGPT Ads reporting still needs a supported reporting API contract and
owner-managed setup. A key pasted earlier was not used or stored; owner was told
to revoke it. No campaign state, spending or external account setup changed here.
