# Current handoff — November 3 live fabric photo correction

## Finding and implementation

Owner said “so fix it” after the exact deployed 116a11c release returned eight
source links with zero photographs for the saved green hooded tailcoat. Hosting
release and API commit both matched 116a11cceefb3820818ad33f0eda1eb7d102a23a;
release published 2026-11-04T03:25:20.940Z. This was not a stale deployment.

Using the authorized internal browser, one explicit refinement asked for image
search, photographs of dark forest green apparel yardage and the source pages of
those photographs, excluding upholstery/furnishing/decor. The existing live app
then displayed four loaded fabric images from Cali Fabrics, Etsy, Fabrics4Fashion
and Fabcurate, plus one photo-less Rex link. DOM naturalWidth was positive for all
four and the image was visually inspected. Proof:
/private/tmp/maya-live-fabric-photo-proof.png. No raw provider trace was captured;
we do not claim the previous request's images were discarded by the parser. The
mixed text/image task allowed citation-only recommendations; the focused request
proved the same live adapter/viewer can display source-linked photographs.

`docs/server/fabric-worldwide.mjs` now requests only image content from web_search,
and makes the successful explicit image-search direction the default instruction.
Candidates select source_website_url from image results. This keeps one Responses
call, configured model, canonical selected image/original context, client words,
all bounds, no arbitrary seller fetch and no automatic paid retry. The existing
source/image association and unknown seller facts remain unchanged. The official
contract was checked at https://developers.openai.com/api/docs/guides/tools-web-search
(image search results: content types, result include, source/image URL fields).

The old model-candidate path could accept a generic title while its source URL or
reason disclosed upholstery/furnishing. Every worldwide candidate now checks URL
path, title, reason and source captions for decor. Later contradictory captions
retract cards through the existing removedUrls and cache invalidation mechanism,
including a later failed stream. Known fiber/client exclusions remain separate.
Source-only completion says no fabric photographs were returned, including in
Search details. Existing P1 status and P3 details govern this copy. No new visible
component, CSS/layout, saved schema or presentation authority; Fabric stays v11.

## Files and validation

Runtime: docs/server/fabric-worldwide.mjs only. Tests: fabric-worldwide.mjs,
fabric-search-ui.mjs, app-regression.mjs, aesthetic-authority.mjs. Continuity:
AGENTS.md, FABRIC-SEARCH.md, requests/fixes, this file and COMMIT-REVIEW.
The image-only request regression fails the prior implementation. All 29 focused
worldwide cases pass, including disguised decor, escaped source paths, late decor
retraction followed by failure, and source-only status without retry. The actual
UI renders that status and details under default and changed valid saved settings
at six phone/tablet/desktop widths; isolated fabric UI passes. Default phone and
saved desktop captures have been visually inspected. Root locked npm ci passed.

All 77 functional/syntax Cloud Build commands, full app-regression and smoke pass
(79/79) under Node20.20.2. Worldwide (29), search (57), forced-GC and sourcing (18)
also pass on Node24.22.1, downloaded to /private/tmp with the official checksum
verified. Integrated Aesthetic Control passes within app-regression. The local
commit requires and records a successful final standalone Aesthetic Control run
last, after all edits and functional checks. Tests use fake providers and temporary
headless Chromium profiles, never personal Chrome. Only the explicit live
refinement used the live provider.

## Exact next step and limitations

The prepared local commit contains only this task's files. Owner controls Push.
After Push, verify successful Cloud Build and test the default search on the same
saved garment. Do not call the local correction live
until Hosting/App/Admin/API all match its new commit, then test the same saved
hooded tailcoat with the default search (no specially typed refinement). The live
four-photo proof validates the search direction on 116a11c, not the image-only
request parameter in this unpushed revision or a guarantee of twelve websites.
No credential, production environment, billing, saved project, account or lookbook
mutation was performed. No Push or deployment. No private ChatGPT internals claim.

## Preserved continuity

Canonical account/submission/garment scope, selected dissected image first, source
photo URL association, unknown seller facts, exclusion/variant retractions,
Node20 combined-signal lifetime guard and separate explicit retailer searches
remain. Healthy image nodes retain their eight-second/four-URL fallback behavior.
Admin stays Settings, Messages, Logs; fixed notification history and H3/circle/
closed-spacing fixes remain. Shared aesthetic authority remains the final gate.
