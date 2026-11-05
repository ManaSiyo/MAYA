# Current handoff — November 4 Admin update and fabric classification

## Owner request and implementation

Admin now has Settings and Messages. Insights and the Logs/Notifications tab,
diagnostic loader, client history polling and fixed-state notification writes are
removed. Private server history/audit stores and endpoints remain unchanged.
Real failures stay beside the affected feature, after campaign data; account
changes clear the notes. Active voice conversation and pending approvals remain
in Settings, with the existing reviewed-action dialog and send safeguards.

Settings headings explicitly use H3 (16px default), Outside Tools is Add Tools,
and Twilio links to https://console.twilio.com/ under Behind the scenes. No
credential, account, billing or production setting was opened or changed.

Admin and Brief now render the same submission image component. The Admin strip
keeps its existing horizontal layout; Brief scales the same 3:2 card to its drawer
width, with contained photos and no name-only rows or added metadata overlay.
Private thumbnail requests bind to account and drawer generation; stale list or
image responses cannot return after account changes, A→B→A or a later open.
Same-account token renewal preserves cards. The legacy local-folder path remains.

The authenticated listing marks exact repeats only when the complete authored
file set, names, MIME types, sizes and MD5 checksums match, and verified marker
owner/client/project identity agrees. Derived one-pager exports are excluded.
Unknown checksums/markers remain separate. Legacy markers lack project IDs, so
complete identical payloads within the same owner/client can be grouped; distinct
explicit project IDs never group. All canonical IDs/files remain in the listing
and direct Brief reads; nothing is deleted, merged or redirected. This is display
deduplication, not upload idempotency. Existing first-40 listing limit remains;
marker reads are bounded to rendered/name and potential-repeat candidates.

The existing Drawer preview now contains the real shared submission card and
Settings H3 headings. Inner/Drawer/H3/Glass/Scrollbars remain the authority, with
no new saved design key. The legacy sectionSpacing.insights key now controls
closed Recent changes/Feature requests, labeled Closed sections. Open geometry
is unchanged. Shared presentation references are v4; submission assets are v1
and explicitly revalidated. Fabric v12 and In House/Global parity are unchanged.

Fabric qualification previously rejected every title containing “pattern”,
including floral/paisley apparel yardage. It now distinguishes genuine sewing,
knitting, PDF/downloadable patterns from fabric. The regression checks accepted
patterned yardage and rejected patterns, while all source, color, exclusion,
cancellation, photo-origin and private-cache safeguards remain. Empty-result
copy names existing Refresh, not a removed refinement control. No automatic paid
retry, additional provider, source-site fetch or cosmetic fabric change was added.

## Files and verification

Runtime: backend/{status,backend}.html; aesthetics/ui/submission-cards.{js,css};
docs/server/{submission-list.mjs,server.js,Dockerfile,fabric-sourcing.js,
fabric-worldwide.mjs}; shared presentation runtime and Aesthetic Control Drawer/
spacing previews. Other served pages only receive presentation-runtime v4.
Hosting headers revalidate the new shared assets. Typography role counts were
regenerated. Cloud Build/app-regression/final authority require the new submission
unit/UI gates. Existing Admin tests now assert retirement instead of demanding
removed tabs/history, preserving actual blocked-GIS failures and all reviewed
owner/send/account guards. Backend private-history tests remain unchanged.

Focused grouping, cards, account races, Admin retirement, Systems, provider
feedback, typography, spacing and saved-design propagation pass. The image cards
and Settings were visually inspected under defaults and materially different
valid settings at phone/desktop; computed geometry checks cover six widths.
Root locked npm ci --ignore-scripts and typography generation pass. Worldwide
(30), search (57), sourcing (18) and forced-GC pass on Node24.22.1; Node20.20.2
fabric equivalents pass in the release suite. Isolated browsers and fake providers
are used for all automated tests; no personal Chrome was accessed.

All 80 functional/syntax Cloud Build commands, full app-regression and smoke
pass (82 required checks, including the focused reruns). Retirement-related old
assertions and a function-extraction fixture boundary were updated to the actual
new UI; the complete regression rerun ends “all passed.” Final standalone
Aesthetic Control passed last after all functional verification and presentation
edits (Node20.20.2; /private/tmp/maya-admin-final-authority.log). The verified
changes are prepared as a local commit; only owner Push and live acceptance remain.
Local evidence logs/captures: /private/tmp/maya-admin-gates-summary.log,
maya-admin-reruns-summary.log, maya-admin-regression-final.log,
maya-cards-final.log, maya-admin-node24-*.log,
maya-cards-{admin,drawer}-{default,saved}-{390,1440}.png,
maya-admin-settings-{default,saved}-{390,1440}.png and
maya-cards-active-preview.png. Photos in local UI fixtures are inventory samples,
not live search acceptance.

## Live evidence and exact next step

The owner pushed previous gallery correction 3663a5d154390cf8313afa86fd60c8e99d6114fe.
On November 4, Hosting release.json and API health both reported that commit;
Hosting publishedAt was 2026-11-04T20:54:07.431Z. Authorized internal-browser
inspection of the saved hooded tailcoat reproduced a completed search with zero
source-backed cards and no browser errors. The prior five-photo run on 105860b
was a single successful run, not proof of consistent current provider results.
The “pattern” rejection is reproduced locally; without that live provider's raw
result trace it is not proven to be the sole cause of the empty run. No claim is
made about ChatGPT's private internals or identical latency/reliability.

Prepare the verified local commit only; owner controls Push. After Push, verify
successful Cloud Build and exact Hosting/API commit, then test the same saved
hooded tailcoat and the reported duplicate submissions on the actual account.
This local repair does not prove deployed Fabrics result quality or that an
unverified pair with different authored content should be hidden. Do not silently
relax exclusions, scope, source/photo evidence or retry a paid search automatically.
