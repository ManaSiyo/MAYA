# Current handoff — worldwide Fabrics

## Request and boundaries

The owner now requires the main Fabrics experience to inspect the original image,
identify its separate textiles and search worldwide, like the supplied ChatGPT
example. Local/Britex/Mood and the other named shops are optional, separate searches
on explicit clicks. They must neither restrict nor delay the main search. This
supersedes older default all-five merchant filters and mandatory seller/photo
verification for every main suggestion. See FABRIC-SEARCH.md and the top AGENTS
clarification for the active architecture.

No personal Chrome, microphone, live provider test, private account inspection,
credentials or production configuration was used or changed. Live testing remains
stopped. Local verified commits are authorized; Push is owner-only. A key pasted
in earlier chat was not used or stored. No campaigns or billing settings changed.

The checkout began at 97addd2, two commits ahead of origin/maya-v2 8db49da.
Prior component sourcing b7afaa8 and ready-feed scheduling 97addd2 remain intact
in the explicit optional retailer path. Their synthetic speed result is not a
measurement of this new main search. Public release identity was not rechecked
in this task; the last earlier observation was Hosting/API 7232f50.

## Main implementation

New docs/server/fabric-worldwide.mjs owns one streamed Responses request using
the existing configured text/vision model. It supplies the original image,
canonical saved selected crop and bounded client words/garment context. The model
uses unrestricted text/image web search and emits a short material interpretation
plus useful per-material product suggestions. No nine-merchant allowlist, local
priority, retailer feed fan-out, seller fetch or second visual-rank request runs
on the main path. The provider has five tool calls/3200 output tokens and a
50-second deadline inside existing route/browser deadlines. Exact ChatGPT private
implementation or identical latency is neither available nor promised.

Only raw search sources/citations can ground a product URL; photos must come from
page-linked raw image-search results, never model image URLs. Missing photos retain
a sourced link with the existing placeholder. Discovered arbitrary hosts are never
fetched by the server. Unsafe URLs and known client exclusions are checked. Main
results are web suggestions, not independently verified inventory: price/unit/
stock/composition stay unknown. No generated product image, swatch-as-yardage,
finished-clothing or hardware sourcing was added. Source evidence can arrive after
candidate text; cards wait for it, then stream before completion when available.

The adapter handles bounded SSE, byte-split Unicode/CRLF, terminal completion,
incomplete/error/early EOF and abort-ignoring providers/readers. Errors are safe
fixed messages. Node20 combined-signal WeakMap lifetime protection remains. Existing
fixed numeric diagnostics continue; retailer and second-visual durations are zero
for the main path. No private search content or URLs are logged.

fabric-search.mjs defaults mode to worldwide and ignores old store fields there;
only explicit retailers mode invokes existing approved-shop checks. Canonical saved
context and account/submission boundaries precede either provider path. New module
ships through Dockerfile. fabric-sourcing.js adds lightweight known negative client
constraints for global suggestions without enforcing guessed main-cloth properties.

## Client and shared aesthetics

fabric-assistant.js starts worldwide with no shops selected. Search specific shops
opens the existing five buttons without a provider call. A group click starts an
independent search; Sourceable restores main results with no repeated call. Cache
keys include mode/group plus private garment/material/reference context. Unsent
refinement drafts survive switches but are not submitted automatically. Partial
source-backed cards survive interruptions and reopening; their state remains
interrupted and requires explicit Refresh. Old provisional retailer candidates do
not become retained results. Account/project changes clear private state; existing
bounded memory/reference caches, generation-checked lookbooks and explicit Remove
remain. No private request is cached in the shared catalog.

The material breakdown now uses the existing P1 observation, alongside H4/P3 Inner
cards and Glass controls. The active workspace preview includes that P1 role.
No CSS family, independent material, table or editor was introduced. Brief and
Operations reference JS/CSS v8 under existing exact no-cache Hosting policy;
domain/release contracts cover it. Changed files also include focused world/search/
workflow fixtures, integrated request assertions and authority coverage notes.

## Validation and remaining acceptance

Functional verification passes: 57 optional-search checks plus 10 new worldwide
checks, including source/image grounding, one-call architecture, canonical context,
client exclusions, incomplete streams and parent/own deadline settlement. Forced-GC
search gates pass on release Node20.20.2 and local Node24. Focused UI/workflow checks
cover worldwide external merchants, each optional group, partial streaming,
cache restoration without another request, unsent drafts and sealed scope races.
Default and deliberately different saved P1/H4/P3/material settings, actual Save,
inline/expanded layout and six widths pass in temporary isolated fake-provider
renderers. They do not use the owner's Chrome profile or actual product photos.

The 76-command exact functional/release/regression/smoke sweep completed. Its sole
failure was a stale source assertion for the old retained-card catch; corrected to
assert published source-backed versus provisional results, then the full integrated
regression passed. All other sweep gates including smoke passed. A final review found cached worldwide cards could lose their P1 material
breakdown after a shop switch. Preserve that observation in each result context;
the focused workflow fixture now asserts its restoration and passes. Final
standalone Aesthetic Control passes last after that fix, including re-executed
changed-surface fixtures. Default, deliberately different saved desktop/expanded
and phone captures were visually inspected; no production design was changed.

No live first-useful latency, actual search output quality, provider entitlement
or current inventory was measured. Do not claim the fixtures prove ChatGPT parity.
Next: owner Push of the three prepared local fabric commits. This task is locally
verified and COMMIT-REVIEW describes the final change; no source changed after
the final authority run.
After owner Push, verify exact Hosting/page/API commit and fabric v8 bytes/cache
policy. Real acceptance is the same look yielding useful separate worldwide
materials promptly with accurate source links; renewed live tests require respecting
the owner's stop and credential boundaries.

## Retained work

WR is independent and empty until explicit applicant additions; tables share
appearance only. Glass is the sole pill authority and the retired internal Studio
remains removed. Shared scrollbar v2 owns visible paint/geometry. Direct Google/
Meta/ChatGPT Ads reporting remains read-only without Windsor; presence booleans do
not prove configured access. Owner handles provider credentials/environment setup.
See DIRECT-AD-REPORTING.md. No voice, communications, Ads or account authorization
behavior changed in this task.
