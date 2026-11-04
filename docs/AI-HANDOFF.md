# Current handoff — In House / Global gallery correction

## Owner request and implementation

The owner rejected the unrequested Dictate/Find fabric/refinement controls and
layout changes. Sourceable is now named Global in the gallery, shared segment
preview and frontend choice. Internal sourceable schema values remain compatible.
In House itself is unchanged and is the permanent visual baseline: Global uses
its exact grid, viewport, scrolling, card/photo dimensions and two single-line
caption rows. Both actual Brief and Operation Room entry points are automatic.
They show only In House, Global, Favorites, Refresh and Expand/Collapse; no composer,
Dictate, Find fabric, refinement field, shop filter or interpretation/details strip.
The existing Refresh action cancels an active search; there is no added Stop pill.

Exhausted Global photographs retain private source evidence for late recovery and
retraction but are hidden from the gallery. When none load, an honest empty message
offers explicit Refresh. Healthy images and partial results remain. Four validated
source URLs/eight-second image deadlines, unsafe URL rejection, account reset,
late color/exclusion retractions and no automatic paid retry are unchanged.
Legacy nonautomatic manual/retailer APIs and private Favorites remain compatible
and tested; they are not exposed as another saved-garment UI.

Aesthetic Control has one active Fabric gallery using the real shared card classes,
with In House/Global toggles and existing inventory photos explicitly labeled as
layout samples. It exercises scrolling without provider calls. Shared H4/P3,
Inner, Glass and scrollbar settings remain the authority; no saved schema/editor
was added. Fabric JS/CSS references are v12. AGENTS.md and docs/design.md explicitly
supersede the earlier composer/interpretation/missing-link layout instructions.

Runtime files: aesthetics/ui/fabric-assistant.{js,css}, aesthetic-control.html,
aesthetic-control/{workspace-previews.js,gallery.css,shared-surfaces.js},
backend/{backend,operations}.html and frontend/index.html. The new exact gallery
regression is tests/fabric-gallery-ui.mjs, required in cloudbuild.yaml,
app-regression and final aesthetic-authority. Existing UI/image/workflow/preview,
asset-version and segment fixtures follow the corrected visible contract without
removing provider, recovery, auth, cache, save or cancellation safeguards.
Continuity: AGENTS, README, FABRIC-SEARCH, design, requests/fixes and COMMIT-REVIEW.

## Live photo evidence — separate from this local layout

Previous photo correction 105860bbd6e0c675f8eff2c9846efcdeafbb2f42 passed Cloud Build
(build ef099c46-7832-4b19-b38e-cd732341a6b8, completed 2026-11-04T04:59:07Z).
At 05:01 UTC Hosting release.json and API health both reported that commit;
release publishedAt was 2026-11-04T04:58:05.508Z. After reloading the same saved
Hooded tailcoat in the authorized internal browser, opening Fabrics with no typed
refinement returned five cards and all five images loaded (naturalWidth > 0).
Sources: texgid.ru, pendragoncostumes.com, okadaya.co.jp, tissus-en-ligne.com and Etsy.
The Tissus photo used the provider-linked thumbnail fallback. Screenshot:
/private/tmp/maya-live-default-five-photos.png. This is actual default-search
acceptance for that garment, not a guarantee for every source or twelve results.
That screenshot still has the old production layout; do not present it as this
local gallery correction. No personal Chrome, credentials or production settings
were accessed. No new backend/provider code is changed in this task.

## Validation and exact next step

Focused gallery, search UI, image recovery and full workflow checks pass. Exact
In House/Global geometry, two captions, controls, scroll positions and typography/
materials match at 320/390/768/1024/1440/1920 under defaults and valid changed saved
settings, inline and expanded. Explicit failure/recovery makes no automatic provider
retry. Default phone and changed desktop captures were visually inspected:
/private/tmp/maya-global-default-390.png and maya-global-saved-1440.png are local
layout fixtures with existing inventory photos, not live seller search results.
Root locked npm ci and typography role regeneration pass (counts unchanged).
Worldwide (29), search (57), sourcing (18) and forced-GC pass on Node24.22.1;
Node20.20.2 equivalents are in the release run. All testing uses fake providers
and isolated temporary headless profiles except the explicit live default search.

All 78 functional/syntax Cloud Build commands, full app-regression and smoke now
pass (80 checks including targeted/full reruns). Three initial fixture contracts
were corrected: keep preview-only CSS in gallery.css, use Global in the segment
fixture, and expect Fabric v12 in the deployment assertion. Namespace and segment
reruns pass; the full app-regression rerun ends “all passed.” The final gallery
check also verifies changed saved styles and responsive no-photo empty states.
Final standalone Aesthetic Control passed last, after all functional checks and
presentation edits (Node20.20.2; /private/tmp/maya-global-final-authority.log).
The prepared local commit contains only this correction; working tree is clean
after commit. Only the owner's Push and exact deployed layout acceptance remain.

Owner controls Push. After Push, verify successful Cloud Build and exact Hosting/
API commit, then inspect Global on the saved garment. Local layout verification
does not prove deployment. No Push, private project/lookbook mutation or provider
configuration change.
