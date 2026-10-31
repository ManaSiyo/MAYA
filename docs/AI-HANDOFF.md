# Current handoff - October 31, 2026

## Current owner request / boundary

Fromsa requires code-based Ads diagnosis without any access to his Chrome. He
also reports mixed gray/white scrollbars and wants all visible scrollbars governed
only by Aesthetic Control. Do not ask to use Chrome again for this task. Owner-only
credential entry and no automatic Push remain in force. No keys from chat were
used or installed. No microphone, paid fabric search, private provider report,
credential value or browser profile was accessed. No campaigns, accounts or
production environment settings changed. Public HTTP reads covered release,
health and saved scrollbar settings only.

Started clean at 5a46e07, one local commit above origin/maya-v2 7232f50. Public
release.json and API health still report 7232f508944c4510a9696ec39bef361f09b27f7d
(published October 31 21:43:36 UTC). Google’s retired developer-token correction
in 5a46e07 has not reached production. Do not call the new scrollbar or diagnostic
work live before owner Push and exact release/API/asset verification.

## Scrollbar cause / repair

Reproduced on the actual frontend styles with an isolated fake-provider renderer:
.fabric-pick-grid computed scrollbar-width:thin, overriding the shared WebKit
thumb rendering even while pseudo-element styles appeared to have the right
color. The new fixture fails the old code with thin != auto. It also measures
the actual rendered gutter, rather than treating pseudo-style values as proof.

Removed old page-specific thumb/track/hover palettes and visible thin-width
rules from frontend/index.html, backend/backend.html and maya-canon.css. Kept
intentional scrollbar-width:none/display:none navigation rules. Shared
presentation-runtime.js owns the low-specificity native-width defaults: thin/auto
in Firefox, auto in browsers using the shared WebKit painting. Page-level hidden
rules can still win; explicitly visible fields/content retain their shared
behavior. Operation Room's broad hidden rule has explicit specificity so its
existing hidden canvas/navigation behavior survives. Shared scrollbar buttons
have no separate native gray/white paint. No observer, custom drag surface, new
style family or second Scrollbars editor was added.

Every served page/gallery references presentation-runtime.js?v=2, retaining the
existing exact no-cache Hosting rule. Saved colors, width, corners, length,
track, idle hiding and high-contrast handling remain in the one active preview.
Typography usage locations were regenerated after removing CSS lines.

New tests/scrollbar-authority-ui.mjs checks absence of competing themes in active
sources, actual native/pseudo precedence and four-pixel gutter, two-axis saved
paint, keyboard movement, hidden frontend navigation, authenticated cross-page
Save propagation and six widths. It verifies shared styles on frontend, Admin,
Brief, Operations and WR. The existing input-controls fixture continues to check
idle/active states, changed saved settings, controls, forced colors and native
behavior. Default/changed fixture inspection uses isolated Chromium, not any
owner Chrome. Both default-paint and blue/green saved scrollbar screenshots were visually
inspected. Public /api/design reports the same version2 four-pixel, 50% length,
800ms idle, gray-thumb/transparent-track defaults used in the baseline; no live
design was saved or changed.

## Ads findings / safe diagnostics

The deployed "not configured" message is a preflight condition, before any
provider request. It establishes missing server configuration, not a paused
campaign or rejected API key. ChatGPT requires its own Advertiser API key and
pinned Ads account ID; the model OPENAI_API_KEY and the chat's Ads Manager
connection do not install those settings into Cloud Run. The previously supplied
key was never installed or used. Exact deployed setting presence cannot be read
from the older public health response; do not guess which variable is absent.
No authenticated Cloud Run CLI/session is available here, and Chrome is forbidden.

adSetupStatus in docs/server/ad-reporting.mjs returns only presence, fixed field
names and fixed human labels. Existing Admin marketing exposes detailed missing
setup under its authentication and no-store response. Public health adds only
three boolean flags (googleAds/metaAds/chatgptAds), never labels, IDs or values.
This allows future readiness checks through HTTP code without an owner's browser;
readiness is not proof of working provider authorization or campaign delivery.

Admin's existing shared P1 connection note now names missing settings. Actual
provider authorization failures stay separate: Google OAuth expired/revoked,
Cloud-project production approval, missing account access and missing Ads scope
have safe categories. All readers normalize unknown error codes; raw exception
text/provider payloads cannot echo a secret via a diagnostic code. No paid retry,
new credential endpoint or automatic account/budget/environment mutation.

The direct Ads Manager connector confirmed the sole accessible account is Mana
Siyo INC and supplied its account Settings link, without Chrome. Previous setup
questions about key source and presence were not answered. Do not repeat Chrome
requests; finish independent code work and retain the owner-only secret step.

## Validation / exact next step

Focused Ads diagnostics pass on release Node 20.20.2 and local Node 24. The real
scrollbar regression passes after reproducing the old failure. Input-controls
and the expanded direct Ads UI missing-state check pass with default/changed
shared styles across six widths. All providers/accounts/images are fake fixtures.
All exact functional release gates, complete integrated app-regression and smoke
passed. Final standalone Aesthetic Control passed last before the new local commit. The new
scrollbar fixture runs in admin-ui-contract, app-regression and final authority.

Verification and final authority are complete. Prepare the local commit without
amend or Push; COMMIT-REVIEW records the reviewed change. Owner Push publishes this commit plus 5a46e07. Then verify Hosting/page/API
commit and presentation-runtime v2 bytes/cache policy through code; public Ads
readiness and authenticated Admin diagnostics can distinguish remaining setup.
Only owner enters a valid Ads Manager key/Google OAuth configuration into the
server. No current code fixture establishes live provider credentials or delivery.

Preserve prior WR independent data, fabric verified-card continuity/Node20 GC
retention, Glass-only controls, Studio removal and all account/project safeguards.
