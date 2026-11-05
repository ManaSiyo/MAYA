# Current handoff — November 5 phone/iPad visualization

## Request and changes

Phone/iPad visualization, avatar auto-save, larger touch buttons and newest image
models. frontend/index.html now saves uploaded/camera/replacement/random photos,
names and measurements automatically, without requiring a name or Avatar Save.
Transactions retain stable IDs and unrelated records; account/client versions and
remote revisions reject stale writes/deleted entries. Stored photo URLs are reused.
Removing an avatar retains its project photo. Existing explicit project/design
Save, confirmations and reviewed send controls remain.

A photo alone is sufficient to visualize. Local photo preparation settles before
visualization; slow cloud save does not block it. Short speech tails flush once,
and consumed interim speech no longer causes a 30-second wait/repeated extraction.
Image edit references prepare once with two bounded workers, preserving order and
uncropped originals. Frontend requests use gpt-image-2.6-flare with medium complexity;
quality, size and prompts remain unchanged. Brief/Operations already use 2.6 Flare
from b7ccf5d. Sharing opens an already-generated image, so its load time is not a
fresh-generation latency benchmark.

Optional touchTargetSize (32–56px, default 44) lives in the existing Glass editor
and active Touch preview, validated client/server. Coarse pointers gain that
minimum button size; desktop geometry/materials stay intact. Shared pill runtime
v2 / typography v25 and gallery v35 are cache-bumped across served consumers.
Compact board dots stay compact and hide beneath the phone drawer. Avatar/project
row controls reserve separate targets and do not depend on hover. Fabric assets
v14 preserve the results area and bottom status; narrow touch shop choices scroll
horizontally. In House/Global photo/caption geometry remains the same.
Files: frontend, shared pill/typography/gallery, design-config, served HTML refs,
new autosave/preparation/mobile fixtures, updated regression/lifecycle/model tests,
cloudbuild and final authority, plus continuity docs.

## Official image guidance

https://developers.openai.com/api/docs/guides/image-generation documents 2.6 Flare
for fast iteration, with low/medium/high complexity and high as omitted default.
Complexity controls planning separately from quality. The prior model migration
verified published token rates equal 2.5 Flare; per-image cost and live latency are
not measured. No paid calls, credentials, environment changes or personal Chrome.

## Verification

All 84 Cloud Build functional/syntax commands pass after targeted reruns, plus
full app-regression and smoke (86 commands total). Obsolete manual-avatar Save
expectations were updated; actual touch overlap and narrow Fabric results/status
failures were repaired, with the assertions retained. Release/domain asset checks
now require v14. Focused Node20/Node24 autosave, preparation/model checks pass;
Node24 worldwide/legacy fabric and forced-GC gates also pass. Final conflict-cache
recovery reran avatar, profile and project lifecycle checks after review.

Chromium and WebKit cover 320/390 phones, phone landscape, 768/834 tablets and
1194px tablet landscape, using fake providers. Upload without a name/measurements
reaches one 2.6 Flare request while cloud storage is held, without Avatar Save or
a missing-avatar modal. Saved avatars reopen correctly. Default/saved 44/52px
controls fit; avatar/project actions do not overlap, desktop geometry stays intact,
touch circles stay circular, and the active Touch editor saves/reloads its value.
Default/saved phone/tablet captures were visually inspected. Personal Chrome,
real microphones, live provider calls and physical iPad performance were not used.

Evidence: /private/tmp/maya-mobile-release.log and maya-mobile-gates/ (initial
run), maya-mobile-hands-rerun.log, maya-mobile-fabric-final.log,
maya-mobile-regression-complete.log, maya-mobile-smoke-final.log,
maya-mobile-webkit-authority.log and maya-mobile-fabric-node24.log.
Final standalone command is tests/aesthetic-authority.mjs on Node20, run last
before commit; its exit-zero result is required and recorded in
/private/tmp/maya-mobile-final-authority.log. Typography usage is regenerated.

## Deployment and unresolved live sourcing

Owner pushed b7ccf5d (new model) and 42622c7 (clean screens/Fabric reset).
Hosting release.json, app/Admin page build stamps and /api/healthz now all match
b7ccf5d2911c8dc08008f0bf5963bbf058a38002. tests/verify-live.mjs passed on that
prior release; evidence: /private/tmp/maya-mobile-prior-live.log. These mobile
changes are local only; no Push or deployment performed here.

Earlier live Global on the saved hooded-tailcoat completed empty: no photographs
reached the DOM. Cleanup/Fabric fixes and the model change do not prove that source
quality issue resolved. In House/Global parity, source evidence, exclusions and
private account/garment scope remain required. Image generation never substitutes
for sourced product photos.

## Exact next step

After the required final authority exits zero, commit these verified task files
locally. Owner Push remains for this task; do not Push automatically. After deployment verify release.json, page stamps and
/api/healthz, then actual iPhone/iPad photo upload/reopen/visualization and output
quality/timing. Separately accept the same saved garment Global search/Refresh
with real loaded photographs and clean Admin screens.
